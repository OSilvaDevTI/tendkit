import { afterEach, describe, expect, it, vi } from "vitest";
import { ChannelError, WebhookError, type ChannelEvent, type InboundMessage } from "../../registry/support/channel";
import { microsoft365Channel } from "../../registry/support/channels/microsoft365";
import { base64Encode, utf8 } from "../../registry/support/channels/crypto";

const GRAPH = "https://graph.test/v1.0";
const BOX = "/v1.0/users/support@acme.test";

type Call = { method: string; url: URL; path: string; headers: Headers; body: unknown };
type Route = [method: string, path: RegExp, reply: (call: Call) => Response | Promise<Response>];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** A fetch that answers from `routes` (first match wins) and records every call. */
function fakeGraph(routes: Route[]) {
  const calls: Call[] = [];
  const fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    const raw = init.body;
    const body = typeof raw === "string" ? (raw.startsWith("{") ? JSON.parse(raw) : raw) : raw instanceof URLSearchParams ? Object.fromEntries(raw) : raw;
    const call: Call = { method, url, path: decodeURIComponent(url.pathname + url.search), headers: new Headers(init.headers), body };
    calls.push(call);
    if (url.host === "login.microsoftonline.com") return json({ access_token: "tok-1", expires_in: 3600 });
    const route = routes.find(([m, p]) => m === method && p.test(call.path));
    if (!route) throw new Error(`unexpected ${method} ${call.path}`);
    return route[2](call);
  };
  return { fetch: fetch as typeof globalThis.fetch, calls, graph: () => calls.filter((c) => c.url.host !== "login.microsoftonline.com") };
}

function channel(fetch: typeof globalThis.fetch, extra: { notificationUrl?: string } = {}) {
  return microsoft365Channel({
    id: "m365",
    tenantId: "tenant-1",
    clientId: "client-1",
    clientSecret: "secret",
    mailbox: "support@acme.test",
    clientState: "state-secret",
    baseUrl: GRAPH,
    fetch,
    ...extra,
  });
}

const customerMail = {
  id: "imm-in-1",
  internetMessageId: "<CA+abc@mail.gmail.com>",
  conversationId: "conv-1",
  internetMessageHeaders: [
    { name: "Message-ID", value: "<CA+abc@mail.gmail.com>" },
    { name: "In-Reply-To", value: "<out-1@acme.test>" },
    { name: "References", value: "<first@mail.gmail.com>\r\n <out-1@acme.test>" },
    { name: "Auto-Submitted", value: "auto-replied" },
    { name: "Content-Type", value: "multipart/related; boundary=x" },
    { name: "Received", value: "from mx.google.com" },
  ],
  from: { emailAddress: { name: "Mariem", address: "mariem@nour.test" } },
  toRecipients: [{ emailAddress: { name: "Acme Support", address: "support@acme.test" } }],
  ccRecipients: [{ emailAddress: { address: "sidi@nour.test" } }],
  subject: "Re: Payout not received",
  body: {
    contentType: "html",
    content:
      '<div>It arrived, thanks.<img src="cid:logo@nour"></div><div id="divRplyFwdMsg"><b>From:</b> Acme Support</div><div>The payout was sent.</div>',
  },
  receivedDateTime: "2026-11-07T10:00:00Z",
  sentDateTime: "2026-11-07T09:59:58Z",
  hasAttachments: true,
  isDraft: false,
};

const attachments = {
  value: [
    {
      "@odata.type": "#microsoft.graph.fileAttachment",
      id: "att-1",
      name: "receipt.pdf",
      contentType: "application/pdf",
      size: 3,
      isInline: false,
      contentBytes: base64Encode(utf8("pdf")),
    },
    { "@odata.type": "#microsoft.graph.fileAttachment", id: "att-2", name: "logo.png", contentType: "image/png", size: 5, isInline: true, contentId: "<logo@nour>" },
    { "@odata.type": "#microsoft.graph.referenceAttachment", id: "att-3", name: "Shared folder" },
  ],
};

const messageRoutes: Route[] = [
  ["GET", /\/messages\/imm-in-1\/attachments\/att-2\/\$value$/, () => new Response(utf8("image"))],
  ["GET", /\/messages\/imm-in-1\/attachments$/, () => json(attachments)],
  ["GET", /\/messages\/imm-in-1\?/, () => json(customerMail)],
];

const notification = (overrides: Record<string, unknown> = {}) =>
  new Request("https://app.test/support/webhooks/m365", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      value: [
        {
          subscriptionId: "sub-1",
          clientState: "state-secret",
          changeType: "created",
          resource: "Users/u-1/Messages/imm-in-1",
          resourceData: { "@odata.type": "#Microsoft.Graph.Message", id: "imm-in-1" },
          ...overrides,
        },
      ],
    }),
  });

