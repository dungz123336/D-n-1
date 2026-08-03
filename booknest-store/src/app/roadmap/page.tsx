"use client";

import { useMemo, useState } from "react";
import { BookCard } from "@/components/books/BookCard";
import { useCatalog } from "@/store/catalog";
import { useMemory } from "@/store/memory";
import { formatVND } from "@/lib/utils";

type Form = {
  career: string;
  goal: string;
  level: string;
  budget: string;
  hours: string;
  language: string;
};

export default function RoadmapPage() {
  const books = useCatalog((s) => s.books);
  const trackInterest = useMemory((s) => s.trackInterest);
  const [form, setForm] = useState<Form>({
    career: "AI Engineer",
    goal: "Nắm nền tảng AI & Python trong 3 tháng",
    level: "beginner",
    budget: "700000",
    hours: "5",
    language: "any",
  });
  const [saved, setSaved] = useState(false);

  const roadmap = useMemo(() => {
    const budget = Number(form.budget) || 700000;
    const topic = `${form.career} ${form.goal} ${form.level}`.toLowerCase();
    const tokens = topic.split(/\s+/);

    const scored = books
      .map((b) => {
        const blob = `${b.title} ${b.category} ${b.tags.join(" ")} ${b.summary}`.toLowerCase();
        let s = tokens.reduce((acc, t) => (t.length > 2 && blob.includes(t) ? acc + 1 : acc), 0);
        if (form.level === "beginner" && (blob.includes("cơ bản") || blob.includes("beginner"))) s += 2;
        if (form.language === "en" && b.language?.toLowerCase().includes("english")) s += 2;
        s += b.rating;
        return { b, s };
      })
      .sort((a, b) => b.s - a.s);

    const picks: typeof books = [];
    let sum = 0;
    for (const { b } of scored) {
      if (sum + b.salePrice > budget && picks.length >= 2) continue;
      if (picks.some((p) => p.id === b.id)) continue;
      picks.push(b);
      sum += b.salePrice;
      if (picks.length >= 4) break;
    }

    const months = picks.map((b, i) => ({
      month: i + 1,
      book: b,
      practice:
        i === 0
          ? "Ghi chú 3 ý/chương + 1 mini exercise"
          : i === 1
            ? "Làm 1 project nhỏ áp dụng chương chính"
            : "Review + chia sẻ 5 takeaways",
    }));

    return { picks, sum, months };
  }, [form, books]);

  const save = () => {
    localStorage.setItem(
      "booknest-roadmap",
      JSON.stringify({ form, bookIds: roadmap.picks.map((b) => b.id), at: Date.now() })
    );
    trackInterest(form.career);
    setSaved(true);
  };

  return (
    <div className="py-10">
      <p className="section-kicker">AI Reading Roadmap</p>
      <h1 className="section-title mt-2 text-4xl sm:text-5xl">Lộ trình đọc cá nhân hóa</h1>
      <p className="mt-3 max-w-2xl text-text-secondary">
        Mô tả nghề nghiệp, mục tiêu, trình độ và ngân sách — AI dựng roadmap theo tháng kèm sách BookNest thật.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[340px_1fr]">
        <form
          className="glass h-fit space-y-3 rounded-[24px] p-5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          {(
            [
              ["career", "Nghề / hướng đi", "AI Engineer"],
              ["goal", "Mục tiêu", "Nắm nền tảng AI"],
              ["budget", "Ngân sách (VND)", "700000"],
              ["hours", "Giờ đọc / tuần", "5"],
            ] as const
          ).map(([key, label, ph]) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-semibold text-muted">{label}</label>
              <input
                className="admin-input"
                value={form[key]}
                placeholder={ph}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Trình độ</label>
            <select
              className="admin-input"
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Ngôn ngữ</label>
            <select
              className="admin-input"
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
            >
              <option value="any">Linh hoạt</option>
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </div>
          <button type="submit" className="btn-primary w-full py-3 text-sm">
            Tạo & lưu lộ trình
          </button>
          {saved && <p className="text-xs text-primary">Đã lưu trên thiết bị — mở lại trang này để xem.</p>}
        </form>

        <div>
          <div className="glass mb-6 rounded-[24px] p-5">
            <h2 className="section-title text-2xl">Roadmap: {form.career}</h2>
            <p className="mt-1 text-sm text-muted">
              Mục tiêu: {form.goal} · Tổng sách ~ {formatVND(roadmap.sum)} / budget {formatVND(Number(form.budget) || 0)}
            </p>
            <ol className="mt-5 space-y-4">
              {roadmap.months.map((m) => (
                <li key={m.month} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">Tháng {m.month}</p>
                  <p className="mt-1 font-bold text-white">{m.book.title}</p>
                  <p className="text-sm text-muted">
                    {m.book.author} · {formatVND(m.book.salePrice)}
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">Practice: {m.practice}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {roadmap.picks.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
