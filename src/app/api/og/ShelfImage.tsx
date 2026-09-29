import type { Book } from "@/features/bookshelf/types";
import {
  AUTHOR_DIVIDER_HEIGHT,
  AUTHOR_DIVIDER_WIDTH,
  BOOK_GAP,
  buildChunks,
  CATEGORY_DIVIDER_HEIGHT,
  CATEGORY_DIVIDER_WIDTH,
  type Decoration,
  type DividerItem,
  FACE_OUT_HEIGHT,
  FRAME_BORDER,
  FRAME_WIDTH,
  getBookDisplay,
  getBookWidth,
  getDecoration,
  getSpineColorIndex,
  getSpineHeight,
  packIntoRows,
  SHELF_HEIGHT,
  SHELF_PADDING_X,
} from "@/features/bookshelf/shelf-layout";
import { LIGHT, LIGHT_SPINES, oklch } from "./theme";

// OGP画像の本棚。画面の Bookshelf / BookItem / BookshelfHeader（ライトテーマ）と同じ見た目を
// satori で描けるスタイルに置き換えたもの。レイアウトの計算は shelf-layout.ts を共有している。

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const PAGE_PADDING_X = 48;
const HEADER_HEIGHT = 96;
/** 棚は画面の px 値をこの倍率で拡大して描く（本棚の外枠が画像の横幅いっぱいになる） */
const S = (OG_WIDTH - PAGE_PADDING_X * 2) / FRAME_WIDTH;
const px = (n: number) => Math.round(n * S * 10) / 10;

const C = {
  background: oklch(LIGHT.background),
  foreground: oklch(LIGHT.foreground),
  primary: oklch(LIGHT.primary),
  primaryForeground: oklch(LIGHT.primaryForeground),
  secondary: oklch(LIGHT.secondary),
  secondaryForeground: oklch(LIGHT.secondaryForeground),
  muted: oklch(LIGHT.muted),
  mutedForeground: oklch(LIGHT.mutedForeground),
  border: oklch(LIGHT.border),
  shelfFrame: oklch(LIGHT.shelfFrame),
  shelfBack: oklch(LIGHT.shelfBack),
  shelfPlank: oklch(LIGHT.shelfPlank),
  dividerCategory: oklch(LIGHT.dividerCategory),
  dividerAuthor: oklch(LIGHT.dividerAuthor),
  dividerFg: oklch(LIGHT.dividerFg),
};

// ---------- アイコン（lucide-react と同じパス） ----------

const ICONS = {
  library: ["m16 6 4 14", "M12 6v14", "M8 8v12", "M4 4v16"],
  bookOpen: [
    "M12 5v16",
    "M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z",
  ],
  bookDashed: [
    "M12 17h1.5",
    "M12 22h1.5",
    "M12 2h1.5",
    "M17.5 22H19a1 1 0 0 0 1-1",
    "M17.5 2H19a1 1 0 0 1 1 1v1.5",
    "M20 14v3h-2.5",
    "M20 8.5V10",
    "M4 10V8.5",
    "M4 19.5V14",
    "M4 4.5A2.5 2.5 0 0 1 6.5 2H8",
    "M8 22H6.5a1 1 0 0 1 0-5H8",
  ],
};

