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
            <div style={{ color: '#888', fontSize: '13px', marginBottom: '28px' }}>Made with love By <a href="https://notrana.is-a.dev/">Asad</a></div>

        </div>
    );
}
