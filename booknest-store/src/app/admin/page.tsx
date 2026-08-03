"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Boxes,
  Bot,
  ImagePlus,
  LayoutDashboard,
  Lock,
  LogOut,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ShoppingCart,
  Star,
  TicketPercent,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { categories } from "@/data/categories";
import { formatVND } from "@/lib/utils";
import { ADMIN_CREDENTIALS_HINT, useCatalog } from "@/store/catalog";
import type { Book } from "@/types";
import { BookCover } from "@/components/books/BookCover";
import { compressImageFile } from "@/lib/image";
import { readAnalytics } from "@/store/memory";
import { useVouchers } from "@/store/vouchers";

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "products", label: "Sách & Giá", icon: BookOpen },
  { id: "orders", label: "Đơn hàng", icon: ShoppingCart },
  { id: "ai", label: "AI Concierge", icon: Bot },
  { id: "vouchers", label: "Vouchers", icon: TicketPercent },
  { id: "categories", label: "Danh mục", icon: Package },
  { id: "inventory", label: "Tồn kho", icon: Boxes },
  { id: "coupons", label: "Coupon", icon: TicketPercent },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "customers", label: "Khách hàng", icon: Users },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

type Order = {
  id: string;
  status?: string;
  address?: string;
  total?: number;
  payment?: string;
  name?: string;
  phone?: string;
  items?: { bookId?: number; id?: number; title?: string; qty?: number; price?: number }[];
};

type ChatEntry = {
  id: string;
  role: string;
  text?: string;
  at?: number;
};

type FormState = {
  title: string;
  author: string;
  category: string;
  price: string;
  salePrice: string;
  stock: string;
  imageUrl: string;
  description: string;
  featured: boolean;
  flashSale: boolean;
  bestseller: boolean;
  newArrival: boolean;
};

function bookToForm(b: Book): FormState {
  return {
    title: b.title,
    author: b.author,
    category: b.category,
    price: String(b.price),
    salePrice: String(b.salePrice),
    stock: String(b.stock),
    imageUrl: b.images?.[0] || "",
    description: b.description || "",
    featured: b.featured,
    flashSale: b.flashSale,
    bestseller: b.bestseller,
    newArrival: b.newArrival,
  };
}

const emptyForm: FormState = {
  title: "",
  author: "",
  category: "Self Help",
  price: "150000",
  salePrice: "120000",
  stock: "30",
  imageUrl: "",
  description: "",
  featured: false,
  flashSale: false,
  bestseller: false,
  newArrival: true,
};

