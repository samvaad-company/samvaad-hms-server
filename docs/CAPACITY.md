# How much can it carry? Vercel free + a $6 DigitalOcean droplet

**Short answer.** The $6 droplet (1 vCPU, 1 GiB, 25 GiB) runs **one small hospital comfortably up to about 5,000 patients (≈45,000 records)**,
is **usable with pain to ~20,000 patients (≈180,000 records)**, and **breaks past that** — not because of disk, but because several screens read
whole tables. The Vercel **free (Hobby) plan is the wrong tool**: it is for non-commercial use only, and its 1 million requests a month cover only
about a dozen daily staff. Read the caveats: the numbers are measured on a laptop and *scaled*, not measured on the droplet.

## What was measured (`npm run load`)

The real API, in one Node process, in memory (no network, no database), capped at a ~790 MB heap. One hospital was grown through four sizes —
each patient brings 2 appointments, 2 OPD visits, 3 bills and a lab test spread over 90 days (9 records per patient) — and the actions that matter
were timed (median of 3–5), plus 50 requests (a mix of reads and writes) fired at once. Times in milliseconds, **on a fast laptop**:

| Patients (records) | Register a patient | Check in (token) | Raise a bill | Home dashboard | Analytics | Report: collection | 50 at once |
|---|---|---|---|---|---|---|---|
| 1,000 (9k) | 2 | 3 | 4 | 64 | 125 | 4 | 0.7 s |
| 5,000 (45k) | 7 | 15 | 21 | 324 | 563 | 27 | 3.5 s |
| 20,000 (180k) | 31 | 63 | 89 | 1,370 | 2,377 | 97 | 14.7 s |
| 40,000 (360k) | 68 | 134 | 184 | 2,987 | 6,134 | 201 | 30.5 s |

Paged lists (patients, bills, OPD queue, lab worklist, appointments) stayed at **0–16 ms** at every size. Memory held in the process rose from 36 MB
to 134 MB. No request failed. Nothing here includes the database: with MongoDB the same screens also pay network time to pull rows.

**What the table says.** Anything that *finds the next number* (register, check in, bill — they scan existing numbers) or *summarises* (dashboard,
analytics, reports) grows in step with the data — double the patients, double the time — and, being CPU work in a single Node process, **blocks
every other user while it runs**. That was PERF-001 in [BUGS.md](BUGS.md) (`unpaged: true` is read ~270 times in the services). **After the fixes** the next patient / bill / admission / lab / radiology number and OPD token come from a remembered counter, and the dashboard, overview and analytics are cached per hospital (rebuilt after any change, once per 30 s at most) — so register, check-in, bill and admit no longer grow with the data. The table above was measured *before* that; reports and the remaining scans still do.

## Scaled to the droplet

A DigitalOcean Basic droplet's CPU is burstable, not guaranteed ("suited to bursty applications" — [DigitalOcean pricing](https://www.digitalocean.com/pricing/droplets)),
and slower per core than a laptop. **Assume 4× the times above** (my estimate; measure it with `npm run load` on the droplet — one command). Add
MongoDB round trips on top.

| Patients | A bill | Dashboard | Analytics | Verdict |
|---|---|---|---|---|
| ≤ 1,000 | ~15 ms | ~0.3 s | ~0.5 s | Instant. |
| 5,000 | ~85 ms | ~1.3 s | ~2.3 s | **Comfortable** for ~30–50 staff. A busy morning of dashboard opens is noticeable, not painful. |
| 20,000 | ~360 ms | ~5.5 s | ~9.5 s | **Strained.** Writes slow down; one analytics open freezes everyone for ~10 s. Cache the dashboard first. |
| 40,000 | ~0.7 s | ~12 s | ~25 s | **Not viable.** Also a memory risk (below). |

