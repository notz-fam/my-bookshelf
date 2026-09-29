// SNS / チャットのクローラーと同じ見方で OGP を検査し、生成された画像を一時フォルダに保存する。
// 本番にデプロイしてシェアしなくても、OGP画像が表示されるかをローカルや Preview デプロイで確かめられる。
//
// 使い方:
//   npm run ogp                              → http://localhost:3000 のテスト本棚（npm run seed と同じデータ）を検査
//   npm run ogp -- --port 3003               → ポート指定
//   npm run ogp -- https://xxx.vercel.app/s/abcd1234   → 任意のURL（短縮URLのリダイレクトも追う）
//   npm run ogp -- --open                    → 保存した画像を既定のビューアで開く
//
// 1つでも ❌ があれば終了コード 1。

import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSampleUrl } from "./lib/sample-bookshelf.mjs";
import { openWithDefaultApp } from "./lib/open.mjs";

// 主要サービス（Slack / X / Discord / LINE / Facebook）で共通して安全な範囲
const USER_AGENT = "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)";
const MAX_IMAGE_URL_LENGTH = 2000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_MS = 3000;
const WARN_IMAGE_MS = 2000;
const EXPECTED_SIZE = { width: 1200, height: 630 };
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

const OUTPUT_DIR = join(tmpdir(), "my-bookshelf-ogp");
const KEEP_FILES = 20;

// ---------- 引数 ----------

const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");
const port = portIndex >= 0 ? args[portIndex + 1] : "3000";
const shouldOpen = args.includes("--open");
const pageUrl =
  args.find((a) => /^https?:\/\//.test(a)) ??
  buildSampleUrl(`http://localhost:${port}`);

// ---------- 結果の記録 ----------

const results = [];
const pass = (label, detail = "") => results.push({ mark: "✅", label, detail });
const warn = (label, detail = "") => results.push({ mark: "⚠️ ", label, detail });
const fail = (label, detail = "") => results.push({ mark: "❌", label, detail });

function truncate(s, n = 100) {
  return s.length > n ? `${s.slice(0, n)}…（${s.length}文字）` : s;
}

// ---------- HTML から meta を取り出す ----------

function decodeEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseMeta(html) {
  const meta = {};
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = tag.match(/\b(?:property|name)="([^"]+)"/i)?.[1];
    const content = tag.match(/\bcontent="([^"]*)"/i)?.[1];
    if (key && content !== undefined && !(key in meta)) meta[key] = decodeEntities(content);
  }
  return meta;
}

// ---------- 画像の実寸 ----------

