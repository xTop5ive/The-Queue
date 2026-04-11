"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";

function fmtHandle(h) {
  return String(h || "").replace(/^@/, "") || "user";
}

function fmtTime(d) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const pill = {
  borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
};

export default function CommunityPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = typeof params?.slug === "string" ? params.slug : Array.isArray(params?.slug) ? params.slug[0] : "";
  const supabase = useMemo(() => createBrowserClient(), []);

  // Core state
  const [community, setCommunity] = useState(null);
  const [subCommunities, setSubCommunities] = useState([]);
  const [parent, setParent] = useState(null);
  const [isJoined, setIsJoined] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Tab — read from URL search param
  const [tab, setTab] = useState(searchParams?.get("tab") || "overview");

  // Playlists tab
  const [playlists, setPlaylists] = useState([]);
  const [playlistsLoaded, setPlaylistsLoaded] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [myPlaylists, setMyPlaylists] = useState([]);
  const [sharePlaylistId, setSharePlaylistId] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMsg, setShareMsg] = useState("");

  // Discussions tab
  const [posts, setPosts] = useState([]);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [expandedPost, setExpandedPost] = useState(null);
  const [replies, setReplies] = useState({});
  const [replyBody, setReplyBody] = useState({});
  const [replyImageUrl, setReplyImageUrl] = useState({});
  const [replyBusy, setReplyBusy] = useState({});
  const [votesMap, setVotesMap] = useState({});
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostBody, setNewPostBody] = useState("");
  const [newPostImageUrl, setNewPostImageUrl] = useState("");
  const [newPostLinkUrl, setNewPostLinkUrl] = useState("");
  const [newPostLinkTitle, setNewPostLinkTitle] = useState("");
  const [postBusy, setPostBusy] = useState(false);
  const [postError, setPostError] = useState("");
  const [postsError, setPostsError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  // Members tab
  const [members, setMembers] = useState([]);
  const [membersLoaded, setMembersLoaded] = useState(false);

  // Initial load
  useEffect(() => {
    if (!slug) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");

        const [{ data: auth }, { data: comm, error: commErr }] = await Promise.all([
          supabase.auth.getUser(),
          supabase.from("communities").select("*").eq("slug", slug).maybeSingle(),
        ]);

        if (commErr || !comm) { if (alive) { setError("Community not found."); setLoading(false); } return; }
        if (alive) setCommunity(comm);

        const user = auth?.user || null;
        if (alive) setUserId(user?.id || null);

        const [subRes, parentRes, joinRes, profRes] = await Promise.all([
          supabase.from("communities").select("slug,name,description,member_count").eq("parent_slug", slug),
          comm.parent_slug
            ? supabase.from("communities").select("slug,name").eq("slug", comm.parent_slug).maybeSingle()
            : Promise.resolve({ data: null }),
          user
            ? supabase.from("community_members").select("user_id").eq("user_id", user.id).eq("community_slug", slug).maybeSingle()
            : Promise.resolve({ data: null }),
          user
            ? supabase.from("profiles").select("handle,display_name,avatar_url").eq("id", user.id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        if (alive) {
          setSubCommunities(subRes.data || []);
          setParent(parentRes.data || null);
          setIsJoined(!!joinRes.data);
          setUserProfile(profRes.data || null);
          setIsAdmin(!!user && comm.creator_user_id === user.id);
          setLoading(false);
        }
      } catch (e) {
        if (alive) { setError(e?.message || "Failed to load community."); setLoading(false); }
      }
    })();
    return () => { alive = false; };
  }, [slug, supabase]);

  // Lazy-load playlists
  useEffect(() => {
    if ((tab === "playlists" || tab === "overview") && !playlistsLoaded && slug) {
      setPlaylistsLoaded(true);
      (async () => {
        const [sharedRes, taggedRes] = await Promise.all([
          supabase.from("community_playlists")
            .select("playlist_id, playlists(id,title,description,cover_url,tags,likes_count,owner_handle,user_id)")
            .eq("community_slug", slug),
          supabase.from("playlists")
            .select("id,title,description,cover_url,tags,likes_count,owner_handle,user_id")
            .eq("is_public", true)
            .contains("tags", [slug])
            .order("likes_count", { ascending: false })
            .limit(12),
        ]);

        const seen = new Set();
        const merged = [];

        // Shared first
        for (const row of (sharedRes.data || [])) {
          const p = row.playlists;
          if (p && !seen.has(p.id)) { seen.add(p.id); merged.push(normalizePlaylist(p)); }
        }
        // Tag-based
        for (const p of (taggedRes.data || [])) {
          if (!seen.has(p.id)) { seen.add(p.id); merged.push(normalizePlaylist(p)); }
        }

        setPlaylists(merged);
      })();
    }
  }, [tab, playlistsLoaded, slug, supabase]);

  // Lazy-load discussions
  useEffect(() => {
    if (tab === "discussions" && !postsLoaded && slug) {
      setPostsLoaded(true);
      setPostsError("");
      (async () => {
        const { data, error } = await supabase
          .from("community_posts")
          .select("id,title,body,image_url,link_url,link_title,reply_count,likes_count,dislikes_count,created_at,user_id")
          .eq("community_slug", slug)
          .order("created_at", { ascending: false })
          .limit(30);
        if (error) {
          setPostsError(error.message || JSON.stringify(error));
          return;
        }
        const rows = data || [];
        // Fetch profiles separately
        const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
        const profileMap = {};
        if (userIds.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id,handle,display_name,avatar_url")
            .in("id", userIds);
          (profs || []).forEach((p) => { profileMap[p.id] = p; });
        }
        setPosts(rows.map((r) => ({ ...r, profiles: profileMap[r.user_id] || null, likes_count: r.likes_count || 0, dislikes_count: r.dislikes_count || 0 })));

        // Fetch current user's votes
        if (userId && rows.length) {
          const postIds = rows.map((r) => r.id);
          const { data: voteRows } = await supabase
            .from("community_post_votes")
            .select("post_id,vote")
            .eq("user_id", userId)
            .in("post_id", postIds);
          const vm = {};
          (voteRows || []).forEach((v) => { vm[v.post_id] = v.vote; });
          setVotesMap(vm);
        }
      })();
    }
  }, [tab, postsLoaded, slug, supabase]);

  // Lazy-load members
  useEffect(() => {
    if (tab === "members" && !membersLoaded && slug) {
      setMembersLoaded(true);
      (async () => {
        const { data } = await supabase
          .from("community_members")
          .select("user_id")
          .eq("community_slug", slug)
          .order("joined_at", { ascending: false })
          .limit(40);
        const userIds = (data || []).map((r) => r.user_id).filter(Boolean);
        if (userIds.length) {
          const { data: profs } = await supabase.from("profiles").select("id,handle,display_name,avatar_url,role").in("id", userIds);
          setMembers(profs || []);
        } else {
          setMembers([]);
        }
      })();
    }
  }, [tab, membersLoaded, slug, supabase]);

  function normalizePlaylist(r) {
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      coverUrl: r.cover_url || "/placeholder-cover.png",
      tags: r.tags || [],
      likes: r.likes_count ?? 0,
      rawHandle: fmtHandle(r.owner_handle || ""),
    };
  }

  const changeTab = (t) => {
    setTab(t);
    router.replace(`/communities/${slug}?tab=${t}`, { scroll: false });
  };

  const handleJoin = async () => {
    if (!userId || joinLoading) return;
    setJoinLoading(true);
    try {
      if (isJoined) {
        await supabase.from("community_members").delete().eq("user_id", userId).eq("community_slug", slug);
        setIsJoined(false);
        setCommunity((c) => ({ ...c, member_count: Math.max(0, c.member_count - 1) }));
        setMembers((prev) => prev.filter((m) => m.id !== userId));
      } else {
        await supabase.from("community_members").insert({ user_id: userId, community_slug: slug });
        setIsJoined(true);
        setCommunity((c) => ({ ...c, member_count: c.member_count + 1 }));
      }
    } finally {
      setJoinLoading(false);
    }
  };

  // Share playlist to community
  const openShare = async () => {
    if (!userId) return;
    setShareOpen(true);
    setShareMsg("");
    if (!myPlaylists.length) {
      const { data } = await supabase.from("playlists").select("id,title").eq("user_id", userId).order("created_at", { ascending: false });
      setMyPlaylists(data || []);
      if (data?.length) setSharePlaylistId(data[0].id);
    }
  };

  const submitShare = async () => {
    if (!sharePlaylistId || shareBusy) return;
    setShareBusy(true);
    setShareMsg("");
    const { error } = await supabase.from("community_playlists").insert({
      community_slug: slug, playlist_id: sharePlaylistId, user_id: userId,
    });
    if (error) {
      setShareMsg(error.code === "23505" ? "Already shared to this community." : error.message);
    } else {
      setShareMsg("Shared!");
      setPlaylistsLoaded(false); // refresh
      setTimeout(() => { setShareOpen(false); setShareMsg(""); }, 1200);
    }
    setShareBusy(false);
  };

  // Expand post & load replies
  const togglePost = async (postId) => {
    if (expandedPost === postId) { setExpandedPost(null); return; }
    setExpandedPost(postId);
    if (!replies[postId]) {
      const { data } = await supabase
        .from("community_post_replies")
        .select("id,body,image_url,created_at,user_id")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      const rows = data || [];
      const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
      const profileMap = {};
      if (userIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id,handle,display_name,avatar_url").in("id", userIds);
        (profs || []).forEach((p) => { profileMap[p.id] = p; });
      }
      setReplies((prev) => ({ ...prev, [postId]: rows.map((r) => ({ ...r, profiles: profileMap[r.user_id] || null })) }));
    }
  };

  const submitReply = async (postId) => {
    const body = (replyBody[postId] || "").trim();
    const imageUrl = (replyImageUrl[postId] || "").trim();
    if (!body || replyBusy[postId]) return;
    setReplyBusy((prev) => ({ ...prev, [postId]: true }));

    // Insert then fetch separately — Supabase doesn't support join selects on insert returns
    const { data: inserted, error } = await supabase
      .from("community_post_replies")
      .insert({ post_id: postId, user_id: userId, body, image_url: imageUrl || null })
      .select("id,body,image_url,created_at,user_id")
      .maybeSingle();

    if (!error && inserted) {
      const { data: prof } = await supabase.from("profiles").select("id,handle,display_name,avatar_url").eq("id", userId).maybeSingle();
      const full = { ...inserted, profiles: prof || null };

      if (full) {
        setReplies((prev) => ({ ...prev, [postId]: [...(prev[postId] || []), full] }));
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, reply_count: p.reply_count + 1 } : p));
      }
      setReplyBody((prev) => ({ ...prev, [postId]: "" }));
      setReplyImageUrl((prev) => ({ ...prev, [postId]: "" }));
    }
    setReplyBusy((prev) => ({ ...prev, [postId]: false }));
  };

  const submitPost = async () => {
    if (!newPostTitle.trim() || !newPostBody.trim() || postBusy) return;
    setPostBusy(true);
    setPostError("");

    const payload = {
      community_slug: slug,
      user_id: userId,
      title: newPostTitle.trim(),
      body: newPostBody.trim(),
      image_url: newPostImageUrl.trim() || null,
      link_url: newPostLinkUrl.trim() || null,
      link_title: newPostLinkTitle.trim() || null,
    };

    // Insert then fetch separately — Supabase doesn't support join selects on insert returns
    const { data: inserted, error } = await supabase
      .from("community_posts")
      .insert(payload)
      .select("id")
      .maybeSingle();

    if (error) {
      setPostError(error.message);
      setPostBusy(false);
      return;
    }

    if (inserted) {
      const { data: full } = await supabase
        .from("community_posts")
        .select("id,title,body,image_url,link_url,link_title,reply_count,created_at,user_id")
        .eq("id", inserted.id)
        .maybeSingle();
      const { data: prof } = await supabase.from("profiles").select("id,handle,display_name,avatar_url").eq("id", userId).maybeSingle();

      if (full) setPosts((prev) => [{ ...full, profiles: prof || null }, ...prev]);
      setCommunity((c) => ({ ...c, post_count: (c.post_count || 0) + 1 }));
      setNewPostTitle("");
      setNewPostBody("");
      setNewPostImageUrl("");
      setNewPostLinkUrl("");
      setNewPostLinkTitle("");
      setShowNewPost(false);
    }
    setPostBusy(false);
  };

  const votePost = async (postId, vote) => {
    if (!userId) return;
    const current = votesMap[postId];
    // Toggle off if same vote
    const newVote = current === vote ? null : vote;

    // Optimistic update
    setVotesMap((prev) => ({ ...prev, [postId]: newVote }));
    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p;
      let likes = p.likes_count;
      let dislikes = p.dislikes_count;
      if (current === "up") likes--;
      if (current === "down") dislikes--;
      if (newVote === "up") likes++;
      if (newVote === "down") dislikes++;
      return { ...p, likes_count: Math.max(0, likes), dislikes_count: Math.max(0, dislikes) };
    }));

    if (newVote === null) {
      await supabase.from("community_post_votes").delete().eq("user_id", userId).eq("post_id", postId);
    } else {
      await supabase.from("community_post_votes").upsert({ user_id: userId, post_id: postId, vote: newVote }, { onConflict: "user_id,post_id" });
    }
  };

  const deletePost = async (postId) => {
    if (!window.confirm("Delete this post?")) return;
    const { error } = await supabase.from("community_posts").delete().eq("id", postId);
    if (!error) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setCommunity((c) => ({ ...c, post_count: Math.max(0, (c.post_count || 1) - 1) }));
      if (expandedPost === postId) setExpandedPost(null);
    }
  };

  const deleteReply = async (postId, replyId) => {
    if (!window.confirm("Delete this reply?")) return;
    const { error } = await supabase.from("community_post_replies").delete().eq("id", replyId);
    if (!error) {
      setReplies((prev) => ({ ...prev, [postId]: (prev[postId] || []).filter((r) => r.id !== replyId) }));
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, reply_count: Math.max(0, p.reply_count - 1) } : p));
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) return <div className="max-w-5xl mx-auto px-5 py-16 text-white/50 text-center">Loading…</div>;
  if (error || !community) return (
    <div className="max-w-5xl mx-auto px-5 py-16 text-center">
      <div className="text-white/50">{error || "Community not found."}</div>
      <Link href="/communities" className="mt-4 inline-block text-sm underline text-white/60">← All Communities</Link>
    </div>
  );

  const TABS = [
    { key: "overview", label: "Overview" },
    { key: "playlists", label: `Playlists${playlists.length ? ` (${playlists.length})` : ""}` },
    { key: "discussions", label: `Discussions${community.post_count ? ` (${community.post_count})` : ""}` },
    { key: "members", label: `Members (${community.member_count})` },
  ];

  return (
    <div className="max-w-5xl mx-auto px-5 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--muted)" }}>
        <Link href="/communities" className="hover:underline">Communities</Link>
        {parent && <><span>/</span><Link href={`/communities/${parent.slug}`} className="hover:underline">{parent.name}</Link></>}
        <span>/</span>
        <span className="text-white">{community.name}</span>
      </div>

      {/* Header card */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-semibold text-white">{community.name}</h1>
              {community.is_official && (
                <span className="text-xs px-2.5 py-0.5 rounded-full border"
                  style={{ borderColor: "color-mix(in srgb, var(--gold) 50%, transparent)", color: "color-mix(in srgb, var(--gold) 90%, white)" }}>
                  Official
                </span>
              )}
              {isAdmin && (
                <span className="text-xs px-2.5 py-0.5 rounded-full border"
                  style={{ borderColor: "color-mix(in srgb, #a855f7 50%, transparent)", color: "#c084fc" }}>
                  Admin
                </span>
              )}
            </div>
            {community.description && <p className="text-white/60 mt-2 max-w-xl">{community.description}</p>}
            <div className="flex items-center gap-4 mt-3 text-sm flex-wrap" style={{ color: "var(--muted)" }}>
              <span>{(community.member_count || 0).toLocaleString()} member{community.member_count === 1 ? "" : "s"}</span>
              {community.post_count > 0 && <span>{community.post_count} post{community.post_count === 1 ? "" : "s"}</span>}
              {parent && <Link href={`/communities/${parent.slug}`} className="hover:underline">↑ {parent.name}</Link>}
            </div>
          </div>

          {userId ? (
            <button type="button" onClick={handleJoin} disabled={joinLoading}
              className="px-5 py-2 rounded-full border text-sm font-semibold transition flex-shrink-0"
              style={{
                borderColor: isJoined ? "color-mix(in srgb, var(--line) 80%, transparent)" : "color-mix(in srgb, var(--gold) 60%, transparent)",
                background: isJoined ? "transparent" : "color-mix(in srgb, var(--gold) 14%, transparent)",
                color: isJoined ? "rgba(255,255,255,0.6)" : "color-mix(in srgb, var(--gold) 90%, white)",
                opacity: joinLoading ? 0.6 : 1,
              }}>
              {joinLoading ? "…" : isJoined ? "Joined ✓" : "Join Community"}
            </button>
          ) : (
            <Link href={`/login?next=/communities/${slug}`}
              className="px-5 py-2 rounded-full border text-sm font-semibold flex-shrink-0"
              style={{ borderColor: "color-mix(in srgb, var(--gold) 60%, transparent)", color: "color-mix(in srgb, var(--gold) 90%, white)" }}>
              Sign in to join
            </Link>
          )}
        </div>

        {/* Sub-communities */}
        {subCommunities.length > 0 && (
          <div className="mt-5 pt-5 border-t" style={{ borderColor: "color-mix(in srgb, var(--line) 60%, transparent)" }}>
            <div className="text-xs uppercase tracking-wide mb-3" style={{ color: "var(--muted)" }}>Sub-communities</div>
            <div className="flex flex-wrap gap-2">
              {subCommunities.map((s) => (
                <Link key={s.slug} href={`/communities/${s.slug}`}
                  className="px-3 py-1.5 rounded-full border text-sm hover:bg-white/5 transition"
                  style={pill}>
                  {s.name}
                  <span className="ml-1.5 text-xs" style={{ color: "var(--muted)" }}>{s.member_count}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => changeTab(t.key)}
            className="px-4 py-2 rounded-full border text-sm transition"
            style={{
              borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
              background: tab === t.key ? "color-mix(in srgb, var(--gold) 18%, transparent)" : "transparent",
              color: "white",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div className="grid gap-8">
          {/* Recent playlists preview */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Playlists</h2>
              <button type="button" onClick={() => changeTab("playlists")} className="text-sm underline" style={{ color: "var(--muted)" }}>See all</button>
            </div>
            {playlists.length === 0 ? (
              <EmptyPlaylists slug={slug} />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {playlists.slice(0, 3).map((p) => <PlaylistCard key={p.id} p={p} />)}
              </div>
            )}
          </div>

          {/* Recent discussions preview */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Discussions</h2>
              <button type="button" onClick={() => changeTab("discussions")} className="text-sm underline" style={{ color: "var(--muted)" }}>See all</button>
            </div>
            {posts.length === 0 ? (
              <div className="rounded-2xl border p-8 text-center text-white/40" style={pill}>
                No discussions yet. {isJoined && <button type="button" onClick={() => { changeTab("discussions"); setShowNewPost(true); }} className="underline">Start one.</button>}
              </div>
            ) : (
              <div className="grid gap-3">
                {posts.slice(0, 3).map((post) => <PostRow key={post.id} post={post} onClick={() => { changeTab("discussions"); setExpandedPost(post.id); }} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PLAYLISTS ── */}
      {tab === "playlists" && (
        <div>
          {isJoined && userId && (
            <div className="mb-5">
              {shareOpen ? (
                <div className="rounded-2xl border p-5 mb-4" style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}>
                  <div className="text-sm font-semibold mb-3">Share a playlist to {community.name}</div>
                  <select value={sharePlaylistId} onChange={(e) => setSharePlaylistId(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2 bg-transparent text-white mb-3"
                    style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}>
                    {myPlaylists.map((pl) => <option key={pl.id} value={pl.id}>{pl.title}</option>)}
                  </select>
                  {shareMsg && <p className={`text-sm mb-2 ${shareMsg === "Shared!" ? "text-green-400" : "text-red-400"}`}>{shareMsg}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={submitShare} disabled={shareBusy} className="inBtn" style={{ opacity: shareBusy ? 0.6 : 1 }}>
                      {shareBusy ? "Sharing…" : "Share"}
                    </button>
                    <button type="button" onClick={() => setShareOpen(false)}
                      className="px-4 py-2 rounded-full border text-sm" style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)", color: "var(--fog)" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={openShare}
                  className="px-4 py-2 rounded-full border text-sm transition hover:bg-white/5"
                  style={{ borderColor: "color-mix(in srgb, var(--gold) 50%, transparent)", color: "color-mix(in srgb, var(--gold) 90%, white)" }}>
                  + Share a Playlist
                </button>
              )}
            </div>
          )}

          {playlists.length === 0 ? (
            <EmptyPlaylists slug={slug} />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {playlists.map((p) => <PlaylistCard key={p.id} p={p} />)}
            </div>
          )}
        </div>
      )}

      {/* ── DISCUSSIONS ── */}
      {tab === "discussions" && (
        <div>
          {/* New post form */}
          {isJoined && userId && (
            <div className="mb-6">
              {showNewPost ? (
                <div className="rounded-2xl border p-5" style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}>
                  <div className="text-sm font-semibold mb-4">New Discussion</div>

                  <input
                    type="text"
                    placeholder="Title — e.g. What's the best 90s R&B album?"
                    value={newPostTitle}
                    onChange={(e) => setNewPostTitle(e.target.value)}
                    maxLength={120}
                    className="w-full rounded-xl border px-4 py-2.5 bg-transparent text-white placeholder-white/30 outline-none mb-3"
                    style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                  />
                  <textarea
                    placeholder="Share your thoughts, takes, questions…"
                    value={newPostBody}
                    onChange={(e) => setNewPostBody(e.target.value)}
                    rows={5}
                    maxLength={5000}
                    className="w-full rounded-xl border px-4 py-2.5 bg-transparent text-white placeholder-white/30 outline-none resize-none mb-3"
                    style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                  />

                  {/* Image URL */}
                  <div className="mb-3">
                    <div className="text-xs mb-1.5" style={{ color: "var(--muted)" }}>Image URL (optional)</div>
                    <input
                      type="url"
                      placeholder="https://…"
                      value={newPostImageUrl}
                      onChange={(e) => setNewPostImageUrl(e.target.value)}
                      className="w-full rounded-xl border px-4 py-2.5 bg-transparent text-white placeholder-white/30 outline-none text-sm"
                      style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                    />
                    {newPostImageUrl && (
                      <img src={newPostImageUrl} alt="preview" className="mt-2 rounded-xl max-h-48 object-cover w-full"
                        onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    )}
                  </div>

                  {/* Link */}
                  <div className="mb-4 grid gap-2 sm:grid-cols-2">
                    <div>
                      <div className="text-xs mb-1.5" style={{ color: "var(--muted)" }}>Link URL (optional)</div>
                      <input
                        type="url"
                        placeholder="https://…"
                        value={newPostLinkUrl}
                        onChange={(e) => setNewPostLinkUrl(e.target.value)}
                        className="w-full rounded-xl border px-4 py-2.5 bg-transparent text-white placeholder-white/30 outline-none text-sm"
                        style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                      />
                    </div>
                    <div>
                      <div className="text-xs mb-1.5" style={{ color: "var(--muted)" }}>Link label</div>
                      <input
                        type="text"
                        placeholder="e.g. Apple Music, YouTube…"
                        value={newPostLinkTitle}
                        onChange={(e) => setNewPostLinkTitle(e.target.value)}
                        maxLength={80}
                        className="w-full rounded-xl border px-4 py-2.5 bg-transparent text-white placeholder-white/30 outline-none text-sm"
                        style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                      />
                    </div>
                  </div>

                  {postError && <p className="text-red-400 text-sm mb-3">{postError}</p>}

                  <div className="flex gap-2">
                    <button type="button" onClick={submitPost}
                      disabled={postBusy || !newPostTitle.trim() || !newPostBody.trim()}
                      className="inBtn"
                      style={{ opacity: postBusy || !newPostTitle.trim() || !newPostBody.trim() ? 0.5 : 1 }}>
                      {postBusy ? "Posting…" : "Post"}
                    </button>
                    <button type="button" onClick={() => { setShowNewPost(false); setNewPostTitle(""); setNewPostBody(""); setNewPostImageUrl(""); setNewPostLinkUrl(""); setNewPostLinkTitle(""); setPostError(""); }}
                      className="px-4 py-2 rounded-full border text-sm"
                      style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)", color: "var(--fog)" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setShowNewPost(true)}
                  className="px-4 py-2 rounded-full border text-sm hover:bg-white/5 transition"
                  style={{ borderColor: "color-mix(in srgb, var(--gold) 50%, transparent)", color: "color-mix(in srgb, var(--gold) 90%, white)" }}>
                  + New Discussion
                </button>
              )}
            </div>
          )}

          {postsError && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300 text-sm mb-4">
              {postsError} — make sure the SQL columns have been added in Supabase.
            </div>
          )}

          {!postsLoaded && !postsError ? (
            <div className="text-white/40 text-center py-8">Loading…</div>
          ) : posts.length === 0 && !postsError ? (
            <div className="rounded-2xl border p-12 text-center" style={pill}>
              <div className="text-4xl mb-4">💬</div>
              <div className="text-white font-semibold">No discussions yet</div>
              <p className="text-white/50 text-sm mt-2">
                {isJoined ? "Start the conversation." : "Join this community to post."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {posts.map((post) => (
                <div key={post.id} className="rounded-2xl border overflow-hidden" style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}>
                  {/* Post header */}
                  <div className="flex items-stretch">
                    <button type="button" onClick={() => togglePost(post.id)}
                      className="flex-1 text-left p-5 hover:bg-white/3 transition min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-white">{post.title}</div>
                          <div className="text-xs mt-1.5 flex items-center gap-2" style={{ color: "var(--muted)" }}>
                            <AuthorPip profile={post.profiles} />
                            <span>•</span>
                            <span>{fmtTime(post.created_at)}</span>
                            <span>•</span>
                            <span>{post.reply_count} {post.reply_count === 1 ? "comment" : "comments"}</span>
                            {post.likes_count > 0 && <><span>•</span><span>▲ {post.likes_count}</span></>}
                          </div>
                        </div>
                        <span className="text-white/30 text-lg flex-shrink-0">{expandedPost === post.id ? "∧" : "∨"}</span>
                      </div>
                    </button>
                    {(isAdmin || post.user_id === userId) && (
                      <button type="button" onClick={() => deletePost(post.id)}
                        className="px-4 text-white/20 hover:text-red-400 transition flex-shrink-0 border-l"
                        style={{ borderColor: "color-mix(in srgb, var(--line) 40%, transparent)" }}
                        title="Delete post">
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Expanded body */}
                  {expandedPost === post.id && (
                    <div className="border-t" style={{ borderColor: "color-mix(in srgb, var(--line) 60%, transparent)" }}>

                      {/* Post content */}
                      <div className="px-5 pt-4 pb-3">
                        <p className="text-white/80 text-sm whitespace-pre-wrap">{post.body}</p>
                        {post.image_url && (
                          <img src={post.image_url} alt="" className="mt-3 rounded-xl w-full max-h-64 object-cover"
                            onError={(e) => { e.currentTarget.style.display = "none"; }} />
                        )}
                        {post.link_url && (
                          <a href={post.link_url} target="_blank" rel="noreferrer"
                            className="mt-3 flex items-center gap-2 rounded-xl border px-4 py-3 hover:bg-white/5 transition"
                            style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}>
                            <span className="text-lg">🔗</span>
                            <span className="text-sm text-white/80 truncate">{post.link_title || post.link_url}</span>
                            <span className="ml-auto text-white/30 text-xs flex-shrink-0">↗</span>
                          </a>
                        )}
                        {/* Vote bar */}
                        <div className="flex items-center gap-2 mt-4">
                          <button type="button" onClick={() => votePost(post.id, "up")}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition"
                            style={{
                              borderColor: votesMap[post.id] === "up" ? "color-mix(in srgb, #22c55e 60%, transparent)" : "color-mix(in srgb, var(--line) 80%, transparent)",
                              background: votesMap[post.id] === "up" ? "color-mix(in srgb, #22c55e 14%, transparent)" : "transparent",
                              color: votesMap[post.id] === "up" ? "#86efac" : "rgba(255,255,255,0.5)",
                            }}>
                            ▲ {post.likes_count || 0}
                          </button>
                          <button type="button" onClick={() => votePost(post.id, "down")}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition"
                            style={{
                              borderColor: votesMap[post.id] === "down" ? "color-mix(in srgb, #ef4444 60%, transparent)" : "color-mix(in srgb, var(--line) 80%, transparent)",
                              background: votesMap[post.id] === "down" ? "color-mix(in srgb, #ef4444 14%, transparent)" : "transparent",
                              color: votesMap[post.id] === "down" ? "#fca5a5" : "rgba(255,255,255,0.5)",
                            }}>
                            ▼ {post.dislikes_count || 0}
                          </button>
                        </div>
                      </div>

                      {/* Comment section — always its own block */}
                      <div className="border-t px-5 pt-4 pb-5" style={{ borderColor: "color-mix(in srgb, var(--line) 60%, transparent)" }}>
                        <div className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: "var(--muted)" }}>
                          Comments ({post.reply_count || 0})
                        </div>

                        {/* Comment box */}
                        {userId ? (
                          <div className="flex gap-3 items-start mb-6">
                            <AvatarPip profile={userProfile} size={8} />
                            <div className="flex-1">
                              <textarea
                                placeholder={isJoined ? "Write a comment…" : "Join this community to comment"}
                                value={replyBody[post.id] || ""}
                                onChange={(e) => isJoined && setReplyBody((prev) => ({ ...prev, [post.id]: e.target.value }))}
                                rows={3}
                                maxLength={2000}
                                disabled={!isJoined}
                                className="w-full rounded-xl border px-4 py-3 bg-transparent text-white placeholder-white/30 outline-none resize-none text-sm"
                                style={{
                                  borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                                  opacity: isJoined ? 1 : 0.4,
                                  cursor: isJoined ? "text" : "not-allowed",
                                }}
                              />
                              {isJoined && (
                                <div className="flex items-center justify-between mt-2">
                                  <button
                                    type="button"
                                    onClick={() => submitReply(post.id)}
                                    disabled={!replyBody[post.id]?.trim() || replyBusy[post.id]}
                                    className="inBtn text-xs px-4 py-1.5"
                                    style={{ opacity: !replyBody[post.id]?.trim() || replyBusy[post.id] ? 0.4 : 1 }}>
                                    {replyBusy[post.id] ? "Posting…" : "Post Comment"}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-white/40 mb-4">
                            <a href={`/login?next=/communities/${slug}`} className="underline">Sign in</a> to comment.
                          </p>
                        )}

                        {/* Comments list */}
                        {replies[post.id] === undefined ? (
                          <div className="text-white/30 text-xs">Loading…</div>
                        ) : replies[post.id].length === 0 ? (
                          <div className="text-white/30 text-xs">No comments yet. Be the first.</div>
                        ) : (
                          <div className="grid gap-5">
                            {replies[post.id].map((r) => (
                              <div key={r.id} className="flex gap-3">
                                <AvatarPip profile={r.profiles} size={8} />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 text-xs mb-1" style={{ color: "var(--muted)" }}>
                                    <AuthorPip profile={r.profiles} />
                                    <span>•</span>
                                    <span>{fmtTime(r.created_at)}</span>
                                    {(isAdmin || r.user_id === userId) && (
                                      <button type="button" onClick={() => deleteReply(post.id, r.id)}
                                        className="ml-auto text-white/20 hover:text-red-400 transition" title="Delete">
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-white/80 text-sm whitespace-pre-wrap">{r.body}</p>
                                  {r.image_url && (
                                    <img src={r.image_url} alt="" className="mt-2 rounded-xl w-full max-h-48 object-cover"
                                      onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MEMBERS ── */}
      {tab === "members" && (
        !membersLoaded ? (
          <div className="text-white/40 text-center py-8">Loading…</div>
        ) : members.length === 0 ? (
          <div className="rounded-2xl border p-12 text-center" style={pill}>
            <div className="text-4xl mb-4">👥</div>
            <div className="text-white font-semibold">No members yet</div>
            <p className="text-white/50 text-sm mt-2">Be the first to join.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((m) => {
              const raw = fmtHandle(m.handle || "");
              const displayName = m.display_name || (raw ? `@${raw}` : "User");
              return (
                <Link key={m.id} href={`/u/${raw}`}
                  className="card p-4 flex items-center gap-3 hover:border-white/20 hover:-translate-y-0.5 transition">
                  <AvatarPip profile={m} size={10} />
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{displayName}</div>
                    <div className="text-xs truncate" style={{ color: "var(--muted)" }}>
                      {raw ? `@${raw}` : ""}{m.role ? ` • ${m.role}` : ""}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function PlaylistCard({ p }) {
  return (
    <div className="card overflow-hidden hover:-translate-y-0.5 transition">
      <Link href={`/p/${p.id}`} className="block">
        <div className="relative">
          <img src={p.coverUrl} alt="" className="w-full object-cover" style={{ height: 160 }}
            loading="lazy" referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.src = "/placeholder-cover.png"; }} />
          <div className="absolute inset-x-0 bottom-0 p-3" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}>
            <div className="font-semibold leading-tight truncate">{p.title}</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>♥ {p.likes}</div>
          </div>
        </div>
      </Link>
      <div className="p-4">
        {p.rawHandle && (
          <Link href={`/u/${p.rawHandle}`} className="text-xs hover:underline" style={{ color: "var(--muted)" }}>
            @{p.rawHandle}
          </Link>
        )}
        {p.description ? (
          <div className="text-sm text-white/70 line-clamp-2 mt-1">{p.description}</div>
        ) : <div className="text-sm text-white/30 mt-1">No description.</div>}
      </div>
    </div>
  );
}

function PostRow({ post, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full text-left rounded-2xl border p-4 hover:bg-white/3 transition"
      style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}>
      <div className="font-semibold text-white">{post.title}</div>
      <div className="text-xs mt-1 flex items-center gap-2" style={{ color: "var(--muted)" }}>
        <AuthorPip profile={post.profiles} />
        <span>•</span>
        <span>{fmtTime(post.created_at)}</span>
        <span>•</span>
        <span>{post.reply_count} {post.reply_count === 1 ? "comment" : "comments"}</span>
      </div>
    </button>
  );
}

function AuthorPip({ profile }) {
  const handle = fmtHandle(profile?.handle || "");
  const name = profile?.display_name || (handle ? `@${handle}` : "Unknown");
  return (
    <Link href={`/u/${handle}`} className="hover:underline" style={{ color: "inherit" }} onClick={(e) => e.stopPropagation()}>
      {name}
    </Link>
  );
}

function AvatarPip({ profile, size = 8 }) {
  const name = profile?.display_name || profile?.handle || "?";
  const initial = name.charAt(0).toUpperCase();
  const px = size * 4;
  return (
    <div className="rounded-full border overflow-hidden flex-shrink-0 grid place-items-center text-xs font-semibold text-white/60"
      style={{ width: px, height: px, minWidth: px, minHeight: px, borderColor: "color-mix(in srgb, var(--line) 80%, transparent)", background: "color-mix(in srgb, var(--midnight) 85%, transparent)" }}>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      ) : initial}
    </div>
  );
}

function EmptyPlaylists({ slug }) {
  return (
    <div className="rounded-2xl border p-12 text-center" style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}>
      <div className="text-4xl mb-4">🎵</div>
      <div className="text-white font-semibold">No playlists yet</div>
      <p className="text-white/50 text-sm mt-2 mb-6">
        Create a playlist tagged <span className="text-white/70">#{slug}</span> or share one from any playlist page.
      </p>
      <Link href="/new" className="inBtn">Create a playlist</Link>
    </div>
  );
}
