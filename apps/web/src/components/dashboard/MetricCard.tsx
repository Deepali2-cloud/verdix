import React from "react";
import { LucideIcon, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  label?: string;
  supportingText?: React.ReactNode;
  trend?: string;
  isPositive?: boolean;
  icon: LucideIcon;
  iconBgColor?: string;
  iconColor?: string;
  sparklineColor?: "green" | "blue" | "orange" | "purple";
  isStatusValue?: boolean;
}

export function MetricCard({
  title,
  value,
  label,
  supportingText,
  trend,
  isPositive = true,
  icon: Icon,
  iconBgColor = "bg-teal-50",
  iconColor = "text-teal-600",
  sparklineColor,
  isStatusValue = false,
}: MetricCardProps) {
  // SVG Sparkline paths
  const sparklines = {
    green: {
      stroke: "#10B981",
      fill: "url(#green-gradient)",
      d: "M 0 35 Q 25 38, 45 28 T 85 18 T 120 8",
      area: "M 0 35 Q 25 38, 45 28 T 85 18 T 120 8 L 120 45 L 0 45 Z",
      gradientId: "green-gradient",
      gradientColor: "#10B981",
    },
    blue: {
      stroke: "#3B82F6",
      fill: "url(#blue-gradient)",
      d: "M 0 30 Q 30 35, 55 24 T 90 15 T 120 10",
      area: "M 0 30 Q 30 35, 55 24 T 90 15 T 120 10 L 120 45 L 0 45 Z",
      gradientId: "blue-gradient",
      gradientColor: "#3B82F6",
    },
    orange: {
      stroke: "#F97316",
      fill: "url(#orange-gradient)",
      d: "M 0 38 Q 30 36, 60 28 T 95 24 T 120 12",
      area: "M 0 38 Q 30 36, 60 28 T 95 24 T 120 12 L 120 45 L 0 45 Z",
      gradientId: "orange-gradient",
      gradientColor: "#F97316",
    },
    purple: {
      stroke: "#8B5CF6",
      fill: "url(#purple-gradient)",
      d: "M 0 32 Q 25 25, 50 30 T 90 16 T 120 10",
      area: "M 0 32 Q 25 25, 50 30 T 90 16 T 120 10 L 120 45 L 0 45 Z",
      gradientId: "purple-gradient",
      gradientColor: "#8B5CF6",
    },
  };

  const sparkline = sparklineColor ? sparklines[sparklineColor] : null;

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] hover:border-[#CBD5E1] transition-all flex flex-col justify-between relative overflow-hidden">
      {/* Top row: Icon and Title */}
      <div className="flex items-center gap-2.5">
        <div className={cn("p-2 rounded-xl border border-transparent shadow-xs", iconBgColor)}>
          <Icon className={cn("w-4 h-4", iconColor)} />
        </div>
        <span className="text-xs font-semibold text-[#64748B]">
          {title}
        </span>
      </div>

      {/* Middle row: Main Value & Sparkline */}
      <div className="mt-4 flex items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-2xl sm:text-3xl font-extrabold tracking-tight font-sans",
                isStatusValue ? "text-emerald-600" : "text-[#0F172A]"
              )}
            >
              {value}
            </span>

            {trend && (
              <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ArrowUpRight className="w-3 h-3 mr-0.5 text-emerald-600" />
                {trend}
              </span>
            )}
          </div>
        </div>

        {/* Sparkline chart on the right */}
        {sparkline && (
          <div className="w-24 h-11 shrink-0 pb-1">
            <svg viewBox="0 0 120 45" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id={sparkline.gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkline.gradientColor} stopOpacity="0.15" />
                  <stop offset="100%" stopColor={sparkline.gradientColor} stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d={sparkline.area} fill={sparkline.fill} />
              <path
                d={sparkline.d}
                fill="none"
                stroke={sparkline.stroke}
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Bottom row: Subtext */}
      <div className="mt-3 text-xs text-[#64748B] font-medium">
        {label && <span>{label}</span>}
        {supportingText && <div>{supportingText}</div>}
      </div>
    </div>
  );
}
