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
  obsidian:{BG:"#080808",CARD:"#111111",CARD2:"#181818",BORDER:"#1E1E1E",BORDER2:"#2A2A2A",TEXT:"#E4DDD0",MUTED:"#8C7F69",MUTED2:"#3A3028",GOLD:"#C9A84C",GL:"#E8C96A",RED:"#C97E7E",GREEN:"#7A9E7E",BLUE:"#7EB8C9",PURPLE:"#B07EC9"},
  charcoal:{BG:"#141414",CARD:"#1E1E1E",CARD2:"#252525",BORDER:"#2E2E2E",BORDER2:"#383838",TEXT:"#E0E0E0",MUTED:"#8C8C8C",MUTED2:"#404040",GOLD:"#BFBFBF",GL:"#D8D8D8",RED:"#C07070",GREEN:"#70A870",BLUE:"#70A8C0",PURPLE:"#A070C0"},
  parchment:{BG:"#F5F0E8",CARD:"#FFFDF8",CARD2:"#F0EBE0",BORDER:"#E5DDD0",BORDER2:"#D5C8B8",TEXT:"#1A1208",MUTED:"#766852",MUTED2:"#C5B8A0",GOLD:"#A07830",GL:"#C9A84C",RED:"#A05050",GREEN:"#507850",BLUE:"#507890",PURPLE:"#805090"},
  minimal:{BG:"#FFFFFF",CARD:"#F7F7F7",CARD2:"#EFEFEF",BORDER:"#E8E8E8",BORDER2:"#D8D8D8",TEXT:"#111111",MUTED:"#6C6C6C",MUTED2:"#C8C8C8",GOLD:"#222222",GL:"#555555",RED:"#C0392B",GREEN:"#2A7A2A",BLUE:"#1A5A9A",PURPLE:"#6A3A9A"}
};

const THEME_ALIASES={dark:"obsidian",light:"parchment"};
const BG_PHOTOS=[
  {id:"none",label:"None",url:null,thumb:null,anim:"kb-zoom"},
  {id:"bg1",label:"Private Library",url:"/bg/bg1.jpg",thumb:"/bg/bg1-thumb.jpg",anim:"kb-zoom"},
  {id:"bg2",label:"Penthouse Skyline",url:"/bg/bg2.jpg",thumb:"/bg/bg2-thumb.jpg",anim:"kb-drift"},
  {id:"bg3",label:"Black Marble",url:"/bg/bg3.jpg",thumb:"/bg/bg3-thumb.jpg",anim:"kb-breathe"},
  {id:"bg4",label:"The King",url:"/bg/bg4.jpg",thumb:"/bg/bg4-thumb.jpg",anim:"kb-zoom"},
  {id:"bg5",label:"Private Jet",url:"/bg/bg5.jpg",thumb:"/bg/bg5-thumb.jpg",anim:"kb-pan"},
  {id:"bg6",label:"The Desk",url:"/bg/bg6.jpg",thumb:"/bg/bg6-thumb.jpg",anim:"kb-breathe"},
  {id:"bg7",label:"Coastal Estate",url:"/bg/bg7.jpg",thumb:"/bg/bg7-thumb.jpg",anim:"kb-drift"},
  {id:"bg8",label:"Wine Cellar",url:"/bg/bg8.jpg",thumb:"/bg/bg8-thumb.jpg",anim:"kb-zoom"},
];
let _themeKey=(()=>{
  // Default to system preference on first load
  return "obsidian"; // brand look for everyone; Charcoal stays available in settings
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
// Remembers the last cloud blob per user so saves never drop keys
// that this app version doesn't know about (web vs iOS version drift).
let _cloudBase={uid:null,data:{}};
const rememberCloud=(uid,d)=>{if(uid&&d&&typeof d==="object")_cloudBase={uid,data:d};};
const withCloudBase=(uid,d)=>(_cloudBase.uid===uid?{..._cloudBase.data,...d}:d);
const supabase={
  async signUp(email,password){const r=await fetch(SUPABASE_URL+"/auth/v1/signup",{method:"POST",headers:sbH(),body:JSON.stringify({email,password})});return r.json();},
  async signIn(email,password){const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:sbH(),body:JSON.stringify({email,password})});return r.json();},
  async refresh(refreshToken){const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:sbH(),body:JSON.stringify({refresh_token:refreshToken})});return r.json();},
  async signOut(token){await fetch(SUPABASE_URL+"/auth/v1/logout",{method:"POST",headers:sbH(token)});},
  async getUser(token){const r=await fetch(SUPABASE_URL+"/auth/v1/user",{headers:sbH(token)});return r.json();},
  async load(userId,token){const r=await fetch(SUPABASE_URL+"/rest/v1/user_data?user_id=eq."+userId+"&select=data",{headers:sbH(token)});const rows=await r.json();const d=rows&&rows[0]?rows[0].data:null;rememberCloud(userId,d);return d;},
  async save(userId,token,data){const merged=withCloudBase(userId,data);const r=await fetch(SUPABASE_URL+"/rest/v1/user_data",{method:"POST",headers:{...sbH(token),"Prefer":"resolution=merge-duplicates"},body:JSON.stringify({user_id:userId,data:merged,updated_at:new Date().toISOString()})});if(!r.ok){const err=await r.json().catch(()=>({}));throw new Error("Save failed: "+r.status+" "+JSON.stringify(err));}rememberCloud(userId,merged);return r;},
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
const isFeatureLocked=(page,sub)=>PRO_FEATURES.includes(page)&&!isPro(sub)&&!(typeof _isDemo!=="undefined"&&_isDemo&&page!=="advisor");

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
function advanceDate(ds,freq,anchorDay){
  const d=new Date(ds+"T12:00:00");
  if(freq==="weekly"){d.setDate(d.getDate()+7);}
  else if(freq==="fortnightly"){d.setDate(d.getDate()+14);}
  else{
    // Monthly-style: keep the same day of month, clamped to short months (31 Jan -> 28 Feb -> 31 Mar)
    const add=freq==="quarterly"?3:freq==="annually"?12:1;
    const want=anchorDay||d.getDate();
    const y=d.getFullYear(),m=d.getMonth()+add;
    const dim=new Date(y,m+1,0).getDate();
    const nd=new Date(y,m,Math.min(want,dim),12);
    return nd.getFullYear()+"-"+String(nd.getMonth()+1).padStart(2,"0")+"-"+String(nd.getDate()).padStart(2,"0");
  }
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
// Days of interest per repayment period
const DEBT_PERIOD_DAYS={weekly:7,fortnightly:14,monthly:365/12,quarterly:365/4,annually:365};
const sortPaymentsDesc=ps=>[...(ps||[])].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
// Records every scheduled repayment that has fallen due, splitting each one into
// interest (charged at the loan's rate for that period) and principal. Only the
// principal reduces the balance - the same as a real loan statement.
// ---- Property <-> Debt tab links ----
const idEq=(a,b)=>String(a)===String(b);
// Debt tab loans linked to a property
function linkedLoans(p,debts){const ids=(p&&p.linkedDebtIds)||[];return (debts||[]).filter(d=>ids.some(x=>idEq(x,d.id)));}
// What's owed on a property: its linked loans if any, otherwise its own mortgage field
function propertyLoanBalance(p,debts){const l=linkedLoans(p,debts);return l.length?l.reduce((s,d)=>s+Math.max(parseFloat(d.balance)||0,0),0):(parseFloat(p&&p.mortgageBalance)||0);}
// Property mortgages NOT on the Debt tab (net worth adds these separately)
function unlinkedPropertyDebt(properties,debts){return (properties||[]).reduce((s,p)=>s+(linkedLoans(p,debts).length?0:(parseFloat(p.mortgageBalance)||0)),0);}
const LOAN_PER_YEAR={weekly:52,fortnightly:26,monthly:12,quarterly:4,annually:1};
const FREQ_SHORT={weekly:"/wk",fortnightly:"/fn",monthly:"/mo",quarterly:"/qtr",annually:"/yr"};
const loanAnnualRepayment=d=>(parseFloat(d.minPayment)||0)*(LOAN_PER_YEAR[d.frequency||"monthly"]||12);
// Debts still held on the profile from before the Debt tab existed
function legacyProfileDebts(profile){
  return [{k:"mortgageDebt",name:"Mortgage",type:"Mortgage"},{k:"investLoanDebt",name:"Investment Loan",type:"Investment Loan"},{k:"carDebt",name:"Car Finance",type:"Car Finance"},{k:"creditCardDebt",name:"Credit Card",type:"Credit Card"},{k:"personalDebt",name:"Personal Loan",type:"Personal Loan"}]
    .filter(d=>parseFloat((profile||{})[d.k])>0)
    .map(d=>({id:d.k,name:d.name,type:d.type,balance:parseFloat(profile[d.k]),rate:"",minPayment:"",startDate:"",endDate:"",lender:"",notes:"",payments:[],originalBalance:parseFloat(profile[d.k])}));
}
function applyScheduledRepayments(d,today){
  const payment=parseFloat(d.minPayment)||0;
  let bal=parseFloat(d.balance)||0;
  if(!d.nextPaymentDate||d.nextPaymentDate>today||payment<=0||bal<=0)return d;
  const freq=d.frequency||"monthly";
  const rate=parseFloat(d.rate)||0;
  const offset=parseFloat(d.offsetBalance)||0;
  const anchor=d.payDay||parseInt(String(d.nextPaymentDate).slice(8,10),10)||1;
  let next=d.nextPaymentDate;
  const added=[];let safety=0;
  while(next<=today&&bal>0&&safety<120){
    const interest=Math.round(Math.max(bal-offset,0)*(rate/100)*((DEBT_PERIOD_DAYS[freq]||365/12)/365)*100)/100;
    const principal=Math.round(Math.max(Math.min(payment-interest,bal),0)*100)/100;
    bal=Math.round((bal-principal)*100)/100;
    added.push({id:"auto_"+next,date:next,amount:Math.round(Math.min(payment,principal+interest)*100)/100,interest,principal,balance:bal,auto:true});
    next=advanceDate(next,freq,anchor);
    safety++;
  }
  if(!added.length)return d;
  return{...d,balance:bal,nextPaymentDate:next,payDay:anchor,payments:sortPaymentsDesc([...added,...(d.payments||[])]).slice(0,120)};
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
// Local-time date helpers: always use the device's own time zone, never UTC
const localDateStr=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const daysAgoStr=n=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-n);return localDateStr(d);};
const parseLocalDate=s=>new Date(typeof s==="string"&&s.length===10?s+"T12:00:00":s);
const monthStr=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");};
const calcAge=dob=>{if(!dob)return null;const d=parseLocalDate(dob),now=new Date();let age=now.getFullYear()-d.getFullYear();if(now.getMonth()<d.getMonth()||(now.getMonth()===d.getMonth()&&now.getDate()<d.getDate()))age--;return age;};
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
  ["dashboard","layout-dashboard","Dashboard"],["tasks","list-checks","Tasks"],["habits","flame","Habits"],
  ["goals","target","Goals"],["journal","notebook-pen","Journal"],["reading","book-open","Reading"],
  ["wealth","gem","Wealth"],["property","building-2","Property"],["cashflow","arrow-left-right","Cash Flow"],
  ["bills","receipt","Bills"],
  ["budget","chart-pie","Budget"],["debt","trending-down","Debt"],
  ["invest","chart-candlestick","Invest"],["projector","telescope","Forecast"],["dividends","coins","Dividends"],["tax","calculator","Tax"],["news","newspaper","News"],["health","heart-pulse","Health"],["body","scale","Body"],
  ["workout","dumbbell","Workout"],["weekly","calendar-range","Weekly"],["calendar","calendar-days","Calendar"],["advisor","sparkles","Executive AI"],
  ["learn","graduation-cap","Learn"],["notes","sticky-note","Notes"],["services","briefcase","Services"],
  ["profile","user-round","Profile"]
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

// POLISH_OCT_V1: shared helpers
// LINE_ICONS_V1: line icons from Lucide (lucide.dev, ISC licence)
const ICONS={"layout-dashboard":"<rect width=\"7\" height=\"9\" x=\"3\" y=\"3\" rx=\"1\" /><rect width=\"7\" height=\"5\" x=\"14\" y=\"3\" rx=\"1\" /><rect width=\"7\" height=\"9\" x=\"14\" y=\"12\" rx=\"1\" /><rect width=\"7\" height=\"5\" x=\"3\" y=\"16\" rx=\"1\" />","list-checks":"<path d=\"M13 5h8\" /><path d=\"M13 12h8\" /><path d=\"M13 19h8\" /><path d=\"m3 17 2 2 4-4\" /><path d=\"m3 7 2 2 4-4\" />","flame":"<path d=\"M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4\" />","target":"<circle cx=\"12\" cy=\"12\" r=\"10\" /><circle cx=\"12\" cy=\"12\" r=\"6\" /><circle cx=\"12\" cy=\"12\" r=\"2\" />","notebook-pen":"<path d=\"M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4\" /><path d=\"M2 6h4\" /><path d=\"M2 10h4\" /><path d=\"M2 14h4\" /><path d=\"M2 18h4\" /><path d=\"M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z\" />","book-open":"<path d=\"M12 5v16\" /><path d=\"M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z\" />","gem":"<path d=\"M10.5 3 8 9l4 13 4-13-2.5-6\" /><path d=\"M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z\" /><path d=\"M2 9h20\" />","building-2":"<path d=\"M10 12h4\" /><path d=\"M10 8h4\" /><path d=\"M14 21v-3a2 2 0 0 0-4 0v3\" /><path d=\"M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2\" /><path d=\"M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16\" />","arrow-left-right":"<path d=\"M8 3 4 7l4 4\" /><path d=\"M4 7h16\" /><path d=\"m16 21 4-4-4-4\" /><path d=\"M20 17H4\" />","receipt":"<path d=\"M12 17V7\" /><path d=\"M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8\" /><path d=\"M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z\" />","chart-pie":"<path d=\"M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z\" /><path d=\"M21.21 15.89A10 10 0 1 1 8 2.83\" />","trending-down":"<path d=\"M16 17h6v-6\" /><path d=\"m22 17-8.5-8.5-5 5L2 7\" />","chart-candlestick":"<path d=\"M9 5v4\" /><rect width=\"4\" height=\"6\" x=\"7\" y=\"9\" rx=\"1\" /><path d=\"M9 15v2\" /><path d=\"M17 3v2\" /><rect width=\"4\" height=\"8\" x=\"15\" y=\"5\" rx=\"1\" /><path d=\"M17 13v3\" /><path d=\"M3 3v16a2 2 0 0 0 2 2h16\" />","telescope":"<path d=\"m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44\" /><path d=\"m13.56 11.747 4.332-.924\" /><path d=\"m16 21-3.105-6.21\" /><path d=\"M16.485 5.94a2 2 0 0 1 1.455-2.425l1.09-.272a1 1 0 0 1 1.212.727l1.515 6.06a1 1 0 0 1-.727 1.213l-1.09.272a2 2 0 0 1-2.425-1.455z\" /><path d=\"m6.158 8.633 1.114 4.456\" /><path d=\"m8 21 3.105-6.21\" /><circle cx=\"12\" cy=\"13\" r=\"2\" />","coins":"<path d=\"M13.744 17.736a6 6 0 1 1-7.48-7.48\" /><path d=\"M15 6h1v4\" /><path d=\"m6.134 14.768.866-.5 2 3.464\" /><circle cx=\"16\" cy=\"8\" r=\"6\" />","calculator":"<rect width=\"16\" height=\"20\" x=\"4\" y=\"2\" rx=\"2\" /><line x1=\"8\" x2=\"16\" y1=\"6\" y2=\"6\" /><line x1=\"16\" x2=\"16\" y1=\"14\" y2=\"18\" /><path d=\"M16 10h.01\" /><path d=\"M12 10h.01\" /><path d=\"M8 10h.01\" /><path d=\"M12 14h.01\" /><path d=\"M8 14h.01\" /><path d=\"M12 18h.01\" /><path d=\"M8 18h.01\" />","newspaper":"<path d=\"M15 18h-5\" /><path d=\"M18 14h-8\" /><path d=\"M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2\" /><rect width=\"8\" height=\"4\" x=\"10\" y=\"6\" rx=\"1\" />","heart-pulse":"<path d=\"M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5\" /><path d=\"M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27\" />","scale":"<path d=\"M12 3v18\" /><path d=\"m19 8 3 8a5 5 0 0 1-6 0zV7\" /><path d=\"M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1\" /><path d=\"m5 8 3 8a5 5 0 0 1-6 0zV7\" /><path d=\"M7 21h10\" />","dumbbell":"<path d=\"M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z\" /><path d=\"m2.5 21.5 1.4-1.4\" /><path d=\"m20.1 3.9 1.4-1.4\" /><path d=\"M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z\" /><path d=\"m9.6 14.4 4.8-4.8\" />","calendar-range":"<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" /><path d=\"M16 2v3\" /><path d=\"M3 9h18\" /><path d=\"M8 2v3\" /><path d=\"M17 13h-6\" /><path d=\"M13 17H7\" /><path d=\"M7 13h.01\" /><path d=\"M17 17h.01\" />","calendar-days":"<path d=\"M8 2v3\" /><path d=\"M16 2v3\" /><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" /><path d=\"M3 9h18\" /><path d=\"M8 13h.01\" /><path d=\"M12 13h.01\" /><path d=\"M16 13h.01\" /><path d=\"M8 17h.01\" /><path d=\"M12 17h.01\" /><path d=\"M16 17h.01\" />","sparkles":"<path d=\"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z\" /><path d=\"M20 2v4\" /><path d=\"M22 4h-4\" /><circle cx=\"4\" cy=\"20\" r=\"2\" />","graduation-cap":"<path d=\"M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z\" /><path d=\"M22 10v6\" /><path d=\"M6 12.5V16a6 3 0 0 0 12 0v-3.5\" />","sticky-note":"<path d=\"M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z\" /><path d=\"M15 3v5a1 1 0 0 0 1 1h5\" />","briefcase":"<path d=\"M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16\" /><rect width=\"20\" height=\"14\" x=\"2\" y=\"6\" rx=\"2\" />","user-round":"<circle cx=\"12\" cy=\"8\" r=\"5\" /><path d=\"M20 21a8 8 0 0 0-16 0\" />","menu":"<path d=\"M4 5h16\" /><path d=\"M4 12h16\" /><path d=\"M4 19h16\" />","x":"<path d=\"M18 6 6 18\" /><path d=\"m6 6 12 12\" />","refresh-cw":"<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\" /><path d=\"M21 3v5h-5\" /><path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\" /><path d=\"M8 16H3v5\" />","panel-left":"<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" /><path d=\"M9 3v18\" />","search":"<path d=\"m21 21-4.34-4.34\" /><circle cx=\"11\" cy=\"11\" r=\"8\" />","sunrise":"<path d=\"M12 2v8\" /><path d=\"m4.93 10.93 1.41 1.41\" /><path d=\"M2 18h2\" /><path d=\"M20 18h2\" /><path d=\"m19.07 10.93-1.41 1.41\" /><path d=\"M22 22H2\" /><path d=\"m8 6 4-4 4 4\" /><path d=\"M16 18a4 4 0 0 0-8 0\" />","moon":"<path d=\"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401\" />","sun":"<circle cx=\"12\" cy=\"12\" r=\"4\" /><path d=\"M12 2v2\" /><path d=\"M12 20v2\" /><path d=\"m4.93 4.93 1.41 1.41\" /><path d=\"m17.66 17.66 1.41 1.41\" /><path d=\"M2 12h2\" /><path d=\"M20 12h2\" /><path d=\"m6.34 17.66-1.41 1.41\" /><path d=\"m19.07 4.93-1.41 1.41\" />","alarm-clock":"<circle cx=\"12\" cy=\"13\" r=\"8\" /><path d=\"M12 9v4l2 2\" /><path d=\"M5 3 2 6\" /><path d=\"m22 6-3-3\" /><path d=\"M6.38 18.7 4 21\" /><path d=\"M17.64 18.67 20 21\" />","bed":"<path d=\"M2 4v16\" /><path d=\"M2 8h18a2 2 0 0 1 2 2v10\" /><path d=\"M2 17h20\" /><path d=\"M6 8v9\" />","droplet":"<path d=\"M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z\" />","snowflake":"<path d=\"m10 20-1.25-2.5L6 18\" /><path d=\"M10 4 8.75 6.5 6 6\" /><path d=\"m14 20 1.25-2.5L18 18\" /><path d=\"m14 4 1.25 2.5L18 6\" /><path d=\"m17 21-3-6h-4\" /><path d=\"m17 3-3 6 1.5 3\" /><path d=\"M2 12h6.5L10 9\" /><path d=\"m20 10-1.5 2 1.5 2\" /><path d=\"M22 12h-6.5L14 15\" /><path d=\"m4 10 1.5 2L4 14\" /><path d=\"m7 21 3-6-1.5-3\" /><path d=\"m7 3 3 6h4\" />","footprints":"<path d=\"M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z\" /><path d=\"M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z\" /><path d=\"M16 17h4\" /><path d=\"M4 13h4\" />","bike":"<circle cx=\"18.5\" cy=\"17.5\" r=\"3.5\" /><circle cx=\"5.5\" cy=\"17.5\" r=\"3.5\" /><circle cx=\"15\" cy=\"5\" r=\"1\" /><path d=\"M12 17.5V14l-3-3 4-3 2 3h2\" />","waves":"<path d=\"M2 12q2.5 2 5 0t5 0 5 0 5 0\" /><path d=\"M2 19q2.5 2 5 0t5 0 5 0 5 0\" /><path d=\"M2 5q2.5 2 5 0t5 0 5 0 5 0\" />","mountain":"<path d=\"m8 3 4 8 5-5 5 15H2L8 3z\" />","apple":"<path d=\"M12 6.528V3a1 1 0 0 1 1-1h0\" /><path d=\"M18.237 21A15 15 0 0 0 22 11a6 6 0 0 0-10-4.472A6 6 0 0 0 2 11a15.1 15.1 0 0 0 3.763 10 3 3 0 0 0 3.648.648 5.5 5.5 0 0 1 5.178 0A3 3 0 0 0 18.237 21\" />","salad":"<path d=\"M7 21h10\" /><path d=\"M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z\" /><path d=\"M11.38 12a2.4 2.4 0 0 1-.4-4.77 2.4 2.4 0 0 1 3.2-2.77 2.4 2.4 0 0 1 3.47-.63 2.4 2.4 0 0 1 3.37 3.37 2.4 2.4 0 0 1-1.1 3.7 2.51 2.51 0 0 1 .03 1.1\" /><path d=\"m13 12 4-4\" /><path d=\"M10.9 7.25A3.99 3.99 0 0 0 4 10c0 .73.2 1.41.54 2\" />","pill":"<path d=\"m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z\" /><path d=\"m8.5 8.5 7 7\" />","glass-water":"<path d=\"M5.116 4.104A1 1 0 0 1 6.11 3h11.78a1 1 0 0 1 .994 1.105L17.19 20.21A2 2 0 0 1 15.2 22H8.8a2 2 0 0 1-2-1.79z\" /><path d=\"M6 12a5 5 0 0 1 6 0 5 5 0 0 0 6 0\" />","coffee":"<path d=\"M10 2v2\" /><path d=\"M14 2v2\" /><path d=\"M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1\" /><path d=\"M6 2v2\" />","cigarette-off":"<path d=\"M12 12H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h13\" /><path d=\"M18 8c0-2.5-2-2.5-2-5\" /><path d=\"m2 2 20 20\" /><path d=\"M21 12a1 1 0 0 1 1 1v2a1 1 0 0 1-.5.866\" /><path d=\"M22 8c0-2.5-2-2.5-2-5\" /><path d=\"M7 12v4\" />","wine-off":"<path d=\"M8 22h8\" /><path d=\"M7 10h3m7 0h-1.343\" /><path d=\"M12 15v7\" /><path d=\"M7.307 7.307A12.33 12.33 0 0 0 7 10a5 5 0 0 0 7.391 4.391M8.638 2.981C8.75 2.668 8.872 2.34 9 2h6c1.5 4 2 6 2 8 0 .407-.05.809-.145 1.198\" /><line x1=\"2\" x2=\"22\" y1=\"2\" y2=\"22\" />","brain":"<path d=\"M12 18V5\" /><path d=\"M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4\" /><path d=\"M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5\" /><path d=\"M17.997 5.125a4 4 0 0 1 2.526 5.77\" /><path d=\"M18 18a4 4 0 0 0 2-7.464\" /><path d=\"M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517\" /><path d=\"M6 18a4 4 0 0 1-2-7.464\" /><path d=\"M6.003 5.125a4 4 0 0 0-2.526 5.77\" />","pen-line":"<path d=\"M13 21h8\" /><path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\" />","lightbulb":"<path d=\"M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5\" /><path d=\"M9 18h6\" /><path d=\"M10 22h4\" />","languages":"<path d=\"m5 8 6 6\" /><path d=\"m4 14 6-6 2-3\" /><path d=\"M2 5h12\" /><path d=\"M7 2h1\" /><path d=\"m22 22-5-10-5 10\" /><path d=\"M14 18h6\" />","music":"<path d=\"M9 18V5l12-2v13\" /><circle cx=\"6\" cy=\"18\" r=\"3\" /><circle cx=\"18\" cy=\"16\" r=\"3\" />","flower-2":"<path d=\"M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1\" /><circle cx=\"12\" cy=\"8\" r=\"2\" /><path d=\"M12 10v12\" /><path d=\"M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z\" /><path d=\"M12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z\" />","leaf":"<path d=\"M11 20a10 10 0 0010-10 25.9 25.9 0 00-1.04-7.281 1 1 0 00-1.755-.325C15.833 5.5 13 5.5 9.8 6.1A7 7 0 0011 20\" /><path d=\"M2 21a5 5 0 012.911-4.544C7.613 15.212 8.351 15.24 11 13\" />","sprout":"<path d=\"M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3\" /><path d=\"M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4\" /><path d=\"M5 21h14\" />","trees":"<path d=\"M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z\" /><path d=\"M7 16v6\" /><path d=\"M13 19v3\" /><path d=\"M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5\" />","smile":"<path d=\"M15 10V9\" /><path d=\"M16.472 15a6 6 0 01-8.943 0\" /><path d=\"M9 10V9\" /><circle cx=\"12\" cy=\"12\" r=\"10\" />","hand-heart":"<path d=\"M11 14h2a2 2 0 0 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16\" /><path d=\"m14.45 13.39 5.05-4.694C20.196 8 21 6.85 21 5.75a2.75 2.75 0 0 0-4.797-1.837.276.276 0 0 1-.406 0A2.75 2.75 0 0 0 11 5.75c0 1.2.802 2.248 1.5 2.946L16 11.95\" /><path d=\"m2 15 6 6\" /><path d=\"m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a1 1 0 0 0-2.75-2.91\" />","phone-off":"<path d=\"M10.1 13.9a14 14 0 0 0 3.732 2.668 1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2 18 18 0 0 1-12.728-5.272\" /><path d=\"M22 2 2 22\" /><path d=\"M4.76 13.582A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 .244.473\" />","piggy-bank":"<path d=\"M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z\" /><path d=\"M16 10h.01\" /><path d=\"M2 8v1a2 2 0 0 0 2 2h1\" />","wallet":"<path d=\"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1\" /><path d=\"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4\" />","users":"<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\" /><path d=\"M16 3.128a4 4 0 0 1 0 7.744\" /><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\" /><circle cx=\"9\" cy=\"7\" r=\"4\" />","timer":"<line x1=\"10\" x2=\"14\" y1=\"2\" y2=\"2\" /><line x1=\"12\" x2=\"15\" y1=\"14\" y2=\"11\" /><circle cx=\"12\" cy=\"14\" r=\"8\" />","shower-head":"<path d=\"m4 4 2.5 2.5\" /><path d=\"M13.5 6.5a4.95 4.95 0 0 0-7 7\" /><path d=\"M15 5 5 15\" /><path d=\"M14 17v.01\" /><path d=\"M10 16v.01\" /><path d=\"M13 13v.01\" /><path d=\"M16 10v.01\" /><path d=\"M11 20v.01\" /><path d=\"M17 14v.01\" /><path d=\"M20 11v.01\" />"};
const Icon=({name,size="1.1em",stroke=1.6,style})=>{const d=ICONS[name];if(!d)return null;return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{display:"block",flexShrink:0,...style}} aria-hidden="true" dangerouslySetInnerHTML={{__html:d}}/>);};
const HABIT_ICON_CHOICES=["flame","sunrise","moon","sun","alarm-clock","bed","shower-head","droplet","glass-water","snowflake","dumbbell","footprints","bike","waves","mountain","heart-pulse","apple","salad","pill","coffee","cigarette-off","wine-off","brain","book-open","pen-line","notebook-pen","target","lightbulb","graduation-cap","languages","music","flower-2","leaf","sprout","trees","smile","hand-heart","phone-off","piggy-bank","wallet","briefcase","users","timer","sparkles"];
const HABIT_EMOJI_TO_ICON={"\u{1F4AA}":"dumbbell","\u{1F3CB}":"dumbbell","\u{1F3C3}":"footprints","\u{1F6B6}":"footprints","\u{1F6B4}":"bike","\u{1F3CA}":"waves","\u{1F30A}":"waves","\u{1F9D8}":"flower-2","\u{1F48A}":"pill","\u{1F957}":"salad","\u{1F966}":"salad","\u{1F4A7}":"droplet","\u{1F34E}":"apple","\u2764":"heart-pulse","\u{1FAC0}":"heart-pulse","\u{1F9E0}":"brain","\u{1F4DA}":"book-open","\u{1F4D6}":"book-open","\u270D":"pen-line","\u{1F4DD}":"pen-line","\u270F":"pen-line","\u{1F3AF}":"target","\u{1F4A1}":"lightbulb","\u{1F393}":"graduation-cap","\u{1F305}":"sunrise","\u{1F319}":"moon","\u2600":"sun","\u23F0":"alarm-clock","\u{1F6CF}":"bed","\u{1F6BF}":"shower-head","\u{1F525}":"flame","\u{1F9CA}":"snowflake","\u{1F33F}":"leaf","\u{1F343}":"leaf","\u{1F333}":"trees","\u{1F3D4}":"mountain","\u{1F64F}":"hand-heart","\u2728":"sparkles","\u26A1":"sparkles"};
const HABIT_ICON_WORDS={Sun:"sunrise",Ice:"snowflake",Lift:"dumbbell",Book:"book-open",Zen:"flower-2"};
const HABIT_ICON_NAMES={"morning routine":"sunrise","cold exposure":"snowflake","meditation":"flower-2","journalling":"pen-line","journaling":"pen-line","strength training":"dumbbell","reading daily":"book-open","reading":"book-open","intermittent fasting":"timer","no alcohol":"wine-off","evening walk":"footprints","gratitude practice":"hand-heart"};
const habitIcon=h=>{const ic=String((h&&h.icon)||"").trim();if(ICONS[ic])return ic;if(HABIT_ICON_WORDS[ic])return HABIT_ICON_WORDS[ic];const bare=ic.replace(/[\uFE0F\u200D]/g,"");if(HABIT_EMOJI_TO_ICON[bare])return HABIT_EMOJI_TO_ICON[bare];if(!ic||/^[A-Za-z]{1,5}$/.test(ic))return HABIT_ICON_NAMES[String((h&&h.name)||"").toLowerCase().trim()]||"sparkles";return ic;};
const HabitGlyph=({h,size=16})=>{const v=habitIcon(h);return ICONS[v]?<Icon name={v} size={size} stroke={1.7}/>:<span style={{fontSize:size-2,lineHeight:1}}>{v}</span>;};
const Tick=()=>(<svg width="1.15em" height="1.15em" viewBox="0 0 12 12" fill="none" style={{display:"block"}} aria-hidden="true"><path d="M2.4 6.3l2.3 2.3 4.9-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const Chevron=({dir="down"})=>(<svg width="1.1em" height="1.1em" viewBox="0 0 12 12" fill="none" style={{display:"block",transform:dir==="up"?"rotate(180deg)":dir==="right"?"rotate(-90deg)":"none"}} aria-hidden="true"><path d="M3 4.6l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const downloadFile=async(blob,name)=>{
  // iOS app: the web view ignores download links, so use the share sheet (Save to Files, AirDrop, Mail)
  try{const f=new File([blob],name,{type:blob.type});if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:name});return;}}catch(e){if(e&&e.name==="AbortError")return;}
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
};
const exportCSV=(rows,name)=>{
  if(!rows||!rows.length)return;
  const cols=[...new Set(rows.flatMap(r=>Object.keys(r||{})))];
  const cell=v=>{if(v==null)return "";const s=typeof v==="object"?JSON.stringify(v):String(v);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
  const csv=[cols.join(","),...rows.map(r=>cols.map(c=>cell(r[c])).join(","))].join("\n");
  downloadFile(new Blob([csv],{type:"text/csv"}),name);
};

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
  cashLog:[{id:1,date:daysAgoStr(4),balance:85000,change:6200,note:"Salary + rent in"},{id:2,date:daysAgoStr(34),balance:78800,change:-2400,note:"Hayman Island trip"},{id:3,date:daysAgoStr(64),balance:81200,change:5100,note:""}],
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
  {id:1,name:"Morning Routine",icon:"sunrise",color:"#C9A84C",target:7},
  {id:2,name:"Cold Exposure",icon:"snowflake",color:"#7EB8C9",target:5},
  {id:3,name:"Strength Training",icon:"dumbbell",color:"#7A9E7E",target:4},
  {id:4,name:"Reading Daily",icon:"book-open",color:"#B07EC9",target:7},
  {id:5,name:"Meditation",icon:"flower-2",color:"#D4956A",target:7}
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

// ---- Currency conversion for holdings ----
// Currency a symbol is quoted in (used if the price service doesn't say)
function guessQuoteCurrency(sym){
  const s=String(sym||"").toUpperCase();
  if(s.startsWith("BINANCE:")||s.endsWith("USDT")||/-USD$/.test(s))return "USD";
  const SUFFIX={".AX":"AUD",".L":"GBP",".TO":"CAD",".V":"CAD",".NZ":"NZD",".SI":"SGD",".DE":"EUR",".F":"EUR",".PA":"EUR",".AS":"EUR",".MI":"EUR",".MC":"EUR",".HK":"HKD",".T":"JPY"};
  for(const k in SUFFIX)if(s.endsWith(k))return SUFFIX[k];
  return "USD";
}
// Live exchange rates, refreshed every 10 minutes. The last good rate is saved
// on the device so a failed fetch falls back to it. null = never had a rate.
const FX_STORE="exec_fx";
const _fxCache=(()=>{try{return JSON.parse(localStorage.getItem(FX_STORE)||"{}")||{};}catch{return{};}})();
async function fxRate(from,to){
  if(!from||!to||from===to)return 1;
  const k=from+">"+to,c=_fxCache[k];
  if(c&&Date.now()-c.at<600000)return c.rate;
  try{
    const r=await quoteFetch("/api/quote?symbol="+encodeURIComponent(from+to+"=X"));
    const d=await r.json();
    if(d&&d.price>0){
      _fxCache[k]={rate:d.price,at:Date.now()};
      try{localStorage.setItem(FX_STORE,JSON.stringify(_fxCache));}catch{}
      return d.price;
    }
  }catch{}
  return c&&c.rate>0?c.rate:null;
}
// A quote converted into the user's currency. price/change are in the user's
// currency (so values and gains just work); nativePrice/currency keep the original.
async function toLocalQuote(d,sym){
  const cur=d.currency||guessQuoteCurrency(sym);
  const to=L().currency;
  const rate=await fxRate(cur,to);
  // No rate at all: don't guess - leave the price empty so the holding is valued at what you paid
  if(rate===null)return{price:null,change:null,pct:d.pct||0,nativePrice:d.price,currency:cur,fxMissing:true};
  return{price:d.price*rate,change:(d.change||0)*rate,pct:d.pct||0,nativePrice:d.price,currency:cur,fxMissing:false};
}
// Per-unit price in the user's currency (converted at the live rate)
function fmtPx(live){
  if(!live||live.price==null)return "-";
  const v=Number(live.price);
  const dp=Math.abs(v)<1?4:2;
  return L().symbol+v.toLocaleString("en-AU",{minimumFractionDigits:2,maximumFractionDigits:dp});
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
        if(d.price)results[h.ticker]=await toLocalQuote(d,h.ticker);
      }catch{}
    }));
    setPrices(results);setLastUpdated(new Date());setLoading(false);
  },[safeH.map(h=>h.ticker).join(",")+"|"+L().currency]);

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
        if(d.price)results[h.ticker]=await toLocalQuote(d,h.ticker);
      }catch{}
    }));
    setPrices(results);
    setLastUpdated(new Date());
    setLoading(false);
  },[safeH.map(h=>h.ticker).join(",")+"|"+L().currency]);

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
        const key=h.ticker||h.symbol;
        const sym=key.includes("-")?key:key+"-USD";
        const r=await quoteFetch("/api/quote?symbol="+encodeURIComponent(sym));
        const d=await r.json();
        if(d.price)results[key]=await toLocalQuote(d,sym);
      }catch{}
    }));
    setPrices(results);
    setLastUpdated(new Date());
    setLoading(false);
  },[safeH.map(h=>h.ticker||h.symbol).join(",")+"|"+L().currency]);

  useEffect(()=>{
    fetchPrices();
    const id=setInterval(fetchPrices,60000);
    return()=>clearInterval(id);
  },[fetchPrices]);

  const totalValue=safeH.reduce((s,h)=>{
    const lp=prices[h.ticker||h.symbol]?.price;
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
// Frosted glass used by every card-like surface when a background photo is on
const GLASS_BG="rgba(8,7,6,0.72)";
const GLASS_BLUR="blur(14px) saturate(120%)";
// Background for a card-like surface: frosted glass over a photo, the theme card colour otherwise
function surfaceBg(){
  if(!hasPhoto())return{background:T().CARD};
  return{background:GLASS_BG,backdropFilter:GLASS_BLUR,WebkitBackdropFilter:GLASS_BLUR};
}
function Card({children,style,onClick}){
  const t=T();
  const glass=hasPhoto();
  const base=glass?{
    background:GLASS_BG,
    border:"1px solid rgba(255,255,255,0.1)",
    boxShadow:"0 2px 12px rgba(0,0,0,0.4)",
  }:{
    background:t.CARD,
    border:"1px solid "+t.BORDER,
  };
  const st=style||{};
  let bg=null;
  if(glass){
    // Keep a light colour tint (8-digit hex, e.g. green+"0A") layered over the glass; replace solid backgrounds with glass
    const tint=typeof st.background==="string"&&/^#[0-9a-fA-F]{8}$/.test(st.background)?st.background:null;
    bg={background:tint?"linear-gradient("+tint+","+tint+"),"+GLASS_BG:GLASS_BG,backdropFilter:GLASS_BLUR,WebkitBackdropFilter:GLASS_BLUR};
  }
  return <div onClick={onClick} style={{...base,borderRadius:10,padding:16,minWidth:0,...st,...(bg||{}),cursor:onClick?"pointer":"default"}}>{children}</div>;
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
    <div className="exec-overlay" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:t.CARD,border:"1px solid "+t.GOLD+"44",borderRadius:14,maxWidth:520,width:"100%",maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid "+t.BORDER}}>
          <div style={{fontSize:14,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{title}</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:16}}><Icon name="x"/></button>
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
function RecalibrateModal({profile,properties,onSave,onClose}){
  const[form,setForm]=useState({
    annualIncome:profile.annualIncome||"",shareValue:profile.shareValue||"",
    cashSavings:profile.cashSavings||"",superBalance:profile.superBalance||"",cryptoValue:profile.cryptoValue||"",
    investLoanDebt:profile.investLoanDebt||"",carDebt:profile.carDebt||"",
    creditCardDebt:profile.creditCardDebt||"",personalDebt:profile.personalDebt||"",netWorthTarget:profile.netWorthTarget||""
  });
  const propertyTotal=(properties||[]).reduce((s,p)=>s+(parseFloat(p.currentValue)||0),0);
  const mortgageTotal=(properties||[]).reduce((s,p)=>s+(parseFloat(p.mortgageBalance)||0),0);
  const save=()=>{
    const tA=["shareValue","cashSavings","superBalance","cryptoValue"].reduce((s,k)=>s+(parseFloat(form[k])||0),0)+propertyTotal;
    const tD=["investLoanDebt","carDebt","creditCardDebt","personalDebt"].reduce((s,k)=>s+(parseFloat(form[k])||0),0)+mortgageTotal;
    onSave({...profile,...form,totalAssets:tA,totalDebt:tD,netWorth:tA-tD});
  };
  const fields=[
    ["annualIncome","Annual Income"],["shareValue","Shares"],
    ["cashSavings","Cash"],["superBalance","Super"],["cryptoValue","Crypto"],
    ["investLoanDebt","Invest Loan"],["carDebt","Car"],
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
        const r=await claudeFetch({model:"claude-sonnet-4-6",max_tokens:550,tools:[{type:"web_search_20250305",name:"web_search"}],system:GENERAL_INFO_RULE+" Today's date is "+dateLabel+". Fast briefing for "+profile.firstName+", "+(profile.occupation||"investor")+". One search only: S&P 500 and ASX 200 current levels and % move today, plus the single most important financial news story from the last 24h. Sections: MARKETS (brief, just the numbers), NEWS (1 story, 2 sentences max), PRIORITIES (top 3 from tasks below, do not invent any), MINDSET (one sentence). Be extremely concise — this must be fast. Plain text, caps headers.",messages:[{role:"user",content:"Briefing for "+dateLabel+". My current undone high-priority tasks: "+highTasks}]});
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
    ["dashboard","layout-dashboard","Home"],
    ["tasks","list-checks","Tasks"],
    ["habits","flame","Habits"],
    ["wealth","gem","Wealth"],
    ["advisor","sparkles","AI"],
  ];

  const groups=[
    ["Command",["dashboard","weekly","calendar","advisor","news","learn","notes","services"]],
    ["Execute",["tasks","habits","goals","journal","reading"]],
    ["Wealth",["wealth","property","cashflow","bills","budget","debt","invest","projector","dividends","tax"]],
    ["Health",["health","body","workout"]],
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
              <button onClick={()=>setMenuOpen(false)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:22,lineHeight:1}}><Icon name="x"/></button>
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
                      <button key={id} onClick={()=>{if(active){try{window.scrollTo(0,0);}catch{}}setPage(id);setMenuOpen(false);}} style={{display:"flex",alignItems:"center",gap:14,width:"100%",padding:"12px 20px",background:active?t.GOLD+"18":"none",border:"none",borderLeft:active?"3px solid "+t.GOLD:"3px solid transparent",color:active?t.GOLD:t.TEXT,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:14,textAlign:"left"}}>
                        <span style={{display:"flex"}}><Icon name={nav[1]} size={19} stroke={active?1.8:1.5}/></span>
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
        <div className="exec-tabbar" style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:t.CARD,borderTop:"1px solid "+t.BORDER,display:"flex",alignItems:"stretch",paddingBottom:"calc(env(safe-area-inset-bottom) + 4px)"}}>
          {BOTTOM_TABS.map(([id,icon,label])=>{
            const active=page===id;
            return (
              <button key={id} onClick={()=>{if(active){try{window.scrollTo({top:0,behavior:"smooth"});}catch{window.scrollTo(0,0);}}setPage(id);}} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"8px 4px",background:"none",border:"none",borderTop:active?"2px solid "+t.GOLD:"2px solid transparent",color:active?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif"}}>
                <span style={{display:"flex"}}><Icon name={icon} size={21} stroke={active?1.8:1.5}/></span>
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
              <span style={{display:"flex"}}><Icon name="user-round" size={20} stroke={1.5}/></span>
              <span style={{fontSize:9,letterSpacing:.3}}>Sign In</span>
            </button>
          )}
          {/* Theme toggle */}
          <button onClick={()=>{const order=["obsidian","charcoal"];const next=order[(order.indexOf(theme)+1)%order.length];setTheme(next);}} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"8px 4px",background:"none",border:"none",borderTop:"2px solid transparent",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif"}}>
            <span style={{fontSize:16,lineHeight:1,display:"flex"}}><svg width="19" height="19" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4"/><path d="M8 1.8a6.2 6.2 0 0 1 0 12.4z" fill="currentColor"/></svg></span>
            <span style={{fontSize:9,letterSpacing:.3}}>Theme</span>
          </button>
          {/* More button */}
          <button onClick={()=>setMenuOpen(true)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"8px 4px",background:"none",border:"none",borderTop:"2px solid transparent",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif"}}>
            <span style={{display:"flex"}}><Icon name="menu" size={21} stroke={1.5}/></span>
            <span style={{fontSize:9,letterSpacing:.3}}>More</span>
          </button>
        </div>
      </>
      </div>
    );
  }

  // Desktop sidebar (fixed to viewport so it never moves on scroll)
  return (
    <div style={{width:collapsed?54:200,flexShrink:0,background:t.CARD,borderRight:"1px solid "+t.BORDER,display:"flex",flexDirection:"column",height:"100vh",position:"fixed",top:0,left:0,zIndex:50,transition:"width .2s",overflow:"hidden"}}>
      <div style={{padding:collapsed?"12px 8px":"14px 14px",borderBottom:"1px solid "+t.BORDER,display:"flex",alignItems:"center",justifyContent:collapsed?"center":"space-between"}}>
        {!collapsed&&<div style={{fontSize:9,letterSpacing:4,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif"}}>The Executive</div>}
        <button onClick={()=>setCollapsed(x=>!x)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:14,lineHeight:1,flexShrink:0,display:"flex"}} aria-label="Collapse menu"><Icon name="panel-left" size={16} stroke={1.5}/></button>
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
                <button key={id} onClick={()=>{if(active){try{window.scrollTo({top:0,behavior:"smooth"});}catch{window.scrollTo(0,0);}}setPage(id);}} title={nav[2]} style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:collapsed?"9px 0":"6px 14px",background:active?t.GOLD+"18":"none",border:"none",borderLeft:active?"2px solid "+t.GOLD:"2px solid transparent",color:active?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,textAlign:"left",justifyContent:collapsed?"center":"flex-start",transition:"all .15s"}}>
                  <span style={{display:"flex",flexShrink:0}}><Icon name={nav[1]} size={16} stroke={active?1.8:1.5}/></span>
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
            {[{id:"obsidian",l:"Obsidian"},{id:"charcoal",l:"Charcoal"}].map(th=>(
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

function DashboardPage({setupCard,debts,dividends,calendarItems,setCalendarItems,profile,tasks,setTasks,goals,supplements,setSupplements,history,streak,market,nwHistory,setPage,setShowBriefing,habits,habitLog,setHabitLog,bills,transactions,isMobile,syncing,isOnline,pendingSave,authUser,setShowAuth,holdings,portfolio,cryptoHoldings,cryptoPortfolio,marketTickers,setMarketTickers,subscription,setShowUpgrade}){
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
      <div style={{...rowStyle(0),...surfaceBg(),border:"1px solid "+(hasPhoto()?"rgba(255,255,255,0.1)":t.BORDER),borderRadius:12,overflow:"hidden",marginBottom:12}}>
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
      {setupCard&&<div style={{order:0}}>{setupCard}</div>}
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
      <div style={{...rowStyle(3),display:"grid",gridTemplateColumns:isMobile?"minmax(0,1fr)":"repeat(4,minmax(0,1fr))",gap:12,order:isMobile?4:0}}>
        {/* Markets */}
        <Card>
          <SectionLabel action={
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              {market.lastUpdated&&<span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{market.lastUpdated.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>}
              <button onClick={market.refresh} style={{background:t.GOLD+"22",border:"1px solid "+t.GOLD+"44",borderRadius:4,padding:"2px 6px",color:t.GOLD,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center"}} aria-label="Refresh prices"><Icon name="refresh-cw" stroke={1.8}/></button>
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
                    {lp?<div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{fmtPx(portfolio.prices?.[h.ticker])}</div>:<div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>—</div>}
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
                    {lp?<div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{fmtPx(cryptoPortfolio.prices?.[h.symbol||h.ticker])}</div>:<div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>—</div>}
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

        {/* Upcoming: bills, repayments, income, reminders */}
        <div style={{gridColumn:isMobile?"auto":"span 2",minWidth:0}}><UpcomingCard src={{bills,debts,dividends,holdings,goals,calendarItems}} setCalendarItems={setCalendarItems} setPage={setPage} limit={4} onCalendar={()=>setPage("calendar")} fill/></div>
      </div>

      {/* ── ROW 3: Tasks + Goals + Habits ── */}
      <div style={{...rowStyle(4),display:"grid",gridTemplateColumns:isMobile?"minmax(0,1fr)":"repeat(4,minmax(0,1fr))",gap:12,alignItems:"stretch",order:isMobile?2:0}}>
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
                const d=daysAgoStr(i);
                if(habitLog[h.id+"_"+d])streak++;
                else if(i>0)break;
              }
              return (
                <div key={h.id} onClick={()=>togHabit(h.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid "+t.BORDER,cursor:"pointer"}}>
                  <div style={{width:24,height:24,borderRadius:"50%",background:done?h.color:t.CARD2,border:"1.5px solid "+(done?h.color:t.BORDER2),flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,transition:"all .2s"}} className={done?"tick-pop":""}>
                    <span style={{color:done?"#080808":h.color,display:"flex"}}><HabitGlyph h={h} size={13}/></span>
                  </div>
                  <span style={{flex:1,fontSize:11,color:done?t.MUTED:t.TEXT,fontFamily:"'Montserrat',sans-serif",textDecoration:done?"line-through":"none"}}>{h.name}</span>
                  {streak>0&&<div style={{display:"flex",alignItems:"center",gap:2,background:h.color+"22",borderRadius:8,padding:"1px 6px",flexShrink:0}}>
                    <span style={{display:"flex",color:h.color}}><Icon name="flame" size={10} stroke={2}/></span>
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
          <div style={{fontSize:9,letterSpacing:2,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Executive AI - Full Dashboard Context - Web Search</div>
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
                      {tk.done&&<span style={{fontSize:9,color:"#080808",fontWeight:700}}><Tick/></span>}
                    </div>
                    <span style={{flex:1,fontSize:13,color:tk.done?t.MUTED:t.TEXT,textDecoration:tk.done?"line-through":"none",fontFamily:"'Montserrat',sans-serif"}}>{tk.text}</span>
                    {tk.recurring&&<span style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",background:t.GOLD+"18",borderRadius:10,padding:"1px 6px",flexShrink:0}}>{tk.recurDays?.length?["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].filter((_,i)=>tk.recurDays.includes(i)).join(", "):"daily"}</span>}
                    <button onClick={e=>{e.stopPropagation();setTasks(ts=>ts.filter(x=>x.id!==tk.id));}} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:12,opacity:.5}}><Icon name="x"/></button>
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
  const[form,setForm]=useState({name:"",icon:"flame",color:"#C9A84C",target:7,timeOfDay:"morning"});
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
    setForm({name:"",icon:"flame",color:"#C9A84C",target:7,timeOfDay:"morning"});
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
        <Card style={{marginBottom:14,borderColor:t.GOLD+"44",position:"relative",zIndex:30}}>
          <SectionLabel>New Habit</SectionLabel>
          <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
            <div style={{position:"relative"}}>
              <button onClick={()=>setShowEmojiPicker(s=>!s)} style={{width:44,height:44,borderRadius:8,border:"1px solid "+t.BORDER,background:t.CARD2,fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{color:form.color||t.GOLD,display:"flex"}}><HabitGlyph h={form} size={22}/></span>
              </button>
              {showEmojiPicker&&(
                <div style={{position:"absolute",top:48,left:0,zIndex:100,background:t.BG,border:"1px solid "+t.BORDER,borderRadius:10,padding:10,display:"grid",gridTemplateColumns:"repeat(8,minmax(0,1fr))",gap:3,width:280,maxHeight:220,overflowY:"auto",boxShadow:"0 8px 24px rgba(0,0,0,.4)"}}>
                  {HABIT_ICON_CHOICES.map((e,ei)=>(
                    <button key={ei} onClick={()=>{setForm(f=>({...f,icon:e}));setShowEmojiPicker(false);}} aria-label={e} style={{background:form.icon===e?t.GOLD+"22":"none",border:"none",color:form.icon===e?t.GOLD:t.TEXT,cursor:"pointer",padding:6,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <Icon name={e} size={20} stroke={1.5}/>
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
                      <span style={{color:habitLog[h.id+"_"+todayStr()]?"#080808":h.color,display:"flex"}}><HabitGlyph h={h} size={16}/></span>
                    </div>
                    {/* Name + streak */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                        <span style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.name}</span>
                        {streak>0&&<div style={{display:"flex",alignItems:"center",gap:2,background:h.color+"22",borderRadius:8,padding:"1px 5px",flexShrink:0}}>
                          <span style={{display:"flex",color:h.color}}><Icon name="flame" size={10} stroke={2}/></span>
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
                            {done&&<span style={{fontSize:8,color:"#080808",fontWeight:700}}><Tick/></span>}
                          </div>
                        );
                      })}
                    </div>
                    {/* Controls */}
                    <div style={{display:"flex",alignItems:"center",gap:3,flexShrink:0}}>
                      <button onClick={()=>setExpandHabit(x=>({...x,[h.id]:!x[h.id]}))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,opacity:.7,padding:"2px 4px"}}><Chevron dir={isExpanded?"up":"down"}/></button>
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
                        <button onClick={()=>setConfirmDelete(h.id)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.4,padding:"2px 4px"}}><Icon name="x"/></button>
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
                          {HABIT_ICON_CHOICES.map((e,ei)=>(
                            <button key={ei} aria-label={e} onClick={()=>setEditForm(f=>({...f,icon:e}))} style={{background:editForm.icon===e?t.GOLD+"44":"transparent",border:"1.5px solid "+(editForm.icon===e?t.GOLD:"transparent"),borderRadius:6,padding:"4px 5px",cursor:"pointer",fontSize:20,lineHeight:1,transition:"all .15s"}}>
                              <span style={{display:"flex",color:editForm.icon===e?t.GOLD:t.TEXT}}><Icon name={e} size={20} stroke={1.5}/></span>
                            </button>
                          ))}
                        </div>
                        {editForm.icon&&<div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:4}}>Selected: <span style={{display:"inline-flex",verticalAlign:"middle",color:editForm.color||t.GOLD}}><HabitGlyph h={editForm} size={18}/></span></div>}
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
                          return localDateStr(d);
                        });
                        // Group by week
                        const firstDay=parseLocalDate(days90[0]);
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
                            const m=parseLocalDate(firstReal).getMonth();
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
          <div style={{fontSize:32,marginBottom:10,display:"flex",justifyContent:"center",color:t.GOLD}}><Icon name="flame" stroke={1.2}/></div>
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
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <div style={{flex:"1 1 140px",minWidth:0}}>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Start Date</div>
            <Inp type="date" value={value.startDate||""} onChange={e=>{
              const ns=e.target.value;
              onChange(f=>({...f,startDate:ns,endDate:autoEndDate(f.period||"year",ns)}));
            }}/>
          </div>
          <div style={{flex:"1 1 140px",minWidth:0}}>
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
                          <div style={{color:t.MUTED,fontSize:12,transition:"transform .2s",transform:isCollapsed?"rotate(0deg)":"rotate(180deg)"}}><Chevron/></div>
                          {/* Edit + delete — stop propagation */}
                          <div onClick={e=>e.stopPropagation()} style={{display:"flex",gap:5}}>
                            <button onClick={()=>{setEditForm({title:g.title,category:g.category,period:g.period,startDate:g.startDate||todayStr(),endDate:g.endDate||"",notes:g.notes||""});setEditingGoalId(g.id);setCollapsed(c=>({...c,[g.id]:false}));}} style={{background:t.GOLD+"14",border:"1px solid "+t.GOLD+"33",borderRadius:5,padding:"3px 7px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Edit</button>
                            {confirmDel===g.id?(
                              <>
                                <button onClick={()=>{setGoals(gs=>gs.filter(x=>x.id!==g.id));setConfirmDel(null);}} style={{background:t.RED+"22",border:"1px solid "+t.RED+"44",borderRadius:5,padding:"3px 7px",color:t.RED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Yes</button>
                                <button onClick={()=>setConfirmDel(null)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:5,padding:"3px 7px",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>No</button>
                              </>
                            ):(
                              <button onClick={()=>setConfirmDel(g.id)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:12,opacity:.5}}><Icon name="x"/></button>
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
                                    <div style={{display:"flex",gap:7,marginBottom:7,flexWrap:"wrap"}}>
                                      <Inp value={editCpForm.text} onChange={e=>setEditCpForm(f=>({...f,text:e.target.value}))} style={{flex:"2 1 150px",fontSize:12}} onKeyDown={e=>e.key==="Enter"&&saveEditCp()}/>
                                      <Inp type="date" value={editCpForm.dueDate} onChange={e=>setEditCpForm(f=>({...f,dueDate:e.target.value}))} style={{flex:"1 1 140px",fontSize:11}}/>
                                    </div>
                                    <div style={{display:"flex",gap:6}}>
                                      <Btn onClick={saveEditCp} style={{fontSize:11}}>Save</Btn>
                                      <Btn onClick={()=>setEditingCp(null)} variant="ghost" style={{fontSize:11}}>Cancel</Btn>
                                    </div>
                                  </div>
                                ):(
                                  <div style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0"}}>
                                    <div onClick={()=>toggleCheckpoint(g.id,cp.id)} style={{width:20,height:20,borderRadius:"50%",border:"1.5px solid "+(cp.done?col:t.BORDER2),background:cp.done?col:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all .2s"}}>
                                      {cp.done&&<span style={{color:"#080808",fontSize:10,fontWeight:700}}><Tick/></span>}
                                    </div>
                                    <div style={{flex:1,minWidth:0}}>
                                      <div style={{fontSize:12,color:cp.done?t.MUTED:t.TEXT,fontFamily:"'Montserrat',sans-serif",textDecoration:cp.done?"line-through":"none"}}>{cp.text}</div>
                                      {cp.dueDate&&<div style={{fontSize:9,color:cp.done?t.GREEN:overdue?t.RED:soon?"#D4956A":t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:1}}>{cp.done?"Done "+fmtDateNum(cp.doneAt):overdue?"Overdue · "+fmtDateNum(cp.dueDate):soon?"Due soon · "+fmtDateNum(cp.dueDate):"By "+fmtDateNum(cp.dueDate)}</div>}
                                    </div>
                                    <button onClick={()=>{setEditingCp({goalId:g.id,cpId:cp.id});setEditCpForm({text:cp.text,dueDate:cp.dueDate||""});}} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,opacity:.5,flexShrink:0}}>E</button>
                                    <button onClick={()=>deleteCheckpoint(g.id,cp.id)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.4,flexShrink:0}}><Icon name="x"/></button>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Add checkpoint row */}
                          {addCpGoalId===g.id?(
                            <div style={{marginTop:8,borderTop:"1px solid "+t.BORDER,paddingTop:10}}>
                              <div style={{display:"flex",gap:7,marginBottom:7,flexWrap:"wrap"}}>
                                <Inp value={cpForm.text} onChange={e=>setCpForm(f=>({...f,text:e.target.value}))} placeholder="Checkpoint..." style={{flex:"2 1 150px",fontSize:12}} onKeyDown={e=>e.key==="Enter"&&addCheckpoint(g.id)}/>
                                <Inp type="date" value={cpForm.dueDate} onChange={e=>setCpForm(f=>({...f,dueDate:e.target.value}))} style={{flex:"1 1 140px",fontSize:11}}/>
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
            <div key={g.id||i} style={{...surfaceBg(),border:"1px solid "+t.BORDER,borderRadius:9,padding:"10px 14px",marginBottom:7,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:12,color:t.MUTED,textDecoration:"line-through",fontFamily:"'Montserrat',sans-serif"}}>{g.title}</div>
                <div style={{fontSize:9,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>{"Completed "+fmtDateNum(g.completedAt)}</div>
              </div>
              <div style={{fontSize:16,color:t.GREEN}}><Tick/></div>
            </div>
          ))}
        </div>
      )}

      {filtered.length===0&&(
        <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
          <div style={{fontSize:28,marginBottom:10,display:"flex",justifyContent:"center",color:t.GOLD}}><Icon name="target" stroke={1.2}/></div>
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
            {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:12}}><Icon name="x"/></button>}
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
              <button onClick={ev=>{ev.stopPropagation();setConfirmDel(entry.id);}} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.5}}><Icon name="x"/></button>
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

      {!(entries||[]).length&&<div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}><div style={{fontSize:32,marginBottom:10,display:"flex",justifyContent:"center",color:t.GOLD}}><Icon name="notebook-pen" stroke={1.2}/></div><div>No entries yet</div></div>}
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
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>{"Avg cost per unit, "+L().currency+" (optional)"}</div>
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
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>{"Value / unit ("+L().currency+")"}</div>
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

function PropertyDetail({property,onBack,onUpdate,onDelete,onUpdateValue,debts,addLoan,takenIds}){
  const t=T();
  const isMobile=useIsMobile();
  const[form,setForm]=useState({...property});
  const[newValue,setNewValue]=useState("");
  const[confirmDel,setConfirmDel]=useState(false);
  const upd=(k,v)=>setForm(f=>({...f,[k]:v}));
  const save=()=>onUpdate({...form,currentValue:parseFloat(form.currentValue)||0,mortgageBalance:parseFloat(form.mortgageBalance)||0,interestRate:form.interestRate?parseFloat(form.interestRate):null,weeklyRepayment:parseFloat(form.weeklyRepayment)||0,loanTermYears:form.loanTermYears?parseFloat(form.loanTermYears):null,rentalIncome:parseFloat(form.rentalIncome)||0,purchasePrice:form.purchasePrice?parseFloat(form.purchasePrice):null,managementFeePct:form.managementFeePct?parseFloat(form.managementFeePct):null,ratesAnnual:parseFloat(form.ratesAnnual)||0,waterAnnual:parseFloat(form.waterAnnual)||0,insuranceAnnual:parseFloat(form.insuranceAnnual)||0,maintenanceAnnual:parseFloat(form.maintenanceAnnual)||0});
  const value=parseFloat(property.currentValue)||0;
  const M="'Montserrat',sans-serif";
  const loans=linkedLoans(property,debts);
  const linkedIds=property.linkedDebtIds||[];
  const PROPERTY_LOAN_TYPES=["Mortgage","Investment Loan","Business Loan","Other"];
  const unlinkedLoans=(debts||[]).filter(d=>PROPERTY_LOAN_TYPES.indexOf(d.type||"Other")>=0&&!linkedIds.some(x=>idEq(x,d.id))&&!(takenIds||[]).some(x=>idEq(x,d.id)));
  const linkIds=ids=>{onUpdate({linkedDebtIds:ids,mortgageBalance:0});setForm(f=>({...f,linkedDebtIds:ids,mortgageBalance:0}));};
  const moveToDebt=()=>{
    const bal=parseFloat(form.mortgageBalance)||parseFloat(property.mortgageBalance)||0;
    if(!bal||!addLoan)return;
    const id=Date.now();
    addLoan({id,name:(property.nickname||"Property")+" Mortgage",type:property.type==="investment"?"Investment Loan":"Mortgage",
      balance:bal,originalBalance:bal,rate:(form.interestRate||property.interestRate)?parseFloat(form.interestRate||property.interestRate):"",
      minPayment:parseFloat(form.weeklyRepayment||property.weeklyRepayment)||0,frequency:"weekly",nextPaymentDate:"",offsetBalance:"",
      startDate:"",endDate:"",lender:"",notes:"",payments:[]});
    linkIds([...linkedIds,id]);
  };
  const mortgage=propertyLoanBalance(property,debts);
  const equity=value-mortgage;
  const lvr=value>0?(mortgage/value)*100:0;
  const rentMult={weekly:52,fortnightly:26,monthly:12}[property.rentalFrequency||"weekly"]||52;
  const annualRent=(parseFloat(property.rentalIncome)||0)*rentMult;
  const grossYield=value>0?(annualRent/value)*100:0;
  const managementFeeAnnual=annualRent*((parseFloat(property.managementFeePct)||0)/100);
  const ratesAnnual=parseFloat(property.ratesAnnual)||0;
  const waterAnnual=parseFloat(property.waterAnnual)||0;
  const insuranceAnnual=parseFloat(property.insuranceAnnual)||0;
  const maintenanceAnnual=parseFloat(property.maintenanceAnnual)||0;
  const totalAnnualExpenses=managementFeeAnnual+ratesAnnual+waterAnnual+insuranceAnnual+maintenanceAnnual;
  const netAnnualIncome=annualRent-totalAnnualExpenses;
  const netYield=value>0?(netAnnualIncome/value)*100:0;
  const annualRepayment=loans.length?loans.reduce((s,d)=>s+loanAnnualRepayment(d),0):(parseFloat(property.weeklyRepayment)||0)*52;
  const annualCashFlow=netAnnualIncome-annualRepayment;
  const history=(property.valueHistory||[]).map(h=>h.value);
  const logValue=()=>{
    const v=parseFloat(newValue);
    if(!v||v<=0)return;
    onUpdateValue(v);
    setForm(f=>({...f,currentValue:v}));
    setNewValue("");
  };
  return(
    <div data-page="true" style={{maxWidth:680,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:t.MUTED,fontSize:20,cursor:"pointer",padding:0}}>←</button>
        <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif"}}>Property</div>
      </div>
      <div style={{fontSize:24,color:t.TEXT,marginBottom:16}}>{property.nickname||"Property"}</div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,minmax(0,1fr))",gap:10,marginBottom:16}}>
        <StatCard label="Equity" value={fmt(equity)} color={t.GREEN}/>
        <StatCard label="LVR" value={lvr.toFixed(1)+"%"} color={lvr>80?t.RED:t.GOLD}/>
        <StatCard label={property.type==="investment"?"Gross Yield":"Value"} value={property.type==="investment"?grossYield.toFixed(2)+"%":fmt(value)}/>
      </div>
      {property.type==="investment"&&(
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,minmax(0,1fr))",gap:10,marginBottom:16}}>
          <StatCard label="Net Yield" value={netYield.toFixed(2)+"%"} color={t.PURPLE}/>
          <StatCard label="Annual Expenses" value={fmt(totalAnnualExpenses)} color={t.RED}/>
          <StatCard label="Cash Flow (yr)" value={(annualCashFlow>=0?"+":"")+fmt(annualCashFlow)} color={annualCashFlow>=0?t.GREEN:t.RED}/>
        </div>
      )}

      {history.length>1&&(
        <Card style={{marginBottom:16}}>
          <SectionLabel>Value History</SectionLabel>
          <SparkLine data={history} color={t.GOLD}/>
        </Card>
      )}

      <Card style={{marginBottom:16}}>
        <SectionLabel>Update Current Value</SectionLabel>
        <div style={{display:"flex",gap:8}}>
          <Inp type="number" value={newValue} onChange={e=>setNewValue(e.target.value)} placeholder={"Current: "+fmt(value)}/>
          <Btn onClick={logValue} style={{flexShrink:0}}>Log</Btn>
        </div>
      </Card>

      <Card style={{marginBottom:16}}>
        <SectionLabel>Details</SectionLabel>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <Inp value={form.nickname} onChange={e=>upd("nickname",e.target.value)} placeholder="Nickname (e.g. Home, 12 Smith St)"/>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,minmax(0,1fr))",gap:8}}>
            <Sel value={form.type} onChange={e=>upd("type",e.target.value)}>
              <option value="home">Home</option>
              <option value="investment">Investment Property</option>
            </Sel>
            <Sel value={form.category||"residential"} onChange={e=>upd("category",e.target.value)}>
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
            </Sel>
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,minmax(0,1fr))",gap:8}}>
            <Inp type="number" value={form.purchasePrice||""} onChange={e=>upd("purchasePrice",e.target.value)} placeholder="Purchase Price"/>
            <Inp type="date" value={form.purchaseDate||""} onChange={e=>upd("purchaseDate",e.target.value)}/>
          </div>
        </div>
      </Card>

      <Card style={{marginBottom:16}}>
        <SectionLabel>Loans</SectionLabel>
        {loans.length>0?(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {loans.map(d=>(
              <div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"9px 11px",background:t.CARD2,borderRadius:7,border:"1px solid "+t.BORDER}}>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:12,color:t.TEXT,fontFamily:M,fontWeight:600}}>{d.name}</div>
                  <div style={{fontSize:10,color:t.MUTED,fontFamily:M,marginTop:2}}>{[(d.rate!==""&&d.rate!=null?d.rate+"% p.a.":null),(parseFloat(d.minPayment)?fmt(parseFloat(d.minPayment))+(FREQ_SHORT[d.frequency||"monthly"]||""):null),(parseFloat(d.offsetBalance)>0?"Offset "+fmt(parseFloat(d.offsetBalance)):null),(d.nextPaymentDate?"Next "+fmtDateNum(d.nextPaymentDate):"No payment date set")].filter(Boolean).join("  |  ")}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
                  <div style={{fontSize:13,color:t.RED,fontFamily:M,fontWeight:700}}>{"-"+fmt(parseFloat(d.balance)||0)}</div>
                  <button onClick={()=>linkIds(linkedIds.filter(x=>!idEq(x,d.id)))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:M,padding:0}}>Unlink</button>
                </div>
              </div>
            ))}
            <div style={{fontSize:10,color:t.MUTED,fontFamily:M}}>Balances update automatically with each repayment. Change the rate, repayments or offset on the Debt tab.</div>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {(parseFloat(form.mortgageBalance)||0)>0&&addLoan&&(
              <div style={{padding:"10px 12px",background:t.GOLD+"12",border:"1px solid "+t.GOLD+"44",borderRadius:7,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <div style={{fontSize:11,color:t.TEXT,fontFamily:M,flex:1,minWidth:180,lineHeight:1.5}}>This mortgage isn't being tracked. Move it to the Debt tab so repayments and interest are recorded automatically.</div>
                <Btn onClick={moveToDebt} style={{fontSize:11}}>Move to Debt tab</Btn>
              </div>
            )}
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,minmax(0,1fr))",gap:8}}>
            <Inp type="number" value={form.mortgageBalance||""} onChange={e=>upd("mortgageBalance",e.target.value)} placeholder="Balance Owing"/>
            <Inp type="number" value={form.interestRate||""} onChange={e=>upd("interestRate",e.target.value)} placeholder="Interest Rate %"/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,minmax(0,1fr))",gap:8}}>
            <Inp type="number" value={form.weeklyRepayment||""} onChange={e=>upd("weeklyRepayment",e.target.value)} placeholder="Weekly Repayment"/>
            <Inp type="number" value={form.loanTermYears||""} onChange={e=>upd("loanTermYears",e.target.value)} placeholder="Loan Term (years)"/>
          </div>
          </div>
        )}
        {unlinkedLoans.length>0&&(
          <div style={{marginTop:10}}>
            <Sel value="" onChange={e=>{const d=unlinkedLoans.find(x=>String(x.id)===e.target.value);if(d)linkIds([...linkedIds,d.id]);}}>
              <option value="">{loans.length?"Link another loan...":"Link a loan from your Debt tab..."}</option>
              {unlinkedLoans.map(d=><option key={d.id} value={String(d.id)}>{d.name+" - "+fmt(parseFloat(d.balance)||0)}</option>)}
            </Sel>
          </div>
        )}
      </Card>

      {form.type==="investment"&&(
        <Card style={{marginBottom:16}}>
          <SectionLabel>Annual Expenses</SectionLabel>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:10}}>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,minmax(0,1fr))",gap:8}}>
              <Inp type="number" value={form.managementFeePct||""} onChange={e=>upd("managementFeePct",e.target.value)} placeholder="Management Fee (% of rent)"/>
              <Inp type="number" value={form.ratesAnnual||""} onChange={e=>upd("ratesAnnual",e.target.value)} placeholder="Council Rates ($/yr)"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,minmax(0,1fr))",gap:8}}>
              <Inp type="number" value={form.waterAnnual||""} onChange={e=>upd("waterAnnual",e.target.value)} placeholder="Water ($/yr)"/>
              <Inp type="number" value={form.insuranceAnnual||""} onChange={e=>upd("insuranceAnnual",e.target.value)} placeholder="Insurance ($/yr)"/>
            </div>
            <Inp type="number" value={form.maintenanceAnnual||""} onChange={e=>upd("maintenanceAnnual",e.target.value)} placeholder="Maintenance Budget ($/yr)"/>
          </div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>Management: {fmt(managementFeeAnnual)} · Total expenses: {fmt(totalAnnualExpenses)}/yr</div>
        </Card>
      )}

      {form.type==="investment"&&(
        <Card style={{marginBottom:16}}>
          <SectionLabel>Rental Income</SectionLabel>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,minmax(0,1fr))",gap:8,marginBottom:10}}>
            <Inp type="number" value={form.rentalIncome||""} onChange={e=>upd("rentalIncome",e.target.value)} placeholder="Rent Amount"/>
            <Sel value={form.rentalFrequency||"weekly"} onChange={e=>upd("rentalFrequency",e.target.value)}>
              <option value="weekly">Per Week</option>
              <option value="fortnightly">Per Fortnight</option>
              <option value="monthly">Per Month</option>
            </Sel>
          </div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>Annual: {fmt(annualRent)} · Gross yield: {grossYield.toFixed(2)}% · Net yield: {netYield.toFixed(2)}%</div>
        </Card>
      )}

      <div style={{display:"flex",gap:8}}>
        <Btn onClick={save} style={{flex:1}}>Save Changes</Btn>
        <Btn variant="ghost" onClick={()=>setConfirmDel(true)} style={{color:t.RED}}>Delete</Btn>
      </div>

      {confirmDel&&(
        <Modal title="Delete Property?" onClose={()=>setConfirmDel(false)}>
          <div style={{fontSize:13,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",marginBottom:16}}>This removes "{property.nickname}" and its full value history. This can't be undone.</div>
          <div style={{display:"flex",gap:8}}>
            <Btn variant="ghost" onClick={()=>setConfirmDel(false)} style={{flex:1}}>Cancel</Btn>
            <Btn onClick={onDelete} style={{flex:1,background:t.RED}}>Delete</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PropertyPage({properties,setProperties,debts,addLoan}){
  const t=T();
  const isMobile=useIsMobile();
  const[showAdd,setShowAdd]=useState(false);
  const[selectedId,setSelectedId]=useState(null);
  const emptyForm={nickname:"",type:"home",category:"residential",currentValue:"",purchasePrice:"",purchaseDate:"",mortgageBalance:"",interestRate:"",weeklyRepayment:"",loanTermYears:"",rentalIncome:"",rentalFrequency:"weekly",managementFeePct:"",ratesAnnual:"",waterAnnual:"",insuranceAnnual:"",maintenanceAnnual:""};
  const[form,setForm]=useState(emptyForm);
  const upd=(k,v)=>setForm(f=>({...f,[k]:v}));

  const safeProps=properties||[];
  const selected=safeProps.find(p=>p.id===selectedId);

  if(selected){
    return <PropertyDetail
      debts={debts} addLoan={addLoan}
      takenIds={(properties||[]).filter(p=>p.id!==selected.id).reduce((a,p)=>a.concat(p.linkedDebtIds||[]),[])}
      property={selected}
      onBack={()=>setSelectedId(null)}
      onUpdate={updates=>setProperties(ps=>ps.map(p=>p.id===selected.id?{...p,...updates}:p))}
      onDelete={()=>{setProperties(ps=>ps.filter(p=>p.id!==selected.id));setSelectedId(null);}}
      onUpdateValue={v=>setProperties(ps=>ps.map(p=>p.id===selected.id?{...p,currentValue:v,valueHistory:[...(p.valueHistory||[]),{date:todayStr(),value:v}]}:p))}
    />;
  }

  const addProperty=()=>{
    if(!form.nickname||!form.currentValue)return;
    const v=parseFloat(form.currentValue)||0;
    // A mortgage entered here becomes a tracked loan on the Debt tab, linked to this property
    const mb=parseFloat(form.mortgageBalance)||0;
    const loanId=mb>0&&addLoan?Date.now()+1:null;
    if(loanId)addLoan({id:loanId,name:form.nickname+" Mortgage",type:form.type==="investment"?"Investment Loan":"Mortgage",
      balance:mb,originalBalance:mb,rate:form.interestRate?parseFloat(form.interestRate):"",minPayment:parseFloat(form.weeklyRepayment)||0,
      frequency:"weekly",nextPaymentDate:"",offsetBalance:"",startDate:"",endDate:"",lender:"",notes:"",payments:[]});
    setProperties(ps=>[...ps,{
      id:Date.now(),
      nickname:form.nickname,
      type:form.type,
      category:form.category||"residential",
      currentValue:v,
      purchasePrice:form.purchasePrice?parseFloat(form.purchasePrice):null,
      purchaseDate:form.purchaseDate||null,
      mortgageBalance:loanId?0:mb,
      linkedDebtIds:loanId?[loanId]:[],
      interestRate:form.interestRate?parseFloat(form.interestRate):null,
      weeklyRepayment:parseFloat(form.weeklyRepayment)||0,
      loanTermYears:form.loanTermYears?parseFloat(form.loanTermYears):null,
      rentalIncome:parseFloat(form.rentalIncome)||0,
      rentalFrequency:form.rentalFrequency||"weekly",
      managementFeePct:form.managementFeePct?parseFloat(form.managementFeePct):null,
      ratesAnnual:parseFloat(form.ratesAnnual)||0,
      waterAnnual:parseFloat(form.waterAnnual)||0,
      insuranceAnnual:parseFloat(form.insuranceAnnual)||0,
      maintenanceAnnual:parseFloat(form.maintenanceAnnual)||0,
      valueHistory:[{date:todayStr(),value:v}]
    }]);
    setForm(emptyForm);
    setShowAdd(false);
  };

  const totalValue=safeProps.reduce((s,p)=>s+(parseFloat(p.currentValue)||0),0);
  const totalMortgage=safeProps.reduce((s,p)=>s+propertyLoanBalance(p,debts),0);
  const totalEquity=totalValue-totalMortgage;

  return(
    <div data-page="true" style={{maxWidth:680,margin:"0 auto"}}>
      <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:6}}>Real Estate</div>
      <div style={{fontSize:24,color:t.TEXT,marginBottom:16}}>Property Portfolio</div>

      {safeProps.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,minmax(0,1fr))",gap:10,marginBottom:16}}>
          <StatCard label="Total Value" value={fmt(totalValue)}/>
          <StatCard label="Total Mortgage" value={fmt(totalMortgage)} color={t.RED}/>
          <StatCard label="Total Equity" value={fmt(totalEquity)} color={t.GREEN}/>
        </div>
      )}

      <Card style={{marginBottom:16}}>
        <SectionLabel>Your Properties</SectionLabel>
        {safeProps.length===0&&<div style={{fontSize:12,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textAlign:"center",padding:"20px 0"}}>No properties added yet</div>}
        {safeProps.map((p,i)=>{
          const v=parseFloat(p.currentValue)||0;
          const m=propertyLoanBalance(p,debts);
          const eq=v-m;
          return(
            <div key={p.id}>
              {i>0&&<Divider/>}
              <div onClick={()=>setSelectedId(p.id)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",cursor:"pointer"}}>
                <div>
                  <div style={{fontSize:13,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600,marginBottom:3}}>{p.nickname}</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    <Tag color={p.type==="investment"?t.BLUE:t.GOLD}>{p.type==="investment"?"Investment":"Home"}</Tag>
                    <Tag color={p.category==="commercial"?t.PURPLE:t.MUTED}>{p.category==="commercial"?"Commercial":"Residential"}</Tag>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:14,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{fmt(v)}</div>
                  <div style={{fontSize:10,color:t.GREEN,fontFamily:"'Montserrat',sans-serif"}}>Equity {fmt(eq)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </Card>

      {!showAdd?(
        <Btn onClick={()=>setShowAdd(true)} style={{width:"100%"}}>+ Add Property</Btn>
      ):(
        <Card>
          <SectionLabel action={<button onClick={()=>{setShowAdd(false);setForm(emptyForm);}} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:16}}>×</button>}>New Property</SectionLabel>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Inp value={form.nickname} onChange={e=>upd("nickname",e.target.value)} placeholder="Nickname (e.g. Home, 12 Smith St)"/>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,minmax(0,1fr))",gap:8}}>
              <Sel value={form.type} onChange={e=>upd("type",e.target.value)}>
                <option value="home">Home</option>
                <option value="investment">Investment Property</option>
              </Sel>
              <Sel value={form.category} onChange={e=>upd("category",e.target.value)}>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
              </Sel>
            </div>
            <Inp type="number" value={form.currentValue} onChange={e=>upd("currentValue",e.target.value)} placeholder="Current Value"/>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,minmax(0,1fr))",gap:8}}>
              <Inp type="number" value={form.mortgageBalance} onChange={e=>upd("mortgageBalance",e.target.value)} placeholder="Mortgage Owing (optional)"/>
              <Inp type="number" value={form.interestRate} onChange={e=>upd("interestRate",e.target.value)} placeholder="Interest Rate % (optional)"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,minmax(0,1fr))",gap:8}}>
              <Inp type="number" value={form.weeklyRepayment} onChange={e=>upd("weeklyRepayment",e.target.value)} placeholder="Weekly Repayment (optional)"/>
              <Inp type="number" value={form.loanTermYears} onChange={e=>upd("loanTermYears",e.target.value)} placeholder="Loan Term (years, optional)"/>
            </div>
            {form.type==="investment"&&(
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,minmax(0,1fr))",gap:8}}>
                <Inp type="number" value={form.rentalIncome} onChange={e=>upd("rentalIncome",e.target.value)} placeholder="Rent Amount"/>
                <Sel value={form.rentalFrequency} onChange={e=>upd("rentalFrequency",e.target.value)}>
                  <option value="weekly">Per Week</option>
                  <option value="fortnightly">Per Fortnight</option>
                  <option value="monthly">Per Month</option>
                </Sel>
              </div>
            )}
            {form.type==="investment"&&(
              <>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginTop:2}}>Annual Expenses (optional)</div>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,minmax(0,1fr))",gap:8}}>
                  <Inp type="number" value={form.managementFeePct} onChange={e=>upd("managementFeePct",e.target.value)} placeholder="Management Fee (% of rent)"/>
                  <Inp type="number" value={form.ratesAnnual} onChange={e=>upd("ratesAnnual",e.target.value)} placeholder="Council Rates ($/yr)"/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,minmax(0,1fr))",gap:8}}>
                  <Inp type="number" value={form.waterAnnual} onChange={e=>upd("waterAnnual",e.target.value)} placeholder="Water ($/yr)"/>
                  <Inp type="number" value={form.insuranceAnnual} onChange={e=>upd("insuranceAnnual",e.target.value)} placeholder="Insurance ($/yr)"/>
                </div>
                <Inp type="number" value={form.maintenanceAnnual} onChange={e=>upd("maintenanceAnnual",e.target.value)} placeholder="Maintenance Budget ($/yr)"/>
              </>
            )}
            <Btn onClick={addProperty}>Add Property</Btn>
          </div>
        </Card>
      )}
    </div>
  );
}

// Shared ticker database used by both the Wealth page ticker autocomplete and the
// Dashboard's custom watchlist search, so suggestions stay consistent everywhere.
const TICKER_DB=[
  {symbol:"^GSPC",label:"S&P 500",cat:"Index"},{symbol:"^AXJO",label:"ASX 200",cat:"Index"},{symbol:"^IXIC",label:"Nasdaq",cat:"Index"},{symbol:"^DJI",label:"Dow Jones",cat:"Index"},{symbol:"^RUT",label:"Russell 2000",cat:"Index"},{symbol:"^FTSE",label:"FTSE 100",cat:"Index"},{symbol:"^N225",label:"Nikkei 225",cat:"Index"},{symbol:"^HSI",label:"Hang Seng",cat:"Index"},
  {symbol:"AUDUSD=X",label:"AUD/USD",cat:"Forex",fx:true},{symbol:"GBPUSD=X",label:"GBP/USD",cat:"Forex",fx:true},{symbol:"EURUSD=X",label:"EUR/USD",cat:"Forex",fx:true},{symbol:"USDJPY=X",label:"USD/JPY",cat:"Forex",fx:true},{symbol:"NZDUSD=X",label:"NZD/USD",cat:"Forex",fx:true},
  {symbol:"BTC-USD",label:"Bitcoin",cat:"Crypto"},{symbol:"ETH-USD",label:"Ethereum",cat:"Crypto"},{symbol:"SOL-USD",label:"Solana",cat:"Crypto"},{symbol:"XRP-USD",label:"XRP",cat:"Crypto"},{symbol:"DOGE-USD",label:"Dogecoin",cat:"Crypto"},{symbol:"BNB-USD",label:"BNB",cat:"Crypto"},
  {symbol:"AAPL",label:"Apple",cat:"US"},{symbol:"MSFT",label:"Microsoft",cat:"US"},{symbol:"NVDA",label:"Nvidia",cat:"US"},{symbol:"GOOGL",label:"Alphabet",cat:"US"},{symbol:"AMZN",label:"Amazon",cat:"US"},{symbol:"META",label:"Meta",cat:"US"},{symbol:"TSLA",label:"Tesla",cat:"US"},{symbol:"NFLX",label:"Netflix",cat:"US"},{symbol:"AMD",label:"AMD",cat:"US"},{symbol:"JPM",label:"JPMorgan",cat:"US"},{symbol:"SPY",label:"S&P 500 ETF",cat:"ETF"},{symbol:"QQQ",label:"Nasdaq ETF",cat:"ETF"},{symbol:"GLD",label:"Gold ETF",cat:"ETF"},
  {symbol:"CBA.AX",label:"Commonwealth Bank",cat:"ASX"},{symbol:"BHP.AX",label:"BHP Group",cat:"ASX"},{symbol:"CSL.AX",label:"CSL",cat:"ASX"},{symbol:"ANZ.AX",label:"ANZ Bank",cat:"ASX"},{symbol:"NAB.AX",label:"NAB",cat:"ASX"},{symbol:"WBC.AX",label:"Westpac",cat:"ASX"},{symbol:"WES.AX",label:"Wesfarmers",cat:"ASX"},{symbol:"MQG.AX",label:"Macquarie",cat:"ASX"},{symbol:"RIO.AX",label:"Rio Tinto",cat:"ASX"},{symbol:"WOW.AX",label:"Woolworths",cat:"ASX"},{symbol:"TLS.AX",label:"Telstra",cat:"ASX"},{symbol:"GMG.AX",label:"Goodman Group",cat:"ASX"},{symbol:"FMG.AX",label:"Fortescue",cat:"ASX"},{symbol:"XRO.AX",label:"Xero",cat:"ASX"},{symbol:"PME.AX",label:"Pro Medicus",cat:"ASX"},
  {symbol:"GC=F",label:"Gold",cat:"Commodity"},{symbol:"SI=F",label:"Silver",cat:"Commodity"},{symbol:"CL=F",label:"Crude Oil",cat:"Commodity"},{symbol:"NG=F",label:"Natural Gas",cat:"Commodity"},
];

// Dropdown autocomplete for a single ticker input - matches on symbol prefix or company/index name.
// onSelect fires with the full {symbol,label,cat} entry when a suggestion is picked (so callers can
// also auto-fill a name/label field); onChange fires on every keystroke with the raw typed value.
function TickerAutocomplete({value,onChange,onSelect,placeholder,style}){
  const t=T();
  const[open,setOpen]=useState(false);
  const[verify,setVerify]=useState(null); // null | "checking" | {ok:true,price} | {ok:false}
  const{flex,width,...inputStyle}=style||{};
  const q=(value||"").trim().toLowerCase();
  const suggestions=q.length>=1?TICKER_DB.filter(s=>
    s.symbol.toLowerCase().startsWith(q)||s.label.toLowerCase().includes(q)
  ).slice(0,6):[];

  // For anything not in our quick list, live-verify against the same quote API that
  // powers every price on the site, so the person gets a clear yes/no instead of
  // silence - silence reads as "invalid" even when it's just an unlisted symbol.
  useEffect(()=>{
    if(suggestions.length>0||q.length<2){setVerify(null);return;}
    setVerify("checking");
    let cancelled=false;
    const sym=value.trim().toUpperCase();
    const id=setTimeout(async()=>{
      try{
        const r=await quoteFetch("/api/quote?symbol="+encodeURIComponent(sym));
        const d=await r.json();
        if(!cancelled)setVerify(d&&d.price?{ok:true,price:d.price}:{ok:false});
      }catch{
        if(!cancelled)setVerify({ok:false});
      }
    },600);
    return()=>{cancelled=true;clearTimeout(id);};
  },[value]);

  return(
    <div style={{position:"relative",flex,width}}>
      <input
        type="text"
        value={value||""}
        onChange={e=>{onChange(e.target.value.toUpperCase());setOpen(true);}}
        onFocus={()=>setOpen(true)}
        onBlur={()=>setTimeout(()=>setOpen(false),150)}
        placeholder={placeholder||""}
        spellCheck={false}
        style={{background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:7,padding:"9px 12px",color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box",...inputStyle}}
      />
      {open&&suggestions.length>0&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:t.CARD,border:"1px solid "+t.GOLD+"44",borderRadius:8,zIndex:300,boxShadow:"0 8px 24px rgba(0,0,0,.5)",overflow:"hidden",maxHeight:220,overflowY:"auto"}}>
          {suggestions.map(s=>(
            <div key={s.symbol} onMouseDown={()=>{onChange(s.symbol);onSelect&&onSelect(s);setOpen(false);}}
              style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",cursor:"pointer",borderBottom:"1px solid "+t.BORDER+"33"}}
              onMouseEnter={e=>e.currentTarget.style.background=t.GOLD+"14"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div>
                <span style={{fontSize:11,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{s.symbol}</span>
                <span style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",marginLeft:8}}>{s.label}</span>
              </div>
              <span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",background:t.CARD2,padding:"1px 6px",borderRadius:8}}>{s.cat}</span>
            </div>
          ))}
        </div>
      )}
      {suggestions.length===0&&(
        verify==="checking"?<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:4}}>Checking symbol...</div>
        :verify&&verify.ok?<div style={{fontSize:9,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",marginTop:4}}>{"Valid ticker - "+fmt(verify.price)}</div>
        :verify&&verify.ok===false?<div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",marginTop:4}}>Couldn't verify this symbol - double check the format (e.g. .AX for ASX), or add it anyway if you know it's right</div>
        :null
      )}
    </div>
  );
}

// Balance history for a card: trend chart, latest update, collapsible earlier updates
function BalanceHistory({log,color,gradId,labelFor,onDelete,emptyText}){
  const t=T();
  const M="'Montserrat',sans-serif";
  const[open,setOpen]=useState(false);
  const[confirmKey,setConfirmKey]=useState(null);
  const sorted=[...(log||[])].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))||((b.id||0)-(a.id||0)));
  if(!sorted.length)return <div style={{textAlign:"center",padding:"10px 0",color:t.MUTED,fontFamily:M,fontSize:11}}>{emptyText}</div>;
  // Change is worked out from the entry before it, so it stays right after a delete
  const chg=i=>i<sorted.length-1?(parseFloat(sorted[i].balance)||0)-(parseFloat(sorted[i+1].balance)||0):(parseFloat(sorted[i].change)||0);
  const keyOf=(e,i)=>String(e.id||"")+"_"+e.date+"_"+i;
  const asc=[...sorted].reverse().slice(-12);
  const W=280,H=70,pad=6;
  const vals=asc.map(e=>parseFloat(e.balance)||0);
  const mn=Math.min(...vals)*0.98,mx=Math.max(...vals)*1.01;
  const px=i=>pad+(i/(asc.length-1||1))*(W-pad*2);
  const py=v=>H-pad-(((v-mn)/(mx-mn||1))*(H-pad*2));
  const pts=asc.map((e,i)=>px(i)+","+py(parseFloat(e.balance)||0)).join(" ");
  const row=(e,i)=>{
    const k=keyOf(e,i),c=chg(i);
    return (
      <div key={k} style={{borderTop:i>0?"1px solid "+t.BORDER:"none"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",gap:10}}>
          <div style={{minWidth:0}}>
            <div style={{fontSize:12,color:t.TEXT,fontFamily:M}}>{labelFor(e)}</div>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:M,marginTop:1}}>
              {new Date(e.date+"T12:00:00").toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"})+(e.note?" - "+e.note:"")}
              {onDelete&&confirmKey!==k&&<button onClick={()=>setConfirmKey(k)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:9,fontFamily:M,padding:"0 0 0 8px",textDecoration:"underline"}}>Delete</button>}
            </div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontSize:13,color:color,fontFamily:M,fontWeight:700}}>{fmt(parseFloat(e.balance)||0)}</div>
            {c!==0&&<div style={{fontSize:10,color:c>0?t.GREEN:t.RED,fontFamily:M}}>{(c>0?"+":"")+fmt(c)}</div>}
          </div>
        </div>
        {confirmKey===k&&(
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",background:t.RED+"14",border:"1px solid "+t.RED+"44",borderRadius:6,padding:"6px 9px",marginBottom:7}}>
            <span style={{flex:1,fontSize:10,color:t.TEXT,fontFamily:M}}>Delete this entry?</span>
            <button onClick={()=>{setConfirmKey(null);onDelete(e);}} style={{background:t.RED+"22",border:"1px solid "+t.RED+"66",borderRadius:5,padding:"3px 10px",color:t.RED,cursor:"pointer",fontSize:10,fontFamily:M,fontWeight:600}}>Delete</button>
            <button onClick={()=>setConfirmKey(null)} style={{background:"none",border:"1px solid "+t.BORDER2,borderRadius:5,padding:"3px 10px",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:M}}>Cancel</button>
          </div>
        )}
      </div>
    );
  };
  return (
    <div>
      {asc.length>=2&&(
        <div style={{marginBottom:12}}>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:M,marginBottom:6}}>Balance History</div>
          <svg viewBox={"0 0 "+W+" "+H} style={{width:"100%",height:H}}>
            <defs><linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".25"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
            <polygon points={pts+" "+px(asc.length-1)+","+H+" "+px(0)+","+H} fill={"url(#"+gradId+")"}/>
            <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
            <circle cx={px(asc.length-1)} cy={py(vals[vals.length-1])} r="3" fill={color}/>
          </svg>
        </div>
      )}
      <div style={{fontSize:9,color:t.MUTED,fontFamily:M,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Latest Update</div>
      {row(sorted[0],0)}
      {sorted.length>1&&(
        <div style={{borderTop:"1px solid "+t.BORDER}}>
          <button onClick={()=>{setOpen(o=>!o);setConfirmKey(null);}} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,fontFamily:M,padding:"8px 0 0",display:"flex",alignItems:"center",gap:6}}>
            <svg width="10" height="10" viewBox="0 0 10 10" style={{transform:open?"rotate(180deg)":"none"}}><path d="M2 3.5 L5 6.5 L8 3.5" fill="none" stroke={t.MUTED} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {open?"Hide history":"Show history ("+(sorted.length-1)+" earlier)"}
          </button>
          {open&&<div style={{marginTop:4}}>{sorted.slice(1).map((e,i)=>row(e,i+1))}</div>}
        </div>
      )}
    </div>
  );
}

// Net worth history: daily snapshots (monthly history before they began),
// range toggles, tap-for-value, month stats, next milestone and target pace
function NetWorthHistory({dailySnaps,nwHistory,nw,nwT}){
  const t=T();
  const M="'Montserrat',sans-serif",S="'Cormorant Garamond',Georgia,serif";
  const today=todayStr();
  const snaps=dailySnaps||{};
  const snapKeys=Object.keys(snaps).filter(k=>snaps[k]&&typeof snaps[k].nw==="number").sort();
  const firstSnap=snapKeys[0]||today;
  // Monthly history (mid-month points) for months before daily snapshots started
  const monthly=Object.keys(nwHistory||{}).sort().map(k=>({d:k+"-15",v:parseFloat(nwHistory[k])||0})).filter(p=>p.d.slice(0,7)<firstSnap.slice(0,7)&&p.v!==0);
  const series=[...monthly,...snapKeys.filter(k=>k<today).map(k=>({d:k,v:snaps[k].nw})),{d:today,v:Math.round(nw)}];
  const RANGES=[["1M",30],["3M",90],["1Y",365],["All",0]];
  const inRange=n=>n?series.filter(p=>p.d>=daysAgoStr(n)):series;
  const[range,setRange]=useState(()=>{const r=RANGES.find(([,n])=>n&&inRange(n).length>=2);return r?r[0]:"All";});
  const[hov,setHov]=useState(null);
  const pts=inRange((RANGES.find(r=>r[0]===range)||RANGES[3])[1]);
  const fmtD=d=>new Date(d+"T12:00:00").toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"});
  const signed=v=>(v<0?"-":"+")+fmt(Math.abs(v));
  // Chart geometry
  const W=480,H=120,pad=6;
  const vals=pts.map(p=>p.v);
  const mn=Math.min(...vals),mx=Math.max(...vals);
  const span=(mx-mn)||Math.max(Math.abs(mx)*0.02,1);
  const px=i=>pad+(pts.length>1?i/(pts.length-1):0.5)*(W-pad*2);
  const py=v=>H-pad-((v-mn)/span)*(H-pad*2)-(mx===mn?(H-pad*2)/2:0);
  const line=pts.map((p,i)=>px(i)+","+py(p.v)).join(" ");
  const rangeChange=pts.length>1?pts[pts.length-1].v-pts[0].v:null;
  const pick=e=>{
    if(pts.length<2)return;
    const r=e.currentTarget.getBoundingClientRect();
    const x=((e.clientX-r.left)/r.width)*W;
    setHov(Math.max(0,Math.min(pts.length-1,Math.round((x-pad)/(W-pad*2)*(pts.length-1)))));
  };
  // This month
  const monthStart=today.slice(0,8)+"01";
  const before=series.filter(p=>p.d<monthStart).pop();
  const firstThisMonth=series.find(p=>p.d>=monthStart);
  const monthBase=before||firstThisMonth;
  const monthChange=monthBase&&monthBase.d!==today?Math.round(nw)-monthBase.v:null;
  const adKeys=snapKeys.filter(k=>typeof snaps[k].a==="number"&&typeof snaps[k].d==="number");
  const adBase=adKeys.filter(k=>k<monthStart).pop()||adKeys.find(k=>k>=monthStart);
  const adNow=adKeys[adKeys.length-1];
  const assetsChange=adBase&&adNow&&adBase!==adNow?snaps[adNow].a-snaps[adBase].a:null;
  const debtChange=adBase&&adNow&&adBase!==adNow?snaps[adBase].d-snaps[adNow].d:null;
  // Next milestone
  const STEPS=[0,50e3,100e3,250e3,500e3,750e3,1e6,1.5e6,2e6,2.5e6,3e6,4e6,5e6,7.5e6,10e6,15e6,20e6,25e6,50e6,100e6];
  const next=STEPS.find(s=>s>nw);
  const prev=[...STEPS].reverse().find(s=>s<=nw);
  const msPct=next!==undefined&&prev!==undefined?Math.round((nw-prev)/((next-prev)||1)*100):100;
  // Pace to target: needs 90+ days of history
  const firstD=series[0]&&series[0].d;
  const daysSpan=firstD?Math.round((new Date(today+"T12:00:00")-new Date(firstD+"T12:00:00"))/864e5):0;
  let paceText=null;
  if(nw>=nwT)paceText="Target reached";
  else if(daysSpan>=90){
    const base=series.find(p=>p.d>=daysAgoStr(Math.min(daysSpan,365)))||series[0];
    const baseDays=Math.max(Math.round((new Date(today+"T12:00:00")-new Date(base.d+"T12:00:00"))/864e5),1);
    const perDay=(nw-base.v)/baseDays;
    if(perDay>0){const yr=new Date().getFullYear()+Math.ceil((nwT-nw)/perDay/365.25);paceText=yr>2100?"At this pace: 2100+":"At this pace: "+yr;}
    else paceText="Not growing over the last year";
  }
  const stat=(l,v,c)=>(
    <div style={{background:t.CARD2,borderRadius:7,padding:"8px 10px"}}>
      <div style={{fontSize:9,color:t.MUTED,fontFamily:M,marginBottom:2}}>{l}</div>
      <div style={{fontSize:13,fontWeight:600,fontFamily:M,color:c}}>{v}</div>
    </div>
  );
  const hp=hov!==null&&pts[hov]?pts[hov]:null;
  return (
    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,gap:8,flexWrap:"wrap"}}>
        <div style={{fontSize:9,letterSpacing:2,color:t.GOLD,textTransform:"uppercase",fontFamily:M}}>Net Worth History</div>
        <div style={{display:"flex",gap:4}}>
          {RANGES.map(([k])=>(
            <button key={k} onClick={()=>{setRange(k);setHov(null);}} style={{background:range===k?t.GOLD+"14":"none",border:"1px solid "+(range===k?t.GOLD:t.BORDER2),borderRadius:5,color:range===k?t.GOLD:t.MUTED,fontSize:10,padding:"3px 8px",cursor:"pointer",fontFamily:M}}>{k}</button>
          ))}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
        <span style={{fontSize:26,color:t.TEXT,fontFamily:S}}>{fmt(hp?hp.v:nw)}</span>
        {!hp&&rangeChange!==null&&<span style={{fontSize:12,fontWeight:600,fontFamily:M,color:rangeChange>=0?t.GREEN:t.RED}}>{signed(rangeChange)+" ("+range+")"}</span>}
      </div>
      <div style={{fontSize:10,color:t.MUTED,fontFamily:M,marginBottom:6}}>{hp?fmtD(hp.d):pts.length>1?"Tap the chart to see any day":"Your chart fills in as each day is recorded"}</div>
      <svg viewBox={"0 0 "+W+" "+H} style={{width:"100%",height:H,cursor:pts.length>1?"crosshair":"default",display:"block"}} onMouseMove={pick} onClick={pick} onMouseLeave={()=>setHov(null)}>
        <defs><linearGradient id="nwhg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={t.GOLD} stopOpacity=".28"/><stop offset="100%" stopColor={t.GOLD} stopOpacity="0"/></linearGradient></defs>
        {pts.length>1&&<polygon points={line+" "+px(pts.length-1)+","+H+" "+px(0)+","+H} fill="url(#nwhg)"/>}
        {pts.length>1&&<polyline points={line} fill="none" stroke={t.GOLD} strokeWidth="1.6" strokeLinejoin="round"/>}
        <circle cx={px(pts.length-1)} cy={py(pts[pts.length-1].v)} r="3.5" fill={t.GOLD}/>
        {hp&&<line x1={px(hov)} x2={px(hov)} y1="0" y2={H} stroke={t.MUTED} strokeDasharray="3 3"/>}
        {hp&&<circle cx={px(hov)} cy={py(hp.v)} r="3" fill={t.TEXT}/>}
      </svg>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:6,margin:"12px 0"}}>
        {stat("This month",monthChange===null?"-":signed(monthChange),monthChange===null?t.MUTED:monthChange>=0?t.GREEN:t.RED)}
        {stat("Assets",assetsChange===null?"-":signed(assetsChange),assetsChange===null?t.MUTED:assetsChange>=0?t.GREEN:t.RED)}
        {stat(debtChange!==null&&debtChange<0?"New debt":"Debt paid down",debtChange===null?"-":fmt(Math.abs(debtChange)),debtChange===null?t.MUTED:debtChange>=0?t.GREEN:t.RED)}
      </div>
      {next!==undefined&&(
        <div style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:10,color:t.MUTED,fontFamily:M}}>{"Next milestone: "+fmt(next)}</span>
            <span style={{fontSize:10,color:t.GOLD,fontFamily:M}}>{fmt(next-nw)+" to go"}</span>
          </div>
          <PB value={Math.max(0,Math.min(msPct,100))} color={t.GOLD} height={4}/>
        </div>
      )}
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,gap:8}}>
        <span style={{fontSize:10,color:t.MUTED,fontFamily:M}}>{Math.max(0,Math.min(Math.round(nw/nwT*100),100))+"% of "+fmt(nwT)+" target"}</span>
        <span style={{fontSize:10,color:t.MUTED,fontFamily:M}}>{paceText||"Pace shows after 3 months"}</span>
      </div>
      <PB value={Math.max(0,Math.min(Math.round(nw/nwT*100),100))} color={t.MUTED} height={4}/>
    </Card>
  );
}

// ---- Share statement import (PDF -> holdings) ----
// Exchange name/code -> Yahoo ticker suffix
const EXCHANGE_SUFFIX={ASX:".AX",AU:".AX",CHIA:".AX",CXA:".AX",NZX:".NZ",NZ:".NZ",LSE:".L",LON:".L",TSX:".TO",TSXV:".V",SGX:".SI",XETRA:".DE",FRA:".F",EPA:".PA",AMS:".AS",HKEX:".HK",HKG:".HK",TSE:".T",NYSE:"",NASDAQ:"",US:"",ARCA:"",BATS:"",AMEX:""};
const CCY_SUFFIX={AUD:".AX",NZD:".NZ",GBP:".L",CAD:".TO",SGD:".SI",HKD:".HK",JPY:".T"};
function normaliseStatementTicker(raw,exchange,currency){
  let s=String(raw||"").toUpperCase().trim().replace(/\s+/g,"");
  s=s.replace(/^(ASX|NYSE|NASDAQ|LSE):/,"");
  if(!s)return "";
  if(/\.[A-Z]{1,3}$/.test(s))return s; // already has a suffix, e.g. VHY.AX
  const ex=String(exchange||"").toUpperCase().replace(/[^A-Z]/g,"");
  if(ex in EXCHANGE_SUFFIX)return s+EXCHANGE_SUFFIX[ex];
  const cur=String(currency||"").toUpperCase();
  if(cur in CCY_SUFFIX)return s+CCY_SUFFIX[cur];
  return s;
}
// Weighted average cost from the statement's own transactions. Returns null when the
// transactions don't account for the whole holding (e.g. units bought before the statement period).
function avgCostFromTransactions(txs,units){
  if(!txs||!txs.length||!(units>0))return null;
  let u=0,cost=0;
  [...txs].sort((a,b)=>String(a.date||"").localeCompare(String(b.date||""))).forEach(x=>{
    const q=Math.abs(parseFloat(x.units)||0);
    if(!q)return;
    const px=parseFloat(x.price)||(Math.abs(parseFloat(x.amount)||0)/q);
    if(x.type==="sell"){const avg=u>0?cost/u:0;u=Math.max(u-q,0);cost=avg*u;}
    else{u+=q;cost+=q*px;}
  });
  if(!(u>0))return null;
  if(Math.abs(u-units)>Math.max(0.01,units*0.001))return null;
  return cost/u;
}

function ShareStatementImport({holdings,setHoldings,subscription,setShowUpgrade,onClose}){
  const t=T();
  const isMobile=useIsMobile();
  const M="'Montserrat',sans-serif";
  const fileRef=useRef(null);
  const[state,setState]=useState("idle"); // idle | loading | review | error | done
  const[error,setError]=useState("");
  const[meta,setMeta]=useState({});
  const[rows,setRows]=useState([]);
  const[missing,setMissing]=useState([]);
  const[formErr,setFormErr]=useState("");
  const[doneCount,setDoneCount]=useState(0);
  const userCcy=L().currency;
  const safeH=holdings||[];
  const num=v=>{const n=parseFloat(String(v).replace(/[^0-9.\-]/g,""));return isNaN(n)?null:n;};

  const handleFile=async file=>{
    if(!isPro(subscription)){setShowUpgrade&&setShowUpgrade(true);return;}
    if(!file)return;
    if(!String(file.type||"").includes("pdf")&&!/\.pdf$/i.test(file.name||"")){setState("error");setError("That isn't a PDF. Download the statement from your broker as a PDF and try again.");return;}
    if(file.size>15*1024*1024){setState("error");setError("That PDF is too large (over 15MB).");return;}
    setState("loading");setError("");setFormErr("");
    try{
      const base64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(",")[1]);r.onerror=()=>rej(new Error("Read failed"));r.readAsDataURL(file);});
      const resp=await claudeFetch({model:"claude-haiku-4-5",max_tokens:4000,messages:[{role:"user",content:[
        {type:"document",source:{type:"base64",media_type:"application/pdf",data:base64}},
        {type:"text",text:"This is a share or ETF account statement from a broker. Extract the holdings and the share transactions. Return ONLY valid JSON, no markdown, no explanation, in exactly this shape:\n"+
          "{\"broker\":\"broker or platform name\",\"asAt\":\"YYYY-MM-DD date the holdings are valued at\",\"holdings\":[{\"ticker\":\"ticker code only, e.g. VHY\",\"exchange\":\"ASX, NYSE, NASDAQ, LSE etc\",\"name\":\"security name, max 40 chars\",\"units\":number,\"currency\":\"AUD, USD etc\",\"avgPrice\":number or null,\"costBase\":number or null}],\"transactions\":[{\"date\":\"YYYY-MM-DD\",\"ticker\":\"ticker code\",\"type\":\"buy, sell or reinvest\",\"units\":number,\"price\":number or null,\"amount\":number or null}]}\n"+
          "Rules:\n- holdings: every share or ETF held at the statement date with more than 0 units. Skip cash accounts.\n- ticker: the code only, taken from the statement (often shown in brackets after the name). Do not add exchange suffixes.\n- units: the exact quantity including decimals.\n- avgPrice: the average purchase price per unit ONLY if the statement shows it. costBase: the total cost ONLY if the statement shows it. Otherwise null. Never use the current market price for these.\n- transactions: every buy, sell and dividend reinvestment (DRP) listed, with units and price per unit. Use type reinvest for dividend reinvestments. Skip deposits, withdrawals, fees and cash distributions.\n- Numbers must be plain numbers without $ signs or commas. If there are no transactions, return an empty array."}
      ]}]});
      if(!resp.ok){
        const err=await resp.json().catch(()=>({}));
        setState("error");
        setError(resp.status===403?"Executive subscription required.":resp.status===429?"Rate limit reached - try again in an hour.":err.error||"Server error ("+resp.status+").");
        return;
      }
      const d=await resp.json();
      const text=(d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").replace(/```json\s*/g,"").replace(/```\s*/g,"").trim();
      const js=JSON.parse(text.slice(text.indexOf("{"),text.lastIndexOf("}")+1));
      const found=(Array.isArray(js.holdings)?js.holdings:[]).filter(h=>h&&h.ticker&&num(h.units)>0);
      if(!found.length){setState("error");setError("No share or ETF holdings were found in this PDF. Make sure it's a holdings or annual statement from your broker.");return;}
      const txs=Array.isArray(js.transactions)?js.transactions:[];
      const built=[];
      for(let i=0;i<found.length;i++){
        const h=found[i];
        const code=String(h.ticker).toUpperCase().trim();
        const ticker=normaliseStatementTicker(code,h.exchange,h.currency);
        const units=num(h.units);
        const cur=String(h.currency||"").toUpperCase()||guessQuoteCurrency(ticker);
        let avg=null,source="";
        if(num(h.avgPrice)>0){avg=num(h.avgPrice);source="statement";}
        else if(num(h.costBase)>0){avg=num(h.costBase)/units;source="statement";}
        else{
          const mine=txs.filter(x=>String(x.ticker||"").toUpperCase().replace(/\..*$/,"")===code.replace(/\..*$/,""));
          const a=avgCostFromTransactions(mine,units);
          if(a){avg=a;source="transactions";}
        }
        let converted=false;
        if(avg&&cur&&cur!==userCcy){
          const rate=await fxRate(cur,userCcy);
          if(rate){avg=avg*rate;converted=true;}else{avg=null;source="";}
        }
        const ex=safeH.find(x=>String(x.ticker).toUpperCase()===ticker);
        const avgR=avg?Math.round(avg*1000)/1000:null;
        let status="new";
        if(ex){
          const sameUnits=Math.abs((parseFloat(ex.shares)||0)-units)<0.0001;
          const sameAvg=!avgR||Math.abs((parseFloat(ex.avgCost)||0)-avgR)<0.01;
          status=sameUnits&&sameAvg?"same":"update";
        }
        built.push({key:ticker+"_"+i,ticker,name:String(h.name||code).slice(0,40),units:String(units),avg:avgR?String(avgR):"",source,converted,fromCcy:cur,existing:ex||null,status,checked:status!=="same",priceOk:null});
      }
      setRows(built);
      setMeta({broker:String(js.broker||"").slice(0,40),asAt:/^\d{4}-\d{2}-\d{2}$/.test(js.asAt||"")?js.asAt:""});
      setMissing(safeH.filter(x=>!built.some(r=>r.ticker===String(x.ticker).toUpperCase())));
      setState("review");
      // Check each ticker has a live price so it values correctly once imported
      built.forEach(async r=>{
        let ok=false;
        try{const q=await quoteFetch("/api/quote?symbol="+encodeURIComponent(r.ticker));const qd=await q.json();ok=!!(qd&&qd.price>0);}catch{}
        setRows(rs=>rs.map(x=>x.key===r.key?{...x,priceOk:ok}:x));
      });
    }catch(err){
      setState("error");
      setError(String(err&&err.message||"").includes("JSON")?"Couldn't read this statement's layout. Try a holdings statement or annual statement PDF.":"Something went wrong: "+(err&&err.message||"unknown error"));
    }
  };

  const upd=(key,patch)=>{setRows(rs=>rs.map(r=>r.key===key?{...r,...patch}:r));setFormErr("");};
  const chosen=rows.filter(r=>r.checked);
  const confirm=()=>{
    const bad=chosen.find(r=>!(num(r.units)>0)||!(num(r.avg)>0)||!r.ticker.trim());
    if(bad){setFormErr("Enter units and an average price for "+(bad.ticker||"each holding")+", or untick it.");return;}
    setHoldings(hs=>{
      let next=[...(hs||[])];
      chosen.forEach((r,i)=>{
        const tk=r.ticker.trim().toUpperCase();
        const idx=next.findIndex(x=>String(x.ticker).toUpperCase()===tk);
        const vals={ticker:tk,shares:num(r.units),avgCost:Math.round(num(r.avg)*1000)/1000};
        if(idx>=0)next[idx]={...next[idx],...vals,name:next[idx].name||r.name};
        else next.push({id:Date.now()+i,...vals,name:r.name||tk});
      });
      return next;
    });
    setDoneCount(chosen.length);
    setState("done");
  };
  const reset=()=>{setState("idle");setRows([]);setMissing([]);setError("");setFormErr("");};
  const fmtDay=d=>d?new Date(d+"T12:00:00").toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"}):"";
  const stale=meta.asAt&&meta.asAt<daysAgoStr(14);
  const inp={background:t.CARD,border:"1px solid "+t.BORDER2,borderRadius:5,color:t.TEXT,fontSize:12,padding:"5px 7px",width:"100%",boxSizing:"border-box",fontFamily:M,outline:"none"};
  const tag=(txt,c)=><span style={{fontSize:10,padding:"2px 8px",borderRadius:10,whiteSpace:"nowrap",color:c,border:"1px solid "+c+"55",background:c+"14",fontFamily:M}}>{txt}</span>;
  const statusTag=r=>{
    if(r.status==="new")return tag("New",t.GREEN);
    if(r.status==="same")return tag("Already up to date",t.MUTED);
    const eu=parseFloat(r.existing.shares)||0,nu=num(r.units)||0;
    return tag(Math.abs(eu-nu)>=0.0001?(String(Math.round(eu*10000)/10000)+" to "+String(Math.round(nu*10000)/10000)+" units"):"Update avg price",t.GOLD);
  };

  return (
    <div style={{marginBottom:12}}>
      {state==="idle"&&(
        <div onClick={()=>fileRef.current&&fileRef.current.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();handleFile(e.dataTransfer.files[0]);}}
          style={{border:"1.5px dashed "+t.GOLD+"44",borderRadius:9,padding:"18px 14px",textAlign:"center",cursor:"pointer"}}>
          <input ref={fileRef} type="file" accept="application/pdf" style={{display:"none"}} onChange={e=>{handleFile(e.target.files[0]);e.target.value="";}}/>
          <div style={{fontSize:12,color:t.GOLD,fontFamily:M,fontWeight:600,marginBottom:3}}>Import holdings statement (PDF)</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:M}}>Drop a statement from CommSec, Betashares, Stake, SelfWealth, Pearler and others, or tap to browse</div>
          <button onClick={e=>{e.stopPropagation();onClose&&onClose();}} style={{marginTop:8,background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:M,textDecoration:"underline"}}>Close</button>
        </div>
      )}
      {state==="loading"&&(
        <div style={{textAlign:"center",padding:"22px 0",background:t.CARD2,borderRadius:9}}>
          <div style={{fontSize:12,color:t.GOLD,fontFamily:M,marginBottom:3}}>Reading your statement...</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:M}}>Finding your holdings, units and average prices</div>
        </div>
      )}
      {state==="error"&&(
        <div style={{padding:"12px 14px",background:t.RED+"12",border:"1px solid "+t.RED+"44",borderRadius:9,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div style={{fontSize:11,color:t.TEXT,fontFamily:M,flex:1,minWidth:180}}>{error}</div>
          <Btn onClick={reset} variant="ghost" style={{fontSize:11}}>Try again</Btn>
        </div>
      )}
      {state==="done"&&(
        <div style={{padding:"12px 14px",background:t.GREEN+"12",border:"1px solid "+t.GREEN+"44",borderRadius:9,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
          <div style={{fontSize:11,color:t.GREEN,fontFamily:M}}>{doneCount+" "+(doneCount===1?"holding":"holdings")+" imported - live prices update shortly"}</div>
          <button onClick={()=>{reset();onClose&&onClose();}} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,fontFamily:M}}>Close</button>
        </div>
      )}
      {state==="review"&&(
        <div style={{background:t.CARD2,border:"1px solid "+t.GOLD+"33",borderRadius:9,padding:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",flexWrap:"wrap",gap:6,marginBottom:3}}>
            <span style={{fontSize:13,color:t.TEXT,fontFamily:M,fontWeight:600}}>{rows.length+" "+(rows.length===1?"holding":"holdings")+" found"}</span>
            {(meta.broker||meta.asAt)&&<span style={{fontSize:10,color:t.MUTED,fontFamily:M}}>{[meta.broker,meta.asAt?"as at "+fmtDay(meta.asAt):""].filter(Boolean).join(" - ")}</span>}
          </div>
          <div style={{fontSize:10,color:t.MUTED,fontFamily:M,marginBottom:stale?6:8,lineHeight:1.5}}>{"Check the figures, edit anything that looks off, then import. Average prices are per unit in "+userCcy+"."}</div>
          {stale&&<div style={{fontSize:10,color:t.GOLD,fontFamily:M,marginBottom:8,lineHeight:1.5}}>{"This statement is as at "+fmtDay(meta.asAt)+". Any trades since then aren't included."}</div>}
          {!isMobile&&(
            <div style={{display:"grid",gridTemplateColumns:"20px minmax(0,1.5fr) minmax(0,0.9fr) minmax(0,0.9fr) minmax(0,1.1fr)",gap:8,padding:"0 0 4px"}}>
              <span/><span style={{fontSize:10,color:t.MUTED,fontFamily:M}}>Holding</span><span style={{fontSize:10,color:t.MUTED,fontFamily:M}}>Units</span><span style={{fontSize:10,color:t.MUTED,fontFamily:M}}>Avg price</span><span/>
            </div>
          )}
          {rows.map(r=>{
            const needAvg=r.checked&&!(num(r.avg)>0);
            const note=[r.source==="transactions"?"Avg price worked out from your buys and sells":r.source==="statement"?"Avg price from statement":"",r.converted?"converted from "+r.fromCcy+" at today's rate":""].filter(Boolean).join(", ");
            const box=(
              <input type="checkbox" checked={r.checked} onChange={e=>upd(r.key,{checked:e.target.checked})} style={{width:15,height:15,accentColor:t.GOLD,margin:0}}/>
            );
            const nameCol=(
              <div style={{minWidth:0}}>
                {r.priceOk===false?(
                  <input value={r.ticker} onChange={e=>upd(r.key,{ticker:e.target.value.toUpperCase(),priceOk:null})} style={{...inp,width:110,fontWeight:600,borderColor:t.RED+"88"}}/>
                ):<div style={{fontSize:12,color:t.TEXT,fontFamily:M,fontWeight:600}}>{r.ticker}</div>}
                <div style={{fontSize:10,color:t.MUTED,fontFamily:M,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.name}</div>
                {r.priceOk===false&&<div style={{fontSize:10,color:t.RED,fontFamily:M}}>No live price found for this ticker - check it</div>}
                {note&&<div style={{fontSize:9,color:t.MUTED,fontFamily:M,marginTop:1}}>{note}</div>}
              </div>
            );
            const unitsIn=<input value={r.units} inputMode="decimal" onChange={e=>upd(r.key,{units:e.target.value})} style={inp}/>;
            const avgIn=<input value={r.avg} inputMode="decimal" placeholder="Required" onChange={e=>upd(r.key,{avg:e.target.value})} style={{...inp,borderColor:needAvg?t.RED+"99":t.BORDER2}}/>;
            return isMobile?(
              <div key={r.key} style={{borderTop:"1px solid "+t.BORDER,padding:"9px 0"}}>
                <div style={{display:"grid",gridTemplateColumns:"20px minmax(0,1fr)",gap:8,alignItems:"start",marginBottom:6}}>
                  <div style={{paddingTop:2}}>{box}</div>
                  <div style={{minWidth:0}}>{nameCol}<div style={{marginTop:4}}>{statusTag(r)}</div></div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:8,paddingLeft:28}}>
                  <div><div style={{fontSize:9,color:t.MUTED,fontFamily:M,marginBottom:2}}>Units</div>{unitsIn}</div>
                  <div><div style={{fontSize:9,color:t.MUTED,fontFamily:M,marginBottom:2}}>{"Avg price ("+userCcy+")"}</div>{avgIn}</div>
                </div>
              </div>
            ):(
              <div key={r.key} style={{display:"grid",gridTemplateColumns:"20px minmax(0,1.5fr) minmax(0,0.9fr) minmax(0,0.9fr) minmax(0,1.1fr)",gap:8,alignItems:"center",borderTop:"1px solid "+t.BORDER,padding:"9px 0"}}>
                {box}{nameCol}{unitsIn}{avgIn}<div style={{textAlign:"right"}}>{statusTag(r)}</div>
              </div>
            );
          })}
          <div style={{borderTop:"1px solid "+t.BORDER,paddingTop:9}}>
            {missing.length>0&&<div style={{fontSize:10,color:t.MUTED,fontFamily:M,marginBottom:8,lineHeight:1.5}}>{"Not on this statement: "+missing.map(x=>x.ticker+" ("+(Math.round((parseFloat(x.shares)||0)*10000)/10000)+" units)").join(", ")+" - kept as is."}</div>}
            {formErr&&<div style={{fontSize:11,color:t.RED,fontFamily:M,marginBottom:8}}>{formErr}</div>}
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <Btn onClick={confirm} disabled={!chosen.length} style={{fontSize:12}}>{chosen.length?"Import "+chosen.length+" "+(chosen.length===1?"holding":"holdings"):"Nothing selected"}</Btn>
              <Btn onClick={()=>{reset();onClose&&onClose();}} variant="ghost" style={{fontSize:12}}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WealthPage({subscription,setShowUpgrade,dailySnaps,debtList,profile,onUpdateProfile,nwHistory,setShowRecalibrate,holdings,setHoldings,portfolio,cryptoHoldings,setCryptoHoldings,cryptoPortfolio,commodityHoldings,setCommodityHoldings,commodityPortfolio,altAssets,setAltAssets,properties,setProperties,superLog,setSuperLog,setPage}){
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
  const[showImport,setShowImport]=useState(false);
  const[showCashAdd,setShowCashAdd]=useState(false);
  const[cashForm,setCashForm]=useState({balance:"",date:todayStr(),note:""});
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
  const propertyTotal=(properties||[]).reduce((s,p)=>s+(parseFloat(p.currentValue)||0),0);
  const mortgageTotal=(properties||[]).reduce((s,p)=>s+propertyLoanBalance(p,debtList),0);
  // Live Debt tab balances by loan type (loans linked to a property are counted in the Property row)
  const hasDebtTab=!!(debtList&&debtList.length);
  const debtTabSum=types=>(debtList||[]).filter(d=>types.indexOf(d.type||"Other")>=0&&!(properties||[]).some(p=>(p.linkedDebtIds||[]).some(x=>idEq(x,d.id)))).reduce((s,d)=>s+Math.max(parseFloat(d.balance)||0,0),0);
  const OTHER_LOAN_TYPES=["Mortgage","Student Loan","Business Loan","Other"];
  const cashManual=parseFloat(profile.cashSavings)||0;
  const cashOffset=parseFloat(profile.offsetCash)||0;
  const cashTotal=cashManual+cashOffset;
  const assets=[
    {type:"shares",value:parseFloat(profile.shareValue)||0},{type:"property",value:propertyTotal},
    {type:"super",value:parseFloat(profile.superBalance)||0},{type:"cash",value:cashTotal},
    {type:"crypto",value:parseFloat(profile.cryptoValue)||0},
    {type:"commodities",value:commodityPortfolio?.totalValue||0},
    {type:"alternative",value:(altAssets||[]).reduce((s,a)=>s+(parseFloat(a.currentValue)||0),0)}
  ];
  const debts=(debtList&&debtList.length)?[
    ...debtList.filter(d=>parseFloat(d.balance)>0).map(d=>({id:d.id,l:d.name||d.type||"Loan",v:parseFloat(d.balance)||0})),
    ...(unlinkedPropertyDebt(properties,debtList)>0?[{l:"Property mortgages (not on Debt tab)",v:unlinkedPropertyDebt(properties,debtList)}]:[])
  ]:[{l:"Mortgage",v:mortgageTotal},{l:"Investment Loan",k:"investLoanDebt"},{l:"Car Finance",k:"carDebt"},{l:"Credit Cards",k:"creditCardDebt"},{l:"Personal Loans",k:"personalDebt"}].filter(d=>d.v>0||parseFloat(profile[d.k])>0);
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
        
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14,marginBottom:14}}>
        <NetWorthHistory dailySnaps={dailySnaps} nwHistory={nwHistory} nw={nw} nwT={nwT}/>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <Card style={{padding:"12px 14px"}}>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>Net Equity Breakdown</div>
            {[
              {l:"Property",asset:propertyTotal,debt:mortgageTotal,c:"#7A9E7E"},
              {l:"Shares",asset:parseFloat(profile.shareValue)||0,debt:hasDebtTab?debtTabSum(["Investment Loan"]):(parseFloat(profile.investLoanDebt)||0),c:t.GOLD},
              {l:"Super",asset:parseFloat(profile.superBalance)||0,debt:0,c:t.BLUE},
              {l:"Cash",asset:cashTotal,debt:0,c:"#7EB8C9"},
              {l:"Crypto",asset:parseFloat(profile.cryptoValue)||0,debt:0,c:t.PURPLE},
              {l:"Commodities",asset:commodityPortfolio?.totalValue||0,debt:0,c:"#D9A66C"},
              {l:"Alternative Assets",asset:(altAssets||[]).reduce((s,a)=>s+(parseFloat(a.currentValue)||0),0),debt:0,c:"#8C8C9E"},
              {l:"Credit Cards",asset:0,debt:hasDebtTab?debtTabSum(["Credit Card"]):(parseFloat(profile.creditCardDebt)||0),c:t.RED},
              {l:"Personal Loans",asset:0,debt:hasDebtTab?debtTabSum(["Personal Loan"]):(parseFloat(profile.personalDebt)||0),c:t.RED},
              {l:"Car Finance",asset:0,debt:hasDebtTab?debtTabSum(["Car Finance"]):(parseFloat(profile.carDebt)||0),c:t.RED},
              {l:"Other Loans",asset:0,debt:hasDebtTab?debtTabSum(OTHER_LOAN_TYPES):0,c:t.RED},
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
            <button onClick={()=>{setShowImport(s=>!s);setShowAdd(false);}} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:6,padding:"3px 8px",color:t.GOLD,cursor:"pointer",fontSize:10}}>Import statement</button>
            <button onClick={()=>{setShowAdd(s=>!s);setShowImport(false);}} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:6,padding:"3px 8px",color:t.GOLD,cursor:"pointer",fontSize:10}}>+ Add</button>
          </div>
        }>Share Portfolio - Live</SectionLabel>
        {showImport&&<ShareStatementImport holdings={holdings} setHoldings={setHoldings} subscription={subscription} setShowUpgrade={setShowUpgrade} onClose={()=>setShowImport(false)}/>}
        {showAdd&&(
          <div style={{padding:12,background:t.CARD2,borderRadius:7,border:"1px solid "+t.BORDER,marginBottom:12}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:7,marginBottom:7}}>
              {[["Ticker","ticker","BHP.AX"],["Shares","shares","100"],["Avg Cost ("+L().currency+")","avgCost","45.20"],["Label","name","BHP Group"]].map(([l,k,ph])=>(
                <div key={k}>
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>{l}</div>
                  {k==="ticker"
                    ?<TickerAutocomplete value={hForm.ticker} onChange={v=>setHForm(f=>({...f,ticker:v}))} onSelect={s=>setHForm(f=>({...f,ticker:s.symbol,name:f.name||s.label}))} placeholder={ph} style={{fontSize:12,padding:"7px 9px"}}/>
                    :<Inp value={hForm[k]} onChange={e=>setHForm(f=>({...f,[k]:e.target.value}))} placeholder={ph} style={{fontSize:12,padding:"7px 9px"}}/>
                  }
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
                          <span style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{fmtPx(liveData)}</span>
                          {liveData.pct!==0&&<span style={{fontSize:10,color:liveData.pct>=0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif"}}>{(liveData.pct>=0?"+":"")+((liveData.pct)||0).toFixed(2)+"%"}</span>}
                          {dayChange!==null&&<span style={{fontSize:10,color:dayChange>=0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif"}}>{"("+(dayChange>=0?"+":"")+fmt(dayChange)+" today)"}</span>}
                        </>
                      ):(
                        <span style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{sP.loading?<Skeleton width={70} height={12}/>:(liveData&&liveData.fxMissing?"Exchange rate unavailable":"No live price")}</span>
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
                  <button onClick={()=>setHoldings(hs=>(hs||[]).filter(x=>x.id!==h.id))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:12,marginLeft:6,opacity:.5}}><Icon name="x"/></button>
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
                    <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>{"Avg Cost ("+L().currency+")"}</div>
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
                          <span style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{fmtPx(liveData)}</span>
                          {liveData.pct!==0&&<span style={{fontSize:10,color:liveData.pct>=0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif"}}>{(liveData.pct>=0?"+":"")+((liveData.pct)||0).toFixed(2)+"%"}</span>}
                        </>
                      ):(
                        <span style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{cryptoPortfolio?.loading?<Skeleton width={70} height={12}/>:(liveData&&liveData.fxMissing?"Exchange rate unavailable":"No live price")}</span>
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
                  <button onClick={()=>setCryptoHoldings(cs=>(cs||[]).filter(x=>x.ticker!==h.ticker))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:12,marginLeft:6,opacity:.5}}><Icon name="x"/></button>
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
                            <span style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{fmtPx(liveData)+"/"+h.unit}</span>
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

        {/* ── PROPERTY (summary, links to dedicated page) ── */}
        <Card style={{marginBottom:12,cursor:"pointer"}} onClick={()=>setPage&&setPage("property")}>
          <SectionLabel action={<span style={{fontSize:11,color:t.GOLD,fontFamily:"'Montserrat',sans-serif"}}>View all →</span>}>Property</SectionLabel>
          {(properties||[]).length===0?(
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>No properties tracked yet — tap to add one</div>
          ):(
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{(properties||[]).length} {(properties||[]).length===1?"property":"properties"}</span>
              <span style={{fontSize:14,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{fmt(propertyTotal)}</span>
            </div>
          )}
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
                  <button onClick={()=>setAltAssets(as=>(as||[]).filter(x=>x.id!==a.id))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,marginLeft:6,opacity:.5}}><Icon name="x"/></button>
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

        {/* CASH AND SAVINGS */}
        <Card style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <SectionLabel>Cash and Savings</SectionLabel>
            <button onClick={()=>setShowCashAdd(s=>!s)} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:6,padding:"5px 11px",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>+ Update Balance</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,minmax(0,1fr))",gap:8,marginBottom:12}}>
            {[
              {l:"Bank Accounts",v:fmt(cashManual),c:t.BLUE,s:"Everyday and savings"},
              {l:"Offset Accounts",v:fmt(cashOffset),c:t.GREEN,s:"From your Debt tab"},
              {l:"Total Cash",v:fmt(cashTotal),c:t.GOLD,s:"Counted in net worth"},
            ].map(s=>(
              <div key={s.l} style={{background:t.CARD2,borderRadius:6,padding:"8px",textAlign:"center"}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>{s.l}</div>
                <div style={{fontSize:14,color:s.c,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{s.v}</div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>{s.s}</div>
              </div>
            ))}
          </div>
          {showCashAdd&&(
            <div style={{background:t.CARD2,borderRadius:8,padding:12,marginBottom:12,border:"1px solid "+t.GOLD+"33"}}>
              <div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Update Bank Accounts</div>
              <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                <div style={{flex:"2 1 150px",minWidth:0}}>
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Total across your bank accounts ($)</div>
                  <Inp type="number" value={cashForm.balance} onChange={e=>setCashForm(f=>({...f,balance:e.target.value}))} placeholder={String(cashManual||0)}/>
                </div>
                <div style={{flex:"1 1 140px",minWidth:0}}>
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Date</div>
                  <Inp type="date" value={cashForm.date} onChange={e=>setCashForm(f=>({...f,date:e.target.value}))}/>
                </div>
              </div>
              <Inp value={cashForm.note} onChange={e=>setCashForm(f=>({...f,note:e.target.value}))} placeholder="Note (optional)" style={{marginBottom:8}}/>
              <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:10,lineHeight:1.5}}>Don't include money in offset accounts - it's added automatically from the offset balance on your Debt tab.</div>
              <div style={{display:"flex",gap:7}}>
                <Btn onClick={()=>{
                  if(cashForm.balance==="")return;
                  const amount=parseFloat(cashForm.balance)||0;
                  const entry={id:Date.now(),date:cashForm.date||todayStr(),balance:amount,change:amount-cashManual,note:cashForm.note};
                  if(onUpdateProfile)onUpdateProfile(p=>({...p,cashSavings:String(amount),cashLog:[entry,...((p&&p.cashLog)||[])].slice(0,60)}));
                  setCashForm({balance:"",date:todayStr(),note:""});
                  setShowCashAdd(false);
                }} style={{fontSize:11}}>Save</Btn>
                <Btn onClick={()=>setShowCashAdd(false)} variant="ghost" style={{fontSize:11}}>Cancel</Btn>
              </div>
            </div>
          )}
          <BalanceHistory log={profile.cashLog||[]} color={t.BLUE} gradId="cashg" emptyText="Tap + Update Balance whenever your savings change"
            labelFor={()=>"Balance Update"}
            onDelete={e=>{
              if(!onUpdateProfile)return;
              onUpdateProfile(p=>{
                const next=((p&&p.cashLog)||[]).filter(x=>!(x===e||(e.id&&x.id===e.id)));
                const latest=[...next].sort((x,y)=>String(y.date||"").localeCompare(String(x.date||""))||((y.id||0)-(x.id||0)))[0];
                return {...p,cashLog:next,...(latest?{cashSavings:String(latest.balance)}:{})};
              });
            }}/>
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
              <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                <div style={{flex:"1 1 140px",minWidth:0,order:1}}>{/* SUPER_FORM_V1 */}
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>New Balance ($)</div>
                  <Inp type="number" value={superForm.balance} onChange={e=>setSuperForm(f=>({...f,balance:e.target.value}))} placeholder={profile.superBalance||"0"}/>
                </div>
                <div style={{flex:"1 1 100%",minWidth:0,order:3}}>
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Type</div>
                  <Sel value={superForm.type} onChange={e=>setSuperForm(f=>({...f,type:e.target.value}))}>
                    <option value="balance">Balance Update</option>
                    <option value="contribution">Contribution</option>
                    <option value="employer">Employer Contribution</option>
                    <option value="growth">Investment Growth</option>
                  </Sel>
                </div>
                <div style={{flex:"1 1 140px",minWidth:0,order:2}}>
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
                  if(onUpdateProfile)onUpdateProfile(p=>({...p,superBalance:String(amount)}));
                  setSuperForm({balance:"",type:"balance",date:todayStr(),note:""});
                  setShowSuperAdd(false);
                }} style={{fontSize:11}}>Save</Btn>
                <Btn onClick={()=>setShowSuperAdd(false)} variant="ghost" style={{fontSize:11}}>Cancel</Btn>
              </div>
            </div>
          )}

          <BalanceHistory log={superLog} color={t.PURPLE} gradId="sg" emptyText="Tap + Update Balance to track your super growth over time"
            labelFor={e=>e.type==="balance"?"Balance Update":e.type==="contribution"?"Personal Contribution":e.type==="employer"?"Employer Contribution":"Investment Growth"}
            onDelete={e=>{
              const next=(superLog||[]).filter(x=>x!==e);
              setSuperLog(next);
              const latest=[...next].sort((x,y)=>String(y.date||"").localeCompare(String(x.date||""))||((y.id||0)-(x.id||0)))[0];
              if(latest&&onUpdateProfile)onUpdateProfile(p=>({...p,superBalance:String(latest.balance)}));
            }}/>
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

function DebtPage({profile,setProfile,properties,debts,setDebts,subscription,setShowUpgrade}){
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
  const emptyForm={name:"",type:"Mortgage",originalBalance:"",balance:"",rate:"",minPayment:"",frequency:"monthly",nextPaymentDate:"",offsetBalance:"",startDate:"",endDate:"",lender:"",notes:""};
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
  const calcPayoff=(bal,rate,payment,offset)=>{
    if(!payment||payment<=0)return null;
    const r=(parseFloat(rate)||0)/100/12;
    const b=parseFloat(bal)||0;
    if(r===0)return Math.ceil(b/payment);
    const o=Math.min(Math.max(parseFloat(offset)||0,0),b);
    const bp=b-o; // interest is only charged on the part not covered by the offset
    if(payment<=bp*r)return null; // interest only
    return Math.ceil(Math.log((payment+r*o)/(payment-r*bp))/Math.log(1+r));
  };

  const calcTotalInterest=(bal,rate,payment,offset)=>{
    const months=calcPayoff(bal,rate,payment,offset);
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
        offsetBalance:form.offsetBalance===""||form.offsetBalance==null?"":parseFloat(form.offsetBalance)||0,
      }:d));
    } else {
      const newDebt={
        id:Date.now(),name:form.name,type:form.type,
        balance:curBal,originalBalance:origBal,
        rate:form.rate===""?"":parseFloat(form.rate)||0,
        minPayment:parseFloat(form.minPayment)||0,
        frequency:form.frequency||"monthly",
        nextPaymentDate:form.nextPaymentDate||"",
        offsetBalance:form.offsetBalance===""||form.offsetBalance==null?"":parseFloat(form.offsetBalance)||0,
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
      offsetBalance:d.offsetBalance||"",
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
      return{...d,balance:newBal,payments:sortPaymentsDesc([{date:todayStr(),amount:amt,principal:amt,interest:0,balance:newBal,id:Date.now(),note:"Extra payment"},...(d.payments||[])]).slice(0,120)};
    }));
    setPayingDebt(null);setPayAmount("");
  };

  const getAiAdvice=async()=>{
    if(!isPro(subscription)){setShowUpgrade(true);return;}
    setAiLoading(true);setAiAdvice("");
    const debtSummary=allDebts.map(d=>{
      const payment=debtMonthlyEq(d);
      const months=calcPayoff(d.balance,d.rate,payment+extra/Math.max(allDebts.length,1));
      return d.name+" - Balance: "+fmt(d.balance)+" - Rate: "+(d.rate||0)+"% - Repayments (monthly equivalent): "+fmt(payment)+" - Payoff: "+(months?"~"+months+" months":"unknown");
    }).join("\n");
    try{
      const r=await claudeFetch({
        model:"claude-sonnet-4-6",max_tokens:800,
        system:GENERAL_INFO_RULE+" You are Executive AI. Explain general debt payoff strategies (such as avalanche, snowball, extra repayments and using an offset) worked through with the numbers provided. No fluff.",
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
            <div style={{fontSize:10,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",letterSpacing:1,textTransform:"uppercase"}}>Debt Strategy - Executive AI</div>
            <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>Payoff strategies worked through with your numbers</div>
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
            {(form.type==="Mortgage"||form.type==="Investment Loan")&&(
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Offset Account Balance (optional)</div>
                <Inp type="number" value={form.offsetBalance||""} onChange={e=>setForm(f=>({...f,offsetBalance:e.target.value}))} placeholder="Money sitting in your offset account"/>
              </div>
            )}
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
        const months=calcPayoff(bal,d.rate,payment,d.offsetBalance);
        const totalInt=calcTotalInterest(bal,d.rate,payment,d.offsetBalance);
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
                  {parseFloat(d.offsetBalance)>0&&<span style={{fontSize:10,color:t.GREEN,fontFamily:"'Montserrat',sans-serif"}}>{"Offset "+fmt(parseFloat(d.offsetBalance))}</span>}
                  {(properties||[]).filter(p=>(p.linkedDebtIds||[]).some(x=>idEq(x,d.id))).map(p=><span key={"lp"+p.id} style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{"Linked to "+(p.nickname||"property")}</span>)}
                  {!d.nextPaymentDate&&parseFloat(d.balance)>0&&<span style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>No payment date - tap Edit to track repayments automatically</span>}
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
                    {sortPaymentsDesc(d.payments).slice(0,6).map((p,pi)=>(
                      <div key={p.id||(p.date+"_"+pi)} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"5px 0",borderBottom:"1px solid "+t.BORDER+"66",fontSize:11,fontFamily:"'Montserrat',sans-serif"}}>
                        <span style={{color:t.MUTED}}>{fmtDateNum(p.date)+(p.auto?" - scheduled":p.note?" - "+p.note:"")}{p.interest>0?<span style={{display:"block",fontSize:9,marginTop:2}}>{fmt(p.principal)+" off the loan, "+fmt(p.interest)+" interest"}</span>:null}</span>
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
                  setDebts(base.map(x=>x.id===d.id?{...x,balance:0,payments:sortPaymentsDesc([{date:todayStr(),amount:bal,principal:bal,interest:0,balance:0,id:Date.now(),note:"Paid in full"},...(x.payments||[])]).slice(0,120)}:x));
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
          <div style={{fontSize:32,marginBottom:12,display:"flex",justifyContent:"center",color:t.GOLD}}><Icon name="trending-down" stroke={1.2}/></div>
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

  // Duplicate detection — same date+type+amount, often caused by importing overlapping bank statements
  const dupeKey=tx=>tx.date+"|"+tx.type+"|"+Math.round((parseFloat(tx.amount)||0)*100);
  const dupeGroups=Object.values(transactions.reduce((m,tx)=>{const k=dupeKey(tx);(m[k]=m[k]||[]).push(tx);return m;},{})).filter(g=>g.length>1);
  const dupeExtraCount=dupeGroups.reduce((s,g)=>s+g.length-1,0);

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
      // Flag likely duplicates - same date/type/amount already saved, or repeated within this same statement (common with overlapping statement periods)
      const existingKeys={};
      transactions.forEach(tx=>{const k=dupeKey(tx);existingKeys[k]=(existingKeys[k]||0)+1;});
      const seenInBatch={};
      const withDupes=valid.map(tx=>{
        const k=dupeKey(tx);
        const dupe=!!existingKeys[k]||!!seenInBatch[k];
        seenInBatch[k]=(seenInBatch[k]||0)+1;
        return{...tx,dupe};
      });
      setExtracted(withDupes);const sel={};withDupes.forEach(tx=>{sel[tx.id]=!tx.dupe;});setSelected(sel);setPdfState("review");
    }catch(err){
      setPdfState("error");
      setPdfError(err.message?.includes("JSON")?"Could not parse the statement — try a different PDF format.":"Something went wrong: "+err.message);
    }
  };
  const confirmImport=()=>{setTransactions(ts=>[...extracted.filter(tx=>selected[tx.id]).map(({dupe,...tx})=>({...tx,id:Date.now()+Math.random()})),...ts]);setExtracted([]);setSelected({});setPdfState("idle");};
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

      {/* Duplicate transaction warning - visible regardless of active tab, since it affects the totals above */}
      {dupeExtraCount>0&&(
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",padding:"9px 14px",background:t.RED+"14",border:"1px solid "+t.RED+"44",borderRadius:8,marginBottom:14}}>
          <div style={{fontSize:11,color:t.RED,fontFamily:"'Montserrat',sans-serif"}}>{"⚠ "+dupeExtraCount+" possible duplicate "+(dupeExtraCount===1?"transaction is":"transactions are")+" currently included in the totals above - likely from overlapping statement imports"}</div>
          <button onClick={()=>setActiveTab("transactions")} style={{background:"none",border:"1px solid "+t.RED+"44",borderRadius:6,padding:"5px 12px",color:t.RED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:10,flexShrink:0}}>Review Duplicates</button>
        </div>
      )}

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
                <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{extracted.length+" found"+(extracted.filter(tx=>tx.dupe).length>0?" · "+extracted.filter(tx=>tx.dupe).length+" possible duplicates":"")+" · "+Object.values(selected).filter(Boolean).length+" selected"}</div>
                <div style={{display:"flex",gap:7}}>
                  <button onClick={()=>{const all=Object.values(selected).every(Boolean);const s={};extracted.forEach(tx=>{s[tx.id]=!all;});setSelected(s);}} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:5,padding:"4px 9px",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>{Object.values(selected).every(Boolean)?"Deselect All":"Select All"}</button>
                  <Btn onClick={confirmImport} disabled={!Object.values(selected).some(Boolean)} style={{fontSize:10,padding:"4px 10px"}}>{"Import "+Object.values(selected).filter(Boolean).length}</Btn>
                  <Btn onClick={()=>{setExtracted([]);setSelected({});setPdfState("idle");}} variant="ghost" style={{fontSize:10,padding:"4px 9px"}}>Cancel</Btn>
                </div>
              </div>
              <div style={{maxHeight:280,overflowY:"auto",border:"1px solid "+t.BORDER,borderRadius:7}}>
                {extracted.map((tx,i)=>(
                  <div key={tx.id} onClick={()=>setSelected(s=>({...s,[tx.id]:!s[tx.id]}))} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderBottom:i<extracted.length-1?"1px solid "+t.BORDER:"none",cursor:"pointer",background:selected[tx.id]?t.GOLD+"08":tx.dupe?t.RED+"08":"transparent"}}>
                    <div style={{width:14,height:14,borderRadius:3,border:"1.5px solid "+(selected[tx.id]?t.GOLD:t.BORDER2),background:selected[tx.id]?t.GOLD:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {selected[tx.id]&&<span style={{fontSize:8,color:"#080808",fontWeight:700}}><Tick/></span>}
                    </div>
                    <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",width:80,flexShrink:0}}>{tx.date}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tx.note}</div>
                      {tx.dupe&&<div style={{fontSize:8,color:t.RED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:.5,marginTop:1}}>Possible duplicate</div>}
                    </div>
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
                <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                  <Inp type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={{flex:"1 1 140px"}}/>
                  <Sel value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{flex:"1.5 1 150px"}}>
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
          {/* Duplicate cleanup */}
          {dupeExtraCount>0&&(
            <Card style={{marginBottom:14,borderColor:t.RED+"44"}}>
              <div style={{fontSize:12,color:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600,marginBottom:4}}>{"⚠ "+dupeExtraCount+" possible duplicate "+(dupeExtraCount===1?"transaction":"transactions")+" found"}</div>
              <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:10}}>Same date, type and amount - often caused by importing overlapping bank statement periods. These are currently counted in your cash flow totals. Remove the extras below to fix it.</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {dupeGroups.map((g,gi)=>(
                  <div key={gi} style={{border:"1px solid "+t.BORDER,borderRadius:7,overflow:"hidden"}}>
                    {g.map((tx,i)=>(
                      <div key={tx.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 10px",borderBottom:i<g.length-1?"1px solid "+t.BORDER:"none",background:i===0?"transparent":t.RED+"08"}}>
                        <div>
                          <div style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{tx.category}{tx.note&&<span style={{color:t.MUTED}}>{" - "+tx.note}</span>}</div>
                          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:1}}>{tx.date+(i===0?" - keeping this one":" - likely duplicate")}</div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{fontSize:11,color:tx.type==="income"?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{(tx.type==="income"?"+":"-")+fmt(tx.amount)}</div>
                          <button onClick={()=>setTransactions(ts=>ts.filter(x=>x.id!==tx.id))} style={{background:"none",border:"1px solid "+t.RED+"44",borderRadius:5,padding:"3px 8px",color:t.RED,cursor:"pointer",fontSize:9,fontFamily:"'Montserrat',sans-serif"}}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          )}
          {shown.length===0?<div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}><div style={{fontSize:28,marginBottom:10,display:"flex",justifyContent:"center",color:t.GOLD}}><Icon name="arrow-left-right" stroke={1.2}/></div><div>No transactions yet</div></div>:
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
                    <button onClick={()=>setTransactions(ts=>ts.filter(x=>x.id!==tx.id))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.5}}><Icon name="x"/></button>
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

// LOAN_DUP_HINT: a bill that looks like the same repayment as a Debt tab loan
function loanForBill(b,loans){
  const amt=parseFloat(b.amount)||0;const n=String(b.name||"").toLowerCase();
  if(!/loan|finance|mortgage|repayment/.test(n))return null;
  return (loans||[]).find(d=>Math.abs((parseFloat(d.minPayment)||0)-amt)<1&&(d.frequency||"monthly")===b.frequency)||null;
}
function BillsPage({bills,setBills,debts,setPage}){
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

  // Loan repayments come straight from the Debt tab (edit them there)
  const loans=(debts||[]).filter(d=>(parseFloat(d.minPayment)||0)>0&&(parseFloat(d.balance)||0)>0);
  const loanMonthly=d=>(parseFloat(d.minPayment)||0)*(({weekly:52,fortnightly:26,monthly:12,quarterly:4,annually:1})[d.frequency||"monthly"]||12)/12;
  const loanTotal=loans.reduce((s,d)=>s+loanMonthly(d),0);
  const dupOf=b=>loanForBill(b,loans);
  const totalMonthly=bills.filter(b=>!dupOf(b)).reduce((s,b)=>s+monthlyEq(b),0)+loanTotal;
  const loanUpcoming=loans.filter(d=>{if(!d.nextPaymentDate)return false;const x=(new Date(d.nextPaymentDate+"T12:00:00")-new Date())/864e5;return x>=-1&&x<=7;}).map(d=>({id:"loan_"+d.id,name:d.name||d.type||"Loan",amount:parseFloat(d.minPayment)||0,nextDue:d.nextPaymentDate,isLoan:true}));
  const upcoming=[...bills.filter(b=>!dupOf(b)).filter(b=>{const d=(new Date(b.nextDue+"T12:00:00")-new Date())/864e5;return d>=0&&d<=7;}),...loanUpcoming].sort((a,b)=>new Date(a.nextDue)-new Date(b.nextDue));

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
          {loanTotal>0&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>{"incl. "+fmtAmt(loanTotal)+" loan repayments"}</div>}
        </Card>
        <Card style={{textAlign:"center",padding:"12px 8px"}}>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Annual Total</div>
          <div style={{fontSize:22,color:t.GOLD,fontWeight:700}}>{fmtAmt(totalMonthly*12)}</div>
        </Card>
        <Card style={{textAlign:"center",padding:"12px 8px"}}>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Bills Tracked</div>
          <div style={{fontSize:22,color:t.BLUE,fontWeight:700}}>{bills.filter(b=>!dupOf(b)).length+loans.length}</div>
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
                    {b.isLoan?<span style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif"}}>Loan - auto</span>:<button onClick={()=>markPaid(b.id)} style={{background:t.GREEN+"18",border:"1px solid "+t.GREEN+"44",borderRadius:5,padding:"4px 9px",color:t.GREEN,cursor:"pointer",fontSize:11,fontFamily:"'Montserrat',sans-serif"}}>Paid</button>}
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
            <div style={{display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap"}}>
              <div style={{flex:"1 1 140px",minWidth:0}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Last Paid / Start Date</div>
                <Inp type="date" value={form.lastPaid} onChange={e=>setForm(f=>({...f,lastPaid:e.target.value}))} style={{flex:1}}/>
              </div>
              <div style={{flex:"1 1 140px",minWidth:0}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Next Due (auto)</div>
                <div style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"0 12px",minHeight:39,display:"flex",alignItems:"center",boxSizing:"border-box",fontSize:13,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",whiteSpace:"nowrap",overflow:"hidden"}}>
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
      {/* Loan repayments from the Debt tab */}
      {loans.length>0&&(
        <div style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:2,fontWeight:700}}>Loan Repayments</div>
            <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{fmtAmt(loanTotal)+"/mo"}</div>
          </div>
          <Card style={{borderLeft:"3px solid "+t.GOLD}}>
            {loans.map((d,i)=>{
              const rate=parseFloat(d.rate)||0,bal=parseFloat(d.balance)||0,off=parseFloat(d.offsetBalance)||0,f=d.frequency||"monthly";
              const interest=Math.max(bal-off,0)*(rate/100)*((DEBT_PERIOD_DAYS[f]||365/12)/365);
              const pay=parseFloat(d.minPayment)||0;
              return(
                <div key={d.id}>
                  {i>0&&<Divider/>}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",gap:10}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:500}}>{d.name||d.type||"Loan"}<span style={{fontSize:9,color:t.GOLD,marginLeft:6}}>from Debt tab</span></div>
                      <div style={{display:"flex",gap:10,marginTop:2,flexWrap:"wrap"}}>
                        <span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{f.charAt(0).toUpperCase()+f.slice(1)}</span>
                        <span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{d.nextPaymentDate?"Next: "+d.nextPaymentDate:"No payment date set"}</span>
                        {rate>0&&<span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{"est. "+fmtAmt(interest)+" interest, "+fmtAmt(Math.max(pay-interest,0))+" principal"}</span>}
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:7,flexShrink:0}}>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:13,color:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{fmtAmt(pay)}</div>
                        {f!=="monthly"&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{fmtAmt(loanMonthly(d))+"/mo"}</div>}
                      </div>
                      {setPage&&<button onClick={()=>setPage("debt")} style={{background:t.GOLD+"14",border:"1px solid "+t.GOLD+"33",borderRadius:5,padding:"3px 7px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Debt tab</button>}
                    </div>
                  </div>
                </div>
              );
            })}
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:6}}>Repayments are recorded automatically on the Debt tab. Edit amounts and dates there.</div>
          </Card>
        </div>
      )}
      {grouped.map(({cat,items})=>{
        const catTotal=items.filter(b=>!dupOf(b)).reduce((s,b)=>s+monthlyEq(b),0);
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
                        {dupOf(b)&&<div style={{fontSize:9,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",marginTop:3}}>{"Looks like the same repayment as "+(dupOf(b).name||"a loan")+" on the Debt tab - it now shows under Loan Repayments, so this bill can be deleted. Until then it's left out of totals, the Budget and the Calendar."}</div>}
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
                          <button onClick={()=>setConfirmDel(b.id)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.4}}><Icon name="x"/></button>
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

// ── Watchlist ─────────────────────────────────────────────────────────────────
// Saved to the account (syncs across devices). Prices and targets are in the
// stock's own currency; the user's-currency value is shown alongside.
const CUR_SYM={AUD:"A$",USD:"US$",GBP:"£",EUR:"€",CAD:"C$",NZD:"NZ$",SGD:"S$",HKD:"HK$",JPY:"¥"};
const fmtNative=(v,cur)=>v==null||isNaN(v)?"-":(CUR_SYM[cur]||(cur?cur+" ":"$"))+Number(v).toLocaleString("en-AU",{minimumFractionDigits:2,maximumFractionDigits:Math.abs(v)<1?4:2});
function WatchlistPanel({watchlist,setWatchlist,holdings}){
  const t=T();const isMobile=useIsMobile();
  const list=watchlist||[];
  const[quotes,setQuotes]=useState({});
  const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({ticker:"",name:"",notes:"",alertBelow:"",alertAbove:""});
  const[editId,setEditId]=useState(null);
  const[editForm,setEditForm]=useState({});
  const[sort,setSort]=useState("added");
  const[updated,setUpdated]=useState(null);
  const tickersKey=list.map(w=>w.ticker).join(",");
  // One refresh for the whole list every 60s (the shared quote queue spaces the requests)
  useEffect(()=>{
    let alive=true;
    const load=async()=>{
      const syms=[...new Set(list.map(w=>w.ticker).filter(Boolean))];
      const out={};
      for(const s of syms){
        try{
          const r=await quoteFetch("/api/quote?symbol="+encodeURIComponent(s));
          const d=await r.json();
          if(d&&d.price!=null){const lq=await toLocalQuote(d,s);out[s]={...lq,ok:true};}
          else out[s]={ok:false};
        }catch{out[s]={ok:false};}
      }
      if(!alive)return;
      setQuotes(q=>({...q,...out}));setUpdated(new Date());
      // Record the price on the day each stock was added (for "since added")
      const missing=list.filter(w=>w.addedPrice==null&&out[w.ticker]&&out[w.ticker].ok);
      if(missing.length)setWatchlist(wl=>(wl||[]).map(w=>w.addedPrice==null&&out[w.ticker]&&out[w.ticker].ok?{...w,addedPrice:out[w.ticker].nativePrice,addedCurrency:out[w.ticker].currency,priceDate:todayStr()}:w));
    };
    if(list.length)load();
    const id=setInterval(()=>{if(list.length)load();},60000);
    return()=>{alive=false;clearInterval(id);};
  },[tickersKey]);
  const held=sym=>(holdings||[]).find(h=>String(h.ticker||"").toUpperCase()===String(sym||"").toUpperCase());
  const alertOf=(w,q)=>{
    if(!q||!q.ok||q.nativePrice==null)return null;
    const lo=parseFloat(w.alertBelow),hi=parseFloat(w.alertAbove);
    if(lo>0&&q.nativePrice<=lo)return{c:t.GREEN,txt:"At or below your "+fmtNative(lo,q.currency)+" target"};
    if(hi>0&&q.nativePrice>=hi)return{c:t.GOLD,txt:"At or above your "+fmtNative(hi,q.currency)+" target"};
    return null;
  };
  const nearTarget=(w,q)=>{
    if(!q||!q.ok)return 999;
    const lo=parseFloat(w.alertBelow),hi=parseFloat(w.alertAbove);const p=q.nativePrice;const d=[];
    if(lo>0)d.push(Math.max((p-lo)/p,0));if(hi>0)d.push(Math.max((hi-p)/p,0));
    return d.length?Math.min(...d):999;
  };
  const sorted=[...list].sort((a,b)=>{
    const qa=quotes[a.ticker],qb=quotes[b.ticker];
    if(sort==="day")return ((qb&&qb.pct)||0)-((qa&&qa.pct)||0);
    if(sort==="name")return String(a.name||a.ticker).localeCompare(String(b.name||b.ticker));
    if(sort==="target")return nearTarget(a,qa)-nearTarget(b,qb);
    return String(b.addedDate||"").localeCompare(String(a.addedDate||""))||(b.id-a.id);
  });
  const hits=list.filter(w=>alertOf(w,quotes[w.ticker])).length;
  const add=()=>{
    const tk=form.ticker.trim().toUpperCase();if(!tk)return;
    if(list.some(w=>String(w.ticker).toUpperCase()===tk)){setShowAdd(false);return;}
    const q=quotes[tk];
    setWatchlist(wl=>[{id:Date.now(),ticker:tk,name:form.name.trim(),notes:form.notes.trim(),alertBelow:form.alertBelow,alertAbove:form.alertAbove,addedDate:todayStr(),addedPrice:q&&q.ok?q.nativePrice:null,addedCurrency:q&&q.ok?q.currency:null},...(wl||[])]);
    setForm({ticker:"",name:"",notes:"",alertBelow:"",alertAbove:""});setShowAdd(false);
  };
  const saveEdit=()=>{setWatchlist(wl=>(wl||[]).map(w=>idEq(w.id,editId)?{...w,name:editForm.name,notes:editForm.notes,alertBelow:editForm.alertBelow,alertAbove:editForm.alertAbove}:w));setEditId(null);};
  const lbl={fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4};
  const chip=(on)=>({padding:"4px 10px",borderRadius:99,border:"1px solid "+(on?t.GOLD+"88":t.BORDER),background:on?t.GOLD+"18":"transparent",color:on?t.GOLD:t.MUTED,fontSize:10,fontFamily:"'Montserrat',sans-serif",cursor:"pointer",...(hasPhoto()&&!on?surfaceBg():{})});
  const targetFields=(f,set)=>(
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
      <div><div style={lbl}>Alert at or below</div><Inp type="number" value={f.alertBelow} onChange={e=>set(x=>({...x,alertBelow:e.target.value}))} placeholder="Price (optional)"/></div>
      <div><div style={lbl}>Alert at or above</div><Inp type="number" value={f.alertAbove} onChange={e=>set(x=>({...x,alertAbove:e.target.value}))} placeholder="Price (optional)"/></div>
    </div>
  );
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,gap:8,flexWrap:"wrap"}}>
        <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
          {list.length+(list.length===1?" stock":" stocks")+" watched"}
          {hits>0&&<span style={{color:t.GOLD,fontWeight:600}}>{" - "+hits+(hits===1?" price target reached":" price targets reached")}</span>}
        </div>
        <Btn onClick={()=>setShowAdd(s=>!s)} style={{padding:"6px 12px",fontSize:11}}>+ Add stock</Btn>
      </div>
      {showAdd&&(
        <Card style={{marginBottom:12,border:"1px solid "+t.GOLD+"44"}}>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,2fr)",gap:8,marginBottom:8}}>
            <div><div style={lbl}>Ticker</div><TickerAutocomplete value={form.ticker} onChange={v=>setForm(f=>({...f,ticker:v}))} onSelect={s=>setForm(f=>({...f,ticker:s.symbol,name:f.name||s.label}))} placeholder="e.g. BHP.AX, AAPL"/></div>
            <div><div style={lbl}>Name</div><Inp value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Company name"/></div>
          </div>
          <div style={{marginBottom:8}}><div style={lbl}>Notes</div><Inp value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Why are you watching it?"/></div>
          {targetFields(form,setForm)}
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:6}}>ASX shares end in .AX (e.g. CBA.AX). Targets are in the stock's own currency.</div>
          <div style={{display:"flex",gap:8,marginTop:10}}><Btn onClick={add} disabled={!form.ticker.trim()}>Add to watchlist</Btn><Btn variant="ghost" onClick={()=>setShowAdd(false)}>Cancel</Btn></div>
        </Card>
      )}
      {list.length>1&&(
        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:10}}>
          <span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginRight:2}}>Sort</span>
          {[["added","Recently added"],["day","Today's move"],["target","Closest to target"],["name","Name"]].map(([k,l])=><button key={k} onClick={()=>setSort(k)} style={chip(sort===k)}>{l}</button>)}
        </div>
      )}
      {list.length===0&&!showAdd&&(
        <Card style={{textAlign:"center",padding:28}}>
          <div style={{fontSize:13,color:t.TEXT,marginBottom:6}}>Your watchlist is empty</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",lineHeight:1.7}}>Add shares you're keeping an eye on. You'll see the live price, today's move, how it has moved since you added it, and a flag when it reaches a price you set.</div>
        </Card>
      )}
      {sorted.map(w=>{
        const q=quotes[w.ticker];
        const ok=q&&q.ok&&q.nativePrice!=null;
        const since=ok&&w.addedPrice>0&&!(w.priceDate===todayStr()&&w.priceDate!==w.addedDate)&&(!w.addedCurrency||w.addedCurrency===q.currency)?(q.nativePrice/w.addedPrice-1)*100:null;
        const al=alertOf(w,q);
        const h=held(w.ticker);
        const isEdit=editId===w.id;
        const foreign=ok&&q.currency!==L().currency&&q.price!=null;
        return(
          <Card key={w.id} style={{marginBottom:8,...(al?{border:"1px solid "+al.c+"66"}:{})}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <Tag>{w.ticker}</Tag>
                  {w.name&&<span style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0}}>{w.name}</span>}
                  {h&&<span style={{fontSize:9,color:t.BLUE,fontFamily:"'Montserrat',sans-serif",border:"1px solid "+t.BLUE+"44",borderRadius:4,padding:"1px 5px"}}>{"You hold "+Number(h.shares||0).toLocaleString("en-AU",{maximumFractionDigits:4})}</span>}
                </div>
                {w.notes&&<div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontStyle:"italic",marginTop:5}}>{w.notes}</div>}
                <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:5,fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
                  <span>{w.priceDate&&w.priceDate!==w.addedDate?("Added "+fmtDate(w.addedDate)+" - price tracked from "+fmtDate(w.priceDate)+(w.addedPrice>0?" at "+fmtNative(w.addedPrice,w.addedCurrency||(q&&q.currency)):"")):("Added "+fmtDate(w.addedDate)+(w.addedPrice>0?" at "+fmtNative(w.addedPrice,w.addedCurrency||(q&&q.currency)):""))}</span>
                  {since!=null&&<span style={{color:since>=0?t.GREEN:t.RED,fontWeight:600}}>{(since>=0?"+":"")+since.toFixed(1)+"% since added"}</span>}
                  {parseFloat(w.alertBelow)>0&&<span>{"Below "+fmtNative(parseFloat(w.alertBelow),q&&q.currency)}</span>}
                  {parseFloat(w.alertAbove)>0&&<span>{"Above "+fmtNative(parseFloat(w.alertAbove),q&&q.currency)}</span>}
                </div>
                {al&&<div style={{fontSize:10,color:al.c,fontFamily:"'Montserrat',sans-serif",fontWeight:600,marginTop:5}}>{al.txt}</div>}
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                {!q?<Skeleton width={70} height={16}/>:!ok?<div style={{fontSize:10,color:t.RED,fontFamily:"'Montserrat',sans-serif"}}>No price found</div>:(
                  <div>
                    <div style={{fontSize:15,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{fmtNative(q.nativePrice,q.currency)}</div>
                    {foreign&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{"= "+fmtNative(q.price,L().currency)}</div>}
                    <div style={{fontSize:11,color:(q.pct||0)>=0?t.GREEN:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{((q.pct||0)>=0?"▲ ":"▼ ")+Math.abs(q.pct||0).toFixed(2)+"% today"}</div>
                  </div>
                )}
                <div style={{display:"flex",gap:6,justifyContent:"flex-end",marginTop:6}}>
                  <button onClick={()=>{if(isEdit){setEditId(null);return;}setEditId(w.id);setEditForm({name:w.name||"",notes:w.notes||"",alertBelow:w.alertBelow||"",alertAbove:w.alertAbove||""});}} style={{background:t.GOLD+"14",border:"1px solid "+t.GOLD+"33",borderRadius:5,padding:"3px 8px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Edit</button>
                  <button aria-label={"Remove "+w.ticker} onClick={()=>setWatchlist(wl=>(wl||[]).filter(x=>!idEq(x.id,w.id)))} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:5,padding:"3px 8px",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Remove</button>
                </div>
              </div>
            </div>
            {isEdit&&(
              <div style={{borderTop:"1px solid "+t.BORDER,marginTop:10,paddingTop:10}}>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,2fr)",gap:8,marginBottom:8}}>
                  <div><div style={lbl}>Name</div><Inp value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))}/></div>
                  <div><div style={lbl}>Notes</div><Inp value={editForm.notes} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))}/></div>
                </div>
                {targetFields(editForm,setEditForm)}
                <div style={{display:"flex",gap:8,marginTop:10}}><Btn onClick={saveEdit}>Save</Btn><Btn variant="ghost" onClick={()=>setEditId(null)}>Cancel</Btn></div>
              </div>
            )}
          </Card>
        );
      })}
      {list.length>0&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textAlign:"right",marginTop:4}}>{"Prices refresh every minute and may be delayed"+(updated?" - updated "+updated.toLocaleTimeString(_locale,{hour:"numeric",minute:"2-digit"}):"")}</div>}
    </div>
  );
}
function InvestPage({profile,properties,subscription,setShowUpgrade,watchlist,setWatchlist,holdings}){
  const t=T();
  const[tab,setTab]=useState("watchlist");
  const asOfDate=new Date().toLocaleDateString("en-AU",{day:"numeric",month:"long",year:"numeric"});
  const[aiOpps,setAiOpps]=useState(()=>{try{return localStorage.getItem("invest_ai_cache")||"";}catch{return "";}});
  const[aiOppsDate,setAiOppsDate]=useState(()=>{try{return localStorage.getItem("invest_ai_date")||"";}catch{return "";}});
  const[loading,setLoading]=useState(false);
  const[aiError,setAiError]=useState("");
  // One-time carry-over of the old device-only watchlist into the account
  useEffect(()=>{
    try{
      const s=localStorage.getItem("invest_watchlist");if(!s)return;
      const old=JSON.parse(s)||[];
      if(old.length)setWatchlist(wl=>{const have=new Set((wl||[]).map(w=>String(w.ticker).toUpperCase()));return [...(wl||[]),...old.filter(w=>w&&w.ticker&&!have.has(String(w.ticker).toUpperCase()))];});
      localStorage.removeItem("invest_watchlist");
    }catch{}
  },[]);

  const getAi=async()=>{
    setLoading(true);setAiError("");
    try{
      const r=await claudeFetch({
        model:"claude-sonnet-4-6",
        max_tokens:800,
        tools:[{type:"web_search_20250305",name:"web_search"}],
        system:GENERAL_INFO_RULE+" You are Executive AI giving general market information. Discuss sectors, themes and asset classes rather than specific products. User context: "+(profile?.riskProfile||["Growth"])[0]+" risk investor in Australia. Portfolio: Shares "+fmt(parseFloat(profile?.shareValue)||0)+", Property "+fmt((properties||[]).reduce((s,p)=>s+(parseFloat(p.currentValue)||0),0))+", Super "+fmt(parseFloat(profile?.superBalance)||0)+", Crypto "+fmt(parseFloat(profile?.cryptoValue)||0)+". Available cash: "+fmt(parseFloat(profile?.cashSavings)||0)+". Search for current market conditions. Give 3-4 specific opportunities with: NAME, ASSET CLASS, WHY NOW (specific current catalyst), SUGGESTED ALLOCATION, RISK. Be specific.",
        messages:[{role:"user",content:"What are the key market themes and general opportunities across asset classes right now? Search for the latest data."}]
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
  return (
    <div data-page="true" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Capital Deployment</div>
      <div style={{fontSize:26,color:t.TEXT,marginBottom:16}}>Opportunities</div>
      <div style={{display:"flex",gap:7,marginBottom:14}}>
        {[["watchlist","Watchlist"],["live","Live AI Search"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"8px",borderRadius:7,border:"1px solid "+(tab===id?t.GOLD:t.BORDER),background:tab===id?t.GOLD+"18":"transparent",color:tab===id?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>
            {label}
          </button>
        ))}
      </div>
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
      {tab==="watchlist"&&<WatchlistPanel watchlist={watchlist} setWatchlist={setWatchlist} holdings={holdings}/>}
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
            <Inp type="date" value={wf.date} onChange={e=>setWf(f=>({...f,date:e.target.value}))} style={{flex:"1 1 140px",minWidth:140}}/>
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
              <button onClick={()=>setWf(f=>({...f,sets:f.sets.filter(x=>x.id!==s.id)}))} style={{background:"none",border:"none",color:t.RED,cursor:"pointer",fontSize:10}}><Icon name="x"/></button>
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
          {!(workouts||[]).length&&!showAdd&&<div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}><div style={{fontSize:32,marginBottom:10,display:"flex",justifyContent:"center",color:t.GOLD}}><Icon name="dumbbell" stroke={1.2}/></div><div>No sessions yet</div></div>}
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

// Renders note text with light structure: blank lines kept,
// "# " heading, "- " or "* " bullet, "> " quote.
function NoteText({text,size}){
  const t=T();
  const fs=size||12;
  const serif="'Cormorant Garamond',Georgia,serif";
  const lines=String(text||"").split("\n");
  return (
    <div>
      {lines.map((ln,i)=>{
        const s=ln.trim();
        if(!s)return <div key={i} style={{height:9}}/>;
        if(s.indexOf("# ")===0)return <div key={i} style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:600,marginTop:i?8:0,marginBottom:4}}>{s.slice(2)}</div>;
        if(s.indexOf("- ")===0||s.indexOf("* ")===0)return (
          <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",paddingLeft:2}}>
            <div style={{width:4,height:4,borderRadius:"50%",background:t.GOLD,marginTop:fs*0.75,flexShrink:0}}/>
            <div style={{fontSize:fs,color:t.TEXT,fontFamily:serif,lineHeight:1.7}}>{s.slice(2)}</div>
          </div>
        );
        if(s.indexOf("> ")===0)return <div key={i} style={{fontSize:fs+1,color:t.TEXT,fontFamily:serif,fontStyle:"italic",lineHeight:1.7,borderLeft:"2px solid "+t.GOLD+"66",paddingLeft:10,margin:"2px 0"}}>{s.slice(2)}</div>;
        return <div key={i} style={{fontSize:fs,color:t.TEXT,fontFamily:serif,lineHeight:1.7}}>{ln}</div>;
      })}
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
  const[confirmDel,setConfirmDel]=useState(null);
  const[editNote,setEditNote]=useState(null);
  const[savedFlash,setSavedFlash]=useState(false);
  // Restore an unsaved note draft (e.g. the app was closed mid-note)
  useEffect(()=>{
    const d=(books||[]).find(b=>b.noteDraft);
    if(d)setNotePrompt({...d.noteDraft,bookId:d.id});
  },[]);
  // Autosave the draft into the book while typing, so it syncs before Save is pressed
  useEffect(()=>{
    if(!notePrompt)return;
    const tm=setTimeout(()=>{
      const{bookId,...draft}=notePrompt;
      setBooks(bs=>bs.map(b=>b.id===bookId?{...b,noteDraft:draft}:b));
    },600);
    return()=>clearTimeout(tm);
  },[notePrompt]);
  const clearDraft=(b)=>{if(!b.noteDraft)return b;const{noteDraft,...rest}=b;return rest;};
  const flashSaved=()=>{setSavedFlash(true);setTimeout(()=>setSavedFlash(false),2200);};
  const skipNote=()=>{
    const id=notePrompt?notePrompt.bookId:null;
    setBooks(bs=>bs.map(b=>b.id===id?clearDraft(b):b));
    setNotePrompt(null);
  };
  const deleteBook=(id)=>{
    setBooks(bs=>bs.filter(x=>x.id!==id));
    if(notePrompt&&notePrompt.bookId===id)setNotePrompt(null);
    setConfirmDel(null);
  };
  const deleteNote=(bookId,noteId)=>{
    setBooks(bs=>bs.map(b=>b.id===bookId?{...b,readingNotes:(b.readingNotes||[]).filter(n=>n.id!==noteId)}:b));
    setConfirmDel(null);
  };
  const saveEditNote=()=>{
    if(!editNote)return;
    const txt=editNote.text.trim();
    if(!txt)return;
    setBooks(bs=>bs.map(b=>b.id===editNote.bookId?{...b,readingNotes:(b.readingNotes||[]).map(n=>n.id===editNote.noteId?{...n,text:txt}:n)}:b));
    setEditNote(null);
    flashSaved();
  };
  const startReading=(id)=>{
    setBooks(bs=>bs.map(b=>b.id===id?{...b,status:"reading",cur:Number(b.cur)||0,startedDate:todayStr()}:b));
  };
  const linkBtn=(c)=>({background:"none",border:"none",color:c,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif",padding:0});
  const confirmBar=(msg,onYes)=>(
    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",background:t.RED+"14",border:"1px solid "+t.RED+"44",borderRadius:7,padding:"8px 10px",margin:"8px 0"}}>
      <span style={{flex:1,minWidth:150,fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif"}}>{msg}</span>
      <button onClick={onYes} style={{background:t.RED+"22",border:"1px solid "+t.RED+"66",borderRadius:6,padding:"5px 12px",color:t.RED,cursor:"pointer",fontSize:11,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>Delete</button>
      <button onClick={()=>setConfirmDel(null)} style={{background:"none",border:"1px solid "+t.BORDER2,borderRadius:6,padding:"5px 12px",color:t.MUTED,cursor:"pointer",fontSize:11,fontFamily:"'Montserrat',sans-serif"}}>Cancel</button>
    </div>
  );
  const renderNote=(b,n,col)=>{
    const editing=editNote&&editNote.noteId===n.id;
    return (
      <div key={n.id} style={{padding:"8px 10px",background:t.CARD2,borderRadius:6,borderLeft:"2px solid "+col}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:4}}>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{"p."+n.fromPage+" - p."+n.toPage+" - "+n.date}</div>
          {!editing&&(
            <div style={{display:"flex",gap:12}}>
              <button onClick={()=>{setConfirmDel(null);setEditNote({bookId:b.id,noteId:n.id,text:n.text});}} style={linkBtn(t.GOLD)}>Edit</button>
              <button onClick={()=>setConfirmDel({kind:"note",bookId:b.id,noteId:n.id})} style={linkBtn(t.MUTED)}>Delete</button>
            </div>
          )}
        </div>
        {editing?(
          <div>
            <textarea spellCheck={true} autoCorrect="on" autoCapitalize="sentences" autoFocus
              value={editNote.text}
              onChange={e=>{const v=e.target.value;setEditNote(p=>({...p,text:v}));}}
              rows={6}
              style={{width:"100%",background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:6,padding:"8px 10px",color:t.TEXT,fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.7,boxSizing:"border-box"}}
            />
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <Btn onClick={saveEditNote} style={{fontSize:11}}>Save</Btn>
              <Btn onClick={()=>setEditNote(null)} variant="ghost" style={{fontSize:11}}>Cancel</Btn>
            </div>
          </div>
        ):<NoteText text={n.text}/>}
        {confirmDel&&confirmDel.kind==="note"&&confirmDel.noteId===n.id&&confirmBar("Delete this note? This can't be undone.",()=>deleteNote(b.id,n.id))}
      </div>
    );
  };
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
      return{...clearDraft(b),...updates};
    }));
    setNotePrompt(null);
    flashSaved();
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
      {savedFlash&&(
        <div style={{marginBottom:12,padding:"8px 12px",background:t.GREEN+"14",border:"1px solid "+t.GREEN+"44",borderRadius:7,fontSize:11,color:t.GREEN,fontFamily:"'Montserrat',sans-serif"}}>Note saved and syncing to your account</div>
      )}
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
                rows={6}
                style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"9px 12px",color:t.TEXT,fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.7,boxSizing:"border-box"}}
              />
            </>
          )}
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:6,lineHeight:1.6}}>{"Formatting: # Heading   - Bullet   > Quote   Blank lines are kept. Drafts save automatically."}</div>
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <Btn onClick={saveNote}>{notePrompt.isFinish?"Save":"Save Note"}</Btn>
            <Btn onClick={skipNote} variant="ghost">Skip</Btn>
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
                      <button onClick={()=>setEditingBook(editingBook===b.id?null:b.id)} style={{background:t.GOLD+"14",border:"1px solid "+t.GOLD+"33",borderRadius:5,padding:"2px 7px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Edit</button>
                      <button onClick={()=>setConfirmDel({kind:"book",bookId:b.id})} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.6}}><Icon name="x"/></button>
                    </div>
                  </div>
                  {confirmDel&&confirmDel.kind==="book"&&confirmDel.bookId===b.id&&confirmBar("Delete \""+b.title+"\""+(notes.length?" and its "+notes.length+" "+(notes.length===1?"note":"notes"):"")+"? This can't be undone.",()=>deleteBook(b.id))}

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
                          {b.status==="done"?(
                          <div style={{flex:1}}>
                            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Date Finished</div>
                            <Inp type="date" value={b.dateFinished||""} onChange={e=>setBooks(bs=>bs.map(x=>x.id===b.id?{...x,dateFinished:e.target.value}:x))} style={{fontSize:12}}/>
                          </div>
                          ):(
                          <div style={{flex:1}}>
                            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Current Page</div>
                            <Inp type="number" value={b.cur||0} onChange={e=>setBooks(bs=>bs.map(x=>x.id===b.id?{...x,cur:Math.max(0,Math.min(parseInt(e.target.value)||0,x.tot||0))}:x))} style={{fontSize:12}}/>
                          </div>
                          )}
                          <div style={{flex:1}}>
                            <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:3}}>Total Pages</div>
                            <Inp type="number" value={b.tot||""} onChange={e=>setBooks(bs=>bs.map(x=>x.id===b.id?{...x,tot:parseInt(e.target.value)||b.tot}:x))} placeholder="Pages" style={{fontSize:12}}/>
                          </div>
                        </div>
                        {b.status==="done"&&(<>
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
                        </>)}
                        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                          {b.status==="next"&&<button onClick={()=>{startReading(b.id);setEditingBook(null);}} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:6,padding:"5px 10px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>Start Reading</button>}
                          {b.status==="done"&&<button onClick={()=>setBooks(bs=>bs.map(x=>x.id===b.id?{...x,status:"reading"}:x))} style={{background:t.GOLD+"14",border:"1px solid "+t.GOLD+"33",borderRadius:6,padding:"5px 10px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>Move back to Reading</button>}
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
                              <NoteText text={b.review}/>
                            </div>
                          )}
                          {(b.readingNotes||[]).map(n=>renderNote(b,n,col))}
                        </div>
                      )}
                    </div>
                  )}
                  {b.status==="next"&&editingBook!==b.id&&(
                    <div style={{display:"flex",gap:8,alignItems:"center",marginTop:6,flexWrap:"wrap"}}>
                      <button onClick={()=>startReading(b.id)} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:6,padding:"6px 12px",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:600}}>Start Reading</button>
                      <span style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{(b.tot||0)+" pages"+(b.cur?" - starting at p."+b.cur:"")}</span>
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
                        <span style={{fontSize:10}}><Chevron dir={showingNotes?"down":"right"}/></span>
                        {notes.length+" reading "+(notes.length===1?"note":"notes")}
                      </button>
                      {showingNotes&&(
                        <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:8}}>
                          {notes.map(n=>renderNote(b,n,col))}
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
      {!(books||[]).length&&<div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}><div style={{fontSize:32,marginBottom:10,display:"flex",justifyContent:"center",color:t.GOLD}}><Icon name="book-open" stroke={1.2}/></div><div>No books yet</div></div>}
    </div>
  );
}

function MonthlyHeatmap({history,highlight}){
  const t=T();
  const M="'Montserrat',sans-serif",S="'Cormorant Garamond',Georgia,serif";
  const[monthOffset,setMonthOffset]=useState(0); // 0=this month, -1=last month, etc
  const[picked,setPicked]=useState(null);
  // Follow the week shown in Daily Snapshots: jump to the month of its last day
  const hlEnd=highlight&&highlight.length?highlight[highlight.length-1]:null;
  useEffect(()=>{
    if(!hlEnd)return;
    const e=new Date(hlEnd+"T12:00:00"),n=new Date();
    setMonthOffset(Math.min((e.getFullYear()*12+e.getMonth())-(n.getFullYear()*12+n.getMonth()),0));
    setPicked(null);
  },[hlEnd]);
  const now=new Date();
  const viewDate=new Date(now.getFullYear(),now.getMonth()+monthOffset,1);
  const year=viewDate.getFullYear(),month=viewDate.getMonth();
  const isCurrentMonth=monthOffset===0;
  const daysInMonth=new Date(year,month+1,0).getDate();
  const firstDay=new Date(year,month,1).getDay();
  const monthLabel=viewDate.toLocaleDateString(_locale,{month:"long",year:"numeric"});
  const today=todayStr();
  const hist=history||{};
  const hl=highlight||[];
  const DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const col=s=>s>=80?t.GREEN:s>=60?t.GOLD:s>=40?t.BLUE:t.RED;
  const cells=[];
  for(let i=0;i<firstDay;i++)cells.push(null);
  for(let d=1;d<=daysInMonth;d++){
    const ds=year+"-"+String(month+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
    cells.push({d,ds,score:(hist[ds]&&hist[ds].score)||0,isFuture:ds>today,isToday:ds===today});
  }
  const past=cells.filter(c=>c&&!c.isFuture);
  const scored=past.filter(c=>c.score>0);
  const avg=scored.length?Math.round(scored.reduce((a,c)=>a+c.score,0)/scored.length):0;
  const best=scored.length?scored.reduce((b,c)=>c.score>b.score?c:b,scored[0]):null;
  const top=scored.filter(c=>c.score>=80).length;
  const pk=picked?cells.find(c=>c&&c.ds===picked):null;
  const dayName=c=>DAYS[new Date(c.ds+"T12:00:00").getDay()]+" "+c.d;
  const nav=(dir,off)=>(
    <button onClick={()=>{if(off)return;setMonthOffset(o=>Math.min(o+dir,0));setPicked(null);}}
      style={{width:24,height:24,borderRadius:6,border:"1px solid "+t.BORDER,background:t.CARD,color:off?t.BORDER:t.MUTED,cursor:off?"default":"pointer",fontFamily:M,fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>
      {dir<0?"<":">"}
    </button>
  );
  const stat=(l,v,c,sub)=>(
    <div>
      <div style={{fontSize:9,color:t.MUTED,fontFamily:M,letterSpacing:1,marginBottom:2}}>{l}</div>
      <div style={{fontSize:24,color:c||t.TEXT,fontFamily:S,lineHeight:1.1}}>{v}</div>
      {sub&&<div style={{fontSize:9,color:t.MUTED,fontFamily:M}}>{sub}</div>}
    </div>
  );
  return(
    <Card style={{marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,gap:10,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {nav(-1,false)}
          <div style={{fontSize:9,letterSpacing:2,color:t.GOLD,textTransform:"uppercase",fontFamily:M}}>{monthLabel}</div>
          {nav(1,isCurrentMonth)}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {[{c:t.GREEN,l:"80+"},{c:t.GOLD,l:"60+"},{c:t.BLUE,l:"40+"},{c:t.RED,l:"<40"}].map(k=>(
            <div key={k.l} style={{display:"flex",alignItems:"center",gap:3}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:k.c}}/>
              <span style={{fontSize:9,color:t.MUTED,fontFamily:M}}>{k.l}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:"flex",gap:28,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,18px)",gap:8}}>
          {DAYS.map(l=><div key={l} style={{fontSize:8,color:t.MUTED,fontFamily:M,textAlign:"center"}}>{l.charAt(0)}</div>)}
          {cells.map((c,i)=>{
            if(!c)return <div key={"p"+i}/>;
            const on=hl.indexOf(c.ds)>=0;
            const sel=picked===c.ds;
            const ring=on||sel?"0 0 0 2px "+t.CARD+",0 0 0 3.5px "+(sel?t.TEXT:t.GL):"none";
            return (
              <div key={c.ds} title={dayName(c)+(c.score?" - "+c.score:"")}
                onClick={()=>!c.isFuture&&setPicked(picked===c.ds?null:c.ds)}
                style={{width:18,height:18,borderRadius:"50%",cursor:c.isFuture?"default":"pointer",boxSizing:"border-box",
                  background:c.isFuture?"transparent":c.score?col(c.score):t.CARD2,
                  border:c.isFuture?"1px solid "+t.BORDER2:c.score?"none":"1px solid "+t.BORDER2,
                  boxShadow:ring}}/>
            );
          })}
        </div>
        <div style={{flex:1,minWidth:180,display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:14}}>
          {stat("Month avg",avg||"-",avg?col(avg):t.MUTED)}
          {stat("Days tracked",scored.length+"/"+past.length)}
          {stat("Best day",best?best.score:"-",best?col(best.score):t.MUTED,best?dayName(best):null)}
          {stat("80+ days",top,top?t.GREEN:t.TEXT)}
        </div>
      </div>
      <div style={{fontSize:10,color:pk?t.TEXT:t.MUTED,fontFamily:M,marginTop:12}}>
        {pk?new Date(pk.ds+"T12:00:00").toLocaleDateString(_locale,{weekday:"long",day:"numeric",month:"long"})+" - "+(pk.score?"score "+pk.score:"nothing recorded"):"Gold rings show the week above. Tap a day to see its score."}
      </div>
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

// Daily snapshots - day-by-day overview on the Weekly page
function DailySnapshots({last7,dailySnaps,history,habits,habitLog,completed,transactions,workouts,bodyLog,journal}){
  const t=T();
  const M="'Montserrat',sans-serif",S="'Cormorant Garamond',Georgia,serif";
  const DAY=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const DAYFULL=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const MON=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const today=todayStr();
  const snaps=dailySnaps||{};
  const hist=history||{};
  const[sel,setSel]=useState(null);
  const selDay=sel&&last7.indexOf(sel)>=0?sel:(last7.indexOf(today)>=0?today:last7[6]);
  const dObj=d=>new Date(d+"T12:00:00");
  const money=v=>"$"+Math.round(Math.abs(v)).toLocaleString("en-AU");
  const signed=v=>(v<0?"-":"+")+money(v);
  const keys=Object.keys(snaps).sort();
  const firstSnap=keys[0]||null;
  const prevNW=d=>{const k=keys.filter(x=>x<d).pop();return k?snaps[k].nw:null;};
  const nwDelta=d=>{const s=snaps[d];if(!s)return null;const p=prevNW(d);return p===null?null:s.nw-p;};
  const spentOn=d=>{
    const tx=(transactions||[]).filter(x=>x.date===d&&x.type==="expense");
    const bc={};let total=0;
    tx.forEach(x=>{const a=Math.abs(parseFloat(x.amount)||0);total+=a;const c=x.category||"Other";bc[c]=(bc[c]||0)+a;});
    const top=Object.entries(bc).sort((a,b)=>b[1]-a[1])[0];
    return{total,top:top?top[0]:null};
  };
  const tasksDone=d=>snaps[d]?snaps[d].td.length:((hist[d]&&hist[d].tasks)||0);
  const score=d=>(hist[d]&&hist[d].score)||0;

  // Week summary
  const wk=last7.filter(d=>snaps[d]);
  let weekNW=null;
  if(wk.length){const base=prevNW(wk[0]);if(base!==null)weekNW=snaps[wk[wk.length-1]].nw-base;else if(wk.length>1)weekNW=snaps[wk[wk.length-1]].nw-snaps[wk[0]].nw;}
  const scored=last7.filter(d=>score(d)>0);
  const avg=scored.length?Math.round(scored.reduce((a,d)=>a+score(d),0)/scored.length):0;
  const best=scored.length?scored.reduce((b,d)=>score(d)>score(b)?d:b,scored[0]):null;
  const weekTasks=last7.reduce((a,d)=>a+tasksDone(d),0);
  const weekSpent=last7.reduce((a,d)=>a+spentOn(d).total,0);

  // Selected day
  const d=selDay;
  const snap=snaps[d]||null;
  const isFuture=d>today;
  const sc=score(d);
  const delta=nwDelta(d);
  const spent=spentOn(d);
  const habitRows=(habits||[]).map(h=>[h.name,!!(habitLog||{})[h.id+"_"+d]]);
  const hDone=habitRows.filter(h=>h[1]).length;
  const goalsDone=(completed||[]).filter(g=>g.completedAt===d);
  const jEntry=(journal||[]).find(e=>e.date===d);
  const wOuts=(workouts||[]).filter(w=>w.date===d);
  const body=(bodyLog||[]).find(e=>e.date===d&&e.weight);
  const reading=snap?Object.values(snap.books||{}).filter(b=>b.c>b.s):[];
  const tTotal=snap?snap.td.length+snap.to.length:0;
  const hasAny=sc>0||snap||spent.total>0||jEntry||wOuts.length||body||goalsDone.length||hDone>0;

  const label=(txt)=><div style={{fontSize:9,letterSpacing:2,color:t.GOLD,textTransform:"uppercase",fontFamily:M,marginBottom:8}}>{txt}</div>;
  const muted=(txt)=><div style={{fontSize:11,color:t.MUTED,fontFamily:M}}>{txt}</div>;
  const chip=(name,on,key)=>(
    <span key={key} style={{display:"inline-block",fontSize:10,padding:"4px 9px",borderRadius:12,margin:"0 6px 6px 0",fontFamily:M,background:on?t.GREEN+"1A":t.CARD2,color:on?t.GREEN:t.MUTED,border:"1px solid "+(on?t.GREEN+"44":t.BORDER2)}}>{name}</span>
  );
  const tile=(l,v,c,sub)=>(
    <Card style={{padding:"12px 14px"}}>
      <div style={{fontSize:9,color:t.MUTED,fontFamily:M,letterSpacing:1,marginBottom:4}}>{l}</div>
      <div style={{fontSize:22,color:c,fontFamily:S}}>{v}</div>
      {sub&&<div style={{fontSize:10,color:t.MUTED,fontFamily:M,marginTop:2}}>{sub}</div>}
    </Card>
  );
  const sumItem=(l,v,c)=>(
    <div>
      <div style={{fontSize:9,color:t.MUTED,fontFamily:M,letterSpacing:1,marginBottom:3}}>{l}</div>
      <div style={{fontSize:20,color:c||t.TEXT,fontFamily:S}}>{v}</div>
    </div>
  );
  const subLine=[wOuts.length?"Workout: "+wOuts.map(w=>(w.type||"Workout")+(w.duration?" - "+w.duration+" min":"")).join(", "):null,body?"Weight: "+body.weight+" kg":null].filter(Boolean).join("   |   ");

  return (
    <div style={{marginBottom:18}}>
      <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:M,marginBottom:10}}>Daily Snapshots</div>

      <Card style={{marginBottom:10,borderColor:t.GOLD+"33",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(105px,1fr))",gap:12}}>
        {sumItem("Net worth",weekNW===null?"-":signed(weekNW),weekNW===null?t.MUTED:weekNW>=0?t.GREEN:t.RED)}
        {sumItem("Avg score",avg||"-",t.GOLD)}
        {sumItem("Best day",best?DAYFULL[dObj(best).getDay()]:"-")}
        {sumItem("Tasks done",weekTasks)}
        {sumItem("Spent",money(weekSpent))}
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:5,marginBottom:10}}>
        {last7.map(day=>{
          const s=score(day),on=day===d,fut=day>today,dl=nwDelta(day);
          const c=s>=80?t.GOLD:s>=50?t.TEXT:t.MUTED;
          return (
            <button key={day} onClick={()=>setSel(day)} style={{background:on?t.GOLD+"14":t.CARD,border:"1px solid "+(on?t.GOLD:t.BORDER),borderRadius:9,padding:"8px 2px",cursor:"pointer",textAlign:"center",opacity:fut?0.45:1,minWidth:0}}>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:M,display:"flex",alignItems:"center",justifyContent:"center",gap:3}}>
                {DAY[dObj(day).getDay()]}
                {dl!==null&&<span style={{width:5,height:5,borderRadius:"50%",background:dl>=0?t.GREEN:t.RED,display:"inline-block"}}/>}
              </div>
              <div style={{fontSize:19,color:s?c:t.MUTED2,fontFamily:S,lineHeight:1.3}}>{s||"-"}</div>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:M}}>{dObj(day).getDate()}</div>
            </button>
          );
        })}
      </div>

      <Card style={{marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <div>
          <div style={{fontSize:21,color:t.TEXT,fontFamily:S}}>{DAYFULL[dObj(d).getDay()]+" "+dObj(d).getDate()+" "+MON[dObj(d).getMonth()]}</div>
          <div style={{fontSize:10,color:t.MUTED,fontFamily:M,marginTop:2}}>{isFuture?"Still to come":d===today?(subLine||"Today - updates as your day happens"):(subLine||"No workout or weigh-in logged")}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:38,color:sc?t.GOLD:t.MUTED2,fontFamily:S,lineHeight:1}}>{sc||"-"}</div>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:M}}>Daily score</div>
        </div>
      </Card>

      {isFuture?null:!hasAny?(
        <Card style={{textAlign:"center",padding:24}}>{muted("Nothing recorded for this day")}</Card>
      ):(
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginBottom:10}}>
            {tile("Tasks",snap?snap.td.length+"/"+tTotal:tasksDone(d),t.TEXT,snap?(tTotal?Math.round(snap.td.length/tTotal*100)+"% complete":"No tasks"):"completed")}
            {tile("Net worth",delta===null?"-":signed(delta),delta===null?t.MUTED:delta>=0?t.GREEN:t.RED,snap?money(snap.nw)+" total":"Not recorded")}
            {tile("Spent",money(spent.total),t.TEXT,spent.top?"Mostly "+spent.top.toLowerCase():"No spending logged")}
            {tile("Habits",habitRows.length?hDone+"/"+habitRows.length:"-",t.TEXT,habitRows.length?(hDone===habitRows.length?"Clean sweep":(habitRows.length-hDone)+" missed"):"No habits set")}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:10}}>
            <Card>
              {label("Tasks")}
              {snap?(
                tTotal?[...snap.td.map(x=>[x,1]),...snap.to.map(x=>[x,0])].map((x,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"6px 0",borderBottom:"1px solid "+t.BORDER}}>
                    <div style={{width:13,height:13,borderRadius:"50%",flexShrink:0,border:"1px solid "+(x[1]?t.GOLD:t.BORDER2),background:x[1]?t.GOLD:"transparent"}}/>
                    <span style={{fontSize:12,fontFamily:M,color:x[1]?t.TEXT:t.MUTED}}>{x[0]}</span>
                  </div>
                )):muted("No tasks for this day")
              ):muted(tasksDone(d)+" tasks completed. Task names are recorded from "+(firstSnap?fmtDateNum(firstSnap):"today")+" onwards.")}
            </Card>
            <Card>
              {label("Supplements")}
              <div style={{marginBottom:8}}>
                {snap?((snap.st.length+snap.sm.length)?[...snap.st.map((n,i)=>chip(n,true,"s"+i)),...snap.sm.map((n,i)=>chip(n,false,"m"+i))]:muted("None set")):muted(((hist[d]&&hist[d].supps)||0)+" taken")}
              </div>
              {label("Habits")}
              <div style={{marginBottom:8}}>{habitRows.length?habitRows.map((h,i)=>chip(h[0],h[1],"h"+i)):muted("No habits set")}</div>
              {label("Goals")}
              {goalsDone.length?goalsDone.map((g,i)=>(
                <span key={i} style={{display:"inline-block",fontSize:10,padding:"4px 9px",borderRadius:12,margin:"0 6px 6px 0",fontFamily:M,background:t.GOLD+"18",color:t.GOLD,border:"1px solid "+t.GOLD+"44"}}>{"Completed: "+g.title}</span>
              )):muted("No goals completed")}
            </Card>
            <Card>
              {label("Reading")}
              {reading.length?reading.map((b,i)=>{
                const pct=b.tot?Math.min(Math.round(b.c/b.tot*100),100):0;
                return (
                  <div key={i} style={{marginBottom:i<reading.length-1?10:0}}>
                    <div style={{fontSize:12,color:t.TEXT,fontFamily:M,marginBottom:5}}>{b.t}{b.tot&&b.c>=b.tot?<span style={{color:t.GREEN}}>{" - finished"}</span>:null}</div>
                    <div style={{height:4,background:t.BORDER,borderRadius:2,marginBottom:5}}><div style={{height:4,width:pct+"%",background:t.GOLD,borderRadius:2}}/></div>
                    {muted((b.c-b.s)+" pages read - p."+b.c+(b.tot?" of "+b.tot:""))}
                  </div>
                );
              }):muted("No reading logged")}
            </Card>
            <Card>
              {label("Journal")}
              {jEntry&&jEntry.text?(
                <div style={{fontSize:14,color:t.TEXT,fontFamily:S,fontStyle:"italic",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{jEntry.text.length>320?jEntry.text.slice(0,320)+"...":jEntry.text}</div>
              ):muted("No journal entry")}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ── Calendar ──────────────────────────────────────────────────────────────────
// Everything with a date, in one place: bills, loan repayments, dividends,
// expected income, goal deadlines, tax dates and the user's own reminders.
const CAL_COLORS={bill:"#C97E7E",repay:"#C9A84C",dividend:"#7A9E7E",income:"#7EB8C9",deadline:"#B07EC9",reminder:"#D19A66"};
const CAL_TYPES=[["bill","Bills"],["repay","Repayments"],["dividend","Dividends"],["income","Income"],["deadline","Deadlines"],["reminder","Reminders"]];
const CAL_REPEAT=[["none","Does not repeat"],["weekly","Every week"],["fortnightly","Every fortnight"],["monthly","Every month"],["quarterly","Every quarter"],["annually","Every year"]];
const CAL_REPEAT_SHORT={weekly:"Weekly",fortnightly:"Fortnightly",monthly:"Monthly",quarterly:"Quarterly",annually:"Yearly"};
const CAL_PAGE={bill:"bills",repay:"debt",dividend:"dividends",deadline:"goals"};
// Next date in a repeating series, keeping the same day of month (clamped to short months)
function calStep(ds,freq,anchor){
  if(freq==="weekly"||freq==="fortnightly")return advanceDate(ds,freq);
  const add={monthly:1,quarterly:3,"semi-annual":6,annually:12,annual:12}[freq]||1;
  const d=parseLocalDate(ds);const y=d.getFullYear(),m=d.getMonth()+add;
  const dim=new Date(y,m+1,0).getDate();
  return localDateStr(new Date(y,m,Math.min(anchor||d.getDate(),dim),12));
}
// Every date a series falls on between from and to (inclusive)
function calOccurrences(start,freq,from,to){
  const out=[];if(!start||typeof start!=="string")return out;
  const anchor=parseInt(start.slice(8,10),10)||1;
  let d=start,n=0;
  while(d<=to&&n<1000){
    if(d>=from)out.push(d);
    if(!freq||freq==="none")break;
    d=calStep(d,freq,anchor);n++;
  }
  return out;
}
const CAL_ORDER={deadline:0,reminder:1,bill:2,repay:3,income:4,dividend:5};
function buildCalendarEvents(src,from,to){
  const{bills,debts,dividends,holdings,goals,calendarItems}=src||{};
  const ev=[];const today=todayStr();
  const _loans=(debts||[]).filter(d=>(parseFloat(d.minPayment)||0)>0&&(parseFloat(d.balance)||0)>0);
  (bills||[]).forEach(b=>{
    if(_loans.length&&loanForBill(b,_loans))return;
    const amt=parseFloat(b.amount)||0;
    (b.paymentHistory||[]).forEach((p,i)=>{if(p&&p.date&&p.date>=from&&p.date<=to)ev.push({key:"bp"+b.id+p.date+i,date:p.date,type:"bill",title:b.name,amount:parseFloat(p.amount)||amt,dir:"out",paid:true,note:"Paid"});});
    if(b.nextDue)calOccurrences(b.nextDue,b.frequency||"monthly",from,to).forEach(d=>{
      const overdue=d<today&&!b.autopay;
      ev.push({key:"b"+b.id+d,date:d,type:"bill",title:b.name,amount:amt,dir:"out",overdue,note:overdue?"Overdue":b.autopay?"Autopay":(CAL_REPEAT_SHORT[b.frequency]||"")});
    });
  });
  (debts||[]).forEach(dt=>{
    const name=dt.name||dt.type||"Loan";
    (dt.payments||[]).forEach((p,i)=>{
      if(!p||!p.date||p.date<from||p.date>to)return;
      const split=p.interest!=null&&p.principal!=null;
      ev.push({key:"dp"+dt.id+p.date+i,date:p.date,type:"repay",title:name,amount:parseFloat(p.amount)||0,dir:"out",paid:true,note:split?fmt(p.interest)+" interest, "+fmt(p.principal)+" principal":"Extra repayment"});
    });
    const pay=parseFloat(dt.minPayment)||0;
    if(!dt.nextPaymentDate||pay<=0)return;
    let bal=parseFloat(dt.balance)||0;
    const rate=parseFloat(dt.rate)||0,off=parseFloat(dt.offsetBalance)||0,freq=dt.frequency||"monthly";
    const anchor=dt.payDay||parseInt(String(dt.nextPaymentDate).slice(8,10),10)||1;
    let d=dt.nextPaymentDate,n=0;
    while(d<=to&&bal>0&&n<700){
      const interest=Math.max(bal-off,0)*(rate/100)*((DEBT_PERIOD_DAYS[freq]||365/12)/365);
      const principal=Math.max(Math.min(pay-interest,bal),0);
      if(d>=from)ev.push({key:"d"+dt.id+d,date:d,type:"repay",title:name,amount:Math.min(pay,principal+interest),dir:"out",estimated:true,note:rate?"Est. "+fmt(interest)+" interest, "+fmt(principal)+" principal":"Scheduled repayment"});
      bal-=principal;d=calStep(d,freq,anchor);n++;
    }
  });
  (dividends||[]).forEach(dv=>{
    if(!dv.nextPayDate)return;
    const h=(holdings||[]).find(x=>x.ticker===dv.ticker);
    const sh=parseFloat(h?h.shares:dv.shares)||0;
    const amt=(parseFloat(dv.amountPerShare)||0)*sh;
    calOccurrences(dv.nextPayDate,dv.frequency||"quarterly",from,to).forEach(d=>{
      ev.push({key:"v"+dv.id+d,date:d,type:"dividend",title:dv.ticker+" dividend",amount:amt,dir:"in",estimated:true,note:"Estimated"+(dv.franking?", "+dv.franking+"% franked":"")});
    });
  });
  (goals||[]).forEach(g=>{
    if(g.endDate&&g.endDate>=from&&g.endDate<=to)ev.push({key:"g"+g.id,date:g.endDate,type:"deadline",title:"Goal: "+g.title,note:g.progress!=null?g.progress+"% complete":"",done:(g.progress||0)>=100});
    (g.checkpoints||[]).forEach(cp=>{if(cp.dueDate&&cp.dueDate>=from&&cp.dueDate<=to)ev.push({key:"gc"+g.id+"_"+cp.id,date:cp.dueDate,type:"deadline",title:cp.text,note:"Milestone for "+g.title,done:!!cp.done});});
  });
  if(_locale==="en-AU"){
    const y0=parseInt(from.slice(0,4),10),y1=parseInt(to.slice(0,4),10);
    for(let y=y0;y<=y1;y++){
      const eofy=y+"-06-30",lodge=y+"-10-31";
      if(eofy>=from&&eofy<=to)ev.push({key:"tx1"+y,date:eofy,type:"deadline",title:"End of financial year",note:"Last day to make deductible purchases and super contributions for FY"+String(y).slice(2)});
      if(lodge>=from&&lodge<=to)ev.push({key:"tx2"+y,date:lodge,type:"deadline",title:"Tax return due",note:"If lodging yourself. Registered tax agents can have later dates."});
    }
  }
  (calendarItems||[]).forEach(it=>{
    const isInc=it.type==="income";
    const amt=parseFloat(it.amount)||0;
    calOccurrences(it.date,it.repeat,from,to).forEach(d=>{
      if(it.endDate&&d>it.endDate)return;
      ev.push({key:"c"+it.id+d,date:d,type:isInc?"income":"reminder",title:it.title||(isInc?"Income":"Reminder"),amount:amt,dir:amt>0?(isInc?"in":"out"):null,note:[CAL_REPEAT_SHORT[it.repeat]||"",it.note||""].filter(Boolean).join(" - "),item:it,occ:d,done:(it.doneDates||[]).includes(d),estimated:isInc});
    });
  });
  return ev.sort((a,b)=>a.date.localeCompare(b.date)||(CAL_ORDER[a.type]-CAL_ORDER[b.type]));
}
function calDayLabel(ds,long){
  const today=todayStr();
  if(ds===today)return "Today";
  if(ds===daysAgoStr(-1))return "Tomorrow";
  if(ds===daysAgoStr(1))return "Yesterday";
  try{return parseLocalDate(ds).toLocaleDateString(_locale,long?{weekday:"long",day:"numeric",month:"long"}:{weekday:"short",day:"numeric",month:"short"});}catch{return ds;}
}
function toggleCalDone(setCalendarItems,it,occ){
  if(!setCalendarItems||!it)return;
  setCalendarItems(xs=>(xs||[]).map(x=>{
    if(!idEq(x.id,it.id))return x;
    const dd=x.doneDates||[];
    return{...x,doneDates:dd.includes(occ)?dd.filter(z=>z!==occ):[...dd,occ].slice(-300)};
  }));
}
function CalTick({done,onClick,color}){
  const t=T();const c=color||t.GOLD;
  return <button aria-label={done?"Mark not done":"Mark done"} onClick={e=>{e.stopPropagation();onClick();}} style={{width:18,height:18,borderRadius:5,border:"1.5px solid "+(done?c:t.MUTED),background:done?c:"transparent",color:"#080808",fontSize:11,lineHeight:"14px",padding:0,cursor:"pointer",flexShrink:0,fontWeight:700}}>{done?"✓":""}</button>;
}
// One row in a list of calendar events
function CalEventRow({e,setCalendarItems,onEdit,onOpen,showDate}){
  const t=T();const c=CAL_COLORS[e.type];
  const dim=e.paid||e.done;
  return(
    <div onClick={onOpen} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid "+t.BORDER,cursor:onOpen?"pointer":"default"}}>
      {e.item&&e.type==="reminder"?<CalTick done={e.done} color={c} onClick={()=>toggleCalDone(setCalendarItems,e.item,e.occ)}/>:<div style={{width:4,alignSelf:"stretch",minHeight:26,borderRadius:2,background:c,flexShrink:0,opacity:dim?.5:1}}/>}
      <div style={{flex:1,minWidth:0,opacity:dim?.6:1}}>
        <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textDecoration:e.done?"line-through":"none"}}>{e.title}</div>
        <div style={{fontSize:9,color:e.overdue?t.RED:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(showDate?calDayLabel(e.date)+(e.note?" - ":""):"")+(e.note||"")}</div>
      </div>
      {e.amount>0&&<div style={{fontSize:12,fontWeight:700,fontFamily:"'Montserrat',sans-serif",color:e.dir==="in"?t.GREEN:e.dir==="out"?t.RED:t.MUTED,flexShrink:0,opacity:dim?.6:1}}>{(e.dir==="in"?"+":e.dir==="out"?"-":"")+fmt(e.amount)}</div>}
      {e.item&&onEdit&&<button onClick={ev=>{ev.stopPropagation();onEdit(e.item);}} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:5,color:t.MUTED,fontSize:9,padding:"3px 7px",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",flexShrink:0}}>Edit</button>}
    </div>
  );
}
// Next 14 days of money in/out and reminders (Dashboard + Calendar)
function UpcomingCard({src,setCalendarItems,setPage,limit,onCalendar,fill}){
  const t=T();
  const today=todayStr(),end=daysAgoStr(-13);
  const all=buildCalendarEvents(src,daysAgoStr(60),end);
  const overdue=all.filter(e=>e.date<today&&((e.type==="reminder"&&e.item&&!e.done)||(e.type==="bill"&&e.overdue)));
  const next=all.filter(e=>e.date>=today&&!e.paid);
  const out=[...overdue,...next].filter(e=>e.dir==="out").reduce((s,e)=>s+(e.amount||0),0);
  const inc=next.filter(e=>e.dir==="in").reduce((s,e)=>s+(e.amount||0),0);
  const list=[...overdue.map(e=>({...e,note:"Overdue"+(e.note&&e.note!=="Overdue"?" - "+e.note:""),overdue:true})),...next.filter(e=>!e.done)];
  const n=limit||6;
  return(
    <Card style={fill?{height:"100%",boxSizing:"border-box"}:undefined}>
      <SectionLabel action={onCalendar?<button onClick={onCalendar} style={{background:"none",border:"none",color:t.GOLD,fontSize:9,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",letterSpacing:1,padding:0}}>CALENDAR</button>:<span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>Next 14 days</span>}>Upcoming</SectionLabel>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        <div style={{background:t.RED+"12",border:"1px solid "+t.RED+"30",borderRadius:7,padding:"7px 10px"}}>
          <div style={{fontSize:8,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1}}>Going out</div>
          <div style={{fontSize:15,color:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{fmt(out)}</div>
        </div>
        <div style={{background:t.GREEN+"12",border:"1px solid "+t.GREEN+"30",borderRadius:7,padding:"7px 10px"}}>
          <div style={{fontSize:8,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1}}>Coming in</div>
          <div style={{fontSize:15,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{fmt(inc)}</div>
        </div>
      </div>
      {list.length===0?(
        <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",padding:"6px 0"}}>Nothing due in the next 14 days</div>
      ):(
        <div>
          {list.slice(0,n).map(e=><CalEventRow key={e.key} e={e} showDate setCalendarItems={setCalendarItems} onOpen={CAL_PAGE[e.type]&&setPage?()=>setPage(CAL_PAGE[e.type]):(onCalendar||null)}/>)}
          {list.length>n&&<div onClick={onCalendar} style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:6,textAlign:"right",cursor:onCalendar?"pointer":"default"}}>{"+"+(list.length-n)+" more"}</div>}
        </div>
      )}
    </Card>
  );
}
function CalendarPage({bills,debts,dividends,holdings,goals,calendarItems,setCalendarItems,history,dailySnaps,setPage}){
  const t=T();const isMobile=useIsMobile();
  const today=todayStr();
  const[cursor,setCursor]=useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()};});
  const[sel,setSel]=useState(today);
  const[filters,setFilters]=useState({bill:true,repay:true,dividend:true,income:true,deadline:true,reminder:true});
  const[form,setForm]=useState(null);
  const src={bills,debts,dividends,holdings,goals,calendarItems};
  const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const first=new Date(cursor.y,cursor.m,1,12);
  const gridStart=new Date(cursor.y,cursor.m,1-((first.getDay()+6)%7),12);
  const last=new Date(cursor.y,cursor.m+1,0,12);
  const gridEnd=new Date(cursor.y,cursor.m+1,6-((last.getDay()+6)%7),12);
  const from=localDateStr(gridStart),to=localDateStr(gridEnd);
  const events=buildCalendarEvents(src,from,to).filter(e=>filters[e.type]);
  const byDate={};events.forEach(e=>{(byDate[e.date]=byDate[e.date]||[]).push(e);});
  const days=[];for(let d=new Date(gridStart);d<=gridEnd;d.setDate(d.getDate()+1))days.push(localDateStr(d));
  const weeks=[];for(let i=0;i<days.length;i+=7)weeks.push(days.slice(i,i+7));
  const mPrefix=cursor.y+"-"+String(cursor.m+1).padStart(2,"0");
  const monthEv=events.filter(e=>e.date.startsWith(mPrefix));
  const mOut=monthEv.filter(e=>e.dir==="out").reduce((s,e)=>s+(e.amount||0),0);
  const mIn=monthEv.filter(e=>e.dir==="in").reduce((s,e)=>s+(e.amount||0),0);
  const selEvents=buildCalendarEvents(src,sel,sel).filter(e=>filters[e.type]);
  const selSnap=(dailySnaps||{})[sel];const selHist=(history||{})[sel];
  const move=k=>{setCursor(c=>{const d=new Date(c.y,c.m+k,1);return{y:d.getFullYear(),m:d.getMonth()};});};
  const goToday=()=>{const d=new Date();setCursor({y:d.getFullYear(),m:d.getMonth()});setSel(today);};
  const scoreCol=s=>s>=80?t.GREEN:s>=50?t.GOLD:t.RED;
  const newItem=type=>setForm({type,title:"",date:sel,repeat:"none",amount:"",note:"",endDate:""});
  const saveForm=()=>{
    if(!form||!form.title.trim()||!form.date)return;
    const clean={...form,title:form.title.trim(),amount:form.amount===""?"":String(parseFloat(form.amount)||""),endDate:form.repeat==="none"?"":form.endDate};
    if(form.id)setCalendarItems(xs=>(xs||[]).map(x=>idEq(x.id,form.id)?{...x,...clean}:x));
    else setCalendarItems(xs=>[...(xs||[]),{...clean,id:Date.now(),doneDates:[]}]);
    setSel(form.date);setForm(null);
  };
  const delItem=()=>{if(!form||!form.id)return;setCalendarItems(xs=>(xs||[]).filter(x=>!idEq(x.id,form.id)));setForm(null);};
  // Stop a repeating item from the selected day onward (earlier ticks are kept)
  const stopFrom=()=>{if(!form||!form.id||sel<=form.date)return;const endD=localDateStr(new Date(parseLocalDate(sel).getTime()-864e5));setCalendarItems(xs=>(xs||[]).map(x=>idEq(x.id,form.id)?{...x,endDate:endD}:x));setForm(null);};
  const lbl={fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4};
  const cellBg="rgba(255,255,255,0.025)";

  const formCard=form&&(
    <Card style={{marginBottom:12,border:"1px solid "+CAL_COLORS[form.type==="income"?"income":"reminder"]+"55"}}>
      <SectionLabel>{(form.id?"Edit ":"New ")+(form.type==="income"?"expected income":"reminder")}</SectionLabel>
      <div style={{display:"flex",gap:6,marginBottom:10}}>
        {[["reminder","Reminder"],["income","Expected income"]].map(([k,l])=>(
          <button key={k} onClick={()=>setForm(f=>({...f,type:k}))} style={{flex:1,padding:"7px 8px",borderRadius:6,border:"1px solid "+(form.type===k?CAL_COLORS[k]:t.BORDER),background:form.type===k?CAL_COLORS[k]+"22":"transparent",color:form.type===k?CAL_COLORS[k]:t.MUTED,fontSize:11,fontFamily:"'Montserrat',sans-serif",cursor:"pointer"}}>{l}</button>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10}}>
        <div style={{gridColumn:isMobile?"auto":"1 / span 2"}}><div style={lbl}>Title</div><Inp value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder={form.type==="income"?"e.g. Salary, commission, rent":"e.g. Pay BAS, check super, renew insurance"}/></div>
        <div><div style={lbl}>{form.repeat==="none"?"Date":"First date"}</div><Inp type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></div>
        <div><div style={lbl}>Repeats</div><Sel value={form.repeat} onChange={e=>setForm(f=>({...f,repeat:e.target.value}))}>{CAL_REPEAT.map(([k,l])=><option key={k} value={k}>{l}</option>)}</Sel></div>
        <div><div style={lbl}>{form.type==="income"?"Amount":"Amount (optional)"}</div><Inp type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0"/></div>
        {form.repeat!=="none"?<div><div style={lbl}>Ends (optional)</div><Inp type="date" value={form.endDate||""} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))}/></div>:<div/>}
        <div style={{gridColumn:isMobile?"auto":"1 / span 2"}}><div style={lbl}>Note (optional)</div><Inp value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder=""/></div>
      </div>
      {form.type==="reminder"&&<div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:8}}>An amount counts toward money going out. Tick a reminder off each time it is done.</div>}
      <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
        <Btn onClick={saveForm} disabled={!form.title.trim()||!form.date}>{form.id?"Save changes":"Add to calendar"}</Btn>
        <Btn variant="ghost" onClick={()=>setForm(null)}>Cancel</Btn>
        {form.id&&form.repeat!=="none"&&sel>form.date&&<Btn variant="ghost" onClick={stopFrom} style={{color:t.GOLD}}>{"Stop from "+calDayLabel(sel)}</Btn>}
        {form.id&&<Btn variant="ghost" onClick={delItem} style={{color:t.RED,marginLeft:"auto"}}>Delete</Btn>}
      </div>
    </Card>
  );

  return(
    <div data-page="true" style={{maxWidth:1100,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:14,gap:10,flexWrap:"wrap"}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Command</div>
          <div style={{fontSize:26,color:t.TEXT}}>Calendar</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn variant="ghost" onClick={()=>newItem("income")} style={{padding:"8px 12px",fontSize:11}}>+ Income</Btn>
          <Btn onClick={()=>newItem("reminder")} style={{padding:"8px 12px",fontSize:11}}>+ Reminder</Btn>
        </div>
      </div>

      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
        {CAL_TYPES.map(([k,l])=>{const on=filters[k];const c=CAL_COLORS[k];return(
          <button key={k} onClick={()=>setFilters(f=>({...f,[k]:!f[k]}))} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:99,border:"1px solid "+(on?c+"88":t.BORDER),background:on?c+"18":"transparent",color:on?t.TEXT:t.MUTED,fontSize:10,fontFamily:"'Montserrat',sans-serif",cursor:"pointer",...(hasPhoto()&&!on?surfaceBg():{})}}>
            <span style={{width:7,height:7,borderRadius:99,background:on?c:t.MUTED,opacity:on?1:.5}}/>{l}
          </button>);})}
      </div>

      {formCard}

      <Card style={{padding:isMobile?10:14,marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,gap:8,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <button aria-label="Previous month" onClick={()=>move(-1)} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:6,color:t.TEXT,width:30,height:28,cursor:"pointer",fontSize:14}}>{"‹"}</button>
            <div style={{fontSize:isMobile?16:18,color:t.TEXT,minWidth:isMobile?130:170,textAlign:"center"}}>{MONTHS[cursor.m]+" "+cursor.y}</div>
            <button aria-label="Next month" onClick={()=>move(1)} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:6,color:t.TEXT,width:30,height:28,cursor:"pointer",fontSize:14}}>{"›"}</button>
            <button onClick={goToday} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:6,color:t.MUTED,padding:"5px 9px",cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif",marginLeft:4}}>Today</button>
          </div>
          <div style={{display:"flex",gap:12,fontFamily:"'Montserrat',sans-serif",fontSize:11}}>
            <span style={{color:t.MUTED}}>Out <span style={{color:t.RED,fontWeight:700}}>{fmt(mOut)}</span></span>
            <span style={{color:t.MUTED}}>In <span style={{color:t.GREEN,fontWeight:700}}>{fmt(mIn)}</span></span>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(7,minmax(0,1fr))":"repeat(7,minmax(0,1fr)) 78px",gap:isMobile?3:5}}>
          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].concat(isMobile?[]:["Week"]).map(h=>(
            <div key={h} style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,textAlign:"center",paddingBottom:4}}>{isMobile?h.slice(0,1):h}</div>
          ))}
          {weeks.map((wk,wi)=>{
            const wEv=wk.flatMap(d=>byDate[d]||[]);
            const wOut=wEv.filter(e=>e.dir==="out").reduce((s,e)=>s+(e.amount||0),0);
            const wIn=wEv.filter(e=>e.dir==="in").reduce((s,e)=>s+(e.amount||0),0);
            return [
              ...wk.map(ds=>{
                const evs=byDate[ds]||[];
                const inMonth=ds.startsWith(mPrefix);
                const isToday=ds===today,isSel=ds===sel;
                const sc=ds<today&&history&&history[ds]&&history[ds].score!=null?history[ds].score:null;
                return(
                  <div key={ds} data-cal-day={ds} onClick={()=>setSel(ds)} style={{minHeight:isMobile?50:96,padding:isMobile?"4px 3px":"5px 6px",borderRadius:6,background:isSel?t.GOLD+"1A":cellBg,border:"1px solid "+(isSel?t.GOLD+"99":isToday?t.GOLD+"55":t.BORDER),opacity:inMonth?1:.38,cursor:"pointer",overflow:"hidden",minWidth:0,boxSizing:"border-box"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                      <span style={{fontSize:isMobile?11:12,color:isToday?t.GOLD:t.TEXT,fontWeight:isToday?700:500,fontFamily:"'Montserrat',sans-serif"}}>{parseInt(ds.slice(8),10)}</span>
                      {sc!=null&&<span title="Daily score" style={{fontSize:isMobile?7:9,color:scoreCol(sc),fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{sc}</span>}
                    </div>
                    {isMobile?(
                      <div style={{display:"flex",flexWrap:"wrap",gap:2}}>
                        {evs.slice(0,6).map(e=><span key={e.key} style={{width:5,height:5,borderRadius:99,background:CAL_COLORS[e.type],opacity:e.paid||e.done?.45:1}}/>)}
                      </div>
                    ):(
                      <div>
                        {evs.slice(0,3).map(e=>{const c=CAL_COLORS[e.type];return(
                          <div key={e.key} title={e.title+(e.amount?" "+fmt(e.amount):"")} style={{fontSize:9,lineHeight:"14px",background:c+"22",borderLeft:"2px solid "+c,color:t.TEXT,borderRadius:3,padding:"0 4px",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontFamily:"'Montserrat',sans-serif",opacity:e.paid||e.done?.5:1,textDecoration:e.done?"line-through":"none"}}>{e.title+(e.amount?" "+fmt(e.amount):"")}</div>
                        );})}
                        {evs.length>3&&<div style={{fontSize:8,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>{"+"+(evs.length-3)+" more"}</div>}
                      </div>
                    )}
                  </div>
                );
              }),
              ...(isMobile?[]:[
                <div key={"w"+wi} style={{display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"flex-end",gap:3,padding:"0 4px",fontFamily:"'Montserrat',sans-serif",borderLeft:"1px solid "+t.BORDER}}>
                  {wOut>0&&<div style={{fontSize:10,color:t.RED,fontWeight:700}}>{"-"+fmt(wOut)}</div>}
                  {wIn>0&&<div style={{fontSize:10,color:t.GREEN,fontWeight:700}}>{"+"+fmt(wIn)}</div>}
                  {wOut===0&&wIn===0&&<div style={{fontSize:9,color:t.MUTED2}}>-</div>}
                </div>
              ])
            ];
          })}
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1.3fr) minmax(0,1fr)",gap:12,alignItems:"start"}}>
        <Card>
          <SectionLabel action={<button onClick={()=>newItem("reminder")} style={{background:"none",border:"none",color:t.GOLD,fontSize:9,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",letterSpacing:1,padding:0}}>+ ADD</button>}>{calDayLabel(sel,true)}</SectionLabel>
          {sel<today&&(selHist||selSnap)&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10}}>
              {[
                ["Score",selHist&&selHist.score!=null?String(selHist.score):"-",selHist&&selHist.score!=null?scoreCol(selHist.score):t.MUTED],
                ["Net worth",selSnap&&selSnap.nw!=null?fmt(selSnap.nw):"-",t.GOLD],
                ["Tasks",selSnap&&selSnap.td?selSnap.td.length+"/"+(selSnap.td.length+(selSnap.to||[]).length):"-",t.TEXT],
                ["Supps",selSnap&&selSnap.st?selSnap.st.length+"/"+(selSnap.st.length+(selSnap.sm||[]).length):"-",t.TEXT],
              ].map(([l,v,c])=>(
                <div key={l} style={{background:cellBg,border:"1px solid "+t.BORDER,borderRadius:6,padding:"6px 8px"}}>
                  <div style={{fontSize:8,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1}}>{l}</div>
                  <div style={{fontSize:13,color:c,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{v}</div>
                </div>
              ))}
            </div>
          )}
          {selEvents.length===0?(
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",padding:"6px 0"}}>Nothing scheduled.</div>
          ):selEvents.map(e=><CalEventRow key={e.key} e={e} setCalendarItems={setCalendarItems} onEdit={it=>setForm({type:it.type||"reminder",title:it.title||"",date:it.date,repeat:it.repeat||"none",amount:it.amount||"",note:it.note||"",endDate:it.endDate||"",id:it.id})} onOpen={CAL_PAGE[e.type]?()=>setPage&&setPage(CAL_PAGE[e.type]):null}/>)}
          {selEvents.some(e=>e.estimated)&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:8}}>Estimated amounts are projections from your saved details and may differ from what is actually paid.</div>}
        </Card>
        <UpcomingCard src={src} setCalendarItems={setCalendarItems} setPage={setPage} limit={8}/>
      </div>
    </div>
  );
}

function WeeklyPage({dailySnaps,completed,transactions,profile,tasks,goals,habits,habitLog,history,journal,workouts,supplements,bodyLog,weeklyReflections,setWeeklyReflections,subscription,setShowUpgrade,authToken}){
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
      const r=await claudeFetch({model:"claude-haiku-4-5",max_tokens:900,system:GENERAL_INFO_RULE+" Performance coach for "+profile.firstName+". Direct, specific. Structure: WINS (2-3 with numbers), GAPS (1-2), PATTERNS (one data insight), NEXT WEEK (3 priorities). Max 270 words.",messages:[{role:"user",content:"Week "+weekStart+" to "+weekEnd+"\nScores: avg "+avgScore+"/100 - "+daysActive+"/7 active\nHabits ("+habitAvg+"%):\n"+habitDetails+"\nWorkouts ("+weekWorkouts.length+"): "+wSummary+"\nBody: "+bSummary+"\nJournal: "+weekJournal.length+" entries, avg mood "+avgMood+"/5\nGoals: "+goalsSummary}]});
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
      <DailySnapshots last7={last7} dailySnaps={dailySnaps} history={history} habits={habits} habitLog={habitLog} completed={completed} transactions={transactions} workouts={workouts} bodyLog={bodyLog} journal={journal}/>
      <Card style={{borderColor:t.GOLD+"33",marginBottom:14}}>
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

      <MonthlyHeatmap history={history} highlight={last7}/>

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
    </div>
  );
}

// ---- Executive AI ----
// Shared instruction for every AI feature that touches money: general information only.
const GENERAL_INFO_RULE="IMPORTANT: You provide general information only, not personal financial advice, and you are not a licensed financial adviser. Never recommend buying, selling or holding a specific financial product (a particular share, ETF, fund, cryptocurrency, super fund, loan or insurance product) and never tell the user which product to choose. You may explain concepts, compare general strategies and asset classes, describe how an approach would play out using the user's own numbers, analyse their history and habits, and share factual market information. When a question needs personal financial, tax or legal advice, give the general picture and suggest they speak with a licensed financial adviser, accountant or tax agent. Never describe yourself as an adviser.";

// Compact history of the user's activity for Executive AI, built from data the app already stores.
function aiHistoryDigest(d){
  const out=[];
  const snaps=d.dailySnaps||{},hist=d.history||{},today=todayStr();
  const snapKeys=Object.keys(snaps).filter(k=>snaps[k]).sort();
  const dd=s=>new Date(s+"T12:00:00").toLocaleDateString("en-AU",{day:"numeric",month:"short"});
  const mm=k=>new Date(k+"-15T12:00:00").toLocaleDateString("en-AU",{month:"short",year:"numeric"});
  const cut=(s,n)=>{s=String(s||"").replace(/\s+/g," ").trim();return s.length>n?s.slice(0,n)+"...":s;};
  const sgn=v=>(v>0?"+":v<0?"-":"")+fmt(Math.abs(v));

  // Net worth - month by month (month-end), then the last 30 days
  const months={};
  Object.keys(d.nwHistory||{}).forEach(k=>{const v=parseFloat(d.nwHistory[k]);if(v)months[k]=v;});
  snapKeys.forEach(k=>{if(typeof snaps[k].nw==="number")months[k.slice(0,7)]=snaps[k].nw;});
  const mk=Object.keys(months).sort().slice(-24);
  if(mk.length){
    out.push("NET WORTH BY MONTH (month-end, most recent last): "+mk.map(k=>mm(k)+" "+fmt(months[k])).join("; "));
  }
  const last30=snapKeys.filter(k=>k>=daysAgoStr(30)&&typeof snaps[k].nw==="number");
  if(last30.length>1){
    const v=last30.map(k=>snaps[k].nw),first=snaps[last30[0]],last=snaps[last30[last30.length-1]];
    let line="LAST 30 DAYS NET WORTH: "+fmt(v[0])+" ("+dd(last30[0])+") to "+fmt(v[v.length-1])+" ("+dd(last30[last30.length-1])+"), high "+fmt(Math.max(...v))+", low "+fmt(Math.min(...v));
    if(typeof first.a==="number"&&typeof last.a==="number")line+=". Total assets "+sgn(last.a-first.a)+", total debt "+sgn(last.d-first.d);
    out.push(line);
  }
  if(snapKeys.length)out.push("(Daily tracking began "+dd(snapKeys[0])+(mk.length?"; earlier months are monthly totals only":"")+".)");

  // Daily execution - weekly blocks, most recent first
  const habits=d.habits||[],log=d.habitLog||{};
  // Habit rates only from the first day any habit was ticked (earlier weeks would read as 0%)
  const firstHabitDay=Object.keys(log).filter(k=>log[k]).map(k=>k.slice(k.lastIndexOf("_")+1)).sort()[0]||null;
  const weeks=[];
  for(let w=0;w<12;w++){
    const days=[];for(let i=6;i>=0;i--)days.push(daysAgoStr(w*7+i));
    const scored=days.filter(x=>hist[x]&&hist[x].score>0);
    const snapDays=days.filter(x=>snaps[x]);
    const tasks=days.reduce((s,x)=>s+(snaps[x]?(snaps[x].td||[]).length:((hist[x]&&hist[x].tasks)||0)),0);
    const hPossible=firstHabitDay?habits.length*days.filter(x=>x<=today&&x>=firstHabitDay).length:0;
    const hDone=days.reduce((s,x)=>s+habits.filter(h=>log[h.id+"_"+x]).length,0);
    const st=snapDays.reduce((s,x)=>s+(snaps[x].st||[]).length,0),sAll=snapDays.reduce((s,x)=>s+(snaps[x].st||[]).length+(snaps[x].sm||[]).length,0);
    if(!scored.length&&!tasks&&!hDone)continue;
    const avg=scored.length?Math.round(scored.reduce((s,x)=>s+hist[x].score,0)/scored.length):0;
    weeks.push("week to "+dd(days[6])+": score "+avg+" ("+scored.length+" days tracked), "+tasks+" tasks done"+(hPossible?", habits "+Math.round(hDone/hPossible*100)+"%":"")+(sAll?", supplements "+Math.round(st/sAll*100)+"%":""));
  }
  if(weeks.length)out.push("WEEKLY EXECUTION (most recent first):\n- "+weeks.join("\n- "));

  // Tasks actually completed, last 14 days
  const doneDays=snapKeys.filter(k=>k>=daysAgoStr(13)&&(snaps[k].td||[]).length).reverse();
  if(doneDays.length)out.push("TASKS COMPLETED (last 14 days):\n- "+doneDays.map(k=>dd(k)+": "+snaps[k].td.slice(0,8).map(x=>cut(x,50)).join(", ")+(snaps[k].td.length>8?" (+"+(snaps[k].td.length-8)+" more)":"")+((snaps[k].to||[]).length?" | not done: "+snaps[k].to.slice(0,4).map(x=>cut(x,40)).join(", "):"")).join("\n- "));

  // Habits - completion rates and streaks
  if(habits.length){
    const rows=habits.map(h=>{
      let c30=0,c90=0;for(let i=0;i<90;i++){if(log[h.id+"_"+daysAgoStr(i)]){c90++;if(i<30)c30++;}}
      let streak=0,i=log[h.id+"_"+today]?0:1;while(i<400&&log[h.id+"_"+daysAgoStr(i)]){streak++;i++;}
      return h.name+": "+c30+"/30 days, "+c90+"/90 days, current streak "+streak;
    });
    out.push("HABITS:\n- "+rows.join("\n- "));
  }

  // Goals
  const active=(d.goals||[]);
  if(active.length)out.push("ACTIVE GOALS: "+active.map(g=>cut(g.title,60)+" ("+(g.progress||0)+"%, "+(g.period||"")+")").join("; "));
  const comp=[...(d.completed||[])].filter(g=>g&&g.title).sort((a,b)=>String(b.completedAt||"").localeCompare(String(a.completedAt||""))).slice(0,20);
  if(comp.length)out.push("COMPLETED GOALS (most recent first): "+comp.map(g=>cut(g.title,60)+(g.completedAt?" ("+dd(g.completedAt)+")":"")).join("; "));

  // Debts and repayments
  const debts=(d.debts||[]).filter(x=>parseFloat(x.balance)>0||(x.payments||[]).length);
  if(debts.length){
    const since=daysAgoStr(90);
    out.push("LOANS:\n- "+debts.map(x=>{
      const p=(x.payments||[]).filter(y=>y.date>=since);
      const pr=p.reduce((s,y)=>s+(parseFloat(y.principal!=null?y.principal:y.amount)||0),0),it=p.reduce((s,y)=>s+(parseFloat(y.interest)||0),0);
      return cut(x.name,40)+" ("+(x.type||"Loan")+"): "+fmt(parseFloat(x.balance)||0)+(x.rate!==""&&x.rate!=null?" at "+x.rate+"%":"")+(parseFloat(x.minPayment)?", repaying "+fmt(parseFloat(x.minPayment))+" "+(x.frequency||"monthly"):"")+(parseFloat(x.offsetBalance)>0?", offset "+fmt(parseFloat(x.offsetBalance)):"")+(p.length?". Last 90 days: "+fmt(pr)+" off the loan, "+fmt(it)+" interest":"");
    }).join("\n- "));
  }

  // Income and spending, last 6 months
  const tx=d.transactions||[];
  if(tx.length){
    const ms=[];for(let i=5;i>=0;i--){const x=new Date();x.setDate(1);x.setMonth(x.getMonth()-i);ms.push(x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0"));}
    const rows=ms.map(m=>{const inc=tx.filter(y=>y.type==="income"&&String(y.date).startsWith(m)).reduce((s,y)=>s+Math.abs(parseFloat(y.amount)||0),0);const exp=tx.filter(y=>y.type==="expense"&&String(y.date).startsWith(m)).reduce((s,y)=>s+Math.abs(parseFloat(y.amount)||0),0);return (inc||exp)?mm(m)+" in "+fmt(inc)+" / out "+fmt(exp):null;}).filter(Boolean);
    const cats={};tx.filter(y=>y.type==="expense"&&y.date>=daysAgoStr(90)).forEach(y=>{cats[y.category||"Other"]=(cats[y.category||"Other"]||0)+Math.abs(parseFloat(y.amount)||0);});
    const top=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([c,v])=>c+" "+fmt(v));
    if(rows.length)out.push("CASH FLOW (recorded): "+rows.join("; ")+(top.length?". Top spending last 90 days: "+top.join(", "):""));
  }

  // Holdings, cash and super history
  const hold=(d.holdings||[]).slice(0,20);
  if(hold.length)out.push("SHARE/ETF HOLDINGS: "+hold.map(h=>h.ticker+" "+(Math.round((parseFloat(h.shares)||0)*10000)/10000)+" units"+(h.avgCost?" avg "+fmt(parseFloat(h.avgCost)):"")).join("; "));
  const cashLog=((d.profile&&d.profile.cashLog)||[]).slice(0,4);
  if(cashLog.length)out.push("CASH BALANCE UPDATES: "+cashLog.map(e=>dd(e.date)+" "+fmt(e.balance)).join("; "));
  const sup=[...(d.superLog||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,4);
  if(sup.length)out.push("SUPER BALANCE UPDATES: "+sup.map(e=>dd(e.date)+" "+fmt(e.balance)).join("; "));

  // Reading, training, body
  const books=d.books||[];
  const fin=books.filter(b=>b.status==="done"&&(!b.dateFinished||b.dateFinished>=daysAgoStr(365))).slice(-12);
  const reading=books.filter(b=>b.status==="reading");
  if(fin.length||reading.length)out.push("READING: "+(fin.length?"finished "+fin.map(b=>cut(b.title,40)+(b.dateFinished?" ("+dd(b.dateFinished)+")":"")).join(", "):"")+(reading.length?(fin.length?"; ":"")+"currently reading "+reading.map(b=>cut(b.title,40)+" (p."+(b.cur||0)+"/"+(b.tot||"?")+")").join(", "):""));
  const wk=d.workouts||[];
  if(wk.length){
    const ms=[];for(let i=2;i>=0;i--){const x=new Date();x.setDate(1);x.setMonth(x.getMonth()-i);ms.push(x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0"));}
    out.push("WORKOUTS PER MONTH: "+ms.map(m=>mm(m)+" "+wk.filter(w=>String(w.date).startsWith(m)).length).join(", "));
  }
  const wts=(d.bodyLog||[]).filter(e=>e.weight&&e.date>=daysAgoStr(90)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  if(wts.length)out.push("WEIGHT (last 90 days): "+(wts.length>1?wts[0].weight+"kg ("+dd(wts[0].date)+") to ":"")+wts[wts.length-1].weight+"kg ("+dd(wts[wts.length-1].date)+")");

  // Recent reflections and reviews
  const wr=d.weeklyReflections||{};
  const refl=Object.keys(wr).filter(k=>/^week_\d{4}-\d{2}-\d{2}$/.test(k)&&wr[k]).sort().slice(-3).reverse();
  if(refl.length)out.push("USER'S WEEKLY REFLECTIONS:\n- "+refl.map(k=>"week of "+dd(k.slice(5))+": "+cut(wr[k],240)).join("\n- "));
  const rev=Object.keys(wr).filter(k=>/_ai$/.test(k)&&wr[k]).sort().slice(-2).reverse();
  if(rev.length)out.push("PREVIOUS WEEKLY AI REVIEWS:\n- "+rev.map(k=>"week of "+dd(k.slice(5,15))+": "+cut(wr[k],300)).join("\n- "));
  const jr=[...(d.journal||[])].filter(e=>e&&e.text).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,5);
  if(jr.length)out.push("RECENT JOURNAL:\n- "+jr.map(e=>dd(e.date)+(e.mood?" (mood "+e.mood+"/5)":"")+": "+cut(e.text,140)).join("\n- "));

  const s=out.join("\n\n");
  return s.length>12000?s.slice(0,12000)+"\n(history truncated)":s;
}

function AdvisorPage({profile,properties,tasks,goals,supplements,habits,habitLog,messages,setMessages,dailySnaps,history,nwHistory,completed,debts,transactions,holdings,superLog,books,workouts,bodyLog,weeklyReflections,journal}){
  const t=T();
  const initMsg={role:"assistant",content:"Good to have you here, "+profile.firstName+". I can see your dashboard and your history. Ask me anything, or say 'review my dashboard' for an honest assessment."};
  const msgs=messages&&messages.length>0?messages:[initMsg];
  const[input,setInput]=useState("");const[loading,setLoading]=useState(false);
  const bottomRef=useRef(null);const listRef=useRef(null);const boxRef=useRef(null);
  const[boxH,setBoxH]=useState(null);const[kbOpen,setKbOpen]=useState(false);
  const toBottom=smooth=>{const el=listRef.current;if(el){try{el.scrollTo({top:el.scrollHeight,behavior:smooth?"smooth":"auto"});}catch{el.scrollTop=el.scrollHeight;}}};
  useEffect(()=>{toBottom(true);},[msgs,loading]);
  // KEYBOARD_V1: size the chat to the visible screen - down to the tab bar, or to the top of the keyboard when it's open
  useEffect(()=>{
    const fit=()=>{
      const el=boxRef.current;if(!el)return;
      const kb=parseFloat(document.documentElement.style.getPropertyValue("--kb"))||0;
      const open=kb>0;setKbOpen(open);
      if(open){try{window.scrollTo(0,0);document.body.scrollTop=0;document.documentElement.scrollTop=0;}catch{}}
      const bar=document.querySelector(".exec-tabbar");
      const barH=!open&&bar?bar.getBoundingClientRect().height:0;
      const top=el.getBoundingClientRect().top+(open?0:(window.scrollY||document.body.scrollTop||0));
      const limit=window.innerHeight-(open?kb:barH)-((open||barH)?10:28);
      setBoxH(Math.max(240,Math.round(limit-top)));
      setTimeout(()=>toBottom(false),80);
    };
    fit();const t1=setTimeout(fit,300);const t2=setTimeout(fit,900);
    window.addEventListener("exec-kb",fit);window.addEventListener("resize",fit);
    return()=>{clearTimeout(t1);clearTimeout(t2);window.removeEventListener("exec-kb",fit);window.removeEventListener("resize",fit);};
  },[]);
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

  // Show the quick-start prompts on the very first message ever, and again at the start
  // of each new day - conversation history stays intact either way, this just gives a
  // fresh set of suggestions rather than only ever showing them once, forever.
  const lastMsgOverall=messages&&messages.length>0?messages[messages.length-1]:null;
  const lastMsgIsToday=lastMsgOverall&&lastMsgOverall.timestamp?new Date(lastMsgOverall.timestamp).toDateString()===new Date().toDateString():false;
  const showPrompts=msgs.length===1||!lastMsgIsToday;

  const sys="You are Executive AI, the built-in assistant in The Executive app. Direct, sharp and practical. Use web search for current market data.\n"+GENERAL_INFO_RULE+"\n\nUSER: "+profile.firstName+" "+(profile.lastName||"")+" | "+(profile.dob?calcAge(profile.dob):profile.age)+" | "+(profile.occupation||"")+" | "+(profile.location||"AU")+"\nNW: "+fmt(profile.netWorth||0)+" of "+fmt(Number(profile.netWorthTarget||3e6))+" ("+Math.round((profile.netWorth||0)/Number(profile.netWorthTarget||3e6)*100)+"%)\nIncome (stated): "+fmt(parseFloat(profile.annualIncome)||0)+(profile.recordedIncome12m?" | Income recorded last 12m: "+fmt(profile.recordedIncome12m):"")+" | Cash: "+fmt((parseFloat(profile.cashSavings)||0)+(parseFloat(profile.offsetCash)||0))+" | Shares: "+fmt(parseFloat(profile.shareValue)||0)+" | Property: "+fmt((properties||[]).reduce((s,p)=>s+(parseFloat(p.currentValue)||0),0))+"\nDebt: "+fmt(profile.totalDebt||0)+" | Risk: "+((profile.riskProfile||["Growth"])[0])+"\n\nTODAY:\nTasks "+tDone+"/"+(tasks||[]).length+" | Supps "+sDone+"/"+(supplements||[]).length+"\nPending high-priority: "+((tasks||[]).filter(tk=>!tk.done&&tk.priority==="high").map(tk=>tk.text).join(", ")||"all done")+"\n\nHABITS "+hDone+"/"+(habits||[]).length+":\n✓ Done: "+(habitsDone.join(", ")||"none")+"\n✗ Not done: "+(habitsNotDone.join(", ")||"all complete")+"\n\nGoals: "+((goals||[]).map(g=>g.title+" "+g.progress+"%").join(", ")||"none")+"\n\nFor 'review': cover FINANCES, HEALTH AND HABITS, GOALS, DAILY EXECUTION. Be direct.";

  const send=async text=>{
    const q=text||input.trim();if(!q||loading)return;setInput("");
    const newMsg={role:"user",content:q,timestamp:Date.now()};
    const updated=[...msgs,newMsg];
    setMessages(updated);setLoading(true);
    // Only send last 20 messages to Claude to manage token usage
    const contextMsgs=updated.slice(-20).map(m=>({role:m.role,content:m.content}));
    try{
      const hist=aiHistoryDigest({profile,goals,habits,habitLog,dailySnaps,history,nwHistory,completed,debts,transactions,holdings,superLog,books,workouts,bodyLog,weeklyReflections,journal});
      const r=await claudeFetch({model:"claude-sonnet-4-6",max_tokens:2000,system:sys+(hist?"\n\nHISTORY (use this for questions about past progress, trends and what they have done; if something isn't recorded, say so):\n"+hist:""),tools:[{type:"web_search_20250305",name:"web_search"}],messages:contextMsgs});
      const d=await r.json();
      const reply=(d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n")||"Try again.";
      setMessages(m=>[...m,{role:"assistant",content:reply,timestamp:Date.now()}]);
    }catch{setMessages(m=>[...m,{role:"assistant",content:"Connection error.",timestamp:Date.now()}]);}
    setLoading(false);
  };
  const PROMPTS=["Review my dashboard","What should I prioritise?","ASX market update","Accelerate my net worth","Debt payoff strategy","Investing concepts for me","Habits to add or swap","Morning briefing"];
  return (
    <div ref={boxRef} data-kb-own="true" style={{display:"flex",flexDirection:"column",height:boxH?boxH:"calc(100vh - 100px)",maxWidth:900,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:kbOpen?8:14,flexShrink:0}}>
        <div>
          {!kbOpen&&<div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:4}}>Private Intelligence</div>}
          <div style={{fontSize:kbOpen?18:26,color:t.TEXT}}>Executive AI</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2,display:kbOpen?"none":"block"}}>
            Full dashboard and history · Web search
            {lastMsgLabel&&<span style={{color:t.GOLD}}> · Memory from {lastMsgLabel}</span>}
          </div>
        </div>
        <div style={{display:"flex",gap:7,alignItems:"center"}}>
          {msgs.length>1&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{msgs.length-1} messages</div>}
          {msgs.length>1&&<button onClick={()=>setMessages([])} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:5,padding:"4px 9px",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:10}}>Clear</button>}
        </div>
      </div>
      {showPrompts&&!kbOpen&&(
        <div style={{marginBottom:12,flexShrink:0}}>
          {msgs.length>1&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Quick start for today</div>}
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {PROMPTS.map(p=>(
              <button key={p} onClick={()=>send(p)} style={{padding:"6px 11px",background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:18,color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>{p}</button>
            ))}
          </div>
        </div>
      )}
      <div ref={listRef} style={{flex:1,minHeight:0,overflowY:"auto",paddingRight:4,marginBottom:10,WebkitOverflowScrolling:"touch"}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{marginBottom:14,display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",alignItems:"flex-start",gap:9}}>
            {m.role==="assistant"&&(
              <div style={{width:28,height:28,borderRadius:"50%",background:t.GOLD+"33",border:"1px solid "+t.GOLD+"55",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:t.GOLD,flexShrink:0,marginTop:2}}>AI</div>
            )}
            <div style={{maxWidth:m.role==="user"?"62%":"80%",...(m.role==="user"?{}:surfaceBg()),background:m.role==="user"?(hasPhoto()?"linear-gradient("+t.GOLD+"22,"+t.GOLD+"22),"+GLASS_BG:t.GOLD+"14"):surfaceBg().background,border:"1px solid "+(m.role==="user"?t.GOLD+"33":t.BORDER),borderRadius:m.role==="user"?"12px 12px 3px 12px":"12px 12px 12px 3px",padding:"10px 14px"}}>
              <div style={{fontSize:13,color:t.TEXT,lineHeight:1.85,fontFamily:"'Montserrat',sans-serif",whiteSpace:"pre-wrap"}}>{m.content}</div>
            </div>
          </div>
        ))}
        {loading&&(
          <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:14}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:t.GOLD+"33",border:"1px solid "+t.GOLD+"55",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:t.GOLD,flexShrink:0}}>AI</div>
            <div style={{...surfaceBg(),border:"1px solid "+t.BORDER,borderRadius:"12px 12px 12px 3px",padding:"10px 14px",display:"flex",gap:4,alignItems:"center"}}>
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
      <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textAlign:"center",paddingTop:6,flexShrink:0}}>General information only - not financial advice. Speak with a licensed adviser before acting.</div>
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
    <div style={{padding:"14px",...surfaceBg(),border:"1px solid "+t.RED+"33",borderRadius:8,marginBottom:12}}>
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
    <div style={{padding:"16px",...surfaceBg(),border:"1px solid "+t.RED+"55",borderRadius:8,marginBottom:12}}>
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
    <div style={{padding:"16px",...surfaceBg(),border:"1px solid "+t.RED+"66",borderRadius:8,marginBottom:12}}>
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
    <div style={{padding:"16px",...surfaceBg(),border:"1px solid "+t.RED+"33",borderRadius:8,marginBottom:12,textAlign:"center"}}>
      <div style={{fontSize:12,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>Deleting your account...</div>
    </div>
  );

  if(step===4) return(
    <div style={{padding:"16px",...surfaceBg(),border:"1px solid "+t.GREEN+"44",borderRadius:8,marginBottom:12,textAlign:"center"}}>
      <div style={{fontSize:13,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>Account deleted successfully</div>
      <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:4}}>Redirecting...</div>
    </div>
  );

  return(
    <div style={{padding:"16px",...surfaceBg(),border:"1px solid "+t.RED+"55",borderRadius:8,marginBottom:12}}>
      <div style={{fontSize:12,color:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:600,marginBottom:6}}>Deletion failed</div>
      <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:10}}>{error}</div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>{setStep(0);setTyped("");setError("");}} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:6,padding:"6px 12px",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>Try Again</button>
        <a href="mailto:hello@the-executive.vip" style={{background:"none",border:"1px solid "+t.GOLD+"44",borderRadius:6,padding:"6px 12px",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,textDecoration:"none"}}>Contact Support</a>
      </div>
    </div>
  );
}

function ProfilePage({profile,setProfile,properties,onReset,onRecalibrate,theme,setTheme,bgPhoto,setBgPhotoId,nwHistory,tasks,goals,workouts,transactions,journal,authUser,authToken,handleSignOut,setShowAuth,subscription,onUpgrade,handlePortal}){
  const t=T();const isMobile=useIsMobile();const[form,setForm]=useState({...profile});const[saved,setSaved]=useState(false);
  const propertyTotal=(properties||[]).reduce((s,p)=>s+(parseFloat(p.currentValue)||0),0);
  const mortgageTotal=(properties||[]).reduce((s,p)=>s+(parseFloat(p.mortgageBalance)||0),0);
  const save=()=>{
    const tA=["shareValue","cashSavings","superBalance","cryptoValue"].reduce((s,k)=>s+(parseFloat(form[k])||0),0)+propertyTotal;
    const tD=["investLoanDebt","carDebt","creditCardDebt","personalDebt"].reduce((s,k)=>s+(parseFloat(form[k])||0),0)+mortgageTotal;
    setProfile(p=>({...p,...form,cashSavings:p.cashSavings,superBalance:p.superBalance,cashLog:p.cashLog}));setSaved(true);setTimeout(()=>setSaved(false),2000);
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
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:8}}>A complete profile gives the Executive AI better context and personalises your entire dashboard.</div>
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
        <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,minmax(0,1fr))":"repeat(3,minmax(0,1fr))",gap:8,marginBottom:8}}>
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
                {active&&<span style={{marginLeft:"auto",color:t.GOLD,fontSize:11}}><Tick/></span>}
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
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[["annualIncome","Annual Income","Gross, before tax"],["netWorthTarget","Net Worth Target","e.g. 3000000"]].map(([k,l,ph])=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",minWidth:110,flexShrink:0}}>{l}</div>
              <Inp type="number" value={form[k]||""} onChange={e=>setForm(x=>({...x,[k]:e.target.value}))} placeholder={ph} style={{flex:1,padding:"7px 10px",fontSize:12}}/>
            </div>
          ))}
          {(()=>{
            const cut=daysAgoStr(365);
            const rec=Math.round((transactions||[]).filter(x=>x.type==="income"&&x.date>=cut).reduce((s,x)=>s+Math.abs(parseFloat(x.amount)||0),0));
            return <div style={{fontSize:11,color:rec?t.TEXT:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>{rec?"Recorded in Cash Flow (last 12 months): "+fmt(rec):"Income you record in Cash Flow will show here for comparison"}</div>;
          })()}
          <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",lineHeight:1.6}}>Income is used for tax estimates, forecasts and AI advice. Your net worth is calculated automatically from your property, loans, investments, super and cash.</div>
        </div>
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
        <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",lineHeight:1.75}}>Your data is encrypted and stored securely in the cloud, synced across all your devices. Executive AI questions are sent to Anthropic's API only. We don't advertise, sell data, or use your information to train AI models.</div>
      </Card>
      <Card style={{marginBottom:12}}>
        <SectionLabel>Export Data</SectionLabel>
        {/* Full backup — most important */}
        <button onClick={()=>{
          // Everything the app saves (same data as the cloud sync), so nothing new is ever left out
          if(_isDemo)return alert("The demo isn't saved, so there's nothing to back up. Create your account to start your own.");
          const saved=loadData();
          if(!saved)return alert("Nothing saved yet.");
          const backup={app:"The Executive",exportedAt:new Date().toISOString(),version:"2.0",...saved};
          downloadFile(new Blob([JSON.stringify(backup,null,2)],{type:"application/json"}),"the-executive-backup-"+todayStr()+".json");
        }} style={{width:"100%",background:"linear-gradient(135deg,"+t.GOLD+"18,"+t.GOLD+"08)",border:"1px solid "+t.GOLD+"44",borderRadius:8,padding:"12px 14px",color:t.GOLD,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12,textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div>
            <div style={{fontWeight:600,marginBottom:2}}>Download Full Backup</div>
            <div style={{fontSize:10,color:t.MUTED}}>Everything in your account, as one JSON file</div>
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
            {l:"Body Metrics",fn:()=>{const b=(loadData()||{}).bodyLog||[];b.length?exportCSV(b.map(({id,...r})=>r),"body-metrics.csv"):alert("No body data.");}},
            {l:"Score History",fn:()=>{const h=Object.entries((loadData()||{}).history||{});if(!h.length)return alert("No history.");exportCSV(h.map(([d,v])=>({date:d,...v})),"score-history.csv");}},
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

// Which budget category a bill or loan repayment counts toward (user override first, then name, then its own category)
const BILL_BUDGET_CAT={Housing:"Rent & Mortgage",Insurance:"Insurance",Utilities:"Utilities",Subscriptions:"Subscriptions",Finance:"Other",Health:"Health & Medical",Transport:"Transport",Other:"Other"};
function billBudgetCat(b){
  if(b&&b.budgetCat)return b.budgetCat;
  const n=String((b&&b.name)||"").toLowerCase();
  if(/rent|mortgage|strata|body corp|council|rates/.test(n))return "Rent & Mortgage";
  if(/phone|mobile|internet|nbn|telstra|optus|vodafone/.test(n))return "Phone & Internet";
  if(/gym|fitness|pilates|yoga/.test(n))return "Gym & Fitness";
  if(/insurance/.test(n))return "Insurance";
  if(/electric|power|energy|gas|water/.test(n))return "Utilities";
  if(/netflix|spotify|stan|disney|icloud|apple|youtube|prime|claude|chatgpt|subscription/.test(n))return "Subscriptions";
  if(/rego|registration|toll|parking/.test(n))return "Transport";
  return BILL_BUDGET_CAT[b&&b.category]||"Other";
}
function debtBudgetCat(d){
  if(d&&d.budgetCat)return d.budgetCat;
  const tp=String((d&&d.type)||"");
  if(tp==="Mortgage"||tp==="Investment Loan")return "Rent & Mortgage";
  if(tp==="Car Finance")return "Car Repayment";
  return "Other";
}
// Compact category chip with the native picker laid invisibly over it
// (keeps the 16px select that stops iOS zooming, without a giant box on screen)
function CatPicker({value,options,onChange,label}){
  const t=T();
  return(
    <div onClick={e=>e.stopPropagation()} style={{position:"relative",flexShrink:1,minWidth:0,maxWidth:150}}>
      <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",border:"1px solid "+t.BORDER,borderRadius:5,padding:"3px 18px 3px 7px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",position:"relative"}}>
        {value}<span style={{position:"absolute",right:6,top:3,fontSize:8}}>{"\u25BE"}</span>
      </div>
      <select aria-label={label} value={value} onChange={e=>onChange(e.target.value)} style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0,cursor:"pointer"}}>
        {options.map(c=><option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}
function BudgetPage({transactions,setTransactions,budgets,setBudgets,bills,setBills,debts,setDebts}){
  const t=T();
  const isMobile=useIsMobile();
  const txs=transactions||[];
  const[showAdd,setShowAdd]=useState(false);
  const[newCat,setNewCat]=useState("");
  const[editingCat,setEditingCat]=useState(null);
  const[editVal,setEditVal]=useState("");
  const[openCat,setOpenCat]=useState(null);
  const[showAutoFill,setShowAutoFill]=useState(false);
  const curMk=monthStr();
  const[mk,setMk]=useState(curMk);
  const mkOf=(k,add)=>{const d=new Date(parseInt(k.slice(0,4),10),parseInt(k.slice(5,7),10)-1+add,1,12);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");};
  const prevMk=mkOf(mk,-1);
  const isCur=mk===curMk,isFuture=mk>curMk;
  const mkLabel=(()=>{const d=new Date(mk+"-01T12:00:00");return d.toLocaleString(_locale,{month:"long",year:"numeric"});})();
  // Last 3 full months (for Fill from Statements)
  const recentMonths=[1,2,3].map(i=>mkOf(curMk,-i));
  const hasRecentData=txs.some(tx=>recentMonths.some(m=>String(tx.date||"").startsWith(m)));
  const monthlyAvg=cat=>{const v=recentMonths.map(m=>txs.filter(tx=>String(tx.date||"").startsWith(m)&&tx.type==="expense"&&tx.category===cat).reduce((s,tx)=>s+(parseFloat(tx.amount)||0),0)).filter(x=>x>0);return v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length):0;};
  const autoFillFromHistory=()=>{
    const sug={};EXP_CATS.expense.forEach(c=>{const a=monthlyAvg(c);if(a>0)sug[c]=String(a);});
    setBudgets(b=>({...b,...sug}));setShowAutoFill(false);
  };
  const defaultCats=EXP_CATS.expense;
  const customCats=Object.keys(budgets||{}).filter(k=>!defaultCats.includes(k)&&k!=="__total");
  const allCats=[...defaultCats,...customCats];
  const budgetOf=c=>parseFloat((budgets||{})[c])||0;
  const budgetedCats=allCats.filter(c=>budgetOf(c)>0);
  const totalBudget=budgetedCats.reduce((s,c)=>s+budgetOf(c),0);
  const monthTx=(cat,m)=>txs.filter(tx=>String(tx.date||"").startsWith(m)&&tx.type==="expense"&&tx.category===cat);
  const getSpent=(cat,m)=>monthTx(cat,m).reduce((s,tx)=>s+(parseFloat(tx.amount)||0),0);
  // Committed: bills and loan repayments still to come this month (and unpaid overdue bills).
  // Anything already due is assumed paid and shows up through imported transactions instead.
  const today=todayStr();
  const mStart=mk+"-01",mEnd=localDateStr(new Date(parseInt(mk.slice(0,4),10),parseInt(mk.slice(5,7),10),0,12));
  const committedItems=(()=>{
    if(mk<curMk)return [];
    const from=isCur?(today<mStart?mStart:today):mStart;
    const keep=e=>!e.paid&&e.amount>0&&(e.date>=from||(e.type==="bill"&&e.overdue));
    const out=[];
    (bills||[]).forEach(b=>buildCalendarEvents({bills:[b],debts},mStart,mEnd).filter(e=>e.type==="bill"&&keep(e)).forEach(e=>out.push({...e,cat:billBudgetCat(b),src:b})));
    (debts||[]).forEach(d=>buildCalendarEvents({debts:[d]},mStart,mEnd).filter(e=>e.type==="repay"&&keep(e)).forEach(e=>out.push({...e,cat:debtBudgetCat(d),src:d})));
    return out.sort((x,y)=>x.date.localeCompare(y.date));
  })();
  const getCommitted=cat=>committedItems.filter(e=>e.cat===cat).reduce((s,e)=>s+e.amount,0);
  const totalSpent=budgetedCats.reduce((s,c)=>s+getSpent(c,mk),0);
  const totalCommitted=budgetedCats.reduce((s,c)=>s+getCommitted(c),0);
  const totalProjected=totalSpent+totalCommitted;
  const remaining=totalBudget-totalProjected;
  const usedPct=totalBudget>0?Math.round(totalSpent/totalBudget*100):0;
  const projPct=totalBudget>0?Math.round(totalProjected/totalBudget*100):0;
  // Pace (current month only)
  const dim=parseInt(mEnd.slice(8,10),10);
  const dayN=new Date().getDate();
  const monthPct=Math.round(dayN/dim*100);
  const paceDiff=usedPct-monthPct;
  const months6=Array.from({length:6}).map((_,i)=>{const k=mkOf(mk,i-5);return{key:k,label:new Date(k+"-01T12:00:00").toLocaleString(_locale,{month:"short"})};});
  const setCatBudget=(cat,val)=>setBudgets(b=>({...b,[cat]:val}));
  const startEdit=cat=>{setEditingCat(cat);setEditVal(budgetOf(cat)?String(budgetOf(cat)):"");};
  const saveEdit=()=>{if(editingCat==null)return;const v=parseFloat(editVal)||0;setCatBudget(editingCat,v?String(v):0);setEditingCat(null);};
  const recat=(tx,cat)=>setTransactions&&setTransactions(ts=>(ts||[]).map(x=>idEq(x.id,tx.id)?{...x,category:cat}:x));
  const moveItem=(e,cat)=>{
    if(!e.src)return;
    if(e.type==="bill"&&setBills)setBills(bs=>(bs||[]).map(b=>idEq(b.id,e.src.id)?{...b,budgetCat:cat}:b));
    if(e.type==="repay"&&setDebts)setDebts(ds=>(ds||[]).map(d=>idEq(d.id,e.src.id)?{...d,budgetCat:cat}:d));
  };
  const barCol=(p,over)=>over||p>100?t.RED:p>=80?t.GOLD:t.GREEN;
  const lbl={fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",letterSpacing:1,textTransform:"uppercase",marginBottom:4};
  const editBox=cat=>(
    <div onClick={e=>e.stopPropagation()} style={{display:"flex",alignItems:"center",gap:6}}>
      <input type="number" inputMode="decimal" value={editVal} autoFocus onChange={e=>setEditVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")saveEdit();if(e.key==="Escape")setEditingCat(null);}} placeholder={"Budget "+L().symbol} aria-label={"Monthly budget for "+cat}
        style={{width:100,background:t.CARD2,border:"1px solid "+t.GOLD,borderRadius:5,padding:"5px 8px",color:t.TEXT,fontSize:12,fontFamily:"'Montserrat',sans-serif",outline:"none",textAlign:"right"}}/>
      <Btn onClick={saveEdit} style={{fontSize:10,padding:"5px 10px"}}>Save</Btn>
      <Btn onClick={()=>setEditingCat(null)} variant="ghost" style={{fontSize:10,padding:"5px 8px"}}>Cancel</Btn>
    </div>
  );
  const noImport=isCur&&!txs.some(tx=>String(tx.date||"").startsWith(mk)&&tx.type==="expense");
  const pace=noImport&&totalBudget>0?{c:t.GOLD,txt:"No "+new Date(mk+"-01T12:00:00").toLocaleString(_locale,{month:"long"})+" transactions imported yet - import a statement on Cash Flow"}:isCur&&totalBudget>0?(paceDiff>5?{c:t.RED,txt:"Ahead of pace - spending faster than the month is passing"}:paceDiff<-5?{c:t.GREEN,txt:"Under pace - spending slower than the month is passing"}:{c:t.GOLD,txt:"On pace"}):null;

  return (
    <div data-page="true" style={{maxWidth:820,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:5}}>Financial Control</div>
          <div style={{fontSize:26,color:t.TEXT}}>Monthly Budget</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {hasRecentData&&<Btn variant="ghost" onClick={()=>setShowAutoFill(s=>!s)} style={{color:t.GOLD,fontSize:11}}>Fill from Statements</Btn>}
          <Btn onClick={()=>setShowAdd(s=>!s)} style={{fontSize:11}}>+ Add Category</Btn>
        </div>
      </div>

      {/* Month switcher */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <button aria-label="Previous month" onClick={()=>{setMk(m=>mkOf(m,-1));setOpenCat(null);}} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:6,color:t.TEXT,width:30,height:28,cursor:"pointer",fontSize:14,...(hasPhoto()?surfaceBg():{})}}>{"‹"}</button>
        <div style={{fontSize:16,color:t.TEXT,minWidth:150,textAlign:"center"}}>{mkLabel}</div>
        <button aria-label="Next month" onClick={()=>{setMk(m=>mkOf(m,1));setOpenCat(null);}} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:6,color:t.TEXT,width:30,height:28,cursor:"pointer",fontSize:14,...(hasPhoto()?surfaceBg():{})}}>{"›"}</button>
        {!isCur&&<button onClick={()=>{setMk(curMk);setOpenCat(null);}} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:6,color:t.MUTED,padding:"5px 9px",cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif",...(hasPhoto()?surfaceBg():{})}}>This month</button>}
        {isFuture&&<span style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>Future month - bills and repayments only</span>}
      </div>

      {showAutoFill&&(
        <Card style={{marginBottom:14,border:"1px solid "+t.GOLD+"44"}}>
          <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600,marginBottom:4}}>Fill from transaction history</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",lineHeight:1.7,marginBottom:10}}>Sets each category to your average monthly spend over the last 3 full months. Only categories with transactions are changed.</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:6,marginBottom:12}}>
            {EXP_CATS.expense.map(cat=>{const avg=monthlyAvg(cat);if(!avg)return null;const cur=budgetOf(cat);return(
              <div key={cat} style={{background:t.CARD2,borderRadius:7,padding:"8px 10px",border:"1px solid "+t.BORDER}}>
                <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:2}}>{cat}</div>
                <div style={{display:"flex",alignItems:"center",gap:6,fontFamily:"'Montserrat',sans-serif"}}>
                  {cur>0&&<span style={{fontSize:10,color:t.MUTED,textDecoration:"line-through"}}>{fmt(cur)}</span>}
                  <span style={{fontSize:13,color:t.GOLD,fontWeight:700}}>{fmt(avg)}</span>
                </div>
              </div>);}).filter(Boolean)}
          </div>
          <div style={{display:"flex",gap:8}}><Btn onClick={autoFillFromHistory}>Apply Suggestions</Btn><Btn onClick={()=>setShowAutoFill(false)} variant="ghost">Cancel</Btn></div>
        </Card>
      )}

      {showAdd&&(
        <Card style={{marginBottom:14,border:"1px solid "+t.GOLD+"44"}}>
          <SectionLabel>New Budget Category</SectionLabel>
          <div style={{display:"flex",gap:8}}>
            <Inp value={newCat} onChange={e=>setNewCat(e.target.value)} placeholder="Category name (e.g. Hobbies)"/>
            <Btn onClick={()=>{const n=newCat.trim();if(!n)return;setCatBudget(n,0);setNewCat("");setShowAdd(false);startEdit(n);}}>Add</Btn>
            <Btn onClick={()=>setShowAdd(false)} variant="ghost">Cancel</Btn>
          </div>
        </Card>
      )}

      {!txs.length&&(
        <Card style={{marginBottom:14,padding:"18px"}}>
          <div style={{fontSize:13,color:t.TEXT,marginBottom:4}}>Import bank statements to track spending</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",lineHeight:1.7}}>Go to Cash Flow and import a PDF statement. Bills and loan repayments already count toward your budgets as they come up.</div>
        </Card>
      )}

      {totalBudget>0&&(
        <Card style={{marginBottom:14,border:"1px solid "+(projPct>100?t.RED:t.GOLD)+"44"}}>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,minmax(0,1fr))":"repeat(4,minmax(0,1fr))",gap:10,marginBottom:12}}>
            {[
              ["Budget",fmt(totalBudget),t.GOLD,""],
              ["Spent",fmt(totalSpent),totalSpent>totalBudget?t.RED:t.TEXT,usedPct+"% used"],
              ["Still to come",fmt(totalCommitted),t.TEXT,"bills and repayments"],
              [remaining>=0?"Projected left":"Projected over",fmt(Math.abs(remaining)),remaining>=0?t.GREEN:t.RED,"after everything due"],
            ].map(([l,v,c,s])=>(
              <div key={l} style={{textAlign:"center"}}>
                <div style={lbl}>{l}</div>
                <div style={{fontSize:20,color:c,fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{v}</div>
                {s&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{s}</div>}
              </div>
            ))}
          </div>
          {/* Spent (solid) + committed (faded) against budget, with a today marker */}
          <div style={{position:"relative",height:8,background:t.BORDER,borderRadius:99,overflow:"hidden"}}>
            <div style={{position:"absolute",left:0,top:0,bottom:0,width:Math.min(usedPct,100)+"%",background:barCol(usedPct),borderRadius:99}}/>
            <div style={{position:"absolute",left:Math.min(usedPct,100)+"%",top:0,bottom:0,width:Math.max(Math.min(projPct,100)-Math.min(usedPct,100),0)+"%",background:barCol(projPct)+"55"}}/>
            {isCur&&<div title="Today" style={{position:"absolute",left:monthPct+"%",top:-2,bottom:-2,width:2,background:t.TEXT,opacity:.7}}/>}
          </div>
          {pace&&(
            <div style={{display:"flex",justifyContent:"space-between",gap:10,marginTop:8,flexWrap:"wrap",fontFamily:"'Montserrat',sans-serif",fontSize:10}}>
              {!noImport&&<span style={{color:t.MUTED}}>{"Day "+dayN+" of "+dim+": "+monthPct+"% of the month gone, "+usedPct+"% of budget spent"}</span>}
              <span style={{color:pace.c,fontWeight:600}}>{pace.txt}</span>
            </div>
          )}
        </Card>
      )}

      {budgetedCats.length>0&&(
        <Card style={{marginBottom:14}}>
          <SectionLabel>6-Month Spending Trend</SectionLabel>
          {(()=>{const vals=months6.map(m=>budgetedCats.reduce((s,c)=>s+getSpent(c,m.key),0));const mx=Math.max(...vals,totalBudget,1);const bH=totalBudget/mx*60;return(
            <div style={{display:"flex",gap:4,alignItems:"flex-end",height:80,marginBottom:6}}>
              {months6.map((m,i)=>{const sp=vals[i];return(
                <div key={m.key} onClick={()=>setMk(m.key)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer",minWidth:0}}>
                  <div style={{width:"100%",position:"relative",height:64,display:"flex",alignItems:"flex-end"}}>
                    <div style={{position:"absolute",bottom:bH+"px",left:0,right:0,borderTop:"1px dashed "+t.GOLD+"66"}}/>
                    <div style={{width:"100%",background:(sp>totalBudget?t.RED:t.BLUE)+(m.key===mk?"CC":"66"),borderRadius:"2px 2px 0 0",height:(sp/mx*60)+"px",minHeight:sp>0?2:0}}/>
                  </div>
                  <div style={{fontSize:8,color:m.key===mk?t.GOLD:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{m.label}</div>
                </div>);})}
            </div>);})()}
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textAlign:"right"}}>Tap a month to view it. Dashed line = total budget.</div>
        </Card>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {allCats.map(cat=>{
          const budget=budgetOf(cat);
          const isCustom=!defaultCats.includes(cat);
          const isEditing=editingCat===cat;
          if(budget<=0&&!isCustom)return null;
          const spent=getSpent(cat,mk);
          const comm=getCommitted(cat);
          const proj=spent+comm;
          const pct=budget>0?Math.round(spent/budget*100):0;
          const ppct=budget>0?Math.round(proj/budget*100):0;
          const over=budget>0&&proj>budget;
          const prevSpent=getSpent(cat,prevMk);
          const isOpen=openCat===cat;
          const catTx=isOpen?monthTx(cat,mk).sort((a,b)=>String(b.date).localeCompare(String(a.date))):[];
          const catComm=isOpen?committedItems.filter(e=>e.cat===cat):[];
          return (
            <Card key={cat} style={{borderLeft:"3px solid "+(over?t.RED:budget>0?t.GREEN:t.BORDER),padding:0}}>
              <div onClick={()=>!isEditing&&setOpenCat(isOpen?null:cat)} style={{padding:"12px 14px",cursor:isEditing?"default":"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:isEditing&&isMobile?"wrap":"nowrap"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontSize:13,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{cat}</span>
                      {prevSpent>0&&<span style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{"last month "+fmt(prevSpent)}</span>}
                    </div>
                    <div style={{fontSize:10,color:over?t.RED:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>
                      {budget>0?(fmt(spent)+" spent"+(comm>0?" + "+fmt(comm)+" to come":"")+" of "+fmt(budget)+(over?" - "+fmt(proj-budget)+" over":"")):"No budget set"}
                    </div>
                  </div>
                  {isEditing?editBox(cat):(
                    <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                      {budget>0&&<span title={comm>0?"Includes "+fmt(comm)+" still to come":"Spent so far"} style={{fontSize:14,color:barCol(ppct,over),fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{ppct+"%"}</span>}
                      <button onClick={e=>{e.stopPropagation();startEdit(cat);}} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"33",borderRadius:5,padding:"4px 9px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"'Montserrat',sans-serif"}}>{budget>0?"Edit":"Set"}</button>
                      {isCustom&&<button aria-label={"Delete "+cat} onClick={e=>{e.stopPropagation();const b={...budgets};delete b[cat];setBudgets(b);}} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.6}}>{"×"}</button>}
                    </div>
                  )}
                </div>
                {budget>0&&(
                  <div style={{position:"relative",height:5,background:t.BORDER,borderRadius:99,overflow:"hidden",marginTop:8}}>
                    <div style={{position:"absolute",left:0,top:0,bottom:0,width:Math.min(pct,100)+"%",background:barCol(pct),borderRadius:99}}/>
                    <div style={{position:"absolute",left:Math.min(pct,100)+"%",top:0,bottom:0,width:Math.max(Math.min(ppct,100)-Math.min(pct,100),0)+"%",background:barCol(ppct,over)+"55"}}/>
                  </div>
                )}
              </div>
              {isOpen&&(
                <div style={{borderTop:"1px solid "+t.BORDER,padding:"8px 14px 12px"}}>
                  {catComm.length>0&&<div style={{...lbl,marginTop:4}}>Still to come</div>}
                  {catComm.map(e=>(
                    <div key={e.key} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid "+t.BORDER}}>
                      <div style={{width:3,alignSelf:"stretch",background:CAL_COLORS[e.type],borderRadius:2}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.title}</div>
                        <div style={{fontSize:9,color:e.overdue?t.RED:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{calDayLabel(e.date)+(e.overdue?" - overdue":"")+(e.type==="repay"?" - repayment":" - bill")}</div>
                      </div>
                      <CatPicker label="Counts toward" value={cat} options={allCats} onChange={v=>moveItem(e,v)}/>
                      <div style={{fontSize:12,color:t.RED,fontFamily:"'Montserrat',sans-serif",fontWeight:700,flexShrink:0}}>{fmt(e.amount)}</div>
                    </div>
                  ))}
                  <div style={{...lbl,marginTop:catComm.length?10:4}}>{"Transactions - "+mkLabel}</div>
                  {catTx.length===0?<div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",padding:"4px 0"}}>No transactions in this category for this month.</div>:catTx.map(tx=>(
                    <div key={tx.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid "+t.BORDER}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tx.note||tx.category}</div>
                        <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{calDayLabel(String(tx.date).slice(0,10))}</div>
                      </div>
                      {setTransactions&&<CatPicker label="Category" value={tx.category} options={allCats.includes(tx.category)?allCats:[tx.category,...allCats]} onChange={v=>recat(tx,v)}/>}
                      <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:700,flexShrink:0}}>{fmt(parseFloat(tx.amount)||0)}</div>
                    </div>
                  ))}
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:8}}>Change a category to move an item into another budget.</div>
                </div>
              )}
            </Card>
          );
        })}

        {budgetedCats.length===0&&!editingCat&&(
          <div style={{textAlign:"center",padding:30,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
            <div style={{marginBottom:6,color:t.TEXT}}>No budgets set yet</div>
            <div style={{fontSize:11}}>Tap a category below to set its monthly budget.</div>
          </div>
        )}

        {(()=>{const un=defaultCats.filter(c=>budgetOf(c)<=0&&editingCat!==c);const chipEdit=editingCat&&defaultCats.includes(editingCat)&&budgetOf(editingCat)<=0?editingCat:null;if(!un.length&&!chipEdit)return null;return(
          <Card style={{padding:"10px 14px",...(chipEdit?{border:"1px solid "+t.GOLD+"55"}:{})}}>
            {chipEdit&&(
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",padding:"4px 0 10px",marginBottom:8,borderBottom:"1px solid "+t.BORDER}}>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:13,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{chipEdit}</div>
                  <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{"Monthly budget"+(monthlyAvg(chipEdit)?" - you average "+fmt(monthlyAvg(chipEdit))+" a month":"")}</div>
                </div>
                {editBox(chipEdit)}
              </div>
            )}
            <div style={lbl}>Unbudgeted categories - tap to set</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
              {un.map(cat=>{const sp=getSpent(cat,mk)+getCommitted(cat);return(
                <button key={cat} onClick={()=>startEdit(cat)} style={{padding:"5px 11px",borderRadius:14,border:"1px solid "+t.BORDER,background:"transparent",color:sp>0?t.TEXT:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,display:"flex",alignItems:"center",gap:5}}>
                  {cat}{sp>0&&<span style={{fontSize:9,color:t.RED}}>{fmt(sp)}</span>}
                </button>);})}
            </div>
          </Card>);})()}
      </div>
    </div>
  );
}

// ── Onboarding ────────────────────────────────────────────────────────────────
// Onboarding only identifies what applies to the user. The details (balances,
// loans, holdings, habits...) are filled in afterwards from a personalised
// "Finish setting up" checklist on the Dashboard, which ticks itself off as the
// real data appears.
const SETUP_MONEY=[
  {k:"cash",label:"Cash & savings",sub:"Bank and savings accounts"},
  {k:"super",label:"__SUPER__",sub:"Retirement savings"},
  {k:"home",label:"Home I own",sub:"With or without a home loan"},
  {k:"invprop",label:"Investment property",sub:"And its loan"},
  {k:"car",label:"Car loan",sub:"Car finance or lease"},
  {k:"card",label:"Credit card",sub:"Balances you carry"},
  {k:"personal",label:"Personal or student loan",sub:"HECS/HELP, personal loans"},
  {k:"shares",label:"Shares & ETFs",sub:"Tracked at live prices"},
  {k:"crypto",label:"Crypto",sub:"Bitcoin, Ethereum and others"},
  {k:"commod",label:"Gold & commodities",sub:"Gold, silver and more"},
  {k:"other",label:"Other assets",sub:"Cars, watches, art, collectibles"},
  {k:"bills",label:"Regular bills",sub:"Rent, phone, subscriptions"},
];
const SETUP_LIFE=[
  {k:"supps",label:"Supplements",sub:"Your daily stack"},
  {k:"body",label:"Body metrics",sub:"Weight, body fat, sleep"},
  {k:"workout",label:"Workouts",sub:"Training log"},
  {k:"habits",label:"Daily habits",sub:"Streaks and consistency"},
  {k:"goals",label:"Goals",sub:"Weekly to yearly"},
  {k:"reading",label:"Reading",sub:"Books and notes"},
  {k:"journal",label:"Journal",sub:"Daily reflection"},
];
const SETUP_HEALTH_GOALS=["Build Muscle","Lose Fat","Improve Sleep","Increase Energy","Reduce Stress","Mental Clarity","Longevity","Athletic Performance"];
const SETUP_RISK=["Conservative - protect capital","Balanced - steady growth","Growth - accept volatility","Aggressive - maximise returns"];
// Checklist items: which page each goes to and how we know it's done
function setupItems(plan,data){
  const d=data||{};const pf=d.profile||{};const debts=d.debts||[];
  const hasDebt=types=>debts.some(x=>types.includes(x.type));
  const n=a=>(a||[]).length>0;
  const DEF={
    cash:{label:"Add your cash and savings balance",page:"wealth",done:()=>(parseFloat(pf.cashSavings)||0)>0||n(pf.cashLog)},
    super:{label:"Add your "+L().superLabel.toLowerCase()+" balance",page:"wealth",done:()=>(parseFloat(pf.superBalance)||0)>0||n(d.superLog)},
    home:{label:"Add your home (and its loan, if you have one)",page:"property",done:()=>(d.properties||[]).some(p=>p.type==="home")||hasDebt(["Mortgage"])},
    invprop:{label:"Add your investment property and its loan",page:"property",done:()=>(d.properties||[]).some(p=>p.type!=="home")||hasDebt(["Investment Loan"])},
    car:{label:"Add your car loan",page:"debt",done:()=>hasDebt(["Car Finance"])},
    card:{label:"Add your credit card",page:"debt",done:()=>hasDebt(["Credit Card"])},
    personal:{label:"Add your personal or student loans",page:"debt",done:()=>hasDebt(["Personal Loan","Student Loan"])},
    shares:{label:"Add your shares (or import a broker statement)",page:"wealth",done:()=>n(d.holdings)},
    crypto:{label:"Add your crypto",page:"wealth",done:()=>n(d.cryptoHoldings)},
    commod:{label:"Add your gold and commodities",page:"wealth",done:()=>n(d.commodityHoldings)},
    other:{label:"Add your other assets",page:"wealth",done:()=>n(d.altAssets)},
    bills:{label:"Add your regular bills",page:"bills",done:()=>n(d.bills)},
    statement:{label:"Import a bank statement",page:"cashflow",done:()=>n(d.transactions)},
    budget:{label:"Set your monthly budgets",page:"budget",done:()=>Object.values(d.budgets||{}).some(v=>(parseFloat(v)||0)>0)},
    supps:{label:"Add your supplements",page:"health",done:()=>n(d.supplements)},
    body:{label:"Log your body metrics",page:"body",done:()=>n(d.bodyLog)},
    workout:{label:"Log your first workout",page:"workout",done:()=>n(d.workouts)},
    habits:{label:"Choose your daily habits",page:"habits",done:()=>n(d.habits)},
    goals:{label:"Set your first goals",page:"goals",done:()=>n(d.goals)},
    reading:{label:"Add the book you're reading",page:"reading",done:()=>n(d.books)},
    journal:{label:"Write your first journal entry",page:"journal",done:()=>n(d.journal)},
  };
  return (plan||[]).filter(k=>DEF[k]).map(k=>({k,...DEF[k],isDone:!!DEF[k].done()}));
}
function SetupChecklist({data,setProfile,setPage}){
  const t=T();
  const pf=(data&&data.profile)||{};
  const[showAll,setShowAll]=useState(false);
  if(!pf.setupPlan||pf.setupDismissed)return null;
  const items=setupItems(pf.setupPlan,data);
  if(!items.length)return null;
  const done=items.filter(i=>i.isDone).length;
  const todo=items.filter(i=>!i.isDone);
  const dismiss=()=>setProfile&&setProfile(p=>({...p,setupDismissed:true}));
  if(!todo.length)return(
    <Card style={{border:"1px solid "+t.GREEN+"55"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <div><div style={{fontSize:13,color:t.TEXT}}>Setup complete</div><div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{"All "+items.length+" items are in. Your dashboard is running on real numbers."}</div></div>
        <Btn onClick={dismiss} style={{fontSize:11,padding:"7px 12px"}}>Done</Btn>
      </div>
    </Card>
  );
  const shown=showAll?todo:todo.slice(0,5);
  return(
    <Card style={{border:"1px solid "+t.GOLD+"44"}}>
      <SectionLabel action={<button onClick={dismiss} style={{background:"none",border:"none",color:t.MUTED,fontSize:9,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",letterSpacing:1,padding:0}}>HIDE</button>}>Finish setting up</SectionLabel>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
        <div style={{flex:1}}><PB value={Math.round(done/items.length*100)} height={5}/></div>
        <div style={{fontSize:10,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:600,flexShrink:0}}>{done+" of "+items.length+" done"}</div>
      </div>
      {shown.map(i=>(
        <div key={i.k} onClick={()=>setPage&&setPage(i.page)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderTop:"1px solid "+t.BORDER,cursor:"pointer"}}>
          <div style={{width:16,height:16,borderRadius:"50%",border:"1.5px solid "+t.MUTED,flexShrink:0}}/>
          <div style={{flex:1,minWidth:0,fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{i.label}</div>
          <div style={{fontSize:10,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",flexShrink:0}}>{"Add ›"}</div>
        </div>
      ))}
      {todo.length>5&&<button onClick={()=>setShowAll(s=>!s)} style={{background:"none",border:"none",color:t.MUTED,fontSize:10,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",padding:"6px 0 0"}}>{showAll?"Show fewer":"Show all "+todo.length}</button>}
      <div style={{fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:6}}>Items tick off automatically as you add them.</div>
    </Card>
  );
}
function SetupPage({onComplete,allowDemo}){
  // Set the Obsidian look before the first paint (the welcome screen was showing grey on light-mode devices)
  useState(()=>{_themeKey="obsidian";return true;});
  const t=T();
  const isMobile=useIsMobile();
  const STEPS=["welcome","country","you","money","life","look","done"];
  const[step,setStep]=useState(0);
  // Onboarding always opens in the signature Obsidian look (black and gold); the user can switch on the last step
  useState(()=>{_themeKey="obsidian";return true;});
  const[p,setP]=useState({firstName:"",lastName:"",dob:"",location:"",occupation:"",annualIncome:"",netWorthTarget:"",riskProfile:"",locale:_locale||"en-AU",theme:"obsidian",bgPhoto:"bg4",healthGoals:[]});
  const[money,setMoney]=useState([]);
  const[life,setLife]=useState([]);
  const cur=STEPS[step];
  const upd=(k,v)=>setP(x=>({...x,[k]:v}));
  const tog=(arr,set,k)=>set(arr.includes(k)?arr.filter(x=>x!==k):[...arr,k]);
  const next=()=>setStep(s=>Math.min(s+1,STEPS.length-1));
  const back=()=>setStep(s=>Math.max(s-1,0));
  const canNext=cur!=="you"||p.firstName.trim().length>0;
  const plan=[...SETUP_MONEY.map(x=>x.k).filter(k=>money.includes(k)),"statement","budget",...SETUP_LIFE.map(x=>x.k).filter(k=>life.includes(k))];
  const finish=()=>{
    const age=p.dob?calcAge(p.dob):"";
    onComplete({
      profile:{...p,firstName:p.firstName.trim(),lastName:p.lastName.trim(),age:age||"",riskProfile:p.riskProfile?[p.riskProfile]:[],
        cashSavings:"",superBalance:"",totalAssets:0,totalDebt:0,netWorth:0,
        setupPlan:plan,setupStarted:todayStr(),setupDismissed:false,currentHabits:[]},
      goals:[],supplements:[]
    });
  };
  const lbl={fontSize:9,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4};
  const field=(k,label,ph,type)=>(<div key={k} style={{flex:1,minWidth:0}}><div style={lbl}>{label}</div><Inp type={type||"text"} value={p[k]} onChange={e=>upd(k,e.target.value)} placeholder={ph}/></div>);
  const head=(kicker,title,sub)=>(<div style={{marginBottom:18}}>
    <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:6}}>{kicker}</div>
    <div style={{fontSize:24,color:t.TEXT,marginBottom:6,fontFamily:"'Cormorant Garamond',Georgia,serif"}}>{title}</div>
    {sub&&<div style={{fontSize:12,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",lineHeight:1.7}}>{sub}</div>}
  </div>);
  const tile=(on,onClick,label,sub,key)=>(
    <div key={key} onClick={onClick} role="button" aria-pressed={on} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 12px",background:on?t.GOLD+"18":GLASS_BG,border:"1px solid "+(on?t.GOLD:"rgba(255,255,255,0.1)"),borderRadius:9,cursor:"pointer",minWidth:0,backdropFilter:GLASS_BLUR,WebkitBackdropFilter:GLASS_BLUR}}>
      <div style={{width:18,height:18,borderRadius:5,border:"1.5px solid "+(on?t.GOLD:t.MUTED),background:on?t.GOLD:"transparent",color:"#080808",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{on?"✓":""}</div>
      <div style={{minWidth:0}}>
        <div style={{fontSize:13,color:on?t.GOLD:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{label}</div>
        {sub&&<div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:1}}>{sub}</div>}
      </div>
    </div>
  );
  const grid={display:"grid",gridTemplateColumns:isMobile?"minmax(0,1fr)":"repeat(2,minmax(0,1fr))",gap:8};
  const chip=(on,onClick,label,key)=>(<button key={key} onClick={onClick} style={{padding:"7px 12px",borderRadius:99,border:"1px solid "+(on?t.GOLD:"rgba(255,255,255,0.14)"),background:on?t.GOLD+"22":GLASS_BG,color:on?t.GOLD:t.TEXT,fontSize:11,fontFamily:"'Montserrat',sans-serif",cursor:"pointer"}}>{label}</button>);
  const bgFor=p.bgPhoto&&p.bgPhoto!=="none"?p.bgPhoto:"bg4";

  if(cur==="welcome")return(
    <div style={{minHeight:"100vh",background:t.BG,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,textAlign:"center",position:"relative",overflow:"hidden"}}>
      <BgPhotoLayer photoId="bg4"/>
      <div style={{position:"relative",zIndex:1,maxWidth:360}}>
        <div style={{fontSize:9,letterSpacing:5,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:16}}>The Executive</div>
        <div style={{width:40,height:1,background:"linear-gradient(90deg,transparent,"+t.GOLD+",transparent)",margin:"0 auto 28px",opacity:.6}}/>
        <div style={{fontSize:34,color:"#fff",lineHeight:1.2,marginBottom:14,fontFamily:"'Cormorant Garamond',Georgia,serif",fontWeight:300}}>Your private<br/>command centre.</div>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.6)",fontFamily:"'Montserrat',sans-serif",lineHeight:1.8,marginBottom:10}}>Five quick questions, about a minute. Tell us what's in your world and we'll build your setup list. No numbers needed yet.</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",fontFamily:"'Montserrat',sans-serif",marginBottom:36}}>Everything stays private to your account.</div>
        <button onClick={next} style={{background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:12,padding:"15px 44px",color:"#080808",cursor:"pointer",fontSize:13,fontFamily:"'Montserrat',sans-serif",fontWeight:700,letterSpacing:2,textTransform:"uppercase",marginBottom:14}}>Begin</button>
        <br/>
        {allowDemo&&<button onClick={()=>onComplete(null)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.35)",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12,textDecoration:"underline"}}>Explore the demo first</button>}
      </div>
    </div>
  );

  if(cur==="done"){
    const items=setupItems(plan,{profile:{}});
    return(
      <div style={{minHeight:"100vh",background:t.BG,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,position:"relative",overflow:"hidden"}}>
        <BgPhotoLayer photoId={bgFor}/>
        <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:440}}>
          <div style={{textAlign:"center",marginBottom:18}}>
            <div style={{fontSize:9,letterSpacing:4,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:10}}>You're in</div>
            <div style={{fontSize:30,color:"#fff",fontFamily:"'Cormorant Garamond',Georgia,serif",fontWeight:300}}>{"Welcome, "+(p.firstName.trim()||"Executive")+"."}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.55)",fontFamily:"'Montserrat',sans-serif",lineHeight:1.7,marginTop:8}}>Here's your setup list. It lives on your Dashboard and ticks itself off as you add each one, in any order, whenever suits you.</div>
          </div>
          <div style={{background:GLASS_BG,backdropFilter:GLASS_BLUR,WebkitBackdropFilter:GLASS_BLUR,border:"1px solid "+t.GOLD+"44",borderRadius:12,padding:"8px 16px",marginBottom:18,maxHeight:"42vh",overflowY:"auto"}}>
            {items.map((i,n)=>(
              <div key={i.k} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderTop:n?"1px solid "+t.BORDER:"none"}}>
                <div style={{width:14,height:14,borderRadius:"50%",border:"1.5px solid "+t.GOLD,flexShrink:0}}/>
                <div style={{fontSize:12,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",minWidth:0}}>{i.label}</div>
              </div>
            ))}
          </div>
          <button onClick={finish} style={{width:"100%",background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:12,padding:"15px",color:"#080808",cursor:"pointer",fontSize:13,fontFamily:"'Montserrat',sans-serif",fontWeight:700,letterSpacing:2,textTransform:"uppercase"}}>Open my dashboard</button>
          <button onClick={back} style={{display:"block",margin:"12px auto 0",background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11}}>Back</button>
        </div>
      </div>
    );
  }

  const stepNo=step;const total=STEPS.length-2;
  return(
    <div style={{minHeight:"100vh",background:t.BG,position:"relative"}}>
      <BgPhotoLayer photoId={bgFor}/>
      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",maxWidth:560,margin:"0 auto",minHeight:"100vh"}}>
        <div style={{padding:"calc(16px + env(safe-area-inset-top)) 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:9,letterSpacing:4,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif"}}>Setup</div>
          <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>{stepNo+" of "+total}</div>
        </div>
        <div style={{margin:"8px 20px 0",height:2,background:"rgba(255,255,255,0.1)",borderRadius:99,overflow:"hidden"}}>
          <div style={{width:(stepNo/total*100)+"%",height:"100%",background:"linear-gradient(90deg,"+t.GOLD+","+t.GL+")",transition:"width .4s"}}/>
        </div>
        <div style={{flex:1,padding:"22px 20px 130px"}}>

          {cur==="country"&&(<div>
            {head("Country","Where are you based?","Sets your currency and live conversions for overseas shares and crypto, what your retirement savings are called, and tax features.")}
            <div style={grid}>
              {Object.entries(LOCALES).map(([k,v])=>tile(p.locale===k,()=>{upd("locale",k);_locale=k;},v.label,v.currency+" - "+v.superLabel,k))}
            </div>
          </div>)}

          {cur==="you"&&(<div>
            {head("About you","Let's get acquainted","Used to personalise your dashboard and Executive AI.")}
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"flex",gap:10}}>{field("firstName","First name","William")}{field("lastName","Last name","Sterling")}</div>
              <div style={{display:"flex",gap:10}}>{field("dob","Date of birth","","date")}{field("location","City","Brisbane, QLD")}</div>
              {field("occupation","Occupation","Founder / Investor")}
              {field("annualIncome","Annual income before tax ("+(LOCALES[p.locale]||LOCALES["en-AU"]).currency+", optional)","150000","number")}
            </div>
          </div>)}

          {cur==="money"&&(<div>
            {head("Your finances","What's in your financial picture?","Tick everything that applies. You'll add the actual amounts afterwards from your setup list. Nothing is counted until you do.")}
            <div style={grid}>
              {SETUP_MONEY.map(m=>tile(money.includes(m.k),()=>tog(money,setMoney,m.k),m.label==="__SUPER__"?(LOCALES[p.locale]||LOCALES["en-AU"]).superLabel:m.label,m.sub,m.k))}
            </div>
            <div style={{marginTop:22}}>
              <div style={lbl}>How do you think about investment risk? (optional)</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
                {SETUP_RISK.map(r=>chip(p.riskProfile===r,()=>upd("riskProfile",p.riskProfile===r?"":r),r.split(" - ")[0],r))}
              </div>
            </div>
            <div style={{marginTop:16,maxWidth:280}}>{field("netWorthTarget","Net worth target (optional)","1000000","number")}</div>
          </div>)}

          {cur==="life"&&(<div>
            {head("Your life","What else do you want to track?","Your daily score is built from tasks, habits and supplements. Pick what you'd like set up.")}
            <div style={grid}>
              {SETUP_LIFE.map(m=>tile(life.includes(m.k),()=>tog(life,setLife,m.k),m.label,m.sub,m.k))}
            </div>
            <div style={{marginTop:22}}>
              <div style={lbl}>Health focus (optional)</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
                {SETUP_HEALTH_GOALS.map(g=>chip(p.healthGoals.includes(g),()=>upd("healthGoals",p.healthGoals.includes(g)?p.healthGoals.filter(x=>x!==g):[...p.healthGoals,g]),g,g))}
              </div>
            </div>
          </div>)}

          {cur==="look"&&(<div>
            {head("Appearance","Make it yours","Change this any time in Profile.")}
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginBottom:18}}>
              {[["obsidian","Obsidian","Black with gold"],["charcoal","Charcoal","Soft grey tones"]].map(([id,l,s])=>tile(p.theme===id,()=>{upd("theme",id);_themeKey=id;},l,s,id))}
            </div>
            <div style={lbl}>Background</div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,minmax(0,1fr))":"repeat(3,minmax(0,1fr))",gap:8,marginTop:4}}>
              {BG_PHOTOS.map(b=>{const on=(p.bgPhoto||"none")===b.id;return(
                <div key={b.id} onClick={()=>upd("bgPhoto",b.id)} style={{cursor:"pointer",borderRadius:8,border:"2px solid "+(on?t.GOLD:"rgba(255,255,255,0.12)"),overflow:"hidden",position:"relative",background:GLASS_BG}}>
                  <div style={{paddingBottom:"56%",position:"relative"}}>
                    {b.thumb?<img src={b.thumb} alt={b.label} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:on?1:0.65}}/>:<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>Plain</div>}
                    <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"4px 6px",background:"rgba(0,0,0,0.7)",fontSize:9,color:"#fff",fontFamily:"'Montserrat',sans-serif",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{b.label}</div>
                  </div>
                </div>);})}
            </div>
          </div>)}
        </div>
        <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:560,padding:"12px 20px",paddingBottom:"calc(14px + env(safe-area-inset-bottom))",background:"linear-gradient(transparent,rgba(8,7,6,0.92) 35%)",display:"flex",gap:10,zIndex:2,boxSizing:"border-box"}}>
          <button onClick={back} style={{flex:1,background:GLASS_BG,border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,padding:14,color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:13}}>Back</button>
          <button onClick={()=>canNext&&next()} disabled={!canNext} style={{flex:3,background:canNext?"linear-gradient(135deg,"+t.GOLD+","+t.GL+")":t.BORDER2,border:"none",borderRadius:10,padding:14,color:canNext?"#080808":t.MUTED,cursor:canNext?"pointer":"default",fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1}}>
            {cur==="look"?"See my setup list":cur==="you"&&!canNext?"Add your first name":"Continue"}
          </button>
        </div>
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
            <div style={{...surfaceBg(),border:"1px solid "+t.BORDER,borderRadius:12,padding:"14px 16px",marginBottom:16}}>
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
                  <div style={{...surfaceBg(),border:"1px solid "+t.BORDER,borderRadius:10,overflow:"hidden"}}>
                    {items.map((item,i)=>(
                      <div key={item.id} onClick={()=>setShoppingList(sl=>sl.map(x=>x.id===item.id?{...x,checked:!x.checked}:x))}
                        style={{display:"flex",alignItems:"center",gap:12,padding:"13px 14px",borderBottom:i<items.length-1?"1px solid "+t.BORDER:"none",cursor:"pointer",background:item.checked?t.CARD2:"transparent",transition:"background .15s"}}>
                        {/* Checkbox */}
                        <div style={{width:24,height:24,borderRadius:"50%",border:"2px solid "+(item.checked?t.GREEN:t.BORDER),background:item.checked?t.GREEN:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .2s"}}>
                          {item.checked&&<span style={{fontSize:11,color:t.BG,fontWeight:700}}><Tick/></span>}
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
          {query&&<button onClick={()=>setQuery("")} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:16}}><Icon name="x"/></button>}
        </div>
      </div>

      {q.length>0&&q.length<2&&(
        <div style={{textAlign:"center",padding:24,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",fontSize:12}}>Type at least 2 characters to search</div>
      )}

      {q.length>=2&&results.length===0&&(
        <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
          <div style={{fontSize:28,marginBottom:10,display:"flex",justifyContent:"center",color:t.GOLD}}><Icon name="search" stroke={1.2}/></div>
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
            {[{l:"Tasks",c:t.GREEN,pg:"tasks"},{l:"Goals",c:t.GOLD,pg:"goals"},{l:"Journal",c:t.PURPLE,pg:"journal"},{l:"Books",c:t.BLUE,pg:"reading"},{l:"Workouts",c:"#D4956A",pg:"workout"}].map(x=>(
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
function DividendPage({holdings,cryptoHoldings,portfolio,divs:divsProp,setDivs:setDivsProp}){
  const t=T();
  const isMobile=useIsMobile();
  const[divsLocal,setDivsLocal]=useState([]);
  const divs=divsProp||divsLocal;const setDivs=setDivsProp||setDivsLocal;
  const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({ticker:"",name:"",amountPerShare:"",frequency:"quarterly",nextPayDate:"",franking:"100"});

  const FREQS={weekly:52,fortnightly:26,monthly:12,quarterly:4,"semi-annual":2,annual:1};
  const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Merge holdings for autocomplete
  const allHoldings=[...(holdings||[]).map(h=>({ticker:h.ticker,name:h.name||h.ticker,shares:h.shares}))];
  // DIV_TICKER_V1: suggestion list for the ticker box - one row per holding, closes when a row is picked
  const[tickOpen,setTickOpen]=useState(false);
  const tickQ=(form.ticker||"").trim().toUpperCase();
  const tickMatches=tickQ?allHoldings.filter((h,i,a)=>h.ticker&&a.findIndex(x=>x.ticker===h.ticker)===i&&(String(h.ticker).toUpperCase().startsWith(tickQ)||String(h.name||"").toUpperCase().includes(tickQ))).slice(0,5):[];
  const tickHeld=tickQ?allHoldings.find(h=>String(h.ticker).toUpperCase()===tickQ):null;
  const pickTicker=h=>{setForm(f=>({...f,ticker:String(h.ticker).toUpperCase(),name:h.name||""}));setTickOpen(false);};

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
    const next=parseLocalDate(d.nextPayDate);
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
                  <input type="text" value={form.ticker} spellCheck={false} autoCapitalize="characters" autoCorrect="off" autoComplete="off"
                    onChange={e=>{const v=e.target.value.toUpperCase();setForm(f=>({...f,ticker:v,name:""}));setTickOpen(true);}}
                    onFocus={()=>setTickOpen(true)} onBlur={()=>setTimeout(()=>setTickOpen(false),180)}
                    onKeyDown={e=>{if(e.key==="Enter"&&tickOpen&&tickMatches.length){e.preventDefault();pickTicker(tickMatches[0]);}else if(e.key==="Escape")setTickOpen(false);}}
                    placeholder="e.g. CBA.AX"
                    style={{background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:7,padding:"9px 12px",color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"}}/>
                  {tickOpen&&tickMatches.length>0&&(
                    <div role="listbox" style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:isMobile?"calc(-100% - 8px)":0,background:t.BG,border:"1px solid "+t.GOLD+"55",borderRadius:8,zIndex:300,boxShadow:"0 8px 24px rgba(0,0,0,.6)",overflow:"hidden",maxHeight:230,overflowY:"auto"}}>
                      {tickMatches.map((h,hi)=>(
                        <button type="button" role="option" key={h.ticker} onPointerDown={e=>e.preventDefault()} onClick={()=>pickTicker(h)}
                          style={{display:"block",width:"100%",textAlign:"left",background:"transparent",border:"none",borderBottom:hi<tickMatches.length-1?"1px solid "+t.BORDER:"none",padding:"11px 12px",cursor:"pointer",color:t.TEXT,fontFamily:"'Montserrat',sans-serif",fontSize:12,lineHeight:1.35}}>
                          <span style={{color:t.GOLD,fontWeight:700}}>{h.ticker}</span>
                          <span style={{marginLeft:8}}>{h.name&&h.name!==h.ticker?h.name:""}</span>
                          <span style={{display:"block",fontSize:10,color:t.MUTED,marginTop:2}}>{(Number(h.shares)||0).toLocaleString()+" shares held - tap to select"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!tickOpen&&tickHeld&&<div style={{fontSize:10,color:t.GREEN,fontFamily:"'Montserrat',sans-serif",marginTop:4,lineHeight:1.4}}>{(tickHeld.name&&tickHeld.name!==tickHeld.ticker?tickHeld.name+" - ":"")+(Number(tickHeld.shares)||0).toLocaleString()+" shares held"}</div>}
                  {!tickOpen&&!tickHeld&&tickQ.length>=2&&<div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:4,lineHeight:1.4}}>Not in your shares yet. Add the holding on the Wealth page so the income can be worked out.</div>}
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
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <Sel value={logForm.type} onChange={e=>setLogForm(f=>({...f,type:e.target.value}))} style={{flex:"1 1 110px"}}>
                {["podcast","book","youtube","course","article"].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </Sel>
              <Inp type="number" value={logForm.minutes} onChange={e=>setLogForm(f=>({...f,minutes:e.target.value}))} placeholder="Minutes" style={{flex:"1 1 90px"}}/>
              <Inp type="date" value={logForm.date} onChange={e=>setLogForm(f=>({...f,date:e.target.value}))} style={{flex:"1 1 140px"}}/>
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
                      <div style={{fontSize:16,color:t.GREEN}}><Tick/></div>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {library.length===0&&(
            <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
              <div style={{fontSize:28,marginBottom:10,display:"flex",justifyContent:"center",color:t.GOLD}}><Icon name="graduation-cap" stroke={1.2}/></div>
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
                      <button onClick={()=>setLearnData(d=>({...d,sessions:(d.sessions||[]).filter(x=>x.id!==s.id)}))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.4}}><Icon name="x"/></button>
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {sessions.length===0&&(
            <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}>
              <div style={{fontSize:28,marginBottom:10,display:"flex",justifyContent:"center",color:t.GOLD}}><Icon name="graduation-cap" stroke={1.2}/></div>
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

      {shown.length===0&&<div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}><div style={{fontSize:32,marginBottom:10,display:"flex",justifyContent:"center",color:t.GOLD}}><Icon name="sticky-note" stroke={1.2}/></div><div style={{fontSize:14,marginBottom:8}}>No notes yet</div><div style={{fontSize:12}}>Tap + New Note to start capturing ideas</div></div>}

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
                        <button onClick={()=>setConfirmDel(s.id)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.5}}><Icon name="x"/></button>
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

      {!services.length&&<div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"'Montserrat',sans-serif"}}><div style={{fontSize:32,marginBottom:10,display:"flex",justifyContent:"center",color:t.GOLD}}><Icon name="briefcase" stroke={1.2}/></div><div style={{fontSize:14,marginBottom:8}}>No contacts yet</div><div style={{fontSize:12}}>Add your financial advisor, accountant, mortgage broker and other key contacts</div></div>}
    </div>
  );
}


function PaywallPage({onUpgrade,feature}){
  const t=T();
  const featureMap={
    advisor:{icon:"sparkles",title:"Executive AI",desc:"Your private AI with full visibility of your dashboard and history, web search, and honest assessments."},
    invest:{icon:"chart-candlestick",title:"Invest Intelligence",desc:"Live market prices, AI-powered opportunities, and a personalised watchlist."},
    tax:{icon:"calculator",title:"Tax Planner",desc:"Australian tax bracket estimator, deduction tracker and refund calculator."},
    learn:{icon:"graduation-cap",title:"Learn",desc:"AI-curated education and courses tailored to your goals and career."},
    services:{icon:"briefcase",title:"Services",desc:"Professional service recommendations based on your financial profile."},
  };
  const ctx=feature&&featureMap[feature]?featureMap[feature]:null;
  const proFeatures=[
    "Executive AI — full dashboard visibility + web search",
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
          <div style={{fontSize:40,marginBottom:12,display:"flex",justifyContent:"center",color:t.GOLD}}><Icon name={ctx.icon} stroke={1.1}/></div>
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
  const PRO_FEATURES=["Everything in Free","Executive AI — full dashboard access","Morning / Evening Briefing","Live stock, crypto & commodity prices","AI goal & supplement suggestions","AI workout & recipe generator","Weekly AI performance review","Bank statement PDF import","Invest intelligence & market insights","Tax planning (Australian brackets)"];
  return(
    <div className="exec-overlay" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.92)",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
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
  // Uses the shared module-level TICKER_DB (defined above WealthPage) so suggestions
  // stay consistent with the Wealth page's ticker autocomplete.
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

// ── Demo account data ─────────────────────────────────────────────────────────
// A full, realistic sample for William Sterling, built relative to today so the
// demo always looks current. Only used while nobody is signed in and there's no
// profile; it is never saved, and it's cleared before anyone signs in.
let _isDemo=false;
function buildDemoData(){
  let seed=20260929;
  const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
  const r2=(a,b)=>Math.round((a+rnd()*(b-a))*100)/100;
  const ds=n=>daysAgoStr(n);
  let id=9000;const nid=()=>++id;
  // Money in and out (last ~95 days)
  const tx=[];
  const add=(n,type,category,amount,note)=>tx.push({id:nid(),date:ds(n),type,category,amount:Math.round(amount*100)/100,note});
  for(let n=2;n<95;n+=14)add(n,"income","Salary",9230.77,"Sterling Capital - salary");
  for(let n=5;n<95;n+=7)add(n,"income","Rental Income",780,"Paddington rent");
  add(40,"income","Dividends",1272,"BHP dividend");add(12,"income","Investment Income",96.4,"Interest - savings");
  const shops=[["Groceries",["Woolworths","Coles","Harris Farm","Aldi"],60,210,3],["Dining Out & Takeaway",["Gerard's Bistro","Uber Eats","Sushi Train","Bacchus","Guzman y Gomez"],24,260,4],["Fuel",["Ampol","BP"],70,120,8],["Transport",["Linkt tolls","Uber","Secure Parking"],8,45,6],["Entertainment",["Event Cinemas","Ticketek","Brisbane Racing Club"],30,180,11],["Clothing & Personal Care",["R.M. Williams","Barber - Lord & Co","Myer"],45,420,16],["Health & Medical",["Chemist Warehouse","Physio - Active Rehab"],25,140,13],["Home & Garden",["Bunnings","Freedom"],35,320,21],["Gifts & Donations",["Red Cross","Myer gift"],50,200,30],["Travel & Holidays",["Qantas","Hayman Island Resort"],280,1900,45]];
  shops.forEach(([cat,names,lo,hi,every])=>{for(let n=1+Math.floor(rnd()*every);n<95;n+=every)add(n,"expense",cat,r2(lo,hi),names[Math.floor(rnd()*names.length)]);});
  const monthly=[["Utilities","AGL energy",160,240,33],["Phone & Internet","Aussie Broadband",99,99,30],["Phone & Internet","Telstra mobile",65,65,30],["Subscriptions","Netflix",25,25,30],["Subscriptions","Spotify",16,16,30],["Subscriptions","Claude Pro",34,34,30],["Insurance","Bupa health cover",310,310,30],["Insurance","Car insurance - NRMA",145,145,30],["Gym & Fitness","Fitstop membership",35,35,7],["Tax & Accounting","Xero",75,75,30]];
  monthly.forEach(([cat,note,lo,hi,every])=>{for(let n=3+Math.floor(rnd()*6);n<95;n+=every)add(n,"expense",cat,r2(lo,hi),note);});
  tx.sort((a,b)=>b.date.localeCompare(a.date));
  // Loans (repayments before today are recorded automatically on load, with the interest/principal split)
  const homeLoan={id:"demo_home",name:"Home Loan - Westpac",type:"Mortgage",lender:"Westpac",balance:692400,originalBalance:760000,rate:6.09,minPayment:1150,frequency:"weekly",nextPaymentDate:ds(56),offsetBalance:45000,startDate:"2022-03-01",endDate:"2052-03-01",notes:"",payments:[]};
  const invLoan={id:"demo_inv",name:"Investment Loan - CBA",type:"Investment Loan",lender:"Commonwealth Bank",balance:546800,originalBalance:560000,rate:6.39,minPayment:3380,frequency:"monthly",nextPaymentDate:ds(75),offsetBalance:0,startDate:"2024-06-15",endDate:"2054-06-15",notes:"Interest and principal",payments:[]};
  const card={id:"demo_card",name:"Amex Platinum",type:"Credit Card",lender:"American Express",balance:4200,originalBalance:4200,rate:20.74,minPayment:0,frequency:"monthly",nextPaymentDate:"",offsetBalance:0,notes:"Paid in full monthly",payments:[]};
  const vh=(v,step)=>Array.from({length:6}).map((_,i)=>({date:ds((6-i)*60),value:Math.round(v-(6-i)*step)}));
  const properties=[
    {id:"demo_p1",nickname:"Home - New Farm",type:"home",category:"residential",currentValue:1250000,purchasePrice:1080000,purchaseDate:"2022-03-01",mortgageBalance:0,linkedDebtIds:["demo_home"],ratesAnnual:2600,insuranceAnnual:2100,maintenanceAnnual:3000,valueHistory:vh(1250000,9000)},
    {id:"demo_p2",nickname:"Investment - Paddington",type:"investment",category:"residential",currentValue:820000,purchasePrice:700000,purchaseDate:"2024-06-15",mortgageBalance:0,linkedDebtIds:["demo_inv"],rentalIncome:780,rentalFrequency:"weekly",managementFeePct:7,ratesAnnual:2200,waterAnnual:1100,insuranceAnnual:1600,maintenanceAnnual:2500,valueHistory:vh(820000,7000)},
  ];
  const bills=[
    ["AGL Energy",480,"quarterly","Utilities",38,false],["Aussie Broadband",99,"monthly","Utilities",4,true],["Telstra Mobile",65,"monthly","Subscriptions",9,true],
    ["Bupa Health Cover",310,"monthly","Health",12,true],["Car Insurance - NRMA",145,"monthly","Insurance",17,true],["Home & Contents Insurance",2100,"annually","Insurance",140,false],
    ["Council Rates - New Farm",650,"quarterly","Housing",22,false],["Fitstop",35,"weekly","Health",3,true],["Netflix",25,"monthly","Subscriptions",6,true],["Spotify",16,"monthly","Subscriptions",19,true],["Claude Pro",34,"monthly","Subscriptions",25,true],["Car Registration",880,"annually","Transport",75,false],
  ].map(([name,amount,frequency,category,dueIn,autopay],i)=>({id:"demo_b"+i,name,amount,frequency,category,autopay,nextDue:daysAgoStr(-dueIn),lastPaid:"",paymentHistory:[]}));
  // Investments (live prices)
  const holdings=[
    {id:"demo_h1",ticker:"VAS.AX",name:"Vanguard Australian Shares ETF",shares:820,avgCost:88.4},
    {id:"demo_h2",ticker:"CBA.AX",name:"Commonwealth Bank",shares:360,avgCost:112.5},
    {id:"demo_h3",ticker:"BHP.AX",name:"BHP Group",shares:1150,avgCost:41.2},
    {id:"demo_h4",ticker:"NDQ.AX",name:"Betashares Nasdaq 100 ETF",shares:640,avgCost:37.8},
    {id:"demo_h5",ticker:"AAPL",name:"Apple",shares:85,avgCost:255},
    {id:"demo_h6",ticker:"NVDA",name:"Nvidia",shares:140,avgCost:118},
  ];
  const cryptoHoldings=[{id:"demo_c1",ticker:"BTC",symbol:"BTC",name:"Bitcoin",amount:0.32,avgCost:62000},{id:"demo_c2",ticker:"ETH",symbol:"ETH",name:"Ethereum",amount:3.5,avgCost:3400}];
  const commodityHoldings=[{id:"demo_g1",ticker:"GC=F",name:"Gold",symbol:"Au",unit:"oz",qty:4,avgCost:3150}];
  const altAssets=[
    {id:"demo_a1",name:"Rolex Submariner Date",category:"watch",currentValue:19500,costBasis:15800,description:"2021, box and papers",updatedAt:ds(20)},
    {id:"demo_a2",name:"Porsche 911 Carrera (2019)",category:"car",currentValue:168000,costBasis:189000,description:"Paid off",updatedAt:ds(35)},
    {id:"demo_a3",name:"Penfolds Grange collection",category:"wine",currentValue:14200,costBasis:9800,description:"6 vintages",updatedAt:ds(60)},
  ];
  const superLog=[0,1,2,3,4,5].map(i=>({id:nid(),date:ds((5-i)*30+3),balance:188000+i*2000,change:2000,type:"balance",note:i===5?"Quarterly statement":""})).reverse();
  const dividends=[
    {id:"demo_d1",ticker:"VAS.AX",name:"Vanguard Australian Shares",amountPerShare:"1.05",frequency:"quarterly",nextPayDate:daysAgoStr(-17),franking:"80",shares:820},
    {id:"demo_d2",ticker:"CBA.AX",name:"Commonwealth Bank",amountPerShare:"2.50",frequency:"semi-annual",nextPayDate:daysAgoStr(-170),franking:"100",shares:360},
    {id:"demo_d3",ticker:"BHP.AX",name:"BHP Group",amountPerShare:"0.95",frequency:"semi-annual",nextPayDate:daysAgoStr(-175),franking:"100",shares:1150},
  ];
  const watchlist=[
    {id:"demo_w1",ticker:"CSL.AX",name:"CSL",notes:"Quality healthcare - waiting for a better entry",alertBelow:"230",alertAbove:"",addedDate:ds(45),addedPrice:null,addedCurrency:null},
    {id:"demo_w2",ticker:"WES.AX",name:"Wesfarmers",notes:"Bunnings + Kmart compounding",alertBelow:"",alertAbove:"",addedDate:ds(30),addedPrice:null,addedCurrency:null},
    {id:"demo_w3",ticker:"MSFT",name:"Microsoft",notes:"AI infrastructure exposure",alertBelow:"",alertAbove:"",addedDate:ds(12),addedPrice:null,addedCurrency:null},
  ];
  const calendarItems=[
    {id:"demo_ci1",type:"income",title:"Salary",date:ds(2),repeat:"fortnightly",amount:"9230.77",note:"",doneDates:[]},
    {id:"demo_ci2",type:"income",title:"Rent - Paddington",date:ds(5),repeat:"weekly",amount:"780",note:"",doneDates:[]},
    {id:"demo_ci3",type:"reminder",title:"Review super contributions",date:ds(80),repeat:"quarterly",amount:"",note:"Concessional cap check",doneDates:[ds(80)]},
    {id:"demo_ci4",type:"reminder",title:"Portfolio rebalance check",date:daysAgoStr(-6),repeat:"quarterly",amount:"",note:"",doneDates:[]},
    {id:"demo_ci5",type:"reminder",title:"Book annual health check",date:daysAgoStr(-11),repeat:"annually",amount:"",note:"",doneDates:[]},
  ];
  const workouts=[];
  const plans=[["Strength",[["Bench Press",4,6,100],["Incline DB Press",3,10,36],["Weighted Dips",3,8,20]]],["Strength",[["Back Squat",5,5,140],["Romanian Deadlift",3,8,110],["Walking Lunge",3,12,24]]],["Cardio",[]],["Strength",[["Deadlift",4,4,180],["Pull Ups",4,8,10],["Barbell Row",3,8,90]]]];
  for(let n=1,k=0;n<42;n+=2,k++){if(rnd()<0.2)continue;const [type,sets]=plans[k%plans.length];workouts.push({id:nid(),date:ds(n),type,duration:type==="Cardio"?40:65,notes:type==="Cardio"?"Zone 2 run, 7km":"",sets:sets.map(([exercise,s,reps,weight])=>({id:nid(),exercise,sets:s,reps,weight:String(weight+(k>12?0:(rnd()<0.5?2.5:0)))}))});}
  const bodyLog=Array.from({length:12}).map((_,i)=>({id:nid(),date:ds((11-i)*7+1),weight:String((90.6-i*0.22).toFixed(1)),bodyFat:String((20.4-i*0.2).toFixed(1)),sleep:String((6.8+rnd()*1).toFixed(1)),hrv:String(Math.round(52+i*1.2+rnd()*6))})).reverse();
  const journal=[
    [1,4,"Closed the Paddington lease renewal at $780/week. Portfolio steady. Need to protect mornings - too many meetings creeping in."],
    [3,5,"Best training session in weeks - squat 140 for 5 felt easy. Early night, 8 hours sleep."],
    [6,3,"Busy week. Skipped cold exposure twice. Reset tomorrow: phone out of the bedroom."],
    [9,4,"Strategy day with the team. Clear plan for Q4 and the new business unit."],
    [13,5,"Weekend away at Noosa with family. Recharged. Read 120 pages of Munger."],
    [18,4,"Met the mortgage broker - looking at refinancing the investment loan below 6.2%."],
  ].map(([n,mood,text])=>({id:nid(),date:ds(n),mood,text,updatedAt:ds(n)}));
  const notes=[
    {id:nid(),title:"Q4 priorities",content:"- Launch the advisory arm\n- Refinance investment loan\n- Max concessional super\n- 2 new mandates",category:"Goals",pinned:true,createdAt:ds(20),updatedAt:ds(3)},
    {id:nid(),title:"Gift ideas - Sophie",content:"Aesop set, weekend at Spicers Peak, Tiffany bracelet",category:"Gifts",pinned:false,createdAt:ds(40),updatedAt:ds(40)},
    {id:nid(),title:"Meeting - broker",content:"Current 6.39%. Target under 6.2%. Bring last 2 payslips and rental statements.",category:"Meeting Notes",pinned:false,createdAt:ds(18),updatedAt:ds(18)},
    {id:nid(),title:"Ideas",content:"Quarterly investor letter. Podcast on property + equities.",category:"Ideas",pinned:false,createdAt:ds(9),updatedAt:ds(9)},
  ];
  const services=[
    {id:nid(),name:"Sarah Chen",role:"Accountant",firm:"Chen & Partners",phone:"07 3000 1234",email:"sarah@example.com",lastContact:ds(24),nextFollow:daysAgoStr(-30),notes:"Tax return lodged via agent"},
    {id:nid(),name:"James Whitaker",role:"Mortgage Broker",firm:"Whitaker Finance",phone:"0400 000 111",email:"james@example.com",lastContact:ds(18),nextFollow:daysAgoStr(-5),notes:"Refinance quote pending"},
    {id:nid(),name:"Olivia Grant",role:"Financial Advisor",firm:"Grant Private Wealth",phone:"07 3000 5678",email:"olivia@example.com",lastContact:ds(60),nextFollow:daysAgoStr(-20),notes:"Annual review"},
  ];
  const taxDeductions=[
    ["Home office running costs","Work from Home",1260,40],["Mobile phone (work portion)","Phone & Internet",420,25],["Bloomberg subscription","Investment Expenses",880,60],["Red Cross donation","Donations",500,30],["Leadership course","Education & Training",1450,75],
  ].map(([description,category,amount,n])=>({id:nid(),description,category,amount,date:ds(n),receipt:true}));
  const books=[
    {id:1,title:"Poor Charlie's Almanack",author:"Charles Munger",status:"reading",cur:312,tot:432,readingNotes:[{id:nid(),date:ds(3),fromPage:280,toPage:312,text:"Invert, always invert. Avoid stupidity rather than seeking brilliance."}]},
    {id:2,title:"The 48 Laws of Power",author:"Robert Greene",status:"next",cur:0,tot:452,readingNotes:[]},
    {id:3,title:"The Psychology of Money",author:"Morgan Housel",status:"done",cur:256,tot:256,rating:5,review:"Wealth is what you don't see.",dateFinished:ds(40),readingNotes:[]},
    {id:4,title:"Principles",author:"Ray Dalio",status:"done",cur:592,tot:592,rating:4,review:"",dateFinished:ds(95),readingNotes:[]},
  ];
  const goals=[
    {id:1,title:"Reach $2M net worth",period:"year",progress:74,category:"financial",startDate:ds(270),endDate:daysAgoStr(-95),checkpoints:[{id:1,text:"Refinance investment loan",dueDate:daysAgoStr(-21),done:false,doneAt:""},{id:2,text:"Max concessional super",dueDate:daysAgoStr(-60),done:false,doneAt:""}]},
    {id:2,title:"Launch new business unit",period:"year",progress:35,category:"career",endDate:daysAgoStr(-95),checkpoints:[{id:3,text:"Sign first 2 clients",dueDate:daysAgoStr(-30),done:false,doneAt:""}]},
    {id:3,title:"Read 24 books",period:"year",progress:54,category:"education"},
    {id:4,title:"Drop to 16% body fat",period:"month",progress:60,category:"health"},
    {id:5,title:"Close $500k revenue",period:"month",progress:72,category:"financial"},
    {id:6,title:"Complete 4 workouts",period:"week",progress:50,category:"health"},
  ];
  const completed=[{id:91,title:"Pay off car loan",period:"year",progress:100,category:"financial",completedAt:ds(120)},{id:92,title:"Run a half marathon",period:"year",progress:100,category:"health",completedAt:ds(200)}];
  // Daily score history, habits and net worth snapshots
  const history={},habitLog={},dailySnaps={};
  for(let n=1;n<=120;n++){
    const d=ds(n);const good=rnd();
    [1,2,3,4,5].forEach(h=>{if(rnd()<(h===2?0.55:0.78))habitLog[h+"_"+d]=true;});
    history[d]={score:Math.round(48+good*48),tasks:4,supps:4,habits:3};
    const nw=1755000-n*1150+Math.round((rnd()-0.5)*9000);
    if(n<=90)dailySnaps[d]={nw,a:nw+1236000+n*110,d:1236000+n*110,td:["Review investment portfolio"],to:[],st:["Vitamin D3","Creatine"],sm:[],books:{}};
  }
  const nwHistory={};for(let i=11;i>=1;i--){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-i);nwHistory[d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")]=1420000+(11-i)*30000;}
  const budgets={"Groceries":"1300","Dining Out & Takeaway":"900","Fuel":"350","Transport":"200","Entertainment":"400","Clothing & Personal Care":"500","Health & Medical":"300","Gym & Fitness":"160","Subscriptions":"120","Utilities":"260","Phone & Internet":"170","Insurance":"650","Travel & Holidays":"1500","Home & Garden":"300","Rent & Mortgage":"8500"};
  return{transactions:tx,debts:[homeLoan,invLoan,card],properties,bills,holdings,cryptoHoldings,commodityHoldings,altAssets,superLog,dividends,watchlist,calendarItems,workouts,bodyLog,journal,notes,services,taxDeductions,books,goals,completed,history,habitLog,dailySnaps,nwHistory,budgets};
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
    const dataToSave={lastSavedDate:todayStr(),theme,bgPhoto,profile,tasks,goals,completed,supplements,workouts,transactions,journal,books,bills,debts,calendarItems,dividends,watchlist,taxDeductions,notes,services,learnData,commodityHoldings,altAssets,properties,readingGoal,dailySnaps,marketTickers,superLog,history,bodyLog,habits,habitLog,holdings,cryptoHoldings,nwHistory,seenMilestones,sidebarCollapsed,advisorMessages:advisorMessages.slice(-40),budgets,weeklyReflections};
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
      // If no saved token, prompt to sign in after splash - unless they came to see the demo (/app?demo=1)
      if(!localStorage.getItem("exec_token")){
        let wantsDemo=false;
        try{wantsDemo=new URLSearchParams(window.location.search).get("demo")==="1";if(wantsDemo)window.history.replaceState({},"","/app");}catch{}
        if(!wantsDemo)setShowAuth(true);
      }
    },2500);
    return()=>clearTimeout(tid);
  },[]);
  const[profile,setProfile]=useState(null);
  const[page,setPage]=useState("dashboard");
  // PAGE_TOP_V1: a newly opened page always starts at the top
  useEffect(()=>{
    const top=()=>{try{window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0;}catch{}};
    top();const raf=requestAnimationFrame(top);const t1=setTimeout(top,80);
    return()=>{cancelAnimationFrame(raf);clearTimeout(t1);};
  },[page]);
  const[theme,setThemeState]=useState(()=>{
    // Use saved theme if exists in localStorage
    try{
      const saved=localStorage.getItem(SK);
      if(saved){const d=JSON.parse(saved);if(d.theme)return d.theme;}
    }catch{}
    return "obsidian"; // default look for everyone
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
      /* KEYBOARD_V1: the iOS keyboard plugin resizes <body>; keep scrolling on the page itself and handle the keyboard here */
      body{height:auto !important}
      html.kb-open body{padding-bottom:var(--kb-pad,0px) !important}
      html.kb-open body:has([data-kb-own]){padding-bottom:0 !important}
      html.kb-open .exec-tabbar{display:none !important}
      html.kb-open .exec-main{padding-bottom:24px !important}
      html.kb-open .exec-main:has([data-kb-own]){padding-bottom:0 !important}
      html.kb-open .exec-overlay{bottom:var(--kb,0px) !important;align-items:flex-start !important;overflow-y:auto !important}
      html.kb-open .exec-overlay>*{margin:auto !important;max-height:calc(100vh - var(--kb,0px) - 24px) !important}
      html.kb-open .exec-kb-hide{display:none !important}
      /* DATE_ROWS_V1: iPhone date boxes ignore their width and spill over the next box unless told otherwise */
      input[type="date"],input[type="month"],input[type="time"]{-webkit-appearance:none;appearance:none;min-width:0;max-width:100%;display:block;min-height:39px;text-align:left}
      input[type="date"]::-webkit-date-and-time-value,input[type="month"]::-webkit-date-and-time-value,input[type="time"]::-webkit-date-and-time-value{text-align:left;margin:0}
    `;
    document.head.appendChild(s);
  }
  // KEYBOARD_V1: track the on-screen keyboard so nothing being typed into is hidden behind it.
  // Sources: the iOS app's keyboard events (Capacitor) and the browser's visual viewport (Safari / home-screen app).
  useEffect(()=>{
    if(typeof window==="undefined")return;
    const root=document.documentElement;let plug=0,last=-1,timer=null;
    const isField=el=>!!el&&/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)&&!/^(checkbox|radio|range|button|submit|file|color)$/.test(el.type||"");
    const scroller=el=>{let p=el.parentElement;while(p&&p!==document.documentElement){const cs=getComputedStyle(p);if(/(auto|scroll)/.test(cs.overflowY)&&p.scrollHeight>p.clientHeight+4)return p;p=p.parentElement;}return null;};
    const hidden=el=>{const kb=parseFloat(root.style.getPropertyValue("--kb"))||0;const r=el.getBoundingClientRect();const vis=window.innerHeight-kb;return {r,vis,out:r.bottom>vis-12||r.top<64};};
    const reveal=()=>{
      const el=document.activeElement;if(!isField(el)||el.closest("[data-kb-own]"))return;
      const h=hidden(el);if(!h.out)return;
      // put the field in the middle of the space above the keyboard (tall boxes: top of the box near the top)
      const want=Math.max(72,Math.round((h.vis-h.r.height)/2));const delta=h.r.top-want;const sc=scroller(el);
      try{(sc||window).scrollBy({top:delta,behavior:"smooth"});}catch{(sc||window).scrollBy(0,delta);}
      setTimeout(()=>{if(document.activeElement===el&&hidden(el).out){try{el.scrollIntoView({block:"center"});}catch{}}},500);
    };
    const apply=()=>{
      const vv=window.visualViewport;
      const web=vv?Math.max(0,Math.round(window.innerHeight-vv.height-vv.offsetTop)):0;
      const kb=Math.max(plug,web);const open=kb>100;const val=open?kb:0;
      root.style.setProperty("--kb",val+"px");
      root.style.setProperty("--kb-pad",val+"px");
      root.classList.toggle("kb-open",open);
      if(val!==last){last=val;window.dispatchEvent(new CustomEvent("exec-kb",{detail:{open,height:val}}));}
      if(open){clearTimeout(timer);timer=setTimeout(reveal,120);}
    };
    const show=e=>{plug=(e&&e.keyboardHeight)||plug||0;apply();setTimeout(apply,250);};
    const hide=()=>{plug=0;apply();setTimeout(apply,250);};
    const onFocus=e=>{if(isField(e.target)){clearTimeout(timer);timer=setTimeout(()=>{apply();reveal();},350);}};
    const onBlur=()=>setTimeout(apply,150);
    window.addEventListener("keyboardWillShow",show);window.addEventListener("keyboardDidShow",show);
    window.addEventListener("keyboardWillHide",hide);window.addEventListener("keyboardDidHide",hide);
    const vv=window.visualViewport;
    if(vv){vv.addEventListener("resize",apply);vv.addEventListener("scroll",apply);}
    document.addEventListener("focusin",onFocus);document.addEventListener("focusout",onBlur);
    apply();
    return()=>{
      clearTimeout(timer);
      window.removeEventListener("keyboardWillShow",show);window.removeEventListener("keyboardDidShow",show);
      window.removeEventListener("keyboardWillHide",hide);window.removeEventListener("keyboardDidHide",hide);
      if(vv){vv.removeEventListener("resize",apply);vv.removeEventListener("scroll",apply);}
      document.removeEventListener("focusin",onFocus);document.removeEventListener("focusout",onBlur);
    };
  },[]);
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
  const[calendarItems,setCalendarItems]=useState([]);
  const[dividends,setDividends]=useState([]);
  const[watchlist,setWatchlist]=useState([]);
  // Record scheduled debt repayments (interest + principal) once they fall due.
  // Runs on load, at the start of each day, and whenever a debt's schedule changes.
  const debtSchedKey=(debts||[]).map(d=>d.id+":"+(d.nextPaymentDate||"")+":"+(d.minPayment||"")+":"+(d.frequency||"")).join("|");
  useEffect(()=>{
    if(!readyToSave||!debts?.length)return;
    const today=todayStr();
    const due=debts.some(d=>d.nextPaymentDate&&d.nextPaymentDate<=today&&parseFloat(d.minPayment)>0&&parseFloat(d.balance)>0);
    if(!due)return;
    setDebts(ds=>ds.map(d=>applyScheduledRepayments(d,today)));
  },[readyToSave,lastResetDate,debtSchedKey]);
  const[taxDeductions,setTaxDeductions]=useState([]);
  const[history,setHistory]=useState({});
  const[dailySnaps,setDailySnaps]=useState({});
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
  const[properties,setProperties]=useState([]);
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
            if(d.bodyLog!==undefined)setBodyLog(d.bodyLog);if(d.calendarItems!==undefined)setCalendarItems(d.calendarItems||[]);if(d.dividends!==undefined)setDividends(d.dividends||[]);if(d.watchlist!==undefined)setWatchlist(d.watchlist||[]);if(d.dailySnaps)setDailySnaps(p=>({...(p||{}),...d.dailySnaps}));
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
              if(d.properties!==undefined)setProperties(d.properties);
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
        if(saved.bodyLog!==undefined)setBodyLog(saved.bodyLog);if(saved.calendarItems!==undefined)setCalendarItems(saved.calendarItems||[]);if(saved.dividends!==undefined)setDividends(saved.dividends||[]);if(saved.watchlist!==undefined)setWatchlist(saved.watchlist||[]);if(saved.dailySnaps)setDailySnaps(saved.dailySnaps);
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
      if(saved.properties!==undefined)setProperties(saved.properties);
        if(saved.advisorMessages!==undefined)setAdvisorMessages(saved.advisorMessages);
      }
      setHydrated(true);
      setTimeout(()=>setReadyToSave(true),500);
    })();
  },[]);

  // One-time migration: the app used to store a single flat property
  // value + mortgage figure directly on the profile. Now that Property
  // has its own dedicated tracking (supporting multiple properties with
  // full detail), migrate that old data into a single property entry
  // the first time this loads, then clear the old fields so it isn't
  // double-counted. Clearing propertyValue means this check naturally
  // won't fire again on subsequent loads.
  useEffect(()=>{
    if(!hydrated||!profile)return;
    if(properties.length===0&&parseFloat(profile.propertyValue)>0){
      const migrated={
        id:Date.now(),
        nickname:"My Property",
        type:"home",
        currentValue:parseFloat(profile.propertyValue)||0,
        mortgageBalance:parseFloat(profile.mortgageDebt)||0,
        purchasePrice:null,
        purchaseDate:null,
        interestRate:null,
        rentalIncome:0,
        rentalFrequency:"weekly",
        valueHistory:[]
      };
      setProperties([migrated]);
      setProfile(p=>({...p,propertyValue:"",mortgageDebt:""}));
    }
  },[hydrated]);

  useEffect(()=>{
    if(!readyToSave)return;
    const dataToSave = {lastSavedDate:todayStr(),theme,bgPhoto,profile,tasks,goals,completed,supplements,workouts,transactions,journal,books,bills,debts,calendarItems,dividends,watchlist,taxDeductions,notes,services,learnData,commodityHoldings,altAssets,properties,readingGoal,dailySnaps,marketTickers,superLog,history,bodyLog,habits,habitLog,holdings,cryptoHoldings,nwHistory,seenMilestones,sidebarCollapsed,advisorMessages:advisorMessages.slice(-40),budgets,weeklyReflections};
    const timer=setTimeout(()=>{
      (async()=>{
        // Always save to localStorage — works offline
        if(profile)saveData(dataToSave); // DEMO_NO_SAVE: the demo (no profile) is never saved
        if(authToken && authUser?.id && profile){
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
  },[readyToSave,theme,bgPhoto,profile,tasks,goals,completed,supplements,workouts,transactions,journal,books,bills,debts,calendarItems,dividends,watchlist,taxDeductions,notes,services,learnData,commodityHoldings,altAssets,properties,readingGoal,dailySnaps,history,bodyLog,habits,habitLog,holdings,cryptoHoldings,nwHistory,seenMilestones,sidebarCollapsed,budgets,weeklyReflections,advisorMessages,superLog,marketTickers]);

  // Flush save immediately if the user navigates away/closes the tab before the debounce timer fires
  useEffect(()=>{
    const flush=()=>{
      if(!readyToSave)return;
      const dataToSave = {lastSavedDate:todayStr(),theme,bgPhoto,profile,tasks,goals,completed,supplements,workouts,transactions,journal,books,bills,debts,calendarItems,dividends,watchlist,taxDeductions,notes,services,learnData,commodityHoldings,altAssets,properties,readingGoal,dailySnaps,marketTickers,superLog,history,bodyLog,habits,habitLog,holdings,cryptoHoldings,nwHistory,seenMilestones,sidebarCollapsed,advisorMessages:advisorMessages.slice(-40),budgets,weeklyReflections};
      if(profile)saveData(dataToSave); // DEMO_NO_SAVE: the demo (no profile) is never saved
      if(authToken && authUser?.id && profile){
        try{
          fetch(SUPABASE_URL+"/rest/v1/user_data",{method:"POST",headers:{...sbH(authToken),"Prefer":"resolution=merge-duplicates"},body:JSON.stringify({user_id:authUser.id,data:withCloudBase(authUser.id,dataToSave),updated_at:new Date().toISOString()}),keepalive:true}).catch(()=>{});
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
            rememberCloud(authUser.id,d);
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
            if(d.properties!==undefined)setProperties(d.properties);
            // Finance
            if(d.transactions!==undefined)setTransactions(d.transactions);
            if(d.bills!==undefined)setBills(d.bills);
            if(d.debts!==undefined)setDebts(d.debts);
            if(d.budgets)setBudgets(d.budgets);
            if(d.taxDeductions!==undefined)setTaxDeductions(d.taxDeductions);
            // Health & body
            if(d.bodyLog!==undefined)setBodyLog(d.bodyLog);if(d.calendarItems!==undefined)setCalendarItems(d.calendarItems||[]);if(d.dividends!==undefined)setDividends(d.dividends||[]);if(d.watchlist!==undefined)setWatchlist(d.watchlist||[]);if(d.dailySnaps)setDailySnaps(p=>({...(p||{}),...d.dailySnaps}));
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
  },[readyToSave,theme,bgPhoto,profile,tasks,goals,completed,supplements,workouts,transactions,journal,books,bills,debts,calendarItems,dividends,watchlist,taxDeductions,notes,services,learnData,commodityHoldings,altAssets,properties,readingGoal,dailySnaps,history,bodyLog,habits,habitLog,holdings,cryptoHoldings,nwHistory,seenMilestones,sidebarCollapsed,budgets,weeklyReflections,advisorMessages,superLog,marketTickers]);

  const setTheme=th=>{const k=THEME_ALIASES[th]||th;_themeKey=k;setThemeState(k);};

  // Listen for OS theme changes — only applies if user hasn't manually set a theme
  useEffect(()=>{
    const mq=window.matchMedia?.("(prefers-color-scheme: light)");
    if(!mq)return;
    const handler=e=>{
      // Only auto-switch if user hasn't saved a manual theme preference
      const saved=localStorage.getItem(SK);
      if(saved){try{const d=JSON.parse(saved);if(d.theme)return;}catch{}}
      const newTheme="obsidian";
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

  const streak=(()=>{let s=0,graced=false;for(let i=0;i<365;i++){const k=daysAgoStr(i);if(history[k]?.score>=50){s++;graced=false;}else if(i===0){}else if(!graced){graced=true;}else break;}return s;})();

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
    // Clear the demo's sample data first so none of it carries into a real account
    if(demoLoaded.current){
      demoLoaded.current=false;
      setTransactions([]);setDebts([]);setProperties([]);setBills([]);setHoldings([]);setCryptoHoldings([]);setCommodityHoldings([]);setAltAssets([]);
      setSuperLog([]);setDividends([]);setWatchlist([]);setCalendarItems([]);setWorkouts([]);setBodyLog([]);setJournal([]);setNotes([]);setServices([]);
      setTaxDeductions([]);setBooks([]);setGoals([]);setCompleted([]);setHistory({});setHabitLog({});setDailySnaps({});setNwHistory({});setBudgets({});
      setTasks([]);setSupplements([]);setHabits([]);
    }
    // Full reset of all data
    setProfile(data.profile);
    setTasks([]);
    setGoals(data.goals||[]);
    setCompleted([]);
    setSupplements(data.supplements||[]);
    setWorkouts([]);setTransactions([]);setJournal([]);
    setBooks([]);setBills([]);setHistory({});setCalendarItems([]);setDividends([]);setWatchlist([]);setDailySnaps({});setBodyLog([]);
    // Build habits from selected habit names
    const habitColors=["#C9A84C","#7A9E7E","#7EB8C9","#B07EC9","#C97E7E","#D4956A"];
    const habitEmojis={"Morning Routine":"A","Cold Exposure":"C","Meditation":"M","Journalling":"J","Strength Training":"W","Reading Daily":"B","Intermittent Fasting":"F","No Alcohol":"N","Evening Walk":"V","Gratitude Practice":"G"};
    setHabits((data.profile.currentHabits||[]).map((name,i)=>({id:Date.now()+i,name,icon:habitIcon({name,icon:""}),color:habitColors[i%habitColors.length],target:7,timeOfDay:"morning"})));
    setHabitLog({});setHoldings([]);setCryptoHoldings([]);
    setDebts([]);setProperties([]);setCommodityHoldings([]);setAltAssets([]);setSuperLog([]);
    setSeenMilestones([]);setNwHistory({});setBudgets({});
    setAdvisorMessages([]);
    if(data.profile.theme){_themeKey=data.profile.theme;setThemeState(data.profile.theme);}
    if(data.profile.bgPhoto){setBgPhotoId(data.profile.bgPhoto);}
    if(data.profile.locale)_locale=data.profile.locale;
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

  // Computed before the early returns below so the hook order never changes
  const activeProfile=profile||DEMO;
  if(activeProfile.locale)_locale=activeProfile.locale;
  // DEMO_BG: the demo (no profile yet) shows a background unless one has been picked
  const shownBg=!profile&&(!bgPhoto||bgPhoto==="none")?"bg2":bgPhoto;
  _bgPhotoId=shownBg||"none";
  _isDemo=!profile&&!authUser;
  const liveShareValue=holdings.length>0&&portfolio.totalValue>0?portfolio.totalValue:parseFloat(activeProfile.shareValue)||0;
  const liveCryptoValue=(cryptoHoldings||[]).length>0&&cryptoPortfolio.totalValue>0?cryptoPortfolio.totalValue:parseFloat(activeProfile.cryptoValue)||0;
  const liveCommodityValue=(commodityHoldings||[]).length>0&&commodityPortfolio.totalValue>0?commodityPortfolio.totalValue:0;
  const liveAltValue=(altAssets||[]).reduce((s,a)=>s+(parseFloat(a.currentValue)||0),0);
  const livePropertyValue=(properties||[]).reduce((s,p)=>s+(parseFloat(p.currentValue)||0),0);
  // Linked property loans are already in the Debt tab total - only add unlinked ones
  const livePropertyDebt=unlinkedPropertyDebt(properties,debts);
  // Offset account balances (Debt tab) are your cash too
  const liveOffsetCash=(debts||[]).reduce((s,d)=>s+Math.max(parseFloat(d.offsetBalance)||0,0),0);
  // Income actually recorded in Cash Flow over the last 12 months
  const recordedIncome12m=(()=>{const cut=daysAgoStr(365);return Math.round((transactions||[]).filter(x=>x.type==="income"&&x.date>=cut).reduce((s,x)=>s+Math.abs(parseFloat(x.amount)||0),0));})();
  const liveAssets=livePropertyValue+(parseFloat(activeProfile?.cashSavings)||0)+liveOffsetCash+(parseFloat(activeProfile?.superBalance)||0)+liveCryptoValue+liveShareValue+liveCommodityValue+liveAltValue;
  const hasLiveData=(holdings.length>0&&portfolio.totalValue>0)||(cryptoHoldings.length>0&&cryptoPortfolio.totalValue>0)||(commodityHoldings.length>0&&commodityPortfolio.totalValue>0)||((altAssets||[]).length>0)||((properties||[]).length>0);
  const liveDebtTotal=debts?.length?debts.reduce((s,d)=>s+Math.max(parseFloat(d.balance)||0,0),0):null;
  // Without a Debt tab yet, fall back to the original setup figures (never a stale stored total)
  const legacyDebtTotal=profile?legacyProfileDebts(activeProfile).filter(d=>d.id!=="mortgageDebt").reduce((s,d)=>s+d.balance,0):(parseFloat(activeProfile?.totalDebt)||0);
  const effectiveTotalDebt=(liveDebtTotal!==null?Math.round(liveDebtTotal):legacyDebtTotal)+livePropertyDebt;
  const liveProfile=activeProfile?((hasLiveData||!!profile)
    ?{...activeProfile,shareValue:liveShareValue,cryptoValue:liveCryptoValue,offsetCash:liveOffsetCash,recordedIncome12m,totalAssets:liveAssets,totalDebt:effectiveTotalDebt,netWorth:liveAssets-effectiveTotalDebt}
    :{...activeProfile,totalDebt:effectiveTotalDebt,netWorth:(parseFloat(activeProfile.totalAssets)||0)-effectiveTotalDebt}
  ):activeProfile;
  const nwHistoryFull={...nwHistory,[monthStr()]:liveProfile?.netWorth||0};

  // Daily snapshot recorder - keeps today's snapshot current as things change.
  // Previous days are never touched, so the midnight reset can't erase them.
  const snapNW=Math.round(liveProfile?.netWorth||0);
  const snapA=Math.round(liveProfile?.totalAssets||0);
  const snapD=Math.round(liveProfile?.totalDebt||0);
  useEffect(()=>{
    if(!hydrated||!profile)return;
    const today=todayStr();
    const tt=todayTasks(tasks);
    setDailySnaps(prev=>{
      const p=prev||{};
      const cur=p[today]||{};
      const prevKey=Object.keys(p).filter(k=>k<today).sort().pop();
      const prevBooks=(prevKey&&p[prevKey].books)||{};
      const bk={};
      (books||[]).forEach(b=>{
        const active=b.status==="reading"||(b.status==="done"&&b.dateFinished===today);
        if(!active)return;
        const c=Number(b.cur)||0;
        const start=cur.books&&cur.books[b.id]?cur.books[b.id].s:(prevBooks[b.id]?prevBooks[b.id].c:c);
        bk[b.id]={t:b.title,s:start,c,tot:Number(b.tot)||0};
      });
      const next={
        nw:snapNW,
        a:snapA,
        d:snapD,
        td:tt.filter(x=>x.done).map(x=>x.text),
        to:tt.filter(x=>!x.done).map(x=>x.text),
        st:(supplements||[]).filter(s=>s.taken).map(s=>s.name),
        sm:(supplements||[]).filter(s=>!s.taken).map(s=>s.name),
        books:bk
      };
      if(JSON.stringify(cur)===JSON.stringify(next))return prev;
      const out={...p,[today]:next};
      const keys=Object.keys(out).sort();
      if(keys.length>400)keys.slice(0,keys.length-400).forEach(k=>{delete out[k];});
      return out;
    });
  },[hydrated,profile,tasks,supplements,books,snapNW,snapA,snapD]);

  // Fill the demo with sample data (only when nobody is signed in and there's no profile)
  const demoLoaded=useRef(false);
  useEffect(()=>{
    if(!hydrated||profile||authUser||demoLoaded.current)return;
    try{if(localStorage.getItem("exec_token"))return;}catch{}
    const d=buildDemoData();demoLoaded.current=true;
    setTransactions(d.transactions);setDebts(d.debts);setProperties(d.properties);setBills(d.bills);
    setHoldings(d.holdings);setCryptoHoldings(d.cryptoHoldings);setCommodityHoldings(d.commodityHoldings);setAltAssets(d.altAssets);
    setSuperLog(d.superLog);setDividends(d.dividends);setWatchlist(d.watchlist);setCalendarItems(d.calendarItems);
    setWorkouts(d.workouts);setBodyLog(d.bodyLog);setJournal(d.journal);setNotes(d.notes);setServices(d.services);
    setTaxDeductions(d.taxDeductions);setBooks(d.books);setGoals(d.goals);setCompleted(d.completed);
    setHistory(d.history);setHabitLog(d.habitLog);setDailySnaps(d.dailySnaps);setNwHistory(d.nwHistory);setBudgets(d.budgets);
  },[hydrated,profile,authUser]);
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
    return <SetupPage onComplete={handleSetupComplete} allowDemo={!authUser}/>;
  }

  const handleSignIn=async()=>{
    // Clear the demo's sample data first so none of it carries into a real account
    if(demoLoaded.current){
      demoLoaded.current=false;
      setTransactions([]);setDebts([]);setProperties([]);setBills([]);setHoldings([]);setCryptoHoldings([]);setCommodityHoldings([]);setAltAssets([]);
      setSuperLog([]);setDividends([]);setWatchlist([]);setCalendarItems([]);setWorkouts([]);setBodyLog([]);setJournal([]);setNotes([]);setServices([]);
      setTaxDeductions([]);setBooks([]);setGoals([]);setCompleted([]);setHistory({});setHabitLog({});setDailySnaps({});setNwHistory({});setBudgets({});
      setTasks([]);setSupplements([]);setHabits([]);
    }
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
              if(d.properties!==undefined)setProperties(d.properties);
            if(d.bodyLog!==undefined)setBodyLog(d.bodyLog);if(d.calendarItems!==undefined)setCalendarItems(d.calendarItems||[]);if(d.dividends!==undefined)setDividends(d.dividends||[]);if(d.watchlist!==undefined)setWatchlist(d.watchlist||[]);if(d.dailySnaps)setDailySnaps(p=>({...(p||{}),...d.dailySnaps}));
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
              if(d.properties!==undefined)setProperties(d.properties);
              if(d.bodyLog!==undefined)setBodyLog(d.bodyLog);if(d.calendarItems!==undefined)setCalendarItems(d.calendarItems||[]);if(d.dividends!==undefined)setDividends(d.dividends||[]);if(d.watchlist!==undefined)setWatchlist(d.watchlist||[]);if(d.dailySnaps)setDailySnaps(p=>({...(p||{}),...d.dailySnaps}));
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
      if(res.access_token){
        // Account created and a session came back: sign straight in (new accounts go to onboarding)
        setAuthMode("signin");
        setAuthLoading(false);
        await handleSignIn();
        return;
      }else if(res.id||res.user?.id){
        setAuthMode("signin");
        setAuthError("Account created! Check your email to confirm it, then sign in here.");
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
    // Clear the cached local snapshot and all in-memory data - not just the auth
    // token - so the next person on this device (e.g. a family member sharing it)
    // never sees this account's profile, finances, health data, etc.
    localStorage.removeItem(SK);
    setProfile(null);
    setTasks(D_TASKS);setGoals(D_GOALS);setCompleted([]);
    setSupplements(D_SUPPS);setWorkouts([]);setTransactions([]);setJournal([]);
    setBooks(D_BOOKS);setReadingGoal(24);setBills([]);setDebts([]);setTaxDeductions([]);
    setHistory({});setCalendarItems([]);setDividends([]);setWatchlist([]);setDailySnaps({});setBodyLog([]);setHabits(D_HABITS);setHabitLog({});setHoldings([]);
    setBudgets({});setWeeklyReflections({});setNotes([]);setServices([]);
    setLearnData({library:[],sessions:[],weeklyGoal:5});
    setCryptoHoldings([]);setCommodityHoldings([]);setAltAssets([]);setProperties([]);
    setSuperLog([]);setAdvisorMessages([]);setLastSaved(null);setNwHistory({});
    setSeenMilestones([]);setMarketTickers(DEFAULT_TICKERS);
    setAuthToken(null);setAuthUser(null);setSessionExpired(false);
    setPage("dashboard");
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
    setBooks(D_BOOKS);setBills([]);setHistory({});setCalendarItems([]);setDividends([]);setWatchlist([]);setDailySnaps({});setBodyLog([]);
    setSeenMilestones([]);setHabits(D_HABITS);setHabitLog({});setHoldings([]);
    setCryptoHoldings([]);setCommodityHoldings([]);setAltAssets([]);setSuperLog([]);setBudgets({});setAdvisorMessages([]);
    setShowSetup(true);
    setPage("dashboard");
  };

  const t=T();
  const savedLabel=lastSaved&&Date.now()-lastSaved<4000?"Saved":"";
  const pg={profile:liveProfile,tasks,setTasks,goals,setGoals,completed,setCompleted,supplements,setSupplements,workouts,setWorkouts,transactions,setTransactions,journal,setJournal,books,setBooks,bills,setBills,history,bodyLog,setBodyLog,habits,setHabits,habitLog,setHabitLog,holdings,setHoldings,portfolio,cryptoHoldings,setCryptoHoldings,cryptoPortfolio,commodityHoldings,setCommodityHoldings,commodityPortfolio,altAssets,setAltAssets,properties,setProperties,budgets,setBudgets,setPage,streak,market,nwHistory:nwHistoryFull,setShowBriefing,setShowRecalibrate,syncing,isOnline,pendingSave,authUser,setShowAuth,marketTickers,setMarketTickers,subscription,setShowUpgrade};

  return (
    <div style={{display:"flex",minHeight:"100vh",background:shownBg&&shownBg!=="none"?"#080808":t.BG,color:t.TEXT,position:"relative",zIndex:1}}>
      <BgPhotoLayer photoId={shownBg}/>
      <style>{`@keyframes shimmer{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
      <style>{"*{box-sizing:border-box;margin:0;padding:0;} html,body,#root{width:100%;min-height:100vh;} ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-thumb{background:"+t.BORDER2+";border-radius:2px;} @keyframes sk{0%,100%{opacity:.4}50%{opacity:.8}} button:hover{opacity:.85;} input::placeholder,textarea::placeholder{color:"+t.MUTED2+";} @media(max-width:767px){[data-page]{max-width:100%!important;margin:0!important;}} /* exec-no-spill */ body,#root{overflow-x:hidden;} .exec-main{overflow-wrap:break-word;} .exec-main [data-page]{min-width:0;max-width:100%;} .exec-main [style*=\"display: grid\"]>*{min-width:0;} .exec-main input,.exec-main select,.exec-main textarea{min-width:0;max-width:100%;}"}</style>
      {showUpgrade&&<UpgradeModal onClose={()=>setShowUpgrade(false)} onCheckout={handleCheckout} onNativePurchase={handleNativePurchase} onRestorePurchases={handleRestorePurchases} loading={upgradeLoading}/>}
      {sessionExpired&&(
        <div style={{background:t.GOLD+"18",borderBottom:"1px solid "+t.GOLD+"44",padding:"7px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:11,color:t.GOLD,fontFamily:"'Montserrat',sans-serif"}}>Session expired - changes saved locally but not syncing</div>
          <button onClick={()=>{setSessionExpired(false);setShowAuth(true);}} style={{background:t.GOLD,border:"none",borderRadius:5,padding:"4px 10px",color:"#080808",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:700}}>Reconnect</button>
        </div>
      )}
      {celebration&&<MilestoneCelebration milestone={celebration} onClose={()=>setCelebration(null)}/>}
      {showBriefing&&<MorningBriefing profile={liveProfile} tasks={tasks} onClose={()=>setShowBriefing(false)}/>}
      
      {showAuth&&(
        <div className="exec-overlay" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:t.CARD,border:"1px solid "+t.GOLD+"44",borderRadius:14,maxWidth:380,width:"100%",padding:28}}>
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",marginBottom:4}}>The Executive</div>
            <div style={{fontSize:22,color:t.TEXT,marginBottom:6}}>{authMode==="signin"?"Sign In":"Create Account"}</div>
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginBottom:20}}>{authMode==="signin"?"Your data syncs across all devices":"Free to create. Your data stays private and syncs across your devices."}</div>
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
              <button onClick={()=>setShowAuth(false)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,opacity:.75}}>{profile?"Continue on this device only":"Explore the demo first"}</button>
            </div>
          </div>
        </div>
      )}
      <Sidebar page={page} setPage={setPage} profile={activeProfile} theme={theme} setTheme={setTheme} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} savedLabel={savedLabel} authUser={authUser} setShowAuth={setShowAuth}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,width:isMobile?"100%":"auto",marginLeft:isMobile?0:(sidebarCollapsed?54:200),transition:"margin-left .2s",position:"relative",zIndex:1}}>
        {profile&&!authUser&&!showAuth&&(
          <div style={{margin:isMobile?"calc(14px + env(safe-area-inset-top)) 14px 0":"0",background:t.RED+"14",border:"1px solid "+t.RED+"44",borderRadius:isMobile?10:0,padding:isMobile?"10px 14px":"7px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
            <div style={{fontSize:11,color:t.TEXT,fontFamily:"'Montserrat',sans-serif",minWidth:0}}>Your data is only saved on this device. Create a free account to back it up and sync it.</div>
            <button onClick={()=>{setAuthMode("signup");setAuthError("");setShowAuth(true);}} style={{background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:6,padding:"5px 12px",color:"#080808",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:700,flexShrink:0}}>Back it up</button>
          </div>
        )}
        {!profile&&(isMobile?(
          <div style={{margin:"0 14px",marginTop:"calc(14px + env(safe-area-inset-top))",background:t.GOLD+"14",border:"1px solid "+t.GOLD+"44",borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:11,color:t.GOLD,fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>Demo Mode</div>
              <div style={{fontSize:10,color:t.MUTED,fontFamily:"'Montserrat',sans-serif",marginTop:2}}>Sample dashboard - changes are not saved</div>
            </div>
            <button onClick={()=>{if(authUser){setShowSetup(true);}else{setAuthMode("signup");setAuthError("");setShowAuth(true);}}} style={{background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:8,padding:"8px 14px",color:"#080808",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,flexShrink:0}}>Start my own</button>
          </div>
        ):(
          <div style={{background:t.GOLD+"14",borderBottom:"1px solid "+t.GOLD+"33",padding:"7px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:11,color:t.GOLD,fontFamily:"'Montserrat',sans-serif"}}>Demo - a sample dashboard for William Sterling. Changes are not saved.</div>
            <button onClick={()=>{if(authUser){setShowSetup(true);}else{setAuthMode("signup");setAuthError("");setShowAuth(true);}}} style={{background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:6,padding:"4px 12px",color:"#080808",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:700}}>Start my own dashboard</button>
          </div>
        ))}
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",alignItems:isMobile?"stretch":"center",minHeight:"100vh",background:"transparent",position:"relative",zIndex:1,transform:"translateZ(0)"}}>
          <div className="exec-main" style={{width:"100%",minWidth:0,overflowX:"clip",maxWidth:isMobile?undefined:1100,padding:isMobile?"12px 12px":"28px 32px",flex:1,paddingTop:isMobile?"calc(16px + env(safe-area-inset-top))":"calc(28px + env(safe-area-inset-top))",paddingBottom:isMobile?"calc(16px + env(safe-area-inset-bottom) + 70px)":"28px",boxSizing:"border-box"}}>
          {page==="search"&&<SearchPage tasks={tasks} goals={goals} journal={journal} books={books} workouts={workouts} recipes={[]} setPage={setPage}/>}
          {page==="dashboard"&&<DashboardPage {...pg} setupCard={<SetupChecklist data={{profile,debts,properties,holdings,cryptoHoldings,commodityHoldings,altAssets,bills,transactions,budgets,supplements,bodyLog,workouts,habits,goals,books,journal,superLog}} setProfile={setProfile} setPage={setPage}/>} transactions={transactions} isMobile={isMobile} debts={debts} dividends={dividends} calendarItems={calendarItems} setCalendarItems={setCalendarItems}/>}
          {page==="tasks"&&<TasksPage tasks={tasks} setTasks={setTasks}/>}
          {page==="habits"&&<HabitsPage habits={habits} setHabits={setHabits} habitLog={habitLog} setHabitLog={setHabitLog}/>}
          {page==="goals"&&<GoalsPage goals={goals} setGoals={setGoals} completed={completed} setCompleted={setCompleted} profile={liveProfile} subscription={subscription} setShowUpgrade={setShowUpgrade} authToken={authToken}/>}
          {page==="journal"&&<JournalPage entries={journal} setEntries={setJournal}/>}
          {["habits","goals","journal"].includes(page)&&!isPro(subscription)&&<UpgradeHint onUpgrade={()=>setShowUpgrade(true)} hint={page==="goals"?"Unlock AI goal suggestions & checkpoint analysis →":page==="journal"?"Unlock AI weekly review of your journal entries →":"Unlock AI habit coaching & weekly performance review →"}/>}
          {page==="wealth"&&<WealthPage subscription={subscription} setShowUpgrade={setShowUpgrade} dailySnaps={dailySnaps} debtList={debts} profile={liveProfile} onUpdateProfile={setProfile} nwHistory={nwHistoryFull} setShowRecalibrate={()=>setShowRecalibrate(true)} holdings={holdings} setHoldings={setHoldings} portfolio={portfolio} cryptoHoldings={cryptoHoldings} setCryptoHoldings={setCryptoHoldings} cryptoPortfolio={cryptoPortfolio} commodityHoldings={commodityHoldings} setCommodityHoldings={setCommodityHoldings} commodityPortfolio={commodityPortfolio} altAssets={altAssets} setAltAssets={setAltAssets} properties={properties} setProperties={setProperties} superLog={superLog} setSuperLog={setSuperLog} setPage={setPage}/>}
          {page==="property"&&<PropertyPage properties={properties} setProperties={setProperties} debts={debts} addLoan={d=>setDebts(ds=>[...((ds&&ds.length)?ds:legacyProfileDebts(profile||{})),d])}/>}
          {page==="projector"&&<ProjectorPage profile={liveProfile}/>}
          {page==="cashflow"&&<CashFlowPage transactions={transactions} setTransactions={setTransactions} subscription={subscription} setShowUpgrade={setShowUpgrade} authToken={authToken}/>}
          {page==="cashflow"&&!isPro(subscription)&&<UpgradeHint onUpgrade={()=>setShowUpgrade(true)} hint="Unlock AI bank statement import — auto-categorise transactions from a PDF →"/>}
          {page==="bills"&&<BillsPage bills={bills} setBills={setBills} debts={debts} setPage={setPage}/>}
          {page==="budget"&&<BudgetPage transactions={transactions} setTransactions={setTransactions} budgets={budgets} setBudgets={setBudgets} bills={bills} setBills={setBills} debts={debts} setDebts={setDebts}/>}
          {page==="debt"&&<DebtPage profile={liveProfile} setProfile={setProfile} properties={properties} debts={debts} setDebts={setDebts} subscription={subscription} setShowUpgrade={setShowUpgrade}/>}
          {page==="invest"&&(isFeatureLocked("invest",subscription)?<PaywallPage onUpgrade={()=>setShowUpgrade(true)} feature="invest"/>:<InvestPage profile={liveProfile} properties={properties} subscription={subscription} setShowUpgrade={setShowUpgrade} watchlist={watchlist} setWatchlist={setWatchlist} holdings={holdings}/>)}
          {page==="dividends"&&<DividendPage holdings={holdings} cryptoHoldings={cryptoHoldings} portfolio={portfolio} divs={dividends} setDivs={setDividends}/>}
          {page==="tax"&&(isFeatureLocked("tax",subscription)?<PaywallPage onUpgrade={()=>setShowUpgrade(true)} feature="tax"/>:<TaxPage profile={liveProfile} transactions={transactions} deductions={taxDeductions} setDeductions={setTaxDeductions}/>)}
          {page==="news"&&<NewsPage/>}
          {/* RECIPES_HIDDEN: Recipes page switched off for now - add ["recipes",...] back to NAV and this line to restore */}
          {page==="health"&&<HealthPage profile={liveProfile} supplements={supplements} setSupplements={setSupplements} bodyLog={bodyLog} setPage={setPage} subscription={subscription} setShowUpgrade={setShowUpgrade} authToken={authToken}/>}
          {page==="body"&&<BodyPage bodyLog={bodyLog} setBodyLog={setBodyLog} profile={liveProfile}/>}
          {page==="workout"&&<WorkoutPage workouts={workouts} setWorkouts={setWorkouts} profile={liveProfile} subscription={subscription} setShowUpgrade={setShowUpgrade} authToken={authToken}/>}
          {page==="reading"&&<ReadingPage books={books} setBooks={setBooks} readingGoal={readingGoal} setReadingGoal={setReadingGoal}/>}
          {["body","workout","reading"].includes(page)&&!isPro(subscription)&&<UpgradeHint onUpgrade={()=>setShowUpgrade(true)} hint={page==="workout"?"Unlock AI workout plan generation & performance analysis →":page==="reading"?"Unlock AI book summaries & reading insights →":"Unlock AI body composition analysis & recommendations →"}/>}
          {page==="calendar"&&<CalendarPage bills={bills} debts={debts} dividends={dividends} holdings={holdings} goals={goals} calendarItems={calendarItems} setCalendarItems={setCalendarItems} history={history} dailySnaps={dailySnaps} setPage={setPage}/>}
          {page==="weekly"&&<WeeklyPage dailySnaps={dailySnaps} completed={completed} transactions={transactions} profile={liveProfile} tasks={tasks} goals={goals} habits={habits} habitLog={habitLog} history={history} journal={journal} workouts={workouts} supplements={supplements} bodyLog={bodyLog} weeklyReflections={weeklyReflections} setWeeklyReflections={setWeeklyReflections} subscription={subscription} setShowUpgrade={setShowUpgrade} authToken={authToken}/>}
          {page==="learn"&&(isFeatureLocked("learn",subscription)?<PaywallPage onUpgrade={()=>setShowUpgrade(true)} feature="learn"/>:<LearnPage profile={liveProfile} goals={goals} habits={habits} learnData={learnData} setLearnData={setLearnData}/>)}
          {page==="notes"&&<NotesPage notes={notes} setNotes={setNotes}/>}
          {page==="services"&&(isFeatureLocked("services",subscription)?<PaywallPage onUpgrade={()=>setShowUpgrade(true)} feature="services"/>:<ServicesPage services={services} setServices={setServices}/>)}
          {page==="advisor"&&(isFeatureLocked("advisor",subscription)?<PaywallPage onUpgrade={()=>setShowUpgrade(true)} feature="advisor"/>:<AdvisorPage dailySnaps={dailySnaps} history={history} nwHistory={nwHistory} completed={completed} debts={debts} transactions={transactions} holdings={holdings} superLog={superLog} books={books} workouts={workouts} bodyLog={bodyLog} weeklyReflections={weeklyReflections} journal={journal} profile={liveProfile} properties={properties} tasks={tasks} goals={goals} supplements={supplements} habits={habits} habitLog={habitLog} messages={advisorMessages} setMessages={setAdvisorMessages}/>)}
          {page==="profile"&&<ProfilePage profile={activeProfile} setProfile={setProfile} properties={properties} onReset={handleReset} onRecalibrate={()=>setShowRecalibrate(true)} theme={theme} setTheme={setTheme} bgPhoto={bgPhoto} setBgPhotoId={setBgPhotoId} nwHistory={nwHistoryFull} tasks={tasks} goals={goals} workouts={workouts} transactions={transactions} journal={journal} authUser={authUser} authToken={authToken} handleSignOut={handleSignOut} setShowAuth={setShowAuth} subscription={subscription} onUpgrade={()=>setShowUpgrade(true)} handlePortal={handlePortal}/>}
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
