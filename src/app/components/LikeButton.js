"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser"; // use your existing helper

export default function LikeButton({ playlistId, initialCount = 0 }) {
  const supabase = createBrowserClient();
  const router = useRouter();

  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return;

      const { data } = await supabase
        .from("playlist_likes")
        .select("id")
        .eq("playlist_id", playlistId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (alive) setLiked(!!data);
    })();

    return () => {
      alive = false;
    };
  }, [playlistId]);

  async function onToggle() {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("toggle_playlist_like", {
        p_playlist_id: playlistId,
      });
      if (error) throw error;

      // RPC returns a row: { liked, likes_count }
      const row = Array.isArray(data) ? data[0] : data;
      setLiked(!!row?.liked);
      setCount(row?.likes_count ?? count);

      // refresh server components so Explore/Home cards update too
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("Please sign in to like playlists.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      className="px-4 py-2 rounded-full border text-sm inline-flex items-center gap-2"
      style={{
        borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
        background: liked
          ? "color-mix(in srgb, var(--gold) 18%, transparent)"
          : "color-mix(in srgb, var(--midnight) 85%, transparent)",
        color: "var(--fog)",
        opacity: loading ? 0.7 : 1,
      }}
      aria-label={liked ? "Unlike" : "Like"}
    >
      <span aria-hidden>{liked ? "♥" : "♡"}</span>
      <span>{liked ? "Liked" : "Like"}</span>
      <span className="text-white/50">({count})</span>
    </button>
  );
}