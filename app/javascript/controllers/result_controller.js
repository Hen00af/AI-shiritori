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

    this.enableShare(finalResults);
  }

  startLoadingCycle(element) {
    const messages = [
      'WORDS ANALYZED...',
      'COMPUTING SCORES...',
      'AI EVALUATING...',
      'RANKING PLAYERS...',
      'CHECKING CHAINS...',
    ];
    let idx = 0;
    const textEl = element.querySelector('.loading-text');
    if (!textEl) return;
    this.loadingCycle = setInterval(() => {
      idx = (idx + 1) % messages.length;
      textEl.style.opacity = '0';
      setTimeout(() => {
        textEl.textContent = messages[idx];
        textEl.style.opacity = '1';
      }, 150);
    }, 900);
  }

  stopLoadingCycle() {
    if (this.loadingCycle) {
      clearInterval(this.loadingCycle);
      this.loadingCycle = null;
    }
  }

  async initializeRankingForAnimation(initialResults) {
    const loadingMessage = document.getElementById('initial-loading-message');
    if (loadingMessage) {
      loadingMessage.innerHTML = `
        <div class="loading-text" style="letter-spacing: 2px; font-size: 0.85rem; transition: opacity 0.15s ease;">WORDS ANALYZED...</div>
        <div class="spinner-border spinner-border-sm ms-2 mt-2" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      `;
      this.startLoadingCycle(loadingMessage);
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
    this.stopLoadingCycle();
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
      const rankLabel = rank === 1 ? '🥇 1位' : rank === 2 ? '🥈 2位' : rank === 3 ? '🥉 3位' : `${rank}位`;
      const cardId = `participant-${resultData.participant_id}`;
      const cardElement = document.getElementById(cardId);
      if (cardElement) {
        const rankBadge = cardElement.querySelector('.rank-badge');
        if (rankBadge) rankBadge.textContent = rankLabel;
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

    // シェア機能を有効化
    this.enableShare(rankedResults);
  }

  enableShare(rankedResults) {
    const myResult = rankedResults.find(r => this.isCurrentUser(r));
    if (!myResult) return;

    const wordCount = myResult.words ? myResult.words.filter(w => w.score > 0).length : 0;
    const totalScore = myResult.total_score || 0;

    // スコアをバー表示に変換（最大10ブロック）
    const maxScore = rankedResults[0]?.total_score || totalScore || 1;
    const blocks = Math.round((totalScore / maxScore) * 10);
    const bar = '🟦'.repeat(blocks) + '⬛'.repeat(10 - blocks);

    const validWords = myResult.words ? myResult.words.filter(w => w.score > 0) : [];
    const wordChain = validWords.slice(0, 5).map(w => w.body).join('→');
    const chainSuffix = validWords.length > 5 ? '...' : '';
    const rankLabel = rankedResults.length > 1
      ? `${rankedResults.findIndex(r => this.isCurrentUser(r)) + 1}位/${rankedResults.length}人`
      : null;

    const shareText = [
      `🎮 WORD CHASER 高速しりとりバトル`,
      ``,
      `📝 ${wordCount}語 | 🏆 ${totalScore.toLocaleString()}点${rankLabel ? ` | ${rankLabel}` : ''}`,
      bar,
      wordChain ? `${wordChain}${chainSuffix}` : '',
      ``,
      `#WordChaser #しりとり`
    ].filter(line => line !== null).join('\n');

    window._shareText = shareText;

    const container = document.getElementById('share-container');
    if (container) container.style.display = '';
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
      '<div style="color: rgba(100,150,180,0.5); font-size: 0.8rem; padding: 16px; text-align: center; letter-spacing: 2px;">AI評価中...</div>' :
      this.createWordsHistoryHtml(data.words);

    const rankLabel = rank === 1 ? '🥇 1位' : rank === 2 ? '🥈 2位' : rank === 3 ? '🥉 3位' : `${rank}位`;
    const borderColor = isCurrentUser ? 'rgba(0, 234, 255, 0.5)' : 'rgba(0, 234, 255, 0.15)';

    cardWrapper.innerHTML = `
      <div class="col-md-8">
        <div class="card" style="border-color: ${borderColor} !important;">
          <div class="card-header d-flex align-items-center justify-content-between" style="padding: 12px 16px;">
            <div class="d-flex align-items-center gap-3 flex-wrap">
              <span class="rank-badge" style="font-size: 1rem; font-weight: bold; color: #c0d8e8; letter-spacing: 1px;">${rankLabel}</span>
              <span style="font-size: 1rem; color: #00eaff; font-weight: bold; letter-spacing: 2px;">${escapeHtml(data.username)}</span>
              ${isCurrentUser ? '<span style="font-size: 0.65rem; color: rgba(0,234,255,0.5); letter-spacing: 2px; border: 1px solid rgba(0,234,255,0.2); border-radius: 10px; padding: 1px 8px;">YOU</span>' : ''}
              <span style="font-size: 0.7rem; color: rgba(150,180,200,0.6); letter-spacing: 1px; margin-left: auto;">
                ${isInitial ? '' : `${data.words ? data.words.filter(w => w.score > 0).length : 0} words`}
              </span>
            </div>
            <span class="crown d-none" style="font-size: 1.8rem;">👑</span>
          </div>
          <div class="card-body text-center" style="padding: 16px;">
            <div class="row score-breakdown g-2">
              <div class="col score-item total-score">
                <div style="font-size: 2.2rem; font-weight: 900; font-family: 'Courier New', monospace;" data-score-type="total">${(totalScore ?? 0).toLocaleString()}</div>
                <small>TOTAL</small>
              </div>
              <div class="col score-item base-score" style="border-left: 1px solid rgba(0,234,255,0.1);">
                <div style="font-size: 1.1rem; font-weight: bold; font-family: 'Courier New', monospace;" data-score-type="base">${(data.total_base_score ?? 0).toLocaleString()}</div>
                <small>基礎点</small>
              </div>
              <div class="col score-item ai-score" style="border-left: 1px solid rgba(0,234,255,0.1);">
                <div style="font-size: 1.1rem; font-weight: bold; font-family: 'Courier New', monospace;" data-score-type="ai">${aiScore}</div>
                <small>AI</small>
              </div>
              <div class="col score-item chain-score" style="border-left: 1px solid rgba(0,234,255,0.1);">
                <div style="font-size: 1.1rem; font-weight: bold; font-family: 'Courier New', monospace;" data-score-type="chain">${chainBonusScore}</div>
                <small>連鎖</small>
              </div>
            </div>
          </div>
          <div class="card-footer" style="padding: 0;">
            <div class="accordion" id="accordion-${cardId}">
              <div class="accordion-item">
                <h2 class="accordion-header" style="margin: 0;">
                  <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${cardId}" aria-expanded="false">
                    ◈ 単語履歴を見る
                  </button>
                </h2>
                <div id="collapse-${cardId}" class="accordion-collapse collapse" data-bs-parent="#accordion-${cardId}">
                  <div class="accordion-body" style="max-height: 320px; overflow-y: auto; padding: 8px 12px;">
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
      return '<div style="color: rgba(100,150,180,0.5); font-size: 0.85rem; padding: 16px; text-align: center; letter-spacing: 2px;">単語の投稿がありませんでした</div>';
    }
    return words.map(word => {
      const isHighScore = word.ai_score > 5000;
      const wordColor = isHighScore ? '#ffd700' : '#e0f0ff';
      const wordGlow = isHighScore ? '0 0 8px rgba(255,215,0,0.6)' : 'none';
      return `
      <div style="padding: 8px 0; border-bottom: 1px solid rgba(0,234,255,0.06);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
          <div style="flex: 1;">
            <span style="color: ${wordColor}; font-size: 1.05rem; font-weight: bold; letter-spacing: 1px; text-shadow: ${wordGlow};">
              ${isHighScore ? '⭐ ' : '▸ '}${escapeHtml(word.body)}
            </span>
            ${word.ai_evaluation_comment ? `
              <div style="margin-top: 4px; padding: 6px 10px; background: rgba(0,150,200,0.08); border-left: 2px solid rgba(0,200,255,0.3); border-radius: 0 4px 4px 0; font-size: 0.75rem; color: rgba(150,200,230,0.8); line-height: 1.4;">
                🤖 ${escapeHtml(word.ai_evaluation_comment)}
              </div>
            ` : ''}
            ${word.chain_bonus_comment ? `
              <div style="margin-top: 4px; padding: 6px 10px; background: rgba(0,200,100,0.08); border-left: 2px solid rgba(0,200,100,0.3); border-radius: 0 4px 4px 0; font-size: 0.75rem; color: rgba(100,220,150,0.8); line-height: 1.4;">
                🔗 ${escapeHtml(word.chain_bonus_comment)}
              </div>
            ` : ''}
          </div>
          <div style="text-align: right; min-width: 120px; flex-shrink: 0;">
            ${word.score > 0 ? `
              <div style="font-size: 0.7rem; color: rgba(150,180,200,0.6); margin-bottom: 2px;">基礎 <span style="color: #c0d8e8;">${word.score}</span></div>
              <div style="font-size: 0.7rem; color: rgba(0,200,255,0.6);">AI <span style="color: #00d8ff;">${word.ai_score ?? '...'}</span></div>
              ${word.chain_bonus_score !== null ? `<div style="font-size: 0.7rem; color: rgba(0,200,100,0.6);">連鎖 <span style="color: #40c070;">${word.chain_bonus_score}</span></div>` : ''}
            ` : `<span style="font-size: 0.7rem; color: rgba(100,130,150,0.5); letter-spacing: 1px;">開始単語</span>`}
          </div>
        </div>
      </div>
    `}).join('');
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
    this.stopLoadingCycle();
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}