// Turns the pipeline output (pipeline/data/risk_data.json) into the data the app reads:
//   src/data/districts.json          React app
//   backend/src/data/districts.json  Lambda alerts backend
//   src/data/riverNames.json         river names shown on flood districts (merged, never shrinks)
//
// App format per state: [[name, lat, lon, hazard, blurb, series(21 values, null = no data)], ...]
//
// Usage: npm run sync-data [-- --flood-end 2021]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const SRC = flag('--src', 'pipeline/data/risk_data.json');
// Flood sources (DFO) stop publishing after this year, so later flood values are
// "no data" rather than a real zero.
const FLOOD_END = Number(flag('--flood-end', 2021));

const raw = JSON.parse(readFileSync(SRC, 'utf8'));
const years = raw.years;

function blurb(row, series) {
  const vals = series.map((v, i) => [v, years[i]]).filter(([v]) => v != null);
  const [peak, peakYear] = vals.reduce((a, b) => (b[0] > a[0] ? b : a));
  const avg = Math.round(vals.reduce((s, [v]) => s + v, 0) / vals.length);
  if (row.hazard === 'Flood') {
    const hit = vals.filter(([v]) => v > 0).length;
    return `Flooding in ${hit} of ${vals.length} years with data (${vals[0][1]} to ${vals.at(-1)[1]}). Average index ${avg}, peak ${peak} in ${peakYear}.`;
  }
  return `Drought pressure from low monsoon rainfall and a dry climate. Average index ${avg}, worst year ${peakYear} (${peak}).`;
}

const D = {};
const rivers = {};
for (const [state, rows] of Object.entries(raw.states)) {
  D[state] = rows.map((r) => {
    const series = r.series.map((v, i) => (r.hazard === 'Flood' && years[i] > FLOOD_END ? null : v));
    if (r.hazard === 'Flood' && r.river) rivers[r.name] = r.river;
    return [r.name, r.lat, r.lon, r.hazard, blurb(r, series), series];
  });
}

const write = (path, data, pretty) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, pretty ? 1 : 0) + '\n');
};
write('src/data/districts.json', D);
write('backend/src/data/districts.json', D);

const rivPath = 'src/data/riverNames.json';
const existing = existsSync(rivPath) ? JSON.parse(readFileSync(rivPath, 'utf8')) : {};
write(rivPath, { ...existing, ...rivers }, true);

const n = Object.values(D).reduce((s, v) => s + v.length, 0);
console.log(`Synced ${n} districts in ${Object.keys(D).length} states (data from ${raw.generated}).`);
console.log(`Flood values after ${FLOOD_END} are marked "no data". Wrote app, backend and river names.`);
