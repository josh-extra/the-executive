const rateLimitStore = new Map();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 20;
const SUPABASE_URL = "https://vvnnzepagtrlvnqyqbdr.supabase.co";

function getRateLimitKey(req) {
  const auth = req.headers["authorization"];
  if (auth?.startsWith("Bearer ")) return "user_" + auth.slice(7, 40);
  return "ip_" + (req.headers["x-forwarded-for"]?.split(",")[0] || "unknown");
}

function checkRateLimit(key) {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }
  if (entry.count >= MAX_REQUESTS) {
    const resetIn = Math.ceil((WINDOW_MS - (now - entry.windowStart)) / 60000);
    return { allowed: false, remaining: 0, resetIn };
  }
  entry.count++;
  return { allowed: true, remaining: MAX_REQUESTS - entry.count };
}

// Decode user ID directly from JWT — no network call needed
function getUserIdFromToken(token) {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return decoded.sub || decoded.user_id || null;
  } catch { return null; }
}

async function verifySubscription(token) {
  if (!token) return false;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    console.warn("SUPABASE_SERVICE_KEY not set — allowing request");
    return true;
  }
  try {
    // Extract user ID directly from JWT — no auth API call needed
    const userId = getUserIdFromToken(token);
    if (!userId) {
      console.error("Could not extract user ID from token");
      return false;
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
      return false;
    }
    const subs = await subRes.json();
    const status = subs?.[0]?.status;
    console.log(`User ${userId} subscription: ${status}`);
    return status === "active" || status === "trialing";
  } catch(e) {
    console.error("verifySubscription error:", e.message);
    return false;
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

  const isPro = await verifySubscription(token);
  if (!isPro) {
    return res.status(403).json({ error: "Executive subscription required", code: "NOT_PRO" });
  }

  const key = getRateLimitKey(req);
  const { allowed, remaining, resetIn } = checkRateLimit(key);
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