**Memory.** Node idles around 150–250 MB; Linux, nginx and the OS take ~150 MB; that leaves roughly 500 MB for work. A dashboard at 20,000
patients pulls ~13 tables (~180k rows) through the database driver — several hundred MB at the peak — so **two overlapping dashboards can get the
process killed** at 20k, and one can at 40k. Add a 1–2 GB swap file (a 1 GiB droplet has none by default) and keep `--max-old-space-size` around 600.

**Disk (25 GiB)** is not the limit: 360,000 records is a few hundred MB of data; reports and scans live in Firebase Storage. Mind logs and backups.

**Users at once.** Light actions cost ~1–5 ms of CPU each (×4 on the droplet), so the server can answer on the order of 50–200 of them a second; 50
staff each clicking a few times a minute is nothing. What limits users is **heavy screens**: at 5,000 patients each dashboard open is ~1.3 s of
solid CPU, so ~10 people opening it in the same second means the last waits ~13 s and *everyone's other clicks stall behind them*; at 20,000 the
same crowd stalls the server for over a minute.

### Rough "how long does it last"

| Hospital | Records a year | Reaches 5k patients | Reaches 20k |
|---|---|---|---|
| Clinic, ~40 visits/day | ~25k | ~2 years | ~8 years |
| Small hospital, 150 OPD/day + 10 beds | ~100k | ~6 months | ~2 years |
| Busy hospital, 400 OPD/day + 50 beds | ~300k | within the first quarter | ~8 months |

(Assumes ~30% of OPD visits are first-time patients and ~9 records per patient-visit cycle as measured above.)

## Vercel free (Hobby)

Only the web app goes on Vercel; the API stays on the droplet (`API_URL`). Facts from [Vercel's Hobby plan page](https://vercel.com/docs/plans/hobby):

- **"restricts users to non-commercial, personal use only"** — a hospital's production system is commercial. That alone rules Hobby out beyond a demo or pilot. Pro is **$20 per developer seat / month**.
- Included each month: **1,000,000 CDN requests**, **100 GB Fast Data Transfer**, 10 GB Fast Origin Transfer, 1,000,000 function invocations. Go over and the feature pauses for ~30 days.
- This app sends every `/api/*` call through Vercel (a rewrite to the droplet), so **each API call counts as a CDN request** and its response counts as transfer.

Estimate (assumption — measure with Vercel's usage page): a staff member working a shift makes ~3,000 requests (about 6 a minute) → ~78,000 a month.
**1,000,000 ÷ 78,000 ≈ 12 daily staff** before the plan pauses mid-month; transfer (~30 KB average → ~2.3 GB per staff-month) allows ~40.
So Hobby is fine for a demo to a handful of people, and nothing more. Two other costs of the proxy: a second network hop on every call, and
the dev-only 100 MB upload setting in `next.config.ts` is irrelevant on Vercel — check large audio/document uploads there.

## What to do, in order of payoff

1. **Cache the dashboard and analytics** for 30–60 s per hospital (one line in each service) — removes the biggest CPU spikes.
2. **Stop scanning for the next number**: keep a counter per hospital and series (or use a sequence), instead of reading every existing number (register, check-in, bill, admission…).
3. **Ask the database for the summary** (counts, sums, group-by with an index on `hospital_id` + date) instead of loading tables and filtering in JavaScript — the 278 `unpaged` reads.
4. Put Mongo on the same region/VPC as the droplet; add swap; run the API under a process manager with a memory limit so it restarts rather than hangs.
5. Replace Vercel Hobby by Vercel Pro, or serve the web app from the droplet too (nginx + `next start`), keeping the API on the same origin.
6. Re-run `npm run load` on the droplet after each change. At 2 GB / 2 vCPU the same code roughly doubles each limit above.

## Limits of this study

Measured on one laptop, in memory, one hospital, light seed rows; the real database, network, data shape and the browser's own work are not
included. Request counts for Vercel are estimates. Treat the table as ratios and a first guess — then confirm on the real machine.
