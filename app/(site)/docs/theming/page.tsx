import type { Metadata } from "next";
import Link from "next/link";
import { Code } from "@/site/code";
import { DocsShell, H2 } from "@/site/docs/shell";

export const metadata: Metadata = {
  title: "Theming",
  description: "Tendkit's screens use your shadcn/ui components and theme tokens. Change anything.",
  alternates: { canonical: "/docs/theming" },
};

export default function Theming() {
  return (
    <DocsShell
      href="/docs/theming"
      toc={[
        { id: "your-tokens", title: "Your tokens" },
        { id: "your-components", title: "Your components" },
        { id: "right-to-left", title: "Right to left" },
        { id: "changing-the-screens", title: "Changing the screens" },
      ]}
    >
      <H2 id="your-tokens">Your tokens</H2>
      <p>
        The screens use the standard shadcn/ui tokens and nothing else: <code>background</code>, <code>card</code>,{" "}
        <code>muted</code>, <code>accent</code>, <code>primary</code>, <code>border</code>, <code>ring</code>,{" "}
        <code>destructive</code> and <code>--radius</code>. Change your theme and the inbox follows. Internal notes use an
        amber tint so they&apos;re never mistaken for replies.
      </p>
      <Code
        title="app/globals.css"
        lang="css"
        code={`:root {
  --primary: oklch(0.52 0.19 258);
  --radius: 0.5rem;
}`}
      />
      <p>
        Try it on the <Link href="/">home page</Link> or in the <Link href="/demo">demo</Link>: the color, radius and font
        controls change these same variables.
      </p>

      <H2 id="your-components">Your components</H2>
      <p>
        The screens import <code>@/components/ui/button</code>, <code>badge</code>, <code>input</code>,{" "}
        <code>textarea</code>, <code>select</code>, <code>dialog</code>, <code>dropdown-menu</code> and{" "}
        <code>skeleton</code>. If you&apos;ve restyled those, the inbox already looks like the rest of your app.
      </p>

      <H2 id="right-to-left">Right to left</H2>
      <p>
        Layout uses logical properties (<code>ms-*</code>, <code>pe-*</code>, <code>text-start</code>) and user text
        renders with <code>dir=&quot;auto&quot;</code>, so Arabic and Hebrew work in a right-to-left page, and a mixed
        inbox shows each message in its own direction.
      </p>

      <H2 id="changing-the-screens">Changing the screens</H2>
      <p>
        It&apos;s your code: edit <code>components/support/*</code> freely. To keep upstream fixes easy to take, put your
        changes in wrappers (the provider, your <code>customerPanel</code>, your pages) rather than in the shared screens
        where you can. See <Link href="/docs/upgrading">Upgrading</Link>.
      </p>
    </DocsShell>
  );
}
