import { esc, fmtMoney, fmtFull, localDateStr, estToISO, nyHour } from './utils.js';
import { renderPanel } from './sales.js';
import { addMsg } from './chat.js';

// ── Shared state ──
export var state = {
  SD: null,
  defaultSD: null,
  aiKey: '',
  currentTab: 'sales',
  chatHistory: [],
  busy: false,
  activePreset: 'default',
  _autoRefreshTimer: null,
  _silentMode: false,
  _pre7d: null,
  _pre30d: null,
  _mobileView: 'data'
};

var CACHE_KEY = 'flowhub_cache_v2', CACHE_TTL = 3 * 60 * 1000;

// ── Module-level fetch helper (also used by backgroundRefresh) ─────────────────
function fetchJSON(url) {
  return fetch(url).then(function(r) {
    if (r.status === 401) { localStorage.removeItem(CACHE_KEY); window.location.href = '/login'; throw new Error('session_expired'); }
    return r.json();
  });
}

// ── True background refresh — silent, no loading states, sales-stats only ─────
var _lastFullRefresh = 0;
var FULL_REFRESH_INTERVAL = 15 * 60 * 1000; // full init (inventory + customers) every 15 min

async function backgroundRefresh() {
  if (state._loading) return; // yield to any in-progress manual reload
  var now = Date.now();
  // Every 15 min fall back to full init to pick up inventory/customer changes
  if (now - _lastFullRefresh > FULL_REFRESH_INTERVAL) {
    state._silentMode = true;
    reloadData();
    return;
  }
  // Otherwise: fetch only sales-stats — the only thing that changes every 3 min
  try {
    var ss = await fetchJSON('/api/sales-stats');
    if (!state.SD || !state.SD.salesReady) return; // not initialized yet — skip
    Object.assign(state.SD, {
      salesReady: true,
      todayRev:       ss.todayRev        || 0,  todayCount:      ss.todayCount      || 0,
      yesterdayRev:   ss.yesterdayRev    || 0,  yesterdayCount:  ss.yesterdayCount  || 0,
      weekRev:        ss.weekRev         || 0,  weekCount:       ss.weekCount        || 0,
      monthRev:       ss.monthRev        || 0,  monthCount:      ss.monthCount       || 0,
      lastWeekRev:    ss.lastWeekRev     || 0,  lastWeekCount:   ss.lastWeekCount    || 0,
      lastWeekLabel:  ss.lastWeekLabel   || '',
      lastMonthRev:   ss.lastMonthRev    || 0,  lastMonthCount:  ss.lastMonthCount   || 0,
      lastMonthLabel: ss.lastMonthLabel  || '',
      hourly:         ss.hourly          || [0,0,0,0,0,0,0,0,0,0,0,0],
      hourlyCount:    ss.hourlyCount     || [0,0,0,0,0,0,0,0,0,0,0,0],
      topProducts:         ss.topProducts         || [],
      topProductsToday:    ss.topProductsToday    || [],
      topProductsWeek:     ss.topProductsWeek     || [],
      fastestDepleting7d:  ss.fastestDepleting7d  || [],
      fastestDepleting30d: ss.fastestDepleting30d || [],
      newVsReturning:      ss.newVsReturning       || {},
      blToday:      ss.blToday      || 0,  blYesterday:  ss.blYesterday  || 0,
      blWeek:       ss.blWeek       || 0,  blMonth:      ss.blMonth      || 0,
      blLastWeek:   ss.blLastWeek   || 0,  blLastMonth:  ss.blLastMonth  || 0
    });
    state.defaultSD = Object.assign({}, state.SD);
    saveCache(state.SD);
    document.getElementById('sync').textContent = 'synced ' + new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' EST';
    if (state.activePreset === 'default') renderPanel();
    prefetchRolling();
  } catch(e) {
    if (e.message !== 'session_expired') console.warn('[bg-refresh] silent fail:', e.message);
  }
}

