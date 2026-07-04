import {
  ApplicationCommandOptionTypes,
  ApplicationCommandTypes,
  createBot,
  Intents,
} from "discordeno";
import type { Config } from "./config.ts";
import type { PosterService } from "./poster.ts";

export function startDiscordBot(config: Config, poster: PosterService): void {
  if (!config.discordBotToken) {
    console.log("Discord bot disabled: DISCORD_BOT_TOKEN is not set");
    return;
  }

  const bot = createBot({
    token: config.discordBotToken,
    intents: Intents.Guilds,
    desiredProperties: {
      interaction: {
        id: true,
        token: true,
        type: true,
        data: true,
        user: true,
        member: true,
        respond: true,
        defer: true,
        edit: true,
      },
      user: {
        id: true,
      },
      member: {
        user: true,
      },
    } as const,
    events: {
      ready: async () => {
        const command = {
          name: "watch",
          description: "Post a YouTube video to X with its thumbnail",
          type: ApplicationCommandTypes.ChatInput,
          options: [{
            name: "url",
            description: "YouTube, youtu.be, or Holodex watch URL",
            type: ApplicationCommandOptionTypes.String,
            required: true,
          }],
        };

        if (config.discordGuildId) {
          await bot.helpers.upsertGuildApplicationCommands(config.discordGuildId, [command]);
        } else {
          await bot.helpers.upsertGlobalApplicationCommands([command]);
        }
        console.log("Discord bot ready");
      },
      interactionCreate: async (interaction) => {
        if (interaction.data?.name !== "watch") {
          return;
        }

        const url = interaction.data.options?.find((option) => option.name === "url")?.value;
        if (typeof url !== "string") {
          await interaction.respond("Missing url option.", { isPrivate: true });
          return;
        }

        await interaction.defer();
        try {
          const requestedBy = interaction.user?.id?.toString() ??
            interaction.member?.user?.id?.toString();
          const result = await poster.postYouTubeVideo({
            url,
            source: "discord",
            ...(requestedBy ? { requestedBy } : {}),
          });
          await interaction.edit(`Posted: ${result.post.url}`);
        } catch (error) {
          console.error(error);
          await interaction.edit(
            `Failed to post: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      },
    },
  });

  bot.start();
}
