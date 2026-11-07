import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ChannelError, WebhookError } from "../../registry/support/channel";
import { twilioChannel, verifyTwilioSignature } from "../../registry/support/channels/twilio";
import { json, mockFetch } from "./fetch";

const webhookUrl = "https://acme.test/api/support/webhooks/sms";
const authToken = "test-auth-token";

/** Signs like Twilio does, independently of the adapter (node:crypto). */
function twilioSign(url: string, params: Record<string, string>) {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  return createHmac("sha1", authToken).update(data).digest("base64");
}

function post(params: Record<string, string>, signature = twilioSign(webhookUrl, params)) {
  return new Request(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": signature },
    body: new URLSearchParams(params).toString(),
  });
}

describe("twilio signature", () => {
  it("matches Twilio's documented example", async () => {
    const params = new URLSearchParams({
      CallSid: "CA1234567890ABCDE",
      Caller: "+14158675310",
      Digits: "1234",
      From: "+14158675310",
      To: "+18005551212",
    });
    const url = "https://example.com/myapp.php?foo=1&bar=2";
    expect(await verifyTwilioSignature("12345", [url], params, "L/OH5YylLD5NRKLltdqwSvS0BnU=")).toBe(true);
    expect(await verifyTwilioSignature("12346", [url], params, "L/OH5YylLD5NRKLltdqwSvS0BnU=")).toBe(false);
    params.set("Digits", "9999");
    expect(await verifyTwilioSignature("12345", [url], params, "L/OH5YylLD5NRKLltdqwSvS0BnU=")).toBe(false);
  });

  it("rejects unsigned, tampered and wrong-URL requests", async () => {
    const channel = twilioChannel({ id: "sms", accountSid: "AC1", authToken, from: "+15550001111", webhookUrl });
    const params = { MessageSid: "SM1", From: "+15551234567", To: "+15550001111", Body: "hi" };
    await expect(channel.webhook!(post(params, ""))).rejects.toBeInstanceOf(WebhookError);
    const tampered = post({ ...params, Body: "hello" }, twilioSign(webhookUrl, params));
    await expect(channel.webhook!(tampered)).rejects.toBeInstanceOf(WebhookError);
    const otherUrl = post(params, twilioSign("https://evil.test/hook", params));
    await expect(channel.webhook!(otherUrl)).rejects.toBeInstanceOf(WebhookError);
    // Twilio may include the default port in what it signs.
    const withPort = post(params, twilioSign("https://acme.test:443/api/support/webhooks/sms", params));
    expect((await channel.webhook!(withPort)).events).toHaveLength(1);
  });
});

describe("twilio whatsapp webhook", () => {
  it("maps an inbound message with media and answers with empty TwiML", async () => {
    const mediaUrl = "https://api.twilio.com/2010-04-01/Accounts/AC1/Messages/MM1/Media/ME1";
    const { fetch, calls } = mockFetch((url) =>
      url === mediaUrl
        ? new Response(null, { status: 307, headers: { location: "https://media.storage.test/abc" } })
        : new Response(new Uint8Array([7, 8, 9]))
    );
    const channel = twilioChannel({
      id: "wa",
      accountSid: "AC1",
      authToken,
      from: "whatsapp:+22220000000",
      webhookUrl,
      fetch,
    });
    expect(channel.kind).toBe("whatsapp");
    expect(channel.capabilities.replyWindowHours).toBe(24);

    const result = await channel.webhook!(
      post({
        MessageSid: "MM1",
        SmsStatus: "received",
        From: "whatsapp:+22222101555",
        To: "whatsapp:+22220000000",
        Body: "Receipt attached",
        ProfileName: "Mariem",
        NumMedia: "1",
        MediaUrl0: mediaUrl,
        MediaContentType0: "image/jpeg",
      })
    );
    expect(result.response!.headers.get("content-type")).toBe("text/xml");
    expect(await result.response!.text()).toContain("<Response/>");
    const event = result.events[0]!;
    if (event.type !== "message") throw new Error("expected a message");
    expect(event.message).toMatchObject({
      providerMessageId: "MM1",
      from: { address: "+22222101555", name: "Mariem" },
      to: [{ address: "+22220000000" }],
      text: "Receipt attached",
    });
    const [file] = event.message.attachments!;
    expect(file).toMatchObject({ filename: "attachment-1.jpg", contentType: "image/jpeg" });
    expect(await file!.read()).toEqual(new Uint8Array([7, 8, 9]));
    // Credentials go to Twilio only, not to the storage host it redirects to.
    expect(new Headers(calls[0]!.init.headers).get("authorization")).toMatch(/^Basic /);
    expect(calls[0]!.init.redirect).toBe("manual");
    expect(calls[1]!.url).toBe("https://media.storage.test/abc");
    expect(new Headers(calls[1]!.init?.headers).get("authorization")).toBeNull();
  });

  it("maps status callbacks, including errors", async () => {
    const channel = twilioChannel({ id: "wa", accountSid: "AC1", authToken, from: "whatsapp:+22220000000", webhookUrl });
    const failed = await channel.webhook!(
      post({ MessageSid: "SM9", MessageStatus: "undelivered", ErrorCode: "63016", SmsStatus: "undelivered" })
    );
    expect(failed.events).toEqual([
      { type: "status", providerMessageId: "SM9", status: "failed", error: expect.stringContaining("24-hour"), at: expect.any(Date) },
    ]);
    const read = await channel.webhook!(post({ MessageSid: "SM9", MessageStatus: "read" }));
    expect(read.events[0]).toMatchObject({ status: "read", error: null });
  });
});

describe("twilio send", () => {
  it("posts a form-encoded message with a status callback", async () => {
    const { fetch, calls } = mockFetch(() => json({ sid: "SM42", status: "queued" }, 201));
    const channel = twilioChannel({
      id: "sms",
      accountSid: "AC1",
      authToken,
      apiKeySid: "SK1",
      apiKeySecret: "secret",
      from: "+15550001111",
      webhookUrl,
      fetch,
    });
    const result = await channel.send({ id: "m1", to: [{ address: "+1 555 123 4567" }], text: "Your payout was sent." });
    expect(result).toEqual({ providerMessageId: "SM42", status: "queued" });
    expect(calls[0]!.url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json");
    expect(new Headers(calls[0]!.init.headers).get("authorization")).toBe(`Basic ${btoa("SK1:secret")}`);
    expect(Object.fromEntries(new URLSearchParams(String(calls[0]!.init.body)))).toEqual({
      To: "+15551234567",
      From: "+15550001111",
      Body: "Your payout was sent.",
      StatusCallback: webhookUrl,
    });
  });

  it("explains a closed WhatsApp window", async () => {
    const { fetch } = mockFetch(() => json({ code: 63016, message: "Failed to send freeform message", status: 400 }, 400));
    const channel = twilioChannel({ id: "wa", accountSid: "AC1", authToken, from: "whatsapp:+22220000000", webhookUrl, fetch });
    const error = await channel.send({ id: "m1", to: [{ address: "+22222101555" }], text: "Hello" }).catch((e) => e);
    expect(error).toBeInstanceOf(ChannelError);
    expect(error.message).toContain("24-hour");
    expect(error.retryable).toBe(false);
  });
});
