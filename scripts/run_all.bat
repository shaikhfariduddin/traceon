@echo off
echo ====================================================
echo Starting Tile Quality Inspection & Defect Tracking
echo ====================================================
start "Tile Backend (Port 8000)" cmd /k "%~dp0start_backend.bat"
timeout /t 3 /nobreak >nul
start "Tile Frontend (Port 5173)" cmd /k "%~dp0start_frontend.bat"
echo Services launched!
echo Backend:  http://127.0.0.1:8000/api/docs
echo Frontend: http://127.0.0.1:5173
pause
