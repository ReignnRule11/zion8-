import type { WeeklyPoint } from '@/lib/dashboard';

export function Sparkline({
  points,
  label,
}: {
  points: WeeklyPoint[];
  label: string;
}) {
  if (points.length === 0) {
    return <p className="text-sm text-slate-500">No series for this range.</p>;
  }

  const width = 320;
  const height = 72;
  const max = Math.max(...points.map((point) => point.value), 1);
  const step = points.length === 1 ? width : width / (points.length - 1);
  const coords = points.map((point, index) => {
    const x = index * step;
    const y = height - (point.value / max) * (height - 8) - 4;
    return `${x},${y}`;
  });
  const summary = points.map((point) => `${point.label} ${point.value}`).join(', ');

  return (
    <svg
      role="img"
      aria-label={`${label}: ${summary}`}
      viewBox={`0 0 ${width} ${height}`}
      className="h-20 w-full"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-zion-400"
        points={coords.join(' ')}
      />
    </svg>
  );
}

export function BarChart({
  points,
  label,
  formatValue,
}: {
  points: WeeklyPoint[];
  label: string;
  formatValue?: (value: number) => string;
}) {
  if (points.length === 0) {
    return <p className="text-sm text-slate-500">No series for this range.</p>;
  }

  const max = Math.max(...points.map((point) => point.value), 1);
  const summary = points
    .map((point) => `${point.label} ${formatValue ? formatValue(point.value) : point.value}`)
    .join(', ');

  return (
    <ul role="img" aria-label={`${label}: ${summary}`} className="space-y-2">
      {points.map((point) => {
        const width = Math.max((point.value / max) * 100, 2);
        return (
          <li key={point.label} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3">
            <span className="truncate text-xs text-slate-400">{point.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-white/10">
              <span
                className="block h-full rounded-full bg-zion-500"
                style={{ width: `${width}%` }}
              />
            </span>
            <span className="text-xs tabular-nums text-slate-300">
              {formatValue ? formatValue(point.value) : point.value}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function Meter({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const safeMax = Math.max(max, 1);
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const percent = Math.round((clamped / safeMax) * 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
        <span>{label}</span>
        <span className="tabular-nums">
          {value}/{max}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={clamped}
        className="h-2 overflow-hidden rounded-full bg-white/10"
      >
        <div
          className={`h-full rounded-full ${percent >= 100 ? 'bg-emerald-400' : 'bg-amber-400'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
