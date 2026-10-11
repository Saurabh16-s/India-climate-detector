import { YMAX, YMIN } from '../constants';

const W = 300, H = 124, L = 26, R = 6, T = 8, B = 20;

export default function TrendChart({ series, color, year, onYear }) {
  const n = series.length;
  const X = (i) => L + (i * (W - L - R)) / (n - 1);
  const Y = (v) => T + ((100 - v) * (H - T - B)) / 100;

  let last = n - 1;
  while (last >= 0 && series[last] == null) last--;

  const pts = series
    .slice(0, last + 1)
    .map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`)
    .join(' ');

  const sx = X(year - YMIN);
  const cur = series[year - YMIN];
  const x0 = X(last + 0.5);

  const handleClick = (e) => {
    const b = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - b.left) / b.width) * W;
    const i = Math.round(((vx - L) / (W - L - R)) * (YMAX - YMIN));
    onYear(YMIN + Math.max(0, Math.min(YMAX - YMIN, i)));
  };

  return (
    <svg className="ch" viewBox={`0 0 ${W} ${H}`} aria-label="Risk index trend" onClick={handleClick}>
      {last < n - 1 && (
        <>
          <rect x={x0} y={T} width={W - R - x0} height={H - T - B} fill="#f1f2f4" />
          <text x={(x0 + W - R) / 2} y={T + (H - T - B) / 2} fontSize="9" fill="#6b7280" textAnchor="middle">
            no data
          </text>
        </>
      )}
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={L} x2={W - R} y1={Y(g)} y2={Y(g)} stroke="#e6e8ec" />
          <text x={L - 4} y={Y(g) + 3} fontSize="9" fill="#6b7280" textAnchor="end">{g}</text>
        </g>
      ))}
      <polygon points={`${X(0)},${Y(0)} ${pts} ${X(last)},${Y(0)}`} fill={color} fillOpacity=".18" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <line x1={sx} x2={sx} y1={T} y2={Y(0)} stroke="#16181d" strokeDasharray="3 3" />
      {cur != null && <circle cx={sx} cy={Y(cur)} r="4.5" fill={color} stroke="#16181d" strokeWidth="1.5" />}
      {[2005, 2015, 2025].map((y) => (
        <text key={y} x={X(y - YMIN)} y={H - 6} fontSize="9" fill="#6b7280" textAnchor="middle">{y}</text>
      ))}
    </svg>
  );
}
