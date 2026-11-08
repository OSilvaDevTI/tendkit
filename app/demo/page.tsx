"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SupportInbox } from "@/registry/support-ui/support-inbox";
import { SupportTicket } from "@/registry/support-ui/support-ticket";
import { AppFrame, DemoSupport } from "@/site/app-frame";
import { ThemePicker } from "@/site/theme";

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Live demo</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The real inbox, running in your browser with sample data. Reply to a ticket and the customer writes back a
            few seconds later. Nothing is sent; a reload starts over.
          </p>
        </div>
      </div>
      <ThemePicker className="mt-6 rounded-xl border bg-card px-4 py-3" />
      <AppFrame className="mt-5">
        <DemoSupport>
          <Suspense>
            <Screen />
          </Suspense>
        </DemoSupport>
      </AppFrame>
    </div>
  );
}

function Screen() {
  const ticketId = useSearchParams().get("ticket");
  return ticketId ? <SupportTicket key={ticketId} ticketId={ticketId} /> : <SupportInbox />;
}
