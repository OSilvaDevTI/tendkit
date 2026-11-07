import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createPostgresStore } from "../registry/support/postgres/store";
import { createSupport, type AttachmentStorage, type SupportNotification, type SupportOptions } from "../registry/support/service";
import type { Channel, ChannelCapabilities, InboundMessage, OutboundMessage, SendResult } from "../registry/support/channel";

const migrationsDir = new URL("../registry/support/postgres/migrations/", import.meta.url);

let template: Promise<PGlite> | undefined;

/** A migrated database. Migrations run once per test file; each test gets a fresh clone. */
export async function createTestDb() {
  template ??= (async () => {
    const client = new PGlite();
    for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
      const sql = readFileSync(new URL(file, migrationsDir), "utf8");
      for (const statement of sql.split("--> statement-breakpoint")) await client.exec(statement);
    }
    return client;
  })();
  return drizzle((await (await template).clone()) as PGlite);
}

export const emailCapabilities: ChannelCapabilities = {
  subject: true,
  attachments: { maxBytes: 10_000_000, maxCount: 10 },
  maxTextLength: null,
  conversation: "thread",
  replyWindowHours: null,
  deliveryReceipts: true,
};

/** A channel that records what it sends instead of calling a provider. */
export function fakeChannel(overrides: Partial<Channel> & { fail?: boolean } = {}) {
  const sent: OutboundMessage[] = [];
  let n = 0;
  const channel: Channel = {
    id: "email",
    kind: "email",
    identityKind: "email",
    address: "support@acme.test",
    replyAddress: "support@in.acme.test",
    capabilities: emailCapabilities,
    async send(message): Promise<SendResult> {
      if (overrides.fail) throw new Error("provider is down");
      sent.push(message);
      n++;
      return { providerMessageId: `out-${n}`, rfcMessageId: `<out-${n}@acme.test>` };
    },
    ...overrides,
  };
  return { channel, sent };
}

export function memoryStorage(): AttachmentStorage & { files: Map<string, Uint8Array> } {
  const files = new Map<string, Uint8Array>();
  return {
    files,
    async put(key, body) {
      files.set(key, body);
    },
    async get(key) {
      const file = files.get(key);
      if (!file) throw new Error(`missing ${key}`);
      return file;
    },
    async url(key) {
      return `https://files.test/${key}`;
    },
  };
}

export const customers = [
  { id: "cus_nour", name: "Boutique Nour" },
  { id: "cus_sahel", name: "Sahel Market" },
];

export const people: Record<string, { customerId: string; userId: string; name: string; locale: string }> = {
  "mariem@nour.test": { customerId: "cus_nour", userId: "usr_mariem", name: "Mariem Mint Ahmed", locale: "en" },
  "sidi@nour.test": { customerId: "cus_nour", userId: "usr_sidi", name: "Sidi", locale: "ar" },
  "ahmed@sahel.test": { customerId: "cus_sahel", userId: "usr_ahmed", name: "Ahmed", locale: "fr" },
};

export async function setup(options: Partial<SupportOptions> = {}, channels?: Channel[]) {
  const db = await createTestDb();
  const store = createPostgresStore(db);
  const storage = memoryStorage();
  const email = fakeChannel();
  const notifications: SupportNotification[] = [];
  let clock = new Date("2026-11-03T09:00:00Z");
  const support = createSupport({
    store,
    storage,
    channels: channels ?? [email.channel],
    directory: {
      async identify(identity) {
        return people[identity.value] ?? null;
      },
      async searchCustomers(query) {
        return customers.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
      },
      async getCustomers(ids) {
        return customers.filter((c) => ids.includes(c.id));
      },
      async listAgents() {
        return [
          { id: "agent_a", name: "Abderrahmane Ould Sidi" },
          { id: "agent_k", name: "Khadija" },
        ];
      },
    },
    notify: async (n) => void notifications.push(n),
    acknowledgement: () => ({ text: "We've received your message and will reply to this email." }),
    fromName: "Acme Support",
    portalChannelId: "email",
    now: () => clock,
    log: () => {},
    ...options,
  });
  return {
    support,
    store,
    storage,
    email,
    notifications,
    advance(ms: number) {
      clock = new Date(clock.getTime() + ms);
      return clock;
    },
    now: () => clock,
  };
}

let seq = 0;
export function inbound(partial: Partial<Omit<InboundMessage, "from">> & { from?: string } = {}): InboundMessage {
  seq++;
  const { from, ...rest } = partial;
  return {
    providerMessageId: `in-${seq}`,
    rfcMessageId: `<in-${seq}@mail.test>`,
    from: { address: from ?? "mariem@nour.test", name: "Mariem" },
    to: [{ address: "support@acme.test" }],
    subject: "Payout not received",
    text: "Salam, we haven't received last week's payout.",
    receivedAt: new Date("2026-11-03T09:00:00Z"),
    ...rest,
  };
}

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
