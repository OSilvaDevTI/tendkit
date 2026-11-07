import PostalMime, { type Address as MimeAddress, type Attachment as MimeAttachment, type Mailbox } from "postal-mime";
import type { InboundAttachment, InboundMessage, OutboundAttachment } from "../channel";
import type { Address } from "../types";
import { base64Encode, utf8 } from "./crypto";

/**
 * Raw RFC 5322 mail in and out, for mailbox channels (Gmail, SMTP/IMAP, Cloudflare Email Routing).
 * Parsing uses postal-mime (`pnpm add postal-mime@^4.2.0`); building is done here, with no dependency.
 */

/** Messages above this are not parsed: postal-mime holds the whole message in memory. */
export const MAX_RAW_EMAIL_BYTES = 25 * 1024 * 1024;

/** Headers the core reads (auto-reply, bounce and mailing-list detection). Everything else is dropped. */
const KEPT_HEADERS =
  /^(auto-submitted|x-auto(reply|respond|responder|reply-from|-response-suppress)|x-mail-autoreply|x-?precedence|precedence|list-(id|unsubscribe|post)|return-path|x-failed-recipients|content-type)$/;

// --------------------------------------------------------------------------------------- parse

export async function parseRawEmail(
  raw: Uint8Array | ArrayBuffer | string,
  options: { providerMessageId?: string; receivedAt?: Date; maxBytes?: number } = {}
): Promise<InboundMessage> {
  const bytes = typeof raw === "string" ? utf8(raw) : raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  const maxBytes = options.maxBytes ?? MAX_RAW_EMAIL_BYTES;
  const tooLarge = bytes.byteLength > maxBytes;
  // An oversized message still becomes a ticket, from its headers alone, so nobody's mail vanishes.
  const email = await PostalMime.parse(tooLarge ? headerSection(bytes) : bytes, { maxRfc822NestingDepth: 3 });

  const mailboxes = (list: MimeAddress[] | undefined): Address[] =>
    (list ?? []).flatMap((a) => (a.group ? a.group : [a])).map(toAddress).filter((a) => a.address);
  const from = [email.from, email.sender, ...(email.replyTo ?? [])].flatMap((a) => mailboxes(a ? [a] : []))[0];
  const references = messageIds(email.references);
  const date = email.date ? new Date(email.date) : null;

  const headers: Record<string, string> = {};
  for (const h of email.headers) if (KEPT_HEADERS.test(h.key) && !(h.key in headers)) headers[h.key] = h.value;

  return {
    providerMessageId: options.providerMessageId ?? email.messageId ?? (await sha256Hex(bytes)),
    from: from ?? { address: email.returnPath?.replace(/[<>]/g, "") ?? "", name: null },
    to: mailboxes(email.to),
    cc: mailboxes(email.cc),
    subject: email.subject ?? null,
    text: tooLarge
      ? `This email is ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB, over the ${Math.round(maxBytes / 1024 / 1024)} MB limit, so only its headers were imported. Open it in the mailbox to read it.`
      : (email.text ?? null),
    html: tooLarge ? null : (email.html ?? null),
    headers,
    rfcMessageId: messageIds(email.messageId)[0] ?? null,
    inReplyTo: messageIds(email.inReplyTo)[0] ?? null,
    references,
    receivedAt: options.receivedAt ?? (date && !Number.isNaN(date.getTime()) ? date : new Date()),
    attachments: email.attachments.map(toAttachment),
  };
}

function toAddress(m: Mailbox): Address {
  return { address: m.address.trim(), name: m.name.trim() || null };
}

function toAttachment(a: MimeAttachment): InboundAttachment {
  const content = typeof a.content === "string" ? utf8(a.content) : new Uint8Array(a.content);
  return {
    // Names come from the sender: strip paths, control and bidi-override characters.
    filename: (a.filename ?? "").split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "").trim() || "attachment",
    contentType: /^[\w.+-]+\/[\w.+-]+$/.test(a.mimeType) ? a.mimeType : "application/octet-stream",
    size: content.byteLength,
    contentId: a.contentId ?? null,
    inline: a.disposition === "inline" || Boolean(a.related),
    read: async () => content,
  };
}

