# yt-poster

Posts what I'm watching on YouTube to Twitter/X. (personal use)

## Features

- Discord bot that monitors YouTube URLs in a specific channel
- Automatically posts to Twitter/X with video thumbnail
- Converts various YouTube URL formats to the short format
- Escapes @ mentions to prevent unwanted notifications

## Setup

### Prerequisites

- Python 3.11+
- uv (Python package manager)
- Discord Bot Token
- Twitter API credentials
- YouTube Data API key

### Installation

1. Install uv if you haven't already:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

2. Clone the repository and install dependencies:
```bash
git clone <repo-url>
cd yt-poster
uv sync
```

3. Create a `.env` file with your credentials:
```env
DISCORD_BOT_TOKEN=your_discord_bot_token
CHANNEL_ID=your_discord_channel_id
TWITTER_CONSUMER_KEY=your_twitter_consumer_key
TWITTER_CONSUMER_SECRET=your_twitter_consumer_secret
TWITTER_ACCESS_TOKEN=your_twitter_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_twitter_access_token_secret
YOUTUBE_API_KEY=your_youtube_api_key
```

### Running

Local development:
```bash
# Using uv directly
uv run python src/main.py

# Or using the convenience script
uv run python run.py

# Or using Make
make run
make dev
```

Docker:
```bash
# Manual
docker-compose up --build

# Or using Make
make build
make start
```

### Available Make Commands

- `make install` - Install dependencies
- `make run` - Run the application locally
- `make dev` - Run using the convenience script
- `make build` - Build Docker image
- `make start` - Start with Docker
- `make start-bg` - Start with Docker in background
- `make stop` - Stop Docker containers
- `make logs` - Show Docker logs
- `make check` - Check code syntax
- `make clean` - Clean up Docker and cache
- `make update` - Update dependencies

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DISCORD_BOT_TOKEN` | Your Discord bot token |
| `CHANNEL_ID` | Discord channel ID to monitor |
| `TWITTER_CONSUMER_KEY` | Twitter API consumer key |
| `TWITTER_CONSUMER_SECRET` | Twitter API consumer secret |
| `TWITTER_ACCESS_TOKEN` | Twitter API access token |
| `TWITTER_ACCESS_TOKEN_SECRET` | Twitter API access token secret |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key |