export default function AdminPage() {
  const {
    books,
    isAdmin,
    adminName,
    login,
    logout,
    updateBook,
    addBook,
    deleteBook,
    resetCatalog,
    hydrated,
    clearError,
  } = useCatalog();

  const [tab, setTab] = useState("products");
  const [orders, setOrders] = useState<Order[]>([]);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Book | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [toast, setToast] = useState("");
  const [uploading, setUploading] = useState(false);
  const [analytics, setAnalytics] = useState<ReturnType<typeof readAnalytics>>([]);
  const [chatLog, setChatLog] = useState<ChatEntry[]>([]);
  const vouchers = useVouchers((s) => s.vouchers);
  const toggleVoucher = useVouchers((s) => s.toggleVoucher);
  const deleteVoucher = useVouchers((s) => s.deleteVoucher);
  const addVoucher = useVouchers((s) => s.addVoucher);
  const dealRules = useVouchers((s) => s.dealRules);
  const setDealRules = useVouchers((s) => s.setDealRules);

  useEffect(() => {
    try {
      setOrders(JSON.parse(localStorage.getItem("booknest-orders") || "[]"));
    } catch {
      setOrders([]);
    }
    setAnalytics(readAnalytics());
    try {
      const mem = JSON.parse(localStorage.getItem("booknest-customer-memory-v1") || "{}");
      setChatLog(mem?.state?.chatHistory || []);
    } catch {
      setChatLog([]);
    }
  }, [tab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        String(b.id) === q
    );
  }, [books, query]);

  const stats = useMemo(() => {
    const revenue = orders.reduce((s, o) => s + (o.total || 0), 0);
    return {
      revenue,
      orders: orders.length,
      products: books.length,
      lowStock: books.filter((b) => b.stock < 40).length,
      avgRating: books.length
        ? (books.reduce((s, b) => s + b.rating, 0) / books.length).toFixed(1)
        : "0",
    };
  }, [orders, books]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const openEdit = (b: Book) => {
    setCreating(false);
    setEditing(b);
    setForm(bookToForm(b));
  };

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setForm(emptyForm);
  };

  const closeEditor = () => {
    setEditing(null);
    setCreating(false);
  };

  const onUpload = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Chỉ chấp nhận file ảnh");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast("File gốc tối đa 8MB (sẽ được nén khi lưu)");
      return;
    }
    try {
      setUploading(true);
      clearError();
      const dataUrl = await compressImageFile(file, 720, 0.78);
      setForm((f) => ({ ...f, imageUrl: dataUrl }));
      showToast("Đã nén & gắn ảnh bìa — bấm Lưu thay đổi");
    } catch {
      showToast("Không xử lý được ảnh. Thử file khác hoặc dán URL.");
    } finally {
      setUploading(false);
    }
  };

  const saveEditor = () => {
    const price = Number(form.price) || 0;
    const salePrice = Number(form.salePrice) || 0;
    const stock = Number(form.stock) || 0;
    if (!form.title.trim() || !form.author.trim()) {
      showToast("Nhập tên sách và tác giả");
      return;
    }
    if (salePrice > price) {
      showToast("Giá sale không được cao hơn giá gốc");
      return;
    }

    // Bỏ placeholder text nếu lỡ dán nhầm
    let imageUrl = form.imageUrl.trim();
    if (imageUrl.startsWith("(đã")) imageUrl = editing?.images?.[0] || "";

    const patch: Partial<Book> = {
      title: form.title.trim(),
      author: form.author.trim(),
      category: form.category,
      price,
      salePrice,
      stock,
      description: form.description,
      summary: form.description || editing?.summary,
      featured: form.featured,
      flashSale: form.flashSale,
      bestseller: form.bestseller,
      newArrival: form.newArrival,
    };
    if (imageUrl) {
      patch.images = [imageUrl];
    }

    if (creating) {
      addBook({ ...patch, title: patch.title!, author: patch.author! });
      showToast("Đã thêm sách mới — kiểm tra trang chủ");
      closeEditor();
      return;
    }
    if (editing) {
      const ok = updateBook(editing.id, patch);
      if (ok) {
        showToast("Đã lưu! Ảnh & giá đã đồng bộ storefront");
        closeEditor();
      } else {
        const err = useCatalog.getState().lastError;
        showToast(err || "Lưu thất bại — bộ nhớ trình duyệt có thể đầy");
      }
    }
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted">
        Đang tải CMS...
      </div>
    );
  }

  // —— LOGIN GATE ——
  if (!isAdmin) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
        <div className="glass rounded-[28px] p-8 shadow-xl">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="section-title text-2xl">Admin BookNest</h1>
          <p className="mt-1 text-sm text-muted">
            Đăng nhập để chỉnh sửa sách, giá, ảnh bìa và nội dung website.
          </p>
          <form
            className="mt-6 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const ok = login(user, pass);
              if (!ok) setLoginError("Sai tài khoản hoặc mật khẩu");
              else setLoginError("");
            }}
          >
            <input
              className="admin-input"
              placeholder="Tên đăng nhập"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              autoComplete="username"
            />
            <input
              className="admin-input"
              type="password"
              placeholder="Mật khẩu"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="current-password"
            />
            {loginError && <p className="text-sm font-medium text-sale">{loginError}</p>}
            <button type="submit" className="btn-primary w-full py-3 text-sm">
              Đăng nhập Admin
            </button>
          </form>
          <div className="mt-5 rounded-2xl bg-primary/5 p-3 text-xs text-muted">
            <p className="font-semibold text-primary">Tài khoản demo</p>
            <p>
              User: <code className="font-mono">{ADMIN_CREDENTIALS_HINT.username}</code>
            </p>
            <p>
              Pass: <code className="font-mono">{ADMIN_CREDENTIALS_HINT.password}</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-10">
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-secondary">CMS quản trị</p>
          <h1 className="section-title text-3xl">Xin chào, {adminName}</h1>
          <p className="mt-1 text-sm text-muted">
            Sửa giá · upload ảnh bìa · thêm sách · thay đổi hiển thị realtime trên web
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (confirm("Khôi phục dữ liệu sách gốc (mất chỉnh sửa local)?")) {
                resetCatalog();
                showToast("Đã reset catalog");
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset data
          </button>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-full bg-sale px-3 py-2 text-xs font-bold text-white"
          >
            <LogOut className="h-3.5 w-3.5" /> Đăng xuất
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
        <aside className="glass h-fit rounded-[24px] p-3">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`mb-1 flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                  tab === t.id
                    ? "bg-gradient-to-r from-primary to-secondary text-white"
                    : "hover:bg-primary/5"
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </aside>

        <section className="glass rounded-[24px] p-5 sm:p-6">
          {tab === "dashboard" && (
            <div>
              <h2 className="section-title text-xl">Tổng quan</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  ["Doanh thu demo", formatVND(stats.revenue)],
                  ["Đơn hàng", String(stats.orders)],
                  ["Sản phẩm", String(stats.products)],
                  ["Tồn thấp", String(stats.lowStock)],
                  ["Rating TB", stats.avgRating],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-[20px] bg-gradient-to-br from-primary to-secondary p-5 text-white shadow-lg"
                  >
                    <p className="text-xs font-semibold opacity-90">{label}</p>
                    <p className="mt-2 text-2xl font-extrabold">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "products" && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="section-title text-xl">Quản lý sách</h2>
                  <p className="text-sm text-muted">{filtered.length} sản phẩm</p>
                </div>
                <button type="button" onClick={openCreate} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 text-sm">
                  <Plus className="h-4 w-4" /> Thêm sách
                </button>
              </div>

              <input
                className="admin-input mt-4"
                placeholder="Tìm theo tên, tác giả, danh mục, ID..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />

              <div className="mt-4 space-y-3">
                {filtered.map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 sm:flex-row sm:items-center"
                  >
                    <div className="w-full sm:w-20 shrink-0">
                      <BookCover
                        title={b.title}
                        author={b.author}
                        gradient={b.coverGradient}
                        image={b.images?.[0]}
                        size="sm"
                        className="!h-28"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-secondary">#{b.id} · {b.category}</p>
                      <p className="truncate font-bold">{b.title}</p>
                      <p className="text-xs text-muted">{b.author}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-extrabold text-sale">{formatVND(b.salePrice)}</span>
                        <span className="text-xs text-muted line-through">{formatVND(b.price)}</span>
                        <span className="rounded-full bg-primary/5 px-2 py-0.5 text-[11px] font-semibold">
                          Tồn {b.stock}
                        </span>
                        {b.flashSale && (
                          <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-bold text-[#8a6d12]">
                            Flash
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 sm:flex-col">
                      <button
                        type="button"
                        onClick={() => openEdit(b)}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-primary px-3 py-2 text-xs font-bold text-white sm:flex-none"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Xóa sách "${b.title}"?`)) {
                            deleteBook(b.id);
                            showToast("Đã xóa sách");
                          }
                        }}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-full border border-sale/30 px-3 py-2 text-xs font-bold text-sale sm:flex-none"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Xóa
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "orders" && (
            <div>
              <h2 className="section-title text-xl">Đơn hàng</h2>
              {orders.length === 0 ? (
                <p className="mt-4 text-sm text-muted">Chưa có đơn. Đặt thử ở Checkout.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="text-muted">
                      <tr>
                        <th className="pb-2">Mã</th>
                        <th className="pb-2">Khách</th>
                        <th className="pb-2">Tổng</th>
                        <th className="pb-2">TT</th>
                        <th className="pb-2">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id} className="border-t border-primary/10">
                          <td className="py-3 font-semibold text-primary">{o.id}</td>
                          <td className="py-3">
                            {o.name}
                            <br />
                            <span className="text-xs text-muted">{o.phone}</span>
                          </td>
                          <td className="py-3 font-bold">{formatVND(o.total || 0)}</td>
                          <td className="py-3">{o.payment}</td>
                          <td className="py-3">
                            <span className="rounded-full bg-secondary/15 px-2 py-1 text-xs font-bold text-secondary">
                              {o.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "categories" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((c) => (
                <div key={c.id} className="rounded-2xl border border-primary/10 p-4">
                  <p className="text-2xl">{c.icon}</p>
                  <p className="mt-2 font-bold">{c.name}</p>
                  <p className="text-xs text-muted">
                    {books.filter((b) => b.category.toLowerCase().includes(c.name.toLowerCase().slice(0, 4))).length} sách · /{c.slug}
                  </p>
                </div>
              ))}
            </div>
          )}

          {tab === "inventory" && (
            <div className="space-y-2">
              {books
                .slice()
                .sort((a, b) => a.stock - b.stock)
                .map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-primary/10 px-4 py-3 text-sm"
                  >
                    <span className="font-semibold">{b.title}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        className="admin-input !w-24 !py-1.5"
                        value={b.stock}
                        onChange={(e) =>
                          updateBook(b.id, { stock: Number(e.target.value) || 0 })
                        }
                      />
                      <span className="text-xs text-muted">cuốn</span>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {tab === "coupons" && (
            <div className="space-y-3">
              {[
                ["WELCOME10", "Giảm 10% đơn đầu"],
                ["BOOKNEST15", "Giảm 15%"],
                ["FREESHIP", "Miễn phí ship"],
              ].map(([code, desc]) => (
                <div
                  key={code}
                  className="flex items-center justify-between rounded-2xl border border-primary/10 p-4"
                >
                  <div>
                    <p className="font-bold text-primary">{code}</p>
                    <p className="text-sm text-muted">{desc}</p>
                  </div>
                  <span className="rounded-full bg-secondary/15 px-2 py-1 text-xs font-bold text-secondary">
                    Active
                  </span>
                </div>
              ))}
            </div>
          )}

          {tab === "vouchers" && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="section-title text-xl">Voucher & campaigns</h2>
                  <p className="text-sm text-muted">Tạo / tạm dừng / xóa · bulk · AI deal rules</p>
                </div>
                <button
                  type="button"
                  className="btn-primary px-4 py-2 text-sm"
                  onClick={() =>
                    addVoucher({
                      code: "NEW" + Date.now().toString().slice(-4),
                      name: "Campaign mới",
                      type: "percent",
                      value: 10,
                      minOrder: 0,
                      minQty: 1,
                      usageLimit: 100,
                      startsAt: "2026-01-01",
                      endsAt: "2026-12-31",
                      active: true,
                      description: "Tạo từ Admin",
                    })
                  }
                >
                  + Tạo voucher
                </button>
              </div>
              <div className="space-y-2">
                {vouchers.map((v) => (
                  <div
                    key={v.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <div>
                      <p className="font-bold text-primary">{v.code}</p>
                      <p className="text-xs text-muted">
                        {v.name} · {v.type} · {v.value}
                        {v.type === "percent" || v.type === "bundle" ? "%" : "đ"} · used {v.used}/
                        {v.usageLimit}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-white/15 px-3 py-1 text-xs"
                        onClick={() => toggleVoucher(v.id)}
                      >
                        {v.active ? "Pause" : "Resume"}
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-highlight/40 px-3 py-1 text-xs text-highlight"
                        onClick={() => deleteVoucher(v.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-primary/25 bg-primary/10 p-4">
                <h3 className="font-bold text-white">AI negotiable discount rules</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="text-xs text-muted">
                    Max %
                    <input
                      type="number"
                      className="admin-input mt-1"
                      value={dealRules.maxDiscountPercent}
                      onChange={(e) => setDealRules({ maxDiscountPercent: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <label className="text-xs text-muted">
                    Min qty
                    <input
                      type="number"
                      className="admin-input mt-1"
                      value={dealRules.minQtyForDeal}
                      onChange={(e) => setDealRules({ minQtyForDeal: Number(e.target.value) || 1 })}
                    />
                  </label>
                  <label className="text-xs text-muted">
                    VIP extra %
                    <input
                      type="number"
                      className="admin-input mt-1"
                      value={dealRules.vipExtraPercent}
                      onChange={(e) => setDealRules({ vipExtraPercent: Number(e.target.value) || 0 })}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="btn-secondary mt-3 px-4 py-2 text-xs"
                  onClick={() => setDealRules({ enabled: !dealRules.enabled })}
                >
                  AI Deal: {dealRules.enabled ? "ON" : "OFF"}
                </button>
              </div>
            </div>
          )}

          {tab === "ai" && (
            <div className="space-y-6">
              <div>
                <h2 className="section-title text-xl">AI Sales Concierge</h2>
                <p className="mt-1 text-sm text-muted">
                  Hội thoại, tìm kiếm, lượt xem & tín hiệu chuyển đổi (local analytics).
                </p>
              </div>
              {(() => {
                const searches = analytics.filter((e) => e.type === "search");
                const views = analytics.filter((e) => e.type === "view");
                const chats = analytics.filter((e) => e.type === "chat");
                const searchCount = new Map<string, number>();
                for (const e of searches) {
                  const q = String(e.data?.q || "").toLowerCase();
                  if (!q) continue;
                  searchCount.set(q, (searchCount.get(q) || 0) + 1);
                }
                const topSearches = [...searchCount.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8);
                const viewCount = new Map<string, number>();
                for (const e of views) {
                  const t = String(e.data?.title || e.data?.bookId || "");
                  if (!t) continue;
                  viewCount.set(t, (viewCount.get(t) || 0) + 1);
                }
                const topViews = [...viewCount.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8);
                const catInterest = new Map<string, number>();
                for (const e of views) {
                  const c = String(e.data?.category || "");
                  if (!c) continue;
                  catInterest.set(c, (catInterest.get(c) || 0) + 1);
                }
                const topCats = [...catInterest.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6);
                const ordersN = orders.length;
                const conv =
                  views.length > 0
                    ? ((ordersN / Math.max(views.length, 1)) * 100).toFixed(1)
                    : "0";
                const abandoned =
                  analytics.filter((e) => e.type === "view").length > 3 && ordersN === 0;

                return (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        ["Chat messages", String(chats.length)],
                        ["Searches", String(searches.length)],
                        ["Book views", String(views.length)],
                        ["Est. conversion", `${conv}%`],
                      ].map(([k, v]) => (
                        <div
                          key={k}
                          className="rounded-2xl border border-primary/20 bg-primary/10 p-4"
                        >
                          <p className="text-xs font-semibold text-muted">{k}</p>
                          <p className="mt-1 text-2xl font-extrabold text-white">{v}</p>
                        </div>
                      ))}
                    </div>

                    {abandoned && (
                      <div className="rounded-2xl border border-highlight/30 bg-highlight/10 p-4 text-sm text-text-secondary">
                        <strong className="text-highlight">Abandoned interest:</strong> có lượt xem
                        nhưng chưa có đơn trên thiết bị này — Concierge nên chủ động gợi ý freeship /
                        coupon.
                      </div>
                    )}

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 p-4">
                        <h3 className="font-bold text-white">Most searched</h3>
                        <ul className="mt-3 space-y-2 text-sm">
                          {topSearches.length === 0 && (
                            <li className="text-muted">Chưa có dữ liệu tìm kiếm.</li>
                          )}
                          {topSearches.map(([q, n]) => (
                            <li key={q} className="flex justify-between gap-2">
                              <span className="text-text-secondary">{q}</span>
                              <span className="font-bold text-primary">{n}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-2xl border border-white/10 p-4">
                        <h3 className="font-bold text-white">Most viewed books</h3>
                        <ul className="mt-3 space-y-2 text-sm">
                          {topViews.length === 0 && (
                            <li className="text-muted">Chưa có lượt xem.</li>
                          )}
                          {topViews.map(([t, n]) => (
                            <li key={t} className="flex justify-between gap-2">
                              <span className="line-clamp-1 text-text-secondary">{t}</span>
                              <span className="font-bold text-primary">{n}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-2xl border border-white/10 p-4">
                        <h3 className="font-bold text-white">Trending categories</h3>
                        <ul className="mt-3 space-y-2 text-sm">
                          {topCats.length === 0 && (
                            <li className="text-muted">Chưa có tín hiệu.</li>
                          )}
                          {topCats.map(([c, n]) => (
                            <li key={c} className="flex justify-between">
                              <span>{c}</span>
                              <span className="text-primary font-bold">{n}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-3 text-xs text-muted">
                          Gợi ý tồn kho: nhập thêm sách ở nhóm trending nếu stock &lt; 40.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 p-4">
                        <h3 className="font-bold text-white">Sales snapshot</h3>
                        <p className="mt-2 text-sm text-text-secondary">
                          Đơn: <strong className="text-white">{ordersN}</strong>
                          <br />
                          Doanh thu demo:{" "}
                          <strong className="text-white">
                            {formatVND(orders.reduce((s, o) => s + (o.total || 0), 0))}
                          </strong>
                        </p>
                        <p className="mt-3 text-xs text-muted">
                          Báo cáo đầy đủ sẵn sàng khi nối NestJS + DB production.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 p-4">
                      <h3 className="font-bold text-white">Recent AI conversations</h3>
                      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                        {chatLog.length === 0 && (
                          <p className="text-sm text-muted">
                            Chưa có hội thoại. Mở widget Concierge trên storefront để tạo log.
                          </p>
                        )}
                        {[...chatLog]
                          .reverse()
                          .slice(0, 30)
                          .map((t) => (
                            <div
                              key={t.id}
                              className={`rounded-xl px-3 py-2 text-xs ${
                                t.role === "user"
                                  ? "bg-primary/15 text-white"
                                  : "bg-white/5 text-text-secondary"
                              }`}
                            >
                              <span className="font-bold uppercase opacity-70">
                                {t.role === "user" ? "KH" : "AI"}
                              </span>
                              <p className="mt-0.5 whitespace-pre-wrap line-clamp-4">{t.text}</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {(tab === "reviews" || tab === "customers" || tab === "analytics") && (
            <div>
              <h2 className="section-title text-xl capitalize">{tab}</h2>
              <p className="mt-3 text-sm text-muted">
                Xem chi tiết AI tại tab <strong className="text-primary">AI Concierge</strong>. Module
                CRM đầy đủ khi nối backend NestJS + PostgreSQL.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* EDITOR MODAL */}
      {(editing || creating) && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm sm:items-center">
          <div className="glass max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[24px] p-5 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="section-title text-xl">
                {creating ? "Thêm sách mới" : `Sửa: ${editing?.title}`}
              </h3>
              <button type="button" onClick={closeEditor} className="rounded-full p-2 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <div>
                <BookCover
                  title={form.title || "Preview"}
                  author={form.author || "Tác giả"}
                  gradient="from-[#0B3D5C] via-[#1A6B5A] to-[#C9A227]"
                  image={form.imageUrl}
                  size="sm"
                  className="!h-48"
                />
                <label className="btn-secondary mt-3 flex cursor-pointer items-center justify-center gap-1.5 py-2.5 text-xs">
                  <Upload className="h-3.5 w-3.5" /> {uploading ? "Đang nén..." : "Upload ảnh"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      onUpload(f);
                    }}
                  />
                </label>
                {form.imageUrl && (
                  <p className="mt-2 break-all text-[10px] text-muted">
                    {form.imageUrl.startsWith("data:")
                      ? `Ảnh local ~${Math.round(form.imageUrl.length / 1024)}KB`
                      : form.imageUrl.slice(0, 48) + "…"}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <input
                  className="admin-input"
                  placeholder="Tên sách *"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
                <input
                  className="admin-input"
                  placeholder="Tác giả *"
                  value={form.author}
                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                />
                <select
                  className="admin-input"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {[
                    "Self Help",
                    "Tiểu thuyết",
                    "Tài chính",
                    "Khoa học",
                    "Thiếu nhi",
                    "Comics",
                    "English",
                    "Lập trình",
                    "AI",
                    "Lịch sử",
                    "Tâm lý",
                    "Startup",
                    "Nấu ăn",
                    "Nuôi dạy con",
                    "Crypto",
                    "Sức khỏe",
                    "Kinh doanh",
                    "Công nghệ",
                  ].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-muted">Giá gốc</label>
                    <input
                      className="admin-input"
                      type="number"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-muted">Giá bán</label>
                    <input
                      className="admin-input"
                      type="number"
                      value={form.salePrice}
                      onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-muted">Tồn kho</label>
                    <input
                      className="admin-input"
                      type="number"
                      value={form.stock}
                      onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-muted">
                    <ImagePlus className="h-3.5 w-3.5" /> URL ảnh bìa (hoặc upload)
                  </label>
                  <input
                    className="admin-input"
                    placeholder="https://... (hoặc dùng Upload ảnh)"
                    value={form.imageUrl.startsWith("data:") ? "" : form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  />
                  {form.imageUrl.startsWith("data:") && (
                    <p className="mt-1 text-[11px] text-primary">Đang dùng ảnh đã upload (nén JPEG).</p>
                  )}
                </div>
                <textarea
                  className="admin-input min-h-24"
                  placeholder="Mô tả sách"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
                <div className="flex flex-wrap gap-3 text-xs font-semibold">
                  {(
                    [
                      ["featured", "Nổi bật"],
                      ["flashSale", "Flash sale"],
                      ["bestseller", "Bestseller"],
                      ["newArrival", "New"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="inline-flex items-center gap-1.5 rounded-full bg-primary/5 px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={form[key]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closeEditor} className="rounded-full border px-4 py-2.5 text-sm font-semibold">
                Hủy
              </button>
              <button type="button" onClick={saveEditor} className="btn-primary inline-flex items-center gap-1.5 px-5 py-2.5 text-sm">
                <Save className="h-4 w-4" /> Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
