# TripMates Deployment Guide (Render + Vercel)

This guide walks you through deploying **TripMates** with:
- **Backend API**: Hosted on [Render](https://render.com) (Node.js/Express + SQLite)
- **Frontend App**: Hosted on [Vercel](https://vercel.com) (React + Vite SPA)

---

## Part 1: Deploying Backend to Render

1. **Push your code to GitHub**:
   Ensure all changes are pushed to your repository (`https://github.com/SuryaReddy-5377/TripMates.git`).

2. **Create a Web Service on Render**:
   - Log in to your Render Dashboard at [dashboard.render.com](https://dashboard.render.com).
   - Click **New +** $\rightarrow$ **Web Service**.
   - Connect your GitHub repository `TripMates`.

3. **Configure the Web Service**:
   - **Name**: `tripmates-backend` (or your chosen name)
   - **Region**: Choose the closest region (e.g., Singapore / Frankfurt / Oregon)
   - **Branch**: `main`
   - **Root Directory**: Leave blank (root of repository)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

4. **Environment Variables on Render**:
   Add the following environment variables under **Environment**:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `DATABASE_PATH`: `data/tripmates.db`
   - `SESSION_SECRET`: Click **Generate** or enter a strong 32-character random string.

5. **Deploy & Note Backend URL**:
   - Click **Deploy Web Service**.
   - Once deployed, copy your Render URL (for example: `https://tripmates-backend.onrender.com`).
   - Test it by opening `https://tripmates-backend.onrender.com/api/health` in your browser. It should respond with `{"status":"ok","service":"tripmates-api",...}`.

---

## Part 2: Deploying Frontend to Vercel

1. **Import Project to Vercel**:
   - Log in to [vercel.com](https://vercel.com).
   - Click **Add New...** $\rightarrow$ **Project**.
   - Import your GitHub repository `SuryaReddy-5377/TripMates`.

2. **Configure Project Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./` (root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `frontend/dist`

3. **Environment Variables on Vercel**:
   Under **Environment Variables**, add:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://<your-render-backend-name>.onrender.com/api` (e.g. `https://tripmates-backend.onrender.com/api`)

4. **Deploy**:
   - Click **Deploy**.
   - Vercel will build the frontend and provide your live production URL (e.g., `https://tripmates.vercel.app`).
   - The included `vercel.json` ensures client-side routing works cleanly on all paths (`/`, `/admin/login`, `/admin/dashboard`, etc.).

---

## Part 3: Initial Setup & First Super Admin on Production

Once deployed:
1. Open your live Vercel URL.
2. The initial bootstrap screen will prompt you to configure the first Super Admin account (or use the one already set).
3. Log in with your email and password (`suryareddy1596@gmail.com`).
4. You have full access to:
   - Trip creation with family invitations
   - Trip detail editing and inviting missed members
   - Profile & family management (Family of 2, 3, etc.)
   - Balances, expenses, settlement transfers, and maps!

