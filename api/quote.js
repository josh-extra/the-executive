export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const { symbol } = req.query;
  if (!symbol) { res.status(400).json({ error: "symbol required" }); return; }

  const AV_KEY = "DHMEO3S04YBD0RRY";
  const FH_KEY = "d8cmivhr01qidic8koq0d8cmivhr01qidic8koqg";

  // Finnhub first - instant for US stocks
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FH_KEY}`);
    const j = await r.json();
    if (j.c && j.c !== 0) {
      return res.status(200).json({ price: j.c, change: j.d, pct: j.dp, prev: j.pc, source: "finnhub" });
    }
  } catch(e) {}

  // Alpha Vantage fallback - covers ASX, international stocks
  try {
    const r = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${AV_KEY}`);
    const j = await r.json();
    const q = j["Global Quote"];
    if (q && q["05. price"] && parseFloat(q["05. price"]) !== 0) {
      const price = parseFloat(q["05. price"]);
      const prev  = parseFloat(q["08. previous close"]);
      const change = parseFloat(q["09. change"]);
      const pct   = parseFloat(q["10. change percent"].replace("%",""));
      return res.status(200).json({ price, change, pct, prev, source: "alphavantage" });
    }
  } catch(e) {}

  res.status(500).json({ error: "no data for " + symbol });
}