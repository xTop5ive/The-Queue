"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";

export default function NewTalkPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        router.push(`/login?next=${encodeURIComponent("/talk/new")}`);
        return;
      }

      // STUB: we’ll save this to a `posts` table next
      setMsg("Saved (stub). Next step: create a posts table + insert rows.");
      setText("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <h1 className="text-3xl font-semibold">New post</h1>
      <p className="text-white/60 mt-1">Talk about a song, artist, set, or moment.</p>

      <form onSubmit={submit} className="card p-5 mt-6">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Example: SZA’s set was unreal…"
          className="w-full min-h-[140px] px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
        />
        <div className="mt-4 flex gap-2">
          <button className="inBtn" disabled={loading || !text.trim()}>
            {loading ? "Posting…" : "Post"}
          </button>
          <button type="button" className="px-4 py-2 rounded-full border text-white/80"
            style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
            onClick={() => router.push("/feed")}
          >
            Cancel
          </button>
        </div>

        {msg ? <div className="mt-3 text-sm text-white/70">{msg}</div> : null}
      </form>
    </div>
  );
}