// Top-level: Next.js client component
"use client";

// Imports: Next.js, React, Supabase
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// Supabase client helper
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}

// Helper: value to string
function toStr(v) {
  if (!v) return "";
  return Array.isArray(v) ? v[0] || "" : String(v);
}

// Helper: normalize tag
function normTag(t) {
  return String(t || "").trim().toLowerCase();
}

// Helper: format user handle
function fmtHandle(h) {
  const v = String(h || "").trim();
  if (!v) return "@user";
  return v.startsWith("@") ? v : `@${v}`;
}

// Helper: parse to number, or undefined
function toNum(v) {
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

// Helper: build explore page URL with filters
function buildExploreHref(opts) {
  const p = new URLSearchParams();
  const q = (opts.q || "").trim();
  const tags = (opts.tags || []).map(normTag).filter(Boolean);
  const sort = opts.sort === "top" ? "top" : "new";
  if (q) p.set("q", q);
  if (tags.length) p.set("tags", Array.from(new Set(tags)).join(","));
  p.set("sort", sort);
  // Optional DJ-style params (only included if provided)
  if (typeof opts.bpmMin === "number") p.set("bpmMin", String(opts.bpmMin));
  if (typeof opts.bpmMax === "number") p.set("bpmMax", String(opts.bpmMax));
  if (typeof opts.energyMin === "number") p.set("energyMin", String(opts.energyMin));
  if (opts.clean === "1" || opts.clean === "0") p.set("clean", opts.clean);
  if (opts.key) p.set("key", String(opts.key));
  const qs = p.toString();
  return qs ? `/explore?${qs}` : "/explore";
}

// Main genre tags for quick filtering
const QUICK_TAGS = ["r&b", "hip-hop", "pop", "afrobeats", "edm", "rock", "country", "latin"];

export default function ExplorePage() {
  // Next.js router and URL params
  const router = useRouter();
  const sp = useSearchParams();
  const supabase = useMemo(() => getSupabase(), []);

  // URL params for search and filters
  const q = (sp?.get("q") || "").trim();
  const sort = sp?.get("sort") === "top" ? "top" : "new";
  const tagsParam = sp?.get("tags") || "";
  const tagNames = tagsParam ? tagsParam.split(",").map(normTag).filter(Boolean) : [];
  const selected = useMemo(() => new Set(tagNames), [tagsParam]);

  // DJ-style filter params from URL
  const bpmMin = sp?.get("bpmMin");
  const bpmMax = sp?.get("bpmMax");
  const energyMin = sp?.get("energyMin");
  const clean = sp?.get("clean"); // "1" or "0"
  const key = sp?.get("key"); // string

  // Local state for UI controls
  const [searchText, setSearchText] = useState(q);
  const [bpmMinText, setBpmMinText] = useState(bpmMin ?? "");
  const [bpmMaxText, setBpmMaxText] = useState(bpmMax ?? "");
  const [keyText, setKeyText] = useState(key ?? "");
  const [cleanOnly, setCleanOnly] = useState(clean === "1");
  const [energyMinVal, setEnergyMinVal] = useState(energyMin ? Number(energyMin) : 0);

  // Autocomplete (predictions) for the Explore search bar
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestItems, setSuggestItems] = useState([]); // { type: 'playlist'|'creator', label, value }
  const [suggestActive, setSuggestActive] = useState(-1);
  const searchWrapRef = useRef(null);

  // Playlist data and UI state
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [handlesByUserId, setHandlesByUserId] = useState({});
  const [error, setError] = useState("");
  const [djWarning, setDjWarning] = useState("");

  // Sync local state with URL params on change
  useEffect(() => {
    setSearchText(q);
    setBpmMinText(bpmMin ?? "");
    setBpmMaxText(bpmMax ?? "");
    setKeyText(key ?? "");
    setCleanOnly(clean === "1");
    setEnergyMinVal(energyMin ? Number(energyMin) : 0);
  }, [q, bpmMin, bpmMax, key, clean, energyMin]);

  // Close autocomplete when clicking outside
  useEffect(() => {
    function onDocDown(e) {
      if (!searchWrapRef.current) return;
      if (!searchWrapRef.current.contains(e.target)) {
        setSuggestOpen(false);
        setSuggestActive(-1);
      }
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  // Fetch playlists and handles when filters change
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      setDjWarning("");
      try {
        // Base query for public playlists
        let query = supabase.from("playlists").select("*").eq("is_public", true);
        // Search:
        // - If query starts with @, treat it as a creator handle search (profiles -> user ids)
        // - Otherwise search title/description
        if (q) {
          const term = q.trim();
          if (term.startsWith("@")) {
            const raw = term.slice(1).replaceAll(",", " ");
            try {
              const { data: profs } = await supabase
                .from("profiles")
                .select("id,handle,username")
                .or(`handle.ilike.%${raw}%,username.ilike.%${raw}%`)
                .limit(50);
              const ids = Array.from(new Set((profs || []).map((p) => p.id).filter(Boolean)));
              if (ids.length) query = query.in("user_id", ids);
              else query = query.eq("user_id", "00000000-0000-0000-0000-000000000000");
            } catch {
              // If profiles isn't available, fall back to title/description search
              const safe = raw;
              query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
            }
          } else {
            const safe = term.replaceAll(",", " ");
            query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
          }
        }
        // Tags: require ALL selected tags
        if (tagNames.length) {
          query = query.contains("tags", tagNames);
        }
        // DJ-style filters (optional)
        const applyDjFilters = (q2) => {
          const minBpm = toNum(bpmMin);
          const maxBpm = toNum(bpmMax);
          const minEnergy = toNum(energyMin);
          if (typeof minBpm === "number") q2 = q2.gte("avg_bpm", minBpm);
          if (typeof maxBpm === "number") q2 = q2.lte("avg_bpm", maxBpm);
          if (typeof minEnergy === "number") q2 = q2.gte("energy", minEnergy);
          if (clean === "1") q2 = q2.eq("clean", true);
          if (clean === "0") q2 = q2.eq("clean", false);
          if (key) q2 = q2.contains("keys", [String(key)]);
          return q2;
        };
        query = applyDjFilters(query);
        // Sort by likes or newest
        if (sort === "top") query = query.order("likes_count", { ascending: false });
        else query = query.order("created_at", { ascending: false });
        let data;
        let qErr;
        const res1 = await query.limit(24);
        data = res1.data;
        qErr = res1.error;
        // If DJ columns aren't in the schema yet, retry without DJ filters.
        if (qErr && /column|schema cache/i.test(qErr.message || "")) {
          let fallback = supabase.from("playlists").select("*").eq("is_public", true);
          if (q) {
            const term = q.trim();
            if (term.startsWith("@")) {
              const raw = term.slice(1).replaceAll(",", " ");
              try {
                const { data: profs } = await supabase
                  .from("profiles")
                  .select("id,handle,username")
                  .or(`handle.ilike.%${raw}%,username.ilike.%${raw}%`)
                  .limit(50);
                const ids = Array.from(new Set((profs || []).map((p) => p.id).filter(Boolean)));
                if (ids.length) fallback = fallback.in("user_id", ids);
                else fallback = fallback.eq("user_id", "00000000-0000-0000-0000-000000000000");
              } catch {
                const safe = raw;
                fallback = fallback.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
              }
            } else {
              const safe = term.replaceAll(",", " ");
              fallback = fallback.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
            }
          }
          if (tagNames.length) {
            fallback = fallback.contains("tags", tagNames);
          }
          if (sort === "top") fallback = fallback.order("likes_count", { ascending: false });
          else fallback = fallback.order("created_at", { ascending: false });
          const res2 = await fallback.limit(24);
          data = res2.data;
          qErr = res2.error;
          // Only show warning if the fallback succeeds.
          if (!qErr && (bpmMin || bpmMax || energyMin || clean || key)) {
            setDjWarning(
              "DJ filters are on, but your database doesn’t have the DJ columns yet (avg_bpm, energy, clean, keys). Add them in Supabase to make these filters work."
            );
          }
        }
        if (qErr) throw qErr;
        const mapped = (data || []).map((r) => ({
          ...r,
          coverUrl: r.cover_url || "/placeholder-cover.png",
          createdAt: r.created_at,
          likes: r.likes_count ?? 0,
          userId: r.user_id,
          tags: r.tags || [],
          avgBpm: r.avg_bpm ?? r.avgBpm,
          energy: r.energy ?? r.energy_level,
          clean: typeof r.clean === "boolean" ? r.clean : undefined,
          keys: r.keys ?? r.camelot_keys,
        }));
        if (!alive) return;
        setRows(mapped);
        // Load handles from profiles (best-effort)
        const userIds = Array.from(new Set(mapped.map((x) => x.userId).filter(Boolean)));
        if (!userIds.length) {
          setHandlesByUserId({});
          return;
        }
        try {
          const { data: profs, error: pErr } = await supabase
            .from("profiles")
            .select("id, handle, username")
            .in("id", userIds);
          if (pErr) throw pErr;
          const map = {};
          for (const p of profs || []) {
            const raw = p?.handle || p?.username || "";
            map[p.id] = fmtHandle(raw);
          }
          if (alive) setHandlesByUserId(map);
        } catch {
          if (alive) setHandlesByUserId({});
        }
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Failed to load playlists.");
        setRows([]);
        setHandlesByUserId({});
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  // Add all filter dependencies so fetch updates on clear/filter
  }, [supabase, q, tagsParam, sort, bpmMin, bpmMax, energyMin, clean, key]);

  // Autocomplete suggestions (debounced)
  useEffect(() => {
    let alive = true;
    const term = (searchText || "").trim();

    // If empty, clear suggestions
    if (!term) {
      setSuggestItems([]);
      setSuggestOpen(false);
      setSuggestActive(-1);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setSuggestLoading(true);

        // If user starts with @, prioritize creators
        const raw = term.startsWith("@") ? term.slice(1) : term;
        const safe = raw.replaceAll(",", " ");

        // Playlists (title match)
        const plRes = await supabase
          .from("playlists")
          .select("id,title,user_id")
          .eq("is_public", true)
          .ilike("title", `%${safe}%`)
          .order("created_at", { ascending: false })
          .limit(6);

        // Creator handles from profiles (best effort)
        let creators = [];
        try {
          const prRes = await supabase
            .from("profiles")
            .select("id,handle,username")
            .or(`handle.ilike.%${safe}%,username.ilike.%${safe}%`)
            .limit(6);

          creators = (prRes.data || [])
            .map((p) => {
              const h = (p.handle || p.username || "").trim();
              if (!h) return null;
              const hh = h.startsWith("@") ? h : `@${h}`;
              return { type: "creator", label: hh, value: hh };
            })
            .filter(Boolean);
        } catch {
          creators = [];
        }

        const playlists = (plRes.data || []).map((r) => ({
          type: "playlist",
          label: r.title,
          value: r.title,
        }));

        // If typing @, put creators first
        const combined = term.startsWith("@")
          ? [...creators, ...playlists]
          : [...playlists, ...creators];

        // De-dupe by label
        const seen = new Set();
        const deduped = [];
        for (const it of combined) {
          const k = `${it.type}:${it.label}`;
          if (seen.has(k)) continue;
          seen.add(k);
          deduped.push(it);
          if (deduped.length >= 8) break;
        }

        if (!alive) return;
        setSuggestItems(deduped);
        setSuggestOpen(true);
        setSuggestActive(-1);
      } catch {
        if (!alive) return;
        setSuggestItems([]);
        setSuggestOpen(false);
        setSuggestActive(-1);
      } finally {
        if (alive) setSuggestLoading(false);
      }
    }, 220);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [supabase, searchText]);

  function applySuggestion(item) {
    if (!item) return;
    setSearchText(item.value);
    setSuggestOpen(false);
    setSuggestActive(-1);

    // If it's a creator, keep the @ in the search box so the UI hint matches
    // and let the user hit Search (or press Enter on the input).
  }

  // Handler: submit search and filters
  function submitSearch(e) {
    e.preventDefault();
    const href = buildExploreHref({
      q: searchText,
      tags: tagNames,
      sort,
      bpmMin: toNum(bpmMinText),
      bpmMax: toNum(bpmMaxText),
      energyMin: typeof energyMinVal === "number" ? energyMinVal : undefined,
      clean: cleanOnly ? "1" : undefined,
      key: keyText ? String(keyText) : undefined,
    });
    router.push(href);
  }

  // Handler: clear all filters and reset UI state
  function clearAll() {
    setSearchText("");
    setBpmMinText("");
    setBpmMaxText("");
    setKeyText("");
    setCleanOnly(false);
    setEnergyMinVal(0);
    // Keep current sort, but remove all other params
    router.push(buildExploreHref({ sort }));
  }

  // Links for sort pills
  const hrefNewest = buildExploreHref({ q, tags: tagNames, sort: "new" });
  const hrefTop = buildExploreHref({ q, tags: tagNames, sort: "top" });

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">
      {/* Header section */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
          <span className="w-2 h-2 rounded-full" style={{ background: "var(--gold)" }} />
          The Queue • Explore
        </div>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight">Explore</h1>
        <p className="text-white/60 mt-2 max-w-2xl">
          Search by vibe, tags, or creator. Tap tags to filter. Switch to “Most liked” to see what’s trending.
        </p>
      </div>

      {/* Search and filter bar */}
      <div className="card p-5 mb-7">
        <form onSubmit={submitSearch}>
          {/* Row 1: Search + Sort pills + Submit */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div ref={searchWrapRef} className="relative w-full lg:flex-1">
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onFocus={() => {
                  const t = (searchText || "").trim();
                  if (t && suggestItems.length) setSuggestOpen(true);
                }}
                onKeyDown={(e) => {
                  if (!suggestOpen || !suggestItems.length) return;

                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSuggestActive((i) => {
                      const next = Math.min((i < 0 ? -1 : i) + 1, suggestItems.length - 1);
                      return next;
                    });
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSuggestActive((i) => {
                      const next = Math.max(i - 1, 0);
                      return next;
                    });
                  } else if (e.key === "Enter") {
                    if (suggestActive >= 0 && suggestActive < suggestItems.length) {
                      e.preventDefault();
                      applySuggestion(suggestItems[suggestActive]);
                    }
                  } else if (e.key === "Escape") {
                    setSuggestOpen(false);
                    setSuggestActive(-1);
                  }
                }}
                placeholder="Search title, description, or @handle"
                className="w-full px-4 py-3 rounded-full border outline-none"
                style={{
                  background: "color-mix(in srgb, var(--midnight) 85%, transparent)",
                  borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                  color: "var(--fog)",
                }}
                aria-label="Search playlists"
                autoComplete="off"
              />

              {/* Predictions dropdown */}
              {suggestOpen && (suggestLoading || suggestItems.length) ? (
                <div
                  className="absolute z-50 mt-2 w-full rounded-2xl border overflow-hidden"
                  style={{
                    background: "color-mix(in srgb, var(--midnight) 96%, black)",
                    borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                    boxShadow: "0 18px 40px rgba(0,0,0,0.55)",
                  }}
                  role="listbox"
                  aria-label="Search suggestions"
                >
                  {suggestLoading ? (
                    <div className="px-4 py-3 text-sm text-white/70">Searching…</div>
                  ) : null}

                  {!suggestLoading && !suggestItems.length ? (
                    <div className="px-4 py-3 text-sm text-white/60">No suggestions.</div>
                  ) : null}

                  {!suggestLoading && suggestItems.length ? (
                    <div>
                      {suggestItems.map((it, idx) => (
                        <button
                          key={`${it.type}-${it.label}-${idx}`}
                          type="button"
                          onClick={() => applySuggestion(it)}
                          onMouseEnter={() => setSuggestActive(idx)}
                          className="w-full text-left px-4 py-3 text-sm"
                          style={{
                            background:
                              idx === suggestActive
                                ? "color-mix(in srgb, white 10%, transparent)"
                                : "transparent",
                            borderTop:
                              idx === 0
                                ? "none"
                                : "1px solid color-mix(in srgb, var(--line) 55%, transparent)",
                            color: "var(--fog)",
                          }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="truncate">
                              {it.type === "creator" ? (
                                <span className="text-white/90">{it.label}</span>
                              ) : (
                                <span className="text-white/90">{it.label}</span>
                              )}
                            </div>
                            <div className="text-[11px] text-white/55 flex-shrink-0">
                              {it.type === "creator" ? "Creator" : "Playlist"}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={hrefNewest}
                className="px-4 py-2 rounded-full border text-sm"
                style={{
                  background:
                    sort === "new"
                      ? "color-mix(in srgb, var(--purple) 22%, transparent)"
                      : "transparent",
                  borderColor:
                    sort === "new"
                      ? "color-mix(in srgb, var(--purple) 40%, transparent)"
                      : "color-mix(in srgb, var(--line) 80%, transparent)",
                  color: "var(--fog)",
                }}
              >
                Newest
              </Link>

              <Link
                href={hrefTop}
                className="px-4 py-2 rounded-full border text-sm"
                style={{
                  background:
                    sort === "top"
                      ? "color-mix(in srgb, var(--purple) 22%, transparent)"
                      : "transparent",
                  borderColor:
                    sort === "top"
                      ? "color-mix(in srgb, var(--purple) 40%, transparent)"
                      : "color-mix(in srgb, var(--line) 80%, transparent)",
                  color: "var(--fog)",
                }}
              >
                Most liked
              </Link>

              <button
                type="submit"
                className="px-5 py-2 rounded-full text-sm font-semibold"
                style={{
                  background: "color-mix(in srgb, var(--purple) 85%, black)",
                  color: "white",
                  border: "1px solid color-mix(in srgb, var(--purple) 50%, transparent)",
                }}
              >
                Search
              </button>
            </div>
          </div>

          {/* Row 2: DJ filters bar */}
          <div
            className="mt-4 rounded-2xl border p-4"
            style={{
              borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
              background: "color-mix(in srgb, var(--midnight) 80%, transparent)",
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-3">
                <div className="text-[11px] text-white/60 mb-1">BPM range</div>
                <div className="flex gap-2">
                  <input
                    value={bpmMinText}
                    onChange={(e) => setBpmMinText(e.target.value)}
                    inputMode="numeric"
                    placeholder="Min"
                    className="w-full px-3 py-2 rounded-full border outline-none"
                    style={{
                      background: "transparent",
                      borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                      color: "var(--fog)",
                    }}
                    aria-label="Minimum BPM"
                  />
                  <input
                    value={bpmMaxText}
                    onChange={(e) => setBpmMaxText(e.target.value)}
                    inputMode="numeric"
                    placeholder="Max"
                    className="w-full px-3 py-2 rounded-full border outline-none"
                    style={{
                      background: "transparent",
                      borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                      color: "var(--fog)",
                    }}
                    aria-label="Maximum BPM"
                  />
                </div>
              </div>

              <div className="md:col-span-3">
                <div className="text-[11px] text-white/60 mb-1">Key (Camelot)</div>
                <select
                  value={keyText}
                  onChange={(e) => setKeyText(e.target.value)}
                  className="w-full px-3 py-2 rounded-full border outline-none"
                  style={{
                    background: "transparent",
                    borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                    color: "var(--fog)",
                  }}
                  aria-label="Key"
                >
                  <option value="">Any</option>
                  {[
                    "1A",
                    "2A",
                    "3A",
                    "4A",
                    "5A",
                    "6A",
                    "7A",
                    "8A",
                    "9A",
                    "10A",
                    "11A",
                    "12A",
                    "1B",
                    "2B",
                    "3B",
                    "4B",
                    "5B",
                    "6B",
                    "7B",
                    "8B",
                    "9B",
                    "10B",
                    "11B",
                    "12B",
                  ].map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <div className="text-[11px] text-white/60 mb-1">Version</div>
                <label
                  className="flex items-center gap-2 px-4 py-2 rounded-full border"
                  style={{
                    borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                    background: "transparent",
                  }}
                >
                  <input type="checkbox" checked={cleanOnly} onChange={(e) => setCleanOnly(e.target.checked)} />
                  <span className="text-sm text-white/80">Clean only</span>
                </label>
              </div>

              <div className="md:col-span-3">
                <div className="text-[11px] text-white/60 mb-1">Minimum energy</div>
                <div
                  className="px-4 py-2 rounded-full border"
                  style={{
                    borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                    background: "transparent",
                  }}
                >
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={energyMinVal}
                    onChange={(e) => setEnergyMinVal(Number(e.target.value))}
                    className="w-full"
                    aria-label="Minimum energy"
                  />
                  <div className="mt-1 text-[11px] text-white/60">{energyMinVal} / 10</div>
                </div>
              </div>
            </div>

            {/* Show DJ warning if needed */}
            {djWarning ? <div className="mt-3 text-xs text-yellow-200/90">{djWarning}</div> : null}

            {/* Quick tags (8 main genres) and Clear button */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {QUICK_TAGS.map((t) => {
                const isOn = selected.has(t);
                const next = isOn ? tagNames.filter((x) => x !== t) : Array.from(new Set([...tagNames, t]));
                const href = buildExploreHref({ q, tags: next, sort });
                return (
                  <Link
                    key={t}
                    href={href}
                    className="px-3 py-1 rounded-full border text-sm"
                    style={{
                      background: isOn
                        ? "color-mix(in srgb, var(--purple) 18%, transparent)"
                        : "color-mix(in srgb, white 8%, transparent)",
                      borderColor: isOn
                        ? "color-mix(in srgb, var(--purple) 40%, transparent)"
                        : "color-mix(in srgb, var(--line) 80%, transparent)",
                      color: "var(--fog)",
                    }}
                  >
                    #{t}
                  </Link>
                );
              })}
              {(q || tagNames.length || bpmMin || bpmMax || energyMin || clean || key) && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-sm underline"
                  style={{ color: "color-mix(in srgb, var(--fog) 70%, transparent)" }}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Active filters display */}
            {tagNames.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-white/60">Active:</span>
                {Array.from(new Set(tagNames)).map((t) => {
                  const remaining = tagNames.filter((x) => x !== t);
                  const href = buildExploreHref({ q, tags: remaining, sort });
                  return (
                    <Link
                      key={t}
                      href={href}
                      className="rounded-full px-3 py-1 border"
                      style={{
                        background: "color-mix(in srgb, white 8%, transparent)",
                        borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                        color: "var(--fog)",
                      }}
                    >
                      #{t} ✕
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Section header for results */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Public playlists</h2>
          <p className="text-white/60 text-sm mt-1">
            {loading ? "Loading…" : `Showing ${rows.length} result${rows.length === 1 ? "" : "s"}`}
          </p>
        </div>

        <Link
          href="/new"
          className="px-4 py-2 rounded-full border text-sm font-semibold inline-flex items-center gap-2"
          style={{
            background: "color-mix(in srgb, var(--purple) 85%, black)",
            color: "white",
            borderColor: "color-mix(in srgb, var(--purple) 50%, transparent)",
          }}
        >
          <span aria-hidden>+</span>
          Create playlist
        </Link>
      </div>

      {/* Playlist results or empty/error states */}
      {error ? (
        <div className="card p-6 text-red-300">{error}</div>
      ) : loading ? (
        <div className="card p-6 text-white/70">Loading playlists…</div>
      ) : rows.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((p) => {
            const handle = handlesByUserId[p.userId] || "@user";

            return (
              <div key={p.id} className="card p-4 transition hover:-translate-y-0.5 hover:border-white/20">
                <div className="flex gap-3">
                  {/* Cover link only (no nested link issues) */}
                  <Link
                    href={`/p/${p.id}`}
                    className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex-shrink-0"
                    aria-label={`Open ${p.title}`}
                  >
                    <img
                      src={p.coverUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/p/${p.id}`} className="font-semibold truncate block hover:underline">
                          {p.title}
                        </Link>

                        {p.description ? (
                          <div className="text-sm text-white/60 line-clamp-2">{p.description}</div>
                        ) : (
                          <div className="text-sm text-white/40">No description yet.</div>
                        )}

                        <div className="text-xs mt-1" style={{ color: "var(--fog)" }}>
                          by <span style={{ color: "var(--gold)" }}>{handle}</span>
                        </div>
                      </div>

                      <div className="text-sm text-white/70 flex items-center gap-1 flex-shrink-0" aria-label={`${p.likes} likes`}>
                        <span aria-hidden>♥</span>
                        <span>{p.likes}</span>
                      </div>
                    </div>

                    {/* Tags are clickable and safe (no nested <a>) */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(p.tags || []).slice(0, 6).map((t) => {
                        const tag = normTag(t);
                        const isOn = selected.has(tag);
                        const next = isOn ? tagNames.filter((x) => x !== tag) : Array.from(new Set([...tagNames, tag]));
                        const href = buildExploreHref({ q, tags: next, sort });

                        return (
                          <Link
                            key={`${p.id}-${t}`}
                            href={href}
                            className={
                              isOn
                                ? "text-xs px-2.5 py-1 rounded-full bg-white/15 border border-white/20 text-white/90"
                                : "text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-white/80 hover:bg-white/15"
                            }
                          >
                            #{t}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-8 mt-6">
          <h3 className="text-lg font-semibold">No matches</h3>
          <p className="text-white/60 mt-1">Try clearing filters, searching a different vibe, or selecting fewer tags.</p>
          <div className="mt-4">
            <button type="button" onClick={clearAll} className="btn btnPrimary">
              Reset Explore
            </button>
          </div>
        </div>
      )}
    </div>
  );
}