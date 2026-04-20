import crypto from 'crypto';

// Generates a unique SRT streamid per reporter session
// e.g. "ahmed-raza-a1b2c3d4" — your SRT server sees this as the stream name
export function generateStreamId(reporterName: string): string {
    const slug = reporterName.toLowerCase().replace(/\s+/g, '-').slice(0, 20);
    const rand = crypto.randomBytes(4).toString('hex');
    return `${slug}-${rand}`;
}
