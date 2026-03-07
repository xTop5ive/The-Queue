# The Queue — INSTALL / Setup

This guide explains how to run **The Queue** locally.

---

## Requirements

- **Node.js 18+** (recommended: 18.18+ or 20+)
- **npm** (comes with Node)
- A **Supabase** project (Auth + Database + Storage)

---

## 1) Clone the repo

```bash
git clone https://github.com/xTop5ive/The-Queue.git
cd the-queue


⸻

2) Install dependencies

npm install

(Optional) If you see vulnerability warnings, you can run:

npm audit fix


⸻

3) Create .env.local

Create a file at the project root named .env.local and add:

NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

Where to find these:
	•	Supabase Dashboard → Project Settings → API
	•	Copy Project URL
	•	Copy anon public key

⸻

4) Supabase setup (Database + Storage)

A) Database tables

You must have these tables in Supabase:

playlists table (required)
Minimum columns used by the app:
	•	id uuid primary key default gen_random_uuid()
	•	user_id uuid not null references auth.users(id) on delete cascade
	•	title text not null
	•	description text
	•	tags text[] not null default '{}'::text[]
	•	is_public boolean not null default true
	•	cover_path text
	•	cover_url text
	•	created_at timestamptz not null default now()
	•	likes_count int not null default 0

If you already created this table, you’re good.

playlist_likes table (required)
Used for real likes:
	•	id uuid primary key default gen_random_uuid()
	•	playlist_id uuid not null references public.playlists(id) on delete cascade
	•	user_id uuid not null references auth.users(id) on delete cascade
	•	created_at timestamptz not null default now()

Recommended constraints/indexes:
	•	unique constraint on (playlist_id, user_id) so users can’t like twice

⸻

B) Storage bucket (Cover images)

Create a bucket in Supabase:
	•	Supabase Dashboard → Storage → New bucket
	•	Name it exactly: covers  (lowercase, case-sensitive)
	•	Set it to Public (for now)

The app uploads playlist covers into this bucket.

⸻

5) Run the app

npm run dev

Open:
	•	http://localhost:3000

⸻

6) Basic test flow
	1.	Go to /signup and create an account
	2.	Go to /new and create a playlist (title + tags + optional cover)
	3.	You should be redirected to /p/[id] (playlist detail)
	4.	Click Like and confirm the number updates

⸻

Troubleshooting

“Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY”
	•	Your .env.local is missing or values are wrong
	•	Make sure .env.local is in the project root
	•	Restart dev server after editing env vars:
	•	stop the server, then run npm run dev again

“Storage bucket ‘covers’ not found”
	•	Create the bucket in Supabase Storage named covers (lowercase)
	•	Make sure it is Public (for now)

Sign up works but profile handle shows as @user in some places
	•	Some pages compute the handle from auth metadata and/or fallback
	•	If you want consistent handles everywhere, add a profiles table later (planned)

⸻

Build (optional)

npm run build
npm start

