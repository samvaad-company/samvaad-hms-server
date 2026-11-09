# Prompt: awareness programmes and notifications (patient portal)

> Paste everything below the line into the AI/engineer working on the **patient portal**
> (`patient-portel/samvaad-ai-portel`; `patient-portel-rn` too if it shows these). The HMS side is done: this is the portal half.

---

## What changed in the HMS

Hospitals can now post **awareness programmes**: health camps, webinars, vaccination drives, screenings, talks and campaigns.
When a hospital **publishes** one, the patient should see it in a new **Awareness** section of the portal and as a **notification**.
When a hospital **cancels** a published one, patients see it marked cancelled and get a notification saying so.

A programme is posted for either **all patients on the portal** (any hospital's) or **only the posting hospital's own patients**.
The HMS works that out: you only ever ask "what can *this patient* see", and you only get what they may see.

Do **not** read the HMS database for this. Use the calls below.

## 1. Environment

`HMS_API_BASE_URL` and `PORTAL_API_KEY` (already used for scheduling and video consultations). Every call is from the portal's
**server** (never the browser) with the header `x-portal-key: <PORTAL_API_KEY>`. Responses are `{ "data": … }` or
`{ "error": { "code", "message" } }`; show `message` to the patient as it is.

The calls act for one patient at a time: pass the HMS patient id (`patientId`) of the logged-in patient. You already map portal
users to HMS patient ids for appointments; use the same mapping. If a patient is linked to more than one hospital, call once per
linked patient id and merge by `id`.

Status codes: `400` missing/invalid `patientId`, `401` wrong or missing key, `404` patient or programme not found **or not visible
to this patient**, `503` the HMS has no `PORTAL_API_KEY` set.

## 2. The awareness list

```
GET {HMS}/api/portal/awareness?patientId=12&scope=upcoming&category=Health%20camp&search=diabetes&page=1&pageSize=20
```

All query parameters except `patientId` are optional. `scope`: `upcoming` (upcoming, ongoing and undated), `past`, or `all` (default).
`pageSize` is at most 50. Newest published first.

```json
{ "data": {
  "items": [ {
    "id": 31,
    "title": "Free diabetes screening camp",
    "category": "Health camp",
    "summary": "Free blood sugar and BP checks for everyone this Saturday.",
    "details": "",
    "eventDate": "2026-11-14", "eventTime": "09:30", "endDate": "",
    "mode": "In person",
    "venue": "Main lobby",
    "link": "",
    "contact": "022 4567 8900",
    "image": "https://… or data:image/jpeg;base64,…  or empty string",
    "status": "Published",
    "state": "upcoming",
    "publishedAt": "2026-11-09T06:12:44.000Z",
    "hospital": { "id": 1, "name": "Samvaad Multispecialty Hospital", "city": "Mumbai" },
    "isNew": true
  } ],
  "total": 14, "unread": 3, "page": 1, "pageSize": 20,
  "categories": ["Health camp", "Webinar", "Vaccination drive", "Screening", "Awareness talk", "Campaign", "Other"]
} }
```

- `details` is **empty in the list** (it can be long). Fetch the one programme to get it (section 3).
- `status` is `Published` or `Cancelled`. Show a Cancelled one with a clear "Cancelled" badge and no join/registration button.
- `state` is `upcoming`, `ongoing`, `past`, or `info` (no fixed date). Use it for badges and for the Upcoming / Past tabs.
- `mode` is `In person` or `Online`. For Online, `link` is the joining link; for In person it may be an optional registration link.
  `venue` may be empty. Any of `eventDate`, `eventTime`, `endDate`, `venue`, `link`, `contact`, `image` can be `""`: never print "undefined" or an empty row.
- `image` is either an `https://` link or a `data:image/…;base64,…` URL. Both work as an `<img src>`. Show a neutral placeholder when empty.
- `isNew` is true until this patient opens the programme (or marks its notification read). Show a "New" dot.
- `unread` is how many in the whole result set (not just this page) are still new: use it for the section's badge.
- `categories` is the full list for a filter control; send one back as `category`.

## 3. One programme

```
GET {HMS}/api/portal/awareness/31?patientId=12
→ { data: { …the same fields as above, with "details": "Come fasting. Reports the same day." and "isNew": true } }
```

`details` is plain text with line breaks: render it with `white-space: pre-wrap` and escape it (do **not** inject it as HTML).
**Calling this marks the programme read for that patient** (so `isNew` is `true` only on the very first open, then `false`), and clears it from
the notifications' unread count. Call it when the patient opens the detail screen, not while merely listing.

Detail screen: title, hospital name and city, category chip, date/time (with the end date if set), venue or "Online", the picture,
the details, a **Join** or **Register** button when `link` is set (open in a new tab/browser with `rel="noopener noreferrer"`; only
open `http(s)` links), and a tap-to-call/mail for `contact`.

## 4. Notifications (the bell)

```
GET {HMS}/api/portal/notifications?patientId=12
→ { data: { unread: 2, items: [ {
    "id": 31,
    "kind": "awareness_published",
    "title": "Free diabetes screening camp",
    "body": "Samvaad Multispecialty Hospital: Free blood sugar and BP checks for everyone this Saturday.",
    "eventId": 31,
    "hospitalName": "Samvaad Multispecialty Hospital",
    "category": "Health camp",
    "createdAt": "2026-11-09T06:12:44.000Z",
    "read": false
} ] } }
```

- One notification per programme: new posts (`awareness_published`) and cancellations (`awareness_cancelled`, whose `title` already starts
  with "Cancelled: "), covering the **last 45 days**, newest first, at most 50.
- Tapping one opens that programme: `GET /api/portal/awareness/{eventId}?patientId=…` (which also marks it read).
- **Merge these with the portal's own notifications** in the bell: add `items` into your existing list (sort by `createdAt`) and add
  `unread` to your own unread count. Give them the megaphone icon.
- Mark read without opening (e.g. "Mark all as read"):

```
POST {HMS}/api/portal/notifications/read
{ "patientId": 12, "ids": [31, 32] }        or        { "patientId": 12, "all": true }
→ { data: { unread, items } }                 // the fresh list
```

`ids` are programme ids (`eventId`). Ids the patient can't see are ignored.

## 5. Getting new posts to the patient quickly

Two ways, use both.

**a) Poll.** Refresh `GET /api/portal/notifications` for the signed-in patient when the app opens, when it returns to the foreground,
and about **every 60 seconds** while open (a web worker or a `setInterval`; keep it cheap, the call is light). That alone is enough
for a working feature.

