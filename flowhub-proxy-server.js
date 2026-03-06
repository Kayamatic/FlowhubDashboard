require("dotenv").config();
const express = require("express");
const cors = require("cors");
let fetch = globalThis.fetch;
if (!fetch) fetch = require("node-fetch");
const app = express();
const PORT = 3001;
app.use(cors());
app.use(express.json());

// ── Basic auth (password gate) ────────────────────────────────────────────────
// Set DASH_PASSWORD env var to require a password. Leave unset to run open.
const DASH_PASSWORD = process.env.DASH_PASSWORD;
if (DASH_PASSWORD) {
  app.use(function(req, res, next) {
    var auth = req.headers['authorization'] || '';
    if (auth.startsWith('Basic ')) {
      var decoded = Buffer.from(auth.slice(6), 'base64').toString();
      var pass = decoded.slice(decoded.indexOf(':') + 1);
      if (pass === DASH_PASSWORD) return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="Flowhub Analytics"');
    res.status(401).send('Password required');
  });
}

app.use(express.static(__dirname));
const LOC = process.env.FLOWHUB_LOCATION_ID;
const HDRS = {"clientId": process.env.FLOWHUB_CLIENT_ID, "key": process.env.FLOWHUB_API_KEY, "Accept": "application/json"};

app.get("/health",(req,res)=>res.json({status:"ok",configured:!!(process.env.FLOWHUB_API_KEY&&process.env.FLOWHUB_CLIENT_ID&&LOC)}));
async function proxy(url,res){try{console.log("Fetching:",url);const r=await fetch(url,{headers:HDRS});const text=await r.text();console.log("Status:",r.status);if(!r.ok)return res.status(r.status).json({error:"Flowhub "+r.status,details:text});try{res.json(JSON.parse(text))}catch{res.send(text)}}catch(e){res.status(500).json({error:e.message})}}
app.get("/api/inventory",(q,s)=>proxy("https://api.flowhub.co/v0/inventory",s));

// ── Shared data fetchers ──────────────────────────────────────────────────────

async function fetchAllOrders(start, end) {
  const base = "https://api.flowhub.co/v1/orders/findByLocationId/" + LOC +
    "?created_after=" + encodeURIComponent(start) +
    "&created_before=" + encodeURIComponent(end) + "&page_size=500";
  const r1 = await fetch(base + "&page=1", {headers: HDRS});
  const d1 = await r1.json();
  if (!d1.orders || d1.orders.length === 0) return [];
  const total = d1.total || d1.orders.length;
  const totalPages = Math.ceil(total / 500);
  if (totalPages <= 1) return d1.orders;
  const rest = await Promise.all(Array.from({length: totalPages - 1}, (_, i) =>
    fetch(base + "&page=" + (i + 2), {headers: HDRS}).then(r => r.json())));
  return d1.orders.concat(...rest.map(d => d.orders || []));
}

let _custCache = null, _custCacheTime = 0;
async function fetchAllCustomers() {
  if (_custCache && Date.now() - _custCacheTime < 5 * 60 * 1000) return _custCache;
  let all = [], page = 1;
  while (true) {
    const r = await fetch("https://api.flowhub.co/v1/customers/?page_size=500&page=" + page, {headers: HDRS});
    const d = await r.json();
    const batch = d.data || (Array.isArray(d) ? d : []);
    all = all.concat(batch);
    if (batch.length < 500) break;
    page++;
  }
  _custCache = all; _custCacheTime = Date.now();
  console.log("Customers cached:", all.length);
  return all;
}

app.get("/api/orders", async(q,s) => {
  try {
    const all = await fetchAllOrders(q.query.start_date||"", q.query.end_date||"");
    s.json({orders: all, total: all.length});
  } catch(e) { s.status(500).json({error: e.message}); }
});

app.get("/api/customers", async(q,s) => {
  try {
    const all = await fetchAllCustomers();
    s.json({data: all, total: all.length});
  } catch(e) { s.status(500).json({error: e.message}); }
});

// ── Analytics helpers ─────────────────────────────────────────────────────────

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function estInfo(dateStr) {
  const full = new Date(dateStr).toLocaleString('sv', {timeZone: 'America/New_York'}); // "YYYY-MM-DD HH:MM:SS"
  const [date, time] = full.split(' ');
  return {date, hour: parseInt(time.split(':')[0]), dow: new Date(date + 'T12:00:00Z').getDay()};
}

function oTotal(o) {
  return o.totals ? (o.totals.subTotal || 0) - (o.totals.totalDiscounts || 0) : 0;
}

function hrLabel(h) {
  return h === 0 ? '12am' : h < 12 ? h + 'am' : h === 12 ? '12pm' : (h - 12) + 'pm';
}

// ── Analytics compute functions ───────────────────────────────────────────────

async function computeHeatmap(days) {
  const end   = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - (days || 90) * 86400000).toISOString().slice(0, 10);
  const orders = (await fetchAllOrders(start, end)).filter(o => o.orderStatus === 'sold');
  const cnt = {}, rev = {};
  orders.forEach(o => {
    if (!o.completedOn) return;
    const {dow, hour} = estInfo(o.completedOn);
    if (!cnt[dow]) cnt[dow] = {}; if (!rev[dow]) rev[dow] = {};
    cnt[dow][hour] = (cnt[dow][hour] || 0) + 1;
    rev[dow][hour] = (rev[dow][hour] || 0) + oTotal(o);
  });
  const byDayHour = {};
  for (let d = 0; d < 7; d++) {
    if (!cnt[d]) continue;
    byDayHour[DAYS[d]] = {};
    for (const h of Object.keys(cnt[d]).sort((a, b) => +a - +b))
      byDayHour[DAYS[d]][hrLabel(+h)] = {count: cnt[d][h], revenue: Math.round(rev[d][h] || 0)};
  }
  const topByCount = Object.entries(byDayHour)
    .flatMap(([day, hrs]) => Object.entries(hrs).map(([hour, v]) => ({day, hour, count: v.count, revenue: v.revenue})))
    .sort((a, b) => b.count - a.count).slice(0, 10);
  return {period: `${days || 90} days (${start} to ${end})`, totalOrders: orders.length, byDayHour, topByCount};
}

