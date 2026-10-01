const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Set this in Render's environment variables - never put your real
// token directly in this file or in GitHub.
const APIFY_TOKEN = process.env.APIFY_TOKEN;

// The eBay Sold Listings actor on Apify (caffein.dev/ebay-sold-listings).
const ACTOR_ID = "caffein.dev~ebay-sold-listings";

const LOOKBACK_DAYS = 30;

// How many sold listings to pull per lookup. Fewer listings still give a
// solid median and cost a lot less per search (pricing is per 1,000
// results) - 25 is plenty for a reliable middle value.
const RESULT_COUNT = 25;

// Cache a lookup for a full day so the same item searched again by
// another staff member (or re-searched by the same person) doesn't
// trigger another paid run.
const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function extractPrice(item) {
  const raw = item.soldPrice ?? item.price ?? item.finalPrice;
  if (raw == null) return NaN;
  const cleaned = String(raw).replace(/[^0-9.]/g, "");
  return parseFloat(cleaned);
}

// Titles containing these words are almost never a fair comp - they're
// broken units, parts-only listings, or otherwise not representative of
// what a working item sells for.
const JUNK_TITLE_WORDS = [
  "parts",
  "for parts",
  "not working",
  "broken",
  "as-is",
  "as is",
  "repair",
  "cracked",
  "faulty",
  "damaged",
  "read description",
  "no power",
  "won't turn on",
  "wont turn on",
  "does not work",
  "doesn't work",
  "untested",
  "water damage",
  "locked",
  "icloud locked",
  "bad battery",
  "for repair",
  "spares",
];

function isJunkListing(title) {
  if (!title) return false;
  const lower = title.toLowerCase();
  return JUNK_TITLE_WORDS.some((word) => lower.includes(word));
}

function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function fetchSoldComps(query) {
  const url = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;

  const body = {
    keywords: [query],
    daysToScrape: LOOKBACK_DAYS,
    count: RESULT_COUNT,
    // Ask for a residential proxy if the actor supports it. Harmless if
    // it doesn't - unused fields are ignored by Apify actors.
    proxyConfiguration: {
      useApifyProxy: true,
      apifyProxyGroups: ["RESIDENTIAL"],
    },
  };

  const MAX_ATTEMPTS = 2;
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { data: items } = await axios.post(url, body, { timeout: 170000 });

      if (!Array.isArray(items) || items.length === 0) {
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 4000));
          continue;
        }
        return { average: null, count: 0, items: [] };
      }

      const parsed = items
        .map((it) => ({
          title: it.title,
          price: extractPrice(it),
          soldAt: it.soldDate || it.endedAt,
        }))
        .filter((it) => !isNaN(it.price) && it.price > 0)
        .filter((it) => !isJunkListing(it.title));

      if (parsed.length === 0) {
        return { average: null, count: 0, items: [] };
      }

      const prices = parsed.map((it) => it.price);
      const med = median(prices);

      return {
        average: Math.round(med * 100) / 100,
        count: parsed.length,
        items: parsed.slice(0, 20),
      };
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 4000));
      }
    }
  }

  throw lastError;
}

// Simple self-throttle: don't let two lookups start less than 3 seconds
// apart, so we're not hammering the data source during heavy testing.
let lastLookupAt = 0;
const MIN_GAP_MS = 3000;

async function waitForTurn() {
  const now = Date.now();
  const wait = lastLookupAt + MIN_GAP_MS - now;
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastLookupAt = Date.now();
}

app.get("/api/comps", async (req, res) => {
  const query = (req.query.q || "").trim().toLowerCase();
  if (!query) {
    return res.status(400).json({ error: "Missing query parameter q" });
  }
  if (!APIFY_TOKEN) {
    return res.status(500).json({
      error:
        "Server is missing its Apify token. Set APIFY_TOKEN in Render's environment settings.",
    });
  }

  const cached = cache.get(query);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json(cached.data);
  }

  try {
    await waitForTurn();
    const result = await fetchSoldComps(query);
    cache.set(query, { data: result, timestamp: Date.now() });
    res.json(result);
  } catch (err) {
    console.error(
      "eBay comps lookup failed:",
      err.response ? JSON.stringify(err.response.data) : err.message
    );
    res.status(502).json({
      error:
        "Could not reach the comps service right now. Enter the sold value manually for this item.",
    });
  }
});

// Gold/silver spot prices, for the jewelry scrap calculator. gold-api.com
// is free, needs no API key, and has no rate limit - we still cache it
// for an hour so we're not hitting it on every single calculation.
const SPOT_CACHE_TTL_MS = 60 * 60 * 1000;
let spotCache = null;
let spotCacheAt = 0;

async function fetchSpotPrices() {
  const [goldRes, silverRes] = await Promise.all([
    axios.get("https://api.gold-api.com/price/XAU", { timeout: 15000 }),
    axios.get("https://api.gold-api.com/price/XAG", { timeout: 15000 }),
  ]);
  return {
    gold: goldRes.data.price,
    silver: silverRes.data.price,
    updatedAt: new Date().toISOString(),
  };
}

app.get("/api/spot", async (_req, res) => {
  if (spotCache && Date.now() - spotCacheAt < SPOT_CACHE_TTL_MS) {
    return res.json(spotCache);
  }
  try {
    const result = await fetchSpotPrices();
    spotCache = result;
    spotCacheAt = Date.now();
    res.json(result);
  } catch (err) {
    console.error("Spot price lookup failed:", err.message);
    if (spotCache) {
      // Serve the last known price rather than nothing if the spot
      // source is briefly down.
      return res.json(spotCache);
    }
    res.status(502).json({ error: "Could not reach the spot price service right now." });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Comps server listening on port ${PORT}`);
});
