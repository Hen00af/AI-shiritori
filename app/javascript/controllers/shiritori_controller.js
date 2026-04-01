import { Controller } from "@hotwired/stimulus"
import { Turbo } from "@hotwired/turbo-rails"
import * as wanakana from "wanakana"
import consumer from "../channels/consumer"

export default class extends Controller {
  static targets = ["timer", "timerBar", "input", "form", "wordCount", "nextChar", "comboDisplay", "comboCount", "lastWord", "scorePreview"]
  static values = {
    roomId: Number,
    startedAt: String,
    currentUserId: Number,
    currentGuestId: String,
    currentParticipantId: Number
  }

  connect() {
    this.comboStreak = 0
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

  submitWord(event) {
    event.preventDefault()

    const formData = new FormData(this.formTarget)
    fetch(this.formTarget.action, {
      method: 'POST',
      headers: {
        'X-CSRF-Token': this.csrfToken,
        'Accept': 'text/vnd.turbo-stream.html, text/html, application/xhtml+xml'
      },
      body: formData
    }).then(response => {
      if (response.ok) return;
      response.text().then(html => {
        Turbo.renderStreamMessage(html);
        // エラー時はコンボリセット
        this.resetCombo()
      });
    }).catch(error => console.error('Error submitting form:', error));

    this.clearInput();
  }

  get csrfToken() {
    const element = document.head.querySelector("meta[name='csrf-token']")
    return element.content
  }

  handleServerEvent(data) {
    switch (data.event) {
      case 'word_created':
        if (data.participant_id === this.currentParticipantIdValue) {
          this.appendWord(data.word_html);
          this.incrementWordCount();
          this.updateLastWord(data.last_char, data.word_html);
          this.updateNextChar(data.last_char);
          this.incrementCombo();
          this.showSubmitFlash();
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

  updateLastWord(lastChar, wordHtml) {
    if (!this.hasLastWordTarget) return;
    // wordHtmlからテキストを抽出（2番目のspanが単語本体）
    const parser = new DOMParser();
    const doc = parser.parseFromString(wordHtml, 'text/html');
    const spans = doc.querySelectorAll('span');
    const wordText = spans[1]?.textContent?.trim();
    if (wordText) {
      this.lastWordTarget.textContent = wordText;
      this.lastWordTarget.style.color = 'rgba(0,234,255,0.8)';
      setTimeout(() => {
        this.lastWordTarget.style.color = 'rgba(200,230,255,0.7)';
      }, 500);
    }
  }

  updateNextChar(char) {
    if (this.hasNextCharTarget && char) {
      this.nextCharTarget.textContent = char;
      this.nextCharTarget.style.transform = 'scale(1.4)';
      this.nextCharTarget.style.transition = 'transform 0.2s ease';
      setTimeout(() => {
        this.nextCharTarget.style.transform = 'scale(1)';
      }, 200);
    }
  }

  incrementWordCount() {
    if (this.hasWordCountTarget) {
      const current = parseInt(this.wordCountTarget.textContent) || 0;
      this.wordCountTarget.textContent = current + 1;
      this.wordCountTarget.style.transform = 'scale(1.4)';
      this.wordCountTarget.style.transition = 'transform 0.2s ease';
      setTimeout(() => {
        this.wordCountTarget.style.transform = 'scale(1)';
      }, 200);
    }
  }

  incrementCombo() {
    this.comboStreak++
    if (this.hasComboCountTarget) {
      this.comboCountTarget.textContent = this.comboStreak
      // pop animation
      this.comboCountTarget.classList.remove('combo-pop')
      void this.comboCountTarget.offsetWidth // reflow
      this.comboCountTarget.classList.add('combo-pop')
    }
    if (this.hasComboDisplayTarget) {
      if (this.comboStreak >= 5) {
        this.comboDisplayTarget.classList.add('on-fire')
      }
    }
  }

  resetCombo() {
    this.comboStreak = 0
    if (this.hasComboCountTarget) {
      this.comboCountTarget.textContent = '0'
    }
    if (this.hasComboDisplayTarget) {
      this.comboDisplayTarget.classList.remove('on-fire')
    }
  }

  showSubmitFlash() {
    const flash = document.getElementById('submit-flash')
    if (!flash) return
    const texts = ['NICE!', 'GOOD!', '連鎖!', 'OK!', 'YES!']
    flash.textContent = this.comboStreak >= 5 ? '🔥 COMBO!' : texts[Math.floor(Math.random() * texts.length)]
    flash.classList.remove('show')
    void flash.offsetWidth
    flash.classList.add('show')
  }

  previewScore() {
    if (!this.hasScorePreviewTarget || !this.hasInputTarget) return;
    const len = this.inputTarget.value.length;
    if (len === 0) {
      this.scorePreviewTarget.textContent = '';
      return;
    }
    const score = 100 + (len * len * 10);
    this.scorePreviewTarget.textContent = `予測スコア: +${score.toLocaleString()}`;
  }

  clearInput() {
    if (this.hasInputTarget) {
      this.inputTarget.value = ""
      this.inputTarget.focus()
    }
    if (this.hasScorePreviewTarget) {
      this.scorePreviewTarget.textContent = '';
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
      this.resetCombo()
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
      const numEl = countdownArea.querySelector('.countdown-number') || countdownArea
      numEl.textContent = count;
      gameArea.style.display = 'none';

      const interval = setInterval(() => {
        count--;
        if (count > 0) {
          numEl.className = '';
          void numEl.offsetWidth;
          numEl.textContent = count;
          numEl.className = 'countdown-number';
        } else if (count === 0) {
          numEl.className = '';
          void numEl.offsetWidth;
          numEl.textContent = 'START';
          numEl.className = 'countdown-start';
        } else {
          clearInterval(interval);
          countdownArea.style.display = 'none';
          gameArea.style.display = '';
          this.startTimer();
          if (this.hasInputTarget) this.inputTarget.focus();
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

        // プログレスバー更新
        const pct = (timeLeft / this.gameDuration) * 100;
        if (this.hasTimerBarTarget) {
          this.timerBarTarget.style.width = `${pct}%`;
          this.timerBarTarget.classList.remove('warning', 'critical');
          if (timeLeft <= 5) {
            this.timerBarTarget.classList.add('critical');
          } else if (timeLeft <= 10) {
            this.timerBarTarget.classList.add('warning');
          }
        }

        // 緊迫演出
        if (timeLeft <= 5) {
          this.timerTarget.classList.add('timer-critical');
          this.timerTarget.classList.remove('timer-warning');
        } else if (timeLeft <= 10) {
          this.timerTarget.classList.add('timer-warning');
          this.timerTarget.classList.remove('timer-critical');
        } else {
          this.timerTarget.classList.remove('timer-warning', 'timer-critical');
        }
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

    const delay = immediately ? 500 : 800;

    if (!immediately) {
      // タイムアップ演出
      const flash = document.getElementById('submit-flash')
      if (flash) {
        flash.textContent = '⏰ TIME UP!'
        flash.style.color = '#ff4444'
        flash.style.textShadow = '0 0 20px #ff4444'
        flash.classList.remove('show')
        void flash.offsetWidth
        flash.classList.add('show')
      }
    }

    setTimeout(() => {
      Turbo.visit(`/rooms/${this.roomIdValue}/result`)
    }, delay)
  }
}
