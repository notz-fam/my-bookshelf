"use client";

import { useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { BookOpen, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { Book, DisplayStyle } from "../types";
import BookItem from "./BookItem";
import {
  AUTHOR_DIVIDER_HEIGHT,
  AUTHOR_DIVIDER_WIDTH,
  BOOK_GAP,
  buildChunks,
  CATEGORY_DIVIDER_HEIGHT,
  CATEGORY_DIVIDER_WIDTH,
  type DividerItem,
  FRAME_BORDER,
  FRAME_WIDTH,
  packIntoRows,
  SHELF_HEIGHT,
  SHELF_INNER_WIDTH,
  SHELF_PADDING_X,
  type ShelfChunk,
} from "../shelf-layout";

interface BookshelfProps {
  books: Book[];
  hiddenAuthors?: string[];
  /** このセッションで追加された本のID（NEWバッジ表示用） */
  newBookIds?: number[];
  isOwner?: boolean;
  onRemoveBook?: (id: number) => void;
  onToggleDisplay?: (id: number, display: DisplayStyle) => void;
  onToggleFinish?: (id: number, finish: boolean) => void;
  onEditBook?: (book: Book) => void;
  onReorderBooks?: (fromIndex: number, toIndex: number) => void;
  onRemoveAuthorDivider?: (author: string) => void;
}

function ShelfPlank() {
  return (
    <div className="h-3.5 w-full bg-shelf-plank shadow-[0_4px_10px_-4px_rgb(0_0_0/0.35)]" />
  );
}

interface ShelfDividerProps {
  divider: DividerItem;
  /** この仕切りの直後にある本のインデックス（ドロップ先として使う） */
  beforeIndex: number;
  isOwner?: boolean;
  onDropAt?: (index: number) => void;
  /** 作者仕切りのみ削除可能 */
  onRemove?: (author: string) => void;
}

function ShelfDivider({
  divider,
  beforeIndex,
  isOwner,
  onDropAt,
  onRemove,
}: ShelfDividerProps) {
  const isCategory = divider.kind === "category";
  const width = isCategory ? CATEGORY_DIVIDER_WIDTH : AUTHOR_DIVIDER_WIDTH;
  const height = isCategory ? CATEGORY_DIVIDER_HEIGHT : AUTHOR_DIVIDER_HEIGHT;

  return (
    <div
      className="relative flex-shrink-0 select-none group"
      style={{ width: `${width}px` }}
      title={`${isCategory ? "カテゴリ" : "作者"}: ${divider.label}`}
      onDragOver={isOwner ? (e) => e.preventDefault() : undefined}
      onDrop={
        isOwner
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onDropAt?.(beforeIndex);
            }
          : undefined
      }
    >
      {!isCategory && isOwner && onRemove && (
        <Button
          variant="destructive"
          size="icon-sm"
          className="absolute -top-3 -right-2 z-10 size-6 rounded-full shadow-md opacity-0 scale-75 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto [&_svg:not([class*='size-'])]:size-3"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(divider.label);
          }}
          title={`「${divider.label}」の仕切りを削除`}
          aria-label={`${divider.label}の仕切りを削除`}
        >
          <X />
        </Button>
      )}
      <div
        className={`rounded-t-lg flex flex-col items-center pt-2 pb-2 border border-border ${
          isCategory ? "bg-divider-category" : "bg-divider-author"
        }`}
        style={{ height: `${height}px` }}
      >
        {/* 仕切り板の指穴 */}
        <div className="size-[7px] rounded-full mb-2 flex-shrink-0 bg-foreground/70" />
        <span
          className={`font-semibold leading-tight text-center text-divider-fg ${
            isCategory ? "text-xs" : "text-[11px]"
          }`}
          style={{
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            overflow: "hidden",
            maxHeight: `${height - 40}px`,
          }}
        >
          {divider.label}
        </span>
      </div>
    </div>
  );
}

// 本・仕切りの出入りアニメーション。
// custom には「現在棚にある本のID・仕切りキーの集合」が渡る。段をまたいだ移動では
// 旧インスタンスを即座に消し、layoutId による共有レイアウト遷移に任せる。
// 仕切りは本とは別要素にして、本を入れ替えても仕切りは自分の位置に留まるようにする。
interface PresenceIds {
  books: Set<number>;
  dividers: Set<string>;
}

function itemVariants(isPresent: (ids: PresenceIds) => boolean) {
  return {
    exit: (ids: PresenceIds) =>
      isPresent(ids)
        ? { opacity: 0, transition: { duration: 0 } }
        : {
            opacity: 0,
            scale: 0.6,
            y: -24,
            filter: "blur(4px)",
            transition: { duration: 0.22, ease: "easeIn" as const },
          },
  };
}

const LAYOUT_SPRING = { type: "spring", stiffness: 380, damping: 32 } as const;

