"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, Check, CircleDashed, Sparkles, X } from "lucide-react";
import Modal from "@/shared/components/Modal";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { Spinner } from "@/shared/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { extractAsinFromUrl, getAmazonCoverUrl } from "@/lib/url";
import type { Book } from "../types";
import type { BookLookupResult } from "@/lib/book-lookup";

interface AddBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (book: Omit<Book, "id">) => void;
  /** 指定すると編集モード（1冊フォームのみ・既存値を初期表示） */
  editingBook?: Book | null;
  onUpdate?: (id: number, updates: Omit<Book, "id">) => void;
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

export default function AddBookModal({
  isOpen,
  onClose,
  onAdd,
  editingBook,
  onUpdate,
}: AddBookModalProps) {
  const [mode, setMode] = useState<Mode>("single");
  const [form, setForm] = useState(EMPTY_FORM);
  const [previewCover, setPreviewCover] = useState<string | null>(null);

  // 編集対象が切り替わったらフォームに既存値を流し込む
  const [prevEditingBook, setPrevEditingBook] = useState<Book | null>(null);
  if ((editingBook ?? null) !== prevEditingBook) {
    setPrevEditingBook(editingBook ?? null);
    if (editingBook) {
      setMode("single");
      setForm({
        name: editingBook.name,
        author: editingBook.author ?? "",
        category: editingBook.category ?? "",
        amazonUrl: editingBook.amazonUrl ?? "",
        coverUrl: editingBook.coverUrl ?? "",
        finish: editingBook.finish,
      });
      setPreviewCover(editingBook.coverUrl ?? null);
    }
  }
  const isEditing = !!editingBook;
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

    const book = {
      name,
      author: form.author.trim() || null,
      category: form.category.trim() || null,
      amazonUrl: form.amazonUrl.trim() || undefined,
      coverUrl: form.coverUrl.trim() || undefined,
      finish: form.finish,
    };
    if (editingBook) {
      // display など、フォームに無い項目は保持する
      onUpdate?.(editingBook.id, { ...book, display: editingBook.display });
    } else {
      onAdd(book);
    }

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
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Spinner className="size-3" />
          書籍情報を取得中…
        </span>
      );
    if (lookupStatus === "found")
      return (
        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <Sparkles className="size-3" />
          書籍情報を自動入力しました
        </span>
      );
    if (lookupStatus === "not_found")
      return (
        <span className="text-muted-foreground">
          書籍情報が見つかりませんでした。タイトルは手動で入力してください
        </span>
      );
    if (lookupStatus === "error")
      return (
        <span className="flex items-center gap-1.5 text-destructive">
          <AlertCircle className="size-3" />
          取得中にエラーが発生しました
        </span>
      );
    return null;
  };

  const bulkStatusIcon = (status: BulkLineStatus) => {
    switch (status) {
      case "pending":
        return <CircleDashed className="size-3.5 text-muted-foreground/50" />;
      case "loading":
        return <Spinner className="size-3.5 text-muted-foreground" />;
      case "added":
        return <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />;
      case "title_only":
        return <Check className="size-3.5 text-muted-foreground" />;
      case "failed":
        return <X className="size-3.5 text-destructive" />;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title={isEditing ? "本を編集する" : "本を追加する"}>
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="gap-4">
        <TabsList className={isEditing ? "hidden" : "w-full"}>
          <TabsTrigger value="single">1冊ずつ</TabsTrigger>
          <TabsTrigger value="bulk">まとめて追加</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <motion.form
            onSubmit={handleSubmit}
            className="space-y-4"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Amazon URL */}
            <div className="space-y-1.5">
              <Label htmlFor="add-amazon-url">
                Amazon URL
                <span className="text-xs font-normal text-muted-foreground">
                  （タイトル・カテゴリ・表紙を自動取得）
                </span>
              </Label>
              <Input
                id="add-amazon-url"
                type="url"
                value={form.amazonUrl}
                onChange={(e) => handleAmazonUrlChange(e.target.value)}
                placeholder="https://www.amazon.co.jp/dp/..."
              />
              <AnimatePresence mode="wait" initial={false}>
                {lookupStatus !== "idle" && (
                  <motion.p
                    key={lookupStatus}
                    className="text-xs"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                  >
                    {lookupIndicator()}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Book name */}
            <div className="space-y-1.5">
              <Label htmlFor="add-name">
                タイトル <span className="text-destructive">*</span>
              </Label>
              <Input
                id="add-name"
                type="text"
                value={form.name}
                onChange={(e) => {
                  autoFilledRef.current.name = false;
                  setForm((f) => ({ ...f, name: e.target.value }));
                }}
                placeholder="本のタイトルを入力"
                required
                maxLength={100}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Author */}
              <div className="space-y-1.5">
                <Label htmlFor="add-author">
                  作者
                  <span className="text-xs font-normal text-muted-foreground">（任意）</span>
                </Label>
                <Input
                  id="add-author"
                  type="text"
                  value={form.author}
                  onChange={(e) => {
                    autoFilledRef.current.author = false;
                    setForm((f) => ({ ...f, author: e.target.value }));
                  }}
                  placeholder="例：村上春樹"
                  maxLength={50}
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <Label htmlFor="add-category">
                  カテゴリ
                  <span className="text-xs font-normal text-muted-foreground">（任意）</span>
                </Label>
                <Input
                  id="add-category"
                  type="text"
                  value={form.category}
                  onChange={(e) => {
                    autoFilledRef.current.category = false;
                    setForm((f) => ({ ...f, category: e.target.value }));
                  }}
                  placeholder="例：小説、技術書"
                  maxLength={50}
                />
              </div>
            </div>

            {/* Cover preview (auto-set from Amazon URL) */}
            <AnimatePresence>
              {previewCover && (
                <motion.div
                  key={previewCover}
                  className="flex justify-center"
                  initial={{ opacity: 0, scale: 0.85, rotate: -4 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <div className="relative w-20 h-[110px] rounded-md overflow-hidden border shadow-lg">
                    <Image
                      src={previewCover}
                      alt="表紙プレビュー"
                      fill
                      className="object-cover"
                      unoptimized
                      onError={() => setCover(null)}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Finish toggle */}
            <div className="flex items-center gap-3">
              <Switch
                id="add-finish"
                checked={form.finish}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, finish: checked }))}
              />
              <Label htmlFor="add-finish" className="cursor-pointer">
                読了済み
              </Label>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={resetAndClose} className="flex-1">
                キャンセル
              </Button>
              <Button
                type="submit"
                disabled={!form.name.trim() || lookupStatus === "loading"}
                className="flex-1"
              >
                {isEditing ? "保存する" : "追加する"}
              </Button>
            </div>
          </motion.form>
        </TabsContent>

        <TabsContent value="bulk">
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="add-bulk">
                Amazon URL を貼り付け
                <span className="text-xs font-normal text-muted-foreground">
                  （1行に1つ。タイトルだけの行も可）
                </span>
              </Label>
              <Textarea
                id="add-bulk"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                disabled={bulkRunning}
                rows={6}
                placeholder={
                  "https://www.amazon.co.jp/dp/...\nhttps://www.amazon.co.jp/dp/...\n吾輩は猫である"
                }
                className="resize-y font-mono text-xs"
              />
            </div>

            {/* Finish toggle (applies to all) */}
            <div className="flex items-center gap-3">
              <Switch
                id="add-bulk-finish"
                checked={bulkFinish}
                disabled={bulkRunning}
                onCheckedChange={setBulkFinish}
              />
              <Label htmlFor="add-bulk-finish" className="cursor-pointer">
                すべて読了済みとして追加
              </Label>
            </div>

            {/* Per-line progress */}
            {bulkLines.length > 0 && (
              <div className="max-h-44 overflow-y-auto rounded-md border divide-y">
                {bulkLines.map((line, i) => (
                  <motion.div
                    key={i}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.4) }}
                  >
                    <span className="flex-shrink-0 w-4 flex justify-center">
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={line.status}
                          className="flex"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 20 }}
                        >
                          {bulkStatusIcon(line.status)}
                        </motion.span>
                      </AnimatePresence>
                    </span>
                    <span className="truncate" title={line.raw}>
                      {line.title ?? line.raw}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}

            <AnimatePresence>
              {bulkDone && (
                <motion.p
                  className="text-sm text-center"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {(() => {
                    const added = bulkLines.filter(
                      (l) => l.status === "added" || l.status === "title_only"
                    ).length;
                    const failed = bulkLines.filter((l) => l.status === "failed").length;
                    return failed > 0
                      ? `${added}冊を追加しました（${failed}件は取得に失敗）`
                      : `${added}冊を追加しました 🎉`;
                  })()}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={resetAndClose} className="flex-1">
                {bulkDone ? "閉じる" : "キャンセル"}
              </Button>
              <Button
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
                className="flex-1"
              >
                {bulkRunning && <Spinner />}
                {bulkRunning ? "追加中…" : bulkDone ? "続けて追加" : "まとめて追加する"}
              </Button>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </Modal>
  );
}
