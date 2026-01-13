# Complete Deployment Guide - Finance Suite

This guide provides step-by-step instructions for deploying the Finance Suite application.

---

## 📋 Prerequisites

1. ✅ GitHub account and repository: `https://github.com/URVIL2512/Finance_Suite`
2. ✅ MongoDB Atlas account (free tier available)
3. ✅ Render account (for backend - free tier available)
4. ✅ Vercel account (for frontend - free tier available)

---

## 🚀 Part 1: Backend Deployment on Render

### Step 1: Set Up MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster (FREE tier available)
3. Click **"Connect"** → **"Connect your application"**
4. Copy connection string and replace `<password>` with your database password
5. Add database name: `finance_suite?retryWrites=true&w=majority`
6. **Network Access:** Add IP `0.0.0.0/0` (Allow from anywhere)

### Step 2: Deploy Backend on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect GitHub repository: `URVIL2512/Finance_Suite`
4. Configure:
   - **Name:** `finance-suite-backend`
   - **Root Directory:** `backend` ⚠️ **CRITICAL**
   - **Environment:** `Node`
   - **Build Command:** `npm install` (or leave empty)
   - **Start Command:** `npm start`
   - **Plan:** Free

5. **Environment Variables:**
   ```
   NODE_ENV=production
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key_min_32_characters
   EMAIL_USER=your_email@gmail.com (optional)
   EMAIL_PASS=your_gmail_app_password (optional)
   FRONTEND_URL=https://your-frontend-url.vercel.app (add after frontend deploy)
   ```

6. Click **"Create Web Service"**
7. Wait for deployment (3-5 minutes)
8. Test: `https://finance-suite-backend.onrender.com/api/health`

---

## 🎨 Part 2: Frontend Deployment on Vercel

### Step 1: Deploy Frontend

1. Go to [Vercel Dashboard](https://vercel.com/)
2. Click **"Add New..."** → **"Project"**
3. Import repository: `URVIL2512/Finance_Suite`
4. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend` ⚠️ **IMPORTANT**
   - **Build Command:** `npm run build` (auto-detected)
   - **Output Directory:** `dist` (auto-detected)

5. **Environment Variables:**
   - Key: `VITE_API_URL`
   - Value: `https://finance-suite-backend.onrender.com/api`

6. Click **"Deploy"**
7. Wait for deployment (2-3 minutes)

### Step 2: Update Backend CORS

1. Go to Render dashboard → Backend service → Environment
2. Update `FRONTEND_URL` to your Vercel URL
3. Save and redeploy backend

---

## ✅ Post-Deployment

- Backend: `https://finance-suite-backend.onrender.com/api/health`
- Frontend: `https://your-project.vercel.app`
- Test all functionality and check for errors

---

## 🔧 Troubleshooting

See `RENDER_DEPLOYMENT.md` for detailed troubleshooting.
