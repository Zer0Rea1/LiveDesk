import { useState, useEffect, useCallback } from 'react';

interface MediaDevice {
  deviceId: string;
  label: string;
}

export function useMediaDevices() {
  const [cameras, setCameras] = useState<MediaDevice[]>([]);
  const [microphones, setMicrophones] = useState<MediaDevice[]>([]);
  const [selectedCam, setSelectedCam] = useState('');
  const [selectedMic, setSelectedMic] = useState('');

  const enumerate = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();

    const cams = devices
      .filter((d) => d.kind === 'videoinput')
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));

    const mics = devices
      .filter((d) => d.kind === 'audioinput')
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Mic ${i + 1}` }));

    setCameras(cams);
    setMicrophones(mics);

    if (cams.length > 0 && !selectedCam) setSelectedCam(cams[0].deviceId);
    if (mics.length > 0 && !selectedMic) setSelectedMic(mics[0].deviceId);
  }, [selectedCam, selectedMic]);

  useEffect(() => {
    enumerate();
  }, [enumerate]);

  return {
    cameras,
    microphones,
    selectedCam,
    selectedMic,
    setSelectedCam,
    setSelectedMic,
    enumerate,
  };
}
