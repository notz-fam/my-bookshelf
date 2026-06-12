import { Suspense } from "react";
import BookshelfClient from "@/features/bookshelf/components/BookshelfClient";

export const metadata = {
  title: "私の本棚",
  description: "読んだ本をグラフィカルに管理して共有できる本棚アプリ",
};

export default function BookshelfPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "#FAF6EF" }}
        >
          <div className="text-lg" style={{ color: "#8C8276" }}>
            読み込み中…
          </div>
        </div>
      }
    >
      <BookshelfClient />
    </Suspense>
  );
}
