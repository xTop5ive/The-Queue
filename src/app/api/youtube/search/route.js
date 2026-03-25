import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing YOUTUBE_API_KEY in .env.local" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    if (q.length < 3) {
      return NextResponse.json({ items: [] });
    }

    const maxResults = Math.min(Number(searchParams.get("limit") || "8"), 10);

    const qs = new URLSearchParams({
      part: "snippet",
      q,
      type: "video",
      maxResults: String(maxResults),
      key: apiKey,
      // optional: keep results music-ish
      videoCategoryId: "10", // Music category
      safeSearch: "moderate",
    });

    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${qs.toString()}`, {
      cache: "no-store",
    });

    const json = await res.json();

    if (!res.ok) {
      const msg = json?.error?.message || "YouTube API error";
      return NextResponse.json({ error: msg }, { status: res.status });
    }

    const items = (json?.items || [])
      .map((it) => {
        const vid = it?.id?.videoId;
        const sn = it?.snippet;
        if (!vid || !sn?.title) return null;
        return {
          youtube_video_id: vid,
          title: sn.title,
          channel: sn.channelTitle || "",
          thumbnail: sn?.thumbnails?.medium?.url || sn?.thumbnails?.default?.url || "",
        };
      })
      .filter(Boolean);

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Search failed" }, { status: 500 });
  }
}