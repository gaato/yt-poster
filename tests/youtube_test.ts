import { assertEquals } from "@std/assert";
import { extractYouTubeVideoId, normalizeYouTubeUrl } from "../src/youtube.ts";

Deno.test("extractYouTubeVideoId supports common YouTube URL forms", () => {
  assertEquals(
    extractYouTubeVideoId("https://www.youtube.com/watch?v=abc123&feature=share"),
    "abc123",
  );
  assertEquals(extractYouTubeVideoId("https://m.youtube.com/live/live123?si=x"), "live123");
  assertEquals(extractYouTubeVideoId("https://youtube.com/shorts/short123"), "short123");
  assertEquals(extractYouTubeVideoId("https://youtu.be/shortlink123?t=1"), "shortlink123");
  assertEquals(extractYouTubeVideoId("https://holodex.net/watch/holo123"), "holo123");
});

Deno.test("normalizeYouTubeUrl returns short youtu.be URL", () => {
  assertEquals(
    normalizeYouTubeUrl("https://www.youtube.com/watch?v=abc123"),
    "https://youtu.be/abc123",
  );
});
