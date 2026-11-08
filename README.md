# Tendkit

Customer support you own. Tendkit is a shared inbox, tickets and a customer portal that you copy into your own app, shadcn-style. There's no hosted service and no package to keep upgrading. The code lives in your repo, reads your own database, and looks like the rest of your product because it uses your components.

- **Native.** The ticket screen shows your customer's account (their orders, payments, plan) from your own database, next to the conversation.
- **Every channel through one interface.** Email via Resend, Microsoft 365, Gmail or any SMTP/IMAP mailbox; SMS and WhatsApp via Twilio; WhatsApp Cloud API; Telegram; and a signed API for your own forms. Adapters use plain `fetch` and WebCrypto, so they run on Cloudflare Workers, Node, Bun and Deno.
- **Correct email.** Replies thread in the customer's mail client. Quoted history is trimmed, including Arabic and French. Out-of-office replies and bounces don't reopen tickets. Copies of the same email collapse into one, and a reply address token keeps threading working when headers are lost.
- **Built for real teams.** It covers assignment, internal notes, "waiting" timers against a response target, spam that blocks the sender, unknown senders you link once, read state per agent, and a portal where customers see their requests.
- **Multilingual.** English, French and Arabic, right-to-left included.

## What you get

| Item | What it installs |
|---|---|
| `support` | The core: ticket model, threading, auto-reply detection, the service your API calls (`lib/support`) |
| `support-postgres` | Drizzle schema, a starting migration and the store for Postgres |
| `support-ui` | Inbox, ticket, composer and customer-portal screens (`components/support`) |
| `channel-resend`, `channel-microsoft365`, `channel-gmail`, `channel-smtp`, `channel-twilio`, `channel-whatsapp`, `channel-telegram`, `channel-api` | One adapter each |

## Install

Tendkit targets Next.js (App Router), Tailwind 4, shadcn/ui, TanStack Query and Drizzle. Other stacks work by editing the copied code, which is yours.

1. Add the registry to `components.json`:

   ```json
   { "registries": { "@tendkit": "https://raw.githubusercontent.com/SoftwareSavants/tendkit/main/public/r/{name}.json" } }
   ```

2. Add the pieces you need:

   ```bash
   npx shadcn add @tendkit/support @tendkit/support-postgres @tendkit/support-ui @tendkit/channel-resend
   ```

   In a monorepo, install server and UI items where they belong: run with `--cwd packages/api` for the server items and `--cwd apps/web` for `support-ui`. Then fix the few imports that cross packages.

3. Add the schema to your Drizzle schema and generate a migration. `lib/support/postgres/0000_init.sql` is the reference.

4. Wire it up. Create the service once per request:

   ```ts
   import { createSupport } from "@/lib/support/service";
   import { createPostgresStore } from "@/lib/support/postgres/store";
   import { resendChannel } from "@/lib/support/channels/resend";

   export const support = createSupport({
     store: createPostgresStore(db),
     storage, // put / get / signed url: S3, R2, Supabase Storage…
     channels: [resendChannel({ id: "email", apiKey, webhookSecret, address: "support@acme.com", replyAddress: "support@in.acme.com" })],
     directory, // who is this email? which customer? who are the agents?
     notify, // email your team
     acknowledgement: () => ({ text: "Thanks — we've received your message and will reply to this email." }),
     fromName: "Acme Support",
   });
   ```

   - **Webhooks:** route `POST /api/webhooks/support/[channel]` to `support.handleWebhook(channel, request)`.
   - **Scheduled job:** call `support.runScheduled()` every few minutes. It polls mailboxes and renews subscriptions.
   - **API:** expose the agent and portal methods through your own API layer, behind your own auth. Pass them to `<SupportProvider>` / `<SupportPortalProvider>` as a client.

Moosyl's integration is a complete example: an oRPC router, Supabase Storage, super admins as agents, and organizations as customers.

## Upgrading

Copied code doesn't update itself. To take a fix:

1. Run `npx shadcn add @tendkit/<item> --diff` to see what changed upstream.
2. Apply what you want.

Keep your own changes out of the engine files (`service.ts`, `text.ts`, `channels/*`) where you can. Put them in your directory, notifier and UI wrappers instead, so diffs stay small.

## Develop

```bash
pnpm install
pnpm typecheck   # browser and server (no DOM) builds
pnpm test        # core against a real Postgres (PGlite), adapters against recorded provider payloads
pnpm registry:build
```

## Licence

MIT
