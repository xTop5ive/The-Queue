"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}

function fmtHandle(h) {
  const v = String(h || "").trim();
  if (!v) return "@user";
  return v.startsWith("@") ? v : `@${v}`;
}

function normalizePlaylist(row) {
  return {
    ...row,
    id: row.id,
    title: row.title,
    description: row.description,
    tags: row.tags || [],
    isPublic: row.is_public ?? true,
    createdAt: row.created_at,
    likes: row.likes_count ?? 0,
    coverUrl: row.cover_url || "/placeholder-cover.png",
    userId: row.user_id,
  };
}

function titleCase(value) {
  return String(value || "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useMemo(() => getSupabase(), []);

  const handleParam =
    typeof params?.handle === "string" ? params.handle : Array.isArray(params?.handle) ? params.handle[0] : "";

  const handle = fmtHandle(decodeURIComponent(handleParam || "")).toLowerCase();

  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState(null);

  const [profile, setProfile] = useState(null); // { id, handle, username, avatar_url }
  const [playlists, setPlaylists] = useState([]);

  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState("overview");

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followsYou, setFollowsYou] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError("");

      try {
        // 1) get logged-in viewer (optional)
        const { data: auth } = await supabase.auth.getUser();
        const u = auth?.user || null;
        if (alive) setViewer(u);

        // 2) try to find profile by handle in `profiles` table
        //    NOTE: if you don’t have `profiles`, this will fail gracefully.
        let foundProfile = null;

        try {
          const handleNoAt = handle.replace(/^@/, "");
          const { data: prof, error: profErr } = await supabase
            .from("profiles")
            .select("id, handle, username, display_name, avatar_url, bio, music_dna, role, favorite_artists, favorite_albums, favorite_producers, favorite_djs, communities, top_songs")
            .or(`handle.eq.${handleNoAt},username.eq.${handleNoAt}`)
            .maybeSingle();

          if (!profErr && prof?.id) {
            foundProfile = prof;
          }
        } catch {
          // ignore: profiles table might not exist yet
        }

        // 3) fallback: if profiles not found, and this handle matches the logged-in user, use their id
        if (!foundProfile && u) {
          const raw =
            u.user_metadata?.handle ||
            u.user_metadata?.username ||
            (u.email ? u.email.split("@")[0] : "");

          const viewerHandle = fmtHandle(raw).toLowerCase();
          if (viewerHandle === handle) {
            foundProfile = {
              id: u.id,
              handle: viewerHandle,
              username: raw,
              avatar_url: null,
            };
          }
        }

        if (!foundProfile) {
          if (alive) {
            setProfile({ id: null, handle, username: handle.replace(/^@/, ""), avatar_url: null });
            setPlaylists([]);
            setLoading(false);
          }
          return;
        }

        if (alive) setProfile(foundProfile);

        // 4) fetch followers/following counts + viewer follow status
        try {
          const [{ count: fwers }, { count: fwing }] = await Promise.all([
            supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", foundProfile.id),
            supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", foundProfile.id),
          ]);
          if (alive) {
            setFollowersCount(fwers ?? 0);
            setFollowingCount(fwing ?? 0);
          }
          if (u && u.id !== foundProfile.id) {
            const [{ data: fRow }, { data: fYouRow }] = await Promise.all([
              supabase.from("follows").select("follower_id").eq("follower_id", u.id).eq("following_id", foundProfile.id).maybeSingle(),
              supabase.from("follows").select("follower_id").eq("follower_id", foundProfile.id).eq("following_id", u.id).maybeSingle(),
            ]);
            if (alive) {
              setIsFollowing(!!fRow);
              setFollowsYou(!!fYouRow);
            }
          }
        } catch {
          // follows table may not exist yet
        }

        // 5) get playlists for that user_id
        const { data: rows, error: plErr } = await supabase
          .from("playlists")
          .select("id, user_id, title, description, tags, is_public, cover_url, created_at, likes_count")
          .eq("user_id", foundProfile.id)
          .order("created_at", { ascending: false });

        if (plErr) throw plErr;

        const mapped = (rows || []).map(normalizePlaylist);

        // If viewer is not owner, only show public playlists
        const filtered =
          viewer?.id && viewer.id === foundProfile.id ? mapped : mapped.filter((x) => x.isPublic);

        if (alive) setPlaylists(filtered);
      } catch (e) {
        if (alive) setError(e?.message || "Could not load profile.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [handle, supabase]); // keep it simple

  const displayHandle = fmtHandle(profile?.handle || handle);

  const isOwner = !!(viewer?.id && profile?.id && viewer.id === profile.id);

  const handleFollow = async () => {
    if (!viewer) { router.push(`/login?next=${encodeURIComponent(`/u/${handle}`)}`); return; }
    if (followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await supabase.from("follows").delete().eq("follower_id", viewer.id).eq("following_id", profile.id);
        setIsFollowing(false);
        setFollowersCount((c) => Math.max(0, c - 1));
      } else {
        await supabase.from("follows").insert({ follower_id: viewer.id, following_id: profile.id });
        setIsFollowing(true);
        setFollowersCount((c) => c + 1);
      }
    } catch (e) {
      console.error("Follow error:", e);
    } finally {
      setFollowLoading(false);
    }
  };

  const insights = useMemo(() => {
    const tagCounts = new Map();
    let totalLikes = 0;

    for (const playlist of playlists) {
      totalLikes += Number(playlist?.likes || 0);
      for (const tag of playlist?.tags || []) {
        const key = String(tag || "").trim().toLowerCase();
        if (!key) continue;
        tagCounts.set(key, (tagCounts.get(key) || 0) + 1);
      }
    }

    const topTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
      .slice(0, 8);

    // Prefer saved profile communities; fall back to top playlist tags
    const profileCommunities = Array.isArray(profile?.communities) ? profile.communities : [];
    const communities = (profileCommunities.length ? profileCommunities : topTags.slice(0, 5)).map((tag) => ({
      slug: String(tag).toLowerCase(),
      label: titleCase(tag),
    }));

    const featuredPlaylists = [...playlists]
      .sort((a, b) => Number(b?.likes || 0) - Number(a?.likes || 0))
      .slice(0, 3);

    const musicDNA = topTags.length
      ? `${topTags.slice(0, 3).map(titleCase).join(" • ")} vibes`
      : "Still building this music identity.";

    return {
      totalLikes,
      topTags,
      communities,
      featuredPlaylists,
      musicDNA,
      favoriteArtists: Array.isArray(profile?.favorite_artists)
        ? profile.favorite_artists.slice(0, 8)
        : [],
      favoriteAlbums: Array.isArray(profile?.favorite_albums)
        ? profile.favorite_albums.slice(0, 8)
        : [],
      favoriteProducers: Array.isArray(profile?.favorite_producers)
        ? profile.favorite_producers.slice(0, 8)
        : [],
      favoriteDjs: Array.isArray(profile?.favorite_djs)
        ? profile.favorite_djs.slice(0, 8)
        : [],
      topSongs: Array.isArray(profile?.top_songs)
        ? profile.top_songs.slice(0, 5)
        : [],
    };
  }, [playlists, profile]);

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">
      {/* Top */}
      <div className="flex items-center justify-between">
        <Link href="/explore" className="text-sm underline text-white/70 hover:text-white">
          ← Back to Explore
        </Link>

        {viewer ? (
          <Link href="/new" className="inBtn">
            + New playlist
          </Link>
        ) : (
          <Link href="/login" className="inBtn">
            Sign in
          </Link>
        )}
      </div>

      {/* Header */}
      <div className="mt-8 card p-6">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full border flex-shrink-0 overflow-hidden"
            style={{
              borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
              background: "color-mix(in srgb, var(--midnight) 85%, transparent)",
            }}
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={displayHandle}
                className="w-full h-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                Creator Profile
              </div>
              {profile?.role ? (
                <span
                  className="text-xs px-2.5 py-0.5 rounded-full border"
                  style={{
                    borderColor: "color-mix(in srgb, var(--gold) 60%, transparent)",
                    color: "color-mix(in srgb, var(--gold) 90%, white)",
                    background: "color-mix(in srgb, var(--gold) 10%, transparent)",
                  }}
                >
                  {profile.role}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-2xl font-semibold truncate">{displayHandle}</div>
              {followsYou && !isOwner && (
                <span
                  className="text-xs px-2.5 py-0.5 rounded-full border flex-shrink-0"
                  style={{
                    borderColor: "color-mix(in srgb, var(--line) 60%, transparent)",
                    color: "var(--muted)",
                  }}
                >
                  Follows you
                </span>
              )}
            </div>
            <div className="text-white/80 text-sm mt-1 truncate">
              {profile?.display_name || (profile?.username ? titleCase(profile.username) : "Music curator")}
            </div>
            {profile?.bio ? (
              <div className="text-white/60 text-sm mt-2 line-clamp-2">{profile.bio}</div>
            ) : null}
            <div className="text-white/60 text-sm mt-2">
              {playlists.length} playlist{playlists.length === 1 ? "" : "s"} • {insights.totalLikes} total likes • {followersCount} follower{followersCount === 1 ? "" : "s"} • {followingCount} following
            </div>
            <div className="text-white/70 text-sm mt-3">
              {profile?.music_dna || insights.musicDNA}
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "overview", label: "Overview" },
              { key: "playlists", label: "Playlists" },
            ].map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className="px-3 py-1.5 rounded-full border text-sm"
                  style={{
                    borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                    background: active ? "color-mix(in srgb, var(--gold) 16%, transparent)" : "transparent",
                    color: "white",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {isOwner ? (
            <Link
              href="/settings"
              className="px-4 py-2 rounded-full border text-sm"
              style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
            >
              Edit profile
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleFollow}
              disabled={followLoading}
              className="px-4 py-2 rounded-full border text-sm transition"
              style={{
                borderColor: isFollowing
                  ? "color-mix(in srgb, var(--line) 80%, transparent)"
                  : "color-mix(in srgb, var(--gold) 60%, transparent)",
                background: isFollowing
                  ? "transparent"
                  : "color-mix(in srgb, var(--gold) 14%, transparent)",
                color: isFollowing ? "rgba(255,255,255,0.6)" : "color-mix(in srgb, var(--gold) 90%, white)",
                opacity: followLoading ? 0.6 : 1,
              }}
            >
              {followLoading ? "…" : isFollowing ? "Following" : "Follow"}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="card p-6 mt-6 text-white/70">Loading profile…</div>
      ) : error ? (
        <div className="card p-6 mt-6 text-red-300">{error}</div>
      ) : activeTab === "overview" ? (
        <>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="card p-5">
              <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                Music DNA
              </div>
              <div className="mt-3 text-lg font-semibold">{insights.musicDNA}</div>
              <p className="mt-3 text-sm text-white/60">
                This section summarizes the taste profile based on public playlists, tags, and curation style.
              </p>
            </div>

            <div className="card p-5">
              <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                Favorite Genres
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {insights.topTags.length ? (
                  insights.topTags.slice(0, 6).map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1.5 rounded-full border text-sm"
                      style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                    >
                      {titleCase(tag)}
                    </span>
                  ))
                ) : (
                  <span className="text-white/50 text-sm">No genre signals yet.</span>
                )}
              </div>
            </div>

            <div className="card p-5">
              <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                Favorite Artists
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {insights.favoriteArtists.length ? (
                  insights.favoriteArtists.map((artist) => (
                    <span
                      key={artist}
                      className="px-3 py-1.5 rounded-full border text-sm"
                      style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                    >
                      {artist}
                    </span>
                  ))
                ) : (
                  <>
                    <span className="text-white/50 text-sm">No favorite artists added yet.</span>
                    {isOwner ? (
                      <Link
                        href="/settings"
                        className="text-sm underline text-white/70 hover:text-white w-full mt-2"
                      >
                        Add favorite artists
                      </Link>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            <div className="card p-5">
              <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                Communities
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {insights.communities.length ? (
                  insights.communities.map((community) => (
                    <button
                      key={community.slug}
                      type="button"
                      className="px-3 py-1.5 rounded-full border text-sm"
                      style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                    >
                      {community.label}
                    </button>
                  ))
                ) : (
                  <span className="text-white/50 text-sm">Communities coming soon.</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-2">
            <div className="card p-5">
              <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                Top Songs Right Now
              </div>
              <div className="mt-4 grid gap-2">
                {insights.topSongs.length ? (
                  insights.topSongs.map((song, idx) => {
                    const songTitle = typeof song === "string" ? song : song?.title || `Song ${idx + 1}`;
                    const songArtist = typeof song === "string" ? "" : song?.artist || "";
                    return (
                      <div
                        key={`${songTitle}-${idx}`}
                        className="rounded-2xl border px-3 py-2"
                        style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                      >
                        <div className="text-sm font-semibold truncate">{songTitle}</div>
                        {songArtist ? (
                          <div className="text-xs text-white/60 truncate mt-1">{songArtist}</div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <>
                    <span className="text-white/50 text-sm">No top songs added yet.</span>
                    {isOwner ? (
                      <Link
                        href="/settings"
                        className="text-sm underline text-white/70 hover:text-white mt-2"
                      >
                        Add top songs
                      </Link>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            <div className="card p-5">
              <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                Favorite Albums
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {insights.favoriteAlbums.length ? (
                  insights.favoriteAlbums.map((album) => (
                    <span
                      key={album}
                      className="px-3 py-1.5 rounded-full border text-sm"
                      style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                    >
                      {album}
                    </span>
                  ))
                ) : (
                  <>
                    <span className="text-white/50 text-sm">No favorite albums added yet.</span>
                    {isOwner ? (
                      <Link
                        href="/settings"
                        className="text-sm underline text-white/70 hover:text-white w-full mt-2"
                      >
                        Add favorite albums
                      </Link>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            <div className="card p-5">
              <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                Favorite Producers
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {insights.favoriteProducers.length ? (
                  insights.favoriteProducers.map((producer) => (
                    <span
                      key={producer}
                      className="px-3 py-1.5 rounded-full border text-sm"
                      style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                    >
                      {producer}
                    </span>
                  ))
                ) : (
                  <>
                    <span className="text-white/50 text-sm">No favorite producers added yet.</span>
                    {isOwner ? (
                      <Link
                        href="/settings"
                        className="text-sm underline text-white/70 hover:text-white w-full mt-2"
                      >
                        Add favorite producers
                      </Link>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            <div className="card p-5">
              <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                Favorite DJs
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {insights.favoriteDjs.length ? (
                  insights.favoriteDjs.map((dj) => (
                    <span
                      key={dj}
                      className="px-3 py-1.5 rounded-full border text-sm"
                      style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                    >
                      {dj}
                    </span>
                  ))
                ) : (
                  <>
                    <span className="text-white/50 text-sm">No favorite DJs added yet.</span>
                    {isOwner ? (
                      <Link
                        href="/settings"
                        className="text-sm underline text-white/70 hover:text-white w-full mt-2"
                      >
                        Add favorite DJs
                      </Link>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
            <div className="card p-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                    Featured Playlists
                  </div>
                  <h2 className="text-2xl font-semibold mt-2">Top picks from this profile</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("playlists")}
                  className="text-sm underline text-white/70 hover:text-white"
                >
                  View all playlists
                </button>
              </div>

              {insights.featuredPlaylists.length ? (
                <div className="mt-5 grid gap-3">
                  {insights.featuredPlaylists.map((p) => (
                    <Link
                      key={p.id}
                      href={`/p/${p.id}`}
                      className="rounded-2xl border p-3 flex items-center gap-3 hover:bg-white/5 transition"
                      style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                    >
                      <img
                        src={p.coverUrl || "/placeholder-cover.png"}
                        alt=""
                        className="w-16 h-16 rounded-xl object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{p.title}</div>
                        <div className="text-sm text-white/60 truncate">
                          {p.description || "No description yet."}
                        </div>
                      </div>
                      <div className="text-sm text-white/60">♥ {p.likes}</div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mt-5 text-white/50 text-sm">No featured playlists yet.</div>
              )}
            </div>

            <div className="card p-5">
              <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                Profile Stats
              </div>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}>
                  <div className="text-white/60 text-sm">Public playlists</div>
                  <div className="text-2xl font-semibold mt-1">{playlists.length}</div>
                </div>
                <div className="rounded-2xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}>
                  <div className="text-white/60 text-sm">Total likes</div>
                  <div className="text-2xl font-semibold mt-1">{insights.totalLikes}</div>
                </div>
                <div className="rounded-2xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}>
                  <div className="text-white/60 text-sm">Followers</div>
                  <div className="text-2xl font-semibold mt-1">{followersCount}</div>
                </div>
                <div className="rounded-2xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}>
                  <div className="text-white/60 text-sm">Following</div>
                  <div className="text-2xl font-semibold mt-1">{followingCount}</div>
                </div>
                <div className="rounded-2xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}>
                  <div className="text-white/60 text-sm">Strongest vibe</div>
                  <div className="text-lg font-semibold mt-1">
                    {insights.topTags[0] ? titleCase(insights.topTags[0]) : "Still loading taste"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mt-8 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Playlists</h2>
              <p className="text-white/60 text-sm mt-1">Real playlists pulled from Supabase.</p>
            </div>
          </div>

          {playlists.length ? (
            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {playlists.map((p) => (
                <div key={p.id} className="card overflow-hidden hover:-translate-y-0.5 transition">
                  <Link href={`/p/${p.id}`} className="block">
                    <div className="relative">
                      <img
                        src={p.coverUrl || "/placeholder-cover.png"}
                        alt=""
                        className="w-full object-cover"
                        style={{ height: 170 }}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <div
                        className="absolute inset-x-0 bottom-0 p-3"
                        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)" }}
                      >
                        <div className="font-semibold leading-tight">{p.title}</div>
                        <div className="text-xs" style={{ color: "var(--muted)" }}>
                          ♥ {p.likes} likes
                        </div>
                      </div>
                    </div>
                  </Link>

                  <div className="p-4">
                    {p.description ? (
                      <div className="text-sm text-white/70 line-clamp-2">{p.description}</div>
                    ) : (
                      <div className="text-sm text-white/40">No description yet.</div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {(p.tags || []).slice(0, 4).map((t) => (
                        <Link
                          key={`${p.id}-${t}`}
                          href={`/explore?tags=${encodeURIComponent(String(t).toLowerCase())}`}
                          className="px-2.5 py-1 rounded-full border text-xs"
                          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                        >
                          #{t}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-6 mt-4">
              <p className="text-white/60">No playlists found for this creator (or they’re private).</p>
              {viewer ? (
                <div className="mt-3">
                  <Link href="/new" className="inBtn">
                    Create your first playlist
                  </Link>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}