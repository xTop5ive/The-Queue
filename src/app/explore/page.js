import Link from "next/link";
import { DEMO_PLAYLISTS } from "@/lib/demoPlaylists";

const QUICK_TAGS = ["r&b", "rap", "trap", "afrobeats", "austin", "late-night", "texas", "vibes"];

function toStr(v) {
  if (!v) return "";
  return Array.isArray(v) ? (v[0] ?? "") : v;
}
function normTag(t) {
  return (t || "").trim().toLowerCase();
}
function buildExploreHref(opts) {
  const p = new URLSearchParams();

  const q = (opts.q ?? "").trim();
  const tags = (opts.tags ?? []).map(normTag).filter(Boolean);
  const sort = opts.sort ?? "new";

  if (q) p.set("q", q);
  if (tags.length) p.set("tags", Array.from(new Set(tags)).join(","));
  p.set("sort", sort);

  if (opts.bpmMin != null) p.set("bpmMin", String(opts.bpmMin));
  if (opts.bpmMax != null) p.set("bpmMax", String(opts.bpmMax));
  if (opts.key) p.set("key", opts.key);
  if (opts.clean) p.set("clean", "1");
  if (opts.energyMin != null) p.set("energyMin", String(opts.energyMin));

  const qs = p.toString();
  return qs ? `/explore?${qs}` : "/explore";
}

