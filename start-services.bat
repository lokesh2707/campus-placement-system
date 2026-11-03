@echo off
echo ========================================================
echo Starting AI-Powered Campus Placement Intelligence System
echo ========================================================

echo 1. Launching Python FastAPI ML Service (Port 8000)...
start "Campus Placement - AI/ML Microservice (8000)" cmd /k "cd ml-service && py -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 3 /nobreak > nul

echo 2. Launching Node.js Express Backend API (Port 5000)...
start "Campus Placement - Express Backend (5000)" cmd /k "cd backend && npm run dev"

timeout /t 2 /nobreak > nul

echo 3. Launching React Vite Frontend (Port 5173)...
start "Campus Placement - Vite Frontend (5173)" cmd /k "cd frontend && npm run dev"

echo.
echo All services launched!
echo - Frontend:    http://localhost:5173
echo - Backend API: http://localhost:5000
echo - ML Service:  http://127.0.0.1:8000/docs
echo.
echo To seed demo data anytime, run: npm run seed
echo ========================================================
