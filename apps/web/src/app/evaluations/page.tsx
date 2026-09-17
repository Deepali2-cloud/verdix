"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  getEvaluations,
  getDatasets,
  createEvaluation,
  ApiEvaluation,
  ApiDataset,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Plus,
  Search,
  FileSpreadsheet,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  Sparkles,
  Database,
  ArrowRight,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

const AVAILABLE_CHECKS = [
  {
    id: "completeness",
    name: "Completeness",
    description: "Check missing values and field coverage.",
  },
  {
    id: "validity",
    name: "Validity",
    description: "Check invalid or malformed values.",
  },
  {
    id: "duplicates",
    name: "Duplicates",
    description: "Detect duplicate records.",
  },
  {
    id: "consistency",
    name: "Consistency",
    description: "Check cross-field and formatting consistency.",
  },
  {
    id: "outliers",
    name: "Outliers",
    description: "Identify statistically unusual values.",
  },
  {
    id: "anomalies",
    name: "Anomalies",
    description: "Detect unusual patterns.",
  },
  {
    id: "bias_fairness",
    name: "Bias / Fairness",
    description: "Perform aggregate disparity analysis where applicable.",
  },
];

export default function EvaluationsPage() {
  const { currentUser } = useAuth();
  const [evaluations, setEvaluations] = useState<ApiEvaluation[]>([]);
  const [datasets, setDatasets] = useState<ApiDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [name, setName] = useState("Customer Data Quality Check");
  const [description, setDescription] = useState(
    "Initial privacy-preserving data quality evaluation."
  );
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [selectedChecks, setSelectedChecks] = useState<string[]>([
    "completeness",
    "validity",
    "duplicates",
    "consistency",
    "outliers",
    "anomalies",
    "bias_fairness",
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [evalsData, datasetsData] = await Promise.all([
        getEvaluations(),
        getDatasets(),
      ]);
      setEvaluations(evalsData);
      setDatasets(datasetsData);
      if (datasetsData.length > 0 && !selectedDatasetId) {
        setSelectedDatasetId(datasetsData[0].id);
      }
    } catch (err: unknown) {
      console.error("Failed to load evaluations or datasets:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedDatasetId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleCheck = (checkId: string) => {
    setSelectedChecks((prev) =>
      prev.includes(checkId)
        ? prev.filter((c) => c !== checkId)
        : [...prev, checkId]
    );
  };

  const handleCreateEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Evaluation name is required.");
      return;
    }
    if (!selectedDatasetId) {
      setFormError("Please select a target dataset.");
      return;
    }
    if (selectedChecks.length === 0) {
      setFormError("Select at least one evaluation check to perform.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createEvaluation({
        name: name.trim(),
        description: description.trim() || undefined,
        datasetId: selectedDatasetId,
        checks: selectedChecks,
      });

      setShowModal(false);
      // Reset form to default
      setName("");
      setDescription("");
      // Add or refresh evaluations
      setEvaluations((prev) => [created, ...prev.filter((e) => e.id !== created.id)]);
    } catch (err: unknown) {
      const error = err as Error;
      setFormError(error.message || "Failed to create evaluation.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEvaluations = evaluations.filter((item) => {
    const matchesFilter =
      filter === "all" || item.status.toLowerCase() === filter.toLowerCase();
    const datasetName = item.dataset?.name || "";
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      datasetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const isViewer = currentUser?.role === "VIEWER";

  return (
    <AppShell
      title="Evaluations"
      subtitle="Create and monitor privacy-preserving dataset evaluations."
    >
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Search & Status Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search evaluations, datasets, or IDs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-teal-500 shadow-sm"
            />
          </div>

          <div className="flex items-center rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] p-1">
            {(["all", "PENDING", "READY", "RUNNING", "COMPLETED", "FAILED"] as const).map(
              (status) => (
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
              )
            )}
          </div>
        </div>

        {/* Create Evaluation Button */}
        <div>
          {isViewer ? (
            <div className="text-xs text-slate-500 font-medium px-3 py-2 rounded-xl bg-slate-100 border border-slate-200">
              View-Only Role
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setShowModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create Evaluation</span>
            </button>
          )}
        </div>
      </div>

      {/* Evaluations Table / Empty State */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <div className="p-4 border-b border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between text-xs text-[#64748B]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            <span className="font-semibold text-slate-700">Verdix In-Enclave Evaluation Engine</span>
          </div>
          <span className="font-mono">Showing {filteredEvaluations.length} evaluation{filteredEvaluations.length === 1 ? "" : "s"}</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <div className="inline-block w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mb-2" />
            <p>Loading evaluations...</p>
          </div>
        ) : filteredEvaluations.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 border border-teal-100 mx-auto flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">No evaluations yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Create your first evaluation to assess a protected dataset.
              </p>
            </div>
            {!isViewer && (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Evaluation</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[#64748B] text-[11px] font-semibold bg-[#FAFAFC]">
                  <th className="py-3 px-4">Evaluation</th>
                  <th className="py-3 px-4">Dataset</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Checks</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4">Created By</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {filteredEvaluations.map((item) => {
                  const checkCount =
                    item.checks?.length ||
                    (item.evaluationType === "FULL" ? 7 : 4);
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-[#F8FAFC] transition-colors group"
                    >
                      <td className="py-3.5 px-4 font-semibold text-[#0F172A]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 shrink-0">
                            <FileSpreadsheet className="w-4 h-4" />
                          </div>
                          <div>
                            <Link
                              href={`/evaluations/${item.id}`}
                              className="hover:text-teal-600 transition-colors font-semibold text-slate-900"
                            >
                              {item.name}
                            </Link>
                            <div className="text-[10px] text-[#64748B] font-mono font-normal">
                              ID: {item.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F1F5F9] border border-[#E2E8F0] text-slate-800 font-medium text-[11px]">
                          <Database className="w-3 h-3 text-slate-500" />
                          <span>{item.dataset?.name || item.datasetId}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <StatusBadge status={item.status} />
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          <span>{checkCount} checks</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-[#64748B] text-[11px]">
                        {new Date(item.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 font-medium text-[11px]">
                        {item.createdBy || "Demo Analyst"}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/evaluations/${item.id}`}
                          className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 font-semibold text-xs transition-colors"
                        >
                          <span>View Details</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Evaluation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A] text-sm">
                    Create Privacy-Preserving Evaluation
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Configure local evaluation checks for in-enclave agent execution.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-mono p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateEvaluation} className="space-y-4 text-xs">
              {/* Evaluation Name */}
              <div className="space-y-1.5">
                <label className="text-slate-700 font-semibold block">
                  Evaluation Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Customer Data Quality Check"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#CBD5E1] text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-slate-700 font-semibold block">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Initial privacy-preserving data quality evaluation"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#CBD5E1] text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Dataset Dropdown */}
              <div className="space-y-1.5">
                <label className="text-slate-700 font-semibold block">
                  Target Dataset (Organization-Scoped) <span className="text-rose-500">*</span>
                </label>
                {datasets.length === 0 ? (
                  <p className="text-slate-500 italic">No connected datasets found in your organization.</p>
                ) : (
                  <select
                    value={selectedDatasetId}
                    onChange={(e) => setSelectedDatasetId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#CBD5E1] text-[#0F172A] focus:outline-none focus:border-teal-500"
                    required
                  >
                    {datasets.map((ds) => (
                      <option key={ds.id} value={ds.id}>
                        {ds.name} ({ds.sourceType})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Evaluation Checks Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-700 font-semibold block">
                    Evaluation Checks <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-teal-700 font-medium">
                    {selectedChecks.length} of {AVAILABLE_CHECKS.length} selected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
                  {AVAILABLE_CHECKS.map((chk) => {
                    const isSelected = selectedChecks.includes(chk.id);
                    return (
                      <div
                        key={chk.id}
                        onClick={() => toggleCheck(chk.id)}
                        className={cn(
                          "p-2.5 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-2.5",
                          isSelected
                            ? "bg-teal-50/70 border-teal-300 shadow-xs"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                        />
                        <div>
                          <div className="font-semibold text-slate-900 text-[11px]">
                            {chk.name}
                          </div>
                          <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                            {chk.description}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Privacy Guard Notice */}
              <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-teal-800">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>Privacy Invariant Guaranteed</span>
                </div>
                <p className="text-[11px] text-teal-700 leading-relaxed">
                  Raw records and customer data will never be transferred to the cloud. The organization-side Verdix Agent executes these checks locally within your enclave.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-[#CBD5E1] text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer"
                >
                  {submitting ? "Creating..." : "Create Evaluation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
