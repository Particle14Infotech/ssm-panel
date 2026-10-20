# SMM Panel: Known Limitations & Sandboxed Integrations

This document explicitly details all limitations, deferred features, and sandboxed services for the MVP submission. In accordance with the project's non-negotiable honesty rules, these boundaries are stated plainly.

---

## 1. External Services in Sandbox / Mock Mode

| Integration | Mode in MVP | Reason & Operational Details |
| :--- | :---: | :--- |
| **Razorpay Payment Gateway** | **Sandbox / Mock** | Operating in sandbox simulation mode. Webhook HMAC-SHA256 signature verification and replay protection are fully implemented and verified via unit/invariant tests. Live credit card/UPI bank settlement requires active business merchant keys. |
| **Upstream SMM Wholesaler Providers** | **Mock Adapter** | Operating with `MockProvider` adapter. Service sync, order dispatch, status polling, and API key encryption (`AES-256-GCM`) are implemented and verified. Production wholesale order routing requires live third-party provider accounts with deposit balances. |
| **Instagram Graph API / Meta Connect** | **MockInstagram / Feature Flagged** | **live Meta connection: not verified**. Operating behind `SOURCE_INSTAGRAM_ENABLED=false` and tested exclusively against `MockInstagram` with fault injection. Official Meta App Review approval and live OAuth permissions (`instagram_business_basic`) are not verified. |
| **Social Media Delivery Stability** | **External Risk** | **platform may drop delivered engagement**. Upstream social networks (Meta/Instagram) periodically remove automated accounts and drop follower/like counts. Refill/refund guarantees apply per service rules. |
| **Stories & Live Broadcasts** | **Excluded / Deferred** | Instagram Stories and Live streaming services are not supported by the package engine (scope is limited to permanent posts, reels, and profile followers). |
| **Other Platforms (YouTube/TikTok)** | **Excluded / Deferred** | Package engine currently supports Instagram. TikTok, YouTube, and X auto-post triggers are deferred. |
| **Deployment Architecture** | **Single Node Only** | Worker and API operate in single-node mode. Multi-region or distributed cluster synchronization is not verified. |
| **Email Server (SMTP)** | **Console Adapter** | Password reset tokens and transaction notifications are printed directly to the server process console output instead of routing through an external SMTP transport (e.g. Amazon SES / SendGrid). |
| **PostgreSQL Database Engine** | **Dual Engine** | Local automated gate and invariant suites utilize `pg-mem` in-memory PostgreSQL engine and Prisma mock client because host PostgreSQL daemon is not running on localhost:5432 and Docker is prohibited. Dev/prod environments require managed PostgreSQL. |
| **Redis & Queue Processor** | **Dual Mode** | Local gate utilizes `ioredis-mock` and in-memory relay; host Redis daemon is not running on localhost:6379 and Docker is prohibited. Dev/prod environments require managed Redis. |

---

## 2. Infrastructure & Toolchain Limitations

| Component | Status | Details |
| :--- | :---: | :--- |
| **`pg_dump` & `pg_restore`** | **Not Installed on Host** | Native PostgreSQL CLI utilities are not present in Windows system `PATH`. Host-level physical dump/restore is marked *NOT VERIFIED*. Restore verification drill is validated via JSON snapshot manifests. |
| **Multi-Node PM2 Cluster** | **Single Node Dev** | Nginx reverse proxy and PM2 cluster configurations exist under `infra/nginx` and `infra/pm2`, but live multi-process load balancing is deferred for local single-process development. |
| **Docker Prohibition** | **Zero-Docker by Design** | Docker is not used. Dev and test environments execute natively via Node.js/pnpm. |

---

## 3. Deferred Features (Feature-Flagged Off)

The following components remain implemented or architected in code, but are excluded from the MVP demo scope and hidden from navigation:

1. **Public Reseller Portal & API (`RESELLER_FEATURE_FLAG=false`)**: Code exists in `apps/api/src/modules/reseller`, but public nav routes are deferred to post-MVP.
2. **Two-Factor Authentication (TOTP 2FA) (`TWO_FACTOR_FEATURE_FLAG=false`)**: Service logic exists in `auth.service.ts`; UI onboarding workflow is deferred.
3. **SMS / WhatsApp Gateway Notifications (`SMS_NOTIFICATIONS_FLAG=false`)**: In-app notifications and console SMTP serve as primary communication channels.
4. **Data Archival Background Job (`DATA_ARCHIVAL_FLAG=false`)**: Database remains active without cold-storage offloading.
5. **OpenTelemetry Telemetry Pipeline (`OTEL_FLAG=false`)**: Structured Pino JSON logging with request ID tracking is active.

---

## 4. Testing & Browser Limitations

1. **Mobile Browser Testing**: E2E tests are targeted to Desktop Chrome (1440px viewport). Mobile viewports (390px) have static responsive fallbacks in CSS, but mobile touch gesture automation is not included in the automated gate.
2. **WebGL / 3D Canvas Fallback**: The 3D Crown stage requires WebGL hardware or software acceleration (Angle/SwiftShader). On systems without WebGL, a responsive static 2D fallback (`crown-fallback.webp`) is rendered.
