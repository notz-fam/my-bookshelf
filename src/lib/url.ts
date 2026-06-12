import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import type { BookshelfData } from "@/features/bookshelf/types";

export function encodeBookshelfData(data: BookshelfData): string {
  try {
    const json = JSON.stringify(data);
    // lz-string compresses the JSON and emits URL-safe characters directly.
    // For Japanese text this is far shorter than encodeURIComponent + btoa,
    // which inflated every kanji to ~12 chars.
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
  // New format: lz-string compressed
  const decompressed = decompressFromEncodedURIComponent(encoded);
  if (decompressed) {
    const data = parseBookshelfJson(decompressed);
    if (data) return data;
  }

  // Legacy format: btoa(encodeURIComponent(json)) — keep old share links working
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
