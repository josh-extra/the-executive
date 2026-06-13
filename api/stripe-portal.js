export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const stripe = await import("stripe").then(m => m.default(process.env.STRIPE_SECRET_KEY));

  try {
    const { customerId } = req.body;
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: "https://the-executive.vip/app",
    });
    res.status(200).json({ url: session.url });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}