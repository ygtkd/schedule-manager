# LINEログイン設定

## 1. チャネルを作る

[LINE Developersコンソール](https://developers.line.biz/console/)でMessaging APIと同じプロバイダーを選び、「新規チャネル作成」→「LINEログイン」。まだプロバイダーがなければ先に作成します。

- チャネル名：予定の自動管理アプリ
- 説明：メッセージから予定を抽出し、カレンダーで管理するアプリ
- アプリタイプ：ウェブアプリ
- メールアドレス：運営者が確認する連絡先
- プライバシーポリシー：https://gray-desert-016145400.3.azurestaticapps.net/privacy.html
- メールアドレス取得権限の申請：不要（openidのみ要求）

「LINEログイン設定」のコールバックURLに以下を登録します。

```text
https://gray-desert-016145400.3.azurestaticapps.net/api/auth/line/callback
```

一般の利用者に公開するときはチャネルのステータスを「公開済み」に変更します。LINEログインとMessaging APIは別チャネルです。Messaging APIのWebhook URLをこのコールバックに変更しないでください。

## 2. Azureへ設定する

Azure Portal → takeda-resource → schedule-manager（Static Web App）→ 環境変数 → Production。

| 名前 | 値 |
|---|---|
| LINE_LOGIN_CHANNEL_ID | LINEログインチャネルのチャネルID |
| LINE_LOGIN_CHANNEL_SECRET | LINEログインチャネルのチャネルシークレット |

追加して保存・適用します。既存のLINE_CHANNEL_SECRETはMessaging API用なので置き換えません。チャットやGitへシークレットを貼り付けないでください。
APP_ORIGIN / TOKEN_KEY / Cosmos DBの設定も必要です。Googleの設定はLINEログインの前提ではありません。

/api/auth/config が {"lineLogin":true} になればサーバーに両設定が存在します。値の正しさやLINEへの疎通成功を保証するものではありません。

## 3. 動作確認

1. アプリを再読み込み → 設定 → LINEでログイン。
2. LINEの同意画面から戻り、登録先「アプリ内カレンダー」を確認。
3. 手入力で予定を保存 → ログアウト → 同じLINEで再ログイン → 予定が残ることを確認。
4. 既存Google利用者はGoogleでログインしたまま「LINEログインを追加」。別の利用者に既に登録されたLINEは追加できません。自動でデータ統合しません。
5. Googleを後から連携可能。連携以後の新規登録だけをGoogleにも送信します。過去予定の一括転送・双方向編集同期はありません。
6. iPhone Safari / Android Chromeで認証からの復帰を確認します。

## 4. LINEメッセージからの登録（ログインとは別設定）

Messaging APIのLINE_CHANNEL_SECRET、Webhook /api/webhooks/line、Geminiキー、AI_CONSENT、Workerを[配備手順](deploy.md)どおり設定します。
アプリの設定で「連携コードを発行」→自分のLINEから公式アカウントへ送信→「連携を確認」→受信ON。
自動登録OFFなら抽出後の確認待ち、ONならアプリ内（Google連携中はGoogleにも）登録します。既定Workerは約30分に1件です。
LINEログインだけで個人間のトークを読み取ることはできません。

## 実装上の認証保護

state + HttpOnly/Secure/SameSite Cookie、PKCE S256、nonce、LINEのIDトークン検証API（audience/issuer/有効期限も確認）を使用。認証状態は10分かつ一度限り、セッションは7日です。ログインIDの対応付けは作成専用のトランザクションで保護します。メッセージ連携の解除はLINEログイン権限の解除ではありません。

公式資料：[LINEログインを始めよう](https://developers.line.biz/ja/docs/line-login/getting-started/)、[Webアプリへの組み込み](https://developers.line.biz/ja/docs/line-login/integrate-line-login/)、[PKCE](https://developers.line.biz/ja/docs/line-login/integrate-pkce/)。
