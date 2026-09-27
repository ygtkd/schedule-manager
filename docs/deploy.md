# GitHub Actions → Azure 配備

対象リポジトリ: https://github.com/ygtkd/schedule-manager

## 1. 認証

このPCで `gh auth login --hostname github.com --web --git-protocol https` を実行。
Azure CLIを用意して `az login`、`az account set --subscription "<対象>"` を実行します。
トークンやAPIキーはチャット・git・ログに貼り付けません。

## 2. Azureリソース

既存SWA Free/Cosmos Freeがあれば再利用します。
新規の場合、リソースグループを選択して次を実行します。

```sh
az deployment group create --resource-group <RG> --template-file infra/main.bicep --parameters appName=<一意なSWA名> cosmosName=<一意なCosmos名>
```

テンプレートはSWA FreeとCosmos Free Tier、400 RU/sのrecordsコンテナを作成します。
Cosmos Free Tierはサブスクリプションごとに1アカウント。既存アカウントがある場合この新規テンプレートは実行しないでください。
既存コンテナならpartition key /pk、TTL有効・既定-1を設定します。

## 3. Google / LINE / Gemini

Google CloudでCalendar APIを有効化。Web OAuth clientのredirect URIを
`https://<SWAホスト>/api/auth/callback` にします。
scope: openid、email、calendar.events.owned。
Googleアカウントの検証済みsubjectに基づき、利用者ごとに認証情報を保存します。メールアドレスの事前登録は不要です。
Testing状態のCalendar用refresh tokenは通常7日。長期運用では同意画面の公開・必要な審査に対応します。

LINE公式アカウントでMessaging APIを有効化。
Webhook: `https://<SWAホスト>/api/webhooks/line`、Webhook利用・再配信を有効化。
LINE_OWNER_IDは不要です。各利用者が設定画面で連携コードを発行し、自分のLINEから公式アカウントへ送信して紐付けます。
返信やPush送信は実装しません。結果はアプリの履歴で確認します。

Google AI StudioでGeminiキーを発行。無料対象でStructured Outputs対応モデルを選択。
モデル提供状況と利用上限を配備時に確認してください。

## 4. SWAの環境変数

Azure Portal → SWA → 環境変数へ、api/local.settings.example.jsonのValuesを設定。
FUNCTIONS_WORKER_RUNTIMEはローカル用でSWAには不要です。
APP_ORIGINは末尾スラッシュなしの本番URL。

- GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
- COSMOS_CONNECTION / COSMOS_DATABASE=schedule / COSMOS_CONTAINER=records
- TOKEN_KEY: 32バイトの暗号学的乱数をBase64化
- WORKER_SECRET: 32バイト以上の暗号学的乱数
- GEMINI_API_KEY / GEMINI_MODEL / DAILY_AI_LIMIT
- AI_CONSENT: データ利用条件に同意後true
- LINE_CHANNEL_SECRET
- LINE_FRIEND_URL: 任意。https://line.me/ で始まる友だち追加URL

キー生成例:
```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```
TOKEN_KEY変更時は既存トークンの復号ができなくなるため再連携が必要です。

## 5. GitHub設定

Repository Settings → Environments → productionを作成。
productionのSecrets:
- AZURE_STATIC_WEB_APPS_API_TOKEN_GRAY_DESERT_016145400（リポジトリSecret）: SWAのManage deployment tokenで取得
- WORKER_SECRET: SWAと同じ値

Repository Variables:
- APP_URL: https://<SWAホスト>
- ENABLE_LINE_WORKER: 無料実行枠と利用条件を確認後true

mainにpushするとTest and deploy to Azureが実行されます。
LINE用のscheduleはデフォルトブランチにworkflowがある場合に起動します。
失敗時はActionsログで確認。トークンはログ出力しません。
長期間活動のない公開リポジトリではscheduleが無効化される場合があります。

## 6. 配備後の確認

1. /api/healthでok、画面にモック表示やサンプル予定がないことを確認。
2. 設定からGoogleログイン。2つのGoogleアカウントで予定・履歴・設定が分離されることを確認。
3. 月移動・日付2回タップ・詳細外側で閉じる・手入力がGoogleにも保存されることを確認。
4. 登録から終了時刻まで明確な本文を送信し、確認後の登録と重複防止を確認。
5. 設定でLINE受信をON。公式アカウントに送信、履歴に処理待ちが出ることを確認。
6. ActionsのProcess queued LINE messagesを手動実行し、抽出・登録を確認。
7. 自動登録ON/OFF、連携解除で処理が停止することを確認。
8. iPhone Safari/Android Chromeからホーム画面追加。再起動・OAuth復帰・オフライン表示を確認。

Cloud認証情報が未設定の場合、healthと静的画面以外の動作は完了しません。
Azureリソース: takeda-resource / schedule-manager。mainへのpushでテスト後に配備します。Azureが生成したリポジトリSecretを利用します。

## Google OAuthの仮公開

Google Auth Platform → 対象（Audience）→ 本番へ公開すると、テストユーザーの事前登録は不要になります。公開状態とGoogleの確認済み状態は別です。Calendarのsensitive scopeでは、未確認のまま警告と100ユーザー上限が適用されます。一般公開に必要なブランド・スコープの審査、ホームページとプライバシーポリシーURL、ドメイン所有確認などに対応してください。

プライバシー説明は /privacy.html です。これは実装のデータ利用説明であり、Googleの審査通過を保証しません。運営連絡先・公開ドメインなど、実際の運用情報を最終確認してください。
