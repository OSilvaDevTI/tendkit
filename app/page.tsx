import Link from "next/link";
import { ArrowRight, Building2, MailCheck, ShieldCheck, Workflow } from "lucide-react";
import { HeroDemo } from "@/site/hero-demo";
import { Code } from "@/site/code";
import { CHANNELS } from "@/site/channels";
import { GITHUB_URL, REGISTRY_URL } from "@/site/config";
import { GitHubMark } from "@/site/header";

const INSTALL = `npx shadcn@latest add \\
  ${REGISTRY_URL}/support.json \\
  ${REGISTRY_URL}/support-postgres.json \\
  ${REGISTRY_URL}/support-ui.json \\
  ${REGISTRY_URL}/channel-resend.json`;

// Mirrors the SupportDirectory interface in registry/support/service.ts.
const DIRECTORY = `const directory: SupportDirectory = {
  // Who wrote? Match the sender to your users and accounts.
  async identify({ value: email }) {
    const user = await findUserByEmail(email);
    if (!user) return null;
    return {
      customerId: user.accountId,
      userId: user.id,
      name: user.name,
    };
  },
  searchCustomers: (q) => searchAccounts(q),
  getCustomers: (ids) => getAccounts(ids),
  listAgents: () => listAdmins(),
};`;

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_80%_-10%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]" />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-16 sm:px-6 lg:min-h-[min(85svh,52rem)] lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem] lg:leading-[1.05]">
              Customer support, inside your own app.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
              Turn customer emails, WhatsApp and SMS into tickets your team answers right next to the customer&apos;s
              account. You copy the code into your app, so it&apos;s yours: no seats, no vendor, no data leaving your
              database.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/demo"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 font-medium text-primary-foreground hover:bg-primary/90"
              >
                Try the live demo
                <ArrowRight className="size-4" />
              </Link>
              <Link href="/docs" className="inline-flex h-11 items-center rounded-lg border bg-background px-5 font-medium hover:bg-accent">
                Read the docs
              </Link>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              MIT licensed · Runs in production at{" "}
              <a href="https://moosyl.com" className="underline-offset-4 hover:text-foreground hover:underline">
                Moosyl
              </a>{" "}
              and{" "}
              <a href="https://moorsyl.com" className="underline-offset-4 hover:text-foreground hover:underline">
                Moorsyl
              </a>
            </p>
          </div>
          <HeroDemo />
        </div>
      </section>

      <Section
        icon={Building2}
        title="Answered next to the customer's account"
        body="You tell Tendkit who wrote: which user, which account. Every ticket then sits beside your own data (their plan, orders, payments, whatever your team checks first), and senders you don't recognize are linked once, by hand, for good."
      >
        <Code title="lib/support/directory.ts" code={DIRECTORY} />
      </Section>

      <section className="border-b bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Heading icon={Workflow} title="Every channel, one inbox">
            Each adapter is one file with no SDK: plain <code className="font-mono text-[0.9em]">fetch</code> and WebCrypto,
            so it runs on Cloudflare Workers, Node, Bun and Deno. Store tickets in Postgres or SQLite/D1.
          </Heading>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CHANNELS.map((c) => (
              <li key={c.item} className="rounded-xl border bg-card p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.kind}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{c.how}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-b">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Heading icon={MailCheck} title="Email that behaves like email">
            The hard parts of a support inbox, handled and tested.
          </Heading>
          <ul className="mt-10 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {[
              ["Replies thread in the customer's mail client", "In-Reply-To and References headers, plus a reply address with a ticket token, so answers come back to the right ticket even when a client drops the headers."],
              ["Only what they wrote this time", "Quoted history and signatures are trimmed, in English, French and Arabic. The full message is one click away."],
              ["Automatic mail stays quiet", "Out-of-office replies, bounces and mailing lists are recorded, but never reopen a ticket or notify anyone."],
              ["Spoofed senders stay strangers", "Mail that fails DMARC, or both SPF and DKIM, is never matched to an account and never gets an automatic reply. If it's real, a person links it."],
            ].map(([title, body]) => (
              <li key={title}>
                <h3 className="font-medium">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Section
        icon={ShieldCheck}
        title="Yours to change"
        body="Tendkit is a shadcn registry, not a package. The CLI copies the inbox, the engine and the adapters you pick into your repo, where they use your components and your database. Take upstream fixes with a diff when you want them."
      >
        <Code title="Terminal" code={INSTALL} />
      </Section>

      <section>
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Give your customers an inbox that&apos;s yours.</h2>
            <p className="mt-2 text-muted-foreground">Try it in the browser, then add it to your app in an afternoon.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 font-medium text-primary-foreground hover:bg-primary/90"
            >
              Try the live demo
              <ArrowRight className="size-4" />
            </Link>
            <a href={GITHUB_URL} className="inline-flex h-11 items-center gap-2 rounded-lg border px-5 font-medium hover:bg-accent">
              <GitHubMark className="size-4" />
              Star on GitHub
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

function Heading({ icon: Icon, title, children }: { icon: typeof Building2; title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-2xl">
      <Icon className="size-5 text-primary" />
      <h2 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-3 text-muted-foreground">{children}</p>
    </div>
  );
}

function Section({ icon, title, body, children }: { icon: typeof Building2; title: string; body: string; children: React.ReactNode }) {
  return (
    <section className="border-b">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <Heading icon={icon} title={title}>
          {body}
        </Heading>
        {children}
      </div>
    </section>
  );
}
