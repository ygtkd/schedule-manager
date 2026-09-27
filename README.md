# 予定の自動管理アプリ

スマートフォン向けPWA。GoogleカレンダーとLINEのみ連携します。

- 予定：Googleカレンダーの月表示、日付2回タップで詳細、背景タップで閉じる、予定の手入力
- 登録：本文をGeminiで抽出、内容を確認して登録、処理履歴
- 設定：Google連携/解除、LINE受信、自動登録
- 下端タブバーと横スワイプ。モックは `mock/`、配備対象は `web/` と `api/`

## 構成

```text
PWA ── /api (SWA Managed Functions) ── Google OAuth / Calendar
                         ├── Gemini Structured Outputs
                         └── Cosmos DB Free Tier
LINE ── 署名検証 ── Cosmosへ暗号化して保存 ── 200応答
GitHub Actions (30分毎) ── /api/worker ── 抽出・登録
```

個人1名向けです。許可するGoogleアカウント・LINE送信者を環境変数で制限します。
LINEから個人間DMを自動収集することはできません。専用公式アカウントに本文を送信・転送します。
LINE Workerは1実行1件。Actions scheduleは遅延・停止することがあり、即時性の保証はありません。
8回失敗で履歴に「処理失敗」。再送信で新しい処理を開始します。

## 開発・検証

Node.js 22:

```sh
npm ci
npm ci --prefix api
npm test
npm test --prefix api
npx playwright install chromium webkit
npm run test:ui
```

UIテストはAPIレスポンスを模擬します。実際のGoogle/LINE/Geminiへの疎通は配備後に別途必要です。
静的プレビューは `node scripts/serve.mjs`。APIはAzure Functions Core Tools v4から起動できます。
Secure Cookie認証の結合検証はHTTPS配備先で行います。

## 配備

[配備・設定手順](docs/deploy.md)を参照。
`.github/workflows/deploy.yml` がmainへのpushでテスト後にSWAへ配備します。
PRはテストのみで、本番秘密情報を使用しません。

## 運用

- AI入力の開始・終了が不確定な場合は登録せず、履歴に確認対象として残します。JSONの形式検証は意味の正しさを保証しません。
- AIは日本時間。手入力も日本時間。終日・日をまたぐ既存Google予定の表示に対応します。手入力は同日内の開始・終了です。
- 本文はLINEの未処理キューにAES-GCMで暗号化して保存。完了後に本文を消去、履歴は30日TTL。Google refresh tokenも暗号化します。
- Web本文は処理中メモリのみ。履歴の件名・日時・場所は保存します。
- Google連携解除で全セッションを無効化し、LINE受信・自動登録を停止します。解除前に処理開始済みのリクエストは完了する場合があります。
- カレンダーは毎回取得。PWAは静的アセットだけをキャッシュし、トークン・本文・予定をオフライン保存しません。
- アプリのUIはGoogle連携済みでもGoogle側で権限失効している場合があります。読み書きエラー時は再連携してください。
- GoogleイベントIDを固定して再送時の重複を抑止。手入力の通信失敗後は同じフォームで再試行してください。

## 無料枠の条件

SWA Freeの内蔵Functionsを使い、別のFunctions/Storageは作りません。
Cosmosは新規アカウント作成時にFree Tierを有効化し、単一リージョン・手動400 RU/s・25GB以内。
サブスクリプションでFree Tierを既に使用している場合は既存アカウントの容量を確認して再利用してください。

Geminiは課金未有効のFree対象モデルを利用。15 RPM固定ではなくAI Studioに表示される上限を確認してください。
既定で1回/分・20回/UTC日。無料枠で本文が製品改善に使用される条件を確認し、機密情報は送らないでください。
AI_CONSENTをtrueにするまで処理しません。

GitHub Actionsもリポジトリ公開範囲と契約の無料実行枠に従います。
30分毎のWorkerは月約1,440〜1,488回。課金時間の切り上げ・実行時間・他リポジトリ利用も考慮し、
予算を確認するまでENABLE_LINE_WORKERを有効化しないでください。Azure予算アラートは課金の強制停止ではありません。
無条件の永久無料を保証する構成ではありません。
