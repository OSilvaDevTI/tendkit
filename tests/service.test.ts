import { describe, expect, it } from "vitest";
import { DAY, HOUR, fakeChannel, inbound, setup, emailCapabilities } from "./helpers";
import { tokenFromAddress } from "../registry/support/address";

const message = (t: Awaited<ReturnType<typeof setup>>, partial: Parameters<typeof inbound>[0] = {}) =>
  ({ type: "message", message: inbound({ receivedAt: t.now(), ...partial }) }) as const;

describe("inbound email", () => {
  it("opens a ticket linked to the sender's customer and ignores redelivery", async () => {
    const t = await setup();
    const event = message(t);
    const first = await t.support.ingest("email", event);
    expect(first.result).toBe("created");
    expect(await t.support.ingest("email", event)).toEqual({ result: "duplicate" });

    const { items } = await t.support.listTickets({ status: "open", sort: "waiting", limit: 10, offset: 0 }, "agent_a");
    expect(items).toHaveLength(1);
    expect(items[0]!.customer).toEqual({ id: "cus_northwind", name: "Northwind Coffee" });
    expect(items[0]!.waitingSince).toEqual(t.now());
    expect(items[0]!.unread).toBe(true);
    expect(t.notifications.map((n) => n.type)).toEqual(["ticket.created"]);
  });

  it("keeps one ticket when the same email is delivered twice at once", async () => {
    const t = await setup({ acknowledgement: undefined });
    const event = message(t);
    const results = await Promise.all([t.support.ingest("email", event), t.support.ingest("email", event)]);
    expect(results.map((r) => r.result).sort()).toEqual(["created", "duplicate"]);
    const { total } = await t.support.listTickets({ sort: "recent", limit: 10, offset: 0 }, "agent_a");
    expect(total).toBe(1);
  });

  it("acknowledges known customers only, with auto-reply headers", async () => {
    const t = await setup();
    await t.support.ingest("email", message(t));
    await t.support.ingest("email", message(t, { from: "stranger@spam.test", subject: "Cheap watches" }));
    expect(t.email.sent).toHaveLength(1);
    expect(t.email.sent[0]!.to).toEqual([{ address: "emma@northwind.test", name: "Emma" }]);
    expect(t.email.sent[0]!.headers?.["Auto-Submitted"]).toBe("auto-replied");
  });

  it("never reopens, notifies or acknowledges automated mail", async () => {
    const t = await setup();
    const { ticketId } = (await t.support.ingest("email", message(t))) as { ticketId: string };
    await t.support.reply({ ticketId, agentId: "agent_a", text: "Checking now.", status: "solved" });
    const replyTo = t.email.sent.at(-1)!.replyTo!.address;
    t.notifications.length = 0;
    t.advance(HOUR);
    await t.support.ingest(
      "email",
      message(t, { to: [{ address: replyTo }], subject: "Automatic reply: Payout", headers: { "auto-submitted": "auto-replied" } })
    );
    const detail = await t.support.getTicket(ticketId, "agent_a");
    expect(detail.ticket.status).toBe("solved");
    expect(t.notifications).toEqual([]);
  });

  it("drops mail from its own addresses, so a copy rule can't loop", async () => {
    const t = await setup();
    expect(await t.support.ingest("email", message(t, { from: "support@acme.test" }))).toMatchObject({ result: "ignored" });
    expect(await t.support.ingest("email", message(t, { from: "support+t-abcdefghij12@in.acme.test" }))).toMatchObject({
      result: "ignored",
    });
  });

  it("drops mail from addresses it was told to ignore", async () => {
    const t = await setup({ ignoreFrom: ["NoReply@acme.test"] });
    expect(await t.support.ingest("email", message(t, { from: "noreply@acme.test" }))).toMatchObject({ result: "ignored" });
    const { total } = await t.support.listTickets({ sort: "recent", limit: 10, offset: 0 }, "agent_a");
    expect(total).toBe(0);
  });

  it("keeps only what the customer wrote this time", async () => {
    const t = await setup();
    const { ticketId } = (await t.support.ingest(
      "email",
      message(t, {
        text: "Thanks, it arrived.\n\nOn Mon, 3 Nov 2026 at 10:00, Acme Support <support@acme.test> wrote:\n> The payout was sent.",
      })
    )) as { ticketId: string };
    const detail = await t.support.getTicket(ticketId, "agent_a");
    const first = detail.timeline.find((e) => e.type === "message")!;
    expect(first.type === "message" && first.message.text).toBe("Thanks, it arrived.");
  });
  it("leaves out the signature the sender's mail client marked", async () => {
    const t = await setup();
    const { ticketId } = (await t.support.ingest(
      "email",
      message(t, {
        text: "Is the payout sent?\n\nEmma Clarke\nNorthwind Coffee",
        html: '<div>Is the payout sent?</div><div id="Signature"><p>Emma Clarke</p><p>Northwind Coffee</p></div>',
      })
    )) as { ticketId: string };
    const detail = await t.support.getTicket(ticketId, "agent_a");
    const first = detail.timeline.find((e) => e.type === "message")!;
    expect(first.type === "message" && first.message.text).toBe("Is the payout sent?");
    expect(first.type === "message" && first.message.fullText).toContain("Northwind Coffee");
  });
});

