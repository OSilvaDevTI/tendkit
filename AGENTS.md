# Working on Tendkit

Tendkit is a shadcn registry of copy-in code for a customer support inbox. Read [CONTRIBUTING.md](CONTRIBUTING.md) first.

- `registry/` is the product: `support/` (engine, stores, channel adapters) and `support-ui/` (screens). It's copied into other apps, so keep it dependency-light and readable.
- `app/` and `site/` are the website (tendkit.softwaresavants.dev): landing page, docs, and a demo that runs `support-ui` on an in-memory client (`site/demo-client.ts`).
- Adapters use `fetch` and WebCrypto only. Verify webhook signatures. Add tests with recorded provider payloads.
- Before finishing: `pnpm typecheck`, `pnpm test` (Postgres and D1), `pnpm build`, and `pnpm registry:build` with `public/r` committed.
- Claims on the site and in the docs must match the code. Fixtures use invented names and `.test` domains.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
