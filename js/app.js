// ── Bootstrap: wire up all modules and start the app ──────────────────────────
import { state } from './state.js';
import { init, reloadData } from './state.js';
import { initQuickBar } from './chat.js';

// Modules self-register their window.* handlers on import.
// These imports ensure the modules are loaded (and their window.* bindings run):
import './utils.js';
import './sales.js';
import './inventory.js';
import './customers.js';
import './chat.js';

// ── Restore saved AI key ──
(function() {
  var saved = localStorage.getItem('flowhub_ai_key');
  if (saved) { state.aiKey = saved; document.getElementById('keyBtn').textContent = 'AI KEY SET'; document.getElementById('keyInput').value = saved; }
})();

// ── Quick bar ──
initQuickBar();

// ── Mobile view toggle ──
function isMobile() { return window.innerWidth <= 767; }
function setMobileView(v) {
  state._mobileView = v;
  var left = document.querySelector('.left'), right = document.querySelector('.right');
  if (isMobile()) {
    left.classList.toggle('mob-hidden', v !== 'data');
    right.classList.toggle('mob-hidden', v !== 'chat');
  } else {
    left.classList.remove('mob-hidden');
    right.classList.remove('mob-hidden');
  }
  ['data','chat'].forEach(function(x) {
    var b = document.getElementById('mnav-' + x);
    if (b) b.className = 'mnav-btn' + (x === v ? ' on' : '');
  });
  if (v === 'chat') setTimeout(function() { var el = document.getElementById('messages'); if (el) el.scrollTop = el.scrollHeight; }, 50);
}
window.setMobileView = setMobileView;
window.addEventListener('resize', function() { setMobileView(state._mobileView); });
setMobileView('data');

// ── Mobile keyboard: pin input-bar above the on-screen keyboard ──
(function() {
  var inputBar = document.querySelector('.input-bar');
  if (!inputBar || !window.visualViewport) return;
  function pinInputBar() {
    if (window.innerWidth > 767) {
      inputBar.style.bottom = '';
      return;
    }
    var gap = window.innerHeight - window.visualViewport.offsetTop - window.visualViewport.height;
    inputBar.style.bottom = Math.max(0, gap) + 'px';
  }
  window.visualViewport.addEventListener('resize', pinInputBar);
  window.visualViewport.addEventListener('scroll', pinInputBar);
  window.addEventListener('resize', pinInputBar);
  pinInputBar();
})();

// ── Start ──
init();
