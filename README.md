# Global Threat Forum

Community-written, **moderator-reviewed** analysis of global threats.
Readers can register, draft posts in a rich-text editor (text, images,
embeds), and submit them for review. Nothing goes public until a moderator
approves it. The code is open source so the platform's behaviour is
verifiable.

## Stack

- [React Router v7](https://reactrouter.com/) (framework mode) — server-rendered React on Vite
- [Supabase](https://supabase.com/) — Postgres, Auth, and Storage; all access control enforced by Row Level Security
- [Tiptap](https://tiptap.dev/) — rich-text editor (content stored as JSON, rendered to HTML on the server for SEO)
- Tailwind CSS v4

## How moderation works

Posts move through a status workflow, enforced in the database by RLS —
not just in the UI:

```
draft ──submit──► pending_review ──approve──► published
  ▲                     │
  └──────reject─────────┘  (author sees the moderator's note, can edit & resubmit)
```

- Authors can only create/edit their own `draft`/`pending_review`/`rejected` posts.
- Only admins can set a post to `published` or `rejected`.
- Only `published` posts are visible to the public and open for comments.

## Setup

### 1. Create a Supabase project

Sign up at [supabase.com](https://supabase.com), create a project, and note
your **Project URL** and **anon public key** (Project Settings → API).

### 2. Run the database migration

Open the Supabase **SQL Editor**, paste the contents of
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql),
and run it. (Or use the Supabase CLI: `supabase db push`.)

### 3. Configure the app

```bash
cp .env.example .env   # then fill in SUPABASE_URL and SUPABASE_ANON_KEY
pnpm install
pnpm check             # verifies your keys work AND the migration has run
pnpm dev               # http://localhost:5173
```

### 4. Make yourself an admin

Register an account through the app, then run this in the SQL Editor:

```sql
update public.profiles set role = 'admin' where username = 'your-username';
```

The **Review** tab appears in the nav once you're an admin.

### Recommended for development: disable email confirmation

Supabase requires email confirmation on signup by default, which slows down
testing. For local development, turn it off under
**Authentication → Sign In / Providers → Email → Confirm email** (toggle off).
Turn it back on before going to production.

## Scripts

| Command          | What it does                          |
| ---------------- | ------------------------------------- |
| `pnpm dev`       | Dev server with HMR                   |
| `pnpm build`     | Production build                      |
| `pnpm start`     | Serve the production build            |
| `pnpm typecheck` | Generate route types + run TypeScript |
| `pnpm check`     | Verify Supabase keys + that the migration ran |

## Timestamps & cryptographic provenance

Submission times are **binned** in the author's timezone — daytime rounds to
the hour ("around 3pm"); 8pm–8am becomes "late evening" / "early morning" with
an official time of 8am. Exact instants are never stored, so posting at odd
hours never shows an awkward timestamp.

Posts must be **500–1500 words** and comments **250–750 words** (enforced on
submit, with a live counter while you write).

Each post and comment's content + binned time is hashed (SHA-256) and anchored
to the **Bitcoin blockchain** via [OpenTimestamps](https://opentimestamps.org):

- Daytime submissions are stamped immediately; overnight ones are stamped by a
  daily 8am job (so the proof reads "morning", never the late-night hour).
- Pending proofs are upgraded to confirmed once a Bitcoin block includes them.
- Anyone can **download the `.ots` proof** from a post and verify independently
  — the guarantee doesn't depend on trusting this site.

This needs two extra environment variables and a scheduled job:

| Var | What |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key; used **only** by the cron to bypass RLS when stamping. |
| `CRON_SECRET` | Random string; protects `/api/cron/anchor`. Set the same value in your host. |

The schedule lives in [`vercel.json`](vercel.json) (`0 8 * * *`, daily — fits
Vercel's Hobby plan). On a non-Vercel host, hit `GET /api/cron/anchor` daily
with header `Authorization: Bearer $CRON_SECRET`.

## Deployment

Any Node host works (`pnpm build` then `pnpm start`), and a `Dockerfile` is
included. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
and `CRON_SECRET` in the host's environment. The anon key is safe to expose
publicly — all user-facing authorization is enforced by Postgres RLS, not by
secrecy of the key.

## Security model (for contributors)

- User-facing requests only ever use the **anon key** with the requesting
  user's cookie-bound session, so the app can never do more than the logged-in
  user is allowed to.
- The **service-role key** is used in exactly one place — the `/api/cron/anchor`
  job — which is gated by `CRON_SECRET` and never reachable from a user session.
- All write rules live in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
  as RLS policies; review those first when auditing.
- Users cannot change their own `role` (column-level grant excludes it).
- Post content is stored as Tiptap JSON and rendered through the Tiptap
  schema, which constrains what HTML can appear in a post.
