#!/usr/bin/env node

/**
 * VERDIX Unified Health-Check Script
 * Verifies that the monorepo packages, API, Web, and Python agent foundations are sound.
 */

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("\n🔍 ========================================================");
console.log("   VERDIX FOUNDATION UNIFIED HEALTH CHECK");
console.log("   Tagline: \"Don't share your data. Share the insight.\"");
console.log("========================================================\n");

let failures = 0;

function runStep(name, command, cwd = rootDir) {
  process.stdout.write(`[TEST] ${name} ... `);
  try {
    const output = execSync(command, { cwd, stdio: "pipe", encoding: "utf-8" });
    console.log("✅ PASSED");
    return output;
  } catch (error) {
    console.log("❌ FAILED");
    console.error(`       Error: ${error.message}`);
    if (error.stdout) console.error(`       Stdout: ${error.stdout.toString().trim()}`);
    if (error.stderr) console.error(`       Stderr: ${error.stderr.toString().trim()}`);
    failures++;
    return null;
  }
}

// 1. Check Python Agent Health
runStep("Python Agent Environment & Invariant Policy Check", "python agent/verdix_agent/cli.py --health-check");

// 2. Check Python Agent Unit Tests
runStep("Python Agent Unit Tests", "python -m unittest discover -s agent/tests");

// 3. TypeScript Compilation on Packages
runStep("Shared Packages Build (types, shared, evaluation-engine)", "npm run build --workspace=@verdix/types --workspace=@verdix/shared --workspace=@verdix/evaluation-engine");

// 4. API Build Check
runStep("Cloud API TypeScript Build", "npm run build --workspace=@verdix/api");

console.log("\n--------------------------------------------------------");
if (failures === 0) {
  console.log("🎉 ALL VERDIX FOUNDATION CHECKS PASSED!");
  console.log("   - Packages & API compiled cleanly.");
  console.log("   - Local Agent privacy guardrails and engine are valid.");
  console.log("   - Monorepo foundation is ready for execution.");
  console.log("--------------------------------------------------------\n");
  process.exit(0);
} else {
  console.error(`⚠️  ${failures} check(s) failed. Please see diagnostic output above.`);
  console.log("--------------------------------------------------------\n");
  process.exit(1);
}
