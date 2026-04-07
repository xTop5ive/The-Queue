"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";

function fmtDate(d) {
  try {
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

export default function MyPlaylistsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [playlists, setPlaylists] = useState([]);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // "all" | "public" | "private"

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const { data: auth } = await supabase.auth.getUser();
        const u = auth?.user || null;

        if (!u) {
          router.replace("/login?next=/playlists");
          return;
        }

        if (alive) setUser(u);

        const { data: rows, error: plErr } = await supabase
          .from("playlists")
          .select("id, title, description, cover_url, tags, likes_count, is_public, created_at")
          .eq("user_id", u.id)
          .order("created_at", { ascending: false });

        if (plErr) throw plErr;

        const mapped = (rows || []).map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          coverUrl: r.cover_url || "/placeholder-cover.png",
          tags: r.tags || [],
          likes: r.likes_count ?? 0,
          isPublic: r.is_public ?? true,
          createdAt: r.created_at,
        }));

        if (alive) setPlaylists(mapped);
      } catch (err) {
        if (alive) setError(err?.message || "Could not load playlists.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [router, supabase]);

  const filtered = playlists.filter((p) => {
    if (filter === "public") return p.isPublic;
    if (filter === "private") return !p.isPublic;
    return true;
  });

  const publicCount = playlists.filter((p) => p.isPublic).length;
  const privateCount = playlists.filter((p) => !p.isPublic).length;

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Your Library
          </div>
          <h1 className="text-3xl font-semibold text-white mt-2">My Playlists</h1>
          <p className="text-white/60 mt-2">
            {loading ? "" : `${playlists.length} playlist${playlists.length === 1 ? "" : "s"} • ${publicCount} public • ${privateCount} private`}
          </p>
        </div>

        <Link href="/new" className="inBtn flex-shrink-0">
          + New Playlist
        </Link>
      </div>

      {/* Filter tabs */}
      {!loading && playlists.length > 0 && (
        <div className="flex gap-2 mb-6">
          {[
            { key: "all", label: `All (${playlists.length})` },
            { key: "public", label: `Public (${publicCount})` },
            { key: "private", label: `Private (${privateCount})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className="px-4 py-2 rounded-full border text-sm transition"
              style={{
                borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                background: filter === tab.key ? "color-mix(in srgb, var(--gold) 18%, transparent)" : "transparent",
                color: "white",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div
          className="rounded-2xl border p-8 text-white/60 text-center"
          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
        >
          Loading…
        </div>
      ) : error ? (
        <div
          className="rounded-2xl border p-8 text-red-300 text-center"
          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
        >
          {error}
        </div>
      ) : playlists.length === 0 ? (
        <div
          className="rounded-2xl border p-12 text-center"
          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
        >
          <div className="text-4xl mb-4">🎵</div>
          <div className="text-white font-semibold text-lg">No playlists yet</div>
          <p className="text-white/50 text-sm mt-2 mb-6">
            Create your first playlist and start building your library.
          </p>
          <Link href="/new" className="inBtn">
            Create a playlist
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-2xl border p-8 text-white/50 text-center"
          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
        >
          No {filter} playlists.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div key={p.id} className="card overflow-hidden hover:-translate-y-0.5 transition">
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
                  {/* Public / Private badge */}
                  <div className="absolute top-3 right-3">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: p.isPublic
                          ? "color-mix(in srgb, var(--gold) 25%, black)"
                          : "rgba(0,0,0,0.6)",
                        color: p.isPublic ? "color-mix(in srgb, var(--gold) 90%, white)" : "rgba(255,255,255,0.5)",
                        border: "1px solid",
                        borderColor: p.isPublic
                          ? "color-mix(in srgb, var(--gold) 50%, transparent)"
                          : "rgba(255,255,255,0.15)",
                      }}
                    >
                      {p.isPublic ? "Public" : "Private"}
                    </span>
                  </div>
                  <div
                    className="absolute inset-x-0 bottom-0 p-3"
                    style={{ background: "linear-gradient(to top, rgba(0,0,0,0.78), transparent)" }}
                  >
                    <div className="font-semibold leading-tight truncate">{p.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                      ♥ {p.likes}
                    </div>
                  </div>
                </div>
              </Link>

              <div className="p-4">
                {p.description ? (
                  <div className="text-sm text-white/70 line-clamp-2">{p.description}</div>
                ) : (
                  <div className="text-sm text-white/30">No description.</div>
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

                <div className="mt-3 flex items-center justify-between">
                  <div className="text-xs text-white/30">{fmtDate(p.createdAt)}</div>
                  <Link
                    href={`/p/${p.id}/edit`}
                    className="text-xs text-white/40 hover:text-white/80 transition"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
