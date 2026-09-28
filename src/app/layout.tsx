import type { Metadata } from "next";
import { Inter_Tight, Noto_Sans_JP } from "next/font/google";
import ThemeProvider from "@/shared/components/ThemeProvider";
import { ClickSpark } from "@/shared/components/block/click-spark";
import "./globals.css";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
});

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

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
    <html
      lang="ja"
      suppressHydrationWarning
      className={`${interTight.variable} ${notoSansJp.variable}`}
    >
      <body className="font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <ClickSpark sparkSize={8} sparkRadius={18} />
        </ThemeProvider>
      </body>
    </html>
  );
}
