import { assertEquals, assertThrows } from "@std/assert";
import { accountFromToken, normalizeImageMediaType, parseCreatedPost } from "../src/x.ts";

Deno.test("normalizeImageMediaType accepts supported image media types", () => {
  assertEquals(normalizeImageMediaType("image/jpeg; charset=binary"), "image/jpeg");
  assertEquals(normalizeImageMediaType("image/png"), "image/png");
});

Deno.test("normalizeImageMediaType rejects unsupported media types", () => {
  assertThrows(
    () => normalizeImageMediaType("application/octet-stream"),
    Error,
    "Unsupported thumbnail content type",
  );
});

Deno.test("parseCreatedPost maps tweet response to internal post", () => {
  const post = parseCreatedPost({
    data: { id: "123", text: "hello" },
  });

  assertEquals(post, {
    id: "123",
    text: "hello",
    url: "https://x.com/i/web/status/123",
  });
});

Deno.test("accountFromToken maps OAuth result to stored account", () => {
  const account = accountFromToken(
    "default",
    {
      client: {} as never,
      accessToken: "access",
      refreshToken: "refresh",
      expiresIn: 7200,
      scope: ["tweet.read", "tweet.write", "media.write"],
    },
    { id: "user-id", username: "screen_name" },
  );

  assertEquals(account.id, "default");
  assertEquals(account.xUserId, "user-id");
  assertEquals(account.username, "screen_name");
  assertEquals(account.accessToken, "access");
  assertEquals(account.refreshToken, "refresh");
  assertEquals(account.tokenType, "bearer");
  assertEquals(account.scope, "tweet.read tweet.write media.write");
});
