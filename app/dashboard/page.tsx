import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getBalance } from "@/lib/wallet";
import { CURRENCY, TOOL_COSTS } from "@/lib/pricing";

const tools = [
  {
    href: "/dashboard/email-scraper",
    title: "Channel Email Scraper",
    description:
      "Paste a list of channel URLs or handles and pull any email addresses found on their About page.",
    cost: TOOL_COSTS.emailScraper,
    feedsInto: "Send Emails",
    icon: "ri-mail-line",
  },
  {
    href: "/dashboard/comment-scraper",
    title: "Comment Username Scraper",
    description:
      "Paste a YouTube video link and collect the usernames of everyone who commented.",
    cost: TOOL_COSTS.commentScraper,
    feedsInto: "Email Validator",
    icon: "ri-chat-3-line",
  },
  {
    href: "/dashboard/email-validator",
    title: "Username → Email Validator",
    description:
      "Turn commenter usernames into guessed Gmail addresses and validate each one with listclean before you use it.",
    cost: TOOL_COSTS.emailValidator,
    feedsInto: "Send Emails",
    icon: "ri-shield-check-line",
  },
  {
    href: "/dashboard/send-emails",
    title: "Send Emails",
    description:
      "Compose a message and send it over Gmail SMTP to a list of validated recipients using your own app password.",
    cost: TOOL_COSTS.sendEmails,
    feedsInto: null,
    icon: "ri-mail-send-line",
  },
];

export default async function DashboardPage() {
  const { userId } = await auth();
  const balance = await getBalance(userId!);

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-accent">
        {"// dashboard"}
      </p>
      {/* <h1 className="font-display mt-3 text-4xl text-foreground sm:text-5xl">
        PICK A TOOL
      </h1>
      <p className="mt-4 max-w-md text-muted">
        Every tool works standalone, or chain them into one pipeline — a
        result from one flows straight into the next.
      </p> */}

      <Link
        href="/dashboard/wallet"
        className="mt-6 flex items-center justify-between border border-border bg-surface px-6 py-6 transition-colors hover:border-accent sm:max-w-lg"
      >
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">Balance</p>
          <p className="font-display mt-2 text-6xl text-foreground sm:text-7xl">
            {balance.toFixed(2)} <span className="text-2xl text-muted">{CURRENCY}</span>
          </p>
        </div>
        <span className="text-sm text-muted">Add funds →</span>
      </Link>

      {/* <div className="mt-10 border border-border bg-surface p-5">
        <p className="text-xs uppercase tracking-wider text-muted">
          Two ways through the pipeline
        </p>
        <div className="mt-3 space-y-2 text-sm">
          <p className="text-foreground">
            Channel Email Scraper <span className="text-accent">→</span> Send Emails
          </p>
          <p className="text-foreground">
            Comment Scraper <span className="text-accent">→</span> Email Validator{" "}
            <span className="text-accent">→</span> Send Emails
          </p>
        </div>
      </div> */}

      <div className="mt-10 border-t border-border">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group grid grid-cols-[3rem_1fr] items-center gap-4 border-b border-border py-6 transition-colors hover:bg-surface sm:grid-cols-[3rem_1fr_auto] sm:gap-6"
          >
            <i className={`${tool.icon} text-xl text-accent`} aria-hidden />
            <div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="font-medium text-foreground group-hover:text-accent">
                  {tool.title}
                </h2>
                <span className="border border-border px-1.5 py-0.5 text-xs uppercase tracking-wider text-muted">
                  {tool.cost ? `${tool.cost} ${CURRENCY} / run` : "Free"}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {tool.description}
              </p>
              {tool.feedsInto && (
                <p className="mt-1.5 text-xs text-muted">
                  Feeds into <span className="text-foreground">{tool.feedsInto}</span>
                </p>
              )}
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
