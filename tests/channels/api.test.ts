import { describe, expect, it } from "vitest";
import { WebhookError, type ChannelEvent, type OutboundMessage } from "../../registry/support/channel";
import { apiChannel, signApiRequest } from "../../registry/support/channels/api";
import { base64Encode, signStandardWebhook, utf8 } from "../../registry/support/channels/crypto";

const secret = `whsec_${base64Encode(utf8("api-channel-test-secret-32-bytes"))}`;

function channel(deliver = async (_: OutboundMessage) => ({ providerMessageId: "em_1" })) {
  return apiChannel({ id: "contact-form", secret, address: "Contact form", kind: "email", replyAddress: "support@in.acme.test", deliver });
}

const request = (body: string, headers: Record<string, string>) =>
  new Request("https://app.test/webhooks/contact-form", { method: "POST", headers, body });

const submission = {
  id: "form_42",
  from: { email: "mariem@nour.test", name: "Mariem" },
  subject: "Payout not received",
  text: "Salam, where is my payout?",
  attachments: [{ filename: "receipt.pdf", contentType: "application/pdf", contentBase64: base64Encode(utf8("pdf")) }],
  receivedAt: "2026-11-07T09:00:00Z",
};

describe("api channel", () => {
  it("turns a signed submission into an inbound message", async () => {
    const body = JSON.stringify(submission);
    const { events } = await channel().webhook!(request(body, await signApiRequest(secret, body)));
    const { attachments, ...message } = (events[0] as Extract<ChannelEvent, { type: "message" }>).message;
    expect(message).toEqual({
      providerMessageId: "form_42",
      from: { address: "mariem@nour.test", name: "Mariem" },
      to: [{ address: "Contact form" }],
      subject: "Payout not received",
      text: "Salam, where is my payout?",
      html: null,
      receivedAt: new Date("2026-11-07T09:00:00Z"),
    });
    expect(attachments).toHaveLength(1);
    expect(attachments![0]).toMatchObject({ filename: "receipt.pdf", contentType: "application/pdf", size: 3 });
    expect(await attachments![0]!.read()).toEqual(utf8("pdf"));
  });

  it("rejects tampered, stale and wrongly signed requests", async () => {
    const body = JSON.stringify(submission);
    const ch = channel();
    const headers = await signApiRequest(secret, body);
    await expect(ch.webhook!(request(body.replace("Mariem", "Mallory"), headers))).rejects.toBeInstanceOf(WebhookError);

    const stale = Math.floor(Date.now() / 1000) - 600;
    await expect(
      ch.webhook!(
        request(body, {
          "webhook-id": "msg_1",
          "webhook-timestamp": String(stale),
          "webhook-signature": await signStandardWebhook(secret, "msg_1", stale, body),
        })
      )
    ).rejects.toBeInstanceOf(WebhookError);

    const other = `whsec_${base64Encode(utf8("some-other-secret-of-32-bytes!!!"))}`;
    await expect(ch.webhook!(request(body, await signApiRequest(other, body)))).rejects.toBeInstanceOf(WebhookError);
  });

  it("answers 400 with the reason for a malformed submission", async () => {
    const body = JSON.stringify({ ...submission, from: { email: "not-an-email" } });
    const error = await channel()
      .webhook!(request(body, await signApiRequest(secret, body)))
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WebhookError);
    expect(error).toMatchObject({ status: 400, message: "Invalid message: `from.email` must be an email address" });
  });
});
