import { PrismaClient, UserRole, DatasetStatus, EvaluationStatus, EvaluationType, PrivacyStatus, ActorType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DEMO_PASSWORD_HASH = bcrypt.hashSync("DemoPassword123!", 10);

export async function seed() {
  console.log("🌱 Seeding Verdix database with synthetic demonstration data...");

  // 1. Create or upsert Demo Organization
  const org = await prisma.organization.upsert({
    where: { slug: "verdix-demo" },
    update: {},
    create: {
      name: "Verdix Demo Organization",
      slug: "verdix-demo",
    },
  });
  console.log(`✅ Organization created/verified: ${org.name} (${org.id})`);

  // 2. Create or upsert Demo User (Analyst)
  const user = await prisma.user.upsert({
    where: { email: "analyst@verdix.demo" },
    update: {
      passwordHash: DEMO_PASSWORD_HASH,
    },
    create: {
      organizationId: org.id,
      name: "Demo Analyst",
      email: "analyst@verdix.demo",
      passwordHash: DEMO_PASSWORD_HASH,
      role: UserRole.ANALYST,
    },
  });
  console.log(`✅ Demo User created: ${user.name} (${user.email})`);

  // 3. Create Default Privacy Policy (Strict Zero Raw-Data Invariants)
  const existingPolicy = await prisma.privacyPolicy.findFirst({
    where: { organizationId: org.id, name: "Default Enterprise Enclave Policy" },
  });

  const policy =
    existingPolicy ??
    (await prisma.privacyPolicy.create({
      data: {
        organizationId: org.id,
        name: "Default Enterprise Enclave Policy",
        allowAggregates: true,
        allowQualityScores: true,
        allowMissingRates: true,
        allowAnomalyCounts: true,
        allowBiasIndicators: true,
        allowIndividualRecords: false, // Architectural Rule: Strictly False
        allowRawDataset: false,        // Architectural Rule: Strictly False
      },
    }));
  console.log(`✅ Privacy Policy verified: ${policy.name}`);

  // 4. Create 2 Synthetic Datasets (Metadata Only, ZERO raw records)
  const customerDataset = await prisma.dataset.upsert({
    where: { id: "ds-customer-quality-demo" },
    update: {},
    create: {
      id: "ds-customer-quality-demo",
      organizationId: org.id,
      name: "Customer Quality Demo",
      description: "Synthetic retail customer metrics (in-enclave evaluation)",
      sourceType: "POSTGRESQL",
      status: DatasetStatus.CONNECTED,
    },
  });

  const employeeDataset = await prisma.dataset.upsert({
    where: { id: "ds-employee-fairness-demo" },
    update: {},
    create: {
      id: "ds-employee-fairness-demo",
      organizationId: org.id,
      name: "Employee Fairness Demo",
      description: "Synthetic employee tenure and parity metrics (in-enclave evaluation)",
      sourceType: "CSV_LOCAL",
      status: DatasetStatus.CONNECTED,
    },
  });
  console.log(`✅ Datasets verified: "${customerDataset.name}" & "${employeeDataset.name}"`);

  // 5. Create Synthetic Evaluations with Protected Aggregate Results
  const evalCustomer = await prisma.evaluation.upsert({
    where: { id: "eval-customer-health-01" },
    update: {},
    create: {
      id: "eval-customer-health-01",
      organizationId: org.id,
      datasetId: customerDataset.id,
      name: "Customer Data Health Audit Q2",
      status: EvaluationStatus.COMPLETED,
      evaluationType: EvaluationType.DATA_QUALITY,
      startedAt: new Date(Date.now() - 3600000),
      completedAt: new Date(),
      results: {
        create: {
          completenessScore: 94.2,
          consistencyScore: 88.7,
          duplicateRate: 1.1,
          anomalyCount: 42,
          invalidValueCount: 17,
          missingValueRate: 5.8,
          biasIndicator: 0.08,
          privacyStatus: PrivacyStatus.ENFORCED,
          rawRecordsTransferred: 0, // Invariant: Must be 0
          processingTimeMs: 1840,
        },
      },
    },
  });

  const evalEmployee = await prisma.evaluation.upsert({
    where: { id: "eval-employee-fairness-01" },
    update: {},
    create: {
      id: "eval-employee-fairness-01",
      organizationId: org.id,
      datasetId: employeeDataset.id,
      name: "Employee Compensation Parity Assessment",
      status: EvaluationStatus.COMPLETED,
      evaluationType: EvaluationType.BIAS,
      startedAt: new Date(Date.now() - 7200000),
      completedAt: new Date(Date.now() - 3600000),
      results: {
        create: {
          completenessScore: 96.8,
          consistencyScore: 92.4,
          duplicateRate: 0.4,
          anomalyCount: 8,
          invalidValueCount: 3,
          missingValueRate: 3.2,
          biasIndicator: 0.04,
          privacyStatus: PrivacyStatus.ENFORCED,
          rawRecordsTransferred: 0, // Invariant: Must be 0
          processingTimeMs: 1220,
        },
      },
    },
  });

  const evalRunning = await prisma.evaluation.upsert({
    where: { id: "eval-active-pipeline-01" },
    update: {},
    create: {
      id: "eval-active-pipeline-01",
      organizationId: org.id,
      datasetId: customerDataset.id,
      name: "Streaming Batch Drift Analysis",
      status: EvaluationStatus.RUNNING,
      evaluationType: EvaluationType.FULL,
      startedAt: new Date(),
    },
  });

  console.log(`✅ Evaluations verified: 3 synthetic evaluations seeded`);

  // 6. Create Initial Safe Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        organizationId: org.id,
        evaluationId: evalCustomer.id,
        action: "evaluation.completed",
        actorType: ActorType.AGENT,
        metadata: {
          agentId: "agent-us-east-01",
          rawRecordsTransferred: 0,
          privacyVerification: "PASSED",
        },
      },
      {
        organizationId: org.id,
        evaluationId: evalEmployee.id,
        action: "evaluation.completed",
        actorType: ActorType.AGENT,
        metadata: {
          agentId: "agent-us-east-01",
          rawRecordsTransferred: 0,
          privacyVerification: "PASSED",
        },
      },
      {
        organizationId: org.id,
        action: "privacy_policy.created",
        actorType: ActorType.USER,
        metadata: {
          policyId: policy.id,
          allowRawDataset: false,
          allowIndividualRecords: false,
        },
      },
    ],
    skipDuplicates: true,
  });
  console.log(`✅ Audit Logs seeded with safe privacy metadata`);
}

// If run directly
if (require.main === module) {
  seed()
    .then(async () => {
      await prisma.$disconnect();
      console.log("🎉 Seeding completed successfully.");
    })
    .catch(async (e) => {
      console.error("❌ Error during seed:", e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
