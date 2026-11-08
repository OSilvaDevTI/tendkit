import {
  ChannelError,
  WebhookError,
  type Channel,
  type ChannelEvent,
  type InboundMessage,
  type OutboundAttachment,
} from "./channel";
import { addressWithToken, baseSubject, normalizeIdentity, replySubject, tokenFromAddress } from "./address";
import {
  automatedReason,
  senderFailedAuthentication,
  htmlToText,
  signatureFromHtml,
  snippet,
  textToHtml,
  visibleReply,
  withoutSignature,
} from "./text";
import type { SupportStore, TicketQuery } from "./store";
import type {
  Address,
  Agent,
  Attachment,
  Contact,
  CustomerSummary,
  DeliveryStatus,
  Identity,
  Message,
  Ticket,
  TicketEvent,
  TicketStatus,
} from "./types";

/** Where attachment bytes live: S3, R2, Supabase Storage, a disk. */
export interface AttachmentStorage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  /** A short-lived URL that downloads the file (Content-Disposition: attachment). */
  url(key: string, options: { filename: string; expiresInSeconds: number }): Promise<string>;
}

/** What only your product knows: who people are, which customer they belong to, who your agents are. */
export interface SupportDirectory {
  /** Called for new contacts and for contacts not yet linked to a customer. */
  identify(identity: Identity): Promise<{
    customerId: string | null;
    userId?: string | null;
    name?: string | null;
    locale?: string | null;
  } | null>;
  searchCustomers(query: string): Promise<CustomerSummary[]>;
  getCustomers(ids: string[]): Promise<CustomerSummary[]>;
  listAgents(): Promise<Agent[]>;
}

export type SupportNotification =
  | { type: "ticket.created"; ticket: Ticket; message: Message; contact: Contact }
  | { type: "ticket.customer_replied"; ticket: Ticket; message: Message; contact: Contact }
  | { type: "ticket.assigned"; ticket: Ticket; assigneeId: string; actorId: string }
  | { type: "message.failed"; ticket: Ticket; message: Message };

export type SupportOptions = {
  store: SupportStore;
  storage: AttachmentStorage;
  channels: Channel[];
  directory: SupportDirectory;
  /** Emails and alerts to your team. Errors are logged, never thrown into ingestion. */
  notify?: (notification: SupportNotification) => Promise<void>;
  /**
   * The automatic first reply to new email tickets, or null for none. Only sent to senders who
   * matched a customer, so spam and spoofed mail never get one.
   */
  acknowledgement?: (context: { contact: Contact; ticket: Ticket }) => { text: string } | null;
  /** Appended to agent replies. Defaults to the agent's first name. */
  signature?: (agent: Agent) => string;
  /** The display name replies are sent as, such as "Acme Support". */
  fromName?: string;
  /**
   * Senders whose mail never becomes a ticket, such as the no-reply address your app sends team
   * alerts from. Without this, an alert sent to a mailbox that copies into the inbox opens a ticket.
   */
  ignoreFrom?: string[];
  /** The channel that tickets opened from your own app (a portal, a contact form) reply on. */
  portalChannelId?: string;
  /** Days after solving during which a customer reply reopens the ticket. Later replies start a new one. */
  reopenWindowDays?: number;
  maxAttachmentBytes?: number;
  now?: () => Date;
  log?: (level: "info" | "warn" | "error", message: string, data?: Record<string, unknown>) => void;
};

export type ReplyStatus = Extract<TicketStatus, "open" | "waiting" | "solved">;

export type TicketListItem = Ticket & {
  contact: Pick<Contact, "id" | "name" | "identities" | "customerId">;
  customer: CustomerSummary | null;
  assignee: Agent | null;
  unread: boolean;
};

export type TimelineEntry =
  | { type: "message"; at: Date; message: Message }
  | { type: "event"; at: Date; event: TicketEvent };

export type TicketDetail = {
  ticket: Ticket;
  contact: Contact;
  customer: CustomerSummary | null;
  assignee: Agent | null;
  timeline: TimelineEntry[];
  channel: { id: string; kind: Channel["kind"]; address: string; capabilities: Channel["capabilities"] } | null;
  /** Why a reply can't be sent right now, or null when it can. */
  replyBlockedReason: "reply_window_closed" | "no_channel" | "no_recipient" | null;
  previousTickets: Pick<Ticket, "id" | "number" | "subject" | "status" | "lastMessageAt">[];
};

export type PortalTicket = Pick<
  Ticket,
  "id" | "subject" | "status" | "createdAt" | "lastMessageAt" | "preview" | "previewKind"
> & { previewAuthor: string | null; unread: boolean };

export type PortalMessage = {
  id: string;
  kind: "inbound" | "outbound";
  author: string | null;
  text: string;
  createdAt: Date;
  attachments: Pick<Attachment, "id" | "filename" | "contentType" | "size">[];
};

const DAY = 86_400_000;
const DELIVERY_ORDER: Record<DeliveryStatus, number> = { queued: 0, sent: 1, delivered: 2, read: 3, failed: 4 };

export class SupportError extends Error {
  constructor(
    readonly code: "not_found" | "forbidden" | "invalid" | "reply_window_closed" | "too_large",
    message: string
  ) {
    super(message);
    this.name = "SupportError";
  }
}

class Duplicate extends Error {}

