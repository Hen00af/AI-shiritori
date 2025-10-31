import { Controller } from "@hotwired/stimulus"
import consumer from "../channels/consumer"

export default class extends Controller {
  static targets = ["list", "message"]

  connect() {
    // ページ読み込み時にも一度チェックを実行
    this.updateMessageVisibility()

    this.subscription = consumer.subscriptions.create("LobbyChannel", {
      received: (data) => {
        if (data.event === 'room_created') {
          // ▼▼▼ ここを修正 ▼▼▼
          // this.element を this.listTarget に変更
          this.listTarget.insertAdjacentHTML('afterbegin', data.room_html)
          // ▲▲▲ ここまで修正 ▲▲▲
        }
        if (data.event === 'room_removed') {
          const roomElement = document.getElementById(`room_${data.room_id}`)
          if (roomElement) {
            roomElement.remove()
          }
        }
        
        // ▼▼▼ ここから追加 ▼▼▼
        // ルームが追加/削除された後に必ずチェックを実行
        this.updateMessageVisibility()
      }
    })
  }

  disconnect() {
    this.subscription.unsubscribe()
  }

  // メッセージの表示/非表示を更新するメソッド
  updateMessageVisibility() {
    // listTarget（<ul>）の中にルーム（.list-group-item）が1つ以上あるか？
    const hasRooms = this.listTarget.querySelector(".list-group-item") !== null

    if (hasRooms) {
      // ルームがあればメッセージを隠す
      this.messageTarget.classList.add("d-none")
    } else {
      // ルームがなければメッセージを表示する
      this.messageTarget.classList.remove("d-none")
    }
  }
}
