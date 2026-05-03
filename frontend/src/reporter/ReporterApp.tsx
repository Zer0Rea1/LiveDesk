import { useState, useCallback, useRef, useEffect } from 'react';
import { useTokenValidation } from './hooks/useTokenValidation.ts';
import { useMediaDevices } from './hooks/useMediaDevices.ts';
import { useStreaming } from './hooks/useStreaming.ts';
import type { StatusType } from './types.ts';
import './reporter.css';

type Panel = 'none' | 'info' | 'settings';
type Orientation = 'landscape' | 'portrait';

function formatDuration(seconds: number): string {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function formatBytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export default function ReporterApp() {
  const { token, settings, error: tokenError, loading } = useTokenValidation();
  const { cameras, microphones, selectedCam, selectedMic, setSelectedCam, setSelectedMic, enumerate } = useMediaDevices();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [statusType, setStatusType] = useState<StatusType>('info');
  const [orientation, setOrientation] = useState<Orientation>('landscape');
  const [activePanel, setActivePanel] = useState<Panel>('none');

  // Quality settings
  const [bitrate, setBitrate] = useState(2500);
  const [fps, setFps] = useState(25);
  const [resolution, setResolution] = useState('1280x720');

  // Apply token settings once
  const [applied, setApplied] = useState(false);
  if (settings && !applied) {
    setBitrate(settings.bitrate);
    setFps(settings.fps);
    setResolution(settings.resolution);
    setApplied(true);
  }

  const effectiveResolution = orientation === 'portrait'
    ? resolution.split('x').reverse().join('x')
    : resolution;

  const { streaming, wsState, elapsed, bytesSent, toggleStream } = useStreaming({
    token,
    localStream,
    bitrate,
    fps,
    resolution: effectiveResolution,
  });

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const showStatus = useCallback((text: string, type: StatusType) => {
    setStatusText(text);
    setStatusType(type);
  }, []);

  const startPreview = useCallback(async () => {
    const [w, h] = resolution.split('x').map(Number);
    const isPortrait = orientation === 'portrait';

    try {
      if (localStream) localStream.getTracks().forEach((t) => t.stop());

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: selectedCam ? { exact: selectedCam } : undefined,
          width: { ideal: isPortrait ? h : w },
          height: { ideal: isPortrait ? w : h },
          frameRate: { ideal: fps },
        },
        audio: {
          deviceId: selectedMic ? { exact: selectedMic } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      setLocalStream(stream);
      setPreviewReady(true);
      await enumerate();
      showStatus('Camera ready. Tap Go Live when ready.', 'success');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      showStatus('Camera access denied: ' + msg, 'error');
    }
  }, [resolution, fps, selectedCam, selectedMic, localStream, enumerate, showStatus, orientation]);

  const toggleOrientation = useCallback(() => {
    setOrientation(prev => prev === 'landscape' ? 'portrait' : 'landscape');
    if (previewReady && !streaming) {
      setPreviewReady(false);
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      setLocalStream(null);
      showStatus('Orientation changed. Tap Preview to apply.', 'info');
    }
  }, [previewReady, streaming, localStream, showStatus]);

  const togglePanel = useCallback((panel: Panel) => {
    setActivePanel(prev => prev === panel ? 'none' : panel);
  }, []);

  // Display logic
  const reporterName = settings?.reporterName ?? (tokenError ? 'Invalid Link' : 'Loading...');
  const canPreview = !!settings && !tokenError;
  const canStream = previewReady && !tokenError;

  let displayStatus = statusText;
  let displayType = statusType;
  if (loading && !statusText) {
    displayStatus = 'Validating your link...';
    displayType = 'info';
  } else if (tokenError) {
    displayStatus = tokenError;
    displayType = 'error';
  } else if (settings && !statusText && !streaming) {
    displayStatus = 'Link valid. Preview your camera then go live.';
    displayType = 'success';
  }
  if (streaming) displayStatus = '';

  return (
    <div className="live-app">
      {/* Full-screen video */}
      <div className={`video-bg ${orientation}`}>
        {localStream ? (
          <video ref={videoRef} autoPlay muted playsInline />
        ) : (
          <div className="video-placeholder">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <p>Tap Preview to start your camera</p>
          </div>
        )}
      </div>

      {/* Top bar */}
      <div className="top-bar">
        <div className="top-left">
          {streaming ? (
            <div className="live-badge"><span className="live-dot" /> LIVE</div>
          ) : (
            <div className="app-logo">● LIVE</div>
          )}
        </div>
        <div className="top-right">
          <span className="reporter-label">{reporterName}</span>
          <span className={`conn-dot ${wsState === 'Connected' ? 'connected' : ''}`} />
        </div>
      </div>

      {/* Status toast */}
      {displayStatus && (
        <div className={`status-toast ${displayType}`}>{displayStatus}</div>
      )}

      {/* Streaming HUD */}
      {streaming && (
        <div className="stream-hud">
          <div className="hud-pill"><span className="rec-dot" /> {formatDuration(elapsed)}</div>
          <div className="hud-pill">{formatBytes(bytesSent)}</div>
        </div>
      )}

      {/* Bottom controls */}
      <div className="bottom-bar">
        <div className="controls-row">
          <button
            className={`ctrl-btn ${activePanel === 'info' ? 'active' : ''}`}
            onClick={() => togglePanel('info')}
            title="Stream Info"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          </button>

          <button
            className={`ctrl-btn ${activePanel === 'settings' ? 'active' : ''}`}
            onClick={() => togglePanel('settings')}
            title="Settings"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              className="ctrl-btn"
              onClick={toggleOrientation}
              disabled={streaming}
              title={orientation === 'landscape' ? 'Switch to Portrait' : 'Switch to Landscape'}
            >
              <svg
                width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: orientation === 'landscape' ? 'rotate(90deg)' : 'none', transition: 'transform 0.3s ease' }}
              >
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
            </button>
            <span className="orientation-label">
              {orientation === 'landscape' ? '16:9' : '9:16'}
            </span>
          </div>
        </div>

        {/* Main action button */}
        {!previewReady ? (
          <button className="main-btn preview-btn" onClick={startPreview} disabled={!canPreview}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Preview Camera
          </button>
        ) : (
          <button
            className={`main-btn ${streaming ? 'stop-btn' : 'live-btn'}`}
            onClick={toggleStream}
            disabled={!canStream}
          >
            <span className={`action-dot ${streaming ? 'stopping' : 'going'}`} />
            {streaming ? 'Stop Stream' : 'Go Live'}
          </button>
        )}
      </div>

      {/* Bottom sheet overlay */}
      {activePanel !== 'none' && (
        <>
          <div className="sheet-backdrop" onClick={() => setActivePanel('none')} />
          <div className="bottom-sheet">
            <div className="sheet-handle" />

            {activePanel === 'info' && (
              <div className="sheet-content">
                <h3 className="sheet-title">Stream Info</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Status</span>
                    <span className={`info-value ${streaming ? 'live' : ''}`}>
                      {streaming ? 'LIVE' : 'Offline'}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Duration</span>
                    <span className="info-value">{formatDuration(elapsed)}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Data Sent</span>
                    <span className="info-value">{formatBytes(bytesSent)}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Connection</span>
                    <span className={`info-value ${wsState === 'Connected' ? 'connected' : ''}`}>
                      {wsState}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Orientation</span>
                    <span className="info-value">
                      {orientation === 'portrait' ? 'Portrait 9:16' : 'Landscape 16:9'}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Resolution</span>
                    <span className="info-value">{effectiveResolution}</span>
                  </div>
                </div>
                <p className="sheet-note">Stream is encrypted end-to-end via SRT. This link can be reused until it expires.</p>
                <div className="sheet-footer">
                  <button className="sheet-close-btn" onClick={() => setActivePanel('none')}>Close</button>
                </div>
              </div>
            )}

            {activePanel === 'settings' && (
              <div className="sheet-content">
                <h3 className="sheet-title">Settings</h3>

                <div className="setting-group">
                  <label className="setting-label">Camera</label>
                  <select value={selectedCam} onChange={(e) => setSelectedCam(e.target.value)}>
                    {cameras.map(cam => (
                      <option key={cam.deviceId} value={cam.deviceId}>{cam.label}</option>
                    ))}
                  </select>
                </div>

                <div className="setting-group">
                  <label className="setting-label">Microphone</label>
                  <select value={selectedMic} onChange={(e) => setSelectedMic(e.target.value)}>
                    {microphones.map(mic => (
                      <option key={mic.deviceId} value={mic.deviceId}>{mic.label}</option>
                    ))}
                  </select>
                </div>

                <div className="setting-group">
                  <label className="setting-label">Bitrate</label>
                  <div className="slider-row">
                    <input
                      type="range" min={200} max={8000} step={100}
                      value={bitrate}
                      onChange={(e) => setBitrate(Number(e.target.value))}
                    />
                    <span className="slider-val">{bitrate} kbps</span>
                  </div>
                </div>

                <div className="setting-group">
                  <label className="setting-label">Framerate</label>
                  <div className="slider-row">
                    <input
                      type="range" min={10} max={30} step={5}
                      value={fps}
                      onChange={(e) => setFps(Number(e.target.value))}
                    />
                    <span className="slider-val">{fps} fps</span>
                  </div>
                </div>

                <div className="setting-group">
                  <label className="setting-label">Resolution</label>
                  <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
                    <option value="1920x1080">1920x1080 (Full HD)</option>
                    <option value="1280x720">1280x720 (HD)</option>
                    <option value="854x480">854x480 (SD)</option>
                    <option value="640x360">640x360 (Low)</option>
                  </select>
                </div>

                <p className="sheet-note">Settings are pre-filled from your token. Changes apply on next preview.</p>
                <div className="sheet-footer">
                  <button className="sheet-close-btn" onClick={() => setActivePanel('none')}>Done</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
