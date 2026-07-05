import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS,
  courseMatchesUrl,
  ensureToday,
  isBlockedUrl,
  mergeState,
  normalizeUrl,
  patternMatchesUrl,
  todayKey
} from "../shared.js";

assert.equal(normalizeUrl("youtube.com/watch?v=abc"), "https://youtube.com/watch?v=abc");
assert.equal(patternMatchesUrl("instagram.com", "https://www.instagram.com/reels/123"), true);
assert.equal(patternMatchesUrl("youtube.com/shorts", "https://www.youtube.com/shorts/abc"), true);
assert.equal(isBlockedUrl("https://www.instagram.com", DEFAULT_SETTINGS), true);
assert.equal(isBlockedUrl("https://classroom.google.com", DEFAULT_SETTINGS), false);

const playlistCourse = { title: "DSA", url: "https://www.youtube.com/playlist?list=PL123" };
assert.equal(courseMatchesUrl(playlistCourse, "https://www.youtube.com/watch?v=abc&list=PL123"), true);
assert.equal(courseMatchesUrl(playlistCourse, "https://www.youtube.com/watch?v=abc&list=OTHER"), false);

const videoCourse = { title: "Intro", url: "https://youtu.be/abc123" };
assert.equal(courseMatchesUrl(videoCourse, "https://www.youtube.com/watch?v=abc123"), true);
assert.equal(courseMatchesUrl(videoCourse, "https://www.youtube.com/watch?v=zzz"), false);

const state = ensureToday(mergeState({
  hydration: { date: "2000-01-01", glasses: 7 },
  stats: { date: "2000-01-01", water: 7 }
}));
assert.equal(state.hydration.date, todayKey());
assert.equal(state.hydration.glasses, 0);
assert.equal(state.stats.date, todayKey());

console.log("All Course Focus Pro checks passed.");
