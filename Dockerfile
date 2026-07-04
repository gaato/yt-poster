FROM docker.io/denoland/deno:alpine-2.9.1

WORKDIR /app

COPY deno.json deno.lock* ./
COPY src ./src

RUN deno cache --node-modules-dir=auto src/main.ts

ENV YT_POSTER_HOST=0.0.0.0
ENV YT_POSTER_PORT=8080
ENV YT_POSTER_DATABASE_PATH=/data/yt-poster/yt-poster.sqlite

VOLUME ["/data/yt-poster"]
EXPOSE 8080

CMD ["run", "--allow-env", "--allow-net", "--allow-read", "--allow-write", "--allow-sys", "src/main.ts"]
