import type { Metadata } from "next";
import Link from "next/link";
import { CHANNELS } from "@/site/channels";
import { Code } from "@/site/code";
import { Callout, DocsShell, H2 } from "@/site/docs/shell";

export const metadata: Metadata = {
  title: "Channels",
  description: "Tendkit adapters for Resend, Microsoft 365, Gmail, SMTP/IMAP, Twilio, WhatsApp, Telegram and a signed API.",
  alternates: { canonical: "/docs/channels" },
};

export default function Channels() {
  return (
    <DocsShell
      href="/docs/channels"
      toc={[
        { id: "adapters", title: "Adapters" },
        { id: "choosing", title: "Choosing an email adapter" },
        { id: "several-channels", title: "Several channels" },
      ]}
    >
      <p>
        A channel connects one provider account to the inbox: it verifies and parses webhooks, and sends replies. Threading,
        storage and rules stay in the service, so every channel behaves the same in the inbox.
      </p>

      <H2 id="adapters">Adapters</H2>
      <div className="my-6 overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start font-medium">Adapter</th>
              <th className="px-3 py-2 text-start font-medium">Channel</th>
              <th className="hidden px-3 py-2 text-start font-medium sm:table-cell">How it connects</th>
            </tr>
          </thead>
          <tbody className="divide-y align-top">
            {CHANNELS.map((c) => (
              <tr key={c.item}>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <Link href={`/docs/channels/${c.item.replace("channel-", "")}`} className="font-medium underline-offset-4 hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{c.kind}</td>
                <td className="hidden px-3 py-2.5 text-muted-foreground sm:table-cell">{c.how}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2 id="choosing">Choosing an email adapter</H2>
      <ul>
        <li>
          <strong>Resend</strong> if you already send with it. Your mailbox stays where it is; a copy of support mail reaches a
          receiving subdomain.
        </li>
        <li>
          <strong>Microsoft 365 or Gmail</strong> to work from the mailbox itself. Replies your team sends from Outlook or Gmail
          are recorded on the ticket.
        </li>
        <li>
          <strong>SMTP and IMAP</strong> for any other host.
        </li>
      </ul>

      <H2 id="several-channels">Several channels</H2>
      <p>
        Pass as many as you need. Each <code>id</code> is stored on its tickets and is the last segment of its webhook URL, so
        pick it once and keep it.
      </p>
      <Code
        title="lib/support/index.ts"
        lang="ts"
        code={`channels: [
  resendChannel({ id: "email", /* … */ }),
  twilioChannel({ id: "sms", from: "+14155550133", /* … */ }),
  whatsappChannel({ id: "whatsapp", /* … */ }),
  apiChannel({ id: "contact-form", /* … */ }),
],`}
      />
      <Callout title="Missing a provider?">
        Adapters are a single file. See <Link href="/docs/channels/custom">Write an adapter</Link>, or pick one from the open
        adapter issues on GitHub.
      </Callout>
    </DocsShell>
  );
}
