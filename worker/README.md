# PDF Upload Worker

投稿されたPDFをR2へ保存し、D1で審査状態を管理するCloudflare Workerです。LINEに届く確認リンクから公開または却下できます。

「未完成品」は `incomplete/` へ分けて保存し、公開・却下の対象にしません。LINEには編集用PDFのダウンロードリンクだけが届きます。編集後は「問題」または「答え」として再投稿します。

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
npm run db:migrate:remote
npm run deploy
```

ローカル開発用の秘密情報は `.dev.vars.example` を `.dev.vars` にコピーして設定します。`.dev.vars` と `.env` はGitへ追加されません。

アップロードされたオブジェクトは `submissions/<ID>/<ファイル名>` に保存されます。承認後は `/papers` に表示され、`/files/<ID>/<ファイル名>` から配信されます。却下するとR2上のPDFも削除されます。

## API

- `POST /`: PDF投稿
- `GET /papers`: 公開済みPDF一覧
- `GET /files/:id/:filename`: 公開済みPDF
- `GET /review/:id?token=...`: 確認待ち投稿の情報
- `GET /review/:id/file?token=...`: 確認用PDF
- `POST /review/:id/approve?token=...`: 公開
- `POST /review/:id/reject?token=...`: 却下
- `GET /incomplete/:id/file?token=...`: 未完成品の編集用ダウンロード
