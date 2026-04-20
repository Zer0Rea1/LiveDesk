# Admin Frontend — React + Vite Dashboard

## Setup

```bash
cd frontend-admin
npm create vite@latest . -- --template react-ts
npm install axios react-router-dom @tanstack/react-query date-fns
```

---

## `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
```

---

## API Client — `src/api/client.ts`

```typescript
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Attach admin JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// Typed API calls
export const authApi = {
  login: (password: string) =>
    api.post<{ token: string }>('/auth/login', { password }),
};

export const tokensApi = {
  generate: (data: GenerateTokenPayload) =>
    api.post<TokenRecord>('/tokens/generate', data),
  list: () =>
    api.get<TokenRecord[]>('/tokens'),
  revoke: (id: string) =>
    api.delete(`/tokens/${id}`),
};

export interface GenerateTokenPayload {
  reporterName: string;
  resolution: string;
  bitrate: number;
  fps: number;
  expiresInMinutes: number;
  srtServer?: string;
}

export interface TokenRecord {
  id: string;
  token: string;
  reporterName: string;
  resolution: string;
  bitrate: number;
  fps: number;
  status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED';
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  url: string;
}
```

---

## App Entry — `src/App.tsx`

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import GenerateToken from './pages/GenerateToken';
import Layout from './components/Layout';

const queryClient = new QueryClient();

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem('admin_token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<Dashboard />} />
            <Route path="generate" element={<GenerateToken />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

---

## Login Page — `src/pages/LoginPage.tsx`

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await authApi.login(password);
      localStorage.setItem('admin_token', data.token);
      navigate('/');
    } catch {
      setError('Invalid password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f' }}>
      <form onSubmit={handleLogin} style={{ background: '#1a1a1a', padding: '40px', borderRadius: '12px', width: '360px', border: '1px solid #333' }}>
        <div style={{ color: '#E24B4A', fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>
          ● LIVE ADMIN
        </div>
        <p style={{ color: '#888', fontSize: '13px', marginBottom: '28px' }}>News Channel Broadcast System</p>

        <label style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '6px' }}>Admin Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Enter admin password"
          required
          style={{ width: '100%', padding: '10px 12px', background: '#111', border: '1px solid #333', borderRadius: '8px', color: '#fff', fontSize: '14px', marginBottom: '16px' }}
        />
        {error && <p style={{ color: '#E24B4A', fontSize: '12px', marginBottom: '12px' }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: '11px', background: '#E24B4A', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
```

---

## Layout — `src/components/Layout.tsx`

```tsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom';

export default function Layout() {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem('admin_token');
    navigate('/login');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f0f0f', color: '#fff' }}>
      {/* Sidebar */}
      <nav style={{ width: '220px', background: '#141414', borderRight: '1px solid #222', padding: '24px 16px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ color: '#E24B4A', fontWeight: '700', fontSize: '16px', marginBottom: '32px', paddingLeft: '8px' }}>
          ● LIVE ADMIN
        </div>
        <NavLink to="/" end style={({ isActive }) => navStyle(isActive)}>Dashboard</NavLink>
        <NavLink to="/generate" style={({ isActive }) => navStyle(isActive)}>Generate Link</NavLink>
        <div style={{ flex: 1 }} />
        <button onClick={logout} style={{ background: 'transparent', border: '1px solid #333', color: '#888', borderRadius: '8px', padding: '8px', cursor: 'pointer', fontSize: '13px' }}>
          Logout
        </button>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}

function navStyle(isActive: boolean) {
  return {
    display: 'block',
    padding: '10px 12px',
    marginBottom: '4px',
    borderRadius: '8px',
    color: isActive ? '#E24B4A' : '#aaa',
    background: isActive ? 'rgba(226,75,74,0.08)' : 'transparent',
    textDecoration: 'none',
    fontSize: '14px',
  };
}
```

---

## Generate Token Page — `src/pages/GenerateToken.tsx`

