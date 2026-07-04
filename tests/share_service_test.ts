import { assertEquals } from "@std/assert";
import { ShareService } from "../src/app/share_service.ts";
import type { Config } from "../src/config.ts";
import type { XAccount, YouTubeVideo } from "../src/domain.ts";
import type { XPublisherPort, YouTubeMetadataPort } from "../src/ports.ts";
import { StateStore } from "../src/state.ts";

Deno.test("ShareService creates a draft with preview data", async () => {
  const path = Deno.makeTempFileSync();
  const store = new StateStore(path);
  try {
    const service = new ShareService(
      testConfig(),
      new FakeYouTube(),
      new FakeX({ id: "default", accessToken: "token", tokenType: "bearer", expiresAt: 1 }),
      store,
    );

    const draft = await service.preview({
      url: "https://www.youtube.com/watch?v=abc123",
      source: "web",
    });

    assertEquals(draft.youtubeVideoId, "abc123");
    assertEquals(draft.normalizedUrl, "https://youtu.be/abc123");
    assertEquals(draft.title, "Video title");
    assertEquals(draft.warnings, []);
    assertEquals(store.getShareDraft(draft.id)?.postText, draft.postText);
  } finally {
    store.close();
    Deno.removeSync(path);
  }
});

Deno.test("ShareService warns when X account is not connected", async () => {
  const path = Deno.makeTempFileSync();
  const store = new StateStore(path);
  try {
    const service = new ShareService(testConfig(), new FakeYouTube(), new FakeX(), store);
    const draft = await service.preview({
      url: "https://www.youtube.com/watch?v=abc123",
      source: "web",
    });

    assertEquals(draft.warnings[0]?.code, "x_account_not_connected");
  } finally {
    store.close();
    Deno.removeSync(path);
  }
});

class FakeYouTube implements YouTubeMetadataPort {
  getVideo(_inputUrl: string): Promise<YouTubeVideo> {
    return Promise.resolve({
      id: "abc123",
      url: "https://youtu.be/abc123",
      title: "Video title",
      thumbnail: { url: "https://img.example/abc.jpg", quality: "maxres" },
    });
  }
}

class FakeX implements XPublisherPort {
  constructor(private readonly account?: XAccount | undefined) {}

  createAuthorizationUrl(): Promise<string> {
    throw new Error("not implemented");
  }

  completeAuthorization(): never {
    throw new Error("not implemented");
  }

  getAccount(_accountId: string): XAccount | undefined {
    return this.account;
  }

  disconnectAccount(): void {}

  publish(): never {
    throw new Error("not implemented");
  }
}

function testConfig(): Config {
  return {
    host: "127.0.0.1",
    port: 8080,
    baseUrl: "http://127.0.0.1:8080",
    databasePath: ":memory:",
    youtubeApiKey: "youtube",
    xClientId: "x-client",
    xRedirectUri: "http://127.0.0.1:8080/auth/x/callback",
    xScopes: [],
    defaultXAccountId: "default",
  };
}
