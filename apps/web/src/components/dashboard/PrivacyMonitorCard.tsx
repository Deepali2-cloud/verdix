import React from "react";
import { ShieldCheck, Database, UploadCloud, Ban, AlertOctagon } from "lucide-react";
import { MOCK_PRIVACY_STATS } from "@/lib/mock-data";

export function PrivacyMonitorCard() {
  const items = [
    {
      label: "Raw Records Transferred",
      value: MOCK_PRIVACY_STATS.rawRecordsTransferred,
      icon: Database,
    },
    {
      label: "Protected Metrics Exported",
      value: MOCK_PRIVACY_STATS.protectedMetricsExported,
      icon: UploadCloud,
    },
    {
      label: "Blocked Export Attempts",
      value: MOCK_PRIVACY_STATS.blockedExportAttempts,
      icon: Ban,
    },
    {
      label: "Policy Violations",
      value: MOCK_PRIVACY_STATS.policyViolations,
      icon: AlertOctagon,
    },
  ];

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col justify-between space-y-6">
      {/* Header with Title and ACTIVE Badge */}
      <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600 border border-teal-100">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-[#0F172A] tracking-tight">
            Privacy Monitor
          </h2>
        </div>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>ACTIVE</span>
        </span>
      </div>

      {/* List of Privacy Invariants and Counters */}
      <div className="space-y-4 flex-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex items-center justify-between text-xs py-0.5"
            >
              <div className="flex items-center gap-2.5 text-[#475569]">
                <Icon className="w-4 h-4 text-slate-400" />
                <span className="font-medium">{item.label}</span>
              </div>
              <span className="font-extrabold text-[#0F172A] font-mono text-sm">
                {item.value}
              </span>
            </div>
          );
        })}
      </div>

      {/* Soft Light Green Privacy Callout Box */}
      <div className="rounded-xl bg-emerald-50/90 border border-emerald-200 p-3.5 flex items-center gap-3 text-xs text-emerald-800 shadow-xs">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="font-medium leading-relaxed">
          Raw records never leave the organization&apos;s environment.
        </span>
      </div>
    </div>
  );
}
