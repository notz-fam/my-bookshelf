## API設計

### 認証
なし

### エンドポイント一覧
本棚データはURL（`/bookshelf?d=`）に付加する方式を採用する。以下は補助的なAPI。

| メソッド | パス | 説明 |
|----------|------|------|
| GET | /api/lookup-book?url= | Amazon URL から書籍情報を取得 |
| GET | /api/og?s= / ?d= | 共有用の OGP 画像（1200×630 PNG）を生成。`s` は短縮ID、`d` は本棚データ。どちらも読めなければデフォルト画像 |
| POST | /api/shorten | body `{ d }` を Upstash Redis に保存し、`{ shortUrl }`（`/s/{id}`）を返す。本棚データとして読めない値は 400、Redis 未設定なら 503 |
| GET | /s/{id} | 短縮URL。`/bookshelf?d=...` へ 302 リダイレクト（中継ページなし）。見つからなければ 404 |

- 短縮URLのIDは本棚データの SHA-256 の先頭8文字（衝突時は延長）。同じ本棚は同じIDになる
- 保存データに有効期限はない
- OGP画像は画面の本棚（ライトテーマ）と同じ見た目で描く。並べ方・背表紙の色や大きさは `src/features/bookshelf/shelf-layout.ts` を画面と共有し、色は `src/app/api/og/theme.ts`（globals.css のライトテーマと同じ値）を使う。本は表紙が見えるよう全冊を面出しで並べる（画面での背表紙／面出しの設定は使わない）。画像に写るのは上から2段目の途中まで
- 短縮URLを発行したときに OGP画像を裏で生成して CDN にキャッシュさせる（生成に数秒かかり、クローラーが待たないため）
- ページの og:image は `/api/og?s={短縮ID}` を使う（クローラーは長い画像URLを取得しないため）。Redis が使えないときは、データが1500文字以下なら `?d=`、それ以上ならデフォルト画像

### OGP の確認
本番にデプロイしてシェアしなくても、クローラーと同じ条件で OGP を検査できる。

```
npm run dev
npm run ogp                                        # テスト本棚（npm run seed と同じ）を検査
npm run ogp -- https://<preview>.vercel.app/s/xxx  # 任意のURL（Preview デプロイなど）
npm run ogp -- --open                              # 保存した画像をビューアで開く
```

- 検査項目: og タグの有無、画像URLが絶対URLか・2000文字以内か、ステータス、Content-Type、5MB以内、生成3秒以内、1200×630
- 生成された画像は OS の一時フォルダ `my-bookshelf-ogp/`（Windows なら `%TEMP%my-bookshelf-ogp`）に保存され、パスが表示される（新しい20件を保持）
- ローカルに Redis の環境変数がない場合、長い本棚はデフォルト画像になる
- 実際のサービスでの見え方は Vercel の Preview デプロイURLを貼って確認する。Deployment Protection が有効だとクローラーが弾かれるので注意
