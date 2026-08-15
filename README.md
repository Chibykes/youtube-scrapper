# YT Scraper

A dark-mode Next.js dashboard with PIN-gated login and two YouTube tools:

- **Channel Email Scraper** — paste a list of channel URLs/handles/IDs and it fetches each channel's About page, scanning the visible page content for email addresses.
- **Comment Username Scraper** — paste a video link and it collects the usernames of everyone who commented, using the official YouTube Data API v3.

## Setup

```bash
npm install
cp .env.local.example .env.local
```

Edit `.env.local`:

- `APP_PIN` — the PIN used to log into the dashboard (default `1234`, change this).
- `SESSION_SECRET` — any long random string, used to sign the login session cookie.
- `YOUTUBE_API_KEY` — a YouTube Data API v3 key (required for the comment scraper only). Create one in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) after enabling "YouTube Data API v3".

Then run:

```bash
npm run dev
```

Visit `http://localhost:3000`, enter your PIN, and use the dashboard.

## Notes

- The email scraper reads publicly visible page content only (no login, no bypassing any access controls) and skips YouTube/Google infrastructure domains and common false positives. Not every channel lists an email — many don't display one publicly.
- The comment scraper uses YouTube's official API, so it respects API quotas (the default free quota is 10,000 units/day; each comment page costs 1 unit).
- Auth is a single shared PIN suitable for personal/internal use, not multi-user access control.
