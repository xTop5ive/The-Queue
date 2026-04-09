"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";
import TagInput from "@/components/TagInput"; // src/components/TagInput.js

// Storage bucket name (case-sensitive)
const COVERS_BUCKET = "covers";

// Track limits so the UI doesn't get out of control (raise for bigger playlist imports)
const MAX_TRACKS = 500;

function newEmptyTrack() {
  return { title: "", artist: "", youtubeUrl: "" };
}

// Parse YouTube video id from:
// - raw 11-char id
// - youtu.be/<id>
// - youtube.com/watch?v=<id>
// - youtube.com/embed/<id>
function parseYouTubeId(input) {
  const s = (input || "").trim();
  if (!s) return "";

  // Accept raw id
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;

  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "");

    // youtu.be/<id>
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0] || "";
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : "";
    }

    // youtube.com/watch?v=<id>
    if (host.endsWith("youtube.com")) {
      const v = u.searchParams.get("v") || "";
      if (/^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

      // youtube.com/embed/<id>
      const parts = u.pathname.split("/").filter(Boolean);
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) {
        const id = parts[embedIdx + 1];
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : "";
      }
    }
  } catch {
    // not a URL
  }

  return "";
}

// Some YouTube titles come back with HTML entities like &#39; or &quot;
// Decode those so users don't see the symbols in our inputs.
function decodeHtmlEntities(input) {
  const s = (input || "").toString();
  if (!s) return "";

  // Fast path for the common ones
  const quick = s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

  // If DOM is available, let the browser decode anything else
  try {
    if (typeof window !== "undefined") {
      const ta = document.createElement("textarea");
      ta.innerHTML = quick;
      return (ta.value || "").toString();
    }
  } catch {
    // ignore
  }

  return quick;
}

