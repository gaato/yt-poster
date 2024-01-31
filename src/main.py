import os
import re
from typing import Optional

import discord
import dotenv

dotenv.load_dotenv()

intents = discord.Intents.default()
intents.message_content = True
bot = discord.Bot(intents=intents)

CHANNEL_ID = int(os.environ["CHANNEL_ID"])


def convert_youtube_url(url: str) -> Optional[str]:
    youtube_short_url_format = "https://youtu.be/{}"

    youtube_url_pattern = re.compile(
        r"(https?://)?(www\.|m\.)?youtube\.com/(watch\?v=|live/|shorts/)([^&\s/?]+)|"
        r"(https?://)?youtu\.be/([^&\s/?]+)"
    )

    match = youtube_url_pattern.match(url)
    if match:
        video_id = match.group(4) or match.group(6)
        return youtube_short_url_format.format(video_id)
    else:
        return None


@bot.event
async def on_ready():
    print(f"Logged in as {bot.user.name} ({bot.user.id})")


@bot.event
async def on_message(message: discord.Message):
    if message.author.bot:
        return
    if message.channel.id != CHANNEL_ID:
        return

    print(f"{message.author.name}: {message.content}")
    youtube_url = convert_youtube_url(message.content)
    if youtube_url is None:
        return

    await message.channel.send(youtube_url)


bot.run(os.environ["DISCORD_BOT_TOKEN"])
