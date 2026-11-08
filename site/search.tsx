"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, LayoutPanelLeft, Search } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DOCS } from "./docs/nav";

/** "Search documentation…" with ⌘K, over every docs page. */
export function DocsSearch() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !/input|textarea/i.test((e.target as HTMLElement).tagName))) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-2 rounded-md bg-muted/70 px-2.5 text-sm text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring max-sm:size-8 max-sm:justify-center max-sm:px-0 sm:w-56 lg:w-64"
        aria-label="Search documentation"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden flex-1 text-start sm:inline">Search documentation…</span>
        <kbd className="pointer-events-none hidden rounded border bg-background px-1.5 font-mono text-[10px] font-medium sm:inline">⌘K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search documentation" description="Find a docs page">
        <CommandInput placeholder="Search documentation…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Pages">
            <CommandItem onSelect={() => go("/demo")}>
              <LayoutPanelLeft />
              Live demo
            </CommandItem>
          </CommandGroup>
          {DOCS.map((group) => (
            <CommandGroup key={group.title} heading={group.title}>
              {group.pages.map((p) => (
                <CommandItem key={p.href} value={`${group.title} ${p.title} ${p.description}`} onSelect={() => go(p.href)}>
                  <FileText />
                  {group.title === "Channels" && p.title !== "Overview" && p.title !== "Write an adapter" ? `${p.title} channel` : p.title}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
