import {
  ALARMS,
  STATE_KEY,
  buildAssistantState,
  cleanPatterns,
  compactHost,
  courseMatchesUrl,
  defaultState,
  ensureToday,
  focusElapsedMinutes,
  getActiveCourse,
  isAllowedSupportUrl,
  isBlockedUrl,
  isHttpUrl,
  isInternalUrl,
  mergeState,
  normalizeSubject,
  recordDistractionAnalytics,
  recordFocusAnalytics,
  recordProtectionEvent,
  sessionRemainingMs,
  sessionXp,
  uid
} from "./shared.js";

const ICON_URL = chrome.runtime.getURL("icons/icon128.png");
const redirectCooldown = new Map();

async function getState() {
  const data = await chrome.storage.local.get(STATE_KEY);
  const state = ensureToday(mergeState(data[STATE_KEY] || defaultState()));
  await chrome.storage.local.set({ [STATE_KEY]: state });
  return state;
}

async function setState(updater) {
  const current = await getState();
  const next = ensureToday(mergeState(typeof updater === "function" ? updater(current) : updater));
  await chrome.storage.local.set({ [STATE_KEY]: next });
  await updateBadge(next);
  return next;
}

async function updateBadge(state = null) {
  const current = state || await getState();
  if (current.focusSession?.active && sessionRemainingMs(current.focusSession) > 0) {
    await chrome.action.setBadgeText({ text: current.focusSession.paused ? "II" : "ON" });
    await chrome.action.setBadgeBackgroundColor({ color: current.focusSession.paused ? "#e59b23" : "#2478ff" });
    return;
  }
  if ((current.hydration.glasses || 0) >= current.settings.waterGoal) {
    await chrome.action.setBadgeText({ text: "H2O" });
    await chrome.action.setBadgeBackgroundColor({ color: "#15cf78" });
    return;
  }
  await chrome.action.setBadgeText({ text: "" });
}

async function notify(idPrefix, title, message, buttons = []) {
  if (idPrefix.startsWith("water")) await clearNotifications("water");
  const id = idPrefix + ":" + Date.now();
  await chrome.notifications.create(id, {
    type: "basic",
    iconUrl: ICON_URL,
    title,
    message,
    priority: 2,
    requireInteraction: idPrefix.startsWith("focus") || idPrefix.startsWith("water"),
    buttons: buttons.slice(0, 2).map((title) => ({ title }))
  });
  return id;
}
async function clearNotifications(prefix) {
  const all = await chrome.notifications.getAll();
  await Promise.all(Object.keys(all).filter((id) => id.startsWith(prefix)).map((id) => chrome.notifications.clear(id)));
}

async function rescheduleWaterAlarm(settings = null) {
  const fullState = await getState();
  const current = settings || fullState.settings;
  await chrome.alarms.clear(ALARMS.WATER);
  if (!current.waterEnabled) {
    await setState((state) => ({ ...state, hydration: { ...state.hydration, nextReminderAt: null } }));
    return;
  }
  const interval = Math.max(1, Number(current.waterIntervalMinutes) || 60);
  const goalReached = (fullState.hydration.glasses || 0) >= (current.waterGoal || 8);
  const nextAt = goalReached ? nextWaterResetAt(interval) : Date.now() + interval * 60000;
  await chrome.alarms.create(ALARMS.WATER, goalReached ? { when: nextAt } : { delayInMinutes: interval, periodInMinutes: interval });
  await setState((state) => ({ ...state, hydration: { ...state.hydration, nextReminderAt: goalReached ? null : nextAt } }));
}