// YouTube titles often look like: "Artist - Song Title"
// This splits it so Artist and Title fields get populated cleanly.
function splitArtistTitle(rawTitle, fallbackArtist = "") {
  const raw = decodeHtmlEntities((rawTitle || "").toString()).trim();
  const fb = decodeHtmlEntities((fallbackArtist || "").toString()).trim();
  if (!raw) return { artist: fb, title: "" };

  // Normalize whitespace + common dash variants
  let s = raw.replace(/\s+/g, " ").trim();
  s = s.replace(/[–—]/g, "-");

  // Helper: remove common YouTube noise from titles
  const stripNoise = (str) => {
    if (!str) return "";
    let out = String(str).replace(/\s+/g, " ").trim();

    // Remove trailing segments after pipes (often: | Official Video)
    out = out.split("|")[0].trim();

    // Remove common bracket/paren tags (Official Video/Audio, Lyrics, Visualizer, etc.)
    // We only remove these when they appear as standalone tags.
    const noiseTag = /(official\s*(music\s*)?video|official\s*audio|lyric\s*video|lyrics?|audio|visualizer|mv|performance|live|sped\s*up|slowed(\s*\+\s*reverb)?|clean|explicit)/i;

    // Remove trailing (...) or [...] blocks that match noise tags
    out = out.replace(/\s*(\(|\[)\s*([^\)\]]+)\s*(\)|\])\s*$/g, (m, open, inner) => {
      return noiseTag.test(inner) ? "" : m;
    });

    // Remove any remaining repeated trailing noise blocks (do a few passes)
    for (let i = 0; i < 3; i++) {
      const next = out.replace(/\s*(\(|\[)\s*([^\)\]]+)\s*(\)|\])\s*$/g, (m, open, inner) => {
        return noiseTag.test(inner) ? "" : m;
      }).trim();
      if (next === out) break;
      out = next;
    }

    return out.trim();
  };

  // Helper: pull `feat/ft/featuring ...` out of a title string
  // Returns: { baseTitle, featArtists } where featArtists is a string like "DaBaby" or "DaBaby, Drake"
  const extractFeaturing = (titleStr) => {
    const t = String(titleStr || "").trim();
    if (!t) return { baseTitle: "", featArtists: "" };

    // Match: feat. X / ft X / featuring X (until end)
    const m = t.match(/\s*(?:\(|\[)?\s*(feat\.?|ft\.?|featuring)\s+([^\)\]]+)\s*(?:\)|\])?\s*$/i);
    if (m && m[2]) {
      const featArtists = m[2].trim();
      const baseTitle = t.slice(0, m.index).trim();
      return { baseTitle, featArtists };
    }

    // Also handle: "Title - feat X" style is already covered by the above; this is fallback.
    return { baseTitle: t, featArtists: "" };
  };

  // Split on the FIRST " - " if present (common: "Artist - Title")
  // If not present, we fallback.
  const dashIdx = s.indexOf(" - ");

  let artistPart = "";
  let titlePart = "";

  if (dashIdx > 0) {
    artistPart = s.slice(0, dashIdx).trim();
    titlePart = s.slice(dashIdx + 3).trim();
  } else {
    // Sometimes titles use "-" without spaces; try a safe regex split once.
    const m = s.match(/^(.+?)\s-\s(.+)$/);
    if (m && m[1] && m[2]) {
      artistPart = m[1].trim();
      titlePart = m[2].trim();
    } else {
      // No clear artist/title split
      return { artist: fb, title: stripNoise(s) };
    }
  }

  // Clean up title noise first
  titlePart = stripNoise(titlePart);

  // If title has trailing feat/ft, move it into artist
  const { baseTitle, featArtists } = extractFeaturing(titlePart);
  titlePart = stripNoise(baseTitle);

  // Artist cleanup:
  // Normalize any collaboration separators to a single word: "feat"
  // Examples:
  // - "Artist x Artist2" -> "Artist feat Artist2"
  // - "Artist & Artist2" -> "Artist feat Artist2"
  // - "Artist with Artist2" -> "Artist feat Artist2"
  // - "Artist w/ Artist2" -> "Artist feat Artist2"
  // - "Artist ft Artist2" -> "Artist feat Artist2"
  // - "Artist feat Artist2" (already) -> stays
  const normalizeArtistCollabs = (str) => {
    let out = String(str || "").replace(/\s+/g, " ").trim();
    if (!out) return "";

    // Normalize spelled/abbrev feature keywords to "feat"
    out = out.replace(/\b(feat\.?|ft\.?|featuring)\b/gi, "feat");

    // Normalize common collab separators to "feat"
    // includes: x, ×, &, and, +, with, w/
    out = out.replace(/\s*(?:x|×|&|\+|and|with|w\/|w)\s*/gi, " feat ");

    // Cleanup duplicate feat tokens and whitespace
    out = out.replace(/\b(feat)\b\s+\b(feat)\b/gi, "feat");
    out = out.replace(/\s+/g, " ").trim();

    // If it starts with "feat" somehow, drop it
    out = out.replace(/^feat\s+/i, "");

    return out;
  };

  artistPart = normalizeArtistCollabs(artistPart);

  // If title had trailing feat/ft artists, merge them into the artist field (as "feat")
  let mergedFeatArtists = featArtists;
  if (mergedFeatArtists) {
    mergedFeatArtists = normalizeArtistCollabs(mergedFeatArtists);
  }

  // If the artistPart itself contains trailing feature info like "Artist feat X" or "Artist ft X",
  // split and merge the right side into mergedFeatArtists.
  const mArtistFeat = artistPart.match(/^(.*?)(?:\s+feat\s+(.+))$/i);
  if (mArtistFeat) {
    const baseArtist = (mArtistFeat[1] || "").trim();
    const moreFeat = (mArtistFeat[2] || "").trim();
    artistPart = baseArtist;
    if (moreFeat) {
      mergedFeatArtists = mergedFeatArtists ? `${mergedFeatArtists}, ${moreFeat}` : moreFeat;
      mergedFeatArtists = normalizeArtistCollabs(mergedFeatArtists);
    }
  }

  // Merge featuring artists into the artist field
  let finalArtist = artistPart || fb;
  finalArtist = normalizeArtistCollabs(finalArtist);

  if (mergedFeatArtists) {
    // Keep it looking clean and consistent: always "feat" (not x/with/&/ft)
    finalArtist = normalizeArtistCollabs(`${finalArtist} feat ${mergedFeatArtists}`);
  }

  const finalTitle = titlePart || stripNoise(s) || "";

  return {
    artist: finalArtist || fb,
    title: finalTitle,
  };
}

