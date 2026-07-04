import type {
  CreatedPost,
  OAuthState,
  PostAttempt,
  PostResult,
  ShareDraft,
  UploadedMedia,
  XAccount,
  XAuthorizationCompletion,
  YouTubeVideo,
} from "./domain.ts";

export interface YouTubeMetadataPort {
  getVideo(inputUrl: string): Promise<YouTubeVideo>;
}

export interface XPublisherPort {
  createAuthorizationUrl(accountId?: string, returnTo?: string): Promise<string>;
  completeAuthorization(code: string, state: string): Promise<XAuthorizationCompletion>;
  getAccount(accountId: string): XAccount | undefined;
  disconnectAccount(accountId: string): void;
  publish(input: {
    accountId: string;
    thumbnailUrl: string;
    text: string;
  }): Promise<{ media: UploadedMedia; post: CreatedPost }>;
}

export interface XAccountStore {
  createOAuthState(input: OAuthState): void;
  consumeOAuthState(state: string): OAuthState | undefined;
  upsertXAccount(account: XAccount): void;
  getXAccount(id: string): XAccount | undefined;
  deleteXAccount(id: string): void;
}

export interface ShareDraftStore {
  createShareDraft(input: {
    source: ShareDraft["source"];
    sourceUrl: string;
    video: YouTubeVideo;
    postText: string;
    warnings: ShareDraft["warnings"];
    expiresAt: number;
  }): ShareDraft;
  getShareDraft(id: string): ShareDraft | undefined;
  findRecentPostedAttempt(
    videoId: string,
    accountId: string,
    since: number,
  ): PostAttempt | undefined;
  createPostAttempt(draftId: string, accountId: string): PostAttempt;
  markPostAttemptPosted(attemptId: number, result: PostResult): PostAttempt;
  markPostAttemptFailed(attemptId: number, error: unknown): PostAttempt;
}
