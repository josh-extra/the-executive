export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// ── Email templates ──────────────────────────────────────────────────────────

const baseStyle = `
  body{margin:0;padding:0;background:#060606;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;}
  .wrap{max-width:560px;margin:0 auto;padding:48px 24px;}
  .logo{font-size:11px;letter-spacing:5px;color:#C9A84C;text-transform:uppercase;margin-bottom:32px;}
  .rule{width:40px;height:1px;background:linear-gradient(90deg,transparent,#C9A84C,transparent);margin-bottom:32px;}
  .card{background:#0E0E0E;border:1px solid #1A1A1A;border-radius:12px;padding:32px;}
  h1{font-size:28px;font-weight:300;color:#E8E0D0;line-height:1.3;margin:0 0 12px;}
  h1 em{color:#C9A84C;font-style:italic;}
  p{font-size:13px;color:#6A6050;line-height:1.85;margin:0 0 16px;}
  .highlight{color:#E8E0D0;}
  .btn{display:inline-block;background:linear-gradient(135deg,#C9A84C,#E8C96A);color:#060606;padding:12px 28px;border-radius:6px;font-size:11px;letter-spacing:2px;text-decoration:none;text-transform:uppercase;font-weight:600;margin:8px 0 20px;}
  .features{list-style:none;padding:0;margin:20px 0;}
  .features li{font-size:12px;color:#6A6050;padding:7px 0;border-bottom:1px solid #1A1A1A;display:flex;align-items:center;gap:8px;}
  .features li::before{content:'';width:4px;height:4px;border-radius:50%;background:#C9A84C;flex-shrink:0;}
  .features li span{color:#E8E0D0;}
  .footer{margin-top:32px;font-size:10px;color:#3A3020;letter-spacing:1px;text-align:center;line-height:1.8;}
`;

function welcomeEmail(email) {
  return {
    from: "The Executive <hello@the-executive.vip>",
    to: email,
    subject: "Welcome to The Executive",
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${baseStyle}</style></head><body>
<div class="wrap">
  <div class="logo">The Executive</div>
  <div class="rule"></div>
  <div class="card">
    <h1>Welcome to<br><em>The Executive</em></h1>
    <p>Your account is set up and ready. You now have access to every tool in the dashboard — from wealth tracking and habit streaks to your private AI Advisor.</p>
    <a href="https://the-executive.vip/app" class="btn">Open Your Dashboard</a>
    <p>A few things worth doing first:</p>
    <ul class="features">
      <li><span>Set your financial snapshot</span> — net worth target, assets and debts in Profile</li>
      <li><span>Add your habits</span> — the daily score tracks tasks, habits and supplements</li>
      <li><span>Try the AI Advisor</span> — ask for a full dashboard review on day one</li>
      <li><span>Set your market tickers</span> — tap Edit on the Markets card to add ASX, US stocks, crypto</li>
      <li><span>Install on your phone</span> — open in Safari → Share → Add to Home Screen</li>
    </ul>
    <p>If you have any questions, reply to this email and I'll get back to you personally.</p>
    <p class="highlight">— The Executive Team</p>
  </div>
  <div class="footer">
    the-executive.vip · Your private dashboard for wealth, health &amp; success<br>
    Free forever · Cancel anytime from your Profile page
  </div>
</div>
</body></html>`
  };
}

function subscriptionActiveEmail(email, planLabel, periodEnd) {
  const endDate = periodEnd
    ? new Date(periodEnd).toLocaleDateString("en-AU", { day:"numeric", month:"long", year:"numeric" })
    : null;
  return {
    from: "The Executive <hello@the-executive.vip>",
    to: email,
    subject: "You're now an Executive member",
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${baseStyle}</style></head><body>
<div class="wrap">
  <div class="logo">The Executive</div>
  <div class="rule"></div>
  <div class="card">
    <h1>Executive access<br><em>unlocked</em></h1>
    <p>Your <span class="highlight">${planLabel}</span> subscription is now active. Every AI-powered feature in the dashboard is yours.</p>
    ${endDate ? `<p>Your next billing date is <span class="highlight">${endDate}</span>.</p>` : ""}
    <a href="https://the-executive.vip/app" class="btn">Open Your Dashboard</a>
    <p>What you've just unlocked:</p>
    <ul class="features">
      <li><span>AI Advisor</span> — full dashboard visibility + live web search</li>
      <li><span>Morning Briefing</span> — daily market data, priorities and mindset</li>
      <li><span>AI goal suggestions</span> — checkpoints and milestones generated for you</li>
      <li><span>AI supplement recommendations</span> — personalised to your health goals</li>
      <li><span>AI workout plan generator</span> — tailored to your training goals</li>
      <li><span>Weekly AI performance review</span> — honest assessment every Monday</li>
      <li><span>Live market data</span> — ASX, US stocks, crypto, commodities</li>
      <li><span>Invest intelligence</span> — live opportunities and portfolio insights</li>
    </ul>
    <p>Cancel anytime from the Profile page — no questions asked.</p>
    <p class="highlight">— The Executive Team</p>
  </div>
  <div class="footer">
    the-executive.vip · Manage your subscription from the Profile page<br>
    Questions? Reply to this email.
  </div>
</div>
</body></html>`
  };
}

