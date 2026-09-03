# PDF Upload Worker

投稿されたPDFをR2へ保存し、設定されている場合はLINEへ通知するCloudflare Workerです。

## 初期設定

1. `npm install`
2. `npx wrangler login`
3. `npx wrangler r2 bucket list` で本番バケット名を確認
4. `wrangler.jsonc` のR2バケット名が `pdf-storage` であることを確認
5. 必要なら `ALLOWED_ORIGINS` にカンマ区切りでサイトのオリジンを追加
6. LINE通知を使う場合は次を実行

```powershell
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
npx wrangler secret put LINE_USER_ID
```

## 開発とデプロイ

```powershell
npm run check
npm run dev
npm run deploy
```

ローカル開発用の秘密情報は `.dev.vars.example` を `.dev.vars` にコピーして設定します。`.dev.vars` と `.env` はGitへ追加されません。

アップロードされたオブジェクトは `pdf/kadai/<科目>/<ファイル名>` に保存されます。公開一覧への反映は別工程で確認後に行う前提です。
