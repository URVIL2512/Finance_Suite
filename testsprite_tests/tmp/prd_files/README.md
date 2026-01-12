# Finance Suite - Expense, Revenue & Invoice Management

A full-stack MERN application for managing expenses, revenue, and invoices with Indian accounting and GST standards.

## Features

- **Expense Management**: Track expenses by category, payment mode, and operation type
- **Revenue Management**: Track revenue by client, country, and service
- **Invoice Management**: Create and manage invoices with GST/TDS calculations
- **Dashboard**: View summaries, charts, and reports
- **Indian Accounting Standards**: GST (CGST, SGST, IGST), TDS, and Remittance charges
- **Multi-currency Support**: INR (primary), USD, CAD, AUD for invoices

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT
- **Charts**: Recharts

## Project Structure

```
Finance_Suite/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── utils/
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── utils/
│   └── package.json
└── README.md
```

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the backend directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/finance_suite
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d
NODE_ENV=development
```

4. Start the backend server:
```bash
npm run dev
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the frontend directory (optional):
```env
VITE_API_URL=http://localhost:5000/api
```

4. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)

### Expenses
- `GET /api/expenses` - Get all expenses (with filters)
- `GET /api/expenses/:id` - Get single expense
- `POST /api/expenses` - Create expense
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense

### Revenue
- `GET /api/revenue` - Get all revenue (with filters)
- `GET /api/revenue/:id` - Get single revenue
- `POST /api/revenue` - Create revenue
- `PUT /api/revenue/:id` - Update revenue
- `DELETE /api/revenue/:id` - Delete revenue

### Invoices
- `GET /api/invoices` - Get all invoices (with filters)
- `GET /api/invoices/:id` - Get single invoice
- `POST /api/invoices` - Create invoice
- `PUT /api/invoices/:id` - Update invoice
- `DELETE /api/invoices/:id` - Delete invoice

### Dashboard
- `GET /api/dashboard/expenses` - Get expense dashboard data
- `GET /api/dashboard/revenue` - Get revenue dashboard data
- `GET /api/dashboard/summary` - Get overall summary

## Tax Calculations

### GST Logic
- **CGST + SGST**: When client and company are in the same state (India)
- **IGST**: When client and company are in different states or different countries
- GST Amount = (Base Amount × GST %) / 100

### TDS Logic
- TDS Amount = (Invoice Amount × TDS %) / 100

### Grand Total
- Grand Total = Invoice Amount + GST - TDS - Remittance Charges

## Usage

1. Register a new account or login
2. Navigate to Expenses to add expense entries
3. Navigate to Revenue to add revenue entries
4. Navigate to Invoices to create invoices
5. View dashboards for summaries and charts

## License

ISC

