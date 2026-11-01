# TripMates Production Deployment & Persistence Guide (Render + Vercel)

This guide documents deploying and maintaining **TripMates** reliably in production with zero data loss:
- **Backend API & Database**: Hosted on [Render](https://render.com) (Node.js/Express + SQLite on a Persistent Disk)
- **Frontend App**: Hosted on [Vercel](https://vercel.com) (React + Vite SPA)

---

## 1. Permanent Data Persistence on Render (Crucial)

### The Ephemeral Storage Problem
By default, Render web services run in stateless/ephemeral Docker containers. Whenever:
- A new commit is deployed
- The server restarts or spins down due to inactivity (Free Tier cold-starts)
- The service crashes or recovers

Any SQLite database stored in the default repository folder (`data/tripmates.db`) is reset to its initial state. This causes newly created family invitation codes, expenses, and accounts to disappear.

### The Solution: Render Persistent Disk
TripMates auto-detects persistent mount points (`/var/data`, `/data`, `/mnt/data`) or uses `DATABASE_PATH`.

1. Go to your **Render Dashboard** $\rightarrow$ Click your `tripmates-backend` Web Service.
2. In the left navigation menu, click **Disks** $\rightarrow$ **Add Disk**.
3. Configure the disk settings:
   - **Name**: `tripmates-data`
   - **Mount Path**: `/var/data`
   - **Size**: `1 GB` (sufficient for millions of records, WAL logs, and backups)
4. Click **Create Disk**.
5. Go to **Environment** tab:
   - Add/update `DATABASE_PATH` = `/var/data/tripmates.db`
6. Click **Save Changes**. Render will automatically redeploy with the persistent disk mounted.

Once configured, your SQLite database and WAL journals will survive all restarts, deploys, and cold starts permanently.

---

## 2. Deploying Backend to Render

1. **Repository**:
   Ensure all changes are committed and pushed to GitHub:
   ```bash
   git status
   git add .
   git commit -m "Enhance auth navigation, invitation validation, performance, and database persistence"
   git push origin main
   ```

2. **Web Service Configuration**:
   - **Name**: `tripmates-backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`

3. **Required Environment Variables**:
   | Variable | Value | Notes |
   |---|---|---|
   | `NODE_ENV` | `production` | Enables production security, secure cookies, and optimized logging |
   | `PORT` | `10000` | Render default port |
   | `DATABASE_PATH` | `/var/data/tripmates.db` | Point to Render persistent disk mount |
   | `SESSION_SECRET` | *(Random 32+ character string)* | Used for cryptographic session security |

4. **Health Check Verification**:
   - Visit `https://<your-backend-name>.onrender.com/`
     Should return:
     ```json
     {
       "status": "ok",
       "service": "TripMates API Backend",
       "message": "Backend server is running smoothly on Render.",
       "healthCheck": "/api/health"
     }
     ```
   - Visit `https://<your-backend-name>.onrender.com/api/health`
     Should return: `{"status":"ok","service":"tripmates-api",...}`

---

## 3. Deploying Frontend to Vercel

1. **Import Project to Vercel**:
   - Log in to [vercel.com](https://vercel.com).
   - Click **Add New...** $\rightarrow$ **Project**.
   - Import your GitHub repository `TripMates`.

2. **Configure Project Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./` (root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `frontend/dist`

3. **Required Environment Variable**:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://<your-render-backend-name>.onrender.com/api`
   *(Example: `https://tripmates-backend.onrender.com/api`)*

4. **Client-Side Routing**:
   `vercel.json` in the root directory ensures all SPA sub-paths (`/admin/login`, `/admin/dashboard`, `/setup`, etc.) rewrite to `frontend/dist/index.html`.

---

## 4. Understanding & Mitigating Render Free-Tier Cold Starts

On the Render Free tier, instances spin down after 15 minutes of inactivity:
- When a user visits after inactivity, the first backend request wakes the server up, which takes 30-50 seconds.
- **TripMates Improvements**:
  1. The landing page renders **instantly (0ms)** without blocking on the backend.
  2. The API client includes a 15-second timeout with friendly cold-start detection: *"Waking up Render backend instance... This takes ~30s on free hosting."*
  3. All large administration views (`AdminDashboard`, `AdminLogin`, `AuditView`) are code-split via dynamic `React.lazy()` imports to keep bundle sizes under 130 kB gzip.
- **Tip (Keep Backend Awake 24/7 for Free)**:
  Use a free uptime monitor (such as [cron-job.org](https://cron-job.org) or [uptimerobot.com](https://uptimerobot.com)) to ping `https://<your-backend-name>.onrender.com/api/health` every 10 minutes. This prevents the server from spinning down.

---

## 5. Database Maintenance, Verification & Backups

TripMates includes automated CLI scripts for database health and snapshots:

### 1. Verify Database Integrity & Record Counts
Run this command to check SQLite integrity, foreign keys, and statistics:
```bash
npm run db:verify
```
*Output checks:*
- `PRAGMA integrity_check` (returns `ok`)
- `PRAGMA foreign_key_check` (returns zero violations)
- Prints total counts for Users, Persons, Families, Trips, Expenses, Repayments, Invite Codes, and Audit Logs.

### 2. Create an Atomic SQLite Snapshot Backup
To take a point-in-time snapshot safely while the database is running:
```bash
npm run db:backup
```
- Performs a WAL checkpoint (`PRAGMA wal_checkpoint(TRUNCATE)`) to sync all active write logs into the database file.
- Copies the database into `data/backups/tripmates-backup-<timestamp>.db` (or `/var/data/backups/...` on persistent disk).
- Verifies record integrity on the snapshot before completing.
- Automatically retains the 10 most recent backups.

---

## 6. Authentication & Roles Summary

1. **Family Members**:
   - Click **Sign in** $\rightarrow$ Log in with email & password.
   - Click **I have an invite code** $\rightarrow$ Register with invitation code (family invite code or trip invite code), full name, email, and password.
   - Direct registration without invite code creates an individual account with their personal family automatically.

2. **Super Administrator**:
   - Access via dedicated portal at `/admin/login` or standard login.
   - Initial setup (`/setup`) is **permanently disabled** once the first Super Admin exists (`HTTP 403 SETUP_DISABLED`).
   - Super Admin can generate family invite codes, view cross-family audit logs, manage users, and inspect all system activity.
