# Connecting Frontend to Backend

## Quick Setup Guide

**Backend URL:** `https://finance-suite-1.onrender.com/`  
**Frontend URL:** `https://finance-suite-livid.vercel.app/`

---

## Step 1: Configure Frontend (Vercel)

### Set Environment Variable in Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: `finance-suite-livid` (or your project name)
3. Go to **Settings** → **Environment Variables**
4. Click **"Add New"**
5. Add:
   - **Key:** `VITE_API_URL`
   - **Value:** `https://finance-suite-1.onrender.com/api`
   - **Environment:** Production, Preview, Development (select all)
6. Click **"Save"**
7. Go to **Deployments** tab
8. Click the **"..."** menu on the latest deployment
9. Click **"Redeploy"** → **"Redeploy"**

**Important:** The value must include `/api` at the end!

---

## Step 2: Configure Backend (Render) - CORS

### Set Environment Variable in Render Dashboard

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Select your service: `finance-suite-1` (or `finance-suite-backend`)
3. Go to **Environment** tab
4. Click **"Add Environment Variable"**
5. Add:
   - **Key:** `FRONTEND_URL`
   - **Value:** `https://finance-suite-livid.vercel.app`
6. Click **"Save Changes"**
7. Go to **Manual Deploy** tab
8. Click **"Deploy latest commit"**

**Important:** Do NOT include trailing slash or `/login` - just the base URL!

---

## Step 3: Verify Connection

### Test Backend
Visit: `https://finance-suite-1.onrender.com/api/health`
Should see: `{"status":"OK","message":"Finance Suite API is running"}`

### Test Frontend
1. Visit: `https://finance-suite-livid.vercel.app/login`
2. Open browser DevTools (F12) → Console tab
3. Try to register/login
4. Check for any CORS errors
5. If you see network requests to `finance-suite-1.onrender.com`, it's working!

---

## Troubleshooting

### CORS Errors
- ✅ Check `FRONTEND_URL` in Render matches your Vercel URL exactly
- ✅ No trailing slash in `FRONTEND_URL`
- ✅ Redeploy backend after changing `FRONTEND_URL`

### Network Errors
- ✅ Check `VITE_API_URL` includes `/api` at the end
- ✅ Check backend is running (visit health endpoint)
- ✅ Redeploy frontend after changing `VITE_API_URL`

### 401 Unauthorized Errors
- ✅ This is normal - you need to register/login first
- ✅ Check browser console for specific error messages

---

## Environment Variables Summary

### Frontend (Vercel)
```
VITE_API_URL=https://finance-suite-1.onrender.com/api
```

### Backend (Render)
```
FRONTEND_URL=https://finance-suite-livid.vercel.app
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
NODE_ENV=production
SMTP_USER=your-email@gmail.com (for email functionality)
SMTP_PASSWORD=your-gmail-app-password (for email functionality)
```

---

## After Configuration

Once both are configured and redeployed:
1. Frontend will make API calls to: `https://finance-suite-1.onrender.com/api`
2. Backend will accept requests from: `https://finance-suite-livid.vercel.app`
3. Your app should work end-to-end! 🎉
