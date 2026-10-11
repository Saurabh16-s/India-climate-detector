import { YMAX, YMIN } from '../constants';

export default function YearControls({ year, playing, onYear, onTogglePlay }) {
  return (
    <div className="ctl">
      <div className="leg">
        <span><i style={{ background: '#0b3d91' }} />Flood</span>
        <span><i style={{ background: '#f5b800' }} />Drought</span>
        <span>
          <i style={{ background: '#a9d3f2', height: 3, width: 16, borderRadius: 2, verticalAlign: 'middle' }} />
          River path
        </span>
        <span>Dot size = risk index for the selected year</span>
      </div>
      <button className="btn" onClick={onTogglePlay}>{playing ? 'Pause' : 'Play'}</button>
      <span>Year <b>{year}</b></span>
      <input
        type="range"
        min={YMIN}
        max={YMAX}
        value={year}
        aria-label="Year"
        onChange={(e) => onYear(+e.target.value)}
      />
    </div>
  );
}
