import { D } from './data/districts';
import { RIV } from './data/riverNames';

export const FLOOD = '#0b3d91';
export const DROUGHT = '#f5b800';
export const YMIN = 2005;
export const YMAX = 2025;
export const HOME = { x: 0, y: 0, w: 490, h: 545 };
export const TABS = ['All India', ...Object.keys(D)];


export const hazardColor = (d) => (d[3] === 'Flood' ? FLOOD : DROUGHT);
export const riverText = (d) => (d[3] === 'Flood' ? RIV[d[0]] || '' : '');


export const project = (lo, la) => [(lo - 67.5) * 16.2, (37.5 - la) * 17.5];


export function visibleDistricts(cur, filt) {
  const out = [];
  Object.keys(D).forEach((s) => {
    if (cur && s !== cur) return;
    D[s].forEach((d, i) => {
      if (filt === 'All' || d[3] === filt) out.push({ s, i, r: i + 1, d });
    });
  });
  return out;
}
