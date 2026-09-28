"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Scissors } from "lucide-react";
import Modal from "@/shared/components/Modal";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Spinner } from "@/shared/ui/spinner";
interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareModal({ isOpen, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  // 短縮URLは発行時の本棚データ（?d=）に紐づく。本棚を変えたら使わない
  const [shortLink, setShortLink] = useState<{ d: string; url: string } | null>(null);
  const [shortening, setShortening] = useState(false);
  const [shortenError, setShortenError] = useState(false);

  const currentUrl =
    typeof window !== "undefined" ? window.location.href : "";
  const currentData =
    typeof window !== "undefined"
      ? new URL(window.location.href).searchParams.get("d")
      : null;
  const shortUrl =
    shortLink && shortLink.d === currentData ? shortLink.url : null;

  // The short URL is preferred for sharing once generated
  const shareUrl = shortUrl ?? currentUrl;

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for browsers without clipboard API
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShorten = async () => {
    if (!currentData) return;
    setShortening(true);
    setShortenError(false);
    try {
      const res = await fetch("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ d: currentData }),
      });
      if (!res.ok) throw new Error("shorten failed");
      const data = (await res.json()) as { shortUrl?: string };
      if (!data.shortUrl) throw new Error("no short url");
      setShortLink({ d: currentData, url: data.shortUrl });
      await copyText(data.shortUrl);
    } catch {
      setShortenError(true);
    } finally {
      setShortening(false);
    }
  };
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="本棚を共有する"
      description="下のURLを共有すると、あなたの本棚を相手に見せることができます。本を追加・変更するたびにURLが自動で更新されます。"
    >
      <div className="space-y-3">
        <motion.div layout>
          <Input
            type="text"
            readOnly
            value={shareUrl}
            className="h-10 font-mono text-xs"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
        </motion.div>

        <Button
          onClick={() => copyText(shareUrl)}
          size="lg"
          className="w-full overflow-hidden"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={copied ? "copied" : "copy"}
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-2"
            >
              {copied ? <Check /> : <Copy />}
              {copied ? "コピーしました" : "URLをコピー"}
            </motion.span>
          </AnimatePresence>
        </Button>

        {/* Short link: useful when the full URL is too long for Slack etc. */}
        <AnimatePresence initial={false}>
          {!shortUrl && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Button
                variant="outline"
                onClick={handleShorten}
                disabled={shortening || !currentData}
                className="w-full"
              >
                {shortening ? <Spinner /> : <Scissors />}
                {shortening ? "発行中…" : "短縮URLを発行"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {shortenError && (
          <motion.p
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: [6, -4, 2, 0] }}
            className="text-xs text-center text-destructive"
          >
            短縮URLの発行に失敗しました。時間をおいて再度お試しください。
          </motion.p>
        )}

        <p className="text-xs text-center text-muted-foreground">
          {shortUrl
            ? "短縮URLは元のURL（本棚データ）へ転送されます"
            : "このURLにはあなたの本棚データがすべて含まれています"}
        </p>
      </div>
    </Modal>
  );
}
