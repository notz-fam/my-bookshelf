import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { decodeBookshelfData } from "@/lib/url";
import type { Book } from "@/features/bookshelf/types";

// 共有URL（?d=）から本棚のOGP画像を生成する。
// SNS / Slack に共有URLを貼ったときのサムネイル用。

const WIDTH = 1200;
const HEIGHT = 630;
const MAX_BOOKS = 7;
const COVER_W = 118;
const COVER_H = 172;
const FETCH_TIMEOUT_MS = 3000;

// 表紙が無い本の色（globals.css の --spine-* に近いトーン）
const SPINE_COLORS = [
  { bg: "#7c3a2d", fg: "#f6e7d8" },
  { bg: "#2f4a3a", fg: "#e7efe4" },
  { bg: "#27415e", fg: "#e3ebf5" },
  { bg: "#8a6a2f", fg: "#fbf1dc" },
  { bg: "#4b3b5c", fg: "#ece4f3" },
  { bg: "#5a5a52", fg: "#f1f0ea" },
];

async function fetchWithTimeout(url: string): Promise<Response | null> {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch {
    return null;
  }
}

// 表紙を data URI にして埋め込む（satori に外部URLを渡すと、失敗時に画像全体が落ちるため）
async function loadCover(url: string | undefined): Promise<string | null> {
  if (!url) return null;
  const res = await fetchWithTimeout(url);
  if (!res?.ok) return null;
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  // Amazon は表紙が無いとき 1x1 の GIF を返す
  if (buf.byteLength < 1000) return null;
  return `data:${type};base64,${buf.toString("base64")}`;
}

// 描画する文字だけを含む Noto Sans JP のサブセットを取得
async function loadFont(text: string): Promise<ArrayBuffer | null> {
  const cssRes = await fetchWithTimeout(
    `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&text=${encodeURIComponent(text)}`
  );
  if (!cssRes?.ok) return null;
  const match = (await cssRes.text()).match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
  if (!match) return null;
  const fontRes = await fetchWithTimeout(match[1]);
  if (!fontRes?.ok) return null;
  return fontRes.arrayBuffer();
}

function BookCard({ book, cover, index }: { book: Book; cover: string | null; index: number }) {
  if (cover) {
    return (
      // next/image は satori では使えない
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={cover}
        alt={book.name}
        width={COVER_W}
        height={COVER_H}
        style={{
          objectFit: "cover",
          borderRadius: 4,
          boxShadow: "0 10px 20px rgba(0,0,0,0.35)",
          opacity: book.finish ? 1 : 0.75,
        }}
      />
    );
  }
  const color = SPINE_COLORS[index % SPINE_COLORS.length];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: COVER_W,
        height: COVER_H,
        padding: 12,
        borderRadius: 4,
        background: color.bg,
        color: color.fg,
        fontSize: 18,
        lineHeight: 1.3,
        textAlign: "center",
        boxShadow: "0 10px 20px rgba(0,0,0,0.35)",
        opacity: book.finish ? 1 : 0.75,
        overflow: "hidden",
      }}
    >
      {book.name.length > 28 ? `${book.name.slice(0, 27)}…` : book.name}
    </div>
  );
}

export async function GET(request: NextRequest) {
  const d = request.nextUrl.searchParams.get("d");
  const data = d ? decodeBookshelfData(d) : null;

  const name = data?.name ?? "私の本棚";
  const books = data?.books ?? [];
  const shown = books.slice(0, MAX_BOOKS);
  const rest = books.length - shown.length;
  const finished = books.filter((b) => b.finish).length;

  const subtitle =
    books.length === 0
      ? "読んだ本を本棚に並べて共有しよう"
      : `${books.length}冊` + (finished < books.length ? ` · 読了 ${finished}冊` : "");

  const covers = await Promise.all(shown.map((b) => loadCover(b.coverUrl)));

  const text =
    ["私の本棚", name, subtitle, `ほか${rest}冊`, "…", ...shown.map((b) => b.name)].join("") +
    "0123456789";
  const font = await loadFont(text);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(160deg, #f7f1e6 0%, #efe4d0 100%)",
          fontFamily: font ? "Noto Sans JP" : undefined,
          color: "#3b2a1a",
        }}
      >
        {/* 見出し */}
        <div style={{ display: "flex", flexDirection: "column", padding: "48px 64px 0" }}>
          <div style={{ display: "flex", fontSize: 26, color: "#8a6a4a" }}>私の本棚</div>
          <div
            style={{
              display: "flex",
              fontSize: 60,
              marginTop: 4,
              maxWidth: WIDTH - 128,
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </div>
          <div style={{ display: "flex", fontSize: 28, marginTop: 8, color: "#6b5238" }}>
            {subtitle}
          </div>
        </div>

        {/* 棚 */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", padding: "0 48px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 14,
              height: 220,
              padding: "0 24px",
              background: "#5b3d24",
              borderRadius: "12px 12px 0 0",
              boxShadow: "inset 0 12px 24px rgba(0,0,0,0.45)",
            }}
          >
            {shown.map((book, i) => (
              <BookCard key={i} book={book} cover={covers[i]} index={i} />
            ))}
            {rest > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: COVER_H,
                  marginLeft: 8,
                  fontSize: 26,
                  color: "#f3e3cc",
                }}
              >
                {`ほか${rest}冊`}
              </div>
            )}
          </div>
          {/* 棚板 */}
          <div style={{ display: "flex", height: 28, background: "#8b5e3c", boxShadow: "0 6px 12px rgba(0,0,0,0.3)" }} />
        </div>
        <div style={{ display: "flex", height: 40 }} />
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: font ? [{ name: "Noto Sans JP", data: font, weight: 700, style: "normal" }] : undefined,
      headers: {
        // 画像の内容は d パラメータだけで決まる
        "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
      },
    }
  );
}
