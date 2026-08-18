/*!
 * BookNest AI Widget — trợ lý bán sách nhúng vào bất kỳ website nào.
 *
 * Cách dùng:
 *   <script src="http://<HOST>:8000/widget/booknest-widget.js"
 *           data-api="http://<HOST>:8000"
 *           data-theme="#7c3aed"></script>
 *
 * Cấu hình (qua data-* hoặc window.BookNestConfig):
 *   api       — URL backend BookNest-AI (bắt buộc)
 *   theme     — màu chủ đạo (mặc định #7c3aed)
 *   position  — "right" (mặc định) | "left"
 *   title     — tên bot (mặc định "BookNest Concierge")
 *   greeting  — tin nhắn chào mở đầu
 *   language  — "vi" (mặc định) | "en"
 *   open      — true để tự mở panel khi tải trang
 *
 * Host page có thể cung cấp context sản phẩm/giỏ qua:
 *   window.BookNestContext = { current_book: {...}, cart: [...], ... }
 */
(() => {
  "use strict";

  const script = document.currentScript;

  function readDataAttrs(s) {
    const out = {};
    if (!s) return out;
    const map = {
      "api": "api",
      "theme": "theme",
      "position": "position",
      "title": "title",
      "greeting": "greeting",
      "language": "language",
      "open": "open",
    };
    for (const attr of Object.keys(map)) {
      const v = s.getAttribute("data-" + attr);
      if (v != null && v !== "") {
        out[map[attr]] = attr === "open" ? v !== "false" && v !== "0" : v;
      }
    }
    return out;
  }

  const cfg = Object.assign(
    {
      api: "",
      theme: "#7c3aed",
      position: "right",
      title: "BookNest Concierge",
      greeting: "Xin chào! Mình là trợ lý sách. Bạn muốn tìm sách gì hôm nay?",
      language: "vi",
      open: false,
    },
    (window.BookNestConfig || {}),
    readDataAttrs(script)
  );

  if (!cfg.api) {
    console.warn("[BookNest Widget] Thiếu `data-api`. Ví dụ: <script src=\"...\" data-api=\"http://127.0.0.1:8000\"></script>");
    return;
  }

  const API = String(cfg.api).replace(/\/+$/, "");
  const LS_SESSION = "bn_widget_session_id";
  let sessionId = null;
  try { sessionId = localStorage.getItem(LS_SESSION) || null; } catch (e) { /* private mode */ }

  const CHIPS = [
    { label: "✨ Gợi ý sách", msg: "Gợi ý cho mình vài cuốn sách hay" },
    { label: "🔥 Bán chạy", msg: "Sách bán chạy hiện nay" },
    { label: "🎁 Làm quà", msg: "Mình muốn chọn sách làm quà" },
    { label: "🎟 Mã giảm giá", msg: "Có mã giảm giá nào không?" },
  ];

  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;" +
    (cfg.position === "left" ? "left:20px;" : "right:20px;") +
    "bottom:20px;z-index:2147483000;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;line-height:1.4;";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  shadow.innerHTML = `
<style>
  :host { all: initial; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .bn-launcher {
    width: 60px; height: 60px; border-radius: 50%;
    border: 0; cursor: pointer;
    background: ${cfg.theme};
    color: #fff; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 8px 24px rgba(0,0,0,.28);
    transition: transform .18s ease, box-shadow .18s ease;
    position: relative;
  }
  .bn-launcher:hover { transform: scale(1.06); box-shadow: 0 12px 28px rgba(0,0,0,.32); }
  .bn-launcher svg { width: 28px; height: 28px; }
  .bn-panel {
    position: absolute; bottom: 74px; right: 0;
    width: min(370px, calc(100vw - 40px)); height: min(560px, calc(100vh - 110px));
    display: flex; flex-direction: column;
    background: #fff; border-radius: 18px; overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,.28);
    border: 1px solid rgba(0,0,0,.06);
    opacity: 0; transform: translateY(10px) scale(.98); pointer-events: none;
    transition: opacity .2s ease, transform .2s ease;
  }
  .bn-panel.open { opacity: 1; transform: none; pointer-events: auto; }
  .bn-header {
    background: ${cfg.theme}; color: #fff; padding: 14px 16px;
    display: flex; align-items: center; gap: 10px; flex-shrink: 0;
  }
  .bn-header .bn-avatar {
    width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,.2);
    display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;
  }
  .bn-header .bn-title { flex: 1; min-width: 0; }
  .bn-header .bn-title b { display: block; font-size: 14px; }
  .bn-header .bn-title span { font-size: 11px; opacity: .85; }
  .bn-header .bn-close {
    background: transparent; border: 0; color: #fff; cursor: pointer;
    font-size: 20px; line-height: 1; padding: 4px; opacity: .8;
  }
  .bn-messages {
    flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px;
    background: #f7f7f9;
  }
  .bn-msg { max-width: 85%; padding: 10px 12px; border-radius: 14px; font-size: 13.5px; white-space: pre-wrap; word-break: break-word; }
  .bn-msg.bot { background: #fff; border: 1px solid #eee; border-bottom-left-radius: 4px; align-self: flex-start; }
  .bn-msg.user { background: ${cfg.theme}; color: #fff; border-bottom-right-radius: 4px; align-self: flex-end; }
  .bn-msg strong { font-weight: 700; }
  .bn-msg .bn-book { display: flex; gap: 8px; align-items: center; margin-top: 6px; padding-top: 6px; border-top: 1px solid #eee; }
  .bn-msg .bn-book b { font-size: 12.5px; }
  .bn-msg .bn-book span { font-size: 11.5px; color: #666; }
  .bn-typing { align-self: flex-start; display: flex; gap: 4px; padding: 10px 12px; }
  .bn-typing i { width: 7px; height: 7px; border-radius: 50%; background: #c9c9d4; animation: bnBlink 1.2s infinite; }
  .bn-typing i:nth-child(2) { animation-delay: .15s; }
  .bn-typing i:nth-child(3) { animation-delay: .3s; }
  @keyframes bnBlink { 0%,80%,100% { opacity:.3 } 40% { opacity:1 } }
  .bn-chips { display: flex; gap: 6px; flex-wrap: wrap; padding: 0 14px 10px; flex-shrink: 0; background: #fff; }
  .bn-chip {
    border: 1px solid ${cfg.theme}55; background: ${cfg.theme}0d; color: ${cfg.theme};
    font-size: 12px; padding: 6px 10px; border-radius: 999px; cursor: pointer; transition: background .15s;
  }
  .bn-chip:hover { background: ${cfg.theme}22; }
  .bn-input {
    display: flex; gap: 8px; padding: 10px 12px 12px; border-top: 1px solid #eee; background: #fff; flex-shrink: 0;
  }
  .bn-input textarea {
    flex: 1; border: 1px solid #e2e2ea; border-radius: 12px; padding: 9px 12px;
    font: inherit; font-size: 13px; resize: none; outline: none; max-height: 90px; min-height: 40px;
  }
  .bn-input textarea:focus { border-color: ${cfg.theme}; }
  .bn-send {
    border: 0; border-radius: 12px; background: ${cfg.theme}; color: #fff; cursor: pointer;
    padding: 0 14px; font-weight: 700; font-size: 13px;
  }
  .bn-send:disabled { opacity: .5; cursor: not-allowed; }
  .bn-actions { display: flex; gap: 6px; flex-wrap: wrap; padding-top: 8px; }
  .bn-action {
    border: 1px solid ${cfg.theme}55; background: ${cfg.theme}0d; color: ${cfg.theme};
    font-size: 12px; padding: 7px 12px; border-radius: 999px; cursor: pointer; font-weight: 600;
    transition: background .15s, transform .1s;
  }
  .bn-action:hover { background: ${cfg.theme}22; }
  .bn-action:disabled { opacity: .55; cursor: not-allowed; }
</style>

<button class="bn-launcher" id="bnLauncher" type="button" title="${escapeAttr(cfg.title)}">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
  </svg>
</button>

<div class="bn-panel" id="bnPanel">
  <div class="bn-header">
    <div class="bn-avatar">✦</div>
    <div class="bn-title"><b>${escapeHtml(cfg.title)}</b><span>AI tư vấn sách</span></div>
    <button class="bn-close" id="bnClose" type="button" title="Đóng">×</button>
  </div>
  <div class="bn-messages" id="bnMessages"></div>
  <div class="bn-chips" id="bnChips"></div>
  <div class="bn-input">
    <textarea id="bnInput" rows="1" placeholder="Hỏi về sách, giá, gợi ý…"></textarea>
    <button class="bn-send" id="bnSend" type="button">Gửi</button>
  </div>
</div>
`;

  const launcher = shadow.getElementById("bnLauncher");
  const panel = shadow.getElementById("bnPanel");
  const messages = shadow.getElementById("bnMessages");
  const input = shadow.getElementById("bnInput");
  const sendBtn = shadow.getElementById("bnSend");
  const chipsEl = shadow.getElementById("bnChips");
  const closeBtn = shadow.getElementById("bnClose");

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }

  // Markdown-lite: **bold**, xuống dòng giữ nguyên (white-space: pre-wrap)
  function renderMarkdown(text) {
    const escaped = escapeHtml(String(text || ""));
    return escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  }

  function renderBooks(books) {
    if (!books || !books.length) return "";
    return books
      .slice(0, 5)
      .map((b) => {
        const title = escapeHtml(b.title || "Sách");
        const author = escapeHtml(b.author_name || b.author || "");
        const price = b.price != null ? fmtMoney(b.price, b.currency) : "";
        return `<div class="bn-book"><div><b>${title}</b><br><span>${author}${price ? " · " + price : ""}</span></div></div>`;
      })
      .join("");
  }

  function renderActions(actions) {
    if (!actions || !actions.length) return "";
    return (
      '<div class="bn-actions">' +
      actions
        .map(
          (a, i) =>
            `<button type="button" class="bn-action" data-act-i="${i}">${escapeHtml(a.label || a.type)}</button>`
        )
        .join("") +
      "</div>"
    );
  }

  function fmtMoney(n, currency) {
    if (currency === "VND" || (!currency && n > 1000)) {
      return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);
    }
    return "$" + Number(n).toFixed(2);
  }

  function addMsg(role, html) {
    const el = document.createElement("div");
    el.className = "bn-msg " + role;
    el.innerHTML = html;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  function addTyping() {
    const el = document.createElement("div");
    el.className = "bn-typing";
    el.innerHTML = "<i></i><i></i><i></i>";
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  function removeTyping(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }

  function buildContext() {
    const ctx = {
      language: cfg.language,
      current_page: typeof location !== "undefined" ? location.pathname : null,
      ...(window.BookNestContext || {}),
    };
    return ctx;
  }

  function buildBody(message) {
    return {
      message,
      session_id: sessionId || undefined,
      language: cfg.language,
      stream: false,
      context: buildContext(),
    };
  }

  function saveSession(id) {
    if (!id) return;
    sessionId = id;
    try { localStorage.setItem(LS_SESSION, id); } catch (e) {}
  }

  async function postChat(message) {
    const res = await fetch(`${API}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBody(message)),
    });
    if (!res.ok) {
      let detail = res.statusText;
      try { const j = await res.json(); detail = j.detail || j.message || detail; } catch (e) {}
      throw new Error(detail);
    }
    const data = await res.json();
    return data.data || data || {};
  }

  async function send(message) {
    message = (message || "").trim();
    if (!message) return;
    addMsg("user", renderMarkdown(message));
    input.value = "";
    autoSize();
    sendBtn.disabled = true;
    const typing = addTyping();

    try {
      const payload = await postChat(message);
      saveSession(payload.session_id);
      const body =
        renderMarkdown(payload.message || "…") + renderBooks(payload.books) + renderActions(payload.actions);
      removeTyping(typing);
      const el = addMsg("bot", body);
      wireActions(el, payload.actions);
    } catch (err) {
      removeTyping(typing);
      addMsg("bot", "Xin lỗi, mình chưa kết nối được tới máy chủ AI.\n" + (err && err.message ? "(" + renderMarkdown(err.message) + ")" : ""));
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  function wireActions(container, actions) {
    if (!container || !actions || !actions.length) return;
    container.querySelectorAll("[data-act-i]").forEach((btn) => {
      const i = Number(btn.getAttribute("data-act-i"));
      const action = actions[i];
      if (!action) return;
      btn.addEventListener("click", () => runAction(action));
    });
  }

  async function runAction(action) {
    const pageHandlers = window.BookNestActions || {};
    const handler =
      pageHandlers[action.type] ||
      pageHandlers.default ||
      (action.type === "navigate" && action.url
        ? () => {
            window.location.href = action.url;
            return { ok: true };
          }
        : null);
    if (!handler) {
      addMsg(
        "bot",
        "⚠️ Website này chưa kết nối hành động “" +
          escapeHtml(action.label || action.type) +
          "”. Bạn hãy tự thao tác trên trang, hoặc nhờ mình hướng dẫn nhé."
      );
      return;
    }
    try {
      const res = await handler(action);
      const ok = !res || res.ok !== false;
      addMsg(
        "bot",
        ok
          ? "✅ " + (res && res.message ? res.message : "Đã thực hiện: " + (action.label || action.type))
          : "⚠️ " + (res && res.message ? res.message : "Chưa thực hiện được hành động này.")
      );
    } catch (err) {
      addMsg("bot", "⚠️ Lỗi khi thực hiện: " + (err && err.message ? err.message : "không xác định"));
    }
  }

  function autoSize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 90) + "px";
  }

  function renderChips() {
    chipsEl.innerHTML = "";
    CHIPS.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bn-chip";
      b.textContent = c.label;
      b.addEventListener("click", () => send(c.msg));
      chipsEl.appendChild(b);
    });
  }

  launcher.addEventListener("click", () => {
    const opening = !panel.classList.contains("open");
    panel.classList.toggle("open", opening);
    if (opening && !messages.querySelector(".bn-msg")) {
      addMsg("bot", renderMarkdown(cfg.greeting));
    }
    if (opening) input.focus();
  });
  closeBtn.addEventListener("click", () => panel.classList.remove("open"));

  sendBtn.addEventListener("click", () => send(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input.value); }
  });
  input.addEventListener("input", autoSize);

  renderChips();
  if (cfg.open) {
    panel.classList.add("open");
    addMsg("bot", renderMarkdown(cfg.greeting));
  }
})();
