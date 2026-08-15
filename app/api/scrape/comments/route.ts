import { NextRequest, NextResponse } from "next/server";
import { extractVideoId } from "@/lib/youtube";

export const maxDuration = 60;

const MAX_COMMENTS = 2000;
const PAGE_SIZE = 100;

type CommentAuthor = {
  username: string;
  channelUrl: string | null;
  commentCount: number;
};

export async function POST(request: NextRequest) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Server is missing YOUTUBE_API_KEY. Add it to .env.local to use this tool.",
      },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const videoInput = typeof body?.videoUrl === "string" ? body.videoUrl : "";
  const videoId = extractVideoId(videoInput);

  if (!videoId) {
    return NextResponse.json(
      { error: "Couldn't find a valid YouTube video ID in that link" },
      { status: 400 }
    );
  }

  const authors = new Map<string, CommentAuthor>();
  let pageToken: string | undefined;
  let totalFetched = 0;
  let commentsDisabled = false;

  try {
    do {
      const url = new URL("https://www.googleapis.com/youtube/v3/commentThreads");
      url.searchParams.set("part", "snippet,replies");
      url.searchParams.set("videoId", videoId);
      url.searchParams.set("maxResults", String(PAGE_SIZE));
      url.searchParams.set("order", "time");
      url.searchParams.set("textFormat", "plainText");
      url.searchParams.set("key", apiKey);
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const res = await fetch(url.toString(), { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        const reason = data?.error?.errors?.[0]?.reason;
        if (reason === "commentsDisabled") {
          commentsDisabled = true;
          break;
        }
        return NextResponse.json(
          { error: data?.error?.message ?? `YouTube API error (${res.status})` },
          { status: res.status }
        );
      }

      const items: any[] = data.items ?? [];
      for (const item of items) {
        const topComment = item.snippet?.topLevelComment?.snippet;
        addAuthor(authors, topComment);

        const replies = item.replies?.comments ?? [];
        for (const reply of replies) {
          addAuthor(authors, reply.snippet);
        }
      }

      totalFetched += items.length;
      pageToken = data.nextPageToken;
    } while (pageToken && totalFetched < MAX_COMMENTS);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch comments" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    videoId,
    commentsDisabled,
    threadsFetched: totalFetched,
    authors: Array.from(authors.values()).sort(
      (a, b) => b.commentCount - a.commentCount
    ),
  });
}

function addAuthor(
  authors: Map<string, CommentAuthor>,
  snippet: any | undefined
) {
  if (!snippet) return;
  const username: string | undefined = snippet.authorDisplayName;
  if (!username) return;

  const existing = authors.get(username);
  if (existing) {
    existing.commentCount += 1;
  } else {
    authors.set(username, {
      username,
      channelUrl: snippet.authorChannelUrl ?? null,
      commentCount: 1,
    });
  }
}
