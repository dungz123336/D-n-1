"use client";

import { HeroSlider } from "@/components/home/HeroSlider";
import { FlashSale } from "@/components/home/FlashSale";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { BookSection } from "@/components/home/BookSection";
import { AuthorsSection } from "@/components/home/AuthorsSection";
import { BlogSection } from "@/components/home/BlogSection";
import { ReviewsStrip } from "@/components/home/ReviewsStrip";
import { useCatalog } from "@/store/catalog";

export default function HomePage() {
  const books = useCatalog((s) => s.books);
  const featured = books.filter((b) => b.featured);
  const bestseller = books.filter((b) => b.bestseller);
  const newArrivals = books.filter((b) => b.newArrival);
  const recommended = [...books]
    .sort((a, b) => b.rating * b.sold - a.rating * a.sold)
    .slice(0, 10);

  return (
    <>
      <HeroSlider />
      <FlashSale />
      <CategoryGrid />
      <BookSection title="Tuyển chọn nổi bật" subtitle="Featured shelf" books={featured} href="/search?featured=1" />
      <BookSection title="Bestseller" subtitle="Most loved" books={bestseller} carousel href="/search?bestseller=1" />
      <BookSection title="Mới về kệ" subtitle="Arrivals" books={newArrivals} href="/search?new=1" />
      <BookSection title="Dành cho bạn" subtitle="AI curated" books={recommended} carousel href="/search?ai=1" />
      <AuthorsSection />
      <BlogSection />
      <ReviewsStrip />

      <section className="pt-20 pb-6">
        <div className="relative overflow-hidden rounded-[28px] border border-primary/30 bg-gradient-to-br from-[#2D174A] via-[#23103A] to-[#160726] p-10 sm:p-14">
          <div className="pointer-events-none absolute -right-16 top-0 h-64 w-64 rounded-full bg-primary/30 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-10 h-40 w-40 rounded-full bg-highlight/20 blur-3xl" />
          <div className="relative max-w-2xl">
            <p className="section-kicker">Membership</p>
            <h2 className="section-title mt-3 text-3xl sm:text-4xl">
              Hạng thành viên tinh gọn
            </h2>
            <p className="mt-4 text-base leading-relaxed text-text-secondary">
              Bronze → Silver → Gold → Diamond. Tích điểm, early access flash, gift card và ưu đãi editorial.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-text-secondary">
                + điểm mỗi đơn
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-text-secondary">
                Affiliate
              </span>
              <span className="rounded-full border border-primary/40 bg-primary/20 px-4 py-2 text-sm font-semibold text-primary">
                Gold privileges
              </span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
