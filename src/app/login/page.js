"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const supabase = createBrowserClient();
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // If already logged in, bounce them out
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) router.replace(next);
    });
  }, [supabase, router, next]);

  async function signIn(e) {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    // ✅ This makes it feel immediate
    router.replace(next);
  }

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Sign in</h1>
      <p style={{ opacity: 0.8, marginTop: 8 }}>
        Welcome back to <b>The Queue</b>.
      </p>

      <form onSubmit={signIn} style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.06)", color: "white" }}
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.06)", color: "white" }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{ padding: 12, borderRadius: 10, background: "#d6b25e", color: "black", fontWeight: 700 }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        {msg ? <div style={{ color: "#ff8a8a" }}>{msg}</div> : null}
        <div style={{ marginTop: 12, opacity: 0.85 }}>
          New here?{" "}
          <a href={`/signup?next=${encodeURIComponent(next)}`} style={{ textDecoration: "underline", fontWeight: 600 }}>
            Create account
          </a>
        </div>
      </form>
    </main>
  );
}