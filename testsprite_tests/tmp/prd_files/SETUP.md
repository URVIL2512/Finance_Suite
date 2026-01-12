# Finance Suite - Setup Guide

## Quick Start

### 1. Backend Setup

```bash
cd backend
npm install
```

Create `.env` file:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/finance_suite
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d
NODE_ENV=development
```

Start backend:
```bash
npm run dev
```

### 2. Frontend Setup

```bash
cd frontend
npm install
```

Start frontend:
```bash
npm run dev
```

### 3. Access Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## First Steps

1. Register a new account
2. Login with your credentials
3. Start adding expenses, revenue, and invoices

## Features Overview

### Expense Management
- Add expenses with category, payment mode, and operation type
- Automatic GST and TDS calculations
- Filter by year, month, category, and operation type
- View expense dashboard with summaries and charts

### Revenue Management
- Track revenue by client, country, and service
- Monitor invoice amounts, received amounts, and due amounts
- Filter by year, month, country, and service
- View revenue dashboard with geography and service breakdowns

### Invoice Management
- Create professional invoices with GST/TDS calculations
- Support for multiple currencies (INR, USD, CAD, AUD)
- Automatic CGST/SGST/IGST calculations based on client location
- Download invoices as PDF
- Track invoice status (Paid, Unpaid, Partial)

### Dashboards
- Expense Dashboard: Category-wise and month-wise summaries
- Revenue Dashboard: Geography-wise and service-wise breakdowns
- Overall Summary: Total revenue, expenses, and net profit

## Data Models

### Expense Categories
- Salaries, Office Rent, Internet, Electricity, Software Tools
- HR/Admin, Travel, Food, Marketing, Compliance
- Misc, Chai n Snacks, Loan Interest, Purchase

### Payment Modes
- Office Cash, Bank Transfer
- Mihir Personal, Komal Personal HDFC, Komal Personal Cash
- HR Personal, Other

### Operation Types
- OPERATION, SOCIAL MEDIA, WEBSITE
- BUSINESS DEVELOPMENT, TELE CALLING

### Revenue Services
- Website Design, B2B Sales Consulting
- Outbound Lead Generation, Social Media Marketing
- SEO, TeleCalling, Other Services

### Countries
- India, USA, Canada, Australia

## Tax Calculations

### GST
- **CGST + SGST**: Same state (India)
- **IGST**: Different states or countries
- Formula: `(Base Amount × GST %) / 100`

### TDS
- Formula: `(Invoice Amount × TDS %) / 100`

### Grand Total
- Formula: `Invoice Amount + GST - TDS - Remittance Charges`

## API Authentication

All API endpoints (except `/api/auth/register` and `/api/auth/login`) require JWT authentication.

Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running
- Check MONGODB_URI in `.env` file
- For MongoDB Atlas, use the connection string format: `mongodb+srv://username:password@cluster.mongodb.net/dbname`

### Port Already in Use
- Change PORT in backend `.env` file
- Update frontend proxy in `vite.config.js` if needed

### PDF Generation Issues
- Ensure `temp` folder exists in backend directory
- Check file permissions

## Production Deployment

1. Set `NODE_ENV=production` in backend `.env`
2. Use a strong `JWT_SECRET`
3. Set up MongoDB Atlas or production MongoDB instance
4. Build frontend: `cd frontend && npm run build`
5. Serve frontend build files using a web server (nginx, Apache, etc.)
6. Use PM2 or similar process manager for backend

## Support

For issues or questions, please check the README.md file or create an issue in the repository.

