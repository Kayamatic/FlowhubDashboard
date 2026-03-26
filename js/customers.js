import { state } from './state.js';

export function renderCustomersHTML() {
  var SD = state.SD;
  var h = '';
  h += '<div class="grid2">';
  h += '<div class="card g"><div class="clabel">Total Customers</div><div class="cval">' + SD.totalCustomers.toLocaleString() + '</div></div>';
  h += '<div class="card r"><div class="clabel">Churn Risk</div><div class="cval">' + SD.churnRisk + '</div><div class="csub">inactive 60+ days</div></div>';
  h += '<div class="card"><div class="clabel">New Today</div><div class="cval">' + SD.newCustomersToday + '</div></div>';
  h += '<div class="card"><div class="clabel">New This Week</div><div class="cval">' + SD.newCustomersWeek + '</div></div>';
  h += '<div class="card"><div class="clabel">New This Month</div><div class="cval">' + SD.newCustomers + '</div></div>';
  h += '<div class="card g"><div class="clabel">Loyalty Members</div><div class="cval">' + SD.loyalCustomers.toLocaleString() + '</div></div>';
  h += '</div>';
  h += '<div class="grid2">';
  h += '<div class="card"><div class="clabel">New / Day (Last 7d)</div><div class="cval">' + (SD.newCustomersPerDay7||0).toFixed(1) + '</div><div class="csub">avg per day</div></div>';
  h += '<div class="card"><div class="clabel">New / Day (Last 30d)</div><div class="cval">' + (SD.newCustomersPerDay30||0).toFixed(1) + '</div><div class="csub">avg per day</div></div>';
  h += '</div>';
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
