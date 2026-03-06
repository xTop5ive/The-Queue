"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";

export default function SignupPage() {
  const supabase = createBrowserClient();
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/";

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // if already logged in, go back
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) router.replace(next);
    });
  }, [supabase, router, next]);

  async function signUp(e) {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    const cleanedEmail = email.trim().toLowerCase();
    const cleanedHandle = (handle || cleanedEmail.split("@")[0] || "user").trim().toLowerCase();

    const { data, error } = await supabase.auth.signUp({
      email: cleanedEmail,
      password,
      options: {
        data: {
          full_name: name.trim() || cleanedHandle,
          handle: cleanedHandle,
        },
      },
    });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    // If email confirmations are ON, session might be null until they confirm.
    if (!data?.session) {
      setMsg("Check your email to confirm your account, then come back and sign in.");
      return;
    }

    router.replace(next);
  }

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Create account</h1>
      <p style={{ opacity: 0.8, marginTop: 8 }}>
        Join <b>The Queue</b>.
      </p>

      <form onSubmit={signUp} style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <input
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="Handle (optional, ex: whatsup5ive)"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="Password (min 6 chars)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        <button
          type="submit"
          disabled={loading}
          style={{ padding: 12, borderRadius: 10, background: "#d6b25e", color: "black", fontWeight: 700 }}
        >
          {loading ? "Creating..." : "Create account"}
        </button>

        {msg ? <div style={{ color: msg.includes("Check your email") ? "#ffd479" : "#ff8a8a" }}>{msg}</div> : null}

        <div style={{ marginTop: 6, opacity: 0.85 }}>
          Already have an account?{" "}
          <a href={`/login?next=${encodeURIComponent(next)}`} style={{ textDecoration: "underline", fontWeight: 600 }}>
            Sign in
          </a>
        </div>
      </form>
    </main>
  );
}

const inputStyle = {
  padding: 12,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.15)",
  background: "rgba(255,255,255,.06)",
  color: "white",
};