@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo   BookNest Concierge
echo ============================================

if not exist ".venv\Scripts\python.exe" (
  echo Creating venv...
  py -3 -m venv .venv 2>nul || python -m venv .venv
)

call .venv\Scripts\activate.bat
set PYTHONPATH=%CD%

if not exist ".env" (
  echo.
  echo Chua co .env - tao tu .env.example (AI_PROVIDER=mock, chay offline)...
  copy .env.example .env >nul
)

echo Checking packages...
python -c "import fastapi,uvicorn,sqlalchemy,aiosqlite" 2>nul
if errorlevel 1 (
  python -m pip install --upgrade pip
  python -m pip install -r requirements.txt
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
  taskkill /F /PID %%a >nul 2>&1
)

echo.
echo   UI     : http://127.0.0.1:8000/ui/chat
echo   Widget : http://127.0.0.1:8000/widget/booknest-widget.js
echo   Swagger: http://127.0.0.1:8000/docs
echo   Health : http://127.0.0.1:8000/health
echo.
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
pause
