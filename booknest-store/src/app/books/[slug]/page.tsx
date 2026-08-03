"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Heart, Minus, Plus, ShoppingCart, Star, Truck, Shield, Zap } from "lucide-react";
import { BookCover } from "@/components/books/BookCover";
import { BookCard } from "@/components/books/BookCard";
import { formatVND, formatSold } from "@/lib/utils";
import { useCart } from "@/store/cart";
import { useWishlist } from "@/store/wishlist";
import { useCatalog } from "@/store/catalog";
import { useMemory } from "@/store/memory";

export default function BookDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const books = useCatalog((s) => s.books);
  const book = books.find((b) => b.slug === slug);
  const [qty, setQty] = useState(1);
  const add = useCart((s) => s.add);
  const toggle = useWishlist((s) => s.toggle);
  const liked = useWishlist((s) => (book ? s.ids.includes(book.id) : false));
  const trackView = useMemory((s) => s.trackView);

  useEffect(() => {
    if (book) {
      trackView({
        id: book.id,
        title: book.title,
        category: book.category,
        author: book.author,
      });
    }
  }, [book?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const related = useMemo(() => {
    if (!book) return [];
    const ids = book.relatedBooks;
    const byId = books.filter((b) => ids.includes(b.id));
    const sameCat = books.filter((b) => b.category === book.category && b.id !== book.id);
    return [...byId, ...sameCat]
      .filter((b, i, arr) => arr.findIndex((x) => x.id === b.id) === i)
      .slice(0, 5);
  }, [book, books]);

  if (!book) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-muted">Không tìm thấy sách.</p>
        <Link href="/search" className="btn-primary mt-4 inline-flex px-5 py-2.5 text-sm">
          Về tìm kiếm
        </Link>
      </div>
    );
  }

  return (
    <div className="py-10">
      <nav className="mb-6 text-xs text-muted">
        <Link href="/" className="hover:text-primary">
          Trang chủ
        </Link>
        {" / "}
        <span className="text-white">{book.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="glass rounded-[28px] p-6">
          <BookCover
            title={book.title}
            author={book.author}
            gradient={book.coverGradient}
            image={book.images?.[0]}
            size="lg"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {book.ebook && (
              <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">eBook</span>
            )}
            {book.audiobook && (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Audio</span>
            )}
            {book.bestseller && (
              <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-[#8a6d12]">Bestseller</span>
            )}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-secondary">
            {book.category} · {book.subCategory}
          </p>
          <h1 className="section-title mt-1 text-3xl sm:text-4xl">{book.title}</h1>
          <p className="mt-2 text-muted">
            {book.author} · {book.publisher} · {book.publishYear}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1 font-semibold">
              <Star className="h-4 w-4 fill-accent text-accent" /> {book.rating}
            </span>
            <span className="text-muted">{book.reviewCount} đánh giá</span>
            <span className="text-muted">Đã bán {formatSold(book.sold)}</span>
            <span className="text-muted">Còn {book.stock}</span>
          </div>

          <div className="mt-6 flex items-end gap-3">
            <span className="text-3xl font-extrabold text-sale">{formatVND(book.salePrice)}</span>
            {book.discount > 0 && (
              <>
                <span className="text-lg text-muted line-through">{formatVND(book.price)}</span>
                <span className="rounded-full bg-sale px-2 py-0.5 text-xs font-bold text-white">
                  -{book.discount}%
                </span>
              </>
            )}
          </div>

          <p className="mt-4 text-sm leading-relaxed text-muted">{book.description}</p>
          <p className="mt-3 rounded-[20px] bg-primary/5 p-4 text-sm leading-relaxed">{book.summary}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-full border border-white/15 bg-white/5">
              <button type="button" className="p-3" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-8 text-center font-bold">{qty}</span>
              <button type="button" className="p-3" onClick={() => setQty((q) => q + 1)}>
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => add(book.id, qty)}
              className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm"
            >
              <ShoppingCart className="h-4 w-4" /> Thêm giỏ
            </button>
            <Link
              href="/checkout"
              onClick={() => add(book.id, qty)}
              className="btn-secondary inline-flex items-center gap-2 px-6 py-3 text-sm"
            >
              <Zap className="h-4 w-4" /> Mua ngay
            </Link>
            <button
              type="button"
              onClick={() => toggle(book.id)}
              className={`flex h-12 w-12 items-center justify-center rounded-full border ${
                liked ? "border-sale text-sale" : "border-primary/15 text-muted"
              }`}
            >
              <Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} />
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="glass flex gap-3 rounded-2xl p-4 text-sm">
              <Truck className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">Giao nhanh</p>
                <p className="text-muted">1–2 ngày nội thành · Freeship ≥ 200K</p>
              </div>
            </div>
            <div className="glass flex gap-3 rounded-2xl p-4 text-sm">
              <Shield className="h-5 w-5 text-secondary" />
              <div>
                <p className="font-semibold">Đổi trả 7 ngày</p>
                <p className="text-muted">Lỗi in / hỏng vận chuyển</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="mt-12 grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-[24px] p-5">
          <h2 className="section-title text-xl">Chi tiết xuất bản</h2>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {[
              ["ISBN", book.isbn],
              ["NXB", book.publisher],
              ["Năm", book.publishYear],
              ["Ngôn ngữ", book.language],
              ["Số trang", String(book.pages)],
              ["Khổ", book.size],
              ["Bìa", book.coverType],
              ["Định dạng", [book.ebook && "Ebook", book.audiobook && "Audio", "Print"].filter(Boolean).join(" · ")],
            ].map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd className="font-medium text-white">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="glass rounded-[24px] p-5">
          <h2 className="section-title text-xl">Xem thử & mục lục</h2>
          <p className="mt-2 text-sm text-text-secondary">{book.summary}</p>
          <ul className="mt-3 list-inside list-disc text-sm text-muted">
            {(book.tableOfContents?.length ? book.tableOfContents : ["Lời mở đầu", "Chương 1", "Chương 2", "Kết"]).map(
              (t) => (
                <li key={t}>{t}</li>
              )
            )}
          </ul>
          <p className="mt-4 text-xs text-primary">Sample pages: xem thử 5–10 trang khi có file PDF (upload Admin).</p>
        </div>
      </section>

      <section className="mt-10 glass rounded-[24px] p-5">
        <h2 className="section-title text-xl">Đánh giá khách hàng</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            { n: "Lan Anh", t: "Đóng gói đẹp, nội dung đúng mô tả." },
            { n: "Minh", t: "Ship nhanh, giá tốt hơn cửa hàng." },
            { n: "Hương", t: "Concierge gợi ý rất trúng gu đọc." },
          ].map((r) => (
            <div key={r.n} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
              <div className="flex gap-0.5 text-primary">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-primary" />
                ))}
              </div>
              <p className="mt-2 text-text-secondary">{r.t}</p>
              <p className="mt-2 text-xs font-semibold text-white">{r.n}</p>
            </div>
          ))}
        </div>
      </section>

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="section-title mb-2 text-2xl">Frequently bought together</h2>
          <p className="mb-6 text-sm text-muted">Sách liên quan & cùng chủ đề</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {related.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
