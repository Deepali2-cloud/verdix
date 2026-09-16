/**
 * @verdix/shared
 * Shared constants, guard rails, and protocol standards.
 */

import { AggregateResult } from "@verdix/types";

export const VERDIX_CONSTANTS = {
  APP_NAME: "VERDIX",
  TAGLINE: "Don't share your data. Share the insight.",
  VERSION: "0.1.0",
  DEFAULT_API_PORT: 4000,
  DEFAULT_WEB_PORT: 3000,
  HEADERS: {
    AGENT_ID: "x-verdix-agent-id",
    AGENT_VERSION: "x-verdix-agent-version",
    AGENT_SIGNATURE: "x-verdix-agent-signature",
  },
} as const;

/**
 * Architectural assertion to enforce that incoming evaluation results
 * strictly do not contain raw rows or row-level collections.
 */
export function validateAggregateResult(payload: unknown): AggregateResult {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid payload: expected an object");
  }

  const raw = payload as Record<string, unknown>;

  if (raw.rawDataIncluded === true || raw.rawDataIncluded !== false) {
    throw new Error(
      "Architectural Violation: rawDataIncluded flag is set to true or missing. The cloud rejects raw dataset ingestion."
    );
  }

  const result = payload as Partial<AggregateResult>;

  if (!result.jobId || !result.agentId || !result.datasetAlias) {
    throw new Error("Missing required metadata fields (jobId, agentId, datasetAlias)");
  }

  if (!Array.isArray(result.summaryMetrics)) {
    throw new Error("Invalid payload: summaryMetrics must be an array of aggregates");
  }

  // Check that no metric payload contains raw table structures (e.g., arrays of row objects)
  for (const metric of result.summaryMetrics) {
    if (Array.isArray(metric.value) && metric.value.length > 0) {
      const first = metric.value[0];
      if (typeof first === "object" && first !== null && !Array.isArray(first)) {
        throw new Error(
          `Privacy Violation in metric '${metric.metric}': detected array of record objects. Raw dataset records are forbidden.`
        );
      }
    }
  }

  return {
    jobId: result.jobId,
    agentId: result.agentId,
    datasetAlias: result.datasetAlias,
    executionTimeMs: result.executionTimeMs || 0,
    timestamp: result.timestamp || new Date().toISOString(),
    summaryMetrics: result.summaryMetrics,
    rawDataIncluded: false,
    privacyValidationPassed: Boolean(result.privacyValidationPassed),
    agentSignature: result.agentSignature,
  };
}

export const logger = {
  info: (msg: string, ...args: unknown[]) => console.log(`[VERDIX INFO] ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) => console.warn(`[VERDIX WARN] ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(`[VERDIX ERROR] ${msg}`, ...args),
};
