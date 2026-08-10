import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, MapPin, Briefcase, Calendar, DollarSign } from "lucide-react";

interface SummaryCardProps {
  candidate: {
    fullName: string;
    email: string | null;
    phone: string | null;
    status: string;
  };
  offer: {
    offerNumber: string | null;
    status: string;
    ctc: number;
    currency: string;
    joiningDate: string;
    department: string;
    location: string;
  };
}

export function ConversionSummaryCard({ candidate, offer }: SummaryCardProps) {
  return (
    <Card className="shadow-subtle border-slate-200">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold text-slate-900">
          Recruitment Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Candidate Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Candidate Details</h4>
            <Badge variant="secondary" className="text-[10px] uppercase font-semibold bg-slate-100 text-slate-700">
              {candidate.status}
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-900">{candidate.fullName}</div>
            <div className="space-y-1.5">
              {candidate.email && (
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span>{candidate.email}</span>
                </div>
              )}
              {candidate.phone && (
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>{candidate.phone}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* Offer Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Accepted Offer Details</h4>
            <Badge className="text-[10px] uppercase font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">
              {offer.status}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Offer Number</span>
              <span className="text-xs font-semibold text-slate-800">{offer.offerNumber || "N/A"}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Department</span>
              <div className="flex items-center gap-1 text-xs font-semibold text-slate-800">
                <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                <span>{offer.department}</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Location</span>
              <div className="flex items-center gap-1 text-xs font-semibold text-slate-800">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                <span>{offer.location}</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Joining Date</span>
              <div className="flex items-center gap-1 text-xs font-semibold text-slate-800">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span>{offer.joiningDate ? new Date(offer.joiningDate).toLocaleDateString() : "N/A"}</span>
              </div>
            </div>
            <div className="space-y-1 col-span-2">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Offered CTC</span>
              <div className="flex items-center gap-1 text-sm font-bold text-slate-900">
                <DollarSign className="h-4 w-4 text-slate-500" />
                <span>{offer.ctc.toLocaleString()} {offer.currency}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
