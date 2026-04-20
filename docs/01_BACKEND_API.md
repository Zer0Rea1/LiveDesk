# Backend — Node.js API + WebSocket SRT Bridge

## Setup

```bash
cd backend
npm init -y
npm install express ws jsonwebtoken bcryptjs prisma @prisma/client cors dotenv helmet morgan
npm install -D typescript ts-node nodemon @types/node @types/express @types/ws @types/jsonwebtoken @types/bcryptjs
npx prisma init
```

### `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### `package.json` scripts
```json
{
  "scripts": {
    "dev": "nodemon --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate"
  }
}
```

### `.env.example`
```
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/srtlive"

# JWT secrets — generate with: openssl rand -hex 32
JWT_SECRET="change-this-to-a-long-random-string"
ADMIN_JWT_SECRET="different-secret-for-admin-tokens"

# Admin password hash — generate with:
# node -e "require('bcryptjs').hash('yourpassword', 12).then(console.log)"
ADMIN_PASSWORD_HASH="bcrypt-hash-of-your-admin-password"

# Your existing SRT server — the destination FFmpeg pushes to
SRT_SERVER_HOST="your.srt-server.com"
SRT_SERVER_PORT="9998"

# SRT latency in milliseconds — increase if reporters are in poor network areas
SRT_LATENCY_MS="200"

# Server
PORT="3000"
CORS_ORIGIN="http://localhost:5173"
REPORTER_BASE_URL="https://yourvps.com"
```

---

## Database Schema — `src/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model ReporterToken {
  id           String        @id @default(cuid())
  token        String        @unique
  reporterName String
  resolution   String        // e.g. "1280x720"
  bitrate      Int           // in kbps
  fps          Int
  status       TokenStatus   @default(ACTIVE)
  createdAt    DateTime      @default(now())
  expiresAt    DateTime
  usedAt       DateTime?
  streamId     String?       // unique SRT streamid assigned on connect
  createdBy    String
  sessions     StreamSession[]
}

model StreamSession {
  id        String        @id @default(cuid())
  tokenId   String
  token     ReporterToken @relation(fields: [tokenId], references: [id])
  startedAt DateTime      @default(now())
  endedAt   DateTime?
  bytesSent BigInt        @default(0)
  ffmpegPid Int?
}

enum TokenStatus {
  ACTIVE
  USED
  EXPIRED
  REVOKED
}
```

```bash
npx prisma migrate dev --name init
npx prisma generate
```

---

## Entry Point — `src/index.ts`

```typescript
import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { authRouter } from './routes/auth';
import { tokensRouter } from './routes/tokens';
import { handleSrtBridge } from './ws/srtBridge';

dotenv.config();

const app = express();
const server = http.createServer(app);

// WebSocket server on /stream — reporters connect here
const wss = new WebSocket.Server({ server, path: '/stream' });

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json());
app.use(morgan('combined'));

// REST routes
app.use('/api/auth', authRouter);
app.use('/api/tokens', tokensRouter);

// Serve reporter HTML at /live?token=...
app.use('/live', express.static(path.join(__dirname, '../../frontend-reporter')));

// Health check — also reports active stream count
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    time: new Date(),
    srtTarget: `srt://${process.env.SRT_SERVER_HOST}:${process.env.SRT_SERVER_PORT}`,
  });
});

// WebSocket → FFmpeg → SRT bridge
wss.on('connection', handleSrtBridge);

const PORT = parseInt(process.env.PORT || '3000');
server.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);
  console.log(`[Server] WebSocket bridge: ws://localhost:${PORT}/stream`);
  console.log(`[Server] SRT target: srt://${process.env.SRT_SERVER_HOST}:${process.env.SRT_SERVER_PORT}`);
});
```

---

## Admin Auth — `src/routes/auth.ts`

```typescript
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const authRouter = Router();

// POST /api/auth/login
// Body: { password: string }
authRouter.post('/login', async (req: Request, res: Response) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  const hash = process.env.ADMIN_PASSWORD_HASH!;
  const valid = await bcrypt.compare(password, hash);

  if (!valid) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = jwt.sign(
    { role: 'admin' },
    process.env.ADMIN_JWT_SECRET!,
    { expiresIn: '12h' }
  );

  res.json({ token });
});

// To generate ADMIN_PASSWORD_HASH for your .env, run once:
// node -e "require('bcryptjs').hash('yourpassword', 12).then(console.log)"
```

---

## Admin Auth Middleware — `src/middleware/adminAuth.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.ADMIN_JWT_SECRET!);
    (req as any).admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

---

## Token Routes — `src/routes/tokens.ts`

