import type { Book } from "@/types";

function money(n: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
}

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
}

function scoreBook(book: Book, tokens: string[]) {
  const blob = norm(
    [book.title, book.author, book.category, book.subCategory, book.summary, book.description, ...(book.tags || [])].join(" ")
  );
  let score = 0;
  for (const t of tokens) {
    if (!t || t.length < 2) continue;
    if (blob.includes(t)) score += t.length > 4 ? 3 : 2;
    if (norm(book.title).includes(t)) score += 4;
    if (norm(book.author).includes(t)) score += 3;
    if (norm(book.category).includes(t)) score += 2;
  }
  return score;
}

function topMatches(books: Book[], query: string, limit = 4) {
  const tokens = norm(query).split(/[^a-z0-9]+/).filter(Boolean);
  return books
    .map((b) => ({ b, s: scoreBook(b, tokens) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.b.rating - a.b.rating)
    .slice(0, limit)
    .map((x) => x.b);
}

function formatBook(b: Book) {
  return `• **${b.title}** (${b.author}) — ${money(b.salePrice)}${b.discount ? ` (giảm ${b.discount}%)` : ""}, còn ${b.stock} cuốn, ★${b.rating}`;
}

type Order = {
  id: string;
  status?: string;
  total?: number;
  payment?: string;
  name?: string;
  phone?: string;
  address?: string;
};

function readOrders(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("booknest-orders") || "[]");
  } catch {
    return [];
  }
}

/**
 * Trợ lý bán sách dùng catalog realtime (giá/ảnh/tồn kho từ Admin).
 */
