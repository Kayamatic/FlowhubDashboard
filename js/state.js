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

var CACHE_KEY = 'flowhub_cache', CACHE_TTL = 3 * 60 * 1000;

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
  var btn = document.getElementById('reloadBtn');
  btn.style.color = '#c8922a';
  btn.style.animation = 'spin 1s linear infinite';
  state.SD = null; state.defaultSD = null; state._pre7d = null; state._pre30d = null;
  init();
}

export async function init() {
  // Check if this is a demo session
  try {
    var sessResp = await fetch('/api/session-info');
    var sessInfo = await sessResp.json();
    state.isDemo = sessInfo.demo || false;
  } catch(e) { state.isDemo = false; }

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
    var fourWeeksBackStr = localDateStr(new Date(now.getTime() - 29 * 86400000));
    var mo = [weekStartStr, monthStartStr, thirtyDaysAgo, lastMonthStartStr, monthBeforeLastStartStr, weekBeforeLastStartStr, fourWeeksBackStr].sort()[0];

    var ordersP    = fetch('/api/orders?start_date=' + mo + '&end_date=' + today).then(function(r) { return r.json(); });
    var inventoryP = fetch('/api/inventory').then(function(r) { return r.json(); });
    var customersP = fetch('/api/customers').then(function(r) { return r.json(); });

    var rawP = await inventoryP;
    var rawC = await customersP;
    var products  = rawP.data || (Array.isArray(rawP) ? rawP : []);
    var customers = rawC.data || (Array.isArray(rawC) ? rawC : []);

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

    var nc7  = customers.filter(function(c) { return new Date(c.createdAt || 0) >= new Date(now.getTime() -  7 * 86400000); }).length;
    var nc30 = customers.filter(function(c) { return new Date(c.createdAt || 0) >= new Date(now.getTime() - 30 * 86400000); }).length;
    var loyalAll = customers.filter(function(c) { return c.isLoyal || c.loyaltyPoints > 0; });
    var loyalDates = loyalAll.map(function(c) {
      return c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) : '2000-01-01';
    }).sort();
    function lgBisect(arr, val) { var lo=0,hi=arr.length; while(lo<hi){var m=lo+hi>>1; if(arr[m]<=val)lo=m+1; else hi=m;} return lo; }
    var lgData = [];
    for (var di = 29; di >= 0; di--) {
      var lgDay  = new Date(now.getTime() - di * 86400000);
      var lgDate = lgDay.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      lgData.push({ date: lgDate, count: lgBisect(loyalDates, lgDate) });
    }

    state.SD = Object.assign(state.SD || {}, {
      salesReady: false,
      todayRev: 0, todayCount: 0,
      weekRev: 0, weekCount: 0,
      monthRev: 0, monthCount: 0,
      hourly: [0,0,0,0,0,0,0,0,0,0,0,0],
      hourlyCount: [0,0,0,0,0,0,0,0,0,0,0,0],
      topProducts: [],
      totalSkus: inStockAll.length,
      cannabisSkus: cannabisSkus,
      accessorySkus: accessorySkus,
      lowStock: low,
      cats: cats,
      allProducts: allProducts,
      weightItems: weightItems,
      totalCustomers: customers.length,
      newCustomersToday: customers.filter(function(c) { return c.createdAt && new Date(c.createdAt).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) === nowESTDate; }).length,
      newCustomersWeek:  customers.filter(function(c) { return new Date(c.createdAt || 0) >= weekStartBound; }).length,
      newCustomers: customers.filter(function(c) { return new Date(c.createdAt || 0) >= monthStartBound; }).length,
      loyalCustomers: customers.filter(function(c) { return c.isLoyal || c.loyaltyPoints > 0; }).length,
      churnRisk: customers.filter(function(c) { var l = new Date(c.updatedAt || 0); return l < t60 && l.getFullYear() > 2000; }).length,
      newCustomersPerDay7:  +(nc7  / 7).toFixed(1),
      newCustomersPerDay30: +(nc30 / 30).toFixed(1),
      loyaltyGrowth: lgData,
      _customers: customers
    });

    var _mode2 = state.isDemo ? 'demo' : 'live';
    document.getElementById('dot').className = 'dot ' + _mode2;
    document.getElementById('badge').textContent = state.isDemo ? 'DEMO' : 'LIVE';
    document.getElementById('badge').className = 'badge ' + _mode2;
    document.getElementById('sync').textContent = 'inventory ready \u2014 loading orders\u2026';
    if (low.length) { var lb = document.getElementById('lowbadge'); lb.textContent = low.length + ' LOW STOCK'; lb.style.display = 'inline'; }
    renderPanel();

    var rawO = await ordersP;
    var orders = rawO.orders || (Array.isArray(rawO) ? rawO : []);
    function oTotal(o) { if (!o.totals) return 0; return (o.totals.subTotal || 0) - (o.totals.totalDiscounts || 0); }
    function sumOrders(arr) { return arr.reduce(function(s, o) { return s + oTotal(o); }, 0); }

    orders = orders.filter(function(o) { return o.orderStatus === 'sold' && !o.voided; });
    var todayLocal     = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    var yesterdayLocal = new Date(now.getTime() - 86400000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    var tO = orders.filter(function(o) {
      if (!o.completedOn) return false;
      return new Date(o.completedOn).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) === todayLocal;
    });
    var yO = orders.filter(function(o) {
      if (!o.completedOn) return false;
      return new Date(o.completedOn).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) === yesterdayLocal;
    });
    var wO = orders.filter(function(o) { return o.completedOn && new Date(o.completedOn) >= weekStartBound; });
    var mO = orders.filter(function(o) { return o.completedOn && new Date(o.completedOn) >= monthStartBound; });
    var lastWeekStartBound = new Date(estToISO(lastWeekStartStr, '00:00:00'));
    var lastWeekEndBound   = new Date(estToISO(lastWeekEndStr,   '23:59:59'));
    var lastMonthStartBound = new Date(estToISO(lastMonthStartStr, '00:00:00'));
    var lastMonthEndBound   = new Date(estToISO(lastMonthEndStr,   '23:59:59'));
    var lwO  = orders.filter(function(o) { return o.completedOn && new Date(o.completedOn) >= lastWeekStartBound  && new Date(o.completedOn) <= lastWeekEndBound; });
    var lmO  = orders.filter(function(o) { return o.completedOn && new Date(o.completedOn) >= lastMonthStartBound && new Date(o.completedOn) <= lastMonthEndBound; });

    // ---- Color baselines for sales cards ----
    function msSinceMidnightEst(d) {
      var s = new Date(d).toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      var p = s.split(':').map(Number);
      return ((p[0] * 3600) + (p[1] * 60) + p[2]) * 1000;
    }
    function estDateOf(d) { return new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); }
    var nowMsToday = msSinceMidnightEst(now);

    // Today: avg of last 4 same-weekdays, partial up to current time-of-day
    var tBl = [];
    for (var k = 1; k <= 4; k++) {
      var ds = estDateOf(new Date(now.getTime() - k * 7 * 86400000));
      var s = 0;
      orders.forEach(function(o) {
        if (!o.completedOn || estDateOf(o.completedOn) !== ds) return;
        if (msSinceMidnightEst(o.completedOn) <= nowMsToday) s += oTotal(o);
      });
      tBl.push(s);
    }
    var blToday = tBl.reduce(function(a,b){return a+b;},0) / 4;

    // Yesterday: avg of 4 same-weekdays prior to yesterday (full days)
    var yBl = [];
    for (var k = 1; k <= 4; k++) {
      var ds = estDateOf(new Date(now.getTime() - 86400000 - k * 7 * 86400000));
      var s = 0;
      orders.forEach(function(o) { if (o.completedOn && estDateOf(o.completedOn) === ds) s += oTotal(o); });
      yBl.push(s);
    }
    var blYesterday = yBl.reduce(function(a,b){return a+b;},0) / 4;

    // This Week: last week's revenue through equivalent elapsed point
    var weekElapsedMs = now.getTime() - weekStartBound.getTime();
    var lwCutoff = lastWeekStartBound.getTime() + weekElapsedMs;
    var blWeek = 0;
    orders.forEach(function(o) {
      if (!o.completedOn) return;
      var t = new Date(o.completedOn).getTime();
      if (t >= lastWeekStartBound.getTime() && t <= lwCutoff) blWeek += oTotal(o);
    });

    // This Month: last month through same day-of-month and time-of-day
    var todayDom = parseInt(nowESTDate.slice(8, 10));
    var blMonth = 0;
    orders.forEach(function(o) {
      if (!o.completedOn) return;
      var ds = estDateOf(o.completedOn);
      if (ds < lastMonthStartStr || ds > lastMonthEndStr) return;
      var dom = parseInt(ds.slice(8, 10));
      if (dom < todayDom) { blMonth += oTotal(o); return; }
      if (dom === todayDom && msSinceMidnightEst(o.completedOn) <= nowMsToday) blMonth += oTotal(o);
    });

    // Last Week: week before last
    var weekBeforeLastStartBound = new Date(estToISO(weekBeforeLastStartStr, '00:00:00'));
    var weekBeforeLastEndBound   = new Date(estToISO(weekBeforeLastEndStr,   '23:59:59'));
    var blLastWeek = orders.filter(function(o) { return o.completedOn && new Date(o.completedOn) >= weekBeforeLastStartBound && new Date(o.completedOn) <= weekBeforeLastEndBound; }).reduce(function(s,o){return s+oTotal(o);},0);

    // Last Month: month before last
    var monthBeforeLastStartBound = new Date(estToISO(monthBeforeLastStartStr, '00:00:00'));
    var monthBeforeLastEndBound   = new Date(estToISO(monthBeforeLastEndStr,   '23:59:59'));
    var blLastMonth = orders.filter(function(o) { return o.completedOn && new Date(o.completedOn) >= monthBeforeLastStartBound && new Date(o.completedOn) <= monthBeforeLastEndBound; }).reduce(function(s,o){return s+oTotal(o);},0);
    var t7bound  = new Date(now.getTime() -  7 * 86400000);
    var t30bound = new Date(now.getTime() - 30 * 86400000);
    var d7O  = orders.filter(function(o) { return o.completedOn && new Date(o.completedOn) >= t7bound;  });
    var d30O = orders.filter(function(o) { return o.completedOn && new Date(o.completedOn) >= t30bound; });

    var hm = [0,0,0,0,0,0,0,0,0,0,0,0];
    var hc = [0,0,0,0,0,0,0,0,0,0,0,0];
    tO.forEach(function(o) { var hr = nyHour(o.completedOn); if (hr >= 9 && hr <= 20) { hm[hr - 9] += oTotal(o); hc[hr - 9]++; } });

    function buildTopProducts(orderSet) {
      var pm = {};
      orderSet.forEach(function(o) {
        (o.itemsInCart || []).forEach(function(i) {
          var n = i.productName || 'Unknown';
          if (!pm[n]) pm[n] = { rev: 0, units: 0 };
          pm[n].rev   += (i.totalPrice || 0);
          pm[n].units += (i.quantity  || 1);
        });
      });
      return Object.keys(pm).map(function(k) { return { name: k, rev: Math.round(pm[k].rev), units: pm[k].units }; }).sort(function(a, b) { return b.rev - a.rev; }).slice(0, 20);
    }
    var top      = buildTopProducts(mO);
    var topToday = buildTopProducts(tO);
    var topWeek  = buildTopProducts(wO);

    function buildFastestDepleting(orderSet) {
      var pm = {};
      orderSet.forEach(function(o) {
        (o.itemsInCart || []).forEach(function(i) {
          var n = i.productName || 'Unknown';
          if (!pm[n]) pm[n] = { rev: 0, units: 0 };
          pm[n].rev   += (i.totalPrice || 0);
          pm[n].units += (i.quantity  || 1);
        });
      });
      return Object.keys(pm).map(function(k) { return { name: k, rev: Math.round(pm[k].rev), units: pm[k].units }; }).sort(function(a, b) { return b.units - a.units; }).slice(0, 20);
    }
    var dep7d  = buildFastestDepleting(d7O);
    var dep30d = buildFastestDepleting(d30O);

    var custIdMap = {};
    customers.forEach(function(c) { var id = c.id || c._id || c.customerId; if (id) custIdMap[id] = c.createdAt; });
    function calcNvR(orderSet, periodStart, newCount) {
      var retIds = new Set();
      orderSet.forEach(function(o) {
        var cid = o.customerId; if (!cid) return;
        var ca = custIdMap[cid]; if (!ca) return;
        if (new Date(ca) < periodStart) retIds.add(cid);
      });
      var n = newCount, r = retIds.size, tot = n + r;
      return { newC: n, ret: r, pctNew: tot ? Math.round(n / tot * 100) : 0, pctRet: tot ? Math.round(r / tot * 100) : 0 };
    }
    var todayStart = new Date(estToISO(todayLocal, '00:00:00'));
    var newVsReturning = {
      today: calcNvR(tO,  todayStart, state.SD.newCustomersToday || 0),
      d7:    calcNvR(d7O, t7bound,    customers.filter(function(c) { return new Date(c.createdAt || 0) >= t7bound; }).length),
      d30:   calcNvR(d30O, t30bound,  customers.filter(function(c) { return new Date(c.createdAt || 0) >= t30bound; }).length)
    };

    Object.assign(state.SD, {
      salesReady: true,
      todayRev: +sumOrders(tO).toFixed(2),
      todayCount: tO.length,
      yesterdayRev: +sumOrders(yO).toFixed(2),
      yesterdayCount: yO.length,
      weekRev: +sumOrders(wO).toFixed(2),
      weekCount: wO.length,
      monthRev: +sumOrders(mO).toFixed(2),
      monthCount: mO.length,
      lastWeekRev: +sumOrders(lwO).toFixed(2),
      lastWeekCount: lwO.length,
      lastWeekLabel: lastWeekStartStr + ' – ' + lastWeekEndStr,
      lastMonthRev: +sumOrders(lmO).toFixed(2),
      lastMonthCount: lmO.length,
      lastMonthLabel: lastMonthStartStr.slice(0, 7),
      hourly: hm,
      hourlyCount: hc,
      topProducts: top,
      topProductsToday: topToday,
      topProductsWeek: topWeek,
      fastestDepleting7d: dep7d,
      fastestDepleting30d: dep30d,
      newVsReturning: newVsReturning,
      blToday: +blToday.toFixed(2),
      blYesterday: +blYesterday.toFixed(2),
      blWeek: +blWeek.toFixed(2),
      blMonth: +blMonth.toFixed(2),
      blLastWeek: +blLastWeek.toFixed(2),
      blLastMonth: +blLastMonth.toFixed(2)
    });
    state.defaultSD = Object.assign({}, state.SD);
    saveCache(state.SD);

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
      state._autoRefreshTimer = setInterval(function() { state._silentMode = true; reloadData(); }, 3 * 60 * 1000);
    }
  } catch(e) {
    if (!cached) {
      document.getElementById('badge').textContent = 'ERROR';
      addMsg('assistant', 'Error loading data: ' + e.message, false);
    }
    console.error(e);
  }
}

// Attach to window for inline HTML handlers
window.reloadData = reloadData;
window.setPreset = setPreset;
window.applyCustom = applyCustom;
