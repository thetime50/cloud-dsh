FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.9.5 /uv /opt/runtime/uv/uv

WORKDIR /opt/cloud-dsh
COPY package.json ./
COPY src ./src
COPY test/stub-dsh.mjs ./test/stub-dsh.mjs
COPY apps /opt/apps

ENV NODE_NO_WARNINGS=1 \
    CLOUD_DSH_GATEWAY_HOST=0.0.0.0 \
    CLOUD_DSH_GATEWAY_PORT=8080 \
    CLOUD_DSH_STORAGE=/storage \
    CLOUD_DSH_PRIVATE=/private \
    CLOUD_DSH_APPS=/opt/apps \
    CLOUD_DSH_DB=/private/infrastructure/control.db \
    CLOUD_DSH_SANDBOX_LOG=/private/infrastructure/sandbox.ndjson \
    CLOUD_DSH_SANDBOX_BIN=/opt/cloud-dsh/src/sandbox-run.ts \
    CLOUD_DSH_RUNTIME=/opt/runtime \
    CLOUD_DSH_UV=/opt/runtime/uv/uv

EXPOSE 8080
VOLUME ["/storage", "/private"]
CMD ["node", "--experimental-strip-types", "src/index.ts"]
