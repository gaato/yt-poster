import { loadSync } from "@std/dotenv";

export interface Config {
  host: string;
  port: number;
  baseUrl: string;
  databasePath: string;
  youtubeApiKey: string;
  xClientId: string;
  xClientSecret?: string;
  xRedirectUri: string;
  xScopes: string[];
  defaultXAccountId: string;
  discordBotToken?: string;
  discordGuildId?: bigint;
  webhookToken?: string;
}

export function loadConfig(): Config {
  try {
    loadSync({ export: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }

  const baseUrl = requiredEnv("YT_POSTER_BASE_URL");
  const xRedirectUri = Deno.env.get("X_REDIRECT_URI") ?? `${baseUrl}/auth/x/callback`;
  const discordGuildId = Deno.env.get("DISCORD_GUILD_ID");

  const config: Config = {
    host: Deno.env.get("YT_POSTER_HOST") ?? "127.0.0.1",
    port: parseInteger(Deno.env.get("YT_POSTER_PORT") ?? "8080", "YT_POSTER_PORT"),
    baseUrl,
    databasePath: Deno.env.get("YT_POSTER_DATABASE_PATH") ??
      `${Deno.cwd()}/data/yt-poster.sqlite`,
    youtubeApiKey: requiredEnv("YOUTUBE_API_KEY"),
    xClientId: requiredEnv("X_CLIENT_ID"),
    xRedirectUri,
    xScopes: [
      "tweet.read",
      "tweet.write",
      "users.read",
      "media.write",
      "offline.access",
    ],
    defaultXAccountId: Deno.env.get("X_ACCOUNT_ID") ?? "default",
  };
  setIfDefined(config, "xClientSecret", emptyToUndefined(Deno.env.get("X_CLIENT_SECRET")));
  setIfDefined(config, "discordBotToken", emptyToUndefined(Deno.env.get("DISCORD_BOT_TOKEN")));
  if (discordGuildId) {
    config.discordGuildId = BigInt(discordGuildId);
  }
  setIfDefined(config, "webhookToken", emptyToUndefined(Deno.env.get("WEBHOOK_TOKEN")));
  return config;
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function emptyToUndefined(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

function parseInteger(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function setIfDefined<K extends keyof Config>(
  config: Config,
  key: K,
  value: Config[K],
): void {
  if (value !== undefined) {
    config[key] = value;
  }
}
