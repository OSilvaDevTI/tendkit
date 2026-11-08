"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowUp, Building2, Check, ChevronDown, Copy, Lock, Mail, MessageCircle, Search, Send, Smartphone } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CHANNELS } from "./channels";
import { REGISTRY_URL } from "./config";
import { COLORS, RADII } from "./theme-config";
import { setTheme, useTheme } from "./theme";

/*
 * The home page's wall: Tendkit's pieces as working shadcn/ui cards, the way ui.shadcn.com shows
 * its components. Each card is one thing the product does; the theme card restyles all of them.
 */

export function Wall() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="flex flex-col gap-4">
        <InboxCard />
        <ChannelsCard />
      </div>
      <div className="flex flex-col gap-4">
        <TicketCard />
        <NoteCard />
        <PortalCard />
      </div>
      <div className="flex flex-col gap-4">
        <AccountCard />
        <LinkSenderCard />
        <AssignCard />
      </div>
      <div className="flex flex-col gap-4">
        <MailClientCard />
        <ThemeCard />
        <WhatsAppCard />
      </div>
    </div>
  );
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/* ─── Inbox: new tickets keep arriving, already linked to their account ─────────────── */

type Row = { id: number; name: string; account: string | null; subject: string; wait: string; unread: boolean; channel: "email" | "whatsapp" | "sms" };

const ARRIVALS: Omit<Row, "id">[] = [
  { name: "Lucia Romero", account: "Clínica Sol", subject: "Invoice has our old address", wait: "now", unread: true, channel: "sms" },
  { name: "Omar Haddad", account: "Haddad & Co", subject: "2FA codes not arriving", wait: "now", unread: true, channel: "email" },
  { name: "Sara Lind", account: "Nordvik", subject: "CSV export cuts at 1,000 rows", wait: "now", unread: true, channel: "email" },
  { name: "Ahmed Salem", account: "Atlas Freight", subject: "Add a second admin", wait: "now", unread: true, channel: "whatsapp" },
];

const START: Row[] = [
  { id: 3, name: "Mariem Sidi", account: "Boutique Nour", subject: "Payout not received", wait: "26 min", unread: true, channel: "email" },
  { id: 2, name: "Jordan Lee", account: null, subject: "Annual billing?", wait: "48 min", unread: true, channel: "email" },
  { id: 1, name: "Ahmed Salem", account: "Atlas Freight", subject: "Add a second admin", wait: "3 hr", unread: false, channel: "whatsapp" },
];

const CHANNEL_ICON = { email: Mail, whatsapp: MessageCircle, sms: Smartphone } as const;

