"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";

function toSlug(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function CreateCommunityPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [allCommunities, setAllCommunities] = useState([]);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [slugError, setSlugError] = useState("");
  const [description, setDescription] = useState("");
  const [parentSlug, setParentSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) { router.replace("/login?next=/communities/create"); return; }
      setUser(auth.user);
      const { data } = await supabase.from("communities").select("slug,name").order("name");
      setAllCommunities(data || []);
      setAuthLoading(false);
    })();
  }, [router, supabase]);

  // Auto-generate slug from name unless user has manually edited it
  useEffect(() => {
    if (!slugManual) setSlug(toSlug(name));
  }, [name, slugManual]);

  const validateSlug = async (val) => {
    if (!val) { setSlugError("Slug is required."); return false; }
    if (!/^[a-z0-9-]+$/.test(val)) { setSlugError("Only lowercase letters, numbers, and hyphens."); return false; }
    const { data } = await supabase.from("communities").select("slug").eq("slug", val).maybeSingle();
    if (data) { setSlugError("This slug is already taken."); return false; }
    setSlugError("");
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Name is required."); return; }
    const valid = await validateSlug(slug);
    if (!valid) return;

    setSubmitting(true);
    try {
      const { error: insertErr } = await supabase.from("communities").insert({
        slug,
        name: name.trim(),
        description: description.trim() || null,
        parent_slug: parentSlug || null,
        is_official: false,
        creator_user_id: user.id,
        member_count: 0,
      });
      if (insertErr) throw insertErr;

      // Auto-join the community you just created
      await supabase.from("community_members").insert({ user_id: user.id, community_slug: slug });

      router.push(`/communities/${slug}`);
    } catch (e) {
      setError(e?.message || "Could not create community.");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return <div className="max-w-2xl mx-auto px-5 py-16 text-white/50 text-center">Loading…</div>;

  const inputStyle = {
    borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
    background: "transparent",
    color: "white",
  };

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      {/* Header */}
      <div className="mb-8">
        <Link href="/communities" className="text-sm text-white/50 hover:text-white/80">← Communities</Link>
        <div className="text-xs uppercase tracking-wide mt-4" style={{ color: "var(--muted)" }}>The Queue</div>
        <h1 className="text-3xl font-semibold text-white mt-2">Create a Community</h1>
        <p className="text-white/60 mt-2">Build a space around a sound, scene, or music culture.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-5">
        {/* Name */}
        <div>
          <label className="block text-sm text-white/70 mb-1.5">Community Name <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Houston Classics"
            maxLength={60}
            className="w-full rounded-2xl border px-4 py-3 outline-none placeholder-white/30 focus:border-white/30"
            style={inputStyle}
          />
        </div>

        {/* Slug */}
        <div>
          <label className="block text-sm text-white/70 mb-1.5">URL Slug <span className="text-red-400">*</span></label>
          <div className="flex items-center rounded-2xl border overflow-hidden" style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}>
            <span className="px-4 text-sm border-r" style={{ color: "var(--muted)", borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}>
              /communities/
            </span>
            <input
              type="text"
              value={slug}
              onChange={(e) => { setSlugManual(true); setSlug(toSlug(e.target.value)); setSlugError(""); }}
              onBlur={() => slug && validateSlug(slug)}
              placeholder="houston-classics"
              className="flex-1 px-4 py-3 bg-transparent text-white outline-none placeholder-white/30"
            />
          </div>
          {slugError && <p className="text-red-400 text-xs mt-1">{slugError}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm text-white/70 mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this community about?"
            rows={3}
            maxLength={280}
            className="w-full rounded-2xl border px-4 py-3 outline-none placeholder-white/30 resize-none focus:border-white/30"
            style={inputStyle}
          />
          <div className="text-xs mt-1 text-right" style={{ color: "var(--muted)" }}>{description.length}/280</div>
        </div>

        {/* Parent community */}
        <div>
          <label className="block text-sm text-white/70 mb-1">Parent Community <span className="text-white/30">(optional)</span></label>
          <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>
            Make this a sub-community nested under an existing one. For example, "Houston" could live under "Hip Hop → South". Leave blank to create a standalone top-level community.
          </p>
          <select
            value={parentSlug}
            onChange={(e) => setParentSlug(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 outline-none focus:border-white/30"
            style={{ ...inputStyle, color: parentSlug ? "white" : "rgba(255,255,255,0.3)" }}
          >
            <option value="">None — standalone community</option>
            {allCommunities.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name} (/{c.slug})</option>
            ))}
          </select>
          {parentSlug && (
            <p className="text-xs mt-1.5" style={{ color: "var(--muted)" }}>
              Will appear at <span className="text-white/60">/communities/{parentSlug} → your community</span>
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300 text-sm">{error}</div>
        )}

        <div className="flex gap-3 mt-2">
          <button
            type="submit"
            disabled={submitting}
            className="inBtn"
            style={{ opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? "Creating…" : "Create Community"}
          </button>
          <Link
            href="/communities"
            className="px-5 py-2.5 rounded-full border text-sm"
            style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)", color: "var(--fog)" }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
