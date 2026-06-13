export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).end(); return; }

  const stripe = await import("stripe").then(m => m.default(process.env.STRIPE_SECRET_KEY));
  const SUPABASE_URL = "https://vvnnzepagtrlvnqyqbdr.supabase.co";
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  const rawBody = await getRawBody(req);
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch(e) {
    console.error("Webhook signature error:", e.message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  const updateSubscription = async (userId, data) => {
    if (!userId) return;
    await fetch(`${SUPABASE_URL}/rest/v1/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Prefer": "resolution=merge-duplicates"
      },
      body: JSON.stringify({ user_id: userId, ...data, updated_at: new Date().toISOString() })
    });
  };

  const userId = event.data.object?.metadata?.userId ||
                 event.data.object?.subscription_data?.metadata?.userId;

  switch(event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const uid = session.metadata?.userId;
      if (uid) {
        await updateSubscription(uid, {
          status: "trialing",
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          plan: "executive",
          trial_end: null,
        });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object;
      const uid = sub.metadata?.userId;
      if (uid) {
        await updateSubscription(uid, {
          status: sub.status, // trialing, active, past_due, canceled
          stripe_customer_id: sub.customer,
          stripe_subscription_id: sub.id,
          plan: "executive",
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          cancel_at_period_end: sub.cancel_at_period_end,
        });
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const uid = sub.metadata?.userId;
      if (uid) {
        await updateSubscription(uid, {
          status: "canceled",
          plan: "free",
          stripe_subscription_id: sub.id,
        });
      }
      break;
    }
    default:
      break;
  }

  res.status(200).json({ received: true });
}