/** "<a@b> <c@d>" → ["<a@b>", "<c@d>"]; tolerates ids sent without brackets. */
function messageIds(value: string | undefined): string[] {
  if (!value) return [];
  const bracketed = value.match(/<[^<>\s]+>/g);
  if (bracketed) return bracketed;
  return value.split(/[\s,]+/).filter((v) => v.includes("@")).map((v) => `<${v}>`);
}

function headerSection(bytes: Uint8Array): Uint8Array {
  const limit = Math.min(bytes.byteLength, 1024 * 1024);
  for (let i = 0; i < limit - 1; i++) {
    if (bytes[i] === 10 && (bytes[i + 1] === 10 || (bytes[i + 1] === 13 && bytes[i + 2] === 10))) {
      return bytes.subarray(0, i + 1);
    }
  }
  return bytes.subarray(0, limit);
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

// --------------------------------------------------------------------------------------- build

export type RawEmailInput = {
  from: Address;
  to: Address[];
  cc?: Address[];
  replyTo?: Address | null;
  subject?: string | null;
  text: string;
  html?: string | null;
  attachments?: OutboundAttachment[];
  /** With angle brackets. Generated as `<uuid@sender-domain>` when omitted. */
  messageId?: string | null;
  inReplyTo?: string | null;
  references?: string[];
  /** Extra headers (Auto-Submitted, …). Ones this builder sets itself are ignored. */
  headers?: Record<string, string>;
  date?: Date;
};

const CRLF = "\r\n";

/**
 * Builds an RFC 5322 / MIME message: base64 UTF-8 bodies, multipart/alternative for text + html,
 * multipart/mixed for attachments, RFC 2047 encoded-words for non-ASCII headers and RFC 2231
 * attachment names. Output is 7-bit ASCII with CRLF line endings.
 */
export function buildRawEmail(input: RawEmailInput): { raw: string; messageId: string } {
  const domain = input.from.address.split("@").pop() || "localhost";
  const messageId = input.messageId || `<${crypto.randomUUID()}@${domain}>`;
  const headers: [string, string][] = [
    ["From", formatAddress(input.from)],
    ["To", input.to.map(formatAddress).join(`,${CRLF} `)],
  ];
  if (input.cc?.length) headers.push(["Cc", input.cc.map(formatAddress).join(`,${CRLF} `)]);
  if (input.replyTo) headers.push(["Reply-To", formatAddress(input.replyTo)]);
  headers.push(["Subject", encodeHeaderText(clean(input.subject ?? ""))]);
  headers.push(["Date", formatDate(input.date ?? new Date())]);
  headers.push(["Message-ID", messageId]);
  if (input.inReplyTo) headers.push(["In-Reply-To", clean(input.inReplyTo)]);
  if (input.references?.length) headers.push(["References", input.references.map(clean).join(`${CRLF} `)]);
  const taken = new Set([...headers.map(([k]) => k.toLowerCase()), "mime-version", "content-type", "content-transfer-encoding", "bcc"]);
  for (const [name, value] of Object.entries(input.headers ?? {})) {
    if (/^[!-9;-~]+$/.test(name) && !taken.has(name.toLowerCase())) headers.push([name, encodeHeaderText(clean(value))]);
  }
  headers.push(["MIME-Version", "1.0"]);

  const textPart = bodyPart("text/plain; charset=UTF-8", utf8(input.text));
  let body = input.html
    ? multipart("alternative", [textPart, bodyPart("text/html; charset=UTF-8", utf8(input.html))])
    : textPart;
  if (input.attachments?.length) body = multipart("mixed", [body, ...input.attachments.map(attachmentPart)]);

  const head = headers.map(([k, v]) => `${k}: ${v}`).join(CRLF);
  return { raw: `${head}${CRLF}${body}`, messageId };
}

/** A part is its own headers, a blank line and its body. */
function bodyPart(contentType: string, content: Uint8Array, extra: string[] = []) {
  return [`Content-Type: ${contentType}`, "Content-Transfer-Encoding: base64", ...extra, "", base64Lines(content)].join(CRLF);
}

function multipart(subtype: "alternative" | "mixed", parts: string[]) {
  // "=_" never occurs in base64, so the boundary can't collide with a base64 body.
  const boundary = `=_tendkit_${crypto.randomUUID().replace(/-/g, "")}`;
  return [
    `Content-Type: multipart/${subtype};${CRLF} boundary="${boundary}"`,
    "",
    ...parts.flatMap((p) => [`--${boundary}`, p]),
    `--${boundary}--`,
    "",
  ].join(CRLF);
}

function attachmentPart(a: OutboundAttachment) {
  const name = clean(a.filename).replace(/[\\/]/g, "_") || "attachment";
  const type = /^[\w.+-]+\/[\w.+-]+$/.test(a.contentType) ? a.contentType : "application/octet-stream";
  const ascii = /^[\x20-\x7e]*$/.test(name);
  let params = [`filename="${name.replace(/["\\]/g, "_")}"`];
  if (!ascii || name.length > 60) {
    // RFC 2231: percent-encoded UTF-8 split into continuations (never inside a %XX). Parsers prefer a
    // plain filename= when both are present, so it is left out; old clients read the name below.
    const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
    const chunks = encoded.match(/(?:%[0-9A-F]{2}|[^%]){1,18}/g) ?? [];
    params = chunks.map((chunk, i) => `filename*${i}*=${i === 0 ? "UTF-8''" : ""}${chunk}`);
  }
  // Outlook and other older clients read an RFC 2047 name on Content-Type instead.
  const typeName = ascii ? name.replace(/["\\]/g, "_") : encodeWords(name);
  return bodyPart(`${type};${CRLF} name="${typeName}"`, a.content, [`Content-Disposition: attachment;${CRLF} ${params.join(`;${CRLF} `)}`]);
}

function base64Lines(bytes: Uint8Array) {
  return base64Encode(bytes).replace(/.{76}/g, `$&${CRLF}`).replace(/\r\n$/, "");
}

/** Header values must not carry line breaks (header injection). */
const clean = (value: string) => value.replace(/[\r\n]+/g, " ").trim();

export function formatAddress(a: Address): string {
  const address = clean(a.address);
  const name = clean(a.name ?? "");
  if (!name) return address;
  if (!/^[\x20-\x7e]*$/.test(name)) return `${encodeWords(name)} <${address}>`;
  return /^[\w !#$%&'*+\-/=?^`{|}~]*$/.test(name) ? `${name} <${address}>` : `"${name.replace(/(["\\])/g, "\\$1")}" <${address}>`;
}

/** ASCII text is folded at spaces; anything else becomes encoded-words. */
function encodeHeaderText(value: string) {
  if (!/^[\x20-\x7e]*$/.test(value)) return encodeWords(value);
  const lines: string[] = [];
  let line = "";
  for (const word of value.split(" ")) {
    if (line && line.length + word.length >= 70) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  // Unfolding removes only the CRLF, so "a CRLF SP b" reads back as "a b".
  return [...lines, line].join(`${CRLF} `);
}

/**
 * RFC 2047 B-encoding. Each word holds whole characters and at most 39 UTF-8 bytes, so it stays
 * at 64 characters and a header line with one word fits in 76. Words are folded onto new lines.
 */
export function encodeWords(value: string): string {
  const words: string[] = [];
  let current = "";
  for (const char of value) {
    if (utf8(current + char).byteLength > 39) {
      words.push(current);
      current = char;
    } else current += char;
  }
  if (current) words.push(current);
  return words.map((w) => `=?UTF-8?B?${base64Encode(utf8(w))}?=`).join(`${CRLF} `);
}

function formatDate(date: Date) {
  // RFC 5322 date-time with a numeric zone: "Sat, 07 Nov 2026 10:00:00 +0000".
  return date.toUTCString().replace(/GMT$/, "+0000");
}
