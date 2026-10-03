// Thin fetch wrapper for the Laravel REST API. Token is a Sanctum bearer token.
export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('st_token');
  const res = await fetch('/api' + path, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) { localStorage.removeItem('st_token'); localStorage.removeItem('st_user'); }
    const first = data.errors && Object.values(data.errors)[0]?.[0];
    throw new Error(first || data.message || 'Something went wrong. Please try again.');
  }
  return data;
}
