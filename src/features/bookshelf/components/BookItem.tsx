"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { BookCheck, BookDashed, BookOpen, PanelTop, Pencil, X } from "lucide-react";
import type { Book, DisplayStyle } from "../types";
import { Button } from "@/shared/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";

// 背表紙の色は globals.css の --spine-1..N（light/dark で別パレット）
const SPINE_COLOR_COUNT = 12;

const SPINE_WIDTHS = [34, 40, 46, 52];
const SPINE_HEIGHTS = [152, 165, 178, 191, 204];
export const FACE_OUT_WIDTH = 112;
const FACE_OUT_HEIGHT = 158;

const HOVER_SPRING = { type: "spring", stiffness: 420, damping: 24 } as const;

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

function getSpineColors(book: Book) {
  const n = (hash(book.id, 3) % SPINE_COLOR_COUNT) + 1;
  const fg = `var(--spine-${n}-fg)`;
  return {
    bg: `var(--spine-${n})`,
    fg,
    accent: `color-mix(in oklch, ${fg} 40%, transparent)`,
  };
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
            className="inline-block size-1 rounded-full"
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
          className="w-4 h-5 rounded-[3px] border bg-black/15"
          style={{ borderColor: accent }}
        />
      </div>
    );
  }
  return <div className="h-0.5 w-full" style={{ background: accent }} />;
}

function ControlButton({
  label,
  destructive,
  onClick,
  children,
}: {
  label: string;
  destructive?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={destructive ? "destructive" : "secondary"}
          size="icon-sm"
          className="size-6 rounded-full shadow-md [&_svg:not([class*='size-'])]:size-3"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

interface BookItemProps {
  book: Book;
  index: number;
  isOwner?: boolean;
  /** このセッションで追加された本（NEWバッジを表示） */
  isNew?: boolean;
  onRemove?: (id: number) => void;
  onToggleDisplay?: (id: number, display: DisplayStyle) => void;
  onToggleFinish?: (id: number, finish: boolean) => void;
  onEdit?: (book: Book) => void;
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
  onToggleFinish,
  onEdit,
  onDragStartItem,
  onDragOverItem,
  onDropItem,
  onDragEndItem,
  isDragging,
  isDragOver,
}: BookItemProps) {
  const display = getBookDisplay(book);
  const { bg, fg, accent } = getSpineColors(book);
  const decoration = getDecoration(book);
  const width = getBookWidth(book);

  const handleClick = () => {
    if (book.amazonUrl) {
      window.open(book.amazonUrl, "_blank", "noopener,noreferrer");
    }
  };

  const newBadge = isNew && (
    <span
      className="absolute -top-2.5 -left-2 z-10 flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold leading-none text-primary-foreground shadow-md select-none"
      title="このセッションで追加した本"
    >
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary-foreground opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-primary-foreground" />
      </span>
      NEW
    </span>
  );

  // 未読（積読）の本。閲覧者にも見えるようにバッジを付ける
  const unreadBadge = !book.finish && (
    <span
      className="absolute -bottom-1.5 -left-2 z-10 flex size-5 items-center justify-center rounded-full border bg-muted text-muted-foreground shadow-md select-none"
      title="積読（まだ読んでいない本）"
      role="img"
      aria-label="積読"
    >
      <BookDashed className="size-3" />
    </span>
  );

  const controls = isOwner && (
    <div className="absolute -top-3 -right-2 z-10 flex gap-1 opacity-0 scale-75 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto">
      {onEdit && (
        <ControlButton label="編集" onClick={() => onEdit(book)}>
          <Pencil />
        </ControlButton>
      )}
      {onToggleFinish && (
        <ControlButton
          label={book.finish ? "積読にする" : "読了にする"}
          onClick={() => onToggleFinish(book.id, !book.finish)}
        >
          {book.finish ? <BookDashed /> : <BookCheck />}
        </ControlButton>
      )}
      {onToggleDisplay && (
        <ControlButton
          label={display === "normal" ? "面出しにする" : "背表紙にする"}
          onClick={() =>
            onToggleDisplay(book.id, display === "normal" ? "face-out" : "normal")
          }
        >
          {display === "normal" ? <PanelTop /> : <BookOpen />}
        </ControlButton>
      )}
      {onRemove && (
        <ControlButton label="削除" destructive onClick={() => onRemove(book.id)}>
          <X />
        </ControlButton>
      )}
    </div>
  );

  // ネイティブDnDは素の div に付ける（motion.div は onDrag* を独自ジェスチャーで上書きするため）
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

  const face =
    display === "face-out" ? (
      <div
        className="relative w-full rounded-[4px] overflow-hidden shadow-[0_10px_24px_-10px_rgb(0_0_0/0.45)] ring-1 ring-black/10 dark:ring-white/10"
        style={{ height: `${FACE_OUT_HEIGHT}px` }}
      >
        {book.coverUrl ? (
          <Image src={book.coverUrl} alt={book.name} fill className="object-cover" unoptimized />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center p-2"
            style={{ background: bg }}
          >
            <div
              className="absolute inset-1.5 rounded-[2px] border pointer-events-none"
              style={{ borderColor: accent }}
            />
            <span
              className="font-bold text-xs text-center leading-tight line-clamp-5"
              style={{ color: fg }}
            >
              {book.name}
            </span>
          </div>
        )}
        {/* 光沢 */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/0 to-white/15" />
      </div>
    ) : (
      <div
        className="rounded-t-[4px] flex flex-col justify-between pt-2.5 pb-2 px-1 shadow-[inset_3px_0_0_rgb(0_0_0/0.18),inset_-1px_0_0_rgb(255_255_255/0.08)]"
        style={{ height: `${getSpineHeight(book)}px`, background: bg }}
      >
        <SpineDecoration decoration={decoration} accent={accent} position="top" />
        <div className="flex-1 flex items-center justify-center overflow-hidden min-h-0">
          <span
            className="font-semibold text-[11px] leading-tight text-center break-all"
            style={{
              color: fg,
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              overflow: "hidden",
              maxHeight: `${getSpineHeight(book) - 60}px`,
            }}
          >
            {book.name}
          </span>
        </div>
        <SpineDecoration decoration={decoration} accent={accent} position="bottom" />
      </div>
    );

  return (
    <div
      className={`relative flex-shrink-0 group select-none transition-opacity [perspective:600px] ${
        isOwner ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      } ${isDragging ? "opacity-40" : "opacity-100"}`}
      style={{ width: `${width}px` }}
      onClick={handleClick}
      title={
        book.name +
        (book.author ? ` / ${book.author}` : "") +
        (book.finish ? "" : "（積読）") +
        (book.amazonUrl ? " (クリックでAmazonへ)" : "")
      }
      {...dragProps}
    >
      {/* ドロップ先インジケータ */}
      <AnimatePresence>
        {isDragOver && (
          <motion.span
            className="absolute -left-[5px] bottom-0 z-10 w-[3px] h-full rounded-full bg-drop-indicator"
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            exit={{ scaleY: 0, opacity: 0 }}
            style={{ originY: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
      </AnimatePresence>

      <motion.div
        whileHover={
          display === "face-out" ? { y: -8, rotateY: -12 } : { y: -8 }
        }
        transition={HOVER_SPRING}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* 背表紙 ⇄ 面出しの切替を本をめくるように回転 */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={display}
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={book.finish ? undefined : "saturate-50 opacity-80"}
          >
            {face}
          </motion.div>
        </AnimatePresence>
        {newBadge}
        {unreadBadge}
        {controls}
      </motion.div>
    </div>
  );
}