const messages = (events: ChannelEvent[]) => events.map((e) => (e as { message: InboundMessage }).message);

afterEach(() => void vi.useRealTimers());

describe("microsoft365Channel webhook", () => {
  it("answers the subscription handshake with the decoded token as plain text", async () => {
    const g = fakeGraph([]);
    const result = await channel(g.fetch).webhook!(
      new Request("https://app.test/support/webhooks/m365?validationToken=Validation%3A%20Testing%20client%20application", {
        method: "POST",
      })
    );
    expect(result.events).toEqual([]);
    expect(result.response!.status).toBe(200);
    expect(result.response!.headers.get("content-type")).toMatch(/^text\/plain/);
    expect(await result.response!.text()).toBe("Validation: Testing client application");
    expect(g.calls).toEqual([]);
  });

  it("rejects notifications whose clientState doesn't match, before calling Graph", async () => {
    const g = fakeGraph(messageRoutes);
    const ch = channel(g.fetch);
    await expect(ch.webhook!(notification({ clientState: "guess" }))).rejects.toBeInstanceOf(WebhookError);
    await expect(ch.webhook!(notification({ clientState: undefined }))).rejects.toBeInstanceOf(WebhookError);
    expect(g.calls).toEqual([]);
  });

  it("reads the notified message and maps it, reusing one access token", async () => {
    const g = fakeGraph(messageRoutes);
    const ch = channel(g.fetch);
    const [m] = messages((await ch.webhook!(notification())).events);

    expect(m).toMatchObject({
      providerMessageId: "imm-in-1",
      direction: "inbound",
      from: { address: "mariem@nour.test", name: "Mariem" },
      to: [{ address: "support@acme.test", name: "Acme Support" }],
      cc: [{ address: "sidi@nour.test", name: null }],
      subject: "Re: Payout not received",
      rfcMessageId: "<CA+abc@mail.gmail.com>",
      inReplyTo: "<out-1@acme.test>",
      references: ["<first@mail.gmail.com>", "<out-1@acme.test>"],
      providerThreadId: "conv-1",
      receivedAt: new Date("2026-11-07T10:00:00Z"),
      headers: { "auto-submitted": "auto-replied", "content-type": "multipart/related; boundary=x" },
    });
    expect(m!.html).toContain("divRplyFwdMsg");
    // Outlook's reply marker survives as a quote, so the core can trim the history.
    expect(m!.text).toBe("It arrived, thanks.\n\n>");

    expect(m!.attachments!.map((a) => [a.filename, a.contentType, a.inline, a.contentId])).toEqual([
      ["receipt.pdf", "application/pdf", false, null],
      ["logo.png", "image/png", true, "logo@nour"],
    ]);
    expect(new TextDecoder().decode(await m!.attachments![0]!.read())).toBe("pdf");
    expect(new TextDecoder().decode(await m!.attachments![1]!.read())).toBe("image");

    const get = g.graph().find((c) => /imm-in-1\?/.test(c.path))!;
    expect(get.headers.get("prefer")).toContain('IdType="ImmutableId"');
    expect(get.url.searchParams.get("$select")).toContain("internetMessageHeaders");

    await ch.webhook!(notification());
    expect(g.calls.filter((c) => c.url.host === "login.microsoftonline.com")).toHaveLength(1);
  });

  it("returns no events for lifecycle notifications and reauthorizes when asked", async () => {
    const g = fakeGraph([["POST", /\/subscriptions\/sub-1\/reauthorize$/, () => new Response(null, { status: 204 })]]);
    const result = await channel(g.fetch).webhook!(
      notification({ lifecycleEvent: "reauthorizationRequired", changeType: undefined, resourceData: undefined })
    );
    expect(result.events).toEqual([]);
    expect(g.graph().map((c) => `${c.method} ${c.path}`)).toEqual(["POST /v1.0/subscriptions/sub-1/reauthorize"]);
  });
});

