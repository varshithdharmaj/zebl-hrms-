"use client";

import React, { useState } from "react";
import { AppTabs } from "@/components/ui/app-tabs";
import { ConversionHistoryCard } from "./conversion-history-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowRight, UserCheck, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface TabsViewProps {
  pendingConversions: Array<{
    id: string;
    offerNumber?: string | null;
    acceptedAt?: Date | string | null;
    ctc?: number | string | null;
    currency?: string | null;
    createdBy?: { email?: string | null } | null;
    application: {
      candidate: {
        id: string;
        fullName: string;
        email?: string | null;
      };
      jobOpening: {
        id: string;
        title: string;
      };
    };
  }>;
  history: unknown[];
}

export function ConversionTabsView({ pendingConversions, history }: TabsViewProps) {
  const [activeTab, setActiveTab] = useState("pending");

  const tabs = [
    { id: "pending", label: "Pending Conversions", count: pendingConversions.length },
    { id: "history", label: "Conversion History", count: history.length },
  ];

  return (
    <div className="space-y-6">
      <AppTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === "pending" ? (
        pendingConversions.length === 0 ? (
          <Card className="shadow-subtle border-slate-200">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-slate-50 p-3 mb-3">
                <UserCheck className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">No Pending Conversions</h3>
              <p className="text-xs text-slate-500 max-w-xs mt-1">
                All accepted offers have been converted, or there are no accepted offers waiting.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-subtle border-slate-200 p-0 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 font-semibold text-slate-600">
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600">Candidate</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600">Job</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600">Offer</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600">Accepted Date</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600">Recruiter</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingConversions.map((offer) => {
                  const candidate = offer.application.candidate;
                  const job = offer.application.jobOpening;
                  const ctc =
                    offer.ctc == null
                      ? null
                      : typeof offer.ctc === "number"
                        ? offer.ctc
                        : Number(offer.ctc);

                  return (
                    <tr key={offer.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3">
                        <div className="space-y-0.5">
                          <span className="text-xs font-semibold text-slate-900 block">
                            {candidate.fullName}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {candidate.email || "No Email"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-xs font-medium text-slate-800">{job.title}</span>
                      </td>
                      <td className="px-6 py-3">
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-bold bg-slate-100 text-slate-800 rounded-md"
                        >
                          {offer.offerNumber || "N/A"}
                        </Badge>
                        {ctc != null && Number.isFinite(ctc) ? (
                          <div className="text-[10px] text-slate-500 mt-1">
                            {ctc.toLocaleString()} {offer.currency}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>
                            {offer.acceptedAt
                              ? new Date(offer.acceptedAt).toLocaleDateString()
                              : "N/A"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-600">
                        {offer.createdBy?.email ?? "—"}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button asChild size="sm" className="h-8 text-xs font-semibold rounded-lg gap-1 shadow-subtle">
                            <Link href={`/admin/recruitment/conversions/${offer.id}`}>
                              Convert <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <Button asChild size="sm" variant="outline" className="h-8 text-xs font-semibold rounded-lg gap-1">
                            <Link href={`/admin/recruitment/candidates/${candidate.id}`}>
                              Candidate <ExternalLink className="h-3 w-3" />
                            </Link>
                          </Button>
                          <Button asChild size="sm" variant="ghost" className="h-8 text-xs font-semibold rounded-lg gap-1">
                            <Link href={`/admin/recruitment/offers/${offer.id}`}>
                              Offer
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )
      ) : (
        <ConversionHistoryCard history={history as never[]} />
      )}
    </div>
  );
}
