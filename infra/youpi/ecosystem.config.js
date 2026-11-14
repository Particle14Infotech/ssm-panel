/**
 * YouPI-PG Isolated Subsystem - PM2 Ecosystem Configuration
 *
 * Runs under dedicated unprivileged OS user (e.g. `youpi`):
 *   su - youpi
 *   pm2 start infra/youpi/ecosystem.config.js
 *
 * ISOLATION RULES:
 * 1. Pinned commit from dedicated directory (e.g. /opt/youpi-pg or /home/youpi/youpi-pg).
 * 2. NEVER runs inside SMM application repo or Node processes.
 * 3. Payment API binds to 127.0.0.1:6100 (private to host, reachable by SMM API).
 * 4. Checkout portal binds to 127.0.0.1:7000 (proxied via Nginx for checkout assets).
 * 5. Auto-update is strictly disabled.
 */

module.exports = {
  apps: [
    {
      name: 'youpi-payment-api',
      cwd: process.env.YOUPI_INSTALL_DIR || '/opt/youpi-pg',
      script: 'apps/payment-api/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '384M',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        YOUPI_MODE: 'production',
        PORT: 6100,
        HOST: '127.0.0.1',
        DATABASE_URL: process.env.YOUPI_DATABASE_URL || '',
        USE_SQLITE_FALLBACK: 'true',
        SQLITE_DB_PATH: process.env.YOUPI_SQLITE_DB_PATH || '/opt/youpi-pg/data/youpi_pg.sqlite',
        ENCRYPTION_MASTER_KEY: process.env.YOUPI_ENCRYPTION_MASTER_KEY || '',
        JWT_SECRET: process.env.YOUPI_JWT_SECRET || '',
        ADMIN_API_TOKEN: process.env.YOUPI_ADMIN_API_TOKEN || '',
        OBSERVER_API_TOKEN: process.env.YOUPI_OBSERVER_API_TOKEN || '',
        YOUPI_ALLOWED_ORIGINS: process.env.YOUPI_ALLOWED_ORIGINS || 'https://smm-panel.example.com',
        YOUPI_ALLOWED_RETURN_ORIGINS: process.env.YOUPI_ALLOWED_RETURN_ORIGINS || 'https://smm-panel.example.com',
        CHECKOUT_FRAME_ANCESTORS: process.env.YOUPI_CHECKOUT_FRAME_ANCESTORS || 'https://smm-panel.example.com',
        YOUPI_ALLOW_PRIVATE_WEBHOOKS: 'true' // Allows delivering webhooks to local SMM API at http://127.0.0.1:4000
      }
    },
    {
      name: 'youpi-checkout-portal',
      cwd: process.env.YOUPI_INSTALL_DIR || '/opt/youpi-pg',
      script: 'apps/checkout-portal/src/server.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        YOUPI_MODE: 'production',
        PORT: 7000,
        HOST: '127.0.0.1',
        API_PROXY_TARGET: 'http://127.0.0.1:6100',
        CHECKOUT_FRAME_ANCESTORS: process.env.YOUPI_CHECKOUT_FRAME_ANCESTORS || 'https://smm-panel.example.com'
      }
    }
  ]
};

