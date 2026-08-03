"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  Search,
  ScanBarcode,
  Clock,
  TrendingUp,
  Sparkles,
  X,
  RotateCcw,
  Square,
  Pause,
  Loader2,
} from "lucide-react";
import { popularKeywords } from "@/data/content";
import { formatVND, cn } from "@/lib/utils";
import { useCatalog } from "@/store/catalog";
import { useMemory } from "@/store/memory";
import { useVoiceSearch } from "@/hooks/useVoiceSearch";

const HISTORY_KEY = "booknest-search-history";

/** Normalize VN voice commands into clean search queries */
export function normalizeVoiceQuery(raw: string) {
  let t = raw.trim().replace(/\s+/g, " ");
  // strip polite prefixes
  t = t.replace(
    /^(tìm|tim|tìm kiếm|tim kiem|search|gợi ý|goi y|gợi ý sách|goi y sach|cho tôi|cho toi|mình muốn|minh muon|tôi muốn|toi muon)\s+/i,
    ""
  );
  t = t.replace(/^(sách|sach)\s+(của|cua)\s+/i, "");
  t = t.replace(/^(sách|sach)\s+/i, "");
  t = t.replace(/\s+(giúp|giup|với|voi|nhé|nhe|ạ|a|đi|di|được không|duoc khong)$/i, "");
  // price phrases → numeric tokens catalog understands
  t = t.replace(/dưới\s+/gi, "dưới ");
  t = t.replace(/(\d+)\s*(nghìn|ngàn|ngan)\b/gi, "$1000");
  t = t.replace(/(\d+)\s*k\b/gi, "$1000");
  t = t.replace(/(\d+)\s*(triệu|trieu)\b/gi, "$1000000");
  // common genre voice forms
  t = t.replace(/\blập trình\b/gi, "lập trình");
  t = t.replace(/\bkinh doanh\b/gi, "kinh doanh");
  return t.trim() || raw.trim();
}

