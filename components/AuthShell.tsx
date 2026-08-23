import Link from "next/link";
import Logo from "@/components/Logo";

const pitchPoints = [
  "Scrape channel emails straight off the About page",
  "Pull commenter usernames from any video, no API key",
  "Validate guessed addresses before you ever hit send",
  "Send the campaign from your own inbox, in batches",
];

export default function AuthShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-1">
      <div className="bg-grid relative hidden w-[42%] flex-col justify-between border-r border-border bg-surface px-10 py-10 lg:flex">
        <Logo />

        <div className="relative">
          <p className="font-display text-3xl leading-[1.15] text-foreground">
            Turn comments into a warm inbox.
          </p>
          <ul className="mt-7 space-y-3 border-t border-border pt-6">
            {pitchPoints.map((point) => (
              <li
                key={point}
                className="flex items-start gap-3 text-sm text-muted"
              >
                <span className="mt-1 h-1 w-3 shrink-0 bg-accent" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-muted">
          Built for small, personal outreach lists.
        </p>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="px-6 py-6 lg:hidden">
          <Logo />
        </div>
        <main className="flex flex-1 items-center justify-center px-4 pb-16">
          <div className="w-full max-w-sm">{children}</div>
        </main>
        <div className="hidden justify-center pb-8 lg:flex">
          <Link
            href="/"
            className="text-xs text-muted transition-colors hover:text-foreground"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
