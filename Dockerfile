FROM node:22.22.0-bookworm-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94 AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY website/package.json ./website/
COPY vendor-overrides/ ./vendor-overrides/
RUN npm ci --ignore-scripts

FROM dependencies AS vendor-builder
COPY server/ ./server/
COPY shared/ ./shared/
COPY scripts/ ./scripts/
COPY electron/server-package-lock.json ./electron/server-package-lock.json
RUN npm run vendor

FROM vendor-builder AS source-client
ARG BUILD_SUBJECT_SHA=0000000000000000000000000000000000000000
ARG BUILD_DIRTY=true
COPY client/ ./client/
RUN BUILD_SUBJECT_SHA="${BUILD_SUBJECT_SHA}" BUILD_DIRTY="${BUILD_DIRTY}" npm run build

FROM vendor-builder AS prebuilt-client
ARG BUILD_SUBJECT_SHA
COPY .tmp/ci-client-artifact/ ./.tmp/ci-client-artifact/
RUN SUBJECT="${BUILD_SUBJECT_SHA:-$(node -e 'console.log(JSON.parse(require("fs").readFileSync(".tmp/ci-client-artifact/client-dist-manifest.json","utf8")).subject.sha)')}" && \
  node scripts/ci/verify-client-dist-manifest.mjs \
  --root .tmp/ci-client-artifact/client/dist \
  --manifest .tmp/ci-client-artifact/client-dist-manifest.json \
  --subject "${SUBJECT}" \
  --dirty false \
  --build-command "npm run build" \
  --lock workspace=package-lock.json \
  --lock electron-server=electron/server-package-lock.json

FROM node:22.22.0-bookworm-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94 AS runtime
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
COPY --from=vendor-builder /app/server/vendor ./server/vendor
COPY scripts/verify-runtime-closure.js ./scripts/verify-runtime-closure.js
COPY scripts/ci/artifact-manifest-runtime.cjs ./scripts/ci/artifact-manifest-runtime.cjs

RUN groupadd --gid 10001 navslides \
  && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin navslides \
  && mkdir -p /app/server/data /app/server/uploads \
  && chown -R 10001:10001 /app/server/data /app/server/uploads

VOLUME ["/app/server/data", "/app/server/uploads"]
ENV PORT=3002
EXPOSE 3002
USER 10001:10001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3002/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["sh", "-c", "node scripts/verify-runtime-closure.js --require-client-dist && node server/index.js"]

FROM runtime AS production-prebuilt
COPY --from=prebuilt-client /app/.tmp/ci-client-artifact/client/dist ./client/dist
COPY --from=prebuilt-client /app/.tmp/ci-client-artifact/client-dist-manifest.json ./
RUN node scripts/verify-runtime-closure.js --require-client-dist

FROM runtime AS production
COPY --from=source-client /app/client/dist ./client/dist
COPY --from=source-client /app/client-dist-manifest.json ./
RUN node scripts/verify-runtime-closure.js --require-client-dist
