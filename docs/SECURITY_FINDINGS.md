# Security Findings & Architecture Review: Link Preview

**Audit Date:** 2026-11-06  
**Component:** Link Preview Module (`apps/api/src/modules/link-preview`, `apps/web/components/shared/LinkPreviewCard.tsx`, `packages/contracts/src/link-validation.ts`)

---

## Finding SEC-01: Absence of Content-Security-Policy (CSP) & `remotePatterns` Scope

### 1. Current State Assessment
An audit of HTTP security headers across the platform confirmed that:
- **API (NestJS / Fastify):** `helmet()` is invoked in `apps/api/src/main.ts` with default settings, which does not configure or enforce a `Content-Security-Policy` header.
- **Frontend (Next.js):** `apps/web/next.config.js` configures `headers()` with `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`. It **does not emit any `Content-Security-Policy` header**.
- **Edge / Reverse Proxy:** No Nginx or Cloudflare CSP injection rule is currently configured for downstream web assets.

### 2. Correction of `remotePatterns` Scope
- **Finding:** Initial design documentation referenced Next.js `images.remotePatterns` in `next.config.js` as an image loading boundary.
- **Correction:** Next.js `remotePatterns` **only** restricts images processed by the server-side Next.js Image Optimization API (`/_next/image` using `next/image`). It **does not govern native `<img>` elements rendered in the DOM**. A browser rendering `<img src="..." />` directly bypasses Next.js `remotePatterns`.
- **Mitigation:** Native DOM image containment strictly requires browser-level enforcement via the `Content-Security-Policy: img-src ...` directive.

---

## 3. Proposed Content-Security-Policy Specification

### Baseline Policy (Enforcing Phase):
```http
Content-Security-Policy: default-src 'self'; \
  img-src 'self' data: blob: https://i.ytimg.com https://img.youtube.com https://*.tiktokcdn.com https://*.tiktokcdn-us.com https://images.unsplash.com https://lh3.googleusercontent.com; \
  script-src 'self' 'unsafe-eval' 'unsafe-inline'; \
  style-src 'self' 'unsafe-inline'; \
  connect-src 'self' http://localhost:4000 http://127.0.0.1:4000 https://api.cheapest-smm.com; \
  font-src 'self' data:; \
  frame-ancestors 'none'; \
  base-uri 'self'; \
  form-action 'self';
```

---

## 4. Report-Only Staged Rollout Plan

To prevent unintended outages, broken asset loading, or third-party tracking regressions on the live production frontend:

### Phase 1: Deploy `Content-Security-Policy-Report-Only` (Days 1–7)
Configure `apps/web/next.config.js` to emit the header in report-only mode with an internal report destination:
```javascript
{
  key: "Content-Security-Policy-Report-Only",
  value: "default-src 'self'; img-src 'self' data: blob: https://i.ytimg.com https://img.youtube.com https://*.tiktokcdn.com https://*.tiktokcdn-us.com https://images.unsplash.com https://lh3.googleusercontent.com; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:4000 http://127.0.0.1:4000; report-uri /api/v1/telemetry/csp-violations;"
}
```
- In this phase, the browser logs violations to the console and reports them to `/api/v1/telemetry/csp-violations` without blocking any resource from loading.

### Phase 2: Violation Review & Allowlist Tuning (Days 8–10)
- Analyze reported CSP violations in server telemetry logs.
- Identify legitimate unlisted assets (e.g. additional analytics scripts or CDN fonts) and add them explicitly to the policy allowlist.

### Phase 3: Enforcing Mode Promotion (Day 11+)
- Once report-only mode records 0 unexpected violation events for 72 consecutive hours, switch `Content-Security-Policy-Report-Only` to `Content-Security-Policy`.

