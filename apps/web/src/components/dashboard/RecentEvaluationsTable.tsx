import React from "react";
import Link from "next/link";
import { ListFilter, ArrowRight, FileText, MoreVertical } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface TableRow {
  name: string;
  dataset: string;
  status: "Completed" | "Processing";
  healthScore: string;
  privacy: "Protected";
  date: string;
}

const EVALUATION_ROWS: TableRow[] = [
  {
    name: "Student Records",
    dataset: "student_data_v2",
    status: "Completed",
    healthScore: "94.2%",
    privacy: "Protected",
    date: "May 6, 2025 10:24 AM",
  },
  {
    name: "Employee Dataset",
    dataset: "employee_records",
    status: "Processing",
    healthScore: "—",
    privacy: "Protected",
    date: "May 6, 2025 09:12 AM",
  },
  {
    name: "Survey Dataset",
    dataset: "student_survey",
    status: "Completed",
    healthScore: "88.7%",
    privacy: "Protected",
    date: "May 5, 2025 04:32 PM",
  },
  {
    name: "Customer Dataset",
    dataset: "customer_data",
    status: "Completed",
    healthScore: "91.4%",
    privacy: "Protected",
    date: "May 5, 2025 11:17 AM",
  },
];

export function RecentEvaluationsTable() {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] space-y-4">
      {/* Table Header */}
      <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
            <ListFilter className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-[#0F172A] tracking-tight">
            Recent Evaluations
          </h2>
        </div>

        <Link
          href="/evaluations"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
        >
          <span>View all</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#E2E8F0] text-[#64748B] font-semibold text-[11px]">
              <th className="py-3 px-4">Evaluation</th>
              <th className="py-3 px-4">Dataset</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Health Score</th>
              <th className="py-3 px-4">Privacy</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-2 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {EVALUATION_ROWS.map((row) => (
              <tr
                key={row.name}
                className="hover:bg-[#F8FAFC] transition-colors group"
              >
                {/* Evaluation Name with Blue File Icon */}
                <td className="py-3.5 px-4 font-semibold text-[#0F172A]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <span>{row.name}</span>
                  </div>
                </td>

                {/* Dataset Alias */}
                <td className="py-3.5 px-4">
                  <span className="px-2 py-0.5 rounded bg-[#F1F5F9] border border-[#E2E8F0] text-slate-700 font-mono text-[11px]">
                    {row.dataset}
                  </span>
                </td>

                {/* Status Badge */}
                <td className="py-3.5 px-4">
                  <StatusBadge status={row.status} />
                </td>

                {/* Health Score */}
                <td className="py-3.5 px-4 font-bold text-[#0F172A] font-mono">
                  {row.healthScore}
                </td>

                {/* Privacy Badge */}
                <td className="py-3.5 px-4">
                  <StatusBadge status={row.privacy} />
                </td>

                {/* Date */}
                <td className="py-3.5 px-4 text-[#64748B] text-[11px]">
                  {row.date}
                </td>

                {/* Actions (···) */}
                <td className="py-3.5 px-2 text-right">
                  <button
                    type="button"
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
