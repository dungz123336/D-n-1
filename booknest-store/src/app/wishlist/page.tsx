"use client";

import Link from "next/link";
import { Bell, Tag } from "lucide-react";
import { useWishlist } from "@/store/wishlist";
import { useCatalog } from "@/store/catalog";
import { BookCard } from "@/components/books/BookCard";
import { formatVND } from "@/lib/utils";

export default function WishlistPage() {
  const ids = useWishlist((s) => s.ids);
  const getById = useCatalog((s) => s.getById);
  const books = ids.map((id) => getById(id)).filter(Boolean);

  const alerts = books.flatMap((b) => {
    if (!b) return [];
    const notes = [];
    if (b.discount >= 15) notes.push({ type: "price", text: `${b.title}: đang giảm ${b.discount}%` });
    if (b.stock > 0 && b.stock <= 8) notes.push({ type: "stock", text: `${b.title}: chỉ còn ${b.stock} cuốn` });
    if (b.newArrival) notes.push({ type: "new", text: `${b.title}: ấn bản/new listing` });
    return notes;
  });

  const similar = books[0]
    ? useCatalog
        .getState()
        .books.filter((b) => b.category === books[0]!.category && !ids.includes(b.id))
        .slice(0, 4)
    : [];

  return (
    <div className="py-10">
      <h1 className="section-title text-3xl">Smart Wishlist</h1>
      <p className="mt-1 text-sm text-muted">
        {books.length} sách · thông báo giảm giá, tồn thấp, bản mới, gợi ý tương tự
      </p>

      {alerts.length > 0 && (
        <div className="glass mt-6 space-y-2 rounded-[20px] p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-primary">
            <Bell className="h-4 w-4" /> Thông báo thông minh
          </p>
          {alerts.slice(0, 6).map((a) => (
            <p key={a.text} className="flex items-start gap-2 text-sm text-text-secondary">
              <Tag className="mt-0.5 h-3.5 w-3.5 text-highlight" />
              {a.text}
              {a.type === "price" && <span className="text-xs text-primary">· voucher sẵn sàng</span>}
            </p>
          ))}
        </div>
      )}

      {books.length === 0 ? (
        <div className="glass mt-8 rounded-[24px] p-10 text-center">
          <p className="text-muted">Chưa có sách trong wishlist.</p>
          <Link href="/search" className="btn-primary mt-4 inline-flex px-6 py-3 text-sm">
            Khám phá sách
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {books.map((b) => b && <BookCard key={b.id} book={b} />)}
          </div>
          {similar.length > 0 && (
            <section className="mt-12">
              <h2 className="section-title text-2xl">Gợi ý từ wishlist</h2>
              <p className="mt-1 text-sm text-muted">
                Tương tự “{books[0]?.title}” · từ {formatVND(similar[0]?.salePrice || 0)}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {similar.map((b) => (
                  <BookCard key={b.id} book={b} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
