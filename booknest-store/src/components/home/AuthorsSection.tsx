"use client";

import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import { ArrowRight, Star, Users } from "lucide-react";
import { authors } from "@/data/authors";
import { SmartImage } from "@/components/media/SmartImage";
import { cn } from "@/lib/utils";

const badgeColor: Record<string, string> = {
  "Best Seller": "bg-amber-400/20 text-amber-200 border-amber-400/30",
  Trending: "bg-highlight/20 text-highlight border-highlight/30",
  "Editor's Choice": "bg-primary/20 text-primary border-primary/30",
  "Award Winner": "bg-violet-400/20 text-violet-200 border-violet-400/30",
  "New Release": "bg-cyan-400/20 text-cyan-200 border-cyan-400/30",
  "Most Loved": "bg-pink-400/20 text-pink-200 border-pink-400/30",
};

export function AuthorsSection() {
  const featured = [...authors]
    .sort((a, b) => b.followers - a.followers)
    .slice(0, 12);

  return (
    <section className="relative pt-24">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-10 top-10 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute right-20 top-20 h-48 w-48 rounded-full bg-highlight/10 blur-3xl" />
      </div>

      <div className="relative z-10 mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker">Featured Authors</p>
          <h2 className="section-title mt-2 text-3xl sm:text-4xl">Tác giả tiêu biểu</h2>
          <p className="mt-2 max-w-xl text-text-secondary">
            Chân dung editorial · bestseller · trending · follow để nhận sách mới.
          </p>
        </div>
        <Link href="/authors" className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm">
          Tất cả tác giả <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <Swiper
        modules={[Autoplay, Navigation, Pagination]}
        spaceBetween={18}
        slidesPerView={1.15}
        pagination={{ clickable: true }}
        autoplay={{ delay: 4000, disableOnInteraction: false }}
        breakpoints={{
          520: { slidesPerView: 1.6 },
          768: { slidesPerView: 2.3 },
          1024: { slidesPerView: 3.2 },
          1280: { slidesPerView: 4 },
        }}
        className="!pb-12"
      >
        {featured.map((a) => (
          <SwiperSlide key={a.id}>
            <article className="group glass flex h-full flex-col overflow-hidden rounded-[24px] transition duration-300 hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-[0_20px_50px_rgba(168,85,247,0.2)]">
              <div className="relative h-40 overflow-hidden">
                <SmartImage
                  src={a.portrait}
                  alt={a.name}
                  fallbackGradient={a.avatarGradient}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#160726] via-[#160726]/20 to-transparent" />
                <div className="absolute bottom-3 left-3 flex flex-wrap gap-1">
                  {a.badges.slice(0, 2).map((b) => (
                    <span
                      key={b}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                        badgeColor[b] || "bg-white/10 text-white border-white/20"
                      )}
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-lg font-bold text-white">{a.name}</h3>
                <p className="text-xs text-primary">{a.nationality}</p>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-text-secondary">{a.bio}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-primary text-primary" /> {a.avgRating}
                  </span>
                  <span>{a.bookCount} books</span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {(a.followers / 1000).toFixed(1)}k
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-muted">{a.categories.join(" · ")}</p>
                <Link
                  href={`/authors/${a.slug}`}
                  className="btn-secondary mt-auto inline-flex justify-center py-2.5 text-xs"
                >
                  View Profile
                </Link>
              </div>
            </article>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}
