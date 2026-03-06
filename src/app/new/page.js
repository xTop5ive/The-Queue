"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import TagInput from "@/components/TagInput";

export default function NewPlaylistPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  // cover upload (UI only)
  const [coverFile, setCoverFile] = useState(null);
  const coverPreview = useMemo(() => {
    if (!coverFile) return "";
    return URL.createObjectURL(coverFile);
  }, [coverFile]);

  function onPickCover(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setCoverFile(f);
  }

  function removeCover() {
    setCoverFile(null);
  }

  // tags (UI only)
  const [tags, setTags] = useState([]);

  const canSubmit = title.trim().length >= 2;

  return (
    <div className="max-w-4xl mx-auto px-5 pt-10 pb-28">
      {/* Top nav */}
      <div className="mb-6 flex items-center justify-between">
        <Link href="/explore" className="text-sm underline text-white/70 hover:text-white">
          ← Back to Explore
        </Link>

      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
          <span className="w-2 h-2 rounded-full" style={{ background: "var(--gold)" }} />
          The Queue • Create Playlist
        </div>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight">New playlist</h1>
        <p className="text-white/60 mt-2 max-w-2xl">
          Add your title, vibe, tags, and a cover. Tracks come next.
        </p>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        {/* Cover card */}
        <div className="card p-5">
          <div className="text-sm font-semibold mb-3">Cover</div>

          <div
            className="rounded-2xl overflow-hidden border"
            style={{
              borderColor: "color-mix(in srgb, var(--line) 75%, transparent)",
              background: "color-mix(in srgb, var(--midnight) 85%, transparent)",
            }}
          >
            <div className="relative w-full" style={{ aspectRatio: "1 / 1" }}>
              {coverPreview ? (
                <img
                  src={coverPreview}
                  alt="cover preview"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-white/60">
                  <div className="text-center px-6">
                    <div className="text-sm font-semibold text-white/80">No cover yet</div>
                    <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                      Upload a square image (PNG/JPG)
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <label className="inBtn cursor-pointer">
              Upload cover
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={onPickCover}
              />
            </label>

            {coverFile && (
              <>
                <label
                  className="px-4 py-2 rounded-full border text-sm cursor-pointer"
                  style={{
                    borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                    background: "color-mix(in srgb, var(--midnight) 85%, transparent)",
                    color: "var(--fog)",
                  }}
                >
                  Change
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    className="hidden"
                    onChange={onPickCover}
                  />
                </label>

                <button
                  type="button"
                  onClick={removeCover}
                  className="px-4 py-2 rounded-full border text-sm"
                  style={{
                    borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                    color: "var(--fog)",
                  }}
                >
                  Remove
                </button>
              </>
            )}
          </div>

          <div className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
            Tip: covers look best at 1000×1000px.
          </div>
        </div>

        {/* Form card */}
        <div className="card p-6">
          <form
            action={`/new?created=1`}
            className="space-y-6"
          >
            {/* Title */}
            <div>
              <label className="block text-sm font-semibold mb-2">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Late Night Gold"
                className="w-full px-4 py-3 rounded-2xl border"
                style={{
                  background: "color-mix(in srgb, var(--midnight) 90%, transparent)",
                  borderColor: "color-mix(in srgb, var(--line) 85%, transparent)",
                  color: "var(--fog)",
                }}
              />
              <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                Keep it short and searchable. ({Math.min(title.length, 60)}/60)
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What’s the vibe? Who is this for?"
                rows={4}
                className="w-full px-4 py-3 rounded-2xl border resize-none"
                style={{
                  background: "color-mix(in srgb, var(--midnight) 90%, transparent)",
                  borderColor: "color-mix(in srgb, var(--line) 85%, transparent)",
                  color: "var(--fog)",
                }}
              />
            </div>

            {/* Tags */}
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold">Tags</label>
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  Add up to 10
                </span>
              </div>

              <div className="mt-3">
                <TagInput value={tags} onChange={setTags} />
              </div>

              {tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="px-3 py-1 rounded-full border text-sm"
                      style={{
                        borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                        background: "color-mix(in srgb, var(--midnight) 85%, transparent)",
                        color: "var(--fog)",
                      }}
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Visibility */}
            <div className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-4"
              style={{
                borderColor: "color-mix(in srgb, var(--line) 75%, transparent)",
                background: "color-mix(in srgb, var(--midnight) 88%, transparent)",
              }}
            >
              <div>
                <div className="text-sm font-semibold">Visibility</div>
                <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                  Public playlists show up in Explore.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPublic((v) => !v)}
                className="px-4 py-2 rounded-full border text-sm"
                style={{
                  borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                  background: isPublic
                    ? "color-mix(in srgb, var(--gold) 18%, transparent)"
                    : "color-mix(in srgb, var(--midnight) 85%, transparent)",
                  color: "var(--fog)",
                }}
              >
                {isPublic ? "Public" : "Private"}
              </button>
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={!canSubmit}
                className="inBtn disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Create playlist (demo)
              </button>

              <Link
                href="/explore"
                className="px-4 py-2 rounded-full border text-sm"
                style={{
                  borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                  color: "var(--fog)",
                }}
              >
                Cancel
              </Link>

              <div className="text-xs self-center ml-2" style={{ color: "var(--muted)" }}>
                Next: add tracks + real saving.
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Sticky demo footer (optional but looks premium for screenshots) */}
      <div
        className="fixed left-0 right-0 bottom-0 z-50"
        style={{
          background: "color-mix(in srgb, var(--midnight) 92%, black)",
          borderTop: "1px solid color-mix(in srgb, var(--line) 70%, transparent)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              Preview: {title.trim() ? title.trim() : "Untitled playlist"}
            </div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>
              {isPublic ? "Public" : "Private"} • {tags.length} tag{tags.length === 1 ? "" : "s"} • cover{" "}
              {coverFile ? "added" : "missing"}
            </div>
          </div>
          <Link href="/explore" className="text-sm underline text-white/70 hover:text-white">
            Back to Explore
          </Link>
        </div>
      </div>
    </div>
  );
}