export default function NewPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState([]);
  const [isPublic, setIsPublic] = useState(true);

  const [avgBpm, setAvgBpm] = useState("");
  const [energy, setEnergy] = useState("");
  const [clean, setClean] = useState(true);
  const [keys, setKeys] = useState([]);
  const [showDjStats, setShowDjStats] = useState(false);

  const [tracks, setTracks] = useState([newEmptyTrack()]);

  const [ytPlaylistUrl, setYtPlaylistUrl] = useState("");
  const [importing, setImporting] = useState(false);

  const [ytQuery, setYtQuery] = useState("");
  const [ytResults, setYtResults] = useState([]);
  const [ytSearching, setYtSearching] = useState(false);
  const [ytSearchOpen, setYtSearchOpen] = useState(false);
  const [ytSearchError, setYtSearchError] = useState("");
  const ytSearchWrapRef = useRef(null);

  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function onPickCover(file) {
    if (!file) return;
    setCoverFile(file);
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  // Add a searched YouTube result into the Tracks list
  function addTrackFromYouTube(item) {
    if (!item) return;

    const rawTitle = decodeHtmlEntities(String(item.title || "")).trim();

    // Usually uploader/channel, but good fallback
    const fallbackArtist = decodeHtmlEntities(String(item.channelTitle || item.artist || "")).trim();

    // Split "Artist - Song" into separate fields
    const parsed = splitArtistTitle(rawTitle, fallbackArtist);

    const vid = String(item.videoId || item.youtube_video_id || item.youtubeUrl || "").trim();
    if (!vid) return;

    setTracks((prev) => {
      const cur = Array.isArray(prev) ? [...prev] : [];

      // If there is an empty row, fill it first
      const emptyIdx = cur.findIndex(
        (t) =>
          !(
            String(t?.title || "").trim() ||
            String(t?.artist || "").trim() ||
            String(t?.youtubeUrl || "").trim()
          )
      );

      const nextTrack = {
        title: parsed.title || rawTitle || "",
        artist: parsed.artist || fallbackArtist || "",
        youtubeUrl: vid, // videoId or url; we parse on submit
      };

      if (emptyIdx >= 0) {
        cur[emptyIdx] = nextTrack;
        return cur;
      }

      if (cur.length >= MAX_TRACKS) return cur;
      return [...cur, nextTrack];
    });

    setYtSearchOpen(false);
    setYtQuery("");
    setYtResults([]);
    setYtSearchError("");
  }

  // Debounced YouTube search as you type (music-only results)
  useEffect(() => {
    const q = (ytQuery || "").trim();
    setYtSearchError("");

    if (q.length < 2) {
      setYtResults([]);
      return;
    }

    let alive = true;
    const t = setTimeout(async () => {
      setYtSearching(true);
      try {
        const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(q)}&max=8`);
        const json = await res.json().catch(() => ({}));

        if (!res.ok) throw new Error(json?.error || "YouTube search failed");

        if (!alive) return;
        setYtResults(Array.isArray(json?.items) ? json.items : []);
        setYtSearchOpen(true);
      } catch (e) {
        if (!alive) return;
        setYtSearchError(e?.message || "YouTube search failed");
        setYtResults([]);
        setYtSearchOpen(true);
      } finally {
        if (alive) setYtSearching(false);
      }
    }, 350);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [ytQuery]);

  // Close the YouTube search dropdown when clicking outside
  useEffect(() => {
    function onDown(e) {
      const el = ytSearchWrapRef.current;
      if (!el) return;
      if (!el.contains(e.target)) setYtSearchOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Import tracks from a public YouTube playlist link via our server route.
  // This fills the Tracks list automatically.
  async function importYouTubePlaylist() {
    const url = (ytPlaylistUrl || "").trim();
    if (!url) return;

    setError("");
    setImporting(true);

    try {
      const collected = [];
      let pageToken = null;
      let guard = 0;

      while (collected.length < MAX_TRACKS && guard < 50) {
        guard += 1;

        const res = await fetch("/api/youtube/playlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playlistUrl: url,
            pageToken,
            maxResults: 50,
            maxTracks: MAX_TRACKS,
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Import failed");

        const raw = Array.isArray(json?.tracks) ? json.tracks : [];

        const normalized = raw
          .map((t) => {
            const rawTitle = decodeHtmlEntities(String(t?.title || "")).trim();
            const fallbackArtist = decodeHtmlEntities(String(t?.artist || "")).trim();
            const parsed = splitArtistTitle(rawTitle, fallbackArtist);

            return {
              title: parsed.title || rawTitle,
              artist: parsed.artist || fallbackArtist,
              youtubeUrl: String(t?.youtubeUrl || t?.youtube_video_id || "").trim(),
            };
          })
          .filter((t) => t.youtubeUrl);

        for (const t of normalized) {
          if (collected.length >= MAX_TRACKS) break;
          collected.push(t);
        }

        pageToken = json?.nextPageToken || null;
        if (!pageToken) break;
      }

      if (!collected.length) throw new Error("No public tracks found in that playlist.");

      setTracks(collected);
    } catch (e) {
      setError(e?.message || "Could not import playlist.");
    } finally {
      setImporting(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1) must be logged in
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = authData?.user;

      if (!user) {
        router.push(`/login?next=${encodeURIComponent("/new")}`);
        return;
      }

      // 2) validate playlist basics
      const cleanTitle = title.trim();
      if (!cleanTitle) throw new Error("Title is required.");
      if (cleanTitle.length > 60) throw new Error("Title must be 60 characters or less.");

      // 3) upload cover (optional)
      let cover_path = null;
      let cover_url = null;

      if (coverFile) {
        const ext = (coverFile.name.split(".").pop() || "jpg").toLowerCase();
        const fileName = `${crypto.randomUUID()}.${ext}`;
        cover_path = `${user.id}/${fileName}`;

        const { error: upErr } = await supabase.storage.from(COVERS_BUCKET).upload(cover_path, coverFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: coverFile.type || "image/jpeg",
        });

        if (upErr) throw upErr;

        const { data: pub } = supabase.storage.from(COVERS_BUCKET).getPublicUrl(cover_path);
        cover_url = pub?.publicUrl || null;
      }

      // 4a) normalize DJ fields (optional)
      const bpmNum = avgBpm === "" ? null : Number(avgBpm);
      const energyNum = energy === "" ? null : Number(energy);

      if (bpmNum !== null && (!Number.isFinite(bpmNum) || bpmNum < 40 || bpmNum > 220)) {
        throw new Error("Avg BPM must be a number between 40 and 220.");
      }

      if (energyNum !== null && (!Number.isFinite(energyNum) || energyNum < 0 || energyNum > 10)) {
        throw new Error("Energy must be a number between 0 and 10.");
      }

      const keysArr = (keys || [])
        .map((k) => String(k).trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 4);

      // 4b) normalize + validate tracks
      const normalizedTracks = (tracks || [])
        .map((t) => ({
          title: String(t?.title || "").trim(),
          artist: String(t?.artist || "").trim(),
          youtubeUrl: String(t?.youtubeUrl || "").trim(),
        }))
        .filter((t) => t.title || t.artist || t.youtubeUrl);

      if (!normalizedTracks.length) throw new Error("Add at least 1 track (title + YouTube link or video id).");
      if (normalizedTracks.length > MAX_TRACKS) throw new Error(`Too many tracks. Max is ${MAX_TRACKS}.`);

      const tracksToInsert = normalizedTracks.map((t, idx) => {
        const yid = parseYouTubeId(t.youtubeUrl);
        if (!yid) throw new Error(`Track #${idx + 1} needs a valid YouTube link or 11-character video id.`);
        const finalTitle = t.title || `Track ${idx + 1}`;

        return {
          position: idx + 1,
          title: finalTitle,
          artist: t.artist || null,
          youtube_video_id: yid,
        };
      });

      // store first track id on the playlist for quick preview
      const firstYoutubeId = tracksToInsert[0]?.youtube_video_id || null;

      // Store the creator handle on the playlist row so cards/search can show the real @handle.
      const rawHandle =
        user?.user_metadata?.handle ||
        user?.user_metadata?.username ||
        user?.email?.split("@")[0] ||
        "user";

      const owner_handle = rawHandle.startsWith("@") ? rawHandle : `@${rawHandle}`;

      // 4c) insert playlist
      const payload = {
        user_id: user.id,
        owner_handle,

        // content
        title: cleanTitle,
        description: description.trim() || null,
        tags: (tags || []).slice(0, 10).map((t) => String(t).trim().toLowerCase()).filter(Boolean),
        is_public: isPublic,

        // DJ fields
        avg_bpm: bpmNum,
        energy: energyNum,
        clean,
        keys: keysArr,

        // YouTube preview (first track)
        youtube_video_id: firstYoutubeId,

        // cover
        cover_path,
        cover_url,

        // likes
        likes_count: 0,
      };

      const { data: inserted, error: insErr } = await supabase.from("playlists").insert(payload).select("id").single();
      if (insErr) throw insErr;

      // 4d) insert tracks into playlist_tracks
      const { error: trackErr } = await supabase.from("playlist_tracks").insert(
        tracksToInsert.map((t) => ({
          playlist_id: inserted.id,
          position: t.position,
          title: t.title,
          artist: t.artist,
          youtube_video_id: t.youtube_video_id,
        }))
      );

      if (trackErr) throw trackErr;

      // 5) go to playlist detail
      router.push(`/p/${inserted.id}`);
    } catch (err) {
      const msg = err?.message || "Something went wrong.";
      if (/bucket/i.test(msg) && /not found/i.test(msg)) {
        setError(
          `Storage bucket "${COVERS_BUCKET}" not found. Create it in Supabase → Storage (make it Public for now), then try again.`
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  const savedTracksCount = tracks.filter(
    (t) => t.title.trim() || t.youtubeUrl.trim()
  ).length;

  const inputCls = "w-full px-4 py-2.5 rounded-xl bg-transparent border text-white outline-none text-sm placeholder-white/30";
  const borderStyle = { borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" };
  const cardStyle = {
    borderColor: "color-mix(in srgb, var(--line) 70%, transparent)",
    background: "color-mix(in srgb, var(--midnight) 80%, transparent)",
  };

  return (
    <div className="max-w-3xl mx-auto px-5 py-10 pb-32">

      {/* Header */}
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: "var(--gold)" }}>
          The Queue
        </div>
        <h1 className="text-3xl font-semibold text-white">New Playlist</h1>
        <p className="text-white/50 mt-1 text-sm">Add your tracks, set the vibe, and publish.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Section 1: Cover + Basics ──────────────────────────────────── */}
        <div className="rounded-2xl border p-6 grid md:grid-cols-[160px_1fr] gap-6" style={cardStyle}>
          {/* Cover */}
          <div>
            <div
              className="aspect-square rounded-xl border overflow-hidden flex items-center justify-center"
              style={borderStyle}
            >
              {coverPreview ? (
                <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center px-3">
                  <div className="text-2xl text-white/20 mb-1">♫</div>
                  <div className="text-xs text-white/40">No cover</div>
                </div>
              )}
            </div>
            <label className="mt-3 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border text-xs text-white/70 cursor-pointer hover:text-white transition" style={borderStyle}>
              {coverFile ? "Change" : "Upload cover"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickCover(e.target.files?.[0] || null)}
              />
            </label>
            {coverFile && (
              <button
                type="button"
                className="mt-2 w-full text-xs text-white/40 hover:text-white/70 transition"
                onClick={() => {
                  setCoverFile(null);
                  setCoverPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return ""; });
                }}
              >
                Remove
              </button>
            )}
          </div>

          {/* Basics */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-white">Title <span style={{ color: "var(--gold)" }}>*</span></label>
                <span className="text-xs text-white/30">{title.length}/60</span>
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Late Night Gold"
                className={inputCls}
                style={borderStyle}
                maxLength={60}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-white mb-1.5 block">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's the vibe? Who is this for?"
                rows={3}
                className={`${inputCls} resize-none`}
                style={borderStyle}
              />
            </div>

            {/* Visibility + Clean row */}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsPublic((v) => !v)}
                className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm transition"
                style={{
                  ...borderStyle,
                  background: isPublic ? "color-mix(in srgb, var(--gold) 14%, transparent)" : "transparent",
                  color: isPublic ? "var(--gold)" : "var(--muted)",
                }}
              >
                <span>{isPublic ? "🌐" : "🔒"}</span>
                {isPublic ? "Public" : "Private"}
              </button>

              <button
                type="button"
                onClick={() => setClean((v) => !v)}
                className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm transition"
                style={{
                  ...borderStyle,
                  background: "transparent",
                  color: "var(--muted)",
                }}
              >
                {clean ? "✓ Clean" : "Explicit"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Section 2: Tracks ──────────────────────────────────────────── */}
        <div className="rounded-2xl border p-6" style={cardStyle}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-white">Tracks</h2>
              <p className="text-white/40 text-xs mt-0.5">
                {savedTracksCount > 0
                  ? `${savedTracksCount} track${savedTracksCount !== 1 ? "s" : ""} added`
                  : "Add songs via search or YouTube link"}
              </p>
            </div>
            <button
              type="button"
              className="px-4 py-2 rounded-full border text-sm transition"
              style={{ ...borderStyle, color: "white" }}
              onClick={() => {
                setTracks((prev) => {
                  const cur = Array.isArray(prev) ? prev : [];
                  if (cur.length >= MAX_TRACKS) return cur;
                  return [...cur, newEmptyTrack()];
                });
              }}
            >
              + Add row
            </button>
          </div>

          {/* Add tracks — search + import side by side */}
          <div className="grid sm:grid-cols-2 gap-4 mb-6 pb-6 border-b" style={{ borderColor: "color-mix(in srgb, var(--line) 50%, transparent)" }}>
            {/* YouTube search */}
            <div ref={ytSearchWrapRef} className="relative">
              <label className="text-xs text-white/50 mb-1.5 block">Search YouTube</label>
              <input
                value={ytQuery}
                onChange={(e) => setYtQuery(e.target.value)}
                onFocus={() => { if (ytResults.length || ytSearchError) setYtSearchOpen(true); }}
                placeholder="Search a song to add…"
                className={inputCls}
                style={borderStyle}
              />
              {ytSearchOpen && (ytSearching || ytSearchError || ytResults.length > 0) && (
                <div
                  className="absolute left-0 right-0 mt-1.5 rounded-xl border overflow-hidden"
                  style={{
                    ...borderStyle,
                    background: "color-mix(in srgb, var(--midnight) 96%, black)",
                    zIndex: 30,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                  }}
                >
                  {ytSearching ? (
                    <div className="px-4 py-3 text-white/50 text-sm">Searching…</div>
                  ) : ytSearchError ? (
                    <div className="px-4 py-3 text-red-400 text-sm">{ytSearchError}</div>
                  ) : ytResults.length === 0 ? (
                    <div className="px-4 py-3 text-white/50 text-sm">No results</div>
                  ) : (
                    ytResults.map((it) => (
                      <button
                        key={it.videoId}
                        type="button"
                        className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition"
                        onClick={() => addTrackFromYouTube(it)}
                      >
                        <img
                          src={it.thumb || "/assets/image/avatar_default.jpg"}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-white text-sm font-medium truncate">{it.title}</div>
                          <div className="text-white/50 text-xs truncate">{it.channelTitle}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* YouTube playlist import */}
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Import YouTube playlist</label>
              <div className="flex gap-2">
                <input
                  value={ytPlaylistUrl}
                  onChange={(e) => setYtPlaylistUrl(e.target.value)}
                  placeholder="Paste playlist link…"
                  className={`${inputCls} flex-1`}
                  style={borderStyle}
                />
                <button
                  type="button"
                  onClick={importYouTubePlaylist}
                  disabled={importing || !ytPlaylistUrl.trim()}
                  className="px-4 py-2 rounded-full border text-sm whitespace-nowrap transition disabled:opacity-40"
                  style={{ ...borderStyle, color: "white" }}
                >
                  {importing ? "…" : "Import"}
                </button>
              </div>
            </div>
          </div>

          {/* Track rows */}
          <div className="space-y-2">
            {tracks.map((t, idx) => {
              const yid = parseYouTubeId(t.youtubeUrl);
              const hasUrl = t.youtubeUrl.trim().length > 0;
              const urlValid = !hasUrl || !!yid;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2"
                >
                  <span className="text-white/25 text-xs w-5 text-right flex-shrink-0 select-none">{idx + 1}</span>

                  <input
                    value={t.title}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTracks((prev) => { const c = [...prev]; c[idx] = { ...c[idx], title: v }; return c; });
                    }}
                    placeholder="Title"
                    className={inputCls}
                    style={borderStyle}
                  />

                  <input
                    value={t.artist}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTracks((prev) => { const c = [...prev]; c[idx] = { ...c[idx], artist: v }; return c; });
                    }}
                    placeholder="Artist"
                    className={`${inputCls} hidden sm:block`}
                    style={borderStyle}
                  />

                  <input
                    value={t.youtubeUrl}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTracks((prev) => { const c = [...prev]; c[idx] = { ...c[idx], youtubeUrl: v }; return c; });
                    }}
                    placeholder="YouTube link"
                    className={inputCls}
                    style={{
                      ...borderStyle,
                      borderColor: !urlValid
                        ? "color-mix(in srgb, #f87171 60%, transparent)"
                        : yid
                        ? "color-mix(in srgb, var(--gold) 40%, transparent)"
                        : borderStyle.borderColor,
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => {
                      setTracks((prev) => {
                        const next = prev.filter((_, i) => i !== idx);
                        return next.length ? next : [newEmptyTrack()];
                      });
                    }}
                    className="text-white/25 hover:text-white/60 transition flex-shrink-0 text-lg leading-none px-1"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          {tracks.length > 0 && (
            <div className="mt-4 text-xs text-white/30 text-right">
              {savedTracksCount} / {MAX_TRACKS} tracks
            </div>
          )}
        </div>

        {/* ── Section 3: Details ─────────────────────────────────────────── */}
        <div className="rounded-2xl border p-6" style={cardStyle}>
          <h2 className="font-semibold text-white mb-4">Details</h2>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-white">Tags</label>
              <span className="text-xs text-white/30">up to 10</span>
            </div>
            <TagInput value={tags} onChange={setTags} max={10} placeholder="Type a tag and press Enter" />
          </div>

          {/* DJ Stats — collapsible */}
          <div className="mt-5">
            <button
              type="button"
              onClick={() => setShowDjStats((v) => !v)}
              className="flex items-center gap-2 text-sm transition"
              style={{ color: showDjStats ? "var(--gold)" : "var(--muted)" }}
            >
              <span>{showDjStats ? "▾" : "▸"}</span>
              DJ stats
              <span className="text-xs opacity-60">(optional — BPM, key, energy)</span>
            </button>

            {showDjStats && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Avg BPM</label>
                  <input
                    value={avgBpm}
                    onChange={(e) => setAvgBpm(e.target.value.replace(/[^0-9]/g, ""))}
                    inputMode="numeric"
                    placeholder="e.g., 124"
                    className={inputCls}
                    style={borderStyle}
                  />
                </div>

                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Energy (0–10)</label>
                  <input
                    value={energy}
                    onChange={(e) => setEnergy(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                    inputMode="numeric"
                    placeholder="e.g., 7"
                    className={inputCls}
                    style={borderStyle}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs text-white/50 mb-2 block">Key — Camelot (up to 4)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "1A","2A","3A","4A","5A","6A","7A","8A","9A","10A","11A","12A",
                      "1B","2B","3B","4B","5B","6B","7B","8B","9B","10B","11B","12B",
                    ].map((k) => {
                      const active = (keys || []).includes(k);
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => {
                            setKeys((prev) => {
                              const cur = Array.isArray(prev) ? prev : [];
                              if (cur.includes(k)) return cur.filter((x) => x !== k);
                              if (cur.length >= 4) return cur;
                              return [...cur, k];
                            });
                          }}
                          className="px-2.5 py-1 rounded-full border text-xs transition"
                          style={{
                            ...borderStyle,
                            background: active ? "color-mix(in srgb, var(--gold) 16%, transparent)" : "transparent",
                            color: active ? "var(--gold)" : "var(--muted)",
                          }}
                        >
                          {k}
                        </button>
                      );
                    })}
                    {keys.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setKeys([])}
                        className="px-2.5 py-1 rounded-full border text-xs"
                        style={{ ...borderStyle, color: "var(--muted)" }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div
                  className="sm:col-span-2 flex items-center justify-between rounded-xl border px-4 py-3"
                  style={borderStyle}
                >
                  <div>
                    <div className="text-sm font-medium text-white">Version</div>
                    <div className="text-xs text-white/40">Clean playlists appear in clean-only filters.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setClean((v) => !v)}
                    className="px-4 py-2 rounded-full border text-sm transition"
                    style={{
                      ...borderStyle,
                      background: clean ? "color-mix(in srgb, var(--gold) 14%, transparent)" : "transparent",
                      color: clean ? "var(--gold)" : "var(--muted)",
                    }}
                  >
                    {clean ? "Clean" : "Explicit"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Submit ─────────────────────────────────────────────────────── */}
        {error && (
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{
              background: "color-mix(in srgb, #f87171 10%, transparent)",
              border: "1px solid color-mix(in srgb, #f87171 40%, transparent)",
              color: "#fca5a5",
            }}
          >
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pb-4">
          <button type="submit" className="inBtn" disabled={loading}>
            {loading ? "Creating…" : "Create playlist"}
          </button>
          <button
            type="button"
            className="px-5 py-2.5 rounded-full border text-sm transition"
            style={{ ...borderStyle, color: "var(--muted)" }}
            onClick={() => router.push("/explore")}
          >
            Cancel
          </button>
        </div>

      </form>
    </div>
  );
}