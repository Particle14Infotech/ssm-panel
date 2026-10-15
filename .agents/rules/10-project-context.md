# Project context (always on)

- Product: SMM Panel. Behaviour source of truth: the SRS and docs/. UI source of truth: /design-reference. Never invent features, copy, numbers or screens that are in neither.
- Stack: pnpm monorepo. apps/web (Next.js App Router, TypeScript, Tailwind, shadcn/ui), apps/api (NestJS, Prisma, PostgreSQL, Redis, BullMQ, transactional outbox), packages/ui, packages/contracts.
- Docker is NOT used. Do not suggest it or cite it as a blocker.
- Dev and test databases are different (DATABASE_URL vs DATABASE_URL_TEST). Before ANY test that writes data, confirm it points at the test database (print the database name only).
- Before using a script, open the relevant package.json and confirm it exists. Do not guess script names.
- Before editing, read docs/GAP_REPORT.md, docs/SCREEN_MAP.md and the module you are touching.
- Brand name, currency (rupees via Intl) and contact details come from the BRAND config. Never hard-code "SMM PANEL" or "$".
- Copy must be plain and honest. No hype, no guarantees, no "real accounts", no invented stats, clients or testimonials.
