// api/meta-capi.js
// Meta Conversions API helper - server-side event forwarding.
// Server-side events survive iOS ATT, adblockers and cookie loss,
// so they are the reliable signal Meta optimises against.

import crypto from "node:crypto";

const GRAPH_VERSION = "v21.0";

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(String(value).trim().toLowerCase())
    .digest("hex");
}

/**
 * Send a single event to the Meta Conversions API.
 *
 * Required env vars (set in Vercel):
 *   META_PIXEL_ID        - your pixel / dataset ID
 *   META_CAPI_TOKEN      - System User access token from Events Manager
 *   META_TEST_EVENT_CODE - optional, only while testing in Events Manager
 */
export async function sendMetaEvent({
  eventName,
  eventId,
  email,
  userId,
  value,
  currency = "AUD",
  fbp,
  fbc,
  ip,
  userAgent,
  eventSourceUrl = "https://the-executive.vip/app",
  customData = {},
}) {
  const PIXEL_ID = process.env.META_PIXEL_ID;
  const TOKEN = process.env.META_CAPI_TOKEN;

  if (!PIXEL_ID || !TOKEN) {
    console.warn("Meta CAPI not configured (META_PIXEL_ID / META_CAPI_TOKEN) - skipping", eventName);
    return { skipped: true };
  }

  // All PII must be SHA-256 hashed before it leaves the server.
  const user_data = {};
  if (email) user_data.em = [sha256(email)];
  if (userId) user_data.external_id = [sha256(userId)];
  if (fbp) user_data.fbp = fbp;
  if (fbc) user_data.fbc = fbc;
  if (ip) user_data.client_ip_address = ip;
  if (userAgent) user_data.client_user_agent = userAgent;

  const custom_data = { ...customData };
  if (value != null) {
    custom_data.value = Number(value);
    custom_data.currency = currency;
  }

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "website",
        event_source_url: eventSourceUrl,
        user_data,
        ...(Object.keys(custom_data).length ? { custom_data } : {}),
      },
    ],
  };

  if (process.env.META_TEST_EVENT_CODE) {
    payload.test_event_code = process.env.META_TEST_EVENT_CODE;
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events?access_token=${TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      console.error("Meta CAPI error:", eventName, JSON.stringify(data));
      return { ok: false, data };
    }
    console.log("Meta CAPI sent:", eventName, "received:", data.events_received);
    return { ok: true, data };
  } catch (e) {
    console.error("Meta CAPI request failed:", eventName, e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Look up the browser attribution cookies we stashed at checkout time.
 * Returns {} if nothing was captured - the event still sends, just with
 * lower match quality (hashed email + external_id only).
 */
export async function getAttribution(userId, supabaseUrl, supabaseKey) {
  if (!userId || !supabaseKey) return {};
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/meta_attribution?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );
    const data = await res.json();
    return Array.isArray(data) && data[0] ? data[0] : {};
  } catch (e) {
    console.error("Attribution lookup failed:", e.message);
    return {};
  }
}
