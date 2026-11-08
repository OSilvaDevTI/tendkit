"use client";

import type { TicketDetail } from "@/registry/support-ui/client";
import { ACCOUNTS } from "../demo-client";

/** What your app shows next to a ticket (customerPanel): the customer's account, from your database. */
export function AccountPanel({ detail }: { detail: TicketDetail }) {
  const account = ACCOUNTS.find((a) => a.id === detail.customer?.id);
  if (!account) return null;
  const rows: [string, string][] = [
    ["Plan", account.plan],
    ["Seats", String(account.seats)],
    ["Customer since", account.since],
    ["Last order", account.lastOrder],
  ];
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <p className="text-sm font-semibold">{account.name}</p>
        <p className="text-xs text-muted-foreground">From your database, via customerPanel</p>
      </div>
      <dl className="space-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-end tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
