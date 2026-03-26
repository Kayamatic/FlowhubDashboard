import { esc, shortName } from './utils.js';
import { state } from './state.js';

var _lowStockAsc = true;
var _catSortAsc = true, _catSortCol = 'floor';
var _catSortName = null;
var _szSortLabel = '', _szSortAsc = false, _szSortCol = 'floor';

export function renderInventoryHTML() {
  var SD = state.SD;
  var h = '';
  h += '<div class="grid2"><div class="card g"><div class="clabel">Total SKUs (In Stock)</div><div class="cval">' + SD.totalSkus + '</div><div class="csub">' + SD.cannabisSkus + ' cannabis &middot; ' + SD.accessorySkus + ' accessories</div></div>';
  h += '<div class="card r"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="clabel">Low Stock</div><div class="cval">' + SD.lowStock.length + '</div><div class="csub">need reorder</div></div>' + (SD.lowStock.length ? '<button class="see-more-btn" style="margin-top:2px;flex-shrink:0" onclick="openLowStockModal()">See More</button>' : '') + '</div></div>';
  h += '</div>';
  h += '<div class="box"><div class="boxtitle">Inventory by Category</div>';
  SD.cats.forEach(function(c) {
    h += '<div class="prog-row"><div class="prog-hd"><span><button class="cat-link" data-cat="' + esc(c.n) + '" onclick="openCategoryModal(this.dataset.cat)">' + esc(c.n) + '</button></span><span class="muted">' + c.count + ' SKUs</span></div><div class="prog-track"><div class="prog-fill" style="width:' + c.v + '%"></div></div></div>';
  });
  h += '</div>';
  if (SD.weightItems && SD.weightItems.length) {
    var wi = SD.weightItems;
    var flwr = wi.filter(function(x){ return /flower/i.test(x.label); });
    var shk  = wi.filter(function(x){ return /shake/i.test(x.label); });
    var maxWI = Math.max.apply(null, wi.map(function(x){ return x.qty; }).concat([1]));
    function wiRow(d) {
      var pct = Math.round(d.qty / maxWI * 100);
      return '<div style="display:flex;align-items:center;gap:6px;margin-bottom:7px">' +
        '<button class="cat-link" data-sz="' + esc(d.label) + '" onclick="openSizeModal(this.dataset.sz)" style="font-size:12px;color:#888;width:76px;flex-shrink:0;text-align:left;padding:0;background:none;border:none;cursor:pointer">' + esc(d.label) + '</button>' +
        '<div style="flex:1;height:6px;background:#1e1e1e;border-radius:3px;overflow:hidden">' +
          '<div style="width:' + pct + '%;height:100%;background:linear-gradient(90deg,#c8922a,#6b4d15);border-radius:3px"></div>' +
        '</div>' +
        '<span style="font-size:13px;font-weight:bold;color:#f0e8d8;width:30px;text-align:right;flex-shrink:0">' + d.qty + '</span>' +
      '</div>';
    }
    h += '<div class="box"><div class="boxtitle">Units in Stock by Size</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 16px">';
    h += '<div>';
    h += '<div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Flower</div>';
    flwr.forEach(function(d){ h += wiRow(d); });
    h += '</div>';
    h += '<div>';
    h += '<div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Shake</div>';
    shk.forEach(function(d){ h += wiRow(d); });
    h += '</div>';
    h += '</div></div>';
  }
  if (SD.fastestDepleting7d && SD.fastestDepleting7d.length) {
    h += '<div class="box"><div class="boxtitle" style="display:flex;justify-content:space-between;align-items:center"><span>Fastest Depleting \u2014 7 Days</span><button class="see-more-btn" onclick="openTopProducts(\'fastestDepleting7d\',\'Fastest Depleting \u2014 7 Days\')">See More</button></div>';
    SD.fastestDepleting7d.slice(0, 5).forEach(function(p, i) {
      h += '<div class="row"><span><span class="muted">' + (i + 1) + '.&nbsp;</span>' + esc(shortName(p.name)) + '</span><span class="amber">' + p.units + ' units</span></div>';
    });
    h += '</div>';
  }
  if (SD.fastestDepleting30d && SD.fastestDepleting30d.length) {
    h += '<div class="box"><div class="boxtitle" style="display:flex;justify-content:space-between;align-items:center"><span>Fastest Depleting \u2014 30 Days</span><button class="see-more-btn" onclick="openTopProducts(\'fastestDepleting30d\',\'Fastest Depleting \u2014 30 Days\')">See More</button></div>';
    SD.fastestDepleting30d.slice(0, 5).forEach(function(p, i) {
      h += '<div class="row"><span><span class="muted">' + (i + 1) + '.&nbsp;</span>' + esc(shortName(p.name)) + '</span><span class="amber">' + p.units + ' units</span></div>';
    });
    h += '</div>';
  }
  return h;
}

