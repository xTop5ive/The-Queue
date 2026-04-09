"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Avatar({ src, handle, size = 10 }) {
  const [failed, setFailed] = useState(false);
  const initials = (handle || "?").replace(/^@/, "").slice(0, 1).toUpperCase();
  const px = size * 4;

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={handle}
        width={px}
        height={px}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: px, height: px }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 font-semibold"
      style={{
        width: px,
        height: px,
        fontSize: size <= 8 ? 10 : 12,
        background: "color-mix(in srgb, var(--plum) 35%, var(--midnight))",
        color: "var(--gold)",
      }}
    >
      {initials}
    </div>
  );
}

async function fetchComments(supabase, playlistId) {
  // Step 1: fetch raw comment rows
  const { data: rows, error } = await supabase
    .from("playlist_comments")
    .select("id, body, created_at, parent_id, user_id")
    .eq("playlist_id", playlistId)
    .order("created_at", { ascending: false });

  if (error || !rows) return [];

  // Step 2: collect unique user IDs across all rows
  const userIds = [...new Set(rows.map((r) => r.user_id))];

  // Step 3: fetch profiles separately (avoids FK-join requirement)
  let profileMap = {};
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, handle, display_name, avatar_url")
      .in("id", userIds);
    for (const p of profiles || []) profileMap[p.id] = p;
  }

  // Step 4: attach profile to each row
  const withProfile = rows.map((r) => ({
    ...r,
    profile: profileMap[r.user_id] || null,
  }));

  // Step 5: nest replies under their parent
  const topLevel = withProfile.filter((r) => !r.parent_id);
  const replies = withProfile.filter((r) => !!r.parent_id);
  const replyMap = {};
  for (const r of replies) {
    if (!replyMap[r.parent_id]) replyMap[r.parent_id] = [];
    replyMap[r.parent_id].push(r);
  }

  return topLevel.map((c) => ({
    ...c,
    replies: (replyMap[c.id] || []).sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    ),
  }));
}

