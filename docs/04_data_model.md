## データモデル

### Bookshelf
| フィールド | 型 | 制約 | 説明 |
|------------|-----|------|------|
| bookIds | String | UNIQUE, NOT NULL | |
| primaryKey | "category" \| "author" | Default "category" | 仕切りの主キー。主キーの仕切りは大きく、もう一方（サブキー）は小さく立つ。並べ替えプリセットで切り替わる。共有URLでは作者のときだけ `k: "a"` を載せる |
| hideDividers | Boolean | Default False | すべての仕切りを隠す（仕切りのオン・オフ）。作者ごとの非表示（hiddenAuthors）とは独立。共有URLでは隠すときだけ `x: 1` を載せる |

### Book
| フィールド | 型 | 制約 | 説明 |
|------------|-----|------|------|
| id | number | PK | |
| name | String | NOT NULL | |
| category | String | NULLABLE | |
| finish | Boolean | Default True | |

### リレーション
- Bookshelf 1 : N Book

### 注意
- 機能を満たすために必要なフィールドがあれば適宜追加すること
