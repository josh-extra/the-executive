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
    // Verify the token's signature via Supabase auth - never trust a
    // client-submitted customerId directly, or anyone could open the
    // billing portal for someone else's Stripe customer.
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${token}` }
    });
    if (!userRes.ok) return res.status(401).json({ error: "Invalid token" });
    const user = await userRes.json();
    if (!user?.id) return res.status(401).json({ error: "Invalid token" });

    // Look up the customer ID server-side - this is the only source of
    // truth for which Stripe customer this user is allowed to manage.
    const subRes = await fetch(
      `${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${user.id}&select=stripe_customer_id`,
      { headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` } }
    );
    if (!subRes.ok) {
      console.error("Subscription lookup failed:", subRes.status, await subRes.text());
      return res.status(500).json({ error: "Could not look up subscription" });
    }
    const subs = await subRes.json();
    const customerId = subs?.[0]?.stripe_customer_id;
    if (!customerId) {
      return res.status(404).json({ error: "No Stripe customer found for this account" });
    }

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: "https://the-executive.vip/app",
    });
    res.status(200).json({ url: session.url });
  } catch(e) {
    console.error("Stripe portal error:", e.message);
    res.status(500).json({ error: e.message });
  }
}
