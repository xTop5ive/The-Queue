"use client";

import React, { useMemo, useState } from "react";
import { usePlayer } from "./PlayerProvider";

function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

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
  } = usePlayer();

  const [coverFailed, setCoverFailed] = useState(false);

  const title = currentTrack?.title || "Nothing playing";
  const artist = currentTrack?.artist || "";
  const coverUrl = !coverFailed ? (currentTrack?.coverUrl || currentTrack?.cover_url || "") : "";

  // slider value should follow current progress unless user is dragging
  const sliderVal = useMemo(() => {
    return Number.isFinite(progress) ? progress : 0;
  }, [progress]);

  // If nothing loaded, don’t show bar (optional). If you want it always visible, remove this.
  if (!currentTrack) return null;

  return (
    <div
      className="fixed left-0 right-0 bottom-0 z-50"
      style={{
        background: "color-mix(in srgb, var(--midnight) 92%, black)",
        borderTop: "1px solid color-mix(in srgb, var(--line) 70%, transparent)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
        {/* Left: now playing */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-12 h-12 rounded-lg overflow-hidden border flex-shrink-0"
            style={{ borderColor: "color-mix(in srgb, var(--line) 75%, transparent)" }}
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
                style={{ background: "color-mix(in srgb, var(--midnight) 80%, transparent)" }}
              />
            )}
          </div>

          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{title}</div>
            <div className="text-xs truncate" style={{ color: "var(--muted)" }}>
              {artist ? `Playing • ${artist}` : "Playing"}
            </div>
          </div>
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={prev}
            className="px-4 py-2 rounded-full border text-sm"
            style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
            aria-label="Previous"
            title="Previous"
          >
            ⏮
          </button>

          <button
            type="button"
            onClick={toggle}
            className="px-4 py-2 rounded-full border text-sm"
            style={{
              borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
              background: "color-mix(in srgb, var(--gold) 18%, transparent)",
            }}
            aria-label={isPlaying ? "Pause" : "Play"}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? "❚❚" : "▶"}
          </button>

          <button
            type="button"
            onClick={next}
            className="px-4 py-2 rounded-full border text-sm"
            style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
            aria-label="Next"
            title="Next"
          >
            ⏭
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="max-w-6xl mx-auto px-5 pb-3">
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
            const seconds = duration ? (pct / 100) * duration : 0;
            setCurrentTime(seconds);
          }}
          onMouseUp={(e) => {
            const pct = Number(e.currentTarget.value || 0);
            seekToPercent(pct);
            setIsSeeking(false);
          }}
          onTouchEnd={(e) => {
            const pct = Number(e.currentTarget.value || 0);
            seekToPercent(pct);
            setIsSeeking(false);
          }}
          onPointerUp={(e) => {
            const pct = Number(e.currentTarget.value || 0);
            seekToPercent(pct);
            setIsSeeking(false);
          }}
          className="w-full"
          aria-label="Seek playback"
        />

        <div className="mt-1 flex justify-between text-[11px]" style={{ color: "var(--muted)" }}>
          <span>{fmtTime(isSeeking ? currentTime : currentTime || 0)}</span>
          <span>{fmtTime(duration || 0)}</span>
        </div>
      </div>
    </div>
  );
}