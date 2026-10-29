# WhatsApp setup

What it does:

- **Signing links** — on a consent form, *Send to sign on phone → WhatsApp* sends the patient the link from the hospital's own WhatsApp number (and *Send on WhatsApp* on the "Ready to sign" screen resends it).
- **Chat assistant** — patients write to the hospital's number; it books appointments, lists upcoming appointments and prescriptions, gives a fixed safety message for emergencies, and answers simple questions with AI (Gemini) — never a diagnosis.
- **Setup → WhatsApp** (admins) — connect the number, switch the assistant, set the signing-link template, send a test, see recent messages.

Each hospital connects **its own** number. The ids and access token are stored in the database (`whatsapp_accounts`; MongoDB in dev), the token **encrypted** with a key derived from `SESSION_SECRET` — change that secret and numbers must be reconnected. The token is never sent to the browser.

## 1. Server environment (once, app-wide)

In `server/.env` (see `.env.example`):

| Variable | Where it comes from |
|---|---|
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | developers.facebook.com → your app → App settings → Basic |
| `FACEBOOK_WHATSAPP_CONFIGURATION_ID` | Facebook Login for Business → Configurations (the Embedded Signup configuration) |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | any random string you choose |
| `PUBLIC_APP_URL` | the public address patients open, e.g. `https://app.myhospital.in` — **the signing link in the message is built from it** |
| `WHATSAPP_CLOUD_API_VERSION` | optional, default `v21.0` |
| `GEMINI_API_KEY` | optional — without it the assistant points unknown questions to the hospital instead of answering |

Never commit `.env`. If `FACEBOOK_APP_SECRET` is unset, webhook signatures are not checked (a warning is logged) — set it in production.

## 2. Meta side (only you can do this — needs your Meta login)

1. **App**: developers.facebook.com → Create app → *Business* → add the **WhatsApp** product.
2. **Embedded Signup** (lets each hospital connect with a Facebook popup): Facebook Login for Business → create a configuration for WhatsApp Embedded Signup; copy its ID into `FACEBOOK_WHATSAPP_CONFIGURATION_ID`. Add your site's domain under *Facebook Login → Settings → Allowed domains / Valid OAuth redirect URIs*.
3. **Webhook**: WhatsApp → Configuration → Webhook
   - Callback URL: `https://<public-domain>/api/whatsapp/webhook`
   - Verify token: the value of `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
   - Click **Verify**, then subscribe to the **messages** field.
   The address must be public HTTPS. On a laptop run a tunnel (`ngrok http 3005` or Cloudflare Tunnel) and use its address for both the webhook and `PUBLIC_APP_URL`.
4. **Signing-link template** (needed to message a patient who hasn't written to you in the last 24 hours): WhatsApp Manager → Message templates → create a **Utility** template with a body such as
   `Hello {{1}}, please read and sign "{{2}}" here: {{3}} — {{4}}`
   (variables in this order: patient name, form title, signing link, hospital name; for a template with **named** variables use `patient_name`, `form_title`, `link`, `hospital_name`). Wait for approval, then enter its name under Setup → WhatsApp → *Signing-link template*, choosing numbered or named variables to match how it was created. A mismatch makes Meta answer `(#100) Invalid parameter`; the screen shows Meta's own explanation.
5. For development without Embedded Signup: create a **System User** (Business Settings → Users → System users), assign the app and the WhatsApp account, and generate a permanent token with `whatsapp_business_messaging` and `whatsapp_business_management`. (The 24-hour token on the API Setup page works for a smoke test only.)

## 3. Connect the hospital (admin, in the app)

Setup → **WhatsApp** →

- **Connect with Facebook** — the Embedded Signup popup; on finish the server swaps Meta's code for an access token, subscribes the app to the account, and saves the number. Or
- **Enter details manually** — WhatsApp Business Account ID, Phone number ID and the access token; they are checked with Meta before saving.

Then use **Send a test message**, and put your own number through the assistant.

## 4. What to expect / limits

- WhatsApp only lets a business **start** a conversation with an approved template; free text works only within 24 hours of the patient's last message. Without a template configured, signing links go as plain text and may be refused (the screen says so and the QR code / copy link still work).
- The assistant keeps conversation state in server memory per patient number — fine for one server instance; move it to Redis before running several.
- Patients are matched by the phone number on their record (last 10 digits). Unknown numbers are asked their name and age before booking.
- Bookings go through the doctor's real schedule; two people can't take the same time.
- Delivery reports (sent / delivered / read / failed, with Meta's reason) come back on the same webhook and show under *Recent activity*.
- One WhatsApp number can belong to only one hospital.

## 5. Checks

- `GET /api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=123` → `123`; a wrong token → 403.
- A POST without a valid `X-Hub-Signature-256` → 403.
- `npm run test:whatsapp` (in `server/`) runs all of this against a stubbed Meta — 24 tests.
- Still manual: a real message to your number gets a reply; a real signing link arrives on a phone; Embedded Signup completes. These need your Meta account.
