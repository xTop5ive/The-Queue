"use client";

import Link from "next/link";

export default function Playlist({ p }) {
  // supports either "p" object or being called without props (won't crash)
  if (!p) return null;

  return (
    <Link
      href={p.href || `/p/${p.id || ""}`}
      className="block rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition p-3"
    >
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/10 border border-white/10 flex-shrink-0">
          {p.cover ? (
            // using <img> so you don't have to configure next/image domains yet
            <img
              src={p.cover}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full grid place-items-center text-xs text-white/50">
              no cover
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{p.title || "Untitled playlist"}</div>
          <div className="text-sm text-white/60 truncate">
            by {p.creator || p.handle || "@creator"}
          </div>

          {!!p.tags?.length && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.tags.slice(0, 4).map((t) => (
                <span
                  key={t}
                  className="text-xs px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-white/80"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="text-sm text-white/70 flex items-center gap-1">
          <span aria-hidden>♥</span>
          <span>{p.likes ?? 0}</span>
        </div>
      </div>
    </Link>
  );
}