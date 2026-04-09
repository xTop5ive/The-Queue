"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";
import AvatarCropper from "@/components/AvatarCropper";

function capitalizeLines(value) {
  return String(value || "")
    .split("\n")
    .map((line) => {
      const trimmed = line.trimStart();
      if (!trimmed) return line;
      return line.slice(0, line.length - trimmed.length) + trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    })
    .join("\n");
}

function linesToArray(value) {
  return String(value || "")
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayToLines(value) {
  return Array.isArray(value) ? value.filter(Boolean).join("\n") : "";
}

function parseTopSongs(value) {
  return String(value || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(" - ");
      if (parts.length >= 2) {
        return {
          title: parts.slice(0, -1).join(" - ").trim(),
          artist: parts[parts.length - 1].trim(),
        };
      }
      const pipeParts = line.split(" | ");
      if (pipeParts.length >= 2) {
        return {
          title: pipeParts[0].trim(),
          artist: pipeParts.slice(1).join(" | ").trim(),
        };
      }
      return { title: line, artist: "" };
    })
    .slice(0, 5);
}

function topSongsToLines(value) {
  if (!Array.isArray(value)) return "";
  return value
    .map((song) => {
      if (!song) return "";
      const title = String(song?.title || "").trim();
      const artist = String(song?.artist || "").trim();
      return artist ? `${title} - ${artist}` : title;
    })
    .filter(Boolean)
    .join("\n");
}

function fmtHandle(value) {
  const raw = String(value || "").trim().replace(/^@+/, "");
  return raw ? `@${raw}` : "@user";
}

function Section({ title, help, children }) {
  return (
    <section
      className="rounded-2xl border p-5"
      style={{
        borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
        background: "color-mix(in srgb, var(--midnight) 80%, transparent)",
      }}
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {help ? <p className="text-sm text-white/60 mt-1">{help}</p> : null}
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-white">{label}</div>
      <div className="mt-2">{children}</div>
      {hint ? <div className="mt-2 text-xs text-white/50">{hint}</div> : null}
    </label>
  );
}

