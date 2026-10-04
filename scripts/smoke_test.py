#!/usr/bin/env python3
"""
The Executive - smoke test. Run before every push.

What it checks (against the BUILT app in ./dist):
  1. Signed-out start: the app loads to the sign-in screen without errors.
  2. Every page in NAV opens without a crash, at desktop (1280px) and phone
     (390px) size, using a logged-in test account with data in every section.
     Also flags pages that scroll sideways on a phone.
  3. Saving: a Super balance update reaches Supabase, and the save contains
     every section of the account (nothing dropped or shrunk).

Supabase, Stripe, market prices and the AI are simulated - nothing real is
touched and no real account is used.

Usage:
  npx vite build && python3 scripts/smoke_test.py
  python3 scripts/smoke_test.py --build        (builds first)
  python3 scripts/smoke_test.py --only desktop (or: phone)

Needs: pip install playwright  (and a Chromium; set CHROMIUM_PATH if needed)
Exit code 0 = all passed, 1 = something failed.
"""
import json, os, re, sys, time, datetime, threading, subprocess, functools, http.server, socketserver

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
APP = os.path.join(ROOT, "src", "App.jsx")
CHROMIUM = os.environ.get("CHROMIUM_PATH", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")

def ds(n):
    return (datetime.date.today() - datetime.timedelta(days=n)).isoformat()

# ---------------------------------------------------------------- test data
# Deliberately long text: pages must cut it off or wrap it, never spill past the page edge
LONG_TEXT = "Complete final 8 listing presentations (Aug 11-Sept 30). Achieve 16+ total presentations for the year and review each one afterwards"

def seed():
    snaps = {}
    v = 560000
    for n in range(40, 0, -1):
        v += 350
        snaps[ds(n)] = {"nw": v, "a": v + 620000, "d": 620000, "td": ["Morning briefing"], "to": [], "st": ["Creatine"], "sm": [], "books": {}}
    return {
        "lastSavedDate": ds(0), "theme": "obsidian",
        "profile": {"firstName": "Smoke", "lastName": "Test", "dob": "1995-06-01", "location": "Brisbane, QLD", "occupation": "Tester",
                    "locale": "en-AU", "annualIncome": "150000", "netWorthTarget": "3000000", "cashSavings": "40000", "superBalance": "120000",
                    "cashLog": [{"id": 1, "date": ds(10), "balance": 40000, "change": 5000, "note": "Pay"}], "riskProfile": ["Growth - accept volatility"]},
        "tasks": [{"id": 1, "text": "Morning briefing", "done": False, "priority": "high", "recurring": True},
                  {"id": 2, "text": "Call vendors", "done": False, "priority": "medium"}],
        "goals": [{"id": 1, "title": "Reach net worth target", "period": "year", "progress": 20, "category": "financial", "endDate": ds(-40),
                   "checkpoints": [{"id": 1, "text": LONG_TEXT, "dueDate": ds(-2), "done": False}]}],
        "completed": [{"id": 9, "title": "Read 12 books", "period": "year", "progress": 100, "category": "personal", "completedAt": ds(5)}],
        "supplements": [{"id": 1, "name": "Creatine", "dose": "5g", "time": "morning", "taken": False}],
        "habits": [{"id": 1, "name": "Read 20 pages", "icon": "Book", "color": "#C9A84C", "target": 7}],
        "habitLog": {"1_" + ds(1): True, "1_" + ds(2): True},
        "workouts": [{"id": 1, "date": ds(1), "type": "Strength", "duration": 50, "notes": "", "sets": []}],
        "bodyLog": [{"id": 1, "date": ds(1), "weight": "82.4", "bodyFat": "", "sleep": "", "hrv": ""}],
        "transactions": [{"id": 1, "date": ds(3), "type": "income", "category": "Salary", "amount": 6000, "note": ""},
                         {"id": 2, "date": ds(2), "type": "expense", "category": "Dining", "amount": 85, "note": ""}],
        "journal": [{"id": 1, "date": ds(1), "text": "Good day.", "mood": 4}],
        "books": [{"id": 5, "title": "Deep Work", "author": "Newport", "status": "reading", "cur": 100, "tot": 296,
                   "readingNotes": [{"id": 1, "date": ds(2), "fromPage": 80, "toPage": 100, "text": "# Key idea\n- Focus"}]},
                  {"id": 6, "title": "Next Book", "status": "next", "cur": 0, "tot": 200, "readingNotes": []}],
        "bills": [{"id": 1, "name": "Internet", "amount": 80, "frequency": "monthly", "category": "Utilities", "lastPaid": ds(20), "nextDue": ds(-10), "autopay": True}],
        "debts": [{"id": 2, "name": "Home Loan", "type": "Mortgage", "balance": 600000, "originalBalance": 620000, "rate": 6.2, "minPayment": 900,
                   "frequency": "weekly", "nextPaymentDate": ds(-3), "offsetBalance": 20000, "payments": []},
                  {"id": 3, "name": "Car Loan", "type": "Car Finance", "balance": 20000, "originalBalance": 25000, "rate": 7, "minPayment": 200,
                   "frequency": "weekly", "nextPaymentDate": ds(-2), "payments": []}],
        "properties": [{"id": 101, "nickname": "Home", "type": "home", "category": "residential", "currentValue": 900000, "mortgageBalance": 0,
                        "linkedDebtIds": [2], "valueHistory": [{"date": ds(60), "value": 880000}]}],
        "holdings": [{"id": 1, "ticker": "CBA.AX", "shares": 100, "avgCost": 120, "name": "CBA"},
                     {"id": 2, "ticker": "AAPL", "shares": 10, "avgCost": 250, "name": "Apple"}],
        "cryptoHoldings": [{"id": 3, "ticker": "BTC", "symbol": "BTC", "name": "Bitcoin", "amount": 0.1, "avgCost": 60000}],
        "commodityHoldings": [{"id": 4, "ticker": "GC=F", "name": "Gold", "symbol": "Au", "unit": "oz", "qty": 1, "avgCost": 3000}],
        "altAssets": [{"id": 7, "name": "Watch", "currentValue": 15000, "updatedAt": ds(30)}],
        "superLog": [{"id": 11, "date": ds(90), "balance": 115000, "change": 5000, "type": "balance", "note": ""},
                     {"id": 12, "date": ds(10), "balance": 120000, "change": 5000, "type": "balance", "note": ""}],
        "notes": [{"id": 1, "title": "Note", "content": "Hello", "date": ds(1)}],
        "budgets": {"Dining": 400},
        "weeklyReflections": {},
        "history": {ds(n): {"score": 60 + n, "tasks": 2, "supps": 1, "habits": 1} for n in range(1, 20)},
        "nwHistory": {"2026-06": 540000, "2026-07": 548000},
        "dailySnaps": snaps,
        "advisorMessages": [],
        "calendarItems": [{"id": 21, "type": "reminder", "title": "Check super", "date": ds(10), "repeat": "monthly", "amount": "", "note": "", "doneDates": []},
                          {"id": 23, "type": "reminder", "title": LONG_TEXT, "date": ds(-1), "repeat": "none", "amount": "", "note": LONG_TEXT, "doneDates": []}],
        "watchlist": [{"id": 31, "ticker": "AAPL", "name": "Apple", "notes": "", "alertBelow": "210", "alertAbove": "", "addedDate": ds(20), "addedPrice": 180, "addedCurrency": "USD"}],
        "dividends": [{"id": 22, "ticker": "CBA.AX", "name": "CBA", "amountPerShare": "2.25", "frequency": "quarterly", "nextPayDate": ds(-20), "franking": "100", "shares": 100}],
    }

# Collections that must never shrink in a save (catches accidental data loss)
MUST_KEEP = ["goals", "completed", "supplements", "habits", "workouts", "bodyLog", "transactions", "journal", "books", "bills", "debts",
             "properties", "holdings", "cryptoHoldings", "commodityHoldings", "altAssets", "notes", "calendarItems", "dividends", "watchlist"]

# ---------------------------------------------------------------- helpers
# Anything wider than the page area (ignoring deliberate side-scrolling strips)
SPILL_JS = """()=>{const area=document.querySelector('.exec-main');if(!area)return [];const lim=area.getBoundingClientRect().right+1;const out=[];
const inScroller=e=>{for(let p=e.parentElement;p&&p!==area;p=p.parentElement){const o=getComputedStyle(p).overflowX;if(o==='auto'||o==='scroll'||o==='hidden')return true;}return false;};
for(const e of area.querySelectorAll('*')){const r=e.getBoundingClientRect();if(r.width&&r.right>lim&&!inScroller(e)){out.push('"'+(e.textContent||e.tagName).trim().slice(0,40)+'" by '+Math.round(r.right-lim)+'px');if(out.length>1)break;}}
return out;}"""
def nav_pages():
    src = open(APP, encoding="utf-8").read()
    block = src[src.index("const NAV=["):]
    block = block[:block.index("];")]
    return re.findall(r'\["([a-z]+)","[^"]*","([^"]+)"\]', block)

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def serve(directory):
    handler = functools.partial(QuietHandler, directory=directory)
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, "http://127.0.0.1:%d/" % httpd.server_address[1]

PRICES = {"CBA.AX": (150, "AUD"), "AAPL": (200, "USD"), "BTC-USD": (100000, "USD"), "GC=F": (2500, "USD"), "USDAUD=X": (1.5, "AUD")}

def make_context(browser, width, height, data, posts, signed_in=True):
    ctx = browser.new_context(viewport={"width": width, "height": height})
    # Registered first so the specific Supabase/API mocks below take priority (Playwright checks the newest route first)
    ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1).*"), lambda r: r.fulfill(status=200, body="") if r.request.resource_type in ("image", "font", "stylesheet") else r.continue_())
    def supa(route):
        u, m = route.request.url, route.request.method
        if not signed_in:
            return route.fulfill(status=401, content_type="application/json", body="{}")
        if "/auth/v1/" in u:
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({"id": "u1", "email": "smoke@test.com"}))
        if "/rest/v1/user_data" in u:
            if m == "GET":
                return route.fulfill(status=200, content_type="application/json", body=json.dumps([{"data": data}]))
            try: posts.append(json.loads(route.request.post_data)["data"])
            except Exception: pass
            return route.fulfill(status=201, content_type="application/json", body="[]")
        if "/rest/v1/subscriptions" in u:
            return route.fulfill(status=200, content_type="application/json", body=json.dumps([{"status": "active", "plan": "annual"}]))
        return route.fulfill(status=200, content_type="application/json", body="[]")
    ctx.route("**/*supabase.co/**", supa)
    def api(route):
        u = route.request.url
        if "/api/quote" in u:
            sym = re.search(r"symbol=([^&]+)", u)
            sym = __import__("urllib.parse").parse.unquote(sym.group(1)) if sym else ""
            price, ccy = PRICES.get(sym, (100, "USD"))
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({"price": price, "change": price * 0.01, "pct": 1, "currency": ccy}))
        if "/api/claude" in u:
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({"content": [{"type": "text", "text": "Smoke test reply."}]}))
        return route.fulfill(status=200, content_type="application/json", body="{}")
    ctx.route("**/api/**", api)
    return ctx

