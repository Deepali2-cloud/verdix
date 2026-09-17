import { prisma } from "../lib/prisma";
import { ActorType, Prisma } from "@prisma/client";
import { logger } from "@verdix/shared";

export interface LogAuditActionInput {
  organizationId: string;
  evaluationId?: string | null;
  action: string;
  actorType?: ActorType;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Record an audit log entry in the database.
 * Privacy Rule: Metadata must never contain sensitive customer or dataset rows.
 */
export async function logAuditAction(input: LogAuditActionInput) {
  try {
    const entry = await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        evaluationId: input.evaluationId ?? null,
        action: input.action,
        actorType: input.actorType ?? ActorType.SYSTEM,
        metadata: input.metadata ?? {},
      },
    });

    logger.info(`Audit log recorded: [${entry.action}] by ${entry.actorType} (org: ${input.organizationId})`);
    return entry;
  } catch (err: unknown) {
    const error = err as Error;
    // Audit log failures should be logged but never crash the core request
    logger.error(`Failed to record audit log: ${error.message}`);
    return null;
  }
}
