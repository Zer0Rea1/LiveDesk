import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { adminAuth } from '../middleware/adminAuth';

const router = Router();
const prisma = new PrismaClient();

export const tokensRouter = router;

// POST /api/tokens/generate
router.post('/generate', adminAuth, async (req: Request, res: Response): Promise<any> => {
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
router.delete('/:id', adminAuth, async (req: Request, res: Response): Promise<any> => {
    await prisma.reporterToken.update({
        where: { id: req.params.id as string },
        data: { status: 'REVOKED' },
    });
    res.json({ success: true });
});

// POST /api/tokens/validate — called by reporter page on load
router.post('/validate', async (req: Request, res: Response): Promise<any> => {
    const token = req.body.token as string;
    if (!token) return res.status(400).json({ valid: false, error: 'No token' });

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
        const dbToken = await prisma.reporterToken.findUnique({ where: { token } });

        if (!dbToken) return res.json({ valid: false, error: 'Token not found' });
        if (dbToken.status === 'REVOKED') return res.json({ valid: false, error: 'Token revoked' });
        if (dbToken.status === 'USED') return res.json({ valid: false, error: 'Token already used' });
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
