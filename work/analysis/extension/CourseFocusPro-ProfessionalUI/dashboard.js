import {
  STATE_KEY,
  STUDY_PROFILES,
  cleanPatterns,
  dateSeries,
  defaultState,
  ensureToday,
  focusElapsedMinutes,
  formatClock,
  formatDuration,
  getActiveCourse,
  goalProgressPercent,
  mergeState,
  normalizeSubject,
  normalizeUrl,
  productivityScore,
  recordFocusAnalytics,
  safeUrl,
  sessionRemainingMs,
  sessionXp,
  subjectsForProfile,
  todayKey,
  uid
} from "./shared.js";

const hasChrome = Boolean(globalThis.chrome?.storage?.local);
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const systemThemeQuery = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
const ONBOARDING_VERSION = 3;
let state = defaultState();
let toastTimer = null;
let undoTimer = null;
let undoSnapshot = null;
let lastSeenWaterReminderAt = 0;
let waterReminderTriggerPending = false;
let onboardingStep = "welcome";
let charts = {};
let music = { ctx: null, gain: null, nodes: [], index: 0, playing: false, loop: true, shuffle: false, volume: 0.35, endTimer: null, imported: [], audio: null, source: "built-in", currentImportedId: null };
let uiSoundCtx = null;
const MUSIC_LIBRARY_KEY = "courseFocusProMusicLibrary";
const MUSIC_COMMAND_KEY = "courseFocusProMusicCommand";
const MUSIC_TRACKS = [
  { id: "lofi", title: "Lo-fi", description: "Soft warm tones for quiet study.", type: "tone", frequency: 196, wave: "triangle" },
  { id: "piano", title: "Piano", description: "Gentle piano-like pulses.", type: "tone", frequency: 261.63, wave: "sine" },
  { id: "nature", title: "Nature Sounds", description: "Light filtered ambience for calm focus.", type: "noise", filter: 1200 },
  { id: "white", title: "White Noise", description: "Even noise for blocking distractions.", type: "noise", filter: 5000 },
  { id: "rain", title: "Rain + Thunder", description: "Layered rain with soft distant thunder.", type: "rain" },
  { id: "brown", title: "Brown Noise", description: "Low smooth noise for concentration.", type: "noise", filter: 420 },
  { id: "deep", title: "Deep Focus", description: "Lower steady tone for long sessions.", type: "tone", frequency: 174, wave: "sine" },
  { id: "ocean", title: "Ocean Air", description: "Soft filtered wash for reading.", type: "noise", filter: 900 },
  { id: "wind", title: "Soft Wind", description: "Light airy texture for calm study.", type: "noise", filter: 2600 },
  { id: "warm", title: "Warm Pad", description: "Gentle pad for quiet problem solving.", type: "tone", frequency: 220, wave: "triangle" },
  { id: "coffee", title: "Coffee Shop Ambience", description: "Soft cafe room tone with warm background hum.", type: "coffee" },
  { id: "oceanwave", title: "Ocean Wave", description: "Slow breathing waves for relaxed study.", type: "oceanwave" },
  { id: "beat852", title: "852 Hz Beat", description: "A very subtle 852 Hz focus tone.", type: "tone", frequency: 852, wave: "sine", gain: 0.035, lfoFrequency: 3.2, lfoGain: 0.012 }
];

const el = {
  connectionLabel: $("#connectionLabel"), stateEyebrow: $("#stateEyebrow"), mainTitle: $("#mainTitle"), liveClock: $("#liveClock"), waterTopBtn: $("#waterTopBtn"), waterTopIcon: $("#waterTopIcon"), waterTopCount: $("#waterTopCount"), focusOpenCourseBtn: $("#focusOpenCourseBtn"),
  sideFocus: $("#sideFocus"), sideBlocked: $("#sideBlocked"), sideWater: $("#sideWater"), focusHeadline: $("#focusHeadline"), focusPill: $("#focusPill"), timerProgress: $("#timerProgress"), timerText: $("#timerText"), timerCaption: $("#timerCaption"), selectedCourseTitle: $("#selectedCourseTitle"), selectedCourseMeta: $("#selectedCourseMeta"), changeCourseBtn: $("#changeCourseBtn"), startFocusBtn: $("#startFocusBtn"),
  startForm: $("#startForm"), courseSelect: $("#courseSelect"), durationInput: $("#durationInput"), pauseFocusBtn: $("#pauseFocusBtn"), resumeFocusBtn: $("#resumeFocusBtn"), stopFocusBtn: $("#stopFocusBtn"), redirectEnabledInput: $("#redirectEnabledInput"), outsideBlockInput: $("#outsideBlockInput"), focusRemainingText: $("#focusRemainingText"),
  todayFocus: $("#todayFocus"), todaySessions: $("#todaySessions"), todayBlocks: $("#todayBlocks"), todayScore: $("#todayScore"), todayInsightTitle: $("#todayInsightTitle"), todayInsightText: $("#todayInsightText"),
  courseForm: $("#courseForm"), courseTitleInput: $("#courseTitleInput"), courseSubjectInput: $("#courseSubjectInput"), courseLibraryInput: $("#courseLibraryInput"), courseUrlInput: $("#courseUrlInput"), courseOverview: $("#courseOverview"), courseLibrariesList: $("#courseLibrariesList"), courseCount: $("#courseCount"), libraryForm: $("#libraryForm"), libraryNameInput: $("#libraryNameInput"),
  blockedForm: $("#blockedForm"), blockedInput: $("#blockedInput"), blockedList: $("#blockedList"), allowedForm: $("#allowedForm"), allowedInput: $("#allowedInput"), allowedList: $("#allowedList"),
  currentStreak: $("#currentStreak"), weeklyHours: $("#weeklyHours"), averageStudy: $("#averageStudy"), goalProgress: $("#goalProgress"), dailyComparison: $("#dailyComparison"), rankTitle: $("#rankTitle"), rankMeta: $("#rankMeta"), xpProgressFill: $("#xpProgressFill"), badgeRow: $("#badgeRow"), dailyChart: $("#dailyChart"), weeklyChart: $("#weeklyChart"), subjectChart: $("#subjectChart"), dailyChartMeta: $("#dailyChartMeta"), weeklyChartMeta: $("#weeklyChartMeta"), subjectChartMeta: $("#subjectChartMeta"),
  focusHistoryList: $("#focusHistoryList"),
  missionForm: $("#missionForm"), missionTitleInput: $("#missionTitleInput"), missionAreaInput: $("#missionAreaInput"), missionMinutesInput: $("#missionMinutesInput"), missionNoteInput: $("#missionNoteInput"), systemGoalsList: $("#systemGoalsList"), personalTaskList: $("#personalTaskList"), missionProgressText: $("#missionProgressText"), missionProgressFill: $("#missionProgressFill"), resetTasksBtn: $("#resetTasksBtn"),
  musicCategories: $("#musicCategories"), musicStatus: $("#musicStatus"), musicTitle: $("#musicTitle"), musicDescription: $("#musicDescription"), musicVolumeLabel: $("#musicVolumeLabel"), musicPrevBtn: $("#musicPrevBtn"), musicBackBtn: $("#musicBackBtn"), musicForwardBtn: $("#musicForwardBtn"), musicPlayBtn: $("#musicPlayBtn"), musicPauseBtn: $("#musicPauseBtn"), musicNextBtn: $("#musicNextBtn"), musicShuffleBtn: $("#musicShuffleBtn"), musicVolumeInput: $("#musicVolumeInput"), musicLoopInput: $("#musicLoopInput"), musicImportInput: $("#musicImportInput"), myMusicList: $("#myMusicList"),
  waterMenu: $("#waterMenu"), waterMenuCloseBtn: $("#waterMenuCloseBtn"), waterEnabledInput: $("#waterEnabledInput"), waterProgressText: $("#waterProgressText"), waterProgressFill: $("#waterProgressFill"), waterGrid: $("#waterGrid"), drinkWaterBtn: $("#drinkWaterBtn"), undoWaterBtn: $("#undoWaterBtn"), nextWaterText: $("#nextWaterText"), waterCelebration: $("#waterCelebration"), studyProfileSelect: $("#studyProfileSelect"), themeModeSelect: $("#themeModeSelect"), waterGoalInput: $("#waterGoalInput"), waterIntervalInput: $("#waterIntervalInput"), soundEnabledInput: $("#soundEnabledInput"), soundVolumeInput: $("#soundVolumeInput"), soundVolumeLabel: $("#soundVolumeLabel"), settingsFocusMinutesInput: $("#settingsFocusMinutesInput"), settingsForm: $("#settingsForm"), resetAnalyticsBtn: $("#resetAnalyticsBtn"), clearAllDataBtn: $("#clearAllDataBtn"), exportJsonBtn: $("#exportJsonBtn"), restoreBackupBtn: $("#restoreBackupBtn"), restoreBackupInput: $("#restoreBackupInput"), backupStatus: $("#backupStatus"),
  helpPopover: $("#helpPopover"), toast: $("#toast"), undoBar: $("#undoBar"), undoText: $("#undoText"), undoBtn: $("#undoBtn"), completionModal: $("#completionModal"), completionSubject: $("#completionSubject"), completionDuration: $("#completionDuration"), completionXp: $("#completionXp"), completionToday: $("#completionToday"), completionStreak: $("#completionStreak"), completionStartBtn: $("#completionStartBtn"), completionBreakBtn: $("#completionBreakBtn"), completionCloseBtn: $("#completionCloseBtn"), welcomeBackModal: $("#welcomeBackModal"), welcomeBackTime: $("#welcomeBackTime"), welcomeResumeBtn: $("#welcomeResumeBtn"), welcomeEndBtn: $("#welcomeEndBtn"), welcomeDismissBtn: $("#welcomeDismissBtn"), courseModal: $("#courseModal"), courseModalClose: $("#courseModalClose"), courseSwitchList: $("#courseSwitchList"), onboardingOverlay: $("#onboardingOverlay"), onboardingCard: $("#onboardingCard"), onboardingGetStartedBtn: $("#onboardingGetStartedBtn"), onboardingNameInput: $("#onboardingNameInput"), onboardingNameNextBtn: $("#onboardingNameNextBtn"), journeyContinueBtn: $("#journeyContinueBtn"), onboardingStudyProfileSelect: $("#onboardingStudyProfileSelect"), onboardingFocusMinutesInput: $("#onboardingFocusMinutesInput"), onboardingWaterGoalInput: $("#onboardingWaterGoalInput"), onboardingThemeSelect: $("#onboardingThemeSelect"), onboardingFinishSetupBtn: $("#onboardingFinishSetupBtn"), finishTutorialBtn: $("#finishTutorialBtn"), showOnboardingBtn: $("#showOnboardingBtn"), waterReminderPopup: $("#waterReminderPopup"), waterReminderLogBtn: $("#waterReminderLogBtn"), waterReminderCloseBtn: $("#waterReminderCloseBtn"), developerEmail: $("#developerEmail")
};

