import { esc } from './utils.js';
import { state } from './state.js';

function openLoyaltyTop50() {
  var customers = (state.SD && state.SD._customers) || [];
  var ranked = customers
    .filter(function(c) { return (c.loyaltyPoints || 0) > 0; })
    .map(function(c) {
      return {
        name: ((c.name || '') || ((c.firstName || '') + ' ' + (c.lastName || '')).trim() || 'Unknown').trim(),
        points: c.loyaltyPoints || 0,
        lastVisit: c.updatedAt ? new Date(c.updatedAt).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }) : ''
      };
    })
    .sort(function(a, b) { return b.points - a.points; })
    .slice(0, 50);
  var html = '';
  html += '<div style="display:grid;grid-template-columns:28px 1fr 70px 70px;gap:6px;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.1em;padding:0 0 6px;border-bottom:1px solid #2e2e2e;margin-bottom:2px">';
  html += '<span>#</span><span>Name</span><span style="text-align:right">Points</span><span style="text-align:right">Last Visit</span>';
  html += '</div>';
  ranked.forEach(function(c, i) {
    var rankColor = i < 3 ? '#c8922a' : '#555';
    var ptsColor = i < 3 ? '#c8922a' : i < 10 ? '#e0a830' : '#aaa';
    html += '<div style="display:grid;grid-template-columns:28px 1fr 70px 70px;gap:6px;padding:6px 0;border-bottom:1px solid #1e1e1e;font-size:14px;align-items:center">';
    html += '<span style="color:' + rankColor + ';font-weight:bold">' + (i + 1) + '</span>';
    html += '<span style="color:#f0e8d8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(c.name) + '</span>';
    html += '<span style="color:' + ptsColor + ';font-weight:bold;text-align:right">' + c.points.toLocaleString() + '</span>';
    html += '<span style="color:#666;font-size:12px;text-align:right">' + esc(c.lastVisit) + '</span>';
    html += '</div>';
  });
  document.getElementById('loyaltyModalBody').innerHTML = html;
  document.getElementById('loyaltyModal').classList.add('open');
}

// ── Loyalty lookup: wired after panel render ──
export function initLoyaltyLookup() {
  var input = document.getElementById('loyalty-search');
  if (!input) return;
  var link = document.getElementById('loyalty-top50-link');
  if (link) link.addEventListener('click', openLoyaltyTop50);
  var results = document.getElementById('loyalty-results');
  input.addEventListener('input', function() {
    var q = input.value.trim().toLowerCase();
    if (q.length < 2) { results.innerHTML = '<div style="color:#555;font-size:13px;padding:6px 0">Type at least 2 characters\u2026</div>'; return; }
    var customers = (state.SD && state.SD._customers) || [];
    var matches = customers.filter(function(c) {
      var name = ((c.name || '') || ((c.firstName || '') + ' ' + (c.lastName || '')).trim()).toLowerCase();
      return name.indexOf(q) !== -1;
    }).slice(0, 20);
    if (!matches.length) { results.innerHTML = '<div style="color:#666;font-size:13px;padding:6px 0">No matches</div>'; return; }
    var html = '';
    matches.forEach(function(c) {
      var name = esc((c.name || '') || ((c.firstName || '') + ' ' + (c.lastName || '')).trim() || 'Unknown');
      var pts = c.loyaltyPoints || 0;
      var isLoyal = c.isLoyal || pts > 0;
      var badge = isLoyal ? '<span style="color:#c8922a;font-size:11px;margin-left:6px">LOYALTY</span>' : '';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #222">';
      html += '<div style="min-width:0;flex:1"><span style="color:#f0e8d8;font-size:15px">' + name + '</span>' + badge + '</div>';
      html += '<div style="text-align:right;flex-shrink:0;margin-left:12px">';
      html += '<span style="font-size:18px;font-weight:bold;color:' + (pts > 0 ? '#c8922a' : '#555') + '">' + pts.toLocaleString() + '</span>';
      html += '<span style="font-size:12px;color:#666;margin-left:4px">pts</span>';
      html += '</div></div>';
    });
    results.innerHTML = html;
  });
}

