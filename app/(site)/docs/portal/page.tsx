import type { Metadata } from "next";
import { Code } from "@/site/code";
import { Callout, DocsShell, H2, Props } from "@/site/docs/shell";

export const metadata: Metadata = {
  title: "Customer portal",
  description: "Let customers open and follow their support requests inside your app.",
  alternates: { canonical: "/docs/portal" },
};

const API = `const s = support();
const access = { customerId: user.accountId, userId: user.isAccountAdmin ? null : user.id };

// List and read: only this customer's requests (and only their own, with userId).
await s.portal.list({ ...access, readerId: user.id });
await s.portal.get({ ticketId, ...access, readerId: user.id });

// Open a request: becomes a ticket on portalChannelId; replies also go out by email.
await s.portal.create({
  customerId: user.accountId,
  userId: user.id,
  email: user.email,
  name: user.name,
  locale: user.locale,
  subject,
  text,
});

// Reply from the portal.
await s.portal.reply({ ticketId, customerId: user.accountId, userId: user.id, onlyOwn: !user.isAccountAdmin, email: user.email, name: user.name, text });`;

const PAGES = `"use client";

<SupportPortalProvider client={portalClient} listHref="/support" requestHref={(id) => \`/support/\${id}\`}>
  <SupportRequests newRequestOpen={open} onNewRequestOpenChange={setOpen} />
</SupportPortalProvider>

// app/support/[id]/page.tsx
<SupportPortalProvider client={portalClient} listHref="/support" requestHref={(id) => \`/support/\${id}\`}>
  <SupportRequest id={id} />
</SupportPortalProvider>`;

export default function Portal() {
  return (
    <DocsShell
      href="/docs/portal"
      toc={[
        { id: "how-it-works", title: "How it works" },
        { id: "api", title: "API" },
        { id: "screens", title: "Screens" },
        { id: "access", title: "Who sees what" },
      ]}
    >
      <H2 id="how-it-works">How it works</H2>
      <p>
        Customers see their requests and your replies, and can open new ones, without leaving your app. A request opened in
        the portal is a ticket like any other: it arrives in the inbox, and your replies also go out by email on{" "}
        <code>portalChannelId</code>, so the customer can answer from their mail client too. Internal notes and automatic
        mail are never shown.
      </p>

      <H2 id="api">API</H2>
      <Code title="Your API" lang="ts" code={API} />

      <H2 id="screens">Screens</H2>
      <Code title="app/support" lang="tsx" code={PAGES} />
      <Props
        rows={[
          { name: "client", type: "SupportPortalClient", required: true, description: "list, get, create, reply and attachmentUrl, backed by your API." },
          { name: "listHref", type: "string", required: true, description: "The requests list." },
          { name: "requestHref", type: "(id) => string", required: true, description: "One request." },
          { name: "t / locale", type: "", description: "As for the agent screens." },
        ]}
      />

      <H2 id="access">Who sees what</H2>
      <Callout>
        You decide. Pass <code>customerId</code> to scope everything to one customer account, and <code>userId</code> to
        narrow it further to the requests a person opened. Attachment links go through the same check.
      </Callout>
    </DocsShell>
  );
}
