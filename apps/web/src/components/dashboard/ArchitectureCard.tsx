import React from "react";
import {
  GitFork,
  Database,
  Cpu,
  ShieldCheck,
  FileBarChart,
  Cloud,
  ArrowRight,
} from "lucide-react";

export function ArchitectureCard() {
  const localSteps = [
    {
      title: "Sensitive Dataset",
      icon: Database,
      iconColor: "text-blue-600 bg-blue-50 border-blue-100",
    },
    {
      title: "Verdix Agent",
      icon: Cpu,
      iconColor: "text-teal-600 bg-teal-50 border-teal-100",
    },
    {
      title: "Policy + Engine",
      icon: ShieldCheck,
      iconColor: "text-emerald-600 bg-emerald-50 border-emerald-100",
    },
    {
      title: "Protected Metrics",
      icon: FileBarChart,
      iconColor: "text-blue-600 bg-blue-50 border-blue-100",
    },
  ];

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col justify-between space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
            <GitFork className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-[#0F172A] tracking-tight">
            System Architecture
          </h2>
        </div>
      </div>

      {/* Trust Boundary & Pipeline */}
      <div className="space-y-4">
        {/* Boundary Column Headers */}
        <div className="flex items-center justify-between text-[11px] font-mono tracking-wider uppercase text-[#64748B]">
          <div className="flex items-center gap-1.5 text-blue-700 font-bold">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span>LOCAL ENVIRONMENT</span>
          </div>

          <div className="flex items-center gap-1.5 text-sky-700 font-bold">
            <span className="w-2 h-2 rounded-full border-2 border-sky-600" />
            <span>VERDIX CLOUD</span>
          </div>
        </div>

        {/* Pipeline Diagram */}
        <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2 text-center">
          {localSteps.map((step) => {
            const Icon = step.icon;
            return (
              <React.Fragment key={step.title}>
                <div className="flex flex-col items-center gap-1.5 min-w-[65px]">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shadow-xs ${step.iconColor}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-semibold text-[#0F172A] leading-tight">
                    {step.title}
                  </span>
                </div>

                {/* Arrow between local steps */}
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </React.Fragment>
            );
          })}

          {/* Verdix Cloud Final Destination */}
          <div className="flex flex-col items-center gap-1.5 min-w-[65px]">
            <div className="w-9 h-9 rounded-xl border border-sky-200 bg-sky-50 flex items-center justify-center text-sky-600 shadow-xs">
              <Cloud className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-semibold text-[#0F172A] leading-tight">
              VERDIX Cloud
            </span>
          </div>
        </div>
      </div>

      {/* Quote Callout Box */}
      <div className="rounded-xl bg-blue-50/80 border border-blue-100 p-3.5 text-center text-xs text-blue-700 font-medium">
        &ldquo;Bring the computation to the data &mdash; not the data to the computation.&rdquo;
      </div>
    </div>
  );
}
