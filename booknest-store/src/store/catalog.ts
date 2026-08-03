"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Book } from "@/types";
import { books as seedBooks } from "@/data/books";
import { coverForBook } from "@/data/covers";

const STORAGE_KEY = "booknest-catalog-v3";

/**
 * URL bìa đã cache trong localStorage từ bản cũ và biết chắc là lỗi.
 *
 * Ảnh admin tự upload (data: URL) hoặc URL admin tự dán đều được giữ nguyên —
 * chỉ những URL sinh tự động theo kiểu cũ mới bị tạo lại từ `coverForBook`.
 */
function isStaleCoverUrl(img: string): boolean {
  // Bìa Open Library thiếu `default=false` trả GIF 1×1 (HTTP 200) khi không có
  // bìa → hiện ra ô trắng trơn thay vì fallback gradient.
  if (img.includes("covers.openlibrary.org") && !img.includes("default=false")) {
    return true;
  }
  // Ảnh Unsplash đã bị xoá (404).
  return img.includes("photo-1639763480679-45b157dfc676");
}

function ensureCovers(list: Book[]): Book[] {
  return list.map((b) => {
    const img = (b.images && b.images[0]) || "";
    if (!img || img.startsWith("/covers/") || isStaleCoverUrl(img)) {
      return { ...b, images: [coverForBook(b.id)] };
    }
    return { ...b, images: [...(b.images || [img])] };
  });
}

const ADMIN_USER = "admin";
const ADMIN_PASS = "BookNest@2026";

function recomputeDiscount(book: Book): Book {
  const discount =
    book.price > 0
      ? Math.max(0, Math.round(((book.price - book.salePrice) / book.price) * 100))
      : 0;
  return {
    ...book,
    discount,
    updatedAt: new Date().toISOString(),
  };
}

function safePersist(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    // Quota vượt — thử bỏ data URL quá lớn? báo lỗi ở UI
    return false;
  }
}

type CatalogState = {
  books: Book[];
  hydrated: boolean;
  isAdmin: boolean;
  adminName: string;
  lastError: string;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  setHydrated: (v: boolean) => void;
  clearError: () => void;
  getById: (id: number) => Book | undefined;
  getBySlug: (slug: string) => Book | undefined;
  updateBook: (id: number, patch: Partial<Book>) => boolean;
  addBook: (book: Partial<Book> & Pick<Book, "title" | "author">) => Book | null;
  deleteBook: (id: number) => void;
  resetCatalog: () => void;
  search: (q: string) => Book[];
};

