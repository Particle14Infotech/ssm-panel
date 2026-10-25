# ATTACK_MATRIX.md: Package Feature & Platform Attack Surface Security Matrix

This matrix maps every package-related route, queue job, platform mutation endpoint, and administrative controller.
Columns evaluate:
1. **Authn Required**: Unauthenticated caller rejected (401).
2. **Authz / Role**: Strict role restriction enforced (e.g. ADMIN vs CUSTOMER).
3. **Ownership (IDOR)**: Tenant isolation enforced; cross-tenant access returns 404 (not 403, no leak).
4. **Input Validation**: Strict schema, bounds, sanitization, negative/zero/NaN rejection.
5. **Mass Assignment**: DTO whitelist enforced; client-provided privileged fields ignored.
6. **Idempotency**: Duplicate requests produce deterministic, non-duplicative execution.
7. **Rate Limit**: Throttling enabled to prevent resource exhaustion / brute-force.
8. **Feature-Flag Guard**: `PACKAGES_ENABLED` and `PACKAGES_ALLOWED_USER_IDS` kill-switch enforced.
9. **Race Safety**: PostgreSQL row-level locking (`FOR UPDATE`) / transactions prevent double-spends.
10. **Response Leakage**: Zero supplier cost, margin, provider IDs, or internal secrets exposed.

---

