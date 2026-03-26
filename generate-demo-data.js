#!/usr/bin/env node
// ── generate-demo-data.js ─────────────────────────────────────────────────────
// Creates demo.db with realistic mock data for the 617THC analytics dashboard.
// Usage: node generate-demo-data.js
// ─────────────────────────────────────────────────────────────────────────────

const Database = require('better-sqlite3');
const crypto   = require('crypto');
const path     = require('path');
const fs       = require('fs');

const DB_PATH = path.join(__dirname, 'demo.db');
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// ── Tables ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    order_id   TEXT PRIMARY KEY,
    date       TEXT NOT NULL,
    data       TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);
  CREATE TABLE IF NOT EXISTS cache_meta (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS demo_inventory (
    product_id TEXT PRIMARY KEY,
    data       TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS demo_customers (
    customer_id TEXT PRIMARY KEY,
    data        TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chat_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL,
    query      TEXT NOT NULL,
    tools_used TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_history(user_id);
  CREATE TABLE IF NOT EXISTS user_profile (
    user_id    TEXT PRIMARY KEY,
    summary    TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// ── Helpers ──────────────────────────────────────────────────────────────────
const uuid = () => crypto.randomUUID();
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randF = (min, max) => +(Math.random() * (max - min) + min).toFixed(2);
const weightedPick = (items, weights) => {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
};

// EST/EDT offset for a given date string
function nyOffset(dateStr) {
  const probe = new Date(dateStr + 'T12:00:00Z');
  const nyHour = parseInt(probe.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }));
  return 12 - nyHour; // EDT → 4, EST → 5
}

// ── Product Catalog (~50 SKUs) ───────────────────────────────────────────────
const PRODUCTS = [
  // Flower (15) — highest volume category
  { name: '617 Genetics | Purple Haze | 3.5g Flower',        brand: '617 Genetics',      category: 'Flower', price: 3500, cost: 1575, weight: 10 },
  { name: '617 Genetics | OG Kush | 3.5g Flower',            brand: '617 Genetics',      category: 'Flower', price: 4000, cost: 1800, weight: 9 },
  { name: '617 Genetics | Wedding Cake | 3.5g Flower',       brand: '617 Genetics',      category: 'Flower', price: 4500, cost: 2025, weight: 8 },
  { name: '617 Genetics | Blue Dream | 7g Flower',           brand: '617 Genetics',      category: 'Flower', price: 6500, cost: 2925, weight: 6 },
  { name: '617 Genetics | Gelato | 14g Flower',              brand: '617 Genetics',      category: 'Flower', price: 11000, cost: 4950, weight: 3 },
  { name: '617 Genetics | Jack Herer | 28g Flower',          brand: '617 Genetics',      category: 'Flower', price: 19000, cost: 8550, weight: 2 },
  { name: 'Boston Bud Co | Sour Diesel | 3.5g Flower',       brand: 'Boston Bud Co',     category: 'Flower', price: 3500, cost: 1575, weight: 7 },
  { name: 'Boston Bud Co | Northern Lights | 3.5g Flower',   brand: 'Boston Bud Co',     category: 'Flower', price: 3800, cost: 1710, weight: 5 },
  { name: 'Green Street | Zkittlez | 3.5g Flower',           brand: 'Green Street',      category: 'Flower', price: 4200, cost: 1890, weight: 6 },
  { name: 'Green Street | Runtz | 7g Flower',                brand: 'Green Street',      category: 'Flower', price: 7000, cost: 3150, weight: 4 },
  { name: 'Harbor House | GSC | 3.5g Flower',                brand: 'Harbor House',      category: 'Flower', price: 3500, cost: 1575, weight: 5 },
  { name: 'Harbor House | White Widow | 7g Flower',          brand: 'Harbor House',      category: 'Flower', price: 6000, cost: 2700, weight: 3 },
  { name: 'Berkshire Roots | GG4 | 3.5g Flower',             brand: 'Berkshire Roots',   category: 'Flower', price: 4000, cost: 1800, weight: 4 },
  { name: 'Happy Valley | Pineapple Express | 3.5g Flower',  brand: 'Happy Valley',      category: 'Flower', price: 4500, cost: 2025, weight: 4 },
  { name: 'Happy Valley | Tangie | 7g Flower',               brand: 'Happy Valley',      category: 'Flower', price: 7500, cost: 3375, weight: 2 },

  // Shake (4)
  { name: '617 Genetics | Purple Haze | 7g Shake',           brand: '617 Genetics',      category: 'Flower', price: 3000, cost: 900, weight: 5 },
  { name: '617 Genetics | OG Kush | 14g Shake',              brand: '617 Genetics',      category: 'Flower', price: 5000, cost: 1500, weight: 3 },
  { name: 'Boston Bud Co | Sour Diesel | 7g Shake',          brand: 'Boston Bud Co',     category: 'Flower', price: 2800, cost: 840, weight: 4 },
  { name: 'Green Street | Zkittlez | 28g Shake',             brand: 'Green Street',      category: 'Flower', price: 8000, cost: 2400, weight: 2 },

  // Edibles (8)
  { name: 'Berkshire Roots | Mango Gummies | 100mg',  brand: 'Berkshire Roots',   category: 'Edibles', price: 2500, cost: 1000, weight: 7 },
  { name: 'Berkshire Roots | Sour Watermelon | 100mg', brand: 'Berkshire Roots',  category: 'Edibles', price: 2500, cost: 1000, weight: 5 },
  { name: 'Happy Valley | Dark Chocolate Bar | 100mg', brand: 'Happy Valley',     category: 'Edibles', price: 3000, cost: 1200, weight: 5 },
  { name: '617 Edibles | Boston Cream Bites | 100mg', brand: '617 Edibles',       category: 'Edibles', price: 2800, cost: 1120, weight: 6 },
  { name: '617 Edibles | Blueberry Chews | 200mg',    brand: '617 Edibles',       category: 'Edibles', price: 4000, cost: 1600, weight: 4 },
  { name: 'Sira Naturals | Raspberry Chews | 200mg',  brand: 'Sira Naturals',     category: 'Edibles', price: 3500, cost: 1400, weight: 3 },
  { name: 'Sira Naturals | Caramel Squares | 100mg',  brand: 'Sira Naturals',     category: 'Edibles', price: 2200, cost: 880,  weight: 3 },
  { name: 'Green Street | Fruit Drops | 100mg',       brand: 'Green Street',      category: 'Edibles', price: 2000, cost: 800,  weight: 4 },

  // Cartridges (8)
  { name: '617 Labs | Gelato Cart | 0.5g',            brand: '617 Labs',          category: 'Cartridges', price: 3500, cost: 1400, weight: 7 },
  { name: '617 Labs | Blue Dream Cart | 1g',          brand: '617 Labs',          category: 'Cartridges', price: 5500, cost: 2200, weight: 5 },
  { name: 'Fernway | Sativa Blend | 0.5g',            brand: 'Fernway',           category: 'Cartridges', price: 3000, cost: 1200, weight: 6 },
  { name: 'Fernway | Indica Blend | 1g',              brand: 'Fernway',           category: 'Cartridges', price: 5000, cost: 2000, weight: 4 },
  { name: 'Rythm | Hybrid Cart | 0.5g',               brand: 'Rythm',             category: 'Cartridges', price: 3200, cost: 1280, weight: 5 },
  { name: 'Rythm | Sativa Cart | 1g',                 brand: 'Rythm',             category: 'Cartridges', price: 5500, cost: 2200, weight: 3 },
  { name: 'Harbor House | Live Resin Cart | 0.5g',    brand: 'Harbor House',      category: 'Cartridges', price: 4000, cost: 1600, weight: 3 },
  { name: 'Cresco | LLR Cart | 1g',                   brand: 'Cresco',            category: 'Cartridges', price: 6000, cost: 2400, weight: 2 },

  // Concentrates (5)
  { name: '617 Extracts | Live Rosin GSC | 1g',       brand: '617 Extracts',      category: 'Concentrates', price: 6500, cost: 2925, weight: 4 },
  { name: '617 Extracts | Badder Wedding Cake | 1g',  brand: '617 Extracts',      category: 'Concentrates', price: 5500, cost: 2475, weight: 3 },
  { name: 'Cresco | Budder OG | 1g',                  brand: 'Cresco',            category: 'Concentrates', price: 5000, cost: 2250, weight: 3 },
  { name: 'Harbor House | Shatter Zkittlez | 1g',     brand: 'Harbor House',      category: 'Concentrates', price: 4500, cost: 2025, weight: 2 },
  { name: 'Happy Valley | Live Rosin | 1g',           brand: 'Happy Valley',      category: 'Concentrates', price: 7000, cost: 3150, weight: 2 },

  // Pre-Rolls / Joints (6)
  { name: '617 Genetics | Jack Herer Pre-Roll | 1g',  brand: '617 Genetics',      category: 'Joint', price: 1000, cost: 400, weight: 8 },
  { name: '617 Genetics | OG Kush Pre-Roll | 1g',     brand: '617 Genetics',      category: 'Joint', price: 1000, cost: 400, weight: 6 },
  { name: 'Dogwalkers | Mini 5-Pack',                 brand: 'Dogwalkers',        category: 'Joint', price: 2000, cost: 800, weight: 5 },
  { name: 'Harbor House | Infused Joint | 1g',        brand: 'Harbor House',      category: 'Joint', price: 1500, cost: 600, weight: 4 },
  { name: 'Boston Bud Co | Sativa Pre-Roll | 1g',     brand: 'Boston Bud Co',     category: 'Joint', price: 800,  cost: 320, weight: 5 },
  { name: 'Green Street | Party Pack | 5x0.5g',       brand: 'Green Street',      category: 'Joint', price: 2500, cost: 1000, weight: 3 },

  // Accessories (4) — non-cannabis, lower volume
  { name: 'RAW Rolling Papers',                       brand: 'RAW',               category: 'Accessories', price: 500,  cost: 150, weight: 4 },
  { name: 'Glass Pipe - Small',                       brand: 'Generic',           category: 'Accessories', price: 1500, cost: 450, weight: 2 },
  { name: 'Herb Grinder - Medium',                    brand: 'Generic',           category: 'Accessories', price: 2500, cost: 750, weight: 2 },
  { name: 'Stash Jar - Smell Proof',                  brand: 'Generic',           category: 'Accessories', price: 1200, cost: 360, weight: 2 },

  // Tinctures (3) — categorized as Accessories for tax (no THC)
  { name: 'Berkshire Roots | CBD Tincture | 30ml',    brand: 'Berkshire Roots',   category: 'Accessories', price: 4500, cost: 1800, weight: 2 },
  { name: 'Happy Valley | 1:1 Drops | 30ml',         brand: 'Happy Valley',      category: 'Accessories', price: 5500, cost: 2200, weight: 1 },
  { name: 'Sira Naturals | Sleep Tincture | 30ml',   brand: 'Sira Naturals',     category: 'Accessories', price: 3500, cost: 1400, weight: 1 },
];

// Assign each product a stable UUID
PRODUCTS.forEach(p => { p.id = uuid(); });

const productWeights = PRODUCTS.map(p => p.weight);

// ── Inventory Data ───────────────────────────────────────────────────────────
console.log('Generating inventory...');
const insertInv = db.prepare('INSERT INTO demo_inventory (product_id, data) VALUES (?, ?)');
const invInsertAll = db.transaction(() => {
  for (const p of PRODUCTS) {
    const floorQty = rand(5, 80);
    const vaultQty = rand(0, 200);
    const totalQty = floorQty + vaultQty;
    const inv = {
      productId: p.id,
      productName: p.name,
      variantName: p.name,
      brand: p.brand,
      category: p.category,
      sku: 'SKU-' + p.id.slice(0, 8).toUpperCase(),
      quantity: totalQty,
      floorQuantity: floorQty,
      vaultQuantity: vaultQty,
      otherRoomQuantity: 0,
      roomBreakdown: { 'Sales Floor': floorQty, 'Vault': vaultQty },
      preTaxPriceInPennies: p.price,
      postTaxPriceInPennies: Math.round(p.price * 1.2),
      totalCostInPennies: p.cost,
    };
    insertInv.run(p.id, JSON.stringify(inv));
  }
});
invInsertAll();
// Make a few items low stock
const lowStockProducts = PRODUCTS.filter(p => p.category === 'Flower').slice(0, 3);
for (const p of lowStockProducts) {
  const floorQty = rand(2, 5);
  const vaultQty = rand(0, 3);
  const inv = {
    productId: p.id, productName: p.name, variantName: p.name,
    brand: p.brand, category: p.category, sku: 'SKU-' + p.id.slice(0, 8).toUpperCase(),
    quantity: floorQty + vaultQty, floorQuantity: floorQty, vaultQuantity: vaultQty,
    otherRoomQuantity: 0, roomBreakdown: { 'Sales Floor': floorQty, 'Vault': vaultQty },
    preTaxPriceInPennies: p.price, postTaxPriceInPennies: Math.round(p.price * 1.2),
    totalCostInPennies: p.cost,
  };
  db.prepare('UPDATE demo_inventory SET data = ? WHERE product_id = ?').run(JSON.stringify(inv), p.id);
}
console.log(`  ${PRODUCTS.length} SKUs created (${lowStockProducts.length} low stock)`);

// ── Customer Database (~2000) ────────────────────────────────────────────────
console.log('Generating customers...');
const FIRST_NAMES = ['James','Mary','Robert','Patricia','John','Jennifer','Michael','Linda','David','Elizabeth','William','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Chris','Karen','Daniel','Lisa','Matt','Nancy','Mark','Betty','Don','Margaret','Steven','Sandra','Andrew','Ashley','Paul','Dorothy','Josh','Kimberly','Ken','Emily','Brian','Donna','George','Michelle','Ed','Carol','Ron','Amanda','Tim','Melissa','Jason','Deborah','Jeff','Stephanie','Ryan','Rebecca','Jake','Sharon','Gary','Laura','Nick','Cynthia','Eric','Kathleen','Ray','Amy','Stephen','Angela','Alex','Shirley','Sean','Brenda'];
const LAST_NAMES  = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts'];

const today = new Date();
const customers = [];
const insertCust = db.prepare('INSERT INTO demo_customers (customer_id, data) VALUES (?, ?)');
const custInsertAll = db.transaction(() => {
  for (let i = 0; i < 2000; i++) {
    const cid = uuid();
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    // Spread creation dates: 70% older than 6 months, 20% last 6 months, 10% last 30 days
    let daysAgo;
    const bucket = Math.random();
    if (bucket < 0.70) daysAgo = rand(180, 730);
    else if (bucket < 0.90) daysAgo = rand(30, 179);
    else daysAgo = rand(0, 29);

    const createdAt = new Date(today.getTime() - daysAgo * 86400000);
    const isLoyal = Math.random() < 0.30;
    const cust = {
      id: cid,
      _id: cid,
      customerId: cid,
      firstName: first,
      lastName: last,
      name: first + ' ' + last,
      email: (Math.random() < 0.6) ? first.toLowerCase() + '.' + last.toLowerCase() + rand(1, 99) + '@email.com' : null,
      phone: (Math.random() < 0.5) ? '617-' + rand(200, 999) + '-' + String(rand(1000, 9999)) : null,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(), // will be updated during order generation
      isLoyal: isLoyal,
      loyaltyPoints: isLoyal ? rand(50, 5000) : 0,
    };
    customers.push(cust);
    insertCust.run(cid, JSON.stringify(cust));
  }
});
custInsertAll();

// Top 100 frequent buyers (will get more orders)
const frequentBuyers = customers.slice(0, 100);
console.log(`  ${customers.length} customers (${frequentBuyers.length} frequent buyers, ${customers.filter(c => c.isLoyal).length} loyalty members)`);

// ── Order Generation (60 days) ───────────────────────────────────────────────
console.log('Generating orders (60 days)...');

// Hourly weights (9am-8pm EST, index 0 = 9am)
const HOURLY_WEIGHTS = [0.3, 0.6, 0.8, 1.2, 1.0, 0.8, 0.9, 1.3, 1.5, 1.4, 1.0, 0.5];
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

// Day-of-week multipliers (0=Sun, 1=Mon, ..., 6=Sat)
const DOW_MULT = [0.75, 0.85, 0.90, 0.95, 1.00, 1.20, 1.25];

// Basket size distribution
const BASKET_SIZES   = [1, 2, 3, 4];
const BASKET_WEIGHTS = [40, 35, 18, 7];

// Tax rate (Massachusetts cannabis ~20%)
const TAX_RATE = 0.20;

const BASE_DAILY_ORDERS = 190;
const DAYS = 60;

const startDate = new Date(today.getTime() - DAYS * 86400000);
const insertOrder = db.prepare('INSERT OR REPLACE INTO orders (order_id, date, data) VALUES (?, ?, ?)');

// Track customer last-order for updatedAt
const custLastOrder = {};

let totalOrders = 0;
let totalRevenue = 0;

const orderInsertAll = db.transaction(() => {
  for (let d = 0; d <= DAYS; d++) {  // <= includes today
    const date = new Date(startDate.getTime() + d * 86400000);
    const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
    const dow = date.getUTCDay();
    const offset = nyOffset(dateStr);
    const isToday = (dateStr === today.toISOString().slice(0, 10));

    // For today, figure out the current EST hour so we only generate orders up to "now"
    const nowEST = isToday ? new Date(today.getTime() + (today.getTimezoneOffset() * 60000) - (offset * 3600000)) : null;
    const currentESTHour = nowEST ? nowEST.getHours() : 24;

    // Daily order count with day-of-week multiplier and random jitter ±12%
    const jitter = 0.88 + Math.random() * 0.24;
    // Slight upward trend: +3% per month
    const trendMult = 1 + (d / 30) * 0.03;
    let dailyOrders = Math.round(BASE_DAILY_ORDERS * DOW_MULT[dow] * jitter * trendMult);
    // For today, scale down proportionally to how much of the business day has elapsed (9am–9pm)
    if (isToday) {
      const openHours = 12; // 9am to 9pm
      const elapsed = Math.max(0, Math.min(openHours, currentESTHour - 9));
      dailyOrders = Math.round(dailyOrders * (elapsed / openHours));
    }

    for (let i = 0; i < dailyOrders; i++) {
      const oid = uuid();

      // Pick hour (weighted) and random minute/second — for today, only up to current hour
      let hour = weightedPick(HOURS, HOURLY_WEIGHTS);
      if (isToday && hour >= currentESTHour) hour = rand(9, Math.max(9, currentESTHour - 1));
      const minute = rand(0, 59);
      const second = rand(0, 59);

      // Convert target EST hour to UTC
      const utcHour = hour + offset;
      const ts = new Date(Date.UTC(
        date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
        utcHour, minute, second, rand(0, 999)
      ));
      const completedOn = ts.toISOString();

      // Basket size
      const basketSize = weightedPick(BASKET_SIZES, BASKET_WEIGHTS);

      // Pick products (weighted, no duplicates)
      const selectedProducts = [];
      const usedIds = new Set();
      for (let b = 0; b < basketSize; b++) {
        let attempts = 0;
        let product;
        do {
          product = weightedPick(PRODUCTS, productWeights);
          attempts++;
        } while (usedIds.has(product.id) && attempts < 20);
        if (!usedIds.has(product.id)) {
          usedIds.add(product.id);
          const qty = (product.category === 'Accessories' || product.category === 'Joint') ? rand(1, 2) : 1;
          selectedProducts.push({ product, qty });
        }
      }

      // Co-purchase: if flower in cart, 15% chance to add accessory
      if (selectedProducts.some(s => s.product.category === 'Flower') && Math.random() < 0.15) {
        const acc = PRODUCTS.filter(p => p.category === 'Accessories' && !usedIds.has(p.id));
        if (acc.length) { const a = pick(acc); usedIds.add(a.id); selectedProducts.push({ product: a, qty: 1 }); }
      }

      // Calculate totals
      let subTotal = 0;
      let totalCost = 0;
      const items = selectedProducts.map(({ product: p, qty }) => {
        const itemPrice = (p.price / 100) * qty;
        const itemCost = (p.cost / 100) * qty;
        subTotal += itemPrice;
        totalCost += itemCost;
        return {
          productName: p.name,
          productId: p.id,
          brand: p.brand,
          category: p.category,
          quantity: qty,
          totalPrice: +itemPrice.toFixed(2),
          originalPrice: +itemPrice.toFixed(2),
          totalCost: +itemCost.toFixed(2),
        };
      });

      // Discount (15% of orders, weekdays slightly more)
      let discount = 0;
      const discountChance = dow >= 1 && dow <= 5 ? 0.18 : 0.10;
      if (Math.random() < discountChance) {
        discount = +(subTotal * randF(0.05, 0.15)).toFixed(2);
      }

      const afterDiscount = +(subTotal - discount).toFixed(2);
      const tax = +(afterDiscount * TAX_RATE).toFixed(2);
      const finalTotal = +(afterDiscount + tax).toFixed(2);

      // Assign customer
      let customerId = null;
      let customerName = 'Guest';
      const custRoll = Math.random();
      if (custRoll < 0.20) {
        // Frequent buyer
        const c = pick(frequentBuyers.filter(c => new Date(c.createdAt) <= ts));
        if (c) { customerId = c.id; customerName = c.name; }
      } else if (custRoll < 0.90) {
        // Regular returning customer
        const eligible = customers.filter(c => new Date(c.createdAt) <= ts);
        if (eligible.length) { const c = pick(eligible); customerId = c.id; customerName = c.name; }
      }
      // else 10% guest — no customerId

      // Track last order for customer updatedAt
      if (customerId) {
        if (!custLastOrder[customerId] || ts > new Date(custLastOrder[customerId])) {
          custLastOrder[customerId] = completedOn;
        }
      }

      // Payment type
      const payType = weightedPick(['cash', 'debit', 'cash', 'debit'], [40, 45, 10, 5]);

      const order = {
        _id: oid,
        id: oid,
        orderId: oid,
        orderStatus: 'sold',
        voided: false,
        completedOn: completedOn,
        createdOn: new Date(ts.getTime() - rand(60, 600) * 1000).toISOString(), // created 1-10 min before completed
        customerId: customerId,
        name: customerName,
        totals: {
          subTotal: +subTotal.toFixed(2),
          totalDiscounts: discount,
          totalTax: tax,
          totalFees: 0,
          total: finalTotal,
        },
        itemsInCart: items,
        payments: [{ paymentType: payType, amount: finalTotal }],
      };

      insertOrder.run(oid, dateStr, JSON.stringify(order));
      totalOrders++;
      totalRevenue += afterDiscount;
    }
  }
});
orderInsertAll();

// ── Update customer updatedAt based on last order ────────────────────────────
console.log('Updating customer activity timestamps...');
const updateCust = db.prepare('UPDATE demo_customers SET data = ? WHERE customer_id = ?');
const custUpdateAll = db.transaction(() => {
  for (const c of customers) {
    if (custLastOrder[c.id]) {
      c.updatedAt = custLastOrder[c.id];
      updateCust.run(JSON.stringify(c), c.id);
    }
  }
});
custUpdateAll();

// ── Set cache_meta ───────────────────────────────────────────────────────────
const startStr = startDate.toISOString().slice(0, 10);
const todayStr = today.toISOString().slice(0, 10);
db.prepare('INSERT OR REPLACE INTO cache_meta (key, value) VALUES (?, ?)').run('ordMin', startStr);
db.prepare('INSERT OR REPLACE INTO cache_meta (key, value) VALUES (?, ?)').run('ordMax', todayStr);

// ── Summary ──────────────────────────────────────────────────────────────────
const churnRisk = customers.filter(c => {
  const last = custLastOrder[c.id] ? new Date(custLastOrder[c.id]) : new Date(c.createdAt);
  return (today - last) / 86400000 > 60;
}).length;

console.log('\n✅ Demo database generated!');
console.log(`   File: ${DB_PATH}`);
console.log(`   Orders: ${totalOrders.toLocaleString()} over ${DAYS} days`);
console.log(`   Revenue: $${Math.round(totalRevenue).toLocaleString()} (pre-tax, post-discount)`);
console.log(`   Avg daily: ${Math.round(totalOrders / DAYS)} orders`);
console.log(`   Products: ${PRODUCTS.length} SKUs`);
console.log(`   Customers: ${customers.length} (${Object.keys(custLastOrder).length} with orders, ~${churnRisk} churn risk)`);
console.log(`\n   To use: set DEMO_MODE=true in .env and restart the server\n`);

db.close();
