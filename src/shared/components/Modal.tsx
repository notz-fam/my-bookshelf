"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}

// Esc・オーバーレイクリック・フォーカストラップは Radix Dialog に委譲
export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
}: ModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        // grid-cols-[minmax(0,1fr)]: 中身（長いURLなど）の幅でグリッドの列がモーダルより広がらないようにする
        className="max-h-[90vh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-md"
        overlayClassName="backdrop-blur-sm"
      >
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription className={description ? undefined : "sr-only"}>
            {description ?? title}
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
