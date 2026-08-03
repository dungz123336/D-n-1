"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  Suspense,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  X,
  Send,
  Loader2,
  ShoppingBag,
  BookOpen,
  Heart,
  Ticket,
  Package,
  Sparkles,
  TrendingUp,
  Gift,
  Mic,
  ImagePlus,
  ScanBarcode,
  Maximize2,
  Minimize2,
  Expand,
  Shrink,
  GripHorizontal,
  Bell,
  Paperclip,
  Layers,
  Volume2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMemory, type ChatTurn } from "@/store/memory";
import { useConciergeContext } from "@/hooks/useConciergeContext";
import {
  aiChatStream,
  aiHealth,
  aiUploadImage,
  aiBarcode,
  type ChatResult,
} from "@/lib/booknestAi";
import { SimpleMarkdown } from "@/components/chat/SimpleMarkdown";
import { formatVND, cn } from "@/lib/utils";

type Mode = "collapsed" | "open" | "expanded" | "fullscreen";

type Notice = {
  id: string;
  kind: "order" | "voucher" | "restock" | "price";
  title: string;
  body: string;
};

const SESSION_KEY = "bn-ai-session-id";
const WELCOME_KEY = "bn-ai-welcome-v3";

const QUICK: { label: string; send: string; icon: typeof BookOpen }[] = [
  { label: "Gợi ý sách", send: "Gợi ý sách phù hợp với mình dựa trên lịch sử xem và wishlist", icon: Sparkles },
  { label: "Học AI", send: "Tôi muốn học AI — gợi ý lộ trình và sách từ cơ bản đến nâng cao", icon: Sparkles },
  { label: "Roadmap", send: "Tạo roadmap đọc sách phát triển bản thân 30 ngày", icon: BookOpen },
  { label: "So sánh", send: "So sánh giúp mình 2–3 cuốn bestseller self-help", icon: Layers },
  { label: "Bán chạy", send: "Sách bán chạy", icon: TrendingUp },
  { label: "Tóm tắt", send: "Tóm tắt sách đang xem: bài học chính, độ khó, thời gian đọc", icon: BookOpen },
  { label: "Quiz", send: "Tạo quiz và flashcard cho sách đang xem", icon: BookOpen },
  { label: "Voucher", send: "Có flash sale, combo, mã thành viên nào phù hợp không?", icon: Ticket },
  { label: "Loyalty", send: "Cho mình xem điểm thưởng và hạng thành viên", icon: Gift },
  { label: "Giỏ hàng", send: "Xem giỏ hàng và tư vấn checkout", icon: ShoppingBag },
  { label: "Đơn hàng", send: "Hỗ trợ theo dõi đơn hàng", icon: Package },
  { label: "Wishlist", send: "Gợi ý từ wishlist của mình", icon: Heart },
];

function loadSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}
function saveSession(id: string) {
  try {
    localStorage.setItem(SESSION_KEY, id);
  } catch {
    /* */
  }
}

