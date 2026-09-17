"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  getEvaluations,
  getDatasets,
  connectLocalDataset,
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
  Layers,
  Database,
  ArrowRight,
  Link2,
  X,
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
  const [showDatasetModal, setShowDatasetModal] = useState(false);

  // Evaluation form
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

  // Dataset connection form
  const [datasetName, setDatasetName] = useState("");
  const [datasetDescription, setDatasetDescription] = useState("");
  const [connectingDataset, setConnectingDataset] = useState(false);
  const [datasetError, setDatasetError] = useState<string | null>(null);

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

  const handleConnectDataset = async (e: React.FormEvent) => {
    e.preventDefault();
    setDatasetError(null);

    if (!datasetName.trim()) {
      setDatasetError("Dataset name is required.");
      return;
    }

    setConnectingDataset(true);

    try {
      const createdDataset = await connectLocalDataset({
        name: datasetName.trim(),
        description: datasetDescription.trim() || undefined,
        sourceType: "CSV_LOCAL",
      });

      setDatasets((prev) => [createdDataset, ...prev]);
      setSelectedDatasetId(createdDataset.id);

      setDatasetName("");
      setDatasetDescription("");
      setShowDatasetModal(false);

      // If the evaluation modal was not already open,
      // open it so the newly connected dataset is immediately usable.
      setFormError(null);
      setShowModal(true);
    } catch (err: unknown) {
      const error = err as Error;
      setDatasetError(
        error.message || "Failed to connect local dataset."
      );
    } finally {
      setConnectingDataset(false);
    }
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

      setName("Customer Data Quality Check");
      setDescription(
        "Initial privacy-preserving data quality evaluation."
      );

      setEvaluations((prev) => [
        created,
        ...prev.filter((e) => e.id !== created.id),
      ]);
    } catch (err: unknown) {
      const error = err as Error;
      setFormError(
        error.message || "Failed to create evaluation."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEvaluations = evaluations.filter((item) => {
    const matchesFilter =
      filter === "all" ||
      item.status.toLowerCase() === filter.toLowerCase();

    const datasetName = item.dataset?.name || "";

    const matchesSearch =
      item.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      datasetName
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      item.id
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const isViewer = currentUser?.role === "VIEWER";

  return (
    <AppShell
      title="Evaluations"
      subtitle="Create and monitor privacy-preserving dataset evaluations."
    >
      {/* ================================================================= */}
      {/* TOP ACTION BAR */}
      {/* ================================================================= */}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
            {(
              [
                "all",
                "PENDING",
                "READY",
                "RUNNING",
                "COMPLETED",
                "FAILED",
              ] as const
            ).map((status) => (
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

        {/* ACTIONS */}
        <div className="flex items-center gap-2">
          {!isViewer && (
            <>
              <button
                type="button"
                onClick={() => {
                  setDatasetError(null);
                  setShowDatasetModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-[#CBD5E1] font-semibold text-xs transition-colors shadow-sm"
              >
                <Link2 className="w-4 h-4" />
                <span>Connect Local Dataset</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setShowModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Create Evaluation</span>
              </button>
            </>
          )}

          {isViewer && (
            <div className="text-xs text-slate-500 font-medium px-3 py-2 rounded-xl bg-slate-100 border border-slate-200">
              View-Only Role
            </div>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* DATASET SUMMARY */}
      {/* ================================================================= */}

      <div className="flex items-center justify-between rounded-2xl border border-teal-100 bg-teal-50/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-teal-100 flex items-center justify-center">
            <Database className="w-4 h-4 text-teal-600" />
          </div>

          <div>
            <p className="text-xs font-bold text-slate-900">
              {datasets.length} local dataset
              {datasets.length === 1 ? "" : "s"} connected
            </p>

            <p className="text-[11px] text-slate-500">
              Dataset metadata only — raw records remain inside your
              environment.
            </p>
          </div>
        </div>

        {!isViewer && (
          <button
            type="button"
            onClick={() => {
              setDatasetError(null);
              setShowDatasetModal(true);
            }}
            className="text-xs font-semibold text-teal-700 hover:text-teal-800"
          >
            + Connect
          </button>
        )}
      </div>

      {/* ================================================================= */}
      {/* EVALUATIONS TABLE */}
      {/* ================================================================= */}

      <div className="rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <div className="p-4 border-b border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between text-xs text-[#64748B]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />

            <span className="font-semibold text-slate-700">
              Verdix In-Enclave Evaluation Engine
            </span>
          </div>

          <span className="font-mono">
            Showing {filteredEvaluations.length} evaluation
            {filteredEvaluations.length === 1 ? "" : "s"}
          </span>
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
              <h3 className="text-sm font-bold text-slate-900">
                No evaluations yet
              </h3>

              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Connect a local dataset first, then create your first
                privacy-preserving evaluation.
              </p>
            </div>

            {!isViewer && (
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDatasetModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-[#CBD5E1] font-semibold text-xs shadow-sm"
                >
                  <Link2 className="w-4 h-4" />
                  Connect Dataset
                </button>

                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Evaluation
                </button>
              </div>
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
                          <span>
                            {item.dataset?.name || item.datasetId}
                          </span>
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
                        {new Date(
                          item.createdAt
                        ).toLocaleDateString(undefined, {
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

      {/* ================================================================= */}
      {/* CONNECT LOCAL DATASET MODAL */}
      {/* ================================================================= */}

      {showDatasetModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl">
            <div className="p-6 border-b border-[#F1F5F9] flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center">
                  <Database className="w-4 h-4 text-teal-700" />
                </div>

                <div>
                  <h3 className="font-bold text-[#0F172A] text-sm">
                    Connect Local Dataset
                  </h3>

                  <p className="text-[11px] text-slate-500 mt-1">
                    Register a dataset that remains inside your
                    organization.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDatasetModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleConnectDataset}
              className="p-6 space-y-4"
            >
              {datasetError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{datasetError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-slate-700 font-semibold block text-xs">
                  Dataset Name <span className="text-rose-500">*</span>
                </label>

                <input
                  type="text"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  placeholder="e.g. Customer Records"
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#CBD5E1] text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-700 font-semibold block text-xs">
                  Description
                </label>

                <textarea
                  value={datasetDescription}
                  onChange={(e) =>
                    setDatasetDescription(e.target.value)
                  }
                  placeholder="Optional description of the local dataset..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#CBD5E1] text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-teal-500 resize-none"
                />
              </div>

              {/* PRIVACY NOTICE */}
              <div className="p-4 rounded-xl bg-teal-50 border border-teal-200">
                <div className="flex items-center gap-2 text-teal-800 font-semibold text-xs">
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                  Privacy-preserving connection
                </div>

                <p className="text-[11px] text-teal-700 leading-relaxed mt-2">
                  Verdix does not upload or store your CSV, records,
                  names, emails, phone numbers, IDs, or other raw data.
                  Only dataset metadata is registered here. The
                  Verdix Agent analyzes the actual data locally.
                </p>

                <div className="flex items-center gap-2 mt-3 text-[10px] text-teal-800 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Raw records transferred: 0
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setShowDatasetModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#CBD5E1] text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={connectingDataset}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-semibold text-xs shadow-sm"
                >
                  {connectingDataset ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Link2 className="w-3.5 h-3.5" />
                      Connect Dataset
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* CREATE EVALUATION MODAL */}
      {/* ================================================================= */}

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
                    Configure local evaluation checks for in-enclave
                    agent execution.
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

            <form
              onSubmit={handleCreateEvaluation}
              className="space-y-4 text-xs"
            >
              {/* Evaluation Name */}
              <div className="space-y-1.5">
                <label className="text-slate-700 font-semibold block">
                  Evaluation Name{" "}
                  <span className="text-rose-500">*</span>
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

              {/* Dataset */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-700 font-semibold block">
                    Target Dataset{" "}
                    <span className="text-rose-500">*</span>
                  </label>

                  {!isViewer && (
                    <button
                      type="button"
                      onClick={() => {
                        setDatasetError(null);
                        setShowDatasetModal(true);
                      }}
                      className="text-[11px] text-teal-700 font-semibold hover:text-teal-800"
                    >
                      + Connect Dataset
                    </button>
                  )}
                </div>

                {datasets.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50">
                    <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs">
                      <Database className="w-4 h-4" />
                      No connected datasets
                    </div>

                    <p className="text-[11px] text-slate-500 mt-1">
                      Connect a local dataset to continue. Your raw
                      data never leaves your environment.
                    </p>

                    {!isViewer && (
                      <button
                        type="button"
                        onClick={() => setShowDatasetModal(true)}
                        className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        Connect Local Dataset
                      </button>
                    )}
                  </div>
                ) : (
                  <select
                    value={selectedDatasetId}
                    onChange={(e) =>
                      setSelectedDatasetId(e.target.value)
                    }
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

              {/* Checks */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-700 font-semibold block">
                    Evaluation Checks{" "}
                    <span className="text-rose-500">*</span>
                  </label>

                  <span className="text-[11px] text-teal-700 font-medium">
                    {selectedChecks.length} of{" "}
                    {AVAILABLE_CHECKS.length} selected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
                  {AVAILABLE_CHECKS.map((chk) => {
                    const isSelected =
                      selectedChecks.includes(chk.id);

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

              {/* Privacy */}
              <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-teal-800">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>Privacy Invariant Guaranteed</span>
                </div>

                <p className="text-[11px] text-teal-700 leading-relaxed">
                  Raw records and customer data will never be
                  transferred to the cloud. The organization-side
                  Verdix Agent executes these checks locally within
                  your enclave.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-[#CBD5E1] text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting || datasets.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-semibold text-xs shadow-sm"
                >
                  {submitting
                    ? "Creating..."
                    : "Create Evaluation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}