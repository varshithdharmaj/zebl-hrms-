"use client";

import React, { useState } from "react";
import { AppTabs } from "@/components/ui/app-tabs";
import { ConversionHistoryCard } from "./conversion-history-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowRight, UserCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface TabsViewProps {
  pendingConversions: any[];
  history: any[];
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
                All accepted offers have been converted, or there are no accepted offers waiting for conversion.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-subtle border-slate-200 p-0 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 font-semibold text-slate-600">
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600">Candidate</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600">Job Opening</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600">Offer #</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600">Accepted Date</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600">Offered CTC</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingConversions.map((offer) => {
                  const candidate = offer.application.candidate;
                  const job = offer.application.jobOpening;

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
                        <span className="text-xs font-medium text-slate-800">
                          {job.title}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant="secondary" className="text-[10px] font-bold bg-slate-100 text-slate-800 rounded-md">
                          {offer.offerNumber || "N/A"}
                        </Badge>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>{offer.acceptedAt ? new Date(offer.acceptedAt).toLocaleDateString() : "N/A"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-xs font-semibold text-slate-800">
                          {offer.ctc.toLocaleString()} {offer.currency}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <Link href={`/admin/recruitment/conversions/${offer.id}`}>
                          <Button size="sm" className="h-8 text-xs font-semibold rounded-lg gap-1 shadow-subtle">
                            Convert to Employee <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )
      ) : (
        <ConversionHistoryCard history={history} />
      )}
    </div>
  );
}