export function answerFromCatalog(userMessage: string, books: Book[]): string {
  const raw = userMessage.trim();
  if (!raw) return "Bạn hãy nhập câu hỏi nhé.";
  const q = norm(raw);

  // Chào hỏi
  if (/^(xin chao|chao|hello|hi|hey)\b/.test(q) || q === "chao ban") {
    return "Xin chào! Mình là **BookNest Concierge**. Mình có thể:\n• Gợi ý / tìm sách theo chủ đề\n• Báo giá & tồn kho realtime\n• Tóm tắt sách\n• Hướng dẫn ship, thanh toán, đặt hàng\n• Tra cứu đơn gần đây\nBạn cần gì ạ?";
  }

  // Ship / freeship
  if (q.includes("ship") || q.includes("van chuyen") || q.includes("giao hang") || q.includes("freeship")) {
    return "📦 **Vận chuyển BookNest**\n• Nội thành: 1–2 ngày\n• Toàn quốc: 2–5 ngày làm việc\n• **Freeship** đơn từ **200.000đ**\n• Dưới 200.000đ: phí ship 30.000đ\nBạn muốn mình gợi ý combo đủ freeship không?";
  }

  // Thanh toán
  if (q.includes("thanh toan") || q.includes("cod") || q.includes("momo") || q.includes("vnpay") || q.includes("zalopay")) {
    return "💳 **Thanh toán hỗ trợ:** COD, MoMo, VNPay, ZaloPay, Stripe, thẻ quốc tế.\nMã giảm: `WELCOME10` (−10%), `BOOKNEST15` (−15%), `FREESHIP` (miễn ship).";
  }

  // Đổi trả
  if (q.includes("doi tra") || q.includes("hoan") || q.includes("bao hanh")) {
    return "🔁 **Đổi trả 7 ngày** nếu sách lỗi in / hỏng do vận chuyển, còn nguyên seal (nếu có). Liên hệ hotline 1900 266 563 hoặc báo mã đơn để mình hỗ trợ.";
  }

  // Flash sale
  if (q.includes("flash") || q.includes("sale") || q.includes("giam gia") || q.includes("khuyen mai")) {
    const sale = books.filter((b) => b.flashSale || b.discount >= 15).slice(0, 6);
    if (!sale.length) return "Hiện chưa có flash sale. Bạn xem mục Bestseller giúp mình nhé.";
    return `🔥 **Flash / giảm giá nổi bật:**\n${sale.map(formatBook).join("\n")}\nBạn muốn đặt cuốn nào?`;
  }

  // Đơn hàng
  if (q.includes("don hang") || q.includes("tra cuu don") || q.includes("order") || /bn\d+/i.test(raw)) {
    const orders = readOrders();
    const idMatch = raw.match(/BN\w+/i);
    if (idMatch) {
      const o = orders.find((x) => String(x.id).toUpperCase() === idMatch[0].toUpperCase());
      if (!o) return `Không thấy đơn **${idMatch[0]}** trên trình duyệt này. Kiểm tra lại mã hoặc đặt hàng trên cùng thiết bị.`;
      return `📋 Đơn **${o.id}**\n• Trạng thái: ${o.status}\n• Tổng: ${money(o.total || 0)}\n• TT: ${o.payment}\n• KH: ${o.name} · ${o.phone}\n• Địa chỉ: ${o.address}`;
    }
    if (!orders.length) {
      return "Bạn chưa có đơn nào trên thiết bị này. Vào giỏ hàng → Thanh toán để đặt, hoặc cho mình mã đơn (dạng BN…).";
    }
    const latest = orders[0];
    return `Đơn gần nhất: **${latest.id}** — ${latest.status} — ${money(latest.total || 0)}.\nGõ mã đơn để xem chi tiết, hoặc xem tại **Tài khoản**.`;
  }

  // Tóm tắt
  if (q.includes("tom tat") || q.includes("noi dung") || q.includes("review ngan") || q.includes("gioi thieu sach")) {
    const matches = topMatches(books, raw.replace(/tom tat|noi dung|gioi thieu sach|cuon|sach/gi, " "), 1);
    const b = matches[0] || topMatches(books, raw, 1)[0];
    if (!b) return "Bạn cho mình tên sách cần tóm tắt nhé.";
    return `📖 **${b.title}** — ${b.author}\n${b.summary || b.description}\n\nThể loại: ${b.category} · ${money(b.salePrice)} · còn ${b.stock} cuốn.\nBạn muốn thêm vào giỏ không?`;
  }

  // Giá
  if (q.includes("gia") || q.includes("bao nhieu") || q.includes("price")) {
    const matches = topMatches(books, raw, 3);
    if (matches.length) {
      return `💰 **Giá hiện tại (realtime từ cửa hàng):**\n${matches.map(formatBook).join("\n")}`;
    }
  }

  // Rẻ nhất / ngân sách
  const budgetMatch = q.match(/(duoi|toi da|max|<\s*)\s*(\d{2,3})([.,]?\d{3})?/);
  if (budgetMatch || q.includes("re") || q.includes("ngan sach")) {
    let max = 200000;
    if (budgetMatch) {
      const n = budgetMatch[2] + (budgetMatch[3] || "");
      max = Number(n.replace(/[.,]/g, "")) || max;
      if (max < 1000) max *= 1000;
    }
    const cheap = books
      .filter((b) => b.salePrice <= max)
      .sort((a, b) => a.salePrice - b.salePrice)
      .slice(0, 5);
    if (cheap.length) {
      return `💸 Sách trong tầm **≤ ${money(max)}**:\n${cheap.map(formatBook).join("\n")}`;
    }
  }

  // Gợi ý / recommend
  if (
    q.includes("goi y") ||
    q.includes("recommend") ||
    q.includes("nen doc") ||
    q.includes("phu hop") ||
    q.includes("cho toi")
  ) {
    const matches = topMatches(books, raw, 4);
    const list =
      matches.length >= 2
        ? matches
        : [...books].sort((a, b) => b.rating * Math.log10(b.sold + 10) - a.rating * Math.log10(a.sold + 10)).slice(0, 4);
    return `✨ **Gợi ý cho bạn:**\n${list.map(formatBook).join("\n")}\n\nNói rõ hơn sở thích (self-help, AI, thiếu nhi…) để mình lọc chuẩn hơn.`;
  }

  // Tìm kiếm chung theo catalog
  const hits = topMatches(books, raw, 5);
  if (hits.length) {
    return `📚 Mình tìm thấy:\n${hits.map(formatBook).join("\n")}\n\nBạn muốn **tóm tắt**, **so sánh giá**, hay **hướng dẫn đặt** cuốn nào?`;
  }

  // Best seller
  if (q.includes("ban chay") || q.includes("bestseller") || q.includes("hot")) {
    const best = books.filter((b) => b.bestseller).slice(0, 5);
    return `🏆 **Bestseller:**\n${best.map(formatBook).join("\n")}`;
  }

  // Fallback hữu ích
  const cats = Array.from(new Set(books.map((b) => b.category))).slice(0, 8).join(", ");
  return `Mình chưa khớp đúng tựa sách trong câu hỏi.\nHiện shop có các thể loại: **${cats}**.\nThử hỏi kiểu:\n• "Gợi ý sách self-help dưới 150k"\n• "Tóm tắt Nhà giả kim"\n• "Giá Clean Code"\n• "Flash sale hôm nay"\n• "Ship bao lâu / freeship"`;
}

/** Gọi Flask BookNest AI (nếu server đang chạy) kèm context catalog. */
export async function answerWithOptionalAI(
  userMessage: string,
  books: Book[],
  history: { role: string; content: string }[] = []
): Promise<{ reply: string; source: "local" | "ai" }> {
  const local = answerFromCatalog(userMessage, books);

  // Context ngắn cho AI (giá realtime)
  const catalogHint = books
    .slice(0, 18)
    .map((b) => `${b.id}|${b.title}|${b.author}|${b.category}|${b.salePrice}|stock:${b.stock}`)
    .join("\n");

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch("http://127.0.0.1:5000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        message:
          `Bạn là BookNest Concierge trên website. Dùng ĐÚNG giá/tồn kho trong catalog dưới đây, không bịa.\n` +
          `CATALOG:\n${catalogHint}\n\nKhách hỏi: ${userMessage}`,
        history: history.slice(-8),
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return { reply: local, source: "local" };
    const data = await res.json();
    if (data.reply && String(data.reply).trim()) {
      return { reply: String(data.reply), source: "ai" };
    }
  } catch {
    // AI offline → local
  }
  return { reply: local, source: "local" };
}
