"use client";

import { useState } from "react";
import type { WeekPoint } from "@/lib/admin/stats";

/**
 * Weekly check-ins, stacked by event type. Colors validated as a categorical pair on white
 * (Blue 400 / Blue 200); Blue 200 is below 3:1 contrast, so a legend, hover tooltip and a
 * table view carry identity and values too.
 */
const SERIES = [
  { key: "inPerson", label: "In person", color: "#2550F9" },
  { key: "virtual", label: "Virtual", color: "#92B1FF" },
] as const;

const W = 720;
const H = 260;
const PAD = { top: 16, right: 8, bottom: 32, left: 36 };
const GAP = 2; // surface gap between stacked segments

function niceMax(v: number) {
  if (v <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => v / s <= 5) ?? pow * 10;
  return Math.ceil(v / step) * step;
}

function weekLabel(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

export function AttendanceTrend({ data }: { data: WeekPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = data.map((d) => d.inPerson + d.virtual);
  const max = niceMax(Math.max(1, ...totals));
  const ticks = Array.from({ length: 5 }, (_, i) => (max / 4) * i);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / data.length;
  const barW = Math.min(36, slot * 0.6);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  const h = hover !== null ? data[hover] : null;

  return (
    <figure className="chart">
      <div className="chart-head">
        <figcaption>
          <strong>Check-ins per week</strong>
          <span className="muted small"> · last {data.length} weeks</span>
        </figcaption>
        <ul className="legend" aria-label="Legend">
          {SERIES.map((s) => (
            <li key={s.key}>
              <span className="legend-swatch" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="chart-plot" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Weekly check-ins stacked by in-person and virtual events">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="chart-grid" />
              <text x={PAD.left - 8} y={y(t)} className="chart-tick" textAnchor="end" dominantBaseline="middle">
                {Math.round(t)}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            const x = cx - barW / 2;
            const ipTop = y(d.inPerson);
            const vTop = y(d.inPerson + d.virtual);
            const base = y(0);
            const showLabel = i % 2 === data.length % 2 || data.length <= 8;
            return (
              <g key={d.weekStart} opacity={hover === null || hover === i ? 1 : 0.45}>
                {d.inPerson > 0 && (
                  <path d={barPath(x, ipTop, barW, base - ipTop, d.virtual === 0)} fill={SERIES[0].color} />
                )}
                {d.virtual > 0 && (
                  <path d={barPath(x, vTop, barW, Math.max(0, ipTop - vTop - (d.inPerson > 0 ? GAP : 0)), true)} fill={SERIES[1].color} />
                )}
                {showLabel && (
                  <text x={cx} y={H - 10} className="chart-tick" textAnchor="middle">
                    {weekLabel(d.weekStart)}
                  </text>
                )}
                {/* Hit target: the whole column, bigger than the mark. */}
                <rect
                  x={PAD.left + slot * i}
                  y={PAD.top}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  tabIndex={0}
                  aria-label={`Week of ${weekLabel(d.weekStart)}: ${d.inPerson} in person, ${d.virtual} virtual`}
                />
              </g>
            );
          })}
          <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} className="chart-axis" />
        </svg>

        {h && hover !== null && (
          <div className="chart-tooltip" style={{ left: `${((PAD.left + slot * hover + slot / 2) / W) * 100}%` }}>
            <div className="chart-tooltip-title">Week of {weekLabel(h.weekStart)}</div>
            {SERIES.map((s) => (
              <div key={s.key} className="chart-tooltip-row">
                <span className="legend-swatch" style={{ background: s.color }} />
                {s.label}
                <strong>{h[s.key]}</strong>
              </div>
            ))}
            <div className="chart-tooltip-row chart-tooltip-total">
              Total <strong>{h.inPerson + h.virtual}</strong>
            </div>
          </div>
        )}
      </div>

      <details className="chart-table">
        <summary>View as table</summary>
        <table className="table">
          <thead>
            <tr>
              <th>Week of</th>
              <th style={{ textAlign: "right" }}>In person</th>
              <th style={{ textAlign: "right" }}>Virtual</th>
              <th style={{ textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.weekStart}>
                <td>{weekLabel(d.weekStart)}</td>
                <td style={{ textAlign: "right" }}>{d.inPerson}</td>
                <td style={{ textAlign: "right" }}>{d.virtual}</td>
                <td style={{ textAlign: "right" }}>{d.inPerson + d.virtual}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Bar with 4px rounded top corners (data end) and a square base on the baseline. */
function barPath(x: number, y: number, w: number, h: number, roundTop: boolean) {
  if (h <= 0) return "";
  const r = roundTop ? Math.min(4, w / 2, h) : 0;
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
