import type { Metadata } from "next";
import { Code } from "@/site/code";
import { DocsPage, Step } from "@/site/docs-layout";
import { CHANNELS } from "@/site/channels";
import { REGISTRY_URL } from "@/site/config";

export const metadata: Metadata = {
  title: "Channels: email, SMS, WhatsApp and more",
  description:
    "Tendkit adapters for Resend, Microsoft 365, Gmail, SMTP/IMAP, Twilio SMS and WhatsApp, the WhatsApp Cloud API, Telegram and a signed API for your own forms.",
  alternates: { canonical: "/docs/channels" },
};

// Option names match each adapter's config type in registry/support/channels.
const EXAMPLES: Record<string, string> = {
  "channel-resend": `resendChannel({ id: "email", apiKey, webhookSecret, address: "support@acme.com", replyAddress: "support@in.acme.com" })`,
  "channel-microsoft365": `microsoft365Channel({ id: "email", tenantId, clientId, clientSecret, mailbox: "support@acme.com", notificationUrl })`,
  "channel-gmail": `gmailChannel({ id: "email", mailbox: "support@acme.com", auth, pubsub })`,
  "channel-smtp": `smtpChannel({ id: "email", address: "support@acme.com", smtp: transport, imap: poller })`,
  "channel-twilio": `twilioChannel({ id: "whatsapp", accountSid, authToken, from: "whatsapp:+14155550133", webhookUrl })`,
  "channel-whatsapp": `whatsappChannel({ id: "whatsapp", phoneNumberId, accessToken, appSecret, verifyToken, displayNumber: "+1 415 555 0133" })`,
  "channel-telegram": `telegramChannel({ id: "telegram", botToken, secretToken, botUsername: "acme_support_bot" })`,
  "channel-api": `apiChannel({ id: "contact-form", secret, address: "Contact form", kind: "email", replyAddress: "support@in.acme.com" })`,
};

export default function Channels() {
  return (
    <DocsPage
      current="/docs/channels"
      toc={[
        ...CHANNELS.map((c) => ({ id: c.item.replace("channel-", ""), title: c.name })),
        { id: "write-your-own", title: "Write your own" },
      ]}
      title="Channels"
      lead="Each adapter is one file that translates a provider's webhooks and API into tickets and replies. Use several at once; each gets its own id and webhook route."
    >
      {CHANNELS.map((c) => (
        <Step key={c.item} id={c.item.replace("channel-", "")} title={`${c.name} · ${c.kind}`}>
          <p>{c.how}</p>
          <Code title="Terminal" lang="bash" code={`npx shadcn@latest add ${REGISTRY_URL}/${c.item}.json`} />
          <Code title="lib/support/index.ts" lang="ts" code={EXAMPLES[c.item]!} />
        </Step>
      ))}
      <Step id="write-your-own" title="Write your own">
        <p>
          Implement the <code>Channel</code> interface in <code>registry/support/channel.ts</code>: verify and parse
          webhooks into events, and send messages. Threading, storage and rules stay in the service. Open issues list
          the adapters people have asked for.
        </p>
      </Step>
    </DocsPage>
  );
}
