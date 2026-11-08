import type { Metadata } from "next";
import { Code } from "@/site/code";
import { DocsShell, H2 } from "@/site/docs/shell";

export const metadata: Metadata = {
  title: "Upgrading",
  description: "Take upstream Tendkit fixes into code you've copied and changed.",
  alternates: { canonical: "/docs/upgrading" },
};

export default function Upgrading() {
  return (
    <DocsShell
      href="/docs/upgrading"
      toc={[
        { id: "see-what-changed", title: "See what changed" },
        { id: "keep-diffs-small", title: "Keep diffs small" },
        { id: "schema-changes", title: "Schema changes" },
      ]}
    >
      <p>Copied code doesn&apos;t update itself. That&apos;s the point: you choose what to take, and when.</p>

      <H2 id="see-what-changed">See what changed</H2>
      <Code title="Terminal" lang="bash" code={`npx shadcn@latest add @tendkit/support --diff\nnpx shadcn@latest add @tendkit/channel-resend --diff`} />
      <p>Apply the parts you want. The GitHub history explains why each change was made.</p>

      <H2 id="keep-diffs-small">Keep diffs small</H2>
      <ul>
        <li>
          Keep the engine files (<code>service.ts</code>, <code>text.ts</code>, <code>channels/*</code>) as they are.
          Product logic belongs in your directory, notifier, storage and API.
        </li>
        <li>Wrap the screens instead of editing them where you can: your provider, pages and customer panel.</li>
        <li>When you do change a shared file, a short comment marking why makes the next diff easy to read.</li>
      </ul>

      <H2 id="schema-changes">Schema changes</H2>
      <p>
        When an update changes the support schema, regenerate your migration with Drizzle and review it like any other.
        Tendkit never migrates your database for you.
      </p>
    </DocsShell>
  );
}