function renderInvSummary(products) {
  var is617 = products.filter(function(p) { return (p.brand || '').toLowerCase().includes('617'); });
  var other = products.filter(function(p) { return !(p.brand || '').toLowerCase().includes('617'); });
  function totals(arr) {
    return {
      floor: arr.reduce(function(s,p){ return s + (p.floorQuantity||0); }, 0),
      vault: arr.reduce(function(s,p){ return s + (p.vaultQuantity||0); }, 0)
    };
  }
  var t617 = totals(is617), tOther = totals(other);
  var h = '<div style="display:grid;grid-template-columns:1fr 52px 52px;gap:6px;margin-bottom:12px;padding-bottom:10px;border-bottom:2px solid #2e2e2e">';
  h += '<div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.1em;padding-bottom:4px;grid-column:1/-1">Unit Totals</div>';
  h += '<div style="font-size:13px;color:#f0e8d8;font-weight:600">617 Brands</div>';
  h += '<div style="text-align:right;font-size:13px;font-weight:700;color:#f0e8d8">' + t617.floor.toLocaleString() + '</div>';
  h += '<div style="text-align:right;font-size:13px;font-weight:700;color:#c8922a">' + t617.vault.toLocaleString() + '</div>';
  h += '<div style="font-size:13px;color:#888">Other Brands</div>';
  h += '<div style="text-align:right;font-size:13px;color:#aaa">' + tOther.floor.toLocaleString() + '</div>';
  h += '<div style="text-align:right;font-size:13px;color:#7a5c1e">' + tOther.vault.toLocaleString() + '</div>';
  h += '</div>';
  return h;
}

function renderInvRow(p) {
  var total = (p.floorQuantity || 0) + (p.vaultQuantity || 0);
  var qCls = total <= 10 ? 'red' : total <= 20 ? 'amber' : 'green';
  var vCls = p.vaultQuantity > 0 ? 'green' : 'color:#444';
  var price = p.price ? '$' + p.price.toFixed(2) : '\u2014';
  var r = '<div class="modal-inv-row">';
  r += '<div><div class="inv-name">' + esc(shortName(p.name)) + '</div>' + (p.brand ? '<div class="inv-brand">' + esc(p.brand) + '</div>' : '') + '</div>';
  r += '<div class="inv-qty ' + qCls + '">' + (p.floorQuantity || 0) + '</div>';
  r += '<div class="inv-qty" style="text-align:right;' + (p.vaultQuantity > 0 ? 'color:#c8922a' : 'color:#444') + '">' + (p.vaultQuantity || 0) + '</div>';
  r += '<div class="inv-price">' + price + '</div>';
  r += '</div>';
  return r;
}

export function openLowStockModal() {
  if (!state.SD || !state.SD.lowStock || !state.SD.lowStock.length) return;
  renderLowStockModal();
}

function renderLowStockModal() {
  var sorted = state.SD.lowStock.slice().sort(function(a, b) { return _lowStockAsc ? a.qty - b.qty : b.qty - a.qty; });
  var arrow = _lowStockAsc ? ' &#9650;' : ' &#9660;';
  var h = '<div class="modal-inv-hd" style="grid-template-columns:1fr 70px"><span>Product</span>';
  h += '<span style="text-align:right;cursor:pointer;user-select:none" onclick="toggleLowStockSort()">Qty' + arrow + '</span></div>';
  sorted.forEach(function(x) {
    var qCls = x.qty === 0 ? 'red' : x.qty <= 5 ? 'red' : 'amber';
    h += '<div class="modal-inv-row" style="grid-template-columns:1fr 70px">';
    h += '<div class="inv-name">' + esc(shortName(x.name)) + '</div>';
    h += '<div class="inv-qty ' + qCls + '">' + x.qty + '</div>';
    h += '</div>';
  });
  document.getElementById('modalTitle').textContent = 'Critical Low Stock \u2014 ' + state.SD.lowStock.length + ' SKUs';
  document.getElementById('modalBody').innerHTML = h;
  document.getElementById('topModal').classList.add('open');
}

export function openCategoryModal(catName) {
  if (!state.SD || !state.SD.allProducts) return;
  _catSortName = catName;
  _catSortAsc = false; _catSortCol = 'floor';
  renderCategoryModal();
}

function _catSortBy(col) { _catSortAsc = _catSortCol === col ? !_catSortAsc : false; _catSortCol = col; renderCategoryModal(); }

