# That AIn't Right

A daily game: two photos, one real, one AI. Pick the real one. Every time a computer fools you, you lose 100 points. The most negative scores end up on the Wall of Shame.

**Stack:** Next.js 15 (App Router) on Vercel · Supabase (Postgres, auth, storage) · Pexels for real photos · Replicate (FLUX) for fakes · optional Claude for prompts and "tells".

---

## What you need to sign up for

| Service | Why | Cost |
|---|---|---|
| GitHub | Hosts the repo Vercel deploys from | Free |
| [Supabase](https://supabase.com) | Database, logins, image storage | Free tier |
| [Vercel](https://vercel.com) | Hosting and the daily content cron | Free (Hobby) |
| [Pexels API](https://www.pexels.com/api/) | Real photos | Free |
| [Replicate](https://replicate.com) | Generates the AI images | Pay as you go, about $0.015/day with flux-schnell |
| [Anthropic API](https://console.anthropic.com) *(optional)* | Better fakes, and the "here's how you could tell" line | A few cents a month on Haiku |

## 1. Supabase

1. Create a project.
2. **SQL Editor → New query**, paste all of `supabase/schema.sql`, run it.
3. **Authentication → Sign In / Providers**: turn on **Allow anonymous sign-ins** (everyone plays instantly as a guest). Email is on by default.
4. **Authentication → URL Configuration**:
   - Site URL: your Vercel URL (come back and set this after step 4)
   - Redirect URLs: `https://YOUR-APP.vercel.app/**` and `http://localhost:3000/**`
5. **Project Settings → API**: copy the Project URL, `anon` key and `service_role` key.

> Supabase's built-in email sender only allows a few emails per hour. Fine for a demo; add custom SMTP (Resend has a free tier) before sharing widely.

## 2. Run locally

```bash
npm install
cp .env.example .env.local   # fill it in
npm run dev                   # http://localhost:3000
```

## 3. Seed content

Build two weeks of history plus today and tomorrow so the archive has something in it:

```bash
npm run content -- --from 2026-09-13 --days 16
```

Set `NEXT_PUBLIC_LAUNCH_DATE` to the first date you seeded so day numbers start at #1. Each day takes about 20 to 40 seconds; 16 days costs about $0.25 on flux-schnell.

## 4. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. Vercel → **Add New Project** → import the repo.
3. Add every variable from `.env.example` under **Settings → Environment Variables**. For `CRON_SECRET`, use a long random string (`openssl rand -hex 32`).
4. Deploy. Then put the production URL into Supabase's Site URL and Redirect URLs.

The cron in `vercel.json` runs daily at 09:00 UTC and keeps puzzles built `CONTENT_LEAD_DAYS` ahead. It also keeps the free Supabase project from pausing for inactivity.

## 5. Content desk

1. In the app, go to **Me → Keep your shame forever**, add the email listed in `ADMIN_EMAILS`, and confirm it.
2. Open `/admin` to preview upcoming days, swap A/B, regenerate a weak round, publish/unpublish, or build a specific date.

With `AUTO_PUBLISH=true` new days go live on their own. Set it to `false` if you want to approve each day first (you get `CONTENT_LEAD_DAYS` of runway).

---

## How it fits together

```
app/
  page.tsx                  Today (home)
  welcome/                  First-visit rules screen
  play/[date]/              Game → result screens → recap (any past date works)
  archive/                  Calendar of past days
  ranks/                    Friends / Global / Worst %
  shame/                    Wall of Shame (last 7 days)
  me/                       Stats, titles, profile, email upgrade
  friends/, invite/[code]/  Invite links and add-by-phone
  admin/                    Content desk (server actions)
  api/cron/daily-content/   Daily generator
lib/content/                Pipeline: subjects → Pexels → Claude → Replicate → normalize → Supabase
supabase/schema.sql         Tables, RLS and every game rule as SQL functions
scripts/generate.ts         Local CLI for backfilling
```

**Cheating:** clients never see which side is real until they've answered. `get_puzzle` and `submit_answer` are security-definer functions and the tables are locked by RLS. Image file names are random UUIDs, and both images are re-encoded to identical 1200×800 JPEGs with metadata stripped, a small random crop and a random mirror, so format sleuthing and reverse image search are much less useful.

**Accounts:** everyone starts as an anonymous guest with an auto-generated embarrassing name. Adding an email upgrades the same account, so scores carry over. Signing in to an *existing* email from a guest session does not merge the guest's scores.

**Timezone:** the day flips at midnight `America/New_York`. To change it, update `NEXT_PUBLIC_APP_TIMEZONE` *and* `app_today()` in `schema.sql`.

**Copy:** every roast, verdict and shame title is in `lib/copy.ts`.

See `docs/CONTENT_PIPELINE.md` for how the daily content works and what's next (video rounds, difficulty tuning).