describe("replies and threading", () => {
  it("threads the customer's answer through the reply-address token and moves the ticket back to open", async () => {
    const t = await setup();
    const { ticketId } = (await t.support.ingest("email", message(t))) as { ticketId: string };
    t.email.sent.length = 0;
    t.advance(HOUR);
    const { ticket, message: sentMessage } = await t.support.reply({ ticketId, agentId: "agent_a", text: "It was sent on Oct 14." });

    expect(ticket.status).toBe("waiting");
    expect(ticket.waitingSince).toBeNull();
    expect(ticket.assigneeId).toBe("agent_a");
    expect(sentMessage.deliveryStatus).toBe("sent");
    const out = t.email.sent[0]!;
    expect(out.subject).toBe("Re: Payout not received");
    expect(out.text).toBe("It was sent on Oct 14.\n\nDaniel");
    expect(out.inReplyTo).toMatch(/^<in-\d+@mail\.test>$/);
    expect(tokenFromAddress(out.replyTo!.address)).toBe(ticket.replyToken);

    // The customer's client drops every header: the token alone threads it.
    t.advance(HOUR);
    const answer = await t.support.ingest(
      "email",
      message(t, { to: [out.replyTo!], subject: "new message", rfcMessageId: null, inReplyTo: null, references: [] })
    );
    expect(answer).toEqual({ result: "appended", ticketId });
    const detail = await t.support.getTicket(ticketId, "agent_a");
    expect(detail.ticket.status).toBe("open");
    expect(detail.ticket.waitingSince).toEqual(t.now());
  });

  it("threads on In-Reply-To when there is no token", async () => {
    const t = await setup();
    const first = inbound({ receivedAt: t.now() });
    const { ticketId } = (await t.support.ingest("email", { type: "message", message: first })) as { ticketId: string };
    t.advance(HOUR);
    const second = await t.support.ingest("email", message(t, { inReplyTo: first.rfcMessageId, subject: "Re: Payout not received" }));
    expect(second).toEqual({ result: "appended", ticketId });
  });

  it("doesn't let a stranger attach mail to someone else's ticket with a leaked token", async () => {
    const t = await setup();
    const { ticketId } = (await t.support.ingest("email", message(t))) as { ticketId: string };
    await t.support.reply({ ticketId, agentId: "agent_a", text: "Hello" });
    const token = t.email.sent.at(-1)!.replyTo!;
    const attack = await t.support.ingest("email", message(t, { from: "lucas@lumen.test", to: [token] }));
    expect(attack).toMatchObject({ result: "created" });
    expect((attack as { ticketId: string }).ticketId).not.toBe(ticketId);
  });

  it("lets a colleague at the same customer reply on the thread", async () => {
    const t = await setup();
    const first = inbound({ receivedAt: t.now() });
    const { ticketId } = (await t.support.ingest("email", { type: "message", message: first })) as { ticketId: string };
    const colleague = await t.support.ingest("email", message(t, { from: "yusuf@northwind.test", inReplyTo: first.rfcMessageId }));
    expect(colleague).toEqual({ result: "appended", ticketId });
  });

  it("reopens a recently solved ticket, and starts a linked one after the window", async () => {
    const t = await setup();
    const first = inbound({ receivedAt: t.now() });
    const { ticketId } = (await t.support.ingest("email", { type: "message", message: first })) as { ticketId: string };
    await t.support.reply({ ticketId, agentId: "agent_a", text: "Done.", status: "solved" });
    const replyTo = t.email.sent.at(-1)!.replyTo!;

    t.advance(2 * DAY);
    expect(await t.support.ingest("email", message(t, { to: [replyTo] }))).toEqual({ result: "appended", ticketId });
    await t.support.setStatus({ ticketId, status: "solved", actorId: "agent_a" });

    t.advance(30 * DAY);
    const later = (await t.support.ingest("email", message(t, { to: [replyTo] }))) as { ticketId: string };
    expect(later.ticketId).not.toBe(ticketId);
    const detail = await t.support.getTicket(later.ticketId, "agent_a");
    expect(detail.timeline.some((e) => e.type === "event" && e.event.type === "follow_up")).toBe(true);
    expect(detail.ticket.assigneeId).toBe("agent_a");
  });

  it("marks a reply failed instead of losing it, and retries it", async () => {
    const down = fakeChannel({ fail: true });
    const t = await setup({ acknowledgement: undefined }, [down.channel]);
    const { ticketId } = (await t.support.ingest("email", message(t))) as { ticketId: string };
    const { message: failed } = await t.support.reply({ ticketId, agentId: "agent_a", text: "Hi" });
    expect(failed.deliveryStatus).toBe("failed");
    expect(failed.deliveryError).toBe("provider is down");
    await expect(t.support.retry({ messageId: failed.id, agentId: "agent_a" })).resolves.toMatchObject({
      deliveryStatus: "failed",
    });
  });

  it("applies delivery receipts in order and reports bounces", async () => {
    const t = await setup({ acknowledgement: undefined });
    const { ticketId } = (await t.support.ingest("email", message(t))) as { ticketId: string };
    const { message: sent } = await t.support.reply({ ticketId, agentId: "agent_a", text: "Hi" });
    const status = (s: "delivered" | "sent" | "failed") =>
      t.support.ingest("email", { type: "status", providerMessageId: sent.providerMessageId!, status: s, at: t.now() });
    await status("delivered");
    await status("sent");
    let detail = await t.support.getTicket(ticketId, "agent_a");
    const find = () => detail.timeline.find((e) => e.type === "message" && e.message.id === sent.id);
    expect(find()).toMatchObject({ message: { deliveryStatus: "delivered" } });
    await status("failed");
    detail = await t.support.getTicket(ticketId, "agent_a");
    expect(find()).toMatchObject({ message: { deliveryStatus: "failed" } });
    expect(t.notifications.at(-1)?.type).toBe("message.failed");
  });
});

