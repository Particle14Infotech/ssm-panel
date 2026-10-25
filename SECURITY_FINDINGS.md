# SECURITY_FINDINGS.md: Security Findings, Exploits, and Verified Fixes

This document records every vulnerability identified during the adversarial break-it security test of the Package Engine and its interconnected platform components. All Critical and High severity findings were proven via failing tests, patched at root cause, and permanently verified via automated regression tests in `test:security-package`.

---

## Summary of Findings

| Finding ID | Severity | Endpoint / Component | Impact | Root Cause | Status | Regression Test |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AUTHZ-01** | **CRITICAL** | `POST/PUT/DELETE /services`, `POST /services/categories` | Unauthenticated catalog corruption | Missing `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(Role.ADMIN)` | **FIXED-VERIFIED** | `AUTHZ-01` |
| **AUTHZ-02** | **CRITICAL** | `GET/POST /providers`, `POST /providers/:id/test` | Credential exfiltration & provider hijacking | Controller had no authentication or role guards | **FIXED-VERIFIED** | `AUTHZ-02` |
| **AUTHZ-03** | **CRITICAL** | `GET/PUT /settings` | Full platform takeover via config | Controller had no authentication or role guards | **FIXED-VERIFIED** | `AUTHZ-03` |
| **AUTHZ-04** | **CRITICAL** | `GET /reports/summary`, `GET /reports/export-csv` | PII & financial revenue leakage | Controller had no authentication or role guards | **FIXED-VERIFIED** | `AUTHZ-04` |
| **AUTHZ-05** | **HIGH** | `POST /coupons`, `POST /bonuses` | Unrestricted wallet balance generation | Mutation routes had no admin role checks | **FIXED-VERIFIED** | `AUTHZ-05` |
| **AUTHZ-06** | **HIGH** | `POST /announcements` | Stored XSS / defacement broadcast | Create route lacked admin role guards | **FIXED-VERIFIED** | `AUTHZ-06` |
| **FLAG-02** | **HIGH** | `PackagesEnabledGuard`, Worker `pollAndDispatch` | Beta rollout containment breach | `PACKAGES_ALLOWED_USER_IDS` not enforced in HTTP guard or worker query | **FIXED-VERIFIED** | `FLAG-02`, `FLAG-03` |
| **MONEY-02** | **HIGH** | `POST /packages/quote`, `POST /packages` | Schedule timeline corruption (division by zero) | Falsy `input.days || 30` evaluation masked `0` duration as default | **FIXED-VERIFIED** | `MONEY-02` |
| **USERS-01** | **HIGH** | `PUT /users/me` (Profile update) | Privilege escalation to highest discount tiers | Mass assignment on `updateProfile` accepted client-supplied `tier` | **FIXED-VERIFIED** | `USERS-01` |
| **IDOR-ORD-01**| **HIGH** | `GET /orders/:id` | Cross-tenant order details exposure | Caller without `requesterUserId` bypassed non-admin check | **FIXED-VERIFIED** | `IDOR-08` |
| **IDOR-TCK-01**| **HIGH** | `GET /tickets/:id` | Cross-tenant support chat exposure | Caller without `requesterUserId` bypassed non-admin check | **FIXED-VERIFIED** | `IDOR-09` |
| **XSS-01** | **HIGH** | `getOrderRefundTemplate` (Email) | HTML/Script injection in customer inbox | Dynamic `reason` parameter interpolated without HTML escaping | **FIXED-VERIFIED** | `XSS-01` |
| **XSS-02** | **HIGH** | `getSupportReplyTemplate` (Email) | HTML/Script injection in customer inbox | Dynamic `replyExcerpt` and `subject` unescaped | **FIXED-VERIFIED** | `XSS-02` |
| **PKG-CANCEL-01**| **MEDIUM**| `POST /packages/:id/cancel` | Resumed runs dispatched after cancellation | `cancelPackage` omitted `SKIPPED_PAUSED` execution state in status update | **FIXED-VERIFIED** | `PKG-CANCEL-01` |
| **ADMIN-01** | **HIGH** | `POST /packages/admin/executions/:id/resolve` | Double execution dispatch / financial loss | `adminResolveExecution` allowed `RETRY` on already `COMPLETED` executions | **FIXED-VERIFIED** | `ADMIN-01` |
| **REPORT-02** | **MEDIUM**| `POST /packages/:id/report-problem` | Support queue poisoning & payload flood | No length limits on `issue`/`description` and no package status check | **FIXED-VERIFIED** | `REPORT-02` |
| **FAV-01** | **LOW** | `POST /packages/favorites` | Bypass of 50-item favorites cap via race | `count()` check was outside a row-locked transaction | **FIXED-VERIFIED** | `FAV-01` |

