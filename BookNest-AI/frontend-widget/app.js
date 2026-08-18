/* BookNest Concierge UI - tieng Viet */
(() => {
  const el = {
    messages: document.getElementById("messages"),
    form: document.getElementById("form"),
    input: document.getElementById("input"),
    btnSend: document.getElementById("btnSend"),
    thinking: document.getElementById("thinking"),
    thinkingText: document.getElementById("thinkingText"),
    statusLine: document.getElementById("statusLine"),
    chips: document.getElementById("chips"),
    shell: document.getElementById("shell"),
    composer: document.getElementById("composer"),
    toast: document.getElementById("toast"),
    voiceOverlay: document.getElementById("voiceOverlay"),
    voiceText: document.getElementById("voiceText"),
    voiceSub: document.getElementById("voiceSub"),
    settingsPanel: document.getElementById("settingsPanel"),
    historyPanel: document.getElementById("historyPanel"),
    historyList: document.getElementById("historyList"),
    customerId: document.getElementById("customerId"),
    language: document.getElementById("language"),
    btnVoice: document.getElementById("btnVoice"),
  };

  let sessionId = localStorage.getItem("bn_session_id") || null;
  let expanded = false;
  let listening = false;
  let recognition = null;
  const cartLocal = JSON.parse(localStorage.getItem("bn_ai_cart") || "[]");
  const wishlistLocal = JSON.parse(localStorage.getItem("bn_ai_wish") || "[]");

  const CHIPS = [
    { icon: "✨", label: "Gợi ý sách", msg: "Mình muốn được gợi ý sách phù hợp" },
    { icon: "🔥", label: "Sách bán chạy", msg: "Gợi ý sách bán chạy hiện nay" },
    { icon: "🆕", label: "Sách mới", msg: "Có sách mới nào hay không?" },
    { icon: "📖", label: "Sách học tập", msg: "Gợi ý sách học tập" },
    { icon: "🌱", label: "Phát triển bản thân", msg: "Sách phát triển bản thân" },
    { icon: "💼", label: "Kinh doanh", msg: "Sách kinh doanh hay cho người mới" },
    { icon: "💻", label: "Công nghệ", msg: "Sách công nghệ / lập trình" },
    { icon: "🤖", label: "AI tư vấn", msg: "Tư vấn chọn sách theo mục tiêu của mình" },
    { icon: "🎁", label: "Mua làm quà", msg: "Mình cần chọn sách làm quà" },
    { icon: "🎟", label: "Mã giảm giá", msg: "Có mã giảm giá nào phù hợp không?" },
    { icon: "🛒", label: "Giỏ hàng", msg: "Xem giỏ hàng và hỗ trợ thanh toán" },
    { icon: "📦", label: "Đơn hàng", msg: "Hỗ trợ theo dõi đơn hàng" },
    { icon: "🎙", label: "Tìm bằng giọng nói", msg: "__voice__" },
    { icon: "📷", label: "Quét mã ISBN", msg: "Hướng dẫn quét mã ISBN" },
  ];

  const WELCOME_ACTIONS = [
    { icon: "🔍", label: "Tìm sách", msg: "Mình muốn tìm sách" },
    { icon: "🎁", label: "Mua làm quà", msg: "Chọn sách làm quà" },
    { icon: "✨", label: "AI gợi ý", msg: "Gợi ý sách theo nhu cầu của mình" },
    { icon: "🔥", label: "Đang hot", msg: "Sách bán chạy" },
    { icon: "📦", label: "Đơn hàng", msg: "Theo dõi đơn hàng giúp mình" },
    { icon: "❤️", label: "Yêu thích", msg: "Gợi ý sách để thêm vào wishlist" },
  ];

  const PROMPTS = [
    "Mình muốn học AI",
    "Sách kinh doanh",
    "Chọn sách làm quà",
    "Sách phát triển bản thân",
    "Sách dưới 200.000đ",
  ];

  const THINKING_PHASES = [
    "Đang tìm đầu sách phù hợp...",
    "✨ Đang chọn những gợi ý tốt nhất...",
    "Đang so sánh các lựa chọn...",
    "🎟 Đang kiểm tra ưu đãi...",
    "Đang tra cứu đơn hàng...",
    "Đang chuẩn bị thanh toán...",
  ];

  function nowTime() {
    return new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    setTimeout(() => el.toast.classList.remove("show"), 2200);
  }
  function setStatus(text, thinking = false) {
    el.statusLine.textContent = text;
    el.statusLine.classList.toggle("thinking", thinking);
  }
  function money(n) {
    const raw = Number(n) || 0;
    const vnd = raw > 1000 ? Math.round(raw) : Math.round(raw * 24000);
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(vnd);
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function renderChips() {
    el.chips.innerHTML = CHIPS.map(
      (c, i) => `<button type="button" class="chip" data-i="${i}"><span class="ic">${c.icon}</span>${esc(c.label)}</button>`
    ).join("");
    el.chips.querySelectorAll(".chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const c = CHIPS[Number(btn.dataset.i)];
        if (c.msg === "__voice__") startVoice();
        else if (c.label.includes("ISBN")) {
          addBubble("bot", "Hãy đưa mã ISBN của sách vào khung hình để mình nhận diện 📷\n\nHoặc gõ mã ISBN / mã vạch vào ô chat nhé.");
        } else sendMessage(c.msg);
      });
    });
  }

  function renderWelcome() {
    const wrap = document.createElement("div");
    wrap.className = "welcome";
    wrap.innerHTML = `
      <h2>Xin chào ✨</h2>
      <p style="white-space:pre-wrap;line-height:1.55">Mình là <strong>BookNest Concierge</strong>.

Mình sẽ đồng hành cùng bạn trong suốt quá trình tìm và mua sách.

Mình có thể hỗ trợ:
📚 Gợi ý sách theo nhu cầu
✨ Tư vấn theo mục tiêu học tập hoặc công việc
🎁 Chọn sách làm quà
🎟 Áp dụng mã giảm giá
🛒 Đặt hàng nhanh
📦 Theo dõi đơn hàng
💳 Hỗ trợ thanh toán

Bạn muốn tìm sách về chủ đề nào hôm nay?</p>
      <div class="welcome-grid">
        ${WELCOME_ACTIONS.map((a, i) => `<button type="button" class="welcome-card" data-i="${i}"><span>${a.icon}</span>${esc(a.label)}</button>`).join("")}
      </div>
      <div style="margin-top:14px;font-size:11px;color:var(--muted);font-weight:600;">Bạn có thể thử</div>
      <div class="prompts" style="margin-top:8px">
        ${PROMPTS.map((p) => `<button type="button" class="prompt">${esc(p)}</button>`).join("")}
      </div>`;
    el.messages.appendChild(wrap);
    wrap.querySelectorAll(".welcome-card").forEach((b) => {
      b.addEventListener("click", () => sendMessage(WELCOME_ACTIONS[Number(b.dataset.i)].msg));
    });
    wrap.querySelectorAll(".prompt").forEach((b) => {
      b.addEventListener("click", () => sendMessage(b.textContent));
    });
  }

  function addBubble(role, text) {
    const row = document.createElement("div");
    row.className = "row " + role;
    row.innerHTML = `<div class="bubble">${esc(text)}</div><div class="time">${nowTime()}</div>`;
    el.messages.appendChild(row);
    el.messages.scrollTop = el.messages.scrollHeight;
    return row;
  }

  function bookCardHtml(book) {
    const discount = book.original_price && book.original_price > book.price
      ? Math.round((1 - book.price / book.original_price) * 100) : 0;
    const cover = book.cover_url ? `<img src="${esc(book.cover_url)}" alt="" />` : "📖";
    return `<article class="book-card" data-id="${book.id}">
      <div class="book-cover">${cover}</div>
      <div class="book-body">
        <div class="book-title">${esc(book.title)}</div>
        <div class="book-author">${esc(book.author_name || "Chưa rõ tác giả")}</div>
        <div class="book-meta">
          <span class="rating">⭐ ${(book.rating ?? 0).toFixed(1)}</span>
          <span class="price">${money(book.price)}${discount ? `<s>${money(book.original_price)}</s>` : ""}</span>
          ${discount ? `<span class="badge sale">-${discount}%</span>` : ""}
          ${(book.rating || 0) >= 4.6 ? `<span class="badge best">Bán chạy</span>` : ""}
          <span class="badge stock">${book.stock > 0 ? `Còn ${book.stock} cuốn` : "Hết hàng"}</span>
        </div>
        <div class="book-actions">
          <button type="button" class="btn primary" data-act="cart">Thêm vào giỏ</button>
          <button type="button" class="btn ghost" data-act="buy">Mua ngay</button>
          <button type="button" class="btn ghost" data-act="view">Xem chi tiết</button>
          <button type="button" class="btn ghost" data-act="compare">⚖️ So sánh</button>
          <button type="button" class="btn ghost" data-act="save">Lưu</button>
        </div>
      </div>
    </article>`;
  }

  function attachBookHandlers(container) {
    container.querySelectorAll(".book-card").forEach((card) => {
      const id = Number(card.dataset.id);
      card.querySelectorAll("[data-act]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const act = btn.dataset.act;
          if (act === "cart" || act === "buy") {
            try {
              await fetch("/add-cart", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customer_id: Number(el.customerId.value) || 1, book_id: id, quantity: 1 }),
              });
              if (!cartLocal.includes(id)) cartLocal.push(id);
              localStorage.setItem("bn_ai_cart", JSON.stringify(cartLocal));
              toast("Đã thêm vào giỏ hàng.");
              if (act === "buy") sendMessage("Mình muốn mua ngay sách id " + id + ", hỗ trợ thanh toán giúp mình");
            } catch { toast("Chưa thêm được vào giỏ. Bạn thử lại nhé."); }
          } else if (act === "compare") sendMessage("So sánh sách id " + id + " với vài lựa chọn tương tự giúp mình");
          else if (act === "view") sendMessage("Kể thêm về sách id " + id + " giúp mình");
          else if (act === "save") {
            if (!wishlistLocal.includes(id)) wishlistLocal.push(id);
            localStorage.setItem("bn_ai_wish", JSON.stringify(wishlistLocal));
            toast("Đã lưu vào danh sách yêu thích.");
          }
        });
      });
    });
  }

  function renderBookCards(books) {
    if (!books || !books.length) return;
    const row = document.createElement("div");
    row.className = "row bot";
    row.innerHTML = `<div class="cards">${books.map(bookCardHtml).join("")}</div><div class="time">${nowTime()}</div>`;
    el.messages.appendChild(row);
    attachBookHandlers(row);
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  function renderOrderCard() {
    const row = document.createElement("div");
    row.className = "row bot";
    row.innerHTML = `<div class="order-card"><h4>Đơn hàng #BN10258</h4>
      <div class="timeline">
        <div class="tl-item done"><span class="tl-dot"></span><span>✓ Đã xác nhận</span></div>
        <div class="tl-item done"><span class="tl-dot"></span><span>✓ Đã đóng gói</span></div>
        <div class="tl-item active"><span class="tl-dot"></span><span>Đang giao hàng</span></div>
        <div class="tl-item"><span class="tl-dot"></span><span>Dự kiến giao trong 2–3 ngày</span></div>
      </div>
      <button type="button" class="btn primary" id="trackPkg">Theo dõi đơn</button></div>
      <div class="time">${nowTime()}</div>`;
    el.messages.appendChild(row);
    row.querySelector("#trackPkg")?.addEventListener("click", () => sendMessage("Theo dõi đơn BN10258 giúp mình"));
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  function renderVoucherCard() {
    const row = document.createElement("div");
    row.className = "row bot";
    row.innerHTML = `<div class="voucher-card"><h4>🎟 Ưu đãi dành cho bạn</h4>
      <div class="voucher-code">WELCOME10</div>
      <div class="voucher-meta">Giảm 10% · áp dụng theo chính sách cửa hàng<br/>Dành cho khách mới / thành viên</div>
      <div class="book-actions" style="margin-top:12px">
        <button type="button" class="btn ghost" data-copy="WELCOME10">Sao chép</button>
        <button type="button" class="btn primary" data-apply="WELCOME10">Áp dụng</button>
      </div></div><div class="time">${nowTime()}</div>`;
    el.messages.appendChild(row);
    row.querySelector("[data-copy]")?.addEventListener("click", async (e) => {
      try { await navigator.clipboard.writeText(e.currentTarget.getAttribute("data-copy")); toast("Đã sao chép mã giảm giá."); }
      catch { toast("WELCOME10"); }
    });
    row.querySelector("[data-apply]")?.addEventListener("click", (e) => {
      sendMessage("Áp dụng mã giảm giá " + e.currentTarget.getAttribute("data-apply") + " giúp mình");
    });
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  async function fetchBooksForCards(query) {
    try {
      const params = new URLSearchParams({ page_size: "3" });
      if (query) params.set("query", query);
      const r = await fetch("/books?" + params);
      const data = await r.json();
      return data.items || [];
    } catch { return []; }
  }

  function shouldShowBooks(text) {
    return /gợi ý|sách|quà|bán chạy|học|kinh doanh|công nghệ|phát triển|dưới|ngân sách|tìm|recommend|bestseller/i.test(text || "");
  }
  function shouldShowOrder(text) {
    return /đơn hàng|theo dõi|giao hàng|hủy đơn|đổi địa chỉ|hoàn tiền|thanh toán/i.test(text || "");
  }
  function shouldShowVoucher(text) {
    return /mã giảm|voucher|ưu đãi|flash|coupon|giảm giá/i.test(text || "");
  }

  let thinkTimer = null;
  function startThinking() {
    let i = 0;
    el.thinkingText.textContent = THINKING_PHASES[0];
    el.thinking.classList.add("show");
    setStatus(THINKING_PHASES[0], true);
    thinkTimer = setInterval(() => {
      i = (i + 1) % THINKING_PHASES.length;
      el.thinkingText.textContent = THINKING_PHASES[i];
      setStatus(THINKING_PHASES[i], true);
    }, 1600);
  }
  function stopThinking() {
    clearInterval(thinkTimer);
    el.thinking.classList.remove("show");
    setStatus("Đang trực tuyến");
  }

  async function sendMessage(message) {
    message = (message || "").trim();
    if (!message) return;
    el.messages.querySelector(".welcome")?.classList.add("hidden");
    addBubble("user", message);
    el.input.value = "";
    el.btnSend.disabled = true;
    startThinking();
    const body = {
      message,
      language: "vi",
      customer_id: Number(el.customerId.value) || null,
      session_id: sessionId,
      context: { language: "vi", customer_id: Number(el.customerId.value) || null, current_page: "/ui/chat", membership: "gold" },
    };
    try {
      const r = await fetch("/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || data.message || "Lỗi kết nối");
      const payload = data.data || data;
      if (payload.session_id) {
        sessionId = payload.session_id;
        localStorage.setItem("bn_session_id", sessionId);
      }
      addBubble("bot", payload.message || "…");
      if (payload.books && payload.books.length) renderBookCards(payload.books.slice(0, 5));
      if (shouldShowOrder(message)) renderOrderCard();
      if (shouldShowVoucher(message)) {
        renderVoucherCard();
        toast("Đã gợi ý mã giảm giá.");
      }
      pushHistory(message);
    } catch (err) {
      addBubble("bot", "Xin lỗi ✨\n\nHiện tại mình chưa lấy được dữ liệu.\nBạn thử lại sau ít phút nhé.");
      setStatus("Tạm gián đoạn", false);
    } finally {
      stopThinking();
      el.btnSend.disabled = false;
      el.input.focus();
    }
  }

  function pushHistory(msg) {
    const list = JSON.parse(localStorage.getItem("bn_hist") || "[]");
    list.unshift({ t: Date.now(), msg });
    localStorage.setItem("bn_hist", JSON.stringify(list.slice(0, 12)));
  }
  function renderHistory() {
    const list = JSON.parse(localStorage.getItem("bn_hist") || "[]");
    el.historyList.innerHTML = list.length
      ? list.map((h) => `<div class="history-item" data-m="${esc(h.msg)}">${esc(h.msg.slice(0, 48))}${h.msg.length > 48 ? "…" : ""}</div>`).join("")
      : `<div class="history-item" style="cursor:default;opacity:.6">Chưa có lịch sử</div>`;
    el.historyList.querySelectorAll(".history-item[data-m]").forEach((n) => {
      n.addEventListener("click", () => {
        el.historyPanel.classList.remove("show");
        sendMessage(n.getAttribute("data-m"));
      });
    });
  }

  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast("Trình duyệt chưa hỗ trợ giọng nói"); return; }
    if (listening) return;
    recognition = new SR();
    recognition.lang = "vi-VN";
    recognition.interimResults = true;
    recognition.continuous = false;
    listening = true;
    el.btnVoice.classList.add("active");
    el.voiceOverlay.classList.add("show");
    el.voiceText.textContent = "Đang lắng nghe...";
    el.voiceSub.textContent = "Bạn hãy nói tên sách hoặc chủ đề muốn tìm.";
    setStatus("Đang lắng nghe...", true);
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      el.voiceText.textContent = "Đang nhận diện...";
      el.voiceSub.textContent = transcript || "…";
      if (event.results[event.results.length - 1].isFinal) {
        el.voiceText.textContent = "Đang tìm sách...";
        stopVoice();
        if (transcript.trim()) sendMessage(transcript.trim());
      }
    };
    recognition.onerror = () => { toast("Không nhận diện được giọng nói"); stopVoice(); };
    recognition.onend = () => stopVoice();
    recognition.start();
  }
  function stopVoice() {
    listening = false;
    el.btnVoice.classList.remove("active");
    el.voiceOverlay.classList.remove("show");
    try { recognition && recognition.stop(); } catch (e) {}
    setStatus("Đang trực tuyến");
  }

  el.form.addEventListener("submit", (e) => { e.preventDefault(); sendMessage(el.input.value); });
  el.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); el.form.requestSubmit(); }
  });
  el.input.addEventListener("input", () => {
    el.input.style.height = "auto";
    el.input.style.height = Math.min(el.input.scrollHeight, 110) + "px";
  });

  document.getElementById("btnVoice").addEventListener("click", startVoice);
  document.getElementById("voiceStop").addEventListener("click", stopVoice);
  document.getElementById("btnImage").addEventListener("click", () => document.getElementById("fileImage").click());
  document.getElementById("btnAttach").addEventListener("click", () => document.getElementById("fileAttach").click());
  document.getElementById("fileImage").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    toast("Đang nhận diện ảnh bìa...");
    try {
      const r = await fetch("/image", { method: "POST", body: fd });
      const data = await r.json();
      const book = data && data.data && data.data.book;
      addBubble("bot", (data && data.message) || "Mình đã nhận ảnh. Nếu chưa khớp, bạn gửi thêm ISBN nhé 📷");
      if (book) renderBookCards([book]);
    } catch (err) { toast("Tải ảnh chưa thành công"); }
    e.target.value = "";
  });
  document.getElementById("btnBarcode").addEventListener("click", () => {
    addBubble("bot", "Hãy đưa mã ISBN của sách vào khung hình để mình nhận diện 📷\n\nHoặc gõ mã ISBN / mã vạch vào đây nhé.");
    const code = prompt("Nhập mã ISBN hoặc mã vạch:");
    if (code) sendMessage("Tìm sách theo ISBN " + code);
  });
  document.getElementById("btnEmoji").addEventListener("click", () => { el.input.value += " ✨"; el.input.focus(); });

  ["dragenter", "dragover"].forEach((ev) => el.composer.addEventListener(ev, (e) => { e.preventDefault(); el.composer.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach((ev) => el.composer.addEventListener(ev, (e) => { e.preventDefault(); el.composer.classList.remove("dragover"); }));
  el.composer.addEventListener("drop", (e) => {
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    const input = document.getElementById(file.type.startsWith("image/") ? "fileImage" : "fileAttach");
    input.files = dt.files;
    input.dispatchEvent(new Event("change"));
  });

  document.getElementById("btnSettings").addEventListener("click", () => { el.historyPanel.classList.remove("show"); el.settingsPanel.classList.toggle("show"); });
  document.getElementById("btnHistory").addEventListener("click", () => { el.settingsPanel.classList.remove("show"); renderHistory(); el.historyPanel.classList.toggle("show"); });
  document.getElementById("btnExpand").addEventListener("click", () => {
    expanded = !expanded;
    el.shell.style.width = expanded ? "min(560px, 100%)" : "";
    el.shell.style.height = expanded ? "min(860px, calc(100vh - 40px))" : "";
  });
  document.getElementById("btnClose").addEventListener("click", () => {
    toast("Đã thu nhỏ Concierge");
    el.shell.style.opacity = "0.35";
    el.shell.style.transform = "scale(0.98)";
    setTimeout(() => { el.shell.style.opacity = ""; el.shell.style.transform = ""; }, 800);
  });
  document.getElementById("btnNewSession").addEventListener("click", () => {
    sessionId = null;
    localStorage.removeItem("bn_session_id");
    el.messages.innerHTML = "";
    renderWelcome();
    el.settingsPanel.classList.remove("show");
    toast("Đã tạo hội thoại mới");
  });
  document.addEventListener("click", (e) => {
    if (!el.settingsPanel.contains(e.target) && e.target.id !== "btnSettings") el.settingsPanel.classList.remove("show");
    if (!el.historyPanel.contains(e.target) && e.target.id !== "btnHistory") el.historyPanel.classList.remove("show");
  });

  renderChips();
  renderWelcome();
  setStatus("Đang trực tuyến");
  fetch("/health").then((r) => r.json()).then((d) => { if (d.status === "healthy") setStatus("Đang trực tuyến"); }).catch(() => setStatus("Mất kết nối"));
  el.input.focus();
})();
