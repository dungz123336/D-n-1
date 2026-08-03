"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  Heart,
  Menu,
  ShoppingBag,
  User,
  X,
} from "lucide-react";
import { categories } from "@/data/categories";
import { SearchBar } from "./SearchBar";
import { useCart } from "@/store/cart";
import { useWishlist } from "@/store/wishlist";
import { useCatalog } from "@/store/catalog";
import { cn } from "@/lib/utils";

export function Header() {
  const [mega, setMega] = useState(false);
  const [mobile, setMobile] = useState(false);
  const cartCount = useCart((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const wishCount = useWishlist((s) => s.ids.length);
  const isAdmin = useCatalog((s) => s.isAdmin);

  return (
    <header className="sticky top-0 z-50 pt-4">
      <div className="nav-pill mx-auto flex max-w-[1400px] items-center gap-3 rounded-full px-3 py-2.5 sm:px-5 lg:gap-5">
        <button
          type="button"
          className="rounded-full p-2 text-white/80 hover:bg-white/10 lg:hidden"
          onClick={() => setMobile(true)}
          aria-label="Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link href="/" className="flex shrink-0 items-center gap-2.5 pl-1">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-highlight text-white shadow-[0_0_24px_rgba(168,85,247,0.45)]">
            <BookOpen className="h-5 w-5" />
          </span>
          <div className="hidden sm:block">
            <p className="text-[15px] font-extrabold tracking-tight text-white">BookNest</p>
            <p className="text-[10px] font-medium tracking-[0.16em] uppercase text-muted">
              Editorial
            </p>
          </div>
        </Link>

        <nav className="ml-2 hidden items-center gap-0.5 xl:flex">
          <Link href="/search" className="rounded-full px-2.5 py-2 text-sm font-medium text-text-secondary transition hover:bg-white/5 hover:text-white">
            Khám phá
          </Link>
          <button
            type="button"
            onMouseEnter={() => setMega(true)}
            onClick={() => setMega((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-2 text-sm font-medium text-text-secondary transition hover:bg-white/5 hover:text-white"
          >
            Danh mục
            <ChevronDown className={cn("h-4 w-4 transition", mega && "rotate-180")} />
          </button>
          <Link href="/trending" className="rounded-full px-2.5 py-2 text-sm font-medium text-text-secondary transition hover:bg-white/5 hover:text-white">
            Trending
          </Link>
          <Link href="/authors" className="rounded-full px-2.5 py-2 text-sm font-medium text-text-secondary transition hover:bg-white/5 hover:text-white">
            Tác giả
          </Link>
          <Link href="/roadmap" className="rounded-full px-2.5 py-2 text-sm font-medium text-text-secondary transition hover:bg-white/5 hover:text-white">
            Lộ trình AI
          </Link>
          <Link href="/mystery-box" className="rounded-full px-2.5 py-2 text-sm font-medium text-text-secondary transition hover:bg-white/5 hover:text-white">
            Mystery Box
          </Link>
          <Link href="/contact" className="rounded-full px-2.5 py-2 text-sm font-medium text-text-secondary transition hover:bg-white/5 hover:text-white">
            Liên hệ
          </Link>
        </nav>

        <div className="mx-2 hidden min-w-0 flex-1 md:block">
          <SearchBar />
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <Link
            href="/wishlist"
            className="relative rounded-full p-2.5 text-white/80 transition hover:bg-white/10 hover:text-white"
            title="Wishlist"
          >
            <Heart className="h-5 w-5" />
            {wishCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-highlight px-1 text-[10px] font-bold text-white">
                {wishCount}
              </span>
            )}
          </Link>
          <Link
            href="/cart"
            className="relative rounded-full p-2.5 text-white/80 transition hover:bg-white/10 hover:text-white"
            title="Giỏ hàng"
          >
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white shadow-[0_0_12px_rgba(168,85,247,0.7)]">
                {cartCount}
              </span>
            )}
          </Link>
          <Link
            href="/account"
            className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white/90 transition hover:border-primary/40 hover:bg-primary/15 sm:flex"
          >
            <User className="h-4 w-4 text-primary" />
            Tài khoản
          </Link>
          <Link
            href="/admin"
            className={cn(
              "hidden rounded-full px-3.5 py-2 text-xs font-bold text-white lg:inline-flex",
              isAdmin ? "btn-primary" : "border border-white/15 bg-white/5 hover:bg-white/10"
            )}
          >
            {isAdmin ? "CMS" : "Admin"}
          </Link>
        </div>
      </div>

      <div className="mt-3 md:hidden">
        <SearchBar compact />
      </div>

      {mega && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 px-4"
          onMouseLeave={() => setMega(false)}
        >
          <div className="glass mx-auto max-w-[1400px] rounded-[24px] p-6">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="section-kicker">Collections</p>
                <h3 className="section-title mt-1 text-xl">Danh mục tuyển chọn</h3>
              </div>
              <Link href="/search" className="text-sm font-semibold text-primary hover:text-highlight" onClick={() => setMega(false)}>
                Xem tất cả →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/category/${c.slug}`}
                  onClick={() => setMega(false)}
                  className="group flex items-center gap-3 rounded-2xl border border-transparent p-3 transition hover:border-primary/25 hover:bg-primary/10"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-highlight/20 text-lg">
                    {c.icon}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white group-hover:text-primary">{c.name}</p>
                    <p className="text-[11px] text-muted">{c.count} tựa</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {mobile && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobile(false)} />
          <div className="absolute left-0 top-0 h-full w-[88%] max-w-sm overflow-y-auto border-r border-white/10 bg-[#160726] p-5 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <p className="section-title text-lg">Menu</p>
              <button type="button" onClick={() => setMobile(false)} className="rounded-full p-2 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-1">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/category/${c.slug}`}
                  onClick={() => setMobile(false)}
                  className="flex items-center gap-3 rounded-2xl px-2 py-2.5 text-text-secondary hover:bg-primary/10 hover:text-white"
                >
                  <span className="text-lg">{c.icon}</span>
                  <span className="text-sm font-medium">{c.name}</span>
                </Link>
              ))}
            </div>
            <div className="mt-8 grid gap-2">
              <Link href="/account" onClick={() => setMobile(false)} className="btn-primary py-3 text-center text-sm">
                Tài khoản
              </Link>
              <Link href="/admin" onClick={() => setMobile(false)} className="btn-secondary py-3 text-center text-sm">
                Admin
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
