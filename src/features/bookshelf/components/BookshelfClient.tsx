"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useBookshelfStore } from "../store";
import { decodeBookshelfData, encodeBookshelfData } from "@/lib/url";
import type { Book, BookshelfData } from "../types";
import Bookshelf from "./Bookshelf";
import BookshelfHeader from "./BookshelfHeader";
import AddBookModal from "./AddBookModal";
import ShareModal from "./ShareModal";
import ShelfToolbar from "./ShelfToolbar";

export default function BookshelfClient() {
  const searchParams = useSearchParams();
  const store = useBookshelfStore();
  const initializedRef = useRef(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  // Load from URL on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const d = searchParams.get("d");
    if (d) {
      const data = decodeBookshelfData(d);
      if (data) {
        store.loadFromData(data);
        return;
      }
    }
    // No URL data — leave default store state
  }, [searchParams, store]);

  // Sync store state to URL whenever it changes
  useEffect(() => {
    if (!initializedRef.current) return;
    const data: BookshelfData = {
      name: store.name,
      books: store.books,
      hiddenAuthors: store.hiddenAuthors,
      primaryKey: store.primaryKey,
      hideDividers: store.hideDividers,
    };
    const encoded = encodeBookshelfData(data);
    if (!encoded) return;

    const url = new URL(window.location.href);
    const current = url.searchParams.get("d");
    if (current === encoded) return; // no change

    url.searchParams.set("d", encoded);
    window.history.replaceState(null, "", url.toString());
  }, [store.name, store.books, store.hiddenAuthors, store.primaryKey, store.hideDividers]);

  return (
    <div className="min-h-screen">
      <BookshelfHeader
        name={store.name}
        bookCount={store.books.length}
        finishedCount={store.books.filter((b) => b.finish).length}
        isOwner
        onNameChange={store.setName}
        onAddBook={() => setAddModalOpen(true)}
        onShare={() => setShareModalOpen(true)}
      />

      <main className="pb-16 pt-8 px-4">
        <ShelfToolbar
          books={store.books}
          primaryKey={store.primaryKey}
          hideDividers={store.hideDividers}
          onSort={store.sortBooks}
          onHideDividersChange={store.setHideDividers}
          onDisplayAll={store.setAllDisplay}
        />
        <Bookshelf
          books={store.books}
          hiddenAuthors={store.hiddenAuthors}
          primaryKey={store.primaryKey}
          hideDividers={store.hideDividers}
          newBookIds={store.newBookIds}
          isOwner
          onRemoveBook={store.removeBook}
          onToggleDisplay={(id, display) => store.updateBook(id, { display })}
          onToggleFinish={(id, finish) => store.updateBook(id, { finish })}
          onEditBook={setEditingBook}
          onReorderBooks={store.reorderBooks}
          onRemoveAuthorDivider={store.removeAuthorDivider}
        />
      </main>

      <AddBookModal
        isOpen={addModalOpen || !!editingBook}
        onClose={() => {
          setAddModalOpen(false);
          setEditingBook(null);
        }}
        onAdd={store.addBook}
        editingBook={editingBook}
        onUpdate={store.updateBook}
      />
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />
    </div>
  );
}