function sendMessage(message) { return hasChrome ? chrome.runtime.sendMessage(message) : Promise.resolve({ ok: false }); }
function resolvedTheme(mode) { const allowed = ["light", "dark", "midnight", "amoled", "forest", "purple", "beige", "slate", "teal", "rose"]; if (allowed.includes(mode)) return mode; return systemThemeQuery?.matches ? "dark" : "light"; }
function applyTheme() { const mode = state.settings.themeMode || "system"; document.documentElement.dataset.theme = resolvedTheme(mode); document.documentElement.dataset.themeMode = mode; if (el.themeModeSelect) el.themeModeSelect.value = mode; }
function showToast(message) { el.toast.textContent = message; el.toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2400); }
function showUndo(message, snapshot) { undoSnapshot = snapshot ? JSON.parse(JSON.stringify(snapshot)) : null; if (!undoSnapshot) return; el.undoText.textContent = message; el.undoBar.classList.remove("hidden"); clearTimeout(undoTimer); undoTimer = setTimeout(() => { el.undoBar.classList.add("hidden"); undoSnapshot = null; }, 7000); }
function hours(minutes) { return Math.round((Number(minutes || 0) / 60) * 10) / 10 + "h"; }
function activeSession() { const session = state.focusSession; return session?.active && (session.paused || sessionRemainingMs(session) > 0) ? session : null; }
function validUrl(raw) { const url = safeUrl(raw); return url && /^https?:/.test(url.protocol) ? url.href : ""; }
function inferTitle(url) { const host = safeUrl(url)?.hostname.replace(/^www\./, "") || "Study"; return host.includes("youtube") || host.includes("youtu.be") ? "YouTube Course" : host; }
function completedFocusSessions(days = null) { const cutoff = days ? Date.now() - days * 24 * 60 * 60000 : 0; return (state.analytics.focusHistory || []).filter((item) => item.completed && (!cutoff || Number(item.endedAt || item.startedAt || 0) >= cutoff)); }
function completedMinutesToday() { const today = todayKey(); return completedFocusSessions().filter((item) => todayKey(new Date(item.endedAt || item.startedAt || 0)) === today).reduce((sum, item) => sum + (Number(item.durationMinutes) || 0), 0); }
function completedSessionsToday() { const today = todayKey(); return completedFocusSessions().filter((item) => todayKey(new Date(item.endedAt || item.startedAt || 0)) === today).length; }
function currentSubjects() { return subjectsForProfile(state.profile?.studyProfile); }
function subjectTotalsFromHistory(days = null) { const subjects = currentSubjects(); const totals = Object.fromEntries(subjects.map((subject) => [subject, { minutes: 0, sessions: 0 }])); completedFocusSessions(days).forEach((item) => { const subject = normalizeSubject(item.subject, state.profile?.studyProfile); if (!totals[subject]) totals[subject] = { minutes: 0, sessions: 0 }; totals[subject].minutes += Number(item.durationMinutes) || 0; totals[subject].sessions += 1; }); return totals; }
function courseStudyMinutes(courseId) { return completedFocusSessions().filter((item) => item.courseId === courseId || item.courseTitle === state.courses.find((course) => course.id === courseId)?.title).reduce((sum, item) => sum + (Number(item.durationMinutes) || 0), 0); }
function playUiSound(kind = "soft") {
  if (!state.settings.soundEnabled || Number(state.settings.soundVolume || 0) <= 0) return;
  try {
    uiSoundCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const ctx = uiSoundCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const volume = Math.max(0, Math.min(0.18, Number(state.settings.soundVolume || 35) / 600));
    osc.type = "sine";
    osc.frequency.value = kind === "complete" ? 740 : kind === "water" ? 520 : 440;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
  } catch {}
}
function setActiveTab(tab) {
  const button = document.querySelector(".tab-button[data-tab='" + tab + "']");
  const panel = $("#tab-" + tab);
  if (!button || !panel) return;
  $$(".tab-button").forEach((b) => b.classList.toggle("active", b === button));
  $$(".tab-panel").forEach((p) => p.classList.toggle("active", p === panel));
  if (tab === "analytics") requestAnimationFrame(() => renderAnalytics());
}

async function loadState() {
  document.body.classList.add("is-loading");
  if (hasChrome) {
    const data = await chrome.storage.local.get(STATE_KEY);
    state = ensureToday(mergeState(data[STATE_KEY]));
    await chrome.storage.local.set({ [STATE_KEY]: state });
  } else {
    try { state = ensureToday(mergeState(JSON.parse(localStorage.getItem(STATE_KEY) || "null"))); } catch { state = defaultState(); }
  }
  applyTheme();
  render();
  document.body.classList.remove("is-loading");
}
async function saveState(next, options = {}) {
  state = ensureToday(mergeState(next));
  if (hasChrome) {
    await chrome.storage.local.set({ [STATE_KEY]: state });
    if (options.rescheduleWater) await sendMessage({ type: "rescheduleWater" });
  } else localStorage.setItem(STATE_KEY, JSON.stringify(state));
  applyTheme();
  render();
}
async function updateSettings(patch, options = {}) { await saveState({ ...state, settings: { ...state.settings, ...patch } }, options); }

function fillSelects() {
  [el.studyProfileSelect, el.onboardingStudyProfileSelect].forEach((select) => {
    if (!select) return;
    const selected = state.profile?.studyProfile || "jee";
    select.innerHTML = "";
    STUDY_PROFILES.forEach((profile) => { const option = document.createElement("option"); option.value = profile.id; option.textContent = profile.name; option.selected = profile.id === selected; select.append(option); });
  });
  [el.courseSubjectInput].forEach((select) => {
    if (!select) return;
    const selected = normalizeSubject(select.value || "Other", state.profile?.studyProfile);
    select.innerHTML = "";
    currentSubjects().forEach((subject) => { const option = document.createElement("option"); option.value = subject; option.textContent = subject; option.selected = subject === selected; select.append(option); });
  });
  if (el.courseLibraryInput) {
    const selected = el.courseLibraryInput.value || state.courseLibraries?.[0]?.id || "library-main";
    el.courseLibraryInput.innerHTML = "";
    (state.courseLibraries || []).forEach((library) => {
      const option = document.createElement("option");
      option.value = library.id;
      option.textContent = library.name;
      option.selected = library.id === selected;
      el.courseLibraryInput.append(option);
    });
  }
}

