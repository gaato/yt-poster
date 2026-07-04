import type { Thumbnail, YouTubeVideo } from "./domain.ts";

const YOUTUBE_ID_PATTERN =
  /^(?:https?:\/\/)?(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|live\/|shorts\/)([^&\s/?]+)|youtu\.be\/([^&\s/?]+)|holodex\.net\/watch\/([^&\s/?]+))/;

const THUMBNAIL_PRIORITY = ["maxres", "standard", "high", "medium", "default"] as const;

export function extractYouTubeVideoId(input: string): string | undefined {
  const trimmed = input.trim();
  const match = trimmed.match(YOUTUBE_ID_PATTERN);
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

export function normalizeYouTubeUrl(input: string): string | undefined {
  const id = extractYouTubeVideoId(input);
  return id ? `https://youtu.be/${id}` : undefined;
}

export class YouTubeClient {
  constructor(private readonly apiKey: string) {}

  async getVideo(inputUrl: string): Promise<YouTubeVideo> {
    const id = extractYouTubeVideoId(inputUrl);
    if (!id) {
      throw new Error("Not a supported YouTube or Holodex watch URL");
    }

    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("id", id);
    url.searchParams.set("key", this.apiKey);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`YouTube Data API failed: ${response.status} ${response.statusText}`);
    }

    const body = await response.json() as unknown;
    const item = parseVideoItem(body);

    return {
      id,
      url: `https://youtu.be/${id}`,
      title: item.title,
      thumbnail: item.thumbnail,
    };
  }
}

interface ParsedVideoItem {
  title: string;
  thumbnail: Thumbnail;
}

function parseVideoItem(body: unknown): ParsedVideoItem {
  if (!isRecord(body) || !Array.isArray(body.items) || body.items.length === 0) {
    throw new Error("YouTube Data API returned no video item");
  }

  const first = body.items[0];
  if (!isRecord(first) || !isRecord(first.snippet)) {
    throw new Error("YouTube video item is missing snippet");
  }

  const title = first.snippet.title;
  if (typeof title !== "string" || title.length === 0) {
    throw new Error("YouTube video item is missing title");
  }

  const thumbnails = first.snippet.thumbnails;
  if (!isRecord(thumbnails)) {
    throw new Error("YouTube video item is missing thumbnails");
  }

  for (const quality of THUMBNAIL_PRIORITY) {
    const candidate = thumbnails[quality];
    if (!isRecord(candidate) || typeof candidate.url !== "string") {
      continue;
    }
    return {
      title,
      thumbnail: {
        url: candidate.url,
        width: typeof candidate.width === "number" ? candidate.width : undefined,
        height: typeof candidate.height === "number" ? candidate.height : undefined,
        quality,
      },
    };
  }

  throw new Error("YouTube video item has no usable thumbnail");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
