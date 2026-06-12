"use client";

import { useState, useRef, useEffect } from "react";

interface BookshelfHeaderProps {
  name: string;
  bookCount: number;
  isOwner: boolean;
  onNameChange: (name: string) => void;
  onAddBook: () => void;
  onShare: () => void;
}

// ずらし影つきのフラットボタン（テーマの紙コラージュ風モチーフ）
const buttonBase =
  "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-semibold transition-transform active:translate-x-0.5 active:translate-y-0.5";

export default function BookshelfHeader({
  name,
  bookCount,
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

  useEffect(() => {
    setDraftName(name);
  }, [name]);

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
    <header
      className="sticky top-0 z-20 border-b"
      style={{
        background: "rgba(250, 246, 239, 0.95)",
        backdropFilter: "blur(8px)",
        borderColor: "rgba(62, 56, 49, 0.2)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
        {/* Logo + bookshelf name */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* 紙を重ねたロゴ */}
          <span className="relative w-6 h-6 flex-shrink-0" aria-hidden>
            <span
              className="absolute inset-0 translate-x-1 translate-y-1 rounded-sm"
              style={{ background: "#8A7264" }}
            />
            <span
              className="absolute inset-0 rounded-sm border"
              style={{ background: "#DFA37E", borderColor: "#3E3831" }}
            />
          </span>
          {isOwner && isEditingName ? (
            <input
              ref={inputRef}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitName}
              onKeyDown={handleKeyDown}
              className="text-xl font-bold rounded-md px-3 py-1 min-w-0 flex-1 outline-none border"
              style={{
                color: "#3E3831",
                background: "#FFFFFF",
                borderColor: "#3E3831",
              }}
              maxLength={50}
            />
          ) : (
            <button
              className={`flex items-center gap-2 min-w-0 flex-1 text-left group ${
                isOwner ? "cursor-text" : "cursor-default"
              }`}
              onClick={() => isOwner && setIsEditingName(true)}
              title={isOwner ? "クリックして名前を編集" : undefined}
            >
              <span
                className={`text-xl font-bold truncate min-w-0 ${
                  isOwner ? "group-hover:opacity-70" : ""
                }`}
                style={{ color: "#3E3831" }}
              >
                {name}
              </span>
              {isOwner && (
                // 編集できることを示す鉛筆アイコン
                <svg
                  className="flex-shrink-0 w-4 h-4 transition-colors group-hover:stroke-[#3E3831]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#8C8276"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              )}
            </button>
          )}
          <span
            className="text-sm flex-shrink-0 font-medium"
            style={{ color: "#8C8276" }}
          >
            {bookCount}冊
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Share button */}
          <button
            onClick={onShare}
            className={buttonBase}
            style={{
              background: "#E6DCC8",
              borderColor: "#3E3831",
              color: "#3E3831",
              boxShadow: "3px 3px 0 #8A7264",
            }}
            title="URLをコピーして共有"
          >
            <span>🔗</span>
            <span className="hidden sm:inline">共有</span>
          </button>

          {/* Add book button (owner only) */}
          {isOwner && (
            <button
              onClick={onAddBook}
              className={buttonBase}
              style={{
                background: "#DFA37E",
                borderColor: "#3E3831",
                color: "#3E3831",
                boxShadow: "3px 3px 0 #8A7264",
              }}
            >
              <span>＋</span>
              <span className="hidden sm:inline">本を追加</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
