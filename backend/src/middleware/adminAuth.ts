import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function adminAuth(req: Request, res: Response, next: NextFunction): any {
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
