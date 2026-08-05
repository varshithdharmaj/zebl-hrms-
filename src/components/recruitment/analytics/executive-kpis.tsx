import React from "react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { StatsGrid } from "@/components/ui/stats-grid";
import {
  Briefcase,
  Users,
  ClipboardList,
  Calendar,
  FileCheck,
  CheckCircle2,
  UserCheck,
  Award,
  Clock,
  Percent,
  TrendingUp,
} from "lucide-react";

interface ExecutiveKPIsProps {
  kpis: {
    totalOpenJobs: number;
    activeCandidates: number;
    totalApplications: number;
    totalInterviews: number;
    offersSent: number;
    offersAccepted: number;
    pendingConversions: number;
    employeesJoined: number;
    avgTimeToHire: number;
    offerAcceptanceRate: number;
    conversionRate: number;
  };
}

export function ExecutiveKPIs({ kpis }: ExecutiveKPIsProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Executive KPIs</h2>
        <p className="text-sm text-slate-500 mt-1">
          Key performance indicators for recruitment operations.
        </p>
      </div>

      <StatsGrid>
        <DashboardCard
          label="Open Jobs"
          value={kpis.totalOpenJobs}
          icon={Briefcase}
          accent="blue"
        />
        <DashboardCard
          label="Active Candidates"
          value={kpis.activeCandidates}
          icon={Users}
          accent="green"
        />
        <DashboardCard
          label="Applications"
          value={kpis.totalApplications}
          icon={ClipboardList}
          accent="teal"
        />
        <DashboardCard
          label="Interviews"
          value={kpis.totalInterviews}
          icon={Calendar}
          accent="amber"
        />
        <DashboardCard
          label="Offers Sent"
          value={kpis.offersSent}
          icon={FileCheck}
          accent="blue"
        />
        <DashboardCard
          label="Offers Accepted"
          value={kpis.offersAccepted}
          icon={CheckCircle2}
          accent="green"
        />
        <DashboardCard
          label="Pending Conversions"
          value={kpis.pendingConversions}
          icon={UserCheck}
          accent="amber"
        />
        <DashboardCard
          label="Employees Joined"
          value={kpis.employeesJoined}
          icon={Award}
          accent="green"
        />
        <DashboardCard
          label="Avg. Time to Hire"
          value={`${kpis.avgTimeToHire}d`}
          icon={Clock}
          accent="teal"
        />
        <DashboardCard
          label="Offer Acceptance Rate"
          value={`${kpis.offerAcceptanceRate}%`}
          icon={Percent}
          accent="green"
        />
        <DashboardCard
          label="Conversion Rate"
          value={`${kpis.conversionRate}%`}
          icon={TrendingUp}
          accent="green"
        />
      </StatsGrid>
    </div>
  );
}
