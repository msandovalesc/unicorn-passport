# Unicorn Passport

Unosquare's event loyalty program. Employees keep a digital stamp card in Apple Wallet, Google Wallet or on the web. Every company event they attend earns a stamp, and reward tiers unlock Unosquare merch.

> **Add it, Scan it, Stack it, Claim it.**

The web app is the single source of truth. Wallet cards only display the current state. Stamp counts are always calculated from the `stamps` table.

## Status

| Milestone | Scope | State |
|---|---|---|
| 1. Foundation | Next.js app, data model and seed, Microsoft 365 sign-in, enrollment, web card, brand styling, unicorn stamp images | ✅ Done |
| 2. Core loop | Rotating event QR, check-in rules and tests, typed code for virtual events, reward unlocking, celebration screen | ✅ Done |
| 3. Wallets | Apple Wallet (.pkpass, PassKit web service, APNs), Google Wallet (loyalty class/objects, save link, updates) | Next |
| 4. Admin | Events, live attendance, manual stamps, employee search, redeem by card scan | ✅ Done |
| 5. Polish | Tier editor ✅, CSV reports ✅, dashboard metrics ✅, design refinements and pilot feedback | In progress |

## Stack

- **Next.js 15 (App Router) + TypeScript**: one mobile-first app serving pages and API
- **PostgreSQL + Prisma**
- **Auth.js** with **Microsoft Entra ID** (single tenant, Unosquare accounts only)
- **sharp** pre-renders the wallet stamp images, **qrcode** draws the card QR
- **Vitest** for tests
- Target hosting: **Azure App Service (Linux)**, **Azure Database for PostgreSQL Flexible Server**, **Azure Key Vault**

## Run it locally

Requirements: Node.js 20+. Docker isn't needed.

```bash
npm install
cp .env.example .env          # then set AUTH_SECRET (any long random string)
npm run db:local              # terminal 1: starts Postgres on port 5433, leave it running
npx prisma migrate dev        # terminal 2: creates the tables
npm run db:seed               # sample employees, events, tiers, stamps
npm run dev                   # http://localhost:3000
```

With `DEV_LOGIN=true` (local only, ignored in production), the sign-in page lists the seed users so you can test without Entra ID:

| Seed user | Shows |
|---|---|
| Ana Admin | Admin access (`DEV_ADMIN_EMAILS`), 3 stamps |
| Bruno Rookie | Fresh card, 0 stamps |
| Carla Regular | Remote track, 4 stamps |
| Diego Fivestar | 5 stamps, first reward pending |
| Elena Complete | 10/10, both rewards pending |
| Fer Secondcard | Card #2 (12 stamps), first card's rewards already redeemed |
| Gabo Newbie | Not enrolled yet: goes through the Office/Remote choice |

The seed also creates about 45 generated employees with 12 weeks of realistic attendance. They don't appear in the dev login list. They're there so the admin dashboard, reports and rewards queue have data.

Other commands:

```bash
npm test                 # unit tests
npm run lint             # type-check
npm run db:reset         # drop, migrate and re-seed
npm run assets:stamps    # re-render wallet stamp strips, logos and icons
```

## How the card works

- A card has **10 slots** (2 rows of 5). When it's full it shows 10/10, and the next stamp starts card #2 at 1/10.
- **Reward tracks:** each employee picks *Office* or *Remote* at sign-up. Each track has its own tiers (stamp count → merch item), so Remote can unlock prizes earlier. Admins can edit tiers without a deploy. The seed data uses 5 and 10 stamps for both tracks.
- Rewards are created automatically when a tier is reached and are tied to a card number, so they can be earned again on every card.
- The card QR holds an opaque token (`/r/<token>`). It never contains the email or employee ID. Only admins can open it.

## How check-in works

