"use client";

import { Suspense, useState } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { SupportProvider } from "@/registry/support-ui/provider";
import type { TicketDetail } from "@/registry/support-ui/client";
import { ACCOUNTS, VIEWER, createDemoClient } from "./demo-client";
import { cn } from "@/lib/utils";

/*
 * The support screens inside a stand-in for "your app": a top bar with your product's nav, then
 * the Tendkit screen. The demo client keeps everything in the visitor's browser.
 */

const NAV = ["Dashboard", "Customers", "Billing", "Support", "Settings"];

export function AppFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-background shadow-[0_30px_80px_-40px_oklch(0.2_0.02_var(--hue)/0.45)]", className)}>
      <div className="flex items-center gap-4 border-b bg-muted/40 px-4 py-2.5 text-sm">
        <span className="flex items-center gap-2 font-semibold">
          <span className="grid size-5 place-items-center rounded-[calc(var(--radius)-4px)] bg-foreground text-[11px] text-background">A</span>
          Acme
        </span>
        <nav className="hidden gap-4 text-muted-foreground sm:flex" aria-label="Example app navigation">
          {NAV.map((item) => (
            <span key={item} className={cn(item === "Support" && "font-medium text-foreground")}>
              {item}
            </span>
          ))}
        </nav>
        <span className="ms-auto grid size-6 place-items-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">AC</span>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

/** Wraps support screens with the in-browser demo client and the example account panel. */
export function DemoSupport({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense>
        <Provider>{children}</Provider>
      </Suspense>
    </QueryClientProvider>
  );
}

function Provider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [client] = useState(() => createDemoClient(() => queryClient.invalidateQueries({ queryKey: ["support"] })));
  return (
    <SupportProvider
      client={client}
      viewerId={VIEWER.id}
      inboxHref="/demo"
      ticketHref={(id) => `/demo?ticket=${id}`}
      customerPanel={(detail) => (detail.customer ? <AccountPanel detail={detail} /> : null)}
    >
      {children}
    </SupportProvider>
  );
}

/** What your app shows next to a ticket: the customer's account, from your own database. */
function AccountPanel({ detail }: { detail: TicketDetail }) {
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
        <p className="text-xs text-muted-foreground">Your data, via customerPanel</p>
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
