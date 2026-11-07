import { beforeAll, describe, expect, it } from "vitest";
import { WebhookError, type ChannelState } from "../../registry/support/channel";
import { base64Decode, base64Encode, base64UrlEncode, utf8 } from "../../registry/support/channels/crypto";
import { gmailChannel, serviceAccountAssertion, verifyPubSubToken } from "../../registry/support/channels/gmail";
import { buildRawEmail, parseRawEmail } from "../../registry/support/channels/mime";

const RS256 = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;
let keys: CryptoKeyPair;
let pem: string;

beforeAll(async () => {
  keys = (await crypto.subtle.generateKey(
    { ...RS256, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) },
    true,
    ["sign", "verify"]
  )) as CryptoKeyPair;
  const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", keys.privateKey));
  pem = `-----BEGIN PRIVATE KEY-----\n${base64Encode(der).replace(/.{64}/g, "$&\n")}\n-----END PRIVATE KEY-----\n`;
});

const decodeJson = (part: string) => JSON.parse(new TextDecoder().decode(base64Decode(part)));

async function signJwt(claims: Record<string, unknown>, kid = "k1") {
  const input = `${base64UrlEncode(utf8(JSON.stringify({ alg: "RS256", kid, typ: "JWT" })))}.${base64UrlEncode(utf8(JSON.stringify(claims)))}`;
  const sig = new Uint8Array(await crypto.subtle.sign(RS256, keys.privateKey, utf8(input)));
  return `${input}.${base64UrlEncode(sig)}`;
}

const rawMail = (from: string, subject: string, messageId: string) =>
  buildRawEmail({ from: { address: from }, to: [{ address: "x@y.test" }], subject, text: "hello", messageId }).raw;

/** A fake Google: token endpoint, certificates and the Gmail API, recording every request. */
function google(routes: Record<string, (req: Request) => unknown>) {
  const requests: Request[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    requests.push(req.clone());
    const url = new URL(req.url);
    if (url.href === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "tok", expires_in: 3600 });
    if (url.href === "https://www.googleapis.com/oauth2/v3/certs") {
      const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
      return Response.json({ keys: [{ ...jwk, kid: "k1" }] }, { headers: { "cache-control": "public, max-age=600" } });
    }
    const key = `${req.method} ${url.pathname.replace("/gmail/v1/users/support%40acme.test", "")}`;
    const handler = routes[key];
    if (!handler) return new Response("not found", { status: 404 });
    const body = await handler(req);
    return body instanceof Response ? body : Response.json(body);
  }) as typeof globalThis.fetch;
  return { fetch, requests };
}

const auth = () => ({ serviceAccount: { clientEmail: "inbox@proj.iam.gserviceaccount.com", privateKey: pem } });

describe("service account assertion", () => {
  it("is an RS256 JWT impersonating the mailbox, verifiable with the public key", async () => {
    const jwt = await serviceAccountAssertion({ clientEmail: "inbox@proj.iam.gserviceaccount.com", privateKey: pem, privateKeyId: "abc" }, "support@acme.test", 1_800_000_000);
    const [h, c, s] = jwt.split(".") as [string, string, string];
    expect(decodeJson(h)).toEqual({ alg: "RS256", typ: "JWT", kid: "abc" });
    expect(decodeJson(c)).toEqual({
      iss: "inbox@proj.iam.gserviceaccount.com",
      sub: "support@acme.test",
      scope: "https://www.googleapis.com/auth/gmail.modify",
      aud: "https://oauth2.googleapis.com/token",
      iat: 1_800_000_000,
      exp: 1_800_003_600,
    });
    expect(await crypto.subtle.verify(RS256, keys.publicKey, base64Decode(s) as BufferSource, utf8(`${h}.${c}`))).toBe(true);
  });
});

