export const STATE_KEY = "courseFocusProState";
export const ALARMS = { WATER: "water-reminder", FOCUS_END: "focus-end" };
export const STUDY_PROFILES = [
  { id: "jee", name: "JEE", subjects: ["Physics", "Chemistry", "Mathematics", "Other"] },
  { id: "upsc", name: "UPSC", subjects: ["History", "Geography", "Polity", "Economy", "Environment", "Science & Tech", "Current Affairs", "Ethics", "Essay", "Other"] },
  { id: "nda", name: "NDA", subjects: ["Mathematics", "English", "General Ability", "Physics", "Chemistry", "History", "Geography", "Current Affairs", "Other"] },
  { id: "coding-ai", name: "Coding & AI", subjects: ["Programming", "DSA", "Web Development", "Databases", "AI", "Machine Learning", "Projects", "Other"] },
  { id: "school", name: "School", subjects: ["Physics", "Chemistry", "Biology", "Mathematics", "English", "Social Science", "Computer Science", "Other"] },
  { id: "college", name: "College", subjects: ["Core Subject", "Mathematics", "Programming", "Lab Work", "Assignments", "Projects", "Research", "Other"] },
  { id: "accounting", name: "Accounting", subjects: ["Financial Accounting", "Cost Accounting", "Taxation", "Auditing", "Business Studies", "Economics", "Other"] },
  { id: "custom", name: "Custom", subjects: ["General", "Revision", "Practice", "Other"] }
];
export const DEFAULT_STUDY_PROFILE = "jee";
export const SUBJECTS = STUDY_PROFILES.find((profile) => profile.id === DEFAULT_STUDY_PROFILE).subjects;
export const DEFAULT_COURSE_LIBRARIES = [
  { id: "library-main", name: "My Library", collapsed: false }
];
const LEGACY_PROFILE_LIBRARY_IDS = new Set(["group-jee", "group-coding", "group-ai", "group-upsc", "group-school", "group-college", "group-custom"]);
export const DEFAULT_BLOCKED_SITES = ["instagram.com", "twitter.com", "x.com", "facebook.com", "youtube.com/shorts", "reddit.com", "netflix.com", "primevideo.com", "hotstar.com", "twitch.tv", "discord.com/app", "snapchat.com", "roblox.com", "poki.com", "crazygames.com", "miniclip.com", "steamcommunity.com", "store.steampowered.com"];
export const DEFAULT_ALLOWED_SITES = ["classroom.google.com", "docs.google.com", "drive.google.com", "sheets.google.com", "slides.google.com", "wikipedia.org", "khanacademy.org", "stackoverflow.com", "github.com", "developer.mozilla.org", "leetcode.com", "geeksforgeeks.org"];
export const DEFAULT_SETTINGS = { themeMode: "system", focusMinutesDefault: 50, defaultCourseId: null, redirectEnabled: true, redirectDuringFocus: true, guardBlockedOutsideFocus: true, reminderCooldownMinutes: 2, waterEnabled: true, waterGoal: 8, waterIntervalMinutes: 60, soundEnabled: true, soundVolume: 35, blockedSites: DEFAULT_BLOCKED_SITES, allowedSites: DEFAULT_ALLOWED_SITES };
export const DEFAULT_STUDY_GOALS = { studyHours: 4, chapters: 2, questions: 60, water: 8 };
export const DEFAULT_DAILY_TASKS = [];
const LEGACY_DEFAULT_TASK_TITLES = new Set(["revise yesterday's notes", "one jee concept block", "solve practice questions"]);
export const ASSISTANT_MESSAGES = { steady: "You only need one clean study block. Choose the course and begin before the mind starts bargaining.", repeatedDistractions: "Your attention is leaking. Choose one course, close the extra tabs, and protect the next ten minutes.", tabSwitching: "Too many tab switches. Keep one course tab, one notes tab, and let the rest wait.", blockedAttempts: "Blocked sites are repeating. Make the task smaller and return to the course now.", browsing: "Browsing is replacing studying. Pick a saved course and start one short focus block.", hydration: "Drink water now, then return to the current course. Keep the break short." };
export function todayKey(date = new Date()) { const tzOffset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10); }
export function uid(prefix = "id") { return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8); }
function num(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
export function cleanPatterns(patterns = []) { return [...new Set((Array.isArray(patterns) ? patterns : []).map((p) => String(p || "").trim().toLowerCase()).filter(Boolean))]; }
export function normalizeUrl(raw = "") { const text = String(raw || "").trim(); if (!text) return ""; if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return text; return "https://" + text; }
export function safeUrl(raw = "") { try { return new URL(normalizeUrl(raw)); } catch { return null; } }
export function isHttpUrl(raw = "") { const url = safeUrl(raw); return Boolean(url && ["http:", "https:"].includes(url.protocol)); }
export function isInternalUrl(raw = "") { return /^(chrome|chrome-extension|edge|about|devtools):/i.test(String(raw || "")); }
export function compactHost(raw = "") { const url = safeUrl(raw); return url ? url.hostname.replace(/^www\./, "") : String(raw || "").replace(/^https?:\/\//, "").split("/")[0]; }
export function patternMatchesUrl(pattern, rawUrl) { const clean = String(pattern || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, ""); const url = safeUrl(rawUrl); if (!clean || !url) return false; const host = url.hostname.toLowerCase().replace(/^www\./, ""); const path = url.pathname.toLowerCase(); const hostAndPath = host + path; if (clean.includes("/")) return hostAndPath.includes(clean); return host === clean || host.endsWith("." + clean); }
export function isBlockedUrl(rawUrl, settings = DEFAULT_SETTINGS) { return cleanPatterns(settings.blockedSites || DEFAULT_BLOCKED_SITES).some((p) => patternMatchesUrl(p, rawUrl)); }
export function isAllowedSupportUrl(rawUrl, settings = DEFAULT_SETTINGS) { return cleanPatterns(settings.allowedSites || DEFAULT_ALLOWED_SITES).some((p) => patternMatchesUrl(p, rawUrl)); }
export function extractYouTube(raw = "") { const url = safeUrl(raw); if (!url) return { videoId: null, playlistId: null }; const host = url.hostname.replace(/^www\./, ""); let videoId = null; if (host === "youtu.be") videoId = url.pathname.split("/").filter(Boolean)[0] || null; if (host.endsWith("youtube.com")) videoId = url.searchParams.get("v") || null; return { videoId, playlistId: url.searchParams.get("list") || null }; }
export function courseMatchesUrl(course, rawUrl) { if (!course?.url || !rawUrl) return false; const courseUrl = safeUrl(course.url); const targetUrl = safeUrl(rawUrl); if (!courseUrl || !targetUrl) return false; const cYt = extractYouTube(course.url); const tYt = extractYouTube(rawUrl); if (cYt.playlistId && tYt.playlistId === cYt.playlistId) return true; if (cYt.videoId && tYt.videoId === cYt.videoId) return true; const cHost = courseUrl.hostname.replace(/^www\./, "").toLowerCase(); const tHost = targetUrl.hostname.replace(/^www\./, "").toLowerCase(); const cPath = courseUrl.pathname.replace(/\/$/, ""); const tPath = targetUrl.pathname.replace(/\/$/, ""); if (cHost !== tHost && !tHost.endsWith("." + cHost)) return false; return !cPath || cPath === "/" || tPath.startsWith(cPath); }
export function normalizeStudyProfile(profileId) { return STUDY_PROFILES.some((profile) => profile.id === profileId) ? profileId : DEFAULT_STUDY_PROFILE; }
export function subjectsForProfile(profileId = DEFAULT_STUDY_PROFILE) { return STUDY_PROFILES.find((profile) => profile.id === normalizeStudyProfile(profileId))?.subjects || SUBJECTS; }
export function normalizeSubject(subject, profileId = null) {
  const text = String(subject || "").trim();
  const profileSubjects = profileId ? subjectsForProfile(profileId) : [];
  const allSubjects = [...new Set(STUDY_PROFILES.flatMap((profile) => profile.subjects))];
  if (profileSubjects.includes(text)) return text;
  if (allSubjects.includes(text)) return text;
  return profileSubjects.includes("Other") || !profileSubjects.length ? "Other" : profileSubjects[0];
}
export function emptySubjectTracking(profileId = null) { const subjects = profileId ? subjectsForProfile(profileId) : [...new Set(STUDY_PROFILES.flatMap((profile) => profile.subjects))]; return Object.fromEntries(subjects.map((s) => [s, { subject: s, studyMinutes: 0, sessions: 0, completion: 0 }])); }
export function defaultAnalytics() { return { daily: {}, focusHistory: [], streak: { current: 0, longest: 0, lastStudyDate: null } }; }
export function defaultAssistant() { return { mode: "steady", suggestion: ASSISTANT_MESSAGES.steady, nextTask: "Start your default course.", lastUpdatedAt: null }; }
export function defaultState() { return { version: 8, profile: { onboarded: false, onboardingVersion: 0, name: "", profileType: "local", email: "", studyProfile: DEFAULT_STUDY_PROFILE, startedAt: null, lastProfileAt: null }, settings: { ...DEFAULT_SETTINGS, blockedSites: [...DEFAULT_BLOCKED_SITES], allowedSites: [...DEFAULT_ALLOWED_SITES] }, courseLibraries: DEFAULT_COURSE_LIBRARIES.map((library) => ({ ...library })), courses: [], focusSession: null, focusCompletion: null, goals: { ...DEFAULT_STUDY_GOALS }, hydration: { date: todayKey(), glasses: 0, lastReminderAt: null, nextReminderAt: null, history: {} }, daily: { date: todayKey(), tasks: DEFAULT_DAILY_TASKS.map((t) => ({ ...t, done: false })) }, stats: { date: todayKey(), focusMinutes: 0, distractions: 0, sessionsCompleted: 0, water: 0 }, analytics: defaultAnalytics(), assistant: defaultAssistant(), protection: { tabSwitches: [], blockedAttempts: [], browsingEvents: [], lastAssistantNoticeAt: null }, backups: { lastExportedAt: null, lastRestoredAt: null, lastFormat: null } }; }
function normalizeSubjects(src = {}) { const base = emptySubjectTracking(); for (const s of Object.keys(base)) base[s] = { ...base[s], ...(src[s] || {}), subject: s, studyMinutes: num(src[s]?.studyMinutes), sessions: num(src[s]?.sessions), completion: Math.max(0, Math.min(100, num(src[s]?.completion))) }; return base; }
function normalizeCourseLibraries(items = null) { const source = Array.isArray(items) && items.length ? items : DEFAULT_COURSE_LIBRARIES; const seen = new Set(); const libraries = source.map((library) => ({ id: String(library.id || uid("library")), name: String(library.name || "My Library").trim().slice(0, 48) || "My Library", collapsed: Boolean(library.collapsed), createdAt: num(library.createdAt, Date.now()) })).filter((library) => { if (seen.has(library.id)) return false; if (LEGACY_PROFILE_LIBRARY_IDS.has(library.id)) return false; seen.add(library.id); return true; }); return (libraries.length ? libraries : DEFAULT_COURSE_LIBRARIES.map((library) => ({ ...library, createdAt: Date.now() }))).slice(0, 60); }
function normalizeCourses(items = [], libraries = DEFAULT_COURSE_LIBRARIES, profileId = DEFAULT_STUDY_PROFILE) { const normalizedLibraries = normalizeCourseLibraries(libraries); const libraryIds = new Set(normalizedLibraries.map((library) => library.id)); const fallbackLibraryId = normalizedLibraries[0]?.id || "library-main"; return (Array.isArray(items) ? items : []).map((c) => { const subject = normalizeSubject(c.subject, profileId); const legacyGroupId = c.groupId && !LEGACY_PROFILE_LIBRARY_IDS.has(c.groupId) ? c.groupId : null; const libraryId = libraryIds.has(c.libraryId) ? c.libraryId : (libraryIds.has(legacyGroupId) ? legacyGroupId : fallbackLibraryId); return { id: c.id || uid("course"), title: String(c.title || "Study course").trim(), subject, libraryId, url: normalizeUrl(c.url || ""), createdAt: num(c.createdAt, Date.now()), lastUsedAt: c.lastUsedAt ? num(c.lastUsedAt) : null }; }).filter((c) => isHttpUrl(c.url)); }
function normalizeTasks(items = DEFAULT_DAILY_TASKS) { return (Array.isArray(items) ? items : DEFAULT_DAILY_TASKS).filter((t) => !LEGACY_DEFAULT_TASK_TITLES.has(String(t?.title || "").trim().toLowerCase())).map((t) => ({ id: t.id || uid("task"), title: String(t.title || "Study task").trim(), area: String(t.area || "Personal"), minutes: Math.max(0, num(t.minutes)), note: String(t.note || ""), priority: "personal", done: Boolean(t.done) })); }
function normalizeEvents(events = []) { return (Array.isArray(events) ? events : []).map((e) => ({ at: num(e.at, Date.now()), type: String(e.type || "event"), host: String(e.host || ""), reason: String(e.reason || "") })).filter((e) => Date.now() - e.at < 24 * 60 * 60000).slice(-120); }
export function mergeState(input = {}) {
  const base = defaultState();
  const src = input && typeof input === "object" ? input : {};
  const settings = { ...base.settings, ...(src.settings || {}) };
  settings.blockedSites = cleanPatterns([...(settings.blockedSites || []), ...DEFAULT_BLOCKED_SITES]);
  settings.allowedSites = cleanPatterns([...(settings.allowedSites || []), ...DEFAULT_ALLOWED_SITES]);
  settings.redirectEnabled = src.settings?.redirectEnabled !== undefined ? Boolean(src.settings.redirectEnabled) : (src.settings?.guardAllTabsDuringFocus !== undefined ? Boolean(src.settings.guardAllTabsDuringFocus) : Boolean(settings.redirectEnabled));
  settings.redirectDuringFocus = src.settings?.redirectDuringFocus !== undefined ? Boolean(src.settings.redirectDuringFocus) : true;
  settings.guardBlockedOutsideFocus = src.settings?.guardBlockedOutsideFocus !== undefined ? Boolean(src.settings.guardBlockedOutsideFocus) : (src.settings?.alwaysGuardBlockedSites !== undefined ? Boolean(src.settings.alwaysGuardBlockedSites) : true);
  settings.soundEnabled = src.settings?.soundEnabled !== undefined ? Boolean(src.settings.soundEnabled) : Boolean(settings.soundEnabled);
  settings.soundVolume = Math.max(0, Math.min(100, num(settings.soundVolume, 35)));
  delete settings.autoOpenCourseOnFocus;

  const profile = { ...base.profile, ...(src.profile || {}) };
  const oldProfileKindKey = "log" + "inType";
  const oldProfileDateKey = "last" + "Log" + "inAt";
  profile.profileType = profile.profileType || profile[oldProfileKindKey] || "local";
  profile.lastProfileAt = profile.lastProfileAt || profile[oldProfileDateKey] || null;
  profile.studyProfile = normalizeStudyProfile(profile.studyProfile || src.settings?.studyProfile);
  delete profile[oldProfileKindKey];
  delete profile[oldProfileDateKey];

  const courseLibraries = normalizeCourseLibraries(src.courseLibraries || src.courseGroups);
  const daily = { ...base.daily, ...(src.daily || {}), tasks: normalizeTasks(src.daily?.tasks) };
  delete daily.rescueCount;

  const state = {
    ...base,
    ...src,
    version: 8,
    profile,
    settings,
    courseLibraries,
    courses: normalizeCourses(src.courses, courseLibraries, profile.studyProfile),
    goals: { ...base.goals, ...(src.goals || {}) },
    daily,
    stats: { ...base.stats, ...(src.stats || {}) },
    hydration: { ...base.hydration, ...(src.hydration || {}), history: { ...(src.hydration?.history || {}) } },
    analytics: {
      ...base.analytics,
      ...(src.analytics || {}),
      daily: { ...(src.analytics?.daily || {}) },
      focusHistory: Array.isArray(src.analytics?.focusHistory) ? src.analytics.focusHistory.slice(0, 300) : []
    },
    assistant: { ...base.assistant, ...(src.assistant || {}) },
    protection: {
      tabSwitches: normalizeEvents(src.protection?.tabSwitches),
      blockedAttempts: normalizeEvents(src.protection?.blockedAttempts),
      browsingEvents: normalizeEvents(src.protection?.browsingEvents),
      lastAssistantNoticeAt: num(src.protection?.lastAssistantNoticeAt) || null
    },
    backups: { ...base.backups, ...(src.backups || {}) }
  };

  delete state.jeeMode;
  delete state.recommendations;
  delete state.subjects;
  delete state.courseGroups;
  state.settings.defaultCourseId = state.courses.some((c) => c.id === state.settings.defaultCourseId) ? state.settings.defaultCourseId : state.courses[0]?.id || null;
  state.goals.studyHours = Math.max(0, num(state.goals.studyHours, 4));
  state.goals.chapters = Math.max(0, num(state.goals.chapters, 2));
  state.goals.questions = Math.max(0, num(state.goals.questions, 60));
  state.goals.water = Math.max(1, num(state.goals.water, state.settings.waterGoal));
  return state;
}
export function ensureToday(input = {}) { const state = mergeState(input); const today = todayKey(); if (state.hydration.date !== today) { state.hydration.history[state.hydration.date] = state.hydration.glasses || 0; state.hydration.date = today; state.hydration.glasses = 0; state.hydration.lastReminderAt = null; state.hydration.nextReminderAt = null; } if (state.daily.date !== today) { state.daily.date = today; state.daily.tasks = state.daily.tasks.map((task) => ({ ...task, done: false })); } if (state.stats.date !== today) { state.stats = { date: today, focusMinutes: 0, distractions: 0, sessionsCompleted: 0, water: 0 }; } return state; }
export function getActiveCourse(state) { const s = mergeState(state); return s.courses.find((c) => c.id === s.settings.defaultCourseId) || s.courses[0] || null; }
export function sessionRemainingMs(session, now = Date.now()) { if (!session?.active) return 0; if (session.paused) return Math.max(0, num(session.remainingMs)); return Math.max(0, num(session.endsAt) - now); }
export function minutesRemaining(session) { return Math.max(0, Math.ceil(sessionRemainingMs(session) / 60000)); }
export function formatClock(ms = 0) { const total = Math.max(0, Math.ceil(num(ms) / 1000)); const minutes = Math.floor(total / 60); const seconds = total % 60; return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0"); }
export function formatDuration(minutes = 0) { const total = Math.max(0, Math.round(num(minutes))); const h = Math.floor(total / 60); const m = total % 60; if (!h) return m + "m"; if (!m) return h + "h"; return h + "h " + m + "m"; }
export function focusElapsedMinutes(session, now = Date.now()) { const durationMs = Math.max(0, num(session?.durationMinutes) * 60000); if (!durationMs) return 0; return Math.max(0, Math.round((durationMs - sessionRemainingMs(session, now)) / 60000)); }
export function sessionXp(minutes = 0, completed = true) { const base = Math.max(0, Math.round(num(minutes))); return completed ? Math.max(25, base) : Math.max(0, Math.round(base / 2)); }
export function addSubjectStudy(subjects, subject, minutes, sessionDone = true, completion = null) { const next = normalizeSubjects(subjects); const key = normalizeSubject(subject); const current = next[key]; const newCompletion = completion === null ? current.completion : Math.max(0, Math.min(100, num(completion))); next[key] = { ...current, studyMinutes: current.studyMinutes + Math.max(0, num(minutes)), sessions: current.sessions + (sessionDone ? 1 : 0), completion: Math.max(current.completion, newCompletion) }; return next; }
function streakAfterStudy(streak = {}, date = todayKey()) { const yesterday = new Date(date); yesterday.setDate(yesterday.getDate() - 1); const yKey = todayKey(yesterday); if (streak.lastStudyDate === date) return streak; const current = streak.lastStudyDate === yKey ? num(streak.current) + 1 : 1; return { current, longest: Math.max(num(streak.longest), current), lastStudyDate: date }; }
export function recordFocusAnalytics(analytics, session, elapsedMinutes, completed = false) { const date = todayKey(); const base = { ...defaultAnalytics(), ...(analytics || {}) }; const daily = { ...(base.daily || {}) }; const item = daily[date] || { studyMinutes: 0, sessions: 0, completedSessions: 0, distractionsBlocked: 0, subjects: emptySubjectTracking() }; const subject = normalizeSubject(session?.subject); item.studyMinutes += Math.max(0, num(elapsedMinutes)); item.sessions += 1; item.completedSessions += completed ? 1 : 0; item.distractionsBlocked += num(session?.distractionsBlocked); item.subjects = addSubjectStudy(item.subjects, subject, elapsedMinutes, true); daily[date] = item; const focusHistory = [{ id: session?.id || uid("session"), courseId: session?.courseId || null, courseTitle: session?.courseTitle || "Focus session", subject, startedAt: session?.startedAt || Date.now(), endedAt: Date.now(), durationMinutes: Math.max(0, num(elapsedMinutes)), completed, xpEarned: sessionXp(elapsedMinutes, completed), distractionsBlocked: num(session?.distractionsBlocked) }, ...(base.focusHistory || [])].slice(0, 300); return { daily, focusHistory, streak: elapsedMinutes > 0 ? streakAfterStudy(base.streak, date) : base.streak || defaultAnalytics().streak }; }
export function recordDistractionAnalytics(analytics) { const date = todayKey(); const base = { ...defaultAnalytics(), ...(analytics || {}) }; const daily = { ...(base.daily || {}) }; const item = daily[date] || { studyMinutes: 0, sessions: 0, completedSessions: 0, distractionsBlocked: 0, subjects: emptySubjectTracking() }; item.distractionsBlocked += 1; daily[date] = item; return { ...base, daily }; }
export function dateSeries(days = 14, end = new Date()) { return Array.from({ length: days }, (_, index) => { const d = new Date(end); d.setDate(d.getDate() - (days - index - 1)); return todayKey(d); }); }
export function productivityScore(state) { const s = mergeState(state); const today = todayKey(); const daily = s.analytics.daily?.[today] || {}; const studyMinutes = Math.max(num(daily.studyMinutes), num(s.stats.focusMinutes)); const completedSessions = Math.max(num(daily.completedSessions), num(s.stats.sessionsCompleted)); const study = Math.min(55, (studyMinutes / Math.max(1, s.goals.studyHours * 60)) * 55); const sessions = Math.min(20, (completedSessions / 2) * 20); const water = Math.min(15, (s.hydration.glasses / Math.max(1, s.settings.waterGoal)) * 15); const penalty = Math.min(25, s.stats.distractions * 3); return Math.max(0, Math.min(100, Math.round(study + sessions + water + 10 - penalty))); }
export function goalProgressPercent(state) { const s = mergeState(state); const today = todayKey(); const daily = s.analytics.daily?.[today] || {}; const studyMinutes = Math.max(num(daily.studyMinutes), num(s.stats.focusMinutes)); const completedSessions = Math.max(num(daily.completedSessions), num(s.stats.sessionsCompleted)); const study = s.goals.studyHours ? Math.min(1, studyMinutes / (s.goals.studyHours * 60)) : 0; const water = s.goals.water ? Math.min(1, s.hydration.glasses / s.goals.water) : 0; const sessions = Math.min(1, completedSessions / 2); const streak = (s.analytics.streak?.current || 0) > 0 ? 1 : 0; return Math.round(((study + water + sessions + streak) / 4) * 100); }
export function recordProtectionEvent(protection, bucket, event = {}) { const p = { tabSwitches: normalizeEvents(protection?.tabSwitches), blockedAttempts: normalizeEvents(protection?.blockedAttempts), browsingEvents: normalizeEvents(protection?.browsingEvents), lastAssistantNoticeAt: protection?.lastAssistantNoticeAt || null }; const key = ["tabSwitches", "blockedAttempts", "browsingEvents"].includes(bucket) ? bucket : "browsingEvents"; p[key] = [...p[key], { at: num(event.at, Date.now()), type: String(event.type || bucket), host: String(event.host || ""), reason: String(event.reason || "") }].slice(-120); return p; }
export function countRecent(events, windowMs = 5 * 60 * 1000, now = Date.now()) { return (Array.isArray(events) ? events : []).filter((event) => now - num(event.at) <= windowMs).length; }
export function nextStudyTask(state) { const s = mergeState(state); const task = s.daily.tasks.find((t) => !t.done); const course = getActiveCourse(s); if (task) return task.title; if (course) return "Continue " + course.title; return "Add one course link and start a 25-minute focus block."; }
export function buildAssistantState(state, reason = "steady") { const s = mergeState(state); const blocked = countRecent(s.protection.blockedAttempts, 10 * 60 * 1000); const switches = countRecent(s.protection.tabSwitches, 5 * 60 * 1000); let mode = ASSISTANT_MESSAGES[reason] ? reason : "steady"; if (blocked >= 3) mode = "blockedAttempts"; else if (switches >= 5) mode = "tabSwitching"; else if ((s.stats.distractions || 0) >= 4) mode = "repeatedDistractions"; const course = getActiveCourse(s); return { mode, suggestion: ASSISTANT_MESSAGES[mode] || ASSISTANT_MESSAGES.steady, nextTask: course ? "Open " + course.title : nextStudyTask(s), lastUpdatedAt: Date.now() }; }
