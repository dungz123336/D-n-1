"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type VoucherType = "percent" | "fixed" | "shipping" | "bundle";

export type Voucher = {
  id: string;
  code: string;
  name: string;
  type: VoucherType;
  value: number; // percent or VND
  minOrder: number;
  minQty: number;
  maxDiscount?: number;
  usageLimit: number;
  used: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
  description: string;
};

const seed: Voucher[] = [
  {
    id: "v1",
    code: "WELCOME10",
    name: "Chào mừng 10%",
    type: "percent",
    value: 10,
    minOrder: 0,
    minQty: 1,
    maxDiscount: 50000,
    usageLimit: 9999,
    used: 128,
    startsAt: "2026-01-01",
    endsAt: "2026-12-31",
    active: true,
    description: "Giảm 10% tối đa 50k cho khách mới",
  },
  {
    id: "v2",
    code: "BOOKNEST15",
    name: "Ưu đãi 15%",
    type: "percent",
    value: 15,
    minOrder: 200000,
    minQty: 1,
    maxDiscount: 100000,
    usageLimit: 500,
    used: 42,
    startsAt: "2026-01-01",
    endsAt: "2026-12-31",
    active: true,
    description: "Giảm 15% đơn từ 200k",
  },
  {
    id: "v3",
    code: "FREESHIP",
    name: "Freeship",
    type: "shipping",
    value: 0,
    minOrder: 0,
    minQty: 1,
    usageLimit: 9999,
    used: 310,
    startsAt: "2026-01-01",
    endsAt: "2026-12-31",
    active: true,
    description: "Miễn phí vận chuyển",
  },
  {
    id: "v4",
    code: "BULK5",
    name: "Mua 3 giảm 5%",
    type: "bundle",
    value: 5,
    minOrder: 0,
    minQty: 3,
    usageLimit: 9999,
    used: 19,
    startsAt: "2026-01-01",
    endsAt: "2026-12-31",
    active: true,
    description: "Tự động gợi ý khi mua ≥3 cuốn",
  },
  {
    id: "v5",
    code: "BULK10",
    name: "Mua 5 giảm 10%",
    type: "bundle",
    value: 10,
    minOrder: 0,
    minQty: 5,
    usageLimit: 9999,
    used: 8,
    startsAt: "2026-01-01",
    endsAt: "2026-12-31",
    active: true,
    description: "Bulk 5+",
  },
  {
    id: "v6",
    code: "BULK20",
    name: "Mua 10 giảm 20%",
    type: "bundle",
    value: 20,
    minOrder: 0,
    minQty: 10,
    maxDiscount: 300000,
    usageLimit: 200,
    used: 3,
    startsAt: "2026-01-01",
    endsAt: "2026-12-31",
    active: true,
    description: "Bulk 10+",
  },
  {
    id: "v7",
    code: "BDAY50K",
    name: "Sinh nhật 50k",
    type: "fixed",
    value: 50000,
    minOrder: 150000,
    minQty: 1,
    usageLimit: 1000,
    used: 12,
    startsAt: "2026-01-01",
    endsAt: "2026-12-31",
    active: true,
    description: "Giảm cố định 50.000đ",
  },
];

/** AI deal rules (admin configurable) */
export type DealRules = {
  maxDiscountPercent: number;
  minQtyForDeal: number;
  vipExtraPercent: number;
  enabled: boolean;
};

type VoucherState = {
  vouchers: Voucher[];
  dealRules: DealRules;
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
  addVoucher: (v: Omit<Voucher, "id" | "used">) => void;
  updateVoucher: (id: string, patch: Partial<Voucher>) => void;
  toggleVoucher: (id: string) => void;
  deleteVoucher: (id: string) => void;
  getByCode: (code: string) => Voucher | undefined;
  evaluate: (code: string, subtotal: number, qty: number) => { ok: boolean; discount: number; freeShip: boolean; message: string };
  autoBundleDiscount: (subtotal: number, qty: number) => { code: string; discount: number } | null;
  negotiate: (qty: number, subtotal: number, vip?: boolean) => { percent: number; message: string };
  setDealRules: (r: Partial<DealRules>) => void;
};

function activeOk(v: Voucher) {
  if (!v.active) return false;
  const now = Date.now();
  const start = new Date(v.startsAt).getTime();
  const end = new Date(v.endsAt).getTime() + 86400000;
  if (now < start || now > end) return false;
  if (v.used >= v.usageLimit) return false;
  return true;
}

