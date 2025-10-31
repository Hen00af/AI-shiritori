import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["player", "toggleButton"]
  static values = {
    files: Array,
  }

  connect() {
    this.isPlaying = false
    this.currentIndex = 0

    this.boundNext = this.next.bind(this)
    this.playerTarget.addEventListener('ended', this.boundNext)

    // 自動再生を試みる
    this.startPlayback()
  }

  disconnect() {
    this.playerTarget.pause()
    this.playerTarget.removeEventListener('ended', this.boundNext)
    // フォールバック用のリスナーが設定されていたら削除
    if (this.boundStartOnInteraction) {
      document.body.removeEventListener('click', this.boundStartOnInteraction)
    }
  }

  // 自動再生の開始処理
  startPlayback() {
    this.playCurrentTrack().then(() => {
      // 自動再生に成功した場合
      this.isPlaying = true
      this.updateToggleButton()
    }).catch(error => {
      // 自動再生がブロックされた場合
      console.warn("BGMの自動再生がブロックされました。ユーザーの操作を待機します。")
      this.isPlaying = false
      this.updateToggleButton()
      
      // 【フォールバック処理】
      // ページ上のどこかが初めてクリックされた時に再生を試みるリスナーを設定
      this.boundStartOnInteraction = this.startOnInteraction.bind(this)
      document.body.addEventListener('click', this.boundStartOnInteraction, { once: true })
    })
  }
  
  // 【フォールバック用のメソッド】
  // ユーザーの初回インタラクション時に呼ばれる
  startOnInteraction() {
    // すでに再生中（例：ユーザーが直接BGMボタンを押した）でなければ再生を開始
    if (!this.isPlaying) {
      // toggleメソッドを呼ぶことで、再生状態のフラグ管理などを一元化できる
      this.toggle()
    }
  }

  // 再生/停止の切り替え
  toggle() {
    // ユーザーが手動でボタンを操作した場合、フォールバック用のリスナーは不要なので削除
    if (this.boundStartOnInteraction) {
      document.body.removeEventListener('click', this.boundStartOnInteraction)
      this.boundStartOnInteraction = null // 念のためクリア
    }

    if (this.isPlaying) {
      this.playerTarget.pause()
    } else {
      // playCurrentTrackがPromiseを返すので、catchでエラーをハンドル
      this.playCurrentTrack().catch(e => console.error("BGMの再生に失敗しました", e))
    }
    this.isPlaying = !this.isPlaying
    this.updateToggleButton()
  }

  // 次の曲へ
  next() {
    this.currentIndex = (this.currentIndex + 1) % this.filesValue.length
    // isPlayingがtrueの場合のみ（＝一度は再生が始まっている場合のみ）次の曲を再生
    if (this.isPlaying) {
      this.playCurrentTrack()
    } else {
      // まだ一度も再生されていない場合は、次に再生する曲の準備だけしておく
      this.playerTarget.src = this.filesValue[this.currentIndex]
    }
  }
  
  // 現在のインデックスの曲を再生する
  playCurrentTrack() {
    this.playerTarget.src = this.filesValue[this.currentIndex]
    const promise = this.playerTarget.play()
    // play()がPromiseを返さない古いブラウザも考慮し、エラーが出ないようにする
    return promise === undefined ? Promise.resolve() : promise
  }

  // 再生ボタンの表示を更新
  updateToggleButton() {
    if (this.isPlaying) {
      this.toggleButtonTarget.textContent = '🔊 BGM'
    } else {
      this.toggleButtonTarget.textContent = '🔇 BGM'
    }
  }
}