function renderHeader() {
  const session = activeSession();
  const course = getActiveCourse(state);
  el.connectionLabel.textContent = hasChrome ? "Chrome extension active" : "Preview mode";
  el.stateEyebrow.textContent = session ? (session.paused ? "Focus paused" : "Focus running") : "Ready";
  el.mainTitle.textContent = session ? session.courseTitle : "Start one clean study block";
  if (el.focusOpenCourseBtn) el.focusOpenCourseBtn.disabled = !course;
  el.stopFocusBtn.classList.toggle("hidden", !session);
}
function renderClock() {
  if (!el.liveClock) return;
  el.liveClock.textContent = "\uD83D\uDD52 " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function renderSideStats() {
  const goal = Math.max(1, state.settings.waterGoal || 8);
  const glasses = state.hydration.glasses || 0;
  el.sideFocus.textContent = formatDuration(state.stats.focusMinutes || 0);
  el.sideBlocked.textContent = String(state.stats.distractions || 0);
  el.sideWater.textContent = glasses >= goal ? "Done" : glasses + "/" + goal;
}
function renderFocus() {
  const session = activeSession();
  const course = getActiveCourse(state);
  el.courseSelect.value = course?.id || "";
  el.durationInput.value = state.settings.focusMinutesDefault || 50;
  el.redirectEnabledInput.checked = Boolean(state.settings.redirectEnabled);
  el.outsideBlockInput.checked = Boolean(state.settings.guardBlockedOutsideFocus);
  el.todayFocus.textContent = formatDuration(completedMinutesToday());
  el.todaySessions.textContent = String(completedSessionsToday());
  if (el.todayBlocks) el.todayBlocks.textContent = String(state.stats.distractions || 0);
  el.todayScore.textContent = String(productivityScore(state));
  el.selectedCourseTitle.textContent = course?.title || "No course selected";
  el.selectedCourseMeta.textContent = course ? (course.subject || "Other") + " - " + safeUrl(course.url)?.hostname.replace(/^www\./, "") : "Choose a course in the Courses tab.";
  const circumference = 427;
  if (!session) {
    el.focusHeadline.textContent = course ? "Ready" : "Choose a course";
    el.focusPill.textContent = course ? "Ready" : "Choose course";
    el.focusPill.classList.remove("active");
    el.startFocusBtn.disabled = false;
    el.startFocusBtn.textContent = "Start Focus";
    el.pauseFocusBtn?.classList.remove("hidden");
    if (el.pauseFocusBtn) el.pauseFocusBtn.disabled = true;
    el.resumeFocusBtn?.classList.add("hidden");
    el.stopFocusBtn.classList.add("hidden");
    el.focusRemainingText?.classList.add("hidden");
    el.timerProgress.style.strokeDashoffset = String(circumference);
    el.timerText.textContent = "00:00";
    el.timerCaption.textContent = course ? course.title : "Choose a course";
    return;
  }
  const totalMs = session.durationMinutes * 60000;
  const remainingMs = sessionRemainingMs(session);
  const ratio = Math.min(1, Math.max(0, 1 - remainingMs / Math.max(1, totalMs)));
  const remainingText = formatClock(remainingMs) + " remaining";
  el.focusHeadline.textContent = session.paused ? "Focus Paused" : "Focus Session Active";
  el.focusPill.textContent = session.paused ? "Paused" : "Active";
  el.startFocusBtn.disabled = true;
  el.startFocusBtn.textContent = session.paused ? "Focus Paused" : "Focus Session Active";
  el.pauseFocusBtn?.classList.toggle("hidden", session.paused);
  if (el.pauseFocusBtn) el.pauseFocusBtn.disabled = session.paused;
  el.resumeFocusBtn?.classList.toggle("hidden", !session.paused);
  el.stopFocusBtn.classList.remove("hidden");
  el.focusPill.classList.add("active");
  el.timerProgress.style.strokeDashoffset = String(circumference - circumference * ratio);
  el.timerText.textContent = formatClock(remainingMs);
  const percentComplete = Math.round(ratio * 100);
  el.timerCaption.textContent = session.paused ? percentComplete + "% complete - paused" : percentComplete + "% complete";
  if (el.focusRemainingText) {
    el.focusRemainingText.textContent = remainingText;
    el.focusRemainingText.classList.remove("hidden");
  }
}
function renderFocusTick() {
  const session = activeSession();
  if (!session) return;
  const circumference = 427;
  const totalMs = Math.max(1, Number(session.durationMinutes || 0) * 60000);
  const remainingMs = sessionRemainingMs(session);
  const ratio = Math.min(1, Math.max(0, 1 - remainingMs / totalMs));
  const percentComplete = Math.round(ratio * 100);
  el.timerProgress.style.strokeDashoffset = String(circumference - circumference * ratio);
  el.timerText.textContent = formatClock(remainingMs);
  el.timerCaption.textContent = session.paused ? percentComplete + "% complete - paused" : percentComplete + "% complete";
  if (el.focusRemainingText) {
    el.focusRemainingText.textContent = formatClock(remainingMs) + " remaining";
    el.focusRemainingText.classList.remove("hidden");
  }
}
function buildTodayInsight() {
  const completed = completedFocusSessions();
  if (!completed.length) return { title: "No insight yet", text: "Complete a focus session to unlock an automatic study insight." };
  const todayRemaining = Math.max(0, Math.round((state.goals.studyHours || 4) * 60 - completedMinutesToday()));
  if (todayRemaining > 0 && todayRemaining <= 45) return { title: "Close to today's goal", text: "You're only " + formatDuration(todayRemaining) + " away from today's study goal." };
  const week = subjectTotalsFromHistory(7);
  const physics = week.Physics?.minutes || 0;
  const chemistry = week.Chemistry?.minutes || 0;
  if (physics >= 60 && chemistry > 0 && chemistry + 30 < physics) return { title: "Chemistry needs attention", text: "Chemistry received " + formatDuration(physics - chemistry) + " less study time than Physics this week." };
  const ai = week.AI?.minutes || 0;
  if (completed.length >= 3 && ai === 0) return { title: "AI has been quiet", text: "AI has not appeared in your completed focus sessions this week." };
  const streak = state.analytics.streak?.current || 0;
  if (streak >= 3) return { title: "Great consistency", text: "You have maintained a " + streak + "-day study streak from completed focus sessions." };
  const top = Object.entries(week).sort((a, b) => b[1].minutes - a[1].minutes)[0];
  if (top && top[1].minutes > 0) return { title: "Most studied this week", text: top[0] + " is leading with " + formatDuration(top[1].minutes) + " from completed focus sessions." };
  return { title: "Keep the signal clean", text: "Your insights will improve as more completed focus sessions are tracked." };
}
function renderTodayInsight() {
  const insight = buildTodayInsight();
  el.todayInsightTitle.textContent = insight.title;
  el.todayInsightText.textContent = insight.text;
}
function renderCourses() {
  fillSelects();
  el.courseCount.textContent = state.courses.length + (state.courses.length === 1 ? " course" : " courses");
  renderCourseOverview();
  renderCourseLibraries();
}
function courseCard(course) {
    const isCurrent = course.id === state.settings.defaultCourseId;
    const card = document.createElement("article");
    card.className = "course-card" + (isCurrent ? " current" : "");
    card.innerHTML = "<div><span class='tag'></span><h4></h4><p></p></div><div class='course-actions'><select class='library-select'></select><button class='button secondary current-btn'></button><button class='button primary start'>Start</button><button class='button secondary open'>Open</button><button class='icon-button danger del'>x</button></div>";
    card.querySelector(".tag").textContent = isCurrent ? "Selected" : (course.subject || "Other");
    card.querySelector("h4").textContent = course.title;
    card.querySelector("p").textContent = course.url;
    const librarySelect = card.querySelector(".library-select");
    state.courseLibraries.forEach((library) => {
      const option = document.createElement("option");
      option.value = library.id;
      option.textContent = library.name;
      option.selected = library.id === course.libraryId;
      librarySelect.append(option);
    });
    librarySelect.addEventListener("change", () => moveCourseToLibrary(course.id, librarySelect.value));
    card.querySelector(".current-btn").textContent = isCurrent ? "Selected" : "Set Current";
    card.querySelector(".current-btn").disabled = isCurrent;
    card.querySelector(".current-btn").addEventListener("click", () => updateSettings({ defaultCourseId: course.id }).then(() => showToast("Course selected.")));
    card.querySelector(".start").addEventListener("click", () => startFocus(course.id));
    card.querySelector(".open").addEventListener("click", () => openCourse(course.url));
    card.querySelector(".del").addEventListener("click", () => deleteCourse(course.id));
    return card;
}
function renderCourseOverview() {
  if (!el.courseOverview) return;
  el.courseOverview.innerHTML = "";
  const active = getActiveCourse(state);
  const recent = [...state.courses].filter((course) => course.lastUsedAt).sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0)).slice(0, 4);
  const studied = [...state.courses].map((course) => ({ course, minutes: courseStudyMinutes(course.id) })).filter((item) => item.minutes > 0).sort((a, b) => b.minutes - a.minutes).slice(0, 4);
  const sections = [
    { title: "Continue Learning", items: active ? [{ course: active, label: "Current course" }] : [] },
    { title: "Recently Viewed", items: recent.map((course) => ({ course, label: course.lastUsedAt ? new Date(course.lastUsedAt).toLocaleDateString() : "" })) },
    { title: "Most Studied", items: studied.map(({ course, minutes }) => ({ course, label: formatDuration(minutes) })) },
    { title: "All Courses", items: state.courses.slice(0, 6).map((course) => ({ course, label: course.subject || "Other" })) }
  ];
  sections.forEach((overviewSection) => {
    const section = document.createElement("section");
    section.className = "course-overview-section";
    section.innerHTML = "<h4></h4><div></div>";
    section.querySelector("h4").textContent = overviewSection.title;
    const list = section.querySelector("div");
    if (!overviewSection.items.length) list.innerHTML = "<p class='form-status'>No courses yet.</p>";
    overviewSection.items.forEach(({ course, label }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "course-mini-card";
      button.innerHTML = "<strong></strong><span></span>";
      button.querySelector("strong").textContent = course.title;
      button.querySelector("span").textContent = label || course.subject || "Course";
      button.addEventListener("click", () => updateSettings({ defaultCourseId: course.id }));
      list.append(button);
    });
    el.courseOverview.append(section);
  });
}
function renderCourseLibraries() {
  if (!el.courseLibrariesList) return;
  el.courseLibrariesList.innerHTML = "";
  if (!state.courses.length) { el.courseLibrariesList.innerHTML = "<div class='empty-state'><h4>No courses yet</h4><p>Add your first study link above. It will appear on the Focus page as the selected course.</p></div>"; return; }
  state.courseLibraries.forEach((library) => {
    const courses = state.courses.filter((course) => course.libraryId === library.id);
    const section = document.createElement("details");
    section.className = "course-library";
    section.open = !library.collapsed;
    section.innerHTML = "<summary><span></span><strong></strong><div class='course-library-actions'><button class='icon-button rename' type='button'>Edit</button><button class='icon-button danger delete' type='button'>x</button></div></summary><div class='course-library-list'></div>";
    section.querySelector("span").textContent = library.name;
    section.querySelector("strong").textContent = courses.length + (courses.length === 1 ? " course" : " courses");
    section.addEventListener("toggle", () => setLibraryCollapsed(library.id, !section.open));
    section.querySelector(".rename").addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); renameLibrary(library.id); });
    section.querySelector(".delete").addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); deleteLibrary(library.id); });
    const list = section.querySelector(".course-library-list");
    if (!courses.length) list.innerHTML = "<div class='empty-state compact-empty'><p>No courses in this library.</p></div>";
    courses.forEach((course) => list.append(courseCard(course)));
    el.courseLibrariesList.append(section);
  });
}
function renderChipList(container, patterns, onRemove) {
  container.innerHTML = "";
  cleanPatterns(patterns).forEach((pattern) => {
    const chip = document.createElement("span"); chip.className = "chip"; chip.textContent = pattern;
    const button = document.createElement("button"); button.type = "button"; button.textContent = "x"; button.addEventListener("click", () => onRemove(pattern));
    chip.append(button); container.append(chip);
  });
}
function renderShield() {
  renderChipList(el.blockedList, state.settings.blockedSites, (pattern) => updateSettings({ blockedSites: state.settings.blockedSites.filter((item) => item !== pattern) }));
  renderChipList(el.allowedList, state.settings.allowedSites, (pattern) => updateSettings({ allowedSites: state.settings.allowedSites.filter((item) => item !== pattern) }));
}
function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function chartPalette() { return { blue: cssVar("--chart-blue") || cssVar("--blue") || "#2f7cf6", green: cssVar("--chart-green") || cssVar("--green") || "#12b981", amber: cssVar("--chart-amber") || cssVar("--amber") || "#e59b23", violet: cssVar("--chart-violet") || cssVar("--violet") || "#7857d8", muted: cssVar("--muted") || "#687789", grid: cssVar("--chart-grid") || "rgba(100,116,139,.16)", text: cssVar("--ink") || "#142033", surface: cssVar("--surface") || "#fff" }; }
function chartAlpha(color, alpha) {
  if (!color) return "rgba(47,124,246," + alpha + ")";
  const hex = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    const n = parseInt(hex.slice(1), 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + alpha + ")";
  }
  return color;
}
function chart(key, canvas, config) { if (!canvas || !globalThis.Chart) return; if (charts[key]) charts[key].destroy(); charts[key] = new Chart(canvas, config); }
function chartOptions(label, horizontal = false, suggestedMax = null, showLegend = false) {
  const colors = chartPalette();
  const valueAxis = horizontal ? "x" : "y";
  const categoryAxis = horizontal ? "y" : "x";
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? "y" : "x",
    animation: { duration: 180 },
    interaction: { mode: "nearest", intersect: false },
    layout: { padding: { top: 6, right: 10, bottom: 0, left: 4 } },
    plugins: {
      legend: { display: showLegend, position: "bottom", labels: { boxWidth: 9, usePointStyle: true, color: colors.text, padding: 12, font: { size: 12, weight: "600" } } },
      tooltip: { backgroundColor: colors.text, titleColor: colors.surface, bodyColor: colors.surface, padding: 10, displayColors: true, callbacks: { label: (ctx) => ctx.dataset.label + ": " + ctx.raw + " hours" } }
    },
    scales: {
      [valueAxis]: { beginAtZero: true, suggestedMax, title: { display: true, text: label, color: colors.text, font: { size: 12, weight: "700" } }, ticks: { display: true, color: colors.text, precision: 0, maxTicksLimit: 5, padding: 6 }, grid: { color: colors.grid, drawBorder: true } },
      [categoryAxis]: { ticks: { display: true, maxRotation: 0, autoSkip: false, color: colors.text, font: { size: 11, weight: "600" }, padding: 6 }, grid: { display: false } }
    }
  };
}
function addGoalLine(options, value, label) {
  const colors = chartPalette();
  return {
    ...options,
    plugins: {
      ...options.plugins,
      goalLine: { value, label, color: colors.amber }
    }
  };
}
function gamificationStats() {
  const history = completedFocusSessions();
  const focusXp = history.reduce((sum, item) => sum + (Number.isFinite(Number(item.xpEarned)) ? Number(item.xpEarned) : sessionXp(item.durationMinutes, item.completed)), 0);
  const systemGoals = systemGoalsData();
  const systemGoalXp = systemGoals.filter((goal) => goal.done).reduce((sum, goal) => sum + goal.xp, 0);
  const streakBonus = (state.analytics.streak?.current || 0) > 1 ? Math.min(250, (state.analytics.streak.current || 0) * 8) : 0;
  const xp = Math.round(focusXp + systemGoalXp + streakBonus);
  const level = Math.max(1, Math.floor(xp / 300) + 1);
  const levelStart = (level - 1) * 300;
  const nextLevel = level * 300;
  const progress = Math.min(100, Math.round(((xp - levelStart) / Math.max(1, nextLevel - levelStart)) * 100));
  const rank = rankForLevel(level);
  const badges = [];
  if (history.length >= 1) badges.push("First Focus");
  if ((state.analytics.streak?.current || 0) >= 3) badges.push("3-Day Streak");
  if (completedMinutesToday() >= 120) badges.push("Deep Work Day");
  if ((state.stats.distractions || 0) === 0 && (state.stats.focusMinutes || 0) > 0) badges.push("Clean Session");
  if ((state.hydration.glasses || 0) >= state.settings.waterGoal) badges.push("Hydrated");
  return { xp, level, progress, rank, badges };
}
function rankForLevel(level) {
  if (level >= 120) return "Legend";
  if (level >= 90) return "Discipline Master";
  if (level >= 70) return "Elite Scholar";
  if (level >= 50) return "Focus Master";
  if (level >= 35) return "Achiever";
  if (level >= 20) return "Scholar";
  if (level >= 10) return "Student";
  if (level >= 5) return "Learner";
  return "Beginner";
}
function renderGamification() {
  const stats = gamificationStats();
  el.rankTitle.textContent = "Level " + stats.level + " - " + stats.rank;
  el.rankMeta.textContent = stats.xp + " XP earned from verified focus sessions, system goals, hydration, and streaks";
  el.xpProgressFill.style.width = stats.progress + "%";
  el.badgeRow.innerHTML = "";
  if (!stats.badges.length) {
    el.badgeRow.innerHTML = "<span class='badge muted'>Badges appear as you study</span>";
    return;
  }
  stats.badges.slice(0, 5).forEach((badge) => {
    const item = document.createElement("span");
    item.className = "badge";
    item.textContent = badge;
    el.badgeRow.append(item);
  });
}
function renderAnalytics() {
  const weeklyMinutes = completedFocusSessions(7).reduce((sum, item) => sum + (Number(item.durationMinutes) || 0), 0);
  const avgMinutes = Math.round(weeklyMinutes / 7);
  const sixWeekMinutes = completedFocusSessions(42).reduce((sum, item) => sum + (Number(item.durationMinutes) || 0), 0);
  const weeklyAverageMinutes = Math.round(sixWeekMinutes / 6);
  el.currentStreak.textContent = (state.analytics.streak?.current || 0) + " days";
  el.weeklyHours.textContent = hours(weeklyAverageMinutes);
  el.averageStudy.textContent = hours(avgMinutes);
  el.goalProgress.textContent = goalProgressPercent(state) + "%";
  const todayMinutes = completedMinutesToday();
  el.dailyComparison.textContent = (todayMinutes >= avgMinutes ? "+" : "-") + formatDuration(Math.abs(todayMinutes - avgMinutes));
  renderGamification();

  const colors = chartPalette();
  const days = dateSeries(7);
  const dailyGoalHours = Math.max(0.1, Math.round((Number(state.goals.studyHours || 4)) * 10) / 10);
  const weeklyGoalHours = Math.round(dailyGoalHours * 7 * 10) / 10;
  if (el.dailyChartMeta) el.dailyChartMeta.textContent = "Goal " + dailyGoalHours + "h/day - Avg " + hours(avgMinutes);
  if (el.weeklyChartMeta) el.weeklyChartMeta.textContent = "Goal " + weeklyGoalHours + "h/week";
  if (el.subjectChartMeta) el.subjectChartMeta.textContent = "Completed focus sessions only";
  const dailyHours = days.map((d) => Math.round((completedFocusSessions().filter((item) => todayKey(new Date(item.endedAt || item.startedAt || 0)) === d).reduce((sum, item) => sum + (Number(item.durationMinutes) || 0), 0) / 60) * 10) / 10);
  chart("daily", el.dailyChart, {
    type: "bar",
    data: { labels: days.map((d) => d.slice(5)), datasets: [{ label: "Study hours", data: dailyHours, backgroundColor: chartAlpha(colors.blue, .88), borderColor: colors.blue }] },
    options: addGoalLine(chartOptions("Hours", false, dailyGoalHours), dailyGoalHours, "Goal " + dailyGoalHours + "h")
  });

  const weekLabels = [];
  const weekData = [];
  for (let i = 5; i >= 0; i--) {
    const end = new Date();
    end.setDate(end.getDate() - i * 7);
    const keys = dateSeries(7, end);
    weekLabels.push(i === 0 ? "This week" : "W-" + i);
    weekData.push(Math.round((keys.reduce((sum, key) => sum + completedFocusSessions().filter((item) => todayKey(new Date(item.endedAt || item.startedAt || 0)) === key).reduce((daySum, item) => daySum + (Number(item.durationMinutes) || 0), 0), 0) / 60) * 10) / 10);
  }
  chart("weekly", el.weeklyChart, {
    type: "bar",
    data: { labels: weekLabels, datasets: [{ label: "Weekly hours", data: weekData, backgroundColor: chartAlpha(colors.green, .88), borderColor: colors.green }] },
    options: addGoalLine(chartOptions("Hours", false, weeklyGoalHours), weeklyGoalHours, "Goal " + weeklyGoalHours + "h")
  });

  const subjectTotals = subjectTotalsFromHistory();
  const subjects = currentSubjects();
  const subjectValues = subjects.map((s) => Math.round(((subjectTotals[s]?.minutes || 0) / 60) * 10) / 10);
  chart("subject", el.subjectChart, {
    type: "bar",
    data: { labels: subjects, datasets: [{ label: "Subject hours", data: subjectValues, backgroundColor: chartAlpha(colors.violet, .86), borderColor: colors.violet }] },
    options: chartOptions("Hours")
  });
  renderHistory();
}
function renderHistory() {
  el.focusHistoryList.innerHTML = "";
  const history = state.analytics.focusHistory.slice(0, 8);
  if (!history.length) { el.focusHistoryList.innerHTML = "<div class='empty-state'><h4>No sessions yet</h4><p>Start a focus session and your study history will appear here.</p></div>"; return; }
  history.forEach((item) => { const row = document.createElement("article"); row.className = "history-row"; row.innerHTML = "<h4></h4><p></p>"; row.querySelector("h4").textContent = item.courseTitle || "Focus session"; row.querySelector("p").textContent = formatDuration(item.durationMinutes || 0) + " - " + (item.subject || "Other") + " - " + (item.completed ? "completed" : "stopped"); el.focusHistoryList.append(row); });
}
function missionCompletionPercent() {
  const tasks = state.daily.tasks || [];
  if (!tasks.length) return 0;
  const total = tasks.reduce((sum, task) => sum + Math.max(10, Number(task.minutes) || 20), 0);
  const done = tasks.filter((task) => task.done).reduce((sum, task) => sum + Math.max(10, Number(task.minutes) || 20), 0);
  return Math.round((done / Math.max(1, total)) * 100);
}
function weekdayGoalTemplate() {
  const waterTarget = Math.max(1, state.settings.waterGoal || 8);
  const day = new Date().getDay();
  const templates = [
    [{ type: "study", minutes: 150 }, { type: "sessions", count: 1 }, { type: "water", count: waterTarget }],
    [{ type: "study", minutes: 180 }, { type: "sessions", count: 2 }, { type: "water", count: waterTarget }],
    [{ type: "study", minutes: 240 }, { type: "clean", minutes: 60 }, { type: "sessions", count: 3 }],
    [{ type: "study", minutes: 120 }, { type: "water", count: waterTarget }, { type: "sessions", count: 1 }],
    [{ type: "study", minutes: 180 }, { type: "clean", minutes: 45 }, { type: "sessions", count: 2 }],
    [{ type: "study", minutes: 210 }, { type: "sessions", count: 2 }, { type: "water", count: waterTarget }],
    [{ type: "study", minutes: 150 }, { type: "sessions", count: 1 }, { type: "water", count: waterTarget }]
  ];
  return templates[day] || templates[1];
}
function systemGoalFromTemplate(goal) {
  if (goal.type === "sessions") {
    const value = completedSessionsToday();
    return { id: "sessions", title: "Complete " + goal.count + " Focus " + (goal.count === 1 ? "Session" : "Sessions"), value, target: goal.count, display: Math.min(value, goal.count) + " / " + goal.count + " sessions", xp: 60 };
  }
  if (goal.type === "water") {
    const value = state.hydration.glasses || 0;
    return { id: "water", title: "Drink " + goal.count + " Glasses", value, target: goal.count, display: Math.min(value, goal.count) + " / " + goal.count + " glasses", xp: 40 };
  }
  if (goal.type === "clean") {
    const value = (state.stats.distractions || 0) > 0 ? 0 : Math.min(completedMinutesToday(), goal.minutes);
    return { id: "clean", title: "Stay distraction-free for " + formatDuration(goal.minutes), value, target: goal.minutes, display: (state.stats.distractions || 0) > 0 ? "Distraction recorded today" : formatDuration(value) + " / " + formatDuration(goal.minutes), xp: 50 };
  }
  const value = completedMinutesToday();
  return { id: "study", title: "Study " + formatDuration(goal.minutes), value, target: goal.minutes, display: formatDuration(Math.min(value, goal.minutes)) + " / " + formatDuration(goal.minutes), xp: 80 };
}
function systemGoalsData() {
  return weekdayGoalTemplate().map(systemGoalFromTemplate).map((goal) => ({ ...goal, done: goal.value >= goal.target, percent: Math.min(100, Math.round((goal.value / Math.max(1, goal.target)) * 100)) }));
}
function renderSystemGoals() {
  if (!el.systemGoalsList) return;
  el.systemGoalsList.innerHTML = "";
  systemGoalsData().forEach((goal) => {
    const card = document.createElement("article");
    card.className = "system-goal-card" + (goal.done ? " done" : "");
    card.innerHTML = "<div><span></span><h4></h4><p></p></div><strong></strong><div class='progress-bar'><span></span></div>";
    card.querySelector("span").textContent = goal.done ? "Complete" : "In progress";
    card.querySelector("h4").textContent = goal.title;
    card.querySelector("p").textContent = goal.display || Math.min(goal.value, goal.target) + " / " + goal.target;
    card.querySelector("strong").textContent = "+" + goal.xp + " XP";
    card.querySelector(".progress-bar span").style.width = goal.percent + "%";
    el.systemGoalsList.append(card);
  });
}
function missionCard(task, index) {
  const item = document.createElement("article");
  item.className = "mission-item personal-goal-card" + (task.done ? " done" : "");
  item.innerHTML = "<input class='done' type='checkbox'><div class='personal-goal-copy'><strong></strong><span></span><p></p><small>No XP - personal goal</small></div><div class='mission-actions'><button class='button secondary compact-button edit' type='button'>Edit</button><button class='icon-button danger del' type='button'>x</button></div>";
  item.querySelector(".done").checked = task.done;
  item.querySelector("strong").textContent = task.title || "Personal goal";
  item.querySelector("span").textContent = (task.area || "Personal") + (Number(task.minutes || 0) ? " - " + task.minutes + " min" : "");
  item.querySelector("p").textContent = task.note || "No note added.";
  item.querySelector(".done").addEventListener("change", (e) => updateTask(index, { done: e.target.checked }));
  item.querySelector(".edit").addEventListener("click", () => editTask(index));
  item.querySelector(".del").addEventListener("click", () => deleteTask(index));
  return item;
}
function renderMissions() {
  renderSystemGoals();
  if (!el.personalTaskList) return;
  el.personalTaskList.innerHTML = "";
  const percent = missionCompletionPercent();
  el.missionProgressText.textContent = percent + "%";
  el.missionProgressFill.style.width = percent + "%";
  const indexed = state.daily.tasks.map((task, index) => ({ task, index }));
  if (!indexed.length) { el.personalTaskList.innerHTML = "<div class='empty-state'><h4>No personal goals yet</h4><p>Add homework, assignments, revision, or any custom goal here. These do not award XP.</p></div>"; return; }
  indexed.forEach(({ task, index }) => el.personalTaskList.append(missionCard(task, index)));
}
function musicMetadata(track) { return { id: track.id, title: track.title, type: track.type, size: track.size || 0, name: track.name || track.title, lastModified: track.lastModified || 0, available: Boolean(track.url) }; }
function saveMusicLibrary() {
  try { localStorage.setItem(MUSIC_LIBRARY_KEY, JSON.stringify({ imported: music.imported.map(musicMetadata), currentImportedId: music.currentImportedId })); } catch {}
}
function loadMusicLibrary() {
  try {
    const raw = JSON.parse(localStorage.getItem(MUSIC_LIBRARY_KEY) || "{}");
    music.imported = Array.isArray(raw.imported) ? raw.imported.map((track) => ({ ...track, available: false, url: "" })).slice(0, 80) : [];
    music.currentImportedId = raw.currentImportedId || null;
  } catch { music.imported = []; }
}
function stopImportedAudio() {
  if (music.audio) {
    try { music.audio.pause(); } catch {}
    music.audio.onended = null;
    music.audio = null;
  }
}
function activeImportedList() {
  return music.imported.filter((track) => track.available !== false);
}
function renderMyMusic() {
  if (!el.myMusicList) return;
  el.myMusicList.innerHTML = "";
  if (!music.imported.length) {
    el.myMusicList.innerHTML = "<div class='empty-state compact-empty'><h4>No imported songs</h4><p>Add MP3, WAV, or OGG files. They stay local and are never uploaded.</p></div>";
    return;
  }
  music.imported.forEach((track) => {
    const row = document.createElement("article");
    row.className = "music-track-row" + (music.source === "imported" && music.currentImportedId === track.id ? " active" : "") + (track.available === false ? " unavailable" : "");
    row.innerHTML = "<div><strong></strong><span></span></div><button class='button secondary compact-button play-track' type='button'>Play</button><button class='button danger compact-button' type='button'>Remove</button>";
    row.querySelector("strong").textContent = track.title;
    row.querySelector("span").textContent = track.available === false ? "Re-import needed after browser restart" : track.type.toUpperCase() + " ready";
    const play = row.querySelector(".play-track");
    play.textContent = track.available === false ? "Re-import" : "Play";
    play.addEventListener("click", () => track.available === false ? el.musicImportInput.click() : playImported(track.id));
    row.querySelector(".danger").addEventListener("click", () => removeImported(track.id));
    el.myMusicList.append(row);
  });
}
function renderMusic() {
  if (!el.musicCategories) return;
  el.musicCategories.innerHTML = "";
  MUSIC_TRACKS.forEach((track, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "music-category" + (music.source === "built-in" && index === music.index ? " active" : "");
    button.innerHTML = "<strong></strong><span></span>";
    button.querySelector("strong").textContent = track.title;
    button.querySelector("span").textContent = track.description;
    button.addEventListener("click", () => playMusic(index));
    el.musicCategories.append(button);
  });
  const imported = music.imported.find((track) => track.id === music.currentImportedId);
  const builtIn = MUSIC_TRACKS[music.index];
  const current = music.source === "imported" && imported ? imported : builtIn;
  el.musicTitle.textContent = current.title;
  el.musicDescription.textContent = music.source === "imported" && imported ? (imported.available === false ? "Re-import this local file to play it again." : "Imported local audio file.") : current.description;
  el.musicStatus.textContent = music.playing ? "Music Playing" : "Stopped";
  el.musicStatus.classList.toggle("active", music.playing);
  el.musicVolumeInput.value = Math.round(music.volume * 100);
  if (el.musicVolumeLabel) el.musicVolumeLabel.textContent = Math.round(music.volume * 100) + "%";
  el.musicLoopInput.checked = music.loop;
  el.musicShuffleBtn?.classList.toggle("active", music.shuffle);
  el.musicPlayBtn?.classList.toggle("active", music.playing);
  if (el.musicPlayBtn) el.musicPlayBtn.disabled = music.playing;
  if (el.musicPauseBtn) el.musicPauseBtn.disabled = !music.playing;
  el.musicPauseBtn?.classList.toggle("active", music.playing);
  const canSeek = music.source === "imported" && Boolean(music.audio);
  if (el.musicBackBtn) el.musicBackBtn.disabled = !canSeek;
  if (el.musicForwardBtn) el.musicForwardBtn.disabled = !canSeek;
  renderMyMusic();
}
function ensureMusicContext() {
  if (!music.ctx) {
    music.ctx = new (window.AudioContext || window.webkitAudioContext)();
    music.gain = music.ctx.createGain();
    music.gain.gain.value = music.volume;
    music.gain.connect(music.ctx.destination);
  }
  return music.ctx;
}
function stopMusicNodes() {
  clearTimeout(music.endTimer);
  music.endTimer = null;
  music.nodes.forEach((node) => { try { node.stop?.(); } catch {} try { node.disconnect?.(); } catch {} });
  music.nodes = [];
}
function makeNoiseBuffer(ctx, brown = false) {
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    data[i] = brown ? (last = (last + 0.02 * white) / 1.02) * 3.5 : white * 0.42;
  }
  return buffer;
}
function makeRainBuffer(ctx) {
  const length = ctx.sampleRate * 8;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let smooth = 0;
  for (let i = 0; i < length; i++) {
    const t = i / ctx.sampleRate;
    const white = Math.random() * 2 - 1;
    smooth = smooth * 0.78 + white * 0.22;
    const shower = white * 0.28 + smooth * 0.42;
    const droplets = Math.random() > 0.993 ? (Math.random() * 2 - 1) * 0.7 : 0;
    const thunderA = t > 1.2 && t < 2.8 ? Math.sin((t - 1.2) * Math.PI / 1.6) : 0;
    const thunderB = t > 5.4 && t < 7.1 ? Math.sin((t - 5.4) * Math.PI / 1.7) : 0;
    const rumble = (thunderA + thunderB) * smooth * 1.8;
    data[i] = Math.max(-1, Math.min(1, shower + droplets + rumble));
  }
  return buffer;
}
function createFilteredNoise(ctx, { buffer = makeNoiseBuffer(ctx), filter = 1200, gain = 0.14, filterType = "lowpass" } = {}) {
  const source = ctx.createBufferSource();
  const biquad = ctx.createBiquadFilter();
  const level = ctx.createGain();
  source.buffer = buffer;
  source.loop = true;
  biquad.type = filterType;
  biquad.frequency.value = filter;
  level.gain.value = gain;
  source.connect(biquad).connect(level).connect(music.gain);
  source.start();
  music.nodes.push(source, biquad, level);
  return level;
}
function playRainMusic(ctx) {
  createFilteredNoise(ctx, { buffer: makeRainBuffer(ctx), filter: 3600, gain: 0.17 });
  createFilteredNoise(ctx, { buffer: makeNoiseBuffer(ctx, true), filter: 150, gain: 0.12 });
}
function playCoffeeAmbience(ctx) {
  createFilteredNoise(ctx, { buffer: makeNoiseBuffer(ctx, true), filter: 720, gain: 0.075 });
  [118, 164, 226].forEach((frequency, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.value = 0.018 - index * 0.003;
    osc.connect(gain).connect(music.gain);
    osc.start();
    music.nodes.push(osc, gain);
  });
}
function playOceanWave(ctx) {
  const waveGain = createFilteredNoise(ctx, { buffer: makeNoiseBuffer(ctx, true), filter: 760, gain: 0.12 });
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.09;
  lfoGain.gain.value = 0.08;
  lfo.connect(lfoGain).connect(waveGain.gain);
  lfo.start();
  music.nodes.push(lfo, lfoGain);
}
function playMusic(index = music.index) {
  music.index = (index + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
  music.source = "built-in";
  stopImportedAudio();
  const track = MUSIC_TRACKS[music.index];
  const ctx = ensureMusicContext();
  ctx.resume?.();
  stopMusicNodes();
  if (track.type === "tone") {
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    osc.type = track.wave;
    osc.frequency.value = track.frequency;
    lfo.frequency.value = track.lfoFrequency || (track.id === "piano" ? 1.1 : 0.32);
    lfoGain.gain.value = track.lfoGain ?? (track.id === "piano" ? 0.18 : 0.07);
    const toneGain = ctx.createGain();
    toneGain.gain.value = track.gain ?? 0.18;
    lfo.connect(lfoGain);
    lfoGain.connect(toneGain.gain);
    osc.connect(toneGain).connect(music.gain);
    osc.start();
    lfo.start();
    music.nodes.push(osc, lfo, toneGain, lfoGain);
  } else if (track.type === "rain") {
    playRainMusic(ctx);
  } else if (track.type === "coffee") {
    playCoffeeAmbience(ctx);
  } else if (track.type === "oceanwave") {
    playOceanWave(ctx);
  } else {
    createFilteredNoise(ctx, { buffer: makeNoiseBuffer(ctx, track.id === "brown"), filter: track.filter || 1000, gain: track.id === "white" ? 0.09 : 0.16 });
  }
  music.playing = true;
  if (!music.loop) music.endTimer = setTimeout(() => nextMusic(), 10 * 60 * 1000);
  saveMusicLibrary();
  renderMusic();
}
function playImported(id) {
  const track = music.imported.find((item) => item.id === id);
  if (!track) return;
  if (track.available === false || !track.url) { showToast("Re-import this song to play it again."); el.musicImportInput.click(); return; }
  music.source = "imported";
  music.currentImportedId = id;
  stopMusicNodes();
  stopImportedAudio();
  const audio = new Audio(track.url);
  audio.volume = music.volume;
  audio.loop = music.loop;
  audio.onended = () => { if (!music.loop) nextMusic(); };
  music.audio = audio;
  music.playing = true;
  audio.play().catch(() => { music.playing = false; showToast("Click Play again if Chrome blocked audio start."); renderMusic(); });
  saveMusicLibrary();
  renderMusic();
}
function pauseMusic() {
  stopMusicNodes();
  stopImportedAudio();
  music.playing = false;
  renderMusic();
}
function randomOtherIndex(length, current) {
  if (length <= 1) return 0;
  let next = Math.floor(Math.random() * length);
  if (next === current) next = (next + 1) % length;
  return next;
}
function previousMusic() {
  if (music.source === "imported") {
    const list = activeImportedList();
    const index = list.findIndex((track) => track.id === music.currentImportedId);
    if (list.length) playImported(list[(index - 1 + list.length) % list.length].id);
    return;
  }
  playMusic(music.shuffle ? randomOtherIndex(MUSIC_TRACKS.length, music.index) : music.index - 1);
}
function nextMusic() {
  if (music.source === "imported") {
    const list = activeImportedList();
    const index = list.findIndex((track) => track.id === music.currentImportedId);
    if (list.length) playImported(list[music.shuffle ? randomOtherIndex(list.length, index) : (index + 1) % list.length].id);
    return;
  }
  playMusic(music.shuffle ? randomOtherIndex(MUSIC_TRACKS.length, music.index) : music.index + 1);
}
function handleMusicCommand(action) {
  if (action === "play") { music.source === "imported" && music.currentImportedId ? playImported(music.currentImportedId) : playMusic(); return true; }
  if (action === "pause") { pauseMusic(); return true; }
  if (action === "next") { nextMusic(); return true; }
  if (action === "previous") { previousMusic(); return true; }
  return false;
}
function seekImportedMusic(seconds) {
  if (!music.audio) return showToast("Seeking works with imported songs only.");
  const duration = Number.isFinite(music.audio.duration) ? music.audio.duration : 0;
  const next = Math.max(0, Math.min(duration || music.audio.currentTime + seconds, music.audio.currentTime + seconds));
  music.audio.currentTime = next;
}
function setMusicVolume(value) {
  music.volume = Math.max(0, Math.min(1, Number(value) / 100));
  if (music.gain) music.gain.gain.value = music.volume;
  if (music.audio) music.audio.volume = music.volume;
  if (el.musicVolumeLabel) el.musicVolumeLabel.textContent = Math.round(music.volume * 100) + "%";
}
function importMusicFiles(files) {
  const accepted = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/x-wav"];
  let added = 0;
  Array.from(files || []).forEach((file) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!accepted.includes(file.type) && !["mp3", "wav", "ogg"].includes(ext)) return;
    const existing = music.imported.find((track) => track.name === file.name && track.size === file.size && track.lastModified === file.lastModified);
    const next = { id: existing?.id || uid("song"), title: file.name.replace(/\.[^.]+$/, ""), name: file.name, type: ext || "audio", url: URL.createObjectURL(file), size: file.size, lastModified: file.lastModified, available: true };
    if (existing) {
      if (existing.url) URL.revokeObjectURL(existing.url);
      Object.assign(existing, next);
    } else {
      music.imported.push(next);
    }
    added += 1;
  });
  if (added) { saveMusicLibrary(); showToast(added + " song" + (added === 1 ? "" : "s") + " ready."); }
  renderMusic();
}
function removeImported(id) {
  const track = music.imported.find((item) => item.id === id);
  if (!track || !confirm("Remove this imported song from My Music?")) return;
  if (music.currentImportedId === id) pauseMusic();
  if (track.url) URL.revokeObjectURL(track.url);
  music.imported = music.imported.filter((item) => item.id !== id);
    saveMusicLibrary();
  renderMusic();
}
function helpInfo(title, text) {
  const lower = (title + " " + text).toLowerCase();
  if (lower.includes("xp & rank") || lower.includes("xp-rank")) {
    return {
      title: "XP & Rank",
      what: "XP is your verified study progress score.",
      why: "It rewards completed focus sessions, system goals, hydration goals, and streak consistency without giving XP for manual personal goals.",
      how: "Earn XP by finishing real focus sessions and daily system goals. Your level rises automatically, and your rank name changes when you reach the next range.",
      example: "Example: Completing a 50 minute focus session earns session XP and can move you closer to Learner, Scholar, or higher ranks.",
      details: ["Level 1-4: Beginner", "Level 5-9: Learner", "Level 10-19: Student", "Level 20-34: Scholar", "Level 35-49: Achiever", "Level 50-69: Focus Master", "Level 70-89: Elite Scholar", "Level 90-119: Discipline Master", "Level 120+: Legend"]
    };
  }
  const map = [
    ["focus defaults", ["Sets the default session length, study profile, theme, water target, and sound level.", "These are the settings you usually do once, then leave alone.", "Adjust the values, then press Save Settings.", "Example: Set default focus to 50 minutes and water goal to 8 glasses."]],
    ["timed session", ["Starts one study block for the selected course.", "The timer, redirect protection, and analytics all begin from this action.", "Choose the minutes, check the course, then press Start Focus once.", "Example: Start a 50 minute Physics session and let the extension open your course."]],
    ["redirect sends", ["Returns distracting tabs to your current course during Focus Mode.", "It prevents a small detour from becoming a long break.", "Keep the redirect switch on while studying and add distracting sites in Settings.", "Example: Instagram opens the focus redirect page, then returns you to Physics Wallah."]],
    ["today sessions", ["Counts completed focus blocks today.", "It shows whether you are building consistency, not just time.", "Finish a focus session to increase this number.", "Example: Two 25-minute sessions count as 2 sessions."]],
    ["productivity score", ["Combines completed study time, sessions, hydration, and distractions into one score.", "It gives a quick health check for today's study routine.", "Study, hydrate, and avoid blocked sites to raise it.", "Example: A high score means today was focused and balanced."]],
    ["insight uses", ["Shows one useful observation from completed focus sessions.", "It avoids guessing and only uses real tracked study data.", "Complete a few sessions and the insight becomes more personal.", "Example: It may point out that Chemistry has less study time than Physics this week."]],
    ["add course accepts", ["Saves any educational link as a course.", "This keeps your study starting point one click away.", "Paste a YouTube playlist, documentation page, coding site, or online course link.", "Example: Add a LeetCode study plan as a Coding course."]],
    ["my music", ["Imports local MP3, WAV, or OGG files for study music.", "Chrome protects local files, so after restart you may need to re-import them.", "Use Import, choose files from your computer, then play them from My Music.", "Example: Re-import your rain audio after reopening Chrome."]],
    ["daily study hours", ["Each bar shows how many focused hours were completed on that day.", "It makes weak and strong study days easy to see.", "Compare the bars with the goal line and average label.", "Example: A bar above the goal line means you hit the daily study target."]],
    ["system goals", ["Shows today's rotating goals from verified activity only.", "These goals prevent fake XP because they complete from focus sessions, hydration, or distraction-free time.", "Start focus sessions and log water; the cards update automatically.", "Example: Tuesday may ask for 4 hours, 3 sessions, and 60 distraction-free minutes."]],
    ["personal goals", ["A private custom list for homework, assignments, revision, or reminders.", "It keeps planning separate from XP, so progress stays honest.", "Add your own goal, then tick it when done. Use Edit to change it.", "Example: Add 'Finish chemistry homework' with a 40 minute estimate."]],
    ["blocked sites outside", ["Protects blocked websites even when Focus Mode is not running.", "It is useful if you want stronger daily discipline outside timed sessions.", "Turn it on only if you want blocked sites guarded all day. Supported sites are still allowed.", "Example: Reddit can be blocked outside focus while Google Docs remains open."]],
    ["blocked sites", ["Stores distracting sites the extension should catch.", "A clear block list makes redirects predictable.", "Add a domain like instagram.com or remove a chip with x.", "Example: Add youtube.com/shorts while keeping educational YouTube links as courses."]],
    ["supported sites", ["Stores study websites that should stay allowed.", "This prevents useful tools from being redirected during Focus Mode.", "Add domains you use for notes, coding, or classes.", "Example: Keep docs.google.com and github.com available while studying."]],
    ["analytics", ["Shows study time, streak, score, XP, and subject progress from completed sessions.", "It helps you see real patterns without manual tracking.", "Read the summary cards first, then use the bar charts for detail.", "Example: If Wednesday is low, plan one shorter recovery session."]],
    ["hydration", ["Tracks water against your daily glass goal.", "Small reminders protect energy during long study blocks.", "Use the top water button to log a glass, undo, or toggle reminders.", "Example: Set a goal of 8 glasses and log one after each session."]],
    ["music", ["Plays quiet study sounds or local audio files in the dashboard.", "It removes the need to open a separate music app.", "Pick a category or import local MP3/WAV/OGG files. After browser restart, import again to reconnect the file.", "Example: Import a rain track and loop it during problem solving."]],
    ["theme", ["Changes the look of every extension page.", "A comfortable palette makes long study sessions easier.", "Choose Light, Dark, System, or a named theme and it applies instantly.", "Example: Use AMOLED Black at night to reduce glare."]],
    ["streak", ["Shows how many days in a row you completed at least one study session.", "It helps you protect consistency, not just total hours.", "Finish one focus session today to keep the streak alive.", "Example: Study Monday, Tuesday, and Wednesday to reach a 3-day streak."]],
    ["weekly average", ["Shows your average study time per week across the last six weeks.", "It smooths out one unusually busy or weak week.", "Use it to see your normal weekly pace, then compare the weekly bars below.", "Example: A 12h weekly average means you usually study about two hours a day."]],
    ["daily average", ["Shows your average focused study time per day over the last seven days.", "It makes today's progress easier to judge.", "Compare today's study time with this number to see if you are ahead or behind.", "Example: If the average is 1h and today is 30m, one more short session balances the day."]],
    ["goal progress", ["Combines today's study time, focus sessions, hydration, and streak progress into one percentage.", "It gives a quick check of how complete today's routine feels.", "Complete verified focus sessions and log water to raise it.", "Example: 75% means most of today's core habits are already done."]],
    ["today vs average", ["Compares today's completed focus time with your seven-day daily average.", "It shows whether today is ahead or behind your recent routine.", "Use it to decide whether to add one more session or stop with confidence.", "Example: +25m means today is 25 minutes above your recent daily average."]],
    ["today study", ["Shows how much focused study you completed today.", "It tells you whether today has enough progress to support your streak.", "Start or log study time and this number updates automatically.", "Example: One 25-minute focus block counts toward today."]],
    ["xp", ["XP is earned from verified focus sessions, system goals, water goals, and streak bonuses.", "Levels rise as XP grows, while Study Rank updates automatically.", "Study consistently and complete system goals; personal goals do not award XP.", "Example: A completed focus session plus a streak bonus moves you closer to the next level.", ["Level 1-4: Beginner", "Level 5-9: Learner", "Level 10-19: Student", "Level 20-34: Scholar", "Level 35-49: Achiever", "Level 50-69: Focus Master", "Level 70-89: Elite Scholar", "Level 90-119: Discipline Master", "Level 120+: Legend"]]]
  ];
  const item = map.find(([key]) => lower.includes(key));
  const detail = item ? item[1] : [text || "This feature helps you study with less friction.", "It keeps important actions easier to understand.", "Use the controls in this section and review the result.", "Example: Start small, then adjust after one session."];
  return { title, what: detail[0], why: detail[1], how: detail[2], example: detail[3], details: detail[4] || [] };
}
function showHelp(button) {
  const text = button.dataset.help || "This helps you stay focused.";
  const statTitle = button.closest(".stat-widget")?.querySelector("span")?.textContent?.replace("?", "").trim();
  const key = button.dataset.helpKey || "";
  const title = key === "xp-rank" ? "XP & Rank" : statTitle || button.closest(".panel, .chart-card, .assistant-panel")?.querySelector("h3, h4")?.textContent?.trim() || button.closest("label")?.textContent?.replace("?", "").trim() || "Help";
  const info = helpInfo(title + " " + key, text);
  el.helpPopover.innerHTML = "";
  const heading = document.createElement("strong");
  heading.textContent = info.title;
  const copy = document.createElement("p");
  copy.textContent = info.what + " " + info.why + " " + info.how;
  el.helpPopover.append(heading, copy);
  if (info.details?.length) {
    const list = document.createElement("ul");
    info.details.forEach((line) => {
      const item = document.createElement("li");
      item.textContent = line;
      list.append(item);
    });
    el.helpPopover.append(list);
  }
  if (info.example) {
    const example = document.createElement("p");
    example.className = "help-example";
    example.textContent = info.example;
    el.helpPopover.append(example);
  }
  const rect = button.getBoundingClientRect();
  el.helpPopover.style.left = Math.min(window.innerWidth - 300, Math.max(12, rect.left)) + "px";
  el.helpPopover.style.top = Math.min(window.innerHeight - 120, rect.bottom + 8) + "px";
  el.helpPopover.classList.remove("hidden");
}
function renderWater() {
  const goal = Math.max(1, state.settings.waterGoal || 8);
  const glasses = state.hydration.glasses || 0;
  const complete = glasses >= goal;
  const percent = Math.min(100, Math.round((glasses / goal) * 100));
  if (el.waterTopIcon) el.waterTopIcon.textContent = complete ? "\u2705" : "\uD83D\uDCA7";
  if (el.waterTopCount) el.waterTopCount.textContent = complete ? "Goal Complete" : glasses + "/" + goal;
  el.waterTopBtn?.classList.toggle("goal-complete", complete);
  el.sideWater.textContent = complete ? "Done" : glasses + "/" + goal;
  el.waterEnabledInput.checked = Boolean(state.settings.waterEnabled);
  el.waterProgressText.textContent = complete ? "Goal complete" : glasses + "/" + goal;
  el.waterProgressFill.style.width = percent + "%";
  el.waterGoalInput.value = goal;
  el.waterIntervalInput.value = state.settings.waterIntervalMinutes || 60;
  el.waterGrid.innerHTML = "";
  for (let i = 0; i < goal; i++) {
    const glass = document.createElement("button");
    glass.type = "button";
    glass.className = "water-glass" + (i < glasses ? " filled" : "");
    glass.title = "Set water to " + (i + 1);
    glass.addEventListener("click", () => setWater(i + 1));
    el.waterGrid.append(glass);
  }
  el.waterCelebration.classList.toggle("hidden", !complete);
  const next = state.hydration.nextReminderAt ? Math.max(0, Math.ceil((state.hydration.nextReminderAt - Date.now()) / 60000)) : state.settings.waterIntervalMinutes;
  el.nextWaterText.textContent = !state.settings.waterEnabled ? "Water reminders are off" : complete ? "Daily goal complete. Reminders resume tomorrow." : "Next reminder in about " + next + " min";
  if (complete) dismissWaterReminder();
}
function renderSettings() {
  if (!el.settingsForm) return;
  el.settingsFocusMinutesInput.value = state.settings.focusMinutesDefault || 50;
  if (el.studyProfileSelect) el.studyProfileSelect.value = state.profile?.studyProfile || "jee";
  if (el.outsideBlockInput) el.outsideBlockInput.checked = Boolean(state.settings.guardBlockedOutsideFocus);
  el.themeModeSelect.value = state.settings.themeMode || "system";
  el.waterGoalInput.value = Math.max(1, state.settings.waterGoal || 8);
  el.waterIntervalInput.value = state.settings.waterIntervalMinutes || 60;
  if (el.soundEnabledInput) el.soundEnabledInput.checked = Boolean(state.settings.soundEnabled);
  if (el.soundVolumeInput) el.soundVolumeInput.value = Number(state.settings.soundVolume || 35);
  if (el.soundVolumeLabel) el.soundVolumeLabel.textContent = Number(state.settings.soundVolume || 35) + "%";
}

