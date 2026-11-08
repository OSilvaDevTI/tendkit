import { describe, expect, it } from "vitest";
import { ChannelError, WebhookError, type ChannelEvent, type InboundMessage } from "../../registry/support/channel";
import { resendChannel } from "../../registry/support/channels/resend";
import { base64Encode, signStandardWebhook, utf8 } from "../../registry/support/channels/crypto";

const secret = `whsec_${base64Encode(utf8("resend-test-signing-secret-32b!!"))}`;

type Call = { url: string; method: string; headers: Record<string, string>; body: string | null };

function fakeFetch(routes: Record<string, () => Response>) {
  const calls: Call[] = [];
  const fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const method = init.method ?? "GET";
    calls.push({ url, method, headers: { ...(init.headers as Record<string, string>) }, body: (init.body as string) ?? null });
    const route = routes[`${method} ${url}`];
    return route ? route() : new Response("not found", { status: 404 });
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function channel(routes: Record<string, () => Response> = {}, receivingDomains?: string[]) {
  const fake = fakeFetch(routes);
  const ch = resendChannel({
    id: "email",
    apiKey: "re_test",
    webhookSecret: secret,
    address: "support@acme.test",
    replyAddress: "support@in.acme.test",
    receivingDomains,
    fetch: fake.fetch,
    baseUrl: "https://resend.test",
  });
  return { ch, calls: fake.calls };
}

async function signed(payload: unknown, { timestamp = Math.floor(Date.now() / 1000), tamper = false } = {}) {
  const body = JSON.stringify(payload);
  const signature = await signStandardWebhook(secret, "msg_1", timestamp, body);
  return new Request("https://app.test/webhooks/email", {
    method: "POST",
    headers: { "svix-id": "msg_1", "svix-timestamp": String(timestamp), "svix-signature": signature },
    body: tamper ? body.replace("delivered", "bounced") : body,
  });
}

const delivered = { type: "email.delivered", created_at: "2026-11-07T10:00:00.000Z", data: { email_id: "em_1" } };

describe("resend webhook", () => {
  it("accepts a valid Svix signature and rejects tampered or stale requests", async () => {
    const { ch } = channel();
    expect((await ch.webhook!(await signed(delivered))).events).toEqual([
      { type: "status", providerMessageId: "em_1", status: "delivered", error: null, rfcMessageId: null, at: new Date("2026-11-07T10:00:00.000Z") },
    ]);
    await expect(ch.webhook!(await signed(delivered, { tamper: true }))).rejects.toBeInstanceOf(WebhookError);
    const stale = Math.floor(Date.now() / 1000) - 600;
    await expect(ch.webhook!(await signed(delivered, { timestamp: stale }))).rejects.toBeInstanceOf(WebhookError);
  });

  it("maps delivery events to statuses keyed by the Resend email id", async () => {
    const { ch } = channel();
    const statuses = async (type: string, data: Record<string, unknown> = {}) => {
      const { events } = await ch.webhook!(await signed({ type, created_at: "2026-11-07T10:00:00Z", data: { email_id: "em_1", ...data } }));
      return events.map((e) => (e.type === "status" ? [e.providerMessageId, e.status, e.error] : e.type));
    };
    expect(await statuses("email.sent", { message_id: "<x@ses>" })).toEqual([["em_1", "sent", null]]);
    expect(await statuses("email.bounced", { bounce: { type: "Permanent", message: "Mailbox does not exist." } })).toEqual([
      ["em_1", "failed", "The email bounced: Mailbox does not exist."],
    ]);
    expect(await statuses("email.failed", { failed: { reason: "reached_daily_quota" } })).toEqual([
      ["em_1", "failed", "Not sent: the Resend daily sending quota is used up."],
    ]);
    expect(await statuses("email.complained")).toEqual([["em_1", "failed", "Marked as spam by the recipient"]]);
    expect(await statuses("email.delivery_delayed")).toEqual([]);
  });

  it("loads a received email with its threading headers and lazy attachments", async () => {
    const raw = [
      "Received: from mx.northwind.test",
      "From: =?UTF-8?B?TWFyaWVt?= <emma@northwind.test>",
      "Message-ID: <in-2@northwind.test>",
      "In-Reply-To: <out-1@acme.test>",
      "References: <in-1@northwind.test>",
      "\t<out-1@acme.test>",
      "Auto-Submitted: no",
      "",
      "body that must not be needed",
    ].join("\r\n");
    const { ch, calls } = channel(
      {
        "GET https://resend.test/emails/receiving/rcv_1?html_format=cid": () =>
          json({
            id: "rcv_1",
            created_at: "2026-11-07 09:30:00.123+00",
            from: "emma@northwind.test",
            to: ["Acme Support <support+t-abcdefghij12@in.acme.test>"],
            cc: ["yusuf@northwind.test"],
            subject: "Re: Payout",
            text: "Thanks!",
            html: "<p>Thanks!</p>",
            headers: { From: "Emma Clarke <emma@northwind.test>", "X-Mailer": "Mail" },
            message_id: "<in-2@northwind.test>",
            raw: { download_url: "https://cdn.test/raw/rcv_1", expires_at: "2026-11-07T10:30:00Z" },
            attachments: [
              { id: "att_1", filename: "receipt.pdf", content_type: "application/pdf", content_disposition: "attachment", content_id: null, size: 3 },
              { id: "att_2", filename: "logo.png", content_type: "image/png", content_disposition: "inline", content_id: "<logo1>", size: 4 },
            ],
          }),
        "GET https://cdn.test/raw/rcv_1": () => new Response(raw),
        "GET https://resend.test/emails/receiving/rcv_1/attachments/att_1": () =>
          json({ id: "att_1", download_url: "https://cdn.test/att_1", expires_at: "2026-11-07T10:30:00Z" }),
        "GET https://cdn.test/att_1": () => new Response(new Uint8Array([1, 2, 3])),
      },
      ["in.acme.test"]
    );
    const { events } = await ch.webhook!(
      await signed({
        type: "email.received",
        created_at: "2026-11-07T09:30:01Z",
        data: { email_id: "rcv_1", from: "emma@northwind.test", to: ["support+t-abcdefghij12@in.acme.test"], cc: [], bcc: [] },
      })
    );
    const message = (events[0] as Extract<ChannelEvent, { type: "message" }>).message;
    const { attachments, ...rest } = message;
    expect(rest).toEqual<Omit<InboundMessage, "attachments">>({
      providerMessageId: "rcv_1",
      from: { address: "emma@northwind.test", name: "Emma Clarke" },
      to: [{ address: "support+t-abcdefghij12@in.acme.test", name: "Acme Support" }],
      cc: [{ address: "yusuf@northwind.test", name: null }],
      subject: "Re: Payout",
      text: "Thanks!",
      html: "<p>Thanks!</p>",
      headers: {
        received: "from mx.northwind.test",
        from: "Emma Clarke <emma@northwind.test>",
        "message-id": "<in-2@northwind.test>",
        "in-reply-to": "<out-1@acme.test>",
        references: "<in-1@northwind.test> <out-1@acme.test>",
        "auto-submitted": "no",
        "x-mailer": "Mail",
      },
      rfcMessageId: "<in-2@northwind.test>",
      inReplyTo: "<out-1@acme.test>",
      references: ["<in-1@northwind.test>", "<out-1@acme.test>"],
      receivedAt: new Date("2026-11-07T09:30:00.123Z"),
    });
    expect(attachments!.map(({ read, ...a }) => a)).toEqual([
      { filename: "receipt.pdf", contentType: "application/pdf", size: 3, contentId: null, inline: false },
      { filename: "logo.png", contentType: "image/png", size: 4, contentId: "logo1", inline: true },
    ]);
    // Attachments are fetched only when the core reads them.
    expect(calls.some((c) => c.url.includes("/attachments/"))).toBe(false);
    expect(await attachments![0]!.read()).toEqual(new Uint8Array([1, 2, 3]));
    const download = calls.find((c) => c.url === "https://cdn.test/att_1")!;
    expect(download.headers.Authorization).toBeUndefined();
  });

  it("ignores mail for other domains on a shared Resend account without loading it", async () => {
    const { ch, calls } = channel({}, ["in.acme.test"]);
    const { events } = await ch.webhook!(
      await signed({
        type: "email.received",
        data: { email_id: "rcv_2", from: "x@y.test", to: ["support@in.other.test"], cc: [], bcc: [], received_for: [] },
      })
    );
    expect(events).toEqual([]);
    expect(calls).toEqual([]);
  });
});

describe("resend send", () => {
  it("posts the email with threading headers, attachments and an idempotency key", async () => {
    const { ch, calls } = channel({
      "POST https://resend.test/emails": () => json({ id: "em_9" }),
      "GET https://resend.test/emails/em_9": () => json({ id: "em_9", message_id: "<em_9@email.amazonses.com>" }),
    });
    const result = await ch.send({
      id: "msg_123",
      to: [{ address: "emma@northwind.test", name: "Emma, Northwind" }],
      cc: [{ address: "yusuf@northwind.test" }],
      fromName: "Acme Support",
      replyTo: { address: "support+t-abcdefghij12@in.acme.test" },
      subject: "Re: Payout",
      text: "Sent today.",
      html: "<p>Sent today.</p>",
      attachments: [{ filename: "receipt.pdf", contentType: "application/pdf", content: utf8("pdf") }],
      inReplyTo: "<in-2@northwind.test>",
      references: ["<in-1@northwind.test>", "<in-2@northwind.test>"],
      headers: { "Auto-Submitted": "auto-replied" },
    });
    expect(result).toEqual({ providerMessageId: "em_9", rfcMessageId: "<em_9@email.amazonses.com>", status: "sent" });
    const post = calls[0]!;
    expect(post.method).toBe("POST");
    expect(post.url).toBe("https://resend.test/emails");
    expect(post.headers).toMatchObject({
      Authorization: "Bearer re_test",
      "Content-Type": "application/json",
      "Idempotency-Key": "msg_123",
      "User-Agent": "tendkit",
    });
    expect(JSON.parse(post.body!)).toEqual({
      from: "Acme Support <support@acme.test>",
      to: ['"Emma, Northwind" <emma@northwind.test>'],
      cc: ["yusuf@northwind.test"],
      reply_to: "support+t-abcdefghij12@in.acme.test",
      subject: "Re: Payout",
      text: "Sent today.",
      html: "<p>Sent today.</p>",
      attachments: [{ filename: "receipt.pdf", content: "cGRm", content_type: "application/pdf" }],
      headers: {
        "Auto-Submitted": "auto-replied",
        "In-Reply-To": "<in-2@northwind.test>",
        References: "<in-1@northwind.test> <in-2@northwind.test>",
      },
    });
  });

  it("explains provider errors and says whether a retry can help", async () => {
    const send = async (response: () => Response) => {
      const { ch } = channel({ "POST https://resend.test/emails": response });
      return ch.send({ id: "m1", to: [{ address: "a@b.test" }], subject: "Hi", text: "Hi" }).catch((e: unknown) => e);
    };
    const unverified = await send(() =>
      json({ name: "validation_error", statusCode: 403, message: "The acme.test domain is not verified. Please, add and verify your domain." }, 403)
    );
    expect(unverified).toBeInstanceOf(ChannelError);
    expect(unverified).toMatchObject({
      message: "Resend couldn't send the email: The acme.test domain is not verified. Please, add and verify your domain.",
      retryable: false,
      status: 403,
    });
    expect(await send(() => json({ name: "rate_limit_exceeded", statusCode: 429, message: "Too many requests." }, 429))).toMatchObject({
      retryable: true,
      status: 429,
    });
    expect(await send(() => new Response("bad gateway", { status: 502 }))).toMatchObject({ retryable: true, status: 502 });
  });
});
