import Link from "next/link";
import { DEMO_PLAYLISTS } from "@/lib/demoPlaylists";

const QUICK_TAGS = ["r&b", "rap", "trap", "afrobeats", "austin", "late-night", "texas", "vibes"];

function toStr(v) {
  if (!v) return "";
  return Array.isArray(v) ? v[0] ?? "" : v;
}
function normTag(t) {
  return (t || "").trim().toLowerCase();
}
function buildExploreHref({ q = "", tags = [], sort = "new" }) {
  const p = new URLSearchParams();
  const qq = q.trim();
  const t = (tags || []).map(normTag).filter(Boolean);
  if (qq) p.set("q", qq);
  if (t.length) p.set("tags", Array.from(new Set(t)).join(","));
  p.set("sort", sort === "top" ? "top" : "new");
  const qs = p.toString();
  return qs ? `/explore?${qs}` : "/explore";
}

export default function ExplorePage({ searchParams = {} }) {
  const q = toStr(searchParams.q).trim();
  const sort = toStr(searchParams.sort) === "top" ? "top" : "new";
  const tagNames = toStr(searchParams.tags)
    ? toStr(searchParams.tags).split(",").map(normTag).filter(Boolean)
    : [];

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
    .sort((a, b) => {
      if (sort === "top") return (b.likes || 0) - (a.likes || 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const hrefNewest = buildExploreHref({ q, tags: tagNames, sort: "new" });
  const hrefTop = buildExploreHref({ q, tags: tagNames, sort: "top" });

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
        <form className="flex flex-col md:flex-row gap-3" action="/explore">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search title, description, or @handle"
            className="w-full md:flex-1 px-4 py-2 rounded-full border"
            style={{
              background: "color-mix(in srgb, var(--midnight) 90%, transparent)",
              borderColor: "color-mix(in srgb, var(--line) 85%, transparent)",
              color: "var(--fog)",
            }}
          />
          <input type="hidden" name="tags" value={tagNames.join(",")} />
          <input type="hidden" name="sort" value={sort} />

          <div className="flex gap-2">
            <Link
              href={hrefNewest}
              className="px-4 py-2 rounded-full border text-sm"
              style={{
                background: sort === "new" ? "color-mix(in srgb, var(--plum) 20%, transparent)" : "transparent",
                borderColor: "color-mix(in srgb, var(--line) 85%, transparent)",
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
              }}
            >
              Most liked
            </Link>
          </div>

          <button className="inBtn md:w-auto" type="submit">
            Search
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
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
                  background: isOn ? "color-mix(in srgb, var(--gold) 18%, transparent)" : "color-mix(in srgb, var(--midnight) 85%, transparent)",
                  borderColor: isOn ? "color-mix(in srgb, var(--gold) 45%, transparent)" : "color-mix(in srgb, var(--line) 80%, transparent)",
                }}
              >
                #{t}
              </Link>
            );
          })}

          {(q || tagNames.length > 0) && (
            <Link href="/explore" className="ml-1 underline text-white/70 hover:text-white text-sm">
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