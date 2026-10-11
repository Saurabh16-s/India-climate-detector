import { TABS } from '../constants';

export default function Tabs({ cur, onSelect }) {
  const active = cur || 'All India';
  return (
    <div className="tabs">
      {TABS.map((n) => (
        <button
          key={n}
          className={'tab' + (n === active ? ' on' : '')}
          onClick={() => onSelect(n === 'All India' ? null : n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