describe("agent tools", () => {
  it("blocks the sender when a ticket is marked as spam, and unblocks on undo", async () => {
    const t = await setup();
    const { ticketId } = (await t.support.ingest("email", message(t, { from: "spam@bad.test" }))) as { ticketId: string };
    await t.support.setStatus({ ticketId, status: "spam", actorId: "agent_a" });
    expect(await t.support.ingest("email", message(t, { from: "spam@bad.test" }))).toMatchObject({ reason: "blocked" });
    await t.support.setStatus({ ticketId, status: "open", actorId: "agent_a" });
    expect(await t.support.ingest("email", message(t, { from: "spam@bad.test" }))).toMatchObject({ result: "created" });
  });

  it("links an unknown sender to a customer for their later emails too", async () => {
    const t = await setup();
    const { ticketId } = (await t.support.ingest("email", message(t, { from: "moussa@gmail.test" }))) as { ticketId: string };
    await t.support.linkCustomer({ ticketId, customerId: "cus_lumen", actorId: "agent_a" });
    await t.support.setStatus({ ticketId, status: "solved", actorId: "agent_a" });
    t.advance(30 * DAY);
    const next = (await t.support.ingest("email", message(t, { from: "moussa@gmail.test", subject: "Another" }))) as {
      ticketId: string;
    };
    expect((await t.support.getTicket(next.ticketId, "agent_a")).customer?.id).toBe("cus_lumen");
  });

  it("links a sender's earlier tickets once they're matched to a customer", async () => {
    const t = await setup({ acknowledgement: undefined });
    const first = (await t.support.ingest("email", message(t, { from: "moussa@gmail.test" }))) as { ticketId: string };
    const second = (await t.support.ingest("email", message(t, { from: "moussa@gmail.test", subject: "Another question" }))) as {
      ticketId: string;
    };
    await t.support.linkCustomer({ ticketId: second.ticketId, customerId: "cus_lumen", actorId: "agent_a" });
    expect((await t.support.getTicket(first.ticketId, "agent_a")).customer?.id).toBe("cus_lumen");
  });

  it("finds tickets by customer name, sender, number and message text", async () => {
    const t = await setup();
    await t.support.ingest("email", message(t));
    await t.support.ingest("email", message(t, { from: "lucas@lumen.test", subject: "Card payment", text: "Paiement en attente" }));
    const search = async (q: string) =>
      (await t.support.listTickets({ search: q, sort: "recent", limit: 10, offset: 0 }, "agent_a")).items.map((i) => i.subject);
    expect(await search("lumen labs")).toEqual(["Card payment"]);
    expect(await search("lucas@")).toEqual(["Card payment"]);
    expect(await search("attente")).toEqual(["Card payment"]);
    expect(await search("payout")).toEqual(["Payout not received"]);
  });

  it("only sends uploads that belong to the ticket", async () => {
    const t = await setup({ acknowledgement: undefined });
    const a = (await t.support.ingest("email", message(t))) as { ticketId: string };
    const b = (await t.support.ingest("email", message(t, { from: "lucas@lumen.test", subject: "Other" }))) as { ticketId: string };
    const upload = await t.support.uploadAttachment({
      ticketId: b.ticketId,
      filename: "statement.pdf",
      contentType: "application/pdf",
      bytes: new Uint8Array([1, 2, 3]),
      uploadedBy: "agent_a",
    });
    await expect(
      t.support.reply({ ticketId: a.ticketId, agentId: "agent_a", text: "See attached", attachmentIds: [upload.id] })
    ).rejects.toThrow("Attachment not found");
    await t.support.reply({ ticketId: b.ticketId, agentId: "agent_a", text: "See attached", attachmentIds: [upload.id] });
    expect(t.email.sent.at(-1)!.attachments).toEqual([
      { filename: "statement.pdf", contentType: "application/pdf", content: new Uint8Array([1, 2, 3]) },
    ]);
  });
});

