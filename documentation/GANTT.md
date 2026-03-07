# The Queue — Updated Gantt (Planned vs Actual)

**Status date:** End of Week 4  
**Overall progress:** ~70%

## Timeline (Weeks 1–8)

Legend:
- ✅ Done
- 🟨 In progress
- ⬜ Not started
- “Planned” = original schedule
- “Actual” = what happened

---

## Week 1 — Setup + Foundations
**Planned**
- Repo setup + branch workflow
- App shell (routing + layout)
- Theme/branding direction

**Actual**
- ✅ Repo created + structured folders
- ✅ UI theme started (“The Queue” luxury club vibe)
- ✅ Base pages scaffolded (Home/Explore/Profile/Playlist)

---

## Week 2 — Authentication + User Flow
**Planned**
- Supabase setup (project + env vars)
- Sign up / sign in / sign out
- Protected routes for creation

**Actual**
- ✅ Supabase connected
- ✅ Sign up + Sign in working
- ✅ Navbar reflects auth state (Guest vs signed in)
- ✅ Redirect-to-next flow for login

---

## Week 3 — Core Feature: Create Playlist
**Planned**
- New playlist form (title/desc/tags/visibility)
- Cover upload to Supabase Storage
- Redirect to detail page after creation

**Actual**
- ✅ Create playlist working (title/desc/tags/public/private)
- ✅ Cover upload working (Storage bucket fixed + lowercase)
- ✅ Redirect to `/p/[id]` working
- ✅ Playlist detail page renders real playlist

---

## Week 4 — Discovery + Engagement
**Planned**
- Explore page: search, tags, sort
- Playlist detail upgrades
- Likes system (real DB updates)

**Actual**
- ✅ Explore page working (search + tags + sort)
- ✅ Playlist detail upgraded (hero + tags + more by creator)
- ✅ Likes implemented using Supabase tables (updates count)
- 🟨 Handle display consistency (some places still show @user)
- 🟨 Comments still UI stub (not saved yet)

---

## Week 5 — Social Layer + Track Metadata (DJ features)
**Planned**
- Real comments stored in DB
- Add tracks to playlists
- Add DJ metadata fields (BPM, key, energy)

**Actual**
- ⬜ Not started (next)

---

## Week 6 — Profiles + Feed Improvements
**Planned**
- Profile page pulls real playlists
- Home page sections (Tonight’s Picks / Hot / New / Friends)

**Actual**
- 🟨 Partially started (profile scaffold exists)

---

## Week 7 — Polish + Error Handling
**Planned**
- UI polish + responsive cleanup
- Better search suggestions
- Error states + loading skeletons

**Actual**
- ⬜ Not started

---

## Week 8 — Deployment + Final Docs
**Planned**
- Deployment (Vercel)
- Final docs + screenshots + walkthrough

**Actual**
- ⬜ Not started

---

## Completed vs Planned (Week 4 summary)

✅ Completed (by end of Week 4)
- Auth (signup/signin/signout)
- Create playlist + cover upload
- Explore discovery
- Playlist detail page
- Likes system

🟨 In progress
- Handles showing correctly everywhere
- Comments: convert from UI stub → real DB

⬜ Next major milestone (Week 5)
- Tracks + DJ metadata (BPM/key/energy)
- Real comments
