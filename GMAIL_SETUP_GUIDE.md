# Gmail Setup Guide - Step by Step

## Fix "Username and Password not accepted" Error

This error occurs when Gmail rejects your login credentials. Follow these steps to fix it:

### Step 1: Enable 2-Factor Authentication

1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Click on **Security** (left sidebar)
3. Under "Signing in to Google", find **2-Step Verification**
4. Click **Get Started** and follow the prompts to enable 2FA
5. You'll need to verify your phone number

### Step 2: Generate App Password

1. Go back to [Google Account Settings](https://myaccount.google.com/)
2. Click on **Security** → **2-Step Verification**
3. Scroll down to find **App passwords** (at the bottom)
4. Click on **App passwords**
5. You may need to sign in again
6. Select **Mail** as the app type
7. Select **Other (Custom name)** as the device
8. Enter a name like "Invoice System" or "Finance Suite"
9. Click **Generate**
10. **Copy the 16-character password** (it will look like: `abcd efgh ijkl mnop`)
11. **Important**: This password is shown only once! Save it immediately.

### Step 3: Update .env File

Open `backend/.env` and update these lines:

```env
SMTP_USER=your-actual-email@gmail.com
SMTP_PASSWORD=abcdefghijklmnop
```

**Important Notes:**
- Use your **full Gmail address** (e.g., `john.doe@gmail.com`)
- Use the **16-character App Password** (remove spaces if any)
- **DO NOT** use your regular Gmail password
- **DO NOT** include quotes around the values

### Step 4: Restart Backend Server

1. Stop the backend server (press `Ctrl+C` in the terminal)
2. Start it again: `npm run dev` (in the backend directory)
3. The server will load the new environment variables

### Step 5: Test Email Sending

1. Create a new invoice
2. Enter a client email address
3. Click "Generate Invoice"
4. Check if the email is sent successfully

## Common Issues

### Issue: "App passwords" option not showing
**Solution**: Make sure 2-Step Verification is fully enabled and verified.

### Issue: Still getting authentication error
**Solutions**:
1. Double-check the App Password - copy it again from Google Account
2. Make sure there are no extra spaces in `.env` file
3. Restart the backend server after changing `.env`
4. Try generating a new App Password

### Issue: Email sent but not received
**Solutions**:
1. Check spam/junk folder
2. Verify the recipient email address is correct
3. Check server logs for any errors

## Alternative: Use Different Email Provider

If Gmail continues to cause issues, you can use:

### Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-outlook-password
```

### Custom SMTP Server
Contact your email provider for SMTP settings.

## Verification Checklist

- [ ] 2-Factor Authentication is enabled
- [ ] App Password is generated
- [ ] `.env` file has correct `SMTP_USER` (full email)
- [ ] `.env` file has correct `SMTP_PASSWORD` (16-char App Password)
- [ ] No extra spaces in `.env` values
- [ ] Backend server restarted after `.env` changes
- [ ] Tested with a new invoice

## Still Having Issues?

1. Check backend server logs for detailed error messages
2. Verify `.env` file is in the `backend/` directory
3. Make sure `.env` file doesn't have syntax errors
4. Try generating a fresh App Password

