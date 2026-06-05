# ── Stage 1: Build frontend ────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# ── Stage 2: Build backend + generate Prisma client ───────────────────────────
FROM node:20-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ .
RUN cd src && npx prisma generate --schema=prisma/schema.prisma
RUN npm run build

# ── Stage 3: Production image ──────────────────────────────────────────────────
# Using Debian instead of Alpine — FFmpeg with SRT support works out of the box
FROM node:20-bookworm-slim

# FFmpeg from Debian repos has SRT + libx264 built in, no dependency issues
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    openssl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && ffmpeg -protocols 2>&1 | grep -q srt \
    || (echo "ERROR: FFmpeg missing SRT support" && exit 1)

WORKDIR /app

# Install production backend deps
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# Copy Prisma schema + generated client from build stage
COPY backend/src/prisma/schema.prisma ./backend/src/prisma/schema.prisma
COPY --from=backend-build /app/backend/node_modules/.prisma ./backend/node_modules/.prisma
COPY --from=backend-build /app/backend/node_modules/@prisma/client ./backend/node_modules/@prisma/client

# Copy compiled backend
COPY --from=backend-build /app/backend/dist ./backend/dist

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Generate self-signed SSL cert
RUN mkdir -p /app/backend/certs && \
    openssl req -x509 -newkey rsa:2048 \
        -keyout /app/backend/certs/key.pem \
        -out    /app/backend/certs/cert.pem \
        -days 365 -nodes \
        -subj "/CN=localhost"

# Persistent data directories
RUN mkdir -p /app/backend/data /app/backend/hls_output

WORKDIR /app/backend

EXPOSE 3000

CMD sh -c "\
    echo '[startup] Running Prisma db push...' && \
    cd src && npx prisma db push \
        --schema=prisma/schema.prisma \
        --skip-generate \
        --accept-data-loss && \
    cd .. && \
    echo '[startup] Starting server...' && \
    node dist/index.js"
