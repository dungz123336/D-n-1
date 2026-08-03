"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useCatalog } from "@/store/catalog";
import { formatVND, cn } from "@/lib/utils";
import { BookCover } from "@/components/books/BookCover";
import type { Book } from "@/types";

export default function ComparePage() {
  const books = useCatalog((s) => s.books);
  const [ids, setIds] = useState<number[]>(() =>
    [books[0]?.id, books[1]?.id, books[2]?.id].filter(Boolean) as number[]
  );
  const [q, setQ] = useState("");

  const selected = useMemo(
    () => ids.map((id) => books.find((b) => b.id === id)).filter((x): x is Book => Boolean(x)),
    [ids, books]
  );

  const picker = useMemo(() => {
    const n = q.trim().toLowerCase();
    const list = n
      ? books.filter(
          (b) =>
            b.title.toLowerCase().includes(n) ||
            b.author.toLowerCase().includes(n) ||
            b.category.toLowerCase().includes(n)
        )
      : books;
    return list.slice(0, 24);
  }, [books, q]);

  const toggle = (id: number) => {
    setIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  };

  const aiVerdict = useMemo(() => {
    if (selected.length < 2) return "Chọn ít nhất 2 cuốn để AI so sánh.";
    const bestValue = [...selected].sort(
      (a, b) => a!.salePrice / Math.max(a!.rating, 1) - b!.salePrice / Math.max(b!.rating, 1)
    )[0]!;
    const bestRated = [...selected].sort((a, b) => b!.rating - a!.rating)[0]!;
    const bestseller = [...selected].sort((a, b) => b!.sold - a!.sold)[0]!;
    return (
      `**Nên mua nếu tối ưu giá/điểm:** ${bestValue.title} (${formatVND(bestValue.salePrice)}). ` +
      `**Cao rating nhất:** ${bestRated.title} (★${bestRated.rating}). ` +
      `**Bán chạy nhất:** ${bestseller.title}. ` +
      `Độc giả: ${selected.map((b) => `${b!.title} → ${(b!.tags || []).slice(0, 2).join("/") || b!.category}`).join("; ")}.`
    );
  }, [selected]);

  return (
    <div className="py-10">
      <p className="section-kicker">AI Compare</p>
      <h1 className="section-title mt-2 text-4xl">So sánh 2–5 cuốn sách</h1>
      <p className="mt-2 text-text-secondary">
        Tóm tắt AI · điểm mạnh / yếu · độc giả lý tưởng · gợi ý mua.
      </p>

      <div className="mt-6">
        <input
          className="admin-input max-w-md"
          placeholder="Lọc sách để thêm vào so sánh…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <p className="mt-2 text-xs text-muted">Đã chọn {ids.length}/5</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {picker.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => toggle(b.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition",
                ids.includes(b.id)
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-white/10 text-muted hover:border-primary/30"
              )}
            >
              {b.title}
            </button>
          ))}
        </div>
      </div>

      <div className="glass mt-6 rounded-[24px] p-5">
        <p className="flex items-center gap-2 text-sm font-bold text-primary">
          <Sparkles className="h-4 w-4" /> AI verdict
        </p>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">{aiVerdict}</p>
      </div>

      {selected.length >= 2 ? (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-3 text-left text-muted">Tiêu chí</th>
                {selected.map((b) => (
                  <th key={b!.id} className="p-3 text-left align-top">
                    <div className="w-28">
                      <BookCover
                        title={b!.title}
                        author={b!.author}
                        gradient={b!.coverGradient}
                        image={b!.images?.[0]}
                        size="sm"
                        className="!h-36"
                      />
                    </div>
                    <Link
                      href={`/books/${b!.slug}`}
                      className="mt-2 block font-bold text-white hover:text-primary"
                    >
                      {b!.title}
                    </Link>
                    <button
                      type="button"
                      className="mt-1 text-[11px] text-highlight"
                      onClick={() => toggle(b!.id)}
                    >
                      Gỡ
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-text-secondary">
              {(
                [
                  ["Giá", (b: Book) => formatVND(b.salePrice)],
                  ["Giảm", (b: Book) => (b.discount ? `-${b.discount}%` : "—")],
                  ["Rating", (b: Book) => `★ ${b.rating} (${b.reviewCount})`],
                  ["Thể loại", (b: Book) => b.category],
                  ["Tác giả", (b: Book) => b.author],
                  ["Năm XB", (b: Book) => b.publishYear],
                  ["Trang", (b: Book) => `${b.pages} trang`],
                  ["Tồn kho", (b: Book) => `${b.stock} cuốn`],
                  ["Đã bán", (b: Book) => String(b.sold)],
                  ["Tóm tắt AI", (b: Book) => b.summary.slice(0, 100) + "…"],
                  [
                    "Điểm mạnh",
                    (b: Book) =>
                      b.bestseller
                        ? "Bestseller, social proof mạnh"
                        : b.rating >= 4.7
                          ? "Rating rất cao, review tin cậy"
                          : b.discount > 15
                            ? "Giá tốt, đang khuyến mãi"
                            : "Nội dung đúng niche",
                  ],
                  [
                    "Điểm yếu",
                    (b: Book) =>
                      b.stock <= 3
                        ? "Sắp hết hàng"
                        : b.pages > 400
                          ? "Dày, cần thời gian đọc"
                          : b.price - b.salePrice < 10000
                            ? "Ít giảm giá"
                            : "Cạnh tranh nhiều đầu tương tự",
                  ],
                  [
                    "Độc giả lý tưởng",
                    (b: Book) => (b.tags || []).slice(0, 4).join(", ") || b.subCategory,
                  ],
                  [
                    "Gợi ý mua",
                    (b: Book) =>
                      b.discount > 15
                        ? "Nên mua ngay — đang giảm sâu"
                        : b.bestseller
                          ? "An toàn cho quà / starter"
                          : b.stock <= 5
                            ? "Chốt sớm nếu đúng gu"
                            : "Phù hợp nếu khớp nhu cầu",
                  ],
                ] as [string, (b: Book) => string][]
              ).map(([label, fn]) => (
                <tr key={label} className="border-t border-white/10">
                  <td className="p-3 font-semibold text-white">{label}</td>
                  {selected.map((b) => (
                    <td key={b!.id} className="p-3 align-top">
                      {fn(b)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-10 text-center text-muted">Chọn 2–5 sách ở trên để bắt đầu so sánh.</p>
      )}
    </div>
  );
}
