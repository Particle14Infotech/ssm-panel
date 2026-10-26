# Render Deployment Guide

This guide provides step-by-step instructions to deploy the entire **SMM Panel** stack (Database, NestJS Backend API, Next.js Frontend Web, and Background Worker) on [Render.com](https://render.com).

---

## ⚡ Option 1: 1-Click Blueprint Deployment (Recommended)

Render supports Infrastructure as Code via the `render.yaml` blueprint included in the root of this repository.

### Step 1: Connect Your GitHub Repository
1. Go to [Render Dashboard](https://dashboard.render.com/) and log in.
2. Click **New +** in the top right corner and select **Blueprint**.
3. Select your GitHub repository (`Particle14Infotech/ssm-panel` or your fork).
4. Branch: `main`.

### Step 2: Review Blueprint Resources
Render will automatically detect `render.yaml` and parse:
- **`smm-postgres`** (PostgreSQL Database)
- **`smm-api`** (NestJS Backend API Web Service)
- **`smm-web`** (Next.js Frontend Web Service)
- **`smm-worker`** (Background Order & Status Worker)

### Step 3: Apply Blueprint
1. Click **Apply**.
2. Render will spin up the PostgreSQL database first, followed by the API, Worker, and Web frontend.
3. Database migrations (`prisma migrate deploy`) and initial data seeding run automatically on service boot.

---

## 🛠️ Option 2: Manual Dashboard Setup

If you prefer to configure each service manually from the Render Dashboard:

### 1. Create PostgreSQL Database
1. Click **New +** ➡️ **PostgreSQL**.
2. **Name**: `smm-postgres`
3. **Database**: `smm_db`
4. **User**: `smm_user`
5. **Plan**: Free (or Starter for production).
6. Click **Create Database**.
7. Copy the **Internal Database URL** (e.g. `postgresql://...`).

---

### 2. Create Backend API (`smm-api`)
1. Click **New +** ➡️ **Web Service**.
2. Connect your repository.
3. Configure settings:
   - **Name**: `smm-api`
   - **Language**: `Node`
   - **Branch**: `main`
   - **Root Directory**: `.` (leave empty or default)
   - **Build Command**: `pnpm install --no-frozen-lockfile && node scripts/build-service.js`
   - **Start Command**: `node scripts/start-service.js`
   - **Health Check Path**: `/api/v1/health`
4. In **Environment Variables**, add:
   | Key | Value |
   | :--- | :--- |
   | `NODE_ENV` | `production` |
   | `PORT` | `4000` |
   | `SERVICE_NAME` | `smm` |
   | `DATABASE_URL` | *Paste your PostgreSQL Internal Connection String* |
   | `JWT_SECRET` | *32+ character random string* |
   | `JWT_ACCESS_SECRET` | *32+ character random string* |
   | `JWT_REFRESH_SECRET` | *32+ character random string* |
   | `PASSWORD_PEPPER` | *32+ character random string* |
   | `PROVIDER_KEY_SECRET` | *32-byte hex key* |
   | `PROVIDER_KEY_ENCRYPTION_KEY` | *Same as PROVIDER_KEY_SECRET* |
   | `ADMIN_EMAIL` | `admin@smmpanel.com` |
   | `ADMIN_PASSWORD` | *Your secure admin password* |
   | `FRONTEND_URL` | `https://smm-web.onrender.com` *(update after creating web)* |
5. Click **Create Web Service**. Note down the assigned public URL (e.g. `https://smm-api.onrender.com`).

---

### 3. Create Frontend (`smm-web`)
1. Click **New +** ➡️ **Web Service**.
2. Connect your repository.
3. Configure settings:
   - **Name**: `smm-web`
   - **Language**: `Node`
   - **Branch**: `main`
   - **Root Directory**: `.` (leave empty or default)
   - **Build Command**: `pnpm install --no-frozen-lockfile && node scripts/build-service.js`
   - **Start Command**: `node scripts/start-service.js`
4. In **Environment Variables**, add:
   | Key | Value |
   | :--- | :--- |
   | `NODE_ENV` | `production` |
   | `PORT` | `3000` |
   | `SERVICE_NAME` | `web` |
   | `NEXT_PUBLIC_SITE_NAME` | `SMM Panel` |
   | `NEXT_PUBLIC_API_URL` | `https://smm-api.onrender.com/api/v1` *(Your backend API URL)* |
5. Click **Create Web Service**.

---

### 4. Create Background Worker (`smm-worker`)
1. Click **New +** ➡️ **Background Worker**.
2. Connect your repository.
3. Configure settings:
   - **Name**: `smm-worker`
   - **Language**: `Node`
   - **Branch**: `main`
   - **Build Command**: `pnpm install --no-frozen-lockfile && node scripts/build-service.js`
   - **Start Command**: `node scripts/start-service.js`
4. In **Environment Variables**, add:
   | Key | Value |
   | :--- | :--- |
   | `NODE_ENV` | `production` |
   | `SERVICE_NAME` | `worker` |
   | `DATABASE_URL` | *Paste PostgreSQL Internal Connection String* |
   | `PROVIDER_KEY_SECRET` | *Same encryption key used in API* |
5. Click **Create Background Worker**.

---

## 🔍 Post-Deployment Verification

1. **API Health Check**:
   Open `https://<your-smm-api>.onrender.com/api/v1/health` in your browser. It should return:
   ```json
   { "status": "ok", "timestamp": "...", "database": "connected" }
   ```
2. **Web Frontend**:
   Open `https://<your-smm-web>.onrender.com`. You should see the Landing Page, Login, and Dashboard.
3. **Admin Login**:
   - Go to `/login`
   - Use the `ADMIN_EMAIL` and `ADMIN_PASSWORD` you configured.
