# SRT Live Reporter System — Project Overview

## What This System Does

A news channel live streaming platform where:
- **Admin** generates one-time-use URLs with custom quality settings (bitrate, resolution, FPS)
- **Reporter** opens the URL in any browser, grants camera access, and streams live
- **Your VPS** receives WebSocket video from the browser, FFmpeg transcodes it, and pushes directly to your existing SRT server

## Architecture

```
[Reporter Browser]
        |
        | MediaRecorder chunks (WebM)
        | via WebSocket (wss://yourvps.com/stream)
        v
[Your VPS — Node.js + FFmpeg only]
        |
        | FFmpeg: WebM stdin → H.264/AAC → MPEG-TS → SRT output
        v
[Your Existing SRT Server :PORT]
        |
        v
[OBS / Playout / Broadcast System]
```

No Mediamtx. No relay. FFmpeg on your VPS pushes directly to your SRT server.

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend Admin | React (Vite) | Token generation and dashboard |
| Frontend Reporter | Vanilla HTML/JS | Lightweight page opened via shared link |
| Backend API | Node.js + Express | Token CRUD, auth, WebSocket bridge |
| Media Bridge | FFmpeg | Transcodes WebSocket chunks → SRT push |
| Database | PostgreSQL (via Prisma) | Token storage, usage tracking |
| Auth | JWT (jsonwebtoken) | Token signing and validation |
| SRT Server | Your existing server | Receives the final SRT stream |
| VPS | Ubuntu 22.04 | Runs Node.js + FFmpeg only |

## Port Map (on your VPS)

| Port | Service |
|---|---|
| 3000 | Express API + WebSocket bridge |
| 5173 | Vite dev server (admin frontend, dev only) |
| 80/443 | Nginx reverse proxy (production) |

Your SRT server runs elsewhere — configured via `SRT_SERVER_HOST` and `SRT_SERVER_PORT` in `.env`.

## Repository Structure

```
srt-live-system/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express + WS server entry
│   │   ├── routes/
│   │   │   ├── auth.ts           # Admin login
│   │   │   └── tokens.ts         # Token CRUD API
│   │   ├── ws/
│   │   │   └── srtBridge.ts      # WebSocket → FFmpeg → SRT
│   │   ├── middleware/
│   │   │   └── adminAuth.ts      # JWT admin guard
│   │   └── lib/
│   │       └── tokenService.ts   # Stream ID generation helpers
│   │   └── prisma/
│   │       └── schema.prisma
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── frontend-admin/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   └── GenerateToken.tsx
│   │   ├── components/
│   │   │   └── Layout.tsx
│   │   └── api/
│   │       └── client.ts
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.ts
├── frontend-reporter/
│   └── index.html                # Fully standalone, no build step
├── infra/
│   ├── nginx.conf
│   └── docker-compose.yml
└── docs/
    └── (these markdown files)
```

## Key Design Decisions

1. **One-time use tokens** — Each URL works only once. Once the reporter connects and streaming begins, the token is marked `USED` in the DB and rejected on any future attempt.
2. **Quality embedded in token** — Resolution, bitrate, and FPS are JWT claims. The reporter page reads them and the bridge passes them to FFmpeg arguments directly.
3. **Browser → WebSocket → FFmpeg → SRT** — Browsers have no SRT API. MediaRecorder sends WebM binary chunks over WebSocket. FFmpeg reads from stdin and pushes SRT to your server.
4. **Your SRT server is external** — The VPS only runs Node.js and FFmpeg. Set `SRT_SERVER_HOST` and `SRT_SERVER_PORT` in `.env` to point at your server.
5. **Unique streamid per reporter** — Each token generates a unique `streamid` (e.g. `ahmed-raza-a1b2c3d4`) embedded in the SRT connection URL so your server can identify each stream.
6. **Admin auth is separate** — Admin uses a long-lived JWT in localStorage. Reporter tokens are short-lived one-time JWTs with stream settings baked in.