---

## Detailed Findings & Root-Cause Analyses

### 1. AUTHZ-01..04: Unauthenticated Platform Mutation & Infrastructure Controllers
- **Severity**: **CRITICAL**
- **Impact**: Any anonymous caller sending HTTP requests could mutate the public service catalog, dump upstream provider API keys and balances, reconfigure core system settings, and export full platform financial summaries and CSVs.
- **Root Cause**: The controllers (`ServicesController`, `ProvidersController`, `SettingsController`, `ReportsController`) lacked `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(Role.ADMIN)` class/method decorators.
- **Fix**: Added class-level `JwtAuthGuard` and `RolesGuard` with `@Roles(Role.ADMIN)` to `ProvidersController`, `SettingsController`, and `ReportsController`. Added method-level guards to mutation endpoints in `ServicesController`.
- **Proof of Exploit / Regression Test**: `AUTHZ-01`, `AUTHZ-02`, `AUTHZ-03`, `AUTHZ-04` verify reflection metadata and guard rejection.

### 2. AUTHZ-05..06: Unauthenticated Coupon/Bonus & Announcement Creation
- **Severity**: **HIGH**
- **Impact**: Malicious users could generate 100% discount coupons or free balance bonuses and broadcast arbitrary messages to all logged-in users.
- **Root Cause**: `CouponsController` and `AnnouncementsController` lacked role restrictions on `create` and `createBonus` methods.
- **Fix**: Added `UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(Role.ADMIN)` decorators.
- **Proof of Exploit / Regression Test**: `AUTHZ-05` and `AUTHZ-06`.

### 3. FLAG-02: Feature-Flag & Allowlist Bypass
- **Severity**: **HIGH**
- **Impact**: When enabling packages in beta testing for specific QA/admin accounts using `PACKAGES_ALLOWED_USER_IDS="usr_admin,usr_qa"`, non-allowlisted customers were able to invoke package creation and the background worker dispatched executions for non-allowlisted users.
- **Root Cause**: `PackagesEnabledGuard` only checked `PACKAGES_ENABLED === 'true'`. The worker query in `main.ts` did not filter package executions by `package.userId IN (:allowedUserIds)`.
- **Fix**: Implemented allowlist checking in `PackagesEnabledGuard` with JWT parsing and HTTP 403 `ForbiddenException`. Added allowlist filtering in `apps/worker/src/main.ts` `pollAndDispatchPackageExecutions`.
- **Proof of Exploit / Regression Test**: `FLAG-02` and `FLAG-03`.

### 4. MONEY-02: Duration Zero / Negative Days Parameter Tampering
- **Severity**: **HIGH**
- **Impact**: Attackers could supply `days: 0` or negative days, causing timeline calculation anomalies, potential infinite loops, or zero-cost execution schedules.
- **Root Cause**: In `packages-quote.service.ts`, JavaScript falsy evaluation `input.days || 30` caused `days: 0` to silently fall back to `30`, bypassing client-side validation without throwing the required `BadRequestException`.
- **Fix**: Added explicit integer and positive bounds validation:
  ```ts
  if (input.days !== undefined && (!Number.isInteger(input.days) || input.days <= 0)) {
    throw new BadRequestException("Schedule duration must be a positive integer.");
  }
  ```
- **Proof of Exploit / Regression Test**: `MONEY-02`.

### 5. USERS-01: Mass Assignment Privilege Escalation on `PUT /users/me`
- **Severity**: **HIGH**
- **Impact**: Any customer could send `{ "tier": "ENTERPRISE" }` or `{ "tier": "VIP" }` to self-elevate their pricing discount tier without administrative approval or qualifying deposit volume.
- **Root Cause**: `UsersService.updateProfile` accepted arbitrary properties on the request body and passed them into Prisma `update`.
- **Fix**: Hardened `updateProfile` to strictly permit only `name` sanitization, ignoring any `tier` field passed by callers.
- **Proof of Exploit / Regression Test**: `USERS-01`.