export function loadCache() {
  try {
    var raw = localStorage.getItem(CACHE_KEY); if (!raw) return null;
    var obj = JSON.parse(raw);
    if (Date.now() - obj.ts > CACHE_TTL) return null;
    var todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    if (obj.date !== todayEST) {
      var sd = obj.sd;
      sd.todayRev = 0; sd.todayCount = 0;
      sd.yesterdayRev = 0; sd.yesterdayCount = 0;
      sd.hourly = [0,0,0,0,0,0,0,0,0,0,0,0];
      sd.hourlyCount = [0,0,0,0,0,0,0,0,0,0,0,0];
      sd.topProductsToday = [];
      sd.salesReady = false;
    }
    return obj.sd;
  } catch(e) { return null; }
}

export function saveCache(sd) {
  var todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  try {
    var clone = Object.assign({}, sd);
    delete clone._customers;
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), date: todayEST, sd: clone }));
  } catch(e) {}
}

export function setPreset(p) {
  ['default','today','yesterday','week','month','custom'].forEach(function(x) {
    var b = document.getElementById('rp-' + x); if (b) b.className = 'rpbtn' + (x === p ? ' on' : '');
  });
  state.activePreset = p;
  document.getElementById('rcRow').style.display = p === 'custom' ? 'flex' : 'none';
  if (p === 'custom') return;
  if (p === 'default') { state.SD = state.defaultSD; renderPanel(); return; }
  var now = new Date(), start, end = now.toISOString(), label;
  if (p === 'today') {
    start = estToISO(localDateStr(now), '00:00:00'); label = "Today's";
  } else if (p === 'yesterday') {
    var yStr = localDateStr(new Date(now - 86400000));
    start = estToISO(yStr, '00:00:00'); end = estToISO(yStr, '23:59:59'); label = "Yesterday's";
  } else if (p === 'week') {
    fetchRollingRange(7, 8, 'Last 7 Days'); return;
  } else if (p === 'month') {
    fetchRollingRange(30, 8, 'Last 30 Days'); return;
  }
  fetchRange(start, end, label);
}

export function applyCustom() {
  var s = document.getElementById('rStart').value, st = document.getElementById('rStartT').value || '00:00';
  var e = document.getElementById('rEnd').value,   et = document.getElementById('rEndT').value   || '23:59';
  if (!s || !e) { alert('Please set both a start and end date.'); return; }
  var startISO = estToISO(s, st + ':00'), endISO = estToISO(e, et + ':59');
  if (new Date(startISO) > new Date(endISO)) { alert('Start must be before end.'); return; }
  fetchRange(startISO, endISO, s + ' ' + st + ' \u2192 ' + e + ' ' + et);
}

