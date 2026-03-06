import Link from "next/link";
import { DEMO_PLAYLISTS } from "@/lib/demoPlaylists";

function CardRow({ title, subtitle, items }) {
  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {subtitle ? <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{subtitle}</p> : null}
        </div>
        <Link href="/explore" className="text-sm underline text-white/70 hover:text-white">
          See all
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((p) => (
          <Link key={p.id} href={`/p/${p.id}`} className="card overflow-hidden hover:opacity-95 transition">
            <div className="relative">
              <img
                src={p.coverUrl}
                alt=""
                className="w-full object-cover"
                style={{ height: 140 }}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              <div
                className="absolute inset-x-0 bottom-0 p-3"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.72), transparent)" }}
              >
                <div className="font-semibold leading-tight truncate">{p.title}</div>
                <div className="text-xs truncate" style={{ color: "var(--muted)" }}>
                  by @{p.handle}
                </div>
              </div>
            </div>

            <div className="p-4">
              {p.description ? (
                <div className="text-sm text-white/70 line-clamp-2">{p.description}</div>
              ) : (
                <div className="text-sm text-white/50">No description yet.</div>
              )}

              <div className="mt-3 flex items-center justify-between">
                <div className="text-sm text-white/70">♥ {p.likes || 0}</div>
                <span className="text-sm underline text-white/80 hover:text-white">Open</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {(p.tags || []).slice(0, 4).map((t) => (
                  <span
                    key={`${p.id}-${t}`}
                    className="px-2.5 py-1 rounded-full border text-xs"
                    style={{
                      background: "transparent",
                      borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                      color: "var(--fog)",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function FriendsInRoom({ friends }) {
  return (
    <section className="mt-10">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Friends in the room</h2>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Live activity (demo).
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {friends.map((f) => (
          <div key={f.name} className="card p-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full grid place-items-center border"
                style={{
                  background: "color-mix(in srgb, var(--midnight) 85%, transparent)",
                  borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                  color: "var(--fog)",
                }}
                aria-hidden
              >
                {f.initials}
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{f.name}</div>
                <div className="text-xs truncate" style={{ color: "var(--muted)" }}>
                  listening now • {f.vibe}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm truncate">{f.playlistTitle}</div>
                <div className="text-xs truncate" style={{ color: "var(--muted)" }}>
                  by @{f.creator}
                </div>
              </div>
              <Link href={`/p/${f.playlistId}`} className="text-sm underline text-white/80 hover:text-white">
                Open
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  // only public for demo
  const all = (DEMO_PLAYLISTS || []).filter((p) => p.isPublic);

  // Home sections
  const tonight = all.slice(0, 4); // curated / first 4
  const hot = [...all].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 4);
  const newest = [...all]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  // fake friend activity pulling from existing playlists
  const friends = [
    { name: "Kharmiyah", initials: "K", vibe: "late-night", pick: hot[0] || tonight[0] },
    { name: "Rochelle", initials: "R", vibe: "afrobeats", pick: hot[1] || tonight[1] },
    { name: "Jada", initials: "J", vibe: "R&B", pick: newest[0] || tonight[2] },
    { name: "Malik", initials: "M", vibe: "party", pick: newest[1] || tonight[3] },
    { name: "Trey", initials: "T", vibe: "trap", pick: hot[2] || newest[2] },
    { name: "Nia", initials: "N", vibe: "vibes", pick: hot[3] || newest[3] },
  ]
    .filter((f) => f.pick)
    .map((f) => ({
      name: f.name,
      initials: f.initials,
      vibe: f.vibe,
      playlistId: f.pick.id,
      playlistTitle: f.pick.title,
      creator: f.pick.handle,
    }));

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">
      {/* HERO */}
      <div className="card p-7 overflow-hidden relative">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(1200px 500px at 10% 0%, color-mix(in srgb, var(--gold) 18%, transparent), transparent 60%), radial-gradient(900px 400px at 85% 30%, color-mix(in srgb, var(--plum) 18%, transparent), transparent 55%)",
            pointerEvents: "none",
          }}
        />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
               style={{
                 borderColor: "color-mix(in srgb, var(--line) 85%, transparent)",
                 background: "color-mix(in srgb, var(--midnight) 85%, transparent)",
                 color: "var(--fog)",
               }}>
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--gold)" }} />
            The Queue • Home
          </div>

          <h1 className="mt-4 text-4xl font-semibold tracking-tight">The Queue</h1>
          <p className="mt-2 max-w-2xl text-white/70">
            Curate the moment. Share the vibe.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/explore"
              className="px-5 py-2.5 rounded-full border text-sm font-semibold"
              style={{
                background: "color-mix(in srgb, var(--gold) 22%, transparent)",
                borderColor: "color-mix(in srgb, var(--gold) 45%, transparent)",
                color: "var(--fog)",
              }}
            >
              Explore
            </Link>

            <Link
              href="/new"
              className="px-4 py-2 rounded-full border text-sm"
              style={{
                background: "transparent",
                borderColor: "color-mix(in srgb, var(--line) 85%, transparent)",
                color: "var(--fog)",
              }}
            >
              Create playlist
            </Link>
          </div>

          {/* small “stats” row */}
          <div className="mt-6 grid sm:grid-cols-3 gap-3">
            {[
              { label: "Public playlists", value: all.length },
              { label: "Trending tags", value: "R&B • Afrobeats • Austin" },
              { label: "Next feature", value: "Add tracks" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border p-4"
                style={{
                  background: "color-mix(in srgb, var(--midnight) 85%, transparent)",
                  borderColor: "color-mix(in srgb, var(--line) 85%, transparent)",
                }}
              >
                <div className="text-xs" style={{ color: "var(--muted)" }}>{s.label}</div>
                <div className="mt-1 font-semibold">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTIONS */}
      <CardRow
        title="Tonight’s Picks"
        subtitle="Curated for the room (demo)."
        items={tonight}
      />

      <CardRow
        title="Hot right now"
        subtitle="Most liked this week."
        items={hot}
      />

      <CardRow
        title="New in the Queue"
        subtitle="Fresh drops and new creators."
        items={newest}
      />

      <FriendsInRoom friends={friends} />
    </div>
  );
}