def watch_errors(page, bucket):
    page.on("pageerror", lambda e: bucket.append("JS error: " + str(e)[:200]))
    page.on("console", lambda m: bucket.append("console: " + m.text[:200]) if m.type == "error" and "Failed to load resource" not in m.text and "net::" not in m.text else None)

def crashed(page):
    return "Something went wrong" in (page.inner_text("body") or "")

def open_signed_in(browser, url, width, height, data, posts, errs):
    ctx = make_context(browser, width, height, data, posts)
    page = ctx.new_page()
    watch_errors(page, errs)
    page.goto(url)
    page.evaluate("d=>{localStorage.setItem('exec_token','x.eyJzdWIiOiJ1MSIsImV4cCI6OTk5OTk5OTk5OX0.x');localStorage.setItem('exec_v1',JSON.stringify(d));localStorage.setItem('exec_fx',JSON.stringify({'USD>AUD':{rate:1.5,at:Date.now()}}));}", data)
    page.reload()
    page.wait_for_timeout(5000)
    for label in ("Keep Building", "Close", "Dismiss", "Got it"):
        try: page.get_by_role("button", name=label, exact=True).first.click(timeout=400)
        except Exception: pass
    return ctx, page

def go(page, pid, label, phone):
    if phone:
        page.evaluate("""l=>{const b=[...document.querySelectorAll('button')].find(b=>{const s=b.querySelectorAll('span');return s.length&&s[s.length-1].textContent.trim()===l;});if(b){b.click();return true;}return false;}""", label) or None
        page.wait_for_timeout(150)
        ok = page.evaluate("""l=>{const b=[...document.querySelectorAll('button')].find(b=>{const s=b.querySelectorAll('span');return s.length&&s[s.length-1].textContent.trim()===l;});if(b){b.click();return true;}return false;}""", label)
        if not ok:
            page.evaluate("""()=>{const b=[...document.querySelectorAll('button')].find(b=>{const s=b.querySelectorAll('span');return s.length&&s[s.length-1].textContent.trim()==='More';});b&&b.click();}""")
            page.wait_for_timeout(300)
            ok = page.evaluate("""l=>{const b=[...document.querySelectorAll('button')].reverse().find(b=>{const s=b.querySelectorAll('span');return s.length&&s[s.length-1].textContent.trim()===l;});if(b){b.click();return true;}return false;}""", label)
        return ok
    return page.evaluate("""l=>{const b=document.querySelector('button[title="'+l+'"]');if(b){b.click();return true;}return false;}""", label)

