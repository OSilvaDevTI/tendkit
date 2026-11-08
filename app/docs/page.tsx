import type { Metadata } from "next";
import { Code } from "@/site/code";
import { DocsPage, Step } from "@/site/docs-layout";
import { REGISTRY_URL } from "@/site/config";

export const metadata: Metadata = {
  title: "Add a support inbox to your Next.js app",
  description:
    "Install Tendkit with the shadcn CLI, add the tables, connect a channel and your users, and mount the inbox and customer portal screens.",
  alternates: { canonical: "/docs" },
};

const R = REGISTRY_URL;

export default function GetStarted() {
  return (
    <DocsPage
      current="/docs"
      toc={[
        { id: "install", title: "Install" },
        { id: "database", title: "Add the tables" },
        { id: "service", title: "Create the service" },
        { id: "directory", title: "Who people are" },
        { id: "webhooks", title: "Webhooks and schedule" },
        { id: "screens", title: "Mount the screens" },
        { id: "upgrading", title: "Upstream fixes" },
      ]}
      title="Add a support inbox to your app"
      lead="Tendkit targets Next.js (App Router), Tailwind 4, shadcn/ui, TanStack Query and Drizzle. Other stacks work by editing the copied code, which is yours."
    >
      <Step id="install" title="1. Install">
        <p>
          Add the core, a store for your database, the screens, and one adapter per channel. Use{" "}
          <code>support-d1</code> instead of <code>support-postgres</code> for SQLite or Cloudflare D1.
        </p>
        <Code
          title="Terminal"
          lang="bash"
          code={`npx shadcn@latest add \\
  ${R}/support.json \\
  ${R}/support-postgres.json \\
  ${R}/support-ui.json \\
  ${R}/channel-resend.json`}
        />
        <p>
          In a monorepo, run it with <code>--cwd packages/api</code> for the server items and <code>--cwd apps/web</code> for{" "}
          <code>support-ui</code>, then fix the few imports that cross packages.
        </p>
      </Step>

      <Step id="database" title="2. Add the tables">
        <p>
          Export the support schema from your Drizzle schema and generate a migration. The copied{" "}
          <code>0000_init.sql</code> is the reference. For D1 there are no transactions: the store removes what it
          created if a later write fails.
        </p>
        <Code title="db/schema/index.ts" lang="ts" code={`export * from "@/lib/support/postgres/schema";`} />
      </Step>

      <Step id="service" title="3. Create the service">
        <p>Build it once per request with your database, file storage, channels and directory.</p>
        <Code
          title="lib/support/index.ts"
          code={`import { createSupport } from "@/lib/support/service";
import { createPostgresStore } from "@/lib/support/postgres/store";
import { resendChannel } from "@/lib/support/channels/resend";

export const support = () =>
  createSupport({
    store: createPostgresStore(db),
    storage, // put / get / signed url: S3, R2, Supabase Storage…
    channels: [
      resendChannel({
        id: "email", // stored on every ticket: never change it
        apiKey: process.env.RESEND_API_KEY!, // Full access: reading received mail needs it
        webhookSecret: process.env.RESEND_WEBHOOK_SECRET!,
        address: "support@acme.com",
        replyAddress: "support@in.acme.com",
      }),
    ],
    directory, // step 4
    notify: async (n) => { /* email your team: n.type, n.ticket */ },
    acknowledgement: () => ({ text: "Thanks, we've received your message and will reply to this email." }),
    fromName: "Acme Support",
    portalChannelId: "email",
    ignoreFrom: ["noreply@acme.com"], // your app's own alerts to support@
  });`}
        />
      </Step>

      <Step id="directory" title="4. Tell it who people are">
        <p>
          The directory is the only part that knows your product. <code>identify</code> matches a sender to a user and
          account; the rest power search, linking and assignment.
        </p>
        <Code
          title="lib/support/directory.ts"
          code={`export const directory: SupportDirectory = {
  async identify({ kind, value }) {
    if (kind !== "email") return null;
    const user = await db.query.users.findFirst({ where: eq(users.email, value) });
    return user ? { customerId: user.accountId, userId: user.id, name: user.name } : null;
  },
  searchCustomers: (q) => db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(ilike(accounts.name, \`%\${q}%\`)).limit(10),
  getCustomers: (ids) => db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(inArray(accounts.id, ids)),
  listAgents: () => db.select({ id: users.id, name: users.name }).from(users).where(eq(users.role, "admin")),
};`}
        />
      </Step>

      <Step id="webhooks" title="5. Receive webhooks and run the schedule">
        <p>
          Route provider webhooks to <code>handleWebhook</code>. It verifies the signature, ingests the events and
          answers the provider.
        </p>
        <Code
          title="app/api/webhooks/support/[channel]/route.ts"
          code={`export async function POST(request: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel } = await params;
  return support().handleWebhook(channel, request);
}`}
        />
        <p>
          Call <code>support().runScheduled()</code> every few minutes from a cron. It polls mailboxes and renews
          subscriptions for the channels that need it, and does nothing for push-only channels.
        </p>
      </Step>

      <Step id="screens" title="6. Mount the screens">
        <p>
          Expose the service through your own API layer, behind your own auth, then implement{" "}
          <code>SupportClient</code> with it and wrap the screens in <code>SupportProvider</code>. Pass{" "}
          <code>customerPanel</code> to show your own data next to each ticket.
        </p>
        <Code
          title="app/admin/support/page.tsx"
          code={`<SupportProvider
  client={supportClient}
  viewerId={user.id}
  inboxHref="/admin/support"
  ticketHref={(id) => \`/admin/support/\${id}\`}
  customerPanel={(detail) => <AccountPanel accountId={detail.customer?.id} />}
>
  <SupportInbox />
</SupportProvider>`}
        />
        <p>
          Customers get <code>SupportRequests</code> and <code>SupportRequest</code> inside{" "}
          <code>SupportPortalProvider</code>, backed by <code>support().portal</code>. You decide who sees what: pass a{" "}
          <code>userId</code> to show someone only the requests they opened.
        </p>
      </Step>

      <Step id="upgrading" title="Taking upstream fixes">
        <p>
          Copied code doesn&apos;t update itself. Run <code>npx shadcn@latest add {"<item>"} --diff</code> to see what
          changed and apply what you want. Keep your own changes in the directory, notifier and UI wrappers so the
          engine files stay easy to diff.
        </p>
      </Step>
    </DocsPage>
  );
}
