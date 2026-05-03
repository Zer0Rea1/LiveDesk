import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tokensApi } from '../api/client';
import type { TokenRecord, ActiveStreamInfo } from '../api/client';
import { formatDistanceToNow, formatDistance } from 'date-fns';
import Hls from 'hls.js';

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

    const stopStream = useMutation({
        mutationFn: (streamId: string) => tokensApi.stopStream(streamId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['activeTokens'] });
            qc.invalidateQueries({ queryKey: ['tokens'] });
        },
    });

    const counts = {
        active: tokens.filter(t => t.status === 'ACTIVE').length,
        live: activeSet.size,
        total: tokens.length,
    };

    return (
        <div>
            <h1 className="dash-title">Dashboard</h1>

            {/* Stats */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-label">Active Tokens</div>
                    <div className="stat-number" style={{ color: '#22c55e' }}>{counts.active}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Live Now</div>
                    <div className="stat-number" style={{ color: '#e24b4a' }}>{counts.live}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Total Tokens</div>
                    <div className="stat-number" style={{ color: '#60a5fa' }}>{counts.total}</div>
                </div>
            </div>

            {/* Active Streams */}
            {streams.length > 0 && (
                <div className="live-panel">
                    <div className="live-panel-header">
                        <span className="pulse-dot" /> Live Streams
                    </div>
                    <div className="stream-cards">
                        {streams.map(s => (
                            <div key={s.token} className="stream-card">
                                <span className="stream-dot" />
                                <div className="stream-info">
                                    <div className="stream-name">{s.reporterName}</div>
                                    <div className="stream-meta">
                                        {s.resolution} &middot; {s.bitrate} kbps &middot; {s.fps} fps &middot; {formatDistance(new Date(s.startedAt), new Date(), { addSuffix: false })}
                                    </div>
                                </div>
                                <div className="stream-actions">
                                    <button className="btn-sm btn-watch" onClick={() => setWatchStream(s)}>Watch</button>
                                    <button
                                        className="btn-sm btn-stop"
                                        onClick={() => stopStream.mutate(s.streamId)}
                                        disabled={stopStream.isPending}
                                    >
                                        {stopStream.isPending ? 'Stopping...' : 'Stop'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Token list */}
            <div className="section-label">All Tokens</div>
            {isLoading ? (
                <div className="empty-state">Loading...</div>
            ) : tokens.length === 0 ? (
                <div className="empty-state">No tokens yet. Generate one first.</div>
            ) : (
                <div className="token-list">
                    {tokens.map(t => (
                        <TokenRow
                            key={t.id}
                            token={t}
                            isLive={activeSet.has(t.token)}
                            streamInfo={streams.find(s => s.token === t.token)}
                            onRevoke={() => revoke.mutate(t.id)}
                            onWatch={(info) => setWatchStream(info)}
                            onStop={(streamId) => stopStream.mutate(streamId)}
                            isStopping={stopStream.isPending}
                        />
                    ))}
                </div>
            )}

            <div className="footer-credit">Made with love by <a href="https://notrana.is-a.dev/">Asad</a></div>

            {/* Watch Modal */}
            {watchStream && (
                <div className="modal-backdrop" onClick={() => setWatchStream(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {watchStream.reporterName}
                                    <span className="live-tag">● LIVE</span>
                                </div>
                                <div className="modal-subtitle">
                                    {watchStream.resolution} &middot; {watchStream.bitrate} kbps &middot; {watchStream.fps} fps
                                </div>
                            </div>
                            <button className="modal-close" onClick={() => setWatchStream(null)}>✕</button>
                        </div>

                        <div className="modal-stats">
                            {[
                                ['Stream ID', watchStream.streamId, true],
                                ['Started', formatDistanceToNow(new Date(watchStream.startedAt), { addSuffix: true }), false],
                                ['Resolution', watchStream.resolution, false],
                                ['Bitrate', `${watchStream.bitrate} kbps`, false],
                            ].map(([label, val, mono]) => (
                                <div key={label as string} className="modal-stat">
                                    <div className="modal-stat-label">{label}</div>
                                    <div className={`modal-stat-value ${mono ? 'mono' : ''}`}>{val}</div>
                                </div>
                            ))}
                        </div>

                        <div className="modal-player">
                            <HlsPlayer streamId={watchStream.streamId} />
                        </div>

                        <div style={{ marginTop: '16px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                className="btn-sm btn-stop"
                                onClick={() => {
                                    stopStream.mutate(watchStream.streamId);
                                    setWatchStream(null);
                                }}
                            >
                                Stop Stream
                            </button>
                            <button className="btn-sm" onClick={() => setWatchStream(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function HlsPlayer({ streamId }: { streamId: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const hlsUrl = `/hls/${streamId}/index.m3u8`;

        if (Hls.isSupported()) {
            const hls = new Hls({
                liveSyncDurationCount: 3,
                maxMaxBufferLength: 10,
            });
            hls.loadSource(hlsUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(e => console.error('Play failed:', e));
            });

            return () => {
                hls.destroy();
            };
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = hlsUrl;
            video.addEventListener('loadedmetadata', () => {
                video.play().catch(e => console.error('Play failed:', e));
            });
        }
    }, [streamId]);

    return <video ref={videoRef} controls autoPlay muted />;
}

function TokenRow({ token, isLive, streamInfo, onRevoke, onWatch, onStop, isStopping }: {
    token: TokenRecord;
    isLive: boolean;
    streamInfo?: ActiveStreamInfo;
    onRevoke: () => void;
    onWatch: (info: ActiveStreamInfo) => void;
    onStop: (streamId: string) => void;
    isStopping: boolean;
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
        <div className={`token-card ${isLive ? 'is-live' : ''}`}>
            <span className="token-dot" style={{ background: STATUS_COLOR[token.status] }} />
            <div className="token-info">
                <div className="token-name-row">
                    <span className="token-name">{token.reporterName}</span>
                    {isLive && <span className="live-tag">● LIVE</span>}
                </div>
                <div className="token-meta">
                    {token.resolution} &middot; {token.bitrate} kbps &middot; {token.fps} fps &middot; expires {formatDistanceToNow(new Date(token.expiresAt), { addSuffix: true })}
                </div>
                <div className="token-url">{token.url}</div>
            </div>
            <div className="token-actions">
                {isLive && streamInfo && (
                    <>
                        <button className="btn-sm btn-watch" onClick={() => onWatch(streamInfo)}>Watch</button>
                        <button className="btn-sm btn-stop" onClick={() => onStop(streamInfo.streamId)} disabled={isStopping}>Stop</button>
                    </>
                )}
                <button className="btn-sm btn-copy" onClick={copyUrl} disabled={isShortening}>
                    {isShortening ? '...' : copied ? 'Copied!' : 'Copy'}
                </button>
                {canRevoke && (
                    <button className="btn-sm btn-revoke" onClick={onRevoke}>Revoke</button>
                )}
            </div>
        </div>
    );
}
