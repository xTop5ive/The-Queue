"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase-browser";

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function normHandle(raw) {
  const v = (raw || "").replace(/^@/, "").trim();
  return v ? `@${v}` : "@user";
}

// Normalize a taste label to a slug for tag matching
function toSlug(str) {
  return (str || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function hasTagOverlap(playlistTags, targetSlugs) {
  const tags = (playlistTags || []).map(toSlug);
  return targetSlugs.some((slug) => tags.some((t) => t === slug || t.includes(slug) || slug.includes(t)));
}

// ── Playlist card (used in multiple sections) ─────────────────────────────────
function PlaylistCard({ p, handle }) {
  const displayHandle = handle || normHandle(p.owner_handle);
  const rawHandle = displayHandle.replace(/^@/, "");

  return (
    <div
      className="rounded-2xl border flex flex-col overflow-hidden hover:border-white/20 transition group"
      style={{
        borderColor: "color-mix(in srgb, var(--line) 70%, transparent)",
        background: "color-mix(in srgb, var(--midnight) 70%, transparent)",
      }}
    >
      <Link href={`/p/${p.id}`} className="block relative" style={{ aspectRatio: "16/9" }}>
        {p.cover_url ? (
          <img src={p.cover_url} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-3xl"
            style={{ background: "color-mix(in srgb, var(--plum) 20%, var(--midnight))" }}
          >
            &#9835;
          </div>
        )}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.45)" }}
        >
          <span className="text-white text-2xl">&#9654;</span>
        </div>
      </Link>

      <div className="p-3 flex flex-col flex-1">
        <Link href={`/p/${p.id}`} className="font-semibold text-sm text-white hover:underline line-clamp-1 leading-snug">
          {p.title}
        </Link>
        <Link href={`/u/${rawHandle}`} className="text-xs mt-0.5 hover:underline" style={{ color: "var(--muted)" }}>
          {displayHandle}
        </Link>

        <div className="flex items-center justify-between mt-2">
          <div className="flex flex-wrap gap-1">
            {(p.tags || []).slice(0, 2).map((t) => (
              <span
                key={t}
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{
                  background: "color-mix(in srgb, var(--plum) 20%, transparent)",
                  color: "color-mix(in srgb, var(--plum) 90%, white)",
                  border: "1px solid color-mix(in srgb, var(--plum) 30%, transparent)",
                }}
              >
                #{t}
              </span>
            ))}
          </div>
          <span className="text-xs flex items-center gap-1" style={{ color: "var(--muted)" }}>
            &#9829; {p.likes_count || 0}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, subtitle, href, hrefLabel = "See all", children, empty }) {
  return (
    <div className="mb-10">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="text-xs hover:underline" style={{ color: "var(--gold)" }}>
            {hrefLabel}
          </Link>
        )}
      </div>
      {empty ? (
        <div
          className="rounded-2xl border px-6 py-8 text-center"
          style={{ borderColor: "color-mix(in srgb, var(--line) 50%, transparent)" }}
        >
          <p className="text-white/30 text-sm">{empty}</p>
        </div>
      ) : children}
    </div>
  );
}

