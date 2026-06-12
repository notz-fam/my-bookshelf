## データモデル

### Bookshelf
| フィールド | 型 | 制約 | 説明 |
|------------|-----|------|------|
| bookIds | String | UNIQUE, NOT NULL | |

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
