import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HeroDemo } from "@/site/hero-demo";
import { MakeItYours } from "@/site/make-it-yours";
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

const EMAIL = [
  [
    "Replies thread in the customer's mail client",
    "In-Reply-To and References headers, plus a reply address carrying a ticket token, so answers find the right ticket even when a client drops the headers.",
  ],
  ["Only what they wrote this time", "Quoted history and signatures are trimmed, in English, French and Arabic. The full message is one click away."],
  ["Automatic mail stays quiet", "Out-of-office replies, bounces and mailing lists are kept, but never reopen a ticket or notify anyone."],
  [
    "Spoofed senders stay strangers",
    "Mail that fails DMARC, or both SPF and DKIM, is never matched to an account and never gets an automatic reply. If it's real, a person links it.",
  ],
];

export default function Home() {
  return (
    <>
      <section className="border-b">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-4 pt-16 pb-20 sm:px-6 lg:min-h-[min(82svh,48rem)] lg:grid-cols-[1.15fr_1fr] lg:py-20">
          <div>
            <h1 className="text-[clamp(2.4rem,5.2vw,4rem)] leading-[1.02] font-semibold tracking-[-0.035em] text-balance">
              Customer support, inside your own app.
            </h1>
            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-pretty text-muted-foreground">
              Turn customer emails, WhatsApp and SMS into tickets your team answers right next to the customer&apos;s
              account. You copy the code into your app, so it&apos;s yours: no seats, no vendor, no data leaving your
              database.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/demo" className={cn(buttonVariants({ size: "lg" }), "h-11 px-5 text-[15px]")}>
                Try the live demo
                <ArrowRight />
              </Link>
              <Link href="/docs" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-11 px-5 text-[15px]")}>
                Read the docs
              </Link>
            </div>
            <p className="mt-7 text-sm text-muted-foreground">
              MIT licensed · Runs in production at{" "}
              <a href="https://moosyl.com" className="text-foreground/80 underline-offset-4 hover:underline">
                Moosyl
              </a>{" "}
              and{" "}
              <a href="https://moorsyl.com" className="text-foreground/80 underline-offset-4 hover:underline">
                Moorsyl
              </a>
            </p>
          </div>
          <HeroDemo />
        </div>
      </section>

      <section id="make-it-yours" className="border-b bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-end">
            <h2 className="text-[clamp(1.9rem,3.4vw,2.75rem)] leading-[1.08] font-semibold tracking-[-0.03em] text-balance">
              It looks like your app, because it is.
            </h2>
            <p className="max-w-xl text-muted-foreground lg:justify-self-end">
              The screens are built from your shadcn/ui components and theme tokens. Pick a theme below: this is the real
              ticket screen, running in your browser. Reply, and the customer writes back.
            </p>
          </div>
          <div className="mt-12">
            <MakeItYours />
          </div>
        </div>
      </section>

      <section className="border-b">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="max-w-md">
            <h2 className="text-3xl font-semibold tracking-[-0.025em] text-balance">Every ticket knows its customer.</h2>
            <p className="mt-4 text-muted-foreground">
              One small directory tells Tendkit who wrote: which user, which account. Tickets then sit beside your own
              data (plan, orders, payments), and a sender you don&apos;t recognize is linked once, by hand, for good.
            </p>
          </div>
          <Code title="lib/support/directory.ts" code={DIRECTORY} />
        </div>
      </section>

      <section className="border-b">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-end">
            <h2 className="text-3xl font-semibold tracking-[-0.025em]">Every channel, one inbox.</h2>
            <p className="max-w-xl text-muted-foreground lg:justify-self-end">
              Each adapter is one file with no SDK: plain <code className="font-mono text-[0.92em]">fetch</code> and
              WebCrypto, so it runs on Cloudflare Workers, Node, Bun and Deno. Tickets live in Postgres or SQLite/D1.
            </p>
          </div>
          <div className="mt-10 overflow-hidden rounded-xl border">
            <table className="w-full text-start text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">Adapter</th>
                  <th scope="col" className="hidden px-4 py-2.5 text-start font-medium sm:table-cell">Channel</th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">How it connects</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {CHANNELS.map((c) => (
                  <tr key={c.item} className="align-top">
                    <td className="px-4 py-3.5 font-medium whitespace-nowrap">
                      <Link href={`/docs/channels#${c.item.replace("channel-", "")}`} className="underline-offset-4 hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3.5 whitespace-nowrap text-muted-foreground sm:table-cell">{c.kind}</td>
                    <td className="px-4 py-3.5 text-muted-foreground">{c.how}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Missing one? Adapters are a single file.{" "}
            <a
              href={`${GITHUB_URL}/issues?q=is%3Aissue+is%3Aopen+label%3Aadapter`}
              className="text-foreground underline-offset-4 hover:underline"
            >
              Pick one up on GitHub
            </a>
            .
          </p>
        </div>
      </section>

      <section className="border-b">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <h2 className="text-3xl font-semibold tracking-[-0.025em] text-balance">Email that behaves like email.</h2>
            <p className="mt-4 max-w-sm text-muted-foreground">The parts that make a support inbox hard, handled and tested.</p>
          </div>
          <ol className="divide-y border-y">
            {EMAIL.map(([title, body], i) => (
              <li key={title} className="grid grid-cols-[2rem_1fr] gap-x-3 py-5">
                <span className="pt-0.5 font-mono text-sm text-muted-foreground tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="font-medium">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-b">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="max-w-md">
            <h2 className="text-3xl font-semibold tracking-[-0.025em] text-balance">Copied in, not installed.</h2>
            <p className="mt-4 text-muted-foreground">
              Tendkit is a shadcn registry, not a package. The CLI copies the inbox, the engine and the adapters you
              pick into your repo, where they use your components and your database. Take upstream fixes with a diff,
              when you want them.
            </p>
            <Link href="/docs" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline">
              Set it up in six steps
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <Code title="Terminal" lang="bash" code={INSTALL} />
        </div>
      </section>

      <section>
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-4 py-24 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="max-w-2xl text-[clamp(1.9rem,3.4vw,2.75rem)] leading-[1.08] font-semibold tracking-[-0.03em] text-balance">
            Give your customers an inbox that&apos;s yours.
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/demo" className={cn(buttonVariants({ size: "lg" }), "h-11 px-5 text-[15px]")}>
              Try the live demo
              <ArrowRight />
            </Link>
            <a href={GITHUB_URL} className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-11 px-5 text-[15px]")}>
              <GitHubMark className="size-4" />
              Star on GitHub
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
