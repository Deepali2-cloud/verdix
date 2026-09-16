"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  ShieldCheck,
  Lock,
  Ban,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import { MOCK_PRIVACY_STATS } from "@/lib/mock-data";

export default function PrivacyPage() {
  return (
    <AppShell
      title="Privacy Monitor"
      subtitle="Enclave privacy guardrails, differential privacy budgets, and zero-egress enforcement."
    >
      {/* Top Banner: Core USP Statement */}
      <div className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 via-white to-blue-50 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200 text-[11px] font-mono font-semibold">
            <Lock className="w-3 h-3 text-teal-700" />
            Active Non-Negotiable Invariant
          </div>
          <h2 className="text-xl font-extrabold text-[#0F172A] tracking-tight">
            Zero Raw-Data Egress Architecture
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
            Raw organizational records are mathematically and architecturally prohibited from leaving the customer&apos;s enclave. Only privacy-budgeted aggregate metrics are released.
          </p>
        </div>

        <div className="px-5 py-3 rounded-2xl bg-white border border-teal-200 text-teal-800 font-mono text-center shrink-0 shadow-sm">
          <div className="text-[10px] uppercase text-[#64748B] font-sans font-bold">Egress Invariant</div>
          <div className="text-xl font-extrabold text-emerald-600 mt-0.5">0 Records Transferred</div>
        </div>
      </div>

      {/* 4 Core Privacy Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 space-y-2 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-semibold">
            <span>Enforcement Engine</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {MOCK_PRIVACY_STATS.enforcementStatus}
          </div>
          <p className="text-[11px] text-[#64748B]">
            Enclave Agent verification: OK
          </p>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 space-y-2 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-semibold">
            <span>Protected Exports</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-[#0F172A]">
            {MOCK_PRIVACY_STATS.protectedMetricsExported}
          </div>
          <p className="text-[11px] text-[#64748B]">
            Verified statistical summaries
          </p>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 space-y-2 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-semibold">
            <span>Blocked Export Attempts</span>
            <Ban className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600">
            {MOCK_PRIVACY_STATS.blockedExportAttempts}
          </div>
          <p className="text-[11px] text-[#64748B]">
            Prevented row-level exfiltration
          </p>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 space-y-2 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-semibold">
            <span>Policy Violations</span>
            <ShieldAlert className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-extrabold text-[#0F172A]">
            {MOCK_PRIVACY_STATS.policyViolations}
          </div>
          <p className="text-[11px] text-[#64748B]">
            Zero security breach events
          </p>
        </div>
      </div>

      {/* Policy Guardrail Rules Section */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
          Configured Enclave Privacy Policies
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0F172A]">
                Differential Privacy (ε)
              </span>
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                ε = {MOCK_PRIVACY_STATS.activeEpsilonBudget}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Laplace mechanism calibrates noise proportional to query sensitivity. Prevents membership inference attacks.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0F172A]">
                k-Anonymity Threshold
              </span>
              <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                k &ge; {MOCK_PRIVACY_STATS.minKAnonymityThreshold}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Any cohort or subgroup containing fewer than 10 entities is automatically suppressed from aggregate release.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0F172A]">
                Raw Record Prohibition
              </span>
              <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                ENFORCED (0)
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Evaluation outputs are strictly checked by PrivacyGuardrail. Payloads with tabular rows trigger immediate exceptions.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Blocked Events & Guardrail Log */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <h3 className="text-sm font-bold text-[#0F172A] tracking-tight">
          Recent Privacy Guardrail Interceptions
        </h3>
        <div className="space-y-3 font-mono text-xs">
          <div className="p-4 rounded-xl bg-[#FFFBEB] border border-amber-200 flex items-start gap-3">
            <Ban className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-amber-800 font-bold">[INTERCEPTED] Row-Level Exfiltration Request</span>
                <span className="text-amber-600 text-[10px]">2026-09-16 14:10 UTC</span>
              </div>
              <p className="text-amber-900 font-sans text-xs leading-relaxed">
                Query requested raw identifiers (`ssn`, `student_id`) as sample records for customer_data. Blocked by local agent policy rule: `prohibitExportOfRawRows=True`.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#FFFBEB] border border-amber-200 flex items-start gap-3">
            <Ban className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-amber-800 font-bold">[INTERCEPTED] Sub-Threshold Cohort Suppression</span>
                <span className="text-amber-600 text-[10px]">2026-09-14 18:05 UTC</span>
              </div>
              <p className="text-amber-900 font-sans text-xs leading-relaxed">
                Bucket size in rare demographic intersection contained n=4 records (violating k=10 minimum). Cell suppressed from outbound aggregate histogram.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
