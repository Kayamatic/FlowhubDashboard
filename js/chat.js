import { esc } from './utils.js';
import { state } from './state.js';

var QUICK = ['What needs attention right now?','Top customers this month','Busiest hours by day of week (last 90 days)','Top 20 products last 30 days','Revenue trend last 14 days','Who is at churn risk?'];
var _msgSeq = 0;

export function addMsg(role, text, loading) {
  state.chatHistory.push({ role: role, text: text });
  var el = document.getElementById('messages'), id = 'm' + Date.now() + '_' + (++_msgSeq);
  el.insertAdjacentHTML('beforeend',
    '<div class="msg' + (role === 'user' ? ' user' : '') + '">' +
    (role !== 'user' ? '<div class="ai-icon">AI</div>' : '') +
    '<div class="bubble' + (role === 'user' ? ' user' : '') + '" id="' + id + '">' +
    (text ? esc(text) : '') + (loading ? '<span class="cursor"> &#9610;</span>' : '') +
    '</div></div>');
  el.scrollTop = el.scrollHeight;
  return id;
}

function updateMsg(id, text) { var el = document.getElementById(id); if (el) el.innerHTML = esc(text); }

function renderMiniChart(chart) {
  if (!chart || !chart.data || !chart.data.length) return '';
  var data = chart.data;
  var maxUnits = Math.max.apply(null, data.map(function(d) { return d.units; }));
  var totalUnits = data.reduce(function(s, d) { return s + d.units; }, 0);
  var h = '<div class="chat-chart">';
  h += '<div class="chat-chart-title">' + esc(chart.title) + ' &middot; ' + totalUnits.toLocaleString() + ' total</div>';
  if (maxUnits === 0) {
    h += '<div style="color:#555;font-size:13px;text-align:center;padding:8px 0">No sales in this period</div>';
  } else {
    h += '<div class="chat-chart-bars">';
    data.forEach(function(d) {
      var pct = d.units / maxUnits;
      h += '<div class="chat-bar-col" title="' + d.date + ': ' + d.units + ' units ($' + d.rev + ')">';
      if (d.units > 0) h += '<div class="chat-bar" style="height:' + Math.max(3, Math.round(pct * 64)) + 'px"></div>';
      h += '</div>';
    });
    h += '</div>';
    var first = data[0].date.slice(5);
    var mid   = data[Math.floor(data.length / 2)].date.slice(5);
    var last  = data[data.length - 1].date.slice(5);
    h += '<div class="chat-chart-xlabels"><span>' + first + '</span><span>' + mid + '</span><span>' + last + '</span></div>';
  }
  h += '</div>';
  return h;
}

export function copyChat() {
  if (!state.chatHistory.length) return;
  var lines = state.chatHistory.filter(function(m) { return m.text; }).map(function(m) {
    var who = m.role === 'user' ? 'You' : 'AI';
    return who + ':\n' + m.text;
  });
  var out = '617THC Analytics \u2014 Chat Export\n' + new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' EST\n\n' + lines.join('\n\n---\n\n');
  navigator.clipboard.writeText(out).then(function() {
    var btn = document.getElementById('copyChatBtn');
    btn.textContent = 'Copied!'; btn.style.color = '#5dcc8a'; btn.style.borderColor = '#5dcc8a';
    setTimeout(function() { btn.textContent = 'Copy'; btn.style.color = '#666'; btn.style.borderColor = '#444'; }, 2000);
  });
}

