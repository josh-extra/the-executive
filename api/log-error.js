export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") { res.status(405).end(); return; }
  try {
    const { errorId, message, component, url } = req.body;
    // Logs to Vercel's built-in log viewer
    console.error("[ERROR]", JSON.stringify({ errorId, message, component, url, time: new Date().toISOString() }));
    res.status(200).json({ logged: true });
  } catch {
    res.status(200).end(); // Never fail error logging
  }
}
