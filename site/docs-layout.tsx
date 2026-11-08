import Link from "next/link";

const PAGES = [
  { href: "/docs", title: "Get started" },
  { href: "/docs/channels", title: "Channels" },
];

/** Docs chrome: a short nav and readable prose. */
export function DocsPage({ current, title, lead, children }: { current: string; title: string; lead: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
      <nav className="flex gap-4 text-sm lg:flex-col lg:gap-2">
        {PAGES.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className={p.href === current ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}
          >
            {p.title}
          </Link>
        ))}
      </nav>
      <article className="min-w-0 max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{lead}</p>
        <div className="mt-10 space-y-12">{children}</div>
      </article>
    </div>
  );
}

export function Step({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">
        <a href={`#${id}`} className="hover:underline">
          {title}
        </a>
      </h2>
      <div className="space-y-4 text-[15px] leading-relaxed text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.875em] [&_code]:text-foreground [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}
