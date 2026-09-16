"use client";

import React, { useState } from "react";
import { BarChart3 } from "lucide-react";

interface ActivityPoint {
  date: string;
  evaluations: number;
  metricsExported: number;
}

const ACTIVITY_DATA: ActivityPoint[] = [
  { date: "Apr 21", evaluations: 12, metricsExported: 6 },
  { date: "Apr 24", evaluations: 18, metricsExported: 10 },
  { date: "Apr 27", evaluations: 15, metricsExported: 11 },
  { date: "Apr 30", evaluations: 22, metricsExported: 18 },
  { date: "May 3", evaluations: 25, metricsExported: 16 },
  { date: "May 6", evaluations: 34, metricsExported: 20 },
];

export function EvaluationActivityCard() {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // SVG Chart Dimensions
  const width = 500;
  const height = 180;
  const paddingX = 35;
  const paddingY = 25;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;
  const maxY = 40;

  // Scale functions
  const getX = (index: number) => paddingX + (index / (ACTIVITY_DATA.length - 1)) * chartWidth;
  const getY = (val: number) => height - paddingY - (val / maxY) * chartHeight;

  // Build SVG path
  const evaluationsPoints = ACTIVITY_DATA.map((d, i) => `${getX(i)},${getY(d.evaluations)}`);
  const metricsPoints = ACTIVITY_DATA.map((d, i) => `${getX(i)},${getY(d.metricsExported)}`);

  // Path strings
  const evalPath = `M ${evaluationsPoints.join(" L ")}`;
  const evalArea = `M ${getX(0)},${height - paddingY} L ${evaluationsPoints.join(" L ")} L ${getX(
    ACTIVITY_DATA.length - 1
  )},${height - paddingY} Z`;

  const metricsPath = `M ${metricsPoints.join(" L ")}`;

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F1F5F9] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-[#0F172A] tracking-tight">
              Evaluation Activity
            </h2>
          </div>
          <p className="text-xs text-[#64748B] mt-1 font-normal">
            Local enclave evaluations executed and protected metrics generated over time.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
            <span className="text-[#64748B]">Evaluations</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-[#64748B]">Metrics Exported</span>
          </div>
        </div>
      </div>

      {/* Responsive SVG Chart */}
      <div className="relative w-full overflow-hidden">
        {/* Hover Tooltip */}
        {hoverIndex !== null && (
          <div
            className="absolute z-20 pointer-events-none px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs shadow-xl transition-all font-mono"
            style={{
              left: `${(hoverIndex / (ACTIVITY_DATA.length - 1)) * 75 + 10}%`,
              top: "10px",
            }}
          >
            <div className="text-[#0F172A] font-bold">{ACTIVITY_DATA[hoverIndex].date}</div>
            <div className="text-blue-600 font-semibold">
              Evaluations: {ACTIVITY_DATA[hoverIndex].evaluations}
            </div>
            <div className="text-emerald-600 font-semibold">
              Metrics Exported: {ACTIVITY_DATA[hoverIndex].metricsExported}
            </div>
          </div>
        )}

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible">
          <defs>
            <linearGradient id="eval-gradient-light" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines & Y-axis labels */}
          {[40, 30, 20, 10, 0].map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#F1F5F9"
                  strokeDasharray={tick === 0 ? "0" : "3 3"}
                  strokeWidth="1.5"
                />
                <text
                  x={paddingX - 10}
                  y={y + 3}
                  textAnchor="end"
                  fill="#94A3B8"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Evaluations Area Fill */}
          <path d={evalArea} fill="url(#eval-gradient-light)" />

          {/* Evaluations Line (Blue) */}
          <path
            d={evalPath}
            fill="none"
            stroke="#2563EB"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Metrics Exported Line (Emerald) */}
          <path
            d={metricsPath}
            fill="none"
            stroke="#10B981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive Dots for Evaluations & Metrics */}
          {ACTIVITY_DATA.map((d, idx) => {
            const cx = getX(idx);
            const cyEval = getY(d.evaluations);
            const cyMetric = getY(d.metricsExported);
            const isHovered = hoverIndex === idx;

            return (
              <g
                key={idx}
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(idx)}
                onMouseLeave={() => setHoverIndex(null)}
              >
                {/* Invisible hover target */}
                <rect
                  x={cx - 15}
                  y={0}
                  width={30}
                  height={height}
                  fill="transparent"
                />

                {/* Evaluations Dot */}
                <circle
                  cx={cx}
                  cy={cyEval}
                  r={isHovered ? 5.5 : 4}
                  fill="#2563EB"
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                  className="transition-all shadow-sm"
                />

                {/* Metrics Dot */}
                <circle
                  cx={cx}
                  cy={cyMetric}
                  r={isHovered ? 5.5 : 4}
                  fill="#10B981"
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                  className="transition-all shadow-sm"
                />

                {/* X-axis date labels */}
                <text
                  x={cx}
                  y={height - paddingY + 18}
                  textAnchor="middle"
                  fill={isHovered ? "#0F172A" : "#64748B"}
                  fontSize="10"
                  fontWeight={isHovered ? "bold" : "normal"}
                  fontFamily="monospace"
                  className="transition-colors"
                >
                  {d.date}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
