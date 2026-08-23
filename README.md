# YT Scraper

A dark-mode Next.js dashboard, authenticated with [Clerk](https://clerk.com), with four tools:

- **Channel Email Scraper** — paste a list of channel URLs/handles/IDs and it fetches each channel's About page, scanning the visible page content for email addresses.
- **Comment Username Scraper** — paste a video link and it collects the usernames of everyone who commented, using YouTube's internal (unofficial) web client API via [`youtubei.js`](https://github.com/LuanRT/YouTube.js). No API key required.
- **Username → Email Validator** — guesses a Gmail address for each username (hyphenated names are truncated at the hyphen, e.g. `cool-guy99` → `cool@gmail.com`) and validates every guess with the [mails.so](https://mails.so) API. You can jump here straight from the Comment Username Scraper.
- **Send Emails** — composes and sends a broadcast over Gmail SMTP (via an app password) to a list of recipients, usually the validated emails from the previous tool.

## Setup

```bash
npm install
cp .env.local.example .env.local
```

1. Create a free application at [dashboard.clerk.com](https://dashboard.clerk.com).
2. Copy its **Publishable key** and **Secret key** (API Keys page) into `.env.local` as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
3. In the Clerk dashboard, enable whichever sign-in methods you want (email/password, Google, GitHub, etc.) under **User & Authentication**.
4. Set `MAILSO_API_KEY` — API key from [mails.so](https://mails.so), used by the Email Validator tool.
5. Create a [Supabase](https://supabase.com) project, then in **Project Settings → API** copy the **Project URL** into `SUPABASE_URL` and the **service_role secret** into `SUPABASE_SERVICE_ROLE_KEY`.
6. Open the Supabase SQL editor and run [`supabase/schema.sql`](supabase/schema.sql) — this creates the `wallets`/`wallet_transactions` tables and the `credit_wallet`/`debit_wallet` functions everything else calls through.
7. Create a [Paystack](https://dashboard.paystack.com) account, grab the **test** keys from **Settings → API Keys & Webhooks**, and set `PAYSTACK_SECRET_KEY` / `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`. Add `<your-domain>/api/webhooks/paystack` as the webhook URL there once you have one (in local dev, use a tunnel like `ngrok` if you want to test webhooks — the deposit flow works without it since the callback page verifies too).
8. Adjust `NEXT_PUBLIC_YOSE_NGN_RATE` once you've settled on a real conversion rate — it's a placeholder for now and shown right under the balance.

Then run:

```bash
npm run dev
```

Visit `http://localhost:3000`, sign up, and use the dashboard. User accounts, password resets, and sessions are all managed through Clerk — there's nothing else to configure there.

## Notes

- The email scraper reads publicly visible page content only (no login, no bypassing any access controls) and skips YouTube/Google infrastructure domains and common false positives. Not every channel lists an email — many don't display one publicly.
- The comment scraper talks to the same internal endpoints YouTube's own web player uses (not the official, quota-limited Data API), so there's no API key or Google Cloud project to set up. Because it's unofficial and undocumented, YouTube can change it without notice, which could break the tool until `youtubei.js` is updated.
- The email guess is just `username@gmail.com` (after stripping anything from a hyphen onward) — most guesses won't be real inboxes, which is exactly why they're run through mails.so validation before you can send to them.
- Sending uses Gmail SMTP via [Nodemailer](https://nodemailer.com/); you'll need a Gmail [App Password](https://myaccount.google.com/apppasswords), not your regular password. The sender address/password are kept in the browser's `localStorage` only, never sent anywhere but your own `/api/send` route.
- Auth, user management, and password resets are handled by Clerk. The dashboard and the `/api/scrape/*`, `/api/send`, and `/api/wallet/*` routes are all gated behind a signed-in session via `proxy.ts`.
- Every user has a wallet, balance in **YOSE** (the platform's own currency — see `lib/pricing.ts`). Deposits go through Paystack (`/dashboard/wallet`); the webhook at `/api/webhooks/paystack` and the post-checkout callback page both verify and credit, so a closed tab won't lose the deposit. All balance math happens in Postgres functions (`supabase/schema.sql`) so it's atomic even under concurrent requests.
- Right now only the Email Validator costs anything (1 YOSE per mails.so lookup, deducted after the batch completes) — the other three tools are free until pricing is decided. Change costs in `lib/pricing.ts`.
