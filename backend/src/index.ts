import express from 'express';
import http from 'http';
import https from 'https';
import fs from 'fs';
import WebSocket from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { authRouter } from './routes/auth';
import { tokensRouter } from './routes/tokens';
import { handleSrtBridge } from './ws/srtBridge';
import path from 'path';
import { getAppConfig } from './config';
const app = express();
const sslOptions = {
    key: fs.readFileSync('./key.pem'),
    cert: fs.readFileSync('./cert.pem'),
};
const server = https.createServer(sslOptions, app);
console.log(process.env.CORS_ORIGIN)
// WebSocket server on /stream — reporters connect here
const wss = new WebSocket.Server({ server, path: '/stream' });



// Middleware
app.use(helmet({
    hsts: false,
    contentSecurityPolicy: false,  // disable entirely
}));
app.use(cors({
    origin: '*'  // temporary — allow all for testing
}));
app.use(express.json());
app.use(morgan('combined'));

// REST routes
app.use('/api/auth', authRouter);
app.use('/api/tokens', tokensRouter);

// Health check — also reports active stream count
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        time: new Date(),
        srtTarget: `srt://${getAppConfig().SRT_SERVER_HOST}:${getAppConfig().SRT_SERVER_PORT}`,
    });
});


app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// Catch-all: send index.html for any unknown route (handles React Router)
app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});


// WebSocket → FFmpeg → SRT bridge
wss.on('connection', handleSrtBridge);

const PORT = parseInt(process.env.PORT || '3000');
server.listen(PORT, () => {
    console.log(`[Server] Running on port ${PORT}`);
    console.log(`[Server] WebSocket bridge: ws://localhost:${PORT}/stream`);
    console.log(`[Server] SRT target: srt://${getAppConfig().SRT_SERVER_HOST}:${getAppConfig().SRT_SERVER_PORT}`);
});
