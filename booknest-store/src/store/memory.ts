"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: number;
  actions?: AssistantAction[];
};

export type AssistantAction = {
  type:
    | "add_to_cart"
    | "open_book"
    | "open_cart"
    | "open_checkout"
    | "apply_coupon"
    | "track_order"
    | "create_order"
    | "cancel_order"
    | "add_bundle"
    | "start_checkout_cod";
  bookId?: number;
  label: string;
  payload?: string;
};

export type CustomerMemory = {
  viewedBooks: { id: number; title: string; category: string; at: number }[];
  searches: { q: string; at: number }[];
  favoriteCategories: string[];
  favoriteAuthors: string[];
  preferredFormats: string[];
  preferredLanguage: string;
  budgetMax: number | null;
  interests: string[];
  chatHistory: ChatTurn[];
  abandonedHints: number;
  lastProactiveAt: number;
};

type MemoryState = CustomerMemory & {
  trackView: (book: { id: number; title: string; category: string; author?: string }) => void;
  trackSearch: (q: string) => void;
  trackInterest: (tag: string) => void;
  setBudget: (max: number | null) => void;
  addChat: (turn: Omit<ChatTurn, "id" | "at"> & { id?: string; at?: number }) => void;
  clearChat: () => void;
  markProactive: () => void;
  profileSummary: () => string;
};

function pushUnique<T extends { id?: number; q?: string }>(
  list: T[],
  item: T,
  key: (x: T) => string,
  max: number
) {
  const k = key(item);
  const next = [item, ...list.filter((x) => key(x) !== k)];
  return next.slice(0, max);
}

export const useMemory = create<MemoryState>()(
  persist(
    (set, get) => ({
      viewedBooks: [],
      searches: [],
      favoriteCategories: [],
      favoriteAuthors: [],
      preferredFormats: ["Paperback"],
      preferredLanguage: "Tiếng Việt",
      budgetMax: null,
      interests: [],
      chatHistory: [],
      abandonedHints: 0,
      lastProactiveAt: 0,

      trackView: (book) => {
        const viewedBooks = pushUnique(
          get().viewedBooks,
          { id: book.id, title: book.title, category: book.category, at: Date.now() },
          (x) => String(x.id),
          30
        );
        const favoriteCategories = pushUnique(
          get().favoriteCategories.map((c) => ({ q: c })) as { q: string }[],
          { q: book.category },
          (x) => x.q,
          12
        ).map((x) => x.q);
        const favoriteAuthors = book.author
          ? pushUnique(
              get().favoriteAuthors.map((a) => ({ q: a })) as { q: string }[],
              { q: book.author },
              (x) => x.q,
              12
            ).map((x) => x.q)
          : get().favoriteAuthors;
        set({ viewedBooks, favoriteCategories, favoriteAuthors });
        // analytics
        logAnalytics("view", { bookId: book.id, category: book.category, title: book.title });
      },

      trackSearch: (q) => {
        const query = q.trim();
        if (!query) return;
        const searches = pushUnique(
          get().searches,
          { q: query, at: Date.now() },
          (x) => x.q.toLowerCase(),
          40
        );
        set({ searches });
        logAnalytics("search", { q: query });
      },

      trackInterest: (tag) => {
        const t = tag.trim();
        if (!t) return;
        const interests = pushUnique(
          get().interests.map((i) => ({ q: i })) as { q: string }[],
          { q: t },
          (x) => x.q.toLowerCase(),
          20
        ).map((x) => x.q);
        set({ interests });
      },

      setBudget: (max) => set({ budgetMax: max }),

      addChat: (turn) => {
        const entry: ChatTurn = {
          id: turn.id || `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          role: turn.role,
          text: turn.text,
          at: turn.at || Date.now(),
          actions: turn.actions,
        };
        const chatHistory = [...get().chatHistory, entry].slice(-80);
        set({ chatHistory });
        logAnalytics("chat", { role: turn.role, text: turn.text.slice(0, 200) });
      },

      clearChat: () => set({ chatHistory: [] }),

      markProactive: () => set({ lastProactiveAt: Date.now() }),

      profileSummary: () => {
        const s = get();
        const cats = s.favoriteCategories.slice(0, 4).join(", ") || "chưa rõ";
        const views = s.viewedBooks
          .slice(0, 5)
          .map((v) => v.title)
          .join("; ");
        const searches = s.searches
          .slice(0, 5)
          .map((x) => x.q)
          .join("; ");
        const authors = s.favoriteAuthors.slice(0, 3).join(", ");
        return [
          `Thể loại quan tâm: ${cats}`,
          authors ? `Tác giả: ${authors}` : "",
          views ? `Đã xem: ${views}` : "",
          searches ? `Đã tìm: ${searches}` : "",
          s.budgetMax ? `Ngân sách gợi ý ≤ ${s.budgetMax.toLocaleString("vi-VN")}đ` : "",
          `Định dạng ưa thích: ${s.preferredFormats.join(", ")}`,
          `Ngôn ngữ: ${s.preferredLanguage}`,
        ]
          .filter(Boolean)
          .join("\n");
      },
    }),
    { name: "booknest-customer-memory-v1" }
  )
);

/** Analytics events for Admin AI dashboard */
export type AnalyticsEvent = {
  type: string;
  at: number;
  data?: Record<string, unknown>;
};

const ANALYTICS_KEY = "booknest-ai-analytics-v1";

export function logAnalytics(type: string, data?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    const prev: AnalyticsEvent[] = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || "[]");
    prev.unshift({ type, at: Date.now(), data });
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(prev.slice(0, 500)));
  } catch {
    /* ignore quota */
  }
}

export function readAnalytics(): AnalyticsEvent[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(ANALYTICS_KEY) || "[]");
  } catch {
    return [];
  }
}
