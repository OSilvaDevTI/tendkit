/** Every adapter in the registry. Keep in sync with registry.json and registry/support/channels. */
export const CHANNELS = [
  { name: "Resend", item: "channel-resend", kind: "Email", how: "Receives on a Resend receiving domain by webhook, sends through Resend." },
  { name: "Microsoft 365", item: "channel-microsoft365", kind: "Email", how: "Reads and sends from a shared mailbox through Microsoft Graph, with change notifications." },
  { name: "Gmail", item: "channel-gmail", kind: "Email", how: "Google Workspace mailboxes through the Gmail API, with Pub/Sub push or polling." },
  { name: "SMTP / IMAP", item: "channel-smtp", kind: "Email", how: "Any mailbox. You bring the SMTP transport and IMAP poller for your runtime." },
  { name: "Twilio", item: "channel-twilio", kind: "SMS & WhatsApp", how: "SMS and WhatsApp through one Twilio number or Messaging Service." },
  { name: "WhatsApp Cloud API", item: "channel-whatsapp", kind: "WhatsApp", how: "Meta's WhatsApp Business Platform directly, including the 24-hour reply window." },
  { name: "Telegram", item: "channel-telegram", kind: "Chat", how: "A Telegram bot: customers message it, agents answer from the inbox." },
  { name: "Signed API", item: "channel-api", kind: "Your forms", how: "Your contact form or app posts signed requests; replies go out by email." },
] as const;
