"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const FALLBACK =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#2D174A"/><stop offset="1" stop-color="#A855F7"/>
      </linearGradient></defs>
      <rect width="400" height="600" fill="url(#g)"/>
      <text x="200" y="300" text-anchor="middle" fill="#E9D5FF" font-family="Georgia,serif" font-size="22">BookNest</text>
    </svg>`
  );

type Props = {
  title: string;
  author: string;
  gradient: string;
  image?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
};

export function BookCover({ title, author, gradient, image, className, size = "md" }: Props) {
  // Lưu chính URL đã lỗi / đã tải xong (không phải cờ boolean) để khi `image` đổi
  // thì trạng thái tự reset — không cần effect.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const h =
    size === "sm" ? "h-44" : size === "lg" ? "h-80 sm:h-[28rem]" : "h-56 sm:h-60";

  const failed = Boolean(image) && failedSrc === image;
  const src = !failed && image ? image : FALLBACK;
  const loaded = loadedSrc === src;
  const showPhoto = Boolean(image) && !failed;

  return (
    <div
      className={cn(
        "book-cover-frame group/cover relative w-full overflow-hidden rounded-[18px]",
        "bg-[#1a0b2e] shadow-[0_14px_36px_rgba(0,0,0,0.45)]",
        "transition-all duration-350 ease-out",
        "group-hover:-translate-y-2 group-hover:shadow-[0_24px_48px_rgba(168,85,247,0.35)]",
        "group-hover:[transform:perspective(900px)_rotateY(-4deg)_translateY(-8px)]",
        h,
        className
      )}
    >
      {/* blur placeholder */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br transition-opacity duration-500",
          gradient || "from-[#2D174A] to-[#A855F7]",
          loaded && showPhoto ? "opacity-0" : "opacity-100"
        )}
      />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src}
        src={src}
        alt={`Bìa sách ${title}${author ? ` — ${author}` : ""}`}
        loading="lazy"
        decoding="async"
        className={cn(
          "absolute inset-0 h-full w-full object-contain p-1.5 transition-all duration-500",
          loaded ? "opacity-100 scale-100" : "opacity-0 scale-[0.98]"
        )}
        onLoad={(e) => {
          // Một số nguồn (vd Open Library) trả HTTP 200 kèm pixel trong suốt 1×1
          // thay vì 404 khi thiếu bìa. Ảnh đó decode được nên onError không chạy —
          // phải tự loại bỏ để lớp gradient + tên sách hiện ra.
          const img = e.currentTarget;
          if (img.naturalWidth <= 2 || img.naturalHeight <= 2) {
            setFailedSrc(image ?? null);
          }
          setLoadedSrc(src);
        }}
        onError={() => {
          setFailedSrc(image ?? null);
          setLoadedSrc(src);
        }}
      />

      {!showPhoto && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent p-3 pt-10">
          <p className="font-serif text-[10px] uppercase tracking-wider text-white/75 line-clamp-1">{author}</p>
          <p className="font-serif text-sm font-semibold leading-snug text-white line-clamp-2">{title}</p>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 rounded-[18px] ring-1 ring-inset ring-white/10 group-hover:ring-primary/40" />
      <div className="pointer-events-none absolute left-0 top-0 h-full w-2 bg-gradient-to-r from-black/40 to-transparent" />
    </div>
  );
}
