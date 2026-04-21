import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const authRouter = Router();

// POST /api/auth/login
// Body: { password: string }
authRouter.post('/login', async (req: Request, res: Response): Promise<any> => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Password required' });
    }

    const hash = process.env.ADMIN_PASSWORD_HASH!;
    console.log(hash)
    const valid = await bcrypt.compare(password, hash);
    console.log(valid)
    console.log(password)
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