export default function Bookshelf({
  books,
  hiddenAuthors,
  newBookIds,
  isOwner,
  onRemoveBook,
  onToggleDisplay,
  onToggleFinish,
  onEditBook,
  onReorderBooks,
  onRemoveAuthorDivider,
}: BookshelfProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // 直前の books にあった本。ここに無い本は「新しく置かれた本」として上から落とす
  // （初回は空なので、URLから読み込んだ本も順に落ちてくる）
  const [prevBooks, setPrevBooks] = useState(books);
  const [knownIds, setKnownIds] = useState<Set<number>>(() => new Set());
  if (books !== prevBooks) {
    setKnownIds(new Set(prevBooks.map((b) => b.id)));
    setPrevBooks(books);
  }

  const rows = packIntoRows(buildChunks(books, hiddenAuthors ?? []));
  const currentIds: PresenceIds = {
    books: new Set(books.map((b) => b.id)),
    dividers: new Set(
      rows.flatMap((row) => row.flatMap((c) => c.dividers.map((d) => d.key)))
    ),
  };
  const freshOrder = books.filter((b) => !knownIds.has(b.id)).map((b) => b.id);

  const handleDrop = (targetIndex: number) => {
    if (dragIndex !== null && dragIndex !== targetIndex) {
      onReorderBooks?.(dragIndex, targetIndex);
    }
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  // 棚の空き部分にドロップしたら、その段の末尾（＝次の本の前）へ移動
  const rowDropProps = (row: ShelfChunk[]) =>
    isOwner
      ? {
          onDragOver: (e: React.DragEvent) => {
            if (dragIndex !== null) e.preventDefault();
          },
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            const lastIndex =
              row.length > 0 ? row[row.length - 1].index : books.length - 1;
            handleDrop(
              dragIndex !== null && dragIndex <= lastIndex
                ? lastIndex
                : lastIndex + 1
            );
          },
        }
      : {};

  return (
    <div className="overflow-x-auto pb-10 pt-2">
      <motion.div
        className="mx-auto"
        style={{ width: `${FRAME_WIDTH}px` }}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 26, delay: 0.1 }}
      >
        {/* 外枠 */}
        <div
          className="rounded-2xl border bg-shelf-frame shadow-shelf"
          style={{ padding: `${FRAME_BORDER}px ${FRAME_BORDER}px 0` }}
        >
          <LayoutGroup>
            {rows.map((row, rowIndex) => (
              <motion.div
                key={rowIndex}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + rowIndex * 0.08, duration: 0.4, ease: "easeOut" }}
              >
                {/* 棚の内部（背板） */}
                <div
                  className="relative flex items-end rounded-t-md bg-shelf-back shadow-shelf-inset"
                  style={{
                    height: `${SHELF_HEIGHT}px`,
                    width: `${SHELF_INNER_WIDTH + SHELF_PADDING_X * 2}px`,
                    padding: `0 ${SHELF_PADDING_X}px`,
                    gap: `${BOOK_GAP}px`,
                  }}
                  {...rowDropProps(row)}
                >
                  <AnimatePresence mode="popLayout" custom={currentIds}>
                    {row.flatMap(({ dividers, book, index }) => {
                      const freshPos = freshOrder.indexOf(book.id);
                      const dividerNodes = dividers.map((divider) => (
                        <motion.div
                          key={divider.key}
                          layoutId={`divider-${divider.key}`}
                          layout="position"
                          className="relative flex items-end flex-shrink-0 hover:z-20"
                          variants={itemVariants((ids) => ids.dividers.has(divider.key))}
                          custom={currentIds}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit="exit"
                          transition={{ ...LAYOUT_SPRING, layout: LAYOUT_SPRING }}
                        >
                          <ShelfDivider
                            divider={divider}
                            beforeIndex={index}
                            isOwner={isOwner}
                            onDropAt={handleDrop}
                            onRemove={onRemoveAuthorDivider}
                          />
                        </motion.div>
                      ));
                      return [
                        ...dividerNodes,
                        <motion.div
                          key={book.id}
                          layoutId={`book-${book.id}`}
                          layout="position"
                          className="relative flex items-end flex-shrink-0 hover:z-20"
                          variants={itemVariants((ids) => ids.books.has(book.id))}
                          custom={currentIds}
                          initial={
                            freshPos >= 0
                              ? { opacity: 0, y: -80, rotate: -6 }
                              : false
                          }
                          animate={{ opacity: 1, y: 0, rotate: 0 }}
                          exit="exit"
                          transition={{
                            ...LAYOUT_SPRING,
                            delay: freshPos > 0 ? Math.min(freshPos * 0.035, 0.8) : 0,
                            layout: LAYOUT_SPRING,
                          }}
                        >
                          <BookItem
                            book={book}
                            index={index}
                            isOwner={isOwner}
                            isNew={newBookIds?.includes(book.id)}
                            onRemove={onRemoveBook}
                            onToggleDisplay={onToggleDisplay}
                            onToggleFinish={onToggleFinish}
                            onEdit={onEditBook}
                            onDragStartItem={setDragIndex}
                            onDragOverItem={setOverIndex}
                            onDropItem={handleDrop}
                            onDragEndItem={handleDragEnd}
                            isDragging={dragIndex === index}
                            isDragOver={
                              overIndex === index &&
                              dragIndex !== null &&
                              dragIndex !== index
                            }
                          />
                        </motion.div>,
                      ];
                    })}
                  </AnimatePresence>
                  {books.length === 0 && rowIndex === 0 && (
                    <motion.div
                      className="w-full self-center flex flex-col items-center text-center"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 }}
                    >
                      <motion.div
                        className="mb-3 flex size-12 items-center justify-center rounded-xl border bg-background text-muted-foreground"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <BookOpen className="size-5" />
                      </motion.div>
                      <p className="text-base font-medium">まだ本が登録されていません</p>
                      {isOwner && (
                        <p className="text-sm mt-1 text-muted-foreground">
                          「本を追加」ボタンから本を登録できます
                        </p>
                      )}
                    </motion.div>
                  )}
                </div>
                <ShelfPlank />
              </motion.div>
            ))}
          </LayoutGroup>
        </div>
      </motion.div>
    </div>
  );
}
