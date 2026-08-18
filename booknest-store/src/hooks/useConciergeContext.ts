"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCart } from "@/store/cart";
import { useWishlist } from "@/store/wishlist";
import { useMemory } from "@/store/memory";
import { useCatalog } from "@/store/catalog";
import type { AiChatContext, WebsiteBookSnapshot } from "@/lib/booknestAi";
import type { Book } from "@/types";

/** Map store Book → inventory snapshot for AI (stock/price truth). */
export function toInventorySnapshot(b: Book): WebsiteBookSnapshot {
  return {
    id: b.id,
    title: b.title,
    slug: b.slug,
    author: b.author,
    publisher: b.publisher,
    category: b.category,
    price: b.price,
    sale_price: b.salePrice ?? b.price,
    stock: b.stock ?? 0,
    rating: b.rating,
    review_count: b.reviewCount,
    isbn: b.isbn,
    language: b.language,
    summary: b.summary || b.description?.slice(0, 280),
    tags: b.tags,
  };
}

export type ConciergeRole =
  | "book_consultant"
  | "checkout_assistant"
  | "order_assistant"
  | "search_assistant"
  | "cart_assistant"
  | "general";

function loadOrders(): Array<Record<string, unknown>> {
  try {
    return JSON.parse(localStorage.getItem("booknest-orders") || "[]");
  } catch {
    return [];
  }
}

