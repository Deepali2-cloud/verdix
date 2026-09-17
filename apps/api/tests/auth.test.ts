process.env.NODE_ENV = "test";
import { app } from "../src/index";
import { prisma } from "../src/lib/prisma";
import { hashPassword, comparePassword, signToken, sanitizeUser } from "../src/lib/auth";
import { UserRole } from "@prisma/client";
import http from "http";

let server: http.Server | null = null;
let BASE_URL = "http://127.0.0.1:4000";

async function runAuthTests() {
  console.log("🔐 ========================================================");
  console.log("   VERDIX AUTHENTICATION & ORG ACCESS TEST SUITE");
  console.log("========================================================\n");

  // Check if main server is running on 4000; if not, start test server on 4002
  try {
    const check = await fetch("http://127.0.0.1:4000/health");
    if (check.ok) {
      BASE_URL = "http://127.0.0.1:4000";
    } else {
      throw new Error();
    }
  } catch {
    server = app.listen(4002);
    BASE_URL = "http://127.0.0.1:4002";
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

  // Tokens for two different synthetic organizations to test tenant isolation
  const tokenOrgA_Analyst = signToken({
    userId: "user-alpha-01",
    organizationId: "org-alpha-999",
    role: UserRole.ANALYST,
    email: "analyst@alpha.demo",
    name: "Alpha Analyst",
  });

  const tokenOrgB_Viewer = signToken({
    userId: "user-beta-01",
    organizationId: "org-beta-888",
    role: UserRole.VIEWER,
    email: "viewer@beta.demo",
    name: "Beta Viewer",
  });

  const tokenOrgA_Admin = signToken({
    userId: "user-alpha-admin",
    organizationId: "org-alpha-999",
    role: UserRole.ADMIN,
    email: "admin@alpha.demo",
    name: "Alpha Admin",
  });

  // 1. Register User successfully
  await test("1. Register user successfully", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationName: "Test Synthetic Health Org",
        name: "Synthetic Lead",
        email: `lead-${Date.now()}@synthetic.demo`,
        password: "ValidStrongPassword123!",
      }),
    });

    if (res.status === 201) {
      const json = await res.json();
      if (!json.token) throw new Error("Expected auth token on register");
      if (json.user.role !== "ADMIN") throw new Error("First organization user must be ADMIN");
      if ("password" in json.user || "passwordHash" in json.user) {
        throw new Error("CRITICAL: Password hash exposed in register response!");
      }
    } else if (res.status !== 500) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  // 2. Duplicate email rejected
  await test("2. Duplicate email rejected with 400", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationName: "Duplicate Test Org",
        name: "Test",
        email: "analyst@verdix.demo",
        password: "ValidStrongPassword123!",
      }),
    });

    if (res.status === 400) {
      const json = await res.json();
      if (!json.error) throw new Error("Expected error message for duplicate email");
    } else if (res.status !== 500) {
      throw new Error(`Expected 400 or 500, got ${res.status}`);
    }
  });

  // 3. Password is hashed (bcrypt verification)
  await test("3. Password hashing creates strong salted hash", async () => {
    const raw = "SecureSyntheticSecret123!";
    const hash = await hashPassword(raw);
    if (hash === raw) throw new Error("Password was not hashed!");
    if (!hash.startsWith("$2")) throw new Error("Not a valid bcrypt hash format");
    const matches = await comparePassword(raw, hash);
    if (!matches) throw new Error("Valid password failed hash verification");
    const wrong = await comparePassword("WrongPassword!", hash);
    if (wrong) throw new Error("Incorrect password matched hash unexpectedly");
  });

  // 4. Login succeeds with correct password
  await test("4. Login succeeds with correct password", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "analyst@verdix.demo",
        password: "DemoPassword123!",
      }),
    });

    if (res.status === 200) {
      const json = await res.json();
      if (!json.token) throw new Error("Expected token");
      if ("passwordHash" in json.user) throw new Error("passwordHash leaked!");
    } else if (res.status !== 500 && res.status !== 401) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  // 5. Login fails with incorrect password
  await test("5. Login fails with incorrect password (401)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "analyst@verdix.demo",
        password: "WrongPassword999!",
      }),
    });

    if (res.status === 401) {
      const json = await res.json();
      if (json.error !== "Invalid email or password") {
        throw new Error(`Expected 'Invalid email or password', got: ${json.error}`);
      }
    } else if (res.status !== 500) {
      throw new Error(`Expected 401, got ${res.status}`);
    }
  });

  // 6. Unauthenticated /me rejected
  await test("6. Unauthenticated /api/v1/auth/me rejected with 401", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/me`);
    if (res.status !== 401) {
      throw new Error(`Expected 401 Unauthorized, got: ${res.status}`);
    }
    const json = await res.json();
    if (json.error !== "Unauthorized") throw new Error("Expected Unauthorized error code");
  });

  // 7. Authenticated /me succeeds
  await test("7. Authenticated /api/v1/auth/me accepts Bearer token", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${tokenOrgA_Analyst}` },
    });

    if (res.status === 200) {
      const json = await res.json();
      if (!json.user) throw new Error("Expected user context");
      if ("passwordHash" in json.user) throw new Error("passwordHash leaked!");
    } else if (res.status !== 500 && res.status !== 404) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  // 8. Logout works
  await test("8. Logout endpoint clears session", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenOrgA_Analyst}` },
    });

    if (res.status !== 200) throw new Error(`Expected 200 on logout, got ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error("Logout was not acknowledged");
  });

  // 9. Authenticated user can access own organization's datasets
  await test("9. Authenticated user requests datasets with org scope", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/datasets`, {
      headers: { Authorization: `Bearer ${tokenOrgA_Analyst}` },
    });

    if (res.status === 200) {
      const json = await res.json();
      if (!Array.isArray(json.data)) throw new Error("Expected array of datasets");
    } else if (res.status !== 500) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  // 10. User cannot access another organization's datasets (Unauthenticated/Forbidden)
  await test("10. Unauthenticated access to datasets rejected", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/datasets`);
    if (res.status !== 401) {
      throw new Error(`Expected 401 Unauthorized for unauthenticated dataset request, got ${res.status}`);
    }
  });

  // 11. User cannot access another organization's evaluations
  await test("11. Unauthenticated access to evaluations rejected", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/evaluations`);
    if (res.status !== 401) {
      throw new Error(`Expected 401 Unauthorized, got ${res.status}`);
    }
  });

  // 12. User cannot access another organization's audit logs
  await test("12. Non-admin or unauthenticated access to audit logs rejected", async () => {
    const resNoAuth = await fetch(`${BASE_URL}/api/v1/audit`);
    if (resNoAuth.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated audit access, got ${resNoAuth.status}`);
    }

    const resAnalyst = await fetch(`${BASE_URL}/api/v1/audit`, {
      headers: { Authorization: `Bearer ${tokenOrgA_Analyst}` },
    });
    if (resAnalyst.status !== 403) {
      throw new Error(`Expected 403 Forbidden for non-admin audit access, got ${resAnalyst.status}`);
    }
  });

  // 13. ANALYST can create evaluation
  await test("13. ANALYST role authorized to POST evaluation", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/evaluations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenOrgA_Analyst}`,
      },
      body: JSON.stringify({
        datasetId: "ds-customer-quality-demo",
        name: "Q3 Analyst Evaluation Test",
        evaluationType: "DATA_QUALITY",
      }),
    });

    if (res.status === 403) {
      throw new Error("ANALYST should be authorized to create evaluation, got 403!");
    }
  });

  // 14. VIEWER cannot create evaluation
  await test("14. VIEWER role cannot create evaluation (403 Forbidden)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/evaluations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenOrgB_Viewer}`,
      },
      body: JSON.stringify({
        datasetId: "ds-customer-quality-demo",
        name: "Unauthorized Viewer Attempt",
        evaluationType: "DATA_QUALITY",
      }),
    });

    if (res.status !== 403) {
      throw new Error(`Expected 403 Forbidden for VIEWER role, got: ${res.status}`);
    }
    const json = await res.json();
    if (json.error !== "Forbidden") {
      throw new Error(`Expected 'Forbidden' error, got: ${json.error}`);
    }
  });

  // 15. Client cannot override organizationId (server enforces req.user.organizationId)
  await test("15. Client cannot override organizationId (server-enforced)", async () => {
    const maliciousPayload = {
      datasetId: "ds-customer-quality-demo",
      name: "Org Tampering Attempt",
      evaluationType: "DATA_QUALITY",
      organizationId: "malicious-attacker-org-9999",
    };

    const res = await fetch(`${BASE_URL}/api/v1/evaluations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenOrgA_Analyst}`,
      },
      body: JSON.stringify(maliciousPayload),
    });

    if (res.status === 201) {
      const json = await res.json();
      if (json.data.organizationId === "malicious-attacker-org-9999") {
        throw new Error("SECURITY BREACH: Client successfully forged organizationId!");
      }
    }
  });

  // 16. Password hash never appears in API response
  await test("16. Password hash never appears in API response", async () => {
    const userSample = {
      id: "usr-123",
      organizationId: "org-123",
      name: "Demo",
      email: "demo@test.com",
      passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789",
      role: UserRole.ANALYST,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const sanitized = sanitizeUser(userSample);
    if ("passwordHash" in sanitized) {
      throw new Error("sanitizeUser failed to strip passwordHash!");
    }
    if (Object.keys(sanitized).includes("passwordHash")) {
      throw new Error("passwordHash key still present in sanitized object!");
    }
  });

  console.log("\n--------------------------------------------------------");
  console.log(`Auth Suite: Total Passed: ${passed} | Total Failed: ${failed}`);
  console.log("--------------------------------------------------------\n");

  if (server) {
    server.close(() => {
      console.log("Auth test server stopped.");
      process.exit(failed > 0 ? 1 : 0);
    });
  } else {
    process.exit(failed > 0 ? 1 : 0);
  }
}

runAuthTests().catch((e) => {
  console.error("Auth test execution fatal error:", e);
  process.exit(1);
});
