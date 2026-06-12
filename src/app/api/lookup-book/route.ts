import { NextRequest, NextResponse } from "next/server";
import { extractAsinFromUrl, getAmazonCoverUrl } from "@/lib/url";
import type { BookLookupResult } from "@/lib/book-lookup";

export type { BookLookupResult };

function parseGoogleBooksItem(item: Record<string, unknown>): BookLookupResult {
  const info = (item.volumeInfo ?? {}) as Record<string, unknown>;
  const imageLinks = (info.imageLinks ?? {}) as Record<string, string>;
  const coverUrl =
    (imageLinks.thumbnail ?? imageLinks.smallThumbnail ?? null)
      ?.replace("http:", "https:")
      .replace("&zoom=1", "&zoom=3") ?? null;
  const categories = info.categories as string[] | undefined;
  const authors = info.authors as string[] | undefined;
  return {
    title: (info.title as string) ?? null,
    author: authors?.[0] ?? null,
    category: categories?.[0] ?? null,
    coverUrl,
  };
}

// Google Books API — search by ISBN/ASIN
async function lookupGoogleBooks(isbn: string): Promise<BookLookupResult | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.items?.length) return null;
    return parseGoogleBooksItem(data.items[0]);
  } catch {
    return null;
  }
}

// Google Books API — search by title (for Kindle ASINs that are not ISBNs)
async function searchGoogleBooksByTitle(title: string): Promise<BookLookupResult | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(title)}&maxResults=1`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.items?.length) return null;
    return parseGoogleBooksItem(data.items[0]);
  } catch {
    return null;
  }
}

// Open Library API
async function lookupOpenLibrary(isbn: string): Promise<BookLookupResult | null> {
  try {
    const res = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const entry = data[`ISBN:${isbn}`] as Record<string, unknown> | undefined;
    if (!entry) return null;

    const cover = entry.cover as Record<string, string> | undefined;
    const identifiers = entry.identifiers as Record<string, string[]> | undefined;
    const coverUrl =
      cover?.large ??
      cover?.medium ??
      (identifiers?.isbn_13?.[0]
        ? `https://covers.openlibrary.org/b/isbn/${identifiers.isbn_13[0]}-L.jpg`
        : null) ??
      null;

    type Subject = string | { name?: string };
    const subjects = (entry.subjects ?? []) as Subject[];
    const first = subjects[0];
    const category =
      subjects.length > 0
        ? typeof first === "string"
          ? first
          : first.name ?? null
        : null;

    const authors = (entry.authors ?? []) as { name?: string }[];

    return {
      title: (entry.title as string) ?? null,
      author: authors[0]?.name ?? null,
      category,
      coverUrl,
    };
  } catch {
    return null;
  }
}

// Amazon product page scraping (best-effort)
async function scrapeAmazonPage(amazonUrl: string): Promise<BookLookupResult | null> {
  try {
    const res = await fetch(amazonUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) return null;

    const html = await res.text();
    // Note: plain product pages also contain the word "robot" (meta robots tag),
    // so only treat the page as blocked when the captcha form is present
    if (html.includes("validateCaptcha")) return null;

    const titleMatch = html.match(/id="productTitle"[^>]*>\s*([\s\S]*?)\s*<\/span>/);
    const rawTitle = titleMatch?.[1]?.replace(/<[^>]+>/g, "").trim() ?? null;
    if (!rawTitle || rawTitle.length < 2) return null;

    // Breadcrumbs look like 本 > 科学・テクノロジー > 電気・通信;
    // skip the generic store names and take the first real category
    const GENERIC_CRUMBS = new Set(["本", "洋書", "Kindleストア", "Kindle本", "Books"]);
    const crumbBlock = html.match(/wayfinding-breadcrumbs[\s\S]{0,5000}?<\/ul>/);
    const crumbs = crumbBlock
      ? [...crumbBlock[0].matchAll(/<a[^>]*>\s*([\s\S]*?)\s*<\/a>/g)]
          .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
          .filter((t) => t.length >= 2 && t.length <= 40 && !GENERIC_CRUMBS.has(t))
      : [];
    const category = crumbs[0] ?? null;

    // Byline area holds the author link(s); take the first one
    const bylineBlock = html.match(/id="bylineInfo"[\s\S]{0,3000}?<\/div>/);
    const authorMatch = bylineBlock?.[0].match(/<a[^>]*>\s*([\s\S]*?)\s*<\/a>/);
    const author =
      authorMatch?.[1]
        ?.replace(/<[^>]+>/g, "")
        .trim()
        .slice(0, 50) || null;

    // Try to extract cover image URL from Amazon page HTML
    let coverUrl: string | null = null;
    const hiResMatch = html.match(/"hiRes"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/);
    if (hiResMatch) {
      coverUrl = hiResMatch[1];
    } else {
      const oldHiresMatch = html.match(/data-old-hires="(https:\/\/[^"]+\.jpg[^"]*)"/);
      if (oldHiresMatch) coverUrl = oldHiresMatch[1];
    }

    return { title: rawTitle, author, category, coverUrl };
  } catch {
    return null;
  }
}

// Extract title from Amazon URL slug (works without any network request)
function extractTitleFromAmazonUrl(amazonUrl: string): string | null {
  try {
    const url = new URL(amazonUrl);
    const parts = url.pathname.split("/");
    const dpIndex = parts.indexOf("dp");
    if (dpIndex < 1) return null;
    const slug = decodeURIComponent(parts[dpIndex - 1]);
    // Slug format: "タイトル-著者名-ebook" or "Title-Author"
    const title = slug.split("-")[0];
    return title && title.length > 1 ? title : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const amazonUrl = request.nextUrl.searchParams.get("url");
  if (!amazonUrl) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  const asin = extractAsinFromUrl(amazonUrl);
  if (!asin) {
    return NextResponse.json({ error: "Invalid Amazon URL" }, { status: 400 });
  }

  // For numeric ASINs (≈ISBN-10): try ISBN lookups first
  // For B0... Kindle ASINs: skip ISBN lookups (they always fail)
  const isIsbn = /^\d/.test(asin);

  let result: BookLookupResult | null = null;

  if (isIsbn) {
    result = (await lookupGoogleBooks(asin)) ?? (await lookupOpenLibrary(asin));
  }

  // Scrape Amazon page and merge: fills whatever the ISBN lookups missed
  if (!result?.title || !result.category || !result.author) {
    const scraped = await scrapeAmazonPage(amazonUrl);
    if (scraped) {
      result = {
        title: result?.title ?? scraped.title,
        author: result?.author ?? scraped.author,
        category: result?.category ?? scraped.category,
        coverUrl: result?.coverUrl ?? scraped.coverUrl,
      };
    }
  }

  // Fallback: search Google Books by title from URL slug,
  // and as a last resort use the slug itself as the title
  if (!result?.title) {
    const slugTitle = extractTitleFromAmazonUrl(amazonUrl);
    if (slugTitle) {
      result =
        (await searchGoogleBooksByTitle(slugTitle)) ?? {
          title: slugTitle,
          author: null,
          category: null,
          coverUrl: null,
        };
    }
  }

  if (!result?.title) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  // Ensure cover URL is always set: use API result, else Amazon CDN URL
  const coverUrl = result.coverUrl ?? getAmazonCoverUrl(asin);

  return NextResponse.json({ ...result, coverUrl });
}
