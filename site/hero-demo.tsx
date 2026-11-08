"use client";

import { useEffect, useState } from "react";
import { Building2, CornerDownRight, Mail, MessageCircle, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * The product doing its job, on a loop. Each pass is a new customer on a different channel:
 * their message arrives → it lands in your inbox, already linked to their account → you reply →
 * the reply shows up in their own thread.
 */

type Stage = 0 | 1 | 2 | 3;
const TIMELINE: [Stage, number][] = [
  [1, 1300], // the ticket lands in the inbox, linked to the account
  [2, 2900], // the agent replies; the ticket now waits on the customer
  [3, 3900], // the reply arrives in the customer's thread
];
const EXIT_MS = 7200;
const PASS_MS = 7600;

type Channel = "Email" | "WhatsApp" | "SMS";
const CHANNEL_ICON = { Email: Mail, WhatsApp: MessageCircle, SMS: Smartphone } as const;

type Conversation = {
  channel: Channel;
  from: string;
  handle: string;
  account: string;
  subject: string;
  message: string;
  reply: string;
};

const CONVERSATIONS: Conversation[] = [
  {
    channel: "Email",
    from: "Mariem Sidi",
    handle: "mariem@nour.shop",
    account: "Boutique Nour",
    subject: "Payout not received",
    message: "Hi, last week's payout hasn't reached our bank account yet.",
    reply: "It left this morning. You'll see it in your account by tomorrow.",
  },
  {
    channel: "WhatsApp",
    from: "Ahmed Salem",
    handle: "+44 7700 900123",
    account: "Atlas Freight",
    subject: "Second admin",
    message: "Can I add a second admin to our account?",
    reply: "Yes, from Settings → Team. I've sent you the invite link.",
  },
  {
    channel: "SMS",
    from: "Lucia Romero",
    handle: "+34 600 123 456",
    account: "Clínica Sol",
    subject: "Wrong address on invoice",
    message: "Invoice 2381 has our old address on it.",
    reply: "Fixed. The corrected invoice is in your inbox.",
  },
];

type Row = { id: number; name: string; account: string; text: string; status: "Open" | "Waiting" | "Solved"; time: string };

const HISTORY: Row[] = [
  { id: 41, name: "Omar Haddad", account: "Haddad & Co", text: "Thanks, that worked!", status: "Solved", time: "1h" },
  { id: 40, name: "Sara Lind", account: "Nordvik", text: "Export to CSV isn't showing all rows", status: "Waiting", time: "3h" },
];

export function HeroDemo() {
  const [stage, setStage] = useState<Stage>(0);
  const [pass, setPass] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [history, setHistory] = useState<Row[]>(HISTORY);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStage(3); // one meaningful frame: the whole story at once
      return;
    }
    const timers = TIMELINE.map(([next, at]) => window.setTimeout(() => setStage(next), at));
    timers.push(
      window.setTimeout(() => setExiting(true), EXIT_MS),
      window.setTimeout(() => {
        setHistory((h) => [rowFor(pass, 3), ...h]);
        setStage(0);
        setExiting(false);
        setPass((p) => p + 1);
      }, PASS_MS)
    );
    if (history.length > 2) timers.push(window.setTimeout(() => setHistory((h) => h.slice(0, 2)), 520));
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one schedule per pass
  }, [pass]);

  const c = CONVERSATIONS[pass % CONVERSATIONS.length]!;
  const Icon = CHANNEL_ICON[c.channel];
  const current = rowFor(pass, stage);
  const rows = stage >= 1 ? [current, ...history] : history;

  return (
    <div className="relative mx-auto w-full max-w-md select-none" aria-hidden>
      {/* The customer's side: their own email, WhatsApp or SMS thread. */}
      <div
        key={`msg-${pass}`}
        className={cn(
          "hero-in relative z-10 ms-6 rounded-xl border bg-card p-4 shadow-[0_18px_50px_-20px_rgb(0_0_0/0.35)] transition-all duration-400",
          exiting && "-translate-y-2 opacity-0"
        )}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="size-3.5" />
          <span>{c.channel}</span>
          <span aria-hidden>·</span>
          <span className="truncate" dir="ltr">
            {c.handle}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed">
          <span className="font-medium">{c.from}: </span>
          {c.message}
        </p>
        {/* Space for the reply is kept from the start, so nothing below jumps when it arrives. */}
        <div
          className={cn(
            "mt-3 min-h-16 rounded-lg bg-primary/10 px-3 py-2 text-sm leading-relaxed transition-all duration-500 ease-out",
            stage >= 3 ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
          )}
        >
          <span className="font-medium text-primary">Support: </span>
          {c.reply}
        </div>
      </div>

      {/* Your side: the inbox, inside your own app. */}
      <div className="relative -mt-3 me-6 rounded-xl border bg-card pt-6 shadow-[0_24px_60px_-24px_rgb(0_0_0/0.35)]">
        <div className="flex items-center justify-between border-b px-4 pb-2.5 text-xs">
          <span className="font-semibold">Support</span>
          <span className="text-muted-foreground">your-app.com/admin/support</span>
        </div>
        <ul>
          {rows.slice(0, 3).map((row, i) => (
            <li
              key={row.id}
              className={cn(
                "overflow-hidden border-b last:border-b-0",
                i === 0 && stage === 1 && "hero-row-in",
                i === 2 && history.length > 2 && "hero-row-out"
              )}
            >
              <div className="flex items-start gap-3 px-4 py-2.5">
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    row.status === "Open" ? "bg-primary" : "bg-transparent"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="truncate font-medium">{row.name}</span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      <Building2 className="size-3" />
                      {row.account}
                    </span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    {i === 0 && stage >= 2 && row.id === current.id && <CornerDownRight className="size-3 shrink-0" />}
                    <span className="truncate">{row.text}</span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusPill status={row.status} />
                  <span className="text-[11px] text-muted-foreground">{row.time}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function rowFor(pass: number, stage: Stage): Row {
  const c = CONVERSATIONS[pass % CONVERSATIONS.length]!;
  const replied = stage >= 2;
  return {
    id: 42 + pass,
    name: c.from,
    account: c.account,
    text: replied ? `You: ${c.reply}` : c.message,
    status: replied ? "Waiting" : "Open",
    time: "now",
  };
}

function StatusPill({ status }: { status: Row["status"] }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors duration-300",
        status === "Open" && "bg-primary/12 text-primary",
        status === "Waiting" && "bg-amber-500/12 text-amber-700 dark:text-amber-400",
        status === "Solved" && "bg-muted text-muted-foreground"
      )}
    >
      {status}
    </span>
  );
}
