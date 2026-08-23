import Link from "next/link";

export default function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center bg-accent text-background">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-3.5 w-3.5"
        >
          <path d="M21.582 7.186a2.512 2.512 0 0 0-1.768-1.782C18.254 5 12 5 12 5s-6.254 0-7.814.404a2.512 2.512 0 0 0-1.768 1.782C2 8.758 2 12 2 12s0 3.242.418 4.814a2.512 2.512 0 0 0 1.768 1.782C5.746 19 12 19 12 19s6.254 0 7.814-.404a2.512 2.512 0 0 0 1.768-1.782C22 15.242 22 12 22 12s0-3.242-.418-4.814ZM10 15.5v-7l6 3.5-6 3.5Z" />
        </svg>
      </span>
      <span className="text-sm font-bold uppercase tracking-widest text-foreground">
        YT Scraper
      </span>
    </Link>
  );
}
