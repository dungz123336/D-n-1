import type { Book } from "@/types";
import type { AssistantAction } from "@/store/memory";
import type { CheckoutDraft, ConsultantPhase, DiscoverSlots, PendingAction } from "@/store/consultant";
import { readBookById } from "@/store/catalog";
import { authors, getAuthorByName, recommendAuthorsLike } from "@/data/authors";

type Order = {
  id: string;
  status?: string;
  total?: number;
  payment?: string;
  name?: string;
  phone?: string;
  address?: string;
  code?: string;
};

export type AssistantContext = {
  books: Book[];
  cartIds: number[];
  coupon: string;
  viewed: { id: number; title: string; category: string }[];
  searches: string[];
  favoriteCategories: string[];
  favoriteAuthors: string[];
  budgetMax: number | null;
  orders: Order[];
  wishlistIds: number[];
  profileSummary: string;
  phase: ConsultantPhase;
  discover: DiscoverSlots;
  draft: CheckoutDraft;
  pendingAction: PendingAction | null;
};

export type AssistantReply = {
  text: string;
  actions?: AssistantAction[];
  intent?: string;
  /** Update conversation machine */
  nextPhase?: ConsultantPhase;
  patchDiscover?: Partial<DiscoverSlots>;
  patchDraft?: Partial<CheckoutDraft>;
  pendingAction?: PendingAction | null;
  clearPending?: boolean;
  /** Side effects the UI should run after confirm */
  execute?: AssistantAction[];
  setBudget?: number | null;
};

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

function yes(q: string) {
  return /^(co|ok|oke|dong y|xac nhan|yes|y|duoc|lam di|chot|dat|mua|gui|okela|uh|ừ|ừm|vang|vâng)\b/i.test(
    q
  ) || ["có", "ừ", "vâng", "được", "chốt", "đặt", "mua đi", "ok"].includes(q);
}

function no(q: string) {
  return /^(khong|ko|huy|thoi|no|de sau|khong can)\b/i.test(q);
}

function scoreBook(book: Book, tokens: string[], discover?: DiscoverSlots) {
  const blob = norm(
    [book.title, book.author, book.category, book.subCategory, book.summary, book.description, ...(book.tags || [])].join(
      " "
    )
  );
  let score = 0;
  for (const t of tokens) {
    if (!t || t.length < 2) continue;
    if (blob.includes(t)) score += t.length > 4 ? 3 : 2;
    if (norm(book.title).includes(t)) score += 5;
    if (norm(book.author).includes(t)) score += 4;
    if (norm(book.category).includes(t)) score += 3;
  }
  if (discover?.topic) {
    const t = norm(discover.topic);
    if (blob.includes(t)) score += 6;
  }
  if (discover?.level === "beginner" && (blob.includes("co ban") || blob.includes("beginner") || blob.includes("nhap mon")))
    score += 4;
  if (discover?.language === "en" && book.language?.toLowerCase().includes("english")) score += 3;
  if (discover?.language === "vi" && (book.language?.includes("Việt") || !book.language?.toLowerCase().includes("english")))
    score += 2;
  if (discover?.budget && book.salePrice <= discover.budget) score += 4;
  if (discover?.budget && book.salePrice > discover.budget) score -= 8;
  if (discover?.format === "ebook" && book.ebook) score += 3;
  if (discover?.format === "audiobook" && book.audiobook) score += 3;
  return score;
}

