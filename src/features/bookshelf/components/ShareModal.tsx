"use client";

import { useState } from "react";
import Modal from "@/shared/components/Modal";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareModal({ isOpen, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  const currentUrl =
    typeof window !== "undefined" ? window.location.href : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const el = document.createElement("textarea");
      el.value = currentUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
            value={currentUrl}
            className="w-full border border-[#3E383159] rounded-md px-4 py-3 pr-12 text-xs text-[#3E3831] bg-[#FAF6EF] focus:outline-none"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
        </div>

        <button
          onClick={handleCopy}
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

        <div className="text-center">
          <p className="text-xs" style={{ color: "#B0A698" }}>
            このURLにはあなたの本棚データがすべて含まれています
          </p>
        </div>
      </div>
    </Modal>
  );
}
