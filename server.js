const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ACTOR_ID = "caffein.dev~ebay-sold-listings";
const LOOKBACK_DAYS = 30;

const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

function extractPrice(item) {
  const raw = item.soldPrice ?? item.price ?? item.finalPrice;
  if (raw == null) return NaN;
  const cleaned = String(raw).replace(/[^0-9.]/g, "");
  return parseFloat(cleaned);
}

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

  const { data: items } = await axios.post(
    url,
    {
      keywords: [query],
      daysToScrape: LOOKBACK_DAYS,
    },
    { timeout: 90000 }
  );

  if (!Array.isArray(items) || items.length === 0) {
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
}

app.get("/api/comps", async (req, res) => {
  const query = (req.query.q || "").trim();
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

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Comps server listening on port ${PORT}`);
});
