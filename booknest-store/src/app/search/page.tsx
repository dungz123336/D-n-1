"use client";

import { useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BookCard } from "@/components/books/BookCard";
import { SearchBar } from "@/components/layout/SearchBar";
import { useCatalog } from "@/store/catalog";

function SearchResults() {
  const params = useSearchParams();
  const q = params.get("q") || "";
  const featured = params.get("featured");
  const bestseller = params.get("bestseller");
  const isNew = params.get("new");
  const sale = params.get("sale");
  const ai = params.get("ai");
  const books = useCatalog((s) => s.books);
  const search = useCatalog((s) => s.search);

  const results = useMemo(() => {
    let list = q ? search(q) : [...books];
    if (featured) list = list.filter((b) => b.featured);
    if (bestseller) list = list.filter((b) => b.bestseller);
    if (isNew) list = list.filter((b) => b.newArrival);
    if (sale) list = list.filter((b) => b.flashSale || b.discount > 0);
    if (ai)
      list = [...list].sort(
        (a, b) => b.rating * Math.log10(b.sold + 1) - a.rating * Math.log10(a.sold + 1)
      );
    return list;
  }, [q, featured, bestseller, isNew, sale, ai, books, search]);

  return (
    <div className="py-10">
      <h1 className="section-title text-3xl">Tìm kiếm</h1>
      <p className="mt-1 text-sm text-muted">
        {q ? (
          <>
            Kết quả cho “<b>{q}</b>” · {results.length} sách
          </>
        ) : (
          <>{results.length} sách</>
        )}
      </p>
      <div className="mt-4 max-w-2xl">
        <SearchBar />
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {results.map((b) => (
          <BookCard key={b.id} book={b} />
        ))}
      </div>
      {results.length === 0 && (
        <p className="mt-10 text-center text-muted">Không tìm thấy sách phù hợp.</p>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-muted">Đang tải...</div>}>
      <SearchResults />
    </Suspense>
  );
}
