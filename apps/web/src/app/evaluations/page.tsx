"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MOCK_RECENT_EVALUATIONS } from "@/lib/mock-data";
import {
  Plus,
  Search,
  FileSpreadsheet,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function EvaluationsPage() {
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);

  const filteredEvaluations = MOCK_RECENT_EVALUATIONS.filter((item) => {
    const matchesFilter =
      filter === "all" || item.status.toLowerCase() === filter.toLowerCase();
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.datasetAlias.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <AppShell
      title="Evaluations"
      subtitle="Dispatch and monitor in-enclave dataset evaluations and quality assessments."
    >
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Search & Status Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter evaluations or datasets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-teal-500 shadow-sm"
            />
          </div>

          <div className="flex items-center rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] p-1">
            {(["all", "Completed", "Processing"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilter(status)}
                className={cn(
                  "px-3 py-1 text-xs rounded-lg font-semibold transition-colors",
                  filter === status
                    ? "bg-[#0F172A] text-white shadow-sm"
                    : "text-[#64748B] hover:text-[#0F172A]"
                )}
              >
                {status === "all" ? "All Statuses" : status}
              </button>
            ))}
          </div>
        </div>

        {/* New Evaluation Button */}
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Evaluation</span>
        </button>
      </div>

      {/* Evaluations List Card */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <div className="p-4 border-b border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between text-xs text-[#64748B] font-mono">
          <span>Active In-Enclave Worker: Verdix Agent US-East (Online)</span>
          <span>Showing {filteredEvaluations.length} evaluations</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[#64748B] text-[11px] font-semibold bg-[#FAFAFC]">
                <th className="py-3 px-4">Evaluation Name</th>
                <th className="py-3 px-4">Mounted Dataset</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Health Score</th>
                <th className="py-3 px-4">Records Evaluated</th>
                <th className="py-3 px-4">Privacy Level</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filteredEvaluations.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-[#F8FAFC] transition-colors group"
                >
                  <td className="py-3.5 px-4 font-semibold text-[#0F172A]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div>{item.name}</div>
                        <div className="text-[10px] text-[#64748B] font-mono font-normal">ID: {item.id}</div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded bg-[#F1F5F9] border border-[#E2E8F0] text-slate-700 font-mono text-[11px]">
                      {item.datasetAlias}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <StatusBadge status={item.status} />
                  </td>

                  <td className="py-3.5 px-4 font-bold text-[#0F172A] font-mono">
                    {item.healthScore !== null ? (
                      `${item.healthScore.toFixed(1)}%`
                    ) : (
                      <span className="text-slate-400 font-normal">—</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-[#0F172A] font-mono">
                    {item.recordsEvaluated.toLocaleString()}
                  </td>

                  <td className="py-3.5 px-4">
                    <StatusBadge status={item.privacyStatus} />
                  </td>

                  <td className="py-3.5 px-4 text-[#64748B]">
                    {item.duration}
                  </td>

                  <td className="py-3.5 px-4 text-[#64748B] text-[11px]">
                    {item.date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Evaluation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-[#0F172A] text-sm">Create In-Enclave Evaluation</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-700 font-semibold">Evaluation Name</label>
                <input
                  type="text"
                  defaultValue="Vendor Risk Assessment Q3"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#CBD5E1] text-[#0F172A]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-700 font-semibold">Target Dataset Alias (Mounted Locally)</label>
                <select className="w-full px-3 py-2 rounded-xl bg-white border border-[#CBD5E1] text-[#0F172A]">
                  <option>student_data_v2 (142k rows)</option>
                  <option>employee_records (48.5k rows)</option>
                  <option>customer_data (320k rows)</option>
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  <span>Privacy Guardrail Invariant Attached</span>
                </div>
                <p className="text-[11px] text-teal-700 leading-relaxed">
                  The local Verdix agent will compute summary statistics, distributions, and health scores. No row-level records or raw columns will be exported to the cloud.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F1F5F9]">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3.5 py-2 rounded-xl border border-[#CBD5E1] text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-sm"
              >
                Dispatch to Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
