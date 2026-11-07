import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ChannelError, WebhookError } from "../../registry/support/channel";
import { whatsappChannel } from "../../registry/support/channels/whatsapp";
import { json, mockFetch } from "./fetch";

const hookUrl = "https://acme.test/api/support/webhooks/whatsapp";
const base = {
  id: "wa",
  phoneNumberId: "1111",
  accessToken: "token",
  appSecret: "app-secret",
  verifyToken: "verify-me",
  displayNumber: "+222 20 00 00 00",
};

function post(payload: unknown, sign = true) {
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", base.appSecret).update(body).digest("hex");
  return new Request(hookUrl, {
    method: "POST",
    headers: { "content-type": "application/json", ...(sign ? { "x-hub-signature-256": `sha256=${signature}` } : {}) },
    body,
  });
}

const change = (value: Record<string, unknown>, phoneNumberId = "1111") => ({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba",
      changes: [
        {
          field: "messages",
          value: { messaging_product: "whatsapp", metadata: { display_phone_number: "22220000000", phone_number_id: phoneNumberId }, ...value },
        },
      ],
    },
  ],
});

describe("whatsapp webhook", () => {
  it("answers Meta's verification challenge only with the right token", async () => {
    const channel = whatsappChannel(base);
    const ok = await channel.webhook!(new Request(`${hookUrl}?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=1158201444`));
    expect(await ok.response!.text()).toBe("1158201444");
    const bad = new Request(`${hookUrl}?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1`);
    await expect(channel.webhook!(bad)).rejects.toBeInstanceOf(WebhookError);
  });

  it("checks the signature over the raw body", async () => {
    const channel = whatsappChannel(base);
    // Meta's signature vector from the research notes, over these exact bytes.
    const raw = '{"object":"whatsapp_business_account","entry":[{"id":"1","changes":[]}],"note":"caf\\u00e9"}';
    const known = new Request(hookUrl, {
      method: "POST",
      headers: { "x-hub-signature-256": "sha256=ca8a0e291b434df525110eb0393e7d96b3a18a3321dcd337d1d380daa5dd1e77" },
      body: raw,
    });
    expect(await channel.webhook!(known)).toEqual({ events: [] });
    const reserialized = new Request(hookUrl, {
      method: "POST",
      headers: { "x-hub-signature-256": "sha256=ca8a0e291b434df525110eb0393e7d96b3a18a3321dcd337d1d380daa5dd1e77" },
      body: JSON.stringify(JSON.parse(raw)),
    });
    await expect(channel.webhook!(reserialized)).rejects.toBeInstanceOf(WebhookError);
    await expect(channel.webhook!(post(change({}), false))).rejects.toBeInstanceOf(WebhookError);
  });

  it("maps text and image messages, downloading media in two steps", async () => {
    const { fetch, calls } = mockFetch((url) => {
      if (url.startsWith("https://graph.facebook.com/v27.0/media-1")) {
        return json({ url: "https://lookaside.test/media-1?ext=1", mime_type: "image/jpeg", id: "media-1" });
      }
      if (url === "https://lookaside.test/media-1?ext=1") return new Response(new Uint8Array([1, 2, 3]));
      return new Response("unexpected", { status: 500 });
    });
    const channel = whatsappChannel({ ...base, fetch });
    const contacts = [{ profile: { name: "Mariem" }, wa_id: "22222101555", user_id: "MR.1" }];
    const { events } = await channel.webhook!(
      post(
        change({
          contacts,
          messages: [
            { from: "22222101555", from_user_id: "MR.1", id: "wamid.A", timestamp: "1762160400", type: "text", text: { body: "Salam" } },
            {
              from: "22222101555",
              id: "wamid.B",
              timestamp: "1762160460",
              type: "image",
              image: { caption: "My receipt", mime_type: "image/jpeg", sha256: "x", id: "media-1" },
            },
            { from: "22222101555", id: "wamid.C", timestamp: "1762160470", type: "reaction", reaction: { message_id: "wamid.A", emoji: "👍" } },
            {
              from: "22222101555",
              id: "wamid.D",
              timestamp: "1762160480",
              type: "interactive",
              interactive: { type: "button_reply", button_reply: { id: "yes", title: "Yes, resend it" } },
            },
          ],
        })
      )
    );
    expect(events.map((e) => (e.type === "message" ? [e.message.providerMessageId, e.message.text] : null))).toEqual([
      ["wamid.A", "Salam"],
      ["wamid.B", "My receipt"],
      ["wamid.D", "Yes, resend it"],
    ]);
    const image = events[1]!;
    if (image.type !== "message") throw new Error("expected a message");
    expect(image.message.from).toEqual({ address: "+22222101555", name: "Mariem" });
    expect(image.message.receivedAt).toEqual(new Date(1762160460_000));
    const [file] = image.message.attachments!;
    expect(file).toMatchObject({ filename: "image.jpg", contentType: "image/jpeg" });
    expect(calls).toHaveLength(0); // nothing is fetched until the service accepts the message
    expect(await file!.read()).toEqual(new Uint8Array([1, 2, 3]));
    expect(calls[0]!.url).toBe("https://graph.facebook.com/v27.0/media-1?phone_number_id=1111");
    expect(new Headers(calls[1]!.init.headers).get("authorization")).toBe("Bearer token");
    expect(calls[1]!.init.redirect).toBe("manual");
  });

  it("ignores other phone numbers and maps failed statuses", async () => {
    const channel = whatsappChannel(base);
    const other = await channel.webhook!(
      post(change({ messages: [{ from: "1", id: "wamid.X", timestamp: "1", type: "text", text: { body: "hi" } }] }, "2222"))
    );
    expect(other.events).toEqual([]);
    const { events } = await channel.webhook!(
      post(
        change({
          statuses: [
            { id: "wamid.OUT", status: "delivered", timestamp: "1762160400", recipient_id: "22222101555" },
            {
              id: "wamid.OUT2",
              status: "failed",
              timestamp: "1762160500",
              errors: [{ code: 131047, title: "Re-engagement message", message: "Re-engagement message" }],
            },
          ],
        })
      )
    );
    expect(events).toEqual([
      { type: "status", providerMessageId: "wamid.OUT", status: "delivered", error: null, at: new Date(1762160400_000) },
      {
        type: "status",
        providerMessageId: "wamid.OUT2",
        status: "failed",
        error: expect.stringContaining("24-hour WhatsApp reply window has closed"),
        at: new Date(1762160500_000),
      },
    ]);
  });
});