export async function fetchRange(startISO, endISO, label) {
  if (!state.defaultSD) {
    document.getElementById('sync').textContent = 'waiting for data\u2026 try again in a moment';
    return;
  }
  document.getElementById('panel').innerHTML = '<div class="card"><div class="clabel">Loading ' + esc(label) + '\u2026</div><div class="cval muted loading-pulse" style="font-size:18px">Fetching orders<span class="ldots"></span></div></div>';
  try {
    var s0 = new Date(startISO), s1 = new Date(endISO);
    var spanMs = s1.getTime() - s0.getTime();
    var spanH = spanMs / 3600000;
    // Baseline strategy:
    //  <25h (intraday or single day) → avg of 4 prior same-weekdays (pace-adj if intraday)
    //  else (multi-day)              → abutting preceding window of equal length
    var useSameWeekday = spanH < 25;
    var fetchStartDateObj;
    if (useSameWeekday) {
      fetchStartDateObj = new Date(s0.getTime() - 4 * 7 * 86400000);
    } else {
      fetchStartDateObj = new Date(s0.getTime() - spanMs);
    }
    var apiStart = localDateStr(fetchStartDateObj);
    var apiEnd   = endISO.slice(0, 10);
    var r = await fetch('/api/orders?start_date=' + apiStart + '&end_date=' + apiEnd);
    var raw = await r.json();
    var allOrders = (raw.orders || (Array.isArray(raw) ? raw : [])).filter(function(o) { return o.orderStatus === 'sold' && !o.voided && o.completedOn; });
    function oRevX(o) { return o.totals ? (o.totals.subTotal || 0) - (o.totals.totalDiscounts || 0) : 0; }
    var orders = allOrders.filter(function(o) { var d = new Date(o.completedOn); return d >= s0 && d <= s1; });
    var rev = orders.reduce(function(a, o) { return a + oRevX(o); }, 0);
    var cnt = orders.length, avg = cnt ? rev / cnt : 0;
    var prevRev, prevAvg, blLabelDyn;
    if (useSameWeekday) {
      // Average 4 prior same-weekdays; each window = [s0-k*7d, s1-k*7d]
      var sumRev = 0, sumTx = 0;
      for (var k = 1; k <= 4; k++) {
        var ws = new Date(s0.getTime() - k * 7 * 86400000);
        var we = new Date(s1.getTime() - k * 7 * 86400000);
        var wo = allOrders.filter(function(o) { var d = new Date(o.completedOn); return d >= ws && d <= we; });
        sumRev += wo.reduce(function(a, o) { return a + oRevX(o); }, 0);
        sumTx  += wo.length;
      }
      prevRev = sumRev / 4;
      prevAvg = sumTx ? sumRev / sumTx : 0;
      blLabelDyn = spanH < 23 ? 'same weekday avg (4-wk, pace-adj)' : 'same weekday avg (4-wk)';
    } else {
      var prevStart = new Date(s0.getTime() - spanMs);
      var prevEnd   = new Date(s0.getTime());
      var prevOrders = allOrders.filter(function(o) { var d = new Date(o.completedOn); return d >= prevStart && d < prevEnd; });
      prevRev = prevOrders.reduce(function(a, o) { return a + oRevX(o); }, 0);
      var prevCnt = prevOrders.length;
      prevAvg = prevCnt ? prevRev / prevCnt : 0;
      blLabelDyn = 'preceding ' + Math.round(spanH / 24) + ' days';
    }
    var spanDays = (s1 - s0) / 86400000;
    var chart;
    if (spanDays <= 2) {
      var hm = [0,0,0,0,0,0,0,0,0,0,0,0], hc = [0,0,0,0,0,0,0,0,0,0,0,0];
      orders.forEach(function(o) { var h = nyHour(o.completedOn); if (h >= 9 && h <= 20) { hm[h-9] += (o.totals ? (o.totals.subTotal || 0) - (o.totals.totalDiscounts || 0) : 0); hc[h-9]++; } });
      chart = { type:'hourly', data:hm, countData:hc };
    } else {
      var dm = {}, dc = {};
      orders.forEach(function(o) { var d = new Date(o.completedOn).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); dm[d] = (dm[d]||0) + (o.totals ? (o.totals.subTotal || 0) - (o.totals.totalDiscounts || 0) : 0); dc[d] = (dc[d]||0) + 1; });
      chart = { type:'daily', data:dm, countData:dc };
    }
    var pm = {};
    orders.forEach(function(o) { (o.itemsInCart||[]).forEach(function(i) { var n = i.productName||'Unknown'; if (!pm[n]) pm[n] = {rev:0,units:0}; pm[n].rev += (i.totalPrice||0); pm[n].units += (i.quantity||1); }); });
    var top = Object.keys(pm).map(function(k) { return { name:k, rev:Math.round(pm[k].rev), units:pm[k].units }; }).sort(function(a,b) { return b.rev-a.rev; }).slice(0,20);
    state.SD = Object.assign({}, state.defaultSD, { rangeRev:+rev.toFixed(2), rangeCount:cnt, rangeAvg:+avg.toFixed(2), rangeChart:chart, rangeTopProducts:top, rangeLabel:label, blRangeRev:+prevRev.toFixed(2), blRangeAvg:+prevAvg.toFixed(2), blRangeLabel: blLabelDyn });
    renderPanel();
  } catch(e) {
    document.getElementById('panel').innerHTML = '<div class="card r"><div class="clabel">Error</div><div class="cval muted" style="font-size:16px">' + esc(e.message) + '</div></div>';
  }
}

