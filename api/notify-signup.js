// api/notify-signup.js
// Called by a Supabase Database Webhook when a new account saves its data for the first time
// (INSERT on public.user_data), and sends Josh a "New sign-up" phone notification.
//
// Supabase: Database > Webhooks > Create a new hook
//   Table: public.user_data   Events: Insert   Type: HTTP Request   Method: POST
//   URL: https://the-executive.vip/api/notify-signup
//   HTTP header: x-webhook-secret = the same value as NOTIFY_WEBHOOK_SECRET in Vercel
import { notifyOwner, lookupEmail } from "../lib/notify-owner.js";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).end(); return; }

  const expected = process.env.NOTIFY_WEBHOOK_SECRET;
  if (!expected) {
    console.error("NOTIFY_WEBHOOK_SECRET not set - rejecting");
    return res.status(500).json({ error: "Not configured" });
  }
  if (req.headers["x-webhook-secret"] !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (body?.type !== "INSERT" || !body?.record?.user_id) {
    return res.status(200).json({ skipped: true });
  }

  const rec = body.record;
  const profile = (rec.data && rec.data.profile) || {};
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  const email = await lookupEmail(rec.user_id);
  const who = [name, email].filter(Boolean).join(" - ") || "new account";

  await notifyOwner({ title: "New sign-up", message: who, sound: "bike" });
  res.status(200).json({ ok: true });
}
