# étoile Nail Salon

Astro 製のネイルサロン公式サイト（予約・シフト管理付き）。

## Commands

| Command | Action |
| :------ | :----- |
| `npm install` | 依存関係のインストール |
| `npm run dev` | 開発サーバー起動 (`localhost:4321`) |
| `npm run dev:bg` | バックグラウンドで開発サーバー起動 |
| `npm run build` | 本番ビルド (`./dist/`) |
| `npm run preview` | ビルド結果のプレビュー |

## Structure

```text
src/
  assets/       画像・ロゴ
  components/   Header / Footer / 予約・シフトフォーム
  data/         レビュー JSON・UI 文字列
  layouts/      共通レイアウト
  lib/          サロン・予約・シフトロジック
  pages/        ページ・API
data/           予約・シフトの実行時データ
public/         favicon など静的ファイル
```
