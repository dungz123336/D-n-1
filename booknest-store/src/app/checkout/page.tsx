"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/store/cart";
import { formatVND } from "@/lib/utils";
import { readBookById } from "@/store/catalog";

const payments = [
  "COD",
  "MoMo",
  "VNPay",
  "ZaloPay",
  "Visa",
  "MasterCard",
  "Apple Pay",
  "Google Pay",
  "Chuyển khoản",
];

export default function CheckoutPage() {
  const { items, subtotal, discountAmount, shipping, total, clear, coupon, paymentMethod, setPaymentMethod, couponMessage } =
    useCart();
  const [form, setForm] = useState({ name: "", phone: "", address: "", email: "", note: "" });
  const [payTiming, setPayTiming] = useState<"now" | "cod">("cod");
  const [done, setDone] = useState<string | null>(null);

  if (items.length === 0 && !done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-muted">Chưa có sản phẩm để thanh toán.</p>
        <Link href="/search" className="btn-primary mt-4 inline-flex px-6 py-3 text-sm">
          Mua sắm
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="glass rounded-[28px] p-8">
          <p className="text-4xl">🎉</p>
          <h1 className="section-title mt-3 text-2xl">Đặt hàng thành công!</h1>
          <p className="mt-2 text-sm text-muted">
            Mã đơn: <b className="text-primary">{done}</b>
          </p>
          <p className="mt-1 text-sm text-muted">Dự kiến giao 1–5 ngày làm việc tùy khu vực.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/" className="btn-primary px-5 py-2.5 text-sm">
              Về trang chủ
            </Link>
            <Link href="/account" className="btn-secondary px-5 py-2.5 text-sm">
              Theo dõi đơn
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-10">
      <h1 className="section-title text-3xl">Thanh toán</h1>
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <form
          className="glass space-y-4 rounded-[24px] p-6 lg:col-span-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.name || !form.phone || !form.address) return;
            const pay = payTiming === "cod" ? "COD" : paymentMethod;
            const id = "BN" + Date.now().toString().slice(-8);
            const order = {
              id,
              ...form,
              payment: pay,
              payTiming,
              coupon,
              items: items.map((i) => {
                const b = readBookById(i.bookId)!;
                return {
                  bookId: i.bookId,
                  title: b?.title || "Sách",
                  price: b?.salePrice || 0,
                  qty: i.quantity,
                };
              }),
              subtotal: subtotal(),
              discount: discountAmount(),
              shipping: shipping(),
              total: total(),
              status: "confirmed",
              eta: "2–5 ngày làm việc",
              createdAt: new Date().toISOString(),
            };
            const prev = JSON.parse(localStorage.getItem("booknest-orders") || "[]");
            localStorage.setItem("booknest-orders", JSON.stringify([order, ...prev]));
            clear();
            setDone(id);
          }}
        >
          <h2 className="font-bold text-white">Thông tin giao hàng</h2>
          {(["name", "phone", "address", "email"] as const).map((key) => (
            <input
              key={key}
              required={key !== "email"}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              placeholder={
                key === "name"
                  ? "Họ tên *"
                  : key === "phone"
                    ? "Số điện thoại *"
                    : key === "address"
                      ? "Địa chỉ giao hàng *"
                      : "Email (hóa đơn)"
              }
              className="admin-input !rounded-2xl"
            />
          ))}
          <textarea
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Ghi chú đơn hàng"
            className="admin-input min-h-24 !rounded-2xl"
          />

          <h2 className="pt-2 font-bold text-white">Thời điểm thanh toán</h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setPayTiming("cod");
                setPaymentMethod("COD");
              }}
              className={`rounded-2xl border px-3 py-3 text-sm font-semibold ${
                payTiming === "cod" ? "border-primary bg-primary/20 text-primary" : "border-white/10 bg-white/5"
              }`}
            >
              Pay after receiving (COD)
            </button>
            <button
              type="button"
              onClick={() => setPayTiming("now")}
              className={`rounded-2xl border px-3 py-3 text-sm font-semibold ${
                payTiming === "now" ? "border-primary bg-primary/20 text-primary" : "border-white/10 bg-white/5"
              }`}
            >
              Pay now
            </button>
          </div>

          {payTiming === "now" && (
            <>
              <h2 className="pt-2 font-bold text-white">Phương thức thanh toán</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {payments.filter((p) => p !== "COD").map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPaymentMethod(p)}
                    className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                      paymentMethod === p
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-white/10 bg-white/5 text-text-secondary hover:bg-primary/10 hover:text-white"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </>
          )}

          <button type="submit" className="btn-primary w-full py-3.5 text-sm">
            Xác nhận đặt hàng · {formatVND(total())}
          </button>
        </form>

        <aside className="glass h-fit rounded-[24px] p-6">
          <h2 className="font-bold text-white">Tóm tắt</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {items.map((i) => {
              const b = readBookById(i.bookId);
              if (!b) return null;
              return (
                <li key={i.bookId} className="flex justify-between gap-2">
                  <span className="line-clamp-2 text-text-secondary">
                    {b.title} × {i.quantity}
                  </span>
                  <span className="shrink-0 font-semibold">{formatVND(b.salePrice * i.quantity)}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Tạm tính</span>
              <span>{formatVND(subtotal())}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Giảm {coupon && `(${coupon})`}</span>
              <span>−{formatVND(discountAmount())}</span>
            </div>
            {couponMessage() && <p className="text-xs text-primary">{couponMessage()}</p>}
            <div className="flex justify-between">
              <span className="text-muted">Ship (ước tính)</span>
              <span>{shipping() === 0 ? "Free" : formatVND(shipping())}</span>
            </div>
            <p className="text-xs text-muted">Giao dự kiến 1–5 ngày làm việc</p>
            <div className="flex justify-between text-base font-extrabold">
              <span>Tổng</span>
              <span className="text-primary">{formatVND(total())}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
