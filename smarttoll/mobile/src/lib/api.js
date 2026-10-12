import Constants from 'expo-constants';

// Fetch wrapper for the SmartToll Laravel API, the same one the website uses.
// The phone reaches it over Wi-Fi, so it needs this computer's LAN address, not localhost:
//   1. EXPO_PUBLIC_API_URL in mobile/.env, when set (e.g. http://192.168.1.10:8000), else
//   2. the computer Expo is serving the app from, on port 8000 (php artisan serve --host 0.0.0.0).
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || (devHost ? `http://${devHost}:8000` : 'http://localhost:8000')).replace(/\/+$/, '');

let token = null;
let onUnauthorized = () => {};

/** Set by the session once the user logs in (or null after logging out). */
export const setToken = (t) => { token = t; };
/** Called when the API rejects the token (expired or logged out elsewhere). */
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export async function api(path, { method = 'GET', body, timeout = 60000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let res;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    throw new Error(e.name === 'AbortError'
      ? 'The server took too long to answer. Please try again.'
      : `Cannot reach the SmartToll server at ${API_URL}. Check that the phone and the computer are on the same Wi-Fi and the API is running.`);
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    const first = data.errors && Object.values(data.errors)[0]?.[0];
    const err = new Error(first || data.message || 'Something went wrong. Please try again.');
    err.status = res.status;
    throw err;
  }
  return data;
}
