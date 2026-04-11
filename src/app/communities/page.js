"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";

const CATEGORY_ORDER = [
  { key: "genres",    label: "Genres" },
  { key: "regions",   label: "Regions" },
  { key: "vibes",     label: "Vibes" },
  { key: "community", label: "Fan Communities" },
];

// Slugs that belong to each browse category
const GENRE_SLUGS = new Set([
  "hip-hop","rb","soul","funk","gospel","neo-soul","afrobeats","amapiano",
  "dancehall","reggae","soca","house","techno","edm","drum-and-bass","dubstep",
  "jungle","jersey-club","bounce","footwork","grime","rock","alternative","indie",
  "punk","metal","grunge","classic-rock","emo","pop","synth-pop","k-pop","j-pop",
  "latin-pop","country","bluegrass","americana","folk","reggaeton","latin-trap",
  "salsa","bachata","cumbia","jazz","blues","classical","bossa-nova","afro-cuban",
  "highlife","fela","arabic-pop","indian-classical",
]);

const REGION_SLUGS = new Set([
  "south","houston","atlanta","memphis","new-orleans","miami","west-coast","la",
  "bay-area","east-coast","nyc","midwest","chicago","detroit","dmv",
  "uk","london","nigeria","ghana","south-africa","jamaica","trinidad","brazil",
  "puerto-rico","colombia","mexico","france","japan","korea","global",
]);

const VIBE_SLUGS = new Set([
  "late-night","chill-vibes","workout","road-trip","outside","cookout","brunch",
  "club","turnt","date-night","soft-life","study-vibes","sunday-morning",
  "heartbreak","hype","meditation","party","hbcu-vibes","background-music",
]);

function categorize(c) {
  if (GENRE_SLUGS.has(c.slug))  return "genres";
  if (REGION_SLUGS.has(c.slug)) return "regions";
  if (VIBE_SLUGS.has(c.slug))   return "vibes";
  return "community";
}

export default function CommunitiesPage() {
  const supabase = useMemo(() => createBrowserClient(), []);

  const [communities, setCommunities] = useState([]);
  const [joined, setJoined]           = useState(new Set());
  const [userId, setUserId]           = useState(null);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [activeTab, setActiveTab]     = useState("explore"); // "explore" | "mine"
  const [activeCategory, setActiveCategory] = useState("genres");

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: auth }, { data: rows }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("communities")
          .select("slug,name,description,parent_slug,member_count,is_official")
          .order("member_count", { ascending: false }),
      ]);
      const user = auth?.user || null;
      if (alive) setUserId(user?.id || null);

      if (user) {
        const { data: memberRows } = await supabase
          .from("community_members")
          .select("community_slug")
          .eq("user_id", user.id);
        if (alive) setJoined(new Set((memberRows || []).map((r) => r.community_slug)));
      }

      if (alive) { setCommunities(rows || []); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [supabase]);

  const toggle = async (slug) => {
    if (!userId) return;
    const isJoined = joined.has(slug);
    setJoined((prev) => { const n = new Set(prev); isJoined ? n.delete(slug) : n.add(slug); return n; });
    setCommunities((prev) =>
      prev.map((c) => c.slug === slug ? { ...c, member_count: (c.member_count || 0) + (isJoined ? -1 : 1) } : c)
    );
    if (isJoined) {
      await supabase.from("community_members").delete().eq("user_id", userId).eq("community_slug", slug);
    } else {
      await supabase.from("community_members").insert({ user_id: userId, community_slug: slug });
    }
  };

  // ── Derived lists ──────────────────────────────────────────────────────────

  const q = search.trim().toLowerCase();

  const byCategory = useMemo(() => {
    const map = { genres: [], regions: [], vibes: [], community: [] };
    for (const c of communities) map[categorize(c)].push(c);
    return map;
  }, [communities]);

  const myCommunities = useMemo(
    () => communities.filter((c) => joined.has(c.slug)),
    [communities, joined]
  );

  const searchFiltered = useMemo(() => {
    if (!q) return communities;
    return communities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q)
    );
  }, [communities, q]);

  const mySearchFiltered = useMemo(() => {
    if (!q) return myCommunities;
    return myCommunities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q)
    );
  }, [myCommunities, q]);

  const displayList =
    activeTab === "mine"
      ? mySearchFiltered
      : (q ? searchFiltered : byCategory[activeCategory] || []);

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: "var(--gold)" }}>
            The Queue
          </div>
          <h1 className="text-3xl font-semibold text-white">Communities</h1>
          <p className="text-white/50 mt-1.5">
            Find your sound. Connect through shared taste, region, and culture.
          </p>
        </div>
        <Link href="/communities/create" className="inBtn flex-shrink-0">
          + Create
        </Link>
      </div>

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <div className="relative mb-6">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <input
          type="text"
          placeholder="Search communities…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-2xl border pl-10 pr-4 py-3 bg-transparent text-white placeholder-white/30 outline-none"
          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      {!q && (
        <div className="flex items-center gap-1 mb-6">
          {["explore", "mine"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-5 py-2 rounded-full text-sm font-medium transition-all capitalize"
              style={{
                background: activeTab === tab
                  ? "color-mix(in srgb, var(--gold) 16%, transparent)"
                  : "transparent",
                color: activeTab === tab ? "var(--gold)" : "var(--muted)",
                border: `1px solid ${activeTab === tab
                  ? "color-mix(in srgb, var(--gold) 40%, transparent)"
                  : "color-mix(in srgb, var(--line) 60%, transparent)"}`,
              }}
            >
              {tab === "mine" ? `My Communities${myCommunities.length ? ` (${myCommunities.length})` : ""}` : "Explore"}
            </button>
          ))}
        </div>
      )}

      {/* ── Category pills (explore tab only, no search) ─────────────── */}
      {activeTab === "explore" && !q && (
        <div className="flex flex-wrap gap-2 mb-7">
          {CATEGORY_ORDER.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className="px-4 py-1.5 rounded-full text-sm transition-all"
              style={{
                background: activeCategory === key
                  ? "color-mix(in srgb, var(--plum) 30%, transparent)"
                  : "transparent",
                color: activeCategory === key ? "white" : "var(--muted)",
                border: `1px solid ${activeCategory === key
                  ? "color-mix(in srgb, var(--plum) 60%, transparent)"
                  : "color-mix(in srgb, var(--line) 60%, transparent)"}`,
              }}
            >
              {label}
              <span className="ml-1.5 opacity-50 text-xs">
                {byCategory[key]?.length || 0}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="text-white/40 text-center py-24">Loading…</div>
      ) : activeTab === "mine" && !q && myCommunities.length === 0 ? (
        <div
          className="rounded-2xl border px-8 py-16 text-center"
          style={{ borderColor: "color-mix(in srgb, var(--line) 60%, transparent)" }}
        >
          <div className="text-white/30 text-4xl mb-4">♫</div>
          <div className="text-white font-medium mb-1">You haven't joined any communities yet</div>
          <p className="text-white/40 text-sm mb-6">Head to Explore to find your people.</p>
          <button
            onClick={() => setActiveTab("explore")}
            className="px-6 py-2.5 rounded-full font-medium text-sm"
            style={{ background: "color-mix(in srgb, var(--gold) 16%, transparent)", color: "var(--gold)", border: "1px solid color-mix(in srgb, var(--gold) 40%, transparent)" }}
          >
            Explore communities
          </button>
        </div>
      ) : displayList.length === 0 ? (
        <div className="text-center py-20 text-white/40">
          No communities match "{search}".
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayList.map((c) => (
            <CommunityCard
              key={c.slug}
              c={c}
              isJoined={joined.has(c.slug)}
              userId={userId}
              onToggle={toggle}
            />
          ))}
        </div>
      )}

      {/* search result count */}
      {q && !loading && (
        <p className="mt-5 text-xs text-white/30 text-center">
          {displayList.length} result{displayList.length !== 1 ? "s" : ""} for "{search}"
        </p>
      )}
    </div>
  );
}