function renderCourseSwitchModal() {
  if (!el.courseSwitchList) return;
  el.courseSwitchList.innerHTML = "";
  if (!state.courses.length) {
    el.courseSwitchList.innerHTML = "<div class='empty-state'><h4>No courses yet</h4><p>Add one educational link in the Courses tab first.</p></div>";
    return;
  }
  state.courses.forEach((course) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "course-switch-item" + (course.id === state.settings.defaultCourseId ? " active" : "");
    button.innerHTML = "<strong></strong><span></span>";
    button.querySelector("strong").textContent = course.title;
    button.querySelector("span").textContent = (course.subject || "Other") + " - " + (safeUrl(course.url)?.hostname.replace(/^www\./, "") || "study link");
    button.addEventListener("click", async () => {
      await updateSettings({ defaultCourseId: course.id });
      el.courseModal.classList.add("hidden");
      showToast("Course selected: " + course.title);
    });
    el.courseSwitchList.append(button);
  });
}

function openCourseSwitchModal() {
  renderCourseSwitchModal();
  el.courseModal.classList.remove("hidden");
}

function renderCompletion() {
  if (!el.completionModal) return;
  const summary = state.focusCompletion;
  el.completionModal.classList.toggle("hidden", !summary);
  if (!summary) return;
  el.completionSubject.textContent = summary.subject || "Study";
  el.completionDuration.textContent = formatDuration(summary.durationMinutes || 0);
  el.completionXp.textContent = "+" + (summary.xpEarned || sessionXp(summary.durationMinutes, true)) + " XP";
  el.completionToday.textContent = formatDuration(summary.todayTotalMinutes || completedMinutesToday());
  el.completionStreak.textContent = (summary.streak || state.analytics.streak?.current || 0) + " days";
}

