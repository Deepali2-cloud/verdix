import React from "react";
import { ShieldCheck, CheckCircle2, XCircle, ShieldAlert, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
  showIcon?: boolean;
}

export function StatusBadge({ status, className, showIcon = true }: StatusBadgeProps) {
  const normalized = status.toLowerCase();

  if (normalized === "pending") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80",
          className
        )}
      >
        {showIcon && <Clock className="w-3 h-3 text-amber-600" />}
        <span>{status}</span>
      </span>
    );
  }

  if (normalized === "ready") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200/80",
          className
        )}
      >
        {showIcon && <CheckCircle2 className="w-3 h-3 text-teal-600" />}
        <span>{status}</span>
      </span>
    );
  }

  if (normalized === "completed" || normalized === "success" || normalized === "verified") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80",
          className
        )}
      >
        {showIcon && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
        <span>{status}</span>
      </span>
    );
  }

  if (normalized === "processing" || normalized === "running" || normalized === "queued") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/80",
          className
        )}
      >
        {showIcon && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />}
        <span>{status}</span>
      </span>
    );
  }

  if (normalized === "protected" || normalized === "enforced") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80",
          className
        )}
      >
        {showIcon && <ShieldCheck className="w-3 h-3 text-emerald-600" />}
        <span>{status}</span>
      </span>
    );
  }

  if (normalized === "active") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/80",
          className
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        <span>{status}</span>
      </span>
    );
  }

  if (normalized === "blocked" || normalized === "restricted") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/80",
          className
        )}
      >
        {showIcon && <ShieldAlert className="w-3 h-3 text-amber-600" />}
        <span>{status}</span>
      </span>
    );
  }

  if (normalized === "failed" || normalized === "error") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200/80",
          className
        )}
      >
        {showIcon && <XCircle className="w-3 h-3 text-rose-600" />}
        <span>{status}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200",
        className
      )}
    >
      {status}
    </span>
  );
}
