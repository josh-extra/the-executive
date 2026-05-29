export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const { symbol } = req.query;
  if (!symbol) { res.status(400).json({ error: "symbol required" }); return; }

  const FH_KEY = "d8cmivhr01qidic8koq0d8cmivhr01qidic8koqg";

  // Try Finnhub first (works for US stocks, crypto, forex)
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FH_KEY}`);
    const j = await r.json();
    if (j.c && j.c !== 0) {
      return res.status(200).json({ price: j.c, change: j.d, pct: j.dp, prev: j.pc, source: "finnhub" });
    }
  } catch(e) {}

  // Fallback: Yahoo Finance v8 chart (server-side, no CORS issue)
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`,
      { headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Referer": "https://finance.yahoo.com"
      }}
    );
    const j = await r.json();
    const meta = j?.chart?.result?.[0]?.meta;
    if (meta?.regularMarketPrice) {
      const price = meta.regularMarketPrice;
      const prev = meta.chartPreviousClose || meta.regularMarketPrice;
      return res.status(200).json({
        price,
        change: price - prev,
        pct: ((price - prev) / prev) * 100,
        prev,
        source: "yahoo"
      });
    }
  } catch(e) {}

  res.status(500).json({ error: "no data for " + symbol });
}