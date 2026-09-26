# Daily content pipeline

## Phase 1: photos (built)

For each of the 5 daily rounds:

1. **Pick a subject** from `lib/content/subjects.ts` (about 90 queries across Pets, Wildlife, Food, Landscapes, Architecture, Objects, Streets and Plants). One per category where possible; nothing used in the last 60 days.
2. **Fetch a real photo** from Pexels (landscape, never reused).
3. **Write a look-alike prompt.** With `ANTHROPIC_API_KEY` set, Claude looks at the real photo and writes a prompt for a *different* photo of the same kind of scene, with the same lighting and phone-camera feel. Without it, the Pexels alt text is used.
4. **Generate the fake** on Replicate (`REPLICATE_IMAGE_MODEL`, 3:2, JPEG).
5. **Find the tell.** Claude compares the two and writes one sentence on what gives the fake away. This is the line on the "Fooled" screen. Without Claude, a generic tip is used.
6. **Normalize both** to identical 1200×800 JPEGs: metadata stripped, small random crop, random mirror.
7. **Upload** under random names, randomize which side is real, save.

If any step fails for a subject, the worker moves on to a spare subject. The whole day is built in parallel, usually in 20 to 40 seconds, which fits Vercel's 60-second function limit.

**Where it runs**
- Daily: Vercel cron → `/api/cron/daily-content` builds the next missing day within `CONTENT_LEAD_DAYS`.
- On demand: `/admin` → Build a day, or regenerate one round.
- Bulk: `npm run content -- --from YYYY-MM-DD --days N`.

**Costs (5 rounds a day)**

| Model | Per image | Per month |
|---|---|---|
| `black-forest-labs/flux-schnell` | ~$0.003 | ~$0.50 |
| `black-forest-labs/flux-1.1-pro` | ~$0.04 | ~$6 |

Claude Haiku adds a few cents a month. Pexels is free (200 requests an hour, 20,000 a month; the pipeline uses about 10 a day).

**Tuning difficulty**
- Swap to a stronger model for harder fakes. flux-schnell is easy mode; flux-1.1-pro fools far more people.
- Every round stores its model and prompt, and `answers` records who got fooled, so you can see which categories and models fool people most:

```sql
select r.category, r.ai_model, round(100 * avg((not a.correct)::int)) as fool_pct, count(*)
from answers a join rounds r on r.id = a.round_id
group by 1, 2 order by fool_pct desc;
```

**Licensing:** Pexels photos are free to use and modify with no attribution required (the game credits the photographer anyway). Avoid Unsplash for this: its API terms require hotlinking their CDN, which conflicts with re-encoding the images.

## Phase 2: video rounds (planned)

The schema and game UI already support `media_type = 'video'` (autoplaying muted loops).

1. Real clip: Pexels Videos API (`/videos/search`), a 5 to 8 second landscape clip.
2. Fake clip: a Replicate video model (Kling, Wan, Veo, etc.), seeded from a frame of the real clip plus a Claude-written prompt.
3. Normalize both with ffmpeg: same resolution, frame rate, codec and length, no audio, metadata stripped.
4. Video generation takes 1 to 5 minutes, so it won't fit a 60-second Vercel function. Run it from a scheduled GitHub Actions workflow calling `scripts/generate.ts`, or use Replicate webhooks.

Expect roughly $0.25 to $1 per clip, so one video round a day is about $8 to $30 a month. Starting with one video round every few days keeps it cheap.

## Phase 3 (ideas)

- **Auto difficulty:** after a day closes, record each round's fool rate and bias future subject and model choices toward whatever fools 40 to 60% of players.
- **Themed days:** Food Friday, pets-only weekends.
- **Community pairs:** players submit a real photo, the pipeline generates the fake, and the submitter gets credited on that day.
