import Link from "next/link";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function pill(text) {
  return (
    <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-sm text-white/80">
      {text}
    </span>
  );
}

function dayKey() {
  // YYYY-MM-DD in server timezone (good enough for “daily rotation”)
  return new Date().toISOString().slice(0, 10);
}

function pickFeaturedGenre() {
  const genres = ["r&b", "hip-hop", "pop", "afrobeats", "trap", "house", "latin", "dancehall"];
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  return genres[dayOfYear % genres.length];
}

function mapPlaylist(row, handleByUserId) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    tags: row.tags || [],
    isPublic: row.is_public,
    coverUrl: row.cover_url,
    createdAt: row.created_at,
    likes: row.likes_count ?? 0,

    // Prefer stored owner_handle (if your DB has it). Otherwise fall back to profiles lookup.
    handle:
      row.owner_handle ||
      handleByUserId?.[row.user_id] ||
      "@user",

    userId: row.user_id,

    // DJ-style metadata (optional columns)
    avgBpm: typeof row.avg_bpm === "number" ? row.avg_bpm : null,
    energy: typeof row.energy === "number" ? row.energy : null, // 1–10
    clean: typeof row.clean === "boolean" ? row.clean : null,
    keys: Array.isArray(row.keys) ? row.keys : [],
  };
}

