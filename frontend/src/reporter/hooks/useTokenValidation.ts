import { useState, useEffect } from 'react';
import type { TokenSettings } from '../types.ts';

const API_URL = '/api';

export function useTokenValidation() {
  const [token, setToken] = useState<string | null>(null);
  const [settings, setSettings] = useState<TokenSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');

    if (!t) {
      setError('No token found in URL. Please use the link sent to you.');
      setLoading(false);
      return;
    }

    setToken(t);

    fetch(`${API_URL}/tokens/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: t }),
    })
      .then((resp) => resp.json())
      .then((data) => {
        if (!data.valid) {
          setError('Link error: ' + (data.error || 'Invalid or expired link'));
        } else {
          setSettings(data.settings);
        }
      })
      .catch((e) => {
        setError('Could not reach server: ' + e.message);
      })
      .finally(() => setLoading(false));
  }, []);

  return { token, settings, error, loading };
}
