import { describe, expect, it } from "vitest";
import { ChannelError, WebhookError } from "../../registry/support/channel";
import { telegramChannel } from "../../registry/support/channels/telegram";
import { json, mockFetch } from "./fetch";

const base = { id: "tg", botToken: "123:ABC", secretToken: "s3cret_token", botUsername: "acme_support_bot" };

const update = (message: Record<string, unknown>, secret = base.secretToken) =>
  new Request("https://acme.test/api/support/webhooks/tg", {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret },
    body: JSON.stringify({ update_id: 1, message }),
  });

const chat = { id: 4242, type: "private" };
const from = { id: 4242, is_bot: false, first_name: "Mariem", last_name: "Ahmed" };

describe("telegram webhook", () => {
  it("rejects requests without the secret token", async () => {
    const channel = telegramChannel(base);
    await expect(channel.webhook!(update({ message_id: 1, date: 1, chat, from, text: "hi" }, "wrong"))).rejects.toBeInstanceOf(
      WebhookError
    );
  });

  it("maps a photo with caption and downloads it through getFile", async () => {
    const { fetch, calls } = mockFetch((url) =>
      url.endsWith("/getFile") ? json({ ok: true, result: { file_id: "big", file_path: "photos/file_1.jpg" } }) : new Response(new Uint8Array([5]))
    );
    const channel = telegramChannel({ ...base, fetch });
    const { events } = await channel.webhook!(
      update({
        message_id: 77,
        date: 1762160400,
        chat,
        from,
        caption: "This is the error",
        photo: [
          { file_id: "small", file_unique_id: "a", width: 90, height: 90, file_size: 1000 },
          { file_id: "big", file_unique_id: "b", width: 1280, height: 1280, file_size: 90000 },
        ],
      })
    );
    const event = events[0]!;
    if (event.type !== "message") throw new Error("expected a message");
    expect(event.message).toMatchObject({
      providerMessageId: "4242:77",
      from: { address: "4242", name: "Mariem Ahmed" },
      text: "This is the error",
      receivedAt: new Date(1762160400_000),
    });
    const [photo] = event.message.attachments!;
    expect(photo).toMatchObject({ filename: "photo.jpg", contentType: "image/jpeg", size: 90000 });
    expect(await photo!.read()).toEqual(new Uint8Array([5]));
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ file_id: "big" });
    expect(calls[1]!.url).toBe("https://api.telegram.org/file/bot123:ABC/photos/file_1.jpg");
  });

  it("ignores group chats", async () => {
    const channel = telegramChannel(base);
    const { events } = await channel.webhook!(update({ message_id: 1, date: 1, chat: { id: -100, type: "group" }, from, text: "hi" }));
    expect(events).toEqual([]);
  });
});

describe("telegram send", () => {
  it("replies to the quoted message and sends files as documents", async () => {
    let id = 100;
    const { fetch, calls } = mockFetch(() => json({ ok: true, result: { message_id: ++id } }));
    const channel = telegramChannel({ ...base, fetch });
    const result = await channel.send({
      id: "m1",
      to: [{ address: "4242" }],
      text: "Fixed, try again.",
      replyToProviderMessageId: "4242:77",
      attachments: [{ filename: "steps.pdf", contentType: "application/pdf", content: new Uint8Array([1]) }],
    });
    expect(result).toEqual({ providerMessageId: "4242:101" });
    expect(calls[0]!.url).toBe("https://api.telegram.org/bot123:ABC/sendMessage");
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      chat_id: "4242",
      text: "Fixed, try again.",
      reply_parameters: { message_id: 77, allow_sending_without_reply: true },
    });
    expect(calls[1]!.url).toBe("https://api.telegram.org/bot123:ABC/sendDocument");
    expect(((calls[1]!.init.body as FormData).get("document") as File).name).toBe("steps.pdf");
  });

  it("reports a blocked bot without retrying", async () => {
    const { fetch } = mockFetch(() => json({ ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" }, 403));
    const channel = telegramChannel({ ...base, fetch });
    const error = await channel.send({ id: "m1", to: [{ address: "4242" }], text: "Hi" }).catch((e) => e);
    expect(error).toBeInstanceOf(ChannelError);
    expect(error.retryable).toBe(false);
    expect(error.message).toContain("blocked");
  });
});
