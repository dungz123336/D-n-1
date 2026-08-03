"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/types";
import { readBookById } from "@/store/catalog";
import { useVouchers } from "@/store/vouchers";

type CartState = {
  items: CartItem[];
  coupon: string;
  paymentMethod: string;
  add: (bookId: number, qty?: number) => void;
  remove: (bookId: number) => void;
  setQty: (bookId: number, qty: number) => void;
  clear: () => void;
  setCoupon: (code: string) => { ok: boolean; message: string };
  setPaymentMethod: (m: string) => void;
  count: () => number;
  subtotal: () => number;
  discountAmount: () => number;
  shipping: () => number;
  total: () => number;
  couponMessage: () => string;
};

function calcDiscount(coupon: string, subtotal: number, qty: number) {
  // try voucher store (client)
  try {
    const vs = useVouchers.getState();
    if (coupon) {
      const r = vs.evaluate(coupon, subtotal, qty);
      if (r.ok) return { discount: r.discount, freeShip: r.freeShip, message: r.message };
      // invalid coupon → still check auto bundle
    }
    const auto = vs.autoBundleDiscount(subtotal, qty);
    if (auto && (!coupon || coupon.startsWith("BULK"))) {
      return {
        discount: auto.discount,
        freeShip: false,
        message: `Ưu đãi số lượng ${auto.code}: −${auto.discount.toLocaleString("vi-VN")}đ`,
      };
    }
    if (coupon && !vs.getByCode(coupon)) {
      // legacy fallback
      if (coupon === "WELCOME10") return { discount: Math.round(subtotal * 0.1), freeShip: false, message: "WELCOME10" };
      if (coupon === "BOOKNEST15") return { discount: Math.round(subtotal * 0.15), freeShip: false, message: "BOOKNEST15" };
      if (coupon === "FREESHIP") return { discount: 0, freeShip: true, message: "FREESHIP" };
      if (coupon.startsWith("DEAL")) {
        const p = Number(coupon.replace("DEAL", "")) || 0;
        return { discount: Math.round((subtotal * p) / 100), freeShip: false, message: coupon };
      }
    }
    if (coupon) {
      const r = vs.evaluate(coupon, subtotal, qty);
      return { discount: 0, freeShip: false, message: r.message };
    }
  } catch {
    /* ssr */
  }
  return { discount: 0, freeShip: false, message: "" };
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      coupon: "",
      paymentMethod: "COD",
      add: (bookId, qty = 1) => {
        const items = [...get().items];
        const idx = items.findIndex((i) => i.bookId === bookId);
        if (idx >= 0) items[idx] = { ...items[idx], quantity: items[idx].quantity + qty };
        else items.push({ bookId, quantity: qty });
        set({ items });
      },
      remove: (bookId) => set({ items: get().items.filter((i) => i.bookId !== bookId) }),
      setQty: (bookId, qty) => {
        if (qty <= 0) return get().remove(bookId);
        set({
          items: get().items.map((i) => (i.bookId === bookId ? { ...i, quantity: qty } : i)),
        });
      },
      clear: () => set({ items: [], coupon: "" }),
      setCoupon: (code) => {
        const c = code.trim().toUpperCase();
        const sub = get().subtotal();
        const qty = get().count();
        const r = calcDiscount(c, sub, qty);
        if (c && r.discount === 0 && !r.freeShip && r.message && !r.message.includes("Áp dụng") && !r.message.includes("Miễn phí")) {
          // still set if deal/bulk codes known
          if (c.startsWith("DEAL") || c.startsWith("BULK")) {
            set({ coupon: c });
            return { ok: true, message: r.message || "Đã áp mã" };
          }
          if (["WELCOME10", "BOOKNEST15", "FREESHIP"].includes(c)) {
            set({ coupon: c });
            return { ok: true, message: "Đã áp mã" };
          }
          // validate via store
          try {
            const ev = useVouchers.getState().evaluate(c, sub, qty);
            if (!ev.ok) return { ok: false, message: ev.message };
            set({ coupon: c });
            return { ok: true, message: ev.message };
          } catch {
            set({ coupon: c });
            return { ok: true, message: "Đã áp mã" };
          }
        }
        set({ coupon: c });
        return { ok: true, message: r.message || "Đã áp mã" };
      },
      setPaymentMethod: (m) => set({ paymentMethod: m }),
      count: () => get().items.reduce((s, i) => s + i.quantity, 0),
      subtotal: () =>
        get().items.reduce((s, i) => {
          const b = readBookById(i.bookId);
          return s + (b?.salePrice || 0) * i.quantity;
        }, 0),
      discountAmount: () => {
        const sub = get().subtotal();
        const qty = get().count();
        const code = get().coupon;
        const r = calcDiscount(code, sub, qty);
        // auto apply best bulk if higher
        try {
          const auto = useVouchers.getState().autoBundleDiscount(sub, qty);
          if (auto && auto.discount > r.discount && (!code || code.startsWith("BULK"))) {
            return auto.discount;
          }
        } catch {
          /* */
        }
        return r.discount;
      },
      shipping: () => {
        const sub = get().subtotal() - get().discountAmount();
        const code = get().coupon;
        const r = calcDiscount(code, get().subtotal(), get().count());
        if (r.freeShip || code === "FREESHIP") return 0;
        return sub >= 200000 ? 0 : 30000;
      },
      total: () => Math.max(0, get().subtotal() - get().discountAmount() + get().shipping()),
      couponMessage: () => {
        const r = calcDiscount(get().coupon, get().subtotal(), get().count());
        return r.message;
      },
    }),
    { name: "booknest-cart-v2" }
  )
);
