# ── Stage 1: Build frontend ──────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ── Stage 2: Build backend ──────────────────────────────────────────
FROM node:20-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .
RUN npx prisma generate --schema=src/prisma/schema.prisma
RUN npm run build

# ── Stage 3: Production image ───────────────────────────────────────
FROM node:20-alpine

# FFmpeg with SRT + libx264 support, and openssl for self-signed certs
RUN apk add --no-cache \
    --repository=https://dl-cdn.alpinelinux.org/alpine/edge/community \
    ffmpeg openssl

WORKDIR /app

# Install production deps only
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copy prisma schema and generate client for production
COPY backend/src/prisma/schema.prisma ./backend/src/prisma/schema.prisma
RUN cd backend && npx prisma generate --schema=src/prisma/schema.prisma

# Copy compiled backend
COPY --from=backend-build /app/backend/dist ./backend/dist

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Generate default self-signed SSL certs (mount your own to override)
RUN mkdir -p /app/backend/certs && \
    openssl req -x509 -newkey rsa:2048 \
    -keyout /app/backend/certs/key.pem \
    -out /app/backend/certs/cert.pem \
    -days 365 -nodes \
    -subj "/CN=localhost"

# Create dirs for SQLite data and HLS output
RUN mkdir -p /app/backend/data /app/backend/hls_output

WORKDIR /app/backend

EXPOSE 3000

# Push schema to SQLite on startup, then run the server
CMD sh -c "npx prisma db push --schema=src/prisma/schema.prisma --skip-generate && node dist/index.js"
