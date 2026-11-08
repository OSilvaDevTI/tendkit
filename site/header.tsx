import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { GITHUB_URL } from "./config";
import { githubStars } from "./github-stars";
import { Logo } from "./logo";
import { DocsSearch } from "./search";
import { ModeToggle } from "./theme";

const NAV = [
  { href: "/docs", label: "Docs", className: "" },
  { href: "/docs/channels", label: "Channels", className: "max-sm:hidden" },
  { href: "/demo", label: "Demo", className: "" },
];

export async function SiteHeader() {
  const stars = await githubStars();
  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6">
        <Link href="/" className="me-1 flex items-center gap-2 sm:me-3 text-[15px] font-semibold tracking-[-0.01em]" aria-label="Tendkit home">
          <Logo className="size-6" />
          <span className="max-sm:hidden">Tendkit</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((item) => (
            <Button key={item.href} asChild variant="ghost" size="sm" className={`h-8 px-2.5 font-medium text-foreground/80 hover:text-foreground ${item.className}`}>
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1.5">
          <DocsSearch />
          <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 px-2">
            <a href={GITHUB_URL} aria-label="Tendkit on GitHub">
              <GitHubMark className="size-4" />
              {stars && <span className="text-xs text-muted-foreground tabular-nums">{stars}</span>}
            </a>
          </Button>
          <Separator orientation="vertical" className="mx-0.5 h-4! max-sm:hidden" />
          <ModeToggle />
          <Button asChild size="sm" className="ms-1 h-8 rounded-full px-3.5 max-md:hidden">
            <Link href="/docs/installation">Get Started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <p className="mx-auto max-w-7xl px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
        Built by{" "}
        <a href="https://software-savants.com" className="font-medium underline underline-offset-4">
          Software Savants
        </a>
        . The source code is available on{" "}
        <a href={GITHUB_URL} className="font-medium underline underline-offset-4">
          GitHub
        </a>
        .
      </p>
    </footer>
  );
}

export function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className} fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