function buildRollingSD(periodDays, nPeriods, label) {
  var totalDays = periodDays * nPeriods;
  var now = new Date();
  var endISO = now.toISOString();
  var histStartDate = localDateStr(new Date(now.getTime() - totalDays * 86400000));
  var mainStartISO  = estToISO(localDateStr(new Date(now.getTime() - periodDays * 86400000)), '00:00:00');
  return fetch('/api/orders?start_date=' + histStartDate + '&end_date=' + endISO.slice(0, 10))
    .then(function(r) { return r.json(); })
    .then(function(raw) {
      var allOrders = (raw.orders || (Array.isArray(raw) ? raw : []))
        .filter(function(o) { return o.orderStatus === 'sold' && !o.voided && o.completedOn; });
      var histBound = new Date(estToISO(histStartDate, '00:00:00')), endBound = new Date(endISO);
      allOrders = allOrders.filter(function(o) { var d = new Date(o.completedOn); return d >= histBound && d <= endBound; });
      function oRev(o) { return o.totals ? (o.totals.subTotal || 0) - (o.totals.totalDiscounts || 0) : 0; }
      var mainBound = new Date(mainStartISO);
      var mainOrders = allOrders.filter(function(o) { return new Date(o.completedOn) >= mainBound; });
      var rev = mainOrders.reduce(function(a, o) { return a + oRev(o); }, 0);
      var cnt = mainOrders.length, avg = cnt ? rev / cnt : 0;
      var prevBoundMs = mainBound.getTime() - periodDays * 86400000;
      var prevMainOrders = allOrders.filter(function(o) { var t = new Date(o.completedOn).getTime(); return t >= prevBoundMs && t < mainBound.getTime(); });
      var prevRev = prevMainOrders.reduce(function(a, o) { return a + oRev(o); }, 0);
      var prevCnt = prevMainOrders.length;
      var prevAvg = prevCnt ? prevRev / prevCnt : 0;
      var dm = {}, dc = {};
      mainOrders.forEach(function(o) { var d = new Date(o.completedOn).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); dm[d] = (dm[d]||0) + oRev(o); dc[d] = (dc[d]||0) + 1; });
      var pm = {};
      mainOrders.forEach(function(o) { (o.itemsInCart||[]).forEach(function(i) { var n = i.productName||'Unknown'; if (!pm[n]) pm[n] = {rev:0,units:0}; pm[n].rev += (i.totalPrice||0); pm[n].units += (i.quantity||1); }); });
      var top = Object.keys(pm).map(function(k) { return {name:k, rev:Math.round(pm[k].rev), units:pm[k].units}; }).sort(function(a,b) { return b.rev-a.rev; }).slice(0, 20);
      var rollingChart = [];
      for (var i = nPeriods - 1; i >= 0; i--) {
        var pEndMs = now.getTime() - i * periodDays * 86400000;
        var pStartMs = pEndMs - periodDays * 86400000;
        var pStart = new Date(pStartMs), pEnd = new Date(pEndMs);
        var pOrders = allOrders.filter(function(o) { var d = new Date(o.completedOn); return d >= pStart && d < pEnd; });
        var pRev = pOrders.reduce(function(a, o) { return a + oRev(o); }, 0);
        var opts = { month: 'short', day: 'numeric', timeZone: 'America/New_York' };
        var sLbl = pStart.toLocaleDateString('en-US', opts);
        var eLbl = new Date(pEndMs - 86400000).toLocaleDateString('en-US', opts);
        rollingChart.push({ shortLbl: sLbl, tipLabel: sLbl + '\u2013' + eLbl + ':  ' + fmtMoney(pRev) + (pOrders.length ? ' \u00b7 ' + pOrders.length + ' txns' : ''), rev: +pRev.toFixed(2) });
      }
      return { rangeRev: +rev.toFixed(2), rangeCount: cnt, rangeAvg: +avg.toFixed(2), rangeChart: { type: 'daily', data: dm, countData: dc }, rangeTopProducts: top, rangeLabel: label, rollingChart: rollingChart, rollingPeriodDays: periodDays, blRangeRev: +prevRev.toFixed(2), blRangeAvg: +prevAvg.toFixed(2), blRangeLabel: 'preceding ' + periodDays + ' days' };
    });
}

export function prefetchRolling() {
  state._pre7d  = buildRollingSD(7,  8, 'Last 7 Days');
  setTimeout(function() { state._pre30d = buildRollingSD(30, 8, 'Last 30 Days'); }, 500);
}

