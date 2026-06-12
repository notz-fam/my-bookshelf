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

export interface BookshelfData {
  name: string;
  books: Book[];
  /** 仕切りを表示しない作者名のリスト（作者仕切りの×で追加される） */
  hiddenAuthors?: string[];
}
