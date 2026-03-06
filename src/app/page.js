import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-3xl font-semibold">Explore Playlists</h1>
      <p className="mt-2 text-gray-500">
        This app is being rebuilt into a music + playlist sharing platform.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link className="rounded-lg border p-4 hover:bg-gray-50" href="/explore">
          <div className="font-medium">Explore</div>
          <div className="text-sm text-gray-500">Browse playlists by vibe, tags, or creator</div>
        </Link>

        <Link className="rounded-lg border p-4 hover:bg-gray-50" href="/new-playlist">
          <div className="font-medium">New Playlist</div>
          <div className="text-sm text-gray-500">Create and share your playlist</div>
        </Link>
      </div>
    </main>
  );
}
