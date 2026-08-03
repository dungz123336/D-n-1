# 📚 BookNest Store — Premium Online Bookstore

Website bán sách **màu sắc, hiện đại, premium** (inspired by Tiki / Shopee Books / Amazon Books) với:

- Next.js 15 + React 19 + TypeScript + Tailwind CSS 4
- Framer Motion · Swiper · Lucide · Zustand
- Glassmorphism · soft gradients · micro-interactions
- REST API demo (`/api/*`) · GraphQL-ready architecture
- AI chat widget · Wishlist · Cart · Checkout · Admin CMS UI

## 🚀 Chạy dự án

```bash
cd booknest-store
npm install
npm run dev
```

Mở: **http://localhost:3000**

## 📄 Trang chính

| Route | Mô tả |
|-------|--------|
| `/` | Homepage: Hero, Flash Sale, Categories, Featured, Bestseller, New, AI Recommend, Authors, Blog, Reviews |
| `/search` | Search realtime + filters |
| `/books/[slug]` | Chi tiết sách |
| `/category/[slug]` | Danh mục |
| `/cart` | Giỏ hàng + coupon |
| `/checkout` | Thanh toán đa cổng (demo) |
| `/wishlist` | Yêu thích |
| `/account` | Tài khoản + order tracking |
| `/admin` | Dashboard CMS |

## 🔌 API

- `GET /api/homepage` — toàn bộ data trang chủ
- `GET /api/books?q=&featured=1&bestseller=1&flash=1`
- `GET /api/search?q=`

## 🗄 Schema mở rộng (NestJS + Prisma + PostgreSQL)

Bảng khuyến nghị: Books, Categories, Authors, Publishers, Promotions, Reviews, Orders, Customers, Blog, Banners, Coupons, Membership, Media, AI Recommendation.

Coupon demo: `WELCOME10` · `BOOKNEST15` · `FREESHIP`

## 🎨 Palette

- Primary `#FF6B6B` · Secondary `#6C63FF` · Accent `#FFD93D`
- Green `#34D399` · Blue `#38BDF8`

## 🧭 Roadmap production

1. NestJS API + Prisma + PostgreSQL + Redis  
2. JWT auth · Cloudinary · PDF preview  
3. Stripe / VNPay / ZaloPay  
4. PWA · i18n · push notifications  
5. Kết nối BookNest Python AI agent (Workshop1)

© BookNest Premium Demo
