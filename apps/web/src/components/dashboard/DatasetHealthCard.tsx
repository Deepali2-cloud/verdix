"use client";

import React, { useState } from "react";
import { Database, FileText, Gauge, CheckCircle2, Target } from "lucide-react";
import {
  MOCK_HEALTH_DIMENSIONS_7D,
  MOCK_HEALTH_DIMENSIONS_30D,
  MOCK_HEALTH_DIMENSIONS_90D,
} from "@/lib/mock-data";
import { HealthMetricDimension } from "@/types/dashboard";
import { cn } from "@/lib/utils";

export function DatasetHealthCard() {
  const [timeRange, setTimeRange] = useState<"7D" | "30D" | "90D">("7D");

  const dimensionsMap: Record<"7D" | "30D" | "90D", HealthMetricDimension[]> = {
    "7D": MOCK_HEALTH_DIMENSIONS_7D,
    "30D": MOCK_HEALTH_DIMENSIONS_30D,
    "90D": MOCK_HEALTH_DIMENSIONS_90D,
  };

  const dimensions = dimensionsMap[timeRange];
  const overallScore = (
    dimensions.reduce((acc, curr) => acc + curr.score, 0) / dimensions.length
  ).toFixed(1);

  // Dimension styling mapping matching the reference image in light mode
  const dimensionConfig = [
    {
      name: "Completeness",
      icon: FileText,
      iconBg: "bg-blue-50 text-blue-600 border-blue-100",
      barColor: "bg-blue-500",
    },
    {
      name: "Consistency",
      icon: Gauge,
      iconBg: "bg-purple-50 text-purple-600 border-purple-100",
      barColor: "bg-purple-500",
    },
    {
      name: "Validity",
      icon: CheckCircle2,
      iconBg: "bg-emerald-50 text-emerald-600 border-emerald-100",
      barColor: "bg-emerald-500",
    },
    {
      name: "Uniqueness",
      icon: Target,
      iconBg: "bg-orange-50 text-orange-600 border-orange-100",
      barColor: "bg-orange-500",
    },
  ];

  // SVG Circular Donut calculations
  const size = 170;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const scoreNum = parseFloat(overallScore);
  const strokeDashoffset = circumference - (scoreNum / 100) * circumference;

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] space-y-6">
      {/* Header: Title, Subtitle, Time Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F1F5F9] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <Database className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-[#0F172A] tracking-tight">
              Dataset Health
            </h2>
          </div>
          <p className="text-xs text-[#64748B] mt-1 font-normal">
            Real-time quality metrics across mounted local datasets (evaluated in-enclave)
          </p>
        </div>

        {/* Time-range pills: 7D / 30D / 90D */}
        <div className="inline-flex items-center rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] p-1 self-start sm:self-auto">
          {(["7D", "30D", "90D"] as const).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setTimeRange(range)}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-lg transition-all",
                timeRange === range
                  ? "bg-[#0F172A] text-white shadow-sm"
                  : "text-[#64748B] hover:text-[#0F172A]"
              )}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Donut Chart on Left + 4 Progress Rows on Right */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center pt-1">
        {/* Left: Donut Chart */}
        <div className="md:col-span-5 flex flex-col items-center justify-center">
          <div className="relative flex items-center justify-center">
            <svg width={size} height={size} className="transform -rotate-90">
              {/* Background Circle Track */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="#E2E8F0"
                strokeWidth={strokeWidth}
                fill="none"
              />
              {/* Progress Ring */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="#10B981"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-700 ease-out"
              />
            </svg>

            {/* Donut Center Text */}
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-extrabold text-[#0F172A] tracking-tight font-sans">
                {overallScore}%
              </span>
              <span className="text-xs text-[#64748B] font-medium mt-0.5">
                Overall Health
              </span>
            </div>
          </div>
        </div>

        {/* Right: 4 Quality Dimension Rows with Colored Circular Icons */}
        <div className="md:col-span-7 space-y-4">
          {dimensions.map((dim, idx) => {
            const cfg = dimensionConfig[idx] || dimensionConfig[0];
            const Icon = cfg.icon;

            return (
              <div key={dim.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-6 h-6 rounded-full border flex items-center justify-center shadow-xs", cfg.iconBg)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-semibold text-[#0F172A]">{dim.name}</span>
                  </div>
                  <span className="font-bold text-[#0F172A] font-mono">
                    {dim.score.toFixed(1)}%
                  </span>
                </div>

                {/* Progress bar track */}
                <div className="h-1.5 w-full rounded-full bg-[#F1F5F9] overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", cfg.barColor)}
                    style={{ width: `${Math.min(dim.score, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
