# SRT Live Reporter System

The SRT Live Reporter System is a complete broadcast solution that allows a news channel administration to generate one-time use tokens with robust quality settings to send to their journalists. Journalists open the link directly in a standard browser and broadcast securely without the need to download custom applications. The system receives high-quality WebM chunks over WebSockets and automatically transcodes and pushes them to your existing SRT equipment via FFmpeg.

## Prerequisites
- Docker and Docker Compose

## Quick Start (3 commands)
```bash
git clone https://github.com/Zer0Rea1/LiveDesk.git && cd LiveDesk
cp .env.example .env              # edit .env with your SRT server, passwords, etc.
docker compose up -d --build
```
The app will be available at `https://localhost:3000` (self-signed SSL).

### Using your own SSL certs
Uncomment the cert lines in `docker-compose.yml` and place your `key.pem` / `cert.pem` in a `certs/` folder.

### Stop / rebuild
```bash
docker compose down              # stop
docker compose up -d --build     # rebuild after changes
```

## Manual Setup (without Docker)
- Node.js 20+
- FFmpeg (compiled with SRT and libx264 support)

## Testing FFmpeg → SRT Server Manually
To ensure that FFmpeg is successfully able to tunnel to your SRT broadcast server directly, run the command below from a terminal on your deployment host. If successful, you will be able to play `srt://your.srt-server.com:9998?streamid=test-stream` in VLC or OBS:

```bash
ffmpeg -re -f lavfi -i testsrc=size=1280x720:rate=30 \
  -c:v libx264 -preset ultrafast -tune zerolatency -b:v 2000k \
  -f mpegts "srt://your.srt-server.com:9998?streamid=test-stream&latency=200&mode=caller"
```
