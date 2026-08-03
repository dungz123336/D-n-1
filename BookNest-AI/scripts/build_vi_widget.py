"""Build Vietnamese widget index.html from existing CSS + new body."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
widget = ROOT / "frontend-widget"
src = widget / "index.html"
text = src.read_text(encoding="utf-8")
i = text.find("</style>")
if i < 0:
    raise SystemExit("no style block")
head = text[: i + len("</style>")]

body = r"""
</head>
<body>
  <div class="shell" id="shell">
    <header class="header">
      <div class="header-left">
        <div class="orb-wrap">
          <div class="orb-ring"></div>
          <div class="orb" aria-hidden="true"></div>
        </div>
        <div class="brand">
          <h1>BookNest Concierge</h1>
          <div class="sub">
            <span class="online" title="Online"></span>
            AI tư vấn sách
          </div>
          <div class="status-line" id="statusLine">Đang trực tuyến</div>
        </div>
      </div>
      <div class="header-actions">
        <button class="icon-btn" id="btnExpand" title="Phóng to" type="button">
          <svg viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
        </button>
        <button class="icon-btn" id="btnHistory" title="Lịch sử" type="button">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
        </button>
        <button class="icon-btn" id="btnSettings" title="Cài đặt" type="button">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
        </button>
        <button class="icon-btn" id="btnClose" title="Đóng" type="button">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
    </header>

    <div class="chips-wrap">
      <div class="chips" id="chips"></div>
    </div>

    <div class="messages" id="messages"></div>
    <div class="thinking" id="thinking">
      <div class="dots"><i></i><i></i><i></i></div>
      <span id="thinkingText">Đang tìm đầu sách phù hợp...</span>
    </div>

    <div class="composer" id="composer">
      <form class="input-shell" id="form">
        <textarea id="input" rows="1" placeholder="Hỏi về sách, tác giả, đơn hàng hoặc mã giảm giá..."></textarea>
        <div class="input-tools">
          <div class="tools-left">
            <button type="button" class="tool" id="btnVoice" title="Giọng nói">
              <svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M19 11a7 7 0 0 1-14 0"/><path d="M12 18v3"/></svg>
            </button>
            <button type="button" class="tool" id="btnImage" title="Tải ảnh">
              <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M21 16l-5-5-4 4-2-2-5 5"/></svg>
            </button>
            <button type="button" class="tool" id="btnBarcode" title="Quét ISBN">
              <svg viewBox="0 0 24 24"><path d="M4 7V5h2M18 5h2v2M20 17v2h-2M6 19H4v-2"/><path d="M7 8h1v8H7zM10 8h2v8h-2zM14 8h1v8h-1zM17 8h1v8h-1z"/></svg>
            </button>
            <button type="button" class="tool" id="btnEmoji" title="Cảm xúc">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01M8.5 14.5S10 16.5 12 16.5s3.5-2 3.5-2"/></svg>
            </button>
            <button type="button" class="tool" id="btnAttach" title="Đính kèm">
              <svg viewBox="0 0 24 24"><path d="M21 12.5V18a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h7.5"/><path d="M17 3v6h6"/><path d="M14 10l9-9"/></svg>
            </button>
          </div>
          <button type="submit" class="send" id="btnSend" title="Gửi" aria-label="Gửi">
            <svg viewBox="0 0 24 24"><path d="M3.4 20.6L21 12 3.4 3.4 3 10l11 2-11 2z"/></svg>
          </button>
        </div>
      </form>
      <input type="file" id="fileImage" accept="image/*" hidden />
      <input type="file" id="fileAttach" hidden />
    </div>

    <div class="voice-overlay" id="voiceOverlay">
      <div class="wave" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span>
      </div>
      <div class="voice-text" id="voiceText">Đang lắng nghe...</div>
      <div class="voice-sub" id="voiceSub">Bạn hãy nói tên sách hoặc chủ đề muốn tìm.</div>
      <button type="button" class="voice-stop" id="voiceStop">Dừng</button>
    </div>

    <div class="settings-panel" id="settingsPanel">
      <label>Mã khách hàng
        <input id="customerId" type="number" value="1" min="1" />
      </label>
      <label>Ngôn ngữ
        <select id="language">
          <option value="vi" selected>Tiếng Việt</option>
          <option value="en">English</option>
        </select>
      </label>
      <button type="button" class="btn ghost" id="btnNewSession" style="width:100%">Hội thoại mới</button>
    </div>

    <div class="history-panel" id="historyPanel">
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px;font-weight:600;">Gần đây</div>
      <div id="historyList"></div>
    </div>

    <div class="toast" id="toast"></div>
  </div>
  <script src="/widget/app.js"></script>
</body>
</html>
"""

out = head + body
src.write_text(out, encoding="utf-8")
# Legacy static path (FileResponse may use static/chat.html)
static = ROOT / "static"
static.mkdir(exist_ok=True)
(static / "chat.html").write_text(out.replace('src="/widget/app.js"', 'src="/static/app.js"'), encoding="utf-8")
shutil.copy(widget / "app.js", static / "app.js")
print("built", src, "and static/chat.html")
