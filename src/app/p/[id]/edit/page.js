"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase-browser";
import TagInput from "@/components/TagInput";

const MAX_TRACKS = 500;
const COVERS_BUCKET = "covers";

function parseYouTubeId(input) {
  const s = (input || "").trim();
  if (!s) return "";
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0] || "";
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : "";
    }
    if (host.endsWith("youtube.com")) {
      const v = u.searchParams.get("v") || "";
      if (/^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      const ei = parts.indexOf("embed");
      if (ei >= 0 && parts[ei + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[ei + 1])) return parts[ei + 1];
    }
  } catch {}
  return "";
}

function emptyTrack() {
  return { title: "", artist: "", youtubeUrl: "" };
}

export default function EditPlaylistPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);

  // playlist basics
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState([]);
  const [isPublic, setIsPublic] = useState(true);

  // cover
  const [existingCoverUrl, setExistingCoverUrl] = useState("");
  const [existingCoverPath, setExistingCoverPath] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");

  // DJ stats
  const [avgBpm, setAvgBpm] = useState("");
  const [energy, setEnergy] = useState("");
  const [clean, setClean] = useState(true);
  const [keys, setKeys] = useState([]);
  const [showDjStats, setShowDjStats] = useState(false);

  // tracks
  const [tracks, setTracks] = useState([emptyTrack()]);

  // ui
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(`/p/${id}/edit`)}`);
        return;
      }

      const { data: p, error: pErr } = await supabase.from("playlists").select("*").eq("id", id).single();
      if (pErr || !p) { router.replace("/explore"); return; }
      if (p.user_id !== user.id) { router.replace(`/p/${id}`); return; }

      const { data: trows } = await supabase
        .from("playlist_tracks")
        .select("id, position, title, artist, youtube_video_id")
        .eq("playlist_id", id)
        .order("position", { ascending: true });

      if (!alive) return;

      setTitle(p.title ?? "");
      setDescription(p.description ?? "");
      setTags(Array.isArray(p.tags) ? p.tags : []);
      setIsPublic(typeof p.is_public === "boolean" ? p.is_public : true);
      setExistingCoverUrl(p.cover_url ?? "");
      setExistingCoverPath(p.cover_path ?? "");
      setAvgBpm(p.avg_bpm ?? "");
      setEnergy(p.energy ?? "");
      setClean(typeof p.clean === "boolean" ? p.clean : true);
      setKeys(Array.isArray(p.keys) ? p.keys : []);
      setTracks(
        (trows || []).length
          ? trows.map((t) => ({ title: t.title || "", artist: t.artist || "", youtubeUrl: t.youtube_video_id || "" }))
          : [emptyTrack()]
      );
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [id, router, supabase]);

  useEffect(() => {
    return () => { if (coverPreview) URL.revokeObjectURL(coverPreview); };
  }, [coverPreview]);

  function onPickCover(file) {
    if (!file) return;
    setCoverFile(file);
    setCoverPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
  }

  async function saveChanges(e) {
    e.preventDefault();
    setErr("");
    setSaving(true);

    try {
      const cleanTitle = title.trim();
      if (!cleanTitle) throw new Error("Title is required.");
      if (cleanTitle.length > 60) throw new Error("Title must be 60 characters or less.");

      const bpmNum = avgBpm === "" ? null : Number(avgBpm);
      const energyNum = energy === "" ? null : Number(energy);
      if (bpmNum !== null && (!Number.isFinite(bpmNum) || bpmNum < 40 || bpmNum > 220))
        throw new Error("Avg BPM must be between 40 and 220.");
      if (energyNum !== null && (!Number.isFinite(energyNum) || energyNum < 0 || energyNum > 10))
        throw new Error("Energy must be between 0 and 10.");

      const keysArr = (keys || []).map((k) => String(k).trim().toUpperCase()).filter(Boolean).slice(0, 4);

      const normTracks = tracks
        .map((t) => ({
          title: String(t?.title || "").trim(),
          artist: String(t?.artist || "").trim(),
          youtubeUrl: String(t?.youtubeUrl || "").trim(),
        }))
        .filter((t) => t.title || t.artist || t.youtubeUrl);

      if (!normTracks.length) throw new Error("Add at least 1 track.");

      const toInsert = normTracks.map((t, idx) => {
        const yid = parseYouTubeId(t.youtubeUrl);
        if (!yid) throw new Error(`Track #${idx + 1} needs a valid YouTube link or video id.`);
        return { playlist_id: id, position: idx + 1, title: t.title || `Track ${idx + 1}`, artist: t.artist || null, youtube_video_id: yid };
      });

      // Upload new cover if picked
      let cover_url = existingCoverUrl || null;
      let cover_path = existingCoverPath || null;

      if (coverFile) {
        // remove old cover from storage
        if (existingCoverPath) {
          await supabase.storage.from(COVERS_BUCKET).remove([existingCoverPath]);
        }
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData?.user?.id;
        const ext = (coverFile.name.split(".").pop() || "jpg").toLowerCase();
        cover_path = `${uid}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(COVERS_BUCKET).upload(cover_path, coverFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: coverFile.type || "image/jpeg",
        });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(COVERS_BUCKET).getPublicUrl(cover_path);
        cover_url = pub?.publicUrl || null;
      }

      // Update playlist
      const { error: upErr } = await supabase
        .from("playlists")
        .update({
          title: cleanTitle,
          description: description.trim() || null,
          tags: (tags || []).slice(0, 10).map((t) => String(t).trim().toLowerCase()).filter(Boolean),
          is_public: isPublic,
          avg_bpm: bpmNum,
          energy: energyNum,
          clean,
          keys: keysArr,
          youtube_video_id: toInsert[0]?.youtube_video_id || null,
          cover_url,
          cover_path,
        })
        .eq("id", id);
      if (upErr) throw upErr;

      // Replace tracks
      const { error: delErr } = await supabase.from("playlist_tracks").delete().eq("playlist_id", id);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase.from("playlist_tracks").insert(toInsert);
      if (insErr) throw insErr;

      router.replace(`/p/${id}`);
    } catch (e2) {
      setErr(e2?.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full px-4 py-2.5 rounded-xl bg-transparent border text-white outline-none text-sm placeholder-white/30";
  const borderStyle = { borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" };
  const cardStyle = {
    borderColor: "color-mix(in srgb, var(--line) 70%, transparent)",
    background: "color-mix(in srgb, var(--midnight) 80%, transparent)",
  };

  const savedTracksCount = tracks.filter((t) => t.title.trim() || t.youtubeUrl.trim()).length;
  const displayCover = coverPreview || existingCoverUrl;

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-10">
        <div className="rounded-2xl border p-8 text-white/40 text-center" style={cardStyle}>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-10 pb-32">

      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: "var(--gold)" }}>
            The Queue
          </div>
          <h1 className="text-3xl font-semibold text-white">Edit Playlist</h1>
          <p className="text-white/50 mt-1 text-sm">Update details, tracks, and cover.</p>
        </div>
        <Link
          href={`/p/${id}`}
          className="text-sm flex-shrink-0 mt-1"
          style={{ color: "var(--muted)" }}
        >
          Cancel
        </Link>
      </div>

      <form onSubmit={saveChanges} className="space-y-5">

        {/* ── Section 1: Cover + Basics ──────────────────────────────────── */}
        <div className="rounded-2xl border p-6 grid md:grid-cols-[160px_1fr] gap-6" style={cardStyle}>
          {/* Cover */}
          <div>
            <div
              className="aspect-square rounded-xl border overflow-hidden flex items-center justify-center"
              style={borderStyle}
            >
              {displayCover ? (
                <img src={displayCover} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center px-3">
                  <div className="text-2xl text-white/20 mb-1">♫</div>
                  <div className="text-xs text-white/40">No cover</div>
                </div>
              )}
            </div>
            <label
              className="mt-3 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border text-xs text-white/70 cursor-pointer hover:text-white transition"
              style={borderStyle}
            >
              {coverFile ? "Change" : displayCover ? "Replace cover" : "Upload cover"}
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
                Undo change
              </button>
            )}
          </div>

          {/* Basics */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-white">
                  Title <span style={{ color: "var(--gold)" }}>*</span>
                </label>
                <span className="text-xs text-white/30">{title.length}/60</span>
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Playlist title"
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
                placeholder="What's the vibe?"
                rows={3}
                className={`${inputCls} resize-none`}
                style={borderStyle}
              />
            </div>

            {/* Visibility + Clean */}
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
                style={{ ...borderStyle, color: "var(--muted)" }}
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
                  ? `${savedTracksCount} track${savedTracksCount !== 1 ? "s" : ""}`
                  : "No tracks yet"}
              </p>
            </div>
            <button
              type="button"
              className="px-4 py-2 rounded-full border text-sm transition"
              style={{ ...borderStyle, color: "white" }}
              onClick={() => setTracks((prev) => prev.length >= MAX_TRACKS ? prev : [...prev, emptyTrack()])}
            >
              + Add row
            </button>
          </div>

          <div className="space-y-2">
            {tracks.map((t, idx) => {
              const yid = parseYouTubeId(t.youtubeUrl);
              const hasUrl = t.youtubeUrl.trim().length > 0;
              return (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-white/25 text-xs w-5 text-right flex-shrink-0 select-none">
                    {idx + 1}
                  </span>

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
                      borderColor: hasUrl && !yid
                        ? "color-mix(in srgb, #f87171 60%, transparent)"
                        : yid
                        ? "color-mix(in srgb, var(--gold) 40%, transparent)"
                        : borderStyle.borderColor,
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => setTracks((prev) => {
                      const next = prev.filter((_, i) => i !== idx);
                      return next.length ? next : [emptyTrack()];
                    })}
                    className="text-white/25 hover:text-white/60 transition flex-shrink-0 text-lg leading-none px-1"
                    title="Remove"
                  >
                    x
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
              <span className="text-xs opacity-60">(optional)</span>
            </button>

            {showDjStats && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Avg BPM</label>
                  <input
                    value={String(avgBpm ?? "")}
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
                    value={String(energy ?? "")}
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
                          onClick={() => setKeys((prev) => {
                            const cur = Array.isArray(prev) ? prev : [];
                            if (cur.includes(k)) return cur.filter((x) => x !== k);
                            if (cur.length >= 4) return cur;
                            return [...cur, k];
                          })}
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
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {err && (
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{
              background: "color-mix(in srgb, #f87171 10%, transparent)",
              border: "1px solid color-mix(in srgb, #f87171 40%, transparent)",
              color: "#fca5a5",
            }}
          >
            {err}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pb-4">
          <button type="submit" className="inBtn" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          <Link
            href={`/p/${id}`}
            className="px-5 py-2.5 rounded-full border text-sm transition"
            style={{ ...borderStyle, color: "var(--muted)" }}
          >
            Cancel
          </Link>
        </div>

      </form>
    </div>
  );
}
