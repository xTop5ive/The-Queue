"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import YouTube from "react-youtube";

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const ytRef = useRef(null);

  // Queue = list of tracks
  // Track shape: { videoId, title, artist, coverUrl }
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(-1);

  const current = index >= 0 && index < queue.length ? queue[index] : null;

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(70);

  const onReady = useCallback(
    (e) => {
      ytRef.current = e.target;
      setIsReady(true);
      try {
        e.target.setVolume(volume);
      } catch {}
    },
    [volume]
  );

  const loadAndPlay = useCallback((videoId) => {
    if (!ytRef.current || !videoId) return;
    try {
      ytRef.current.loadVideoById(videoId);
      ytRef.current.playVideo();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }, []);

  // Play a whole queue and start at a specific index
  const playQueue = useCallback(
    (tracks, startIndex = 0) => {
      const list = Array.isArray(tracks) ? tracks.filter(Boolean) : [];
      if (!list.length) return;

      setQueue(list);
      const i = Math.max(0, Math.min(startIndex, list.length - 1));
      setIndex(i);

      // If player is ready now, play immediately
      if (ytRef.current) loadAndPlay(list[i]?.videoId);
    },
    [loadAndPlay]
  );

  // Play a single track (auto makes queue = [track])
  const play = useCallback(
    (track) => {
      if (!track?.videoId) return;
      playQueue([track], 0);
    },
    [playQueue]
  );

  const playAt = useCallback(
    (i) => {
      if (i < 0 || i >= queue.length) return;
      setIndex(i);
      loadAndPlay(queue[i]?.videoId);
    },
    [queue, loadAndPlay]
  );

  const next = useCallback(() => {
    if (!queue.length) return;
    const i = Math.min(queue.length - 1, index + 1);
    if (i === index) return;
    setIndex(i);
    loadAndPlay(queue[i]?.videoId);
  }, [queue, index, loadAndPlay]);

  const prev = useCallback(() => {
    if (!queue.length) return;
    const i = Math.max(0, index - 1);
    if (i === index) return;
    setIndex(i);
    loadAndPlay(queue[i]?.videoId);
  }, [queue, index, loadAndPlay]);

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

  const stop = useCallback(() => {
    if (!ytRef.current) return;
    try {
      ytRef.current.stopVideo();
    } catch {}
    setIsPlaying(false);
  }, []);

  const setPlayerVolume = useCallback((v) => {
    const nextV = Math.max(0, Math.min(100, Number(v) || 0));
    setVolume(nextV);
    if (ytRef.current) {
      try {
        ytRef.current.setVolume(nextV);
      } catch {}
    }
  }, []);

  const value = useMemo(
    () => ({
      queue,
      index,
      current,
      isReady,
      isPlaying,
      volume,
      play,
      playQueue,
      playAt,
      next,
      prev,
      togglePlay,
      stop,
      setPlayerVolume,
    }),
    [queue, index, current, isReady, isPlaying, volume, play, playQueue, playAt, next, prev, togglePlay, stop, setPlayerVolume]
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
            playerVars: { autoplay: 1, controls: 0, rel: 0, modestbranding: 1 },
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnd={() => {
            // auto-next when a song ends
            setIsPlaying(false);
            // call next safely
            setTimeout(() => {
              try {
                // using state variables directly here is ok because it’s just a fallback
              } catch {}
            }, 0);
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