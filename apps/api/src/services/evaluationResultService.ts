import { prisma } from "../lib/prisma";
import { PrivacyStatus } from "@prisma/client";
import { logger } from "@verdix/shared";

export interface CreateEvaluationResultInput {
  evaluationId: string;
  completenessScore: number;
  consistencyScore: number;
  duplicateRate: number;
  anomalyCount: number;
  invalidValueCount: number;
  missingValueRate: number;
  biasIndicator: number;
  privacyStatus?: PrivacyStatus;
  rawRecordsTransferred: number;
  processingTimeMs: number;
}

/**
 * Internal Service Function: Record Protected Aggregate Evaluation Result
 * Non-negotiable Invariant: rawRecordsTransferred MUST be strictly 0.
 */
export async function recordProtectedEvaluationResult(input: CreateEvaluationResultInput) {
  // CRITICAL INVARIANT: Zero raw-data egress
  if (input.rawRecordsTransferred !== 0) {
    logger.error(
      `CRITICAL PRIVACY BREACH ATTEMPT: Result claimed ${input.rawRecordsTransferred} raw records transferred for evaluation ${input.evaluationId}. Rejected.`
    );
    throw new Error(
      "Architectural Invariant Violation: rawRecordsTransferred must strictly be 0. Raw organizational data must never egress to the cloud."
    );
  }

  const result = await prisma.evaluationResult.create({
    data: {
      evaluationId: input.evaluationId,
      completenessScore: input.completenessScore,
      consistencyScore: input.consistencyScore,
      duplicateRate: input.duplicateRate,
      anomalyCount: input.anomalyCount,
      invalidValueCount: input.invalidValueCount,
      missingValueRate: input.missingValueRate,
      biasIndicator: input.biasIndicator,
      privacyStatus: input.privacyStatus ?? PrivacyStatus.ENFORCED,
      rawRecordsTransferred: 0, // Enforced
      processingTimeMs: input.processingTimeMs,
    },
  });

  // Automatically mark evaluation completed
  await prisma.evaluation.update({
    where: { id: input.evaluationId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  logger.info(
    `Protected aggregate result recorded for evaluation ${input.evaluationId}. Privacy Status: ${result.privacyStatus}`
  );

  return result;
}
