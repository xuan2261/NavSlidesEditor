FROM node:22.22.0-bookworm-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94 AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY website/package.json ./website/
COPY vendor-overrides/ ./vendor-overrides/
RUN npm ci --ignore-scripts

COPY client/ ./client/
COPY server/ ./server/
COPY shared/ ./shared/
COPY scripts/ ./scripts/
RUN npm run vendor
RUN npm run build

FROM node:22.22.0-bookworm-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94 AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates rclone \
  && rm -rf /var/lib/apt/lists/*

COPY vendor-overrides/ ./vendor-overrides/
COPY server/package.json ./server/package.json
COPY shared/ ./shared/
COPY electron/server-package-lock.json ./electron/server-package-lock.json
COPY scripts/electron-server-dependencies.js ./scripts/electron-server-dependencies.js
COPY scripts/prepare-electron.js ./scripts/prepare-electron.js
RUN node scripts/prepare-electron.js

WORKDIR /app/server
RUN npx playwright install --with-deps chromium
WORKDIR /app

COPY server/ ./server/
COPY --from=builder /app/server/vendor ./server/vendor
COPY --from=builder /app/client/dist ./client/dist
COPY scripts/verify-runtime-closure.js ./scripts/verify-runtime-closure.js
RUN node scripts/verify-runtime-closure.js --require-client-dist

VOLUME ["/app/server/data", "/app/server/uploads"]
ENV PORT=3002
EXPOSE 3002

CMD ["sh", "-c", "node scripts/verify-runtime-closure.js --require-client-dist && node server/index.js"]
