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
    shortenUrl: (url: string) =>
        api.post<{ shortUrl: string }>('/tokens/shorten', { url }),
    listActive: () =>
        api.get<{ activeTokens: string[]; streams: ActiveStreamInfo[] }>('/tokens/active'),
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

export interface ActiveStreamInfo {
    token: string;
    reporterName: string;
    streamId: string;
    resolution: string;
    bitrate: number;
    fps: number;
    startedAt: string;
}
