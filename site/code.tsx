import { codeToHtml } from "shiki";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

/** A highlighted code sample (rendered at build time) with a copy button. Long lines scroll. */
export async function Code({
  code,
  title,
  lang = "tsx",
  className,
}: {
  code: string;
  title?: string;
  lang?: "tsx" | "ts" | "bash" | "json";
  className?: string;
}) {
  const html = await codeToHtml(code, {
    lang,
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  });
  return (
    <div className={cn("min-w-0 overflow-hidden rounded-xl border bg-muted/50", className)}>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2 text-xs text-muted-foreground">
        <span className="truncate font-mono">{title ?? ""}</span>
        <CopyButton text={code} />
      </div>
      <div
        dir="ltr"
        className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed [&_pre]:w-max [&_pre]:min-w-full [&_pre]:pe-4"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
