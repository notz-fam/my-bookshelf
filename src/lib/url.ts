import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import type { Book, BookshelfData, DisplayStyle } from "@/features/bookshelf/types";

// --- Compact share format (v2) ---
// The whole bookshelf travels inside the share URL, so per-book bytes matter.
// The biggest hogs are `amazonUrl` (a long pasted Amazon URL) and `coverUrl`,
// both of which can be regenerated from the 10-char ASIN. We therefore strip
// everything derivable and use single-letter keys + omit default values.
//
// Keys: n=name g=category(genre) w=author(writer) f=finish a=asin
//       u=amazonUrl(non-Amazon only) c=coverUrl(custom only) d=display
interface CompactBook {
  n: string;
  g?: string;
  w?: string;
  f?: 1;
  a?: string;
  u?: string;
  c?: string;
  d?: DisplayStyle;
}

interface CompactData {
  v: 2;
  n: string;
  b: CompactBook[];
  h?: string[];
}

function toCompactBook(book: Book): CompactBook {
  const asin = book.amazonUrl ? extractAsinFromUrl(book.amazonUrl) : null;
  const out: CompactBook = { n: book.name };

  if (book.category) out.g = book.category;
  if (book.author) out.w = book.author;
  if (book.finish) out.f = 1;
  if (book.display && book.display !== "normal") out.d = book.display;

  if (asin) {
    // Reconstruct amazonUrl from the ASIN on decode
    out.a = asin;
    // Drop the cover only when it's the standard Amazon cover for this ASIN
    if (book.coverUrl && book.coverUrl !== getAmazonCoverUrl(asin)) {
      out.c = book.coverUrl;
    }
  } else {
    // Non-Amazon link: keep the raw URL (can't be derived)
    if (book.amazonUrl) out.u = book.amazonUrl;
    if (book.coverUrl) out.c = book.coverUrl;
  }

  return out;
}

function fromCompactBook(b: CompactBook, id: number): Book {
  const book: Book = {
    id,
    name: b.n,
    category: b.g ?? null,
    finish: b.f === 1,
  };
  if (b.w) book.author = b.w;
  if (b.d) book.display = b.d;

  if (b.a) {
    book.amazonUrl = `https://www.amazon.co.jp/dp/${b.a}`;
    book.coverUrl = b.c ?? getAmazonCoverUrl(b.a);
  } else {
    if (b.u) book.amazonUrl = b.u;
    if (b.c) book.coverUrl = b.c;
  }

  return book;
}

function toCompact(data: BookshelfData): CompactData {
  const compact: CompactData = {
    v: 2,
    n: data.name,
    b: data.books.map(toCompactBook),
  };
  if (data.hiddenAuthors && data.hiddenAuthors.length > 0) {
    compact.h = data.hiddenAuthors;
  }
  return compact;
}

function fromCompact(c: CompactData): BookshelfData | null {
  if (!Array.isArray(c.b)) return null;
  return {
    name: c.n,
    // ids are not stored; reassign them sequentially on load
    books: c.b.map((b, i) => fromCompactBook(b, i + 1)),
    hiddenAuthors: c.h ?? [],
  };
}

export function encodeBookshelfData(data: BookshelfData): string {
  try {
    // lz-string compresses the JSON and emits URL-safe characters directly.
    // For Japanese text this is far shorter than encodeURIComponent + btoa,
    // which inflated every kanji to ~12 chars. We compact the data first so
    // large bookshelves stay under the URL/shortener length limits.
    const json = JSON.stringify(toCompact(data));
    return compressToEncodedURIComponent(json);
  } catch {
    return "";
  }
}

function parseBookshelfJson(json: string): BookshelfData | null {
  try {
    const parsed = JSON.parse(json) as BookshelfData;
    if (!parsed.name || !Array.isArray(parsed.books)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function decodeBookshelfData(encoded: string): BookshelfData | null {
  // Current format: lz-string compressed
  const decompressed = decompressFromEncodedURIComponent(encoded);
  if (decompressed) {
    try {
      const parsed = JSON.parse(decompressed) as CompactData | BookshelfData;
      // v2: compact form (single-letter keys, derivable fields stripped)
      if ((parsed as CompactData).v === 2) {
        const data = fromCompact(parsed as CompactData);
        if (data) return data;
      }
    } catch {
      // fall through to legacy lz-string (full BookshelfData JSON)
    }
    const legacy = parseBookshelfJson(decompressed);
    if (legacy) return legacy;
  }

  // Oldest format: btoa(encodeURIComponent(json)) — keep old share links working
  try {
    return parseBookshelfJson(decodeURIComponent(atob(encoded)));
  } catch {
    return null;
  }
}

export function extractAsinFromUrl(url: string): string | null {
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/exec\/obidos\/ASIN\/([A-Z0-9]{10})/i,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1].toUpperCase();
  }
  return null;
}

export function getAmazonCoverUrl(asin: string): string {
  return `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.LZZZZZZZ.jpg`;
}
