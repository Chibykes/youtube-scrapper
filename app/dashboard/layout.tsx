import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="border-b border-border bg-surface/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path d="M21.582 7.186a2.512 2.512 0 0 0-1.768-1.782C18.254 5 12 5 12 5s-6.254 0-7.814.404a2.512 2.512 0 0 0-1.768 1.782C2 8.758 2 12 2 12s0 3.242.418 4.814a2.512 2.512 0 0 0 1.768 1.782C5.746 19 12 19 12 19s6.254 0 7.814-.404a2.512 2.512 0 0 0 1.768-1.782C22 15.242 22 12 22 12s0-3.242-.418-4.814ZM10 15.5v-7l6 3.5-6 3.5Z" />
              </svg>
            </span>
            <span className="font-semibold text-foreground">YT Scraper</span>
          </Link>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        {children}
      </main>
    </div>
  );
}
