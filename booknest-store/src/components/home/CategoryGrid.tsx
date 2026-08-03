"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { categories } from "@/data/categories";
import { useCatalog } from "@/store/catalog";
import type { Book, Category } from "@/types";
import { CategoryIllustration } from "./CategoryIllustrations";
import { SmartImage } from "@/components/media/SmartImage";
import { cn } from "@/lib/utils";

function matchBooks(cat: Category, books: Book[], limit = 3): Book[] {
  const keys = (cat.matchKeys || [cat.name, cat.slug]).map((k) => k.toLowerCase());
  const scored = books
    .map((b) => {
      const blob = `${b.category} ${b.subCategory} ${b.tags.join(" ")} ${b.title}`.toLowerCase();
      const score = keys.reduce((s, k) => (blob.includes(k) ? s + 1 : s), 0);
      return { b, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.b.rating - a.b.rating);

  const picked = scored.map((x) => x.b).slice(0, limit);
  if (picked.length >= limit) return picked;
  // fallback: featured covers for visual stack
  const rest = books.filter((b) => !picked.some((p) => p.id === b.id) && b.featured);
  return [...picked, ...rest].slice(0, limit);
}

function BookStack({ books }: { books: Book[] }) {
  const stack = books.slice(0, 3);
  while (stack.length < 3) {
    stack.push(
      stack[0] || {
        id: -1,
        title: "BookNest",
        author: "",
        coverGradient: "from-violet-600 to-fuchsia-500",
        images: [],
      } as unknown as Book
    );
  }

  return (
    <div className="cat-book-stack relative mx-auto h-[72px] w-[88px]">
      {stack.map((b, i) => {
        const img = b.images?.[0];
        const rotate = i === 0 ? "-rotate-[14deg]" : i === 1 ? "rotate-[2deg]" : "rotate-[16deg]";
        const z = i === 1 ? "z-20" : i === 0 ? "z-10" : "z-[5]";
        const x = i === 0 ? "left-0" : i === 1 ? "left-[18px]" : "left-[36px]";
        return (
          <div
            key={`${b.id}-${i}`}
            className={cn(
              "cat-book-cover absolute top-0 h-[70px] w-[48px] overflow-hidden rounded-[8px] border border-white/15 shadow-[0_10px_24px_rgba(0,0,0,0.45)] transition-transform duration-[350ms] ease-out",
              x,
              rotate,
              z
            )}
            style={{ transformOrigin: "bottom center" }}
          >
            <SmartImage
              src={img}
              alt=""
              fallbackLabel=""
              fallbackGradient={b.coverGradient || "from-violet-600 to-fuchsia-500"}
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
        );
      })}
    </div>
  );
}

function CategoryCard({
  cat,
  books,
}: {
  cat: Category;
  books: Book[];
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [spot, setSpot] = useState({ x: 50, y: 40 });

  const onMove = (e: MouseEvent<HTMLAnchorElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setSpot({ x, y });
  };

  const related = useMemo(() => matchBooks(cat, books, 3), [cat, books]);
  // live count from catalog when possible
  const liveCount = useMemo(() => {
    const keys = (cat.matchKeys || [cat.name]).map((k) => k.toLowerCase());
    const n = books.filter((b) => {
      const blob = `${b.category} ${b.subCategory} ${b.tags.join(" ")}`.toLowerCase();
      return keys.some((k) => blob.includes(k));
    }).length;
    return n > 0 ? n : cat.count;
  }, [cat, books]);

  return (
    <Link
      ref={ref}
      href={`/category/${cat.slug}`}
      onMouseMove={onMove}
      className="category-card group relative flex flex-col overflow-hidden rounded-[24px] border border-white/10 p-4 transition-all duration-[350ms] ease-out will-change-transform"
      style={
        {
          "--mx": `${spot.x}%`,
          "--my": `${spot.y}%`,
        } as CSSProperties
      }
    >
      {/* glass layers */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#3B1D63]/80 via-[#2D174A]/70 to-[#1A0B2E]/90" />
      <div className="pointer-events-none absolute inset-0 opacity-80 transition-opacity duration-[350ms] group-hover:opacity-100 bg-[radial-gradient(circle_at_var(--mx)_var(--my),rgba(168,85,247,0.35),transparent_55%)]" />
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/25 blur-2xl transition-all duration-[350ms] group-hover:bg-highlight/30" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-secondary/20 blur-2xl" />

      {cat.trending && (
        <span className="absolute right-3 top-3 z-20 inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary shadow-[0_0_16px_rgba(168,85,247,0.35)]">
          <Sparkles className="h-3 w-3" />
          Trending
        </span>
      )}

      <div className="relative z-10 flex flex-1 flex-col">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-[20px] border border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-transform duration-[350ms] group-hover:scale-105 group-hover:shadow-[0_0_28px_rgba(168,85,247,0.35)]">
            <CategoryIllustration slug={cat.slug} className="h-14 w-14 drop-shadow-[0_8px_16px_rgba(168,85,247,0.35)]" />
          </div>
          <BookStack books={related} />
        </div>

        <h3 className="text-[15px] font-extrabold tracking-tight text-white transition-colors duration-[350ms] group-hover:text-primary">
          {cat.name}
        </h3>
        <p className="mt-1 text-[11px] font-semibold text-primary/90">
          {liveCount.toLocaleString("vi-VN")} books
        </p>
        <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-text-secondary">
          {cat.description || "Khám phá tuyển chọn tinh hoa."}
        </p>

        <div className="mt-auto flex items-center justify-between pt-4 text-[11px] font-semibold text-muted transition-colors duration-[350ms] group-hover:text-white">
          <span>Explore</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all duration-[350ms] group-hover:border-primary/50 group-hover:bg-primary/20 group-hover:text-primary">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>

      {/* glowing border */}
      <div className="pointer-events-none absolute inset-0 rounded-[24px] ring-1 ring-inset ring-white/10 transition-shadow duration-[350ms] group-hover:ring-primary/50 group-hover:shadow-[0_0_0_1px_rgba(168,85,247,0.35),0_20px_50px_rgba(88,28,135,0.45)]" />
    </Link>
  );
}

export function CategoryGrid() {
  const books = useCatalog((s) => s.books);

  return (
    <section className="relative pt-24">
      {/* section ambient background */}
      <div className="pointer-events-none absolute inset-x-0 -top-10 bottom-0 overflow-hidden rounded-[32px]">
        <div className="absolute left-[8%] top-10 h-48 w-48 rounded-full bg-primary/20 blur-[80px]" />
        <div className="absolute right-[12%] top-24 h-56 w-56 rounded-full bg-highlight/15 blur-[90px]" />
        <div className="absolute bottom-10 left-1/3 h-40 w-40 rounded-full bg-secondary/20 blur-[70px]" />
        <div className="absolute left-[20%] top-[40%] h-3 w-3 rounded-full bg-primary/50 blur-[1px]" />
        <div className="absolute right-[28%] top-[30%] h-2 w-2 rounded-full bg-highlight/60" />
        <div className="absolute left-[55%] top-[18%] h-2.5 w-2.5 rounded-full bg-white/20" />
      </div>

      <div className="relative z-10">
        <div className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="section-kicker">Book Categories</p>
            <h2 className="section-title mt-3 text-4xl sm:text-5xl">BOOK CATEGORIES</h2>
            <p className="mt-4 text-base leading-relaxed text-text-secondary sm:text-lg">
              Discover thousands of books across every topic and interest.
            </p>
          </div>
          <Link href="/search" className="btn-primary inline-flex shrink-0 items-center gap-2 px-6 py-3 text-sm">
            View All Categories
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 xl:grid-cols-6">
          {categories.map((cat) => (
            <CategoryCard key={cat.id} cat={cat} books={books} />
          ))}
        </div>
      </div>
    </section>
  );
}
