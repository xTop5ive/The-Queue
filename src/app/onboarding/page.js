"use client";

/*
 * ONBOARDING — The Queue
 *
 * Required DB migration (run once in Supabase SQL editor before using):
 *
 *   ALTER TABLE profiles
 *     ADD COLUMN IF NOT EXISTS avatar_path        text,
 *     ADD COLUMN IF NOT EXISTS favorite_genres    text[] DEFAULT '{}',
 *     ADD COLUMN IF NOT EXISTS favorite_regions   text[] DEFAULT '{}',
 *     ADD COLUMN IF NOT EXISTS favorite_vibes     text[] DEFAULT '{}',
 *     ADD COLUMN IF NOT EXISTS music_values       text[] DEFAULT '{}',
 *     ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";
import AvatarCropper from "@/components/AvatarCropper";

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeHandle(raw) {
  let h = (raw || "").trim().toLowerCase();
  h = h.replace(/\s+/g, "").replace(/[^a-z0-9_.]/g, "");
  return h || "user";
}

function linesToArray(val) {
  return String(val || "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseTopSongs(val) {
  return String(val || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(" - ");
      if (parts.length >= 2) {
        return { title: parts.slice(0, -1).join(" - ").trim(), artist: parts[parts.length - 1].trim() };
      }
      return { title: line, artist: "" };
    })
    .slice(0, 5);
}

// Vibe label → community name (must match the `name` column in communities table)
const VIBE_MAP = {
  "Late Night":       "Late Night",
  "Chill":            "Chill Vibes",
  "Workout":          "Workout",
  "Road Trip":        "Road Trip",
  "Outside":          "Outside",
  "Cookout":          "Cookout",
  "Brunch":           "Brunch",
  "Club":             "Club",
  "Turnt":            "Turnt",
  "Date Night":       "Date Night",
  "Soft Life":        "Soft Life",
  "Study Vibes":      "Study Vibes",
  "Sunday Morning":   "Sunday Morning",
  "Heartbreak":       "Heartbreak",
  "Hype":             "Hype",
  "Meditation":       "Meditation",
  "Party":            "Party",
  "HBCU Vibes":       "HBCU Vibes",
  "Background Music": "Background Music",
  // legacy / edge case — maps to the same R&B community
  "Toxic R&B":        "R&B",
};


function computeRecommendations(genres, regions, vibes, allCommunities) {
  const namesWanted = new Set([
    ...genres,
    ...regions,
    ...vibes.map((v) => VIBE_MAP[v] || v),
  ]);

  const seen = new Set();
  return allCommunities.filter((c) => {
    if (seen.has(c.slug)) return false;
    const nameLower = c.name.toLowerCase();
    for (const wanted of namesWanted) {
      if (nameLower === wanted.toLowerCase() || nameLower.includes(wanted.toLowerCase())) {
        seen.add(c.slug);
        return true;
      }
    }
    return false;
  });
}

// ── Shared UI Primitives ──────────────────────────────────────────────────────

function StepCard({ title, subtitle, children }) {
  return (
    <div
      className="rounded-2xl border p-6 md:p-8"
      style={{
        borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
        background: "color-mix(in srgb, var(--midnight) 80%, transparent)",
      }}
    >
      <div className="mb-7">
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
        {subtitle && <p className="mt-2 text-white/55 leading-relaxed max-w-lg">{subtitle}</p>}
      </div>
      <div className="grid gap-7">{children}</div>
    </div>
  );
}

function StepSection({ label, hint, children }) {
  return (
    <div>
      <div className="mb-3">
        <div className="text-sm font-semibold text-white">{label}</div>
        {hint && <div className="text-xs text-white/45 mt-0.5">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function MultiSelectChips({ options, selected, onChange, max }) {
  const toggle = (val) => {
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val));
    } else {
      if (max && selected.length >= max) return;
      onChange([...selected, val]);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt);
        const atMax = max && !active && selected.length >= max;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className="px-4 py-2 rounded-full border text-sm transition-all"
            style={{
              borderColor: active
                ? "var(--gold)"
                : "color-mix(in srgb, var(--line) 80%, transparent)",
              background: active
                ? "color-mix(in srgb, var(--gold) 18%, transparent)"
                : "transparent",
              color: active ? "var(--gold)" : atMax ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.75)",
              cursor: atMax ? "not-allowed" : "pointer",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function ProgressBar({ step }) {
  const labels = ["Profile", "Taste", "Communities", "Favorites"];
  return (
    <div className="flex items-start mb-10">
      {labels.map((label, i) => {
        const stepNum = i + 1;
        const done = stepNum < step;
        const active = stepNum === step;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all"
                style={{
                  background: done
                    ? "var(--gold)"
                    : active
                    ? "color-mix(in srgb, var(--gold) 20%, transparent)"
                    : "color-mix(in srgb, var(--line) 60%, transparent)",
                  color: done ? "#0b0f1a" : active ? "var(--gold)" : "var(--muted)",
                  border: active ? "2px solid var(--gold)" : "2px solid transparent",
                }}
              >
                {done ? "✓" : stepNum}
              </div>
              <span
                className="text-xs mt-1.5 whitespace-nowrap"
                style={{ color: active ? "var(--gold)" : done ? "white" : "var(--muted)" }}
              >
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div
                className="flex-1 h-px mx-2 mb-3"
                style={{
                  background:
                    stepNum < step
                      ? "var(--gold)"
                      : "color-mix(in srgb, var(--line) 60%, transparent)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);

  const [viewer, setViewer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [allCommunities, setAllCommunities] = useState([]);

  // Step 1 — Profile basics
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [musicDNA, setMusicDNA] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPath, setAvatarPath] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [cropSrc, setCropSrc] = useState(null); // object URL shown in cropper
  const [handleError, setHandleError] = useState("");

  // Step 2 — Taste
  const [favoriteGenres, setFavoriteGenres] = useState([]);
  const [favoriteRegions, setFavoriteRegions] = useState([]);
  const [favoriteVibes, setFavoriteVibes] = useState([]);
  const [musicValues, setMusicValues] = useState([]);

  // Step 3 — Communities
  const [selectedCommunities, setSelectedCommunities] = useState([]);
  const [communityAutoSelected, setCommunityAutoSelected] = useState(false);

  // Step 4 — Favorites
  const [favoriteArtistsText, setFavoriteArtistsText] = useState("");
  const [favoriteAlbumsText, setFavoriteAlbumsText] = useState("");
  const [favoriteProducersText, setFavoriteProducersText] = useState("");
  const [favoriteDjsText, setFavoriteDjsText] = useState("");
  const [topSongsText, setTopSongsText] = useState("");

  // Auth check + pre-fill
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user || null;

      if (!user) {
        router.replace("/login?next=/onboarding");
        return;
      }

      if (!alive) return;
      setViewer(user);

      const meta = user.user_metadata || {};
      setDisplayName(meta.full_name || meta.display_name || "");
      setHandle(String(meta.handle || user.email?.split("@")[0] || "").replace(/^@+/, ""));

      // Check if onboarding already completed
      const { data: profile } = await supabase
        .from("profiles")
        .select("handle,display_name,onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();

      if (!alive) return;

      if (profile?.onboarding_completed) {
        router.replace(`/u/${profile.handle || user.email?.split("@")[0]}`);
        return;
      }

      if (profile?.handle) setHandle(String(profile.handle).replace(/^@+/, ""));
      if (profile?.display_name) setDisplayName(profile.display_name);

      // Load communities for step 3
      const { data: communityRows } = await supabase
        .from("communities")
        .select("slug,name,description,member_count,is_official")
        .order("member_count", { ascending: false });

      if (alive) {
        setAllCommunities(communityRows || []);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [router, supabase]);

  // Compute community recommendations from taste answers
  const recommendedCommunities = useMemo(
    () => computeRecommendations(favoriteGenres, favoriteRegions, favoriteVibes, allCommunities),
    [favoriteGenres, favoriteRegions, favoriteVibes, allCommunities]
  );

  // Auto-select recommendations when entering step 3 (once)
  useEffect(() => {
    if (step === 3 && !communityAutoSelected && recommendedCommunities.length > 0) {
      setSelectedCommunities(recommendedCommunities.map((c) => c.slug));
      setCommunityAutoSelected(true);
    }
  }, [step, communityAutoSelected, recommendedCommunities]);

  // ── Avatar upload (with crop) ─────────────────────────────────────────────────

  function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // reset so same file can be re-selected
    e.target.value = "";

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      setAvatarError("Only JPEG, PNG, WEBP, or GIF allowed.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setAvatarError("Image must be under 10MB.");
      return;
    }

    setAvatarError("");
    // open cropper with an object URL for the raw file
    setCropSrc(URL.createObjectURL(file));
  }

  const handleCropConfirm = useCallback(async (blob) => {
    setCropSrc(null);
    if (!viewer?.id) return;
    try {
      setAvatarUploading(true);
      setAvatarError("");
      const path = `avatars/${viewer.id}.jpg`;

      const { error: uploadErr } = await supabase.storage
        .from("covers")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("covers").getPublicUrl(path);
      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) throw new Error("Could not get public URL.");

      setAvatarUrl(publicUrl + `?t=${Date.now()}`);
      setAvatarPath(path);
    } catch (err) {
      setAvatarError(err?.message || "Upload failed.");
    } finally {
      setAvatarUploading(false);
    }
  }, [viewer, supabase]);

  const handleCropCancel = useCallback(() => {
    setCropSrc(null);
  }, []);

  // ── Step navigation ──────────────────────────────────────────────────────────

  async function validateStep1() {
    const cleanHandle = normalizeHandle(handle);
    if (!cleanHandle || cleanHandle.length < 2) {
      setHandleError("Handle must be at least 2 characters.");
      return false;
    }
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .or(`handle.eq.@${cleanHandle},handle.eq.${cleanHandle}`)
        .neq("id", viewer.id)
        .maybeSingle();
      if (data?.id) {
        setHandleError("That handle is already taken.");
        return false;
      }
    } catch {}
    setHandleError("");
    return true;
  }

  function buildMusicDNA(genres, regions, vibes) {
    // Pick up to 2 genres, 1 region, 1 vibe — keep it tight like the examples
    const parts = [
      ...genres.slice(0, 2),
      ...regions.slice(0, 1),
      ...vibes.slice(0, 1),
    ];
    return parts.join(" • ");
  }

  async function goNext() {
    setError("");
    if (step === 1) {
      const valid = await validateStep1();
      if (!valid) return;
    }
    // Auto-fill Music DNA when leaving the taste step, don't overwrite if user typed something
    if (step === 2) {
      const generated = buildMusicDNA(favoriteGenres, favoriteRegions, favoriteVibes);
      if (generated && !musicDNA.trim()) {
        setMusicDNA(generated);
      }
    }
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setError("");
    setStep((s) => s - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── Final save ───────────────────────────────────────────────────────────────

  async function handleFinish() {
    if (!viewer?.id) return;
    setSaving(true);
    setError("");

    try {
      const cleanHandle = normalizeHandle(handle);
      if (!cleanHandle || cleanHandle.length < 2) throw new Error("Handle is required.");

      const communityNames = selectedCommunities.map((slug) => {
        const c = allCommunities.find((c) => c.slug === slug);
        return c?.name || slug;
      });

      const payload = {
        id: viewer.id,
        handle: cleanHandle,
        username: displayName.trim() || cleanHandle,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        music_dna: musicDNA.trim() || null,
        avatar_url: avatarUrl || null,
        avatar_path: avatarPath || null,
        favorite_artists: linesToArray(favoriteArtistsText).slice(0, 8),
        favorite_albums: linesToArray(favoriteAlbumsText).slice(0, 8),
        favorite_producers: linesToArray(favoriteProducersText).slice(0, 8),
        favorite_djs: linesToArray(favoriteDjsText).slice(0, 8),
        top_songs: parseTopSongs(topSongsText),
        communities: communityNames.slice(0, 8),
        favorite_genres: favoriteGenres,
        favorite_regions: favoriteRegions,
        favorite_vibes: favoriteVibes,
        music_values: musicValues,
        onboarding_completed: true,
      };

      const { error: saveErr } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id" });

      if (saveErr) throw saveErr;

      // Join selected communities
      if (selectedCommunities.length > 0) {
        const memberRows = selectedCommunities.map((slug) => ({
          user_id: viewer.id,
          community_slug: slug,
        }));
        await supabase
          .from("community_members")
          .insert(memberRows)
          .then(() => {}); // best-effort, ignore duplicate errors
      }

      router.replace(`/u/${cleanHandle}`);
    } catch (err) {
      setError(err?.message || "Could not save profile. Please try again.");
      setSaving(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/40">Loading…</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-10 pb-24">
      {cropSrc && (
        <AvatarCropper
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
      {/* Header */}
      <div className="text-center mb-10">
        <div
          className="text-xs uppercase tracking-widest mb-3 font-medium"
          style={{ color: "var(--gold)" }}
        >
          The Queue
        </div>
        <h1 className="text-4xl font-semibold text-white leading-tight">
          Build your music identity
        </h1>
        <p className="mt-2.5 text-white/50">
          Set up your profile so the culture knows who you are.
        </p>
      </div>

      <ProgressBar step={step} />

      {/* ── Step 1: Basic Profile ─────────────────────────────────────────────── */}
      {step === 1 && (
        <StepCard
          title="Your Profile"
          subtitle="Create the public-facing identity your listeners will see. Start with the basics — you can always edit later."
        >
          {/* Avatar */}
          <StepSection label="Profile Photo">
            <div className="flex items-center gap-5">
              <div
                className="w-20 h-20 rounded-full flex-shrink-0 overflow-hidden border-2 transition-all"
                style={{
                  borderColor: avatarUrl
                    ? "var(--gold)"
                    : "color-mix(in srgb, var(--line) 80%, transparent)",
                  background: "color-mix(in srgb, var(--midnight) 85%, transparent)",
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/25 text-xs text-center px-2">
                    No photo
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label
                  className="px-4 py-2 rounded-full border text-sm cursor-pointer text-center transition hover:border-white/40"
                  style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)", color: "white" }}
                >
                  {avatarUploading ? "Uploading…" : "Upload photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={avatarUploading}
                    onChange={handleAvatarUpload}
                  />
                </label>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => { setAvatarUrl(""); setAvatarPath(""); }}
                    className="text-xs text-white/35 hover:text-white/60 text-left"
                  >
                    Remove photo
                  </button>
                )}
                {avatarError && <div className="text-xs text-red-400">{avatarError}</div>}
              </div>
            </div>
          </StepSection>

          {/* Name + Handle */}
          <div className="grid gap-4 md:grid-cols-2">
            <StepSection label="Display Name">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your public name"
                className="w-full px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
                style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
              />
            </StepSection>

            <StepSection label="Handle" hint="Your profile URL: /u/yourhandle">
              <div
                className="flex items-center rounded-xl border px-4 py-3 transition-all"
                style={{
                  borderColor: handleError
                    ? "#ef4444"
                    : "color-mix(in srgb, var(--line) 80%, transparent)",
                }}
              >
                <span className="text-white/40 mr-1 select-none">@</span>
                <input
                  value={handle}
                  onChange={(e) => {
                    setHandle(e.target.value.replace(/^@+/, "").replace(/\s+/g, ""));
                    setHandleError("");
                  }}
                  placeholder="yourhandle"
                  className="w-full bg-transparent text-white outline-none"
                />
              </div>
              {handleError && <div className="mt-1.5 text-xs text-red-400">{handleError}</div>}
            </StepSection>
          </div>

          {/* Bio */}
          <StepSection label="Bio" hint="Tell people about your taste, your scene, or your vibe.">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Music is everything. Tell people what moves you."
              className="w-full min-h-[100px] px-4 py-3 rounded-xl bg-transparent border text-white outline-none resize-none"
              style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
            />
          </StepSection>

          {/* Music DNA */}
          <StepSection
            label="Music DNA"
            hint="Auto-filled from your taste in the next step — edit it however you like."
          >
            <input
              value={musicDNA}
              onChange={(e) => setMusicDNA(e.target.value)}
              placeholder="Country • Americana • storytelling • live shows"
              className="w-full px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
              style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
            />
            {musicDNA && (
              <button
                type="button"
                onClick={() => setMusicDNA(buildMusicDNA(favoriteGenres, favoriteRegions, favoriteVibes))}
                className="mt-2 text-xs transition"
                style={{ color: "var(--gold)" }}
              >
                ↺ Regenerate from taste
              </button>
            )}
          </StepSection>
        </StepCard>
      )}

      {/* ── Step 2: Taste Questions ──────────────────────────────────────────── */}
      {step === 2 && (
        <StepCard
          title="What's your sound?"
          subtitle="Tell us about your music taste so we can match you with the right communities and curators."
        >
          <StepSection label="Which genres are you most into?" hint="Pick all that apply.">
            <MultiSelectChips
              options={[
                // Urban / Black music
                "Hip Hop", "R&B", "Neo Soul", "Soul", "Funk", "Gospel",
                "Afrobeats", "Amapiano", "Dancehall", "Reggae", "Soca",
                // Electronic / Club
                "House", "Techno", "EDM", "Drum & Bass", "Dubstep",
                "Jungle", "Jersey Club", "Bounce", "Footwork", "Grime",
                // Rock / Alternative
                "Rock", "Alternative", "Indie", "Punk", "Metal", "Grunge",
                "Classic Rock", "Emo",
                // Pop
                "Pop", "Synth-Pop", "K-Pop", "J-Pop", "Latin Pop",
                // Country / Americana
                "Country", "Bluegrass", "Americana", "Folk",
                // Latin
                "Reggaeton", "Latin Trap", "Salsa", "Bachata", "Cumbia",
                // Jazz / Blues / Classical
                "Jazz", "Blues", "Classical", "Bossa Nova",
                // World
                "Afro-Cuban", "Highlife", "Fela", "Arabic Pop", "Indian Classical",
              ]}
              selected={favoriteGenres}
              onChange={setFavoriteGenres}
            />
          </StepSection>

          <StepSection label="Which scene or region do you connect with most?">
            <MultiSelectChips
              options={[
                // US regions
                "South", "Houston", "Atlanta", "Memphis", "New Orleans",
                "West Coast", "LA", "Bay Area", "East Coast", "NYC",
                "Midwest", "Chicago", "Detroit", "DMV", "Miami",
                // International
                "UK", "London", "Nigeria", "Ghana", "South Africa",
                "Jamaica", "Trinidad", "Brazil", "Puerto Rico",
                "Colombia", "Mexico", "France", "Japan", "Korea",
                "Global",
              ]}
              selected={favoriteRegions}
              onChange={setFavoriteRegions}
            />
          </StepSection>

          <StepSection label="What kind of vibe are you usually on?">
            <MultiSelectChips
              options={[
                "Late Night", "Chill", "Workout", "Road Trip", "Outside",
                "Cookout", "Brunch", "Club", "Turnt", "Date Night",
                "Soft Life", "Study Vibes", "Sunday Morning", "Heartbreak",
                "Hype", "Meditation", "Party", "HBCU Vibes", "Background Music",
              ]}
              selected={favoriteVibes}
              onChange={setFavoriteVibes}
            />
          </StepSection>

          <StepSection
            label="What matters most to you when you listen to music?"
            hint="Pick up to 3."
          >
            <MultiSelectChips
              options={[
                "Lyrics", "Production", "Energy", "Vibes", "Melody",
                "Storytelling", "Danceability", "Nostalgia", "Discovery",
                "Authenticity", "Live Performance", "Instrumentation",
              ]}
              selected={musicValues}
              onChange={setMusicValues}
              max={3}
            />
          </StepSection>
        </StepCard>
      )}

      {/* ── Step 3: Community Matching ───────────────────────────────────────── */}
      {step === 3 && (
        <StepCard
          title="Find your communities"
          subtitle="Based on your taste, here are some communities you might belong in. Join the ones that fit — you can always change this later."
        >
          {recommendedCommunities.length === 0 ? (
            <div
              className="rounded-xl p-6 text-center"
              style={{ background: "color-mix(in srgb, var(--line) 25%, transparent)" }}
            >
              <div className="text-white/50 text-sm leading-relaxed">
                No communities matched from your taste answers.{" "}
                <a
                  href="/communities"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 text-white/70"
                >
                  Browse all communities
                </a>{" "}
                or go back and add more genres and vibes.
              </div>
            </div>
          ) : (
            <div className="grid gap-2.5">
              {recommendedCommunities.map((community) => {
                const isSelected = selectedCommunities.includes(community.slug);
                return (
                  <div
                    key={community.slug}
                    className="rounded-xl border flex items-center justify-between px-4 py-3 transition-all"
                    style={{
                      borderColor: isSelected
                        ? "color-mix(in srgb, var(--gold) 55%, transparent)"
                        : "color-mix(in srgb, var(--line) 80%, transparent)",
                      background: isSelected
                        ? "color-mix(in srgb, var(--gold) 7%, transparent)"
                        : "transparent",
                    }}
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-white text-sm">{community.name}</div>
                      {community.description && (
                        <div className="text-xs text-white/45 mt-0.5 truncate max-w-xs">
                          {community.description}
                        </div>
                      )}
                      <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                        {(community.member_count || 0).toLocaleString()} member
                        {community.member_count !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCommunities((prev) =>
                          isSelected
                            ? prev.filter((s) => s !== community.slug)
                            : [...prev, community.slug]
                        )
                      }
                      className="ml-4 px-4 py-1.5 rounded-full text-sm font-medium flex-shrink-0 transition-all"
                      style={{
                        background: isSelected
                          ? "color-mix(in srgb, var(--gold) 20%, transparent)"
                          : "color-mix(in srgb, var(--line) 45%, transparent)",
                        color: isSelected ? "var(--gold)" : "var(--muted)",
                        border: `1px solid ${
                          isSelected
                            ? "color-mix(in srgb, var(--gold) 45%, transparent)"
                            : "color-mix(in srgb, var(--line) 80%, transparent)"
                        }`,
                      }}
                    >
                      {isSelected ? "Joined ✓" : "Join"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {selectedCommunities.length > 0 && (
            <div className="text-sm" style={{ color: "var(--muted)" }}>
              Joining{" "}
              <span style={{ color: "var(--gold)" }}>{selectedCommunities.length}</span>{" "}
              communit{selectedCommunities.length === 1 ? "y" : "ies"}
            </div>
          )}

          <a
            href="/communities"
            target="_blank"
            rel="noreferrer"
            className="text-xs transition"
            style={{ color: "var(--muted)" }}
          >
            Browse all communities →
          </a>
        </StepCard>
      )}

      {/* ── Step 4: Favorites ────────────────────────────────────────────────── */}
      {step === 4 && (
        <StepCard
          title="Make your profile yours"
          subtitle="Add the artists, albums, and songs that define your taste right now. This step is optional — you can fill it in later from Settings."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <StepSection label="Favorite Artists" hint="Up to 8 — one per line.">
              <textarea
                value={favoriteArtistsText}
                onChange={(e) => setFavoriteArtistsText(e.target.value)}
                placeholder={"Drake\nSZA\nFuture"}
                className="w-full min-h-[130px] px-4 py-3 rounded-xl bg-transparent border text-white outline-none resize-none"
                style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
              />
            </StepSection>

            <StepSection label="Favorite Albums" hint="Up to 8 — one per line.">
              <textarea
                value={favoriteAlbumsText}
                onChange={(e) => setFavoriteAlbumsText(e.target.value)}
                placeholder={"Take Care\nCtrl\nMiseducation of Lauryn Hill"}
                className="w-full min-h-[130px] px-4 py-3 rounded-xl bg-transparent border text-white outline-none resize-none"
                style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
              />
            </StepSection>

            <StepSection label="Favorite Producers" hint="Up to 8 — one per line.">
              <textarea
                value={favoriteProducersText}
                onChange={(e) => setFavoriteProducersText(e.target.value)}
                placeholder={"Metro Boomin\nPharrell\nJ Dilla"}
                className="w-full min-h-[130px] px-4 py-3 rounded-xl bg-transparent border text-white outline-none resize-none"
                style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
              />
            </StepSection>

            <StepSection label="Favorite DJs" hint="Up to 8 — one per line.">
              <textarea
                value={favoriteDjsText}
                onChange={(e) => setFavoriteDjsText(e.target.value)}
                placeholder={"DJ Screw\nKaytranada\nDJ Premier"}
                className="w-full min-h-[130px] px-4 py-3 rounded-xl bg-transparent border text-white outline-none resize-none"
                style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
              />
            </StepSection>
          </div>

          <StepSection
            label="Top Songs Right Now"
            hint="Up to 5 — format: Song Title - Artist"
          >
            <textarea
              value={topSongsText}
              onChange={(e) => setTopSongsText(e.target.value)}
              placeholder={"Nights - Frank Ocean\nBackseat Freestyle - Kendrick Lamar\nThe Worst - Jhené Aiko"}
              className="w-full min-h-[130px] px-4 py-3 rounded-xl bg-transparent border text-white outline-none resize-none"
              style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
            />
          </StepSection>
        </StepCard>
      )}

      {/* Error */}
      {error && (
        <div
          className="mt-4 rounded-xl px-4 py-3 text-sm text-red-300"
          style={{ background: "color-mix(in srgb, #ef4444 12%, transparent)", border: "1px solid color-mix(in srgb, #ef4444 30%, transparent)" }}
        >
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          type="button"
          onClick={goBack}
          className="px-5 py-2.5 rounded-full border text-sm transition hover:border-white/40"
          style={{
            borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
            color: step === 1 ? "transparent" : "rgba(255,255,255,0.7)",
            pointerEvents: step === 1 ? "none" : "auto",
          }}
        >
          ← Back
        </button>

        <div className="flex items-center gap-3">
          {step === 4 && (
            <button
              type="button"
              onClick={handleFinish}
              disabled={saving}
              className="px-5 py-2.5 rounded-full border text-sm transition"
              style={{
                borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                color: "var(--muted)",
                opacity: saving ? 0.5 : 1,
              }}
            >
              Skip & finish
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={goNext}
              className="px-7 py-2.5 rounded-full font-semibold text-sm transition-all hover:brightness-110"
              style={{ background: "var(--gold)", color: "#0b0f1a" }}
            >
              Continue →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={saving}
              className="px-7 py-2.5 rounded-full font-semibold text-sm transition-all hover:brightness-110"
              style={{ background: "var(--gold)", color: "#0b0f1a", opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "Saving…" : "Finish →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
