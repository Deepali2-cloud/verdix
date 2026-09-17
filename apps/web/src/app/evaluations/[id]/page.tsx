"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getEvaluation, ApiEvaluation } from "@/lib/api";
import {
  ArrowLeft,
  FileSpreadsheet,
  Database,
  Calendar,
  User,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  AlertTriangle,
  Info,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CHECK_DESCRIPTIONS: Record<string, { name: string; description: string }> = {
  completeness: {
    name: "Completeness",
    description: "Check missing values and field coverage.",
  },
  validity: {
    name: "Validity",
    description: "Check invalid or malformed values.",
  },
  duplicates: {
    name: "Duplicates",
    description: "Detect duplicate records.",
  },
  consistency: {
    name: "Consistency",
    description: "Check cross-field and formatting consistency.",
  },
  outliers: {
    name: "Outliers",
    description: "Identify statistically unusual values.",
  },
  anomalies: {
    name: "Anomalies",
    description: "Detect unusual patterns.",
  },
  bias_fairness: {
    name: "Bias / Fairness",
    description: "Perform aggregate disparity analysis where applicable.",
  },
};

export default function EvaluationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [evaluation, setEvaluation] = useState<ApiEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getEvaluation(id);
        if (!data) {
          setError("Evaluation not found or you do not have access to it.");
        } else {
          setEvaluation(data);
        }
      } catch (err: unknown) {
        const e = err as Error;
        setError(e.message || "Failed to load evaluation details.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  return (
    <AppShell
      title="Evaluation Detail"
      subtitle="Inspect evaluation specification and enclave worker execution status."
    >
      {/* Back Button & Navigation */}
      <div>
        <Link
          href="/evaluations"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Evaluations</span>
        </Link>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center text-xs text-slate-500 shadow-sm">
          <div className="inline-block w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p>Loading evaluation details...</p>
        </div>
      ) : error || !evaluation ? (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">
              {error || "Evaluation Not Found"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              This evaluation may not exist or does not belong to your organization.
            </p>
          </div>
          <Link
            href="/evaluations"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition-colors"
          >
            Return to Evaluations
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 shrink-0 mt-0.5">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold text-slate-900">
                      {evaluation.name}
                    </h2>
                    <StatusBadge status={evaluation.status} />
                  </div>
                  <p className="text-xs text-slate-600">
                    {evaluation.description || "No description provided."}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    ID: {evaluation.id}
                  </p>
                </div>
              </div>
            </div>

            {/* Metadata Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#F1F5F9] text-xs">
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 block">Dataset</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                  <Database className="w-3.5 h-3.5 text-slate-500" />
                  <span>{evaluation.dataset?.name || evaluation.datasetId}</span>
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 block">Created By</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>{evaluation.createdBy || "Demo Analyst"}</span>
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 block">Created At</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    {new Date(evaluation.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 block">Evaluation Type</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  <span>{evaluation.evaluationType}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Section: Evaluation Progress */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Evaluation Progress
                </h3>
              </div>
              <StatusBadge status={evaluation.status} />
            </div>

            {/* Progress Notification Banner */}
            <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-xs text-amber-800">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Evaluation is ready for local Agent execution.</span>
              </div>
              <p className="text-[11px] text-amber-700 leading-relaxed pl-6">
                The evaluation specification has been verified and registered in the cloud catalog. Execution takes place locally within your organization’s enclave via the Verdix Agent CLI. Raw organization data is never uploaded to the cloud.
              </p>
            </div>

            {/* Stepper Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>1. Registered</span>
                </div>
                <p className="text-[10px] text-slate-600">
                  Evaluation specification validated and queued.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-amber-300 bg-amber-50/50 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-700 font-semibold text-xs">
                  <Clock className="w-4 h-4 animate-pulse" />
                  <span>2. Ready for Agent</span>
                </div>
                <p className="text-[10px] text-slate-600">
                  Waiting for local Agent worker dispatch.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1 text-slate-400">
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <Cpu className="w-4 h-4" />
                  <span>3. Local Enclave Run</span>
                </div>
                <p className="text-[10px] text-slate-500">
                  In-enclave privacy and quality calculation.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1 text-slate-400">
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <ShieldCheck className="w-4 h-4" />
                  <span>4. Aggregate Ingestion</span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Approved aggregate metrics return to dashboard.
                </p>
              </div>
            </div>
          </div>

          {/* Section: Selected Evaluation Checks */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Configured Evaluation Checks
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {evaluation.checks?.length || 0} checks requested
              </span>
            </div>

            {evaluation.checks && evaluation.checks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {evaluation.checks.map((chkId) => {
                  const checkMeta = CHECK_DESCRIPTIONS[chkId] || {
                    name: chkId,
                    description: "Enclave verification check.",
                  };
                  return (
                    <div
                      key={chkId}
                      className="p-3.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                        <span className="font-semibold text-xs text-slate-900">
                          {checkMeta.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 pl-6 leading-relaxed">
                        {checkMeta.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Standard comprehensive suite configured.
              </p>
            )}
          </div>

          {/* Privacy Invariant Assurance Card */}
          <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-5 shadow-xs flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-teal-900">
              <h4 className="font-bold text-teal-800">
                Architectural Invariant Active: Zero Raw Data Retention
              </h4>
              <p className="text-[11px] text-teal-700 leading-relaxed">
                Verdix ensures that neither credentials, row-level CSVs, nor confidential database rows are uploaded during evaluation creation. Computations execute inside your trusted enclave environment.
              </p>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
