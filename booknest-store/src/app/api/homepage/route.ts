import { NextResponse } from "next/server";
import { books } from "@/data/books";
import { categories } from "@/data/categories";
import { authors, banners, blogPosts, reviews } from "@/data/content";

export async function GET() {
  return NextResponse.json({
    banners,
    categories,
    featured: books.filter((b) => b.featured),
    flashSale: books.filter((b) => b.flashSale),
    bestsellers: books.filter((b) => b.bestseller),
    newArrivals: books.filter((b) => b.newArrival),
    recommended: [...books].sort((a, b) => b.rating * b.sold - a.rating * a.sold).slice(0, 12),
    authors,
    blogPosts,
    reviews,
    promotions: [
      { code: "WELCOME10", type: "percent", value: 10 },
      { code: "BOOKNEST15", type: "percent", value: 15 },
      { code: "FREESHIP", type: "shipping", value: 0 },
    ],
  });
}
