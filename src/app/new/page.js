"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";
import TagInput from "@/components/TagInput"; // you created src/components/TagInput.js

const COVERS_BUCKET = "covers"; // must match your Supabase Storage bucket name exactly (case-sensitive)

export default function NewPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState([]);
  const [isPublic, setIsPublic] = useState(true);

  // DJ fields (optional)
  const [avgBpm, setAvgBpm] = useState("");
  const [energy, setEnergy] = useState("");
  const [clean, setClean] = useState(true);
  const [keys, setKeys] = useState([]); // e.g. ["8A", "9A"]

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

      // 2) validate
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

        const { error: upErr } = await supabase.storage
          .from(COVERS_BUCKET)
          .upload(cover_path, coverFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: coverFile.type || "image/jpeg",
          });

        if (upErr) throw upErr;

        // bucket is public (demo). If you made it private, we’d use signed URLs instead.
        const { data: pub } = supabase.storage.from(COVERS_BUCKET).getPublicUrl(cover_path);
        cover_url = pub?.publicUrl || null;
      }

      // 4) insert playlist row

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

      const payload = {
        user_id: user.id,

        // content
        title: cleanTitle,
        description: description.trim() || null,
        tags: (tags || []).slice(0, 10).map((t) => String(t).trim().toLowerCase()).filter(Boolean),
        is_public: isPublic,

        // DJ fields (optional)
        avg_bpm: bpmNum,
        energy: energyNum,
        clean,
        keys: keysArr,

        // cover
        cover_path,
        cover_url,

        // likes (start at 0 for real app)
        likes_count: 0,
      };

      const { data: inserted, error: insErr } = await supabase
        .from("playlists")
        .insert(payload)
        .select("id")
        .single();

      if (insErr) throw insErr;

      // If your DB has handle/owner_id, the detail page can now show “by @handle”
      // (and you can use owner_id later for permissions/RLS)

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

  return (
    <div className="max-w-5xl mx-auto px-5 py-10">
      <div className="text-white/70 mb-6">
        <h1 className="text-3xl font-semibold text-white">New playlist</h1>
        <p className="mt-1">Title, description, tags, cover. Tracks come next.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cover */}
        <div className="rounded-2xl border p-5"
          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)", background: "color-mix(in srgb, var(--midnight) 80%, transparent)" }}
        >
          <div className="text-white font-semibold mb-3">Cover</div>

          <div className="rounded-2xl border overflow-hidden aspect-square flex items-center justify-center"
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
        <div className="rounded-2xl border p-5"
          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)", background: "color-mix(in srgb, var(--midnight) 80%, transparent)" }}
        >
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

          <label className="block text-white font-semibold mt-5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What’s the vibe? Who is this for?"
            className="mt-2 w-full px-4 py-3 rounded-xl bg-transparent border text-white outline-none min-h-[120px]"
            style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
          />

          <div className="flex items-center justify-between mt-5">
            <label className="text-white font-semibold">Tags</label>
            <div className="text-xs text-white/50">Up to 10</div>
          </div>

          <div className="mt-2">
            <TagInput value={tags} onChange={setTags} max={10} placeholder="Type a tag and press Enter" />
          </div>

          {/* DJ filters (optional) */}
          <div className="mt-6 rounded-xl border px-4 py-4"
            style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-semibold">DJ stats (optional)</div>
                <div className="text-xs text-white/60">Helps people search by BPM, key, energy, and clean version.</div>
              </div>
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
                            if (cur.length >= 4) return cur; // limit
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
                        title={active ? `Remove ${k}` : `Add ${k}`}
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

              <div className="sm:col-span-2 flex items-center justify-between rounded-xl border px-4 py-3"
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

          <div className="mt-5 flex items-center justify-between rounded-xl border px-4 py-3"
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

          {error ? <div className="mt-4 text-red-400 text-sm">{error}</div> : null}

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

          <div className="mt-2 text-xs text-white/50">Next: add tracks + real likes.</div>
        </div>
      </form>
    </div>
  );
}