export default function ProfileSettingsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);

  const [viewer, setViewer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [role, setRole] = useState("");
  const [bio, setBio] = useState("");
  const [musicDNA, setMusicDNA] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [cropSrc, setCropSrc] = useState(null);
  const [favoriteArtistsText, setFavoriteArtistsText] = useState("");
  const [favoriteAlbumsText, setFavoriteAlbumsText] = useState("");
  const [favoriteProducersText, setFavoriteProducersText] = useState("");
  const [favoriteDjsText, setFavoriteDjsText] = useState("");
  const [communitiesText, setCommunitiesText] = useState("");
  const [topSongsText, setTopSongsText] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const user = authData?.user || null;
        if (!user) {
          router.replace("/login?next=/settings/profile");
          return;
        }

        if (!alive) return;
        setViewer(user);

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (profileErr) throw profileErr;

        const rawHandle =
          profile?.handle ||
          profile?.username ||
          user?.user_metadata?.handle ||
          user?.user_metadata?.username ||
          user?.email?.split("@")[0] ||
          "user";

        if (!alive) return;

        setDisplayName(profile?.display_name || profile?.username || user?.user_metadata?.display_name || "");
        setHandle(String(rawHandle || "").replace(/^@+/, ""));
        setRole(profile?.role || "");
        setBio(profile?.bio || "");
        setMusicDNA(profile?.music_dna || "");
        setAvatarUrl(profile?.avatar_url || user?.user_metadata?.avatar_url || "");
        setFavoriteArtistsText(arrayToLines(profile?.favorite_artists));
        setFavoriteAlbumsText(arrayToLines(profile?.favorite_albums));
        setFavoriteProducersText(arrayToLines(profile?.favorite_producers));
        setFavoriteDjsText(arrayToLines(profile?.favorite_djs));
        setCommunitiesText(arrayToLines(profile?.communities));
        setTopSongsText(topSongsToLines(profile?.top_songs));
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Could not load settings.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [router, supabase]);

  function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
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
    } catch (err) {
      setAvatarError(err?.message || "Upload failed.");
    } finally {
      setAvatarUploading(false);
    }
  }, [viewer, supabase]);

  const handleCropCancel = useCallback(() => setCropSrc(null), []);

  async function handleSave(e) {
    e.preventDefault();
    if (!viewer?.id) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const cleanHandle = String(handle || "").trim().replace(/^@+/, "").toLowerCase();
      if (!cleanHandle) throw new Error("Handle is required.");

      const payload = {
        id: viewer.id,
        handle: cleanHandle,
        username: displayName.trim() || cleanHandle,
        display_name: displayName.trim() || null,
        role: role || null,
        bio: bio.trim() || null,
        music_dna: musicDNA.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        favorite_artists: linesToArray(favoriteArtistsText).slice(0, 8),
        favorite_albums: linesToArray(favoriteAlbumsText).slice(0, 8),
        favorite_producers: linesToArray(favoriteProducersText).slice(0, 8),
        favorite_djs: linesToArray(favoriteDjsText).slice(0, 8),
        communities: linesToArray(communitiesText).slice(0, 8),
        top_songs: parseTopSongs(topSongsText),
      };

      const { error: saveErr } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (saveErr) throw saveErr;

      setSuccess("Profile updated.");
      router.push(`/u/${cleanHandle}`);
      router.refresh?.();
    } catch (err) {
      setError(err?.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  const previewHandle = fmtHandle(handle || viewer?.email?.split("@")[0] || "user");

  return (
    <div className="max-w-5xl mx-auto px-5 py-10">
      {cropSrc && (
        <AvatarCropper
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/settings" className="text-sm text-white/50 hover:text-white">
          ← Settings
        </Link>
        <span className="text-white/20">/</span>
        <span className="text-sm text-white">Edit Profile</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Settings › Profile
          </div>
          <h1 className="text-3xl font-semibold text-white mt-2">Edit Profile</h1>
          <p className="text-white/60 mt-2 max-w-2xl">
            Build your music identity on The Queue. Add your artists, albums, producers, DJs, communities, and the songs that define your taste right now.
          </p>
        </div>

        <div
          className="rounded-2xl border px-4 py-3 min-w-[220px]"
          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
        >
          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Preview
          </div>
          <div className="text-lg font-semibold mt-2">{previewHandle}</div>
          <div className="text-sm text-white/60 mt-1">{displayName.trim() || "Music curator"}</div>
        </div>
      </div>

      {loading ? (
        <div
          className="rounded-2xl border p-6 text-white/70"
          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
        >
          Loading settings…
        </div>
      ) : (
        <form onSubmit={handleSave} className="grid gap-6">
          <Section title="Profile Basics" help="These details shape how people see you on your public profile.">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Display Name">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your public name"
                  className="w-full px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
                  style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                />
              </Field>

              <Field label="Handle" hint="Used in your profile URL.">
                <div
                  className="flex items-center rounded-xl border px-4 py-3"
                  style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                >
                  <span className="text-white/50 mr-1">@</span>
                  <input
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.replace(/^@+/, "").replace(/\s+/g, ""))}
                    placeholder="handle"
                    className="w-full bg-transparent text-white outline-none"
                  />
                </div>
              </Field>
            </div>

            <Field label="I am a...">
              <div className="flex flex-wrap gap-2">
                {[
                  "Consumer", "Artist", "DJ", "Producer",
                  "A&R", "Manager", "Engineer", "Mixer",
                  "Videographer", "Photographer", "Blogger", "Journalist",
                  "Promoter", "Event Curator", "Label Exec", "Creative Director",
                ].map((r) => {
                  const active = role === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(active ? "" : r)}
                      className="px-4 py-2 rounded-full border text-sm transition"
                      style={{
                        borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                        background: active ? "color-mix(in srgb, var(--gold) 22%, transparent)" : "transparent",
                        color: "white",
                      }}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Bio">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell people about your taste, your scene, or your music personality."
                className="w-full min-h-[120px] px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
                style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
              />
            </Field>

            <Field label="Music DNA" hint="A one-line summary of your music identity.">
              <input
                value={musicDNA}
                onChange={(e) => setMusicDNA(e.target.value)}
                placeholder="Southern rap • late night R&B • Houston influence"
                className="w-full px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
                style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
              />
            </Field>

            <Field label="Profile Picture">
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-full border flex-shrink-0 overflow-hidden"
                  style={{
                    borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                    background: "color-mix(in srgb, var(--midnight) 85%, transparent)",
                  }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">No photo</div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    className="px-4 py-2 rounded-full border text-sm cursor-pointer text-center"
                    style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                  >
                    {avatarUploading ? "Uploading..." : "Upload photo"}
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
                      onClick={() => setAvatarUrl("")}
                      className="text-xs text-white/40 hover:text-white/70 text-left"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              </div>
              {avatarError ? <div className="mt-2 text-xs text-red-400">{avatarError}</div> : null}
            </Field>
          </Section>

          <Section title="Music Identity" help="Add one item per line for each section.">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Favorite Artists" hint="Up to 8. One per line.">
                <textarea
                  value={favoriteArtistsText}
                  onChange={(e) => setFavoriteArtistsText(e.target.value)}
                  onBlur={(e) => setFavoriteArtistsText(capitalizeLines(e.target.value))}
                  placeholder={"Drake\nSZA\nFuture"}
                  className="w-full min-h-[160px] px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
                  style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                />
              </Field>

              <Field label="Favorite Albums" hint="Up to 8. One per line.">
                <textarea
                  value={favoriteAlbumsText}
                  onChange={(e) => setFavoriteAlbumsText(e.target.value)}
                  onBlur={(e) => setFavoriteAlbumsText(capitalizeLines(e.target.value))}
                  placeholder={"Take Care\nCtrl\nThe Miseducation of Lauryn Hill"}
                  className="w-full min-h-[160px] px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
                  style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                />
              </Field>

              <Field label="Favorite Producers" hint="Up to 8. One per line.">
                <textarea
                  value={favoriteProducersText}
                  onChange={(e) => setFavoriteProducersText(e.target.value)}
                  onBlur={(e) => setFavoriteProducersText(capitalizeLines(e.target.value))}
                  placeholder={"Metro Boomin\nPharrell\nKanye West"}
                  className="w-full min-h-[160px] px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
                  style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                />
              </Field>

              <Field label="Favorite DJs" hint="Up to 8. One per line.">
                <textarea
                  value={favoriteDjsText}
                  onChange={(e) => setFavoriteDjsText(e.target.value)}
                  onBlur={(e) => setFavoriteDjsText(capitalizeLines(e.target.value))}
                  placeholder={"DJ Screw\nKaytranada\nDJ Jazzy Jeff"}
                  className="w-full min-h-[160px] px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
                  style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                />
              </Field>
            </div>
          </Section>

          <Section title="Top Songs Right Now" help="Add up to 5 songs. Use the format: Song Title - Artist.">
            <Field label="Songs" hint="One per line. Example: Nights - Frank Ocean">
              <textarea
                value={topSongsText}
                onChange={(e) => setTopSongsText(e.target.value)}
                onBlur={(e) => setTopSongsText(capitalizeLines(e.target.value))}
                placeholder={"Nights - Frank Ocean\nBackseat Freestyle - Kendrick Lamar\nThe Worst - Jhené Aiko"}
                className="w-full min-h-[180px] px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
                style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
              />
            </Field>
          </Section>

          <Section title="Communities" help="These will later connect to social/community pages.">
            <Field label="Communities" hint="One per line. Example: Hip Hop, South, Houston, Neo Soul.">
              <textarea
                value={communitiesText}
                onChange={(e) => setCommunitiesText(e.target.value)}
                onBlur={(e) => setCommunitiesText(capitalizeLines(e.target.value))}
                placeholder={"Hip Hop\nSouth\nHouston\nR&B"}
                className="w-full min-h-[140px] px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
                style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
              />
            </Field>
          </Section>

          {error ? <div className="text-red-300 text-sm">{error}</div> : null}
          {success ? <div className="text-green-300 text-sm">{success}</div> : null}

          <div className="flex flex-wrap items-center gap-3 pb-8">
            <button type="submit" disabled={saving} className="inBtn">
              {saving ? "Saving..." : "Save Profile"}
            </button>

            <Link
              href={viewer ? `/u/${String(handle || viewer?.email?.split("@")[0] || "user").replace(/^@+/, "")}` : "/"}
              className="px-4 py-2 rounded-full border text-sm"
              style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
            >
              View Profile
            </Link>

            <Link
              href="/settings"
              className="px-4 py-2 rounded-full border text-sm"
              style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
            >
              Back to Settings
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