async function computeRevenueTrend(start, end) {
  const orders = (await fetchAllOrders(start, end)).filter(o => o.orderStatus === 'sold');
  const daily = {};
  orders.forEach(o => {
    if (!o.completedOn) return;
    const {date} = estInfo(o.completedOn);
    if (!daily[date]) daily[date] = {revenue: 0, transactions: 0};
    daily[date].revenue += oTotal(o);
    daily[date].transactions++;
  });
  for (const d of Object.keys(daily)) daily[d].revenue = Math.round(daily[d].revenue);
  return {startDate: start, endDate: end, totalOrders: orders.length, daily};
}

async function computeTopProducts(start, end, limit) {
  const orders = (await fetchAllOrders(start, end)).filter(o => o.orderStatus === 'sold');
  const pm = {};
  orders.forEach(o => (o.itemsInCart || []).forEach(i => {
    const n = i.productName || 'Unknown';
    if (!pm[n]) pm[n] = {revenue: 0, units: 0, transactions: 0};
    pm[n].revenue += (i.totalPrice || 0);
    pm[n].units   += (i.quantity || 1);
    pm[n].transactions++;
  }));
  const products = Object.entries(pm)
    .map(([name, v]) => ({name, revenue: Math.round(v.revenue), units: v.units, transactions: v.transactions}))
    .sort((a, b) => b.revenue - a.revenue).slice(0, limit || 10);
  return {startDate: start, endDate: end, products};
}

