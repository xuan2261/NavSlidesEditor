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
FROM node:20-alpine
WORKDIR /app

# Install rclone for cloud sync (Proton Drive, etc.)
RUN apk add --no-cache rclone

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
ENV PORT=3002
EXPOSE 3002

CMD ["node", "server/index.js"]
