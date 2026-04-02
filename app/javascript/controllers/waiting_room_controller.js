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
            this.showGameStarting()
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
      participantCount.classList.add('count-pop')
      setTimeout(() => participantCount.classList.remove('count-pop'), 400)
    }
  }

  showGameStarting() {
    const card = this.element.querySelector('.card')
    if (card) {
      card.innerHTML = `
        <div class="card-body py-5 text-center">
          <div style="font-size: 3.5rem; font-weight: 900; color: #00ff88;
                      text-shadow: 0 0 20px #00ff88, 0 0 40px #00ff88;
                      letter-spacing: 6px; animation: countdown-appear 0.3s ease-out;">
            GAME START!
          </div>
          <div style="margin-top: 16px; color: rgba(0,255,136,0.5); font-size: 0.8rem; letter-spacing: 3px;">
            準備してください...
          </div>
        </div>
      `
    }
    setTimeout(() => window.location.reload(), 1500)
  }
}