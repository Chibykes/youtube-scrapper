import Link from "next/link";

const tools = [
  {
    href: "/dashboard/email-scraper",
    title: "Channel Email Scraper",
    description:
      "Paste a list of channel URLs or handles and pull any email addresses found on their About page.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M2.25 6.75c0-.828.672-1.5 1.5-1.5h16.5c.828 0 1.5.672 1.5 1.5v10.5a1.5 1.5 0 0 1-1.5 1.5H3.75a1.5 1.5 0 0 1-1.5-1.5V6.75Zm0 0 9.75 6.75 9.75-6.75"
      />
    ),
  },
  {
    href: "/dashboard/comment-scraper",
    title: "Comment Username Scraper",
    description:
      "Paste a YouTube video link and collect the usernames of everyone who commented.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
      />
    ),
  },
];

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
      <p className="mt-1 text-muted">Pick a tool to get started.</p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-accent"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                className="h-5 w-5"
              >
                {tool.icon}
              </svg>
            </div>
            <h2 className="mt-4 font-medium text-foreground group-hover:text-accent">
              {tool.title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {tool.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
