"use client";

import { useState } from "react";
import Modal from "@/shared/components/Modal";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareModal({ isOpen, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [shortening, setShortening] = useState(false);
  const [shortenError, setShortenError] = useState(false);

  const currentUrl =
    typeof window !== "undefined" ? window.location.href : "";

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
    setShortening(true);
    setShortenError(false);
    try {
      const res = await fetch(
        `/api/shorten?url=${encodeURIComponent(currentUrl)}`
      );
      if (!res.ok) throw new Error("shorten failed");
      const data = (await res.json()) as { shortUrl?: string };
      if (!data.shortUrl) throw new Error("no short url");
      setShortUrl(data.shortUrl);
      await copyText(data.shortUrl);
    } catch {
      setShortenError(true);
    } finally {
      setShortening(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="本棚を共有する">
      <div className="space-y-4">
        <p className="text-sm" style={{ color: "#8C8276" }}>
          下のURLを共有すると、あなたの本棚を相手に見せることができます。
          <br />
          本を追加・変更するたびにURLが自動で更新されます。
        </p>

        <div className="relative">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="w-full border border-[#3E383159] rounded-md px-4 py-3 pr-12 text-xs text-[#3E3831] bg-[#FAF6EF] focus:outline-none"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
        </div>

        <button
          onClick={() => copyText(shareUrl)}
          className="w-full py-3 rounded-md border text-sm font-semibold transition-transform active:translate-x-0.5 active:translate-y-0.5"
          style={
            copied
              ? {
                  background: "#3E3831",
                  borderColor: "#3E3831",
                  color: "#F7F1E6",
                  boxShadow: "3px 3px 0 #8A7264",
                }
              : {
                  background: "#DFA37E",
                  borderColor: "#3E3831",
                  color: "#3E3831",
                  boxShadow: "3px 3px 0 #8A7264",
                }
          }
        >
          {copied ? "✓ コピーしました！" : "🔗 URLをコピー"}
        </button>

        {/* Short link: useful when the full URL is too long for Slack etc. */}
        {!shortUrl && (
          <button
            onClick={handleShorten}
            disabled={shortening}
            className="w-full py-2.5 rounded-md border text-sm font-semibold transition-transform active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-60"
            style={{
              background: "#FAF6EF",
              borderColor: "#3E3831",
              color: "#3E3831",
              boxShadow: "3px 3px 0 #8A7264",
            }}
          >
            {shortening ? "発行中…" : "✂️ 短縮URLを発行（Slackなどで長すぎる場合）"}
          </button>
        )}

        {shortenError && (
          <p className="text-xs text-center" style={{ color: "#C0594B" }}>
            短縮URLの発行に失敗しました。時間をおいて再度お試しください。
          </p>
        )}

        <div className="text-center">
          <p className="text-xs" style={{ color: "#B0A698" }}>
            {shortUrl
              ? "短縮URLは元のURL（本棚データ）へ転送されます"
              : "このURLにはあなたの本棚データがすべて含まれています"}
          </p>
        </div>
      </div>
    </Modal>
  );
}
