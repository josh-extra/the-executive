// In-memory rate limit store — resets on cold start
// Key: userId or IP, Value: { count, windowStart }
const rateLimitStore = new Map();
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 20; // per hour per user
const SUPABASE_URL = "https://vvnnzepagtrlvnqyqbdr.supabase.co";

function getRateLimitKey(req) {
  // Try to extract user ID from Authorization header
  const auth = req.headers["authorization"];
  if (auth?.startsWith("Bearer ")) return "user_" + auth.slice(7, 40);
  // Fall back to IP
  return "ip_" + (req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "unknown");
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

async function verifySubscription(token) {
  if (!token) return false;
  try {
    // Get user ID from token
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { "apikey": process.env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` }
    });
    const user = await userRes.json();
    if (!user?.id) return false;
    // Check subscription
    const subRes = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${user.id}&select=status`, {
      headers: { "apikey": process.env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` }
    });
    const subs = await subRes.json();
    return subs?.[0]?.status === "active" || subs?.[0]?.status === "trialing";
  } catch { return false; }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  // Extract auth token
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  // Verify Pro subscription
  const isPro = await verifySubscription(token);
  if (!isPro) {
    return res.status(403).json({ error: "Executive subscription required", code: "NOT_PRO" });
  }

  // Rate limit check
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
    // Safety: enforce max_tokens cap to prevent runaway costs
    if (body.max_tokens && body.max_tokens > 4000) body.max_tokens = 4000;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "interleaved-thinking-2025-05-14"
      },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}