function renderWelcomeBack() {
  if (!el.welcomeBackModal) return;
  const session = activeSession();
  const show = Boolean(session?.welcomeBack);
  el.welcomeBackModal.classList.toggle("hidden", !show);
  if (!show) return;
  const remaining = Math.max(1, Math.ceil(sessionRemainingMs(session) / 60000));
  el.welcomeBackTime.textContent = formatDuration(remaining);
}

async function clearWelcomeBack() {
  const session = activeSession();
  if (!session?.welcomeBack) return;
  await saveState({ ...state, focusSession: { ...session, welcomeBack: false } });
}

async function clearCompletion() {
  if (!state.focusCompletion) return;
  await saveState({ ...state, focusCompletion: null });
}

function renderOnboarding() {
  const profile = state.profile || {};
  const shouldShow = !profile.onboarded || Number(profile.onboardingVersion || 0) < ONBOARDING_VERSION;
  el.onboardingOverlay?.classList.toggle("hidden", !shouldShow);
  if (shouldShow) { el.onboardingOverlay?.classList.remove("fade-out"); showOnboardingStep(onboardingStep); }
}

function showOnboardingStep(step) {
  onboardingStep = step;
  $$(".onboarding-step").forEach((item) => item.classList.toggle("active", item.dataset.step === step));
  el.onboardingCard?.classList.remove("step-animate");
  void el.onboardingCard?.offsetWidth;
  el.onboardingCard?.classList.add("step-animate");
}

