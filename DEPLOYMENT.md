# Goom Booking System — Production Deployment Guide

This guide documents the production deployment architecture, environment configuration, and verification steps for **Goom Booking System**.

---

## 1. Architecture Overview

```
┌─────────────────────────────────┐
│     Client Browsers             │
└──────────────┬──────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────┐       HTTPS       ┌─────────────────────────────────┐
│        Vercel (Frontend)        │ ────────────────► │         Render (Backend)        │
│   React 19 + TypeScript + Vite  │    /api/v1/*      │       Node.js + Express API     │
│   Single Page App with CDN Edge │                   │       Health Check on /health   │
└─────────────────────────────────┘                   └────────────────┬────────────────┘
                                                                       │ TLS / SSL
                                                                       ▼
                                                      ┌─────────────────────────────────┐
                                                      │      Neon PostgreSQL Database   │
                                                      │      Serverless Cloud DB Pool   │
                                                      └─────────────────────────────────┘
```

---

## 2. Prerequisites & Accounts

1. **GitHub Repository:** `https://github.com/bisratG101/Saas-Booking-System`
2. **Neon Account:** Active PostgreSQL database project (existing).
3. **Render Account:** [render.com](https://render.com) (Free tier / Web Service).
4. **Vercel Account:** [vercel.com](https://vercel.com) (Hobby / Free tier).

---

## 3. Backend Deployment on Render

### Step 3.1: Create Render Web Service
1. Log in to [dashboard.render.com](https://dashboard.render.com).
2. Click **New +** $\to$ **Web Service**.
3. Connect your GitHub repository: `Saas-Booking-System`.
4. Fill in the following service settings:
   - **Name:** `goom-booking-api`
   - **Region:** Ohio (US East) or Frankfurt (closest to your Neon DB region)
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install --include=dev && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free` (or `Starter` at \$7/mo for zero cold starts)
   - **Health Check Path:** `/health`

### Step 3.2: Configure Backend Environment Variables
Under the **Environment** tab in Render, configure the following:

| Variable Name | Required Value / Description | Sensitive? |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | No |
| `PORT` | `10000` (Render defaults to 10000) | No |
| `DATABASE_URL` | Your Neon PostgreSQL connection string (`postgres://...sslmode=require`) | **YES** |
| `JWT_SECRET` | Cryptographically random string ($\ge 32$ characters) | **YES** |
| `JWT_EXPIRES_IN` | `1h` | No |
| `CORS_ORIGIN` | Your Vercel frontend URL (e.g. `https://goom-booking.vercel.app`) | No |

> [!IMPORTANT]
> - In production, `NODE_ENV=production` enforces that `JWT_SECRET` cannot use development fallback strings.
> - Generate a secure 32+ character JWT secret using Node.js:
>   ```bash
>   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
>   ```

### Step 3.3: Deploy and Verify Backend
1. Click **Create Web Service**.
2. Once the build finishes, verify the health check endpoint:
   ```bash
   curl https://<your-render-service>.onrender.com/health
   ```
   Expected response:
   ```json
   {
     "status": "ok",
     "environment": "production",
     "database": {
       "status": "connected"
     }
   }
   ```

---

## 4. Frontend Deployment on Vercel

### Step 4.1: Import Project to Vercel
1. Log in to [vercel.com](https://vercel.com).
2. Click **Add New...** $\to$ **Project**.
3. Select the `Saas-Booking-System` GitHub repository.
4. In the project setup screen, configure:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click **Edit** and select `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

### Step 4.2: Configure Frontend Environment Variables
In the **Environment Variables** section on Vercel:

| Variable Name | Value | Notes |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://<your-render-service>.onrender.com/api/v1` | **No trailing slash** |

### Step 4.3: Deploy Frontend
1. Click **Deploy**.
2. Vercel will install dependencies, compile TypeScript, run `vite build`, and publish to its global Edge Network.
3. Note your generated Vercel production URL (e.g., `https://saas-booking-system.vercel.app`).

### Step 4.4: Synchronize CORS on Render
1. Return to the Render dashboard for `goom-booking-api`.
2. Update `CORS_ORIGIN` to match your Vercel URL (e.g., `https://saas-booking-system.vercel.app`).
3. Render will automatically redeploy with the updated CORS policy.

---

## 5. Platform Admin Initialization

To bootstrap the root platform administrator in production:
1. Open the **Shell** tab on Render (or run locally with production `DATABASE_URL`):
   ```bash
   ADMIN_NAME="Platform Administrator" \
   ADMIN_EMAIL="admin@yourdomain.com" \
   ADMIN_PASSWORD="YourSecureAdminPassword123!" \
   npm run seed:admin
   ```
2. The script checks for existing accounts, hashes the password via bcrypt (salt rounds = 10), and inserts the root user with `role = 'platform_admin'`.

---

## 6. Production Smoke Test Verification Checklist

| Step | Verification Check | Target URL | Expected Result |
| :---: | :--- | :--- | :--- |
| 1 | Health Check | `https://<backend>/health` | HTTP 200, DB connected |
| 2 | Public Directory | `https://<frontend>/businesses` | Real active businesses render |
| 3 | Customer Registration | `https://<frontend>/register` | Account created, redirected to portal |
| 4 | Customer Login | `https://<frontend>/login` | 1h JWT token issued, stored in localStorage |
| 5 | Slot Availability | `https://<frontend>/businesses/:id` | Real 30-min slots calculated from hours |
| 6 | Slot Booking | `https://<frontend>/businesses/:id` | Slot confirmed, duplicate slot blocked |
| 7 | Booking Cancellation | `https://<frontend>/my-bookings` | Cancellable when $\ge 2$h before start |
| 8 | Owner Portal | `https://<frontend>/owner` | Real KPI metrics (today, confirmed, revenue) |
| 9 | Admin Portal | `https://<frontend>/admin` | HTTP 403 for non-admins, accessible by admin |
| 10 | Security Isolation | DevTools Network & Console | No credentials or DB strings exposed |
