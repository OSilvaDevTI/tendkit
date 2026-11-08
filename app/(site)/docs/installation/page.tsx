import type { Metadata } from "next";
import Link from "next/link";
import { Code } from "@/site/code";
import { REGISTRY_URL } from "@/site/config";
import { Callout, DocsShell, H2, Step, Steps } from "@/site/docs/shell";

export const metadata: Metadata = {
  title: "Installation",
  description: "Add Tendkit to a Next.js app with the shadcn CLI, create the tables and configure the environment.",
  alternates: { canonical: "/docs/installation" },
};

const R = REGISTRY_URL;

export default function Installation() {
  return (
    <DocsShell
      href="/docs/installation"
      toc={[
        { id: "add-the-items", title: "Add the items" },
        { id: "monorepos", title: "Monorepos" },
        { id: "what-lands-where", title: "What lands where" },
        { id: "next-steps", title: "Next steps" },
      ]}
    >
      <H2 id="add-the-items">Add the items</H2>
      <Steps>
        <Step title="Add the Tendkit registry">
          <p className="text-muted-foreground">
            Optional: it lets you write <code>@tendkit/support</code> instead of full URLs. Add it to{" "}
            <code>components.json</code>:
          </p>
          <Code title="components.json" lang="json" code={`{\n  "registries": {\n    "@tendkit": "${R}/{name}.json"\n  }\n}`} className="mt-3" />
        </Step>
        <Step title="Add the engine, a store, the screens and a channel">
          <Code
            title="Terminal"
            lang="bash"
            code={`npx shadcn@latest add @tendkit/support @tendkit/support-postgres @tendkit/support-ui @tendkit/channel-resend`}
            className="mt-1"
          />
          <p className="mt-3 text-muted-foreground">
            Without the registry entry, use the URLs: <code>{`${R}/support.json`}</code>, and so on. Use{" "}
            <code>support-d1</code> instead of <code>support-postgres</code> for SQLite or Cloudflare D1.
          </p>
        </Step>
        <Step title="Create the tables">
          <p className="text-muted-foreground">Export the support schema from your Drizzle schema, then generate a migration.</p>
          <Code title="db/schema.ts" lang="ts" code={`export * from "@/lib/support/postgres/schema";`} className="mt-3" />
          <Code title="Terminal" lang="bash" code={`npx drizzle-kit generate\nnpx drizzle-kit migrate`} className="mt-3" />
          <p className="mt-3 text-muted-foreground">
            The tables are <code>support_tickets</code>, <code>support_messages</code>, <code>support_contacts</code>,{" "}
            <code>support_contact_identities</code>, <code>support_attachments</code>, <code>support_events</code>,{" "}
            <code>support_reads</code> and <code>support_channel_state</code>. The copied <code>0000_init.sql</code> shows
            the exact SQL.
          </p>
        </Step>
        <Step title="Wire it up">
          <p className="text-muted-foreground">
            Create <Link href="/docs/service">the service</Link>, write <Link href="/docs/directory">your directory</Link>,
            add the <Link href="/docs/webhooks">webhook route</Link>, and mount <Link href="/docs/screens">the screens</Link>.
          </p>
        </Step>
      </Steps>

      <H2 id="monorepos">Monorepos</H2>
      <p>
        Install server items where your API lives and the screens where your web app lives, then fix the few imports that
        cross packages (the screens only import types from the engine):
      </p>
      <Code
        title="Terminal"
        lang="bash"
        code={`npx shadcn@latest add @tendkit/support @tendkit/support-d1 @tendkit/channel-resend --cwd packages/api\nnpx shadcn@latest add @tendkit/support-ui --cwd apps/web`}
      />

      <H2 id="what-lands-where">What lands where</H2>
      <ul>
        <li>
          <code>lib/support/</code>: <code>service.ts</code>, <code>store.ts</code>, <code>channel.ts</code>,{" "}
          <code>types.ts</code>, <code>text.ts</code>, <code>address.ts</code>, plus <code>postgres/</code> or{" "}
          <code>d1/</code> and <code>channels/</code>.
        </li>
        <li>
          <code>components/support/</code>: <code>support-inbox.tsx</code>, <code>support-ticket.tsx</code>,{" "}
          <code>support-composer.tsx</code>, <code>support-requests.tsx</code>, <code>link-customer-dialog.tsx</code>,{" "}
          <code>provider.tsx</code>, <code>client.ts</code> and <code>messages/en.json</code>.
        </li>
      </ul>
      <Callout title="Dependencies">
        The CLI installs these for you. The screens use TanStack Query, <code>dompurify</code> (to sanitize HTML email),{" "}
        <code>lucide-react</code> and your shadcn/ui button, badge, input, textarea, select, dialog, dropdown menu and
        skeleton. The stores use <code>drizzle-orm</code>; the Gmail and SMTP adapters use <code>postal-mime</code>. The
        engine itself has no dependencies.
      </Callout>

      <H2 id="next-steps">Next steps</H2>
      <p>
        Continue with <Link href="/docs/service">the service</Link>. To see the end result first, open the{" "}
        <Link href="/demo">live demo</Link>.
      </p>
    </DocsShell>
  );
}
