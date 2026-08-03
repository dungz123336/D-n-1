"use client";

import { useMemo, useState } from "react";
import { Gift, Sparkles } from "lucide-react";
import { useCatalog } from "@/store/catalog";
import { useCart } from "@/store/cart";
import { BookCover } from "@/components/books/BookCover";
import { formatVND } from "@/lib/utils";

const BOXES = [
  { id: "beginner", name: "Beginner Box", tags: ["self-help", "english", "thiếu nhi"], budget: 350000 },
  { id: "startup", name: "Startup Box", tags: ["startup", "kinh doanh", "tài chính"], budget: 500000 },
  { id: "ai", name: "AI Box", tags: ["ai", "lập trình", "công nghệ"], budget: 600000 },
  { id: "selfhelp", name: "Self-Help Box", tags: ["self-help", "tâm lý"], budget: 400000 },
  { id: "kids", name: "Kids Box", tags: ["thiếu nhi", "comics"], budget: 300000 },
  { id: "fantasy", name: "Fantasy Box", tags: ["tiểu thuyết", "comics"], budget: 380000 },
  { id: "business", name: "Business Box", tags: ["kinh doanh", "tài chính"], budget: 550000 },
  { id: "premium", name: "Premium Collector", tags: ["khoa học", "lịch sử", "ai"], budget: 900000 },
];

export default function MysteryBoxPage() {
  const books = useCatalog((s) => s.books);
  const add = useCart((s) => s.add);
  const [boxId, setBoxId] = useState("ai");
  const [lang, setLang] = useState("any");
  const [revealed, setRevealed] = useState(false);

  const box = BOXES.find((b) => b.id === boxId)!;

  const picks = useMemo(() => {
    const list = books
      .filter((b) => {
        const blob = `${b.category} ${b.tags.join(" ")}`.toLowerCase();
        const okTag = box.tags.some((t) => blob.includes(t));
        const okLang =
          lang === "any" ||
          (lang === "en" && b.language?.toLowerCase().includes("english")) ||
          (lang === "vi" && !b.language?.toLowerCase().includes("english"));
        return okTag && okLang;
      })
      .sort((a, b) => b.rating - a.rating);

    const out = [];
    let sum = 0;
    for (const b of list) {
      if (sum + b.salePrice > box.budget && out.length >= 2) continue;
      out.push(b);
      sum += b.salePrice;
      if (out.length >= 3) break;
    }
    return { out, sum };
  }, [books, box, lang]);

  return (
    <div className="py-10">
      <p className="section-kicker">Mystery Book Box</p>
      <h1 className="section-title mt-2 text-4xl sm:text-5xl">Hộp sách bí ẩn</h1>
      <p className="mt-3 max-w-2xl text-text-secondary">
        Chọn gu đọc & ngân sách — AI đóng hộp 2–3 cuốn bất ngờ (vẫn hiện preview trước khi chốt).
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {BOXES.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => {
              setBoxId(b.id);
              setRevealed(false);
            }}
            className={`rounded-[20px] border p-4 text-left transition ${
              boxId === b.id
                ? "border-primary bg-primary/20 shadow-[0_0_24px_rgba(168,85,247,0.25)]"
                : "border-white/10 bg-white/5 hover:border-primary/30"
            }`}
          >
            <Gift className="h-5 w-5 text-primary" />
            <p className="mt-2 font-bold text-white">{b.name}</p>
            <p className="text-xs text-muted">Budget ~ {formatVND(b.budget)}</p>
          </button>
        ))}
      </div>

      <div className="glass mt-8 rounded-[24px] p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="section-title text-2xl">{box.name}</h2>
            <p className="text-sm text-muted">Ngôn ngữ ưu tiên & sở thích được AI trộn ngẫu nhiên có kiểm soát.</p>
          </div>
          <select className="admin-input !w-auto" value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="any">Mọi ngôn ngữ</option>
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </div>

        <button
          type="button"
          className="btn-primary mt-5 inline-flex items-center gap-2 px-5 py-3 text-sm"
          onClick={() => setRevealed(true)}
        >
          <Sparkles className="h-4 w-4" /> Mở hộp
        </button>

        {revealed && (
          <div className="mt-6">
            <p className="text-sm text-text-secondary">
              Hộp gồm {picks.out.length} cuốn · ~{formatVND(picks.sum)}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
              {picks.out.map((b) => (
                <div key={b.id} className="rounded-[20px] border border-white/10 bg-white/5 p-3">
                  <BookCover
                    title={b.title}
                    author={b.author}
                    gradient={b.coverGradient}
                    image={b.images?.[0]}
                    size="sm"
                  />
                  <p className="mt-2 text-sm font-bold text-white">{b.title}</p>
                  <p className="text-xs text-muted">{formatVND(b.salePrice)}</p>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn-primary mt-5 px-5 py-3 text-sm"
              onClick={() => picks.out.forEach((b) => add(b.id))}
            >
              Thêm cả hộp vào giỏ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
