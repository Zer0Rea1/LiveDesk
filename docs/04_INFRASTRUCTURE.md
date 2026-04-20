# Infrastructure — Docker, Nginx

No Mediamtx needed. Your VPS runs Node.js + FFmpeg only and pushes directly to your existing SRT server.

---

## Docker Compose — `infra/docker-compose.yml`

```yaml
version: '3.8'

services:
  # PostgreSQL database
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: srtlive
      POSTGRES_USER: srtlive
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U srtlive"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - internal

  # Node.js API + WebSocket bridge + FFmpeg
  backend:
    build:
      context: ../backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://srtlive:${DB_PASSWORD}@db:5432/srtlive
      JWT_SECRET: ${JWT_SECRET}
      ADMIN_JWT_SECRET: ${ADMIN_JWT_SECRET}
      ADMIN_PASSWORD_HASH: ${ADMIN_PASSWORD_HASH}
      SRT_SERVER_HOST: ${SRT_SERVER_HOST}
      SRT_SERVER_PORT: ${SRT_SERVER_PORT}
      SRT_LATENCY_MS: ${SRT_LATENCY_MS:-200}
      PORT: 3000
      CORS_ORIGIN: https://admin.yourdomain.com
      REPORTER_BASE_URL: https://yourdomain.com
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "3000:3000"
    networks:
      - internal
      - external
    restart: unless-stopped

  # Admin React frontend (pre-built static files served by nginx inside container)
  admin-frontend:
    build:
      context: ../frontend-admin
      dockerfile: Dockerfile
    networks:
      - external
    restart: unless-stopped

  # Nginx reverse proxy — HTTPS termination, WebSocket upgrade, static files
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
      - admin-frontend
    networks:
      - external
    restart: unless-stopped

volumes:
  pgdata:

networks:
  internal:
    internal: true
  external:
```

### `.env` for Docker Compose (create in `infra/`)

```bash
DB_PASSWORD=strong-random-password

# Generate with: openssl rand -hex 32
JWT_SECRET=abc123...
ADMIN_JWT_SECRET=xyz789...

# Generate with: node -e "require('bcryptjs').hash('yourpassword',12).then(console.log)"
ADMIN_PASSWORD_HASH=$2a$12$...

# Your existing SRT server
SRT_SERVER_HOST=your.srt-server.com
SRT_SERVER_PORT=9998
SRT_LATENCY_MS=200
```

---

## Backend Dockerfile — `backend/Dockerfile`

FFmpeg must be installed in the container since the bridge spawns it per stream.

```dockerfile
FROM node:20-alpine

# Install FFmpeg with libx264 and SRT support
# The edge/community repos have a more complete FFmpeg build
RUN apk add --no-cache --repository=https://dl-cdn.alpinelinux.org/alpine/edge/community ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Verify FFmpeg has SRT support at build time
RUN ffmpeg -protocols 2>&1 | grep -q srt || (echo "FFmpeg missing SRT support" && exit 1)

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

If the Alpine FFmpeg doesn't have SRT, use a static build instead:

```dockerfile
FROM node:20-alpine

# Download static FFmpeg build with full codec support including SRT
RUN apk add --no-cache wget xz && \
    wget -q https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linuxarm64-gpl.tar.xz && \
    tar -xf ffmpeg-*.tar.xz && \
    mv ffmpeg-*/bin/ffmpeg /usr/local/bin/ffmpeg && \
    rm -rf ffmpeg-* && \
    apk del wget xz

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## Admin Frontend Dockerfile — `frontend-admin/Dockerfile`

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# SPA routing — all paths serve index.html
RUN echo 'server { listen 80; root /usr/share/nginx/html; location / { try_files $uri /index.html; } }' \
    > /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## Nginx Config — `infra/nginx.conf`

```nginx
events {
  worker_connections 1024;
}

http {
  # Reporter page + API + WebSocket bridge
  server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Reporter HTML page — served by Node.js from frontend-reporter/index.html
    location /live {
      proxy_pass http://backend:3000/live;
      proxy_set_header Host $host;
    }

    # REST API
    location /api/ {
      proxy_pass http://backend:3000/api/;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket SRT bridge — CRITICAL: must set Upgrade headers and remove timeouts
    location /stream {
      proxy_pass http://backend:3000/stream;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;

      # No timeouts — streams can run for hours
      proxy_read_timeout 86400s;
      proxy_send_timeout 86400s;
      proxy_connect_timeout 15s;

      # Larger buffers for video data chunks
      proxy_buffers 32 256k;
      proxy_buffer_size 256k;
    }

    # Health check
    location /health {
      proxy_pass http://backend:3000/health;
    }
  }

  # Admin panel — separate subdomain
  server {
    listen 443 ssl;
    server_name admin.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/admin.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.yourdomain.com/privkey.pem;

    # Serve built React app from admin-frontend container
    location / {
      proxy_pass http://admin-frontend:80;
      proxy_set_header Host $host;
    }

    # Admin API calls proxied to backend
    location /api/ {
      proxy_pass http://backend:3000/api/;
      proxy_set_header Host $host;
    }
  }

  # HTTP → HTTPS redirect
  server {
    listen 80;
    server_name yourdomain.com admin.yourdomain.com;
    return 301 https://$host$request_uri;
  }
}
```

---

## Firewall Rules (UFW)

Only these ports need to be open on your VPS. Your SRT server's port does NOT need to be open on the VPS — FFmpeg connects outbound to it.

```bash
sudo ufw allow 22      # SSH
sudo ufw allow 80      # HTTP (redirects to HTTPS)
sudo ufw allow 443     # HTTPS (reporters + admin)
sudo ufw enable
sudo ufw status
```

Note: Port 9998 (SRT) does NOT need to be open on your VPS. FFmpeg makes an outbound connection to your SRT server. Only your SRT server needs to have its port open.

---

## SSL Certificate

```bash
sudo apt install -y certbot
sudo certbot certonly --standalone \
  -d yourdomain.com \
  -d admin.yourdomain.com

# Auto-renewal cron
(crontab -l; echo "0 3 * * * certbot renew --quiet") | crontab -
```
