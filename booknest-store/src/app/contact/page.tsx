"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Clock,
  Headphones,
  LifeBuoy,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  Shield,
  Truck,
  Package,
  RefreshCcw,
  AlertTriangle,
  Handshake,
  Bug,
  Star,
  BookOpen,
  CreditCard,
  RotateCcw,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

const channels = [
  {
    t: "Live Chat",
    d: "Concierge AI 24/7 · góc phải",
    action: "chat" as const,
    icon: MessageCircle,
    color: "from-violet-500/30 to-fuchsia-500/20",
  },
  {
    t: "Hotline",
    d: "1900 266 563",
    href: "tel:1900266563",
    icon: Phone,
    color: "from-primary/30 to-purple-600/20",
  },
  {
    t: "Email",
    d: "care@booknest.vn",
    href: "mailto:care@booknest.vn",
    icon: Mail,
    color: "from-indigo-500/30 to-violet-500/20",
  },
  {
    t: "Messenger",
    d: "m.me/booknest",
    href: "https://m.me/booknest",
    icon: MessageSquare,
    color: "from-blue-500/25 to-violet-500/20",
  },
  {
    t: "Telegram",
    d: "@booknest_care",
    href: "https://t.me/booknest_care",
    icon: Send,
    color: "from-sky-500/25 to-violet-500/20",
  },
  {
    t: "Facebook",
    d: "facebook.com/booknest",
    href: "https://facebook.com/booknest",
    icon: MessageCircle,
    color: "from-blue-600/25 to-purple-500/20",
  },
  {
    t: "TikTok",
    d: "@booknest.vn",
    href: "https://www.tiktok.com/@booknest.vn",
    icon: Headphones,
    color: "from-pink-500/25 to-violet-500/20",
  },
  {
    t: "Zalo",
    d: "OA BookNest",
    href: "https://zalo.me/booknest",
    icon: MessageCircle,
    color: "from-cyan-500/25 to-violet-500/20",
  },
];

const supportActions = [
  { t: "Order Tracking", subject: "Theo dõi đơn hàng", icon: Package, intent: "track" },
  { t: "Refund Request", subject: "Yêu cầu hoàn tiền", icon: CreditCard, intent: "refund" },
  { t: "Return Request", subject: "Yêu cầu đổi trả", icon: RotateCcw, intent: "return" },
  { t: "Warranty Request", subject: "Bảo hành / lỗi in", icon: Shield, intent: "warranty" },
  { t: "Report Payment Issue", subject: "Sự cố thanh toán", icon: AlertTriangle, intent: "payment" },
  { t: "Report Delivery Issue", subject: "Sự cố giao hàng", icon: Truck, intent: "delivery" },
  { t: "Live Chat", subject: "Live Chat", icon: MessageCircle, intent: "chat" },
  { t: "Book Recommendation", subject: "Gợi ý sách", icon: BookOpen, intent: "recommend" },
  { t: "Contact Sales", subject: "Liên hệ Sales", icon: Headphones, intent: "sales" },
  { t: "Become a Partner", subject: "Đăng ký đối tác", icon: Handshake, intent: "partner" },
  { t: "Business Cooperation", subject: "Hợp tác doanh nghiệp", icon: Building2, intent: "biz" },
  { t: "Report Website Errors", subject: "Báo lỗi website", icon: Bug, intent: "bug" },
  { t: "Customer Feedback", subject: "Góp ý khách hàng", icon: Star, intent: "feedback" },
];

const faqs = [
  {
    q: "Ship bao lâu?",
    a: "Nội thành HCM/HN: 1–2 ngày. Toàn quốc: 2–5 ngày làm việc. Freeship đơn từ 200.000đ (trừ vùng sâu/xa theo chính sách).",
  },
  {
    q: "Đổi trả thế nào?",
    a: "Trong 7 ngày với sách lỗi in, hỏng do vận chuyển, hoặc sai sản phẩm. Giữ nguyên tem/seal khi có. Gửi ticket Return Request kèm ảnh.",
  },
  {
    q: "Hoàn tiền mất bao lâu?",
    a: "COD: không thu tiền. Online (MoMo/VNPay/thẻ): 3–7 ngày làm việc sau khi duyệt refund.",
  },
  {
    q: "Thanh toán những hình thức nào?",
    a: "COD, MoMo, VNPay, ZaloPay, thẻ nội địa/quốc tế, chuyển khoản, Apple Pay / Google Pay (demo UI).",
  },
  {
    q: "Voucher & bulk?",
    a: "Mã BULK5 / BULK10 / BULK20 cho mua 3/5/10 cuốn. Flash sale & membership giảm thêm theo hạng.",
  },
  {
    q: "Theo dõi đơn ở đâu?",
    a: "Mục Order Tracking bên dưới hoặc /account — nhập mã BN-… để xem trạng thái demo.",
  },
];

