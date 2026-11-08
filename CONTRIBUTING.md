# Contributing

Thanks for helping. Tendkit is copy-in code, so whatever you change ends up inside other people's apps. Keep changes small, tested and easy to read.

## Setup

```bash
pnpm install
pnpm typecheck        # browser and server (no DOM) builds
pnpm test             # core on Postgres (PGlite) and on SQLite/D1, adapters against recorded payloads
pnpm registry:build   # rebuild public/r after changing anything in registry/
```

Commit `public/r` with your change; CI checks it matches the source.

## Good first contributions

**A channel adapter.** Each one lives in a single file, `registry/support/channels/<name>.ts`, and implements the `Channel` interface in `registry/support/channel.ts`.

- **What adapters do:** they translate provider payloads into `ChannelEvent`s and send `OutboundMessage`s. Threading, storage and rules stay in the service.
- **Runtime:** use `fetch` and WebCrypto only, so the adapter runs on Workers, Node, Bun and Deno. Don't add SDK dependencies.
- **Webhooks:** verify every webhook signature, and throw `WebhookError` when verification fails.
- **Tests:** add `tests/channels/<name>.test.ts` using recorded payloads from the provider's docs, with secrets replaced. `tests/channels/fetch.ts` fakes the provider API.
- **Registry:** add an item to `registry.json`.

Adapters we'd like: Postmark, Amazon SES, SendGrid, Mailgun, Slack, Discord, Instagram, Facebook Messenger, and a website chat widget.

**A language.** Copy `registry/support-ui/messages/en.json` to your locale, translate it, and keep every key. Right-to-left languages need nothing extra.

**Email trimming.** When a reply shows quoted history or a signature it shouldn't, add the real message (anonymized) as a case in `tests/text.test.ts`, then fix `registry/support/text.ts`.

## Guidelines

- **Behaviour changes come with a test** that fails without the change.
- **Keep the engine generic.** Product-specific logic belongs in the consumer's directory, notifier or UI wrappers, not in `service.ts`.
- **UI copy earns its place.** Every label, hint and message should help someone do something. No filler.
- **Nothing private in fixtures.** No real names, addresses or tokens.

## Reporting security issues

See [SECURITY.md](SECURITY.md). Please don't open public issues for vulnerabilities.
