#!/usr/bin/env python3
"""Re-capture the welcome-tour screenshots (PRO_TOUR_V2) from the real app.

Run from the repo root on Claude's side (Linux, needs node_modules, Playwright, Pillow):
    python3 scripts/capture_tour.py

What it does:
 1. Copies the repo to a temp folder, makes the marketing demo (?demo=...) count as
    subscribed IN THAT COPY ONLY, and builds it. The real app is not changed.
 2. Opens the real pages with the marketing demo data (phone size, 7:12am Brisbane),
    with staged AI answers below, and screenshots: advisor, briefing, invest,
    cashflow, tax. Each picture records where its highlight box goes.
 3. Writes public/tour/<name>.webp and rewrites the TOUR_SHOTS line in src/App.jsx.
Check the pictures before pushing. Keep the staged AI figures in line with
src/marketingDemo.js if those figures change.
"""
import sys, os, json, re, datetime, shutil, subprocess, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import smoke_test as st
from playwright.sync_api import sync_playwright
from PIL import Image
out = os.path.join(ROOT, "public", "tour")
os.makedirs(out, exist_ok=True)
tmp = tempfile.mkdtemp(prefix="tourcap_")
files = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True).stdout.split()
for fn in files:
    os.makedirs(os.path.dirname(os.path.join(tmp, fn)) or tmp, exist_ok=True)
    if os.path.isfile(os.path.join(ROOT, fn)): shutil.copy2(os.path.join(ROOT, fn), os.path.join(tmp, fn))