export const useVouchers = create<VoucherState>()(
  persist(
    (set, get) => ({
      vouchers: seed,
      dealRules: {
        maxDiscountPercent: 15,
        minQtyForDeal: 10,
        vipExtraPercent: 3,
        enabled: true,
      },
      hydrated: false,
      setHydrated: (v) => set({ hydrated: v }),
      addVoucher: (v) =>
        set({
          vouchers: [
            {
              ...v,
              id: "v_" + Date.now().toString(36),
              used: 0,
              code: v.code.toUpperCase(),
            },
            ...get().vouchers,
          ],
        }),
      updateVoucher: (id, patch) =>
        set({
          vouchers: get().vouchers.map((v) =>
            v.id === id ? { ...v, ...patch, code: (patch.code || v.code).toUpperCase() } : v
          ),
        }),
      toggleVoucher: (id) =>
        set({
          vouchers: get().vouchers.map((v) => (v.id === id ? { ...v, active: !v.active } : v)),
        }),
      deleteVoucher: (id) => set({ vouchers: get().vouchers.filter((v) => v.id !== id) }),
      getByCode: (code) => get().vouchers.find((v) => v.code === code.toUpperCase()),
      evaluate: (code, subtotal, qty) => {
        const v = get().getByCode(code);
        if (!v) return { ok: false, discount: 0, freeShip: false, message: "Mã không tồn tại." };
        if (!activeOk(v)) return { ok: false, discount: 0, freeShip: false, message: "Mã hết hạn hoặc tạm dừng." };
        if (subtotal < v.minOrder)
          return {
            ok: false,
            discount: 0,
            freeShip: false,
            message: `Đơn tối thiểu ${v.minOrder.toLocaleString("vi-VN")}đ`,
          };
        if (qty < v.minQty)
          return { ok: false, discount: 0, freeShip: false, message: `Cần mua tối thiểu ${v.minQty} cuốn.` };
        if (v.type === "shipping")
          return { ok: true, discount: 0, freeShip: true, message: "Miễn phí vận chuyển." };
        let discount = 0;
        if (v.type === "percent" || v.type === "bundle") {
          discount = Math.round((subtotal * v.value) / 100);
          if (v.maxDiscount) discount = Math.min(discount, v.maxDiscount);
        } else if (v.type === "fixed") {
          discount = Math.min(v.value, subtotal);
        }
        return { ok: true, discount, freeShip: false, message: `Áp dụng ${v.code}: −${discount.toLocaleString("vi-VN")}đ` };
      },
      autoBundleDiscount: (subtotal, qty) => {
        const bundles = get()
          .vouchers.filter((v) => v.type === "bundle" && activeOk(v) && qty >= v.minQty)
          .sort((a, b) => b.value - a.value);
        const best = bundles[0];
        if (!best) return null;
        let discount = Math.round((subtotal * best.value) / 100);
        if (best.maxDiscount) discount = Math.min(discount, best.maxDiscount);
        return { code: best.code, discount };
      },
      negotiate: (qty, subtotal, vip = false) => {
        const rules = get().dealRules;
        if (!rules.enabled) return { percent: 0, message: "Deal AI đang tắt." };
        if (qty < rules.minQtyForDeal)
          return {
            percent: 0,
            message: `Cần tối thiểu ${rules.minQtyForDeal} cuốn để thương lượng deal.`,
          };
        // business rule ladder
        let percent = 5;
        if (qty >= 15) percent = 8;
        if (qty >= 20) percent = 10;
        if (qty >= 30) percent = 12;
        if (qty >= 50) percent = 15;
        if (vip) percent += rules.vipExtraPercent;
        percent = Math.min(percent, rules.maxDiscountPercent);
        const save = Math.round((subtotal * percent) / 100);
        return {
          percent,
          message: `Dựa trên số lượng ${qty} và biên lợi nhuận cấu hình, mình đề xuất **${percent}%** (tiết kiệm ~${save.toLocaleString("vi-VN")}đ). Mã tạm: DEAL${percent}`,
        };
      },
      setDealRules: (r) => set({ dealRules: { ...get().dealRules, ...r } }),
    }),
    {
      name: "booknest-vouchers-v1",
      onRehydrateStorage: () => (s) => s?.setHydrated(true),
    }
  )
);
