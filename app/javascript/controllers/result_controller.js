import { Controller } from "@hotwired/stimulus"
import consumer from "../channels/consumer"
import * as bootstrap from "bootstrap"
import confetti from "canvas-confetti"

const escapeHtml = (unsafe) => {
  if (unsafe === null || typeof unsafe === 'undefined') return ''
  return unsafe.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const countUp = (element, endValue, duration = 1500) => {
  if (isNaN(endValue)) {
    element.textContent = endValue;
    return Promise.resolve();
  }
  
  const startValue = parseInt(element.textContent.replace(/,/g, ''), 10) || 0;
  if (startValue === endValue) return Promise.resolve();
  let startTime = null;

  return new Promise(resolve => {
    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const currentValue = Math.floor(progress * (endValue - startValue) + startValue);
      element.textContent = currentValue.toLocaleString();
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(animate);
  });
};

export default class extends Controller {
  static values = {
    roomId: Number,
    currentUserId: Number,
    currentGuestId: String,
    initial: String,
  }
  static targets = ["resultsWrapper", "rankingContainer"]

  connect() {
    this.finalAnimationHasRun = false;
    const initialData = JSON.parse(this.initialValue);

    if (initialData.all_words_evaluated) {
      this.displayStaticResults(initialData.ranked_results);
    } else {
      this.initializeRankingForAnimation(initialData.ranked_results);
      this.setupSubscription();
    }
  }

  setupSubscription() {
    this.subscription = consumer.subscriptions.create(
      { channel: "ResultChannel", room_id: this.roomIdValue },
      {
        received: (data) => {
          if (data.event === 'update_results' && data.all_words_evaluated && !this.finalAnimationHasRun) {
            this.finalAnimationHasRun = true;
            this.startFinalAnimation(data.ranked_results);
          }
        }
      }
    );
  }
  
  displayStaticResults(finalResults) {
    const loadingMessage = document.getElementById('initial-loading-message');
    if (loadingMessage) loadingMessage.remove();

    this.rankingContainerTarget.innerHTML = '';

    finalResults.forEach((resultData, index) => {
      const cardId = `participant-${resultData.participant_id}`;
      const cardElement = this.createRankingCard(cardId, resultData, index + 1, false);
      this.rankingContainerTarget.appendChild(cardElement);
    });
    
    if (finalResults.length > 0) {
      const winnerId = `participant-${finalResults[0].participant_id}`
      const winnerCard = document.getElementById(winnerId)
      if (winnerCard) {
        winnerCard.classList.add('winner')
        winnerCard.querySelector('.crown').classList.remove('d-none')
      }
    }
  }

  async initializeRankingForAnimation(initialResults) {
    const loadingMessage = document.getElementById('initial-loading-message');
    if (loadingMessage) {
      loadingMessage.innerHTML = `
        最終結果集計中...
        <div class="spinner-border spinner-border-sm ms-2" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      `;
    }

    this.rankingContainerTarget.innerHTML = '';

    initialResults.forEach((resultData, index) => {
      const cardId = `participant-${resultData.participant_id}`;
      const cardElement = this.createRankingCard(cardId, resultData, index + 1, true);
      this.rankingContainerTarget.appendChild(cardElement);
    });

    const cards = this.rankingContainerTarget.querySelectorAll('.result-card-wrapper');
    for (let i = 0; i < cards.length; i++) {
      await sleep(150);
      cards[i].classList.remove('initial-hidden');
    }
  }

  async startFinalAnimation(finalResults) {
    const loadingMessage = document.getElementById('initial-loading-message');
    if (loadingMessage) loadingMessage.remove();

    const countUpPromises = finalResults.map(result => {
      const cardId = `participant-${result.participant_id}`;
      const cardWrapper = document.getElementById(cardId);
      if (!cardWrapper) return Promise.resolve();

      const aiScoreEl = cardWrapper.querySelector('[data-score-type="ai"]');
      const chainScoreEl = cardWrapper.querySelector('[data-score-type="chain"]');
      const totalScoreEl = cardWrapper.querySelector('[data-score-type="total"]');
      
      const promises = [];
      if (aiScoreEl) promises.push(countUp(aiScoreEl, result.total_ai_score ?? 0));
      if (chainScoreEl) promises.push(countUp(chainScoreEl, result.total_chain_bonus_score ?? 0));
      if (totalScoreEl) promises.push(countUp(totalScoreEl, result.total_score, 2000));

      return Promise.all(promises);
    });

    await Promise.all(countUpPromises);
    await sleep(500);

    this.updateCardPositions(finalResults);
    await sleep(800);

    this.updateRanksAndDetails(finalResults);
    this.updateWordHistory(finalResults);
    
    await this.finalizeResults(finalResults);
  }

  updateCardPositions(newRankedResults) {
    const cardElements = Array.from(this.rankingContainerTarget.children);
    const firstPositions = new Map();
    cardElements.forEach(el => {
      firstPositions.set(el.id, el.getBoundingClientRect());
    });

    const newOrderMap = new Map(newRankedResults.map((r, i) => [`participant-${r.participant_id}`, i]));
    const sortedElements = [...cardElements].sort((a, b) => {
        return (newOrderMap.get(a.id) ?? Infinity) - (newOrderMap.get(b.id) ?? Infinity);
    });
    
    sortedElements.forEach(el => this.rankingContainerTarget.appendChild(el));

    cardElements.forEach(el => {
      const lastPos = el.getBoundingClientRect();
      const firstPos = firstPositions.get(el.id);
      if (!firstPos) return;

      const deltaX = firstPos.left - lastPos.left;
      const deltaY = firstPos.top - lastPos.top;

      el.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    });

    requestAnimationFrame(() => {
      cardElements.forEach(el => {
        el.style.transition = 'transform 0.8s cubic-bezier(0.25, 1, 0.5, 1)';
        el.style.transform = 'translate(0, 0)';
      });
    });
  }

  updateRanksAndDetails(rankedResults) {
    rankedResults.forEach((resultData, index) => {
      const rank = index + 1;
      const cardId = `participant-${resultData.participant_id}`;
      const cardElement = document.getElementById(cardId);
      if (cardElement) {
        const rankBadge = cardElement.querySelector('.rank-badge');
        if (rankBadge) rankBadge.textContent = `${rank}位`;
      }
    });
  }
  
  updateWordHistory(rankedResults) {
    rankedResults.forEach(resultData => {
      const cardId = `participant-${resultData.participant_id}`;
      const cardElement = document.getElementById(cardId);
      if (!cardElement) return;

      const wordsHistoryHtml = this.createWordsHistoryHtml(resultData.words);
      const accordionBody = cardElement.querySelector('.accordion-body');
      if (accordionBody) {
        accordionBody.innerHTML = wordsHistoryHtml;
      }
    });
  }

  async finalizeResults(rankedResults) {
    if (rankedResults.length === 0) return
    const winnerId = `participant-${rankedResults[0].participant_id}`
    const winnerCard = document.getElementById(winnerId)
    if (winnerCard) {
      winnerCard.classList.add('winner')
      winnerCard.querySelector('.crown').classList.remove('d-none')

      const rect = winnerCard.getBoundingClientRect();
      const origin = {
        x: (rect.left + rect.right) / 2 / window.innerWidth,
        y: (rect.top + rect.bottom) / 2 / window.innerHeight
      };
      
      confetti({ particleCount: 150, spread: 90, origin: { ...origin, y: origin.y - 0.1 } });
      await sleep(200);
      confetti({ particleCount: 200, spread: 120, origin: origin });
      await sleep(200);
      confetti({ particleCount: 150, spread: 90, origin: { ...origin, y: origin.y + 0.1 } });
    }
  }

  createRankingCard(cardId, data, rank, isInitial = false) {
    const cardWrapper = document.createElement('div');
    cardWrapper.id = cardId;
    cardWrapper.classList.add('row', 'justify-content-center', 'mb-4', 'result-card-wrapper');
    if (isInitial) {
      cardWrapper.classList.add('initial-hidden');
    }

    const isCurrentUser = this.isCurrentUser(data);
    const totalScore = isInitial ? data.total_base_score : data.total_score;
    const aiScore = isInitial ? '---' : (data.total_ai_score ?? 0);
    const chainBonusScore = isInitial ? '---' : (data.total_chain_bonus_score ?? 0);
    const wordsHistoryHtml = isInitial ? 
      '<div class="text-muted p-3">最終結果発表までお待ちください...</div>' : 
      this.createWordsHistoryHtml(data.words);

    cardWrapper.innerHTML = `
      <div class="col-md-8">
        <div class="card ${isCurrentUser ? 'border-primary' : ''}">
          <div class="card-header d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center">
              <span class="rank-badge fs-5 me-3">${rank}位</span>
              <h4 class="mb-0">${escapeHtml(data.username)} ${isCurrentUser ? '(あなた)' : ''}</h4>
            </div>
            <span class="crown fs-2 d-none">👑</span>
          </div>
          <div class="card-body text-center">
            <div class="row score-breakdown">
              <div class="col score-item total-score">
                <h3 class="display-5 fw-bold" data-score-type="total">${totalScore}</h3>
                <small>総合スコア</small>
              </div>
              <div class="col score-item base-score">
                <h5 data-score-type="base">${data.total_base_score}</h5>
                <small>基礎点</small>
              </div>
              <div class="col score-item ai-score">
                <h5 data-score-type="ai">${aiScore}</h5>
                <small>AIボーナス</small>
              </div>
              <div class="col score-item chain-score">
                <h5 data-score-type="chain">${chainBonusScore}</h5>
                <small>連鎖ボーナス</small>
              </div>
            </div>
          </div>
          <div class="card-footer">
            <div class="accordion" id="accordion-${cardId}">
              <div class="accordion-item">
                <h2 class="accordion-header">
                  <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${cardId}" aria-expanded="false">
                    単語履歴を見る
                  </button>
                </h2>
                <div id="collapse-${cardId}" class="accordion-collapse collapse" data-bs-parent="#accordion-${cardId}">
                  <div class="accordion-body" style="max-height: 300px; overflow-y: auto;">
                    ${wordsHistoryHtml}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const button = cardWrapper.querySelector('.accordion-button');
    const collapseTarget = cardWrapper.querySelector('.accordion-collapse');
    if(button && collapseTarget) {
      new bootstrap.Collapse(collapseTarget, { toggle: false });
    }

    return cardWrapper;
  }
  
  createWordsHistoryHtml(words) {
    if (!words || words.length === 0) {
      return '<div class="text-muted p-3">単語の投稿がありませんでした。</div>';
    }
    return words.map(word => `
      <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
        <div class="flex-grow-1 text-start">
          <p class="fs-6 mb-0 fw-medium">${escapeHtml(word.body)}</p>
          ${word.ai_evaluation_comment ? `
            <div class="text-muted small mt-1 p-2 bg-light rounded">
              <i class="bi bi-robot me-1"></i>
              ${escapeHtml(word.ai_evaluation_comment)}
            </div>
          ` : ''}
          ${word.chain_bonus_comment ? `
            <div class="text-muted small mt-1 p-2 bg-success bg-opacity-10 rounded">
              <i class="bi bi-link-45deg me-1"></i>
              ${escapeHtml(word.chain_bonus_comment)}
            </div>
          ` : ''}
        </div>
        <div class="text-end ms-3" style="min-width: 140px;">
          ${word.score > 0 ? `
            <span class="badge bg-secondary rounded-pill">基礎: ${word.score}点</span>
            <span class="badge bg-info rounded-pill">AI: ${word.ai_score ?? '...'}点</span>
            ${word.chain_bonus_score !== null ? `<span class="badge bg-success rounded-pill mt-1">連鎖: ${word.chain_bonus_score}点</span>` : ''}
          ` : `<span class="badge bg-light text-muted rounded-pill">開始単語</span>`}
        </div>
      </div>
    `).join('');
  }

  isCurrentUser(data) {
    if (this.currentUserIdValue) {
      return data.user_id === this.currentUserIdValue;
    }
    if (this.currentGuestIdValue) {
      return data.guest_id === this.currentGuestIdValue;
    }
    return false;
  }

  disconnect() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}