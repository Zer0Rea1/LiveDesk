import WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { generateStreamId } from '../lib/tokenService';
import url from 'url';
import { getAppConfig } from '../config';

const prisma = new PrismaClient();

interface ActiveStream {
    ws: WebSocket;
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

    // HLS Directory setup
    const HLS_DIR = process.env.HLS_OUTPUT_DIR || path.join(process.cwd(), 'hls_output');
    const hlsPath = path.join(HLS_DIR, streamId);
    fs.mkdirSync(hlsPath, { recursive: true });

    // 6. Spawn FFmpeg — reads WebM from stdin, pushes SRT to your server AND generates HLS locally
    const ffmpeg = spawn('ffmpeg', [
        // Input: piped WebM from browser MediaRecorder
        '-fflags', 'nobuffer',
        '-flags', 'low_delay',
        '-i', 'pipe:0',

        // ── Output 1: SRT → your existing server ──
        '-c:v', 'libx264',
        '-preset', 'ultrafast',       // lowest latency encoding
        '-tune', 'zerolatency',       // no B-frames, minimise buffering
        '-b:v', `${bitrate}k`,
        '-maxrate', `${Math.round(bitrate * 1.2)}k`,
        '-bufsize', `${bitrate * 2}k`,
        '-vf', `scale=${width}:${height}`,
        '-r', `${fps}`,
        '-g', `${parseInt(fps) * 2}`, // keyframe every 2 seconds
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',
        '-f', 'mpegts',
        srtUrl,

        // ── Output 2: HLS → local folder for dashboard playback ──
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-b:v', `${Math.round(bitrate * 0.6)}k`,  // slightly lower bitrate for HLS
        '-vf', `scale=${width}:${height}`,
        '-r', `${fps}`,
        '-g', `${parseInt(fps) * 2}`,
        '-c:a', 'aac',
        '-b:a', '96k',
        '-ar', '44100',
        '-f', 'hls',
        '-hls_time', '2',                          // 2-second segments
        '-hls_list_size', '6',                     // keep last 6 segments
        '-hls_flags', 'delete_segments+append_list',
        '-hls_segment_filename', path.join(hlsPath, 'seg%03d.ts'),
        path.join(hlsPath, 'index.m3u8'),
    ]);

    activeStreams.set(token, {
        ws,
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

        // Cleanup HLS files after 10s delay to let trailing clients finish playing
        setTimeout(() => {
            fs.rmSync(hlsPath, { recursive: true, force: true });
        }, 10000);
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

export function killStream(streamId: string): boolean {
    for (const [token, stream] of activeStreams.entries()) {
        if (stream.streamId === streamId) {
            console.log(`[Bridge] Admin killed stream: ${stream.reporterName} (${streamId})`);
            stream.ws.close(1000, 'Stream stopped by admin');
            return true;
        }
    }
    return false;
}
