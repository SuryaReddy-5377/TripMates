# TripMates Production Deployment & Neon PostgreSQL Persistence Guide

This guide documents deploying and maintaining **TripMates** reliably in production with zero data loss using **100% Free Tier hosting**:
- **Backend API**: Hosted on [Render](https://render.com) (Node.js/Express Web Service on Render Free plan)
- **Database**: Hosted on [Neon Serverless PostgreSQL](https://neon.tech) (Free forever, persistent, automated backups, SSL enabled)
- **Frontend App**: Hosted on [Vercel](https://vercel.com) (React + Vite SPA)

---

## 1. Permanent PostgreSQL Data Persistence on Neon (100% Free)

### Why Neon PostgreSQL?
Render's Free Web Service runs in an ephemeral container. By connecting your backend to Neon's free managed PostgreSQL database via `DATABASE_URL`:
- Your user accounts, trips, expenses, settlements, and invitation codes are stored permanently in the cloud.
- Server redeploys, cold starts, and container spin-downs will **never delete or reset your data**.
- You do **not** need a paid Render Persistent Disk.

### One-Time Setup:
1. Create a project on [neon.tech](https://neon.tech).
2. Copy your connection string from the Neon Console:
   `postgresql://[user]:[password]@[endpoint].neon.tech/[dbname]?sslmode=require`
3. Go to your **Render Dashboard** $\rightarrow$ Click `tripmates-backend` $\rightarrow$ **Environment** tab.
4. Add the environment variable:
   - **Key**: `DATABASE_URL`
   - **Value**: `postgresql://[user]:[password]@[endpoint].neon.tech/[dbname]?sslmode=require`
5. Save changes. When Render redeploys, the backend automatically detects `DATABASE_URL`, connects with SSL pooling, runs pending PostgreSQL migrations from `database/postgres/`, and starts cleanly.

---

## 2. Transferring Existing SQLite Records to Neon PostgreSQL

If you have existing accounts, trips, or expenses in your local or server SQLite database (`data/tripmates.db`), TripMates includes an automated, zero-downtime migration utility:

```bash
# 1. Provide your Neon DATABASE_URL and run the migration script
DATABASE_URL="postgresql://user:password@ep-xyz.neon.tech/tripmates?sslmode=require" npm run db:migrate:pg
```

*(On Windows PowerShell, run:)*
```powershell
$env:DATABASE_URL="postgresql://user:password@ep-xyz.neon.tech/tripmates?sslmode=require"; npm run db:migrate:pg
```

### What this script does:
1. **Safety Backup**: Creates an atomic snapshot of your SQLite database in `data/backups/`.
2. **PostgreSQL Migrations**: Executes all 6 migration files in `database/postgres/` to ensure schema tables, indexes, constraints, and `citext` extensions exist.
3. **Data Transfer**: Transcribes records in dependency order (`users` $\rightarrow$ `families` $\rightarrow$ `persons` $\rightarrow$ `family_memberships` $\rightarrow$ `trips` $\rightarrow$ `expenses` $\rightarrow$ etc.) with `ON CONFLICT DO NOTHING`.
4. **Sequence Alignment**: Resets PostgreSQL serial sequences (`setval`) so that future inserts don't collide with existing primary key IDs.
5. **Verification**: Compares and prints a side-by-side count table for every table.

---

## 3. Environment Variables Summary for Render

In your Render service **Environment** tab, configure:

| Variable | Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Enables production security, secure cookies, and optimized logging |
| `PORT` | `10000` | Port assigned by Render |
| `DATABASE_URL` | `postgresql://...` | Connection string to your free Neon PostgreSQL database |
| `SESSION_SECRET` | *(Random 32+ character string)* | Secret for cryptographic session handling |

*(Note: When `DATABASE_URL` is set, `DATABASE_PATH` is ignored and the backend operates in PostgreSQL mode).*

---

## 4. Deploying Frontend to Vercel

1. **Import Project to Vercel**:
   - Log in to [vercel.com](https://vercel.com).
   - Import your GitHub repository `TripMates`.

2. **Project Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./` (root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `frontend/dist`

3. **Required Environment Variable**:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://<your-render-backend-name>.onrender.com/api`

---

## 5. Verification Checklist After Deployment

- [ ] **Database Connection**: Check Render logs for:
  `[Database] Connected to PostgreSQL managed database (Pool size: 10, SSL: enabled)`
- [ ] **Health Check**: Open `https://<backend>.onrender.com/api/health` in browser; returns HTTP 200 `{"status":"ok", ...}`.
- [ ] **Super Admin & Member Login**: Log in with your email and password.
- [ ] **Persistence Verification**:
  1. Create a trip or record an expense.
  2. In Render dashboard, trigger a **Manual Deploy** $\rightarrow$ **Deploy latest commit** (or restart the web service).
  3. Refresh the website on your browser after redeploy completes.
  4. Verify that all trips, balances, and accounts are still there.
