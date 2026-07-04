# ADR-001: Browser-First Paste-To-Post With Small Hexagonal Architecture

## Status

Accepted

## Date

2026-07-04

## Context

yt-poster started as a Discord bot because pasting a YouTube link into a dedicated channel was
low-friction. The new version also needs OAuth 2.0 with X, thumbnail upload, previewable post text,
and a LAN HTTPS deployment on Rock 5 ITX. Discord remains useful, but making it the center of the
system couples the posting workflow to Discord gateway behavior and privileged message-content
decisions.

The primary user workflow should be nearly as short as the Discord flow:

1. Open `https://yt-poster.home.gaato.net`.
2. Paste a YouTube URL.
3. See the title, thumbnail, and post text immediately.
4. Press Enter or Post.

## Decision

Use the browser paste-to-post UI as the primary workflow.

Structure the application as a small hexagonal architecture:

- Inbound adapters: Fresh web UI/API, Discord slash command, webhook API.
- Application core: preview share, post draft, account connect/disconnect, warning and duplicate
  detection.
- Outbound ports: YouTube metadata, X publisher, draft/post/account store.
- Outbound adapters: YouTube Data API, `twitter-api-v2`, SQLite.

Fresh and discordeno are not application core dependencies. They parse external input and call
application services. X SDK response types and SQLite rows are converted at the adapter boundary
before they reach the core.

## Alternatives Considered

### Discord As Primary Workflow

- Pros: Lowest historical friction; paste and send.
- Cons: Harder to preview before posting; channel listener needs message content considerations;
  OAuth and account settings still need a web surface.
- Rejected as the primary workflow, but kept as a secondary ingress.

### Full SaaS-Style Multi-User App

- Pros: Clean per-user account separation.
- Cons: Adds user auth, session management, and token stewardship that are not needed for a private
  LAN tool.
- Rejected for now. The app keeps a default X account with disconnect/reconnect.

### Plain Deno HTTP Without Fresh

- Pros: Minimal dependencies.
- Cons: Gives up a useful Deno-native web app structure just as the browser UI becomes the primary
  product surface.
- Rejected. Fresh is used as the web ingress adapter, not as the core.

## Consequences

- Browser `/` owns the main UX: paste, preview, Enter/Post.
- `/api/preview` creates a short-lived draft stored in SQLite.
- `/api/drafts/:id/post` posts through the same core used by Discord/webhook.
- SQLite stores drafts and post attempts for duplicate detection and debugging.
- X account switching is handled by disconnecting and reconnecting the default OAuth account.
- Rock 5 ITX deployment publishes the app at `https://yt-poster.home.gaato.net` through Traefik.
