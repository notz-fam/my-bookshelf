"use client";

import { create } from "zustand";
import type { Book, BookshelfData } from "./types";

interface BookshelfStore extends BookshelfData {
  nextId: number;
  /**
   * このセッションで追加された本のID（NEWバッジ表示用）。
   * BookshelfData には含めないので共有URLには載らない。
   */
  newBookIds: number[];
  addBook: (book: Omit<Book, "id">) => void;
  removeBook: (id: number) => void;
  updateBook: (id: number, updates: Partial<Omit<Book, "id">>) => void;
  setName: (name: string) => void;
  reorderBooks: (fromIndex: number, toIndex: number) => void;
  removeAuthorDivider: (author: string) => void;
  loadFromData: (data: BookshelfData) => void;
}

export const useBookshelfStore = create<BookshelfStore>((set) => ({
  name: "私の本棚",
  books: [],
  hiddenAuthors: [],
  nextId: 1,
  newBookIds: [],

  // 同じカテゴリの本が既にあれば、その最後尾の直後に挿入する
  addBook: (book) =>
    set((state) => {
      const newBook = { ...book, id: state.nextId };
      const category = book.category ?? null;
      const books = [...state.books];

      let insertAt = books.length;
      for (let i = books.length - 1; i >= 0; i--) {
        if ((books[i].category ?? null) === category) {
          insertAt = i + 1;
          break;
        }
      }
      books.splice(insertAt, 0, newBook);

      return {
        books,
        nextId: state.nextId + 1,
        newBookIds: [...state.newBookIds, newBook.id],
      };
    }),

  removeBook: (id) =>
    set((state) => ({
      books: state.books.filter((b) => b.id !== id),
      newBookIds: state.newBookIds.filter((n) => n !== id),
    })),

  updateBook: (id, updates) =>
    set((state) => ({
      books: state.books.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    })),

  setName: (name) => set({ name }),

  reorderBooks: (fromIndex, toIndex) =>
    set((state) => {
      const books = [...state.books];
      const [removed] = books.splice(fromIndex, 1);
      books.splice(toIndex, 0, removed);
      return { books };
    }),

  removeAuthorDivider: (author) =>
    set((state) => ({
      hiddenAuthors: (state.hiddenAuthors ?? []).includes(author)
        ? state.hiddenAuthors
        : [...(state.hiddenAuthors ?? []), author],
    })),

  loadFromData: (data) =>
    set({
      name: data.name,
      books: data.books,
      hiddenAuthors: data.hiddenAuthors ?? [],
      // URLから開いた本棚ではNEWバッジを表示しない
      newBookIds: [],
      nextId:
        data.books.length > 0
          ? Math.max(...data.books.map((b) => b.id)) + 1
          : 1,
    }),
}));
