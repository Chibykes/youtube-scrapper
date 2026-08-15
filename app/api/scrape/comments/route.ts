import { NextRequest, NextResponse } from "next/server";
import { Innertube } from "youtubei.js";
import { extractVideoId } from "@/lib/youtube";

export const maxDuration = 60;

const MAX_THREADS = 2000;

type CommentAuthor = {
  username: string;
  channelUrl: string | null;
  commentCount: number;
};

let innertubePromise: ReturnType<typeof Innertube.create> | null = null;
function getInnertube() {
  if (!innertubePromise) {
    innertubePromise = Innertube.create({ generate_session_locally: true });
  }
  return innertubePromise;
}

export async function POST(request: NextRequest) {
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
  let threadsFetched = 0;
  let commentsDisabled = false;

  function addAuthor(name: string | undefined, channelUrl: string | undefined) {
    if (!name) return;
    const existing = authors.get(name);
    if (existing) {
      existing.commentCount += 1;
    } else {
      authors.set(name, {
        username: name,
        channelUrl: channelUrl ?? null,
        commentCount: 1,
      });
    }
  }

  try {
    const yt = await getInnertube();
    let comments = await yt.getComments(videoId, "TOP_COMMENTS");

    while (true) {
      for (const thread of comments.contents) {
        const top = thread.comment;
        if (top) {
          addAuthor(top.author?.name, top.author?.url);
          threadsFetched += 1;
        }

        for (const reply of thread.replies ?? []) {
          addAuthor(reply.comment?.author?.name, reply.comment?.author?.url);
        }
      }

      if (!comments.has_continuation || threadsFetched >= MAX_THREADS) break;
      comments = await comments.getContinuation();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch comments";
    if (/comments (are )?(disabled|turned off)/i.test(message)) {
      commentsDisabled = true;
    } else {
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({
    videoId,
    commentsDisabled,
    threadsFetched,
    authors: Array.from(authors.values()).sort(
      (a, b) => b.commentCount - a.commentCount
    ),
  });
}
