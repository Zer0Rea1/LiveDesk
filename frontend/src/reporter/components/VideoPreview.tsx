import { useRef, useEffect } from 'react';

interface Props {
  stream: MediaStream | null;
  streaming: boolean;
  bitrate: number;
  fps: number;
  resolution: string;
}

export function VideoPreview({ stream, streaming, bitrate, fps, resolution }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-wrap">
      {stream ? (
        <video ref={videoRef} autoPlay muted playsInline />
      ) : (
        <div className="placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.5">
            <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          </svg>
          <p>Click "Preview Camera" to begin</p>
        </div>
      )}

      {streaming && (
        <>
          <div className="live-indicator">
            <div className="live-dot" /> LIVE
          </div>
          <div className="hud">
            <div className="hud-row">
              <span className="hud-label">Bitrate</span>
              <span className="hud-value">{bitrate} kbps</span>
            </div>
            <div className="hud-row">
              <span className="hud-label">FPS</span>
              <span className="hud-value">{fps}</span>
            </div>
            <div className="hud-row">
              <span className="hud-label">Resolution</span>
              <span className="hud-value">{resolution}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