export async function sendChat(text) {
  var t = text || document.getElementById('chatInput').value.trim();
  if (!t || state.busy) return;
  document.getElementById('chatInput').value = '';
  if (isMobile()) window.setMobileView('chat');
  addMsg('user', t, false);
  var loadId = addMsg('assistant', '', true);
  state.busy = true; document.getElementById('sendBtn').disabled = true;
  try {
    var msgs = state.chatHistory.slice(0, -2).filter(function(m) { return m.text; }).map(function(m) { return { role: m.role === 'user' ? 'user' : 'assistant', content: m.text }; });
    msgs.push({ role: 'user', content: t });
    var headers = { 'Content-Type': 'application/json' };
    if (state.aiKey) headers['x-api-key'] = state.aiKey;
    var SD = state.SD;
    var ctx = SD ? { todayRev: SD.todayRev, todayCount: SD.todayCount, weekRev: SD.weekRev, weekCount: SD.weekCount, monthRev: SD.monthRev, monthCount: SD.monthCount, totalCustomers: SD.totalCustomers, newCustomersToday: SD.newCustomersToday, newCustomersWeek: SD.newCustomersWeek, newCustomers: SD.newCustomers, loyalCustomers: SD.loyalCustomers, churnRisk: SD.churnRisk, lowStockCount: SD.lowStock ? SD.lowStock.length : 0, totalSkus: SD.totalSkus } : {};
    var res = await fetch('/api/chat', { method: 'POST', headers: headers, body: JSON.stringify({ messages: msgs, context: ctx }) });
    var ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json') && res.status === 401) {
      var je = await res.json();
      var em = je.error === 'session_expired' ? 'Session expired \u2014 please refresh the page to log in again.' : 'Error: ' + (je.message || je.error);
      updateMsg(loadId, em); state.chatHistory[state.chatHistory.length - 1].text = em; return;
    }
    if (!ct.includes('text/event-stream')) {
      updateMsg(loadId, 'Request timed out or an error occurred \u2014 please try again, or narrow the date range for complex queries.');
      state.chatHistory[state.chatHistory.length - 1].text = 'Request timed out.'; return;
    }
    var reader = res.body.getReader(), dec = new TextDecoder(), buf = '';
    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buf += dec.decode(chunk.value, { stream: true });
      var lines = buf.split('\n'); buf = lines.pop();
      for (var li = 0; li < lines.length; li++) {
        var ln = lines[li];
        if (!ln.startsWith('data: ')) continue;
        var j;
        try { j = JSON.parse(ln.slice(6)); } catch(_) { continue; }
        if (j.error) {
          var errMsg = j.error === 'session_expired' ? 'Session expired \u2014 please refresh the page to log in again.'
            : j.error === 'no_key' ? 'Please set your Anthropic API key using the SET AI KEY button in the top right.'
            : 'Error: ' + (j.message || j.error);
          updateMsg(loadId, errMsg); state.chatHistory[state.chatHistory.length - 1].text = errMsg; return;
        }
        var reply = (j.content && j.content[0] && j.content[0].text) || 'Sorry, no response generated.';
        updateMsg(loadId, reply); state.chatHistory[state.chatHistory.length - 1].text = reply;
        var bubble = document.getElementById(loadId);
        if (j.chart && bubble) {
          var chartRow = document.createElement('div');
          chartRow.className = 'msg-chart';
          chartRow.innerHTML = renderMiniChart(j.chart);
          bubble.closest('.msg').insertAdjacentElement('afterend', chartRow);
        }
        if (j.csv && j.csv.data && bubble) {
          var blob = new Blob([j.csv.data], { type: 'text/csv' });
          var url = URL.createObjectURL(blob);
          var csvRow = document.createElement('div');
          csvRow.style.cssText = 'margin-left:37px;margin-top:6px;margin-bottom:4px';
          csvRow.innerHTML = '<a href="' + url + '" download="' + esc(j.csv.filename) + '" ' +
            'style="display:inline-flex;align-items:center;gap:6px;background:#1a2a1a;border:1px solid #2d5a2d;' +
            'color:#5dcc8a;padding:7px 13px;border-radius:5px;font-size:13px;font-weight:600;text-decoration:none;' +
            'transition:background .15s" ' +
            'onmouseover="this.style.background=\'#22331e\'" onmouseout="this.style.background=\'#1a2a1a\'">' +
            '&#x2B07;&#xFE0E; ' + esc(j.csv.filename) + '</a>';
          bubble.closest('.msg').insertAdjacentElement('afterend', csvRow);
        }
        if (j.chart || j.csv) document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;
        return;
      }
    }
  } catch(e) { updateMsg(loadId, 'Error: ' + e.message); }
  finally { state.busy = false; document.getElementById('sendBtn').disabled = false; }
}

export function handleKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }

export function toggleKey() { var b = document.getElementById('keyBar'); b.style.display = b.style.display === 'none' ? 'flex' : 'none'; }
export function saveKey() { state.aiKey = document.getElementById('keyInput').value.trim(); localStorage.setItem('flowhub_ai_key', state.aiKey); document.getElementById('keyBtn').textContent = state.aiKey ? 'AI KEY SET' : 'SET AI KEY'; document.getElementById('keyBar').style.display = 'none'; }

export function initQuickBar() {
  var qb = document.getElementById('quickBar');
  QUICK.forEach(function(q) { var b = document.createElement('button'); b.className = 'qbtn'; b.textContent = q; b.onclick = function() { sendChat(q); }; qb.appendChild(b); });
}

function isMobile() { return window.innerWidth <= 767; }

// Attach to window for inline HTML handlers
window.sendChat = sendChat;
window.handleKey = handleKey;
window.copyChat = copyChat;
window.toggleKey = toggleKey;
window.saveKey = saveKey;
