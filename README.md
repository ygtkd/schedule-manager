# 予定の自動管理アプリ

スマートフォン向けPWA。GoogleカレンダーとLINEのみ連携します。

- 予定：アプリ内予定と任意連携したGoogleカレンダーの月表示、日付2回タップで詳細、背景タップで閉じる、予定の手入力
- 登録：本文をGeminiで抽出、内容を確認して登録、処理履歴
- 設定：LINEログイン、Google連携/解除、LINE受信、自動登録
- 下端タブバーと横スワイプ。モックは `mock/`、配備対象は `web/` と `api/`

## 構成

```text
PWA ── /api (SWA Managed Functions) ── Google OAuth / Calendar
                         ├── Gemini Structured Outputs
                         └── Cosmos DB Free Tier
LINE ── 署名検証 ── Cosmosへ暗号化して保存 ── 200応答
GitHub Actions (30分毎) ── /api/worker ── 抽出・登録
```

公開登録に対応します。GoogleまたはLINEの検証済みsubjectから利用者別のpartition keyを作成し、予定・トークン・設定・履歴を分離します。メールアドレスの事前登録は不要です。Google OAuthの公開・審査は別途必要です。
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
- Google連携解除はGoogleのトークンのみ削除します。ログインとLINE受信、アプリ内予定は維持します。LINE受信を止めるには受信OFFまたはメッセージ連携解除を使います。解除前に処理開始済みのリクエストは完了する場合があります。
- アプリ内予定はCosmos DBに期限なしで保存し、Google連携中はGoogleの予定と合わせて毎回取得。PWAは静的アセットだけをキャッシュし、トークン・本文・予定をオフライン保存しません。
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

## 公開登録への変更

- GOOGLE_OWNER_SUB / GOOGLE_OWNER_EMAIL / LINE_OWNER_IDは不要になりました。
- 既存のownerパーティションは新しい利用者へ引き継ぎません。旧版で連携済みなら再ログインが必要です。現時点ではGoogle設定前のため既存利用者データの移行は不要です。
- LINEは設定でコードを発行し、自分のLINEから公式アカウントへ文字列全体を送信します。10分以内・一度だけ有効。他人に共有しないでください。アプリで連携確認後、受信をONにします。
- LINEの1アカウントを複数の利用者へ割り当てることはできません。変更時は既存のLINE連携を解除してください。
- Google OAuthを本番へ切り替えても、未確認アプリの警告・ユーザー上限は解除されません。一般公開にはGoogleの必要な審査と公開ポリシーへの対応が必要です。
- AIの無料枠と処理速度は全利用者で共有です。利用者数に応じた即時処理・無制限利用は提供しません。

## LINEログイン（0.3.0）

[設定手順](docs/line-login.md)。Googleは任意です。Google未連携でも手入力・AI抽出後の確認登録・LINE自動登録をアプリ内に保存できます。後からGoogleを連携した場合、以後の登録だけがGoogleにも送信されます。過去のアプリ内予定は自動転送しません。Google側で編集・削除してもアプリ保存分への双方向同期は行いません。取得時に同じIDがある場合はGoogle側の内容を表示します。

既存Google利用者はログイン中に「LINEログインを追加」を選びます。先に独立したLINEアカウントを作った場合は既存アカウントと自動統合しません。LINEのメッセージ連携コードだけではログイン権限を付与しません。LINEログインと公式アカウントの受信設定は別です。
