// Receives webhook events from RevenueCat and keeps the Supabase
// `subscriptions` table in sync, using the same status vocabulary as the
// existing Stripe webhook so the rest of the app (isPro/isFeatureLocked,
// api/claude.js) needs zero changes to support Apple IAP subscribers.
//
// Configure this URL in RevenueCat: Project Settings > Integrations >
// Webhooks > add https://the-executive.vip/api/revenuecat-webhook
// Set an "Authorization header value" there too, matching
// REVENUECAT_WEBHOOK_SECRET below.

const SUPABASE_URL = "https://vvnnzepagtrlvnqyqbdr.supabase.co";
const ENTITLEMENT_ID = "pro";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).end(); return; }

  const auth = req.headers["authorization"];
  const expected = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!expected) {
    console.error("REVENUECAT_WEBHOOK_SECRET not set - rejecting webhook");
    return res.status(500).json({ error: "Not configured" });
  }
  if (auth !== expected && auth !== `Bearer ${expected}`) {
    console.error("RevenueCat webhook: invalid Authorization header");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    console.error("SUPABASE_SERVICE_KEY not set - rejecting webhook");
    return res.status(500).json({ error: "Not configured" });
  }

  try {
    const event = req.body?.event;
    if (!event) return res.status(400).json({ error: "Missing event" });

    const userId = event.app_user_id;
    if (!userId) return res.status(400).json({ error: "Missing app_user_id" });

    // Only act on events for our "pro" entitlement - ignore anything else
    // (e.g. other entitlements, if any get added later).
    const entitlementIds = event.entitlement_ids || (event.entitlement_id ? [event.entitlement_id] : []);
    if (entitlementIds.length && !entitlementIds.includes(ENTITLEMENT_ID)) {
      return res.status(200).json({ skipped: true, reason: "different entitlement" });
    }

    let status;
    switch (event.type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "UNCANCELLATION":
      case "PRODUCT_CHANGE":
      case "NON_RENEWING_PURCHASE":
      case "TRANSFER":
        status = event.period_type === "TRIAL" ? "trialing" : "active";
        break;
      case "CANCELLATION":
        // Auto-renew turned off, but access continues until the period
        // actually ends (Apple keeps entitlement active till then) - the
        // EXPIRATION event is what actually ends access.
        status = "active";
        break;
      case "BILLING_ISSUE":
        status = "past_due";
        break;
      case "EXPIRATION":
        status = "cancelled";
        break;
      default:
        // SUBSCRIBER_ALIAS, TEST, and anything else we don't need to act on
        return res.status(200).json({ skipped: true, reason: "unhandled event type: " + event.type });
    }

    const plan = event.product_id?.includes("annual") ? "annual"
               : event.product_id?.includes("monthly") ? "monthly"
               : null;

    const payload = {
      user_id: userId,
      status,
      plan,
      provider: "revenuecat",
      revenuecat_app_user_id: userId,
      updated_at: new Date().toISOString(),
    };

    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify(payload),
    });

    if (!upsertRes.ok) {
      const text = await upsertRes.text();
      console.error("Supabase upsert failed:", upsertRes.status, text);
      return res.status(500).json({ error: "Database update failed" });
    }

    console.log(`RevenueCat webhook: user ${userId} -> ${status} (${event.type})`);
    res.status(200).json({ received: true });
  } catch (e) {
    console.error("RevenueCat webhook error:", e.message);
    res.status(500).json({ error: e.message });
  }
}