export default function CommentsSection({ playlistId, user, supabase }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [replyTo, setReplyTo] = useState(null); // { id, handle }
  const inputRef = useRef(null);
  const maxLen = 500;

  const load = async () => {
    const result = await fetchComments(supabase, playlistId);
    setComments(result);
    setLoading(false);
  };

  useEffect(() => {
    if (!playlistId) return;
    load();

    // Realtime — refresh on any change to this playlist's comments
    const channel = supabase
      .channel(`comments:${playlistId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "playlist_comments",
          filter: `playlist_id=eq.${playlistId}`,
        },
        () => load()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [playlistId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    if (!user?.id) {
      setError("Sign in to comment.");
      return;
    }
    if (text.length > maxLen) {
      setError(`Max ${maxLen} characters.`);
      return;
    }

    setPosting(true);
    setError("");

    const { error: insertErr } = await supabase.from("playlist_comments").insert({
      playlist_id: playlistId,
      user_id: user.id,
      body: text,
      parent_id: replyTo?.id ?? null,
    });

    if (insertErr) {
      setError(insertErr.message || "Could not post comment.");
      setPosting(false);
      return;
    }

    setBody("");
    setReplyTo(null);
    setPosting(false);
    // Optimistic: reload immediately (realtime may lag on first sub)
    load();
  };

  const deleteComment = async (commentId) => {
    if (!user?.id) return;
    await supabase
      .from("playlist_comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", user.id);
    load();
  };

  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo]);

  const totalCount = comments.reduce(
    (sum, c) => sum + 1 + (c.replies?.length || 0),
    0
  );

  return (
    <div className="mt-10">
      <div className="flex items-baseline gap-3 mb-5">
        <h2 className="text-2xl font-semibold">Comments</h2>
        {!loading && (
          <span className="text-white/40 text-sm">
            {totalCount} {totalCount === 1 ? "comment" : "comments"}
          </span>
        )}
      </div>

      {/* Compose */}
      <div
        className="rounded-2xl border p-4 mb-6"
        style={{
          borderColor: "color-mix(in srgb, var(--line) 70%, transparent)",
          background: "color-mix(in srgb, var(--midnight) 80%, transparent)",
        }}
      >
        {replyTo && (
          <div
            className="flex items-center justify-between mb-3 px-3 py-1.5 rounded-xl text-xs"
            style={{
              background: "color-mix(in srgb, var(--gold) 10%, transparent)",
              color: "var(--gold)",
              border: "1px solid color-mix(in srgb, var(--gold) 25%, transparent)",
            }}
          >
            <span>Replying to {replyTo.handle}</span>
            <button
              type="button"
              onClick={() => { setReplyTo(null); setBody(""); }}
              className="opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={submit} className="flex gap-3 items-start">
          {user && (
            <Avatar
              src={user.user_metadata?.avatar_url || ""}
              handle={user.user_metadata?.handle || user.email?.split("@")[0] || ""}
              size={9}
            />
          )}
          <div className="flex-1 min-w-0">
            {user ? (
              <>
                <textarea
                  ref={inputRef}
                  value={body}
                  onChange={(e) => { setBody(e.target.value); setError(""); }}
                  placeholder={replyTo ? `Reply to ${replyTo.handle}…` : "Add a comment…"}
                  rows={body.length > 80 ? 3 : 1}
                  maxLength={maxLen}
                  className="w-full px-4 py-2.5 rounded-xl border resize-none text-sm outline-none transition-all"
                  style={{
                    background: "color-mix(in srgb, var(--midnight) 90%, transparent)",
                    borderColor: error
                      ? "color-mix(in srgb, #f87171 60%, transparent)"
                      : "color-mix(in srgb, var(--line) 80%, transparent)",
                    color: "var(--fog)",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit(e);
                    }
                  }}
                />
                {error && (
                  <p className="text-xs mt-1.5 px-1" style={{ color: "#f87171" }}>
                    {error}
                  </p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span
                    className="text-xs"
                    style={{
                      color: body.length > maxLen * 0.85 ? "#f87171" : "var(--muted)",
                    }}
                  >
                    {body.length}/{maxLen}
                  </span>
                  <button
                    type="submit"
                    disabled={posting || !body.trim()}
                    className="px-4 py-1.5 rounded-full text-sm font-medium transition-all disabled:opacity-40"
                    style={{
                      background: "color-mix(in srgb, var(--gold) 20%, transparent)",
                      color: "var(--gold)",
                      border: "1px solid color-mix(in srgb, var(--gold) 40%, transparent)",
                    }}
                  >
                    {posting ? "Posting…" : "Post"}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm py-2" style={{ color: "var(--muted)" }}>
                <Link href="/login" style={{ color: "var(--gold)" }} className="hover:underline">
                  Sign in
                </Link>{" "}
                to leave a comment.
              </p>
            )}
          </div>
        </form>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-white/30 text-sm text-center py-8">Loading comments…</div>
      ) : comments.length === 0 ? (
        <div
          className="rounded-2xl border px-6 py-10 text-center"
          style={{ borderColor: "color-mix(in srgb, var(--line) 50%, transparent)" }}
        >
          <div className="text-white/20 text-3xl mb-2">💬</div>
          <p className="text-white/40 text-sm">No comments yet. Be the first to say something.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              currentUserId={user?.id}
              onDelete={deleteComment}
              onReply={(id, handle) => setReplyTo({ id, handle })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentRow({ comment, currentUserId, onDelete, onReply, isReply = false }) {
  const profile = comment.profile || {};
  const rawHandle = profile.handle || "";
  const handle = rawHandle
    ? rawHandle.startsWith("@") ? rawHandle : `@${rawHandle}`
    : "@user";
  const displayName = profile.display_name || handle;
  const avatarUrl = profile.avatar_url || "";
  const isOwner = currentUserId && comment.user_id === currentUserId;
  const [showReplies, setShowReplies] = useState(true);

  return (
    <div>
      <div
        className="flex gap-3 px-3 py-3 rounded-2xl group"
        style={{
          background: isReply
            ? "color-mix(in srgb, var(--midnight) 55%, transparent)"
            : "transparent",
        }}
      >
        <Link href={`/u/${handle.replace(/^@/, "")}`} className="flex-shrink-0 mt-0.5">
          <Avatar src={avatarUrl} handle={handle} size={isReply ? 8 : 9} />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/u/${handle.replace(/^@/, "")}`}
              className="text-sm font-semibold text-white hover:underline"
            >
              {displayName}
            </Link>
            <span className="text-white/30 text-xs">{timeAgo(comment.created_at)}</span>
          </div>

          <p className="text-white/80 text-sm mt-1 leading-relaxed whitespace-pre-wrap break-words">
            {comment.body}
          </p>

          <div className="mt-2 flex items-center gap-4 text-xs" style={{ color: "var(--muted)" }}>
            {!isReply && (
              <button
                type="button"
                onClick={() => onReply(comment.id, handle)}
                className="hover:text-white transition"
              >
                Reply
              </button>
            )}
            {isOwner && (
              <button
                type="button"
                onClick={() => onDelete(comment.id)}
                className="hover:text-red-400 transition"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Nested replies */}
      {!isReply && comment.replies?.length > 0 && (
        <div className="ml-11 pl-2 border-l mt-1 mb-2" style={{ borderColor: "color-mix(in srgb, var(--line) 40%, transparent)" }}>
          {comment.replies.length > 2 && (
            <button
              type="button"
              onClick={() => setShowReplies((v) => !v)}
              className="text-xs mb-1 ml-3 transition"
              style={{ color: "var(--gold)" }}
            >
              {showReplies
                ? `Hide ${comment.replies.length} replies`
                : `Show ${comment.replies.length} replies`}
            </button>
          )}
          {showReplies &&
            comment.replies.map((r) => (
              <CommentRow
                key={r.id}
                comment={r}
                currentUserId={currentUserId}
                onDelete={onDelete}
                onReply={onReply}
                isReply
              />
            ))}
        </div>
      )}
    </div>
  );
}
