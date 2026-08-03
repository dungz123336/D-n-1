"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type FollowState = {
  following: string[]; // author slugs
  toggle: (slug: string) => void;
  isFollowing: (slug: string) => boolean;
};

export const useAuthorsFollow = create<FollowState>()(
  persist(
    (set, get) => ({
      following: [],
      toggle: (slug) => {
        const f = get().following;
        set({
          following: f.includes(slug) ? f.filter((s) => s !== slug) : [...f, slug],
        });
      },
      isFollowing: (slug) => get().following.includes(slug),
    }),
    { name: "booknest-follow-authors-v1" }
  )
);
