"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";

export default function NewAfterglowPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);

  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        router.push(`/login?next=${encodeURIComponent("/afterglow/new")}`);
        return;
      }

      // STUB: we’ll save this to an `afterglows` table with expires_at next
      setMsg("Saved (stub). Next step: create afterglows table + auto-expire after 24h.");
      setTitle("");
      setWhen("");
      setNote("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <h1 className="text-3xl font-semibold">New Afterglow</h1>
      <p className="text-white/60 mt-1">A 24-hour concert recap (photos later).</p>

      <form onSubmit={submit} className="card p-5 mt-6 grid gap-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Concert / Event name"
          className="w-full px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
        />

        <input
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          placeholder="Date (ex: Mar 20, 2026)"
          className="w-full px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
        />

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What was the best moment?"
          className="w-full min-h-[120px] px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
        />

        <div className="flex gap-2">
          <button className="inBtn" disabled={loading || !title.trim()}>
            {loading ? "Posting…" : "Post Afterglow"}
          </button>
          <button type="button" className="px-4 py-2 rounded-full border text-white/80"
            style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
            onClick={() => router.push("/feed")}
          >
            Cancel
          </button>
        </div>

        {msg ? <div className="text-sm text-white/70">{msg}</div> : null}
      </form>
    </div>
  );
}