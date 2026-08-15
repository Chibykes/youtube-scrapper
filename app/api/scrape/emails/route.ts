import { NextRequest, NextResponse } from "next/server";
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
    const res = await fetch(aboutUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        input,
        channelTitle: null,
        aboutUrl,
        emails: [],
        status: "error",
        error: `HTTP ${res.status}`,
      };
    }

    const html = await res.text();
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
