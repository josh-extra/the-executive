export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const { symbol } = req.query;
  if (!symbol) { res.status(400).json({ error: "symbol required" }); return; }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://finance.yahoo.com"
      }
    });
    const j = await r.json();
    const meta = j.chart.result[0].meta;
    const closes = j.chart.result[0].indicators.quote[0].close.filter(v => v != null);
    const price = meta.regularMarketPrice || closes[closes.length - 1];
    const prev = meta.chartPreviousClose || closes[closes.length - 2] || price;
    res.status(200).json({ price, prev, change: price - prev, pct: ((price - prev) / prev) * 100 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}