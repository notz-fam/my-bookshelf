import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "私の本棚",
  description: "読んだ本をグラフィカルに管理して共有できる本棚アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