function topMatches(books: Book[], query: string, limit = 4, discover?: DiscoverSlots) {
  const tokens = norm(query)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return books
    .map((b) => ({ b, s: scoreBook(b, tokens, discover) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.b.sold - a.b.sold)
    .slice(0, limit)
    .map((x) => x.b);
}

function lineBook(b: Book) {
  const left = b.stock <= 8 ? ` · còn ${b.stock} cuốn` : "";
  const off = b.discount > 0 ? ` · đang −${b.discount}%` : "";
  return `• **${b.title}** — ${b.author}\n  ${money(b.salePrice)}${off}${left}`;
}

function actionsForBooks(books: Book[]): AssistantAction[] {
  return books.flatMap((b) => [
    { type: "add_to_cart" as const, bookId: b.id, label: `Thêm “${truncate(b.title, 20)}”` },
    { type: "open_book" as const, bookId: b.id, label: `Xem chi tiết` },
  ]);
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function extractBudget(q: string): number | null {
  const m = q.match(/(duoi|toi da|max|<=|≤|ngan sach)\s*(\d{1,3})([.,]?\d{3})?/);
  if (m) {
    let n = Number(m[2] + (m[3] || "").replace(/[.,]/g, ""));
    if (n < 1000) n *= 1000;
    return n;
  }
  const m2 = q.match(/(\d{2,3})\s*k\b/);
  if (m2) return Number(m2[1]) * 1000;
  return null;
}

function detectTopic(q: string): string | undefined {
  const map: [string, string[]][] = [
    ["AI / Machine Learning", ["ai", "tri tue nhan tao", "machine learning", "deep learning"]],
    ["Python", ["python"]],
    ["Lập trình / Web", ["lap trinh", "programming", "javascript", "java", "web", "code"]],
    ["Self-help / Phát triển bản thân", ["self help", "self-help", "phat trien ban than", "thoi quen", "ky nang"]],
    ["Kinh doanh / Khởi nghiệp", ["startup", "kinh doanh", "business", "khoi nghiep"]],
    ["Đầu tư / Tài chính", ["tai chinh", "dau tu", "tien", "chung khoan", "invest"]],
    ["Marketing", ["marketing", "branding", "quang cao", "content"]],
    ["Tiếng Anh", ["tieng anh", "english", "ielts", "toeic"]],
    ["Crypto", ["crypto", "bitcoin", "blockchain"]],
    ["Đi làm / Career", ["di lam", "cong viec", "career", "lanh dao", "quan ly"]],
    ["Học tập", ["hoc tap", "hoc bai", "on thi", "sinh vien"]],
    ["Thiếu nhi", ["thieu nhi", "tre em", "cho be", "truyen thieu nhi"]],
    ["Văn học", ["tieu thuyet", "van hoc", "truyen"]],
  ];
  for (const [label, keys] of map) {
    if (keys.some((k) => q.includes(k))) return label;
  }
  return undefined;
}

function personalRecs(ctx: AssistantContext, limit = 3): Book[] {
  const d = ctx.discover;
  const viewedIds = new Set(ctx.viewed.map((v) => v.id));
  const cartSet = new Set(ctx.cartIds);
  const query = [d.topic, d.goal, ...ctx.favoriteCategories, ...ctx.searches.slice(0, 3)]
    .filter(Boolean)
    .join(" ");

  let list = query ? topMatches(ctx.books, query, 12, d) : [];
  if (list.length < limit) {
    const scored = ctx.books
      .filter((b) => !cartSet.has(b.id))
      .map((b) => {
        let s = 0;
        if (ctx.favoriteCategories.some((c) => norm(b.category).includes(norm(c)))) s += 8;
        if (ctx.favoriteAuthors.some((a) => norm(b.author).includes(norm(a)))) s += 10;
        for (const v of ctx.viewed.slice(0, 8)) {
          if (b.category === v.category && b.id !== v.id) s += 4;
        }
        s += b.rating * 2 + Math.log10(b.sold + 10);
        if (viewedIds.has(b.id)) s -= 2;
        if (d.budget && b.salePrice <= d.budget) s += 5;
        if (ctx.budgetMax && b.salePrice <= ctx.budgetMax) s += 3;
        return { b, s };
      })
      .sort((a, b) => b.s - a.s)
      .map((x) => x.b);
    const ids = new Set(list.map((b) => b.id));
    for (const b of scored) {
      if (!ids.has(b.id)) list.push(b);
      if (list.length >= limit + 2) break;
    }
  }
  if (d.budget) list = list.filter((b) => b.salePrice <= d.budget!);
  else if (ctx.budgetMax) list = list.filter((b) => b.salePrice <= ctx.budgetMax!);
  return list.slice(0, limit);
}

function cartLines(ctx: AssistantContext) {
  return ctx.cartIds
    .map((id) => ctx.books.find((b) => b.id === id) || readBookById(id))
    .filter(Boolean) as Book[];
}

function cartSubtotal(ctx: AssistantContext) {
  return cartLines(ctx).reduce((s, b) => s + b.salePrice, 0);
}

function shippingFee(subtotal: number, method: "standard" | "express") {
  if (subtotal >= 200000 && method === "standard") return 0;
  if (method === "express") return 45000;
  return subtotal >= 200000 ? 0 : 30000;
}

function paymentLabel(p: string) {
  const map: Record<string, string> = {
    COD: "Thanh toán khi nhận hàng (COD)",
    MoMo: "Ví MoMo",
    VNPay: "VNPay",
    ZaloPay: "ZaloPay",
    Visa: "Thẻ Visa/MasterCard",
    "Chuyển khoản": "Chuyển khoản ngân hàng",
    "Apple Pay": "Apple Pay",
    "Google Pay": "Google Pay",
  };
  return map[p] || p;
}

function rememberLine(ctx: AssistantContext): string {
  const bits: string[] = [];
  if (ctx.viewed[0]) bits.push(`bạn vừa xem “${ctx.viewed[0].title}”`);
  if (ctx.favoriteCategories[0]) bits.push(`bạn hay quan tâm ${ctx.favoriteCategories[0]}`);
  if (ctx.searches[0]) bits.push(`bạn tìm “${ctx.searches[0]}”`);
  if (ctx.discover.topic) bits.push(`bạn đang hướng tới ${ctx.discover.topic}`);
  if (!bits.length) return "";
  return `Mình nhớ ${bits.slice(0, 2).join(", ")}. `;
}

/** Checkout multi-step handler */
function handleCheckoutFlow(raw: string, q: string, ctx: AssistantContext): AssistantReply | null {
  const phase = ctx.phase;
  const draft = ctx.draft;

  if (phase === "checkout_name") {
    if (raw.length < 2) return { text: "Bạn cho mình họ tên người nhận với ạ?" };
    return {
      text: `Cảm ơn ${raw.trim()} ạ.\nTiếp theo, bạn cho mình **số điện thoại** liên hệ giao hàng nhé?`,
      nextPhase: "checkout_phone",
      patchDraft: { name: raw.trim() },
      intent: "checkout_phone",
    };
  }

  if (phase === "checkout_phone") {
    const phone = raw.replace(/\s/g, "");
    if (!/^0\d{8,10}$/.test(phone) && !/^\+?\d{9,12}$/.test(phone)) {
      return { text: "Số điện thoại hơi lạ. Bạn nhập lại giúp mình (vd: 0901234567) nhé?" };
    }
    return {
      text: "Ok mình đã ghi SĐT.\nGiờ bạn gửi **địa chỉ nhận hàng** (số nhà, đường, quận/huyện, tỉnh/thành) nhé?",
      nextPhase: "checkout_address",
      patchDraft: { phone },
      intent: "checkout_address",
    };
  }

  if (phase === "checkout_address") {
    if (raw.length < 8) return { text: "Địa chỉ còn ngắn quá. Bạn ghi rõ hơn giúp mình để ship không bị nhầm nhé?" };
    return {
      text: "Đã lưu địa chỉ.\nBạn muốn giao **tiêu chuẩn** (2–5 ngày, freeship đơn ≥200k) hay **hỏa tốc** (+45k, nhanh hơn)?\nTrả lời: *tiêu chuẩn* hoặc *hỏa tốc*.",
      nextPhase: "checkout_shipping",
      patchDraft: { address: raw.trim() },
      intent: "checkout_shipping",
    };
  }

  if (phase === "checkout_shipping") {
    const express = q.includes("hoa toc") || q.includes("nhanh") || q.includes("express");
    const shipping = express ? "express" : "standard";
    return {
      text: `Mình chọn giao **${shipping === "express" ? "hỏa tốc" : "tiêu chuẩn"}**.\nBạn muốn thanh toán thế nào?\n• COD (trả khi nhận)\n• MoMo\n• VNPay\n• ZaloPay\n• Visa\n• Chuyển khoản\nChỉ cần gõ tên phương thức là được.`,
      nextPhase: "checkout_payment",
      patchDraft: { shipping },
      intent: "checkout_payment",
    };
  }

  if (phase === "checkout_payment") {
    let payment = "COD";
    if (q.includes("momo")) payment = "MoMo";
    else if (q.includes("vnpay")) payment = "VNPay";
    else if (q.includes("zalo")) payment = "ZaloPay";
    else if (q.includes("visa") || q.includes("the") || q.includes("card")) payment = "Visa";
    else if (q.includes("chuyen khoan") || q.includes("bank")) payment = "Chuyển khoản";
    else if (q.includes("apple")) payment = "Apple Pay";
    else if (q.includes("google")) payment = "Google Pay";
    else if (q.includes("cod") || q.includes("nhan hang") || q.includes("khi nhan")) payment = "COD";

    const items = cartLines(ctx);
    const sub = cartSubtotal(ctx);
    const ship = shippingFee(sub, draft.shipping || "standard");
    const total = sub + ship;
    const lines = items.map((b) => `• ${b.title} — ${money(b.salePrice)}`).join("\n");

    return {
      text:
        `Mình chọn **${paymentLabel(payment)}**.\n\n` +
        `**Xác nhận đơn trước khi tạo:**\n` +
        `Người nhận: **${draft.name}**\n` +
        `SĐT: **${draft.phone}**\n` +
        `Địa chỉ: **${draft.address}**\n` +
        `Ship: **${draft.shipping === "express" ? "Hỏa tốc" : "Tiêu chuẩn"}** (${ship === 0 ? "miễn phí" : money(ship)})\n` +
        `Thanh toán: **${paymentLabel(payment)}**\n` +
        `Sách:\n${lines || "• (giỏ trống — mình sẽ nhắc thêm)"}\n` +
        `**Tạm tính: ${money(total)}**${ctx.coupon ? ` · mã ${ctx.coupon}` : ""}\n\n` +
        `Bạn **xác nhận đặt hàng** không? Trả lời *xác nhận* hoặc *hủy*.`,
      nextPhase: "checkout_confirm",
      patchDraft: { payment },
      intent: "checkout_confirm",
    };
  }

  if (phase === "checkout_confirm") {
    if (no(q) || q.includes("huy") || q.includes("sua")) {
      return {
        text: "Ok mình chưa tạo đơn. Bạn muốn sửa tên, SĐT, địa chỉ, hay phương thức thanh toán?",
        nextPhase: "idle",
        intent: "checkout_abort",
      };
    }
    if (yes(q) || q.includes("xac nhan") || q.includes("dat hang") || q.includes("chot")) {
      if (!ctx.cartIds.length) {
        return {
          text: "Giỏ đang trống nên mình chưa tạo đơn được. Bạn chọn sách trước, mình hỗ trợ lại quy trình nhé.",
          nextPhase: "idle",
          actions: [{ type: "open_cart", label: "Xem giỏ" }],
        };
      }
      return {
        text: "Cảm ơn bạn — mình đang **tạo đơn** theo thông tin đã xác nhận.\nSau khi xong mình gửi mã đơn ngay.",
        nextPhase: "idle",
        intent: "create_order",
        execute: [{ type: "create_order", label: "Tạo đơn", payload: "confirm" }],
        clearPending: true,
      };
    }
    return { text: "Bạn trả lời *xác nhận* để mình tạo đơn, hoặc *hủy* nếu muốn chỉnh lại nhé." };
  }

  return null;
}

function startCheckout(ctx: AssistantContext): AssistantReply {
  if (!ctx.cartIds.length) {
    const recs = personalRecs(ctx, 2);
    return {
      text: "Giỏ còn trống, mình chưa mở đơn được.\nBạn muốn mình gợi ý 2 cuốn hợp gu để bỏ vào giỏ trước không?",
      actions: actionsForBooks(recs),
      nextPhase: "recommend",
      intent: "checkout_empty",
    };
  }
  const remember = rememberLine(ctx);
  return {
    text: `${remember}Mình sẽ soạn đơn từng bước cho chắc.\n**Bước 1:** Bạn cho mình **họ tên người nhận** ạ?`,
    nextPhase: "checkout_name",
    intent: "checkout_start",
  };
}

function buildRoadmap(ctx: AssistantContext): AssistantReply {
  const recs = personalRecs(ctx, 3);
  const d = ctx.discover;
  const level =
    d.level === "beginner"
      ? "người mới"
      : d.level === "advanced"
        ? "nâng cao"
        : d.level === "intermediate"
          ? "trung cấp"
          : "phù hợp trình độ của bạn";
  const topic = d.topic || ctx.favoriteCategories[0] || "chủ đề bạn quan tâm";
  const budget = d.budget || ctx.budgetMax;

  if (!recs.length) {
    return {
      text: "Hiện kệ chưa khớp sát ngân sách/chủ đề. Bạn nới budget thêm chút hoặc đổi sang tiếng Anh/Việt giúp mình nhé?",
      nextPhase: "discover",
    };
  }

  const months = ["Tháng 1", "Tháng 2", "Tháng 3"];
  const plan = recs
    .map((b, i) => {
      const practice =
        i === 0
          ? "Practice: ghi chú 3 ý chính mỗi chương"
          : i === 1
            ? "Practice: áp dụng 1 framework vào việc thật"
            : "Project: tổng hợp + chia sẻ / portfolio đọc";
      return (
        `**${months[i] || `Bước ${i + 1}`}** — ${b.title} (${money(b.salePrice)})\n` +
        `• Độc giả hợp: ${b.tags?.slice(0, 2).join(", ") || b.category}\n` +
        `• ${b.summary.slice(0, 90)}…\n` +
        `• ${practice}`
      );
    })
    .join("\n\n");

  return {
    text:
      `${rememberLine(ctx)}` +
      `Để mình gợi ý nhé — **lộ trình đọc ${topic}** cho **${level}**` +
      (budget ? ` (trong tầm ${money(budget)})` : "") +
      `:\n\n${plan}\n\n` +
      `Bạn muốn mình **thêm cả bộ vào giỏ**, so sánh 2 cuốn đầu, hay giải thích kỹ cuốn tháng 1 trước?`,
    actions: [
      ...actionsForBooks(recs),
      { type: "add_to_cart", bookId: recs[0].id, label: "Thêm cuốn tháng 1" },
      { type: "open_checkout", label: "Thanh toán" },
    ],
    nextPhase: "recommend",
    intent: "roadmap",
  };
}

/**
 * BookNest Concierge — senior bookstore sales consultant.
 * Discovery first → recommend → compare → cart → checkout.
 * Never behaves like a study tutor.
 */
export function consult(userMessage: string, ctx: AssistantContext): AssistantReply {
  const raw = userMessage.trim();
  if (!raw) {
    return {
      text: "Bạn đang muốn tìm sách về chủ đề gì hôm nay? Học tập, đi làm, khởi nghiệp, AI… cứ nói tự nhiên nhé.",
      intent: "greet",
    };
  }
  const q = norm(raw);

  // Soft redirect: homework / coding exercises → bookstore
  if (
    (q.includes("giai bai") ||
      q.includes("lam bai tap") ||
      q.includes("debug code") ||
      q.includes("viet code giup") ||
      q.includes("homework")) &&
    !q.includes("sach")
  ) {
    return {
      text:
        "Mình là **BookNest Concierge** — hỗ trợ chọn sách và mua sắm tại nhà sách.\n" +
        "Bạn đang cần sách tham khảo để học không? Nói mình nghe chủ đề (vd: Python, AI, marketing) để mình tìm cuốn phù hợp nhé.",
      intent: "redirect_bookstore",
    };
  }

  // Pending irreversible confirm
  if (ctx.pendingAction && (yes(q) || no(q))) {
    if (no(q)) {
      return {
        text: "Ok mình **chưa làm gì** hết. Bạn muốn chỉnh lại không?",
        clearPending: true,
        nextPhase: "idle",
      };
    }
    const p = ctx.pendingAction;
    return {
      text: `Rõ rồi — mình thực hiện: **${p.description}**.`,
      execute: [
        {
          type: p.type as AssistantAction["type"],
          bookId: p.bookId,
          label: p.label,
          payload: p.payload,
        },
      ],
      clearPending: true,
      intent: "confirmed_action",
    };
  }

  // Active checkout wizard
  if (ctx.phase.startsWith("checkout_")) {
    const flow = handleCheckoutFlow(raw, q, ctx);
    if (flow) return flow;
  }

  // Discovery follow-ups
  if (ctx.phase === "discover") {
    const d = { ...ctx.discover };
    const budget = extractBudget(q);
    if (budget) d.budget = budget;

    if (!d.level) {
      if (q.includes("moi") || q.includes("beginner") || q.includes("co ban") || q.includes("nhap mon")) d.level = "beginner";
      else if (q.includes("nang cao") || q.includes("advanced") || q.includes("chuyen sau")) d.level = "advanced";
      else if (q.includes("trung cap") || q.includes("intermediate") || q.includes("co kinh nghiem")) d.level = "intermediate";
    }
    if (!d.language) {
      if (q.includes("tieng anh") || q.includes("english") || q === "en") d.language = "en";
      else if (q.includes("tieng viet") || q.includes("vietnamese") || q === "vi") d.language = "vi";
      else if (q.includes("ca hai") || q.includes("any")) d.language = "any";
    }
    if (!d.format) {
      if (q.includes("ebook") || q.includes("dien tu")) d.format = "ebook";
      else if (q.includes("audio")) d.format = "audiobook";
      else if (q.includes("bia mem") || q.includes("paperback")) d.format = "paperback";
      else if (q.includes("bia cung") || q.includes("hardcover")) d.format = "hardcover";
    }
    if (!d.topic) d.topic = detectTopic(q) || d.topic;
    if (q.length > 3 && !detectTopic(q) && !d.goal && !budget && !d.level) {
      // free text as goal
      d.goal = raw.slice(0, 80);
    }

    // Ask next missing critical slot
    if (!d.topic) {
      return {
        text: "Bạn muốn theo hướng nào: **AI**, **Python**, **web**, **self-help**, **kinh doanh**, hay chủ đề khác?",
        nextPhase: "discover",
        patchDiscover: d,
        setBudget: budget,
      };
    }
    if (!d.level) {
      return {
        text: `Ok, mình ghi nhận **${d.topic}**.\nBạn đang ở mức **mới bắt đầu**, **có nền**, hay **nâng cao** ạ?`,
        nextPhase: "discover",
        patchDiscover: d,
        setBudget: budget,
      };
    }
    if (!d.language) {
      return {
        text: "Bạn muốn đọc **tiếng Việt**, **tiếng Anh**, hay cả hai đều được?",
        nextPhase: "discover",
        patchDiscover: d,
        setBudget: budget,
      };
    }
    if (d.budget == null && ctx.budgetMax == null && !budget) {
      return {
        text: "Ngân sách mỗi cuốn khoảng bao nhiêu ạ? (vd: dưới 150k, dưới 250k…)",
        nextPhase: "discover",
        patchDiscover: d,
        setBudget: budget,
      };
    }
    if (budget) d.budget = budget;
    // enough to recommend
    return {
      ...buildRoadmap({ ...ctx, discover: d }),
      patchDiscover: d,
      setBudget: d.budget ?? budget,
    };
  }

  // —— Greetings ——
  if (/^(xin chao|chao|hello|hi|hey|alo|booknest)\b/.test(q) || q.includes("concierge")) {
    const mem = rememberLine(ctx);
    return {
      text:
        "Xin chào\n\nMình là **BookNest Concierge**.\n\n" +
        (mem || "") +
        "Mình sẽ giúp bạn tìm đúng cuốn sách phù hợp, so sánh, đặt hàng, voucher và theo dõi đơn.\n\n" +
        "Bạn đang muốn tìm sách về chủ đề gì hôm nay?",
      nextPhase: "idle",
      intent: "greet",
    };
  }

  // —— Quick actions from UI ——
  if (q.includes("san voucher") || q.includes("uu dai hom nay") || q === "voucher") {
    return {
      text:
        "Hôm nay mình săn được vài mã đẹp cho bạn:\n" +
        "• **WELCOME10** — giảm 10% đơn đầu\n" +
        "• **BOOK20** — giảm 20% (select)\n" +
        "• **FREESHIP** — miễn ship\n" +
        "• **VIPMEMBER** — ưu đãi thành viên 12%\n" +
        "• Flash sale trên kệ — mình lọc giúp\n\n" +
        "Bạn muốn mình **áp mã** nào vào giỏ?",
      actions: [
        { type: "apply_coupon", label: "WELCOME10", payload: "WELCOME10" },
        { type: "apply_coupon", label: "BOOK20", payload: "BOOK20" },
        { type: "apply_coupon", label: "FREESHIP", payload: "FREESHIP" },
        { type: "apply_coupon", label: "VIPMEMBER", payload: "VIPMEMBER" },
      ],
      intent: "voucher",
    };
  }

  if (q.includes("ban chay") || q.includes("best seller") || q.includes("bestseller") || q.includes("sach ban chay")) {
    const tops = [...ctx.books].sort((a, b) => b.sold - a.sold).slice(0, 4);
    return {
      text:
        `${rememberLine(ctx)}` +
        `Top sách **bán chạy** trên kệ BookNest:\n${tops.map(lineBook).join("\n")}\n\n` +
        `Bạn muốn mình lọc theo chủ đề (AI, self-help, kinh doanh…) không?`,
      actions: actionsForBooks(tops),
      intent: "bestsellers",
    };
  }

  if (q.includes("ai tu van") || q.includes("tu van chon sach")) {
    return {
      text:
        "Hay lắm — để mình tư vấn trúng, cho mình biết nhanh:\n" +
        "Bạn muốn đọc để **học tập / đi làm / khởi nghiệp / đầu tư / lập trình / AI / marketing / tiếng Anh / phát triển bản thân**?\n\n" +
        "Bạn đã đọc sách nào trước đây chưa? Ngân sách khoảng bao nhiêu?",
      nextPhase: "discover",
      intent: "discover_start",
    };
  }

  if (q.includes("goi y sach") || q.includes("goi y phu hop")) {
    return {
      text:
        `${rememberLine(ctx) || "Để mình gợi ý nhé. "}` +
        "Bạn muốn đọc để:\n" +
        "• Học tập · Đi làm · Khởi nghiệp · Đầu tư\n" +
        "• Lập trình · AI · Crypto · Marketing\n" +
        "• Tiếng Anh · Phát triển bản thân\n\n" +
        "Chọn 1 hướng (hoặc nói tự nhiên) — mình chưa gợi sách ngay để tránh lệch gu.",
      nextPhase: "discover",
      intent: "discover_start",
    };
  }

  // —— Start order / checkout ——
  if (
    q.includes("thanh toan") ||
    q.includes("dat hang") ||
    q.includes("mua ngay") ||
    q.includes("checkout") ||
    q.includes("chot don") ||
    q.includes("tao don")
  ) {
    return startCheckout(ctx);
  }

  if (
    q.includes("cod") ||
    q.includes("tra khi nhan") ||
    q.includes("thanh toan khi nhan") ||
    q.includes("nhan hang roi moi thanh toan") ||
    q.includes("nhan hang roi thanh toan")
  ) {
    if (ctx.cartIds.length) {
      return {
        text:
          "Hoàn toàn được nhé\n\n" +
          "Bạn chỉ cần chọn phương thức **Thanh toán khi nhận hàng (COD)**.\n" +
          "Bạn sẽ thanh toán trực tiếp cho đơn vị vận chuyển khi nhận sách.\n\n" +
          "Mình có thể chuẩn bị đơn hàng giúp bạn ngay — trả lời **có** để bắt đầu nhé.",
        pendingAction: {
          type: "start_checkout_cod",
          label: "Bắt đầu đơn COD",
          description: "bắt đầu quy trình đặt hàng COD",
          payload: "COD",
        },
        nextPhase: "await_confirm",
        intent: "cod_offer",
      };
    }
    return {
      text:
        "Hoàn toàn được nhé — BookNest hỗ trợ **COD** đầy đủ.\n" +
        "Bạn chọn sách vào giỏ trước, mình sẽ chuẩn bị đơn COD từng bước cho bạn.",
      actions: [
        { type: "open_cart", label: "Xem giỏ" },
        ...actionsForBooks(personalRecs(ctx, 2)),
      ],
      intent: "cod_offer",
    };
  }

  // Confirm start checkout COD
  if (ctx.phase === "await_confirm" && ctx.pendingAction?.type === "start_checkout_cod" && yes(q)) {
    return {
      ...startCheckout(ctx),
      patchDraft: { payment: "COD" },
      clearPending: true,
    };
  }

  // —— Cart ——
  if (q.includes("gio hang") || q === "cart" || q.includes("trong gio")) {
    const items = cartLines(ctx);
    if (!items.length) {
      return {
        text: `${rememberLine(ctx)}Giỏ đang trống. Bạn muốn mình gợi ý vài cuốn vừa túi tiền để bắt đầu không?`,
        actions: actionsForBooks(personalRecs(ctx, 2)),
      };
    }
    const sub = cartSubtotal(ctx);
    const need = Math.max(0, 200000 - sub);
    return {
      text:
        `Giỏ hiện có:\n${items.map((b) => `• ${b.title} — ${money(b.salePrice)}`).join("\n")}\n` +
        `Tạm tính **${money(sub)}**.` +
        (need > 0 ? ` Thêm khoảng ${money(need)} nữa là **freeship**.` : " Đơn này **đủ freeship** rồi.") +
        `\nBạn muốn thanh toán hay thêm sách?`,
      actions: [
        { type: "open_cart", label: "Mở giỏ" },
        { type: "open_checkout", label: "Thanh toán" },
        { type: "apply_coupon", label: "Thử WELCOME10", payload: "WELCOME10" },
      ],
      nextPhase: "cart",
    };
  }

  if (q.includes("them") && (q.includes("gio") || q.includes("cart"))) {
    const book = topMatches(ctx.books, raw, 1)[0];
    if (book) {
      return {
        text: `Mình sẽ thêm **${book.title}** (${money(book.salePrice)}) vào giỏ.\nBạn **đồng ý** chứ?`,
        pendingAction: {
          type: "add_to_cart",
          bookId: book.id,
          label: "Thêm giỏ",
          description: `thêm “${book.title}” vào giỏ`,
        },
        nextPhase: "await_confirm",
      };
    }
    return { text: "Bạn muốn thêm cuốn nào? Cho mình tên sách hoặc chủ đề nhé." };
  }

  // —— Coupons / Smart vouchers ——
  if (q.includes("ma giam") || q.includes("coupon") || q.includes("voucher") || q.includes("welcome") || q.includes("flash sale")) {
    return {
      text:
        "Mình recommend voucher đang chạy:\n" +
        "• **WELCOME10** (−10%)\n" +
        "• **BOOK20** (−20% select)\n" +
        "• **FREESHIP** (miễn ship)\n" +
        "• **VIPMEMBER** (−12% thành viên)\n" +
        "• Mua bulk 10–50 cuốn: DEAL5 → DEAL15\n" +
        "• Flash sale theo kệ (mình lọc khi bạn nói chủ đề)\n\n" +
        "Mình áp **WELCOME10** giúp bạn nhé?",
      pendingAction: {
        type: "apply_coupon",
        payload: "WELCOME10",
        label: "Áp WELCOME10",
        description: "áp mã WELCOME10",
      },
      actions: [
        { type: "apply_coupon", label: "WELCOME10", payload: "WELCOME10" },
        { type: "apply_coupon", label: "BOOK20", payload: "BOOK20" },
        { type: "apply_coupon", label: "FREESHIP", payload: "FREESHIP" },
        { type: "apply_coupon", label: "VIPMEMBER", payload: "VIPMEMBER" },
      ],
      nextPhase: "await_confirm",
      intent: "voucher",
    };
  }

  // —— Orders ——
  if (
    q.includes("don hang") ||
    q.includes("tracking") ||
    /bn[\w-]*/i.test(raw) ||
    q.includes("huy don") ||
    q.includes("hoan tien") ||
    q.includes("doi tra") ||
    q.includes("doi dia chi") ||
    q.includes("sai hang") ||
    q.includes("hong")
  ) {
    const idMatch = raw.match(/BN[\w-]*/i);
    const orders = ctx.orders || [];
    if (idMatch) {
      const o = orders.find((x) => String(x.id).toUpperCase() === idMatch[0].toUpperCase());
      if (!o) {
        return {
          text: `Mình chưa thấy đơn **${idMatch[0]}** trên thiết bị này. Bạn kiểm tra lại mã trong **Tài khoản**, hoặc gửi SĐT đặt hàng để mình hướng dẫn tra cứu.`,
        };
      }
      if (q.includes("huy")) {
        return {
          text: `Đơn **${o.id}** đang **${o.status}**. Nếu chưa giao shipper, mình có thể ghi nhận yêu cầu hủy.\nBạn **xác nhận hủy đơn ${o.id}** chứ? (Thao tác cần xác nhận rõ.)`,
          pendingAction: {
            type: "cancel_order",
            payload: o.id,
            label: "Hủy đơn",
            description: `gửi yêu cầu hủy đơn ${o.id}`,
          },
          nextPhase: "await_confirm",
        };
      }
      if (q.includes("doi dia chi") || q.includes("doi sdt") || q.includes("sua")) {
        return {
          text: `Trước khi ship, mình hỗ trợ đổi thông tin đơn **${o.id}**.\nBạn gửi **địa chỉ/SĐT mới** — mình sẽ hướng dẫn cập nhật và xác nhận lại với bạn trước khi chốt.`,
          nextPhase: "order_support",
        };
      }
      if (q.includes("hoan") || q.includes("doi tra") || q.includes("hong") || q.includes("sai")) {
        return {
          text: `Mình xin lỗi vì trải nghiệm chưa tốt ạ.\nVới đơn **${o.id}**, BookNest hỗ trợ đổi/trả trong **7 ngày** nếu lỗi in/hỏng vận chuyển.\nBạn chụp ảnh sản phẩm + mô tả tình trạng; mình tạo hướng xử lý hoàn/đổi ngay. Bạn muốn **đổi sách** hay **hoàn tiền**?`,
          intent: "refund_flow",
        };
      }
      return {
        text: `Đơn **${o.id}**: ${o.status} · ${money(o.total || 0)} · ${o.payment}.\nGiao tới: ${o.address}.\nDự kiến **2–5 ngày làm việc** (nội thành thường 1–2 ngày).\nCần mình hỗ trợ thêm gì trên đơn này không?`,
        actions: [{ type: "track_order", label: "Mở đơn của tôi", payload: o.id }],
      };
    }
    if (orders[0]) {
      const o = orders[0];
      return {
        text: `Đơn gần nhất mình thấy: **${o.id}** — ${o.status} — ${money(o.total || 0)}.\nBạn gõ đúng mã đơn nếu muốn mình kiểm tra chi tiết, hoặc vào **Tài khoản** để xem toàn bộ.`,
        actions: [{ type: "track_order", label: `Xem ${o.id}`, payload: o.id }],
      };
    }
    return {
      text: "Hiện chưa có đơn trên trình duyệt này. Bạn cần mình **soạn đơn mới** không?",
      actions: [{ type: "open_checkout", label: "Tới checkout" }],
    };
  }

  // —— Payment fail / support ——
  if (q.includes("thanh toan that bai") || q.includes("loi thanh toan") || q.includes("khong thanh toan duoc")) {
    return {
      text: "Mình hiểu — lỗi thanh toán online khá hay gặp.\nBạn thử: (1) đổi mạng, (2) mở lại ví MoMo/VNPay, hoặc (3) chọn **COD** cho yên tâm.\nMình chuyển sang COD và soạn đơn giúp bạn nhé?",
      pendingAction: {
        type: "start_checkout_cod",
        label: "Chuyển COD",
        description: "chuyển sang thanh toán COD và bắt đầu đặt hàng",
        payload: "COD",
      },
      nextPhase: "await_confirm",
    };
  }

  if (q.includes("ship") || q.includes("giao hang") || q.includes("bao lau") || q.includes("van chuyen")) {
    return {
      text: "Ship tiêu chuẩn: nội thành **1–2 ngày**, toàn quốc **2–5 ngày làm việc**. Đơn từ **200.000đ** freeship.\nHỏa tốc +45k nếu cần gấp.\nBạn đang ở khu vực nào để mình ước lượng sát hơn?",
    };
  }

  // —— Compare ——
  if (
    q.includes("so sanh") ||
    q.includes("khac gi") ||
    q.includes("nen chon cuon nao") ||
    q.includes("nen mua cuon nao") ||
    q.includes("cuon nao hon")
  ) {
    let hits = topMatches(ctx.books, raw, 3, ctx.discover);
    if (hits.length < 2 && ctx.viewed.length >= 2) {
      hits = ctx.viewed
        .map((v) => ctx.books.find((b) => b.id === v.id))
        .filter(Boolean)
        .slice(0, 3) as Book[];
    }
    if (hits.length < 2) hits = personalRecs(ctx, 3);
    if (hits.length >= 2) {
      const pair = hits.slice(0, 3);
      const rows = pair
        .map((b, i) => {
          const difficulty =
            b.pages > 400 ? "Nâng cao / dày" : b.pages > 250 ? "Trung bình" : "Dễ tiếp cận";
          const strength = b.bestseller
            ? "Social proof mạnh, dễ bắt đầu"
            : b.rating >= 4.7
              ? "Rating rất cao"
              : b.discount > 15
                ? "Đang giảm sâu"
                : "Đúng niche";
          const weak =
            b.stock <= 5 ? "Sắp hết hàng" : b.pages > 400 ? "Cần thời gian đọc" : "Cạnh tranh nhiều đầu tương tự";
          return (
            `**${i + 1}. ${b.title}**\n` +
            `• Độ khó: ${difficulty}\n` +
            `• Độc giả hợp: ${(b.tags || []).slice(0, 3).join(", ") || b.category}\n` +
            `• Điểm mạnh: ${strength}\n` +
            `• Điểm yếu: ${weak}\n` +
            `• Giá: ${money(b.salePrice)} · ★${b.rating}\n` +
            `• Thứ tự gợi ý: ${i === 0 ? "Đọc trước" : i === 1 ? "Đọc sau" : "Nâng cao / mở rộng"}`
          );
        })
        .join("\n\n");
      return {
        text:
          `Bạn vẫn đang phân vân cuốn nào — mình so sánh giúp:\n\n${rows}\n\n` +
          `Gợi ý mua: bắt đầu với **${pair[0].title}** nếu muốn an toàn & dễ vào. Bạn nghiêng cuốn nào?`,
        actions: actionsForBooks(pair),
        nextPhase: "compare",
        intent: "compare",
      };
    }
  }

  // —— Discovery entry: programming / learning / vague need ——
  const wantsDiscovery =
    q.includes("can sach") ||
    q.includes("muon hoc") ||
    q.includes("toi muon") ||
    q.includes("tu van") ||
    q.includes("goi y") ||
    q.includes("recommend") ||
    q.includes("lap trinh") ||
    q.includes("hoc ai") ||
    q.includes("doc gi") ||
    q.includes("cho nguoi moi") ||
    q.includes("beginner") ||
    detectTopic(q);

  if (wantsDiscovery && !q.includes("them vao gio")) {
    const topic = detectTopic(q) || ctx.discover.topic;
    const budget = extractBudget(q);

    // If already rich context, recommend
    if (topic && (ctx.discover.level || q.includes("moi") || q.includes("nang cao") || budget || ctx.budgetMax)) {
      const d: DiscoverSlots = {
        ...ctx.discover,
        topic,
        budget: budget ?? ctx.discover.budget ?? ctx.budgetMax,
      };
      if (q.includes("moi") || q.includes("beginner") || q.includes("co ban")) d.level = "beginner";
      if (q.includes("nang cao")) d.level = "advanced";
      return {
        ...buildRoadmap({ ...ctx, discover: d }),
        patchDiscover: d,
        setBudget: d.budget ?? null,
      };
    }

    // Start consultative flow — DON'T dump books
    if (topic) {
      return {
        text:
          `${rememberLine(ctx)}` +
          `Hay — **${topic}** là hướng đang được nhiều bạn hỏi.\n` +
          `Trước khi mình chọn sách, cho mình hỏi nhanh:\n` +
          `Bạn **mới bắt đầu** hay **đã có nền** ạ?`,
        nextPhase: "discover",
        patchDiscover: { topic, budget: budget ?? ctx.discover.budget },
        setBudget: budget,
        intent: "discover_level",
      };
    }

    if (q.includes("lap trinh") || q.includes("programming") || q.includes("code")) {
      return {
        text:
          "Mình sẽ giúp bạn chọn sách lập trình.\nBạn đang theo hướng nào?\n• Python · Java · Web · AI · Blockchain\nCứ nói 1 từ cũng được — mình chưa gợi sách ngay để khớp đúng gu.",
        nextPhase: "discover",
        patchDiscover: { topic: undefined },
        intent: "discover_topic",
      };
    }

    return {
      text:
        `${rememberLine(ctx) || "Hãy để mình tìm cuốn phù hợp nhất. "}` +
        "Bạn muốn đọc để:\n" +
        "**Học tập · Đi làm · Khởi nghiệp · Đầu tư · Lập trình · AI · Crypto · Marketing · Tiếng Anh · Phát triển bản thân**?\n\n" +
        "Bạn đã đọc sách nào trước đây? Ngân sách khoảng bao nhiêu?",
      nextPhase: "discover",
      intent: "discover_start",
    };
  }

  // —— Author assistant & smart recommendations ——
  const mentionsAuthor =
    q.includes("tac gia") ||
    q.includes("author") ||
    q.includes("who is") ||
    q.includes("ai la") ||
    q.includes("la ai") ||
    ((q.includes("thich") || q.includes("like") || q.includes("yeu thich")) &&
      (q.includes("james") ||
        q.includes("dale") ||
        q.includes("harari") ||
        q.includes("clear") ||
        q.includes("carnegie") ||
        q.includes("covey") ||
        q.includes("newport") ||
        q.includes("manson") ||
        q.includes("housel") ||
        authors.some((a) => q.includes(norm(a.name))))) ||
    authors.some(
      (a) =>
        q.includes(norm(a.name)) ||
        a.name
          .toLowerCase()
          .split(" ")
          .some((p) => p.length > 3 && q.includes(p))
    );

  if (mentionsAuthor) {
    const hit =
      authors.find((a) => q.includes(norm(a.name))) ||
      authors.find((a) =>
        a.name
          .toLowerCase()
          .split(" ")
          .some((p) => p.length > 3 && q.includes(p))
      ) ||
      getAuthorByName(raw);

    if (hit) {
      const recs = recommendAuthorsLike(hit.slug, 5);
      const similar = recs.map((a) => a.name).join(", ");
      const booksBy = ctx.books
        .filter(
          (b) =>
            hit.popularBooks.includes(b.id) ||
            norm(b.author).includes(norm(hit.name)) ||
            norm(b.author).includes(norm(hit.name.split(" ").slice(-1)[0] || ""))
        )
        .sort((a, b) => b.sold - a.sold);
      const chronological = [...booksBy].sort((a, b) =>
        String(a.publishYear).localeCompare(String(b.publishYear))
      );
      const first = booksBy[0];
      const latest = chronological[chronological.length - 1] || first;
      const fbt = personalRecs(ctx, 4).filter((b) => !booksBy.some((x) => x.id === b.id)).slice(0, 2);

      // "I like X" → similar authors pack (James Clear example)
      if (q.includes("thich") || q.includes("like") || q.includes("yeu thich") || q.includes("fan")) {
        return {
          text:
            `Tuyệt — nếu bạn thích **${hit.name}**, mình gợi ý cùng phong cách:\n` +
            `• ${recs.map((a) => `**${a.name}** (${a.writingStyle})`).join("\n• ")}\n\n` +
            `Nên đọc trước: **${first?.title || "đầu sách phổ biến nhất trên kệ"}**.\n` +
            (fbt.length
              ? `Thường mua kèm: ${fbt.map((b) => b.title).join(", ")}.\n`
              : "") +
            `Bạn muốn lộ trình cho người mới hay nâng cao?`,
          actions: first ? actionsForBooks([first, ...fbt].slice(0, 3)) : undefined,
          intent: "author_similar",
        };
      }

      if (
        q.includes("doc truoc") ||
        q.includes("bat dau") ||
        q.includes("first") ||
        q.includes("beginner") ||
        q.includes("nen doc") ||
        q.includes("cuon nao")
      ) {
        return {
          text: first
            ? `**Beginner path — ${hit.name}**\nBắt đầu với **${first.title}** (${money(first.salePrice)}) — ${first.summary.slice(0, 140)}…\nPhù hợp: ${hit.idealReaders}.\nBạn muốn mình thêm vào giỏ không?`
            : `${hit.name}: ${hit.bio}`,
          actions: first ? actionsForBooks([first]) : undefined,
          intent: "author_first_book",
        };
      }

      if (q.includes("advanced") || q.includes("nang cao") || q.includes("sau hon")) {
        const adv = booksBy[1] || fbt[0] || first;
        return {
          text: adv
            ? `**Advanced — ${hit.name}**\nSau cuốn mở đầu, thử **${adv.title}** hoặc các tác giả: ${similar}.\nPhong cách gốc: ${hit.writingStyle}.`
            : `Thử các tác giả tương tự: ${similar}.`,
          actions: adv ? actionsForBooks([adv]) : undefined,
          intent: "author_advanced",
        };
      }

      if (q.includes("ban chay") || q.includes("best") || q.includes("bestseller") || q.includes("best-selling")) {
        return {
          text: first
            ? `Đầu sách bán chạy gắn với **${hit.name}**: **${first.title}** — ${money(first.salePrice)} · ★${first.rating} · đã bán ${first.sold}.`
            : hit.bio,
          actions: first ? actionsForBooks([first]) : undefined,
          intent: "author_bestseller",
        };
      }

      if (
        q.includes("giong") ||
        q.includes("tuong tu") ||
        q.includes("similar") ||
        q.includes("writing style") ||
        q.includes("phong cach")
      ) {
        return {
          text:
            `Nếu bạn thích **${hit.name}** (${hit.writingStyle}), thử:\n` +
            recs.map((a) => `• **${a.name}** — ${a.bio}`).join("\n") +
            `\n\nĐộc giả hợp: ${hit.idealReaders}.`,
          intent: "author_similar",
        };
      }

      if (q.includes("thu tu") || q.includes("chronolog") || q.includes("timeline") || q.includes("nam xuat ban")) {
        const lines =
          chronological.length > 0
            ? chronological.map((b) => `• ${b.publishYear}: **${b.title}**`).join("\n")
            : hit.timeline.map((t) => `• ${t.year}: ${t.event}`).join("\n");
        return {
          text: `**Thứ tự / timeline — ${hit.name}**\n${lines}`,
          actions: chronological.length ? actionsForBooks(chronological.slice(0, 3)) : undefined,
          intent: "author_order",
        };
      }

      if (q.includes("moi nhat") || q.includes("latest") || q.includes("release") || q.includes("xuat ban moi")) {
        return {
          text: latest
            ? `Trên kệ BookNest, đầu gắn **${hit.name}** mới/nổi bật: **${latest.title}** (${latest.publishYear}) — ${money(latest.salePrice)}.`
            : `Timeline: ${hit.timeline.map((t) => t.year + " " + t.event).join(" · ")}`,
          actions: latest ? actionsForBooks([latest]) : undefined,
          intent: "author_latest",
        };
      }

      if (q.includes("giai thuong") || q.includes("award") || q.includes("giai")) {
        return {
          text: `**Awards — ${hit.name}**\n${hit.awards.map((a) => `• ${a}`).join("\n")}\n\n${hit.career}`,
          intent: "author_awards",
        };
      }

      if (q.includes("ai nen doc") || q.includes("who should") || q.includes("danh cho ai") || q.includes("hop voi")) {
        return {
          text: `Sách của **${hit.name}** hợp với: **${hit.idealReaders}**.\nPhong cách: ${hit.writingStyle}.\n${first ? `Gợi ý mở đầu: **${first.title}**.` : ""}`,
          actions: first ? actionsForBooks([first]) : undefined,
          intent: "author_audience",
        };
      }

      if (q.includes("quote") || q.includes("trich") || q.includes("cau noi") || q.includes("danh ngon")) {
        return {
          text: `💬 **${hit.name}**: “${hit.quote}”`,
          intent: "author_quote",
        };
      }

      // default author dossier
      return {
        text:
          `**${hit.name}** (${hit.nationality}) — ${hit.bio}\n` +
          `Sự nghiệp: ${hit.career}\n` +
          `Phong cách: ${hit.writingStyle}.\n` +
          `Độc giả hợp: ${hit.idealReaders}.\n` +
          `Awards: ${hit.awards.slice(0, 2).join("; ")}.\n` +
          (similar ? `Tác giả tương tự (AI): ${similar}.\n` : "") +
          (first ? `Nên đọc trước: **${first.title}** (${money(first.salePrice)}).` : "") +
          `\nBạn có thể hỏi: sách bán chạy, thứ tự đọc, awards, latest, hoặc “tôi thích ${hit.name}”.`,
        actions: first ? actionsForBooks(booksBy.slice(0, 2)) : undefined,
        intent: "author",
      };
    }

    if (q.includes("thich") || q.includes("like") || q.includes("tac gia")) {
      return {
        text:
          "Bạn thích tác giả nào?\nVí dụ: *James Clear*, *Dale Carnegie*, *Nguyên Phong*, *Kai-Fu Lee*.\n" +
          "Mình sẽ gợi ý: sách đầu tiên · tác giả tương tự · frequently bought together · beginner/advanced path.",
        intent: "author_ask",
      };
    }
  }

  // —— Summary ——
  if (q.includes("tom tat") || q.includes("noi dung chinh")) {
    const b = topMatches(ctx.books, raw, 1)[0];
    if (b) {
      return {
        text: `**${b.title}** của ${b.author}:\n${b.summary}\n\nGiá ${money(b.salePrice)}${b.stock <= 5 ? ` — chỉ còn ${b.stock} cuốn.` : "."}\nBạn muốn thêm giỏ hay xem sách cùng chủ đề?`,
        actions: actionsForBooks([b]),
      };
    }
  }

  // —— Price ——
  if (q.includes("gia") || q.includes("bao nhieu")) {
    const hits = topMatches(ctx.books, raw, 3);
    if (hits.length) {
      return {
        text: `Giá hiện tại:\n${hits.map(lineBook).join("\n")}\n\nMình thêm giúp cuốn nào vào giỏ không?`,
        actions: actionsForBooks(hits),
      };
    }
  }

  // —— Upsell FBT ——
  if (q.includes("mua kem") || q.includes("cung mua") || q.includes("combo") || q.includes("bundle")) {
    const base = ctx.viewed[0] ? ctx.books.find((b) => b.id === ctx.viewed[0].id) : personalRecs(ctx, 1)[0];
    const fbt = personalRecs(ctx, 3).filter((b) => b.id !== base?.id).slice(0, 2);
    if (base && fbt.length) {
      const sum = base.salePrice + fbt.reduce((s, b) => s + b.salePrice, 0);
      return {
        text:
          `Khách hay mua **${base.title}** kèm:\n${fbt.map((b) => `• ${b.title} (${money(b.salePrice)})`).join("\n")}\n` +
          `Cả bộ khoảng **${money(sum)}**` +
          (sum >= 200000 ? " — **đủ freeship**." : ".") +
          `\nMình thêm cả bộ vào giỏ?`,
        actions: actionsForBooks([base, ...fbt]),
        pendingAction: {
          type: "add_bundle",
          payload: [base.id, ...fbt.map((b) => b.id)].join(","),
          label: "Thêm combo",
          description: "thêm combo gợi ý vào giỏ",
        },
        nextPhase: "await_confirm",
      };
    }
  }

  // —— Membership / cross sell ——
  if (q.includes("member") || q.includes("thanh vien")) {
    return {
      text: "Hạng thành viên BookNest: tích điểm mỗi đơn, early access flash, quà sinh nhật.\nĐơn đầu dùng WELCOME10 là bắt đầu được rồi. Bạn muốn mình áp mã và soạn đơn không?",
    };
  }

  // —— AI negotiate bulk ——
  if (
    q.includes("thuong luong") ||
    q.includes("bargaining") ||
    q.includes("giam gia so luong") ||
    q.includes("mua si") ||
    /mua\s*\d+\s*(cuon|quyen|sach)/.test(q) ||
    /\d+\s*cuon/.test(q)
  ) {
    const m = q.match(/(\d{1,3})\s*(cuon|quyen|sach)?/);
    const qty = m ? Number(m[1]) : ctx.cartIds.length || 20;
    // ladder mirrors voucher deal rules
    let percent = 5;
    if (qty >= 15) percent = 8;
    if (qty >= 20) percent = 10;
    if (qty >= 30) percent = 12;
    if (qty >= 50) percent = 15;
    percent = Math.min(percent, 15);
    return {
      text:
        qty < 10
          ? `Để thương lượng deal sỉ, mình cần tối thiểu khoảng **10 cuốn**. Hiện bạn đề cập ${qty} — mua thêm chút nữa mình xin mức đẹp hơn nhé.`
          : `Với **${qty} cuốn**, theo quy tắc biên lợi nhuận shop, mình đề xuất **${percent}%** (mã DEAL${percent}).\nMình áp giúp và soạn đơn không?`,
      actions:
        qty >= 10
          ? [
              { type: "apply_coupon", label: `Áp DEAL${percent}`, payload: `DEAL${percent}` },
              { type: "open_checkout", label: "Thanh toán" },
            ]
          : [{ type: "open_cart", label: "Xem giỏ" }],
      intent: "negotiate",
    };
  }

  // Generic search — still ask a soft follow-up
  const hits = topMatches(ctx.books, raw, 3);
  if (hits.length) {
    return {
      text:
        `${rememberLine(ctx)}` +
        `Mình thấy vài cuốn liên quan:\n${hits.map(lineBook).join("\n")}\n\n` +
        `Bạn đang tìm cho **người mới** hay đã có kinh nghiệm? Mình lọc sát hơn.`,
      actions: actionsForBooks(hits),
      nextPhase: "discover",
      patchDiscover: { topic: detectTopic(q) || ctx.discover.topic },
    };
  }

  return {
    text:
      "Mình chưa bắt đúng ý — không sao ạ.\n" +
      "Bạn thử nói: *“Mình muốn học AI, mới bắt đầu, dưới 200k”* — mình sẽ dựng lộ trình đọc ngay.\n" +
      "Hoặc bấm **Gợi ý sách / Sách bán chạy / Săn voucher** phía trên nhé.",
    nextPhase: "discover",
    intent: "fallback",
  };
}

export function proactiveNudge(ctx: AssistantContext): AssistantReply | null {
  if (ctx.phase.startsWith("checkout_")) return null;

  if (ctx.cartIds.length >= 1) {
    const sub = cartSubtotal(ctx);
    if (sub > 0 && sub < 200000) {
      const need = 200000 - sub;
      const filler = ctx.books
        .filter((b) => !ctx.cartIds.includes(b.id) && b.salePrice <= need + 40000)
        .sort((a, b) => Math.abs(a.salePrice - need) - Math.abs(b.salePrice - need))[0];
      if (filler) {
        return {
          text:
            `Bạn cần mình hỗ trợ thanh toán hay áp dụng voucher không?\n` +
            `Giỏ còn thiếu khoảng **${money(need)}** để freeship — thêm **${filler.title}** (${money(filler.salePrice)}) là đủ.`,
          actions: [
            { type: "add_to_cart", bookId: filler.id, label: "Thêm để freeship" },
            { type: "apply_coupon", label: "WELCOME10", payload: "WELCOME10" },
            { type: "open_checkout", label: "Thanh toán" },
          ],
          intent: "proactive_cart",
        };
      }
      return {
        text: "Bạn cần mình hỗ trợ thanh toán hay áp dụng voucher không? Mình có thể chốt **COD** giúp bạn rất nhanh.",
        actions: [
          { type: "open_checkout", label: "Mở checkout" },
          { type: "apply_coupon", label: "WELCOME10", payload: "WELCOME10" },
        ],
      };
    }
    return {
      text: "Bạn cần mình hỗ trợ thanh toán hay áp dụng voucher không? Giỏ đã sẵn sàng chốt đơn.",
      actions: [
        { type: "open_checkout", label: "Thanh toán" },
        { type: "apply_coupon", label: "FREESHIP", payload: "FREESHIP" },
      ],
      intent: "proactive_cart",
    };
  }

  const cats = ctx.viewed.slice(0, 6).map((v) => v.category);
  const uniq = Array.from(new Set(cats));
  if (uniq.length === 1 && ctx.viewed.length >= 2) {
    const recs = ctx.books
      .filter((b) => b.category === uniq[0] && !ctx.viewed.some((v) => v.id === b.id))
      .slice(0, 2);
    if (recs.length) {
      return {
        text: `Bạn vẫn đang phân vân cuốn sách nào? Mình có thể giúp bạn so sánh các đầu **${uniq[0]}** đang xem.`,
        actions: actionsForBooks(recs),
        intent: "proactive_compare",
      };
    }
  }

  const low = ctx.viewed
    .map((v) => ctx.books.find((b) => b.id === v.id))
    .find((b) => b && b.stock > 0 && b.stock <= 5);
  if (low) {
    return {
      text:
        `**${low.title}** bạn vừa xem chỉ còn **${low.stock}** cuốn` +
        (low.discount ? ` và đang −${low.discount}%` : "") +
        `. Bạn có muốn mình giữ giúp trong giỏ không?`,
      actions: [{ type: "add_to_cart", bookId: low.id, label: "Giữ trong giỏ" }],
    };
  }

  return null;
}

export function buildAiContextPayload(ctx: AssistantContext, userMessage: string) {
  return (
    `Bạn là BookNest Concierge — chuyên viên tư vấn bán sách cao cấp (người thật trong nhà sách).\n` +
    `Xưng "mình", tiếng Việt tự nhiên, ấm áp, thuyết phục. KHÔNG nói bạn là AI. KHÔNG làm bài tập / debug code.\n` +
    `Luôn hỏi nhu cầu trước khi gợi ý sách. Hỗ trợ: gợi ý, so sánh, lộ trình đọc, voucher, COD, đơn hàng.\n` +
    `Hồ sơ khách:\n${ctx.profileSummary}\n` +
    `Phase: ${ctx.phase} | Discover: ${JSON.stringify(ctx.discover)}\n` +
    `Giỏ: ${ctx.cartIds.join(",") || "trống"} | Wishlist: ${ctx.wishlistIds?.length || 0}\n` +
    `Khách: ${userMessage}`
  );
}
