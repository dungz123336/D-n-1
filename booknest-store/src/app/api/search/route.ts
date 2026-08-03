import { NextResponse } from "next/server";
import { searchBooks } from "@/data/books";
import { popularKeywords } from "@/data/content";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") || "";
  const results = searchBooks(q).slice(0, 20);
  return NextResponse.json({
    query: q,
    results,
    popularKeywords,
    aiSuggestions: results.slice(0, 3).map((b) => b.title),
  });
}
