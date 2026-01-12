# Email Configuration Guide

## Setting Up Email for Invoice Sending

To enable automatic invoice email functionality, you need to configure SMTP settings in your `.env` file.

### Required Environment Variables

Add these to your `backend/.env` file:

```env
# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### Gmail Setup (Recommended)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Go to Google Account Settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Use this password (not your regular Gmail password) in `SMTP_PASSWORD`

### Other Email Providers

#### Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
```

#### Custom SMTP
```env
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@domain.com
SMTP_PASSWORD=your-password
```

#### AWS SES
```env
SMTP_HOST=email-smtp.region.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-aws-access-key
SMTP_PASSWORD=your-aws-secret-key
```

### How It Works

1. When creating an invoice, enter the **Client Email** (required field)
2. Click **"Generate Invoice"**
3. The system will:
   - Create the invoice
   - Generate the PDF automatically
   - Send the PDF via email to the client's email address
   - Show a success message confirming email delivery

### Troubleshooting

- **"Email configuration is missing"**: Check `.env` file has all SMTP variables
- **"Client email is missing"**: Make sure to enter email in the invoice form
- **"Authentication failed"**: Verify SMTP credentials are correct
- **Gmail issues**: Use App Password, not regular password
- **Email not sent but invoice created**: Check server logs for email errors. Invoice will still be created even if email fails.

### Notes

- Client Email is a **required field** when creating invoices
- Client Mobile is optional (stored for future use)
- If email sending fails, the invoice will still be created successfully
- Email status is tracked in the invoice record (`emailSent`, `emailSentAt`)

