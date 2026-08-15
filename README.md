# YT Scraper

A dark-mode Next.js dashboard with PIN-gated login and two YouTube tools:

- **Channel Email Scraper** — paste a list of channel URLs/handles/IDs and it fetches each channel's About page, scanning the visible page content for email addresses.
- **Comment Username Scraper** — paste a video link and it collects the usernames of everyone who commented, using YouTube's internal (unofficial) web client API via [`youtubei.js`](https://github.com/LuanRT/YouTube.js). No API key required.

## Setup

```bash
npm install
cp .env.local.example .env.local
```

Edit `.env.local`:

- `APP_PIN` — the PIN used to log into the dashboard (default `1234`, change this).
- `SESSION_SECRET` — any long random string, used to sign the login session cookie.

Then run:

```bash
npm run dev
```

Visit `http://localhost:3000`, enter your PIN, and use the dashboard.

## Notes

- The email scraper reads publicly visible page content only (no login, no bypassing any access controls) and skips YouTube/Google infrastructure domains and common false positives. Not every channel lists an email — many don't display one publicly.
- The comment scraper talks to the same internal endpoints YouTube's own web player uses (not the official, quota-limited Data API), so there's no API key or Google Cloud project to set up. Because it's unofficial and undocumented, YouTube can change it without notice, which could break the tool until `youtubei.js` is updated.
- Auth is a single shared PIN suitable for personal/internal use, not multi-user access control.