export function renderCustomersHTML() {
  var SD = state.SD;
  var h = '';

  // ── Loyalty Point Lookup ──
  h += '<div class="box" style="border-left:4px solid #c8922a">';
  h += '<div class="boxtitle" style="margin-bottom:8px">Loyalty Point Lookup</div>';
  h += '<input id="loyalty-search" type="text" placeholder="Search customer by name\u2026" autocomplete="off" spellcheck="false" style="width:100%;background:#0a0a0a;border:1px solid #444;color:#f0e8d8;padding:10px 12px;border-radius:4px;font-size:15px;font-family:inherit;outline:none;margin-bottom:8px">';
  h += '<div id="loyalty-results" style="max-height:260px;overflow-y:auto"><div style="color:#555;font-size:13px;padding:6px 0">Type a customer name to look up their points\u2026</div></div>';
  h += '</div>';

  // ── Stats cards ──
  h += '<div class="grid2">';
  h += '<div class="card g"><div class="clabel">Total Customers</div><div class="cval">' + SD.totalCustomers.toLocaleString() + '</div></div>';
  h += '<div class="card r"><div class="clabel">Churn Risk</div><div class="cval">' + SD.churnRisk + '</div><div class="csub">inactive 60+ days</div></div>';
  h += '<div class="card"><div class="clabel">New Today</div><div class="cval">' + SD.newCustomersToday + '</div></div>';
  h += '<div class="card"><div class="clabel">New This Week</div><div class="cval">' + SD.newCustomersWeek + '</div></div>';
  h += '<div class="card"><div class="clabel">New This Month</div><div class="cval">' + SD.newCustomers + '</div></div>';
  h += '<div class="card g"><div class="clabel">Loyalty Members</div><div class="cval">' + SD.loyalCustomers.toLocaleString() + '</div><div class="csub"><button class="cat-link" id="loyalty-top50-link" style="font-size:13px">top 50</button></div></div>';
  h += '</div>';
  h += '<div class="grid2">';
  h += '<div class="card"><div class="clabel">New / Day (Last 7d)</div><div class="cval">' + (SD.newCustomersPerDay7||0).toFixed(1) + '</div><div class="csub">avg per day</div></div>';
  h += '<div class="card"><div class="clabel">New / Day (Last 30d)</div><div class="cval">' + (SD.newCustomersPerDay30||0).toFixed(1) + '</div><div class="csub">avg per day</div></div>';
  h += '</div>';

  // ── New vs Returning ──
  if (SD.newVsReturning) {
    var nvr = SD.newVsReturning;
    function nvrRow(label, d) {
      var tot = d.newC + d.ret;
      var pN = tot ? Math.round(d.newC / tot * 100) : 0, pR = tot ? 100 - pN : 0;
      return '<div style="margin-bottom:13px">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px">' +
          '<span style="font-size:12px;color:#666;text-transform:uppercase;letter-spacing:.08em">' + label + '</span>' +
          '<span style="font-size:12px;color:#888">' + d.newC.toLocaleString() + ' new &nbsp;&middot;&nbsp; ' + d.ret.toLocaleString() + ' returning</span>' +
        '</div>' +
        '<div style="height:7px;background:#1e1e1e;border-radius:4px;overflow:hidden;display:flex">' +
          '<div style="width:' + pN + '%;background:#c8922a;border-radius:4px 0 0 4px"></div>' +
          '<div style="width:' + pR + '%;background:#5dcc8a;border-radius:0 4px 4px 0"></div>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;margin-top:3px">' +
          '<span style="color:#c8922a">' + pN + '% new</span>' +
          '<span style="color:#5dcc8a">' + pR + '% returning</span>' +
        '</div>' +
      '</div>';
    }
    h += '<div class="box"><div class="boxtitle">New vs Returning Customers</div>';
    h += nvrRow('Today', nvr.today);
    h += nvrRow('Last 7 Days', nvr.d7);
    h += nvrRow('Last 30 Days', nvr.d30);
    h += '</div>';
  }

  // ── Loyalty Growth Chart ──
  if (SD.loyaltyGrowth && SD.loyaltyGrowth.length > 1) {
    var lgv = SD.loyaltyGrowth, n = lgv.length;
    var lgMin = lgv[0].count, lgMax = lgv[n-1].count, lgRange = lgMax - lgMin || 1;
    var lgPts = lgv.map(function(d, i) {
      return (i/(n-1)*100).toFixed(2) + ',' + (50 - ((d.count - lgMin)/lgRange*46)).toFixed(2);
    }).join(' ');
    var lgArea = '0,56 ' + lgPts + ' 100,56';
    var gained = lgMax - lgMin;
    h += '<div class="box">';
    h += '<div class="boxtitle" style="display:flex;justify-content:space-between;align-items:center"><span>Loyalty Member Growth \u2014 30 Days</span><span class="' + (gained >= 0 ? 'green' : 'red') + '" style="font-size:13px">' + (gained >= 0 ? '+' : '') + gained + ' new</span></div>';
    h += '<svg style="width:100%;height:60px;display:block;overflow:visible" viewBox="0 0 100 56" preserveAspectRatio="none">';
    h += '<polygon points="' + lgArea + '" fill="#c8922a" opacity="0.1"/>';
    h += '<polyline points="' + lgPts + '" fill="none" stroke="#c8922a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';
    lgv.forEach(function(d, i) {
      var x = (i/(n-1)*100).toFixed(2), y = (50-((d.count-lgMin)/lgRange*46)).toFixed(2);
      h += '<circle cx="' + x + '" cy="' + y + '" r="1.5" fill="#c8922a" vector-effect="non-scaling-stroke" data-tip="' + d.date.slice(5) + ': ' + d.count.toLocaleString() + ' members" onmouseenter="showBarTip(event,this.getAttribute(\'data-tip\'))" onmouseleave="hideBarTip()" style="pointer-events:all;cursor:default"/>';
    });
    h += '</svg>';
    h += '<div class="bar-labels"><span style="font-size:12px" class="muted">' + lgv[0].date.slice(5) + '</span><span style="font-size:12px" class="muted">' + lgv[n-1].date.slice(5) + '</span></div>';
    h += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-top:4px"><span class="muted">' + lgMin.toLocaleString() + ' members</span><span class="muted">' + lgMax.toLocaleString() + ' members</span></div>';
    h += '</div>';
  }
  return h;
}
