import { describe, expect, it } from "vitest";
import type { ChannelState } from "../../registry/support/channel";
import { utf8 } from "../../registry/support/channels/crypto";
import { buildRawEmail, parseRawEmail } from "../../registry/support/channels/mime";
import { smtpChannel } from "../../registry/support/channels/smtp";

describe("smtp channel", () => {
  it("sends one raw message to every To and Cc recipient, with its Message-ID as the provider id", async () => {
    const calls: { raw: Uint8Array; envelope: { from: string; to: string[] } }[] = [];
    const channel = smtpChannel({
      id: "mail",
      address: "support@acme.test",
      smtp: { send: async (raw, envelope) => void calls.push({ raw, envelope }) },
    });
    const result = await channel.send({
      id: "msg_1",
      to: [{ address: "emma@northwind.test" }],
      cc: [{ address: "boss@northwind.test" }],
      fromName: "Acme Support",
      subject: "Re: Payout",
      text: "Done.",
      inReplyTo: "<a@northwind.test>",
      references: ["<a@northwind.test>"],
      attachments: [{ filename: "receipt.pdf", contentType: "application/pdf", content: utf8("%PDF-1.4") }],
      headers: { "Auto-Submitted": "auto-replied" },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.envelope).toEqual({ from: "support@acme.test", to: ["emma@northwind.test", "boss@northwind.test"] });
    const sent = await parseRawEmail(calls[0]!.raw);
    expect(sent).toMatchObject({
      from: { address: "support@acme.test", name: "Acme Support" },
      cc: [{ address: "boss@northwind.test" }],
      inReplyTo: "<a@northwind.test>",
      headers: { "auto-submitted": "auto-replied" },
    });
    expect(sent.attachments?.[0]?.filename).toBe("receipt.pdf");
    expect(result).toEqual({ providerMessageId: sent.rfcMessageId, rfcMessageId: sent.rfcMessageId, status: "sent" });
  });

  it("polls IMAP, prefixing ids with UIDVALIDITY and treating the mailbox's own mail as outbound", async () => {
    const raw = (from: string, id: string) =>
      utf8(buildRawEmail({ from: { address: from }, to: [{ address: "support@acme.test" }], subject: "Payout", text: "Hi", messageId: id }).raw);
    const seen: (ChannelState | null)[] = [];
    const channel = smtpChannel({
      id: "mail",
      address: "Support@Acme.test",
      smtp: { send: async () => {} },
      imap: {
        async fetchSince(state) {
          seen.push(state);
          return {
            messages: [
              { uid: "41", raw: raw("emma@northwind.test", "<a@northwind.test>"), receivedAt: new Date("2026-11-07T08:00:00Z") },
              { uid: "42", raw: raw("support@acme.test", "<b@acme.test>") },
            ],
            state: { uidValidity: 7, nextUid: 43 },
          };
        },
      },
    });
    const result = await channel.sync!({ uidValidity: 7, nextUid: 41 });
    expect(seen).toEqual([{ uidValidity: 7, nextUid: 41 }]);
    expect(result.state).toEqual({ uidValidity: 7, nextUid: 43 });
    expect(result.events.map((e) => e.type === "message" && e.message)).toMatchObject([
      { providerMessageId: "7:41", rfcMessageId: "<a@northwind.test>", receivedAt: new Date("2026-11-07T08:00:00Z") },
      { providerMessageId: "7:42", direction: "outbound" },
    ]);
    expect(result.events[0]!.type === "message" && result.events[0]!.message.direction).toBeUndefined();
  });

  it("has no sync without an IMAP poller", () => {
    expect(smtpChannel({ id: "mail", address: "a@b.test", smtp: { send: async () => {} } }).sync).toBeUndefined();
  });
});
