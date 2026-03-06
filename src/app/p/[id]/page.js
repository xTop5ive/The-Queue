import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DEMO_PLAYLISTS } from "@/lib/demoPlaylists";

function fmtDate(d) {
  try {
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

export default function PlaylistPage({ params, searchParams }) {
  const { id } = params;

  const p = DEMO_PLAYLISTS.find((x) => x.id === id);
  if (!p) return notFound();

  // Share URL (server-safe)
  const h = headers();
  const host = h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || "http";
  const shareUrl = `${proto}://${host}/p/${p.id}`;

  // Demo like toggle via query param (?liked=1)
  const liked = searchParams?.liked === "1";
  const likeHref = liked ? `/p/${p.id}` : `/p/${p.id}?liked=1`;

  const moreBy = DEMO_PLAYLISTS.filter(
    (x) => x.isPublic && x.handle === p.handle && x.id !== p.id
  ).slice(0, 6);

  // demo comments (stub)
  const comments = [
    { id: "c1", user: "@dj5ive", text: "This playlist is insane. The transitions are clean.", time: "2h" },
    { id: "c2", user: "@lateNightVibes", text: "Need a part 2 of this one.", time: "5h" },
    { id: "c3", user: "@austinlinks", text: "Perfect for a night drive downtown.", time: "1d" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-5 pt-10 pb-28">
      {/* Top nav */}
      <div className="mb-6 flex items-center justify-between">
        <Link href="/explore" className="text-sm underline text-white/70 hover:text-white">
          ← Back to Explore
        </Link>
        <div className="text-xs text-white/50">
          Updated {fmtDate(p.createdAt)}
        </div>
      </div>

      {/* Hero */}
      <div className="card overflow-hidden">
        <div className="grid md:grid-cols-[280px_1fr] gap-0">
          {/* Cover */}
          <div className="relative">
            <img
              src={p.coverUrl}
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

            <h1 className="mt-2 text-4xl md:text-5xl font-semibold tracking-tight">
              {p.title}
            </h1>

            <p className="mt-3 text-white/70 max-w-2xl">
              {p.description}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-white/80">
                by <span style={{ color: "var(--gold)" }}>{p.handle}</span>
              </span>
              <span className="text-white/40">•</span>
              <span className="text-white/70">♥ {p.likes} likes</span>
              <span className="text-white/40">•</span>
              <span className="text-white/70">{(p.tags || []).length} tags</span>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button className="inBtn" type="button">
                ▶ Play (demo)
              </button>

              {/* Like (demo toggle via query param) */}
              <Link
                href={likeHref}
                className="px-4 py-2 rounded-full border text-sm inline-flex items-center gap-2"
                style={{
                  borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                  background: liked
                    ? "color-mix(in srgb, var(--gold) 18%, transparent)"
                    : "color-mix(in srgb, var(--midnight) 85%, transparent)",
                  color: "var(--fog)",
                }}
                aria-label={liked ? "Unlike (demo)" : "Like (demo)"}
              >
                <span aria-hidden>{liked ? "♥" : "♡"}</span>
                <span>{liked ? "Liked" : "Like"}</span>
              </Link>

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

              <Link
                href="/explore"
                className="px-4 py-2 rounded-full border text-sm"
                style={{
                  borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                }}
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
                  href={`/explore?tags=${encodeURIComponent(t.toLowerCase())}`}
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

              <div className="mt-3 border rounded-xl overflow-hidden"
                style={{ borderColor: "color-mix(in srgb, var(--line) 75%, transparent)" }}
              >
                {["Intro (stub)", "Main vibe (stub)", "Closer (stub)"].map((name, idx) => (
                  <div
                    key={name}
                    className="flex items-center justify-between px-4 py-3"
                    style={{
                      background: idx % 2 ? "color-mix(in srgb, var(--midnight) 92%, transparent)" : "transparent",
                      borderTop: idx === 0 ? "none" : "1px solid color-mix(in srgb, var(--line) 70%, transparent)",
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
            <h2 className="text-2xl font-semibold">More by {p.handle}</h2>
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
            <p className="text-white/60">No other public playlists yet. (Demo data)</p>
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
                    <button type="button" className="hover:text-white/70">Like</button>
                    <button type="button" className="hover:text-white/70">Reply</button>
                    <button type="button" className="hover:text-white/70">Share</button>
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
            <div className="w-12 h-12 rounded-lg overflow-hidden border flex-shrink-0"
              style={{ borderColor: "color-mix(in srgb, var(--line) 75%, transparent)" }}
            >
              <img
                src={p.coverUrl}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{p.title}</div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>
                Playing: Track 1 (stub) • {p.handle}
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

            <div className="w-px h-7 mx-1" style={{ background: "color-mix(in srgb, var(--line) 70%, transparent)" }} />

            <Link
              href={likeHref}
              className="px-3 py-2 rounded-full border text-sm"
              style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
              aria-label={liked ? "Unlike (demo)" : "Like (demo)"}
              title={liked ? "Unlike (demo)" : "Like (demo)"}
            >
              {liked ? "♥" : "♡"}
            </Link>

            <a
              href={`mailto:?subject=${encodeURIComponent(`The Queue • ${p.title}`)}&body=${encodeURIComponent(shareUrl)}`}
              className="px-3 py-2 rounded-full border text-sm"
              style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
              aria-label="Share (demo)"
              title="Share (demo)"
            >
              ↗
            </a>
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