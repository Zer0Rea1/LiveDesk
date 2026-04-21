interface MediaDevice {
  deviceId: string;
  label: string;
}

interface Props {
  cameras: MediaDevice[];
  microphones: MediaDevice[];
  selectedCam: string;
  selectedMic: string;
  onCamChange: (id: string) => void;
  onMicChange: (id: string) => void;
}

export function DeviceSelector({ cameras, microphones, selectedCam, selectedMic, onCamChange, onMicChange }: Props) {
  return (
    <div className="controls">
      <div>
        <label className="field-label">Camera</label>
        <select value={selectedCam} onChange={(e) => onCamChange(e.target.value)}>
          {cameras.map((cam) => (
            <option key={cam.deviceId} value={cam.deviceId}>{cam.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="field-label">Microphone</label>
        <select value={selectedMic} onChange={(e) => onMicChange(e.target.value)}>
          {microphones.map((mic) => (
            <option key={mic.deviceId} value={mic.deviceId}>{mic.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
