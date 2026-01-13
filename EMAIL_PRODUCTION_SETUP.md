# Email Setup for Production (Render/Vercel)

## Problem: Email Works in Localhost but Not in Production

If emails work locally but not in production, the issue is almost always **missing or incorrect environment variables** in Render.

---

## Step 1: Set Correct Environment Variables in Render

The code uses these variable names (NOT `EMAIL_USER`/`EMAIL_PASS`):

### Required Variables:

Go to Render Dashboard → Your Backend Service → **Environment** tab

Add these variables:

```env
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password-16-characters
SMTP_HOST=smtp.gmail.com (optional - defaults to this)
SMTP_PORT=587 (optional - defaults to this)
SMTP_SECURE=false (optional - defaults to this)
```

**Important:**
- Variable names are `SMTP_USER` and `SMTP_PASSWORD` (NOT `EMAIL_USER`/`EMAIL_PASS`)
- For Gmail, you MUST use an App Password (not your regular password)
- See GMAIL_SETUP_GUIDE.md for how to generate App Password

---

## Step 2: Generate Gmail App Password (If Using Gmail)

1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Click **Security** → **2-Step Verification** (enable if not enabled)
3. Scroll down to **App passwords**
4. Select **Mail** and **Other (Custom name)**
5. Enter name: "Finance Suite Production"
6. Click **Generate**
7. Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)
8. Remove spaces: `abcdefghijklmnop`

---

## Step 3: Add Variables to Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Select your backend service: `finance-suite-1`
3. Go to **Environment** tab
4. Click **"Add Environment Variable"**
5. Add each variable:

   **Variable 1:**
   - Key: `SMTP_USER`
   - Value: `your-email@gmail.com` (your full Gmail address)
   
   **Variable 2:**
   - Key: `SMTP_PASSWORD`
   - Value: `abcdefghijklmnop` (your 16-character App Password, no spaces)
   
   **Variable 3 (Optional - Gmail defaults):**
   - Key: `SMTP_HOST`
   - Value: `smtp.gmail.com`
   
   **Variable 4 (Optional - Gmail defaults):**
   - Key: `SMTP_PORT`
   - Value: `587`
   
   **Variable 5 (Optional - Gmail defaults):**
   - Key: `SMTP_SECURE`
   - Value: `false`

6. Click **"Save Changes"** after each variable
7. Go to **Manual Deploy** tab
8. Click **"Deploy latest commit"**
9. Wait for deployment (2-3 minutes)

---

## Step 4: Verify Email Configuration

### Check Render Logs

1. Go to Render Dashboard → Your Service → **Logs** tab
2. Look for email-related errors
3. Common errors:
   - `"Email configuration is missing"` → `SMTP_USER` or `SMTP_PASSWORD` not set
   - `"Invalid login"` → Wrong App Password
   - `"Authentication failed"` → App Password issue

### Test Email Sending

1. Create an invoice with a client email
2. Check Render logs for email sending attempts
3. Check for error messages

---

## Common Issues

### Issue 1: Wrong Variable Names

**Error:** `"Email configuration is missing. Please set SMTP_USER and SMTP_PASSWORD"`

**Problem:** Using `EMAIL_USER`/`EMAIL_PASS` instead of `SMTP_USER`/`SMTP_PASSWORD`

**Fix:** 
- Delete `EMAIL_USER` and `EMAIL_PASS` (if you have them)
- Add `SMTP_USER` and `SMTP_PASSWORD` instead

### Issue 2: Using Regular Gmail Password

**Error:** `"Invalid login"` or `"Authentication failed"`

**Problem:** Using your regular Gmail password instead of App Password

**Fix:**
- Generate App Password from Google Account
- Use the 16-character App Password (not your regular password)

### Issue 3: App Password Has Spaces

**Problem:** App Password copied with spaces: `abcd efgh ijkl mnop`

**Fix:**
- Remove all spaces: `abcdefghijklmnop`
- Use the password without spaces in Render

### Issue 4: 2FA Not Enabled

**Problem:** Can't generate App Password

**Fix:**
- Enable 2-Step Verification in Google Account
- Then generate App Password

---

## Environment Variables Summary

### Required for Email:

```env
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
```

### Optional (Gmail defaults):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
```

---

## Quick Checklist

- [ ] 2-Step Verification enabled in Google Account
- [ ] App Password generated (16 characters)
- [ ] `SMTP_USER` set in Render (full email address)
- [ ] `SMTP_PASSWORD` set in Render (App Password, no spaces)
- [ ] Variables saved in Render
- [ ] Backend redeployed after adding variables
- [ ] Checked Render logs for errors
- [ ] Tested email sending

---

## After Setup

1. Variables are set correctly
2. Backend is redeployed
3. Try sending an invoice email
4. Check Render logs for success/error messages
5. Email should work! ✅

---

## Troubleshooting

### Connection Timeout Error (`ETIMEDOUT`)

**If you see:** `Error: Connection timeout` or `code: 'ETIMEDOUT'`

**Cause:** Render's free tier blocks outbound SMTP connections on ports 465 and 587.

**Solution:** 
- **Recommended:** Upgrade to Render's paid plan (Starter: $7/month) - See `RENDER_SMTP_TIMEOUT_FIX.md` for details
- **Alternative:** Use an email API service (SendGrid, Mailgun) instead of SMTP

### Email Still Not Working?

1. **Check Render Logs:**
   - Look for specific error messages
   - Errors will tell you exactly what's wrong
   - `ETIMEDOUT` = Render free tier blocking SMTP (see above)
   - `EAUTH` = Authentication error (check App Password)

2. **Verify Variables:**
   - Go to Environment tab
   - Make sure `SMTP_USER` and `SMTP_PASSWORD` exist
   - Check for typos in variable names

3. **Test App Password:**
   - Try generating a new App Password
   - Make sure you're using the App Password, not regular password

4. **Check Gmail Settings:**
   - Make sure "Less secure app access" is not the issue (should use App Password instead)
   - Verify 2FA is enabled

---

## Notes

- Email errors are logged but don't break the application
- Invoices are created even if email fails
- Check Render logs to see email errors
- Email sending happens in background (async), so check logs for errors
