import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { StatsGrid } from "@/components/ui/stats-grid";
import { FileCheck, CheckCircle2, XCircle, Clock, Ban, FileEdit } from "lucide-react";

interface OfferAnalyticsCardProps {
  analytics: {
    sent: number;
    accepted: number;
    declined: number;
    expired: number;
    withdrawn: number;
    avgRevisionCount: number;
  };
}

export function OfferAnalyticsCard({ analytics }: OfferAnalyticsCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-green-600" />
          <CardTitle>Offer Acceptance</CardTitle>
        </div>
        <CardDescription>Offer outcomes and revisions</CardDescription>
      </CardHeader>
      <CardContent>
        <StatsGrid className="grid-cols-1 sm:grid-cols-3">
          <DashboardCard
            label="Sent"
            value={analytics.sent}
            icon={FileCheck}
            accent="blue"
          />
          <DashboardCard
            label="Accepted"
            value={analytics.accepted}
            icon={CheckCircle2}
            accent="green"
          />
          <DashboardCard
            label="Declined"
            value={analytics.declined}
            icon={XCircle}
            accent="violet"
          />
        </StatsGrid>
        <div className="mt-4 border-t border-slate-200 pt-4">
          <StatsGrid className="grid-cols-1 sm:grid-cols-3">
            <DashboardCard
              label="Expired"
              value={analytics.expired}
              icon={Clock}
              accent="amber"
            />
            <DashboardCard
              label="Withdrawn"
              value={analytics.withdrawn}
              icon={Ban}
              accent="violet"
            />
            <DashboardCard
              label="Avg. Revisions"
              value={Number(analytics.avgRevisionCount ?? 0).toFixed(1)}
              icon={FileEdit}
              accent="teal"
            />
          </StatsGrid>
        </div>
      </CardContent>
    </Card>
  );
}
