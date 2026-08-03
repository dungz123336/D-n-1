"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookMarked, CheckCircle2, Heart, ShoppingBag, Sparkles } from "lucide-react";
import { BookCard } from "@/components/books/BookCard";
import { useCatalog } from "@/store/catalog";
import { useWishlist } from "@/store/wishlist";
import { useMemory } from "@/store/memory";
import { cn } from "@/lib/utils";

type Shelf = "purchased" | "reading" | "wishlist" | "completed";

const TABS: { id: Shelf; label: string; icon: typeof Heart }[] = [
  { id: "purchased", label: "Purchased", icon: ShoppingBag },
  { id: "reading", label: "Reading", icon: BookMarked },
  { id: "wishlist", label: "Wishlist", icon: Heart },
  { id: "completed", label: "Completed", icon: CheckCircle2 },
];

export default function BookshelfPage() {
  const books = useCatalog((s) => s.books);
  const wish = useWishlist((s) => s.ids);
  const toggleWish = useWishlist((s) => s.toggle);
  const viewed = useMemory((s) => s.viewedBooks);
  const [tab, setTab] = useState<Shelf>("wishlist");
  const [reading, setReading] = useState<number[]>([]);
  const [completed, setCompleted] = useState<number[]>([]);
  const [purchased, setPurchased] = useState<number[]>([]);

  useEffect(() => {
    try {
      setReading(JSON.parse(localStorage.getItem("bn-shelf-reading") || "[]"));
      setCompleted(JSON.parse(localStorage.getItem("bn-shelf-completed") || "[]"));
      const orders = JSON.parse(localStorage.getItem("booknest-orders") || "[]") as {
        items?: { bookId?: number; id?: number }[];
      }[];
      const ids = orders.flatMap((o) => (o.items || []).map((i) => i.bookId ?? i.id));
      setPurchased([...new Set(ids.filter((x): x is number => Boolean(x)))]);
    } catch {
      /* */
    }
  }, []);

  const persist = (key: string, ids: number[]) => {
    localStorage.setItem(key, JSON.stringify(ids));
  };

  const map: Record<Shelf, number[]> = {
    purchased,
    reading,
    wishlist: wish,
    completed,
  };

  const list = map[tab].map((id) => books.find((b) => b.id === id)).filter(Boolean);

  const stats = useMemo(
    () => ({
      purchased: purchased.length,
      reading: reading.length,
      wishlist: wish.length,
      completed: completed.length,
    }),
    [purchased, reading, wish, completed]
  );

  const moveTo = (bookId: number, target: Shelf) => {
    if (target === "reading") {
      const next = [bookId, ...reading.filter((id) => id !== bookId)];
      setReading(next);
      persist("bn-shelf-reading", next);
      setCompleted((c) => {
        const n = c.filter((id) => id !== bookId);
        persist("bn-shelf-completed", n);
        return n;
      });
    }
    if (target === "completed") {
      const next = [bookId, ...completed.filter((id) => id !== bookId)];
      setCompleted(next);
      persist("bn-shelf-completed", next);
      setReading((r) => {
        const n = r.filter((id) => id !== bookId);
        persist("bn-shelf-reading", n);
        return n;
      });
    }
    if (target === "wishlist") toggleWish(bookId);
  };

  return (
    <div className="py-10">
      <p className="section-kicker">AI Bookshelf</p>
      <h1 className="section-title mt-2 text-4xl">Thư viện cá nhân</h1>
      <p className="mt-2 max-w-2xl text-text-secondary">
        Tổ chức Purchased · Reading · Wishlist · Completed — đồng bộ trên thiết bị (demo).
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TABS.map((t) => (
          <div key={t.id} className="glass rounded-[20px] p-4 text-center">
            <t.icon className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-2 text-2xl font-bold text-white">{stats[t.id]}</p>
            <p className="text-xs text-muted">{t.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold capitalize",
              tab === t.id
                ? "border-primary bg-primary/20 text-primary"
                : "border-white/10 text-muted hover:border-primary/30"
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="glass mt-8 space-y-4 p-10 text-center text-muted">
          <p>Chưa có sách trong kệ này.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/search" className="btn-primary px-4 py-2 text-sm">
              Khám phá sách
            </Link>
            {tab === "reading" && viewed[0] && (
              <button
                type="button"
                className="btn-secondary px-4 py-2 text-sm"
                onClick={() => moveTo(viewed[0].id, "reading")}
              >
                Thêm “{viewed[0].title}” vào Reading
              </button>
            )}
            {tab === "completed" && (reading[0] || viewed[0]) && (
              <button
                type="button"
                className="btn-secondary px-4 py-2 text-sm"
                onClick={() => moveTo(reading[0] || viewed[0].id, "completed")}
              >
                Đánh dấu 1 cuốn Completed
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {list.map(
            (b) =>
              b && (
                <div key={b.id} className="space-y-2">
                  <BookCard book={b} />
                  <div className="flex flex-wrap gap-1">
                    {tab !== "reading" && (
                      <button
                        type="button"
                        className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-muted hover:border-primary/40 hover:text-primary"
                        onClick={() => moveTo(b.id, "reading")}
                      >
                        → Reading
                      </button>
                    )}
                    {tab !== "completed" && (
                      <button
                        type="button"
                        className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-muted hover:border-primary/40 hover:text-primary"
                        onClick={() => moveTo(b.id, "completed")}
                      >
                        → Done
                      </button>
                    )}
                  </div>
                </div>
              )
          )}
        </div>
      )}

      <div className="glass mt-10 flex flex-col gap-3 rounded-[24px] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-bold text-white">AI Reading Planner</p>
            <p className="text-sm text-text-secondary">
              Gợi ý lịch đọc theo mục tiêu năm — kết hợp Reading Challenge.
            </p>
          </div>
        </div>
        <Link href="/challenges" className="btn-primary shrink-0 px-5 py-2.5 text-sm">
          Mở Challenge
        </Link>
      </div>
    </div>
  );
}