function loadCustomerId(): number | null {
  try {
    const auth = localStorage.getItem("booknest-auth-v1");
    if (auth) {
      const p = JSON.parse(auth);
      const u = p?.state?.user;
      if (u?.id) return Number(u.id);
    }
    const raw = localStorage.getItem("booknest-user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    return Number(u.id || u.customer_id) || null;
  } catch {
    return null;
  }
}

function loadMembership(): string | null {
  try {
    const auth = localStorage.getItem("booknest-auth-v1");
    if (auth) {
      const p = JSON.parse(auth);
      if (p?.state?.user) return "standard";
    }
    const raw = localStorage.getItem("booknest-user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u.membership || u.tier || null;
  } catch {
    return null;
  }
}

export function resolveRole(pathname: string): ConciergeRole {
  if (pathname.startsWith("/checkout")) return "checkout_assistant";
  if (pathname.startsWith("/account") || pathname.includes("order")) return "order_assistant";
  if (pathname.startsWith("/cart")) return "cart_assistant";
  if (pathname.startsWith("/search")) return "search_assistant";
  if (pathname.startsWith("/books/")) return "book_consultant";
  if (pathname.startsWith("/category/")) return "book_consultant";
  return "general";
}

export function roleLabel(role: ConciergeRole): string {
  switch (role) {
    case "checkout_assistant":
      return "Trợ lý thanh toán";
    case "order_assistant":
      return "Trợ lý đơn hàng";
    case "cart_assistant":
      return "Trợ lý giỏ hàng";
    case "search_assistant":
      return "Tư vấn tìm kiếm";
    case "book_consultant":
      return "Tư vấn sách";
    default:
      return "AI tư vấn sách";
  }
}

export function useConciergeContext() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const cart = useCart();
  const wishlistIds = useWishlist((s) => s.ids);
  const memory = useMemory();
  const books = useCatalog((s) => s.books);

  const role = resolveRole(pathname);
  const searchQuery = searchParams?.get("q") || "";

  const currentBook: Book | undefined = useMemo(() => {
    if (!pathname.startsWith("/books/")) return undefined;
    const slug = pathname.split("/")[2];
    return books.find((b) => b.slug === slug);
  }, [pathname, books]);

  const currentCategory = useMemo(() => {
    if (pathname.startsWith("/category/")) return pathname.split("/")[2] || null;
    if (currentBook) return currentBook.category;
    return null;
  }, [pathname, currentBook]);

  const apiContext: AiChatContext = useMemo(() => {
    const cartLines = cart.items.map((i) => {
      const b = books.find((x) => x.id === i.bookId);
      return {
        book_id: i.bookId,
        quantity: i.quantity,
        title: b?.title,
        price: b?.salePrice ?? b?.price,
        stock: b?.stock ?? 0,
        author: b?.author,
        in_stock: (b?.stock ?? 0) > 0,
      };
    });

    // Live website catalog — AI must use this for stock/price (not its local DB)
    const website_inventory = books.map(toInventorySnapshot);

    const wishlist_books = books
      .filter((b) => wishlistIds.includes(b.id))
      .map(toInventorySnapshot);

    const viewed_book_details = memory.viewedBooks
      .map((v) => books.find((b) => b.id === v.id))
      .filter(Boolean)
      .map((b) => toInventorySnapshot(b as Book));

    return {
      customer_id: loadCustomerId(),
      current_page: pathname + (searchQuery ? `?q=${searchQuery}` : ""),
      current_book_id: currentBook?.id ?? null,
      current_book: currentBook ? toInventorySnapshot(currentBook) : null,
      current_category: currentCategory,
      website_inventory,
      inventory_source: "booknest-store",
      cart: cartLines,
      wishlist: wishlistIds,
      wishlist_books,
      orders: loadOrders().slice(0, 5),
      viewed_books: memory.viewedBooks.map((v) => v.id),
      viewed_book_details,
      search_history: memory.searches.map((s) => s.q).slice(0, 12),
      coupons: cart.coupon ? [cart.coupon] : [],
      membership: loadMembership(),
      language: "vi",
    };
  }, [
    pathname,
    searchQuery,
    currentBook,
    currentCategory,
    cart.items,
    cart.coupon,
    wishlistIds,
    books,
    memory.viewedBooks,
    memory.searches,
  ]);

  /** System preamble so the model knows page role + product facts */
  const systemHint = useMemo(() => {
    const parts: string[] = [];
    parts.push(`Vai trò hiện tại: ${roleLabel(role)}.`);
    parts.push(
      "NGUỒN SỰ THẬT TỒN KHO/GIÁ: website_inventory từ BookNest-Store. " +
        "stock>0 = còn hàng (nói rõ số lượng). Chỉ stock=0 mới nói hết hàng. Không đoán."
    );
    if (currentBook) {
      const st = currentBook.stock ?? 0;
      parts.push(
        `Khách đang xem sách: "${currentBook.title}" (id=${currentBook.id}), ` +
          `tác giả ${currentBook.author}, giá ${currentBook.salePrice || currentBook.price}đ, ` +
          `gốc ${currentBook.price}đ, rating ${currentBook.rating}, ` +
          `TỒN KHO THỰT = ${st} cuốn → ${st > 0 ? "CÒN HÀNG" : "HẾT HÀNG"}, ` +
          `danh mục ${currentBook.category}. Hãy tư vấn dựa trên cuốn này trước.`
      );
    }
    if (role === "checkout_assistant") {
      parts.push(
        "Khách đang ở trang thanh toán. Ưu tiên hỗ trợ địa chỉ, voucher, phương thức COD/MoMo/VNPay/ZaloPay/thẻ."
      );
    }
    if (role === "order_assistant") {
      parts.push("Khách đang xem đơn hàng. Ưu tiên tra cứu, trạng thái, hủy, đổi địa chỉ, hoàn tiền.");
    }
    if (role === "search_assistant" && searchQuery) {
      parts.push(
        `Khách vừa tìm: "${searchQuery}". Gợi ý sách tương tự, bestseller liên quan, tác giả, lộ trình đọc, combo và voucher phù hợp.`
      );
    }
    if (cart.items.length) {
      parts.push(`Giỏ đang có ${cart.count()} sản phẩm, tạm tính ~${cart.subtotal().toLocaleString("vi-VN")}đ.`);
    }
    return parts.join(" ");
  }, [role, currentBook, searchQuery, cart]);

  return {
    role,
    roleLabel: roleLabel(role),
    pathname,
    searchQuery,
    currentBook,
    currentCategory,
    apiContext,
    systemHint,
    customerId: loadCustomerId(),
  };
}
