// api/meta-attr.js
// Captures the Meta browser cookies (_fbp / _fbc) at checkout time and stores
// them against the user, so the server-side Purchase event fired later from
// stripe-webhook.js can be attributed back to the ad click.
//
// Without this, a Purchase can still match on hashed email, but ad-level
// attribution is much weaker.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const SUPABASE_URL = "https://vvnnzepagtrlvnqyqbdr.supabase.co";
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_KEY) {
    console.warn("SUPABASE_SERVICE_KEY not set - skipping attribution capture");
    res.status(200).json({ ok: false });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const { userId, fbp, fbc, ua } = body || {};

  if (!userId) {
    res.status(400).json({ error: "userId required" });
    return;
  }

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/meta_attribution`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        user_id: userId,
        fbp: fbp || null,
        fbc: fbc || null,
        user_agent: ua || req.headers["user-agent"] || null,
        ip_address: ip || null,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error("Attribution upsert failed:", r.status, txt);
    }
    res.status(200).json({ ok: r.ok });
  } catch (e) {
    console.error("Attribution capture error:", e.message);
    res.status(200).json({ ok: false });
  }
}
