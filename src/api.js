const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export async function subscribe({ state, district, email }) {
  if (!API) throw new Error('Alerts are not set up yet. Add VITE_API_URL to your .env file.');
  let res;
  try {
    res = await fetch(`${API}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, district, email }),
    });
  } catch {
    throw new Error('Could not reach the alerts service. Check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Something went wrong. Please try again.');
  return data.message;
}
