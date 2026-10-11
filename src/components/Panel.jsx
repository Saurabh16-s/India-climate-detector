import { D } from '../data/districts';
import { FLOOD, YMIN, hazardColor, riverText } from '../constants';
import TrendChart from './TrendChart';
import SubscribeBox from './SubscribeBox';

const tagStyle = (hazard) =>
  hazard === 'Flood'
    ? { background: '#e4ebf8', color: FLOOD }
    : { background: '#fdf1c7', color: '#7a5a00' };

export default function Panel({ cur, filt, list, sel, year, onState, onFilter, onPick, onYear }) {
  if (!cur) {
    return (
      <div className="panel">
        <h2>Pilot states</h2>
        <div className="empty">
          Select a state on the map or from the tabs to see its 10 most affected districts.
        </div>
        {Object.keys(D).map((s) => {
          const f = D[s].filter((d) => d[3] === 'Flood').length;
          const dr = D[s].length - f;
          const tags = [];
          if (f) tags.push(f + ' flood');
          if (dr) tags.push(dr + ' drought');
          return (
            <div className="row" key={s} onClick={() => onState(s)}>
              <span className="nm">{s}</span>
              <span className="tag">{tags.join(' / ')}</span>
            </div>
          );
        })}
      </div>
    );
  }

  const hazards = new Set(D[cur].map((d) => d[3]));

  let card = null;
  if (sel) {
    const d = D[sel.s][sel.i];
    const rank = sel.i + 1;
    const s = d[5];
    const v = s[year - YMIN];
    const ok = s.filter((x) => x != null);
    const avg = Math.round(ok.reduce((a, b) => a + b, 0) / ok.length);
    const peak = s.indexOf(Math.max(...ok));
    const river = riverText(d);
    card = (
      <div className="card">
        <b>#{rank} {d[0]}</b>
        {d[4]}
        {river && <div className="riv">Flood source: <b>{river}</b></div>}
        <div className="kv">
          <span>{year}: <b>{v == null ? 'no data' : v}</b></span>
          <span>Average: <b>{avg}</b></span>
          <span>Peak: <b>{YMIN + peak}</b></span>
        </div>
        <TrendChart series={s} color={hazardColor(d)} year={year} onYear={onYear} />
        <div className="mini">
          Risk index (0 to 100) per year
          {s.includes(null) ? `. Flood records end in ${YMIN + s.findLastIndex((x) => x != null)}, so later years show no data` : ''}
          . Tap the chart to jump to a year.
        </div>
        <SubscribeBox key={`${sel.s}-${d[0]}`} state={sel.s} district={d[0]} hazard={d[3]} />
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>{cur}: top 10 affected districts</h2>
      {hazards.size > 1 && (
        <div className="chips">
          {['All', 'Flood', 'Drought'].map((f) => (
            <span
              key={f}
              className={'chip' + (filt === f ? ' on' : '')}
              onClick={() => onFilter(f)}
            >
              {f}
            </span>
          ))}
        </div>
      )}
      {list.map((o) => {
        const river = riverText(o.d);
        const act = !!sel && sel.s === o.s && sel.i === o.i;
        return (
          <div className={'row' + (act ? ' act' : '')} key={`${o.s}-${o.i}`} onClick={() => onPick(cur, o.i)}>
            <span
              className="rk"
              style={{ background: hazardColor(o.d), color: o.d[3] === 'Flood' ? '#fff' : '#16181d' }}
            >
              {o.r}
            </span>
            <span className="nm">
              {o.d[0]}
              {river && <span className="rv">River: {river}</span>}
            </span>
            <span className="tag" style={tagStyle(o.d[3])}>{o.d[3]}</span>
          </div>
        );
      })}
      {card}
    </div>
  );
}
