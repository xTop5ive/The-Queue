"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import YouTube from "react-youtube";
import { createBrowserClient } from "@/lib/supabase-browser";

const PlayerContext = createContext(null);

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function extractVideoId(raw) {
  const v = String(raw || "").trim();
  if (!v) return "";
  if (/^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
  try {
    const u = new URL(v);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.split("/").filter(Boolean)[0] || "";
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : "";
    }
    const qid = u.searchParams.get("v") || "";
    if (/^[a-zA-Z0-9_-]{11}$/.test(qid)) return qid;
    const parts = u.pathname.split("/").filter(Boolean);
    const ei = parts.indexOf("embed");
    if (ei >= 0 && parts[ei + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[ei + 1])) return parts[ei + 1];
  } catch {}
  return "";
}

function normalizeTrack(track, idx = 0) {
  const rawId =
    track?.videoId ||
    track?.youtube_video_id ||
    track?.youtubeUrl ||
    track?.youtube_url ||
    "";
  const videoId = extractVideoId(rawId);
  return {
    id: track?.id || `${idx}`,
    videoId,
    youtube_video_id: videoId,
    title: track?.title || `Track ${idx + 1}`,
    artist: track?.artist || "",
    coverUrl: track?.coverUrl || track?.cover_url || "",
    position: track?.position ?? idx + 1,
  };
}

