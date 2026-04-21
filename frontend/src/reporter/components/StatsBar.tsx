interface Props {
  streaming: boolean;
  elapsed: number;
  bytesSent: number;
  wsState: string;
}

function formatDuration(seconds: number): string {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function formatBytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export function StatsBar({ streaming, elapsed, bytesSent, wsState }: Props) {
  return (
    <div className="stats-bar">
      <div className="stat-card">
        <div className="stat-label">Status</div>
        <div className="stat-value" style={{ color: streaming ? '#E24B4A' : '#666' }}>
          {streaming ? 'LIVE' : 'Offline'}
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Duration</div>
        <div className="stat-value">{formatDuration(elapsed)}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Data Sent</div>
        <div className="stat-value">{formatBytes(bytesSent)}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">WS State</div>
        <div className="stat-value" style={{ color: wsState === 'Connected' ? '#22c55e' : '#888' }}>
          {wsState}
        </div>
      </div>
    </div>
  );
}