shutil.copy2(os.path.join(ROOT, "src", "App.jsx"), os.path.join(tmp, "src", "App.jsx"))
os.symlink(os.path.join(ROOT, "node_modules"), os.path.join(tmp, "node_modules"))
appf = os.path.join(tmp, "src", "App.jsx"); a = open(appf, encoding="utf-8").read()
OLD = "const[subscription,setSubscription]=useState(null);"
assert a.count(OLD) == 1, "subscription state line not found"
open(appf, "w", encoding="utf-8").write(a.replace(OLD, 'const[subscription,setSubscription]=useState(_mkDemo?{status:"active"}:null);'))
subprocess.run(["npx", "vite", "build", "--logLevel", "error"], cwd=tmp, check=True)
httpd, url = st.serve(os.path.join(tmp, "dist"))
BRIEF = """MARKETS
S&P 500 6,712 (+0.38%). ASX 200 8,941 (-0.27%), banks firm, tech softer.

NEWS
Iron ore firmed overnight, lifting the big miners in early trade. Bond yields eased slightly as markets wait on next week's inflation data.

PRIORITIES
1. Send project status report
2. Book physio for left knee
3. Review offset and budget

MINDSET
Protect the first two hours - the report first, everything else after."""
ADVISOR = """You're at $212,400 - 41% of your $518,000 target, and it's moving in the right direction.

What's driving it:
- Shares ($39,360) and super ($61,200) are doing the heavy lifting.
- Crypto ($12,480) is a small slice - fine for a growth profile, just keep it there.
- Cash ($21,000) gives you a solid buffer, so there's room to invest more.

The fastest lever: your November surplus is +$3,463. Automate $1,500 of that into VAS each month and you add roughly $18,000 a year before growth.

Want me to map out the timeline to $518,000 at that rate?"""
def ai(route):
    body = route.request.post_data or ""
    txt = BRIEF if "Fast briefing" in body else ADVISOR
    return route.fulfill(status=200, content_type="application/json", body=json.dumps({"content":[{"type":"text","text":txt}]}))
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width":390,"height":844}, device_scale_factor=2, is_mobile=True, has_touch=True, timezone_id="Australia/Brisbane")
    def api(route):
        if "/api/claude" in route.request.url: return ai(route)
        return route.fulfill(status=200, content_type="application/json", body="{}")
    ctx.route("**/api/**", api)
    ctx.route("**/*supabase.co/**", lambda r: r.fulfill(status=200, content_type="application/json", body="[]"))
    pg = ctx.new_page()
    pg.clock.install(time=datetime.datetime(2026,11,6,7,12,tzinfo=datetime.timezone(datetime.timedelta(hours=10))))
    pg.goto(url+"?demo=studio-k7m2"); pg.wait_for_timeout(3500)
    from PIL import Image
    FIND = """([txt,minH])=>{let best=null;for(const el of document.querySelectorAll('body *')){const r=el.getBoundingClientRect();if(r.width&&el.innerText&&el.innerText.includes(txt)&&(!best||best.contains(el)))best=el;}
      let el=best;while(el&&el.getBoundingClientRect().height<minH)el=el.parentElement;const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}"""
    NAVTOP = "()=>{const els=[...document.querySelectorAll('nav,div')].filter(e=>{const r=e.getBoundingClientRect();const cs=getComputedStyle(e);return cs.position==='fixed'&&r.bottom>=window.innerHeight-2&&r.height<120&&r.width>=window.innerWidth-2;});return els.length?Math.min(...els.map(e=>e.getBoundingClientRect().top)):window.innerHeight;}"
    meta = {}
    def shot(name, txt, minH):
        bx = pg.evaluate(FIND, [txt, minH]); navtop = pg.evaluate(NAVTOP)
        vw = pg.viewport_size["width"]
        tmp = f"{out}/{name}.png"; pg.screenshot(path=tmp)
        im = Image.open(tmp); sc = im.width / vw
        im = im.crop((0, 0, im.width, int(navtop * sc)))
        im = im.resize((660, round(im.height * 660 / im.width)), Image.LANCZOS)
        im.save(f"{out}/{name}.webp", "WEBP", quality=72, method=6); os.remove(tmp)
        h = navtop
        pad = 6
        meta[name] = {"w": im.width, "h": im.height, "ring": [round((bx[0]-pad)/vw,4), round((bx[1]-pad)/h,4), round((bx[2]+2*pad)/vw,4), round((bx[3]+2*pad)/h,4)]}
    # Morning Briefing
    pg.get_by_text("Open Briefing").first.click(); pg.wait_for_timeout(2500); shot("briefing", "MINDSET", 400)
    pg.goto(url+"?demo=studio-k7m2"); pg.wait_for_timeout(3000)
    # Executive AI (taller window so the question and answer both fit)
    pg.set_viewport_size({"width": 390, "height": 1060})
    st.go(pg, "advisor", "Executive AI", True); pg.wait_for_timeout(1500)
    box = pg.get_by_placeholder("Ask anything...")
    box.fill("How is my net worth tracking?"); box.press("Enter"); pg.wait_for_timeout(3500)
    shot("advisor", "You're at $212,400", 300)
    pg.set_viewport_size({"width": 390, "height": 844})
    st.go(pg, "invest", "Invest", True); pg.wait_for_timeout(2000); shot("invest", "Healthcare exposure", 80)
    st.go(pg, "cashflow", "Cash Flow", True); pg.wait_for_timeout(1500); shot("cashflow", "Import Bank Statement (PDF)", 50)
    st.go(pg, "tax", "Tax", True); pg.wait_for_timeout(2000); shot("tax", "Est. Tax Payable", 280)
    order = ["advisor", "briefing", "invest", "cashflow", "tax"]
    line = "const TOUR_SHOTS=" + json.dumps({k: meta[k] for k in order}, separators=(",", ":")) + ";"
    src = open(os.path.join(ROOT, "src", "App.jsx"), encoding="utf-8").read()
    n = len(re.findall(r"^const TOUR_SHOTS=.*;$", src, flags=re.M))
    assert n == 1, "TOUR_SHOTS line not found in src/App.jsx"
    src = re.sub(r"^const TOUR_SHOTS=.*;$", lambda m: line, src, flags=re.M)
    open(os.path.join(ROOT, "src", "App.jsx"), "w", encoding="utf-8").write(src)
    print(line)
shutil.rmtree(tmp, ignore_errors=True)
print("Done - check public/tour/*.webp, then build and run the smoke test.")
