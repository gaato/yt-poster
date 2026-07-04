import { AccountService } from "./app/account_service.ts";
import { PostingService } from "./app/posting_service.ts";
import { ShareService } from "./app/share_service.ts";
import type { Config } from "./config.ts";
import type { PostInput, PostResult, ShareDraft } from "./domain.ts";
import type { StateStore } from "./state.ts";
import { YouTubeClient } from "./youtube.ts";
import { XService } from "./x.ts";

export class PosterService {
  private readonly youtube: YouTubeClient;
  private readonly x: XService;
  readonly shares: ShareService;
  readonly posting: PostingService;
  readonly accounts: AccountService;

  constructor(
    private readonly config: Config,
    private readonly store: StateStore,
  ) {
    this.youtube = new YouTubeClient(config.youtubeApiKey);
    this.x = new XService(config, store);
    this.shares = new ShareService(config, this.youtube, this.x, store);
    this.posting = new PostingService(config, this.x, store);
    this.accounts = new AccountService(config, this.x);
  }

  async postYouTubeVideo(input: PostInput): Promise<PostResult> {
    const accountId = input.xAccountId ?? this.config.defaultXAccountId;
    const draft = await this.previewYouTubeVideo(input);
    const jobId = this.store.createJob({
      ...input,
      normalizedUrl: draft.normalizedUrl,
    });
    try {
      const result = await this.posting.postDraft({
        draftId: draft.id,
        xAccountId: accountId,
        allowWarnings: true,
      });
      this.store.markJobSuccess(jobId, result, accountId);
      return result;
    } catch (error) {
      this.store.markJobFailure(jobId, error);
      throw error;
    }
  }

  previewYouTubeVideo(input: PostInput): Promise<ShareDraft> {
    return this.shares.preview({
      url: input.url,
      source: input.source,
      xAccountId: input.xAccountId,
    });
  }

  postDraft(draftId: string, allowWarnings = false): Promise<PostResult> {
    return this.posting.postDraft({ draftId, allowWarnings });
  }

  createXAuthorizationUrl(accountId?: string, returnTo?: string): Promise<string> {
    return this.x.createAuthorizationUrl(accountId, returnTo);
  }

  completeXAuthorization(code: string, state: string) {
    return this.x.completeAuthorization(code, state);
  }
}
