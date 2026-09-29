import type { Book, ShelfKey } from "./types";

// 並べ替えプリセット。
// カテゴリ順は「カテゴリ → 作者」、作者順は「作者 → カテゴリ」の順にキーを使う。
// ソートは安定（キーがすべて同じ本は今の並びを保つ）。
// 仕切りは隣の本とカテゴリ・作者が変わる位置に立つので（shelf-layout.ts）、
// 並べ替えたキーが仕切りの主キー（大きい仕切り）になる（store の sortBooks）。

export type SortPreset = ShelfKey;

export const SORT_PRESETS: { id: SortPreset; label: string }[] = [
  { id: "category", label: "カテゴリ順" },
  { id: "author", label: "作者順" },
];

// 漢字は読みではなく文字コード順になる（読みのデータを持っていないため）
const collator = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });

/** 値が無いもの（カテゴリなし・作者なし）は後ろに回す */
function compareOptional(a: string | null | undefined, b: string | null | undefined): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return collator.compare(a, b);
}

const byCategory = (a: Book, b: Book) => compareOptional(a.category, b.category);
const byAuthor = (a: Book, b: Book) => compareOptional(a.author, b.author);

export function applySortPreset(books: Book[], preset: SortPreset): Book[] {
  const [primary, secondary] =
    preset === "category" ? [byCategory, byAuthor] : [byAuthor, byCategory];
  return [...books].sort((a, b) => primary(a, b) || secondary(a, b));
}
