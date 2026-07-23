const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ACTOR_ID = "q6SGEKzFQuRiaEZU5";
const LOOKBACK_DAYS = 30;

const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

async function fetchSoldComps(query) {
  const url = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;

  const { data: items } = await axios.post(
    url,
    {
      keyword: query,
      count: 60,
      daysToScrape: LOOKBACK_DAYS,
      ebaySite: "ebay.com",
      itemLocation: "domestic",
      itemCondition: "any",
    },
    { timeout: 60000 }
  );

  if (!Array.isArray(items) || items.length === 0) {
    return { average: null, count: 0, items: [] };
  }

  const parsed = items
    .map((it) => ({
      title: it.title,
      price: parseFloat(it.soldPrice),
      soldAt: it.endedAt,
    }))
    .filter((it) => !isNaN(it.price));

  if (parsed.length === 0) {
    return { average: null, count: 0, items: [] };
  }

  const total = parsed.reduce((sum, it) => sum + it.price, 0);
  const average = total / parsed.length;

  return {
    average: Math.round(average * 100) / 100,
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
