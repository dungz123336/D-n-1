import Link from "next/link";
import { BookOpen, Mail, MapPin, Phone, Share2, Globe, PlayCircle } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-white/10">
      <div className="grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="mb-5 flex items-center gap-2.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-highlight text-white shadow-[0_0_24px_rgba(168,85,247,0.4)]">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <p className="text-lg font-extrabold tracking-tight text-white">BookNest</p>
              <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-muted">
                Luxury Editorial
              </p>
            </div>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-text-secondary">
            Không gian đọc tinh chọn — thẩm mỹ tối giản, trải nghiệm cao cấp, giao tận tay trên toàn quốc.
          </p>
          <div className="mt-5 flex gap-2">
            {[Share2, Globe, PlayCircle].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-text-secondary transition hover:border-primary/40 hover:bg-primary/20 hover:text-white"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-bold tracking-wide text-white">Hỗ trợ</h4>
          <ul className="space-y-2.5 text-sm text-muted">
            <li><Link href="/search" className="transition hover:text-primary">Khám phá sách</Link></li>
            <li><Link href="/trending" className="transition hover:text-primary">Bảng xếp hạng</Link></li>
            <li><Link href="/roadmap" className="transition hover:text-primary">Lộ trình đọc AI</Link></li>
            <li><Link href="/mystery-box" className="transition hover:text-primary">Mystery Book Box</Link></li>
            <li><Link href="/membership" className="transition hover:text-primary">Membership</Link></li>
            <li><Link href="/group-buy" className="transition hover:text-primary">Mua chung</Link></li>
            <li><Link href="/authors" className="transition hover:text-primary">Tác giả</Link></li>
            <li><Link href="/bookshelf" className="transition hover:text-primary">AI Bookshelf</Link></li>
            <li><Link href="/compare" className="transition hover:text-primary">AI Compare</Link></li>
            <li><Link href="/challenges" className="transition hover:text-primary">Reading Challenge</Link></li>
            <li><Link href="/contact" className="transition hover:text-primary">Support Center</Link></li>
            <li><Link href="/admin" className="transition hover:text-primary">Admin CMS</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-bold tracking-wide text-white">Liên hệ</h4>
          <ul className="space-y-3 text-sm text-muted">
            <li className="flex gap-2"><Phone className="mt-0.5 h-4 w-4 text-primary" /> 1900 266 563</li>
            <li className="flex gap-2"><Mail className="mt-0.5 h-4 w-4 text-highlight" /> hello@booknest.vn</li>
            <li className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 text-secondary" /> Quận 1, TP. Hồ Chí Minh</li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            {["COD", "MoMo", "VNPay", "ZaloPay", "Visa"].map((p) => (
              <span key={p} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                {p}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-bold tracking-wide text-white">Newsletter</h4>
          <p className="mb-3 text-sm text-muted">Nhận tuyển chọn sách & ưu đãi editorial mỗi tuần.</p>
          <form className="flex gap-2">
            <input type="email" placeholder="Email của bạn" className="input-dark" />
            <button type="button" className="btn-primary shrink-0 px-4 py-2 text-sm">Gửi</button>
          </form>
          <div className="mt-5 rounded-[20px] border border-primary/25 bg-gradient-to-br from-primary/25 to-highlight/15 p-4">
            <p className="text-sm font-bold text-white">Membership Gold</p>
            <p className="mt-1 text-xs text-text-secondary">Điểm thưởng · Early access · Gift cards</p>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-muted">
        © {new Date().getFullYear()} BookNest Editorial. Crafted for immersive reading.
      </div>
    </footer>
  );
}
