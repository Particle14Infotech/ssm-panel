# Security and external services (always on)

- Never log or print: DB or Redis URLs with credentials, tokens, passwords, API keys, webhook secrets. Log host and database name only.
- Every external value is a placeholder until I provide it: use REPLACE_ME_<NAME> in .env.example. Never invent fake keys, endpoints or credentials and never call real external APIs.
- External services sit behind adapters with a sandbox implementation (payments, mailer, storage, provider). In production the app must refuse to boot if a required integration is still a placeholder.
- Provider API keys are stored encrypted (AES-256-GCM), never returned by any API, masked in the UI.
- Do not weaken auth, RBAC, CSRF, rate limits or validation to make a test pass.
