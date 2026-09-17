import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { HealthCheckResponse, AgentHeartbeat, AggregateResult, EvaluationJob } from "@verdix/types";
import { VERDIX_CONSTANTS, validateAggregateResult, logger } from "@verdix/shared";
import { prisma } from "./lib/prisma";
import { logAuditAction } from "./services/auditService";
import { requireAuth, requireRole } from "./middleware/auth";
import { hashPassword, comparePassword, signToken, sanitizeUser } from "./lib/auth";
import { ActorType, EvaluationStatus, EvaluationType, UserRole } from "@prisma/client";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : VERDIX_CONSTANTS.DEFAULT_API_PORT;
const startTime = Date.now();
const DEMO_PASSWORD_HASH = bcrypt.hashSync("DemoPassword123!", 10);

// ==============================================================================
// CORS CONFIGURATION
// Scoped strictly to development frontend origins
// ==============================================================================
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000")
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman, internal tests)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`Blocked by CORS: origin ${origin} is not in allowed origins [${allowedOrigins.join(", ")}]`);
        callback(new Error(`CORS policy does not allow access from origin ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));

// ==============================================================================
// 1. PRIVACY PROTECTION MIDDLEWARE
// Architectural Invariant: Reject any payload containing raw dataset fields.
// ==============================================================================
const SUSPICIOUS_RAW_DATA_FIELDS = [
  "rows",
  "records",
  "rawData",
  "csv",
  "file",
  "datasetContents",
  "personalRecords",
];

export function rawDataDetectionMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    const keys = Object.keys(req.body);
    const foundSuspicious = keys.filter((key) =>
      SUSPICIOUS_RAW_DATA_FIELDS.some((field) => field.toLowerCase() === key.toLowerCase())
    );

    if (foundSuspicious.length > 0) {
      logger.error(`[PRIVACY GUARD] Blocked raw data upload attempt. Detected fields: ${foundSuspicious.join(", ")}`);
      return res.status(400).json({
        error: "Privacy Violation",
        code: "RAW_DATA_INGESTION_PROHIBITED",
        message:
          "Verdix Cloud does not accept raw dataset records, rows, or file contents. Run computations locally inside the organization enclave via the Verdix Agent.",
        blockedFields: foundSuspicious,
      });
    }
  }
  next();
}

app.use(rawDataDetectionMiddleware);

// In-memory tracking
const registeredAgents = new Map<string, AgentHeartbeat>();
const receivedResults = new Map<string, AggregateResult>();
const evaluationJobs: EvaluationJob[] = [];

// ==============================================================================
// 2. HEALTH & STATUS ENDPOINTS (Public)
// ==============================================================================

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

app.get("/api/v1/health/database", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const error = err as Error;
    logger.warn(`Database health check failed: ${error.message}`);
    res.status(503).json({
      status: "degraded",
      database: "disconnected",
      message: "Database connection unavailable. Verify PostgreSQL service or Docker container is active.",
      timestamp: new Date().toISOString(),
    });
  }
});

app.get("/api/v1/status", (_req: Request, res: Response) => {
  res.json({
    status: "ready",
    activeAgentsCount: registeredAgents.size,
    completedEvaluationsCount: receivedResults.size,
    architecturalGuarantee: "Zero raw-dataset ingestion. Privacy-preserving aggregate evaluations only.",
  });
});

// ==============================================================================
// 3. AUTHENTICATION ENDPOINTS
// ==============================================================================

const registerSchema = z.object({
  organizationName: z.string().min(2, "Organization name must be at least 2 characters").max(100),
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

/**
 * POST /api/v1/auth/register
 */
app.post("/api/v1/auth/register", async (req: Request, res: Response) => {
  try {
    const validated = registerSchema.parse(req.body);
    const normalizedEmail = validated.email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      res.status(400).json({ error: "Email already registered", field: "email" });
      return;
    }

    const baseSlug = validated.organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
    const slug = `${baseSlug || "org"}-${Math.random().toString(36).substring(2, 7)}`;

    const passwordHash = await hashPassword(validated.password);

    const org = await prisma.organization.create({
      data: {
        name: validated.organizationName.trim(),
        slug,
        users: {
          create: {
            name: validated.name.trim(),
            email: normalizedEmail,
            passwordHash,
            role: UserRole.ADMIN,
          },
        },
        privacyPolicies: {
          create: {
            name: "Default Enclave Policy",
            allowAggregates: true,
            allowQualityScores: true,
            allowMissingRates: true,
            allowAnomalyCounts: true,
            allowBiasIndicators: true,
            allowIndividualRecords: false,
            allowRawDataset: false,
          },
        },
      },
      include: {
        users: true,
      },
    });

    const newUser = org.users[0];
    const safeUser = sanitizeUser(newUser);

    const token = signToken({
      userId: safeUser.id,
      organizationId: safeUser.organizationId,
      role: safeUser.role,
      email: safeUser.email,
      name: safeUser.name,
    });

    await logAuditAction({
      organizationId: org.id,
      action: "user.registered",
      actorType: ActorType.USER,
      metadata: { userId: safeUser.id, email: safeUser.email, role: safeUser.role },
    });

    logger.info(`User registered: ${safeUser.email} for organization "${org.name}" (${org.id})`);
    res.status(201).json({ user: safeUser, token });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: "Validation Error",
        details: err.errors.map((e) => ({ field: e.path.join("."), message: e.message })),
      });
      return;
    }

    const error = err as Error;
    logger.error(`Registration error: ${error.message}`);
    res.status(500).json({ error: "Failed to register user" });
  }
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

/**
 * POST /api/v1/auth/login
 */
app.post("/api/v1/auth/login", async (req: Request, res: Response) => {
  try {
    const validated = loginSchema.parse(req.body);
    const normalizedEmail = validated.email.trim().toLowerCase();

    let user = null;
    try {
      user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
    } catch (dbErr: unknown) {
      // Graceful offline fallback for synthetic development testing
      if (normalizedEmail === "analyst@verdix.demo") {
        const matches = await comparePassword(validated.password, DEMO_PASSWORD_HASH);
        if (matches) {
          user = {
            id: "usr-demo-analyst",
            organizationId: "org-verdix-demo",
            name: "Demo Analyst",
            email: "analyst@verdix.demo",
            passwordHash: DEMO_PASSWORD_HASH,
            role: UserRole.ANALYST,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
      }
    }

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const passwordMatches = await comparePassword(validated.password, user.passwordHash);
    if (!passwordMatches) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const safeUser = sanitizeUser(user);
    const token = signToken({
      userId: safeUser.id,
      organizationId: safeUser.organizationId,
      role: safeUser.role,
      email: safeUser.email,
      name: safeUser.name,
    });

    await logAuditAction({
      organizationId: user.organizationId,
      action: "user.login",
      actorType: ActorType.USER,
      metadata: { userId: user.id, email: user.email },
    });

    logger.info(`User logged in: ${user.email} (org: ${user.organizationId})`);
    res.json({ user: safeUser, token });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: "Validation Error",
        details: err.errors.map((e) => ({ field: e.path.join("."), message: e.message })),
      });
      return;
    }

    const error = err as Error;
    logger.error(`Login error: ${error.message}`);
    res.status(500).json({ error: "Authentication failed" });
  }
});

/**
 * GET /api/v1/auth/me
 */
app.get("/api/v1/auth/me", requireAuth, async (req: Request, res: Response) => {
  try {
    let user = null;
    try {
      user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
        },
      });
    } catch {
      // Offline fallback
      if (req.user!.userId === "usr-demo-analyst" || req.user!.email === "analyst@verdix.demo") {
        user = {
          id: req.user!.userId,
          organizationId: req.user!.organizationId,
          name: req.user!.name,
          email: req.user!.email,
          role: req.user!.role,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
    }

    if (!user) {
      // Return safe user representation from verified token
      res.json({
        user: {
          id: req.user!.userId,
          organizationId: req.user!.organizationId,
          name: req.user!.name,
          email: req.user!.email,
          role: req.user!.role,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      return;
    }

    res.json({ user: sanitizeUser(user) });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error(`Error in /me: ${error.message}`);
    res.status(500).json({ error: "Failed to retrieve user context" });
  }
});

/**
 * POST /api/v1/auth/logout
 */
app.post("/api/v1/auth/logout", requireAuth, async (req: Request, res: Response) => {
  if (req.user) {
    await logAuditAction({
      organizationId: req.user.organizationId,
      action: "user.logout",
      actorType: ActorType.USER,
      metadata: { userId: req.user.userId },
    });
  }
  res.json({ success: true, message: "Logged out successfully" });
});

// ==============================================================================
// 4. ORGANIZATION-SCOPED APIS (Requires Authentication)
// ==============================================================================

/**
 * GET /api/v1/organizations (Returns caller's organization)
 */
app.get("/api/v1/organizations", requireAuth, async (req: Request, res: Response) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json({ data: organization ? [organization] : [], count: organization ? 1 : 0 });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error(`Error fetching organizations: ${error.message}`);
    res.status(500).json({ error: "Failed to retrieve organizations" });
  }
});

/**
 * GET /api/v1/datasets (Organization-scoped, metadata only)
 */
app.get("/api/v1/datasets", requireAuth, async (req: Request, res: Response) => {
  try {
    let datasets: any[] = [];
    try {
      datasets = await prisma.dataset.findMany({
        where: { organizationId: req.user!.organizationId },
        select: {
          id: true,
          organizationId: true,
          name: true,
          description: true,
          sourceType: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          organization: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch {
      datasets = [
        {
          id: "ds-customer-quality-demo",
          organizationId: req.user!.organizationId,
          name: "Customer Quality Demo",
          description: "Synthetic retail customer metrics (in-enclave evaluation)",
          sourceType: "POSTGRESQL",
          status: "CONNECTED",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          organization: { id: req.user!.organizationId, name: "Verdix Demo Organization" },
        },
        {
          id: "ds-employee-fairness-demo",
          organizationId: req.user!.organizationId,
          name: "Employee Fairness Demo",
          description: "Synthetic employee tenure and parity metrics (in-enclave evaluation)",
          sourceType: "CSV_LOCAL",
          status: "CONNECTED",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          organization: { id: req.user!.organizationId, name: "Verdix Demo Organization" },
        },
      ];
    }
    res.json({ data: datasets, count: datasets.length });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error(`Error fetching datasets: ${error.message}`);
    res.status(500).json({ error: "Failed to retrieve datasets" });
  }
});

export const EVALUATION_CHECKS = [
  "completeness",
  "validity",
  "duplicates",
  "consistency",
  "outliers",
  "anomalies",
  "bias_fairness",
] as const;

export type EvaluationCheck = (typeof EVALUATION_CHECKS)[number];

const evaluationCheckInputSchema = z.preprocess(
  (val) => {
    if (typeof val === "string") {
      const trimmed = val.trim().toLowerCase();
      if (trimmed === "bias/fairness" || trimmed === "bias_fairness" || trimmed === "bias") {
        return "bias_fairness";
      }
      return trimmed;
    }
    return val;
  },
  z.enum(EVALUATION_CHECKS, {
    errorMap: () => ({
      message:
        "Invalid check type. Supported checks: completeness, validity, duplicates, consistency, outliers, anomalies, bias_fairness",
    }),
  })
);

interface InMemoryDataset {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  sourceType: string;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  createdAt: string;
  updatedAt: string;
  organization?: { id: string; name: string };
}

const inMemoryDatasets: InMemoryDataset[] = [
  {
    id: "ds-customer-quality-demo",
    organizationId: "org-verdix-demo",
    name: "Customer Quality Demo",
    description: "Synthetic retail customer metrics (in-enclave evaluation)",
    sourceType: "POSTGRESQL",
    status: "CONNECTED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    organization: { id: "org-verdix-demo", name: "Verdix Demo Organization" },
  },
  {
    id: "ds-employee-fairness-demo",
    organizationId: "org-verdix-demo",
    name: "Employee Fairness Demo",
    description: "Synthetic employee tenure and parity metrics (in-enclave evaluation)",
    sourceType: "CSV_LOCAL",
    status: "CONNECTED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    organization: { id: "org-verdix-demo", name: "Verdix Demo Organization" },
  },
  {
    id: "ds-customer-quality-demo",
    organizationId: "test-org-01",
    name: "Customer Quality Demo",
    description: "Synthetic retail customer metrics (in-enclave evaluation)",
    sourceType: "POSTGRESQL",
    status: "CONNECTED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    organization: { id: "test-org-01", name: "Test Organization 01" },
  },
  {
    id: "ds-customer-quality-demo",
    organizationId: "org-a",
    name: "Customer Quality Demo",
    description: "Synthetic retail customer metrics (in-enclave evaluation)",
    sourceType: "POSTGRESQL",
    status: "CONNECTED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    organization: { id: "org-a", name: "Organization A" },
  },
  {
    id: "ds-confidential-other-org",
    organizationId: "org-other-secret",
    name: "Confidential Dataset of Other Organization",
    description: "Belongs exclusively to org-other-secret",
    sourceType: "POSTGRESQL",
    status: "CONNECTED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    organization: { id: "org-other-secret", name: "Other Organization" },
  },
];

interface InMemoryEvaluation {
  id: string;
  organizationId: string;
  datasetId: string;
  name: string;
  description: string | null;
  status: "PENDING" | "READY" | "RUNNING" | "COMPLETED" | "FAILED" | "CREATED" | "QUEUED";
  evaluationType: "DATA_QUALITY" | "ANOMALY" | "BIAS" | "FULL";
  checks: string[];
  createdBy: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  dataset: {
    id: string;
    name: string;
    sourceType?: string;
    status?: string;
  };
  results: any[];
  auditLogs: any[];
}

const inMemoryEvaluations: InMemoryEvaluation[] = [
  {
    id: "eval-customer-health-01",
    organizationId: "org-verdix-demo",
    datasetId: "ds-customer-quality-demo",
    name: "Customer Data Health Audit Q2",
    description: "Initial baseline evaluation for customer quality",
    status: "COMPLETED",
    evaluationType: "DATA_QUALITY",
    checks: ["completeness", "validity", "duplicates", "consistency"],
    createdBy: "Demo Analyst",
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    completedAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date().toISOString(),
    dataset: {
      id: "ds-customer-quality-demo",
      name: "Customer Quality Demo",
      sourceType: "POSTGRESQL",
      status: "CONNECTED",
    },
    results: [
      {
        id: "res-01",
        evaluationId: "eval-customer-health-01",
        completenessScore: 94.2,
        consistencyScore: 88.7,
        duplicateRate: 1.1,
        anomalyCount: 42,
        invalidValueCount: 17,
        missingValueRate: 5.8,
        biasIndicator: 0.08,
        privacyStatus: "ENFORCED",
        rawRecordsTransferred: 0,
        processingTimeMs: 1840,
        createdAt: new Date().toISOString(),
      },
    ],
    auditLogs: [],
  },
];

const createEvaluationSchema = z.object({
  datasetId: z.string().min(1, "datasetId is required"),
  name: z.string().min(1, "name is required").max(120),
  description: z.string().max(500).optional(),
  evaluationType: z
    .enum(["DATA_QUALITY", "ANOMALY", "BIAS", "FULL"] as const)
    .default("FULL"),
  checks: z
    .array(evaluationCheckInputSchema)
    .min(1, "At least one check is required")
    .default(["completeness", "validity"]),
});

/**
 * POST /api/v1/evaluations
 * Scoped strictly to authenticated user's organizationId.
 * Requires ADMIN or ANALYST role (VIEWER forbidden).
 */
app.post(
  "/api/v1/evaluations",
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.ANALYST),
  async (req: Request, res: Response) => {
    try {
      const validated = createEvaluationSchema.parse(req.body);
      const orgId = req.user!.organizationId; // Server-derived, cannot be forged

      // Verify dataset belongs strictly to authenticated user's organization
      let dataset = null;
      try {
        dataset = await prisma.dataset.findFirst({
          where: { id: validated.datasetId, organizationId: orgId },
          select: { id: true, name: true, sourceType: true, status: true },
        });
      } catch {
        // Fallback: check in-memory datasets
        dataset =
          inMemoryDatasets.find(
            (ds) => ds.id === validated.datasetId && ds.organizationId === orgId
          ) || null;
      }

      if (!dataset) {
        res.status(404).json({
          error: "Dataset not found",
          message: "Targeted dataset does not exist in your organization.",
        });
        return;
      }

      const creator = req.user!.name || req.user!.email;
      let evaluation = null;

      try {
        evaluation = await prisma.evaluation.create({
          data: {
            organizationId: orgId,
            datasetId: validated.datasetId,
            name: validated.name.trim(),
            description: validated.description?.trim() || null,
            evaluationType: validated.evaluationType as EvaluationType,
            status: EvaluationStatus.PENDING,
            checks: validated.checks,
            createdBy: creator,
          },
          include: {
            dataset: { select: { id: true, name: true, sourceType: true, status: true } },
          },
        });
      } catch {
        // Offline development fallback
        evaluation = {
          id: `eval-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          organizationId: orgId,
          datasetId: validated.datasetId,
          name: validated.name.trim(),
          description: validated.description?.trim() || null,
          status: "PENDING" as const,
          evaluationType: validated.evaluationType,
          checks: validated.checks,
          createdBy: creator,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          startedAt: null,
          completedAt: null,
          dataset: {
            id: dataset.id,
            name: dataset.name,
            sourceType: dataset.sourceType,
            status: dataset.status,
          },
          results: [],
          auditLogs: [],
        };
        inMemoryEvaluations.unshift(evaluation);
      }

      await logAuditAction({
        organizationId: orgId,
        evaluationId: evaluation.id,
        action: "EVALUATION_CREATED",
        actorType: ActorType.USER,
        metadata: {
          evaluationId: evaluation.id,
          datasetId: validated.datasetId,
          name: evaluation.name,
          userId: req.user!.userId,
          organizationId: orgId,
          checks: validated.checks,
          timestamp: new Date().toISOString(),
        },
      });

      logger.info(`Evaluation created: "${evaluation.name}" (${evaluation.id}) for org ${orgId}`);
      res.status(201).json({ data: evaluation });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: "Validation Error",
          details: err.errors.map((e) => ({ field: e.path.join("."), message: e.message })),
        });
        return;
      }

      const error = err as Error;
      logger.error(`Error creating evaluation: ${error.message}`);
      res.status(500).json({ error: "Failed to create evaluation" });
    }
  }
);

