import express, { Request, Response } from "express";
import cors from "cors";
import { HealthCheckResponse, AgentHeartbeat, AggregateResult, EvaluationJob } from "@verdix/types";
import { VERDIX_CONSTANTS, validateAggregateResult, logger } from "@verdix/shared";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : VERDIX_CONSTANTS.DEFAULT_API_PORT;
const startTime = Date.now();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// In-memory registry for foundation (no DB yet)
const registeredAgents = new Map<string, AgentHeartbeat>();
const receivedResults = new Map<string, AggregateResult>();
const evaluationJobs: EvaluationJob[] = [];

/**
 * Health Check Endpoint
 */
app.get("/health", (_req: Request, res: Response) => {
  const health: HealthCheckResponse = {
    service: "verdix-cloud-api",
    status: "healthy",
    version: VERDIX_CONSTANTS.VERSION,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    environment: process.env.NODE_ENV || "development",
    architecture: {
      rawDataRetention: false,
      privacyPreserving: true,
    },
  };
  res.json(health);
});

app.get("/api/v1/health", (_req: Request, res: Response) => {
  res.redirect("/health");
});

/**
 * System Status Endpoint
 */
app.get("/api/v1/status", (_req: Request, res: Response) => {
  res.json({
    status: "ready",
    activeAgentsCount: registeredAgents.size,
    completedEvaluationsCount: receivedResults.size,
    architecturalGuarantee: "Zero raw-dataset ingestion. Privacy-preserving aggregate evaluations only.",
  });
});

/**
 * Agent Heartbeat Endpoint
 * Used by Verdix local agents to announce presence and health.
 */
app.post("/api/v1/agent/heartbeat", (req: Request, res: Response) => {
  const heartbeat = req.body as AgentHeartbeat;

  if (!heartbeat?.agentId) {
    res.status(400).json({ error: "agentId is required" });
    return;
  }

  registeredAgents.set(heartbeat.agentId, {
    ...heartbeat,
    timestamp: new Date().toISOString(),
  });

  logger.info(`Agent heartbeat received from ${heartbeat.agentId} (${heartbeat.agentName || "unnamed"})`);

  res.json({
    acknowledged: true,
    agentId: heartbeat.agentId,
    serverTime: new Date().toISOString(),
  });
});

/**
 * Evaluation Result Ingestion Endpoint
 * CRITICAL ARCHITECTURAL RULE: Only accepts verified aggregate summaries.
 */
app.post("/api/v1/evaluations/results", (req: Request, res: Response) => {
  try {
    const validatedResult = validateAggregateResult(req.body);
    receivedResults.set(validatedResult.jobId, validatedResult);

    logger.info(
      `Aggregate result recorded for job ${validatedResult.jobId} from agent ${validatedResult.agentId}. Metrics count: ${validatedResult.summaryMetrics.length}`
    );

    res.status(201).json({
      success: true,
      jobId: validatedResult.jobId,
      message: "Aggregate evaluation result received and verified. Zero raw records ingested.",
    });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error(`Rejected result submission: ${error.message}`);
    res.status(400).json({
      error: error.message,
      code: "PRIVACY_OR_SCHEMA_VIOLATION",
    });
  }
});

/**
 * Evaluation Jobs List Endpoint (Foundation stub)
 */
app.get("/api/v1/jobs", (_req: Request, res: Response) => {
  res.json({
    jobs: evaluationJobs,
    total: evaluationJobs.length,
  });
});

/**
 * Defensive Architecture Guardrail:
 * Explicitly reject any attempts or routes attempting to upload raw datasets.
 */
app.all("/api/v1/datasets/upload*", (_req: Request, res: Response) => {
  res.status(403).json({
    error: "Architectural Violation",
    message:
      "Raw dataset upload is prohibited by Verdix privacy architecture. Computations must run locally via the Verdix Agent.",
    tagline: VERDIX_CONSTANTS.TAGLINE,
  });
});

const server = app.listen(PORT, () => {
  logger.info(`Verdix Cloud API running on http://localhost:${PORT}`);
  logger.info(`Architectural Rule: Raw dataset upload is disabled by design.`);
});

export { app, server };