async function computeCustomerSummary(start, end) {
  const all  = await fetchAllCustomers();
  const s0   = new Date(start + 'T05:00:00.000Z'); // EST midnight
  const s1   = new Date(end   + 'T04:59:59.999Z');
  const newIn = all.filter(c => { const d = new Date(c.createdAt || 0); return d >= s0 && d <= s1; }).length;
  const loyal = all.filter(c => c.isLoyal || c.loyaltyPoints > 0).length;
  const t60   = new Date(Date.now() - 60 * 86400000);
  const churn = all.filter(c => { const l = new Date(c.updatedAt || 0); return l < t60 && l.getFullYear() > 2000; }).length;
  return {total: all.length, newInPeriod: newIn, loyal, churnRisk: churn, startDate: start, endDate: end};
}

async function computeNewVsReturning(days, startDate, endDate) {
  const now = new Date();
  const end = endDate || now.toISOString().slice(0, 10);
  const start = startDate || new Date(now.getTime() - (days || 30) * 86400000).toISOString().slice(0, 10);

  const [orders, allCustomers] = await Promise.all([
    fetchAllOrders(start, end),
    fetchAllCustomers()
  ]);

  const sold = orders.filter(o => o.orderStatus === 'sold');

  // Build lookup: customerId -> createdAt
  const custMap = {};
  allCustomers.forEach(c => {
    const id = c.id || c._id || c.customerId;
    if (id) custMap[id] = c.createdAt || null;
  });

  // Period start in UTC (EST midnight = UTC 05:00)
  const periodStart = new Date(start + 'T05:00:00.000Z');

  const seen = new Set();
  let newBuyers = 0, returningBuyers = 0, unknownBuyers = 0;

  sold.forEach(o => {
    const cid = o.customerId;
    if (!cid || seen.has(cid)) return;
    seen.add(cid);
    const createdAt = custMap[cid];
    if (!createdAt) { unknownBuyers++; return; }
    if (new Date(createdAt) >= periodStart) newBuyers++;
    else returningBuyers++;
  });

  const knownTotal = newBuyers + returningBuyers;
  return {
    startDate: start, endDate: end,
    totalActiveBuyers: newBuyers + returningBuyers + unknownBuyers,
    newBuyers,
    returningBuyers,
    unknownBuyers,
    newPct:       knownTotal ? +(newBuyers       / knownTotal * 100).toFixed(1) : 0,
    returningPct: knownTotal ? +(returningBuyers / knownTotal * 100).toFixed(1) : 0,
    note: 'New = customer whose account was created within this period (first-time buyer). Returning = account existed before the period but purchased again. Guest/unlinked transactions: ' + unknownBuyers + '.'
  };
}

async function computeTopCustomers(start, end, limit) {
  const orders = (await fetchAllOrders(start, end)).filter(o => o.orderStatus === 'sold');
  const cm = {};
  orders.forEach(o => {
    const id = o.customerId || 'unknown';
    if (!cm[id]) cm[id] = {name: o.name || 'Unknown', revenue: 0, visits: 0};
    cm[id].revenue += oTotal(o);
    cm[id].visits++;
  });
  const customers = Object.entries(cm)
    .map(([id, v]) => ({customerId: id, name: v.name, revenue: Math.round(v.revenue), visits: v.visits}))
    .sort((a, b) => b.revenue - a.revenue).slice(0, limit || 10);
  return {startDate: start, endDate: end, customers};
}

async function computeProductTrend(name, days) {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now.getTime() - (days || 30) * 86400000).toISOString().slice(0, 10);
  const orders = (await fetchAllOrders(start, end)).filter(o => o.orderStatus === 'sold');
  const nameLower = name.toLowerCase().trim();
  const dm = {};
  let matchedName = null;
  orders.forEach(o => {
    if (!o.completedOn) return;
    const {date} = estInfo(o.completedOn);
    (o.itemsInCart || []).forEach(i => {
      const pn = (i.productName || '').toLowerCase();
      if (pn.includes(nameLower)) {
        if (!matchedName) matchedName = i.productName;
        if (!dm[date]) dm[date] = {units: 0, rev: 0};
        dm[date].units += (i.quantity || 1);
        dm[date].rev   += (i.totalPrice || 0);
      }
    });
  });
  // Fill every date in range (zeros for days with no sales)
  const data = [];
  for (let d = new Date(start + 'T12:00:00Z'), endD = new Date(end + 'T12:00:00Z'); d <= endD; d.setDate(d.getDate() + 1)) {
    const ds = d.toISOString().slice(0, 10);
    data.push({date: ds, units: dm[ds] ? dm[ds].units : 0, rev: dm[ds] ? Math.round(dm[ds].rev) : 0});
  }
  const totalUnits = data.reduce((s, d) => s + d.units, 0);
  return {matchedName: matchedName || name, searchTerm: name, days: days || 30, totalUnits, data};
}

