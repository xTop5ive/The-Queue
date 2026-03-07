import Link from "next/link";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function mapPlaylist(row, handleByUserId) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    coverUrl: row.cover_url,
    tags: row.tags || [],
    likes: row.likes_count ?? 0,
    userId: row.user_id,
    handle: row.owner_handle || handleByUserId?.[row.user_id] || "@user",
    createdAt: row.created_at,
  };
}

export default async function FeedPage() {
  const supabase = createServerClient();

  // Public playlists = “feed” for now
  const { data: rows, error } = await supabase
    .from("playlists")
    .select("id,user_id,title,description,cover_url,tags,likes_count,created_at,owner_handle")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(30);

  const userIds = Array.from(new Set((rows || []).map((r) => r.user_id).filter(Boolean)));
  const handleByUserId = {};

  if (userIds.length) {
    const { data: profRows } = await supabase.from("profiles").select("id,handle,username").in("id", userIds);
    (profRows || []).forEach((pr) => {
      const raw = (pr?.handle || pr?.username || "").trim();
      if (!raw) return;
      handleByUserId[pr.id] = raw.startsWith("@") ? raw : `@${raw}`;
    });
  }

  const items = (rows || []).map((r) => mapPlaylist(r, handleByUserId));

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Feed</h1>
          <p className="text-white/60 mt-1">What people are making right now.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/talk/new" className="px-4 py-2 rounded-full border text-sm"
            style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}>
            New post
          </Link>
          <Link href="/afterglow/new" className="px-4 py-2 rounded-full border text-sm"
            style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}>
            New Afterglow
          </Link>
        </div>
      </div>

      {error ? (
        <div className="card p-6 text-red-400">Error: {String(error.message || error)}</div>
      ) : null}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((p) => (
          <Link key={p.id} href={`/p/${p.id}`} className="card p-4 hover:border-white/20 transition hover:-translate-y-0.5">
            <div className="flex gap-3">
              <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex-shrink-0">
                {p.coverUrl ? (
                  <img src={p.coverUrl} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-[10px] text-white/60">no cover</div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{p.title}</div>
                <div className="text-sm text-white/60 line-clamp-2">{p.description || "No description"}</div>
                <div className="text-xs mt-1">
                  <span className="text-white/50">by </span>
                  <span className="text-white/85">{p.handle}</span>
                </div>
              </div>

              <div className="text-sm text-white/70 flex items-center gap-1 flex-shrink-0">
                <span aria-hidden>♥</span>
                <span>{p.likes}</span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {(p.tags || []).slice(0, 4).map((t) => (
                <span key={`${p.id}-${t}`} className="text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-white/80">
                  {t}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}