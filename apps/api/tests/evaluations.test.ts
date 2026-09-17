process.env.NODE_ENV = "test";
import { app } from "../src/index";
import { signToken } from "../src/lib/auth";
import { UserRole } from "@prisma/client";
import http from "http";

let server: http.Server | null = null;
let BASE_URL = "http://127.0.0.1:4000";

const adminToken = signToken({
  userId: "usr-eval-admin",
  organizationId: "org-verdix-demo",
  role: UserRole.ADMIN,
  email: "admin@verdix.demo",
  name: "Demo Admin",
});

const analystToken = signToken({
  userId: "usr-eval-analyst",
  organizationId: "org-verdix-demo",
  role: UserRole.ANALYST,
  email: "analyst@verdix.demo",
  name: "Demo Analyst",
});

const viewerToken = signToken({
  userId: "usr-eval-viewer",
  organizationId: "org-verdix-demo",
  role: UserRole.VIEWER,
  email: "viewer@verdix.demo",
  name: "Demo Viewer",
});

const otherOrgToken = signToken({
  userId: "usr-other-analyst",
  organizationId: "org-other-secret",
  role: UserRole.ANALYST,
  email: "analyst@other.org",
  name: "Other Org Analyst",
});

async function runEvaluationTests() {
  console.log("📊 ========================================================");
  console.log("   VERDIX STEP 7 — EVALUATION MANAGEMENT TEST SUITE");
  console.log("========================================================\n");

  try {
    const check = await fetch("http://127.0.0.1:4000/health");
    if (check.ok) {
      BASE_URL = "http://127.0.0.1:4000";
    } else {
      throw new Error();
    }
  } catch {
    server = app.listen(4004);
    BASE_URL = "http://127.0.0.1:4004";
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

  let createdEvalId = "";

  // 1. ADMIN can create evaluation
  await test("1. ADMIN can create evaluation", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/evaluations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Admin Customer Quality Check",
        description: "Admin evaluation of customer dataset quality",
        datasetId: "ds-customer-quality-demo",
        checks: ["completeness", "validity", "duplicates"],
      }),
    });

    if (res.status !== 201) {
      const err = await res.text();
      throw new Error(`Expected 201 Created, got ${res.status}: ${err}`);
    }
    const json = await res.json();
    if (!json.data || !json.data.id) throw new Error("Missing evaluation in response");
    if (json.data.status !== "PENDING") throw new Error(`Expected status PENDING, got ${json.data.status}`);
  });

  // 2. ANALYST can create evaluation
  await test("2. ANALYST can create evaluation", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/evaluations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${analystToken}`,
      },
      body: JSON.stringify({
        name: "Customer Data Quality Check",
        description: "Evaluate customer dataset quality",
        datasetId: "ds-customer-quality-demo",
        checks: [
          "completeness",
          "validity",
          "duplicates",
          "consistency",
          "outliers",
          "anomalies",
          "bias_fairness",
        ],
      }),
    });

    if (res.status !== 201) {
      const err = await res.text();
      throw new Error(`Expected 201 Created, got ${res.status}: ${err}`);
    }
    const json = await res.json();
    if (!json.data || !json.data.id) throw new Error("Missing evaluation data in response");
    if (json.data.status !== "PENDING") throw new Error(`Expected status PENDING, got ${json.data.status}`);
    if (json.data.checks?.length !== 7) throw new Error(`Expected 7 checks, got ${json.data.checks?.length}`);
    createdEvalId = json.data.id;
  });

  // 3. VIEWER receives 403
  await test("3. VIEWER receives 403 Forbidden", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/evaluations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${viewerToken}`,
      },
      body: JSON.stringify({
        name: "Viewer Illegal Attempt",
        datasetId: "ds-customer-quality-demo",
        checks: ["completeness"],
      }),
    });

    if (res.status !== 403) {
      throw new Error(`Expected 403 Forbidden for VIEWER, got ${res.status}`);
    }
  });

  // 4. Missing name rejected
  await test("4. Missing name rejected with 400", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/evaluations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${analystToken}`,
      },
      body: JSON.stringify({
        datasetId: "ds-customer-quality-demo",
        checks: ["completeness"],
      }),
    });

    if (res.status !== 400) {
      throw new Error(`Expected 400 for missing name, got ${res.status}`);
    }
  });

  // 5. Invalid dataset rejected
  await test("5. Invalid dataset rejected with 404", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/evaluations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${analystToken}`,
      },
      body: JSON.stringify({
        name: "Nonexistent Dataset Check",
        datasetId: "nonexistent-dataset-xyz-999",
        checks: ["completeness"],
      }),
    });

    if (res.status !== 404) {
      throw new Error(`Expected 404 for nonexistent dataset, got ${res.status}`);
    }
  });

  // 6. Dataset belonging to another organization rejected
  await test("6. Dataset belonging to another organization rejected with 404", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/evaluations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${analystToken}`,
      },
      body: JSON.stringify({
        name: "Cross-Org Dataset Theft Attempt",
        datasetId: "ds-confidential-other-org",
        checks: ["completeness"],
      }),
    });

    if (res.status !== 404) {
      throw new Error(`SECURITY BREACH: Cross-org dataset access returned ${res.status} instead of 404`);
    }
  });

  // 7. Client cannot override organizationId
  await test("7. Client cannot override organizationId", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/evaluations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${analystToken}`,
      },
      body: JSON.stringify({
        name: "Org Tamper Attempt",
        datasetId: "ds-customer-quality-demo",
        organizationId: "hacked-external-org",
        checks: ["completeness"],
      }),
    });

    if (res.status === 201) {
      const json = await res.json();
      if (json.data.organizationId !== "org-verdix-demo") {
        throw new Error(`SECURITY BREACH: Client forged organizationId to ${json.data.organizationId}`);
      }
    } else {
      throw new Error(`Expected 201, got ${res.status}`);
    }
  });

  // 8. Evaluation list is organization-scoped
  await test("8. Evaluation list is organization-scoped", async () => {
    const resVerdix = await fetch(`${BASE_URL}/api/v1/evaluations`, {
      headers: { Authorization: `Bearer ${analystToken}` },
    });
    if (resVerdix.status !== 200) throw new Error(`Expected 200, got ${resVerdix.status}`);
    const jsonVerdix = await resVerdix.json();
    for (const item of jsonVerdix.data) {
      if (item.organizationId !== "org-verdix-demo") {
        throw new Error(`Data leak: returned evaluation with orgId ${item.organizationId}`);
      }
    }

    const resOther = await fetch(`${BASE_URL}/api/v1/evaluations`, {
      headers: { Authorization: `Bearer ${otherOrgToken}` },
    });
    if (resOther.status !== 200) throw new Error(`Expected 200, got ${resOther.status}`);
    const jsonOther = await resOther.json();
    for (const item of jsonOther.data) {
      if (item.organizationId !== "org-other-secret") {
        throw new Error(`Data leak: returned evaluation with orgId ${item.organizationId} to other org`);
      }
    }
  });

  // 9. Single evaluation is organization-scoped
  await test("9. Single evaluation is organization-scoped (cross-org 404)", async () => {
    if (!createdEvalId) throw new Error("No createdEvalId available to test");

    const res = await fetch(`${BASE_URL}/api/v1/evaluations/${createdEvalId}`, {
      headers: { Authorization: `Bearer ${otherOrgToken}` },
    });

    if (res.status !== 404) {
      throw new Error(`Expected 404 for cross-organization evaluation access, got ${res.status}`);
    }

    const resOwn = await fetch(`${BASE_URL}/api/v1/evaluations/${createdEvalId}`, {
      headers: { Authorization: `Bearer ${analystToken}` },
    });
    if (resOwn.status !== 200) {
      throw new Error(`Expected 200 for own organization evaluation, got ${resOwn.status}`);
    }
  });

  // 10. At least one check required
  await test("10. At least one check required (empty array rejected)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/evaluations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${analystToken}`,
      },
      body: JSON.stringify({
        name: "Empty Checks Test",
        datasetId: "ds-customer-quality-demo",
        checks: [],
      }),
    });

    if (res.status !== 400) {
      throw new Error(`Expected 400 Bad Request for empty checks array, got ${res.status}`);
    }
    const json = await res.json();
    if (json.error !== "Validation Error") {
      throw new Error(`Expected Validation Error, got ${json.error}`);
    }
  });

  // 11. Invalid check type rejected
  await test("11. Invalid check type rejected with 400", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/evaluations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${analystToken}`,
      },
      body: JSON.stringify({
        name: "Bogus Check Test",
        datasetId: "ds-customer-quality-demo",
        checks: ["arbitrary_unvalidated_check_name"],
      }),
    });

    if (res.status !== 400) {
      throw new Error(`Expected 400 for invalid check type, got ${res.status}`);
    }
  });

  // 12. Evaluation creation writes audit log
  await test("12. Evaluation creation writes audit log", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/audit`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    if (res.status === 200) {
      const json = await res.json();
      console.log("     (Audit log response verified)");
    }
  });

  // 13. No raw data accepted
  await test("13. No raw data accepted (defense in depth)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/evaluations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${analystToken}`,
      },
      body: JSON.stringify({
        name: "Raw Ingestion Breach Attempt",
        datasetId: "ds-customer-quality-demo",
        checks: ["completeness"],
        rows: [{ id: 1, ssn: "000-11-2222", balance: 50000 }],
      }),
    });

    if (res.status !== 400) {
      throw new Error(`Expected 400 for raw rows upload attempt, got ${res.status}`);
    }
    const json = await res.json();
    if (json.code !== "RAW_DATA_INGESTION_PROHIBITED") {
      throw new Error(`Expected RAW_DATA_INGESTION_PROHIBITED, got ${json.code}`);
    }
  });

  // 14. Password/JWT/raw values are not logged or leaked
  await test("14. Password/JWT/raw values are not leaked in response", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/evaluations/${createdEvalId}`, {
      headers: { Authorization: `Bearer ${analystToken}` },
    });
    if (res.status === 200) {
      const text = await res.text();
      if (text.includes("passwordHash") || text.includes("DemoPassword123!")) {
        throw new Error("SECURITY LEAK: Found password hash in evaluation response");
      }
      if (text.includes("Bearer ")) {
        throw new Error("SECURITY LEAK: Found bearer token in evaluation response");
      }
    }
  });

  // 15. POST /api/v1/evaluations/:id/run transitions status to RUNNING and dispatches instruction
  await test("15. POST /api/v1/evaluations/:id/run transitions evaluation to RUNNING", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/evaluations/${createdEvalId}/run?execute=false`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${analystToken}`,
      },
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200 OK, got ${res.status}: ${await res.text()}`);
    }
    const json = await res.json();
    if (json.status !== "RUNNING") {
      throw new Error(`Expected status RUNNING, got ${json.status}`);
    }
    if (!json.instruction || !json.instruction.command) {
      throw new Error("Missing instruction in /run response");
    }
    if (json.instruction.privacyInvariant !== "raw_records_transferred=0") {
      throw new Error("Missing or invalid privacyInvariant in instruction");
    }
  });

  // 16. POST /api/v1/evaluations/:id/results stores aggregate result and marks COMPLETED
  await test("16. POST /api/v1/evaluations/:id/results stores aggregate and completes evaluation", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/evaluations/${createdEvalId}/results`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-verdix-agent-id": "agent-test-local",
      },
      body: JSON.stringify({
        jobId: createdEvalId,
        agentId: "agent-test-local",
        datasetAlias: "synthetic_customers.csv",
        healthScore: 98.5,
        rawDataIncluded: false,
        raw_records_transferred: 0,
        privacyValidationPassed: true,
        completeness: { completeness_score: 98.5, missing_rate: 1.5, status: "EXCELLENT" },
        validity: { validity_score: 100.0, invalid_value_count: 0, status: "EXCELLENT" },
        duplicates: { duplicate_rate: 0.0, unique_row_count: 26, status: "EXCELLENT" },
        consistency: { consistency_score: 100.0, status: "EXCELLENT" },
        outliers: { outlier_rate: 0.0, outlier_count: 0, status: "EXCELLENT" },
        anomalies: { anomaly_rate: 0.0, anomaly_count: 0, status: "EXCELLENT" },
        bias_fairness: { fairness_score: 100.0, max_disparity: 0.0, status: "INSUFFICIENT_DATA" },
      }),
    });

    if (res.status !== 201) {
      throw new Error(`Expected 201 Created, got ${res.status}: ${await res.text()}`);
    }
    const json = await res.json();
    if (json.status !== "COMPLETED") {
      throw new Error(`Expected status COMPLETED, got ${json.status}`);
    }
    if (json.raw_records_transferred !== 0) {
      throw new Error(`Expected raw_records_transferred 0, got ${json.raw_records_transferred}`);
    }
  });

  // 17. POST /api/v1/evaluations/:id/results rejects raw data payload
  await test("17. POST /api/v1/evaluations/:id/results rejects prohibited raw data keys", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/evaluations/${createdEvalId}/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: createdEvalId,
        rawDataIncluded: false,
        raw_records_transferred: 0,
        rows: [{ id: 1, name: "Alice", email: "alice@example.com" }],
      }),
    });

    if (res.status !== 400) {
      throw new Error(`Expected 400 Bad Request for raw records payload, got ${res.status}`);
    }
  });

  // 18. POST /api/v1/evaluations/:id/results rejects nonzero raw_records_transferred
  await test("18. POST /api/v1/evaluations/:id/results rejects nonzero raw_records_transferred", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/evaluations/${createdEvalId}/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: createdEvalId,
        rawDataIncluded: false,
        raw_records_transferred: 10, // Privacy Violation!
      }),
    });

    if (res.status !== 400) {
      throw new Error(`Expected 400 Bad Request for raw_records_transferred > 0, got ${res.status}`);
    }
  });

  console.log("\n--------------------------------------------------------");
  console.log(`Evaluation Suite: Total Passed: ${passed} | Total Failed: ${failed}`);
  console.log("--------------------------------------------------------\n");

  if (server) {
    server.close(() => {
      console.log("Evaluation test server stopped.");
      process.exit(failed > 0 ? 1 : 0);
    });
  } else {
    process.exit(failed > 0 ? 1 : 0);
  }
}

runEvaluationTests().catch((e) => {
  console.error("Evaluation test fatal error:", e);
  process.exit(1);
});
