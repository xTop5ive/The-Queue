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

export default function NewPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);

  // Playlist fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState([]);
  const [isPublic, setIsPublic] = useState(true);

  // DJ fields (optional)
  const [avgBpm, setAvgBpm] = useState("");
  const [energy, setEnergy] = useState("");
  const [clean, setClean] = useState(true);
  const [keys, setKeys] = useState([]); // e.g. ["8A", "9A"]

  // Tracks (multiple songs per playlist)
  const [tracks, setTracks] = useState([newEmptyTrack()]);

  // Import from a YouTube playlist link
  const [ytPlaylistUrl, setYtPlaylistUrl] = useState("");
  const [importing, setImporting] = useState(false);

  // YouTube search (Option 1: search inside app and add tracks)
  const [ytQuery, setYtQuery] = useState("");
  const [ytResults, setYtResults] = useState([]);
  const [ytSearching, setYtSearching] = useState(false);
  const [ytSearchOpen, setYtSearchOpen] = useState(false);
  const [ytSearchError, setYtSearchError] = useState("");
  const ytSearchWrapRef = useRef(null);

  // Cover upload
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");

  // UX state
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
    const titleStr = String(item.title || "").trim();
    const artistStr = String(item.channelTitle || item.artist || "").trim();
    const vid = String(item.videoId || item.youtube_video_id || item.youtubeUrl || "").trim();

    if (!vid) return;

    setTracks((prev) => {
      const cur = Array.isArray(prev) ? [...prev] : [];

      // If there is an empty row, fill the first empty row instead of always adding
      const emptyIdx = cur.findIndex(
        (t) => !(String(t?.title || "").trim() || String(t?.artist || "").trim() || String(t?.youtubeUrl || "").trim())
      );

      const nextTrack = {
        title: titleStr || "",
        artist: artistStr || "",
        youtubeUrl: vid, // can be videoId or url; we parse on submit
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

        if (!res.ok) {
          throw new Error(json?.error || "YouTube search failed");
        }

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
      // We fetch in pages so we can import more than the default 25.
      // The API route should return { tracks: [...], nextPageToken?: string }.
      // If it doesn't support paging yet, this will still work (it will just import the first page).

      const collected = [];
      let pageToken = null;

      // Safety to prevent infinite loops
      let guard = 0;

      while (collected.length < MAX_TRACKS && guard < 50) {
        guard += 1;

        const res = await fetch("/api/youtube/playlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playlistUrl: url,
            pageToken,
            // Ask the server for as many as it's willing to return per call.
            // YouTube API maxResults for playlistItems is 50.
            maxResults: 50,
            // Let the server know our overall cap (optional).
            maxTracks: MAX_TRACKS,
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Import failed");

        const raw = Array.isArray(json?.tracks) ? json.tracks : [];

        const normalized = raw
          .map((t) => ({
            title: String(t?.title || "").trim(),
            artist: String(t?.artist || "").trim(),
            // API returns `youtubeUrl` as either a full URL or a videoId; both work.
            youtubeUrl: String(t?.youtubeUrl || t?.youtube_video_id || "").trim(),
          }))
          .filter((t) => t.youtubeUrl);

        // Add this page's tracks
        for (const t of normalized) {
          if (collected.length >= MAX_TRACKS) break;
          collected.push(t);
        }

        // Stop if there is no next page
        pageToken = json?.nextPageToken || null;
        if (!pageToken) break;
      }

      if (!collected.length) {
        throw new Error("No public tracks found in that playlist.");
      }

      // Replace the current tracks with the imported playlist tracks.
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

      if (!normalizedTracks.length) {
        throw new Error("Add at least 1 track (title + YouTube link or video id).");
      }

      if (normalizedTracks.length > MAX_TRACKS) {
        throw new Error(`Too many tracks. Max is ${MAX_TRACKS}.`);
      }

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

      // 4c) insert playlist
      const payload = {
        user_id: user.id,

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

  const savedTracksCount = tracks.filter((t) => (t.title || "").trim() || (t.youtubeUrl || "").trim()).length;

  return (
    <div className="max-w-5xl mx-auto px-5 py-10">
      <div className="text-white/70 mb-6">
        <h1 className="text-3xl font-semibold text-white">New playlist</h1>
        <p className="mt-1">Title, description, tags, cover, tracks. Then you can play it anywhere.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cover */}
        <div
          className="rounded-2xl border p-5"
          style={{
            borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
            background: "color-mix(in srgb, var(--midnight) 80%, transparent)",
          }}
        >
          <div className="text-white font-semibold mb-3">Cover</div>

          <div
            className="rounded-2xl border overflow-hidden aspect-square flex items-center justify-center"
            style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
          >
            {coverPreview ? (
              <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center text-white/60">
                <div className="font-semibold text-white/80">No cover yet</div>
                <div className="text-sm mt-1">Upload a square image (PNG/JPG)</div>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <label className="inBtn cursor-pointer" style={{ display: "inline-flex" }}>
              Upload cover
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickCover(e.target.files?.[0] || null)}
              />
            </label>

            {coverFile ? (
              <button
                type="button"
                className="px-3 py-2 rounded-full border text-white/80"
                style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                onClick={() => {
                  setCoverFile(null);
                  setCoverPreview((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return "";
                  });
                }}
              >
                Remove
              </button>
            ) : null}
          </div>

          <div className="mt-2 text-xs text-white/50">Tip: 1000×1000 looks best.</div>
        </div>

        {/* Fields */}
        <div
          className="rounded-2xl border p-5"
          style={{
            borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
            background: "color-mix(in srgb, var(--midnight) 80%, transparent)",
          }}
        >
          {/* Title */}
          <label className="block text-white font-semibold">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Late Night Gold"
            className="mt-2 w-full px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
            style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
            maxLength={60}
          />
          <div className="mt-1 text-xs text-white/50">{title.length}/60</div>

          {/* Description */}
          <label className="block text-white font-semibold mt-5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What’s the vibe? Who is this for?"
            className="mt-2 w-full px-4 py-3 rounded-xl bg-transparent border text-white outline-none min-h-[120px]"
            style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
          />

          {/* Tracks */}
          <div
            className="mt-6 rounded-xl border px-4 py-4"
            style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-white font-semibold">Tracks</div>
                <div className="text-xs text-white/60">
                  Add songs using YouTube links. You’ll be able to play these anywhere in the app (Option B).
                </div>
              </div>
              <button
                type="button"
                className="px-4 py-2 rounded-full border text-sm"
                style={{
                  borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                  background: "color-mix(in srgb, var(--midnight) 85%, transparent)",
                  color: "white",
                }}
                onClick={() => {
                  setTracks((prev) => {
                    const cur = Array.isArray(prev) ? prev : [];
                    if (cur.length >= MAX_TRACKS) return cur;
                    return [...cur, newEmptyTrack()];
                  });
                }}
              >
                + Add track
              </button>
            </div>

            {/* Search YouTube (music category) and add tracks */}
            <div className="mt-3 grid gap-2" ref={ytSearchWrapRef}>
              <label className="block text-xs text-white/60">Search YouTube (music-only)</label>
              <div className="relative">
                <input
                  value={ytQuery}
                  onChange={(e) => setYtQuery(e.target.value)}
                  onFocus={() => {
                    // reopen if we already have results
                    if (ytResults.length || ytSearchError) setYtSearchOpen(true);
                  }}
                  placeholder="Search songs (adds as tracks)…"
                  className="w-full px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
                  style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                />

                {/* Dropdown */}
                {ytSearchOpen && (ytSearching || ytSearchError || ytResults.length) ? (
                  <div
                    className="absolute left-0 right-0 mt-2 rounded-xl border overflow-hidden"
                    style={{
                      borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                      background: "color-mix(in srgb, var(--midnight) 92%, black)",
                      zIndex: 30,
                    }}
                  >
                    {ytSearching ? (
                      <div className="p-4 text-white/70 text-sm">Searching…</div>
                    ) : ytSearchError ? (
                      <div className="p-4 text-red-400 text-sm">{ytSearchError}</div>
                    ) : (
                      ytResults.map((it) => (
                        <button
                          key={it.videoId}
                          type="button"
                          className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-white/5"
                          onClick={() => addTrackFromYouTube(it)}
                        >
                          <img
                            src={it.thumb || "/assets/image/avatar_default.jpg"}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover border"
                            style={{ borderColor: "color-mix(in srgb, var(--line) 70%, transparent)" }}
                          />
                          <div className="min-w-0">
                            <div className="text-white font-semibold truncate">{it.title}</div>
                            <div className="text-white/60 text-sm truncate">{it.channelTitle}</div>
                          </div>
                        </button>
                      ))
                    )}

                    {!ytSearching && !ytSearchError && !ytResults.length ? (
                      <div className="p-4 text-white/70 text-sm">No results</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="text-[11px] text-white/50">
                Results are filtered to YouTube’s Music category, so you’ll still get “official audio” and lyric uploads when there’s no MV.
              </div>
            </div>

            {/* Import a full YouTube playlist to auto-fill tracks */}
            <div className="mt-3 grid gap-2">
              <label className="block text-xs text-white/60">Import YouTube playlist (optional)</label>
              <div className="flex gap-2">
                <input
                  value={ytPlaylistUrl}
                  onChange={(e) => setYtPlaylistUrl(e.target.value)}
                  placeholder="Paste a YouTube playlist link (…?list=XXXX)"
                  className="w-full px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
                  style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                />
                <button
                  type="button"
                  onClick={importYouTubePlaylist}
                  disabled={importing}
                  className="px-4 py-2 rounded-full border text-sm"
                  style={{
                    borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                    background: "color-mix(in srgb, var(--midnight) 85%, transparent)",
                    color: "white",
                    whiteSpace: "nowrap",
                    opacity: importing ? 0.7 : 1,
                  }}
                >
                  {importing ? "Importing..." : "Import"}
                </button>
              </div>
              <div className="text-[11px] text-white/50">
                This pulls videos from a public YouTube playlist and fills your tracks list automatically (up to {MAX_TRACKS}).
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {tracks.map((t, idx) => {
                const yid = parseYouTubeId(t.youtubeUrl);
                return (
                  <div
                    key={idx}
                    className="rounded-xl border p-3"
                    style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-white/60">Track {idx + 1}</div>
                      {tracks.length > 1 ? (
                        <button
                          type="button"
                          className="text-xs underline text-white/60 hover:text-white"
                          onClick={() => {
                            setTracks((prev) => {
                              const cur = Array.isArray(prev) ? prev : [];
                              const next = cur.filter((_, i) => i !== idx);
                              return next.length ? next : [newEmptyTrack()];
                            });
                          }}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-white/60">Title</label>
                        <input
                          value={t.title}
                          onChange={(e) => {
                            const v = e.target.value;
                            setTracks((prev) => {
                              const cur = Array.isArray(prev) ? [...prev] : [];
                              cur[idx] = { ...cur[idx], title: v };
                              return cur;
                            });
                          }}
                          placeholder="Song title"
                          className="mt-2 w-full px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
                          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-white/60">Artist (optional)</label>
                        <input
                          value={t.artist}
                          onChange={(e) => {
                            const v = e.target.value;
                            setTracks((prev) => {
                              const cur = Array.isArray(prev) ? [...prev] : [];
                              cur[idx] = { ...cur[idx], artist: v };
                              return cur;
                            });
                          }}
                          placeholder="Artist"
                          className="mt-2 w-full px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
                          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs text-white/60">YouTube link or video id</label>
                        <input
                          value={t.youtubeUrl}
                          onChange={(e) => {
                            const v = e.target.value;
                            setTracks((prev) => {
                              const cur = Array.isArray(prev) ? [...prev] : [];
                              cur[idx] = { ...cur[idx], youtubeUrl: v };
                              return cur;
                            });
                          }}
                          placeholder="https://youtu.be/... or 11-char id"
                          className="mt-2 w-full px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
                          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                        />
                        {t.youtubeUrl.trim() ? (
                          yid ? (
                            <div className="mt-2 text-[11px] text-white/60">Parsed id: {yid}</div>
                          ) : (
                            <div className="mt-2 text-[11px] text-red-300">Invalid YouTube link/id.</div>
                          )
                        ) : (
                          <div className="mt-2 text-[11px] text-white/50">Tip: paste a full YouTube URL.</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 text-xs text-white/50">
              Tracks filled: {savedTracksCount} / {MAX_TRACKS}
            </div>
          </div>

          {/* Tags */}
          <div className="flex items-center justify-between mt-5">
            <label className="text-white font-semibold">Tags</label>
            <div className="text-xs text-white/50">Up to 10</div>
          </div>

          <div className="mt-2">
            <TagInput value={tags} onChange={setTags} max={10} placeholder="Type a tag and press Enter" />
          </div>

          {/* DJ filters (optional) */}
          <div
            className="mt-6 rounded-xl border px-4 py-4"
            style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
          >
            <div>
              <div className="text-white font-semibold">DJ stats (optional)</div>
              <div className="text-xs text-white/60">Helps people search by BPM, key, energy, and clean version.</div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/60">Avg BPM</label>
                <input
                  value={avgBpm}
                  onChange={(e) => setAvgBpm(e.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  placeholder="e.g., 124"
                  className="mt-2 w-full px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
                  style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                />
                <div className="mt-1 text-[11px] text-white/50">40–220</div>
              </div>

              <div>
                <label className="block text-xs text-white/60">Energy (0–10)</label>
                <input
                  value={energy}
                  onChange={(e) => setEnergy(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                  inputMode="numeric"
                  placeholder="e.g., 7"
                  className="mt-2 w-full px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
                  style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                />
                <div className="mt-1 text-[11px] text-white/50">0–10</div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs text-white/60">Key (Camelot)</label>
                <div className="mt-2 flex flex-wrap gap-2">
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
                        className="px-3 py-1 rounded-full border text-sm"
                        style={{
                          borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                          background: active ? "color-mix(in srgb, var(--gold) 16%, transparent)" : "transparent",
                          color: "white",
                        }}
                        aria-pressed={active}
                      >
                        {k}
                      </button>
                    );
                  })}

                  {(keys || []).length ? (
                    <button
                      type="button"
                      onClick={() => setKeys([])}
                      className="px-3 py-1 rounded-full border text-sm"
                      style={{
                        borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                        background: "transparent",
                        color: "rgba(255,255,255,.7)",
                      }}
                    >
                      Clear keys
                    </button>
                  ) : null}
                </div>
                <div className="mt-2 text-[11px] text-white/50">Pick up to 4 keys.</div>
              </div>

              <div
                className="sm:col-span-2 flex items-center justify-between rounded-xl border px-4 py-3"
                style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
              >
                <div>
                  <div className="text-white font-semibold">Version</div>
                  <div className="text-xs text-white/60">Clean playlists show up when people filter “Clean only”.</div>
                </div>

                <button
                  type="button"
                  onClick={() => setClean((v) => !v)}
                  className="px-4 py-2 rounded-full border text-sm"
                  style={{
                    borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                    background: clean ? "color-mix(in srgb, var(--gold) 16%, transparent)" : "transparent",
                    color: "white",
                  }}
                >
                  {clean ? "Clean" : "Explicit"}
                </button>
              </div>
            </div>
          </div>

          {/* Visibility */}
          <div
            className="mt-5 flex items-center justify-between rounded-xl border px-4 py-3"
            style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
          >
            <div>
              <div className="text-white font-semibold">Visibility</div>
              <div className="text-xs text-white/60">Public playlists show up in Explore.</div>
            </div>

            <button
              type="button"
              onClick={() => setIsPublic((v) => !v)}
              className="px-4 py-2 rounded-full border text-sm"
              style={{
                borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                background: isPublic ? "color-mix(in srgb, var(--gold) 16%, transparent)" : "transparent",
                color: "white",
              }}
            >
              {isPublic ? "Public" : "Private"}
            </button>
          </div>

          {/* Errors */}
          {error ? <div className="mt-4 text-red-400 text-sm">{error}</div> : null}

          {/* Actions */}
          <div className="mt-6 flex items-center gap-3">
            <button type="submit" className="inBtn" disabled={loading}>
              {loading ? "Saving..." : "Create playlist"}
            </button>

            <button
              type="button"
              className="px-4 py-2 rounded-full border text-white/80"
              style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
              onClick={() => router.push("/explore")}
            >
              Cancel
            </button>
          </div>

          <div className="mt-2 text-xs text-white/50">Next: add real playback + comments.</div>
        </div>
      </form>
    </div>
  );
}