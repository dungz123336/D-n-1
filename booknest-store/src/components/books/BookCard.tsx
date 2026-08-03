"use client";

import Link from "next/link";
import { Heart, Eye, ShoppingCart, Star } from "lucide-react";
import type { Book } from "@/types";
import { BookCover } from "./BookCover";
import { formatSold, formatVND, cn } from "@/lib/utils";
import { useCart } from "@/store/cart";
import { useWishlist } from "@/store/wishlist";

type Props = {
  book: Book;
  className?: string;
};

export function BookCard({ book, className }: Props) {
  const add = useCart((s) => s.add);
  const toggle = useWishlist((s) => s.toggle);
  const liked = useWishlist((s) => s.ids.includes(book.id));
  const cover = book.images?.[0];

  return (
    <article
      className={cn(
        "group glass relative flex flex-col rounded-[24px] p-3.5 transition-all duration-300 hover:border-primary/30",
        className
      )}
    >
      {book.discount > 0 && (
        <span className="absolute left-5 top-5 z-10 rounded-full bg-gradient-to-r from-highlight to-primary px-2.5 py-1 text-[11px] font-bold text-white shadow-[0_0_16px_rgba(236,72,153,0.45)]">
          -{book.discount}%
        </span>
      )}
      <button
        type="button"
        onClick={() => toggle(book.id)}
        className={cn(
          "absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#160726]/70 backdrop-blur transition hover:scale-110",
          liked ? "text-highlight" : "text-muted"
        )}
        aria-label="Wishlist"
      >
        <Heart className={cn("h-4 w-4", liked && "fill-current")} />
      </button>

      <Link href={`/books/${book.slug}`} className="block">
        <BookCover
          key={`${book.id}-${book.updatedAt}-${cover?.slice(0, 48)}`}
          title={book.title}
          author={book.author}
          gradient={book.coverGradient}
          image={cover}
        />
      </Link>

      <div className="mt-3.5 flex flex-1 flex-col gap-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
          {book.category}
        </p>
        <Link
          href={`/books/${book.slug}`}
          className="line-clamp-2 text-sm font-bold leading-snug text-white transition hover:text-primary"
        >
          {book.title}
        </Link>
        <p className="text-xs text-muted">{book.author}</p>

        <div className="mt-1 flex items-center gap-1.5 text-xs text-text-secondary">
          <Star className="h-3.5 w-3.5 fill-primary text-primary" />
          <span className="font-semibold text-white">{book.rating}</span>
          <span className="text-muted">({book.reviewCount})</span>
          <span className="text-muted">· {formatSold(book.sold)}</span>
        </div>

        <div className="mt-1.5 flex items-end gap-2">
          <span className="text-base font-extrabold text-white">
            {formatVND(book.salePrice)}
          </span>
          {book.discount > 0 && (
            <span className="text-xs text-muted line-through">{formatVND(book.price)}</span>
          )}
        </div>

        <div className="mt-auto flex gap-2 pt-3 opacity-100 transition-all duration-300 sm:translate-y-1 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100">
          <Link
            href={`/books/${book.slug}`}
            className="btn-secondary flex h-10 flex-1 items-center justify-center gap-1 text-xs"
          >
            <Eye className="h-3.5 w-3.5" /> Xem
          </Link>
          <button
            type="button"
            onClick={() => add(book.id)}
            className="btn-primary flex h-10 flex-1 items-center justify-center gap-1 px-2 text-xs"
          >
            <ShoppingCart className="h-3.5 w-3.5" /> Giỏ
          </button>
        </div>
      </div>
    </article>
  );
}
