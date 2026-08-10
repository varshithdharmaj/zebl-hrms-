"use client";

import React from "react";
import type { Offer } from "@/generated/prisma/client";

/**
 * Compensation fields this card reads.
 * Money values are flattened (number/string) before RSC → client — not Prisma.Decimal.
 */
export type SalaryBreakdownCardOffer = Pick<
  Offer,
  "currency" | "stock" | "benefitsNotes"
> & {
  baseSalary?: string | number | null;
  variablePay?: string | number | null;
  bonus?: string | number | null;
  ctc?: string | number | null;
};

export function SalaryBreakdownCard({ offer }: { offer: SalaryBreakdownCardOffer }) {
  const currency = offer.currency || "INR";
  const ctc = Number(offer.ctc || 0);
  const base = Number(offer.baseSalary || 0);
  const variable = Number(offer.variablePay || 0);
  const bonus = Number(offer.bonus || 0);
  const stock = offer.stock || "None";

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-subtle space-y-6">
      <div className="border-b border-border pb-4">
        <h3 className="text-lg font-bold text-foreground">Compensation & Salary Breakdown</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Detailed financial breakdown of the offer package.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <div className="rounded-xl bg-primary/5 border border-primary/10 p-4">
          <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Total CTC
          </span>
          <span className="text-xl font-bold text-primary">
            {ctc.toLocaleString()} {currency}
          </span>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
          <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Base Salary
          </span>
          <span className="text-xl font-bold text-foreground">
            {base.toLocaleString()} {currency}
          </span>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
          <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Variable Pay
          </span>
          <span className="text-xl font-bold text-foreground">
            {variable.toLocaleString()} {currency}
          </span>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
          <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Stock Options
          </span>
          <span className="text-lg font-bold text-foreground truncate block">
            {stock}
          </span>
        </div>
      </div>

      <div className="border-t border-border pt-6 space-y-4">
        <h4 className="text-sm font-bold text-foreground">Salary Breakdown Structure</h4>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                <th className="px-4 py-2">Component</th>
                <th className="px-4 py-2 text-right">Amount ({currency})</th>
                <th className="px-4 py-2 text-right">% of CTC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-4 py-3 font-medium text-foreground">Base Salary (Fixed)</td>
                <td className="px-4 py-3 text-right text-foreground font-mono">
                  {base.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {ctc > 0 ? `${((base / ctc) * 100).toFixed(1)}%` : "0%"}
                </td>
              </tr>
              {variable > 0 && (
                <tr>
                  <td className="px-4 py-3 font-medium text-foreground">Variable Pay / Performance Bonus</td>
                  <td className="px-4 py-3 text-right text-foreground font-mono">
                    {variable.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {ctc > 0 ? `${((variable / ctc) * 100).toFixed(1)}%` : "0%"}
                  </td>
                </tr>
              )}
              {bonus > 0 && (
                <tr>
                  <td className="px-4 py-3 font-medium text-foreground">One-time Joining Bonus</td>
                  <td className="px-4 py-3 text-right text-foreground font-mono">
                    {bonus.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {ctc > 0 ? `${((bonus / ctc) * 100).toFixed(1)}%` : "0%"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {offer.benefitsNotes && (
        <div className="border-t border-border pt-6 space-y-2">
          <h4 className="text-sm font-bold text-foreground">Additional Benefits Notes</h4>
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {offer.benefitsNotes}
          </p>
        </div>
      )}
    </div>
  );
}
