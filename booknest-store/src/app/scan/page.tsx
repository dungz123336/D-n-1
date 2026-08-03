"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, ScanBarcode, Search } from "lucide-react";
import { useCatalog } from "@/store/catalog";
import { BookCard } from "@/components/books/BookCard";
import { formatVND } from "@/lib/utils";
import { useCart } from "@/store/cart";

export default function ScanPage() {
  const books = useCatalog((s) => s.books);
  const add = useCart((s) => s.add);
  const [isbn, setIsbn] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [found, setFound] = useState<(typeof books)[0] | null>(null);

  const lookup = (code: string) => {
    const c = code.replace(/[-\s]/g, "");
    const hit =
      books.find((b) => b.isbn.replace(/[-\s]/g, "") === c) ||
      books.find((b) => b.isbn.replace(/[-\s]/g, "").includes(c)) ||
      books.find((b) => c.includes(b.isbn.replace(/[-\s]/g, "").slice(-6)));
    // demo: map partial codes to sample books
    const demo =
      hit ||
      (c.length >= 4
        ? books[Math.abs(Number(c.slice(-2)) || 0) % books.length]
        : null);
    setFound(demo || null);
    if (!demo) setError("Không khớp sách trong catalog. Thử ISBN đầy đủ hoặc nhập tay.");
    else setError("");
  };

  const startCamera = async () => {
    setError("");
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // BarcodeDetector if available
      const BD = (window as unknown as {
        BarcodeDetector?: new (opts: { formats: string[] }) => {
          detect(video: HTMLVideoElement | null): Promise<{ rawValue: string }[]>;
        };
      }).BarcodeDetector;
      if (BD) {
        const detector = new BD({ formats: ["ean_13", "ean_8", "code_128", "qr_code", "upc_a"] });
        const tick = async () => {
          if (!scanning || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes?.[0]?.rawValue) {
              setIsbn(codes[0].rawValue);
              lookup(codes[0].rawValue);
              stopCamera();
              return;
            }
          } catch {
            /* keep scanning */
          }
          if (streamRef.current) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      } else {
        setError("Trình duyệt chưa hỗ trợ BarcodeDetector. Hãy nhập ISBN thủ công hoặc dùng Chrome Android mới.");
      }
    } catch {
      setError("Không mở được camera. Cho phép quyền camera hoặc nhập ISBN.");
      setScanning(false);
    }
  };

  const stopCamera = () => {
    setScanning(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => () => stopCamera(), []);

  const related = found
    ? books.filter((b) => b.category === found.category && b.id !== found.id).slice(0, 4)
    : [];

  return (
    <div className="py-10">
      <p className="section-kicker">ISBN · Barcode · QR</p>
      <h1 className="section-title mt-2 text-4xl">Quét sách thông minh</h1>
      <p className="mt-3 max-w-2xl text-text-secondary">
        Quét mã vạch / ISBN / QR trên sách giấy để xem giá BookNest, tồn kho, review và gợi ý liên quan.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-[24px] p-5">
          <div className="relative overflow-hidden rounded-[20px] bg-black/40">
            <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#160726]/80">
                <ScanBarcode className="h-10 w-10 text-primary" />
                <p className="text-sm text-muted">Camera sẵn sàng quét EAN/ISBN/QR</p>
              </div>
            )}
            {scanning && (
              <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-highlight/80 shadow-[0_0_20px_#EC4899]" />
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {!scanning ? (
              <button type="button" onClick={startCamera} className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm">
                <Camera className="h-4 w-4" /> Bật camera
              </button>
            ) : (
              <button type="button" onClick={stopCamera} className="btn-secondary px-4 py-2.5 text-sm">
                Dừng quét
              </button>
            )}
          </div>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              lookup(isbn);
            }}
          >
            <input
              className="input-dark"
              placeholder="Nhập ISBN (vd: 9780735211292)"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
            />
            <button type="submit" className="btn-primary shrink-0 px-4 py-2 text-sm">
              <Search className="h-4 w-4" />
            </button>
          </form>
          {error && <p className="mt-2 text-xs text-highlight">{error}</p>}
        </div>

        <div className="glass rounded-[24px] p-5">
          {!found ? (
            <p className="text-sm text-muted">Kết quả quét sẽ hiện tại đây.</p>
          ) : (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Book found</p>
              <h2 className="section-title mt-1 text-2xl">{found.title}</h2>
              <p className="text-sm text-muted">
                {found.author} · ISBN {found.isbn}
              </p>
              <p className="mt-3 text-2xl font-bold text-white">{formatVND(found.salePrice)}</p>
              <p className="text-sm text-text-secondary">
                Tồn: {found.stock} · ★{found.rating} ({found.reviewCount} reviews)
              </p>
              <p className="mt-3 text-sm text-text-secondary">{found.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn-primary px-4 py-2 text-sm" onClick={() => add(found.id)}>
                  Thêm giỏ
                </button>
                <Link href={`/books/${found.slug}`} className="btn-secondary px-4 py-2 text-sm">
                  Chi tiết
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-10">
          <h3 className="section-title text-2xl">Related books</h3>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