describe("gmail sync", () => {
  it("starts from the current history id, then maps new inbox and sent mail", async () => {
    const g = google({
      "GET /profile": () => ({ historyId: "100" }),
      "POST /watch": () => ({ historyId: "100", expiration: "1" }),
      "GET /history": (req) => {
        expect(new URL(req.url).searchParams.get("startHistoryId")).toBe("100");
        return {
          history: [
            { id: "101", messagesAdded: [{ message: { id: "m1", threadId: "t1", labelIds: ["INBOX", "UNREAD"] } }] },
            { id: "102", messagesAdded: [{ message: { id: "d1", threadId: "t9", labelIds: ["DRAFT"] } }] },
            { id: "103", messagesAdded: [{ message: { id: "m2", threadId: "t1", labelIds: ["SENT"] } }] },
          ],
          historyId: "110",
        };
      },
      "GET /messages/m1": () => ({
        id: "m1",
        threadId: "t1",
        labelIds: ["INBOX"],
        internalDate: "1793000000000",
        raw: base64UrlEncode(utf8(rawMail("mariem@nour.test", "Payout", "<a@nour.test>"))),
      }),
      "GET /messages/m2": () => ({
        id: "m2",
        threadId: "t1",
        labelIds: ["SENT"],
        internalDate: "1793000060000",
        raw: base64UrlEncode(utf8(rawMail("support@acme.test", "Re: Payout", "<b@acme.test>"))),
      }),
    });
    const channel = gmailChannel({ id: "gmail", mailbox: "support@acme.test", auth: auth(), pubsub: { topic: "projects/p/topics/t" }, fetch: g.fetch });

    const first = await channel.sync!(null);
    expect(first.events).toEqual([]);
    expect(first.state).toMatchObject({ historyId: "100", watchError: null });
    const watch = g.requests.find((r) => r.url.endsWith("/watch"))!;
    expect(await watch.json()).toEqual({ topicName: "projects/p/topics/t", labelIds: ["INBOX", "SENT"], labelFilterBehavior: "INCLUDE" });
    expect(watch.headers.get("authorization")).toBe("Bearer tok");

    const second = await channel.sync!(first.state);
    expect(second.state.historyId).toBe("110");
    expect(second.events.map((e) => e.type === "message" && e.message)).toMatchObject([
      { providerMessageId: "m1", providerThreadId: "t1", direction: "inbound", rfcMessageId: "<a@nour.test>", from: { address: "mariem@nour.test" }, receivedAt: new Date(1793000000000) },
      { providerMessageId: "m2", providerThreadId: "t1", direction: "outbound", rfcMessageId: "<b@acme.test>", subject: "Re: Payout" },
    ]);
    expect(g.requests.some((r) => r.url.includes("/messages/d1"))).toBe(false);
    // One token for the whole run, and the watch is not renewed within a day.
    expect(g.requests.filter((r) => r.url.includes("oauth2.googleapis.com/token"))).toHaveLength(1);
    expect(g.requests.filter((r) => r.url.endsWith("/watch"))).toHaveLength(1);
  });

  it("recovers from an expired history id by listing mail since the last sync", async () => {
    const g = google({
      "GET /history": () => new Response("gone", { status: 404 }),
      "GET /profile": () => ({ historyId: "900" }),
      "GET /messages": (req) => {
        expect(new URL(req.url).searchParams.get("q")).toBe(`after:${1793000000 - 60}`);
        return { messages: [{ id: "m1" }] };
      },
      "GET /messages/m1": () => ({ id: "m1", threadId: "t1", labelIds: ["INBOX"], raw: base64UrlEncode(utf8(rawMail("a@b.test", "Hi", "<c@b.test>"))) }),
    });
    const channel = gmailChannel({ id: "gmail", mailbox: "support@acme.test", auth: auth(), fetch: g.fetch });
    const result = await channel.sync!({ historyId: "5", syncedAt: 1793000000000 } as ChannelState);
    expect(result.state.historyId).toBe("900");
    expect(result.events).toHaveLength(1);
  });
});

describe("gmail send", () => {
  it("posts raw MIME into the ticket's thread and reports the Message-ID Gmail kept", async () => {
    let sentBody: { raw: string; threadId?: string } | undefined;
    const g = google({
      "POST /messages/send": async (req) => {
        sentBody = await req.json();
        return { id: "g-out", threadId: "t1" };
      },
      "GET /messages/g-out": () => ({ payload: { headers: [{ name: "Message-Id", value: "<kept@acme.test>" }] } }),
    });
    const channel = gmailChannel({ id: "gmail", mailbox: "support@acme.test", auth: { oauth: { clientId: "c", clientSecret: "s", refreshToken: "r" } }, fetch: g.fetch });
    const result = await channel.send({
      id: "msg_1",
      to: [{ address: "mariem@nour.test", name: "مريم" }],
      fromName: "Acme Support",
      replyTo: { address: "support+t-abc@in.acme.test" },
      subject: "Re: الدفع",
      text: "تم.",
      html: "<p>تم.</p>",
      inReplyTo: "<a@nour.test>",
      references: ["<a@nour.test>"],
      providerThreadId: "t1",
    });
    expect(result).toEqual({ providerMessageId: "g-out", providerThreadId: "t1", rfcMessageId: "<kept@acme.test>", status: "sent" });

    expect(sentBody!.threadId).toBe("t1");
    expect(sentBody!.raw).toMatch(/^[\w-]+$/); // base64url, unpadded
    const mime = await parseRawEmail(base64Decode(sentBody!.raw));
    expect(mime).toMatchObject({
      from: { address: "support@acme.test", name: "Acme Support" },
      to: [{ address: "mariem@nour.test", name: "مريم" }],
      subject: "Re: الدفع",
      inReplyTo: "<a@nour.test>",
      references: ["<a@nour.test>"],
    });
    expect(mime.text?.trim()).toBe("تم.");
    const token = g.requests.find((r) => r.url.includes("oauth2.googleapis.com/token"))!;
    expect(Object.fromEntries(new URLSearchParams(await token.text()))).toEqual({
      grant_type: "refresh_token",
      client_id: "c",
      client_secret: "s",
      refresh_token: "r",
    });
  });
});

