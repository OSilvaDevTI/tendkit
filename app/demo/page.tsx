"use client";

import { Suspense, useState } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Info } from "lucide-react";
import { SupportProvider } from "@/registry/support-ui/provider";
import { SupportInbox } from "@/registry/support-ui/support-inbox";
import { SupportTicket } from "@/registry/support-ui/support-ticket";
import type { TicketDetail } from "@/registry/support-ui/client";
import { ACCOUNTS, VIEWER, createDemoClient } from "@/site/demo-client";

export default function DemoPage() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return (
    <QueryClientProvider client={queryClient}>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="mb-6 flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            This is the real inbox, running in your browser with sample data. Reply to a ticket and the customer writes back
            a few seconds later. Nothing is sent, and a reload starts over.
          </span>
        </p>
        <Suspense>
          <Demo />
        </Suspense>
      </div>
    </QueryClientProvider>
  );
}

function Demo() {
  const queryClient = useQueryClient();
  const [client] = useState(() => createDemoClient(() => queryClient.invalidateQueries({ queryKey: ["support"] })));
  const ticketId = useSearchParams().get("ticket");
  return (
    <SupportProvider
      client={client}
      viewerId={VIEWER.id}
      inboxHref="/demo"
      ticketHref={(id) => `/demo?ticket=${id}`}
      customerPanel={(detail) => (detail.customer ? <AccountPanel detail={detail} /> : null)}
    >
      {ticketId ? <SupportTicket key={ticketId} ticketId={ticketId} /> : <SupportInbox />}
    </SupportProvider>
  );
}

/** What your app would show here: the customer's account, from your own database. */
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
        <p className="text-xs text-muted-foreground">From your app&apos;s database</p>
      </div>
      <dl className="space-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-end">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