```tsx
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { tokensApi, GenerateTokenPayload, TokenRecord } from '../api/client';

const PRESETS = [
  { label: 'Studio HD', resolution: '1920x1080', bitrate: 6000, fps: 30, badge: 'High bandwidth' },
  { label: 'Field 720p', resolution: '1280x720', bitrate: 2500, fps: 30, badge: 'Standard' },
  { label: 'Remote 480p', resolution: '854x480', bitrate: 800, fps: 25, badge: 'Low bandwidth' },
  { label: 'Emergency 360p', resolution: '640x360', bitrate: 400, fps: 15, badge: 'Very low' },
];

export default function GenerateToken() {
  const [form, setForm] = useState<GenerateTokenPayload>({
    reporterName: '',
    resolution: '1280x720',
    bitrate: 2500,
    fps: 30,
    expiresInMinutes: 60,
    srtServer: 'srt://your-server.com:9998',
  });
  const [generated, setGenerated] = useState<TokenRecord | null>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: tokensApi.generate,
    onSuccess: (res) => setGenerated(res.data),
  });

  function applyPreset(preset: typeof PRESETS[0]) {
    setForm(f => ({ ...f, resolution: preset.resolution, bitrate: preset.bitrate, fps: preset.fps }));
  }

  function copyUrl() {
    if (generated) {
      navigator.clipboard.writeText(generated.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div style={{ maxWidth: '720px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '4px' }}>Generate Reporter Link</h1>
      <p style={{ color: '#888', fontSize: '14px', marginBottom: '28px' }}>Create a one-time URL to send to your journalist</p>

      {/* Presets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '24px' }}>
        {PRESETS.map(p => (
          <div
            key={p.label}
            onClick={() => applyPreset(p)}
            style={{
              border: form.resolution === p.resolution ? '1px solid #E24B4A' : '1px solid #333',
              borderRadius: '10px', padding: '12px', cursor: 'pointer',
              background: form.resolution === p.resolution ? 'rgba(226,75,74,0.08)' : '#1a1a1a',
            }}
          >
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{p.badge}</div>
            <div style={{ fontSize: '14px', fontWeight: '600' }}>{p.label}</div>
            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>{p.resolution} · {p.bitrate}k</div>
          </div>
        ))}
      </div>

      {/* Form */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
        <FormField label="Reporter Name">
          <input value={form.reporterName} onChange={e => setForm(f => ({ ...f, reporterName: e.target.value }))} placeholder="e.g. Ahmed Raza" />
        </FormField>
        <FormField label="Expires In">
          <select value={form.expiresInMinutes} onChange={e => setForm(f => ({ ...f, expiresInMinutes: parseInt(e.target.value) }))}>
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
            <option value={120}>2 hours</option>
            <option value={480}>8 hours</option>
            <option value={1440}>24 hours</option>
          </select>
        </FormField>
        <FormField label="Resolution">
          <select value={form.resolution} onChange={e => setForm(f => ({ ...f, resolution: e.target.value }))}>
            <option value="1920x1080">1920×1080 (1080p)</option>
            <option value="1280x720">1280×720 (720p)</option>
            <option value="854x480">854×480 (480p)</option>
            <option value="640x360">640×360 (360p)</option>
          </select>
        </FormField>
        <FormField label="Framerate">
          <select value={form.fps} onChange={e => setForm(f => ({ ...f, fps: parseInt(e.target.value) }))}>
            <option value={30}>30 fps</option>
            <option value={25}>25 fps</option>
            <option value={15}>15 fps</option>
          </select>
        </FormField>
        <FormField label={`Bitrate: ${form.bitrate} kbps`}>
          <input type="range" min={200} max={8000} step={100} value={form.bitrate}
            onChange={e => setForm(f => ({ ...f, bitrate: parseInt(e.target.value) }))} />
        </FormField>
        <FormField label="SRT Server URL">
          <input value={form.srtServer} onChange={e => setForm(f => ({ ...f, srtServer: e.target.value }))} placeholder="srt://yourserver.com:9998" />
        </FormField>
      </div>

      <button
        onClick={() => mutation.mutate(form)}
        disabled={mutation.isPending || !form.reporterName}
        style={{ padding: '11px 28px', background: '#E24B4A', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
      >
        {mutation.isPending ? 'Generating...' : 'Generate Link'}
      </button>

      {/* Generated URL display */}
      {generated && (
        <div style={{ marginTop: '24px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', padding: '20px' }}>
          <div style={{ color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
            Reporter Link — Send this to {generated.reporterName}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#60a5fa', wordBreak: 'break-all', marginBottom: '14px' }}>
            {generated.url}
          </div>
          <button onClick={copyUrl} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #60a5fa', color: '#60a5fa', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#888' }}>
            Expires: {new Date(generated.expiresAt).toLocaleString()} · {generated.resolution} · {generated.bitrate} kbps · {generated.fps} fps
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '5px' }}>{label}</label>
      <div style={{ width: '100%' }}>{children}</div>
    </div>
  );
}
```

---

## Dashboard Page — `src/pages/Dashboard.tsx`

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tokensApi, TokenRecord } from '../api/client';
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
```
