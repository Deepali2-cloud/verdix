/**
 * @verdix/types
 * Core domain contracts and type definitions for the Verdix privacy-preserving infrastructure.
 */

export type ServiceStatus = "healthy" | "degraded" | "unhealthy";

export interface HealthCheckResponse {
  service: string;
  status: ServiceStatus;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  architecture: {
    rawDataRetention: false;
    privacyPreserving: true;
  };
}

export type EvaluationMetricType =
  | "count"
  | "summary_statistics"
  | "quantile"
  | "correlation_matrix"
  | "confusion_matrix"
  | "fairness_disparity";

export type EvaluationCheckType =
  | "completeness"
  | "validity"
  | "duplicates"
  | "consistency"
  | "outliers"
  | "anomalies"
  | "bias_fairness";

export type EvaluationStatusType =
  | "PENDING"
  | "READY"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CREATED"
  | "QUEUED";

export interface PrivacyPolicySpec {
  minGroupSize: number; // Minimum bucket size to prevent k-anonymity violation
  differentialPrivacyEpsilon?: number;
  allowColumnNames: boolean;
  prohibitExportOfRawRows: true;
}

export interface EvaluationSpec {
  evaluationId: string;
  datasetAlias: string;
  metrics: EvaluationMetricType[];
  targetColumns: string[];
  privacyPolicy: PrivacyPolicySpec;
  metadata?: Record<string, string>;
}

export type JobStatus = "pending" | "dispatched" | "running" | "completed" | "failed";

export interface EvaluationJob {
  id: string;
  spec: EvaluationSpec;
  status: JobStatus;
  createdAt: string;
  dispatchedAt?: string;
  completedAt?: string;
  agentId?: string;
  errorMessage?: string;
}

export interface MetricSummary {
  metric: EvaluationMetricType;
  column?: string;
  value: number | Record<string, number> | number[][];
  sampleSize: number;
  privacyNoiseAdded?: boolean;
}

/**
 * AggregateResult is the ONLY data payload an agent sends to the cloud.
 * It is architecturally guaranteed to never contain raw records.
 */
export interface AggregateResult {
  jobId: string;
  agentId: string;
  datasetAlias: string;
  executionTimeMs: number;
  timestamp: string;
  summaryMetrics: MetricSummary[];
  rawDataIncluded: false;
  privacyValidationPassed: boolean;
  agentSignature?: string;
}

export interface AgentHeartbeat {
  agentId: string;
  agentName: string;
  version: string;
  status: "idle" | "evaluating" | "error";
  supportedMetrics: EvaluationMetricType[];
  timestamp: string;
  enclaveEnvironment: string;
}
