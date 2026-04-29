import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tokensApi } from '../api/client';
import type { TokenRecord, ActiveStreamInfo } from '../api/client';
import { formatDistanceToNow, formatDistance } from 'date-fns';

const STATUS_COLOR: Record<string, string> = {
    ACTIVE: '#22c55e',
    USED: '#888',
    EXPIRED: '#E24B4A',
    REVOKED: '#E24B4A',
};

export default function Dashboard() {
    const qc = useQueryClient();
    const [watchStream, setWatchStream] = useState<ActiveStreamInfo | null>(null);

    const { data: tokens = [], isLoading } = useQuery({
        queryKey: ['tokens'],
        queryFn: () => tokensApi.list().then(r => r.data),
        refetchInterval: 10000,
    });

    const { data: activeData } = useQuery({
        queryKey: ['activeTokens'],
        queryFn: () => tokensApi.listActive().then(r => r.data),
        refetchInterval: 5000,
    });
    const activeSet = new Set(activeData?.activeTokens ?? []);
    const streams = activeData?.streams ?? [];

    const revoke = useMutation({
        mutationFn: tokensApi.revoke,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['tokens'] }),
    });

    const counts = {
        active: tokens.filter(t => t.status === 'ACTIVE').length,
        live: activeSet.size,
        total: tokens.length,
    };

    return (
        <div>
            <h1 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>Token Dashboard</h1>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '28px' }}>
                {[['Active', counts.active, '#22c55e'], ['Live Now', counts.live, '#E24B4A'], ['Total', counts.total, '#60a5fa']].map(([label, val, color]) => (
                    <div key={label as string} style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: '10px', padding: '16px' }}>
                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>{label}</div>
                        <div style={{ fontSize: '28px', fontWeight: '700', color: color as string }}>{val}</div>
                    </div>
                ))}
            </div>

            {/* Active Streams Panel */}
            {streams.length > 0 && (
                <div style={{ marginBottom: '24px', background: 'rgba(226,75,74,0.05)', border: '1px solid rgba(226,75,74,0.25)', borderRadius: '10px', padding: '16px' }}>
                    <div style={{ fontSize: '11px', color: '#E24B4A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', fontWeight: '600' }}>
                        ● Live Streams
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {streams.map(s => (
                            <div key={s.token} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#1a1a1a', borderRadius: '8px', padding: '10px 14px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#E24B4A', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '13px', fontWeight: '600' }}>{s.reporterName}</div>
                                    <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                                        {s.resolution} · {s.bitrate} kbps · {s.fps} fps ·
                                        streaming for {formatDistance(new Date(s.startedAt), new Date(), { addSuffix: false })}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setWatchStream(s)}
                                    style={{ fontSize: '11px', padding: '5px 14px', background: 'rgba(226,75,74,0.15)', border: '1px solid rgba(226,75,74,0.5)', borderRadius: '6px', color: '#E24B4A', cursor: 'pointer', fontWeight: '600' }}
                                >
                                    Watch
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Token list */}
            {isLoading ? <p style={{ color: '#888' }}>Loading...</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {tokens.map(t => (
                        <TokenRow
                            key={t.id}
                            token={t}
                            isLive={activeSet.has(t.token)}
                            streamInfo={streams.find(s => s.token === t.token)}
                            onRevoke={() => revoke.mutate(t.id)}
                            onWatch={(info) => setWatchStream(info)}
                        />
                    ))}
                    {tokens.length === 0 && <p style={{ color: '#888', fontSize: '14px' }}>No tokens yet. Generate one first.</p>}
                </div>
            )}
            <div style={{ color: '#888', fontSize: '13px', marginTop: '28px', marginBottom: '28px' }}>Made with love By <a href="https://notrana.is-a.dev/">Asad</a></div>

            {/* Watch Modal */}
            {watchStream && (
                <div
                    onClick={() => setWatchStream(null)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{ background: '#111', border: '1px solid #333', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '600px' }}
                    >
                        {/* Modal header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '16px', fontWeight: '700' }}>{watchStream.reporterName}</span>
                                    <span style={{ fontSize: '10px', fontWeight: '700', color: '#E24B4A', background: 'rgba(226,75,74,0.12)', border: '1px solid rgba(226,75,74,0.4)', borderRadius: '4px', padding: '1px 6px', animation: 'pulse 1.5s infinite' }}>● LIVE</span>
                                </div>
                                <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                                    {watchStream.resolution} · {watchStream.bitrate} kbps · {watchStream.fps} fps
                                </div>
                            </div>
                            <button onClick={() => setWatchStream(null)} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
                        </div>

                        {/* Stream Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '20px' }}>
                            {[
                                ['Stream ID', watchStream.streamId],
                                ['Started', formatDistanceToNow(new Date(watchStream.startedAt), { addSuffix: true })],
                                ['Resolution', watchStream.resolution],
                                ['Bitrate', `${watchStream.bitrate} kbps`],
                            ].map(([label, val]) => (
                                <div key={label} style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: '8px', padding: '10px 14px' }}>
                                    <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                                    <div style={{ fontSize: '13px', fontFamily: label === 'Stream ID' ? 'monospace' : 'inherit', wordBreak: 'break-all', color: '#ccc' }}>{val}</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: '#60a5fa', lineHeight: '1.6' }}>
                            <strong>To watch this stream</strong>, open it in VLC or your SRT-capable player using the stream ID above on your SRT server. Browser-based playback requires an HLS relay (not yet configured).
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function TokenRow({ token, isLive, streamInfo, onRevoke, onWatch }: {
    token: TokenRecord;
    isLive: boolean;
    streamInfo?: ActiveStreamInfo;
    onRevoke: () => void;
    onWatch: (info: ActiveStreamInfo) => void;
}) {
    const canRevoke = token.status === 'ACTIVE';
    const [copied, setCopied] = useState(false);
    const [isShortening, setIsShortening] = useState(false);

    const copyUrl = async () => {
        setIsShortening(true);
        try {
            const url = new URL(token.url, window.location.origin).href;
            const res = await tokensApi.shortenUrl(url);
            await navigator.clipboard.writeText(res.data.shortUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to shorten url", err);
        } finally {
            setIsShortening(false);
        }
    };

    return (
        <div style={{ background: '#1a1a1a', border: `1px solid ${isLive ? '#E24B4A' : '#222'}`, borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: STATUS_COLOR[token.status], flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {token.reporterName}
                    {isLive && (
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#E24B4A', background: 'rgba(226,75,74,0.12)', border: '1px solid rgba(226,75,74,0.4)', borderRadius: '4px', padding: '1px 6px', letterSpacing: '0.06em', animation: 'pulse 1.5s infinite' }}>
                            ● LIVE
                        </span>
                    )}
                </div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                    {token.resolution} · {token.bitrate} kbps · {token.fps} fps · expires {formatDistanceToNow(new Date(token.expiresAt), { addSuffix: true })}
                </div>
                <div style={{ fontSize: '10px', color: '#444', marginTop: '2px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {token.url}
                </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {isLive && streamInfo && (
                    <button onClick={() => onWatch(streamInfo)} style={{ ...smallBtn, borderColor: '#E24B4A', color: '#E24B4A' }}>
                        Watch
                    </button>
                )}
                <button onClick={copyUrl} disabled={isShortening} style={{ ...smallBtn, opacity: isShortening ? 0.5 : 1 }}>
                    {isShortening ? 'Shortening...' : copied ? 'Copied!' : 'Copy'}
                </button>
                {canRevoke && (
                    <button onClick={onRevoke} style={{ ...smallBtn, borderColor: '#E24B4A', color: '#E24B4A' }}>Revoke</button>
                )}
            </div>
        </div>
    );
}

const smallBtn: React.CSSProperties = {
    fontSize: '11px',
    padding: '5px 12px',
    background: 'transparent',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#aaa',
    cursor: 'pointer',
};