describe("per-contact channels", () => {
  const whatsapp = () =>
    fakeChannel({
      id: "whatsapp",
      kind: "whatsapp",
      identityKind: "whatsapp",
      address: "+14155550100",
      replyAddress: undefined,
      capabilities: { ...emailCapabilities, subject: false, conversation: "contact", replyWindowHours: 24 },
    });

  it("keeps one conversation per person and closes replies after 24 hours", async () => {
    const wa = whatsapp();
    const t = await setup({}, [wa.channel]);
    const msg = (text: string) =>
      ({
        type: "message",
        message: inbound({ from: "+1 415 555 0133", to: [], subject: null, text, receivedAt: t.now(), rfcMessageId: null }),
      }) as const;
    const { ticketId } = (await t.support.ingest("whatsapp", msg("Hello"))) as { ticketId: string };
    expect(await t.support.ingest("whatsapp", msg("Are you there?"))).toEqual({ result: "appended", ticketId });
    await t.support.reply({ ticketId, agentId: "agent_a", text: "Yes" });
    expect(wa.sent[0]!.to[0]!.address).toBe("+1 415 555 0133");
    expect(wa.sent[0]!.text).toBe("Yes");

    t.advance(25 * HOUR);
    expect((await t.support.getTicket(ticketId, "agent_a")).replyBlockedReason).toBe("reply_window_closed");
    await expect(t.support.reply({ ticketId, agentId: "agent_a", text: "Hello?" })).rejects.toThrow("24 hours");
  });
});

