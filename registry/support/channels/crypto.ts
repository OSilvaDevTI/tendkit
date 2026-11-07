/**
 * WebCrypto helpers shared by channel adapters. They run on Workers, Node 20+, Deno and Bun.
 * Signatures are compared with `crypto.subtle.verify`, which is constant-time; there is no
 * portable timingSafeEqual.
 */

const encoder = new TextEncoder();

export function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function base64Decode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function base64UrlEncode(bytes: Uint8Array): string {
  return base64Encode(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function hexDecode(hex: string): Uint8Array | null {
  if (!/^(?:[0-9a-f]{2})*$/i.test(hex)) return null;
  return Uint8Array.from(hex.match(/../g) ?? [], (h) => parseInt(h, 16));
}

export const utf8 = (value: string) => encoder.encode(value);

async function hmacKey(secret: Uint8Array | string, hash: "SHA-1" | "SHA-256", usage: "sign" | "verify") {
  const raw = typeof secret === "string" ? utf8(secret) : secret;
  return crypto.subtle.importKey("raw", raw as BufferSource, { name: "HMAC", hash }, false, [usage]);
}

export async function hmac(secret: Uint8Array | string, data: Uint8Array | string, hash: "SHA-1" | "SHA-256" = "SHA-256") {
  const key = await hmacKey(secret, hash, "sign");
  const body = typeof data === "string" ? utf8(data) : data;
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, body as BufferSource));
}

/** Constant-time check that `signature` is the HMAC of `data`. */
export async function verifyHmac(
  secret: Uint8Array | string,
  data: Uint8Array | string,
  signature: Uint8Array,
  hash: "SHA-1" | "SHA-256" = "SHA-256"
): Promise<boolean> {
  const key = await hmacKey(secret, hash, "verify");
  const body = typeof data === "string" ? utf8(data) : data;
  return crypto.subtle.verify("HMAC", key, signature as BufferSource, body as BufferSource);
}

/** Webhook timestamps outside this window are rejected as replays. */
export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

/**
 * Standard Webhooks / Svix signatures (Resend, and our own API channel):
 * headers webhook-id, webhook-timestamp, webhook-signature ("v1,<base64> v1,<base64>"),
 * secret "whsec_<base64>", signed content "<id>.<timestamp>.<raw body>".
 */
export async function verifyStandardWebhook(
  secret: string,
  headers: Headers,
  rawBody: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<{ id: string } | null> {
  const id = headers.get("webhook-id") ?? headers.get("svix-id");
  const timestamp = headers.get("webhook-timestamp") ?? headers.get("svix-timestamp");
  const signatures = headers.get("webhook-signature") ?? headers.get("svix-signature");
  if (!id || !timestamp || !signatures || !/^\d+$/.test(timestamp)) return null;
  if (Math.abs(nowSeconds - Number(timestamp)) > WEBHOOK_TOLERANCE_SECONDS) return null;
  const key = base64Decode(secret.replace(/^whsec_/, ""));
  const content = `${id}.${timestamp}.${rawBody}`;
  for (const part of signatures.split(" ")) {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) continue;
    let signature: Uint8Array;
    try {
      signature = base64Decode(value);
    } catch {
      continue;
    }
    if (await verifyHmac(key, content, signature)) return { id };
  }
  return null;
}

export async function signStandardWebhook(secret: string, id: string, timestamp: number, rawBody: string) {
  const key = base64Decode(secret.replace(/^whsec_/, ""));
  return `v1,${base64Encode(await hmac(key, `${id}.${timestamp}.${rawBody}`))}`;
}
