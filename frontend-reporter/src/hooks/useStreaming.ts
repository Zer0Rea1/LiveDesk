import { useState, useRef, useCallback, useEffect } from 'react';

interface UseStreamingOptions {
  token: string | null;
  localStream: MediaStream | null;
  bitrate: number;
  fps: number;
  resolution: string;
}

function getWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/stream`;
}

export function useStreaming({ token, localStream, bitrate, fps, resolution }: UseStreamingOptions) {
  const [streaming, setStreaming] = useState(false);
  const [wsState, setWsState] = useState('--');
  const [elapsed, setElapsed] = useState(0);
  const [bytesSent, setBytesSent] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bytesRef = useRef(0);

  const stopStream = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setStreaming(false);
    setWsState('--');
  }, []);

  const startStream = useCallback(() => {
    if (!localStream || !token) return;

    const wsUrl = `${getWsUrl()}?token=${encodeURIComponent(token)}&bitrate=${bitrate}&fps=${fps}&res=${resolution}`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setWsState('Connected');
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'ready') {
          // Start MediaRecorder
          const mimeTypes = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm',
          ];
          const mimeType = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || '';

          const recorder = new MediaRecorder(localStream, {
            mimeType,
            videoBitsPerSecond: bitrate * 1000,
            audioBitsPerSecond: 128000,
          });

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
              e.data.arrayBuffer().then((buf) => {
                ws.send(buf);
                bytesRef.current += buf.byteLength;
                setBytesSent(bytesRef.current);
              });
            }
          };

          recorder.start(100);
          recorderRef.current = recorder;

          // Start timer
          bytesRef.current = 0;
          setBytesSent(0);
          setElapsed(0);
          timerRef.current = setInterval(() => {
            setElapsed((prev) => prev + 1);
          }, 1000);

          setStreaming(true);
        } else if (msg.type === 'error') {
          stopStream();
        }
      } catch { /* ignore non-JSON messages */ }
    };

    ws.onclose = () => {
      setWsState('Disconnected');
      stopStream();
    };

    ws.onerror = () => {
      stopStream();
    };
  }, [localStream, token, bitrate, fps, resolution, stopStream]);

  const toggleStream = useCallback(() => {
    if (streaming) stopStream();
    else startStream();
  }, [streaming, startStream, stopStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return { streaming, wsState, elapsed, bytesSent, toggleStream, stopStream };
}
