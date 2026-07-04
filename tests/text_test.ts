import { assertEquals } from "@std/assert";
import { buildPostText, escapeMentions } from "../src/text.ts";

Deno.test("escapeMentions inserts a zero-width break after at-sign mentions", () => {
  assertEquals(
    escapeMentions("@foo and email@example.com"),
    "@\u200bfoo and email@\u200bexample.com",
  );
});

Deno.test("buildPostText formats the watching post", () => {
  assertEquals(
    buildPostText("Title", "https://youtu.be/video"),
    "Now I'm watching...\n\nTitle\nhttps://youtu.be/video",
  );
});
