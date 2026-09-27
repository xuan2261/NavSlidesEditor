FROM node:22.23.3-trixie-slim@sha256:b26b04c123d9ff8ab646ceb18b9d75a1173acf64b9a401094b906d27b29338d4 AS dependencies
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

FROM node:22.23.3-trixie-slim@sha256:b26b04c123d9ff8ab646ceb18b9d75a1173acf64b9a401094b906d27b29338d4 AS rclone-builder
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl tar \
  && rm -rf /var/lib/apt/lists/*

RUN set -eu; \
  architecture="$(dpkg --print-architecture)"; \
  case "$architecture" in \
    amd64) checksum=09c9f7606ed9e31eecc1eec26a89992cf2931a8d2d1a5f0ae2bb1c11630ffb15 ;; \
    arm64) checksum=773f3a76615f91f7d4654183a537afddce3343c8d99ac1d74984f060f2ade2d9 ;; \
    *) printf 'unsupported rclone artifact architecture: %s\n' "$architecture" >&2; exit 1 ;; \
  esac; \
  curl -fsSL "https://downloads.rclone.org/v1.75.1/rclone-v1.75.1-linux-${architecture}.deb" -o /tmp/rclone.deb; \
  printf '%s  %s\n' "$checksum" /tmp/rclone.deb | sha256sum --check --strict -; \
  test "$(dpkg-deb --field /tmp/rclone.deb Architecture)" = "$architecture"; \
  curl -fsSL https://downloads.rclone.org/v1.75.1/rclone-v1.75.1.tar.gz -o /tmp/rclone-source.tar.gz; \
  printf '%s  %s\n' 6ada25ecda8b3c8d971ed0aae1167e44d257dbcbf0be6598bf6c127daca2e13f /tmp/rclone-source.tar.gz | sha256sum --check --strict -; \
  mkdir -p /tmp/rclone-source; \
  tar -xzf /tmp/rclone-source.tar.gz -C /tmp/rclone-source rclone-v1.75.1/COPYING; \
  dpkg-deb --extract /tmp/rclone.deb /tmp/rclone-package; \
  test -x /tmp/rclone-package/usr/bin/rclone; \
  test -s /tmp/rclone-source/rclone-v1.75.1/COPYING; \
  rclone_bin=/tmp/rclone-package/usr/bin/rclone; \
  mkdir -p /tmp/rclone-smoke/source/subdirectory; \
  printf 'smoke\n' > /tmp/rclone-smoke/source/file; \
  printf '[smoke]\ntype = local\n' > /tmp/rclone-smoke.conf; \
  "$rclone_bin" version; \
  "$rclone_bin" obscure local-smoke-password >/dev/null; \
  test "$(RCLONE_CONFIG=/tmp/rclone-smoke.conf "$rclone_bin" listremotes)" = 'smoke:'; \
  RCLONE_CONFIG=/tmp/rclone-smoke.conf "$rclone_bin" lsd smoke:/tmp/rclone-smoke/source >/dev/null; \
  RCLONE_CONFIG=/tmp/rclone-smoke.conf "$rclone_bin" sync /tmp/rclone-smoke/source smoke:/tmp/rclone-smoke/destination --progress; \
  cmp /tmp/rclone-smoke/source/file /tmp/rclone-smoke/destination/file; \
  rm -rf /tmp/rclone-package /tmp/rclone-smoke /tmp/rclone-smoke.conf /tmp/rclone-source.tar.gz
FROM node:22.23.3-trixie-slim@sha256:b26b04c123d9ff8ab646ceb18b9d75a1173acf64b9a401094b906d27b29338d4 AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY --from=rclone-builder /tmp/rclone.deb /tmp/rclone.deb
RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get install -y --no-install-recommends ca-certificates /tmp/rclone.deb \
  && rm -rf /var/lib/apt/lists/* /tmp/rclone.deb

COPY --from=rclone-builder /tmp/rclone-source/rclone-v1.75.1/COPYING /usr/share/doc/rclone/copyright
COPY vendor-overrides/ ./vendor-overrides/
COPY server/package.json ./server/package.json
COPY shared/ ./shared/
COPY electron/server-package-lock.json ./electron/server-package-lock.json
COPY scripts/electron-server-dependencies.js ./scripts/electron-server-dependencies.js
COPY scripts/prepare-electron.js ./scripts/prepare-electron.js
RUN node scripts/prepare-electron.js

WORKDIR /app/server
RUN set -x; \
  npx playwright install --with-deps chromium \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
  && test -x /usr/local/bin/node \
  && ! command -v npm >/dev/null 2>&1 \
  && ! command -v npx >/dev/null 2>&1 \
  && rclone version >/dev/null \
  && node -e "require('playwright').chromium.launch().then((browser) => browser.close()).catch(() => process.exit(1))"
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