1. The host opens **Admin → Events → Show QR** for an event whose check-in window is open. The screen shows a QR that **changes every 60 seconds**, a countdown and the live check-in count. For virtual events it also shows a **6-character code**, which changes with the QR.
2. The employee scans the QR with the phone camera. It opens `/c/<token>`. The token is `eventId.window.signature`, signed with the event's `qr_secret`. Only the **current and previous** tokens are accepted, so a forwarded photo stops working within 1–2 minutes.
3. A valid scan gives that browser a **15-minute check-in pass** (an httpOnly cookie, so it can't be shared as a link). This is so the stamp isn't lost if Microsoft sign-in takes longer than the QR's lifetime. New employees choose their track, then go straight back to the check-in.
4. The stamp is saved if the event's check-in window is still open. The database's unique key allows **one stamp per employee per event**. Rewards for any tier reached are created in the same transaction.
5. The employee sees the celebration screen: the new unicorn pops into its slot, and a "Reward unlocked" panel appears with a **Claim reward** button. Then the wallet card update is triggered (Milestone 3 sends the actual Apple/Google push).

Single-device users at a virtual event go to **Check in** (`/checkin`) and type the code.

**Anti-abuse rules:**
- Sign-in is always required.
- Tokens are signed and rotate every minute.
- Stamps are only accepted inside the check-in window, and admins can close an event early.
- One stamp per event, enforced by a unique key.
- A per-employee database lock means two simultaneous stamps can't skip a reward.
- Rate limits, stored in Postgres so they hold across servers:
  - 120 scans/min per IP
  - 20 check-ins/min per employee
  - 6 typed-code attempts per 5 min per employee

**Tests:** `npm test` runs the rules (token rotation, codes, check-in window, pass) and an end-to-end suite against a real test database (`TEST_DATABASE_URL`). That suite covers one stamp per event under 8 simultaneous scans, tier unlocks on card #1 and card #2, typed codes, enrollment and manual stamps. Start `npm run db:local` first, or the database tests are skipped with a notice.

## Admin area (`/admin`, Entra admin role or group only)

| Page | What admins do there |
|---|---|
| **Overview** | Key numbers: cards issued, wallet passes, active cards, check-ins in the last 30 days vs the 30 before, average attendance, and rewards to hand out. A **weekly check-in trend** chart (in person vs virtual, with hover details and a table view). Attendance for recent events, plus live and upcoming events. |
| **Events** | Create and edit events. Times are entered in your local time zone. By default check-in opens 30 min before the start and closes 1 hour after the end. Close check-in early, reopen it, or delete an event nobody checked in to. Each event page has a **live attendance list and count** (refreshes every 10 seconds while check-in is open), a breakdown by QR scan, typed code or manual stamp, **manual stamps** with a note, a CSV download and **Show QR**. |
| **Employees** | Search by name, email or location, and filter by track. Each person's page shows their card, stamps, rewards and wallet status. From there admins can change their track, add a manual stamp for a past event, and mark rewards redeemed (with undo). |
| **Rewards** | A count of each merch item to prepare. The queue of rewards waiting to be handed out (oldest first) with **Mark redeemed**. Recently handed out rewards, with undo. **Scan a card** with the laptop or phone camera; scanning a card QR with any phone camera also opens the employee page. |
| **Tiers** | For each track (e.g. Office, Remote), choose which stamps (1–10) unlock which merch. Rename tracks and add new ones. Changes apply to future stamps; rewards already unlocked keep their item. |
| **Reports** | CSV downloads for attendance, rewards and employees. Attendance and rewards can be filtered by date. Files open in Excel with accents intact, and values that look like spreadsheet formulas are made safe. |

Every admin action re-checks admin rights on the server. Manual stamps record who added them, and redemptions record who handed the reward out.

## Project layout

```
prisma/              schema.prisma, migrations, seed.ts
assets/brand         official unosquare logos (from the Visual Identity System)
scripts/             local-db.ts, render-stamp-strips.ts
public/wallet        pre-rendered strip (Apple) and hero (Google) images 0–10, logos, icons
public/brand         unicorn SVGs (filled + outline), non-overlapping background tile, logo colourways
assets/unicorn       source artwork as supplied (outline PNG is vectorized by scripts/vectorize-outline.ts)
src/app              pages: / (home), /signin, /join, /card, /admin, /r/[token]
src/lib              progress (card maths), card, authRules, session, unicorn, stampStrip
src/components       PassCard, StampGrid, UnicornPattern, WalletButtons, Logo
tests/               Vitest specs
```

## Brand rules applied

From the Unosquare Visual Identity System:

- Blue 500 `#0522DE` is primary. Yellow `#FFD200` is used only on action buttons, always with dark text.
- Backgrounds are dark `#191919` or light `#F6F5F1`. The font is Inter. Spacing follows the 8px grid.
- Unicorn stamps:
  - Blue unicorn on light circles for the wallet card and blue screens.
  - Light unicorn on blue circles for light screens.
  - Empty slots are outlined circles.
- The scattered-unicorn texture only appears on dark/blue screens and never behind forms, tables or long text.

---

# Setting up the external accounts

## 1. Microsoft Entra ID (sign-in and admin group)

Ask an Entra ID admin to do the following:

1. **Entra admin center → App registrations → New registration**
   - Name: `Unicorn Passport`
   - Supported account types: **Accounts in this organizational directory only (single tenant)**
   - Redirect URI (Web): `https://<your-domain>/api/auth/callback/microsoft-entra-id`. Add `http://localhost:3000/api/auth/callback/microsoft-entra-id` for local testing.
2. **Certificates & secrets → New client secret.** Copy the value into `AUTH_MICROSOFT_ENTRA_ID_SECRET`.
3. From **Overview**, copy the *Application (client) ID* into `AUTH_MICROSOFT_ENTRA_ID_ID` and the *Directory (tenant) ID* into `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID`.
4. **Token configuration → Add optional claim → ID token → `email`**.
5. **Admin access (recommended: app role):**
   - **App roles → Create app role.** Display name `Passport Admin`, value `Passport.Admin`, allowed member types *Users/Groups*.
   - Create a security group, e.g. `Unicorn Passport Admins`, and add the events and merch team.
   - **Enterprise applications → Unicorn Passport → Users and groups → Add assignment:** the group, with role *Passport Admin*.
   - Keep `ADMIN_APP_ROLE=Passport.Admin`.
   - *Alternative:* emit the `groups` claim (Token configuration → Add groups claim → Security groups) and set `ADMIN_GROUP_ID` to the group's object ID. App roles are preferred because the groups claim is dropped for users in more than 200 groups.
6. Admin rights are re-checked at least every 12 hours: admins are asked to sign in again.

Sign-in is limited to the Unosquare tenant **and** to emails in `ALLOWED_EMAIL_DOMAINS`, so guest accounts in the directory are rejected.

## 2. Azure hosting (what to ask IT for)

| Resource | Suggested setting |
|---|---|
| **App Service plan + Web App** | Linux, Node 20 LTS, B1 or larger for the pilot. HTTPS only, *Always On*. |
| **Custom domain + TLS** | e.g. `passport.unosquare.com`. It **must be reachable from the public internet over HTTPS**, because Apple and Google servers call the app to register devices, download updated passes and load card images. |
| **Azure Database for PostgreSQL – Flexible Server** | Burstable B1ms is enough for the pilot. Create a database `unicorn_passport`, require SSL, and allow access from the Web App (VNet integration or firewall rule). |
| **Key Vault** | Stores the Apple certificates and keys, the Google service-account key, the Entra client secret and `AUTH_SECRET`. Reference them from App Settings with `@Microsoft.KeyVault(...)` through the Web App's managed identity. |
| **Application Insights** | Optional, for logs and errors. |

Deploy with GitHub Actions or Azure DevOps:

```bash
npm ci
npm run build
npm run db:deploy
```

The build produces `.next/standalone` (`output: "standalone"`). Set every variable from `.env.example` as an App Setting, with `APP_URL` set to the public domain and `DEV_LOGIN` left unset.

## 3. Google Wallet (Milestone 3)

1. Sign up at the [Google Pay & Wallet Console](https://pay.google.com/business/console) with a Unosquare Google account and request **Google Wallet API** issuer access. Copy the **Issuer ID** into `GOOGLE_WALLET_ISSUER_ID`.
2. In Google Cloud: create a project, enable the **Google Wallet API**, create a **service account** and download a JSON key. Put `client_email` in `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `private_key` in `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`.
3. In the Wallet Console, under **Users**, invite the service account email as a *Developer*.
4. Passes work right away for test accounts. Request **publishing access** in the console before the company-wide launch.

## 4. Apple Wallet (Milestone 3)

Needs an Apple Developer **organization** account for Unosquare.

1. **Certificates, IDs & Profiles → Identifiers → Pass Type IDs → +**, e.g. `pass.com.unosquare.unicornpassport` → `APPLE_PASS_TYPE_ID`. The Team ID goes in `APPLE_TEAM_ID`.
2. Create a **Pass Type ID certificate** for it, export the certificate and key as PEM, and put them in `APPLE_PASS_CERT_PEM` and `APPLE_PASS_KEY_PEM` (plus `APPLE_PASS_KEY_PASSPHRASE` if the key has one).
3. Download the **Apple WWDR G4** intermediate certificate (PEM) → `APPLE_WWDR_CERT_PEM`.
4. **Keys → +**, enable **Apple Push Notifications service (APNs)**, and download the `.p8` key → `APPLE_APNS_KEY_P8`. Its Key ID goes in `APPLE_APNS_KEY_ID`.
5. Apple devices call `https://<domain>/api/passkit/v1/...`, so the app must be on public HTTPS. For testing on a real iPhone before Azure is ready, use a tunnel (e.g. `devtunnel` or `ngrok`) and set `APP_URL` to it.

---

## Decisions and assumptions to confirm

1. **Device registrations table.** The brief put `push_token` on `passes`. One Apple pass can be installed on several devices (iPhone + Apple Watch), so registrations live in `pass_registrations` (pass, device, push token).
2. **`card_token` on passes.** The opaque value inside the card QR. Every enrolled employee gets a `web` pass row, so the QR works without a wallet.
3. **Rewards keep the item name** at unlock time (`rewards.item`), so later tier edits don't change history. Rewards also store `card_number`.
4. **`stamps.method` has a third value, `code`**, for the typed code at virtual events. `stamps.added_by` records the admin behind manual stamps.
5. **Events have `closed_at`**, so admins can close check-in early.
6. **Location** is optional free text entered at sign-up. It isn't read from Entra, which needs an extra Graph permission.
7. **Sessions last 60 days** on the phone, so scanning an event QR stamps instantly. Admin rights are re-checked every 12 hours.
8. **Official logo:** the imagotype comes from the Visual Identity System site, and its ® is kept. The unicorn SVG supplied has no ® mark, so it is used exactly as drawn, horn included. The background is one pre-rendered tile (`public/brand/unicorn-pattern.svg`) where no unicorns overlap; a designer-made SVG tile can replace it. The unicorn mane uses Blue 200/300 so it stays visible on both circle colors.
9. **Placeholder tiers:** 5 stamps and 10 stamps, with placeholder merch names. Real items can be set in the admin page (Milestone 5) or in `prisma/seed.ts`.
10. **Check-in pass lasts 15 minutes** after a valid scan, to cover the sign-in time. The check-in window is still checked when the stamp is saved.
11. **Typed codes work only for virtual events** and rotate every minute with the QR, accepting the current and previous code. If people find this too fast for typing, it can be changed to a longer window.
12. **The event QR display is admin-only.** If hosts aren't admins, we could add a "host" role or a per-event host link in Milestone 4.
13. **Rate limits** use a small `rate_limits` table in Postgres instead of Redis.
