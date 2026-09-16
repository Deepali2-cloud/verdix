export type EvaluationStatus = "Completed" | "Processing" | "Failed" | "Queued";
export type PrivacyStatus = "Protected" | "Enforced" | "Restricted";

export interface EvaluationItem {
  id: string;
  name: string;
  datasetAlias: string;
  status: EvaluationStatus;
  healthScore: number | null; // null when processing
  privacyStatus: PrivacyStatus;
  date: string;
  recordsEvaluated: number;
  anomaliesCount: number;
  duration: string;
  metricsComputed: number;
}

export interface HealthMetricDimension {
  name: "Completeness" | "Consistency" | "Validity" | "Uniqueness";
  score: number;
  target: number;
  description: string;
  status: "Optimal" | "Good" | "Attention";
}

export interface ActivityDataPoint {
  day: string;
  date: string;
  evaluations: number;
  metricsGenerated: number;
  healthAverage: number;
}

export interface PrivacyStats {
  enforcementStatus: "ACTIVE";
  rawRecordsTransferred: 0;
  protectedMetricsExported: number;
  blockedExportAttempts: number;
  policyViolations: 0;
  activeEpsilonBudget: number;
  minKAnonymityThreshold: number;
}

export interface ReportItem {
  id: string;
  title: string;
  dataset: string;
  generatedDate: string;
  healthScore: number;
  qualityScore: number;
  privacyScore: number;
  anomaliesFound: number;
  status: "Verified" | "Archived";
  summary: string;
  author: string;
}

export interface AuditLogEvent {
  id: string;
  timestamp: string;
  event: string;
  actor: string;
  targetDataset: string;
  enclaveId: string;
  status: "SUCCESS" | "BLOCKED" | "WARNING" | "INFO";
  details: string;
  sha256Proof: string;
}
