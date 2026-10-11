import { STATES } from '../data/states';
import { D } from '../data/districts';
import { RIVERS } from '../data/rivers';
import { FLOOD, YMIN, hazardColor, project, riverText } from '../constants';

export default function MapView({
  svgRef, pathRefs, cur, sel, list, year, vb, size, onState, onPick, onClear,
}) {
  const k = Math.min(size.w / vb.w, size.h / vb.h) || 1;
  const zoom = !!cur;
  const isAct = (o) => !!sel && sel.s === o.s && sel.i === o.i;

  // Draw the selected district last so it sits on top
  const dots = [...list].sort((a, b) => isAct(a) - isAct(b));

  const stateRivers = cur ? RIVERS.S[cur] || [] : [];
  const districtRivers = cur && sel ? RIVERS.Dist[D[sel.s][sel.i][0]] || [] : [];

  return (
    <div className="map">
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        aria-label="Map of India"
        onClick={(e) => {
          if (e.target === e.currentTarget && cur) onClear();
        }}
      >
        <g>
          {STATES.map((s) => {
            const hasData = !!D[s.n];
            const cls =
              'st' +
              (hasData ? ' f' : '') +
              (s.n === cur ? ' sel' : '') +
              (cur && s.n !== cur && !hasData ? ' dim' : '');
            return (
              <path
                key={s.n}
                ref={(el) => { pathRefs.current[s.n] = el; }}
                d={s.d}
                className={cls}
                onClick={hasData ? () => onState(s.n) : undefined}
              >
                {hasData && <title>{s.n}</title>}
              </path>
            );
          })}
        </g>

        <g>
          {stateRivers.map((r, i) => (
            <path key={`s-${r.n}-${i}`} d={r.d} className="rv0 rv1">
              <title>{r.n}</title>
            </path>
          ))}
          {districtRivers.map((r, i) => (
            <path key={`d-${r.n}-${i}`} d={r.d} className="rv0 rv2" />
          ))}
        </g>

        <g>
          {zoom &&
            stateRivers.map((r, i) => (
              <text
                key={`rl-${r.n}-${i}`}
                x={r.a[0]}
                y={r.a[1]}
                className="rl"
                fontSize={10.5 / k}
                strokeWidth={3 / k}
              >
                {r.n}
              </text>
            ))}

          {dots.map((o) => {
            const { d } = o;
            const [name, , , hazard] = d;
            const [x, y] = project(d[2], d[1]);
            const v = d[5][year - YMIN];
            const vv = v == null ? 0 : v;
            const r = (zoom ? 7 + (vv / 100) * 7 : 2.6 + (vv / 100) * 3) / k;
            const act = isAct(o);
            const river = riverText(d);
            return (
              <g key={`${o.s}-${o.i}`}>
                <circle
                  cx={x}
                  cy={y}
                  r={act ? r * 1.2 : r}
                  fill={hazardColor(d)}
                  fillOpacity={0.93}
                  className={'dot' + (act ? ' act' : '')}
                  strokeWidth={1.5 / k}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPick(o.s, o.i);
                  }}
                >
                  <title>{`${name}, ${o.s} (${year}${v == null ? ': no data' : ' index ' + v})`}</title>
                </circle>
                {zoom && (
                  <>
                    <text
                      x={x}
                      y={y + 3.4 / k}
                      className="num"
                      fontSize={10 / k}
                      style={{ fill: hazard === 'Flood' ? '#fff' : '#16181d' }}
                    >
                      {o.r}
                    </text>
                    <text x={x + r + 4 / k} y={y + 4 / k} className="lab" fontSize={12 / k} strokeWidth={3 / k}>
                      {name}
                    </text>
                    {act && river && (
                      <text
                        x={x + r + 4 / k}
                        y={y + 18 / k}
                        className="lab"
                        fontSize={11 / k}
                        strokeWidth={3 / k}
                        fontStyle="italic"
                        style={{ fill: FLOOD }}
                      >
                        {'River: ' + river}
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
