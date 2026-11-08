import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Code } from "@/site/code";
import { GITHUB_URL, REGISTRY_URL } from "@/site/config";
import { Wall } from "@/site/wall";

const INSTALL = `npx shadcn@latest add ${REGISTRY_URL}/support.json`;

export default function Home() {
  return (
    <>
      <section className="mx-auto flex max-w-3xl flex-col items-center px-4 pt-16 pb-12 text-center sm:pt-24">
        <a
          href={GITHUB_URL}
          className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium hover:bg-muted"
        >
          Open source · MIT licensed
          <ArrowRight className="size-3" />
        </a>
        <h1 className="mt-5 text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
          Customer support, inside your own app.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
          Email, WhatsApp and SMS become tickets your team answers next to the customer&apos;s account. Copy it in with
          the shadcn CLI: your components, your database, no seats.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Button asChild size="sm" className="rounded-full px-4">
            <Link href="/docs">Get Started</Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="rounded-full px-4">
            <Link href="/demo">Live Demo</Link>
          </Button>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-h-[780px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_80%,transparent)] max-xl:max-h-[1100px] max-md:max-h-[1500px]">
          <Wall />
        </div>
      </section>

      <section className="mx-auto flex max-w-2xl flex-col items-center px-4 pt-6 pb-24 text-center">
        <h2 className="text-xl font-semibold tracking-[-0.02em]">Add it to your app</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The CLI copies the inbox, the engine and the adapters you pick into your repo.
        </p>
        <Code title="Terminal" lang="bash" code={INSTALL} className="mt-6 w-full text-start" />
        <div className="mt-6 flex gap-2">
          <Button asChild size="sm" className="rounded-full px-4">
            <Link href="/docs">Read the docs</Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="rounded-full px-4">
            <Link href="/docs/channels">See every channel</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
