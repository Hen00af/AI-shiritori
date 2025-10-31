import { Controller } from "@hotwired/stimulus"
import { Turbo } from "@hotwired/turbo-rails"
import * as wanakana from "wanakana"
import consumer from "../channels/consumer"

export default class extends Controller {
  static targets = ["timer", "input", "form"]
  static values = {
    roomId: Number,
    startedAt: String,
    currentUserId: Number,
    currentGuestId: String,
    currentParticipantId: Number
  }

  connect() {
    this.setupCountdown()

    this.subscription = consumer.subscriptions.create(
      { channel: "RoomChannel", room_id: this.roomIdValue },
      {
        received: (data) => this.handleServerEvent(data)
      }
    )
  }

  disconnect() {
    clearInterval(this.timerInterval)
    this.subscription.unsubscribe()
  }

  // フォーム送信を制御する新しいメソッド
  submitWord(event) {
    // 1. デフォルトのフォーム送信（リロード）をキャンセル
    event.preventDefault()

    // 2. フォームのデータを裏側でサーバーに送信
    const formData = new FormData(this.formTarget)
    fetch(this.formTarget.action, {
      method: 'POST',
      headers: {
        'X-CSRF-Token': this.csrfToken,
        'Accept': 'text/vnd.turbo-stream.html, text/html, application/xhtml+xml'
      },
      body: formData
    }).then(response => {
      // 成功した場合、UI更新はAction Cableに任せるので何もしない
      if (response.ok) {
        return;
      }
      
      // バリデーションエラーなどが発生した場合は、手動でフォームを更新する
      response.text().then(html => {
        Turbo.renderStreamMessage(html);
      });
    }).catch(error => console.error('Error submitting form:', error));

    // 送信後すぐに入力欄をクリアしてUXを向上
    this.clearInput();
  }

  // CSRFトークンを取得するためのヘルパー
  get csrfToken() {
    const element = document.head.querySelector("meta[name='csrf-token']")
    return element.content
  }

  handleServerEvent(data) {
    switch (data.event) {
      case 'word_created':
        if (data.participant_id === this.currentParticipantIdValue) {
          this.appendWord(data.word_html);
        }
        break;
      case 'player_game_over':
        this.showGameOverMessage(data.user_id, data.guest_id, data.message);
        break;
      case 'all_players_over':
        this.endGame(true);
        break;
    }
  }

  appendWord(html) {
    const wordHistory = document.getElementById("word-history")
    if (wordHistory) {
      wordHistory.insertAdjacentHTML('beforeend', html)
      wordHistory.scrollTop = wordHistory.scrollHeight
    }
  }

  clearInput() {
    if (this.hasInputTarget) {
      this.inputTarget.value = ""
      this.inputTarget.focus()
    }
  }

  showGameOverMessage(userId, guestId, message) {
    const isCurrentUser = (this.hasCurrentUserIdValue && this.currentUserIdValue === userId) ||
                          (this.hasCurrentGuestIdValue && this.currentGuestIdValue === guestId);

    if (isCurrentUser) {
      if (this.hasInputTarget) {
        this.inputTarget.disabled = true
        this.inputTarget.placeholder = message
      }
      const flashMessages = document.getElementById("flash-messages")
      if (flashMessages) {
        flashMessages.innerHTML = `<div class="alert alert-danger">${message}</div>`
      }
    }
  }

  setupCountdown() {
    const countdownArea = document.getElementById('countdown-area');
    const gameArea = document.getElementById('game-area');

    if (this.isGameAlreadyStarted()) {
      countdownArea.style.display = 'none';
      gameArea.style.display = '';
      this.startTimer();
      if (this.hasInputTarget) this.inputTarget.focus();
      return;
    }

    if (countdownArea && gameArea) {
      let count = 3;
      countdownArea.style.color = "white";
      countdownArea.textContent = count;
      gameArea.style.display = 'none';
      const interval = setInterval(() => {
        count--;
        if (count > 0) {
          countdownArea.textContent = count;
        } else if (count === 0) {
          countdownArea.textContent = 'スタート!';
        } else {
          clearInterval(interval);
          countdownArea.style.display = 'none';
          gameArea.style.display = '';
          this.startTimer();
          if (this.hasInputTarget) {
            this.inputTarget.focus();
          }
        }
      }, 1000);
    }
  }

  isGameAlreadyStarted() {
    if (!this.hasStartedAtValue || this.startedAtValue === "") return false;
    const startTime = Date.parse(this.startedAtValue);
    const currentTime = new Date().getTime();
    return currentTime > startTime;
  }

  inputTargetConnected() {
    wanakana.bind(this.inputTarget)
  }

  startTimer() {
    this.gameDuration = 30;

    this.timerInterval = setInterval(() => {
      const startTime = Date.parse(this.startedAtValue);
      const currentTime = new Date().getTime();
      const elapsedTime = Math.floor((currentTime - startTime) / 1000);
      const timeLeft = this.gameDuration - elapsedTime;

      if (timeLeft > 0) {
        this.timerTarget.textContent = timeLeft;
      } else {
        this.timerTarget.textContent = 0;
        this.endGame(false);
      }
    }, 500);
  }

  endGame(immediately = false) {
    if (this.gameEnded) return;
    this.gameEnded = true;

    clearInterval(this.timerInterval)
    if (this.hasTimerTarget) this.timerTarget.textContent = "0"
    if (this.hasInputTarget) this.inputTarget.disabled = true

    const delay = immediately ? 500 : 1000;

    setTimeout(() => {
      Turbo.visit(`/rooms/${this.roomIdValue}/result`)
    }, delay)
  }
}