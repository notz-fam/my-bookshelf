## API設計

### 認証
なし

### エンドポイント一覧
本棚データはURL（`/bookshelf?d=`）に付加する方式を採用する。以下は補助的なAPI。

| メソッド | パス | 説明 |
|----------|------|------|
| GET | /api/lookup-book?url= | Amazon URL から書籍情報を取得 |
| GET | /api/og?d= | 共有用の OGP 画像（1200×630 PNG）を生成 |
| POST | /api/shorten | body `{ d }` を Upstash Redis に保存し、`{ shortUrl }`（`/s/{id}`）を返す。本棚データとして読めない値は 400、Redis 未設定なら 503 |
| GET | /s/{id} | 短縮URL。`/bookshelf?d=...` へ 302 リダイレクト（中継ページなし）。見つからなければ 404 |

- 短縮URLのIDは本棚データの SHA-256 の先頭8文字（衝突時は延長）。同じ本棚は同じIDになる
- 保存データに有効期限はない
