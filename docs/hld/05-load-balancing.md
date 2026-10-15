# ⚖️ HLD 05: Load Balancing & Clustering Architecture

**Status:** IMPLEMENTED  
**Date:** 2026-10-12  

---

## 1. Stateless Scaling Model

The NestJS monolith API (`apps/api`) is strictly **stateless**:
1. **No In-Memory Sessions**: Authentication uses short-lived JWT access tokens and database-backed rotating refresh sessions.
2. **Shared Throttler & Queue**: Redis powers cluster-wide rate limiting and BullMQ message distribution.
3. **Idempotent Workers**: All background jobs are keyed with deterministic idempotency keys (`idempotencyKey`).
4. **Single Scheduler Owner**: Worker engine has exactly 1 active scheduler/cron instance, while consumers can scale.

---

## 2. Infrastructure Configuration

### A. Nginx Configuration (`infra/nginx/smm.conf`)
- Round-robin / `least_conn` upstream load distribution across API port 4000 and cluster instances.
- Active health checks on `/api/v1/health/ready`.
- Proxy headers: `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`.
- Gzip compression on JSON and web assets.
- Dual-tier rate limiting zones (`100r/s` for general API, `10r/s` burst protection on `/api/v1/auth/`).

### B. PM2 Ecosystem File (`infra/pm2/ecosystem.config.js`)
- `smm-api`: Cluster mode (`exec_mode: "cluster"`, `instances: "max"`).
- `smm-worker`: Fork mode with **strictly ONE instance** (`instances: 1`, `WORKER_ENABLED: "true"`).
- `smm-web`: Next.js production SSR cluster.

---

## 3. Dual-Instance Local Verification Proof

A dual-instance reverse proxy load balancer was executed on port 8088 distributing traffic between **API Instance 1** (`127.0.0.1:4000`) and **API Instance 2** (`127.0.0.1:4002`):

```text
Request 1: GET /api/v1/health/live
HTTP/1.1 200 OK
x-served-by: API-Instance-1
{"status":"ok","uptime":1080.9633419,"timestamp":"2026-10-11T18:45:46.323Z"}

Request 2: GET /api/v1/health/live
HTTP/1.1 200 OK
x-served-by: API-Instance-2
{"status":"ok","uptime":312.3902501,"timestamp":"2026-10-11T18:45:51.239Z"}

Login -> Order Placement Flow via Load Balancer:
POST /api/v1/auth/login -> 200 OK (JWT issued)
POST /api/v1/orders/create -> 201 Created (Order ORD-57521 dispatched across cluster)
```
