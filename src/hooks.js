import { useEffect, useRef, useState } from 'react';
import { HOME } from './constants';

// Tracks an element's rendered size.
export function useElementSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

// Animates the SVG viewBox to the selected state (or back to all of India).
export function useViewBox(cur, svgRef, pathRefs) {
  const [vb, setVb] = useState(HOME);
  const vbRef = useRef(HOME);

  useEffect(() => {
    let target = HOME;
    const path = cur && pathRefs.current[cur];
    const svg = svgRef.current;
    if (path && svg) {
      const b = path.getBBox();
      const pad = Math.max(b.width, b.height) * 0.12;
      const r = svg.getBoundingClientRect();
      const asp = r.width / r.height;
      let w = b.width + 2 * pad;
      let h = b.height + 2 * pad;
      if (w / h < asp) w = h * asp;
      else h = w / asp;
      target = { x: b.x + b.width / 2 - w / 2, y: b.y + b.height / 2 - h / 2, w, h };
    }

    const from = { ...vbRef.current };
    const t0 = performance.now();
    let id;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 450);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const next = {};
      for (const key of ['x', 'y', 'w', 'h']) next[key] = from[key] + (target[key] - from[key]) * e;
      vbRef.current = next;
      setVb(next);
      if (k < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [cur, svgRef, pathRefs]);

  return vb;
}
