// lib/notify-owner.js
// Sends Josh a phone notification through Pushover (new sign-ups and new subscribers).
//
// Vercel environment variables:
//   PUSHOVER_USER_KEY   - your User Key (who receives it), shown on pushover.net once logged in
//   PUSHOVER_APP_TOKEN  - the API Token of the "The Executive" application (who sends it)
//
// Never throws and never holds a webhook up for long: if Pushover is not configured or is
// unreachable, the notification is skipped and the webhook carries on as normal.

const SUPABASE_URL = "https://vvnnzepagtrlvnqyqbdr.supabase.co";

export async function notifyOwner({ title, message, priority = 0, sound }) {
  const token = process.env.PUSHOVER_APP_TOKEN;
  const user = process.env.PUSHOVER_USER_KEY;
  if (!token || !user) {
    console.warn("Pushover not configured (PUSHOVER_APP_TOKEN / PUSHOVER_USER_KEY) - skipping:", title);
    return false;
  }
  const body = new URLSearchParams({ token, user, title: String(title).slice(0, 250), message: String(message).slice(0, 1024), priority: String(priority) });
  if (sound) body.set("sound", sound);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch("https://api.pushover.net/1/messages.json", { method: "POST", body, signal: ctrl.signal });
    if (!r.ok) console.error("Pushover failed:", r.status, (await r.text()).slice(0, 200));
    return r.ok;
  } catch (e) {
    console.error("Pushover error:", e.message);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Look up a user's email with the service key (for events that only carry the user id).
export async function lookupEmail(userId) {
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!key || !userId) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.email || null;
  } catch {
    return null;
  }
}

export function money(amount, currency) {
  if (amount == null || isNaN(amount)) return "";
  const c = String(currency || "AUD").toUpperCase();
  return (c === "AUD" ? "$" : c + " ") + Number(amount).toFixed(2).replace(/\.00$/, "");
}
