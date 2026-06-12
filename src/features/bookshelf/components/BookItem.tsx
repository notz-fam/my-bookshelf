"use client";

import Image from "next/image";
import type { Book, DisplayStyle } from "../types";

// テーマパレット: 生成り紙×テラコッタ×ベージュ×ブラウンのくすんだフラットカラー
const SPINE_COLORS = [
  "#D99A72", // テラコッタ
  "#C9805B", // 深いテラコッタ
  "#B96F4E", // 焦がしテラコッタ
  "#E3D5B8", // クリーム
  "#D6C29D", // ベージュ
  "#C8A87C", // タン
  "#CFCBC0", // 明るいグレー
  "#B8B4A7", // 暖かいグレー
  "#9C8E7D", // グレージュ
  "#8A7264", // ブラウン
  "#75604F", // 深いブラウン
  "#A9A488", // セージ
  "#8F8C72", // 深いセージ
];

const INK = "#3E3831";
const ACCENT_DRAG = "#C9805B";

const SPINE_WIDTHS = [34, 40, 46, 52];
const SPINE_HEIGHTS = [152, 165, 178, 191, 204];
export const FACE_OUT_WIDTH = 112;
const FACE_OUT_HEIGHT = 158;

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

function getSpineHeight(book: Book): number {
  return SPINE_HEIGHTS[hash(book.id, 2) % SPINE_HEIGHTS.length];
}

function getColor(book: Book): string {
  return SPINE_COLORS[hash(book.id, 3) % SPINE_COLORS.length];
}

function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}

type Decoration = "bands" | "label" | "dots" | "lines" | "plain";
const DECORATIONS: Decoration[] = ["bands", "label", "dots", "lines", "plain"];

function getDecoration(book: Book): Decoration {
  return DECORATIONS[hash(book.id, 4) % DECORATIONS.length];
}

function SpineDecoration({
  decoration,
  accent,
  position,
}: {
  decoration: Decoration;
  accent: string;
  position: "top" | "bottom";
}) {
  if (decoration === "plain") return null;

  if (decoration === "bands") {
    return (
      <div className="w-full space-y-1">
        <div className="h-1 w-full" style={{ background: accent }} />
        <div className="h-0.5 w-full" style={{ background: accent }} />
      </div>
    );
  }
  if (decoration === "lines") {
    return (
      <div className="w-full space-y-0.5">
        <div className="h-px w-full" style={{ background: accent }} />
        <div className="h-px w-full" style={{ background: accent }} />
      </div>
    );
  }
  if (decoration === "dots") {
    return (
      <div className="flex justify-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block w-1 h-1 rotate-45"
            style={{ background: accent }}
          />
        ))}
      </div>
    );
  }
  // label: 上側だけに小さなラベル枠
  if (position === "top") {
    return (
      <div className="flex justify-center">
        <div
          className="w-4 h-5 rounded-[2px] border"
          style={{ borderColor: accent, background: "rgba(0,0,0,0.12)" }}
        />
      </div>
    );
  }
  return <div className="h-0.5 w-full" style={{ background: accent }} />;
}

interface BookItemProps {
  book: Book;
  index: number;
  isOwner?: boolean;
  /** このセッションで追加された本（NEWバッジを表示） */
  isNew?: boolean;
  onRemove?: (id: number) => void;
  onToggleDisplay?: (id: number, display: DisplayStyle) => void;
  onDragStartItem?: (index: number) => void;
  onDragOverItem?: (index: number) => void;
  onDropItem?: (index: number) => void;
  onDragEndItem?: () => void;
  isDragging?: boolean;
  isDragOver?: boolean;
}

