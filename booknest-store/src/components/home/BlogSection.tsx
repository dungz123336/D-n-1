import { blogPosts } from "@/data/content";
import { cn } from "@/lib/utils";

export function BlogSection() {
  return (
    <section className="pt-20">
      <div className="mb-10">
        <p className="section-kicker">Journal</p>
        <h2 className="section-title mt-2 text-3xl sm:text-4xl">Góc biên tập</h2>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {blogPosts.map((p) => (
          <article
            key={p.id}
            className="glass group overflow-hidden rounded-[24px] transition duration-300 hover:-translate-y-1 hover:border-primary/30"
          >
            <div className={cn("h-40 bg-gradient-to-br opacity-90", p.coverGradient)} />
            <div className="p-6">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <span className="rounded-full border border-primary/30 bg-primary/15 px-2.5 py-0.5 text-primary">
                  {p.category}
                </span>
                <span>{p.readTime}</span>
              </div>
              <h3 className="section-title text-lg leading-snug transition group-hover:text-primary">
                {p.title}
              </h3>
              <p className="mt-2 line-clamp-2 text-sm text-text-secondary">{p.excerpt}</p>
              <p className="mt-5 text-xs text-muted">{p.publishedAt}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
