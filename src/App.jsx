import { useEffect, useMemo, useRef, useState } from 'react';
import { YMAX, YMIN, visibleDistricts } from './constants';
import { useElementSize, useViewBox } from './hooks';
import Tabs from './components/Tabs';
import MapView from './components/MapView';
import YearControls from './components/YearControls';
import Panel from './components/Panel';
import Note from './components/Note';

export default function App() {
  const [cur, setCur] = useState(null);      // selected state, null = all India
  const [filt, setFilt] = useState('All');   // All | Flood | Drought
  const [sel, setSel] = useState(null);      // { s: state, i: district index }
  const [year, setYear] = useState(YMAX);
  const [playing, setPlaying] = useState(false);

  const svgRef = useRef(null);
  const pathRefs = useRef({});
  const vb = useViewBox(cur, svgRef, pathRefs);
  const size = useElementSize(svgRef);
  const list = useMemo(() => visibleDistricts(cur, filt), [cur, filt]);

  const goState = (n) => {
    setCur(n);
    setSel(n ? { s: n, i: 0 } : null);
    setFilt('All');
  };

  const pickDistrict = (s, i) => {
    if (cur !== s) {
      setCur(s);
      setFilt('All');
    }
    setSel({ s, i });
  };

  const changeFilter = (f) => {
    setFilt(f);
    const v = visibleDistricts(cur, f);
    setSel(v.length ? { s: v[0].s, i: v[0].i } : null);
  };

  // Autoplay through the years
  useEffect(() => {
    if (!playing) return;
    if (year >= YMAX) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setYear((y) => y + 1), 600);
    return () => clearTimeout(t);
  }, [playing, year]);

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (year >= YMAX) setYear(YMIN);
    setPlaying(true);
  };

  return (
    <div className="wrap">
      <h1>India Climate Risk Tracker</h1>
      <p className="sub">
        Where floods and droughts hit hardest. Pick a state to see its 10 most affected districts.
      </p>
      <Tabs cur={cur} onSelect={goState} />
      <div className="grid">
        <div className="map-col">
          <MapView
            svgRef={svgRef}
            pathRefs={pathRefs}
            cur={cur}
            sel={sel}
            list={list}
            year={year}
            vb={vb}
            size={size}
            onState={goState}
            onPick={pickDistrict}
            onClear={() => setSel(null)}
          />
          <YearControls year={year} playing={playing} onYear={setYear} onTogglePlay={togglePlay} />
        </div>
        <Panel
          cur={cur}
          filt={filt}
          list={list}
          sel={sel}
          year={year}
          onState={goState}
          onFilter={changeFilter}
          onPick={pickDistrict}
          onYear={setYear}
        />
      </div>
      <Note />
    </div>
  );
}
