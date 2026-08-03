"use client";

import { use } from "react";
import Link from "next/link";
import { categories } from "@/data/categories";
import { BookCard } from "@/components/books/BookCard";
import { useCatalog } from "@/store/catalog";

export default function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const books = useCatalog((s) => s.books);
  const cat = categories.find((c) => c.slug === slug);

  const list = books.filter((b) => {
    const blob = `${b.category} ${b.subCategory} ${b.tags.join(" ")}`.toLowerCase();
    if (cat) {
      const name = cat.name.toLowerCase();
      const s = cat.slug.replace(/-/g, " ");
      return blob.includes(name) || blob.includes(s) || name.includes(b.category.toLowerCase().slice(0, 4));
    }
    return blob.includes(slug.replace(/-/g, " "));
  });

  const display = list.length ? list : books.slice(0, 10);

  return (
    <div className="py-10">
      <nav className="mb-4 text-xs text-muted">
        <Link href="/" className="hover:text-primary">
          Trang chủ
        </Link>{" "}
        / Danh mục
      </nav>
      <div className="mb-6 flex items-center gap-3">
        {cat && (
          <span
            className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl text-white shadow ${cat.gradient}`}
          >
            {cat.icon}
          </span>
        )}
        <div>
          <h1 className="section-title text-3xl">{cat?.name || slug}</h1>
          <p className="text-sm text-muted">{display.length} sản phẩm</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {display.map((b) => (
          <BookCard key={b.id} book={b} />
        ))}
      </div>
    </div>
  );
}
