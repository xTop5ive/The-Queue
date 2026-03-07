// THIS FILE IS NOW A CLIENT COMPONENT, implementing real likes and correct handle display.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function fmtDate(d) {
  try {
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

function fmtHandle(h) {
  const v = (h || "").trim();
  if (!v) return "@unknown";
  return v.startsWith("@") ? v : `@${v}`;
}

async function resolveOwnerHandle({ supabase, playlistUserId, viewerUser }) {
  // 1) If viewer owns the playlist, we can use their auth metadata (client-safe).
  if (viewerUser?.id && playlistUserId && viewerUser.id === playlistUserId) {
    const raw =
      viewerUser?.user_metadata?.handle ||
      viewerUser?.user_metadata?.username ||
      viewerUser?.email?.split("@")[0] ||
      "user";
    return fmtHandle(raw);
  }

  // 2) Best-effort: if you have a public `profiles` table with a `handle` column, use it.
  //    (If it doesn't exist, we fall back quietly.)
  try {
    if (playlistUserId) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("handle, username")
        .eq("id", playlistUserId)
        .maybeSingle();

      const raw = prof?.handle || prof?.username;
      if (raw) return fmtHandle(raw);
    }
  } catch {
    // ignore
  }

  // 3) Fallback
  return "@user";
}

