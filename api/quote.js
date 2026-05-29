export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { symbol } = req.query;
  if (!symbol) { res.status(400).json({ error: "symbol required" }); return; }
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=d8cmivhr01qidic8koq0d8cmivhr01qidic8koqg`);
    const j = await r.json();
    if (!j.c || j.c === 0) throw new Error("no data for " + symbol);
    res.status(200).json({ price: j.c, change: j.d, pct: j.dp, prev: j.pc });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}