describe("microsoft365Channel sync", () => {
  const agentReply = {
    ...customerMail,
    id: "imm-sent-1",
    internetMessageId: "<agent@acme.test>",
    internetMessageHeaders: undefined,
    from: { emailAddress: { name: "Acme Support", address: "support@acme.test" } },
    toRecipients: [{ emailAddress: { address: "mariem@nour.test" } }],
    body: { contentType: "html", content: "<p>Sent from Outlook.</p>" },
    hasAttachments: false,
    sentDateTime: "2026-11-07T11:00:00Z",
    receivedDateTime: "2026-11-07T11:00:01Z",
  };
  const ourReply = { ...agentReply, id: "imm-sent-2", singleValueExtendedProperties: [{ id: "x", value: "msg_1" }] };

  it("starts from now, then imports new inbox mail and team replies, and keeps the subscription alive", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-07T09:00:00Z") });
    let round = 1;
    const g = fakeGraph([
      [
        "GET",
        /mailFolders\('inbox'\)\/messages\/delta/,
        () =>
          round === 1
            ? json({ value: [], "@odata.deltaLink": `${GRAPH}/users/support%40acme.test/mailFolders('inbox')/messages/delta?$deltatoken=in-1` })
            : json({
                value: [
                  { id: "imm-in-1", receivedDateTime: "2026-11-07T10:00:00Z" },
                  { id: "imm-old", "@removed": { reason: "deleted" } },
                  { id: "imm-before-setup", receivedDateTime: "2026-11-01T10:00:00Z" },
                ],
                "@odata.deltaLink": `${GRAPH}/users/support%40acme.test/mailFolders('inbox')/messages/delta?$deltatoken=in-2`,
              }),
      ],
      [
        "GET",
        /mailFolders\('sentitems'\)\/messages\/delta/,
        () =>
          round === 1
            ? json({ value: [], "@odata.deltaLink": `${GRAPH}/users/support%40acme.test/mailFolders('sentitems')/messages/delta?$deltatoken=s-1` })
            : json({
                value: [
                  { id: "imm-sent-1", receivedDateTime: "2026-11-07T11:00:01Z" },
                  { id: "imm-sent-2", receivedDateTime: "2026-11-07T11:00:02Z" },
                ],
                "@odata.deltaLink": `${GRAPH}/users/support%40acme.test/mailFolders('sentitems')/messages/delta?$deltatoken=s-2`,
              }),
      ],
      ["GET", /\/messages\/imm-sent-1\?/, () => json(agentReply)],
      ["GET", /\/messages\/imm-sent-2\?/, () => json(ourReply)],
      ...messageRoutes,
      ["POST", /^\/v1\.0\/subscriptions$/, (c) => json({ id: "sub-1", expirationDateTime: (c.body as { expirationDateTime: string }).expirationDateTime }, 201)],
      ["GET", /^\/v1\.0\/subscriptions\/sub-1$/, () => json({ id: "sub-1" })],
      ["PATCH", /^\/v1\.0\/subscriptions\/sub-1$/, (c) => json({ id: "sub-1", expirationDateTime: (c.body as { expirationDateTime: string }).expirationDateTime })],
    ]);
    const ch = channel(g.fetch, { notificationUrl: "https://app.test/support/webhooks/m365" });

    const first = await ch.sync!(null);
    expect(first.events).toEqual([]);
    const initial = g.graph().filter((c) => c.path.includes("/delta"));
    for (const c of initial) {
      expect(c.url.searchParams.get("$filter")).toBe("receivedDateTime ge 2026-11-07T09:00:00.000Z");
      expect(c.url.searchParams.get("changeType")).toBe("created");
    }
    const created = g.graph().find((c) => c.method === "POST" && c.path === "/v1.0/subscriptions")!;
    expect(created.body).toMatchObject({
      changeType: "created",
      resource: "users/support@acme.test/mailFolders('inbox')/messages",
      notificationUrl: "https://app.test/support/webhooks/m365",
      lifecycleNotificationUrl: "https://app.test/support/webhooks/m365",
      clientState: "state-secret",
    });
    expect(first.state).toMatchObject({
      since: "2026-11-07T09:00:00.000Z",
      inbox: { link: expect.stringContaining("$deltatoken=in-1") },
      sent: { link: expect.stringContaining("$deltatoken=s-1") },
      subscription: { id: "sub-1", expiresAt: "2026-11-13T09:00:00.000Z" },
      subscriptionError: null,
    });

    round = 2;
    vi.setSystemTime(new Date("2026-11-07T12:00:00Z"));
    g.calls.length = 0;
    const second = await ch.sync!(first.state);
    expect(g.graph()[0]!.url.searchParams.get("$deltatoken")).toBe("in-1");
    expect(messages(second.events).map((m) => [m.providerMessageId, m.direction])).toEqual([
      ["imm-in-1", "inbound"],
      ["imm-sent-1", "outbound"], // imm-sent-2 was sent by send() and is already in the ticket
    ]);
    const outbound = messages(second.events)[1]!;
    expect(outbound).toMatchObject({ providerThreadId: "conv-1", receivedAt: new Date("2026-11-07T11:00:00Z"), text: "Sent from Outlook." });
    expect(g.graph().some((c) => c.path.includes("imm-before-setup"))).toBe(false);
    expect(g.graph().some((c) => c.method === "PATCH")).toBe(false);

    // Three days later the subscription is renewed in place.
    vi.setSystemTime(new Date("2026-11-10T12:00:00Z"));
    const third = await ch.sync!(second.state);
    expect(third.state).toMatchObject({ subscription: { id: "sub-1", expiresAt: "2026-11-16T12:00:00.000Z" } });
  });

  it("keeps polling when the subscription can't be created", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-07T09:00:00Z") });
    const g = fakeGraph([
      ["GET", /\/messages\/delta/, () => json({ value: [], "@odata.deltaLink": `${GRAPH}/delta?$deltatoken=1` })],
      ["POST", /^\/v1\.0\/subscriptions$/, () => json({ error: { code: "ValidationError", message: "Subscription validation request failed." } }, 400)],
    ]);
    const { state } = await channel(g.fetch, { notificationUrl: "https://app.test/hook" }).sync!(null);
    expect(state.subscription).toBeNull();
    expect(state.subscriptionError).toMatch(/Subscription validation request failed/);
  });
});

