"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Star, Users, Search } from "lucide-react";
import { AUTHOR_FILTERS, authors, authorMatchesFilter } from "@/data/authors";
import { SmartImage } from "@/components/media/SmartImage";
import { cn } from "@/lib/utils";
import { useMemory } from "@/store/memory";

export default function AuthorsPage() {
  const [filter, setFilter] = useState<(typeof AUTHOR_FILTERS)[number]>("All");
  const [q, setQ] = useState("");
  const searches = useMemory((s) => s.searches);

  const list = useMemo(() => {
    return authors.filter((a) => {
      if (!authorMatchesFilter(a, filter)) return false;
      if (!q.trim()) return true;
      const n = q.toLowerCase();
      return (
        a.name.toLowerCase().includes(n) ||
        a.nationality.toLowerCase().includes(n) ||
        a.categories.some((c) => c.toLowerCase().includes(n)) ||
        a.bio.toLowerCase().includes(n)
      );
    });
  }, [filter, q]);

  const mostSearched = useMemo(() => {
    const scores = new Map<string, number>();
    for (const a of authors) scores.set(a.slug, 0);
    for (const s of searches) {
      const t = (s.q || "").toLowerCase();
      for (const a of authors) {
        if (t.includes(a.name.toLowerCase()) || t.includes(a.slug.replace(/-/g, " "))) {
          scores.set(a.slug, (scores.get(a.slug) || 0) + 2);
        }
        if (a.categories.some((c) => t.includes(c.toLowerCase().split(" ")[0]))) {
          scores.set(a.slug, (scores.get(a.slug) || 0) + 0.2);
        }
      }
    }
    // fallback by followers when no search history
    return [...authors]
      .sort((a, b) => (scores.get(b.slug) || 0) - (scores.get(a.slug) || 0) || b.followers - a.followers)
      .slice(0, 10);
  }, [searches]);

  const boards = {
    best: [...authors].sort((a, b) => b.followers - a.followers).slice(0, 10),
    searched: mostSearched,
    trending: authors.filter((a) => a.badges.includes("Trending")),
    loved: authors.filter((a) => a.badges.includes("Most Loved")),
    newer: authors.filter((a) => a.badges.includes("New Release")),
  };

  return (
    <div className="py-10">
      <p className="section-kicker">Authors</p>
      <h1 className="section-title mt-2 text-4xl sm:text-5xl">Featured Authors</h1>
      <p className="mt-3 max-w-2xl text-text-secondary">
        Vietnamese & international voices · follow · bibliography · AI similar authors · badges
        editorial.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            className="admin-input w-full pl-10"
            placeholder="Tìm tác giả, quốc tịch, thể loại…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Tìm tác giả"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Lọc tác giả">
        {AUTHOR_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              filter === f
                ? "border-primary bg-primary/20 text-primary"
                : "border-white/10 bg-white/5 text-muted hover:border-primary/30"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Top 10 Best Selling", boards.best],
          ["Most Searched", boards.searched],
          ["Trending This Week", boards.trending],
          ["Readers' Favorite", boards.loved],
          ["New Authors", boards.newer],
        ].map(([title, arr]) => (
          <div key={title as string} className="glass rounded-[20px] p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">{title as string}</p>
            <ul className="mt-2 space-y-1 text-sm text-text-secondary">
              {(arr as typeof authors).slice(0, 5).map((a, i) => (
                <li key={a.id}>
                  <Link href={`/authors/${a.slug}`} className="hover:text-primary">
                    <span className="mr-1 text-muted">{i + 1}.</span>
                    {a.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-8 text-sm text-muted">
        {list.length} tác giả
        {filter !== "All" ? ` · ${filter}` : ""}
        {q ? ` · “${q}”` : ""}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.map((a) => (
          <Link
            key={a.id}
            href={`/authors/${a.slug}`}
            className="glass group overflow-hidden rounded-[24px] transition hover:-translate-y-1 hover:border-primary/40"
          >
            <div className="relative h-44">
              <SmartImage
                src={a.portrait}
                alt={a.name}
                fallbackGradient={a.avatarGradient}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#160726] to-transparent" />
              <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
                {a.badges.slice(0, 2).map((b) => (
                  <span
                    key={b}
                    className="rounded-full bg-primary/25 px-2 py-0.5 text-[10px] font-bold text-primary"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
            <div className="p-4">
              <h2 className="text-lg font-bold text-white group-hover:text-primary">{a.name}</h2>
              <p className="text-xs text-primary">{a.nationality}</p>
              <p className="mt-2 line-clamp-2 text-sm text-text-secondary">{a.bio}</p>
              <div className="mt-3 flex gap-3 text-xs text-muted">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-primary text-primary" /> {a.avgRating}
                </span>
                <span>{a.bookCount} books</span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {(a.followers / 1000).toFixed(0)}k
                </span>
              </div>
              <p className="mt-2 text-[11px] text-muted">{a.categories.join(" · ")}</p>
            </div>
          </Link>
        ))}
      </div>

      {list.length === 0 && (
        <p className="mt-10 text-center text-muted">Không có tác giả khớp bộ lọc. Thử filter khác.</p>
      )}
    </div>
  );
}
