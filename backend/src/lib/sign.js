import { createHmac, timingSafeEqual } from 'node:crypto';

// Confirm / unsubscribe links are signed, so no token has to be stored.
const secret = () => process.env.LINK_SECRET;

export function sign(action, district, email) {
  return createHmac('sha256', secret()).update(`${action}|${district}|${email}`).digest('hex');
}

export function verify(action, district, email, sig) {
  if (!sig || !secret()) return false;
  const a = Buffer.from(sign(action, district, email));
  const b = Buffer.from(String(sig));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function link(apiBase, action, district, email) {
  const q = new URLSearchParams({ d: district, e: email, s: sign(action, district, email) });
  return `${apiBase}/${action}?${q}`;
}
