"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import DOMPurify from "dompurify";
import { Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileInfo, TicketStatus } from "./client";
import { formatBytes, initials } from "./format";
import { useSupport } from "./provider";

export function AgentAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary",
        className
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

const statusStyles: Record<TicketStatus, string> = {
  open: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-300",
  waiting: "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300",
  solved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300",
  spam: "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300",
};

export function StatusBadge({ status, label }: { status: TicketStatus; label: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset", statusStyles[status])}>
      {label}
    </span>
  );
}

export function UnknownSenderBadge() {
  const { t } = useSupport();
  return (
    <span className="inline-flex shrink-0 items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300">
      {t("inbox.unknownSender")}
    </span>
  );
}

/** A file on a message. Downloads through a short-lived signed URL fetched on click. */
export function AttachmentChip({ file, getUrl, locale }: { file: FileInfo; getUrl: () => Promise<string>; locale: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          window.open(await getUrl(), "_blank", "noopener,noreferrer");
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
    >
      <Paperclip className="size-3.5 shrink-0" />
      <bdi className="truncate">{file.filename}</bdi>
      <span className="shrink-0 tabular-nums">{formatBytes(file.size, locale)}</span>
    </button>
  );
}

/** Plain text with links made clickable, paragraph by paragraph so mixed Arabic and Latin text lines up. */
export function MessageText({ text, className }: { text: string; className?: string }) {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <div className={cn("space-y-3 text-sm leading-relaxed break-words", className)}>
      {paragraphs.map((paragraph, i) => (
        <p key={i} dir="auto" className="whitespace-pre-wrap">
          {linkify(paragraph)}
        </p>
      ))}
    </div>
  );
}

function linkify(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s<>"]+)/g).map((part, i) =>
    i % 2 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">
        {part}
      </a>
    ) : (
      part
    )
  );
}

/**
 * The original email exactly as sent, isolated: sanitized with DOMPurify, rendered in a sandboxed
 * iframe that can't run scripts, with remote images blocked until the agent asks for them
 * (they are often tracking pixels).
 */
export function EmailFrame({ html, showImagesLabel }: { html: string; showImagesLabel: string }) {
  const [images, setImages] = useState(false);
  const [height, setHeight] = useState(200);
  const ref = useRef<HTMLIFrameElement>(null);
  const hasRemoteImages = /<img[^>]+src=["']?https?:/i.test(html);

  const srcDoc = useMemo(() => {
    const clean = DOMPurify.sanitize(html, {
      WHOLE_DOCUMENT: false,
      FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select", "iframe", "object", "embed"],
      FORBID_ATTR: ["style"],
    });
    const csp = `default-src 'none'; img-src data: cid:${images ? " https: http:" : ""}; style-src 'unsafe-inline'; font-src data:`;
    return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>body{margin:0;font:14px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#111;word-break:break-word}img{max-width:100%;height:auto}blockquote{margin:0 0 0 .5em;padding-inline-start:.75em;border-inline-start:2px solid #ddd;color:#555}</style></head><body dir="auto">${clean}</body></html>`;
  }, [html, images]);

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    // allow-same-origin is required to read the height; scripts stay disabled, so the content can't use it.
    const measure = () => setHeight(Math.min(1600, (frame.contentDocument?.body?.scrollHeight ?? 200) + 8));
    frame.addEventListener("load", measure);
    return () => frame.removeEventListener("load", measure);
  }, [srcDoc]);

  return (
    <div className="space-y-2">
      {hasRemoteImages && !images && (
        <button type="button" onClick={() => setImages(true)} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
          {showImagesLabel}
        </button>
      )}
      <iframe
        ref={ref}
        title="email"
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        srcDoc={srcDoc}
        style={{ height }}
        className="w-full rounded-md border bg-white"
      />
    </div>
  );
}
