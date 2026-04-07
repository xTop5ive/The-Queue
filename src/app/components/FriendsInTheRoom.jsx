"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";

export default function FriendsInTheRoom() {
  const [friends, setFriends] = useState([]);
  const [ready, setReady] = useState(false);
  const channelRef = useRef(null);
  const followingIdsRef = useRef(new Set());
  const viewerIdRef = useRef(null);

  useEffect(() => {
    let supabase;
    try { supabase = createBrowserClient(); } catch { setReady(true); return; }

    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) { setReady(true); return; }

      viewerIdRef.current = user.id;

      // Fetch who the viewer follows
      const { data: followRows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);

      const followingIds = new Set((followRows || []).map((r) => r.following_id));
      followingIdsRef.current = followingIds;

      if (!followingIds.size) { setReady(true); return; }

      // Subscribe to the shared presence channel
      const channel = supabase.channel("presence:listening", {
        config: { presence: { key: user.id } },
      });

      const sync = () => {
        const state = channel.presenceState();
        const active = Object.values(state)
          .flat()
          .filter((p) => followingIds.has(p.user_id) && p.user_id !== user.id)
          .map((p) => ({
            user_id: p.user_id,
            handle: p.handle || "",
            display_name: p.display_name || "",
            avatar_url: p.avatar_url || "",
            track_title: p.track_title || "",
            track_artist: p.track_artist || "",
            playlist_id: p.playlist_id || null,
            playlist_title: p.playlist_title || null,
          }));
        setFriends(active);
        setReady(true);
      };

      channel.on("presence", { event: "sync" }, sync);
      channel.on("presence", { event: "join" }, sync);
      channel.on("presence", { event: "leave" }, sync);
      channel.subscribe();
      channelRef.current = channel;
    })();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, []);

  // Hide entirely if not ready or no friends active
  if (!ready || !friends.length) return null;

  return (
    <section className="mt-8">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: "#4ade80", boxShadow: "0 0 6px #4ade80", animation: "pulse 2s infinite" }}
            />
            Friends in the Room
          </h2>
          <p className="text-white/60 text-sm mt-1">
            {friends.length} {friends.length === 1 ? "person" : "people"} you follow listening live.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {friends.map((f) => {
          const handle = String(f.handle || "").replace(/^@/, "");
          const displayName = f.display_name || (handle ? `@${handle}` : "Someone");
          const initial = displayName.charAt(0).toUpperCase();

          return (
            <div
              key={f.user_id}
              className="card p-4"
            >
              {/* User row */}
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <div
                    className="w-10 h-10 rounded-full border overflow-hidden grid place-items-center font-semibold text-white/60"
                    style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)", background: "color-mix(in srgb, var(--midnight) 85%, transparent)" }}
                  >
                    {f.avatar_url ? (
                      <img src={f.avatar_url} alt={displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : initial}
                  </div>
                  {/* Live dot */}
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                    style={{ background: "#4ade80", borderColor: "var(--midnight)" }}
                  />
                </div>

                <div className="min-w-0">
                  <Link
                    href={`/u/${handle}`}
                    className="font-semibold truncate hover:underline block"
                  >
                    {displayName}
                  </Link>
                  {handle ? (
                    <div className="text-xs truncate" style={{ color: "var(--muted)" }}>
                      @{handle}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Now playing */}
              {f.track_title ? (
                <div
                  className="mt-3 rounded-xl border px-3 py-2 flex items-start gap-2"
                  style={{ borderColor: "color-mix(in srgb, var(--line) 60%, transparent)" }}
                >
                  <span className="text-xs mt-0.5 flex-shrink-0" style={{ color: "#4ade80" }}>▶</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{f.track_title}</div>
                    {f.track_artist ? (
                      <div className="text-xs truncate" style={{ color: "var(--muted)" }}>{f.track_artist}</div>
                    ) : null}
                    {f.playlist_id && f.playlist_title ? (
                      <Link
                        href={`/p/${f.playlist_id}`}
                        className="text-xs truncate block mt-0.5 hover:underline"
                        style={{ color: "var(--muted)" }}
                      >
                        from {f.playlist_title}
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
