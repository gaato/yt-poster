import { assertEquals, assertExists } from "@std/assert";
import { StateStore } from "../src/state.ts";

Deno.test("StateStore persists and consumes OAuth state once", () => {
  const path = Deno.makeTempFileSync();
  const store = new StateStore(path);
  try {
    store.createOAuthState({
      state: "state",
      accountId: "default",
      codeVerifier: "verifier",
      expiresAt: Date.now() + 60_000,
    });

    const consumed = store.consumeOAuthState("state");
    assertExists(consumed);
    assertEquals(consumed.accountId, "default");
    assertEquals(store.consumeOAuthState("state"), undefined);
  } finally {
    store.close();
    Deno.removeSync(path);
  }
});

Deno.test("StateStore persists share drafts and posted attempts", () => {
  const path = Deno.makeTempFileSync();
  const store = new StateStore(path);
  try {
    const draft = store.createShareDraft({
      source: "web",
      sourceUrl: "https://www.youtube.com/watch?v=abc123",
      video: {
        id: "abc123",
        url: "https://youtu.be/abc123",
        title: "Video title",
        thumbnail: { url: "https://img.example/abc.jpg", quality: "maxres" },
      },
      postText: "Video title\nhttps://youtu.be/abc123",
      warnings: [],
      expiresAt: Date.now() + 60_000,
    });

    assertEquals(store.getShareDraft(draft.id)?.youtubeVideoId, "abc123");
    const attempt = store.createPostAttempt(draft.id, "default");
    const posted = store.markPostAttemptPosted(attempt.id, {
      video: {
        id: "abc123",
        url: "https://youtu.be/abc123",
        title: "Video title",
        thumbnail: { url: "https://img.example/abc.jpg", quality: "maxres" },
      },
      media: { mediaId: "media-id" },
      post: { id: "post-id", text: "posted", url: "https://x.com/i/web/status/post-id" },
    });

    assertEquals(posted.status, "posted");
    assertEquals(
      store.findRecentPostedAttempt("abc123", "default", Date.now() - 60_000)?.id,
      attempt.id,
    );
  } finally {
    store.close();
    Deno.removeSync(path);
  }
});
