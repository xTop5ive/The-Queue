"use client";

import { useMemo, useState } from "react";

function norm(s) {
  return s.trim().toLowerCase().replace(/\s+/g, "-");
}

export default function TagInput({ value = [], onChange }) {
  const [text, setText] = useState("");

  const tags = useMemo(() => Array.from(new Set(value.map(norm))).filter(Boolean), [value]);

  function addTag(raw) {
    const t = norm(raw);
    if (!t) return;
    if (tags.includes(t)) return;
    if (tags.length >= 10) return;
    onChange?.([...tags, t]);
  }

  function removeTag(t) {
    onChange?.(tags.filter((x) => x !== t));
  }

  function onKeyDown(e) {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      e.preventDefault();
      addTag(text);
      setText("");
    }
    if (e.key === "Backspace" && !text && tags.length) {
      removeTag(tags[tags.length - 1]);
    }
  }

  return (
    <div
      className="rounded-2xl border px-3 py-2"
      style={{
        background: "color-mix(in srgb, var(--midnight) 90%, transparent)",
        borderColor: "color-mix(in srgb, var(--line) 85%, transparent)",
      }}
    >
      <div className="flex flex-wrap gap-2 items-center">
        {tags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => removeTag(t)}
            className="px-3 py-1 rounded-full border text-sm hover:opacity-90"
            style={{
              borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
              background: "color-mix(in srgb, var(--midnight) 85%, transparent)",
              color: "var(--fog)",
            }}
            title="Click to remove"
          >
            #{t} <span className="text-white/50">✕</span>
          </button>
        ))}

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={tags.length ? "Add another tag…" : "Type a tag and press Enter"}
          className="flex-1 min-w-[180px] bg-transparent outline-none px-2 py-2 text-sm"
          style={{ color: "var(--fog)" }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px]" style={{ color: "var(--muted)" }}>
        <span>Press Enter, comma, or Tab to add.</span>
        <span>{tags.length}/10</span>
      </div>
    </div>
  );
}