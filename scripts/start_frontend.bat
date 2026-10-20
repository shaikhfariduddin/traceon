@echo off
echo ====================================================
echo Starting Tile Quality Frontend (Vite on Port 5173)
echo ====================================================
cd /d "%~dp0\..\frontend"
npm run dev
pause
