// Shared utility functions — no dependencies
export function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

export function fmtMoney(n) {
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'k';
  return '$' + n.toFixed(2);
}
export function fmtFull(n) {
  return '$' + (+n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function shortName(s) { var i = s.indexOf(' - '); return i !== -1 ? s.slice(i + 3) : s; }

export function localDateStr(d) { return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); }
export function estToISO(dateStr, timeStr) {
  var naiveUTC = new Date(dateStr + 'T' + timeStr + 'Z');
  var nyDisplay = naiveUTC.toLocaleString('sv', { timeZone: 'America/New_York' }).replace(' ', 'T');
  var offsetMs  = naiveUTC.getTime() - new Date(nyDisplay + 'Z').getTime();
  return new Date(naiveUTC.getTime() + offsetMs).toISOString();
}
export function nyHour(isoStr) {
  var s = new Date(isoStr).toLocaleString('sv', { timeZone: 'America/New_York' });
  return parseInt(s.split(' ')[1], 10);
}

export function hrLbl(i) { var h = i + 9; return h < 12 ? h + 'am' : h === 12 ? '12pm' : (h - 12) + 'pm'; }
export function showBarTip(e, t) {
  var tip = document.getElementById('barTip');
  tip.textContent = t;
  tip.style.display = 'block';
  var tw = tip.offsetWidth, th = tip.offsetHeight;
  var cx = e.touches ? e.touches[0].clientX : e.clientX;
  var cy = e.touches ? e.touches[0].clientY : e.clientY;
  var x = cx - tw / 2;
  if (x < 4) x = 4;
  if (x + tw > window.innerWidth - 4) x = window.innerWidth - tw - 4;
  tip.style.left = x + 'px';
  tip.style.top = (cy - th - 10) + 'px';
}
export function hideBarTip() { document.getElementById('barTip').style.display = 'none'; }
export function barMaxH(n) { return n <= 12 ? 65 : 52; }
export function barWrapH(n) { return n <= 12 ? 70 : 56; }
export function mkLineSvg(counts, maxCount, n) {
  var bh = barMaxH(n), wh = barWrapH(n);
  var pts = counts.map(function(c, i) {
    return ((i+0.5)/n*100).toFixed(2) + ',' + (wh-Math.max(4,(c/maxCount)*bh)).toFixed(2);
  }).join(' ');
  var s = '<svg style="position:absolute;top:0;left:0;width:100%;height:'+wh+'px;pointer-events:none;overflow:visible" viewBox="0 0 100 '+wh+'" preserveAspectRatio="none">';
  s += '<polyline points="' + pts + '" fill="none" stroke="#4a9edd" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';
  counts.forEach(function(c, i) {
    var x = ((i+0.5)/n*100).toFixed(2), y = (wh-Math.max(4,(c/maxCount)*bh)).toFixed(2);
    s += '<circle cx="' + x + '" cy="' + y + '" r="1.8" fill="#4a9edd" vector-effect="non-scaling-stroke"/>';
  });
  return s + '</svg>';
}

// Attach to window for inline HTML handlers
window.showBarTip = showBarTip;
window.hideBarTip = hideBarTip;
