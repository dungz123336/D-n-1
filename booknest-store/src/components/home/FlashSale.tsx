"use client";

import { useEffect, useState } from "react";
import { Flame, Timer } from "lucide-react";
import { useCatalog } from "@/store/catalog";
import { BookCard } from "@/components/books/BookCard";

function useCountdown(hours = 8) {
  const [end] = useState(() => Date.now() + hours * 3600 * 1000);
  const [left, setLeft] = useState(end - Date.now());
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, end - Date.now())), 1000);
    return () => clearInterval(t);
  }, [end]);
  return {
    h: Math.floor(left / 3600000),
    m: Math.floor((left % 3600000) / 60000),
    s: Math.floor((left % 60000) / 1000),
  };
}

function Unit({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex min-w-14 flex-col items-center rounded-2xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur">
      <span className="text-lg font-extrabold text-white">{String(n).padStart(2, "0")}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</span>
    </div>
  );
}

export function FlashSale() {
  const { h, m, s } = useCountdown(8);
  const books = useCatalog((s) => s.books);
  const saleBooks = books.filter((b) => b.flashSale);

  return (
    <section className="pt-20">
      <div className="overflow-hidden rounded-[28px] border border-primary/25 bg-gradient-to-br from-[#2D174A] to-[#160726] p-6 sm:p-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="section-kicker flex items-center gap-2">
              <Flame className="h-3.5 w-3.5 text-highlight" /> Limited window
            </p>
            <h2 className="section-title mt-2 text-3xl sm:text-4xl">Flash Collection</h2>
            <p className="mt-2 text-sm text-text-secondary">Ưu đãi chọn lọc trong khung giờ vàng.</p>
          </div>
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            <Unit n={h} label="Giờ" />
            <Unit n={m} label="Phút" />
            <Unit n={s} label="Giây" />
          </div>
        </div>

        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-primary to-highlight shimmer" />
        </div>
        <p className="mb-6 text-xs font-medium text-muted">68% suất flash đã được đặt</p>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {saleBooks.slice(0, 5).map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </div>
      </div>
    </section>
  );
}
