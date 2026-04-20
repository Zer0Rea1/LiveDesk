import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { authRouter } from './routes/auth';
import { tokensRouter } from './routes/tokens';
import { handleSrtBridge } from './ws/srtBridge';

const app = express();
const server = http.createServer(app);
console.log(process.env.CORS_ORIGIN)
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

// Serve reporter React app at /live?token=...
app.use('/live', express.static(path.join(__dirname, '../../frontend-reporter/dist')));
app.get('/live/{*splat}', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend-reporter/dist/index.html'));
});

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
