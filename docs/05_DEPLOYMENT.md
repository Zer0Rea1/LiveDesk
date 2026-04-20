# Deployment Guide — Step by Step

## Server Requirements

- Ubuntu 22.04 LTS
- 2 vCPU, 2 GB RAM minimum (handles ~5 simultaneous reporters at 720p)
- 4 vCPU, 4 GB RAM recommended (10+ reporters or HD streams)
- 20 GB SSD
- Good outbound bandwidth to your SRT server

Your SRT server is separate — this VPS only runs Node.js and FFmpeg.

---

## Fresh Server Setup

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install FFmpeg with SRT support
sudo apt install -y ffmpeg

# Verify SRT is available — MUST see "srt" in output
ffmpeg -protocols 2>&1 | grep srt

# Verify libx264 is available
ffmpeg -encoders 2>&1 | grep libx264

# 4. Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres createuser srtlive
sudo -u postgres createdb srtlive
sudo -u postgres psql -c "ALTER USER srtlive WITH PASSWORD 'yourpassword';"

# 5. Install PM2
sudo npm install -g pm2

# 6. Install Nginx + Certbot
sudo apt install -y nginx certbot
```

---

## Test FFmpeg → Your SRT Server First

**Do this before anything else.** Confirm FFmpeg on your VPS can actually reach your SRT server:

```bash
ffmpeg -re -f lavfi -i testsrc=size=1280x720:rate=30 \
  -c:v libx264 -preset ultrafast -tune zerolatency -b:v 1500k \
  -f mpegts "srt://your.srt-server.com:9998?streamid=vps-test&latency=200&mode=caller"
```

- If it connects and runs → path is clear, proceed
- If it times out → check firewall on your SRT server, check the port and host
- If it says "Protocol not found" → FFmpeg on this VPS doesn't have SRT support, install the static build:

```bash
wget https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz
tar -xf ffmpeg-*.tar.xz
sudo cp ffmpeg-*/bin/ffmpeg /usr/local/bin/ffmpeg
hash -r  # clear shell cache
ffmpeg -protocols 2>&1 | grep srt
```

---

## Deploy the Application

```bash
# Clone repo
git clone https://github.com/yourorg/srt-live-system.git /opt/srtlive
cd /opt/srtlive

# Backend
cd backend
npm ci
cp .env.example .env
nano .env  # fill in SRT_SERVER_HOST, SRT_SERVER_PORT, all JWT secrets

npx prisma migrate deploy
npx prisma generate
npm run build

# Admin frontend
cd ../frontend-admin
npm ci
npm run build

# Reporter page — update the WS_URL in the HTML to your domain
sed -i "s|wss://yourserver.com/stream|wss://yourdomain.com/stream|g" \
    ../frontend-reporter/index.html
```

---

## Generate Admin Password Hash

```bash
node -e "require('bcryptjs').hash('your-chosen-password', 12).then(console.log)"
# Copy the output ($2a$12$...) into ADMIN_PASSWORD_HASH in your .env
```

---

## Start Services

```bash
# 1. Start backend with PM2
cd /opt/srtlive/backend
pm2 start dist/index.js --name "srtlive-backend" \
  --max-memory-restart 512M \
  --log /var/log/srtlive.log
pm2 save
pm2 startup  # run the printed command to enable on reboot

# 2. Configure Nginx
sudo cp /opt/srtlive/infra/nginx.conf /etc/nginx/nginx.conf
# Edit the file and replace yourdomain.com with your actual domain
sudo nano /etc/nginx/nginx.conf

# Get SSL certificate (port 80 must be open)
sudo certbot certonly --standalone -d yourdomain.com -d admin.yourdomain.com

# Test and start Nginx
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## Verify Everything Works

```bash
# 1. API health check
curl https://yourdomain.com/health
# Expected: {"status":"ok","srtTarget":"srt://your.srt-server.com:9998"}

# 2. Admin login test
curl -X POST https://yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"yourpassword"}'
# Expected: {"token":"eyJ..."}

# 3. Reporter page loads
curl -s -o /dev/null -w "%{http_code}" https://yourdomain.com/live
# Expected: 200

# 4. Check active FFmpeg processes (should be 0 when nobody is streaming)
pgrep -c ffmpeg || echo "0 active streams"

# 5. PM2 status
pm2 status
```

---

## End-to-End Test

1. Open admin: `https://admin.yourdomain.com`
2. Login and generate a test token (30 min expiry, 720p, 2500 kbps)
3. Copy the reporter URL and open it in a browser
4. Click "Preview Camera" → allow camera access
5. Click "Go Live"
6. On your SRT server or OBS, pull the stream using the streamid shown in the admin dashboard

---

## Receiving Streams in OBS

In OBS on any machine that can reach your SRT server:

- Add source → **Media Source**
- Uncheck "Local File"
- Input: `srt://your.srt-server.com:9998?streamid=ahmed-raza-a1b2c3d4`
- Input Format: `mpegts`
- Check "Restart playback when source becomes active"

The `streamid` is shown in the admin dashboard once a reporter connects.

---

## Logs and Monitoring

```bash
# Live backend logs
pm2 logs srtlive-backend

# See all FFmpeg processes currently running (= active streams)
pgrep -a ffmpeg

# Count active streams
pgrep -c ffmpeg

# Check WebSocket connections
ss -tnp | grep :3000

# Nginx logs
sudo tail -f /var/log/nginx/access.log
```

---

## CPU Usage Per Stream (FFmpeg)

| Quality | CPU per stream |
|---|---|
| 1080p 6 Mbps | ~80% of one core |
| 720p 2.5 Mbps | ~35% of one core |
| 480p 800 kbps | ~15% of one core |
| 360p 400 kbps | ~8% of one core |

A 4-core VPS handles about 8–10 simultaneous 720p reporters comfortably.

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| FFmpeg exits immediately | Can't reach SRT server | Test manually: `ffmpeg ... srt://your.srt-server.com:9998...` |
| `Protocol not found: srt` | FFmpeg built without SRT | Install static FFmpeg build from BtbN |
| Reporter page shows "Token already used" | Reporter refreshed page | Generate a new token |
| WebSocket closes instantly | Nginx missing Upgrade headers | Check nginx.conf `/stream` location block |
| High latency on stream | SRT_LATENCY_MS too high | Try 100ms for local networks, 300ms for international |
| Stream connects but OBS shows nothing | Wrong streamid in OBS | Copy streamid from admin dashboard exactly |
| 502 on /stream | Backend not running | `pm2 status` and `pm2 logs` |
