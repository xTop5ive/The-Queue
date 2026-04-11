"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";

function normTag(t) {
  return String(t || "").trim().toLowerCase();
}

function fmtHandle(h) {
  const v = String(h || "").trim();
  if (!v) return "@user";
  return v.startsWith("@") ? v : `@${v}`;
}

function toNum(v) {
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function buildExploreHref(opts) {
  const p = new URLSearchParams();
  const q = (opts.q || "").trim();
  const tags = (opts.tags || []).map(normTag).filter(Boolean);
  const sort = opts.sort === "top" ? "top" : "new";
  if (q) p.set("q", q);
  if (tags.length) p.set("tags", Array.from(new Set(tags)).join(","));
  p.set("sort", sort);
  if (typeof opts.bpmMin === "number") p.set("bpmMin", String(opts.bpmMin));
  if (typeof opts.bpmMax === "number") p.set("bpmMax", String(opts.bpmMax));
  if (typeof opts.energyMin === "number") p.set("energyMin", String(opts.energyMin));
  if (opts.clean === "1" || opts.clean === "0") p.set("clean", opts.clean);
  if (opts.key) p.set("key", String(opts.key));
  const qs = p.toString();
  return qs ? `/explore?${qs}` : "/explore";
}

const QUICK_TAGS = ["r&b", "hip-hop", "pop", "afrobeats", "edm", "rock", "country", "latin"];

export default function ExplorePage() {
  const router = useRouter();
  const sp = useSearchParams();
  const supabase = useMemo(() => createBrowserClient(), []);

  const q = (sp?.get("q") || "").trim();
  const sort = sp?.get("sort") === "top" ? "top" : "new";
  const tagsParam = sp?.get("tags") || "";
  const tagNames = tagsParam ? tagsParam.split(",").map(normTag).filter(Boolean) : [];
  const selected = useMemo(() => new Set(tagNames), [tagsParam]);

  const bpmMin = sp?.get("bpmMin");
  const bpmMax = sp?.get("bpmMax");
  const energyMin = sp?.get("energyMin");
  const clean = sp?.get("clean");
  const key = sp?.get("key");

  const [searchText, setSearchText] = useState(q);
  const [bpmMinText, setBpmMinText] = useState(bpmMin ?? "");
  const [bpmMaxText, setBpmMaxText] = useState(bpmMax ?? "");
  const [keyText, setKeyText] = useState(key ?? "");
  const [cleanOnly, setCleanOnly] = useState(clean === "1");
  const [energyMinVal, setEnergyMinVal] = useState(energyMin ? Number(energyMin) : 0);

  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestItems, setSuggestItems] = useState([]);
  const [suggestActive, setSuggestActive] = useState(-1);
  const searchWrapRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [handlesByUserId, setHandlesByUserId] = useState({});
  const [error, setError] = useState("");
  const [djWarning, setDjWarning] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hasAdvanced = !!(bpmMin || bpmMax || energyMin || clean || key);

  useEffect(() => {
    setSearchText(q);
    setBpmMinText(bpmMin ?? "");
    setBpmMaxText(bpmMax ?? "");
    setKeyText(key ?? "");
    setCleanOnly(clean === "1");
    setEnergyMinVal(energyMin ? Number(energyMin) : 0);
    if (bpmMin || bpmMax || energyMin || clean || key) setShowAdvanced(true);
  }, [q, bpmMin, bpmMax, key, clean, energyMin]);

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

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      setDjWarning("");
      try {
        let query = supabase.from("playlists").select("*").eq("is_public", true);
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
              const safe = raw;
              query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
            }
          } else {
            const safe = term.replaceAll(",", " ");
            query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
          }
        }
        if (tagNames.length) {
          query = query.contains("tags", tagNames);
        }
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
        if (sort === "top") query = query.order("likes_count", { ascending: false });
        else query = query.order("created_at", { ascending: false });
        let data;
        let qErr;
        const res1 = await query.limit(24);
        data = res1.data;
        qErr = res1.error;
        if (qErr && /column|schema cache/i.test(qErr.message || "")) {
          let fallback = supabase.from("playlists").select("*").eq("is_public", true);
          if (q) {
            const term = q.trim();
            if (term.startsWith("@")) {
              const raw = term.slice(1).replaceAll(",", " ");
              try {
                const { data: profs } = await supabase
                  .from("profiles").select("id,handle,username")
                  .or(`handle.ilike.%${raw}%,username.ilike.%${raw}%`).limit(50);
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
          if (tagNames.length) fallback = fallback.contains("tags", tagNames);
          if (sort === "top") fallback = fallback.order("likes_count", { ascending: false });
          else fallback = fallback.order("created_at", { ascending: false });
          const res2 = await fallback.limit(24);
          data = res2.data;
          qErr = res2.error;
          if (!qErr && (bpmMin || bpmMax || energyMin || clean || key)) {
            setDjWarning("DJ filters need the avg_bpm, energy, clean, and keys columns in Supabase.");
          }
        }
        if (qErr) throw qErr;
        const mapped = (data || []).map((r) => ({
          ...r,
          coverUrl: r.cover_url || "",
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
        const userIds = Array.from(new Set(mapped.map((x) => x.userId).filter(Boolean)));
        if (!userIds.length) { setHandlesByUserId({}); return; }
        try {
          const { data: profs, error: pErr } = await supabase
            .from("profiles").select("id, handle, username").in("id", userIds);
          if (pErr) throw pErr;
          const map = {};
          for (const p of profs || []) { map[p.id] = fmtHandle(p?.handle || p?.username || ""); }
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
    return () => { alive = false; };
  }, [supabase, q, tagsParam, sort, bpmMin, bpmMax, energyMin, clean, key]);

  useEffect(() => {
    let alive = true;
    const term = (searchText || "").trim();
    if (!term) {
      setSuggestItems([]);
      setSuggestOpen(false);
      setSuggestActive(-1);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setSuggestLoading(true);
        const raw = term.startsWith("@") ? term.slice(1) : term;
        const safe = raw.replaceAll(",", " ");
        const plRes = await supabase
          .from("playlists").select("id,title,user_id").eq("is_public", true)
          .ilike("title", `%${safe}%`).order("created_at", { ascending: false }).limit(6);
        let creators = [];
        try {
          const prRes = await supabase
            .from("profiles").select("id,handle,username")
            .or(`handle.ilike.%${safe}%,username.ilike.%${safe}%`).limit(6);
          creators = (prRes.data || []).map((p) => {
            const h = (p.handle || p.username || "").trim();
            if (!h) return null;
            const hh = h.startsWith("@") ? h : `@${h}`;
            return { type: "creator", label: hh, value: hh };
          }).filter(Boolean);
        } catch { creators = []; }
        const playlists = (plRes.data || []).map((r) => ({ type: "playlist", label: r.title, value: r.title }));
        const combined = term.startsWith("@") ? [...creators, ...playlists] : [...playlists, ...creators];
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
    return () => { alive = false; clearTimeout(t); };
  }, [supabase, searchText]);

  function applySuggestion(item) {
    if (!item) return;
    setSearchText(item.value);
    setSuggestOpen(false);
    setSuggestActive(-1);
  }

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

  function clearAll() {
    setSearchText("");
    setBpmMinText("");
    setBpmMaxText("");
    setKeyText("");
    setCleanOnly(false);
    setEnergyMinVal(0);
    setSuggestOpen(false);
    setSuggestItems([]);
    setSuggestActive(-1);
    router.push(buildExploreHref({ sort }));
  }

  const hrefNewest = buildExploreHref({ q, tags: tagNames, sort: "new" });
  const hrefTop = buildExploreHref({ q, tags: tagNames, sort: "top" });
  const hasActiveFilters = !!(q || tagNames.length || bpmMin || bpmMax || energyMin || clean || key);

  // ── JSX ──────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-5 py-10">

      {/* Header */}
      <div className="mb-8">
        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs mb-4"
          style={{
            background: "color-mix(in srgb, var(--gold) 10%, transparent)",
            color: "var(--gold)",
            border: "1px solid color-mix(in srgb, var(--gold) 25%, transparent)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--gold)" }} />
          The Queue &mdash; Explore
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-white">Explore</h1>
        <p className="text-white/50 mt-2 max-w-xl">
          Browse broad. Search by vibe, tag, or creator.
        </p>
      </div>

      {/* Search + filters */}
      <div
        className="rounded-2xl border p-5 mb-8"
        style={{
          borderColor: "color-mix(in srgb, var(--line) 70%, transparent)",
          background: "color-mix(in srgb, var(--midnight) 80%, transparent)",
        }}
      >
        <form onSubmit={submitSearch} className="space-y-4">
          {/* Search row */}
          <div className="flex gap-3">
            <div ref={searchWrapRef} className="relative flex-1">
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onFocus={() => {
                  if ((searchText || "").trim() && suggestItems.length) setSuggestOpen(true);
                }}
                onKeyDown={(e) => {
                  if (!suggestOpen || !suggestItems.length) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSuggestActive((i) => Math.min((i < 0 ? -1 : i) + 1, suggestItems.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSuggestActive((i) => Math.max(i - 1, 0));
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
                className="w-full px-4 py-2.5 rounded-xl border outline-none text-sm"
                style={{
                  background: "color-mix(in srgb, var(--midnight) 90%, transparent)",
                  borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                  color: "var(--fog)",
                }}
                autoComplete="off"
              />

              {/* Autocomplete dropdown */}
              {suggestOpen && (suggestLoading || suggestItems.length) ? (
                <div
                  className="absolute z-50 mt-2 w-full rounded-2xl border overflow-hidden"
                  style={{
                    background: "color-mix(in srgb, var(--midnight) 98%, black)",
                    borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                    boxShadow: "0 18px 40px rgba(0,0,0,0.55)",
                  }}
                >
                  {suggestLoading && <div className="px-4 py-3 text-sm text-white/50">Searching&hellip;</div>}
                  {!suggestLoading && !suggestItems.length && (
                    <div className="px-4 py-3 text-sm text-white/40">No suggestions.</div>
                  )}
                  {!suggestLoading && suggestItems.map((it, idx) => (
                    <button
                      key={`${it.type}-${it.label}-${idx}`}
                      type="button"
                      onClick={() => applySuggestion(it)}
                      onMouseEnter={() => setSuggestActive(idx)}
                      className="w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-3"
                      style={{
                        background: idx === suggestActive ? "color-mix(in srgb, white 8%, transparent)" : "transparent",
                        borderTop: idx === 0 ? "none" : "1px solid color-mix(in srgb, var(--line) 50%, transparent)",
                        color: "var(--fog)",
                      }}
                    >
                      <span className="truncate text-white/90">{it.label}</span>
                      <span className="text-[11px] text-white/40 flex-shrink-0">
                        {it.type === "creator" ? "Creator" : "Playlist"}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-sm font-semibold flex-shrink-0 transition hover:opacity-90"
              style={{
                background: "color-mix(in srgb, var(--gold) 18%, transparent)",
                color: "var(--gold)",
                border: "1px solid color-mix(in srgb, var(--gold) 35%, transparent)",
              }}
            >
              Search
            </button>
          </div>

          {/* Genre tags + advanced toggle */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-wrap gap-2">
              {QUICK_TAGS.map((t) => {
                const isOn = selected.has(t);
                const next = isOn ? tagNames.filter((x) => x !== t) : Array.from(new Set([...tagNames, t]));
                const href = buildExploreHref({ q, tags: next, sort });
                return (
                  <Link
                    key={t}
                    href={href}
                    className="px-3 py-1 rounded-full text-xs font-medium transition"
                    style={{
                      background: isOn
                        ? "color-mix(in srgb, var(--plum) 25%, transparent)"
                        : "color-mix(in srgb, var(--line) 30%, transparent)",
                      color: isOn
                        ? "color-mix(in srgb, var(--plum) 90%, white)"
                        : "var(--muted)",
                      border: `1px solid ${isOn
                        ? "color-mix(in srgb, var(--plum) 40%, transparent)"
                        : "color-mix(in srgb, var(--line) 60%, transparent)"}`,
                    }}
                  >
                    #{t}
                  </Link>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs flex items-center gap-1.5 transition hover:text-white flex-shrink-0"
              style={{ color: hasAdvanced ? "var(--gold)" : "var(--muted)" }}
            >
              {hasAdvanced && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--gold)" }} />}
              Advanced
              <span style={{ opacity: 0.6 }}>{showAdvanced ? "▲" : "▼"}</span>
            </button>
          </div>

          {/* Advanced DJ filters (collapsible) */}
          {showAdvanced && (
            <div
              className="rounded-xl border p-4 grid grid-cols-1 md:grid-cols-4 gap-4"
              style={{ borderColor: "color-mix(in srgb, var(--line) 60%, transparent)" }}
            >
              <div>
                <div className="text-[11px] mb-1.5" style={{ color: "var(--muted)" }}>BPM range</div>
                <div className="flex gap-2">
                  <input
                    value={bpmMinText}
                    onChange={(e) => setBpmMinText(e.target.value)}
                    inputMode="numeric"
                    placeholder="Min"
                    className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                    style={{ background: "transparent", borderColor: "color-mix(in srgb, var(--line) 80%, transparent)", color: "var(--fog)" }}
                  />
                  <input
                    value={bpmMaxText}
                    onChange={(e) => setBpmMaxText(e.target.value)}
                    inputMode="numeric"
                    placeholder="Max"
                    className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                    style={{ background: "transparent", borderColor: "color-mix(in srgb, var(--line) 80%, transparent)", color: "var(--fog)" }}
                  />
                </div>
              </div>

              <div>
                <div className="text-[11px] mb-1.5" style={{ color: "var(--muted)" }}>Key (Camelot)</div>
                <select
                  value={keyText}
                  onChange={(e) => setKeyText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                  style={{ background: "color-mix(in srgb, var(--midnight) 90%, transparent)", borderColor: "color-mix(in srgb, var(--line) 80%, transparent)", color: "var(--fog)" }}
                >
                  <option value="">Any</option>
                  {["1A","2A","3A","4A","5A","6A","7A","8A","9A","10A","11A","12A",
                    "1B","2B","3B","4B","5B","6B","7B","8B","9B","10B","11B","12B"].map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-[11px] mb-1.5" style={{ color: "var(--muted)" }}>
                  Min energy &mdash; {energyMinVal}/10
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={energyMinVal}
                  onChange={(e) => setEnergyMinVal(Number(e.target.value))}
                  className="w-full mt-1"
                />
              </div>

              <div>
                <div className="text-[11px] mb-1.5" style={{ color: "var(--muted)" }}>Version</div>
                <label
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer"
                  style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
                >
                  <input type="checkbox" checked={cleanOnly} onChange={(e) => setCleanOnly(e.target.checked)} />
                  <span className="text-sm" style={{ color: "var(--fog)" }}>Clean only</span>
                </label>
              </div>

              {djWarning && (
                <div className="md:col-span-4 text-xs" style={{ color: "#fbbf24" }}>
                  {djWarning}
                </div>
              )}
            </div>
          )}

          {/* Active tag filters */}
          {tagNames.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs" style={{ color: "var(--muted)" }}>Active:</span>
              {Array.from(new Set(tagNames)).map((t) => {
                const remaining = tagNames.filter((x) => x !== t);
                const href = buildExploreHref({ q, tags: remaining, sort });
                return (
                  <Link
                    key={t}
                    href={href}
                    className="text-xs px-2.5 py-1 rounded-full transition hover:opacity-80"
                    style={{
                      background: "color-mix(in srgb, var(--plum) 20%, transparent)",
                      color: "color-mix(in srgb, var(--plum) 90%, white)",
                      border: "1px solid color-mix(in srgb, var(--plum) 35%, transparent)",
                    }}
                  >
                    #{t} &times;
                  </Link>
                );
              })}
            </div>
          )}
        </form>
      </div>

      {/* Results header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-white font-semibold">
              {loading ? "Loading\u2026" : `${rows.length} result${rows.length === 1 ? "" : "s"}`}
            </span>
            {!loading && (
              <span className="text-sm ml-2" style={{ color: "var(--muted)" }}>
                sorted by {sort === "top" ? "most liked" : "newest"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Link
              href={hrefNewest}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium transition"
              style={{
                background: sort === "new" ? "color-mix(in srgb, var(--gold) 16%, transparent)" : "transparent",
                color: sort === "new" ? "var(--gold)" : "var(--muted)",
                border: `1px solid ${sort === "new" ? "color-mix(in srgb, var(--gold) 35%, transparent)" : "color-mix(in srgb, var(--line) 60%, transparent)"}`,
              }}
            >
              Newest
            </Link>
            <Link
              href={hrefTop}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium transition"
              style={{
                background: sort === "top" ? "color-mix(in srgb, var(--gold) 16%, transparent)" : "transparent",
                color: sort === "top" ? "var(--gold)" : "var(--muted)",
                border: `1px solid ${sort === "top" ? "color-mix(in srgb, var(--gold) 35%, transparent)" : "color-mix(in srgb, var(--line) 60%, transparent)"}`,
              }}
            >
              Most liked
            </Link>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAll}
                className="px-3.5 py-1.5 rounded-full text-xs transition hover:text-white"
                style={{ color: "var(--muted)" }}
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        <Link
          href="/new"
          className="px-4 py-2 rounded-full text-sm font-medium transition hover:opacity-90 flex-shrink-0"
          style={{
            background: "color-mix(in srgb, var(--gold) 16%, transparent)",
            color: "var(--gold)",
            border: "1px solid color-mix(in srgb, var(--gold) 35%, transparent)",
          }}
        >
          + Create playlist
        </Link>
      </div>

      {/* Results */}
      {error ? (
        <div
          className="rounded-2xl border px-6 py-8 text-sm"
          style={{ borderColor: "color-mix(in srgb, #f87171 40%, transparent)", color: "#f87171" }}
        >
          {error}
        </div>
      ) : loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border overflow-hidden animate-pulse"
              style={{ borderColor: "color-mix(in srgb, var(--line) 50%, transparent)" }}
            >
              <div className="aspect-video w-full" style={{ background: "color-mix(in srgb, var(--line) 30%, transparent)" }} />
              <div className="p-3 space-y-2">
                <div className="h-3.5 w-3/4 rounded" style={{ background: "color-mix(in srgb, var(--line) 35%, transparent)" }} />
                <div className="h-3 w-1/2 rounded" style={{ background: "color-mix(in srgb, var(--line) 25%, transparent)" }} />
              </div>
            </div>
          ))}
        </div>
      ) : rows.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((p) => {
            const handle = handlesByUserId[p.userId] || "@user";
            const rawHandle = handle.replace(/^@/, "");
            return (
              <div
                key={p.id}
                className="group rounded-2xl border overflow-hidden flex flex-col transition hover:border-white/20"
                style={{
                  borderColor: "color-mix(in srgb, var(--line) 70%, transparent)",
                  background: "color-mix(in srgb, var(--midnight) 75%, transparent)",
                }}
              >
                {/* Cover */}
                <Link href={`/p/${p.id}`} className="block relative flex-shrink-0" style={{ aspectRatio: "16/9" }}>
                  {p.coverUrl ? (
                    <img
                      src={p.coverUrl}
                      alt={p.title}
                      className="w-full h-full object-cover transition group-hover:brightness-90"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-4xl"
                      style={{ background: "color-mix(in srgb, var(--plum) 18%, var(--midnight))" }}
                    >
                      &#9835;
                    </div>
                  )}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.4)" }}
                  >
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
                    >
                      <span className="text-white text-lg pl-0.5">&#9654;</span>
                    </div>
                  </div>
                </Link>

                {/* Info */}
                <div className="p-3 flex flex-col gap-1.5 flex-1">
                  <Link
                    href={`/p/${p.id}`}
                    className="font-semibold text-sm text-white hover:underline line-clamp-1"
                  >
                    {p.title}
                  </Link>
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/u/${rawHandle}`}
                      className="text-xs hover:underline truncate"
                      style={{ color: "var(--muted)" }}
                    >
                      @{rawHandle}
                    </Link>
                    <span className="text-xs flex-shrink-0 ml-2" style={{ color: "var(--muted)" }}>
                      &#9829; {p.likes}
                    </span>
                  </div>
                  {(p.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {(p.tags || []).slice(0, 4).map((t) => {
                        const tag = normTag(t);
                        const isOn = selected.has(tag);
                        const next = isOn ? tagNames.filter((x) => x !== tag) : Array.from(new Set([...tagNames, tag]));
                        const href = buildExploreHref({ q, tags: next, sort });
                        return (
                          <Link
                            key={`${p.id}-${t}`}
                            href={href}
                            className="text-[10px] px-2 py-0.5 rounded-full transition hover:opacity-80"
                            style={{
                              background: isOn
                                ? "color-mix(in srgb, var(--plum) 30%, transparent)"
                                : "color-mix(in srgb, var(--plum) 18%, transparent)",
                              color: "color-mix(in srgb, var(--plum) 85%, white)",
                              border: `1px solid ${isOn
                                ? "color-mix(in srgb, var(--plum) 50%, transparent)"
                                : "color-mix(in srgb, var(--plum) 28%, transparent)"}`,
                            }}
                          >
                            #{t}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="rounded-2xl border px-8 py-14 text-center"
          style={{ borderColor: "color-mix(in srgb, var(--line) 50%, transparent)" }}
        >
          <div className="text-3xl mb-3 text-white/20">&#9835;</div>
          <div className="text-white font-semibold mb-1">No matches found</div>
          <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
            Try clearing filters, searching a different vibe, or selecting fewer tags.
          </p>
          <button
            type="button"
            onClick={clearAll}
            className="px-5 py-2 rounded-full text-sm font-medium transition hover:opacity-90"
            style={{
              background: "color-mix(in srgb, var(--gold) 16%, transparent)",
              color: "var(--gold)",
              border: "1px solid color-mix(in srgb, var(--gold) 35%, transparent)",
            }}
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
