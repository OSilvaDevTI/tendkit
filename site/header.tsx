import Link from "next/link";
import { GITHUB_URL } from "./config";
import { Logo } from "./logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight" aria-label="Tendkit home">
          <Logo className="size-6" />
          Tendkit
        </Link>
        <nav className="flex flex-1 items-center gap-5 text-sm text-muted-foreground">
          <Link href="/demo" className="hover:text-foreground">
            Demo
          </Link>
          <Link href="/docs" className="hover:text-foreground">
            Docs
          </Link>
        </nav>
        <a
          href={GITHUB_URL}
          className="inline-flex h-8 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-accent"
        >
          <GitHubMark className="size-4" />
          <span className="hidden sm:inline">GitHub</span>
        </a>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          MIT licensed. Built by{" "}
          <a href="https://software-savants.com" className="underline-offset-4 hover:text-foreground hover:underline">
            Software Savants
          </a>
          .
        </p>
        <nav className="flex gap-5">
          <Link href="/docs" className="hover:text-foreground">
            Docs
          </Link>
          <Link href="/docs/channels" className="hover:text-foreground">
            Channels
          </Link>
          <a href={GITHUB_URL} className="hover:text-foreground">
            GitHub
          </a>
          <a href="/llms.txt" className="hover:text-foreground">
            llms.txt
          </a>
        </nav>
      </div>
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
