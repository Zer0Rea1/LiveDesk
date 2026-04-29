import WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { spawn, ChildProcess } from 'child_process';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { generateStreamId } from '../lib/tokenService';
import url from 'url';
import { getAppConfig } from '../config';

const prisma = new PrismaClient();

interface ActiveStream {
    ffmpeg: ChildProcess;
    reporterName: string;
    streamId: string;
    resolution: string;
    bitrate: number;
    fps: number;
    startedAt: Date;
}

// One FFmpeg process per active stream, keyed by token string
const activeStreams = new Map<string, ActiveStream>();

export async function handleSrtBridge(ws: WebSocket, req: IncomingMessage) {
    const query = url.parse(req.url || '', true).query;
    const token = query.token as string;

    if (!token) {
        ws.send(JSON.stringify({ type: 'error', message: 'No token' }));
        ws.close(1008, 'No token');
        return;
    }

    if (activeStreams.has(token)) {
        ws.send(JSON.stringify({ type: 'error', message: 'This token is already streaming.' }));
        ws.close(1008, 'Token in use');
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

    // 2. Check DB — expiry or revoked check
    const dbToken = await prisma.reporterToken.findUnique({ where: { token } });
    if (!dbToken || dbToken.status !== 'ACTIVE' || dbToken.expiresAt < new Date()) {
        ws.send(JSON.stringify({ type: 'error', message: 'Token not valid or expired' }));
        ws.close(1008, 'Token invalid');
        return;
    }

    // 3. Mark last used time
    const streamId = generateStreamId(payload.reporterName);
    await prisma.reporterToken.update({
        where: { token },
        data: { usedAt: new Date(), streamId },
    });

    // 4. Log session start
    const session = await prisma.streamSession.create({
        data: { tokenId: dbToken.id },
    });

    // 5. Build SRT URL pointing at YOUR existing SRT server
    const srtHost = getAppConfig().SRT_SERVER_HOST!;
    const srtPort = getAppConfig().SRT_SERVER_PORT || '9998';
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

    activeStreams.set(token, {
        ffmpeg,
        reporterName: payload.reporterName,
        streamId,
        resolution: payload.resolution,
        bitrate: payload.bitrate,
        fps: payload.fps,
        startedAt: new Date(),
    });

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
        }).catch(() => { });
    });

    ws.on('error', (err) => {
        console.error(`[Bridge] WS error for ${payload.reporterName}: ${err.message}`);
        ffmpeg.kill('SIGTERM');
    });
}

export function getActiveStreamCount(): number {
    return activeStreams.size;
}

export function getActiveStreamTokens(): string[] {
    return Array.from(activeStreams.keys());
}

export interface ActiveStreamInfo {
    token: string;
    reporterName: string;
    streamId: string;
    resolution: string;
    bitrate: number;
    fps: number;
    startedAt: Date;
}

export function getActiveStreams(): ActiveStreamInfo[] {
    return Array.from(activeStreams.entries()).map(([token, s]) => ({
        token,
        reporterName: s.reporterName,
        streamId: s.streamId,
        resolution: s.resolution,
        bitrate: s.bitrate,
        fps: s.fps,
        startedAt: s.startedAt,
    }));
}
