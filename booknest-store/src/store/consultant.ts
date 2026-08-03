"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Multi-step sales & checkout conversation state */
export type ConsultantPhase =
  | "idle"
  | "discover"
  | "recommend"
  | "compare"
  | "cart"
  | "checkout_name"
  | "checkout_phone"
  | "checkout_address"
  | "checkout_shipping"
  | "checkout_payment"
  | "checkout_confirm"
  | "order_support"
  | "await_confirm";

export type DiscoverSlots = {
  topic?: string;
  level?: "beginner" | "intermediate" | "advanced";
  language?: "vi" | "en" | "any";
  format?: "paperback" | "hardcover" | "ebook" | "audiobook" | "any";
  budget?: number | null;
  goal?: string;
  profession?: string;
  ageGroup?: string;
  mood?: string;
};

export type CheckoutDraft = {
  name: string;
  phone: string;
  address: string;
  email: string;
  shipping: "standard" | "express";
  payment: string;
  note: string;
  pendingBookIds: number[];
};

export type PendingAction = {
  type: string;
  bookId?: number;
  payload?: string;
  label: string;
  description: string;
};

type ConsultantState = {
  phase: ConsultantPhase;
  discover: DiscoverSlots;
  draft: CheckoutDraft;
  pendingAction: PendingAction | null;
  lastIntent: string;
  setPhase: (p: ConsultantPhase) => void;
  patchDiscover: (p: Partial<DiscoverSlots>) => void;
  resetDiscover: () => void;
  patchDraft: (p: Partial<CheckoutDraft>) => void;
  resetDraft: () => void;
  setPending: (a: PendingAction | null) => void;
  setLastIntent: (i: string) => void;
};

const emptyDraft = (): CheckoutDraft => ({
  name: "",
  phone: "",
  address: "",
  email: "",
  shipping: "standard",
  payment: "COD",
  note: "",
  pendingBookIds: [],
});

export const useConsultant = create<ConsultantState>()(
  persist(
    (set) => ({
      phase: "idle",
      discover: {},
      draft: emptyDraft(),
      pendingAction: null,
      lastIntent: "",
      setPhase: (phase) => set({ phase }),
      patchDiscover: (p) => set((s) => ({ discover: { ...s.discover, ...p } })),
      resetDiscover: () => set({ discover: {}, phase: "idle" }),
      patchDraft: (p) => set((s) => ({ draft: { ...s.draft, ...p } })),
      resetDraft: () => set({ draft: emptyDraft(), phase: "idle" }),
      setPending: (pendingAction) => set({ pendingAction }),
      setLastIntent: (lastIntent) => set({ lastIntent }),
    }),
    {
      name: "booknest-consultant-flow-v1",
      partialize: (s) => ({
        phase: s.phase,
        discover: s.discover,
        draft: s.draft,
        lastIntent: s.lastIntent,
      }),
    }
  )
);
