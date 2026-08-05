import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { StatsGrid } from "@/components/ui/stats-grid";
import { Calendar, CheckCircle2, XCircle, UserX, Star } from "lucide-react";

interface InterviewAnalyticsCardProps {
  analytics: {
    upcoming: number;
    completed: number;
    cancelled: number;
    noShow: number;
    avgFeedbackScore: number;
  };
}

export function InterviewAnalyticsCard({ analytics }: InterviewAnalyticsCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          <CardTitle>Interview Analytics</CardTitle>
        </div>
        <CardDescription>Interview scheduling and outcomes</CardDescription>
      </CardHeader>
      <CardContent>
        <StatsGrid className="grid-cols-2 sm:grid-cols-5">
          <DashboardCard
            label="Upcoming"
            value={analytics.upcoming}
            icon={Calendar}
            accent="blue"
          />
          <DashboardCard
            label="Completed"
            value={analytics.completed}
            icon={CheckCircle2}
            accent="green"
          />
          <DashboardCard
            label="Cancelled"
            value={analytics.cancelled}
            icon={XCircle}
            accent="violet"
          />
          <DashboardCard
            label="No Show"
            value={analytics.noShow}
            icon={UserX}
            accent="amber"
          />
          <DashboardCard
            label="Avg. Score"
            value={analytics.avgFeedbackScore.toFixed(1)}
            icon={Star}
            accent="teal"
          />
        </StatsGrid>
      </CardContent>
    </Card>
  );
}
