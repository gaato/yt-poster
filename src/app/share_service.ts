import type { Config } from "../config.ts";
import type { ShareDraft, ShareWarning, Source } from "../domain.ts";
import type { ShareDraftStore, XPublisherPort, YouTubeMetadataPort } from "../ports.ts";
import { buildPostText } from "../text.ts";

const DRAFT_TTL_MS = 10 * 60 * 1000;
const RECENT_POST_WINDOW_MS = 24 * 60 * 60 * 1000;

export class ShareService {
  constructor(
    private readonly config: Config,
    private readonly youtube: YouTubeMetadataPort,
    private readonly x: XPublisherPort,
    private readonly drafts: ShareDraftStore,
  ) {}

  async preview(input: {
    url: string;
    source: Source;
    xAccountId?: string | undefined;
  }): Promise<ShareDraft> {
    const accountId = input.xAccountId ?? this.config.defaultXAccountId;
    const video = await this.youtube.getVideo(input.url);
    const postText = buildPostText(video.title, video.url);
    const warnings: ShareWarning[] = [];

    if (!this.x.getAccount(accountId)) {
      warnings.push({
        code: "x_account_not_connected",
        message: "X account is not connected.",
      });
    }

    const recent = this.drafts.findRecentPostedAttempt(
      video.id,
      accountId,
      Date.now() - RECENT_POST_WINDOW_MS,
    );
    if (recent) {
      warnings.push({
        code: "duplicate_recent_post",
        message: "This video was posted recently.",
      });
    }

    return this.drafts.createShareDraft({
      source: input.source,
      sourceUrl: input.url,
      video,
      postText,
      warnings,
      expiresAt: Date.now() + DRAFT_TTL_MS,
    });
  }
}
