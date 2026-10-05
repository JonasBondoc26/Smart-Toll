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

const authHeader = () => {
  const token = localStorage.getItem('st_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** POST a FormData (file upload). On failure the Error carries the whole answer as err.data. */
export async function apiUpload(path, formData) {
  const res = await fetch('/api' + path, { method: 'POST', headers: { Accept: 'application/json', ...authHeader() }, body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || (Array.isArray(data.errors) ? data.errors[0] : 'Something went wrong. Please try again.'));
    err.data = data;
    throw err;
  }
  return data;
}

/** GET a file from the API and hand it to the browser as a download. */
export async function apiDownload(path, filename) {
  const res = await fetch('/api' + path, { headers: authHeader() });
  if (!res.ok) throw new Error('The download failed. Please try again.');
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
