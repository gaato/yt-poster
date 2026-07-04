import { Buffer } from "node:buffer";
import { TwitterApi, type TwitterApiReadWrite } from "twitter-api-v2";
import type {
  IOAuth2RequestTokenResult,
  IParsedOAuth2TokenResult,
  TweetV2PostTweetResult,
  UserV2Result,
} from "twitter-api-v2";
import type { Config } from "./config.ts";
import type { CreatedPost, UploadedMedia, XAccount, XAuthorizationCompletion } from "./domain.ts";
import type { XAccountStore } from "./ports.ts";
import { buildPostText } from "./text.ts";

export class XService {
  constructor(
    private readonly config: Config,
    private readonly store: XAccountStore,
  ) {}

  createAuthorizationUrl(
    accountId = this.config.defaultXAccountId,
    returnTo?: string | undefined,
  ): Promise<string> {
    const auth = this.createOAuthClient().generateOAuth2AuthLink(this.config.xRedirectUri, {
      scope: this.config.xScopes,
    });

    this.store.createOAuthState({
      state: auth.state,
      accountId,
      codeVerifier: auth.codeVerifier,
      returnTo,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    return Promise.resolve(auth.url);
  }

  async completeAuthorization(code: string, state: string): Promise<XAuthorizationCompletion> {
    const savedState = this.store.consumeOAuthState(state);
    if (!savedState) {
      throw new Error("Invalid or expired OAuth state");
    }

    const token = await this.createOAuthClient().loginWithOAuth2({
      code,
      codeVerifier: savedState.codeVerifier,
      redirectUri: this.config.xRedirectUri,
    });
    const profile = await fetchProfile(token.client);
    const account = accountFromToken(savedState.accountId, token, profile);
    this.store.upsertXAccount(account);
    return { account, returnTo: savedState.returnTo };
  }

  getAccount(accountId: string): XAccount | undefined {
    return this.store.getXAccount(accountId);
  }

  disconnectAccount(accountId: string): void {
    this.store.deleteXAccount(accountId);
  }

  async publish(input: {
    accountId: string;
    thumbnailUrl: string;
    text: string;
  }): Promise<{ media: UploadedMedia; post: CreatedPost }> {
    const account = await this.getFreshAccount(input.accountId);
    const client = new TwitterApi(account.accessToken);
    try {
      const media = await this.uploadThumbnail(client, input.thumbnailUrl);
      const post = parseCreatedPost(
        await client.v2.tweet({
          text: input.text,
          media: { media_ids: [media.mediaId] },
        }),
      );
      return { media, post };
    } catch (error) {
      throw normalizeXApiError(error);
    }
  }

  async uploadThumbnailAndPost(
    accountId: string,
    thumbnailUrl: string,
    title: string,
    youtubeUrl: string,
  ): Promise<{ media: UploadedMedia; post: CreatedPost }> {
    return await this.publish({
      accountId,
      thumbnailUrl,
      text: buildPostText(title, youtubeUrl),
    });
  }

  private async getFreshAccount(id: string): Promise<XAccount> {
    const account = this.store.getXAccount(id);
    if (!account) {
      throw new Error(`X account is not authorized: ${id}`);
    }

    if (account.expiresAt > Date.now() + 60_000) {
      return account;
    }

    if (!account.refreshToken) {
      throw new Error(`X account has no refresh token: ${id}`);
    }

    const refreshedToken = await this.createOAuthClient().refreshOAuth2Token(account.refreshToken);
    const refreshed = accountFromToken(id, refreshedToken, {
      id: account.xUserId,
      username: account.username,
    });
    this.store.upsertXAccount(refreshed);
    return refreshed;
  }

  private createOAuthClient(): TwitterApi {
    const init = this.config.xClientSecret
      ? { clientId: this.config.xClientId, clientSecret: this.config.xClientSecret }
      : { clientId: this.config.xClientId };
    return new TwitterApi(init);
  }

  private async uploadThumbnail(
    client: TwitterApiReadWrite,
    thumbnailUrl: string,
  ): Promise<UploadedMedia> {
    const response = await fetch(thumbnailUrl);
    if (!response.ok) {
      throw new Error(`Thumbnail download failed: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 5 * 1024 * 1024) {
      throw new Error("Thumbnail is larger than X image upload limit");
    }

    const mediaId = await client.v2.uploadMedia(Buffer.from(bytes), {
      media_type: normalizeImageMediaType(contentType),
      media_category: "tweet_image",
    });

    return { mediaId };
  }
}

export function accountFromToken(
  accountId: string,
  token: IParsedOAuth2TokenResult,
  profile: { id?: string | undefined; username?: string | undefined },
): XAccount {
  const account: XAccount = {
    id: accountId,
    accessToken: token.accessToken,
    tokenType: "bearer",
    scope: token.scope.join(" "),
    expiresAt: Date.now() + token.expiresIn * 1000,
  };
  if (profile.id) account.xUserId = profile.id;
  if (profile.username) account.username = profile.username;
  if (token.refreshToken) account.refreshToken = token.refreshToken;
  return account;
}

export function parseCreatedPost(response: TweetV2PostTweetResult): CreatedPost {
  return {
    id: response.data.id,
    text: response.data.text,
    url: `https://x.com/i/web/status/${response.data.id}`,
  };
}

export function normalizeImageMediaType(
  contentType: string,
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase();
  switch (normalized) {
    case "image/jpeg":
    case "image/png":
    case "image/gif":
    case "image/webp":
      return normalized;
    default:
      throw new Error(`Unsupported thumbnail content type: ${contentType}`);
  }
}

async function fetchProfile(client: TwitterApiReadWrite): Promise<{
  id?: string | undefined;
  username?: string | undefined;
}> {
  const response: UserV2Result = await client.v2.me();
  return {
    id: response.data.id,
    username: response.data.username,
  };
}

export type XOAuthRequest = IOAuth2RequestTokenResult;

function normalizeXApiError(error: unknown): Error {
  if (isRecord(error) && error.code === 402 && isRecord(error.data)) {
    const title = typeof error.data.title === "string" ? error.data.title : undefined;
    if (title === "CreditsDepleted") {
      return new Error("X API credits are depleted for this developer account.");
    }
  }
  return error instanceof Error ? error : new Error(String(error));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
