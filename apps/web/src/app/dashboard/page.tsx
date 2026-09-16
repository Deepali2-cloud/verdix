import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { DatasetHealthCard } from "@/components/dashboard/DatasetHealthCard";
import { EvaluationActivityCard } from "@/components/dashboard/EvaluationActivityCard";
import { RecentEvaluationsTable } from "@/components/dashboard/RecentEvaluationsTable";
import { PrivacyMonitorCard } from "@/components/dashboard/PrivacyMonitorCard";
import { ArchitectureCard } from "@/components/dashboard/ArchitectureCard";
import { Activity, ShieldCheck, FileCheck2, AlertTriangle } from "lucide-react";

export default function DashboardPage() {
  return (
    <AppShell
      title="Dashboard"
      subtitle="Monitor dataset health, evaluation activity, and privacy controls."
    >
      {/* 1. TOP METRIC CARDS (White cards, soft colored icons, subtle shadows) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Dataset Health */}
        <MetricCard
          title="Dataset Health"
          value="94.2%"
          label="Overall health score"
          trend="+2.4%"
          isPositive={true}
          icon={Activity}
          iconBgColor="bg-teal-50"
          iconColor="text-teal-600"
          sparklineColor="green"
        />

        {/* Card 2: Privacy Status */}
        <MetricCard
          title="Privacy Status"
          value="ENFORCED"
          isStatusValue={true}
          supportingText={
            <span>
              <span className="font-bold text-blue-600">0</span> raw records transferred
            </span>
          }
          icon={ShieldCheck}
          iconBgColor="bg-blue-50"
          iconColor="text-blue-600"
        />

        {/* Card 3: Evaluations */}
        <MetricCard
          title="Evaluations"
          value="24"
          supportingText={
            <span>
              <span className="font-bold text-blue-600">3</span> currently processing
            </span>
          }
          icon={FileCheck2}
          iconBgColor="bg-purple-50"
          iconColor="text-purple-600"
          sparklineColor="blue"
        />

        {/* Card 4: Anomalies Detected */}
        <MetricCard
          title="Anomalies Detected"
          value="42"
          label="Across recent evaluations"
          icon={AlertTriangle}
          iconBgColor="bg-amber-50"
          iconColor="text-amber-600"
          sparklineColor="orange"
        />
      </div>

      {/* 2. MIDDLE ROW: Dataset Health (left) + Evaluation Activity (center) + Privacy Monitor (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-5 flex flex-col">
          <DatasetHealthCard />
        </div>
        <div className="lg:col-span-4 flex flex-col">
          <EvaluationActivityCard />
        </div>
        <div className="lg:col-span-3 flex flex-col">
          <PrivacyMonitorCard />
        </div>
      </div>

      {/* 3. BOTTOM ROW: Recent Evaluations (left) + System Architecture (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-8 flex flex-col">
          <RecentEvaluationsTable />
        </div>
        <div className="lg:col-span-4 flex flex-col">
          <ArchitectureCard />
        </div>
      </div>
    </AppShell>
  );
}
