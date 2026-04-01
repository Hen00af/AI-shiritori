import "@hotwired/turbo-rails"
import "./controllers"
import "bootstrap"

// Action Cableの接続を初期化するために、この行を有効に戻します
import "./channels"

import "./custom_cursor"
import "./star_particles"
import "./typing_sound"

// シェア機能（結果画面用）
window.copyShareText = async function() {
  if (!window._shareText) return;
  try {
    await navigator.clipboard.writeText(window._shareText);
    const btn = document.getElementById('share-copy-btn');
    if (btn) {
      btn.classList.add('share-copied');
      btn.textContent = '✅ コピーしました！';
      setTimeout(() => {
        btn.classList.remove('share-copied');
        btn.textContent = '📋 結果をコピー';
      }, 2000);
    }
  } catch (e) {
    console.error('Copy failed:', e);
  }
}

window.shareToX = function() {
  if (!window._shareText) return;
  const url = `https://x.com/intent/tweet?text=${encodeURIComponent(window._shareText)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}