function InboxCard() {
  const [rows, setRows] = useState<Row[]>(START);
  const [tab, setTab] = useState<"open" | "waiting">("open");
  const next = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      const arrival = ARRIVALS[next.current % ARRIVALS.length]!;
      next.current++;
      setRows((current) => [{ ...arrival, id: 100 + next.current }, ...current.map((r) => ({ ...r, wait: r.wait === "now" ? "1 min" : r.wait }))].slice(0, 4));
    }, 4200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <Card className="gap-4 pb-2">
      <CardHeader>
        <CardTitle>Support</CardTitle>
        <CardDescription>Longest wait first, every channel.</CardDescription>
      </CardHeader>
      <CardContent className="px-2">
        <div className="mx-4 flex gap-1 border-b text-sm" role="tablist">
          {(
            [
              ["open", "Open", rows.length],
              ["waiting", "Waiting", 2],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "-mb-px border-b-2 px-2 pb-2 font-medium",
                tab === id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {label} <span className="ms-0.5 text-xs text-muted-foreground tabular-nums">{count}</span>
            </button>
          ))}
        </div>
        {tab === "open" ? (
          <ul className="mt-1">
            {rows.map((row, i) => {
              const Icon = CHANNEL_ICON[row.channel];
              return (
                <li key={row.id} className={cn("overflow-hidden", i === 0 && row.wait === "now" && "hero-row-in")}>
                  <div className="flex items-start gap-3 rounded-md px-4 py-2.5 hover:bg-muted/60">
                    <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", row.unread ? "bg-primary" : "bg-transparent")} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="truncate font-medium">{row.account ?? row.name}</span>
                        {!row.account && (
                          <Badge variant="outline" className="h-4.5 px-1.5 text-[10px] font-normal">
                            Unknown
                          </Badge>
                        )}
                      </div>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Icon className="size-3 shrink-0" />
                        <span className="truncate">{row.subject}</span>
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-xs tabular-nums",
                        row.wait === "3 hr" ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                      )}
                    >
                      {row.wait}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Two tickets wait on the customer.</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Ticket: thread + composer; reply and the customer answers back ───────────────────── */

type Msg = { id: number; author: "customer" | "agent"; text: string; at: string };

function TicketCard() {
  const [messages, setMessages] = useState<Msg[]>([
    { id: 1, author: "customer", text: "Hi, last week's payout hasn't reached our bank account yet. Could you check?", at: "09:12" },
  ]);
  const [draft, setDraft] = useState("It left this morning, you'll see it by tomorrow.");
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [status, setStatus] = useState<"Open" | "Waiting">("Open");

  const send = () => {
    if (!draft.trim()) return;
    setMessages((m) => [...m, { id: Date.now(), author: "agent", text: draft.trim(), at: "09:20" }]);
    setDraft("");
    setStatus("Waiting");
    window.setTimeout(() => {
      setMessages((m) => [...m, { id: Date.now(), author: "customer", text: "Perfect, thank you!", at: "09:21" }]);
      setStatus("Open");
    }, 2200);
  };

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Payout not received</CardTitle>
        <CardDescription className="flex items-center gap-1.5">
          <Mail className="size-3.5" /> mariem@nour.shop
        </CardDescription>
        <CardAction>
          <Badge variant={status === "Open" ? "default" : "secondary"}>{status}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex gap-2.5", m.author === "agent" && "flex-row-reverse")}>
            <Avatar className="size-7">
              <AvatarFallback className="text-[10px]">{m.author === "agent" ? "AC" : "MS"}</AvatarFallback>
            </Avatar>
            <div
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                m.author === "agent" ? "bg-primary text-primary-foreground" : "bg-muted"
              )}
            >
              {m.text}
            </div>
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2">
        <div className="flex gap-1 text-xs">
          {(["reply", "note"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-md px-2 py-1 font-medium",
                mode === m ? (m === "note" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-muted text-foreground") : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "reply" ? "Reply" : "Internal note"}
            </button>
          ))}
        </div>
        <div className="relative">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={mode === "reply" ? "Write a reply…" : "Only your team sees notes"}
            aria-label={mode === "reply" ? "Reply" : "Internal note"}
            className={cn("min-h-20 resize-none pe-12", mode === "note" && "border-amber-500/40 bg-amber-500/5")}
          />
          <Button size="icon" className="absolute end-2 bottom-2 size-8" onClick={send} disabled={!draft.trim() || mode === "note"} aria-label="Send">
            <ArrowUp />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

/* ─── Account panel: your own data, beside the conversation ────────────────────────────── */

function AccountCard() {
  const rows: [string, string][] = [
    ["Plan", "Growth"],
    ["Seats", "4 of 5"],
    ["Customer since", "Mar 2025"],
    ["Last payout", "$1,240.00"],
  ];
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" />
          Boutique Nour
        </CardTitle>
        <CardDescription>From your database, next to every ticket.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="divide-y text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
      <CardFooter>
        <code className="w-full truncate rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
          customerPanel={"{(ticket) => <Account … />}"}
        </code>
      </CardFooter>
    </Card>
  );
}

/* ─── Link an unknown sender, once ─────────────────────────────────────────────────────── */

function LinkSenderCard() {
  const [picked, setPicked] = useState<string | null>("Atlas Freight");
  const [linked, setLinked] = useState(false);
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Link jordan.lee@gmail.com</CardTitle>
        <CardDescription>Their next messages link automatically.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input defaultValue="at" className="ps-8" aria-label="Search customers" />
        </div>
        <ul className="space-y-1 text-sm">
          {["Atlas Freight", "Atlantic Tiles"].map((name) => (
            <li key={name}>
              <button
                onClick={() => {
                  setPicked(name);
                  setLinked(false);
                }}
                className={cn("flex w-full items-center justify-between rounded-md px-2.5 py-2 text-start hover:bg-muted", picked === name && "bg-muted")}
              >
                {name}
                {picked === name && <Check className="size-4" />}
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button className="w-full" variant={linked ? "secondary" : "default"} onClick={() => setLinked(true)} disabled={!picked}>
          {linked ? `Linked to ${picked}` : "Link"}
        </Button>
      </CardFooter>
    </Card>
  );
}

/* ─── Status and assignee ──────────────────────────────────────────────────────────────── */

function AssignCard() {
  const agents = ["Alex Chen", "Khadija Ali", "Tom Okafor"];
  const [assignee, setAssignee] = useState("Khadija Ali");
  return (
    <Card className="gap-3 py-4">
      <CardContent className="space-y-1 px-4">
        <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">Assign to</p>
        {agents.map((a) => (
          <button
            key={a}
            onClick={() => setAssignee(a)}
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
          >
            <Avatar className="size-6">
              <AvatarFallback className="text-[10px]">{initials(a)}</AvatarFallback>
            </Avatar>
            <span className="flex-1 text-start">{a === "Alex Chen" ? "Me" : a}</span>
            {assignee === a && <Check className="size-4" />}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

/* ─── Internal note ────────────────────────────────────────────────────────────────────── */

function NoteCard() {
  return (
    <Card className="gap-3 border-amber-500/30 bg-amber-500/[0.04] py-4">
      <CardContent className="px-4">
        <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
          <Lock className="size-3.5" />
          Internal note · Khadija
        </div>
        <p className="mt-2 text-sm leading-relaxed">They&apos;re on Business, so a second admin is included. Checking whether the invite bounced.</p>
      </CardContent>
    </Card>
  );
}

/* ─── Channels: pick adapters, get the install command ─────────────────────────────────── */

function ChannelsCard() {
  const [on, setOn] = useState<Set<string>>(new Set(["channel-resend", "channel-twilio"]));
  const [copied, setCopied] = useState(false);
  const picked = CHANNELS.filter((c) => on.has(c.item));
  const command = `npx shadcn@latest add ${["support", "support-postgres", "support-ui", ...picked.map((c) => c.item)].map((i) => `${REGISTRY_URL}/${i}.json`).join(" ")}`;
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Channels</CardTitle>
        <CardDescription>One file each. Pick yours.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {CHANNELS.slice(0, 6).map((c) => (
          <label key={c.item} className="flex items-center justify-between gap-3 text-sm">
            <span>
              {c.name}
              <span className="block text-xs text-muted-foreground">{c.kind}</span>
            </span>
            <Switch
              checked={on.has(c.item)}
              onCheckedChange={(v) =>
                setOn((s) => {
                  const n = new Set(s);
                  if (v) n.add(c.item);
                  else n.delete(c.item);
                  return n;
                })
              }
              aria-label={c.name}
            />
          </label>
        ))}
      </CardContent>
      <CardFooter>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            void navigator.clipboard.writeText(command);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : `Copy install command`}
        </Button>
      </CardFooter>
    </Card>
  );
}

/* ─── The customer portal ──────────────────────────────────────────────────────────────── */

function PortalCard() {
  const requests = [
    { subject: "Payout not received", status: "Awaiting your reply", tone: "default" as const },
    { subject: "Second admin", status: "Open", tone: "secondary" as const },
    { subject: "2FA codes not arriving", status: "Solved", tone: "outline" as const },
  ];
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Your requests</CardTitle>
        <CardDescription>The portal your customers see.</CardDescription>
        <CardAction>
          <Button size="sm" variant="outline">
            New request
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-lg border">
          {requests.map((r) => (
            <li key={r.subject} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <span className="truncate">{r.subject}</span>
              <Badge variant={r.tone} className="shrink-0">
                {r.status}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ─── What the customer sees in their own mail client ──────────────────────────────────── */

function MailClientCard() {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center gap-1.5 border-b bg-muted/50 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-foreground/15" />
        <span className="size-2.5 rounded-full bg-foreground/15" />
        <span className="size-2.5 rounded-full bg-foreground/15" />
        <span className="ms-2 text-xs text-muted-foreground">Mariem&apos;s inbox</span>
      </div>
      <div className="space-y-3 px-4 py-4">
        <div>
          <p className="text-sm font-semibold">Re: Payout not received</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Acme Support &lt;support@acme.com&gt;
            <br />
            Reply-To: <span className="font-mono text-[11px]">support+t-7h3kq2@in.acme.com</span>
          </p>
        </div>
        <Separator />
        <p className="text-sm leading-relaxed">
          It left this morning, you&apos;ll see it by tomorrow.
          <br />
          <span className="text-muted-foreground">Alex</span>
        </p>
        <p className="text-xs text-muted-foreground">Threaded in her own mail client. Her answer comes back to the same ticket.</p>
      </div>
    </Card>
  );
}

/* ─── Theme: restyles every card on the page ───────────────────────────────────────────── */

function ThemeCard() {
  const theme = useTheme();
  const dark = useIsDark();
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Make it yours</CardTitle>
        <CardDescription>Your tokens, your components. Try it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => setTheme({ color: c.id })}
              aria-pressed={theme.color === c.id}
              aria-label={c.label}
              title={c.label}
              className={cn("grid size-8 place-items-center rounded-full border-2 border-transparent", theme.color === c.id && "border-foreground/70")}
            >
              <span className="size-5 rounded-full" style={{ background: c.swatch }} />
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1 rounded-lg border p-1 text-xs">
          {RADII.map((r) => (
            <button
              key={r}
              onClick={() => setTheme({ radius: r })}
              aria-pressed={theme.radius === r}
              className={cn("rounded-[calc(var(--radius)-4px)] py-1.5 text-muted-foreground", theme.radius === r && "bg-muted font-medium text-foreground")}
            >
              {r}
            </button>
          ))}
        </div>
        <label className="flex items-center justify-between text-sm">
          Dark mode
          <Switch
            checked={dark}
            onCheckedChange={(v) => setTheme({ mode: v ? "dark" : "light" })}
            aria-label="Dark mode"
          />
        </label>
      </CardContent>
    </Card>
  );
}

/* ─── WhatsApp ──────────────────────────────────────────── */

function WhatsAppCard() {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="size-4 text-muted-foreground" />
          Ahmed Salem
        </CardTitle>
        <CardDescription>WhatsApp · Atlas Freight</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="w-fit max-w-[85%] rounded-lg bg-muted px-3 py-2">Can I add a second admin to our account?</p>
        <p className="ms-auto w-fit max-w-[85%] rounded-lg bg-primary px-3 py-2 text-primary-foreground">
          Yes, from Settings → Team. I&apos;ve sent you the invite.
        </p>
      </CardContent>
      <CardFooter className="gap-2">
        <Input placeholder="Reply on WhatsApp…" aria-label="Reply on WhatsApp" />
        <Button size="icon" variant="outline" aria-label="Send">
          <Send />
        </Button>
      </CardFooter>
    </Card>
  );
}

export function WallLinks() {
  return (
    <div className="flex justify-center gap-2">
      <Button asChild size="sm" variant="outline">
        <Link href="/demo">
          Open the full demo
          <ChevronDown className="-rotate-90" />
        </Link>
      </Button>
    </div>
  );
}

/** Whether the page is dark right now, including "follow the system". */
function useIsDark() {
  return useSyncExternalStore(
    (onChange) => {
      const observer = new MutationObserver(onChange);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return () => observer.disconnect();
    },
    () => document.documentElement.classList.contains("dark"),
    () => false
  );
}
