const WINDOW_SECONDS = 60 * 60;
const MAX_REQUESTS = 20;
const SUPABASE_URL = "https://vvnnzepagtrlvnqyqbdr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yh1Srs_fsONIuZQ7flIksg_f53KPcVn";

// Atomic, persistent rate limit check via Supabase RPC — safe across
// Vercel's multiple/cold-started instances, unlike an in-memory Map.
async function checkRateLimit(userId, serviceKey) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_and_increment_rate_limit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_max_requests: MAX_REQUESTS,
        p_window_seconds: WINDOW_SECONDS
      })
    });
    if (!res.ok) {
      console.error("Rate limit RPC failed:", res.status, await res.text());
      // Fail closed: if we can't verify the limit, don't allow the request.
      return { allowed: false, remaining: 0, resetIn: 60 };
    }
    const rows = await res.json();
    const row = rows?.[0];
    return {
      allowed: row?.allowed ?? false,
      remaining: row?.remaining ?? 0,
      resetIn: Math.ceil((row?.reset_in_seconds ?? 3600) / 60)
    };
  } catch(e) {
    console.error("Rate limit check error:", e.message);
    return { allowed: false, remaining: 0, resetIn: 60 };
  }
}

// Verify the token's signature with Supabase (NOT just decoding the payload —
// an unsigned decode lets anyone forge a token with any user_id).
// Returns the verified user id, or null if the token is invalid/expired.
async function getVerifiedUserId(token) {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${token}`
      }
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user?.id || null;
  } catch(e) {
    console.error("Token verification error:", e.message);
    return null;
  }
}

async function verifySubscription(token) {
  if (!token) return { isPro: false, userId: null };
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    // Fail CLOSED, not open — a missing env var should never grant Pro access.
    console.error("SUPABASE_SERVICE_KEY not set — denying request");
    return { isPro: false, userId: null };
  }
  try {
    // Verify the token's signature via Supabase auth, don't just decode it
    const userId = await getVerifiedUserId(token);
    if (!userId) {
      console.error("Token failed verification");
      return { isPro: false, userId: null };
    }

    // Check subscription using service key
    const subRes = await fetch(
      `${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}&select=status`,
      {
        headers: {
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`
        }
      }
    );
    if (!subRes.ok) {
      console.error("Subscription lookup failed:", subRes.status, await subRes.text());
      return { isPro: false, userId };
    }
    const subs = await subRes.json();
    const status = subs?.[0]?.status;
    console.log(`User ${userId} subscription: ${status}`);
    return { isPro: status === "active" || status === "trialing", userId };
  } catch(e) {
    console.error("verifySubscription error:", e.message);
    return { isPro: false, userId: null };
  }
}


export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  const { isPro, userId } = await verifySubscription(token);
  if (!isPro) {
    return res.status(403).json({ error: "Executive subscription required", code: "NOT_PRO" });
  }

  const { allowed, remaining, resetIn } = await checkRateLimit(userId, process.env.SUPABASE_SERVICE_KEY);
  res.setHeader("X-RateLimit-Limit", MAX_REQUESTS);
  res.setHeader("X-RateLimit-Remaining", remaining);

  if (!allowed) {
    return res.status(429).json({
      error: `Rate limit reached — ${MAX_REQUESTS} AI requests per hour. Resets in ${resetIn} minutes.`,
      code: "RATE_LIMITED",
      resetIn
    });
  }

  try {
    const body = req.body;
    if (body.max_tokens && body.max_tokens > 4000) body.max_tokens = 4000;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}