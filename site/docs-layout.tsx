import Link from "next/link";

const PAGES = [
  { href: "/docs", title: "Get started" },
  { href: "/docs/channels", title: "Channels" },
];

/** Docs chrome: a short nav and readable prose. */
export function DocsPage({
  current,
  title,
  lead,
  toc,
  children,
}: {
  current: string;
  title: string;
  lead: string;
  toc: { id: string; title: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[11rem_minmax(0,1fr)] xl:grid-cols-[11rem_minmax(0,1fr)_11rem]">
      <nav className="flex gap-4 text-sm lg:sticky lg:top-24 lg:flex-col lg:gap-2 lg:self-start" aria-label="Docs">
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
        <h1 className="text-[clamp(1.9rem,3vw,2.4rem)] leading-tight font-semibold tracking-[-0.03em] text-balance">{title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-pretty text-muted-foreground">{lead}</p>
        <div className="mt-12 space-y-14">{children}</div>
      </article>
      <nav className="hidden text-sm xl:sticky xl:top-24 xl:block xl:self-start" aria-label="On this page">
        <p className="font-medium">On this page</p>
        <ul className="mt-3 space-y-2">
          {toc.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`} className="text-muted-foreground hover:text-foreground">
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
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
