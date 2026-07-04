export type Source = "discord" | "webhook" | "web";

export interface Thumbnail {
  url: string;
  width?: number | undefined;
  height?: number | undefined;
  quality: string;
}

export interface YouTubeVideo {
  id: string;
  url: string;
  title: string;
  thumbnail: Thumbnail;
}

export interface XAccount {
  id: string;
  xUserId?: string | undefined;
  username?: string | undefined;
  accessToken: string;
  refreshToken?: string | undefined;
  tokenType: string;
  scope?: string | undefined;
  expiresAt: number;
}

export interface XAuthorizationCompletion {
  account: XAccount;
  returnTo?: string | undefined;
}

export interface OAuthState {
  state: string;
  accountId: string;
  codeVerifier: string;
  returnTo?: string | undefined;
  expiresAt: number;
}

export interface UploadedMedia {
  mediaId: string;
}

export interface CreatedPost {
  id: string;
  text: string;
  url: string;
}

export type ShareWarningCode =
  | "duplicate_recent_post"
  | "x_account_not_connected";

export interface ShareWarning {
  code: ShareWarningCode;
  message: string;
}

export interface ShareDraft {
  id: string;
  source: Source;
  sourceUrl: string;
  youtubeVideoId: string;
  normalizedUrl: string;
  title: string;
  thumbnailUrl: string;
  postText: string;
  warnings: ShareWarning[];
  createdAt: number;
  expiresAt: number;
}

export type PostAttemptStatus = "pending" | "posted" | "failed";

export interface PostAttempt {
  id: number;
  draftId: string;
  xAccountId: string;
  status: PostAttemptStatus;
  xPostId?: string | undefined;
  xPostUrl?: string | undefined;
  errorMessage?: string | undefined;
  createdAt: number;
  completedAt?: number | undefined;
}

export interface PostInput {
  url: string;
  source: Source;
  requestedBy?: string | undefined;
  xAccountId?: string | undefined;
}

export interface PostResult {
  video: YouTubeVideo;
  post: CreatedPost;
  media: UploadedMedia;
  draft?: ShareDraft | undefined;
  attempt?: PostAttempt | undefined;
}
