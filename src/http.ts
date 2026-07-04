import { App } from "fresh";
import type { Config } from "./config.ts";
import type { PosterService } from "./poster.ts";

export function startHttpServer(config: Config, poster: PosterService): Deno.HttpServer {
  const fresh = new App()
    .get("/", () => html(renderHomePage(poster)));
  const freshHandler = fresh.handler();

  return Deno.serve({ hostname: config.host, port: config.port }, async (request) => {
    const url = new URL(request.url);

    try {
      if (request.method === "GET" && url.pathname === "/" && url.searchParams.has("token")) {
        return redirectWithSessionCookie(url, config);
      }

      if (request.method === "GET" && url.pathname === "/") {
        return await freshHandler(request);
      }

      if (request.method === "GET" && url.pathname === "/health") {
        return json({ ok: true });
      }

      if (request.method === "GET" && url.pathname === "/auth/x/start") {
        const accountId = url.searchParams.get("account") ?? undefined;
        const returnTo = safeReturnTo(url.searchParams.get("return_to"));
        const redirect = await poster.createXAuthorizationUrl(accountId, returnTo);
        return Response.redirect(redirect, 302);
      }

      if (request.method === "GET" && url.pathname === "/auth/x/callback") {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) {
          return json({ error: "missing code or state" }, 400);
        }
        const completion = await poster.completeXAuthorization(code, state);
        return redirectAfterAuthorization(new URL(safeReturnTo(completion.returnTo), url), config);
      }

      if (request.method === "GET" && url.pathname === "/settings") {
        return html(renderSettingsPage(poster));
      }

      if (request.method === "POST" && url.pathname === "/settings/x/disconnect") {
        requireSessionAuth(config, request);
        poster.accounts.disconnectDefaultAccount();
        return Response.redirect(new URL("/settings", url), 303);
      }

      if (request.method === "POST" && url.pathname === "/api/preview") {
        const body = await request.json() as unknown;
        if (!isRecord(body) || typeof body.url !== "string") {
          return json({ error: "body.url is required" }, 400);
        }
        const draft = await poster.previewYouTubeVideo({
          url: body.url,
          source: "web",
        });
        return json({ draft });
      }

      const postDraftMatch = url.pathname.match(/^\/api\/drafts\/([^/]+)\/post$/);
      if (request.method === "POST" && postDraftMatch) {
        const draftId = postDraftMatch[1];
        if (!draftId) {
          return json({ error: "missing draft id" }, 400);
        }
        requireSessionAuth(config, request);
        const body = await request.json().catch(() => ({})) as unknown;
        const allowWarnings = isRecord(body) && body.allowWarnings === true;
        const result = await poster.postDraft(draftId, allowWarnings);
        return json({
          postUrl: result.post.url,
          videoUrl: result.video.url,
          title: result.video.title,
        });
      }

      if (request.method === "POST" && url.pathname === "/watch") {
        requireWebhookAuth(config, request);
        const body = await request.json() as unknown;
        if (!isRecord(body) || typeof body.url !== "string") {
          return json({ error: "body.url is required" }, 400);
        }
        const postInput = {
          url: body.url,
          source: "webhook",
          ...(typeof body.requestedBy === "string" ? { requestedBy: body.requestedBy } : {}),
          ...(typeof body.xAccountId === "string" ? { xAccountId: body.xAccountId } : {}),
        } as const;
        const result = await poster.postYouTubeVideo(postInput);
        return json({
          postUrl: result.post.url,
          videoUrl: result.video.url,
          title: result.video.title,
        });
      }

      return json({ error: "not found" }, 404);
    } catch (error) {
      console.error(error);
      return json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
  });
}

function requireSessionAuth(config: Config, request: Request): void {
  if (!config.webhookToken) {
    return;
  }
  const expected = `Bearer ${config.webhookToken}`;
  const cookieToken = parseCookies(request.headers.get("cookie")).yt_poster_token;
  if (request.headers.get("authorization") !== expected && cookieToken !== config.webhookToken) {
    throw new HttpError("unauthorized", 401);
  }
}

const requireWebhookAuth = requireSessionAuth;

