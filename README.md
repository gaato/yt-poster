# yt-poster

Private Deno/TypeScript app that posts a YouTube stream or video to X with the video thumbnail
attached.

## Shape

- Browser-first paste-to-post UI with realtime preview
- Discord `/watch url:` slash command as a secondary ingress
- HTTP webhook for automation and Shortcuts
- X OAuth 2.0 PKCE
- YouTube Data API metadata lookup
- SQLite state for X tokens, share drafts, and post history
- LAN HTTPS deployment behind Traefik at `yt-poster.home.gaato.net`

## Development

```bash
deno task check
deno task test
deno task dev
```

Create `.env` or export the required variables:

```env
YT_POSTER_BASE_URL=http://127.0.0.1:8080
YT_POSTER_DATABASE_PATH=./data/yt-poster.sqlite
YOUTUBE_API_KEY=...
X_CLIENT_ID=...
X_CLIENT_SECRET=
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=
WEBHOOK_TOKEN=...
```

Start X authorization by opening:

```text
http://127.0.0.1:8080/auth/x/start
```

Use the browser UI:

```text
http://127.0.0.1:8080/?token=<WEBHOOK_TOKEN>
```

The token parameter sets a local session cookie for posting mutations. Paste a YouTube URL into the
input; the page fetches a preview and posts when you press Enter or the Post button.

Post through the webhook:

```bash
curl -H "Authorization: Bearer $WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://youtu.be/dQw4w9WgXcQ"}' \
  http://127.0.0.1:8080/watch
```

On Rock 5 ITX, configure X OAuth with this callback URL:

```text
https://yt-poster.home.gaato.net/auth/x/callback
```

The container listens on `127.0.0.1:8084` through rootless Quadlet, and Traefik publishes
`https://yt-poster.home.gaato.net`.

## License

BlueOak-1.0.0
