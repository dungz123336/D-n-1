# BookNest Store ↔ AI API

Unified FastAPI backend: **BookNest-AI** serves both the website and the Concierge.

Base URL: `http://127.0.0.1:8000`  
Also under: `/api/v1/*`  
Swagger: http://127.0.0.1:8000/docs

All catalog/cart/order/voucher data is loaded from the **database** (or future BookNest remote API). The chatbot calls `StoreService` / `/ai/context` so it never hardcodes prices or stock.

---

## Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Register |
| POST | `/auth/login` | JWT login |
| GET | `/users/{id}` | User profile |

## Books

| Method | Path |
|--------|------|
| GET | `/books` |
| GET | `/books/{id}` |
| GET | `/books/search?q=` |
| GET | `/books/trending` |
| GET | `/books/bestseller` |
| GET | `/books/new` |
| GET | `/books/category` |
| GET | `/books/recommend` |

## Categories / Authors / Publishers / Inventory

| Method | Path |
|--------|------|
| GET | `/categories` |
| GET | `/authors` |
| GET | `/authors/{id}` |
| GET | `/authors/{id}/books` |
| GET | `/publishers` |
| GET | `/inventory` |

## Wishlist

| Method | Path |
|--------|------|
| GET | `/wishlist?customer_id=` |
| POST | `/wishlist` |
| DELETE | `/wishlist?customer_id=&book_id=` |

## Cart

| Method | Path |
|--------|------|
| GET | `/cart?customer_id=` |
| POST | `/cart/items` |
| PATCH | `/cart/items` |
| DELETE | `/cart/items?customer_id=&book_id=` |
| GET | `/cart/total?customer_id=&voucher_code=` |

## Orders

| Method | Path |
|--------|------|
| POST | `/orders` |
| POST | `/orders/cancel` |
| POST | `/orders/track` |
| GET | `/orders/history?customer_id=` |
| GET | `/orders/invoice` |
| POST | `/orders/address` |

## Payments

| Method | Path |
|--------|------|
| GET | `/payments/methods` |
| POST | `/payments` |
| POST | `/payments/{transaction_id}/confirm` |

Methods: `cod` · `momo` · `vnpay` · `zalopay` · `visa` · `mastercard`

## Vouchers

| Method | Path |
|--------|------|
| GET | `/vouchers` |
| POST | `/vouchers/apply` |
| POST | `/vouchers/auto-apply?customer_id=` |
| GET | `/vouchers/bulk` |
| GET | `/vouchers/student` |
| GET | `/vouchers/membership` |

## Reviews

| Method | Path |
|--------|------|
| GET | `/reviews?book_id=` |
| POST | `/reviews` |

## Search

| Method | Path |
|--------|------|
| GET | `/search?q=` |
| POST | `/search/voice` |
| GET | `/search/barcode?code=` |

## Chatbot

| Method | Path |
|--------|------|
| POST | `/chat` |
| POST | `/chat/stream` |
| POST | `/chat/history` |
| POST | `/chat/image` |
| POST | `/chat/barcode` |
| POST | `/chat/voice` |
| GET | `/ai/context?customer_id=` |

---

## Frontend (Next.js) integration

```ts
const API = process.env.NEXT_PUBLIC_BOOKNEST_API || "http://127.0.0.1:8000";

export async function getBooks(q?: string) {
  const url = q ? `${API}/books/search?q=${encodeURIComponent(q)}` : `${API}/books`;
  return fetch(url).then((r) => r.json());
}

export async function addToCart(customerId: number, bookId: number, qty = 1) {
  return fetch(`${API}/cart/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_id: customerId, book_id: bookId, quantity: qty }),
  }).then((r) => r.json());
}

export async function chat(message: string, customerId?: number) {
  return fetch(`${API}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, customer_id: customerId, language: "vi" }),
  }).then((r) => r.json());
}
```

---

## Demo

- User: `demo@booknest.ai` / `demo1234` (customer_id=1, Gold)
- Vouchers: `WELCOME10`, `BOOKNEST15`, `READMORE20`, virtual `MEMBER15`, `STUDENT10`, `BULK5`
