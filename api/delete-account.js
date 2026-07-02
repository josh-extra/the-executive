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
  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
  if (!SERVICE_KEY) return res.status(500).json({ error: "Service key not configured" });

  try {
    // 1. Get user from token
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${token}` }
    });
    const user = await userRes.json();
    if (!user?.id) return res.status(401).json({ error: "Invalid token" });
    const userId = user.id;

    // 2. Cancel Stripe subscription if exists
    if (STRIPE_KEY) {
      try {
        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(STRIPE_KEY);
        const subRes = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}&select=stripe_subscription_id`, {
          headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` }
        });
        const subs = await subRes.json();
        const subId = subs?.[0]?.stripe_subscription_id;
        if (subId) {
          await stripe.subscriptions.cancel(subId).catch(() => {});
          console.log(`Cancelled Stripe subscription ${subId} for user ${userId}`);
        }
      } catch(e) {
        console.error("Stripe cancellation error:", e.message);
        // Continue with deletion even if Stripe fails
      }
    }

    // 3. Delete user_data
    await fetch(`${SUPABASE_URL}/rest/v1/user_data?user_id=eq.${userId}`, {
      method: "DELETE",
      headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` }
    });

    // 4. Delete subscriptions
    await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}`, {
      method: "DELETE",
      headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` }
    });

    // 5. Delete auth user (must be last)
    const deleteRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` }
    });

    if (!deleteRes.ok) {
      const err = await deleteRes.json();
      throw new Error(err.message || "Failed to delete auth user");
    }

    console.log(`Account deleted for user ${userId} (${user.email})`);
    res.status(200).json({ deleted: true });

  } catch(e) {
    console.error("Account deletion error:", e.message);
    res.status(500).json({ error: e.message });
  }
}
