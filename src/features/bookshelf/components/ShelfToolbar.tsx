"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { BookOpen, PanelTop, SeparatorVertical, Tags, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Book, DisplayStyle, ShelfKey } from "../types";
import { SORT_PRESETS } from "../sort-presets";
import { getBookDisplay } from "../shelf-layout";

// 本棚の上の操作バー：並べ替えプリセット・背表紙/面出しの一括切り替え・仕切りのオン/オフ。
// 半透明のフローティングバーに、選択中のハイライトがスライドするセグメントコントロールを並べる。

interface ShelfToolbarProps {
  books: Book[];
  /** 今の仕切りの主キー（そのボタンを選択中として表示） */
  primaryKey: ShelfKey;
  hideDividers: boolean;
  onSort: (key: ShelfKey) => void;
  onHideDividersChange: (hide: boolean) => void;
  onDisplayAll: (display: DisplayStyle) => void;
}

type Icon = typeof BookOpen;

const SORT_ICONS: Record<ShelfKey, Icon> = { category: Tags, author: UserRound };

const DISPLAY_OPTIONS: { id: DisplayStyle; label: string; icon: Icon }[] = [
  { id: "normal", label: "背表紙", icon: BookOpen },
  { id: "face-out", label: "面出し", icon: PanelTop },
];

const PILL_SPRING = { type: "spring", stiffness: 500, damping: 38 } as const;

interface SegmentOption<T extends string> {
  id: T;
  label: string;
  icon: Icon;
}

/** 選択中のハイライトがスライドするセグメントコントロール。value が null なら選択なし */
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: SegmentOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  // ハイライトの layoutId はコントロールごとに一意にする（同じ画面に複数あるため）
  const pillId = useId();
  return (
    <div role="group" aria-label={label} className="flex items-center gap-0.5 rounded-full bg-muted/70 p-0.5">
      {options.map(({ id, label: optionLabel, icon: Icon }) => {
        const selected = id === value;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(id)}
            className={cn(
              "relative flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              selected ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {selected && (
              <motion.span
                layoutId={pillId}
                className="absolute inset-0 rounded-full bg-primary shadow-sm"
                transition={PILL_SPRING}
              />
            )}
            <Icon className="relative size-3.5" />
            <span className="relative">{optionLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="hidden h-5 w-px bg-border sm:block" />;
}

export default function ShelfToolbar({
  books,
  primaryKey,
  hideDividers,
  onSort,
  onHideDividersChange,
  onDisplayAll,
}: ShelfToolbarProps) {
  if (books.length === 0) return null;

  // 全冊が同じ並べ方ならそのボタンを選択中にする（混在ならどちらも選択しない）
  const displays = new Set(books.map(getBookDisplay));
  const currentDisplay = displays.size === 1 ? [...displays][0] : null;
  const showDividers = !hideDividers;

  return (
    <motion.div
      className="mx-auto mb-5 flex w-fit max-w-full flex-wrap items-center justify-center gap-2 rounded-3xl border bg-background/70 p-1.5 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.18)] backdrop-blur-xl sm:rounded-full"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.05 }}
    >
      {books.length >= 2 && (
        <>
          <Segmented
            label="並べ替え"
            value={primaryKey}
            onChange={onSort}
            options={SORT_PRESETS.map((p) => ({ ...p, icon: SORT_ICONS[p.id] }))}
          />
          <Divider />
        </>
      )}

      <Segmented
        label="並べ方"
        value={currentDisplay}
        onChange={onDisplayAll}
        options={DISPLAY_OPTIONS}
      />

      <Divider />

      <button
        type="button"
        aria-pressed={showDividers}
        onClick={() => onHideDividersChange(showDividers)}
        className={cn(
          "flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          showDividers
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <SeparatorVertical className="size-3.5" />
        仕切り
      </button>
    </motion.div>
  );
}
