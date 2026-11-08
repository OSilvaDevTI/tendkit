import { describe, expect, it } from "vitest";
import { buildRawEmail, parseRawEmail } from "../../registry/support/channels/mime";

const subject = "إعادة: لم يصلني المبلغ المحول إلى حسابي في بنك موريتانيا منذ يومين";
const body = "السلام عليكم،\nتم تحويل المبلغ صباح اليوم.\n\nمع تحيات فريق الدعم";
const pdf = Uint8Array.from({ length: 3000 }, (_, i) => i % 256);

describe("buildRawEmail", () => {
  it("round-trips Arabic headers, bodies and attachment names through a real parser", async () => {
    const { raw, messageId } = buildRawEmail({
      from: { address: "support@acme.test", name: "فريق الدعم — Acme" },
      to: [{ address: "emma@northwind.test", name: "مريم محمد" }, { address: "ops@northwind.test", name: 'Ops, "Night" shift' }],
      replyTo: { address: "support+t-abc@in.acme.test" },
      subject,
      text: body,
      html: `<p dir="auto">${body}</p>`,
      attachments: [{ filename: "إيصال التحويل.pdf", contentType: "application/pdf", content: pdf }],
      inReplyTo: "<m2@northwind.test>",
      references: ["<m1@northwind.test>", "<m2@northwind.test>"],
      headers: { "Auto-Submitted": "auto-replied", "Message-ID": "<ignored@x>" },
    });

    // 7-bit, CRLF only, and every line within the RFC 5322 recommended 78 characters.
    expect(raw).toMatch(/^[\x00-\x7f]*$/);
    expect(raw.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    expect(raw.split("\r\n").filter((l) => l.length > 78)).toEqual([]);
    expect(messageId).toMatch(/^<[0-9a-f-]{36}@acme\.test>$/);

    const parsed = await parseRawEmail(raw);
    expect(parsed.subject).toBe(subject);
    expect(parsed.from).toEqual({ address: "support@acme.test", name: "فريق الدعم — Acme" });
    expect(parsed.to).toEqual([
      { address: "emma@northwind.test", name: "مريم محمد" },
      { address: "ops@northwind.test", name: 'Ops, "Night" shift' },
    ]);
    expect(parsed.text?.trim()).toBe(body);
    expect(parsed.html).toContain(body);
    expect(parsed.rfcMessageId).toBe(messageId);
    expect(parsed.inReplyTo).toBe("<m2@northwind.test>");
    expect(parsed.references).toEqual(["<m1@northwind.test>", "<m2@northwind.test>"]);
    expect(parsed.headers?.["auto-submitted"]).toBe("auto-replied");

    expect(parsed.attachments).toHaveLength(1);
    const file = parsed.attachments![0]!;
    expect(file).toMatchObject({ filename: "إيصال التحويل.pdf", contentType: "application/pdf", size: 3000, inline: false });
    expect(await file.read()).toEqual(pdf);
  });

  it("keeps line breaks in header values from injecting headers", async () => {
    const { raw } = buildRawEmail({
      from: { address: "support@acme.test" },
      to: [{ address: "a@b.test" }],
      subject: "Hello\r\nBcc: victim@evil.test",
      text: "x",
    });
    expect(raw).not.toMatch(/^Bcc:/m);
    expect((await parseRawEmail(raw)).subject).toBe("Hello Bcc: victim@evil.test");
  });
});

describe("parseRawEmail", () => {
  const raw = [
    "From: =?UTF-8?B?2YXYsdmK2YU=?= <Emma@Northwind.test>",
    "To: Support: support@acme.test, help@acme.test;",
    "Cc: boss@northwind.test",
    "Subject: Re: Payout",
    "Date: Sat, 07 Nov 2026 09:30:00 +0100",
    "Message-ID: <m3@northwind.test>",
    "In-Reply-To: <out-1@acme.test>",
    "References: <m1@northwind.test>",
    "\t<out-1@acme.test>",
    "Auto-Submitted: no",
    "DKIM-Signature: v=1; a=rsa-sha256; d=northwind.test",
    "Content-Type: multipart/mixed; boundary=b",
    "",
    "--b",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Still waiting.",
    "--b",
    'Content-Type: image/png; name="../../etc/‮passwd.png"',
    'Content-Disposition: inline; filename="../../etc/‮passwd.png"',
    "Content-ID: <img1>",
    "Content-Transfer-Encoding: base64",
    "",
    "iVBORw0KGgo=",
    "--b--",
    "",
  ].join("\r\n");

  it("maps threading headers, groups, the sending date and attachments", async () => {
    const msg = await parseRawEmail(raw, { providerMessageId: "p-1" });
    expect(msg).toMatchObject({
      providerMessageId: "p-1",
      from: { address: "Emma@Northwind.test", name: "مريم" },
      to: [{ address: "support@acme.test" }, { address: "help@acme.test" }],
      cc: [{ address: "boss@northwind.test", name: null }],
      rfcMessageId: "<m3@northwind.test>",
      inReplyTo: "<out-1@acme.test>",
      references: ["<m1@northwind.test>", "<out-1@acme.test>"],
      receivedAt: new Date("2026-11-07T08:30:00Z"),
      headers: { "auto-submitted": "no", "content-type": expect.stringContaining("multipart/mixed") },
    });
    expect(msg.headers).not.toHaveProperty("dkim-signature");
    expect(msg.text?.trim()).toBe("Still waiting.");
    expect(msg.attachments?.[0]).toMatchObject({ filename: "passwd.png", contentType: "image/png", contentId: "<img1>", inline: true });
  });

  it("imports only the headers of a message over the size cap", async () => {
    const msg = await parseRawEmail(raw, { maxBytes: 200 });
    expect(msg.rfcMessageId).toBe("<m3@northwind.test>");
    expect(msg.providerMessageId).toBe("<m3@northwind.test>");
    expect(msg.subject).toBe("Re: Payout");
    expect(msg.text).toMatch(/only its headers were imported/);
    expect(msg.attachments).toEqual([]);
  });
});