function cleanOnboardingName() {
  return (el.onboardingNameInput?.value || state.profile?.name || "Student").trim().slice(0, 60) || "Student";
}

function continueOnboardingName() {
  const name = (el.onboardingNameInput?.value || "").trim();
  if (!name) {
    el.onboardingNameInput?.focus();
    el.onboardingNameInput?.classList.add("input-error");
    showToast("Please enter your name to continue.");
    return;
  }
  el.onboardingNameInput?.classList.remove("input-error");
  showOnboardingStep("journey");
}

async function saveOnboardingSetup() {
  const focusMinutesDefault = Math.max(5, Math.min(240, Number(el.onboardingFocusMinutesInput?.value) || state.settings.focusMinutesDefault || 50));
  const waterGoal = Math.max(1, Math.min(20, Number(el.onboardingWaterGoalInput?.value) || state.settings.waterGoal || 8));
  const themeMode = el.onboardingThemeSelect?.value || state.settings.themeMode || "system";
  const studyProfile = el.onboardingStudyProfileSelect?.value || state.profile?.studyProfile || "jee";
  await saveState({
    ...state,
    settings: { ...state.settings, focusMinutesDefault, waterGoal, themeMode },
    goals: { ...state.goals, water: waterGoal },
    profile: {
      ...(state.profile || {}),
      name: cleanOnboardingName(),
      profileType: "local",
      email: "",
      studyProfile,
      startedAt: state.profile?.startedAt || Date.now(),
      lastProfileAt: Date.now()
    }
  }, { rescheduleWater: true });
  showOnboardingStep("complete");
}

