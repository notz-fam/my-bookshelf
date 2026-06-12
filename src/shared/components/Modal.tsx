"use client";

import { useEffect, type ReactNode } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(62, 56, 49, 0.45)" }}
        onClick={onClose}
      />
      {/* 紙コラージュ風: 白い紙＋インク線＋ずらし影 */}
      <div
        className="relative bg-white rounded-lg border w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
        style={{ borderColor: "#3E3831", boxShadow: "6px 6px 0 #8A7264" }}
      >
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "rgba(62, 56, 49, 0.2)" }}
        >
          <h2 className="text-xl font-bold" style={{ color: "#3E3831" }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md transition-colors text-lg hover:bg-[#E6DCC8]"
            style={{ color: "#8C8276" }}
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
