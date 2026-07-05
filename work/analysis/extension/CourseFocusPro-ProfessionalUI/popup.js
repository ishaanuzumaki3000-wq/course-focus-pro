import { STATE_KEY, formatClock, formatDuration, getActiveCourse, mergeState, productivityScore, sessionRemainingMs, todayKey } from "./shared.js";
const $ = (selector) => document.querySelector(selector);
const MUSIC_COMMAND_KEY = "courseFocusProMusicCommand";
const hasChrome = Boolean(globalThis.chrome?.storage?.local);
const systemThemeQuery = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
let state = null;
let focusActionPending = false;
function sendMessage(message) { return hasChrome ? chrome.runtime.sendMessage(message) : Promise.resolve({ ok: false, message }); }
function resolvedTheme(mode = "system") { const allowed = ["light", "dark", "midnight", "amoled", "forest", "purple", "beige", "slate", "teal", "rose"]; if (allowed.includes(mode)) return mode; return systemThemeQuery?.matches ? "dark" : "light"; }
function applyTheme() { const mode = state?.settings?.themeMode || "system"; document.documentElement.dataset.theme = resolvedTheme(mode); document.documentElement.dataset.themeMode = mode; }
async function loadState() {
  if (hasChrome) {
    const data = await chrome.storage.local.get(STATE_KEY);
    state = mergeState(data[STATE_KEY]);
  } else {
    try { state = mergeState(JSON.parse(localStorage.getItem(STATE_KEY) || "null")); } catch { state = mergeState(); }
  }
  applyTheme();
  render();
}
function setAction(selector, visible, disabled = false) {
  const element = $(selector);
  if (!element) return;
  element.classList.toggle("hidden", !visible);
  element.disabled = disabled;
}
async function sendMusicCommand(action) {
  if (!hasChrome) return;
  await chrome.storage.local.set({ [MUSIC_COMMAND_KEY]: { action, at: Date.now() } });
  const base = chrome.runtime.getURL("dashboard.html");
  const tabs = await chrome.tabs.query({});
  const hasDashboard = tabs.some((tab) => String(tab.url || "").startsWith(base));
  if (!hasDashboard && action === "play") chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html?section=music") });
}
function popupInsight() {
  const today = todayKey();
  const daily = state.analytics?.daily?.[today] || {};
  const minutes = Math.max(Number(daily.studyMinutes || 0), Number(state.stats?.focusMinutes || 0));
  const goalMinutes = Math.max(1, Number(state.goals?.studyHours || 4) * 60);
  if (minutes > 0 && minutes < goalMinutes) return { title: "Today's Insight", text: "You are " + formatDuration(goalMinutes - minutes) + " away from today's study goal." };
  if (minutes >= goalMinutes) return { title: "Goal Reached", text: "Today's study goal is complete. Keep the streak alive tomorrow." };
  if ((state.analytics?.focusHistory || []).length) return { title: "Next Session", text: "No completed focus session today yet. Start with your selected course." };
  return { title: "No Study Data Yet", text: "Complete one focus session to unlock useful insights." };
}
async function clearWelcomeBack() {
  if (!state.focusSession?.welcomeBack) return;
  const result = await sendMessage({ type: "saveState", state: { ...state, focusSession: { ...state.focusSession, welcomeBack: false } } });
  if (result?.ok) { state = mergeState(result.response); applyTheme(); render(); }
}
function render() {
  const course = getActiveCourse(state);
  const session = state.focusSession?.active && (state.focusSession.paused || sessionRemainingMs(state.focusSession) > 0) ? state.focusSession : null;
  const hasCourse = Boolean(course);
  const running = Boolean(session && !session.paused);
  const paused = Boolean(session?.paused);
  const showWelcome = Boolean(session?.welcomeBack);
  document.body.dataset.focusState = session ? (paused ? "paused" : "running") : "ready";
  $("#popupWelcomeBack").classList.toggle("hidden", !showWelcome);
  if (showWelcome) $("#popupWelcomeTime").textContent = formatClock(sessionRemainingMs(session)) + " remaining";
  $("#popupStatus").textContent = session ? (session.paused ? "Focus paused. Resume when ready." : "Focus running. Redirect protection is active.") : "Redirect switch: " + (state.settings.redirectEnabled ? "On" : "Off");
  $("#popupCourse").textContent = session?.courseTitle || course?.title || "No course yet";
  $("#popupTimer").textContent = session ? "\u23F1 " + formatClock(sessionRemainingMs(session)) + " Remaining" : hasCourse ? "Ready for " + formatDuration(state.settings.focusMinutesDefault || 50) + " focus" : "Add a course to start focus";
  $("#popupFocus").textContent = formatDuration(state.stats.focusMinutes || 0);
  $("#popupBlocked").textContent = String(state.stats.distractions || 0);
  const waterGoal = Math.max(1, state.settings.waterGoal || 8);
  const waterGlasses = state.hydration.glasses || 0;
  $("#popupWater").textContent = waterGlasses >= waterGoal ? "Done" : waterGlasses + "/" + waterGoal;
  $("#popupScore").textContent = String(productivityScore(state));
  const insight = popupInsight();
  $("#popupAssistant").textContent = insight.title;
  $("#popupAssistantTip").textContent = insight.text;
  $("#popupMusicStatus").textContent = "Play or pause dashboard music";
  $("#popupOpenBtn").textContent = hasCourse ? "Open Course" : "Add Course";
  $("#popupOpenBtn").disabled = false;
  $("#popupWaterBtn").textContent = waterGlasses >= waterGoal ? "Goal Done" : "Log Water";
  $("#popupWaterBtn").disabled = waterGlasses >= waterGoal;
  setAction("#popupStartBtn", !session, !hasCourse);
  setAction("#popupPauseBtn", !paused, !running || focusActionPending);
  setAction("#popupResumeBtn", paused, focusActionPending);
  setAction("#popupStopBtn", Boolean(session), focusActionPending);
  setAction("#popupDashboardBtn", true);
}
$("#popupDashboardBtn").addEventListener("click", () => sendMessage({ type: "openDashboard" }));
$("#popupRulesBtn").addEventListener("click", () => sendMessage({ type: "openDashboard", params: { section: "settings" } }));
$("#popupOpenBtn").addEventListener("click", () => { const course = getActiveCourse(state); if (course) sendMessage({ type: "openCourse", url: course.url }); else sendMessage({ type: "openDashboard", params: { section: "courses" } }); });
$("#popupWaterBtn").addEventListener("click", async () => { const result = await sendMessage({ type: "markWater" }); if (result?.ok) { state = mergeState(result.response); applyTheme(); render(); } });
$("#popupPauseBtn").addEventListener("click", async () => {
  const session = state.focusSession;
  if (!session?.active || session.paused || focusActionPending) return;
  const remainingMs = sessionRemainingMs(session);
  focusActionPending = true;
  state = mergeState({ ...state, focusSession: { ...session, paused: true, pausedAt: Date.now(), remainingMs, endsAt: Date.now() + remainingMs } });
  render();
  const result = await sendMessage({ type: "pauseFocus" });
  focusActionPending = false;
  if (result?.ok) state = mergeState(result.response);
  else await loadState();
  applyTheme();
  render();
});
$("#popupResumeBtn").addEventListener("click", async () => {
  const session = state.focusSession;
  if (!session?.active || !session.paused || focusActionPending) return;
  const remainingMs = Math.max(0, Number(session.remainingMs) || sessionRemainingMs(session));
  focusActionPending = true;
  state = mergeState({ ...state, focusSession: { ...session, paused: false, pausedAt: null, remainingMs, endsAt: Date.now() + remainingMs } });
  render();
  const result = await sendMessage({ type: "resumeFocus" });
  focusActionPending = false;
  if (result?.ok) state = mergeState(result.response);
  else await loadState();
  applyTheme();
  render();
});
$("#popupStopBtn").addEventListener("click", async () => {
  if (focusActionPending) return;
  focusActionPending = true;
  const result = await sendMessage({ type: "stopFocus" });
  focusActionPending = false;
  if (result?.ok) { state = mergeState(result.response); applyTheme(); render(); }
});
$("#popupStartBtn").addEventListener("click", async () => { const course = getActiveCourse(state); if (!course) return sendMessage({ type: "openDashboard", params: { section: "courses" } }); const result = await sendMessage({ type: "startFocus", payload: { courseId: course.id, durationMinutes: state.settings.focusMinutesDefault } }); if (result?.ok) { state = mergeState(result.response); applyTheme(); render(); } });
$("#popupWelcomeResumeBtn").addEventListener("click", async () => { if (state.focusSession?.paused) { const result = await sendMessage({ type: "resumeFocus" }); if (result?.ok) state = mergeState(result.response); } await clearWelcomeBack(); });
$("#popupWelcomeEndBtn").addEventListener("click", async () => { await clearWelcomeBack(); const result = await sendMessage({ type: "stopFocus" }); if (result?.ok) { state = mergeState(result.response); applyTheme(); render(); } });
$("#popupWelcomeDismissBtn").addEventListener("click", clearWelcomeBack);
$("#popupMusicPlayBtn").addEventListener("click", () => sendMusicCommand("play"));
$("#popupMusicPauseBtn").addEventListener("click", () => sendMusicCommand("pause"));
if (hasChrome) chrome.storage.onChanged.addListener((changes, area) => { if (area === "local" && changes[STATE_KEY]?.newValue) { state = mergeState(changes[STATE_KEY].newValue); applyTheme(); render(); } });
await loadState();
setInterval(render, 1000);
