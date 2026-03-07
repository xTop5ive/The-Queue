# The Queue (Top5ive)

The Queue is a playlist-sharing + discovery web app with a luxury club vibe. Users can create playlists, add tags, upload cover art, browse public playlists, and like playlists.

## Tech Stack
- Next.js (App Router)
- Tailwind CSS
- Supabase (Auth + Database + Storage)

## Features Implemented
- Auth: Sign up / Sign in / Sign out (Supabase Auth)
- Create Playlist: title, description, tags, cover upload (Supabase Storage)
- Explore: playlist feed + tags + search + DJ-style filters (BPM, key, energy, clean)
- Playlist Detail: playlist hero, tags, share link, like button (writes to DB)
- Profile page: creator view (in progress / being connected to real data)

## Project Structure
- `src/` — application source code
- `documentation/` — SRS + planning artifacts
- `deployment/` — installation + setup instructions
- `user-docs/` — user guide and help documentation

## Setup / Run Locally
See: `deployment/INSTALL.md`

## User Guide
See: `user-docs/USER_GUIDE.md`

## Repo
https://github.com/xTop5ive/The-Queue