async function completeOnboarding() {
  const cleanName = cleanOnboardingName();
  el.onboardingOverlay?.classList.add("fade-out");
  await saveState({ ...state, profile: { ...(state.profile || {}), onboarded: true, onboardingVersion: ONBOARDING_VERSION, name: cleanName, profileType: "local", email: "", startedAt: state.profile?.startedAt || Date.now(), lastProfileAt: Date.now() } });
  setTimeout(() => el.onboardingOverlay?.classList.add("hidden"), 220);
  showToast("Congratulations, " + cleanName + ". Start your first focus session.");
}

async function showWelcomeAgain() {
  onboardingStep = "welcome";
  el.onboardingOverlay?.classList.remove("fade-out");
  await saveState({ ...state, profile: { ...(state.profile || {}), onboarded: false, onboardingVersion: 0 } });
}

function maybeShowWaterReminder() {
  if (!el.waterReminderPopup) return;
  const reminderAt = state.hydration?.lastReminderAt || 0;
  const complete = (state.hydration.glasses || 0) >= (state.settings.waterGoal || 8);
  if (!state.settings.waterEnabled || complete) { if (complete) dismissWaterReminder(); return; }
  const dueAt = state.hydration?.nextReminderAt || 0;
  if (hasChrome && dueAt && dueAt <= Date.now() && !reminderAt && !waterReminderTriggerPending) {
    waterReminderTriggerPending = true;
    sendMessage({ type: "triggerWaterReminder" }).then((result) => {
      waterReminderTriggerPending = false;
      if (result?.ok) { state = ensureToday(mergeState(result.response)); applyTheme(); render(); }
    }).catch(() => { waterReminderTriggerPending = false; });
    return;
  }
  if (!reminderAt || reminderAt === lastSeenWaterReminderAt) return;
  lastSeenWaterReminderAt = reminderAt;
  el.waterReminderPopup.classList.remove("is-dismissing");
  el.waterReminderPopup.classList.remove("hidden");
}

function dismissWaterReminder() {
  if (!el.waterReminderPopup || el.waterReminderPopup.classList.contains("hidden")) return;
  el.waterReminderPopup.classList.add("is-dismissing");
  window.setTimeout(() => {
    el.waterReminderPopup.classList.add("hidden");
    el.waterReminderPopup.classList.remove("is-dismissing");
  }, 180);
}

function render() { renderClock(); renderHeader(); renderSideStats(); renderFocus(); renderTodayInsight(); renderCourses(); renderShield(); renderAnalytics(); renderMissions(); renderMusic(); renderWater(); renderSettings(); renderCourseSwitchModal(); renderCompletion(); renderWelcomeBack(); renderOnboarding(); maybeShowWaterReminder(); }

async function addCourse(title, rawUrl, subject = "Other", libraryId = el.courseLibraryInput?.value || state.courseLibraries[0]?.id || "library-main") { const url = validUrl(rawUrl); if (!url) return showToast("Paste a valid course link."); const targetLibraryId = state.courseLibraries.some((library) => library.id === libraryId) ? libraryId : (state.courseLibraries[0]?.id || "library-main"); const course = { id: uid("course"), title: String(title || "").trim() || inferTitle(url), subject: normalizeSubject(subject, state.profile?.studyProfile), libraryId: targetLibraryId, url: normalizeUrl(url), createdAt: Date.now(), lastUsedAt: null }; await saveState({ ...state, courses: [course, ...state.courses], settings: { ...state.settings, defaultCourseId: state.settings.defaultCourseId || course.id } }); el.courseTitleInput.value = ""; el.courseUrlInput.value = ""; showToast("Course added."); }
async function deleteCourse(id) { const course = state.courses.find((c) => c.id === id); if (!course || !confirm("Delete course '" + course.title + "'?")) return; const previous = state; const courses = state.courses.filter((c) => c.id !== id); await saveState({ ...state, courses, focusSession: state.focusSession?.courseId === id ? null : state.focusSession, settings: { ...state.settings, defaultCourseId: state.settings.defaultCourseId === id ? courses[0]?.id || null : state.settings.defaultCourseId } }); showUndo("Course deleted.", previous); }
async function createLibrary(event) { event.preventDefault(); const name = el.libraryNameInput.value.trim().slice(0, 48); if (!name) return showToast("Library name is required."); const library = { id: uid("library"), name, collapsed: false, createdAt: Date.now() }; await saveState({ ...state, courseLibraries: [...state.courseLibraries, library] }); el.libraryNameInput.value = ""; showToast("Library created."); }
async function renameLibrary(id) { const library = state.courseLibraries.find((item) => item.id === id); if (!library) return; const name = prompt("Rename library", library.name)?.trim().slice(0, 48); if (!name) return; await saveState({ ...state, courseLibraries: state.courseLibraries.map((item) => item.id === id ? { ...item, name } : item) }); showToast("Library renamed."); }
async function deleteLibrary(id) { const library = state.courseLibraries.find((item) => item.id === id); if (!library) return; if (state.courseLibraries.length <= 1) return showToast("Keep at least one course library."); const remaining = state.courseLibraries.filter((item) => item.id !== id); const fallbackId = remaining[0]?.id || "library-main"; if (!confirm("Delete library '" + library.name + "'? Courses move to " + (remaining.find((item) => item.id === fallbackId)?.name || "another library") + ".")) return; const previous = state; await saveState({ ...state, courseLibraries: remaining, courses: state.courses.map((course) => course.libraryId === id ? { ...course, libraryId: fallbackId } : course) }); showUndo("Library deleted.", previous); }
async function setLibraryCollapsed(id, collapsed) { if (!state.courseLibraries.some((library) => library.id === id && library.collapsed !== collapsed)) return; await saveState({ ...state, courseLibraries: state.courseLibraries.map((library) => library.id === id ? { ...library, collapsed } : library) }); }
async function moveCourseToLibrary(courseId, libraryId) { await saveState({ ...state, courses: state.courses.map((course) => course.id === courseId ? { ...course, libraryId } : course) }); showToast("Course moved."); }
async function openCourse(url = getActiveCourse(state)?.url) { if (!url) return showToast("No course link available."); if (hasChrome) await sendMessage({ type: "openCourse", url }); else window.open(url, "_blank", "noopener"); }
async function startFocus(courseId = getActiveCourse(state)?.id) {
  if (!courseId) { setActiveTab("courses"); return showToast("Add or select a course first."); }
  const durationMinutes = Math.max(5, Number(el.durationInput.value) || state.settings.focusMinutesDefault);
  if (hasChrome) {
    const result = await sendMessage({ type: "startFocus", payload: { courseId, durationMinutes } });
    if (!result?.ok) return showToast(result?.error || "Could not start focus.");
    state = mergeState(result.response);
    applyTheme();
    render();
  } else {
    const course = state.courses.find((c) => c.id === courseId);
    const session = { id: uid("session"), active: true, courseId, courseTitle: course.title, courseUrl: course.url, subject: course.subject || "Other", startedAt: Date.now(), endsAt: Date.now() + durationMinutes * 60000, durationMinutes, paused: false, pausedAt: null, remainingMs: durationMinutes * 60000, accumulatedPausedMs: 0, distractionsBlocked: 0 };
    await saveState({ ...state, settings: { ...state.settings, defaultCourseId: courseId, focusMinutesDefault: durationMinutes }, courses: state.courses.map((item) => item.id === courseId ? { ...item, lastUsedAt: Date.now() } : item), focusSession: session, focusCompletion: null });
    openCourse(course.url);
  }
  showToast("Focus started. Opening your course.");
}
async function pauseFocus() {
  const session = activeSession();
  if (!session || session.paused) return;
  const remainingMs = sessionRemainingMs(session);
  el.pauseFocusBtn.disabled = true;
  if (hasChrome) {
    state = mergeState({ ...state, focusSession: { ...session, paused: true, pausedAt: Date.now(), remainingMs, endsAt: Date.now() + remainingMs } });
    render();
    const result = await sendMessage({ type: "pauseFocus" });
    if (result?.ok) state = mergeState(result.response);
    else await loadState();
  } else {
    await saveState({ ...state, focusSession: { ...session, paused: true, pausedAt: Date.now(), remainingMs, endsAt: Date.now() + remainingMs } });
  }
  el.pauseFocusBtn.disabled = false;
  applyTheme();
  render();
  showToast("Focus paused. Redirect protection is off.");
}
async function resumeFocus() {
  const session = activeSession();
  if (!session?.paused) return;
  const remainingMs = Math.max(0, Number(session.remainingMs) || sessionRemainingMs(session));
  el.resumeFocusBtn.disabled = true;
  if (hasChrome) {
    state = mergeState({ ...state, focusSession: { ...session, paused: false, pausedAt: null, remainingMs, endsAt: Date.now() + remainingMs } });
    render();
    const result = await sendMessage({ type: "resumeFocus" });
    if (result?.ok) state = mergeState(result.response);
    else await loadState();
  } else {
    await saveState({ ...state, focusSession: { ...session, paused: false, pausedAt: null, remainingMs, accumulatedPausedMs: (session.accumulatedPausedMs || 0) + Math.max(0, Date.now() - (session.pausedAt || Date.now())), endsAt: Date.now() + remainingMs } });
  }
  el.resumeFocusBtn.disabled = false;
  applyTheme();
  render();
  showToast("Focus resumed. Redirect protection is active.");
}
async function stopFocus() {
  if (hasChrome) {
    const result = await sendMessage({ type: "stopFocus" });
    if (result?.ok) state = mergeState(result.response);
    applyTheme();
    render();
  } else {
    const session = state.focusSession;
    const elapsed = session ? focusElapsedMinutes(session) : 0;
    const completed = session ? !session.paused && sessionRemainingMs(session) <= 0 : false;
    await saveState({ ...state, focusSession: null, focusCompletion: completed ? { id: session.id, courseTitle: session.courseTitle, subject: session.subject || "Other", durationMinutes: elapsed, xpEarned: sessionXp(elapsed, completed), todayTotalMinutes: state.stats.focusMinutes + elapsed, streak: state.analytics.streak?.current || 1, completedAt: Date.now() } : state.focusCompletion, analytics: session ? recordFocusAnalytics(state.analytics, session, elapsed, completed) : state.analytics, stats: { ...state.stats, focusMinutes: state.stats.focusMinutes + elapsed, sessionsCompleted: state.stats.sessionsCompleted + (completed ? 1 : 0) } });
  }
  showToast("Focus stopped.");
}
async function updateTask(index, patch) { const tasks = state.daily.tasks.map((task, i) => i === index ? { ...task, ...patch } : task); await saveState({ ...state, daily: { ...state.daily, tasks } }); }
async function deleteTask(index) { const task = state.daily.tasks[index]; if (!task || !confirm("Delete personal goal '" + task.title + "'?")) return; const previous = state; const tasks = state.daily.tasks.filter((_, i) => i !== index); await saveState({ ...state, daily: { ...state.daily, tasks } }); showUndo("Personal goal deleted.", previous); }
async function editTask(index) {
  const task = state.daily.tasks[index];
  if (!task) return;
  const title = prompt("Personal goal title", task.title || "")?.trim();
  if (!title) return;
  const area = prompt("Area or subject", task.area || "Personal")?.trim() || "Personal";
  const minutes = Math.max(0, Number(prompt("Estimated minutes", task.minutes || 0)) || 0);
  const note = prompt("Short note", task.note || "")?.trim() || "";
  await updateTask(index, { title: title.slice(0, 90), area: area.slice(0, 40), minutes, note: note.slice(0, 140) });
  showToast("Personal goal updated.");
}
async function addMission(event) { event.preventDefault(); const title = el.missionTitleInput.value.trim(); if (!title) return showToast("Personal goal title is required."); const task = { id: uid("task"), title, area: el.missionAreaInput.value.trim() || "Personal", minutes: Number(el.missionMinutesInput.value) || 0, note: el.missionNoteInput.value.trim(), priority: "personal", done: false }; await saveState({ ...state, daily: { ...state.daily, tasks: [...state.daily.tasks, task] } }); el.missionForm.reset(); showToast("Personal goal added."); }
async function resetMissions() { if (!confirm("Clear all personal goals?")) return; const previous = state; await saveState({ ...state, daily: { ...state.daily, tasks: [] } }); showUndo("Personal goals cleared.", previous); }
async function setWater(value) {
  const previousGlasses = state.hydration.glasses || 0;
  const glasses = Math.max(0, Math.min(40, Number(value) || 0));
  const goalReached = glasses >= (state.settings.waterGoal || 8);
  if (glasses > previousGlasses) dismissWaterReminder();
  await saveState({
    ...state,
    hydration: { ...state.hydration, glasses, lastReminderAt: null, nextReminderAt: goalReached ? null : state.hydration.nextReminderAt },
    stats: { ...state.stats, water: Math.max(0, (state.stats.water || 0) + (glasses - previousGlasses)) }
  }, { rescheduleWater: true });
  if (glasses > previousGlasses) {
    playUiSound("water");
    if (hasChrome) await sendMessage({ type: "clearWaterNotifications" });
  }
  if (goalReached && previousGlasses < state.settings.waterGoal) {
    playUiSound("complete");
    showToast("Water goal complete.");
  }
}
async function drinkWater(delta = 1) { await setWater((state.hydration.glasses || 0) + delta); }
async function saveSettings(event) {
  event.preventDefault();
  const waterGoal = Math.max(1, Number(el.waterGoalInput.value) || 8);
  const focusMinutesDefault = Math.max(5, Math.min(240, Number(el.settingsFocusMinutesInput.value) || 50));
  const studyProfile = el.studyProfileSelect?.value || state.profile?.studyProfile || "jee";
  await saveState({
    ...state,
    settings: {
      ...state.settings,
      themeMode: el.themeModeSelect.value,
      focusMinutesDefault,
      waterGoal,
      waterIntervalMinutes: Math.max(1, Number(el.waterIntervalInput.value) || 60),
      soundEnabled: el.soundEnabledInput?.checked ?? true,
      soundVolume: Math.max(0, Math.min(100, Number(el.soundVolumeInput?.value) || 0))
    },
    profile: { ...(state.profile || {}), studyProfile },
    goals: { ...state.goals, water: waterGoal }
  }, { rescheduleWater: true });
  showToast("Settings saved.");
}
async function resetAnalyticsData() {
  if (!confirm("Reset analytics, streaks, XP history, and subject study hours?")) return;
  const previous = state;
  await saveState({ ...state, analytics: defaultState().analytics, stats: { ...state.stats, focusMinutes: 0, distractions: 0, sessionsCompleted: 0 } });
  showUndo("Analytics reset.", previous);
}
async function clearAllData() {
  if (!confirm("Clear all local Course Focus Pro data? This removes courses, goals, missions, analytics, and settings.")) return;
  const previous = state;
  await saveState(defaultState());
  showUndo("All data cleared.", previous);
}
function exportJson() { const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "course-focus-pro-backup.json"; a.click(); URL.revokeObjectURL(a.href); el.backupStatus.textContent = "JSON backup exported."; }
async function restoreBackupFile(event) { const file = event.target.files?.[0]; if (!file) return; if (!confirm("Restore this backup and replace current local data?")) { event.target.value = ""; return; } const previous = state; try { const text = await file.text(); await saveState(mergeState(JSON.parse(text))); el.backupStatus.textContent = "Backup restored."; showUndo("Backup restored.", previous); showToast("Backup restored."); } catch { el.backupStatus.textContent = "Backup restore failed."; } finally { event.target.value = ""; } }