```typescript
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { adminAuth } from '../middleware/adminAuth';

const router = Router();
const prisma = new PrismaClient();

export const tokensRouter = router;

// POST /api/tokens/generate
router.post('/generate', adminAuth, async (req: Request, res: Response) => {
  const { reporterName, resolution, bitrate, fps, expiresInMinutes } = req.body;

  if (!reporterName || !resolution || !bitrate || !fps || !expiresInMinutes) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  // Quality settings are baked into the JWT — bridge reads these directly
  const jwtPayload = {
    reporterName,
    resolution,
    bitrate: parseInt(bitrate),
    fps: parseInt(fps),
    type: 'reporter-stream',
  };

  const tokenString = jwt.sign(jwtPayload, process.env.JWT_SECRET!, {
    expiresIn: `${expiresInMinutes}m`,
  });

  const dbRecord = await prisma.reporterToken.create({
    data: {
      token: tokenString,
      reporterName,
      resolution,
      bitrate: parseInt(bitrate),
      fps: parseInt(fps),
      expiresAt,
      createdBy: 'admin',
    },
  });

  res.json({
    id: dbRecord.id,
    token: tokenString,
    reporterName,
    resolution,
    bitrate,
    fps,
    expiresAt,
    url: `${process.env.REPORTER_BASE_URL}/live?token=${tokenString}`,
  });
});

// GET /api/tokens
router.get('/', adminAuth, async (_req, res) => {
  const tokens = await prisma.reporterToken.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const now = new Date();
  const result = tokens.map(t => ({
    ...t,
    status: t.status === 'ACTIVE' && t.expiresAt < now ? 'EXPIRED' : t.status,
  }));

  res.json(result);
});

// DELETE /api/tokens/:id — revoke
router.delete('/:id', adminAuth, async (req, res) => {
  await prisma.reporterToken.update({
    where: { id: req.params.id },
    data: { status: 'REVOKED' },
  });
  res.json({ success: true });
});

// POST /api/tokens/validate — called by reporter page on load
router.post('/validate', async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ valid: false, error: 'No token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const dbToken = await prisma.reporterToken.findUnique({ where: { token } });

    if (!dbToken)                      return res.json({ valid: false, error: 'Token not found' });
    if (dbToken.status === 'REVOKED')  return res.json({ valid: false, error: 'Token revoked' });
    if (dbToken.status === 'USED')     return res.json({ valid: false, error: 'Token already used' });
    if (dbToken.expiresAt < new Date()) return res.json({ valid: false, error: 'Token expired' });

    res.json({
      valid: true,
      settings: {
        reporterName: payload.reporterName,
        resolution: payload.resolution,
        bitrate: payload.bitrate,
        fps: payload.fps,
      },
    });
  } catch (e: any) {
    res.json({ valid: false, error: 'Invalid token: ' + e.message });
  }
});
```

---

## Token Service — `src/lib/tokenService.ts`

```typescript
import crypto from 'crypto';

// Generates a unique SRT streamid per reporter session
// e.g. "ahmed-raza-a1b2c3d4" — your SRT server sees this as the stream name
export function generateStreamId(reporterName: string): string {
  const slug = reporterName.toLowerCase().replace(/\s+/g, '-').slice(0, 20);
  const rand = crypto.randomBytes(4).toString('hex');
  return `${slug}-${rand}`;
}
```

---

## WebSocket → SRT Bridge — `src/ws/srtBridge.ts`

This is the core of the system. It:
1. Validates the reporter's JWT token
2. Marks the token as USED (one-time enforcement)
3. Spawns an FFmpeg process that reads WebM from stdin and pushes SRT to your server
4. Pipes every WebSocket binary message directly into FFmpeg stdin

