export type EmailCandidate = {
  username: string;
  email: string;
};

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

export function usernamesToEmailCandidates(usernames: string[]): EmailCandidate[] {
  const seen = new Set<string>();
  const candidates: EmailCandidate[] = [];

  for (const username of usernames) {
    const email = usernameToGmail(username);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    candidates.push({ username, email });
  }

  return candidates;
}
