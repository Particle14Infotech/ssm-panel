/**
 * PM2 CLUSTER ARCHITECTURE & CONNECTION POOL MATH SPECIFICATION
 * =============================================================
 * 
 * Target Cluster Allocation:
 * - smm-api:    2 instances (cluster mode, round-robin load distribution)
 * - smm-worker: 1 instance  (fork mode, singleton scheduler / processor)
 * 
 * PostgreSQL Connection Pool Budget Math:
 * - PostgreSQL server `max_connections`: 100
 * - Reserved for PostgreSQL superuser:    5 (superuser_reserved_connections)
 * - Authoritative Max Application Budget: 95 connections
 * 
 * Allocated Pool Limits (via `DATABASE_URL?connection_limit=N`):
 * - API Instance #1: pool size = 20 connections
 * - API Instance #2: pool size = 20 connections
 * - Worker Instance: pool size = 10 connections
 * - Total Active Application Pool: 20 + 20 + 10 = 50 connections
 * - Reserve Safety Headroom: 95 - 50 = 45 connections
 *   (Available for prisma migrate, pg_dump, psql maintenance sessions)
 * 
 * Memory Budget Allocation:
 * - API Instance #1: 512 MB max memory restart
 * - API Instance #2: 512 MB max memory restart
 * - Worker Instance: 384 MB max memory restart
 * - Total RSS Memory Ceiling: ~1.4 GB
 */

module.exports = {
  apps: [
    {
      name: "smm-api",
      script: "apps/api/dist/main.js",
      instances: 2,
      exec_mode: "cluster",
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
        PRISMA_CONNECTION_LIMIT: 20,
      },
    },
    {
      name: "smm-worker",
      script: "apps/worker/dist/main.js",
      instances: 1, // Singleton scheduler to prevent competing queue lock races
      exec_mode: "fork",
      max_memory_restart: "384M",
      env: {
        NODE_ENV: "production",
        WORKER_ENABLED: "true",
        PRISMA_CONNECTION_LIMIT: 10,
      },
    },
    {
      name: "smm-web",
      script: "node_modules/next/dist/bin/next",
      args: "start apps/web -p 3000",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};

