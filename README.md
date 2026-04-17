# TDnet 開示情報リアルタイム（Web版）

東証TDnetの適時開示情報をブラウザでリアルタイム監視するWebツールです。  
**Cloudflare Worker**（スクレイパー）+ **GitHub Pages**（フロントエンド）の完全無料構成で動作します。

---

## 仕組み

```
ブラウザ（GitHub Pages）
    ↓ fetch（CORS許可済み）
Cloudflare Worker ← 無料 10万req/日
    ↓ スクレイピング
TDnet（tdnet.info）
```

---

## セットアップ手順

### Step 1: Cloudflare アカウント作成（無料）

1. https://www.cloudflare.com/ にアクセス
2. 「Sign Up」で無料アカウントを作成

---

### Step 2: Cloudflare Worker のデプロイ

**方法A：ダッシュボードから（コマンド不要・おすすめ）**

1. Cloudflareダッシュボード → 左メニュー「Workers & Pages」
2. 「Create」→「Create Worker」
3. Worker名を入力（例: `tdnet-worker`）→「Deploy」
4. 「Edit code」をクリック
5. `worker/index.js` の内容を全コピーして貼り付け
6. 「Deploy」をクリック
7. 表示される URL をコピー（例: `https://tdnet-worker.your-name.workers.dev`）

**方法B：Wrangler CLI（開発者向け）**

```bash
npm install -g wrangler
wrangler login
cd worker
wrangler deploy
```

---

### Step 3: GitHub Pages を有効化

1. このリポジトリの「Settings」→「Pages」
2. Source: 「Deploy from a branch」
3. Branch: `main` / `docs` フォルダ を選択
4. 「Save」をクリック
5. 数分後に `https://jpn-x.github.io/tdnet-web/` で公開される

---

### Step 4: Worker URL を設定

1. ブラウザで `https://jpn-x.github.io/tdnet-web/` を開く
2. 「[設定]」をクリック
3. **Worker URL** 欄に Step 2 でコピーした URL を貼り付け
4. 「保存」をクリック → 自動でデータ取得開始

---

## 機能一覧

| 機能 | 詳細 |
|------|------|
| リアルタイム監視 | 1秒〜60分の間隔で自動更新 |
| 15分刻み強制更新 | 毎時0・15・30・45分+1秒に自動取得 |
| 全ページ取得 | 当日の全開示を漏れなく取得 |
| 日付ナビゲーション | ◀▶ボタン・カレンダーで過去データも閲覧 |
| 新着ハイライト | 新着開示をオレンジドット＋点滅でお知らせ |
| 閲覧済み管理 | クリック済みリンクを緑色で表示（localStorageに保存） |
| REIT・ETF除外 | J-REIT・ETF・ETNの定型開示をフィルター |
| ダーク/ライトテーマ | テーマ切替対応 |
| 外部リンク | 決算スケジュール・株探・S高安一覧 |

---

## ファイル構成

```
tdnet-web/
├── docs/
│   └── index.html     フロントエンド（GitHub Pages で公開）
├── worker/
│   ├── index.js       Cloudflare Worker（スクレイパー）
│   └── wrangler.toml  Worker デプロイ設定
└── README.md
```

---

## 無料枠について

| サービス | 無料枠 | 個人利用の目安 |
|---------|--------|--------------|
| Cloudflare Workers | 10万リクエスト/日 | 5分更新で約288req/日 → 余裕 |
| GitHub Pages | 1GB / 月100GB転送 | 静的HTMLのみ → 余裕 |

---

## デスクトップ版との違い

| 機能 | Web版 | デスクトップ版 |
|------|-------|--------------|
| フローティングウィジェット | ❌（ブラウザタブ） | ✅ |
| タスクバー常駐 | ❌ | ✅ |
| Windows通知 | △（ブラウザ通知） | ✅ |
| マルチモニタ対応 | ❌ | ✅ |
| インストール不要 | ✅ | ❌（Python必要） |
| スマホ・Mac対応 | ✅ | ❌ |

---

## License

個人利用・配布ともに自由です。TDnetへのアクセスはTDnet利用規約に従ってください。
