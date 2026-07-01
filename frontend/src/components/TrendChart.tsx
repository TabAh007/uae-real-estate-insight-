import type { PriceTrendPoint } from "@/lib/api";

// Lightweight inline-SVG line chart — no charting dependency.
const W = 320;
const H = 150;
const PAD = { top: 12, right: 10, bottom: 22, left: 44 };

export default function TrendChart({ points }: { points: PriceTrendPoint[] }) {
  if (points.length === 0) {
    return <p className="text-xs text-gray-400">No data points.</p>;
  }

  const values = points.map((p) => p.median_price_per_sqm);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (i: number) =>
    PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => PAD.top + (1 - (v - min) / span) * plotH;

  const line = points.map((p, i) => `${x(i)},${y(p.median_price_per_sqm)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Median price per sqm over time">
      {/* y-axis min/max gridlines + labels */}
      {[max, min].map((v, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)} stroke="#e5e7eb" strokeWidth={1} />
          <text x={PAD.left - 4} y={y(v) + 3} textAnchor="end" className="fill-gray-400" style={{ fontSize: 9 }}>
            {Math.round(v).toLocaleString()}
          </text>
        </g>
      ))}

      {points.length > 1 && <polyline points={line} fill="none" stroke="#4f46e5" strokeWidth={2} />}

      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.median_price_per_sqm)} r={3} fill="#4f46e5">
          <title>
            {p.period}: AED {Math.round(p.median_price_per_sqm).toLocaleString()}/sqm ({p.count} sales)
          </title>
        </circle>
      ))}

      {/* first & last x labels */}
      {[0, points.length - 1].map((i) =>
        i === 0 || points.length > 1 ? (
          <text
            key={`x${i}`}
            x={x(i)}
            y={H - 6}
            textAnchor={i === 0 ? "start" : "end"}
            className="fill-gray-400"
            style={{ fontSize: 9 }}
          >
            {points[i].period}
          </text>
        ) : null,
      )}
    </svg>
  );
}
