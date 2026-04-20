# Reporter Frontend — Standalone HTML Page

## Overview

This is a **single self-contained HTML file** that reporters open via their unique link.
It has zero build step — just serve it as a static file.

The URL format is: `https://yourdomain.com/live?token=JWT_TOKEN_HERE`

The page:
1. Reads the token from the URL query string
2. Calls `/api/tokens/validate` to verify the token and get quality settings
3. Requests camera/microphone access
4. Streams MediaRecorder chunks via WebSocket to the SRT bridge
5. Shows a live timer, bitrate indicator, and connection status

---

## `frontend-reporter/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Live Reporter</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0a;
      color: #fff;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container { width: 100%; max-width: 680px; }

    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
    }

    .logo { color: #E24B4A; font-size: 20px; font-weight: 700; }

    .reporter-name {
      font-size: 14px;
      color: #888;
      margin-left: auto;
    }

    /* Video area */
    .video-wrap {
      position: relative;
      width: 100%;
      aspect-ratio: 16/9;
      background: #111;
      border-radius: 14px;
      overflow: hidden;
      margin-bottom: 16px;
    }

    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: none;
    }

    .placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      color: #444;
    }

    .placeholder svg { width: 48px; height: 48px; }

    .placeholder p { font-size: 14px; }

    .live-indicator {
      position: absolute;
      top: 12px;
      left: 14px;
      display: none;
      align-items: center;
      gap: 6px;
      background: #E24B4A;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 4px;
      letter-spacing: 0.08em;
    }

    .live-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #fff;
      animation: pulse 1s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    .hud {
      position: absolute;
      top: 12px;
      right: 14px;
      background: rgba(0,0,0,0.6);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 11px;
      font-family: monospace;
      display: none;
      flex-direction: column;
      gap: 2px;
    }

    .hud-row { display: flex; justify-content: space-between; gap: 12px; }
    .hud-label { color: #888; }
    .hud-value { color: #fff; }

    /* Stats bar */
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }

    .stat-card {
      background: #141414;
      border: 1px solid #222;
      border-radius: 10px;
      padding: 10px 12px;
    }

    .stat-label { font-size: 10px; color: #666; margin-bottom: 4px; }
    .stat-value { font-size: 16px; font-weight: 600; font-family: monospace; }

    /* Controls */
    .controls { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }

    label.field-label { font-size: 11px; color: #888; display: block; margin-bottom: 5px; }

    select, input[type="text"] {
      width: 100%;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 8px;
      color: #fff;
      padding: 9px 11px;
      font-size: 13px;
    }

    .quality-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 14px;
    }

    .slider-group { display: flex; align-items: center; gap: 10px; }
    .slider-group label { font-size: 11px; color: #888; width: 68px; flex-shrink: 0; }
    .slider-group input[type=range] { flex: 1; }
    .slider-group .val { font-size: 12px; font-family: monospace; color: #fff; width: 72px; text-align: right; }

    /* Buttons */
    .btn-row { display: flex; gap: 10px; margin-bottom: 14px; }

    .btn {
      flex: 1;
      padding: 11px;
      border-radius: 8px;
      border: none;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
    }

    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-preview { background: #1a1a1a; color: #fff; border: 1px solid #333; }
    .btn-live { background: #E24B4A; color: #fff; }
    .btn-stop { background: #333; color: #fff; }

    /* Status messages */
    .status-msg {
      font-size: 12px;
      padding: 10px 14px;
      border-radius: 8px;
      margin-bottom: 12px;
      display: none;
    }

    .status-msg.error { background: rgba(226,75,74,0.1); border: 1px solid #E24B4A; color: #E24B4A; }
    .status-msg.success { background: rgba(34,197,94,0.08); border: 1px solid #22c55e; color: #22c55e; }
    .status-msg.info { background: rgba(96,165,250,0.08); border: 1px solid #60a5fa; color: #60a5fa; }
    .status-msg.visible { display: block; }

    .divider { border: none; border-top: 1px solid #1e1e1e; margin: 14px 0; }

    .footer-note {
      font-size: 11px;
      color: #444;
      text-align: center;
      margin-top: 10px;
    }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo">● LIVE</div>
    <div class="reporter-name" id="reporter-name">Loading...</div>
  </div>

  <!-- Status message -->
  <div class="status-msg" id="status-msg"></div>

  <!-- Video preview -->
  <div class="video-wrap" id="video-wrap">
    <video id="preview" autoplay muted playsinline></video>
    <div class="placeholder" id="placeholder">
      <svg viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="1.5">
        <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
      </svg>
      <p>Click "Preview Camera" to begin</p>
    </div>
    <div class="live-indicator" id="live-indicator">
      <div class="live-dot"></div> LIVE
    </div>
    <div class="hud" id="hud">
      <div class="hud-row"><span class="hud-label">Bitrate</span><span class="hud-value" id="hud-bitrate">--</span></div>
      <div class="hud-row"><span class="hud-label">FPS</span><span class="hud-value" id="hud-fps">--</span></div>
      <div class="hud-row"><span class="hud-label">Resolution</span><span class="hud-value" id="hud-res">--</span></div>
    </div>
  </div>

  <!-- Stream stats -->
  <div class="stats-bar">
    <div class="stat-card">
      <div class="stat-label">Status</div>
      <div class="stat-value" id="stat-status" style="color:#666">Offline</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Duration</div>
      <div class="stat-value" id="stat-duration">00:00</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Data Sent</div>
      <div class="stat-value" id="stat-data">0 MB</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">WS State</div>
      <div class="stat-value" id="stat-ws" style="color:#666">--</div>
    </div>
  </div>

  <hr class="divider">

  <!-- Device selectors -->
  <div class="controls">
    <div>
      <label class="field-label">Camera</label>
      <select id="cam-select"></select>
    </div>
    <div>
      <label class="field-label">Microphone</label>
      <select id="mic-select"></select>
    </div>
  </div>

  <!-- Quality overrides -->
  <div style="margin-bottom:14px">
    <label class="field-label">Quality settings (pre-filled from your token)</label>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px;">
      <div class="slider-group">
        <label>Bitrate</label>
        <input type="range" id="sl-bitrate" min="200" max="8000" step="100" value="2500" oninput="document.getElementById('sl-bitrate-val').textContent=this.value+' kbps'">
        <span class="val" id="sl-bitrate-val">2500 kbps</span>
      </div>
      <div class="slider-group">
        <label>Framerate</label>
        <input type="range" id="sl-fps" min="10" max="30" step="5" value="25" oninput="document.getElementById('sl-fps-val').textContent=this.value+' fps'">
        <span class="val" id="sl-fps-val">25 fps</span>
      </div>
      <div class="slider-group">
        <label>Resolution</label>
        <select id="sl-res" style="flex:1;background:#1a1a1a;border:1px solid #333;color:#fff;padding:7px 10px;border-radius:6px;font-size:12px;">
          <option value="1920x1080">1920×1080</option>
          <option value="1280x720" selected>1280×720</option>
          <option value="854x480">854×480</option>
          <option value="640x360">640×360</option>
        </select>
        <span class="val" style="color:#888;">res</span>
      </div>
    </div>
  </div>

  <!-- Action buttons -->
  <div class="btn-row">
    <button class="btn btn-preview" id="btn-preview" onclick="startPreview()">Preview Camera</button>
    <button class="btn btn-live" id="btn-stream" onclick="toggleStream()" disabled>Go Live</button>
  </div>

  <div class="footer-note">
    Stream is encrypted end-to-end via SRT. This link is one-time use only.
  </div>
</div>

<script>
// ─────────────────────────────────────────
// CONFIG — change WS_URL to your server
// ─────────────────────────────────────────
const WS_URL = 'wss://yourserver.com/stream';  // UPDATE THIS
const API_URL = '/api';                          // relative to this page's origin

// ─────────────────────────────────────────
// STATE
// ─────────────────────────────────────────
let token = null;
let tokenSettings = null;
let localStream = null;
let mediaRecorder = null;
let wsConn = null;
let streaming = false;
let elapsed = 0;
let bytesSent = 0;
let timerInterval = null;

// ─────────────────────────────────────────
// INIT — read token from URL and validate
// ─────────────────────────────────────────
(async function init() {
  const params = new URLSearchParams(window.location.search);
  token = params.get('token');

  if (!token) {
    showStatus('No token found in URL. Please use the link sent to you.', 'error');
    document.getElementById('reporter-name').textContent = 'Invalid Link';
    return;
  }

  showStatus('Validating your link...', 'info');

  try {
    const resp = await fetch(`${API_URL}/tokens/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await resp.json();

    if (!data.valid) {
      showStatus('Link error: ' + (data.error || 'Invalid or expired link'), 'error');
      document.getElementById('reporter-name').textContent = 'Link Invalid';
      return;
    }

    tokenSettings = data.settings;
    document.getElementById('reporter-name').textContent = tokenSettings.reporterName;
    showStatus('Link valid. Preview your camera then go live.', 'success');

    // Apply quality settings from token
    applyTokenSettings(tokenSettings);

    // Enumerate devices
    await enumerateDevices();

    document.getElementById('btn-preview').disabled = false;
  } catch (e) {
    showStatus('Could not reach server: ' + e.message, 'error');
  }
})();

function applyTokenSettings(s) {
  // Bitrate
  document.getElementById('sl-bitrate').value = s.bitrate;
  document.getElementById('sl-bitrate-val').textContent = s.bitrate + ' kbps';
  // FPS
  document.getElementById('sl-fps').value = s.fps;
  document.getElementById('sl-fps-val').textContent = s.fps + ' fps';
  // Resolution
  document.getElementById('sl-res').value = s.resolution;
  // HUD
  document.getElementById('hud-bitrate').textContent = s.bitrate + ' kbps';
  document.getElementById('hud-fps').textContent = s.fps;
  document.getElementById('hud-res').textContent = s.resolution;
}

// ─────────────────────────────────────────
// DEVICE ENUMERATION
// ─────────────────────────────────────────
async function enumerateDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const camSel = document.getElementById('cam-select');
  const micSel = document.getElementById('mic-select');

  const cams = devices.filter(d => d.kind === 'videoinput');
  const mics = devices.filter(d => d.kind === 'audioinput');

  camSel.innerHTML = cams.map((d, i) => `<option value="${d.deviceId}">${d.label || 'Camera ' + (i + 1)}</option>`).join('');
  micSel.innerHTML = mics.map((d, i) => `<option value="${d.deviceId}">${d.label || 'Mic ' + (i + 1)}</option>`).join('');
}

// ─────────────────────────────────────────
// CAMERA PREVIEW
// ─────────────────────────────────────────
async function startPreview() {
  const res = document.getElementById('sl-res').value;
  const fps = parseInt(document.getElementById('sl-fps').value);
  const [w, h] = res.split('x').map(Number);
  const camId = document.getElementById('cam-select').value;
  const micId = document.getElementById('mic-select').value;

  try {
    if (localStream) localStream.getTracks().forEach(t => t.stop());

    localStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: camId ? { exact: camId } : undefined,
        width: { ideal: w },
        height: { ideal: h },
        frameRate: { ideal: fps },
      },
      audio: {
        deviceId: micId ? { exact: micId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    const vid = document.getElementById('preview');
    vid.srcObject = localStream;
    vid.style.display = 'block';
    document.getElementById('placeholder').style.display = 'none';
    document.getElementById('btn-stream').disabled = false;

    // Re-enumerate with labels now that we have permission
    await enumerateDevices();
    showStatus('Camera ready. Press "Go Live" when ready to stream.', 'success');
  } catch (e) {
    showStatus('Camera access denied: ' + e.message + '. Allow camera permissions and try again.', 'error');
  }
}

// ─────────────────────────────────────────
// STREAM TOGGLE
// ─────────────────────────────────────────
function toggleStream() {
  if (!streaming) startStream();
  else stopStream();
}

function startStream() {
  if (!localStream) { showStatus('Start camera preview first.', 'error'); return; }

  const bitrate = parseInt(document.getElementById('sl-bitrate').value);
  const fps = document.getElementById('sl-fps').value;
  const res = document.getElementById('sl-res').value;

  // Connect WebSocket to SRT bridge
  const wsUrl = `${WS_URL}?token=${encodeURIComponent(token)}&bitrate=${bitrate}&fps=${fps}&res=${res}`;
  wsConn = new WebSocket(wsUrl);
  wsConn.binaryType = 'arraybuffer';

  wsConn.onopen = () => {
    updateWsState('Connected');
  };

  wsConn.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'ready') {
        // Server is ready — start MediaRecorder
        beginRecording(bitrate);
        setLive(true);
        showStatus('', '');
      } else if (msg.type === 'error') {
        showStatus('Server error: ' + msg.message, 'error');
        stopStream();
      }
    } catch {}
  };

  wsConn.onclose = (e) => {
    updateWsState('Disconnected');
    if (streaming) {
      showStatus('Connection lost. Code: ' + e.code, 'error');
      stopStream();
    }
  };

  wsConn.onerror = () => {
    showStatus('WebSocket connection failed. Check server URL.', 'error');
    stopStream();
  };
}

function beginRecording(bitrate) {
  // Pick best supported MIME type
  const mimeTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  const mimeType = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || '';

  mediaRecorder = new MediaRecorder(localStream, {
    mimeType,
    videoBitsPerSecond: bitrate * 1000,
    audioBitsPerSecond: 128000,
  });

  // Send chunks every 100ms for low latency
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0 && wsConn?.readyState === WebSocket.OPEN) {
      e.data.arrayBuffer().then(buf => {
        wsConn.send(buf);
        bytesSent += buf.byteLength;
      });
    }
  };

  mediaRecorder.start(100); // 100ms chunks

  // Start stats timer
  elapsed = 0;
  bytesSent = 0;
  timerInterval = setInterval(updateStats, 1000);
}

function stopStream() {
  streaming = false;

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }

  if (wsConn) {
    wsConn.close();
    wsConn = null;
  }

  clearInterval(timerInterval);
  setLive(false);
  updateWsState('--');
  document.getElementById('stat-status').textContent = 'Offline';
  document.getElementById('stat-status').style.color = '#666';
  document.getElementById('btn-stream').textContent = 'Go Live';
  document.getElementById('btn-stream').className = 'btn btn-live';
}

function setLive(isLive) {
  streaming = isLive;
  document.getElementById('live-indicator').style.display = isLive ? 'flex' : 'none';
  document.getElementById('hud').style.display = isLive ? 'flex' : 'none';
  document.getElementById('stat-status').textContent = isLive ? 'LIVE' : 'Offline';
  document.getElementById('stat-status').style.color = isLive ? '#E24B4A' : '#666';
  document.getElementById('btn-stream').textContent = isLive ? 'Stop Stream' : 'Go Live';
  document.getElementById('btn-stream').className = isLive ? 'btn btn-stop' : 'btn btn-live';
}

// ─────────────────────────────────────────
// STATS UPDATE
// ─────────────────────────────────────────
function updateStats() {
  elapsed++;
  const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const s = String(elapsed % 60).padStart(2, '0');
  document.getElementById('stat-duration').textContent = m + ':' + s;
  document.getElementById('stat-data').textContent = (bytesSent / (1024 * 1024)).toFixed(2) + ' MB';
}

function updateWsState(state) {
  const el = document.getElementById('stat-ws');
  el.textContent = state;
  el.style.color = state === 'Connected' ? '#22c55e' : '#888';
}

// ─────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────
function showStatus(msg, type) {
  const el = document.getElementById('status-msg');
  if (!msg) { el.classList.remove('visible'); return; }
  el.textContent = msg;
  el.className = 'status-msg visible ' + type;
}
</script>
</body>
</html>
```

---

## How to serve this file

In Express (backend), serve it as a static file for the `/live` route:

```typescript
// In src/index.ts
import path from 'path';

// Serve reporter page at /live
app.get('/live', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend-reporter/index.html'));
});

// Or serve the whole frontend-reporter folder
app.use('/live', express.static(path.join(__dirname, '../../frontend-reporter')));
```

## Updating WS_URL

In production, change this line in `index.html`:
```javascript
const WS_URL = 'wss://yourserver.com/stream';
```

To inject it dynamically from the token or a config endpoint:
```javascript
const WS_URL = tokenSettings.wsUrl || 'wss://yourserver.com/stream';
```

Or emit it from the backend by templating the HTML (use EJS or handlebars):
```typescript
app.get('/live', (req, res) => {
  res.render('reporter', { wsUrl: process.env.WS_PUBLIC_URL });
});
```
