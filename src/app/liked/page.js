"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";

function fmtHandle(h) {
  const v = String(h || "").trim();
  if (!v) return "@user";
  return v.startsWith("@") ? v : `@${v}`;
}

function fmtDate(d) {
  try {
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

export default function LikedPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [playlists, setPlaylists] = useState([]);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const { data: auth } = await supabase.auth.getUser();
        const u = auth?.user || null;

        if (!u) {
          router.replace("/login?next=/liked");
          return;
        }

        if (alive) setUser(u);

        // Get all playlist_ids the user has liked
        const { data: likeRows, error: likeErr } = await supabase
          .from("playlist_likes")
          .select("playlist_id, created_at")
          .eq("user_id", u.id)
          .order("created_at", { ascending: false });

        if (likeErr) throw likeErr;
        if (!likeRows?.length) {
          if (alive) { setPlaylists([]); setLoading(false); }
          return;
        }

        const ids = likeRows.map((r) => r.playlist_id);
        const likedAt = Object.fromEntries(likeRows.map((r) => [r.playlist_id, r.created_at]));

        // Fetch those playlists
        const { data: rows, error: plErr } = await supabase
          .from("playlists")
          .select("id, user_id, title, description, cover_url, tags, likes_count, owner_handle, created_at")
          .in("id", ids);

        if (plErr) throw plErr;

        // Fetch owner handles from profiles for any missing owner_handle
        const missingIds = (rows || [])
          .filter((r) => !r.owner_handle)
          .map((r) => r.user_id)
          .filter(Boolean);

        const handleMap = {};
        if (missingIds.length) {
          const { data: profRows } = await supabase
            .from("profiles")
            .select("id, handle, username")
            .in("id", missingIds);
          (profRows || []).forEach((p) => {
            handleMap[p.id] = p.handle || p.username || "";
          });
        }

        // Sort to match like order (most recently liked first)
        const sorted = (rows || []).sort(
          (a, b) => new Date(likedAt[b.id]) - new Date(likedAt[a.id])
        );

        const mapped = sorted.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          coverUrl: r.cover_url || "/placeholder-cover.png",
          tags: r.tags || [],
          likes: r.likes_count ?? 0,
          handle: fmtHandle(r.owner_handle || handleMap[r.user_id] || ""),
          rawHandle: (r.owner_handle || handleMap[r.user_id] || "").replace(/^@/, ""),
          likedAt: likedAt[r.id],
        }));

        if (alive) setPlaylists(mapped);
      } catch (err) {
        if (alive) setError(err?.message || "Could not load liked playlists.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [router, supabase]);

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Your Library
          </div>
          <h1 className="text-3xl font-semibold text-white mt-2">Liked Playlists</h1>
          <p className="text-white/60 mt-2">
            {loading ? "" : `${playlists.length} playlist${playlists.length === 1 ? "" : "s"}`}
          </p>
        </div>

        <Link
          href="/explore"
          className="px-4 py-2 rounded-full border text-sm flex-shrink-0"
          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
        >
          Discover more
        </Link>
      </div>

      {loading ? (
        <div
          className="rounded-2xl border p-8 text-white/60 text-center"
          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
        >
          Loading…
        </div>
      ) : error ? (
        <div className="rounded-2xl border p-8 text-red-300 text-center"
          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
        >
          {error}
        </div>
      ) : playlists.length === 0 ? (
        <div
          className="rounded-2xl border p-12 text-center"
          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
        >
          <div className="text-4xl mb-4">♥</div>
          <div className="text-white font-semibold text-lg">No liked playlists yet</div>
          <p className="text-white/50 text-sm mt-2 mb-6">
            Hit the heart on any playlist to save it here.
          </p>
          <Link href="/explore" className="inBtn">
            Browse playlists
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {playlists.map((p) => (
            <div
              key={p.id}
              className="card overflow-hidden hover:-translate-y-0.5 transition"
            >
              <Link href={`/p/${p.id}`} className="block">
                <div className="relative">
                  <img
                    src={p.coverUrl}
                    alt=""
                    className="w-full object-cover"
                    style={{ height: 170 }}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(e) => { e.currentTarget.src = "/placeholder-cover.png"; }}
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 p-3"
                    style={{ background: "linear-gradient(to top, rgba(0,0,0,0.78), transparent)" }}
                  >
                    <div className="font-semibold leading-tight truncate">{p.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>♥ {p.likes}</div>
                  </div>
                </div>
              </Link>

              <div className="p-4">
                {p.rawHandle && (
                  <Link href={`/u/${p.rawHandle}`} className="text-xs hover:underline" style={{ color: "var(--muted)" }}>
                    @{p.rawHandle}
                  </Link>
                )}
                {p.description ? (
                  <div className="text-sm text-white/70 line-clamp-2 mt-1">{p.description}</div>
                ) : (
                  <div className="text-sm text-white/30 mt-1">No description.</div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {p.tags.slice(0, 4).map((t) => (
                    <Link
                      key={t}
                      href={`/explore?tags=${encodeURIComponent(String(t).toLowerCase())}`}
                      className="px-2.5 py-1 rounded-full border text-xs"
                      style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                    >
                      #{t}
                    </Link>
                  ))}
                </div>

                <div className="mt-3 text-xs text-white/30">
                  Liked {fmtDate(p.likedAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
