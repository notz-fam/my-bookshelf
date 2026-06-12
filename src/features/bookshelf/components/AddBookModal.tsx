"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import Modal from "@/shared/components/Modal";
import { extractAsinFromUrl, getAmazonCoverUrl } from "@/lib/url";
import type { Book } from "../types";
import type { BookLookupResult } from "@/lib/book-lookup";

interface AddBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (book: Omit<Book, "id">) => void;
}

type LookupStatus = "idle" | "loading" | "found" | "not_found" | "error";

const EMPTY_FORM = {
  name: "",
  author: "",
  category: "",
  amazonUrl: "",
  coverUrl: "",
  finish: true,
};

type Mode = "single" | "bulk";

type BulkLineStatus = "pending" | "loading" | "added" | "title_only" | "failed";
interface BulkLine {
  raw: string;
  status: BulkLineStatus;
  title?: string;
}

// How many lookups to run at once (Amazon scraping is slow; stay polite)
const BULK_CONCURRENCY = 4;

export default function AddBookModal({ isOpen, onClose, onAdd }: AddBookModalProps) {
  const [mode, setMode] = useState<Mode>("single");
  const [form, setForm] = useState(EMPTY_FORM);
  const [previewCover, setPreviewCover] = useState<string | null>(null);
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether each field was auto-filled (so we can overwrite on re-lookup)
  const autoFilledRef = useRef({ name: false, author: false, category: false });

  // --- Bulk add state ---
  const [bulkText, setBulkText] = useState("");
  const [bulkFinish, setBulkFinish] = useState(true);
  const [bulkLines, setBulkLines] = useState<BulkLine[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkDone, setBulkDone] = useState(false);

  const setCover = (url: string | null) => {
    setForm((f) => ({ ...f, coverUrl: url ?? "" }));
    setPreviewCover(url);
  };

  const handleAmazonUrlChange = (url: string) => {
    setForm((f) => ({ ...f, amazonUrl: url }));

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!url || !extractAsinFromUrl(url)) {
      setLookupStatus("idle");
      setCover(null);
      return;
    }

    setLookupStatus("loading");
    debounceRef.current = setTimeout(() => fetchBookInfo(url), 600);
  };

  const fetchBookInfo = async (url: string) => {
    const asin = extractAsinFromUrl(url);
    try {
      const res = await fetch(
        `/api/lookup-book?url=${encodeURIComponent(url)}`
      );

      if (!res.ok) {
        setLookupStatus("not_found");
        // Even without book info, derive the cover from the ASIN
        if (asin) setCover(getAmazonCoverUrl(asin));
        return;
      }

      const data: BookLookupResult = await res.json();
      setLookupStatus("found");

      setForm((f) => ({
        ...f,
        name: autoFilledRef.current.name || !f.name ? (data.title ?? f.name) : f.name,
        author:
          autoFilledRef.current.author || !f.author
            ? (data.author ?? f.author)
            : f.author,
        category:
          autoFilledRef.current.category || !f.category
            ? (data.category ?? f.category)
            : f.category,
      }));

      setCover(data.coverUrl ?? (asin ? getAmazonCoverUrl(asin) : null));
      autoFilledRef.current = {
        name: !!data.title,
        author: !!data.author,
        category: !!data.category,
      };
    } catch {
      setLookupStatus("error");
      if (asin) setCover(getAmazonCoverUrl(asin));
    }
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return;

    onAdd({
      name,
      author: form.author.trim() || null,
      category: form.category.trim() || null,
      amazonUrl: form.amazonUrl.trim() || undefined,
      coverUrl: form.coverUrl.trim() || undefined,
      finish: form.finish,
    });

    resetAndClose();
  };

  const resetAndClose = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setForm(EMPTY_FORM);
    setPreviewCover(null);
    setLookupStatus("idle");
    autoFilledRef.current = { name: false, author: false, category: false };
    setMode("single");
    setBulkText("");
    setBulkLines([]);
    setBulkRunning(false);
    setBulkDone(false);
    onClose();
  };

  // Process the pasted lines: Amazon URLs get a full lookup, other lines are
  // added as title-only books. Runs a small concurrency pool with live status.
  const handleBulkSubmit = async () => {
    const parsed = bulkText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parsed.length === 0) return;

    setBulkLines(parsed.map((raw) => ({ raw, status: "pending" })));
    setBulkRunning(true);
    setBulkDone(false);

    const updateLine = (i: number, patch: Partial<BulkLine>) =>
      setBulkLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

    const worker = async (i: number) => {
      const raw = parsed[i];
      updateLine(i, { status: "loading" });

      const asin = extractAsinFromUrl(raw);
      if (asin) {
        try {
          const res = await fetch(`/api/lookup-book?url=${encodeURIComponent(raw)}`);
          if (res.ok) {
            const data: BookLookupResult = await res.json();
            onAdd({
              name: data.title ?? raw,
              author: data.author ?? null,
              category: data.category ?? null,
              amazonUrl: raw,
              coverUrl: data.coverUrl ?? getAmazonCoverUrl(asin),
              finish: bulkFinish,
            });
            updateLine(i, { status: "added", title: data.title ?? undefined });
            return;
          }
        } catch {
          // fall through to failure
        }
        updateLine(i, { status: "failed" });
        return;
      }

      // Not an Amazon URL — treat the whole line as a title
      onAdd({ name: raw, author: null, category: null, finish: bulkFinish });
      updateLine(i, { status: "title_only", title: raw });
    };

    // Concurrency pool
    let cursor = 0;
    const runners = Array.from(
      { length: Math.min(BULK_CONCURRENCY, parsed.length) },
      async () => {
        while (cursor < parsed.length) {
          const idx = cursor++;
          await worker(idx);
        }
      }
    );
    await Promise.all(runners);

    setBulkRunning(false);
    setBulkDone(true);
  };

  const lookupIndicator = () => {
    if (lookupStatus === "loading")
      return (
        <span className="flex items-center gap-1 text-[#C9805B]">
          <span className="inline-block w-3 h-3 border-2 border-[#C9805B] border-t-transparent rounded-full animate-spin" />
          書籍情報を取得中…
        </span>
      );
    if (lookupStatus === "found")
      return <span className="text-green-600">✓ 書籍情報を自動入力しました</span>;
    if (lookupStatus === "not_found")
      return <span className="text-gray-400">書籍情報が見つかりませんでした。タイトルは手動で入力してください</span>;
    if (lookupStatus === "error")
      return <span className="text-red-400">取得中にエラーが発生しました</span>;
    return null;
  };

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title="本を追加する">
      {/* Mode tabs */}
      <div className="flex gap-2 mb-4">
        {([
          ["single", "1冊ずつ"],
          ["bulk", "まとめて追加"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className="flex-1 py-2 rounded-md border text-sm font-semibold transition-colors"
            style={
              mode === value
                ? { background: "#DFA37E", borderColor: "#3E3831", color: "#3E3831" }
                : { background: "#FAF6EF", borderColor: "#3E383159", color: "#8C8276" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "single" ? (
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Amazon URL */}
        <div>
          <label className="block text-sm font-semibold text-[#3E3831] mb-1">
            Amazon URL
            <span className="ml-1 text-xs font-normal text-gray-400">
              （タイトル・カテゴリ・表紙を自動取得）
            </span>
          </label>
          <input
            type="url"
            value={form.amazonUrl}
            onChange={(e) => handleAmazonUrlChange(e.target.value)}
            placeholder="https://www.amazon.co.jp/dp/..."
            className="w-full border border-[#3E383159] bg-white text-[#3E3831] rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#DFA37E] focus:border-transparent transition"
          />
          {lookupStatus !== "idle" && (
            <p className="mt-1 text-xs">{lookupIndicator()}</p>
          )}
        </div>

        {/* Book name */}
        <div>
          <label className="block text-sm font-semibold text-[#3E3831] mb-1">
            タイトル <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => {
              autoFilledRef.current.name = false;
              setForm((f) => ({ ...f, name: e.target.value }));
            }}
            placeholder="本のタイトルを入力"
            required
            maxLength={100}
            className="w-full border border-[#3E383159] bg-white text-[#3E3831] rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#DFA37E] focus:border-transparent transition"
          />
        </div>

        {/* Author */}
        <div>
          <label className="block text-sm font-semibold text-[#3E3831] mb-1">
            作者
            <span className="ml-1 text-xs font-normal text-gray-400">
              （オプション）
            </span>
          </label>
          <input
            type="text"
            value={form.author}
            onChange={(e) => {
              autoFilledRef.current.author = false;
              setForm((f) => ({ ...f, author: e.target.value }));
            }}
            placeholder="例：村上春樹"
            maxLength={50}
            className="w-full border border-[#3E383159] bg-white text-[#3E3831] rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#DFA37E] focus:border-transparent transition"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-semibold text-[#3E3831] mb-1">
            カテゴリ
            <span className="ml-1 text-xs font-normal text-gray-400">
              （オプション）
            </span>
          </label>
          <input
            type="text"
            value={form.category}
            onChange={(e) => {
              autoFilledRef.current.category = false;
              setForm((f) => ({ ...f, category: e.target.value }));
            }}
            placeholder="例：小説、技術書、ビジネス"
            maxLength={50}
            className="w-full border border-[#3E383159] bg-white text-[#3E3831] rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#DFA37E] focus:border-transparent transition"
          />
        </div>

        {/* Cover preview (auto-set from Amazon URL) */}
        {previewCover && (
          <div className="flex justify-center">
            <div
              className="relative rounded-md overflow-hidden border"
              style={{
                width: "80px",
                height: "110px",
                borderColor: "#3E3831",
                boxShadow: "3px 3px 0 rgba(138, 114, 100, 0.6)",
              }}
            >
              <Image
                src={previewCover}
                alt="表紙プレビュー"
                fill
                className="object-cover"
                unoptimized
                onError={() => setCover(null)}
              />
            </div>
          </div>
        )}

        {/* Finish toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            className={`relative w-10 h-6 rounded-full transition-colors ${
              form.finish ? "bg-[#DFA37E]" : "bg-[#E2DED2]"
            }`}
            onClick={() => setForm((f) => ({ ...f, finish: !f.finish }))}
          >
            <div
              className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                form.finish ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </div>
          <span className="text-sm font-medium text-[#3E3831]">読了済み</span>
        </label>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={resetAndClose}
            className="flex-1 py-2.5 border border-[#3E383159] text-[#8C8276] rounded-md text-sm font-medium hover:bg-[#FAF6EF] transition-colors"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={!form.name.trim() || lookupStatus === "loading"}
            className="flex-1 py-2.5 rounded-md border text-sm font-semibold transition-transform active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "#DFA37E",
              borderColor: "#3E3831",
              color: "#3E3831",
              boxShadow: "3px 3px 0 #8A7264",
            }}
          >
            追加する
          </button>
        </div>
      </form>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#3E3831] mb-1">
              Amazon URL を貼り付け
              <span className="ml-1 text-xs font-normal text-gray-400">
                （1行に1つ。タイトルだけの行も可）
              </span>
            </label>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              disabled={bulkRunning}
              rows={6}
              placeholder={
                "https://www.amazon.co.jp/dp/...\nhttps://www.amazon.co.jp/dp/...\n吾輩は猫である"
              }
              className="w-full border border-[#3E383159] bg-white text-[#3E3831] rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#DFA37E] focus:border-transparent transition resize-y disabled:opacity-60"
            />
          </div>

          {/* Finish toggle (applies to all) */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className={`relative w-10 h-6 rounded-full transition-colors ${
                bulkFinish ? "bg-[#DFA37E]" : "bg-[#E2DED2]"
              }`}
              onClick={() => !bulkRunning && setBulkFinish((v) => !v)}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                  bulkFinish ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </div>
            <span className="text-sm font-medium text-[#3E3831]">
              すべて読了済みとして追加
            </span>
          </label>

          {/* Per-line progress */}
          {bulkLines.length > 0 && (
            <div className="max-h-44 overflow-y-auto rounded-md border border-[#3E383159] divide-y divide-[#3E383122]">
              {bulkLines.map((line, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs"
                >
                  <span className="flex-shrink-0 w-4 text-center">
                    {line.status === "pending" && <span className="text-gray-300">・</span>}
                    {line.status === "loading" && (
                      <span className="inline-block w-3 h-3 border-2 border-[#C9805B] border-t-transparent rounded-full animate-spin align-middle" />
                    )}
                    {line.status === "added" && <span className="text-green-600">✓</span>}
                    {line.status === "title_only" && <span className="text-[#C9805B]">✓</span>}
                    {line.status === "failed" && <span className="text-red-500">✕</span>}
                  </span>
                  <span className="truncate text-[#3E3831]" title={line.raw}>
                    {line.title ?? line.raw}
                  </span>
                </div>
              ))}
            </div>
          )}

          {bulkDone && (
            <p className="text-sm text-center" style={{ color: "#3E3831" }}>
              {(() => {
                const added = bulkLines.filter(
                  (l) => l.status === "added" || l.status === "title_only"
                ).length;
                const failed = bulkLines.filter((l) => l.status === "failed").length;
                return failed > 0
                  ? `${added}冊を追加しました（${failed}件は取得に失敗）`
                  : `${added}冊を追加しました 🎉`;
              })()}
            </p>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={resetAndClose}
              className="flex-1 py-2.5 border border-[#3E383159] text-[#8C8276] rounded-md text-sm font-medium hover:bg-[#FAF6EF] transition-colors"
            >
              {bulkDone ? "閉じる" : "キャンセル"}
            </button>
            <button
              type="button"
              onClick={
                bulkDone
                  ? () => {
                      // Clear for a fresh batch (avoid re-adding the same lines)
                      setBulkText("");
                      setBulkLines([]);
                      setBulkDone(false);
                    }
                  : handleBulkSubmit
              }
              disabled={bulkRunning || (!bulkDone && !bulkText.trim())}
              className="flex-1 py-2.5 rounded-md border text-sm font-semibold transition-transform active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "#DFA37E",
                borderColor: "#3E3831",
                color: "#3E3831",
                boxShadow: "3px 3px 0 #8A7264",
              }}
            >
              {bulkRunning
                ? "追加中…"
                : bulkDone
                ? "続けて追加"
                : "まとめて追加する"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
