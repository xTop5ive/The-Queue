"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { usePlayer } from "./PlayerProvider";
import { createBrowserClient } from "@/lib/supabase-browser";

function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

// ── Icons (inline SVG so no extra deps) ──────────────────────────────────────

function IconPrev() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
    </svg>
  );
}
function IconNext() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 18l8.5-6L6 6zm8.5 0H17V6h-2.5z"/>
    </svg>
  );
}
function IconPlay() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
  );
}
function IconPause() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6zm8-14v14h4V5z"/>
    </svg>
  );
}
function IconVolume({ level }) {
  if (level === 0) return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"/>
    </svg>
  );
  if (level < 50) return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
    </svg>
  );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
    </svg>
  );
}
function IconQueue() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h12v2H3z"/>
    </svg>
  );
}
function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
  );
}
function IconHeart({ filled }) {
  return filled ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
}
function IconShare() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  );
}
function IconAddToPlaylist() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"/>
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

// ── Queue Panel ───────────────────────────────────────────────────────────────

function QueuePanel({ onClose }) {
  const { queue, index, playAt, removeFromQueue, playlistTitle } = usePlayer();

  return (
    <div
      className="fixed left-0 right-0 z-40 flex flex-col"
      style={{
        bottom: 112,
        maxHeight: "55vh",
        background: "color-mix(in srgb, var(--midnight) 97%, black)",
        borderTop: "1px solid color-mix(in srgb, var(--line) 80%, transparent)",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
      }}
    >
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b"
        style={{ borderColor: "color-mix(in srgb, var(--line) 70%, transparent)" }}
      >
        <div>
          <div className="text-sm font-semibold text-white">Queue</div>
          {playlistTitle && (
            <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              {playlistTitle}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {queue.length} track{queue.length !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-white/40 hover:text-white transition p-1"
          >
            <IconClose />
          </button>
        </div>
      </div>

      {/* Track list */}
      <div className="overflow-y-auto flex-1">
        {queue.length === 0 ? (
          <div className="px-5 py-10 text-center text-white/30 text-sm">
            Queue is empty
          </div>
        ) : (
          queue.map((track, i) => {
            const isCurrent = i === index;
            return (
              <div
                key={`${track.id}-${i}`}
                className="flex items-center gap-3 px-5 py-2.5 group transition-all"
                style={{
                  background: isCurrent
                    ? "color-mix(in srgb, var(--gold) 8%, transparent)"
                    : "transparent",
                  borderLeft: isCurrent
                    ? "2px solid var(--gold)"
                    : "2px solid transparent",
                }}
              >
                <div
                  className="w-6 text-right text-xs flex-shrink-0"
                  style={{ color: isCurrent ? "var(--gold)" : "var(--muted)" }}
                >
                  {isCurrent ? "▶" : i + 1}
                </div>
                {track.coverUrl ? (
                  <img
                    src={track.coverUrl}
                    alt=""
                    className="w-9 h-9 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className="w-9 h-9 rounded flex-shrink-0"
                    style={{ background: "color-mix(in srgb, var(--line) 60%, transparent)" }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => playAt(i)}
                  className="flex-1 text-left min-w-0"
                >
                  <div
                    className="text-sm font-medium truncate"
                    style={{ color: isCurrent ? "var(--gold)" : "white" }}
                  >
                    {track.title}
                  </div>
                  <div className="text-xs truncate" style={{ color: "var(--muted)" }}>
                    {track.artist || "Unknown artist"}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => removeFromQueue(i)}
                  className="opacity-0 group-hover:opacity-100 transition p-1 text-white/30 hover:text-white/70 flex-shrink-0"
                  title="Remove from queue"
                >
                  <IconClose />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Add to Playlist Popup ─────────────────────────────────────────────────────

function AddToPlaylistPopup({ track, onClose, anchorRef }) {
  const supabase = createBrowserClient();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(new Set());
  const [userId, setUserId] = useState(null);
  const popupRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) { setLoading(false); return; }
      setUserId(uid);

      const { data } = await supabase
        .from("playlists")
        .select("id, title, cover_url")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      // Check which ones already contain this track
      if (data?.length && track?.videoId) {
        const { data: existing } = await supabase
          .from("playlist_tracks")
          .select("playlist_id")
          .eq("youtube_video_id", track.videoId)
          .in("playlist_id", data.map((p) => p.id));
        if (existing) setAdded(new Set(existing.map((r) => r.playlist_id)));
      }

      setPlaylists(data || []);
      setLoading(false);
    })();
  }, [track?.videoId]);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (
        popupRef.current && !popupRef.current.contains(e.target) &&
        anchorRef?.current && !anchorRef.current.contains(e.target)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, anchorRef]);

  const addToPlaylist = async (playlistId) => {
    if (!userId || !track?.videoId) return;
    if (added.has(playlistId)) return;

    // Get current max position
    const { data: tracks } = await supabase
      .from("playlist_tracks")
      .select("position")
      .eq("playlist_id", playlistId)
      .order("position", { ascending: false })
      .limit(1);
    const nextPos = (tracks?.[0]?.position || 0) + 1;

    const { error } = await supabase.from("playlist_tracks").insert({
      playlist_id: playlistId,
      youtube_video_id: track.videoId,
      title: track.title || "",
      artist: track.artist || "",
      position: nextPos,
    });
    if (!error) {
      setAdded((prev) => new Set([...prev, playlistId]));
    }
  };

  return (
    <div
      ref={popupRef}
      className="absolute bottom-12 right-0 rounded-2xl border flex flex-col"
      style={{
        width: 260,
        maxHeight: 320,
        background: "var(--midnight)",
        borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
        boxShadow: "0 -4px 32px rgba(0,0,0,0.6)",
        zIndex: 60,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: "color-mix(in srgb, var(--line) 60%, transparent)" }}
      >
        <span className="text-sm font-semibold text-white">Add to playlist</span>
        <button
          type="button"
          onClick={onClose}
          className="text-white/40 hover:text-white transition"
        >
          <IconClose />
        </button>
      </div>

      {/* Track being added */}
      {track && (
        <div
          className="px-4 py-2.5 flex items-center gap-2.5 border-b flex-shrink-0"
          style={{ borderColor: "color-mix(in srgb, var(--line) 40%, transparent)" }}
        >
          {track.coverUrl ? (
            <img src={track.coverUrl} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded flex-shrink-0" style={{ background: "color-mix(in srgb, var(--plum) 30%, transparent)" }} />
          )}
          <div className="min-w-0">
            <div className="text-xs font-medium text-white truncate">{track.title}</div>
            <div className="text-xs truncate" style={{ color: "var(--muted)" }}>{track.artist}</div>
          </div>
        </div>
      )}

      {/* Playlist list */}
      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="px-4 py-6 text-center text-white/30 text-sm">Loading…</div>
        ) : !userId ? (
          <div className="px-4 py-6 text-center text-white/30 text-sm">Sign in to save tracks</div>
        ) : playlists.length === 0 ? (
          <div className="px-4 py-6 text-center text-white/30 text-sm">No playlists yet</div>
        ) : (
          playlists.map((pl) => {
            const isAdded = added.has(pl.id);
            return (
              <button
                key={pl.id}
                type="button"
                onClick={() => addToPlaylist(pl.id)}
                disabled={isAdded}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all hover:bg-white/5 disabled:cursor-default"
              >
                {pl.cover_url ? (
                  <img src={pl.cover_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                ) : (
                  <div
                    className="w-8 h-8 rounded flex-shrink-0"
                    style={{ background: "color-mix(in srgb, var(--plum) 30%, transparent)" }}
                  />
                )}
                <span
                  className="flex-1 text-sm truncate"
                  style={{ color: isAdded ? "var(--gold)" : "white" }}
                >
                  {pl.title}
                </span>
                {isAdded && (
                  <span style={{ color: "var(--gold)" }}>
                    <IconCheck />
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Main Sticky Player ────────────────────────────────────────────────────────

export default function StickyPlayerBar() {
  const {
    currentTrack,
    isPlaying,
    toggle,
    next,
    prev,
    duration,
    currentTime,
    progress,
    seekToPercent,
    isSeeking,
    setIsSeeking,
    setCurrentTime,
    volume,
    setPlayerVolume,
    playlistId,
    playlistTitle,
    queue,
  } = usePlayer();

  const [coverFailed, setCoverFailed] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);

  // Like state
  const [isLiked, setIsLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [userId, setUserId] = useState(null);

  // Share feedback
  const [copied, setCopied] = useState(false);

  const volumeRef = useRef(null);
  const addToPlaylistRef = useRef(null);
  const supabase = createBrowserClient();

  // Fetch auth user once
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data?.user?.id || null);
    });
  }, []);

  // Reset cover error when track changes
  useEffect(() => { setCoverFailed(false); }, [currentTrack?.videoId]);

  // Fetch like state when playlist changes
  useEffect(() => {
    if (!playlistId || !userId) { setIsLiked(false); return; }
    supabase
      .from("playlist_likes")
      .select("playlist_id")
      .eq("playlist_id", playlistId)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => setIsLiked(!!data));
  }, [playlistId, userId]);

  // Close volume popup on outside click
  useEffect(() => {
    if (!showVolume) return;
    function handler(e) {
      if (volumeRef.current && !volumeRef.current.contains(e.target)) {
        setShowVolume(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showVolume]);

  const handleLike = useCallback(async () => {
    if (!userId || !playlistId || likeLoading) return;
    setLikeLoading(true);
    if (isLiked) {
      await supabase.from("playlist_likes").delete()
        .eq("playlist_id", playlistId).eq("user_id", userId);
      setIsLiked(false);
    } else {
      await supabase.from("playlist_likes").insert({ playlist_id: playlistId, user_id: userId });
      setIsLiked(true);
    }
    setLikeLoading(false);
  }, [userId, playlistId, isLiked, likeLoading]);

  const handleShare = useCallback(async () => {
    const url = playlistId
      ? `${window.location.origin}/p/${playlistId}`
      : window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: just open the URL
    }
  }, [playlistId]);

  const title = currentTrack?.title || "Nothing playing";
  const artist = currentTrack?.artist || "";
  const coverUrl = !coverFailed ? (currentTrack?.coverUrl || currentTrack?.cover_url || "") : "";
  const sliderVal = Number.isFinite(progress) ? progress : 0;

  if (!currentTrack) return null;

  return (
    <>
      {showQueue && <QueuePanel onClose={() => setShowQueue(false)} />}

      <div
        className="fixed left-0 right-0 bottom-0 z-50"
        style={{
          background: "color-mix(in srgb, var(--midnight) 96%, black)",
          borderTop: "1px solid color-mix(in srgb, var(--line) 70%, transparent)",
          backdropFilter: "blur(14px)",
        }}
      >
        {/* Progress bar */}
        <div className="relative w-full" style={{ height: 3 }}>
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: `${sliderVal}%`,
              background: "var(--gold)",
              transition: isSeeking ? "none" : "width 0.4s linear",
            }}
          />
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={sliderVal}
            onMouseDown={() => setIsSeeking(true)}
            onTouchStart={() => setIsSeeking(true)}
            onChange={(e) => {
              const pct = Number(e.target.value || 0);
              setCurrentTime(duration ? (pct / 100) * duration : 0);
            }}
            onMouseUp={(e) => { seekToPercent(Number(e.currentTarget.value)); setIsSeeking(false); }}
            onTouchEnd={(e) => { seekToPercent(Number(e.currentTarget.value)); setIsSeeking(false); }}
            onPointerUp={(e) => { seekToPercent(Number(e.currentTarget.value)); setIsSeeking(false); }}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
            style={{ height: 12, top: -4 }}
            aria-label="Seek"
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 flex items-center gap-4" style={{ height: 68 }}>

          {/* ── Left: cover + track info ─────────────────────────────── */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 border"
              style={{ borderColor: "color-mix(in srgb, var(--line) 70%, transparent)" }}
            >
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                  onError={() => setCoverFailed(true)}
                />
              ) : (
                <div
                  className="w-full h-full"
                  style={{ background: "color-mix(in srgb, var(--plum) 25%, var(--midnight))" }}
                />
              )}
            </div>

            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate leading-snug">
                {title}
              </div>
              <div className="text-xs truncate leading-snug" style={{ color: "var(--muted)" }}>
                {artist || "Unknown artist"}
                {playlistTitle && (
                  <span className="opacity-60"> · {playlistTitle}</span>
                )}
              </div>
            </div>
          </div>

          {/* ── Center: transport controls ───────────────────────────── */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <CtrlBtn onClick={prev} label="Previous" title="Previous">
              <IconPrev />
            </CtrlBtn>

            <button
              type="button"
              onClick={toggle}
              aria-label={isPlaying ? "Pause" : "Play"}
              title={isPlaying ? "Pause" : "Play"}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:brightness-110 flex-shrink-0"
              style={{ background: "var(--gold)", color: "#0b0f1a" }}
            >
              {isPlaying ? <IconPause /> : <IconPlay />}
            </button>

            <CtrlBtn onClick={next} label="Next" title="Next">
              <IconNext />
            </CtrlBtn>
          </div>

          {/* ── Time ─────────────────────────────────────────────────── */}
          <div
            className="hidden sm:flex items-center gap-1.5 text-xs flex-shrink-0 tabular-nums"
            style={{ color: "var(--muted)" }}
          >
            <span>{fmtTime(currentTime)}</span>
            <span>/</span>
            <span>{fmtTime(duration)}</span>
          </div>

          {/* ── Right: extras ────────────────────────────────────────── */}
          <div className="flex items-center gap-1 flex-shrink-0">

            {/* Like playlist */}
            {playlistId && userId && (
              <CtrlBtn
                onClick={handleLike}
                label={isLiked ? "Unlike" : "Like playlist"}
                title={isLiked ? "Unlike playlist" : "Like playlist"}
                active={isLiked}
              >
                <span style={{ color: isLiked ? "#f43f5e" : undefined }}>
                  <IconHeart filled={isLiked} />
                </span>
              </CtrlBtn>
            )}

            {/* Share */}
            <CtrlBtn
              onClick={handleShare}
              label="Share"
              title={copied ? "Copied!" : "Share"}
              active={copied}
            >
              {copied ? <IconCheck /> : <IconShare />}
            </CtrlBtn>

            {/* Add current track to a playlist */}
            {currentTrack && userId && (
              <div className="relative" ref={addToPlaylistRef}>
                <CtrlBtn
                  onClick={() => setShowAddToPlaylist((v) => !v)}
                  label="Add to playlist"
                  title="Add to playlist"
                  active={showAddToPlaylist}
                >
                  <IconAddToPlaylist />
                </CtrlBtn>
                {showAddToPlaylist && (
                  <AddToPlaylistPopup
                    track={currentTrack}
                    onClose={() => setShowAddToPlaylist(false)}
                    anchorRef={addToPlaylistRef}
                  />
                )}
              </div>
            )}

            {/* Volume */}
            <div className="relative hidden sm:block" ref={volumeRef}>
              <CtrlBtn
                onClick={() => setShowVolume((v) => !v)}
                label="Volume"
                title="Volume"
                active={showVolume}
              >
                <IconVolume level={volume} />
              </CtrlBtn>
              {showVolume && (
                <div
                  className="absolute bottom-12 right-0 rounded-2xl border px-4 py-3 flex flex-col items-center gap-2"
                  style={{
                    background: "var(--midnight)",
                    borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                    width: 44,
                    boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
                  }}
                >
                  <span className="text-xs" style={{ color: "var(--muted)" }}>{volume}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={volume}
                    onChange={(e) => setPlayerVolume(Number(e.target.value))}
                    className="accent-yellow-400"
                    style={{
                      writingMode: "vertical-lr",
                      direction: "rtl",
                      height: 80,
                      width: 4,
                      cursor: "pointer",
                    }}
                    aria-label="Volume"
                  />
                </div>
              )}
            </div>

            {/* Queue */}
            <CtrlBtn
              onClick={() => setShowQueue((v) => !v)}
              label="Queue"
              title={`Queue (${queue.length} tracks)`}
              active={showQueue}
            >
              <IconQueue />
              {queue.length > 0 && (
                <span
                  className="absolute -top-1 -right-1 text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold"
                  style={{ background: "var(--gold)", color: "#0b0f1a" }}
                >
                  {queue.length > 99 ? "99" : queue.length}
                </span>
              )}
            </CtrlBtn>

            {/* View playlist */}
            {playlistId && (
              <Link
                href={`/p/${playlistId}`}
                className="hidden md:flex w-8 h-8 items-center justify-center rounded-full transition-all text-white/40 hover:text-white hover:bg-white/8"
                title="Go to playlist"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                </svg>
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Reusable icon button ──────────────────────────────────────────────────────

function CtrlBtn({ onClick, label, title, active, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title || label}
      className="relative w-8 h-8 flex items-center justify-center rounded-full transition-all"
      style={{
        color: active ? "var(--gold)" : "rgba(255,255,255,0.6)",
        background: active ? "color-mix(in srgb, var(--gold) 12%, transparent)" : "transparent",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = active ? "color-mix(in srgb, var(--gold) 12%, transparent)" : "transparent"; }}
    >
      {children}
    </button>
  );
}
