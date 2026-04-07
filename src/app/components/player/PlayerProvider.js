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

function normalizeTrack(track, idx = 0) {
  const rawId =
    track?.videoId ||
    track?.youtube_video_id ||
    track?.youtubeUrl ||
    track?.youtube_url ||
    "";

  return {
    id: track?.id || `${idx}`,
    videoId: String(rawId || "").trim(),
    youtube_video_id: String(rawId || "").trim(),
    title: track?.title || `Track ${idx + 1}`,
    artist: track?.artist || "",
    coverUrl: track?.coverUrl || track?.cover_url || "",
    position: track?.position ?? idx + 1,
  };
}

export function PlayerProvider({ children }) {
  const ytRef = useRef(null);

  // Queue = list of tracks
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(-1);

  // Playlist context for presence
  const [playlistId, setPlaylistId] = useState(null);
  const [playlistTitle, setPlaylistTitle] = useState(null);

  // Presence
  const presenceChannelRef = useRef(null);
  const presenceUserRef = useRef(null);

  const current = index >= 0 && index < queue.length ? queue[index] : null;
  const currentTrack = current;

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [shouldAutoplay, setShouldAutoplay] = useState(false);

  // Progress / time state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  // Get auth user once on mount and store in ref
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

      // Join the global presence channel
      const channel = supabase.channel("presence:listening", {
        config: { presence: { key: user.id } },
      });

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          presenceChannelRef.current = channel;
        }
      });
    });

    return () => {
      presenceChannelRef.current?.untrack?.();
      supabase.removeAllChannels();
    };
  }, []);

  // Broadcast presence whenever track or play state changes
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
    }, isPlaying ? 400 : 1000);

    return () => clearInterval(timer);
  }, [isReady, isPlaying, updateTiming]);

  const onReady = useCallback(
    (e) => {
      ytRef.current = e.target;
      setIsReady(true);
      try {
        e.target.setVolume(volume);
      } catch {}
      updateTiming();
    },
    [volume, updateTiming]
  );

  useEffect(() => {
    if (!isReady || !ytRef.current) return;
    if (!shouldAutoplay) return;
    if (!current?.videoId) return;

    try {
      ytRef.current.loadVideoById(current.videoId);
      ytRef.current.playVideo();
      setIsPlaying(true);
      setCurrentTime(0);
      // Do NOT clear shouldAutoplay here yet.
      // Wait until onPlay/onStateChange confirms playback actually started.
    } catch {
      // keep autoplay intent if the player rejects once; user can still hit play manually
    }
  }, [isReady, shouldAutoplay, current?.videoId]);

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

  const loadAndCue = useCallback((videoId) => {
    if (!ytRef.current || !videoId) return;
    try {
      ytRef.current.cueVideoById(videoId);
      setIsPlaying(false);
      setCurrentTime(0);
    } catch {}
  }, []);

  // Replace queue and start at a specific index
  const loadQueue = useCallback(
    (tracks, startIndex = 0, context = {}) => {
      const list = Array.isArray(tracks)
        ? tracks.map((t, i) => normalizeTrack(t, i)).filter((t) => t.videoId)
        : [];
      if (!list.length) return;

      const i = clamp(startIndex, 0, list.length - 1);
      setQueue(list);
      setIndex(i);
      setCurrentTime(0);
      setDuration(0);
      setShouldAutoplay(true);
      setIsPlaying(true);

      if (context.playlistId !== undefined) setPlaylistId(context.playlistId);
      if (context.playlistTitle !== undefined) setPlaylistTitle(context.playlistTitle);
    },
    [loadAndPlay]
  );

  // Backward-compatible alias
  const playQueue = loadQueue;

  // Play a single track, or resume current playback if called with no args
  const play = useCallback(
    (track) => {
      if (track) {
        const normalized = normalizeTrack(track, 0);
        if (!normalized.videoId) return;
        setQueue([normalized]);
        setIndex(0);
        setCurrentTime(0);
        setDuration(0);
        setShouldAutoplay(true);

        // Let the autoplay effect handle starting playback after state updates settle.
        setIsPlaying(true);
        return;
      }

      if (!ytRef.current) return;
      try {
        ytRef.current.playVideo();
        setIsPlaying(true);
      } catch {}
    },
    [loadAndPlay]
  );

  const playAt = useCallback(
    (i) => {
      if (i < 0 || i >= queue.length) return;
      setIndex(i);
      setCurrentTime(0);
      setDuration(0);
      loadAndPlay(queue[i]?.videoId);
    },
    [queue, loadAndPlay]
  );

  const next = useCallback(() => {
    if (!queue.length) return;
    const i = index + 1;
    if (i >= queue.length) {
      setIsPlaying(false);
      return; // stop at end
    }
    setIndex(i);
    setCurrentTime(0);
    setDuration(0);
    loadAndPlay(queue[i]?.videoId);
  }, [queue, index, loadAndPlay]);

  const prev = useCallback(() => {
    if (!queue.length) return;

    // If we're a few seconds into the song, restart current song first.
    if (currentTime > 3 && ytRef.current) {
      try {
        ytRef.current.seekTo(0, true);
        setCurrentTime(0);
      } catch {}
      return;
    }

    const i = Math.max(0, index - 1);
    if (i === index) {
      if (ytRef.current) {
        try {
          ytRef.current.seekTo(0, true);
          setCurrentTime(0);
        } catch {}
      }
      return;
    }

    setIndex(i);
    setCurrentTime(0);
    setDuration(0);
    loadAndPlay(queue[i]?.videoId);
  }, [queue, index, currentTime, loadAndPlay]);

  const togglePlay = useCallback(() => {
    if (!ytRef.current) return;
    try {
      const state = ytRef.current.getPlayerState(); // 1 playing, 2 paused
      if (state === 1) {
        ytRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        ytRef.current.playVideo();
        setIsPlaying(true);
      }
    } catch {}
  }, []);

  // Alias expected by playlist page
  const toggle = togglePlay;

  const stop = useCallback(() => {
    if (!ytRef.current) return;
    try {
      ytRef.current.stopVideo();
    } catch {}
    setIsPlaying(false);
    setCurrentTime(0);
    setShouldAutoplay(false);
  }, []);

  const seekToSeconds = useCallback((seconds) => {
    if (!ytRef.current) return;
    const safe = Math.max(0, Number(seconds) || 0);
    try {
      ytRef.current.seekTo(safe, true);
      setCurrentTime(safe);
    } catch {}
  }, []);

  const seekToPercent = useCallback(
    (pct) => {
      if (!duration) return;
      const nextSeconds = (clamp(Number(pct) || 0, 0, 100) / 100) * duration;
      seekToSeconds(nextSeconds);
    },
    [duration, seekToSeconds]
  );

  const setPlayerVolume = useCallback((v) => {
    const nextV = Math.max(0, Math.min(100, Number(v) || 0));
    setVolume(nextV);
    if (ytRef.current) {
      try {
        ytRef.current.setVolume(nextV);
      } catch {}
    }
  }, []);

  const progress = duration > 0 ? clamp((currentTime / duration) * 100, 0, 100) : 0;

  const value = useMemo(
    () => ({
      queue,
      index,
      current,
      currentTrack,
      isReady,
      isPlaying,
      volume,
      currentTime,
      duration,
      progress,
      isSeeking,
      playlistId,
      playlistTitle,
      play,
      loadQueue,
      playQueue,
      playAt,
      next,
      prev,
      toggle,
      togglePlay,
      stop,
      seekToSeconds,
      seekToPercent,
      setPlayerVolume,
      setCurrentTime,
      setIsSeeking,
    }),
    [
      queue,
      index,
      current,
      currentTrack,
      isReady,
      isPlaying,
      volume,
      currentTime,
      duration,
      progress,
      isSeeking,
      playlistId,
      playlistTitle,
      play,
      loadQueue,
      playQueue,
      playAt,
      next,
      prev,
      toggle,
      togglePlay,
      stop,
      seekToSeconds,
      seekToPercent,
      setPlayerVolume,
    ]
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}

      {/* Hidden YouTube player that persists across routes */}
      <div style={{ position: "fixed", left: -9999, top: -9999, width: 1, height: 1, overflow: "hidden" }}>
        <YouTube
          videoId={current?.videoId || ""}
          onReady={onReady}
          opts={{
            height: "1",
            width: "1",
            playerVars: { autoplay: 0, controls: 0, rel: 0, modestbranding: 1, playsinline: 1 },
          }}
          onPlay={() => {
            setIsPlaying(true);
            setShouldAutoplay(false);
            updateTiming();
          }}
          onPause={() => {
            setIsPlaying(false);
            updateTiming();
          }}
          onEnd={() => {
            setIsPlaying(false);
            setCurrentTime(duration || 0);

            // auto-next, but stop at end
            setTimeout(() => {
              const nextIndex = index + 1;
              if (nextIndex < queue.length) {
                setIndex(nextIndex);
                setShouldAutoplay(true);
              }
            }, 0);
          }}
          onStateChange={(e) => {
            const state = e?.data;
            // 1 = playing, 2 = paused, 3 = buffering, 5 = cued
            if (state === 1) {
              setIsPlaying(true);
              setShouldAutoplay(false);
            } else if (state === 2) {
              setIsPlaying(false);
            }
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

// Backward-compatible alias because some pages import usePlayerContext
export function usePlayerContext() {
  return usePlayer();
}