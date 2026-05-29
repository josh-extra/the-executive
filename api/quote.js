export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const { symbol } = req.query;
  if (!symbol) { res.status(400).json({ error: "symbol required" }); return; }

  const FH_KEY = "d8cmivhr01qidic8koq0d8cmivhr01qidic8koqg";

  // Try Finnhub first (US stocks, crypto, forex - free tier)
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FH_KEY}`);
    const j = await r.json();
    if (j.c && j.c !== 0) {
      return res.status(200).json({ price: j.c, change: j.d, pct: j.dp, prev: j.pc, source: "finnhub" });
    }
  } catch(e) {}

  // Yahoo Finance - try query2 subdomain with crumb fetch first
  const YF_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Origin": "https://finance.yahoo.com",
    "Referer": "https://finance.yahoo.com/",
    "Cache-Control": "no-cache"
  };

  // Step 1: get a session cookie + crumb
  try {
    const cookieRes = await fetch("https://fc.yahoo.com", { headers: YF_HEADERS });
    const cookies = cookieRes.headers.get("set-cookie") || "";
    const cookieStr = cookies.split(",").map(c => c.split(";")[0].trim()).join("; ");

    const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: { ...YF_HEADERS, "Cookie": cookieStr }
    });
    const crumb = await crumbRes.text();

    const quoteRes = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d&crumb=${encodeURIComponent(crumb)}`,
      { headers: { ...YF_HEADERS, "Cookie": cookieStr } }
    );
    const j = await quoteRes.json();
    const meta = j?.chart?.result?.[0]?.meta;
    if (meta?.regularMarketPrice) {
      const price = meta.regularMarketPrice;
      const prev = meta.chartPreviousClose || price;
      return res.status(200).json({ price, change: price - prev, pct: ((price - prev) / prev) * 100, prev, source: "yahoo" });
    }
  } catch(e) {}

  // Last resort: query1 without crumb
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`,
      { headers: YF_HEADERS }
    );
    const j = await r.json();
    const meta = j?.chart?.result?.[0]?.meta;
    if (meta?.regularMarketPrice) {
      const price = meta.regularMarketPrice;
      const prev = meta.chartPreviousClose || price;
      return res.status(200).json({ price, change: price - prev, pct: ((price - prev) / prev) * 100, prev, source: "yahoo-fallback" });
    }
  } catch(e) {}

  res.status(500).json({ error: "no data for " + symbol });
}