function readImageSize(buf, type) {
  if (type === "image/png" && buf.length >= 24) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (type === "image/gif" && buf.length >= 10) {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  if (type === "image/jpeg") {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      // SOF0〜SOF15（DHT / JPG / DAC を除く）に寸法が入っている
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

// ---------- 保存 ----------

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function saveImage(buf, type) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const ext = { "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" }[type] ?? "png";
  const file = join(OUTPUT_DIR, `og-${timestamp()}.${ext}`);
  await writeFile(file, buf);
  await pruneOldFiles();
  return file;
}

async function pruneOldFiles() {
  const names = (await readdir(OUTPUT_DIR)).filter((n) => n.startsWith("og-"));
  const files = await Promise.all(
    names.map(async (n) => ({ path: join(OUTPUT_DIR, n), mtime: (await stat(join(OUTPUT_DIR, n))).mtimeMs }))
  );
  files.sort((a, b) => b.mtime - a.mtime);
  await Promise.all(files.slice(KEEP_FILES).map((f) => rm(f.path, { force: true })));
}

// ---------- 検査 ----------

async function checkPage() {
  console.log(`検査するページ: ${truncate(pageUrl)}\n`);

  let res;
  try {
    res = await fetch(pageUrl, { headers: { "User-Agent": USER_AGENT }, redirect: "follow" });
  } catch (e) {
    fail("ページを取得", `${e.cause?.code ?? e.message}（開発サーバーは起動していますか？ npm run dev）`);
    return null;
  }
  if (res.url !== pageUrl) pass("リダイレクト", `→ ${truncate(res.url)}`);
  if (!res.ok) {
    fail("ページのステータス", String(res.status));
    return null;
  }
  pass("ページのステータス", String(res.status));

  const meta = parseMeta(await res.text());
  for (const key of ["og:title", "og:description", "og:image", "twitter:card"]) {
    if (meta[key]) pass(key, truncate(meta[key], 80));
    else fail(key, "ありません");
  }
  if (meta["twitter:image"] && meta["twitter:image"] !== meta["og:image"]) {
    warn("twitter:image", "og:image と異なります");
  }
  return meta;
}

async function checkImage(meta) {
  const imageUrl = meta["og:image"];
  if (!imageUrl) return null;

  if (!/^https?:\/\//.test(imageUrl)) {
    fail("画像URLが絶対URL", imageUrl);
    return null;
  }
  pass("画像URLが絶対URL");

  if (imageUrl.length > MAX_IMAGE_URL_LENGTH) {
    fail("画像URLの長さ", `${imageUrl.length}文字（上限 ${MAX_IMAGE_URL_LENGTH}）— クローラーが取得を諦めます`);
  } else {
    pass("画像URLの長さ", `${imageUrl.length}文字`);
  }

  const started = performance.now();
  let res;
  let buf;
  try {
    res = await fetch(imageUrl, { headers: { "User-Agent": USER_AGENT } });
    buf = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    fail("画像を取得", e.cause?.code ?? e.message);
    return null;
  }
  const ms = Math.round(performance.now() - started);
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();

  if (!res.ok) {
    fail("画像のステータス", `${res.status}: ${truncate(buf.toString("utf8").replace(/\s+/g, " "), 200)}`);
    return null;
  }
  pass("画像のステータス", String(res.status));

  if (IMAGE_TYPES.includes(type)) pass("Content-Type", type);
  else fail("Content-Type", type || "（なし）");

  const kb = `${Math.round(buf.length / 1024)}KB`;
  if (buf.length > MAX_IMAGE_BYTES) fail("画像サイズ", `${kb}（上限 5MB）`);
  else pass("画像サイズ", kb);

  const time = `${ms}ms（開発サーバーは初回コンパイル分遅くなります）`;
  if (ms > MAX_IMAGE_MS) fail("生成時間", `${time}（上限 ${MAX_IMAGE_MS}ms）`);
  else if (ms > WARN_IMAGE_MS) warn("生成時間", time);
  else pass("生成時間", `${ms}ms`);

  const size = readImageSize(buf, type);
  const declared = {
    width: Number(meta["og:image:width"]) || null,
    height: Number(meta["og:image:height"]) || null,
  };
  if (!size) {
    warn("画像の寸法", "読み取れませんでした");
  } else {
    const actual = `${size.width}×${size.height}`;
    if (size.width !== EXPECTED_SIZE.width || size.height !== EXPECTED_SIZE.height) {
      fail("画像の寸法", `${actual}（期待 ${EXPECTED_SIZE.width}×${EXPECTED_SIZE.height}）`);
    } else if (declared.width && (declared.width !== size.width || declared.height !== size.height)) {
      warn("画像の寸法", `${actual}（og:image:width/height は ${declared.width}×${declared.height}）`);
    } else {
      pass("画像の寸法", actual);
    }
  }

  return IMAGE_TYPES.includes(type) ? saveImage(buf, type) : null;
}

// ---------- 実行 ----------

const meta = await checkPage();
const savedFile = meta ? await checkImage(meta) : null;

for (const r of results) {
  console.log(`${r.mark} ${r.label}${r.detail ? `  ${r.detail}` : ""}`);
}

console.log("");
if (savedFile) {
  console.log("🖼  OGP画像を保存しました");
  console.log(`   ファイル : ${savedFile}`);
  console.log(`   フォルダ : ${OUTPUT_DIR}`);
  if (shouldOpen) openWithDefaultApp(savedFile);
} else {
  console.log("🖼  OGP画像は保存されませんでした（上の ❌ を確認してください）");
  console.log(`   フォルダ : ${OUTPUT_DIR}`);
}

const failed = results.filter((r) => r.mark === "❌").length;
console.log(failed ? `\n❌ ${failed}件の問題があります` : "\n✅ すべてのチェックに合格しました");
process.exitCode = failed ? 1 : 0;
