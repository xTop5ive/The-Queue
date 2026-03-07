# The Queue — User Guide

## What is The Queue?
**The Queue** is a music + playlist sharing app with a premium “luxury club” vibe.  
Users can create playlists, tag them by genre/vibe, browse Explore, like playlists, and view playlist detail pages.

---

## Quick Start

### 1) Create an account
1. Click **Sign in**
2. Click **Create account**
3. Enter:
   - Email
   - Password
   - Optional name + handle
4. Submit, then log in.

### 2) Create a playlist
1. Click **Create Playlist**
2. Fill in:
   - Title
   - Description
   - Tags
   - Visibility (Public/Private)
   - Optional cover image
3. Click **Create playlist**
4. You will be taken to the playlist detail page `/p/[id]`.

### 3) Explore playlists
1. Go to **Explore**
2. Use:
   - Search bar (title/desc/tags/creator)
   - Genre tag chips
   - DJ-style filters (if enabled in your build)
3. Click any playlist card to open it.

### 4) Like a playlist
1. Open any playlist detail page
2. Click **Like**
3. The like count updates and should persist.

---

## Features Included (Current Build)

### Authentication
- Sign up
- Sign in
- Log out
- Navbar shows the current user when logged in

### Playlist Creation
- Create playlist with:
  - title
  - description
  - tags
  - public/private toggle
  - cover upload (Supabase storage bucket required)

### Explore Page
- Browse public playlists
- Search by keywords
- Filter by tags
- Sort options (ex: newest / most liked depending on build)

### Playlist Detail Page (`/p/[id]`)
- Playlist hero section (cover + title + description)
- Shows creator
- Real likes (toggle like)
- Share buttons
- More by creator section
- Comments stub section
- Sticky play bar UI stub (demo)

### Profile Page (`/u/[handle]`)
- Shows creator profile header
- Lists playlists by that user (depending on current wiring)

---

## Screenshots to Include
Add screenshots of these pages (recommended):
- Home / Landing page
- Explore page
- Playlist detail page
- New playlist form
- Login / Signup page

Put screenshots in:
- `user-docs/screenshots/`
and link them here in this doc.

Example:

![Explore](./screenshots/explore.png)
![Playlist Detail](./screenshots/playlist-detail.png)

---

## Common Issues + Fixes

### “Bucket not found”
**Cause:** Supabase Storage bucket name mismatch or bucket not created.  
**Fix:**
1. Supabase Dashboard → Storage
2. Create bucket named exactly (case-sensitive): `covers`
3. Make it **Public** (for now)
4. Try upload again

### “Could not find column in schema cache”
**Cause:** Code is inserting/selecting a column that doesn’t exist in your `playlists` table.  
**Fix:**
- Confirm the `public.playlists` table columns match what your insert is sending
- Remove fields like `handle`, `owner_handle`, `owner_id` unless those columns exist
- Refresh schema cache in Supabase if needed (or reload dashboard)

### Likes not updating
**Cause:** Missing `playlist_likes` table or RLS prevents insert/delete.  
**Fix:**
- Ensure `playlist_likes` table exists
- Temporarily disable RLS for class demo OR add policies:
  - Allow authenticated users to insert/delete their own like rows
  - Allow public select for counts

### Can’t access database (Prisma/Supabase connection errors)
**Cause:** Wrong DB URL, network/DNS issues, or Supabase project paused.  
**Fix:**
- Verify Supabase project is active
- Re-check `.env.local` values
- Confirm host resolves and project URL is correct

---

## FAQ

### Do I need an account to browse?
You can browse public playlists, but creating/liking requires logging in.

### Can I upload tracks yet?
Tracks are currently a **stub** (UI only). Track upload is planned next.

### What’s next?
Planned near-term features:
- Add tracks to playlists (songs + metadata)
- Real comment system
- Better profile + social features
- Advanced “DJ-under-the-hood” filtering (BPM, key, energy)

---

## Support / Notes for Demo
For class demo, the “must-show” flow is:
1. Sign up / Sign in
2. Create playlist (with tags + cover)
3. See it appear on Explore
4. Open playlist detail
5. Like it + show count changes
6. Show profile page + user playlists