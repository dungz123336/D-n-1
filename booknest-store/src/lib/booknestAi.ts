/**
 * BookNest-AI API client — used by the floating Concierge widget.
 * Backend: BookNest-AI FastAPI (default http://127.0.0.1:8000)
 */

export const AI_BASE =
  process.env.NEXT_PUBLIC_BOOKNEST_AI_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000";

/** Live book row from the website catalog (stock/price source of truth). */
export type WebsiteBookSnapshot = {
  id: number;
  title: string;
  slug?: string;
  author?: string;
  publisher?: string;
  category?: string;
  price?: number;
  sale_price?: number;
  stock: number;
  rating?: number;
  review_count?: number;
  isbn?: string;
  language?: string;
  summary?: string;
  tags?: string[];
};

export type AiChatContext = {
  customer_id?: number | null;
  current_page?: string | null;
  current_book_id?: number | null;
  current_book?: WebsiteBookSnapshot | Record<string, unknown> | null;
  current_category?: string | null;
  /** Full (or large) snapshot of website catalog for stock/price truth */
  website_inventory?: WebsiteBookSnapshot[];
  inventory_source?: string;
  cart?: Array<Record<string, unknown>>;
  wishlist?: number[];
  wishlist_books?: WebsiteBookSnapshot[];
  orders?: Array<Record<string, unknown>>;
  viewed_books?: number[];
  viewed_book_details?: WebsiteBookSnapshot[];
  search_history?: string[];
  coupons?: string[];
  membership?: string | null;
  language?: string;
};

export type ChatPayload = {
  message: string;
  session_id?: string | null;
  customer_id?: number | null;
  language?: string;
  stream?: boolean;
  context?: AiChatContext;
};

export type ChatResult = {
  session_id: string;
  message: string;
  role?: string;
  intent?: string;
  books?: Array<Record<string, unknown>>;
  provider?: string;
  model?: string;
  latency_ms?: number;
};

async function parseJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      (data as { detail?: string; message?: string }).detail ||
      (data as { message?: string }).message ||
      res.statusText;
    throw new Error(String(detail));
  }
  return data;
}

/** Non-streaming chat */
export async function aiChat(payload: ChatPayload): Promise<ChatResult> {
  const res = await fetch(`${AI_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: payload.message,
      session_id: payload.session_id || undefined,
      customer_id: payload.customer_id || undefined,
      language: payload.language || "vi",
      stream: false,
      context: payload.context,
    }),
  });
  const data = await parseJson(res);
  return (data.data || data) as ChatResult;
}

/**
 * SSE stream chat — calls onDelta for each text chunk.
 * Falls back to non-streaming if stream endpoint fails.
 */
export async function aiChatStream(
  payload: ChatPayload,
  onDelta: (delta: string, meta?: Record<string, unknown>) => void,
  onDone: (sessionId?: string) => void,
  signal?: AbortSignal
): Promise<void> {
  try {
    const res = await fetch(`${AI_BASE}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        message: payload.message,
        session_id: payload.session_id || undefined,
        customer_id: payload.customer_id || undefined,
        language: payload.language || "vi",
        stream: true,
        context: payload.context,
      }),
      signal,
    });
    if (!res.ok || !res.body) {
      const fallback = await aiChat(payload);
      onDelta(fallback.message);
      onDone(fallback.session_id);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let sessionId: string | undefined;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const part of parts) {
        const line = part
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.replace(/^data:\s?/, ""))
          .join("");
        if (!line) continue;
        try {
          const chunk = JSON.parse(line) as {
            session_id?: string;
            delta?: string;
            done?: boolean;
            meta?: Record<string, unknown>;
          };
          if (chunk.session_id) sessionId = chunk.session_id;
          if (chunk.delta) onDelta(chunk.delta, chunk.meta);
          if (chunk.done) {
            onDone(sessionId);
            return;
          }
        } catch {
          /* ignore partial JSON */
        }
      }
    }
    onDone(sessionId);
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    const fallback = await aiChat(payload);
    onDelta(fallback.message);
    onDone(fallback.session_id);
  }
}

export async function aiUploadImage(file: File, customerId?: number | null, sessionId?: string | null) {
  const fd = new FormData();
  fd.append("file", file);
  if (customerId) fd.append("customer_id", String(customerId));
  if (sessionId) fd.append("session_id", sessionId);
  const res = await fetch(`${AI_BASE}/chat/image`, { method: "POST", body: fd });
  return parseJson(res);
}

export async function aiBarcode(code: string, customerId?: number | null, sessionId?: string | null) {
  const res = await fetch(`${AI_BASE}/chat/barcode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, customer_id: customerId, session_id: sessionId }),
  });
  return parseJson(res);
}

export async function aiVoice(
  transcript: string,
  customerId?: number | null,
  sessionId?: string | null
) {
  const fd = new FormData();
  fd.append("transcript", transcript);
  fd.append("language", "vi");
  if (customerId) fd.append("customer_id", String(customerId));
  if (sessionId) fd.append("session_id", sessionId);
  const res = await fetch(`${AI_BASE}/chat/voice`, { method: "POST", body: fd });
  return parseJson(res);
}

export async function aiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${AI_BASE}/health`, { cache: "no-store" });
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === "healthy";
  } catch {
    return false;
  }
}

export async function fetchAiBook(id: number) {
  try {
    const res = await fetch(`${AI_BASE}/books/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await parseJson(res);
    return data.data || null;
  } catch {
    return null;
  }
}
