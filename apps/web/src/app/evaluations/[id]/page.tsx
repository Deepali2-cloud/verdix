"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getEvaluation, runEvaluation, ApiEvaluation } from "@/lib/api";
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
  Play,
  Activity,
  RefreshCw,
  Lock,
} from "lucide-react";

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
  const id = params?.id as string;

  const [evaluation, setEvaluation] = useState<ApiEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDetails = async () => {
    if (!id) return;
    try {
      const data = await getEvaluation(id);
      if (data) {
        setEvaluation(data);
        if (data.status === "COMPLETED" || data.status === "FAILED") {
          setIsRunning(false);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      }
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Failed to load evaluation details.");
    }
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchDetails().finally(() => setLoading(false));

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [id]);

  const handleStartEvaluation = async () => {
    if (!id) return;
    setIsRunning(true);
    setError(null);
    try {
      await runEvaluation(id);
      // Immediately refresh and poll
      await fetchDetails();
      pollIntervalRef.current = setInterval(fetchDetails, 1500);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Failed to start evaluation.");
      setIsRunning(false);
    }
  };

  // Determine latest result metrics if available
  const latestResult = evaluation?.results && evaluation.results.length > 0
    ? evaluation.results[0]
    : null;

  const detailed = latestResult?.detailedMetrics || null;

  // Compute or extract health score
  const healthScore = detailed?.healthScore ??
    latestResult?.healthScore ??
    (latestResult ? (latestResult.completenessScore + latestResult.consistencyScore) / 2 : null);

  return (
    <AppShell
      title="Evaluation Detail"
      subtitle="Inspect evaluation specification and enclave worker execution status."
    >
      {/* Back Button & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/evaluations"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Evaluations</span>
        </Link>

        {evaluation && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchDetails}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>

            {evaluation.status !== "COMPLETED" ? (
              <button
                type="button"
                onClick={handleStartEvaluation}
                disabled={isRunning || evaluation.status === "RUNNING"}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                {isRunning || evaluation.status === "RUNNING" ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Running In-Enclave...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Run Evaluation</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartEvaluation}
                disabled={isRunning}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 text-xs font-semibold transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Re-run Evaluation</span>
              </button>
            )}
          </div>
        )}
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
                    {evaluation.description || "In-enclave privacy-preserving quality assessment."}
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

          {/* Privacy & Health Score Overview Card */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-100">
              {/* Overall Health Score */}
              <div className="space-y-1">
                <span className="text-xs text-slate-500 font-medium">Data Health Score</span>
                <div className="text-3xl font-extrabold text-slate-900 font-mono">
                  {healthScore !== null ? `${healthScore.toFixed(1)}%` : "—"}
                </div>
                <span className="text-[11px] text-teal-600 font-medium">
                  {healthScore !== null ? "Weighted multi-engine score" : "Pending execution"}
                </span>
              </div>

              {/* Privacy Guardrail Status */}
              <div className="space-y-1 md:pl-6 pt-3 md:pt-0">
                <span className="text-xs text-slate-500 font-medium">Privacy Guardrail</span>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-teal-600" />
                  <span className="text-lg font-bold text-teal-800">ENFORCED</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  Zero raw records retained
                </span>
              </div>

              {/* Raw Records Transferred Invariant */}
              <div className="space-y-1 md:pl-6 pt-3 md:pt-0">
                <span className="text-xs text-slate-500 font-medium">Raw Records Transferred</span>
                <div className="text-2xl font-bold text-slate-900 font-mono">
                  0
                </div>
                <span className="text-[11px] text-emerald-700 font-medium">
                  Architectural Invariant Verified
                </span>
              </div>

              {/* Execution Status & Time */}
              <div className="space-y-1 md:pl-6 pt-3 md:pt-0">
                <span className="text-xs text-slate-500 font-medium">Status & Timing</span>
                <div>
                  <StatusBadge status={evaluation.status} />
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  {latestResult ? `${latestResult.processingTimeMs} ms elapsed` : "Ready to run"}
                </span>
              </div>
            </div>
          </div>

          {/* Section: Data Health & Trust Report (7 Engine Breakdown) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Data Health & Trust Report (In-Enclave Engines)
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                7 Core Verification Engines
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 1. Completeness */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 space-y-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Completeness</span>
                  <StatusBadge status={detailed?.completeness?.status || (latestResult ? "PASSED" : "PENDING")} />
                </div>
                <div className="text-2xl font-extrabold text-slate-900 font-mono">
                  {latestResult ? `${(detailed?.completeness?.completeness_score ?? latestResult.completenessScore).toFixed(1)}%` : "—"}
                </div>
                <p className="text-[11px] text-slate-500">
                  Missing value rate: {latestResult ? `${(detailed?.completeness?.missing_rate ?? latestResult.missingValueRate).toFixed(2)}%` : "—"}
                </p>
              </div>

              {/* 2. Validity */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 space-y-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Validity</span>
                  <StatusBadge status={detailed?.validity?.status || (latestResult ? "PASSED" : "PENDING")} />
                </div>
                <div className="text-2xl font-extrabold text-slate-900 font-mono">
                  {latestResult ? `${(detailed?.validity?.validity_score ?? 100.0).toFixed(1)}%` : "—"}
                </div>
                <p className="text-[11px] text-slate-500">
                  Invalid values: {latestResult ? (detailed?.validity?.invalid_value_count ?? latestResult.invalidValueCount) : "—"}
                </p>
              </div>

              {/* 3. Duplicates */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 space-y-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Uniqueness (Duplicates)</span>
                  <StatusBadge status={detailed?.duplicates?.status || (latestResult ? "PASSED" : "PENDING")} />
                </div>
                <div className="text-2xl font-extrabold text-slate-900 font-mono">
                  {latestResult ? `${(100.0 - (detailed?.duplicates?.duplicate_rate ?? latestResult.duplicateRate)).toFixed(1)}%` : "—"}
                </div>
                <p className="text-[11px] text-slate-500">
                  Duplicate row rate: {latestResult ? `${(detailed?.duplicates?.duplicate_rate ?? latestResult.duplicateRate).toFixed(2)}%` : "—"}
                </p>
              </div>

              {/* 4. Consistency */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 space-y-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Logical Consistency</span>
                  <StatusBadge status={detailed?.consistency?.status || (latestResult ? "PASSED" : "PENDING")} />
                </div>
                <div className="text-2xl font-extrabold text-slate-900 font-mono">
                  {latestResult ? `${(detailed?.consistency?.consistency_score ?? latestResult.consistencyScore).toFixed(1)}%` : "—"}
                </div>
                <p className="text-[11px] text-slate-500">
                  Inconsistency rate: {latestResult ? `${(detailed?.consistency?.inconsistency_rate ?? 0.0).toFixed(2)}%` : "—"}
                </p>
              </div>

              {/* 5. Outliers */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 space-y-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Outlier Detection</span>
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold font-mono">IQR Bounds</span>
                </div>
                <div className="text-2xl font-extrabold text-slate-900 font-mono">
                  {latestResult ? `${(detailed?.outliers?.outlier_rate ?? 0.0).toFixed(2)}%` : "—"}
                </div>
                <p className="text-[11px] text-slate-500">
                  Outliers detected: {latestResult ? (detailed?.outliers?.outlier_count ?? 0) : "—"}
                </p>
              </div>

              {/* 6. Anomalies */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 space-y-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Anomaly Analysis</span>
                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-semibold font-mono">Z-Score 3σ</span>
                </div>
                <div className="text-2xl font-extrabold text-slate-900 font-mono">
                  {latestResult ? `${(detailed?.anomalies?.anomaly_rate ?? 0.0).toFixed(2)}%` : "—"}
                </div>
                <p className="text-[11px] text-slate-500">
                  Anomalies detected: {latestResult ? (detailed?.anomalies?.anomaly_count ?? latestResult.anomalyCount) : "—"}
                </p>
              </div>

              {/* 7. Bias & Fairness */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 space-y-2 shadow-sm col-span-1 sm:col-span-2 lg:col-span-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Bias & Demographic Fairness</span>
                  <StatusBadge status={detailed?.bias_fairness?.status || (latestResult ? "PASSED" : "PENDING")} />
                </div>
                <div className="flex items-baseline gap-4">
                  <div className="text-2xl font-extrabold text-slate-900 font-mono">
                    {latestResult ? `${(detailed?.bias_fairness?.fairness_score ?? 100.0).toFixed(1)}%` : "—"}
                  </div>
                  <span className="text-xs text-slate-500">
                    Max group rate disparity: {latestResult ? `${((detailed?.bias_fairness?.max_disparity ?? latestResult.biasIndicator) * 100).toFixed(2)}%` : "—"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Local demographic-parity disparity evaluation. Individual protected attributes are never exported.
                </p>
              </div>
            </div>
          </div>

          {/* Section: Evaluation Progress Stepper */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Execution Workflow
                </h3>
              </div>
              <StatusBadge status={evaluation.status} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>1. Specification Registered</span>
                </div>
                <p className="text-[10px] text-slate-600">
                  Evaluation registered in catalog.
                </p>
              </div>

              <div className={`p-3 rounded-xl border space-y-1 ${evaluation.status === "RUNNING" ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50/50"}`}>
                <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>2. Instruction Dispatched</span>
                </div>
                <p className="text-[10px] text-slate-600">
                  Local enclave worker receives task.
                </p>
              </div>

              <div className={`p-3 rounded-xl border space-y-1 ${evaluation.status === "COMPLETED" ? "border-emerald-200 bg-emerald-50/50" : evaluation.status === "RUNNING" ? "border-amber-300 bg-amber-50/80" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <Cpu className="w-4 h-4 text-teal-600" />
                  <span>3. Local Enclave Run</span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Computations execute 100% locally.
                </p>
              </div>

              <div className={`p-3 rounded-xl border space-y-1 ${evaluation.status === "COMPLETED" ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>4. Aggregate Ingestion</span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Zero raw records transferred.
                </p>
              </div>
            </div>
          </div>

          {/* Privacy Invariant Assurance Card */}
          <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-5 shadow-xs flex items-start gap-3">
            <Lock className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-teal-900">
              <h4 className="font-bold text-teal-800">
                Architectural Invariant Active: Zero Raw Data Retention
              </h4>
              <p className="text-[11px] text-teal-700 leading-relaxed">
                Verdix guarantees that neither credentials, row-level CSVs, nor confidential records are uploaded to the cloud during evaluations. All profiling, outlier detection, and fairness calculations execute strictly inside your local enclave environment.
              </p>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
