import type { Config } from "../config.ts";
import type { PostResult, ShareDraft } from "../domain.ts";
import type { ShareDraftStore, XPublisherPort } from "../ports.ts";

export class PostingService {
  constructor(
    private readonly config: Config,
    private readonly x: XPublisherPort,
    private readonly drafts: ShareDraftStore,
  ) {}

  async postDraft(input: {
    draftId: string;
    xAccountId?: string | undefined;
    allowWarnings?: boolean | undefined;
  }): Promise<PostResult> {
    const draft = this.getUsableDraft(input.draftId);
    if (draft.warnings.length > 0 && !input.allowWarnings) {
      throw new Error("Draft has warnings and requires explicit confirmation");
    }

    const accountId = input.xAccountId ?? this.config.defaultXAccountId;
    const attempt = this.drafts.createPostAttempt(draft.id, accountId);
    try {
      const { media, post } = await this.x.publish({
        accountId,
        thumbnailUrl: draft.thumbnailUrl,
        text: draft.postText,
      });
      const result: PostResult = {
        video: {
          id: draft.youtubeVideoId,
          url: draft.normalizedUrl,
          title: draft.title,
          thumbnail: { url: draft.thumbnailUrl, quality: "selected" },
        },
        media,
        post,
        draft,
      };
      return {
        ...result,
        attempt: this.drafts.markPostAttemptPosted(attempt.id, result),
      };
    } catch (error) {
      this.drafts.markPostAttemptFailed(attempt.id, error);
      throw error;
    }
  }

  private getUsableDraft(id: string): ShareDraft {
    const draft = this.drafts.getShareDraft(id);
    if (!draft) {
      throw new Error(`Share draft not found: ${id}`);
    }
    if (draft.expiresAt < Date.now()) {
      throw new Error(`Share draft expired: ${id}`);
    }
    return draft;
  }
}