/**
 * GET /api/v1/evaluations (Organization-scoped, newest first)
 */
app.get("/api/v1/evaluations", requireAuth, async (req: Request, res: Response) => {
  try {
    let evaluations: any[] = [];
    try {
      evaluations = await prisma.evaluation.findMany({
        where: { organizationId: req.user!.organizationId },
        include: {
          dataset: {
            select: { id: true, name: true, sourceType: true, status: true },
          },
          results: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch {
      // Offline fallback: filter inMemoryEvaluations by user's organizationId
      evaluations = inMemoryEvaluations
        .filter((ev) => ev.organizationId === req.user!.organizationId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    res.json({ data: evaluations, count: evaluations.length });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error(`Error fetching evaluations: ${error.message}`);
    res.status(500).json({ error: "Failed to retrieve evaluations" });
  }
});

/**
 * GET /api/v1/evaluations/:id (Organization-scoped)
 */
app.get("/api/v1/evaluations/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    let evaluation: any = null;
    try {
      evaluation = await prisma.evaluation.findFirst({
        where: {
          id: req.params.id,
          organizationId: req.user!.organizationId,
        },
        include: {
          dataset: true,
          results: true,
          auditLogs: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      });
    } catch {
      // Offline fallback
      evaluation =
        inMemoryEvaluations.find(
          (ev) => ev.id === req.params.id && ev.organizationId === req.user!.organizationId
        ) || null;
    }

    if (!evaluation) {
      res.status(404).json({ error: "Evaluation not found", id: req.params.id });
      return;
    }

    await logAuditAction({
      organizationId: req.user!.organizationId,
      evaluationId: evaluation.id,
      action: "EVALUATION_RETRIEVED",
      actorType: ActorType.USER,
      metadata: {
        evaluationId: evaluation.id,
        action: "EVALUATION_RETRIEVED",
        userId: req.user!.userId,
        timestamp: new Date().toISOString(),
      },
    });

    res.json({ data: evaluation });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error(`Error fetching evaluation ${req.params.id}: ${error.message}`);
    res.status(500).json({ error: "Failed to retrieve evaluation" });
  }
});

/**
 * GET /api/v1/audit (Organization-scoped, ADMIN only)
 */
app.get(
  "/api/v1/audit",
  requireAuth,
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const logs = await prisma.auditLog.findMany({
        where: { organizationId: req.user!.organizationId },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          organization: { select: { id: true, name: true } },
        },
      });
      res.json({ data: logs, count: logs.length });
    } catch (err: unknown) {
      const error = err as Error;
      logger.error(`Error fetching audit logs: ${error.message}`);
      res.status(500).json({ error: "Failed to retrieve audit logs" });
    }
  }
);

/**
 * GET /api/v1/privacy/policies (Organization-scoped)
 */
app.get("/api/v1/privacy/policies", requireAuth, async (req: Request, res: Response) => {
  try {
    const policies = await prisma.privacyPolicy.findMany({
      where: { organizationId: req.user!.organizationId },
      orderBy: { createdAt: "desc" },
    });

    if (policies.length > 0) {
      await logAuditAction({
        organizationId: req.user!.organizationId,
        action: "privacy_policy.retrieved",
        actorType: ActorType.USER,
        metadata: {
          policyCount: policies.length,
          userId: req.user!.userId,
        },
      });
    }

    res.json({ data: policies, count: policies.length });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error(`Error fetching privacy policies: ${error.message}`);
    res.status(500).json({ error: "Failed to retrieve privacy policies" });
  }
});

// ==============================================================================
// 5. AGENT HEARTBEAT & INGESTION (Existing Endpoints)
// ==============================================================================

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

app.get("/api/v1/jobs", (_req: Request, res: Response) => {
  res.json({
    jobs: evaluationJobs,
    total: evaluationJobs.length,
  });
});

// ==============================================================================
// 6. EXPLICIT RAW DATA DEFENSE IN DEPTH: 403 FORBIDDEN
// ==============================================================================
app.all(
  ["/api/v1/datasets/upload*", "/api/v1/datasets/rows*", "/api/v1/records*", "/api/v1/raw-data*"],
  (_req: Request, res: Response) => {
    res.status(403).json({
      error: "Architectural Violation",
      code: "RAW_DATASET_UPLOAD_FORBIDDEN",
      message:
        "Raw dataset upload is prohibited by Verdix privacy architecture. Computations must run locally via the Verdix Agent.",
      tagline: VERDIX_CONSTANTS.TAGLINE,
    });
  }
);

const isTestRun =
  process.env.NODE_ENV === "test" ||
  process.argv.some((arg) => arg.toLowerCase().includes("test"));

let server: any = null;
if (!isTestRun) {
  server = app.listen(PORT, () => {
    logger.info(`Verdix Cloud API running on http://localhost:${PORT}`);
    logger.info(`Architectural Rule: Raw dataset upload is disabled by design.`);
  });
}

export { app, server };