// ── Creator card ──────────────────────────────────────────────────────────────
function CreatorCard({ creator }) {
  const [imgFailed, setImgFailed] = useState(false);
  const handle = (creator.handle || "").replace(/^@/, "");
  const initials = handle.slice(0, 1).toUpperCase();

  return (
    <Link
      href={`/u/${handle}`}
      className="flex items-center gap-3 p-3 rounded-2xl border transition hover:border-white/20"
      style={{
        borderColor: "color-mix(in srgb, var(--line) 60%, transparent)",
        background: "color-mix(in srgb, var(--midnight) 70%, transparent)",
      }}
    >
      {creator.avatar_url && !imgFailed ? (
        <img
          src={creator.avatar_url}
          alt={handle}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold"
          style={{ background: "color-mix(in srgb, var(--plum) 35%, var(--midnight))", color: "var(--gold)" }}
        >
          {initials}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-sm font-medium text-white truncate">
          {creator.display_name || `@${handle}`}
        </div>
        <div className="text-xs truncate" style={{ color: "var(--muted)" }}>
          {creator.playlistCount} playlist{creator.playlistCount !== 1 ? "s" : ""} &middot; {creator.totalLikes} likes
        </div>
      </div>
    </Link>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FeedPage() {
  const supabase = useMemo(() => createBrowserClient(), []);

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [joinedCommunities, setJoinedCommunities] = useState([]);
  const [tab, setTab] = useState("foryou");

  const [communityPlaylists, setCommunityPlaylists] = useState([]);
  const [tastePlaylists, setTastePlaylists] = useState([]);
  const [trending, setTrending] = useState([]);
  const [creators, setCreators] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      // Auth
      const { data: auth } = await supabase.auth.getUser();
      const u = auth?.user || null;
      if (!alive) return;
      setUser(u);

      // Profile + communities (parallel)
      let prof = null;
      let communitySlugs = [];
      let communityRows = [];

      if (u) {
        const [{ data: profData }, { data: memberRows }] = await Promise.all([
          supabase
            .from("profiles")
            .select("handle, display_name, avatar_url, favorite_genres, favorite_regions, favorite_vibes")
            .eq("id", u.id)
            .maybeSingle(),
          supabase
            .from("community_members")
            .select("community_slug")
            .eq("user_id", u.id),
        ]);
        prof = profData;
        if (alive) setProfile(profData);

        communitySlugs = (memberRows || []).map((r) => r.community_slug);
        if (communitySlugs.length) {
          const { data: cd } = await supabase
            .from("communities")
            .select("slug, name, description, member_count")
            .in("slug", communitySlugs);
          communityRows = cd || [];
          if (alive) setJoinedCommunities(communityRows);
        }
      }

      // Fetch recent public playlists (client-side filter for personalization)
      const { data: allPlaylists } = await supabase
        .from("playlists")
        .select("id, user_id, title, description, cover_url, tags, likes_count, created_at, owner_handle")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(120);

      const playlists = allPlaylists || [];

      // Enrich handles from profiles for playlists missing owner_handle
      const missingIds = [...new Set(playlists.filter((p) => !p.owner_handle).map((p) => p.user_id))];
      const handleMap = {};
      if (missingIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, handle")
          .in("id", missingIds);
        (profs || []).forEach((pr) => { if (pr.handle) handleMap[pr.id] = pr.handle; });
      }
      const enriched = playlists.map((p) => ({
        ...p,
        owner_handle: p.owner_handle || handleMap[p.user_id] || "",
      }));

      // Trending (by likes)
      const trendingSorted = [...enriched]
        .sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0))
        .slice(0, 24);
      if (alive) setTrending(trendingSorted);

      // Personalized sections
      if (prof) {
        const tasteTags = [
          ...(prof.favorite_genres || []),
          ...(prof.favorite_vibes || []),
          ...(prof.favorite_regions || []),
        ].map(toSlug).filter(Boolean);

        // Community playlists
        if (communitySlugs.length) {
          const comPl = enriched
            .filter((p) => hasTagOverlap(p.tags, communitySlugs))
            .slice(0, 12);
          if (alive) setCommunityPlaylists(comPl);
        }

        // Taste-based playlists
        if (tasteTags.length) {
          const tastePl = enriched
            .filter((p) => hasTagOverlap(p.tags, tasteTags))
            .sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0))
            .slice(0, 12);
          if (alive) setTastePlaylists(tastePl);
        }
      }

      // Featured creators — aggregate from enriched playlists
      const creatorLikes = {};
      const creatorPlaylistCount = {};
      for (const p of enriched) {
        if (!p.user_id || p.user_id === u?.id) continue;
        creatorLikes[p.user_id] = (creatorLikes[p.user_id] || 0) + (p.likes_count || 0);
        creatorPlaylistCount[p.user_id] = (creatorPlaylistCount[p.user_id] || 0) + 1;
      }
      const topIds = Object.entries(creatorLikes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([id]) => id);

      if (topIds.length) {
        const { data: creatorProfs } = await supabase
          .from("profiles")
          .select("id, handle, display_name, avatar_url")
          .in("id", topIds);
        const cl = (creatorProfs || []).map((cp) => ({
          ...cp,
          playlistCount: creatorPlaylistCount[cp.id] || 0,
          totalLikes: creatorLikes[cp.id] || 0,
        })).sort((a, b) => b.totalLikes - a.totalLikes);
        if (alive) setCreators(cl);
      }

      // Recent activity — latest playlist comments
      const { data: commentRows } = await supabase
        .from("playlist_comments")
        .select("id, body, created_at, playlist_id, user_id")
        .order("created_at", { ascending: false })
        .limit(6);

      if (commentRows?.length) {
        // Fetch playlist titles
        const plIds = [...new Set(commentRows.map((c) => c.playlist_id))];
        const plTitleMap = {};
        const { data: plRows } = await supabase
          .from("playlists")
          .select("id, title")
          .in("id", plIds);
        (plRows || []).forEach((p) => { plTitleMap[p.id] = p.title; });

        // Fetch commenter profiles
        const uIds = [...new Set(commentRows.map((c) => c.user_id))];
        const profMap = {};
        const { data: profRows } = await supabase
          .from("profiles")
          .select("id, handle, display_name")
          .in("id", uIds);
        (profRows || []).forEach((p) => { profMap[p.id] = p; });

        const activity = commentRows.map((c) => ({
          ...c,
          playlistTitle: plTitleMap[c.playlist_id] || "a playlist",
          commenterHandle: profMap[c.user_id]?.handle || "someone",
          commenterName: profMap[c.user_id]?.display_name || "",
        }));
        if (alive) setRecentActivity(activity);
      }

      if (alive) setLoading(false);
    })();

    return () => { alive = false; };
  }, [supabase]);

  const isLoggedIn = !!user;
  const hasTaste = (profile?.favorite_genres?.length || 0) + (profile?.favorite_vibes?.length || 0) > 0;
  const hasCommunities = joinedCommunities.length > 0;

  const displayName = profile?.display_name || (profile?.handle ? normHandle(profile.handle) : null);

  const tabs = [
    { key: "foryou", label: "For You" },
    { key: "trending", label: "Trending" },
    { key: "communities", label: "Communities" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">
      <div className="grid lg:grid-cols-[1fr_280px] gap-8">

        {/* ── Main column ───────────────────────────────────────────────── */}
        <div>
          {/* Header */}
          <div className="mb-7 flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: "var(--gold)" }}>
                The Queue
              </div>
              <h1 className="text-3xl font-semibold text-white">
                {isLoggedIn && displayName ? `Hey, ${displayName.replace(/^@/, "")} ` : "Your Feed"}
              </h1>
              <p className="text-white/50 text-sm mt-1">
                {isLoggedIn
                  ? "What's happening in your music world right now."
                  : "Sign in to get a personalized feed."}
              </p>
            </div>
            <Link href="/new" className="inBtn flex-shrink-0 text-sm">
              + New playlist
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-8">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="px-5 py-2 rounded-full text-sm font-medium transition-all"
                style={{
                  background: tab === t.key
                    ? "color-mix(in srgb, var(--gold) 16%, transparent)"
                    : "transparent",
                  color: tab === t.key ? "var(--gold)" : "var(--muted)",
                  border: `1px solid ${tab === t.key
                    ? "color-mix(in srgb, var(--gold) 40%, transparent)"
                    : "color-mix(in srgb, var(--line) 60%, transparent)"}`,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div className="space-y-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-2xl border p-6 animate-pulse" style={{ borderColor: "color-mix(in srgb, var(--line) 50%, transparent)", background: "color-mix(in srgb, var(--midnight) 60%, transparent)" }}>
                  <div className="h-4 w-1/3 rounded mb-3" style={{ background: "color-mix(in srgb, var(--line) 40%, transparent)" }} />
                  <div className="grid grid-cols-3 gap-3">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="rounded-xl aspect-video" style={{ background: "color-mix(in srgb, var(--line) 30%, transparent)" }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── FOR YOU TAB ────────────────────────────────────────────── */}
          {!loading && tab === "foryou" && (
            <div>
              {!isLoggedIn ? (
                <div
                  className="rounded-2xl border px-8 py-16 text-center mb-8"
                  style={{ borderColor: "color-mix(in srgb, var(--line) 60%, transparent)" }}
                >
                  <div className="text-4xl mb-4 text-white/20">&#9835;</div>
                  <div className="text-white font-semibold text-lg mb-2">Sign in to personalize your feed</div>
                  <p className="text-white/40 text-sm mb-6">
                    Get playlists from your communities, based on your taste, and more.
                  </p>
                  <Link
                    href="/login"
                    className="px-6 py-2.5 rounded-full text-sm font-medium"
                    style={{
                      background: "color-mix(in srgb, var(--gold) 16%, transparent)",
                      color: "var(--gold)",
                      border: "1px solid color-mix(in srgb, var(--gold) 40%, transparent)",
                    }}
                  >
                    Sign in
                  </Link>
                </div>
              ) : null}

              {/* From your communities */}
              {isLoggedIn && (
                <Section
                  title="From your communities"
                  subtitle={hasCommunities ? `Based on ${joinedCommunities.slice(0, 3).map((c) => c.name).join(", ")}${joinedCommunities.length > 3 ? ` +${joinedCommunities.length - 3} more` : ""}` : undefined}
                  href="/communities"
                  hrefLabel="Browse communities"
                  empty={
                    !hasCommunities
                      ? "Join communities to see playlists from your scenes."
                      : communityPlaylists.length === 0
                      ? "No tagged playlists yet in your communities."
                      : undefined
                  }
                >
                  {communityPlaylists.length > 0 && (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {communityPlaylists.slice(0, 6).map((p) => (
                        <PlaylistCard key={p.id} p={p} />
                      ))}
                    </div>
                  )}
                </Section>
              )}

              {/* Picked for you */}
              {isLoggedIn && (
                <Section
                  title="Picked for you"
                  subtitle={hasTaste ? "Based on your taste profile" : undefined}
                  href="/explore"
                  hrefLabel="Explore more"
                  empty={
                    !hasTaste
                      ? "Set your music taste in your profile to get personalized picks."
                      : tastePlaylists.length === 0
                      ? "No matching playlists found yet — check back soon."
                      : undefined
                  }
                >
                  {tastePlaylists.length > 0 && (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {tastePlaylists.slice(0, 6).map((p) => (
                        <PlaylistCard key={p.id} p={p} />
                      ))}
                    </div>
                  )}
                  {!hasTaste && (
                    <div className="mt-3">
                      <Link
                        href="/settings/profile"
                        className="text-sm"
                        style={{ color: "var(--gold)" }}
                      >
                        Update your taste profile &rarr;
                      </Link>
                    </div>
                  )}
                </Section>
              )}

              {/* Trending (always shown at bottom of For You) */}
              <Section
                title={isLoggedIn ? "Trending right now" : "Trending playlists"}
                subtitle="Most liked across The Queue"
                href="/explore"
              >
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {trending.slice(0, 6).map((p) => (
                    <PlaylistCard key={p.id} p={p} />
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* ── TRENDING TAB ───────────────────────────────────────────── */}
          {!loading && tab === "trending" && (
            <div>
              <Section title="Trending playlists" subtitle="Sorted by most likes across The Queue">
                {trending.length === 0 ? (
                  <p className="text-white/30 text-sm">No playlists yet.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {trending.map((p) => (
                      <PlaylistCard key={p.id} p={p} />
                    ))}
                  </div>
                )}
              </Section>
            </div>
          )}

          {/* ── COMMUNITIES TAB ────────────────────────────────────────── */}
          {!loading && tab === "communities" && (
            <div>
              {!isLoggedIn ? (
                <div
                  className="rounded-2xl border px-8 py-16 text-center"
                  style={{ borderColor: "color-mix(in srgb, var(--line) 60%, transparent)" }}
                >
                  <div className="text-4xl mb-3 text-white/20">&#127925;</div>
                  <div className="text-white font-semibold mb-2">Sign in to see your communities</div>
                  <Link href="/login" className="text-sm" style={{ color: "var(--gold)" }}>Sign in &rarr;</Link>
                </div>
              ) : !hasCommunities ? (
                <div
                  className="rounded-2xl border px-8 py-16 text-center"
                  style={{ borderColor: "color-mix(in srgb, var(--line) 60%, transparent)" }}
                >
                  <div className="text-4xl mb-3 text-white/20">&#9835;</div>
                  <div className="text-white font-semibold mb-2">You haven&apos;t joined any communities</div>
                  <p className="text-white/40 text-sm mb-5">Find your people — by genre, region, or vibe.</p>
                  <Link
                    href="/communities"
                    className="px-6 py-2.5 rounded-full text-sm font-medium"
                    style={{
                      background: "color-mix(in srgb, var(--gold) 16%, transparent)",
                      color: "var(--gold)",
                      border: "1px solid color-mix(in srgb, var(--gold) 40%, transparent)",
                    }}
                  >
                    Browse communities
                  </Link>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">Your communities</h2>
                    <Link href="/communities" className="text-xs" style={{ color: "var(--gold)" }}>
                      Browse all &rarr;
                    </Link>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 mb-8">
                    {joinedCommunities.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/communities/${c.slug}`}
                        className="flex items-center gap-3 p-4 rounded-2xl border transition hover:border-white/20"
                        style={{
                          borderColor: "color-mix(in srgb, var(--line) 70%, transparent)",
                          background: "color-mix(in srgb, var(--midnight) 70%, transparent)",
                        }}
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg"
                          style={{ background: "color-mix(in srgb, var(--plum) 25%, var(--midnight))" }}
                        >
                          &#9835;
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{c.name}</div>
                          <div className="text-xs" style={{ color: "var(--muted)" }}>
                            {(c.member_count || 0).toLocaleString()} members
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>

                  {communityPlaylists.length > 0 && (
                    <Section
                      title="Recent from your communities"
                      subtitle="Playlists tagged with your communities"
                    >
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {communityPlaylists.map((p) => (
                          <PlaylistCard key={p.id} p={p} />
                        ))}
                      </div>
                    </Section>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <aside className="hidden lg:block space-y-8">

          {/* Featured Creators */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white text-sm">Featured Creators</h3>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 rounded-2xl animate-pulse" style={{ background: "color-mix(in srgb, var(--line) 30%, transparent)" }} />
                ))}
              </div>
            ) : creators.length === 0 ? (
              <p className="text-white/30 text-xs">No creators yet.</p>
            ) : (
              <div className="space-y-2">
                {creators.map((c) => <CreatorCard key={c.id} creator={c} />)}
              </div>
            )}
          </div>

          {/* Recent discussions */}
          {recentActivity.length > 0 && (
            <div>
              <h3 className="font-semibold text-white text-sm mb-3">Recent discussions</h3>
              <div className="space-y-3">
                {recentActivity.map((a) => (
                  <Link
                    key={a.id}
                    href={`/p/${a.playlist_id}`}
                    className="block p-3 rounded-2xl border transition hover:border-white/20"
                    style={{
                      borderColor: "color-mix(in srgb, var(--line) 60%, transparent)",
                      background: "color-mix(in srgb, var(--midnight) 70%, transparent)",
                    }}
                  >
                    <p className="text-xs text-white/80 line-clamp-2 leading-relaxed">
                      &ldquo;{a.body}&rdquo;
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px]" style={{ color: "var(--gold)" }}>
                        @{a.commenterHandle}
                      </span>
                      <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                        on <span className="text-white/50">{a.playlistTitle}</span>
                      </span>
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>
                      {timeAgo(a.created_at)}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Quick links */}
          <div
            className="rounded-2xl border p-4"
            style={{
              borderColor: "color-mix(in srgb, var(--line) 60%, transparent)",
              background: "color-mix(in srgb, var(--midnight) 70%, transparent)",
            }}
          >
            <h3 className="font-semibold text-white text-sm mb-3">Explore</h3>
            <div className="space-y-2">
              {[
                { href: "/explore", label: "Browse all playlists" },
                { href: "/communities", label: "Find communities" },
                { href: "/new", label: "Create a playlist" },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between text-sm py-1 transition hover:text-white"
                  style={{ color: "var(--muted)" }}
                >
                  {label}
                  <span className="opacity-50">&rarr;</span>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