function ChatWidgetInner() {
  const memory = useMemory();
  const {
    roleLabel,
    pathname,
    searchQuery,
    currentBook,
    apiContext,
    systemHint,
    customerId,
  } = useConciergeContext();

  const [mode, setMode] = useState<Mode>("collapsed");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(false);
  const [msgs, setMsgs] = useState<ChatTurn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [listening, setListening] = useState(false);
  const [ttsOn, setTtsOn] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dragState = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
  const booted = useRef(false);
  const lastPath = useRef(pathname);

  const open = mode !== "collapsed";

  // Health
  useEffect(() => {
    aiHealth().then(setOnline);
    const t = setInterval(() => aiHealth().then(setOnline), 30000);
    return () => clearInterval(t);
  }, []);

  // Boot messages
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    setSessionId(loadSession());

    const welcome: ChatTurn = {
      id: "welcome-v3",
      role: "assistant",
      text:
        "Xin chào ✨\n\n" +
        "Mình là **BookNest Concierge**.\n\n" +
        "Mình sẽ đồng hành cùng bạn tìm sách, áp mã giảm giá, đặt hàng và theo dõi đơn.\n\n" +
        "Bạn muốn tìm sách về chủ đề nào hôm nay?",
      at: Date.now(),
    };

    try {
      if (!localStorage.getItem(WELCOME_KEY)) {
        localStorage.setItem(WELCOME_KEY, "1");
        setMsgs([welcome]);
        memory.addChat(welcome);
        return;
      }
    } catch {
      /* */
    }

    if (memory.chatHistory.length) {
      setMsgs(memory.chatHistory.slice(-40));
    } else {
      setMsgs([welcome]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy, mode]);

  // Page-aware proactive tips
  useEffect(() => {
    if (!open || lastPath.current === pathname) {
      lastPath.current = pathname;
      return;
    }
    lastPath.current = pathname;

    let tip = "";
    if (currentBook) {
      tip =
        `Mình thấy bạn đang xem **${currentBook.title}** của ${currentBook.author}. ` +
        `Giá ${formatVND(currentBook.salePrice || currentBook.price)}, ` +
        `đánh giá ${currentBook.rating}⭐, còn ${currentBook.stock} cuốn.\n\n` +
        `Bạn muốn mình so sánh với sách tương tự, áp voucher, hay thêm vào giỏ?`;
    } else if (pathname.startsWith("/checkout")) {
      tip =
        "Bạn đang ở **trang thanh toán**. Mình có thể gợi ý mã giảm tốt nhất, chọn COD/MoMo/VNPay, hoặc kiểm tra lại giỏ hàng.";
    } else if (pathname.startsWith("/cart")) {
      tip = "Bạn đang xem **giỏ hàng**. Cần mình gợi ý combo, voucher, hay hỗ trợ checkout?";
    } else if (pathname.includes("account") || pathname.includes("order")) {
      tip = "Bạn đang xem **đơn hàng**. Gửi mã đơn để mình tra cứu, hỗ trợ hủy/đổi địa chỉ/hoàn tiền nhé.";
    } else if (pathname.startsWith("/search") && searchQuery) {
      tip =
        `Bạn vừa tìm **“${searchQuery}”**. Mình có thể gợi ý sách tương tự, bestseller, tác giả liên quan, lộ trình đọc, combo và voucher.`;
    }

    if (tip) {
      const turn: ChatTurn = {
        id: `page_${Date.now()}`,
        role: "assistant",
        text: tip,
        at: Date.now(),
      };
      setMsgs((m) => [...m, turn]);
      memory.addChat(turn);
    }
  }, [pathname, currentBook, searchQuery, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Simulated realtime notifications
  useEffect(() => {
    const push = (n: Omit<Notice, "id">) => {
      const item = { ...n, id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 5)}` };
      setNotices((prev) => [item, ...prev].slice(0, 4));
      setTimeout(() => {
        setNotices((prev) => prev.filter((x) => x.id !== item.id));
      }, 8000);
    };

    const timers = [
      setTimeout(
        () =>
          push({
            kind: "voucher",
            title: "Voucher dành cho bạn",
            body: "WELCOME10 — giảm 10% đơn đầu. Mở chat để áp dụng.",
          }),
        12000
      ),
      setTimeout(
        () =>
          push({
            kind: "price",
            title: "Giá vừa giảm",
            body: currentBook
              ? `${currentBook.title} đang có ưu đãi — hỏi Concierge để so sánh.`
              : "Một số bestseller vừa giảm giá. Hỏi Concierge nhé!",
          }),
        45000
      ),
      setTimeout(
        () =>
          push({
            kind: "restock",
            title: "Hàng về lại",
            body: "Sách bạn từng xem đã có thêm tồn kho.",
          }),
        90000
      ),
    ];
    return () => timers.forEach(clearTimeout);
  }, [currentBook?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const pushUser = (text: string) => {
    const turn: ChatTurn = {
      id: `u_${Date.now()}`,
      role: "user",
      text,
      at: Date.now(),
    };
    setMsgs((m) => [...m, turn]);
    memory.addChat(turn);
  };

  const pushAssistant = (text: string) => {
    const turn: ChatTurn = {
      id: `a_${Date.now()}`,
      role: "assistant",
      text,
      at: Date.now(),
    };
    setMsgs((m) => [...m, turn]);
    memory.addChat(turn);
    return turn;
  };

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;
      setInput("");
      pushUser(text);
      setBusy(true);

      // Compose message with live page context for the model
      const stockLine = currentBook
        ? `[Sách đang xem: "${currentBook.title}" id=${currentBook.id} | ` +
          `giá=${currentBook.salePrice || currentBook.price}đ | ` +
          `tồn kho THẬT=${currentBook.stock} → ${
            (currentBook.stock ?? 0) > 0 ? "CÒN HÀNG" : "HẾT HÀNG"
          } | rating=${currentBook.rating}]\n\n`
        : "";
      const invCount = apiContext.website_inventory?.length || 0;
      const enriched =
        `[Ngữ cảnh trang: ${systemHint}]\n` +
        `[Inventory website đã gửi ${invCount} đầu sách kèm stock thật — bắt buộc dùng.]\n\n` +
        stockLine +
        text;

      const assistantId = `a_stream_${Date.now()}`;
      setMsgs((m) => [
        ...m,
        { id: assistantId, role: "assistant", text: "", at: Date.now() },
      ]);

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      let full = "";
      try {
        await aiChatStream(
          {
            message: enriched,
            session_id: sessionId,
            customer_id: customerId,
            language: "vi",
            context: apiContext,
          },
          (delta) => {
            full += delta;
            setMsgs((m) =>
              m.map((t) => (t.id === assistantId ? { ...t, text: full } : t))
            );
          },
          (sid) => {
            if (sid) {
              setSessionId(sid);
              saveSession(sid);
            }
          },
          ac.signal
        );
        if (full) {
          memory.addChat({
            id: assistantId,
            role: "assistant",
            text: full,
            at: Date.now(),
          });
          if (ttsOn && typeof window !== "undefined" && window.speechSynthesis) {
            try {
              window.speechSynthesis.cancel();
              const u = new SpeechSynthesisUtterance(full.replace(/[*#`_]/g, "").slice(0, 500));
              u.lang = "vi-VN";
              u.rate = 1.02;
              window.speechSynthesis.speak(u);
            } catch {
              /* ignore TTS errors */
            }
          }
        } else {
          setMsgs((m) =>
            m.map((t) =>
              t.id === assistantId
                ? {
                    ...t,
                    text: "Xin lỗi ✨\n\nHiện tại mình chưa lấy được dữ liệu. Bạn thử lại sau ít phút nhé.",
                  }
                : t
            )
          );
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMsgs((m) =>
            m.map((t) =>
              t.id === assistantId
                ? {
                    ...t,
                    text:
                      "Xin lỗi ✨\n\nMình chưa kết nối được BookNest AI.\n" +
                      "Hãy chắc server đang chạy tại `http://127.0.0.1:8000`.",
                  }
                : t
            )
          );
        }
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, sessionId, customerId, apiContext, systemHint, currentBook, ttsOn]
  );

  const onVoice = () => {
    const SR =
      typeof window !== "undefined"
        ? (window as unknown as { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition })
            .SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition })
            .webkitSpeechRecognition
        : null;
    if (!SR) {
      pushAssistant("Trình duyệt chưa hỗ trợ tìm bằng giọng nói. Bạn gõ tin nhắn giúp mình nhé.");
      return;
    }
    const rec = new SR();
    rec.lang = "vi-VN";
    rec.interimResults = false;
    setListening(true);
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      const t = ev.results[0][0].transcript;
      setListening(false);
      if (t) send(t);
    };
    rec.onerror = () => {
      setListening(false);
      pushAssistant("Mình chưa nghe rõ. Bạn thử nói lại hoặc gõ giúp mình nhé.");
    };
    rec.onend = () => setListening(false);
    rec.start();
  };

  const onBarcode = async () => {
    const code = window.prompt("Nhập mã ISBN / mã vạch:");
    if (!code?.trim()) return;
    setBusy(true);
    pushUser(`Quét ISBN: ${code.trim()}`);
    try {
      const data = await aiBarcode(code.trim(), customerId, sessionId);
      const chat = data?.data?.chat as ChatResult | undefined;
      const book = data?.data?.book as { title?: string } | undefined;
      if (chat?.session_id) {
        setSessionId(chat.session_id);
        saveSession(chat.session_id);
      }
      pushAssistant(
        chat?.message ||
          (book
            ? `Mình tìm thấy **${book.title}**. Bạn muốn tư vấn thêm không?`
            : "Chưa tìm thấy sách với mã này.")
      );
    } catch {
      pushAssistant("Xin lỗi ✨ Mình chưa tra được mã ISBN. Bạn thử lại nhé.");
    } finally {
      setBusy(false);
    }
  };

  const onImage = async (file: File) => {
    setBusy(true);
    pushUser(`[Đã gửi ảnh: ${file.name}]`);
    try {
      const data = await aiUploadImage(file, customerId, sessionId);
      const chat = data?.data?.chat as ChatResult | undefined;
      if (chat?.session_id) {
        setSessionId(chat.session_id);
        saveSession(chat.session_id);
      }
      pushAssistant(
        chat?.message ||
          data?.message ||
          "Mình đã nhận ảnh. Nếu chưa khớp sách, bạn gửi thêm ISBN nhé 📷"
      );
    } catch {
      pushAssistant("Tải ảnh chưa thành công. Bạn thử lại giúp mình.");
    } finally {
      setBusy(false);
    }
  };

  // Drag handlers
  const onDragStart = (e: ReactPointerEvent) => {
    if (mode === "fullscreen") return;
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragState.current = {
      ox: e.clientX,
      oy: e.clientY,
      px: dragPos?.x ?? rect.left,
      py: dragPos?.y ?? rect.top,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onDragMove = (e: ReactPointerEvent) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.ox;
    const dy = e.clientY - dragState.current.oy;
    setDragPos({
      x: Math.max(8, Math.min(window.innerWidth - 80, dragState.current.px + dx)),
      y: Math.max(8, Math.min(window.innerHeight - 80, dragState.current.py + dy)),
    });
  };
  const onDragEnd = () => {
    dragState.current = null;
  };

  const panelStyle: React.CSSProperties =
    mode === "fullscreen"
      ? { inset: 0, width: "100%", height: "100%", borderRadius: 0 }
      : mode === "expanded"
        ? {
            width: "min(520px, calc(100vw - 24px))",
            height: "min(85vh, 780px)",
            right: 16,
            bottom: 16,
            left: "auto",
            top: "auto",
          }
        : dragPos
          ? {
              left: dragPos.x,
              top: dragPos.y,
              right: "auto",
              bottom: "auto",
              width: "min(400px, calc(100vw - 24px))",
              height: "min(70vh, 640px)",
            }
          : {
              right: 16,
              bottom: 16,
              width: "min(400px, calc(100vw - 24px))",
              height: "min(70vh, 640px)",
            };

  return (
    <>
      {/* Notifications */}
      <div className="pointer-events-none fixed bottom-28 right-4 z-[90] flex w-[min(320px,calc(100vw-2rem))] flex-col gap-2">
        <AnimatePresence>
          {notices.map((n) => (
            <motion.button
              key={n.id}
              type="button"
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              onClick={() => {
                setMode("open");
                setNotices((p) => p.filter((x) => x.id !== n.id));
                if (n.kind === "voucher") send("Áp dụng mã giảm giá tốt nhất giúp mình");
                if (n.kind === "order") send("Kiểm tra đơn hàng gần nhất giúp mình");
                if (n.kind === "price" || n.kind === "restock")
                  send(currentBook ? `Tư vấn thêm về ${currentBook.title}` : "Gợi ý sách đang giảm giá");
              }}
              className="pointer-events-auto rounded-2xl border border-white/10 bg-[#2d174a]/95 p-3 text-left shadow-xl backdrop-blur-xl"
            >
              <div className="flex items-start gap-2">
                <Bell className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-300" />
                <div>
                  <div className="text-xs font-semibold text-white">{n.title}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-white/70">{n.body}</div>
                </div>
              </div>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {/* Launcher */}
      <AnimatePresence>
        {mode === "collapsed" && (
          <motion.button
            type="button"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setMode("open")}
            className="fixed bottom-5 right-5 z-[100] flex h-14 w-14 items-center justify-center rounded-full shadow-2xl"
            style={{
              background: "linear-gradient(135deg, #a855f7 0%, #9333ea 50%, #ec4899 100%)",
              boxShadow: "0 12px 40px rgba(168,85,247,0.45)",
            }}
            aria-label="Mở BookNest Concierge"
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-fuchsia-500/30" />
            <Sparkles className="relative h-6 w-6 text-white" />
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#160726]",
                online ? "bg-emerald-400" : "bg-amber-400"
              )}
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className={cn(
              "fixed z-[100] flex flex-col overflow-hidden border border-white/10 shadow-2xl",
              mode === "fullscreen" ? "rounded-none" : "rounded-3xl"
            )}
            style={{
              ...panelStyle,
              background:
                "linear-gradient(165deg, rgba(45,23,74,0.92) 0%, rgba(22,7,38,0.96) 100%)",
              backdropFilter: "blur(28px) saturate(140%)",
              WebkitBackdropFilter: "blur(28px) saturate(140%)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(168,85,247,0.15)",
            }}
          >
            {/* Header */}
            <div
              className="flex shrink-0 items-center gap-3 border-b border-white/10 px-3 py-3"
              style={{
                background: "linear-gradient(90deg, rgba(168,85,247,0.18), rgba(236,72,153,0.08))",
              }}
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
            >
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 shadow-lg shadow-purple-500/40">
                <Sparkles className="h-4 w-4 text-white" />
                <span
                  className={cn(
                    "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#2d174a]",
                    online ? "bg-emerald-400" : "bg-amber-400"
                  )}
                />
              </div>
              <div className="min-w-0 flex-1 cursor-grab active:cursor-grabbing">
                <div className="flex items-center gap-1.5">
                  <h2 className="truncate text-sm font-bold text-white">BookNest Concierge</h2>
                  <GripHorizontal className="h-3.5 w-3.5 text-white/30" />
                </div>
                <p className="truncate text-[11px] text-purple-200/80">
                  {roleLabel}
                  {online ? " · Đang trực tuyến" : " · Đang kết nối…"}
                </p>
              </div>
              <div className="flex items-center gap-0.5">
                <IconBtn
                  title={mode === "expanded" ? "Thu nhỏ" : "Mở rộng"}
                  onClick={() => setMode(mode === "expanded" ? "open" : "expanded")}
                >
                  {mode === "expanded" ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
                </IconBtn>
                <IconBtn
                  title={mode === "fullscreen" ? "Thoát toàn màn hình" : "Toàn màn hình"}
                  onClick={() => setMode(mode === "fullscreen" ? "open" : "fullscreen")}
                >
                  {mode === "fullscreen" ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </IconBtn>
                <IconBtn title="Đóng" onClick={() => setMode("collapsed")}>
                  <X className="h-4 w-4" />
                </IconBtn>
              </div>
            </div>

            {/* Context strip */}
            {currentBook && (
              <div className="flex shrink-0 items-center gap-2 border-b border-white/5 bg-purple-500/10 px-3 py-2">
                <BookOpen className="h-3.5 w-3.5 shrink-0 text-fuchsia-300" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-semibold text-white">
                    Đang xem: {currentBook.title}
                  </div>
                  <div className="truncate text-[10px] text-white/55">
                    {currentBook.author} · {formatVND(currentBook.salePrice || currentBook.price)} ·{" "}
                    {currentBook.rating}⭐ · còn {currentBook.stock}
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-medium text-purple-100 hover:bg-white/15"
                  onClick={() => send(`Tư vấn chi tiết cuốn ${currentBook.title}`)}
                >
                  Hỏi về sách này
                </button>
              </div>
            )}

            {/* Quick actions */}
            <div className="shrink-0 overflow-x-auto border-b border-white/5 px-2 py-2 scrollbar-none">
              <div className="flex gap-1.5">
                {QUICK.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    disabled={busy}
                    onClick={() => send(q.send)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-purple-400/25 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-purple-100 transition hover:border-fuchsia-400/40 hover:bg-fuchsia-500/15"
                  >
                    <q.icon className="h-3 w-3 opacity-80" />
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
              {msgs.map((m) => (
                <div
                  key={m.id}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[88%] rounded-2xl px-3 py-2 shadow-md",
                      m.role === "user"
                        ? "rounded-br-md bg-gradient-to-br from-purple-500 to-fuchsia-600 text-white"
                        : "rounded-bl-md border border-white/10 bg-white/5 backdrop-blur-md"
                    )}
                  >
                    {m.role === "assistant" ? (
                      m.text ? (
                        <SimpleMarkdown text={m.text} />
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-white/50">
                          <Loader2 className="h-3 w-3 animate-spin" /> Đang soạn…
                        </span>
                      )
                    ) : (
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{m.text}</p>
                    )}
                  </div>
                </div>
              ))}
              {busy && msgs[msgs.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-purple-200/80">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ✨ Đang chọn những gợi ý tốt nhất…
                    </span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Composer */}
            <div className="shrink-0 border-t border-white/10 bg-black/20 p-2.5">
              <form
                className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  rows={2}
                  placeholder="Hỏi về sách, tác giả, đơn hàng hoặc mã giảm giá..."
                  className="max-h-28 min-h-[44px] w-full resize-none bg-transparent px-1 text-[13px] text-white outline-none placeholder:text-white/35"
                />
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-0.5">
                    <ToolBtn title="Giọng nói" active={listening} onClick={onVoice}>
                      <Mic className="h-4 w-4" />
                    </ToolBtn>
                    <ToolBtn title="Ảnh bìa" onClick={() => fileRef.current?.click()}>
                      <ImagePlus className="h-4 w-4" />
                    </ToolBtn>
                    <ToolBtn title="ISBN" onClick={onBarcode}>
                      <ScanBarcode className="h-4 w-4" />
                    </ToolBtn>
                    <ToolBtn
                      title="Đính kèm"
                      onClick={() => fileRef.current?.click()}
                    >
                      <Paperclip className="h-4 w-4" />
                    </ToolBtn>
                    <ToolBtn
                      title={ttsOn ? "Tắt đọc to" : "Bật đọc to (TTS)"}
                      active={ttsOn}
                      onClick={() => {
                        setTtsOn((v) => !v);
                        if (ttsOn && typeof window !== "undefined") {
                          window.speechSynthesis?.cancel();
                        }
                      }}
                    >
                      <Volume2 className="h-4 w-4" />
                    </ToolBtn>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onImage(f);
                        e.target.value = "";
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy || !input.trim()}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 text-white shadow-lg shadow-purple-500/30 disabled:opacity-40"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </form>
              <p className="mt-1.5 text-center text-[10px] text-white/30">
                BookNest AI · {roleLabel}
                {pathname ? ` · ${pathname}` : ""}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="rounded-xl p-1.5 text-white/55 transition hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  );
}

function ToolBtn({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white",
        active && "bg-fuchsia-500/25 text-fuchsia-200"
      )}
    >
      {children}
    </button>
  );
}

/** Suspense boundary for useSearchParams */
export function ChatWidget() {
  return (
    <Suspense fallback={null}>
      <ChatWidgetInner />
    </Suspense>
  );
}

// Minimal SpeechRecognition typings (browser)
interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  start: () => void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionEvent extends Event {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}
