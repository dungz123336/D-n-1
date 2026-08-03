import type { Banner, BlogPost, Review } from "@/types";
export { authors } from "@/data/authors";

export const banners: Banner[] = [
  {
    id: "b1",
    title: "Siêu Sale Sách Hè 2026",
    subtitle: "Giảm đến 50% · Freeship đơn từ 200K · Quà tặng độc quyền",
    cta: "Mua ngay",
    href: "/search?sale=1",
    badge: "HOT",
    gradient: "from-[#FF6B6B] via-[#FF8E53] to-[#FFD93D]",
  },
  {
    id: "b2",
    title: "Góc Self-Help Bestseller",
    subtitle: "Thói quen · Tư duy · Hạnh phúc — chọn sách theo mục tiêu của bạn",
    cta: "Khám phá",
    href: "/category/self-help",
    badge: "TREND",
    gradient: "from-[#6C63FF] via-[#8B5CF6] to-[#38BDF8]",
  },
  {
    id: "b3",
    title: "AI & Công nghệ 2026",
    subtitle: "Sách mới về AI, lập trình, startup cho người làm sản phẩm",
    cta: "Xem bộ sưu tập",
    href: "/category/ai",
    badge: "NEW",
    gradient: "from-[#34D399] via-[#38BDF8] to-[#6C63FF]",
  },
];

export const blogPosts: BlogPost[] = [
  {
    id: "p1",
    title: "5 thói quen đọc sách giúp bạn đọc xong mỗi tuần 1 cuốn",
    slug: "5-thoi-quen-doc-sach",
    excerpt: "Từ time-blocking đến ghi chú Zettelkasten — lộ trình đơn giản cho người bận rộn.",
    category: "Mẹo đọc",
    coverGradient: "from-[#FF6B6B] to-[#FFD93D]",
    readTime: "6 phút",
    publishedAt: "2026-07-10",
  },
  {
    id: "p2",
    title: "Review: Thói quen nguyên tử có xứng đáng bestseller?",
    slug: "review-thoi-quen-nguyen-tu",
    excerpt: "Phân tích 4 quy luật thói quen và cách áp dụng thực tế tại Việt Nam.",
    category: "Review",
    coverGradient: "from-[#6C63FF] to-[#38BDF8]",
    readTime: "8 phút",
    publishedAt: "2026-07-08",
  },
  {
    id: "p3",
    title: "Chọn sách cho trẻ theo độ tuổi: checklist phụ huynh",
    slug: "chon-sach-cho-tre",
    excerpt: "Gợi ý thể loại và tiêu chí an toàn nội dung cho từng mốc 3–12 tuổi.",
    category: "Kiến thức",
    coverGradient: "from-[#34D399] to-[#FFD93D]",
    readTime: "5 phút",
    publishedAt: "2026-07-05",
  },
];

export const reviews: Review[] = [
  {
    id: "r1",
    bookId: 1,
    userName: "Minh Anh",
    rating: 5,
    comment: "Đọc xong áp dụng ngay được, layout đẹp, ship BookNest nhanh!",
    createdAt: "2026-07-12",
  },
  {
    id: "r2",
    bookId: 2,
    userName: "Hoàng Long",
    rating: 5,
    comment: "Kinh điển nhưng bản dịch mượt, đóng gói cẩn thận.",
    createdAt: "2026-07-11",
  },
  {
    id: "r3",
    bookId: 6,
    userName: "Bảo Châu",
    rating: 5,
    comment: "Con mình mê Harry Potter, quà sinh nhật hoàn hảo.",
    createdAt: "2026-07-09",
  },
];

export const popularKeywords = [
  "self-help",
  "harry potter",
  "tài chính",
  "ai",
  "doraemon",
  "tiếng anh",
  "nuôi dạy con",
  "startup",
];

export const flashSaleEndsAt = Date.now() + 1000 * 60 * 60 * 8; // 8h from first load (client will recompute)
