"use client";

export function LineChart({
  series,
  height = 180,
  suffix = "",
}: {
  series: { label: string; values: { name: string; color: string; value: number }[] }[];
  height?: number;
  suffix?: string;
}) {
  const all = series.flatMap((s) => s.values.map((v) => v.value)).filter((n) => n > 0);
  const max = Math.max(100, ...all);
  const width = 640;
  const pad = 28;
  const stepX = series.length > 1 ? (width - pad * 2) / (series.length - 1) : 0;
  const y = (v: number) => height - pad - (v / max) * (height - pad * 2);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full min-w-[520px]">
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={pad} x2={width - pad} y1={y((t / 100) * max)} y2={y((t / 100) * max)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={4} y={y((t / 100) * max) + 4} fontSize="9" fill="#8896a8">
              {Math.round((t / 100) * max)}
              {suffix}
            </text>
          </g>
        ))}
        {series[0]?.values.map((v, vi) => {
          const points = series
            .map((s, si) => `${pad + si * stepX},${y(s.values[vi]?.value ?? 0)}`)
            .join(" ");
          const lastY = y(series[series.length - 1].values[vi]?.value ?? 0);
          return (
            <g key={v.name}>
              <polyline points={points} fill="none" stroke={v.color} strokeWidth="2.5" strokeLinejoin="round" />
              {series.map((s, si) => (
                <circle
                  key={si}
                  cx={pad + si * stepX}
                  cy={y(s.values[vi]?.value ?? 0)}
                  r="3"
                  fill="#fff"
                  stroke={v.color}
                  strokeWidth="2"
                />
              ))}
              <text x={width - pad} y={lastY - 8} fontSize="9" fill={v.color} textAnchor="end">
                {v.name} {v.value}
                {suffix}
              </text>
            </g>
          );
        })}
        {series.map((s, si) => (
          <text key={s.label} x={pad + si * stepX} y={height - 8} fontSize="9" fill="#8896a8" textAnchor="middle">
            {s.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function BarChart({
  data,
  height = 170,
  color = "#0d9488",
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = 100 / Math.max(1, data.length);
  return (
    <div className="w-full">
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((d) => (
          <div key={d.label} className="group flex flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] font-mono text-muted opacity-0 transition group-hover:opacity-100">
              {d.value}
            </span>
            <div
              className="w-full rounded-t-md transition-all"
              style={{ height: `${(d.value / max) * 100}%`, background: color, minHeight: d.value ? 4 : 2 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1">
        {data.map((d) => (
          <span key={d.label} className="flex-1 truncate text-center text-[9px] text-muted">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function GroupedBars({
  data,
  beforeLabel,
  afterLabel,
}: {
  data: { skill: string; before: number; after: number }[];
  beforeLabel: string;
  afterLabel: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <span className="h-2 w-3 rounded-sm bg-slate-300" /> {beforeLabel}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-3 rounded-sm bg-accent-2" /> {afterLabel}
        </span>
      </div>
      {data.map((d) => (
        <div key={d.skill}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="capitalize text-muted">{d.skill}</span>
            <span className="font-mono">
              {d.before} → {d.after}
              {d.after - d.before !== 0 && (
                <span className={d.after >= d.before ? "text-ok" : "text-danger"}>
                  {" "}
                  ({d.after >= d.before ? "+" : ""}
                  {d.after - d.before})
                </span>
              )}
            </span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-slate-300" style={{ width: `${d.before}%` }} />
            <div className="h-full bg-accent-2/80" style={{ width: `${Math.max(0, d.after - d.before)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Donut({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: { name: string; value: number; color: string }[];
  centerLabel: string;
  centerValue: string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  let offset = 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0 -rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#e6edf5" strokeWidth="16" />
        {segments.map((s) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={s.name}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="16"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="relative">
        <p className="text-center font-mono text-2xl">{centerValue}</p>
        <p className="text-center text-[11px] uppercase text-muted">{centerLabel}</p>
      </div>
      <ul className="flex-1 space-y-1 text-xs">
        {segments.map((s) => (
          <li key={s.name} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 truncate">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="truncate">{s.name}</span>
            </span>
            <span className="font-mono text-muted">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