async function triggerWaterReminder(force = false) {
  const current = await getState();
  const goal = current.settings.waterGoal || 8;
  if (!current.settings.waterEnabled || (current.hydration.glasses || 0) >= goal) {
    await clearNotifications("water");
    await rescheduleWaterAlarm(current.settings);
    return current;
  }
  const now = Date.now();
  if (!force && current.hydration.lastReminderAt && now - current.hydration.lastReminderAt < 60000) return current;
  const interval = Math.max(1, Number(current.settings.waterIntervalMinutes) || 60);
  await chrome.alarms.clear(ALARMS.WATER);
  await chrome.alarms.create(ALARMS.WATER, { delayInMinutes: interval, periodInMinutes: interval });
  const next = await setState((state) => ({ ...state, hydration: { ...state.hydration, lastReminderAt: now, nextReminderAt: now + interval * 60000 } }));
  await notify("water", "Hydration reminder", "Drink one glass of water, then log it in Course Focus Pro.", ["Log water", "Dashboard"]);
  return next;
}

async function scheduleFocusEnd(session) {
  await chrome.alarms.clear(ALARMS.FOCUS_END);
  if (session?.active && !session.paused && sessionRemainingMs(session) > 0) await chrome.alarms.create(ALARMS.FOCUS_END, { when: session.endsAt });
}

function nextWaterResetAt() {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(0, 5, 0, 0);
  return next.getTime();
}

async function startFocus(payload = {}) {
  const current = await getState();
  const course = current.courses.find((item) => item.id === payload.courseId) || getActiveCourse(current);
  if (!course) throw new Error("Add a course link before starting focus.");
  const duration = Math.max(5, Math.min(240, Number(payload.durationMinutes) || current.settings.focusMinutesDefault));
  const subject = normalizeSubject(course.subject || "Other");
  const session = {
    id: uid("session"),
    active: true,
    courseId: course.id,
    courseTitle: course.title,
    courseUrl: course.url,
    subject,
    startedAt: Date.now(),
    endsAt: Date.now() + duration * 60000,
    durationMinutes: duration,
    paused: false,
    pausedAt: null,
    remainingMs: duration * 60000,
    accumulatedPausedMs: 0,
    distractionsBlocked: 0,
    lastReminderAt: 0
  };
  const next = await setState((state) => ({
    ...state,
    settings: { ...state.settings, defaultCourseId: course.id, focusMinutesDefault: duration },
    courses: state.courses.map((item) => item.id === course.id ? { ...item, subject, lastUsedAt: Date.now() } : item),
    focusSession: session,
    focusCompletion: null,
    assistant: buildAssistantState({ ...state, focusSession: session }, "steady")
  }));
  await scheduleFocusEnd(session);
  await openCourse(course.url);
  await notify("focus-start", "Focus started", "Studying " + course.title + ". Distracting tabs will redirect while the switch is on.", ["Open course", "Dashboard"]);
  return next;
}

async function stopFocus(reason = "manual") {
  const current = await getState();
  const session = current.focusSession;
  if (!session?.active) return current;
  const remaining = sessionRemainingMs(session);
  const completed = reason === "complete" || (!session.paused && remaining <= 0);
  const elapsed = completed ? Math.max(1, Number(session.durationMinutes) || focusElapsedMinutes(session)) : focusElapsedMinutes(session);
  const next = await setState((state) => ({
    ...state,
    focusSession: null,
    focusCompletion: completed ? {
      id: session.id,
      courseTitle: session.courseTitle,
      subject: session.subject || "Other",
      durationMinutes: elapsed,
      xpEarned: sessionXp(elapsed, true),
      todayTotalMinutes: (state.stats.focusMinutes || 0) + elapsed,
      streak: recordFocusAnalytics(state.analytics, session, elapsed, true).streak?.current || 1,
      completedAt: Date.now()
    } : state.focusCompletion,
    analytics: recordFocusAnalytics(state.analytics, session, elapsed, completed),
    stats: {
      ...state.stats,
      focusMinutes: state.stats.focusMinutes + elapsed,
      sessionsCompleted: state.stats.sessionsCompleted + (completed ? 1 : 0)
    },
    assistant: buildAssistantState({ ...state, focusSession: null }, "steady")
  }));
  await chrome.alarms.clear(ALARMS.FOCUS_END);
  if (completed) await notify("focus-complete", "Focus complete", "Session finished. Log water or start the next block.", ["Dashboard"]);
  return next;
}

