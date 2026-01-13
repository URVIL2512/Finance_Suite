# Render SMTP Connection Timeout Fix

## Problem: `ETIMEDOUT` Error on Render

You're getting this error:
```
Error: Connection timeout
code: 'ETIMEDOUT'
command: 'CONN'
```

## Root Cause

**Render's Free Tier blocks outbound SMTP connections** on ports 465 and 587. This is a known limitation of the free tier to prevent spam.

Your email sending code is trying to connect to Gmail's SMTP server (`smtp.gmail.com:587`), but Render is blocking this connection, causing the timeout.

---

## Solutions

### Solution 1: Upgrade to Render Paid Plan (Recommended) ⭐

**Easiest and Most Reliable Solution**

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Select your backend service
3. Go to **Settings** → **Plan**
4. Upgrade to **Starter Plan** ($7/month) or higher
5. Paid plans allow outbound SMTP connections
6. Redeploy your service
7. Emails will work! ✅

**Why this is recommended:**
- ✅ No code changes needed
- ✅ Works immediately after upgrade
- ✅ Supports all SMTP providers (Gmail, Outlook, etc.)
- ✅ Most reliable solution

---

### Solution 2: Use Email Service API (SendGrid, Mailgun, AWS SES)

Instead of SMTP, use an email service API that works over HTTP/HTTPS (which Render allows).

#### Option A: SendGrid (Free Tier Available)

1. Sign up at [SendGrid](https://sendgrid.com/) (free tier: 100 emails/day)
2. Create an API Key
3. Install SendGrid package:
   ```bash
   npm install @sendgrid/mail
   ```
4. Update email service to use SendGrid API instead of SMTP
5. Add `SENDGRID_API_KEY` to Render environment variables

#### Option B: Mailgun (Free Tier Available)

1. Sign up at [Mailgun](https://www.mailgun.com/) (free tier: 5,000 emails/month)
2. Get API key and domain
3. Install Mailgun package:
   ```bash
   npm install mailgun.js
   ```
4. Update email service to use Mailgun API
5. Add Mailgun credentials to Render environment variables

#### Option C: AWS SES (Very Affordable)

1. Set up AWS SES (pay per email, very cheap)
2. Get SMTP credentials or use AWS SDK
3. Update email service
4. Add AWS credentials to Render environment variables

**Note:** This requires code changes to replace SMTP with API-based email sending.

---

### Solution 3: Contact Render Support

You can contact Render support to request an exception, but they typically don't make exceptions for free tier accounts.

---

## Why This Happens

Render's free tier has restrictions to:
- Prevent spam/abuse
- Reduce infrastructure costs
- Encourage upgrades for production use

SMTP ports (465, 587) are commonly used for sending emails, so they're blocked on free tier.

---

## Quick Decision Guide

**Choose Solution 1 (Upgrade) if:**
- ✅ You want the easiest fix
- ✅ You don't want to change code
- ✅ You're ready to pay for production hosting
- ✅ You want reliable email sending

**Choose Solution 2 (Email API) if:**
- ✅ You want to stay on free tier
- ✅ You're okay with code changes
- ✅ You want to use a dedicated email service
- ✅ You want better email deliverability

---

## Immediate Workaround

While you decide on a solution:

1. **Invoices/Payments are still created** - Email failures don't break the app
2. **Emails are logged as errors** - Check Render logs to see email attempts
3. **You can manually send emails** - Download PDFs and send manually if needed
4. **Upgrade when ready** - The app works fine, just emails won't send until you upgrade

---

## After Upgrading to Paid Plan

1. Upgrade to Starter Plan ($7/month) or higher
2. Go to **Manual Deploy** → **Deploy latest commit**
3. Wait for deployment
4. Try sending an email
5. Check logs - should see "Email sent successfully" ✅

No code changes needed! Just upgrade and redeploy.

---

## Cost Comparison

- **Render Starter Plan:** $7/month (includes SMTP support + better performance)
- **SendGrid Free Tier:** Free (100 emails/day)
- **Mailgun Free Tier:** Free (5,000 emails/month)
- **AWS SES:** ~$0.10 per 1,000 emails (very cheap for low volume)

---

## Recommendation

For a production application, **upgrading to Render's Starter Plan** is the best option because:
1. ✅ No code changes required
2. ✅ Works immediately
3. ✅ Better performance and reliability
4. ✅ Supports all SMTP providers
5. ✅ Reasonable cost ($7/month)

If you're in development/testing phase and want to stay free, consider using SendGrid or Mailgun free tiers with code changes.

---

## Need Help?

1. Check Render logs for specific error messages
2. Verify SMTP credentials are correct in Render environment variables
3. Test with a simple email first after upgrading
4. Contact support if issues persist after upgrade

---

## Summary

**The Issue:** Render free tier blocks SMTP ports 465 and 587
**The Fix:** Upgrade to Render paid plan OR use email API service
**Recommended:** Upgrade to Starter Plan ($7/month) - easiest solution
