import { STATE_KEY, mergeState } from "./shared.js";

const systemThemeQuery = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
function resolvedTheme(mode = "system") { const allowed = ["light", "dark", "midnight", "amoled", "forest", "purple", "beige", "slate", "teal", "rose"]; if (allowed.includes(mode)) return mode; return systemThemeQuery?.matches ? "dark" : "light"; }
async function applyRedirectTheme() { try { const data = await chrome.storage.local.get(STATE_KEY); const state = mergeState(data[STATE_KEY]); const mode = state.settings.themeMode || "system"; document.documentElement.dataset.theme = resolvedTheme(mode); document.documentElement.dataset.themeMode = mode; } catch { document.documentElement.dataset.theme = resolvedTheme("system"); } }
applyRedirectTheme();
systemThemeQuery?.addEventListener?.("change", applyRedirectTheme);

const params = new URLSearchParams(location.search);
const courseUrl = params.get("courseUrl") || "";
const courseTitle = params.get("courseTitle") || "your course";
const source = params.get("source") || "another tab";

const sourceName = document.querySelector("#sourceName");
const courseName = document.querySelector("#courseName");
const countdown = document.querySelector("#countdown");
const goNowBtn = document.querySelector("#goNowBtn");
const dashboardBtn = document.querySelector("#dashboardBtn");

let seconds = 3;
sourceName.textContent = source;
courseName.textContent = courseTitle;
countdown.textContent = String(seconds);

function goNow() {
  if (courseUrl) location.href = courseUrl;
}

goNowBtn.addEventListener("click", goNow);
dashboardBtn.addEventListener("click", () => {
  location.href = chrome.runtime.getURL("dashboard.html");
});

const timer = setInterval(() => {
  seconds -= 1;
  countdown.textContent = String(seconds);
  if (seconds <= 0) {
    clearInterval(timer);
    goNow();
  }
}, 1000);