export default function ExplorePage({ searchParams = {} }) {
  const q = toStr(searchParams.q).trim();
  const sort = toStr(searchParams.sort) === "top" ? "top" : "new";
  const tagNames = toStr(searchParams.tags)
    ? toStr(searchParams.tags).split(",").map(normTag).filter(Boolean)
    : [];

  // DJ-style filters (read from URL)
  const bpmMin = Number(toStr(searchParams?.bpmMin) || "0");
  const bpmMax = Number(toStr(searchParams?.bpmMax) || "300");
  const key = toStr(searchParams?.key) || "";
  const clean = toStr(searchParams?.clean) === "1";
  const energyMin = Number(toStr(searchParams?.energyMin) || "0");

  const qLower = q.toLowerCase();
  const selected = new Set(tagNames);

  const playlists = DEMO_PLAYLISTS
    .filter((p) => p.isPublic)
    .filter((p) => {
      if (!qLower) return true;
      const hay = `${p.title} ${p.description || ""} ${p.handle}`.toLowerCase();
      return hay.includes(qLower);
    })
    .filter((p) => {
      if (!tagNames.length) return true;
      const set = new Set((p.tags || []).map((t) => t.toLowerCase()));
      return tagNames.every((t) => set.has(t));
    })
    .filter((p) => {
      const avgBpm = p.avgBpm ?? null;
      if (avgBpm == null) return true;
      if (avgBpm < bpmMin) return false;
      if (avgBpm > bpmMax) return false;
      return true;
    })
    .filter((p) => {
      if (!key) return true;
      const keys = Array.isArray(p.keys) ? p.keys : [];
      return keys.includes(key);
    })
    .filter((p) => {
      if (!clean) return true;
      // clean=true means only allow clean playlists
      return p.clean !== false;
    })
    .filter((p) => {
      const energy = p.energy ?? null;
      if (energy == null) return true;
      if (energyMin <= 0) return true;
      return energy >= energyMin;
    })
    .sort((a, b) => {
      if (sort === "top") return (b.likes || 0) - (a.likes || 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const hrefNewest = buildExploreHref({ q, tags: tagNames, sort: "new", bpmMin, bpmMax, key, clean, energyMin });
  const hrefTop = buildExploreHref({ q, tags: tagNames, sort: "top", bpmMin, bpmMax, key, clean, energyMin });

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
          <span className="w-2 h-2 rounded-full" style={{ background: "var(--gold)" }} />
          The Queue • Demo Explore
        </div>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight">Explore</h1>
        <p className="text-white/60 mt-2 max-w-2xl">
          Find playlists by vibe + tags. Tap tags to filter. Switch to “Most liked” to see what’s trending.
        </p>
      </div>

      <div className="card p-5 mb-7">
        <form action="/explore" className="space-y-4">
          {/* keep url state */}
          <input type="hidden" name="tags" value={tagNames.join(",")} />
          <input type="hidden" name="sort" value={sort} />

          {/* TOP ROW: search + sort + submit */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search title, description, or @handle"
              className="w-full flex-1 px-4 py-2 rounded-full border"
              style={{
                background: "color-mix(in srgb, var(--midnight) 90%, transparent)",
                borderColor: "color-mix(in srgb, var(--line) 85%, transparent)",
                color: "var(--fog)",
              }}
            />

            <div className="flex flex-wrap gap-2">
              <Link
                href={hrefNewest}
                className="px-4 py-2 rounded-full border text-sm"
                style={{
                  background: sort === "new" ? "color-mix(in srgb, var(--plum) 20%, transparent)" : "transparent",
                  borderColor: "color-mix(in srgb, var(--line) 85%, transparent)",
                  color: "var(--fog)",
                }}
              >
                Newest
              </Link>

              <Link
                href={hrefTop}
                className="px-4 py-2 rounded-full border text-sm"
                style={{
                  background: sort === "top" ? "color-mix(in srgb, var(--plum) 20%, transparent)" : "transparent",
                  borderColor: "color-mix(in srgb, var(--line) 85%, transparent)",
                  color: "var(--fog)",
                }}
              >
                Most liked
              </Link>
            </div>

            <button
              type="submit"
              className="w-full md:w-auto px-6 py-2 rounded-full border text-sm font-semibold"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--plum) 55%, transparent), color-mix(in srgb, var(--gold) 18%, transparent))",
                borderColor: "color-mix(in srgb, var(--line) 75%, transparent)",
                color: "var(--fog)",
              }}
            >
              Search
            </button>
          </div>

          {/* DJ FILTERS (below) */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {/* BPM */}
            <div
              className="px-4 py-2 rounded-2xl border"
              style={{
                background: "color-mix(in srgb, var(--midnight) 85%, transparent)",
                borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
              }}
            >
              <div className="text-xs" style={{ color: "var(--muted)" }}>
                BPM range
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  name="bpmMin"
                  defaultValue={bpmMin || ""}
                  placeholder="Min"
                  className="w-full px-3 py-2 rounded-full border"
                  style={{
                    background: "color-mix(in srgb, var(--midnight) 90%, transparent)",
                    borderColor: "color-mix(in srgb, var(--line) 85%, transparent)",
                    color: "var(--fog)",
                  }}
                />
                <input
                  name="bpmMax"
                  defaultValue={bpmMax || ""}
                  placeholder="Max"
                  className="w-full px-3 py-2 rounded-full border"
                  style={{
                    background: "color-mix(in srgb, var(--midnight) 90%, transparent)",
                    borderColor: "color-mix(in srgb, var(--line) 85%, transparent)",
                    color: "var(--fog)",
                  }}
                />
              </div>
            </div>

            {/* Key */}
            <div
              className="px-4 py-2 rounded-2xl border"
              style={{
                background: "color-mix(in srgb, var(--midnight) 85%, transparent)",
                borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
              }}
            >
              <div className="text-xs" style={{ color: "var(--muted)" }}>
                Key (Camelot)
              </div>
              <select
                name="key"
                defaultValue={key}
                className="w-full mt-2 px-3 py-2 rounded-full border"
                style={{
                  background: "color-mix(in srgb, var(--midnight) 90%, transparent)",
                  borderColor: "color-mix(in srgb, var(--line) 85%, transparent)",
                  color: "var(--fog)",
                }}
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

            {/* Clean */}
            <div
              className="px-4 py-2 rounded-2xl border"
              style={{
                background: "color-mix(in srgb, var(--midnight) 85%, transparent)",
                borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
              }}
            >
              <div className="text-xs" style={{ color: "var(--muted)" }}>
                Version
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm" style={{ color: "var(--fog)" }}>
                <input type="checkbox" name="clean" value="1" defaultChecked={clean} />
                Clean only
              </label>
            </div>

            {/* Energy */}
            <div
              className="px-4 py-2 rounded-2xl border"
              style={{
                background: "color-mix(in srgb, var(--midnight) 85%, transparent)",
                borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
              }}
            >
              <div className="text-xs" style={{ color: "var(--muted)" }}>
                Minimum energy
              </div>
              <input name="energyMin" type="range" min="0" max="10" step="1" defaultValue={energyMin} className="mt-2 w-full" />
              <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                {energyMin}+ / 10
              </div>
            </div>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_TAGS.map((t) => {
            const isOn = selected.has(t);
            const next = isOn ? tagNames.filter((x) => x !== t) : Array.from(new Set([...tagNames, t]));
            const href = buildExploreHref({ q, tags: next, sort, bpmMin, bpmMax, key, clean, energyMin });

            return (
              <Link
                key={t}
                href={href}
                className="px-3 py-1 rounded-full border text-sm"
                style={{
                  background: isOn ? "color-mix(in srgb, var(--gold) 18%, transparent)" : "color-mix(in srgb, var(--midnight) 85%, transparent)",
                  borderColor: isOn ? "color-mix(in srgb, var(--gold) 45%, transparent)" : "color-mix(in srgb, var(--line) 80%, transparent)",
                }}
              >
                #{t}
              </Link>
            );
          })}

          {(q || tagNames.length > 0) && (
            <Link
              href={buildExploreHref({ sort })}
              className="ml-1 underline text-white/70 hover:text-white text-sm"
            >
              Clear
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Public playlists</h2>
          <p className="text-white/60 text-sm mt-1">
            Showing {playlists.length} result{playlists.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {playlists.map((p) => (
          <div key={p.id} className="card overflow-hidden">
            <Link href={`/p/${p.id}`} className="block">
              <div className="relative">
                <img
                  src={p.coverUrl}
                  alt=""
                  className="w-full object-cover"
                  style={{ height: 170 }}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <div
                  className="absolute inset-x-0 bottom-0 p-3"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65), transparent)" }}
                >
                  <div className="font-semibold leading-tight">{p.title}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>
                    by {p.handle}
                  </div>
                </div>
              </div>
            </Link>

            <div className="p-4">

              {p.description ? <div className="text-sm text-white/70">{p.description}</div> : null}

              {/* DJ-style stats */}
              <div className="mt-3 flex flex-wrap gap-2">
                {typeof p.avgBpm === "number" && (
                  <span
                    className="text-xs px-2.5 py-1 rounded-full border"
                    style={{
                      background: "color-mix(in srgb, var(--midnight) 85%, transparent)",
                      borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                      color: "var(--fog)",
                    }}
                  >
                    {p.avgBpm} BPM avg
                  </span>
                )}

                {typeof p.energy === "number" && (
                  <span
                    className="text-xs px-2.5 py-1 rounded-full border"
                    style={{
                      background: "color-mix(in srgb, var(--midnight) 85%, transparent)",
                      borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                      color: "var(--fog)",
                    }}
                  >
                    Energy {p.energy}/10
                  </span>
                )}

                {typeof p.clean === "boolean" && (
                  <span
                    className="text-xs px-2.5 py-1 rounded-full border"
                    style={{
                      background: p.clean
                        ? "color-mix(in srgb, var(--gold) 18%, transparent)"
                        : "color-mix(in srgb, var(--plum) 18%, transparent)",
                      borderColor: p.clean
                        ? "color-mix(in srgb, var(--gold) 45%, transparent)"
                        : "color-mix(in srgb, var(--plum) 45%, transparent)",
                      color: "var(--fog)",
                    }}
                  >
                    {p.clean ? "Clean" : "Explicit"}
                  </span>
                )}

                {Array.isArray(p.keys) && p.keys.length > 0 && (
                  <span
                    className="text-xs px-2.5 py-1 rounded-full border"
                    style={{
                      background: "color-mix(in srgb, var(--midnight) 85%, transparent)",
                      borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                      color: "var(--fog)",
                    }}
                  >
                    Key {p.keys.join(" • ")}
                  </span>
                )}
              </div>

              <div className="mt-2 flex items-center justify-between gap-3">
                <Link
                  href={`/u/${String(p.handle || "").replace(/^@/, "")}`}
                  className="text-xs underline text-white/60 hover:text-white"
                  title={`View ${p.handle} profile`}
                >
                  by {p.handle}
                </Link>

                <div className="text-sm text-white/70 flex-shrink-0">♥ {p.likes}</div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  {Array.isArray(p.tags) ? `${p.tags.length} tag${p.tags.length === 1 ? "" : "s"}` : ""}
                </span>
                <Link href={`/p/${p.id}`} className="text-sm underline text-white/80 hover:text-white">
                  Open
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}