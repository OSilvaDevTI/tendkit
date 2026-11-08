"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={copied ? "Copied" : "Copy code"}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
