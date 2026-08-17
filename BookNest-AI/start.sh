#!/usr/bin/env bash
# BookNest Concierge — khởi động đa nền tảng (macOS / Linux / WSL).
# Chạy:  ./start.sh
set -e

cd "$(dirname "$0")"

echo "============================================"
echo "  BookNest Concierge (backend.main:app)"
echo "============================================"

# 1) Tạo virtualenv nếu chưa có
if [ ! -x ".venv/bin/python" ]; then
  echo "Tạo virtualenv .venv ..."
  python3 -m venv .venv
fi

# 2) Kích hoạt venv
source .venv/bin/activate

# 3) Cài dependencies
echo "Cài dependencies ..."
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# 4) Tự tạo .env từ .env.example nếu chưa có (mặc định dùng `mock` — chạy offline)
if [ ! -f ".env" ]; then
  echo "Chưa có .env → tạo từ .env.example (AI_PROVIDER=mock)."
  cp .env.example .env
  echo "Sau này thêm API key + đổi AI_PROVIDER trong .env để dùng AI thật."
fi

# 5) Đặt PYTHONPATH để import package `backend`
export PYTHONPATH="$(pwd)"

echo ""
echo "  UI     : http://127.0.0.1:8000/ui/chat"
echo "  Widget : http://127.0.0.1:8000/widget/booknest-widget.js"
echo "  Swagger: http://127.0.0.1:8000/docs"
echo "  Health : http://127.0.0.1:8000/health"
echo ""

# 6) Chạy server (host 0.0.0.0 để máy khác trong mạng LAN truy cập được)
exec python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
