// Tiny dependency-free SVG charts

// Line chart. series: [{ label, color, points: [{ x: 'label', y: number }] }]
export function LineChart({ series, height = 180, unit = '' }) {
  const all = series.flatMap(s => s.points);
  if (all.length === 0) return <div className="chart-empty">Henüz veri yok</div>;
  const W = 600;
  const padL = 40, padR = 12, padT = 14, padB = 26;
  const ys = all.map(p => p.y);
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  min -= span * 0.1;
  max += span * 0.1;
  const n = Math.max(...series.map(s => s.points.length));
  const x = (i, len) => padL + (len <= 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (len - 1));
  const y = (v) => padT + (1 - (v - min) / (max - min)) * (height - padT - padB);
  const ticks = [min, (min + max) / 2, max];

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="chart-svg" role="img">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity="0.1" />
          <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="currentColor" fillOpacity="0.6">{Math.round(t * 10) / 10}</text>
        </g>
      ))}
      {series.map(s => {
        const pts = s.points.map((p, i) => [x(i, s.points.length), y(p.y)]);
        return (
          <g key={s.label}>
            <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" />
            {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill={s.color}><title>{`${s.points[i].x}: ${s.points[i].y}${unit}`}</title></circle>)}
          </g>
        );
      })}
      {(series[0]?.points || []).map((p, i, arr) => {
        const step = Math.ceil(n / 6);
        if (i % step !== 0 && i !== arr.length - 1) return null;
        return <text key={i} x={x(i, arr.length)} y={height - 6} textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity="0.6">{p.x}</text>;
      })}
    </svg>
  );
}

// Simple bar chart. bars: [{ label, value }]
export function BarChart({ bars, height = 120, color = '#6366f1' }) {
  if (bars.length === 0) return <div className="chart-empty">Henüz veri yok</div>;
  const max = Math.max(...bars.map(b => b.value), 1);
  return (
    <div className="bars" style={{ height }}>
      {bars.map((b, i) => (
        <div key={i} className="bar-col" title={`${b.label}: ${b.value}`}>
          <div className="bar" style={{ height: `${(b.value / max) * 100}%`, background: color }} />
          <span>{b.label}</span>
        </div>
      ))}
    </div>
  );
}