describe("gmail push", () => {
  const claims = (over: Record<string, unknown> = {}) => ({
    iss: "https://accounts.google.com",
    aud: "https://app.test/webhooks/gmail",
    email: "push@proj.iam.gserviceaccount.com",
    email_verified: true,
    exp: Math.floor(Date.now() / 1000) + 600,
    ...over,
  });
  const expected = { audience: "https://app.test/webhooks/gmail", serviceAccountEmail: "push@proj.iam.gserviceaccount.com" };

  it("accepts only a Google-signed token for the configured audience and service account", async () => {
    const { fetch } = google({});
    const check = async (token: string) => verifyPubSubToken(`Bearer ${token}`, { ...expected, fetch });
    expect(await check(await signJwt(claims()))).toBe(true);
    expect(await check(await signJwt(claims({ aud: "https://other.test" })))).toBe(false);
    expect(await check(await signJwt(claims({ email: "someone@else.test" })))).toBe(false);
    expect(await check(await signJwt(claims({ email_verified: false })))).toBe(false);
    expect(await check(await signJwt(claims({ exp: 1000 })))).toBe(false);
    expect(await check(await signJwt(claims({ iss: "https://evil.test" })))).toBe(false);
    expect(await check(await signJwt(claims(), "unknown-kid"))).toBe(false);
    const [h, c] = (await signJwt(claims())).split(".");
    const forged = await signJwt(claims({ email: "attacker@x.test" }));
    expect(await check(`${h}.${c}.${forged.split(".")[2]}`)).toBe(false);
    const none = `${base64UrlEncode(utf8(JSON.stringify({ alg: "none", kid: "k1" })))}.${c}.x`;
    expect(await check(none)).toBe(false);
  });

  it("rejects unsigned pushes and, once synced, fetches history on a notification", async () => {
    const g = google({
      "GET /profile": () => ({ historyId: "100" }),
      "GET /history": () => ({ history: [{ id: "101", messagesAdded: [{ message: { id: "m1", labelIds: ["INBOX"] } }] }], historyId: "101" }),
      "GET /messages/m1": () => ({ id: "m1", threadId: "t1", labelIds: ["INBOX"], raw: base64UrlEncode(utf8(rawMail("a@b.test", "Hi", "<c@b.test>"))) }),
    });
    const channel = gmailChannel({
      id: "gmail",
      mailbox: "support@acme.test",
      auth: auth(),
      pubsub: { topic: "projects/p/topics/t", serviceAccountEmail: expected.serviceAccountEmail },
      fetch: g.fetch,
    });
    const push = (token: string | null) =>
      new Request(expected.audience, {
        method: "POST",
        headers: token ? { authorization: `Bearer ${token}` } : {},
        body: JSON.stringify({
          message: { data: base64Encode(utf8(JSON.stringify({ emailAddress: "support@acme.test", historyId: 101 }))), messageId: "1" },
          subscription: "projects/p/subscriptions/s",
        }),
      });

    await expect(channel.webhook!(push(null))).rejects.toBeInstanceOf(WebhookError);
    expect((await channel.webhook!(push(await signJwt(claims())))).events).toEqual([]); // nothing synced yet
    await channel.sync!(null);
    const { events } = await channel.webhook!(push(await signJwt(claims())));
    expect(events).toMatchObject([{ type: "message", message: { providerMessageId: "m1", direction: "inbound" } }]);
  });
});