function CommunityCard({ c, isJoined, userId, onToggle }) {
  const category = categorize(c);

  const categoryColor = {
    genres:    "var(--plum)",
    regions:   "#0ea5e9",
    vibes:     "var(--gold)",
    community: "var(--muted)",
  }[category];

  const categoryLabel = {
    genres:    "Genre",
    regions:   "Region",
    vibes:     "Vibe",
    community: "Community",
  }[category];

  return (
    <div
      className="rounded-2xl border flex flex-col transition-all hover:border-white/20"
      style={{
        borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
        background: "color-mix(in srgb, var(--midnight) 70%, transparent)",
      }}
    >
      {/* Top color bar */}
      <div
        className="h-1 rounded-t-2xl"
        style={{ background: `color-mix(in srgb, ${categoryColor} 55%, transparent)` }}
      />

      <div className="p-5 flex flex-col flex-1">
        {/* Category badge */}
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-xs px-2.5 py-0.5 rounded-full font-medium"
            style={{
              background: `color-mix(in srgb, ${categoryColor} 14%, transparent)`,
              color: `color-mix(in srgb, ${categoryColor} 90%, white)`,
              border: `1px solid color-mix(in srgb, ${categoryColor} 30%, transparent)`,
            }}
          >
            {categoryLabel}
          </span>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {(c.member_count || 0).toLocaleString()} member{c.member_count === 1 ? "" : "s"}
          </span>
        </div>

        {/* Name + description */}
        <Link
          href={`/communities/${c.slug}`}
          className="font-semibold text-white hover:underline underline-offset-2 text-base leading-snug"
        >
          {c.name}
        </Link>
        {c.description && (
          <p className="text-white/45 text-sm mt-1.5 leading-relaxed line-clamp-2 flex-1">
            {c.description}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4">
          <Link
            href={`/communities/${c.slug}`}
            className="flex-1 text-center text-xs py-2 rounded-full border transition hover:bg-white/5"
            style={{
              borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
              color: "var(--muted)",
            }}
          >
            View
          </Link>
          {userId && (
            <button
              type="button"
              onClick={() => onToggle(c.slug)}
              className="flex-1 text-xs py-2 rounded-full border font-medium transition"
              style={{
                borderColor: isJoined
                  ? "color-mix(in srgb, var(--line) 80%, transparent)"
                  : `color-mix(in srgb, ${categoryColor} 50%, transparent)`,
                background: isJoined
                  ? "transparent"
                  : `color-mix(in srgb, ${categoryColor} 12%, transparent)`,
                color: isJoined
                  ? "rgba(255,255,255,0.4)"
                  : `color-mix(in srgb, ${categoryColor} 90%, white)`,
              }}
            >
              {isJoined ? "Joined ✓" : "Join"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
