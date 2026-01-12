# How to Start the Application

## Prerequisites
- Node.js installed
- MongoDB running (local or Atlas)
- Backend `.env` file configured with `MONGODB_URI`

## Starting the Application

### 1. Start Backend Server

Open a terminal and run:

```bash
cd backend
npm run dev
```

The backend server will start on `http://localhost:5000`

**Important:** The backend server must be running before using the frontend.

### 2. Start Frontend Server

Open a **new terminal** and run:

```bash
cd frontend
npm run dev
```

The frontend will start on `http://localhost:3000`

## Troubleshooting

### Network Error
If you see "Network Error" or "Cannot connect to server":
1. Check if backend server is running on port 5000
2. Verify MongoDB connection in backend terminal
3. Check that `.env` file exists in `backend/` folder with `MONGODB_URI`

### Port Already in Use
If port 5000 or 3000 is already in use:
- Backend: Change `PORT` in `backend/.env` or `backend/server.js`
- Frontend: Change port in `frontend/vite.config.js`

### MongoDB Connection Error
- Ensure MongoDB is running (local or Atlas)
- Verify `MONGODB_URI` in `backend/.env` is correct
- For local MongoDB: `mongodb://localhost:27017/finance-suite`
- For Atlas: Use your Atlas connection string

