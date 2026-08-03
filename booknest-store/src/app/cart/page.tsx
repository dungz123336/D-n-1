"use client";

import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/store/cart";
import { formatVND } from "@/lib/utils";
import { BookCover } from "@/components/books/BookCover";
import { useState } from "react";
import { useCatalog } from "@/store/catalog";
import { useVouchers } from "@/store/vouchers";

export default function CartPage() {
  const { items, setQty, remove, coupon, setCoupon, subtotal, discountAmount, shipping, total, count, couponMessage } =
    useCart();
  const getById = useCatalog((s) => s.getById);
  const negotiate = useVouchers((s) => s.negotiate);
  const [code, setCode] = useState(coupon);
  const [msg, setMsg] = useState("");
  const [deal, setDeal] = useState("");

  return (
    <div className="py-10">
      <h1 className="section-title text-3xl">Giỏ hàng</h1>
      <p className="mt-1 text-sm text-muted">
        {count()} sản phẩm · Bulk tự động 3/5/10 cuốn · Voucher & AI deal
      </p>

      {items.length === 0 ? (
        <div className="glass mt-8 rounded-[24px] p-10 text-center">
          <p className="text-muted">Giỏ hàng trống.</p>
          <Link href="/search" className="btn-primary mt-4 inline-flex px-6 py-3 text-sm">
            Tiếp tục mua sắm
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {items.map((item) => {
              const book = getById(item.bookId);
              if (!book) return null;
              return (
                <div key={item.bookId} className="glass flex gap-4 rounded-[20px] p-4">
                  <div className="w-24 shrink-0">
                    <BookCover
                      title={book.title}
                      author={book.author}
                      gradient={book.coverGradient}
                      image={book.images?.[0]}
                      size="sm"
                      className="!h-28"
                    />
                  </div>
                  <div className="flex flex-1 flex-col">
                    <Link href={`/books/${book.slug}`} className="font-bold text-white hover:text-primary">
                      {book.title}
                    </Link>
                    <p className="text-xs text-muted">{book.author}</p>
                    <p className="mt-1 font-extrabold text-primary">{formatVND(book.salePrice)}</p>
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <div className="flex items-center rounded-full border border-white/15 bg-white/5">
                        <button type="button" className="p-2 text-white" onClick={() => setQty(item.bookId, item.quantity - 1)}>
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="min-w-8 text-center text-sm font-bold text-white">{item.quantity}</span>
                        <button type="button" className="p-2 text-white" onClick={() => setQty(item.bookId, item.quantity + 1)}>
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <button type="button" onClick={() => remove(item.bookId)} className="text-highlight">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="glass h-fit rounded-[24px] p-6">
            <h2 className="font-bold text-white">Tóm tắt đơn</h2>
            <div className="mt-4 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Mã giảm giá"
                className="input-dark"
              />
              <button
                type="button"
                onClick={() => {
                  const r = setCoupon(code);
                  setMsg(r.message);
                }}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Áp dụng
              </button>
            </div>
            {(msg || couponMessage()) && (
              <p className="mt-2 text-xs text-primary">{msg || couponMessage()}</p>
            )}
            {coupon && <p className="mt-1 text-xs font-semibold text-highlight">Đang dùng: {coupon}</p>}

            <button
              type="button"
              className="mt-3 w-full rounded-full border border-primary/30 bg-primary/10 py-2 text-xs font-semibold text-primary"
              onClick={() => {
                const r = negotiate(count(), subtotal(), false);
                setDeal(r.message);
                if (r.percent > 0) {
                  setCoupon(`DEAL${r.percent}`);
                  setCode(`DEAL${r.percent}`);
                  setMsg(r.message);
                }
              }}
            >
              AI thương lượng deal (số lượng lớn)
            </button>
            {deal && <p className="mt-2 text-xs text-text-secondary">{deal}</p>}

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Tạm tính</span>
                <span>{formatVND(subtotal())}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Giảm giá</span>
                <span>−{formatVND(discountAmount())}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Ship</span>
                <span>{shipping() === 0 ? "Miễn phí" : formatVND(shipping())}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-3 text-base font-extrabold">
                <span>Tổng</span>
                <span className="text-primary">{formatVND(total())}</span>
              </div>
            </div>
            <Link href="/checkout" className="btn-primary mt-6 flex w-full items-center justify-center py-3 text-sm">
              Thanh toán
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
