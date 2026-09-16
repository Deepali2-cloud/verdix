/**
 * @verdix/evaluation-engine
 * Evaluation definitions, metric schemas, and policy enforcement primitives.
 */

import {
  EvaluationSpec,
  EvaluationMetricType,
  PrivacyPolicySpec,
} from "@verdix/types";

export interface CreateSpecOptions {
  evaluationId: string;
  datasetAlias: string;
  targetColumns: string[];
  metrics: EvaluationMetricType[];
  privacyPolicy?: Partial<PrivacyPolicySpec>;
  metadata?: Record<string, string>;
}

/**
 * Creates an evaluation specification with mandatory privacy constraints.
 */
export function createEvaluationSpec(options: CreateSpecOptions): EvaluationSpec {
  if (!options.targetColumns || options.targetColumns.length === 0) {
    throw new Error("EvaluationSpec requires at least one target column");
  }

  if (!options.metrics || options.metrics.length === 0) {
    throw new Error("EvaluationSpec requires at least one evaluation metric");
  }

  return {
    evaluationId: options.evaluationId,
    datasetAlias: options.datasetAlias,
    metrics: options.metrics,
    targetColumns: options.targetColumns,
    privacyPolicy: {
      minGroupSize: options.privacyPolicy?.minGroupSize ?? 10,
      differentialPrivacyEpsilon: options.privacyPolicy?.differentialPrivacyEpsilon,
      allowColumnNames: options.privacyPolicy?.allowColumnNames ?? true,
      prohibitExportOfRawRows: true, // Non-negotiable architectural invariant
    },
    metadata: options.metadata,
  };
}

export const SUPPORTED_METRICS: readonly EvaluationMetricType[] = [
  "count",
  "summary_statistics",
  "quantile",
  "correlation_matrix",
  "confusion_matrix",
  "fairness_disparity",
] as const;
