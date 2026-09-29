import type { Book, DisplayStyle } from "./types";

// 本棚の並べ方と本の見た目を決める純粋なロジック。
// 画面（Bookshelf / BookItem）と OGP 画像（/api/og）で同じ本棚になるように共有する。

// ---------- 本 ----------

/** 背表紙の色数（globals.css の --spine-1..N） */
export const SPINE_COLOR_COUNT = 12;

const SPINE_WIDTHS = [34, 40, 46, 52];
const SPINE_HEIGHTS = [152, 165, 178, 191, 204];
export const FACE_OUT_WIDTH = 112;
export const FACE_OUT_HEIGHT = 158;

// 本のIDから決定的に見た目（色・サイズ・装飾）を決めるためのハッシュ
function hash(id: number, salt: number): number {
  let h = Math.imul(id + 1, 2654435761) + Math.imul(salt + 1, 40503);
  h ^= h >>> 13;
  h = Math.imul(h, 1597334677);
  h ^= h >>> 16;
  return h >>> 0;
}

export function getBookDisplay(book: Book): DisplayStyle {
  return book.display ?? "normal";
}

export function getBookWidth(book: Book): number {
  if (getBookDisplay(book) === "face-out") return FACE_OUT_WIDTH;
  return SPINE_WIDTHS[hash(book.id, 1) % SPINE_WIDTHS.length];
}

export function getSpineHeight(book: Book): number {
  return SPINE_HEIGHTS[hash(book.id, 2) % SPINE_HEIGHTS.length];
}

/** 背表紙の色番号（1..SPINE_COLOR_COUNT） */
export function getSpineColorIndex(book: Book): number {
  return (hash(book.id, 3) % SPINE_COLOR_COUNT) + 1;
}

export type Decoration = "bands" | "label" | "dots" | "lines" | "plain";
const DECORATIONS: Decoration[] = ["bands", "label", "dots", "lines", "plain"];

export function getDecoration(book: Book): Decoration {
  return DECORATIONS[hash(book.id, 4) % DECORATIONS.length];
}

// ---------- 棚 ----------

// 本棚は固定幅。棚の内寸に収まるだけ本を並べ、あふれたら次の段へ
export const SHELF_INNER_WIDTH = 880;
export const BOOK_GAP = 6;
export const SHELF_HEIGHT = 226;
export const FRAME_BORDER = 16;
export const SHELF_PADDING_X = 12;
export const FRAME_WIDTH = SHELF_INNER_WIDTH + SHELF_PADDING_X * 2 + FRAME_BORDER * 2;
const MIN_ROWS = 3;

export const CATEGORY_DIVIDER_WIDTH = 34;
export const AUTHOR_DIVIDER_WIDTH = 28;
export const CATEGORY_DIVIDER_HEIGHT = 214;
export const AUTHOR_DIVIDER_HEIGHT = 178;

export interface DividerItem {
  kind: "category" | "author";
  label: string;
  /** 本の並べ替えをまたいで同じ仕切りを識別するためのキー（種類＋ラベル＋出現順） */
  key: string;
}

// 本1冊＋その直前に立てる仕切り。折り返し時に泣き別れしないよう1チャンクで扱う
export interface ShelfChunk {
  dividers: DividerItem[];
  book: Book;
  index: number;
}

// 並び順の中でカテゴリ・作者が切り替わる位置に仕切りを立てる
export function buildChunks(books: Book[], hiddenAuthors: string[]): ShelfChunk[] {
  // 同じカテゴリ・作者の仕切りが離れた位置に複数立つこともあるので出現順で区別する
  const seen = new Map<string, number>();
  const makeKey = (kind: DividerItem["kind"], label: string) => {
    const base = `${kind}:${label}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `${base}#${n}`;
  };
  return books.map((book, index) => {
    const prev = index > 0 ? books[index - 1] : null;
    const category = book.category ?? null;
    const author = book.author ?? null;
    const categoryChanged = !prev || (prev.category ?? null) !== category;
    const authorChanged =
      !prev || categoryChanged || (prev.author ?? null) !== author;

    const dividers: DividerItem[] = [];
    if (category && categoryChanged) {
      dividers.push({ kind: "category", label: category, key: makeKey("category", category) });
    }
    if (author && authorChanged && !hiddenAuthors.includes(author)) {
      dividers.push({ kind: "author", label: author, key: makeKey("author", author) });
    }
    return { dividers, book, index };
  });
}

function chunkWidth(chunk: ShelfChunk): number {
  const dividersWidth = chunk.dividers.reduce(
    (sum, d) =>
      sum +
      (d.kind === "category" ? CATEGORY_DIVIDER_WIDTH : AUTHOR_DIVIDER_WIDTH) +
      BOOK_GAP,
    0
  );
  return dividersWidth + getBookWidth(chunk.book);
}

export function packIntoRows(chunks: ShelfChunk[]): ShelfChunk[][] {
  const rows: ShelfChunk[][] = [];
  let row: ShelfChunk[] = [];
  let rowWidth = 0;

  for (const chunk of chunks) {
    const width = chunkWidth(chunk);
    const needed = row.length === 0 ? width : rowWidth + BOOK_GAP + width;
    if (row.length > 0 && needed > SHELF_INNER_WIDTH) {
      rows.push(row);
      row = [];
      rowWidth = width;
    } else {
      rowWidth = needed;
    }
    row.push(chunk);
  }
  if (row.length > 0) rows.push(row);

  while (rows.length < MIN_ROWS) rows.push([]);
  return rows;
}