```typescript
import WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { spawn, ChildProcess } from 'child_process';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { generateStreamId } from '../lib/tokenService';
import url from 'url';

const prisma = new PrismaClient();

// One FFmpeg process per active stream
const activeStreams = new Map<string, ChildProcess>();

export async function handleSrtBridge(ws: WebSocket, req: IncomingMessage) {
  const query = url.parse(req.url || '', true).query;
  const token = query.token as string;

  if (!token) {
    ws.send(JSON.stringify({ type: 'error', message: 'No token' }));
    ws.close(1008, 'No token');
    return;
  }

  // 1. Verify JWT signature and expiry
  let payload: any;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!);
  } catch {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid or expired token' }));
    ws.close(1008, 'Invalid token');
    return;
  }

  // 2. Check DB — one-time use enforcement
  const dbToken = await prisma.reporterToken.findUnique({ where: { token } });
  if (!dbToken || dbToken.status !== 'ACTIVE' || dbToken.expiresAt < new Date()) {
    ws.send(JSON.stringify({ type: 'error', message: 'Token not valid or already used' }));
    ws.close(1008, 'Token invalid');
    return;
  }

  // 3. Mark USED immediately so no second connection can use this token
  const streamId = generateStreamId(payload.reporterName);
  await prisma.reporterToken.update({
    where: { token },
    data: { status: 'USED', usedAt: new Date(), streamId },
  });

  // 4. Log session start
  const session = await prisma.streamSession.create({
    data: { tokenId: dbToken.id },
  });

  // 5. Build SRT URL pointing at YOUR existing SRT server
  const srtHost = process.env.SRT_SERVER_HOST!;
  const srtPort = process.env.SRT_SERVER_PORT || '9998';
  const srtLatency = process.env.SRT_LATENCY_MS || '200';
  const srtUrl = `srt://${srtHost}:${srtPort}?streamid=${streamId}&latency=${srtLatency}&mode=caller`;

  const { resolution, bitrate, fps } = payload;
  const [width, height] = resolution.split('x');

  console.log(`[Bridge] ${payload.reporterName} → ${srtUrl} (${resolution} ${bitrate}kbps ${fps}fps)`);

  // 6. Spawn FFmpeg — reads WebM from stdin, pushes SRT to your server
  const ffmpeg = spawn('ffmpeg', [
    // Input: piped WebM from browser MediaRecorder
    '-fflags', 'nobuffer',
    '-flags', 'low_delay',
    '-i', 'pipe:0',

    // Video: re-encode to H.264 (required for SRT/MPEG-TS broadcast)
    '-c:v', 'libx264',
    '-preset', 'ultrafast',       // lowest latency encoding
    '-tune', 'zerolatency',       // no B-frames, minimise buffering
    '-b:v', `${bitrate}k`,
    '-maxrate', `${Math.round(bitrate * 1.2)}k`,
    '-bufsize', `${bitrate * 2}k`,
    '-vf', `scale=${width}:${height}`,
    '-r', `${fps}`,
    '-g', `${parseInt(fps) * 2}`, // keyframe every 2 seconds

    // Audio: re-encode to AAC
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',

    // Output: MPEG-TS container over SRT to your server
    '-f', 'mpegts',
    srtUrl,
  ]);

  activeStreams.set(token, ffmpeg);

  ffmpeg.stderr.on('data', (data: Buffer) => {
    // FFmpeg writes progress to stderr — log first 200 chars to avoid spam
    const line = data.toString().trim();
    if (line) console.log(`[FFmpeg:${streamId.slice(0, 12)}] ${line.slice(0, 200)}`);
  });

  ffmpeg.on('exit', (code, signal) => {
    console.log(`[Bridge] FFmpeg exited — stream: ${streamId} code: ${code} signal: ${signal}`);
    activeStreams.delete(token);
  });

  // 7. Tell reporter we are ready — MediaRecorder starts sending chunks
  ws.send(JSON.stringify({
    type: 'ready',
    streamId,
    message: 'Connected. Streaming to SRT server.',
  }));

  let bytesSent = 0;

  // 8. Pipe every binary WebSocket message straight into FFmpeg stdin
  ws.on('message', (data: Buffer | ArrayBuffer) => {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (ffmpeg.stdin.writable) {
      ffmpeg.stdin.write(buf);
      bytesSent += buf.length;
    }
  });

  // 9. On disconnect — clean up FFmpeg and update session
  ws.on('close', async () => {
    console.log(`[Bridge] Reporter disconnected: ${payload.reporterName} — sent ${(bytesSent / 1e6).toFixed(2)} MB`);
    ffmpeg.stdin.end();
    setTimeout(() => ffmpeg.kill('SIGTERM'), 2000); // give ffmpeg 2s to flush

    activeStreams.delete(token);

    await prisma.streamSession.update({
      where: { id: session.id },
      data: { endedAt: new Date(), bytesSent: BigInt(bytesSent) },
    }).catch(() => {});
  });

  ws.on('error', (err) => {
    console.error(`[Bridge] WS error for ${payload.reporterName}: ${err.message}`);
    ffmpeg.kill('SIGTERM');
  });
}

export function getActiveStreamCount(): number {
  return activeStreams.size;
}
```

---

## FFmpeg Requirement

FFmpeg must be installed on your VPS with `libx264` and SRT protocol support:

```bash
# Ubuntu 22.04 — SRT is included in the default FFmpeg package
sudo apt update && sudo apt install -y ffmpeg

# Verify SRT protocol is available
ffmpeg -protocols 2>&1 | grep srt
# Must output a line containing: srt

# Verify libx264 encoder
ffmpeg -encoders 2>&1 | grep libx264
# Must output a line containing: libx264
```

If your distro's FFmpeg does not have SRT support, use a static build:

```bash
wget https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz
tar -xf ffmpeg-*.tar.xz
sudo cp ffmpeg-*/bin/ffmpeg /usr/local/bin/ffmpeg
ffmpeg -protocols 2>&1 | grep srt  # verify again
```

## Testing FFmpeg → Your SRT Server Manually

Before deploying the full system, verify FFmpeg can reach your SRT server:

```bash
# Send a 10-second test signal from your VPS to your SRT server
ffmpeg -re -f lavfi -i testsrc=size=1280x720:rate=30 \
  -c:v libx264 -preset ultrafast -tune zerolatency -b:v 2000k \
  -f mpegts "srt://your.srt-server.com:9998?streamid=test-stream&latency=200&mode=caller"

# If it connects and sends without error, the path is working.
# In OBS or VLC on your SRT server side, pull: srt://your.srt-server.com:9998?streamid=test-stream
```
