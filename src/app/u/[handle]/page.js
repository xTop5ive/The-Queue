"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}

function fmtHandle(h) {
  const v = String(h || "").trim();
  if (!v) return "@user";
  return v.startsWith("@") ? v : `@${v}`;
}

function normalizePlaylist(row) {
  return {
    ...row,
    id: row.id,
    title: row.title,
    description: row.description,
    tags: row.tags || [],
    isPublic: row.is_public ?? true,
    createdAt: row.created_at,
    likes: row.likes_count ?? 0,
    coverUrl: row.cover_url || "/placeholder-cover.png",
    userId: row.user_id,
  };
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useMemo(() => getSupabase(), []);

  const handleParam =
    typeof params?.handle === "string" ? params.handle : Array.isArray(params?.handle) ? params.handle[0] : "";

  const handle = fmtHandle(decodeURIComponent(handleParam || "")).toLowerCase();

  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState(null);

  const [profile, setProfile] = useState(null); // { id, handle, username, avatar_url }
  const [playlists, setPlaylists] = useState([]);

  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError("");

      try {
        // 1) get logged-in viewer (optional)
        const { data: auth } = await supabase.auth.getUser();
        const u = auth?.user || null;
        if (alive) setViewer(u);

        // 2) try to find profile by handle in `profiles` table
        //    NOTE: if you don’t have `profiles`, this will fail gracefully.
        let foundProfile = null;

        try {
          const handleNoAt = handle.replace(/^@/, "");
          const { data: prof, error: profErr } = await supabase
            .from("profiles")
            .select("id, handle, username, avatar_url")
            .or(`handle.eq.${handle},handle.eq.@${handleNoAt},username.eq.${handleNoAt}`)
            .maybeSingle();

          if (!profErr && prof?.id) {
            foundProfile = prof;
          }
        } catch {
          // ignore: profiles table might not exist yet
        }

        // 3) fallback: if profiles not found, and this handle matches the logged-in user, use their id
        if (!foundProfile && u) {
          const raw =
            u.user_metadata?.handle ||
            u.user_metadata?.username ||
            (u.email ? u.email.split("@")[0] : "");

          const viewerHandle = fmtHandle(raw).toLowerCase();
          if (viewerHandle === handle) {
            foundProfile = {
              id: u.id,
              handle: viewerHandle,
              username: raw,
              avatar_url: null,
            };
          }
        }

        if (!foundProfile) {
          if (alive) {
            setProfile({ id: null, handle, username: handle.replace(/^@/, ""), avatar_url: null });
            setPlaylists([]);
            setLoading(false);
          }
          return;
        }

        if (alive) setProfile(foundProfile);

        // 4) get playlists for that user_id
        const { data: rows, error: plErr } = await supabase
          .from("playlists")
          .select("id, user_id, title, description, tags, is_public, cover_url, created_at, likes_count")
          .eq("user_id", foundProfile.id)
          .order("created_at", { ascending: false });

        if (plErr) throw plErr;

        const mapped = (rows || []).map(normalizePlaylist);

        // If viewer is not owner, only show public playlists
        const filtered =
          viewer?.id && viewer.id === foundProfile.id ? mapped : mapped.filter((x) => x.isPublic);

        if (alive) setPlaylists(filtered);
      } catch (e) {
        if (alive) setError(e?.message || "Could not load profile.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [handle, supabase]); // keep it simple

  const displayHandle = fmtHandle(profile?.handle || handle);

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">
      {/* Top */}
      <div className="flex items-center justify-between">
        <Link href="/explore" className="text-sm underline text-white/70 hover:text-white">
          ← Back to Explore
        </Link>

        {viewer ? (
          <Link href="/new" className="inBtn">
            + New playlist
          </Link>
        ) : (
          <Link href="/login" className="inBtn">
            Sign in
          </Link>
        )}
      </div>

      {/* Header */}
      <div className="mt-8 card p-6">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full border flex-shrink-0"
            style={{
              borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
              background: "color-mix(in srgb, var(--midnight) 85%, transparent)",
            }}
          />
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              Creator
            </div>
            <div className="text-2xl font-semibold truncate">{displayHandle}</div>
            <div className="text-white/60 text-sm mt-1">
              {playlists.length} playlist{playlists.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card p-6 mt-6 text-white/70">Loading profile…</div>
      ) : error ? (
        <div className="card p-6 mt-6 text-red-300">{error}</div>
      ) : (
        <>
          {/* Playlists grid */}
          <div className="mt-8 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Playlists</h2>
              <p className="text-white/60 text-sm mt-1">Real playlists pulled from Supabase.</p>
            </div>
          </div>

          {playlists.length ? (
            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {playlists.map((p) => (
                <div key={p.id} className="card overflow-hidden hover:-translate-y-0.5 transition">
                  <Link href={`/p/${p.id}`} className="block">
                    <div className="relative">
                      <img
                        src={p.coverUrl || "/placeholder-cover.png"}
                        alt=""
                        className="w-full object-cover"
                        style={{ height: 170 }}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <div
                        className="absolute inset-x-0 bottom-0 p-3"
                        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)" }}
                      >
                        <div className="font-semibold leading-tight">{p.title}</div>
                        <div className="text-xs" style={{ color: "var(--muted)" }}>
                          ♥ {p.likes} likes
                        </div>
                      </div>
                    </div>
                  </Link>

                  <div className="p-4">
                    {p.description ? (
                      <div className="text-sm text-white/70 line-clamp-2">{p.description}</div>
                    ) : (
                      <div className="text-sm text-white/40">No description yet.</div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {(p.tags || []).slice(0, 4).map((t) => (
                        <Link
                          key={`${p.id}-${t}`}
                          href={`/explore?tags=${encodeURIComponent(String(t).toLowerCase())}`}
                          className="px-2.5 py-1 rounded-full border text-xs"
                          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                        >
                          #{t}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-6 mt-4">
              <p className="text-white/60">No playlists found for this creator (or they’re private).</p>
              {viewer ? (
                <div className="mt-3">
                  <Link href="/new" className="inBtn">
                    Create your first playlist
                  </Link>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}