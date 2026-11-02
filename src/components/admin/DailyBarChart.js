import { useState } from "react";

const WIDTH = 480;
const HEIGHT = 170;
const PAD = { top: 12, right: 8, bottom: 26, left: 44 };

// One-series daily bar chart with a hover tooltip. `days` is [{ key, label, value }].
export default function DailyBarChart({ title, days, color, formatValue }) {
  const [hovered, setHovered] = useState(null);
  const max = Math.max(1, ...days.map((day) => day.value));
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotW / days.length;
  const barW = Math.max(4, slot - 6);
  const y = (value) => PAD.top + plotH - (value / max) * plotH;
  const ticks = [0, max / 2, max];
  const labelEvery = Math.ceil(days.length / 5);
  const active = hovered === null ? null : days[hovered];

  return (
    <figure className="adm-chart">
      <figcaption className="adm-chart__title">{title}</figcaption>
      <div className="adm-chart__plot">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${title}, last ${days.length} days`}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                className="adm-chart__grid"
              />
              <text x={PAD.left - 6} y={y(tick) + 4} className="adm-chart__tick" textAnchor="end">
                {formatValue(tick, true)}
              </text>
            </g>
          ))}
          {days.map((day, index) => {
            const x = PAD.left + index * slot + (slot - barW) / 2;
            const top = y(day.value);
            const h = PAD.top + plotH - top;
            return (
              <g key={day.key}>
                {day.value > 0 ? (
                  // Rounded top, square base on the axis.
                  <path
                    d={`M${x},${PAD.top + plotH} V${top + Math.min(4, h)} Q${x},${top} ${x + Math.min(4, barW / 2)},${top} H${x + barW - Math.min(4, barW / 2)} Q${x + barW},${top} ${x + barW},${top + Math.min(4, h)} V${PAD.top + plotH} Z`}
                    fill={color}
                    opacity={hovered === null || hovered === index ? 1 : 0.45}
                  />
                ) : null}
                {index === days.length - 1 ||
                (index % labelEvery === 0 && days.length - 1 - index >= labelEvery / 2) ? (
                  <text x={x + barW / 2} y={HEIGHT - 8} className="adm-chart__tick" textAnchor="middle">
                    {day.label}
                  </text>
                ) : null}
                {/* Hit area larger than the bar */}
                <rect
                  x={PAD.left + index * slot}
                  y={PAD.top}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHovered(index)}
                  onMouseLeave={() => setHovered(null)}
                />
              </g>
            );
          })}
        </svg>
        {active ? (
          <div
            className="adm-chart__tooltip"
            style={{ left: `${((PAD.left + hovered * slot + slot / 2) / WIDTH) * 100}%` }}
          >
            <strong>{formatValue(active.value)}</strong>
            <span>{active.longLabel}</span>
          </div>
        ) : null}
      </div>
    </figure>
  );
}
