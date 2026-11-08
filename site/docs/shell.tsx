import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GITHUB_URL } from "../config";
import { ALL_PAGES, DOCS } from "./nav";

/** One docs page: grouped sidebar, header with previous/next, content, and "On this page". */
export function DocsShell({
  href,
  toc,
  children,
}: {
  href: string;
  toc: { id: string; title: string }[];
  children: React.ReactNode;
}) {
  const index = ALL_PAGES.findIndex((p) => p.href === href);
  const page = ALL_PAGES[index]!;
  const prev = ALL_PAGES[index - 1];
  const next = ALL_PAGES[index + 1];

  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[13rem_minmax(0,1fr)_13rem]">
      <aside className="hidden lg:block">
        <nav aria-label="Docs" className="sticky top-14 h-[calc(100svh-3.5rem)] overflow-y-auto border-e py-8 pe-4">
          {DOCS.map((group) => (
            <div key={group.title} className="mb-6">
              <p className="mb-1.5 px-2.5 text-xs font-medium text-muted-foreground">{group.title}</p>
              <ul>
                {group.pages.map((p) => (
                  <li key={p.href}>
                    <Link
                      href={p.href}
                      aria-current={p.href === href ? "page" : undefined}
                      className={cn(
                        "block rounded-md px-2.5 py-1.5 text-sm hover:bg-accent",
                        p.href === href ? "bg-accent font-medium text-foreground" : "text-foreground/80"
                      )}
                    >
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <article className="min-w-0 py-10 lg:py-12">
        <div className="mx-auto max-w-[42rem]">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl font-semibold tracking-[-0.025em] text-balance">{page.title}</h1>
            <div className="flex shrink-0 gap-1.5 pt-1">
              {prev && (
                <Button asChild size="icon" variant="secondary" className="size-8">
                  <Link href={prev.href} aria-label={`Previous: ${prev.title}`}>
                    <ArrowLeft />
                  </Link>
                </Button>
              )}
              {next && (
                <Button asChild size="icon" variant="secondary" className="size-8">
                  <Link href={next.href} aria-label={`Next: ${next.title}`}>
                    <ArrowRight />
                  </Link>
                </Button>
              )}
            </div>
          </div>
          <p className="mt-2 text-[1.05rem] text-pretty text-muted-foreground">{page.description}</p>
          <div className="docs-prose mt-8">{children}</div>
          <div className="mt-16 flex items-center justify-between gap-4 border-t pt-6 text-sm">
            {prev ? (
              <Link href={prev.href} className="group flex flex-col gap-1">
                <span className="text-muted-foreground">Previous</span>
                <span className="flex items-center gap-1 font-medium">
                  <ArrowLeft className="size-4" />
                  {prev.title}
                </span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link href={next.href} className="flex flex-col items-end gap-1 text-end">
                <span className="text-muted-foreground">Next</span>
                <span className="flex items-center gap-1 font-medium">
                  {next.title}
                  <ArrowRight className="size-4" />
                </span>
              </Link>
            )}
          </div>
        </div>
      </article>

      <aside className="hidden xl:block">
        <div className="sticky top-14 space-y-6 py-12 text-sm">
          {toc.length > 0 && (
            <nav aria-label="On this page">
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
          )}
          <div className="rounded-xl bg-muted/60 p-4">
            <p className="font-medium">See it running</p>
            <p className="mt-1.5 text-muted-foreground">The real inbox, ticket and portal screens, in your browser.</p>
            <Button asChild size="sm" variant="outline" className="mt-3">
              <Link href="/demo">Open the demo</Link>
            </Button>
          </div>
          <a href={editUrl(href)} className="block text-muted-foreground hover:text-foreground">
            Edit this page on GitHub
          </a>
        </div>
      </aside>
    </div>
  );
}

/** A section heading that anchors "On this page". */
export function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-12 mb-4 scroll-mt-20 text-xl font-semibold tracking-[-0.015em] first:mt-0">
      <a href={`#${id}`} className="hover:underline hover:underline-offset-4">
        {children}
      </a>
    </h2>
  );
}

export function H3({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="mt-8 mb-3 scroll-mt-20 font-semibold">
      {children}
    </h3>
  );
}

export function Callout({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="my-6 rounded-xl border bg-muted/40 px-4 py-3 text-sm leading-relaxed">
      {title && <p className="mb-1 font-medium text-foreground">{title}</p>}
      <div className="text-muted-foreground [&_code]:text-foreground">{children}</div>
    </div>
  );
}

/** Numbered setup steps with a rail, like shadcn's install steps. */
export function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="docs-steps my-6 ms-3 border-s ps-7 [counter-reset:step]">{children}</ol>;
}

export function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="relative pb-8 [counter-increment:step] last:pb-0 before:absolute before:-start-[2.65rem] before:grid before:size-7 before:place-items-center before:rounded-full before:border before:bg-background before:text-xs before:font-medium before:content-[counter(step)]">
      <p className="pt-0.5 font-medium text-foreground">{title}</p>
      <div className="mt-2">{children}</div>
    </li>
  );
}

/** An options or props table. */
export function Props({ rows }: { rows: { name: string; type: string; description: React.ReactNode; required?: boolean; default?: string }[] }) {
  return (
    <div className="my-6 overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-start text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-start font-medium">Name</th>
            <th className="px-3 py-2 text-start font-medium">Type</th>
            <th className="px-3 py-2 text-start font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y align-top">
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="px-3 py-2.5 whitespace-nowrap">
                <code className="font-mono text-[0.85em] font-medium text-foreground">{r.name}</code>
                {r.required && <span className="ms-1 text-destructive" aria-label="required">*</span>}
              </td>
              <td className="px-3 py-2.5">
                <code className="font-mono text-[0.8em] whitespace-nowrap text-muted-foreground">{r.type}</code>
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">
                {r.description}
                {r.default && (
                  <span className="mt-1 block text-xs">
                    Default: <code className="font-mono">{r.default}</code>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Where a page's source lives. Adapter pages are generated from one data file. */
function editUrl(href: string) {
  const generated = /^\/docs\/channels\/(?!custom$)[^/]+$/.test(href);
  return generated
    ? `${GITHUB_URL}/blob/main/site/docs/channels-data.tsx`
    : `${GITHUB_URL}/blob/main/app/(site)${href}/page.tsx`;
}
