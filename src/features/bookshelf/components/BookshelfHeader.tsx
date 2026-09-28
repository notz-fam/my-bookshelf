"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Library, Pencil, Plus, Share2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import ThemeToggle from "@/shared/components/ThemeToggle";

interface BookshelfHeaderProps {
  name: string;
  bookCount: number;
  finishedCount: number;
  isOwner: boolean;
  onNameChange: (name: string) => void;
  onAddBook: () => void;
  onShare: () => void;
}

export default function BookshelfHeader({
  name,
  bookCount,
  finishedCount,
  isOwner,
  onNameChange,
  onAddBook,
  onShare,
}: BookshelfHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName) inputRef.current?.focus();
  }, [isEditingName]);

  const commitName = () => {
    const trimmed = draftName.trim();
    if (trimmed) onNameChange(trimmed);
    else setDraftName(name);
    setIsEditingName(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitName();
    if (e.key === "Escape") {
      setDraftName(name);
      setIsEditingName(false);
    }
  };

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="sticky top-0 z-20 border-b bg-background/75 backdrop-blur-xl"
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
        {/* Logo + bookshelf name */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <motion.span
            className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
            whileHover={{ rotate: -8, scale: 1.08 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            aria-hidden
          >
            <Library className="size-4" />
          </motion.span>
          {isOwner && isEditingName ? (
            <Input
              ref={inputRef}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitName}
              onKeyDown={handleKeyDown}
              className="h-9 text-lg font-semibold min-w-0 flex-1"
              maxLength={50}
            />
          ) : (
            <button
              className={`flex items-center gap-2 min-w-0 flex-1 text-left group ${
                isOwner ? "cursor-text" : "cursor-default"
              }`}
              onClick={() => {
                if (!isOwner) return;
                // 編集開始時に現在の名前から下書きを始める
                setDraftName(name);
                setIsEditingName(true);
              }}
              title={isOwner ? "クリックして名前を編集" : undefined}
            >
              <span className="text-xl font-semibold tracking-tight truncate min-w-0">
                {name}
              </span>
              {isOwner && (
                <Pencil className="size-3.5 flex-shrink-0 text-muted-foreground opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
              )}
            </button>
          )}
          <Badge variant="secondary" className="flex-shrink-0 tabular-nums">
            <span className="relative inline-flex overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={bookCount}
                  initial={{ y: "100%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "-100%", opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  {bookCount}
                </motion.span>
              </AnimatePresence>
            </span>
            冊
          </Badge>
          {/* 積読がある時だけ読了数を出す（全部読了なら冊数で十分） */}
          {finishedCount < bookCount && (
            <Badge
              variant="outline"
              className="flex-shrink-0 tabular-nums"
              title={`積読 ${bookCount - finishedCount}冊`}
            >
              読了 {finishedCount}
            </Badge>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <ThemeToggle />
          <Button variant="outline" onClick={onShare} title="URLをコピーして共有">
            <Share2 />
            <span className="hidden sm:inline">共有</span>
          </Button>
          {isOwner && (
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}>
              <Button onClick={onAddBook}>
                <Plus />
                <span className="hidden sm:inline">本を追加</span>
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </motion.header>
  );
}
