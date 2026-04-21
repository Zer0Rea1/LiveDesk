import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { tokensApi } from '../api/client';
import type { GenerateTokenPayload, TokenRecord } from '../api/client';

const PRESETS = [
    { label: 'Studio HD', resolution: '1920x1080', bitrate: 6000, fps: 30, badge: 'High bandwidth' },
    { label: 'Field 720p', resolution: '1280x720', bitrate: 2500, fps: 30, badge: 'Standard' },
    { label: 'Remote 480p', resolution: '854x480', bitrate: 800, fps: 25, badge: 'Low bandwidth' },
    { label: 'Emergency 360p', resolution: '640x360', bitrate: 400, fps: 15, badge: 'Very low' },
];

export default function GenerateToken() {
    const [form, setForm] = useState<GenerateTokenPayload>({
        reporterName: '',
        resolution: '1280x720',
        bitrate: 2500,
        fps: 30,
        expiresInMinutes: 60,
        srtServer: 'srt://your-server.com:9998',
    });
    const [generated, setGenerated] = useState<TokenRecord | null>(null);
    const [copied, setCopied] = useState(false);

    const mutation = useMutation({
        mutationFn: tokensApi.generate,
        onSuccess: (res) => setGenerated(res.data),
    });

    function applyPreset(preset: typeof PRESETS[0]) {
        setForm(f => ({ ...f, resolution: preset.resolution, bitrate: preset.bitrate, fps: preset.fps }));
    }

    function copyUrl() {
        if (generated) {
            navigator.clipboard.writeText(generated.url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }

    return (
        <div style={{ maxWidth: '720px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '4px' }}>Generate Reporter Link</h1>
            <p style={{ color: '#888', fontSize: '14px', marginBottom: '28px' }}>Create a one-time URL to send to your journalist</p>

            {/* Presets */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '24px' }}>
                {PRESETS.map(p => (
                    <div
                        key={p.label}
                        onClick={() => applyPreset(p)}
                        style={{
                            border: form.resolution === p.resolution ? '1px solid #E24B4A' : '1px solid #333',
                            borderRadius: '10px', padding: '12px', cursor: 'pointer',
                            background: form.resolution === p.resolution ? 'rgba(226,75,74,0.08)' : '#1a1a1a',
                        }}
                    >
                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{p.badge}</div>
                        <div style={{ fontSize: '14px', fontWeight: '600' }}>{p.label}</div>
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>{p.resolution} · {p.bitrate}k</div>
                    </div>
                ))}
            </div>

            {/* Form */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                <FormField label="Reporter Name">
                    <input value={form.reporterName} onChange={e => setForm(f => ({ ...f, reporterName: e.target.value }))} placeholder="e.g. Ahmed Raza" />
                </FormField>
                <FormField label="Expires In">
                    <select value={form.expiresInMinutes} onChange={e => setForm(f => ({ ...f, expiresInMinutes: parseInt(e.target.value) }))}>
                        <option value={30}>30 minutes</option>
                        <option value={60}>1 hour</option>
                        <option value={120}>2 hours</option>
                        <option value={480}>8 hours</option>
                        <option value={1440}>24 hours</option>
                    </select>
                </FormField>
                <FormField label="Resolution">
                    <select value={form.resolution} onChange={e => setForm(f => ({ ...f, resolution: e.target.value }))}>
                        <option value="1920x1080">1920×1080 (1080p)</option>
                        <option value="1280x720">1280×720 (720p)</option>
                        <option value="854x480">854×480 (480p)</option>
                        <option value="640x360">640×360 (360p)</option>
                    </select>
                </FormField>
                <FormField label="Framerate">
                    <select value={form.fps} onChange={e => setForm(f => ({ ...f, fps: parseInt(e.target.value) }))}>
                        <option value={30}>30 fps</option>
                        <option value={25}>25 fps</option>
                        <option value={15}>15 fps</option>
                    </select>
                </FormField>
                <FormField label={`Bitrate: ${form.bitrate} kbps`}>
                    <input type="range" min={200} max={8000} step={100} value={form.bitrate}
                        onChange={e => setForm(f => ({ ...f, bitrate: parseInt(e.target.value) }))} />
                </FormField>
                <FormField label="SRT Server URL">
                    <input value={form.srtServer} onChange={e => setForm(f => ({ ...f, srtServer: e.target.value }))} placeholder="srt://yourserver.com:9998" />
                </FormField>
            </div>

            <button
                onClick={() => mutation.mutate(form)}
                disabled={mutation.isPending || !form.reporterName}
                style={{ padding: '11px 28px', background: '#E24B4A', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
            >
                {mutation.isPending ? 'Generating...' : 'Generate Link'}
            </button>

            {/* Generated URL display */}
            {generated && (
                <div style={{ marginTop: '24px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', padding: '20px' }}>
                    <div style={{ color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                        Reporter Link — Send this to {generated.reporterName}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#60a5fa', wordBreak: 'break-all', marginBottom: '14px' }}>
                        {generated.url}
                    </div>
                    <button onClick={copyUrl} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #60a5fa', color: '#60a5fa', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                        {copied ? 'Copied!' : 'Copy Link'}
                    </button>
                    <div style={{ marginTop: '12px', fontSize: '12px', color: '#888' }}>
                        Expires: {new Date(generated.expiresAt).toLocaleString()} · {generated.resolution} · {generated.bitrate} kbps · {generated.fps} fps
                    </div>
                </div>
            )}
            <div style={{ color: '#888', fontSize: '13px', marginBottom: '28px' }}>Made with love By <a href="https://notrana.is-a.dev/">Asad</a></div>
        </div>
    );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '5px' }}>{label}</label>
            <div style={{ width: '100%' }}>{children}</div>
        </div>
    );
}
