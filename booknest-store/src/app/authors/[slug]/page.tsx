"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, BookOpen, Quote, Sparkles, Star, Users } from "lucide-react";
import { getAuthorBySlug, recommendAuthorsLike } from "@/data/authors";
import { useCatalog } from "@/store/catalog";
import { useAuthorsFollow } from "@/store/authorsFollow";
import { BookCard } from "@/components/books/BookCard";
import { SmartImage } from "@/components/media/SmartImage";
import { formatVND } from "@/lib/utils";

export default function AuthorProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const author = getAuthorBySlug(slug);
  const books = useCatalog((s) => s.books);
  const { toggle, isFollowing } = useAuthorsFollow();
  const [year, setYear] = useState<string>("All");

  const authorBooks = useMemo(() => {
    if (!author) return [];
    const byId = author.popularBooks.map((id) => books.find((b) => b.id === id)).filter(Boolean);
    const last = author.name.toLowerCase().split(" ").slice(-1)[0];
    const byName = books.filter(
      (b) =>
        b.author.toLowerCase().includes(author.name.toLowerCase()) ||
        (last.length > 2 && b.author.toLowerCase().includes(last))
    );
    const merged = [...byId, ...byName].filter(
      (b, i, arr) => b && arr.findIndex((x) => x!.id === b!.id) === i
    ) as typeof books;
    return merged;
  }, [author, books]);

  const years = useMemo(() => {
    const ys = [...new Set(authorBooks.map((b) => String(b.publishYear)))].sort();
    return ys;
  }, [authorBooks]);

  const filteredBooks = useMemo(() => {
    if (year === "All") return authorBooks;
    return authorBooks.filter((b) => String(b.publishYear) === year);
  }, [authorBooks, year]);

  const similar = author ? recommendAuthorsLike(author.slug, 6) : [];
  const recs = similar;

  if (!author) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted">Không tìm thấy tác giả.</p>
        <Link href="/authors" className="btn-primary mt-4 inline-flex px-5 py-2.5 text-sm">
          Về danh sách
        </Link>
      </div>
    );
  }

  const following = isFollowing(author.slug);
  const newest = [...authorBooks].sort((a, b) =>
    String(b.publishYear).localeCompare(String(a.publishYear))
  );
  const popular = [...authorBooks].sort((a, b) => b.sold - a.sold);
  const popPct = Math.min(100, Math.round(author.followers / 5000));

  return (
    <div className="py-10">
      <nav className="mb-6 text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>
        {" / "}
        <Link href="/authors" className="hover:text-primary">
          Authors
        </Link>
        {" / "}
        <span className="text-white">{author.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="glass h-fit rounded-[24px] p-5 lg:sticky lg:top-28">
          <SmartImage
            src={author.portrait}
            alt={author.name}
            fallbackGradient={author.avatarGradient}
            className="aspect-square w-full rounded-[20px] object-cover"
          />
          <h1 className="section-title mt-4 text-2xl">{author.name}</h1>
          <p className="text-sm text-primary">{author.nationality}</p>
          <div className="mt-3 flex flex-wrap gap-1">
            {author.badges.map((b) => (
              <span
                key={b}
                className="rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary"
              >
                {b}
              </span>
            ))}
          </div>
          <div className="mt-4 space-y-1 text-sm text-muted">
            <p className="inline-flex items-center gap-1">
              <Star className="h-4 w-4 fill-primary text-primary" /> {author.avgRating} avg
            </p>
            <p className="inline-flex items-center gap-1">
              <BookOpen className="h-4 w-4" /> {author.bookCount} books
            </p>
            <p className="inline-flex items-center gap-1">
              <Users className="h-4 w-4" /> {author.followers.toLocaleString("vi-VN")} followers
            </p>
          </div>
          <p className="mt-3 text-[11px] text-muted">{author.categories.join(" · ")}</p>
          <button
            type="button"
            onClick={() => toggle(author.slug)}
            className={`mt-5 w-full py-2.5 text-sm ${following ? "btn-secondary" : "btn-primary"}`}
          >
            {following ? (
              <span className="inline-flex items-center gap-2">
                <Bell className="h-4 w-4" /> Following · notify new books
              </span>
            ) : (
              "Follow author"
            )}
          </button>
          <Link
            href={`/search?q=${encodeURIComponent(author.name)}`}
            className="btn-secondary mt-2 flex w-full justify-center py-2.5 text-sm"
          >
            Full bibliography
          </Link>
          <button
            type="button"
            className="mt-2 w-full rounded-full border border-primary/30 bg-primary/10 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/20"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("booknest-open-chat", {
                  detail: { prefill: `Tôi thích ${author.name}. Gợi ý sách và tác giả tương tự.` },
                })
              )
            }
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4" /> AI Author Assistant
            </span>
          </button>
        </aside>

        <div className="space-y-8">
          <section className="glass rounded-[24px] p-6">
            <h2 className="section-title text-xl">Biography</h2>
            <p className="mt-3 text-text-secondary leading-relaxed">{author.bio}</p>
            <h3 className="mt-5 font-bold text-white">Writing career</h3>
            <p className="mt-2 text-sm text-text-secondary">{author.career}</p>
            <h3 className="mt-5 font-bold text-white">Writing style</h3>
            <p className="mt-2 text-sm text-text-secondary">{author.writingStyle}</p>
            <h3 className="mt-5 font-bold text-white">Who should read</h3>
            <p className="mt-2 text-sm text-text-secondary">{author.idealReaders}</p>
          </section>

          <section className="glass rounded-[24px] p-6">
            <div className="flex items-start gap-3">
              <Quote className="h-6 w-6 shrink-0 text-primary" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Favorite quote</p>
                <p className="mt-2 font-serif text-lg italic leading-relaxed text-white">
                  &ldquo;{author.quote}&rdquo;
                </p>
              </div>
            </div>
          </section>

          <section className="glass rounded-[24px] p-6">
            <h2 className="section-title text-xl">Awards</h2>
            <ul className="mt-3 list-inside list-disc text-sm text-text-secondary">
              {author.awards.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </section>

          <section className="glass rounded-[24px] p-6">
            <h2 className="section-title text-xl">Timeline</h2>
            <ol className="mt-4 space-y-3">
              {author.timeline.map((t) => (
                <li key={t.year + t.event} className="flex gap-4 border-l border-primary/40 pl-4">
                  <span className="font-bold text-primary">{t.year}</span>
                  <span className="text-text-secondary">{t.event}</span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="section-title text-2xl">Books by year</h2>
                <p className="text-sm text-muted">Browse bibliography by publication year</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setYear("All")}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    year === "All"
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-white/10 text-muted"
                  }`}
                >
                  All
                </button>
                {years.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setYear(y)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      year === y
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-white/10 text-muted"
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {filteredBooks.map((b) => (
                <BookCard key={b.id} book={b} />
              ))}
              {filteredBooks.length === 0 && (
                <p className="col-span-full text-sm text-muted">
                  Chưa có sách trên kệ cho năm này.{" "}
                  <Link href={`/search?q=${encodeURIComponent(author.name)}`} className="text-primary">
                    Tìm bibliography
                  </Link>
                </p>
              )}
            </div>
          </section>

          <section>
            <h2 className="section-title text-2xl">Most popular books</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
              {popular.slice(0, 6).map((b) => (
                <BookCard key={`p-${b.id}`} book={b} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="section-title text-2xl">Newest books</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
              {newest.slice(0, 6).map((b) => (
                <BookCard key={`n-${b.id}`} book={b} />
              ))}
            </div>
          </section>

          <section className="glass rounded-[24px] p-6">
            <h2 className="section-title text-xl">Author statistics</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Followers", author.followers.toLocaleString("vi-VN")],
                ["Avg rating", String(author.avgRating)],
                ["Books", String(author.bookCount)],
                ["Popularity", `${Math.min(99, Math.round(author.followers / 3000))}%`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-white/5 p-3 text-center">
                  <p className="text-xs text-muted">{k}</p>
                  <p className="mt-1 text-lg font-bold text-white">{v}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted">
              Reading popularity chart
            </p>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-highlight transition-all duration-700"
                style={{ width: `${popPct}%` }}
              />
            </div>
            <div className="mt-4 grid grid-cols-6 gap-1 sm:grid-cols-12">
              {Array.from({ length: 12 }).map((_, i) => {
                const h = 20 + ((author.followers + i * 997) % 70);
                return (
                  <div
                    key={i}
                    className="rounded-t-md bg-gradient-to-t from-primary/40 to-highlight/80"
                    style={{ height: h }}
                    title={`T${i + 1}`}
                  />
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted">Chỉ số độ phổ biến đọc theo tháng (demo editorial)</p>
          </section>

          <section className="glass rounded-[24px] p-6">
            <h2 className="section-title text-xl">Reader reviews</h2>
            <div className="mt-3 space-y-3 text-sm text-text-secondary">
              <p className="rounded-2xl bg-white/5 p-3">
                “Phong cách {author.writingStyle.toLowerCase()} — rất đáng theo dõi.” — BookNest Reader
                · ★★★★★
              </p>
              <p className="rounded-2xl bg-white/5 p-3">
                “Nên bắt đầu với đầu sách phổ biến nhất trên kệ.” — Editorial · ★★★★☆
              </p>
              <p className="rounded-2xl bg-white/5 p-3">
                “Phù hợp {author.idealReaders.toLowerCase()}.” — Verified buyer · ★★★★★
              </p>
            </div>
          </section>

          {recs.length > 0 && (
            <section>
              <h2 className="section-title text-2xl">Similar authors · AI</h2>
              <p className="mt-1 text-sm text-muted">
                Nếu bạn thích {author.name}, AI gợi ý cùng writing style & thể loại.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recs.map((a) => (
                  <Link
                    key={a.id}
                    href={`/authors/${a.slug}`}
                    className="glass flex items-center gap-3 rounded-[20px] p-3 transition hover:border-primary/40"
                  >
                    <SmartImage
                      src={a.portrait}
                      alt={a.name}
                      fallbackGradient={a.avatarGradient}
                      className="h-14 w-14 shrink-0 rounded-full object-cover"
                    />
                    <div>
                      <p className="font-bold text-white">{a.name}</p>
                      <p className="text-xs text-muted">{a.categories.join(" · ")}</p>
                      <p className="line-clamp-1 text-[11px] text-text-secondary">{a.writingStyle}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="glass rounded-[24px] p-5">
            <h2 className="section-title text-xl">AI reading recommendations</h2>
            <ul className="mt-3 space-y-2 text-sm text-text-secondary">
              <li>
                <strong className="text-white">Beginner:</strong>{" "}
                {popular[0]?.title || "Sách phổ biến nhất"} — mở đầu dễ tiếp cận.
              </li>
              <li>
                <strong className="text-white">Advanced:</strong>{" "}
                {popular[1]?.title || recs[0]?.name || "Tác giả tương tự"} — đào sâu hơn.
              </li>
              <li>
                <strong className="text-white">Frequently together:</strong> kết hợp self-help / business
                cùng kệ với {recs[0]?.name || "tác giả tương tự"}.
              </li>
              <li>
                <strong className="text-white">Giá tham chiếu:</strong>{" "}
                {authorBooks[0] ? formatVND(authorBooks[0].salePrice) : "—"}.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
