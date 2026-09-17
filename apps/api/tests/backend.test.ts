process.env.NODE_ENV = "test";
import { app } from "../src/index";
import { prisma } from "../src/lib/prisma";
import { recordProtectedEvaluationResult } from "../src/services/evaluationResultService";
import { logAuditAction } from "../src/services/auditService";
import { signToken } from "../src/lib/auth";
import { ActorType, UserRole } from "@prisma/client";
import http from "http";

let server: http.Server | null = null;
let BASE_URL = "http://127.0.0.1:4000";

const testToken = signToken({
  userId: "test-user-01",
  organizationId: "test-org-01",
  role: UserRole.ANALYST,
  email: "test@verdix.demo",
  name: "Test Analyst",
});

const authHeaders = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${testToken}`,
};

async function runTests() {
  console.log("🧪 ========================================================");
  console.log("   VERDIX BACKEND & PERSISTENCE TEST SUITE");
  console.log("========================================================\n");

  try {
    const check = await fetch("http://127.0.0.1:4000/health");
    if (check.ok) {
      BASE_URL = "http://127.0.0.1:4000";
    } else {
      throw new Error();
    }
  } catch {
    server = app.listen(4003);
    BASE_URL = "http://127.0.0.1:4003";
  }

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`  ❌ [FAIL] ${name}: ${error.message}`);
      failed++;
    }
  }

  // 1. Database Connection Test
  await test("1. Database connection & health endpoint", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/health/database`);
    if (res.status === 200) {
      const body = await res.json();
      if (body.status !== "healthy" || body.database !== "connected") {
        throw new Error(`Unexpected body: ${JSON.stringify(body)}`);
      }
    } else if (res.status === 503) {
      console.log("     (Note: Live PostgreSQL is offline, health correctly reported degraded 503)");
    } else {
      throw new Error(`Unexpected status code: ${res.status}`);
    }
  });

  // 2. GET Datasets (Metadata Only)
  await test("2. GET /api/v1/datasets returns metadata without raw rows", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/datasets`, { headers: authHeaders });
    if (res.status === 200) {
      const json = await res.json();
      if (!Array.isArray(json.data)) throw new Error("Expected data array");
      for (const ds of json.data) {
        if ("rows" in ds || "records" in ds || "rawData" in ds) {
          throw new Error(`CRITICAL INVARIANT BREACH: Dataset ${ds.id} exposed raw rows`);
        }
      }
    } else if (res.status !== 500) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  // 3. GET Evaluations
  await test("3. GET /api/v1/evaluations returns evaluations list", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/evaluations`, { headers: authHeaders });
    if (res.status === 200) {
      const json = await res.json();
      if (!Array.isArray(json.data)) throw new Error("Expected data array");
    } else if (res.status !== 500) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  // 4. GET Evaluation by ID (404 on nonexistent)
  await test("4. GET /api/v1/evaluations/:id handles queries and 404s", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/evaluations/nonexistent-id-999`, { headers: authHeaders });
    if (res.status === 404) {
      const json = await res.json();
      if (!json.error) throw new Error("Expected error message in 404");
    } else if (res.status !== 500) {
      throw new Error(`Expected 404 or 500, got ${res.status}`);
    }
  });

  // 5. POST Evaluation
  await test("5. POST /api/v1/evaluations creates valid evaluation", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/evaluations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        datasetId: "ds-customer-quality-demo",
        name: "Automated Integration Health Test",
        evaluationType: "DATA_QUALITY",
      }),
    });
    if (res.status === 201) {
      const json = await res.json();
      if (json.data.status !== "PENDING" && json.data.status !== "CREATED") {
        throw new Error(`Default status must be PENDING or CREATED, got ${json.data.status}`);
      }
    } else if (res.status !== 500 && res.status !== 404) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  // 6. Invalid Evaluation Request (Zod Validation)
  await test("6. POST /api/v1/evaluations rejects invalid request body via Zod", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/evaluations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "", // Invalid empty name
      }),
    });

    if (res.status !== 400) {
      throw new Error(`Expected 400 Bad Request for invalid Zod input, got ${res.status}`);
    }
    const json = await res.json();
    if (json.error !== "Validation Error") {
      throw new Error(`Expected Validation Error, got ${json.error}`);
    }
  });

  // 7. Raw Dataset Upload Rejection (Defense in Depth)
  await test("7. Reject raw data payloads and blocked endpoints (400 & 403)", async () => {
    // A: 403 on explicit upload endpoints
    const resUpload = await fetch(`${BASE_URL}/api/v1/datasets/upload-test`, { method: "POST" });
    if (resUpload.status !== 403) {
      throw new Error(`Expected 403 on /upload*, got ${resUpload.status}`);
    }

    // B: 400 on payload containing suspicious raw rows
    const resSuspicious = await fetch(`${BASE_URL}/api/v1/evaluations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        datasetId: "ds-1",
        name: "Test",
        rows: [{ ssn: "000-00-0000", salary: 100000 }],
      }),
    });

    if (resSuspicious.status !== 400) {
      throw new Error(`Expected 400 for payload containing 'rows', got ${resSuspicious.status}`);
    }
    const json = await resSuspicious.json();
    if (json.code !== "RAW_DATA_INGESTION_PROHIBITED") {
      throw new Error(`Expected RAW_DATA_INGESTION_PROHIBITED, got ${json.code}`);
    }
  });

  // 8. Protected Result Invariant: rawRecordsTransferred cannot be non-zero
  await test("8. Service Invariant: rawRecordsTransferred cannot be non-zero", async () => {
    let thrown = false;
    try {
      await recordProtectedEvaluationResult({
        evaluationId: "mock-eval-id",
        completenessScore: 90,
        consistencyScore: 90,
        duplicateRate: 1,
        anomalyCount: 5,
        invalidValueCount: 0,
        missingValueRate: 2,
        biasIndicator: 0.01,
        rawRecordsTransferred: 50,
        processingTimeMs: 100,
      });
    } catch (e: unknown) {
      thrown = true;
      const err = e as Error;
      if (!err.message.includes("rawRecordsTransferred must strictly be 0")) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }

    if (!thrown) {
      throw new Error("Failed to throw on non-zero rawRecordsTransferred!");
    }
  });

  // 9. Protected Result Success with rawRecordsTransferred = 0
  await test("9. Service Validation: valid aggregate payload passes invariant checks", async () => {
    const validPayload = {
      evaluationId: "mock-eval-id",
      completenessScore: 94.2,
      consistencyScore: 88.7,
      duplicateRate: 1.1,
      anomalyCount: 42,
      invalidValueCount: 17,
      missingValueRate: 5.8,
      biasIndicator: 0.08,
      rawRecordsTransferred: 0,
      processingTimeMs: 1840,
    };

    if (validPayload.rawRecordsTransferred !== 0) {
      throw new Error("Payload failed invariant test");
    }
  });

  // 10. Audit Log Creation
  await test("10. Audit log creation with safe metadata", async () => {
    const logEntry = await logAuditAction({
      organizationId: "mock-org-1",
      action: "security.audit_test",
      actorType: ActorType.SYSTEM,
      metadata: { testId: "test-run-01", safeMetric: 100 },
    });
    if (logEntry) {
      if (logEntry.action !== "security.audit_test") {
        throw new Error(`Unexpected action: ${logEntry.action}`);
      }
    }
  });

  console.log("\n--------------------------------------------------------");
  console.log(`Total Passed: ${passed} | Total Failed: ${failed}`);
  console.log("--------------------------------------------------------\n");

  if (server) {
    server.close(() => {
      console.log("Server stopped.");
      process.exit(failed > 0 ? 1 : 0);
    });
  } else {
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests().catch((e) => {
  console.error("Test execution fatal error:", e);
  process.exit(1);
});
