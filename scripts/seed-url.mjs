// テスト用の本データを入れた状態で /bookshelf を開くためのURLを生成する。
//
// 使い方:
//   npm run seed                  → http://localhost:3000 用のURLを表示
//   npm run seed -- --port 3003   → ポート指定
//   npm run seed -- --open        → 既定のブラウザで開く（Windows）
//
// データはURLの ?d= に載るだけなので、開いた後に編集しても元データは汚れない。

import { buildSampleUrl, SAMPLE_BOOKS } from "./lib/sample-bookshelf.mjs";
import { openWithDefaultApp } from "./lib/open.mjs";

const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");
const port = portIndex >= 0 ? args[portIndex + 1] : "3000";
const shouldOpen = args.includes("--open");

const url = buildSampleUrl(`http://localhost:${port}`);

console.log(`テストデータ ${SAMPLE_BOOKS.length}冊 入りのURL:\n`);
console.log(url);

if (shouldOpen) {
  openWithDefaultApp(url);
  console.log("\nブラウザで開きました。");
}
