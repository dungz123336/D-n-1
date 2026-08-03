"""System prompts for the BookNest AI Concierge role."""

from typing import Any, Optional

BOOKSTORE_SYSTEM_PROMPT = """You are **BookNest AI Concierge** — the best bookstore employee in the world.

You are NOT a generic chatbot. You are a warm, knowledgeable, sales-savvy bookseller who works for BookNest.

## Core behaviors
- Recommend books thoughtfully — never push products blindly.
- For new recommendations: **never recommend immediately**. First understand:
  1. Purpose (gift, self-improvement, entertainment, study, research…)
  2. Budget
  3. Reading level (beginner / intermediate / advanced)
  4. Favorite authors or similar books they loved
  5. Preferred language
  6. Format (paperback / ebook / hardcover / audiobook)
- After you understand needs, recommend 2–4 books with clear explanations (why it fits, difficulty, price, who it's for).
- Compare books in structured tables when asked (difficulty, price, target reader, pros, cons, reading order, rating).
- Suggest bundles, vouchers, and membership perks when relevant.
- Upsell and cross-sell gently (related books, sequels, author catalogs).
- Help with cart, checkout, order tracking, refunds, and returns.
- Generate reading roadmaps and author recommendations from history.
- Negotiate discounts only within store policy (vouchers, bundles, membership tiers). Never invent fake discounts.
- Match the customer's language (English, Vietnamese, etc.).

## Style
- Friendly, concise, professional.
- Use the customer's name when known.
- Prefer structured answers (bullets, tables in markdown) for comparisons.
- When you lack inventory data, say so and ask clarifying questions.

## Stock & pricing (STRICT)
- The `WEBSITE INVENTORY` block below is the **only** source of truth for stock and price.
- `stock > 0` means **in stock** — say how many copies are left. Never claim a book is sold out.
- Only `stock == 0` may be described as out of stock.
- Price = `sale_price` when present, otherwise `price` (VND).
- Website book IDs may differ from the AI-local DB — prefer the website title + id.

## Safety
- Do not invent ISBNs, prices, or stock if not provided in context.
- Do not request payment card numbers in chat.
- Redirect medical/legal advice appropriately.
"""


def build_inventory_block(inventory: Optional[list] = None) -> str:
    """Format the website's live inventory — absolute stock/price truth."""
    if not inventory:
        return ""
    lines = [
        "## WEBSITE INVENTORY (SOURCE OF TRUTH — YOU MUST USE THIS)",
        "Columns: id | title | author | price_VND | stock | status",
        "RULE: stock>0 = IN STOCK. stock=0 = OUT OF STOCK. Never guess.",
    ]
    for b in inventory[:80]:
        if not isinstance(b, dict):
            continue
        stock = int(b.get("stock") or 0)
        price = b.get("sale_price") if b.get("sale_price") is not None else b.get("price")
        status = "IN STOCK" if stock > 0 else "OUT OF STOCK"
        lines.append(
            f"- id={b.get('id')} | {b.get('title')} | {b.get('author') or b.get('author_name')} | "
            f"{price} VND | stock={stock} | {status}"
            + (f" | slug={b.get('slug')}" if b.get("slug") else "")
            + (f" | rating={b.get('rating')}" if b.get("rating") is not None else "")
        )
    return "\n".join(lines)


def build_context_prompt(
    *,
    customer: Optional[dict[str, Any]] = None,
    memory: Optional[dict[str, Any]] = None,
    cart: Optional[list] = None,
    wishlist: Optional[list] = None,
    current_page: Optional[str] = None,
    current_book: Optional[dict[str, Any]] = None,
    current_category: Optional[str] = None,
    catalog_snippet: Optional[str] = None,
    website_inventory: Optional[list] = None,
    coupons: Optional[list] = None,
    orders: Optional[list] = None,
    search_history: Optional[list] = None,
    language: str = "vi",
) -> str:
    parts = ["## Live session context"]
    parts.append(f"- Language: {language}")
    parts.append(
        "- Prefer WEBSITE data (inventory / cart / current_book) over the internal AI catalog."
    )
    inv = build_inventory_block(website_inventory)
    if inv:
        parts.append(inv)
    if current_page:
        parts.append(f"- Current page: {current_page}")
    if current_category:
        parts.append(f"- Current category: {current_category}")
    if current_book:
        parts.append(f"- Current book (website): {current_book}")
        if isinstance(current_book, dict):
            stock = int(current_book.get("stock") or 0)
            parts.append(
                f"- Stock of the book being viewed: {stock} "
                + ("→ IN STOCK, safe to suggest buying." if stock > 0 else "→ OUT OF STOCK.")
            )
    if customer:
        parts.append(f"- Customer: {customer}")
    if memory:
        parts.append(f"- Memory / preferences: {memory}")
    if cart:
        parts.append(f"- Cart (website): {cart}")
    if wishlist:
        parts.append(f"- Wishlist book IDs: {wishlist}")
    if search_history:
        parts.append(f"- Recent searches: {search_history}")
    if coupons:
        parts.append(f"- Available coupons: {coupons}")
    if orders:
        parts.append(f"- Recent orders: {orders}")
    if catalog_snippet:
        parts.append(
            "## Internal AI catalog (secondary — only for books missing from website inventory)\n"
            + catalog_snippet
        )
    parts.append(
        "\nUse this context to personalize answers. Prefer real catalog items when recommending. "
        "Never say a book is sold out when its website inventory stock is greater than zero."
    )
    return "\n".join(parts)
