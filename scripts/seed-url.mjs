// テスト用の本データを入れた状態で /bookshelf を開くためのURLを生成する。
//
// 使い方:
//   npm run seed                  → http://localhost:3000 用のURLを表示
//   npm run seed -- --port 3003   → ポート指定
//   npm run seed -- --open        → 既定のブラウザで開く（Windows）
//
// データはURLの ?d= に載るだけなので、開いた後に編集しても元データは汚れない。

import { exec } from "node:child_process";

// isbn は ISBN-10（AmazonのASINと同じ）。表紙画像とAmazonリンクの生成に使う。
// 全ISBNは表紙画像が実際に取得できることを確認済み。
// カテゴリ・作者の仕切りが見えるよう、カテゴリ→作者の順でまとめて並べている。
const RAW_BOOKS = [
  // 小説
  { id: 5, name: "こころ", category: "小説", author: "夏目漱石", finish: true, isbn: "4101010137" },
  { id: 13, name: "坊っちゃん", category: "小説", author: "夏目漱石", finish: true, isbn: "410101003X" },
  { id: 1, name: "ノルウェイの森", category: "小説", author: "村上春樹", finish: true, isbn: "4062748681" },
  { id: 9, name: "雪国", category: "小説", author: "川端康成", finish: true, isbn: "4101001014" },
  { id: 11, name: "羅生門", category: "小説", author: "芥川龍之介", finish: true, isbn: "4101025010" },
  // 銀河鉄道の夜（新潮文庫）はAmazonに表紙画像がないためOpen Libraryを使う
  {
    id: 7, name: "銀河鉄道の夜", category: "小説", author: "宮沢賢治", finish: true, display: "face-out",
    isbn: "4101092052",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9784101092058-L.jpg",
  },
  { id: 3, name: "三体", category: "小説", author: "劉慈欣", finish: false, display: "face-out", isbn: "4152098708" },
  // 技術書
  { id: 2, name: "リーダブルコード", category: "技術書", author: "D.ボズウェル", finish: true, isbn: "4873115655" },
  { id: 4, name: "達人プログラマー", category: "技術書", author: "A.ハント", finish: true, isbn: "4274226298" },
  { id: 6, name: "ゼロから作るDeep Learning", category: "技術書", author: "斎藤康毅", finish: false, isbn: "4873117585" },
  { id: 8, name: "人月の神話", category: "技術書", author: "F.P.ブルックス", finish: true, isbn: "4621066080" },
  { id: 10, name: "Webを支える技術", category: "技術書", author: "山本陽平", finish: true, isbn: "4774142042" },
  { id: 12, name: "プログラミングTypeScript", category: "技術書", author: "B.チェルニー", finish: false, isbn: "4873119049" },
  // ビジネス
  { id: 14, name: "コンサルタントの秘密", category: "ビジネス", author: "G.M.ワインバーグ", finish: true, isbn: "4320025377" },
  { id: 15, name: "イシューからはじめよ", category: "ビジネス", author: "安宅和人", finish: true, display: "face-out", isbn: "4862760856" },
  { id: 16, name: "失敗の本質", category: "ビジネス", author: "戸部良一ほか", finish: false, isbn: "4122018331" },
  // 随筆
  { id: 17, name: "夜と霧", category: "随筆", author: "V.E.フランクル", finish: true, isbn: "4622039702" },
  { id: 18, name: "思考の整理学", category: "随筆", author: "外山滋比古", finish: true, isbn: "4480020470" },
];

// src/lib/url.ts の getAmazonCoverUrl と同じ方式（coverUrl 指定があればそちらを優先）
const SAMPLE_BOOKS = RAW_BOOKS.map(({ isbn, ...book }) => ({
  ...book,
  coverUrl:
    book.coverUrl ??
    `https://images-na.ssl-images-amazon.com/images/P/${isbn}.01.LZZZZZZZ.jpg`,
  amazonUrl: `https://www.amazon.co.jp/dp/${isbn}`,
}));

const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");
const port = portIndex >= 0 ? args[portIndex + 1] : "3000";
const shouldOpen = args.includes("--open");

// src/lib/url.ts の encodeBookshelfData と同じ方式（encodeURIComponent → base64）
const data = { name: "テスト本棚", books: SAMPLE_BOOKS };
const encoded = Buffer.from(encodeURIComponent(JSON.stringify(data))).toString("base64");
const url = `http://localhost:${port}/bookshelf?d=${encodeURIComponent(encoded)}`;

console.log(`テストデータ ${SAMPLE_BOOKS.length}冊 入りのURL:\n`);
console.log(url);

if (shouldOpen) {
  if (process.platform === "win32") {
    exec(`start "" "${url.replace(/&/g, "^&")}"`, { shell: "cmd.exe" });
  } else {
    exec(`${process.platform === "darwin" ? "open" : "xdg-open"} "${url}"`);
  }
  console.log("\nブラウザで開きました。");
}
