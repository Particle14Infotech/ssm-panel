# Money and data safety (always on)

- Money is integer paise or Prisma Decimal. Never floats. Use the shared money util.
- Price is computed on the server: ceil(rate x quantity / 1000). Never trust a client price.
- Wallet balance changes only through ledger entries. Never update a balance directly.
- Every wallet write uses one DB transaction and locks the wallet row (SELECT ... FOR UPDATE via $queryRaw).
- Orders require an Idempotency-Key. A duplicate key creates one order and one charge.
- One order has at most one REFUND ledger entry (enforced by a DB constraint, not only by code).
- Partial refund = round half up of charge x remains / quantity, in integer paise.
- Refund after provider failure happens only after retries are exhausted.
- Only worker.ts consumes queues (WORKER_ENABLED). The API process enqueues only.
- Never run `prisma migrate reset`, `db push --accept-data-loss`, drop, truncate or bulk delete without my explicit OK. Never touch the dev or production DB from tests.
- The sandbox payment simulator must be unreachable when NODE_ENV=production.
