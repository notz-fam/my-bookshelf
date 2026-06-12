"use client";

import { useState } from "react";
import type { Book, DisplayStyle } from "../types";
import BookItem, { getBookWidth } from "./BookItem";

interface BookshelfProps {
  books: Book[];
  hiddenAuthors?: string[];
  /** このセッションで追加された本のID（NEWバッジ表示用） */
  newBookIds?: number[];
  isOwner?: boolean;
  onRemoveBook?: (id: number) => void;
  onToggleDisplay?: (id: number, display: DisplayStyle) => void;
  onReorderBooks?: (fromIndex: number, toIndex: number) => void;
  onRemoveAuthorDivider?: (author: string) => void;
}

// 本棚は固定幅。棚の内寸に収まるだけ本を並べ、あふれたら次の段へ
const SHELF_INNER_WIDTH = 880;
const BOOK_GAP = 6;
const SHELF_HEIGHT = 226;
const FRAME_BORDER = 16;
const SHELF_PADDING_X = 12;
const FRAME_WIDTH = SHELF_INNER_WIDTH + SHELF_PADDING_X * 2 + FRAME_BORDER * 2;
const MIN_ROWS = 3;

const CATEGORY_DIVIDER_WIDTH = 34;
const AUTHOR_DIVIDER_WIDTH = 28;

// テーマ: フラットな図形＋細いインク線＋ずらし影（紙コラージュ風）
const INK = "#3E3831";
const FRAME_BG = "#D9C3A3";
const PLANK_BG = "#C9AC83";
const SHELF_BG = "#F4EDDF";

interface DividerItem {
  kind: "category" | "author";
  label: string;
}

// 本1冊＋その直前に立てる仕切り。折り返し時に泣き別れしないよう1チャンクで扱う
interface ShelfChunk {
  dividers: DividerItem[];
  book: Book;
  index: number;
}

// 並び順の中でカテゴリ・作者が切り替わる位置に仕切りを立てる
function buildChunks(books: Book[], hiddenAuthors: string[]): ShelfChunk[] {
  return books.map((book, index) => {
    const prev = index > 0 ? books[index - 1] : null;
    const category = book.category ?? null;
    const author = book.author ?? null;
    const categoryChanged = !prev || (prev.category ?? null) !== category;
    const authorChanged =
      !prev || categoryChanged || (prev.author ?? null) !== author;

    const dividers: DividerItem[] = [];
    if (category && categoryChanged) {
      dividers.push({ kind: "category", label: category });
    }
    if (author && authorChanged && !hiddenAuthors.includes(author)) {
      dividers.push({ kind: "author", label: author });
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

function packIntoRows(chunks: ShelfChunk[]): ShelfChunk[][] {
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

function ShelfPlank() {
  return (
    <div
      className="w-full"
      style={{
        height: "14px",
        background: PLANK_BG,
        boxShadow: "0 3px 0 rgba(62, 56, 49, 0.15)",
      }}
    />
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
  const height = isCategory ? 214 : 178;

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
        <button
          className="absolute -top-2 -right-1 z-10 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center shadow-md leading-none"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(divider.label);
          }}
          title={`「${divider.label}」の仕切りを削除`}
          aria-label={`${divider.label}の仕切りを削除`}
        >
          ×
        </button>
      )}
      <div
        className="rounded-t-md flex flex-col items-center pt-2 pb-2 border"
        style={{
          height: `${height}px`,
          background: isCategory ? "#ECD9BF" : "#E2DED2",
          borderColor: "rgba(62, 56, 49, 0.35)",
          boxShadow: "2px 2px 0 rgba(138, 114, 100, 0.45)",
        }}
      >
        {/* 仕切り板の指穴 */}
        <div
          className="rounded-full mb-2 flex-shrink-0"
          style={{ width: "7px", height: "7px", background: INK }}
        />
        <span
          className={`font-semibold leading-tight text-center ${
            isCategory ? "text-xs" : "text-[11px]"
          }`}
          style={{
            color: isCategory ? "#6E5B48" : "#5A584E",
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

export default function Bookshelf({
  books,
  hiddenAuthors,
  newBookIds,
  isOwner,
  onRemoveBook,
  onToggleDisplay,
  onReorderBooks,
  onRemoveAuthorDivider,
}: BookshelfProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const rows = packIntoRows(buildChunks(books, hiddenAuthors ?? []));

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
    <div className="overflow-x-auto pb-6">
      <div className="mx-auto" style={{ width: `${FRAME_WIDTH}px` }}>
        {/* 外枠（フラットなタン＋インク線＋ずらし影） */}
        <div
          className="rounded-md border"
          style={{
            background: FRAME_BG,
            borderColor: INK,
            padding: `${FRAME_BORDER}px ${FRAME_BORDER}px 0`,
            boxShadow: "8px 8px 0 #8A7264",
          }}
        >
          {rows.map((row, rowIndex) => (
            <div key={rowIndex}>
              {/* 棚の内部（暗い背板） */}
              <div
                className="flex items-end"
                style={{
                  height: `${SHELF_HEIGHT}px`,
                  width: `${SHELF_INNER_WIDTH + SHELF_PADDING_X * 2}px`,
                  padding: `0 ${SHELF_PADDING_X}px`,
                  gap: `${BOOK_GAP}px`,
                  background: SHELF_BG,
                  boxShadow: "inset 0 6px 10px rgba(62, 56, 49, 0.1)",
                }}
                {...rowDropProps(row)}
              >
                {row.map(({ dividers, book, index }) => (
                  <div
                    key={book.id}
                    className="flex items-end flex-shrink-0"
                    style={{ gap: `${BOOK_GAP}px` }}
                  >
                    {dividers.map((divider) => (
                      <ShelfDivider
                        key={`${divider.kind}-${divider.label}`}
                        divider={divider}
                        beforeIndex={index}
                        isOwner={isOwner}
                        onDropAt={handleDrop}
                        onRemove={onRemoveAuthorDivider}
                      />
                    ))}
                    <BookItem
                      book={book}
                      index={index}
                      isOwner={isOwner}
                      isNew={newBookIds?.includes(book.id)}
                      onRemove={onRemoveBook}
                      onToggleDisplay={onToggleDisplay}
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
                  </div>
                ))}
                {books.length === 0 && rowIndex === 0 && (
                  <div className="w-full self-center text-center">
                    <p className="text-4xl mb-3">📚</p>
                    <p
                      className="text-base font-medium"
                      style={{ color: "#8C8276" }}
                    >
                      まだ本が登録されていません
                    </p>
                    {isOwner && (
                      <p className="text-sm mt-1" style={{ color: "#B0A698" }}>
                        「本を追加」ボタンから本を登録できます
                      </p>
                    )}
                  </div>
                )}
              </div>
              <ShelfPlank />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
