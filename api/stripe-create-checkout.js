import Stripe from "stripe";

const SUPABASE_URL = "https://vvnnzepagtrlvnqyqbdr.supabase.co";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SERVICE_KEY) return res.status(500).json({ error: "Service key not configured" });

  try {
    // Verify the token and derive userId server-side - never trust a
    // client-submitted userId, or anyone could stamp someone else's
    // account onto their own Stripe checkout session.
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${token}` }
    });
    if (!userRes.ok) return res.status(401).json({ error: "Invalid token" });
    const user = await userRes.json();
    if (!user?.id) return res.status(401).json({ error: "Invalid token" });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { priceId, mode } = req.body;

    if (!priceId) {
      return res.status(400).json({ error: "Missing priceId" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: mode || "subscription",
      payment_method_types: ["card"],
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: mode !== "payment" ? {
        metadata: { userId: user.id }
      } : undefined,
      metadata: { userId: user.id },
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
