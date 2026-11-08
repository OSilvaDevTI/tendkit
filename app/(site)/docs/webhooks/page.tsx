import type { Metadata } from "next";
import { Code } from "@/site/code";
import { Callout, DocsShell, H2, Props } from "@/site/docs/shell";

export const metadata: Metadata = {
  title: "Webhooks and scheduling",
  description: "Route provider webhooks to Tendkit and run the scheduled job that polls mailboxes and renews subscriptions.",
  alternates: { canonical: "/docs/webhooks" },
};

export default function Webhooks() {
  return (
    <DocsShell
      href="/docs/webhooks"
      toc={[
        { id: "the-route", title: "The webhook route" },
        { id: "responses", title: "Responses" },
        { id: "scheduled-job", title: "The scheduled job" },
        { id: "other-runtimes", title: "Other runtimes" },
      ]}
    >
      <H2 id="the-route">The webhook route</H2>
      <p>
        One route serves every channel: the last path segment is the channel <code>id</code>. Point each provider&apos;s
        webhook at its URL, such as <code>https://acme.com/api/webhooks/support/email</code>.
      </p>
      <Code
        title="app/api/webhooks/support/[channel]/route.ts"
        lang="ts"
        code={`import { support } from "@/lib/support";

export async function POST(request: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel } = await params;
  return support().handleWebhook(channel, request);
}

// Meta (WhatsApp Cloud API) verifies the URL with a GET first.
export const GET = POST;`}
      />
      <p>
        <code>handleWebhook</code> verifies the signature, ingests every event and answers the provider. Ingestion is
        idempotent: a redelivered webhook never creates a second message.
      </p>

      <H2 id="responses">Responses</H2>
      <Props
        rows={[
          { name: "200", type: "", description: "Accepted, or the provider's expected body (an empty TwiML document, a verification challenge)." },
          { name: "401 / 400", type: "", description: "The signature or payload didn't verify. Nothing was stored." },
          { name: "404", type: "", description: "No channel with that id, or it doesn't receive webhooks." },
          { name: "500", type: "", description: "Storing failed. The provider retries, which is safe." },
        ]}
      />

      <H2 id="scheduled-job">The scheduled job</H2>
      <p>
        Call <code>runScheduled()</code> every few minutes. It polls channels that read mailboxes (Gmail, Microsoft 365,
        IMAP), renews push subscriptions and watches, and marks replies stuck sending for more than ten minutes as failed
        so an agent can retry. Push-only channels make it a no-op, and it&apos;s safe to run concurrently.
      </p>
      <Code
        title="app/api/cron/support/route.ts"
        lang="ts"
        code={`import { support } from "@/lib/support";

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== \`Bearer \${process.env.CRON_SECRET}\`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await support().runScheduled());
}`}
      />
      <p>It returns a summary such as <code>{`{ channels: { email: "3 events" }, staleFailed: 0 }`}</code>.</p>

      <H2 id="other-runtimes">Other runtimes</H2>
      <p>On Cloudflare Workers, run it from the scheduled handler next to your fetch handler:</p>
      <Code
        title="worker.ts"
        lang="ts"
        code={`export default {
  fetch: app.fetch,
  scheduled(_event, _env, ctx) {
    ctx.waitUntil(support().runScheduled());
  },
};`}
      />
      <Callout title="Keep the webhook URL stable">
        Twilio signs the exact URL it calls. If your app sits behind a proxy, configure the public URL in the adapter
        rather than rebuilding it from the incoming request.
      </Callout>
    </DocsShell>
  );
}
