import Link from "next/link";
import { createServerClient } from "@/lib/supabase-server";
import FriendsInTheRoom from "./components/FriendsInTheRoom";

export const dynamic = "force-dynamic";

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

function pickFeaturedGenre() {
  const genres = ["r&b", "hip-hop", "pop", "afrobeats", "trap", "house", "latin", "dancehall"];
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((d - start) / (1000 * 60 * 60 * 24));
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
    handle: row.owner_handle || handleByUserId?.[row.user_id] || "@user",
    userId: row.user_id,
    avgBpm: typeof row.avg_bpm === "number" ? row.avg_bpm : null,
    energy: typeof row.energy === "number" ? row.energy : null,
    clean: typeof row.clean === "boolean" ? row.clean : null,
    keys: Array.isArray(row.keys) ? row.keys : [],
  };
}

// ── Playlist card ─────────────────────────────────────────────────────────────
function Card({ p }) {
  const rawHandle = String(p.handle || "").replace(/^@/, "");

  return (
    <div
      className="group rounded-2xl border overflow-hidden transition hover:border-white/20 flex flex-col"
      style={{
        borderColor: "color-mix(in srgb, var(--line) 70%, transparent)",
        background: "color-mix(in srgb, var(--midnight) 75%, transparent)",
      }}
    >
      {/* Cover */}
      <Link href={`/p/${p.id}`} className="block relative flex-shrink-0" style={{ aspectRatio: "16/9" }}>
        {p.coverUrl ? (
          <img
            src={p.coverUrl}
            alt={p.title}
            className="w-full h-full object-cover transition group-hover:brightness-90"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-4xl"
            style={{ background: "color-mix(in srgb, var(--plum) 18%, var(--midnight))" }}
          >
            &#9835;
          </div>
        )}
        {/* Play overlay */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
        >
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
          >
            <span className="text-white text-lg pl-0.5">&#9654;</span>
          </div>
        </div>
      </Link>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <Link
          href={`/p/${p.id}`}
          className="font-semibold text-sm text-white hover:underline line-clamp-1 leading-snug"
        >
          {p.title}
        </Link>

        <div className="flex items-center justify-between">
          {rawHandle ? (
            <Link
              href={`/u/${rawHandle}`}
              className="text-xs hover:underline truncate"
              style={{ color: "var(--muted)" }}
            >
              @{rawHandle}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs flex-shrink-0 ml-2" style={{ color: "var(--muted)" }}>
            &#9829; {p.likes ?? 0}
          </span>
        </div>

        {(p.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {(p.tags || []).slice(0, 3).map((t) => (
              <span
                key={`${p.id}-${t}`}
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{
                  background: "color-mix(in srgb, var(--plum) 18%, transparent)",
                  color: "color-mix(in srgb, var(--plum) 85%, white)",
                  border: "1px solid color-mix(in srgb, var(--plum) 28%, transparent)",
                }}
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section row ───────────────────────────────────────────────────────────────
function Row({ title, subtitle, items, href = "/explore", accent }) {
  return (
    <section className="mt-12">
      <div className="flex items-end justify-between gap-3 mb-5">
        <div className="flex items-start gap-3">
          {accent && (
            <div
              className="w-1 rounded-full mt-1 flex-shrink-0"
              style={{ height: 22, background: accent }}
            />
          )}
          <div>
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            {subtitle && (
              <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <Link
          href={href}
          className="text-xs flex-shrink-0 hover:underline"
          style={{ color: "var(--gold)" }}
        >
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
}

// ── Genre pill ────────────────────────────────────────────────────────────────
function GenrePill({ label, href }) {
  return (
    <a
      href={href}
      className="px-3.5 py-1.5 rounded-full text-xs font-medium transition hover:opacity-80"
      style={{
        background: "color-mix(in srgb, var(--plum) 18%, transparent)",
        color: "color-mix(in srgb, var(--plum) 85%, white)",
        border: "1px solid color-mix(in srgb, var(--plum) 30%, transparent)",
      }}
    >
      {label}
    </a>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default async function HomePage() {
  const supabase = createServerClient();

  const { data: baseRows, error } = await supabase
    .from("playlists")
    .select("id,user_id,title,description,tags,is_public,cover_url,created_at,likes_count,owner_handle,avg_bpm,energy,clean,keys")
    .eq("is_public", true)
    .limit(80);

  const userIds = Array.from(
    new Set((baseRows || []).map((r) => r.user_id).filter(Boolean))
  );

  const handleByUserId = {};
  if (userIds.length) {
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

  const hot = [...publicPlaylists].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)).slice(0, 6);
  const newest = [...publicPlaylists]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  const dk = dayKey();
  const tonight = [...publicPlaylists]
    .sort((a, b) => `${a.id}-${dk}`.localeCompare(`${b.id}-${dk}`))
    .slice(0, 6);

  const featuredGenre = pickFeaturedGenre();
  const featured = publicPlaylists
    .filter((p) => (p.tags || []).map((t) => String(t).toLowerCase()).includes(featuredGenre))
    .slice(0, 6);

  // DJ Assist row
  const energyUp = publicPlaylists.filter((p) => typeof p.energy === "number" && p.energy >= 7)
    .sort((a, b) => (b.energy ?? 0) - (a.energy ?? 0)).slice(0, 6);
  const cleanOnly = publicPlaylists.filter((p) => p.clean === true)
    .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)).slice(0, 6);
  const bpmPocket = publicPlaylists.filter((p) => typeof p.avgBpm === "number" && p.avgBpm >= 110 && p.avgBpm <= 125)
    .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)).slice(0, 6);
  const keyOptions = ["1A","2A","3A","4A","5A","6A","7A","8A","9A","10A","11A","12A","1B","2B","3B","4B","5B","6B","7B","8B","9B","10B","11B","12B"];
  const keyOfDay = keyOptions[(new Date().getDate() - 1) % keyOptions.length];
  const keyRow = publicPlaylists.filter((p) => Array.isArray(p.keys) && p.keys.map((k) => String(k).toUpperCase()).includes(String(keyOfDay).toUpperCase())).slice(0, 6);
  const djModes = [
    { title: "DJ Assist: Energy Up", subtitle: "High-energy picks (7-10).", items: energyUp, href: "/explore?energyMin=7" },
    { title: "DJ Assist: Clean Only", subtitle: "Family-friendly playlists.", items: cleanOnly, href: "/explore?clean=1" },
    { title: "DJ Assist: 110-125 BPM", subtitle: "A smooth mid-tempo pocket.", items: bpmPocket, href: "/explore?bpmMin=110&bpmMax=125" },
    { title: `DJ Assist: Key of the Day (${keyOfDay})`, subtitle: "Harmonic-friendly picks.", items: keyRow, href: `/explore?key=${encodeURIComponent(String(keyOfDay))}` },
  ];
  const djPick = djModes[(new Date().getDate() - 1) % djModes.length];

  // Active creators
  const recentCreatorIds = Array.from(new Set(
    [...publicPlaylists]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((p) => p.userId).filter(Boolean)
  )).slice(0, 8);

  const { data: creatorRows } = await supabase
    .from("profiles")
    .select("id, handle, username, display_name, avatar_url, music_dna, role")
    .in("id", recentCreatorIds);

  const creatorMap = Object.fromEntries((creatorRows || []).map((r) => [r.id, r]));
  const recentCreators = recentCreatorIds.map((id) => creatorMap[id]).filter(Boolean).slice(0, 4);

  const totalPlaylists = publicPlaylists.length;
  const totalCreators = recentCreatorIds.length;

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div
        className="rounded-3xl border p-8 md:p-12 overflow-hidden relative"
        style={{
          borderColor: "color-mix(in srgb, var(--line) 60%, transparent)",
          background:
            "radial-gradient(900px 420px at 10% 0%, rgba(246,193,109,0.12) 0%, transparent 55%), " +
            "radial-gradient(600px 300px at 90% 10%, rgba(99,102,241,0.10) 0%, transparent 52%), " +
            "color-mix(in srgb, var(--midnight) 95%, transparent)",
        }}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-10">
          <div className="max-w-xl">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs mb-5"
              style={{
                background: "color-mix(in srgb, var(--gold) 10%, transparent)",
                color: "var(--gold)",
                border: "1px solid color-mix(in srgb, var(--gold) 25%, transparent)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "var(--gold)" }}
              />
              Luxury club mode &mdash; Curate. Share. Replay.
            </div>

            <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-white leading-none">
              The Queue
            </h1>
            <p className="mt-4 text-white/55 text-base md:text-lg">
              Build playlists that feel like a room.{" "}
              <span className="text-white/30">Share the vibe.</span>
            </p>

            {/* CTAs */}
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/explore"
                className="px-6 py-2.5 rounded-full font-semibold text-sm transition hover:opacity-90"
                style={{
                  background: "linear-gradient(90deg, rgba(99,102,241,0.9), rgba(147,51,234,0.9))",
                  color: "white",
                }}
              >
                Explore playlists
              </Link>
              <Link
                href="/new"
                className="px-6 py-2.5 rounded-full font-semibold text-sm transition hover:bg-white/10"
                style={{
                  background: "transparent",
                  color: "var(--fog)",
                  border: "1px solid color-mix(in srgb, var(--line) 80%, transparent)",
                }}
              >
                Create playlist
              </Link>
            </div>

            {/* Stats */}
            {totalPlaylists > 0 && (
              <div className="mt-6 flex items-center gap-5 text-sm" style={{ color: "var(--muted)" }}>
                <span>
                  <span className="text-white font-semibold">{totalPlaylists}</span> playlists
                </span>
                <span
                  className="w-px h-4"
                  style={{ background: "color-mix(in srgb, var(--line) 60%, transparent)" }}
                />
                <span>
                  <span className="text-white font-semibold">{totalCreators}</span> creators
                </span>
              </div>
            )}

            {/* Genre pills */}
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                { label: "R&B", href: "/explore?tags=r%26b" },
                { label: "Hip-Hop", href: "/explore?tags=hip-hop" },
                { label: "Afrobeats", href: "/explore?tags=afrobeats" },
                { label: "House", href: "/explore?tags=house" },
                { label: "Trap", href: "/explore?tags=trap" },
                { label: "Dancehall", href: "/explore?tags=dancehall" },
                { label: "Latin", href: "/explore?tags=latin" },
              ].map(({ label, href }) => (
                <GenrePill key={label} label={label} href={href} />
              ))}
            </div>
          </div>

          {/* Logo */}
          <div className="hidden md:flex items-center justify-center flex-shrink-0">
            <div
              className="relative w-48 h-48 rounded-3xl border grid place-items-center overflow-hidden"
              style={{
                borderColor: "color-mix(in srgb, var(--line) 50%, transparent)",
                background: "color-mix(in srgb, var(--midnight) 90%, transparent)",
              }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(200px 200px at 30% 30%, rgba(246,193,109,0.15) 0%, transparent 60%)",
                }}
              />
              <img
                src="/Stylized%20%27Q%27%20Monogram%20with%20Play%20Button.png"
                alt="The Queue"
                className="relative w-28 h-28 object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      <FriendsInTheRoom />

      {/* ── Playlist rows ────────────────────────────────────────────────── */}
      <Row
        title="Tonight's Picks"
        subtitle="A fresh rotation, every day."
        items={tonight}
        accent="var(--gold)"
      />

      <Row
        title="Hot Right Now"
        subtitle="Most liked in the room."
        items={hot}
        accent="color-mix(in srgb, #f87171 80%, transparent)"
      />

      <Row
        title="New Drops"
        subtitle="Fresh playlists just added."
        items={newest}
        href="/explore"
        accent="color-mix(in srgb, var(--plum) 80%, transparent)"
      />

      <Row
        title={`Featured: ${featuredGenre.charAt(0).toUpperCase() + featuredGenre.slice(1)}`}
        subtitle="Rotates daily by genre."
        items={featured.length ? featured : tonight}
        href={`/explore?tags=${encodeURIComponent(featuredGenre)}`}
        accent="color-mix(in srgb, #34d399 70%, transparent)"
      />

      <Row
        title={djPick.title}
        subtitle={djPick.subtitle}
        items={(djPick.items && djPick.items.length) ? djPick.items : tonight}
        href={djPick.href}
        accent="color-mix(in srgb, #60a5fa 70%, transparent)"
      />

      {/* ── Active Creators ──────────────────────────────────────────────── */}
      {recentCreators.length > 0 && (
        <section className="mt-12">
          <div className="flex items-end justify-between gap-3 mb-5">
            <div className="flex items-start gap-3">
              <div
                className="w-1 rounded-full mt-1 flex-shrink-0"
                style={{
                  height: 22,
                  background: "color-mix(in srgb, var(--gold) 80%, transparent)",
                }}
              />
              <div>
                <h2 className="text-xl font-semibold text-white">Active Creators</h2>
                <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
                  People dropping new playlists right now.
                </p>
              </div>
            </div>
            <Link href="/explore" className="text-xs hover:underline" style={{ color: "var(--gold)" }}>
              See all
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentCreators.map((c) => {
              const rawHandle = (c.handle || c.username || "").replace(/^@/, "");
              const displayName = c.display_name || c.username || rawHandle || "Creator";
              const initial = displayName.charAt(0).toUpperCase();
              return (
                <Link
                  key={c.id}
                  href={`/u/${rawHandle}`}
                  className="flex items-center gap-3 p-4 rounded-2xl border transition hover:border-white/20"
                  style={{
                    borderColor: "color-mix(in srgb, var(--line) 70%, transparent)",
                    background: "color-mix(in srgb, var(--midnight) 75%, transparent)",
                  }}
                >
                  <div
                    className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 grid place-items-center font-semibold text-sm"
                    style={{
                      background: "color-mix(in srgb, var(--plum) 30%, var(--midnight))",
                      color: "var(--gold)",
                    }}
                  >
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt={displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      initial
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-white truncate">{displayName}</div>
                    <div className="text-xs truncate" style={{ color: "var(--muted)" }}>
                      @{rawHandle}
                    </div>
                    {c.role && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block"
                        style={{
                          background: "color-mix(in srgb, var(--gold) 12%, transparent)",
                          color: "var(--gold)",
                          border: "1px solid color-mix(in srgb, var(--gold) 30%, transparent)",
                        }}
                      >
                        {c.role}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {error && (
        <div className="mt-8 text-red-400 text-sm">
          Error loading playlists: {String(error.message || error)}
        </div>
      )}
    </div>
  );
}
