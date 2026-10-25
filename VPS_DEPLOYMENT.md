# VPS Production Deployment Guide

This guide covers complete step-by-step instructions to deploy the **SMM Panel** on any Linux VPS (Ubuntu 22.04 / 24.04 LTS recommended, minimum 2GB RAM / 2 vCPU).

---

## 📋 System Prerequisites on VPS

Run on your VPS as `root` or `sudo`:

```bash
# Update package list and install essentials
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw build-essential
```

---

## 🚀 Deployment Option 1: Docker Compose (Recommended)

Docker Compose bundles PostgreSQL, Redis, NestJS API, BullMQ Worker, and Next.js Frontend into coordinated isolated containers.

### 1. Install Docker & Docker Compose
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Clone the Repository
```bash
git clone https://github.com/Particle14Infotech/ssm-panel.git /var/www/smm-panel
cd /var/www/smm-panel
```

### 3. Configure Production Environment
```bash
cp .env.example .env
nano .env
```
Fill in the production secrets in `.env`:
- `JWT_ACCESS_SECRET` (`openssl rand -base64 48`)
- `JWT_REFRESH_SECRET` (`openssl rand -base64 48`)
- `PASSWORD_PEPPER` (`openssl rand -base64 32`)
- `PROVIDER_KEY_SECRET` (`openssl rand -hex 32`)
- `ADMIN_EMAIL` & `ADMIN_PASSWORD` (Your initial administrator credentials)
- `FRONTEND_URL` (Your domain or `http://your-vps-ip:3000`)
- `NEXT_PUBLIC_API_URL` (Your API domain or `http://your-vps-ip:4000/api/v1`)

### 4. Build and Start All Containers
```bash
docker compose -f infra/docker-compose.prod.yml up -d --build
```

### 5. Run Database Migrations & Initial Seed
```bash
docker exec -it smm_api npx prisma migrate deploy
docker exec -it smm_api node scripts/seed.js
```

### 6. Verify Health
```bash
docker compose -f infra/docker-compose.prod.yml ps
curl -i http://localhost:4000/health
```

---

## ⚡ Deployment Option 2: PM2 + Nginx (Native Node.js)

### 1. Install Node.js 22, pnpm, and PM2
```bash
# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Enable Corepack and pnpm
sudo corepack enable
sudo corepack prepare pnpm@latest --activate

# Install PM2 globally
sudo npm install -g pm2
```

### 2. Install & Start PostgreSQL 16 & Redis
```bash
# PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE USER smm_user WITH PASSWORD 'strong_password_here';"
sudo -u postgres psql -c "CREATE DATABASE smm_db OWNER smm_user;"

# Redis
sudo apt install -y redis-server
sudo systemctl enable --now redis-server
```

### 3. Clone Repository & Install Dependencies
```bash
git clone https://github.com/Particle14Infotech/ssm-panel.git /var/www/smm-panel
cd /var/www/smm-panel
pnpm install --frozen-lockfile
```

### 4. Configure Environment
```bash
cp .env.example .env
nano .env
```
Configure your `DATABASE_URL=postgresql://smm_user:strong_password_here@localhost:5432/smm_db?schema=public` and other secrets.

### 5. Build Packages and Run Database Migrations
```bash
# Deploy migrations to database
pnpm exec prisma migrate deploy

# Seed initial categories & admin user
node scripts/seed.js

# Build contracts, api, worker, and web
pnpm run build
```

### 6. Start Services with PM2
```bash
pm2 start infra/pm2/ecosystem.config.js
pm2 save
pm2 startup
```

### 7. Configure Nginx Reverse Proxy
```bash
sudo apt install -y nginx

# Copy nginx config template
sudo cp infra/nginx/smm.conf /etc/nginx/sites-available/smm-panel.conf
sudo ln -s /etc/nginx/sites-available/smm-panel.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Edit your domain name in the config
sudo nano /etc/nginx/sites-available/smm-panel.conf

# Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx
```

### 8. Enable Free SSL via Certbot (Let's Encrypt)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

---

## 🛡️ Firewall & Security Checklist
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 🔍 Useful Maintenance Commands

| Action | Docker Command | PM2 Command |
| :--- | :--- | :--- |
| View API logs | `docker logs -f smm_api` | `pm2 logs smm-api` |
| View Worker logs | `docker logs -f smm_worker` | `pm2 logs smm-worker` |
| View Web logs | `docker logs -f smm_web` | `pm2 logs smm-web` |
| Restart All | `docker compose -f infra/docker-compose.prod.yml restart` | `pm2 restart all` |
| Update Codebase | `git pull && docker compose -f infra/docker-compose.prod.yml up -d --build` | `git pull && pnpm install && pnpm run build && pm2 reload all` |