async function pauseFocus() {
  const current = await getState();
  const session = current.focusSession;
  if (!session?.active || session.paused) return current;
  const remainingMs = sessionRemainingMs(session);
  await chrome.alarms.clear(ALARMS.FOCUS_END);
  return setState((state) => ({
    ...state,
    focusSession: { ...state.focusSession, paused: true, pausedAt: Date.now(), remainingMs, endsAt: Date.now() + remainingMs }
  }));
}

async function resumeFocus() {
  const current = await getState();
  const session = current.focusSession;
  if (!session?.active || !session.paused) return current;
  const remainingMs = Math.max(0, Number(session.remainingMs) || 0);
  const resumed = {
    ...session,
    paused: false,
    pausedAt: null,
    remainingMs,
    accumulatedPausedMs: (session.accumulatedPausedMs || 0) + Math.max(0, Date.now() - (session.pausedAt || Date.now())),
    endsAt: Date.now() + remainingMs
  };
  const next = await setState((state) => ({ ...state, focusSession: resumed }));
  await scheduleFocusEnd(resumed);
  return next;
}

async function openCourse(url) {
  if (isHttpUrl(url)) await chrome.tabs.create({ url, active: true });
}

async function openDashboard(params = {}) {
  const query = new URLSearchParams(params).toString();
  await chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html" + (query ? "?" + query : "")) });
}

function isFocusCourseOrSupport(state, url) {
  const session = state.focusSession;
  const course = state.courses.find((item) => item.id === session?.courseId) || getActiveCourse(state);
  return courseMatchesUrl(course, url) || isAllowedSupportUrl(url, state.settings);
}

function shouldRedirect(state, url) {
  if (!url || isInternalUrl(url) || !isHttpUrl(url)) return false;
  if (url.includes(chrome.runtime.getURL("redirect.html")) || url.includes(chrome.runtime.getURL("dashboard.html"))) return false;
  if (isAllowedSupportUrl(url, state.settings)) return false;
  if (state.focusSession?.active && state.focusSession.paused) return false;
  const session = state.focusSession?.active && !state.focusSession.paused && sessionRemainingMs(state.focusSession) > 0 ? state.focusSession : null;
  if (session) return Boolean(state.settings.redirectEnabled && state.settings.redirectDuringFocus && !isFocusCourseOrSupport(state, url));
  if (state.settings.guardBlockedOutsideFocus) return isBlockedUrl(url, state.settings);
  return false;
}

async function recordDistraction(url, reason) {
  const now = Date.now();
  return setState((state) => {
    const session = state.focusSession?.active && !state.focusSession.paused ? { ...state.focusSession, distractionsBlocked: (state.focusSession.distractionsBlocked || 0) + 1, lastReminderAt: now } : state.focusSession;
    const protection = recordProtectionEvent(state.protection, "blockedAttempts", { at: now, type: "blocked", host: compactHost(url), reason });
    return {
      ...state,
      focusSession: session,
      stats: { ...state.stats, distractions: state.stats.distractions + 1 },
      analytics: recordDistractionAnalytics(state.analytics),
      protection,
      assistant: buildAssistantState({ ...state, protection, stats: { ...state.stats, distractions: state.stats.distractions + 1 } }, "repeatedDistractions")
    };
  });
}

async function redirectTab(tab, reason) {
  if (!tab?.id || !tab.url) return;
  const last = redirectCooldown.get(tab.id) || 0;
  if (Date.now() - last < 900) return;
  redirectCooldown.set(tab.id, Date.now());
  const state = await getState();
  const session = state.focusSession;
  const course = session ? state.courses.find((item) => item.id === session.courseId) : getActiveCourse(state);
  if (!course?.url) {
    await openDashboard({ section: "focus" });
    return;
  }
  await recordDistraction(tab.url, reason);
  const params = new URLSearchParams({ courseUrl: course.url, courseTitle: course.title, source: compactHost(tab.url), reason });
  await chrome.tabs.update(tab.id, { url: chrome.runtime.getURL("redirect.html?" + params.toString()) });
}

