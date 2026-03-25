"use client";

import React from "react";
import { usePlayer } from "./PlayerProvider";

export default function StickyPlayerBar() {
  const { current, isPlaying, togglePlay, stop, volume, setPlayerVolume } = usePlayer();

  if (!current) return null;

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
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-12 h-12 rounded-lg overflow-hidden border flex-shrink-0"
            style={{ borderColor: "color-mix(in srgb, var(--line) 75%, transparent)" }}
          >
            <img src={current.coverUrl || "/placeholder-cover.png"} alt="" className="w-full h-full object-cover" />
          </div>

          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{current.title || "Untitled"}</div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>
              {current.artist || "Unknown"} • YouTube
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            className="px-4 py-2 rounded-full border text-sm"
            style={{
              borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
              background: "color-mix(in srgb, var(--gold) 18%, transparent)",
              color: "var(--fog)",
            }}
            onClick={togglePlay}
          >
            {isPlaying ? "❚❚" : "▶"}
          </button>

          <button
            type="button"
            className="px-4 py-2 rounded-full border text-sm"
            style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)", color: "var(--fog)" }}
            onClick={stop}
          >
            ⏹
          </button>

          <div className="hidden sm:flex items-center gap-2 ml-2">
            <span className="text-xs text-white/60">Vol</span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setPlayerVolume(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}