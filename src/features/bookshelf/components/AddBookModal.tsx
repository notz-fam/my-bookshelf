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

export default function AddBookModal({ isOpen, onClose, onAdd }: AddBookModalProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [previewCover, setPreviewCover] = useState<string | null>(null);
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether each field was auto-filled (so we can overwrite on re-lookup)
  const autoFilledRef = useRef({ name: false, author: false, category: false });

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
    onClose();
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
    </Modal>
  );
}