| Endpoint / Queue Job | Authn | Authz / Role | Ownership (IDOR) | Input Validation | Mass Assignment | Idempotency | Rate Limit | Feature-Flag | Race Safety | Leak Free | Overall Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST /packages/quote` | TESTED-PASS (JWT/Guest) | TESTED-PASS (Any) | N/A (Pure calc) | TESTED-PASS (Strict) | TESTED-PASS | N/A | TESTED-PASS (Throttled) | TESTED-PASS | N/A (Stateless) | TESTED-PASS | TESTED-PASS |
| `POST /packages` (Purchase) | TESTED-PASS (JWT) | TESTED-PASS (CUSTOMER) | TESTED-PASS (User wallet) | TESTED-PASS (Strict bounds) | TESTED-PASS | TESTED-PASS (Key locked) | TESTED-PASS | TESTED-PASS | TESTED-PASS (FOR UPDATE) | TESTED-PASS | TESTED-PASS |
| `GET /packages` (List) | TESTED-PASS (JWT) | TESTED-PASS (CUSTOMER) | TESTED-PASS (`userId` scoped) | TESTED-PASS | TESTED-PASS | N/A | TESTED-PASS | TESTED-PASS | N/A (Read) | TESTED-PASS | TESTED-PASS |
| `GET /packages/:id` (Get) | TESTED-PASS (JWT) | TESTED-PASS (CUSTOMER) | TESTED-PASS (404 on other) | TESTED-PASS (UUID/CUID) | TESTED-PASS | N/A | TESTED-PASS | TESTED-PASS | N/A (Read) | TESTED-PASS | TESTED-PASS |
| `POST /packages/:id/pause` | TESTED-PASS (JWT) | TESTED-PASS (CUSTOMER) | TESTED-PASS (404 on other) | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS (FOR UPDATE) | TESTED-PASS | TESTED-PASS |
| `POST /packages/:id/resume`| TESTED-PASS (JWT) | TESTED-PASS (CUSTOMER) | TESTED-PASS (404 on other) | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS (FOR UPDATE) | TESTED-PASS | TESTED-PASS |
| `POST /packages/:id/cancel`| TESTED-PASS (JWT) | TESTED-PASS (CUSTOMER) | TESTED-PASS (404 on other) | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS (FOR UPDATE) | TESTED-PASS | TESTED-PASS |
| `POST /packages/:id/reschedule`| TESTED-PASS (JWT) | TESTED-PASS (CUSTOMER) | TESTED-PASS (404 on other) | TESTED-PASS (ISO date) | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS (FOR UPDATE) | TESTED-PASS | TESTED-PASS |
| `POST /packages/:id/report-problem` | TESTED-PASS (JWT) | TESTED-PASS (CUSTOMER) | TESTED-PASS (404 on other) | TESTED-PASS (Sanitized) | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS (Tx) | TESTED-PASS | TESTED-PASS |
| `GET /packages/:id/executions` | TESTED-PASS (JWT) | TESTED-PASS (CUSTOMER) | TESTED-PASS (404 on other) | TESTED-PASS | TESTED-PASS | N/A | TESTED-PASS | TESTED-PASS | N/A (Read) | TESTED-PASS | TESTED-PASS |
| `GET /packages/favorites` | TESTED-PASS (JWT) | TESTED-PASS (CUSTOMER) | TESTED-PASS (`userId` scoped) | TESTED-PASS | TESTED-PASS | N/A | TESTED-PASS | TESTED-PASS | N/A (Read) | TESTED-PASS | TESTED-PASS |
| `POST /packages/favorites` | TESTED-PASS (JWT) | TESTED-PASS (CUSTOMER) | TESTED-PASS (`userId` attached)| TESTED-PASS (50 cap) | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS |
| `DELETE /packages/favorites/:id` | TESTED-PASS (JWT) | TESTED-PASS (CUSTOMER) | TESTED-PASS (404 on other) | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS |
| `GET /packages/suggestions` | TESTED-PASS (JWT) | TESTED-PASS (CUSTOMER) | TESTED-PASS | TESTED-PASS | TESTED-PASS | N/A | TESTED-PASS | TESTED-PASS | N/A (Read) | TESTED-PASS | TESTED-PASS |
| `POST /services` (Create) | TESTED-PASS (JWT) | TESTED-PASS (ADMIN only) | N/A (Global catalog) | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS | N/A | TESTED-PASS | TESTED-PASS | TESTED-PASS |
| `PUT /services/:id` (Update) | TESTED-PASS (JWT) | TESTED-PASS (ADMIN only) | N/A (Global catalog) | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS | N/A | TESTED-PASS | TESTED-PASS | TESTED-PASS |
| `DELETE /services/:id` (Delete) | TESTED-PASS (JWT) | TESTED-PASS (ADMIN only) | N/A (Global catalog) | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS | N/A | TESTED-PASS | TESTED-PASS | TESTED-PASS |
| `POST /services/categories` | TESTED-PASS (JWT) | TESTED-PASS (ADMIN only) | N/A (Global catalog) | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS | N/A | TESTED-PASS | TESTED-PASS | TESTED-PASS |
| `GET /providers` & mutations | TESTED-PASS (JWT) | TESTED-PASS (ADMIN only) | N/A (Admin infrastructure)| TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS | N/A | TESTED-PASS | TESTED-PASS | TESTED-PASS |
| `GET/PUT /settings` | TESTED-PASS (JWT) | TESTED-PASS (ADMIN only) | N/A (Admin settings) | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS | N/A | TESTED-PASS | TESTED-PASS | TESTED-PASS |
| `GET /reports/*` | TESTED-PASS (JWT) | TESTED-PASS (ADMIN only) | N/A (Financial reports) | TESTED-PASS | TESTED-PASS | N/A | TESTED-PASS | N/A | N/A (Read) | TESTED-PASS | TESTED-PASS |
| `POST /coupons` & `/bonuses` | TESTED-PASS (JWT) | TESTED-PASS (ADMIN only) | N/A (Financial creation)| TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS | N/A | TESTED-PASS | TESTED-PASS | TESTED-PASS |
| `POST /announcements` | TESTED-PASS (JWT) | TESTED-PASS (ADMIN only) | N/A (Global broadcast)| TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS | N/A | TESTED-PASS | TESTED-PASS | TESTED-PASS |
| `PUT /users/me` (Profile) | TESTED-PASS (JWT) | TESTED-PASS (CUSTOMER) | TESTED-PASS (Self only) | TESTED-PASS | TESTED-PASS (Tier blocked) | TESTED-PASS | TESTED-PASS | N/A | TESTED-PASS | TESTED-PASS | TESTED-PASS |
| `GET /orders/:id` | TESTED-PASS (JWT) | TESTED-PASS (CUSTOMER/ADMIN) | TESTED-PASS (404 on other) | TESTED-PASS | TESTED-PASS | N/A | TESTED-PASS | N/A | N/A (Read) | TESTED-PASS | TESTED-PASS |
| `GET /tickets/:id` | TESTED-PASS (JWT) | TESTED-PASS (CUSTOMER/ADMIN) | TESTED-PASS (404 on other) | TESTED-PASS | TESTED-PASS | N/A | TESTED-PASS | N/A | N/A (Read) | TESTED-PASS | TESTED-PASS |
| `POST /payments/webhook/*` | TESTED-PASS (HMAC) | TESTED-PASS (Gateway sig) | TESTED-PASS | TESTED-PASS (Timestamped) | TESTED-PASS | TESTED-PASS (Tx unique) | TESTED-PASS | N/A | TESTED-PASS (FOR UPDATE) | TESTED-PASS | TESTED-PASS |
| `POST /reseller/v2` | TESTED-PASS (API Key)| TESTED-PASS (Reseller role)| TESTED-PASS (`userId` scoped) | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS | TESTED-PASS (Restricted) | TESTED-PASS | TESTED-PASS | TESTED-PASS |
| Worker: `pollAndDispatch` | N/A (Internal) | N/A (Background worker) | N/A (Per package owner)| TESTED-PASS (Stub clamped) | N/A | TESTED-PASS (State lock) | Bounded (Poll int) | TESTED-PASS (Allowlist) | TESTED-PASS (SKIP LOCKED) | N/A | TESTED-PASS |
| Worker: `pollAndReconcile` | N/A (Internal) | N/A (Background worker) | N/A (Per package owner)| TESTED-PASS (Status FSM) | N/A | TESTED-PASS (Terminal locks) | Bounded (Poll int) | TESTED-PASS (Allowlist) | TESTED-PASS (SKIP LOCKED) | N/A | TESTED-PASS |