describe("whatsapp send", () => {
  it("replies in context and sends attachments by uploaded media id", async () => {
    let n = 0;
    const { fetch, calls } = mockFetch((url) =>
      url.endsWith("/1111/media")
        ? json({ id: "upload-1" })
        : json({ messaging_product: "whatsapp", contacts: [{ input: "+22222101555", wa_id: "22222101555" }], messages: [{ id: `wamid.OUT${++n}` }] })
    );
    const channel = whatsappChannel({ ...base, fetch });
    const result = await channel.send({
      id: "msg_1",
      to: [{ address: "+222 22 10 15 55" }],
      text: "Here is your statement.",
      replyToProviderMessageId: "wamid.A",
      attachments: [{ filename: "statement.pdf", contentType: "application/pdf", content: new Uint8Array([1]) }],
    });
    expect(result).toEqual({ providerMessageId: "wamid.OUT1" });
    expect(calls.map((c) => c.url)).toEqual([
      "https://graph.facebook.com/v27.0/1111/media",
      "https://graph.facebook.com/v27.0/1111/messages",
      "https://graph.facebook.com/v27.0/1111/messages",
    ]);
    const upload = calls[0]!.init.body as FormData;
    expect(upload.get("messaging_product")).toBe("whatsapp");
    expect((upload.get("file") as File).name).toBe("statement.pdf");
    expect(JSON.parse(String(calls[1]!.init.body))).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "+22222101555",
      biz_opaque_callback_data: "msg_1",
      context: { message_id: "wamid.A" },
      type: "text",
      text: { body: "Here is your statement.", preview_url: true },
    });
    expect(JSON.parse(String(calls[2]!.init.body))).toMatchObject({
      type: "document",
      document: { id: "upload-1", filename: "statement.pdf" },
    });
  });

  it("explains a closed reply window", async () => {
    const { fetch } = mockFetch(() =>
      json(
        {
          error: {
            message: "(#131047) Re-engagement message",
            type: "OAuthException",
            code: 131047,
            error_data: { messaging_product: "whatsapp", details: "Message failed to send because more than 24 hours have passed since the customer last replied to this number." },
          },
        },
        400
      )
    );
    const channel = whatsappChannel({ ...base, fetch });
    const error = await channel.send({ id: "m", to: [{ address: "+22222101555" }], text: "Hello?" }).catch((e) => e);
    expect(error).toBeInstanceOf(ChannelError);
    expect(error.message).toContain("24-hour WhatsApp reply window has closed");
    expect(error.retryable).toBe(false);
  });
});
