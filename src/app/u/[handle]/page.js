import Link from "next/link";
import Image from "next/image";
import { DEMO_PLAYLISTS } from "@/lib/demoPlaylists";;

export const dynamic = "force-dynamic";

function cleanHandle(raw) {
  if (!raw) return "";
  return raw.startsWith("@") ? raw : `@${raw}`;
}

export default async function ProfilePage({ params }) {
  const handleParam = params?.handle || "";
  const handle = cleanHandle(handleParam);

  const playlists = DEMO_PLAYLISTS
    .filter((p) => p.isPublic)
    .filter((p) => p.handle?.toLowerCase() === handle.toLowerCase());

  const totalLikes = playlists.reduce((sum, p) => sum + (p.likes || 0), 0);

  // basic “profile” info from demo data
  const displayName =
    playlists[0]?.displayName || handle.replace("@", "").replaceAll("-", " ");
  const avatarUrl = playlists[0]?.avatarUrl || "";

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">
      {/* top */}
      <div className="mb-6">
        <Link href="/explore" className="text-sm underline text-white/70 hover:text-white">
          ← Back to Explore
        </Link>
      </div>

      {/* header */}
      <div className="card p-6 mb-7">
        <div className="flex flex-col sm:flex-row gap-5 sm:items-center">
          {/* avatar */}
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-white/10 bg-white/5 flex-shrink-0 grid place-items-center">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" fill className="object-cover" unoptimized />
            ) : (
              <span className="text-lg font-semibold text-white/70">
                {handle.replace("@", "").slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-xs text-white/60">Creator</div>
            <h1 className="text-3xl font-semibold tracking-tight truncate">{displayName}</h1>
            <div className="mt-1 text-white/70">{handle}</div>

            <div className="mt-4 flex flex-wrap gap-2">
              <div className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-sm text-white/80">
                {playlists.length} public playlist{playlists.length === 1 ? "" : "s"}
              </div>
              <div className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-sm text-white/80">
                {totalLikes} total likes
              </div>
              <div className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-sm text-white/60">
                Bio: (demo)
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="inBtn">Follow (demo)</button>
            <button
              className="px-4 py-2 rounded-full border text-sm"
              style={{
                borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                color: "var(--fog)",
              }}
            >
              Share (demo)
            </button>
          </div>
        </div>
      </div>

      {/* playlists */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Playlists</h2>
          <p className="text-white/60 text-sm mt-1">
            Showing {playlists.length} result{playlists.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/new" className="inBtn">
          Collab
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {playlists.map((p) => (
          <div key={p.id} className="card p-4 transition hover:-translate-y-0.5 hover:border-white/20">
            <div className="flex gap-3">
              <Link
                href={`/p/${p.id}`}
                className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex-shrink-0"
              >
                {p.coverUrl ? (
                  <img
                    src={p.coverUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center text-[10px] text-white/60">
                    no cover
                  </div>
                )}
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/p/${p.id}`} className="font-semibold truncate block hover:underline">
                      {p.title}
                    </Link>
                    {p.description && (
                      <div className="text-sm text-white/60 line-clamp-2">{p.description}</div>
                    )}
                    <div className="text-xs text-white/50 mt-1">♥ {p.likes}</div>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(p.tags || []).slice(0, 6).map((t) => (
                    <Link
                      key={`${p.id}-${t}`}
                      href={`/explore?tags=${encodeURIComponent(t.toLowerCase())}`}
                      className="text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-white/80 hover:bg-white/15"
                    >
                      {t}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!playlists.length && (
        <div className="card p-8 mt-6">
          <h3 className="text-lg font-semibold">No public playlists yet</h3>
          <p className="text-white/60 mt-1">This creator doesn’t have public playlists in the demo data.</p>
          <div className="mt-4">
            <Link href="/explore" className="inBtn">
              Back to Explore
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}