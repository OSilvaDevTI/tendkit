import type { Identity, IdentityKind } from "./types";

/**
 * Normalizes an identity so the same person always maps to the same contact.
 * Emails are lower-cased and trimmed, nothing more: dots and +tags are left alone, because
 * jane.doe@ and janedoe@ are different people on most providers.
 */
export function normalizeIdentity(kind: IdentityKind, value: string): Identity {
  const trimmed = value.trim();
  if (kind === "email") return { kind, value: trimmed.toLowerCase() };
  if (kind === "phone" || kind === "whatsapp") {
    const raw = trimmed.replace(/^whatsapp:/i, "");
    // WhatsApp users who hide their number arrive with a business-scoped id ("US.1349…"): keep it as is.
    if (/[a-z]/i.test(raw)) return { kind, value: raw };
    const digits = raw.replace(/[^\d+]/g, "");
    return { kind, value: digits.startsWith("+") ? digits : digits ? `+${digits}` : trimmed };
  }
  return { kind, value: trimmed };
}

/** "Re: Re: Fwd: Payout" → "Payout", for comparing subjects across a thread. */
export function baseSubject(subject: string | null | undefined): string {
  let s = (subject ?? "").trim();
  const prefix = /^(re|fw|fwd|tr|aw|wg|sv|vs|rv|réf|ref|رد|إعادة توجيه)\s*(\[\d+\])?\s*:\s*/i;
  while (prefix.test(s)) s = s.replace(prefix, "").trim();
  return s.replace(/\s+/g, " ");
}

export function replySubject(subject: string | null | undefined): string {
  const base = (subject ?? "").trim();
  return /^re\s*:/i.test(base) ? base : `Re: ${base}`;
}

/** Returns the ticket token from a reply address like "support+t-abc123@in.acme.com". */
export function tokenFromAddress(address: string): string | null {
  const local = address.split("@")[0] ?? "";
  return /\+t-([a-z0-9]{10,40})$/i.exec(local)?.[1]?.toLowerCase() ?? null;
}

/** "support@in.acme.com" + token → "support+t-<token>@in.acme.com". */
export function addressWithToken(address: string, token: string): string {
  const [local, domain] = address.split("@");
  return `${local}+t-${token}@${domain}`;
}

export function displayName(name: string | null | undefined, address: string): string {
  return name?.trim() || address;
}
