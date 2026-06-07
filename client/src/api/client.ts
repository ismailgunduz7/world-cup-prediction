import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

/** Dev: `/api` (Vite proxy). Prod: `VITE_API_URL` ile tam backend adresi. */
export const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  // Send the httpOnly refresh-token cookie with requests.
  withCredentials: true,
});

// The access token lives only in memory: it is never written to localStorage,
// so it isn't exposed to XSS-readable storage. The refresh token is an
// httpOnly cookie the JS never sees. On reload the access token is gone and is
// transparently re-minted from the refresh cookie (see auth store initialize).
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function clearAccessToken() {
  accessToken = null;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let isRefreshing = false;
let pendingRequests: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    // Don't try to refresh on auth endpoints, on non-401s, or on a request we
    // already retried once (prevents an infinite refresh loop).
    if (!original || error.response?.status !== 401 || original.url?.includes('/auth/') || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingRequests.push({
          resolve: (token: string) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          },
          reject,
        });
      });
    }

    isRefreshing = true;

    try {
      // The refresh token rides along as an httpOnly cookie.
      const { data } = await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
      setAccessToken(data.accessToken);
      pendingRequests.forEach((cb) => cb.resolve(data.accessToken));
      pendingRequests = [];
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch (refreshError) {
      pendingRequests.forEach((cb) => cb.reject(refreshError));
      pendingRequests = [];
      clearAccessToken();
      window.location.href = '/giris';
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;

export const ADMIN_PATH = import.meta.env.VITE_ADMIN_PATH || 'internal-console-7k9m2';
