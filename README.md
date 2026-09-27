# Freshers Vote — deploy guide

Real backend: Supabase (Postgres, atomic vote-casting via a SQL function)
and Next.js API routes doing every check server-side (eligibility,
10-minute window, geofence, duplicate vote).

Login has no OTP. A voter is "verified" simply by typing an email that's
already on the eligible-voters list (loaded from `email.txt` — step 2
below). Worth stating plainly: this means whoever types a listed email
first gets that slot — there's no proof the person typing it actually
owns that inbox. If that trade-off isn't acceptable for your event, OTP
can be added back; ask if you want that.

## 1. Create the database (5 min)
1. Go to https://supabase.com → New project (free tier is fine).
2. Once it's up: Project → SQL Editor → New query → paste the entire
   contents of `supabase/schema.sql` → Run.
3. New query again → paste `supabase/storage.sql` → Run (creates the
   `candidate-photos` bucket used by the admin page below).
4. Project → Settings → API: copy the **Project URL** and the
   **service_role** key (not the anon key).

## 2. Load your voter roster (2 min)
1. Make a `.env.local` in the project root with `NEXT_PUBLIC_SUPABASE_URL`
   and `SUPABASE_SERVICE_ROLE_KEY` from step 1.
2. `npm install`
3. Put every eligible voter's email in a plain text file, one per line —
   call it `email.txt`.
4. Run:
   ```
   npm run voters:import -- email.txt
   ```
   This adds each email to the `voters` table as eligible. Re-running it
   later with an updated file is safe — it only adds new emails and never
   touches anyone's `has_voted` status.

## 3. Push this folder to GitHub
```
cd freshers-vote
git init && git add . && git commit -m "init"
gh repo create freshers-vote --private --source=. --push
```
(or drag the folder into a new GitHub repo via the web UI)

## 4. Deploy to Vercel
1. https://vercel.com → New Project → import the repo.
2. Add these Environment Variables (Project → Settings → Environment
   Variables), copying values from steps 1–2:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SESSION_SECRET` — any long random string
   - `ADMIN_SECRET` — any long random string, keep it private
3. Deploy. You'll get a real public link:
   `https://freshers-vote-yourname.vercel.app` — open it on your phone,
   no Claude account or sign-in needed.

## 5. Open the 10-minute voting window
Voting is closed until you open it. From your terminal or Postman:
```
curl -X POST https://your-app.vercel.app/api/admin/open-voting \
  -H "x-admin-secret: <your ADMIN_SECRET>"
```
This sets `voting_start = now()` and `voting_end = now() + 10 minutes`
in the database — every visitor's countdown is driven by that, not by
their device clock. To end it early:
```
curl -X POST https://your-app.vercel.app/api/admin/close-voting \
  -H "x-admin-secret: <your ADMIN_SECRET>"
```

## 6. Add real candidates with photos
Go to `https://your-app.vercel.app/admin`, enter your `ADMIN_SECRET`,
and use the form to add each candidate (name, department, tagline,
photo upload). Photos are stored in the `candidate-photos` Supabase
bucket; "Deactivate" retires a candidate without deleting their past
votes. This replaces the demo candidates from `schema.sql` — deactivate
those once your real ones are in.

## What's real vs. left for you to add
**Real and server-enforced:** eligibility check against the imported
voter roster (`voters` table, loaded via `email.txt`), signed httpOnly
session cookie, the 10-minute window (from the DB, not the browser),
geofence distance (Haversine, computed in the DB from coordinates the
phone reports), one-vote-per-student (DB unique constraint + the
`cast_vote` function running as a single transaction), candidate
management with photo upload via `/admin` (password-gated by
`ADMIN_SECRET`, same one used for open/close voting).

**Deliberately not real:** proof that the person logging in actually
owns the email they typed. There's no OTP, no PIN — list membership is
the only check. See the note at the top of this file.

**Not built yet** (say the word if you want these next):
- Live results / charts, CSV export, turnout stats
- A nicer session-based admin login (right now `/admin` just checks the
  secret on each request rather than issuing a proper session)
- OTP added back on top of the roster, if you decide the trade-off above
  isn't acceptable