export default function PlaylistPage() {
  const params = useParams();
  const router = useRouter();
  const sp = useSearchParams();

  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const supabase = useMemo(() => getSupabase(), []);

  const [loading, setLoading] = useState(true);
  const [p, setP] = useState(null);
  const [moreBy, setMoreBy] = useState([]);
  const [shareUrl, setShareUrl] = useState("");

  const [ownerHandle, setOwnerHandle] = useState("@user");

  const [user, setUser] = useState(null);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [likeBusy, setLikeBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const likedQP = sp?.get("liked") === "1";

  // demo comments (stub)
  const comments = useMemo(
    () => [
      { id: "c1", user: "@dj5ive", text: "This playlist is insane. The transitions are clean.", time: "2h" },
      { id: "c2", user: "@lateNightVibes", text: "Need a part 2 of this one.", time: "5h" },
      { id: "c3", user: "@austinlinks", text: "Perfect for a night drive downtown.", time: "1d" },
    ],
    []
  );

  const refreshLikeState = useCallback(
    async (playlistId, currentUserId) => {
      // likesCount
      const { count } = await supabase
        .from("playlist_likes")
        .select("id", { count: "exact", head: true })
        .eq("playlist_id", playlistId);

      setLikesCount(typeof count === "number" ? count : 0);

      if (!currentUserId) {
        setLiked(false);
        return;
      }

      const { data: likeRow } = await supabase
        .from("playlist_likes")
        .select("id")
        .eq("playlist_id", playlistId)
        .eq("user_id", currentUserId)
        .maybeSingle();

      setLiked(!!likeRow);
    },
    [supabase]
  );

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        // Share URL (client)
        if (typeof window !== "undefined" && id) {
          setShareUrl(`${window.location.origin}/p/${id}`);
        }

        // Auth user
        const { data: auth } = await supabase.auth.getUser();
        const u = auth?.user || null;
        if (alive) setUser(u);

        // Playlist
        const { data: row, error } = await supabase.from("playlists").select("*").eq("id", id).single();
        if (error || !row) {
          // keep it simple: bounce to explore
          router.replace("/explore");
          return;
        }

        // normalize field names so the rest of the UI can stay the same
        const normalized = {
          ...row,
          coverUrl: row.cover_url ?? row.coverUrl,
          createdAt: row.created_at ?? row.createdAt,
          isPublic: row.is_public ?? row.isPublic,
          likes: row.likes_count ?? row.likes ?? 0,
          // NOTE: playlists table uses `user_id` as the owner
          userId: row.user_id ?? row.userId,
        };

        if (alive) setP(normalized);

        // Resolve and store display handle
        const resolved = await resolveOwnerHandle({
          supabase,
          playlistUserId: normalized.userId,
          viewerUser: u,
        });
        if (alive) setOwnerHandle(resolved);

        // More by creator (use `user_id` since playlists table doesn't store owner_handle)
        const ownerId = normalized.userId;
        if (ownerId) {
          const { data: rows } = await supabase
            .from("playlists")
            .select("*")
            .eq("user_id", ownerId)
            .neq("id", normalized.id)
            .eq("is_public", true)
            .limit(6);

          const mapped = (rows || []).map((r) => ({
            ...r,
            coverUrl: r.cover_url ?? r.coverUrl,
            createdAt: r.created_at ?? r.createdAt,
            isPublic: r.is_public ?? r.isPublic,
            likes: r.likes_count ?? r.likes ?? 0,
            userId: r.user_id ?? r.userId,
          }));

          if (alive) setMoreBy(mapped);
        } else {
          if (alive) setMoreBy([]);
        }

        // Real likes
        await refreshLikeState(row.id, u?.id);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id, router, supabase, refreshLikeState]);

  useEffect(() => {
    // if someone uses the old demo toggle, keep UI in sync but prefer real likes
    if (likedQP) setLiked(true);
  }, [likedQP]);

  async function toggleLike() {
    if (!p?.id) return;
    if (!user?.id) {
      router.push(`/login?next=${encodeURIComponent(`/p/${p.id}`)}`);
      return;
    }

    if (likeBusy) return;
    setLikeBusy(true);

    try {
      if (liked) {
        // unlike
        await supabase.from("playlist_likes").delete().eq("playlist_id", p.id).eq("user_id", user.id);
      } else {
        // like
        await supabase.from("playlist_likes").insert({ playlist_id: p.id, user_id: user.id });
      }

      // re-count + store on playlists for fast reads elsewhere
      const { count } = await supabase
        .from("playlist_likes")
        .select("id", { count: "exact", head: true })
        .eq("playlist_id", p.id);

      const newCount = typeof count === "number" ? count : 0;
      setLikesCount(newCount);
      setLiked((v) => !v);

      // best-effort update (ignore errors if RLS blocks)
      await supabase.from("playlists").update({ likes_count: newCount }).eq("id", p.id);

      // keep local row in sync
      setP((prev) => (prev ? { ...prev, likes: newCount } : prev));
    } finally {
      setLikeBusy(false);
    }
  }

  async function deletePlaylist() {
    if (!p?.id) return;

    // must be logged in
    if (!user?.id) {
      router.push(`/login?next=${encodeURIComponent(`/p/${p.id}`)}`);
      return;
    }

    // must own the playlist (DB uses user_id)
    const ownerId = p.userId ?? p.user_id;
    if (!ownerId || ownerId !== user.id) {
      alert("You can only delete playlists you created.");
      return;
    }

    const ok = confirm(`Delete "${p.title}"? This cannot be undone.`);
    if (!ok) return;

    if (deleteBusy) return;
    setDeleteBusy(true);

    try {
      // 1) delete cover from Storage (best-effort)
      const bucket = "covers"; // case-sensitive
      const coverPath = p.cover_path ?? p.coverPath ?? null;
      if (coverPath) {
        await supabase.storage.from(bucket).remove([coverPath]);
      }

      // 2) delete likes rows (best-effort)
      await supabase.from("playlist_likes").delete().eq("playlist_id", p.id);

      // 3) delete playlist row (owner-only)
      const { error } = await supabase
        .from("playlists")
        .delete()
        .eq("id", p.id)
        .eq("user_id", user.id);

      if (error) throw error;

      // 4) back to explore
      router.replace("/explore");
    } catch (e) {
      alert(e?.message || "Could not delete playlist.");
    } finally {
      setDeleteBusy(false);
    }
  }

  if (loading || !p) {
    return (
      <div className="max-w-6xl mx-auto px-5 pt-10 pb-28">
        <div className="card p-6 text-white/70">Loading playlist…</div>
      </div>
    );
  }

  const handle = ownerHandle;

  return (
    <div className="max-w-6xl mx-auto px-5 pt-10 pb-28">
      {/* Top nav */}
      <div className="mb-6 flex items-center justify-between">
        <Link href="/explore" className="text-sm underline text-white/70 hover:text-white">
          ← Back to Explore
        </Link>
        <div className="text-xs text-white/50">Updated {fmtDate(p.createdAt)}</div>
      </div>

      {/* Hero */}
      <div className="card overflow-hidden">
        <div className="grid md:grid-cols-[280px_1fr] gap-0">
          {/* Cover */}
          <div className="relative">
            <img
              src={p.coverUrl || "/placeholder-cover.png"}
              alt=""
              className="w-full object-cover"
              style={{ height: 280 }}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0.08))" }}
            />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                <span className="w-2 h-2 rounded-full" style={{ background: "var(--gold)" }} />
                The Queue • Playlist
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="p-6 md:p-7">
            <div className="text-xs tracking-wide uppercase" style={{ color: "var(--muted)" }}>
              Playlist
            </div>

            <h1 className="mt-2 text-4xl md:text-5xl font-semibold tracking-tight">{p.title}</h1>

            <p className="mt-3 text-white/70 max-w-2xl">{p.description}</p>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-white/80">
                by <span style={{ color: "var(--gold)" }}>{handle}</span>
              </span>
              <span className="text-white/40">•</span>
              <span className="text-white/70">♥ {likesCount || p.likes || 0} likes</span>
              <span className="text-white/40">•</span>
              <span className="text-white/70">{(p.tags || []).length} tags</span>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button className="inBtn" type="button">
                ▶ Play (demo)
              </button>

              {/* Like (REAL) */}
              <button
                type="button"
                onClick={toggleLike}
                className="px-4 py-2 rounded-full border text-sm inline-flex items-center gap-2"
                disabled={likeBusy}
                style={{
                  borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                  background: liked
                    ? "color-mix(in srgb, var(--gold) 18%, transparent)"
                    : "color-mix(in srgb, var(--midnight) 85%, transparent)",
                  color: "var(--fog)",
                  opacity: likeBusy ? 0.7 : 1,
                }}
                aria-label={liked ? "Unlike" : "Like"}
              >
                <span aria-hidden>{liked ? "♥" : "♡"}</span>
                <span>{liked ? "Liked" : "Like"}</span>
              </button>

              {/* Share (no JS): mail + tweet */}
              <a
                href={`mailto:?subject=${encodeURIComponent(`The Queue • ${p.title}`)}&body=${encodeURIComponent(shareUrl)}`}
                className="px-4 py-2 rounded-full border text-sm inline-flex items-center gap-2"
                style={{
                  borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                  background: "transparent",
                }}
              >
                <span aria-hidden>↗</span>
                Share
              </a>

              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Listening to ${p.title} on The Queue`)}&url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-full border text-sm inline-flex items-center gap-2"
                style={{
                  borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                  background: "transparent",
                }}
              >
                <span aria-hidden>✦</span>
                Post
              </a>

              <button
                type="button"
                className="px-4 py-2 rounded-full border text-sm"
                style={{
                  borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                  background: "color-mix(in srgb, var(--midnight) 85%, transparent)",
                  color: "var(--fog)",
                }}
              >
                + Save (stub)
              </button>

              {(p.userId ?? p.user_id) === user?.id ? (
                <button
                  type="button"
                  onClick={deletePlaylist}
                  disabled={deleteBusy}
                  className="px-4 py-2 rounded-full border text-sm"
                  style={{
                    borderColor: "color-mix(in srgb, #ff4d4d 55%, transparent)",
                    background: "color-mix(in srgb, #ff4d4d 12%, transparent)",
                    color: "white",
                    opacity: deleteBusy ? 0.7 : 1,
                  }}
                >
                  {deleteBusy ? "Deleting…" : "Delete"}
                </button>
              ) : null}

              <Link
                href="/explore"
                className="px-4 py-2 rounded-full border text-sm"
                style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
              >
                Browse more
              </Link>
            </div>

            {/* Share URL (for demo screenshots) */}
            <div className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
              Share link: <span className="underline break-all">{shareUrl}</span>
            </div>

            {/* Tags */}
            <div className="mt-5 flex flex-wrap gap-2">
              {(p.tags || []).slice(0, 10).map((t) => (
                <Link
                  key={t}
                  href={`/explore?tags=${encodeURIComponent(String(t).toLowerCase())}`}
                  className="px-3 py-1 rounded-full border text-sm"
                  style={{
                    background: "transparent",
                    borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                  }}
                >
                  #{t}
                </Link>
              ))}
            </div>

            {/* Tracks stub */}
            <div className="mt-7">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Tracks</h2>
                <span className="text-sm text-white/50">Coming next</span>
              </div>

              <div
                className="mt-3 border rounded-xl overflow-hidden"
                style={{ borderColor: "color-mix(in srgb, var(--line) 75%, transparent)" }}
              >
                {["Intro (stub)", "Main vibe (stub)", "Closer (stub)"].map((name, idx) => (
                  <div
                    key={name}
                    className="flex items-center justify-between px-4 py-3"
                    style={{
                      background: idx % 2 ? "color-mix(in srgb, var(--midnight) 92%, transparent)" : "transparent",
                      borderTop:
                        idx === 0 ? "none" : "1px solid color-mix(in srgb, var(--line) 70%, transparent)",
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-white/40 w-6 text-right">{idx + 1}</span>
                      <div className="min-w-0">
                        <div className="truncate">{name}</div>
                        <div className="text-xs" style={{ color: "var(--muted)" }}>
                          Artist name • 2:34
                        </div>
                      </div>
                    </div>
                    <span className="text-white/50 text-sm">⋯</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* More by creator */}
      <div className="mt-10">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold">More by {handle}</h2>
            <p className="text-white/60 text-sm mt-1">More public playlists from this creator.</p>
          </div>
          <Link href="/explore" className="text-sm underline text-white/70 hover:text-white">
            See all
          </Link>
        </div>

        {moreBy.length ? (
          <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {moreBy.map((m) => (
              <div key={m.id} className="card overflow-hidden">
                <Link href={`/p/${m.id}`} className="block">
                  <div className="relative">
                    <img
                      src={m.coverUrl}
                      alt=""
                      className="w-full object-cover"
                      style={{ height: 160 }}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <div
                      className="absolute inset-x-0 bottom-0 p-3"
                      style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}
                    >
                      <div className="font-semibold leading-tight">{m.title}</div>
                      <div className="text-xs" style={{ color: "var(--muted)" }}>
                        ♥ {m.likes}
                      </div>
                    </div>
                  </div>
                </Link>

                <div className="p-4">
                  <div className="text-sm text-white/70 line-clamp-2">{m.description}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(m.tags || []).slice(0, 4).map((t) => (
                      <span
                        key={`${m.id}-${t}`}
                        className="px-2.5 py-1 rounded-full border text-xs"
                        style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-6 mt-4">
            <p className="text-white/60">No other public playlists yet.</p>
          </div>
        )}
      </div>

      {/* Comments stub */}
      <div className="mt-10">
        <h2 className="text-2xl font-semibold">Comments</h2>
        <p className="text-white/60 text-sm mt-1">Community reactions (UI stub).</p>

        <div className="card p-5 mt-4">
          <form action="#" className="flex gap-2">
            <input
              placeholder="Add a comment… (stub)"
              className="w-full px-4 py-2 rounded-full border"
              style={{
                background: "color-mix(in srgb, var(--midnight) 90%, transparent)",
                borderColor: "color-mix(in srgb, var(--line) 85%, transparent)",
                color: "var(--fog)",
              }}
            />
            <button className="inBtn" type="button">
              Post
            </button>
          </form>

          <div className="mt-5 space-y-4">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <div
                  className="w-10 h-10 rounded-full border flex-shrink-0"
                  style={{
                    borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                    background: "color-mix(in srgb, var(--midnight) 85%, transparent)",
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{c.user}</span>
                    <span className="text-white/40 text-xs">•</span>
                    <span className="text-white/50 text-xs">{c.time}</span>
                  </div>
                  <div className="text-white/80 text-sm mt-1">{c.text}</div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-white/50">
                    <button type="button" className="hover:text-white/70">
                      Like
                    </button>
                    <button type="button" className="hover:text-white/70">
                      Reply
                    </button>
                    <button type="button" className="hover:text-white/70">
                      Share
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky play bar (UI only) */}
      <div
        className="fixed left-0 right-0 bottom-0 z-50"
        style={{
          background: "color-mix(in srgb, var(--midnight) 92%, black)",
          borderTop: "1px solid color-mix(in srgb, var(--line) 70%, transparent)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-12 h-12 rounded-lg overflow-hidden border flex-shrink-0"
              style={{ borderColor: "color-mix(in srgb, var(--line) 75%, transparent)" }}
            >
              <img
                src={p.coverUrl || "/placeholder-cover.png"}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{p.title}</div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>
                Playing: Track 1 (stub) • {handle}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              className="px-4 py-2 rounded-full border text-sm"
              style={{
                borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                background: "color-mix(in srgb, var(--gold) 18%, transparent)",
              }}
            >
              ▶
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-full border text-sm"
              style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
            >
              ❚❚
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-full border text-sm"
              style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
            >
              ⏭
            </button>

            <div
              className="w-px h-7 mx-1"
              style={{ background: "color-mix(in srgb, var(--line) 70%, transparent)" }}
            />

            <button
              type="button"
              onClick={toggleLike}
              className="px-3 py-2 rounded-full border text-sm"
              style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
              aria-label={liked ? "Unlike" : "Like"}
              title={liked ? "Unlike" : "Like"}
            >
              {liked ? "♥" : "♡"}
            </button>

            <a
              href={`mailto:?subject=${encodeURIComponent(`The Queue • ${p.title}`)}&body=${encodeURIComponent(shareUrl)}`}
              className="px-3 py-2 rounded-full border text-sm"
              style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
              aria-label="Share"
              title="Share"
            >
              ↗
            </a>

            {(p.userId ?? p.user_id) === user?.id ? (
              <button
                type="button"
                onClick={deletePlaylist}
                disabled={deleteBusy}
                className="px-3 py-2 rounded-full border text-sm"
                style={{
                  borderColor: "color-mix(in srgb, #ff4d4d 55%, transparent)",
                  background: "transparent",
                  opacity: deleteBusy ? 0.7 : 1,
                }}
                aria-label="Delete playlist"
                title="Delete playlist"
              >
                🗑
              </button>
            ) : null}
          </div>
        </div>

        {/* Progress (stub) */}
        <div className="max-w-6xl mx-auto px-5 pb-3">
          <div className="h-1 rounded-full" style={{ background: "color-mix(in srgb, var(--line) 60%, transparent)" }}>
            <div className="h-1 rounded-full" style={{ width: "35%", background: "var(--gold)" }} />
          </div>
          <div className="mt-1 flex justify-between text-[11px]" style={{ color: "var(--muted)" }}>
            <span>0:42</span>
            <span>2:34</span>
          </div>
        </div>
      </div>
    </div>
  );
}