export const useCatalog = create<CatalogState>()(
  persist(
    (set, get) => ({
      books: ensureCovers(seedBooks.map((b) => ({ ...b }))),
      hydrated: false,
      isAdmin: false,
      adminName: "",
      lastError: "",
      setHydrated: (v) => set({ hydrated: v }),
      clearError: () => set({ lastError: "" }),
      login: (username, password) => {
        if (username.trim() === ADMIN_USER && password === ADMIN_PASS) {
          set({ isAdmin: true, adminName: username.trim() });
          return true;
        }
        return false;
      },
      logout: () => set({ isAdmin: false, adminName: "" }),
      getById: (id) => get().books.find((b) => b.id === id),
      getBySlug: (slug) => get().books.find((b) => b.slug === slug),
      updateBook: (id, patch) => {
        const books = get().books.map((b) => {
          if (b.id !== id) return b;
          const merged: Book = {
            ...b,
            ...patch,
            id: b.id,
            // images: luôn ưu tiên patch nếu có mảng (kể cả 1 phần tử)
            images:
              patch.images !== undefined
                ? patch.images.length
                  ? [...patch.images]
                  : b.images
                : b.images,
          };
          return recomputeDiscount(merged);
        });
        set({ books: [...books], lastError: "" });
        // Kiểm tra persist tay
        try {
          const snap = JSON.stringify({
            state: {
              books,
              isAdmin: get().isAdmin,
              adminName: get().adminName,
            },
            version: 0,
          });
          if (!safePersist(STORAGE_KEY, snap)) {
            set({
              lastError:
                "Không lưu được ảnh (bộ nhớ trình duyệt đầy). Ảnh đã nén chưa? Thử URL ảnh thay vì upload file lớn.",
            });
            return false;
          }
        } catch {
          set({ lastError: "Lỗi lưu catalog." });
          return false;
        }
        return true;
      },
      addBook: (input) => {
        const maxId = get().books.reduce((m, b) => Math.max(m, b.id), 0);
        const slug =
          input.slug ||
          input.title
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
        const book = recomputeDiscount({
          id: maxId + 1,
          title: input.title,
          slug,
          isbn: input.isbn || "",
          author: input.author,
          publisher: input.publisher || "BookNest",
          translator: input.translator || "",
          category: input.category || "Self Help",
          subCategory: input.subCategory || "",
          language: input.language || "Tiếng Việt",
          publishYear: input.publishYear || String(new Date().getFullYear()),
          edition: input.edition || "1",
          pages: input.pages || 200,
          size: input.size || "14.5 x 20.5 cm",
          weight: input.weight || "300g",
          coverType: input.coverType || "Bìa mềm",
          description: input.description || "",
          summary: input.summary || input.description || "",
          tableOfContents: input.tableOfContents || [],
          price: input.price ?? 100000,
          salePrice: input.salePrice ?? input.price ?? 100000,
          discount: 0,
          currency: "VND",
          stock: input.stock ?? 20,
          sold: input.sold ?? 0,
          rating: input.rating ?? 5,
          reviewCount: input.reviewCount ?? 0,
          images: input.images?.length
            ? [...input.images]
            : [coverForBook(maxId + 1)],
          coverGradient: input.coverGradient || "from-[#A855F7] via-[#9333EA] to-[#EC4899]",
          previewPages: [],
          ebook: !!input.ebook,
          audiobook: !!input.audiobook,
          featured: !!input.featured,
          bestseller: !!input.bestseller,
          newArrival: input.newArrival ?? true,
          flashSale: !!input.flashSale,
          tags: input.tags || [],
          relatedBooks: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        const books = [book, ...get().books];
        set({ books });
        return book;
      },
      deleteBook: (id) => set({ books: get().books.filter((b) => b.id !== id) }),
      resetCatalog: () =>
        set({
          books: ensureCovers(seedBooks.map((b) => ({ ...b }))),
          lastError: "",
        }),
      search: (q) => {
        let query = q.trim().toLowerCase();
        if (!query) return get().books;

        // Voice / natural language price filters: "sách dưới 300000", "duoi 300k"
        let maxPrice: number | null = null;
        let minPrice: number | null = null;
        const under = query.match(/(?:dưới|duoi|under|below|<)\s*(\d[\d.,]*)\s*(k|000)?/i);
        const over = query.match(/(?:trên|tren|over|above|>)\s*(\d[\d.,]*)\s*(k|000)?/i);
        if (under) {
          maxPrice = parseInt(under[1].replace(/[.,]/g, ""), 10);
          if (under[2]?.toLowerCase() === "k") maxPrice *= 1000;
          query = query.replace(under[0], " ").trim();
        }
        if (over) {
          minPrice = parseInt(over[1].replace(/[.,]/g, ""), 10);
          if (over[2]?.toLowerCase() === "k") minPrice *= 1000;
          query = query.replace(over[0], " ").trim();
        }
        // bare large numbers often mean price ceiling after voice normalize
        if (maxPrice == null) {
          const bare = query.match(/\b(\d{5,8})\b/);
          if (bare && /(gia|price|vnd|dưới|duoi|re|rẻ)/i.test(q)) {
            maxPrice = parseInt(bare[1], 10);
            query = query.replace(bare[0], " ").trim();
          }
        }

        // strip filler words left by voice
        query = query
          .replace(/\b(sách|sach|tìm|tim|gợi|goi|ý|y|của|cua|the|book|books)\b/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        const tokens = query.split(/\s+/).filter((w) => w.length > 1);
        return get().books.filter((b) => {
          if (maxPrice != null && b.salePrice > maxPrice) return false;
          if (minPrice != null && b.salePrice < minPrice) return false;
          if (!tokens.length) return true;
          const blob = [b.title, b.author, b.category, b.subCategory, ...b.tags, b.summary, b.isbn]
            .join(" ")
            .toLowerCase();
          return tokens.every((w) => blob.includes(w));
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        books: s.books,
        isAdmin: s.isAdmin,
        adminName: s.adminName,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn("Catalog rehydrate error", error);
        }
        if (state) {
          // Giữ ảnh custom (data: / https), chỉ vá placeholder
          state.books = ensureCovers(state.books || []);
          state.setHydrated(true);
        }
      },
    }
  )
);

export function readCatalogBooks(): Book[] {
  if (typeof window === "undefined") return seedBooks;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // fallback key cũ
      const old = localStorage.getItem("booknest-catalog-v2");
      if (old) {
        const parsed = JSON.parse(old);
        const list = parsed?.state?.books;
        if (Array.isArray(list) && list.length) return ensureCovers(list);
      }
      return seedBooks;
    }
    const parsed = JSON.parse(raw);
    const list = parsed?.state?.books;
    return Array.isArray(list) && list.length ? ensureCovers(list) : seedBooks;
  } catch {
    return seedBooks;
  }
}

export function readBookById(id: number) {
  return readCatalogBooks().find((b) => b.id === id);
}

export const ADMIN_CREDENTIALS_HINT = {
  username: ADMIN_USER,
  password: ADMIN_PASS,
};
