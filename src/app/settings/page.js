"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";

function DeleteAccountModal({ onConfirm, onCancel, deleting, error }) {
  const [typed, setTyped] = useState("");
  const confirmed = typed === "DELETE";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="rounded-2xl border w-full max-w-md"
        style={{
          borderColor: "color-mix(in srgb, #ef4444 35%, transparent)",
          background: "var(--midnight)",
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 border-b"
          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
        >
          <div className="font-semibold text-white text-lg">Delete account</div>
          <div className="text-sm text-white/55 mt-1">
            This is permanent and cannot be undone.
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 grid gap-4">
          <p className="text-sm text-white/70 leading-relaxed">
            Deleting your account will permanently remove your profile, playlists,
            community memberships, and all associated data. There is no way to recover this.
          </p>
          <div>
            <label className="text-sm font-medium text-white/80">
              Type <span className="font-bold text-red-400">DELETE</span> to confirm
            </label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="DELETE"
              autoFocus
              className="mt-2 w-full px-4 py-3 rounded-xl bg-transparent border text-white outline-none"
              style={{
                borderColor: confirmed
                  ? "color-mix(in srgb, #ef4444 60%, transparent)"
                  : "color-mix(in srgb, var(--line) 80%, transparent)",
              }}
            />
          </div>
          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm text-red-300"
              style={{ background: "color-mix(in srgb, #ef4444 12%, transparent)", border: "1px solid color-mix(in srgb, #ef4444 30%, transparent)" }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div
          className="px-6 py-4 flex items-center justify-end gap-3 border-t"
          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="px-5 py-2 rounded-full border text-sm transition hover:border-white/40"
            style={{
              borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!confirmed || deleting}
            className="px-6 py-2 rounded-full font-semibold text-sm transition"
            style={{
              background: confirmed ? "#ef4444" : "color-mix(in srgb, #ef4444 30%, transparent)",
              color: confirmed ? "white" : "rgba(255,255,255,0.35)",
              cursor: confirmed && !deleting ? "pointer" : "not-allowed",
              opacity: deleting ? 0.6 : 1,
            }}
          >
            {deleting ? "Deleting…" : "Delete my account"}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("No active session.");

      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      console.log("[delete account]", res.status, json);
      if (!res.ok) throw new Error(json?.error || "Deletion failed.");

      await supabase.auth.signOut();
      router.replace("/");
    } catch (err) {
      setDeleteError(err?.message || "Could not delete account. Try again.");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-10 text-white/60">Loading…</div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-10">
      {showDeleteModal && (
        <DeleteAccountModal
          onConfirm={handleDeleteAccount}
          onCancel={() => { setShowDeleteModal(false); setDeleteError(""); }}
          deleting={deleting}
          error={deleteError}
        />
      )}
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
                className="rounded-2xl border p-5"
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
                    style={{ borderColor: "color-mix(in srgb, var(--gold) 40%, transparent)", color: "color-mix(in srgb, var(--gold) 80%, white)" }}
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

      {/* Danger zone */}
      <div
        className="mt-4 rounded-2xl border p-5"
        style={{ borderColor: "color-mix(in srgb, #ef4444 30%, transparent)" }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-red-400">Delete account</div>
            <div className="text-sm text-white/50 mt-0.5">
              Permanently delete your profile, playlists, and all data.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="flex-shrink-0 px-4 py-2 rounded-full border text-sm font-medium transition hover:bg-red-500/10"
            style={{
              borderColor: "color-mix(in srgb, #ef4444 50%, transparent)",
              color: "#f87171",
            }}
          >
            Delete account
          </button>
        </div>
        {deleteError && (
          <div className="mt-3 text-sm text-red-400">{deleteError}</div>
        )}
      </div>
    </div>
  );
}
