const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24}/g;

// YouTube sometimes squashes description text into a single meta tag with no
// separator between an email and the text that follows it (e.g. a location),
// producing garbage like "business@channel.comNYC". Since the regex above is
// greedy, it swallows the trailing letters as part of the TLD. Trim back to
// the longest known TLD prefix so "comnyc" becomes "com".
const KNOWN_TLDS = new Set([
  "com", "net", "org", "io", "co", "gov", "edu", "info", "biz", "me", "tv",
  "xyz", "app", "dev", "ai", "us", "uk", "ca", "de", "fr", "jp", "in", "au",
  "nl", "se", "no", "es", "it", "ru", "br", "mx", "ch", "nz", "ie", "za",
  "sg", "hk", "kr", "cn", "pl", "be", "at", "dk", "fi", "pt", "gr", "cz",
  "hu", "ro", "tr", "il", "ae", "sa", "id", "my", "ph", "vn", "th", "pk",
  "ng", "ke", "eg", "name", "pro", "mobi", "tech", "store", "online", "site",
  "website", "club", "live", "world", "media", "studio", "agency", "group",
  "company", "network", "solutions", "email", "cloud", "gg", "tw",
]);

function trimToKnownTld(email: string): string {
  const at = email.lastIndexOf("@");
  if (at === -1) return email;
  const domain = email.slice(at + 1);
  const lastDot = domain.lastIndexOf(".");
  if (lastDot === -1) return email;

  const tail = domain.slice(lastDot + 1);
  for (let len = Math.min(tail.length, 24); len >= 2; len--) {
    const candidate = tail.slice(0, len).toLowerCase();
    if (KNOWN_TLDS.has(candidate)) {
      return email.slice(0, at + 1 + lastDot + 1 + len);
    }
  }
  return email;
}

const DOMAIN_BLOCKLIST = [
  "example.com",
  "sentry.io",
  "sentry-cdn.com",
  "schema.org",
  "w3.org",
  "google.com",
  "googleapis.com",
  "googleusercontent.com",
  "gstatic.com",
  "ggpht.com",
  "youtube.com",
  "google-analytics.com",
  "doubleclick.net",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "webp",
  "css",
  "js",
];

export function normalizeChannelInput(raw: string): string | null {
  let input = raw.trim();
  if (!input) return null;

  if (!/^https?:\/\//i.test(input)) {
    if (input.startsWith("@")) {
      input = `https://www.youtube.com/${input}`;
    } else if (/^UC[\w-]{22}$/.test(input)) {
      input = `https://www.youtube.com/channel/${input}`;
    } else {
      input = `https://www.youtube.com/@${input.replace(/^\/+/, "")}`;
    }
  }

  try {
    const url = new URL(input);
    if (!/(^|\.)youtube\.com$/i.test(url.hostname)) return null;
    url.search = "";
    url.hash = "";
    let pathname = url.pathname.replace(/\/+$/, "");
    if (!/\/about$/.test(pathname)) {
      pathname = `${pathname}/about`;
    }
    url.pathname = pathname;
    return url.toString();
  } catch {
    return null;
  }
}

export function displayNameFromInput(raw: string): string {
  return raw.trim();
}

export function extractEmails(html: string): string[] {
  // Literal JSON-escaped whitespace (\n, \r, \t) inside embedded <script>
  // blobs is real backslash+letter text, not whitespace, so it silently
  // glues onto an adjacent word (e.g. "...\n\nbusiness@x.com" becomes a
  // match starting at "nbusiness@..."). Turn it back into real whitespace
  // before matching so word boundaries behave as expected.
  const normalized = html.replace(/\\[nrt]/g, " ");
  const matches = normalized.match(EMAIL_REGEX) ?? [];
  const seen = new Set<string>();
  const results: string[] = [];

  for (const match of matches) {
    const email = trimToKnownTld(match.replace(/\.$/, "")).toLowerCase();
    const domain = email.split("@")[1] ?? "";
    const domainRoot = domain.split(".").slice(-2).join(".");
    const ext = domain.split(".").pop() ?? "";

    if (DOMAIN_BLOCKLIST.includes(domain)) continue;
    if (DOMAIN_BLOCKLIST.includes(domainRoot)) continue;
    if (DOMAIN_BLOCKLIST.includes(ext)) continue;
    if (seen.has(email)) continue;

    seen.add(email);
    results.push(email);
  }

  return results;
}

export function extractChannelTitle(html: string): string | null {
  const match = html.match(/<meta property="og:title" content="([^"]*)"/i);
  if (!match) return null;
  return match[1]
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();

  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.replace("/", "") || null;
    }
    if (url.hostname.includes("youtube.com")) {
      if (url.pathname === "/watch") {
        return url.searchParams.get("v");
      }
      const shortsMatch = url.pathname.match(/\/shorts\/([\w-]{11})/);
      if (shortsMatch) return shortsMatch[1];
      const embedMatch = url.pathname.match(/\/embed\/([\w-]{11})/);
      if (embedMatch) return embedMatch[1];
      const liveMatch = url.pathname.match(/\/live\/([\w-]{11})/);
      if (liveMatch) return liveMatch[1];
    }
  } catch {
    return null;
  }

  return null;
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}