export async function fetchRollingRange(periodDays, nPeriods, label) {
  if (!state.defaultSD) { document.getElementById('sync').textContent = 'waiting for data\u2026 try again in a moment'; return; }
  var cached = periodDays === 7 ? state._pre7d : state._pre30d;
  if (!cached) {
    cached = buildRollingSD(periodDays, nPeriods, label);
    if (periodDays === 7) state._pre7d = cached; else state._pre30d = cached;
  }
  var resolved = false;
  cached.then(function() { resolved = true; }).catch(function() { resolved = true; });
  await new Promise(function(r) { setTimeout(r, 50); });
  if (!resolved) {
    document.getElementById('panel').innerHTML = '<div class="card"><div class="clabel">Loading ' + esc(label) + '\u2026</div><div class="cval muted loading-pulse" style="font-size:18px">Fetching orders<span class="ldots"></span></div></div>';
  }
  try {
    var data = await cached;
    state.SD = Object.assign({}, state.defaultSD, data);
    renderPanel();
  } catch(e) {
    document.getElementById('panel').innerHTML = '<div class="card r"><div class="clabel">Error</div><div class="cval muted" style="font-size:16px">' + esc(e.message) + '</div></div>';
  }
}

export function reloadData() {
  if (state._loading) return;
  var btn = document.getElementById('reloadBtn');
  if (btn) { btn.style.color = '#c8922a'; btn.style.animation = 'spin 1s linear infinite'; }
  state.defaultSD = null; state._pre7d = null; state._pre30d = null;
  init();
}