function Icon({ name, size, color }: { name: keyof typeof ICONS; size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

// ---------- 縦書き ----------
// satori は writing-mode に対応していないので、1文字幅で折り返して縦に積む。
// 英数字と長音・括弧などは、画面（vertical-rl / mixed）と同じく90度寝かせる。

const ROTATED_CHARS = new Set("ー－—―〜～…‥（）「」『』【】〈〉《》()[]-=");
// 英数字の幅（em）のおおよその値。寝かせた文字の送り量に使う
function latinAdvance(ch: string): number {
  if (/[ .,'!|:;ijlI]/.test(ch)) return 0.28;
  if (/[ftr]/.test(ch)) return 0.36;
  if (/[mwMW]/.test(ch)) return 0.9;
  if (/[A-Z]/.test(ch)) return 0.7;
  if (/[0-9]/.test(ch)) return 0.58;
  return 0.57;
}
// 小書きの仮名は縦書きでは右上に寄る
const SMALL_KANA = new Set("ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ");

interface Glyph {
  ch: string;
  rotated: boolean;
  small: boolean;
  advance: number;
}

function toGlyphs(text: string): Glyph[] {
  return Array.from(text).map((ch) => {
    const latin = ch.charCodeAt(0) < 0x2000;
    return {
      ch,
      rotated: latin || ROTATED_CHARS.has(ch),
      small: SMALL_KANA.has(ch),
      advance: latin ? latinAdvance(ch) : 1,
    };
  });
}

/** 縦書きテキスト。maxHeight を超えたら左の行へ折り返す（break-all 相当） */
function VerticalText({
  text,
  fontSize,
  color,
  maxHeight,
  maxColumns,
}: {
  text: string;
  fontSize: number;
  color: string;
  maxHeight: number;
  maxColumns: number;
}) {
  const lineWidth = fontSize * 1.25;
  const columns: Glyph[][] = [[]];
  let used = 0;
  for (const g of toGlyphs(text)) {
    const h = g.advance * fontSize;
    if (used + h > maxHeight && columns[columns.length - 1].length > 0) {
      columns.push([]);
      used = 0;
    }
    columns[columns.length - 1].push(g);
    used += h;
  }

  // 描画のノード数を減らすため、同じ向きの文字はまとめて1つのテキストにする
  const textStyle = { fontSize, lineHeight: 1, color };
  return (
    <div style={{ display: "flex", flexDirection: "row-reverse", maxHeight, overflow: "hidden" }}>
      {columns.slice(0, maxColumns).map((col, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", width: lineWidth }}>
          {toRuns(col).map((run, j) => {
            const h = run.advance * fontSize;
            if (run.kind === "rotated") {
              // 「横幅 h × 高さ lineWidth」の箱を枠の中心で90度回す
              return (
                <div key={j} style={{ display: "flex", position: "relative", width: lineWidth, height: h }}>
                  <div
                    style={{
                      ...textStyle,
                      position: "absolute",
                      display: "flex",
                      alignItems: "center",
                      left: (lineWidth - h) / 2,
                      top: (h - lineWidth) / 2,
                      width: h,
                      height: lineWidth,
                      whiteSpace: "nowrap",
                      transform: "rotate(90deg)",
                    }}
                  >
                    {run.text}
                  </div>
                </div>
              );
            }
            // 1文字分の幅で折り返させて、縦に1文字ずつ並べる
            return (
              <div
                key={j}
                style={{
                  ...textStyle,
                  display: "flex",
                  justifyContent: "center",
                  width: lineWidth,
                  height: h,
                  textAlign: "center",
                  wordBreak: "break-all",
                  ...(run.kind === "small" && { marginLeft: fontSize * 0.12, marginTop: -fontSize * 0.12, marginBottom: fontSize * 0.12 }),
                }}
              >
                {run.text}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

interface Run {
  kind: "upright" | "small" | "rotated";
  text: string;
  advance: number;
}

function toRuns(glyphs: Glyph[]): Run[] {
  const runs: Run[] = [];
  for (const g of glyphs) {
    const kind = g.rotated ? "rotated" : g.small ? "small" : "upright";
    const last = runs[runs.length - 1];
    if (last && last.kind === kind && kind !== "small") {
      last.text += g.ch;
      last.advance += g.advance;
    } else {
      runs.push({ kind, text: g.ch, advance: g.advance });
    }
  }
  return runs;
}

// ---------- 本 ----------

function spineColors(book: Book) {
  const spine = LIGHT_SPINES[getSpineColorIndex(book) - 1];
  // 積読は画面では saturate-50 opacity-80
  const chromaScale = book.finish ? 1 : 0.5;
  return {
    bg: oklch(spine.bg, { chromaScale }),
    fg: oklch(spine.fg, { chromaScale }),
    accent: oklch(spine.fg, { alpha: 0.4 }),
  };
}

function SpineDecoration({
  decoration,
  accent,
  position,
}: {
  decoration: Decoration;
  accent: string;
  position: "top" | "bottom";
}) {
  if (decoration === "plain") return <div style={{ display: "flex" }} />;
  if (decoration === "bands") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: px(4), width: "100%" }}>
        <div style={{ height: px(4), width: "100%", background: accent }} />
        <div style={{ height: px(2), width: "100%", background: accent }} />
      </div>
    );
  }
  if (decoration === "lines") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: px(2), width: "100%" }}>
        <div style={{ height: Math.max(1, px(1)), width: "100%", background: accent }} />
        <div style={{ height: Math.max(1, px(1)), width: "100%", background: accent }} />
      </div>
    );
  }
  if (decoration === "dots") {
    return (
      <div style={{ display: "flex", justifyContent: "center", gap: px(4) }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: px(4), height: px(4), borderRadius: 999, background: accent }} />
        ))}
      </div>
    );
  }
  if (position === "top") {
    return (
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          style={{
            width: px(16),
            height: px(20),
            borderRadius: px(3),
            border: `1px solid ${accent}`,
            background: "rgba(0, 0, 0, 0.15)",
          }}
        />
      </div>
    );
  }
  return <div style={{ height: px(2), width: "100%", background: accent }} />;
}

function Spine({ book }: { book: Book }) {
  const { bg, fg, accent } = spineColors(book);
  const height = getSpineHeight(book);
  const decoration = getDecoration(book);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height: px(height),
        padding: `${px(10)}px ${px(4)}px ${px(8)}px`,
        borderRadius: `${px(4)}px ${px(4)}px 0 0`,
        background: bg,
        // 画面の inset shadow（左に影・右にハイライト）を border で描く（satori では shadow が重いため）
        borderLeft: `${px(3)}px solid rgba(0, 0, 0, 0.18)`,
        borderRight: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      <SpineDecoration decoration={decoration} accent={accent} position="top" />
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <VerticalText
          text={book.name}
          fontSize={px(11)}
          color={fg}
          maxHeight={px(height - 60)}
          maxColumns={Math.max(1, Math.floor((getBookWidth(book) - 8) / 14))}
        />
      </div>
      <SpineDecoration decoration={decoration} accent={accent} position="bottom" />
    </div>
  );
}