async function computeCustomerPurchaseHistory(name, days, startDate, endDate) {
  const now = new Date();
  const end = endDate || now.toISOString().slice(0, 10);
  const start = startDate || new Date(now.getTime() - (days || 60) * 86400000).toISOString().slice(0, 10);
  const orders = (await fetchAllOrders(start, end)).filter(o => o.orderStatus === 'sold');
  const nameLower = name.toLowerCase().trim();
  const matched = orders.filter(o => (o.name || '').toLowerCase().includes(nameLower));
  matched.sort((a, b) => new Date(b.completedOn || 0) - new Date(a.completedOn || 0));
  const purchases = matched.map(o => ({
    date: o.completedOn ? estInfo(o.completedOn).date : 'unknown',
    total: Math.round(oTotal(o)),
    items: (o.itemsInCart || []).map(i => ({name: i.productName || 'Unknown', qty: i.quantity || 1, price: Math.round(i.totalPrice || 0)}))
  }));
  const totalSpent = purchases.reduce((s, p) => s + p.total, 0);
  const matchedNames = [...new Set(matched.map(o => o.name).filter(Boolean))];
  return {searchName: name, matchedNames, startDate: start, endDate: end, visitCount: purchases.length, totalSpent, purchases};
}

async function computeTopTransactionsByDay(days, startDate, endDate) {
  const now = new Date();
  const end = endDate || now.toISOString().slice(0, 10);
  const start = startDate || new Date(now.getTime() - (days || 5) * 86400000).toISOString().slice(0, 10);
  const orders = (await fetchAllOrders(start, end)).filter(o => o.orderStatus === 'sold' && o.completedOn);
  // For each EST calendar date, keep the single order with the highest total
  const byDay = {};
  orders.forEach(o => {
    const {date} = estInfo(o.completedOn);
    const total = oTotal(o);
    if (!byDay[date] || total > byDay[date].total) {
      byDay[date] = {
        date,
        customerName: o.name || 'Unknown',
        total: Math.round(total),
        items: (o.itemsInCart || []).map(i => ({name: i.productName || 'Unknown', qty: i.quantity || 1, price: Math.round(i.totalPrice || 0)}))
      };
    }
  });
  const results = Object.values(byDay).sort((a, b) => b.date.localeCompare(a.date));
  return {startDate: start, endDate: end, topTransactions: results};
}

