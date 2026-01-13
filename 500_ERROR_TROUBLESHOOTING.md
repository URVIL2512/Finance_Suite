# 500 Internal Server Error - Troubleshooting Guide

## Common Causes

A 500 error means the backend received your request but something went wrong server-side.

### Most Common Issues:

1. **Missing JWT_SECRET** (Most Likely)
2. **MongoDB Connection Failed**
3. **Missing Environment Variables**

---

## Step 1: Check Render Logs

**The easiest way to see the actual error:**

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Select your backend service: `finance-suite-1`
3. Click on **"Logs"** tab
4. Look for recent errors (red text)
5. The error message will tell you exactly what's wrong

**Common error messages you might see:**
- `JWT_SECRET is not defined` → Missing JWT_SECRET
- `MongoDB Connection Error` → Database connection issue
- `Cannot read property 'sign' of undefined` → Missing JWT_SECRET

---

## Step 2: Verify Environment Variables in Render

Go to Render Dashboard → Your Service → **Environment** tab

### Required Variables (Check all are set):

```env
NODE_ENV=production
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key_min_32_characters
FRONTEND_URL=https://finance-suite-livid.vercel.app
```

### How to Check:

1. Go to **Environment** tab
2. Scroll through all variables
3. Make sure these are ALL present:
   - ✅ `NODE_ENV`
   - ✅ `MONGODB_URI`
   - ✅ `JWT_SECRET`
   - ✅ `FRONTEND_URL`

### If JWT_SECRET is Missing:

1. Click **"Add Environment Variable"**
2. Key: `JWT_SECRET`
3. Value: Generate a random secret (minimum 32 characters)
   - You can use: `openssl rand -base64 32` (in terminal)
   - Or use any long random string
4. Click **"Save Changes"**
5. Go to **Manual Deploy** → **Deploy latest commit**

### If MONGODB_URI is Missing or Wrong:

1. Check your MongoDB Atlas connection string
2. Make sure it includes:
   - Your username
   - Your password (replaced `<password>`)
   - Database name: `finance_suite`
3. Format: `mongodb+srv://username:password@cluster.mongodb.net/finance_suite?retryWrites=true&w=majority`
4. Save and redeploy

---

## Step 3: Test Backend Health

Visit: `https://finance-suite-1.onrender.com/api/health`

**Expected Response:**
```json
{"status":"OK","message":"Finance Suite API is running"}
```

**If you get an error:**
- Backend might not be running
- Check Render dashboard for deployment status

---

## Step 4: Test MongoDB Connection

The health endpoint doesn't test DB. If login fails, it's likely a DB issue.

**To verify MongoDB:**
1. Check MongoDB Atlas dashboard
2. Verify your cluster is running
3. Check Network Access allows `0.0.0.0/0`
4. Verify your connection string is correct

---

## Step 5: Common Fixes

### Fix 1: Missing JWT_SECRET

**Error in logs:** `JWT_SECRET is not defined` or `Cannot read property 'sign'`

**Solution:**
1. Render Dashboard → Environment
2. Add: `JWT_SECRET` = (any long random string, min 32 chars)
3. Save and redeploy

### Fix 2: MongoDB Connection Failed

**Error in logs:** `MongoDB Connection Error` or `MongooseServerSelectionError`

**Solution:**
1. Check `MONGODB_URI` is correct
2. Verify MongoDB Atlas cluster is running
3. Check Network Access allows all IPs (`0.0.0.0/0`)
4. Verify password in connection string is correct

### Fix 3: Database Not Found

**Error:** Database doesn't exist

**Solution:**
- MongoDB Atlas creates databases automatically
- Just make sure the connection string includes the database name
- Example: `...mongodb.net/finance_suite?retryWrites...`

---

## Quick Checklist

Before contacting support, verify:

- [ ] Render service is "Live" (not "Build Failed")
- [ ] All environment variables are set in Render
- [ ] `JWT_SECRET` is set and is at least 32 characters
- [ ] `MONGODB_URI` is correct and includes database name
- [ ] MongoDB Atlas cluster is running
- [ ] Network Access allows `0.0.0.0/0`
- [ ] Backend health endpoint works: `/api/health`
- [ ] Checked Render logs for specific error message

---

## Still Not Working?

1. **Check Render Logs** (most important!)
   - The error message will tell you exactly what's wrong
   - Look for red error text in the logs

2. **Try Register First**
   - If login fails, try registering a new user
   - If register also fails with 500, it's likely JWT_SECRET or MongoDB

3. **Verify Environment Variables**
   - Double-check all variables are set
   - Make sure no typos in variable names
   - Ensure values don't have extra spaces

4. **Redeploy**
   - After changing environment variables, always redeploy
   - Go to Manual Deploy → Deploy latest commit

---

## Next Steps

Once you identify the issue from Render logs, apply the appropriate fix above. The logs will show the exact error message, which makes it much easier to diagnose!