# ---------------------------------------------------------------- run
def main():
    args = sys.argv[1:]
    only = args[args.index("--only") + 1] if "--only" in args else None
    if "--build" in args:
        print("Building...")
        r = subprocess.run("npx vite build", shell=True, cwd=ROOT, capture_output=True, text=True)
        if r.returncode != 0:
            print("FAIL  build\n" + (r.stdout + r.stderr)[-1500:]); sys.exit(1)
    if not os.path.exists(os.path.join(DIST, "index.html")):
        print("No build found in dist/. Run `npx vite build` first (or pass --build)."); sys.exit(1)

    from playwright.sync_api import sync_playwright
    httpd, url = serve(DIST)
    pages = nav_pages()
    results = []   # (status, name, detail)
    t0 = time.time()
    with sync_playwright() as p:
        kw = {"executable_path": CHROMIUM} if os.path.exists(CHROMIUM) else {}
        browser = p.chromium.launch(**kw)

        # 1. Signed-out start
        errs = []
        ctx = make_context(browser, 1280, 900, {}, [], signed_in=False)
        pg = ctx.new_page(); watch_errors(pg, errs)
        pg.goto(url); pg.wait_for_timeout(4000)
        ok = not crashed(pg) and not [e for e in errs if e.startswith("JS error")]
        results.append(("PASS" if ok else "FAIL", "Signed-out start", "" if ok else "; ".join(errs[:3]) or "error screen shown"))
        ctx.close()

        # 2. Every page, desktop and phone
        for size, (w, h), phone in (("desktop", (1280, 900), False), ("phone", (390, 844), True)):
            if only and only != size: continue
            errs, posts = [], []
            ctx, pg = open_signed_in(browser, url, w, h, seed(), posts, errs)
            if crashed(pg):
                results.append(("FAIL", size + ": app start", "; ".join(errs[:3]) or "error screen shown")); ctx.close(); continue
            if pg.locator("input[placeholder='Email address']").is_visible():
                results.append(("FAIL", size + ": app start", "sign-in box shown to a signed-in user")); ctx.close(); continue
            for pid, label in pages:
                before = len(errs)
                if not go(pg, pid, label, phone):
                    results.append(("FAIL", size + ": " + label, "couldn't find it in the menu")); continue
                pg.wait_for_timeout(700)
                new = errs[before:]
                if crashed(pg):
                    results.append(("FAIL", size + ": " + label, "; ".join(new[:2]) or "error screen shown"))
                    # Recover: reload the app (back to the Dashboard) and carry on with the next page
                    pg.reload(); pg.wait_for_timeout(4000)
                    for lbl in ("Keep Building", "Close", "Dismiss", "Got it"):
                        try: pg.get_by_role("button", name=lbl, exact=True).first.click(timeout=300)
                        except Exception: pass
                    continue
                js = [e for e in new if e.startswith("JS error")]
                if js:
                    results.append(("FAIL", size + ": " + label, js[0])); continue
                spill = pg.evaluate(SPILL_JS)
                if spill:
                    results.append(("FAIL", size + ": " + label, "content spills past the page edge: " + "; ".join(spill))); continue
                note = ""
                if phone:
                    over = pg.evaluate("()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth")
                    if over > 2: note = "scrolls sideways by %dpx" % over
                if new: note = (note + "; " if note else "") + new[0]
                results.append(("WARN" if note else "PASS", size + ": " + label, note))
            ctx.close()

        # 3. Saving reaches Supabase with the whole account
        errs, posts = [], []
        data = seed()
        ctx, pg = open_signed_in(browser, url, 1280, 900, data, posts, errs)
        go(pg, "wealth", "Wealth", False); pg.wait_for_timeout(1200)
        n0 = len(posts)
        clicked = pg.evaluate("""()=>{const t=[...document.querySelectorAll('div')].find(d=>d.textContent.trim()==='Superannuation');let el=t;while(el&&!el.querySelector('button'))el=el.parentElement;const b=el&&[...el.querySelectorAll('button')].find(b=>b.textContent.includes('Update Balance'));if(b){b.click();return true;}return false;}""")
        saved = None
        if clicked:
            pg.wait_for_timeout(300)
            try:
                pg.locator("input[placeholder='120000']").fill("125000")
                pg.get_by_role("button", name="Save", exact=True).first.click()
                pg.wait_for_timeout(2500)
                saved = posts[-1] if len(posts) > n0 else None
            except Exception as e:
                errs.append("save step: " + str(e)[:120])
        if not saved:
            results.append(("FAIL", "Save: Super update reaches Supabase", "; ".join(errs[:2]) or "no save was sent"))
        else:
            problems = []
            if len(saved.get("superLog", [])) != len(data["superLog"]) + 1: problems.append("Super history not saved")
            if str(saved.get("profile", {}).get("superBalance")) != "125000": problems.append("Super balance not saved")
            for k in MUST_KEEP:
                if len(saved.get(k) or []) < len(data[k]): problems.append(k + " shrank or missing")
            for k in data:
                if k not in saved: problems.append(k + " missing from save")
            # The copy kept on the device must hold everything too (a save that only
            # survives because of the cloud merge would still lose new entries)
            local = pg.evaluate("()=>{try{return JSON.parse(localStorage.getItem('exec_v1'))}catch(e){return null}}") or {}
            for k in MUST_KEEP:
                if len(local.get(k) or []) < len(data[k]): problems.append(k + " not saved on the device")
            results.append(("FAIL" if problems else "PASS", "Save: Super update reaches Supabase with full account", "; ".join(problems[:4])))
        ctx.close()

        # 4. On-screen keyboard (phone): whatever is being typed into stays visible above the keyboard.
        #    The keyboard is simulated with the same event the iOS app sends (336px tall).
        errs = []; KB = 336
        kdata = seed()
        kdata["advisorMessages"] = [{"role": "user", "content": "Question", "timestamp": 1}, {"role": "assistant", "content": ("Answer line. " * 60) + "END-OF-LAST-MESSAGE", "timestamp": 2}]
        ctx, pg = open_signed_in(browser, url, 393, 852, kdata, [], errs)
        KB_SHOW = """([sel,kb])=>{const el=document.querySelector(sel);if(!el)return false;el.focus();const e=new Event('keyboardWillShow');e.keyboardHeight=kb;window.dispatchEvent(e);return true;}"""
        KB_RECT = """([sel,kb])=>{const el=document.querySelector(sel);if(!el)return null;const r=el.getBoundingClientRect();return {top:Math.round(r.top),bottom:Math.round(r.bottom),ok:r.top>=0&&r.bottom<=window.innerHeight-kb+1};}"""
        KB_HIDE = """()=>{window.dispatchEvent(new Event('keyboardWillHide'));const a=document.activeElement;a&&a.blur&&a.blur();}"""
        KB_MARK = """()=>{let i=0;for(const el of document.querySelectorAll('input,textarea,select')){const t=(el.type||'').toLowerCase();if(/^(checkbox|radio|range|button|submit|file|color|hidden)$/.test(t)||el.disabled)continue;const r=el.getBoundingClientRect();const cs=getComputedStyle(el);if(r.width<8||r.height<8||cs.visibility==='hidden'||parseFloat(cs.opacity)<0.05)continue;el.setAttribute('data-kbt',String(i));i++;}return i;}"""
        # Executive AI chat: the box and the end of the last message
        if go(pg, "advisor", "Executive AI", True):
            pg.wait_for_timeout(1200)
            sel = 'input[placeholder="Ask anything..."]'
            if pg.evaluate(KB_SHOW, [sel, KB]):
                pg.wait_for_timeout(1300)
                r = pg.evaluate(KB_RECT, [sel, KB])
                last = pg.evaluate("""()=>{const e=[...document.querySelectorAll('[data-kb-own] div')].filter(d=>d.children.length===0&&/END-OF-LAST-MESSAGE/.test(d.textContent||''))[0];return e?Math.round(e.getBoundingClientRect().bottom):null;}""")
                prob = []
                if not r or not r["ok"]: prob.append("the message box is behind the keyboard")
                if r and (last is None or last > r["top"] or last < 60): prob.append("the end of the last message isn't visible above the box")
                results.append(("FAIL" if prob else "PASS", "Keyboard: Executive AI chat", "; ".join(prob)))
                pg.evaluate(KB_HIDE); pg.wait_for_timeout(400)
            else:
                results.append(("FAIL", "Keyboard: Executive AI chat", "message box not found"))
        # Every page: the lowest text box on the page (the one most likely to be covered)
        hidden = []; checked = 0
        for pid, label in pages:
            if pid == "advisor" or not go(pg, pid, label, True): continue
            pg.wait_for_timeout(450)
            n = pg.evaluate(KB_MARK)
            if not n: continue
            sel = '[data-kbt="%d"]' % (n - 1)
            if not pg.evaluate(KB_SHOW, [sel, KB]): continue
            pg.wait_for_timeout(1100)
            r = pg.evaluate(KB_RECT, [sel, KB]); checked += 1
            if r and not r["ok"]: hidden.append(label)
            pg.evaluate(KB_HIDE); pg.wait_for_timeout(250)
        js = [e for e in errs if e.startswith("JS error")]
        results.append(("FAIL" if (hidden or js or not checked) else "PASS", "Keyboard: text boxes stay visible (%d pages)" % checked, ("hidden behind the keyboard on: " + ", ".join(hidden)) if hidden else (js[0] if js else ("" if checked else "no text boxes found"))))
        # 5. Switching page always opens the new page at the top (phone)
        tops = []
        SY = "()=>Math.round(window.scrollY||document.documentElement.scrollTop||document.body.scrollTop||0)"
        for pid, label in [pg_ for pg_ in pages if pg_[0] in ("wealth", "tasks", "bills", "habits", "debt", "calendar", "profile", "dashboard")]:
            pg.evaluate("()=>window.scrollTo(0,99999)"); pg.wait_for_timeout(120)
            if not go(pg, pid, label, True): continue
            pg.wait_for_timeout(350)
            if pg.evaluate(SY) > 2: tops.append(label)
        results.append(("FAIL" if tops else "PASS", "Pages open at the top when switching (phone)", ("opened part-way down: " + ", ".join(tops)) if tops else ""))
        ctx.close()
        browser.close()
    httpd.shutdown()

    # Report
    fails = [r for r in results if r[0] == "FAIL"]; warns = [r for r in results if r[0] == "WARN"]
    for st, name, detail in results:
        if st != "PASS": print("%-5s %s%s" % (st, name, ("  - " + detail) if detail else ""))
    print("\n%d checks: %d passed, %d warnings, %d failed  (%.0fs)" % (len(results), len(results) - len(fails) - len(warns), len(warns), len(fails), time.time() - t0))
    print("RESULT: " + ("FAIL" if fails else "PASS"))
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
