import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { decodeBookshelfData } from "@/lib/url";
import { resolveShortId, SHORT_ID_PATTERN } from "@/lib/short-link";
import { OG_HEIGHT, OG_WIDTH, ShelfImage, textInImage, visibleBooks } from "./ShelfImage";

// 本棚のOGP画像を生成する。SNS / Slack に共有URLを貼ったときのサムネイル用。
//   ?s={短縮ID} … 通常はこちら（クローラーは長い画像URLを取得しないため）
//   ?d={本棚データ} … 短縮URLが使えないときのフォールバック
// 見た目は画面の本棚（ライトテーマ）に合わせている（ShelfImage.tsx）。本は全冊面出しで描く。

// クローラーは数秒で画像取得を諦めるので、表紙やフォントが遅ければ待たずに描く
const FETCH_TIMEOUT_MS = 1500;

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

// 描画する文字だけを含むサブセットを Google Fonts から取得（画面と同じ Inter Tight + Noto Sans JP）
async function loadFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  if (!text) return null;
  const cssRes = await fetchWithTimeout(
    `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`
  );
  if (!cssRes?.ok) return null;
  const match = (await cssRes.text()).match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
  if (!match) return null;
  const fontRes = await fetchWithTimeout(match[1]);
  if (!fontRes?.ok) return null;
  return fontRes.arrayBuffer();
}

// 読めないときはデフォルト画像にする（画像が出ないよりはよい）
async function resolveData(params: URLSearchParams): Promise<string | null> {
  const s = params.get("s");
  if (s && SHORT_ID_PATTERN.test(s)) {
    try {
      return await resolveShortId(s);
    } catch {
      return null;
    }
  }
  return params.get("d");
}

export async function GET(request: NextRequest) {
  const d = await resolveData(request.nextUrl.searchParams);
  const data = d ? decodeBookshelfData(d) : null;

  const name = data?.name ?? "私の本棚";
  // 画像では表紙が見えるように、全冊を面出しで並べる（画面での並べ方の設定は使わない）
  const books = (data?.books ?? []).map((b) => ({ ...b, display: "face-out" as const }));
  // 仕切りの設定（作者ごとの非表示・主キー・オン/オフ）は画面と同じにする
  const dividerOptions = data ?? {};

  const text = textInImage(name, books, dividerOptions);
  const latin = Array.from(new Set(text.replace(/[^\x20-\x7e]/g, ""))).join("");
  const shown = visibleBooks(books, dividerOptions);

  const [inter, noto, coverList] = await Promise.all([
    loadFont("Inter Tight", 600, latin),
    loadFont("Noto Sans JP", 600, text),
    Promise.all(shown.map((b) => loadCover(b.coverUrl))),
  ]);
  const covers = new Map(shown.map((b, i) => [b.id, coverList[i]]));

  const fonts = [
    inter && { name: "Inter Tight", data: inter, weight: 600 as const, style: "normal" as const },
    noto && { name: "Noto Sans JP", data: noto, weight: 600 as const, style: "normal" as const },
  ].filter((f) => !!f);

  return new ImageResponse(
    (
      <ShelfImage
        name={name}
        books={books}
        dividerOptions={dividerOptions}
        covers={covers}
        fontFamily={fonts.length ? fonts.map((f) => `"${f.name}"`).join(", ") : undefined}
      />
    ),
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: fonts.length ? fonts : undefined,
      headers: {
        // 画像の内容はデータだけで決まる（?s= もデータのハッシュ）
        "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
      },
    }
  );
}
