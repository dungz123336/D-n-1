"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatVND } from "@/lib/utils";
import { useAuth } from "@/store/auth";

type Order = {
  id: string;
  status: string;
  address: string;
  total: number;
  payment: string;
};

export default function AccountPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    try {
      setOrders(JSON.parse(localStorage.getItem("booknest-orders") || "[]"));
    } catch {
      setOrders([]);
    }
  }, []);

  return (
    <div className="py-10">
      <h1 className="section-title text-3xl">Tài khoản</h1>
      <p className="mt-1 text-sm text-muted">Đơn hàng · Membership · Theo dõi trên thiết bị này</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="glass rounded-[24px] p-6">
          <h2 className="font-bold text-white">Đăng nhập</h2>
          {isAuthenticated && user ? (
            <>
              <div className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3">
                <p className="text-sm font-bold text-white">{user.name}</p>
                <p className="text-xs text-emerald-100/80">{user.email}</p>
                <p className="mt-1 text-xs text-muted">ID: {user.id}</p>
              </div>
              <button
                type="button"
                onClick={() => logout()}
                className="btn-secondary mt-4 w-full py-3 text-sm"
              >
                Đăng xuất
              </button>
              <Link href="/checkout" className="btn-primary mt-2 flex w-full justify-center py-3 text-sm">
                Đi tới thanh toán
              </Link>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted">Đăng nhập để đồng bộ giỏ/đơn với AI và backend.</p>
              <Link href="/login?next=/account" className="btn-primary mt-4 flex w-full justify-center py-3 text-sm">
                Đăng nhập / Đăng ký
              </Link>
              <button
                type="button"
                onClick={() => router.push("/login?next=/checkout")}
                className="btn-secondary mt-2 w-full py-2.5 text-sm"
              >
                Đăng nhập để thanh toán
              </button>
            </>
          )}
        </div>
        <div className="glass rounded-[24px] p-6">
          <h2 className="font-bold text-white">Hạng thành viên</h2>
          <p className="mt-2 text-sm text-muted">
            {isAuthenticated ? `Xin chào ${user?.name || ""} · Gold · 2.450 điểm` : "Gold · 2.450 điểm thưởng"}
          </p>
          <div className="mt-4 h-2 rounded-full bg-white/10">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-primary to-highlight" />
          </div>
          <p className="mt-2 text-xs text-muted">Còn 550 điểm để lên Diamond</p>
          <Link href="/membership" className="mt-3 inline-flex text-sm font-semibold text-primary hover:text-highlight">
            Xem quyền lợi →
          </Link>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="section-title text-xl">Đơn hàng của bạn</h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Chưa có đơn.{" "}
            <Link href="/search" className="font-semibold text-primary">
              Mua sắm ngay
            </Link>
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="glass rounded-[20px] p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-primary">{o.id}</span>
                  <span className="rounded-full bg-primary/15 px-2 py-1 text-xs font-bold text-primary">{o.status}</span>
                </div>
                <p className="mt-1 text-muted">{o.address}</p>
                <p className="mt-1 font-extrabold text-white">
                  {formatVND(o.total)} · {o.payment}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
