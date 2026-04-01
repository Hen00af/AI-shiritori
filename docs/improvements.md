# 改善履歴

## ラウンド1: ゲーム体験の強化（2026-04-01）

参考プロダクト: 限界しりとりMobile、Wordle、イラストチェイナー

### 1. タイマー緊迫演出
- 残り10秒で黄色に変化 + 緩やかなパルスアニメーション
- 残り5秒で赤色に変化 + 高速パルス + サイズ拡大
- ファイル: `shiritori_controller.js`, `application.scss`

### 2. ゲーム中ワード数カウンター
- プレイ画面にリアルタイムの単語数表示を追加
- 単語追加時にスケールアニメーションで視覚フィードバック
- タイマーと横並びで表示
- ファイル: `show.html.erb`, `shiritori_controller.js`, `application.scss`

### 3. SNSシェアボタン（Wordle風）
- 結果画面に「結果をコピー」「𝕏でシェア」ボタンを追加
- スコアをブロックバー（🟦⬛）で視覚化
- テキスト形式で単語数・スコア・ハッシュタグを含む
- ファイル: `result.html.erb`, `result_controller.js`, `application.js`, `application.scss`
