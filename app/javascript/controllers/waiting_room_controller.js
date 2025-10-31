import { Controller } from "@hotwired/stimulus"
import consumer from "../channels/consumer"

export default class extends Controller {
  static values = { roomId: Number }

  connect() {
    this.subscription = consumer.subscriptions.create(
      { channel: "RoomChannel", room_id: this.roomIdValue },
      {
        received: (data) => {
          // 'participant_joined' イベントを受信した場合
          if (data.event === 'participant_joined') {
            // 参加者リストと参加人数を更新
            this.updateParticipants(data.participants_html, data.participant_count)
          }
          // 'game_started' イベントを受信した場合
          if (data.event === 'game_started') {
            // ページをリロードしてゲーム画面に遷移
            window.location.reload()
          }
        }
      }
    )
  }

  disconnect() {
    this.subscription.unsubscribe()
  }

  // 参加者表示を更新するメソッド
  updateParticipants(html, count) {
    const participantList = document.getElementById("participants-list")
    const participantCount = document.getElementById("participant-count")

    if (participantList) {
      participantList.innerHTML = html
    }
    if (participantCount) {
      participantCount.textContent = count
    }
  }
}