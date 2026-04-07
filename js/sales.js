import { esc, fmtMoney, fmtFull, shortName, hrLbl, barMaxH, barWrapH, mkLineSvg } from './utils.js';
import { state } from './state.js';
import { renderInventoryHTML } from './inventory.js';
import { renderCustomersHTML, initLoyaltyLookup } from './customers.js';

export function setTab(t) {
  state.currentTab = t;
  ['sales','inventory','customers'].forEach(function(x) { document.getElementById('t-' + x).className = 'tab' + (x === t ? ' on' : ''); });
  document.getElementById('rangeBar').style.display = t === 'sales' ? '' : 'none';
  renderPanel();
}

export function renderPanel() {
  if (!state.SD) return;
  var h = '';
  if (state.currentTab === 'sales') {
    h = renderSalesHTML();
  }
  if (state.currentTab === 'inventory') {
    h = renderInventoryHTML();
  }
  if (state.currentTab === 'customers') {
    h = renderCustomersHTML();
  }
  document.getElementById('panel').innerHTML = h;
  if (state.currentTab === 'customers') { initLoyaltyLookup(); }
}

function colorBl(actual, baseline, label) {
  if (!baseline || baseline <= 0) return { cls: '', tip: 'No baseline yet (' + label + ')' };
  var d = (actual - baseline) / baseline;
  var cls = d > 0.05 ? ' g' : (d < -0.05 ? ' r' : '');
  var sign = d >= 0 ? '+' : '';
  return { cls: cls, tip: sign + (d * 100).toFixed(0) + '% vs ' + label + ' ($' + Math.round(baseline).toLocaleString() + ')' };
}

