/**
 * Plain-text helpers that run anywhere (Workers, Node, the browser): no DOM.
 *
 * Patterns follow Discourse's email_reply_trimmer, talon and Zammad. Arabic patterns are
 * best-effort: add real samples to tests/fixtures when you see a reply that isn't trimmed.
 */

const BIDI_CONTROLS = /[‎‏‪-‮⁦-⁩]/g;

/** Lines where quoted history starts. Everything from the match down is dropped. */
const QUOTE_HEADERS: RegExp[] = [
  /^[\s>]*(?:On|At)\s.{1,300}?\b(?:wrote|writes|said)\s*:?\s*$/i,
  /^[\s>]*.{1,250}\s(?:wrote|schrieb|a écrit|escribió)\s*:\s*$/i,
  /^[\s>]*Le\s.{1,300}?\ba\s+écrit\s*:?\s*$/i,
  /^[\s>]*(?:في|بتاريخ|يوم)\s.{1,300}?(?:تمت\s+كتابة\s+ما\s+يلي\s+بواسطة|كتب|كتبت)\s.{0,250}:\s*$/,
  /^[\s>]*.{1,250}\s(?:كتب|كتبت)\s*:\s*$/,
  /^[\s>]*.{0,40}\d{4}.{1,80}<[^@<>\s]+@[^@<>\s]+\.[^@<>\s]+>:?\s*$/,
  /^[\s>*]*-{2,}\s*(?:Original Message|Forwarded message|Reply Message|Message d'origine|Message transféré|Ursprüngliche Nachricht|Mensaje original|الرسالة الأصلية|رسالة معاد توجيهها)\s*-{2,}/i,
  /^[\s>]*(?:Begin forwarded message|Début du message (?:réexpédié|transféré))\s*:/i,
];

/** An Outlook-style "From: / Sent: / To: / Subject:" block. */
const HEADER_LABEL =
  /^[\s>*]*(?:From|Sent|Date|To|Cc|Subject|De|Envoyé|À|A|Objet|Von|Gesendet|An|Betreff|من|المرسل|تم الإرسال|التاريخ|إلى|نسخة|الموضوع)\s*:\s*\S/i;

/** Mobile signatures: only these lines are removed. */
const SIGNATURE_LINES: RegExp[] = [
  /^\s*[(<]*Sent (?:from|via|with|by) .+/i,
  /^\s*Get Outlook for /i,
  /^\s*Envoyé (?:depuis|de) (?:mon|Yahoo Mail)/i,
  /^\s*Obtenir Outlook pour /i,
  /^\s*(?:أرسلت|تم الإرسال|مرسل(?:ة)?) من (?:جهاز )?(?:الـ)?(?:iPhone|آيفون|هاتف|Android)/i,
];

/**
 * What the person wrote this time: drops quoted history, the "-- " signature and mobile
 * signatures. Falls back to the full text when trimming would leave nothing.
 */
export function visibleReply(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").replace(BIDI_CONTROLS, "").replace(/[  ]/g, " ").split("\n");
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (QUOTE_HEADERS.some((re) => re.test(line)) || isHeaderBlock(lines, i) || /^-- ?$/.test(line)) {
      end = i;
      break;
    }
    // A run of "> " lines at the end is quoted history even without a header.
    if (/^\s*>/.test(line) && lines.slice(i).every((l) => /^\s*(>|$)/.test(l))) {
      end = i;
      break;
    }
  }
  const kept = lines
    .slice(0, end)
    .filter((line) => !SIGNATURE_LINES.some((re) => re.test(line)))
    .join("\n")
    .trim();
  return kept || text.trim();
}

function isHeaderBlock(lines: string[], i: number): boolean {
  if (!HEADER_LABEL.test(lines[i]!)) return false;
  const following = lines.slice(i + 1, i + 5).filter((l) => HEADER_LABEL.test(l));
  return following.length >= 2;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Readable text from HTML email, without a DOM. Quotes become "> " lines so trimming still works. */
export function htmlToText(html: string): string {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(head|style|script|title)[^>]*>[\s\S]*?<\/\1>/gi, "")
    // Known quote containers: everything inside becomes quoted.
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner: string) =>
      `\n${htmlToText(inner).split("\n").map((l) => `> ${l}`).join("\n")}\n`
    )
    .replace(/<div[^>]+(?:gmail_quote|yahoo_quoted|divRplyFwdMsg|appendonsend|moz-cite-prefix|protonmail_quote)[\s\S]*$/i, "\n> \n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|table|ul|ol|section|article)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, label: string) => {
      const text = label.replace(/<[^>]+>/g, "").trim();
      return text && text !== href && /^https?:/i.test(href) ? `${text} (${href})` : text || href;
    })
    .replace(/<[^>]+>/g, "");
  s = s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
  return s
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function snippet(text: string, length = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > length ? `${flat.slice(0, length - 1).trimEnd()}…` : flat;
}

/**
 * Why a message was sent by a machine (out-of-office, bounce, mailing list), or null when a
 * person wrote it. Automated mail never reopens a ticket, notifies anyone or gets an acknowledgement.
 */
export function automatedReason(headers: Record<string, string> | undefined, from: string): string | null {
  const h = (name: string) => headers?.[name];
  const v = (name: string) => (h(name) ?? "").trim().toLowerCase();
  const autoSubmitted = v("auto-submitted");
  if (autoSubmitted && !/^no\b/.test(autoSubmitted)) return "auto-submitted";
  if (["x-autoreply", "x-autorespond", "x-autoresponder", "x-autoreply-from", "x-mail-autoreply"].some((n) => v(n)))
    return "auto-reply";
  if (/\b(bulk|list|junk|auto_reply)\b/.test(v("precedence") || v("x-precedence"))) return "precedence";
  if (["list-id", "list-unsubscribe", "list-post"].some((n) => h(n) !== undefined)) return "mailing-list";
  if (/\ball\b|\boof\b|autoreply/.test(v("x-auto-response-suppress"))) return "auto-reply";
  if (v("return-path") === "<>") return "null-return-path";
  if (h("x-failed-recipients") !== undefined) return "bounce";
  if (/multipart\/report/.test(v("content-type"))) return "report";
  if (/^(mailer-daemon|postmaster|bounces?|listserv|majordomo)@|^owner-|-request@/i.test(from)) return "system-sender";
  return null;
}

/** Plain text to the minimal HTML we send: escaped, paragraphs, links, direction per paragraph. */
export function textToHtml(text: string): string {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((p) =>
      `<p dir="auto" style="margin:0 0 1em">${escape(p)
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
        .replace(/\n/g, "<br>")}</p>`
    );
  return `<div dir="auto" style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;line-height:1.6;color:#111">${paragraphs.join("")}</div>`;
}

/**
 * True when the receiving server recorded that the sender failed authentication: DMARC failed,
 * or neither SPF nor DKIM passed. Such mail still becomes a ticket, but it isn't linked to the
 * customer it claims to come from and gets no automatic reply.
 */
export function senderFailedAuthentication(headers: Record<string, string> | undefined): boolean {
  const results = headers?.["authentication-results"]?.toLowerCase();
  if (!results) return false;
  if (/\bdmarc=fail\b/.test(results)) return true;
  const spfFailed = /\bspf=(fail|softfail)\b/.test(results);
  const dkimFailed = /\bdkim=(fail|none)\b/.test(results) && !/\bdkim=pass\b/.test(results);
  return spfFailed && dkimFailed;
}
