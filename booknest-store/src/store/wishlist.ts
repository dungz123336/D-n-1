"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type WishlistState = {
  ids: number[];
  toggle: (id: number) => void;
  has: (id: number) => boolean;
};

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) => {
        const ids = get().ids.includes(id)
          ? get().ids.filter((x) => x !== id)
          : [...get().ids, id];
        set({ ids });
      },
      has: (id) => get().ids.includes(id),
    }),
    { name: "booknest-wishlist" }
  )
);
