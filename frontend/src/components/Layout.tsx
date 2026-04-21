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
