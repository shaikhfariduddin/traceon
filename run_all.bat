@echo off
title Tile Quality Inspection & Defect Tracking Launcher
color 0B
echo ======================================================================
echo           Tile Quality Inspection & Defect Tracking System
echo                   Buildathon 2.0 Hackathon Launcher
echo ======================================================================
echo.

echo [1/2] Launching FastAPI Backend on Port 8000...
start "Tile Backend (Port 8000)" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 3 /nobreak >nul

echo [2/2] Launching Vite Frontend on Port 5173...
start "Tile Frontend (Port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ======================================================================
echo  Services started successfully in background terminal windows!
echo.
echo  * Frontend Application: http://localhost:5173
echo  * Backend API / Docs:   http://127.0.0.1:8000/api/docs
echo  * System Health:        http://127.0.0.1:8000/api/health
echo.
echo  Press any key to close this launcher window (services will stay open)
echo ======================================================================
pause >nul