function renderSalesHTML() {
  var SD = state.SD;
  var h = '';
  if (SD.salesReady === false) {
    h += '<div class="card"><div class="clabel">Sales</div><div class="cval muted loading-pulse" style="font-size:17px">Loading orders<span class="ldots"></span></div><div class="csub">Inventory &amp; customers ready &#x2713;</div></div>';
  } else if (state.activePreset !== 'default' && SD.rangeRev !== undefined) {
    var rl = esc(SD.rangeLabel || 'Custom Range');
    h += '<div class="grid2">';
    var blLbl = SD.blRangeLabel || 'preceding window';
    var cRR = colorBl(SD.rangeRev, SD.blRangeRev, blLbl);
    var cRA = colorBl(SD.rangeAvg, SD.blRangeAvg, blLbl);
    h += '<div class="card' + cRR.cls + '" title="' + esc(cRR.tip) + '"><div class="clabel">' + rl + ' Revenue</div><div class="cval">' + fmtFull(SD.rangeRev) + '</div><div class="csub">' + SD.rangeCount + ' transactions</div></div>';
    h += '<div class="card' + cRA.cls + '" title="' + esc(cRA.tip) + '"><div class="clabel">Avg Basket</div><div class="cval">$' + SD.rangeAvg.toFixed(2) + '</div><div class="csub">per visit</div></div>';
    h += '</div>';
    if (SD.rollingChart && SD.rollingChart.length) {
      var rc = SD.rollingChart, mxRc = Math.max.apply(null, rc.map(function(p){return p.rev;}).concat([1]));
      var rcColor = SD.rollingPeriodDays === 7 ? 'linear-gradient(180deg,#c8922a,#6b4d15)' : 'linear-gradient(180deg,#5dcc8a,#1a5e35)';
      var rcTitle = SD.rollingPeriodDays === 7 ? 'Last 8 Weeks \u2014 Rolling 7-Day Revenue' : 'Last 8 Periods \u2014 Rolling 30-Day Revenue';
      h += '<div class="box"><div class="boxtitle">' + rcTitle + '</div><div class="bar-wrap" style="height:' + barWrapH(rc.length) + 'px">';
      rc.forEach(function(p) { var pct = p.rev / mxRc; h += '<div style="flex:1" data-tip="' + esc(p.tipLabel) + '" onmouseenter="showBarTip(event,this.dataset.tip)" onmouseleave="hideBarTip()"><div style="width:100%;border-radius:2px 2px 0 0;height:' + Math.max(4, pct * barMaxH(rc.length)) + 'px;background:' + rcColor + ';opacity:' + (0.4 + pct * 0.6) + '"></div></div>'; });
      h += '</div><div class="bar-labels"><span style="font-size:12px" class="muted">' + esc(rc[0].shortLbl) + '</span><span style="font-size:12px" class="muted">' + esc(rc[rc.length-1].shortLbl) + '</span></div></div>';
    }
    if (SD.rangeChart) {
      var cd = SD.rangeChart.data;
      if (SD.rangeChart.type === 'hourly') {
        var mx = Math.max.apply(null, cd.concat([1]));
        var cc = SD.rangeChart.countData || [], mxc = cc.length ? Math.max.apply(null, cc.concat([1])) : 1;
        h += '<div class="box"><div class="boxtitle" style="display:flex;justify-content:space-between;align-items:center"><span>Sales by Hour \u2014 ' + rl + '</span><span style="font-size:10px;color:#555"><span style="color:#c8922a">\u2588</span> rev &nbsp;<span style="color:#4a9edd">\u2014</span> txns</span></div><div style="position:relative"><div class="bar-wrap" style="height:70px">';
        cd.forEach(function(v, i) { var p=v/mx; var cnt=cc[i]||0; var tip=hrLbl(i)+':  '+fmtMoney(v)+(cnt?' | '+cnt+' txns':''); h+='<div style="flex:1" data-tip="' + tip + '" onmouseenter="showBarTip(event,this.dataset.tip)" onmouseleave="hideBarTip()"><div style="width:100%;border-radius:2px 2px 0 0;height:'+Math.max(4,p*65)+'px;background:linear-gradient(180deg,#c8922a,#6b4d15);opacity:'+(0.4+p*0.6)+'"></div></div>'; });
        h += '</div>' + (cc.length ? mkLineSvg(cc, mxc, 12) : '') + '</div><div class="bar-labels"><span style="font-size:12px" class="muted">9am</span><span style="font-size:12px" class="muted">8pm</span></div></div>';
        if (cc.length) {
          var ca = cd.map(function(r, i) { return cc[i] ? r / cc[i] : 0; });
          var mxa = Math.max.apply(null, ca.concat([1]));
          h += '<div class="box"><div class="boxtitle">Avg Basket by Hour \u2014 ' + rl + '</div><div class="bar-wrap" style="height:70px">';
          ca.forEach(function(v, i) { var p=v/mxa; h+='<div style="flex:1" data-tip="' + hrLbl(i) + ': $' + v.toFixed(2) + ' avg" onmouseenter="showBarTip(event,this.dataset.tip)" onmouseleave="hideBarTip()"><div style="width:100%;border-radius:2px 2px 0 0;height:'+Math.max(4,p*65)+'px;background:linear-gradient(180deg,#c084fc,#6b21a8);opacity:'+(0.4+p*0.6)+'"></div></div>'; });
          h += '</div><div class="bar-labels"><span style="font-size:12px" class="muted">9am</span><span style="font-size:12px" class="muted">8pm</span></div></div>';
        }
      } else {
        var keys = Object.keys(cd).sort(), vals = keys.map(function(k){return cd[k];}), mx = Math.max.apply(null,vals.concat([1]));
        var dcc = SD.rangeChart.countData || {}, dcvals = keys.map(function(k){return dcc[k]||0;}), mxc = Math.max.apply(null, dcvals.concat([1]));
        var dBH = barMaxH(keys.length), dWH = barWrapH(keys.length);
        h += '<div class="box"><div class="boxtitle" style="display:flex;justify-content:space-between;align-items:center"><span>Sales by Day \u2014 ' + rl + '</span><span style="font-size:10px;color:#555"><span style="color:#5dcc8a">\u2588</span> rev &nbsp;<span style="color:#4a9edd">\u2014</span> txns</span></div><div style="position:relative"><div class="bar-wrap" style="height:'+dWH+'px">';
        vals.forEach(function(v, i) { var p=v/mx; var cnt=dcvals[i]||0; var tip=(keys[i]||'')+':  '+fmtMoney(v)+(cnt?' | '+cnt+' txns':''); h+='<div style="flex:1" data-tip="' + tip + '" onmouseenter="showBarTip(event,this.dataset.tip)" onmouseleave="hideBarTip()"><div style="width:100%;border-radius:2px 2px 0 0;height:'+Math.max(4,p*dBH)+'px;background:linear-gradient(180deg,#5dcc8a,#1a5e35);opacity:'+(0.4+p*0.6)+'"></div></div>'; });
        h += '</div>' + mkLineSvg(dcvals, mxc, dcvals.length) + '</div><div class="bar-labels"><span style="font-size:12px" class="muted">'+(keys[0]?keys[0].slice(5):'')+'</span><span style="font-size:12px" class="muted">'+(keys[keys.length-1]?keys[keys.length-1].slice(5):'')+'</span></div></div>';
        var da = keys.map(function(k) { var cnt = dcc[k] || 0; return cnt ? cd[k] / cnt : 0; });
        var mxa = Math.max.apply(null, da.concat([1]));
        h += '<div class="box"><div class="boxtitle">Avg Basket by Day \u2014 ' + rl + '</div><div class="bar-wrap" style="height:'+dWH+'px">';
        da.forEach(function(v, i) { var p=v/mxa; h+='<div style="flex:1" data-tip="' + (keys[i]||'') + ': $' + v.toFixed(2) + ' avg" onmouseenter="showBarTip(event,this.dataset.tip)" onmouseleave="hideBarTip()"><div style="width:100%;border-radius:2px 2px 0 0;height:'+Math.max(4,p*dBH)+'px;background:linear-gradient(180deg,#c084fc,#6b21a8);opacity:'+(0.4+p*0.6)+'"></div></div>'; });
        h += '</div><div class="bar-labels"><span style="font-size:12px" class="muted">'+(keys[0]?keys[0].slice(5):'')+'</span><span style="font-size:12px" class="muted">'+(keys[keys.length-1]?keys[keys.length-1].slice(5):'')+'</span></div></div>';
      }
    }
    if (SD.rangeTopProducts && SD.rangeTopProducts.length) {
      h += '<div class="box"><div class="boxtitle" style="display:flex;justify-content:space-between;align-items:center"><span>Top Products \u2014 ' + rl + '</span><button class="see-more-btn" onclick="openRangeProducts()">See More</button></div>';
      SD.rangeTopProducts.slice(0, 5).forEach(function(p,i) { h+='<div class="row"><span><span class="muted">'+(i+1)+'.&nbsp;</span>'+esc(shortName(p.name))+'</span><span class="amber">$'+p.rev.toLocaleString()+'</span></div>'; });
      h += '</div>';
    }
  } else {
    h += '<div class="grid2">';
    var cT  = colorBl(SD.todayRev,        SD.blToday,     'same weekday avg (4-wk, pace-adj)');
    var cY  = colorBl(SD.yesterdayRev||0, SD.blYesterday, 'same weekday avg (4-wk)');
    var cW  = colorBl(SD.weekRev,         SD.blWeek,      'last week through same point');
    var cM  = colorBl(SD.monthRev,        SD.blMonth,     'last month through same day');
    var cLW = colorBl(SD.lastWeekRev||0,  SD.blLastWeek,  'week before');
    var cLM = colorBl(SD.lastMonthRev||0, SD.blLastMonth, 'month before');
    h += '<div class="card' + cT.cls  + '" title="' + esc(cT.tip)  + '"><div class="clabel">Today\'s Revenue</div><div class="cval">' + fmtFull(SD.todayRev) + '</div><div class="csub">' + SD.todayCount + ' transactions</div></div>';
    h += '<div class="card' + cY.cls  + '" title="' + esc(cY.tip)  + '"><div class="clabel">Yesterday\'s Revenue</div><div class="cval">' + fmtFull(SD.yesterdayRev || 0) + '</div><div class="csub">' + (SD.yesterdayCount || 0) + ' transactions</div></div>';
    h += '<div class="card' + cW.cls  + '" title="' + esc(cW.tip)  + '"><div class="clabel">This Week</div><div class="cval">' + fmtMoney(SD.weekRev) + '</div><div class="csub">' + SD.weekCount + ' transactions</div></div>';
    h += '<div class="card' + cM.cls  + '" title="' + esc(cM.tip)  + '"><div class="clabel">This Month</div><div class="cval">' + fmtMoney(SD.monthRev) + '</div><div class="csub">' + SD.monthCount + ' transactions</div></div>';
    h += '<div class="card' + cLW.cls + '" title="' + esc(cLW.tip) + '"><div class="clabel">Last Week</div><div class="cval">' + fmtMoney(SD.lastWeekRev || 0) + '</div><div class="csub">' + (SD.lastWeekCount || 0) + ' transactions</div><div class="csub muted" style="font-size:10px;margin-top:2px">' + (SD.lastWeekLabel || '') + '</div></div>';
    h += '<div class="card' + cLM.cls + '" title="' + esc(cLM.tip) + '"><div class="clabel">Last Month</div><div class="cval">' + fmtMoney(SD.lastMonthRev || 0) + '</div><div class="csub">' + (SD.lastMonthCount || 0) + ' transactions</div><div class="csub muted" style="font-size:10px;margin-top:2px">' + (SD.lastMonthLabel || '') + '</div></div>';
    h += '</div>';
    var mx = Math.max.apply(null, SD.hourly.concat([1]));
    var mxc = SD.hourlyCount ? Math.max.apply(null, SD.hourlyCount.concat([1])) : 1;
    h += '<div class="box"><div class="boxtitle" style="display:flex;justify-content:space-between;align-items:center"><span>Sales by Hour \u2014 Today</span><span style="font-size:10px;color:#555"><span style="color:#c8922a">\u2588</span> rev &nbsp;<span style="color:#4a9edd">\u2014</span> txns</span></div><div style="position:relative"><div class="bar-wrap" style="height:70px">';
    SD.hourly.forEach(function(s, i) {
      var pct = s / mx, cnt = SD.hourlyCount ? SD.hourlyCount[i] : 0;
      var tip = hrLbl(i) + ':  ' + fmtMoney(s) + (cnt ? ' | ' + cnt + ' txns' : '');
      h += '<div style="flex:1" data-tip="' + tip + '" onmouseenter="showBarTip(event,this.dataset.tip)" onmouseleave="hideBarTip()"><div style="width:100%;border-radius:2px 2px 0 0;height:' + Math.max(4, pct * 65) + 'px;background:linear-gradient(180deg,#c8922a,#6b4d15);opacity:' + (0.4 + pct * 0.6) + '"></div></div>';
    });
    h += '</div>' + (SD.hourlyCount ? mkLineSvg(SD.hourlyCount, mxc, 12) : '') + '</div><div class="bar-labels"><span style="font-size:12px" class="muted">9am</span><span style="font-size:12px" class="muted">8pm</span></div></div>';
    if (SD.hourlyCount) {
      var ha = SD.hourly.map(function(r, i) { return SD.hourlyCount[i] ? r / SD.hourlyCount[i] : 0; });
      var mxa = Math.max.apply(null, ha.concat([1]));
      h += '<div class="box"><div class="boxtitle">Avg Basket by Hour \u2014 Today</div><div class="bar-wrap" style="height:70px">';
      ha.forEach(function(v, i) { var p=v/mxa; h+='<div style="flex:1" data-tip="' + hrLbl(i) + ': $' + v.toFixed(2) + ' avg" onmouseenter="showBarTip(event,this.dataset.tip)" onmouseleave="hideBarTip()"><div style="width:100%;border-radius:2px 2px 0 0;height:'+Math.max(4,p*65)+'px;background:linear-gradient(180deg,#c084fc,#6b21a8);opacity:'+(0.4+p*0.6)+'"></div></div>'; });
      h += '</div><div class="bar-labels"><span style="font-size:12px" class="muted">9am</span><span style="font-size:12px" class="muted">8pm</span></div></div>';
    }
    if (SD.topProductsToday && SD.topProductsToday.length) {
      h += '<div class="box"><div class="boxtitle" style="display:flex;justify-content:space-between;align-items:center"><span>Top Products - Today</span><button class="see-more-btn" onclick="openTopProducts(\'topProductsToday\',\'Top 20 Products \u2014 Today\')">See More</button></div>';
      SD.topProductsToday.slice(0, 5).forEach(function(p, i) {
        h += '<div class="row"><span><span class="muted">' + (i + 1) + '.&nbsp;</span>' + esc(shortName(p.name)) + '</span><span class="amber">$' + p.rev.toLocaleString() + '</span></div>';
      });
      h += '</div>';
    }
    if (SD.topProductsWeek && SD.topProductsWeek.length) {
      h += '<div class="box"><div class="boxtitle" style="display:flex;justify-content:space-between;align-items:center"><span>Top Products - This Week</span><button class="see-more-btn" onclick="openTopProducts(\'topProductsWeek\',\'Top 20 Products \u2014 This Week\')">See More</button></div>';
      SD.topProductsWeek.slice(0, 5).forEach(function(p, i) {
        h += '<div class="row"><span><span class="muted">' + (i + 1) + '.&nbsp;</span>' + esc(shortName(p.name)) + '</span><span class="amber">$' + p.rev.toLocaleString() + '</span></div>';
      });
      h += '</div>';
    }
    if (SD.topProducts.length) {
      h += '<div class="box"><div class="boxtitle" style="display:flex;justify-content:space-between;align-items:center"><span>Top Products - This Month</span><button class="see-more-btn" onclick="openTopProducts(\'topProducts\',\'Top 20 Products \u2014 This Month\')">See More</button></div>';
      SD.topProducts.slice(0, 5).forEach(function(p, i) {
        h += '<div class="row"><span><span class="muted">' + (i + 1) + '.&nbsp;</span>' + esc(shortName(p.name)) + '</span><span class="amber">$' + p.rev.toLocaleString() + '</span></div>';
      });
      h += '</div>';
    }
  }
  return h;
}

export function openTopProducts(key, title) {
  var SD = state.SD;
  key = key || 'topProducts';
  title = title || 'Top 20 Products \u2014 This Month';
  var list = SD && SD[key];
  if (!list || !list.length) return;
  var h = '';
  list.forEach(function(p, i) {
    h += '<div class="modal-row">';
    h += '<span class="modal-rank">' + (i + 1) + '.</span>';
    h += '<span class="modal-name">' + esc(shortName(p.name)) + '</span>';
    if (p.units !== undefined) h += '<span class="modal-units">' + p.units.toLocaleString() + ' units</span>';
    h += '<span class="modal-rev">$' + p.rev.toLocaleString() + '</span>';
    h += '</div>';
  });
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = h;
  document.getElementById('topModal').classList.add('open');
}

export function openRangeProducts() {
  openTopProducts('rangeTopProducts', 'Top Products \u2014 ' + (state.SD && state.SD.rangeLabel ? state.SD.rangeLabel : 'Custom Range'));
}

// Attach to window for inline HTML handlers
window.setTab = setTab;
window.openTopProducts = openTopProducts;
window.openRangeProducts = openRangeProducts;