async function computeWeeklySkuSales(keyword, startDate, endDate) {
  const now = new Date();
  const end = endDate || now.toISOString().slice(0, 10);
  const start = startDate || new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10);
  const orders = (await fetchAllOrders(start, end)).filter(o => o.orderStatus === 'sold' && o.completedOn);
  // Split keyword into terms — all must match product name
  const terms = keyword.toLowerCase().trim().split(/\s+/);
  // Return ISO Monday for a YYYY-MM-DD date string
  function weekOf(dateStr) {
    const d = new Date(dateStr + 'T12:00:00Z');
    const dow = d.getUTCDay(); // 0=Sun … 6=Sat
    const toMon = (dow === 0 ? -6 : 1 - dow);
    return new Date(d.getTime() + toMon * 86400000).toISOString().slice(0, 10);
  }
  const byWeek = {}, matchedSkus = new Set();
  orders.forEach(o => {
    const {date} = estInfo(o.completedOn);
    const wk = weekOf(date);
    (o.itemsInCart || []).forEach(i => {
      const pn = (i.productName || '').toLowerCase();
      if (terms.every(t => pn.includes(t))) {
        matchedSkus.add(i.productName || 'Unknown');
        if (!byWeek[wk]) byWeek[wk] = {weekOf: wk, units: 0, revenue: 0, skus: {}};
        const qty = i.quantity || 1;
        byWeek[wk].units += qty;
        byWeek[wk].revenue += (i.totalPrice || 0);
        const sn = i.productName || 'Unknown';
        byWeek[wk].skus[sn] = (byWeek[wk].skus[sn] || 0) + qty;
      }
    });
  });
  const weeks = Object.values(byWeek).sort((a, b) => a.weekOf.localeCompare(b.weekOf));
  weeks.forEach(w => {
    w.revenue = Math.round(w.revenue);
    w.skus = Object.entries(w.skus).map(([name, units]) => ({name, units})).sort((a, b) => b.units - a.units);
  });
  return {keyword, matchedSkuNames: [...matchedSkus].sort(), startDate: start, endDate: end, totalUnits: weeks.reduce((s, w) => s + w.units, 0), weeks};
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'get_order_heatmap',
    description: 'Returns transaction count and revenue broken down by day-of-week and hour of day. Use for questions about peak hours, busiest days, best times to run promotions, or any weekday/hour traffic pattern question.',
    input_schema: {type: 'object', properties: {days: {type: 'number', description: 'Number of past days to analyze. Default: 90.'}}}
  },
  {
    name: 'get_revenue_trend',
    description: 'Returns daily revenue and transaction counts for a date range. Use for trend analysis, comparing periods, identifying strong or weak days, or any revenue-over-time question.',
    input_schema: {type: 'object', properties: {start_date: {type: 'string', description: 'Start date YYYY-MM-DD'}, end_date: {type: 'string', description: 'End date YYYY-MM-DD'}}, required: ['start_date', 'end_date']}
  },
  {
    name: 'get_top_products',
    description: 'Returns top-selling products ranked by revenue for a date range. Use for product performance, bestseller lists, or category analysis over any time period.',
    input_schema: {type: 'object', properties: {start_date: {type: 'string', description: 'Start date YYYY-MM-DD'}, end_date: {type: 'string', description: 'End date YYYY-MM-DD'}, limit: {type: 'number', description: 'Number of products to return. Default: 10.'}}, required: ['start_date', 'end_date']}
  },
  {
    name: 'get_customer_summary',
    description: 'Returns customer acquisition and loyalty stats for a specific date range. Use when the question involves new customer counts, loyalty enrollment, or churn over a custom period.',
    input_schema: {type: 'object', properties: {start_date: {type: 'string', description: 'Start date YYYY-MM-DD'}, end_date: {type: 'string', description: 'End date YYYY-MM-DD'}}, required: ['start_date', 'end_date']}
  },
  {
    name: 'get_new_vs_returning',
    description: 'Calculates new vs returning buyer breakdown for a period. A "new buyer" is a customer whose account was created within the period (first-time buyer). A "returning buyer" had an account before the period but purchased again. Use this for any question about new vs returning customer mix, repeat purchase rate, or first-time vs repeat buyer percentages.',
    input_schema: {type: 'object', properties: {start_date: {type: 'string', description: 'Start date YYYY-MM-DD'}, end_date: {type: 'string', description: 'End date YYYY-MM-DD'}, days: {type: 'number', description: 'Number of days back from today if no explicit dates given. Default: 30.'}}}
  },
  {
    name: 'get_top_customers',
    description: 'Returns top customers ranked by total revenue spent for a date range. Use for questions about best customers, highest spenders, VIP customers, most frequent visitors, or top buyers.',
    input_schema: {type: 'object', properties: {start_date: {type: 'string', description: 'Start date YYYY-MM-DD'}, end_date: {type: 'string', description: 'End date YYYY-MM-DD'}, limit: {type: 'number', description: 'Number of customers to return. Default: 10.'}}, required: ['start_date', 'end_date']}
  },
  {
    name: 'get_product_trend',
    description: 'Returns daily units sold and revenue for a specific product matched by partial/fuzzy name. Use when someone asks about a specific product\'s sales over time, by day, daily chart, velocity, depletion rate, or wants to see how a product has been selling. Supports partial name matching.',
    input_schema: {type: 'object', properties: {product_name: {type: 'string', description: 'Product name or partial name for fuzzy match. E.g. "Galactic Warhead" or "Oreoz 3.5g"'}, days: {type: 'number', description: 'Number of past days to analyze. Default: 30.'}}, required: ['product_name']}
  },
  {
    name: 'get_customer_purchases',
    description: 'Returns complete purchase history for a specific customer matched by name. Use when someone asks about a named person\'s purchases, transactions, spending, visit history, or what they bought. Supports partial/fuzzy name matching. Returns each visit with date, total, and itemized products bought.',
    input_schema: {type: 'object', properties: {customer_name: {type: 'string', description: 'Customer name or partial name for fuzzy match. E.g. "Afi Rock" or "John S"'}, days: {type: 'number', description: 'Number of past days to look back. Default: 60.'}, start_date: {type: 'string', description: 'Optional explicit start date YYYY-MM-DD. Overrides days.'}, end_date: {type: 'string', description: 'Optional explicit end date YYYY-MM-DD. Defaults to today.'}}, required: ['customer_name']}
  },
  {
    name: 'get_top_transactions_by_day',
    description: 'Returns the single largest revenue transaction for each calendar day in a period. Use when someone asks about the biggest sale of the day, largest single transactions, top orders per day, daily transaction peaks, or wants details (customer name + itemized cart) of the highest-value orders each day.',
    input_schema: {type: 'object', properties: {days: {type: 'number', description: 'Number of past days to look back. Default: 5.'}, start_date: {type: 'string', description: 'Optional explicit start date YYYY-MM-DD. Overrides days.'}, end_date: {type: 'string', description: 'Optional explicit end date YYYY-MM-DD. Defaults to today.'}}}
  },
  {
    name: 'get_weekly_sku_sales',
    description: 'Returns weekly unit sales and revenue for all products whose names match a keyword or multi-word phrase. Use when someone asks about weekly trends for a product type, size, or category — e.g. "7g flower", "28g shake", "Oreoz", "edibles". All words in the keyword must appear in the product name. Returns one row per week with unit totals and a per-SKU breakdown.',
    input_schema: {type: 'object', properties: {keyword: {type: 'string', description: 'Word or phrase to match against product names. All terms must be present. E.g. "7g flower", "28g shake", "Galactic Warhead", "cartridge"'}, start_date: {type: 'string', description: 'Start date YYYY-MM-DD'}, end_date: {type: 'string', description: 'End date YYYY-MM-DD. Defaults to today.'}}, required: ['keyword', 'start_date']}
  }
];

