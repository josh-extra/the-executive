export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const { symbol: rawSymbol } = req.query;
  if (!rawSymbol) { res.status(400).json({ error: "symbol required" }); return; }

  // Normalize common shorthand crypto symbols to Finnhub's expected format
  const CRYPTO_MAP = {
    "BTC": "BINANCE:BTCUSDT", "BTC-USD": "BINANCE:BTCUSDT", "BTC-AUD": "BINANCE:BTCUSDT",
    "ETH": "BINANCE:ETHUSDT", "ETH-USD": "BINANCE:ETHUSDT", "ETH-AUD": "BINANCE:ETHUSDT",
    "SOL": "BINANCE:SOLUSDT", "SOL-USD": "BINANCE:SOLUSDT", "SOL-AUD": "BINANCE:SOLUSDT",
    "DOGE": "BINANCE:DOGEUSDT", "DOGE-USD": "BINANCE:DOGEUSDT", "DOGE-AUD": "BINANCE:DOGEUSDT",
    "XRP": "BINANCE:XRPUSDT", "XRP-USD": "BINANCE:XRPUSDT", "XRP-AUD": "BINANCE:XRPUSDT",
  };
  // Normalize common shorthand index names people type without knowing exact Yahoo syntax
  const INDEX_MAP = {
    "SP500": "^GSPC", "S&P500": "^GSPC", "S&P": "^GSPC", "SPX": "^GSPC",
    "ASX200": "^AXJO", "ASX": "^AXJO", "XJO": "^AXJO",
    "NASDAQ": "^IXIC", "NASDAQ100": "^IXIC",
    "DOW": "^DJI", "DOWJONES": "^DJI",
    "AUDUSD": "AUDUSD=X", "AUD/USD": "AUDUSD=X",
  };
  const cleaned=rawSymbol.toUpperCase().trim();
  const symbol = CRYPTO_MAP[cleaned] || INDEX_MAP[cleaned] || rawSymbol;

  const FH_KEY = "d8cmivhr01qidic8koq0d8cmivhr01qidic8koqg";

  // Finnhub - works great for US stocks, crypto, forex, indices
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FH_KEY}`, {
      headers: { "X-Finnhub-Token": FH_KEY }
    });
    const j = await r.json();
    if (j.c && j.c !== 0) {
      return res.status(200).json({ price: j.c, change: j.d, pct: j.dp, prev: j.pc, source: "finnhub" });
    }
  } catch(e) {}

  // Yahoo fallback - covers indices (^GSPC, ^AXJO) and forex (AUDUSD=X) that Finnhub doesn't support on free tier
  try {
    const r = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`,
      { headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "*/*"
      }}
    );
    const j = await r.json();
    const meta = j?.chart?.result?.[0]?.meta;
    if (meta?.regularMarketPrice) {
      const price = meta.regularMarketPrice;
      const prev = meta.chartPreviousClose || price;
      return res.status(200).json({ price, change: price - prev, pct: ((price - prev) / prev) * 100, prev, source: "yahoo" });
    }
  } catch(e) {}

  // ASX stocks - try the ASX official API
  if (symbol.endsWith(".AX")) {
    try {
      const code = symbol.replace(".AX", "");
      const r = await fetch(`https://asx.api.markitdigital.com/asx-research/1.0/companies/${code}/header`, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }
      });
      const j = await r.json();
      const price = j?.data?.last_price;
      const prev = j?.data?.previous_close_price;
      if (price) {
        const change = price - prev;
        const pct = prev ? (change / prev) * 100 : 0;
        return res.status(200).json({ price, change, pct, prev, source: "asx" });
      }
    } catch(e) {}

    // ASX fallback - use Yahoo AU with proper headers
    try {
      const r = await fetch(
        `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`,
        { headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "*/*",
          "Accept-Language": "en-AU,en;q=0.9",
          "Referer": "https://au.finance.yahoo.com/",
          "Origin": "https://au.finance.yahoo.com"
        }}
      );
      const j = await r.json();
      const meta = j?.chart?.result?.[0]?.meta;
      if (meta?.regularMarketPrice) {
        const price = meta.regularMarketPrice;
        const prev = meta.chartPreviousClose || price;
        return res.status(200).json({ price, change: price - prev, pct: ((price - prev) / prev) * 100, prev, source: "yahoo-au" });
      }
    } catch(e) {}
  }

  res.status(500).json({ error: "no data for " + symbol });
}