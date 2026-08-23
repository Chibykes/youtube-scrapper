import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import Logo from "@/components/Logo";

const features = [
  {
    index: "01",
    title: "Channel Email Scraper",
    description:
      "Paste a list of channel URLs or handles and pull any email addresses listed on their About page.",
  },
  {
    index: "02",
    title: "Comment Username Scraper",
    description:
      "Paste a video link and collect the usernames of everyone who commented — no API key required.",
  },
  {
    index: "03",
    title: "Username → Email Validator",
    description:
      "Guess a Gmail address for each username and validate every guess before it ever reaches your send list.",
  },
  {
    index: "04",
    title: "Send Emails",
    description:
      "Compose a message and send it over your own Gmail SMTP to the validated recipients, in safe batches.",
  },
];

const commands = [
  { cmd: "scrape channels --input list.txt", out: "→ 214 emails found across 38 channels" },
  { cmd: "scrape comments --video <url>", out: "→ 1,842 usernames collected" },
  { cmd: "validate --source usernames.csv", out: "→ 611 addresses confirmed deliverable" },
  { cmd: "send --list validated.csv --from you@gmail.com", out: "→ sent in 7 batches, 0 bounces" },
];

export default async function Home() {
  const { userId } = await auth();
  const isAuthed = !!userId;
  const primaryHref = isAuthed ? "/dashboard" : "/signup";
  const primaryLabel = isAuthed ? "Go to dashboard" : "Get started";

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Logo />
          <nav className="hidden items-center gap-8 text-xs uppercase tracking-wider text-muted sm:flex">
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-foreground">
              How it works
            </a>
          </nav>
          <div className="flex items-center gap-5">
            {isAuthed ? (
              <Link
                href="/dashboard"
                className="border border-foreground bg-foreground px-4 py-2 text-xs uppercase tracking-wider text-background transition-colors hover:bg-transparent hover:text-foreground"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-xs uppercase tracking-wider text-muted transition-colors hover:text-foreground"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="border border-foreground bg-foreground px-4 py-2 text-xs uppercase tracking-wider text-background transition-colors hover:bg-transparent hover:text-foreground"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-grid border-b border-border">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-28">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-accent">
                {"// youtube outreach toolkit"}
              </p>
              <h1 className="font-display mt-5 text-5xl leading-[0.98] text-foreground sm:text-6xl lg:text-7xl">
                COMMENTS
                <br />
                INTO A WARM
                <br />
                INBOX.
              </h1>
              <p className="mt-6 max-w-md text-base text-muted">
                Scrape channel emails and commenter usernames, validate every
                address, and send your outreach — all from one dashboard.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={primaryHref}
                  className="bg-accent px-6 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-accent-hover"
                >
                  {primaryLabel}
                </Link>
                <a
                  href="#how-it-works"
                  className="border border-border px-6 py-3 text-center text-sm font-medium text-foreground transition-colors hover:border-accent"
                >
                  See how it works
                </a>
              </div>
              <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-border pt-6 text-xs uppercase tracking-wider text-muted">
                <div>
                  <dt>Auth</dt>
                  <dd className="mt-1 text-foreground">No API key</dd>
                </div>
                <div>
                  <dt>Limits</dt>
                  <dd className="mt-1 text-foreground">No quota</dd>
                </div>
                <div>
                  <dt>Sending</dt>
                  <dd className="mt-1 text-foreground">Your own inbox</dd>
                </div>
              </dl>
            </div>

            <div className="border border-border bg-surface">
              <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
                <span className="h-2 w-2 bg-danger" />
                <span className="h-2 w-2 bg-accent" />
                <span className="h-2 w-2 bg-success" />
                <span className="ml-2 text-xs text-muted">
                  yt-scraper — pipeline
                </span>
              </div>
              <div className="space-y-3 p-5 text-xs leading-relaxed">
                {commands.map((c) => (
                  <div key={c.cmd}>
                    <p className="text-foreground">
                      <span className="text-accent">$</span> {c.cmd}
                    </p>
                    <p className="text-success">{c.out}</p>
                  </div>
                ))}
                <p className="text-muted">
                  <span className="text-accent">$</span>{" "}
                  <span className="animate-pulse">▍</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="flex items-baseline justify-between border-b border-border pb-6">
              <h2 className="font-display text-3xl text-foreground sm:text-4xl">
                FOUR TOOLS
              </h2>
              <span className="hidden text-xs uppercase tracking-wider text-muted sm:block">
                One pipeline
              </span>
            </div>

            <div>
              {features.map((feature) => (
                <div
                  key={feature.index}
                  className="grid grid-cols-[3rem_1fr] gap-6 border-b border-border py-7 sm:grid-cols-[4rem_1fr_1fr]"
                >
                  <span className="text-sm text-accent">
                    {feature.index}
                  </span>
                  <h3 className="font-medium text-foreground">
                    {feature.title}
                  </h3>
                  <p className="col-span-2 text-sm leading-relaxed text-muted sm:col-span-1">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="font-display text-3xl text-foreground sm:text-4xl">
              RUN THE PIPELINE
            </h2>
            <p className="mt-3 max-w-md text-muted">
              Four commands, one dashboard — from a raw video link to a sent
              email.
            </p>

            <div className="mt-10 border border-border bg-surface text-sm">
              {commands.map((c, i) => (
                <div
                  key={c.cmd}
                  className={`flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:gap-4 ${
                    i !== commands.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <span className="text-muted">{`0${i + 1}`}</span>
                  <span className="text-foreground">
                    <span className="text-accent">$</span> {c.cmd}
                  </span>
                  <span className="text-muted sm:ml-auto">{c.out}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section className="border-b border-border bg-foreground">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-16 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-3xl text-background sm:text-4xl">
              READY TO BUILD
              <br />
              YOUR LIST?
            </h2>
            <Link
              href={primaryHref}
              className="border border-background bg-background px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-transparent hover:text-background"
            >
              {primaryLabel}
            </Link>
          </div>
        </section>
      </main>

      <footer>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-muted sm:flex-row">
          <Logo />
          <p>Built for small, personal outreach lists.</p>
        </div>
      </footer>
    </div>
  );
}
