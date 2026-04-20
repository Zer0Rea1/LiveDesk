import { useState, useCallback } from 'react';
import { useTokenValidation } from './hooks/useTokenValidation.ts';
import { useMediaDevices } from './hooks/useMediaDevices.ts';
import { useStreaming } from './hooks/useStreaming.ts';
import { StatusMessage } from './components/StatusMessage.tsx';
import { VideoPreview } from './components/VideoPreview.tsx';
import { StatsBar } from './components/StatsBar.tsx';
import { DeviceSelector } from './components/DeviceSelector.tsx';
import { QualitySettings } from './components/QualitySettings.tsx';
import type { StatusType } from './types.ts';

export default function App() {
  const { token, settings, error: tokenError, loading } = useTokenValidation();
  const { cameras, microphones, selectedCam, selectedMic, setSelectedCam, setSelectedMic, enumerate } = useMediaDevices();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [statusType, setStatusType] = useState<StatusType>('info');

  // Quality settings — initialized from token, editable by user
  const [bitrate, setBitrate] = useState(2500);
  const [fps, setFps] = useState(25);
  const [resolution, setResolution] = useState('1280x720');

  // Apply token settings once loaded
  const [applied, setApplied] = useState(false);
  if (settings && !applied) {
    setBitrate(settings.bitrate);
    setFps(settings.fps);
    setResolution(settings.resolution);
    setApplied(true);
  }

  const { streaming, wsState, elapsed, bytesSent, toggleStream } = useStreaming({
    token,
    localStream,
    bitrate,
    fps,
    resolution,
  });

  const showStatus = useCallback((text: string, type: StatusType) => {
    setStatusText(text);
    setStatusType(type);
  }, []);

  const startPreview = useCallback(async () => {
    const [w, h] = resolution.split('x').map(Number);

    try {
      if (localStream) localStream.getTracks().forEach((t) => t.stop());

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: selectedCam ? { exact: selectedCam } : undefined,
          width: { ideal: w },
          height: { ideal: h },
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
      showStatus('Camera ready. Press "Go Live" when ready to stream.', 'success');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      showStatus('Camera access denied: ' + msg + '. Allow camera permissions and try again.', 'error');
    }
  }, [resolution, fps, selectedCam, selectedMic, localStream, enumerate, showStatus]);

  // Determine what to show
  const reporterName = settings?.reporterName ?? (tokenError ? 'Link Invalid' : 'Loading...');

  // Status message logic
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

  if (streaming) {
    displayStatus = '';
  }

  const canPreview = !!settings && !tokenError;
  const canStream = previewReady && !tokenError;

  return (
    <div className="container">
      <div className="header">
        <div className="logo">&#9679; LIVE</div>
        <div className="reporter-name">{reporterName}</div>
      </div>

      {displayStatus && <StatusMessage text={displayStatus} type={displayType} />}

      <VideoPreview
        stream={localStream}
        streaming={streaming}
        bitrate={bitrate}
        fps={fps}
        resolution={resolution}
      />

      <StatsBar
        streaming={streaming}
        elapsed={elapsed}
        bytesSent={bytesSent}
        wsState={wsState}
      />

      <hr className="divider" />

      <DeviceSelector
        cameras={cameras}
        microphones={microphones}
        selectedCam={selectedCam}
        selectedMic={selectedMic}
        onCamChange={setSelectedCam}
        onMicChange={setSelectedMic}
      />

      <QualitySettings
        bitrate={bitrate}
        fps={fps}
        resolution={resolution}
        onBitrateChange={setBitrate}
        onFpsChange={setFps}
        onResolutionChange={setResolution}
      />

      <div className="btn-row">
        <button
          className="btn btn-preview"
          onClick={startPreview}
          disabled={!canPreview}
        >
          Preview Camera
        </button>
        <button
          className={`btn ${streaming ? 'btn-stop' : 'btn-live'}`}
          onClick={toggleStream}
          disabled={!canStream}
        >
          {streaming ? 'Stop Stream' : 'Go Live'}
        </button>
      </div>

      <div className="footer-note">
        Stream is encrypted end-to-end via SRT. This link is one-time use only.
      </div>
    </div>
  );
}
