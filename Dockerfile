# Build stage: compile the React client
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY scripts/ ./scripts/

RUN npm ci --ignore-scripts

# Copy source and build the client
COPY client/ ./client/
COPY server/ ./server/
COPY shared/ ./shared/
RUN npm run vendor
RUN npm run build

# Production stage
FROM mcr.microsoft.com/playwright:v1.59.1-noble
WORKDIR /app

# Install rclone for cloud sync (Proton Drive, etc.)
RUN apt-get update \
  && apt-get install -y --no-install-recommends rclone \
  && rm -rf /var/lib/apt/lists/*

# Copy workspace manifests
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/

# Install only server (production) dependencies
RUN npm ci --workspace=server --omit=dev --ignore-scripts

# Copy server source and the compiled client
COPY server/ ./server/
COPY shared/ ./shared/
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/vendor ./server/vendor

# Persist uploaded images and presentation data via a named volume
VOLUME ["/app/server/data", "/app/server/uploads"]

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PORT=3002
EXPOSE 3002

CMD ["node", "server/index.js"]
