# TDnet 開示情報リアルタイム

東証 TDnet（適時開示情報閲覧サービス）の開示を、ブラウザでリアルタイムに見るためのツールです。
公開URL: https://tdnet-web.jp-x.workers.dev/

## 仕組み（Worker 1つ）

```
ブラウザ ──> tdnet-web (Cloudflare Worker 1つ)
              ├─ 画面 …… docs/ を静的配信(過去分の日次データ docs/data/*.json も同じ場所)
              └─ /api/disclosures …… TDnet の公開ページを取得して JSON にして返す(60秒キャッシュ)
```

- API キー・有料サービスは不要。Cloudflare Workers の無料枠で動きます。
- 今日分は 60 秒、過去日付は 1 時間キャッシュします。TDnet が落ちているときは直前の結果を返します。
- 平日 18:30(JST) に GitHub Actions(`collect-daily.yml`)が当日分を `docs/data/` に保存します。
- `main` に push すると GitHub Actions(`deploy-cloudflare.yml`)が自動で deploy します。

## 手元で動かす

```
npx wrangler dev
```

## 設定

repo の Secret `CLOUDFLARE_API_TOKEN`(Workers の編集権限)だけが必要です。

出典: 東京証券取引所 TDnet
