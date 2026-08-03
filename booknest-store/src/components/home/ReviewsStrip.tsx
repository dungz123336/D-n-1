"use client";

import { Star } from "lucide-react";
import { reviews } from "@/data/content";
import { useCatalog } from "@/store/catalog";

export function ReviewsStrip() {
  const getById = useCatalog((s) => s.getById);
  return (
    <section className="pt-20">
      <div className="mb-10">
        <p className="section-kicker">Community</p>
        <h2 className="section-title mt-2 text-3xl sm:text-4xl">Cảm nhận độc giả</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {reviews.map((r) => {
          const book = getById(r.bookId);
          return (
            <div key={r.id} className="glass rounded-[24px] p-6">
              <div className="mb-3 flex gap-0.5">
                {Array.from({ length: r.rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-sm leading-relaxed text-text-secondary">
                “{r.comment}”
              </p>
              <p className="mt-4 text-xs font-semibold text-white">
                {r.userName}
                <span className="font-normal text-muted"> · {book?.title}</span>
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