describe("customer portal", () => {
  it("shows a customer their requests without internal notes, and members only their own", async () => {
    const t = await setup({ acknowledgement: undefined });
    const mine = await t.support.portal.create({
      customerId: "cus_northwind",
      userId: "usr_emma",
      email: "emma@northwind.test",
      name: "Emma",
      subject: "Add Masrivi",
      text: "Can you enable Masrivi?",
    });
    await t.support.ingest("email", message(t, { from: "yusuf@northwind.test", subject: "Sidi's question" }));
    await t.support.addNote({ ticketId: mine.id, agentId: "agent_k", text: "Check their contract first" });
    t.advance(HOUR);
    await t.support.reply({ ticketId: mine.id, agentId: "agent_k", text: "Done, it's live." });

    const all = await t.support.portal.list({ customerId: "cus_northwind", readerId: "usr_emma" });
    expect(all.items.map((i) => i.subject).sort()).toEqual(["Add Masrivi", "Sidi's question"].sort());
    const own = await t.support.portal.list({ customerId: "cus_northwind", userId: "usr_emma", readerId: "usr_emma" });
    expect(own.items.map((i) => i.subject)).toEqual(["Add Masrivi"]);
    expect(own.items[0]).toMatchObject({ previewAuthor: "Priya", unread: true });

    const detail = await t.support.portal.get({ ticketId: mine.id, customerId: "cus_northwind", readerId: "usr_emma" });
    expect(detail.messages.map((m) => [m.kind, m.author, m.text])).toEqual([
      ["inbound", "Emma", "Can you enable Masrivi?"],
      ["outbound", "Priya", "Done, it's live."],
    ]);
    await expect(t.support.portal.get({ ticketId: mine.id, customerId: "cus_lumen", readerId: "usr_lucas" })).rejects.toThrow(
      "Request not found"
    );
  });
});

describe("untrusted senders", () => {
  it("never files a contact-form message under the customer whose email was typed", async () => {
    const t = await setup();
    const { ticketId } = (await t.support.ingest("email", message(t, { source: "api" }))) as { ticketId: string };
    expect((await t.support.getTicket(ticketId, "agent_a")).customer).toBeNull();
    expect(t.email.sent).toEqual([]);
    expect((await t.support.portal.list({ customerId: "cus_northwind", readerId: "usr_emma" })).items).toEqual([]);
  });

  it("treats mail that failed DMARC as an unknown sender that can't thread by headers", async () => {
    const t = await setup();
    const real = inbound({ receivedAt: t.now() });
    const { ticketId } = (await t.support.ingest("email", { type: "message", message: real })) as { ticketId: string };
    t.email.sent.length = 0;
    const spoofed = await t.support.ingest(
      "email",
      message(t, { inReplyTo: real.rfcMessageId, headers: { "authentication-results": "mx.test; spf=fail; dkim=none; dmarc=fail" } })
    );
    expect((spoofed as { ticketId: string }).ticketId).not.toBe(ticketId);
    expect((await t.support.getTicket((spoofed as { ticketId: string }).ticketId, "agent_a")).customer).toBeNull();
    expect(t.email.sent).toEqual([]);
  });

  it("doesn't block a real customer's address when a ticket in their name is marked as spam", async () => {
    const t = await setup({ acknowledgement: undefined });
    const { ticketId } = (await t.support.ingest("email", message(t, { source: "api" }))) as { ticketId: string };
    await t.support.setStatus({ ticketId, status: "spam", actorId: "agent_a" });
    // The contact form didn't link the contact, so the real customer's next email links and arrives.
    expect(await t.support.ingest("email", message(t, { subject: "Real question" }))).toMatchObject({ result: "created" });
  });

  it("leaves the ticket as it was when a reply couldn't be sent", async () => {
    const down = fakeChannel({ fail: true });
    const t = await setup({ acknowledgement: undefined }, [down.channel]);
    const { ticketId } = (await t.support.ingest("email", message(t))) as { ticketId: string };
    const { ticket } = await t.support.reply({ ticketId, agentId: "agent_a", text: "Hi", status: "solved" });
    expect(ticket.status).toBe("open");
    expect(ticket.waitingSince).not.toBeNull();
  });
});
