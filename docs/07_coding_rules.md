## コーディング規約

### 命名規則
- コンポーネント：PascalCase（UserProfile.tsx）
- 関数・変数：camelCase
- 定数：UPPER_SNAKE_CASE
- CSSクラス：Tailwindを基本とする。カスタムCSSも可（テーマのCSS変数やTailwindで表現しづらいスタイルは `src/app/globals.css` に書く）

### ファイル構成
src/
├── features/       # 機能単位（auth/, posts/ など）
│   ├── components/
│   ├── hooks/
│   └── api.ts
├── shared/         # 共通コンポーネント
└── lib/            # ユーティリティ

### コミットメッセージ
feat: 新機能
fix: バグ修正
chore: 設定・依存変更

### AIへの補足指示（CLAUDE.md専用）
- 実装前に必ずDOC 04のデータモデルを参照すること
- 新しいAPIエンドポイントはDOC 06の形式で必ずコメントを残すこと
- 不明な仕様は実装せず、TODO: コメントを残して報告すること