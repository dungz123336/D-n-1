import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ChatWidget } from "@/components/chat/ChatWidget";
import "./globals.css";

export const metadata: Metadata = {
  title: "BookNest — AI-Powered Premium Bookstore",
  description:
    "Nhà sách AI cao cấp: tư vấn lộ trình đọc, voice search, ISBN scanner, voucher thông minh, membership và trải nghiệm mua sắm editorial.",
  keywords: [
    "BookNest",
    "nhà sách online",
    "AI book advisor",
    "voice search",
    "ISBN scanner",
    "voucher",
  ],
  openGraph: {
    title: "BookNest — AI-Powered Premium Bookstore",
    description: "Editorial design meets intelligent shopping.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className="h-full">
      <body className="relative min-h-full font-serif antialiased">
        <div className="ambient" aria-hidden>
          <div className="ambient-orb ambient-orb-1" />
          <div className="ambient-orb ambient-orb-2" />
          <div className="ambient-orb ambient-orb-3" />
        </div>
        <div className="shell relative z-[1] flex min-h-screen flex-col">
          <Header />
          <main id="main-content" className="flex-1 pb-10">
            {children}
          </main>
          <Footer />
        </div>
        <ChatWidget />
      </body>
    </html>
  );
}