const policies = [
  {
    id: "shipping",
    t: "Shipping Policy",
    icon: Truck,
    body: "Giao hàng toàn quốc qua đối tác 2H/24H/tiêu chuẩn. Freeship đơn ≥ 200.000đ. Kiểm tra hàng trước khi nhận với COD. Thời gian giao phụ thuộc khu vực và kho.",
  },
  {
    id: "refund",
    t: "Refund Policy",
    icon: CreditCard,
    body: "Hoàn tiền khi đơn hủy trước khi ship, hàng lỗi/sai đã được Care duyệt. Thời gian hoàn 3–7 ngày làm việc tùy cổng thanh toán. Ticket ưu tiên High/Urgent xử lý trước.",
  },
  {
    id: "return",
    t: "Return Policy",
    icon: RefreshCcw,
    body: "Đổi trả trong 7 ngày. Sách còn nguyên trạng (trừ lỗi do NSX/VC). Chi phí ship đổi trả: BookNest chịu nếu lỗi từ phía shop; khách chịu nếu đổi ý.",
  },
  {
    id: "warranty",
    t: "Warranty",
    icon: Shield,
    body: "Bảo hành lỗi kỹ thuật in ấn (trùng trang, thiếu trang, mực lem). Đổi 1-1 trong 15 ngày khi có hóa đơn/mã đơn.",
  },
  {
    id: "privacy",
    t: "Privacy Policy",
    icon: LifeBuoy,
    body: "BookNest không bán dữ liệu khách hàng. Thông tin chỉ dùng để xử lý đơn, chăm sóc và cá nhân hóa gợi ý. Bạn có thể yêu cầu xóa dữ liệu qua ticket Privacy.",
  },
];

const SUBJECTS = [
  "Đơn hàng",
  "Theo dõi đơn hàng",
  "Yêu cầu hoàn tiền",
  "Yêu cầu đổi trả",
  "Bảo hành / lỗi in",
  "Sự cố thanh toán",
  "Sự cố giao hàng",
  "Gợi ý sách",
  "Liên hệ Sales",
  "Đăng ký đối tác",
  "Hợp tác doanh nghiệp",
  "Báo lỗi website",
  "Góp ý khách hàng",
  "Voucher",
  "Tài khoản",
  "Khác",
];

