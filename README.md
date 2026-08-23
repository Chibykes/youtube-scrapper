# YT Scraper

A dark-mode Next.js dashboard with PIN-gated login and four tools:

- **Channel Email Scraper** — paste a list of channel URLs/handles/IDs and it fetches each channel's About page, scanning the visible page content for email addresses.
- **Comment Username Scraper** — paste a video link and it collects the usernames of everyone who commented, using YouTube's internal (unofficial) web client API via [`youtubei.js`](https://github.com/LuanRT/YouTube.js). No API key required.
- **Username → Email Validator** — guesses a Gmail address for each username (hyphenated names are truncated at the hyphen, e.g. `cool-guy99` → `cool@gmail.com`) and validates every guess with the [mails.so](https://mails.so) API. You can jump here straight from the Comment Username Scraper.
- **Send Emails** — composes and sends a broadcast over Gmail SMTP (via an app password) to a list of recipients, usually the validated emails from the previous tool.

## Setup

```bash
npm install
cp .env.local.example .env.local
```

Edit `.env.local`:

- `APP_PIN` — the PIN used to log into the dashboard (default `1234`, change this).
- `SESSION_SECRET` — any long random string, used to sign the login session cookie.
- `MAILSO_API_KEY` — API key from [mails.so](https://mails.so), used by the Email Validator tool.

Then run:

```bash
npm run dev
```

Visit `http://localhost:3000`, enter your PIN, and use the dashboard.

## Notes

- The email scraper reads publicly visible page content only (no login, no bypassing any access controls) and skips YouTube/Google infrastructure domains and common false positives. Not every channel lists an email — many don't display one publicly.
- The comment scraper talks to the same internal endpoints YouTube's own web player uses (not the official, quota-limited Data API), so there's no API key or Google Cloud project to set up. Because it's unofficial and undocumented, YouTube can change it without notice, which could break the tool until `youtubei.js` is updated.
- The email guess is just `username@gmail.com` (after stripping anything from a hyphen onward) — most guesses won't be real inboxes, which is exactly why they're run through mails.so validation before you can send to them.
- Sending uses Gmail SMTP via [Nodemailer](https://nodemailer.com/); you'll need a Gmail [App Password](https://myaccount.google.com/apppasswords), not your regular password. The sender address/password are kept in the browser's `localStorage` only, never sent anywhere but your own `/api/send` route.
- Auth is a single shared PIN suitable for personal/internal use, not multi-user access control.