async function executeTool(name, input) {
  console.log('→ Tool call:', name, JSON.stringify(input));
  try {
    if (name === 'get_order_heatmap')    return await computeHeatmap(input.days);
    if (name === 'get_revenue_trend')    return await computeRevenueTrend(input.start_date, input.end_date);
    if (name === 'get_top_products')     return await computeTopProducts(input.start_date, input.end_date, input.limit);
    if (name === 'get_customer_summary')   return await computeCustomerSummary(input.start_date, input.end_date);
    if (name === 'get_new_vs_returning')   return await computeNewVsReturning(input.days, input.start_date, input.end_date);
    if (name === 'get_top_customers')      return await computeTopCustomers(input.start_date, input.end_date, input.limit);
    if (name === 'get_product_trend')      return await computeProductTrend(input.product_name, input.days);
    if (name === 'get_customer_purchases')    return await computeCustomerPurchaseHistory(input.customer_name, input.days, input.start_date, input.end_date);
    if (name === 'get_top_transactions_by_day') return await computeTopTransactionsByDay(input.days, input.start_date, input.end_date);
    if (name === 'get_weekly_sku_sales')        return await computeWeeklySkuSales(input.keyword, input.start_date, input.end_date);
    return {error: 'Unknown tool: ' + name};
  } catch(e) { return {error: e.message}; }
}

