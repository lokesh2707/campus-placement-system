# AI-Powered Campus Placement Intelligence System
# One-click startup script for Windows PowerShell

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Starting AI Campus Placement Intelligence System..." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Start Python FastAPI ML Microservice
Write-Host "1. Launching AI/ML Microservice on port 8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd ml-service; py -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

Start-Sleep -Seconds 3

# 2. Start Express Backend
Write-Host "2. Launching Express Backend API on port 5000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm run dev"

Start-Sleep -Seconds 2

# 3. Start Vite React Frontend
Write-Host "3. Launching React Vite Frontend on port 5173..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "`nAll 3 services launched in separate windows!" -ForegroundColor Green
Write-Host " - Frontend:    http://localhost:5173" -ForegroundColor White
Write-Host " - Backend API: http://localhost:5000" -ForegroundColor White
Write-Host " - ML Swagger:  http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "`nTo seed or reset demo data anytime, run: npm run seed" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
