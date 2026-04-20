# SRT Live Reporter System

The SRT Live Reporter System is a complete broadcast solution that allows a news channel administration to generate one-time use tokens with robust quality settings to send to their journalists. Journalists open the link directly in a standard browser and broadcast securely without the need to download custom applications. The system receives high-quality WebM chunks over WebSockets and automatically transcodes and pushes them to your existing SRT equipment via FFmpeg.

## Prerequisites
- Node.js 20+
- FFmpeg (compiled with SRT and libx264 support)
- PostgreSQL
- Docker and Docker Compose (For standard production deployments)

## Quick Start
To build and run the essential services locally using Docker:
```bash
# 1. Provide necessary environment variables
cp infra/.env.example infra/.env   # Create and populate this manually based on 04_INFRASTRUCTURE.md
cp backend/.env.example backend/.env

# 2. Build and run via Docker Compose
cd infra
docker-compose up --build -d
```

## Testing FFmpeg → SRT Server Manually
To ensure that FFmpeg is successfully able to tunnel to your SRT broadcast server directly, run the command below from a terminal on your deployment host. If successful, you will be able to play `srt://your.srt-server.com:9998?streamid=test-stream` in VLC or OBS:

```bash
ffmpeg -re -f lavfi -i testsrc=size=1280x720:rate=30 \
  -c:v libx264 -preset ultrafast -tune zerolatency -b:v 2000k \
  -f mpegts "srt://your.srt-server.com:9998?streamid=test-stream&latency=200&mode=caller"
```
