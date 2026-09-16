"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { MOCK_REPORTS } from "@/lib/mock-data";
import { ReportItem } from "@/types/dashboard";
import {
  FileBarChart2,
  ShieldCheck,
  Eye,
  Database,
  Calendar,
} from "lucide-react";

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);

  return (
    <AppShell
      title="Reports"
      subtitle="Comprehensive dataset health, statistical evaluations, and privacy compliance certificates."
    >
      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {MOCK_REPORTS.map((report) => (
          <div
            key={report.id}
            className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-5 hover:border-[#CBD5E1] transition-all shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col justify-between"
          >
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {report.status}
                    </span>
                    <span className="text-xs text-[#64748B] flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {report.generatedDate}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#0F172A] tracking-tight pt-1">
                    {report.title}
                  </h3>
                </div>

                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-600">
                  <FileBarChart2 className="w-5 h-5" />
                </div>
              </div>

              {/* Dataset Alias */}
              <div className="flex items-center gap-2 text-xs text-[#64748B]">
                <Database className="w-3.5 h-3.5 text-slate-400" />
                <span>Dataset:</span>
                <span className="text-slate-800 bg-[#F1F5F9] px-2 py-0.5 rounded border border-[#E2E8F0] font-mono text-[11px]">
                  {report.dataset}
                </span>
              </div>

              {/* Summary Text */}
              <p className="text-xs text-slate-600 leading-relaxed bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                {report.summary}
              </p>

              {/* Score Badges Breakdown */}
              <div className="grid grid-cols-3 gap-3 pt-1 text-center font-mono">
                <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div className="text-[10px] uppercase text-[#64748B] font-sans font-semibold">Health</div>
                  <div className="text-base font-extrabold text-emerald-600">{report.healthScore}%</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div className="text-[10px] uppercase text-[#64748B] font-sans font-semibold">Quality</div>
                  <div className="text-base font-extrabold text-blue-600">{report.qualityScore}%</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div className="text-[10px] uppercase text-[#64748B] font-sans font-semibold">Privacy</div>
                  <div className="text-base font-extrabold text-teal-600">{report.privacyScore}%</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-[#F1F5F9] flex items-center justify-between">
              <span className="text-[11px] text-[#64748B] font-mono">
                Audited by {report.author}
              </span>
              <button
                type="button"
                onClick={() => setSelectedReport(report)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#E2E8F0] text-xs text-slate-800 font-semibold transition-colors"
              >
                <Eye className="w-3.5 h-3.5 text-teal-600" />
                <span>View Report</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Report Modal Preview */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#F1F5F9] pb-3">
              <div>
                <div className="text-xs font-mono font-bold text-teal-600">REPORT ID: {selectedReport.id}</div>
                <h3 className="text-base font-bold text-[#0F172A] mt-1">{selectedReport.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="text-slate-400 hover:text-slate-700 text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 font-mono">
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div className="text-[#64748B] text-[11px] font-sans">Dataset Alias</div>
                  <div className="text-[#0F172A] font-bold mt-0.5">{selectedReport.dataset}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div className="text-[#64748B] text-[11px] font-sans">Date Generated</div>
                  <div className="text-[#0F172A] font-bold mt-0.5">{selectedReport.generatedDate}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div className="text-[#64748B] text-[11px] font-sans">Privacy Status</div>
                  <div className="text-emerald-600 font-bold mt-0.5">100% Zero-Egress</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <div className="font-bold text-[#0F172A]">Executive Summary</div>
                <p className="text-slate-600 leading-relaxed">{selectedReport.summary}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                <span className="leading-relaxed font-medium">
                  Cryptographic verification: All computation was executed inside local enclave without raw data transfer.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[#F1F5F9]">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 rounded-xl border border-[#CBD5E1] text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