function FaceOut({ book, cover }: { book: Book; cover: string | null }) {
  const { bg, fg, accent } = spineColors(book);
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: "100%",
        height: px(FACE_OUT_HEIGHT),
        borderRadius: px(4),
        overflow: "hidden",
        // 画面より影のぼかしを小さくしている（satori ではぼかしが大きいほど描画が重い）
        boxShadow: `0 ${px(6)}px ${px(8)}px -${px(4)}px rgba(0, 0, 0, 0.35)`,
        border: "1px solid rgba(0, 0, 0, 0.1)",
      }}
    >
      {cover ? (
        // next/image は satori では使えない
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt={book.name}
          width={px(getBookWidth(book))}
          height={px(FACE_OUT_HEIGHT)}
          style={{ objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            padding: px(8),
            background: bg,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: px(6),
              borderRadius: px(2),
              border: `1px solid ${accent}`,
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: px(12),
              lineHeight: 1.25,
              textAlign: "center",
              color: fg,
              maxHeight: px(12) * 1.25 * 5,
              overflow: "hidden",
            }}
          >
            {book.name}
          </div>
        </div>
      )}
      {/* 光沢 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(to top right, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0) 50%, rgba(255, 255, 255, 0.15))",
        }}
      />
    </div>
  );
}

function BookView({ book, cover }: { book: Book; cover: string | null }) {
  const faceOut = getBookDisplay(book) === "face-out";
  return (
    <div style={{ display: "flex", position: "relative", flexDirection: "column", width: px(getBookWidth(book)) }}>
      <div style={{ display: "flex", flexDirection: "column", opacity: book.finish ? 1 : 0.8 }}>
        {faceOut ? <FaceOut book={book} cover={cover} /> : <Spine book={book} />}
      </div>
      {/* 積読バッジ */}
      {!book.finish && (
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: -px(6),
            left: -px(8),
            width: px(20),
            height: px(20),
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            border: `1px solid ${C.border}`,
            background: C.muted,
          }}
        >
          <Icon name="bookDashed" size={px(12)} color={C.mutedForeground} />
        </div>
      )}
    </div>
  );
}

function Divider({ divider }: { divider: DividerItem }) {
  const isCategory = divider.kind === "category";
  const width = isCategory ? CATEGORY_DIVIDER_WIDTH : AUTHOR_DIVIDER_WIDTH;
  const height = isCategory ? CATEGORY_DIVIDER_HEIGHT : AUTHOR_DIVIDER_HEIGHT;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: px(width),
        height: px(height),
        padding: `${px(8)}px 0`,
        borderRadius: `${px(10)}px ${px(10)}px 0 0`,
        border: `1px solid ${C.border}`,
        borderBottom: "none",
        background: isCategory ? C.dividerCategory : C.dividerAuthor,
      }}
    >
      {/* 仕切り板の指穴 */}
      <div
        style={{
          width: px(7),
          height: px(7),
          marginBottom: px(8),
          borderRadius: 999,
          background: oklch(LIGHT.foreground, { alpha: 0.7 }),
        }}
      />
      <VerticalText
        text={divider.label}
        fontSize={px(isCategory ? 12 : 11)}
        color={C.dividerFg}
        maxHeight={px(height - 40)}
        maxColumns={1}
      />
    </div>
  );
}

// ---------- 棚 ----------

function EmptyShelf() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "center", width: "100%" }}>
      <div
        style={{
          display: "flex",
          width: px(48),
          height: px(48),
          marginBottom: px(12),
          alignItems: "center",
          justifyContent: "center",
          borderRadius: px(14),
          border: `1px solid ${C.border}`,
          background: C.background,
        }}
      >
        <Icon name="bookOpen" size={px(20)} color={C.mutedForeground} />
      </div>
      <div style={{ display: "flex", fontSize: px(16), color: C.foreground }}>まだ本が登録されていません</div>
    </div>
  );
}