async function checkTab(tab, reason = "tab-change") {
  if (!tab?.url) return;
  let state = await getState();
  if (state.focusSession?.active && !state.focusSession.paused && sessionRemainingMs(state.focusSession) <= 0) {
    await stopFocus("complete");
    state = await getState();
  }
  if (shouldRedirect(state, tab.url)) await redirectTab(tab, reason);
}

async function markWater() {
  await clearNotifications("water");
  const next = await setState((state) => {
    const glasses = Math.min(40, (state.hydration.glasses || 0) + 1);
    const reachedGoal = glasses >= (state.settings.waterGoal || 8);
    return {
      ...state,
      hydration: { ...state.hydration, glasses, lastReminderAt: null, nextReminderAt: reachedGoal ? null : state.hydration.nextReminderAt },
      stats: { ...state.stats, water: (state.stats.water || 0) + 1 },
      assistant: buildAssistantState(state, "hydration")
    };
  });
  if ((next.hydration.glasses || 0) >= (next.settings.waterGoal || 8)) await rescheduleWaterAlarm(next.settings);
  return next;
}

chrome.runtime.onInstalled.addListener(async () => {
  const state = await getState();
  await rescheduleWaterAlarm(state.settings);
  await updateBadge(state);
  await openDashboard({ welcome: "1" });
});
async function restoreSchedules(markWelcome = false) {
  let state = await getState();
  if (state.focusSession?.active && !state.focusSession.paused && sessionRemainingMs(state.focusSession) <= 0) state = await stopFocus("complete");
  if (markWelcome && state.focusSession?.active && sessionRemainingMs(state.focusSession) > 0) {
    state = await setState((current) => ({
      ...current,
      focusSession: { ...current.focusSession, welcomeBack: true, restoredAt: Date.now() }
    }));
  }
  await rescheduleWaterAlarm(state.settings);
  await scheduleFocusEnd(state.focusSession);
  await updateBadge(state);
}
chrome.runtime.onStartup.addListener(() => restoreSchedules(true));
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARMS.FOCUS_END) await stopFocus("complete");
  if (alarm.name === ALARMS.WATER) {
    const current = await getState();
    if (current.settings.waterEnabled && (current.hydration.glasses || 0) < (current.settings.waterGoal || 8)) await triggerWaterReminder(true);
    else await rescheduleWaterAlarm(current.settings);
  }
});
chrome.notifications.onButtonClicked.addListener(async (id, index) => {
  if (id.startsWith("water") && index === 0) await markWater();
  else if (index === 0 && id.startsWith("focus")) {
    const course = getActiveCourse(await getState());
    if (course?.url) await openCourse(course.url);
  } else await openDashboard();
  await chrome.notifications.clear(id);
});
chrome.notifications.onClicked.addListener(async (id) => { await openDashboard(); await chrome.notifications.clear(id); });
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => { if (changeInfo.status === "complete" || changeInfo.url) checkTab(tab, "tab-updated"); });
chrome.tabs.onActivated.addListener(async ({ tabId }) => { try { await checkTab(await chrome.tabs.get(tabId), "tab-activated"); } catch {} });
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const type = message?.type;
    if (type === "getState") return getState();
    if (type === "saveState") return setState(message.state);
    if (type === "startFocus") return startFocus(message.payload || {});
    if (type === "pauseFocus") return pauseFocus();
    if (type === "resumeFocus") return resumeFocus();
    if (type === "stopFocus") return stopFocus("manual");
    if (type === "openCourse") { await openCourse(message.url); return getState(); }
    if (type === "openDashboard") { await openDashboard(message.params || {}); return getState(); }
    if (type === "markWater") return markWater();
    if (type === "clearWaterNotifications") { await clearNotifications("water"); return getState(); }
    if (type === "triggerWaterReminder") return triggerWaterReminder(Boolean(message.force));
    if (type === "rescheduleWater") { const state = await getState(); await rescheduleWaterAlarm(state.settings); return state; }
    return getState();
  })().then((response) => sendResponse({ ok: true, response })).catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
restoreSchedules(false);
