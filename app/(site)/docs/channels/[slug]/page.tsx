import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Code } from "@/site/code";
import { CHANNEL_DOCS } from "@/site/docs/channels-data";
import { DocsShell, H2, Props, Step, Steps } from "@/site/docs/shell";
import { ALL_PAGES } from "@/site/docs/nav";

export const dynamicParams = false;

export function generateStaticParams() {
  return CHANNEL_DOCS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = ALL_PAGES.find((p) => p.href === `/docs/channels/${slug}`);
  return { title: `${page?.title} channel`, description: page?.description, alternates: { canonical: `/docs/channels/${slug}` } };
}

export default async function ChannelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = CHANNEL_DOCS.find((c) => c.slug === slug);
  if (!doc) notFound();
  const factory = { resend: "resendChannel", microsoft365: "microsoft365Channel", gmail: "gmailChannel", smtp: "smtpChannel", twilio: "twilioChannel", whatsapp: "whatsappChannel", telegram: "telegramChannel", api: "apiChannel" }[doc.slug];
  return (
    <DocsShell
      href={`/docs/channels/${slug}`}
      toc={[
        { id: "install", title: "Install" },
        { id: "setup", title: "Set up" },
        { id: "configure", title: "Configure" },
        { id: "options", title: "Options" },
        { id: "behaviour", title: "Behaviour" },
      ]}
    >
      <H2 id="install">Install</H2>
      <Code title="Terminal" lang="bash" code={`npx shadcn@latest add @tendkit/${doc.item}`} />
      <p>
        It lands in <code>lib/support/channels/</code>. Import <code>{factory}</code> from there.
      </p>

      <H2 id="setup">Set up</H2>
      <Steps>
        {doc.setup.map((s) => (
          <Step key={s.title} title={s.title}>
            <p className="text-muted-foreground">{s.body}</p>
          </Step>
        ))}
      </Steps>

      <H2 id="configure">Configure</H2>
      <Code title="lib/support/index.ts" lang="ts" code={doc.config} />

      <H2 id="options">Options</H2>
      <Props rows={doc.options} />

      <H2 id="behaviour">Behaviour</H2>
      <ul>
        {doc.notes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
    </DocsShell>
  );
}