function Shelf({
  books,
  hiddenAuthors,
  covers,
}: {
  books: Book[];
  hiddenAuthors: string[];
  covers: Map<number, string | null>;
}) {
  const rows = visibleRows(books, hiddenAuthors);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: px(FRAME_WIDTH),
        padding: `${px(FRAME_BORDER)}px ${px(FRAME_BORDER)}px 0`,
        borderRadius: px(16),
        border: `1px solid ${C.border}`,
        background: C.shelfFrame,
        // 画面の外枠の影は枠の下に出る。画像では枠の下端が切れていて見えないので描かない
      }}
    >
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} style={{ display: "flex", flexDirection: "column" }}>
          {/* 棚の内部（背板） */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              height: px(SHELF_HEIGHT),
              padding: `0 ${px(SHELF_PADDING_X)}px`,
              gap: px(BOOK_GAP),
              borderRadius: `${px(8)}px ${px(8)}px 0 0`,
              background: C.shelfBack,
              // 画面の inset shadow と上の棚板の影の代わりに、上端のグラデーション（satori では shadow が重いため）
              backgroundImage: `linear-gradient(to bottom, rgba(0, 0, 0, 0.09), rgba(0, 0, 0, 0) ${px(20)}px)`,
            }}
          >
            {row.map(({ dividers, book }) => (
              <div key={book.id} style={{ display: "flex", alignItems: "flex-end", gap: px(BOOK_GAP) }}>
                {dividers.map((d) => (
                  <Divider key={`${d.kind}-${d.label}`} divider={d} />
                ))}
                <BookView book={book} cover={covers.get(book.id) ?? null} />
              </div>
            ))}
            {books.length === 0 && rowIndex === 0 && <EmptyShelf />}
          </div>
          {/* 棚板 */}
          <div
            style={{
              height: px(14),
              width: "100%",
              background: C.shelfPlank,
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ---------- ヘッダー ----------

function Badge({ children, outline }: { children: string; outline?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "4px 14px",
        borderRadius: 999,
        fontSize: 22,
        border: `1px solid ${outline ? C.border : "transparent"}`,
        background: outline ? "transparent" : C.secondary,
        color: outline ? C.foreground : C.secondaryForeground,
      }}
    >
      {children}
    </div>
  );
}

function Header({ name, books }: { name: string; books: Book[] }) {
  const finished = books.filter((b) => b.finish).length;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        height: HEADER_HEIGHT,
        padding: `0 ${PAGE_PADDING_X}px`,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          display: "flex",
          width: 56,
          height: 56,
          flexShrink: 0,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 14,
          background: C.primary,
        }}
      >
        <Icon name="library" size={28} color={C.primaryForeground} />
      </div>
      <div
        style={{
          display: "block",
          fontSize: 40,
          letterSpacing: -1,
          color: C.foreground,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          maxWidth: 760,
        }}
      >
        {name}
      </div>
      <Badge>{`${books.length} 冊`}</Badge>
      {/* 積読がある時だけ読了数を出す（画面と同じ） */}
      {finished < books.length && <Badge outline>{`読了 ${finished}`}</Badge>}
    </div>
  );
}

// ---------- 全体 ----------

export function ShelfImage({
  name,
  books,
  hiddenAuthors,
  covers,
  fontFamily,
}: {
  name: string;
  books: Book[];
  hiddenAuthors: string[];
  covers: Map<number, string | null>;
  fontFamily?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: C.background,
        color: C.foreground,
        fontFamily,
      }}
    >
      <Header name={name} books={books} />
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 32 }}>
        <Shelf books={books} hiddenAuthors={hiddenAuthors} covers={covers} />
      </div>
    </div>
  );
}

/** 画像に写る段（1段目と、途中まで見える2段目）。それより下は描かない（描画が重くなるだけ） */
function visibleRows(books: Book[], hiddenAuthors: string[]) {
  return packIntoRows(buildChunks(books, hiddenAuthors)).slice(0, 2);
}

/** 画像に写る本（表紙を取得する対象） */
export function visibleBooks(books: Book[], hiddenAuthors: string[]): Book[] {
  return visibleRows(books, hiddenAuthors).flatMap((row) => row.map((c) => c.book));
}

/** 画像に描く文字（フォントのサブセット取得用） */
export function textInImage(name: string, books: Book[], hiddenAuthors: string[]): string {
  const labels = visibleRows(books, hiddenAuthors)
    .flatMap((row) => row.flatMap((c) => [...c.dividers.map((d) => d.label), c.book.name]));
  return [name, "冊読了", "まだ本が登録されていません", ...labels].join("") + "0123456789 ";
}
