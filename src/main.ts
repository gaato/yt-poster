import { loadConfig } from "./config.ts";
import { startDiscordBot } from "./discord.ts";
import { startHttpServer } from "./http.ts";
import { PosterService } from "./poster.ts";
import { StateStore } from "./state.ts";

if (import.meta.main) {
  const config = loadConfig();
  const store = new StateStore(config.databasePath);
  const poster = new PosterService(config, store);

  startHttpServer(config, poster);
  startDiscordBot(config, poster);
}