function openLiveChat(prefill?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("booknest-open-chat", { detail: { prefill: prefill || "" } })
  );
}

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    order: "",
    subject: "Đơn hàng",
    priority: "Normal",
    message: "",
  });
  const [fileName, setFileName] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [trackId, setTrackId] = useState("");
  const [trackResult, setTrackResult] = useState<string | null>(null);
  const [policyOpen, setPolicyOpen] = useState<string | null>("shipping");

  useEffect(() => {
    // deep link: /contact?subject=...
    try {
      const params = new URLSearchParams(window.location.search);
      const s = params.get("subject");
      if (s) setForm((f) => ({ ...f, subject: s }));
      const intent = params.get("intent");
      if (intent === "chat") openLiveChat();
    } catch {
      /* */
    }
  }, []);

  const applySupportAction = (item: (typeof supportActions)[number]) => {
    if (item.intent === "chat") {
      openLiveChat("Xin chào Care, mình cần hỗ trợ.");
      return;
    }
    if (item.intent === "recommend") {
      openLiveChat("Mình cần gợi ý sách phù hợp.");
      return;
    }
    if (item.intent === "track") {
      document.getElementById("order-tracking")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setForm((f) => ({
      ...f,
      subject: item.subject,
      priority: ["payment", "delivery", "refund"].includes(item.intent) ? "High" : f.priority,
    }));
    document.getElementById("support-ticket")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleTrack = () => {
    const id = trackId.trim();
    if (!id) {
      setTrackResult("Vui lòng nhập mã đơn (vd: BN-123456).");
      return;
    }
    try {
      const orders = JSON.parse(localStorage.getItem("booknest-orders") || "[]");
      const hit = orders.find(
        (o: { id?: string; code?: string; name?: string; status?: string; total?: number }) =>
          String(o.id || o.code || "").toLowerCase() === id.toLowerCase() ||
          String(o.id || "").includes(id.replace(/\D/g, ""))
      );
      if (hit) {
        setTrackResult(
          `Đơn **${hit.id || id}**: trạng thái ${hit.status || "Đang xử lý"} · ${
            hit.items?.length || 0
          } sản phẩm · tổng ${hit.total ? hit.total.toLocaleString("vi-VN") + "đ" : "—"} · cập nhật ${
            hit.at || hit.createdAt || "gần đây"
          }.`
        );
      } else {
        setTrackResult(
          `Chưa thấy đơn **${id}** trên thiết bị này. Kiểm tra lại mã hoặc tạo ticket “Theo dõi đơn hàng”.`
        );
      }
    } catch {
      setTrackResult("Không đọc được lịch sử đơn. Thử lại hoặc liên hệ hotline.");
    }
  };

  return (
    <div className="py-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] border border-primary/30 bg-gradient-to-br from-[#2D174A] via-[#23103A] to-[#160726] p-8 sm:p-12">
        <div className="pointer-events-none absolute -right-10 top-0 h-56 w-56 rounded-full bg-primary/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-10 h-40 w-40 rounded-full bg-highlight/20 blur-3xl" />
        <p className="section-kicker relative">Customer Support Center</p>
        <h1 className="section-title relative mt-3 text-4xl sm:text-5xl">Need Help?</h1>
        <p className="relative mt-3 max-w-xl text-lg text-text-secondary">
          We&apos;re Always Here For You. — BookNest Care phản hồi nhanh, minh bạch, đồng hành đến đơn
          hoàn tất.
        </p>
        <p className="relative mt-4 text-sm text-primary">
          Thời gian phản hồi dự kiến: &lt; 2 giờ (8:30–21:30) · Emergency 24/7
        </p>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => openLiveChat()}
            className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
          >
            <MessageCircle className="h-4 w-4" /> Live Chat ngay
          </button>
          <a href="tel:1900266563" className="btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm">
            <Phone className="h-4 w-4" /> Gọi hotline
          </a>
        </div>
      </section>

      {/* Support cards */}
      <section className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Kênh hỗ trợ">
        {channels.map((c) => {
          const inner = (
            <>
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br",
                  c.color
                )}
              >
                <c.icon className="h-5 w-5 text-primary transition group-hover:scale-110" />
              </div>
              <p className="mt-3 font-bold text-white">{c.t}</p>
              <p className="text-xs text-muted">{c.d}</p>
            </>
          );
          if ("action" in c && c.action === "chat") {
            return (
              <button
                key={c.t}
                type="button"
                onClick={() => openLiveChat()}
                className="glass group rounded-[20px] p-4 text-left transition hover:-translate-y-1 hover:border-primary/40"
              >
                {inner}
              </button>
            );
          }
          return (
            <a
              key={c.t}
              href={c.href}
              target={c.href?.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="glass group rounded-[20px] p-4 transition hover:-translate-y-1 hover:border-primary/40"
            >
              {inner}
            </a>
          );
        })}
      </section>

      {/* Quick support center actions */}
      <section className="mt-10">
        <h2 className="section-title text-2xl">Customer Support Center</h2>
        <p className="mt-1 text-sm text-muted">
          Chọn nhu cầu — form ticket sẽ được điền sẵn hoặc mở Live Chat / tracking.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
          {supportActions.map((l) => (
            <button
              key={l.t}
              type="button"
              onClick={() => applySupportAction(l)}
              className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm font-semibold text-text-secondary transition hover:border-primary/40 hover:text-white"
            >
              <l.icon className="h-4 w-4 shrink-0 text-primary" />
              {l.t}
            </button>
          ))}
        </div>
      </section>

      {/* Order tracking */}
      <section id="order-tracking" className="glass mt-10 rounded-[24px] p-6">
        <h2 className="section-title text-xl">Order Tracking</h2>
        <p className="mt-1 text-sm text-muted">Nhập mã đơn BookNest để xem trạng thái (local demo).</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            className="admin-input flex-1"
            placeholder="Mã đơn BN-…"
            value={trackId}
            onChange={(e) => setTrackId(e.target.value)}
            aria-label="Mã đơn hàng"
          />
          <button type="button" className="btn-primary px-5 py-2.5 text-sm" onClick={handleTrack}>
            Tra cứu
          </button>
        </div>
        {trackResult && (
          <p className="mt-3 text-sm text-text-secondary" dangerouslySetInnerHTML={{ __html: trackResult.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />
        )}
        <p className="mt-2 text-xs text-muted">
          Hoặc xem lịch sử tại{" "}
          <Link href="/account" className="text-primary hover:underline">
            Tài khoản
          </Link>
          .
        </p>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="glass space-y-4 rounded-[24px] p-6">
          <h2 className="section-title text-2xl">Business Information</h2>
          <div className="flex gap-3 text-sm text-text-secondary">
            <Building2 className="h-4 w-4 shrink-0 text-primary" />
            BookNest JSC · MST 0312 456 789
          </div>
          <div className="flex gap-3 text-sm text-text-secondary">
            <MapPin className="h-4 w-4 shrink-0 text-primary" />
            Office: 88 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh
          </div>
          <div className="flex gap-3 text-sm text-text-secondary">
            <Phone className="h-4 w-4 text-primary" />
            Hotline 1900 266 563 · Emergency 0901 266 563
          </div>
          <div className="flex gap-3 text-sm text-text-secondary">
            <Clock className="h-4 w-4 text-primary" />
            Working hours: 8:30–21:30 (Thứ 2 – Chủ nhật)
          </div>
          <div className="flex gap-3 text-sm text-text-secondary">
            <Mail className="h-4 w-4 text-primary" />
            care@booknest.vn · partners@booknest.vn
          </div>
          <div className="overflow-hidden rounded-[20px] border border-white/10">
            <iframe
              title="BookNest office map"
              className="h-56 w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src="https://maps.google.com/maps?q=Nguyen%20Hue%20District%201%20Ho%20Chi%20Minh&t=&z=15&ie=UTF8&iwloc=&output=embed"
            />
          </div>
        </div>

        <div id="support-ticket" className="glass rounded-[24px] p-6">
          <h2 className="section-title text-2xl">Support Ticket Form</h2>
          {sent ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-primary">
                Ticket <strong>{sent}</strong> đã được tạo. Care sẽ phản hồi qua email/SĐT trong &lt; 2
                giờ làm việc (priority {form.priority}).
              </p>
              <button
                type="button"
                className="btn-secondary px-4 py-2 text-sm"
                onClick={() => {
                  setSent(null);
                  setForm((f) => ({ ...f, message: "", order: "" }));
                  setFileName("");
                }}
              >
                Tạo ticket khác
              </button>
            </div>
          ) : (
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const id = "BN-TK-" + Date.now().toString().slice(-6);
                try {
                  const list = JSON.parse(localStorage.getItem("booknest-tickets") || "[]");
                  list.unshift({ ...form, fileName, id, at: new Date().toISOString() });
                  localStorage.setItem("booknest-tickets", JSON.stringify(list.slice(0, 80)));
                } catch {
                  /* */
                }
                setSent(id);
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="admin-input"
                  required
                  placeholder="Full name *"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoComplete="name"
                />
                <input
                  className="admin-input"
                  required
                  placeholder="Phone number *"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  autoComplete="tel"
                />
              </div>
              <input
                className="admin-input"
                required
                type="email"
                placeholder="Email *"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoComplete="email"
              />
              <input
                className="admin-input"
                placeholder="Order number (optional)"
                value={form.order}
                onChange={(e) => setForm({ ...form, order: e.target.value })}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  className="admin-input"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  aria-label="Subject"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  className="admin-input"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  aria-label="Priority"
                >
                  {["Low", "Normal", "High", "Urgent"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                className="admin-input min-h-28"
                required
                placeholder="Message *"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
              <label className="block text-xs text-muted">
                Attachment
                <input
                  type="file"
                  className="mt-1 block w-full text-xs text-text-secondary file:mr-3 file:rounded-full file:border-0 file:bg-primary/20 file:px-3 file:py-1 file:text-primary"
                  onChange={(e) => setFileName(e.target.files?.[0]?.name || "")}
                />
                {fileName && <span className="text-primary"> {fileName}</span>}
              </label>
              <button type="submit" className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm">
                <Send className="h-4 w-4" /> Submit ticket
              </button>
              <p className="text-xs text-muted">
                Expected response time: under 2 business hours (Urgent: &lt; 30 phút trong giờ làm
                việc).
              </p>
            </form>
          )}
        </div>
      </div>

      {/* FAQ + Policies */}
      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-[24px] p-6">
          <h2 className="section-title text-xl">FAQ</h2>
          <div className="mt-4 space-y-2">
            {faqs.map((f) => (
              <details key={f.q} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <summary className="cursor-pointer font-semibold text-white">{f.q}</summary>
                <p className="mt-2 text-sm text-text-secondary">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
        <div className="glass rounded-[24px] p-6">
          <h2 className="section-title text-xl">Policies</h2>
          <div className="mt-4 space-y-2">
            {policies.map((p) => (
              <div key={p.id} className="rounded-2xl border border-white/10 bg-white/5">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 p-3 text-left font-semibold text-white"
                  onClick={() => setPolicyOpen(policyOpen === p.id ? null : p.id)}
                  aria-expanded={policyOpen === p.id}
                >
                  <p.icon className="h-4 w-4 text-primary" />
                  {p.t}
                </button>
                {policyOpen === p.id && (
                  <p className="border-t border-white/10 px-3 pb-3 pt-2 text-sm text-text-secondary">
                    {p.body}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
