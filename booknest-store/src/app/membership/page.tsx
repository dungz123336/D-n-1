"use client";

import Link from "next/link";
import { Crown, Gift, Truck, Zap } from "lucide-react";

const tiers = [
  {
    name: "Silver",
    price: "Miễn phí",
    perks: ["Tích điểm 1%", "Voucher tháng", "Sinh nhật 20k"],
    color: "from-slate-400 to-slate-600",
  },
  {
    name: "Gold",
    price: "99.000đ/năm",
    perks: ["Giảm thêm 5%", "Early flash sale", "Freeship 4 lần", "Quà sinh nhật"],
    color: "from-amber-400 to-yellow-600",
    highlight: true,
  },
  {
    name: "Platinum",
    price: "249.000đ/năm",
    perks: ["Giảm 8%", "Ưu tiên CSKH", "Box độc quyền", "Sách mới trước 7 ngày"],
    color: "from-violet-400 to-purple-700",
  },
  {
    name: "Diamond",
    price: "499.000đ/năm",
    perks: ["Giảm 12%", "Freeship không giới hạn", "Concierge 1-1", "Collector drops"],
    color: "from-cyan-300 to-primary",
  },
];

export default function MembershipPage() {
  return (
    <div className="py-10">
      <p className="section-kicker">Membership</p>
      <h1 className="section-title mt-2 text-4xl sm:text-5xl">Hạng thành viên BookNest</h1>
      <p className="mt-3 max-w-2xl text-text-secondary">
        Silver → Diamond: giảm giá độc quyền, early access, quà sinh nhật, freeship và collection riêng.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`rounded-[24px] border p-5 ${
              t.highlight ? "border-primary bg-primary/15 shadow-[0_0_32px_rgba(168,85,247,0.25)]" : "border-white/10 bg-white/5"
            }`}
          >
            <div className={`inline-flex rounded-full bg-gradient-to-r ${t.color} px-3 py-1 text-xs font-bold text-black`}>
              {t.name}
            </div>
            <p className="mt-4 text-2xl font-bold text-white">{t.price}</p>
            <ul className="mt-4 space-y-2 text-sm text-text-secondary">
              {t.perks.map((p) => (
                <li key={p}>• {p}</li>
              ))}
            </ul>
            <button type="button" className="btn-primary mt-5 w-full py-2.5 text-sm">
              Chọn {t.name}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          { icon: Zap, t: "Early access", d: "Flash & bản đặc biệt trước 48h" },
          { icon: Gift, t: "Birthday gifts", d: "Voucher + quà theo hạng" },
          { icon: Truck, t: "Priority shipping", d: "Ưu tiên đóng gói & giao" },
        ].map((x) => (
          <div key={x.t} className="glass rounded-[20px] p-5">
            <x.icon className="h-5 w-5 text-primary" />
            <p className="mt-2 font-bold text-white">{x.t}</p>
            <p className="text-sm text-muted">{x.d}</p>
          </div>
        ))}
      </div>

      <div className="glass mt-8 flex flex-wrap items-center justify-between gap-4 rounded-[24px] p-6">
        <div className="flex items-center gap-3">
          <Crown className="h-8 w-8 text-primary" />
          <div>
            <p className="font-bold text-white">Member-only collections</p>
            <p className="text-sm text-muted">Sách giới hạn & chữ ký giả lập editorial drops.</p>
          </div>
        </div>
        <Link href="/search?featured=1" className="btn-primary px-5 py-2.5 text-sm">
          Khám phá ngay
        </Link>
      </div>
    </div>
  );
}
