# 買い時チェッカー Ver.5.1 カメラ完全修正版

## 今回の修正
- カメラ取得をバーコードライブラリより先に実行
- iPhone Safariのカメラ起動エラーを種類別に表示
- ZXing読み込み失敗でもカメラ映像自体は表示
- 「カメラでJANを撮影して読み取る」を追加（iPhoneの撮影画面を利用）
- Service Workerのキャッシュを更新して、古いapp.jsが残りにくい構成に変更

## GitHubへの反映
既存リポジトリのルートに、ZIP内の7ファイルを上書きしてください。
index.html / style.css / app.js / manifest.json / sw.js / README.md

## iPhoneでの確認
必ずSafariでGitHub PagesのURLを直接開いてください。
「JANコードをスキャン」→ カメラ起動を確認。
ライブカメラが使えない場合は「カメラでJANを撮影して読み取る」を利用できます。

## 注意
iOSの仕様上、Webページから設定アプリの特定画面を自動で開くことはできません。
