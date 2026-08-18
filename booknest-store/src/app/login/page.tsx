"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/store/auth";
import { useCatalog } from "@/store/catalog";

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/account";
  const { login, register, loading, error, clearError, isAuthenticated, user } = useAuth();
  const catalogLogin = useCatalog((s) => s.login);
  const catalogLogout = useCatalog((s) => s.logout);
  const isAdmin = useCatalog((s) => s.isAdmin);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [adminUser, setAdminUser] = useState("");
  const [adminPw, setAdminPw] = useState("");
  const [adminMsg, setAdminMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    const ok = mode === "login" ? await login(email, password) : await register(email, password, name);
    if (ok) router.push(next);
  }

  if (isAuthenticated && user) {
    return (
      <div className="py-10">
        <h1 className="section-title text-3xl">Tài khoản</h1>
        <div className="glass mt-6 max-w-lg rounded-[24px] p-6">
          <p className="text-sm text-muted">Đã đăng nhập</p>
          <p className="mt-2 text-lg font-bold text-white">{user.name}</p>
          <p className="text-sm text-muted">{user.email}</p>
          <div className="mt-6 flex gap-2">
            <Link href="/account" className="btn-primary px-5 py-2.5 text-sm">
              Quản lý tài khoản
            </Link>
            <button type="button" onClick={() => useAuth.getState().logout()} className="btn-secondary px-5 py-2.5 text-sm">
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-10">
      <h1 className="section-title text-3xl">Đăng nhập</h1>
      <p className="mt-1 text-sm text-muted">
        Tài khoản dùng chung giữa website và chatbot AI · Đã đăng ký sẽ đồng bộ giỏ hàng/đơn hàng khi backend chạy.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="glass rounded-[24px] p-6">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                clearError();
              }}
              className={`rounded-full px-4 py-2 text-sm font-bold ${mode === "login" ? "btn-primary" : "btn-secondary"}`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                clearError();
              }}
              className={`rounded-full px-4 py-2 text-sm font-bold ${mode === "register" ? "btn-primary" : "btn-secondary"}`}
            >
              Đăng ký
            </button>
          </div>

          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            {mode === "register" && (
              <input
                className="admin-input !rounded-2xl"
                placeholder="Tên hiển thị"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
            <input
              className="admin-input !rounded-2xl"
              placeholder="Email *"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div className="relative">
              <input
                className="admin-input !rounded-2xl pr-16"
                placeholder="Mật khẩu * (≥6 ký tự)"
                type={showPw ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-xs font-bold text-muted hover:text-white"
              >
                {showPw ? "Ẩn" : "Hiện"}
              </button>
            </div>

            {error && (
              <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-sm disabled:opacity-50">
              {loading ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
            </button>

            <p className="text-center text-xs text-muted">
              Backend: <code className="rounded bg-white/10 px-1 py-0.5">{process.env.NEXT_PUBLIC_BOOKNEST_AI_URL || "http://127.0.0.1:8000"}</code> · Nếu
              backend chưa chạy, tài khoản được lưu offline trên trình duyệt này.
            </p>
          </form>
        </div>

        <div className="glass rounded-[24px] p-6">
          <h2 className="font-bold text-white">Admin / CMS</h2>
          <p className="mt-1 text-xs text-muted">Đăng nhập CMS quản lý catalog (local, không qua backend).</p>
          {isAdmin ? (
            <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">
              Đang ở chế độ Admin.
              <button type="button" onClick={() => catalogLogout()} className="btn-secondary ml-3 px-3 py-1.5 text-xs">
                Thoát Admin
              </button>
            </div>
          ) : (
            <form
              className="mt-4 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                const ok = catalogLogin(adminUser, adminPw);
                setAdminMsg(ok ? "Đã vào Admin — vào /admin để quản lý." : "Sai tài khoản Admin. Thử admin / BookNest@2026");
                if (ok) router.push("/admin");
              }}
            >
              <input
                className="admin-input !rounded-2xl"
                placeholder="Admin username (admin)"
                value={adminUser}
                onChange={(e) => setAdminUser(e.target.value)}
              />
              <input
                className="admin-input !rounded-2xl"
                placeholder="Admin password"
                type="password"
                value={adminPw}
                onChange={(e) => setAdminPw(e.target.value)}
              />
              <button type="submit" className="btn-secondary w-full py-2.5 text-sm">
                Đăng nhập Admin
              </button>
              {adminMsg && <p className="text-xs text-muted">{adminMsg}</p>}
            </form>
          )}
          <Link href="/account" className="mt-4 inline-flex text-sm font-semibold text-primary hover:text-highlight">
            Đi tới Tài khoản →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-10 text-sm text-muted">Đang tải…</div>}>
      <LoginInner />
    </Suspense>
  );
}