function cancellationEmail(email, periodEnd) {
  const endDate = periodEnd
    ? new Date(periodEnd).toLocaleDateString("en-AU", { day:"numeric", month:"long", year:"numeric" })
    : "the end of your billing period";
  return {
    from: "The Executive <hello@the-executive.vip>",
    to: email,
    subject: "Your Executive subscription has been cancelled",
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${baseStyle}</style></head><body>
<div class="wrap">
  <div class="logo">The Executive</div>
  <div class="rule"></div>
  <div class="card">
    <h1>Subscription<br><em>cancelled</em></h1>
    <p>Your Executive subscription has been cancelled. You'll retain full access until <span class="highlight">${endDate}</span>, after which your account moves to the free plan.</p>
    <p>Your data — tasks, journal, goals, workouts, wealth history, everything — is kept intact. You never lose your history, just the AI-powered features.</p>
    <a href="https://the-executive.vip/app" class="btn">Return to Dashboard</a>
    <p>If you cancelled by mistake or want to resubscribe, you can upgrade again anytime from the Profile page.</p>
    <p>If there was something that didn't work for you, reply to this email — I read every response personally.</p>
    <p class="highlight">— The Executive Team</p>
  </div>
  <div class="footer">
    the-executive.vip · Free plan remains active · Resubscribe anytime
  </div>
</div>
</body></html>`
  };
}

// ── Send via Resend ──────────────────────────────────────────────────────────

async function sendEmail(template) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) { console.warn("RESEND_API_KEY not set — skipping email"); return; }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_KEY}`
      },
      body: JSON.stringify(template)
    });
    const data = await res.json();
    if (!res.ok) console.error("Resend error:", data);
    else console.log("Email sent:", data.id);
  } catch(e) {
    console.error("Email send failed:", e.message);
  }
}

// ── Get user email from Supabase auth ────────────────────────────────────────

async function getUserEmail(userId, supabaseUrl, supabaseKey) {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`
      }
    });
    const data = await res.json();
    return data?.email || null;
  } catch(e) {
    console.error("Failed to fetch user email:", e.message);
    return null;
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

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

  switch(event.type) {

    case "checkout.session.completed": {
      const session = event.data.object;
      const uid = session.metadata?.userId;
      if (uid) {
        await updateSubscription(uid, {
          status: "active",
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          plan: "executive",
          trial_end: null,
        });
        // Welcome email — use email from session first, fall back to Supabase lookup
        const email = session.customer_details?.email
          || await getUserEmail(uid, SUPABASE_URL, SUPABASE_KEY);
        if (email) await sendEmail(welcomeEmail(email));
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object;
      const uid = sub.metadata?.userId;
      if (uid) {
        const becomingActive = sub.status === "active" &&
          (event.type === "customer.subscription.created" ||
           event.data.previous_attributes?.status === "trialing" ||
           event.data.previous_attributes?.status === "incomplete");
        await updateSubscription(uid, {
          status: sub.status,
          stripe_customer_id: sub.customer,
          stripe_subscription_id: sub.id,
          plan: "executive",
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          cancel_at_period_end: sub.cancel_at_period_end,
        });
        // Only send "active" email when subscription transitions to active
        if (becomingActive) {
          const email = await getUserEmail(uid, SUPABASE_URL, SUPABASE_KEY);
          const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
          const planLabel = interval === "year" ? "Annual" : "Monthly";
          const periodEnd = new Date(sub.current_period_end * 1000).toISOString();
          if (email) await sendEmail(subscriptionActiveEmail(email, planLabel, periodEnd));
        }
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
        const email = await getUserEmail(uid, SUPABASE_URL, SUPABASE_KEY);
        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;
        if (email) await sendEmail(cancellationEmail(email, periodEnd));
      }
      break;
    }

    default:
      break;
  }

  res.status(200).json({ received: true });
}