## 技術スタック

| レイヤー | 技術 | バージョン | 備考 |
|----------|------|-----------|------|
| フロントエンド | React | 19.x | ObsidianUI の前提（ref を props で受ける） |
| スタイリング | Tailwind CSS | 4.x | テーマは `src/app/globals.css` の CSS 変数（light / dark） |
| UIコンポーネント | ObsidianUI (shadcn 互換) | - | `npx shadcn@latest add "https://www.obsidianui.dev/r/{name}.json"` → `src/shared/ui` |
| アニメーション | Motion (framer-motion) | 13.x | `motion/react` |
| テーマ切替 | next-themes | 0.4.x | |
| 認証 | NextAuth.js | v5 | |
| ホスティング | Vercel | - | |
| KVストア | Upstash Redis（Vercel Marketplace） | @upstash/redis 1.x | 短縮URL（`/s/{id}`）の保存先。環境変数 `KV_REST_API_URL` / `KV_REST_API_TOKEN` |

### アーキテクチャ方針
- ディレクトリ構成の方針：Clean Architecture
- 状態管理：Zustand / React Query
- エラーハンドリング方針：特になし、400, 500 エラーが発生した場合にユーザーに通知する仕組みは用意する

### 禁止事項（AIへの指示）
- `any` 型の使用禁止
- console.log の本番コードへの混入禁止
- 直接的なDOM操作禁止