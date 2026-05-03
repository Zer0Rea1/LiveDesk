import { useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tokensApi } from '../api/client';
import type { ActiveStreamInfo } from '../api/client';
import { formatDistance } from 'date-fns';
import Hls from 'hls.js';

export default function Monitors() {
    const qc = useQueryClient();

    const { data: activeData } = useQuery({
        queryKey: ['activeTokens'],
        queryFn: () => tokensApi.listActive().then(r => r.data),
        refetchInterval: 3000,
    });
    const streams = activeData?.streams ?? [];

    const stopStream = useMutation({
        mutationFn: (streamId: string) => tokensApi.stopStream(streamId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['activeTokens'] }),
    });

    return (
        <div>
            <h1 className="dash-title">Monitors</h1>

            {streams.length === 0 ? (
                <div className="empty-state">No active streams. Streams will appear here automatically when reporters go live.</div>
            ) : (
                <div className="monitors-grid">
                    {streams.map(s => (
                        <MonitorCard key={s.streamId} stream={s} onStop={() => stopStream.mutate(s.streamId)} />
                    ))}
                </div>
            )}
        </div>
    );
}

function MonitorCard({ stream, onStop }: { stream: ActiveStreamInfo; onStop: () => void }) {
    return (
        <div className="monitor-card">
            <div className="monitor-video">
                <HlsPlayer streamId={stream.streamId} />
                <div className="monitor-overlay-top">
                    <span className="monitor-live-badge"><span className="monitor-live-dot" /> LIVE</span>
                    <span className="monitor-time">{formatDistance(new Date(stream.startedAt), new Date(), { addSuffix: false })}</span>
                </div>
            </div>
            <div className="monitor-footer">
                <div className="monitor-info">
                    <div className="monitor-name">{stream.reporterName}</div>
                    <div className="monitor-meta">{stream.resolution} &middot; {stream.bitrate} kbps &middot; {stream.fps} fps</div>
                </div>
                <button className="btn-sm btn-stop" onClick={onStop}>Stop</button>
            </div>
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
            return () => hls.destroy();
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = hlsUrl;
            video.addEventListener('loadedmetadata', () => {
                video.play().catch(e => console.error('Play failed:', e));
            });
        }
    }, [streamId]);

    return <video ref={videoRef} autoPlay muted playsInline />;
}
