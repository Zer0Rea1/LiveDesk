interface Props {
  bitrate: number;
  fps: number;
  resolution: string;
  onBitrateChange: (v: number) => void;
  onFpsChange: (v: number) => void;
  onResolutionChange: (v: string) => void;
}

export function QualitySettings({ bitrate, fps, resolution, onBitrateChange, onFpsChange, onResolutionChange }: Props) {
  return (
    <div className="quality-section">
      <label className="field-label">Quality settings (pre-filled from your token)</label>
      <div className="quality-sliders">
        <div className="slider-group">
          <label>Bitrate</label>
          <input
            type="range"
            min={200}
            max={8000}
            step={100}
            value={bitrate}
            onChange={(e) => onBitrateChange(Number(e.target.value))}
          />
          <span className="val">{bitrate} kbps</span>
        </div>
        <div className="slider-group">
          <label>Framerate</label>
          <input
            type="range"
            min={10}
            max={30}
            step={5}
            value={fps}
            onChange={(e) => onFpsChange(Number(e.target.value))}
          />
          <span className="val">{fps} fps</span>
        </div>
        <div className="slider-group">
          <label>Resolution</label>
          <select value={resolution} onChange={(e) => onResolutionChange(e.target.value)}>
            <option value="1920x1080">1920x1080</option>
            <option value="1280x720">1280x720</option>
            <option value="854x480">854x480</option>
            <option value="640x360">640x360</option>
          </select>
          <span className="val" style={{ color: '#888' }}>res</span>
        </div>
      </div>
    </div>
  );
}
