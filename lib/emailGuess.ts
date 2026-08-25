export type EmailCandidate = {
  username: string;
  email: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Guesses a Gmail address from a YouTube username/handle. Hyphenated names
// are truncated at the first hyphen (e.g. "john-doe123" -> "john"), per the
// convention this tool was built around.
export function usernameToGmail(username: string): string | null {
  let base = username.trim().toLowerCase();

  const hyphenIndex = base.indexOf("-");
  if (hyphenIndex !== -1) {
    base = base.slice(0, hyphenIndex);
  }

  base = base.replace(/[^a-z0-9_]/g, "").replace(/^\.+|\.+$/g, "");

  if (!base) return null;
  return `${base}@gmail.com`;
}

// Each line can be either a YouTube username/handle (guessed into a Gmail
// address) or an already-complete email address the caller wants verified
// as-is — pasting your own list of emails shouldn't have them mangled by
// the hyphen-truncation/gmail-only guessing logic meant for usernames.
export function usernamesToEmailCandidates(inputs: string[]): EmailCandidate[] {
  const seen = new Set<string>();
  const candidates: EmailCandidate[] = [];

  for (const raw of inputs) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const isEmail = EMAIL_RE.test(trimmed);
    const email = isEmail ? trimmed.toLowerCase() : usernameToGmail(trimmed);
    if (!email || seen.has(email)) continue;

    seen.add(email);
    candidates.push({ username: isEmail ? trimmed.split("@")[0] : trimmed, email });
  }

  return candidates;
}