function bindEvents() {
  $$(".tab-button").forEach((button) => button.addEventListener("click", () => setActiveTab(button.dataset.tab)));
  el.changeCourseBtn?.addEventListener("click", openCourseSwitchModal);
  el.focusOpenCourseBtn?.addEventListener("click", () => openCourse());
  el.courseModalClose?.addEventListener("click", () => el.courseModal.classList.add("hidden"));
  el.courseModal?.addEventListener("click", (event) => { if (event.target === el.courseModal) el.courseModal.classList.add("hidden"); });
  el.waterTopBtn?.addEventListener("click", (event) => { event.stopPropagation(); el.waterMenu.classList.toggle("hidden"); el.waterTopBtn.setAttribute("aria-expanded", String(!el.waterMenu.classList.contains("hidden"))); });
  el.waterMenuCloseBtn?.addEventListener("click", () => { el.waterMenu.classList.add("hidden"); el.waterTopBtn?.setAttribute("aria-expanded", "false"); });
  el.onboardingGetStartedBtn?.addEventListener("click", () => showOnboardingStep("name"));
  el.onboardingNameNextBtn?.addEventListener("click", continueOnboardingName);
  el.onboardingNameInput?.addEventListener("input", () => el.onboardingNameInput.classList.remove("input-error"));
  el.journeyContinueBtn?.addEventListener("click", () => showOnboardingStep("setup"));
  el.showOnboardingBtn?.addEventListener("click", showWelcomeAgain);
  el.onboardingFinishSetupBtn?.addEventListener("click", saveOnboardingSetup);
  el.finishTutorialBtn?.addEventListener("click", completeOnboarding);
  el.completionStartBtn?.addEventListener("click", async () => { await clearCompletion(); await startFocus(); });
  el.completionBreakBtn?.addEventListener("click", clearCompletion);
  el.completionCloseBtn?.addEventListener("click", clearCompletion);
  el.completionModal?.addEventListener("click", (event) => { if (event.target === el.completionModal) clearCompletion(); });
  el.welcomeResumeBtn?.addEventListener("click", async () => { if (activeSession()?.paused) await resumeFocus(); await clearWelcomeBack(); });
  el.welcomeEndBtn?.addEventListener("click", async () => { await clearWelcomeBack(); await stopFocus(); });
  el.welcomeDismissBtn?.addEventListener("click", clearWelcomeBack);
  el.welcomeBackModal?.addEventListener("click", (event) => { if (event.target === el.welcomeBackModal) clearWelcomeBack(); });
  el.waterReminderLogBtn?.addEventListener("click", async () => { dismissWaterReminder(); await drinkWater(1); });
  el.waterReminderCloseBtn?.addEventListener("click", dismissWaterReminder);
  el.musicPlayBtn.addEventListener("click", () => music.source === "imported" && music.currentImportedId ? playImported(music.currentImportedId) : playMusic());
  el.musicPauseBtn.addEventListener("click", pauseMusic);
  el.musicPrevBtn.addEventListener("click", previousMusic);
  el.musicBackBtn.addEventListener("click", () => seekImportedMusic(-10));
  el.musicNextBtn.addEventListener("click", nextMusic);
  el.musicForwardBtn.addEventListener("click", () => seekImportedMusic(10));
  el.musicShuffleBtn.addEventListener("click", () => { music.shuffle = !music.shuffle; if (music.playing && music.shuffle) nextMusic(); else renderMusic(); showToast("Shuffle " + (music.shuffle ? "on" : "off") + "."); });
  el.musicImportInput.addEventListener("change", (event) => { importMusicFiles(event.target.files); event.target.value = ""; });
  el.musicVolumeInput.addEventListener("input", (event) => setMusicVolume(event.target.value));
  el.musicLoopInput.addEventListener("change", (event) => { music.loop = event.target.checked; if (music.audio) music.audio.loop = music.loop; if (music.playing && music.source === "built-in") { clearTimeout(music.endTimer); music.endTimer = null; if (!music.loop) music.endTimer = setTimeout(() => nextMusic(), 10 * 60 * 1000); } });
  document.addEventListener("click", (event) => { const help = event.target.closest?.(".help-button"); if (help) { event.preventDefault(); event.stopPropagation(); showHelp(help); return; } if (!event.target.closest?.("#helpPopover")) el.helpPopover.classList.add("hidden"); if (!event.target.closest?.("#waterMenu") && !event.target.closest?.("#waterTopBtn")) { el.waterMenu?.classList.add("hidden"); el.waterTopBtn?.setAttribute("aria-expanded", "false"); } });
  window.addEventListener("keydown", (event) => { if (event.key === "Escape") { el.helpPopover.classList.add("hidden"); el.courseModal?.classList.add("hidden"); el.waterMenu?.classList.add("hidden"); if (!el.completionModal?.classList.contains("hidden")) clearCompletion(); if (!el.welcomeBackModal?.classList.contains("hidden")) clearWelcomeBack(); } });
  el.startForm.addEventListener("submit", (e) => { e.preventDefault(); startFocus(); });
  el.pauseFocusBtn?.addEventListener("click", pauseFocus);
  el.resumeFocusBtn?.addEventListener("click", resumeFocus);
  el.stopFocusBtn.addEventListener("click", stopFocus);
  el.durationInput.addEventListener("change", () => updateSettings({ focusMinutesDefault: Math.max(5, Number(el.durationInput.value) || 50) }));
  el.redirectEnabledInput.addEventListener("change", () => updateSettings({ redirectEnabled: el.redirectEnabledInput.checked }));
  el.outsideBlockInput.addEventListener("change", () => updateSettings({ guardBlockedOutsideFocus: el.outsideBlockInput.checked }));
  el.courseForm.addEventListener("submit", (e) => { e.preventDefault(); addCourse(el.courseTitleInput.value, el.courseUrlInput.value, el.courseSubjectInput.value, el.courseLibraryInput.value); });
  el.libraryForm?.addEventListener("submit", createLibrary);
  el.blockedForm.addEventListener("submit", (e) => { e.preventDefault(); const value = el.blockedInput.value.trim().toLowerCase(); if (!value) return; updateSettings({ blockedSites: cleanPatterns([...state.settings.blockedSites, value]) }); el.blockedInput.value = ""; });
  el.allowedForm.addEventListener("submit", (e) => { e.preventDefault(); const value = el.allowedInput.value.trim().toLowerCase(); if (!value) return; updateSettings({ allowedSites: cleanPatterns([...state.settings.allowedSites, value]) }); el.allowedInput.value = ""; });
  el.missionForm.addEventListener("submit", addMission); el.resetTasksBtn.addEventListener("click", resetMissions);
  el.drinkWaterBtn.addEventListener("click", () => drinkWater(1)); el.undoWaterBtn.addEventListener("click", () => drinkWater(-1)); el.waterEnabledInput.addEventListener("change", () => updateSettings({ waterEnabled: el.waterEnabledInput.checked }, { rescheduleWater: true })); el.soundVolumeInput?.addEventListener("input", (event) => { el.soundVolumeLabel.textContent = event.target.value + "%"; }); el.settingsForm.addEventListener("submit", saveSettings); el.resetAnalyticsBtn.addEventListener("click", resetAnalyticsData); el.clearAllDataBtn.addEventListener("click", clearAllData); el.exportJsonBtn.addEventListener("click", exportJson); el.restoreBackupBtn.addEventListener("click", () => el.restoreBackupInput.click()); el.restoreBackupInput.addEventListener("change", restoreBackupFile);
  el.undoBtn.addEventListener("click", async () => { if (!undoSnapshot) return; const snapshot = undoSnapshot; undoSnapshot = null; el.undoBar.classList.add("hidden"); await saveState(snapshot); showToast("Undo complete."); });
  systemThemeQuery?.addEventListener?.("change", () => { applyTheme(); renderAnalytics(); });
  if (hasChrome) chrome.storage.onChanged.addListener((changes, area) => { if (area !== "local") return; if (changes[STATE_KEY]?.newValue) { state = ensureToday(mergeState(changes[STATE_KEY].newValue)); applyTheme(); render(); } if (changes[MUSIC_COMMAND_KEY]?.newValue) handleMusicCommand(changes[MUSIC_COMMAND_KEY].newValue.action); });
}
function handleParams() { const params = new URLSearchParams(location.search); const section = params.get("section"); const welcome = params.get("welcome"); if (welcome) showToast("Extension ready. Add your first course link."); if (section) { const map = { shield: "settings", mission: "daily", water: "focus", focus: "focus", advice: "focus", about: "about" }; setActiveTab(map[section] || section); } }
async function refreshDailyStateIfNeeded() {
  const before = state.daily?.date + "|" + state.hydration?.date + "|" + state.stats?.date;
  const next = ensureToday(state);
  const after = next.daily?.date + "|" + next.hydration?.date + "|" + next.stats?.date;
  if (before !== after) await saveState(next, { rescheduleWater: true });
}
fillSelects(); loadMusicLibrary(); bindEvents(); await loadState(); handleParams(); setInterval(() => { renderFocusTick(); renderWelcomeBack(); }, 1000); setInterval(renderClock, 60000); setInterval(renderWater, 30000); setInterval(maybeShowWaterReminder, 30000); setInterval(refreshDailyStateIfNeeded, 60000);