export default async function HomePage() {
  const supabase = createServerClient();

  // 1) pull a chunk of public playlists once
  const { data: baseRows, error } = await supabase
    .from("playlists")
    .select("id,user_id,title,description,tags,is_public,cover_url,created_at,likes_count,owner_handle,avg_bpm,energy,clean,keys")
    .eq("is_public", true)
    .limit(80);

  // 1b) build a handle lookup so Home can show real @handles
  const userIds = Array.from(
    new Set((baseRows || []).map((r) => r.user_id).filter(Boolean))
  );

  const handleByUserId = {};

  if (userIds.length) {
    // If you have a public profiles table (recommended), use it.
    // Expected columns: id (uuid), handle (text) OR username (text)
    const { data: profRows } = await supabase
      .from("profiles")
      .select("id,handle,username")
      .in("id", userIds);

    (profRows || []).forEach((pr) => {
      const raw = (pr?.handle || pr?.username || "").trim();
      if (!raw) return;
      handleByUserId[pr.id] = raw.startsWith("@") ? raw : `@${raw}`;
    });
  }

  const publicPlaylists = (baseRows || []).map((r) => mapPlaylist(r, handleByUserId));

  // 2) HOT + NEW are straightforward
  const hot = [...publicPlaylists].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)).slice(0, 6);
  const newest = [...publicPlaylists]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  // 3) TONIGHT’S PICKS (daily rotation)
  const dk = dayKey();
  const tonight = [...publicPlaylists]
    .sort((a, b) => {
      // deterministic “shuffle” via string compare (simple + stable)
      const ak = `${a.id}-${dk}`;
      const bk = `${b.id}-${dk}`;
      return ak.localeCompare(bk);
    })
    .slice(0, 6);

  // 4) FEATURED GENRE row (rotates daily)
  const featuredGenre = pickFeaturedGenre();
  const featured = publicPlaylists
    .filter((p) => (p.tags || []).map((t) => String(t).toLowerCase()).includes(featuredGenre))
    .slice(0, 6);

  // 5) DJ-style rotation rows
  // Energy Up: energetic playlists (>= 7/10)
  const energyUp = publicPlaylists
    .filter((p) => typeof p.energy === "number" && p.energy >= 7)
    .sort((a, b) => (b.energy ?? 0) - (a.energy ?? 0))
    .slice(0, 6);

  // Clean Only: family-friendly playlists
  const cleanOnly = publicPlaylists
    .filter((p) => p.clean === true)
    .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
    .slice(0, 6);

  // 110–125 BPM: common mid-tempo pocket (great for pop/r&b/afrobeats sets)
  const bpmPocket = publicPlaylists
    .filter((p) => typeof p.avgBpm === "number" && p.avgBpm >= 110 && p.avgBpm <= 125)
    .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
    .slice(0, 6);

  // Key of the Day: rotates by day, picks a musical key and shows matching playlists
  const keyOptions = [
    "1A","2A","3A","4A","5A","6A","7A","8A","9A","10A","11A","12A",
    "1B","2B","3B","4B","5B","6B","7B","8B","9B","10B","11B","12B",
  ];
  const keyOfDay = keyOptions[(new Date().getDate() - 1) % keyOptions.length];
  const keyRow = publicPlaylists
    .filter((p) => Array.isArray(p.keys) && p.keys.map((k) => String(k).toUpperCase()).includes(String(keyOfDay).toUpperCase()))
    .slice(0, 6);

  // 6) DJ Assist row (mainstream UI, DJ logic under the hood)
  // Rotates daily between: energy / clean / bpm pocket / key of the day.
  const djModes = [
    {
      key: "energy",
      title: "DJ Assist: Energy Up",
      subtitle: "High-energy picks (7–10).",
      items: energyUp,
      href: "/explore?energyMin=7",
    },
    {
      key: "clean",
      title: "DJ Assist: Clean Only",
      subtitle: "Family-friendly playlists.",
      items: cleanOnly,
      href: "/explore?clean=1",
    },
    {
      key: "bpm",
      title: "DJ Assist: 110–125 BPM",
      subtitle: "A smooth mid-tempo pocket.",
      items: bpmPocket,
      href: "/explore?bpmMin=110&bpmMax=125",
    },
    {
      key: "key",
      title: `DJ Assist: Key of the Day (${keyOfDay})`,
      subtitle: "Harmonic-friendly picks (Camelot wheel).",
      items: keyRow,
      href: `/explore?key=${encodeURIComponent(String(keyOfDay))}`,
    },
  ];

  // Deterministic daily pick
  const djPick = djModes[(new Date().getDate() - 1) % djModes.length];

  const friends = [
    { name: "Maya", handle: "mayamay", mood: "Late-night R&B" },
    { name: "Ken", handle: "kenny", mood: "Afrobeats warmup" },
    { name: "Tee", handle: "tee", mood: "Trap gym set" },
    { name: "Ari", handle: "ari", mood: "Smooth jazz + neo-soul" },
  ];

  const Card = ({ p }) => (
    <Link href={`/p/${p.id}`} className="card p-4 hover:border-white/20 transition hover:-translate-y-0.5">
      <div className="flex gap-3">
        <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex-shrink-0">
          {p.coverUrl ? (
            <img src={p.coverUrl} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full grid place-items-center text-[10px] text-white/60">no cover</div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{p.title}</div>
          {p.description ? (
            <div className="text-sm text-white/60 line-clamp-2">{p.description}</div>
          ) : (
            <div className="text-sm text-white/40">No description</div>
          )}
          <div className="text-xs mt-1">
            <span className="text-white/50">by </span>
            <span className="text-white/80">{p.handle}</span>
          </div>

          <div className="text-xs text-white/50 mt-1 flex flex-wrap items-center gap-2">
            {typeof p.avgBpm === "number" ? <span>{p.avgBpm} BPM</span> : null}
            {typeof p.energy === "number" ? <span>Energy {p.energy}/10</span> : null}
            {typeof p.clean === "boolean" ? <span>{p.clean ? "Clean" : "Explicit"}</span> : null}
            {Array.isArray(p.keys) && p.keys.length ? <span>{p.keys.length} keys</span> : null}
          </div>
        </div>

        <div className="text-sm text-white/70 flex items-center gap-1 flex-shrink-0">
          <span aria-hidden>♥</span>
          <span>{p.likes ?? 0}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(p.tags ?? []).slice(0, 4).map((t) => (
          <span key={`${p.id}-${t}`} className="text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-white/80">
            {t}
          </span>
        ))}
      </div>
    </Link>
  );

  const Row = ({ title, subtitle, items, href = "/explore" }) => (
    <section className="mt-8">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {subtitle ? <p className="text-white/60 text-sm mt-1">{subtitle}</p> : null}
        </div>
        <Link href={href} className="text-sm underline text-white/70 hover:text-white">
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

            <h1 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight">The Queue</h1>
            <p className="text-white/60 mt-3 text-base md:text-lg max-w-xl">
              Curate the moment. Share the vibe.
              <span className="text-white/40"> Build playlists that feel like a room.</span>
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/explore"
                className="px-5 py-2.5 rounded-full font-semibold border transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-white/20"
                style={{
                  background: "linear-gradient(90deg, rgba(99,102,241,0.95), rgba(147,51,234,0.95))",
                  borderColor: "transparent",
                  color: "white",
                }}
              >
                Explore
              </Link>

              <Link
                href="/new"
                className="px-5 py-2.5 rounded-full font-semibold border transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
                style={{
                  background: "transparent",
                  borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                  color: "var(--fog)",
                }}
              >
                Create playlist
              </Link>
            </div>

            <div className="mt-7 flex flex-wrap gap-2">
              {pill("BPM + Key filters")}
              {pill("Tags + vibes")}
              {pill("Shareable playlists")}
              {pill("Comments")}
              {pill("Luxury UI")}
            </div>
          </div>

          <div className="hidden md:block">
            <div className="relative w-44 h-44 rounded-3xl border border-white/10 bg-white/5 grid place-items-center overflow-hidden">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(220px 220px at 30% 30%, rgba(246, 193, 109, 0.20) 0%, rgba(0,0,0,0) 60%)",
                }}
              />
              <img
                src="/Stylized%20%27Q%27%20Monogram%20with%20Play%20Button.png"
                alt="The Queue logo"
                className="relative w-28 h-28 object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      <Row title="Tonight’s Picks" subtitle="Rotates daily (deterministic shuffle)." items={tonight} />
      <Row title="Hot right now" subtitle="Most liked in the room." items={hot} />
      <Row title="New" subtitle="Fresh drops and new vibes." items={newest} />

      <Row
        title={`Featured: ${featuredGenre.toUpperCase()}`}
        subtitle="Rotates daily by genre tag."
        items={featured.length ? featured : tonight}
        href={`/explore?tags=${encodeURIComponent(featuredGenre)}`}
      />

      <Row
        title={djPick.title}
        subtitle={djPick.subtitle}
        items={(djPick.items && djPick.items.length) ? djPick.items : tonight}
        href={djPick.href}
      />

      {/* Friends listening */}
      <section className="mt-8">
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h2 className="text-xl font-semibold">Friends in the room</h2>
            <p className="text-white/60 text-sm mt-1">What people are listening to (demo).</p>
          </div>
          <Link href="/explore" className="text-sm underline text-white/70 hover:text-white">Explore</Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {friends.map((f) => (
            <Link key={f.handle} href={`/u/${f.handle}`} className="card p-4 hover:border-white/20 transition">
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

      {error ? <div className="mt-8 text-red-400">Error loading playlists: {String(error.message || error)}</div> : null}
    </div>
  );
}