export function SearchBar({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchBooks = useCatalog((s) => s.search);
  const books = useCatalog((s) => s.books);
  const trackSearch = useMemory((s) => s.trackSearch);

  const go = (term: string) => {
    const cleaned = normalizeVoiceQuery(term);
    if (!cleaned) return;
    setQ(cleaned);
    const next = [cleaned, ...history.filter((h) => h !== cleaned)].slice(0, 8);
    setHistory(next);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      /* quota */
    }
    trackSearch(cleaned);
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(cleaned)}`);
  };

  const voice = useVoiceSearch({
    lang: "vi-VN",
    onInterim: (text) => {
      setQ(text);
      setOpen(true);
    },
    onFinal: (text) => {
      const cleaned = normalizeVoiceQuery(text);
      setQ(cleaned);
      setOpen(true);
      go(cleaned);
    },
  });

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const suggestions = useMemo(() => {
    if (!q.trim()) return [];
    return searchBooks(q).slice(0, 6);
  }, [q, searchBooks]);

  const aiSuggest = useMemo(() => {
    if (!q.trim()) return books.filter((b) => b.featured).slice(0, 3);
    return searchBooks(q).slice(0, 3);
  }, [q, books, searchBooks]);

  const listening = voice.isListening;
  const processing = voice.isProcessing;
  const paused = voice.isPaused;

  return (
    <div ref={wrapRef} className={`relative w-full ${compact ? "" : ""}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
        className={cn(
          "relative flex items-center gap-1 rounded-full border bg-[#160726]/70 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl focus-within:border-primary/50 focus-within:shadow-[0_0_0_3px_rgba(168,85,247,0.18)]",
          listening ? "border-highlight shadow-[0_0_0_3px_rgba(236,72,153,0.2)]" : "border-white/10",
          processing && "border-primary",
          paused && "border-amber-400/50"
        )}
      >
        <Search className="ml-3 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={
            listening
              ? "Đang nghe… (vd: Tìm sách AI)"
              : paused
                ? "Đã tạm dừng — bấm micro để tiếp tục"
                : processing
                  ? "Đang xử lý giọng nói…"
                  : "Tìm sách, tác giả, ISBN…"
          }
          className="w-full bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-muted"
          aria-label="Tìm kiếm sách"
          aria-busy={processing}
        />

        <div className="flex items-center gap-0.5">
          {listening && (
            <>
              <button
                type="button"
                onClick={() => voice.pause()}
                className="rounded-full p-2 text-amber-200 hover:bg-white/5"
                title="Tạm dừng"
                aria-label="Tạm dừng nghe"
              >
                <Pause className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => voice.stop()}
                className="rounded-full p-2 text-highlight hover:bg-white/5"
                title="Dừng & nhận dạng"
                aria-label="Dừng nghe"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            </>
          )}
          {(voice.status === "no-speech" ||
            voice.status === "error" ||
            voice.status === "network" ||
            voice.status === "paused" ||
            voice.status === "denied") && (
            <button
              type="button"
              onClick={() => voice.restart()}
              className="rounded-full p-2 text-primary hover:bg-white/5"
              title="Thử lại"
              aria-label="Thử lại voice"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              if (listening) voice.stop();
              else voice.start();
            }}
            className={cn(
              "relative rounded-full p-2 transition",
              listening
                ? "bg-highlight text-white"
                : processing
                  ? "bg-primary/30 text-primary"
                  : paused
                    ? "bg-amber-400/20 text-amber-200"
                    : "text-muted hover:bg-white/5 hover:text-white"
            )}
            title={
              listening
                ? "Đang nghe — bấm để dừng"
                : processing
                  ? "Đang xử lý…"
                  : "Tìm bằng giọng nói (tiếng Việt)"
            }
            aria-pressed={listening}
            aria-label="Voice search"
          >
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
            {listening && (
              <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-highlight/40" />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => router.push("/scan")}
          className="hidden rounded-full p-2 text-muted hover:bg-white/5 hover:text-white sm:block"
          title="Quét ISBN / barcode"
          aria-label="Quét ISBN"
        >
          <ScanBarcode className="h-4 w-4" />
        </button>
        <button type="submit" className="btn-primary px-4 py-2 text-sm" disabled={processing}>
          {processing ? "…" : "Tìm"}
        </button>
      </form>

      {listening && (
        <div
          className="mt-2 flex items-center justify-center gap-1 rounded-full border border-highlight/20 bg-highlight/10 px-4 py-2"
          aria-live="polite"
        >
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <span
              key={i}
              className="inline-block w-1 rounded-full bg-highlight"
              style={{
                height: 8 + (i % 4) * 5,
                animation: `voiceBar 0.75s ease-in-out ${i * 0.08}s infinite alternate`,
              }}
            />
          ))}
          <span className="ml-2 text-[11px] font-semibold text-highlight">
            Đang lắng nghe tiếng Việt…
          </span>
        </div>
      )}

      {processing && (
        <div className="mt-2 flex items-center justify-center gap-2 text-[11px] font-semibold text-primary" aria-live="polite">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Đang chuyển giọng nói thành tìm kiếm…
        </div>
      )}

      {open && (
        <div className="glass absolute left-0 right-0 top-[calc(100%+10px)] z-50 overflow-hidden rounded-[24px] p-4">
          {voice.errorMessage && (
            <div
              className="mb-3 rounded-2xl border border-highlight/30 bg-highlight/10 px-3 py-2 text-xs text-highlight"
              role="alert"
            >
              {voice.errorMessage}
              {voice.status !== "unsupported" && (
                <button
                  type="button"
                  className="ml-2 font-bold underline"
                  onClick={() => voice.restart()}
                >
                  Thử lại
                </button>
              )}
            </div>
          )}

          {q.trim() ? (
            <div className="space-y-3">
              <p className="section-kicker text-[11px]">Gợi ý realtime</p>
              {suggestions.length === 0 && (
                <p className="text-sm text-muted">Không có kết quả khớp. Sửa từ khóa hoặc nói lại.</p>
              )}
              {suggestions.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => go(b.title)}
                  className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left transition hover:bg-primary/15"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{b.title}</p>
                    <p className="text-xs text-muted">
                      {b.author} · {b.category}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-primary">{formatVND(b.salePrice)}</span>
                </button>
              ))}
              <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3">
                <p className="mb-2 flex items-center gap-1 text-xs font-bold text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> AI gợi ý
                </p>
                <div className="flex flex-wrap gap-2">
                  {aiSuggest.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => go(b.title)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-text-secondary hover:border-primary/40 hover:text-white"
                    >
                      {b.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted">
                    <Clock className="h-3.5 w-3.5" /> Lịch sử
                  </p>
                  {history.length > 0 && (
                    <button
                      type="button"
                      className="text-[11px] text-primary"
                      onClick={() => {
                        setHistory([]);
                        localStorage.removeItem(HISTORY_KEY);
                      }}
                    >
                      Xóa
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {history.length === 0 && <p className="text-xs text-muted">Chưa có lịch sử</p>}
                  {history.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => go(h)}
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-text-secondary hover:border-primary/30"
                    >
                      {h}
                      <X
                        className="h-3 w-3 opacity-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = history.filter((x) => x !== h);
                          setHistory(next);
                          localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted">
                  <TrendingUp className="h-3.5 w-3.5" /> Lệnh giọng nói gợi ý
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Tìm sách AI",
                    "Sách của Dale Carnegie",
                    "Sách dưới 300 nghìn",
                    "Tìm sách lập trình Python",
                    "Gợi ý sách kinh doanh",
                    ...popularKeywords.slice(0, 3),
                  ].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => go(k)}
                      className="rounded-full bg-gradient-to-r from-primary/20 to-highlight/15 px-3 py-1 text-xs font-medium text-text-secondary hover:text-white"
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/scan")}
                  className="mt-3 text-xs font-semibold text-primary hover:text-highlight"
                >
                  Quét ISBN / barcode →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
