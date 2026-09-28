import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import BookshelfClient from "@/features/bookshelf/components/BookshelfClient";
import { decodeBookshelfData } from "@/lib/url";
import { Spinner } from "@/shared/ui/spinner";

const DEFAULT_TITLE = "私の本棚";
const DEFAULT_DESCRIPTION = "読んだ本をグラフィカルに管理して共有できる本棚アプリ";

// 共有URL（?d=）を開いたとき、SNS / Slack のプレビューに本棚の名前と画像を出す
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const { d } = await searchParams;
  const encoded = typeof d === "string" ? d : null;
  const data = encoded ? decodeBookshelfData(encoded) : null;

  // OGP画像は絶対URLが必要なので、リクエストのホストから組み立てる
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const title = data ? `${data.name} | ${DEFAULT_TITLE}` : DEFAULT_TITLE;
  const description = data
    ? `${data.books.length}冊の本が並んだ本棚` +
      (data.books.length > 0
        ? `：${data.books.slice(0, 3).map((b) => `『${b.name}』`).join("")}${data.books.length > 3 ? "ほか" : ""}`
        : "")
    : DEFAULT_DESCRIPTION;
  const image = `${origin}/api/og${data && encoded ? `?d=${encodeURIComponent(encoded)}` : ""}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default function BookshelfPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center gap-2 text-muted-foreground">
          <Spinner className="size-5" />
          <span className="text-sm">読み込み中…</span>
        </div>
      }
    >
      <BookshelfClient />
    </Suspense>
  );
}
