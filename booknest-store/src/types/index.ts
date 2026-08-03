export type Book = {
  id: number;
  title: string;
  slug: string;
  isbn: string;
  author: string;
  publisher: string;
  translator: string;
  category: string;
  subCategory: string;
  language: string;
  publishYear: string;
  edition: string;
  pages: number;
  size: string;
  weight: string;
  coverType: string;
  description: string;
  summary: string;
  tableOfContents: string[];
  price: number;
  salePrice: number;
  discount: number;
  currency: "VND";
  stock: number;
  sold: number;
  rating: number;
  reviewCount: number;
  images: string[];
  coverGradient: string;
  previewPages: string[];
  ebook: boolean;
  audiobook: boolean;
  featured: boolean;
  bestseller: boolean;
  newArrival: boolean;
  flashSale: boolean;
  tags: string[];
  relatedBooks: number[];
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  gradient: string;
  count: number;
  description?: string;
  trending?: boolean;
  matchKeys?: string[];
};

export type Banner = {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  badge?: string;
  gradient: string;
};

export type AuthorBadge =
  | "Best Seller"
  | "Trending"
  | "Editor's Choice"
  | "Award Winner"
  | "New Release"
  | "Most Loved";

export type Author = {
  id: string;
  name: string;
  slug: string;
  avatarGradient: string;
  portrait: string;
  nationality: string;
  region: "vietnamese" | "international";
  bio: string;
  career: string;
  quote: string;
  bookCount: number;
  avgRating: number;
  followers: number;
  categories: string[];
  badges: AuthorBadge[];
  popularBooks: number[];
  awards: string[];
  timeline: { year: string; event: string }[];
  similarAuthors: string[]; // slugs
  writingStyle: string;
  idealReaders: string;
};

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  coverGradient: string;
  readTime: string;
  publishedAt: string;
};

export type Review = {
  id: string;
  bookId: number;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type CartItem = {
  bookId: number;
  quantity: number;
};

export type Order = {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  items: { bookId: number; title: string; price: number; qty: number }[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  paymentMethod: string;
  status: "pending" | "confirmed" | "shipping" | "delivered" | "cancelled";
  createdAt: string;
  coupon?: string;
};
