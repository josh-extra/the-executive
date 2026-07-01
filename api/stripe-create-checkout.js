import Stripe from "stripe";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { priceId, email, userId, mode } = req.body;

    if (!priceId || !userId) {
      return res.status(400).json({ error: "Missing priceId or userId" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: mode || "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: mode !== "payment" ? {
        metadata: { userId }
      } : undefined,
      metadata: { userId },
      success_url: "https://the-executive.vip/app?stripe=success",
      cancel_url: "https://the-executive.vip/app?stripe=cancel",
      allow_promotion_codes: true,
    });

    res.status(200).json({ url: session.url, sessionId: session.id });
  } catch(e) {
    console.error("Stripe checkout error:", e.message);
    res.status(500).json({ error: e.message });
  }
}