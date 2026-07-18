import{useState,useEffect,useRef,useCallback,Component}from"react";
import{Capacitor}from"@capacitor/core";
import{Purchases}from"@revenuecat/purchases-capacitor";

// RevenueCat public API key (iOS) - safe to expose client-side, same as
// the Supabase publishable key above. Get this from RevenueCat dashboard
// > Project Settings > API Keys.
const RC_API_KEY_IOS="appl_TqnMtYLrPgzKlbQFhCBfXByVjOf";
const RC_ENTITLEMENT_ID="pro";

// On the web, relative fetch("/api/...") calls correctly resolve against
// the-executive.vip since that's the page's own origin. On native iOS,
// the app loads from a local bundle under a custom scheme (no
// server.url configured in capacitor.config.json), so a relative path
// has no real server behind it and fails instantly, client-side, before
// ever reaching Vercel. Every API call needs this prefix so it resolves
// to the real domain on native while staying exactly as before on web.
const API_BASE=Capacitor.isNativePlatform()?"https://the-executive.vip":"";

const THEMES={
  obsidian:{BG:"#080808",CARD:"#111111",CARD2:"#181818",BORDER:"#1E1E1E",BORDER2:"#2A2A2A",TEXT:"#E4DDD0",MUTED:"#6A6050",MUTED2:"#3A3028",GOLD:"#C9A84C",GL:"#E8C96A",RED:"#C97E7E",GREEN:"#7A9E7E",BLUE:"#7EB8C9",PURPLE:"#B07EC9"},
  charcoal:{BG:"#141414",CARD:"#1E1E1E",CARD2:"#252525",BORDER:"#2E2E2E",BORDER2:"#383838",TEXT:"#E0E0E0",MUTED:"#666666",MUTED2:"#404040",GOLD:"#BFBFBF",GL:"#D8D8D8",RED:"#C07070",GREEN:"#70A870",BLUE:"#70A8C0",PURPLE:"#A070C0"},
  parchment:{BG:"#F5F0E8",CARD:"#FFFDF8",CARD2:"#F0EBE0",BORDER:"#E5DDD0",BORDER2:"#D5C8B8",TEXT:"#1A1208",MUTED:"#8A7A60",MUTED2:"#C5B8A0",GOLD:"#A07830",GL:"#C9A84C",RED:"#A05050",GREEN:"#507850",BLUE:"#507890",PURPLE:"#805090"},
  minimal:{BG:"#FFFFFF",CARD:"#F7F7F7",CARD2:"#EFEFEF",BORDER:"#E8E8E8",BORDER2:"#D8D8D8",TEXT:"#111111",MUTED:"#888888",MUTED2:"#C8C8C8",GOLD:"#222222",GL:"#555555",RED:"#C0392B",GREEN:"#2A7A2A",BLUE:"#1A5A9A",PURPLE:"#6A3A9A"}
};

const THEME_ALIASES={dark:"obsidian",light:"parchment"};
const BG_PHOTOS=[
  {id:"none",label:"None",url:null,thumb:null,anim:"kb-zoom"},
  {id:"bg1",label:"Dark Architecture",url:"/bg/bg1.jpg",thumb:"/bg/bg1-thumb.jpg",anim:"kb-zoom"},
  {id:"bg2",label:"Aerial Yacht",url:"/bg/bg2.jpg",thumb:"/bg/bg2-thumb.jpg",anim:"kb-drift"},
  {id:"bg3",label:"Lakeside Cottage",url:"/bg/bg3.jpg",thumb:"/bg/bg3-thumb.jpg",anim:"kb-pan"},
  {id:"bg4",label:"Infinity Pool",url:"/bg/bg4.jpg",thumb:"/bg/bg4-thumb.jpg",anim:"kb-breathe"},
  {id:"bg5",label:"Lake Como",url:"/bg/bg5.jpg",thumb:"/bg/bg5-thumb.jpg",anim:"kb-zoom"},
  {id:"bg6",label:"Castle Study",url:"/bg/bg6.jpg",thumb:"/bg/bg6-thumb.jpg",anim:"kb-drift"},
];
let _themeKey=(()=>{
  // Default to system preference on first load
  if(typeof window!=="undefined"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches){
    return "charcoal"; // closest dark-but-lighter theme for light mode users
  }
  return "obsidian";
})();
let _bgPhotoId="none";
const hasPhoto=()=>_bgPhotoId&&_bgPhotoId!=="none";
const T=()=>THEMES[_themeKey]||THEMES[THEME_ALIASES[_themeKey]]||THEMES.obsidian;
const LOCALES={
  "en-AU":{label:"Australia",flag:"AU",currency:"AUD",symbol:"$",taxPage:true,superLabel:"Superannuation"},
  "en-US":{label:"United States",flag:"US",currency:"USD",symbol:"$",taxPage:false,superLabel:"401k"},
  "en-GB":{label:"United Kingdom",flag:"UK",currency:"GBP",symbol:"\u00A3",taxPage:false,superLabel:"Pension"},
  "en-CA":{label:"Canada",flag:"CA",currency:"CAD",symbol:"$",taxPage:false,superLabel:"RRSP"},
  "en-NZ":{label:"New Zealand",flag:"NZ",currency:"NZD",symbol:"$",taxPage:false,superLabel:"KiwiSaver"},
  "en-SG":{label:"Singapore",flag:"SG",currency:"SGD",symbol:"$",taxPage:false,superLabel:"CPF"},
  "de-DE":{label:"Germany",flag:"DE",currency:"EUR",symbol:"\u20AC",taxPage:false,superLabel:"Pension"}
};
let _locale="en-AU";
const L=()=>LOCALES[_locale]||LOCALES["en-AU"];
// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL="https://vvnnzepagtrlvnqyqbdr.supabase.co";
const SUPABASE_KEY="sb_publishable_yh1Srs_fsONIuZQ7flIksg_f53KPcVn";
const sbH=(token)=>({"Content-Type":"application/json","apikey":SUPABASE_KEY,"Authorization":"Bearer "+(token||SUPABASE_KEY)});
const supabase={
  async signUp(email,password){const r=await fetch(SUPABASE_URL+"/auth/v1/signup",{method:"POST",headers:sbH(),body:JSON.stringify({email,password})});return r.json();},
  async signIn(email,password){const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:sbH(),body:JSON.stringify({email,password})});return r.json();},
  async refresh(refreshToken){const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:sbH(),body:JSON.stringify({refresh_token:refreshToken})});return r.json();},
  async signOut(token){await fetch(SUPABASE_URL+"/auth/v1/logout",{method:"POST",headers:sbH(token)});},
  async getUser(token){const r=await fetch(SUPABASE_URL+"/auth/v1/user",{headers:sbH(token)});return r.json();},
  async load(userId,token){const r=await fetch(SUPABASE_URL+"/rest/v1/user_data?user_id=eq."+userId+"&select=data",{headers:sbH(token)});const rows=await r.json();return rows&&rows[0]?rows[0].data:null;},
  async save(userId,token,data){const r=await fetch(SUPABASE_URL+"/rest/v1/user_data",{method:"POST",headers:{...sbH(token),"Prefer":"resolution=merge-duplicates"},body:JSON.stringify({user_id:userId,data,updated_at:new Date().toISOString()})});if(!r.ok){const err=await r.json().catch(()=>({}));throw new Error("Save failed: "+r.status+" "+JSON.stringify(err));}return r;},
};

// Module-level auth token — set by App when user logs in
let _activeToken = null;
const setActiveToken = t => { 
  _activeToken = t; 
  // Also cache in sessionStorage as fallback for module re-initialisation
  try{ if(t)sessionStorage.setItem("_et",t); else sessionStorage.removeItem("_et"); }catch{}
};

// Claude API helper — adds auth token for rate limiting and Pro verification
const claudeFetch = async (body, token) => {
  // Use explicit token, then module var, then sessionStorage fallback, then localStorage
  const tok = token || _activeToken || 
    (()=>{try{return sessionStorage.getItem("_et")||localStorage.getItem("exec_token");}catch{return null;}})();
  const headers = {"Content-Type": "application/json"};
  if (tok) headers["Authorization"] = "Bearer " + tok;
  return fetch(API_BASE+"/api/claude", {method: "POST", headers, body: JSON.stringify(body)});
};

// ── Stripe ────────────────────────────────────────────────────────────────────
// Replace these with your actual Stripe Price IDs from the Stripe Dashboard
const STRIPE_PRICES={
  monthly:"price_1Ti00YRwVRKTnmPjA6OetwUj",
  annual:"price_1Ti01CRwVRKTnmPjQlIcIfaV",
};
const FOUNDING_LIMIT=100;
const PRO_FEATURES=["advisor","invest","tax","learn","services"];
const isPro=sub=>sub&&["active","trialing"].includes(sub.status);
const isFeatureLocked=(page,sub)=>PRO_FEATURES.includes(page)&&!isPro(sub);

const hexA=(hex,alpha)=>{
  let h=hex.replace("#","");
  if(h.length===3)h=h.split("").map(c=>c+c).join("");
  return "#"+h+alpha;
};
const fmt=n=>{
  if(!n&&n!==0)return L().symbol+"0";
  const s=L().symbol,v=Math.abs(n);
  const f=v>=1e6?s+(v/1e6).toFixed(2)+"M":v>=1e4?s+(v/1e3).toFixed(1)+"k":s+v.toLocaleString("en-AU",{maximumFractionDigits:0});
  return n<0?"-"+f:f;
};
const todayStr=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
function advanceDate(ds,freq){
  const d=new Date(ds+"T12:00:00");
  if(freq==="weekly")d.setDate(d.getDate()+7);
  else if(freq==="fortnightly")d.setDate(d.getDate()+14);
  else if(freq==="monthly")d.setMonth(d.getMonth()+1);
  else if(freq==="quarterly")d.setMonth(d.getMonth()+3);
  else if(freq==="annually")d.setFullYear(d.getFullYear()+1);
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
// Roll an autopay bill's nextDue forward past today, advancing through multiple missed cycles if needed
function rollAutopayForward(b){
  if(!b.autopay||!b.nextDue)return b;
  let nextDue=b.nextDue;
  let paymentHistory=b.paymentHistory||[];
  let safety=0;
  while(new Date(nextDue+"T12:00:00")<new Date()&&safety<60){
    paymentHistory=[{date:nextDue,amount:parseFloat(b.amount),name:b.name},...paymentHistory].slice(0,24);
    nextDue=advanceDate(nextDue,b.frequency);
    safety++;
  }
  if(nextDue===b.nextDue)return b;
  return{...b,nextDue,lastPaid:todayStr(),paymentHistory};
}
const monthStr=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");};
const calcAge=dob=>{if(!dob)return null;const d=new Date(dob),now=new Date();let age=now.getFullYear()-d.getFullYear();if(now.getMonth()<d.getMonth()||(now.getMonth()===d.getMonth()&&now.getDate()<d.getDate()))age--;return age;};
const fmtDate=d=>{try{return new Date(d+"T12:00:00").toLocaleDateString(_locale,{day:"numeric",month:"short"});}catch{return d;}};
const fmtDateNum=d=>{if(!d)return d;const[y,m,day]=d.split("-");return y&&m&&day?day+"/"+m+"/"+y:d;};
// AU tax brackets, FY2026-27 (from 1 July 2026) - second bracket reduced to 15%.
// Legislated to reduce again to 14% from 1 July 2027 - revisit then.
const AU_TAX=[[18200,0,0],[45000,.15,0],[135000,.30,4020],[190000,.37,31020],[Infinity,.45,51370]];
const calcTax=inc=>{for(let i=AU_TAX.length-1;i>=0;i--)if(inc>AU_TAX[i][0])return AU_TAX[i][2]+AU_TAX[i][1]*(inc-AU_TAX[i][0]);return 0;};
const ASSET_COLORS={shares:"#C9A84C",property:"#7A9E7E",cash:"#7EB8C9",crypto:"#B07EC9",super:"#C97E7E",commodities:"#D9A66C",alternative:"#8C8C9E"};
const ASSET_LABELS={shares:"Equities",property:"Property",cash:"Cash",crypto:"Digital Assets",super:"Super/Pension",commodities:"Commodities",alternative:"Alternative Assets"};
const CAT_COLORS={financial:"#C9A84C",career:"#7EB8C9",health:"#7A9E7E",education:"#B07EC9",personal:"#C97E7E"};
const EXP_CATS={
  income:["Salary","Business Revenue","Investment Income","Rental Income","Side Income","Dividends","Government Payments","Other Income"],
  expense:[
    "Rent & Mortgage","Utilities","Phone & Internet","Internet","Groceries","Dining Out & Takeaway",
    "Transport","Fuel","Car Repayment","Insurance","Health & Medical","Gym & Fitness",
    "Clothing & Personal Care","Entertainment","Subscriptions","Education & Courses",
    "Home & Garden","Kids & Family","Pets","Travel & Holidays","Gifts & Donations",
    "Tax & Accounting","Investments & Savings","Other"
  ]
};
const NW_MILESTONES=[250000,500000,750000,1000000,1500000,2000000,2500000,3000000,5000000,10000000];
const MOODS=[{v:1,l:"Rough",c:"#C97E7E"},{v:2,l:"Low",c:"#D4956A"},{v:3,l:"OK",c:"#7A7060"},{v:4,l:"Good",c:"#7EB8C9"},{v:5,l:"Great",c:"#7A9E7E"}];
// Habit emojis defined in JSX render, not here
const EXERCISES=["Bench Press","Squat","Deadlift","Overhead Press","Pull-ups","Rows","Dips","Leg Press","Lat Pulldown","Bicep Curl","Romanian Deadlift"];
const WTYPES=["Strength","Hypertrophy","Cardio","HIIT","Mobility","Sport"];
const WCOLORS={Strength:"#C9A84C",Hypertrophy:"#B07EC9",Cardio:"#7A9E7E",HIIT:"#C97E7E",Mobility:"#7EB8C9",Sport:"#D4956A"};
const JP=["What is my number 1 priority today?","What am I grateful for?","What would make today a win?","What obstacle must I overcome?","What did I learn yesterday?"];
const NAV=[
  ["dashboard","🏠","Dashboard"],["tasks","📝","Tasks"],["habits","🔥","Habits"],
  ["goals","🎯","Goals"],["journal","📓","Journal"],["reading","📚","Reading"],
  ["wealth","💸","Wealth"],["cashflow","💰","Cash Flow"],
  ["bills","🔁","Bills"],
  ["budget","📊","Budget"],["debt","📉","Debt"],
  ["invest","💵","Invest"],["projector","📈","Forecast"],["dividends","💰","Dividends"],["tax","🧾","Tax"],["news","📰","News"],["health","💊","Health"],["body","💪","Body"],
  ["workout","🏋","Workout"],["recipes","🍽","Recipes"],["weekly","📊","Weekly"],["advisor","🤖","AI Advisor"],
  ["learn","🎓","Learn"],["notes","📋","Notes"],["services","👔","Services"],
  ["profile","👤","Profile"]
];
const POPULAR_COMMODITIES=[
  {ticker:"GC=F",name:"Gold",unit:"oz",symbol:"Au"},
  {ticker:"SI=F",name:"Silver",unit:"oz",symbol:"Ag"},
  {ticker:"PL=F",name:"Platinum",unit:"oz",symbol:"Pt"},
  {ticker:"PA=F",name:"Palladium",unit:"oz",symbol:"Pd"},
  {ticker:"CL=F",name:"Crude Oil (WTI)",unit:"bbl",symbol:"Oil"},
  {ticker:"NG=F",name:"Natural Gas",unit:"MMBtu",symbol:"Gas"},
  {ticker:"HG=F",name:"Copper",unit:"lb",symbol:"Cu"},
  {ticker:"ZW=F",name:"Wheat",unit:"bu",symbol:"Wht"},
  {ticker:"ZC=F",name:"Corn",unit:"bu",symbol:"Crn"},
  {ticker:"ZS=F",name:"Soybeans",unit:"bu",symbol:"Soy"},
];
const POPULAR_COINS=[
  {ticker:"BTC",name:"Bitcoin"},{ticker:"ETH",name:"Ethereum"},
  {ticker:"SOL",name:"Solana"},{ticker:"XRP",name:"XRP"},
  {ticker:"ADA",name:"Cardano"},{ticker:"DOGE",name:"Dogecoin"},
  {ticker:"DOT",name:"Polkadot"},{ticker:"LINK",name:"Chainlink"},
  {ticker:"AVAX",name:"Avalanche"},{ticker:"MATIC",name:"Polygon"},
  {ticker:"LTC",name:"Litecoin"},{ticker:"ATOM",name:"Cosmos"},
  {ticker:"UNI",name:"Uniswap"},{ticker:"BCH",name:"Bitcoin Cash"},
  {ticker:"NEAR",name:"NEAR Protocol"},{ticker:"APT",name:"Aptos"},
  {ticker:"ARB",name:"Arbitrum"},{ticker:"OP",name:"Optimism"},
  {ticker:"INJ",name:"Injective"},{ticker:"SUI",name:"Sui"}
];

// Price fetching removed - manual price updates used instead

const SK="exec_v1";
const loadData=()=>{try{const r=localStorage.getItem(SK);return r?JSON.parse(r):null;}catch{return null;}};
const saveData=d=>{try{localStorage.setItem(SK,JSON.stringify(d));}catch{}};
const applyDailyReset=(saved,today)=>{
  // lastSavedDate is always local date string YYYY-MM-DD
  // If it matches today, no reset needed — preserve all state including taken supplements
  if(saved.lastSavedDate&&saved.lastSavedDate===today)return saved;

  // Different day — apply daily reset
  const dayOfWeek=new Date(today+"T12:00:00").getDay();
  return{...saved,lastSavedDate:today,
    tasks:(saved.tasks||[]).map(t=>{
      if(!t.done)return t;
      if(t.recurring&&!t.recurDays)return{...t,done:false};
      if(t.recurring&&t.recurDays?.length){
        if(t.recurDays.includes(dayOfWeek))return{...t,done:false};
        return t;
      }
      return null;
    }).filter(Boolean),
    // Only reset supplements if it's genuinely a new day
    supplements:(saved.supplements||[]).map(s=>({...s,taken:false}))
  };
};
const todayTasks=(tasks)=>{
  const day=new Date().getDay();
  return (tasks||[]).filter(t=>{
    if(!t.recurring)return true; // one-off tasks always show
    if(!t.recurDays||!t.recurDays.length)return true; // daily recurring always show
    return t.recurDays.includes(day); // specific days — only show on matching day
  });
};
const DEMO={
  firstName:"William",lastName:"Sterling",dob:"1991-01-15",age:"34",location:"Brisbane, QLD",
  occupation:"Founder & Investor",locale:"en-AU",height:"182",weight:"88",
  targetWeight:"82",bodyFat:"18",sleepHours:"7.2",annualIncome:"320000",
  shareValue:"187400",propertyValue:"1250000",cashSavings:"85000",
  superBalance:"198000",cryptoValue:"42300",mortgageDebt:"680000",
  investLoanDebt:"120000",carDebt:"0",creditCardDebt:"4200",personalDebt:"0",
  netWorthTarget:"3000000",totalAssets:1763100,totalDebt:804200,netWorth:958900,
  healthGoals:["Build Muscle","Boost Testosterone","Improve HRV"],
  riskProfile:["Growth - accept volatility"]
};
const D_TASKS=[
  {id:1,text:"Review investment portfolio",done:false,priority:"high"},
  {id:2,text:"Cold exposure 30min",done:false,priority:"high"},
  {id:3,text:"Contact accountant",done:false,priority:"high"},
  {id:4,text:"Meditate 10 min",done:true,priority:"medium"},
  {id:5,text:"Read 20 pages",done:false,priority:"medium"},
  {id:6,text:"Evening walk",done:false,priority:"low"}
];
const D_GOALS=[
  {id:1,title:"Reach net worth target",period:"year",progress:32,category:"financial"},
  {id:2,title:"Launch new business unit",period:"year",progress:35,category:"career"},
  {id:3,title:"Read 24 books",period:"year",progress:54,category:"education"},
  {id:4,title:"Drop to target body fat",period:"month",progress:60,category:"health"},
  {id:5,title:"Close $500k revenue",period:"month",progress:72,category:"financial"},
  {id:6,title:"Complete 4 workouts",period:"week",progress:50,category:"health"}
];
const D_SUPPS=[
  {id:1,name:"Vitamin D3",dose:"5000 IU",time:"morning",taken:false},
  {id:2,name:"Creatine",dose:"5g",time:"morning",taken:false},
  {id:3,name:"Omega-3",dose:"2g",time:"morning",taken:false},
  {id:4,name:"Magnesium",dose:"400mg",time:"evening",taken:false},
  {id:5,name:"Zinc",dose:"25mg",time:"evening",taken:false}
];
const D_BOOKS=[
  {id:1,title:"Poor Charlie's Almanack",author:"Charles Munger",status:"reading",cur:312,tot:432},
  {id:2,title:"The 48 Laws of Power",author:"Robert Greene",status:"next",cur:0,tot:452}
];
const D_HABITS=[
  {id:1,name:"Morning Routine",icon:"Sun",color:"#C9A84C",target:7},
  {id:2,name:"Cold Exposure",icon:"Ice",color:"#7EB8C9",target:5},
  {id:3,name:"Strength Training",icon:"Lift",color:"#7A9E7E",target:4},
  {id:4,name:"Reading Daily",icon:"Book",color:"#B07EC9",target:7},
  {id:5,name:"Meditation",icon:"Zen",color:"#D4956A",target:7}
];

const DEFAULT_TICKERS=[
  {symbol:"^GSPC",label:"S&P 500",fx:false},
  {symbol:"^AXJO",label:"ASX 200",fx:false},
  {symbol:"AUDUSD=X",label:"AUD/USD",fx:true},
];

const CRYPTO_SYMBOLS=new Set(["BTC","ETH","SOL","DOGE","XRP","BTC-USD","ETH-USD","SOL-USD","DOGE-USD","XRP-USD","BTC-AUD","ETH-AUD","SOL-AUD","DOGE-AUD","XRP-AUD"]);
const isCryptoSymbol=sym=>CRYPTO_SYMBOLS.has((sym||"").toUpperCase())||(sym||"").toUpperCase().startsWith("BINANCE:");

// Four separate hooks (market ticker, stocks, crypto, commodities) all
// fetch quotes independently, and all mount together at app load - which
// means every page load fires 8-10+ /api/quote requests in the same
// instant. A single isolated request always works fine, but that burst
// can trip Finnhub's rate limiting even while staying under their
// per-minute average. This shared queue staggers every quote request
// app-wide by ~180ms so they go out as a fast trickle instead of a
// simultaneous burst, without slowing down any individual page.
let __quoteQueueTail=Promise.resolve();
function quoteFetch(url){
  const result=__quoteQueueTail.then(()=>fetch(API_BASE+url));
  __quoteQueueTail=result.then(()=>new Promise(res=>setTimeout(res,180)),()=>new Promise(res=>setTimeout(res,180)));
  return result;
}

function useMarket(tickers){
  const safeT=tickers&&tickers.length?tickers:DEFAULT_TICKERS;
  const[prices,setPrices]=useState({});
  const[loading,setLoading]=useState(true);
  const[lastUpdated,setLastUpdated]=useState(null);
  const[fxRate,setFxRate]=useState(1);

  const fetchAll=useCallback(async()=>{
    setLoading(true);
    const results={};
    const hasCrypto=safeT.some(tk=>isCryptoSymbol(tk.symbol));
    const userCurrency=L().currency;
    const needsFx=hasCrypto&&userCurrency!=="USD";

    const fxPromise=needsFx?quoteFetch("/api/quote?symbol="+encodeURIComponent(userCurrency==="AUD"?"AUDUSD=X":userCurrency+"USD=X")).then(r=>r.json()).catch(()=>null):Promise.resolve(null);

    const[fxData]=await Promise.all([
      fxPromise,
      Promise.all(safeT.filter(tk=>tk.symbol&&tk.symbol.trim()).map(async tk=>{
        try{
          const r=await quoteFetch("/api/quote?symbol="+encodeURIComponent(tk.symbol));
          const d=await r.json();
          results[tk.symbol]={price:d.price,pct:d.pct||0,change:d.change||0,loading:false,error:false,isCrypto:isCryptoSymbol(tk.symbol)};
        }catch{
          results[tk.symbol]={price:null,pct:0,loading:false,error:true,isCrypto:isCryptoSymbol(tk.symbol)};
        }
      }))
    ]);

    let rate=1;
    if(needsFx&&fxData?.price){
      // AUDUSD=X gives USD per 1 AUD, so to convert USD->AUD we divide by that rate
      rate=1/fxData.price;
    }
    setFxRate(rate);
    setPrices(results);
    setLastUpdated(new Date());
    setLoading(false);
  },[safeT.map(t=>t.symbol).join(",")]);

  useEffect(()=>{fetchAll();const id=setInterval(fetchAll,60000);return()=>clearInterval(id);},[fetchAll]);

  return{prices,loading,lastUpdated,refresh:fetchAll,fxRate};
}

function useCommodities(holdings){
  const[prices,setPrices]=useState({});
  const[loading,setLoading]=useState(false);
  const[lastUpdated,setLastUpdated]=useState(null);
  const safeH=holdings||[];

  const fetchPrices=useCallback(async()=>{
    if(!safeH.length)return;
    setLoading(true);
    const results={};
    await Promise.all(safeH.map(async h=>{
      try{
        const r=await quoteFetch("/api/quote?symbol="+encodeURIComponent(h.ticker));
        const d=await r.json();
        if(d.price)results[h.ticker]={price:d.price,change:d.change||0,pct:d.pct||0};
      }catch{}
    }));
    setPrices(results);setLastUpdated(new Date());setLoading(false);
  },[safeH.map(h=>h.ticker).join(",")]);

  useEffect(()=>{fetchPrices();const id=setInterval(fetchPrices,120000);return()=>clearInterval(id);},[fetchPrices]);

  const totalValue=safeH.reduce((s,h)=>{
    const lp=prices[h.ticker]?.price;
    const val=lp?lp*h.qty:h.avgCost?h.avgCost*h.qty:0;
    return s+(isNaN(val)?0:val);
  },0);
  const totalCost=safeH.reduce((s,h)=>s+(h.avgCost?parseFloat(h.avgCost)*h.qty:0),0);
  return{prices,loading,lastUpdated,totalValue,totalCost,
    totalGain:totalValue-totalCost,
    totalGainPct:totalCost>0?(totalValue-totalCost)/totalCost*100:0,
    refresh:fetchPrices};
}

function usePortfolio(holdings){
  const[prices,setPrices]=useState({});
  const[loading,setLoading]=useState(false);
  const[lastUpdated,setLastUpdated]=useState(null);
  const safeH=holdings||[];

  const fetchPrices=useCallback(async()=>{
    if(!safeH.length)return;
    setLoading(true);
    const results={};
    await Promise.all(safeH.map(async h=>{
      try{
        const r=await quoteFetch("/api/quote?symbol="+encodeURIComponent(h.ticker));
        const d=await r.json();
        if(d.price)results[h.ticker]={price:d.price,change:d.change||0,pct:d.pct||0};
      }catch{}
    }));
    setPrices(results);
    setLastUpdated(new Date());
    setLoading(false);
  },[safeH.map(h=>h.ticker).join(",")]);

  useEffect(()=>{
    fetchPrices();
    const id=setInterval(fetchPrices,60000);
    return()=>clearInterval(id);
  },[fetchPrices]);

  const totalValue=safeH.reduce((s,h)=>{
    const lp=prices[h.ticker]?.price;
    const val=lp?lp*h.shares:h.avgCost?parseFloat(h.avgCost)*h.shares:0;
    return s+(isNaN(val)?0:val);
  },0);
  const totalCost=safeH.reduce((s,h)=>s+(h.avgCost?parseFloat(h.avgCost)*h.shares:0),0);
  const dayChange=safeH.reduce((s,h)=>{
    const ch=prices[h.ticker]?.change||0;
    return s+ch*(h.shares||0);
  },0);

  return{prices,loading,lastUpdated,totalValue,totalCost,
    totalGain:totalValue-totalCost,
    totalGainPct:totalCost>0?(totalValue-totalCost)/totalCost*100:0,
    dayChange,refresh:fetchPrices};
}

function useCrypto(holdings){
  const[prices,setPrices]=useState({});
  const[loading,setLoading]=useState(false);
  const[lastUpdated,setLastUpdated]=useState(null);
  const safeH=holdings||[];

  const fetchPrices=useCallback(async()=>{
    if(!safeH.length)return;
    setLoading(true);
    const results={};
    await Promise.all(safeH.map(async h=>{
      try{
        const sym=h.symbol.includes("-")?h.symbol:h.symbol+"-USD";
        const r=await quoteFetch("/api/quote?symbol="+encodeURIComponent(sym));
        const d=await r.json();
        if(d.price)results[h.symbol]={price:d.price,change:d.change||0,pct:d.pct||0};
      }catch{}
    }));
    setPrices(results);
    setLastUpdated(new Date());
    setLoading(false);
  },[safeH.map(h=>h.symbol).join(",")]);

  useEffect(()=>{
    fetchPrices();
    const id=setInterval(fetchPrices,60000);
    return()=>clearInterval(id);
  },[fetchPrices]);

  const totalValue=safeH.reduce((s,h)=>{
    const lp=prices[h.symbol]?.price;
    return s+(lp?lp*h.amount:h.avgCost?h.avgCost*h.amount:0);
  },0);
  const totalCost=safeH.reduce((s,h)=>s+(h.avgCost?h.avgCost*h.amount:0),0);

  return{prices,loading,lastUpdated,totalValue,totalCost,
    totalGain:totalValue-totalCost,
    totalGainPct:totalCost>0?(totalValue-totalCost)/totalCost*100:0,
    dayChange:0,refresh:fetchPrices};
}

class ErrorBoundary extends Component{
  constructor(p){super(p);this.state={error:null,info:null,errorId:null};}
  static getDerivedStateFromError(e){return{error:e};}
  componentDidCatch(e,info){
    const errorId="err_"+Date.now().toString(36);
    this.setState({info,errorId});
    // Log to console in detail for Vercel log capture
    console.error("[The Executive] Uncaught error:",{
      errorId,
      message:e?.message,
      stack:e?.stack,
      component:info?.componentStack?.split("\n")[1]?.trim(),
      url:window.location.href,
      time:new Date().toISOString()
    });
    // Send to Vercel via a simple beacon (no external service needed)
    try{
      fetch(API_BASE+"/api/log-error",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({errorId,message:e?.message,component:info?.componentStack?.split("\n")[1]?.trim(),url:window.location.href})
      }).catch(()=>{});
    }catch{}
  }
  render(){
    if(this.state.error){
      const t=THEMES.obsidian;
      const isChunkError=this.state.error?.message?.includes("Failed to fetch dynamically imported module")||this.state.error?.message?.includes("Loading chunk");
      return(
        <div style={{minHeight:"100vh",background:t.BG,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:20,padding:40,textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:4}}>{isChunkError?"⟳":"⚠"}</div>
          <div style={{fontSize:10,letterSpacing:4,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif"}}>The Executive</div>
          <div style={{fontSize:22,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:300}}>
            {isChunkError?"Update available":"Something went wrong"}
          </div>
          <div style={{fontSize:13,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",maxWidth:380,lineHeight:1.8}}>
            {isChunkError
              ?"A new version of the app was deployed. Reload to get the latest version."
              :"An unexpected error occurred. Your data is safe — this is a display issue only."}
          </div>
          {this.state.errorId&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",letterSpacing:1}}>Error ID: {this.state.errorId}</div>}
          <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center",marginTop:8}}>
            <button onClick={()=>window.location.reload()} style={{background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:8,padding:"11px 24px",color:"#080808",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,letterSpacing:1}}>
              {isChunkError?"Reload App":"Try Again"}
            </button>
            {!isChunkError&&<button onClick={()=>this.setState({error:null,info:null})} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:8,padding:"11px 24px",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12}}>
              Go Back
            </button>}
          </div>
          {!isChunkError&&<div style={{marginTop:8,fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
            If this keeps happening, <span style={{color:t.GOLD,cursor:"pointer",textDecoration:"underline"}} onClick={()=>{localStorage.removeItem(SK);window.location.reload();}}>reset the app</span> or contact support.
          </div>}
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Background Photo Layer ────────────────────────────────────────────────────
const BG_PHOTO_CSS=`
@keyframes kb-zoom    {0%{transform:translate(-50%,-50%) scale(1)}100%{transform:translate(-50%,-50%) scale(1.04)}}
@keyframes kb-drift   {0%{transform:translate(-50%,-50%) scale(1.02) translate(0px,0px)}100%{transform:translate(-50%,-50%) scale(1.02) translate(-16px,-8px)}}
@keyframes kb-pan     {0%{transform:translate(-50%,-50%) scale(1.03) translateX(-16px)}100%{transform:translate(-50%,-50%) scale(1.03) translateX(16px)}}
@keyframes kb-breathe {0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.03)}}
.kb-zoom    {animation:kb-zoom    35s ease-in-out infinite alternate}
.kb-drift   {animation:kb-drift   40s ease-in-out infinite alternate}
.kb-pan     {animation:kb-pan     45s ease-in-out infinite alternate}
.kb-breathe {animation:kb-breathe 30s ease-in-out infinite}
`;
function BgPhotoLayer({photoId}){
  if(!photoId||photoId==="none")return null;
  const photo=BG_PHOTOS.find(p=>p.id===photoId);
  if(!photo||!photo.url)return null;
  return(
    <>
      <style>{BG_PHOTO_CSS}</style>
      <div style={{position:"fixed",inset:0,zIndex:0,overflow:"hidden",pointerEvents:"none"}}>
        <img src={photo.url} alt="" className={photo.anim} style={{position:"absolute",top:"50%",left:"50%",minWidth:"100%",minHeight:"100%",width:"auto",height:"auto",objectFit:"cover",willChange:"transform",contain:"strict"}}/>
        {/* Glass-dark overlay — medium glass + dark setting as chosen */}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(160deg,rgba(8,5,3,0.72) 0%,rgba(8,5,3,0.58) 50%,rgba(8,5,3,0.72) 100%)"}}/>
      </div>
    </>
  );
}

function PB({value,color,height=4}){
  const t=T();
  return (
    <div style={{background:t.BORDER2,borderRadius:99,height,overflow:"hidden"}}>
      <div style={{width:Math.min(value||0,100)+"%",height:"100%",background:color||t.GOLD,borderRadius:99,transition:"width .5s"}}/>
    </div>
  );
}
function Card({children,style,onClick}){
  const t=T();
  const glass=hasPhoto();
  const base=glass?{
    background:"rgba(6,5,4,0.65)",
    border:"1px solid rgba(255,255,255,0.1)",
    boxShadow:"0 2px 12px rgba(0,0,0,0.4)",
  }:{
    background:t.CARD,
    border:"1px solid "+t.BORDER,
  };
  return <div onClick={onClick} style={{...base,borderRadius:10,padding:16,...style,cursor:onClick?"pointer":"default"}}>{children}</div>;
}
function Divider(){
  const t=T();
  return <div style={{height:1,background:t.BORDER,margin:"6px 0"}}/>;
}
function SectionLabel({children,action}){
  const t=T();
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div style={{fontSize:9,letterSpacing:2,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif"}}>{children}</div>
      {action}
    </div>
  );
}
function StatCard({label,value,color,sub}){
  const t=T();
  return (
    <Card style={{textAlign:"center",padding:"14px 10px"}}>
      <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",letterSpacing:1,marginBottom:5}}>{label}</div>
      <div style={{fontSize:18,color:color||t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{value}</div>
      {sub&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:3}}>{sub}</div>}
    </Card>
  );
}
function Tag({children,color}){
  const t=T();const c=color||t.GOLD;
  return <div style={{display:"inline-block",background:c+"22",border:"1px solid "+c+"44",borderRadius:4,padding:"2px 6px",fontSize:10,color:c,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{children}</div>;
}
function UpgradeHint({message,hint,onUpgrade}){
  const t=T();
  if(!onUpgrade)return null;
  const text=hint||message||"✦ Unlock AI features with The Executive";
  return(
    <div onClick={onUpgrade} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:t.GOLD+"0A",border:"1px dashed "+t.GOLD+"44",borderRadius:9,padding:"10px 14px",cursor:"pointer",marginTop:16}}>
      <div><div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",letterSpacing:1,textTransform:"uppercase",marginBottom:2}}>✦ Executive Feature</div><div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{text}</div></div>
      <div style={{fontSize:10,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:600,flexShrink:0,marginLeft:10}}>Upgrade →</div>
    </div>
  );
}
function Skeleton({width="100%",height=14,style={}}){
  const t=T();
  return(
    <>
      <style>{`@keyframes sk{0%,100%{opacity:.35}50%{opacity:.7}}`}</style>
      <div style={{background:t.BORDER,borderRadius:4,width,height,animation:"sk 1.6s ease-in-out infinite",...style}}/>
    </>
  );
}
function Inp({value,onChange,placeholder,type,style}){
  const t=T();
  return <input type={type||"text"} value={value||""} onChange={onChange} placeholder={placeholder||""} spellCheck={!type||type==="text"} style={{background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:7,padding:"9px 12px",color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box",...style}}/>;
}
function Sel({value,onChange,children,style}){
  const t=T();
  return <select value={value} onChange={onChange} style={{background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:7,padding:"9px 11px",color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontSize:12,outline:"none",width:"100%",boxSizing:"border-box",...style}}>{children}</select>;
}
function Btn({onClick,children,style,disabled,variant}){
  const t=T();
  if(variant==="ghost")return <button onClick={onClick} disabled={!!disabled} style={{background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:7,padding:"9px 16px",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12,...style}}>{children}</button>;
  return <button onClick={onClick} disabled={!!disabled} style={{background:disabled?t.BORDER2:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:7,padding:"9px 16px",color:disabled?t.MUTED:"#080808",cursor:disabled?"default":"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,...style}}>{children}</button>;
}
function SparkLine({data,color,height=48,labels,target}){
  const[hover,setHover]=useState(null);
  const t=T();
  if(!data||data.length<2)return null;
  const W=300,H=height,p=3;
  const mn=Math.min(...data)*.97,mx=Math.max(...data)*1.03,rng=mx-mn||1;
  const px=i=>p+(i/(data.length-1))*(W-p*2);
  const py=v=>H-p-((v-mn)/rng)*(H-p*2);
  const pts=data.map((v,i)=>px(i)+","+py(v)).join(" ");
  const polyPts=pts+" "+px(data.length-1)+","+H+" "+px(0)+","+H;
  const handleMove=e=>{
    if(!labels)return;
    const rect=e.currentTarget.getBoundingClientRect();
    const x=(e.clientX-rect.left)/rect.width;
    const idx=Math.min(Math.round(x*(data.length-1)),data.length-1);
    setHover({idx,x:px(idx),y:py(data[idx]),val:data[idx],label:labels[idx]});
  };
  const tipLeft=Math.min(Math.max(hover?(hover.x/W*100):50,12),80);
  return (
    <div style={{position:"relative"}}>
      {hover&&labels&&(
        <div style={{position:"absolute",left:tipLeft+"%",top:0,transform:"translateX(-50%)",background:t.CARD,border:"1px solid "+color+"66",borderRadius:6,padding:"4px 8px",pointerEvents:"none",zIndex:10,whiteSpace:"nowrap"}}>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{hover.label}</div>
          <div style={{fontSize:13,color:color,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{fmt(hover.val)}</div>
        </div>
      )}
      <svg viewBox={"0 0 "+W+" "+H} style={{width:"100%",height:H,cursor:labels?"crosshair":"default"}} onMouseMove={handleMove} onMouseLeave={()=>setHover(null)}>
        <defs>
          <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity=".2"/>
            <stop offset="100%" stopColor={color} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <polygon points={polyPts} fill="url(#sg)"/>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
        {target&&target>=mn&&target<=mx&&(
          <>
            <line x1={p} y1={py(target)} x2={W-p} y2={py(target)} stroke={color} strokeWidth="1" strokeDasharray="3,2" opacity=".5"/>
            <text x={W-p-2} y={py(target)-3} fill={color} fontSize="7" textAnchor="end" fontFamily="sans-serif" opacity=".7">{"target"}</text>
          </>
        )}
        {hover&&labels&&(
          <>
            <line x1={hover.x} y1={p} x2={hover.x} y2={H-p} stroke={color} strokeWidth="1" strokeDasharray="3,2" opacity=".6"/>
            <circle cx={hover.x} cy={hover.y} r="4" fill={color} stroke={t.CARD} strokeWidth="1.5"/>
          </>
        )}
        {!hover&&<circle cx={px(data.length-1)} cy={py(data[data.length-1])} r="3" fill={color}/>}
      </svg>
    </div>
  );
}
function Modal({children,onClose,title}){
  const t=T();
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:t.CARD,border:"1px solid "+t.GOLD+"44",borderRadius:14,maxWidth:520,width:"100%",maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid "+t.BORDER}}>
          <div style={{fontSize:14,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{title}</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:16}}>X</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:20}}>{children}</div>
      </div>
    </div>
  );
}
function MilestoneCelebration({milestone,onClose}){
  const t=T();
  useEffect(()=>{const id=setTimeout(onClose,5000);return()=>clearTimeout(id);},[]);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.92)",zIndex:1001,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",textAlign:"center",padding:32}}>
      <div style={{fontSize:56,marginBottom:12}}>*</div>
      <div style={{fontSize:11,letterSpacing:4,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",marginBottom:8}}>MILESTONE REACHED</div>
      <div style={{fontSize:40,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:700,marginBottom:8}}>{fmt(milestone)}</div>
      <div style={{fontSize:16,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",marginBottom:28}}>Net Worth Milestone Unlocked</div>
      <Btn onClick={onClose}>Keep Building</Btn>
    </div>
  );
}
function RecalibrateModal({profile,onSave,onClose}){
  const[form,setForm]=useState({
    annualIncome:profile.annualIncome||"",shareValue:profile.shareValue||"",propertyValue:profile.propertyValue||"",
    cashSavings:profile.cashSavings||"",superBalance:profile.superBalance||"",cryptoValue:profile.cryptoValue||"",
    mortgageDebt:profile.mortgageDebt||"",investLoanDebt:profile.investLoanDebt||"",carDebt:profile.carDebt||"",
    creditCardDebt:profile.creditCardDebt||"",personalDebt:profile.personalDebt||"",netWorthTarget:profile.netWorthTarget||""
  });
  const save=()=>{
    const tA=["shareValue","propertyValue","cashSavings","superBalance","cryptoValue"].reduce((s,k)=>s+(parseFloat(form[k])||0),0);
    const tD=["mortgageDebt","investLoanDebt","carDebt","creditCardDebt","personalDebt"].reduce((s,k)=>s+(parseFloat(form[k])||0),0);
    onSave({...profile,...form,totalAssets:tA,totalDebt:tD,netWorth:tA-tD});
  };
  const fields=[
    ["annualIncome","Annual Income"],["shareValue","Shares"],["propertyValue","Property"],
    ["cashSavings","Cash"],["superBalance","Super"],["cryptoValue","Crypto"],
    ["mortgageDebt","Mortgage"],["investLoanDebt","Invest Loan"],["carDebt","Car"],
    ["creditCardDebt","Credit Cards"],["personalDebt","Personal Loans"],["netWorthTarget","NW Target"]
  ];
  return (
    <Modal title="Recalibrate Finances" onClose={onClose}>
      <div style={{display:"flex",flexDirection:"column",gap:9}}>
        {fields.map(([k,l])=>(
          <div key={k} style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{fontSize:11,color:T().MUTED,fontFamily:"'Montserrat',sans-serif",minWidth:100,flexShrink:0}}>{l}</div>
            <Inp type="number" value={form[k]} onChange={e=>setForm(x=>({...x,[k]:e.target.value}))} style={{padding:"7px 10px",fontSize:12}}/>
          </div>
        ))}
      </div>
      <div style={{marginTop:14,display:"flex",gap:8}}>
        <Btn onClick={save}>Save</Btn>
        <Btn onClick={onClose} variant="ghost">Cancel</Btn>
      </div>
    </Modal>
  );
}
function MorningBriefing({profile,tasks,onClose}){
  const[brief,setBrief]=useState("");const[loading,setLoading]=useState(true);const t=T();
  useEffect(()=>{
    (async()=>{
      try{
        const highTasks=todayTasks(tasks).filter(tk=>tk.priority==="high"&&!tk.done).map(tk=>tk.text).join(", ")||"none set";
        const dateLabel=new Date().toLocaleDateString(_locale,{weekday:"long",day:"numeric",month:"long",year:"numeric"});
        const controller=new AbortController();
        const timeoutId=setTimeout(()=>controller.abort(),9000);
        const r=await claudeFetch({model:"claude-sonnet-4-6",max_tokens:550,tools:[{type:"web_search_20250305",name:"web_search"}],system:"Today's date is "+dateLabel+". Fast briefing for "+profile.firstName+", "+(profile.occupation||"investor")+". One search only: S&P 500 and ASX 200 current levels and % move today, plus the single most important financial news story from the last 24h. Sections: MARKETS (brief, just the numbers), NEWS (1 story, 2 sentences max), PRIORITIES (top 3 from tasks below, do not invent any), MINDSET (one sentence). Be extremely concise — this must be fast. Plain text, caps headers.",messages:[{role:"user",content:"Briefing for "+dateLabel+". My current undone high-priority tasks: "+highTasks}]});
        clearTimeout(timeoutId);
        const d=await r.json();
        if(!r.ok){setBrief("Briefing failed: "+(d.error?.message||d.error||"Server error "+r.status));setLoading(false);return;}
        setBrief((d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n")||"Unable to generate.");
      }catch(e){
        if(e?.name==="AbortError")setBrief("The briefing took too long to generate (search can be slow). Try again — it sometimes needs a second attempt.");
        else setBrief("Connection error: "+(e?.message||"unknown"));
      }
      setLoading(false);
    })();
  },[]);
  return (
    <Modal title={(new Date().getHours()<12?"Morning":new Date().getHours()<17?"Afternoon":"Evening")+" Briefing"} onClose={onClose}>
      <div style={{fontSize:13,color:t.TEXT,lineHeight:1.85,fontFamily:"'Montserrat',sans-serif",whiteSpace:"pre-wrap"}}>
        {loading?(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <Skeleton width="80%" height={13}/>
            <Skeleton width="65%" height={13}/>
            <Skeleton width="90%" height={13}/>
            <Skeleton width="70%" height={13}/>
            <div style={{textAlign:"center",marginTop:8,fontSize:11,color:t.MUTED}}>Scanning markets & news...</div>
          </div>
        ):brief}
      </div>
    </Modal>
  );
}

function useIsMobile(){
  // Inside the native iOS/Android app it's always a phone screen - no need
  // to guess from window.innerWidth, which can read a stale/incorrect
  // value on cold launch before the WKWebView finishes its initial layout,
  // with no later resize event to correct it.
  const[mobile,setMobile]=useState(Capacitor.isNativePlatform()||window.innerWidth<768);
  useEffect(()=>{
    if(Capacitor.isNativePlatform())return;
    const h=()=>setMobile(window.innerWidth<768);
    window.addEventListener('resize',h);
    return()=>window.removeEventListener('resize',h);
  },[]);
  return mobile;
}

function Sidebar({page,setPage,profile,theme,setTheme,collapsed,setCollapsed,savedLabel,authUser,setShowAuth}){
  const t=T();
  const isMobile=useIsMobile();
  const[menuOpen,setMenuOpen]=useState(false);
  const initials=(profile.firstName?.[0]||"")+(profile.lastName?.[0]||"");

  // Bottom tab bar items - most used pages
  const BOTTOM_TABS=[
    ["dashboard","🏠","Home"],
    ["tasks","📝","Tasks"],
    ["habits","🔥","Habits"],
    ["wealth","💸","Wealth"],
    ["advisor","🤖","AI"],
  ];

  const groups=[
    ["Command",["dashboard","weekly","advisor","learn","notes","services"]],
    ["Execute",["tasks","habits","goals","journal","reading"]],
    ["Wealth",["wealth","cashflow","bills","budget","debt","invest","projector","dividends","tax","news"]],
    ["Health",["health","body","workout","recipes"]],
    ["Settings",["profile"]]
  ];

  if(isMobile){
    return (
      <div style={{width:0,flexShrink:0}}>
      <>
        {/* Mobile full-screen menu overlay */}
        {menuOpen&&(
          <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",flexDirection:"column"}}>
            {/* Tap outside to close - invisible backdrop */}
            <div onClick={()=>setMenuOpen(false)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,.5)"}}/>
            <div style={{position:"relative",zIndex:1,background:t.BG,display:"flex",flexDirection:"column",height:"100%",overflowY:"auto"}}>
            <div style={{padding:"16px 20px",paddingTop:"calc(16px + env(safe-area-inset-top))",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid "+t.BORDER}}>
              <div style={{fontSize:9,letterSpacing:4,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif"}}>The Executive</div>
              <button onClick={()=>setMenuOpen(false)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:22,lineHeight:1}}>X</button>
            </div>
            <div style={{flex:1,padding:"8px 0"}}>
              {groups.map(([group,pages])=>(
                <div key={group} style={{marginBottom:4}}>
                  <div style={{fontSize:8,letterSpacing:2,color:t.MUTED,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",padding:"8px 20px 4px"}}>{group}</div>
                  {pages.map(id=>{
                    const nav=NAV.find(n=>n[0]===id);
                    if(!nav)return null;
                    const active=page===id;
                    return (
                      <button key={id} onClick={()=>{setPage(id);setMenuOpen(false);}} style={{display:"flex",alignItems:"center",gap:14,width:"100%",padding:"12px 20px",background:active?t.GOLD+"18":"none",border:"none",borderLeft:active?"3px solid "+t.GOLD:"3px solid transparent",color:active?t.GOLD:t.TEXT,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:14,textAlign:"left"}}>
                        <span style={{fontSize:18,lineHeight:1}}>{nav[1]}</span>
                        <span>{nav[2]}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{borderTop:"1px solid "+t.BORDER,padding:"14px 20px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:t.GOLD+"33",border:"1px solid "+t.GOLD+"55",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:t.GOLD,fontWeight:700,flexShrink:0}}>{initials||"W"}</div>
                <div>
                  <div style={{fontSize:13,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{profile.firstName} {profile.lastName}</div>
                  <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{profile.occupation||"The Executive"}</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:5}}>
                {[{id:"obsidian",l:"Obsidian"},{id:"charcoal",l:"Charcoal"}].map(th=>(
                  <button key={th.id} onClick={()=>setTheme(th.id)} style={{padding:"6px 4px",borderRadius:7,border:"1px solid "+(theme===th.id?t.GOLD:t.BORDER),background:theme===th.id?t.GOLD+"18":"transparent",color:theme===th.id?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>
                    {th.l}
                  </button>
                ))}
              </div>
            </div>
            </div>
          </div>
        )}

        {/* Bottom tab bar */}
        <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:t.CARD,borderTop:"1px solid "+t.BORDER,display:"flex",alignItems:"stretch",paddingBottom:"calc(env(safe-area-inset-bottom) + 4px)"}}>
          {BOTTOM_TABS.map(([id,icon,label])=>{
            const active=page===id;
            return (
              <button key={id} onClick={()=>setPage(id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"8px 4px",background:"none",border:"none",borderTop:active?"2px solid "+t.GOLD:"2px solid transparent",color:active?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif"}}>
                <span style={{fontSize:20,lineHeight:1}}>{icon}</span>
                <span style={{fontSize:9,letterSpacing:.3}}>{label}</span>
              </button>
            );
          })}
          {/* Sign in or user indicator */}
          {authUser?(
            <button onClick={()=>setPage("profile")} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"8px 4px",background:"none",border:"none",borderTop:"2px solid transparent",cursor:"pointer"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:t.GREEN}}/>
              <span style={{fontSize:9,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",letterSpacing:.3}}>{authUser.email?.split("@")[0]?.slice(0,8)}</span>
            </button>
          ):(
            <button onClick={()=>setShowAuth(true)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"8px 4px",background:"none",border:"none",borderTop:"2px solid "+t.GOLD+"66",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif"}}>
              <span style={{fontSize:16,lineHeight:1}}>👤</span>
              <span style={{fontSize:9,letterSpacing:.3}}>Sign In</span>
            </button>
          )}
          {/* Theme toggle */}
          <button onClick={()=>{const order=["obsidian","charcoal"];const next=order[(order.indexOf(theme)+1)%order.length];setTheme(next);}} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"8px 4px",background:"none",border:"none",borderTop:"2px solid transparent",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif"}}>
            <span style={{fontSize:16,lineHeight:1}}>{theme==="obsidian"||theme==="charcoal"?"Sun":"Moon"}</span>
            <span style={{fontSize:9,letterSpacing:.3}}>Theme</span>
          </button>
          {/* More button */}
          <button onClick={()=>setMenuOpen(true)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"8px 4px",background:"none",border:"none",borderTop:"2px solid transparent",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif"}}>
            <span style={{fontSize:20,lineHeight:1}}>☰</span>
            <span style={{fontSize:9,letterSpacing:.3}}>More</span>
          </button>
        </div>
      </>
      </div>
    );
  }

  // Desktop sidebar (unchanged)
  return (
    <div style={{width:collapsed?54:200,flexShrink:0,background:t.CARD,borderRight:"1px solid "+t.BORDER,display:"flex",flexDirection:"column",height:"100vh",position:"sticky",top:0,transition:"width .2s",overflow:"hidden"}}>
      <div style={{padding:collapsed?"12px 8px":"14px 14px",borderBottom:"1px solid "+t.BORDER,display:"flex",alignItems:"center",justifyContent:collapsed?"center":"space-between"}}>
        {!collapsed&&<div style={{fontSize:9,letterSpacing:4,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif"}}>The Executive</div>}
        <button onClick={()=>setCollapsed(x=>!x)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:14,lineHeight:1,flexShrink:0}}>M</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"6px 0"}}>
        {groups.map(([group,pages])=>(
          <div key={group} style={{marginBottom:2}}>
            {!collapsed&&<div style={{fontSize:8,letterSpacing:2,color:t.MUTED,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",padding:"4px 14px 2px"}}>{group}</div>}
            {pages.map(id=>{
              const nav=NAV.find(n=>n[0]===id);
              if(!nav)return null;
              const active=page===id;
              return (
                <button key={id} onClick={()=>setPage(id)} title={nav[2]} style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:collapsed?"9px 0":"6px 14px",background:active?t.GOLD+"18":"none",border:"none",borderLeft:active?"2px solid "+t.GOLD:"2px solid transparent",color:active?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,textAlign:"left",justifyContent:collapsed?"center":"flex-start",transition:"all .15s"}}>
                  <span style={{fontSize:14,flexShrink:0,lineHeight:1}}>{nav[1]}</span>
                  {!collapsed&&<span style={{whiteSpace:"nowrap"}}>{nav[2]}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {!collapsed&&(
        <div style={{borderTop:"1px solid "+t.BORDER,padding:"10px 14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:8}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:t.GOLD+"33",border:"1px solid "+t.GOLD+"55",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:t.GOLD,fontWeight:700,flexShrink:0}}>{initials||"W"}</div>
            <div style={{overflow:"hidden"}}>
              <div style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{profile.firstName} {profile.lastName}</div>
              <div style={{fontSize:9,color:savedLabel?t.GREEN:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{savedLabel||profile.occupation||"The Executive"}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:4}}>
            {[{id:"obsidian",l:"Ob"},{id:"charcoal",l:"Ch"}].map(th=>(
              <button key={th.id} onClick={()=>setTheme(th.id)} style={{flex:1,padding:"4px 2px",borderRadius:5,border:"1px solid "+(theme===th.id?t.GOLD:t.BORDER),background:theme===th.id?t.GOLD+"18":"transparent",color:theme===th.id?t.GOLD:t.MUTED,cursor:"pointer",fontSize:9,fontFamily:"'Montserrat',sans-serif"}}>
                {th.l}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AnimatedScore({value,color,size=52}){
  const[display,setDisplay]=useState(0);
  useEffect(()=>{
    if(value===0){setDisplay(0);return;}
    let start=0;
    const duration=800;
    const step=16;
    const inc=value/(duration/step);
    const id=setInterval(()=>{
      start+=inc;
      if(start>=value){setDisplay(value);clearInterval(id);}
      else setDisplay(Math.round(start));
    },step);
    return()=>clearInterval(id);
  },[value]);
  return <div className="score-up" style={{fontSize:size,color,fontFamily:"'Montserrat',sans-serif",fontWeight:700,lineHeight:1}}>{display}</div>;
}

function DashboardPage({profile,tasks,setTasks,goals,supplements,setSupplements,history,streak,market,nwHistory,setPage,setShowBriefing,habits,habitLog,setHabitLog,bills,transactions,isMobile,syncing,isOnline,pendingSave,authUser,setShowAuth,holdings,portfolio,cryptoHoldings,cryptoPortfolio,marketTickers,setMarketTickers,subscription,setShowUpgrade}){
  const[showMktEdit,setShowMktEdit]=useState(false);

  const t=T();
  const[visibleRows,setVisibleRows]=useState([]);
  useEffect(()=>{
    const delays=[0,120,240,360,480,600];
    const timers=delays.map((d,i)=>setTimeout(()=>setVisibleRows(r=>[...r,i]),d));
    return()=>timers.forEach(clearTimeout);
  },[]);
  const rowStyle=i=>({opacity:visibleRows.includes(i)?1:0,transform:visibleRows.includes(i)?"none":"translateY(16px)",transition:"opacity .45s ease, transform .45s ease"});
  const todayT=todayTasks(tasks);
  const tDone=todayT.filter(tk=>tk.done).length;
  const sDone=supplements.filter(s=>s.taken).length;
  const hDone=(habits||[]).filter(h=>!!habitLog[h.id+"_"+todayStr()]).length;
  const nw=profile.netWorth||0;
  const nwT=Number(profile.netWorthTarget||3000000);
  const nwPct=Math.min(Math.round(nw/nwT*100),100);
  const nwEntries=Object.entries(nwHistory).sort((a,b)=>a[0].localeCompare(b[0]));
  const nwVals=nwEntries.map(e=>e[1]);
  const nwLabels=[...nwEntries.map(e=>e[0]),todayStr()];
  const togTask=id=>setTasks(ts=>ts.map(tk=>tk.id===id?{...tk,done:!tk.done}:tk));
  const togHabit=id=>setHabitLog(l=>({...l,[id+"_"+todayStr()]:!l[id+"_"+todayStr()]}));
  const togSupp=id=>setSupplements&&setSupplements(ss=>(ss||[]).map(s=>s.id===id?{...s,taken:!s.taken}:s));
  const quotes=["Wealth is the slave of a wise man, the master of a fool.", "The secret of getting ahead is getting started.", "An investment in knowledge pays the best interest. \u2014 Franklin", "Do not save what is left after spending; spend what is left after saving. \u2014 Buffett", "Risk comes from not knowing what you're doing. \u2014 Buffett", "Price is what you pay. Value is what you get. \u2014 Buffett", "In investing, what is comfortable is rarely profitable. \u2014 Robert Arnott", "The stock market is a device for transferring money from the impatient to the patient. \u2014 Buffett", "Compound interest is the eighth wonder of the world. \u2014 Einstein", "The four most dangerous words in investing: this time it's different. \u2014 Templeton", "An investor who has all the answers doesn't even understand the questions. \u2014 Templeton", "It takes 20 years to build a reputation and 5 minutes to ruin it. \u2014 Buffett", "The most important investment you can make is in yourself. \u2014 Buffett", "Someone is sitting in the shade today because someone planted a tree long ago. \u2014 Buffett", "Real wealth is not about money. Real wealth is not having to go to meetings. \u2014 Naval Ravikant", "Play long-term games with long-term people. \u2014 Naval Ravikant", "Earn with your mind, not your time. \u2014 Naval Ravikant", "The goal of investing is to find businesses you can predict and own them forever. \u2014 Munger", "All I want to know is where I'm going to die, so I'll never go there. \u2014 Munger", "Invert, always invert. \u2014 Munger", "Spend each day trying to be a little wiser than you were when you woke up. \u2014 Munger", "Wide diversification is only required when investors do not understand what they are doing. \u2014 Buffett", "Be fearful when others are greedy, and greedy when others are fearful. \u2014 Buffett", "Never depend on a single income. Make an investment to create a second source. \u2014 Buffett", "It's not how much money you make, but how much money you keep. \u2014 Robert Kiyosaki", "The rich invest their money and spend what is left; the poor spend their money and invest what is left. \u2014 Jim Rohn", "Financial freedom is available to those who learn about it and work for it. \u2014 Robert Kiyosaki", "In the business world, the rearview mirror is always clearer than the windshield. \u2014 Buffett", "You don't need to be a rocket scientist. Investing is not a game where the guy with the 160 IQ beats the guy with 130 IQ. \u2014 Buffett", "Money is a terrible master but an excellent servant. \u2014 P.T. Barnum", "The avoidance of taxes is the only intellectual pursuit that carries any reward. \u2014 John Maynard Keynes", "A budget is telling your money where to go instead of wondering where it went. \u2014 Dave Ramsey", "The big money is not in the buying or the selling, but in the waiting. \u2014 Charlie Munger", "Diversification is protection against ignorance. It makes little sense if you know what you are doing. \u2014 Buffett", "The four most expensive words in the English language are 'this time it's different.'  \u2014 Templeton", "If you don't find a way to make money while you sleep, you will work until you die. \u2014 Buffett", "Time in the market beats timing the market.", "The individual investor should act consistently as an investor and not as a speculator. \u2014 Benjamin Graham", "Know what you own, and know why you own it. \u2014 Peter Lynch", "In the short run, the market is a voting machine; in the long run, it's a weighing machine. \u2014 Benjamin Graham", "The four pillars of investing: ownership, diversification, low cost, discipline.", "Markets can remain irrational longer than you can remain solvent. \u2014 Keynes", "Risk means more things can happen than will happen. \u2014 Elroy Dimson", "Never test the depth of the water with both feet. \u2014 Buffett", "Cash combined with courage in a crisis is priceless. \u2014 Buffett", "Our favourite holding period is forever. \u2014 Buffett", "The most important quality for an investor is temperament, not intellect. \u2014 Buffett", "Risk comes from being unsure of your circle of competence. \u2014 Buffett", "Money is multiplied in practical value depending on the number of W's you control in your life. \u2014 Naval Ravikant", "You're not going to get rich renting out your time. \u2014 Naval Ravikant", "Specific knowledge is found by pursuing your genuine curiosity. \u2014 Naval Ravikant", "Productize yourself. Code and media are permissionless leverage. \u2014 Naval Ravikant", "Escape competition through authenticity. \u2014 Naval Ravikant", "Leverage is a force multiplier for your judgement. \u2014 Naval Ravikant", "Discipline is the bridge between goals and accomplishment. \u2014 Jim Rohn", "Either you run the day or the day runs you. \u2014 Jim Rohn", "Success is nothing more than a few simple disciplines, practised every day. \u2014 Jim Rohn", "You don't rise to the level of your goals. You fall to the level of your systems. \u2014 James Clear", "We are what we repeatedly do. Excellence, then, is not an act, but a habit. \u2014 Aristotle", "Quality is not an act. It is a habit. \u2014 Aristotle", "Don't watch the clock; do what it does. Keep going. \u2014 Sam Levenson", "The way to get started is to quit talking and begin doing. \u2014 Walt Disney", "It does not matter how slowly you go as long as you do not stop. \u2014 Confucius", "The man who moves a mountain begins by carrying away small stones. \u2014 Confucius", "Motivation is what gets you started. Habit is what keeps you going. \u2014 Jim Rohn", "Small disciplines repeated with consistency every day lead to great achievements. \u2014 John C. Maxwell", "What you do every day matters more than what you do once in a while. \u2014 Gretchen Rubin", "Discipline equals freedom. \u2014 Jocko Willink", "The chains of habit are too weak to be felt until they are too strong to be broken. \u2014 Samuel Johnson", "Suffer the pain of discipline or suffer the pain of regret.", "How you do anything is how you do everything.", "The price of discipline is always less than the pain of regret.", "Habits are the compound interest of self-improvement. \u2014 James Clear", "You do not rise to the level of your dreams; you fall to the level of your training.", "Every action you take is a vote for the type of person you wish to become. \u2014 James Clear", "Self-discipline is the magic power that makes you virtually unstoppable. \u2014 Dan Kennedy", "The successful warrior is the average man, with laser-like focus. \u2014 Bruce Lee", "Do not pray for an easy life, pray for the strength to endure a difficult one. \u2014 Bruce Lee", "It's not that I'm so smart, it's just that I stay with problems longer. \u2014 Einstein", "Patience is bitter, but its fruit is sweet. \u2014 Aristotle", "The struggle you're in today is developing the strength you need for tomorrow.", "Hard choices, easy life. Easy choices, hard life. \u2014 Jerzy Gregorek", "The pain of discipline weighs ounces. The pain of regret weighs tons.", "What gets measured gets managed. \u2014 Peter Drucker", "Repetition is the mother of mastery. \u2014 Tony Robbins", "Action is the foundational key to all success. \u2014 Picasso", "You will never always be motivated, so you must learn to be disciplined.", "Excellence is a continuous process and not an accident. \u2014 A.P.J. Abdul Kalam", "There is no substitute for hard work. \u2014 Edison", "Focus on being productive instead of busy. \u2014 Tim Ferriss", "Done is better than perfect.", "Energy and persistence conquer all things. \u2014 Franklin", "The man who has confidence in himself gains the confidence of others. \u2014 Hasidic proverb", "The goal is not more money. The goal is living life on your own terms.", "It's not about having time. It's about making time.", "The best time to plant a tree was 20 years ago. The second best time is now.", "The only way to do great work is to love what you do. \u2014 Steve Jobs", "Your time is limited. Don't waste it living someone else's life. \u2014 Steve Jobs", "The harder I work, the luckier I get. \u2014 Samuel Goldwyn", "Opportunities don't happen. You create them. \u2014 Chris Grosser", "I find that the harder I work, the more luck I seem to have. \u2014 Jefferson", "Success usually comes to those who are too busy to be looking for it. \u2014 Thoreau", "It is not the strongest species that survive, but the most adaptable. \u2014 Darwin", "Tough times never last, but tough people do. \u2014 Robert H. Schuller", "A person who never made a mistake never tried anything new. \u2014 Einstein", "Life is what happens when you're busy making other plans. \u2014 Lennon", "Twenty years from now you'll be more disappointed by the things you didn't do. \u2014 Twain", "You miss 100% of the shots you don't take. \u2014 Gretzky", "Whether you think you can or think you can't, you're right. \u2014 Henry Ford", "The only limit to our realisation of tomorrow is our doubts of today. \u2014 FDR", "Everything you've ever wanted is on the other side of fear. \u2014 George Addair", "Hardships often prepare ordinary people for an extraordinary destiny. \u2014 C.S. Lewis", "Believe you can and you're halfway there. \u2014 Theodore Roosevelt", "Do not go where the path may lead. Go instead where there is no path. \u2014 Emerson", "He who is not courageous enough to take risks will accomplish nothing in life. \u2014 Ali", "Fortune favours the prepared mind. \u2014 Pasteur", "What we achieve inwardly will change outer reality. \u2014 Plutarch", "Simplicity is the ultimate sophistication. \u2014 Leonardo da Vinci", "The mind is everything. What you think, you become. \u2014 Buddha", "The secret of change is to focus all energy not on fighting the old, but building the new. \u2014 Socrates", "Knowing is not enough; we must apply. Willing is not enough; we must do. \u2014 Goethe", "Genius is one percent inspiration, ninety-nine percent perspiration. \u2014 Edison", "I have not failed. I've just found 10,000 ways that won't work. \u2014 Edison", "If you want to lift yourself up, lift up someone else. \u2014 Booker T. Washington", "It is during our darkest moments that we must focus to see the light. \u2014 Aristotle", "Success is not final, failure is not fatal: it is the courage to continue that counts. \u2014 Churchill", "Never let the fear of striking out keep you from playing the game. \u2014 Babe Ruth", "I am not a product of my circumstances. I am a product of my decisions. \u2014 Stephen Covey", "What lies behind us and what lies before us are tiny matters compared to what lies within us. \u2014 Emerson", "You become what you give your attention to. \u2014 Epictetus", "The greatest glory in living lies not in never falling, but in rising every time we fall. \u2014 Mandela", "It always seems impossible until it's done. \u2014 Mandela", "Education is the most powerful weapon which you can use to change the world. \u2014 Mandela", "The future belongs to those who believe in the beauty of their dreams. \u2014 Eleanor Roosevelt", "Strive not to be a success, but rather to be of value. \u2014 Einstein", "The only impossible journey is the one you never begin. \u2014 Tony Robbins", "Your life does not get better by chance, it gets better by change. \u2014 Jim Rohn", "You are the average of the five people you spend the most time with. \u2014 Jim Rohn", "Formal education will make you a living; self-education will make you a fortune. \u2014 Jim Rohn", "Don't wish it were easier, wish you were better. \u2014 Jim Rohn", "If you really want to do something, you'll find a way. If not, you'll find an excuse.", "A goal without a plan is just a wish. \u2014 Antoine de Saint-Exup\u00e9ry", "Don't count the days, make the days count. \u2014 Muhammad Ali", "Champions keep playing until they get it right. \u2014 Billie Jean King", "It's hard to beat a person who never gives up. \u2014 Babe Ruth", "The way to get started is to quit talking and begin doing.", "Limitations live only in our minds. But if we use our imaginations, our possibilities become limitless.", "Try not to become a person of success, but rather try to become a person of value. \u2014 Einstein", "The most difficult thing is the decision to act; the rest is merely tenacity. \u2014 Amelia Earhart", "What you get by achieving your goals is not as important as what you become by achieving your goals. \u2014 Zig Ziglar", "Failure will never overtake me if my determination to succeed is strong enough. \u2014 Og Mandino", "Dreaming, after all, is a form of planning. \u2014 Gloria Steinem", "It's not the will to win that matters \u2014 everyone has that. It's the will to prepare to win that matters. \u2014 Bear Bryant", "Big results require big ambitions. \u2014 Heraclitus", "Definiteness of purpose is the starting point of all achievement. \u2014 W. Clement Stone", "There is no traffic jam along the extra mile. \u2014 Roger Staubach", "Take care of your body. It's the only place you have to live. \u2014 Jim Rohn", "The groundwork for all happiness is good health. \u2014 Leigh Hunt", "Health is not valued until sickness comes. \u2014 Thomas Fuller", "To keep the body in good health is a duty, otherwise we shall not be able to keep our mind strong and clear. \u2014 Buddha", "A man too busy to take care of his health is like a mechanic too busy to take care of his tools.", "It is health that is real wealth and not pieces of gold and silver. \u2014 Gandhi", "The body achieves what the mind believes.", "Energy and persistence conquer all things.", "Strength does not come from winning. Your struggles develop your strengths. \u2014 Arnold Schwarzenegger", "The pain you feel today will be the strength you feel tomorrow.", "Discipline is choosing between what you want now and what you want most.", "Sleep is the best meditation. \u2014 Dalai Lama", "He who has health, has hope; and he who has hope, has everything. \u2014 Thomas Carlyle", "Your body hears everything your mind says. Stay positive.", "Physical fitness is not only one of the most important keys to a healthy body, it is the basis of dynamic creative intellectual activity. \u2014 JFK", "Take care of your body. It's the only one you get.", "Movement is a medicine for creating change in a person's physical, emotional, and mental states. \u2014 Carol Welch", "The greatest wealth is health. \u2014 Virgil", "You have power over your mind, not outside events. Realise this, and you will find strength. \u2014 Marcus Aurelius", "Waste no more time arguing about what a good man should be. Be one. \u2014 Marcus Aurelius", "The impediment to action advances action. What stands in the way becomes the way. \u2014 Marcus Aurelius", "It is not death that a man should fear, but he should fear never beginning to live. \u2014 Marcus Aurelius", "How much trouble he avoids who does not look to see what his neighbour says or does. \u2014 Marcus Aurelius", "He who fears death will never do anything worthy of a man who is alive. \u2014 Seneca", "Luck is what happens when preparation meets opportunity. \u2014 Seneca", "We suffer more often in imagination than in reality. \u2014 Seneca", "It is not the man who has too little, but the man who craves more, that is poor. \u2014 Seneca", "Difficulties strengthen the mind, as labour does the body. \u2014 Seneca", "No man is free who is not master of himself. \u2014 Epictetus", "First say to yourself what you would be; and then do what you have to do. \u2014 Epictetus", "Wealth consists not in having great possessions, but in having few wants. \u2014 Epictetus", "Men are disturbed not by things, but by the views they take of them. \u2014 Epictetus", "He is a wise man who does not grieve for the things which he has not, but rejoices for those which he has. \u2014 Epictetus", "The obstacle is the way. \u2014 Marcus Aurelius", "You could leave life right now. Let that determine what you do and say and think. \u2014 Marcus Aurelius", "Confine yourself to the present. \u2014 Marcus Aurelius", "Very little is needed to make a happy life; it is all within yourself, in your way of thinking. \u2014 Marcus Aurelius", "Begin at once to live, and count each separate day as a separate life. \u2014 Seneca", "A leader is one who knows the way, goes the way, and shows the way. \u2014 John C. Maxwell", "Leadership is the capacity to translate vision into reality. \u2014 Warren Bennis", "Innovation distinguishes between a leader and a follower. \u2014 Steve Jobs", "The function of leadership is to produce more leaders, not more followers. \u2014 Ralph Nader", "A genuine leader is not a searcher for consensus but a moulder of consensus. \u2014 Martin Luther King Jr.", "Management is doing things right; leadership is doing the right things. \u2014 Peter Drucker", "What you do has far greater impact than what you say. \u2014 Stephen Covey", "The greatest leader is not necessarily the one who does the greatest things, but the one that gets the people to do the greatest things. \u2014 Ronald Reagan", "Outstanding leaders go out of their way to boost the self-esteem of their personnel. \u2014 Sam Walton", "You don't lead by hitting people over the head \u2014 that's assault, not leadership. \u2014 Eisenhower", "Before you are a leader, success is all about growing yourself. When you become a leader, success is about growing others. \u2014 Jack Welch", "The very essence of leadership is that you have to have a vision. \u2014 Theodore Hesburgh", "A good leader takes a little more than his share of the blame, a little less than his share of the credit. \u2014 Arnold H. Glasow", "Leaders are made, they are not born. They are made by hard effort. \u2014 Vince Lombardi", "To lead people, walk beside them. \u2014 Lao Tzu", "Great leaders are willing to sacrifice the numbers to save the people. \u2014 Simon Sinek", "Vision without execution is hallucination. \u2014 Thomas Edison", "If your actions inspire others to dream more, learn more, do more and become more, you are a leader. \u2014 John Quincy Adams", "Legacy is not what's left for people, it's what's left in them. \u2014 Peter Strople", "The greatest legacy one can pass on to one's children is not money, but a legacy of character and faith. \u2014 Billy Graham", "What is success? It is being able to go to bed each night with your soul at peace. \u2014 Paulo Coelho", "Your legacy is being written by yourself. Make the right decisions. \u2014 Anonymous", "Family is not an important thing, it's everything. \u2014 Michael J. Fox", "He who has a why to live can bear almost any how. \u2014 Nietzsche", "The two most important days in your life are the day you are born and the day you find out why. \u2014 Mark Twain", "In the end, it's not the years in your life that count, it's the life in your years. \u2014 Abraham Lincoln", "We make a living by what we get, but we make a life by what we give. \u2014 Churchill", "Time spent with family is worth every second. \u2014 Anonymous", "No legacy is so rich as honesty. \u2014 Shakespeare", "To plant a garden is to believe in tomorrow. \u2014 Audrey Hepburn", "Build your own dreams, or someone else will hire you to build theirs. \u2014 Farrah Gray", "What you leave behind is not what is engraved in stone monuments, but what is woven into the lives of others. \u2014 Pericles", "A man's legacy is determined by how well he has loved. \u2014 Anonymous", "Today is the day.", "Show up. Do the work. Repeat.", "Small steps every day.", "Discipline over motivation.", "Earn it today.", "Progress, not perfection.", "One day or day one. You decide.", "Build the life you don't need a vacation from.", "Execute relentlessly.", "Be the exception.", "Outwork yesterday.", "Stay hungry, stay humble.", "Consistency compounds.", "No shortcuts, just systems.", "Win the morning, win the day.", "Focus wins.", "Patience pays the highest dividends.", "Quiet confidence, loud results.", "Master the mundane.", "The standard is the standard.", "He that can have patience can have what he will. \u2014 Franklin", "Lost time is never found again. \u2014 Franklin", "Well done is better than well said. \u2014 Franklin", "By failing to prepare, you are preparing to fail. \u2014 Franklin", "Genius is one percent inspiration and ninety-nine percent perspiration. \u2014 Edison", "If you want to live a happy life, tie it to a goal, not to people or things. \u2014 Einstein", "In the middle of difficulty lies opportunity. \u2014 Einstein", "Life is like riding a bicycle \u2014 to keep your balance you must keep moving. \u2014 Einstein", "Out of clutter, find simplicity. \u2014 Einstein", "We cannot solve our problems with the same thinking we used when we created them. \u2014 Einstein", "The world as we have created it is a process of our thinking. It cannot be changed without changing our thinking. \u2014 Einstein", "Logic will get you from A to B. Imagination will take you everywhere. \u2014 Einstein", "Try to be a rainbow in someone's cloud. \u2014 Maya Angelou", "I've learned that people will forget what you said, but they will never forget how you made them feel. \u2014 Maya Angelou", "Nothing can dim the light which shines from within. \u2014 Maya Angelou", "There is no greater agony than bearing an untold story inside you. \u2014 Maya Angelou", "If you can't fly then run, if you can't run then walk, if you can't walk then crawl, but keep moving. \u2014 Martin Luther King Jr.", "Faith is taking the first step even when you don't see the whole staircase. \u2014 Martin Luther King Jr.", "Darkness cannot drive out darkness; only light can do that. \u2014 Martin Luther King Jr.", "The time is always right to do what is right. \u2014 Martin Luther King Jr.", "Our lives begin to end the day we become silent about things that matter. \u2014 Martin Luther King Jr.", "Real integrity is doing the right thing, knowing that nobody's going to know whether you did it or not. \u2014 Oprah Winfrey", "You become what you believe. \u2014 Oprah Winfrey", "Turn your wounds into wisdom. \u2014 Oprah Winfrey", "The biggest adventure you can take is to live the life of your dreams. \u2014 Oprah Winfrey", "Doing the best at this moment puts you in the best place for the next moment. \u2014 Oprah Winfrey", "If you look at what you have in life, you'll always have more. \u2014 Oprah Winfrey", "The only person you are destined to become is the person you decide to be. \u2014 Emerson", "Nothing great was ever achieved without enthusiasm. \u2014 Emerson", "What lies behind us and what lies before us are tiny matters compared to what lies within us.", "For every minute you remain angry, you give up sixty seconds of peace of mind. \u2014 Emerson", "To laugh often and much; to win the respect of intelligent people. \u2014 Emerson", "Adopt the pace of nature: her secret is patience. \u2014 Emerson", "Once you replace negative thoughts with positive ones, you'll start having positive results. \u2014 Willie Nelson", "The only place where your dream becomes impossible is in your own thinking. \u2014 Anonymous", "What you think, you become. What you feel, you attract. What you imagine, you create. \u2014 Buddha", "Peace comes from within. Do not seek it without. \u2014 Buddha", "Three things cannot be long hidden: the sun, the moon, and the truth. \u2014 Buddha", "You only lose what you cling to. \u2014 Buddha", "Better than a thousand hollow words is one word that brings peace. \u2014 Buddha", "The trouble is, you think you have time. \u2014 Buddha", "It is better to conquer yourself than to win a thousand battles. \u2014 Buddha", "He who experiences the unity of life sees his own self in all beings. \u2014 Buddha", "To enjoy good health, to bring true happiness to one's family, to bring peace to all \u2014 one must first discipline and control one's own mind. \u2014 Buddha", "Holding onto anger is like drinking poison and expecting the other person to die. \u2014 Buddha", "All that we are is the result of what we have thought. \u2014 Buddha", "An idea that is developed and put into action is more important than an idea that exists only as an idea. \u2014 Buddha", "Do not dwell in the past, do not dream of the future, concentrate the mind on the present moment. \u2014 Buddha", "Pain is certain, suffering is optional.", "What we think, we become.", "The journey of a thousand miles begins with one step. \u2014 Lao Tzu", "Knowing others is wisdom, knowing yourself is enlightenment. \u2014 Lao Tzu", "Nature does not hurry, yet everything is accomplished. \u2014 Lao Tzu", "A good traveller has no fixed plans and is not intent on arriving. \u2014 Lao Tzu", "When I let go of what I am, I become what I might be. \u2014 Lao Tzu", "Silence is a source of great strength. \u2014 Lao Tzu", "Care about people's approval and you will be their prisoner. \u2014 Lao Tzu", "He who knows he has enough is rich. \u2014 Lao Tzu", "The flame that burns twice as bright burns half as long. \u2014 Lao Tzu", "Anticipate the difficult by managing the easy. \u2014 Lao Tzu", "To the mind that is still, the whole universe surrenders. \u2014 Lao Tzu", "Time is a created thing. To say 'I don't have time' is to say 'I don't want to.' \u2014 Lao Tzu", "Those who flow as life flows know they need no other force. \u2014 Lao Tzu", "Be content with what you have; rejoice in the way things are. \u2014 Lao Tzu", "A journey of a thousand miles must begin with a single step.", "The wise man does not lay up his own treasures. The more he gives to others, the more he has for his own. \u2014 Lao Tzu", "Stop acting as if life is a rehearsal. Live this day as if it were your last. \u2014 Wayne Dyer", "How people treat you is their karma; how you react is yours. \u2014 Wayne Dyer", "You cannot always control what goes on outside. But you can always control what goes on inside. \u2014 Wayne Dyer", "Go for it now. The future is promised to no one. \u2014 Wayne Dyer", "You'll see it when you believe it. \u2014 Wayne Dyer", "When you judge another, you do not define them, you define yourself. \u2014 Wayne Dyer", "The privilege of a lifetime is to become who you truly are. \u2014 Carl Jung", "Until you make the unconscious conscious, it will direct your life and you will call it fate. \u2014 Carl Jung", "Knowing your own darkness is the best method for dealing with the darknesses of other people. \u2014 Carl Jung", "Everything that irritates us about others can lead us to an understanding of ourselves. \u2014 Carl Jung", "The meeting of two personalities is like the contact of two chemical substances. \u2014 Carl Jung", "Your visions will become clear only when you can look into your own heart. \u2014 Carl Jung", "I am not what happened to me, I am what I choose to become. \u2014 Carl Jung", "There is no coming to consciousness without pain. \u2014 Carl Jung", "As far as we can discern, the sole purpose of human existence is to kindle a light in the darkness. \u2014 Carl Jung", "That which we resist persists. \u2014 Carl Jung", "The shoe that fits one person pinches another; there is no recipe for living that suits all cases. \u2014 Carl Jung", "Man's task is to become conscious of the contents that press upward from the unconscious. \u2014 Carl Jung", "Identity is not given to us, but created through synthesis of our experiences.", "To find yourself, think for yourself. \u2014 Socrates", "The unexamined life is not worth living. \u2014 Socrates", "I cannot teach anybody anything. I can only make them think. \u2014 Socrates", "Strong minds discuss ideas, average minds discuss events, weak minds discuss people. \u2014 Socrates", "There is only one good, knowledge, and one evil, ignorance. \u2014 Socrates", "He is richest who is content with the least. \u2014 Socrates", "The only true wisdom is in knowing you know nothing. \u2014 Socrates", "Education is the kindling of a flame, not the filling of a vessel. \u2014 Socrates", "Be slow to fall into friendship, but when you are in, continue firm and constant. \u2014 Socrates", "Wonder is the beginning of wisdom. \u2014 Socrates", "Employ your time in improving yourself by other men's writings. \u2014 Socrates", "Let him that would move the world first move himself. \u2014 Socrates", "False words are not only evil in themselves, but they infect the soul with evil. \u2014 Plato", "The greatest wealth is to live content with little. \u2014 Plato", "Courage is knowing what not to fear. \u2014 Plato", "He who is not a good servant will not be a good master. \u2014 Plato", "Wise men talk because they have something to say; fools because they have to say something. \u2014 Plato", "At the touch of love everyone becomes a poet. \u2014 Plato", "Music gives a soul to the universe, wings to the mind, flight to the imagination. \u2014 Plato", "Necessity is the mother of invention. \u2014 Plato", "Knowledge becomes evil if the aim be not virtuous. \u2014 Plato", "Ignorance, the root and stem of all evil. \u2014 Plato", "There are two things a person should never be angry at: what they can help, and what they cannot. \u2014 Plato", "Good actions give strength to ourselves and inspire good actions in others. \u2014 Plato", "The price of apathy towards public affairs is to be ruled by evil men. \u2014 Plato", "Human behaviour flows from three main sources: desire, emotion, and knowledge. \u2014 Plato", "Excellence is not a gift, but a skill that takes practice. \u2014 Plato", "Wonder is the feeling of the philosopher, and philosophy begins in wonder. \u2014 Plato", "Don't be unwilling to give up your good for the sake of the great. \u2014 John D. Rockefeller", "The way to make money is to buy when blood is running in the streets. \u2014 Rockefeller", "If you want to succeed you should strike out on new paths, rather than travel the worn paths of accepted success. \u2014 Rockefeller", "I always tried to turn every disaster into an opportunity. \u2014 Rockefeller", "Good management consists in showing average people how to do the work of superior people. \u2014 Rockefeller"];
  const dayOfYear=(()=>{const now=new Date();const start=new Date(now.getFullYear(),0,0);const diff=now-start;return Math.floor(diff/864e5);})();
  const quote=quotes[(dayOfYear-1+quotes.length)%quotes.length];
  const upcoming=(bills||[]).filter(b=>{const d=(new Date(b.nextDue+"T12:00:00")-new Date())/864e5;return d>=0&&d<=7;}).sort((a,b)=>new Date(a.nextDue)-new Date(b.nextDue));
  const highTasks=tasks.filter(tk=>tk.priority==="high");
  const goalsDone=goals.filter(g=>g.progress>=50).length;
  const rings=[
    {pct:todayT.length?Math.round(tDone/todayT.length*100):0,c:t.GREEN,label:"Tasks",sub:tDone+"/"+todayT.length,page:"tasks"},
    {pct:(habits||[]).length?Math.round(hDone/(habits||[]).length*100):0,c:t.GOLD,label:"Habits",sub:hDone+"/"+((habits||[]).length),page:"habits"},
    {pct:supplements.length?Math.round(sDone/supplements.length*100):0,c:t.BLUE,label:"Supps",sub:sDone+"/"+supplements.length,page:"health"},
    ...(goals.length?[{pct:Math.round(goalsDone/goals.length*100),c:"#B07EC9",label:"Goals",sub:goalsDone+"/"+goals.length,page:"goals"}]:[])
  ];
  const tPct=todayT.length?tDone/todayT.length:null;
  const hbPct=(habits||[]).length?hDone/(habits||[]).length:null;
  const sPct=supplements.length?sDone/supplements.length:null;
  const gPct=goals.length?goals.filter(g=>g.progress>=50).length/goals.length:null;
  const activePcts=[tPct,hbPct,sPct].filter(v=>v!==null);
  const todayScore=activePcts.length?Math.round(activePcts.reduce((a,b)=>a+b,0)/activePcts.length*100):0;
  const scoreColor=todayScore>=80?t.GREEN:todayScore>=60?t.GOLD:todayScore>=40?t.BLUE:t.RED;
  const r=32,circ=2*Math.PI*r;
  const mk=monthStr();
  const monthIncome=(transactions||[]).filter(tx=>tx.date.startsWith(mk)&&tx.type==="income").reduce((s,tx)=>s+tx.amount,0);
  const monthExpense=(transactions||[]).filter(tx=>tx.date.startsWith(mk)&&tx.type==="expense").reduce((s,tx)=>s+tx.amount,0);
  const monthNet=monthIncome-monthExpense;
  const nextBill=(bills||[]).filter(b=>(new Date(b.nextDue+"T12:00:00")-new Date())>0).sort((a,b)=>new Date(a.nextDue)-new Date(b.nextDue))[0];
  const monthlyBills=(bills||[]).reduce((s,b)=>{const m={weekly:52/12,fortnightly:26/12,monthly:1,quarterly:1/3,annually:1/12};return s+b.amount*(m[b.frequency]||1);},0);
  const mktRows=(marketTickers||DEFAULT_TICKERS).map(tk=>{
    const raw=market.prices[tk.symbol]||{loading:!market.lastUpdated,price:null,pct:0};
    const converted=raw.isCrypto&&raw.price&&market.fxRate!==1?{...raw,price:raw.price*market.fxRate,convertedFrom:"USD"}:raw;
    return{l:tk.label,d:converted,fx:tk.fx,symbol:tk.symbol,isCrypto:raw.isCrypto};
  });
  const goalPeriods=["year","month","week"];
  const periodLabels={year:"Annual",month:"Monthly",week:"This Week"};
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14,position:"relative"}}>
      {/* ── HEADER ── */}
      <div style={{...rowStyle(0),background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:12,overflow:"hidden",marginBottom:12}}>
        {/* Top row — greeting + sync */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"14px 16px 10px"}}>
          <div>
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:4}}>The Executive</div>
            <div style={{fontSize:isMobile?20:24,color:t.TEXT,lineHeight:1.2}}>
              {"Good "+(new Date().getHours()<12?"morning":new Date().getHours()<17?"afternoon":"evening")+", "}
              <span style={{color:t.GOLD}}>{profile.firstName}</span>
            </div>
            <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:3}}>{new Date().toLocaleDateString(_locale,{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
            {syncing&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",opacity:.7}}>Syncing...</div>}
            {!isOnline&&<div style={{fontSize:9,color:"#C97E7E",fontFamily:"'Montserrat',sans-serif",display:"flex",alignItems:"center",gap:4}}><span>●</span> Offline — changes saved locally</div>}
            {isOnline&&pendingSave&&<div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",opacity:.8}}>Syncing pending changes...</div>}
            {authUser?(
              <button onClick={()=>setPage("profile")} style={{display:"flex",alignItems:"center",gap:5,background:t.GREEN+"14",border:"1px solid "+t.GREEN+"33",borderRadius:6,padding:"4px 9px",cursor:"pointer"}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:t.GREEN,flexShrink:0}}/>
                <span style={{fontSize:9,color:t.GREEN,fontFamily:"'Montserrat',sans-serif"}}>{authUser.email?.split("@")[0]}</span>
              </button>
            ):(
              <button onClick={()=>setShowAuth(true)} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:6,padding:"4px 10px",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:10}}>Sign In</button>
            )}
          </div>
        </div>
        {/* Quote + Briefing */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 16px 12px",borderBottom:"1px solid "+t.BORDER,gap:16}}>
          <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Cormorant Garamond',Georgia,serif",fontStyle:"italic",lineHeight:1.6,flex:1}}>"{quote}"</div>
          <button onClick={()=>isPro(subscription)?setShowBriefing(true):setShowUpgrade(true)} style={{background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:8,padding:"7px 14px",color:"#080808",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>
            Open Briefing
          </button>
        </div>
      </div>
      {/* ── ROW 1: Score + Rings + Net Worth ── */}
      <div style={{...rowStyle(1),display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:12,order:isMobile?1:0}}>
        {/* Score */}
        <Card style={{background:t.CARD2,border:"1px solid "+scoreColor+"44",display:"flex",alignItems:"center",gap:14}}>
          <div style={{flexShrink:0}}>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",letterSpacing:1,marginBottom:4}}>TODAY'S SCORE</div>
            <div style={{display:"flex",alignItems:"baseline",gap:3}}>
              <AnimatedScore value={todayScore} color={scoreColor} size={isMobile?38:52}/>
              <div style={{fontSize:16,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>%</div>
            </div>
            <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>{streak+" day streak"}</div>
          </div>
          <div style={{flex:1}}>
            {[{l:"Tasks",v:tPct,c:t.GREEN},{l:"Habits",v:hbPct,c:t.GOLD},{l:"Supps",v:sPct,c:t.BLUE}].map(x=>(
              <div key={x.l} style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",width:34}}>{x.l}</div>
                <div style={{flex:1}}><PB value={x.v!=null?Math.round(x.v*100):0} color={x.c} height={4}/></div>
                <div style={{fontSize:9,color:x.c,fontFamily:"'Montserrat',sans-serif",width:28,textAlign:"right"}}>{x.v!=null?Math.round(x.v*100)+"%":"—"}</div>
              </div>
            ))}
          </div>
        </Card>
        {/* Progress Rings */}
        {!isMobile&&<Card style={{display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
          <SectionLabel action={<span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{streak+" day streak"}</span>}>Today's Progress</SectionLabel>
          <div style={{display:"flex",justifyContent:"space-around",alignItems:"center",flex:1,padding:"6px 0"}}>
            {rings.map(ring=>(
              <div key={ring.label} onClick={()=>setPage(ring.page)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,cursor:"pointer"}}>
                <div style={{position:"relative",width:76,height:76}}>
                  <svg width={76} height={76} style={{transform:"rotate(-90deg)"}}>
                    <circle cx={38} cy={38} r={r} fill="none" stroke={t.BORDER2} strokeWidth={7}/>
                    <circle cx={38} cy={38} r={r} fill="none" stroke={ring.c} strokeWidth={7} strokeDasharray={(Math.min(ring.pct/100,1)*circ)+","+circ} strokeLinecap="round" style={{transition:"stroke-dasharray .7s"}}/>
                  </svg>
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <div style={{fontSize:12,color:ring.c,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{ring.pct+"%"}</div>
                  </div>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{ring.label}</div>
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{ring.sub}</div>
                </div>
              </div>
            ))}
          </div>
          {goals.length>0&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textAlign:"center",marginTop:8,fontStyle:"italic"}}>Goals tracks overall progress — it doesn't affect today's score</div>}
        </Card>}
        {/* Net Worth */}
        <Card style={{cursor:"pointer"}} onClick={()=>setPage("wealth")}>
          <SectionLabel>Net Worth</SectionLabel>
          <div style={{fontSize:isMobile?24:30,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:700,marginBottom:2}}>{fmt(nw)}</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:10}}>{"Target: "+fmt(nwT)+" - "+nwPct+"%"}</div>
          <SparkLine data={[...nwVals,nw]} color={t.GOLD} height={48} labels={nwLabels}/>
          <div style={{marginTop:8}}><PB value={nwPct} color={t.GOLD} height={3}/></div>
          {nwVals.length>=2&&(()=>{const prev=nwVals[nwVals.length-1];const delta=nw-prev;const pct=prev>0?((delta/prev)*100).toFixed(1):0;return delta!==0&&<div style={{fontSize:10,color:delta>0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif",marginTop:6,fontWeight:600}}>{delta>0?"+ ":"- "}{fmt(Math.abs(delta))} this month ({delta>0?"+":""}{pct}%)</div>;})()}
        </Card>
      </div>

      {/* ── ALERTS ── */}
      <div style={{...rowStyle(2),order:isMobile?3:0}}>
      {(()=>{
        const alerts=[];
        const dueToday=(bills||[]).filter(b=>b.nextDue===todayStr());
        if(dueToday.length>0) alerts.push({type:"bill",msg:"Bill due today: "+dueToday[0].name+" ("+fmt(dueToday[0].amount)+")"+(dueToday.length>1?" +"+(dueToday.length-1)+" more":""),page:"bills",color:t.RED});
        const behindGoals=(goals||[]).filter(g=>g.progress<30&&g.period!=="year");
        if(behindGoals.length>0) alerts.push({type:"goal",msg:"Goal behind: "+behindGoals[0].title+" at "+behindGoals[0].progress+"%",page:"goals",color:t.GOLD});
        const missedSupps=(supplements||[]).filter(s=>!s.taken);
        const hour=new Date().getHours();
        if(hour>=18&&missedSupps.length>0) alerts.push({type:"supp",msg:missedSupps.length+" supplement"+(missedSupps.length>1?"s":"")+" not taken today",page:"health",color:t.BLUE});
        const highIncomplete=tasks.filter(tk=>tk.priority==="high"&&!tk.done);
        if(highIncomplete.length>2) alerts.push({type:"task",msg:highIncomplete.length+" high priority tasks incomplete",page:"tasks",color:t.PURPLE});
        return alerts.slice(0,3).map((a,i)=>(
          <div key={i} onClick={()=>setPage(a.page)} style={{padding:"9px 13px",background:hexA(t.CARD,"E6"),border:"1px solid "+a.color+"44",borderRadius:7,display:"flex",alignItems:"center",gap:10,cursor:"pointer",position:"relative",zIndex:1}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:a.color,flexShrink:0}}/>
            <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",flex:1}}>{a.msg}</div>
            <div style={{fontSize:10,color:a.color,fontFamily:"'Montserrat',sans-serif",flexShrink:0}}>View</div>
          </div>
        ));
      })()}
      </div>

      {/* ── ROW 2: Markets + Holdings/Pulse + Bills ── */}
      <div style={{...rowStyle(3),display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:12,order:isMobile?4:0}}>
        {/* Markets */}
        <Card>
          <SectionLabel action={
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              {market.lastUpdated&&<span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{market.lastUpdated.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>}
              <button onClick={market.refresh} style={{background:t.GOLD+"22",border:"1px solid "+t.GOLD+"44",borderRadius:4,padding:"2px 6px",color:t.GOLD,cursor:"pointer",fontSize:10}}>R</button>
              <button onClick={()=>setShowMktEdit(s=>!s)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:4,padding:"2px 6px",color:t.MUTED,cursor:"pointer",fontSize:10}}>Edit</button>
            </div>
          }>Markets</SectionLabel>
          {showMktEdit&&<TickerSearch
            marketTickers={marketTickers}
            setMarketTickers={setMarketTickers}
            DEFAULT_TICKERS={DEFAULT_TICKERS}
            onSave={()=>{setShowMktEdit(false);market.refresh();}}
            onReset={()=>{setMarketTickers(DEFAULT_TICKERS);setShowMktEdit(false);}}
          />}
          {mktRows.map((m,i)=>(
            <div key={m.l}>
              {i>0&&<Divider/>}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0"}}>
                <div>
                  <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:2}}>{m.l}{m.isCrypto&&L().currency!=="USD"&&<span style={{color:t.GOLD,marginLeft:5,fontSize:9}}>{L().currency}</span>}</div>
                  {m.d.loading?<Skeleton width={80} height={14}/>:(m.d.price?<div style={{fontSize:15,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{m.fx?m.d.price?.toFixed(4):(m.isCrypto&&L().currency!=="USD"?L().symbol:"")+m.d.price?.toLocaleString(_locale,{maximumFractionDigits:0})}</div>:<div style={{display:"flex",alignItems:"center",gap:6}}><div style={{fontSize:11,color:t.RED,fontFamily:"'Montserrat',sans-serif"}}>No data</div><button onClick={market.refresh} style={{background:"none",border:"none",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif",padding:0,textDecoration:"underline"}}>retry</button></div>)}
                </div>
                {!m.d.loading&&m.d.price&&<div style={{fontSize:11,color:m.d.pct>=0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{(m.d.pct>=0?"+ ":"- ")+Math.abs(m.d.pct||0).toFixed(2)+"%"}</div>}
              </div>
            </div>
          ))}
        </Card>

        {/* Holdings + Financial Pulse */}
        <Card style={{padding:0,overflow:"hidden",cursor:"pointer"}} onClick={()=>setPage("wealth")}>
          {/* Holdings header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px 8px"}}>
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif"}}>Top Holdings</div>
            {portfolio.lastUpdated?(
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:t.GREEN,animation:"pulse 2s infinite"}}/>
                <span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{portfolio.lastUpdated.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
              </div>
            ):<span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>No holdings</span>}
          </div>
          {/* Holding rows — top 3 by value */}
          {[...holdings].sort((a,b)=>{
            const av=(portfolio.prices?.[a.ticker]?.price||a.avgCost||0)*a.shares;
            const bv=(portfolio.prices?.[b.ticker]?.price||b.avgCost||0)*b.shares;
            return bv-av;
          }).slice(0,3).map((h,i)=>{
            const lp=portfolio.prices?.[h.ticker]?.price;
            const pct=portfolio.prices?.[h.ticker]?.pct||0;
            const val=lp?lp*h.shares:(h.avgCost||0)*h.shares;
            return (
              <div key={h.id}>
                <div style={{height:1,background:t.BORDER}}/>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"33",borderRadius:4,padding:"2px 6px",fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:700,minWidth:48,textAlign:"center"}}>{h.ticker.replace(".AX","")}</div>
                    <div>
                      <div style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{h.name!==h.ticker?h.name.slice(0,14):h.ticker}</div>
                      <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{h.shares+" shares"}</div>
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    {lp?<div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{"$"+lp.toFixed(2)}</div>:<div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>—</div>}
                    <div style={{fontSize:9,color:pct>=0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif"}}>{pct>=0?"▲":"▼"}{Math.abs(pct).toFixed(2)+"%"}</div>
                  </div>
                </div>
              </div>
            );
          })}
          {/* Also show top crypto if no shares */}
          {holdings.length===0&&(cryptoHoldings||[]).slice(0,3).map((h,i)=>{
            const lp=cryptoPortfolio.prices?.[h.symbol||h.ticker]?.price;
            const pct=cryptoPortfolio.prices?.[h.symbol||h.ticker]?.pct||0;
            const val=lp?lp*h.amount:(h.avgCost||0)*h.amount;
            return (
              <div key={h.ticker||i}>
                <div style={{height:1,background:t.BORDER}}/>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{background:t.PURPLE+"18",border:"1px solid "+t.PURPLE+"33",borderRadius:4,padding:"2px 6px",fontSize:9,color:t.PURPLE,fontFamily:"'Montserrat',sans-serif",fontWeight:700,minWidth:48,textAlign:"center"}}>{(h.ticker||h.symbol||"").replace("-USD","")}</div>
                    <div>
                      <div style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{h.amount+" "+(h.ticker||h.symbol||"")}</div>
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    {lp?<div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{"$"+lp.toFixed(2)}</div>:<div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>—</div>}
                    <div style={{fontSize:9,color:pct>=0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif"}}>{pct>=0?"▲":"▼"}{Math.abs(pct).toFixed(2)+"%"}</div>
                  </div>
                </div>
              </div>
            );
          })}
          {holdings.length===0&&(cryptoHoldings||[]).length===0&&(
            <div style={{padding:"14px",textAlign:"center"}}>
              <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>Add holdings in Wealth tab</div>
            </div>
          )}
          {/* Portfolio total */}
          {(holdings.length>0||(cryptoHoldings||[]).length>0)&&(
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 14px",background:t.GOLD+"06",borderTop:"1px solid "+t.BORDER,borderBottom:"1px solid "+t.BORDER}}>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>Portfolio Total</div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                {portfolio.dayChange!==0&&<div style={{fontSize:9,color:portfolio.dayChange>=0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif"}}>{(portfolio.dayChange>=0?"▲ +":"▼ ")+fmt(Math.abs(portfolio.dayChange))}</div>}
                <div style={{fontSize:14,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{fmt((portfolio.totalValue||0)+(cryptoPortfolio.totalValue||0))}</div>
              </div>
            </div>
          )}
          {/* Financial Pulse strip */}
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(4,minmax(0,1fr))"}}>
            {[
              {l:"Net Worth",v:fmt(nw),c:t.GOLD,sub:Math.round(nw/nwT*100)+"% to target",pct:Math.round(nw/nwT*100),pc:t.GOLD},
              {l:"Bills/mo",v:fmt((bills||[]).reduce((s,b)=>{const m={weekly:52/12,fortnightly:26/12,monthly:1,quarterly:1/3,annually:1/12};return s+parseFloat(b.amount)*(m[b.frequency]||1);},0)),c:t.RED,sub:upcoming.length>0?"Next in "+Math.round((new Date(upcoming[0].nextDue+"T12:00:00")-new Date())/864e5)+"d":"All clear",sc:upcoming.length>0?t.MUTED:t.GREEN},
              {l:"Total Debt",v:fmt(profile.totalDebt||0),c:t.RED,sub:profile.totalAssets>0?Math.round((profile.totalDebt||0)/profile.totalAssets*100)+"% LVR":"",pct:profile.totalAssets>0?Math.round((profile.totalDebt||0)/profile.totalAssets*100):0,pc:t.RED},
              {l:"Super",v:fmt(parseFloat(profile.superBalance)||0),c:t.PURPLE,sub:"Balance"},
            ].map((s,i)=>(
              <div key={s.l} style={{padding:"9px 10px",borderRight:i<3?"1px solid "+t.BORDER:"none"}}>
                <div style={{fontSize:8,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>{s.l}</div>
                <div style={{fontSize:13,color:s.c,fontFamily:"'Montserrat',sans-serif",fontWeight:700,lineHeight:1.2}}>{s.v}</div>
                {s.pct!==undefined&&<div style={{height:2,background:t.BORDER,borderRadius:99,overflow:"hidden",marginTop:4}}><div style={{width:Math.min(s.pct,100)+"%",height:"100%",background:s.pc,borderRadius:99}}/></div>}
                <div style={{fontSize:8,color:s.sc||t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>{s.sub}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Bills */}
        <Card style={{cursor:"pointer"}} onClick={()=>setPage("bills")}>
          <SectionLabel action={<span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>Next 7 days</span>}>Bills Due Soon</SectionLabel>
          {!bills||bills.length===0?(
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",padding:"8px 0"}}>No bills tracked yet</div>
          ):upcoming.length===0?(
            <div style={{fontSize:11,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",padding:"8px 0"}}>No bills due in the next 7 days</div>
          ):(
            <div>
              {upcoming.slice(0,4).map((b,i)=>{
                const diff=Math.round((new Date(b.nextDue+"T12:00:00")-new Date())/864e5);
                const urgent=diff===0;
                return (
                  <div key={b.id}>
                    {i>0&&<Divider/>}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0"}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.name}</div>
                        <div style={{fontSize:9,color:urgent?t.RED:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:1}}>{urgent?"Due today":"In "+diff+" day"+(diff!==1?"s":"")}</div>
                      </div>
                      <div style={{fontSize:13,color:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:700,flexShrink:0,marginLeft:8}}>{fmt(b.amount)}</div>
                    </div>
                  </div>
                );
              })}
              {upcoming.length>4&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:6,textAlign:"right"}}>{"+"+(upcoming.length-4)+" more"}</div>}
            </div>
          )}
        </Card>
      </div>

      {/* ── ROW 3: Tasks + Goals + Habits ── */}
      <div style={{...rowStyle(4),display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr 1fr",gap:12,alignItems:"start",order:isMobile?2:0}}>
        {/* Tasks */}
        <Card style={{height:"100%",boxSizing:"border-box"}}>
          <SectionLabel action={<button onClick={()=>setPage("tasks")} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>All tasks</button>}>Priority Actions</SectionLabel>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
            <span>{tDone+"/"+tasks.length+" done"}</span>
            <span>{(tasks.length?Math.round(tDone/tasks.length*100):0)+"%"}</span>
          </div>
          <div style={{marginBottom:10}}><PB value={tasks.length?Math.round(tDone/tasks.length*100):0} color={t.GREEN} height={3}/></div>
          {todayT.length>0&&tDone===todayT.length&&(
            <div style={{textAlign:"center",padding:"8px 0 4px",animation:"scoreUp .5s ease forwards"}}>
              <div style={{fontSize:16,marginBottom:2}}>✦</div>
              <div style={{fontSize:11,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>All tasks complete</div>
            </div>
          )}
          {todayT.slice(0,6).map((tk,i)=>(
            <div key={tk.id}>
              {i>0&&<Divider/>}
              <div onClick={()=>togTask(tk.id)} style={{display:"flex",alignItems:"center",gap:9,padding:"6px 0",cursor:"pointer"}}>
                <div className={tk.done?"tick-pop":""} style={{width:18,height:18,borderRadius:"50%",border:"1.5px solid "+(tk.done?t.GOLD:t.BORDER2),background:tk.done?t.GOLD:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",transition:"background .2s, border-color .2s",position:"relative"}}>
                  {tk.done&&<span style={{fontSize:9,color:"#080808",fontWeight:700,lineHeight:1}}>✓</span>}
                </div>
                <span style={{flex:1,fontSize:12,color:tk.done?t.MUTED:t.TEXT,fontFamily:"'Montserrat',sans-serif",textDecoration:tk.done?"line-through":"none",transition:"color .2s"}}>{tk.text}</span>
                {tk.priority==="high"&&!tk.done&&<div style={{width:6,height:6,borderRadius:"50%",background:t.RED,flexShrink:0}}/>}
              </div>
            </div>
          ))}
          {tasks.length===0&&<div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",padding:"8px 0"}}>No tasks yet</div>}
        </Card>
        {/* Goals */}
        <Card style={{height:"100%",boxSizing:"border-box"}}>
          <SectionLabel action={<button onClick={()=>setPage("goals")} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>All goals</button>}>Goals</SectionLabel>
          {goals.length===0?<div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>No goals set yet</div>:
          goals.slice(0,5).map(g=>{
            const col=CAT_COLORS[g.category]||t.GOLD;
            const daysLeft=g.endDate?Math.ceil((new Date(g.endDate+"T12:00:00")-new Date())/864e5):null;
            const isOverdue=daysLeft!==null&&daysLeft<0;
            const isUrgent=daysLeft!==null&&daysLeft>=0&&daysLeft<=7;
            return (
              <div key={g.id} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <div style={{flex:1,marginRight:8}}>
                    <div style={{fontSize:8,color:col,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:1}}>{g.category}</div>
                    <div style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",lineHeight:1.3}}>{g.title}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:13,color:isOverdue?t.RED:col,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{g.progress+"%"}</div>
                    {daysLeft!==null&&<div style={{fontSize:8,color:isOverdue?t.RED:isUrgent?t.GOLD:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontWeight:isOverdue||isUrgent?600:400}}>{isOverdue?"Overdue "+Math.abs(daysLeft)+"d":daysLeft+"d left"}</div>}
                  </div>
                </div>
                <PB value={g.progress} color={isOverdue?t.RED:col} height={3}/>
              </div>
            );
          })}
        </Card>
        {/* Habits */}
        <Card style={{height:"100%",boxSizing:"border-box"}}>
          <SectionLabel action={<button onClick={()=>setPage("habits")} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>All habits</button>}>Today's Habits</SectionLabel>
          <div style={{display:"flex",flexDirection:"column",gap:0}}>
            {(habits||[]).slice(0,8).map(h=>{
              const done=!!habitLog[h.id+"_"+todayStr()];
              // Calculate per-habit streak
              let streak=0;
              for(let i=0;i<365;i++){
                const d=new Date(Date.now()-i*864e5).toISOString().split("T")[0];
                if(habitLog[h.id+"_"+d])streak++;
                else if(i>0)break;
              }
              return (
                <div key={h.id} onClick={()=>togHabit(h.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid "+t.BORDER,cursor:"pointer"}}>
                  <div style={{width:24,height:24,borderRadius:"50%",background:done?h.color:t.CARD2,border:"1.5px solid "+(done?h.color:t.BORDER2),flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,transition:"all .2s"}} className={done?"tick-pop":""}>
                    {h.icon}
                  </div>
                  <span style={{flex:1,fontSize:11,color:done?t.MUTED:t.TEXT,fontFamily:"'Montserrat',sans-serif",textDecoration:done?"line-through":"none"}}>{h.name}</span>
                  {streak>0&&<div style={{display:"flex",alignItems:"center",gap:2,background:h.color+"22",borderRadius:8,padding:"1px 6px",flexShrink:0}}>
                    <span style={{fontSize:9}}>🔥</span>
                    <span style={{fontSize:9,color:h.color,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{streak}</span>
                  </div>}
                </div>
              );
            })}
          </div>
          <div style={{marginTop:10}}><PB value={(habits||[]).length?Math.round(hDone/(habits||[]).length*100):0} color={t.GOLD} height={3}/></div>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:4,textAlign:"right"}}>{hDone+"/"+(habits||[]).length+" today"}</div>
        </Card>
        {/* Supplements */}
        <Card style={{height:"100%",boxSizing:"border-box"}}>
          <SectionLabel action={<button onClick={()=>setPage("health")} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>All supps</button>}>Supplements</SectionLabel>
          <div style={{display:"flex",flexDirection:"column",gap:0}}>
            {(supplements||[]).slice(0,8).map((s,i)=>(
              <div key={s.id}>
                {i>0&&<Divider/>}
                <div onClick={()=>togSupp(s.id)} style={{display:"flex",alignItems:"center",gap:9,padding:"6px 0",cursor:"pointer"}}>
                  <div style={{width:18,height:18,borderRadius:"50%",border:"1.5px solid "+(s.taken?t.BLUE:t.BORDER2),background:s.taken?t.BLUE:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s",position:"relative"}} className={s.taken?"tick-pop":""}>
                    {s.taken&&<span style={{fontSize:9,color:"#080808",fontWeight:700}}>✓</span>}
                  </div>
                  <span style={{flex:1,fontSize:12,color:s.taken?t.MUTED:t.TEXT,fontFamily:"'Montserrat',sans-serif",textDecoration:s.taken?"line-through":"none",transition:"color .2s"}}>{s.name}</span>
                </div>
              </div>
            ))}
          </div>
          {(supplements||[]).length===0&&<div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",padding:"8px 0"}}>No supplements yet</div>}
          {(supplements||[]).length>0&&<>
            <div style={{marginTop:10}}><PB value={(supplements||[]).length?Math.round(sDone/(supplements||[]).length*100):0} color={t.BLUE} height={3}/></div>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:4,textAlign:"right"}}>{sDone+"/"+(supplements||[]).length+" today"}</div>
          </>}
        </Card>
      </div>

      {/* ── AI ADVISOR BANNER ── */}
      <div style={{...rowStyle(5),order:isMobile?5:0}}>
      <div onClick={()=>setPage("advisor")} style={{background:t.GOLD+"0A",border:"1px solid "+t.GOLD+"22",borderRadius:10,padding:"14px 18px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:9,letterSpacing:2,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>AI Advisor - Full Dashboard Context - Web Search</div>
          <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>Ask for a review, get market insights, or explore investment ideas</div>
        </div>
        <div style={{fontSize:20,color:t.GOLD,marginLeft:16,flexShrink:0}}>✦</div>
      </div>
      </div>
    </div>
  );
}

function TasksPage({tasks,setTasks}){
  const t=T();
  const[newTask,setNewTask]=useState("");
  const[pri,setPri]=useState("medium");
  const[recurring,setRecurring]=useState(false);
  const[recurDays,setRecurDays]=useState([]);
  const DAY_LABELS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const visibleTasks=todayTasks(tasks);
  const done=visibleTasks.filter(tk=>tk.done).length;
  const add=()=>{
    if(!newTask.trim())return;
    setTasks(ts=>[...ts,{id:Date.now(),text:newTask,done:false,priority:pri,recurring,recurDays:recurring&&recurDays.length?recurDays:[]}]);
    setNewTask("");setRecurDays([]);
  };
  const toggleDay=d=>setRecurDays(ds=>ds.includes(d)?ds.filter(x=>x!==d):[...ds,d]);
  const priColors={high:t.RED,medium:t.GOLD,low:t.MUTED};
  const priLabels={high:"High Priority",medium:"Standard",low:"Low Priority"};
  const tasksByPri=pri=>visibleTasks.filter(tk=>tk.priority===pri);
  return (
    <div data-page="true" style={{maxWidth:680,margin:"0 auto"}}>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Daily Execution</div>
        <div style={{fontSize:26,color:t.TEXT,marginBottom:4}}>Today's Actions</div>
        <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{done+" of "+visibleTasks.length+" complete"}</div>
        <div style={{marginTop:8}}><PB value={visibleTasks.length?Math.round(done/visibleTasks.length*100):0} color={t.GREEN} height={3}/></div>
      </div>
      <Card style={{marginBottom:16,padding:"12px 14px"}}>
        <div style={{display:"flex",gap:8,marginBottom:recurring?10:0}}>
          <input value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Add a task..." style={{flex:1,background:"transparent",border:"none",outline:"none",color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontSize:13}}/>
          <Sel value={pri} onChange={e=>setPri(e.target.value)} style={{width:90}}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Sel>
          <button onClick={()=>{setRecurring(r=>!r);setRecurDays([]);}} style={{background:recurring?t.GOLD+"22":"transparent",border:"1px solid "+(recurring?t.GOLD:t.BORDER),borderRadius:6,padding:"6px 10px",color:recurring?t.GOLD:t.MUTED,cursor:"pointer",fontSize:11,fontFamily:"'Montserrat',sans-serif",whiteSpace:"nowrap",flexShrink:0}}>
            {recurring?"Recurring":"Once"}
          </button>
          <Btn onClick={add}>Add</Btn>
        </div>
        {recurring&&(
          <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,flexShrink:0}}>Repeat:</span>
            <button onClick={()=>setRecurDays([])} style={{padding:"3px 9px",borderRadius:12,border:"1px solid "+(recurDays.length===0?t.GOLD:t.BORDER),background:recurDays.length===0?t.GOLD+"22":"transparent",color:recurDays.length===0?t.GOLD:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Daily</button>
            {DAY_LABELS.map((l,i)=>(
              <button key={i} onClick={()=>toggleDay(i)} style={{padding:"3px 9px",borderRadius:12,border:"1px solid "+(recurDays.includes(i)?t.GOLD:t.BORDER),background:recurDays.includes(i)?t.GOLD+"22":"transparent",color:recurDays.includes(i)?t.GOLD:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>{l}</button>
            ))}
          </div>
        )}
      </Card>
      {["high","medium","low"].map(priority=>{
        const ts=visibleTasks.filter(tk=>tk.priority===priority);
        return (
          <div key={priority} style={{marginBottom:18}}>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:priColors[priority]}}/>
              <div style={{fontSize:9,letterSpacing:2,color:priColors[priority],textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif"}}>{priLabels[priority]+" ("+ts.filter(x=>x.done).length+"/"+ts.length+")"}</div>
            </div>
            <Card style={{padding:"2px 0"}}>
              {ts.map((tk,i)=>(
                <div key={tk.id}>
                  {i>0&&<Divider/>}
                  <div onClick={()=>setTasks(ts=>ts.map(x=>x.id===tk.id?{...x,done:!x.done}:x))} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",cursor:"pointer"}}>
                    <div style={{width:19,height:19,borderRadius:"50%",border:"1.5px solid "+(tk.done?t.GOLD:t.BORDER2),background:tk.done?t.GOLD:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {tk.done&&<span style={{fontSize:9,color:"#080808",fontWeight:700}}>V</span>}
                    </div>
                    <span style={{flex:1,fontSize:13,color:tk.done?t.MUTED:t.TEXT,textDecoration:tk.done?"line-through":"none",fontFamily:"'Montserrat',sans-serif"}}>{tk.text}</span>
                    {tk.recurring&&<span style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",background:t.GOLD+"18",borderRadius:10,padding:"1px 6px",flexShrink:0}}>{tk.recurDays?.length?["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].filter((_,i)=>tk.recurDays.includes(i)).join(", "):"daily"}</span>}
                    <button onClick={e=>{e.stopPropagation();setTasks(ts=>ts.filter(x=>x.id!==tk.id));}} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:12,opacity:.5}}>X</button>
                  </div>
                </div>
              ))}
              {!ts.length&&<div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",padding:"8px 12px"}}>{"No "+priLabels[priority].toLowerCase()+" tasks"}</div>}
            </Card>
          </div>
        );
      })}
    </div>
  );
}

function HabitsPage({habits,setHabits,habitLog,setHabitLog}){
  const t=T();
  const isMobile=useIsMobile();
  const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({name:"",icon:"🔥",color:"#C9A84C",target:7,timeOfDay:"morning"});
  const[showEmojiPicker,setShowEmojiPicker]=useState(false);
  const[expandHabit,setExpandHabit]=useState({});
  const[editingHabit,setEditingHabit]=useState(null);
  const[editForm,setEditForm]=useState({});
  const[dragIdx,setDragIdx]=useState(null);
  const[confirmDelete,setConfirmDelete]=useState(null);

  const EMOJIS=[
    // Fitness & Body
    "💪","🏋️","🏃","🚴","🏊","🤸","🧘","🥊","⛹️","🏄","🤾","🚣","🧗","🤺","🏇",
    // Health & Wellness
    "💊","🥗","💧","🍎","🥦","🍳","🫁","❤️","🩺","🧬","🌡️","🫀","🦷","👁️","🩹",
    // Mind & Focus
    "🧠","📚","📖","✍️","🎯","🔬","💡","🎓","📝","🗺️","♟️","🧩","🔭","📐","✏️",
    // Habits & Routine
    "🌅","🌙","☀️","⏰","🛏️","🚿","🪥","🧹","🗓️","✅","🔑","⚡","🔥","💫","✨",
    // Nature & Outdoors
    "🌿","🌳","🌊","🏔️","🌸","🦁","🐯","🦅","🌻","🍃","🌺","🦋","🌈","🏕️","🌾",
    // Food & Drink
    "☕","🫖","🧃","🍵","🥤","🍇","🫐","🍊","🥑","🫚","🧄","🥕","🍓","🫛","🌰",
    // Creativity & Hobbies
    "🎵","🎨","🎸","🎹","📷","🎬","🎭","🎪","🎲","🎮","🧶","🪴","🎺","🥁","🎻",
    // Money & Goals
    "💰","📈","🏆","🥇","🎖️","💎","🏅","👑","🌟","⭐","🎊","🎯","🚀","💸","🪙",
    // Social & Spiritual
    "🙏","🤝","❤️","🫂","🕊️","☮️","🌍","🤲","💝","🙌","👏","🫶","💞","🌐","🕌",
    // No/Stop habits
    "🚫","🍷","🚬","📱","🍕","🍔","🍰","🧁","🍫","🥃",
  ];
  const TIME_GROUPS=["morning","afternoon","evening","anytime"];
  const TIME_LABELS={morning:"Morning",afternoon:"Afternoon",evening:"Evening",anytime:"Anytime"};

  const last7=Array.from({length:7}).map((_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");});
  // last7[6] is always today
  const last30=Array.from({length:30}).map((_,i)=>{const d=new Date();d.setDate(d.getDate()-(29-i));return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");});
  const dayLetters=["S","M","T","W","T","F","S"];

  const getStreak=h=>{
    let s=0;
    for(let i=0;i<365;i++){
      const d=new Date();d.setDate(d.getDate()-i);
      const k=h.id+"_"+d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
      if(habitLog[k])s++;
      else if(i>0)break;
    }
    return s;
  };

  const weekPct=h=>{
    const done=last7.filter(d=>!!habitLog[h.id+"_"+d]).length;
    return Math.min(Math.round(done/h.target*100),100);
  };

  const overallWeekPct=(habits||[]).length?Math.round(
    (habits||[]).reduce((s,h)=>s+weekPct(h),0)/(habits||[]).length
  ):0;

  const tog=(id,date)=>setHabitLog(l=>{const k=id+"_"+date;return{...l,[k]:!l[k]};});

  const addHabit=()=>{
    if(!form.name)return;
    setHabits(hs=>[...hs,{...form,id:Date.now()}]);
    setForm({name:"",icon:"🔥",color:"#C9A84C",target:7,timeOfDay:"morning"});
    setShowAdd(false);setShowEmojiPicker(false);
  };

  const moveUp=i=>{
    if(i===0)return;
    setHabits(hs=>{const n=[...hs];[n[i-1],n[i]]=[n[i],n[i-1]];return n;});
  };
  const openEditHabit=(h)=>{setEditForm({name:h.name,icon:h.icon,color:h.color,target:h.target||7,timeOfDay:h.timeOfDay||"anytime"});setEditingHabit(h.id);};
  const saveEditHabit=()=>{if(!editForm.name.trim())return;setHabits(hs=>hs.map(h=>h.id===editingHabit?{...h,...editForm,target:parseInt(editForm.target)||7}:h));setEditingHabit(null);};
  const moveDown=(i,len)=>{
    if(i===len-1)return;
    setHabits(hs=>{const n=[...hs];[n[i],n[i+1]]=[n[i+1],n[i]];return n;});
  };

  return (
    <div data-page="true" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Daily Discipline</div>
          <div style={{fontSize:26,color:t.TEXT}}>Habit Tracker</div>
        </div>
        <Btn onClick={()=>setShowAdd(s=>!s)}>+ Add</Btn>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:5,marginBottom:8}}>
        {last7.map((d,i)=>{
          const isT=d===todayStr();
          // For each habit, count it as "on track" for this day if:
          // - ticked on this day, OR target already met by cumulative days up to and including this day
          const daysUpToAndIncluding=last7.slice(0,i+1);
          const cnt=(habits||[]).filter(h=>{
            const doneUpTo=daysUpToAndIncluding.filter(dd=>!!habitLog[h.id+"_"+dd]).length;
            const targetMet=doneUpTo>=h.target;
            const tickedToday=!!habitLog[h.id+"_"+d];
            return tickedToday||targetMet;
          }).length;
          const pct=(habits||[]).length?Math.round(cnt/(habits||[]).length*100):0;
          const col=pct>=80?t.GREEN:pct>=50?t.GOLD:pct>0?t.BLUE:t.BORDER;
          return (
            <div key={d} style={{textAlign:"center"}}>
              <div style={{fontSize:9,color:isT?t.GOLD:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontWeight:isT?700:400,marginBottom:4}}>{dayLetters[new Date(d+"T12:00:00").getDay()]}</div>
              <div style={{aspectRatio:"1",borderRadius:6,background:pct>0?col+"33":t.CARD2,border:"1.5px solid "+(isT?t.GOLD:col),display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:9,color:pct>0?col:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{pct>0?pct+"%":"-"}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{"This week: "+overallWeekPct+"% overall compliance"}</div>
        <div style={{display:"flex",gap:8}}>
          {[{c:t.GREEN,l:"80%+"},{c:t.GOLD,l:"50%+"},{c:t.BLUE,l:"1%+"}].map(x=>(
            <div key={x.l} style={{display:"flex",alignItems:"center",gap:3}}>
              <div style={{width:8,height:8,borderRadius:2,background:x.c+"66"}}/>
              <span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{x.l}</span>
            </div>
          ))}
        </div>
      </div>

      {showAdd&&(
        <Card style={{marginBottom:14,borderColor:t.GOLD+"44"}}>
          <SectionLabel>New Habit</SectionLabel>
          <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
            <div style={{position:"relative"}}>
              <button onClick={()=>setShowEmojiPicker(s=>!s)} style={{width:44,height:44,borderRadius:8,border:"1px solid "+t.BORDER,background:t.CARD2,fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {form.icon}
              </button>
              {showEmojiPicker&&(
                <div style={{position:"absolute",top:48,left:0,zIndex:100,background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:10,padding:10,display:"grid",gridTemplateColumns:"repeat(8,minmax(0,1fr))",gap:3,width:280,maxHeight:220,overflowY:"auto",boxShadow:"0 8px 24px rgba(0,0,0,.4)"}}>
                  {EMOJIS.map((e,ei)=>(
                    <button key={ei} onClick={()=>{setForm(f=>({...f,icon:e}));setShowEmojiPicker(false);}} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",padding:4,borderRadius:5,textAlign:"center"}}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Inp value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Habit name" style={{flex:1}}/>
            <input type="color" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))} style={{width:44,height:44,borderRadius:8,border:"1px solid "+t.BORDER,cursor:"pointer",padding:2}}/>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <div style={{flex:1}}>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Days per week target</div>
              <Inp type="number" value={form.target} onChange={e=>setForm(f=>({...f,target:parseInt(e.target.value)||7}))} placeholder="7" style={{fontSize:12}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Time of day</div>
              <Sel value={form.timeOfDay} onChange={e=>setForm(f=>({...f,timeOfDay:e.target.value}))} style={{fontSize:12}}>
                {TIME_GROUPS.map(tg=><option key={tg} value={tg}>{TIME_LABELS[tg]}</option>)}
              </Sel>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn onClick={addHabit}>Add Habit</Btn>
            <Btn onClick={()=>{setShowAdd(false);setShowEmojiPicker(false);}} variant="ghost">Cancel</Btn>
          </div>
        </Card>
      )}

      {TIME_GROUPS.map(timeGroup=>{
        const groupHabits=(habits||[]).filter(h=>(h.timeOfDay||"morning")===timeGroup);
        if(!groupHabits.length)return null;
        return (
          <div key={timeGroup} style={{marginBottom:20}}>
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:10}}>{TIME_LABELS[timeGroup]}</div>
            {groupHabits.map((h,gi)=>{
              const allIdx=(habits||[]).findIndex(x=>x.id===h.id);
              const wDone=last7.filter(d=>!!habitLog[h.id+"_"+d]).length;
              const streak=getStreak(h);
              const pct=weekPct(h);
              const isExpanded=!!expandHabit[h.id];
              return (
                <Card key={h.id} style={{marginBottom:6,padding:"8px 12px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {/* Icon tap to toggle today */}
                    <div onClick={()=>tog(h.id,todayStr())} style={{width:32,height:32,borderRadius:"50%",background:habitLog[h.id+"_"+todayStr()]?h.color:t.CARD2,border:"2px solid "+(habitLog[h.id+"_"+todayStr()]?h.color:t.BORDER2),display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,fontSize:15,transition:"all .2s"}}>
                      {h.icon}
                    </div>
                    {/* Name + streak */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                        <span style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.name}</span>
                        {streak>0&&<div style={{display:"flex",alignItems:"center",gap:2,background:h.color+"22",borderRadius:8,padding:"1px 5px",flexShrink:0}}>
                          <span style={{fontSize:9}}>🔥</span>
                          <span style={{fontSize:9,color:h.color,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{streak}</span>
                        </div>}
                      </div>
                      <PB value={pct} color={pct>=100?t.GREEN:h.color} height={2}/>
                    </div>
                    {/* 7-day dots inline */}
                    <div style={{display:"flex",gap:3,flexShrink:0}}>
                      {last7.map(d=>{
                        const done=!!habitLog[h.id+"_"+d];
                        const isT=d===todayStr();
                        return (
                          <div key={d} onClick={()=>tog(h.id,d)} style={{width:18,height:18,borderRadius:"50%",background:done?h.color:t.CARD2,border:"1.5px solid "+(isT?h.color:done?h.color:t.BORDER2),display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all .15s",flexShrink:0}}>
                            {done&&<span style={{fontSize:8,color:"#080808",fontWeight:700}}>V</span>}
                          </div>
                        );
                      })}
                    </div>
                    {/* Controls */}
                    <div style={{display:"flex",alignItems:"center",gap:3,flexShrink:0}}>
                      <button onClick={()=>setExpandHabit(x=>({...x,[h.id]:!x[h.id]}))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,opacity:.7,padding:"2px 4px"}}>{isExpanded?"^":"v"}</button>
                      <div style={{display:"flex",flexDirection:"column",gap:1}}>
                        <button onClick={()=>moveUp(allIdx)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:8,lineHeight:1,opacity:.5,padding:0}}>▲</button>
                        <button onClick={()=>moveDown(allIdx,(habits||[]).length)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:8,lineHeight:1,opacity:.5,padding:0}}>▼</button>
                      </div>
                      {editingHabit!==h.id&&<button onClick={()=>openEditHabit(h)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,opacity:.6,padding:"2px 4px"}}>Edit</button>}
                    {confirmDelete===h.id?(
                        <div style={{display:"flex",alignItems:"center",gap:4}}>
                          <span style={{fontSize:9,color:t.RED,fontFamily:"'Montserrat',sans-serif"}}>Del?</span>
                          <button onClick={()=>{setHabits(hs=>hs.filter(x=>x.id!==h.id));setConfirmDelete(null);}} style={{background:t.RED+"22",border:"1px solid "+t.RED+"44",borderRadius:4,padding:"1px 5px",color:t.RED,cursor:"pointer",fontSize:9,fontFamily:"'Montserrat',sans-serif"}}>Y</button>
                          <button onClick={()=>setConfirmDelete(null)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:4,padding:"1px 5px",color:t.MUTED,cursor:"pointer",fontSize:9,fontFamily:"'Montserrat',sans-serif"}}>N</button>
                        </div>
                      ):(
                        <button onClick={()=>setConfirmDelete(h.id)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.4,padding:"2px 4px"}}>X</button>
                      )}
                    </div>
                  </div>

                  {editingHabit===h.id&&(
                    <div style={{borderTop:"1px solid "+t.BORDER,marginTop:8,paddingTop:8,display:"flex",flexDirection:"column",gap:8}}>
                      <div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1}}>Edit Habit</div>
                      <Inp value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} placeholder="Habit name..."/>
                      <div style={{display:"flex",gap:7}}>
                        <Sel value={editForm.timeOfDay} onChange={e=>setEditForm(f=>({...f,timeOfDay:e.target.value}))} style={{flex:1}}>
                          {["morning","afternoon","evening","anytime"].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                        </Sel>
                        <div style={{flex:1,display:"flex",gap:5,alignItems:"center"}}>
                          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>Target/wk:</div>
                          <Inp type="number" value={editForm.target} onChange={e=>setEditForm(f=>({...f,target:Math.max(1,Math.min(7,parseInt(e.target.value)||1))}))} style={{width:50,padding:"6px 8px",fontSize:12}}/>
                        </div>
                      </div>
                      <div>
                        <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:6}}>Icon — tap to select</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:3,background:t.CARD2,borderRadius:7,padding:8,maxHeight:160,overflowY:"auto"}}>
                          {EMOJIS.map((e,ei)=>(
                            <button key={ei} onClick={()=>setEditForm(f=>({...f,icon:e}))} style={{background:editForm.icon===e?t.GOLD+"44":"transparent",border:"1.5px solid "+(editForm.icon===e?t.GOLD:"transparent"),borderRadius:6,padding:"4px 5px",cursor:"pointer",fontSize:20,lineHeight:1,transition:"all .15s"}}>
                              {e}
                            </button>
                          ))}
                        </div>
                        {editForm.icon&&<div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:4}}>Selected: <span style={{fontSize:18}}>{editForm.icon}</span></div>}
                      </div>
                      <div>
                        <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:6}}>Colour:</div>
                        <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center"}}>
                          {["#C9A84C","#7A9E7E","#7EB8C9","#B07EC9","#C97E7E","#D4956A","#7EC8A0","#C8D870"].map(col=>(
                            <div key={col} onClick={()=>setEditForm(f=>({...f,color:col}))} style={{width:26,height:26,borderRadius:"50%",background:col,border:"2px solid "+(editForm.color===col?"#fff":"transparent"),cursor:"pointer"}}/>
                          ))}
                          <input type="color" value={editForm.color||"#C9A84C"} onChange={e=>setEditForm(f=>({...f,color:e.target.value}))} title="Choose any colour" style={{width:30,height:30,borderRadius:"50%",border:"1px solid "+t.BORDER,cursor:"pointer",padding:0,background:"none"}}/>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:7}}>
                        <Btn onClick={saveEditHabit}>Save</Btn>
                        <Btn onClick={()=>setEditingHabit(null)} variant="ghost">Cancel</Btn>
                      </div>
                    </div>
                  )}
                  {isExpanded&&(
                    <div style={{borderTop:"1px solid "+t.BORDER,marginTop:8,paddingTop:8}}>
                      <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>90-Day History</div>
                      {/* GitHub-style heatmap */}
                      {(()=>{
                        const days90=Array.from({length:90},(_,i)=>{
                          const d=new Date();d.setDate(d.getDate()-(89-i));
                          return d.toISOString().split("T")[0];
                        });
                        // Group by week
                        const firstDay=new Date(days90[0]);
                        const startPad=firstDay.getDay();
                        const cells=[...Array(startPad).fill(null),...days90];
                        const weeks=[];
                        for(let i=0;i<cells.length;i+=7)weeks.push(cells.slice(i,i+7));
                        // Month labels
                        const monthLabels=[];
                        let lastMonth=-1;
                        weeks.forEach((week,wi)=>{
                          const firstReal=week.find(d=>d);
                          if(firstReal){
                            const m=new Date(firstReal).getMonth();
                            if(m!==lastMonth){monthLabels.push({wi,label:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m]});lastMonth=m;}
                          }
                        });
                        return(
                          <div style={{marginBottom:10}}>
                            {/* Month labels */}
                            <div style={{display:"grid",gridTemplateColumns:"repeat("+weeks.length+",minmax(0,1fr))",marginBottom:2,gap:2}}>
                              {weeks.map((_,wi)=>{
                                const ml=monthLabels.find(m=>m.wi===wi);
                                return <div key={wi} style={{fontSize:7,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{ml?ml.label:""}</div>;
                              })}
                            </div>
                            {/* Grid */}
                            <div style={{display:"grid",gridTemplateColumns:"repeat("+weeks.length+",minmax(0,1fr))",gap:2}}>
                              {weeks.map((week,wi)=>
                                week.map((d,di)=>{
                                  if(!d)return<div key={wi+"-"+di}/>;
                                  const done=!!habitLog[h.id+"_"+d];
                                  const isT=d===todayStr();
                                  return(
                                    <div key={d} onClick={()=>tog(h.id,d)} title={d+(done?" ✓":"")}
                                      style={{aspectRatio:"1",borderRadius:2,background:done?h.color:t.CARD2,border:"1px solid "+(isT?h.color:done?h.color+"55":t.BORDER+"66"),cursor:"pointer",transition:"background .1s",opacity:d>todayStr()?.3:1}}/>
                                  );
                                })
                              )}
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:4,marginTop:6,justifyContent:"flex-end"}}>
                              <span style={{fontSize:8,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>Less</span>
                              {[t.CARD2,h.color+"44",h.color+"88",h.color].map((c,i)=><div key={i} style={{width:9,height:9,borderRadius:2,background:c}}/>)}
                              <span style={{fontSize:8,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>More</span>
                            </div>
                          </div>
                        );
                      })()}
                      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,minmax(0,1fr))",gap:8}}>
                        <div style={{textAlign:"center",padding:"7px",background:t.CARD2,borderRadius:6}}>
                          <div style={{fontSize:16,color:h.color,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{streak}</div>
                          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:1}}>🔥 Streak</div>
                        </div>
                        <div style={{textAlign:"center",padding:"7px",background:t.CARD2,borderRadius:6}}>
                          <div style={{fontSize:16,color:h.color,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{last30.filter(d=>!!habitLog[h.id+"_"+d]).length}</div>
                          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:1}}>Last 30 days</div>
                        </div>
                        <div style={{textAlign:"center",padding:"7px",background:t.CARD2,borderRadius:6}}>
                          <div style={{fontSize:16,color:h.color,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{Math.round(last30.filter(d=>!!habitLog[h.id+"_"+d]).length/30*100)+"%"}</div>
                          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:1}}>30-day rate</div>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        );
      })}
      {!(habits||[]).length&&(
        <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
          <div style={{fontSize:32,marginBottom:10}}>🔥</div>
          <div>No habits yet - tap + Add to start</div>
        </div>
      )}
    </div>
  );
}



const GOAL_CATS=[
  {id:"wealth",label:"Wealth",color:"#C9A84C"},
  {id:"health",label:"Health",color:"#7A9E7E"},
  {id:"career",label:"Career",color:"#7EB8C9"},
  {id:"personal",label:"Personal",color:"#B07EC9"},
  {id:"education",label:"Education",color:"#D4956A"},
  {id:"relationships",label:"Relationships",color:"#C97E7E"},
];

function GoalRing({pct,color,size=52}){
  const t=T();
  const r=size*0.39,circ=2*Math.PI*r,offset=circ-(Math.min(pct,100)/100)*circ;
  return(
    <svg width={size} height={size} viewBox={"0 0 "+size+" "+size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={t.BORDER} strokeWidth={size*0.09}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={size*0.09} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"/>
    </svg>
  );
}

function GoalForm({value,onChange,onSave,onCancel,saveLabel="Create Goal"}){
  const t=T();
  const autoEndDate=(period,start)=>{
    if(!start)return"";
    const d=new Date(start+"T12:00:00");
    if(period==="week")d.setDate(d.getDate()+7);
    else if(period==="month")d.setMonth(d.getMonth()+1);
    else if(period==="quarter")d.setMonth(d.getMonth()+3);
    else if(period==="year")d.setFullYear(d.getFullYear()+1);
    else return"";
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  };
  return(
    <Card style={{marginBottom:14,borderColor:t.GOLD+"44"}}>
      <SectionLabel>{saveLabel==="Create Goal"?"New Goal":"Edit Goal"}</SectionLabel>
      <div style={{display:"flex",flexDirection:"column",gap:9}}>
        <Inp value={value.title||""} onChange={e=>onChange(f=>({...f,title:e.target.value}))} placeholder="What do you want to achieve?"/>
        <div style={{display:"flex",gap:8}}>
          <Sel value={value.category||"wealth"} onChange={e=>onChange(f=>({...f,category:e.target.value}))} style={{flex:1}}>
            {GOAL_CATS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
          </Sel>
          <Sel value={value.period||"year"} onChange={e=>{
            const np=e.target.value;
            onChange(f=>({...f,period:np,endDate:autoEndDate(np,f.startDate||todayStr())}));
          }} style={{flex:1}}>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
            <option value="longterm">Long Term</option>
          </Sel>
        </div>
        <div style={{display:"flex",gap:8}}>
          <div style={{flex:1}}>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Start Date</div>
            <Inp type="date" value={value.startDate||""} onChange={e=>{
              const ns=e.target.value;
              onChange(f=>({...f,startDate:ns,endDate:autoEndDate(f.period||"year",ns)}));
            }}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>End Date (optional)</div>
            <Inp type="date" value={value.endDate||""} onChange={e=>onChange(f=>({...f,endDate:e.target.value}))}/>
          </div>
        </div>
        <Inp value={value.notes||""} onChange={e=>onChange(f=>({...f,notes:e.target.value}))} placeholder="Notes — helps AI suggest better checkpoints (optional)"/>
        <div style={{display:"flex",gap:8}}><Btn onClick={onSave}>{saveLabel}</Btn><Btn onClick={onCancel} variant="ghost">Cancel</Btn></div>
      </div>
    </Card>
  );
}

function GoalsPage({goals,setGoals,completed,setCompleted,profile,subscription,setShowUpgrade,authToken}){
  const t=T();
  const[filter,setFilter]=useState("all");
  const[showAdd,setShowAdd]=useState(false);
  const[showDone,setShowDone]=useState(false);
  const[form,setForm]=useState({title:"",category:"wealth",period:"year",startDate:todayStr(),endDate:"",notes:""});
  const[editingGoalId,setEditingGoalId]=useState(null);
  const[editForm,setEditForm]=useState({});
  const[aiLoading,setAiLoading]=useState(null);
  const[goalSuggestions,setGoalSuggestions]=useState([]);
  const[suggestLoading,setSuggestLoading]=useState(false);
  const[showSuggestions,setShowSuggestions]=useState(false);
  const[confirmDel,setConfirmDel]=useState(null);
  const[addCpGoalId,setAddCpGoalId]=useState(null);
  const[cpForm,setCpForm]=useState({text:"",dueDate:""});
  const[editingCp,setEditingCp]=useState(null); // {goalId, cpId}
  const[editCpForm,setEditCpForm]=useState({text:"",dueDate:""});
  const[collapsed,setCollapsed]=useState({}); // goalId -> bool

  const CATS=GOAL_CATS;
  const catColor=id=>CATS.find(c=>c.id===id)?.color||t.GOLD;
  const catLabel=id=>CATS.find(c=>c.id===id)?.label||id;
  const allGoals=goals||[];
  const filtered=filter==="all"?allGoals:allGoals.filter(g=>g.category===filter);

  const calcProgress=g=>{
    const cps=g.checkpoints||[];
    if(!cps.length)return g.progress||0;
    return Math.round(cps.filter(cp=>cp.done).length/cps.length*100);
  };

  const addGoal=()=>{
    if(!form.title.trim())return;
    const id=Date.now();
    setGoals(gs=>[...gs,{...form,id,progress:0,checkpoints:[]}]);
    setCollapsed(c=>({...c,[id]:false}));
    setForm({title:"",category:"wealth",period:"year",startDate:todayStr(),endDate:"",notes:""});
    setShowAdd(false);
  };

  const saveEditGoal=()=>{
    if(!editForm.title?.trim())return;
    setGoals(gs=>gs.map(g=>g.id===editingGoalId?{...g,...editForm}:g));
    setEditingGoalId(null);
  };

  const addCheckpoint=(goalId)=>{
    if(!cpForm.text.trim())return;
    setGoals(gs=>gs.map(g=>g.id!==goalId?g:{...g,
      checkpoints:[...(g.checkpoints||[]),{id:Date.now(),text:cpForm.text,dueDate:cpForm.dueDate||"",done:false,doneAt:""}]
    }));
    setCpForm({text:"",dueDate:""});
    setAddCpGoalId(null);
  };

  const saveEditCp=()=>{
    if(!editCpForm.text?.trim()||!editingCp)return;
    setGoals(gs=>gs.map(g=>g.id!==editingCp.goalId?g:{...g,
      checkpoints:(g.checkpoints||[]).map(cp=>cp.id!==editingCp.cpId?cp:{...cp,text:editCpForm.text,dueDate:editCpForm.dueDate||""})
    }));
    setEditingCp(null);
  };

  const toggleCheckpoint=(goalId,cpId)=>{
    setGoals(gs=>gs.map(g=>{
      if(g.id!==goalId)return g;
      const cps=(g.checkpoints||[]).map(cp=>cp.id!==cpId?cp:{...cp,done:!cp.done,doneAt:!cp.done?todayStr():""});
      const pct=Math.round(cps.filter(c=>c.done).length/cps.length*100);
      if(pct>=100){
        setTimeout(()=>{
          setGoals(gs2=>gs2.filter(x=>x.id!==goalId));
          setCompleted(cs=>[{...g,checkpoints:cps,progress:100,completedAt:todayStr()},...(cs||[])]);
        },600);
      }
      return{...g,checkpoints:cps,progress:pct};
    }));
  };

  const deleteCheckpoint=(goalId,cpId)=>{
    setGoals(gs=>gs.map(g=>{
      if(g.id!==goalId)return g;
      const cps=(g.checkpoints||[]).filter(cp=>cp.id!==cpId);
      return{...g,checkpoints:cps,progress:cps.length?Math.round(cps.filter(c=>c.done).length/cps.length*100):0};
    }));
  };

  const getSuggestions=async(g)=>{
    if(!isPro(subscription)){setShowUpgrade(true);return;}
    setAiLoading(g.id);
    const nw=parseFloat(profile?.netWorth||0);
    try{
      const r=await claudeFetch({
        model:"claude-haiku-4-5",max_tokens:600,
        system:"Return ONLY a JSON array, no markdown, no explanation.",
        messages:[{role:"user",content:"Goal: \""+g.title+"\" ("+g.period+" goal, "+catLabel(g.category)+"). User age: "+profile?.age+", net worth: $"+Math.round(nw).toLocaleString()+"."+(g.startDate?" Start: "+g.startDate+".":"")+(g.endDate?" End: "+g.endDate+".":"")+(g.notes?" Notes: "+g.notes+".":"")+" Suggest 3-5 specific checkpoints with realistic due dates. Return JSON: [{text, dueDate (YYYY-MM-DD)}]. Be specific, not generic."}]
      });
      const d=await r.json();
      const text=(d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("");
      const s=text.indexOf("["),e=text.lastIndexOf("]");
      if(s>-1&&e>-1){
        const suggs=JSON.parse(text.slice(s,e+1));
        setGoals(gs=>gs.map(x=>x.id!==g.id?x:{...x,
          checkpoints:[...(x.checkpoints||[]),...suggs.map(s=>({id:Date.now()+Math.random(),text:s.text,dueDate:s.dueDate||"",done:false,doneAt:""}))]
        }));
        // Auto-expand to show suggestions
        setCollapsed(c=>({...c,[g.id]:false}));
      }
    }catch(e){console.error(e);}
    setAiLoading(null);
  };

  const onTrack=allGoals.filter(g=>calcProgress(g)>=40).length;
  const behind=allGoals.filter(g=>calcProgress(g)<40).length;

  const getGoalSuggestions=async()=>{
    if(!isPro(subscription)){setShowUpgrade(true);return;}
    setSuggestLoading(true);setShowSuggestions(true);
    try{
      const currentGoalTitles=allGoals.map(g=>g.title).join(", ")||"none";
      const completedTitles=(completed||[]).slice(0,5).map(g=>g.title).join(", ")||"none";
      const r=await claudeFetch({
        model:"claude-haiku-4-5",max_tokens:700,
        system:"Return ONLY a JSON array, no markdown, no explanation.",
        messages:[{role:"user",content:`Goal coach for ${profile?.firstName||"user"}, ${profile?.age||"?"} years old, ${profile?.occupation||""}, ${profile?.location||"Australia"}.
Net worth: $${Math.round(parseFloat(profile?.netWorth||0)).toLocaleString()} of $${Math.round(parseFloat(profile?.netWorthTarget||3000000)).toLocaleString()} target.
Health goals: ${(profile?.healthGoals||[]).join(", ")||"none"}.
Current habits: ${(profile?.currentHabits||[]).join(", ")||"none"}.
Active goals: ${currentGoalTitles}.
Completed goals: ${completedTitles}.
Suggest 4-6 specific, ambitious but achievable goals this person should consider. Mix of: financial, health, career, education, personal. Don't repeat existing goals.
Return JSON: [{title, category (wealth/health/career/education/personal/mindset), period (week/month/year), reason}]. Be specific, not generic.`}]
      });
      const d=await r.json();
      const text=(d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("");
      const s=text.indexOf("["),e=text.lastIndexOf("]");
      if(s>-1&&e>-1)setGoalSuggestions(JSON.parse(text.slice(s,e+1)));
    }catch(err){console.error(err);}
    setSuggestLoading(false);
  };

  const addSuggestedGoal=sg=>{
    const id=Date.now();
    setGoals(gs=>[...gs,{id,title:sg.title,category:sg.category||"personal",period:sg.period||"year",progress:0,checkpoints:[],startDate:todayStr(),endDate:"",notes:sg.reason||""}]);
    setGoalSuggestions(ss=>ss.filter(s=>s.title!==sg.title));
  };

  const catStats=CATS.map(c=>{
    const cg=allGoals.filter(g=>g.category===c.id);
    return{...c,count:cg.length,avg:cg.length?Math.round(cg.reduce((s,g)=>s+calcProgress(g),0)/cg.length):0};
  }).filter(c=>c.count>0);

  return (
    <div data-page="true" style={{maxWidth:720,margin:"0 auto"}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Targets & Milestones</div>
          <div style={{fontSize:26,color:t.TEXT}}>Goals</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:3}}>{allGoals.length+" active · "+onTrack+" on track · "+behind+" behind"}</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {(completed||[]).length>0&&<button onClick={()=>setShowDone(s=>!s)} style={{background:t.CARD,border:"1px solid "+t.GOLD+"44",borderRadius:7,padding:"7px 12px",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>{(completed||[]).length+" done"}</button>}
          <Btn onClick={()=>setShowAdd(s=>!s)}>+ Add</Btn>
        </div>
      </div>

      {/* AI Goal Suggestions */}
      <Card style={{marginBottom:14,border:"1px solid "+t.GOLD+"33"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showSuggestions?12:0}}>
          <div>
            <div style={{fontSize:10,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1}}>✦ AI Goal Suggestions</div>
            <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>Personalised to your profile, habits and patterns</div>
          </div>
          <button onClick={showSuggestions?()=>setShowSuggestions(false):getGoalSuggestions}
            disabled={suggestLoading}
            style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:7,padding:"6px 12px",color:suggestLoading?t.MUTED:t.GOLD,cursor:suggestLoading?"default":"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,whiteSpace:"nowrap"}}>
            {suggestLoading?"Thinking...":(showSuggestions?"Hide":"Get Suggestions")}
          </button>
        </div>
        {suggestLoading&&(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {[85,70,90,75].map((w,i)=><Skeleton key={i} width={w+"%"} height={12}/>)}
          </div>
        )}
        {showSuggestions&&!suggestLoading&&goalSuggestions.length>0&&(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {goalSuggestions.map((sg,i)=>{
              const col=GOAL_CATS.find(c=>c.id===sg.category)?.color||t.GOLD;
              return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:t.CARD2,borderRadius:8,padding:"10px 12px",border:"1px solid "+t.BORDER}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                      <div style={{width:7,height:7,borderRadius:2,background:col,flexShrink:0}}/>
                      <span style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{sg.title}</span>
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:sg.reason?4:0}}>
                      <span style={{fontSize:9,color:col,fontFamily:"'Montserrat',sans-serif",background:col+"18",padding:"1px 6px",borderRadius:4}}>{sg.category}</span>
                      <span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{sg.period}</span>
                    </div>
                    {sg.reason&&<div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontStyle:"italic"}}>{sg.reason}</div>}
                  </div>
                  <button onClick={()=>addSuggestedGoal(sg)}
                    style={{background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:6,padding:"6px 12px",color:"#080808",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:700,flexShrink:0}}>
                    + Add
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {showSuggestions&&!suggestLoading&&goalSuggestions.length===0&&(
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontStyle:"italic"}}>No suggestions — try again or add more goals first.</div>
        )}
      </Card>

      {/* Category rings */}
      {catStats.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat("+Math.min(catStats.length,6)+",1fr)",gap:8,marginBottom:16}}>
          {catStats.map(c=>(
            <div key={c.id} onClick={()=>setFilter(filter===c.id?"all":c.id)} style={{background:filter===c.id?c.color+"18":t.CARD,border:"1px solid "+(filter===c.id?c.color:t.BORDER),borderRadius:9,padding:"10px 6px",textAlign:"center",cursor:"pointer"}}>
              <div style={{position:"relative",width:52,height:52,margin:"0 auto 6px"}}>
                <GoalRing pct={c.avg} color={c.color}/>
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:c.color,fontWeight:700}}>{c.avg+"%"}</div>
              </div>
              <div style={{fontSize:10,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{c.label}</div>
              <div style={{fontSize:8,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:1}}>{c.count+" goal"+(c.count!==1?"s":"")}</div>
            </div>
          ))}
        </div>
      )}

      {/* Add goal form */}
      {showAdd&&<GoalForm value={form} onChange={setForm} onSave={addGoal} onCancel={()=>setShowAdd(false)}/>}

      {/* Filter pills */}
      {allGoals.length>0&&(
        <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:12,scrollbarWidth:"none"}}>
          {[{id:"all",label:"All"},...CATS].map(c=>(
            <button key={c.id} onClick={()=>setFilter(c.id)} style={{flexShrink:0,padding:"4px 12px",borderRadius:14,border:"1px solid "+(filter===c.id?catColor(c.id)||t.GOLD:t.BORDER),background:filter===c.id?(catColor(c.id)||t.GOLD)+"18":"transparent",color:filter===c.id?catColor(c.id)||t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>{c.label}</button>
          ))}
        </div>
      )}

      {/* Goals by period */}
      {["week","month","quarter","year","longterm"].map(period=>{
        const gs=filtered.filter(g=>g.period===period);
        if(!gs.length)return null;
        const periodLabel={week:"This Week",month:"This Month",quarter:"This Quarter",year:"This Year",longterm:"Long Term"};
        return (
          <div key={period} style={{marginBottom:20}}>
            <div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:2,marginBottom:10}}>{periodLabel[period]}</div>
            {gs.map(g=>{
              const col=catColor(g.category);
              const cps=[...(g.checkpoints||[])].sort((a,b)=>{
                if(!a.dueDate&&!b.dueDate)return 0;
                if(!a.dueDate)return 1;
                if(!b.dueDate)return -1;
                return a.dueDate.localeCompare(b.dueDate);
              });
              const pct=calcProgress(g);
              const doneCps=cps.filter(cp=>cp.done).length;
              const isCollapsed=collapsed[g.id]!==false; // default collapsed
              const isEditing=editingGoalId===g.id;

              return (
                <Card key={g.id} style={{marginBottom:10,borderLeft:"3px solid "+col}}>

                  {/* Edit goal form */}
                  {isEditing?(
                    <GoalForm value={editForm} onChange={setEditForm} onSave={saveEditGoal} onCancel={()=>setEditingGoalId(null)} saveLabel="Save Changes"/>
                  ):(
                    <>
                      {/* Goal header — tappable to collapse */}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}
                        onClick={()=>setCollapsed(c=>({...c,[g.id]:!isCollapsed}))}>
                        <div style={{flex:1,marginRight:8}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                            <div style={{fontSize:14,color:t.TEXT}}>{g.title}</div>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{fontSize:9,color:col,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1}}>{catLabel(g.category)}</div>
                            {g.startDate&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
                      {new Date(g.startDate+"T12:00:00").toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"})}
                      {g.endDate?" → "+new Date(g.endDate+"T12:00:00").toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"}):""}
                    </div>}
                          </div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                          <div style={{textAlign:"right"}}>
                            <div style={{fontSize:20,color:col,fontFamily:"'Montserrat',sans-serif",fontWeight:700,lineHeight:1}}>{pct+"%"}</div>
                            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:1}}>{cps.length?doneCps+"/"+cps.length:""}</div>
                          </div>
                          {/* Collapse chevron */}
                          <div style={{color:t.MUTED,fontSize:12,transition:"transform .2s",transform:isCollapsed?"rotate(0deg)":"rotate(180deg)"}}>v</div>
                          {/* Edit + delete — stop propagation */}
                          <div onClick={e=>e.stopPropagation()} style={{display:"flex",gap:5}}>
                            <button onClick={()=>{setEditForm({title:g.title,category:g.category,period:g.period,startDate:g.startDate||todayStr(),endDate:g.endDate||"",notes:g.notes||""});setEditingGoalId(g.id);setCollapsed(c=>({...c,[g.id]:false}));}} style={{background:t.GOLD+"14",border:"1px solid "+t.GOLD+"33",borderRadius:5,padding:"3px 7px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Edit</button>
                            {confirmDel===g.id?(
                              <>
                                <button onClick={()=>{setGoals(gs=>gs.filter(x=>x.id!==g.id));setConfirmDel(null);}} style={{background:t.RED+"22",border:"1px solid "+t.RED+"44",borderRadius:5,padding:"3px 7px",color:t.RED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Yes</button>
                                <button onClick={()=>setConfirmDel(null)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:5,padding:"3px 7px",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>No</button>
                              </>
                            ):(
                              <button onClick={()=>setConfirmDel(g.id)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:12,opacity:.5}}>X</button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Progress bar — always visible */}
                      {cps.length>0&&<div style={{marginTop:8}}><PB value={pct} color={col} height={3}/></div>}

                      {/* Expanded content */}
                      {!isCollapsed&&(
                        <div style={{marginTop:10}}>
                          {/* Checkpoints */}
                          {cps.map((cp,i)=>{
                            const overdue=cp.dueDate&&!cp.done&&new Date(cp.dueDate+"T12:00:00")<new Date();
                            const soon=cp.dueDate&&!cp.done&&!overdue&&Math.round((new Date(cp.dueDate+"T12:00:00")-new Date())/864e5)<=7;
                            const isCpEditing=editingCp?.goalId===g.id&&editingCp?.cpId===cp.id;
                            return (
                              <div key={cp.id}>
                                {i>0&&<Divider/>}
                                {isCpEditing?(
                                  <div style={{padding:"8px 0"}}>
                                    <div style={{display:"flex",gap:7,marginBottom:7}}>
                                      <Inp value={editCpForm.text} onChange={e=>setEditCpForm(f=>({...f,text:e.target.value}))} style={{flex:2,fontSize:12}} onKeyDown={e=>e.key==="Enter"&&saveEditCp()}/>
                                      <Inp type="date" value={editCpForm.dueDate} onChange={e=>setEditCpForm(f=>({...f,dueDate:e.target.value}))} style={{flex:1,fontSize:11}}/>
                                    </div>
                                    <div style={{display:"flex",gap:6}}>
                                      <Btn onClick={saveEditCp} style={{fontSize:11}}>Save</Btn>
                                      <Btn onClick={()=>setEditingCp(null)} variant="ghost" style={{fontSize:11}}>Cancel</Btn>
                                    </div>
                                  </div>
                                ):(
                                  <div style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0"}}>
                                    <div onClick={()=>toggleCheckpoint(g.id,cp.id)} style={{width:20,height:20,borderRadius:"50%",border:"1.5px solid "+(cp.done?col:t.BORDER2),background:cp.done?col:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all .2s"}}>
                                      {cp.done&&<span style={{color:"#080808",fontSize:10,fontWeight:700}}>V</span>}
                                    </div>
                                    <div style={{flex:1,minWidth:0}}>
                                      <div style={{fontSize:12,color:cp.done?t.MUTED:t.TEXT,fontFamily:"'Montserrat',sans-serif",textDecoration:cp.done?"line-through":"none"}}>{cp.text}</div>
                                      {cp.dueDate&&<div style={{fontSize:9,color:cp.done?t.GREEN:overdue?t.RED:soon?"#D4956A":t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:1}}>{cp.done?"Done "+fmtDateNum(cp.doneAt):overdue?"Overdue · "+fmtDateNum(cp.dueDate):soon?"Due soon · "+fmtDateNum(cp.dueDate):"By "+fmtDateNum(cp.dueDate)}</div>}
                                    </div>
                                    <button onClick={()=>{setEditingCp({goalId:g.id,cpId:cp.id});setEditCpForm({text:cp.text,dueDate:cp.dueDate||""});}} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,opacity:.5,flexShrink:0}}>E</button>
                                    <button onClick={()=>deleteCheckpoint(g.id,cp.id)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.4,flexShrink:0}}>X</button>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Add checkpoint row */}
                          {addCpGoalId===g.id?(
                            <div style={{marginTop:8,borderTop:"1px solid "+t.BORDER,paddingTop:10}}>
                              <div style={{display:"flex",gap:7,marginBottom:7}}>
                                <Inp value={cpForm.text} onChange={e=>setCpForm(f=>({...f,text:e.target.value}))} placeholder="Checkpoint..." style={{flex:2,fontSize:12}} onKeyDown={e=>e.key==="Enter"&&addCheckpoint(g.id)}/>
                                <Inp type="date" value={cpForm.dueDate} onChange={e=>setCpForm(f=>({...f,dueDate:e.target.value}))} style={{flex:1,fontSize:11}}/>
                              </div>
                              <div style={{display:"flex",gap:7}}>
                                <Btn onClick={()=>addCheckpoint(g.id)} style={{fontSize:11}}>Add</Btn>
                                <Btn onClick={()=>{setAddCpGoalId(null);setCpForm({text:"",dueDate:""});}} variant="ghost" style={{fontSize:11}}>Cancel</Btn>
                              </div>
                            </div>
                          ):(
                            <div style={{display:"flex",gap:7,marginTop:cps.length>0?10:4}}>
                              <button onClick={()=>{setAddCpGoalId(g.id);setCpForm({text:"",dueDate:""});}} style={{flex:1,background:t.CARD2,border:"1px dashed "+t.BORDER,borderRadius:6,padding:"6px 10px",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,textAlign:"left"}}>+ Add checkpoint</button>
                              <button onClick={()=>getSuggestions(g)} disabled={!!aiLoading} style={{background:t.GOLD+"14",border:"1px solid "+t.GOLD+"33",borderRadius:6,padding:"6px 12px",color:aiLoading===g.id?t.MUTED:t.GOLD,cursor:aiLoading?"default":"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,flexShrink:0,whiteSpace:"nowrap"}}>
                                {aiLoading===g.id?"Thinking...":"AI Suggest"}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </Card>
              );
            })}
          </div>
        );
      })}

      {/* Completed goals */}
      {showDone&&(completed||[]).length>0&&(
        <div style={{marginBottom:16}}>
          <div style={{fontSize:9,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:2,marginBottom:10}}>Completed</div>
          {(completed||[]).map((g,i)=>(
            <div key={g.id||i} style={{background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:9,padding:"10px 14px",marginBottom:7,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:12,color:t.MUTED,textDecoration:"line-through",fontFamily:"'Montserrat',sans-serif"}}>{g.title}</div>
                <div style={{fontSize:9,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>{"Completed "+fmtDateNum(g.completedAt)}</div>
              </div>
              <div style={{fontSize:16,color:t.GREEN}}>V</div>
            </div>
          ))}
        </div>
      )}

      {filtered.length===0&&(
        <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
          <div style={{fontSize:28,marginBottom:10}}>O</div>
          <div style={{fontSize:14,marginBottom:8}}>{filter==="all"?"No goals yet":"No "+filter+" goals"}</div>
          <div style={{fontSize:12,marginBottom:16}}>Add a goal and use AI to build out checkpoints</div>
          <Btn onClick={()=>setShowAdd(true)}>+ Add First Goal</Btn>
        </div>
      )}
    </div>
  );
}


function JournalPage({entries,setEntries}){
  const t=T();
  const[text,setText]=useState("");
  const[mood,setMood]=useState(4);
  const[showNew,setShowNew]=useState(false);
  const[viewing,setViewing]=useState(null);
  const[editingId,setEditingId]=useState(null);
  const[editText,setEditText]=useState("");
  const[editMood,setEditMood]=useState(4);
  const[confirmDel,setConfirmDel]=useState(null);
  const[appending,setAppending]=useState(false);
  const[appendText,setAppendText]=useState("");
  const[search,setSearch]=useState("");
  const[moodFilter,setMoodFilter]=useState("all");

  const td=todayStr();
  const todayEntry=(entries||[]).find(e=>e.date===td);

  const pastEntries=(entries||[])
    .filter(e=>e.date!==td)
    .filter(e=>moodFilter==="all"||e.mood===Number(moodFilter))
    .filter(e=>!search||e.text.toLowerCase().includes(search.toLowerCase())||e.date.includes(search))
    .sort((a,b)=>b.date.localeCompare(a.date));

  const save=()=>{
    if(!text.trim())return;
    setEntries(es=>[{id:Date.now(),date:td,text:text.trim(),mood,updatedAt:todayStr()},...(es||[]).filter(e=>e.date!==td)]);
    setText("");setShowNew(false);
  };

  const saveEdit=(id)=>{
    if(!editText.trim())return;
    setEntries(es=>(es||[]).map(e=>e.id===id?{...e,text:editText.trim(),mood:editMood,updatedAt:todayStr()}:e));
    setEditingId(null);
  };

  const openEdit=(entry)=>{
    setEditText(entry.text);
    setEditMood(entry.mood||4);
    setEditingId(entry.id);
    setAppending(false);
  };

  // Append a new note to today's entry
  const appendToToday=()=>{
    if(!appendText.trim())return;
    const timestamp=new Date().toLocaleTimeString("en-AU",{hour:"2-digit",minute:"2-digit"});
    const newText=(todayEntry.text||"")+"\n\n---  "+timestamp+"  ---\n"+appendText.trim();
    setEntries(es=>(es||[]).map(e=>e.id===todayEntry.id?{...e,text:newText,updatedAt:todayStr()}:e));
    setAppendText("");setAppending(false);
  };

  // View single entry
  if(viewing){
    const entry=(entries||[]).find(x=>x.id===viewing);
    if(!entry){setViewing(null);return null;}
    return (
      <div data-page="true" style={{maxWidth:680,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <button onClick={()=>{setViewing(null);setEditingId(null);}} style={{background:"none",border:"none",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:13}}>Back</button>
          <div style={{display:"flex",gap:8}}>
            {editingId!==entry.id&&<button onClick={()=>openEdit(entry)} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:6,padding:"5px 12px",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>Edit</button>}
            {confirmDel===entry.id?(
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:11,color:t.RED,fontFamily:"'Montserrat',sans-serif"}}>Delete?</span>
                <button onClick={()=>{setEntries(es=>(es||[]).filter(x=>x.id!==entry.id));setViewing(null);setConfirmDel(null);}} style={{background:t.RED+"22",border:"1px solid "+t.RED+"44",borderRadius:5,padding:"3px 8px",color:t.RED,cursor:"pointer",fontSize:11,fontFamily:"'Montserrat',sans-serif"}}>Yes</button>
                <button onClick={()=>setConfirmDel(null)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:5,padding:"3px 8px",color:t.MUTED,cursor:"pointer",fontSize:11,fontFamily:"'Montserrat',sans-serif"}}>No</button>
              </div>
            ):(
              <button onClick={()=>setConfirmDel(entry.id)} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:6,padding:"5px 10px",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,opacity:.7}}>Delete</button>
            )}
          </div>
        </div>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{entry.date}{entry.date===td&&<span style={{color:t.GOLD,marginLeft:6}}>Today</span>}</div>
            {entry.updatedAt&&entry.updatedAt!==entry.date&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>Edited {entry.updatedAt}</div>}
          </div>
          {editingId===entry.id?(
            <div>
              <div style={{display:"flex",gap:5,marginBottom:10}}>
                {MOODS.map(m=><button key={m.v} onClick={()=>setEditMood(m.v)} style={{flex:1,padding:"6px 2px",borderRadius:6,border:"1px solid "+(editMood===m.v?m.c:t.BORDER),background:editMood===m.v?m.c+"22":"transparent",color:editMood===m.v?m.c:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>{m.l}</button>)}
              </div>
              <textarea spellCheck={true} autoCorrect="on" autoCapitalize="sentences" value={editText} onChange={e=>setEditText(e.target.value)} rows={12} style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"10px 12px",color:t.TEXT,fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.85,boxSizing:"border-box"}}/>
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <Btn onClick={()=>saveEdit(entry.id)}>Save Changes</Btn>
                <Btn onClick={()=>setEditingId(null)} variant="ghost">Cancel</Btn>
              </div>
            </div>
          ):(
            <div>
              <div style={{display:"flex",gap:5,marginBottom:14}}>
                {MOODS.map(m=><div key={m.v} style={{padding:"3px 9px",borderRadius:10,background:entry.mood===m.v?m.c+"33":"transparent",border:"1px solid "+(entry.mood===m.v?m.c:t.BORDER),fontSize:10,color:entry.mood===m.v?m.c:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{m.l}</div>)}
              </div>
              <div style={{fontSize:14,color:t.TEXT,lineHeight:1.85,whiteSpace:"pre-wrap",fontFamily:"'Cormorant Garamond',Georgia,serif"}}>{entry.text}</div>
              {/* Append note */}
              {entry.date===td&&(
                appending?(
                  <div style={{marginTop:16,borderTop:"1px solid "+t.BORDER,paddingTop:14}}>
                    <div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Add to today's entry</div>
                    <textarea spellCheck={true} autoCorrect="on" autoCapitalize="sentences" value={appendText} onChange={e=>setAppendText(e.target.value)} placeholder="Continue writing..." rows={5} style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"10px 12px",color:t.TEXT,fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.85,boxSizing:"border-box"}}/>
                    <div style={{display:"flex",gap:8,marginTop:8}}>
                      <Btn onClick={appendToToday}>Append</Btn>
                      <Btn onClick={()=>{setAppending(false);setAppendText("");}} variant="ghost">Cancel</Btn>
                    </div>
                  </div>
                ):(
                  <button onClick={()=>setAppending(true)} style={{marginTop:14,background:t.GOLD+"14",border:"1px solid "+t.GOLD+"33",borderRadius:7,padding:"7px 14px",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,width:"100%"}}>+ Add to this entry</button>
                )
              )}
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div data-page="true" style={{maxWidth:680,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Private Thoughts</div>
          <div style={{fontSize:26,color:t.TEXT}}>Journal</div>
        </div>
        <Btn onClick={()=>setShowNew(s=>!s)}>+ Write</Btn>
      </div>

      {/* Today's entry prompt */}
      {!todayEntry&&!showNew&&(
        <div onClick={()=>setShowNew(true)} style={{background:t.GOLD+"08",border:"1px dashed "+t.GOLD+"44",borderRadius:9,padding:14,cursor:"pointer",textAlign:"center",marginBottom:14}}>
          <div style={{fontSize:12,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",marginBottom:4}}>Today's entry is empty</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontStyle:"italic"}}>{"\""+JP[new Date().getDate()%JP.length]+"\""}</div>
        </div>
      )}

      {/* Today entry exists - quick actions */}
      {todayEntry&&!showNew&&(
        <Card style={{marginBottom:14,borderColor:t.GOLD+"33"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",letterSpacing:2,textTransform:"uppercase"}}>Today</span>
              <span style={{fontSize:10,color:MOODS.find(m=>m.v===todayEntry.mood)?.c||t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{MOODS.find(m=>m.v===todayEntry.mood)?.l}</span>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>{setViewing(todayEntry.id);setAppending(true);}} style={{background:t.GOLD+"14",border:"1px solid "+t.GOLD+"33",borderRadius:6,padding:"4px 10px",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:10}}>+ Add</button>
              <button onClick={()=>openEdit(todayEntry)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:6,padding:"4px 10px",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:10}}>Edit</button>
              <button onClick={()=>setViewing(todayEntry.id)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:6,padding:"4px 10px",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:10}}>Read</button>
            </div>
          </div>
          <div style={{fontSize:12,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",lineHeight:1.65,overflow:"hidden",maxHeight:48}}>{todayEntry.text.slice(0,140)+(todayEntry.text.length>140?"...":"")}</div>
          {/* Inline append */}
          {appending&&(
            <div style={{marginTop:12,borderTop:"1px solid "+t.BORDER,paddingTop:12}}>
              <div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Add to today</div>
              <textarea spellCheck={true} autoCorrect="on" autoCapitalize="sentences" value={appendText} onChange={e=>setAppendText(e.target.value)} placeholder="Continue writing..." rows={4} style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"10px 12px",color:t.TEXT,fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.85,boxSizing:"border-box"}}/>
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <Btn onClick={appendToToday}>Append</Btn>
                <Btn onClick={()=>{setAppending(false);setAppendText("");}} variant="ghost">Cancel</Btn>
              </div>
            </div>
          )}
          {/* Inline edit */}
          {editingId===todayEntry.id&&(
            <div style={{marginTop:12,borderTop:"1px solid "+t.BORDER,paddingTop:12}}>
              <div style={{display:"flex",gap:5,marginBottom:10}}>
                {MOODS.map(m=><button key={m.v} onClick={()=>setEditMood(m.v)} style={{flex:1,padding:"5px 2px",borderRadius:6,border:"1px solid "+(editMood===m.v?m.c:t.BORDER),background:editMood===m.v?m.c+"22":"transparent",color:editMood===m.v?m.c:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>{m.l}</button>)}
              </div>
              <textarea spellCheck={true} autoCorrect="on" autoCapitalize="sentences" value={editText} onChange={e=>setEditText(e.target.value)} rows={8} style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"10px 12px",color:t.TEXT,fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.85,boxSizing:"border-box"}}/>
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <Btn onClick={()=>saveEdit(todayEntry.id)}>Save</Btn>
                <Btn onClick={()=>setEditingId(null)} variant="ghost">Cancel</Btn>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* New entry form */}
      {showNew&&(
        <Card style={{marginBottom:16,borderColor:t.GOLD+"44"}}>
          <div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",letterSpacing:2,marginBottom:4}}>{td}</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontStyle:"italic",marginBottom:10}}>{"\""+JP[new Date().getDate()%JP.length]+"\""}</div>
          <div style={{display:"flex",gap:5,marginBottom:10}}>
            {MOODS.map(m=><button key={m.v} onClick={()=>setMood(m.v)} style={{flex:1,padding:"6px 2px",borderRadius:6,border:"1px solid "+(mood===m.v?m.c:t.BORDER),background:mood===m.v?m.c+"22":"transparent",color:mood===m.v?m.c:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>{m.l}</button>)}
          </div>
          <textarea spellCheck={true} autoCorrect="on" autoCapitalize="sentences" value={text} onChange={e=>setText(e.target.value)} placeholder="Write freely..." rows={7} style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"10px 12px",color:t.TEXT,fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.85,boxSizing:"border-box"}}/>
          <div style={{display:"flex",gap:8,marginTop:10}}><Btn onClick={save}>Save</Btn><Btn onClick={()=>setShowNew(false)} variant="ghost">Cancel</Btn></div>
        </Card>
      )}

      {/* Search + filter */}
      {(entries||[]).length>1&&(
        <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center"}}>
          <div style={{flex:1,position:"relative"}}>
            <input
              value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search entries..."
              style={{width:"100%",background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:8,padding:"8px 12px 8px 32px",color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontSize:12,outline:"none",boxSizing:"border-box"}}
            />
            <div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,opacity:.4}}>S</div>
            {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:12}}>X</button>}
          </div>
          <Sel value={moodFilter} onChange={e=>setMoodFilter(e.target.value)} style={{width:100,flexShrink:0}}>
            <option value="all">All moods</option>
            {MOODS.map(m=><option key={m.v} value={m.v}>{m.l}</option>)}
          </Sel>
        </div>
      )}

      {/* Past entries */}
      {pastEntries.map(entry=>(
        <Card key={entry.id} style={{marginBottom:8,cursor:"pointer"}} onClick={()=>setViewing(entry.id)}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{entry.date}</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:10,color:MOODS.find(m=>m.v===entry.mood)?.c||t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{MOODS.find(m=>m.v===entry.mood)?.l}</span>
              <button onClick={ev=>{ev.stopPropagation();setConfirmDel(entry.id);}} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.5}}>X</button>
            </div>
          </div>
          {confirmDel===entry.id&&(
            <div onClick={e=>e.stopPropagation()} style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
              <span style={{fontSize:11,color:t.RED,fontFamily:"'Montserrat',sans-serif"}}>Delete this entry?</span>
              <button onClick={()=>{setEntries(es=>(es||[]).filter(x=>x.id!==entry.id));setConfirmDel(null);}} style={{background:t.RED+"22",border:"1px solid "+t.RED+"44",borderRadius:5,padding:"2px 7px",color:t.RED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Yes</button>
              <button onClick={()=>setConfirmDel(null)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:5,padding:"2px 7px",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>No</button>
            </div>
          )}
          {/* Highlight search match */}
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",lineHeight:1.6,overflow:"hidden",maxHeight:34}}>
            {entry.text.slice(0,100)+(entry.text.length>100?"...":"")}
          </div>
        </Card>
      ))}

      {pastEntries.length===0&&(entries||[]).length>1&&(
        <div style={{textAlign:"center",padding:32,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
          <div style={{fontSize:13,marginBottom:6}}>No entries match</div>
          <button onClick={()=>{setSearch("");setMoodFilter("all");}} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:6,padding:"5px 12px",color:t.MUTED,cursor:"pointer",fontSize:11,fontFamily:"'Montserrat',sans-serif"}}>Clear filters</button>
        </div>
      )}

      {!(entries||[]).length&&<div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}><div style={{fontSize:32,marginBottom:10}}>J</div><div>No entries yet</div></div>}
    </div>
  );
}

const ALT_CATEGORIES=[
  {id:"watch",label:"Watches",icon:"W",color:"#C9A84C"},
  {id:"art",label:"Art",icon:"A",color:"#B07EC9"},
  {id:"car",label:"Vehicles",icon:"V",color:"#7EB8C9"},
  {id:"wine",label:"Wine / Spirits",icon:"G",color:"#C97E7E"},
  {id:"jewellery",label:"Jewellery",icon:"D",color:"#E8C96A"},
  {id:"cards",label:"Collectables",icon:"C",color:"#7A9E7E"},
  {id:"business",label:"Business Interest",icon:"B",color:"#D4956A"},
  {id:"property",label:"Other Property",icon:"H",color:"#7EB8C9"},
  {id:"other",label:"Other",icon:"O",color:"#6A6050"},
];

function AddAltAssetForm({onAdd}){
  const t=T();
  const[show,setShow]=useState(false);
  const[form,setForm]=useState({name:"",category:"watch",currentValue:"",costBasis:"",description:""});
  const cat=ALT_CATEGORIES.find(c=>c.id===form.category)||ALT_CATEGORIES[0];
  const add=()=>{
    if(!form.name||!form.currentValue)return;
    onAdd({...form,icon:cat.icon,color:cat.color});
    setForm({name:"",category:"watch",currentValue:"",costBasis:"",description:""});
    setShow(false);
  };
  return (
    <div style={{marginTop:12}}>
      {!show?(
        <button onClick={()=>setShow(true)} style={{width:"100%",background:t.CARD2,border:"1px dashed "+t.BORDER,borderRadius:7,padding:"9px",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>+ Add Alternative Asset</button>
      ):(
        <div style={{background:t.CARD2,borderRadius:8,padding:12,border:"1px solid "+t.GOLD+"33"}}>
          <div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>New Alternative Asset</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div style={{display:"flex",gap:8}}>
              <Inp value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Rolex Submariner, Banksy print..." style={{flex:2}}/>
              <Sel value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{flex:1}}>
                {ALT_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
              </Sel>
            </div>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Current Est. Value ($)</div>
                <Inp type="number" value={form.currentValue} onChange={e=>setForm(f=>({...f,currentValue:e.target.value}))} placeholder="e.g. 12500"/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Cost / Purchase Price ($)</div>
                <Inp type="number" value={form.costBasis} onChange={e=>setForm(f=>({...f,costBasis:e.target.value}))} placeholder="e.g. 9800"/>
              </div>
            </div>
            <Inp value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Notes (year, condition, provenance...)"/>
            <div style={{display:"flex",gap:7}}><Btn onClick={add}>Add</Btn><Btn onClick={()=>setShow(false)} variant="ghost">Cancel</Btn></div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddCommodityForm({commodityHoldings,setCommodityHoldings}){
  const t=T();
  const[showAdd,setShowAdd]=useState(false);
  const[mode,setMode]=useState("preset");
  const[selected,setSelected]=useState(null);
  const[form,setForm]=useState({qty:"",avgCost:"",name:"",symbol:"",unit:"oz"});
  const CATS=[
    {label:"Precious Metals",emoji:"🥇",items:["GC=F","SI=F","PL=F","PA=F"]},
    {label:"Energy",emoji:"⚡",items:["CL=F","NG=F"]},
    {label:"Industrial Metals",emoji:"🔩",items:["HG=F"]},
    {label:"Agriculture",emoji:"🌾",items:["ZW=F","ZC=F","ZS=F"]},
  ];
  const alreadyAdded=(commodityHoldings||[]).map(h=>h.ticker);
  const reset=()=>{setForm({qty:"",avgCost:"",name:"",symbol:"",unit:"oz"});setSelected(null);setShowAdd(false);};
  const addPreset=()=>{
    if(!selected||!form.qty)return;
    const base=POPULAR_COMMODITIES.find(c=>c.ticker===selected);
    setCommodityHoldings(cs=>[...(cs||[]),{...base,qty:parseFloat(form.qty),avgCost:form.avgCost?parseFloat(form.avgCost):null}]);
    reset();
  };
  const addCustom=()=>{
    if(!form.name||!form.qty)return;
    const ticker="CUSTOM_"+(form.symbol||form.name).toUpperCase().replace(/\s/g,"_");
    setCommodityHoldings(cs=>[...(cs||[]),{ticker,name:form.name,symbol:form.symbol||form.name.slice(0,3).toUpperCase(),unit:form.unit||"unit",qty:parseFloat(form.qty),avgCost:form.avgCost?parseFloat(form.avgCost):null,isCustom:true}]);
    reset();
  };
  if(!showAdd) return(
    <button onClick={()=>setShowAdd(true)} style={{width:"100%",background:t.CARD2,border:"1px dashed "+t.BORDER,borderRadius:8,padding:"11px",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
      <span style={{fontSize:15,lineHeight:1}}>+</span> Add Commodity
    </button>
  );
  return(
    <div style={{background:t.CARD2,borderRadius:9,padding:"14px",border:"1px solid "+t.GOLD+"33"}}>
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {[{id:"preset",l:"From List"},{id:"custom",l:"Custom"}].map(m=>(
          <button key={m.id} onClick={()=>{setMode(m.id);setSelected(null);}} style={{flex:1,padding:"7px",borderRadius:7,border:"1px solid "+(mode===m.id?t.GOLD:t.BORDER),background:mode===m.id?t.GOLD+"18":"transparent",color:mode===m.id?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>{m.l}</button>
        ))}
      </div>
      {mode==="preset"&&(
        <div>
          {CATS.map(cat=>(
            <div key={cat.label} style={{marginBottom:12}}>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{cat.emoji} {cat.label}</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {cat.items.map(ticker=>{
                  const c=POPULAR_COMMODITIES.find(x=>x.ticker===ticker);
                  if(!c)return null;
                  const added=alreadyAdded.includes(ticker);
                  const isSel=selected===ticker;
                  return(
                    <button key={ticker} disabled={added} onClick={()=>setSelected(isSel?null:ticker)}
                      style={{padding:"6px 13px",borderRadius:16,border:"1px solid "+(isSel?t.GOLD:t.BORDER),background:isSel?t.GOLD+"22":"transparent",color:isSel?t.GOLD:added?t.MUTED:t.TEXT,cursor:added?"default":"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,opacity:added?0.4:1}}>
                      {added?"✓ ":isSel?"● ":""}{c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {selected&&(
            <div style={{display:"flex",gap:7,marginTop:4,alignItems:"flex-end",flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:80}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Qty ({POPULAR_COMMODITIES.find(c=>c.ticker===selected)?.unit})</div>
                <Inp type="number" value={form.qty} onChange={e=>setForm(f=>({...f,qty:e.target.value}))} placeholder="e.g. 10"/>
              </div>
              <div style={{flex:1,minWidth:80}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Avg cost (optional)</div>
                <Inp type="number" value={form.avgCost} onChange={e=>setForm(f=>({...f,avgCost:e.target.value}))} placeholder="$0.00"/>
              </div>
              <Btn onClick={addPreset} disabled={!form.qty}>Add</Btn>
            </div>
          )}
        </div>
      )}
      {mode==="custom"&&(
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          <div style={{display:"flex",gap:7}}>
            <div style={{flex:2}}>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Name</div>
              <Inp value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Rhodium, Carbon Credits"/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Symbol</div>
              <Inp value={form.symbol} onChange={e=>setForm(f=>({...f,symbol:e.target.value}))} placeholder="Rh"/>
            </div>
          </div>
          <div style={{display:"flex",gap:7}}>
            <div style={{flex:1}}>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Quantity</div>
              <Inp type="number" value={form.qty} onChange={e=>setForm(f=>({...f,qty:e.target.value}))} placeholder="0"/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Unit</div>
              <Inp value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))} placeholder="oz, kg, tonne..."/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Value / unit ($)</div>
              <Inp type="number" value={form.avgCost} onChange={e=>setForm(f=>({...f,avgCost:e.target.value}))} placeholder="0.00"/>
            </div>
          </div>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontStyle:"italic"}}>Custom commodities use manual pricing — update value/unit to keep it current</div>
          <Btn onClick={addCustom} disabled={!form.name||!form.qty}>Add Custom</Btn>
        </div>
      )}
      <button onClick={reset} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,marginTop:12,width:"100%",textAlign:"center"}}>Cancel</button>
    </div>
  );
}

function AllocationChart({assets,profile}){
  const t=T();
  const[hov,setHov]=useState(null);
  const activeAssets=assets.filter(a=>a.value>0);
  if(!activeAssets.length)return<div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textAlign:"center",padding:"20px 0"}}>Add assets to see allocation</div>;
  const total=activeAssets.reduce((s,a)=>s+a.value,0)||1;
  const cx=60,cy=60,r=46,stroke=13,circ=2*Math.PI*r;
  let offset=0;
  const segments=activeAssets.map(a=>{
    const pct=a.value/total;
    const seg={...a,pct,da:pct*circ,do_:-offset*circ,color:ASSET_COLORS[a.type]};
    offset+=pct;
    return seg;
  });
  const hovSeg=hov!==null?segments[hov]:null;
  return(
    <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
      <svg width={120} height={120} style={{flexShrink:0}}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={t.BORDER} strokeWidth={stroke}/>
        {segments.map((seg,i)=>(
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color} strokeWidth={hov===i?stroke+3:stroke}
            strokeDasharray={seg.da+" "+circ}
            strokeDashoffset={seg.do_}
            style={{transform:"rotate(-90deg)",transformOrigin:"60px 60px",cursor:"pointer",transition:"stroke-width .15s"}}
            onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)}
          />
        ))}
        <text x={cx} y={cy-6} textAnchor="middle" fill={hovSeg?hovSeg.color:t.GOLD} fontSize={hovSeg?11:10} fontFamily="sans-serif" fontWeight="600">
          {hovSeg?Math.round(hovSeg.pct*100)+"%":"Total"}
        </text>
        <text x={cx} y={cy+9} textAnchor="middle" fill={t.MUTED} fontSize={9} fontFamily="sans-serif">
          {hovSeg?fmt(hovSeg.value):fmt(total)}
        </text>
      </svg>
      <div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
        {segments.map((seg,i)=>(
          <div key={i} onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)}
            style={{cursor:"default",opacity:hov!==null&&hov!==i?.4:1,transition:"opacity .15s"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:7,height:7,borderRadius:2,background:seg.color,flexShrink:0}}/>
                <span style={{fontSize:10,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{ASSET_LABELS[seg.type]}</span>
              </div>
              <span style={{fontSize:10,color:seg.color,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{Math.round(seg.pct*100)+"%"}</span>
            </div>
            <PB value={Math.round(seg.pct*100)} color={seg.color} height={3}/>
          </div>
        ))}
      </div>
    </div>
  );
}

function WealthPage({profile,onUpdateProfile,nwHistory,setShowRecalibrate,holdings,setHoldings,portfolio,cryptoHoldings,setCryptoHoldings,cryptoPortfolio,commodityHoldings,setCommodityHoldings,commodityPortfolio,altAssets,setAltAssets,superLog,setSuperLog}){
  const t=T();
  const isMobile=useIsMobile();
  const[showAdd,setShowAdd]=useState(false);
  const[hForm,setHForm]=useState({ticker:"",shares:"",avgCost:"",name:""});
  const[showCryptoAdd,setShowCryptoAdd]=useState(false);
  const[cSelected,setCSelected]=useState(null);
  const[cAmount,setCAmount]=useState("");
  const[cAvgCost,setCAvgCost]=useState("");
  const[cSearch,setCSearch]=useState("");
  const[editShareId,setEditShareId]=useState(null);
  const[editShareForm,setEditShareForm]=useState({});
  const[editCryptoIdx,setEditCryptoIdx]=useState(null);
  const[editCryptoForm,setEditCryptoForm]=useState({});
  const[showSuperAdd,setShowSuperAdd]=useState(false);
  const[superForm,setSuperForm]=useState({balance:"",type:"balance",date:todayStr(),note:""});
  const[superNewBal,setSuperNewBal]=useState(null);
  const saveShareEdit=(id)=>{
    setHoldings(hs=>(hs||[]).map(h=>h.id!==id?h:{...h,ticker:editShareForm.ticker||h.ticker,shares:parseFloat(editShareForm.shares)||h.shares,avgCost:parseFloat(editShareForm.avgCost)||null,name:editShareForm.name||h.name}));
    setEditShareId(null);
  };
  const saveCryptoEdit=(idx)=>{
    setCryptoHoldings(cs=>(cs||[]).map((h,i)=>i!==idx?h:{...h,id:editCryptoForm.id||h.id,amount:parseFloat(editCryptoForm.amount)||h.amount,avgCost:parseFloat(editCryptoForm.avgCost)||null,name:editCryptoForm.name||h.name}));
    setEditCryptoIdx(null);
  };
  const addCrypto=()=>{
    if(!cSelected||!cAmount)return;
    setCryptoHoldings(cs=>[...(cs||[]).filter(h=>h.ticker!==cSelected.ticker),{ticker:cSelected.ticker,amount:parseFloat(cAmount),avgCost:parseFloat(cAvgCost)||null,name:cSelected.name}]);
    setCSelected(null);setCAmount("");setCAvgCost("");setCSearch("");
    setShowCryptoAdd(false);
  };
  const nw=profile.netWorth||0,nwT=Number(profile.netWorthTarget||3000000);
  const nwHistFull={...nwHistory,[monthStr()]:nw};
  const assets=[
    {type:"shares",value:parseFloat(profile.shareValue)||0},{type:"property",value:parseFloat(profile.propertyValue)||0},
    {type:"super",value:parseFloat(profile.superBalance)||0},{type:"cash",value:parseFloat(profile.cashSavings)||0},
    {type:"crypto",value:parseFloat(profile.cryptoValue)||0},
    {type:"commodities",value:commodityPortfolio?.totalValue||0},
    {type:"alternative",value:(altAssets||[]).reduce((s,a)=>s+(parseFloat(a.currentValue)||0),0)}
  ];
  const debts=[{l:"Mortgage",k:"mortgageDebt"},{l:"Investment Loan",k:"investLoanDebt"},{l:"Car Finance",k:"carDebt"},{l:"Credit Cards",k:"creditCardDebt"},{l:"Personal Loans",k:"personalDebt"}].filter(d=>parseFloat(profile[d.k])>0);
  const safeH=holdings||[];
  const sP=portfolio||{prices:{},totalValue:0,totalGain:0,totalGainPct:0,dayChange:0,lastUpdated:null,refresh:()=>{}};
  const addH=()=>{
    if(!hForm.ticker||!hForm.shares)return;
    const ticker=hForm.ticker.trim().toUpperCase();
    setHoldings(hs=>[...(hs||[]).filter(h=>h.ticker!==ticker),{id:Date.now(),ticker,shares:parseFloat(hForm.shares),avgCost:parseFloat(hForm.avgCost)||null,name:hForm.name||ticker}]);
    setHForm({ticker:"",shares:"",avgCost:"",name:""});setShowAdd(false);
  };
  const nwEntries2=Object.entries(nwHistFull).sort((a,b)=>a[0].localeCompare(b[0]));
  const nwVals=nwEntries2.map(e=>e[1]);
  const nwLabels2=nwEntries2.map(e=>e[0]);
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Wealth Overview</div>
          <div style={{display:"flex",alignItems:"baseline",gap:10}}>
            <div style={{fontSize:32,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{fmt(nw)}</div>
            {safeH.length>0&&sP.totalGain!==0&&<span style={{fontSize:12,color:sP.totalGain>=0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif"}}>{(sP.totalGain>=0?"+ ":"- ")+fmt(Math.abs(sP.totalGain))+" gain"}</span>}
          </div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:3}}>{"Target: "+fmt(nwT)}</div>
        </div>
        <button onClick={()=>setShowRecalibrate(true)} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:7,padding:"7px 12px",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>Recalibrate</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14,marginBottom:14}}>
        <Card>
          <SectionLabel>Net Worth History</SectionLabel>
          <SparkLine data={nwVals} color={t.GOLD} height={60} labels={nwLabels2}/>
          <div style={{marginTop:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{Math.min(Math.round(nw/nwT*100),100)+"% of target"}</span>
              <span style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif"}}>{fmt(nwT-nw)+" to go"}</span>
            </div>
            <PB value={Math.min(Math.round(nw/nwT*100),100)} color={t.GOLD} height={4}/>
          </div>
        </Card>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <Card style={{padding:"12px 14px"}}>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>Net Equity Breakdown</div>
            {[
              {l:"Property",asset:parseFloat(profile.propertyValue)||0,debt:parseFloat(profile.mortgageDebt)||0,c:"#7A9E7E"},
              {l:"Shares",asset:parseFloat(profile.shareValue)||0,debt:parseFloat(profile.investLoanDebt)||0,c:t.GOLD},
              {l:"Super",asset:parseFloat(profile.superBalance)||0,debt:0,c:t.BLUE},
              {l:"Cash",asset:parseFloat(profile.cashSavings)||0,debt:0,c:"#7EB8C9"},
              {l:"Crypto",asset:parseFloat(profile.cryptoValue)||0,debt:0,c:t.PURPLE},
              {l:"Credit Cards",asset:0,debt:parseFloat(profile.creditCardDebt)||0,c:t.RED},
              {l:"Personal Loans",asset:0,debt:parseFloat(profile.personalDebt)||0,c:t.RED},
              {l:"Car Finance",asset:0,debt:parseFloat(profile.carDebt)||0,c:t.RED},
            ].filter(r=>r.asset>0||r.debt>0).map(r=>{
              const equity=r.asset-r.debt;
              return (
                <div key={r.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid "+t.BORDER}}>
                  <div style={{display:"flex",alignItems:"center",gap:7}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:r.c,flexShrink:0}}/>
                    <span style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{r.l}</span>
                    {r.debt>0&&<span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{"(-"+fmt(r.debt)+")"}</span>}
                  </div>
                  <span style={{fontSize:12,color:equity>=0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{(equity>=0?"+":"")+fmt(equity)}</span>
                </div>
              );
            })}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:8,marginTop:4}}>
              <span style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>Net Worth</span>
              <span style={{fontSize:14,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{fmt(nw)}</span>
            </div>
          </Card>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8}}>
            <StatCard label="Annual Income" value={fmt(parseFloat(profile.annualIncome)||0)} color={t.GOLD}/>
            
          </div>
        </div>
      </div>
      <Card style={{marginBottom:14}}>
        <SectionLabel action={
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {safeH.length>0&&sP.lastUpdated&&<span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{sP.lastUpdated.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>}
            {safeH.length>0&&<button onClick={sP.refresh} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"33",borderRadius:4,padding:"2px 6px",color:t.GOLD,cursor:"pointer",fontSize:10}}>Refresh</button>}
            <button onClick={()=>setShowAdd(s=>!s)} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:6,padding:"3px 8px",color:t.GOLD,cursor:"pointer",fontSize:10}}>+ Add</button>
          </div>
        }>Share Portfolio - Live</SectionLabel>
        {showAdd&&(
          <div style={{padding:12,background:t.CARD2,borderRadius:7,border:"1px solid "+t.BORDER,marginBottom:12}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:7,marginBottom:7}}>
              {[["Ticker","ticker","BHP.AX"],["Shares","shares","100"],["Avg Cost","avgCost","45.20"],["Label","name","BHP Group"]].map(([l,k,ph])=>(
                <div key={k}>
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>{l}</div>
                  <Inp value={hForm[k]} onChange={e=>setHForm(f=>({...f,[k]:e.target.value}))} placeholder={ph} style={{fontSize:12,padding:"7px 9px"}}/>
                </div>
              ))}
            </div>
            <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:7}}>ASX: use .AX suffix (BHP.AX, CBA.AX) - US: ticker only (AAPL, TSLA)</div>
            <div style={{display:"flex",gap:7}}><Btn onClick={addH} style={{fontSize:11}}>Add</Btn><Btn onClick={()=>setShowAdd(false)} variant="ghost" style={{fontSize:11}}>Cancel</Btn></div>
          </div>
        )}
        {!safeH.length&&!showAdd&&(
          <div style={{textAlign:"center",padding:"20px 0",color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
            <div style={{fontSize:28,marginBottom:8}}>$</div>
            <div style={{fontSize:12,color:t.TEXT,marginBottom:4}}>No holdings yet</div>
            <div style={{fontSize:11}}>Add stocks to track live prices</div>
          </div>
        )}
        {safeH.length>0&&(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:8,marginBottom:10}}>
            {[
              {l:"Portfolio Value",v:fmt(sP.totalValue||0),c:t.GOLD},
              {l:"Total Gain",v:(sP.totalGain>=0?"+":"")+fmt(sP.totalGain||0),c:(sP.totalGain||0)>=0?t.GREEN:t.RED},
              {l:"Return",v:(sP.totalGainPct>=0?"+":"")+((sP.totalGainPct||0).toFixed(1))+"%",c:(sP.totalGainPct||0)>=0?t.GREEN:t.RED},
            ].map(s=>(
              <div key={s.l} style={{background:t.CARD2,borderRadius:6,padding:"7px 8px",textAlign:"center"}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:2}}>{s.l}</div>
                <div style={{fontSize:13,color:s.c,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{s.v}</div>
              </div>
            ))}
          </div>
        )}
        {safeH.length>0&&(
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{sP.loading?<Skeleton width={120} height={10}/>:sP.lastUpdated?"Updated "+sP.lastUpdated.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"No prices yet"}</div>
            <button onClick={sP.refresh} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"33",borderRadius:4,padding:"2px 8px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Refresh</button>
          </div>
        )}
        {safeH.map((h,i)=>{
          const liveData=sP.prices?.[h.ticker];
          const livePrice=liveData?.price;
          const currentP=livePrice||h.avgCost||0;
          const lv=currentP?currentP*h.shares:null;
          const cb=h.avgCost?h.avgCost*h.shares:null;
          const gain=lv&&cb?lv-cb:null;
          const gainPct=gain&&cb?gain/cb*100:null;
          const dayChange=liveData?.change?liveData.change*h.shares:null;
          return (
            <div key={h.id}>
              {i>0&&<Divider/>}
              {editShareId===h.id?(
                <div style={{padding:"10px 0"}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:7,marginBottom:7}}>
                    {[["Ticker","ticker",h.ticker],["Shares","shares",h.shares],["Avg Cost","avgCost",h.avgCost||""],["Label","name",h.name]].map(([l,k,def])=>(
                      <div key={k}>
                        <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>{l}</div>
                        <Inp value={editShareForm[k]??def} onChange={e=>setEditShareForm(f=>({...f,[k]:e.target.value}))} style={{fontSize:12,padding:"7px 9px"}}/>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:7}}>
                    <Btn onClick={()=>saveShareEdit(h.id)} style={{fontSize:11}}>Save</Btn>
                    <Btn onClick={()=>setEditShareId(null)} variant="ghost" style={{fontSize:11}}>Cancel</Btn>
                  </div>
                </div>
              ):(
                <div style={{padding:"8px 0",display:"flex",alignItems:"center"}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                      <Tag>{h.ticker}</Tag>
                      {h.name!==h.ticker&&<span style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{h.name}</span>}
                      <span style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{h.shares.toLocaleString()+" shares"}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      {livePrice?(
                        <>
                          <span style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{"$"+livePrice.toFixed(2)}</span>
                          {liveData.pct!==0&&<span style={{fontSize:10,color:liveData.pct>=0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif"}}>{(liveData.pct>=0?"+":"")+((liveData.pct)||0).toFixed(2)+"%"}</span>}
                          {dayChange!==null&&<span style={{fontSize:10,color:dayChange>=0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif"}}>{"("+(dayChange>=0?"+":"")+fmt(dayChange)+" today)"}</span>}
                        </>
                      ):(
                        <span style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{sP.loading?<Skeleton width={70} height={12}/>:"No live price"}</span>
                      )}
                      {h.avgCost&&<span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{"avg $"+(parseFloat(h.avgCost)||0).toFixed(2)}</span>}
                    </div>
                    {gain!==null&&(
                      <div style={{marginTop:2}}>
                        <span style={{fontSize:10,color:gain>=0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{(gain>=0?"+ ":"- ")+fmt(Math.abs(gain))+" ("+(gainPct>=0?"+":"")+(gainPct||0).toFixed(1)+"%)"}</span>
                      </div>
                    )}
                  </div>
                  <div style={{textAlign:"right",marginLeft:10}}>
                    {lv&&<div style={{fontSize:14,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{fmt(lv)}</div>}
                    {h.avgCost&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{"cost "+fmt(cb||0)}</div>}
                  </div>
                  <button onClick={()=>{setEditShareId(h.id);setEditShareForm({ticker:h.ticker,shares:h.shares,avgCost:h.avgCost||"",name:h.name});}} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"33",borderRadius:5,padding:"3px 8px",color:t.GOLD,cursor:"pointer",fontSize:10,marginLeft:8}}>Edit</button>
                  <button onClick={()=>setHoldings(hs=>(hs||[]).filter(x=>x.id!==h.id))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:12,marginLeft:6,opacity:.5}}>X</button>
                </div>
              )}
            </div>
          );
        })}
      </Card>

      <Card style={{marginBottom:14}}>
        <SectionLabel action={
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {(cryptoHoldings||[]).length>0&&cryptoPortfolio?.lastUpdated&&<span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{cryptoPortfolio.lastUpdated.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>}
            {(cryptoHoldings||[]).length>0&&<button onClick={cryptoPortfolio?.refresh} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"33",borderRadius:4,padding:"2px 6px",color:t.GOLD,cursor:"pointer",fontSize:10}}>Refresh</button>}
            <button onClick={()=>setShowCryptoAdd(s=>!s)} style={{background:t.PURPLE+"18",border:"1px solid "+t.PURPLE+"44",borderRadius:6,padding:"3px 8px",color:t.PURPLE,cursor:"pointer",fontSize:10}}>+ Add</button>
          </div>
        }>Crypto Portfolio - Live</SectionLabel>
        {showCryptoAdd&&(
          <div style={{padding:12,background:t.CARD2,borderRadius:7,border:"1px solid "+t.BORDER,marginBottom:12}}>
            {!cSelected?(
              <>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Select Coin</div>
                <Inp value={cSearch} onChange={e=>setCSearch(e.target.value)} placeholder="Filter coins..." style={{marginBottom:8,fontSize:12}}/>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:5,maxHeight:200,overflowY:"auto"}}>
                  {POPULAR_COINS.filter(c=>!cSearch||c.name.toLowerCase().includes(cSearch.toLowerCase())||c.ticker.toLowerCase().includes(cSearch.toLowerCase())).map(coin=>(
                    <div key={coin.ticker} onClick={()=>setCSelected(coin)} style={{display:"flex",alignItems:"center",gap:7,padding:"7px 9px",background:t.CARD,borderRadius:6,border:"1px solid "+t.BORDER,cursor:"pointer"}}>
                      <div style={{width:28,height:28,borderRadius:"50%",background:t.PURPLE+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:t.PURPLE,fontWeight:700,flexShrink:0}}>{coin.ticker.slice(0,3)}</div>
                      <div>
                        <div style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{coin.ticker}</div>
                        <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{coin.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{marginTop:8}}><Btn onClick={()=>setShowCryptoAdd(false)} variant="ghost" style={{fontSize:11}}>Cancel</Btn></div>
              </>
            ):(
              <>
                <div style={{display:"flex",alignItems:"center",gap:9,padding:"8px 10px",background:t.CARD,borderRadius:6,border:"1px solid "+t.PURPLE+"44",marginBottom:10}}>
                  <div style={{width:32,height:32,borderRadius:"50%",background:t.PURPLE+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:t.PURPLE,fontWeight:700,flexShrink:0}}>{cSelected.ticker}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{cSelected.name}</div>
                    <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{cSelected.ticker+"-AUD via Yahoo Finance"}</div>
                  </div>
                  <button onClick={()=>setCSelected(null)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11}}>Change</button>
                </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:7,marginBottom:8}}>
                  <div>
                    <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>Amount</div>
                    <Inp type="number" value={cAmount} onChange={e=>setCAmount(e.target.value)} placeholder="0.5" style={{fontSize:12,padding:"7px 9px"}}/>
                  </div>
                  <div>
                    <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>Avg Cost (AUD)</div>
                    <Inp type="number" value={cAvgCost} onChange={e=>setCAvgCost(e.target.value)} placeholder="Optional" style={{fontSize:12,padding:"7px 9px"}}/>
                  </div>
                </div>
                <div style={{display:"flex",gap:7}}>
                  <Btn onClick={addCrypto} disabled={!cAmount} style={{fontSize:11}}>{"Add "+cSelected.name}</Btn>
                  <Btn onClick={()=>setShowCryptoAdd(false)} variant="ghost" style={{fontSize:11}}>Cancel</Btn>
                </div>
              </>
            )}
          </div>
        )}
        {!(cryptoHoldings||[]).length&&!showCryptoAdd&&(
          <div style={{textAlign:"center",padding:"20px 0",color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
            <div style={{fontSize:28,marginBottom:8}}>₿</div>
            <div style={{fontSize:12,color:t.TEXT,marginBottom:4}}>No crypto holdings yet</div>
            <div style={{fontSize:11}}>Add coins to track live AUD prices</div>
          </div>
        )}
        {(cryptoHoldings||[]).length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:8,marginBottom:10}}>
            {[
              {l:"Portfolio Value",v:fmt(cryptoPortfolio?.totalValue||0),c:t.PURPLE},
              {l:"Total Gain",v:(cryptoPortfolio?.totalGain>=0?"+":"")+fmt(cryptoPortfolio?.totalGain||0),c:(cryptoPortfolio?.totalGain||0)>=0?t.GREEN:t.RED},
              {l:"Return",v:(cryptoPortfolio?.totalGainPct>=0?"+":"")+((cryptoPortfolio?.totalGainPct||0).toFixed(1))+"%",c:(cryptoPortfolio?.totalGainPct||0)>=0?t.GREEN:t.RED}
            ].map(s=>(
              <div key={s.l} style={{background:t.CARD2,borderRadius:6,padding:"7px 8px",textAlign:"center"}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:2}}>{s.l}</div>
                <div style={{fontSize:13,color:s.c,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{s.v}</div>
              </div>
            ))}
          </div>
        )}
        {(cryptoHoldings||[]).map((h,i)=>{
          const liveData=cryptoPortfolio?.prices?.[h.symbol||h.ticker];
          const livePrice=liveData?.price;
          const currentP=livePrice||h.avgCost||0;
          const lv=currentP?currentP*h.amount:null;
          const cb=h.avgCost?h.avgCost*h.amount:null;
          const gain=lv&&cb?lv-cb:null;
          const gainPct=gain&&cb?gain/cb*100:null;
          return (
            <div key={h.id+i}>
              {i>0&&<Divider/>}
              {editCryptoIdx===i?(
                <div style={{padding:"10px 0"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:7,marginBottom:7}}>
                    {[["Coin ID","id",h.id],["Amount","amount",h.amount],["Avg Cost","avgCost",h.avgCost||""],["Label","name",h.name||h.id]].map(([l,k,def])=>(
                      <div key={k}>
                        <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>{l}</div>
                        <Inp value={editCryptoForm[k]??def} onChange={e=>setEditCryptoForm(f=>({...f,[k]:e.target.value}))} style={{fontSize:12,padding:"7px 9px"}}/>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:7}}>
                    <Btn onClick={()=>saveCryptoEdit(i)} style={{fontSize:11}}>Save</Btn>
                    <Btn onClick={()=>setEditCryptoIdx(null)} variant="ghost" style={{fontSize:11}}>Cancel</Btn>
                  </div>
                </div>
              ):(
                <div style={{padding:"8px 0",display:"flex",alignItems:"center"}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                      <Tag color={t.PURPLE}>{h.ticker||h.symbol}</Tag>
                      <span style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{h.amount+" "+( h.ticker||h.symbol)}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      {livePrice?(
                        <>
                          <span style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{"$"+livePrice.toFixed(2)}</span>
                          {liveData.pct!==0&&<span style={{fontSize:10,color:liveData.pct>=0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif"}}>{(liveData.pct>=0?"+":"")+((liveData.pct)||0).toFixed(2)+"%"}</span>}
                        </>
                      ):(
                        <span style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{cryptoPortfolio?.loading?<Skeleton width={70} height={12}/>:"No live price"}</span>
                      )}
                      {h.avgCost&&<span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{"avg $"+(parseFloat(h.avgCost)||0).toFixed(2)}</span>}
                    </div>
                    {gain!==null&&(
                      <div style={{marginTop:2}}>
                        <span style={{fontSize:10,color:gain>=0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{(gain>=0?"+ ":"- ")+fmt(Math.abs(gain))+" ("+(gainPct>=0?"+":"")+(gainPct||0).toFixed(1)+"%)"}</span>
                      </div>
                    )}
                  </div>
                  <div style={{textAlign:"right",marginLeft:10}}>
                    {lv&&<div style={{fontSize:14,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{fmt(lv)}</div>}
                    {h.avgCost&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{"cost "+fmt(cb||0)}</div>}
                  </div>
                  <button onClick={()=>{setEditCryptoIdx(i);setEditCryptoForm({id:h.id,amount:h.amount,avgCost:h.avgCost||"",name:h.name||h.id});}} style={{background:t.PURPLE+"18",border:"1px solid "+t.PURPLE+"33",borderRadius:5,padding:"3px 8px",color:t.PURPLE,cursor:"pointer",fontSize:10,marginLeft:8}}>Edit</button>
                  <button onClick={()=>setCryptoHoldings(cs=>(cs||[]).filter(x=>x.ticker!==h.ticker))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:12,marginLeft:6,opacity:.5}}>X</button>
                </div>
              )}
            </div>
          );
        })}
      </Card>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,minmax(0,1fr))",gap:14}}>
        <Card>
          <SectionLabel>Asset Allocation</SectionLabel>
          <AllocationChart assets={assets} profile={profile}/>
        </Card>
        {/* ── COMMODITIES ── */}
        <Card style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <SectionLabel>Commodities</SectionLabel>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              {(commodityHoldings||[]).length>0&&commodityPortfolio?.lastUpdated&&<span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{commodityPortfolio.lastUpdated.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>}
              {(commodityHoldings||[]).length>0&&<button onClick={commodityPortfolio?.refresh} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"33",borderRadius:4,padding:"2px 6px",color:t.GOLD,cursor:"pointer",fontSize:10}}>↻ Refresh</button>}
            </div>
          </div>

          {/* Summary row */}
          {(commodityHoldings||[]).length>0&&(
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,minmax(0,1fr))",gap:8,marginBottom:14}}>
              {[
                {l:"Total Value",v:fmt(commodityPortfolio?.totalValue||0),c:t.GOLD},
                {l:"Total Gain",v:(commodityPortfolio?.totalGain>=0?"+":"")+fmt(commodityPortfolio?.totalGain||0),c:(commodityPortfolio?.totalGain||0)>=0?t.GREEN:t.RED},
                {l:"Return",v:(commodityPortfolio?.totalGainPct>=0?"+":"")+((commodityPortfolio?.totalGainPct||0).toFixed(1))+"%",c:(commodityPortfolio?.totalGainPct||0)>=0?t.GREEN:t.RED},
              ].map(s=>(
                <div key={s.l} style={{background:t.CARD2,borderRadius:7,padding:"8px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>{s.l}</div>
                  <div style={{fontSize:13,color:s.c,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{s.v}</div>
                </div>
              ))}
            </div>
          )}

          {/* Holdings list — card per holding */}
          {(commodityHoldings||[]).length>0&&(
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
              {(commodityHoldings||[]).map((h,i)=>{
                const liveData=commodityPortfolio?.prices?.[h.ticker];
                const livePrice=liveData?.price;
                const isCustom=h.isCustom;
                const currentP=livePrice||parseFloat(h.avgCost)||0;
                const lv=currentP&&h.qty?currentP*h.qty:null;
                const cb=h.avgCost&&h.qty?parseFloat(h.avgCost)*h.qty:null;
                const gain=lv&&cb?lv-cb:null;
                const gainPct=gain&&cb?(gain/cb*100):null;
                const col=gain>=0?t.GREEN:t.RED;
                return(
                  <div key={h.ticker+i} style={{background:t.CARD2,borderRadius:9,padding:"12px 14px",border:"1px solid "+t.BORDER}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
                          <div style={{background:t.GOLD+"22",border:"1px solid "+t.GOLD+"44",borderRadius:5,padding:"2px 8px",fontSize:10,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{h.symbol||h.ticker}</div>
                          <span style={{fontSize:13,color:t.TEXT}}>{h.name}</span>
                          {isCustom&&<span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:4,padding:"1px 5px"}}>custom</span>}
                        </div>
                        <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:4}}>{h.qty+" "+h.unit+(h.avgCost?" · avg $"+parseFloat(h.avgCost).toFixed(2)+"/"+h.unit:"")}</div>
                        {livePrice?(
                          <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            <span style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>${parseFloat(livePrice).toFixed(2)}/{h.unit}</span>
                            {liveData?.pct!=null&&<span style={{fontSize:11,color:liveData.pct>=0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif"}}>{liveData.pct>=0?"▲":"▼"} {Math.abs(liveData.pct).toFixed(2)}%</span>}
                          </div>
                        ):isCustom?(
                          <span style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>Manual value · ${parseFloat(h.avgCost||0).toFixed(2)}/{h.unit}</span>
                        ):(
                          <span style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{commodityPortfolio?.loading?<Skeleton width={70} height={12}/>:"No live price available"}</span>
                        )}
                      </div>
                      <div style={{textAlign:"right",marginLeft:12}}>
                        {lv!=null&&<div style={{fontSize:15,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{fmt(lv)}</div>}
                        {gain!=null&&<div style={{fontSize:11,color:col,fontFamily:"'Montserrat',sans-serif"}}>{gain>=0?"+":""}{fmt(gain)} ({gainPct>=0?"+":""}{(gainPct||0).toFixed(1)}%)</div>}
                        <button onClick={()=>setCommodityHoldings(cs=>(cs||[]).filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,marginTop:4,opacity:.5}}>✕ Remove</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <AddCommodityForm commodityHoldings={commodityHoldings} setCommodityHoldings={setCommodityHoldings}/>
        </Card>

        {/* ── ALTERNATIVE ASSETS ── */}
        <Card style={{marginBottom:12}}>
          <SectionLabel>Alternative Assets</SectionLabel>
          <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:12}}>Watches, art, collectables, wine, cars, business interests — manually valued</div>

          {/* Alt asset list */}
          {(altAssets||[]).map((a,i)=>{
            const gain=(parseFloat(a.currentValue)||0)-(parseFloat(a.costBasis)||0);
            const gainPct=a.costBasis&&parseFloat(a.costBasis)>0?gain/parseFloat(a.costBasis)*100:null;
            return (
              <div key={a.id}>
                {i>0&&<Divider/>}
                <div style={{display:"flex",alignItems:"center",padding:"8px 0"}}>
                  <div style={{width:32,height:32,borderRadius:8,background:a.color+"22",border:"1px solid "+a.color+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0,marginRight:10}}>{a.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                      <span style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:500}}>{a.name}</span>
                      <span style={{fontSize:9,color:a.color,fontFamily:"'Montserrat',sans-serif",background:a.color+"14",padding:"1px 5px",borderRadius:3,textTransform:"uppercase",letterSpacing:.5}}>{a.category}</span>
                    </div>
                    {a.description&&<div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:2}}>{a.description}</div>}
                    {gain!==0&&a.costBasis&&<div style={{fontSize:10,color:gain>=0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif"}}>
                      {(gain>=0?"+ ":"- ")+fmt(Math.abs(gain))+(gainPct!==null?" ("+gainPct.toFixed(1)+"%)":"")}
                    </div>}
                    <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:1}}>{"Updated "+a.updatedAt}</div>
                  </div>
                  <div style={{textAlign:"right",marginLeft:10}}>
                    <div style={{fontSize:14,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{fmt(parseFloat(a.currentValue)||0)}</div>
                    {a.costBasis&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{"cost "+fmt(parseFloat(a.costBasis)||0)}</div>}
                  </div>
                  <button onClick={()=>{
                    const newVal=prompt("Update current value for "+a.name+":",a.currentValue||"");
                    if(newVal!==null&&!isNaN(parseFloat(newVal)))
                      setAltAssets(as=>(as||[]).map(x=>x.id===a.id?{...x,currentValue:parseFloat(newVal),updatedAt:todayStr()}:x));
                  }} style={{background:t.GOLD+"14",border:"1px solid "+t.GOLD+"33",borderRadius:5,padding:"3px 7px",color:t.GOLD,cursor:"pointer",fontSize:10,marginLeft:8}}>Update</button>
                  <button onClick={()=>setAltAssets(as=>(as||[]).filter(x=>x.id!==a.id))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,marginLeft:6,opacity:.5}}>X</button>
                </div>
              </div>
            );
          })}

          {/* Total */}
          {(altAssets||[]).length>0&&(
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderTop:"1px solid "+t.BORDER,marginTop:4}}>
              <span style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>Total Alternative Assets</span>
              <span style={{fontSize:14,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{fmt((altAssets||[]).reduce((s,a)=>s+(parseFloat(a.currentValue)||0),0))}</span>
            </div>
          )}

          {/* Add form */}
          <AddAltAssetForm onAdd={a=>setAltAssets(as=>[...(as||[]),{...a,id:Date.now(),updatedAt:todayStr()}])}/>
        </Card>

        {/* ── SUPERANNUATION ── */}
        <Card style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <SectionLabel>Superannuation</SectionLabel>
            <button onClick={()=>setShowSuperAdd(s=>!s)} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:6,padding:"5px 11px",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>+ Update Balance</button>
          </div>

          {/* Current balance */}
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,minmax(0,1fr))",gap:8,marginBottom:14}}>
            {[
              {l:"Current Balance",v:fmt(parseFloat(profile.superBalance)||0),c:t.PURPLE},
              {l:"Total Contributed",v:fmt(superLog.reduce((s,e)=>s+(e.type==="contribution"?e.amount:0),0)),c:t.GOLD},
              {l:"Growth",v:(()=>{const contrib=superLog.reduce((s,e)=>s+(e.type==="contribution"?e.amount:0),0);const bal=parseFloat(profile.superBalance)||0;const gain=bal-contrib;return (gain>=0?"+":"")+fmt(gain);})(),c:t.GREEN},
            ].map(s=>(
              <div key={s.l} style={{background:t.CARD2,borderRadius:6,padding:"8px",textAlign:"center"}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>{s.l}</div>
                <div style={{fontSize:14,color:s.c,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Add balance update form */}
          {showSuperAdd&&(
            <div style={{background:t.CARD2,borderRadius:8,padding:12,marginBottom:12,border:"1px solid "+t.GOLD+"33"}}>
              <div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Update Super</div>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <div style={{flex:2}}>
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>New Balance ($)</div>
                  <Inp type="number" value={superForm.balance} onChange={e=>setSuperForm(f=>({...f,balance:e.target.value}))} placeholder={profile.superBalance||"0"}/>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Type</div>
                  <Sel value={superForm.type} onChange={e=>setSuperForm(f=>({...f,type:e.target.value}))}>
                    <option value="balance">Balance Update</option>
                    <option value="contribution">Contribution</option>
                    <option value="employer">Employer Contribution</option>
                    <option value="growth">Investment Growth</option>
                  </Sel>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Date</div>
                  <Inp type="date" value={superForm.date} onChange={e=>setSuperForm(f=>({...f,date:e.target.value}))}/>
                </div>
              </div>
              <Inp value={superForm.note} onChange={e=>setSuperForm(f=>({...f,note:e.target.value}))} placeholder="Note (e.g. Q1 statement, employer SG...)" style={{marginBottom:8}}/>
              <div style={{display:"flex",gap:7}}>
                <Btn onClick={()=>{
                  if(!superForm.balance)return;
                  const amount=parseFloat(superForm.balance);
                  const prev=parseFloat(profile.superBalance)||0;
                  const diff=amount-prev;
                  setSuperLog(sl=>[{id:Date.now(),date:superForm.date,balance:amount,amount:Math.abs(diff),change:diff,type:superForm.type,note:superForm.note},...sl]);
                  // Update profile balance
                  profile.superBalance=String(amount);
                  const tA=(parseFloat(profile.shareValue)||0)+(parseFloat(profile.propertyValue)||0)+(parseFloat(profile.cashSavings)||0)+amount+(parseFloat(profile.cryptoValue)||0);
                  const tD=(parseFloat(profile.mortgageDebt)||0)+(parseFloat(profile.investLoanDebt)||0)+(parseFloat(profile.carDebt)||0)+(parseFloat(profile.creditCardDebt)||0)+(parseFloat(profile.personalDebt)||0);
                  if(onUpdateProfile)onUpdateProfile({...profile,superBalance:String(amount),totalAssets:tA,netWorth:tA-tD});
                  setSuperForm({balance:"",type:"balance",date:todayStr(),note:""});
                  setShowSuperAdd(false);
                }} style={{fontSize:11}}>Save</Btn>
                <Btn onClick={()=>setShowSuperAdd(false)} variant="ghost" style={{fontSize:11}}>Cancel</Btn>
              </div>
            </div>
          )}

          {/* Balance history chart */}
          {superLog.length>=2&&(()=>{
            const entries=[...superLog].sort((a,b)=>a.date.localeCompare(b.date)).slice(-12);
            const vals=entries.map(e=>e.balance);
            const mn=Math.min(...vals)*0.98, mx=Math.max(...vals)*1.01;
            const W=280,H=70,pad=6;
            const px=i=>pad+(i/(entries.length-1||1))*(W-pad*2);
            const py=v=>H-pad-(((v-mn)/(mx-mn||1))*(H-pad*2));
            const pts=entries.map((e,i)=>`${px(i)},${py(e.balance)}`).join(" ");
            return (
              <div style={{marginBottom:12}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:6}}>Balance History</div>
                <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:H}}>
                  <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={t.PURPLE} stopOpacity=".25"/><stop offset="100%" stopColor={t.PURPLE} stopOpacity="0"/></linearGradient></defs>
                  <polygon points={`${pts} ${px(entries.length-1)},${H} ${px(0)},${H}`} fill="url(#sg)"/>
                  <polyline points={pts} fill="none" stroke={t.PURPLE} strokeWidth="1.5" strokeLinejoin="round"/>
                  <circle cx={px(entries.length-1)} cy={py(entries[entries.length-1].balance)} r="3" fill={t.PURPLE}/>
                </svg>
              </div>
            );
          })()}

          {/* Log entries */}
          {superLog.length>0&&(
            <div>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>History</div>
              {superLog.slice(0,5).map((e,i)=>(
                <div key={e.id||i}>
                  {i>0&&<Divider/>}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0"}}>
                    <div>
                      <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{e.type==="balance"?"Balance Update":e.type==="contribution"?"Personal Contribution":e.type==="employer"?"Employer Contribution":"Investment Growth"}</div>
                      <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:1}}>{new Date(e.date+"T12:00:00").toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"})}{e.note?" · "+e.note:""}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:13,color:t.PURPLE,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{fmt(e.balance)}</div>
                      {e.change!==0&&<div style={{fontSize:10,color:e.change>0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif"}}>{(e.change>0?"+":"")+fmt(e.change)}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {superLog.length===0&&(
            <div style={{textAlign:"center",padding:"12px 0",color:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontSize:11}}>Tap + Update Balance to track your super growth over time</div>
          )}
        </Card>

        <Card>
          <SectionLabel>Liabilities</SectionLabel>
          {debts.map((d,i)=>(
            <div key={d.k}>
              {i>0&&<Divider/>}
              <div style={{display:"flex",justifyContent:"space-between",padding:"7px 0"}}>
                <span style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{d.l}</span>
                <span style={{fontSize:12,color:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{"-"+fmt(parseFloat(profile[d.k]))}</span>
              </div>
            </div>
          ))}
          <Divider/>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:13,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>Total Debt</span>
            <span style={{fontSize:13,color:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{"-"+fmt(profile.totalDebt||0)}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ProjectorPage({profile}){
  const t=T();
  const isMobile=useIsMobile();
  const[sr,setSr]=useState(35);
  const[rr,setRr]=useState(8);
  const[yrs,setYrs]=useState(10);
  const[hovYear,setHovYear]=useState(null);

  const proj=(s,r,y)=>{
    let nw=profile.netWorth||0;
    const a=[nw];
    for(let i=1;i<=y;i++){
      nw=nw*(1+r/100)+(parseFloat(profile.annualIncome)||0)*(s/100);
      a.push(Math.round(nw));
    }
    return a;
  };

  const base=proj(sr,rr,yrs);
  const bull=proj(sr+5,rr+2,yrs);
  const bear=proj(Math.max(sr-10,5),Math.max(rr-3,2),yrs);
  const pj=base[base.length-1];
  const targetNW=parseFloat(profile.netWorthTarget)||3000000;
  const currentNW=profile.netWorth||0;

  // Find year when base scenario hits target
  const yearsToTarget=base.findIndex(v=>v>=targetNW);
  const willHitTarget=yearsToTarget>0;

  const allV=[...base,...bull,targetNW];
  const maxV=Math.max(...allV)*1.05;
  const minV=Math.max(0,currentNW*0.9);
  const W=320,H=130,p=8;
  const px=i=>p+(i/yrs)*(W-p*2);
  const py=v=>H-p-((v-minV)/(maxV-minV||1))*(H-p*2);
  const mk=data=>data.map((v,i)=>(i===0?"M":"L")+px(i).toFixed(1)+","+py(v).toFixed(1)).join(" ");

  const controls=[
    {l:"Savings Rate",v:sr,set:setSr,min:5,max:70,step:5,sub:fmt(Math.round((parseFloat(profile.annualIncome)||0)*sr/100))+"/yr"},
    {l:"Return Rate",v:rr,set:setRr,min:2,max:20,step:1,sub:"% p.a. on investments"},
    {l:"Time Horizon",v:yrs,set:setYrs,min:3,max:30,step:1,sub:"To "+(new Date().getFullYear()+yrs)}
  ];

  const hasData=(profile.annualIncome&&parseFloat(profile.annualIncome)>0)||(profile.netWorth&&parseFloat(profile.netWorth)>0);

  return(
    <div data-page="true" style={{maxWidth:680,margin:"0 auto"}}>
      <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Wealth Planning</div>
      <div style={{fontSize:26,color:t.TEXT,marginBottom:20}}>Wealth Forecast</div>

      {!hasData&&(
        <Card style={{marginBottom:14,textAlign:"center",padding:32}}>
          <div style={{fontSize:32,marginBottom:12}}>📈</div>
          <div style={{fontSize:16,color:t.TEXT,marginBottom:8}}>Add your financial data first</div>
          <div style={{fontSize:12,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",lineHeight:1.7}}>Add your income and current net worth in Profile to see a personalised forecast.</div>
        </Card>
      )}

      {/* Outcome cards */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,minmax(0,1fr))",gap:10,marginBottom:14}}>
        {[
          {l:"Base Case",v:fmt(pj),c:t.GOLD,sub:"in "+yrs+" yrs"},
          {l:"Bull Case",v:fmt(bull[bull.length-1]),c:t.GREEN,sub:"+"+Math.round((bull[bull.length-1]-currentNW)/currentNW*100||0)+"%"},
          {l:"Bear Case",v:fmt(bear[bear.length-1]),c:t.RED,sub:"+"+Math.round((bear[bear.length-1]-currentNW)/currentNW*100||0)+"%"},
        ].map(s=>(
          <Card key={s.l} style={{textAlign:"center",padding:"12px 8px"}}>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:4,letterSpacing:1}}>{s.l.toUpperCase()}</div>
            <div style={{fontSize:16,color:s.c,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{s.v}</div>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>{s.sub}</div>
          </Card>
        ))}
      </div>

      {/* Target callout */}
      {targetNW>0&&(
        <Card style={{marginBottom:14,background:willHitTarget?t.GREEN+"0A":t.RED+"0A",border:"1px solid "+(willHitTarget?t.GREEN:t.RED)+"33"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:11,color:willHitTarget?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600,marginBottom:3}}>
                {willHitTarget?"✓ On track to hit target":"✗ Won't hit target in this period"}
              </div>
              <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>
                {willHitTarget
                  ?`You'll reach ${fmt(targetNW)} in approximately ${yearsToTarget} year${yearsToTarget!==1?"s":""}`
                  :`Increase savings rate or extend the time horizon to reach ${fmt(targetNW)}`
                }
              </div>
            </div>
            <div style={{fontSize:28,marginLeft:12}}>{willHitTarget?"🎯":"📍"}</div>
          </div>
        </Card>
      )}

      {/* Chart */}
      <Card style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <SectionLabel>Projection</SectionLabel>
          <div style={{display:"flex",gap:12}}>
            {[{c:t.GREEN,l:"Bull"},{c:t.GOLD,l:"Base"},{c:t.RED,l:"Bear"}].map(x=>(
              <div key={x.l} style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:16,height:2,background:x.c}}/>
                <span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{x.l}</span>
              </div>
            ))}
          </div>
        </div>
        <svg viewBox={"0 0 "+W+" "+H} style={{width:"100%",height:H+30,overflow:"visible"}}
          onMouseLeave={()=>setHovYear(null)}>
          {/* Target line */}
          {targetNW<maxV&&targetNW>minV&&(
            <>
              <line x1={p} y1={py(targetNW)} x2={W-p} y2={py(targetNW)} stroke={t.GOLD} strokeWidth="1" strokeDasharray="3,3" opacity=".4"/>
              <text x={W-p} y={py(targetNW)-3} fill={t.GOLD} fontSize="7" textAnchor="end" fontFamily="sans-serif" opacity=".7">Target {fmt(targetNW)}</text>
            </>
          )}
          {/* Paths */}
          <path d={mk(bear)} fill="none" stroke={t.RED} strokeWidth="1.5" strokeDasharray="4,3" opacity=".6"/>
          <path d={mk(bull)} fill="none" stroke={t.GREEN} strokeWidth="1.5" strokeDasharray="4,3" opacity=".7"/>
          <path d={mk(base)} fill="none" stroke={t.GOLD} strokeWidth="2.5"/>
          {/* Year labels */}
          {[0,Math.floor(yrs/2),yrs].map(i=>(
            <text key={i} x={px(i)} y={H+14} fill={t.MUTED} fontSize="8" textAnchor="middle" fontFamily="sans-serif">
              {new Date().getFullYear()+i}
            </text>
          ))}
          {/* Hover zones */}
          {base.map((_,i)=>(
            <rect key={i} x={px(i)-8} y={0} width={16} height={H} fill="transparent" style={{cursor:"pointer"}}
              onMouseEnter={()=>setHovYear(i)}/>
          ))}
          {/* Hover tooltip */}
          {hovYear!==null&&(
            <>
              <line x1={px(hovYear)} y1={p} x2={px(hovYear)} y2={H} stroke={t.BORDER} strokeWidth="1" strokeDasharray="3,2"/>
              <circle cx={px(hovYear)} cy={py(base[hovYear])} r="4" fill={t.GOLD}/>
              <circle cx={px(hovYear)} cy={py(bull[hovYear])} r="3" fill={t.GREEN} opacity=".8"/>
              <circle cx={px(hovYear)} cy={py(bear[hovYear])} r="3" fill={t.RED} opacity=".8"/>
              <rect x={Math.min(px(hovYear)+6,W-90)} y={py(base[hovYear])-32} width={84} height={30} rx="4" fill={t.CARD} stroke={t.BORDER}/>
              <text x={Math.min(px(hovYear)+14,W-82)} y={py(base[hovYear])-19} fill={t.GOLD} fontSize="8" fontFamily="sans-serif" fontWeight="600">{new Date().getFullYear()+hovYear}</text>
              <text x={Math.min(px(hovYear)+14,W-82)} y={py(base[hovYear])-9} fill={t.MUTED} fontSize="7" fontFamily="sans-serif">{fmt(base[hovYear])}</text>
            </>
          )}
          {/* End dot */}
          <circle cx={px(yrs)} cy={py(pj)} r="5" fill={t.GOLD}/>
        </svg>
      </Card>

      {/* Sliders */}
      <Card style={{marginBottom:14}}>
        {controls.map(ctrl=>(
          <div key={ctrl.l} style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:12,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{ctrl.l}</span>
              <span style={{fontSize:14,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>
                {ctrl.v+(ctrl.l!=="Time Horizon"?"%":"")}
                <span style={{fontSize:10,color:t.MUTED}}>{" "+ctrl.sub}</span>
              </span>
            </div>
            <input type="range" min={ctrl.min} max={ctrl.max} step={ctrl.step} value={ctrl.v}
              onChange={e=>ctrl.set(Number(e.target.value))}
              style={{width:"100%",accentColor:t.GOLD}}/>
          </div>
        ))}
      </Card>
    </div>
  );
}

function DebtPage({profile,setProfile,debts,setDebts,subscription,setShowUpgrade}){
  const t=T();
  const isMobile=useIsMobile();
  const[showAdd,setShowAdd]=useState(false);
  const[editing,setEditing]=useState(null);
  const[expanded,setExpanded]=useState({});
  const[payingDebt,setPayingDebt]=useState(null);
  const[payAmount,setPayAmount]=useState("");
  const[aiAdvice,setAiAdvice]=useState("");
  const[aiLoading,setAiLoading]=useState(false);
  const[extra,setExtra]=useState(500);
  const[strategy,setStrategy]=useState("avalanche");
  const[confirmDel,setConfirmDel]=useState(null);
  const emptyForm={name:"",type:"Mortgage",originalBalance:"",balance:"",rate:"",minPayment:"",frequency:"monthly",nextPaymentDate:"",startDate:"",endDate:"",lender:"",notes:""};
  const[form,setForm]=useState(emptyForm);

  const DEBT_TYPES=["Mortgage","Investment Loan","Car Finance","Credit Card","Personal Loan","Student Loan","Business Loan","Other"];

  // Migrate legacy debts from profile on first load - no default rates
  const allDebts = debts && debts.length > 0 ? debts : [
    {k:"mortgageDebt",name:"Mortgage",type:"Mortgage"},
    {k:"investLoanDebt",name:"Investment Loan",type:"Investment Loan"},
    {k:"carDebt",name:"Car Finance",type:"Car Finance"},
    {k:"creditCardDebt",name:"Credit Card",type:"Credit Card"},
    {k:"personalDebt",name:"Personal Loan",type:"Personal Loan"},
  ].filter(d=>parseFloat(profile[d.k])>0).map(d=>({
    id:d.k,name:d.name,type:d.type,
    balance:parseFloat(profile[d.k]),
    rate:"",minPayment:"",startDate:"",endDate:"",lender:"",notes:"",
    payments:[],originalBalance:parseFloat(profile[d.k])
  }));

  const totalDebt=allDebts.reduce((s,d)=>s+parseFloat(d.balance||0),0);
  const debtMonthlyEq=d=>{const m={weekly:52/12,fortnightly:26/12,monthly:1,quarterly:1/3,annually:1/12};return parseFloat(d.minPayment||0)*(m[d.frequency||"monthly"]||1);};
  const totalMinPayment=allDebts.reduce((s,d)=>s+debtMonthlyEq(d),0);

  // Payoff calc
  const calcPayoff=(bal,rate,payment)=>{
    if(!payment||payment<=0)return null;
    const r=parseFloat(rate)/100/12;
    const b=parseFloat(bal);
    if(r===0)return Math.ceil(b/payment);
    if(payment<=b*r)return null; // interest only
    return Math.ceil(Math.log(payment/(payment-b*r))/Math.log(1+r));
  };

  const calcTotalInterest=(bal,rate,payment)=>{
    const months=calcPayoff(bal,rate,payment);
    if(!months)return null;
    return Math.round(payment*months-parseFloat(bal));
  };

  const payoffDate=(months)=>{
    if(!months)return null;
    const d=new Date();d.setMonth(d.getMonth()+months);
    return d.toLocaleDateString(_locale,{month:"short",year:"numeric"});
  };

  // Sort by strategy
  const sorted=[...allDebts].sort((a,b)=>{
    if(strategy==="avalanche")return parseFloat(b.rate||0)-parseFloat(a.rate||0);
    if(strategy==="snowball")return parseFloat(a.balance||0)-parseFloat(b.balance||0);
    return 0;
  });

  const saveDebt=()=>{
    if(!form.name||!form.balance)return;
    const origBal=parseFloat(form.originalBalance)||parseFloat(form.balance);
    const curBal=parseFloat(form.balance);
    if(editing){
      const base = debts?.length ? debts : allDebts;
      setDebts(base.map(d=>d.id===editing?{
        ...d,...form,
        balance:curBal,
        originalBalance:origBal,
        rate:form.rate===""?"":parseFloat(form.rate)||0,
        minPayment:parseFloat(form.minPayment)||0,
        frequency:form.frequency||"monthly",
        nextPaymentDate:form.nextPaymentDate||"",
      }:d));
    } else {
      const newDebt={
        id:Date.now(),name:form.name,type:form.type,
        balance:curBal,originalBalance:origBal,
        rate:form.rate===""?"":parseFloat(form.rate)||0,
        minPayment:parseFloat(form.minPayment)||0,
        frequency:form.frequency||"monthly",
        nextPaymentDate:form.nextPaymentDate||"",
        startDate:form.startDate,endDate:form.endDate,
        lender:form.lender,notes:form.notes,
        payments:[]
      };
      const base = debts?.length ? debts : allDebts;
      setDebts([...base,newDebt]);
    }
    setForm(emptyForm);setShowAdd(false);setEditing(null);
  };

  const openEdit=(d)=>{
    setForm({
      name:d.name||"",type:d.type||"Mortgage",
      originalBalance:d.originalBalance||d.balance||"",
      balance:d.balance||"",
      rate:d.rate||"",minPayment:d.minPayment||"",
      frequency:d.frequency||"monthly",
      nextPaymentDate:d.nextPaymentDate||"",
      startDate:d.startDate||"",endDate:d.endDate||"",
      lender:d.lender||"",notes:d.notes||""
    });
    setEditing(d.id);setShowAdd(true);
  };

  const recordPayment=(id,amount)=>{
    const amt=parseFloat(amount)||0;
    if(!amt)return;
    const base = debts?.length ? debts : allDebts;
    setDebts(base.map(d=>{
      if(d.id!==id)return d;
      const newBal=Math.max(0,parseFloat(d.balance)-amt);
      return{...d,balance:newBal,payments:[...(d.payments||[]),{date:todayStr(),amount:amt,id:Date.now()}]};
    }));
    setPayingDebt(null);setPayAmount("");
  };

  const getAiAdvice=async()=>{
    if(!isPro(subscription)){setShowUpgrade(true);return;}
    setAiLoading(true);setAiAdvice("");
    const debtSummary=allDebts.map(d=>{
      const payment=parseFloat(d.minPayment)||0;
      const months=calcPayoff(d.balance,d.rate,payment+extra/Math.max(allDebts.length,1));
      return d.name+" - Balance: "+fmt(d.balance)+" - Rate: "+(d.rate||0)+"% - Min payment: "+fmt(payment)+" - Payoff: "+(months?"~"+months+" months":"unknown");
    }).join("\n");
    try{
      const r=await claudeFetch({
        model:"claude-sonnet-4-6",max_tokens:800,
        system:"You are a personal finance expert. Give direct, specific debt payoff advice. No fluff.",
        messages:[{role:"user",content:"My debts:\n"+debtSummary+"\n\nTotal debt: "+fmt(totalDebt)+"\nExtra monthly budget: "+fmt(extra)+"\nCurrent strategy: "+strategy+"\n\nGive me: 1) Which debt to attack first and why, 2) Specific monthly payment plan, 3) One quick win I can do this week to reduce debt faster. Be specific with numbers."}]
      });
      const d=await r.json();
      setAiAdvice((d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n")||"Unable to generate advice.");
    }catch{setAiAdvice("Connection error.");}
    setAiLoading(false);
  };

  return (
    <div data-page="true" style={{maxWidth:720,margin:"0 auto"}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Debt Freedom</div>
          <div style={{fontSize:26,color:t.TEXT}}>Debt Tracker</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:3}}>{allDebts.length+" debts - "+fmt(totalDebt)+" total"}</div>
        </div>
        <Btn onClick={()=>{setForm(emptyForm);setEditing(null);setShowAdd(s=>!s);}}>+ Add Debt</Btn>
      </div>

      {/* Summary stats */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,minmax(0,1fr))",gap:10,marginBottom:14}}>
        <StatCard label="Total Debt" value={fmt(totalDebt)} color={t.RED}/>
        <StatCard label="Min Payments" value={fmt(totalMinPayment)+"/mo"} color={t.MUTED} sub="Combined"/>
        <StatCard label="Debts" value={allDebts.length} color={t.GOLD} sub="Active"/>
      </div>

      {/* Strategy + Extra */}
      <Card style={{marginBottom:14}}>
        <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:200}}>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Payoff Strategy</div>
            <div style={{display:"flex",gap:7}}>
              {[{id:"avalanche",l:"Avalanche",sub:"Highest rate first"},{id:"snowball",l:"Snowball",sub:"Smallest balance first"},{id:"custom",l:"Custom",sub:"Your order"}].map(s=>(
                <button key={s.id} onClick={()=>setStrategy(s.id)} style={{flex:1,padding:"8px 6px",borderRadius:7,border:"1px solid "+(strategy===s.id?t.GOLD:t.BORDER),background:strategy===s.id?t.GOLD+"18":"transparent",cursor:"pointer",fontFamily:"'Montserrat',sans-serif"}}>
                  <div style={{fontSize:11,color:strategy===s.id?t.GOLD:t.TEXT,fontWeight:600}}>{s.l}</div>
                  <div style={{fontSize:9,color:t.MUTED,marginTop:2}}>{s.sub}</div>
                </button>
              ))}
            </div>
          </div>
          <div style={{flex:1,minWidth:180}}>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Extra Monthly Payment</div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <input type="range" min={0} max={5000} step={100} value={extra} onChange={e=>setExtra(Number(e.target.value))} style={{flex:1,accentColor:t.GOLD}}/>
              <div style={{fontSize:16,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:700,minWidth:80,textAlign:"right"}}>{fmt(extra)+"/mo"}</div>
            </div>
          </div>
        </div>
        {/* Priority order hint */}
        {strategy!=="custom"&&allDebts.length>1&&(
          <div style={{padding:"8px 12px",background:t.CARD2,borderRadius:7}}>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Attack Order</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {sorted.map((d,i)=>(
                <div key={d.id} style={{display:"flex",alignItems:"center",gap:5,background:i===0?t.RED+"22":t.CARD,border:"1px solid "+(i===0?t.RED:t.BORDER),borderRadius:20,padding:"3px 10px"}}>
                  <div style={{width:16,height:16,borderRadius:"50%",background:i===0?t.RED:t.BORDER,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:i===0?t.BG:t.MUTED,fontWeight:700,flexShrink:0}}>{i+1}</div>
                  <span style={{fontSize:10,color:i===0?t.RED:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{d.name}</span>
                  <span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{d.rate||0}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* AI Advice */}
      <Card style={{marginBottom:14,borderColor:t.GOLD+"33"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:aiAdvice||aiLoading?12:0}}>
          <div>
            <div style={{fontSize:10,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",letterSpacing:1,textTransform:"uppercase"}}>AI Debt Advisor</div>
            <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>Personalised payoff strategy based on your debts</div>
          </div>
          <button onClick={getAiAdvice} disabled={aiLoading||!allDebts.length} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:7,padding:"6px 12px",color:t.GOLD,cursor:aiLoading||!allDebts.length?"default":"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,opacity:!allDebts.length?.5:1}}>
            {aiLoading?"Analysing...":"Get Strategy"}
          </button>
        </div>
        {aiLoading&&<div style={{display:"flex",flexDirection:"column",gap:8}}>{[90,75,85].map((w,i)=><Skeleton key={i} width={w+"%"} height={12}/>)}</div>}
        {aiAdvice&&!aiLoading&&<div style={{fontSize:12,color:t.TEXT,lineHeight:1.85,fontFamily:"'Montserrat',sans-serif",whiteSpace:"pre-wrap"}}>{aiAdvice}</div>}
      </Card>

      {/* Add debt form */}
      {showAdd&&(
        <Card style={{marginBottom:14,borderColor:t.GOLD+"44"}}>
          <SectionLabel>{editing?"Edit Debt":"New Debt"}</SectionLabel>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:2}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Name</div>
                <Inp value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. ANZ Home Loan"/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Type</div>
                <Sel value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                  {DEBT_TYPES.map(tp=><option key={tp}>{tp}</option>)}
                </Sel>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Original Balance ($)</div>
                <Inp type="number" value={form.originalBalance} onChange={e=>setForm(f=>({...f,originalBalance:e.target.value}))} placeholder="e.g. 600000"/>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:3}}>What you originally borrowed</div>
              </div>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Current Balance ($)</div>
                <Inp type="number" value={form.balance} onChange={e=>setForm(f=>({...f,balance:e.target.value}))} placeholder="e.g. 480000"/>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:3}}>Where it sits right now</div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,minmax(0,1fr))",gap:8}}>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Interest Rate (%)</div>
                <Inp type="number" value={form.rate} onChange={e=>setForm(f=>({...f,rate:e.target.value}))} placeholder="6.2"/>
              </div>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Min Payment ({form.frequency==="weekly"?"$/wk":form.frequency==="fortnightly"?"$/fn":form.frequency==="quarterly"?"$/qtr":form.frequency==="annually"?"$/yr":"$/mo"})</div>
                <Inp type="number" value={form.minPayment} onChange={e=>setForm(f=>({...f,minPayment:e.target.value}))} placeholder="2400"/>
              </div>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Lender</div>
                <Inp value={form.lender} onChange={e=>setForm(f=>({...f,lender:e.target.value}))} placeholder="ANZ, Westpac..."/>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Payment Frequency</div>
                <Sel value={form.frequency||"monthly"} onChange={e=>setForm(f=>({...f,frequency:e.target.value}))}>
                  {["weekly","fortnightly","monthly","quarterly","annually"].map(f=><option key={f} value={f}>{f.charAt(0).toUpperCase()+f.slice(1)}</option>)}
                </Sel>
              </div>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Next Payment Date</div>
                <Inp type="date" value={form.nextPaymentDate} onChange={e=>setForm(f=>({...f,nextPaymentDate:e.target.value}))}/>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Start Date</div>
                <Inp type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))}/>
              </div>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>End Date / Due Date</div>
                <Inp type="date" value={form.endDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))}/>
              </div>
            </div>
            <div>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Notes</div>
              <Inp value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Fixed/variable rate, special terms, offset account..."/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={saveDebt}>{editing?"Save Changes":"Add Debt"}</Btn>
              <Btn onClick={()=>{setShowAdd(false);setEditing(null);setForm(emptyForm);}} variant="ghost">Cancel</Btn>
            </div>
          </div>
        </Card>
      )}

      {/* Debt cards */}
      {sorted.map((d,idx)=>{
        const bal=parseFloat(d.balance||0);
        const monthlyPayment=debtMonthlyEq(d)+(idx===0?extra:0);
        const payment=monthlyPayment;
        const months=calcPayoff(bal,d.rate,payment);
        const totalInt=calcTotalInterest(bal,d.rate,payment);
        const pct=totalDebt>0?Math.round(bal/totalDebt*100):0;
        const paidOff=d.originalBalance?Math.round((1-bal/d.originalBalance)*100):0;
        const isExpanded=!!expanded[d.id];
        const isPriority=idx===0&&strategy!=="custom";

        return (
          <Card key={d.id} style={{marginBottom:10,borderLeft:"3px solid "+(isPriority?t.RED:t.BORDER)}}>
            {/* Header row */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,cursor:"pointer"}} onClick={()=>setExpanded(x=>({...x,[d.id]:!x[d.id]}))}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
                  {isPriority&&<div style={{fontSize:8,color:t.RED,fontFamily:"'Montserrat',sans-serif",background:t.RED+"18",border:"1px solid "+t.RED+"33",borderRadius:4,padding:"1px 6px",letterSpacing:1,textTransform:"uppercase"}}>Priority</div>}
                  <div style={{fontSize:14,color:t.TEXT,fontWeight:600}}>{d.name}</div>
                </div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  <span style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{d.type}</span>
                  {d.lender&&<span style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{d.lender}</span>}
                  <span style={{fontSize:10,color:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{(d.rate||0)+"%"+" p.a."}</span>
                  {d.nextPaymentDate&&d.minPayment&&<span style={{fontSize:10,color:t.GOLD,fontFamily:"'Montserrat',sans-serif"}}>{"Next: "+fmtDateNum(d.nextPaymentDate)+" · -"+fmt(d.minPayment)}</span>}
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                <div style={{fontSize:18,color:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{"-"+fmt(bal)}</div>
                {months&&<div style={{fontSize:10,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",marginTop:1}}>Free {payoffDate(months)}</div>}
              </div>
            </div>

            {/* Progress bar */}
            {d.originalBalance&&d.originalBalance>0&&(
              <div style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{paidOff+"% paid off"}</span>
                  <span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{fmt(d.originalBalance-bal)+" paid"}</span>
                </div>
                <PB value={paidOff} color={t.GREEN} height={5}/>
              </div>
            )}

            {/* Key metrics row */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(4,minmax(0,1fr))",gap:7,marginBottom:8}}>
              {[
                {l:"Balance",v:fmt(bal),c:t.RED},
                {l:"Rate",v:(d.rate||0)+"%",c:t.MUTED},
                {l:"Monthly",v:payment>0?fmt(payment)+"/mo":"Not set",c:t.GOLD},
                {l:"Est. Interest",v:totalInt?fmt(totalInt):"N/A",c:t.MUTED},
              ].map(m=>(
                <div key={m.l} style={{background:t.CARD2,borderRadius:6,padding:"7px 8px",textAlign:"center"}}>
                  <div style={{fontSize:11,color:m.c,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{m.v}</div>
                  <div style={{fontSize:8,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2,textTransform:"uppercase",letterSpacing:.5}}>{m.l}</div>
                </div>
              ))}
            </div>

            {/* Expanded detail */}
            {isExpanded&&(
              <div style={{borderTop:"1px solid "+t.BORDER,paddingTop:10,marginBottom:8}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginBottom:10}}>
                  {d.startDate&&<div><div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:2}}>Start Date</div><div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{d.startDate}</div></div>}
                  {d.endDate&&<div><div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:2}}>End Date</div><div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{d.endDate}</div></div>}
                  {months&&<div><div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:2}}>Payoff Date (est.)</div><div style={{fontSize:12,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{payoffDate(months)+" ("+months+" months)"}</div></div>}
                  <div><div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:2}}>Share of total debt</div><div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{pct+"%"}</div></div>
                </div>
                {d.notes&&<div style={{padding:"8px 10px",background:t.CARD2,borderRadius:6,fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:10}}>{d.notes}</div>}
                {/* Payment history */}
                {(d.payments||[]).length>0&&(
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Payment History</div>
                    {(d.payments||[]).slice(-5).reverse().map(p=>(
                      <div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid "+t.BORDER+"66",fontSize:11,fontFamily:"'Montserrat',sans-serif"}}>
                        <span style={{color:t.MUTED}}>{p.date}</span>
                        <span style={{color:t.GREEN,fontWeight:600}}>{"-"+fmt(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Delete */}
                {confirmDel===d.id?(
                  <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
                    <span style={{fontSize:11,color:t.RED,fontFamily:"'Montserrat',sans-serif"}}>Delete this debt?</span>
                    <button onClick={()=>{const base=debts?.length?debts:allDebts;setDebts(base.filter(x=>x.id!==d.id));setConfirmDel(null);}} style={{background:t.RED+"22",border:"1px solid "+t.RED+"44",borderRadius:5,padding:"3px 8px",color:t.RED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Yes</button>
                    <button onClick={()=>setConfirmDel(null)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:5,padding:"3px 8px",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>No</button>
                  </div>
                ):(
                  <button onClick={()=>setConfirmDel(d.id)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif",opacity:.6}}>Delete debt</button>
                )}
              </div>
            )}

            {/* Record payment */}
            {payingDebt===d.id?(
              <div style={{display:"flex",gap:7,alignItems:"center",marginTop:6}}>
                <Inp type="number" value={payAmount} onChange={e=>setPayAmount(e.target.value)} placeholder="Payment amount $" style={{flex:1,fontSize:12}}/>
                <Btn onClick={()=>recordPayment(d.id,payAmount)} disabled={!payAmount}>Record</Btn>
                <Btn onClick={()=>{setPayingDebt(null);setPayAmount("");}} variant="ghost">Cancel</Btn>
              </div>
            ):(
              <div style={{display:"flex",gap:7,marginTop:4,flexWrap:"wrap"}}>
                <button onClick={()=>setPayingDebt(d.id)} style={{background:t.GREEN+"14",border:"1px solid "+t.GREEN+"33",borderRadius:6,padding:"5px 10px",color:t.GREEN,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>+ Record Payment</button>
                <button onClick={()=>{
                  if(!window.confirm("Mark "+d.name+" as fully paid off? This will set the balance to $0."))return;
                  const base=debts?.length?debts:allDebts;
                  setDebts(base.map(x=>x.id===d.id?{...x,balance:0,payments:[{date:todayStr(),amount:bal,note:"Paid in full"},...(x.payments||[])].slice(0,24)}:x));
                }} style={{background:"#C9A84C18",border:"1px solid #C9A84C44",borderRadius:6,padding:"5px 10px",color:"#C9A84C",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>🏆 Paid in Full</button>
                <button onClick={()=>openEdit(d)} style={{background:t.GOLD+"14",border:"1px solid "+t.GOLD+"33",borderRadius:6,padding:"5px 10px",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>Edit</button>
                <button onClick={()=>setExpanded(x=>({...x,[d.id]:!x[d.id]}))} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:6,padding:"5px 10px",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>{isExpanded?"Less":"Details"}</button>
              </div>
            )}
          </Card>
        );
      })}

      {!allDebts.length&&(
        <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
          <div style={{fontSize:32,marginBottom:12}}>D</div>
          <div style={{fontSize:14,marginBottom:8}}>No debts tracked</div>
          <div style={{fontSize:12,marginBottom:16}}>Add your debts to get a personalised payoff strategy</div>
          <Btn onClick={()=>{setForm(emptyForm);setEditing(null);setShowAdd(true);}}>+ Add First Debt</Btn>
        </div>
      )}
      {!isPro(subscription)&&<UpgradeHint message="✦ Get AI debt elimination strategy with The Executive" onUpgrade={()=>setShowUpgrade(true)}/>}
    </div>
  );
}

function CashFlowPage({transactions,setTransactions,subscription,setShowUpgrade,authToken}){
  const t=T();
  const isMobile=useIsMobile();
  const[form,setForm]=useState({date:todayStr(),type:"income",category:"Salary",amount:"",note:""});
  const[showAdd,setShowAdd]=useState(false);
  const[activeTab,setActiveTab]=useState("overview");
  const[filter,setFilter]=useState("all");
  const[hoveredMonth,setHoveredMonth]=useState(null);
  const[pdfState,setPdfState]=useState("idle");const[pdfError,setPdfError]=useState("");
  const[extracted,setExtracted]=useState([]);const[selected,setSelected]=useState({});
  const fileRef=useRef(null);

  // Build last 12 months data
  const months=Array.from({length:12}).map((_,i)=>{
    const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-(11-i));
    const key=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"); // local time, not UTC
    const label=d.toLocaleString("default",{month:"short"});
    const year=d.getFullYear();
    const txs=transactions.filter(tx=>tx.date.startsWith(key));
    const inc=txs.filter(tx=>tx.type==="income").reduce((s,tx)=>s+tx.amount,0);
    const exp=txs.filter(tx=>tx.type==="expense").reduce((s,tx)=>s+tx.amount,0);
    return{key,label,year,inc,exp,net:inc-exp,txs};
  });

  const currentMonth=months[months.length-1];
  const prevMonth=months[months.length-2];

  // Show current month if it has data, otherwise fall back to previous month
  const hasCurrentMonthData=currentMonth.inc>0||currentMonth.exp>0;
  const activeMonth=hasCurrentMonthData?currentMonth:prevMonth;
  const mk=activeMonth.key;
  const tm=transactions.filter(tx=>tx.date.startsWith(mk));
  const income=tm.filter(tx=>tx.type==="income").reduce((s,tx)=>s+tx.amount,0);
  const expense=tm.filter(tx=>tx.type==="expense").reduce((s,tx)=>s+tx.amount,0);
  const displayMonthLabel=activeMonth.label+" "+activeMonth.year;

  // All-time totals
  const totalIncome=transactions.filter(tx=>tx.type==="income").reduce((s,tx)=>s+tx.amount,0);
  const totalExpense=transactions.filter(tx=>tx.type==="expense").reduce((s,tx)=>s+tx.amount,0);

  // Category totals for selected period
  const selectedMonthData=hoveredMonth||(hasCurrentMonthData?currentMonth:prevMonth);
  const byCatIncome=EXP_CATS.income.map(cat=>({cat,total:selectedMonthData.txs.filter(tx=>tx.type==="income"&&tx.category===cat).reduce((s,tx)=>s+tx.amount,0)})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
  const byCatExpense=EXP_CATS.expense.map(cat=>({cat,total:selectedMonthData.txs.filter(tx=>tx.type==="expense"&&tx.category===cat).reduce((s,tx)=>s+tx.amount,0)})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
  const catColors=["#C9A84C","#7A9E7E","#7EB8C9","#B07EC9","#C97E7E","#D4956A","#7EC8A0","#C8A87E"];

  const maxBar=Math.max(...months.flatMap(m=>[m.inc,m.exp]),1);

  // Month over month change — compare active month to the one before it
  const activeMonthIdx=months.findIndex(m=>m.key===mk);
  const priorMonth=activeMonthIdx>0?months[activeMonthIdx-1]:prevMonth;
  const incChange=priorMonth.inc>0?((income-priorMonth.inc)/priorMonth.inc*100):0;
  const expChange=priorMonth.exp>0?((expense-priorMonth.exp)/priorMonth.exp*100):0;

  const handlePdf=async file=>{
    if(!isPro(subscription)){setShowUpgrade(true);return;}
    if(!file||!file.type.includes("pdf"))return;
    setPdfState("loading");setPdfError("");
    try{
      const base64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=()=>rej(new Error("Read failed"));r.readAsDataURL(file);});
      const catList=[...EXP_CATS.income,...EXP_CATS.expense].join(", ");
      const resp=await claudeFetch({model:"claude-haiku-4-5",max_tokens:4000,messages:[{role:"user",content:[
        {type:"document",source:{type:"base64",media_type:"application/pdf",data:base64}},
        {type:"text",text:`Extract ALL transactions from this bank statement. Return ONLY a valid JSON array, no markdown, no explanation, no extra text.

Each transaction must be:
{"date":"YYYY-MM-DD","description":"merchant or payee name max 40 chars","amount":number,"type":"income or expense","category":"exact category from list"}

Categories to use (pick the MOST SPECIFIC match):
Income: Salary, Business Revenue, Investment Income, Rental Income, Side Income, Dividends, Government Payments, Other Income
Expense: Rent & Mortgage, Utilities, Phone & Internet, Groceries, Dining Out & Takeaway, Transport, Fuel, Car Repayment, Insurance, Health & Medical, Gym & Fitness, Clothing & Personal Care, Entertainment, Subscriptions, Education & Courses, Home & Garden, Kids & Family, Pets, Travel & Holidays, Gifts & Donations, Tax & Accounting, Investments & Savings, Other

Categorisation rules:
- Rent/lease payments → "Rent & Mortgage"
- Power, gas, water → "Utilities"  
- Telstra, Optus, phone bills → "Phone & Internet"
- Woolworths, Coles, IGA, Aldi → "Groceries"
- Restaurants, UberEats, DoorDash, cafes → "Dining Out & Takeaway"
- Petrol stations → "Fuel"
- Car loan payments → "Car Repayment"
- Netflix, Spotify, Adobe, software → "Subscriptions"
- Gym, fitness studios → "Gym & Fitness"
- Medicare, doctors, pharmacy → "Health & Medical"
- Salary, payroll credits → "Salary"
- Centrelink, government → "Government Payments"
- Skip: internal transfers between own accounts, balance carry-forwards
- Amount: always positive number regardless of debit/credit
- Type: income for money in, expense for money out`}
      ]}]},authToken);
      if(!resp.ok){
        const err=await resp.json().catch(()=>({}));
        setPdfState("error");
        setPdfError(resp.status===403?"Executive subscription required.":resp.status===429?"Rate limit reached — try again in an hour.":err.error||"Server error ("+resp.status+").");
        return;
      }
      const d=await resp.json();
      const text=(d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").replace(/```json\s*/g,"").replace(/```\s*/g,"").trim();
      const parsed=JSON.parse(text);
      if(!Array.isArray(parsed)||!parsed.length){setPdfState("error");setPdfError("No transactions found in this PDF.");return;}
      const valid=parsed.filter(tx=>tx.date&&tx.amount).map((tx,i)=>({id:"pdf_"+i+"_"+Date.now(),date:tx.date,type:tx.type==="income"?"income":"expense",category:tx.category||"Other",amount:Math.abs(parseFloat(tx.amount)||0),note:tx.description||""})).filter(tx=>tx.amount>0);
      if(!valid.length){setPdfState("error");setPdfError("Could not extract valid transactions. Make sure this is a bank statement PDF.");return;}
      setExtracted(valid);const sel={};valid.forEach(tx=>{sel[tx.id]=true;});setSelected(sel);setPdfState("review");
    }catch(err){
      setPdfState("error");
      setPdfError(err.message?.includes("JSON")?"Could not parse the statement — try a different PDF format.":"Something went wrong: "+err.message);
    }
  };
  const confirmImport=()=>{setTransactions(ts=>[...extracted.filter(tx=>selected[tx.id]).map(tx=>({...tx,id:Date.now()+Math.random()})),...ts]);setExtracted([]);setSelected({});setPdfState("idle");};
  const add=()=>{if(!form.amount||isNaN(form.amount))return;setTransactions(ts=>[{...form,amount:parseFloat(form.amount),id:Date.now()},...ts]);setForm(f=>({...f,amount:"",note:""}));setShowAdd(false);};
  const shown=transactions.filter(tx=>filter==="all"||tx.type===filter).slice(0,50);

  return (
    <div data-page="true" style={{maxWidth:900,margin:"0 auto"}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Cash Flow</div>
          <div style={{fontSize:26,color:t.TEXT}}>Income and Expenses</div>
        </div>
        <Btn onClick={()=>setShowAdd(s=>!s)}>+ Add</Btn>
      </div>

      {/* Summary stats - this month + all time */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,minmax(0,1fr))",gap:10,marginBottom:14}}>
        <Card style={{borderColor:t.GREEN+"33"}}>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Income · {displayMonthLabel}</div>
          <div style={{fontSize:24,color:t.GREEN,fontWeight:700,marginBottom:3}}>{fmt(income)}</div>
          <div style={{fontSize:10,color:incChange>=0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif"}}>
            {incChange>=0?"+ ":"- "}{Math.abs(incChange).toFixed(1)}{"% vs last month"}
          </div>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:4}}>{"All time: "+fmt(totalIncome)}</div>
        </Card>
        <Card style={{borderColor:t.RED+"33"}}>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Expenses · {displayMonthLabel}</div>
          <div style={{fontSize:24,color:t.RED,fontWeight:700,marginBottom:3}}>{fmt(expense)}</div>
          <div style={{fontSize:10,color:expChange<=0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif"}}>
            {expChange>=0?"+ ":"- "}{Math.abs(expChange).toFixed(1)}{"% vs last month"}
          </div>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:4}}>{"All time: "+fmt(totalExpense)}</div>
        </Card>
        <Card style={{borderColor:(income-expense>=0?t.GREEN:t.RED)+"33"}}>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Net · {displayMonthLabel}</div>
          <div style={{fontSize:24,color:income-expense>=0?t.GREEN:t.RED,fontWeight:700,marginBottom:3}}>{(income-expense>=0?"+":"-")+fmt(Math.abs(income-expense))}</div>
          <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{income-expense>=0?"Surplus":"Deficit"}</div>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:4}}>{"All time: "+(totalIncome-totalExpense>=0?"+":"-")+fmt(Math.abs(totalIncome-totalExpense))}</div>
        </Card>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {[["overview","Overview"],["monthly","Monthly Breakdown"],["categories","Categories"],["transactions","Transactions"]].map(([id,label])=>(
          <button key={id} onClick={()=>setActiveTab(id)} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid "+(activeTab===id?t.GOLD:t.BORDER),background:activeTab===id?t.GOLD+"18":"transparent",color:activeTab===id?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>
            {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab==="overview"&&(
        <div>
          {/* Interactive 12-month chart */}
          <Card style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <SectionLabel>12-Month Trend</SectionLabel>
              <div style={{display:"flex",gap:10}}>
                {[{c:t.GREEN,l:"Income"},{c:t.RED,l:"Expenses"}].map(x=>(
                  <div key={x.l} style={{display:"flex",alignItems:"center",gap:4}}>
                    <div style={{width:10,height:10,borderRadius:2,background:x.c+"88"}}/>
                    <span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{x.l}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Tooltip */}
            {hoveredMonth&&(
              <div style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"8px 12px",marginBottom:10,display:"flex",gap:20,flexWrap:"wrap"}}>
                <div style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{hoveredMonth.label+" "+hoveredMonth.year}</div>
                <div style={{fontSize:11,color:t.GREEN,fontFamily:"'Montserrat',sans-serif"}}>In: {fmt(hoveredMonth.inc)}</div>
                <div style={{fontSize:11,color:t.RED,fontFamily:"'Montserrat',sans-serif"}}>Out: {fmt(hoveredMonth.exp)}</div>
                <div style={{fontSize:11,color:hoveredMonth.net>=0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>Net: {(hoveredMonth.net>=0?"+":"")+fmt(hoveredMonth.net)}</div>
              </div>
            )}
            <div style={{display:"flex",gap:3,alignItems:"flex-end",height:100}}>
              {months.map((m,i)=>(
                <div key={m.key} onMouseEnter={()=>setHoveredMonth(m)} onMouseLeave={()=>setHoveredMonth(null)} onTouchStart={()=>setHoveredMonth(m)}
                  style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer",opacity:hoveredMonth&&hoveredMonth.key!==m.key?.6:1,transition:"opacity .15s"}}>
                  <div style={{width:"100%",display:"flex",gap:1,alignItems:"flex-end",height:80}}>
                    <div style={{flex:1,background:i===11?t.GREEN:t.GREEN+"66",borderRadius:"2px 2px 0 0",height:Math.max((m.inc/maxBar*76),m.inc>0?3:0)+"px",transition:"height .3s"}}/>
                    <div style={{flex:1,background:i===11?t.RED:t.RED+"66",borderRadius:"2px 2px 0 0",height:Math.max((m.exp/maxBar*76),m.exp>0?3:0)+"px",transition:"height .3s"}}/>
                  </div>
                  <div style={{fontSize:7,color:i===11?t.GOLD:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontWeight:i===11?700:400}}>{m.label}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* PDF import */}
          {pdfState==="idle"&&(
            <div onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();handlePdf(e.dataTransfer.files[0]);}} style={{border:"1.5px dashed "+t.GOLD+"44",borderRadius:9,padding:14,textAlign:"center",cursor:"pointer",marginBottom:14}}>
              <input ref={fileRef} type="file" accept="application/pdf" style={{display:"none"}} onChange={e=>handlePdf(e.target.files[0])}/>
              <div style={{fontSize:12,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:600,marginBottom:2}}>Import Bank Statement (PDF)</div>
              <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>Drop PDF or tap to browse</div>
            </div>
          )}
          {pdfState==="loading"&&<Card style={{marginBottom:14,textAlign:"center",padding:20}}><div style={{fontSize:12,color:t.GOLD,fontFamily:"'Montserrat',sans-serif"}}>Reading your statement...</div></Card>}
          {pdfState==="error"&&<Card style={{marginBottom:14,borderColor:t.RED+"44"}}><div style={{display:"flex",justifyContent:"space-between"}}><div><div style={{fontSize:12,color:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600,marginBottom:3}}>Import failed</div><div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{pdfError}</div></div><button onClick={()=>setPdfState("idle")} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:5,padding:"3px 8px",color:t.MUTED,cursor:"pointer",fontSize:10}}>Retry</button></div></Card>}
          {pdfState==="review"&&(
            <Card style={{marginBottom:14,borderColor:t.GOLD+"44"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{extracted.length+" found - "+Object.values(selected).filter(Boolean).length+" selected"}</div>
                <div style={{display:"flex",gap:7}}>
                  <button onClick={()=>{const all=Object.values(selected).every(Boolean);const s={};extracted.forEach(tx=>{s[tx.id]=!all;});setSelected(s);}} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:5,padding:"4px 9px",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>{Object.values(selected).every(Boolean)?"Deselect All":"Select All"}</button>
                  <Btn onClick={confirmImport} disabled={!Object.values(selected).some(Boolean)} style={{fontSize:10,padding:"4px 10px"}}>{"Import "+Object.values(selected).filter(Boolean).length}</Btn>
                  <Btn onClick={()=>{setExtracted([]);setSelected({});setPdfState("idle");}} variant="ghost" style={{fontSize:10,padding:"4px 9px"}}>Cancel</Btn>
                </div>
              </div>
              <div style={{maxHeight:280,overflowY:"auto",border:"1px solid "+t.BORDER,borderRadius:7}}>
                {extracted.map((tx,i)=>(
                  <div key={tx.id} onClick={()=>setSelected(s=>({...s,[tx.id]:!s[tx.id]}))} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderBottom:i<extracted.length-1?"1px solid "+t.BORDER:"none",cursor:"pointer",background:selected[tx.id]?t.GOLD+"08":"transparent"}}>
                    <div style={{width:14,height:14,borderRadius:3,border:"1.5px solid "+(selected[tx.id]?t.GOLD:t.BORDER2),background:selected[tx.id]?t.GOLD:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {selected[tx.id]&&<span style={{fontSize:8,color:"#080808",fontWeight:700}}>V</span>}
                    </div>
                    <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",width:80,flexShrink:0}}>{tx.date}</div>
                    <div style={{flex:1,fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tx.note}</div>
                    <select value={tx.category} onClick={e=>e.stopPropagation()} onChange={e=>{e.stopPropagation();setExtracted(ex=>ex.map(x=>x.id===tx.id?{...x,category:e.target.value}:x));}} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:4,padding:"2px 4px",color:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontSize:9,outline:"none",flexShrink:0}}>
                      {EXP_CATS[tx.type].map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                    <div style={{fontSize:11,color:tx.type==="income"?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600,flexShrink:0,minWidth:60,textAlign:"right"}}>{(tx.type==="income"?"+":"-")+fmt(tx.amount)}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── MONTHLY BREAKDOWN TAB ── */}
      {activeTab==="monthly"&&(
        <div>
          <Card>
            <SectionLabel>Month by Month</SectionLabel>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,auto) repeat(3,minmax(0,1fr))",gap:"6px 10px",alignItems:"center",marginBottom:6}}>
              {["Month","","Income","Expenses","Net","Savings%"].map((h,i)=>(
                <div key={i} style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,textAlign:i>=3?"right":"left",paddingBottom:6,borderBottom:"1px solid "+t.BORDER}}>{h}</div>
              ))}
            </div>
            {[...months].reverse().map((m,i)=>{
              const savingsRate=m.inc>0?Math.round((m.net/m.inc)*100):0;
              const isCurrentMonth=m.key===mk;
              return (
                <div key={m.key} style={{display:"grid",gridTemplateColumns:"repeat(3,auto) repeat(3,minmax(0,1fr))",gap:"6px 10px",alignItems:"center",padding:"8px 0",borderBottom:"1px solid "+t.BORDER+(isCurrentMonth?"":"66"),background:isCurrentMonth?t.GOLD+"08":"transparent",borderRadius:isCurrentMonth?4:0}}>
                  <div style={{fontSize:12,color:isCurrentMonth?t.GOLD:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:isCurrentMonth?600:400}}>{m.label}</div>
                  <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{m.year}</div>
                  {isCurrentMonth&&<div style={{fontSize:8,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",background:t.GOLD+"18",padding:"1px 5px",borderRadius:4}}>Now</div>}
                  {!isCurrentMonth&&<div/>}
                  <div style={{fontSize:12,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",fontWeight:600,textAlign:"right"}}>{m.inc>0?fmt(m.inc):"-"}</div>
                  <div style={{fontSize:12,color:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600,textAlign:"right"}}>{m.exp>0?fmt(m.exp):"-"}</div>
                  <div style={{fontSize:12,color:m.net>=0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600,textAlign:"right"}}>{m.inc>0||m.exp>0?(m.net>=0?"+":"")+fmt(m.net):"-"}</div>
                </div>
              );
            })}
            {/* Totals row */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,auto) repeat(3,minmax(0,1fr))",gap:"6px 10px",alignItems:"center",padding:"10px 0 4px",borderTop:"2px solid "+t.BORDER}}>
              <div style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>Total</div>
              <div/><div/>
              <div style={{fontSize:12,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",fontWeight:700,textAlign:"right"}}>{fmt(totalIncome)}</div>
              <div style={{fontSize:12,color:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:700,textAlign:"right"}}>{fmt(totalExpense)}</div>
              <div style={{fontSize:12,color:totalIncome-totalExpense>=0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:700,textAlign:"right"}}>{(totalIncome-totalExpense>=0?"+":"")+fmt(totalIncome-totalExpense)}</div>
            </div>
          </Card>
        </div>
      )}

      {/* ── CATEGORIES TAB ── */}
      {activeTab==="categories"&&(
        <div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:12}}>Hover over chart bars to see category breakdown for that month</div>
          {/* Month selector */}
          <div style={{display:"flex",gap:4,overflowX:"auto",marginBottom:14,scrollbarWidth:"none"}}>
            {months.map(m=>(
              <button key={m.key} onClick={()=>setHoveredMonth(hoveredMonth?.key===m.key?null:m)} style={{flexShrink:0,padding:"5px 10px",borderRadius:14,border:"1px solid "+(hoveredMonth?.key===m.key||(!hoveredMonth&&m.key===mk)?t.GOLD:t.BORDER),background:hoveredMonth?.key===m.key||(!hoveredMonth&&m.key===mk)?t.GOLD+"18":"transparent",color:hoveredMonth?.key===m.key||(!hoveredMonth&&m.key===mk)?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>
                {m.label}
              </button>
            ))}
          </div>
          <div style={{fontSize:10,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>
            {(hoveredMonth||currentMonth).label+" "+(hoveredMonth||currentMonth).year}
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,minmax(0,1fr))",gap:12}}>
            {/* Income categories */}
            <Card>
              <div style={{fontSize:9,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Income by Category</div>
              {byCatIncome.length===0?<div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>No income this month</div>:
              byCatIncome.map((x,i)=>(
                <div key={x.cat} style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{x.cat}</span>
                    <span style={{fontSize:11,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{fmt(x.total)}</span>
                  </div>
                  <div style={{background:t.BORDER2,borderRadius:99,height:3,overflow:"hidden"}}>
                    <div style={{width:((x.total/(byCatIncome[0]?.total||1))*100)+"%",height:"100%",background:t.GREEN,borderRadius:99}}/>
                  </div>
                </div>
              ))}
              {byCatIncome.length>0&&<div style={{borderTop:"1px solid "+t.BORDER,marginTop:8,paddingTop:8,display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>Total</span><span style={{fontSize:12,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{fmt(byCatIncome.reduce((s,x)=>s+x.total,0))}</span></div>}
            </Card>
            {/* Expense categories */}
            <Card>
              <div style={{fontSize:9,color:t.RED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Expenses by Category</div>
              {byCatExpense.length===0?<div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>No expenses this month</div>:
              byCatExpense.map((x,i)=>(
                <div key={x.cat} style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{x.cat}</span>
                    <span style={{fontSize:11,color:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{fmt(x.total)}</span>
                  </div>
                  <div style={{background:t.BORDER2,borderRadius:99,height:3,overflow:"hidden"}}>
                    <div style={{width:((x.total/(byCatExpense[0]?.total||1))*100)+"%",height:"100%",background:catColors[i%catColors.length],borderRadius:99}}/>
                  </div>
                </div>
              ))}
              {byCatExpense.length>0&&<div style={{borderTop:"1px solid "+t.BORDER,marginTop:8,paddingTop:8,display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>Total</span><span style={{fontSize:12,color:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{fmt(byCatExpense.reduce((s,x)=>s+x.total,0))}</span></div>}
            </Card>
          </div>
        </div>
      )}

      {/* ── TRANSACTIONS TAB ── */}
      {activeTab==="transactions"&&(
        <div>
          {showAdd&&(
            <Card style={{marginBottom:14,borderColor:t.GOLD+"44"}}>
              <SectionLabel>New Transaction</SectionLabel>
              <div style={{display:"flex",gap:7,marginBottom:9}}>
                {["income","expense"].map(tp=>(
                  <button key={tp} onClick={()=>setForm(f=>({...f,type:tp,category:EXP_CATS[tp][0]}))} style={{flex:1,padding:"8px",borderRadius:7,border:"1px solid "+(form.type===tp?(tp==="income"?t.GREEN:t.RED):t.BORDER),background:form.type===tp?(tp==="income"?t.GREEN:t.RED)+"22":"transparent",color:form.type===tp?(tp==="income"?t.GREEN:t.RED):t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12,textTransform:"capitalize"}}>{tp}</button>
                ))}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:9}}>
                <div style={{display:"flex",gap:7}}>
                  <Inp type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={{flex:1}}/>
                  <Sel value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{flex:1.5}}>
                    {EXP_CATS[form.type].map(c=><option key={c}>{c}</option>)}
                  </Sel>
                </div>
                <div style={{display:"flex",gap:7}}>
                  <Inp type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="Amount ($)" style={{flex:1}}/>
                  <Inp value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="Note" style={{flex:2}}/>
                </div>
                <div style={{display:"flex",gap:8}}><Btn onClick={add}>Add</Btn><Btn onClick={()=>setShowAdd(false)} variant="ghost">Cancel</Btn></div>
              </div>
            </Card>
          )}
          <div style={{display:"flex",gap:7,marginBottom:12,justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",gap:5}}>
              {["all","income","expense"].map(f=>(
                <button key={f} onClick={()=>setFilter(f)} style={{padding:"4px 11px",borderRadius:14,border:"1px solid "+(filter===f?t.GOLD:t.BORDER),background:filter===f?t.GOLD+"14":"transparent",color:filter===f?t.GOLD:t.MUTED,cursor:"pointer",fontSize:11,fontFamily:"'Montserrat',sans-serif",textTransform:"capitalize"}}>{f}</button>
              ))}
            </div>
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{shown.length+" transactions"}</div>
          </div>
          {/* Totals for filtered view */}
          <div style={{display:"flex",gap:10,marginBottom:12,padding:"8px 12px",background:t.CARD2,borderRadius:7}}>
            <div style={{fontSize:11,color:t.GREEN,fontFamily:"'Montserrat',sans-serif"}}>Income: {fmt(shown.filter(tx=>tx.type==="income").reduce((s,tx)=>s+tx.amount,0))}</div>
            <div style={{fontSize:11,color:t.MUTED}}>|</div>
            <div style={{fontSize:11,color:t.RED,fontFamily:"'Montserrat',sans-serif"}}>Expenses: {fmt(shown.filter(tx=>tx.type==="expense").reduce((s,tx)=>s+tx.amount,0))}</div>
          </div>
          {shown.length===0?<div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}><div style={{fontSize:28,marginBottom:10}}>T</div><div>No transactions yet</div></div>:
          <Card>
            {shown.map((tx,i)=>(
              <div key={tx.id}>
                {i>0&&<Divider/>}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,color:t.TEXT}}>{tx.category}{tx.note&&<span style={{color:t.MUTED,fontSize:11}}>{" - "+tx.note}</span>}</div>
                    <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:1}}>{tx.date}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:9}}>
                    <div style={{fontSize:13,color:tx.type==="income"?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{(tx.type==="income"?"+":"-")+fmt(tx.amount)}</div>
                    <button onClick={()=>setTransactions(ts=>ts.filter(x=>x.id!==tx.id))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.5}}>X</button>
                  </div>
                </div>
              </div>
            ))}
          </Card>}
        </div>
      )}
    </div>
  );
}

function BillsPage({bills,setBills}){
  const t=T();
  const isMobile=useIsMobile();
  const emptyForm={name:"",amount:"",frequency:"monthly",category:"Housing",lastPaid:todayStr(),autopay:false};
  const[showAdd,setShowAdd]=useState(false);
  const[editingId,setEditingId]=useState(null);
  const[form,setForm]=useState(emptyForm);
  const[showHistory,setShowHistory]=useState(false);
  const[confirmDel,setConfirmDel]=useState(null);
  const freqs=["weekly","fortnightly","monthly","quarterly","annually"];
  const billCats=["Housing","Insurance","Utilities","Subscriptions","Finance","Health","Transport","Other"];
  const CAT_COLORS_B={Housing:"#C9A84C",Insurance:"#7EB8C9",Utilities:"#7A9E7E",Subscriptions:"#B07EC9",Finance:"#C97E7E",Health:"#7EC8A0",Transport:"#D4956A",Other:"#6A6050"};

  const fmtAmt=n=>n!=null?"$"+Number(n).toLocaleString("en-AU",{minimumFractionDigits:2,maximumFractionDigits:2}):"$0.00";
  const monthlyEq=b=>{const m={weekly:52/12,fortnightly:26/12,monthly:1,quarterly:1/3,annually:1/12};return parseFloat(b.amount)*(m[b.frequency]||1);};

  const markPaid=id=>setBills(bs=>bs.map(b=>{
    if(b.id!==id)return b;
    const payment={date:todayStr(),amount:parseFloat(b.amount),name:b.name};
    return{...b,nextDue:advanceDate(b.nextDue,b.frequency),lastPaid:todayStr(),paymentHistory:[payment,...(b.paymentHistory||[]).slice(0,23)]};
  }));

  const openEdit=b=>{
    setForm({name:b.name,amount:b.amount,frequency:b.frequency,category:b.category,lastPaid:b.lastPaid||todayStr(),autopay:b.autopay||false});
    setEditingId(b.id);setShowAdd(true);
  };

  const save=()=>{
    if(!form.name||!form.amount)return;
    const nextDue=advanceDate(form.lastPaid,form.frequency);
    if(editingId){
      setBills(bs=>bs.map(b=>b.id===editingId?{...b,...form,amount:parseFloat(form.amount),nextDue,lastPaid:form.lastPaid}:b));
    } else {
      setBills(bs=>[...bs,{...form,id:Date.now(),amount:parseFloat(form.amount),nextDue,paymentHistory:[]}]);
    }
    setForm(emptyForm);setShowAdd(false);setEditingId(null);
  };

  const totalMonthly=bills.reduce((s,b)=>s+monthlyEq(b),0);
  const upcoming=bills.filter(b=>{const d=(new Date(b.nextDue+"T12:00:00")-new Date())/864e5;return d>=0&&d<=7;}).sort((a,b)=>new Date(a.nextDue)-new Date(b.nextDue));

  // Group bills by category
  const grouped=billCats.map(cat=>({cat,items:bills.filter(b=>b.category===cat)})).filter(g=>g.items.length>0);

  return (
    <div data-page="true" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Recurring</div>
          <div style={{fontSize:26,color:t.TEXT}}>Bills</div>
        </div>
        <Btn onClick={()=>{setForm(emptyForm);setEditingId(null);setShowAdd(s=>!s);}}>+ Add</Btn>
      </div>

      {/* Summary */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,minmax(0,1fr))",gap:10,marginBottom:14}}>
        <Card style={{textAlign:"center",padding:"12px 8px"}}>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Monthly Total</div>
          <div style={{fontSize:22,color:t.RED,fontWeight:700}}>{fmtAmt(totalMonthly)}</div>
        </Card>
        <Card style={{textAlign:"center",padding:"12px 8px"}}>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Annual Total</div>
          <div style={{fontSize:22,color:t.GOLD,fontWeight:700}}>{fmtAmt(totalMonthly*12)}</div>
        </Card>
        <Card style={{textAlign:"center",padding:"12px 8px"}}>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Bills Tracked</div>
          <div style={{fontSize:22,color:t.BLUE,fontWeight:700}}>{bills.length}</div>
        </Card>
      </div>

      {/* Due soon */}
      {upcoming.length>0&&(
        <Card style={{marginBottom:14,borderColor:t.GOLD+"44"}}>
          <SectionLabel>Due in 7 Days</SectionLabel>
          {upcoming.map((b,i)=>{
            const diff=Math.round((new Date(b.nextDue+"T12:00:00")-new Date())/864e5);
            const dueLabel=diff===0?"Due today":("Due in "+diff+" day"+(diff!==1?"s":""));
            return (
              <div key={b.id}>
                {i>0&&<Divider/>}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0"}}>
                  <div>
                    <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>
                      {b.name}{b.autopay&&<span style={{fontSize:9,color:t.GREEN,marginLeft:5,fontFamily:"'Montserrat',sans-serif"}}>auto</span>}
                    </div>
                    <div style={{fontSize:10,color:diff===0?t.RED:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:1}}>{dueLabel+" - "+new Date(b.nextDue+"T12:00:00").toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"})}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:13,color:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{fmtAmt(b.amount)}</span>
                    <button onClick={()=>markPaid(b.id)} style={{background:t.GREEN+"18",border:"1px solid "+t.GREEN+"44",borderRadius:5,padding:"4px 9px",color:t.GREEN,cursor:"pointer",fontSize:11,fontFamily:"'Montserrat',sans-serif"}}>Paid</button>
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* Add/Edit form */}
      {showAdd&&(
        <Card style={{marginBottom:14,borderColor:t.GOLD+"44"}}>
          <SectionLabel>{editingId?"Edit Bill":"New Bill"}</SectionLabel>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div style={{display:"flex",gap:8}}>
              <Inp value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Bill name" style={{flex:2}}/>
              <Inp type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="$0.00" style={{flex:1}}/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <Sel value={form.frequency} onChange={e=>setForm(f=>({...f,frequency:e.target.value}))} style={{flex:1}}>
                {freqs.map(f=><option key={f} value={f}>{f.charAt(0).toUpperCase()+f.slice(1)}</option>)}
              </Sel>
              <Sel value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{flex:1}}>
                {billCats.map(c=><option key={c}>{c}</option>)}
              </Sel>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Last Paid / Start Date</div>
                <Inp type="date" value={form.lastPaid} onChange={e=>setForm(f=>({...f,lastPaid:e.target.value}))} style={{flex:1}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Next Due (auto)</div>
                <div style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"9px 12px",fontSize:12,color:t.GREEN,fontFamily:"'Montserrat',sans-serif"}}>
                  {form.lastPaid&&form.frequency?new Date(advanceDate(form.lastPaid,form.frequency)+"T12:00:00").toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"}):"Select date"}
                </div>
              </div>
              <div style={{flexShrink:0,alignSelf:"flex-end"}}>
                <label style={{display:"flex",alignItems:"center",gap:5,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontSize:12,cursor:"pointer",padding:"9px 0"}}>
                  <input type="checkbox" checked={form.autopay} onChange={e=>setForm(f=>({...f,autopay:e.target.checked}))} style={{accentColor:t.GOLD}}/>
                  Auto-pay
                </label>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={save}>{editingId?"Save Changes":"Add"}</Btn>
              <Btn onClick={()=>{setShowAdd(false);setEditingId(null);setForm(emptyForm);}} variant="ghost">Cancel</Btn>
            </div>
          </div>
        </Card>
      )}

      {/* Payment history */}
      {bills.some(b=>(b.paymentHistory||[]).length>0)&&(
        <Card style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showHistory?12:0}}>
            <SectionLabel>Payment History</SectionLabel>
            <button onClick={()=>setShowHistory(s=>!s)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,fontFamily:"'Montserrat',sans-serif"}}>{showHistory?"Hide":"Show"}</button>
          </div>
          {showHistory&&(
            <div>
              {bills.flatMap(b=>(b.paymentHistory||[]).map(p=>({...p,billName:b.name}))).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20).map((p,i)=>(
                <div key={i}>
                  {i>0&&<Divider/>}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0"}}>
                    <div>
                      <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{p.billName}</div>
                      <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:1}}>{p.date}</div>
                    </div>
                    <div style={{fontSize:12,color:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{"-"+fmtAmt(p.amount)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Bills grouped by category */}
      {bills.length===0&&(
        <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
          <div style={{fontSize:28,marginBottom:8}}>B</div>
          <div>No bills tracked yet</div>
        </div>
      )}
      {grouped.map(({cat,items})=>{
        const catTotal=items.reduce((s,b)=>s+monthlyEq(b),0);
        const col=CAT_COLORS_B[cat]||t.MUTED;
        return (
          <div key={cat} style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:9,color:col,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:2,fontWeight:700}}>{cat}</div>
              <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{fmtAmt(catTotal)+"/mo"}</div>
            </div>
            <Card style={{borderLeft:"3px solid "+col}}>
              {items.map((b,i)=>{
                const diff=Math.round((new Date(b.nextDue+"T12:00:00")-new Date())/864e5);
                const urgent=diff<=3&&diff>=0;
                return (
                  <div key={b.id}>
                    {i>0&&<Divider/>}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0"}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:500}}>
                          {b.name}
                          {b.autopay&&<span style={{fontSize:9,color:t.GREEN,marginLeft:6,fontFamily:"'Montserrat',sans-serif"}}>auto</span>}
                        </div>
                        <div style={{display:"flex",gap:10,marginTop:2}}>
                          <span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{b.frequency.charAt(0).toUpperCase()+b.frequency.slice(1)}</span>
                          <span style={{fontSize:9,color:urgent?t.RED:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
                            {urgent?"Due soon: ":"Next: "}{b.nextDue}
                          </span>
                          {b.lastPaid&&<span style={{fontSize:9,color:t.GREEN,fontFamily:"'Montserrat',sans-serif"}}>{"paid "+b.lastPaid}</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:7,flexShrink:0,marginLeft:10}}>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:13,color:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{fmtAmt(b.amount)}</div>
                          {b.frequency!=="monthly"&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{fmtAmt(monthlyEq(b))+"/mo"}</div>}
                        </div>
                        <button onClick={()=>markPaid(b.id)} style={{background:t.GREEN+"14",border:"1px solid "+t.GREEN+"33",borderRadius:5,padding:"3px 7px",color:t.GREEN,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Paid</button>
                        <button onClick={()=>openEdit(b)} style={{background:t.GOLD+"14",border:"1px solid "+t.GOLD+"33",borderRadius:5,padding:"3px 7px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Edit</button>
                        {confirmDel===b.id?(
                          <div style={{display:"flex",gap:4}}>
                            <button onClick={()=>{setBills(bs=>bs.filter(x=>x.id!==b.id));setConfirmDel(null);}} style={{background:t.RED+"22",border:"1px solid "+t.RED+"44",borderRadius:4,padding:"2px 6px",color:t.RED,cursor:"pointer",fontSize:9,fontFamily:"'Montserrat',sans-serif"}}>Yes</button>
                            <button onClick={()=>setConfirmDel(null)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:4,padding:"2px 6px",color:t.MUTED,cursor:"pointer",fontSize:9,fontFamily:"'Montserrat',sans-serif"}}>No</button>
                          </div>
                        ):(
                          <button onClick={()=>setConfirmDel(b.id)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.4}}>X</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        );
      })}
    </div>
  );
}
function WatchlistItem({w,onRemove}){
  const t=T();
  const[price,setPrice]=useState(null);
  const[pct,setPct]=useState(null);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState(false);

  const fetchPrice=()=>{
    if(!w.ticker)return;
    setLoading(true);setError(false);
    quoteFetch("/api/quote?symbol="+encodeURIComponent(w.ticker))
      .then(r=>r.json())
      .then(d=>{
        if(d.price!=null){setPrice(d.price);setPct(d.pct);setError(false);}
        else setError(true);
        setLoading(false);
      })
      .catch(()=>{setError(true);setLoading(false);});
  };

  useEffect(()=>{
    fetchPrice();
    const id=setInterval(fetchPrice,60000); // refresh every 60s
    return()=>clearInterval(id);
  },[w.ticker]);

  return(
    <Card style={{marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <Tag>{w.ticker}</Tag>
            {w.name&&<span style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{w.name}</span>}
          </div>
          {w.notes&&<div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontStyle:"italic"}}>{w.notes}</div>}
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:3}}>{"Added: "+w.addedDate}</div>
        </div>
        <div style={{textAlign:"right",marginLeft:12,flexShrink:0}}>
          {loading?<Skeleton width={60} height={16}/>:error?(
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
              <div style={{fontSize:11,color:t.RED,fontFamily:"'Montserrat',sans-serif"}}>Failed to load</div>
              <button onClick={fetchPrice} style={{fontSize:10,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",background:"none",border:"none",cursor:"pointer",textDecoration:"underline",padding:0}}>↻ Retry</button>
            </div>
          ):price!=null?(
            <div>
              <div style={{fontSize:15,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{price>1?price.toLocaleString(_locale,{maximumFractionDigits:2}):price.toFixed(4)}</div>
              {pct!=null&&<div style={{fontSize:11,color:pct>=0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{(pct>=0?"▲ ":"▼ ")+Math.abs(pct).toFixed(2)+"%"}</div>}
            </div>
          ):<div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>No data</div>}
        </div>
        <button onClick={onRemove} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:13,opacity:.5,marginLeft:10}}>✕</button>
      </div>
    </Card>
  );
}

function InvestPage({profile,subscription,setShowUpgrade}){
  const t=T();
  const[tab,setTab]=useState("ideas");
  const asOfDate=new Date().toLocaleDateString("en-AU",{day:"numeric",month:"long",year:"numeric"});
  const[aiOpps,setAiOpps]=useState(()=>{try{return localStorage.getItem("invest_ai_cache")||"";}catch{return "";}});
  const[aiOppsDate,setAiOppsDate]=useState(()=>{try{return localStorage.getItem("invest_ai_date")||"";}catch{return "";}});
  const[loading,setLoading]=useState(false);
  const[aiError,setAiError]=useState("");
  // Persist watchlist in localStorage so it survives navigation
  const[watchlist,setWatchlist]=useState(()=>{try{const s=localStorage.getItem("invest_watchlist");return s?JSON.parse(s):[];}catch{return [];}});
  const[wForm,setWForm]=useState({ticker:"",name:"",notes:""});
  const[showWAdd,setShowWAdd]=useState(false);

  // Save watchlist to localStorage whenever it changes
  useEffect(()=>{try{localStorage.setItem("invest_watchlist",JSON.stringify(watchlist));}catch{}},[watchlist]);

  const getAi=async()=>{
    setLoading(true);setAiError("");
    try{
      const r=await claudeFetch({
        model:"claude-sonnet-4-6",
        max_tokens:800,
        tools:[{type:"web_search_20250305",name:"web_search"}],
        system:"Investment analyst for "+(profile?.riskProfile||["Growth"])[0]+" risk investor in Australia. Portfolio: Shares "+fmt(parseFloat(profile?.shareValue)||0)+", Property "+fmt(parseFloat(profile?.propertyValue)||0)+", Super "+fmt(parseFloat(profile?.superBalance)||0)+", Crypto "+fmt(parseFloat(profile?.cryptoValue)||0)+". Available cash: "+fmt(parseFloat(profile?.cashSavings)||0)+". Search for current market conditions. Give 3-4 specific opportunities with: NAME, ASSET CLASS, WHY NOW (specific current catalyst), SUGGESTED ALLOCATION, RISK. Be specific.",
        messages:[{role:"user",content:"What are the best opportunities right now given current market conditions? Search for latest data."}]
      });
      if(!r.ok){
        const err=await r.json().catch(()=>({}));
        if(r.status===403)setAiError("Executive subscription required to use Live AI Search.");
        else if(r.status===429)setAiError(err.error||"Rate limit reached — try again in an hour.");
        else setAiError("Server error ("+r.status+"). Try again shortly.");
        setLoading(false);return;
      }
      const d=await r.json();
      const result=(d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n")||"Unable to generate.";
      setAiOpps(result);setAiOppsDate(new Date().toLocaleDateString("en-AU"));
      try{localStorage.setItem("invest_ai_cache",result);localStorage.setItem("invest_ai_date",new Date().toLocaleDateString("en-AU"));}catch{}
    }catch(e){setAiError("Connection error — check your internet and try again.");}
    setLoading(false);
  };
  const ideas=[
    {name:"ASX Small Caps",cls:"Equities",ret:"+34% YTD",risk:"Med-High",note:"Rate cuts fuelling risk appetite in Australian small caps."},
    {name:"Global REITs",cls:"Property",ret:"+18%",risk:"Low-Med",note:"Rate normalisation creating re-rating opportunity."},
    {name:"Bitcoin ETF",cls:"Digital",ret:"+94% 1yr",risk:"High",note:"Post-ETF institutional adoption driving demand."},
    {name:"Private Credit",cls:"Fixed Income",ret:"9-13% pa",risk:"Low-Med",note:"Senior secured mid-market lending, floating rate."},
    {name:"AI Infrastructure",cls:"Equity",ret:"Varies",risk:"Med-High",note:"GPU cloud and data centre buildout continuing."}
  ];
  return (
    <div data-page="true" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Capital Deployment</div>
      <div style={{fontSize:26,color:t.TEXT,marginBottom:16}}>Opportunities</div>
      <div style={{display:"flex",gap:7,marginBottom:14}}>
        {[["ideas","Curated Ideas"],["live","Live AI Search"],["watchlist","My Watchlist"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"8px",borderRadius:7,border:"1px solid "+(tab===id?t.GOLD:t.BORDER),background:tab===id?t.GOLD+"18":"transparent",color:tab===id?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>
            {label}
          </button>
        ))}
      </div>
      {tab==="ideas"&&ideas.map((idea,i)=>(
        <Card key={i} style={{marginBottom:8,borderLeft:"3px solid "+t.GOLD}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
            <div>
              <div style={{fontSize:13,color:t.TEXT,marginBottom:2}}>{idea.name}</div>
              <div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1}}>{idea.cls}</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}>
              <div style={{fontSize:11,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{idea.ret}</div>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{idea.risk}</div>
            </div>
          </div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",lineHeight:1.6}}>{idea.note}</div>
        </Card>
      ))}
      {tab==="live"&&(
        <Card style={{borderColor:t.GOLD+"33"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:aiOpps||aiError?12:0}}>
            <div>
              <div style={{fontSize:10,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",letterSpacing:1,textTransform:"uppercase"}}>✦ Live Market Intelligence</div>
              <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>
                {aiOppsDate?"Last updated "+aiOppsDate:"Personalised · web search enabled"}
              </div>
            </div>
            <Btn onClick={getAi} disabled={loading}>{loading?"Searching...":(aiOpps?"Refresh":"Search Now 🌐")}</Btn>
          </div>
          {loading&&(
            <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
              {[90,75,85,70,80].map((w,i)=><Skeleton key={i} width={w+"%"} height={12}/>)}
              <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textAlign:"center",marginTop:4}}>Searching live markets...</div>
            </div>
          )}
          {aiError&&!loading&&(
            <div style={{padding:"10px 12px",background:t.RED+"10",border:"1px solid "+t.RED+"33",borderRadius:7,marginTop:8}}>
              <div style={{fontSize:12,color:t.RED,fontFamily:"'Montserrat',sans-serif"}}>{aiError}</div>
            </div>
          )}
          {aiOpps&&!loading&&!aiError&&<div style={{marginTop:10,fontSize:12,color:t.TEXT,lineHeight:1.85,fontFamily:"'Montserrat',sans-serif",whiteSpace:"pre-wrap"}}>{aiOpps}</div>}
          {!aiOpps&&!loading&&!aiError&&<div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:8}}>Tap Search Now to get current investment opportunities based on live market data, tailored to your portfolio and risk profile.</div>}
        </Card>
      )}
      {tab==="watchlist"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{watchlist.length+" stocks on watchlist"}</div>
            <Btn onClick={()=>setShowWAdd(s=>!s)} style={{padding:"6px 12px",fontSize:11}}>+ Add</Btn>
          </div>
          {showWAdd&&(
            <Card style={{marginBottom:12,borderColor:t.GOLD+"44"}}>
              <div style={{display:"flex",gap:7,marginBottom:7}}>
                <Inp value={wForm.ticker} onChange={e=>setWForm(f=>({...f,ticker:e.target.value.toUpperCase()}))} placeholder="Ticker (e.g. BHP.AX)" style={{flex:1}}/>
                <Inp value={wForm.name} onChange={e=>setWForm(f=>({...f,name:e.target.value}))} placeholder="Name" style={{flex:2}}/>
              </div>
              <Inp value={wForm.notes} onChange={e=>setWForm(f=>({...f,notes:e.target.value}))} placeholder="Notes - why watching?" style={{marginBottom:7}}/>
              <div style={{display:"flex",gap:7}}>
                <Btn onClick={()=>{if(!wForm.ticker)return;setWatchlist(w=>[...w,{...wForm,id:Date.now(),addedDate:todayStr()}]);setWForm({ticker:"",name:"",notes:""});setShowWAdd(false);}}>Add</Btn>
                <Btn onClick={()=>setShowWAdd(false)} variant="ghost">Cancel</Btn>
              </div>
            </Card>
          )}
          {watchlist.length===0&&!showWAdd&&(
            <div style={{textAlign:"center",padding:32,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
              <div style={{fontSize:28,marginBottom:8}}>W</div>
              <div>No stocks on watchlist - add tickers you want to monitor</div>
            </div>
          )}
          {watchlist.map((w,i)=>(
            <WatchlistItem key={w.id} w={w} onRemove={()=>setWatchlist(wl=>wl.filter(x=>x.id!==w.id))}/>
          ))}
        </div>
      )}
      <div style={{marginTop:14,padding:"10px 12px",background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:7,fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
        For informational purposes only. Not financial advice.
      </div>
    </div>
  );
}

function HealthPage({profile,supplements,setSupplements,bodyLog,setPage,subscription,setShowUpgrade,authToken}){
  const t=T();const isMobile=useIsMobile();const[showAdd,setShowAdd]=useState(false);const[form,setForm]=useState({name:"",dose:"",time:"morning",purpose:""});
  const[editingSupp,setEditingSupp]=useState(null);
  const[editForm,setEditForm]=useState({});
  const openEditSupp=(s)=>{setEditForm({name:s.name,dose:s.dose||"",time:s.time||"morning",purpose:s.purpose||""});setEditingSupp(s.id);setShowAdd(false);};
  const saveEditSupp=()=>{if(!editForm.name.trim())return;setSupplements(ss=>ss.map(s=>s.id===editingSupp?{...s,...editForm}:s));setEditingSupp(null);};
  const add=()=>{if(!form.name)return;setSupplements(ss=>[...ss,{...form,id:Date.now(),taken:false}]);setForm({name:"",dose:"",time:"morning",purpose:""});setShowAdd(false);};
  const done=(supplements||[]).filter(s=>s.taken).length;
  const latestLog=(bodyLog||[]).length?[...(bodyLog||[])].sort((a,b)=>b.date.localeCompare(a.date))[0]:null;
  const vitals=[
    {l:"Weight",v:(latestLog?.weight||profile.weight||"-")+"kg",sub:"Target: "+(profile.targetWeight||"?")+"kg"},
    {l:"Body Fat",v:(latestLog?.bodyFat||profile.bodyFat||"-")+"%",sub:"Target: 12%"},
    {l:"Sleep",v:(latestLog?.sleep||profile.sleepHours||"-")+"h",sub:"Target: 8h"},
    {l:"HRV",v:latestLog?.hrv||"-",sub:"Higher is better"}
  ];
  return (
    <div data-page="true" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Physical Capital</div>
      <div style={{fontSize:26,color:t.TEXT,marginBottom:16}}>Health and Vitals</div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(4,minmax(0,1fr))",gap:10,marginBottom:14}}>
        {vitals.map(v=><StatCard key={v.l} label={v.l} value={v.v} sub={v.sub}/>)}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button onClick={()=>setPage("body")} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:7,padding:"7px 12px",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>Log Metrics</button>
        <button onClick={()=>setPage("workout")} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"7px 12px",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>Workouts</button>
      </div>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <SectionLabel>{done+"/"+(supplements||[]).length+" taken today"}</SectionLabel>
          <Btn onClick={()=>setShowAdd(s=>!s)} style={{padding:"5px 10px",fontSize:10}}>+ Add</Btn>
        </div>
        <div style={{marginBottom:12}}><PB value={(supplements||[]).length?Math.round(done/(supplements||[]).length*100):0} color={t.BLUE} height={3}/></div>
        {showAdd&&(
          <div style={{marginBottom:12,padding:12,background:t.CARD2,borderRadius:7,border:"1px solid "+t.BORDER}}>
            <div style={{display:"flex",gap:7,marginBottom:7}}>
              <Inp value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Name" style={{flex:2}}/>
              <Inp value={form.dose} onChange={e=>setForm(f=>({...f,dose:e.target.value}))} placeholder="Dose" style={{flex:1}}/>
            </div>
            <div style={{display:"flex",gap:7,marginBottom:7}}>
              <Sel value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))} style={{flex:1}}>
                <option value="morning">Morning</option>
                <option value="evening">Evening</option>
                <option value="pre-workout">Pre-workout</option>
              </Sel>
              <Inp value={form.purpose} onChange={e=>setForm(f=>({...f,purpose:e.target.value}))} placeholder="Purpose" style={{flex:2}}/>
            </div>
            <div style={{display:"flex",gap:7}}>
              <Btn onClick={add} style={{fontSize:11}}>Add</Btn>
              <Btn onClick={()=>setShowAdd(false)} variant="ghost" style={{fontSize:11}}>Cancel</Btn>
            </div>
          </div>
        )}
        {editingSupp&&(
          <div style={{marginBottom:12,padding:12,background:t.GOLD+"0A",borderRadius:7,border:"1px solid "+t.GOLD+"33"}}>
            <div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Edit Supplement</div>
            <div style={{display:"flex",gap:7,marginBottom:7}}>
              <Inp value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} placeholder="Name" style={{flex:2}}/>
              <Inp value={editForm.dose} onChange={e=>setEditForm(f=>({...f,dose:e.target.value}))} placeholder="Dose" style={{flex:1}}/>
            </div>
            <div style={{display:"flex",gap:7,marginBottom:7}}>
              <Sel value={editForm.time} onChange={e=>setEditForm(f=>({...f,time:e.target.value}))} style={{flex:1}}>
                <option value="morning">Morning</option>
                <option value="pre-workout">Pre-workout</option>
                <option value="with food">With food</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
              </Sel>
              <Inp value={editForm.purpose} onChange={e=>setEditForm(f=>({...f,purpose:e.target.value}))} placeholder="Purpose" style={{flex:2}}/>
            </div>
            <div style={{display:"flex",gap:7}}>
              <Btn onClick={saveEditSupp} style={{fontSize:11}}>Save</Btn>
              <Btn onClick={()=>setEditingSupp(null)} variant="ghost" style={{fontSize:11}}>Cancel</Btn>
            </div>
          </div>
        )}
        {(supplements||[]).map((s,i)=>(
          <div key={s.id}
            draggable
            onDragStart={e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",String(i));e.currentTarget.style.opacity="0.4";}}
            onDragEnd={e=>{e.currentTarget.style.opacity="1";e.currentTarget.style.background="transparent";}}
            onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect="move";e.currentTarget.style.background=t.GOLD+"12";}}
            onDragLeave={e=>{e.currentTarget.style.background="transparent";}}
            onDrop={e=>{
              e.preventDefault();
              e.currentTarget.style.background="transparent";
              const fromIdx=parseInt(e.dataTransfer.getData("text/plain"));
              const toIdx=i;
              if(fromIdx===toIdx)return;
              setSupplements(ss=>{
                const arr=[...(ss||[])];
                const [moved]=arr.splice(fromIdx,1);
                arr.splice(toIdx,0,moved);
                return arr;
              });
            }}>
            {i>0&&<Divider/>}
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0"}}>
              <div style={{color:t.BORDER2,cursor:"grab",fontSize:14,flexShrink:0,userSelect:"none",lineHeight:1}}>⠿</div>
              <div onClick={()=>setSupplements(ss=>(ss||[]).map(x=>x.id===s.id?{...x,taken:!x.taken}:x))} style={{width:20,height:20,borderRadius:"50%",border:"1.5px solid "+(s.taken?t.GOLD:t.BORDER2),background:s.taken?t.GOLD:"transparent",flexShrink:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {s.taken&&<span style={{fontSize:9,color:"#080808",fontWeight:700}}>✓</span>}
              </div>
              <div style={{flex:1}}>
                <span style={{fontSize:12,color:s.taken?t.MUTED:t.TEXT,fontFamily:"'Montserrat',sans-serif",textDecoration:s.taken?"line-through":"none"}}>{s.name}</span>
                {s.dose&&<span style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{" - "+s.dose}</span>}
                {s.time&&<span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{" - "+s.time}</span>}
                {s.purpose&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:1}}>{s.purpose}</div>}
              </div>
              <button onClick={()=>openEditSupp(s)} style={{background:t.GOLD+"14",border:"1px solid "+t.GOLD+"33",borderRadius:5,padding:"2px 7px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Edit</button>
              <button onClick={()=>setSupplements(ss=>(ss||[]).filter(x=>x.id!==s.id))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.5}}>✕</button>
            </div>
          </div>
        ))}
        {!(supplements||[]).length&&<div style={{textAlign:"center",padding:"16px 0",color:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontSize:12}}>No supplements - add your stack</div>}
      </Card>
      {!isPro(subscription)&&<UpgradeHint message="✦ Get AI personalised supplement recommendations with The Executive" onUpgrade={()=>setShowUpgrade(true)}/>}
    </div>
  );
}

function BodyPage({bodyLog,setBodyLog,profile}){
  const t=T();const isMobile=useIsMobile();const[form,setForm]=useState({date:todayStr(),weight:"",bodyFat:"",sleep:"",hrv:""});
  const add=()=>{
    if(!form.weight&&!form.bodyFat&&!form.sleep&&!form.hrv)return;
    setBodyLog(l=>[{...form,id:Date.now()},...(l||[]).filter(e=>e.date!==form.date)]);
    setForm(f=>({...f,weight:"",bodyFat:"",sleep:"",hrv:""}));
  };
  const metrics=[
    {key:"weight",label:"Weight (kg)",color:t.GOLD,target:parseFloat(profile.targetWeight)||82},
    {key:"bodyFat",label:"Body Fat %",color:t.PURPLE,target:12},
    {key:"sleep",label:"Sleep (hrs)",color:t.BLUE,target:8},
    {key:"hrv",label:"HRV",color:t.GREEN,target:70}
  ];
  return (
    <div data-page="true" style={{maxWidth:680,margin:"0 auto"}}>
      <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Body Tracking</div>
      <div style={{fontSize:26,color:t.TEXT,marginBottom:16}}>Metrics History</div>
      <Card style={{marginBottom:14,borderColor:t.GOLD+"44"}}>
        <SectionLabel>Log Today</SectionLabel>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(4,minmax(0,1fr))",gap:8,marginBottom:8}}>
          {[["weight","kg"],["bodyFat","BF%"],["sleep","hrs"],["hrv","HRV"]].map(([k,ph])=>(
            <Inp key={k} type="number" value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} placeholder={ph} style={{fontSize:12}}/>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          <Inp type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={{flex:1}}/>
          <Btn onClick={add}>Log</Btn>
        </div>
      </Card>
      {metrics.map(m=>{
        const data=(bodyLog||[]).filter(e=>e[m.key]).map(e=>({date:e.date,v:parseFloat(e[m.key])})).sort((a,b)=>a.date.localeCompare(b.date)).slice(-20);
        const latest=data[data.length-1];
        return (
          <Card key={m.key} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <div>
                <div style={{fontSize:9,color:m.color,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>{m.label}</div>
                {latest?(
                  <div style={{fontSize:20,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>
                    {latest.v}
                    <span style={{fontSize:10,color:t.MUTED}}>{" target: "+m.target}</span>
                  </div>
                ):<div style={{fontSize:12,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>No data yet</div>}
              </div>
              {data.length>=2&&(
                <div style={{fontSize:11,color:data[data.length-1].v<=data[0].v?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif"}}>
                  {(data[data.length-1].v-data[0].v).toFixed(1)}
                </div>
              )}
            </div>
            {data.length>=2?(
              <div style={{position:"relative"}}>
                <SparkLine data={data.map(d=>d.v)} color={m.color} height={40} target={m.target}/>
                {m.target&&(
                  <div style={{position:"absolute",top:0,right:0,fontSize:8,color:m.color,fontFamily:"'Montserrat',sans-serif",background:t.CARD,padding:"1px 4px",borderRadius:3,opacity:.8}}>
                    {"Target: "+m.target}
                  </div>
                )}
              </div>
            ):(
              <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textAlign:"center",padding:"10px 0"}}>Log more data to see trend</div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function WorkoutPage({workouts,setWorkouts,profile,subscription,setShowUpgrade,authToken}){
  const t=T();const isMobile=useIsMobile();const[showAdd,setShowAdd]=useState(false);const[tab,setTab]=useState("log");
  const[wf,setWf]=useState({date:todayStr(),type:"Strength",duration:60,notes:"",sets:[]});
  const[sf,setSf]=useState({exercise:"Bench Press",sets:3,reps:8,weight:""});
  const[plan,setPlan]=useState(null);const[planLoading,setPlanLoading]=useState(false);
  const[selectedEx,setSelectedEx]=useState(null);
  const save=()=>{if(!wf.sets.length&&!wf.notes)return;setWorkouts(ws=>[{...wf,id:Date.now()},...ws]);setWf({date:todayStr(),type:"Strength",duration:60,notes:"",sets:[]});setShowAdd(false);};
  const prs={};
  [...(workouts||[])].reverse().forEach(w=>w.sets&&w.sets.forEach(s=>{
    if(s.weight&&parseFloat(s.weight)>0&&(!prs[s.exercise]||parseFloat(s.weight)>parseFloat(prs[s.exercise].weight)))
      prs[s.exercise]={weight:s.weight,reps:s.reps,date:w.date};
  }));

  const EXERCISE_GUIDE={
    "Bench Press":{muscle:"Chest, Triceps, Shoulders",level:"Beginner",category:"Push",
      steps:["Lie flat on bench, feet on floor","Grip bar slightly wider than shoulder width","Lower bar to mid-chest with control","Press back up to full extension","Keep wrists straight throughout"],
      tips:"Keep shoulder blades retracted and lower back neutral. Don't bounce bar off chest.",
      animation:"push"},
    "Squat":{muscle:"Quads, Glutes, Hamstrings",level:"Beginner",category:"Legs",
      steps:["Stand with feet shoulder-width apart, toes slightly out","Brace core and keep chest up","Descend until thighs are parallel or below","Drive through heels to stand","Keep knees tracking over toes"],
      tips:"Depth is key — aim for parallel. If heels rise, work on ankle mobility.",
      animation:"squat"},
    "Deadlift":{muscle:"Hamstrings, Glutes, Back, Traps",level:"Intermediate",category:"Pull",
      steps:["Stand with bar over mid-foot","Hip-hinge to grip bar, hands just outside shins","Take slack out of bar, engage lats","Drive floor away, keep bar close to body","Lock out hips and knees at top"],
      tips:"The bar should drag up your shins. Never round your lower back under load.",
      animation:"hinge"},
    "Overhead Press":{muscle:"Shoulders, Triceps, Upper Chest",level:"Intermediate",category:"Push",
      steps:["Stand with feet shoulder-width, bar at collarbone","Grip just outside shoulders","Press bar straight up, tuck chin to let bar pass","Lock out at top, squeeze shoulders","Lower under control to starting position"],
      tips:"Squeeze glutes and abs throughout. Don't lean back excessively.",
      animation:"press"},
    "Pull-ups":{muscle:"Lats, Biceps, Rear Delts",level:"Intermediate",category:"Pull",
      steps:["Hang from bar with overhand grip, hands shoulder-width","Depress shoulder blades to initiate","Pull elbows down and back toward hips","Chin clears bar at top","Lower slowly with control"],
      tips:"Think about pulling elbows to your pockets, not pulling your hands down.",
      animation:"pullup"},
    "Romanian Deadlift":{muscle:"Hamstrings, Glutes, Lower Back",level:"Intermediate",category:"Pull",
      steps:["Stand with bar at hips, slight knee bend","Hinge at hips pushing them back","Lower bar down legs keeping it close","Feel hamstring stretch at bottom","Drive hips forward to return to start"],
      tips:"This is a hinge not a squat. Feel the stretch in your hamstrings at the bottom.",
      animation:"hinge"},
    "Rows":{muscle:"Lats, Rhomboids, Biceps",level:"Beginner",category:"Pull",
      steps:["Hinge forward at hips to 45 degrees","Grip barbell with overhand or neutral grip","Pull bar to lower chest/upper abdomen","Squeeze shoulder blades at top","Lower with control"],
      tips:"Lead with your elbows, not your hands. Avoid using momentum.",
      animation:"row"},
    "Dips":{muscle:"Chest, Triceps, Shoulders",level:"Intermediate",category:"Push",
      steps:["Grip parallel bars, arms straight","Lean slightly forward for chest emphasis","Lower body until upper arms are parallel","Press back up to full extension","Keep elbows close to body for tricep focus"],
      tips:"Control the descent. Flaring elbows works more chest; keeping them in works triceps.",
      animation:"push"},
    "Lunges":{muscle:"Quads, Glutes, Hamstrings",level:"Beginner",category:"Legs",
      steps:["Stand with feet hip-width apart","Step forward with one foot","Lower back knee toward floor","Front thigh parallel to floor at bottom","Push through front heel to return"],
      tips:"Keep your torso upright and front knee over your ankle, not past your toes.",
      animation:"squat"},
    "Plank":{muscle:"Core, Shoulders, Glutes",level:"Beginner",category:"Core",
      steps:["Forearms on floor, elbows under shoulders","Extend legs behind, toes on floor","Form straight line from head to heels","Brace abs and squeeze glutes","Breathe steadily, hold position"],
      tips:"Don't let hips sag or pike up. Imagine you're trying to pull your elbows to your feet.",
      animation:"hold"},
    "Hip Thrust":{muscle:"Glutes, Hamstrings",level:"Beginner",category:"Legs",
      steps:["Sit against bench, bar across hips","Feet flat on floor, knees bent 90°","Drive hips up until body is straight","Squeeze glutes hard at the top","Lower with control, don't rest at bottom"],
      tips:"The movement comes from the hips, not the lower back. Chin tucked throughout.",
      animation:"thrust"},
    "Incline Bench Press":{muscle:"Upper Chest, Shoulders, Triceps",level:"Beginner",category:"Push",
      steps:["Set bench to 30-45 degree incline","Lie back, feet flat on floor","Grip bar slightly wider than shoulder-width","Lower bar to upper chest with control","Press back to full extension"],
      tips:"A higher incline shifts more work to the front deltoid. 30° is optimal for upper chest.",
      animation:"push"},
    "Lat Pulldown":{muscle:"Lats, Biceps, Rear Delts",level:"Beginner",category:"Pull",
      steps:["Sit at cable station, thighs under pads","Grip bar wider than shoulder-width","Lean back slightly and depress shoulders","Pull bar to upper chest leading with elbows","Slowly return bar overhead with control"],
      tips:"Don't use momentum. Think about driving your elbows into your back pockets.",
      animation:"pullup"},
    "Bulgarian Split Squat":{muscle:"Quads, Glutes, Hip Flexors",level:"Advanced",category:"Legs",
      steps:["Rear foot elevated on bench","Front foot forward enough for 90° knee bend","Lower back knee toward floor","Keep torso upright throughout","Drive through front heel to stand"],
      tips:"One of the best single-leg exercises. Go slow — balance takes time to develop.",
      animation:"squat"},
    "Tricep Pushdown":{muscle:"Triceps",level:"Beginner",category:"Push",
      steps:["Stand at cable, rope or bar attachment","Elbows pinned to sides, upper arms vertical","Extend forearms down until arms straight","Squeeze triceps at full extension","Slowly return to starting position"],
      tips:"Keep your upper arms completely still. Only your forearms should move.",
      animation:"push"},
    "Bicep Curl":{muscle:"Biceps, Forearms",level:"Beginner",category:"Pull",
      steps:["Stand with dumbbells at sides, palms forward","Keep upper arms still at sides","Curl weights up to shoulder level","Squeeze biceps at the top","Lower slowly with full control"],
      tips:"Don't swing your body. Go lighter and focus on the squeeze at the top.",
      animation:"curl"},
  };

  // SVG stick figure animations
  function ExerciseAnimation({type,color}){
    const t=T();
    const [frame,setFrame]=useState(0);
    useEffect(()=>{
      const id=setInterval(()=>setFrame(f=>(f+1)%60),33); // ~30fps
      return()=>clearInterval(id);
    },[]);
    const progress=(Math.sin(frame/60*Math.PI*2)+1)/2; // 0-1 oscillating

    // Stick figure parts — centered at 60,80
    const head=(x,y)=><circle cx={x} cy={y} r="8" fill="none" stroke={color||t.GOLD} strokeWidth="2"/>;
    const body=(x1,y1,x2,y2)=><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>;

    if(type==="squat"){
      const bend=progress*35; // 0=standing, 35=deep squat
      const hipY=60+bend;
      return(<svg width="120" height="140" viewBox="0 0 120 140">
        {head(60,18)}
        {body(60,26,60,50-bend*0.3)} {/* torso tilts */}
        {/* left leg */}
        <line x1={60} y1={50-bend*0.3} x2={45-bend*0.3} y2={hipY} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        <line x1={45-bend*0.3} y1={hipY} x2={40} y2={100} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        {/* right leg */}
        <line x1={60} y1={50-bend*0.3} x2={75+bend*0.3} y2={hipY} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        <line x1={75+bend*0.3} y1={hipY} x2={80} y2={100} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        {/* arms */}
        {body(60,32,44-bend*0.2,45+bend*0.3)}
        {body(60,32,76+bend*0.2,45+bend*0.3)}
        {/* ground */}
        <line x1="20" y1="104" x2="100" y2="104" stroke={t.BORDER} strokeWidth="1"/>
        <text x="60" y="120" textAnchor="middle" fill={t.MUTED} fontSize="9" fontFamily="sans-serif">Squat</text>
      </svg>);
    }

    if(type==="push"){
      const pushY=progress*20; // chest moves down/up
      return(<svg width="120" height="140" viewBox="0 0 120 140">
        {/* lying figure pushing */}
        {head(30+pushY*0.5,55-pushY*0.3)}
        {body(38+pushY*0.5,58-pushY*0.3,80,65)} {/* torso */}
        {/* arms pushing */}
        <line x1={38+pushY*0.5} y1={60-pushY*0.3} x2={30} y2={70+pushY} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        <line x1={30} y1={70+pushY} x2={20} y2={75+pushY} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        {/* legs */}
        {body(80,65,95,68)}
        {body(95,68,105,72)}
        {/* bar */}
        <line x1="15" y1={72+pushY} x2="35" y2={72+pushY} stroke={color||t.GOLD} strokeWidth="3" strokeLinecap="round"/>
        <line x1="20" y1="72" x2="20" y2={72+pushY} stroke={t.MUTED} strokeWidth="1" strokeDasharray="2,2"/>
        <text x="60" y="105" textAnchor="middle" fill={t.MUTED} fontSize="9" fontFamily="sans-serif">Press</text>
      </svg>);
    }

    if(type==="pullup"){
      const pullY=progress*25; // body moves up
      return(<svg width="120" height="140" viewBox="0 0 120 140">
        {/* bar at top */}
        <line x1="20" y1="15" x2="100" y2="15" stroke={color||t.GOLD} strokeWidth="3"/>
        {head(60,35-pullY)}
        {body(60,43-pullY,60,65-pullY)}
        {/* arms up to bar */}
        <line x1={60} y1={43-pullY} x2={40} y2={20} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        <line x1={60} y1={43-pullY} x2={80} y2={20} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        {/* legs hanging */}
        <line x1={60} y1={65-pullY} x2={55} y2={85-pullY} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        <line x1={55} y1={85-pullY} x2={52} y2={100-pullY} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        <line x1={60} y1={65-pullY} x2={65} y2={85-pullY} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        <line x1={65} y1={85-pullY} x2={68} y2={100-pullY} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        <text x="60" y="125" textAnchor="middle" fill={t.MUTED} fontSize="9" fontFamily="sans-serif">Pull</text>
      </svg>);
    }

    if(type==="hinge"){
      const angle=progress*40; // hip hinge angle
      return(<svg width="120" height="140" viewBox="0 0 120 140">
        {/* standing hinge */}
        <line x1="60" y1="85" x2="60" y2="105" stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        <line x1="60" y1="105" x2="45" y2="120" stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        <line x1="60" y1="105" x2="75" y2="120" stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        {/* torso hinges */}
        {head(60-angle*0.6,35+angle*0.4)}
        <line x1={60-angle*0.6} y1={43+angle*0.4} x2={60} y2={85} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        {/* arms hang down */}
        <line x1={60-angle*0.6} y1={55+angle*0.3} x2={55-angle*0.4} y2={80+angle*0.3} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        <line x1={60-angle*0.6} y1={55+angle*0.3} x2={65-angle*0.4} y2={80+angle*0.3} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        {/* bar */}
        <line x1={45-angle*0.5} y1={82+angle*0.3} x2={70-angle*0.5} y2={82+angle*0.3} stroke={color||t.GOLD} strokeWidth="3" strokeLinecap="round"/>
        <line x1="20" y1="123" x2="100" y2="123" stroke={t.BORDER} strokeWidth="1"/>
        <text x="60" y="135" textAnchor="middle" fill={t.MUTED} fontSize="9" fontFamily="sans-serif">Hinge</text>
      </svg>);
    }

    if(type==="row"){
      const pull=progress*20;
      return(<svg width="120" height="140" viewBox="0 0 120 140">
        {head(35,30)}
        {/* torso bent forward */}
        <line x1={35} y1={38} x2={70} y2={65} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        {/* legs */}
        <line x1={70} y1={65} x2={65} y2={100} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        <line x1={70} y1={65} x2={80} y2={100} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        {/* pulling arm */}
        <line x1={45} y1={48} x2={30+pull} y2={60} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        <line x1={30+pull} y1={60} x2={20+pull} y2={68} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        {/* bar */}
        <line x1={15+pull} y1={68} x2={30+pull} y2={68} stroke={color||t.GOLD} strokeWidth="3" strokeLinecap="round"/>
        <line x1="20" y1="104" x2="100" y2="104" stroke={t.BORDER} strokeWidth="1"/>
        <text x="60" y="118" textAnchor="middle" fill={t.MUTED} fontSize="9" fontFamily="sans-serif">Row</text>
      </svg>);
    }

    if(type==="press"){
      const pressH=progress*25;
      return(<svg width="120" height="140" viewBox="0 0 120 140">
        {head(60,25)}
        {body(60,33,60,70)}
        {/* legs */}
        <line x1={60} y1={70} x2={48} y2={105} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        <line x1={60} y1={70} x2={72} y2={105} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        {/* arms pressing overhead */}
        <line x1={60} y1={45} x2={40} y2={55-pressH*0.5} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        <line x1={40} y1={55-pressH*0.5} x2={35} y2={40-pressH} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        <line x1={60} y1={45} x2={80} y2={55-pressH*0.5} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        <line x1={80} y1={55-pressH*0.5} x2={85} y2={40-pressH} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        {/* bar */}
        <line x1="28" y1={40-pressH} x2="92" y2={40-pressH} stroke={color||t.GOLD} strokeWidth="3" strokeLinecap="round"/>
        <line x1="20" y1="108" x2="100" y2="108" stroke={t.BORDER} strokeWidth="1"/>
        <text x="60" y="122" textAnchor="middle" fill={t.MUTED} fontSize="9" fontFamily="sans-serif">Press</text>
      </svg>);
    }

    if(type==="curl"){
      const curl=progress*50; // forearm angle
      return(<svg width="120" height="140" viewBox="0 0 120 140">
        {head(60,18)}
        {body(60,26,60,65)}
        {/* legs */}
        <line x1={60} y1={65} x2={48} y2={100} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        <line x1={60} y1={65} x2={72} y2={100} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        {/* curling arm */}
        <line x1={60} y1={40} x2={40} y2={55} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        <line x1={40} y1={55} x2={35+curl*0.2} y2={75-curl*0.3} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        {/* other arm */}
        <line x1={60} y1={40} x2={80} y2={55} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        <line x1={80} y1={55} x2={85} y2={75} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        <line x1="20" y1="104" x2="100" y2="104" stroke={t.BORDER} strokeWidth="1"/>
        <text x="60" y="118" textAnchor="middle" fill={t.MUTED} fontSize="9" fontFamily="sans-serif">Curl</text>
      </svg>);
    }

    if(type==="thrust"){
      const up=progress*25;
      return(<svg width="120" height="140" viewBox="0 0 120 140">
        {/* bench */}
        <rect x="55" y={85-up} width="50" height="8" rx="2" fill={t.CARD2} stroke={t.BORDER}/>
        {head(40,40+up*0.2)}
        {/* torso rising */}
        <line x1={40} y1={48+up*0.2} x2={70} y2={78-up} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        {/* legs */}
        <line x1={70} y1={78-up} x2={80} y2={100} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        <line x1={70} y1={78-up} x2={90} y2={100} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
        {/* bar on hips */}
        <line x1="50" y1={78-up} x2="90" y2={78-up} stroke={color||t.GOLD} strokeWidth="3" strokeLinecap="round"/>
        <line x1="20" y1="104" x2="110" y2="104" stroke={t.BORDER} strokeWidth="1"/>
        <text x="60" y="118" textAnchor="middle" fill={t.MUTED} fontSize="9" fontFamily="sans-serif">Hip Thrust</text>
      </svg>);
    }

    // Default hold/plank animation
    const wobble=progress*4-2;
    return(<svg width="120" height="140" viewBox="0 0 120 140">
      {head(25+wobble*0.2,55)}
      {/* plank body */}
      <line x1={33} y1={60} x2={90} y2={65+wobble*0.2} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
      {/* forearms */}
      <line x1={33} y1={60} x2={25} y2={75} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
      <line x1={25} y1={75} x2={15} y2={76} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
      <line x1={50} y1={62} x2={45} y2={76} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
      <line x1={45} y1={76} x2={35} y2={77} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
      {/* legs */}
      <line x1={90} y1={65} x2={100} y2={78} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
      <line x1={100} y1={78} x2={105} y2={79} stroke={color||t.GOLD} strokeWidth="2" strokeLinecap="round"/>
      <line x1="10" y1="80" x2="110" y2="80" stroke={t.BORDER} strokeWidth="1"/>
      <text x="60" y="100" textAnchor="middle" fill={t.MUTED} fontSize="9" fontFamily="sans-serif">Hold</text>
    </svg>);
  }

  const[planError,setPlanError]=useState("");
  const getWorkoutPlan=async()=>{
    if(!isPro(subscription)){setShowUpgrade(true);return;}
    setPlanLoading(true);setPlan(null);setPlanError("");
    const goals=(profile?.healthGoals||["Build Muscle"]).join(", ");
    const fitnessLevel=profile?.fitnessLevel||"Intermediate";
    const age=profile?.dob?calcAge(profile.dob):(profile?.age||30);
    try{
      const r=await claudeFetch({
        model:"claude-haiku-4-5",max_tokens:1500,
        system:"You are an expert personal trainer. Return ONLY valid JSON, no markdown, no explanation.",
        messages:[{role:"user",content:"Create a 4-day workout split for: goals: "+goals+", fitness level: "+fitnessLevel+", age: "+age+". Use only real exercises. Return JSON exactly: {\"split\": \"string describing the split\", \"days\": [{\"name\": \"Day 1\", \"focus\": \"string\", \"exercises\": [{\"exercise\": \"string\", \"sets\": 3, \"reps\": \"8-10\", \"rest\": \"60s\", \"note\": \"string\"}]}]}"}]
      }, authToken);
      if(!r.ok){
        const err=await r.json().catch(()=>({}));
        setPlanError(err.error||"Failed to generate plan. Try again.");
        setPlanLoading(false);return;
      }
      const d=await r.json();
      const text=(d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("");
      const start=text.indexOf("{"),end=text.lastIndexOf("}");
      if(start>-1){
        const parsed=JSON.parse(text.slice(start,end+1));
        if(parsed?.days?.length>0)setPlan(parsed);
        else setPlanError("Received invalid plan format. Try again.");
      } else {
        setPlanError("No plan returned. Try again.");
      }
    }catch(e){
      console.error("Plan error:",e);
      setPlanError("Connection error. Check your internet and try again.");
    }
    setPlanLoading(false);
  };
  return (
    <div data-page="true" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Iron and Conditioning</div>
          <div style={{fontSize:26,color:t.TEXT}}>Workout Log</div>
        </div>
        <Btn onClick={()=>setShowAdd(s=>!s)}>+ Log</Btn>
      </div>
      <div style={{display:"flex",gap:7,marginBottom:14}}>
        {[["log","Log"],["progress","Progress"],["records","Records"],["exercises","Library"],["plan","AI Plan"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"7px",borderRadius:7,border:"1px solid "+(tab===id?t.GOLD:t.BORDER),background:tab===id?t.GOLD+"18":"transparent",color:tab===id?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>
            {label}
          </button>
        ))}
      </div>
      {showAdd&&(
        <Card style={{marginBottom:14,borderColor:t.GOLD+"44"}}>
          <SectionLabel>New Session</SectionLabel>
          <div style={{display:"flex",gap:7,marginBottom:8,flexWrap:"wrap"}}>
            <Inp type="date" value={wf.date} onChange={e=>setWf(f=>({...f,date:e.target.value}))} style={{flex:1,minWidth:120}}/>
            <Sel value={wf.type} onChange={e=>setWf(f=>({...f,type:e.target.value}))} style={{flex:1}}>
              {WTYPES.map(wt=><option key={wt}>{wt}</option>)}
            </Sel>
            <Inp type="number" value={wf.duration} onChange={e=>setWf(f=>({...f,duration:e.target.value}))} placeholder="Min" style={{width:70}}/>
          </div>
          <div style={{display:"flex",gap:6,marginBottom:7,flexWrap:"wrap"}}>
            <Sel value={sf.exercise} onChange={e=>setSf(f=>({...f,exercise:e.target.value}))} style={{flex:2,minWidth:130}}>
              {EXERCISES.map(ex=><option key={ex}>{ex}</option>)}
            </Sel>
            <Inp type="number" value={sf.sets} onChange={e=>setSf(f=>({...f,sets:e.target.value}))} placeholder="Sets" style={{width:55}}/>
            <Inp type="number" value={sf.reps} onChange={e=>setSf(f=>({...f,reps:e.target.value}))} placeholder="Reps" style={{width:55}}/>
            <Inp type="number" value={sf.weight} onChange={e=>setSf(f=>({...f,weight:e.target.value}))} placeholder="kg" style={{width:55}}/>
            <Btn onClick={()=>setWf(f=>({...f,sets:[...f.sets,{...sf,id:Date.now()}]}))}>+</Btn>
          </div>
          {wf.sets.map(s=>(
            <div key={s.id} style={{display:"flex",justifyContent:"space-between",padding:"3px 8px",background:t.CARD2,borderRadius:4,marginBottom:3}}>
              <span style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{s.exercise}</span>
              <span style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{s.sets+"x"+s.reps+(s.weight?" @ "+s.weight+"kg":"")}</span>
              <button onClick={()=>setWf(f=>({...f,sets:f.sets.filter(x=>x.id!==s.id)}))} style={{background:"none",border:"none",color:t.RED,cursor:"pointer",fontSize:10}}>X</button>
            </div>
          ))}
          <textarea spellCheck={true} autoCorrect="on" autoCapitalize="sentences" value={wf.notes} onChange={e=>setWf(f=>({...f,notes:e.target.value}))} placeholder="Notes..." rows={2} style={{width:"100%",background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:6,padding:"7px 10px",color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontSize:12,outline:"none",resize:"vertical",marginTop:7,boxSizing:"border-box"}}/>
          <div style={{display:"flex",gap:8,marginTop:8}}>
            <Btn onClick={save}>Save</Btn>
            <Btn onClick={()=>setShowAdd(false)} variant="ghost">Cancel</Btn>
          </div>
        </Card>
      )}
      {tab==="records"&&(
        <Card>
          <SectionLabel>Personal Records</SectionLabel>
          {Object.entries(prs).length===0&&<div style={{textAlign:"center",padding:"20px 0",color:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontSize:12}}>Log workouts with weights to see records</div>}
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {Object.entries(prs).slice(0,12).map(([ex,pr])=>(
              <div key={ex} style={{background:t.CARD2,borderRadius:8,padding:"10px 12px",minWidth:120,flex:1}}>
                <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:4}}>{ex}</div>
                <div style={{fontSize:18,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{pr.weight+"kg"}</div>
                <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>{"x"+pr.reps+" - "+fmtDate(pr.date)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      {tab==="progress"&&(()=>{
        const last8weeks=Array.from({length:8}).map((_,i)=>{
          const d=new Date();d.setDate(d.getDate()-(7-1)*i);
          const wkStart=new Date(d);wkStart.setDate(d.getDate()-6);
          const wkEnd=d;
          const wkWorkouts=(workouts||[]).filter(w=>{const wd=new Date(w.date+"T12:00:00");return wd>=wkStart&&wd<=wkEnd;});
          const totalSets=wkWorkouts.reduce((s,w)=>s+(w.sets?.length||0),0);
          const totalVol=wkWorkouts.reduce((s,w)=>s+(w.sets||[]).reduce((ss,set)=>ss+(parseFloat(set.weight)||0)*(parseFloat(set.reps)||0)*(parseFloat(set.sets)||1),0),0);
          return{label:wkStart.toLocaleDateString([],{day:"numeric",month:"short"}),sessions:wkWorkouts.length,sets:totalSets,vol:Math.round(totalVol)};
        }).reverse();
        const maxSets=Math.max(...last8weeks.map(w=>w.sets),1);
        const maxVol=Math.max(...last8weeks.map(w=>w.vol),1);
        const totalWorkouts=(workouts||[]).length;
        const totalSetsAll=(workouts||[]).reduce((s,w)=>s+(w.sets?.length||0),0);
        const avgPerWeek=last8weeks.length?Math.round(last8weeks.reduce((s,w)=>s+w.sessions,0)/last8weeks.length*10)/10:0;
        return (
          <div style={{display:"flex",flexDirection:"column",gap:14,position:"relative"}}>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,minmax(0,1fr))",gap:10}}>
              <StatCard label="Total Sessions" value={totalWorkouts} color={t.GOLD}/>
              <StatCard label="Total Exercises" value={totalSetsAll} color={t.BLUE}/>
              <StatCard label="Avg per Week" value={avgPerWeek} color={t.GREEN}/>
            </div>
            <Card>
              <SectionLabel>Weekly Volume (sets)</SectionLabel>
              <div style={{display:"flex",gap:4,alignItems:"flex-end",height:80,marginBottom:6}}>
                {last8weeks.map((w,i)=>(
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                    <div style={{fontSize:8,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{w.sets||""}</div>
                    <div style={{width:"100%",background:i===last8weeks.length-1?t.GOLD+"cc":t.GOLD+"44",borderRadius:"3px 3px 0 0",height:((w.sets/maxSets)*60)+"px",minHeight:w.sets>0?3:0,transition:"height .3s"}}/>
                    <div style={{fontSize:7,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textAlign:"center"}}>{w.label}</div>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <SectionLabel>Weekly Total Volume (kg lifted)</SectionLabel>
              <div style={{display:"flex",gap:4,alignItems:"flex-end",height:80,marginBottom:6}}>
                {last8weeks.map((w,i)=>(
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                    <div style={{fontSize:8,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{w.vol>0?w.vol:""}</div>
                    <div style={{width:"100%",background:i===last8weeks.length-1?t.PURPLE+"cc":t.PURPLE+"44",borderRadius:"3px 3px 0 0",height:((w.vol/maxVol)*60)+"px",minHeight:w.vol>0?3:0,transition:"height .3s"}}/>
                    <div style={{fontSize:7,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textAlign:"center"}}>{w.label}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        );
      })()}
      {tab==="log"&&(
        <div>
          {!(workouts||[]).length&&!showAdd&&<div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}><div style={{fontSize:32,marginBottom:10}}>W</div><div>No sessions yet</div></div>}
          {(workouts||[]).map(w=>(
            <Card key={w.id} style={{marginBottom:8,borderLeft:"3px solid "+(WCOLORS[w.type]||t.GOLD)}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontSize:9,color:WCOLORS[w.type]||t.GOLD,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",marginBottom:2}}>{w.type+" - "+w.duration+" min"}</div>
                  <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{fmtDate(w.date)}</div>
                </div>
                <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{(w.sets?.length||0)+" exercises"}</div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── PLAN TAB ── */}
      {tab==="plan"&&(
        <div>
          <Card style={{marginBottom:14,borderColor:t.GOLD+"33"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:plan||planLoading?12:0}}>
              <div>
                <div style={{fontSize:10,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",letterSpacing:1,textTransform:"uppercase"}}>✦ AI Workout Plan</div>
                <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>
                  {(profile?.healthGoals||[]).join(", ")||"Set health goals in Profile for a personalised plan"}
                </div>
              </div>
              <button onClick={getWorkoutPlan} disabled={planLoading} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:7,padding:"6px 12px",color:t.GOLD,cursor:planLoading?"default":"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>
                {planLoading?"Building...":(plan?"Regenerate":"Generate Plan")}
              </button>
            </div>
            {planLoading&&<div style={{display:"flex",flexDirection:"column",gap:8}}>{[90,75,85,70,80].map((w,i)=><Skeleton key={i} width={w+"%"} height={11}/>)}</div>}
            {planError&&!planLoading&&(
              <div style={{padding:"10px 12px",background:t.RED+"10",border:"1px solid "+t.RED+"33",borderRadius:7,marginTop:8}}>
                <div style={{fontSize:12,color:t.RED,fontFamily:"'Montserrat',sans-serif"}}>{planError}</div>
              </div>
            )}
            {!plan&&!planLoading&&(
              <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:8,lineHeight:1.7}}>
                Generate a personalised 4-day split based on your health goals. Tap any exercise in the plan to see form cues and animation.
              </div>
            )}
            {plan&&!planLoading&&(
              <div>
                <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:12,fontStyle:"italic"}}>{plan.split}</div>
                {(plan.days||[]).map((day,di)=>(
                  <div key={di} style={{marginBottom:14}}>
                    <div style={{fontSize:10,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:8,paddingBottom:4,borderBottom:"1px solid "+t.GOLD+"33"}}>{day.name+" — "+day.focus}</div>
                    {(day.exercises||[]).map((ex,ei)=>{
                      const hasGuide=!!EXERCISE_GUIDE[ex.exercise];
                      return(
                        <div key={ei} onClick={()=>{if(hasGuide){setSelectedEx(ex.exercise);setTab("exercises");}}}
                          style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid "+t.BORDER,cursor:hasGuide?"pointer":"default"}}>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <div style={{fontSize:12,color:hasGuide?t.GOLD:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:500}}>{ex.exercise}</div>
                              {hasGuide&&<span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>▸ guide</span>}
                            </div>
                            {ex.note&&<div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:1}}>{ex.note}</div>}
                          </div>
                          <div style={{display:"flex",gap:5,flexShrink:0,marginLeft:8}}>
                            {[{v:ex.sets+"x",l:"sets"},{v:ex.reps,l:"reps"},{v:ex.rest,l:"rest"}].map(m=>(
                              <div key={m.l} style={{textAlign:"center",background:t.CARD2,borderRadius:5,padding:"3px 6px"}}>
                                <div style={{fontSize:11,color:t.GOLD,fontWeight:700}}>{m.v}</div>
                                <div style={{fontSize:8,color:t.MUTED}}>{m.l}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </Card>
          {!isPro(subscription)&&<UpgradeHint message="✦ Generate AI workout plans with The Executive" onUpgrade={()=>setShowUpgrade(true)}/>}
        </div>
      )}

      {/* ── EXERCISES TAB ── */}
      {tab==="exercises"&&(
        <div>
          {selectedEx?(
            <Card style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div>
                  <div style={{fontSize:18,color:t.TEXT,fontWeight:600}}>{selectedEx}</div>
                  <div style={{fontSize:11,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",marginTop:3}}>{EXERCISE_GUIDE[selectedEx]?.muscle}</div>
                </div>
                <button onClick={()=>setSelectedEx(null)} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:6,padding:"4px 10px",color:t.MUTED,cursor:"pointer",fontSize:11,fontFamily:"'Montserrat',sans-serif"}}>Back</button>
              </div>
              <div style={{background:t.CARD2,borderRadius:10,height:160,marginBottom:14,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
                <ExerciseAnimation type={EXERCISE_GUIDE[selectedEx]?.animation||"hold"} color={t.GOLD}/>
              </div>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>How to perform</div>
                {(EXERCISE_GUIDE[selectedEx]?.steps||[]).map((step,i)=>(
                  <div key={i} style={{display:"flex",gap:10,marginBottom:9,alignItems:"flex-start"}}>
                    <div style={{width:20,height:20,borderRadius:"50%",background:t.GOLD+"22",border:"1px solid "+t.GOLD+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:t.GOLD,fontWeight:700,flexShrink:0}}>{i+1}</div>
                    <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",lineHeight:1.65,paddingTop:1}}>{step}</div>
                  </div>
                ))}
              </div>
              {EXERCISE_GUIDE[selectedEx]?.tips&&(
                <div style={{padding:"9px 12px",background:t.GOLD+"0A",border:"1px solid "+t.GOLD+"22",borderRadius:7,marginBottom:10}}>
                  <div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>Pro Tip</div>
                  <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",lineHeight:1.65}}>{EXERCISE_GUIDE[selectedEx].tips}</div>
                </div>
              )}
              {prs[selectedEx]&&(
                <div style={{padding:"8px 12px",background:t.GREEN+"14",border:"1px solid "+t.GREEN+"33",borderRadius:7,display:"flex",justifyContent:"space-between"}}>
                  <div style={{fontSize:11,color:t.GREEN,fontFamily:"'Montserrat',sans-serif"}}>Your personal record</div>
                  <div style={{fontSize:13,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{prs[selectedEx].weight+"kg x "+prs[selectedEx].reps}</div>
                </div>
              )}
            </Card>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>
              {Object.keys(EXERCISE_GUIDE).map(ex=>{
                const g=EXERCISE_GUIDE[ex];
                const catColors={Push:t.BLUE,Pull:t.GREEN,Legs:t.GOLD,Core:t.PURPLE};
                return(
                  <div key={ex} onClick={()=>setSelectedEx(ex)} style={{background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:8,padding:"12px",cursor:"pointer",transition:"border-color .15s"}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=t.GOLD+"66"}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=t.BORDER}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                      <div style={{fontSize:9,color:catColors[g.category]||t.MUTED,fontFamily:"'Montserrat',sans-serif",background:(catColors[g.category]||t.MUTED)+"18",padding:"2px 6px",borderRadius:4}}>{g.category}</div>
                      {prs[ex]&&<div style={{fontSize:9,color:t.GREEN,fontFamily:"'Montserrat',sans-serif"}}>PR</div>}
                    </div>
                    <div style={{fontSize:12,color:t.TEXT,fontWeight:600,marginBottom:3,lineHeight:1.3}}>{ex}</div>
                    <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:4}}>{g.muscle}</div>
                    <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",background:t.CARD2,padding:"2px 6px",borderRadius:4,display:"inline-block"}}>{g.level}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {!isPro(subscription)&&<UpgradeHint message="✦ Generate AI workout plans tailored to your goals with The Executive" onUpgrade={()=>setShowUpgrade(true)}/>}
    </div>
  );
}

function ReadingPage({books,setBooks,readingGoal,setReadingGoal}){
  const t=T();
  const isMobile=useIsMobile();
  const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({title:"",author:"",status:"reading",cur:0,tot:300,review:"",rating:0,dateFinished:todayStr()});  // already updated
  const[expandDone,setExpandDone]=useState({});
  const[editingBook,setEditingBook]=useState(null);
  const[notePrompt,setNotePrompt]=useState(null);
  const[expandNotes,setExpandNotes]=useState({});
  const annualGoal=readingGoal||24;
  const setAnnualGoal=setReadingGoal;
  const[editGoal,setEditGoal]=useState(false);
  const add=()=>{
    if(!form.title)return;
    setBooks(bs=>[...bs,{...form,id:Date.now(),cur:form.status==="done"?Number(form.tot||300):Number(form.cur||0),tot:Number(form.tot||300),readingNotes:[],dateFinished:form.status==="done"?form.dateFinished||todayStr():null}]);
    setForm({title:"",author:"",status:"reading",cur:0,tot:300,review:"",rating:0,dateFinished:todayStr()});
    setShowAdd(false);
  };  // already updated
  const addPages=(bookId,n)=>{
    const book=(books||[]).find(b=>b.id===bookId);
    if(!book)return;
    const fromPage=book.cur;
    const toPage=Math.min(book.cur+n,book.tot);
    setBooks(bs=>bs.map(b=>b.id===bookId?{...b,cur:toPage,status:toPage>=b.tot?"done":b.status}:b));
    setNotePrompt({bookId,fromPage,toPage,text:""});
  };
  const markFinished=(bookId)=>{
    const book=(books||[]).find(b=>b.id===bookId);
    if(!book)return;
    const fromPage=book.cur;
    setBooks(bs=>bs.map(b=>b.id===bookId?{...b,cur:b.tot,status:"done",dateFinished:todayStr()}:b));
    setNotePrompt({bookId,fromPage,toPage:book.tot,text:"",isFinish:true,rating:0,review:""});
  };
  const saveNote=()=>{
    if(!notePrompt)return;
    setBooks(bs=>bs.map(b=>{
      if(b.id!==notePrompt.bookId)return b;
      const updates={};
      if(notePrompt.text.trim()){
        const entry={id:Date.now(),date:todayStr(),fromPage:notePrompt.fromPage,toPage:notePrompt.toPage,text:notePrompt.text.trim()};
        updates.readingNotes=[...(b.readingNotes||[]),entry];
      }
      if(notePrompt.isFinish){
        if(notePrompt.rating>0)updates.rating=notePrompt.rating;
        if(notePrompt.review.trim())updates.review=notePrompt.review.trim();
      }
      return{...b,...updates};
    }));
    setNotePrompt(null);
  };
  const cats={reading:(books||[]).filter(b=>b.status==="reading"),next:(books||[]).filter(b=>b.status==="next"),done:(books||[]).filter(b=>b.status==="done")};
  const colMap={reading:t.GOLD,next:t.BLUE,done:t.GREEN};
  return (
    <div data-page="true" style={{maxWidth:680,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>The Library</div>
          <div style={{fontSize:26,color:t.TEXT}}>Reading List</div>
        </div>
        <Btn onClick={()=>setShowAdd(s=>!s)}>+ Add</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(4,minmax(0,1fr))",gap:8,marginBottom:14}}>
        {[{l:"Reading",v:cats.reading.length,c:t.GOLD},{l:"Up Next",v:cats.next.length,c:t.BLUE},{l:"Done",v:cats.done.length,c:t.GREEN},{l:"Total",v:(books||[]).length,c:t.MUTED}].map(s=>(
          <StatCard key={s.l} label={s.l} value={s.v} color={s.c}/>
        ))}
      </div>
      {(()=>{const booksRead=cats.done.length;
        const pct=Math.min(Math.round(booksRead/annualGoal*100),100);
        const remaining=Math.max(annualGoal-booksRead,0);
        const weekOfYear=Math.ceil((new Date()-new Date(new Date().getFullYear(),0,1))/(7*24*60*60*1000));
        const booksPerWeekNeeded=weekOfYear<52?Math.ceil(remaining/Math.max(52-weekOfYear,1)):0;
        return (
          <Card style={{marginBottom:14,borderColor:t.GOLD+"33"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div>
                <div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",letterSpacing:1,textTransform:"uppercase",marginBottom:2}}>Annual Reading Goal</div>
                <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{booksRead+" of "+annualGoal+" books - "+pct+"% complete"}</div>
              </div>
              {editGoal?(
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <input type="number" defaultValue={annualGoal} onBlur={e=>setAnnualGoal(parseInt(e.target.value)||24)} style={{width:52,background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:5,padding:"3px 7px",color:t.TEXT,fontSize:12,fontFamily:"'Montserrat',sans-serif",outline:"none",textAlign:"center"}}/>
                  <Btn onClick={()=>setEditGoal(false)} style={{fontSize:10,padding:"4px 8px"}}>Set</Btn>
                </div>
              ):(
                <button onClick={()=>setEditGoal(true)} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"33",borderRadius:5,padding:"4px 9px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Edit Goal</button>
              )}
            </div>
            <PB value={pct} color={t.GOLD} height={6}/>
            {remaining>0&&(
              <div style={{marginTop:8,display:"flex",gap:14}}>
                <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{remaining+" books to go"}</div>
                {booksPerWeekNeeded>0&&<div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{booksPerWeekNeeded+" per week to finish on time"}</div>}
              </div>
            )}
            {remaining===0&&<div style={{marginTop:8,fontSize:11,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>Annual reading goal achieved!</div>}
          </Card>
        );
      })()}

      {notePrompt&&(
        <Card style={{marginBottom:14,borderColor:t.GOLD+"66"}}>
          {notePrompt.isFinish?(
            <>
              <div style={{fontSize:9,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Book Finished!</div>
              <div style={{fontSize:13,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",marginBottom:14}}>How would you rate it?</div>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14}}>
                {[1,2,3,4,5].map(n=>(
                  <button key={n} onClick={()=>setNotePrompt(p=>({...p,rating:n}))} style={{width:36,height:36,borderRadius:"50%",border:"1px solid "+(n<=(notePrompt.rating||0)?t.GOLD:t.BORDER),background:n<=(notePrompt.rating||0)?t.GOLD+"22":"transparent",color:n<=(notePrompt.rating||0)?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700}}>
                    {n}
                  </button>
                ))}
                {notePrompt.rating>0&&<span style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{["","One star","Two stars","Three stars","Four stars","Five stars"][notePrompt.rating]}</span>}
              </div>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Review / Key Takeaways (optional)</div>
              <textarea spellCheck={true} autoCorrect="on" autoCapitalize="sentences"
                value={notePrompt.review||""}
                onChange={e=>setNotePrompt(p=>({...p,review:e.target.value}))}
                placeholder="What did you think? Key ideas, favourite quotes, would you recommend it?"
                rows={3}
                style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"9px 12px",color:t.TEXT,fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.7,boxSizing:"border-box",marginBottom:10}}
              />
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Final Session Note (optional)</div>
              <textarea spellCheck={true} autoCorrect="on" autoCapitalize="sentences"
                value={notePrompt.text}
                onChange={e=>setNotePrompt(p=>({...p,text:e.target.value}))}
                placeholder="Last pages - anything that stood out?"
                rows={2}
                style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"9px 12px",color:t.TEXT,fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.7,boxSizing:"border-box"}}
              />
            </>
          ):(
            <>
              <div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Session Note</div>
              <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:10}}>
                {"Pages "+notePrompt.fromPage+" - "+notePrompt.toPage+" - What stood out?"}
              </div>
              <textarea spellCheck={true} autoCorrect="on" autoCapitalize="sentences"
                autoFocus
                value={notePrompt.text}
                onChange={e=>setNotePrompt(p=>({...p,text:e.target.value}))}
                placeholder="Key idea, quote, or reflection... (optional)"
                rows={3}
                style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"9px 12px",color:t.TEXT,fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.7,boxSizing:"border-box"}}
              />
            </>
          )}
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <Btn onClick={saveNote}>{notePrompt.isFinish?"Save":"Save Note"}</Btn>
            <Btn onClick={()=>setNotePrompt(null)} variant="ghost">Skip</Btn>
          </div>
        </Card>
      )}

      {showAdd&&(
        <Card style={{marginBottom:14,borderColor:t.GOLD+"44"}}>
          <SectionLabel>Add Book</SectionLabel>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <Inp value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Title"/>
            <div style={{display:"flex",gap:8}}>
              <Inp value={form.author} onChange={e=>setForm(f=>({...f,author:e.target.value}))} placeholder="Author" style={{flex:2}}/>
              <Sel value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={{flex:1}}>
                <option value="reading">Currently Reading</option>
                <option value="next">Up Next</option>
                <option value="done">Already Read</option>
              </Sel>
            </div>
            {form.status!=="done"&&(
              <div style={{display:"flex",gap:8}}>
                <Inp type="number" value={form.cur} onChange={e=>setForm(f=>({...f,cur:e.target.value}))} placeholder="Current page" style={{flex:1}}/>
                <Inp type="number" value={form.tot} onChange={e=>setForm(f=>({...f,tot:e.target.value}))} placeholder="Total pages" style={{flex:1}}/>
              </div>
            )}
            {form.status==="done"&&(
              <>
                <div style={{display:"flex",gap:8}}>
                  <Inp type="number" value={form.tot} onChange={e=>setForm(f=>({...f,tot:e.target.value}))} placeholder="Total pages (optional)" style={{flex:1}}/>
                  <Inp type="date" value={form.dateFinished} onChange={e=>setForm(f=>({...f,dateFinished:e.target.value}))} style={{flex:1}}/>
                </div>
                <div>
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Your Rating</div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    {[1,2,3,4,5].map(n=>(
                      <button key={n} onClick={()=>setForm(f=>({...f,rating:n}))} style={{width:32,height:32,borderRadius:"50%",border:"1px solid "+(n<=form.rating?t.GOLD:t.BORDER),background:n<=form.rating?t.GOLD+"22":"transparent",color:n<=form.rating?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700}}>
                        {n}
                      </button>
                    ))}
                    {form.rating>0&&<span style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{["","One star","Two stars","Three stars","Four stars","Five stars"][form.rating]}</span>}
                  </div>
                </div>
                <div>
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Review and Notes</div>
                  <textarea spellCheck={true} autoCorrect="on" autoCapitalize="sentences" value={form.review} onChange={e=>setForm(f=>({...f,review:e.target.value}))} placeholder="What did you think? Key takeaways, favourite ideas, quotes..." rows={4} style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"10px 12px",color:t.TEXT,fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.75,boxSizing:"border-box"}}/>
                </div>
              </>
            )}
            <div style={{display:"flex",gap:8}}><Btn onClick={add}>Add</Btn><Btn onClick={()=>setShowAdd(false)} variant="ghost">Cancel</Btn></div>
          </div>
        </Card>
      )}

      {[{key:"reading",label:"Currently Reading"},{key:"next",label:"Up Next"},{key:"done",label:"Completed"}].map(sec=>{
        const bs=cats[sec.key];if(!bs.length)return null;const col=colMap[sec.key];
        return (
          <div key={sec.key} style={{marginBottom:20}}>
            <div style={{fontSize:9,letterSpacing:3,color:col,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:10}}>{sec.label}</div>
            {bs.map(b=>{
              const pct=Math.min(Math.round((b.cur/b.tot)*100),100);
              const notes=b.readingNotes||[];
              const showingNotes=!!expandNotes[b.id];
              return (
                <Card key={b.id} style={{marginBottom:8,borderLeft:"3px solid "+col}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:b.status==="reading"?8:4}}>
                    <div style={{flex:1,marginRight:10}}>
                      <div style={{fontSize:13,color:t.TEXT,marginBottom:2}}>{b.title}</div>
                      {b.author&&<div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{b.author}</div>}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                      {b.status==="reading"&&<span style={{fontSize:11,color:col,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{pct+"%"}</span>}
                      {b.status==="done"&&(
                        <div style={{textAlign:"right",flexShrink:0}}>
                          {b.rating>0&&(
                            <div style={{display:"flex",gap:3,marginBottom:3,justifyContent:"flex-end"}}>
                              {[1,2,3,4,5].map(n=>(
                                <div key={n} style={{width:10,height:10,borderRadius:"50%",background:n<=b.rating?t.GOLD:t.BORDER2}}/>
                              ))}
                            </div>
                          )}
                          <span style={{fontSize:9,color:t.GREEN,fontFamily:"'Montserrat',sans-serif"}}>{b.dateFinished||"Done"}</span>
                        </div>
                      )}
                      {b.status==="done"&&(
                        <button onClick={()=>setEditingBook(editingBook===b.id?null:b.id)} style={{background:t.GOLD+"14",border:"1px solid "+t.GOLD+"33",borderRadius:5,padding:"2px 7px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Edit</button>
                      )}
                      <button onClick={()=>setBooks(bs=>bs.filter(x=>x.id!==b.id))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.6}}>X</button>
                    </div>
                  </div>

                  {/* Inline edit form for finished books */}
                  {editingBook===b.id&&(
                    <div style={{background:t.CARD2,borderRadius:8,padding:12,marginBottom:10,border:"1px solid "+t.GOLD+"33"}}>
                      <div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Edit Book</div>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        <div style={{display:"flex",gap:7}}>
                          <Inp value={b.title} onChange={e=>setBooks(bs=>bs.map(x=>x.id===b.id?{...x,title:e.target.value}:x))} placeholder="Title" style={{flex:2,fontSize:12}}/>
                          <Inp value={b.author||""} onChange={e=>setBooks(bs=>bs.map(x=>x.id===b.id?{...x,author:e.target.value}:x))} placeholder="Author" style={{flex:1,fontSize:12}}/>
                        </div>
                        <div style={{display:"flex",gap:7}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Date Finished</div>
                            <Inp type="date" value={b.dateFinished||""} onChange={e=>setBooks(bs=>bs.map(x=>x.id===b.id?{...x,dateFinished:e.target.value}:x))} style={{fontSize:12}}/>
                          </div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Total Pages</div>
                            <Inp type="number" value={b.tot||""} onChange={e=>setBooks(bs=>bs.map(x=>x.id===b.id?{...x,tot:parseInt(e.target.value)||b.tot}:x))} placeholder="Pages" style={{fontSize:12}}/>
                          </div>
                        </div>
                        <div>
                          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Rating</div>
                          <div style={{display:"flex",gap:6}}>
                            {[1,2,3,4,5].map(n=>(
                              <button key={n} onClick={()=>setBooks(bs=>bs.map(x=>x.id===b.id?{...x,rating:n}:x))} style={{width:28,height:28,borderRadius:"50%",background:n<=(b.rating||0)?t.GOLD:t.CARD,border:"1px solid "+(n<=(b.rating||0)?t.GOLD:t.BORDER),cursor:"pointer",fontSize:11,color:n<=(b.rating||0)?"#080808":t.MUTED,fontWeight:700}}>{n}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Review / Notes</div>
                          <textarea spellCheck={true} autoCorrect="on" autoCapitalize="sentences" value={b.review||""} onChange={e=>setBooks(bs=>bs.map(x=>x.id===b.id?{...x,review:e.target.value}:x))} placeholder="Your thoughts on the book..." rows={3} style={{width:"100%",background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:6,padding:"8px 10px",color:t.TEXT,fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:12,outline:"none",resize:"vertical",lineHeight:1.7,boxSizing:"border-box"}}/>
                        </div>
                        <div style={{display:"flex",gap:7}}>
                          <button onClick={()=>setBooks(bs=>bs.map(x=>x.id===b.id?{...x,status:"reading"}:x))} style={{background:t.GOLD+"14",border:"1px solid "+t.GOLD+"33",borderRadius:6,padding:"5px 10px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Move back to Reading</button>
                          <Btn onClick={()=>setEditingBook(null)} style={{fontSize:11}}>Done</Btn>
                        </div>
                      </div>
                    </div>
                  )}

                  {b.status==="done"&&(b.review||(b.readingNotes||[]).length>0)&&(
                    <div style={{marginTop:8}}>
                      <button onClick={()=>setExpandDone(x=>({...x,[b.id]:!x[b.id]}))} style={{background:"none",border:"none",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:10,padding:0,display:"flex",alignItems:"center",gap:4}}>
                        {expandDone[b.id]?"Hide ":"Show "}
                        {[b.review?"my review":null,(b.readingNotes||[]).length>0?((b.readingNotes||[]).length+" notes"):null].filter(Boolean).join(" and ")}
                      </button>
                      {expandDone[b.id]&&(
                        <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:10}}>
                          {b.review&&(
                            <div style={{padding:"10px 12px",background:t.CARD2,borderRadius:7,borderLeft:"2px solid "+col}}>
                              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>My Review</div>
                              <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Cormorant Garamond',Georgia,serif",lineHeight:1.75}}>{b.review}</div>
                            </div>
                          )}
                          {(b.readingNotes||[]).map(n=>(
                            <div key={n.id} style={{padding:"8px 10px",background:t.CARD2,borderRadius:6,borderLeft:"2px solid "+col}}>
                              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>{"p."+n.fromPage+" - p."+n.toPage+" - "+n.date}</div>
                              <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Cormorant Garamond',Georgia,serif",lineHeight:1.7}}>{n.text}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {b.status==="reading"&&(
                    <>
                      <PB value={pct} color={col} height={4}/>
                      <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:4,marginBottom:8}}>{b.cur+" / "+b.tot+" pages - "+pct+"%"}</div>
                      <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
                        {[10,25,50].map(n=>(
                          <button key={n} onClick={()=>addPages(b.id,n)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:6,padding:"5px 8px",color:t.TEXT,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>{"+ "+n}</button>
                        ))}
                        <div style={{display:"flex",gap:4,flex:1,minWidth:120,alignItems:"center"}}>
                          <input
                            type="number"
                            inputMode="numeric"
                            enterKeyHint="go"
                            placeholder="Page #"
                            min={0}
                            max={b.tot}
                            id={"page-input-"+b.id}
                            onKeyDown={e=>{
                              if(e.key==="Enter"&&e.target.value){
                                const p=Math.max(0,Math.min(parseInt(e.target.value)||0,b.tot));
                                const fromPage=b.cur;
                                if(p>=b.tot){markFinished(b.id);}
                                else if(p>fromPage){setBooks(bs=>bs.map(x=>x.id===b.id?{...x,cur:p}:x));setNotePrompt({bookId:b.id,fromPage,toPage:p,text:""});}
                                else{setBooks(bs=>bs.map(x=>x.id===b.id?{...x,cur:p}:x));}
                                e.target.value="";
                              }
                            }}
                            style={{flex:1,background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:6,padding:"5px 8px",color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontSize:11,outline:"none",minWidth:0}}
                          />
                          <button onClick={()=>{
                            const inp=document.getElementById("page-input-"+b.id);
                            if(!inp?.value)return;
                            const p=Math.max(0,Math.min(parseInt(inp.value)||0,b.tot));
                            const fromPage=b.cur;
                            if(p>=b.tot){markFinished(b.id);}
                            else if(p>fromPage){setBooks(bs=>bs.map(x=>x.id===b.id?{...x,cur:p}:x));setNotePrompt({bookId:b.id,fromPage,toPage:p,text:""});}
                            else{setBooks(bs=>bs.map(x=>x.id===b.id?{...x,cur:p}:x));}
                            inp.value="";inp.blur();
                          }} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:6,padding:"5px 10px",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:600,flexShrink:0}}>
                            Save
                          </button>
                        </div>
                        <button onClick={()=>markFinished(b.id)} style={{background:t.GREEN+"18",border:"1px solid "+t.GREEN+"44",borderRadius:6,padding:"5px 10px",color:t.GREEN,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,flexShrink:0}}>Finished</button>
                      </div>
                    </>
                  )}

                  {notes.length>0&&(
                    <div style={{marginTop:10}}>
                      <button
                        onClick={()=>setExpandNotes(x=>({...x,[b.id]:!x[b.id]}))}
                        style={{background:"none",border:"none",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:10,padding:0,display:"flex",alignItems:"center",gap:4}}
                      >
                        <span style={{fontSize:10}}>{showingNotes?"v":">"}</span>
                        {notes.length+" reading "+(notes.length===1?"note":"notes")}
                      </button>
                      {showingNotes&&(
                        <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:8}}>
                          {notes.map(n=>(
                            <div key={n.id} style={{padding:"8px 10px",background:t.CARD2,borderRadius:6,borderLeft:"2px solid "+col}}>
                              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:4}}>
                                {"p."+n.fromPage+" - p."+n.toPage+" - "+n.date}
                              </div>
                              <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Cormorant Garamond',Georgia,serif",lineHeight:1.7}}>{n.text}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        );
      })}
      {!(books||[]).length&&<div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}><div style={{fontSize:32,marginBottom:10}}>B</div><div>No books yet</div></div>}
    </div>
  );
}

function MonthlyHeatmap({history}){
  const t=T();
  const[hovered,setHovered]=useState(null);
  const[monthOffset,setMonthOffset]=useState(0); // 0=this month, -1=last month, etc
  const now=new Date();
  const viewDate=new Date(now.getFullYear(),now.getMonth()+monthOffset,1);
  const year=viewDate.getFullYear(),month=viewDate.getMonth();
  const isCurrentMonth=monthOffset===0;
  const daysInMonth=new Date(year,month+1,0).getDate();
  const firstDay=new Date(year,month,1).getDay();
  const monthLabel=viewDate.toLocaleDateString(_locale,{month:"long",year:"numeric"});
  const today=todayStr();
  const DAY_LABELS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const getColor=score=>{
    if(!score)return t.CARD2;
    if(score>=80)return t.GREEN;
    if(score>=60)return t.GOLD;
    if(score>=40)return t.BLUE;
    return t.RED;
  };
  const cells=[];
  for(let i=0;i<firstDay;i++)cells.push(null);
  for(let d=1;d<=daysInMonth;d++){
    const ds=year+"-"+String(month+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
    cells.push({d,ds,score:history[ds]?.score||0,data:history[ds]||null,isToday:ds===today,isFuture:ds>today});
  }
  const hovCell=hovered!==null?cells.find(c=>c&&c.ds===hovered):null;
  const col=hovCell?getColor(hovCell.score):t.BORDER;
  return(
    <Card style={{marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>{setMonthOffset(o=>o-1);setHovered(null);}}
            style={{width:24,height:24,borderRadius:6,border:"1px solid "+t.BORDER,background:t.CARD,color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>
            ‹
          </button>
          <SectionLabel>{monthLabel}</SectionLabel>
          <button onClick={()=>{setMonthOffset(o=>Math.min(o+1,0));setHovered(null);}}
            disabled={isCurrentMonth}
            style={{width:24,height:24,borderRadius:6,border:"1px solid "+t.BORDER,background:t.CARD,color:isCurrentMonth?t.BORDER:t.MUTED,cursor:isCurrentMonth?"default":"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>
            ›
          </button>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {[{c:t.GREEN,l:"80+"},{c:t.GOLD,l:"60+"},{c:t.BLUE,l:"40+"},{c:t.RED,l:"<40"}].map(k=>(
            <div key={k.l} style={{display:"flex",alignItems:"center",gap:3}}>
              <div style={{width:8,height:8,borderRadius:2,background:k.c+"88"}}/>
              <span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{k.l}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:3,marginBottom:4}}>
        {DAY_LABELS.map(l=><div key={l} style={{fontSize:8,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textAlign:"center"}}>{l}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:3,marginBottom:hovCell?10:0}}>
        {cells.map((cell,i)=>{
          if(!cell)return<div key={"pad"+i}/>;
          const c=getColor(cell.isFuture?0:cell.score);
          const isHov=hovered===cell.ds;
          return(
            <div key={cell.ds}
              onMouseEnter={()=>!cell.isFuture&&setHovered(cell.ds)}
              onMouseLeave={()=>setHovered(null)}
              onClick={()=>!cell.isFuture&&setHovered(hovered===cell.ds?null:cell.ds)}
              style={{aspectRatio:"1",borderRadius:4,background:cell.isFuture?"transparent":cell.score>0?c+"66":c,border:"1px solid "+(isHov?c:cell.isToday?t.GOLD:cell.score>0&&!cell.isFuture?c+"55":t.BORDER+"33"),display:"flex",alignItems:"center",justifyContent:"center",cursor:cell.isFuture?"default":"pointer",transform:isHov?"scale(1.15)":"scale(1)",transition:"transform .1s, border .1s",zIndex:isHov?2:1,position:"relative"}}>
              <span style={{fontSize:8,color:isHov?c:cell.isToday?t.GOLD:cell.score>0?c:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontWeight:isHov||cell.isToday?700:400}}>{cell.d}</span>
            </div>
          );
        })}
      </div>
      {hovCell&&(
        <div style={{background:t.CARD2,border:"1px solid "+col+"55",borderRadius:8,padding:"10px 14px",animation:"fadeIn .15s ease"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>
              {new Date(hovCell.ds+"T12:00:00").toLocaleDateString(_locale,{weekday:"long",day:"numeric",month:"long"})}
            </div>
            <div style={{fontSize:18,color:col,fontFamily:"'Montserrat',sans-serif",fontWeight:700,lineHeight:1}}>
              {hovCell.score||0}<span style={{fontSize:10,color:t.MUTED,fontWeight:400}}>/100</span>
            </div>
          </div>
          {hovCell.data?(
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              {[
                {label:"Tasks",value:hovCell.data.tasks,icon:"✓",color:t.GREEN},
                {label:"Habits",value:hovCell.data.habits,icon:"🔥",color:t.GOLD},
                {label:"Supps",value:hovCell.data.supps,icon:"💊",color:t.BLUE},
              ].map(s=>(
                <div key={s.label} style={{display:"flex",alignItems:"center",gap:7,background:s.color+"12",border:"1px solid "+s.color+"30",borderRadius:8,padding:"6px 12px",flex:1,minWidth:80}}>
                  <span style={{fontSize:14}}>{s.icon}</span>
                  <div>
                    <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1}}>{s.label}</div>
                    <div style={{fontSize:13,color:s.color,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{s.value!=null?s.value+" done":"—"}</div>
                  </div>
                </div>
              ))}
            </div>
          ):(
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontStyle:"italic"}}>No activity recorded this day</div>
          )}
        </div>
      )}
      {!hovCell&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textAlign:"center",marginTop:8}}>Hover or tap any day to see breakdown</div>}
    </Card>
  );
}

function DayScoreChart({last7,scores,history,dayLetters}){
  const t=T();
  const[hovered,setHovered]=useState(null);
  const hovData=hovered!==null?history[last7[hovered]]:null;

  // Build 8-week rolling average
  const weekAvgs=Array.from({length:8},(_,i)=>{
    const days=Array.from({length:7},(_,j)=>{
      const d=new Date();d.setDate(d.getDate()-(7*(7-i))-(6-j));
      return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    });
    const active=days.map(d=>history[d]?.score||0).filter(s=>s>0);
    return active.length?Math.round(active.reduce((a,b)=>a+b,0)/active.length):0;
  });
  const thisWeekAvg=weekAvgs[7];
  const lastWeekAvg=weekAvgs[6];
  const trend=thisWeekAvg-lastWeekAvg;
  const trendColor=trend>0?t.GREEN:trend<0?t.RED:t.MUTED;

  // Sparkline for trend — 120px wide
  const validAvgs=weekAvgs.filter(v=>v>0);
  const SW=120,SH=32,sp=4;
  const mn=validAvgs.length?Math.max(0,Math.min(...validAvgs)-10):0;
  const mx=validAvgs.length?Math.min(100,Math.max(...validAvgs)+10):100;
  const spx=i=>sp+(i/(weekAvgs.length-1))*(SW-sp*2);
  const spy=v=>SH-sp-((v-mn)/(mx-mn||1))*(SH-sp*2);
  const pts=weekAvgs.map((v,i)=>v>0?spx(i)+","+spy(v):null).filter(Boolean);

  return(
    <Card style={{marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <SectionLabel>Daily Scores</SectionLabel>
        {validAvgs.length>=2&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",letterSpacing:1}}>8-WEEK TREND</div>
            <svg width={120} height={SH} style={{overflow:"visible"}}>
              <polyline points={pts.join(" ")} fill="none" stroke={t.GOLD} strokeWidth="1.5" strokeLinejoin="round" opacity=".7"/>
              {weekAvgs.map((v,i)=>v>0?<circle key={i} cx={spx(i)} cy={spy(v)} r={i===7?3:2} fill={i===7?t.GOLD:t.GOLD+"66"}/>:null)}
            </svg>
            <div style={{fontSize:11,color:trendColor,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>
              {trend===0?"—":((trend>0?"+":"")+trend+" vs last week")}
            </div>
          </div>
        )}
      </div>
      <div style={{display:"flex",gap:4,alignItems:"flex-end",height:72,marginBottom:6}}>
        {last7.map((d,i)=>{
          const sc=scores[i];
          const col=sc>=80?t.GREEN:sc>=60?t.GOLD:sc>=40?t.BLUE:sc>0?t.RED:t.BORDER;
          const isHov=hovered===i;
          return(
            <div key={d} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer"}}
              onMouseEnter={()=>setHovered(i)}
              onMouseLeave={()=>setHovered(null)}
              onClick={()=>setHovered(hovered===i?null:i)}>
              <div style={{fontSize:9,color:sc>0?col:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontWeight:isHov?700:400,transition:"font-weight .1s"}}>{sc||"—"}</div>
              <div style={{width:"100%",background:sc>0?(isHov?col:col+"77"):t.CARD2,borderRadius:"3px 3px 0 0",height:Math.max((sc/100)*56,sc>0?3:0)+"px",transition:"background .15s"}}/>
              <div style={{fontSize:8,color:isHov?t.GOLD:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontWeight:isHov?600:400,transition:"color .15s"}}>{dayLetters[new Date(d+"T12:00:00").getDay()]}</div>
            </div>
          );
        })}
      </div>
      {hovered!==null?(
        <div style={{background:t.CARD2,border:"1px solid "+(hovData?.score>=80?t.GREEN+"66":hovData?.score>=60?t.GOLD+"66":hovData?.score>=40?t.BLUE+"66":hovData?.score>0?t.RED+"66":t.BORDER),borderRadius:8,padding:"10px 14px",animation:"fadeIn .15s ease"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>
              {new Date(last7[hovered]+"T12:00:00").toLocaleDateString(_locale,{weekday:"long",day:"numeric",month:"short"})}
            </div>
            <div style={{fontSize:18,color:hovData?.score>=80?t.GREEN:hovData?.score>=60?t.GOLD:hovData?.score>=40?t.BLUE:hovData?.score>0?t.RED:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontWeight:700,lineHeight:1}}>
              {hovData?.score||0}<span style={{fontSize:10,color:t.MUTED,fontWeight:400}}>/100</span>
            </div>
          </div>
          {hovData?(
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              {[
                {label:"Tasks",value:hovData.tasks,icon:"✓",color:t.GREEN},
                {label:"Habits",value:hovData.habits,icon:"🔥",color:t.GOLD},
                {label:"Supps",value:hovData.supps,icon:"💊",color:t.BLUE},
              ].map(s=>(
                <div key={s.label} style={{display:"flex",alignItems:"center",gap:7,background:s.color+"12",border:"1px solid "+s.color+"30",borderRadius:8,padding:"6px 12px",flex:1,minWidth:80}}>
                  <span style={{fontSize:14}}>{s.icon}</span>
                  <div>
                    <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1}}>{s.label}</div>
                    <div style={{fontSize:13,color:s.color,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{s.value!=null?s.value+"  done":"—"}</div>
                  </div>
                </div>
              ))}
            </div>
          ):(
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontStyle:"italic"}}>No activity recorded — open the app each day to track your score</div>
          )}
        </div>
      ):(
        <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textAlign:"center",paddingTop:2}}>Hover or tap a bar to see the day's breakdown</div>
      )}
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </Card>
  );
}

function WeeklyPage({profile,tasks,goals,habits,habitLog,history,journal,workouts,supplements,bodyLog,weeklyReflections,setWeeklyReflections,subscription,setShowUpgrade,authToken}){
  const t=T();
  const isMobile=useIsMobile();
  const[aiReview,setAiReview]=useState("");
  const[loading,setLoading]=useState(false);
  const[reflection,setReflection]=useState("");
  const[showReflection,setShowReflection]=useState(false);
  const[weekOffset,setWeekOffset]=useState(0); // 0=this week, -1=last week, etc

  const last7=Array.from({length:7}).map((_,i)=>{
    const d=new Date();
    d.setDate(d.getDate()-(6-i)+(weekOffset*7));
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  });
  const weekStart=last7[0],weekEnd=last7[6];
  const weekKey="week_"+weekStart;
  const isCurrentWeek=weekOffset===0;
  const savedReflection=(weeklyReflections||{})[weekKey]||"";
  const savedAiReview=(weeklyReflections||{})[weekKey+"_ai"]||"";
  const isMonday=new Date().getDay()===1;

  // Auto-load saved AI review when week changes
  useEffect(()=>{setAiReview(savedAiReview||"");},[weekKey]);

  const scores=last7.map(d=>history[d]?.score||0);
  const activeScores=scores.filter(s=>s>0);
  const avgScore=activeScores.length?Math.round(activeScores.reduce((a,b)=>a+b,0)/activeScores.length):0;
  const daysActive=activeScores.length;
  const habitPerf=(habits||[]).map(h=>({...h,done:last7.filter(d=>habitLog[h.id+"_"+d]).length}));
  const habitAvg=habitPerf.length?Math.round(habitPerf.reduce((a,h)=>a+(h.done/h.target*100),0)/habitPerf.length):0;
  const weekJournal=(journal||[]).filter(e=>e.date>=weekStart&&e.date<=weekEnd);
  const weekWorkouts=(workouts||[]).filter(w=>w.date>=weekStart&&w.date<=weekEnd);
  const weekBody=(bodyLog||[]).filter(e=>e.date>=weekStart&&e.date<=weekEnd).sort((a,b)=>a.date.localeCompare(b.date));
  const latestBody=weekBody[weekBody.length-1];const earliestBody=weekBody[0];
  const weightChange=latestBody?.weight&&earliestBody?.weight?(parseFloat(latestBody.weight)-parseFloat(earliestBody.weight)).toFixed(1):null;
  const dayLetters=["S","M","T","W","T","F","S"];

  const genReview=async(auto=false)=>{
    if(!isPro(subscription)){if(!auto)setShowUpgrade(true);return;}
    if(loading)return;
    setLoading(true);
    try{
      const wSummary=weekWorkouts.length?weekWorkouts.map(w=>w.type+" "+w.duration+"min").join(", "):"none";
      const bSummary=weekBody.length?((earliestBody?.weight||"?")+" to "+(latestBody?.weight||"?")+"kg"+(weightChange?(" ("+(parseFloat(weightChange)>0?"+":"")+weightChange+"kg)"):"")):"not logged";
      const avgMood=weekJournal.length?(weekJournal.reduce((a,e)=>a+(e.mood||3),0)/weekJournal.length).toFixed(1):"?";
      const goalsSummary=(goals||[]).map(g=>g.title+" "+g.progress+"% ("+g.period+")").join(", ")||"none";
      const habitDetails=habitPerf.map(h=>h.name+": "+h.done+"/"+h.target).join("\n")||"none";
      const r=await claudeFetch({model:"claude-haiku-4-5",max_tokens:900,system:"Performance coach for "+profile.firstName+". Direct, specific. Structure: WINS (2-3 with numbers), GAPS (1-2), PATTERNS (one data insight), NEXT WEEK (3 priorities). Max 270 words.",messages:[{role:"user",content:"Week "+weekStart+" to "+weekEnd+"\nScores: avg "+avgScore+"/100 - "+daysActive+"/7 active\nHabits ("+habitAvg+"%):\n"+habitDetails+"\nWorkouts ("+weekWorkouts.length+"): "+wSummary+"\nBody: "+bSummary+"\nJournal: "+weekJournal.length+" entries, avg mood "+avgMood+"/5\nGoals: "+goalsSummary}]});
      const d=await r.json();
      const review=(d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n")||"Unable to generate.";
      setAiReview(review);
      // Persist to weeklyReflections so it survives page navigation
      setWeeklyReflections(r=>({...(r||{}),[weekKey+"_ai"]:review}));
    }catch{setAiReview("Connection error.");}
    setLoading(false);
  };

  // Auto-generate on Monday morning if Pro, current week, and no review yet
  useEffect(()=>{
    if(isCurrentWeek&&isMonday&&isPro(subscription)&&!savedAiReview&&avgScore>0&&daysActive>=3){
      genReview(true);
    }
  },[isMonday,weekKey]);
  return (
    <div data-page="true" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Performance Review</div>
      {/* Week Navigator */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:26,color:t.TEXT}}>Weekly Review</div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>setWeekOffset(o=>o-1)}
            style={{width:28,height:28,borderRadius:6,border:"1px solid "+t.BORDER,background:t.CARD,color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>
            ‹
          </button>
          <div style={{textAlign:"center",minWidth:120}}>
            <div style={{fontSize:11,color:isCurrentWeek?t.GOLD:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:isCurrentWeek?600:400}}>
              {isCurrentWeek?"This Week":weekOffset===-1?"Last Week":weekOffset+" weeks ago"}
            </div>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:1}}>
              {fmtDateNum(weekStart)} – {fmtDateNum(weekEnd)}
            </div>
          </div>
          <button onClick={()=>setWeekOffset(o=>Math.min(o+1,0))}
            disabled={isCurrentWeek}
            style={{width:28,height:28,borderRadius:6,border:"1px solid "+t.BORDER,background:t.CARD,color:isCurrentWeek?t.BORDER:t.MUTED,cursor:isCurrentWeek?"default":"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>
            ›
          </button>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,minmax(0,1fr))",gap:10,marginBottom:14}}>
        <StatCard label="Avg Score" value={avgScore+"/100"} color={avgScore>=80?t.GREEN:avgScore>=60?t.GOLD:avgScore>=40?t.BLUE:t.RED}/>
        <StatCard label="Days Active" value={daysActive+"/7"} color={t.BLUE}/>
        <StatCard label="Habit Avg" value={habitAvg+"%"} color={t.GOLD}/>
      </div>
      <DayScoreChart last7={last7} scores={scores} history={history} dayLetters={dayLetters}/>

      <MonthlyHeatmap history={history}/>

      {/* Personal Records */}
      {(()=>{
        const entries=Object.entries(history||{}).filter(([_,v])=>v?.score>0);
        if(entries.length<3)return null;

        // Best ever score
        const bestEntry=entries.reduce((b,e)=>e[1].score>b[1].score?e:b,entries[0]);

        // Longest streak ever
        const allDates=[...new Set(entries.map(([d])=>d))].sort();
        let longestStreak=0,currentStreak=0,streakStart="",bestStreakStart="";
        allDates.forEach((d,i)=>{
          if(i===0){currentStreak=1;streakStart=d;}
          else{
            const prev=new Date(allDates[i-1]+"T12:00:00");
            const curr=new Date(d+"T12:00:00");
            const diff=(curr-prev)/(1000*60*60*24);
            if(diff===1){currentStreak++;}
            else{currentStreak=1;streakStart=d;}
          }
          if(currentStreak>longestStreak){longestStreak=currentStreak;bestStreakStart=streakStart;}
        });

        // Most tasks in a day
        const mostTasks=entries.reduce((b,e)=>((e[1].tasks||0)>(b[1].tasks||0)?e:b),entries[0]);

        // Best week average (last 7 complete weeks)
        let bestWeekAvg=0,bestWeekDate="";
        for(let w=1;w<=12;w++){
          const wDays=Array.from({length:7},(_,j)=>{
            const d=new Date();d.setDate(d.getDate()-(7*w)+(j-6));
            return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
          });
          const wScores=wDays.map(d=>history[d]?.score||0).filter(s=>s>0);
          if(wScores.length>=4){
            const avg=Math.round(wScores.reduce((a,b)=>a+b,0)/wScores.length);
            if(avg>bestWeekAvg){bestWeekAvg=avg;bestWeekDate=wDays[0];}
          }
        }

        const records=[
          {icon:"🏆",label:"Best Score",value:bestEntry[1].score+"/100",sub:fmtDateNum(bestEntry[0]),color:t.GOLD},
          {icon:"🔥",label:"Longest Streak",value:longestStreak+" days",sub:longestStreak>0?"Starting "+fmtDateNum(bestStreakStart):"",color:t.RED},
          {icon:"✓",label:"Most Tasks",value:(mostTasks[1].tasks||0)+" tasks",sub:fmtDateNum(mostTasks[0]),color:t.GREEN},
          ...(bestWeekAvg>0?[{icon:"📅",label:"Best Week Avg",value:bestWeekAvg+"/100",sub:"Week of "+fmtDateNum(bestWeekDate),color:t.BLUE}]:[]),
        ];

        return(
          <Card style={{marginBottom:14}}>
            <SectionLabel>Personal Records</SectionLabel>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
              {records.map(r=>(
                <div key={r.label} style={{background:t.CARD2,borderRadius:8,padding:"12px",border:"1px solid "+r.color+"22"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
                    <span style={{fontSize:16}}>{r.icon}</span>
                    <span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1}}>{r.label}</span>
                  </div>
                  <div style={{fontSize:18,color:r.color,fontFamily:"'Montserrat',sans-serif",fontWeight:700,marginBottom:2}}>{r.value}</div>
                  {r.sub&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{r.sub}</div>}
                </div>
              ))}
            </div>
          </Card>
        );
      })()}

      <Card style={{marginBottom:14}}>
        <SectionLabel>Habit Compliance</SectionLabel>
        {habitPerf.map(h=>(
          <div key={h.id} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <span style={{fontSize:13}}>{h.icon}</span>
                <span style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{h.name}</span>
              </div>
              <span style={{fontSize:10,color:h.color,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{h.done+"/"+h.target}</span>
            </div>
            <PB value={Math.min(Math.round(h.done/h.target*100),100)} color={h.color} height={3}/>
          </div>
        ))}
      </Card>
      <Card style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showReflection?12:0}}>
          <div>
            <div style={{fontSize:10,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1}}>My Reflection</div>
            <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>Your own notes on the week</div>
          </div>
          <button onClick={()=>setShowReflection(s=>!s)} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:6,padding:"4px 10px",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>{showReflection?"Done":"Write"}</button>
        </div>
        {showReflection&&(
          <div>
            <textarea spellCheck={true} autoCorrect="on" autoCapitalize="sentences" value={reflection||savedReflection} onChange={e=>setReflection(e.target.value)} placeholder={"What went well? What didn't? What will you do differently next week?"} rows={4} style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"10px 12px",color:t.TEXT,fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.75,boxSizing:"border-box",marginBottom:8}}/>
            <Btn onClick={()=>{setWeeklyReflections(r=>({...(r||{}),[weekKey]:reflection}));setShowReflection(false);}}>Save Reflection</Btn>
          </div>
        )}
        {!showReflection&&savedReflection&&(
          <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Cormorant Garamond',Georgia,serif",lineHeight:1.75,fontStyle:"italic"}}>"{savedReflection}"</div>
        )}
        {!showReflection&&!savedReflection&&(
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>Tap Write to add your own reflection for the week.</div>
        )}
      </Card>
      <Card style={{borderColor:t.GOLD+"33"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:aiReview?12:0}}>
          <div>
            <div style={{fontSize:10,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1}}>
              AI Weekly Review{isCurrentWeek&&isMonday?" · Auto-generated":""}
              {!isCurrentWeek&&<span style={{color:t.MUTED}}> · {fmtDateNum(weekStart)}</span>}
            </div>
            <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>
              {isCurrentWeek&&isMonday&&isPro(subscription)?"Automatically generated every Monday":"Habits, workouts, body, mood, goals"}
            </div>
          </div>
          <Btn onClick={()=>genReview(false)} disabled={loading}>
            {loading?"Generating...":(aiReview?"Regenerate":"Generate Review")}
          </Btn>
        </div>
        {loading&&(
          <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
            <Skeleton width="80%" height={12}/>
            <Skeleton width="70%" height={12}/>
            <Skeleton width="90%" height={12}/>
            <Skeleton width="75%" height={12}/>
            <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textAlign:"center",marginTop:4}}>Analysing your week...</div>
          </div>
        )}
        {aiReview&&!loading&&(
          <div>
            <div style={{fontSize:12,color:t.TEXT,lineHeight:1.85,fontFamily:"'Montserrat',sans-serif",whiteSpace:"pre-wrap",marginTop:10}}>{aiReview}</div>
            {savedAiReview&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:8,fontStyle:"italic"}}>Saved review for week of {fmtDateNum(weekStart)}</div>}
          </div>
        )}
        {!aiReview&&!loading&&<div style={{marginTop:8,fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{isMonday&&isPro(subscription)?"Your weekly review is being prepared...":"Generates an honest assessment of your week — wins, gaps, patterns and priorities."}</div>}
      </Card>
      {!isPro(subscription)&&<UpgradeHint message="✦ Generate your AI Weekly Review with The Executive" onUpgrade={()=>setShowUpgrade(true)}/>}
    </div>
  );
}

function AdvisorPage({profile,tasks,goals,supplements,habits,habitLog,messages,setMessages}){
  const t=T();
  const initMsg={role:"assistant",content:"Good to have you here, "+profile.firstName+". I have full visibility of your dashboard. Ask me anything, or say 'review my dashboard' for an honest assessment."};
  const msgs=messages&&messages.length>0?messages:[initMsg];
  const[input,setInput]=useState("");const[loading,setLoading]=useState(false);
  const bottomRef=useRef(null);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs,loading]);
  const tDone=(tasks||[]).filter(tk=>tk.done).length;
  const sDone=(supplements||[]).filter(s=>s.taken).length;
  const hDone=(habits||[]).filter(h=>!!habitLog?.[h.id+"_"+todayStr()]).length;
  const habitsDone=(habits||[]).filter(h=>!!habitLog[h.id+"_"+todayStr()]).map(h=>h.name);
  const habitsNotDone=(habits||[]).filter(h=>!habitLog[h.id+"_"+todayStr()]).map(h=>h.name);

  // Find last user message date for memory indicator
  const lastUserMsg=messages&&[...messages].reverse().find(m=>m.role==="user");
  const lastMsgDate=lastUserMsg?.timestamp?new Date(lastUserMsg.timestamp):null;
  const lastMsgLabel=lastMsgDate?(
    lastMsgDate.toDateString()===new Date().toDateString()?"Today":
    lastMsgDate.toDateString()===new Date(Date.now()-864e5).toDateString()?"Yesterday":
    lastMsgDate.toLocaleDateString(_locale,{day:"numeric",month:"short"})
  ):null;

  const sys="Private advisor. Direct, sharp. Use web search for current market data.\n\nCLIENT: "+profile.firstName+" "+(profile.lastName||"")+" | "+(profile.dob?calcAge(profile.dob):profile.age)+" | "+(profile.occupation||"")+" | "+(profile.location||"AU")+"\nNW: "+fmt(profile.netWorth||0)+" of "+fmt(Number(profile.netWorthTarget||3e6))+" ("+Math.round((profile.netWorth||0)/Number(profile.netWorthTarget||3e6)*100)+"%)\nIncome: "+fmt(parseFloat(profile.annualIncome)||0)+" | Shares: "+fmt(parseFloat(profile.shareValue)||0)+" | Property: "+fmt(parseFloat(profile.propertyValue)||0)+"\nDebt: "+fmt(profile.totalDebt||0)+" | Risk: "+((profile.riskProfile||["Growth"])[0])+"\n\nTODAY:\nTasks "+tDone+"/"+(tasks||[]).length+" | Supps "+sDone+"/"+(supplements||[]).length+"\nPending high-priority: "+((tasks||[]).filter(tk=>!tk.done&&tk.priority==="high").map(tk=>tk.text).join(", ")||"all done")+"\n\nHABITS "+hDone+"/"+(habits||[]).length+":\n✓ Done: "+(habitsDone.join(", ")||"none")+"\n✗ Not done: "+(habitsNotDone.join(", ")||"all complete")+"\n\nGoals: "+((goals||[]).map(g=>g.title+" "+g.progress+"%").join(", ")||"none")+"\n\nFor 'review': cover FINANCES, HEALTH AND HABITS, GOALS, DAILY EXECUTION. Be direct.";

  const send=async text=>{
    const q=text||input.trim();if(!q||loading)return;setInput("");
    const newMsg={role:"user",content:q,timestamp:Date.now()};
    const updated=[...msgs,newMsg];
    setMessages(updated);setLoading(true);
    // Only send last 20 messages to Claude to manage token usage
    const contextMsgs=updated.slice(-20).map(m=>({role:m.role,content:m.content}));
    try{
      const r=await claudeFetch({model:"claude-sonnet-4-6",max_tokens:2000,system:sys,tools:[{type:"web_search_20250305",name:"web_search"}],messages:contextMsgs});
      const d=await r.json();
      const reply=(d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n")||"Try again.";
      setMessages(m=>[...m,{role:"assistant",content:reply,timestamp:Date.now()}]);
    }catch{setMessages(m=>[...m,{role:"assistant",content:"Connection error.",timestamp:Date.now()}]);}
    setLoading(false);
  };
  const PROMPTS=["Review my dashboard","What should I prioritise?","ASX market update","Accelerate my net worth","Debt payoff strategy","Investment opportunities","Habits to add or swap","Morning briefing"];
  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 100px)",maxWidth:900,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,flexShrink:0}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:4}}>Private Intelligence</div>
          <div style={{fontSize:26,color:t.TEXT}}>AI Advisor</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>
            Full dashboard context · Web search
            {lastMsgLabel&&<span style={{color:t.GOLD}}> · Memory from {lastMsgLabel}</span>}
          </div>
        </div>
        <div style={{display:"flex",gap:7,alignItems:"center"}}>
          {msgs.length>1&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{msgs.length-1} messages</div>}
          {msgs.length>1&&<button onClick={()=>setMessages([])} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:5,padding:"4px 9px",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:10}}>Clear</button>}
        </div>
      </div>
      {msgs.length===1&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12,flexShrink:0}}>
          {PROMPTS.map(p=>(
            <button key={p} onClick={()=>send(p)} style={{padding:"6px 11px",background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:18,color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>{p}</button>
          ))}
        </div>
      )}
      <div style={{flex:1,overflowY:"auto",paddingRight:4,marginBottom:10}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{marginBottom:14,display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",alignItems:"flex-start",gap:9}}>
            {m.role==="assistant"&&(
              <div style={{width:28,height:28,borderRadius:"50%",background:t.GOLD+"33",border:"1px solid "+t.GOLD+"55",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:t.GOLD,flexShrink:0,marginTop:2}}>AI</div>
            )}
            <div style={{maxWidth:m.role==="user"?"62%":"80%",background:m.role==="user"?t.GOLD+"14":t.CARD,border:"1px solid "+(m.role==="user"?t.GOLD+"33":t.BORDER),borderRadius:m.role==="user"?"12px 12px 3px 12px":"12px 12px 12px 3px",padding:"10px 14px"}}>
              <div style={{fontSize:13,color:t.TEXT,lineHeight:1.85,fontFamily:"'Montserrat',sans-serif",whiteSpace:"pre-wrap"}}>{m.content}</div>
            </div>
          </div>
        ))}
        {loading&&(
          <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:14}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:t.GOLD+"33",border:"1px solid "+t.GOLD+"55",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:t.GOLD,flexShrink:0}}>AI</div>
            <div style={{background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:"12px 12px 12px 3px",padding:"10px 14px",display:"flex",gap:4,alignItems:"center"}}>
              {[0,1,2].map(j=><div key={j} style={{width:5,height:5,borderRadius:"50%",background:t.GOLD,opacity:.6,animation:"sk 1.2s ease-in-out "+j*.2+"s infinite"}}/>)}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      <div style={{display:"flex",gap:8,paddingTop:10,borderTop:"1px solid "+t.BORDER,flexShrink:0}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} placeholder="Ask anything..." disabled={loading} style={{flex:1,background:t.CARD,border:"1px solid "+(loading?t.BORDER:t.GOLD+"44"),borderRadius:9,padding:"11px 14px",color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontSize:13,outline:"none"}}/>
        <Btn onClick={()=>send()} disabled={loading||!input.trim()} style={{padding:"11px 18px"}}>Send</Btn>
      </div>
    </div>
  );
}

function DangerZone({authUser,authToken,onReset,onSignOut}){
  const t=T();
  const[step,setStep]=useState(0); // 0=idle, 1=confirm, 2=type, 3=deleting, 4=done, 5=error
  const[typed,setTyped]=useState("");
  const[error,setError]=useState("");
  const CONFIRM_WORD="DELETE";

  const handleDelete=async()=>{
    if(!authUser||!authToken){
      // No account — just reset local data
      onReset();return;
    }
    setStep(3);
    try{
      const r=await fetch(API_BASE+"/api/delete-account",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+authToken}
      });
      const d=await r.json();
      if(d.deleted){
        setStep(4);
        setTimeout(()=>{onReset();},2000);
      } else {
        setError(d.error||"Deletion failed");setStep(5);
      }
    }catch(e){setError(e.message);setStep(5);}
  };

  if(step===0) return(
    <div style={{padding:"14px",background:t.CARD,border:"1px solid "+t.RED+"33",borderRadius:8,marginBottom:12}}>
      <div style={{fontSize:11,color:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600,marginBottom:4}}>Danger Zone</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button onClick={onReset} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:6,padding:"6px 12px",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>
          Reset App
        </button>
        {authUser&&<button onClick={()=>setStep(1)} style={{background:"none",border:"1px solid "+t.RED+"55",borderRadius:6,padding:"6px 12px",color:t.RED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>
          Delete Account
        </button>}
      </div>
      <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:6}}>Reset App clears local data only. Delete Account permanently removes everything including your Supabase data and cancels your subscription.</div>
    </div>
  );

  if(step===1) return(
    <div style={{padding:"16px",background:t.CARD,border:"1px solid "+t.RED+"55",borderRadius:8,marginBottom:12}}>
      <div style={{fontSize:13,color:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600,marginBottom:8}}>Delete Account</div>
      <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",lineHeight:1.75,marginBottom:14}}>
        This will permanently delete:
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:16}}>
        {["All your dashboard data (tasks, goals, journal, workouts, wealth)","Your Supabase account and login credentials","Your active subscription (cancelled immediately)"].map((item,i)=>(
          <div key={i} style={{display:"flex",gap:8,fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
            <span style={{color:t.RED,flexShrink:0}}>✕</span>{item}
          </div>
        ))}
      </div>
      <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:14,fontStyle:"italic"}}>This cannot be undone. Download your data first if you want to keep it.</div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>setStep(2)} style={{background:t.RED+"14",border:"1px solid "+t.RED+"55",borderRadius:6,padding:"8px 14px",color:t.RED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:600}}>
          I understand, continue
        </button>
        <button onClick={()=>setStep(0)} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:6,padding:"8px 14px",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12}}>
          Cancel
        </button>
      </div>
    </div>
  );

  if(step===2) return(
    <div style={{padding:"16px",background:t.CARD,border:"1px solid "+t.RED+"66",borderRadius:8,marginBottom:12}}>
      <div style={{fontSize:13,color:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600,marginBottom:8}}>Final Confirmation</div>
      <div style={{fontSize:12,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:12}}>
        Type <strong style={{color:t.TEXT,fontFamily:"monospace"}}>{CONFIRM_WORD}</strong> to confirm permanent deletion:
      </div>
      <input value={typed} onChange={e=>setTyped(e.target.value.toUpperCase())}
        placeholder={"Type "+CONFIRM_WORD}
        style={{width:"100%",background:t.CARD2,border:"1px solid "+(typed===CONFIRM_WORD?t.RED:t.BORDER),borderRadius:6,padding:"9px 12px",color:t.TEXT,fontFamily:"monospace",fontSize:14,outline:"none",boxSizing:"border-box",marginBottom:12,letterSpacing:2}}/>
      <div style={{display:"flex",gap:8}}>
        <button onClick={handleDelete} disabled={typed!==CONFIRM_WORD}
          style={{background:typed===CONFIRM_WORD?t.RED:"#333",border:"none",borderRadius:6,padding:"9px 16px",color:typed===CONFIRM_WORD?"#fff":t.MUTED,cursor:typed===CONFIRM_WORD?"pointer":"default",fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,transition:"all .2s"}}>
          Delete Everything
        </button>
        <button onClick={()=>{setStep(0);setTyped("");}} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:6,padding:"9px 14px",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12}}>
          Cancel
        </button>
      </div>
    </div>
  );

  if(step===3) return(
    <div style={{padding:"16px",background:t.CARD,border:"1px solid "+t.RED+"33",borderRadius:8,marginBottom:12,textAlign:"center"}}>
      <div style={{fontSize:12,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>Deleting your account...</div>
    </div>
  );

  if(step===4) return(
    <div style={{padding:"16px",background:t.CARD,border:"1px solid "+t.GREEN+"44",borderRadius:8,marginBottom:12,textAlign:"center"}}>
      <div style={{fontSize:13,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>Account deleted successfully</div>
      <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:4}}>Redirecting...</div>
    </div>
  );

  return(
    <div style={{padding:"16px",background:t.CARD,border:"1px solid "+t.RED+"55",borderRadius:8,marginBottom:12}}>
      <div style={{fontSize:12,color:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600,marginBottom:6}}>Deletion failed</div>
      <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:10}}>{error}</div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>{setStep(0);setTyped("");setError("");}} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:6,padding:"6px 12px",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>Try Again</button>
        <a href="mailto:hello@the-executive.vip" style={{background:"none",border:"1px solid "+t.GOLD+"44",borderRadius:6,padding:"6px 12px",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,textDecoration:"none"}}>Contact Support</a>
      </div>
    </div>
  );
}

function ProfilePage({profile,setProfile,onReset,onRecalibrate,theme,setTheme,bgPhoto,setBgPhotoId,nwHistory,tasks,goals,workouts,transactions,journal,authUser,authToken,handleSignOut,setShowAuth,subscription,onUpgrade,handlePortal}){
  const t=T();const isMobile=useIsMobile();const[form,setForm]=useState({...profile});const[saved,setSaved]=useState(false);
  const save=()=>{
    const tA=["shareValue","propertyValue","cashSavings","superBalance","cryptoValue"].reduce((s,k)=>s+(parseFloat(form[k])||0),0);
    const tD=["mortgageDebt","investLoanDebt","carDebt","creditCardDebt","personalDebt"].reduce((s,k)=>s+(parseFloat(form[k])||0),0);
    setProfile({...form,totalAssets:tA,totalDebt:tD,netWorth:tA-tD});setSaved(true);setTimeout(()=>setSaved(false),2000);
  };
  const HEALTH_GOALS=["Build Muscle","Lose Fat","Improve Sleep","Boost Testosterone","Increase Energy","Improve HRV","Reduce Stress","Longevity"];
  const RISK_OPTS=["Conservative - protect capital","Balanced - steady growth","Growth - accept volatility","Aggressive - maximise returns"];
  const curGoals=form.healthGoals||[];
  return (
    <div data-page="true" style={{maxWidth:640,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Account</div>
          <div style={{fontSize:26,color:t.TEXT}}>Profile</div>
        </div>
        <Btn onClick={save}>{saved?"Saved":"Save Changes"}</Btn>
      </div>
      {(()=>{
        const fields=["firstName","lastName","dob","location","occupation","height","weight","annualIncome","netWorthTarget"];
        const filled=fields.filter(f=>profile[f]&&String(profile[f]).trim()).length;
        const pct=Math.round(filled/fields.length*100);
        return pct<100?(
          <Card style={{marginBottom:16,borderColor:t.GOLD+"44"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{"Profile "+pct+"% complete"}</div>
              <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{(fields.length-filled)+" fields remaining"}</div>
            </div>
            <PB value={pct} color={t.GOLD} height={5}/>
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:8}}>A complete profile gives the AI Advisor better context and personalises your entire dashboard.</div>
          </Card>
        ):(
          <Card style={{marginBottom:16,borderColor:t.GREEN+"44",padding:"10px 14px"}}>
            <div style={{fontSize:11,color:t.GREEN,fontFamily:"'Montserrat',sans-serif"}}>Profile complete</div>
          </Card>
        );
      })()}
      <Card style={{marginBottom:12}}>
        <SectionLabel>Appearance</SectionLabel>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:7,marginBottom:14}}>
          {[{id:"obsidian",l:"Obsidian"},{id:"charcoal",l:"Charcoal"}].map(th=>(
            <button key={th.id} onClick={()=>setTheme(th.id)} style={{padding:"10px",borderRadius:7,border:"1px solid "+(theme===th.id?t.GOLD:t.BORDER),background:theme===th.id?t.GOLD+"18":t.CARD2,color:theme===th.id?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12}}>
              {th.l}
            </button>
          ))}
        </div>
        <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Background Photo</div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,minmax(0,1fr))",gap:8,marginBottom:8}}>
          {BG_PHOTOS.map(p=>{
            const active=(bgPhoto||"none")===p.id;
            return(
              <div key={p.id} onClick={()=>setBgPhotoId&&setBgPhotoId(p.id)} style={{cursor:"pointer",borderRadius:8,border:"2px solid "+(active?t.GOLD:t.BORDER),overflow:"hidden",position:"relative",background:t.CARD2}}>
                <div style={{paddingBottom:"56%",position:"relative"}}>
                  {p.thumb
                    ?<img src={p.thumb} alt={p.label} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:active?1:0.6}}/>
                    :<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:t.MUTED}}>⊗</div>
                  }
                  {active&&<div style={{position:"absolute",top:4,right:4,width:16,height:16,borderRadius:"50%",background:t.GOLD,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:9,color:"#080808",fontWeight:700}}>✓</span></div>}
                  <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"4px 6px",background:"rgba(0,0,0,0.75)",fontSize:9,color:"#fff",fontFamily:"'Montserrat',sans-serif",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{p.label}</div>
                </div>
              </div>
            );
          })}
        </div>
        {bgPhoto&&bgPhoto!=="none"&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:2,fontStyle:"italic"}}>Glass cards + dark overlay applied automatically · Changes live instantly</div>}
      </Card>
      <Card style={{marginBottom:12}}>
        <SectionLabel>Country and Currency</SectionLabel>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:7}}>
          {Object.entries(LOCALES).map(([key,loc])=>{
            const active=(form.locale||"en-AU")===key;
            return (
              <button key={key} onClick={()=>{setForm(f=>({...f,locale:key}));_locale=key;}} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 10px",borderRadius:7,border:"1px solid "+(active?t.GOLD:t.BORDER),background:active?t.GOLD+"14":t.CARD2,cursor:"pointer",textAlign:"left"}}>
                <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{loc.flag}</div>
                <div>
                  <div style={{fontSize:11,color:active?t.GOLD:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:active?600:400}}>{loc.label}</div>
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{loc.currency}</div>
                </div>
                {active&&<span style={{marginLeft:"auto",color:t.GOLD,fontSize:11}}>V</span>}
              </button>
            );
          })}
        </div>
      </Card>
      <Card style={{marginBottom:12}}>
        <SectionLabel>Personal</SectionLabel>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[["firstName","First Name","text"],["lastName","Last Name","text"],["dob","Date of Birth","date"],["location","Location","text"],["occupation","Occupation","text"]].map(([k,l,tp])=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",minWidth:90,flexShrink:0}}>{l}</div>
              <Inp type={tp} value={form[k]||""} onChange={e=>setForm(x=>({...x,[k]:e.target.value}))} style={{flex:1,padding:"7px 10px",fontSize:12}}/>
            </div>
          ))}
        </div>
      </Card>
      <Card style={{marginBottom:12}}>
        <SectionLabel>Health Goals</SectionLabel>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {HEALTH_GOALS.map(g=>{
            const active=curGoals.includes(g);
            return (
              <button key={g} onClick={()=>setForm(f=>({...f,healthGoals:active?curGoals.filter(x=>x!==g):[...curGoals,g]}))} style={{padding:"5px 11px",borderRadius:14,border:"1px solid "+(active?t.GOLD:t.BORDER),background:active?t.GOLD+"14":"transparent",color:active?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>
                {(active?"V ":"")+g}
              </button>
            );
          })}
        </div>
      </Card>
      <Card style={{marginBottom:12}}>
        <SectionLabel>Risk Profile</SectionLabel>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {RISK_OPTS.map(r=>{
            const active=(form.riskProfile||[])[0]===r;
            return (
              <button key={r} onClick={()=>setForm(f=>({...f,riskProfile:[r]}))} style={{padding:"8px 11px",borderRadius:6,border:"1px solid "+(active?t.GOLD:t.BORDER),background:active?t.GOLD+"14":"transparent",color:active?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12,textAlign:"left"}}>
                {(active?"* ":"o ")+r}
              </button>
            );
          })}
        </div>
      </Card>
      <Card style={{marginBottom:12}}>
        <SectionLabel>Finances</SectionLabel>
        <button onClick={onRecalibrate} style={{width:"100%",background:t.GOLD+"10",border:"1px solid "+t.GOLD+"33",borderRadius:7,padding:"11px 12px",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12,textAlign:"left"}}>Recalibrate Financial Figures</button>
      </Card>

      {/* ── Subscription / Billing ── */}
      <Card style={{marginBottom:12}}>
        <SectionLabel>Subscription</SectionLabel>
        {!authUser?(
          <div>
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:10}}>Sign in to manage your subscription</div>
            <Btn onClick={()=>setShowAuth(true)}>Sign In</Btn>
          </div>
        ):!subscription||subscription.status==="free"||!subscription.status?(
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <div style={{background:t.BORDER,borderRadius:10,padding:"2px 10px"}}>
                <span style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>Free Plan</span>
              </div>
            </div>
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:12,lineHeight:1.6}}>Upgrade to Executive to unlock AI features, live prices and the full dashboard.</div>
            <Btn onClick={onUpgrade}>Upgrade to Executive →</Btn>
          </div>
        ):(
          <div>
            {/* Status badge */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <div style={{background:subscription.status==="trialing"?t.GOLD+"22":subscription.status==="active"?t.GREEN+"22":t.RED+"22",border:"1px solid "+(subscription.status==="trialing"?t.GOLD:subscription.status==="active"?t.GREEN:t.RED)+"44",borderRadius:10,padding:"3px 10px"}}>
                <span style={{fontSize:10,color:subscription.status==="trialing"?t.GOLD:subscription.status==="active"?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600,textTransform:"capitalize"}}>
                  {subscription.status==="trialing"?"Active (Trial)":subscription.status==="active"?"Executive — Active":subscription.status==="past_due"?"Past Due — Update Payment":"Cancelled"}
                </span>
              </div>
              {subscription.status==="trialing"&&subscription.trial_end&&(
                <span style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
                  {"Ends "+new Date(subscription.trial_end).toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"})}
                </span>
              )}
            </div>

            {/* Billing details */}
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
              {subscription.current_period_end&&subscription.status==="active"&&(
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,fontFamily:"'Montserrat',sans-serif"}}>
                  <span style={{color:t.MUTED}}>Next billing date</span>
                  <span style={{color:t.TEXT}}>{new Date(subscription.current_period_end).toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"})}</span>
                </div>
              )}
              {subscription.cancel_at_period_end&&(
                <div style={{fontSize:11,color:"#D4956A",fontFamily:"'Montserrat',sans-serif",background:"#D4956A14",border:"1px solid #D4956A33",borderRadius:6,padding:"7px 10px"}}>
                  {"Cancels on "+new Date(subscription.current_period_end).toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"})+". You keep access until then."}
                </div>
              )}
            </div>

            {/* Manage billing button */}
            {subscription.stripe_customer_id&&(
              <button onClick={handlePortal} style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"11px 12px",color:t.TEXT,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12,textAlign:"center"}}>
                Manage Billing & Cancel →
              </button>
            )}
          </div>
        )}
      </Card>

      <Card style={{marginBottom:12}}>
        <SectionLabel>Privacy</SectionLabel>
        <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",lineHeight:1.75}}>Your data is encrypted and stored securely in the cloud, synced across all your devices. AI Advisor questions are sent to Anthropic's API only. We don't advertise, sell data, or use your information to train AI models.</div>
      </Card>
      <Card style={{marginBottom:12}}>
        <SectionLabel>Export Data</SectionLabel>
        {/* Full backup — most important */}
        <button onClick={()=>{
          const backup={
            exportedAt:new Date().toISOString(),
            version:"1.0",
            profile,tasks,goals,completed,habits,habitLog,
            supplements,workouts,journal,books,bodyLog,
            transactions,bills,debts,taxDeductions,notes,nwHistory,history,
            weeklyReflections,holdings,cryptoHoldings,
            commodityHoldings,altAssets,budgets,
          };
          const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
          const url=URL.createObjectURL(blob);
          const a=document.createElement("a");a.href=url;
          a.download="the-executive-backup-"+todayStr()+".json";
          a.click();URL.revokeObjectURL(url);
        }} style={{width:"100%",background:"linear-gradient(135deg,"+t.GOLD+"18,"+t.GOLD+"08)",border:"1px solid "+t.GOLD+"44",borderRadius:8,padding:"12px 14px",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12,textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div>
            <div style={{fontWeight:600,marginBottom:2}}>Download Full Backup</div>
            <div style={{fontSize:10,color:t.MUTED}}>All data as JSON — restore any time</div>
          </div>
          <span style={{fontSize:11,fontWeight:700}}>JSON ↓</span>
        </button>
        {/* Individual CSVs */}
        <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Individual Exports</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:6}}>
          {[
            {l:"Net Worth History",fn:()=>{const h=Object.entries(nwHistory||{});if(!h.length)return alert("No history yet.");exportCSV(h.map(([d,v])=>({date:d,value:v})),"networth-history.csv");}},
            {l:"Tasks",fn:()=>tasks.length?exportCSV(tasks.map(({id,...r})=>r),"tasks.csv"):alert("No tasks.")},
            {l:"Goals",fn:()=>goals.length?exportCSV(goals.map(({id,milestones,actions,...r})=>r),"goals.csv"):alert("No goals.")},
            {l:"Workouts",fn:()=>workouts.length?exportCSV(workouts.map(w=>({date:w.date,type:w.type,duration:w.duration,exercises:w.sets?.length||0})),"workouts.csv"):alert("No workouts.")},
            {l:"Transactions",fn:()=>transactions.length?exportCSV(transactions.map(({id,...r})=>r),"transactions.csv"):alert("No transactions.")},
            {l:"Journal",fn:()=>journal.length?exportCSV(journal.map(({id,...r})=>r),"journal.csv"):alert("No journal entries.")},
            {l:"Body Metrics",fn:()=>bodyLog.length?exportCSV(bodyLog.map(({id,...r})=>r),"body-metrics.csv"):alert("No body data.")},
            {l:"Score History",fn:()=>{const h=Object.entries(history||{});if(!h.length)return alert("No history.");exportCSV(h.map(([d,v])=>({date:d,...v})),"score-history.csv");}},
          ].map(ex=>(
            <button key={ex.l} onClick={ex.fn} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"8px 10px",color:t.TEXT,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              {ex.l}<span style={{color:t.MUTED,fontSize:9}}>CSV</span>
            </button>
          ))}
        </div>
      </Card>
      {authUser&&<Card style={{marginBottom:12}}>
        <SectionLabel>Account</SectionLabel>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{authUser.email}</div>
            <div style={{fontSize:10,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>Syncing across devices</div>
          </div>
          <button onClick={handleSignOut} style={{background:t.RED+"14",border:"1px solid "+t.RED+"33",borderRadius:7,padding:"6px 12px",color:t.RED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>Sign Out</button>
        </div>
      </Card>}
      {!authUser&&<Card style={{marginBottom:12}}>
        <SectionLabel>Account</SectionLabel>
        <div style={{fontSize:12,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:10}}>Sign in to sync your data across all devices.</div>
        <Btn onClick={()=>setShowAuth(true)}>Sign In / Create Account</Btn>
      </Card>}
      <DangerZone authUser={authUser} authToken={authToken} onReset={onReset} onSignOut={handleSignOut}/>
    </div>
  );
}

function BudgetPage({transactions,budgets,setBudgets}){
  const t=T();
  const isMobile=useIsMobile();
  const[showAdd,setShowAdd]=useState(false);
  const[newCat,setNewCat]=useState("");
  const[editingCat,setEditingCat]=useState(null);
  const[showAutoFill,setShowAutoFill]=useState(false);

  // Use most recent month with data (same logic as CashFlow)
  const recentMonths=Array.from({length:3}).map((_,i)=>{
    const d=new Date();d.setMonth(d.getMonth()-(i+1));
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
  });
  const hasRecentData=transactions.some(tx=>recentMonths.some(m=>tx.date.startsWith(m)));

  const mk=monthStr();
  const prevMk=(()=>{const d=new Date();d.setMonth(d.getMonth()-1);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");})();

  // Use most recent month with data — same as CashFlow page
  const hasCurrentMonthTx=transactions.some(tx=>tx.date.startsWith(mk)&&tx.type==="expense");
  const activeMk=hasCurrentMonthTx?mk:prevMk;
  const activeMkLabel=(()=>{const d=new Date(activeMk+"-01T12:00:00");return d.toLocaleString("default",{month:"long",year:"numeric"});})();
  const isShowingPrevMonth=activeMk===prevMk&&!hasCurrentMonthTx;

  // Auto-fill budgets from 3-month average spend per category
  const autoFillFromHistory=()=>{
    const suggestions={};
    const defaultCats=EXP_CATS.expense;
    defaultCats.forEach(cat=>{
      const monthlySpends=recentMonths.map(m=>
        transactions.filter(tx=>tx.date.startsWith(m)&&tx.type==="expense"&&tx.category===cat)
          .reduce((s,tx)=>s+tx.amount,0)
      ).filter(v=>v>0);
      if(monthlySpends.length>0){
        const avg=Math.round(monthlySpends.reduce((a,b)=>a+b,0)/monthlySpends.length);
        if(avg>0)suggestions[cat]=avg;
      }
    });
    setBudgets(b=>({...b,...Object.fromEntries(Object.entries(suggestions).map(([k,v])=>[k,String(v)]))}));
    setShowAutoFill(false);
  };

  // All budget categories = defaults + custom ones stored in budgets
  const defaultCats=EXP_CATS.expense;
  const customCats=Object.keys(budgets).filter(k=>!defaultCats.includes(k)&&k!=="__total");
  const allCats=[...defaultCats,...customCats];
  const budgetedCats=allCats.filter(c=>budgets[c]&&parseFloat(budgets[c])>0);
  const totalBudget=budgetedCats.reduce((s,c)=>s+(parseFloat(budgets[c])||0),0);

  const getSpent=(cat,month)=>transactions.filter(tx=>tx.date.startsWith(month)&&tx.type==="expense"&&tx.category===cat).reduce((s,tx)=>s+tx.amount,0);
  const totalSpent=budgetedCats.reduce((s,c)=>s+getSpent(c,activeMk),0);
  const totalPct=totalBudget>0?Math.min(Math.round(totalSpent/totalBudget*100),100):0;
  const remaining=totalBudget-totalSpent;

  // 6-month trend per category
  const months6=Array.from({length:6}).map((_,i)=>{
    const d=new Date();d.setMonth(d.getMonth()-(5-i));
    return{key:d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"),label:d.toLocaleString("default",{month:"short"})};
  });

  const setCatBudget=(cat,val)=>setBudgets(b=>({...b,[cat]:val}));

  return (
    <div data-page="true" style={{maxWidth:800,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Financial Control</div>
          <div style={{fontSize:26,color:t.TEXT}}>Monthly Budget</div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:2}}>
            <div style={{fontSize:11,color:isShowingPrevMonth?t.GOLD:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{activeMkLabel}</div>
            {isShowingPrevMonth&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",background:t.GOLD+"14",padding:"2px 7px",borderRadius:4}}>Showing last month — no data yet for {new Date().toLocaleString("default",{month:"long"})}</div>}
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {hasRecentData&&<button onClick={()=>setShowAutoFill(s=>!s)} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:7,padding:"8px 12px",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:600}}>
            ✦ Fill from Statements
          </button>}
          <Btn onClick={()=>setShowAdd(s=>!s)}>+ Add Category</Btn>
        </div>
      </div>

      {/* Auto-fill from statements card */}
      {showAutoFill&&(
        <Card style={{marginBottom:14,borderColor:t.GOLD+"44",background:t.GOLD+"06"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div>
              <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600,marginBottom:4}}>Auto-fill from transaction history</div>
              <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",lineHeight:1.7}}>
                Sets each category budget to your 3-month average spend from imported statements.<br/>
                <span style={{color:t.GOLD}}>Only categories with transaction history will be updated.</span>
              </div>
            </div>
          </div>
          {/* Preview of what will be set */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:6,marginBottom:12}}>
            {EXP_CATS.expense.map(cat=>{
              const monthlySpends=recentMonths.map(m=>
                transactions.filter(tx=>tx.date.startsWith(m)&&tx.type==="expense"&&tx.category===cat)
                  .reduce((s,tx)=>s+tx.amount,0)
              ).filter(v=>v>0);
              if(!monthlySpends.length)return null;
              const avg=Math.round(monthlySpends.reduce((a,b)=>a+b,0)/monthlySpends.length);
              const current=parseFloat(budgets[cat])||0;
              return(
                <div key={cat} style={{background:t.CARD2,borderRadius:7,padding:"8px 10px",border:"1px solid "+t.BORDER}}>
                  <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:2}}>{cat}</div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    {current>0&&<span style={{fontSize:10,color:t.MUTED,textDecoration:"line-through"}}>{fmt(current)}</span>}
                    <span style={{fontSize:13,color:t.GOLD,fontWeight:700}}>{fmt(avg)}</span>
                  </div>
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>avg/{recentMonths.length}mo</div>
                </div>
              );
            }).filter(Boolean)}
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn onClick={autoFillFromHistory}>Apply Suggestions</Btn>
            <Btn onClick={()=>setShowAutoFill(false)} variant="ghost">Cancel</Btn>
          </div>
        </Card>
      )}

      {/* No transactions yet */}
      {!transactions.length&&(
        <Card style={{marginBottom:14,textAlign:"center",padding:"24px"}}>
          <div style={{fontSize:24,marginBottom:8}}>📊</div>
          <div style={{fontSize:13,color:t.TEXT,marginBottom:6}}>Import bank statements to auto-fill budgets</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",lineHeight:1.7,marginBottom:12}}>Go to Cash Flow → Import PDF to upload your bank statement. Once imported, come back here and tap <span style={{color:t.GOLD}}>Fill from Statements</span> to set budgets based on your actual spending.</div>
        </Card>
      )}

      {showAdd&&(
        <Card style={{marginBottom:14,borderColor:t.GOLD+"44"}}>
          <SectionLabel>New Budget Category</SectionLabel>
          <div style={{display:"flex",gap:8}}>
            <Inp value={newCat} onChange={e=>setNewCat(e.target.value)} placeholder="Category name (e.g. Gym, Hobbies)"/>
            <Btn onClick={()=>{if(!newCat.trim())return;setCatBudget(newCat.trim(),0);setNewCat("");setShowAdd(false);}}>Add</Btn>
            <Btn onClick={()=>setShowAdd(false)} variant="ghost">Cancel</Btn>
          </div>
        </Card>
      )}

      {totalBudget>0&&(
        <Card style={{marginBottom:14,background:t.CARD2,border:"1px solid "+(totalSpent>totalBudget?t.RED:t.GOLD)+"44"}}>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(4,minmax(0,1fr))",gap:10,marginBottom:14}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",letterSpacing:1,marginBottom:4}}>TOTAL BUDGET</div>
              <div style={{fontSize:20,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{fmt(totalBudget)}</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",letterSpacing:1,marginBottom:4}}>SPENT</div>
              <div style={{fontSize:20,color:totalSpent>totalBudget?t.RED:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{fmt(totalSpent)}</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",letterSpacing:1,marginBottom:4}}>REMAINING</div>
              <div style={{fontSize:20,color:remaining>=0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{fmt(Math.abs(remaining))}</div>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{remaining>=0?"left":"over budget"}</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",letterSpacing:1,marginBottom:4}}>USED</div>
              <div style={{fontSize:20,color:totalPct>=100?t.RED:totalPct>=80?t.GOLD:t.GREEN,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{totalPct+"%"}</div>
            </div>
          </div>
          <PB value={totalPct} color={totalSpent>totalBudget?t.RED:totalPct>=80?t.GOLD:t.GREEN} height={6}/>
        </Card>
      )}

      {budgetedCats.length>0&&(
        <Card style={{marginBottom:14}}>
          <SectionLabel>6-Month Spending Trend</SectionLabel>
          <div style={{display:"flex",gap:4,alignItems:"flex-end",height:80,marginBottom:6}}>
            {months6.map((m,i)=>{
              const spent=budgetedCats.reduce((s,c)=>s+getSpent(c,m.key),0);
              const maxSpend=Math.max(...months6.map(mm=>budgetedCats.reduce((s,c)=>s+getSpent(c,mm.key),0)),totalBudget,1);
              const budgetH=(totalBudget/maxSpend)*60;
              const spentH=(spent/maxSpend)*60;
              const over=spent>totalBudget;
              return (
                <div key={m.key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                  <div style={{width:"100%",position:"relative",height:64,display:"flex",alignItems:"flex-end"}}>
                    {totalBudget>0&&<div style={{position:"absolute",bottom:budgetH+"px",left:0,right:0,borderTop:"1px dashed "+t.GOLD+"66"}}/>}
                    <div style={{width:"100%",background:over?t.RED+"88":t.BLUE+"88",borderRadius:"2px 2px 0 0",height:spentH+"px",minHeight:spent>0?2:0,transition:"height .3s"}}/>
                  </div>
                  <div style={{fontSize:8,color:i===5?t.GOLD:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{m.label}</div>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            {[{c:t.BLUE+"88",l:"Spent"},{c:t.GOLD,l:"Budget (dashed)"}].map(x=>(
              <div key={x.l} style={{display:"flex",alignItems:"center",gap:3}}>
                <div style={{width:10,height:3,background:x.c,borderRadius:2}}/>
                <span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{x.l}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {allCats.map(cat=>{
          const budget=parseFloat(budgets[cat])||0;
          const spent=getSpent(cat,activeMk);
          const prevSpent=getSpent(cat,prevMk);
          const pct=budget>0?Math.min(Math.round(spent/budget*100),100):0;
          const over=budget>0&&spent>budget;
          const isEditing=editingCat===cat;
          const isCustom=!defaultCats.includes(cat);
          if(budget===0&&!isEditing&&!isCustom)return null;
          return (
            <Card key={cat} style={{borderLeft:"3px solid "+(over?t.RED:budget>0?t.GREEN:t.BORDER)}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:budget>0?8:0}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:13,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{cat}</span>
                    {prevSpent>0&&<span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{"last mo: "+fmt(prevSpent)}</span>}
                  </div>
                  {budget>0&&(
                    <div style={{fontSize:10,color:over?t.RED:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>
                      {fmt(spent)+" spent of "+fmt(budget)+" budget"+( over?" - "+fmt(spent-budget)+" over!":"")}
                    </div>
                  )}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  {isEditing?(
                    <>
                      <input
                        type="number"
                        defaultValue={budget||""}
                        autoFocus
                        onBlur={e=>{setCatBudget(cat,parseFloat(e.target.value)||0);setEditingCat(null);}}
                        onKeyDown={e=>{if(e.key==="Enter"){setCatBudget(cat,parseFloat(e.target.value)||0);setEditingCat(null);}}}
                        placeholder="Budget $"
                        style={{width:90,background:t.CARD2,border:"1px solid "+t.GOLD,borderRadius:5,padding:"4px 8px",color:t.TEXT,fontSize:12,fontFamily:"'Montserrat',sans-serif",outline:"none",textAlign:"right"}}
                      />
                      <Btn onClick={()=>setEditingCat(null)} variant="ghost" style={{fontSize:10,padding:"4px 8px"}}>Done</Btn>
                    </>
                  ):(
                    <>
                      {budget>0&&<span style={{fontSize:14,color:over?t.RED:t.GREEN,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{pct+"%"}</span>}
                      <button onClick={()=>setEditingCat(cat)} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"33",borderRadius:5,padding:"3px 8px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>{budget>0?"Edit":"Set"}</button>
                      {isCustom&&<button onClick={()=>{const b={...budgets};delete b[cat];setBudgets(b);}} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.5}}>X</button>}
                    </>
                  )}
                </div>
              </div>
              {budget>0&&<PB value={pct} color={over?t.RED:pct>=80?t.GOLD:t.GREEN} height={5}/>}
            </Card>
          );
        })}
        {budgetedCats.length===0&&!showAdd&&(
          <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
            <div style={{fontSize:28,marginBottom:10}}>B</div>
            <div style={{marginBottom:8}}>No budgets set yet</div>
            <div style={{fontSize:11}}>Tap Set on any category or add a custom one above</div>
          </div>
        )}
        {defaultCats.filter(c=>!budgets[c]||parseFloat(budgets[c])===0).length>0&&(
          <Card style={{padding:"10px 14px"}}>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Unbudgeted Categories</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {defaultCats.filter(c=>!budgets[c]||parseFloat(budgets[c])===0).map(cat=>{
                const spent=getSpent(cat,activeMk);
                return (
                  <button key={cat} onClick={()=>setEditingCat(cat)} style={{padding:"5px 11px",borderRadius:14,border:"1px solid "+t.BORDER,background:"transparent",color:spent>0?t.TEXT:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,display:"flex",alignItems:"center",gap:5}}>
                    {cat}
                    {spent>0&&<span style={{fontSize:9,color:t.RED,fontFamily:"'Montserrat',sans-serif"}}>{fmt(spent)}</span>}
                  </button>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function SetupPage({onComplete}){
  const t=T();
  const[step,setStep]=useState(0);
  const[p,setP]=useState({
    firstName:"",lastName:"",age:"",location:"",occupation:"",
    height:"",weight:"",targetWeight:"",bodyFat:"",sleepHours:"",
    healthGoals:[],currentHabits:[],riskProfile:"Growth - accept volatility",
    annualIncome:"",propertyValue:"",mortgageDebt:"",investLoanDebt:"",
    cashSavings:"",superBalance:"",carDebt:"",creditCardDebt:"",personalDebt:"",
    netWorthTarget:"",theme:"obsidian"
  });
  const[initGoals,setInitGoals]=useState([]);
  const[initSupps,setInitSupps]=useState([]);
  const[newGoal,setNewGoal]=useState({title:"",period:"month",category:"financial"});
  const[newSupp,setNewSupp]=useState({name:"",dose:"",time:"morning",purpose:""});

  const STEPS=[
    "welcome","personal","body","healthgoals","habits","supplements","goals","financial","risk","done"
  ];
  const cur=STEPS[step];
  const prog=step/(STEPS.length-1);

  const upd=(k,v)=>setP(x=>({...x,[k]:v}));
  const toggleArr=(k,v)=>setP(x=>({...x,[k]:x[k].includes(v)?x[k].filter(i=>i!==v):[...x[k],v]}));

  const next=()=>setStep(s=>Math.min(s+1,STEPS.length-1));
  const back=()=>setStep(s=>Math.max(s-1,0));

  const finish=()=>{
    const tA=(parseFloat(p.propertyValue)||0)+(parseFloat(p.cashSavings)||0)+(parseFloat(p.superBalance)||0);
    const tD=(parseFloat(p.mortgageDebt)||0)+(parseFloat(p.investLoanDebt)||0)+(parseFloat(p.carDebt)||0)+(parseFloat(p.creditCardDebt)||0)+(parseFloat(p.personalDebt)||0);
    onComplete({
      profile:{...p,totalAssets:tA,totalDebt:tD,netWorth:tA-tD,shareValue:0,cryptoValue:0},
      goals:initGoals.map((g,i)=>({...g,id:Date.now()+i,progress:0})),
      supplements:initSupps.map((s,i)=>({...s,id:Date.now()+i,taken:false}))
    });
  };

  const HEALTH_GOALS=["Build Muscle","Lose Fat","Improve Sleep","Boost Testosterone","Increase Energy","Improve HRV","Reduce Stress","Longevity","Improve Cardio","Flexibility"];
  const HABITS_LIST=["Morning Routine","Cold Exposure","Meditation","Journalling","Strength Training","Reading Daily","Intermittent Fasting","No Alcohol","Evening Walk","Gratitude Practice"];
  const SUPP_PRESETS=[{name:"Vitamin D3+K2",dose:"5000 IU",time:"morning",purpose:"Immunity & bone health"},{name:"Magnesium Glycinate",dose:"400mg",time:"evening",purpose:"Sleep & recovery"},{name:"Omega-3 Fish Oil",dose:"2g",time:"morning",purpose:"Inflammation & heart"},{name:"Creatine Monohydrate",dose:"5g",time:"morning",purpose:"Strength & cognition"},{name:"Zinc",dose:"25mg",time:"evening",purpose:"Testosterone & immunity"},{name:"Ashwagandha",dose:"600mg",time:"evening",purpose:"Stress & cortisol"}];

  const inp=(k,label,ph,type="text")=>(
    <div key={k}>
      <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{label}</div>
      <Inp type={type} value={p[k]||""} onChange={e=>upd(k,e.target.value)} placeholder={ph}/>
    </div>
  );

  if(cur==="welcome") return (
    <div style={{minHeight:"100vh",background:t.BG,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,textAlign:"center",position:"relative",overflow:"hidden"}}>
      <BgPhotoLayer photoId="bg6"/>
      <div style={{position:"relative",zIndex:1}}>
        <div style={{fontSize:9,letterSpacing:5,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:16}}>The Executive</div>
        <div style={{width:40,height:1,background:"linear-gradient(90deg,transparent,"+t.GOLD+",transparent)",marginBottom:28,opacity:.6}}/>
        <div style={{fontSize:32,color:"#fff",lineHeight:1.25,marginBottom:14,fontFamily:"'Cormorant Garamond',Georgia,serif",fontWeight:300}}>Welcome.<br/>Let's set up your<br/>dashboard.</div>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",fontFamily:"'Montserrat',sans-serif",lineHeight:1.85,maxWidth:300,marginBottom:12}}>This takes about 3 minutes. You'll set up your profile, finances, health goals, habits and more.</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",fontFamily:"'Montserrat',sans-serif",marginBottom:40}}>Everything can be updated later.</div>
        <button onClick={next} style={{background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:12,padding:"15px 44px",color:"#080808",cursor:"pointer",fontSize:13,fontFamily:"'Montserrat',sans-serif",fontWeight:700,letterSpacing:2,textTransform:"uppercase",marginBottom:14}}>Begin Setup</button>
        <br/>
        <button onClick={()=>onComplete(null)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12,textDecoration:"underline"}}>Skip for now — go straight to dashboard</button>
      </div>
    </div>
  );

  if(cur==="done") return (
    <div style={{minHeight:"100vh",background:t.BG,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,textAlign:"center",position:"relative",overflow:"hidden"}}>
      <BgPhotoLayer photoId="bg6"/>
      <div style={{position:"relative",zIndex:1}}>
        <div style={{fontSize:48,marginBottom:16}}>✦</div>
        <div style={{fontSize:9,letterSpacing:4,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:12}}>You're all set</div>
        <div style={{fontSize:28,color:"#fff",marginBottom:12,fontFamily:"'Cormorant Garamond',Georgia,serif",fontWeight:300}}>{"Welcome, "+(p.firstName||"Executive")+"."}</div>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.45)",fontFamily:"'Montserrat',sans-serif",lineHeight:1.85,maxWidth:300,marginBottom:16}}>Your dashboard is personalised and ready. Every section you filled in is already populated.</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",fontFamily:"'Montserrat',sans-serif",marginBottom:40}}>You can update anything later from within each page.</div>
        <button onClick={finish} style={{background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:12,padding:"15px 44px",color:"#080808",cursor:"pointer",fontSize:13,fontFamily:"'Montserrat',sans-serif",fontWeight:700,letterSpacing:2,textTransform:"uppercase"}}>Enter The Executive →</button>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:t.BG,display:"flex",flexDirection:"column",maxWidth:540,margin:"0 auto"}}>
      {/* Header */}
      <div style={{padding:"16px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:9,letterSpacing:4,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif"}}>Setup</div>
        <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{step-1+" / "+(STEPS.length-3)}</div>
      </div>
      <div style={{margin:"8px 20px 0",height:2,background:t.BORDER,borderRadius:99,overflow:"hidden"}}>
        <div style={{width:(prog*100)+"%",height:"100%",background:"linear-gradient(90deg,"+t.GOLD+","+t.GL+")",transition:"width .4s"}}/>
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:"auto",padding:"24px 20px 120px"}}>

        {cur==="personal"&&(
          <div>
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:6}}>Personal</div>
            <div style={{fontSize:22,color:t.TEXT,marginBottom:20}}>Tell us about yourself</div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"flex",gap:10}}>{inp("firstName","First Name","William")}{inp("lastName","Last Name","Sterling")}</div>
              {inp("dob","Date of Birth","","date")}
              {inp("location","City / State","Brisbane, QLD")}
              {inp("occupation","Occupation","Founder / Investor")}
            </div>
          </div>
        )}

        {cur==="body"&&(
          <div>
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:6}}>Body Metrics</div>
            <div style={{fontSize:22,color:t.TEXT,marginBottom:6}}>Physical baseline</div>
            <div style={{fontSize:12,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:20}}>Used for body tracking and health scoring. You can skip this and add later.</div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"flex",gap:10}}>{inp("height","Height (cm)","182","number")}{inp("weight","Weight (kg)","85","number")}</div>
              <div style={{display:"flex",gap:10}}>{inp("targetWeight","Target Weight (kg)","80","number")}{inp("bodyFat","Body Fat %","18","number")}</div>
              {inp("sleepHours","Average Sleep (hrs)","7.5","number")}
            </div>
          </div>
        )}

        {cur==="healthgoals"&&(
          <div>
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:6}}>Health Goals</div>
            <div style={{fontSize:22,color:t.TEXT,marginBottom:6}}>What are you working toward?</div>
            <div style={{fontSize:12,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:20}}>Select all that apply — used to personalise your supplement recommendations, recipes and AI advice.</div>
            {[
              {cat:"Body Composition",items:[
                {id:"Build Muscle",icon:"W",desc:"Increase lean mass and strength"},
                {id:"Lose Fat",icon:"F",desc:"Reduce body fat percentage"},
                {id:"Maintain Weight",icon:"S",desc:"Keep current body composition"},
              ]},
              {cat:"Performance",items:[
                {id:"Increase Energy",icon:"E",desc:"More sustained energy through the day"},
                {id:"Boost Testosterone",icon:"T",desc:"Optimise hormonal health"},
                {id:"Improve HRV",icon:"H",desc:"Better recovery and readiness"},
                {id:"Athletic Performance",icon:"A",desc:"Sport-specific strength and endurance"},
              ]},
              {cat:"Wellbeing",items:[
                {id:"Improve Sleep",icon:"Z",desc:"Deeper, more restorative sleep"},
                {id:"Reduce Stress",icon:"M",desc:"Lower cortisol, calmer baseline"},
                {id:"Mental Clarity",icon:"B",desc:"Sharper focus and cognition"},
                {id:"Longevity",icon:"L",desc:"Long-term health optimisation"},
              ]},
            ].map(group=>(
              <div key={group.cat} style={{marginBottom:16}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>{group.cat}</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {group.items.map(g=>{
                    const on=p.healthGoals.includes(g.id);
                    return (
                      <div key={g.id} onClick={()=>toggleArr("healthGoals",g.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:on?t.GOLD+"18":t.CARD,border:"1px solid "+(on?t.GOLD:t.BORDER),borderRadius:8,cursor:"pointer",transition:"all .2s"}}>
                        <div style={{width:32,height:32,borderRadius:8,background:on?t.GOLD+"33":t.CARD2,border:"1px solid "+(on?t.GOLD:t.BORDER),display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>{g.icon}</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,color:on?t.GOLD:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{g.id}</div>
                          <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:1}}>{g.desc}</div>
                        </div>
                        <div style={{width:20,height:20,borderRadius:"50%",border:"1.5px solid "+(on?t.GOLD:t.BORDER),background:on?t.GOLD:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          {on&&<span style={{fontSize:9,color:t.BG,fontWeight:700}}>V</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {p.healthGoals.length>0&&<div style={{fontSize:11,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",marginTop:4}}>{p.healthGoals.length+" selected"}</div>}
          </div>
        )}

        {cur==="habits"&&(
          <div>
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:6}}>Daily Habits</div>
            <div style={{fontSize:22,color:t.TEXT,marginBottom:6}}>Build your daily routine</div>
            <div style={{fontSize:12,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:20}}>Select habits you already practise or want to start. Each one goes straight into your habit tracker with streak tracking.</div>
            {[
              {cat:"Morning",color:"#C9A84C",items:[
                {id:"Morning Routine",icon:"S",desc:"Structured start - journal, plan, review",freq:"Daily"},
                {id:"Cold Exposure",icon:"C",desc:"Cold shower or ice bath for alertness",freq:"Daily"},
                {id:"Meditation",icon:"M",desc:"Mindfulness or breathwork practice",freq:"Daily"},
                {id:"Journalling",icon:"J",desc:"Capture thoughts, intentions and gratitude",freq:"Daily"},
              ]},
              {cat:"Physical",color:"#7A9E7E",items:[
                {id:"Strength Training",icon:"W",desc:"Weightlifting or resistance work",freq:"4x/week"},
                {id:"Cardio",icon:"R",desc:"Running, cycling, rowing or HIIT",freq:"3x/week"},
                {id:"Mobility Work",icon:"Y",desc:"Stretching, yoga or foam rolling",freq:"Daily"},
                {id:"Evening Walk",icon:"E",desc:"Low intensity movement to wind down",freq:"Daily"},
              ]},
              {cat:"Nutrition",color:"#7EB8C9",items:[
                {id:"Intermittent Fasting",icon:"F",desc:"16:8 or similar eating window",freq:"Daily"},
                {id:"No Alcohol",icon:"A",desc:"Alcohol-free lifestyle",freq:"Daily"},
                {id:"No Processed Food",icon:"N",desc:"Whole foods only",freq:"Daily"},
                {id:"Hydration",icon:"H",desc:"2-3L water minimum per day",freq:"Daily"},
              ]},
              {cat:"Mind",color:"#B07EC9",items:[
                {id:"Reading Daily",icon:"B",desc:"Books - non-fiction or fiction",freq:"Daily"},
                {id:"No Social Media",icon:"X",desc:"Cut the scroll, protect focus",freq:"Daily"},
                {id:"Learning",icon:"L",desc:"Online course, podcast or skill building",freq:"Daily"},
                {id:"Gratitude Practice",icon:"G",desc:"Note 3 things you are grateful for",freq:"Daily"},
              ]},
            ].map(group=>(
              <div key={group.cat} style={{marginBottom:16}}>
                <div style={{fontSize:9,color:group.color,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>{group.cat}</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {group.items.map(h=>{
                    const on=p.currentHabits.includes(h.id);
                    return (
                      <div key={h.id} onClick={()=>toggleArr("currentHabits",h.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:on?group.color+"18":t.CARD,border:"1px solid "+(on?group.color:t.BORDER),borderRadius:8,cursor:"pointer",transition:"all .2s"}}>
                        <div style={{width:32,height:32,borderRadius:8,background:on?group.color+"33":t.CARD2,border:"1px solid "+(on?group.color:t.BORDER),display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>{h.icon}</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,color:on?group.color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{h.id}</div>
                          <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:1}}>{h.desc}</div>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3,flexShrink:0}}>
                          <div style={{fontSize:9,color:on?group.color:t.MUTED,fontFamily:"'Montserrat',sans-serif",background:on?group.color+"18":t.CARD2,padding:"2px 6px",borderRadius:6}}>{h.freq}</div>
                          <div style={{width:18,height:18,borderRadius:"50%",border:"1.5px solid "+(on?group.color:t.BORDER),background:on?group.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                            {on&&<span style={{fontSize:8,color:t.BG,fontWeight:700}}>V</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {p.currentHabits.length>0&&<div style={{fontSize:11,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",marginTop:4}}>{p.currentHabits.length+" habits selected"}</div>}
          </div>
        )}

        {cur==="supplements"&&(
          <div>
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:6}}>Supplements</div>
            <div style={{fontSize:22,color:t.TEXT,marginBottom:6}}>Your current stack</div>
            <div style={{fontSize:12,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:16}}>Select from common supplements or skip — you can manage these in the Health tab.</div>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
              {SUPP_PRESETS.map(s=>{
                const on=initSupps.some(x=>x.name===s.name);
                return (
                  <div key={s.name} onClick={()=>setInitSupps(ss=>on?ss.filter(x=>x.name!==s.name):[...ss,s])} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:on?t.GOLD+"18":t.CARD,border:"1px solid "+(on?t.GOLD:t.BORDER),borderRadius:8,cursor:"pointer"}}>
                    <div>
                      <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{s.name}<span style={{fontSize:10,color:t.MUTED,fontWeight:400}}>{" - "+s.dose}</span></div>
                      <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:1}}>{s.purpose}</div>
                    </div>
                    <div style={{width:20,height:20,borderRadius:"50%",border:"1.5px solid "+(on?t.GOLD:t.BORDER),background:on?t.GOLD:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {on&&<span style={{fontSize:9,color:t.BG,fontWeight:700}}>V</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{""+initSupps.length+" selected. Add custom supplements in the Health tab."}</div>
          </div>
        )}

        {cur==="goals"&&(
          <div>
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:6}}>Goals</div>
            <div style={{fontSize:22,color:t.TEXT,marginBottom:6}}>What do you want to achieve?</div>
            <div style={{fontSize:12,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:20}}>Pick from suggestions or write your own. You can add, edit and track progress in the Goals tab.</div>

            {/* Suggested goals by category */}
            {[
              {cat:"Wealth",color:"#C9A84C",icon:"W",goals:[
                {title:"Reach my net worth target",period:"year",category:"wealth"},
                {title:"Save 3 months emergency fund",period:"year",category:"wealth"},
                {title:"Max out superannuation contributions",period:"year",category:"wealth"},
                {title:"Pay off credit card debt",period:"month",category:"wealth"},
              ]},
              {cat:"Career",color:"#7EB8C9",icon:"C",goals:[
                {title:"Launch a new revenue stream",period:"year",category:"career"},
                {title:"Get a promotion or raise",period:"year",category:"career"},
                {title:"Complete a professional course",period:"year",category:"career"},
                {title:"Hit monthly revenue target",period:"month",category:"career"},
              ]},
              {cat:"Health",color:"#7A9E7E",icon:"H",goals:[
                {title:"Drop to target body fat",period:"year",category:"health"},
                {title:"Complete 4 workouts per week",period:"week",category:"health"},
                {title:"Run a 5K",period:"year",category:"health"},
                {title:"Sleep 8 hours consistently",period:"month",category:"health"},
              ]},
              {cat:"Education",color:"#D4956A",icon:"E",goals:[
                {title:"Read 24 books this year",period:"year",category:"education"},
                {title:"Complete an online course",period:"year",category:"education"},
                {title:"Read for 30 minutes daily",period:"week",category:"education"},
              ]},
              {cat:"Personal",color:"#B07EC9",icon:"P",goals:[
                {title:"No social media",period:"week",category:"personal"},
                {title:"Travel to 2 new countries",period:"year",category:"personal"},
                {title:"Spend quality time with family weekly",period:"week",category:"personal"},
              ]},
            ].map(group=>(
              <div key={group.cat} style={{marginBottom:16}}>
                <div style={{fontSize:9,color:group.color,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>{group.cat}</div>
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  {group.goals.map(g=>{
                    const on=initGoals.some(x=>x.title===g.title);
                    return (
                      <div key={g.title} onClick={()=>on?setInitGoals(gs=>gs.filter(x=>x.title!==g.title)):setInitGoals(gs=>[...gs,{...g,id:Date.now()+Math.random(),progress:0,milestones:[],actions:[]}])} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:on?group.color+"18":t.CARD,border:"1px solid "+(on?group.color:t.BORDER),borderRadius:7,cursor:"pointer",transition:"all .2s"}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,color:on?group.color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:on?600:400}}>{g.title}</div>
                        </div>
                        <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",background:t.CARD2,padding:"2px 6px",borderRadius:5,flexShrink:0}}>{g.period==="week"?"Weekly":g.period==="month"?"Monthly":"Annual"}</div>
                        <div style={{width:18,height:18,borderRadius:"50%",border:"1.5px solid "+(on?group.color:t.BORDER),background:on?group.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          {on&&<span style={{fontSize:8,color:t.BG,fontWeight:700}}>V</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Custom goal entry */}
            <div style={{background:t.CARD,border:"1px solid "+t.GOLD+"44",borderRadius:8,padding:"12px 14px",marginTop:8}}>
              <div style={{fontSize:10,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Add a Custom Goal</div>
              <Inp value={newGoal.title} onChange={e=>setNewGoal(g=>({...g,title:e.target.value}))} placeholder="e.g. Close $500k in new revenue..." style={{marginBottom:8}}/>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <Sel value={newGoal.period} onChange={e=>setNewGoal(g=>({...g,period:e.target.value}))} style={{flex:1}}>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="year">This Year</option>
                </Sel>
                <Sel value={newGoal.category} onChange={e=>setNewGoal(g=>({...g,category:e.target.value}))} style={{flex:1}}>
                  {["wealth","career","health","education","personal"].map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                </Sel>
              </div>
              <Btn onClick={()=>{if(!newGoal.title.trim())return;setInitGoals(gs=>[...gs,{...newGoal,id:Date.now(),progress:0,milestones:[],actions:[]}]);setNewGoal({title:"",period:"month",category:"wealth"});}}>Add Goal</Btn>
            </div>

            {initGoals.length>0&&(
              <div style={{marginTop:16}}>
                <div style={{fontSize:10,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>{initGoals.length+" goal"+(initGoals.length!==1?"s":"")+" selected"}</div>
                {initGoals.map((g,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,marginBottom:5}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{g.title}</div>
                      <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:1}}>{g.category+" - "+g.period}</div>
                    </div>
                    <button onClick={()=>setInitGoals(gs=>gs.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:12,marginLeft:8}}>X</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {cur==="financial"&&(
          <div>
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:6}}>Finances</div>
            <div style={{fontSize:22,color:t.TEXT,marginBottom:6}}>Your financial position</div>
            <div style={{fontSize:12,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:20}}>Shares and crypto are tracked separately in the Wealth tab. Skip anything you prefer not to enter now.</div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {inp("annualIncome","Annual Income (AUD)","320,000","number")}
              <div style={{height:1,background:t.BORDER}}/>
              <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",letterSpacing:1,textTransform:"uppercase"}}>Property</div>
              <div style={{display:"flex",gap:10}}>{inp("propertyValue","Property Value","1,000,000","number")}{inp("mortgageDebt","Mortgage Owing","900,000","number")}</div>
              <div style={{height:1,background:t.BORDER}}/>
              <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",letterSpacing:1,textTransform:"uppercase"}}>Other</div>
              <div style={{display:"flex",gap:10}}>{inp("cashSavings","Cash & Savings","50,000","number")}{inp("superBalance","Superannuation","150,000","number")}</div>
              <div style={{height:1,background:t.BORDER}}/>
              <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",letterSpacing:1,textTransform:"uppercase"}}>Other Debts</div>
              <div style={{display:"flex",gap:10}}>{inp("carDebt","Car Finance","0","number")}{inp("creditCardDebt","Credit Cards","0","number")}</div>
              {inp("personalDebt","Personal Loans","0","number")}
            </div>
          </div>
        )}

        {cur==="appearance"&&(
          <div>
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:6}}>Appearance</div>
            <div style={{fontSize:22,color:t.TEXT,marginBottom:6}}>Choose your theme</div>
            <div style={{fontSize:12,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:20}}>Pick the look that suits you. You can change this anytime in Profile.</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
              {[
                {id:"obsidian",label:"Obsidian",sub:"Dark - gold accents",bg:"#0D0D0D",card:"#141414",border:"#2A2A2A",accent:"#C9A84C",text:"#E8E0D0",muted:"#7A7060"},
                {id:"charcoal",label:"Charcoal",sub:"Dark - grey tones",bg:"#141414",card:"#1E1E1E",border:"#2E2E2E",accent:"#AFAFAF",text:"#E0E0E0",muted:"#666"},
              ].map(th=>(
                <div key={th.id} onClick={()=>{setP(f=>({...f,theme:th.id}));_themeKey=th.id;setThemeState&&setThemeState(th.id);}} style={{background:th.card,border:"2px solid "+(p.theme===th.id?th.accent:th.border),borderRadius:10,padding:14,cursor:"pointer",transition:"all .2s"}}>
                  <div style={{background:th.bg,borderRadius:7,padding:10,marginBottom:10,border:"1px solid "+th.border}}>
                    <div style={{fontSize:8,color:th.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Today's Score</div>
                    <div style={{fontSize:22,color:th.accent,fontFamily:"'Montserrat',sans-serif",fontWeight:700,marginBottom:6}}>78%</div>
                    <div style={{height:3,background:th.border,borderRadius:99,overflow:"hidden"}}><div style={{width:"78%",height:"100%",background:th.accent,borderRadius:99}}/></div>
                    <div style={{display:"flex",gap:4,marginTop:8}}>
                      {[80,71,83].map((v,i)=><div key={i} style={{flex:1,height:3,background:th.border,borderRadius:99,overflow:"hidden"}}><div style={{width:v+"%",height:"100%",background:th.accent,opacity:.6+i*.1,borderRadius:99}}/></div>)}
                    </div>
                  </div>
                  <div style={{fontSize:13,color:th.text,fontFamily:"'Montserrat',sans-serif",fontWeight:600,marginBottom:2}}>{th.label}</div>
                  <div style={{fontSize:10,color:th.muted,fontFamily:"'Montserrat',sans-serif"}}>{th.sub}</div>
                  {p.theme===th.id&&<div style={{marginTop:6,fontSize:9,color:th.accent,fontFamily:"'Montserrat',sans-serif"}}>Selected</div>}
                </div>
              ))}
            </div>
          </div>
        )}
        {cur==="risk"&&(
          <div>
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:6}}>Investment Profile</div>
            <div style={{fontSize:22,color:t.TEXT,marginBottom:6}}>Risk & targets</div>
            <div style={{fontSize:12,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:20}}>Used to personalise your AI Advisor and investment ideas.</div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:10}}>Investment risk tolerance</div>
              {["Conservative - protect capital","Balanced - steady growth","Growth - accept volatility","Aggressive - maximise returns"].map(r=>{
                const on=p.riskProfile===r;
                return <button key={r} onClick={()=>upd("riskProfile",r)} style={{display:"block",width:"100%",textAlign:"left",padding:"12px 14px",borderRadius:8,border:"1px solid "+(on?t.GOLD:t.BORDER),background:on?t.GOLD+"18":"transparent",color:on?t.GOLD:t.TEXT,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:13,marginBottom:7}}>{on?"V  ":""}{r}</button>;
              })}
            </div>
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:8}}>Net Worth Target (AUD)</div>
            <Inp type="number" value={p.netWorthTarget} onChange={e=>upd("netWorthTarget",e.target.value)} placeholder="3,000,000"/>
          </div>
        )}

      </div>

      {/* Footer buttons */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:540,padding:"12px 20px",background:"linear-gradient(transparent,"+t.BG+" 30%)",display:"flex",gap:10,paddingBottom:"calc(12px + env(safe-area-inset-bottom))"}}>
        {step>1&&<button onClick={back} style={{flex:1,background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:10,padding:14,color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:13}}>Back</button>}
        <button onClick={cur==="risk"?next:next} style={{flex:3,background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:10,padding:14,color:t.BG,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1}}>
          {cur==="risk"?"Finish Setup":"Continue"}
        </button>
        {["body","supplements","goals","financial"].includes(cur)&&(
          <button onClick={next} style={{position:"absolute",top:-28,right:20,background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,textDecoration:"underline"}}>Skip</button>
        )}
      </div>
    </div>
  );
}


function MacroBadge({label,value,color}){
  const t=T();
  return(
    <div style={{textAlign:"center",background:color+"18",border:"1px solid "+color+"44",borderRadius:7,padding:"5px 10px",minWidth:52}}>
      <div style={{fontSize:13,color:color,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{value}</div>
      <div style={{fontSize:8,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1}}>{label}</div>
    </div>
  );
}

const TYPE_COLORS={podcast:"#C9A84C",book:"#7EB8C9",youtube:"#C97E7E",course:"#7A9E7E",article:"#B07EC9"};
const TYPE_ICONS={podcast:"M",book:"B",youtube:"Y",course:"C",article:"A"};
const TYPE_LINKS={podcast:"https://open.spotify.com/search/",book:"https://www.audible.com.au/search?keywords=",youtube:"https://www.youtube.com/results?search_query=",course:"https://www.coursera.org/search?query="};

function RecCard({r,actions}){
  const t=T();
  return(
    <div style={{display:"flex",gap:12,alignItems:"flex-start",padding:"10px 0"}}>
      <div style={{width:40,height:40,borderRadius:8,background:(TYPE_COLORS[r.type]||t.GOLD)+"18",border:"1px solid "+(TYPE_COLORS[r.type]||t.GOLD)+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{TYPE_ICONS[r.type]||"L"}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:9,color:TYPE_COLORS[r.type]||t.GOLD,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,background:(TYPE_COLORS[r.type]||t.GOLD)+"14",display:"inline-block",padding:"1px 6px",borderRadius:4,marginBottom:4}}>{r.type}</div>
        <div style={{fontSize:13,color:t.TEXT,fontWeight:600,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.title}</div>
        <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:4}}>{r.creator}</div>
        <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",lineHeight:1.6}}>{r.description}</div>
        <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>{actions}</div>
      </div>
    </div>
  );
}
function RecipesPage({profile,subscription,setShowUpgrade,authToken}){
  const t=T();
  const[mealFilter,setMealFilter]=useState("all");
  const[goalFilter,setGoalFilter]=useState("all");
  const[dietFilter,setDietFilter]=useState("all");
  const[recipes,setRecipes]=useState([]);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState("");
  const[selected,setSelected]=useState(null);
  const[favourites,setFavourites]=useState([]);
  const[shoppingList,setShoppingList]=useState([]);
  const[showShoppingList,setShowShoppingList]=useState(false);
  const[tab,setTab]=useState("discover");
  const[servings,setServings]=useState(2);

  const MEAL_TYPES=["all","Breakfast","Lunch","Dinner","Snack","Post-Workout","Pre-Workout"];
  const DIET_FILTERS=["all","High Protein","Low Carb","Keto","Mediterranean","Intermittent Fasting","Dairy Free","Gluten Free"];
  const healthGoals=(profile.healthGoals||[]);

  const generateRecipes=async()=>{
    if(!isPro(subscription)){setShowUpgrade(true);return;}
    setLoading(true);setRecipes([]);setSelected(null);setError("");
    const goalStr=healthGoals.join(", ")||"general health";
    const mealStr=mealFilter==="all"?"any meal type":mealFilter;
    const dietStr=dietFilter==="all"?"no specific diet":dietFilter;
    const bodyStr=profile.weight?"Weight: "+profile.weight+"kg, Target: "+(profile.targetWeight||"?")+"kg":"";
    try{
      const r=await claudeFetch({
        model:"claude-haiku-4-5",
        max_tokens:2000,
        system:"You are a nutritionist and chef. You MUST return ONLY a valid JSON array with no markdown, no backticks, no explanation text before or after. Start your response with [ and end with ].",
        messages:[{role:"user",content:"Generate 2 DIFFERENT and VARIED recipes (never repeat the same dish) for health goals: "+goalStr+". "+bodyStr+". Meal type: "+mealStr+". Diet: "+dietStr+". Session ID: "+Math.random().toString(36).slice(2)+" - use this to ensure variety. Draw from diverse cuisines (Asian, Mediterranean, Mexican, Middle Eastern, etc) and cooking methods. Return a JSON array of 2 objects. Each object must have exactly these fields: title (string), mealType (string), prepTime (string), cookTime (string), difficulty (string), calories (number), protein (number), carbs (number), fat (number), whyItFits (string), ingredients (array of {item, amount, category} where category is one of: Produce, Meat and Fish, Dairy and Eggs, Pantry, Spices, Other), steps (array of strings)."}]
      });
      const d=await r.json();
      const text=(d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("");
      const start=text.indexOf("[");
      const end=text.lastIndexOf("]");
      if(start===-1||end===-1){setError("No recipes returned. Please try again.");setLoading(false);return;}
      const parsed=JSON.parse(text.slice(start,end+1));
      setRecipes(Array.isArray(parsed)&&parsed.length>0?parsed:[]);
      if(!Array.isArray(parsed)||parsed.length===0)setError("No recipes returned. Please try again.");
    }catch(e){console.error("Recipe error:",e.message);setError("Failed to generate recipes: "+e.message);}
    setLoading(false);
  };

  const addToShoppingList=(recipe,srvgs)=>{
    const s=srvgs||servings||2;
    setShoppingList(sl=>{
      const existing=[...sl];
      (recipe.ingredients||[]).forEach(ing=>{
        const key=ing.item.toLowerCase().trim();
        if(!existing.find(x=>x.item.toLowerCase().trim()===key)){
          // Scale the amount
          const scaleAmount=(amount)=>{
            const num=parseFloat(amount);
            if(isNaN(num))return amount;
            const scaled=Math.round((num/2*s)*100)/100;
            return amount.replace(/^[\d.]+/,scaled);
          };
          existing.push({...ing,amount:scaleAmount(ing.amount),fromRecipe:recipe.title+" ("+s+" servings)",checked:false,id:Date.now()+Math.random()});
        }
      });
      return existing;
    });
  };

  const downloadShoppingList=()=>{
    const cats={};
    shoppingList.forEach(item=>{const cat=item.category||"Other";if(!cats[cat])cats[cat]=[];cats[cat].push(item);});
    const date=new Date().toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
    const recipes=[...new Set(shoppingList.map(x=>x.fromRecipe).filter(Boolean))];
    const catSections=Object.entries(cats).map(([cat,items])=>{
      const rows=items.map(item=>'<div class="item"><div class="checkbox"></div><div class="item-name">'+item.item+'</div><div class="item-amount">'+item.amount+'</div></div>').join("");
      return '<div class="category"><div class="cat-header"><div class="cat-icon">'+cat[0]+'</div><div class="cat-name">'+cat+'</div><div class="cat-count">'+items.length+' item'+(items.length!==1?'s':'')+'</div></div>'+rows+'</div>';
    }).join("");
    const recipeTags=recipes.map(r=>'<div class="recipe-tag">'+r+'</div>').join("");
    const html='<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/><title>Shopping List</title><style>*{box-sizing:border-box;margin:0;padding:0;}body{background:#F5F0E8;font-family:-apple-system,BlinkMacSystemFont,sans-serif;min-height:100vh;}.header{background:#080808;padding:24px 20px 20px;text-align:center;}.header-label{font-size:9px;letter-spacing:4px;color:#C9A84C;text-transform:uppercase;margin-bottom:8px;}.header-title{font-size:26px;color:#fff;font-weight:300;margin-bottom:4px;}.header-date{font-size:11px;color:#6A6050;margin-bottom:16px;}.header-stats{display:flex;justify-content:center;gap:20px;}.stat{text-align:center;}.stat-val{font-size:20px;color:#C9A84C;font-weight:700;}.stat-lbl{font-size:9px;color:#6A6050;text-transform:uppercase;letter-spacing:1px;}.recipes{background:#111;padding:10px 20px;display:flex;flex-wrap:wrap;gap:6px;}.recipe-tag{background:rgba(201,168,76,.15);border:1px solid rgba(201,168,76,.3);border-radius:10px;padding:3px 10px;font-size:10px;color:#C9A84C;}.content{padding:16px 16px 40px;max-width:540px;margin:0 auto;}.category{background:#fff;border-radius:12px;margin-bottom:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);}.cat-header{display:flex;align-items:center;gap:10px;padding:12px 14px;background:#f9f7f3;border-bottom:1px solid #EDE8DC;}.cat-icon{width:28px;height:28px;border-radius:7px;background:#C9A84C;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;}.cat-name{flex:1;font-size:13px;color:#1A1208;font-weight:600;}.cat-count{font-size:10px;color:#8A7A60;}.item{display:flex;align-items:center;gap:12px;padding:13px 14px;border-bottom:1px solid #F0EBE0;cursor:pointer;transition:background .15s;}.item:last-child{border-bottom:none;}.item:active{background:#F0EBE0;}.checkbox{width:24px;height:24px;border-radius:50%;border:2px solid #DDD5C0;flex-shrink:0;transition:all .2s;}.item-name{flex:1;font-size:15px;color:#1A1208;font-weight:400;transition:all .2s;}.item-amount{font-size:12px;color:#C9A84C;font-weight:600;background:#FDF8EE;border:1px solid #EDE8DC;border-radius:6px;padding:3px 9px;flex-shrink:0;}.done .checkbox{background:#7A9E7E;border-color:#7A9E7E;}.done .item-name{text-decoration:line-through;color:#9A9080;}.footer{text-align:center;padding:20px;font-size:10px;color:#8A7A60;}@media print{.header,.cat-icon{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head><body><div class="header"><div class="header-label">The Executive</div><div class="header-title">Shopping List</div><div class="header-date">'+date+'</div><div class="header-stats"><div class="stat"><div class="stat-val">'+shoppingList.length+'</div><div class="stat-lbl">Items</div></div><div class="stat"><div class="stat-val">'+Object.keys(cats).length+'</div><div class="stat-lbl">Categories</div></div><div class="stat"><div class="stat-val">'+recipes.length+'</div><div class="stat-lbl">Recipes</div></div></div></div>'+(recipes.length?'<div class="recipes">'+recipeTags+'</div>':'')+'<div class="content">'+catSections+'</div><div class="footer">The Executive &nbsp;·&nbsp; Tap items to check off as you shop</div><script>document.querySelectorAll(".item").forEach(function(el){el.addEventListener("click",function(){this.classList.toggle("done");});});<\/script></body></html>';
    const blob=new Blob([html],{type:"text/html"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download="shopping-list.html";a.click();
    URL.revokeObjectURL(url);
  };

  const isFav=r=>favourites.some(f=>f.title===r.title);
  const toggleFav=r=>setFavourites(fs=>isFav(r)?fs.filter(f=>f.title!==r.title):[...fs,r]);



  // Full recipe view
  if(selected){
    const r=selected;
    const catGroups={};
    (r.ingredients||[]).forEach(ing=>{
      const cat=ing.category||"Other";
      if(!catGroups[cat])catGroups[cat]=[];
      catGroups[cat].push(ing);
    });
    return (
      <div data-page="true" style={{maxWidth:720,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <button onClick={()=>setSelected(null)} style={{background:"none",border:"none",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:13,display:"flex",alignItems:"center",gap:6}}>
            {"< Back"}
          </button>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>toggleFav(r)} style={{background:isFav(r)?t.GOLD+"22":"transparent",border:"1px solid "+(isFav(r)?t.GOLD:t.BORDER),borderRadius:7,padding:"6px 12px",color:isFav(r)?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>
              {isFav(r)?"Saved":"Save"}
            </button>
            <button onClick={()=>{addToShoppingList(r,servings);setSelected(null);setShowShoppingList(true);}} style={{background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:7,padding:"6px 14px",color:t.BG,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:700}}>
              Add to Shopping List
            </button>
          </div>
        </div>

        <Card style={{marginBottom:14,overflow:"hidden",padding:0}}>
          {(()=>{
            const colors=["#1A1208","#0D1A0D","#0D0D1A","#1A0D0D","#1A1A0D"];
            const ci=r.title.charCodeAt(0)%colors.length;
            return (
              <div style={{width:"100%",height:200,background:"linear-gradient(135deg,"+colors[ci]+",#080808)",position:"relative",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <div style={{fontSize:80,opacity:.1}}>{r.mealType==="Breakfast"?"B":r.mealType==="Lunch"?"L":r.mealType==="Dinner"?"D":"F"}</div>
                <img src={"https://source.unsplash.com/800x400/?"+encodeURIComponent(r.title+",food,meal")} alt={r.title} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0,transition:"opacity .3s"}} onError={e=>{e.target.style.display="none";}} onLoad={e=>{e.target.style.opacity=1;}} loading="lazy"/>
              </div>
            );
          })()}
          <div style={{padding:16}}>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>{r.mealType}</div>
            <div style={{fontSize:22,color:t.TEXT,marginBottom:8}}>{r.title}</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}>
              {[{l:"Prep",v:r.prepTime},{l:"Cook",v:r.cookTime},{l:"Difficulty",v:r.difficulty}].map(x=>(
                <div key={x.l} style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",background:t.CARD2,padding:"3px 9px",borderRadius:10}}>
                  {x.l+": "+x.v}
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <MacroBadge label="Calories" value={r.calories} color={t.GOLD}/>
              <MacroBadge label="Protein" value={r.protein+"g"} color={t.GREEN}/>
              <MacroBadge label="Carbs" value={r.carbs+"g"} color={t.BLUE}/>
              <MacroBadge label="Fat" value={r.fat+"g"} color={t.PURPLE}/>
            </div>
          </div>
          {r.whyItFits&&(
            <div style={{padding:"10px 12px",background:t.GOLD+"0A",border:"1px solid "+t.GOLD+"22",borderRadius:7}}>
              <div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Why this fits your goals</div>
              <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",lineHeight:1.7}}>{r.whyItFits}</div>
            </div>
          )}
          </div>
        </Card>

        <Card style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <SectionLabel>Ingredients</SectionLabel>
            <div style={{display:"flex",alignItems:"center",gap:10,background:t.CARD2,borderRadius:8,padding:"4px 10px"}}>
              <button onClick={()=>setServings(s=>Math.max(1,s-1))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:18,lineHeight:1,fontWeight:300}}>-</button>
              <div style={{textAlign:"center",minWidth:60}}>
                <div style={{fontSize:14,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{servings}</div>
                <div style={{fontSize:8,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1}}>servings</div>
              </div>
              <button onClick={()=>setServings(s=>Math.min(20,s+1))} style={{background:"none",border:"none",color:t.GOLD,cursor:"pointer",fontSize:18,lineHeight:1,fontWeight:300}}>+</button>
            </div>
          </div>
          {Object.entries(catGroups).map(([cat,items])=>(
            <div key={cat} style={{marginBottom:12}}>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{cat}</div>
              {items.map((ing,i)=>{
                const scaleAmount=(amount)=>{
                  const num=parseFloat(amount);
                  if(isNaN(num))return amount;
                  const scaled=Math.round((num/2*servings)*100)/100;
                  return amount.replace(/^[\d.]+/,scaled);
                };
                return (
                  <div key={i+"-"+servings} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid "+t.BORDER+"66"}}>
                    <span style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{ing.item}</span>
                    <span style={{fontSize:12,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{scaleAmount(ing.amount)}</span>
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{marginTop:10,padding:"8px 12px",background:t.CARD2,borderRadius:7,display:"flex",justifyContent:"space-between"}}>
            {[{l:"Calories",v:Math.round((r.calories||0)/2*servings)},{l:"Protein",v:Math.round((r.protein||0)/2*servings)+"g"},{l:"Carbs",v:Math.round((r.carbs||0)/2*servings)+"g"},{l:"Fat",v:Math.round((r.fat||0)/2*servings)+"g"}].map(m=>(
              <div key={m.l} style={{textAlign:"center"}}>
                <div style={{fontSize:13,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{m.v}</div>
                <div style={{fontSize:8,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:.5}}>{m.l}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card style={{marginBottom:14}}>
          <SectionLabel>Method</SectionLabel>
          {(r.steps||[]).map((step,i)=>(
            <div key={i} style={{display:"flex",gap:12,marginBottom:14}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:t.GOLD+"22",border:"1px solid "+t.GOLD+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:t.GOLD,fontWeight:700,flexShrink:0}}>{i+1}</div>
              <div style={{fontSize:13,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",lineHeight:1.75,paddingTop:2}}>{step}</div>
            </div>
          ))}
        </Card>

        <button onClick={()=>{addToShoppingList(r,servings);setSelected(null);setShowShoppingList(true);}} style={{width:"100%",background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:10,padding:"14px",color:t.BG,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1}}>
          Add to Shopping List
        </button>
      </div>
    );
  }

  // Shopping list view
  if(showShoppingList){
    const cats={};
    shoppingList.forEach(item=>{const cat=item.category||"Other";if(!cats[cat])cats[cat]=[];cats[cat].push(item);});
    const checkedCount=shoppingList.filter(x=>x.checked).length;
    const totalItems=shoppingList.length;
    const pctDone=totalItems?Math.round(checkedCount/totalItems*100):0;

    // Category icons
    const catIcons={"Produce":"V","Meat and Fish":"F","Dairy and Eggs":"D","Pantry":"P","Spices":"S","Other":"O","Protein":"P","Grain":"G","Fat":"F","Dairy":"D","Herb":"H","Seasoning":"S"};

    return (
      <div data-page="true" style={{maxWidth:540,margin:"0 auto"}}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div>
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:4}}>Grocery List</div>
            <div style={{fontSize:24,color:t.TEXT}}>Shopping List</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setShowShoppingList(false)} style={{background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:7,padding:"7px 12px",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>Back</button>
            <Btn onClick={downloadShoppingList}>Download</Btn>
          </div>
        </div>

        {shoppingList.length===0?(
          <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
            <div style={{fontSize:32,marginBottom:10}}>C</div>
            <div style={{marginBottom:6}}>Your list is empty</div>
            <div style={{fontSize:11}}>Add recipes to build your shopping list</div>
          </div>
        ):(
          <>
            {/* Progress bar */}
            <div style={{background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:12,padding:"14px 16px",marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{checkedCount+" of "+totalItems+" items"}</div>
                <div style={{fontSize:13,color:pctDone===100?t.GREEN:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{pctDone+"%"}</div>
              </div>
              <PB value={pctDone} color={pctDone===100?t.GREEN:t.GOLD} height={6}/>
              {pctDone===100&&<div style={{fontSize:11,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",textAlign:"center",marginTop:8,fontWeight:600}}>All done! You're ready to cook.</div>}
            </div>

            {/* Action buttons */}
            <div style={{display:"flex",gap:8,marginBottom:16}}>
              <button onClick={()=>setShoppingList(sl=>sl.map(x=>({...x,checked:false})))} style={{flex:1,background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:8,padding:"8px",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>Uncheck All</button>
              <button onClick={()=>setShoppingList(sl=>sl.filter(x=>!x.checked))} style={{flex:1,background:t.RED+"18",border:"1px solid "+t.RED+"33",borderRadius:8,padding:"8px",color:t.RED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>Remove Checked</button>
              <button onClick={()=>setShoppingList([])} style={{flex:1,background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:8,padding:"8px",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>Clear All</button>
            </div>

            {/* Category sections */}
            {Object.entries(cats).map(([cat,items])=>{
              const catChecked=items.filter(x=>x.checked).length;
              const allCatChecked=catChecked===items.length;
              return (
                <div key={cat} style={{marginBottom:12}}>
                  {/* Category header */}
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                    <div style={{width:28,height:28,borderRadius:8,background:allCatChecked?t.GREEN+"22":t.GOLD+"18",border:"1px solid "+(allCatChecked?t.GREEN:t.GOLD)+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:allCatChecked?t.GREEN:t.GOLD,fontWeight:700,flexShrink:0}}>
                      {catIcons[cat]||cat[0]}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,color:allCatChecked?t.MUTED:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600,textDecoration:allCatChecked?"line-through":"none"}}>{cat}</div>
                      <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{catChecked+"/"+items.length+" checked"}</div>
                    </div>
                  </div>

                  {/* Items */}
                  <div style={{background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:10,overflow:"hidden"}}>
                    {items.map((item,i)=>(
                      <div key={item.id} onClick={()=>setShoppingList(sl=>sl.map(x=>x.id===item.id?{...x,checked:!x.checked}:x))}
                        style={{display:"flex",alignItems:"center",gap:12,padding:"13px 14px",borderBottom:i<items.length-1?"1px solid "+t.BORDER:"none",cursor:"pointer",background:item.checked?t.CARD2:"transparent",transition:"background .15s"}}>
                        {/* Checkbox */}
                        <div style={{width:24,height:24,borderRadius:"50%",border:"2px solid "+(item.checked?t.GREEN:t.BORDER),background:item.checked?t.GREEN:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .2s"}}>
                          {item.checked&&<span style={{fontSize:11,color:t.BG,fontWeight:700}}>V</span>}
                        </div>
                        {/* Item details */}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:14,color:item.checked?t.MUTED:t.TEXT,fontFamily:"'Montserrat',sans-serif",textDecoration:item.checked?"line-through":"none",fontWeight:500}}>{item.item}</div>
                          <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:1}}>{item.fromRecipe}</div>
                        </div>
                        {/* Amount badge */}
                        <div style={{background:item.checked?t.CARD:t.GOLD+"18",border:"1px solid "+(item.checked?t.BORDER:t.GOLD+"44"),borderRadius:6,padding:"3px 9px",flexShrink:0}}>
                          <div style={{fontSize:12,color:item.checked?t.MUTED:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{item.amount}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Download button */}
            <button onClick={downloadShoppingList} style={{width:"100%",background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:12,padding:"15px",color:t.BG,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,marginTop:8,marginBottom:20}}>
              Download Shopping List
            </button>
          </>
        )}
      </div>
    );
  }

  // Main discover view
  return (
    <div data-page="true" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Nutrition</div>
          <div style={{fontSize:26,color:t.TEXT}}>Recipes</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>Personalised to your health goals</div>
        </div>
        <button onClick={()=>setShowShoppingList(true)} style={{background:t.CARD,border:"1px solid "+t.GOLD+"44",borderRadius:7,padding:"7px 12px",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,display:"flex",alignItems:"center",gap:5}}>
          {"List: "+shoppingList.length}
        </button>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[["discover","Discover"],["favourites","Saved"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid "+(tab===id?t.GOLD:t.BORDER),background:tab===id?t.GOLD+"18":"transparent",color:tab===id?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12}}>
            {label}{id==="favourites"&&favourites.length>0?" ("+favourites.length+")":""}
          </button>
        ))}
      </div>

      {tab==="favourites"&&(
        <div>
          {favourites.length===0?(
            <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
              <div style={{fontSize:28,marginBottom:10}}>R</div>
              <div>No saved recipes yet — discover and save your favourites</div>
            </div>
          ):(
            favourites.map((r,i)=>(
              <Card key={i} style={{marginBottom:10,cursor:"pointer"}} onClick={()=>setSelected(r)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{r.mealType}</div>
                    <div style={{fontSize:14,color:t.TEXT,fontWeight:600,marginBottom:6}}>{r.title}</div>
                    <div style={{display:"flex",gap:8}}>
                      <span style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{r.calories+" cal"}</span>
                      <span style={{fontSize:10,color:t.GREEN,fontFamily:"'Montserrat',sans-serif"}}>{r.protein+"g protein"}</span>
                      <span style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{r.prepTime+" prep"}</span>
                    </div>
                  </div>
                  <button onClick={e=>{e.stopPropagation();toggleFav(r);}} style={{background:"none",border:"none",color:t.GOLD,cursor:"pointer",fontSize:16}}>S</button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {tab==="discover"&&(
        <>
          {/* Your goals */}
          {healthGoals.length>0&&(
            <div style={{marginBottom:14}}>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Your Goals</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {healthGoals.map(g=>(
                  <div key={g} style={{padding:"3px 10px",borderRadius:10,background:t.GOLD+"18",border:"1px solid "+t.GOLD+"33",fontSize:10,color:t.GOLD,fontFamily:"'Montserrat',sans-serif"}}>{g}</div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <Card style={{marginBottom:14}}>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Meal Type</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {MEAL_TYPES.map(m=>(
                    <button key={m} onClick={()=>setMealFilter(m)} style={{padding:"4px 11px",borderRadius:14,border:"1px solid "+(mealFilter===m?t.GOLD:t.BORDER),background:mealFilter===m?t.GOLD+"22":"transparent",color:mealFilter===m?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>
                      {m==="all"?"Any":m}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Dietary Style</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {DIET_FILTERS.map(d=>(
                    <button key={d} onClick={()=>setDietFilter(d)} style={{padding:"4px 11px",borderRadius:14,border:"1px solid "+(dietFilter===d?t.BLUE:t.BORDER),background:dietFilter===d?t.BLUE+"22":"transparent",color:dietFilter===d?t.BLUE:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>
                      {d==="all"?"Any":d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Generate button */}
          <button onClick={generateRecipes} disabled={loading} style={{width:"100%",background:loading?t.BORDER:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:10,padding:"14px",color:loading?t.MUTED:t.BG,cursor:loading?"default":"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,marginBottom:16}}>
            {loading?"Generating recipes...":"Generate Recipes for My Goals"}
          </button>

          {error&&!loading&&(
            <div style={{padding:"10px 14px",background:t.RED+"18",border:"1px solid "+t.RED+"33",borderRadius:8,fontSize:12,color:t.RED,fontFamily:"'Montserrat',sans-serif",marginBottom:12}}>{error}</div>
          )}
          {loading&&(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[1,2,3].map(i=><Card key={i} style={{padding:16}}><Skeleton height={14} width="60%" style={{marginBottom:8}}/><Skeleton height={10} width="40%" style={{marginBottom:12}}/><div style={{display:"flex",gap:8}}>{[1,2,3,4].map(j=><Skeleton key={j} width={52} height={40}/>)}</div></Card>)}
            </div>
          )}

          {/* Recipe cards */}
          {!loading&&recipes.length>0&&(
            <>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
              {recipes.map((r,i)=>(
                <Card key={i} style={{cursor:"pointer",padding:0,overflow:"hidden"}} onClick={()=>setSelected(r)}>
                  {(()=>{
                    const colors=["#1A1208","#0D1A0D","#0D0D1A","#1A0D0D","#1A1A0D"];
                    const ci=r.title.charCodeAt(0)%colors.length;
                    return (
                      <div style={{width:"100%",height:120,background:"linear-gradient(135deg,"+colors[ci]+",#080808)",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
                        <div style={{fontSize:40,opacity:.15}}>{r.mealType==="Breakfast"?"B":r.mealType==="Lunch"?"L":r.mealType==="Dinner"?"D":r.mealType==="Snack"?"S":"F"}</div>
                        <img src={"https://source.unsplash.com/400x200/?"+encodeURIComponent(r.title+",food,meal")} alt={r.title} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}} onError={e=>{e.target.style.display="none";}} onLoad={e=>{e.target.style.opacity=1;}} loading="lazy"/>
                      </div>
                    );
                  })()}
                  <div style={{padding:12}}>
                  <div style={{fontSize:8,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{r.mealType}</div>
                  <div style={{fontSize:13,color:t.TEXT,fontWeight:600,marginBottom:6,lineHeight:1.3}}>{r.title}</div>
                  <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
                    <span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",background:t.CARD2,padding:"2px 6px",borderRadius:8}}>{r.prepTime}</span>
                    <span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",background:t.CARD2,padding:"2px 6px",borderRadius:8}}>{r.difficulty}</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:4,marginBottom:10}}>
                    {[{l:"Cal",v:r.calories,c:t.GOLD},{l:"Protein",v:r.protein+"g",c:t.GREEN},{l:"Carbs",v:r.carbs+"g",c:t.BLUE},{l:"Fat",v:r.fat+"g",c:t.PURPLE}].map(m=>(
                      <div key={m.l} style={{background:m.c+"18",borderRadius:5,padding:"3px 6px",textAlign:"center"}}>
                        <div style={{fontSize:11,color:m.c,fontWeight:700}}>{m.v}</div>
                        <div style={{fontSize:7,color:t.MUTED,textTransform:"uppercase",letterSpacing:.5}}>{m.l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <button onClick={e=>{e.stopPropagation();addToShoppingList(r,servings);}} style={{background:t.GREEN+"18",border:"1px solid "+t.GREEN+"33",borderRadius:5,padding:"3px 8px",color:t.GREEN,cursor:"pointer",fontSize:9,fontFamily:"'Montserrat',sans-serif"}}>+ List</button>
                    <button onClick={e=>{e.stopPropagation();toggleFav(r);}} style={{background:"none",border:"none",color:isFav(r)?t.GOLD:t.MUTED,cursor:"pointer",fontSize:14}}>{isFav(r)?"S":"S"}</button>
                  </div>
                  </div>
                </Card>
              ))}
            </div>
            <button onClick={generateRecipes} style={{width:"100%",marginTop:10,background:t.CARD,border:"1px solid "+t.GOLD+"44",borderRadius:10,padding:"12px",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:600}}>Generate More Recipes</button>
            </>
          )}

          {!loading&&recipes.length===0&&(
            <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
              <div style={{fontSize:32,marginBottom:10}}>R</div>
              <div style={{fontSize:14,marginBottom:8}}>Ready to cook?</div>
              <div style={{fontSize:12}}>Tap Generate to get personalised recipe ideas based on your health goals</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SearchPage({tasks,goals,journal,books,workouts,setPage}){
  const t=T();
  const isMobile=useIsMobile();
  const[query,setQuery]=useState("");
  const q=query.toLowerCase().trim();

  const results=q.length<2?[]:[
    ...(tasks||[]).filter(x=>x.text?.toLowerCase().includes(q)).map(x=>({type:"Task",title:x.text,sub:x.priority+" priority",page:"tasks",color:t.GREEN})),
    ...(goals||[]).filter(x=>x.title?.toLowerCase().includes(q)||(x.notes||"").toLowerCase().includes(q)).map(x=>({type:"Goal",title:x.title,sub:x.category+" - "+x.progress+"%",page:"goals",color:t.GOLD})),
    ...(journal||[]).filter(x=>x.text?.toLowerCase().includes(q)).map(x=>({type:"Journal",title:x.date,sub:x.text.slice(0,80),page:"journal",color:t.PURPLE})),
    ...(books||[]).filter(x=>x.title?.toLowerCase().includes(q)||x.author?.toLowerCase().includes(q)||(x.review||"").toLowerCase().includes(q)).map(x=>({type:"Book",title:x.title,sub:x.author||"",page:"reading",color:t.BLUE})),
    ...(workouts||[]).filter(x=>x.date?.includes(q)||x.type?.toLowerCase().includes(q)||(x.notes||"").toLowerCase().includes(q)).map(x=>({type:"Workout",title:x.type+" - "+x.date,sub:x.sets?.length+" exercises",page:"workout",color:"#D4956A"})),
  ].slice(0,20);

  return (
    <div data-page="true" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Find Anything</div>
        <div style={{fontSize:26,color:t.TEXT,marginBottom:14}}>Search</div>
        <div style={{position:"relative"}}>
          <Inp
            value={query}
            onChange={e=>setQuery(e.target.value)}
            placeholder="Search tasks, goals, journal, books, workouts..."
            autoFocus
            style={{fontSize:15,padding:"13px 16px",borderRadius:12}}
          />
          {query&&<button onClick={()=>setQuery("")} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:16}}>X</button>}
        </div>
      </div>

      {q.length>0&&q.length<2&&(
        <div style={{textAlign:"center",padding:24,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontSize:12}}>Type at least 2 characters to search</div>
      )}

      {q.length>=2&&results.length===0&&(
        <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
          <div style={{fontSize:28,marginBottom:10}}>S</div>
          <div style={{fontSize:14,marginBottom:4}}>No results for "{query}"</div>
          <div style={{fontSize:12}}>Try searching tasks, goals, journal entries, books or workouts</div>
        </div>
      )}

      {results.length>0&&(
        <div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:12}}>{results.length+" result"+(results.length!==1?"s":"")+" for "+chr34+query+chr34}</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {results.map((r,i)=>(
              <Card key={i} style={{cursor:"pointer",borderLeft:"3px solid "+r.color}} onClick={()=>setPage(r.page)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:9,color:r.color,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>{r.type}</div>
                    <div style={{fontSize:13,color:t.TEXT,fontWeight:500,marginBottom:2}}>{r.title}</div>
                    {r.sub&&<div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{r.sub}</div>}
                  </div>
                  <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",flexShrink:0,marginLeft:10}}>Go</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!query&&(
        <div>
          <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Search across</div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,minmax(0,1fr))",gap:8}}>
            {[{l:"Tasks",c:t.GREEN,pg:"tasks"},{l:"Goals",c:t.GOLD,pg:"goals"},{l:"Journal",c:t.PURPLE,pg:"journal"},{l:"Books",c:t.BLUE,pg:"reading"},{l:"Workouts",c:"#D4956A",pg:"workout"},{l:"Recipes",c:t.RED,pg:"recipes"}].map(x=>(
              <div key={x.l} onClick={()=>setPage(x.pg)} style={{background:x.c+"18",border:"1px solid "+x.c+"33",borderRadius:8,padding:"12px 10px",textAlign:"center",cursor:"pointer"}}>
                <div style={{fontSize:12,color:x.c,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{x.l}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
const chr34='"';

// ── Learn Page ────────────────────────────────────────────────────────────────
function DividendPage({holdings,cryptoHoldings,portfolio}){
  const t=T();
  const isMobile=useIsMobile();
  const[divs,setDivs]=useState([]);
  const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({ticker:"",name:"",amountPerShare:"",frequency:"quarterly",nextPayDate:"",franking:"100"});

  const FREQS={weekly:52,fortnightly:26,monthly:12,quarterly:4,"semi-annual":2,annual:1};
  const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Merge holdings for autocomplete
  const allHoldings=[...(holdings||[]).map(h=>({ticker:h.ticker,name:h.name||h.ticker,shares:h.shares}))];

  const annualIncome=d=>{
    const shares=(holdings||[]).find(h=>h.ticker===d.ticker)?.shares||d.shares||0;
    return parseFloat(d.amountPerShare||0)*shares*(FREQS[d.frequency]||4);
  };

  const totalAnnual=divs.reduce((s,d)=>s+annualIncome(d),0);
  const totalMonthly=totalAnnual/12;

  // Build 12-month payment calendar
  const today=new Date();
  const calMonths=Array.from({length:12},(_,i)=>{
    const d=new Date(today.getFullYear(),today.getMonth()+i,1);
    return{year:d.getFullYear(),month:d.getMonth(),label:MONTHS[d.getMonth()]+" "+d.getFullYear().toString().slice(2)};
  });

  const paymentsInMonth=(year,month)=>divs.filter(d=>{
    if(!d.nextPayDate)return false;
    const next=new Date(d.nextPayDate);
    const freq=FREQS[d.frequency]||4;
    const monthsApart=(year-next.getFullYear())*12+(month-next.getMonth());
    if(monthsApart<0)return false;
    const cycleMonths=12/freq;
    return monthsApart%cycleMonths===0;
  });

  const addDiv=()=>{
    if(!form.ticker||!form.amountPerShare)return;
    const h=allHoldings.find(h=>h.ticker===form.ticker.toUpperCase());
    setDivs(ds=>[...ds,{...form,ticker:form.ticker.toUpperCase(),id:Date.now(),shares:h?.shares||0}]);
    setForm({ticker:"",name:"",amountPerShare:"",frequency:"quarterly",nextPayDate:"",franking:"100"});
    setShowAdd(false);
  };

  const portfolioValue=(holdings||[]).reduce((s,h)=>{
    const p=portfolio?.prices?.[h.ticker]?.price;
    return s+(p?p*h.shares:0);
  },0);
  const yieldPct=portfolioValue>0?((totalAnnual/portfolioValue)*100).toFixed(2):null;

  return(
    <div data-page="true" style={{maxWidth:680,margin:"0 auto"}}>
      <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Income Investing</div>
      <div style={{fontSize:26,color:t.TEXT,marginBottom:20}}>Dividend Tracker</div>

      {/* Summary */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,minmax(0,1fr))",gap:10,marginBottom:14}}>
        {[
          {l:"Annual Income",v:fmt(totalAnnual),c:t.GREEN},
          {l:"Monthly Income",v:fmt(Math.round(totalMonthly)),c:t.GOLD},
          {l:"Portfolio Yield",v:yieldPct?yieldPct+"%":"—",c:t.BLUE},
        ].map(s=>(
          <Card key={s.l} style={{textAlign:"center",padding:"12px 8px"}}>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:4,letterSpacing:1}}>{s.l.toUpperCase()}</div>
            <div style={{fontSize:16,color:s.c,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{s.v}</div>
          </Card>
        ))}
      </div>

      {/* Payment Calendar */}
      {divs.length>0&&(
        <Card style={{marginBottom:14}}>
          <SectionLabel>Payment Calendar</SectionLabel>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(4,minmax(0,1fr))",gap:6}}>
            {calMonths.map(({year,month,label})=>{
              const payments=paymentsInMonth(year,month);
              const monthTotal=payments.reduce((s,d)=>s+annualIncome(d)/(FREQS[d.frequency]||4),0);
              const isThisMonth=year===today.getFullYear()&&month===today.getMonth();
              return(
                <div key={label} style={{background:payments.length>0?t.GREEN+"14":t.CARD2,border:"1px solid "+(isThisMonth?t.GOLD:payments.length>0?t.GREEN+"44":t.BORDER),borderRadius:7,padding:"8px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:isThisMonth?t.GOLD:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3,fontWeight:isThisMonth?600:400}}>{label}</div>
                  {payments.length>0?(
                    <>
                      <div style={{fontSize:12,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{fmt(Math.round(monthTotal))}</div>
                      <div style={{fontSize:8,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{payments.map(p=>p.ticker).join(", ")}</div>
                    </>
                  ):(
                    <div style={{fontSize:9,color:t.BORDER,fontFamily:"'Montserrat',sans-serif"}}>—</div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Holdings */}
      <Card style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <SectionLabel>Dividend Holdings</SectionLabel>
          <Btn onClick={()=>setShowAdd(s=>!s)} style={{fontSize:10,padding:"5px 10px"}}>+ Add</Btn>
        </div>

        {showAdd&&(
          <div style={{background:t.CARD2,borderRadius:9,padding:14,marginBottom:14,border:"1px solid "+t.GOLD+"33"}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginBottom:8}}>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Ticker</div>
                <div style={{position:"relative"}}>
                  <Inp value={form.ticker} onChange={e=>setForm(f=>({...f,ticker:e.target.value.toUpperCase()}))} placeholder="e.g. CBA.AX"/>
                  {form.ticker.length>0&&allHoldings.filter(h=>h.ticker.startsWith(form.ticker)).length>0&&(
                    <div style={{position:"absolute",top:"100%",left:0,right:0,background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:7,zIndex:10,overflow:"hidden"}}>
                      {allHoldings.filter(h=>h.ticker.startsWith(form.ticker)).slice(0,4).map(h=>(
                        <div key={h.ticker} onClick={()=>setForm(f=>({...f,ticker:h.ticker,name:h.name}))}
                          style={{padding:"8px 10px",cursor:"pointer",fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}
                          onMouseEnter={e=>e.currentTarget.style.background=t.GOLD+"14"}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          {h.ticker} — {h.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Amount per share ($)</div>
                <Inp type="number" value={form.amountPerShare} onChange={e=>setForm(f=>({...f,amountPerShare:e.target.value}))} placeholder="0.00"/>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,minmax(0,1fr))",gap:8,marginBottom:12}}>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Frequency</div>
                <Sel value={form.frequency} onChange={e=>setForm(f=>({...f,frequency:e.target.value}))}>
                  {Object.keys(FREQS).map(f=><option key={f} value={f}>{f.charAt(0).toUpperCase()+f.slice(1)}</option>)}
                </Sel>
              </div>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Next pay date</div>
                <Inp type="date" value={form.nextPayDate} onChange={e=>setForm(f=>({...f,nextPayDate:e.target.value}))}/>
              </div>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Franking %</div>
                <Inp type="number" value={form.franking} onChange={e=>setForm(f=>({...f,franking:e.target.value}))} placeholder="100"/>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={addDiv} disabled={!form.ticker||!form.amountPerShare}>Add Dividend</Btn>
              <button onClick={()=>setShowAdd(false)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>Cancel</button>
            </div>
          </div>
        )}

        {divs.length===0&&!showAdd&&(
          <div style={{textAlign:"center",padding:"24px 0",color:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontSize:12}}>
            <div style={{fontSize:32,marginBottom:8}}>💰</div>
            Add your dividend-paying stocks to track income and see a payment calendar
          </div>
        )}

        {divs.map((d,i)=>{
          const shares=(holdings||[]).find(h=>h.ticker===d.ticker)?.shares||d.shares||0;
          const annual=annualIncome(d);
          const perPayment=annual/(FREQS[d.frequency]||4);
          return(
            <div key={d.id}>
              {i>0&&<Divider/>}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <Tag>{d.ticker}</Tag>
                    {d.name&&<span style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{d.name}</span>}
                    {d.franking&&<span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",background:t.CARD2,padding:"1px 5px",borderRadius:4}}>{d.franking}% franked</span>}
                  </div>
                  <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>${d.amountPerShare}/share · {d.frequency} · {shares} shares{d.nextPayDate?" · Next: "+fmtDateNum(d.nextPayDate):""}</div>
                </div>
                <div style={{textAlign:"right",marginLeft:12}}>
                  <div style={{fontSize:14,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{fmt(Math.round(annual))}<span style={{fontSize:9,color:t.MUTED,fontWeight:400}}>/yr</span></div>
                  <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{fmt(Math.round(perPayment))} per payment</div>
                </div>
                <button onClick={()=>setDivs(ds=>ds.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:12,marginLeft:10,opacity:.5}}>✕</button>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function TaxPage({profile,transactions,deductions,setDeductions}){
  const t=T();
  const isMobile=useIsMobile();
  const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({description:"",amount:"",category:"Work from Home",date:todayStr(),receipt:false});
  const safeProfile=profile||{};
  const income=parseFloat(safeProfile.annualIncome)||0;
  const fyYear=new Date().getMonth()>=6?new Date().getFullYear()+1:new Date().getFullYear();

  // AU tax brackets, FY2026-27 (from 1 July 2026) - second bracket reduced to 15%.
  // Legislated to reduce again to 14% from 1 July 2027 - revisit then.
  const calcTax=inc=>{
    if(inc<=18200)return 0;
    if(inc<=45000)return (inc-18200)*0.15;
    if(inc<=135000)return 4020+(inc-45000)*0.30;
    if(inc<=190000)return 31020+(inc-135000)*0.37;
    return 51370+(inc-190000)*0.45;
  };
  const medicareLevy=inc=>inc>26000?inc*0.02:0;

  const totalDeductions=deductions.reduce((s,d)=>s+parseFloat(d.amount||0),0);
  const taxableIncome=Math.max(0,income-totalDeductions);
  const taxWithout=calcTax(income)+medicareLevy(income);
  const taxWith=calcTax(taxableIncome)+medicareLevy(taxableIncome);
  const taxSaving=taxWithout-taxWith;
  const effectiveRate=income>0?Math.round(taxWith/income*100):0;

  const CATS=["Work from Home","Vehicle & Travel","Education & Training","Tools & Equipment","Clothing & Laundry","Phone & Internet","Investment Expenses","Donations","Other"];
  const CAT_ICONS={"Work from Home":"🏠","Vehicle & Travel":"🚗","Education & Training":"🎓","Tools & Equipment":"🔧","Clothing & Laundry":"👔","Phone & Internet":"📱","Investment Expenses":"📈","Donations":"❤️","Other":"📋"};

  const byCategory=CATS.map(cat=>({
    cat,
    icon:CAT_ICONS[cat],
    total:deductions.filter(d=>d.category===cat).reduce((s,d)=>s+parseFloat(d.amount||0),0),
    count:deductions.filter(d=>d.category===cat).length
  })).filter(c=>c.total>0);

  const addDeduction=()=>{
    if(!form.description||!form.amount)return;
    setDeductions(ds=>[...ds,{...form,id:Date.now(),amount:parseFloat(form.amount)}]);
    setForm({description:"",amount:"",category:"Work from Home",date:todayStr(),receipt:false});
    setShowAdd(false);
  };

  return(
    <div data-page="true" style={{maxWidth:680,margin:"0 auto"}}>
      <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Financial Planning</div>
      <div style={{fontSize:26,color:t.TEXT,marginBottom:4}}>Tax Planner</div>
      <div style={{fontSize:12,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:20}}>FY{fyYear-1}/{String(fyYear).slice(2)} · Australian Tax Brackets</div>

      {/* Summary cards */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,minmax(0,1fr))",gap:10,marginBottom:14}}>
        {[
          {l:"Gross Income",v:fmt(income),c:t.TEXT},
          {l:"Total Deductions",v:"-"+fmt(totalDeductions),c:totalDeductions>0?t.GREEN:t.MUTED},
          {l:"Taxable Income",v:fmt(taxableIncome),c:t.GOLD},
        ].map(s=>(
          <Card key={s.l} style={{textAlign:"center",padding:"12px 8px"}}>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:4,letterSpacing:1}}>{s.l.toUpperCase()}</div>
            <div style={{fontSize:15,color:s.c,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{s.v}</div>
          </Card>
        ))}
      </div>

      {/* Tax estimate - Australia only. Non-AU users still get the
          summary cards above and the deduction/receipt tracker below,
          just not an AU-specific bracket estimate. */}
      {(LOCALES[safeProfile.locale||"en-AU"]?.taxPage)&&(
      <Card style={{marginBottom:14}}>
        <SectionLabel>Estimated Tax</SectionLabel>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,minmax(0,1fr))",gap:12,marginBottom:12}}>
          {[
            {l:"Est. Tax Payable",v:fmt(Math.round(taxWith)),c:t.RED},
            {l:"Tax Saved",v:totalDeductions>0?fmt(Math.round(taxSaving)):"—",c:t.GREEN},
            {l:"Effective Rate",v:effectiveRate+"%",c:t.MUTED},
          ].map(s=>(
            <div key={s.l} style={{textAlign:"center",background:t.CARD2,borderRadius:8,padding:"10px 8px"}}>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:4}}>{s.l}</div>
              <div style={{fontSize:16,color:s.c,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{s.v}</div>
            </div>
          ))}
        </div>
        {/* Tax bracket visualisation */}
        <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>2026–27 Brackets</div>
        {[
          {l:"Tax free",min:0,max:18200,rate:"0%",c:"#888"},
          {l:"15c",min:18201,max:45000,rate:"15%",c:"#7EB8C9"},
          {l:"30c",min:45001,max:135000,rate:"30%",c:t.GOLD},
          {l:"37c",min:135001,max:190000,rate:"37%",c:"#C9844C"},
          {l:"45c",min:190001,max:999999,rate:"45%",c:t.RED},
        ].map(b=>{
          const inBracket=taxableIncome>b.min;
          const rangeLabel=b.max<999999?fmt(b.min)+" – "+fmt(b.max):fmt(b.min)+"+";
          return(
            <div key={b.rate} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
              <div style={{width:7,height:7,borderRadius:2,background:b.c,flexShrink:0,opacity:inBracket?1:.3}}/>
              <div style={{fontSize:10,color:inBracket?t.TEXT:t.MUTED,fontFamily:"'Montserrat',sans-serif",width:40}}>{b.rate}</div>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",flex:1}}>{rangeLabel}</div>
              {inBracket&&<div style={{fontSize:9,color:b.c,fontFamily:"'Montserrat',sans-serif"}}>✓</div>}
            </div>
          );
        })}
        <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:8,fontStyle:"italic"}}>Includes 2% Medicare Levy. Estimate only — consult your accountant.</div>
      </Card>
      )}

      {/* Deductions */}
      <Card style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <SectionLabel>Deductions</SectionLabel>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:11,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{deductions.length} items · {fmt(totalDeductions)}</span>
            <Btn onClick={()=>setShowAdd(s=>!s)} style={{fontSize:10,padding:"5px 10px"}}>+ Add</Btn>
          </div>
        </div>

        {showAdd&&(
          <div style={{background:t.CARD2,borderRadius:9,padding:14,marginBottom:14,border:"1px solid "+t.GOLD+"33"}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginBottom:8}}>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Description</div>
                <Inp value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="e.g. Home office equipment"/>
              </div>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Amount ($)</div>
                <Inp type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0.00"/>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginBottom:12}}>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Category</div>
                <Sel value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                  {CATS.map(c=><option key={c} value={c}>{c}</option>)}
                </Sel>
              </div>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Date</div>
                <Inp type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
              </div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <Btn onClick={addDeduction} disabled={!form.description||!form.amount}>Add Deduction</Btn>
              <label style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",cursor:"pointer"}}>
                <input type="checkbox" checked={form.receipt} onChange={e=>setForm(f=>({...f,receipt:e.target.checked}))} style={{accentColor:t.GOLD}}/>
                Receipt saved
              </label>
              <button onClick={()=>setShowAdd(false)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,marginLeft:"auto"}}>Cancel</button>
            </div>
          </div>
        )}

        {/* Category summary */}
        {byCategory.length>0&&(
          <div style={{marginBottom:12}}>
            {byCategory.map(c=>(
              <div key={c.cat} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid "+t.BORDER}}>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <span style={{fontSize:14}}>{c.icon}</span>
                  <span style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{c.cat}</span>
                  <span style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>({c.count})</span>
                </div>
                <span style={{fontSize:12,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{fmt(c.total)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Individual deductions */}
        {deductions.length===0&&!showAdd&&(
          <div style={{textAlign:"center",padding:"20px 0",color:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontSize:12}}>
            No deductions added yet — tap + Add to start tracking
          </div>
        )}
        {deductions.map((d,i)=>(
          <div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid "+t.BORDER}}>
            <div style={{flex:1}}>
              <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{d.description}</div>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>{d.category+" · "+fmtDateNum(d.date)+(d.receipt?" · 🧾":"")} </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:13,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{fmt(parseFloat(d.amount))}</span>
              <button onClick={()=>setDeductions(ds=>ds.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:12,opacity:.5}}>✕</button>
            </div>
          </div>
        ))}
      </Card>

      {/* Tips */}
      <Card style={{marginBottom:14}}>
        <SectionLabel>Common Deductions Checklist</SectionLabel>
        {[
          {l:"Work from home expenses",d:"$0.67/hr or actual costs"},
          {l:"Vehicle use for work",d:"Logbook or cents-per-km method"},
          {l:"Self-education related to current job",d:"Courses, textbooks, seminars"},
          {l:"Tools & equipment under $300",d:"Immediate deduction"},
          {l:"Professional memberships & subscriptions",d:"Industry associations"},
          {l:"Income protection insurance",d:"Premiums outside of super"},
          {l:"Investment property expenses",d:"Interest, rates, repairs, depreciation"},
          {l:"Charitable donations over $2",d:"To DGR-registered organisations"},
        ].map((tip,i)=>(
          <div key={i} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:i<7?"1px solid "+t.BORDER:"none"}}>
            <span style={{fontSize:12,color:t.GOLD,flexShrink:0}}>→</span>
            <div>
              <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{tip.l}</div>
              <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{tip.d}</div>
            </div>
          </div>
        ))}
        <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:10,fontStyle:"italic"}}>Always consult a registered tax agent. This is a planning tool only.</div>
      </Card>
    </div>
  );
}

function LearnPage({profile,goals,habits,learnData,setLearnData}){
  const t=T();
  const isMobile=useIsMobile();
  const[tab,setTab]=useState("discover");
  const[recs,setRecs]=useState([]);
  const[loading,setLoading]=useState(false);
  const[filter,setFilter]=useState("all");
  const[showLog,setShowLog]=useState(false);
  const[logForm,setLogForm]=useState({title:"",type:"podcast",minutes:30,date:todayStr()});
  const[showGoalEdit,setShowGoalEdit]=useState(false);
  const[weeklyGoal,setWeeklyGoal]=useState((learnData||{}).weeklyGoal||5);
  const[dailyPrompt]=useState(()=>{
    const prompts=[
      "What's one financial concept I could learn this week that would compound my returns?",
      "What habit or system could I study today that the top 1% use?",
      "What would I learn if I had to double my income in 12 months?",
      "What's the one book that would most change how I think about wealth?",
      "What do the best investors know that I don't yet?",
      "If I could spend 1 hour learning anything today, what would move the needle most?",
      "What skill, if mastered, would make everything else easier?",
    ];
    return prompts[new Date().getDay()%prompts.length];
  });



  const library=(learnData||{}).library||[];
  const sessions=(learnData||{}).sessions||[];
  const inProgress=library.filter(r=>r.status==="inprogress");
  const saved=library.filter(r=>r.status==="saved");
  const completed=library.filter(r=>r.status==="completed");

  const updateLib=(title,changes)=>setLearnData(d=>({...d,library:(d.library||[]).map(r=>r.title===title?{...r,...changes}:r)}));
  const addToLib=(r,status)=>setLearnData(d=>{
    const exists=(d.library||[]).some(x=>x.title===r.title);
    if(exists)return{...d,library:(d.library||[]).map(x=>x.title===r.title?{...x,status}:x)};
    return{...d,library:[...(d.library||[]),{...r,status,addedAt:todayStr(),progress:0}]};
  });
  const removeFromLib=title=>setLearnData(d=>({...d,library:(d.library||[]).filter(r=>r.title!==title)}));

  const logSession=()=>{
    if(!logForm.title||!logForm.minutes)return;
    const session={...logForm,id:Date.now(),minutes:parseInt(logForm.minutes)||30};
    setLearnData(d=>({...d,sessions:[session,...(d.sessions||[])]}));
    setLogForm({title:"",type:"podcast",minutes:30,date:todayStr()});
    setShowLog(false);
  };

  // Weekly hours
  const weekStart=new Date();weekStart.setDate(weekStart.getDate()-weekStart.getDay());
  const weekKey=weekStart.getFullYear()+"-"+String(weekStart.getMonth()+1).padStart(2,"0")+"-"+String(weekStart.getDate()).padStart(2,"0");
  const weekMins=sessions.filter(s=>s.date>=weekKey).reduce((s,x)=>s+x.minutes,0);
  const weekHrs=(weekMins/60).toFixed(1);
  const weekPct=Math.min(Math.round(weekMins/60/weeklyGoal*100),100);

  // 8-week history
  const weeklyHistory=Array.from({length:8}).map((_,i)=>{
    const d=new Date();d.setDate(d.getDate()-d.getDay()-(7-i)*7);
    const wk=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    const nextWk=new Date(d);nextWk.setDate(nextWk.getDate()+7);
    const nk=nextWk.getFullYear()+"-"+String(nextWk.getMonth()+1).padStart(2,"0")+"-"+String(nextWk.getDate()).padStart(2,"0");
    const mins=sessions.filter(s=>s.date>=wk&&s.date<nk).reduce((s,x)=>s+x.minutes,0);
    return{label:d.toLocaleString("default",{month:"short"}),mins,hrs:mins/60};
  });
  const maxHrs=Math.max(...weeklyHistory.map(w=>w.hrs),weeklyGoal,1);

  // Streak
  let streak=0;
  for(let i=0;i<30;i++){
    const d=new Date();d.setDate(d.getDate()-i);
    const dk=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    if(sessions.some(s=>s.date===dk))streak++;
    else if(i>0)break;
  }

  const totalHrs=(sessions.reduce((s,x)=>s+x.minutes,0)/60).toFixed(1);

  const getRecommendations=async()=>{
    setLoading(true);setRecs([]);
    const goalStr=(goals||[]).map(g=>g.title).join(", ")||"self improvement";
    const habitStr=(habits||[]).map(h=>h.name).join(", ")||"healthy habits";
    try{
      const r=await claudeFetch({
        model:"claude-haiku-4-5",max_tokens:2500,
        system:"Personal development expert. Return ONLY valid JSON array, no markdown, no backticks.",
        messages:[{role:"user",content:"Recommend 8 real, specific resources for someone with goals: "+goalStr+". Habits: "+habitStr+". Mix: 2 podcasts, 2 books, 2 YouTube channels, 2 courses. Return JSON array, each: {title, type (podcast/book/youtube/course), creator, description (why it fits their specific goals, 1-2 sentences), category, searchUrl (direct search URL for Spotify/Audible/YouTube/Coursera)}. Use real titles that exist."}]
      });
      const d=await r.json();
      const text=(d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("");
      const start=text.indexOf("["),end=text.lastIndexOf("]");
      if(start>-1&&end>-1)setRecs(JSON.parse(text.slice(start,end+1)));
    }catch(e){console.error(e);}
    setLoading(false);
  };

  const shown=filter==="all"?recs:recs.filter(r=>r.type===filter);



  return (
    <div data-page="true" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Personal Development</div>
          <div style={{fontSize:26,color:t.TEXT}}>Learn</div>
        </div>
        <button onClick={()=>setShowLog(s=>!s)} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:7,padding:"8px 14px",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:600}}>+ Log Session</button>
      </div>

      {/* Log session form */}
      {showLog&&(
        <Card style={{marginBottom:14,borderColor:t.GOLD+"44"}}>
          <SectionLabel>Log Learning Session</SectionLabel>
          <div style={{display:"flex",flexDirection:"column",gap:9}}>
            <Inp value={logForm.title} onChange={e=>setLogForm(f=>({...f,title:e.target.value}))} placeholder="What did you learn? (podcast, book, video...)"/>
            <div style={{display:"flex",gap:8}}>
              <Sel value={logForm.type} onChange={e=>setLogForm(f=>({...f,type:e.target.value}))} style={{flex:1}}>
                {["podcast","book","youtube","course","article"].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </Sel>
              <Inp type="number" value={logForm.minutes} onChange={e=>setLogForm(f=>({...f,minutes:e.target.value}))} placeholder="Minutes" style={{flex:1}}/>
              <Inp type="date" value={logForm.date} onChange={e=>setLogForm(f=>({...f,date:e.target.value}))} style={{flex:1}}/>
            </div>
            <div style={{display:"flex",gap:8}}><Btn onClick={logSession}>Save</Btn><Btn onClick={()=>setShowLog(false)} variant="ghost">Cancel</Btn></div>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {[["discover","Discover"],["library","My Library"],["progress","Progress"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"9px",borderRadius:8,border:"1px solid "+(tab===id?t.GOLD:t.BORDER),background:tab===id?t.GOLD+"18":"transparent",color:tab===id?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>{label}</button>
        ))}
      </div>

      {/* ── DISCOVER ── */}
      {tab==="discover"&&(
        <div>
          {/* Daily prompt */}
          <div style={{background:t.GOLD+"08",border:"1px solid "+t.GOLD+"22",borderRadius:9,padding:"12px 14px",marginBottom:14}}>
            <div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:2,marginBottom:5}}>Today's Learning Prompt</div>
            <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",lineHeight:1.7,fontStyle:"italic"}}>"{dailyPrompt}"</div>
          </div>

          {/* Filter pills */}
          {recs.length>0&&(
            <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:12,scrollbarWidth:"none"}}>
              {[{id:"all",l:"All"},{id:"podcast",l:"Podcasts"},{id:"book",l:"Books"},{id:"youtube",l:"YouTube"},{id:"course",l:"Courses"}].map(f=>(
                <button key={f.id} onClick={()=>setFilter(f.id)} style={{flexShrink:0,padding:"4px 12px",borderRadius:14,border:"1px solid "+(filter===f.id?t.GOLD:t.BORDER),background:filter===f.id?t.GOLD+"18":"transparent",color:filter===f.id?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>{f.l}</button>
              ))}
            </div>
          )}

          {/* Recs */}
          {loading&&<div style={{display:"flex",flexDirection:"column",gap:10}}>{[1,2,3].map(i=><Card key={i}><Skeleton height={14} width="60%" style={{marginBottom:8}}/><Skeleton height={10} width="40%"/></Card>)}</div>}

          {shown.length>0&&(
            <Card style={{marginBottom:14}}>
              <SectionLabel>Recommended for You</SectionLabel>
              {shown.map((r,i)=>(
                <div key={i}>
                  {i>0&&<Divider/>}
                  <RecCard r={r} actions={[
                    <button key="open" onClick={()=>window.open((TYPE_LINKS[r.type]||"https://www.google.com/search?q=")+encodeURIComponent(r.title+" "+r.creator),"_blank")} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"33",borderRadius:5,padding:"4px 9px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>
                      {r.type==="podcast"?"Spotify":r.type==="book"?"Audible":r.type==="youtube"?"YouTube":"Coursera"}
                    </button>,
                    <button key="save" onClick={()=>addToLib(r,library.some(x=>x.title===r.title)?"saved":"saved")} style={{background:library.some(x=>x.title===r.title)?t.GREEN+"18":"transparent",border:"1px solid "+(library.some(x=>x.title===r.title)?t.GREEN:t.BORDER),borderRadius:5,padding:"4px 9px",color:library.some(x=>x.title===r.title)?t.GREEN:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>
                      {library.some(x=>x.title===r.title)?"Saved":"+ Save"}
                    </button>,
                    <button key="start" onClick={()=>addToLib(r,"inprogress")} style={{background:t.BLUE+"14",border:"1px solid "+t.BLUE+"33",borderRadius:5,padding:"4px 9px",color:t.BLUE,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Start</button>,
                  ]}/>
                </div>
              ))}
            </Card>
          )}

          <button onClick={getRecommendations} disabled={loading} style={{width:"100%",background:loading?t.BORDER:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:9,padding:"13px",color:loading?t.MUTED:"#080808",cursor:loading?"default":"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,letterSpacing:1}}>
            {loading?"Finding recommendations...":recs.length?"Refresh Recommendations":"Get Personalised Recommendations"}
          </button>
        </div>
      )}

      {/* ── LIBRARY ── */}
      {tab==="library"&&(
        <div>
          {/* In progress */}
          {inProgress.length>0&&(
            <div style={{marginBottom:16}}>
              <div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>In Progress</div>
              {inProgress.map((r,i)=>(
                <Card key={i} style={{marginBottom:8,borderLeft:"3px solid "+(TYPE_COLORS[r.type]||t.GOLD)}}>
                  <RecCard r={r} actions={[
                    <button key="done" onClick={()=>updateLib(r.title,{status:"completed",completedAt:todayStr()})} style={{background:t.GREEN+"18",border:"1px solid "+t.GREEN+"33",borderRadius:5,padding:"4px 9px",color:t.GREEN,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Mark Done</button>,
                    <button key="open" onClick={()=>window.open((TYPE_LINKS[r.type]||"https://www.google.com/search?q=")+encodeURIComponent(r.title),"_blank")} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"33",borderRadius:5,padding:"4px 9px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Open</button>,
                    <button key="rm" onClick={()=>removeFromLib(r.title)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,opacity:.5}}>Remove</button>,
                  ]}/>
                </Card>
              ))}
            </div>
          )}

          {/* Saved */}
          {saved.length>0&&(
            <div style={{marginBottom:16}}>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>Saved</div>
              <Card>
                {saved.map((r,i)=>(
                  <div key={i}>
                    {i>0&&<Divider/>}
                    <RecCard r={r} actions={[
                      <button key="start" onClick={()=>updateLib(r.title,{status:"inprogress"})} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"33",borderRadius:5,padding:"4px 9px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Start</button>,
                      <button key="rm" onClick={()=>removeFromLib(r.title)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,opacity:.5}}>Remove</button>,
                    ]}/>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {/* Completed */}
          {completed.length>0&&(
            <div style={{marginBottom:16}}>
              <div style={{fontSize:9,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>Completed</div>
              <Card>
                {completed.map((r,i)=>(
                  <div key={i}>
                    {i>0&&<Divider/>}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0"}}>
                      <div>
                        <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:500}}>{r.title}</div>
                        <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>{r.type+" - Completed "+(r.completedAt||"")}</div>
                      </div>
                      <div style={{fontSize:16,color:t.GREEN}}>V</div>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {library.length===0&&(
            <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
              <div style={{fontSize:28,marginBottom:10}}>B</div>
              <div style={{fontSize:13,marginBottom:8}}>Your library is empty</div>
              <div style={{fontSize:11,marginBottom:16}}>Go to Discover and save recommendations to build your library</div>
              <Btn onClick={()=>setTab("discover")}>Go to Discover</Btn>
            </div>
          )}
        </div>
      )}

      {/* ── PROGRESS ── */}
      {tab==="progress"&&(
        <div>
          {/* Stats */}
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(4,minmax(0,1fr))",gap:10,marginBottom:14}}>
            {[
              {v:weekHrs+"h",l:"This week",c:t.GOLD},
              {v:streak+"d",l:"Streak",c:t.GREEN},
              {v:completed.length,l:"Completed",c:"#7EB8C9"},
              {v:totalHrs+"h",l:"Total",c:"#B07EC9"},
            ].map(s=>(
              <Card key={s.l} style={{textAlign:"center",padding:"12px 6px"}}>
                <div style={{fontSize:22,color:s.c,fontWeight:700,marginBottom:2}}>{s.v}</div>
                <div style={{fontSize:8,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1}}>{s.l}</div>
              </Card>
            ))}
          </div>

          {/* Weekly goal ring */}
          <Card style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <SectionLabel>Weekly Goal</SectionLabel>
              <button onClick={()=>setShowGoalEdit(s=>!s)} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:5,padding:"3px 9px",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Edit</button>
            </div>
            {showGoalEdit&&(
              <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center"}}>
                <input type="range" min={1} max={20} value={weeklyGoal} onChange={e=>setWeeklyGoal(Number(e.target.value))} style={{flex:1,accentColor:t.GOLD}}/>
                <div style={{fontSize:14,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:700,minWidth:60}}>{weeklyGoal+" hrs"}</div>
                <Btn onClick={()=>{setLearnData(d=>({...d,weeklyGoal}));setShowGoalEdit(false);}} style={{fontSize:11}}>Save</Btn>
              </div>
            )}
            <div style={{display:"flex",alignItems:"center",gap:16}}>
              <div style={{position:"relative",width:80,height:80,flexShrink:0}}>
                <svg width="80" height="80" viewBox="0 0 80 80" style={{transform:"rotate(-90deg)"}}>
                  <circle cx="40" cy="40" r="32" fill="none" stroke={t.BORDER} strokeWidth="7"/>
                  <circle cx="40" cy="40" r="32" fill="none" stroke={weekPct>=100?t.GREEN:t.GOLD} strokeWidth="7"
                    strokeDasharray={2*Math.PI*32*weekPct/100+" "+(2*Math.PI*32*(1-weekPct/100))} strokeLinecap="round"/>
                </svg>
                <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                  <div style={{fontSize:16,color:weekPct>=100?t.GREEN:t.GOLD,fontWeight:700}}>{weekPct+"%"}</div>
                </div>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:24,color:weekPct>=100?t.GREEN:t.GOLD,fontWeight:700,marginBottom:2}}>
                  {weekHrs}<span style={{fontSize:12,color:t.MUTED}}>{" / "+weeklyGoal+" hrs"}</span>
                </div>
                <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{weekPct>=100?"Goal achieved this week!":((weeklyGoal-weekHrs).toFixed(1))+" hrs to reach your goal"}</div>
              </div>
            </div>
          </Card>

          {/* 8-week chart */}
          <Card style={{marginBottom:14}}>
            <SectionLabel>Last 8 Weeks</SectionLabel>
            <div style={{display:"flex",gap:4,alignItems:"flex-end",height:80}}>
              {weeklyHistory.map((w,i)=>(
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                  <div style={{width:"100%",background:i===7?t.GOLD:t.GOLD+"44",borderRadius:"3px 3px 0 0",height:Math.max(w.hrs/maxHrs*68,w.hrs>0?3:0)+"px",transition:"height .3s"}}/>
                  <div style={{fontSize:8,color:i===7?t.GOLD:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{w.label}</div>
                </div>
              ))}
            </div>
            {/* Target line annotation */}
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:8,textAlign:"right"}}>Goal: {weeklyGoal}h/week</div>
          </Card>

          {/* Recent sessions */}
          {sessions.length>0&&(
            <Card>
              <SectionLabel>Recent Sessions</SectionLabel>
              {sessions.slice(0,8).map((s,i)=>(
                <div key={s.id||i}>
                  {i>0&&<Divider/>}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0"}}>
                    <div>
                      <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{s.title}</div>
                      <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>{s.type+" - "+s.date}</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{fontSize:12,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{s.minutes>=60?Math.floor(s.minutes/60)+"h "+(s.minutes%60>0?s.minutes%60+"m":""):s.minutes+"m"}</div>
                      <button onClick={()=>setLearnData(d=>({...d,sessions:(d.sessions||[]).filter(x=>x.id!==s.id)}))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.4}}>X</button>
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {sessions.length===0&&(
            <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
              <div style={{fontSize:28,marginBottom:10}}>G</div>
              <div style={{fontSize:13,marginBottom:8}}>No sessions logged yet</div>
              <Btn onClick={()=>setShowLog(true)}>+ Log First Session</Btn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Notes Page ────────────────────────────────────────────────────────────────
function NotesPage({notes,setNotes}){
  const t=T();
  const[showAdd,setShowAdd]=useState(false);
  const[editing,setEditing]=useState(null);
  const[viewing,setViewing]=useState(null);
  const[filter,setFilter]=useState("all");
  const emptyForm={title:"",content:"",category:"General",pinned:false};
  const[form,setForm]=useState(emptyForm);
  const CATS=["General","Ideas","Gifts","Meeting Notes","Goals","Personal","Work","Other"];
  const CAT_COLORS_N={General:t.GOLD,Ideas:"#7EB8C9",Gifts:"#C97E7E",Meeting_Notes:"#7A9E7E","MeetingNotes":"#7A9E7E",Goals:"#B07EC9",Personal:"#D4956A",Work:"#7EB8C9",Other:t.MUTED};

  const save=()=>{
    if(!form.title.trim())return;
    if(editing){setNotes(ns=>ns.map(n=>n.id===editing?{...n,...form,updatedAt:todayStr()}:n));}
    else{setNotes(ns=>[{...form,id:Date.now(),createdAt:todayStr(),updatedAt:todayStr()},...ns]);}
    setForm(emptyForm);setShowAdd(false);setEditing(null);
  };

  const openEdit=n=>{setForm({title:n.title,content:n.content,category:n.category,pinned:n.pinned||false});setEditing(n.id);setShowAdd(true);};
  const pinned=notes.filter(n=>n.pinned);
  const shown=(filter==="all"?notes:notes.filter(n=>n.category===filter)).sort((a,b)=>(b.pinned||0)-(a.pinned||0));

  if(viewing){
    const n=notes.find(x=>x.id===viewing);
    return (
      <div data-page="true" style={{maxWidth:720,margin:"0 auto"}}>
        <div style={{display:"flex",gap:8,marginBottom:20,alignItems:"center"}}>
          <button onClick={()=>setViewing(null)} style={{background:"none",border:"none",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:13}}>Back</button>
          <div style={{flex:1}}/>
          <button onClick={()=>{openEdit(n);setViewing(null);}} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"33",borderRadius:6,padding:"5px 11px",color:t.GOLD,cursor:"pointer",fontSize:11,fontFamily:"'Montserrat',sans-serif"}}>Edit</button>
          <button onClick={()=>{setNotes(ns=>ns.filter(x=>x.id!==n.id));setViewing(null);}} style={{background:t.RED+"18",border:"1px solid "+t.RED+"33",borderRadius:6,padding:"5px 11px",color:t.RED,cursor:"pointer",fontSize:11,fontFamily:"'Montserrat',sans-serif"}}>Delete</button>
        </div>
        <Card>
          <div style={{fontSize:9,color:(CAT_COLORS_N[n.category]||CAT_COLORS_N[n.category.replace(" ","")]||t.GOLD),fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>{n.category}</div>
          <div style={{fontSize:22,color:t.TEXT,marginBottom:6}}>{n.title}</div>
          <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:16}}>{n.updatedAt}</div>
          <div style={{fontSize:14,color:t.TEXT,lineHeight:1.85,whiteSpace:"pre-wrap",fontFamily:"'Cormorant Garamond',Georgia,serif"}}>{n.content}</div>
        </Card>
      </div>
    );
  }

  return (
    <div data-page="true" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Private</div>
          <div style={{fontSize:26,color:t.TEXT}}>Notes</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:3}}>{notes.length+" note"+(notes.length!==1?"s":"")}</div>
        </div>
        <Btn onClick={()=>{setForm(emptyForm);setEditing(null);setShowAdd(s=>!s);}}>+ New Note</Btn>
      </div>

      {showAdd&&(
        <Card style={{marginBottom:14,borderColor:t.GOLD+"44"}}>
          <SectionLabel>{editing?"Edit Note":"New Note"}</SectionLabel>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Inp value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Title..."/>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <Sel value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{flex:1}}>
                {CATS.map(c=><option key={c}>{c}</option>)}
              </Sel>
              <label style={{display:"flex",alignItems:"center",gap:6,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontSize:12,cursor:"pointer",flexShrink:0}}>
                <input type="checkbox" checked={form.pinned} onChange={e=>setForm(f=>({...f,pinned:e.target.checked}))} style={{accentColor:t.GOLD}}/>Pin
              </label>
            </div>
            <textarea spellCheck={true} autoCorrect="on" autoCapitalize="sentences" value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} placeholder="Write anything..." rows={6} style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"10px 12px",color:t.TEXT,fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.8,boxSizing:"border-box"}}/>
            <div style={{display:"flex",gap:8}}><Btn onClick={save}>{editing?"Save":"Add"}</Btn><Btn onClick={()=>{setShowAdd(false);setEditing(null);}} variant="ghost">Cancel</Btn></div>
          </div>
        </Card>
      )}

      {/* Category filter */}
      <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:14,scrollbarWidth:"none"}}>
        {[{id:"all",label:"All"},...CATS.map(c=>({id:c,label:c}))].filter(c=>c.id==="all"||notes.some(n=>n.category===c.id)).map(c=>(
          <button key={c.id} onClick={()=>setFilter(c.id)} style={{flexShrink:0,padding:"4px 12px",borderRadius:14,border:"1px solid "+(filter===c.id?t.GOLD:t.BORDER),background:filter===c.id?t.GOLD+"22":"transparent",color:filter===c.id?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>{c.label}</button>
        ))}
      </div>

      {shown.length===0&&<div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}><div style={{fontSize:32,marginBottom:10}}>N</div><div style={{fontSize:14,marginBottom:8}}>No notes yet</div><div style={{fontSize:12}}>Tap + New Note to start capturing ideas</div></div>}

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
        {shown.map(n=>(
          <div key={n.id} onClick={()=>setViewing(n.id)} style={{background:t.CARD,border:"1px solid "+(n.pinned?t.GOLD:t.BORDER),borderRadius:10,padding:14,cursor:"pointer",borderTop:"3px solid "+(CAT_COLORS_N[n.category]||t.GOLD),transition:"border-color .2s"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div style={{fontSize:9,color:CAT_COLORS_N[n.category]||t.GOLD,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1}}>{n.category}{n.pinned&&" - Pinned"}</div>
            </div>
            <div style={{fontSize:13,color:t.TEXT,fontWeight:600,marginBottom:5,lineHeight:1.3}}>{n.title}</div>
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",lineHeight:1.6,overflow:"hidden",maxHeight:40}}>{n.content.slice(0,80)}{n.content.length>80?"...":""}</div>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:8}}>{n.updatedAt}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Services Page ─────────────────────────────────────────────────────────────
function ServicesPage({services,setServices}){
  const t=T();
  const[showAdd,setShowAdd]=useState(false);
  const[editing,setEditing]=useState(null);
  const[confirmDel,setConfirmDel]=useState(null);
  const emptyForm={name:"",role:"Financial Advisor",firm:"",phone:"",email:"",lastContact:"",nextFollow:"",notes:""};
  const[form,setForm]=useState(emptyForm);
  const ROLES=["Financial Advisor","Mortgage Broker","Accountant","Solicitor / Lawyer","Insurance Broker","Real Estate Agent","Business Coach","Mentor","Other"];
  const ROLE_COLORS={"Financial Advisor":"#C9A84C","Mortgage Broker":"#7EB8C9","Accountant":"#7A9E7E","Solicitor / Lawyer":"#B07EC9","Insurance Broker":"#D4956A","Business Coach":"#7EB8C9","Mentor":"#C9A84C","Real Estate Agent":"#7A9E7E",Other:t.MUTED};

  const save=()=>{
    if(!form.name.trim())return;
    if(editing){setServices(ss=>ss.map(s=>s.id===editing?{...s,...form}:s));}
    else{setServices(ss=>[...ss,{...form,id:Date.now(),addedAt:todayStr()}]);}
    setForm(emptyForm);setShowAdd(false);setEditing(null);
  };

  const openEdit=s=>{setForm({name:s.name,role:s.role,firm:s.firm||"",phone:s.phone||"",email:s.email||"",lastContact:s.lastContact||"",nextFollow:s.nextFollow||"",notes:s.notes||""});setEditing(s.id);setShowAdd(true);};

  const daysUntil=d=>{if(!d)return null;const diff=Math.round((new Date(d+"T12:00:00")-new Date())/864e5);return diff;};

  return (
    <div data-page="true" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Professional Network</div>
          <div style={{fontSize:26,color:t.TEXT}}>Services</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:3}}>Your advisors and service providers</div>
        </div>
        <Btn onClick={()=>{setForm(emptyForm);setEditing(null);setShowAdd(s=>!s);}}>+ Add</Btn>
      </div>

      {/* Follow-up alerts */}
      {services.filter(s=>s.nextFollow&&daysUntil(s.nextFollow)<=7&&daysUntil(s.nextFollow)>=0).map(s=>(
        <div key={s.id} style={{padding:"9px 13px",background:t.GOLD+"14",border:"1px solid "+t.GOLD+"33",borderRadius:7,display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:t.GOLD,flexShrink:0}}/>
          <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",flex:1}}>{"Follow up with "+s.name+" - "+daysUntil(s.nextFollow)+" day"+(daysUntil(s.nextFollow)!==1?"s":"")+" away"}</div>
        </div>
      ))}

      {showAdd&&(
        <Card style={{marginBottom:14,borderColor:t.GOLD+"44"}}>
          <SectionLabel>{editing?"Edit Contact":"New Contact"}</SectionLabel>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:2}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Name</div>
                <Inp value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="John Smith"/>
              </div>
              <div style={{flex:1.5}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Role</div>
                <Sel value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                  {ROLES.map(r=><option key={r}>{r}</option>)}
                </Sel>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Firm</div>
                <Inp value={form.firm} onChange={e=>setForm(f=>({...f,firm:e.target.value}))} placeholder="Firm name"/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Phone</div>
                <Inp value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="0400 000 000"/>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Email</div>
                <Inp value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="email@firm.com"/>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Last Contact</div>
                <Inp type="date" value={form.lastContact} onChange={e=>setForm(f=>({...f,lastContact:e.target.value}))}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Follow-up Date</div>
                <Inp type="date" value={form.nextFollow} onChange={e=>setForm(f=>({...f,nextFollow:e.target.value}))}/>
              </div>
            </div>
            <div>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Notes from last meeting</div>
              <textarea spellCheck={true} autoCorrect="on" autoCapitalize="sentences" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Key points, action items, advice given..." rows={3} style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"10px 12px",color:t.TEXT,fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:12,outline:"none",resize:"vertical",lineHeight:1.7,boxSizing:"border-box"}}/>
            </div>
            <div style={{display:"flex",gap:8}}><Btn onClick={save}>{editing?"Save":"Add"}</Btn><Btn onClick={()=>{setShowAdd(false);setEditing(null);}} variant="ghost">Cancel</Btn></div>
          </div>
        </Card>
      )}

      {ROLES.map(role=>{
        const group=services.filter(s=>s.role===role);
        if(!group.length)return null;
        const col=ROLE_COLORS[role]||t.GOLD;
        return (
          <div key={role} style={{marginBottom:16}}>
            <div style={{fontSize:9,color:col,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>{role}</div>
            {group.map(s=>{
              const followDays=daysUntil(s.nextFollow);
              return (
                <Card key={s.id} style={{marginBottom:8,borderLeft:"3px solid "+col}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:s.notes?8:0}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:15,color:t.TEXT,fontWeight:600,marginBottom:3}}>{s.name}</div>
                      {s.firm&&<div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:4}}>{s.firm}</div>}
                      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                        {s.phone&&<a href={"tel:"+s.phone} style={{fontSize:11,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",textDecoration:"none"}}>{s.phone}</a>}
                        {s.email&&<a href={"mailto:"+s.email} style={{fontSize:11,color:t.BLUE,fontFamily:"'Montserrat',sans-serif",textDecoration:"none"}}>{s.email}</a>}
                      </div>
                      {s.lastContact&&<div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:4}}>{"Last contact: "+s.lastContact}</div>}
                      {s.nextFollow&&<div style={{fontSize:10,color:followDays<=7?t.GOLD:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>{"Follow up: "+s.nextFollow+(followDays!==null?" ("+followDays+"d)":"")}</div>}
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:10}}>
                      <button onClick={()=>openEdit(s)} style={{background:t.GOLD+"14",border:"1px solid "+t.GOLD+"33",borderRadius:6,padding:"4px 9px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Edit</button>
                      {confirmDel===s.id?(
                        <div style={{display:"flex",gap:4,alignItems:"center"}}>
                          <button onClick={()=>{setServices(ss=>ss.filter(x=>x.id!==s.id));setConfirmDel(null);}} style={{background:t.RED+"22",border:"1px solid "+t.RED+"44",borderRadius:5,padding:"3px 7px",color:t.RED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Yes</button>
                          <button onClick={()=>setConfirmDel(null)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:5,padding:"3px 7px",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>No</button>
                        </div>
                      ):(
                        <button onClick={()=>setConfirmDel(s.id)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.5}}>X</button>
                      )}
                    </div>
                  </div>
                  {s.notes&&<div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",lineHeight:1.65,borderTop:"1px solid "+t.BORDER,paddingTop:8,fontStyle:"italic"}}>"{s.notes}"</div>}
                </Card>
              );
            })}
          </div>
        );
      })}

      {!services.length&&<div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}><div style={{fontSize:32,marginBottom:10}}>P</div><div style={{fontSize:14,marginBottom:8}}>No contacts yet</div><div style={{fontSize:12}}>Add your financial advisor, accountant, mortgage broker and other key contacts</div></div>}
    </div>
  );
}


function PaywallPage({onUpgrade,feature}){
  const t=T();
  const featureMap={
    advisor:{icon:"🤖",title:"AI Advisor",desc:"Your private advisor with full dashboard visibility, web search, and honest assessments."},
    invest:{icon:"📈",title:"Invest Intelligence",desc:"Live market prices, AI-powered opportunities, and a personalised watchlist."},
    tax:{icon:"🧾",title:"Tax Planner",desc:"Australian tax bracket estimator, deduction tracker and refund calculator."},
    learn:{icon:"🎓",title:"Learn",desc:"AI-curated education and courses tailored to your goals and career."},
    services:{icon:"👔",title:"Services",desc:"Professional service recommendations based on your financial profile."},
  };
  const ctx=feature&&featureMap[feature]?featureMap[feature]:null;
  const proFeatures=[
    "AI Advisor — full dashboard visibility + web search",
    "Morning Briefing with live market data",
    "Live stock, crypto & commodity prices",
    "AI goal suggestions & habit coaching",
    "AI workout plan generator",
    "AI supplement recommendations",
    "Weekly AI performance review",
    "Bank statement PDF import",
    "Invest intelligence & opportunities",
    "Tax planning — Australian brackets",
  ];
  return(
    <div style={{maxWidth:440,margin:"0 auto",padding:"40px 20px",textAlign:"center"}}>
      {ctx?(
        <>
          <div style={{fontSize:40,marginBottom:12}}>{ctx.icon}</div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:8}}>Executive Feature</div>
          <div style={{fontSize:22,color:t.TEXT,marginBottom:8}}>{ctx.title}</div>
          <div style={{fontSize:13,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:24,lineHeight:1.75}}>{ctx.desc}</div>
        </>
      ):(
        <>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:8}}>Executive Feature</div>
          <div style={{fontSize:22,color:t.TEXT,marginBottom:8}}>Unlock the full dashboard</div>
          <div style={{fontSize:13,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:24,lineHeight:1.75}}>This feature is part of The Executive plan. Join founders, investors and high performers who use it daily.</div>
        </>
      )}
      <div style={{background:t.GOLD+"0A",border:"1px solid "+t.GOLD+"33",borderRadius:12,padding:"16px",marginBottom:20,textAlign:"left"}}>
        <div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>What you unlock</div>
        {proFeatures.map((f,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:i<proFeatures.length-1?"1px solid "+t.BORDER+"44":"none"}}>
            <span style={{color:t.GOLD,fontSize:10,flexShrink:0}}>✦</span>
            <span style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{f}</span>
          </div>
        ))}
      </div>
      <button onClick={onUpgrade} style={{width:"100%",background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:10,padding:"14px",color:"#080808",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,letterSpacing:.5,marginBottom:10}}>
        Upgrade to The Executive →
      </button>
      <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>$14/month or $139/year · Cancel anytime · Free plan always available</div>
    </div>
  );
}


function UpgradeModal({onClose,onCheckout,onNativePurchase,onRestorePurchases,loading}){
  const t=T();
  const plans=[
    {id:"monthly",label:"Monthly",price:"$14",period:"/month",note:"Founding member price",priceId:STRIPE_PRICES.monthly,packageId:"$rc_monthly"},
    {id:"annual",label:"Annual",price:"$139",period:"/year",note:"Save $29 — 2 months free",priceId:STRIPE_PRICES.annual,packageId:"$rc_annual",popular:true},
  ];
  const FREE_FEATURES=["Tasks & habit tracking","Goals & checkpoints","Journal & reading list","Body & workout logging","Bills & cash flow tracker","Debt payoff calculator","Wealth snapshot","Basic market tickers"];
  const PRO_FEATURES=["Everything in Free","AI Advisor — full dashboard access","Morning / Evening Briefing","Live stock, crypto & commodity prices","AI goal & supplement suggestions","AI workout & recipe generator","Weekly AI performance review","Bank statement PDF import","Invest intelligence & market insights","Tax planning (Australian brackets)"];
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.92)",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:t.CARD,border:"1px solid "+t.GOLD+"44",borderRadius:16,maxWidth:520,width:"100%",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{padding:"24px 24px 20px"}}>
          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div>
              <div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",letterSpacing:3,textTransform:"uppercase",marginBottom:6}}>Choose Your Plan</div>
              <div style={{fontSize:24,color:t.TEXT}}>The Executive</div>
            </div>
            <button onClick={onClose} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:7,padding:"4px 10px",color:t.MUTED,cursor:"pointer",fontSize:12}}>✕</button>
          </div>
          <div style={{fontSize:12,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:20}}>Use the free version forever, or upgrade for AI-powered intelligence.</div>

          {/* Free vs Pro columns */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,marginBottom:20}}>
            {/* Free column */}
            <div style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:12,padding:"16px 14px"}}>
              <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Free</div>
              <div style={{fontSize:26,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:700,lineHeight:1,marginBottom:2}}>$0</div>
              <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:12}}>forever</div>
              <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:10}}>You're already on this.</div>
              {FREE_FEATURES.map((f,i)=>(
                <div key={i} style={{display:"flex",alignItems:"flex-start",gap:6,padding:"4px 0"}}>
                  <span style={{color:"#7A9E7E",fontSize:10,marginTop:1,flexShrink:0}}>✓</span>
                  <span style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",lineHeight:1.4}}>{f}</span>
                </div>
              ))}
            </div>

            {/* Executive column */}
            <div style={{background:t.GOLD+"12",border:"1px solid "+t.GOLD+"66",borderRadius:12,padding:"16px 14px",position:"relative"}}>
              <div style={{position:"absolute",top:-1,right:-1,background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",color:"#080808",fontSize:8,fontFamily:"'Montserrat',sans-serif",fontWeight:700,padding:"3px 10px",borderRadius:"0 11px 0 7px",letterSpacing:1}}>UPGRADE</div>
              <div style={{fontSize:10,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>The Executive</div>
              <div style={{fontSize:26,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:700,lineHeight:1,marginBottom:2}}>$14</div>
              <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:12}}>/month</div>
              {PRO_FEATURES.map((f,i)=>(
                <div key={i} style={{display:"flex",alignItems:"flex-start",gap:6,padding:"4px 0"}}>
                  <span style={{color:t.GOLD,fontSize:10,marginTop:1,flexShrink:0}}>✦</span>
                  <span style={{fontSize:11,color:i===0?t.GOLD:t.TEXT,fontFamily:"'Montserrat',sans-serif",lineHeight:1.4,fontWeight:i===0?600:400}}>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing buttons */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,marginBottom:12}}>
            {plans.map(p=>(
              <button key={p.id} onClick={()=>Capacitor.isNativePlatform()?onNativePurchase(p.packageId):onCheckout(p.priceId)} disabled={loading} style={{background:p.popular?"linear-gradient(135deg,"+t.GOLD+","+t.GL+")":t.CARD2,border:"1px solid "+(p.popular?t.GOLD:t.BORDER),borderRadius:9,padding:"12px",color:p.popular?"#080808":t.TEXT,cursor:loading?"default":"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,position:"relative"}}>
                {p.popular&&<div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",background:"#7A9E7E",color:"#fff",fontSize:8,fontFamily:"'Montserrat',sans-serif",fontWeight:700,padding:"2px 8px",borderRadius:10,whiteSpace:"nowrap"}}>BEST VALUE</div>}
                <div>{loading?"Loading...":(p.price+" "+p.period)}</div>
                <div style={{fontSize:9,color:p.popular?"#08080888":t.MUTED,marginTop:2}}>{p.note}</div>
              </button>
            ))}
          </div>
          <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textAlign:"center"}}>Cancel anytime · Founding member pricing locked in forever</div>
          {Capacitor.isNativePlatform()&&(
            <div style={{textAlign:"center",marginTop:10}}>
              <button onClick={onRestorePurchases} disabled={loading} style={{background:"none",border:"none",color:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontSize:11,textDecoration:"underline",cursor:loading?"default":"pointer"}}>Restore Purchases</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TickerSearch({marketTickers,setMarketTickers,DEFAULT_TICKERS,onSave,onReset}){
  const t=T();
  const[search,setSearch]=useState("");
  const TICKER_DB=[
    {symbol:"^GSPC",label:"S&P 500",cat:"Index"},{symbol:"^AXJO",label:"ASX 200",cat:"Index"},{symbol:"^IXIC",label:"Nasdaq",cat:"Index"},{symbol:"^DJI",label:"Dow Jones",cat:"Index"},{symbol:"^RUT",label:"Russell 2000",cat:"Index"},{symbol:"^FTSE",label:"FTSE 100",cat:"Index"},{symbol:"^N225",label:"Nikkei 225",cat:"Index"},{symbol:"^HSI",label:"Hang Seng",cat:"Index"},
    {symbol:"AUDUSD=X",label:"AUD/USD",cat:"Forex",fx:true},{symbol:"GBPUSD=X",label:"GBP/USD",cat:"Forex",fx:true},{symbol:"EURUSD=X",label:"EUR/USD",cat:"Forex",fx:true},{symbol:"USDJPY=X",label:"USD/JPY",cat:"Forex",fx:true},{symbol:"NZDUSD=X",label:"NZD/USD",cat:"Forex",fx:true},
    {symbol:"BTC-USD",label:"Bitcoin",cat:"Crypto"},{symbol:"ETH-USD",label:"Ethereum",cat:"Crypto"},{symbol:"SOL-USD",label:"Solana",cat:"Crypto"},{symbol:"XRP-USD",label:"XRP",cat:"Crypto"},{symbol:"DOGE-USD",label:"Dogecoin",cat:"Crypto"},{symbol:"BNB-USD",label:"BNB",cat:"Crypto"},
    {symbol:"AAPL",label:"Apple",cat:"US"},{symbol:"MSFT",label:"Microsoft",cat:"US"},{symbol:"NVDA",label:"Nvidia",cat:"US"},{symbol:"GOOGL",label:"Alphabet",cat:"US"},{symbol:"AMZN",label:"Amazon",cat:"US"},{symbol:"META",label:"Meta",cat:"US"},{symbol:"TSLA",label:"Tesla",cat:"US"},{symbol:"NFLX",label:"Netflix",cat:"US"},{symbol:"AMD",label:"AMD",cat:"US"},{symbol:"JPM",label:"JPMorgan",cat:"US"},{symbol:"SPY",label:"S&P 500 ETF",cat:"ETF"},{symbol:"QQQ",label:"Nasdaq ETF",cat:"ETF"},{symbol:"GLD",label:"Gold ETF",cat:"ETF"},
    {symbol:"CBA.AX",label:"Commonwealth Bank",cat:"ASX"},{symbol:"BHP.AX",label:"BHP Group",cat:"ASX"},{symbol:"CSL.AX",label:"CSL",cat:"ASX"},{symbol:"ANZ.AX",label:"ANZ Bank",cat:"ASX"},{symbol:"NAB.AX",label:"NAB",cat:"ASX"},{symbol:"WBC.AX",label:"Westpac",cat:"ASX"},{symbol:"WES.AX",label:"Wesfarmers",cat:"ASX"},{symbol:"MQG.AX",label:"Macquarie",cat:"ASX"},{symbol:"RIO.AX",label:"Rio Tinto",cat:"ASX"},{symbol:"WOW.AX",label:"Woolworths",cat:"ASX"},{symbol:"TLS.AX",label:"Telstra",cat:"ASX"},{symbol:"GMG.AX",label:"Goodman Group",cat:"ASX"},{symbol:"FMG.AX",label:"Fortescue",cat:"ASX"},{symbol:"XRO.AX",label:"Xero",cat:"ASX"},{symbol:"PME.AX",label:"Pro Medicus",cat:"ASX"},
    {symbol:"GC=F",label:"Gold",cat:"Commodity"},{symbol:"SI=F",label:"Silver",cat:"Commodity"},{symbol:"CL=F",label:"Crude Oil",cat:"Commodity"},{symbol:"NG=F",label:"Natural Gas",cat:"Commodity"},
  ];
  const current=marketTickers||DEFAULT_TICKERS;
  const isFull=current.length>=5;
  const q=search.toLowerCase();
  const suggestions=q.length>=1?TICKER_DB.filter(s=>
    !current.some(c=>c.symbol===s.symbol)&&(
      s.symbol.toLowerCase().startsWith(q)||s.label.toLowerCase().includes(q)||s.cat.toLowerCase().includes(q)
    )
  ).slice(0,6):[];
  return(
    <div style={{background:t.CARD2,borderRadius:10,padding:12,border:"1px solid "+t.BORDER,marginBottom:12}}>
      <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:current.length>0?12:0}}>
        {current.map((tk,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:5,background:t.CARD,border:"1px solid "+t.GOLD+"44",borderRadius:20,padding:"5px 12px 5px 12px"}}>
            <span style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{tk.label||tk.symbol}</span>
            <button onClick={()=>setMarketTickers(ts=>ts.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:13,padding:"0 0 0 4px",lineHeight:1,opacity:.6}}>✕</button>
          </div>
        ))}
      </div>
      {!isFull&&(
        <div style={{position:"relative"}}>
          <input
            value={search}
            onChange={e=>setSearch(e.target.value)}
            onKeyDown={e=>{
              if(e.key==="Enter"&&search.trim()&&suggestions.length===0){
                const sym=search.trim().toUpperCase();
                setMarketTickers(ts=>[...(ts||DEFAULT_TICKERS),{symbol:sym,label:sym,fx:false}]);
                setSearch("");
              }
            }}
            placeholder="Search stocks, crypto, indices, forex... or type any symbol"
            style={{width:"100%",background:t.CARD,border:"1px solid "+t.GOLD+"44",borderRadius:8,padding:"10px 12px",color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}}
          />
          {suggestions.length>0&&(
            <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:t.CARD,border:"1px solid "+t.GOLD+"44",borderRadius:9,zIndex:300,boxShadow:"0 8px 32px rgba(0,0,0,.6)",overflow:"hidden"}}>
              {suggestions.map((s,si)=>(
                <div key={s.symbol}
                  onClick={()=>{setMarketTickers(ts=>[...(ts||DEFAULT_TICKERS),{symbol:s.symbol,label:s.label,fx:s.fx||false}]);setSearch("");}}
                  style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",cursor:"pointer",borderBottom:si<suggestions.length-1?"1px solid "+t.BORDER+"33":"none"}}
                  onMouseEnter={e=>e.currentTarget.style.background=t.GOLD+"14"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <div>
                    <span style={{fontSize:13,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{s.symbol}</span>
                    <span style={{fontSize:13,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",marginLeft:10}}>{s.label}</span>
                  </div>
                  <span style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",background:t.CARD2,padding:"2px 8px",borderRadius:8}}>{s.cat}</span>
                </div>
              ))}
            </div>
          )}
          {search.trim().length>0&&suggestions.length===0&&(
            <div style={{marginTop:8,background:t.CARD,border:"1px solid "+t.GOLD+"33",borderRadius:9,padding:"11px 14px"}}>
              <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:8}}>Not in our quick list — but you can still add it directly:</div>
              <div onClick={()=>{const sym=search.trim().toUpperCase();setMarketTickers(ts=>[...(ts||DEFAULT_TICKERS),{symbol:sym,label:sym,fx:false}]);setSearch("");}}
                style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",padding:"8px 10px",background:t.GOLD+"12",borderRadius:7,border:"1px solid "+t.GOLD+"33"}}
                onMouseEnter={e=>e.currentTarget.style.background=t.GOLD+"22"}
                onMouseLeave={e=>e.currentTarget.style.background=t.GOLD+"12"}>
                <span style={{fontSize:13,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>+ Add "{search.trim().toUpperCase()}"</span>
                <span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>Press Enter</span>
              </div>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:6,fontStyle:"italic"}}>Use the exact ticker — e.g. TSLA, CBA.AX, ETH-USD, ^FTSE</div>
            </div>
          )}
        </div>
      )}
      {isFull&&<div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textAlign:"center",padding:"4px 0"}}>5 tickers maximum — remove one to add another</div>}
      <div style={{display:"flex",gap:8,marginTop:12}}>
        <Btn onClick={onSave} style={{fontSize:11,padding:"8px 14px"}}>Save & Refresh</Btn>
        <Btn onClick={onReset} variant="ghost" style={{fontSize:11,padding:"8px 14px"}}>Reset</Btn>
      </div>
    </div>
  );
}
function NewsPage(){
  const t=T();
  const[news,setNews]=useState(null);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const[lastFetched,setLastFetched]=useState(null);
  const[activeTab,setActiveTab]=useState("asx");

  const CATS=[
    {id:"asx",label:"ASX",icon:"🇦🇺"},
    {id:"us",label:"US Markets",icon:"🇺🇸"},
    {id:"crypto",label:"Crypto",icon:"₿"},
    {id:"macro",label:"Macro",icon:"🌐"},
  ];

  const fetchNews=async()=>{
    setLoading(true);setError("");
    try{
      const r=await fetch(API_BASE+"/api/news");
      if(!r.ok)throw new Error("Server error "+r.status);
      const d=await r.json();
      setNews(d);
      setLastFetched(new Date());
    }catch(e){setError("Unable to load news — "+e.message);}
    setLoading(false);
  };

  useEffect(()=>{fetchNews();},[]);

  const fmtAge=ts=>{
    if(!ts)return "";
    const mins=Math.round((Date.now()-ts)/60000);
    if(mins<60)return mins+"m ago";
    const hrs=Math.floor(mins/60);
    if(hrs<24)return hrs+"h ago";
    return Math.floor(hrs/24)+"d ago";
  };

  const items=news?.[activeTab]||[];

  return(
    <div>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,letterSpacing:4,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:4}}>Financial Intelligence</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
          <div style={{fontSize:22,color:t.TEXT}}>Market News</div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {lastFetched&&<div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{lastFetched.toLocaleTimeString(_locale,{hour:"2-digit",minute:"2-digit"})}</div>}
            <button onClick={fetchNews} disabled={loading} style={{background:t.GOLD+"22",border:"1px solid "+t.GOLD+"44",borderRadius:7,padding:"5px 10px",color:t.GOLD,cursor:loading?"default":"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>{loading?"Loading...":"↻ Refresh"}</button>
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div style={{display:"flex",gap:7,marginBottom:14,overflowX:"auto",scrollbarWidth:"none"}}>
        {CATS.map(c=>(
          <button key={c.id} onClick={()=>setActiveTab(c.id)} style={{flexShrink:0,padding:"7px 14px",borderRadius:20,border:"1px solid "+(activeTab===c.id?t.GOLD:t.BORDER),background:activeTab===c.id?t.GOLD+"22":"transparent",color:activeTab===c.id?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12,display:"flex",alignItems:"center",gap:5}}>
            <span>{c.icon}</span><span>{c.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {error&&<Card style={{marginBottom:14,border:"1px solid #C97E7E44"}}><div style={{fontSize:13,color:"#C97E7E",fontFamily:"'Montserrat',sans-serif"}}>{error}</div></Card>}

      {loading&&<Card>{[90,75,85,70,80,65].map((w,i)=>(
        <div key={i} style={{paddingBottom:i<5?12:0,marginBottom:i<5?12:0,borderBottom:i<5?"1px solid "+t.BORDER:"none"}}>
          <Skeleton width={w+"%"} height={14} style={{marginBottom:6}}/>
          <Skeleton width={(w-15)+"%"} height={10}/>
        </div>
      ))}</Card>}

      {!loading&&!error&&items.length===0&&(
        <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
          <div style={{fontSize:32,marginBottom:12}}>📰</div>
          <div style={{fontSize:14,marginBottom:6}}>No stories loaded</div>
          <div style={{fontSize:12}}>Tap Refresh to try again</div>
        </div>
      )}

      {!loading&&items.length>0&&(
        <Card>
          {items.map((item,i)=>{
            const age=fmtAge(item.timestamp);
            return(
              <div key={i}>
                {i>0&&<Divider/>}
                <a href={item.link} target="_blank" rel="noopener noreferrer" style={{display:"block",padding:"12px 0",textDecoration:"none"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:4}}>
                    <div style={{fontSize:13,color:t.TEXT,lineHeight:1.4,fontFamily:"'Montserrat',sans-serif",fontWeight:500,flex:1}}>{item.title}</div>
                    <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",flexShrink:0,marginTop:2}}>{age}</div>
                  </div>
                  {item.description&&<div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",lineHeight:1.6,marginBottom:4}}>{item.description}{item.description.length>=200?"…":""}</div>}
                  <div style={{fontSize:10,color:t.GOLD,fontFamily:"'Montserrat',sans-serif"}}>{item.source} →</div>
                </a>
              </div>
            );
          })}
        </Card>
      )}
      <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textAlign:"center",marginTop:16,lineHeight:1.6}}>News sourced from public RSS feeds. Refreshes every 5 minutes.<br/>Tap any headline to read the full article.</div>
    </div>
  );
}

function App(){
  const[readyToSave,setReadyToSave]=useState(false);
  const[sessionExpired,setSessionExpired]=useState(false);
  const[showSignInPrompt,setShowSignInPrompt]=useState(false);
  const[hydrated,setHydrated]=useState(false);
  const[splash,setSplash]=useState(true);
  const[authToken,setAuthToken]=useState(()=>{try{const t=localStorage.getItem("exec_token")||null;setActiveToken(t);return t;}catch{return null;}});
  // Keep module-level token in sync
  useEffect(()=>{setActiveToken(authToken);},[authToken]);
  const[authUser,setAuthUser]=useState(null);
  const[showAuth,setShowAuth]=useState(false);
  const[authMode,setAuthMode]=useState("signin");
  const[authEmail,setAuthEmail]=useState("");
  const[authPassword,setAuthPassword]=useState("");
  const[authLoading,setAuthLoading]=useState(false);
  const[authError,setAuthError]=useState("");
  const[syncing,setSyncing]=useState(false);
  const[isOnline,setIsOnline]=useState(()=>navigator.onLine);
  const[pendingSave,setPendingSave]=useState(false);

  // Configure RevenueCat once we know who's logged in, native app only.
  // appUserID is set to our own Supabase user id so purchases tie back to
  // the correct account, and so the webhook can update the right row in
  // the subscriptions table without any extra mapping step.
  useEffect(()=>{
    if(!Capacitor.isNativePlatform()||!authUser?.id)return;
    Purchases.configure({apiKey:RC_API_KEY_IOS,appUserID:authUser.id}).catch(e=>{
      console.error("RevenueCat configure error:",e);
    });
  },[authUser?.id]);

  // Note: debt totals are computed live in liveProfile via liveDebtTotal
  useEffect(()=>{
    if(!isOnline||!pendingSave||!authToken||!authUser?.id||!readyToSave)return;
    const dataToSave={lastSavedDate:todayStr(),theme,bgPhoto,profile,tasks,goals,completed,supplements,workouts,transactions,journal,books,bills,debts,taxDeductions,notes,services,learnData,commodityHoldings,altAssets,readingGoal,marketTickers,superLog,history,bodyLog,habits,habitLog,holdings,cryptoHoldings,nwHistory,seenMilestones,sidebarCollapsed,advisorMessages:advisorMessages.slice(-40),budgets,weeklyReflections};
    (async()=>{
      try{
        setSyncing(true);
        await supabase.save(authUser.id,authToken,dataToSave);
        setPendingSave(false);
        setLastSaved(Date.now());
      }catch{}
      finally{setSyncing(false);}
    })();
  },[isOnline]);
  useEffect(()=>{
    const goOnline=()=>{
      setIsOnline(true);
      // Flush any pending save when coming back online
      if(pendingSave)setPendingSave(false);
    };
    const goOffline=()=>setIsOnline(false);
    window.addEventListener("online",goOnline);
    window.addEventListener("offline",goOffline);
    return()=>{window.removeEventListener("online",goOnline);window.removeEventListener("offline",goOffline);};
  },[pendingSave]);
  const[lastResetDate,setLastResetDate]=useState(()=>todayStr());

  // Auto-reset tasks/supplements at midnight without requiring a manual reload
  useEffect(()=>{
    const scheduleMidnightCheck=()=>{
      const now=new Date();
      const nextMidnight=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,5);
      const msUntil=nextMidnight-now;
      return setTimeout(()=>{
        const today=todayStr();
        if(today!==lastResetDate){
          const dayOfWeek=new Date(today+"T12:00:00").getDay();
          setTasks(ts=>(ts||[]).map(tk=>{
            if(!tk.done)return tk;
            if(tk.recurring&&!tk.recurDays)return{...tk,done:false};
            if(tk.recurring&&tk.recurDays?.length){
              if(tk.recurDays.includes(dayOfWeek))return{...tk,done:false};
              return tk;
            }
            return null;
          }).filter(Boolean));
          setSupplements(ss=>(ss||[]).map(s=>({...s,taken:false})));
          setLastResetDate(today);
        }
        scheduleMidnightCheck();
      },Math.max(msUntil,1000));
    };
    const timer=scheduleMidnightCheck();
    return()=>clearTimeout(timer);
  },[lastResetDate]);

  // Also catch the case where the tab was asleep/backgrounded past midnight
  useEffect(()=>{
    const checkOnFocus=()=>{
      const today=todayStr();
      if(today!==lastResetDate){
        const dayOfWeek=new Date(today+"T12:00:00").getDay();
        setTasks(ts=>(ts||[]).map(tk=>{
          if(!tk.done)return tk;
          if(tk.recurring&&!tk.recurDays)return{...tk,done:false};
          if(tk.recurring&&tk.recurDays?.length){
            if(tk.recurDays.includes(dayOfWeek))return{...tk,done:false};
            return tk;
          }
          return null;
        }).filter(Boolean));
        setSupplements(ss=>(ss||[]).map(s=>({...s,taken:false})));
        setLastResetDate(today);
      }
    };
    document.addEventListener("visibilitychange",checkOnFocus);
    window.addEventListener("focus",checkOnFocus);
    return()=>{
      document.removeEventListener("visibilitychange",checkOnFocus);
      window.removeEventListener("focus",checkOnFocus);
    };
  },[lastResetDate]);

  // Auto-deduct debt repayments when nextPaymentDate passes
  useEffect(()=>{
    if(!readyToSave||!debts?.length)return;
    const today=todayStr();
    const needsDeduct=debts.some(d=>d.nextPaymentDate&&d.nextPaymentDate<=today&&parseFloat(d.minPayment)>0&&parseFloat(d.balance)>0);
    if(!needsDeduct)return;
    setDebts(ds=>ds.map(d=>{
      if(!d.nextPaymentDate||d.nextPaymentDate>today||!parseFloat(d.minPayment)||!parseFloat(d.balance))return d;
      // Roll through any missed payment cycles
      let nextDate=d.nextPaymentDate;
      let balance=parseFloat(d.balance);
      const freq=d.frequency||"monthly";
      const payment=parseFloat(d.minPayment);
      const payments=[...(d.payments||[])];
      let safety=0;
      while(nextDate<=today&&balance>0&&safety<60){
        const actual=Math.min(payment,balance);
        payments.unshift({date:nextDate,amount:actual,balance:Math.max(balance-actual,0)});
        balance=Math.max(balance-actual,0);
        nextDate=advanceDate(nextDate,freq);
        safety++;
      }
      if(payments.length===(d.payments||[]).length)return d;
      return{...d,balance:Math.round(balance*100)/100,nextPaymentDate:nextDate,payments:payments.slice(0,24)};
    }));
  },[readyToSave,lastResetDate]);

  // Auto-advance autopay bills past their due date — these are paid automatically by the bank,
  // so the app should roll nextDue forward on its own rather than waiting for a manual "Paid" click.
  // Runs only on load and when a new day starts (lastResetDate) — never depends on bills itself,
  // since that would re-trigger this effect every time it updates the bills it's watching.
  useEffect(()=>{
    if(!readyToSave)return;
    setBills(bs=>{
      if(!bs.length)return bs;
      const needsRoll=bs.some(b=>b.autopay&&b.nextDue&&new Date(b.nextDue+"T12:00:00")<new Date());
      if(!needsRoll)return bs;
      return bs.map(b=>rollAutopayForward(b));
    });
  },[lastResetDate,readyToSave]);

  const[subscription,setSubscription]=useState(null);
  const[showUpgrade,setShowUpgrade]=useState(false);
  const[upgradeLoading,setUpgradeLoading]=useState(false);
  useEffect(()=>{
    const tid=setTimeout(()=>{
      setSplash(false);
      // If no saved token, prompt to sign in after splash
      if(!localStorage.getItem("exec_token")){
        setShowAuth(true);
      }
    },2500);
    return()=>clearTimeout(tid);
  },[]);
  const[profile,setProfile]=useState(null);
  const[page,setPage]=useState("dashboard");
  const[theme,setThemeState]=useState(()=>{
    // Use saved theme if exists in localStorage
    try{
      const saved=localStorage.getItem(SK);
      if(saved){const d=JSON.parse(saved);if(d.theme)return d.theme;}
    }catch{}
    // Fall back to system preference
    if(typeof window!=="undefined"&&window.matchMedia?.("(prefers-color-scheme: light)").matches)return "charcoal";
    return "obsidian";
  });
  // Global micro-animation styles injected once
  if(typeof document!=="undefined"&&!document.getElementById("exec-animations")){
    const s=document.createElement("style");
    s.id="exec-animations";
    s.textContent=`
      @keyframes tickPop{0%{transform:scale(1)}40%{transform:scale(1.35)}70%{transform:scale(.9)}100%{transform:scale(1)}}
      @keyframes checkDraw{0%{stroke-dashoffset:20}100%{stroke-dashoffset:0}}
      @keyframes ripple{0%{transform:scale(0);opacity:.6}100%{transform:scale(2.5);opacity:0}}
      @keyframes scoreUp{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
      @keyframes confetti{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(-60px) rotate(360deg);opacity:0}}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
      .tick-pop{animation:tickPop .35s cubic-bezier(.36,.07,.19,.97)}
      .score-up{animation:scoreUp .6s ease forwards}
    `;
    document.head.appendChild(s);
  }
  const[bgPhoto,setBgPhoto]=useState("none");
  const[sidebarCollapsed,setSidebarCollapsed]=useState(false);
  const[showSetup,setShowSetup]=useState(false);
  const[tasks,setTasks]=useState(D_TASKS);
  const[goals,setGoals]=useState(D_GOALS);
  const[completed,setCompleted]=useState([]);
  const[supplements,setSupplements]=useState(D_SUPPS);
  const[workouts,setWorkouts]=useState([]);
  const[transactions,setTransactions]=useState([]);
  const[journal,setJournal]=useState([]);
  const[books,setBooks]=useState(D_BOOKS);
  const[readingGoal,setReadingGoal]=useState(24);
  const[bills,setBills]=useState([]);
  const[debts,setDebts]=useState([]);
  const[taxDeductions,setTaxDeductions]=useState([]);
  const[history,setHistory]=useState({});
  const[bodyLog,setBodyLog]=useState([]);
  const[habits,setHabits]=useState(D_HABITS);
  const[habitLog,setHabitLog]=useState({});
  const[holdings,setHoldings]=useState([]);
  const[budgets,setBudgets]=useState({});
  const[weeklyReflections,setWeeklyReflections]=useState({});
  const[notes,setNotes]=useState([]);
  const[services,setServices]=useState([]);
  const[learnData,setLearnData]=useState({library:[],sessions:[],weeklyGoal:5});
  const[cryptoHoldings,setCryptoHoldings]=useState([]);
  const[commodityHoldings,setCommodityHoldings]=useState([]);
  const[altAssets,setAltAssets]=useState([]);
  const[superLog,setSuperLog]=useState([]);
  const[advisorMessages,setAdvisorMessages]=useState([]);
  const[lastSaved,setLastSaved]=useState(null);
  const[nwHistory,setNwHistory]=useState({});
  const[showBriefing,setShowBriefing]=useState(false);
  const[celebration,setCelebration]=useState(null);
  const[seenMilestones,setSeenMilestones]=useState([]);
  const[showRecalibrate,setShowRecalibrate]=useState(false);
  const isMobile=useIsMobile();
  const[marketTickers,setMarketTickers]=useState(DEFAULT_TICKERS);
  const market=useMarket(marketTickers);
  const portfolio=usePortfolio(holdings);
  const cryptoPortfolio=useCrypto(cryptoHoldings);
  const commodityPortfolio=useCommodities(commodityHoldings);

  useEffect(()=>{
    const today=todayStr();
    (async()=>{
      const savedToken = localStorage.getItem("exec_token");
      const savedRefresh = localStorage.getItem("exec_refresh");
      let token = savedToken;
      let user = null;

      if(token){
        try{
          user = await supabase.getUser(token);
          // Token expired — try refresh
          if(!user?.id && savedRefresh){
            const refreshed = await supabase.refresh(savedRefresh);
            if(refreshed.access_token){
              token = refreshed.access_token;
              localStorage.setItem("exec_token", token);
              if(refreshed.refresh_token) localStorage.setItem("exec_refresh", refreshed.refresh_token);
              user = refreshed.user;
            }
          }
        }catch{ token=null; }
      }

      if(token && user?.id){
        setAuthToken(token);
        setAuthUser(user);
        try{
          const subRes=await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${user.id}&select=*`,{headers:sbH(token)});
          const subData=await subRes.json();
          if(subData?.[0])setSubscription(subData[0]);
        }catch{}
        try{
          const cloudData = await supabase.load(user.id, token);
          const hasCloudData = cloudData && Object.keys(cloudData).length > 0 && (cloudData.profile || cloudData.tasks || cloudData.habits || cloudData.supplements || cloudData.journal || cloudData.holdings || cloudData.history);
          if(hasCloudData){
            const d = applyDailyReset(cloudData, today);
            if(d.theme){const k=THEME_ALIASES[d.theme]||d.theme;_themeKey=k;setThemeState(d.theme);}
            if(d.bgPhoto){_bgPhotoId=d.bgPhoto;setBgPhoto(d.bgPhoto);}
            if(d.profile){setProfile(d.profile);if(d.profile.locale)_locale=d.profile.locale;}
            if(d.tasks!==undefined)setTasks(d.tasks);
            if(d.goals!==undefined)setGoals(d.goals);
            if(d.completed!==undefined)setCompleted(d.completed);
            if(d.supplements!==undefined)setSupplements(d.supplements);
            if(d.workouts!==undefined)setWorkouts(d.workouts);
            if(d.transactions!==undefined)setTransactions(d.transactions);
            if(d.journal!==undefined)setJournal(d.journal);
            if(d.books!==undefined)setBooks(d.books);
              if(d.readingGoal)setReadingGoal(d.readingGoal);
              if(d.marketTickers)setMarketTickers(d.marketTickers);
              if(d.superLog)setSuperLog(d.superLog);
            if(d.bills!==undefined)setBills(d.bills);
            if(d.debts!==undefined)setDebts(d.debts);
            if(d.taxDeductions!==undefined)setTaxDeductions(d.taxDeductions);
            if(d.history)setHistory(d.history);
            if(d.bodyLog!==undefined)setBodyLog(d.bodyLog);
            if(d.habits!==undefined)setHabits(d.habits);
            if(d.habitLog)setHabitLog(d.habitLog);
            if(d.holdings!==undefined)setHoldings(d.holdings);
            if(d.cryptoHoldings!==undefined)setCryptoHoldings(d.cryptoHoldings);
            if(d.nwHistory)setNwHistory(d.nwHistory);
            if(d.seenMilestones!==undefined)setSeenMilestones(d.seenMilestones);
            if(d.sidebarCollapsed!==undefined)setSidebarCollapsed(d.sidebarCollapsed);
            if(d.budgets)setBudgets(d.budgets);
            if(d.weeklyReflections)setWeeklyReflections(d.weeklyReflections);
            if(d.notes!==undefined)setNotes(d.notes);
            if(d.services!==undefined)setServices(d.services);
              if(d.learnData)setLearnData(d.learnData);
              if(d.commodityHoldings!==undefined)setCommodityHoldings(d.commodityHoldings);
              if(d.altAssets!==undefined)setAltAssets(d.altAssets);
            if(d.advisorMessages!==undefined)setAdvisorMessages(d.advisorMessages);
            // Update localStorage with cloud data so it's in sync
            saveData({...d,lastSavedDate:today});
            setHydrated(true);
            setTimeout(()=>setReadyToSave(true),500);
            return; // Skip localStorage — cloud data is authoritative
          }
        }catch{}
      } else if(savedToken) {
        // Token fully expired and refresh failed — clear and warn
        localStorage.removeItem("exec_token");
        localStorage.removeItem("exec_refresh");
        setSessionExpired(true);
      }

      // Fall back to localStorage
      let saved=loadData();
      if(saved){
        saved=applyDailyReset(saved,today);
        if(saved.theme){const k=THEME_ALIASES[saved.theme]||saved.theme;_themeKey=k;setThemeState(k);}
        if(saved.profile){setProfile(saved.profile);if(saved.profile.locale)_locale=saved.profile.locale;}
        if(saved.tasks!==undefined)setTasks(saved.tasks);
        if(saved.goals!==undefined)setGoals(saved.goals);
        if(saved.completed!==undefined)setCompleted(saved.completed);
        if(saved.supplements!==undefined)setSupplements(saved.supplements);
        if(saved.workouts!==undefined)setWorkouts(saved.workouts);
        if(saved.transactions!==undefined)setTransactions(saved.transactions);
        if(saved.journal!==undefined)setJournal(saved.journal);
        if(saved.books!==undefined)setBooks(saved.books);
        if(saved.readingGoal)setReadingGoal(saved.readingGoal);
        if(saved.marketTickers)setMarketTickers(saved.marketTickers);
        if(saved.superLog)setSuperLog(saved.superLog);
        if(saved.bills!==undefined)setBills(saved.bills);
        if(saved.debts!==undefined)setDebts(saved.debts);
        if(saved.history)setHistory(saved.history);
        if(saved.bodyLog!==undefined)setBodyLog(saved.bodyLog);
        if(saved.habits!==undefined)setHabits(saved.habits);
        if(saved.habitLog)setHabitLog(saved.habitLog);
        if(saved.holdings!==undefined)setHoldings(saved.holdings);
        if(saved.cryptoHoldings!==undefined)setCryptoHoldings(saved.cryptoHoldings);
        if(saved.nwHistory)setNwHistory(saved.nwHistory);
        if(saved.seenMilestones!==undefined)setSeenMilestones(saved.seenMilestones);
        if(saved.sidebarCollapsed!==undefined)setSidebarCollapsed(saved.sidebarCollapsed);
        if(saved.budgets)setBudgets(saved.budgets);
        if(saved.weeklyReflections)setWeeklyReflections(saved.weeklyReflections);
        if(saved.notes!==undefined)setNotes(saved.notes);
        if(saved.services!==undefined)setServices(saved.services);
      if(saved.learnData)setLearnData(saved.learnData);
      if(saved.commodityHoldings!==undefined)setCommodityHoldings(saved.commodityHoldings);
      if(saved.altAssets!==undefined)setAltAssets(saved.altAssets);
        if(saved.advisorMessages!==undefined)setAdvisorMessages(saved.advisorMessages);
      }
      setHydrated(true);
      setTimeout(()=>setReadyToSave(true),500);
    })();
  },[]);

  useEffect(()=>{
    if(!readyToSave)return;
    const dataToSave = {lastSavedDate:todayStr(),theme,bgPhoto,profile,tasks,goals,completed,supplements,workouts,transactions,journal,books,bills,debts,taxDeductions,notes,services,learnData,commodityHoldings,altAssets,readingGoal,marketTickers,superLog,history,bodyLog,habits,habitLog,holdings,cryptoHoldings,nwHistory,seenMilestones,sidebarCollapsed,advisorMessages:advisorMessages.slice(-40),budgets,weeklyReflections};
    const timer=setTimeout(()=>{
      (async()=>{
        // Always save to localStorage — works offline
        saveData(dataToSave);
        if(authToken && authUser?.id){
          if(!navigator.onLine){
            // Mark as pending — will sync when back online
            setPendingSave(true);
            setLastSaved(Date.now());
            return;
          }
          try{
            setSyncing(true);
            await supabase.save(authUser.id, authToken, dataToSave);
            setPendingSave(false);
          }catch(e){
            console.error("[Save failed]",e?.message);
            // If 401 — token expired, try to refresh
            if(e?.message?.includes("401")){
              const savedRefresh=localStorage.getItem("exec_refresh");
              if(savedRefresh){
                try{
                  const refreshed=await supabase.refresh(savedRefresh);
                  if(refreshed.access_token){
                    const newToken=refreshed.access_token;
                    localStorage.setItem("exec_token",newToken);
                    if(refreshed.refresh_token)localStorage.setItem("exec_refresh",refreshed.refresh_token);
                    setAuthToken(newToken);
                    // Retry save with new token
                    await supabase.save(authUser.id,newToken,dataToSave);
                    setPendingSave(false);
                  }
                }catch(re){console.error("[Token refresh failed]",re?.message);setPendingSave(true);}
              }
            } else {
              setPendingSave(true);
            }
          }
          finally{setSyncing(false);}
        }
        setLastSaved(Date.now());
      })();
    },400);
    return()=>clearTimeout(timer);
  },[readyToSave,theme,bgPhoto,profile,tasks,goals,completed,supplements,workouts,transactions,journal,books,bills,debts,taxDeductions,notes,services,learnData,commodityHoldings,altAssets,readingGoal,history,bodyLog,habits,habitLog,holdings,cryptoHoldings,nwHistory,seenMilestones,sidebarCollapsed,budgets,weeklyReflections,advisorMessages]);

  // Flush save immediately if the user navigates away/closes the tab before the debounce timer fires
  useEffect(()=>{
    const flush=()=>{
      if(!readyToSave)return;
      const dataToSave = {lastSavedDate:todayStr(),theme,bgPhoto,profile,tasks,goals,completed,supplements,workouts,transactions,journal,books,bills,debts,taxDeductions,notes,services,learnData,commodityHoldings,altAssets,readingGoal,marketTickers,superLog,history,bodyLog,habits,habitLog,holdings,cryptoHoldings,nwHistory,seenMilestones,sidebarCollapsed,advisorMessages:advisorMessages.slice(-40),budgets,weeklyReflections};
      saveData(dataToSave);
      if(authToken && authUser?.id){
        try{
          fetch(SUPABASE_URL+"/rest/v1/user_data",{method:"POST",headers:{...sbH(authToken),"Prefer":"resolution=merge-duplicates"},body:JSON.stringify({user_id:authUser.id,data:dataToSave,updated_at:new Date().toISOString()}),keepalive:true}).catch(()=>{});
        }catch{}
      }
    };
    const onVisibility=()=>{
      if(document.visibilityState==="hidden") flush();
      // Re-fetch from Supabase when tab becomes visible — picks up ALL changes from other devices
      if(document.visibilityState==="visible"&&authToken&&authUser?.id){
        fetch(SUPABASE_URL+"/rest/v1/user_data?user_id=eq."+authUser.id+"&select=data",{headers:sbH(authToken)})
          .then(r=>r.json()).then(rows=>{
            let d=rows?.[0]?.data;
            if(!d)return;
            // This tab may have been asleep/backgrounded across midnight -
            // apply the same daily reset logic used on fresh page loads,
            // so a long-lived tab doesn't carry yesterday's completions
            // into a new day.
            d=applyDailyReset(d,todayStr());
            // Theme / appearance
            if(d.theme&&d.theme!==theme){const k=THEME_ALIASES[d.theme]||d.theme;_themeKey=k;setThemeState(d.theme);}
            if(d.bgPhoto&&d.bgPhoto!==bgPhoto){_bgPhotoId=d.bgPhoto;setBgPhoto(d.bgPhoto);}
            // Market
            if(d.marketTickers)setMarketTickers(d.marketTickers);
            // Profile & wealth (cash, income, assets etc)
            if(d.profile)setProfile(d.profile);
            if(d.nwHistory)setNwHistory(d.nwHistory);
            // Daily execution
            if(d.tasks!==undefined)setTasks(d.tasks);
            if(d.habits!==undefined)setHabits(d.habits);
            if(d.habitLog)setHabitLog(d.habitLog);
            if(d.supplements!==undefined)setSupplements(d.supplements);
            if(d.goals!==undefined)setGoals(d.goals);
            if(d.completed!==undefined)setCompleted(d.completed);
            // Wealth
            if(d.holdings!==undefined)setHoldings(d.holdings);
            if(d.cryptoHoldings!==undefined)setCryptoHoldings(d.cryptoHoldings);
            if(d.commodityHoldings!==undefined)setCommodityHoldings(d.commodityHoldings);
            if(d.altAssets!==undefined)setAltAssets(d.altAssets);
            // Finance
            if(d.transactions!==undefined)setTransactions(d.transactions);
            if(d.bills!==undefined)setBills(d.bills);
            if(d.debts!==undefined)setDebts(d.debts);
            if(d.budgets)setBudgets(d.budgets);
            if(d.taxDeductions!==undefined)setTaxDeductions(d.taxDeductions);
            // Health & body
            if(d.bodyLog!==undefined)setBodyLog(d.bodyLog);
            if(d.workouts!==undefined)setWorkouts(d.workouts);
            // Journal & reading
            if(d.journal!==undefined)setJournal(d.journal);
            if(d.books!==undefined)setBooks(d.books);
            if(d.readingGoal)setReadingGoal(d.readingGoal);
            // Notes, services, learn
            if(d.notes!==undefined)setNotes(d.notes);
            if(d.services!==undefined)setServices(d.services);
            if(d.learnData)setLearnData(d.learnData);
            // Weekly reflections & AI advisor
            if(d.weeklyReflections)setWeeklyReflections(d.weeklyReflections);
            if(d.advisorMessages)setAdvisorMessages(d.advisorMessages);
            // Score history — merge per-date, keeping whichever side has the
            // higher score for each individual date. Only special-casing
            // "today" meant that once the calendar rolled over, yesterday's
            // entry lost this protection entirely and a stale, late-arriving
            // save from a device that slept through midnight could silently
            // overwrite a more complete day from another device.
            if(d.history){
              setHistory(prev=>{
                const merged={...d.history};
                for(const dateKey of Object.keys(prev)){
                  const localScore=prev[dateKey]?.score||0;
                  const cloudScore=d.history[dateKey]?.score||0;
                  if(localScore>=cloudScore)merged[dateKey]=prev[dateKey];
                }
                return merged;
              });
            }
          }).catch(()=>{});
      }
    };
    document.addEventListener("visibilitychange",onVisibility);
    window.addEventListener("beforeunload",flush);
    return()=>{
      document.removeEventListener("visibilitychange",onVisibility);
      window.removeEventListener("beforeunload",flush);
    };
  },[readyToSave,theme,bgPhoto,profile,tasks,goals,completed,supplements,workouts,transactions,journal,books,bills,debts,taxDeductions,notes,services,learnData,commodityHoldings,altAssets,readingGoal,history,bodyLog,habits,habitLog,holdings,cryptoHoldings,nwHistory,seenMilestones,sidebarCollapsed,budgets,weeklyReflections,advisorMessages]);

  const setTheme=th=>{const k=THEME_ALIASES[th]||th;_themeKey=k;setThemeState(k);};

  // Listen for OS theme changes — only applies if user hasn't manually set a theme
  useEffect(()=>{
    const mq=window.matchMedia?.("(prefers-color-scheme: light)");
    if(!mq)return;
    const handler=e=>{
      // Only auto-switch if user hasn't saved a manual theme preference
      const saved=localStorage.getItem(SK);
      if(saved){try{const d=JSON.parse(saved);if(d.theme)return;}catch{}}
      const newTheme=e.matches?"charcoal":"obsidian";
      _themeKey=newTheme;setThemeState(newTheme);
    };
    mq.addEventListener("change",handler);
    return()=>mq.removeEventListener("change",handler);
  },[]);
  const setBgPhotoId=id=>{_bgPhotoId=id;setBgPhoto(id);};
  const todayT=todayTasks(tasks);
  const tDone=todayT.filter(tk=>tk.done).length;
  const sDone=supplements.filter(s=>s.taken).length;
  const hDone=(habits||[]).filter(h=>habitLog[h.id+"_"+todayStr()]).length;

  // Only score categories that have data — redistribute 100 points across active categories
  const cats=[];
  if(todayT.length)cats.push(tDone/todayT.length);
  if(supplements.length)cats.push(sDone/supplements.length);
  if((habits||[]).length)cats.push(hDone/(habits||[]).length);
  const todayScore=cats.length?Math.round(cats.reduce((a,b)=>a+b,0)/cats.length*100):0;

  const tS=todayT.length?Math.round(tDone/todayT.length*35):0;
  const sS=supplements.length?Math.round(sDone/supplements.length*25):0;
  const gS=goals.length?Math.round(goals.filter(g=>g.progress>=50).length/goals.length*25):0;
  const hS=(habits||[]).length?Math.round(hDone/(habits||[]).length*15):0;

  useEffect(()=>{
    if(!hydrated)return;
    setHistory(h=>({...h,[todayStr()]:{score:todayScore,tasks:tDone,supps:sDone,habits:hDone}}));
  },[todayScore,hydrated,hDone]);

  // Midnight reset — handles app left open overnight
  useEffect(()=>{
    const now=new Date();
    const msUntilMidnight=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,1)-now;
    const tid=setTimeout(()=>{
      const dayOfWeek=new Date().getDay();
      setTasks(ts=>ts.map(t=>{
        if(!t.done)return t;
        if(t.recurring&&!t.recurDays)return{...t,done:false};
        if(t.recurring&&t.recurDays?.length){
          if(t.recurDays.includes(dayOfWeek))return{...t,done:false};
          return t;
        }
        return null;
      }).filter(Boolean));
      setSupplements(ss=>ss.map(s=>({...s,taken:false})));
    },msUntilMidnight);
    return()=>clearTimeout(tid);
  },[]);

  useEffect(()=>{
    if(!hydrated||!profile)return;
    setNwHistory(h=>({...h,[monthStr()]:profile.netWorth||0}));
  },[profile,hydrated]);

  const streak=(()=>{let s=0,graced=false;for(let i=0;i<365;i++){const k=new Date(Date.now()-i*864e5).toISOString().split("T")[0];if(history[k]?.score>=50){s++;graced=false;}else if(i===0){}else if(!graced){graced=true;}else break;}return s;})();

  const prevNW=useRef(null);
  useEffect(()=>{
    const nw=profile?.netWorth||0;
    if(prevNW.current!==null&&nw>prevNW.current){
      const next=NW_MILESTONES.find(m=>nw>=m&&prevNW.current<m&&!seenMilestones.includes(m));
      if(next){setCelebration(next);setSeenMilestones(s=>[...s,next]);}
    }
    prevNW.current=nw;
  },[profile?.netWorth]);

  const handleSetupComplete=(data)=>{
    if(!data){setShowSetup(false);return;} // skip - use demo
    // Full reset of all data
    setProfile(data.profile);
    setTasks([]);
    setGoals(data.goals||[]);
    setCompleted([]);
    setSupplements(data.supplements||[]);
    setWorkouts([]);setTransactions([]);setJournal([]);
    setBooks([]);setBills([]);setHistory({});setBodyLog([]);
    // Build habits from selected habit names
    const habitColors=["#C9A84C","#7A9E7E","#7EB8C9","#B07EC9","#C97E7E","#D4956A"];
    const habitEmojis={"Morning Routine":"A","Cold Exposure":"C","Meditation":"M","Journalling":"J","Strength Training":"W","Reading Daily":"B","Intermittent Fasting":"F","No Alcohol":"N","Evening Walk":"V","Gratitude Practice":"G"};
    setHabits((data.profile.currentHabits||[]).map((name,i)=>({id:Date.now()+i,name,icon:habitEmojis[name]||"X",color:habitColors[i%habitColors.length],target:7,timeOfDay:"morning"})));
    setHabitLog({});setHoldings([]);setCryptoHoldings([]);
    setSeenMilestones([]);setNwHistory({});setBudgets({});
    setAdvisorMessages([]);
    if(data.profile.theme){_themeKey=data.profile.theme;setThemeState(data.profile.theme);}
    setShowSetup(false);
    setPage("dashboard");
  };

  // Handle Stripe redirect back — must be before any early returns
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    if(params.get("stripe")==="success"){
      setShowUpgrade(false);
      window.history.replaceState({},"","/app");
      // Retry subscription check up to 8 times over 30 seconds
      // Webhook can take 5-15s to fire and update Supabase
      let attempts=0;
      const checkSub=async()=>{
        if(!authUser||!authToken)return;
        try{
          const r=await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${authUser.id}&select=*`,{headers:sbH(authToken)});
          const d=await r.json();
          if(d?.[0]&&["active","trialing"].includes(d[0].status)){
            setSubscription(d[0]);
            return; // Done — subscription is active
          }
        }catch{}
        attempts++;
        if(attempts<8)setTimeout(checkSub,3000); // retry every 3s up to 8 times
      };
      setTimeout(checkSub,2000); // first check after 2s
    }
  },[authUser]);

  if(splash){
    return (
      <div style={{position:"fixed",inset:0,background:"#080808",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",zIndex:9999,minHeight:"100vh",WebkitMinHeight:"-webkit-fill-available"}}>
        <style>{`
          @keyframes splashIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
          @keyframes splashPulse{0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
        `}</style>
        <div style={{textAlign:"center",animation:"splashIn .9s ease forwards",WebkitAnimation:"splashIn .9s ease forwards"}}>
          <div style={{fontSize:9,letterSpacing:6,color:"#C9A84C",textTransform:"uppercase",fontFamily:"-apple-system,sans-serif",marginBottom:20,opacity:.8}}>The Executive</div>
          <div style={{width:48,height:1,background:"linear-gradient(90deg,transparent,#C9A84C,transparent)",margin:"0 auto 24px"}}/>
          <div style={{display:"flex",gap:7,justifyContent:"center"}}>
            {[0,1,2].map(i=>(
              <div key={i} style={{width:5,height:5,borderRadius:"50%",background:"#C9A84C",animation:`splashPulse 1.4s ease-in-out ${i*.25}s infinite`,WebkitAnimation:`splashPulse 1.4s ease-in-out ${i*.25}s infinite`}}/>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if(!hydrated){
    const t=T();
    return(
      <div style={{minHeight:"100vh",background:t.BG,display:"flex"}}>
        <div style={{width:160,background:t.CARD,borderRight:"1px solid "+t.BORDER,flexShrink:0,padding:20,display:"flex",flexDirection:"column",gap:12}}>
          <Skeleton width={80} height={10} style={{marginBottom:16}}/>
          {[100,80,90,70,85,75,90,80,70,85].map((w,i)=><Skeleton key={i} width={w+"%"} height={9}/>)}
        </div>
        <div style={{flex:1,padding:24,maxWidth:900,margin:"0 auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12,marginBottom:16}}>
            {[1,2,3].map(i=><div key={i} style={{background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:10,padding:16}}>
              <Skeleton width="60%" height={9} style={{marginBottom:8}}/>
              <Skeleton width="80%" height={22}/>
            </div>)}
          </div>
          <div style={{background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:10,padding:16,marginBottom:12}}>
            <Skeleton width="40%" height={10} style={{marginBottom:16}}/>
            <div style={{display:"flex",gap:24,justifyContent:"space-around"}}>
              {[1,2,3,4].map(i=><div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
                <Skeleton width={76} height={76} style={{borderRadius:"50%"}}/>
                <Skeleton width={50} height={9}/>
              </div>)}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
            {[1,2,3,4].map(i=><div key={i} style={{background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:10,padding:16}}>
              <Skeleton width="50%" height={9} style={{marginBottom:12}}/>
              {[90,75,85,70].map((w,j)=><Skeleton key={j} width={w+"%"} height={10} style={{marginBottom:8}}/>)}
            </div>)}
          </div>
        </div>
      </div>
    );
  }

  if(showSetup){
    return <SetupPage onComplete={handleSetupComplete}/>;
  }

  const handleSignIn=async()=>{
    setAuthLoading(true);setAuthError("");
    try{
      const res = await supabase.signIn(authEmail, authPassword);
      if(res.access_token){
        setAuthError("");
        // Clear any local cached data from previous user before loading new user's data
        localStorage.removeItem(SK);
        localStorage.setItem("exec_token", res.access_token);
        if(res.refresh_token) localStorage.setItem("exec_refresh", res.refresh_token);
        setAuthToken(res.access_token);
        setAuthUser(res.user);
        setShowAuth(false);
        setAuthLoading(false);
        // Load cloud data separately — don't let this affect sign in result
        try{
          const cloudData = await supabase.load(res.user.id, res.access_token);
          const hasCloudData = cloudData && Object.keys(cloudData).length > 0 && (cloudData.profile || cloudData.tasks || cloudData.habits || cloudData.supplements || cloudData.journal || cloudData.holdings || cloudData.history);
          if(hasCloudData){
            const d = applyDailyReset(cloudData, todayStr());
            if(d.profile)setProfile(d.profile);
            if(d.tasks!==undefined)setTasks(d.tasks);
            if(d.goals!==undefined)setGoals(d.goals);
            if(d.completed!==undefined)setCompleted(d.completed);
            if(d.supplements!==undefined)setSupplements(d.supplements);
            if(d.habits!==undefined)setHabits(d.habits);
            if(d.habitLog)setHabitLog(d.habitLog);
            if(d.workouts!==undefined)setWorkouts(d.workouts);
            if(d.transactions!==undefined)setTransactions(d.transactions);
            if(d.journal!==undefined)setJournal(d.journal);
            if(d.books!==undefined)setBooks(d.books);
              if(d.readingGoal)setReadingGoal(d.readingGoal);
              if(d.marketTickers)setMarketTickers(d.marketTickers);
              if(d.superLog)setSuperLog(d.superLog);
            if(d.bills!==undefined)setBills(d.bills);
            if(d.debts!==undefined)setDebts(d.debts);
            if(d.taxDeductions!==undefined)setTaxDeductions(d.taxDeductions);
            if(d.notes!==undefined)setNotes(d.notes);
            if(d.services!==undefined)setServices(d.services);
              if(d.learnData)setLearnData(d.learnData);
              if(d.commodityHoldings!==undefined)setCommodityHoldings(d.commodityHoldings);
              if(d.altAssets!==undefined)setAltAssets(d.altAssets);
            if(d.bodyLog!==undefined)setBodyLog(d.bodyLog);
            if(d.holdings!==undefined)setHoldings(d.holdings);
            if(d.cryptoHoldings!==undefined)setCryptoHoldings(d.cryptoHoldings);
            if(d.nwHistory)setNwHistory(d.nwHistory);
            if(d.seenMilestones!==undefined)setSeenMilestones(d.seenMilestones);
            if(d.sidebarCollapsed!==undefined)setSidebarCollapsed(d.sidebarCollapsed);
            if(d.budgets)setBudgets(d.budgets);
            if(d.weeklyReflections)setWeeklyReflections(d.weeklyReflections);
            if(d.advisorMessages!==undefined)setAdvisorMessages(d.advisorMessages);
            if(d.theme){_themeKey=THEME_ALIASES[d.theme]||d.theme;setThemeState(d.theme);}
            if(d.bgPhoto){_bgPhotoId=d.bgPhoto;setBgPhoto(d.bgPhoto);}
            // Update localStorage with cloud data so it's in sync
            saveData({...d,lastSavedDate:todayStr()});
          } else {
            // No cloud data — this is a brand new user, show setup wizard
            const localData = loadData();
            if(localData?.profile){
              // Has local data — migrate it
              const d = applyDailyReset(localData, todayStr());
              if(d.profile)setProfile(d.profile);
              if(d.tasks!==undefined)setTasks(d.tasks);
              if(d.goals!==undefined)setGoals(d.goals);
              if(d.completed!==undefined)setCompleted(d.completed);
              if(d.supplements!==undefined)setSupplements(d.supplements);
              if(d.habits!==undefined)setHabits(d.habits);
              if(d.habitLog)setHabitLog(d.habitLog);
              if(d.workouts!==undefined)setWorkouts(d.workouts);
              if(d.transactions!==undefined)setTransactions(d.transactions);
              if(d.journal!==undefined)setJournal(d.journal);
              if(d.books!==undefined)setBooks(d.books);
              if(d.readingGoal)setReadingGoal(d.readingGoal);
              if(d.marketTickers)setMarketTickers(d.marketTickers);
              if(d.superLog)setSuperLog(d.superLog);
              if(d.bills!==undefined)setBills(d.bills);
              if(d.debts!==undefined)setDebts(d.debts);
              if(d.notes!==undefined)setNotes(d.notes);
              if(d.services!==undefined)setServices(d.services);
              if(d.learnData)setLearnData(d.learnData);
              if(d.commodityHoldings!==undefined)setCommodityHoldings(d.commodityHoldings);
              if(d.altAssets!==undefined)setAltAssets(d.altAssets);
              if(d.bodyLog!==undefined)setBodyLog(d.bodyLog);
              if(d.holdings!==undefined)setHoldings(d.holdings);
              if(d.cryptoHoldings!==undefined)setCryptoHoldings(d.cryptoHoldings);
              if(d.nwHistory)setNwHistory(d.nwHistory);
              if(d.theme){_themeKey=THEME_ALIASES[d.theme]||d.theme;setThemeState(d.theme);}
              if(d.bgPhoto){_bgPhotoId=d.bgPhoto;setBgPhoto(d.bgPhoto);}
              await supabase.save(res.user.id, res.access_token, localData).catch(()=>{});
            } else {
              // Truly new user — no local data, no cloud data — launch setup wizard
              setShowSetup(true);
            }
          }
        }catch(e){console.error("Data load error:",e);}
        // Load subscription status
        try{
          const subRes=await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${res.user.id}&select=*`,{headers:sbH(res.access_token)});
          const subData=await subRes.json();
          if(subData?.[0])setSubscription(subData[0]);
        }catch{}
        setTimeout(()=>setReadyToSave(true),300);
        return;
      }else{
        const errMsg = res.error_description||res.msg||res.error||"";
        setAuthError(errMsg||"Sign in failed. Check your email and password.");
      }
    }catch(e){setAuthError("Connection error. Please check your internet and try again.");}
    setAuthLoading(false);
  };

  const handleSignUp=async()=>{
    setAuthLoading(true);setAuthError("");
    try{
      const res = await supabase.signUp(authEmail, authPassword);
      if(res.id||res.user?.id){
        setAuthError("");
        setAuthMode("signin");
        setAuthError("Account created! Please sign in.");
      }else{
        setAuthError(res.error_description||res.msg||"Sign up failed");
      }
    }catch(e){setAuthError("Connection error");}
    setAuthLoading(false);
  };

  const handleSignOut=async()=>{
    if(authToken) await supabase.signOut(authToken).catch(()=>{});
    localStorage.removeItem("exec_token");
    localStorage.removeItem("exec_refresh");
    setAuthToken(null);setAuthUser(null);setSessionExpired(false);
  };

  const handleCheckout=async(priceId)=>{
    if(!authUser){setShowAuth(true);return;}
    setUpgradeLoading(true);
    try{
      const r=await fetch(API_BASE+"/api/stripe-create-checkout",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+authToken},body:JSON.stringify({priceId,mode:"subscription"})});
      const d=await r.json();
      if(d.url)window.location.href=d.url;
    }catch(e){console.error("Checkout error:",e);}
    setUpgradeLoading(false);
  };

  // Native iOS purchase via Apple In-App Purchase (RevenueCat). packageId
  // is a RevenueCat package identifier - "$rc_monthly" or "$rc_annual".
  const handleNativePurchase=async(packageId)=>{
    if(!authUser){setShowAuth(true);return;}
    setUpgradeLoading(true);
    try{
      const offerings=await Purchases.getOfferings();
      const pkg=offerings?.current?.availablePackages?.find(p=>p.identifier===packageId);
      if(!pkg){
        console.error("RevenueCat package not found:",packageId);
        setUpgradeLoading(false);
        return;
      }
      const{customerInfo}=await Purchases.purchasePackage({aPackage:pkg});
      if(customerInfo?.entitlements?.active?.[RC_ENTITLEMENT_ID]){
        // Unlock immediately in this session rather than waiting on the
        // webhook round-trip to Supabase (which still happens in the
        // background and is what persists status for future sessions and
        // server-side checks like api/claude.js).
        setSubscription(s=>({...(s||{}),status:"active",provider:"revenuecat"}));
        setShowUpgrade(false);
      }
    }catch(e){
      // User cancelling the purchase sheet also lands here - not a real error
      if(!e?.userCancelled)console.error("Native purchase error:",e);
    }
    setUpgradeLoading(false);
  };

  const handleRestorePurchases=async()=>{
    setUpgradeLoading(true);
    try{
      const{customerInfo}=await Purchases.restorePurchases();
      if(customerInfo?.entitlements?.active?.[RC_ENTITLEMENT_ID]){
        setSubscription(s=>({...(s||{}),status:"active",provider:"revenuecat"}));
        setShowUpgrade(false);
      }
    }catch(e){console.error("Restore purchases error:",e);}
    setUpgradeLoading(false);
  };

  const handlePortal=async()=>{
    // Apple IAP subscribers manage their subscription through iOS Settings,
    // not our Stripe billing portal - there's no RevenueCat equivalent API
    // for this, so we open Apple's own subscription management screen.
    if(Capacitor.isNativePlatform()&&subscription?.provider==="revenuecat"){
      window.open("https://apps.apple.com/account/subscriptions","_blank");
      return;
    }
    if(!subscription?.stripe_customer_id)return;
    try{
      const r=await fetch(API_BASE+"/api/stripe-portal",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+authToken}});
      const d=await r.json();
      if(d.url)window.location.href=d.url;
    }catch(e){console.error("Portal error:",e);}
  };

  const handleReset=()=>{
    localStorage.removeItem(SK);
    setProfile(null);setTasks(D_TASKS);setGoals(D_GOALS);setCompleted([]);
    setSupplements(D_SUPPS);setWorkouts([]);setTransactions([]);setJournal([]);
    setBooks(D_BOOKS);setBills([]);setHistory({});setBodyLog([]);
    setSeenMilestones([]);setHabits(D_HABITS);setHabitLog({});setHoldings([]);
    setCryptoHoldings([]);setCommodityHoldings([]);setAltAssets([]);setSuperLog([]);setBudgets({});setAdvisorMessages([]);
    setShowSetup(true);
    setPage("dashboard");
  };

  const t=T();
  const activeProfile=profile||DEMO;
  if(activeProfile.locale)_locale=activeProfile.locale;
  const liveShareValue=holdings.length>0&&portfolio.totalValue>0?portfolio.totalValue:parseFloat(activeProfile.shareValue)||0;
  const liveCryptoValue=(cryptoHoldings||[]).length>0&&cryptoPortfolio.totalValue>0?cryptoPortfolio.totalValue:parseFloat(activeProfile.cryptoValue)||0;
  const liveCommodityValue=(commodityHoldings||[]).length>0&&commodityPortfolio.totalValue>0?commodityPortfolio.totalValue:0;
  const liveAltValue=(altAssets||[]).reduce((s,a)=>s+(parseFloat(a.currentValue)||0),0);
  const liveAssets=(parseFloat(activeProfile?.propertyValue)||0)+(parseFloat(activeProfile?.cashSavings)||0)+(parseFloat(activeProfile?.superBalance)||0)+liveCryptoValue+liveShareValue+liveCommodityValue+liveAltValue;
  const hasLiveData=(holdings.length>0&&portfolio.totalValue>0)||(cryptoHoldings.length>0&&cryptoPortfolio.totalValue>0)||(commodityHoldings.length>0&&commodityPortfolio.totalValue>0)||((altAssets||[]).length>0);
  const liveDebtTotal=debts?.length?debts.reduce((s,d)=>s+Math.max(parseFloat(d.balance)||0,0),0):null;
  const effectiveTotalDebt=liveDebtTotal!==null?Math.round(liveDebtTotal):(parseFloat(activeProfile?.totalDebt)||0);
  const liveProfile=activeProfile?(hasLiveData
    ?{...activeProfile,shareValue:liveShareValue,cryptoValue:liveCryptoValue,totalAssets:liveAssets,totalDebt:effectiveTotalDebt,netWorth:liveAssets-effectiveTotalDebt}
    :{...activeProfile,totalDebt:effectiveTotalDebt,netWorth:(parseFloat(activeProfile.totalAssets)||0)-effectiveTotalDebt}
  ):activeProfile;
  const nwHistoryFull={...nwHistory,[monthStr()]:liveProfile?.netWorth||0};
  const savedLabel=lastSaved&&Date.now()-lastSaved<4000?"Saved":"";
  const pg={profile:liveProfile,tasks,setTasks,goals,setGoals,completed,setCompleted,supplements,setSupplements,workouts,setWorkouts,transactions,setTransactions,journal,setJournal,books,setBooks,bills,setBills,history,bodyLog,setBodyLog,habits,setHabits,habitLog,setHabitLog,holdings,setHoldings,portfolio,cryptoHoldings,setCryptoHoldings,cryptoPortfolio,commodityHoldings,setCommodityHoldings,commodityPortfolio,altAssets,setAltAssets,budgets,setBudgets,setPage,streak,market,nwHistory:nwHistoryFull,setShowBriefing,setShowRecalibrate,syncing,isOnline,pendingSave,authUser,setShowAuth,marketTickers,setMarketTickers,subscription,setShowUpgrade};

  return (
    <div style={{display:"flex",minHeight:"100vh",background:bgPhoto&&bgPhoto!=="none"?"#080808":t.BG,color:t.TEXT,position:"relative",zIndex:1}}>
      <BgPhotoLayer photoId={bgPhoto}/>
      <style>{`@keyframes shimmer{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
      <style>{"*{box-sizing:border-box;margin:0;padding:0;} html,body,#root{width:100%;min-height:100vh;} ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-thumb{background:"+t.BORDER2+";border-radius:2px;} @keyframes sk{0%,100%{opacity:.4}50%{opacity:.8}} button:hover{opacity:.85;} input::placeholder,textarea::placeholder{color:"+t.MUTED2+";} @media(max-width:767px){[data-page]{max-width:100%!important;margin:0!important;} body,#root{overflow-x:hidden;}}"}</style>
      {showUpgrade&&<UpgradeModal onClose={()=>setShowUpgrade(false)} onCheckout={handleCheckout} onNativePurchase={handleNativePurchase} onRestorePurchases={handleRestorePurchases} loading={upgradeLoading}/>}
      {sessionExpired&&(
        <div style={{background:t.GOLD+"18",borderBottom:"1px solid "+t.GOLD+"44",padding:"7px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:11,color:t.GOLD,fontFamily:"'Montserrat',sans-serif"}}>Session expired - changes saved locally but not syncing</div>
          <button onClick={()=>{setSessionExpired(false);setShowAuth(true);}} style={{background:t.GOLD,border:"none",borderRadius:5,padding:"4px 10px",color:"#080808",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:700}}>Reconnect</button>
        </div>
      )}
      {celebration&&<MilestoneCelebration milestone={celebration} onClose={()=>setCelebration(null)}/>}
      {showBriefing&&<MorningBriefing profile={liveProfile} tasks={tasks} onClose={()=>setShowBriefing(false)}/>}
      {showRecalibrate&&<RecalibrateModal profile={activeProfile} onSave={p=>{setProfile(p);setShowRecalibrate(false);}} onClose={()=>setShowRecalibrate(false)}/>}
      {showAuth&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:t.CARD,border:"1px solid "+t.GOLD+"44",borderRadius:14,maxWidth:380,width:"100%",padding:28}}>
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:4}}>The Executive</div>
            <div style={{fontSize:22,color:t.TEXT,marginBottom:6}}>{authMode==="signin"?"Sign In":"Create Account"}</div>
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:20}}>{authMode==="signin"?"Your data syncs across all devices":"Free account - your data stays private"}</div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
              <input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="Email address" style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"10px 12px",color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"}}/>
              <input type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(authMode==="signin"?handleSignIn():handleSignUp())} placeholder="Password (min 6 chars)" style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"10px 12px",color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"}}/>
            </div>
            {authError&&<div style={{fontSize:11,color:authError.includes("created")?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif",marginBottom:12,padding:"7px 10px",background:authError.includes("created")?t.GREEN+"14":t.RED+"14",borderRadius:6}}>{authError}</div>}
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <Btn onClick={authMode==="signin"?handleSignIn:handleSignUp} disabled={authLoading} style={{width:"100%",padding:"12px",fontSize:12}}>
                {authLoading?(authMode==="signin"?"Signing in...":"Creating account..."):(authMode==="signin"?"Sign In":"Create Account")}
              </Btn>
              <button onClick={()=>{setAuthMode(m=>m==="signin"?"signup":"signin");setAuthError("");}} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12,textDecoration:"underline",padding:"4px 0"}}>
                {authMode==="signin"?"No account? Create one free":"Already have an account? Sign in"}
              </button>
              <button onClick={()=>setShowAuth(false)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,opacity:.6}}>Continue without account</button>
            </div>
          </div>
        </div>
      )}
      <Sidebar page={page} setPage={setPage} profile={activeProfile} theme={theme} setTheme={setTheme} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} savedLabel={savedLabel} authUser={authUser} setShowAuth={setShowAuth}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,width:isMobile?"100%":"auto"}}>
        {!profile&&(isMobile?(
          <div style={{margin:"0 14px",marginTop:"calc(14px + env(safe-area-inset-top))",background:t.GOLD+"14",border:"1px solid "+t.GOLD+"44",borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:11,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>Demo Mode</div>
              <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>Tap to set up your profile</div>
            </div>
            <button onClick={()=>setPage("profile")} style={{background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:8,padding:"8px 14px",color:"#080808",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,flexShrink:0}}>Set Up</button>
          </div>
        ):(
          <div style={{background:t.GOLD+"14",borderBottom:"1px solid "+t.GOLD+"33",padding:"7px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:11,color:t.GOLD,fontFamily:"'Montserrat',sans-serif"}}>Demo Mode - William Sterling</div>
            <button onClick={()=>setShowSetup(true)} style={{background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:6,padding:"4px 12px",color:"#080808",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:700}}>Set Up Profile</button>
          </div>
        ))}
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",alignItems:isMobile?"stretch":"center",minHeight:"100vh",background:"transparent",position:"relative",zIndex:1,transform:"translateZ(0)"}}>
          <div style={{width:"100%",maxWidth:isMobile?undefined:1100,padding:isMobile?"12px 12px":"28px 32px",flex:1,paddingTop:isMobile?"calc(16px + env(safe-area-inset-top))":"calc(28px + env(safe-area-inset-top))",paddingBottom:isMobile?"calc(16px + env(safe-area-inset-bottom) + 70px)":"28px",boxSizing:"border-box"}}>
          {page==="search"&&<SearchPage tasks={tasks} goals={goals} journal={journal} books={books} workouts={workouts} recipes={[]} setPage={setPage}/>}
          {page==="dashboard"&&<DashboardPage {...pg} transactions={transactions} isMobile={isMobile}/>}
          {page==="tasks"&&<TasksPage tasks={tasks} setTasks={setTasks}/>}
          {page==="habits"&&<HabitsPage habits={habits} setHabits={setHabits} habitLog={habitLog} setHabitLog={setHabitLog}/>}
          {page==="goals"&&<GoalsPage goals={goals} setGoals={setGoals} completed={completed} setCompleted={setCompleted} profile={liveProfile} subscription={subscription} setShowUpgrade={setShowUpgrade} authToken={authToken}/>}
          {page==="journal"&&<JournalPage entries={journal} setEntries={setJournal}/>}
          {["habits","goals","journal"].includes(page)&&!isPro(subscription)&&<UpgradeHint onUpgrade={()=>setShowUpgrade(true)} hint={page==="goals"?"Unlock AI goal suggestions & checkpoint analysis →":page==="journal"?"Unlock AI weekly review of your journal entries →":"Unlock AI habit coaching & weekly performance review →"}/>}
          {page==="wealth"&&<WealthPage profile={liveProfile} onUpdateProfile={setProfile} nwHistory={nwHistoryFull} setShowRecalibrate={()=>setShowRecalibrate(true)} holdings={holdings} setHoldings={setHoldings} portfolio={portfolio} cryptoHoldings={cryptoHoldings} setCryptoHoldings={setCryptoHoldings} cryptoPortfolio={cryptoPortfolio} commodityHoldings={commodityHoldings} setCommodityHoldings={setCommodityHoldings} commodityPortfolio={commodityPortfolio} altAssets={altAssets} setAltAssets={setAltAssets} superLog={superLog} setSuperLog={setSuperLog}/>}
          {page==="projector"&&<ProjectorPage profile={liveProfile}/>}
          {page==="cashflow"&&<CashFlowPage transactions={transactions} setTransactions={setTransactions} subscription={subscription} setShowUpgrade={setShowUpgrade} authToken={authToken}/>}
          {page==="cashflow"&&!isPro(subscription)&&<UpgradeHint onUpgrade={()=>setShowUpgrade(true)} hint="Unlock AI bank statement import — auto-categorise transactions from a PDF →"/>}
          {page==="bills"&&<BillsPage bills={bills} setBills={setBills}/>}
          {page==="budget"&&<BudgetPage transactions={transactions} budgets={budgets} setBudgets={setBudgets}/>}
          {page==="debt"&&<DebtPage profile={liveProfile} setProfile={setProfile} debts={debts} setDebts={setDebts} subscription={subscription} setShowUpgrade={setShowUpgrade}/>}
          {page==="invest"&&(isFeatureLocked("invest",subscription)?<PaywallPage onUpgrade={()=>setShowUpgrade(true)} feature="invest"/>:<InvestPage profile={liveProfile} subscription={subscription} setShowUpgrade={setShowUpgrade}/>)}
          {page==="dividends"&&<DividendPage holdings={holdings} cryptoHoldings={cryptoHoldings} portfolio={portfolio}/>}
          {page==="tax"&&(isFeatureLocked("tax",subscription)?<PaywallPage onUpgrade={()=>setShowUpgrade(true)} feature="tax"/>:<TaxPage profile={liveProfile} transactions={transactions} deductions={taxDeductions} setDeductions={setTaxDeductions}/>)}
          {page==="news"&&<NewsPage/>}
          {page==="recipes"&&<RecipesPage profile={liveProfile} subscription={subscription} setShowUpgrade={setShowUpgrade} authToken={authToken}/> }
          {page==="health"&&<HealthPage profile={liveProfile} supplements={supplements} setSupplements={setSupplements} bodyLog={bodyLog} setPage={setPage} subscription={subscription} setShowUpgrade={setShowUpgrade} authToken={authToken}/>}
          {page==="body"&&<BodyPage bodyLog={bodyLog} setBodyLog={setBodyLog} profile={liveProfile}/>}
          {page==="workout"&&<WorkoutPage workouts={workouts} setWorkouts={setWorkouts} profile={liveProfile} subscription={subscription} setShowUpgrade={setShowUpgrade} authToken={authToken}/>}
          {page==="reading"&&<ReadingPage books={books} setBooks={setBooks} readingGoal={readingGoal} setReadingGoal={setReadingGoal}/>}
          {["body","workout","reading"].includes(page)&&!isPro(subscription)&&<UpgradeHint onUpgrade={()=>setShowUpgrade(true)} hint={page==="workout"?"Unlock AI workout plan generation & performance analysis →":page==="reading"?"Unlock AI book summaries & reading insights →":"Unlock AI body composition analysis & recommendations →"}/>}
          {page==="weekly"&&<WeeklyPage profile={liveProfile} tasks={tasks} goals={goals} habits={habits} habitLog={habitLog} history={history} journal={journal} workouts={workouts} supplements={supplements} bodyLog={bodyLog} weeklyReflections={weeklyReflections} setWeeklyReflections={setWeeklyReflections} subscription={subscription} setShowUpgrade={setShowUpgrade} authToken={authToken}/>}
          {page==="learn"&&(isFeatureLocked("learn",subscription)?<PaywallPage onUpgrade={()=>setShowUpgrade(true)} feature="learn"/>:<LearnPage profile={liveProfile} goals={goals} habits={habits} learnData={learnData} setLearnData={setLearnData}/>)}
          {page==="notes"&&<NotesPage notes={notes} setNotes={setNotes}/>}
          {page==="services"&&(isFeatureLocked("services",subscription)?<PaywallPage onUpgrade={()=>setShowUpgrade(true)} feature="services"/>:<ServicesPage services={services} setServices={setServices}/>)}
          {page==="advisor"&&(isFeatureLocked("advisor",subscription)?<PaywallPage onUpgrade={()=>setShowUpgrade(true)} feature="advisor"/>:<AdvisorPage profile={liveProfile} tasks={tasks} goals={goals} supplements={supplements} habits={habits} habitLog={habitLog} messages={advisorMessages} setMessages={setAdvisorMessages}/>)}
          {page==="profile"&&<ProfilePage profile={activeProfile} setProfile={setProfile} onReset={handleReset} onRecalibrate={()=>setShowRecalibrate(true)} theme={theme} setTheme={setTheme} bgPhoto={bgPhoto} setBgPhotoId={setBgPhotoId} nwHistory={nwHistoryFull} tasks={tasks} goals={goals} workouts={workouts} transactions={transactions} journal={journal} authUser={authUser} authToken={authToken} handleSignOut={handleSignOut} setShowAuth={setShowAuth} subscription={subscription} onUpgrade={()=>setShowUpgrade(true)} handlePortal={handlePortal}/>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Root(){
  return (
    <ErrorBoundary>
      <App/>
    </ErrorBoundary>
  );
}
