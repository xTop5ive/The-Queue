"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";

const SETTINGS_SECTIONS = [
  {
    key: "profile",
    label: "Profile",
    description: "Edit your display name, handle, bio, role, avatar, and music identity.",
    href: "/settings/profile",
    icon: "👤",
  },
  {
    key: "notifications",
    label: "Notifications",
    description: "Control how and when The Queue gets in touch with you.",
    href: "/settings/notifications",
    icon: "🔔",
    comingSoon: true,
  },
  {
    key: "privacy",
    label: "Privacy & Visibility",
    description: "Manage who can see your playlists, profile, and activity.",
    href: "/settings/privacy",
    icon: "🔒",
    comingSoon: true,
  },
  {
    key: "account",
    label: "Account",
    description: "Update your email, password, and connected accounts.",
    href: "/settings/account",
    icon: "⚙️",
    comingSoon: true,
  },
];

export default function SettingsHubPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) {
        router.replace("/login?next=/settings");
        return;
      }
      setUser(data.user);
      setLoading(false);
    });
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-10 text-white/60">Loading…</div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-10">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
          The Queue
        </div>
        <h1 className="text-3xl font-semibold text-white mt-2">Settings</h1>
        <p className="text-white/60 mt-2">
          Manage your profile, preferences, and account.
        </p>
      </div>

      <div className="grid gap-3">
        {SETTINGS_SECTIONS.map((section) => (
          <div key={section.key}>
            {section.comingSoon ? (
              <div
                className="rounded-2xl border p-5 opacity-40 cursor-not-allowed"
                style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{section.icon}</span>
                    <div>
                      <div className="font-semibold text-white">{section.label}</div>
                      <div className="text-sm text-white/60 mt-0.5">{section.description}</div>
                    </div>
                  </div>
                  <span
                    className="text-xs px-2.5 py-1 rounded-full border flex-shrink-0"
                    style={{ borderColor: "color-mix(in srgb, var(--line) 60%, transparent)", color: "var(--muted)" }}
                  >
                    Coming soon
                  </span>
                </div>
              </div>
            ) : (
              <Link
                href={section.href}
                className="rounded-2xl border p-5 flex items-center justify-between gap-4 hover:bg-white/5 transition block"
                style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{section.icon}</span>
                  <div>
                    <div className="font-semibold text-white">{section.label}</div>
                    <div className="text-sm text-white/60 mt-0.5">{section.description}</div>
                  </div>
                </div>
                <span className="text-white/40 text-lg flex-shrink-0">›</span>
              </Link>
            )}
          </div>
        ))}
      </div>

      <div
        className="mt-8 rounded-2xl border p-5"
        style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
      >
        <div className="text-sm text-white/50">Signed in as</div>
        <div className="text-white font-medium mt-1">{user?.email}</div>
      </div>
    </div>
  );
}
