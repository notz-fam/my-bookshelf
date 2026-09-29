export type DisplayStyle = "normal" | "face-out";

export interface Book {
  id: number;
  name: string;
  category: string | null;
  author?: string | null;
  finish: boolean;
  coverUrl?: string;
  amazonUrl?: string;
  /** 1冊ごとの並べ方。省略時は "normal"（背表紙） */
  display?: DisplayStyle;
}

/** 仕切りのキー。主キーの仕切りは大きく、サブキーの仕切りは小さく立つ */
export type ShelfKey = "category" | "author";

export interface BookshelfData {
  name: string;
  books: Book[];
  /** 仕切りを表示しない作者名のリスト（作者仕切りの×で追加される） */
  hiddenAuthors?: string[];
  /** 仕切りの主キー（並べ替えプリセットで切り替わる）。省略時は "category" */
  primaryKey?: ShelfKey;
  /** すべての仕切りを隠す（仕切りのオン・オフ）。省略時は表示 */
  hideDividers?: boolean;
}
