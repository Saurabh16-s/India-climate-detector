import { readFileSync } from 'node:fs';

// Built by `npm run sync-data` from the app's district data.
// A district row is: [name, lat, lon, hazard, blurb, yearlySeries]
const D = JSON.parse(readFileSync(new URL('../data/districts.json', import.meta.url), 'utf8'));

export function findDistrict(state, name) {
  if (typeof state !== 'string' || typeof name !== 'string') return null;
  if (!Object.hasOwn(D, state) || !Array.isArray(D[state])) return null;
  const i = D[state].findIndex((d) => d[0] === name);
  if (i < 0) return null;
  const [n, lat, lon, hazard] = D[state][i];
  return { state, name: n, lat, lon, hazard, rank: i + 1, total: D[state].length };
}

export const districtKey = (state, name) => `${state}#${name}`;

export function parseKey(key) {
  const [state, ...rest] = String(key).split('#');
  return findDistrict(state, rest.join('#'));
}
