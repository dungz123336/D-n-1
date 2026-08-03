"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { useCatalog } from "@/store/catalog";
import { BookCover } from "@/components/books/BookCover";

const slides = [
  {
    id: "s1",
    kicker: "Curated for 2026",
    title: "Không gian đọc\ncủa người tinh tế",
    subtitle:
      "Tuyển chọn sách tinh hoa — thiết kế immersive, trải nghiệm mua sắm editorial và ưu đãi thành viên.",
    cta: "Khám phá bộ sưu tập",
    href: "/search",
    badge: "NEW SEASON",
  },
  {
    id: "s2",
    kicker: "Mind & Craft",
    title: "Self-help & tư duy\ncho hành trình mới",
    subtitle:
      "Từ thói quen nguyên tử đến tâm lý tài chính — chọn sách theo mục tiêu, không theo ồn ào.",
    cta: "Xem Self-help",
    href: "/category/self-help",
    badge: "EDITOR’S PICK",
  },
  {
    id: "s3",
    kicker: "Future shelf",
    title: "AI · Startup\n· Công nghệ",
    subtitle:
      "Kệ sách cho người làm sản phẩm: AI, clean code, zero to one — cập nhật liên tục.",
    cta: "Vào kệ công nghệ",
    href: "/category/ai",
    badge: "TRENDING",
  },
];

export function HeroSlider() {
  const [index, setIndex] = useState(0);
  const books = useCatalog((s) => s.books);
  const slide = slides[index];
  const floatBooks = books.filter((b) => b.featured).slice(0, 3);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="pt-10 sm:pt-14">
      <div className="relative min-h-[520px] overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#23103A] via-[#2D174A] to-[#160726] p-7 sm:p-12 lg:p-14">
        {/* decorative grid / glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,rgba(168,85,247,0.28),transparent_50%)]" />
        <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-highlight/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-10 h-48 w-48 rounded-full bg-primary/25 blur-3xl" />

        <div className="relative z-10 grid items-center gap-12 lg:grid-cols-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.45 }}
            >
              <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-3.5 py-1.5 text-[11px] font-bold tracking-[0.14em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                {slide.badge}
              </span>
              <p className="section-kicker mb-3">{slide.kicker}</p>
              <h1 className="section-title whitespace-pre-line text-4xl sm:text-5xl lg:text-[3.4rem]">
                {slide.title}
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-text-secondary sm:text-[17px]">
                {slide.subtitle}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={slide.href} className="btn-primary inline-flex items-center gap-2 px-7 py-3.5 text-sm">
                  {slide.cta} <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/search?ai=1" className="btn-secondary inline-flex items-center gap-2 px-7 py-3.5 text-sm">
                  Gợi ý bằng AI
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="relative mx-auto flex h-[320px] w-full max-w-md items-end justify-center">
            {floatBooks.map((b, i) => (
              <div
                key={b.id}
                className={`absolute w-36 sm:w-44 ${
                  i === 0
                    ? "bottom-2 left-0 float -rotate-6"
                    : i === 1
                      ? "bottom-10 left-1/2 z-10 -translate-x-1/2 float-delay"
                      : "bottom-0 right-0 float rotate-6"
                }`}
              >
                <div className="rounded-[22px] p-[1px] bg-gradient-to-b from-primary/50 to-transparent">
                  <BookCover
                    title={b.title}
                    author={b.author}
                    gradient={b.coverGradient}
                    image={b.images?.[0]}
                    size="sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-10 flex gap-2">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-10 bg-primary shadow-[0_0_12px_rgba(168,85,247,0.8)]" : "w-2.5 bg-white/25"
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
