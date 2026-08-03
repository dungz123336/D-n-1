"use client";

import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import type { Book } from "@/types";
import { BookCard } from "@/components/books/BookCard";

type Props = {
  title: string;
  subtitle?: string;
  books: Book[];
  href?: string;
  carousel?: boolean;
};

export function BookSection({ title, subtitle, books, href = "/search", carousel }: Props) {
  return (
    <section className="pt-20">
      <div className="mb-10 flex items-end justify-between gap-4">
        <div>
          {subtitle && <p className="section-kicker">{subtitle}</p>}
          <h2 className="section-title mt-2 text-3xl sm:text-4xl">{title}</h2>
        </div>
        <Link href={href} className="text-sm font-semibold text-primary transition hover:text-highlight">
          Xem thêm →
        </Link>
      </div>

      {carousel ? (
        <Swiper
          modules={[Autoplay, Pagination]}
          spaceBetween={18}
          slidesPerView={1.25}
          pagination={{ clickable: true }}
          autoplay={{ delay: 3800, disableOnInteraction: false }}
          breakpoints={{
            480: { slidesPerView: 2.1 },
            768: { slidesPerView: 3.1 },
            1024: { slidesPerView: 4.1 },
            1280: { slidesPerView: 5 },
          }}
          className="!pb-12"
        >
          {books.map((b) => (
            <SwiperSlide key={b.id}>
              <BookCard book={b} />
            </SwiperSlide>
          ))}
        </Swiper>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {books.map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </div>
      )}
    </section>
  );
}
