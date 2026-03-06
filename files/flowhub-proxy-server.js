/**
 * Flowhub Analytics - Proxy Server
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS:
 * Flowhub's API does not allow direct browser requests (CORS policy).
 * This lightweight Express server acts as a proxy — your browser calls this,
 * and this calls Flowhub server-to-server. Never expose this server publicly.
 *
 * SETUP:
 *   1. Install Node.js (https://nodejs.org) if not already installed
 *   2. In a terminal, navigate to the folder containing this file
 *   3. Run: npm install express node-fetch cors dotenv
 *   4. Create a .env file in the same folder (see below)
 *   5. Run: node flowhub-proxy-server.js
 *   6. Server starts at http://localhost:3001
 *
 * .env FILE CONTENTS (create this file, no quotes needed):
 *   FLOWHUB_API_KEY=your_api_key_here
 *   FLOWHUB_CLIENT_ID=your_client_id_here
 *   FLOWHUB_LOCATION_ID=your_location_id_here
 *
 * The dashboard React app will automatically connect to http://localhost:3001
 * ─────────────────────────────────────────────────────────────────────────────
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");

// Use built-in fetch (Node 18+) or fall back to node-fetch
let fetch;
try {
  fetch = globalThis.fetch;
  if (!fetch) throw new Error("no global fetch");
} catch {
  fetch = require("node-fetch");
}

const app = express();
const PORT = process.env.PORT || 3001;

// Allow requests from your local React dashboard (and Claude artifacts)
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173", /\.claude\.ai$/, /\.anthropic\.com$/],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
}));

app.use(express.json());

// ── Flowhub config ────────────────────────────────────────────────────────────
const FLOWHUB_BASE = "https://api.flowhub.co";
const FLOWHUB_HEADERS = {
  "Authorization": `Bearer ${process.env.FLOWHUB_API_KEY}`,
  "X-Client-Id":   process.env.FLOWHUB_CLIENT_ID,
  "Content-Type":  "application/json",
  "Accept":        "application/json",
};
const LOCATION_ID = process.env.FLOWHUB_LOCATION_ID;

// ── Health / connection test ──────────────────────────────────────────────────
app.get("/health", (req, res) => {
  const configured = !!(process.env.FLOWHUB_API_KEY && process.env.FLOWHUB_CLIENT_ID && LOCATION_ID);
  res.json({
    status: "ok",
    configured,
    location_id: LOCATION_ID || "NOT SET",
    timestamp: new Date().toISOString(),
  });
});

// ── Generic Flowhub proxy ─────────────────────────────────────────────────────
// Forwards GET requests to Flowhub, appends location_id automatically
async function proxyFlowhub(path, queryParams = {}, res) {
  if (!process.env.FLOWHUB_API_KEY || !LOCATION_ID) {
    return res.status(500).json({ error: "Flowhub credentials not configured in .env" });
  }

  try {
    const url = new URL(`${FLOWHUB_BASE}${path}`);
    url.searchParams.set("location_id", LOCATION_ID);
    Object.entries(queryParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    });

    console.log(`→ Flowhub: GET ${url.toString()}`);
    const response = await fetch(url.toString(), { headers: FLOWHUB_HEADERS });

    const text = await response.text();
    console.log(`← Flowhub: ${response.status}`);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Flowhub returned ${response.status}`,
        details: text,
      });
    }

    try {
      res.json(JSON.parse(text));
    } catch {
      res.send(text);
    }
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: err.message });
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Location info (used as connection test)
app.get("/api/location", (req, res) =>
  proxyFlowhub(`/locations/${LOCATION_ID}`, {}, res));

// Orders / Sales
// ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&limit=500
app.get("/api/orders", (req, res) => {
  const { start_date, end_date, limit, status } = req.query;
  proxyFlowhub("/orders", {
    start_date,
    end_date,
    limit: limit || 500,
    status: status || "completed",
  }, res);
});

// Inventory - products
app.get("/api/products", (req, res) => {
  const { limit, page } = req.query;
  proxyFlowhub("/inventory/products", { limit: limit || 500, page }, res);
});

// Inventory - rooms/areas
app.get("/api/rooms", (req, res) =>
  proxyFlowhub("/inventory/rooms", {}, res));

// Customers
app.get("/api/customers", (req, res) => {
  const { limit, page } = req.query;
  proxyFlowhub("/customers", { limit: limit || 500, page }, res);
});

// ── Claude AI chat proxy ──────────────────────────────────────────────────────
// Forwards POST /api/chat to Anthropic using x-api-key header or ANTHROPIC_API_KEY env var
app.post("/api/chat", async (req, res) => {
  const apiKey = req.headers["x-api-key"] || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(400).json({
      error: "No Anthropic API key. Use the SET AI KEY button in the dashboard, or add ANTHROPIC_API_KEY to your .env file.",
    });
  }
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("Chat proxy error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ Flowhub proxy running at http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Credentials loaded: ${!!(process.env.FLOWHUB_API_KEY && LOCATION_ID) ? "YES" : "NO — check your .env file"}\n`);
});