export async function init() {
  if (state._loading) return; // prevent double-init
  state._loading = true;

  var cached = loadCache();
  if (cached) {
    state.SD = cached;
    state.defaultSD = Object.assign({}, state.SD);
    var _mode = state.isDemo ? 'demo' : 'live';
    document.getElementById('dot').className = 'dot ' + _mode;
    document.getElementById('badge').textContent = state.isDemo ? 'DEMO' : 'CACHED';
    document.getElementById('badge').className = 'badge ' + _mode;
    document.getElementById('sync').textContent = 'cached \u2014 refreshing\u2026';
    if (state.SD.lowStock && state.SD.lowStock.length) { var clb = document.getElementById('lowbadge'); clb.textContent = state.SD.lowStock.length + ' LOW STOCK'; clb.style.display = 'inline'; }
    renderPanel();
  }

  try {
    var today = localDateStr(new Date());
    var now   = new Date();
    var nowESTDate   = now.toLocaleString('sv', { timeZone: 'America/New_York' }).split(' ')[0];
    var calDow       = new Date(nowESTDate + 'T12:00:00Z').getDay();
    var daysSinceMon = calDow === 0 ? 6 : calDow - 1;
    var weekStartStr  = localDateStr(new Date(now - daysSinceMon * 86400000));
    var monthStartStr = nowESTDate.slice(0, 8) + '01';
    var thirtyDaysAgo = localDateStr(new Date(now.getTime() - 30 * 86400000));
    var lastWeekEndStr   = localDateStr(new Date(new Date(weekStartStr + 'T12:00:00Z').getTime() - 86400000));
    var lastWeekStartStr = localDateStr(new Date(new Date(weekStartStr + 'T12:00:00Z').getTime() - 7 * 86400000));
    var lastMonthEndStr   = localDateStr(new Date(new Date(monthStartStr + 'T12:00:00Z').getTime() - 86400000));
    var lastMonthStartStr = lastMonthEndStr.slice(0, 8) + '01';
    var weekBeforeLastEndStr   = localDateStr(new Date(new Date(lastWeekStartStr + 'T12:00:00Z').getTime() - 86400000));
    var weekBeforeLastStartStr = localDateStr(new Date(new Date(lastWeekStartStr + 'T12:00:00Z').getTime() - 7 * 86400000));
    var monthBeforeLastEndStr   = localDateStr(new Date(new Date(lastMonthStartStr + 'T12:00:00Z').getTime() - 86400000));
    var monthBeforeLastStartStr = monthBeforeLastEndStr.slice(0, 8) + '01';
    var sessP       = fetch('/api/session-info').then(function(r) { return r.json(); }).catch(function() { return {}; });
    var salesStatsP = fetchJSON('/api/sales-stats');
    var inventoryP  = fetchJSON('/api/inventory');
    var custStatsP  = fetchJSON('/api/customer-stats');

    var sessInfo  = await sessP;
    state.isDemo  = sessInfo.demo || false;
    state.userRole = sessInfo.role || 'store_manager';
    var adminBtn = document.getElementById('adminBtn');
    if (adminBtn) adminBtn.style.display = (state.userRole === 'owner' && !state.isDemo) ? 'inline-block' : 'none';

    // ── Store switcher (multi-tenant users) ────────────────────────────────────
    (function initStoreSwitcher(info) {
      var sel = document.getElementById('storeSwitcher');
      if (!sel || !info.tenants || info.tenants.length <= 1) return;
      sel.style.display = 'inline-block';
      sel.innerHTML = '';
      info.tenants.forEach(function(t) {
        var opt = document.createElement('option');
        opt.value = t.tenant_id;
        opt.textContent = t.name || t.tenant_id;
        if (t.tenant_id === info.tenantId) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.onchange = function() {
        fetch('/api/switch-tenant', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({tenant_id: sel.value})})
          .then(function(r){ return r.json(); })
          .then(function(d){ if(d.ok) window.location.reload(); });
      };
    })(sessInfo);

    // ── Per-tenant store logo ─────────────────────────────────────────────────
    // When a tenant has uploaded a custom logo, swap out the default SVG for it
    // in both desktop header and mobile logo bar.
    (function applyStoreLogo(logoUrl) {
      var ids = [
        { sep: 'storeLogoSep',    img: 'storeLogoImg',    svg: 'storeLogoSvg'    },
        { sep: 'mobStoreLogoSep', img: 'mobStoreLogoImg', svg: 'mobStoreLogoSvg' }
      ];
      ids.forEach(function(pair) {
        var sep = document.getElementById(pair.sep);
        var img = document.getElementById(pair.img);
        var svg = document.getElementById(pair.svg);
        if (!img) return;
        if (logoUrl) {
          img.src = logoUrl;
          img.style.display = 'inline-block';
          if (sep) sep.style.display = 'inline';
          if (svg) svg.style.display = 'none';
        } else {
          img.src = '';
          img.style.display = 'none';
          if (sep) sep.style.display = 'none';
          if (svg) svg.style.display = 'inline';
        }
      });
    })(sessInfo.logoUrl || null);

    var rawP = await inventoryP;
    var custStats = await custStatsP;
    var products  = rawP.data || (Array.isArray(rawP) ? rawP : []);

    var _nameMap = {};
    products.forEach(function(p) {
      var name = (p.productName || p.variantName || 'Unknown').trim();
      var key  = name.toLowerCase();
      if (_nameMap[key]) {
        _nameMap[key].quantity      += parseInt(p.quantity      || 0);
        _nameMap[key].floorQuantity += parseInt(p.floorQuantity || 0);
        _nameMap[key].vaultQuantity += parseInt(p.vaultQuantity || 0);
      } else {
        _nameMap[key] = {
          name:          name,
          brand:         p.brand    || '',
          category:      p.category || 'Other',
          sku:           p.sku      || '',
          quantity:      parseInt(p.quantity      || 0),
          floorQuantity: parseInt(p.floorQuantity || 0),
          vaultQuantity: parseInt(p.vaultQuantity || 0),
          price:         p.preTaxPriceInPennies ? (p.preTaxPriceInPennies / 100) : (p.postTaxPriceInPennies ? (p.postTaxPriceInPennies / 100) : 0)
        };
      }
    });
    var allProducts = Object.values(_nameMap);

    var low = allProducts.filter(function(p) { return p.quantity <= 10; })
                         .map(function(p) { return { name: p.name, qty: p.quantity }; })
                         .sort(function(a, b) { return a.qty - b.qty; });
    var cm = {};
    allProducts.forEach(function(p) { var c = p.category || 'Other'; cm[c] = (cm[c] || 0) + 1; });
    var ptot = allProducts.length || 1;
    var PINNED_CATS = [/tincture/i, /concentrate/i];
    var allCatNames = Object.keys(cm);
    var pinnedNames = allCatNames.filter(function(k) { return PINNED_CATS.some(function(rx) { return rx.test(k); }); });
    var topCats = Object.keys(cm).map(function(k) { return { n: k, v: Math.round(cm[k] / ptot * 100), count: cm[k] }; }).sort(function(a, b) { return b.v - a.v; });
    var cats = topCats;
    var inStockAll    = allProducts.filter(function(p) { return p.quantity > 0; });
    var cannabisSkus  = inStockAll.filter(function(p) { return p.category !== 'Accessories'; }).length;
    var accessorySkus = inStockAll.filter(function(p) { return p.category === 'Accessories'; }).length;
    var _wDefs = [
      { label: '3.5g Flower', wt: /3\.5\s*g/i,  type: /flower/i },
      { label: '7g Flower',   wt: /\b7\s*g\b/i,  type: /flower/i },
      { label: '14g Flower',  wt: /\b14\s*g\b/i, type: /flower/i },
      { label: '28g Flower',  wt: /\b28\s*g\b/i, type: /flower/i },
      { label: '7g Shake',    wt: /\b7\s*g\b/i,  type: /shake/i  },
      { label: '14g Shake',   wt: /\b14\s*g\b/i, type: /shake/i  },
      { label: '28g Shake',   wt: /\b28\s*g\b/i, type: /shake/i  }
    ];
    var weightItems = _wDefs.map(function(wc) {
      var allMatch = allProducts.filter(function(p) { return wc.wt.test(p.name) && wc.type.test(p.name); });
      var inStk    = allMatch.filter(function(p) { return p.quantity > 0; });
      return { label: wc.label, qty: inStk.reduce(function(s, p) { return s + p.quantity; }, 0), products: allMatch };
    });

    var weekStartBound  = new Date(estToISO(weekStartStr,  '00:00:00'));
    var monthStartBound = new Date(estToISO(monthStartStr, '00:00:00'));
    var t60 = new Date(now - 60 * 86400000);

    var _hasSales = state.SD && state.SD.salesReady;
    state.SD = Object.assign(state.SD || {}, {
      // Keep existing sales data visible during refresh — only zero out on first load
      salesReady:   _hasSales ? state.SD.salesReady   : false,
      todayRev:     _hasSales ? state.SD.todayRev     : 0,
      todayCount:   _hasSales ? state.SD.todayCount   : 0,
      weekRev:      _hasSales ? state.SD.weekRev      : 0,
      weekCount:    _hasSales ? state.SD.weekCount    : 0,
      monthRev:     _hasSales ? state.SD.monthRev     : 0,
      monthCount:   _hasSales ? state.SD.monthCount   : 0,
      hourly:       _hasSales ? state.SD.hourly       : [0,0,0,0,0,0,0,0,0,0,0,0],
      hourlyCount:  _hasSales ? state.SD.hourlyCount  : [0,0,0,0,0,0,0,0,0,0,0,0],
      topProducts:  _hasSales ? state.SD.topProducts  : [],
      totalSkus: inStockAll.length,
      cannabisSkus: cannabisSkus,
      accessorySkus: accessorySkus,
      lowStock: low,
      cats: cats,
      allProducts: allProducts,
      weightItems: weightItems,
      totalCustomers:     custStats.total        || 0,
      newCustomersToday:  custStats.newToday      || 0,
      newCustomersWeek:   custStats.newWeek       || 0,
      newCustomers:       custStats.newMonth      || 0,
      loyalCustomers:     custStats.loyal         || 0,
      churnRisk:          custStats.churnRisk     || 0,
      newCustomersPerDay7:  +((custStats.newLast7  || 0) / 7).toFixed(1),
      newCustomersPerDay30: +((custStats.newLast30 || 0) / 30).toFixed(1),
      loyaltyGrowth:      custStats.loyaltyGrowth || [],
      _customers: null  // loaded lazily when Customers tab opens
    });

    var _mode2 = state.isDemo ? 'demo' : 'live';
    document.getElementById('dot').className = 'dot ' + _mode2;
    document.getElementById('badge').textContent = state.isDemo ? 'DEMO' : 'LIVE';
    document.getElementById('badge').className = 'badge ' + _mode2;
    document.getElementById('sync').textContent = _hasSales ? 'refreshing\u2026' : 'inventory ready \u2014 loading orders\u2026';
    if (low.length) { var lb = document.getElementById('lowbadge'); lb.textContent = low.length + ' LOW STOCK'; lb.style.display = 'inline'; }
    renderPanel();

    var ss = await salesStatsP;

    Object.assign(state.SD, {
      salesReady: true,
      todayRev:       ss.todayRev        || 0,  todayCount:      ss.todayCount      || 0,
      yesterdayRev:   ss.yesterdayRev    || 0,  yesterdayCount:  ss.yesterdayCount  || 0,
      weekRev:        ss.weekRev         || 0,  weekCount:       ss.weekCount        || 0,
      monthRev:       ss.monthRev        || 0,  monthCount:      ss.monthCount       || 0,
      lastWeekRev:    ss.lastWeekRev     || 0,  lastWeekCount:   ss.lastWeekCount    || 0,
      lastWeekLabel:  ss.lastWeekLabel   || '',
      lastMonthRev:   ss.lastMonthRev    || 0,  lastMonthCount:  ss.lastMonthCount   || 0,
      lastMonthLabel: ss.lastMonthLabel  || '',
      hourly:         ss.hourly          || [0,0,0,0,0,0,0,0,0,0,0,0],
      hourlyCount:    ss.hourlyCount     || [0,0,0,0,0,0,0,0,0,0,0,0],
      topProducts:         ss.topProducts         || [],
      topProductsToday:    ss.topProductsToday    || [],
      topProductsWeek:     ss.topProductsWeek     || [],
      fastestDepleting7d:  ss.fastestDepleting7d  || [],
      fastestDepleting30d: ss.fastestDepleting30d || [],
      newVsReturning:      ss.newVsReturning       || {},
      blToday:      ss.blToday      || 0,
      blYesterday:  ss.blYesterday  || 0,
      blWeek:       ss.blWeek       || 0,
      blMonth:      ss.blMonth      || 0,
      blLastWeek:   ss.blLastWeek   || 0,
      blLastMonth:  ss.blLastMonth  || 0
    });
    state.defaultSD = Object.assign({}, state.SD);
    saveCache(state.SD);
    _lastFullRefresh = Date.now(); // mark full refresh time for backgroundRefresh()

    document.getElementById('sync').textContent = 'synced ' + new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' EST';
    var rb = document.getElementById('reloadBtn'); rb.style.display = 'inline'; rb.style.color = '#555'; rb.style.animation = '';

    prefetchRolling();

    if (state.activePreset !== 'default') {
      setPreset(state.activePreset);
    } else {
      renderPanel();
    }

    if (!cached) {
      const _ts1 = new Date().toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York'});
      addMsg('assistant', (state.isDemo ? 'Demo data loaded' : 'Live Flowhub data loaded') + '! (as of ' + _ts1 + ')\n\nToday: $' + state.SD.todayRev.toLocaleString() + ' across ' + state.SD.todayCount + ' transactions\nThis month: $' + state.SD.monthRev.toLocaleString() + ' / ' + state.SD.monthCount + ' transactions\nLow stock: ' + low.length + ' SKUs\nChurn risk: ' + state.SD.churnRisk + ' customers\n\nAsk me anything about your store!', false);
    } else if (!state._silentMode) {
      const _ts2 = new Date().toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York'});
      addMsg('assistant', 'Data refreshed! (as of ' + _ts2 + ')\n\nToday: $' + state.SD.todayRev.toLocaleString() + ' (' + state.SD.todayCount + ' transactions)\nThis month: $' + state.SD.monthRev.toLocaleString() + ' / ' + state.SD.monthCount + ' transactions', false);
    }
    state._silentMode = false;

    if (!state._autoRefreshTimer) {
      state._autoRefreshTimer = setInterval(backgroundRefresh, 3 * 60 * 1000);
    }
  } catch(e) {
    if (!cached) {
      document.getElementById('badge').textContent = 'ERROR';
      addMsg('assistant', 'Error loading data: ' + e.message, false);
    }
    console.error(e);
  } finally {
    state._loading = false;
    var rb = document.getElementById('reloadBtn');
    if (rb) { rb.style.color = '#555'; rb.style.animation = ''; }
  }
}

// Attach to window for inline HTML handlers
window.reloadData = reloadData;
window.setPreset = setPreset;
window.applyCustom = applyCustom;
