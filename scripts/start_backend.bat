@echo off
echo ====================================================
echo Starting Tile Quality Backend (FastAPI on Port 8000)
echo ====================================================
cd /d "%~dp0\..\backend"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
pause
