"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase-browser";
import TagInput from "@/components/TagInput";

// keep consistent with /new
const MAX_TRACKS = 500;

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
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) {
        const id = parts[embedIdx + 1];
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : "";
      }
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

  // form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState([]);

  const [avgBpm, setAvgBpm] = useState("");
  const [energy, setEnergy] = useState("");
  const [clean, setClean] = useState(true);
  const [keys, setKeys] = useState([]);

  const [tracks, setTracks] = useState([emptyTrack()]);

  // state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // load playlist + tracks
  useEffect(() => {
    let alive = true;

    (async () => {
      setErr("");
      setLoading(true);

      // must be logged in
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(`/p/${id}/edit`)}`);
        return;
      }

      // playlist
      const { data: p, error: pErr } = await supabase.from("playlists").select("*").eq("id", id).single();
      if (pErr || !p) {
        router.replace("/explore");
        return;
      }

      // owner gate
      if (p.user_id !== user.id) {
        router.replace(`/p/${id}`);
        return;
      }

      // tracks
      const { data: trows } = await supabase
        .from("playlist_tracks")
        .select("id, position, title, artist, youtube_video_id")
        .eq("playlist_id", id)
        .order("position", { ascending: true });

      if (!alive) return;

      setTitle(p.title ?? "");
      setDescription(p.description ?? "");
      setTags(Array.isArray(p.tags) ? p.tags : []);

      setAvgBpm(p.avg_bpm ?? "");
      setEnergy(p.energy ?? "");
      setClean(typeof p.clean === "boolean" ? p.clean : true);
      setKeys(Array.isArray(p.keys) ? p.keys : []);

      const seed = (trows || []).length
        ? (trows || []).map((t) => ({
            title: t.title || "",
            artist: t.artist || "",
            youtubeUrl: t.youtube_video_id || "",
          }))
        : [emptyTrack()];

      setTracks(seed);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [id, router, supabase]);

  async function saveChanges(e) {
    e.preventDefault();
    setErr("");
    setSaving(true);

    try {
      // validate basics
      const cleanTitle = title.trim();
      if (!cleanTitle) throw new Error("Title is required.");
      if (cleanTitle.length > 60) throw new Error("Title must be 60 characters or less.");

      const bpmNum = avgBpm === "" ? null : Number(avgBpm);
      const energyNum = energy === "" ? null : Number(energy);

      if (bpmNum !== null && (!Number.isFinite(bpmNum) || bpmNum < 40 || bpmNum > 220)) {
        throw new Error("Avg BPM must be between 40 and 220.");
      }
      if (energyNum !== null && (!Number.isFinite(energyNum) || energyNum < 0 || energyNum > 10)) {
        throw new Error("Energy must be between 0 and 10.");
      }

      const keysArr = (keys || [])
        .map((k) => String(k).trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 4);

      const normTracks = (tracks || [])
        .map((t) => ({
          title: String(t?.title || "").trim(),
          artist: String(t?.artist || "").trim(),
          youtubeUrl: String(t?.youtubeUrl || "").trim(),
        }))
        .filter((t) => t.title || t.artist || t.youtubeUrl);

      if (!normTracks.length) throw new Error("Add at least 1 track.");
      if (normTracks.length > MAX_TRACKS) throw new Error(`Too many tracks. Max ${MAX_TRACKS}.`);

      const toInsert = normTracks.map((t, idx) => {
        const yid = parseYouTubeId(t.youtubeUrl);
        if (!yid) throw new Error(`Track #${idx + 1} needs a valid YouTube link or 11-char id.`);
        return {
          playlist_id: id,
          position: idx + 1,
          title: t.title || `Track ${idx + 1}`,
          artist: t.artist || null,
          youtube_video_id: yid,
        };
      });

      const firstYoutubeId = toInsert[0]?.youtube_video_id || null;

      // 1) update playlist fields
      const { error: upErr } = await supabase
        .from("playlists")
        .update({
          title: cleanTitle,
          description: description.trim() || null,
          tags: (tags || []).slice(0, 10).map((t) => String(t).trim().toLowerCase()).filter(Boolean),
          avg_bpm: bpmNum,
          energy: energyNum,
          clean,
          keys: keysArr,
          youtube_video_id: firstYoutubeId,
        })
        .eq("id", id);

      if (upErr) throw upErr;

      // 2) replace tracks (simple + reliable)
      const { error: delErr } = await supabase.from("playlist_tracks").delete().eq("playlist_id", id);
      if (delErr) throw delErr;

      const { error: insErr } = await supabase.from("playlist_tracks").insert(toInsert);
      if (insErr) throw insErr;

      // done → back to playlist page
      router.replace(`/p/${id}`);
    } catch (e2) {
      setErr(e2?.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-5 py-10">
        <div className="card p-6 text-white/70">Loading edit form…</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Edit playlist</h1>
          <p className="text-white/60 mt-1">Update details, tags, and tracks.</p>
        </div>
        <Link href={`/p/${id}`} className="underline text-white/70 hover:text-white">
          Back to playlist
        </Link>
      </div>

      <form onSubmit={saveChanges} className="mt-6 card p-6 space-y-6">
        {/* Title */}
        <div>
          <label className="block text-white font-semibold">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-2 w-full px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
            style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
            maxLength={60}
          />
          <div className="mt-1 text-xs text-white/50">{title.length}/60</div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-white font-semibold">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-2 w-full px-4 py-3 rounded-xl bg-transparent border text-white outline-none min-h-[120px]"
            style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
          />
        </div>

        {/* Tags */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-white font-semibold">Tags</label>
            <div className="text-xs text-white/50">Up to 10</div>
          </div>
          <div className="mt-2">
            <TagInput value={tags} onChange={setTags} max={10} placeholder="Type a tag and press Enter" />
          </div>
        </div>

        {/* DJ stats */}
        <div className="rounded-xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}>
          <div className="text-white font-semibold">DJ stats (optional)</div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/60">Avg BPM</label>
              <input
                value={String(avgBpm ?? "")}
                onChange={(e) => setAvgBpm(e.target.value.replace(/[^0-9]/g, ""))}
                className="mt-2 w-full px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
                style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
              />
            </div>

            <div>
              <label className="block text-xs text-white/60">Energy (0–10)</label>
              <input
                value={String(energy ?? "")}
                onChange={(e) => setEnergy(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                className="mt-2 w-full px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
                style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
              />
            </div>

            <div className="sm:col-span-2 flex items-center justify-between rounded-xl border px-4 py-3"
              style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}>
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

        {/* Tracks */}
        <div className="rounded-xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-white font-semibold">Tracks</div>
              <div className="text-xs text-white/60">Add / remove songs. Uses YouTube links or video ids.</div>
            </div>
            <button
              type="button"
              className="px-4 py-2 rounded-full border text-sm"
              style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
              onClick={() => setTracks((prev) => (prev.length >= MAX_TRACKS ? prev : [...prev, emptyTrack()]))}
            >
              + Add track
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            {tracks.map((t, idx) => (
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
                      onClick={() =>
                        setTracks((prev) => {
                          const next = prev.filter((_, i) => i !== idx);
                          return next.length ? next : [emptyTrack()];
                        })
                      }
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
                          const cur = [...prev];
                          cur[idx] = { ...cur[idx], title: v };
                          return cur;
                        });
                      }}
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
                          const cur = [...prev];
                          cur[idx] = { ...cur[idx], artist: v };
                          return cur;
                        });
                      }}
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
                          const cur = [...prev];
                          cur[idx] = { ...cur[idx], youtubeUrl: v };
                          return cur;
                        });
                      }}
                      className="mt-2 w-full px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
                      style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                      placeholder="https://youtu.be/... or 11-char id"
                    />
                    {t.youtubeUrl.trim() ? (
                      parseYouTubeId(t.youtubeUrl) ? (
                        <div className="mt-2 text-[11px] text-white/60">OK</div>
                      ) : (
                        <div className="mt-2 text-[11px] text-red-300">Invalid YouTube link/id.</div>
                      )
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {err ? <div className="text-red-400 text-sm">{err}</div> : null}

        <div className="flex items-center gap-3">
          <button type="submit" className="inBtn" disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </button>
          <Link
            href={`/p/${id}`}
            className="px-4 py-2 rounded-full border text-white/80"
            style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}