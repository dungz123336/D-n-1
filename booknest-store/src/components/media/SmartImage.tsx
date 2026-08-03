"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  src?: string;
  alt: string;
  className?: string;
  /** Class gradient Tailwind hiện ra khi ảnh lỗi (vd "from-violet-500 to-fuchsia-400"). */
  fallbackGradient?: string;
  /** Chữ hiện giữa ô fallback. Không truyền thì lấy chữ cái đầu của `alt`. */
  fallbackLabel?: string;
  loading?: "lazy" | "eager";
};

function initials(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * <img> có fallback gradient khi ảnh không tải được.
 *
 * Bắt cả 2 kiểu lỗi:
 * - Lỗi mạng / 404 → `onError`.
 * - Ảnh "rỗng" hợp lệ: vài CDN trả HTTP 200 kèm pixel trong suốt 1×1 khi thiếu
 *   ảnh. Trình duyệt decode được nên `onError` KHÔNG chạy → phải tự kiểm tra
 *   `naturalWidth/Height`, nếu không sẽ hiện một ô trống trông như ảnh vỡ.
 */
export function SmartImage({
  src,
  alt,
  className,
  fallbackGradient = "from-[#2D174A] to-[#A855F7]",
  fallbackLabel,
  loading = "lazy",
}: Props) {
  // Lưu chính URL đã lỗi (không phải cờ boolean) để khi `src` đổi thì trạng thái
  // lỗi tự hết — không cần effect reset.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = Boolean(src) && failedSrc === src;

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "flex items-center justify-center bg-gradient-to-br",
          fallbackGradient,
          className
        )}
      >
        <span className="font-serif text-lg font-semibold text-white/85">
          {fallbackLabel ?? initials(alt)}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      className={className}
      onLoad={(e) => {
        const img = e.currentTarget;
        if (img.naturalWidth <= 2 || img.naturalHeight <= 2) setFailedSrc(src);
      }}
      onError={() => setFailedSrc(src)}
    />
  );
}
