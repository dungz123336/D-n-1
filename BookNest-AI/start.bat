@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo   BookNest Concierge
echo ============================================

if not exist ".venv\Scripts\python.exe" (
  echo Creating venv...
  py -3 -m venv .venv
)

call .venv\Scripts\activate.bat
set PYTHONPATH=%CD%

echo Checking packages...
python -c "import fastapi,uvicorn" 2>nul
if errorlevel 1 (
  python -m pip install --upgrade pip
  python -m pip install fastapi "uvicorn[standard]" pydantic pydantic-settings python-dotenv python-multipart httpx sqlalchemy aiosqlite "python-jose[cryptography]" bcrypt slowapi orjson openai aiofiles greenlet google-generativeai pillow
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
  taskkill /F /PID %%a >nul 2>&1
)

echo.
echo   UI     : http://127.0.0.1:8000/ui/chat
echo   Swagger: http://127.0.0.1:8000/docs
echo   Health : http://127.0.0.1:8000/health
echo.
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
pause