class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function json(value: unknown, status = 200): Response {
  const body = value instanceof HttpError ? { error: value.message } : value;
  return new Response(JSON.stringify(body), {
    status: value instanceof HttpError ? value.status : status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function html(body: string): Response {
  return new Response(body.startsWith("<!doctype html>") ? body : minimalDocument(body), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function redirectWithSessionCookie(url: URL, config: Config): Response {
  if (!config.webhookToken || url.searchParams.get("token") !== config.webhookToken) {
    return json({ error: "invalid token" }, 401);
  }
  const redirectUrl = new URL(url);
  redirectUrl.searchParams.delete("token");
  return new Response(null, {
    status: 303,
    headers: {
      location: redirectUrl.toString(),
      "set-cookie": sessionCookie(config.webhookToken),
    },
  });
}

function redirectAfterAuthorization(url: URL, config: Config): Response {
  const headers = new Headers({ location: url.toString() });
  if (config.webhookToken) {
    headers.set("set-cookie", sessionCookie(config.webhookToken));
  }
  return new Response(null, { status: 303, headers });
}

function sessionCookie(token: string): string {
  return [
    `yt_poster_token=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=31536000",
  ].join("; ");
}

function safeReturnTo(value: string | undefined | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

function minimalDocument(body: string): string {
  return `<!doctype html><meta charset="utf-8"><body>${body}</body>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseCookies(value: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of value?.split(";") ?? []) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey || rest.length === 0) {
      continue;
    }
    cookies[rawKey] = decodeURIComponent(rest.join("="));
  }
  return cookies;
}

function renderHomePage(poster: PosterService): string {
  const account = poster.accounts.getDefaultAccount();
  const accountLabel = account?.username ? `@${account.username}` : account?.id ?? "not connected";
  const accountHref = account ? "/settings" : "/auth/x/start?return_to=/";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>yt-poster</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; background: Canvas; color: CanvasText; }
    main { width: min(760px, calc(100% - 32px)); margin: 48px auto; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    h1 { font-size: 24px; margin: 0 0 24px; letter-spacing: 0; }
    a { color: LinkText; }
    form { display: grid; gap: 12px; }
    input { font: inherit; font-size: 18px; padding: 14px 16px; border: 1px solid color-mix(in srgb, CanvasText 25%, transparent); border-radius: 8px; background: Canvas; color: CanvasText; }
    button { font: inherit; padding: 12px 16px; border: 0; border-radius: 8px; background: #1d9bf0; color: white; cursor: pointer; }
    button:disabled { opacity: .45; cursor: not-allowed; }
    .status { min-height: 24px; color: color-mix(in srgb, CanvasText 65%, transparent); }
    .preview { display: grid; gap: 16px; margin-top: 24px; }
    .preview-card { border: 1px solid color-mix(in srgb, CanvasText 18%, transparent); border-radius: 8px; overflow: hidden; }
    .preview-card img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; background: color-mix(in srgb, CanvasText 10%, Canvas); }
    .preview-body { padding: 16px; display: grid; gap: 12px; }
    .title { font-weight: 700; font-size: 18px; }
    pre { white-space: pre-wrap; margin: 0; font: inherit; color: color-mix(in srgb, CanvasText 78%, transparent); }
    .warnings { display: grid; gap: 8px; }
    .warning { padding: 10px 12px; border-radius: 8px; background: color-mix(in srgb, #f59e0b 22%, Canvas); }
    .result { margin-top: 16px; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>yt-poster</h1>
      <a href="${accountHref}">${escapeHtml(accountLabel)}</a>
    </header>
    <form id="post-form">
      <input id="url-input" name="url" autocomplete="off" autofocus placeholder="Paste a YouTube URL and press Enter">
      <button id="post-button" type="submit" disabled>Post</button>
    </form>
    <div id="status" class="status"></div>
    <section id="preview" class="preview"></section>
    <div id="result" class="result"></div>
  </main>
  <script>
    const form = document.querySelector("#post-form");
    const input = document.querySelector("#url-input");
    const button = document.querySelector("#post-button");
    const status = document.querySelector("#status");
    const preview = document.querySelector("#preview");
    const result = document.querySelector("#result");
    let timer = 0;
    let draft = null;
    const params = new URLSearchParams(location.search);
    if (params.has("url")) {
      input.value = params.get("url");
      queuePreview(0);
    }
    input.addEventListener("input", () => queuePreview(300));
    input.addEventListener("paste", () => queuePreview(0));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!draft) return;
      button.disabled = true;
      status.textContent = "Posting...";
      result.textContent = "";
      const response = await fetch("/api/drafts/" + encodeURIComponent(draft.id) + "/post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ allowWarnings: false }),
      });
      const body = await response.json();
      if (!response.ok) {
        status.textContent = body.error === "unauthorized"
          ? "Reconnect X, then try posting again."
          : body.error ?? "Post failed";
        button.disabled = false;
        return;
      }
      status.textContent = "Posted";
      result.innerHTML = '<a href="' + escapeAttr(body.postUrl) + '">' + escapeHtml(body.postUrl) + '</a>';
      input.value = "";
      draft = null;
      preview.innerHTML = "";
    });
    function queuePreview(delay) {
      clearTimeout(timer);
      timer = setTimeout(loadPreview, delay);
    }
    async function loadPreview() {
      const url = input.value.trim();
      draft = null;
      result.textContent = "";
      button.disabled = true;
      if (!url) {
        status.textContent = "";
        preview.innerHTML = "";
        return;
      }
      status.textContent = "Loading preview...";
      const response = await fetch("/api/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = await response.json();
      if (!response.ok) {
        status.textContent = body.error ?? "Preview failed";
        preview.innerHTML = "";
        return;
      }
      draft = body.draft;
      renderPreview(draft);
      status.textContent = draft.warnings.length ? "Needs attention" : "Ready";
      button.disabled = draft.warnings.length > 0;
    }
    function renderPreview(value) {
      const warnings = value.warnings.map((warning) =>
        '<div class="warning">' + escapeHtml(warning.message) + '</div>'
      ).join("");
      preview.innerHTML =
        '<div class="preview-card">' +
        '<img src="' + escapeAttr(value.thumbnailUrl) + '" alt="">' +
        '<div class="preview-body">' +
        '<div class="title">' + escapeHtml(value.title) + '</div>' +
        '<pre>' + escapeHtml(value.postText) + '</pre>' +
        (warnings ? '<div class="warnings">' + warnings + '</div>' : '') +
        '</div></div>';
    }
    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
      }[char]));
    }
    function escapeAttr(value) { return escapeHtml(value); }
  </script>
</body>
</html>`;
}

function renderSettingsPage(poster: PosterService): string {
  const account = poster.accounts.getDefaultAccount();
  const accountHtml = account
    ? `<p>Connected as ${escapeHtml(account.username ? `@${account.username}` : account.id)}.</p>
       <form method="post" action="/settings/x/disconnect"><button type="submit">Disconnect</button></form>`
    : `<p>No X account is connected.</p>`;
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>yt-poster settings</title></head>
<body>
  <main>
    <h1>Settings</h1>
    ${accountHtml}
    <p><a href="/auth/x/start?return_to=/settings">Connect or reconnect with X</a></p>
    <p><a href="/">Back</a></p>
  </main>
</body>
</html>`;
}