### 6. IDOR-ORD-01 & IDOR-TCK-01: Cross-Tenant Order and Ticket Access
- **Severity**: **HIGH**
- **Impact**: Potential leakage of orders or support communications between different customers if internal service calls omitted `requesterUserId`.
- **Root Cause**: Conditions used `if (requesterRole !== 'ADMIN' && requesterUserId && ticket.userId !== requesterUserId)`. If `requesterUserId` was undefined, the check short-circuited to false.
- **Fix**: Updated checks to: `if (requesterRole !== 'ADMIN' && (!requesterUserId || ticket.userId !== requesterUserId)) { throw new NotFoundException(); }`.
- **Proof of Exploit / Regression Test**: `IDOR-08`, `IDOR-09`.

### 7. XSS-01 & XSS-02: Stored Cross-Site Scripting in Email Notifications
- **Severity**: **HIGH**
- **Impact**: Stored XSS rendered in web-based email clients when customers or admins viewed order refund notices or ticket replies containing attacker-controlled payloads.
- **Root Cause**: `getOrderRefundTemplate` and `getSupportReplyTemplate` inserted user input directly into HTML strings without entity escaping.
- **Fix**: Created `escapeHtml` utility and applied it across all dynamic template variables (`name`, `reason`, `replyExcerpt`, `subject`).
- **Proof of Exploit / Regression Test**: `XSS-01`, `XSS-02`.

### 8. PKG-CANCEL-01: Orphaned Execution Resumption Post-Cancellation
- **Severity**: **MEDIUM**
- **Impact**: If a package was paused (moving executions into `SKIPPED_PAUSED`) and subsequently cancelled, the `SKIPPED_PAUSED` executions were not marked `CANCELLED`. If resumed by mistake, they could be dispatched.
- **Root Cause**: `cancelPackage` only transitioned `[SCHEDULED, DETECTED]` executions to `CANCELLED`.
- **Fix**: Included `PackageExecutionStatus.SKIPPED_PAUSED` in the `updateMany` status filter.
- **Proof of Exploit / Regression Test**: `PKG-CANCEL-01`.

### 9. ADMIN-01: Re-dispatch / Double Delivery via Admin Execution Resolution
- **Severity**: **HIGH**
- **Impact**: Calling `adminResolveExecution` with action `RETRY` on an execution that was already `COMPLETED` reset its status to `SCHEDULED`, causing the background worker to dispatch the order again to upstream providers (financial loss and duplicate free delivery).
- **Root Cause**: `adminResolveExecution` did not validate that the target execution was non-terminal (`UNCERTAIN`, `STALLED`, `FAILED`).
- **Fix**: Added explicit guard throwing `BadRequestException` when attempting any resolution action on executions in `COMPLETED` or `CANCELLED` status.
- **Proof of Exploit / Regression Test**: `ADMIN-01`.

### 10. REPORT-02: Support Queue Flooding & Unbounded Payloads via `reportProblem`
- **Severity**: **MEDIUM**
- **Impact**: Attackers could submit unbounded text blobs (> 10MB) or spam problem reports against ancient `CANCELLED` or `COMPLETED` packages, degrading database storage and flooding the administrative support queue.
- **Root Cause**: Missing bounds validation on `issue` and `description`, and absence of package lifecycle status checks.
- **Fix**: Enforced `issue <= 100` characters, `description <= 2000` characters, and restricted reporting strictly to `ACTIVE` or `PAUSED` packages.
- **Proof of Exploit / Regression Test**: `REPORT-02`.

### 11. FAV-01: 50-Item Favorites Cap Bypass via Concurrency Race Condition
- **Severity**: **LOW**
- **Impact**: Sending 50 concurrent requests when a user had 49 favorites allowed all requests to read `count < 50` simultaneously and insert, storing up to 99 favorites.
- **Root Cause**: The count check and insertion in `FavoritesService.createFavorite` were not protected by an atomic row lock.
- **Fix**: Wrapped the count check and upsert in a single `$transaction` using `SELECT id FROM "User" WHERE id = $1 FOR UPDATE`.
- **Proof of Exploit / Regression Test**: `FAV-01`.

