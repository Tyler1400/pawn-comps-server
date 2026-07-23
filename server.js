const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// How many days back counts as "recent" for the average.
const LOOKBACK_DAYS = 30;

// Basic in-memory cache so repeated lookups of the same item don't
// hammer eBay. Keyed by search query, expires after 10 minutes.
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

function buildSearchUrl(query) {
  const params = new URLSearchParams({
    _nkw: query,
    _sacat: "0",
    LH_Sold: "1", // sold listings only
    LH_Complete: "1", // completed listings only
    LH_PrefLoc: "1", // items located in the US
    _ipg: "60", // items per page
    rt: "nc",
  });
  return `https://www.ebay.com/sch/i.html?${params.toString()}`;
}

function parsePrice(text) {
  if (!text) return null;
  // Handles "$45.00", "$45.00 to $60.00" (range - take the first number),
  // "$1,234.56"
  const match = text.replace(/,/g, "").match(/\$([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
}

function parseSoldDate(text) {
  if (!text) return null;
  // eBay shows sold dates like "Sold Jul 14, 2026" or "Sold  Jul 14, 2026"
  const match = text.match(/Sold\s+([A-Za-z]+ \d{1,2},?\s*\d{4})/);
  if (!match) return null;
  const parsed = new Date(match[1]);
  return isNaN(parsed.getTime()) ? null : parsed;
}

async function fetchSoldComps(query) {
  const url = buildSearchUrl(query);

  const { data: html } = await axios.get(url, {
    headers: {
      // A realistic browser UA. eBay is more likely to serve normal
      // markup to requests that look like a real browser.
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
    timeout: 15000,
  });

  const $ = cheerio.load(html);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);

  const items = [];

  $("li.s-item").each((_, el) => {
    const title = $(el).find(".s-item__title").first().text().trim();
    const priceText = $(el).find(".s-item__price").first().text().trim();
    // eBay renders the sold date in a few different places depending on
    // layout version - check the common spots.
    const dateText =
      $(el).find(".s-item__caption--signal").first().text().trim() ||
      $(el).find(".POSITIVE").first().text().trim() ||
      $(el).find(".s-item__title--tagblock").first().text().trim();

    const price = parsePrice(priceText);
    const soldDate = parseSoldDate(dateText);

    // Skip "Shop on eBay" placeholder tiles and anything we couldn't
    // parse a price for.
    if (!title || title.toLowerCase().includes("shop on ebay")) return;
    if (price === null) return;

    if (soldDate && soldDate < cutoff) return; // outside lookback window

    items.push({ title, price, soldDate });
  });

  if (items.length === 0) {
    return { average: null, count: 0, items: [] };
  }

  const total = items.reduce((sum, it) => sum + it.price, 0);
  const average = total / items.length;

  return {
    average: Math.round(average * 100) / 100,
    count: items.length,
    items: items.slice(0, 20), // return a sample for the UI to show
  };
}

app.get("/api/comps", async (req, res) => {
  const query = (req.query.q || "").trim();
  if (!query) {
    return res.status(400).json({ error: "Missing query parameter q" });
  }

  const cached = cache.get(query);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json(cached.data);
  }

  try {
    const result = await fetchSoldComps(query);
    cache.set(query, { data: result, timestamp: Date.now() });
    res.json(result);
  } catch (err) {
    console.error("eBay comps lookup failed:", err.message);
    res.status(502).json({
      error:
        "Could not reach eBay right now. Enter the sold value manually for this item.",
    });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Comps server listening on port ${PORT}`);
});
