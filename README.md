# BookNest — AI hỗ trợ website bán sách

Repo gồm 2 phần:

| Thư mục | Vai trò | Công nghệ |
|---------|---------|-----------|
| `BookNest-AI/` | Backend AI (chat, gợi ý sách, so sánh, voucher, đơn hàng) | Python · FastAPI · SQLite |
| `booknest-store/` | Website bán sách (frontend) | Next.js · React · Tailwind |

> **⚠️ Entrypoint (quan trọng):** hệ thống chỉ chạy backend ở `BookNest-AI/backend/` (`backend.main:app`).
> Thư mục `BookNest-AI/app/` là bản cũ (legacy), **không được dùng** — mọi script (`start.bat`, `start.sh`),
> `Dockerfile`, `docker-compose.yml` đều trỏ vào `backend/main.py`. Đừng sửa `app/`.

---

## 🚀 Cách chạy (ai clone về cũng chạy được)

> Không cần API key AI — mặc định backend chạy ở chế độ **mock** (offline) nên demo được ngay. Có key thật thì đổi `AI_PROVIDER` trong `.env`.

### Bước 1 — Chạy backend BookNest-AI

**Windows:** nhấp đúp `BookNest-AI/start.bat` (hoặc chạy trong cmd)

**macOS / Linux / WSL:**
```bash
cd BookNest-AI
./start.sh
```

Script sẽ tự: tạo virtualenv → cài dependencies → tạo `.env` từ `.env.example` → chạy server.

Sau khi chạy:
- UI chat: http://127.0.0.1:8000/ui/chat
- Widget nhúng: http://127.0.0.1:8000/widget/booknest-widget.js
- Swagger: http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/health

> Nếu chạy thủ công thay vì dùng script:
> ```bash
> cd BookNest-AI
> python -m venv .venv
> source .venv/bin/activate          # Windows: .venv\Scripts\activate
> pip install -r requirements.txt
> cp .env.example .env               # Windows: copy .env.example .env
> export PYTHONPATH="$(pwd)"         # Windows: set PYTHONPATH=%CD%
> uvicorn backend.main:app --host 0.0.0.0 --port 8000
> ```

### Bước 2 — Chạy frontend booknest-store

```bash
cd booknest-store
cp .env.local.example .env.local     # Windows: copy .env.local.example .env.local
npm install
npm run dev
```

Mở: **http://localhost:3000**

> `.env.local` chứa `NEXT_PUBLIC_BOOKNEST_AI_URL` — URL backend ở Bước 1. Nếu backend chạy ở máy khác, sửa lại địa chỉ IP đó.

---

## 🔌 Đổi AI provider (dùng AI thật)

Mở `BookNest-AI/.env`, đổi `AI_PROVIDER` và điền key tương ứng:

```env
AI_PROVIDER=deepseek          # openai | gemini | claude | grok | deepseek | ollama | mock
DEEPSEEK_API_KEY=sk-...
```

- `mock` = chạy offline, không cần key (mặc định để cả team demo được).
- `gemini`, `deepseek`, `openai`, `claude`, `grok`… = cần API key tương ứng.

---

## 🧩 Nhúng AI vào website bất kỳ

Chỉ cần 1 dòng `<script>` — widget tự hiện bong bóng chat ở góc màn hình, không xung đột CSS với website (dùng Shadow DOM):

```html
<script src="http://<HOST>:8000/widget/booknest-widget.js"
        data-api="http://<HOST>:8000"
        data-theme="#7c3aed"></script>
```

Các tham số (qua `data-*` hoặc `window.BookNestConfig`):

| Tham số | Mặc định | Ý nghĩa |
|---------|----------|---------|
| `data-api` | — (bắt buộc) | URL backend BookNest-AI |
| `data-theme` | `#7c3aed` | Màu chủ đạo |
| `data-position` | `right` | `right` hoặc `left` |
| `data-title` | `BookNest Concierge` | Tên bot |
| `data-greeting` | … | Tin nhắn chào |
| `data-language` | `vi` | `vi` / `en` |
| `data-open` | `false` | Tự mở panel khi tải trang |

Ví dụ demo: mở `BookNest-AI/frontend-widget/embed-demo.html`.

Có thể truyền context sản phẩm/giỏ hàng cho AI:
```html
<script>
  window.BookNestContext = {
    current_book: { id: 3, title: "Atomic Habits", price: 159000, stock: 120 },
    cart: [{ id: 3, qty: 1 }]
  };
</script>
```

> ⚠️ **Quan trọng khi nhúng vào website thật:** `127.0.0.1` chỉ chạy trên máy local. Để khách thật truy cập, cần **deploy backend lên host công khai** (Render / Railway / VM / VPS), rồi thay `<HOST>` bằng domain của backend. Trong `.env` đặt `CORS_ORIGINS=*` (đã là mặc định) để cho phép mọi origin gọi API.

---

## 🛠 Khắc phục sự cố

| Vấn đề | Cách xử lý |
|--------|------------|
| Backend không start | Kiểm tra Python 3.10+, chạy lại `pip install -r requirements.txt` |
| Chat không trả lời | Mở `http://127.0.0.1:8000/health` xem `ai_provider`; nếu `mock` thì OK, nếu provider thật thì kiểm tra key |
| Frontend không nói chuyện được với AI | Kiểm tra `.env.local` có đúng `NEXT_PUBLIC_BOOKNEST_AI_URL`, backend đang bật |
| Widget không hiện trên website | Mở console trình duyệt; widget báo lỗi nếu thiếu `data-api` |
