"use client";

import { SupportTicket } from "@/registry/support-ui/support-ticket";
import { AppFrame, DemoSupport } from "./app-frame";
import { ThemePicker } from "./theme";

/** The real ticket screen, restyled live by the theme picker above it. */
export function MakeItYours() {
  return (
    <div className="space-y-5">
      <ThemePicker className="rounded-xl border bg-card px-4 py-3" />
      <AppFrame>
        <DemoSupport>
          <SupportTicket ticketId="tkt_1" />
        </DemoSupport>
      </AppFrame>
    </div>
  );
}
