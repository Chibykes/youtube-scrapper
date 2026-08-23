import Link from "next/link";

const tools = [
  {
    href: "/dashboard/email-scraper",
    title: "Channel Email Scraper",
    description:
      "Paste a list of channel URLs or handles and pull any email addresses found on their About page.",
  },
  {
    href: "/dashboard/comment-scraper",
    title: "Comment Username Scraper",
    description:
      "Paste a YouTube video link and collect the usernames of everyone who commented.",
  },
  {
    href: "/dashboard/email-validator",
    title: "Username → Email Validator",
    description:
      "Turn commenter usernames into guessed Gmail addresses and validate each one with mails.so before you use it.",
  },
  {
    href: "/dashboard/send-emails",
    title: "Send Emails",
    description:
      "Compose a message and send it over Gmail SMTP to a list of validated recipients using your own app password.",
  },
];

export default function DashboardPage() {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-accent">
        {"// dashboard"}
      </p>
      <h1 className="font-display mt-3 text-4xl text-foreground sm:text-5xl">
        PICK A TOOL
      </h1>
      <p className="mt-4 max-w-md text-muted">
        Four tools, one pipeline — from a raw video link to a sent email.
      </p>

      <div className="mt-10 border-t border-border">
        {tools.map((tool, i) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group grid grid-cols-[3rem_1fr] items-center gap-4 border-b border-border py-6 transition-colors hover:bg-surface sm:grid-cols-[3rem_1fr_auto] sm:gap-6"
          >
            <span className="text-sm text-accent">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h2 className="font-medium text-foreground group-hover:text-accent">
                {tool.title}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {tool.description}
              </p>
            </div>
            <span className="hidden text-muted transition-transform group-hover:translate-x-1 group-hover:text-accent sm:block">
              →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