function renderCategoryModal() {
  var catName  = _catSortName;
  var all      = state.SD.allProducts.filter(function(p) { return p.category === catName; });
  var inStock  = all.filter(function(p) { return p.quantity > 0; }).sort(function(a,b) {
    var av = _catSortCol === 'vault' ? a.vaultQuantity : a.floorQuantity;
    var bv = _catSortCol === 'vault' ? b.vaultQuantity : b.floorQuantity;
    return _catSortAsc ? av - bv : bv - av;
  });
  var outStock = all.filter(function(p) { return p.quantity === 0; }).sort(function(a,b) { return a.name.localeCompare(b.name); });
  var fa = _catSortCol === 'floor' ? (_catSortAsc ? ' &#9650;' : ' &#9660;') : '';
  var va = _catSortCol === 'vault' ? (_catSortAsc ? ' &#9650;' : ' &#9660;') : '';
  var h = renderInvSummary(all);
  h += '<div class="modal-inv-hd"><span>Product</span>'
    + '<span style="text-align:right;cursor:pointer;user-select:none" onclick="_catSortBy(\'floor\')">Floor' + fa + '</span>'
    + '<span style="text-align:right;color:#c8922a;cursor:pointer;user-select:none" onclick="_catSortBy(\'vault\')">Vault' + va + '</span>'
    + '<span style="text-align:right">Price</span></div>';
  inStock.forEach(function(p) { h += renderInvRow(p); });
  if (outStock.length) {
    h += '<div style="margin:14px 0 8px;padding:6px 0;border-top:1px solid #2e2e2e;border-bottom:1px solid #2e2e2e;font-size:12px;color:#555;text-transform:uppercase;letter-spacing:.12em">Out of Stock \u2014 ' + outStock.length + ' SKU' + (outStock.length !== 1 ? 's' : '') + '</div>';
    outStock.forEach(function(p) { h += renderInvRow(p); });
  }
  document.getElementById('modalTitle').textContent = catName + ' \u2014 ' + inStock.length + ' in stock / ' + all.length + ' total SKUs';
  document.getElementById('modalBody').innerHTML = h;
  document.getElementById('topModal').classList.add('open');
}

export function openSizeModal(label) {
  _szSortLabel = label;
  _szSortAsc = false; _szSortCol = 'floor';
  renderSizeModal();
}

function _szSortBy(col) { _szSortAsc = _szSortCol === col ? !_szSortAsc : false; _szSortCol = col; renderSizeModal(); }

function renderSizeModal() {
  var sizeLabel = _szSortLabel;
  var wi = (state.SD.weightItems || []).find(function(w) { return w.label === sizeLabel; });
  var all = wi ? (wi.products || []) : [];
  var inStock  = all.filter(function(p) { return p.quantity > 0; }).sort(function(a,b) {
    var av = _szSortCol === 'vault' ? a.vaultQuantity : a.floorQuantity;
    var bv = _szSortCol === 'vault' ? b.vaultQuantity : b.floorQuantity;
    return _szSortAsc ? av - bv : bv - av;
  });
  var outStock = all.filter(function(p) { return p.quantity === 0; }).sort(function(a,b) { return a.name.localeCompare(b.name); });
  var fa = _szSortCol === 'floor' ? (_szSortAsc ? ' &#9650;' : ' &#9660;') : '';
  var va = _szSortCol === 'vault' ? (_szSortAsc ? ' &#9650;' : ' &#9660;') : '';
  var h = renderInvSummary(all);
  h += '<div class="modal-inv-hd"><span>Product</span>'
    + '<span style="text-align:right;cursor:pointer;user-select:none" onclick="_szSortBy(\'floor\')">Floor' + fa + '</span>'
    + '<span style="text-align:right;color:#c8922a;cursor:pointer;user-select:none" onclick="_szSortBy(\'vault\')">Vault' + va + '</span>'
    + '<span style="text-align:right">Price</span></div>';
  inStock.forEach(function(p) { h += renderInvRow(p); });
  if (outStock.length) {
    h += '<div style="margin:14px 0 8px;padding:6px 0;border-top:1px solid #2e2e2e;border-bottom:1px solid #2e2e2e;font-size:12px;color:#555;text-transform:uppercase;letter-spacing:.12em">Out of Stock \u2014 ' + outStock.length + ' SKU' + (outStock.length !== 1 ? 's' : '') + '</div>';
    outStock.forEach(function(p) { h += renderInvRow(p); });
  }
  document.getElementById('modalTitle').textContent = sizeLabel + ' \u2014 ' + inStock.length + ' in stock / ' + all.length + ' total SKUs';
  document.getElementById('modalBody').innerHTML = h;
  document.getElementById('topModal').classList.add('open');
}

// Attach to window for inline HTML handlers
window.openLowStockModal = openLowStockModal;
window.openCategoryModal = openCategoryModal;
window.openSizeModal = openSizeModal;
window.toggleLowStockSort = function() { _lowStockAsc = !_lowStockAsc; renderLowStockModal(); };
window._catSortBy = _catSortBy;
window._szSortBy = _szSortBy;
