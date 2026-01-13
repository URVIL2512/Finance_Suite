# Render Deployment Guide

## Backend Deployment on Render

### Quick Fix for "package.json not found" Error

The error occurs because Render is looking for `package.json` in the root directory, but your backend is in the `backend/` folder.

### Solution: Set Root Directory in Render Dashboard

1. **Go to your Render service settings:**
   - Open your web service in Render dashboard
   - Click on "Settings" tab

2. **Set Root Directory:**
   - Scroll down to "Build & Deploy" section
   - Find "Root Directory" field
   - Enter: `backend` ⚠️ **This is the fix!**
   - Click "Save Changes"

3. **Update Build & Start Commands:**
   - **Build Command:** `npm install` (or leave empty, it will auto-detect)
   - **Start Command:** `npm start` (or leave empty, it will auto-detect)

4. **Redeploy:**
   - Click "Manual Deploy" → "Deploy latest commit"
   - Or push a new commit to trigger auto-deploy

### Option 1: Using render.yaml (Recommended)

1. **Push render.yaml to your repository** (already created in root directory)

2. **In Render Dashboard:**
   - Go to Dashboard → New → Blueprint
   - Connect your GitHub repository
   - Render will automatically detect `render.yaml` and configure the service
   - **OR** if service already exists, the build commands in render.yaml will be used

### Option 2: Manual Configuration

If you prefer to configure manually:

1. **In Render Dashboard:**
   - Go to Dashboard → New → Web Service
   - Connect your GitHub repository: `https://github.com/URVIL2512/Finance_Suite`
   - Select branch: `main`

2. **Configure the service:**
   - **Name:** `finance-suite-backend` (or any name you prefer)
   - **Environment:** `Node`
   - **Region:** Choose closest to your users
   - **Branch:** `main`
   - **Root Directory:** `backend` ⚠️ **CRITICAL: Set this to `backend`**
   - **Build Command:** `npm install` (or leave empty)
   - **Start Command:** `npm start` (or leave empty)
   - **Plan:** Free (or upgrade as needed)

3. **Environment Variables:**
   Add these in the Render dashboard under "Environment Variables":
   
   ```
   NODE_ENV=production
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_email_password_or_app_password
   ```
   
   **Note:** `PORT` is automatically set by Render, no need to add it.

4. **Deploy:**
   - Click "Create Web Service"
   - Render will build and deploy your backend
   - Your backend will be available at: `https://your-service-name.onrender.com`

### Important Notes:

- **Root Directory:** Must be set to `backend` so Render knows where to find `package.json`
- **MongoDB:** Use MongoDB Atlas (free tier available) for cloud database
- **Email:** For Gmail, you'll need an App Password (see GMAIL_SETUP_GUIDE.md)
- **Auto-Deploy:** Render automatically deploys on every push to the main branch

### Troubleshooting:

**Error: "Could not read package.json"**
- ✅ Solution: Set Root Directory to `backend` in Render dashboard

**Error: "MongoDB connection failed"**
- ✅ Solution: Check MONGODB_URI is correct and MongoDB Atlas allows connections from anywhere (0.0.0.0/0)

**Error: "Port already in use"**
- ✅ Solution: Don't set PORT manually, Render sets it automatically

### After Deployment:

1. Your backend API will be at: `https://your-service-name.onrender.com`
2. Update your frontend `.env` to point to this URL
3. Test the API endpoints