**b) Webhook (push).** The HMS can tell the portal the moment a hospital publishes or cancels. Add a server route that accepts
`POST`, and give its full public URL to the HMS team to set as `PORTAL_WEBHOOK_URL` on the HMS server. Then, on each event, send the
push/FCM notification to the right patients and update any cache.

Headers: `x-hms-event: awareness.published | awareness.cancelled` and `x-hms-signature: sha256=<hex>`, where `<hex>` is the
**HMAC-SHA256 of the raw request body, keyed with `PORTAL_API_KEY`**. **Verify it before doing anything**, comparing in constant time,
and reject (401) a body that doesn't match. Use the raw body bytes, not re-serialised JSON.

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export async function POST(req: Request) {
  const raw = await req.text();
  const got = (req.headers.get("x-hms-signature") ?? "").replace(/^sha256=/, "");
  const want = createHmac("sha256", process.env.PORTAL_API_KEY!).update(raw).digest("hex");
  const a = Buffer.from(got), b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return new Response("bad signature", { status: 401 });

  const event = JSON.parse(raw) as {
    type: "awareness.published" | "awareness.cancelled";
    occurredAt: string;
    awareness: {
      id: number; title: string; category: string; summary: string; details: string;
      eventDate: string; eventTime: string; endDate: string; mode: string; venue: string; link: string; contact: string; image: string;
      status: "Published" | "Cancelled"; state: string; publishedAt: string;
      hospital: { id: number; name: string; city: string };
      audience: "all" | "hospital";   // who it was posted for
      hospitalId: number;
    };
  };
  // audience "all": every patient of the portal.  audience "hospital": only patients of awareness.hospitalId.
  // Fan out your push notification accordingly, then return 200 quickly.
  return new Response("ok");
}
```

Respond `2xx` within a few seconds. The HMS does **not** retry, and a failed webhook never blocks the hospital, so polling (a) is what
guarantees nothing is missed. The webhook is for speed only; make handling it idempotent (the same `awareness.id` and type may arrive
again if a hospital re-publishes). The payload carries `details` and `audience`; the polling calls never include `audience` (they
already filter for you).

## 6. The Awareness section (screens)

- A new entry in the portal's navigation: **Awareness** (megaphone icon) with the `unread` badge.
- **List**: tabs **Upcoming** (`scope=upcoming`) and **Past** (`scope=past`), a category filter built from `categories`, a search box
  (`search`), cards with the picture, title, hospital name, category chip, date/time and place (or "Online"), the `summary`, and a
  **New** dot where `isNew`. Infinite scroll or "Load more" with `page`. Empty state: "No awareness programmes right now."
- **Detail**: as described in section 3. Back goes to the list, which should refresh `isNew`/`unread`.
- Cancelled programmes stay in the list (greyed, "Cancelled") so a patient who saw one earlier understands what happened.
- Mobile first. Dates are `YYYY-MM-DD`, times `HH:mm` (24-hour), in the hospital's local time; format them for the patient's locale.
  `publishedAt`/`createdAt` are ISO timestamps in UTC.

## 7. Checklist

1. `portalAwareness` API helper: list, get, notifications, markRead, with the `x-portal-key` header, server side only.
2. Awareness list and detail screens (web and RN if used); navigation entry with unread badge.
3. Merge awareness notifications into the existing bell; opening one goes to the programme.
4. Poll every ~60 s and on foreground.
5. Webhook route with signature verification and push fan-out; tell the HMS team its URL for `PORTAL_WEBHOOK_URL`.
6. Never render `details`, `title` or `summary` as HTML; only open `http(s)` links.
7. Try it: ask a hospital admin to post one (HMS → Awareness → New programme → Publish to patients) and confirm it appears in the list, the
   bell and, with the webhook on, as a push within seconds; then cancel it and confirm the Cancelled state and notification.

### Quick manual test (curl)

```bash
curl -H "x-portal-key: $PORTAL_API_KEY" "$HMS_API_BASE_URL/api/portal/awareness?patientId=12"
curl -H "x-portal-key: $PORTAL_API_KEY" "$HMS_API_BASE_URL/api/portal/notifications?patientId=12"
curl -X POST -H "x-portal-key: $PORTAL_API_KEY" -H "content-type: application/json" \
     -d '{"patientId":12,"all":true}' "$HMS_API_BASE_URL/api/portal/notifications/read"
```
