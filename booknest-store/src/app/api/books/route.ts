import { NextResponse } from "next/server";
import { books, searchBooks } from "@/data/books";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const featured = searchParams.get("featured");
  const bestseller = searchParams.get("bestseller");
  const flash = searchParams.get("flash");
  const limit = Number(searchParams.get("limit") || 50);

  let list = q ? searchBooks(q) : [...books];
  if (featured === "1") list = list.filter((b) => b.featured);
  if (bestseller === "1") list = list.filter((b) => b.bestseller);
  if (flash === "1") list = list.filter((b) => b.flashSale);

  return NextResponse.json({
    data: list.slice(0, limit),
    meta: { total: list.length, source: "booknest-demo-api" },
  });
}
