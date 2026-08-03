"use client";

import { useMemo, useState } from "react";
import { Copy, Users } from "lucide-react";
import { useCatalog } from "@/store/catalog";
import { formatVND } from "@/lib/utils";

export default function GroupBuyPage() {
  const books = useCatalog((s) => s.books);
  const [bookId, setBookId] = useState(books[0]?.id || 1);
  const [members, setMembers] = useState(3);
  const [copied, setCopied] = useState(false);

  const book = books.find((b) => b.id === bookId) || books[0];
  const deal = useMemo(() => {
    let percent = 5;
    if (members >= 5) percent = 10;
    if (members >= 10) percent = 20;
    const unit = Math.round(book.salePrice * (1 - percent / 100));
    return { percent, unit, total: unit * members, save: book.salePrice * members - unit * members };
  }, [book, members]);

  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/group-buy?book=${bookId}&m=${members}`
      : `/group-buy?book=${bookId}`;

  return (
    <div className="py-10">
      <p className="section-kicker">Group purchase</p>
      <h1 className="section-title mt-2 text-4xl">Mua chung · chia ship · mở bulk</h1>
      <p className="mt-3 max-w-2xl text-text-secondary">
        Mời bạn bè, chốt số lượng, mở mức giảm 5% / 10% / 20% theo 3 · 5 · 10 người. Organizer nhận badge điểm thưởng.
      </p>

      <div className="glass mt-8 grid gap-6 rounded-[24px] p-6 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="text-xs font-semibold text-muted">Chọn sách</label>
          <select
            className="admin-input"
            value={bookId}
            onChange={(e) => setBookId(Number(e.target.value))}
          >
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title} — {formatVND(b.salePrice)}
              </option>
            ))}
          </select>
          <label className="text-xs font-semibold text-muted">Số thành viên</label>
          <input
            type="range"
            min={2}
            max={20}
            value={members}
            onChange={(e) => setMembers(Number(e.target.value))}
            className="w-full"
          />
          <p className="text-sm text-white">{members} người tham gia</p>
        </div>
        <div className="rounded-[20px] border border-primary/30 bg-primary/10 p-5">
          <Users className="h-6 w-6 text-primary" />
          <p className="mt-3 text-lg font-bold text-white">{book?.title}</p>
          <p className="mt-2 text-sm text-text-secondary">
            Giá lẻ {formatVND(book?.salePrice || 0)} → group{" "}
            <strong className="text-primary">{formatVND(deal.unit)}</strong> (−{deal.percent}%)
          </p>
          <p className="mt-1 text-sm text-muted">
            Tổng nhóm {formatVND(deal.total)} · tiết kiệm {formatVND(deal.save)}
          </p>
          <p className="mt-1 text-sm text-muted">Ship gộp 1 địa chỉ hoặc chia 2 điểm (+15k).</p>
          <button
            type="button"
            className="btn-primary mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-sm"
            onClick={() => {
              navigator.clipboard?.writeText(link);
              setCopied(true);
              const groups = JSON.parse(localStorage.getItem("booknest-groups") || "[]");
              groups.unshift({ bookId, members, link, at: Date.now(), status: "open" });
              localStorage.setItem("booknest-groups", JSON.stringify(groups.slice(0, 20)));
            }}
          >
            <Copy className="h-4 w-4" /> {copied ? "Đã copy link" : "Tạo & copy link mời"}
          </button>
        </div>
      </div>
    </div>
  );
}
