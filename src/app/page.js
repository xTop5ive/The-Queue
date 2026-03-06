import Link from "next/link";
import { DEMO_PLAYLISTS } from "@/lib/demoPlaylists";

export const dynamic = "force-dynamic";

function pill(text) {
  return (
    <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-sm text-white/80">
      {text}
    </span>
  );
}

export default function HomePage() {
  const publicPlaylists = DEMO_PLAYLISTS.filter((p) => p.isPublic);

  const tonight = publicPlaylists.slice(0, 6);

  const hot = [...publicPlaylists]
    .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
    .slice(0, 6);

  const newest = [...publicPlaylists]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  const friends = [
    { name: "Maya", handle: "mayamay", mood: "Late-night R&B" },
    { name: "Ken", handle: "kenny", mood: "Afrobeats warmup" },
    { name: "Tee", handle: "tee", mood: "Trap gym set" },
    { name: "Ari", handle: "ari", mood: "Smooth jazz + neo-soul" },
  ];

  const Card = ({ p }) => (
    <Link
      href={`/p/${p.id}`}
      className="card p-4 hover:border-white/20 transition hover:-translate-y-0.5"
    >
      <div className="flex gap-3">
        <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex-shrink-0">
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
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{p.title}</div>
          {p.description ? (
            <div className="text-sm text-white/60 line-clamp-2">{p.description}</div>
          ) : (
            <div className="text-sm text-white/40">No description</div>
          )}
          <div className="text-xs text-white/50 mt-1">by {p.handle}</div>
        </div>

        <div className="text-sm text-white/70 flex items-center gap-1 flex-shrink-0">
          <span aria-hidden>♥</span>
          <span>{p.likes ?? 0}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(p.tags ?? []).slice(0, 4).map((t) => (
          <span
            key={`${p.id}-${t}`}
            className="text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-white/80"
          >
            {t}
          </span>
        ))}
      </div>
    </Link>
  );

  const Row = ({ title, subtitle, items }) => (
    <section className="mt-8">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {subtitle ? <p className="text-white/60 text-sm mt-1">{subtitle}</p> : null}
        </div>
        <Link href="/explore" className="text-sm underline text-white/70 hover:text-white">
          See all
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((p) => (
          <Card key={p.id} p={p} />
        ))}
      </div>
    </section>
  );

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">
      {/* Hero */}
      <div
        className="card p-8 md:p-10 overflow-hidden relative"
        style={{
          background:
            "radial-gradient(900px 420px at 15% 10%, rgba(246, 193, 109, 0.14) 0%, rgba(0,0,0,0) 55%), radial-gradient(700px 320px at 85% 20%, rgba(99, 102, 241, 0.12) 0%, rgba(0,0,0,0) 52%), linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 100%)",
        }}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              <span className="w-2 h-2 rounded-full" style={{ background: "var(--gold)" }} />
              Luxury club mode
              <span className="text-white/40">•</span>
              <span className="text-white/80">Curate. Share. Replay.</span>
            </div>

            <h1 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight">
              The Queue
            </h1>
            <p className="text-white/60 mt-3 text-base md:text-lg max-w-xl">
              Curate the moment. Share the vibe.
              <span className="text-white/40"> Build playlists that feel like a room.</span>
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/explore" className="btn btnPrimary">
                Explore
              </Link>
              <Link href="/new" className="btn">
                Create playlist
              </Link>
              <Link href="/u/whatsup5ive" className="btn">
                View a profile
              </Link>
            </div>

            <div className="mt-7 flex flex-wrap gap-2">
              {pill("BPM + Key filters")}
              {pill("Tags + vibes")}
              {pill("Shareable playlists")}
              {pill("Comments")}
              {pill("Luxury UI")}
            </div>

            <div className="mt-6 grid sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Tonight’s vibe</div>
                <div className="mt-1 font-semibold">Late-night energy</div>
                <div className="mt-1 text-sm text-white/60">Smooth cuts, warm drops, clean transitions.</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Discover</div>
                <div className="mt-1 font-semibold">Search like a DJ</div>
                <div className="mt-1 text-sm text-white/60">Find by tag, mood, BPM, and key.</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Share</div>
                <div className="mt-1 font-semibold">Send the link</div>
                <div className="mt-1 text-sm text-white/60">One tap to pass the aux.</div>
              </div>
            </div>
          </div>

          {/* Logo / Mark */}
          <div className="hidden md:block">
            <div className="relative w-44 h-44 rounded-3xl border border-white/10 bg-white/5 grid place-items-center">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(220px 220px at 30% 30%, rgba(246, 193, 109, 0.20) 0%, rgba(0,0,0,0) 60%)",
                }}
              />
              <div className="relative flex items-center justify-center">
                <span className="text-7xl font-semibold" style={{ color: "var(--gold)" }}>
                  Q
                </span>
                <span
                  className="absolute right-1 -bottom-1 w-9 h-9 rounded-full border border-white/10 bg-black/40 grid place-items-center"
                  title="Play"
                >
                  <span
                    className="block w-0 h-0"
                    style={{
                      borderTop: "7px solid transparent",
                      borderBottom: "7px solid transparent",
                      borderLeft: "11px solid var(--gold)",
                      marginLeft: "2px",
                    }}
                  />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Row title="Tonight’s Picks" subtitle="Curated for right now." items={tonight} />
      <Row title="Hot right now" subtitle="Most liked in the room." items={hot} />
      <Row title="New" subtitle="Fresh drops and new vibes." items={newest} />

      {/* Friends listening */}
      <section className="mt-8">
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h2 className="text-xl font-semibold">Friends in the room</h2>
            <p className="text-white/60 text-sm mt-1">What people are listening to (demo).</p>
          </div>
          <Link href="/explore" className="text-sm underline text-white/70 hover:text-white">
            Explore
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {friends.map((f) => (
            <Link
              key={f.handle}
              href={`/u/${f.handle}`}
              className="card p-4 hover:border-white/20 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/10 border border-white/10 grid place-items-center text-white/70">
                  {f.name.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{f.name}</div>
                  <div className="text-xs text-white/50 truncate">@{f.handle}</div>
                </div>
              </div>
              <div className="mt-3 text-sm text-white/70">
                Listening: <span className="text-white/90">{f.mood}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}