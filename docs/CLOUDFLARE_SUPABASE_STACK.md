# Cloudflare + Supabase Stack Guide — ZEBL_AMS

This guide explains how to run **Zebl AMS** on **Cloudflare** (Frontend / Next.js hosting) and **Supabase** (PostgreSQL database, Auth, and Object Storage).

---

## 1. Architecture Overview

```
┌────────────────────────────────┐         ┌────────────────────────────────┐
│      CLOUDFLARE (Frontend)     │         │       SUPABASE (Backend)       │
│                                │         │                                │
│  • Next.js App Router (Worker) │  HTTPS  │  • PostgreSQL Database         │
│  • Edge CDN & Global Caching   ├────────►│  • Transaction Pooler (p 6543) │
│  • UNLIMITED Bandwidth         │  REST / │  • Built-In Auth & Row-Level   │
│  • Free Web App Firewall (WAF) │  Direct │  • Document Storage (Resumes)  │
└────────────────────────────────┘         └────────────────────────────────┘
```

---

## 2. Free Tier Comparison Matrix

| Resource / Feature | Vercel + Neon | Cloudflare + Supabase | Advantage |
| :--- | :--- | :--- | :--- |
| **Bandwidth (Egress)** | Vercel: 100 GB / mo | **Cloudflare: UNLIMITED** | Cloudflare absorbs static asset bandwidth for $0. |
| **Database Compute** | Neon: 100 CU-hrs free | **Supabase: Shared CPU / 500 MB RAM** | Supabase database stays available without computing CU-hours. |
| **Database Storage** | Neon: 0.5 GB | **Supabase: 500 MB** | Equal capacity for core HR tables. |
| **File / Object Storage** | Needs Vercel Blob / S3 | **Supabase Storage: 1 GB free** | Built-in storage for employee avatars & resume PDFs. |
| **Commercial Usage** | Vercel Hobby restricts commercial | **Cloudflare & Supabase allow commercial** | Legal to host commercial or business HR workloads for free. |

---

## 3. Step-by-Step Configuration

### Step 1: Set Up Supabase Database

1. Open your Supabase project dashboard at `https://supabase.com/dashboard/project/ltkjnppndnkweatdzntz`.
2. Go to **Project Settings -> Database**.
3. Direct Connection String (Port `5432` for `npx prisma migrate`):
   ```env
   DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.ltkjnppndnkweatdzntz.supabase.co:5432/postgres"
   ```
4. Transaction Pooled Connection String (Port `6543` for Serverless App Runtime):
   ```env
   DATABASE_URL="postgresql://postgres.ltkjnppndnkweatdzntz:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
   ```

### Step 2: Apply Prisma Schema to Supabase

Run database migrations locally against your Supabase instance:

```bash
npx prisma generate
npx prisma migrate deploy
npm run db:seed
```

### Step 3: Cloudflare OpenNext Adapter Setup

1. Install the OpenNext Cloudflare adapter and Wrangler CLI:
   ```bash
   npm install --save-dev @opennextjs/cloudflare wrangler@latest
   ```

2. Create `wrangler.toml` in your workspace root:
   ```toml
   name = "zebl-ams"
   main = ".open-next/worker.js"
   compatibility_date = "2026-05-01"
   compatibility_flags = ["nodejs_compat"]

   [assets]
   directory = ".open-next/assets"
   binding = "ASSETS"
   ```

3. Add build script in `package.json`:
   ```json
   "scripts": {
     "build:cf": "opennextjs-cloudflare"
   }
   ```

4. Deploy to Cloudflare Workers:
   ```bash
   npx @opennextjs/cloudflare && npx wrangler deploy
   ```

---

## 4. Auto-Pause Mitigation (Supabase Free Tier)

Supabase free databases auto-pause after **1 week of inactivity**. To prevent initial cold-start delays:
- Set up a free 3-day health ping using UptimeRobot or GitHub Actions targeting `https://<your-cf-app>.workers.dev/api/health`.

---

## Summary Recommendation

- Use **Cloudflare** for Next.js hosting — zero bandwidth limits, edge caching, and built-in WAF.
- Use **Supabase** for PostgreSQL database, Transaction Pooling (port 6543), and document attachment storage.
