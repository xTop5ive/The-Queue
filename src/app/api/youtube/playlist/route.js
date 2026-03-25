import { NextResponse } from "next/server";

function extractPlaylistId(urlOrId) {
  const s = (urlOrId || "").trim();
  if (!s) return "";

  // If they pasted the playlist id directly
  if (/^[a-zA-Z0-9_-]+$/.test(s) && s.length > 10) return s;

  try {
    const u = new URL(s);
    // most common: https://www.youtube.com/playlist?list=XXXX
    const list = u.searchParams.get("list");
    if (list) return list;

    // sometimes embedded or shared formats can hide it
    // fallback: try finding "list=" manually
    const m = s.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    if (m?.[1]) return m[1];
  } catch {
    // not a URL
  }

  return "";
}

async function fetchPlaylistPage({ playlistId, apiKey, pageToken = "", maxResults = 50 }) {
  // YouTube API max is 50
  const safeMax = Math.max(1, Math.min(50, Number(maxResults) || 50));

  const qs = new URLSearchParams({
    part: "snippet",
    playlistId,
    maxResults: String(safeMax),
    key: apiKey,
  });

  if (pageToken) qs.set("pageToken", pageToken);

  const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${qs.toString()}`, {
    // avoid caching in dev
    cache: "no-store",
  });

  // Defensive JSON parse (avoids crashes when Google returns HTML/errors)
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg = json?.error?.message || `YouTube API error (${res.status})`;
    throw new Error(msg);
  }

  const tracks = [];
  const items = json?.items || [];

  for (const it of items) {
    const sn = it?.snippet;
    const vid = sn?.resourceId?.videoId;
    const title = sn?.title;

    // YouTube playlists sometimes include "Private video" / "Deleted video" entries
    const lowered = String(title || "").toLowerCase();
    if (!vid || !title || lowered.includes("private video") || lowered.includes("deleted video")) continue;

    tracks.push({
      title,
      artist: sn?.videoOwnerChannelTitle || "",
      youtube_video_id: vid,
    });
  }

  return {
    tracks,
    nextPageToken: json?.nextPageToken || "",
  };
}

export async function POST(req) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing YOUTUBE_API_KEY in .env.local" }, { status: 500 });
    }

    const body = await req.json();
    const playlistUrl = body?.playlistUrl || "";
    const playlistId = extractPlaylistId(playlistUrl);

    if (!playlistId) {
      return NextResponse.json({ error: "Could not find playlist id. Paste a YouTube playlist link with ?list=..." }, { status: 400 });
    }

    const pageToken = (body?.pageToken || "").toString();
    const maxResults = body?.maxResults ?? 50;

    const page = await fetchPlaylistPage({
      playlistId,
      apiKey,
      pageToken,
      maxResults,
    });

    const tracks = page.tracks;

    if (!tracks.length) {
      return NextResponse.json({ error: "No playable videos found in that playlist." }, { status: 400 });
    }

    // return in YOUR app's shape (title/artist/youtubeUrl)
    return NextResponse.json({
      playlistId,
      nextPageToken: page.nextPageToken || "",
      tracks: tracks.map((t) => ({
        title: t.title,
        artist: t.artist,
        youtubeUrl: t.youtube_video_id, // your existing parseYouTubeId handles raw id
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Failed to import playlist" }, { status: 500 });
  }
}