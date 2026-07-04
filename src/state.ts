import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  OAuthState,
  PostAttempt,
  PostAttemptStatus,
  PostInput,
  PostResult,
  ShareDraft,
  ShareWarning,
  XAccount,
  YouTubeVideo,
} from "./domain.ts";

export interface CreateJobInput extends PostInput {
  normalizedUrl?: string | undefined;
}

export class StateStore {
  readonly db: DatabaseSync;

  constructor(path: string) {
    Deno.mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  createOAuthState(input: OAuthState): void {
    this.db.prepare(
      `insert into oauth_states (state, account_id, code_verifier, return_to, expires_at, created_at)
       values (?, ?, ?, ?, ?, ?)`,
    ).run(
      input.state,
      input.accountId,
      input.codeVerifier,
      input.returnTo ?? null,
      input.expiresAt,
      Date.now(),
    );
  }

  consumeOAuthState(state: string): OAuthState | undefined {
    const row = this.db.prepare(
      `select state, account_id, code_verifier, return_to, expires_at
       from oauth_states
       where state = ?`,
    ).get(state) as OAuthStateRow | undefined;
    this.db.prepare(`delete from oauth_states where state = ?`).run(state);
    if (!row || row.expires_at < Date.now()) {
      return undefined;
    }
    return {
      state: row.state,
      accountId: row.account_id,
      codeVerifier: row.code_verifier,
      returnTo: row.return_to ?? undefined,
      expiresAt: row.expires_at,
    };
  }

  deleteXAccount(id: string): void {
    this.db.prepare(`delete from x_accounts where id = ?`).run(id);
  }

  createShareDraft(input: {
    source: ShareDraft["source"];
    sourceUrl: string;
    video: YouTubeVideo;
    postText: string;
    warnings: ShareWarning[];
    expiresAt: number;
  }): ShareDraft {
    const draft: ShareDraft = {
      id: crypto.randomUUID(),
      source: input.source,
      sourceUrl: input.sourceUrl,
      youtubeVideoId: input.video.id,
      normalizedUrl: input.video.url,
      title: input.video.title,
      thumbnailUrl: input.video.thumbnail.url,
      postText: input.postText,
      warnings: input.warnings,
      createdAt: Date.now(),
      expiresAt: input.expiresAt,
    };

    this.db.prepare(
      `insert into share_drafts (
        id, source, source_url, youtube_video_id, normalized_url, title,
        thumbnail_url, post_text, warnings_json, created_at, expires_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      draft.id,
      draft.source,
      draft.sourceUrl,
      draft.youtubeVideoId,
      draft.normalizedUrl,
      draft.title,
      draft.thumbnailUrl,
      draft.postText,
      JSON.stringify(draft.warnings),
      draft.createdAt,
      draft.expiresAt,
    );

    return draft;
  }

  getShareDraft(id: string): ShareDraft | undefined {
    const row = this.db.prepare(
      `select id, source, source_url, youtube_video_id, normalized_url, title,
              thumbnail_url, post_text, warnings_json, created_at, expires_at
       from share_drafts
       where id = ?`,
    ).get(id) as ShareDraftRow | undefined;
    return row ? shareDraftFromRow(row) : undefined;
  }

  findRecentPostedAttempt(
    videoId: string,
    accountId: string,
    since: number,
  ): PostAttempt | undefined {
    const row = this.db.prepare(
      `select pa.id, pa.draft_id, pa.x_account_id, pa.status, pa.x_post_id, pa.x_post_url,
              pa.error_message, pa.created_at, pa.completed_at
       from post_attempts pa
       join share_drafts sd on sd.id = pa.draft_id
       where sd.youtube_video_id = ?
         and pa.x_account_id = ?
         and pa.status = 'posted'
         and pa.created_at >= ?
       order by pa.created_at desc
       limit 1`,
    ).get(videoId, accountId, since) as PostAttemptRow | undefined;
    return row ? postAttemptFromRow(row) : undefined;
  }

  createPostAttempt(draftId: string, accountId: string): PostAttempt {
    const now = Date.now();
    const result = this.db.prepare(
      `insert into post_attempts (draft_id, x_account_id, status, created_at)
       values (?, ?, 'pending', ?)`,
    ).run(draftId, accountId, now);
    return {
      id: Number(result.lastInsertRowid),
      draftId,
      xAccountId: accountId,
      status: "pending",
      createdAt: now,
    };
  }

  markPostAttemptPosted(attemptId: number, result: PostResult): PostAttempt {
    const now = Date.now();
    this.db.prepare(
      `update post_attempts
       set status = 'posted',
           x_post_id = ?,
           x_post_url = ?,
           error_message = null,
           completed_at = ?
       where id = ?`,
    ).run(result.post.id, result.post.url, now, attemptId);
    return this.getPostAttempt(attemptId) ??
      raise(`Post attempt not found after update: ${attemptId}`);
  }

  markPostAttemptFailed(attemptId: number, error: unknown): PostAttempt {
    const now = Date.now();
    this.db.prepare(
      `update post_attempts
       set status = 'failed',
           error_message = ?,
           completed_at = ?
       where id = ?`,
    ).run(error instanceof Error ? error.message : String(error), now, attemptId);
    return this.getPostAttempt(attemptId) ??
      raise(`Post attempt not found after update: ${attemptId}`);
  }

  private getPostAttempt(attemptId: number): PostAttempt | undefined {
    const row = this.db.prepare(
      `select id, draft_id, x_account_id, status, x_post_id, x_post_url,
              error_message, created_at, completed_at
       from post_attempts
       where id = ?`,
    ).get(attemptId) as PostAttemptRow | undefined;
    return row ? postAttemptFromRow(row) : undefined;
  }

  upsertXAccount(account: XAccount): void {
    this.db.prepare(
      `insert into x_accounts (
        id, x_user_id, username, access_token, refresh_token, token_type, scope,
        expires_at, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        x_user_id = excluded.x_user_id,
        username = excluded.username,
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        token_type = excluded.token_type,
        scope = excluded.scope,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at`,
    ).run(
      account.id,
      account.xUserId ?? null,
      account.username ?? null,
      account.accessToken,
      account.refreshToken ?? null,
      account.tokenType,
      account.scope ?? null,
      account.expiresAt,
      Date.now(),
      Date.now(),
    );
  }

  getXAccount(id: string): XAccount | undefined {
    const row = this.db.prepare(
      `select id, x_user_id, username, access_token, refresh_token, token_type, scope, expires_at
       from x_accounts
       where id = ?`,
    ).get(id) as XAccountRow | undefined;
    return row ? accountFromRow(row) : undefined;
  }

  createJob(input: CreateJobInput): number {
    const result = this.db.prepare(
      `insert into post_jobs (
        source, requested_by, input_url, normalized_url, x_account_id, status,
        created_at, updated_at
      ) values (?, ?, ?, ?, ?, 'pending', ?, ?)`,
    ).run(
      input.source,
      input.requestedBy ?? null,
      input.url,
      input.normalizedUrl ?? null,
      input.xAccountId ?? null,
      Date.now(),
      Date.now(),
    );
    return Number(result.lastInsertRowid);
  }

  markJobSuccess(jobId: number, result: PostResult, accountId: string): void {
    this.db.prepare(
      `update post_jobs
       set status = 'succeeded',
           normalized_url = ?,
           video_id = ?,
           title = ?,
           thumbnail_url = ?,
           x_account_id = ?,
           post_id = ?,
           post_url = ?,
           error = null,
           updated_at = ?
       where id = ?`,
    ).run(
      result.video.url,
      result.video.id,
      result.video.title,
      result.video.thumbnail.url,
      accountId,
      result.post.id,
      result.post.url,
      Date.now(),
      jobId,
    );
  }

  markJobFailure(jobId: number, error: unknown): void {
    this.db.prepare(
      `update post_jobs
       set status = 'failed',
           error = ?,
           updated_at = ?
       where id = ?`,
    ).run(error instanceof Error ? error.message : String(error), Date.now(), jobId);
  }

  private migrate(): void {
    this.db.exec(`
      create table if not exists x_accounts (
        id text primary key,
        x_user_id text,
        username text,
        access_token text not null,
        refresh_token text,
        token_type text not null,
        scope text,
        expires_at integer not null,
        created_at integer not null,
        updated_at integer not null
      );

      create table if not exists oauth_states (
        state text primary key,
        account_id text not null,
        code_verifier text not null,
        return_to text,
        expires_at integer not null,
        created_at integer not null
      );

      create table if not exists post_jobs (
        id integer primary key autoincrement,
        source text not null,
        requested_by text,
        input_url text not null,
        normalized_url text,
        video_id text,
        title text,
        thumbnail_url text,
        x_account_id text,
        status text not null,
        post_id text,
        post_url text,
        error text,
        created_at integer not null,
        updated_at integer not null
      );

      create table if not exists share_drafts (
        id text primary key,
        source text not null,
        source_url text not null,
        youtube_video_id text not null,
        normalized_url text not null,
        title text not null,
        thumbnail_url text not null,
        post_text text not null,
        warnings_json text not null,
        created_at integer not null,
        expires_at integer not null
      );

      create table if not exists post_attempts (
        id integer primary key autoincrement,
        draft_id text not null references share_drafts(id),
        x_account_id text not null,
        status text not null,
        x_post_id text,
        x_post_url text,
        error_message text,
        created_at integer not null,
        completed_at integer
      );
    `);

    const columns = this.db.prepare(`pragma table_info(oauth_states)`).all() as Array<{
      name: string;
    }>;
    if (!columns.some((column) => column.name === "return_to")) {
      this.db.exec(`alter table oauth_states add column return_to text`);
    }
  }
}

interface OAuthStateRow {
  state: string;
  account_id: string;
  code_verifier: string;
  return_to: string | null;
  expires_at: number;
}

interface XAccountRow {
  id: string;
  x_user_id: string | null;
  username: string | null;
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  scope: string | null;
  expires_at: number;
}

function accountFromRow(row: XAccountRow): XAccount {
  return {
    id: row.id,
    xUserId: row.x_user_id ?? undefined,
    username: row.username ?? undefined,
    accessToken: row.access_token,
    refreshToken: row.refresh_token ?? undefined,
    tokenType: row.token_type,
    scope: row.scope ?? undefined,
    expiresAt: row.expires_at,
  };
}

interface ShareDraftRow {
  id: string;
  source: ShareDraft["source"];
  source_url: string;
  youtube_video_id: string;
  normalized_url: string;
  title: string;
  thumbnail_url: string;
  post_text: string;
  warnings_json: string;
  created_at: number;
  expires_at: number;
}

interface PostAttemptRow {
  id: number;
  draft_id: string;
  x_account_id: string;
  status: PostAttemptStatus;
  x_post_id: string | null;
  x_post_url: string | null;
  error_message: string | null;
  created_at: number;
  completed_at: number | null;
}

function shareDraftFromRow(row: ShareDraftRow): ShareDraft {
  return {
    id: row.id,
    source: row.source,
    sourceUrl: row.source_url,
    youtubeVideoId: row.youtube_video_id,
    normalizedUrl: row.normalized_url,
    title: row.title,
    thumbnailUrl: row.thumbnail_url,
    postText: row.post_text,
    warnings: parseWarnings(row.warnings_json),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

function postAttemptFromRow(row: PostAttemptRow): PostAttempt {
  return {
    id: row.id,
    draftId: row.draft_id,
    xAccountId: row.x_account_id,
    status: row.status,
    xPostId: row.x_post_id ?? undefined,
    xPostUrl: row.x_post_url ?? undefined,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
  };
}

function parseWarnings(value: string): ShareWarning[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter((item): item is ShareWarning =>
    typeof item === "object" && item !== null &&
    "code" in item && "message" in item &&
    typeof item.code === "string" && typeof item.message === "string"
  );
}

function raise(message: string): never {
  throw new Error(message);
}
