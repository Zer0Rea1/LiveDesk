import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tokensApi } from '../api/client';
import type { TokenRecord } from '../api/client';
import { formatDistanceToNow } from 'date-fns';

const STATUS_COLOR: Record<string, string> = {
    ACTIVE: '#22c55e',
    USED: '#888',
    EXPIRED: '#E24B4A',
    REVOKED: '#E24B4A',
};

export default function Dashboard() {
    const qc = useQueryClient();
    const { data: tokens = [], isLoading } = useQuery({
        queryKey: ['tokens'],
        queryFn: () => tokensApi.list().then(r => r.data),
        refetchInterval: 10000, // auto-refresh every 10s
    });

    const revoke = useMutation({
        mutationFn: tokensApi.revoke,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['tokens'] }),
    });

    const counts = {
        active: tokens.filter(t => t.status === 'ACTIVE').length,
        used: tokens.filter(t => t.status === 'USED').length,
        total: tokens.length,
    };

    return (
        <div>
            <h1 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>Token Dashboard</h1>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '28px' }}>
                {[['Active', counts.active, '#22c55e'], ['Used', counts.used, '#888'], ['Total', counts.total, '#60a5fa']].map(([label, val, color]) => (
                    <div key={label as string} style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: '10px', padding: '16px' }}>
                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>{label}</div>
                        <div style={{ fontSize: '28px', fontWeight: '700', color: color as string }}>{val}</div>
                    </div>
                ))}
            </div>

            {/* Token list */}
            {isLoading ? <p style={{ color: '#888' }}>Loading...</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {tokens.map(t => (
                        <TokenRow key={t.id} token={t} onRevoke={() => revoke.mutate(t.id)} />
                    ))}
                    {tokens.length === 0 && <p style={{ color: '#888', fontSize: '14px' }}>No tokens yet. Generate one first.</p>}
                </div>
            )}
        </div>
    );
}

function TokenRow({ token, onRevoke }: { token: TokenRecord; onRevoke: () => void }) {
    const canRevoke = token.status === 'ACTIVE';

    function copyUrl() {
        navigator.clipboard.writeText(token.url);
    }

    return (
        <div style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: STATUS_COLOR[token.status], flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>{token.reporterName}</div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                    {token.resolution} · {token.bitrate} kbps · {token.fps} fps · expires {formatDistanceToNow(new Date(token.expiresAt), { addSuffix: true })}
                </div>
                <div style={{ fontSize: '10px', color: '#444', marginTop: '2px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {token.url}
                </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button onClick={copyUrl} style={smallBtn}>Copy</button>
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
