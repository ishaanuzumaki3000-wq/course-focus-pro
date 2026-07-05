import fs from "node:fs";

const html = fs.readFileSync("work/analysis/youtube-watch.html", "utf8");

function extractJsonAfter(marker) {
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const braceStart = html.indexOf("{", start);
  if (braceStart === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let index = braceStart; index < html.length; index += 1) {
    const char = html[index];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return html.slice(braceStart, index + 1);
  }

  return null;
}

const playerRaw = extractJsonAfter("ytInitialPlayerResponse");
const initialRaw = extractJsonAfter("ytInitialData");
const player = playerRaw ? JSON.parse(playerRaw) : {};
const initial = initialRaw ? JSON.parse(initialRaw) : {};
const details = player.videoDetails || {};
const micro = player.microformat?.playerMicroformatRenderer || {};
const captions = player.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

const metadata = {
  title: details.title || micro.title?.simpleText || null,
  author: details.author || micro.ownerChannelName || null,
  lengthSeconds: details.lengthSeconds || micro.lengthSeconds || null,
  viewCount: details.viewCount || null,
  shortDescription: details.shortDescription || micro.description?.simpleText || null,
  publishDate: micro.publishDate || null,
  category: micro.category || null,
  captionTracks: captions.map((track) => ({
    languageCode: track.languageCode,
    name: track.name?.simpleText || track.name?.runs?.map((run) => run.text).join("") || "",
    baseUrl: track.baseUrl || null,
  })),
  hasInitialData: Boolean(initialRaw),
};

console.log(JSON.stringify(metadata, null, 2));
