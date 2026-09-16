"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MOCK_AUDIT_LOGS } from "@/lib/mock-data";
import {
  Search,
  FileKey,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AuditPage() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredLogs = MOCK_AUDIT_LOGS.filter((item) => {
    const matchesFilter =
      filterStatus === "all" || item.status.toLowerCase() === filterStatus.toLowerCase();
    const matchesSearch =
      item.event.toLowerCase().includes(search.toLowerCase()) ||
      item.targetDataset.toLowerCase().includes(search.toLowerCase()) ||
      item.details.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <AppShell
      title="Audit Log"
      subtitle="Cryptographically verified immutable event log of all enclave actions and export decisions."
    >
      {/* Top Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search audit trail or dataset..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-teal-500 font-mono shadow-sm"
            />
          </div>

          <div className="flex items-center rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] p-1">
            {(["all", "SUCCESS", "BLOCKED", "INFO"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(status)}
                className={cn(
                  "px-3 py-1 text-xs rounded-lg font-mono font-semibold transition-colors",
                  filterStatus === status
                    ? "bg-[#0F172A] text-white shadow-sm"
                    : "text-[#64748B] hover:text-[#0F172A]"
                )}
              >
                {status === "all" ? "All Events" : status}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono font-semibold text-teal-700 bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-200">
          <FileKey className="w-4 h-4 text-teal-600" />
          <span>Tamper-Evident Ledger: Verified</span>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <div className="p-4 border-b border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between text-xs text-[#64748B] font-mono">
          <span>Active Enclave: enclave-org-prod-01</span>
          <span>Displaying {filteredLogs.length} audit records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[#64748B] font-semibold text-[11px] bg-[#FAFAFC]">
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Target Dataset</th>
                <th className="py-3 px-4">Cryptographic Proof</th>
                <th className="py-3 px-4">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] font-mono">
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-[#F8FAFC] transition-colors group"
                >
                  <td className="py-3.5 px-4 text-[#64748B] text-[11px] whitespace-nowrap">
                    {log.timestamp}
                  </td>

                  <td className="py-3.5 px-4 font-sans font-semibold text-[#0F172A] whitespace-nowrap">
                    {log.event}
                  </td>

                  <td className="py-3.5 px-4">
                    <StatusBadge status={log.status} />
                  </td>

                  <td className="py-3.5 px-4 text-[#0F172A] whitespace-nowrap">
                    {log.actor}
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded bg-[#F1F5F9] border border-[#E2E8F0] text-slate-700 text-[11px]">
                      {log.targetDataset}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-teal-700 text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-teal-50 border border-teal-200">
                      {log.sha256Proof}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 font-sans text-slate-600 max-w-xs truncate text-[11px]">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