export function createSupport(options: SupportOptions) {
  const { store, storage, directory } = options;
  const now = options.now ?? (() => new Date());
  const reopenWindowMs = (options.reopenWindowDays ?? 14) * DAY;
  const maxAttachmentBytes = options.maxAttachmentBytes ?? 25 * 1024 * 1024;
  const log = options.log ?? ((level, message, data) => console[level](`[support] ${message}`, data ?? ""));
  const channels = new Map(options.channels.map((c) => [c.id, c]));

  const channel = (id: string) => channels.get(id) ?? null;
  const ownAddresses = new Set(
    options.channels.flatMap((c) => [c.address, c.replyAddress].filter(Boolean).map((a) => a!.toLowerCase()))
  );
  const ignored = new Set((options.ignoreFrom ?? []).map((a) => a.toLowerCase()));
  const isOwnAddress = (address: string) => {
    const lower = address.toLowerCase();
    if (ownAddresses.has(lower) || ignored.has(lower)) return true;
    // support+t-token@in.acme.com is ours too.
    return [...ownAddresses].some((own) => {
      const [local, domain] = own.split("@");
      return domain && lower.endsWith(`@${domain}`) && lower.startsWith(`${local}+`);
    });
  };

  const safeNotify = async (n: SupportNotification) => {
    try {
      await options.notify?.(n);
    } catch (error) {
      log("error", "notification failed", { type: n.type, error: String(error) });
    }
  };

  const agentsById = async () => new Map((await directory.listAgents()).map((a) => [a.id, a]));

  // ---------------------------------------------------------------- inbound

  /**
   * Finds or creates the person behind an identity. Only `trusted` messages (the sender is
   * authenticated) may link them to an account: a contact form or a spoofed From must never file
   * a ticket under a real customer.
   */
  async function resolveContact(identity: Identity, name: string | null | undefined, trusted: boolean): Promise<Contact> {
    const existing = await store.findContactByIdentity(identity);
    if (!trusted) {
      return existing ?? store.createContact({ name: name?.trim() || null, customerId: null, userId: null, locale: null, identities: [identity] });
    }
    // People without an account keep the customer an agent linked them to. Account holders are
    // looked up again, so someone who moved to another customer is filed under the new one.
    if (existing?.customerId && !existing.userId) return existing;
    const known = await directory.identify(identity).catch((error) => {
      log("warn", "directory.identify failed", { error: String(error) });
      return null;
    });
    if (existing) {
      if (known && (known.customerId !== existing.customerId || known.userId !== existing.userId)) {
        await store.updateContact(existing.id, {
          customerId: known.customerId ?? existing.customerId,
          userId: known.userId ?? existing.userId,
          name: existing.name ?? known.name ?? name ?? null,
          locale: existing.locale ?? known.locale ?? null,
        });
        if (known.customerId) await store.linkContactTickets(existing.id, known.customerId);
        return (await store.getContact(existing.id))!;
      }
      return existing;
    }
    return store.createContact({
      name: known?.name ?? name?.trim() ?? null,
      customerId: known?.customerId ?? null,
      userId: known?.userId ?? null,
      locale: known?.locale ?? null,
      identities: [identity],
    });
  }

  /** A ticket may only receive a message from its own contact or a colleague at the same customer. */
  const belongsTo = (ticket: Ticket | null, contact: Contact) =>
    ticket && (ticket.contactId === contact.id || (ticket.customerId !== null && ticket.customerId === contact.customerId))
      ? ticket
      : null;

  async function findThread(ch: Channel, msg: InboundMessage, contact: Contact, trusted: boolean): Promise<Ticket | null> {
    for (const address of [...msg.to, ...(msg.cc ?? [])]) {
      const token = tokenFromAddress(address.address);
      if (token) {
        const ticket = belongsTo(await store.findTicketByToken(token), contact);
        if (ticket) return ticket;
      }
    }
    // Message-IDs aren't secret: an unauthenticated sender only threads with the token.
    if (!trusted) return null;
    const ids = [...(msg.references ?? []), msg.inReplyTo].filter((id): id is string => Boolean(id));
    if (ids.length) {
      const ticket = belongsTo(await store.findTicketByRfcMessageIds(ids), contact);
      if (ticket) return ticket;
    }
    if (msg.providerThreadId) {
      const ticket = belongsTo(await store.findTicketByProviderThread(ch.id, msg.providerThreadId), contact);
      if (ticket) return ticket;
    }
    if (ch.capabilities.conversation === "contact") return store.findLatestTicket(ch.id, contact.id);
    return null;
  }

  async function ingest(channelId: string, event: ChannelEvent) {
    const ch = channel(channelId);
    if (!ch) throw new Error(`Unknown channel ${channelId}`);
    if (event.type === "status") return applyStatus(ch, event);
    const msg = event.message;
    return msg.direction === "outbound" ? ingestOwnMessage(ch, msg) : ingestMessage(ch, msg);
  }

  async function applyStatus(ch: Channel, event: Extract<ChannelEvent, { type: "status" }>) {
    const message = await store.findMessageByProviderId(ch.id, event.providerMessageId);
    if (!message) return { result: "ignored" as const };
    // Learning our Message-ID late still lets customers' replies thread on In-Reply-To.
    if (event.rfcMessageId && !message.rfcMessageId) {
      await store.updateMessage(message.id, { rfcMessageId: event.rfcMessageId });
    }
    const current = message.deliveryStatus ?? "queued";
    if (event.status !== "failed" && DELIVERY_ORDER[event.status] <= DELIVERY_ORDER[current]) {
      return { result: "ignored" as const };
    }
    await store.updateMessage(message.id, { deliveryStatus: event.status, deliveryError: event.error ?? null });
    if (event.status === "failed" && current !== "failed") {
      const ticket = await store.getTicket(message.ticketId);
      if (ticket) await safeNotify({ type: "message.failed", ticket, message: { ...message, deliveryStatus: "failed" } });
    }
    return { result: "updated" as const };
  }

  /** Mail your team sent from the mailbox itself (Outlook, Gmail): recorded as a reply. */
  async function ingestOwnMessage(ch: Channel, msg: InboundMessage) {
    if (await store.findMessageByProviderId(ch.id, msg.providerMessageId)) return { result: "duplicate" as const };
    const ids = [...(msg.references ?? []), msg.inReplyTo].filter((id): id is string => Boolean(id));
    const ticket =
      (ids.length ? await store.findTicketByRfcMessageIds(ids) : null) ??
      (msg.providerThreadId ? await store.findTicketByProviderThread(ch.id, msg.providerThreadId) : null);
    if (!ticket) return { result: "ignored" as const };
    // A reply sent from here can show up in the mailbox's Sent folder before its send finished
    // recording; the shared Message-ID tells us it's the same message.
    if (msg.rfcMessageId) {
      const existing = await store.listMessages(ticket.id, { includeNotes: false });
      if (existing.some((m) => m.kind === "outbound" && m.rfcMessageId === msg.rfcMessageId)) {
        return { result: "duplicate" as const };
      }
    }
    const text = msg.text ?? (msg.html ? htmlToText(msg.html) : "");
    const at = msg.receivedAt;
    const inserted = await store.insertMessage({
      ticketId: ticket.id,
      kind: "outbound",
      channelId: ch.id,
      authorId: null,
      from: msg.from,
      to: msg.to,
      cc: msg.cc ?? [],
      subject: msg.subject ?? null,
      text: withoutSignature(visibleReply(text), signatureFromHtml(msg.html)),
      fullText: text,
      html: msg.html ?? null,
      rfcMessageId: msg.rfcMessageId ?? null,
      inReplyTo: msg.inReplyTo ?? null,
      references: msg.references ?? [],
      providerMessageId: msg.providerMessageId,
      deliveryStatus: "sent",
      deliveryError: null,
      auto: false,
      source: "agent",
      createdAt: at,
    });
    if (!inserted) return { result: "duplicate" as const };
    await store.updateTicket(ticket.id, {
      waitingSince: null,
      lastOutboundAt: at,
      lastMessageAt: at > ticket.lastMessageAt ? at : ticket.lastMessageAt,
      preview: snippet(inserted.text),
      previewKind: "outbound",
      previewAuthorId: null,
      ...(ticket.status === "open" ? { status: "waiting" as const } : {}),
    });
    return { result: "recorded" as const, ticketId: ticket.id };
  }

  async function ingestMessage(ch: Channel, msg: InboundMessage) {
    if (ch.kind === "email" && isOwnAddress(msg.from.address)) return { result: "ignored" as const, reason: "own_address" };
    if (await store.findMessageByProviderId(ch.id, msg.providerMessageId)) return { result: "duplicate" as const };

    const automated = ch.kind === "email" ? automatedReason(msg.headers, msg.from.address) : null;
    const trusted = msg.source !== "api" && !(ch.kind === "email" && senderFailedAuthentication(msg.headers));
    const identity = normalizeIdentity(ch.identityKind, msg.from.address);
    const contact = await resolveContact(identity, msg.from.name, trusted);
    // A block never applies to a verified account holder: it may have come from a spoofed message.
    if (contact.blockedAt && !(trusted && contact.userId)) return { result: "ignored" as const, reason: "blocked" };

    const fullText = (msg.text?.trim() ? msg.text : msg.html ? htmlToText(msg.html) : "").trim();
    const text = ch.kind === "email" ? withoutSignature(visibleReply(fullText), signatureFromHtml(msg.html)) : fullText;
    const at = msg.receivedAt;
    const found = await findThread(ch, msg, contact, trusted);

    let outcome: { ticket: Ticket; message: Message; created: boolean; reopened: boolean };
    try {
      outcome = await store.transaction(async (tx) => {
        let ticket = found;
        let created = false;
        let reopened = false;
        let followUpOf: Ticket | null = null;

        if (ticket?.status === "solved" && !automated) {
          if (ticket.solvedAt && at.getTime() - ticket.solvedAt.getTime() <= reopenWindowMs) reopened = true;
          else {
            followUpOf = ticket;
            ticket = null;
          }
        }

        if (!ticket) {
          ticket = await tx.createTicket({
            channelId: ch.id,
            subject: ch.capabilities.subject ? baseSubject(msg.subject) || null : null,
            status: "open",
            contactId: contact.id,
            customerId: trusted ? contact.customerId : null,
            assigneeId: followUpOf?.assigneeId ?? null,
            replyToken: randomToken(),
            providerThreadId: msg.providerThreadId ?? null,
            createdAt: at,
          });
          created = true;
          await tx.insertEvent({ ticketId: ticket.id, type: "created", actorId: null, data: {}, createdAt: at });
          if (followUpOf) {
            await tx.insertEvent({
              ticketId: ticket.id,
              type: "follow_up",
              actorId: null,
              data: { ticketId: followUpOf.id, number: followUpOf.number },
              createdAt: at,
            });
          }
        }

        const message = await tx.insertMessage({
          ticketId: ticket.id,
          kind: "inbound",
          channelId: ch.id,
          authorId: null,
          from: msg.from,
          to: msg.to,
          cc: msg.cc ?? [],
          subject: msg.subject ?? null,
          text,
          fullText,
          html: msg.html ?? null,
          rfcMessageId: msg.rfcMessageId ?? null,
          inReplyTo: msg.inReplyTo ?? null,
          references: msg.references ?? [],
          providerMessageId: msg.providerMessageId,
          deliveryStatus: null,
          deliveryError: null,
          auto: Boolean(automated),
          source: msg.source ?? "channel",
          createdAt: at,
        });
        if (!message) throw new Duplicate();

        if (!automated) {
          ticket = await tx.updateTicket(ticket.id, {
            status: ticket.status === "spam" ? "spam" : "open",
            waitingSince: ticket.waitingSince ?? at,
            lastInboundAt: at,
            lastMessageAt: at > ticket.lastMessageAt ? at : ticket.lastMessageAt,
            solvedAt: null,
            preview: snippet(text),
            previewKind: "inbound",
            previewAuthorId: null,
            providerThreadId: ticket.providerThreadId ?? msg.providerThreadId ?? null,
            // The sender may have been matched to a customer since the ticket was opened.
            customerId: ticket.customerId ?? (trusted ? contact.customerId : null),
          });
          if (reopened) {
            await tx.insertEvent({ ticketId: ticket.id, type: "reopened", actorId: null, data: {}, createdAt: at });
          }
        }
        return { ticket, message, created, reopened };
      });
    } catch (error) {
      if (error instanceof Duplicate) return { result: "duplicate" as const };
      throw error;
    }

    const attachments = await saveInboundAttachments(outcome.ticket.id, outcome.message.id, msg);
    const message = { ...outcome.message, attachments };

    if (!automated && outcome.ticket.status !== "spam") {
      await safeNotify({
        type: outcome.created ? "ticket.created" : "ticket.customer_replied",
        ticket: outcome.ticket,
        message,
        contact,
      });
      if (outcome.created && ch.kind === "email" && trusted) await sendAcknowledgement(ch, outcome.ticket, contact, message);
    }
    return { result: outcome.created ? ("created" as const) : ("appended" as const), ticketId: outcome.ticket.id };
  }

  async function saveInboundAttachments(ticketId: string, messageId: string, msg: InboundMessage) {
    const saved: Attachment[] = [];
    for (const file of msg.attachments ?? []) {
      if (file.size !== null && file.size > maxAttachmentBytes) {
        log("warn", "attachment skipped: too large", { messageId, size: file.size });
        continue;
      }
      try {
        const bytes = await file.read();
        if (bytes.byteLength > maxAttachmentBytes) continue;
        const key = `${ticketId}/${crypto.randomUUID()}/${safeFilename(file.filename)}`;
        await storage.put(key, bytes, file.contentType);
        saved.push(
          await store.insertAttachment({
            ticketId,
            messageId,
            filename: file.filename,
            contentType: file.contentType,
            size: bytes.byteLength,
            storageKey: key,
            contentId: file.contentId ?? null,
            inline: file.inline ?? false,
          })
        );
      } catch (error) {
        // The message is already saved; a lost attachment shouldn't make the provider redeliver it.
        log("error", "attachment download failed", { messageId, filename: file.filename, error: String(error) });
      }
    }
    return saved;
  }

  async function sendAcknowledgement(ch: Channel, ticket: Ticket, contact: Contact, message: Message) {
    if (!contact.customerId || !options.acknowledgement || !message.from) return;
    const ack = options.acknowledgement({ contact, ticket });
    if (!ack) return;
    try {
      await sendOutbound(ch, ticket, {
        text: ack.text,
        to: [message.from],
        auto: true,
        authorId: null,
        attachments: [],
        replyTo: message,
        headers: { "Auto-Submitted": "auto-replied", "X-Auto-Response-Suppress": "All" },
      });
    } catch (error) {
      log("warn", "acknowledgement failed", { ticketId: ticket.id, error: String(error) });
    }
  }

  // --------------------------------------------------------------- outbound

  async function sendOutbound(
    ch: Channel,
    ticket: Ticket,
    input: {
      /** What is sent, signature included. */
      text: string;
      /** What screens show; defaults to `text`. */
      displayText?: string;
      to: Address[];
      auto: boolean;
      authorId: string | null;
      attachments: Attachment[];
      replyTo: Message | null;
      headers?: Record<string, string>;
      existing?: Message;
      /** A new idempotency key, so the provider doesn't replay the earlier attempt's answer. */
      attemptKey?: string;
    }
  ): Promise<Message> {
    const at = now();
    const isEmail = ch.kind === "email";
    const references = input.replyTo
      ? [...input.replyTo.references, input.replyTo.rfcMessageId].filter((id): id is string => Boolean(id)).slice(-20)
      : [];
    const message =
      input.existing ??
      (await store.insertMessage({
        ticketId: ticket.id,
        kind: "outbound",
        channelId: ch.id,
        authorId: input.authorId,
        from: { address: ch.address, name: options.fromName ?? null },
        to: input.to,
        cc: [],
        subject: isEmail ? replySubject(ticket.subject) : null,
        text: input.displayText ?? input.text,
        fullText: input.text,
        html: null,
        rfcMessageId: null,
        inReplyTo: input.replyTo?.rfcMessageId ?? null,
        references,
        providerMessageId: null,
        deliveryStatus: "queued",
        deliveryError: null,
        auto: input.auto,
        source: "agent",
        createdAt: at,
      }))!;
    if (!input.existing) await store.linkAttachments(input.attachments.map((a) => a.id), message.id);

    let files: OutboundAttachment[] = [];
    try {
      files = await Promise.all(
        input.attachments.map(async (a) => ({
          filename: a.filename,
          contentType: a.contentType,
          content: await storage.get(a.storageKey),
        }))
      );
      const result = await ch.send({
        id: input.attemptKey ?? message.id,
        to: input.to,
        fromName: options.fromName ?? null,
        replyTo: isEmail && ch.replyAddress ? { address: addressWithToken(ch.replyAddress, ticket.replyToken) } : null,
        subject: message.subject,
        text: input.text,
        html: isEmail ? textToHtml(input.text) : null,
        attachments: files,
        inReplyTo: message.inReplyTo,
        references: message.references,
        providerThreadId: ticket.providerThreadId,
        replyToProviderMessageId: input.replyTo?.providerMessageId ?? null,
        headers: input.headers,
      });
      const delivered = {
        deliveryStatus: result.status ?? ("sent" as const),
        deliveryError: null,
        providerMessageId: result.providerMessageId,
        rfcMessageId: result.rfcMessageId ?? null,
      };
      await store.updateMessage(message.id, delivered);
      if (result.providerThreadId && !ticket.providerThreadId) {
        await store.updateTicket(ticket.id, { providerThreadId: result.providerThreadId });
      }
      return { ...message, ...delivered, attachments: input.attachments };
    } catch (error) {
      const reason =
        error instanceof ChannelError || error instanceof Error ? error.message : "The message could not be sent.";
      await store.updateMessage(message.id, { deliveryStatus: "failed", deliveryError: reason });
      log("error", "send failed", { messageId: message.id, channelId: ch.id, error: reason });
      return { ...message, deliveryStatus: "failed", deliveryError: reason, attachments: input.attachments };
    }
  }

  async function getTicketOrThrow(id: string) {
    const ticket = await store.getTicket(id);
    if (!ticket) throw new SupportError("not_found", "Ticket not found");
    return ticket;
  }

  /** Who the next reply goes to: whoever wrote last on this channel, else the contact's identity. */
  async function recipientFor(ticket: Ticket, ch: Channel, contact: Contact) {
    const messages = await store.listMessages(ticket.id, { includeNotes: false });
    const lastInbound = [...messages].reverse().find((m) => m.kind === "inbound" && m.channelId === ch.id) ?? null;
    const identity = contact.identities.find((i) => i.kind === ch.identityKind);
    const to = lastInbound?.from ?? (identity ? { address: identity.value, name: contact.name } : null);
    return { to, lastInbound };
  }

  function replyBlockedReason(ticket: Ticket, ch: Channel | null): TicketDetail["replyBlockedReason"] {
    if (!ch) return "no_channel";
    const hours = ch.capabilities.replyWindowHours;
    if (hours !== null) {
      if (!ticket.lastInboundAt || now().getTime() - ticket.lastInboundAt.getTime() > hours * 3_600_000) {
        return "reply_window_closed";
      }
    }
    return null;
  }

  async function reply(input: {
    ticketId: string;
    agentId: string;
    text: string;
    attachmentIds?: string[];
    status?: ReplyStatus;
  }) {
    const text = input.text.trim();
    if (!text) throw new SupportError("invalid", "Write a message first.");
    const ticket = await getTicketOrThrow(input.ticketId);
    const ch = channel(ticket.channelId);
    if (!ch) throw new SupportError("invalid", "This ticket's channel is no longer configured.");
    const blocked = replyBlockedReason(ticket, ch);
    if (blocked === "reply_window_closed") {
      throw new SupportError("reply_window_closed", "The customer hasn't written in the last 24 hours.");
    }
    if (ch.capabilities.maxTextLength && text.length > ch.capabilities.maxTextLength) {
      throw new SupportError("too_large", `Messages on this channel are limited to ${ch.capabilities.maxTextLength} characters.`);
    }
    const contact = (await store.getContact(ticket.contactId))!;
    const { to, lastInbound } = await recipientFor(ticket, ch, contact);
    if (!to) throw new SupportError("invalid", "This customer has no address on this channel.");

    const attachments = await loadUploads(ticket.id, input.attachmentIds ?? [], ch);
    const agents = await agentsById();
    const agent = agents.get(input.agentId) ?? { id: input.agentId, name: "" };
    const signature = options.signature ? options.signature(agent) : agent.name.split(" ")[0] ?? "";
    const body = signature && ch.kind === "email" ? `${text}\n\n${signature}` : text;

    const message = await sendOutbound(ch, ticket, {
      text: body,
      displayText: text,
      to: [to],
      auto: false,
      authorId: input.agentId,
      attachments,
      replyTo: lastInbound,
    });

    // Nothing reached the customer: leave the ticket as it was, with the failed message to retry.
    if (message.deliveryStatus === "failed") return { message, ticket };

    const at = message.createdAt;
    const status: ReplyStatus = input.status ?? "waiting";
    const assigneeId = ticket.assigneeId ?? input.agentId;
    const updated = await store.updateTicket(ticket.id, {
      status: ticket.status === "spam" ? "spam" : status,
      waitingSince: status === "open" ? ticket.waitingSince : null,
      lastOutboundAt: at,
      lastMessageAt: at,
      solvedAt: status === "solved" ? at : null,
      preview: snippet(text),
      previewKind: "outbound",
      previewAuthorId: input.agentId,
      assigneeId,
    });
    if (!ticket.assigneeId) {
      await store.insertEvent({ ticketId: ticket.id, type: "assigned", actorId: input.agentId, data: { from: null, to: assigneeId } });
    }
    if (updated.status !== ticket.status) {
      await store.insertEvent({
        ticketId: ticket.id,
        type: "status_changed",
        actorId: input.agentId,
        data: { from: ticket.status, to: updated.status },
      });
    }
    await store.markRead(ticket.id, input.agentId, at);
    return { message, ticket: updated };
  }

  async function loadUploads(ticketId: string, ids: string[], ch: Channel | null) {
    const files: Attachment[] = [];
    for (const id of ids) {
      const file = await store.getAttachment(id);
      if (!file || file.ticketId !== ticketId || file.messageId) throw new SupportError("invalid", "Attachment not found.");
      files.push(file);
    }
    if (files.length && ch && !ch.capabilities.attachments) {
      throw new SupportError("invalid", "This channel doesn't support attachments.");
    }
    if (ch && ch.capabilities.attachments) {
      const { maxBytes, maxCount } = ch.capabilities.attachments;
      if (files.length > maxCount || files.reduce((sum, f) => sum + f.size, 0) > maxBytes) {
        throw new SupportError("too_large", "These attachments are too large for this channel.");
      }
    }
    return files;
  }

  async function retry(input: { messageId: string; agentId: string }) {
    const message = await store.getMessage(input.messageId);
    if (!message || message.kind !== "outbound" || message.deliveryStatus !== "failed" || !message.channelId) {
      throw new SupportError("invalid", "Only failed messages can be retried.");
    }
    const ticket = await getTicketOrThrow(message.ticketId);
    const ch = channel(message.channelId);
    if (!ch) throw new SupportError("invalid", "This ticket's channel is no longer configured.");
    await store.updateMessage(message.id, { deliveryStatus: "queued", deliveryError: null });
    const messages = await store.listMessages(ticket.id, { includeNotes: false });
    const replyTo = messages.find((m) => m.rfcMessageId && m.rfcMessageId === message.inReplyTo) ?? null;
    return sendOutbound(ch, ticket, {
      text: message.fullText ?? message.text,
      to: message.to,
      auto: message.auto,
      authorId: message.authorId,
      attachments: message.attachments,
      replyTo,
      existing: message,
      attemptKey: `${message.id}:${now().getTime()}`,
    });
  }

  async function addNote(input: { ticketId: string; agentId: string; text: string; attachmentIds?: string[] }) {
    const text = input.text.trim();
    if (!text) throw new SupportError("invalid", "Write a note first.");
    const ticket = await getTicketOrThrow(input.ticketId);
    const attachments = await loadUploads(ticket.id, input.attachmentIds ?? [], null);
    const message = (await store.insertMessage({
      ticketId: ticket.id,
      kind: "note",
      channelId: null,
      authorId: input.agentId,
      from: null,
      to: [],
      cc: [],
      subject: null,
      text,
      fullText: null,
      html: null,
      rfcMessageId: null,
      inReplyTo: null,
      references: [],
      providerMessageId: null,
      deliveryStatus: null,
      deliveryError: null,
      auto: false,
      source: "agent",
      createdAt: now(),
    }))!;
    await store.linkAttachments(attachments.map((a) => a.id), message.id);
    await store.markRead(ticket.id, input.agentId, message.createdAt);
    return { ...message, attachments };
  }

  async function assign(input: { ticketId: string; assigneeId: string | null; actorId: string }) {
    const ticket = await getTicketOrThrow(input.ticketId);
    if (ticket.assigneeId === input.assigneeId) return ticket;
    const updated = await store.updateTicket(ticket.id, { assigneeId: input.assigneeId });
    await store.insertEvent({
      ticketId: ticket.id,
      type: "assigned",
      actorId: input.actorId,
      data: { from: ticket.assigneeId, to: input.assigneeId },
    });
    if (input.assigneeId && input.assigneeId !== input.actorId) {
      await safeNotify({ type: "ticket.assigned", ticket: updated, assigneeId: input.assigneeId, actorId: input.actorId });
    }
    return updated;
  }

  async function setStatus(input: { ticketId: string; status: TicketStatus; actorId: string }) {
    const ticket = await getTicketOrThrow(input.ticketId);
    if (ticket.status === input.status) return ticket;
    const at = now();
    const updated = await store.updateTicket(ticket.id, {
      status: input.status,
      solvedAt: input.status === "solved" ? at : null,
      waitingSince: input.status === "open" ? ticket.waitingSince : null,
    });
    await store.insertEvent({
      ticketId: ticket.id,
      type: "status_changed",
      actorId: input.actorId,
      data: { from: ticket.status, to: input.status },
    });
    // Spam blocks the sender, so their next messages don't come back; undoing it unblocks them.
    // Account holders are never blocked: their address may have been spoofed.
    if (input.status === "spam" || ticket.status === "spam") {
      const contact = await store.getContact(ticket.contactId);
      if (contact && !contact.userId) {
        await store.updateContact(contact.id, { blockedAt: input.status === "spam" ? at : null });
      }
    }
    return updated;
  }

  async function linkCustomer(input: { ticketId: string; customerId: string | null; actorId: string }) {
    const ticket = await getTicketOrThrow(input.ticketId);
    const updated = await store.updateTicket(ticket.id, { customerId: input.customerId });
    // Link the person too, so their next emails land on this customer by themselves.
    await store.updateContact(ticket.contactId, { customerId: input.customerId });
    if (input.customerId) await store.linkContactTickets(ticket.contactId, input.customerId);
    await store.insertEvent({
      ticketId: ticket.id,
      type: "customer_linked",
      actorId: input.actorId,
      data: { from: ticket.customerId, to: input.customerId },
    });
    return updated;
  }

  async function uploadAttachment(input: {
    ticketId: string;
    filename: string;
    contentType: string;
    bytes: Uint8Array;
    uploadedBy: string;
  }) {
    await getTicketOrThrow(input.ticketId);
    if (input.bytes.byteLength > maxAttachmentBytes) throw new SupportError("too_large", "This file is too large.");
    const key = `${input.ticketId}/${crypto.randomUUID()}/${safeFilename(input.filename)}`;
    await storage.put(key, input.bytes, input.contentType || "application/octet-stream");
    const row = await store.insertAttachment({
      ticketId: input.ticketId,
      uploadedBy: input.uploadedBy,
      messageId: null,
      filename: input.filename,
      contentType: input.contentType || "application/octet-stream",
      size: input.bytes.byteLength,
      storageKey: key,
      contentId: null,
      inline: false,
    });
    return row;
  }

  // ----------------------------------------------------------------- reading

  async function listTickets(query: Omit<TicketQuery, "searchCustomerIds">, viewerId: string) {
    const searchCustomerIds = query.search?.trim()
      ? (await directory.searchCustomers(query.search.trim()).catch(() => [])).map((c) => c.id)
      : undefined;
    const { items, total } = await store.listTickets({ ...query, searchCustomerIds });
    const contacts = await store.getContacts([...new Set(items.map((t) => t.contactId))]);
    const customers = await directory.getCustomers([...new Set(items.map((t) => t.customerId).filter((id): id is string => Boolean(id)))]);
    const agents = await agentsById();
    const reads = await store.getReadTimes(items.map((t) => t.id), viewerId);
    const contactsById = new Map(contacts.map((c) => [c.id, c]));
    const customersById = new Map(customers.map((c) => [c.id, c]));
    const list: TicketListItem[] = items.map((ticket) => {
      const contact = contactsById.get(ticket.contactId)!;
      const readAt = reads.get(ticket.id);
      return {
        ...ticket,
        contact: { id: contact.id, name: contact.name, identities: contact.identities, customerId: contact.customerId },
        customer: ticket.customerId ? customersById.get(ticket.customerId) ?? null : null,
        assignee: ticket.assigneeId ? agents.get(ticket.assigneeId) ?? null : null,
        unread: Boolean(ticket.lastInboundAt && (!readAt || readAt < ticket.lastInboundAt)),
      };
    });
    return { items: list, total };
  }

  async function getTicket(id: string, viewerId: string): Promise<TicketDetail> {
    const ticket = await getTicketOrThrow(id);
    // In sequence: serverless Postgres clients often allow only a few concurrent queries.
    const contact = await store.getContact(ticket.contactId);
    const messages = await store.listMessages(ticket.id, { includeNotes: true });
    const events = await store.listEvents(ticket.id);
    const agents = await agentsById();
    const customers = ticket.customerId ? await directory.getCustomers([ticket.customerId]) : [];
    const previous = ticket.customerId
      ? await store.listTickets({ customerId: ticket.customerId, sort: "recent", limit: 6, offset: 0 })
      : { items: [] as Ticket[], total: 0 };
    await store.markRead(ticket.id, viewerId, now());
    const ch = channel(ticket.channelId);
    const timeline: TimelineEntry[] = [
      ...messages.map((message) => ({ type: "message" as const, at: message.createdAt, message })),
      ...events
        .filter((e) => e.type !== "created")
        .map((event) => ({ type: "event" as const, at: event.createdAt, event })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());
    return {
      ticket,
      contact: contact!,
      customer: customers[0] ?? null,
      assignee: ticket.assigneeId ? agents.get(ticket.assigneeId) ?? null : null,
      timeline,
      channel: ch ? { id: ch.id, kind: ch.kind, address: ch.address, capabilities: ch.capabilities } : null,
      replyBlockedReason: replyBlockedReason(ticket, ch),
      previousTickets: previous.items
        .filter((t) => t.id !== ticket.id)
        .slice(0, 5)
        .map(({ id, number, subject, status, lastMessageAt }) => ({ id, number, subject, status, lastMessageAt })),
    };
  }

  async function attachmentUrl(id: string, access: { ticketId?: string; customerId?: string; userId?: string | null }) {
    const file = await store.getAttachment(id);
    if (!file) throw new SupportError("not_found", "Attachment not found.");
    const message = file.messageId ? await store.getMessage(file.messageId) : null;
    const ticketId = message?.ticketId ?? file.ticketId;
    if (access.ticketId && ticketId !== access.ticketId) throw new SupportError("not_found", "Attachment not found.");
    if (access.customerId) {
      const ticket = ticketId ? await store.getTicket(ticketId) : null;
      // Customers only see files on their own tickets, and never files from internal notes.
      if (!ticket || ticket.customerId !== access.customerId || !message || message.kind === "note") {
        throw new SupportError("not_found", "Attachment not found.");
      }
      if (access.userId && (await store.getContact(ticket.contactId))?.userId !== access.userId) {
        throw new SupportError("not_found", "Attachment not found.");
      }
    }
    return storage.url(file.storageKey, { filename: file.filename, expiresInSeconds: 300 });
  }

  // ------------------------------------------------------------------ portal

  /** Customer-side access: a ticket of this customer, and of this user when they only see their own. */
  async function portalTicket(input: { ticketId: string; customerId: string; userId?: string | null }) {
    const ticket = await store.getTicket(input.ticketId);
    if (!ticket || ticket.customerId !== input.customerId || ticket.status === "spam") {
      throw new SupportError("not_found", "Request not found.");
    }
    if (input.userId) {
      const contact = await store.getContact(ticket.contactId);
      if (contact?.userId !== input.userId) throw new SupportError("not_found", "Request not found.");
    }
    return ticket;
  }

  const firstName = (agent: Agent | undefined) => agent?.name.split(" ")[0] || null;

  const portal = {
    async list(input: { customerId: string; userId?: string | null; readerId: string; limit?: number; offset?: number }) {
      const { items, total } = await store.listTickets({
        customerId: input.customerId,
        contactUserId: input.userId ?? undefined,
        sort: "recent",
        limit: input.limit ?? 50,
        offset: input.offset ?? 0,
      });
      const [agents, reads] = await Promise.all([agentsById(), store.getReadTimes(items.map((t) => t.id), input.readerId)]);
      return {
        total,
        items: items.map((t): PortalTicket => {
          const readAt = reads.get(t.id);
          return {
            id: t.id,
            subject: t.subject,
            status: t.status,
            createdAt: t.createdAt,
            lastMessageAt: t.lastMessageAt,
            preview: t.preview,
            previewKind: t.previewKind,
            previewAuthor: t.previewKind === "outbound" && t.previewAuthorId ? firstName(agents.get(t.previewAuthorId)) : null,
            unread: Boolean(t.lastOutboundAt && (!readAt || readAt < t.lastOutboundAt)),
          };
        }),
      };
    },

    async get(input: { ticketId: string; customerId: string; userId?: string | null; readerId: string }) {
      const ticket = await portalTicket(input);
      const [messages, agents] = await Promise.all([store.listMessages(ticket.id, { includeNotes: false }), agentsById()]);
      await store.markRead(ticket.id, input.readerId, now());
      return {
        ticket: { id: ticket.id, subject: ticket.subject, status: ticket.status, createdAt: ticket.createdAt },
        messages: messages
          .filter((m) => !m.auto && (m.kind === "inbound" || m.deliveryStatus !== "failed"))
          .map(
            (m): PortalMessage => ({
              id: m.id,
              kind: m.kind as "inbound" | "outbound",
              author: m.kind === "outbound" ? firstName(m.authorId ? agents.get(m.authorId) : undefined) : m.from?.name ?? null,
              text: m.text,
              createdAt: m.createdAt,
              attachments: m.attachments.map(({ id, filename, contentType, size }) => ({ id, filename, contentType, size })),
            })
          ),
      };
    },

    /** A request written in your app. Replies go out by email on `portalChannelId`. */
    async create(input: {
      customerId: string;
      userId: string;
      email: string;
      name: string | null;
      locale?: string | null;
      subject: string;
      text: string;
    }) {
      const channelId = options.portalChannelId;
      const ch = channelId ? channel(channelId) : null;
      if (!ch) {
        log("error", "portal request refused: set portalChannelId to a configured email channel");
        throw new SupportError("invalid", "Support requests aren't available right now. Email us instead.");
      }
      const subject = input.subject.trim();
      const text = input.text.trim();
      if (!subject || !text) throw new SupportError("invalid", "Add a subject and a message.");
      const identity = normalizeIdentity("email", input.email);
      const existing = await store.findContactByIdentity(identity);
      const contact =
        existing ??
        (await store.createContact({
          name: input.name,
          customerId: input.customerId,
          userId: input.userId,
          locale: input.locale ?? null,
          identities: [identity],
        }));
      if (existing && (existing.userId !== input.userId || existing.customerId !== input.customerId)) {
        await store.updateContact(existing.id, { userId: input.userId, customerId: input.customerId });
      }
      const at = now();
      const result = await store.transaction(async (tx) => {
        const ticket = await tx.createTicket({
          channelId: ch.id,
          subject,
          status: "open",
          contactId: contact.id,
          customerId: input.customerId,
          assigneeId: null,
          replyToken: randomToken(),
          providerThreadId: null,
          createdAt: at,
        });
        await tx.insertEvent({ ticketId: ticket.id, type: "created", actorId: input.userId, data: {}, createdAt: at });
        const message = (await tx.insertMessage(portalMessage(ticket.id, ch.id, input.userId, input.email, input.name, subject, text, at)))!;
        const updated = await tx.updateTicket(ticket.id, {
          waitingSince: at,
          lastInboundAt: at,
          lastMessageAt: at,
          preview: snippet(text),
          previewKind: "inbound",
        });
        await tx.markRead(ticket.id, input.userId, at);
        return { ticket: updated, message };
      });
      const fresh = (await store.getContact(contact.id))!;
      await safeNotify({ type: "ticket.created", ticket: result.ticket, message: { ...result.message, attachments: [] }, contact: fresh });
      return { id: result.ticket.id };
    },

    async reply(input: { ticketId: string; customerId: string; userId: string; email: string; name: string | null; onlyOwn?: boolean; text: string }) {
      const ticket = await portalTicket({ ...input, userId: input.onlyOwn ? input.userId : null });
      const text = input.text.trim();
      if (!text) throw new SupportError("invalid", "Write a message first.");
      const at = now();
      const message = (await store.insertMessage(
        portalMessage(ticket.id, ticket.channelId, input.userId, input.email, input.name, ticket.subject, text, at)
      ))!;
      const reopened = ticket.status === "solved";
      const updated = await store.updateTicket(ticket.id, {
        status: "open",
        waitingSince: ticket.waitingSince ?? at,
        lastInboundAt: at,
        lastMessageAt: at,
        solvedAt: null,
        preview: snippet(text),
        previewKind: "inbound",
        previewAuthorId: null,
      });
      if (reopened) await store.insertEvent({ ticketId: ticket.id, type: "reopened", actorId: input.userId, data: {} });
      await store.markRead(ticket.id, input.userId, at);
      const contact = (await store.getContact(ticket.contactId))!;
      await safeNotify({ type: "ticket.customer_replied", ticket: updated, message: { ...message, attachments: [] }, contact });
      return { id: message.id };
    },
  };

  function portalMessage(
    ticketId: string,
    channelId: string,
    userId: string,
    email: string,
    name: string | null,
    subject: string | null,
    text: string,
    at: Date
  ) {
    return {
      ticketId,
      kind: "inbound" as const,
      channelId,
      authorId: userId,
      from: { address: email, name },
      to: [],
      cc: [],
      subject,
      text,
      fullText: text,
      html: null,
      rfcMessageId: null,
      inReplyTo: null,
      references: [],
      // Portal messages have no provider id; a random one keeps the (channel, provider id) key unique.
      providerMessageId: `portal:${crypto.randomUUID()}`,
      deliveryStatus: null,
      deliveryError: null,
      auto: false,
      source: "portal" as const,
      createdAt: at,
    };
  }

  // -------------------------------------------------------------- webhooks

  /** Handles `POST /…/webhooks/:channelId` (and GET for providers that verify with a challenge). */
  async function handleWebhook(channelId: string, request: Request): Promise<Response> {
    const ch = channel(channelId);
    if (!ch?.webhook) return new Response("Not found", { status: 404 });
    let result;
    try {
      result = await ch.webhook(request);
    } catch (error) {
      if (error instanceof WebhookError) {
        log("warn", "webhook rejected", { channelId, reason: error.message });
        return new Response(error.message, { status: error.status });
      }
      log("error", "webhook parsing failed", { channelId, error: String(error) });
      return new Response("Could not process the webhook", { status: 500 });
    }
    try {
      for (const event of result.events) await ingest(ch.id, event);
    } catch (error) {
      // A 5xx makes the provider redeliver; ingestion is idempotent.
      log("error", "webhook ingestion failed", { channelId, error: String(error) });
      return new Response("Could not process the webhook", { status: 500 });
    }
    return result.response ?? new Response(null, { status: 200 });
  }

  /** Run every few minutes: polls channels, renews subscriptions, fails sends that never finished. */
  async function runScheduled() {
    const summary: Record<string, string> = {};
    for (const ch of options.channels) {
      if (!ch.sync) continue;
      const state = await store.getChannelState(ch.id);
      try {
        const result = await ch.sync(state);
        for (const event of result.events) await ingest(ch.id, event);
        await store.setChannelState(ch.id, result.state, null);
        summary[ch.id] = `${result.events.length} events`;
      } catch (error) {
        await store.setChannelState(ch.id, state ?? {}, String(error).slice(0, 500));
        log("error", "channel sync failed", { channelId: ch.id, error: String(error) });
        summary[ch.id] = "failed";
      }
    }
    const stale = await store.listStaleQueued(new Date(now().getTime() - 10 * 60_000));
    for (const message of stale) {
      await store.updateMessage(message.id, { deliveryStatus: "failed", deliveryError: "Sending didn't finish. Try again." });
    }
    return { channels: summary, staleFailed: stale.length };
  }

  return {
    ingest,
    handleWebhook,
    runScheduled,
    reply,
    retry,
    addNote,
    assign,
    setStatus,
    linkCustomer,
    uploadAttachment,
    attachmentUrl,
    listTickets,
    getTicket,
    counts: (viewerId: string) => store.countTickets({ assigneeId: viewerId }),
    markRead: (ticketId: string, readerId: string) => store.markRead(ticketId, readerId, now()),
    searchCustomers: (query: string) => directory.searchCustomers(query),
    listAgents: () => directory.listAgents(),
    portal,
  };
}

export type Support = ReturnType<typeof createSupport>;

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 24);
}

function safeFilename(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120) || "file";
}
