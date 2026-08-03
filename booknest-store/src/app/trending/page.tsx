"use client";

import { useMemo } from "react";
import { BookCard } from "@/components/books/BookCard";
import { useCatalog } from "@/store/catalog";
import { readAnalytics } from "@/store/memory";
import type { Book } from "@/types";
import { TrendingUp, Search, Star, Heart } from "lucide-react";

export default function TrendingPage() {
  const books = useCatalog((s) => s.books);
  const data = useMemo(() => {
    const events = typeof window !== "undefined" ? readAnalytics() : [];
    const topSelling = [...books].sort((a, b) => b.sold - a.sold).slice(0, 8);
    const weekly = [...books].sort((a, b) => b.sold * b.rating - a.sold * a.rating).slice(0, 8);
    const rated = [...books].sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount).slice(0, 8);
    const searchCount = new Map<string, number>();
    for (const e of events.filter((x) => x.type === "search")) {
      const q = String(e.data?.q || "").toLowerCase();
      if (q) searchCount.set(q, (searchCount.get(q) || 0) + 1);
    }
    const mostSearched = [...searchCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const viewCount = new Map<number, number>();
    for (const e of events.filter((x) => x.type === "view")) {
      const id = Number(e.data?.bookId);
      if (id) viewCount.set(id, (viewCount.get(id) || 0) + 1);
    }
    const trending = [...books]
      .map((b) => ({ b, s: (viewCount.get(b.id) || 0) * 3 + b.sold / 1000 + (b.flashSale ? 5 : 0) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map((x) => x.b);
    const authors = Array.from(new Set(topSelling.map((b) => b.author))).slice(0, 8);
    return { topSelling, weekly, rated, mostSearched, trending, authors };
  }, [books]);

  return (
    <div className="py-10">
      <p className="section-kicker">Live rankings</p>
      <h1 className="section-title mt-2 text-4xl sm:text-5xl">Trending Dashboard</h1>
      <p className="mt-3 text-text-secondary">Cập nhật theo bán chạy, lượt xem, tìm kiếm và đánh giá realtime (thiết bị).</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: TrendingUp, t: "Top selling", n: data.topSelling[0]?.title },
          { icon: Search, t: "Most searched", n: data.mostSearched[0]?.[0] || "—" },
          { icon: Star, t: "Highest rated", n: data.rated[0]?.title },
          { icon: Heart, t: "Trending now", n: data.trending[0]?.title },
        ].map((x) => (
          <div key={x.t} className="glass rounded-[20px] p-4">
            <x.icon className="h-5 w-5 text-primary" />
            <p className="mt-2 text-xs font-bold uppercase tracking-wider text-muted">{x.t}</p>
            <p className="mt-1 line-clamp-2 font-semibold text-white">{x.n}</p>
          </div>
        ))}
      </div>

      <Section title="Top selling today" books={data.topSelling} />
      <Section title="Top this week" books={data.weekly} />
      <Section title="Trending (views + velocity)" books={data.trending} />
      <Section title="Highest rated" books={data.rated} />

      <div className="glass mt-10 rounded-[24px] p-5">
        <h2 className="section-title text-2xl">Most searched keywords</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.mostSearched.length === 0 && <p className="text-sm text-muted">Chưa có dữ liệu tìm kiếm trên thiết bị này.</p>}
          {data.mostSearched.map(([q, n]) => (
            <span key={q} className="rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-sm text-primary">
              #{q} · {n}
            </span>
          ))}
        </div>
        <h3 className="mt-6 font-bold text-white">Trending authors</h3>
        <p className="mt-2 text-sm text-text-secondary">{data.authors.join(" · ")}</p>
      </div>
    </div>
  );
}

function Section({ title, books }: { title: string; books: Book[] }) {
  return (
    <section className="mt-10">
      <h2 className="section-title text-2xl">{title}</h2>
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {books.map((b) => (
          <BookCard key={b.id} book={b} />
        ))}
      </div>
    </section>
  );
}