export default function BookItem({
  book,
  index,
  isOwner,
  isNew,
  onRemove,
  onToggleDisplay,
  onDragStartItem,
  onDragOverItem,
  onDropItem,
  onDragEndItem,
  isDragging,
  isDragOver,
}: BookItemProps) {
  const display = getBookDisplay(book);
  const color = getColor(book);
  const lightText = !isLightColor(color);
  const textColor = lightText ? "#F7F1E6" : "#4A4339";
  const accent = lightText
    ? "rgba(255, 255, 255, 0.5)"
    : "rgba(62, 56, 49, 0.35)";
  const decoration = getDecoration(book);

  const handleClick = () => {
    if (book.amazonUrl) {
      window.open(book.amazonUrl, "_blank", "noopener,noreferrer");
    }
  };

  const newBadge = isNew && (
    <span
      className="absolute -top-2 -left-1.5 z-10 px-1 py-0.5 rounded-sm text-[9px] font-bold leading-none select-none"
      style={{
        background: INK,
        color: "#F7F1E6",
        boxShadow: "2px 2px 0 rgba(138, 114, 100, 0.6)",
      }}
      title="このセッションで追加した本"
    >
      NEW
    </span>
  );

  const controls = isOwner && (
    <div className="absolute -top-2 -right-1 z-10 hidden group-hover:flex gap-1">
      {onToggleDisplay && (
        <button
          className="w-5 h-5 bg-black/70 hover:bg-black text-white rounded-full text-[10px] flex items-center justify-center shadow-md leading-none"
          onClick={(e) => {
            e.stopPropagation();
            onToggleDisplay(
              book.id,
              display === "normal" ? "face-out" : "normal"
            );
          }}
          title={display === "normal" ? "面出しにする" : "背表紙にする"}
          aria-label={
            display === "normal"
              ? `${book.name}を面出しにする`
              : `${book.name}を背表紙にする`
          }
        >
          {display === "normal" ? "面" : "背"}
        </button>
      )}
      {onRemove && (
        <button
          className="w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center shadow-md leading-none"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(book.id);
          }}
          aria-label={`${book.name}を削除`}
        >
          ×
        </button>
      )}
    </div>
  );

  const dragProps = isOwner
    ? {
        draggable: true,
        onDragStart: (e: React.DragEvent) => {
          e.dataTransfer.effectAllowed = "move";
          onDragStartItem?.(index);
        },
        onDragOver: (e: React.DragEvent) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          onDragOverItem?.(index);
        },
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
          onDropItem?.(index);
        },
        onDragEnd: () => onDragEndItem?.(),
      }
    : {};

  const wrapperStyle: React.CSSProperties = {
    opacity: isDragging ? 0.4 : 1,
    boxShadow: isDragOver ? `-3px 0 0 0 ${ACCENT_DRAG}` : undefined,
  };

  if (display === "face-out") {
    return (
      <div
        className={`relative flex-shrink-0 group select-none ${
          isOwner ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
        }`}
        style={{ width: `${FACE_OUT_WIDTH}px`, ...wrapperStyle }}
        onClick={handleClick}
        title={book.name + (book.author ? ` / ${book.author}` : "") + (book.amazonUrl ? " (クリックでAmazonへ)" : "")}
        {...dragProps}
      >
        <div
          className="relative w-full rounded-[3px] overflow-hidden transition-transform duration-200 group-hover:-translate-y-2"
          style={{
            height: `${FACE_OUT_HEIGHT}px`,
            boxShadow: "3px 3px 0 rgba(62, 56, 49, 0.25)",
          }}
        >
          {book.coverUrl ? (
            <Image
              src={book.coverUrl}
              alt={book.name}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div
              className="w-full h-full flex flex-col items-center justify-center p-2"
              style={{ background: color }}
            >
              <div
                className="absolute inset-1.5 rounded-[2px] border pointer-events-none"
                style={{ borderColor: accent }}
              />
              <span
                className="font-bold text-xs text-center leading-tight"
                style={{
                  color: textColor,
                  display: "-webkit-box",
                  WebkitLineClamp: 5,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {book.name}
              </span>
            </div>
          )}
        </div>
        {newBadge}
        {controls}
      </div>
    );
  }

  // 背表紙（normal）
  const width = getBookWidth(book);
  const height = getSpineHeight(book);

  return (
    <div
      className={`relative flex-shrink-0 group select-none ${
        isOwner ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      }`}
      style={{ width: `${width}px`, ...wrapperStyle }}
      onClick={handleClick}
      title={book.name + (book.author ? ` / ${book.author}` : "") + (book.amazonUrl ? " (クリックでAmazonへ)" : "")}
      {...dragProps}
    >
      <div
        className="rounded-t-[3px] transition-transform duration-200 group-hover:-translate-y-2 flex flex-col justify-between pt-2.5 pb-2 px-1"
        style={{
          height: `${height}px`,
          background: color,
          // 左端の影で背の丸みをフラットに表現
          boxShadow: "inset 3px 0 0 rgba(62, 56, 49, 0.15)",
        }}
      >
        <SpineDecoration decoration={decoration} accent={accent} position="top" />
        <div className="flex-1 flex items-center justify-center overflow-hidden min-h-0">
          <span
            className="font-semibold text-[11px] leading-tight text-center"
            style={{
              color: textColor,
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              overflow: "hidden",
              maxHeight: `${height - 60}px`,
              wordBreak: "break-all",
            }}
          >
            {book.name}
          </span>
        </div>
        <SpineDecoration
          decoration={decoration}
          accent={accent}
          position="bottom"
        />
      </div>
      {newBadge}
      {controls}
    </div>
  );
}
