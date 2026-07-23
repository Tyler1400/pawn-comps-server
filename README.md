# Pawn shop comps server

Small backend that looks up recent eBay sold prices for an item and
returns the average. The phone app calls this instead of you typing
the number in by hand.

## What it does

`GET /api/comps?q=dewalt 20v drill` returns:

```json
{
  "average": 62.5,
  "count": 14,
  "items": [{ "title": "...", "price": 58.0, "soldDate": "..." }, ...]
}
```

It searches eBay's sold + completed listings, filters to items sold
in the last 30 days, and averages the price.

## Deploying it (free, ~10 minutes)

1. **Put this folder in a GitHub repo.** Create a new repo, upload
   this `server` folder's contents (`server.js`, `package.json`).

2. **Sign up at [render.com](https://render.com)** (free, no card
   needed for the free tier).

3. **New > Web Service**, connect your GitHub repo.

4. Settings:
   - Build command: `npm install`
   - Start command: `npm start`
   - Instance type: Free

5. Deploy. Render gives you a URL like
   `https://your-app-name.onrender.com`.

6. Test it in a browser:
   `https://your-app-name.onrender.com/api/comps?q=dewalt+drill`
   You should get JSON back with an average price.

7. Paste that URL into the app's settings (see the app's "API URL"
   field) so it knows where to send lookups.

## Heads up

- **Free tier sleeps after 15 minutes idle.** The first lookup after
  a quiet spell takes 30-60 seconds while it wakes up. Fine for
  testing; if this becomes a daily tool, the ~$7/month paid tier
  keeps it always-on.
- **eBay can change their page layout.** If lookups start coming
  back empty or wrong, the HTML selectors in `server.js` (the
  `.s-item`, `.s-item__price` class names) likely need updating to
  match eBay's current markup. Send me what's failing and I can
  patch it.
- **This scrapes eBay's public pages rather than using their
  official API**, since eBay restricts sold-listing API access to
  approved partners. That means it's more fragile than an official
  integration and technically outside eBay's terms of service for
  automated access - worth keeping in mind, especially if this ever
  moves from an internal shop tool to something more public-facing.
