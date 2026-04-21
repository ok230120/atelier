# atelier

`atelier` はローカルファイルを扱う個人向けメディア管理アプリです。  
React + TypeScript + Vite で構成されており、動画・小説・画像をブラウザ上で整理する用途を想定しています。

## 前提環境

- Node.js 18 以上
- Chromium 系ブラウザ
- File System Access API が利用できる環境

`atelier` はローカルフォルダへのアクセスを前提にしているため、Firefox / Safari / 一部モバイルブラウザでは期待どおり動作しない可能性があります。

## セットアップ

```bash
npm install
```

## 開発起動

```bash
npm run dev
```

## ビルド

```bash
npm run build
```

## プレビュー

```bash
npm run preview
```

## 主な画面

- Home
- Videos
- Novels
- Images
- Favorites
- Manage
- Settings

ルーティング定義は `src/pages/registry.ts` にまとまっています。

## 補足

- データ保存には IndexedDB を使用します。
- 画像・動画・小説の管理機能は `src/pages/` 配下に分かれています。
- ファイル操作やインポート処理は `src/services/` にあります。