function buildSystemPrompt(ctx) {
  const today = new Date().toLocaleDateString('en-CA', {timeZone: 'America/New_York'});
  return `You are an AI analytics assistant for a cannabis retail dispensary using Flowhub POS. Today is ${today} (America/New_York).

Current dashboard snapshot:
- Today: $${(ctx.todayRev || 0).toLocaleString()} / ${ctx.todayCount || 0} transactions
- This week (Mon–today): $${(ctx.weekRev || 0).toLocaleString()} / ${ctx.weekCount || 0} transactions
- This month (1st–today): $${(ctx.monthRev || 0).toLocaleString()} / ${ctx.monthCount || 0} transactions
- Customers: ${(ctx.totalCustomers || 0).toLocaleString()} total | ${ctx.newCustomersToday || 0} new today | ${ctx.newCustomersWeek || 0} new this week | ${ctx.newCustomers || 0} new this month
- Loyalty: ${(ctx.loyalCustomers || 0).toLocaleString()} members | ${(ctx.churnRisk || 0).toLocaleString()} churn risk (60d inactive)
- Inventory: ${ctx.totalSkus || 0} SKUs | ${ctx.lowStockCount || 0} low stock

Use your tools whenever a question requires data beyond this snapshot — historical trends, custom date ranges, weekday/hour breakdowns, or product performance over time. Revenue is post-discount, pre-tax. Be concise, lead with the key insight, use exact numbers.`;
}

// ── Chat endpoint with tool-use loop ─────────────────────────────────────────

app.post("/api/chat", express.json(), async(req, res) => {
  try {
    const apiKey = req.headers['x-api-key'] || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(401).json({error: "No Anthropic API key configured. Set ANTHROPIC_API_KEY in .env or use the SET AI KEY button."});

    const {messages, context} = req.body;
    let msgs = Array.isArray(messages) ? messages : [];
    const sys = buildSystemPrompt(context || {});
    let chartData = null;

    for (let i = 0; i < 5; i++) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {"Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01"},
        body: JSON.stringify({model: "claude-sonnet-4-20250514", max_tokens: 1500, system: sys, tools: TOOLS, messages: msgs})
      });
      const d = await r.json();
      if (d.error) return res.status(500).json(d);

      if (d.stop_reason === 'end_turn') {
        const t = (d.content || []).find(c => c.type === 'text');
        if (!t) console.log('end_turn with no text block — content:', JSON.stringify(d.content));
        const text = t && t.text ? t.text : (d.content || []).map(c => c.type === 'text' ? c.text : '').join('').trim() || 'Sorry, I was unable to generate a response. Please try rephrasing your question.';
        return res.json({content: [{type: 'text', text}], chart: chartData});
      }

      if (d.stop_reason === 'tool_use') {
        msgs = [...msgs, {role: 'assistant', content: d.content}];
        const results = await Promise.all(
          d.content.filter(c => c.type === 'tool_use').map(async tu => {
            const result = await executeTool(tu.name, tu.input);
            if (tu.name === 'get_product_trend' && !result.error && result.data) {
              chartData = {
                type: 'daily_units',
                title: (result.matchedName || tu.input.product_name) + ' \u2014 units/day (' + (result.days || 30) + 'd)',
                totalUnits: result.totalUnits,
                data: result.data
              };
            }
            return {type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result)};
          })
        );
        msgs = [...msgs, {role: 'user', content: results}];
      } else {
        const t = (d.content || []).find(c => c.type === 'text');
        return res.json({content: [{type: 'text', text: t ? t.text : JSON.stringify(d)}], chart: chartData});
      }
    }
    return res.json({content: [{type: 'text', text: 'Too many tool calls — please try a more specific question.'}], chart: chartData});
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.listen(PORT, () => {
  console.log("\n✅ Flowhub proxy running!");
  console.log("   Open: http://localhost:" + PORT + "/dashboard.html");
  console.log("   Credentials: " + (process.env.FLOWHUB_API_KEY && LOC ? "YES ✅" : "NO ❌ check .env") + "\n");
});