export function PlayerProvider({ children }) {
  const ytRef = useRef(null);

  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(-1);
  const [playlistId, setPlaylistId] = useState(null);
  const [playlistTitle, setPlaylistTitle] = useState(null);

  // Refs that always hold current values — used inside YT event callbacks
  // to avoid stale closure bugs
  const queueRef = useRef([]);
  const indexRef = useRef(-1);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { indexRef.current = index; }, [index]);

  const presenceChannelRef = useRef(null);
  const presenceUserRef = useRef(null);

  const current = index >= 0 && index < queue.length ? queue[index] : null;
  const currentTrack = current;

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [shouldAutoplay, setShouldAutoplay] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  // Presence setup
  useEffect(() => {
    let supabase;
    try { supabase = createBrowserClient(); } catch { return; }
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data?.session?.user;
      if (!user) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("handle, display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      presenceUserRef.current = {
        user_id: user.id,
        handle: prof?.handle || user.email?.split("@")[0] || "user",
        display_name: prof?.display_name || "",
        avatar_url: prof?.avatar_url || "",
      };
      const channel = supabase.channel("presence:listening", {
        config: { presence: { key: user.id } },
      });
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") presenceChannelRef.current = channel;
      });
    });
    return () => {
      presenceChannelRef.current?.untrack?.();
      supabase.removeAllChannels();
    };
  }, []);

  useEffect(() => {
    const channel = presenceChannelRef.current;
    const user = presenceUserRef.current;
    if (!channel || !user) return;
    if (isPlaying && current?.videoId) {
      channel.track({
        ...user,
        track_title: current.title || "",
        track_artist: current.artist || "",
        playlist_id: playlistId || null,
        playlist_title: playlistTitle || null,
        playing_at: new Date().toISOString(),
      });
    } else {
      channel.untrack();
    }
  }, [isPlaying, current?.videoId, playlistId, playlistTitle]);

  const updateTiming = useCallback(() => {
    if (!ytRef.current) return;
    try {
      const t = Number(ytRef.current.getCurrentTime?.() || 0);
      const d = Number(ytRef.current.getDuration?.() || 0);
      if (!isSeeking) setCurrentTime(t);
      setDuration(d);
    } catch {}
  }, [isSeeking]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (ytRef.current && isReady) updateTiming();
    }, isPlaying ? 400 : 2000);
    return () => clearInterval(timer);
  }, [isReady, isPlaying, updateTiming]);

  const onReady = useCallback((e) => {
    ytRef.current = e.target;
    setIsReady(true);
    try { e.target.setVolume(volume); } catch {}
    updateTiming();
  }, [volume, updateTiming]);

  // Fallback: if player wasn't ready when loadQueue fired
  useEffect(() => {
    if (!isReady || !ytRef.current || !shouldAutoplay || !current?.videoId) return;
    try {
      ytRef.current.loadVideoById(current.videoId);
      ytRef.current.playVideo();
      setIsPlaying(true);
      setShouldAutoplay(false);
      setCurrentTime(0);
    } catch {}
  }, [isReady, shouldAutoplay]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Core imperative helpers ───────────────────────────────────────────────

  const loadAndPlay = useCallback((videoId) => {
    if (!ytRef.current || !videoId) return;
    try {
      ytRef.current.loadVideoById(videoId);
      ytRef.current.playVideo();
      setIsPlaying(true);
      setCurrentTime(0);
    } catch {
      setIsPlaying(false);
    }
  }, []);

  // ── Queue actions ─────────────────────────────────────────────────────────

  const loadQueue = useCallback((tracks, startIndex = 0, context = {}) => {
    const list = Array.isArray(tracks)
      ? tracks.map((t, i) => normalizeTrack(t, i)).filter((t) => t.videoId)
      : [];
    if (!list.length) return;

    const i = clamp(startIndex, 0, list.length - 1);
    const videoId = list[i].videoId;

    setQueue(list);
    setIndex(i);
    setCurrentTime(0);
    setDuration(0);
    if (context.playlistId !== undefined) setPlaylistId(context.playlistId);
    if (context.playlistTitle !== undefined) setPlaylistTitle(context.playlistTitle);

    // Call YT synchronously — still inside the user-gesture callstack
    if (ytRef.current && videoId) {
      try {
        ytRef.current.loadVideoById(videoId);
        ytRef.current.playVideo();
        setIsPlaying(true);
        setShouldAutoplay(false);
      } catch {
        setShouldAutoplay(true);
        setIsPlaying(true);
      }
    } else {
      setShouldAutoplay(true);
      setIsPlaying(true);
    }
  }, []);

  const playQueue = loadQueue;

  const addToQueue = useCallback((track) => {
    const normalized = normalizeTrack(track, 0);
    if (!normalized.videoId) return;
    setQueue((prev) => {
      // avoid duplicates
      if (prev.some((t) => t.videoId === normalized.videoId)) return prev;
      return [...prev, normalized];
    });
  }, []);

  const removeFromQueue = useCallback((idx) => {
    setQueue((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next;
    });
    setIndex((prev) => {
      if (idx < prev) return prev - 1;
      if (idx === prev) return Math.min(prev, queueRef.current.length - 2);
      return prev;
    });
  }, []);

  const play = useCallback((track) => {
    if (track) {
      const normalized = normalizeTrack(track, 0);
      if (!normalized.videoId) return;
      setQueue([normalized]);
      setIndex(0);
      setCurrentTime(0);
      setDuration(0);
      if (ytRef.current) {
        try {
          ytRef.current.loadVideoById(normalized.videoId);
          ytRef.current.playVideo();
          setIsPlaying(true);
          setShouldAutoplay(false);
        } catch { setShouldAutoplay(true); setIsPlaying(true); }
      } else {
        setShouldAutoplay(true);
        setIsPlaying(true);
      }
      return;
    }
    if (!ytRef.current) return;
    try { ytRef.current.playVideo(); setIsPlaying(true); } catch {}
  }, []);

  const playAt = useCallback((i) => {
    if (i < 0 || i >= queueRef.current.length) return;
    setIndex(i);
    setCurrentTime(0);
    setDuration(0);
    loadAndPlay(queueRef.current[i]?.videoId);
  }, [loadAndPlay]);

  const next = useCallback(() => {
    const q = queueRef.current;
    const i = indexRef.current + 1;
    if (i >= q.length) { setIsPlaying(false); return; }
    setIndex(i);
    setCurrentTime(0);
    setDuration(0);
    loadAndPlay(q[i]?.videoId);
  }, [loadAndPlay]);

  const prev = useCallback(() => {
    const q = queueRef.current;
    if (!q.length) return;
    if (currentTime > 3 && ytRef.current) {
      try { ytRef.current.seekTo(0, true); setCurrentTime(0); } catch {}
      return;
    }
    const i = Math.max(0, indexRef.current - 1);
    if (i === indexRef.current) {
      try { ytRef.current?.seekTo(0, true); setCurrentTime(0); } catch {}
      return;
    }
    setIndex(i);
    setCurrentTime(0);
    setDuration(0);
    loadAndPlay(q[i]?.videoId);
  }, [currentTime, loadAndPlay]);

  const togglePlay = useCallback(() => {
    if (!ytRef.current) return;
    try {
      const state = ytRef.current.getPlayerState();
      if (state === 1) { ytRef.current.pauseVideo(); setIsPlaying(false); }
      else { ytRef.current.playVideo(); setIsPlaying(true); }
    } catch {}
  }, []);

  const toggle = togglePlay;

  const stop = useCallback(() => {
    try { ytRef.current?.stopVideo(); } catch {}
    setIsPlaying(false);
    setCurrentTime(0);
    setShouldAutoplay(false);
  }, []);

  const seekToSeconds = useCallback((seconds) => {
    const safe = Math.max(0, Number(seconds) || 0);
    try { ytRef.current?.seekTo(safe, true); setCurrentTime(safe); } catch {}
  }, []);

  const seekToPercent = useCallback((pct) => {
    if (!duration) return;
    seekToSeconds((clamp(Number(pct) || 0, 0, 100) / 100) * duration);
  }, [duration, seekToSeconds]);

  const setPlayerVolume = useCallback((v) => {
    const nextV = clamp(Number(v) || 0, 0, 100);
    setVolume(nextV);
    try { ytRef.current?.setVolume(nextV); } catch {}
  }, []);

  const progress = duration > 0 ? clamp((currentTime / duration) * 100, 0, 100) : 0;

  const value = useMemo(() => ({
    queue, index, current, currentTrack,
    isReady, isPlaying, volume,
    currentTime, duration, progress, isSeeking,
    playlistId, playlistTitle,
    play, loadQueue, playQueue, playAt,
    next, prev, toggle, togglePlay, stop,
    seekToSeconds, seekToPercent, setPlayerVolume,
    setCurrentTime, setIsSeeking,
    addToQueue, removeFromQueue,
  }), [
    queue, index, current, currentTrack,
    isReady, isPlaying, volume,
    currentTime, duration, progress, isSeeking,
    playlistId, playlistTitle,
    play, loadQueue, playQueue, playAt,
    next, prev, toggle, togglePlay, stop,
    seekToSeconds, seekToPercent, setPlayerVolume,
    addToQueue, removeFromQueue,
  ]);

  return (
    <PlayerContext.Provider value={value}>
      {children}

      {/* Hidden YouTube iframe — videoId intentionally static empty string.
          All playback driven imperatively through ytRef.current so react-youtube
          never calls cueVideoById() on re-render and interrupts playback. */}
      <div style={{ position: "fixed", left: -9999, top: -9999, width: 1, height: 1, overflow: "hidden" }}>
        <YouTube
          videoId=""
          onReady={onReady}
          opts={{
            height: "1",
            width: "1",
            playerVars: { autoplay: 0, controls: 0, rel: 0, modestbranding: 1, playsinline: 1 },
          }}
          onPlay={() => { setIsPlaying(true); setShouldAutoplay(false); updateTiming(); }}
          onPause={() => { setIsPlaying(false); updateTiming(); }}
          onEnd={() => {
            // Use refs so this callback always has the latest queue/index
            const q = queueRef.current;
            const i = indexRef.current;
            const nextI = i + 1;
            if (nextI < q.length) {
              setIndex(nextI);
              setCurrentTime(0);
              setDuration(0);
              loadAndPlay(q[nextI]?.videoId);
            } else {
              setIsPlaying(false);
            }
          }}
          onStateChange={(e) => {
            const state = e?.data;
            if (state === 1) { setIsPlaying(true); setShouldAutoplay(false); }
            else if (state === 2) { setIsPlaying(false); }
            updateTiming();
          }}
        />
      </div>
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}

export function usePlayerContext() {
  return usePlayer();
}
