import { NextRequest, NextResponse } from "next/server";
import { fetchChannelAboutPage } from "@/network/channelScraper";
import {
  extractChannelTitle,
  extractEmails,
  mapWithConcurrency,
  normalizeChannelInput,
} from "@/lib/youtube";

export const maxDuration = 60;

type ChannelResult = {
  input: string;
  channelTitle: string | null;
  aboutUrl: string | null;
  emails: string[];
  status: "ok" | "no-email" | "error";
  error?: string;
};

async function scrapeChannel(input: string): Promise<ChannelResult> {
  const aboutUrl = normalizeChannelInput(input);

  if (!aboutUrl) {
    return {
      input,
      channelTitle: null,
      aboutUrl: null,
      emails: [],
      status: "error",
      error: "Could not parse this as a YouTube channel",
    };
  }

  try {
    const page = await fetchChannelAboutPage(aboutUrl);

    if (!page.html) {
      return {
        input,
        channelTitle: null,
        aboutUrl,
        emails: [],
        status: "error",
        error: `HTTP ${page.status}`,
      };
    }

    const html = page.html;
    const emails = extractEmails(html);
    const channelTitle = extractChannelTitle(html);

    return {
      input,
      channelTitle,
      aboutUrl,
      emails,
      status: emails.length > 0 ? "ok" : "no-email",
    };
  } catch (err) {
    return {
      input,
      channelTitle: null,
      aboutUrl,
      emails: [],
      status: "error",
      error: err instanceof Error ? err.message : "Fetch failed",
    };
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const channels: unknown = body?.channels;

  if (!Array.isArray(channels) || channels.length === 0) {
    return NextResponse.json(
      { error: "Provide a non-empty list of channels" },
      { status: 400 }
    );
  }

  const cleaned = channels
    .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
    .slice(0, 100);

  if (cleaned.length === 0) {
    return NextResponse.json(
      { error: "Provide a non-empty list of channels" },
      { status: 400 }
    );
  }

  const results = await mapWithConcurrency(cleaned, 5, scrapeChannel);

  return NextResponse.json({ results });
}