describe("microsoft365Channel send", () => {
  const draft = { id: "imm-draft-1", internetMessageId: "<draft-1@acme.prod.outlook.com>", conversationId: "conv-1" };
  const sendRoutes: Route[] = [
    ["POST", /\/messages\/imm-in-1\/createReply$/, () => json(draft, 201)],
    ["PATCH", /\/messages\/imm-draft-1$/, () => json(draft)],
    ["POST", /\/messages\/imm-draft-1\/attachments$/, () => json({ id: "att" }, 201)],
    ["POST", /\/messages\/imm-draft-1\/send$/, () => new Response(null, { status: 202 })],
  ];
  const outbound = {
    id: "msg_1",
    to: [{ address: "mariem@nour.test", name: "Mariem" }],
    subject: "Re: Payout not received",
    text: "It was sent on Oct 14.",
    html: "<p>It was sent on Oct 14.</p>",
    attachments: [{ filename: "receipt.pdf", contentType: "application/pdf", content: utf8("pdf") }],
    inReplyTo: "<CA+abc@mail.gmail.com>",
    headers: { "Auto-Submitted": "auto-replied" },
  };

  it("replies in the Outlook thread with createReply, attachments and send", async () => {
    const g = fakeGraph(sendRoutes);
    const result = await channel(g.fetch).send({ ...outbound, replyToProviderMessageId: "imm-in-1" });
    expect(result).toEqual({ providerMessageId: "imm-draft-1", rfcMessageId: "<draft-1@acme.prod.outlook.com>", providerThreadId: "conv-1" });
    expect(g.graph().map((c) => `${c.method} ${c.path.replace(BOX, "")}`)).toEqual([
      "POST /messages/imm-in-1/createReply",
      "PATCH /messages/imm-draft-1",
      "POST /messages/imm-draft-1/attachments",
      "POST /messages/imm-draft-1/send",
    ]);
    const [createReply, patch, attachment] = g.graph();
    expect(createReply!.body).toEqual({ message: { internetMessageHeaders: [{ name: "X-Auto-Response-Suppress", value: "All" }] } });
    expect(patch!.body).toMatchObject({
      subject: "Re: Payout not received",
      body: { contentType: "html", content: "<p>It was sent on Oct 14.</p>" },
      toRecipients: [{ emailAddress: { address: "mariem@nour.test", name: "Mariem" } }],
      singleValueExtendedProperties: [{ value: "msg_1" }],
    });
    expect(attachment!.body).toMatchObject({ name: "receipt.pdf", contentBytes: base64Encode(utf8("pdf")) });
  });

  it("finds the original by Message-ID when it has no Graph id, and deletes the draft if sending fails", async () => {
    const g = fakeGraph([
      ["POST", /\/messages\/portal:123\/createReply$/, () => json({ error: { code: "ErrorInvalidIdMalformed", message: "Id is malformed." } }, 400)],
      ["GET", /\/messages\?\$filter=internetMessageId eq '<CA\+abc@mail\.gmail\.com>'/, () => json({ value: [{ id: "imm-in-1" }] })],
      ["POST", /\/messages\/imm-draft-1\/send$/, () => json({ error: { code: "ErrorServerBusy", message: "Busy" } }, 503)],
      ["DELETE", /\/messages\/imm-draft-1$/, () => new Response(null, { status: 204 })],
      ...sendRoutes,
    ]);
    const error = await channel(g.fetch)
      .send({ ...outbound, replyToProviderMessageId: "portal:123", attachments: [] })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ChannelError);
    expect(error).toMatchObject({ retryable: true, status: 503 });
    expect((error as Error).message).toMatch(/ErrorServerBusy: Busy/);
    expect(g.graph().map((c) => c.method + " " + c.path.replace(BOX, "").replace(/\?.*/, ""))).toEqual([
      "POST /messages/portal:123/createReply",
      "GET /messages",
      "POST /messages/imm-in-1/createReply",
      "PATCH /messages/imm-draft-1",
      "POST /messages/imm-draft-1/send",
      "DELETE /messages/imm-draft-1",
    ]);
  });
});
