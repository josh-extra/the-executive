import{useState,useEffect,useRef,useCallback,Component}from"react";

const THEMES={
  obsidian:{BG:"#080808",CARD:"#111",CARD2:"#181818",BORDER:"#1E1E1E",BORDER2:"#2A2A2A",TEXT:"#E4DDD0",MUTED:"#6A6050",MUTED2:"#3A3028",GOLD:"#C9A84C",GL:"#E8C96A",RED:"#C97E7E",GREEN:"#7A9E7E",BLUE:"#7EB8C9",PURPLE:"#B07EC9"},
  charcoal:{BG:"#141414",CARD:"#1E1E1E",CARD2:"#252525",BORDER:"#2E2E2E",BORDER2:"#383838",TEXT:"#E0E0E0",MUTED:"#666666",MUTED2:"#404040",GOLD:"#BFBFBF",GL:"#D8D8D8",RED:"#C07070",GREEN:"#70A870",BLUE:"#70A8C0",PURPLE:"#A070C0"},
  parchment:{BG:"#F5F0E8",CARD:"#FFFDF8",CARD2:"#F0EBE0",BORDER:"#E5DDD0",BORDER2:"#D5C8B8",TEXT:"#1A1208",MUTED:"#8A7A60",MUTED2:"#C5B8A0",GOLD:"#A07830",GL:"#C9A84C",RED:"#A05050",GREEN:"#507850",BLUE:"#507890",PURPLE:"#805090"},
  minimal:{BG:"#FFFFFF",CARD:"#F7F7F7",CARD2:"#EFEFEF",BORDER:"#E8E8E8",BORDER2:"#D8D8D8",TEXT:"#111111",MUTED:"#888888",MUTED2:"#C8C8C8",GOLD:"#222222",GL:"#555555",RED:"#C0392B",GREEN:"#2A7A2A",BLUE:"#1A5A9A",PURPLE:"#6A3A9A"}
};
const THEME_ALIASES={dark:"obsidian",light:"parchment"};
let _themeKey="obsidian";
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
  async signOut(token){await fetch(SUPABASE_URL+"/auth/v1/logout",{method:"POST",headers:sbH(token)});},
  async getUser(token){const r=await fetch(SUPABASE_URL+"/auth/v1/user",{headers:sbH(token)});return r.json();},
  async load(userId,token){const r=await fetch(SUPABASE_URL+"/rest/v1/user_data?user_id=eq."+userId+"&select=data",{headers:sbH(token)});const rows=await r.json();return rows&&rows[0]?rows[0].data:null;},
  async save(userId,token,data){await fetch(SUPABASE_URL+"/rest/v1/user_data",{method:"POST",headers:{...sbH(token),"Prefer":"resolution=merge-duplicates"},body:JSON.stringify({user_id:userId,data,updated_at:new Date().toISOString()})});},
};

const fmt=n=>{
  if(!n&&n!==0)return L().symbol+"0";
  const s=L().symbol,v=Math.abs(n);
  const f=v>=1e6?s+(v/1e6).toFixed(2)+"M":v>=1e4?s+(v/1e3).toFixed(1)+"k":s+v.toLocaleString("en-AU",{minimumFractionDigits:2,maximumFractionDigits:2});
  return n<0?"-"+f:f;
};
const todayStr=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
const monthStr=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");};
const calcAge=dob=>{if(!dob)return null;const d=new Date(dob),now=new Date();let age=now.getFullYear()-d.getFullYear();if(now.getMonth()<d.getMonth()||(now.getMonth()===d.getMonth()&&now.getDate()<d.getDate()))age--;return age;};
const fmtDate=d=>{try{return new Date(d+"T12:00:00").toLocaleDateString(_locale,{day:"numeric",month:"short"});}catch{return d;}};
const AU_TAX=[[18200,0,0],[45000,.19,0],[120000,.325,5092],[180000,.37,29467],[Infinity,.45,51667]];
const calcTax=inc=>{for(let i=AU_TAX.length-1;i>=0;i--)if(inc>AU_TAX[i][0])return AU_TAX[i][2]+AU_TAX[i][1]*(inc-AU_TAX[i][0]);return 0;};
const ASSET_COLORS={shares:"#C9A84C",property:"#7A9E7E",cash:"#7EB8C9",crypto:"#B07EC9",super:"#C97E7E"};
const ASSET_LABELS={shares:"Equities",property:"Property",cash:"Cash",crypto:"Digital Assets",super:"Super/Pension"};
const CAT_COLORS={financial:"#C9A84C",career:"#7EB8C9",health:"#7A9E7E",education:"#B07EC9",personal:"#C97E7E"};
const EXP_CATS={
  income:["Salary","Business Revenue","Investment Income","Rental Income","Side Income","Other"],
  expense:["Housing","Food & Dining","Transport","Health & Fitness","Education","Entertainment","Subscriptions","Travel","Tax","Other"]
};
const NW_MILESTONES=[250000,500000,750000,1000000,1500000,2000000,2500000,3000000,5000000,10000000];
const MOODS=[{v:1,l:"Rough",c:"#C97E7E"},{v:2,l:"Low",c:"#D4956A"},{v:3,l:"OK",c:"#7A7060"},{v:4,l:"Good",c:"#7EB8C9"},{v:5,l:"Great",c:"#7A9E7E"}];
// Habit emojis defined in JSX render, not here
const EXERCISES=["Bench Press","Squat","Deadlift","Overhead Press","Pull-ups","Rows","Dips","Leg Press","Lat Pulldown","Bicep Curl","Romanian Deadlift"];
const WTYPES=["Strength","Hypertrophy","Cardio","HIIT","Mobility","Sport"];
const WCOLORS={Strength:"#C9A84C",Hypertrophy:"#B07EC9",Cardio:"#7A9E7E",HIIT:"#C97E7E",Mobility:"#7EB8C9",Sport:"#D4956A"};
const JP=["What is my number 1 priority today?","What am I grateful for?","What would make today a win?","What obstacle must I overcome?","What did I learn yesterday?"];
const NAV=[
  ["dashboard","🏠","Dashboard"],["search","🔍","Search"],["tasks","📝","Tasks"],["habits","🔥","Habits"],
  ["goals","🎯","Goals"],["journal","📓","Journal"],["reading","📚","Reading"],
  ["wealth","💸","Wealth"],["cashflow","💰","Cash Flow"],
  ["bills","🔁","Bills"],
  ["budget","📊","Budget"],["debt","📉","Debt"],
  ["invest","💵","Invest"],["health","💊","Health"],["body","💪","Body"],
  ["workout","🏋","Workout"],["recipes","🍽","Recipes"],["weekly","📊","Weekly"],["advisor","🤖","AI Advisor"],
  ["learn","🎓","Learn"],["notes","📋","Notes"],["services","👔","Services"],
  ["profile","👤","Profile"]
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
  if(!saved.lastSavedDate||saved.lastSavedDate!==today)
    return{...saved,lastSavedDate:today,
      // Completed tasks reset to undone, incomplete tasks roll over as-is
      tasks:(saved.tasks||[]).map(t=>t.done?{...t,done:false}:t),
      supplements:(saved.supplements||[]).map(s=>({...s,taken:false}))};
  return saved;
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

function useMarket(){
  const[data,setData]=useState({sp500:{price:null,pct:null,loading:true},asx:{price:null,pct:null,loading:true},audusd:{price:null,pct:null,loading:true},lastUpdated:null});
  const fetchAll=useCallback(async()=>{
    try{
      const r=await fetch("/api/quote?symbol=^GSPC");
      const j=await r.json();
      if(!j.error){
        const[a,u]=await Promise.all([
          fetch("/api/quote?symbol=^AXJO").then(r=>r.json()),
          fetch("/api/quote?symbol=OANDA:AUD_USD").then(r=>r.json())
        ]);
        setData({
          sp500:{price:j.price,pct:j.pct,loading:false,error:false},
          asx:{price:a.error?null:a.price,pct:a.error?null:a.pct,loading:false,error:!!a.error},
          audusd:{price:u.error?null:u.price,pct:u.error?null:u.pct,loading:false,error:!!u.error},
          lastUpdated:new Date()
        });
        return;
      }
    }catch(e){}
    setData({
      sp500:{price:5801,pct:.77,loading:false,error:true},
      asx:{price:8320,pct:.51,loading:false,error:true},
      audusd:{price:.6412,pct:.19,loading:false,error:true},
      lastUpdated:new Date()
    });
  },[]);
  useEffect(()=>{fetchAll();const id=setInterval(fetchAll,300000);return()=>clearInterval(id);},[]);
  return{...data,refresh:fetchAll};
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
        const r=await fetch("/api/quote?symbol="+encodeURIComponent(h.ticker));
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
        const r=await fetch("/api/quote?symbol="+encodeURIComponent(sym));
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
  constructor(p){super(p);this.state={error:null};}
  static getDerivedStateFromError(e){return{error:e};}
  render(){
    if(this.state.error){
      const t=THEMES.obsidian;
      return (
        <div style={{minHeight:"100vh",background:t.BG,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,padding:40,textAlign:"center"}}>
          <div style={{fontSize:32,color:t.RED}}>!</div>
          <div style={{fontSize:18,color:t.TEXT,fontFamily:"sans-serif"}}>Something went wrong</div>
          <div style={{fontSize:13,color:t.MUTED,fontFamily:"sans-serif",maxWidth:360,lineHeight:1.7}}>{this.state.error?.message}</div>
          <button onClick={()=>{localStorage.removeItem(SK);window.location.reload();}} style={{background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:8,padding:"10px 24px",color:"#080808",cursor:"pointer",fontFamily:"sans-serif",fontSize:13,fontWeight:700}}>Reset and Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
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
  return <div onClick={onClick} style={{background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:10,padding:16,...style,cursor:onClick?"pointer":"default"}}>{children}</div>;
}
function Divider(){
  const t=T();
  return <div style={{height:1,background:t.BORDER,margin:"6px 0"}}/>;
}
function SectionLabel({children,action}){
  const t=T();
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div style={{fontSize:9,letterSpacing:2,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif"}}>{children}</div>
      {action}
    </div>
  );
}
function StatCard({label,value,color,sub}){
  const t=T();
  return (
    <Card style={{textAlign:"center",padding:"14px 10px"}}>
      <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",letterSpacing:1,marginBottom:5}}>{label}</div>
      <div style={{fontSize:18,color:color||t.GOLD,fontFamily:"sans-serif",fontWeight:700}}>{value}</div>
      {sub&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginTop:3}}>{sub}</div>}
    </Card>
  );
}
function Tag({children,color}){
  const t=T();const c=color||t.GOLD;
  return <div style={{display:"inline-block",background:c+"22",border:"1px solid "+c+"44",borderRadius:4,padding:"2px 6px",fontSize:10,color:c,fontFamily:"sans-serif",fontWeight:700}}>{children}</div>;
}
function Skeleton({width="100%",height=14}){
  const t=T();
  return <div style={{background:t.CARD2,borderRadius:4,width,height,animation:"sk 1.5s infinite"}}/>;
}
function Inp({value,onChange,placeholder,type,style}){
  const t=T();
  return <input type={type||"text"} value={value||""} onChange={onChange} placeholder={placeholder||""} style={{background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:7,padding:"9px 12px",color:t.TEXT,fontFamily:"sans-serif",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box",...style}}/>;
}
function Sel({value,onChange,children,style}){
  const t=T();
  return <select value={value} onChange={onChange} style={{background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:7,padding:"9px 11px",color:t.TEXT,fontFamily:"sans-serif",fontSize:12,outline:"none",width:"100%",boxSizing:"border-box",...style}}>{children}</select>;
}
function Btn({onClick,children,style,disabled,variant}){
  const t=T();
  if(variant==="ghost")return <button onClick={onClick} disabled={!!disabled} style={{background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:7,padding:"9px 16px",color:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:12,...style}}>{children}</button>;
  return <button onClick={onClick} disabled={!!disabled} style={{background:disabled?t.BORDER2:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:7,padding:"9px 16px",color:disabled?t.MUTED:"#080808",cursor:disabled?"default":"pointer",fontFamily:"sans-serif",fontSize:12,fontWeight:700,...style}}>{children}</button>;
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
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{hover.label}</div>
          <div style={{fontSize:13,color:color,fontFamily:"sans-serif",fontWeight:700}}>{fmt(hover.val)}</div>
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
          <div style={{fontSize:14,color:t.TEXT,fontFamily:"sans-serif"}}>{title}</div>
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
      <div style={{fontSize:11,letterSpacing:4,color:t.GOLD,fontFamily:"sans-serif",marginBottom:8}}>MILESTONE REACHED</div>
      <div style={{fontSize:40,color:t.GOLD,fontFamily:"sans-serif",fontWeight:700,marginBottom:8}}>{fmt(milestone)}</div>
      <div style={{fontSize:16,color:t.TEXT,fontFamily:"sans-serif",marginBottom:28}}>Net Worth Milestone Unlocked</div>
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
            <div style={{fontSize:11,color:T().MUTED,fontFamily:"sans-serif",minWidth:100,flexShrink:0}}>{l}</div>
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
        const highTasks=(tasks||[]).filter(tk=>tk.priority==="high").map(tk=>tk.text).join(", ");
        const dateLabel=new Date().toLocaleDateString(_locale,{weekday:"long",day:"numeric",month:"long"});
        const r=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:700,tools:[{type:"web_search_20250305",name:"web_search"}],system:"Sharp morning briefing for "+profile.firstName+", "+(profile.occupation||"investor")+". NW: "+fmt(profile.netWorth||0)+". Sections: MARKETS (search today), PRIORITIES (top 3 tasks), PULSE (one financial insight), MINDSET (one sentence). Plain text, caps headers.",messages:[{role:"user",content:"Briefing for "+dateLabel+". Tasks: "+highTasks}]})});
        const d=await r.json();
        setBrief((d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n")||"Unable to generate.");
      }catch{setBrief("Connection error.");}
      setLoading(false);
    })();
  },[]);
  return (
    <Modal title="Morning Briefing" onClose={onClose}>
      <div style={{fontSize:13,color:t.TEXT,lineHeight:1.85,fontFamily:"sans-serif",whiteSpace:"pre-wrap"}}>
        {loading?(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <Skeleton width="80%" height={13}/>
            <Skeleton width="65%" height={13}/>
            <Skeleton width="90%" height={13}/>
            <div style={{textAlign:"center",marginTop:8,fontSize:11,color:t.MUTED}}>Scanning markets...</div>
          </div>
        ):brief}
      </div>
    </Modal>
  );
}

function useIsMobile(){
  const[mobile,setMobile]=useState(window.innerWidth<768);
  useEffect(()=>{
    const h=()=>setMobile(window.innerWidth<768);
    window.addEventListener('resize',h);
    return()=>window.removeEventListener('resize',h);
  },[]);
  return mobile;
}

function Sidebar({page,setPage,profile,theme,setTheme,collapsed,setCollapsed,savedLabel}){
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
    ["Command",["dashboard","search","weekly","advisor","learn","notes","services"]],
    ["Execute",["tasks","habits","goals","journal","reading"]],
    ["Wealth",["wealth","cashflow","bills","budget","debt","invest"]],
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
              <div style={{fontSize:9,letterSpacing:4,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif"}}>The Executive</div>
              <button onClick={()=>setMenuOpen(false)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:22,lineHeight:1}}>X</button>
            </div>
            <div style={{flex:1,padding:"8px 0"}}>
              {groups.map(([group,pages])=>(
                <div key={group} style={{marginBottom:4}}>
                  <div style={{fontSize:8,letterSpacing:2,color:t.MUTED,textTransform:"uppercase",fontFamily:"sans-serif",padding:"8px 20px 4px"}}>{group}</div>
                  {pages.map(id=>{
                    const nav=NAV.find(n=>n[0]===id);
                    if(!nav)return null;
                    const active=page===id;
                    return (
                      <button key={id} onClick={()=>{setPage(id);setMenuOpen(false);}} style={{display:"flex",alignItems:"center",gap:14,width:"100%",padding:"12px 20px",background:active?t.GOLD+"18":"none",border:"none",borderLeft:active?"3px solid "+t.GOLD:"3px solid transparent",color:active?t.GOLD:t.TEXT,cursor:"pointer",fontFamily:"sans-serif",fontSize:14,textAlign:"left"}}>
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
                  <div style={{fontSize:13,color:t.TEXT,fontFamily:"sans-serif"}}>{profile.firstName} {profile.lastName}</div>
                  <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{profile.occupation||"The Executive"}</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                {[{id:"obsidian",l:"Obsidian"},{id:"charcoal",l:"Charcoal"},{id:"parchment",l:"Parchment"},{id:"minimal",l:"Minimal"}].map(th=>(
                  <button key={th.id} onClick={()=>setTheme(th.id)} style={{padding:"6px 4px",borderRadius:7,border:"1px solid "+(theme===th.id?t.GOLD:t.BORDER),background:theme===th.id?t.GOLD+"18":"transparent",color:theme===th.id?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>
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
              <button key={id} onClick={()=>setPage(id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"8px 4px",background:"none",border:"none",borderTop:active?"2px solid "+t.GOLD:"2px solid transparent",color:active?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"sans-serif"}}>
                <span style={{fontSize:20,lineHeight:1}}>{icon}</span>
                <span style={{fontSize:9,letterSpacing:.3}}>{label}</span>
              </button>
            );
          })}
          {/* Theme toggle */}
          <button onClick={()=>{const order=["obsidian","charcoal","parchment","minimal"];const next=order[(order.indexOf(theme)+1)%order.length];setTheme(next);}} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"8px 4px",background:"none",border:"none",borderTop:"2px solid transparent",color:t.MUTED,cursor:"pointer",fontFamily:"sans-serif"}}>
            <span style={{fontSize:16,lineHeight:1}}>{theme==="obsidian"||theme==="charcoal"?"Sun":"Moon"}</span>
            <span style={{fontSize:9,letterSpacing:.3}}>Theme</span>
          </button>
          {/* More button */}
          <button onClick={()=>setMenuOpen(true)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"8px 4px",background:"none",border:"none",borderTop:"2px solid transparent",color:t.MUTED,cursor:"pointer",fontFamily:"sans-serif"}}>
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
        {!collapsed&&<div style={{fontSize:9,letterSpacing:4,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif"}}>The Executive</div>}
        <button onClick={()=>setCollapsed(x=>!x)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:14,lineHeight:1,flexShrink:0}}>M</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"6px 0"}}>
        {groups.map(([group,pages])=>(
          <div key={group} style={{marginBottom:2}}>
            {!collapsed&&<div style={{fontSize:8,letterSpacing:2,color:t.MUTED,textTransform:"uppercase",fontFamily:"sans-serif",padding:"4px 14px 2px"}}>{group}</div>}
            {pages.map(id=>{
              const nav=NAV.find(n=>n[0]===id);
              if(!nav)return null;
              const active=page===id;
              return (
                <button key={id} onClick={()=>setPage(id)} title={nav[2]} style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:collapsed?"9px 0":"6px 14px",background:active?t.GOLD+"18":"none",border:"none",borderLeft:active?"2px solid "+t.GOLD:"2px solid transparent",color:active?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11,textAlign:"left",justifyContent:collapsed?"center":"flex-start",transition:"all .15s"}}>
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
              <div style={{fontSize:11,color:t.TEXT,fontFamily:"sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{profile.firstName} {profile.lastName}</div>
              <div style={{fontSize:9,color:savedLabel?t.GREEN:t.MUTED,fontFamily:"sans-serif"}}>{savedLabel||profile.occupation||"The Executive"}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:4}}>
            {[{id:"obsidian",l:"Ob"},{id:"charcoal",l:"Ch"},{id:"parchment",l:"Pa"},{id:"minimal",l:"Mi"}].map(th=>(
              <button key={th.id} onClick={()=>setTheme(th.id)} style={{flex:1,padding:"4px 2px",borderRadius:5,border:"1px solid "+(theme===th.id?t.GOLD:t.BORDER),background:theme===th.id?t.GOLD+"18":"transparent",color:theme===th.id?t.GOLD:t.MUTED,cursor:"pointer",fontSize:9,fontFamily:"sans-serif"}}>
                {th.l}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardPage({profile,tasks,setTasks,goals,supplements,history,streak,market,nwHistory,setPage,setShowBriefing,habits,habitLog,setHabitLog,bills,transactions,isMobile,syncing,authUser,setShowAuth}){
  const t=T();
  const[visibleRows,setVisibleRows]=useState([]);
  useEffect(()=>{
    const delays=[0,120,240,360,480];
    const timers=delays.map((d,i)=>setTimeout(()=>setVisibleRows(r=>[...r,i]),d));
    return()=>timers.forEach(clearTimeout);
  },[]);
  const rowStyle=i=>({opacity:visibleRows.includes(i)?1:0,transform:visibleRows.includes(i)?"none":"translateY(16px)",transition:"opacity .45s ease, transform .45s ease"});
  const tDone=tasks.filter(tk=>tk.done).length;
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
  const quotes=["Wealth is the slave of a wise man.","The secret of getting ahead is getting started.","An investment in knowledge pays the best interest.","Do not save what is left after spending.","Discipline is the bridge between goals and accomplishment.","Fortune favours the prepared mind.","Either you run the day or the day runs you.","The goal is living life on your own terms."];
  const quote=quotes[(new Date().getFullYear()*10000+new Date().getMonth()*100+new Date().getDate())%quotes.length];
  const upcoming=(bills||[]).filter(b=>{const d=(new Date(b.nextDue+"T12:00:00")-new Date())/864e5;return d>=0&&d<=7;});
  const highTasks=tasks.filter(tk=>tk.priority==="high");
  const rings=[
    {pct:tasks.length?Math.round(tDone/tasks.length*100):0,c:t.GREEN,label:"Tasks",sub:tDone+"/"+tasks.length,page:"tasks"},
    {pct:(habits||[]).length?Math.round(hDone/(habits||[]).length*100):0,c:t.GOLD,label:"Habits",sub:hDone+"/"+((habits||[]).length),page:"habits"},
    {pct:supplements.length?Math.round(sDone/supplements.length*100):0,c:t.BLUE,label:"Supps",sub:sDone+"/"+supplements.length,page:"health"}
  ];
  const tPct=tasks.length?Math.round(tDone/tasks.length*100):0;
  const hbPct=(habits||[]).length?Math.round(hDone/(habits||[]).length*100):0;
  const sPct=supplements.length?Math.round(sDone/supplements.length*100):0;
  const activeCats=[tasks.length>0,(habits||[]).length>0,supplements.length>0].filter(Boolean).length;
  const todayScore=activeCats>0?Math.round((tPct+hbPct+sPct)/activeCats):0;
  const scoreColor=todayScore>=80?t.GREEN:todayScore>=60?t.GOLD:todayScore>=40?t.BLUE:t.RED;
  const r=32,circ=2*Math.PI*r;
  const mk=monthStr();
  const monthIncome=(transactions||[]).filter(tx=>tx.date.startsWith(mk)&&tx.type==="income").reduce((s,tx)=>s+tx.amount,0);
  const monthExpense=(transactions||[]).filter(tx=>tx.date.startsWith(mk)&&tx.type==="expense").reduce((s,tx)=>s+tx.amount,0);
  const monthNet=monthIncome-monthExpense;
  const nextBill=(bills||[]).filter(b=>(new Date(b.nextDue+"T12:00:00")-new Date())>0).sort((a,b)=>new Date(a.nextDue)-new Date(b.nextDue))[0];
  const monthlyBills=(bills||[]).reduce((s,b)=>{const m={weekly:52/12,fortnightly:26/12,monthly:1,quarterly:1/3,annually:1/12};return s+b.amount*(m[b.frequency]||1);},0);
  const mktRows=[{l:"S&P 500",d:market.sp500,fx:false},{l:"ASX 200",d:market.asx,fx:false},{l:"AUD/USD",d:market.audusd,fx:true}];
  const goalPeriods=["year","month","week"];
  const periodLabels={year:"Annual",month:"Monthly",week:"This Week"};
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* ── HEADER ── */}
      <div style={{...rowStyle(0),display:"flex",justifyContent:"space-between",alignItems:isMobile?"center":"flex-start",flexDirection:isMobile?"column":"row",gap:isMobile?10:0,textAlign:isMobile?"center":"left"}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:4}}>Dashboard</div>
          <div style={{fontSize:isMobile?22:26,color:t.TEXT}}>
            {"Good "+(new Date().getHours()<12?"morning":new Date().getHours()<18?"afternoon":"evening")+", "}
            <span style={{color:t.GOLD}}>{profile.firstName}</span>
          </div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginTop:2}}>{new Date().toLocaleDateString(_locale,{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          {!isMobile&&<div style={{fontSize:11,color:t.MUTED,fontFamily:"Georgia,serif",fontStyle:"italic",maxWidth:280,textAlign:"right",lineHeight:1.6}}>"{quote}"</div>}
          {syncing&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",opacity:.7}}>Syncing...</div>}
          {authUser?(
            <div style={{display:"flex",alignItems:"center",gap:5,background:t.GREEN+"14",border:"1px solid "+t.GREEN+"33",borderRadius:6,padding:"4px 9px"}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:t.GREEN,flexShrink:0}}/>
              <span style={{fontSize:9,color:t.GREEN,fontFamily:"sans-serif"}}>{authUser.email?.split("@")[0]}</span>
            </div>
          ):(
            <button onClick={()=>setShowAuth(true)} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:6,padding:"5px 10px",color:t.GOLD,cursor:"pointer",fontFamily:"sans-serif",fontSize:10,whiteSpace:"nowrap"}}>Sign In</button>
          )}
          <button onClick={()=>setShowBriefing(true)} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:8,padding:"7px 14px",color:t.GOLD,cursor:"pointer",fontFamily:"sans-serif",fontSize:11,whiteSpace:"nowrap"}}>Morning Brief</button>
        </div>
      </div>
      {/* ── ROW 1: Score + Rings + Net Worth ── */}
      <div style={{...rowStyle(1),display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:12}}>
        {/* Score */}
        <Card style={{background:t.CARD2,border:"1px solid "+scoreColor+"44",display:"flex",alignItems:"center",gap:14}}>
          <div style={{flexShrink:0}}>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",letterSpacing:1,marginBottom:4}}>TODAY'S SCORE</div>
            <div style={{display:"flex",alignItems:"baseline",gap:3}}>
              <div style={{fontSize:isMobile?38:52,color:scoreColor,fontFamily:"sans-serif",fontWeight:700,lineHeight:1}}>{todayScore}</div>
              <div style={{fontSize:16,color:t.MUTED,fontFamily:"sans-serif"}}>%</div>
            </div>
            <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginTop:2}}>{streak+" day streak"}</div>
          </div>
          <div style={{flex:1}}>
            {[{l:"Tasks",v:tPct,c:t.GREEN},{l:"Habits",v:hbPct,c:t.GOLD},{l:"Supps",v:sPct,c:t.BLUE}].map(x=>(
              <div key={x.l} style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",width:34}}>{x.l}</div>
                <div style={{flex:1}}><PB value={x.v} color={x.c} height={4}/></div>
                <div style={{fontSize:9,color:x.c,fontFamily:"sans-serif",width:28,textAlign:"right"}}>{x.v+"%"}</div>
              </div>
            ))}
          </div>
        </Card>
        {/* Progress Rings */}
        {!isMobile&&<Card style={{display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
          <SectionLabel action={<span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{streak+" day streak"}</span>}>Today's Progress</SectionLabel>
          <div style={{display:"flex",justifyContent:"space-around",alignItems:"center",flex:1,padding:"6px 0"}}>
            {rings.map(ring=>(
              <div key={ring.label} onClick={()=>setPage(ring.page)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,cursor:"pointer"}}>
                <div style={{position:"relative",width:76,height:76}}>
                  <svg width={76} height={76} style={{transform:"rotate(-90deg)"}}>
                    <circle cx={38} cy={38} r={r} fill="none" stroke={t.BORDER2} strokeWidth={7}/>
                    <circle cx={38} cy={38} r={r} fill="none" stroke={ring.c} strokeWidth={7} strokeDasharray={(Math.min(ring.pct/100,1)*circ)+","+circ} strokeLinecap="round" style={{transition:"stroke-dasharray .7s"}}/>
                  </svg>
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <div style={{fontSize:12,color:ring.c,fontFamily:"sans-serif",fontWeight:700}}>{ring.pct+"%"}</div>
                  </div>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:11,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>{ring.label}</div>
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{ring.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>}
        {/* Net Worth */}
        <Card style={{cursor:"pointer"}} onClick={()=>setPage("wealth")}>
          <SectionLabel>Net Worth</SectionLabel>
          <div style={{fontSize:isMobile?24:30,color:t.GOLD,fontFamily:"sans-serif",fontWeight:700,marginBottom:2}}>{fmt(nw)}</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginBottom:10}}>{"Target: "+fmt(nwT)+" - "+nwPct+"%"}</div>
          <SparkLine data={[...nwVals,nw]} color={t.GOLD} height={48} labels={nwLabels}/>
          <div style={{marginTop:8}}><PB value={nwPct} color={t.GOLD} height={3}/></div>
        </Card>
      </div>

      {/* ── ALERTS ── */}
      <div style={rowStyle(2)}>
      {(()=>{
        const alerts=[];
        if(upcoming.length>0) alerts.push({type:"bill",msg:"Bill due: "+upcoming[0].name+" ("+fmt(upcoming[0].amount)+")",page:"bills",color:t.RED});
        const behindGoals=(goals||[]).filter(g=>g.progress<30&&g.period!=="year");
        if(behindGoals.length>0) alerts.push({type:"goal",msg:"Goal behind: "+behindGoals[0].title+" at "+behindGoals[0].progress+"%",page:"goals",color:t.GOLD});
        const missedSupps=(supplements||[]).filter(s=>!s.taken);
        const hour=new Date().getHours();
        if(hour>=18&&missedSupps.length>0) alerts.push({type:"supp",msg:missedSupps.length+" supplement"+(missedSupps.length>1?"s":"")+" not taken today",page:"health",color:t.BLUE});
        const highIncomplete=tasks.filter(tk=>tk.priority==="high"&&!tk.done);
        if(highIncomplete.length>2) alerts.push({type:"task",msg:highIncomplete.length+" high priority tasks incomplete",page:"tasks",color:t.PURPLE});
        return alerts.slice(0,3).map((a,i)=>(
          <div key={i} onClick={()=>setPage(a.page)} style={{padding:"9px 13px",background:a.color+"14",border:"1px solid "+a.color+"33",borderRadius:7,display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:a.color,flexShrink:0}}/>
            <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif",flex:1}}>{a.msg}</div>
            <div style={{fontSize:10,color:a.color,fontFamily:"sans-serif",flexShrink:0}}>View</div>
          </div>
        ));
      })()}
      </div>

      {/* ── ROW 2: Markets + Cash Flow + Bills ── */}
      <div style={{...rowStyle(3),display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:12}}>
        {/* Markets */}
        <Card>
          <SectionLabel action={
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              {market.lastUpdated&&<span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{market.lastUpdated.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>}
              <button onClick={market.refresh} style={{background:t.GOLD+"22",border:"1px solid "+t.GOLD+"44",borderRadius:4,padding:"2px 6px",color:t.GOLD,cursor:"pointer",fontSize:10}}>R</button>
            </div>
          }>Markets</SectionLabel>
          {mktRows.map((m,i)=>(
            <div key={m.l}>
              {i>0&&<Divider/>}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0"}}>
                <div>
                  <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginBottom:2}}>{m.l}</div>
                  {m.d.loading?<Skeleton width={80} height={14}/>:<div style={{fontSize:15,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>{m.fx?m.d.price?.toFixed(4):m.d.price?.toLocaleString(_locale,{maximumFractionDigits:0})}</div>}
                </div>
                {!m.d.loading&&<div style={{fontSize:11,color:m.d.pct>=0?t.GREEN:t.RED,fontFamily:"sans-serif",fontWeight:600}}>{(m.d.pct>=0?"+ ":"- ")+Math.abs(m.d.pct||0).toFixed(2)+"%"}</div>}
              </div>
            </div>
          ))}
        </Card>
        {/* Cash Flow */}
        <Card style={{cursor:"pointer"}} onClick={()=>setPage("cashflow")}>
          <SectionLabel>Cash Flow - This Month</SectionLabel>
          {monthIncome===0&&monthExpense===0?(
            <div style={{textAlign:"center",padding:"12px 0"}}>
              <div style={{fontSize:12,color:t.MUTED,fontFamily:"sans-serif",marginBottom:4}}>No transactions this month</div>
              <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",opacity:.7}}>Add income and expenses in Cash Flow</div>
            </div>
          ):(
            <>
              <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:10}}>
                {[{l:"Income",v:monthIncome,c:t.GREEN},{l:"Expenses",v:monthExpense,c:t.RED}].map(x=>(
                  <div key={x.l} style={{display:"flex",alignItems:"center",gap:7}}>
                    <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",width:52}}>{x.l}</div>
                    <div style={{flex:1}}><PB value={monthIncome>0?Math.round(x.v/monthIncome*100):0} color={x.c} height={4}/></div>
                    <div style={{fontSize:9,color:x.c,fontFamily:"sans-serif",width:52,textAlign:"right",fontWeight:600}}>{fmt(x.v)}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"1px solid "+t.BORDER,paddingTop:8}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>Net this month</div>
                <div style={{fontSize:18,color:monthNet>=0?t.GREEN:t.RED,fontFamily:"sans-serif",fontWeight:700}}>{(monthNet>=0?"+":"")+fmt(monthNet)}</div>
              </div>
            </>
          )}
        </Card>
        {/* Bills */}
        <Card style={{cursor:"pointer"}} onClick={()=>setPage("bills")}>
          <SectionLabel>Bills</SectionLabel>
          {!bills||bills.length===0?(
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",padding:"8px 0"}}>No bills tracked yet</div>
          ):(
            <>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginBottom:3}}>Monthly recurring</div>
                <div style={{fontSize:24,color:t.RED,fontFamily:"sans-serif",fontWeight:700}}>{fmt(monthlyBills)}</div>
              </div>
              {nextBill&&<div style={{borderTop:"1px solid "+t.BORDER,paddingTop:8}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginBottom:3}}>Next due</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>{nextBill.name}</div>
                  <div style={{fontSize:13,color:t.RED,fontFamily:"sans-serif",fontWeight:600}}>{fmt(nextBill.amount)}</div>
                </div>
                <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginTop:2}}>{nextBill.nextDue}</div>
              </div>}
            </>
          )}
        </Card>
      </div>

      {/* ── ROW 3: Tasks + Goals + Habits ── */}
      <div style={{...rowStyle(4),display:"grid",gridTemplateColumns:isMobile?"1fr":"1.2fr 1fr 1fr",gap:12}}>
        {/* Tasks */}
        <Card>
          <SectionLabel action={<button onClick={()=>setPage("tasks")} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>All tasks</button>}>Priority Actions</SectionLabel>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>
            <span>{tDone+"/"+tasks.length+" done"}</span>
            <span>{(tasks.length?Math.round(tDone/tasks.length*100):0)+"%"}</span>
          </div>
          <div style={{marginBottom:10}}><PB value={tasks.length?Math.round(tDone/tasks.length*100):0} color={t.GREEN} height={3}/></div>
          {tasks.slice(0,6).map((tk,i)=>(
            <div key={tk.id}>
              {i>0&&<Divider/>}
              <div onClick={()=>togTask(tk.id)} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 0",cursor:"pointer"}}>
                <div style={{width:18,height:18,borderRadius:"50%",border:"1.5px solid "+(tk.done?t.GOLD:t.BORDER2),background:tk.done?t.GOLD:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {tk.done&&<span style={{fontSize:9,color:"#080808",fontWeight:700}}>V</span>}
                </div>
                <span style={{flex:1,fontSize:12,color:tk.done?t.MUTED:t.TEXT,fontFamily:"sans-serif",textDecoration:tk.done?"line-through":"none"}}>{tk.text}</span>
                {tk.priority==="high"&&!tk.done&&<div style={{width:6,height:6,borderRadius:"50%",background:t.RED,flexShrink:0}}/>}
              </div>
            </div>
          ))}
        </Card>
        {/* Goals */}
        <Card>
          <SectionLabel action={<button onClick={()=>setPage("goals")} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>All goals</button>}>Goals</SectionLabel>
          {goals.length===0?<div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif"}}>No goals set yet</div>:
          goals.slice(0,5).map(g=>{
            const col=CAT_COLORS[g.category]||t.GOLD;
            return (
              <div key={g.id} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <div style={{flex:1,marginRight:8}}>
                    <div style={{fontSize:8,color:col,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:1}}>{g.category}</div>
                    <div style={{fontSize:11,color:t.TEXT,fontFamily:"sans-serif",lineHeight:1.3}}>{g.title}</div>
                  </div>
                  <span style={{fontSize:13,color:col,fontFamily:"sans-serif",fontWeight:700,flexShrink:0}}>{g.progress+"%"}</span>
                </div>
                <PB value={g.progress} color={col} height={3}/>
              </div>
            );
          })}
        </Card>
        {/* Habits */}
        <Card>
          <SectionLabel action={<button onClick={()=>setPage("habits")} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>All habits</button>}>Today's Habits</SectionLabel>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {(habits||[]).slice(0,8).map(h=>{
              const done=!!habitLog[h.id+"_"+todayStr()];
              return (
                <div key={h.id} onClick={()=>togHabit(h.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:"1px solid "+t.BORDER,cursor:"pointer"}}>
                  <div style={{width:26,height:26,borderRadius:"50%",background:done?h.color:t.CARD2,border:"1.5px solid "+(done?h.color:t.BORDER2),flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,transition:"all .2s"}}>
                    {h.icon}
                  </div>
                  <span style={{flex:1,fontSize:12,color:done?t.MUTED:t.TEXT,fontFamily:"sans-serif",textDecoration:done?"line-through":"none"}}>{h.name}</span>
                  {done&&<span style={{fontSize:9,color:h.color,fontFamily:"sans-serif",fontWeight:600}}>done</span>}
                </div>
              );
            })}
          </div>
          <div style={{marginTop:10}}><PB value={(habits||[]).length?Math.round(hDone/(habits||[]).length*100):0} color={t.GOLD} height={3}/></div>
        </Card>
      </div>

      {/* ── AI ADVISOR BANNER ── */}
      <div style={rowStyle(5)}>
      <div onClick={()=>setPage("advisor")} style={{background:t.GOLD+"0A",border:"1px solid "+t.GOLD+"22",borderRadius:10,padding:"14px 18px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:9,letterSpacing:2,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:3}}>AI Advisor - Full Dashboard Context - Web Search</div>
          <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif"}}>Ask for a review, get market insights, or explore investment ideas</div>
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
  const done=tasks.filter(tk=>tk.done).length;
  const add=()=>{
    if(!newTask.trim())return;
    setTasks(ts=>[...ts,{id:Date.now(),text:newTask,done:false,priority:pri,recurring}]);
    setNewTask("");
  };
  const priColors={high:t.RED,medium:t.GOLD,low:t.MUTED};
  const priLabels={high:"High Priority",medium:"Standard",low:"Low Priority"};
  return (
    <div data-page="true" style={{maxWidth:680,margin:"0 auto"}}>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Daily Execution</div>
        <div style={{fontSize:26,color:t.TEXT,marginBottom:4}}>Today's Actions</div>
        <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif"}}>{done+" of "+tasks.length+" complete"}</div>
        <div style={{marginTop:8}}><PB value={tasks.length?Math.round(done/tasks.length*100):0} color={t.GREEN} height={3}/></div>
      </div>
      <Card style={{marginBottom:16,padding:"12px 14px"}}>
        <div style={{display:"flex",gap:8}}>
          <input value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Add a task..." style={{flex:1,background:"transparent",border:"none",outline:"none",color:t.TEXT,fontFamily:"sans-serif",fontSize:13}}/>
          <Sel value={pri} onChange={e=>setPri(e.target.value)} style={{width:90}}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Sel>
          <button onClick={()=>setRecurring(r=>!r)} style={{background:recurring?t.GOLD+"22":"transparent",border:"1px solid "+(recurring?t.GOLD:t.BORDER),borderRadius:6,padding:"6px 10px",color:recurring?t.GOLD:t.MUTED,cursor:"pointer",fontSize:11,fontFamily:"sans-serif",whiteSpace:"nowrap",flexShrink:0}}>
            {recurring?"Daily":"Once"}
          </button>
          <Btn onClick={add}>Add</Btn>
        </div>
      </Card>
      {["high","medium","low"].map(priority=>{
        const ts=tasks.filter(tk=>tk.priority===priority);
        return (
          <div key={priority} style={{marginBottom:18}}>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:priColors[priority]}}/>
              <div style={{fontSize:9,letterSpacing:2,color:priColors[priority],textTransform:"uppercase",fontFamily:"sans-serif"}}>{priLabels[priority]+" ("+ts.filter(x=>x.done).length+"/"+ts.length+")"}</div>
            </div>
            <Card style={{padding:"2px 0"}}>
              {ts.map((tk,i)=>(
                <div key={tk.id}>
                  {i>0&&<Divider/>}
                  <div onClick={()=>setTasks(ts=>ts.map(x=>x.id===tk.id?{...x,done:!x.done}:x))} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",cursor:"pointer"}}>
                    <div style={{width:19,height:19,borderRadius:"50%",border:"1.5px solid "+(tk.done?t.GOLD:t.BORDER2),background:tk.done?t.GOLD:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {tk.done&&<span style={{fontSize:9,color:"#080808",fontWeight:700}}>V</span>}
                    </div>
                    <span style={{flex:1,fontSize:13,color:tk.done?t.MUTED:t.TEXT,textDecoration:tk.done?"line-through":"none",fontFamily:"sans-serif"}}>{tk.text}</span>
                    {tk.recurring&&<span style={{fontSize:9,color:t.GOLD,fontFamily:"sans-serif",background:t.GOLD+"18",borderRadius:10,padding:"1px 6px",flexShrink:0}}>daily</span>}
                    <button onClick={e=>{e.stopPropagation();setTasks(ts=>ts.filter(x=>x.id!==tk.id));}} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:12,opacity:.5}}>X</button>
                  </div>
                </div>
              ))}
              {!ts.length&&<div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",padding:"8px 12px"}}>{"No "+priLabels[priority].toLowerCase()+" tasks"}</div>}
            </Card>
          </div>
        );
      })}
    </div>
  );
}

function HabitsPage({habits,setHabits,habitLog,setHabitLog}){
  const t=T();
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
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Daily Discipline</div>
          <div style={{fontSize:26,color:t.TEXT}}>Habit Tracker</div>
        </div>
        <Btn onClick={()=>setShowAdd(s=>!s)}>+ Add</Btn>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5,marginBottom:8}}>
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
              <div style={{fontSize:9,color:isT?t.GOLD:t.MUTED,fontFamily:"sans-serif",fontWeight:isT?700:400,marginBottom:4}}>{dayLetters[new Date(d+"T12:00:00").getDay()]}</div>
              <div style={{aspectRatio:"1",borderRadius:6,background:pct>0?col+"33":t.CARD2,border:"1.5px solid "+(isT?t.GOLD:col),display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:9,color:pct>0?col:t.MUTED,fontFamily:"sans-serif",fontWeight:700}}>{pct>0?pct+"%":"-"}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif"}}>{"This week: "+overallWeekPct+"% overall compliance"}</div>
        <div style={{display:"flex",gap:8}}>
          {[{c:t.GREEN,l:"80%+"},{c:t.GOLD,l:"50%+"},{c:t.BLUE,l:"1%+"}].map(x=>(
            <div key={x.l} style={{display:"flex",alignItems:"center",gap:3}}>
              <div style={{width:8,height:8,borderRadius:2,background:x.c+"66"}}/>
              <span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{x.l}</span>
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
                <div style={{position:"absolute",top:48,left:0,zIndex:100,background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:10,padding:10,display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:3,width:280,maxHeight:220,overflowY:"auto",boxShadow:"0 8px 24px rgba(0,0,0,.4)"}}>
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
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Days per week target</div>
              <Inp type="number" value={form.target} onChange={e=>setForm(f=>({...f,target:parseInt(e.target.value)||7}))} placeholder="7" style={{fontSize:12}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Time of day</div>
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
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:10}}>{TIME_LABELS[timeGroup]}</div>
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
                        <span style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.name}</span>
                        {streak>0&&<div style={{display:"flex",alignItems:"center",gap:2,background:h.color+"22",borderRadius:8,padding:"1px 5px",flexShrink:0}}>
                          <span style={{fontSize:9}}>🔥</span>
                          <span style={{fontSize:9,color:h.color,fontFamily:"sans-serif",fontWeight:700}}>{streak}</span>
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
                          <span style={{fontSize:9,color:t.RED,fontFamily:"sans-serif"}}>Del?</span>
                          <button onClick={()=>{setHabits(hs=>hs.filter(x=>x.id!==h.id));setConfirmDelete(null);}} style={{background:t.RED+"22",border:"1px solid "+t.RED+"44",borderRadius:4,padding:"1px 5px",color:t.RED,cursor:"pointer",fontSize:9,fontFamily:"sans-serif"}}>Y</button>
                          <button onClick={()=>setConfirmDelete(null)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:4,padding:"1px 5px",color:t.MUTED,cursor:"pointer",fontSize:9,fontFamily:"sans-serif"}}>N</button>
                        </div>
                      ):(
                        <button onClick={()=>setConfirmDelete(h.id)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.4,padding:"2px 4px"}}>X</button>
                      )}
                    </div>
                  </div>

                  {editingHabit===h.id&&(
                    <div style={{borderTop:"1px solid "+t.BORDER,marginTop:8,paddingTop:8,display:"flex",flexDirection:"column",gap:8}}>
                      <div style={{fontSize:9,color:t.GOLD,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1}}>Edit Habit</div>
                      <Inp value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} placeholder="Habit name..."/>
                      <div style={{display:"flex",gap:7}}>
                        <Sel value={editForm.timeOfDay} onChange={e=>setEditForm(f=>({...f,timeOfDay:e.target.value}))} style={{flex:1}}>
                          {["morning","afternoon","evening","anytime"].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                        </Sel>
                        <div style={{flex:1,display:"flex",gap:5,alignItems:"center"}}>
                          <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>Target/wk:</div>
                          <Inp type="number" value={editForm.target} onChange={e=>setEditForm(f=>({...f,target:Math.max(1,Math.min(7,parseInt(e.target.value)||1))}))} style={{width:50,padding:"6px 8px",fontSize:12}}/>
                        </div>
                      </div>
                      <div>
                        <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginBottom:6}}>Icon — tap to select</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:3,background:t.CARD2,borderRadius:7,padding:8,maxHeight:160,overflowY:"auto"}}>
                          {EMOJIS.map((e,ei)=>(
                            <button key={ei} onClick={()=>setEditForm(f=>({...f,icon:e}))} style={{background:editForm.icon===e?t.GOLD+"44":"transparent",border:"1.5px solid "+(editForm.icon===e?t.GOLD:"transparent"),borderRadius:6,padding:"4px 5px",cursor:"pointer",fontSize:20,lineHeight:1,transition:"all .15s"}}>
                              {e}
                            </button>
                          ))}
                        </div>
                        {editForm.icon&&<div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginTop:4}}>Selected: <span style={{fontSize:18}}>{editForm.icon}</span></div>}
                      </div>
                      <div>
                        <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginBottom:6}}>Colour:</div>
                        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                          {["#C9A84C","#7A9E7E","#7EB8C9","#B07EC9","#C97E7E","#D4956A","#7EC8A0","#C8D870"].map(col=>(
                            <div key={col} onClick={()=>setEditForm(f=>({...f,color:col}))} style={{width:26,height:26,borderRadius:"50%",background:col,border:"2px solid "+(editForm.color===col?"#fff":"transparent"),cursor:"pointer"}}/>
                          ))}
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
                      <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>30-Day History</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(10,1fr)",gap:3,marginBottom:8}}>
                        {last30.map((d,i)=>{
                          const done=!!habitLog[h.id+"_"+d];
                          const isT=d===todayStr();
                          return (
                            <div key={d} onClick={()=>tog(h.id,d)} title={d} style={{aspectRatio:"1",borderRadius:3,background:done?h.color+"88":t.CARD2,border:"1px solid "+(isT?h.color:done?h.color+"44":t.BORDER),cursor:"pointer"}}/>
                          );
                        })}
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                        <div style={{textAlign:"center",padding:"7px",background:t.CARD2,borderRadius:6}}>
                          <div style={{fontSize:16,color:h.color,fontFamily:"sans-serif",fontWeight:700}}>{streak}</div>
                          <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginTop:1}}>Streak</div>
                        </div>
                        <div style={{textAlign:"center",padding:"7px",background:t.CARD2,borderRadius:6}}>
                          <div style={{fontSize:16,color:h.color,fontFamily:"sans-serif",fontWeight:700}}>{last30.filter(d=>!!habitLog[h.id+"_"+d]).length}</div>
                          <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginTop:1}}>Last 30 days</div>
                        </div>
                        <div style={{textAlign:"center",padding:"7px",background:t.CARD2,borderRadius:6}}>
                          <div style={{fontSize:16,color:h.color,fontFamily:"sans-serif",fontWeight:700}}>{Math.round(last30.filter(d=>!!habitLog[h.id+"_"+d]).length/30*100)+"%"}</div>
                          <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginTop:1}}>30-day rate</div>
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
        <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"sans-serif"}}>
          <div style={{fontSize:32,marginBottom:10}}>🔥</div>
          <div>No habits yet - tap + Add to start</div>
        </div>
      )}
    </div>
  );
}

function GoalsPage({goals,setGoals,completed,setCompleted}){
  const t=T();
  const[filter,setFilter]=useState("all");
  const[showAdd,setShowAdd]=useState(false);
  const[expanded,setExpanded]=useState({});
  const[showDone,setShowDone]=useState(false);
  const[aiSuggs,setAiSuggs]=useState("");
  const[aiLoading,setAiLoading]=useState(false);
  const[form,setForm]=useState({title:"",category:"wealth",period:"year",targetDate:"",targetValue:"",currentValue:"",unit:"",notes:""});
  const[msForm,setMsForm]=useState({title:"",targetDate:"",goalId:null});
  const[showMsAdd,setShowMsAdd]=useState(null);
  const[actionForm,setActionForm]=useState({text:"",frequency:"weekly",milestoneId:null,goalId:null});
  const[showActionAdd,setShowActionAdd]=useState(null);
  const[confirmDeleteGoal,setConfirmDeleteGoal]=useState(null);

  const CATS=[
    {id:"wealth",label:"Wealth",color:"#C9A84C"},
    {id:"health",label:"Health",color:"#7A9E7E"},
    {id:"career",label:"Career",color:"#7EB8C9"},
    {id:"personal",label:"Personal",color:"#B07EC9"},
    {id:"education",label:"Education",color:"#D4956A"},
    {id:"relationships",label:"Relationships",color:"#C97E7E"},
  ];
  const catColor=id=>CATS.find(c=>c.id===id)?.color||t.GOLD;
  const catLabel=id=>CATS.find(c=>c.id===id)?.label||id;

  const allGoals=goals||[];
  const filtered=filter==="all"?allGoals:allGoals.filter(g=>g.category===filter);

  // Category ring stats
  const catStats=CATS.map(c=>{
    const cGoals=allGoals.filter(g=>g.category===c.id);
    const avg=cGoals.length?Math.round(cGoals.reduce((s,g)=>s+(g.progress||0),0)/cGoals.length):0;
    return{...c,count:cGoals.length,avg};
  }).filter(c=>c.count>0);

  const onTrack=allGoals.filter(g=>(g.progress||0)>=40).length;
  const behind=allGoals.filter(g=>(g.progress||0)<40).length;

  const toggleExpand=id=>setExpanded(x=>({...x,[id]:!x[id]}));

  const addGoal=()=>{
    if(!form.title.trim())return;
    setGoals(gs=>[...gs,{...form,id:Date.now(),progress:0,milestones:[],actions:[]}]);
    setForm({title:"",category:"wealth",period:"year",targetDate:"",targetValue:"",currentValue:"",unit:"",notes:""});
    setShowAdd(false);
  };

  const addMilestone=(goalId)=>{
    if(!msForm.title.trim())return;
    setGoals(gs=>gs.map(g=>g.id===goalId?{...g,milestones:[...(g.milestones||[]),{id:Date.now(),title:msForm.title,targetDate:msForm.targetDate,done:false,actions:[]}]}:g));
    setMsForm({title:"",targetDate:"",goalId:null});setShowMsAdd(null);
  };

  const addAction=(goalId,msId)=>{
    if(!actionForm.text.trim())return;
    const action={id:Date.now(),text:actionForm.text,frequency:actionForm.frequency,done:false};
    if(msId){
      setGoals(gs=>gs.map(g=>g.id!==goalId?g:{...g,milestones:(g.milestones||[]).map(m=>m.id!==msId?m:{...m,actions:[...(m.actions||[]),action]})}));
    }else{
      setGoals(gs=>gs.map(g=>g.id!==goalId?g:{...g,actions:[...(g.actions||[]),action]}));
    }
    setActionForm({text:"",frequency:"weekly",milestoneId:null,goalId:null});setShowActionAdd(null);
  };

  const toggleAction=(goalId,msId,actionId)=>{
    if(msId){
      setGoals(gs=>gs.map(g=>g.id!==goalId?g:{...g,milestones:(g.milestones||[]).map(m=>m.id!==msId?m:{...m,actions:(m.actions||[]).map(a=>a.id!==actionId?a:{...a,done:!a.done})})}));
    }else{
      setGoals(gs=>gs.map(g=>g.id!==goalId?g:{...g,actions:(g.actions||[]).map(a=>a.id!==actionId?a:{...a,done:!a.done})}));
    }
  };

  const toggleMilestone=(goalId,msId)=>{
    setGoals(gs=>gs.map(g=>g.id!==goalId?g:{...g,milestones:(g.milestones||[]).map(m=>m.id!==msId?m:{...m,done:!m.done})}));
  };

  const setProgress=(id,v)=>{
    const np=Math.max(0,Math.min(100,v));
    if(np>=100){const g=allGoals.find(x=>x.id===id);if(g){setGoals(gs=>gs.filter(x=>x.id!==id));setCompleted(cs=>[{...g,progress:100,completedAt:todayStr()},...(cs||[])]);}}
    else setGoals(gs=>gs.map(g=>g.id===id?{...g,progress:np}:g));
  };

  const getAiSuggestions=async()=>{
    setAiLoading(true);setAiSuggs("");
    try{
      const goalSummary=allGoals.map(g=>g.title+" ("+g.progress+"%"+" - "+g.category+")").join(", ");
      const r=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-haiku-4-5",max_tokens:600,messages:[{role:"user",content:"My goals: "+goalSummary+". Suggest 3 specific, actionable micro-actions I should take this week to make progress. For each: GOAL NAME | ACTION | FREQUENCY. Be direct and specific, not generic."}]})});
      const d=await r.json();
      setAiSuggs((d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n")||"Unable to generate.");
    }catch{setAiSuggs("Connection error.");}
    setAiLoading(false);
  };

  // Ring SVG helper
  const Ring=({pct,color,size=56})=>{
    const r=size*0.39,circ=2*Math.PI*r,offset=circ-(pct/100)*circ;
    return(
      <svg width={size} height={size} viewBox={"0 0 "+size+" "+size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={t.BORDER} strokeWidth={size*0.09}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={size*0.09} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"/>
      </svg>
    );
  };

  return (
    <div data-page="true" style={{maxWidth:720,margin:"0 auto"}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Targets & Milestones</div>
          <div style={{fontSize:26,color:t.TEXT}}>Goals</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginTop:3}}>{allGoals.length+" active - "+onTrack+" on track - "+behind+" behind"}</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {(completed||[]).length>0&&<button onClick={()=>setShowDone(s=>!s)} style={{background:t.CARD,border:"1px solid "+t.GOLD+"44",borderRadius:7,padding:"7px 12px",color:t.GOLD,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>{(completed||[]).length+" done"}</button>}
          <Btn onClick={()=>setShowAdd(s=>!s)}>+ Add</Btn>
        </div>
      </div>

      {/* Category rings overview */}
      {catStats.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat("+Math.min(catStats.length,4)+",1fr)",gap:10,marginBottom:16}}>
          {catStats.map(c=>(
            <div key={c.id} onClick={()=>setFilter(filter===c.id?"all":c.id)} style={{background:filter===c.id?c.color+"18":t.CARD,border:"1px solid "+(filter===c.id?c.color:t.BORDER),borderRadius:10,padding:"12px 8px",textAlign:"center",cursor:"pointer",transition:"all .2s"}}>
              <div style={{position:"relative",width:56,height:56,margin:"0 auto 8px"}}>
                <Ring pct={c.avg} color={c.color}/>
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:c.color,fontWeight:700}}>{c.avg+"%"}</div>
              </div>
              <div style={{fontSize:11,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600,marginBottom:2}}>{c.label}</div>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{c.count+" goal"+(c.count!==1?"s":"")}</div>
            </div>
          ))}
        </div>
      )}

      {/* Stats row */}
      {allGoals.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>
          {[{l:"Total",v:allGoals.length,c:t.GOLD},{l:"On Track",v:onTrack,c:t.GREEN},{l:"Behind",v:behind,c:t.RED},{l:"Completed",v:(completed||[]).length,c:t.BLUE}].map(s=>(
            <StatCard key={s.l} label={s.l} value={s.v} color={s.c}/>
          ))}
        </div>
      )}

      {/* AI Goal Coach */}
      <Card style={{marginBottom:16,borderColor:t.GOLD+"33"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:aiSuggs||aiLoading?12:0}}>
          <div>
            <div style={{fontSize:10,color:t.GOLD,fontFamily:"sans-serif",letterSpacing:1,textTransform:"uppercase"}}>AI Goal Coach</div>
            <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginTop:2}}>Personalised micro-actions based on your goals</div>
          </div>
          <button onClick={getAiSuggestions} disabled={aiLoading||!allGoals.length} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:7,padding:"6px 12px",color:t.GOLD,cursor:aiLoading||!allGoals.length?"default":"pointer",fontFamily:"sans-serif",fontSize:11,whiteSpace:"nowrap",opacity:!allGoals.length?.5:1}}>
            {aiLoading?"Thinking...":"Generate Actions"}
          </button>
        </div>
        {aiLoading&&<div style={{display:"flex",flexDirection:"column",gap:8}}>{[90,75,85].map((w,i)=><Skeleton key={i} width={w+"%"} height={12}/>)}</div>}
        {aiSuggs&&!aiLoading&&<div style={{fontSize:12,color:t.TEXT,lineHeight:1.85,fontFamily:"sans-serif",whiteSpace:"pre-wrap"}}>{aiSuggs}</div>}
      </Card>

      {/* Add goal form */}
      {showAdd&&(
        <Card style={{marginBottom:16,borderColor:t.GOLD+"44"}}>
          <SectionLabel>New Goal</SectionLabel>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Inp value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="What do you want to achieve?"/>
            <div style={{display:"flex",gap:8}}>
              <Sel value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{flex:1}}>
                {CATS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
              </Sel>
              <Sel value={form.period} onChange={e=>setForm(f=>({...f,period:e.target.value}))} style={{flex:1}}>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
                <option value="longterm">Long Term</option>
              </Sel>
            </div>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Target Value (optional)</div>
                <Inp value={form.targetValue} onChange={e=>setForm(f=>({...f,targetValue:e.target.value}))} placeholder="e.g. 3000000"/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Unit (optional)</div>
                <Inp value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))} placeholder="e.g. AUD, kg, books"/>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Target Date</div>
                <Inp type="date" value={form.targetDate} onChange={e=>setForm(f=>({...f,targetDate:e.target.value}))}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Current Value</div>
                <Inp value={form.currentValue} onChange={e=>setForm(f=>({...f,currentValue:e.target.value}))} placeholder="Starting point"/>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}><Btn onClick={addGoal}>Add Goal</Btn><Btn onClick={()=>setShowAdd(false)} variant="ghost">Cancel</Btn></div>
          </div>
        </Card>
      )}

      {/* Completed goals */}
      {showDone&&(completed||[]).length>0&&(
        <Card style={{marginBottom:16,borderColor:t.GREEN+"44"}}>
          <SectionLabel>Completed</SectionLabel>
          {(completed||[]).map((g,i)=>(
            <div key={g.id||i}>
              {i>0&&<Divider/>}
              <div style={{display:"flex",justifyContent:"space-between",padding:"7px 0"}}>
                <div>
                  <div style={{fontSize:12,color:t.MUTED,textDecoration:"line-through"}}>{g.title}</div>
                  <div style={{fontSize:9,color:t.GREEN,fontFamily:"sans-serif",marginTop:2}}>Completed {g.completedAt}</div>
                </div>
                <div style={{fontSize:16,color:t.GREEN}}>V</div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Filter pills */}
      {catStats.length>1&&(
        <div style={{display:"flex",gap:7,overflowX:"auto",marginBottom:16,scrollbarWidth:"none"}}>
          {[{id:"all",label:"All"},...CATS].filter(c=>c.id==="all"||allGoals.some(g=>g.category===c.id)).map(c=>(
            <button key={c.id} onClick={()=>setFilter(c.id)} style={{flexShrink:0,padding:"5px 13px",borderRadius:16,border:"1px solid "+(filter===c.id?catColor(c.id):t.BORDER),background:filter===c.id?catColor(c.id)+"22":"transparent",color:filter===c.id?catColor(c.id):t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Goals list */}
      {filtered.map(g=>{
        const col=catColor(g.category);
        const isExpanded=!!expanded[g.id];
        const milestones=g.milestones||[];
        const actions=g.actions||[];
        const allActions=[...actions,...milestones.flatMap(m=>m.actions||[])];
        const doneActions=allActions.filter(a=>a.done).length;
        const doneMilestones=milestones.filter(m=>m.done).length;
        return (
          <div key={g.id} style={{marginBottom:12}}>
            <Card style={{borderLeft:"3px solid "+col,padding:0,overflow:"hidden"}}>
              {/* Goal header */}
              <div style={{padding:"14px 16px",cursor:"pointer"}} onClick={()=>toggleExpand(g.id)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div style={{flex:1,marginRight:12}}>
                    <div style={{fontSize:14,color:t.TEXT,fontWeight:600,marginBottom:4}}>{g.title}</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontSize:9,color:col,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,background:col+"18",padding:"2px 7px",borderRadius:9}}>{catLabel(g.category)}</span>
                      <span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",background:t.CARD2,padding:"2px 7px",borderRadius:9}}>{g.period==="longterm"?"Long Term":g.period==="year"?"Annual":g.period==="month"?"Monthly":"This Week"}</span>
                      {g.targetDate&&<span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{g.targetDate}</span>}
                      {allActions.length>0&&<span style={{fontSize:9,color:doneActions===allActions.length?t.GREEN:t.MUTED,fontFamily:"sans-serif"}}>{doneActions+"/"+allActions.length+" actions"}</span>}
                      {milestones.length>0&&<span style={{fontSize:9,color:doneMilestones===milestones.length?t.GREEN:t.MUTED,fontFamily:"sans-serif"}}>{doneMilestones+"/"+milestones.length+" milestones"}</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                    <div style={{position:"relative",width:44,height:44}}>
                      {(()=>{const r=18,circ=2*Math.PI*r,offset=circ-((g.progress||0)/100)*circ;return(<svg width={44} height={44} viewBox="0 0 44 44" style={{transform:"rotate(-90deg)"}}><circle cx={22} cy={22} r={r} fill="none" stroke={t.BORDER} strokeWidth={4}/><circle cx={22} cy={22} r={r} fill="none" stroke={col} strokeWidth={4} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"/></svg>);})()}
                      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:col,fontWeight:700}}>{g.progress||0+"%"}</div>
                    </div>
                    <div style={{fontSize:12,color:t.MUTED}}>{isExpanded?"^":"v"}</div>
                  </div>
                </div>
                {/* Progress bar */}
                <PB value={g.progress||0} color={col} height={4}/>
                {(g.targetValue||g.currentValue)&&(
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                    <span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>
                      {g.currentValue?(g.currentValue+(g.unit?" "+g.unit:"")):"--"}
                    </span>
                    {g.targetValue&&(
                      <span style={{fontSize:9,color:col,fontFamily:"sans-serif"}}>
                        {g.targetValue+(g.unit?" "+g.unit+"  target":"  target")}
                      </span>
                    )}
                  </div>
                )}
                {milestones.length>0&&(
                  <div style={{marginTop:4,fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>
                    {doneMilestones+"/"+milestones.length+" milestones complete"}
                  </div>
                )}
              </div>

              {/* Expanded content */}
              {isExpanded&&(
                <div style={{borderTop:"1px solid "+t.BORDER}}>
                  {/* Smart progress controls */}
                  <div style={{padding:"12px 16px",borderBottom:"1px solid "+t.BORDER}}>
                    {/* Auto from milestones */}
                    {milestones.length>0&&(
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                        <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>Progress auto-calculated from milestones</div>
                        <div style={{display:"flex",gap:6}}>
                          <button onClick={()=>{const p=milestones.length?Math.round(doneMilestones/milestones.length*100):0;setProgress(g.id,p);}} style={{background:col+"18",border:"1px solid "+col+"33",borderRadius:5,padding:"3px 9px",color:col,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>Sync</button>
                          {confirmDeleteGoal===g.id?(
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        <span style={{fontSize:10,color:t.RED,fontFamily:"sans-serif"}}>Delete?</span>
                        <button onClick={()=>{setGoals(gs=>gs.filter(x=>x.id!==g.id));setConfirmDeleteGoal(null);}} style={{background:t.RED+"22",border:"1px solid "+t.RED+"44",borderRadius:5,padding:"2px 7px",color:t.RED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>Yes</button>
                        <button onClick={()=>setConfirmDeleteGoal(null)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:5,padding:"2px 7px",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>No</button>
                      </div>
                    ):(
                      <button onClick={()=>setConfirmDeleteGoal(g.id)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.5}}>X</button>
                    )}
                        </div>
                      </div>
                    )}
                    {/* Numeric update if targetValue set */}
                    {g.targetValue&&!milestones.length&&(
                      <div style={{marginBottom:8}}>
                        <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginBottom:6}}>Update current value to recalculate progress</div>
                        <div style={{display:"flex",gap:7,alignItems:"center"}}>
                          <Inp
                            type="number"
                            defaultValue={g.currentValue||""}
                            onBlur={e=>{
                              const cur=parseFloat(e.target.value)||0;
                              const target=parseFloat(g.targetValue)||1;
                              const pct=Math.min(Math.round(cur/target*100),100);
                              setGoals(gs=>gs.map(x=>x.id===g.id?{...x,currentValue:String(cur),progress:pct}:x));
                            }}
                            placeholder={"Current "+(g.unit||"value")}
                            style={{flex:1,fontSize:12,padding:"6px 10px"}}
                          />
                          {g.unit&&<span style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",flexShrink:0}}>{g.unit}</span>}
                          <span style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",flexShrink:0}}>{"of "+(g.targetValue)+(g.unit?" "+g.unit:"")}</span>
                          {confirmDeleteGoal===g.id?(
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        <span style={{fontSize:10,color:t.RED,fontFamily:"sans-serif"}}>Delete?</span>
                        <button onClick={()=>{setGoals(gs=>gs.filter(x=>x.id!==g.id));setConfirmDeleteGoal(null);}} style={{background:t.RED+"22",border:"1px solid "+t.RED+"44",borderRadius:5,padding:"2px 7px",color:t.RED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>Yes</button>
                        <button onClick={()=>setConfirmDeleteGoal(null)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:5,padding:"2px 7px",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>No</button>
                      </div>
                    ):(
                      <button onClick={()=>setConfirmDeleteGoal(g.id)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.5}}>X</button>
                    )}
                        </div>
                      </div>
                    )}
                    {/* Fallback slider for non-numeric, no-milestone goals */}
                    {!g.targetValue&&!milestones.length&&(
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",flexShrink:0}}>{g.progress||0+"%"}</span>
                        <input type="range" min={0} max={100} value={g.progress||0} onChange={e=>setProgress(g.id,parseInt(e.target.value))} style={{flex:1,accentColor:col}}/>
                        <button onClick={()=>setProgress(g.id,100)} style={{background:t.GREEN+"18",border:"1px solid "+t.GREEN+"44",borderRadius:5,padding:"3px 9px",color:t.GREEN,cursor:"pointer",fontSize:10,fontFamily:"sans-serif",flexShrink:0}}>Done</button>
                        {confirmDeleteGoal===g.id?(
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        <span style={{fontSize:10,color:t.RED,fontFamily:"sans-serif"}}>Delete?</span>
                        <button onClick={()=>{setGoals(gs=>gs.filter(x=>x.id!==g.id));setConfirmDeleteGoal(null);}} style={{background:t.RED+"22",border:"1px solid "+t.RED+"44",borderRadius:5,padding:"2px 7px",color:t.RED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>Yes</button>
                        <button onClick={()=>setConfirmDeleteGoal(null)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:5,padding:"2px 7px",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>No</button>
                      </div>
                    ):(
                      <button onClick={()=>setConfirmDeleteGoal(g.id)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.5}}>X</button>
                    )}
                      </div>
                    )}
                  </div>

                  {/* Milestones */}
                  {milestones.length>0&&(
                    <div style={{padding:"12px 16px",borderBottom:"1px solid "+t.BORDER}}>
                      <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Milestones</div>
                      {milestones.map((ms,mi)=>(
                        <div key={ms.id} style={{marginBottom:12}}>
                          <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                            <div onClick={()=>toggleMilestone(g.id,ms.id)} style={{width:22,height:22,borderRadius:"50%",border:"1.5px solid "+(ms.done?col:t.BORDER),background:ms.done?col:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",marginTop:1}}>
                              {ms.done&&<span style={{fontSize:9,color:t.BG,fontWeight:700}}>V</span>}
                            </div>
                            <div style={{flex:1}}>
                              <div style={{fontSize:12,color:ms.done?t.MUTED:t.TEXT,textDecoration:ms.done?"line-through":"none",marginBottom:2}}>{ms.title}</div>
                              {ms.targetDate&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{ms.targetDate}</div>}
                              {/* Milestone actions */}
                              {(ms.actions||[]).length>0&&(
                                <div style={{marginTop:8,paddingLeft:4}}>
                                  {(ms.actions||[]).map(a=>(
                                    <div key={a.id} onClick={()=>toggleAction(g.id,ms.id,a.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",cursor:"pointer",borderBottom:"1px solid "+t.BORDER+"88"}}>
                                      <div style={{width:14,height:14,borderRadius:3,border:"1px solid "+(a.done?col:t.BORDER),background:a.done?col:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                        {a.done&&<span style={{fontSize:8,color:t.BG,fontWeight:700}}>V</span>}
                                      </div>
                                      <span style={{fontSize:11,color:a.done?t.MUTED:t.TEXT,fontFamily:"sans-serif",textDecoration:a.done?"line-through":"none",flex:1}}>{a.text}</span>
                                      <span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",flexShrink:0}}>{a.frequency}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {showActionAdd===ms.id&&(
                                <div style={{marginTop:8,display:"flex",gap:6}}>
                                  <Inp value={actionForm.text} onChange={e=>setActionForm(f=>({...f,text:e.target.value}))} placeholder="Action..." style={{flex:2,fontSize:11,padding:"5px 8px"}}/>
                                  <Sel value={actionForm.frequency} onChange={e=>setActionForm(f=>({...f,frequency:e.target.value}))} style={{flex:1,fontSize:11,padding:"5px 7px"}}>
                                    <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="once">Once</option>
                                  </Sel>
                                  <button onClick={()=>addAction(g.id,ms.id)} style={{background:col+"22",border:"1px solid "+col+"44",borderRadius:5,padding:"5px 9px",color:col,cursor:"pointer",fontSize:11}}>+</button>
                                </div>
                              )}
                              <button onClick={()=>setShowActionAdd(showActionAdd===ms.id?null:ms.id)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif",padding:"4px 0",display:"block",marginTop:4}}>
                                {showActionAdd===ms.id?"Cancel":"+ Add action"}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Goal-level actions (no milestone) */}
                  {actions.length>0&&(
                    <div style={{padding:"12px 16px",borderBottom:"1px solid "+t.BORDER}}>
                      <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Actions</div>
                      {actions.map(a=>(
                        <div key={a.id} onClick={()=>toggleAction(g.id,null,a.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",cursor:"pointer",borderBottom:"1px solid "+t.BORDER+"66"}}>
                          <div style={{width:16,height:16,borderRadius:3,border:"1px solid "+(a.done?col:t.BORDER),background:a.done?col:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                            {a.done&&<span style={{fontSize:9,color:t.BG,fontWeight:700}}>V</span>}
                          </div>
                          <span style={{fontSize:12,color:a.done?t.MUTED:t.TEXT,fontFamily:"sans-serif",textDecoration:a.done?"line-through":"none",flex:1}}>{a.text}</span>
                          <span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",flexShrink:0}}>{a.frequency}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add milestone / action buttons */}
                  <div style={{padding:"10px 16px",display:"flex",gap:8,flexWrap:"wrap"}}>
                    <button onClick={()=>setShowMsAdd(showMsAdd===g.id?null:g.id)} style={{background:col+"18",border:"1px solid "+col+"33",borderRadius:6,padding:"5px 11px",color:col,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>+ Milestone</button>
                    <button onClick={()=>setShowActionAdd(showActionAdd===g.id?null:g.id)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:6,padding:"5px 11px",color:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>+ Action</button>
                  </div>

                  {showMsAdd===g.id&&(
                    <div style={{padding:"0 16px 14px",display:"flex",gap:7}}>
                      <Inp value={msForm.title} onChange={e=>setMsForm(f=>({...f,title:e.target.value}))} placeholder="Milestone..." style={{flex:2,fontSize:12}}/>
                      <Inp type="date" value={msForm.targetDate} onChange={e=>setMsForm(f=>({...f,targetDate:e.target.value}))} style={{flex:1,fontSize:12}}/>
                      <button onClick={()=>addMilestone(g.id)} style={{background:col+"22",border:"1px solid "+col+"44",borderRadius:6,padding:"8px 12px",color:col,cursor:"pointer",fontSize:12}}>Add</button>
                    </div>
                  )}
                  {showActionAdd===g.id&&(
                    <div style={{padding:"0 16px 14px",display:"flex",gap:7}}>
                      <Inp value={actionForm.text} onChange={e=>setActionForm(f=>({...f,text:e.target.value}))} placeholder="Action..." style={{flex:2,fontSize:12}}/>
                      <Sel value={actionForm.frequency} onChange={e=>setActionForm(f=>({...f,frequency:e.target.value}))} style={{flex:1,fontSize:12}}>
                        <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="once">Once</option>
                      </Sel>
                      <button onClick={()=>addAction(g.id,null)} style={{background:col+"22",border:"1px solid "+col+"44",borderRadius:6,padding:"8px 12px",color:col,cursor:"pointer",fontSize:12}}>Add</button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        );
      })}

      {!filtered.length&&(
        <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"sans-serif"}}>
          <div style={{fontSize:32,marginBottom:12}}>O</div>
          <div style={{fontSize:14,marginBottom:8}}>{filter==="all"?"No goals yet":"No "+filter+" goals"}</div>
          <div style={{fontSize:12}}>Tap + Add to set your first goal</div>
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
          <button onClick={()=>{setViewing(null);setEditingId(null);}} style={{background:"none",border:"none",color:t.GOLD,cursor:"pointer",fontFamily:"sans-serif",fontSize:13}}>Back</button>
          <div style={{display:"flex",gap:8}}>
            {editingId!==entry.id&&<button onClick={()=>openEdit(entry)} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:6,padding:"5px 12px",color:t.GOLD,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>Edit</button>}
            {confirmDel===entry.id?(
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:11,color:t.RED,fontFamily:"sans-serif"}}>Delete?</span>
                <button onClick={()=>{setEntries(es=>(es||[]).filter(x=>x.id!==entry.id));setViewing(null);setConfirmDel(null);}} style={{background:t.RED+"22",border:"1px solid "+t.RED+"44",borderRadius:5,padding:"3px 8px",color:t.RED,cursor:"pointer",fontSize:11,fontFamily:"sans-serif"}}>Yes</button>
                <button onClick={()=>setConfirmDel(null)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:5,padding:"3px 8px",color:t.MUTED,cursor:"pointer",fontSize:11,fontFamily:"sans-serif"}}>No</button>
              </div>
            ):(
              <button onClick={()=>setConfirmDel(entry.id)} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:6,padding:"5px 10px",color:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11,opacity:.7}}>Delete</button>
            )}
          </div>
        </div>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif"}}>{entry.date}{entry.date===td&&<span style={{color:t.GOLD,marginLeft:6}}>Today</span>}</div>
            {entry.updatedAt&&entry.updatedAt!==entry.date&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>Edited {entry.updatedAt}</div>}
          </div>
          {editingId===entry.id?(
            <div>
              <div style={{display:"flex",gap:5,marginBottom:10}}>
                {MOODS.map(m=><button key={m.v} onClick={()=>setEditMood(m.v)} style={{flex:1,padding:"6px 2px",borderRadius:6,border:"1px solid "+(editMood===m.v?m.c:t.BORDER),background:editMood===m.v?m.c+"22":"transparent",color:editMood===m.v?m.c:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>{m.l}</button>)}
              </div>
              <textarea value={editText} onChange={e=>setEditText(e.target.value)} rows={12} style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"10px 12px",color:t.TEXT,fontFamily:"Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.85,boxSizing:"border-box"}}/>
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <Btn onClick={()=>saveEdit(entry.id)}>Save Changes</Btn>
                <Btn onClick={()=>setEditingId(null)} variant="ghost">Cancel</Btn>
              </div>
            </div>
          ):(
            <div>
              <div style={{display:"flex",gap:5,marginBottom:14}}>
                {MOODS.map(m=><div key={m.v} style={{padding:"3px 9px",borderRadius:10,background:entry.mood===m.v?m.c+"33":"transparent",border:"1px solid "+(entry.mood===m.v?m.c:t.BORDER),fontSize:10,color:entry.mood===m.v?m.c:t.MUTED,fontFamily:"sans-serif"}}>{m.l}</div>)}
              </div>
              <div style={{fontSize:14,color:t.TEXT,lineHeight:1.85,whiteSpace:"pre-wrap",fontFamily:"Georgia,serif"}}>{entry.text}</div>
              {/* Append note */}
              {entry.date===td&&(
                appending?(
                  <div style={{marginTop:16,borderTop:"1px solid "+t.BORDER,paddingTop:14}}>
                    <div style={{fontSize:9,color:t.GOLD,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Add to today's entry</div>
                    <textarea value={appendText} onChange={e=>setAppendText(e.target.value)} placeholder="Continue writing..." rows={5} style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"10px 12px",color:t.TEXT,fontFamily:"Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.85,boxSizing:"border-box"}}/>
                    <div style={{display:"flex",gap:8,marginTop:8}}>
                      <Btn onClick={appendToToday}>Append</Btn>
                      <Btn onClick={()=>{setAppending(false);setAppendText("");}} variant="ghost">Cancel</Btn>
                    </div>
                  </div>
                ):(
                  <button onClick={()=>setAppending(true)} style={{marginTop:14,background:t.GOLD+"14",border:"1px solid "+t.GOLD+"33",borderRadius:7,padding:"7px 14px",color:t.GOLD,cursor:"pointer",fontFamily:"sans-serif",fontSize:11,width:"100%"}}>+ Add to this entry</button>
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
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Private Thoughts</div>
          <div style={{fontSize:26,color:t.TEXT}}>Journal</div>
        </div>
        <Btn onClick={()=>setShowNew(s=>!s)}>+ Write</Btn>
      </div>

      {/* Today's entry prompt */}
      {!todayEntry&&!showNew&&(
        <div onClick={()=>setShowNew(true)} style={{background:t.GOLD+"08",border:"1px dashed "+t.GOLD+"44",borderRadius:9,padding:14,cursor:"pointer",textAlign:"center",marginBottom:14}}>
          <div style={{fontSize:12,color:t.GOLD,fontFamily:"sans-serif",marginBottom:4}}>Today's entry is empty</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",fontStyle:"italic"}}>{"\""+JP[new Date().getDate()%JP.length]+"\""}</div>
        </div>
      )}

      {/* Today entry exists - quick actions */}
      {todayEntry&&!showNew&&(
        <Card style={{marginBottom:14,borderColor:t.GOLD+"33"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:9,color:t.GOLD,fontFamily:"sans-serif",letterSpacing:2,textTransform:"uppercase"}}>Today</span>
              <span style={{fontSize:10,color:MOODS.find(m=>m.v===todayEntry.mood)?.c||t.MUTED,fontFamily:"sans-serif"}}>{MOODS.find(m=>m.v===todayEntry.mood)?.l}</span>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>{setViewing(todayEntry.id);setAppending(true);}} style={{background:t.GOLD+"14",border:"1px solid "+t.GOLD+"33",borderRadius:6,padding:"4px 10px",color:t.GOLD,cursor:"pointer",fontFamily:"sans-serif",fontSize:10}}>+ Add</button>
              <button onClick={()=>openEdit(todayEntry)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:6,padding:"4px 10px",color:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:10}}>Edit</button>
              <button onClick={()=>setViewing(todayEntry.id)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:6,padding:"4px 10px",color:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:10}}>Read</button>
            </div>
          </div>
          <div style={{fontSize:12,color:t.MUTED,fontFamily:"sans-serif",lineHeight:1.65,overflow:"hidden",maxHeight:48}}>{todayEntry.text.slice(0,140)+(todayEntry.text.length>140?"...":"")}</div>
          {/* Inline append */}
          {appending&&(
            <div style={{marginTop:12,borderTop:"1px solid "+t.BORDER,paddingTop:12}}>
              <div style={{fontSize:9,color:t.GOLD,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Add to today</div>
              <textarea value={appendText} onChange={e=>setAppendText(e.target.value)} placeholder="Continue writing..." rows={4} style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"10px 12px",color:t.TEXT,fontFamily:"Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.85,boxSizing:"border-box"}}/>
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
                {MOODS.map(m=><button key={m.v} onClick={()=>setEditMood(m.v)} style={{flex:1,padding:"5px 2px",borderRadius:6,border:"1px solid "+(editMood===m.v?m.c:t.BORDER),background:editMood===m.v?m.c+"22":"transparent",color:editMood===m.v?m.c:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>{m.l}</button>)}
              </div>
              <textarea value={editText} onChange={e=>setEditText(e.target.value)} rows={8} style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"10px 12px",color:t.TEXT,fontFamily:"Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.85,boxSizing:"border-box"}}/>
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
          <div style={{fontSize:9,color:t.GOLD,fontFamily:"sans-serif",letterSpacing:2,marginBottom:4}}>{td}</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",fontStyle:"italic",marginBottom:10}}>{"\""+JP[new Date().getDate()%JP.length]+"\""}</div>
          <div style={{display:"flex",gap:5,marginBottom:10}}>
            {MOODS.map(m=><button key={m.v} onClick={()=>setMood(m.v)} style={{flex:1,padding:"6px 2px",borderRadius:6,border:"1px solid "+(mood===m.v?m.c:t.BORDER),background:mood===m.v?m.c+"22":"transparent",color:mood===m.v?m.c:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>{m.l}</button>)}
          </div>
          <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Write freely..." rows={7} style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"10px 12px",color:t.TEXT,fontFamily:"Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.85,boxSizing:"border-box"}}/>
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
              style={{width:"100%",background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:8,padding:"8px 12px 8px 32px",color:t.TEXT,fontFamily:"sans-serif",fontSize:12,outline:"none",boxSizing:"border-box"}}
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
            <div style={{fontSize:11,color:t.TEXT,fontFamily:"sans-serif"}}>{entry.date}</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:10,color:MOODS.find(m=>m.v===entry.mood)?.c||t.MUTED,fontFamily:"sans-serif"}}>{MOODS.find(m=>m.v===entry.mood)?.l}</span>
              <button onClick={ev=>{ev.stopPropagation();setConfirmDel(entry.id);}} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.5}}>X</button>
            </div>
          </div>
          {confirmDel===entry.id&&(
            <div onClick={e=>e.stopPropagation()} style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
              <span style={{fontSize:11,color:t.RED,fontFamily:"sans-serif"}}>Delete this entry?</span>
              <button onClick={()=>{setEntries(es=>(es||[]).filter(x=>x.id!==entry.id));setConfirmDel(null);}} style={{background:t.RED+"22",border:"1px solid "+t.RED+"44",borderRadius:5,padding:"2px 7px",color:t.RED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>Yes</button>
              <button onClick={()=>setConfirmDel(null)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:5,padding:"2px 7px",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>No</button>
            </div>
          )}
          {/* Highlight search match */}
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",lineHeight:1.6,overflow:"hidden",maxHeight:34}}>
            {entry.text.slice(0,100)+(entry.text.length>100?"...":"")}
          </div>
        </Card>
      ))}

      {pastEntries.length===0&&(entries||[]).length>1&&(
        <div style={{textAlign:"center",padding:32,color:t.MUTED,fontFamily:"sans-serif"}}>
          <div style={{fontSize:13,marginBottom:6}}>No entries match</div>
          <button onClick={()=>{setSearch("");setMoodFilter("all");}} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:6,padding:"5px 12px",color:t.MUTED,cursor:"pointer",fontSize:11,fontFamily:"sans-serif"}}>Clear filters</button>
        </div>
      )}

      {!(entries||[]).length&&<div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"sans-serif"}}><div style={{fontSize:32,marginBottom:10}}>J</div><div>No entries yet</div></div>}
    </div>
  );
}

function WealthPage({profile,nwHistory,setShowRecalibrate,holdings,setHoldings,portfolio,cryptoHoldings,setCryptoHoldings,cryptoPortfolio}){
  const t=T();
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
    {type:"crypto",value:parseFloat(profile.cryptoValue)||0}
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
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Wealth Overview</div>
          <div style={{display:"flex",alignItems:"baseline",gap:10}}>
            <div style={{fontSize:32,color:t.GOLD,fontFamily:"sans-serif",fontWeight:700}}>{fmt(nw)}</div>
            {safeH.length>0&&sP.totalGain!==0&&<span style={{fontSize:12,color:sP.totalGain>=0?t.GREEN:t.RED,fontFamily:"sans-serif"}}>{(sP.totalGain>=0?"+ ":"- ")+fmt(Math.abs(sP.totalGain))+" gain"}</span>}
          </div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginTop:3}}>{"Target: "+fmt(nwT)}</div>
        </div>
        <button onClick={()=>setShowRecalibrate(true)} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:7,padding:"7px 12px",color:t.GOLD,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>Recalibrate</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <Card>
          <SectionLabel>Net Worth History</SectionLabel>
          <SparkLine data={nwVals} color={t.GOLD} height={60} labels={nwLabels2}/>
          <div style={{marginTop:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{Math.min(Math.round(nw/nwT*100),100)+"% of target"}</span>
              <span style={{fontSize:9,color:t.GOLD,fontFamily:"sans-serif"}}>{fmt(nwT-nw)+" to go"}</span>
            </div>
            <PB value={Math.min(Math.round(nw/nwT*100),100)} color={t.GOLD} height={4}/>
          </div>
        </Card>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <Card style={{padding:"12px 14px"}}>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>Net Equity Breakdown</div>
            {[
              {l:"Property",asset:parseFloat(profile.propertyValue)||0,debt:parseFloat(profile.mortgageDebt)||0,c:"#7A9E7E"},
              {l:"Shares",asset:parseFloat(profile.shareValue)||0,debt:parseFloat(profile.investLoanDebt)||0,c:t.GOLD},
              {l:"Super",asset:parseFloat(profile.superBalance)||0,debt:0,c:t.BLUE},
              {l:"Cash",asset:parseFloat(profile.cashSavings)||0,debt:parseFloat(profile.creditCardDebt)||0+parseFloat(profile.personalDebt)||0,c:"#7EB8C9"},
              {l:"Crypto",asset:parseFloat(profile.cryptoValue)||0,debt:0,c:t.PURPLE},
              {l:"Car / Other",asset:0,debt:parseFloat(profile.carDebt)||0,c:t.RED},
            ].filter(r=>r.asset>0||r.debt>0).map(r=>{
              const equity=r.asset-r.debt;
              return (
                <div key={r.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid "+t.BORDER}}>
                  <div style={{display:"flex",alignItems:"center",gap:7}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:r.c,flexShrink:0}}/>
                    <span style={{fontSize:11,color:t.TEXT,fontFamily:"sans-serif"}}>{r.l}</span>
                    {r.debt>0&&<span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{"(-"+fmt(r.debt)+")"}</span>}
                  </div>
                  <span style={{fontSize:12,color:equity>=0?t.GREEN:t.RED,fontFamily:"sans-serif",fontWeight:600}}>{(equity>=0?"+":"")+fmt(equity)}</span>
                </div>
              );
            })}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:8,marginTop:4}}>
              <span style={{fontSize:11,color:t.TEXT,fontFamily:"sans-serif",fontWeight:700}}>Net Worth</span>
              <span style={{fontSize:14,color:t.GOLD,fontFamily:"sans-serif",fontWeight:700}}>{fmt(nw)}</span>
            </div>
          </Card>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <StatCard label="Annual Income" value={fmt(parseFloat(profile.annualIncome)||0)} color={t.GOLD}/>
            
          </div>
        </div>
      </div>
      <Card style={{marginBottom:14}}>
        <SectionLabel action={
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {safeH.length>0&&sP.lastUpdated&&<span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{sP.lastUpdated.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>}
            {safeH.length>0&&<button onClick={sP.refresh} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"33",borderRadius:4,padding:"2px 6px",color:t.GOLD,cursor:"pointer",fontSize:10}}>Refresh</button>}
            <button onClick={()=>setShowAdd(s=>!s)} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:6,padding:"3px 8px",color:t.GOLD,cursor:"pointer",fontSize:10}}>+ Add</button>
          </div>
        }>Share Portfolio - Live</SectionLabel>
        {showAdd&&(
          <div style={{padding:12,background:t.CARD2,borderRadius:7,border:"1px solid "+t.BORDER,marginBottom:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:7,marginBottom:7}}>
              {[["Ticker","ticker","BHP.AX"],["Shares","shares","100"],["Avg Cost","avgCost","45.20"],["Label","name","BHP Group"]].map(([l,k,ph])=>(
                <div key={k}>
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>{l}</div>
                  <Inp value={hForm[k]} onChange={e=>setHForm(f=>({...f,[k]:e.target.value}))} placeholder={ph} style={{fontSize:12,padding:"7px 9px"}}/>
                </div>
              ))}
            </div>
            <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginBottom:7}}>ASX: use .AX suffix (BHP.AX, CBA.AX) - US: ticker only (AAPL, TSLA)</div>
            <div style={{display:"flex",gap:7}}><Btn onClick={addH} style={{fontSize:11}}>Add</Btn><Btn onClick={()=>setShowAdd(false)} variant="ghost" style={{fontSize:11}}>Cancel</Btn></div>
          </div>
        )}
        {!safeH.length&&!showAdd&&(
          <div style={{textAlign:"center",padding:"20px 0",color:t.MUTED,fontFamily:"sans-serif"}}>
            <div style={{fontSize:28,marginBottom:8}}>$</div>
            <div style={{fontSize:12,color:t.TEXT,marginBottom:4}}>No holdings yet</div>
            <div style={{fontSize:11}}>Add stocks to track live prices</div>
          </div>
        )}
        {safeH.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
            {[
              {l:"Portfolio Value",v:fmt(sP.totalValue||0),c:t.GOLD},
              {l:"Total Gain",v:(sP.totalGain>=0?"+":"")+fmt(sP.totalGain||0),c:(sP.totalGain||0)>=0?t.GREEN:t.RED},
              {l:"Return",v:(sP.totalGainPct>=0?"+":"")+((sP.totalGainPct||0).toFixed(1))+"%",c:(sP.totalGainPct||0)>=0?t.GREEN:t.RED},
            ].map(s=>(
              <div key={s.l} style={{background:t.CARD2,borderRadius:6,padding:"7px 8px",textAlign:"center"}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginBottom:2}}>{s.l}</div>
                <div style={{fontSize:13,color:s.c,fontFamily:"sans-serif",fontWeight:700}}>{s.v}</div>
              </div>
            ))}
          </div>
        )}
        {safeH.length>0&&(
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{sP.loading?"Fetching live prices...":sP.lastUpdated?"Updated "+sP.lastUpdated.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"No prices yet"}</div>
            <button onClick={sP.refresh} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"33",borderRadius:4,padding:"2px 8px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>Refresh</button>
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
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:7,marginBottom:7}}>
                    {[["Ticker","ticker",h.ticker],["Shares","shares",h.shares],["Avg Cost","avgCost",h.avgCost||""],["Label","name",h.name]].map(([l,k,def])=>(
                      <div key={k}>
                        <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>{l}</div>
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
                      {h.name!==h.ticker&&<span style={{fontSize:11,color:t.TEXT,fontFamily:"sans-serif"}}>{h.name}</span>}
                      <span style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{h.shares.toLocaleString()+" shares"}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      {livePrice?(
                        <>
                          <span style={{fontSize:11,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>{"$"+livePrice.toFixed(2)}</span>
                          {liveData.pct!==0&&<span style={{fontSize:10,color:liveData.pct>=0?t.GREEN:t.RED,fontFamily:"sans-serif"}}>{(liveData.pct>=0?"+":"")+((liveData.pct)||0).toFixed(2)+"%"}</span>}
                          {dayChange!==null&&<span style={{fontSize:10,color:dayChange>=0?t.GREEN:t.RED,fontFamily:"sans-serif"}}>{"("+(dayChange>=0?"+":"")+fmt(dayChange)+" today)"}</span>}
                        </>
                      ):(
                        <span style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{sP.loading?"Loading...":"No live price"}</span>
                      )}
                      {h.avgCost&&<span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{"avg $"+(parseFloat(h.avgCost)||0).toFixed(2)}</span>}
                    </div>
                    {gain!==null&&(
                      <div style={{marginTop:2}}>
                        <span style={{fontSize:10,color:gain>=0?t.GREEN:t.RED,fontFamily:"sans-serif",fontWeight:600}}>{(gain>=0?"+ ":"- ")+fmt(Math.abs(gain))+" ("+(gainPct>=0?"+":"")+(gainPct||0).toFixed(1)+"%)"}</span>
                      </div>
                    )}
                  </div>
                  <div style={{textAlign:"right",marginLeft:10}}>
                    {lv&&<div style={{fontSize:14,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>{fmt(lv)}</div>}
                    {h.avgCost&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{"cost "+fmt(cb||0)}</div>}
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
            {(cryptoHoldings||[]).length>0&&cryptoPortfolio?.lastUpdated&&<span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{cryptoPortfolio.lastUpdated.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>}
            {(cryptoHoldings||[]).length>0&&<button onClick={cryptoPortfolio?.refresh} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"33",borderRadius:4,padding:"2px 6px",color:t.GOLD,cursor:"pointer",fontSize:10}}>Refresh</button>}
            <button onClick={()=>setShowCryptoAdd(s=>!s)} style={{background:t.PURPLE+"18",border:"1px solid "+t.PURPLE+"44",borderRadius:6,padding:"3px 8px",color:t.PURPLE,cursor:"pointer",fontSize:10}}>+ Add</button>
          </div>
        }>Crypto Portfolio - Live</SectionLabel>
        {showCryptoAdd&&(
          <div style={{padding:12,background:t.CARD2,borderRadius:7,border:"1px solid "+t.BORDER,marginBottom:12}}>
            {!cSelected?(
              <>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Select Coin</div>
                <Inp value={cSearch} onChange={e=>setCSearch(e.target.value)} placeholder="Filter coins..." style={{marginBottom:8,fontSize:12}}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,maxHeight:200,overflowY:"auto"}}>
                  {POPULAR_COINS.filter(c=>!cSearch||c.name.toLowerCase().includes(cSearch.toLowerCase())||c.ticker.toLowerCase().includes(cSearch.toLowerCase())).map(coin=>(
                    <div key={coin.ticker} onClick={()=>setCSelected(coin)} style={{display:"flex",alignItems:"center",gap:7,padding:"7px 9px",background:t.CARD,borderRadius:6,border:"1px solid "+t.BORDER,cursor:"pointer"}}>
                      <div style={{width:28,height:28,borderRadius:"50%",background:t.PURPLE+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:t.PURPLE,fontWeight:700,flexShrink:0}}>{coin.ticker.slice(0,3)}</div>
                      <div>
                        <div style={{fontSize:11,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>{coin.ticker}</div>
                        <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{coin.name}</div>
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
                    <div style={{fontSize:13,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>{cSelected.name}</div>
                    <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{cSelected.ticker+"-AUD via Yahoo Finance"}</div>
                  </div>
                  <button onClick={()=>setCSelected(null)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11}}>Change</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:8}}>
                  <div>
                    <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>Amount</div>
                    <Inp type="number" value={cAmount} onChange={e=>setCAmount(e.target.value)} placeholder="0.5" style={{fontSize:12,padding:"7px 9px"}}/>
                  </div>
                  <div>
                    <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>Avg Cost (AUD)</div>
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
          <div style={{textAlign:"center",padding:"20px 0",color:t.MUTED,fontFamily:"sans-serif"}}>
            <div style={{fontSize:28,marginBottom:8}}>₿</div>
            <div style={{fontSize:12,color:t.TEXT,marginBottom:4}}>No crypto holdings yet</div>
            <div style={{fontSize:11}}>Add coins to track live AUD prices</div>
          </div>
        )}
        {(cryptoHoldings||[]).length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
            {[
              {l:"Portfolio Value",v:fmt(cryptoPortfolio?.totalValue||0),c:t.PURPLE},
              {l:"Total Gain",v:(cryptoPortfolio?.totalGain>=0?"+":"")+fmt(cryptoPortfolio?.totalGain||0),c:(cryptoPortfolio?.totalGain||0)>=0?t.GREEN:t.RED},
              {l:"Return",v:(cryptoPortfolio?.totalGainPct>=0?"+":"")+((cryptoPortfolio?.totalGainPct||0).toFixed(1))+"%",c:(cryptoPortfolio?.totalGainPct||0)>=0?t.GREEN:t.RED}
            ].map(s=>(
              <div key={s.l} style={{background:t.CARD2,borderRadius:6,padding:"7px 8px",textAlign:"center"}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginBottom:2}}>{s.l}</div>
                <div style={{fontSize:13,color:s.c,fontFamily:"sans-serif",fontWeight:700}}>{s.v}</div>
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
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:7,marginBottom:7}}>
                    {[["Coin ID","id",h.id],["Amount","amount",h.amount],["Avg Cost","avgCost",h.avgCost||""],["Label","name",h.name||h.id]].map(([l,k,def])=>(
                      <div key={k}>
                        <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>{l}</div>
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
                      <span style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{h.amount+" "+( h.ticker||h.symbol)}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      {livePrice?(
                        <>
                          <span style={{fontSize:11,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>{"$"+livePrice.toFixed(2)}</span>
                          {liveData.pct!==0&&<span style={{fontSize:10,color:liveData.pct>=0?t.GREEN:t.RED,fontFamily:"sans-serif"}}>{(liveData.pct>=0?"+":"")+((liveData.pct)||0).toFixed(2)+"%"}</span>}
                        </>
                      ):(
                        <span style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{cryptoPortfolio?.loading?"Loading...":"No live price"}</span>
                      )}
                      {h.avgCost&&<span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{"avg $"+(parseFloat(h.avgCost)||0).toFixed(2)}</span>}
                    </div>
                    {gain!==null&&(
                      <div style={{marginTop:2}}>
                        <span style={{fontSize:10,color:gain>=0?t.GREEN:t.RED,fontFamily:"sans-serif",fontWeight:600}}>{(gain>=0?"+ ":"- ")+fmt(Math.abs(gain))+" ("+(gainPct>=0?"+":"")+(gainPct||0).toFixed(1)+"%)"}</span>
                      </div>
                    )}
                  </div>
                  <div style={{textAlign:"right",marginLeft:10}}>
                    {lv&&<div style={{fontSize:14,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>{fmt(lv)}</div>}
                    {h.avgCost&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{"cost "+fmt(cb||0)}</div>}
                  </div>
                  <button onClick={()=>{setEditCryptoIdx(i);setEditCryptoForm({id:h.id,amount:h.amount,avgCost:h.avgCost||"",name:h.name||h.id});}} style={{background:t.PURPLE+"18",border:"1px solid "+t.PURPLE+"33",borderRadius:5,padding:"3px 8px",color:t.PURPLE,cursor:"pointer",fontSize:10,marginLeft:8}}>Edit</button>
                  <button onClick={()=>setCryptoHoldings(cs=>(cs||[]).filter(x=>x.ticker!==h.ticker))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:12,marginLeft:6,opacity:.5}}>X</button>
                </div>
              )}
            </div>
          );
        })}
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Card>
          <SectionLabel>Asset Allocation</SectionLabel>
          {assets.filter(a=>a.value>0).map(a=>{
            const pct=Math.round(a.value/(profile.totalAssets||1)*100)||0;
            return (
              <div key={a.type} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:ASSET_COLORS[a.type]}}/>
                    <span style={{fontSize:11,color:t.TEXT,fontFamily:"sans-serif"}}>{ASSET_LABELS[a.type]}</span>
                  </div>
                  <span style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif"}}>{fmt(a.value)+" - "+pct+"%"}</span>
                </div>
                <PB value={pct} color={ASSET_COLORS[a.type]} height={4}/>
              </div>
            );
          })}
        </Card>
        <Card>
          <SectionLabel>Liabilities</SectionLabel>
          {debts.map((d,i)=>(
            <div key={d.k}>
              {i>0&&<Divider/>}
              <div style={{display:"flex",justifyContent:"space-between",padding:"7px 0"}}>
                <span style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif"}}>{d.l}</span>
                <span style={{fontSize:12,color:t.RED,fontFamily:"sans-serif",fontWeight:600}}>{"-"+fmt(parseFloat(profile[d.k]))}</span>
              </div>
            </div>
          ))}
          <Divider/>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:13,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>Total Debt</span>
            <span style={{fontSize:13,color:t.RED,fontFamily:"sans-serif",fontWeight:700}}>{"-"+fmt(profile.totalDebt||0)}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ProjectorPage({profile}){
  const t=T();const[sr,setSr]=useState(35);const[rr,setRr]=useState(8);const[yrs,setYrs]=useState(10);
  const proj=(s,r,y)=>{let nw=profile.netWorth||958900;const a=[nw];for(let i=1;i<=y;i++){nw=nw*(1+r/100)+(parseFloat(profile.annualIncome)||320000)*(s/100);a.push(Math.round(nw));}return a;};
  const base=proj(sr,rr,yrs),bull=proj(sr+5,rr+2,yrs),bear=proj(Math.max(sr-10,5),Math.max(rr-3,2),yrs);
  const pj=base[base.length-1];
  const allV=[...base,...bull,parseFloat(profile.netWorthTarget)||3000000];
  const maxV=Math.max(...allV)*1.02,minV=(profile.netWorth||958900)*.95;
  const W=300,H=90,p=4;
  const px=i=>p+(i/yrs)*(W-p*2);
  const py=v=>H-p-((v-minV)/(maxV-minV||1))*(H-p*2);
  const mk=data=>data.map((v,i)=>(i===0?"M":"L")+px(i)+","+py(v)).join(" ");
  const targetNW=parseFloat(profile.netWorthTarget)||3000000;
  const controls=[
    {l:"Savings Rate",v:sr,set:setSr,min:5,max:70,step:5,sub:fmt(Math.round((parseFloat(profile.annualIncome)||320000)*sr/100))+"/yr"},
    {l:"Return Rate",v:rr,set:setRr,min:2,max:15,step:1,sub:"% p.a."},
    {l:"Years",v:yrs,set:setYrs,min:3,max:30,step:1,sub:"To "+(new Date().getFullYear()+yrs)}
  ];
  const hasFinancialData=(profile.annualIncome&&parseFloat(profile.annualIncome)>0)||(profile.netWorth&&parseFloat(profile.netWorth)>0);
  return (
    <div data-page="true" style={{maxWidth:680,margin:"0 auto"}}>
      <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Wealth Planning</div>
      <div style={{fontSize:26,color:t.TEXT,marginBottom:16}}>Wealth Forecast</div>
      {!hasFinancialData&&(
        <Card style={{marginBottom:14,borderColor:t.GOLD+"44",textAlign:"center",padding:32}}>
          <div style={{fontSize:32,marginBottom:12}}>F</div>
          <div style={{fontSize:16,color:t.TEXT,marginBottom:8}}>No financial data yet</div>
          <div style={{fontSize:12,color:t.MUTED,fontFamily:"sans-serif",lineHeight:1.7,marginBottom:16}}>Add your income and net worth in your profile to see a personalised wealth projection across bull, base and bear scenarios.</div>
          <Btn onClick={()=>{}}>Go to Profile</Btn>
        </Card>
      )}
      <Card style={{marginBottom:14}}>
        {controls.map(ctrl=>(
          <div key={ctrl.l} style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:12,color:t.MUTED,fontFamily:"sans-serif"}}>{ctrl.l}</span>
              <span style={{fontSize:14,color:t.GOLD,fontFamily:"sans-serif",fontWeight:700}}>
                {ctrl.v+(ctrl.l!=="Years"?"%":"")}
                <span style={{fontSize:10,color:t.MUTED}}>{" "+ctrl.sub}</span>
              </span>
            </div>
            <input type="range" min={ctrl.min} max={ctrl.max} step={ctrl.step} value={ctrl.v} onChange={e=>ctrl.set(Number(e.target.value))} style={{width:"100%",accentColor:t.GOLD}}/>
          </div>
        ))}
      </Card>
      <Card style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <SectionLabel>Projection</SectionLabel>
          <div style={{display:"flex",gap:10}}>
            {[{c:t.GREEN,l:"Bull"},{c:t.GOLD,l:"Base"},{c:t.RED,l:"Bear"}].map(x=>(
              <div key={x.l} style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:14,height:2,background:x.c}}/>
                <span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{x.l}</span>
              </div>
            ))}
          </div>
        </div>
        <svg viewBox={"0 0 "+W+" "+H} style={{width:"100%",height:H}}>
          {targetNW<maxV&&(
            <>
              <line x1={p} y1={py(targetNW)} x2={W-p} y2={py(targetNW)} stroke={t.GOLD} strokeWidth="1" strokeDasharray="3,3" opacity=".35"/>
              <text x={W-p-2} y={py(targetNW)-3} fill={t.GOLD} fontSize="7" textAnchor="end" fontFamily="sans-serif" opacity=".7">Target</text>
            </>
          )}
          <path d={mk(bear)} fill="none" stroke={t.RED} strokeWidth="1.5" strokeDasharray="3,3" opacity=".7"/>
          <path d={mk(bull)} fill="none" stroke={t.GREEN} strokeWidth="1.5" strokeDasharray="3,3" opacity=".7"/>
          <path d={mk(base)} fill="none" stroke={t.GOLD} strokeWidth="2.5"/>
          <circle cx={px(yrs)} cy={py(pj)} r="4" fill={t.GOLD}/>
        </svg>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <StatCard label="Projected NW" value={fmt(pj)} color={t.GOLD} sub={"in "+yrs+" years"}/>
        <StatCard label="Growth" value={"+"+fmt(pj-(profile.netWorth||958900))} color={t.GREEN}/>
      </div>
    </div>
  );
}

function DebtPage({profile,setProfile,debts,setDebts}){
  const t=T();
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
  const emptyForm={name:"",type:"Mortgage",originalBalance:"",balance:"",rate:"",minPayment:"",startDate:"",endDate:"",lender:"",notes:""};
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
  const totalMinPayment=allDebts.reduce((s,d)=>s+parseFloat(d.minPayment||0),0);

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
      // Always write to setDebts — use allDebts as fallback base if debts not yet set
      const base = debts?.length ? debts : allDebts;
      setDebts(base.map(d=>d.id===editing?{
        ...d,...form,
        balance:curBal,
        originalBalance:origBal,
        rate:form.rate===""?"":parseFloat(form.rate)||0,
        minPayment:parseFloat(form.minPayment)||0,
      }:d));
    } else {
      const newDebt={
        id:Date.now(),name:form.name,type:form.type,
        balance:curBal,originalBalance:origBal,
        rate:form.rate===""?"":parseFloat(form.rate)||0,
        minPayment:parseFloat(form.minPayment)||0,
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
    setAiLoading(true);setAiAdvice("");
    const debtSummary=allDebts.map(d=>{
      const payment=parseFloat(d.minPayment)||0;
      const months=calcPayoff(d.balance,d.rate,payment+extra/Math.max(allDebts.length,1));
      return d.name+" - Balance: "+fmt(d.balance)+" - Rate: "+(d.rate||0)+"% - Min payment: "+fmt(payment)+" - Payoff: "+(months?"~"+months+" months":"unknown");
    }).join("\n");
    try{
      const r=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        model:"claude-sonnet-4-6",max_tokens:800,
        system:"You are a personal finance expert. Give direct, specific debt payoff advice. No fluff.",
        messages:[{role:"user",content:"My debts:\n"+debtSummary+"\n\nTotal debt: "+fmt(totalDebt)+"\nExtra monthly budget: "+fmt(extra)+"\nCurrent strategy: "+strategy+"\n\nGive me: 1) Which debt to attack first and why, 2) Specific monthly payment plan, 3) One quick win I can do this week to reduce debt faster. Be specific with numbers."}]
      })});
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
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Debt Freedom</div>
          <div style={{fontSize:26,color:t.TEXT}}>Debt Tracker</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginTop:3}}>{allDebts.length+" debts - "+fmt(totalDebt)+" total"}</div>
        </div>
        <Btn onClick={()=>{setForm(emptyForm);setEditing(null);setShowAdd(s=>!s);}}>+ Add Debt</Btn>
      </div>

      {/* Summary stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
        <StatCard label="Total Debt" value={fmt(totalDebt)} color={t.RED}/>
        <StatCard label="Min Payments" value={fmt(totalMinPayment)+"/mo"} color={t.MUTED} sub="Combined"/>
        <StatCard label="Debts" value={allDebts.length} color={t.GOLD} sub="Active"/>
      </div>

      {/* Strategy + Extra */}
      <Card style={{marginBottom:14}}>
        <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:200}}>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Payoff Strategy</div>
            <div style={{display:"flex",gap:7}}>
              {[{id:"avalanche",l:"Avalanche",sub:"Highest rate first"},{id:"snowball",l:"Snowball",sub:"Smallest balance first"},{id:"custom",l:"Custom",sub:"Your order"}].map(s=>(
                <button key={s.id} onClick={()=>setStrategy(s.id)} style={{flex:1,padding:"8px 6px",borderRadius:7,border:"1px solid "+(strategy===s.id?t.GOLD:t.BORDER),background:strategy===s.id?t.GOLD+"18":"transparent",cursor:"pointer",fontFamily:"sans-serif"}}>
                  <div style={{fontSize:11,color:strategy===s.id?t.GOLD:t.TEXT,fontWeight:600}}>{s.l}</div>
                  <div style={{fontSize:9,color:t.MUTED,marginTop:2}}>{s.sub}</div>
                </button>
              ))}
            </div>
          </div>
          <div style={{flex:1,minWidth:180}}>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Extra Monthly Payment</div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <input type="range" min={0} max={5000} step={100} value={extra} onChange={e=>setExtra(Number(e.target.value))} style={{flex:1,accentColor:t.GOLD}}/>
              <div style={{fontSize:16,color:t.GOLD,fontFamily:"sans-serif",fontWeight:700,minWidth:80,textAlign:"right"}}>{fmt(extra)+"/mo"}</div>
            </div>
          </div>
        </div>
        {/* Priority order hint */}
        {strategy!=="custom"&&allDebts.length>1&&(
          <div style={{padding:"8px 12px",background:t.CARD2,borderRadius:7}}>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Attack Order</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {sorted.map((d,i)=>(
                <div key={d.id} style={{display:"flex",alignItems:"center",gap:5,background:i===0?t.RED+"22":t.CARD,border:"1px solid "+(i===0?t.RED:t.BORDER),borderRadius:20,padding:"3px 10px"}}>
                  <div style={{width:16,height:16,borderRadius:"50%",background:i===0?t.RED:t.BORDER,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:i===0?t.BG:t.MUTED,fontWeight:700,flexShrink:0}}>{i+1}</div>
                  <span style={{fontSize:10,color:i===0?t.RED:t.MUTED,fontFamily:"sans-serif"}}>{d.name}</span>
                  <span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{d.rate||0}%</span>
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
            <div style={{fontSize:10,color:t.GOLD,fontFamily:"sans-serif",letterSpacing:1,textTransform:"uppercase"}}>AI Debt Advisor</div>
            <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginTop:2}}>Personalised payoff strategy based on your debts</div>
          </div>
          <button onClick={getAiAdvice} disabled={aiLoading||!allDebts.length} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:7,padding:"6px 12px",color:t.GOLD,cursor:aiLoading||!allDebts.length?"default":"pointer",fontFamily:"sans-serif",fontSize:11,opacity:!allDebts.length?.5:1}}>
            {aiLoading?"Analysing...":"Get Strategy"}
          </button>
        </div>
        {aiLoading&&<div style={{display:"flex",flexDirection:"column",gap:8}}>{[90,75,85].map((w,i)=><Skeleton key={i} width={w+"%"} height={12}/>)}</div>}
        {aiAdvice&&!aiLoading&&<div style={{fontSize:12,color:t.TEXT,lineHeight:1.85,fontFamily:"sans-serif",whiteSpace:"pre-wrap"}}>{aiAdvice}</div>}
      </Card>

      {/* Add debt form */}
      {showAdd&&(
        <Card style={{marginBottom:14,borderColor:t.GOLD+"44"}}>
          <SectionLabel>{editing?"Edit Debt":"New Debt"}</SectionLabel>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:2}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Name</div>
                <Inp value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. ANZ Home Loan"/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Type</div>
                <Sel value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                  {DEBT_TYPES.map(tp=><option key={tp}>{tp}</option>)}
                </Sel>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Original Balance ($)</div>
                <Inp type="number" value={form.originalBalance} onChange={e=>setForm(f=>({...f,originalBalance:e.target.value}))} placeholder="e.g. 600000"/>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginTop:3}}>What you originally borrowed</div>
              </div>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Current Balance ($)</div>
                <Inp type="number" value={form.balance} onChange={e=>setForm(f=>({...f,balance:e.target.value}))} placeholder="e.g. 480000"/>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginTop:3}}>Where it sits right now</div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Interest Rate (%)</div>
                <Inp type="number" value={form.rate} onChange={e=>setForm(f=>({...f,rate:e.target.value}))} placeholder="6.2"/>
              </div>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Min Payment ($/mo)</div>
                <Inp type="number" value={form.minPayment} onChange={e=>setForm(f=>({...f,minPayment:e.target.value}))} placeholder="2400"/>
              </div>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Lender</div>
                <Inp value={form.lender} onChange={e=>setForm(f=>({...f,lender:e.target.value}))} placeholder="ANZ, Westpac..."/>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Start Date</div>
                <Inp type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))}/>
              </div>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>End Date / Due Date</div>
                <Inp type="date" value={form.endDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))}/>
              </div>
            </div>
            <div>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Notes</div>
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
        const payment=(parseFloat(d.minPayment)||0)+(idx===0?extra:0);
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
                  {isPriority&&<div style={{fontSize:8,color:t.RED,fontFamily:"sans-serif",background:t.RED+"18",border:"1px solid "+t.RED+"33",borderRadius:4,padding:"1px 6px",letterSpacing:1,textTransform:"uppercase"}}>Priority</div>}
                  <div style={{fontSize:14,color:t.TEXT,fontWeight:600}}>{d.name}</div>
                </div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  <span style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{d.type}</span>
                  {d.lender&&<span style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{d.lender}</span>}
                  <span style={{fontSize:10,color:t.RED,fontFamily:"sans-serif",fontWeight:600}}>{(d.rate||0)+"%"+" p.a."}</span>
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                <div style={{fontSize:18,color:t.RED,fontFamily:"sans-serif",fontWeight:700}}>{"-"+fmt(bal)}</div>
                {months&&<div style={{fontSize:10,color:t.GREEN,fontFamily:"sans-serif",marginTop:1}}>Free {payoffDate(months)}</div>}
              </div>
            </div>

            {/* Progress bar */}
            {d.originalBalance&&d.originalBalance>0&&(
              <div style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{paidOff+"% paid off"}</span>
                  <span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{fmt(d.originalBalance-bal)+" paid"}</span>
                </div>
                <PB value={paidOff} color={t.GREEN} height={5}/>
              </div>
            )}

            {/* Key metrics row */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:8}}>
              {[
                {l:"Balance",v:fmt(bal),c:t.RED},
                {l:"Rate",v:(d.rate||0)+"%",c:t.MUTED},
                {l:"Monthly",v:payment>0?fmt(payment)+"/mo":"Not set",c:t.GOLD},
                {l:"Est. Interest",v:totalInt?fmt(totalInt):"N/A",c:t.MUTED},
              ].map(m=>(
                <div key={m.l} style={{background:t.CARD2,borderRadius:6,padding:"7px 8px",textAlign:"center"}}>
                  <div style={{fontSize:11,color:m.c,fontFamily:"sans-serif",fontWeight:600}}>{m.v}</div>
                  <div style={{fontSize:8,color:t.MUTED,fontFamily:"sans-serif",marginTop:2,textTransform:"uppercase",letterSpacing:.5}}>{m.l}</div>
                </div>
              ))}
            </div>

            {/* Expanded detail */}
            {isExpanded&&(
              <div style={{borderTop:"1px solid "+t.BORDER,paddingTop:10,marginBottom:8}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                  {d.startDate&&<div><div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginBottom:2}}>Start Date</div><div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif"}}>{d.startDate}</div></div>}
                  {d.endDate&&<div><div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginBottom:2}}>End Date</div><div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif"}}>{d.endDate}</div></div>}
                  {months&&<div><div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginBottom:2}}>Payoff Date (est.)</div><div style={{fontSize:12,color:t.GREEN,fontFamily:"sans-serif",fontWeight:600}}>{payoffDate(months)+" ("+months+" months)"}</div></div>}
                  <div><div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginBottom:2}}>Share of total debt</div><div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif"}}>{pct+"%"}</div></div>
                </div>
                {d.notes&&<div style={{padding:"8px 10px",background:t.CARD2,borderRadius:6,fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginBottom:10}}>{d.notes}</div>}
                {/* Payment history */}
                {(d.payments||[]).length>0&&(
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Payment History</div>
                    {(d.payments||[]).slice(-5).reverse().map(p=>(
                      <div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid "+t.BORDER+"66",fontSize:11,fontFamily:"sans-serif"}}>
                        <span style={{color:t.MUTED}}>{p.date}</span>
                        <span style={{color:t.GREEN,fontWeight:600}}>{"-"+fmt(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Delete */}
                {confirmDel===d.id?(
                  <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
                    <span style={{fontSize:11,color:t.RED,fontFamily:"sans-serif"}}>Delete this debt?</span>
                    <button onClick={()=>{const base=debts?.length?debts:allDebts;setDebts(base.filter(x=>x.id!==d.id));setConfirmDel(null);}} style={{background:t.RED+"22",border:"1px solid "+t.RED+"44",borderRadius:5,padding:"3px 8px",color:t.RED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>Yes</button>
                    <button onClick={()=>setConfirmDel(null)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:5,padding:"3px 8px",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>No</button>
                  </div>
                ):(
                  <button onClick={()=>setConfirmDel(d.id)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif",opacity:.6}}>Delete debt</button>
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
              <div style={{display:"flex",gap:7,marginTop:4}}>
                <button onClick={()=>setPayingDebt(d.id)} style={{background:t.GREEN+"14",border:"1px solid "+t.GREEN+"33",borderRadius:6,padding:"5px 10px",color:t.GREEN,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>+ Record Payment</button>
                <button onClick={()=>openEdit(d)} style={{background:t.GOLD+"14",border:"1px solid "+t.GOLD+"33",borderRadius:6,padding:"5px 10px",color:t.GOLD,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>Edit</button>
                <button onClick={()=>setExpanded(x=>({...x,[d.id]:!x[d.id]}))} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:6,padding:"5px 10px",color:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>{isExpanded?"Less":"Details"}</button>
              </div>
            )}
          </Card>
        );
      })}

      {!allDebts.length&&(
        <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"sans-serif"}}>
          <div style={{fontSize:32,marginBottom:12}}>D</div>
          <div style={{fontSize:14,marginBottom:8}}>No debts tracked</div>
          <div style={{fontSize:12,marginBottom:16}}>Add your debts to get a personalised payoff strategy</div>
          <Btn onClick={()=>{setForm(emptyForm);setEditing(null);setShowAdd(true);}}>+ Add First Debt</Btn>
        </div>
      )}
    </div>
  );
}

function CashFlowPage({transactions,setTransactions}){
  const t=T();
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
    const key=d.toISOString().slice(0,7);
    const label=d.toLocaleString("default",{month:"short"});
    const year=d.getFullYear();
    const txs=transactions.filter(tx=>tx.date.startsWith(key));
    const inc=txs.filter(tx=>tx.type==="income").reduce((s,tx)=>s+tx.amount,0);
    const exp=txs.filter(tx=>tx.type==="expense").reduce((s,tx)=>s+tx.amount,0);
    return{key,label,year,inc,exp,net:inc-exp,txs};
  });

  const currentMonth=months[months.length-1];
  const prevMonth=months[months.length-2];
  const mk=monthStr();
  const tm=transactions.filter(tx=>tx.date.startsWith(mk));
  const income=tm.filter(tx=>tx.type==="income").reduce((s,tx)=>s+tx.amount,0);
  const expense=tm.filter(tx=>tx.type==="expense").reduce((s,tx)=>s+tx.amount,0);

  // All-time totals
  const totalIncome=transactions.filter(tx=>tx.type==="income").reduce((s,tx)=>s+tx.amount,0);
  const totalExpense=transactions.filter(tx=>tx.type==="expense").reduce((s,tx)=>s+tx.amount,0);

  // Category totals for selected period
  const selectedMonthData=hoveredMonth||currentMonth;
  const byCatIncome=EXP_CATS.income.map(cat=>({cat,total:selectedMonthData.txs.filter(tx=>tx.type==="income"&&tx.category===cat).reduce((s,tx)=>s+tx.amount,0)})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
  const byCatExpense=EXP_CATS.expense.map(cat=>({cat,total:selectedMonthData.txs.filter(tx=>tx.type==="expense"&&tx.category===cat).reduce((s,tx)=>s+tx.amount,0)})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
  const catColors=["#C9A84C","#7A9E7E","#7EB8C9","#B07EC9","#C97E7E","#D4956A","#7EC8A0","#C8A87E"];

  const maxBar=Math.max(...months.flatMap(m=>[m.inc,m.exp]),1);

  // Month over month change
  const incChange=prevMonth.inc>0?((income-prevMonth.inc)/prevMonth.inc*100):0;
  const expChange=prevMonth.exp>0?((expense-prevMonth.exp)/prevMonth.exp*100):0;

  const handlePdf=async file=>{
    if(!file||!file.type.includes("pdf"))return;
    setPdfState("loading");setPdfError("");
    try{
      const base64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=()=>rej(new Error("Read failed"));r.readAsDataURL(file);});
      const catList=[...EXP_CATS.income,...EXP_CATS.expense].join(", ");
      const resp=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-haiku-4-5",max_tokens:4000,messages:[{role:"user",content:[{type:"document",source:{type:"base64",media_type:"application/pdf",data:base64}},{type:"text",text:"Extract all transactions from this bank statement. Return ONLY a JSON array, no markdown. Each item: {\"date\":\"YYYY-MM-DD\",\"description\":\"merchant max 40 chars\",\"amount\":number,\"type\":\"income or expense\",\"category\":\"one of: "+catList+"\"} Skip transfers and fees under $1. Amount always positive."}]}]})});
      const d=await resp.json();
      const text=(d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").replace(/```json\s*/g,"").replace(/```\s*/g,"").trim();
      const parsed=JSON.parse(text);
      if(!Array.isArray(parsed)||!parsed.length){setPdfState("error");setPdfError("No transactions found.");return;}
      const valid=parsed.filter(tx=>tx.date&&tx.amount).map((tx,i)=>({id:"pdf_"+i+"_"+Date.now(),date:tx.date,type:tx.type==="income"?"income":"expense",category:tx.category||"Other",amount:Math.abs(parseFloat(tx.amount)||0),note:tx.description||""})).filter(tx=>tx.amount>0);
      setExtracted(valid);const sel={};valid.forEach(tx=>{sel[tx.id]=true;});setSelected(sel);setPdfState("review");
    }catch(err){setPdfState("error");setPdfError(err.message?.includes("JSON")?"Could not parse the statement.":"Something went wrong.");}
  };
  const confirmImport=()=>{setTransactions(ts=>[...extracted.filter(tx=>selected[tx.id]).map(tx=>({...tx,id:Date.now()+Math.random()})),...ts]);setExtracted([]);setSelected({});setPdfState("idle");};
  const add=()=>{if(!form.amount||isNaN(form.amount))return;setTransactions(ts=>[{...form,amount:parseFloat(form.amount),id:Date.now()},...ts]);setForm(f=>({...f,amount:"",note:""}));setShowAdd(false);};
  const shown=transactions.filter(tx=>filter==="all"||tx.type===filter).slice(0,50);

  return (
    <div data-page="true" style={{maxWidth:900,margin:"0 auto"}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Cash Flow</div>
          <div style={{fontSize:26,color:t.TEXT}}>Income and Expenses</div>
        </div>
        <Btn onClick={()=>setShowAdd(s=>!s)}>+ Add</Btn>
      </div>

      {/* Summary stats - this month + all time */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
        <Card style={{borderColor:t.GREEN+"33"}}>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Income This Month</div>
          <div style={{fontSize:24,color:t.GREEN,fontWeight:700,marginBottom:3}}>{fmt(income)}</div>
          <div style={{fontSize:10,color:incChange>=0?t.GREEN:t.RED,fontFamily:"sans-serif"}}>
            {incChange>=0?"+ ":"- "}{Math.abs(incChange).toFixed(1)}{"% vs last month"}
          </div>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginTop:4}}>{"All time: "+fmt(totalIncome)}</div>
        </Card>
        <Card style={{borderColor:t.RED+"33"}}>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Expenses This Month</div>
          <div style={{fontSize:24,color:t.RED,fontWeight:700,marginBottom:3}}>{fmt(expense)}</div>
          <div style={{fontSize:10,color:expChange<=0?t.GREEN:t.RED,fontFamily:"sans-serif"}}>
            {expChange>=0?"+ ":"- "}{Math.abs(expChange).toFixed(1)}{"% vs last month"}
          </div>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginTop:4}}>{"All time: "+fmt(totalExpense)}</div>
        </Card>
        <Card style={{borderColor:(income-expense>=0?t.GREEN:t.RED)+"33"}}>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Net This Month</div>
          <div style={{fontSize:24,color:income-expense>=0?t.GREEN:t.RED,fontWeight:700,marginBottom:3}}>{(income-expense>=0?"+":"-")+fmt(Math.abs(income-expense))}</div>
          <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{income-expense>=0?"Surplus":"Deficit"}</div>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginTop:4}}>{"All time: "+(totalIncome-totalExpense>=0?"+":"-")+fmt(Math.abs(totalIncome-totalExpense))}</div>
        </Card>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {[["overview","Overview"],["monthly","Monthly Breakdown"],["categories","Categories"],["transactions","Transactions"]].map(([id,label])=>(
          <button key={id} onClick={()=>setActiveTab(id)} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid "+(activeTab===id?t.GOLD:t.BORDER),background:activeTab===id?t.GOLD+"18":"transparent",color:activeTab===id?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>
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
                    <span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{x.l}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Tooltip */}
            {hoveredMonth&&(
              <div style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"8px 12px",marginBottom:10,display:"flex",gap:20,flexWrap:"wrap"}}>
                <div style={{fontSize:11,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>{hoveredMonth.label+" "+hoveredMonth.year}</div>
                <div style={{fontSize:11,color:t.GREEN,fontFamily:"sans-serif"}}>In: {fmt(hoveredMonth.inc)}</div>
                <div style={{fontSize:11,color:t.RED,fontFamily:"sans-serif"}}>Out: {fmt(hoveredMonth.exp)}</div>
                <div style={{fontSize:11,color:hoveredMonth.net>=0?t.GREEN:t.RED,fontFamily:"sans-serif",fontWeight:600}}>Net: {(hoveredMonth.net>=0?"+":"")+fmt(hoveredMonth.net)}</div>
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
                  <div style={{fontSize:7,color:i===11?t.GOLD:t.MUTED,fontFamily:"sans-serif",fontWeight:i===11?700:400}}>{m.label}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* PDF import */}
          {pdfState==="idle"&&(
            <div onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();handlePdf(e.dataTransfer.files[0]);}} style={{border:"1.5px dashed "+t.GOLD+"44",borderRadius:9,padding:14,textAlign:"center",cursor:"pointer",marginBottom:14}}>
              <input ref={fileRef} type="file" accept="application/pdf" style={{display:"none"}} onChange={e=>handlePdf(e.target.files[0])}/>
              <div style={{fontSize:12,color:t.GOLD,fontFamily:"sans-serif",fontWeight:600,marginBottom:2}}>Import Bank Statement (PDF)</div>
              <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif"}}>Drop PDF or tap to browse</div>
            </div>
          )}
          {pdfState==="loading"&&<Card style={{marginBottom:14,textAlign:"center",padding:20}}><div style={{fontSize:12,color:t.GOLD,fontFamily:"sans-serif"}}>Reading your statement...</div></Card>}
          {pdfState==="error"&&<Card style={{marginBottom:14,borderColor:t.RED+"44"}}><div style={{display:"flex",justifyContent:"space-between"}}><div><div style={{fontSize:12,color:t.RED,fontFamily:"sans-serif",fontWeight:600,marginBottom:3}}>Import failed</div><div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif"}}>{pdfError}</div></div><button onClick={()=>setPdfState("idle")} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:5,padding:"3px 8px",color:t.MUTED,cursor:"pointer",fontSize:10}}>Retry</button></div></Card>}
          {pdfState==="review"&&(
            <Card style={{marginBottom:14,borderColor:t.GOLD+"44"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif"}}>{extracted.length+" found - "+Object.values(selected).filter(Boolean).length+" selected"}</div>
                <div style={{display:"flex",gap:7}}>
                  <button onClick={()=>{const all=Object.values(selected).every(Boolean);const s={};extracted.forEach(tx=>{s[tx.id]=!all;});setSelected(s);}} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:5,padding:"4px 9px",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>{Object.values(selected).every(Boolean)?"Deselect All":"Select All"}</button>
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
                    <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",width:80,flexShrink:0}}>{tx.date}</div>
                    <div style={{flex:1,fontSize:11,color:t.TEXT,fontFamily:"sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tx.note}</div>
                    <select value={tx.category} onClick={e=>e.stopPropagation()} onChange={e=>{e.stopPropagation();setExtracted(ex=>ex.map(x=>x.id===tx.id?{...x,category:e.target.value}:x));}} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:4,padding:"2px 4px",color:t.MUTED,fontFamily:"sans-serif",fontSize:9,outline:"none",flexShrink:0}}>
                      {EXP_CATS[tx.type].map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                    <div style={{fontSize:11,color:tx.type==="income"?t.GREEN:t.RED,fontFamily:"sans-serif",fontWeight:600,flexShrink:0,minWidth:60,textAlign:"right"}}>{(tx.type==="income"?"+":"-")+fmt(tx.amount)}</div>
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
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,auto) 1fr 1fr 1fr",gap:"6px 10px",alignItems:"center",marginBottom:6}}>
              {["Month","","Income","Expenses","Net","Savings%"].map((h,i)=>(
                <div key={i} style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,textAlign:i>=3?"right":"left",paddingBottom:6,borderBottom:"1px solid "+t.BORDER}}>{h}</div>
              ))}
            </div>
            {[...months].reverse().map((m,i)=>{
              const savingsRate=m.inc>0?Math.round((m.net/m.inc)*100):0;
              const isCurrentMonth=m.key===mk;
              return (
                <div key={m.key} style={{display:"grid",gridTemplateColumns:"repeat(3,auto) 1fr 1fr 1fr",gap:"6px 10px",alignItems:"center",padding:"8px 0",borderBottom:"1px solid "+t.BORDER+(isCurrentMonth?"":"66"),background:isCurrentMonth?t.GOLD+"08":"transparent",borderRadius:isCurrentMonth?4:0}}>
                  <div style={{fontSize:12,color:isCurrentMonth?t.GOLD:t.TEXT,fontFamily:"sans-serif",fontWeight:isCurrentMonth?600:400}}>{m.label}</div>
                  <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{m.year}</div>
                  {isCurrentMonth&&<div style={{fontSize:8,color:t.GOLD,fontFamily:"sans-serif",background:t.GOLD+"18",padding:"1px 5px",borderRadius:4}}>Now</div>}
                  {!isCurrentMonth&&<div/>}
                  <div style={{fontSize:12,color:t.GREEN,fontFamily:"sans-serif",fontWeight:600,textAlign:"right"}}>{m.inc>0?fmt(m.inc):"-"}</div>
                  <div style={{fontSize:12,color:t.RED,fontFamily:"sans-serif",fontWeight:600,textAlign:"right"}}>{m.exp>0?fmt(m.exp):"-"}</div>
                  <div style={{fontSize:12,color:m.net>=0?t.GREEN:t.RED,fontFamily:"sans-serif",fontWeight:600,textAlign:"right"}}>{m.inc>0||m.exp>0?(m.net>=0?"+":"")+fmt(m.net):"-"}</div>
                </div>
              );
            })}
            {/* Totals row */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,auto) 1fr 1fr 1fr",gap:"6px 10px",alignItems:"center",padding:"10px 0 4px",borderTop:"2px solid "+t.BORDER}}>
              <div style={{fontSize:11,color:t.TEXT,fontFamily:"sans-serif",fontWeight:700}}>Total</div>
              <div/><div/>
              <div style={{fontSize:12,color:t.GREEN,fontFamily:"sans-serif",fontWeight:700,textAlign:"right"}}>{fmt(totalIncome)}</div>
              <div style={{fontSize:12,color:t.RED,fontFamily:"sans-serif",fontWeight:700,textAlign:"right"}}>{fmt(totalExpense)}</div>
              <div style={{fontSize:12,color:totalIncome-totalExpense>=0?t.GREEN:t.RED,fontFamily:"sans-serif",fontWeight:700,textAlign:"right"}}>{(totalIncome-totalExpense>=0?"+":"")+fmt(totalIncome-totalExpense)}</div>
            </div>
          </Card>
        </div>
      )}

      {/* ── CATEGORIES TAB ── */}
      {activeTab==="categories"&&(
        <div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginBottom:12}}>Hover over chart bars to see category breakdown for that month</div>
          {/* Month selector */}
          <div style={{display:"flex",gap:4,overflowX:"auto",marginBottom:14,scrollbarWidth:"none"}}>
            {months.map(m=>(
              <button key={m.key} onClick={()=>setHoveredMonth(hoveredMonth?.key===m.key?null:m)} style={{flexShrink:0,padding:"5px 10px",borderRadius:14,border:"1px solid "+(hoveredMonth?.key===m.key||(!hoveredMonth&&m.key===mk)?t.GOLD:t.BORDER),background:hoveredMonth?.key===m.key||(!hoveredMonth&&m.key===mk)?t.GOLD+"18":"transparent",color:hoveredMonth?.key===m.key||(!hoveredMonth&&m.key===mk)?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>
                {m.label}
              </button>
            ))}
          </div>
          <div style={{fontSize:10,color:t.GOLD,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>
            {(hoveredMonth||currentMonth).label+" "+(hoveredMonth||currentMonth).year}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {/* Income categories */}
            <Card>
              <div style={{fontSize:9,color:t.GREEN,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Income by Category</div>
              {byCatIncome.length===0?<div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif"}}>No income this month</div>:
              byCatIncome.map((x,i)=>(
                <div key={x.cat} style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:11,color:t.TEXT,fontFamily:"sans-serif"}}>{x.cat}</span>
                    <span style={{fontSize:11,color:t.GREEN,fontFamily:"sans-serif",fontWeight:600}}>{fmt(x.total)}</span>
                  </div>
                  <div style={{background:t.BORDER2,borderRadius:99,height:3,overflow:"hidden"}}>
                    <div style={{width:((x.total/(byCatIncome[0]?.total||1))*100)+"%",height:"100%",background:t.GREEN,borderRadius:99}}/>
                  </div>
                </div>
              ))}
              {byCatIncome.length>0&&<div style={{borderTop:"1px solid "+t.BORDER,marginTop:8,paddingTop:8,display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif"}}>Total</span><span style={{fontSize:12,color:t.GREEN,fontFamily:"sans-serif",fontWeight:700}}>{fmt(byCatIncome.reduce((s,x)=>s+x.total,0))}</span></div>}
            </Card>
            {/* Expense categories */}
            <Card>
              <div style={{fontSize:9,color:t.RED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Expenses by Category</div>
              {byCatExpense.length===0?<div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif"}}>No expenses this month</div>:
              byCatExpense.map((x,i)=>(
                <div key={x.cat} style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:11,color:t.TEXT,fontFamily:"sans-serif"}}>{x.cat}</span>
                    <span style={{fontSize:11,color:t.RED,fontFamily:"sans-serif",fontWeight:600}}>{fmt(x.total)}</span>
                  </div>
                  <div style={{background:t.BORDER2,borderRadius:99,height:3,overflow:"hidden"}}>
                    <div style={{width:((x.total/(byCatExpense[0]?.total||1))*100)+"%",height:"100%",background:catColors[i%catColors.length],borderRadius:99}}/>
                  </div>
                </div>
              ))}
              {byCatExpense.length>0&&<div style={{borderTop:"1px solid "+t.BORDER,marginTop:8,paddingTop:8,display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif"}}>Total</span><span style={{fontSize:12,color:t.RED,fontFamily:"sans-serif",fontWeight:700}}>{fmt(byCatExpense.reduce((s,x)=>s+x.total,0))}</span></div>}
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
                  <button key={tp} onClick={()=>setForm(f=>({...f,type:tp,category:EXP_CATS[tp][0]}))} style={{flex:1,padding:"8px",borderRadius:7,border:"1px solid "+(form.type===tp?(tp==="income"?t.GREEN:t.RED):t.BORDER),background:form.type===tp?(tp==="income"?t.GREEN:t.RED)+"22":"transparent",color:form.type===tp?(tp==="income"?t.GREEN:t.RED):t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:12,textTransform:"capitalize"}}>{tp}</button>
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
                <button key={f} onClick={()=>setFilter(f)} style={{padding:"4px 11px",borderRadius:14,border:"1px solid "+(filter===f?t.GOLD:t.BORDER),background:filter===f?t.GOLD+"14":"transparent",color:filter===f?t.GOLD:t.MUTED,cursor:"pointer",fontSize:11,fontFamily:"sans-serif",textTransform:"capitalize"}}>{f}</button>
              ))}
            </div>
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif"}}>{shown.length+" transactions"}</div>
          </div>
          {/* Totals for filtered view */}
          <div style={{display:"flex",gap:10,marginBottom:12,padding:"8px 12px",background:t.CARD2,borderRadius:7}}>
            <div style={{fontSize:11,color:t.GREEN,fontFamily:"sans-serif"}}>Income: {fmt(shown.filter(tx=>tx.type==="income").reduce((s,tx)=>s+tx.amount,0))}</div>
            <div style={{fontSize:11,color:t.MUTED}}>|</div>
            <div style={{fontSize:11,color:t.RED,fontFamily:"sans-serif"}}>Expenses: {fmt(shown.filter(tx=>tx.type==="expense").reduce((s,tx)=>s+tx.amount,0))}</div>
          </div>
          {shown.length===0?<div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"sans-serif"}}><div style={{fontSize:28,marginBottom:10}}>T</div><div>No transactions yet</div></div>:
          <Card>
            {shown.map((tx,i)=>(
              <div key={tx.id}>
                {i>0&&<Divider/>}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,color:t.TEXT}}>{tx.category}{tx.note&&<span style={{color:t.MUTED,fontSize:11}}>{" - "+tx.note}</span>}</div>
                    <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginTop:1}}>{tx.date}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:9}}>
                    <div style={{fontSize:13,color:tx.type==="income"?t.GREEN:t.RED,fontFamily:"sans-serif",fontWeight:600}}>{(tx.type==="income"?"+":"-")+fmt(tx.amount)}</div>
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
  const emptyForm={name:"",amount:"",frequency:"monthly",category:"Housing",nextDue:todayStr(),autopay:false};
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

  const advanceDate=(ds,freq)=>{
    const d=new Date(ds+"T12:00:00");
    if(freq==="weekly")d.setDate(d.getDate()+7);
    else if(freq==="fortnightly")d.setDate(d.getDate()+14);
    else if(freq==="monthly")d.setMonth(d.getMonth()+1);
    else if(freq==="quarterly")d.setMonth(d.getMonth()+3);
    else if(freq==="annually")d.setFullYear(d.getFullYear()+1);
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  };

  const markPaid=id=>setBills(bs=>bs.map(b=>{
    if(b.id!==id)return b;
    const payment={date:todayStr(),amount:parseFloat(b.amount),name:b.name};
    return{...b,nextDue:advanceDate(b.nextDue,b.frequency),lastPaid:todayStr(),paymentHistory:[payment,...(b.paymentHistory||[]).slice(0,23)]};
  }));

  const openEdit=b=>{
    setForm({name:b.name,amount:b.amount,frequency:b.frequency,category:b.category,nextDue:b.nextDue,autopay:b.autopay||false});
    setEditingId(b.id);setShowAdd(true);
  };

  const save=()=>{
    if(!form.name||!form.amount)return;
    if(editingId){
      setBills(bs=>bs.map(b=>b.id===editingId?{...b,...form,amount:parseFloat(form.amount)}:b));
    } else {
      setBills(bs=>[...bs,{...form,id:Date.now(),amount:parseFloat(form.amount),paymentHistory:[]}]);
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
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Recurring</div>
          <div style={{fontSize:26,color:t.TEXT}}>Bills</div>
        </div>
        <Btn onClick={()=>{setForm(emptyForm);setEditingId(null);setShowAdd(s=>!s);}}>+ Add</Btn>
      </div>

      {/* Summary */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
        <Card style={{textAlign:"center",padding:"12px 8px"}}>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Monthly Total</div>
          <div style={{fontSize:22,color:t.RED,fontWeight:700}}>{fmtAmt(totalMonthly)}</div>
        </Card>
        <Card style={{textAlign:"center",padding:"12px 8px"}}>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Annual Total</div>
          <div style={{fontSize:22,color:t.GOLD,fontWeight:700}}>{fmtAmt(totalMonthly*12)}</div>
        </Card>
        <Card style={{textAlign:"center",padding:"12px 8px"}}>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Bills Tracked</div>
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
                    <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif"}}>
                      {b.name}{b.autopay&&<span style={{fontSize:9,color:t.GREEN,marginLeft:5,fontFamily:"sans-serif"}}>auto</span>}
                    </div>
                    <div style={{fontSize:10,color:diff===0?t.RED:t.MUTED,fontFamily:"sans-serif",marginTop:1}}>{dueLabel+" - "+b.nextDue}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:13,color:t.RED,fontFamily:"sans-serif",fontWeight:600}}>{fmtAmt(b.amount)}</span>
                    <button onClick={()=>markPaid(b.id)} style={{background:t.GREEN+"18",border:"1px solid "+t.GREEN+"44",borderRadius:5,padding:"4px 9px",color:t.GREEN,cursor:"pointer",fontSize:11,fontFamily:"sans-serif"}}>Paid</button>
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
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <Inp type="date" value={form.nextDue} onChange={e=>setForm(f=>({...f,nextDue:e.target.value}))} style={{flex:1}}/>
              <label style={{display:"flex",alignItems:"center",gap:5,color:t.TEXT,fontFamily:"sans-serif",fontSize:12,cursor:"pointer",flexShrink:0}}>
                <input type="checkbox" checked={form.autopay} onChange={e=>setForm(f=>({...f,autopay:e.target.checked}))} style={{accentColor:t.GOLD}}/>
                Auto-pay
              </label>
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
            <button onClick={()=>setShowHistory(s=>!s)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,fontFamily:"sans-serif"}}>{showHistory?"Hide":"Show"}</button>
          </div>
          {showHistory&&(
            <div>
              {bills.flatMap(b=>(b.paymentHistory||[]).map(p=>({...p,billName:b.name}))).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20).map((p,i)=>(
                <div key={i}>
                  {i>0&&<Divider/>}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0"}}>
                    <div>
                      <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif"}}>{p.billName}</div>
                      <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginTop:1}}>{p.date}</div>
                    </div>
                    <div style={{fontSize:12,color:t.RED,fontFamily:"sans-serif",fontWeight:600}}>{"-"+fmtAmt(p.amount)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Bills grouped by category */}
      {bills.length===0&&(
        <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"sans-serif"}}>
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
              <div style={{fontSize:9,color:col,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:2,fontWeight:700}}>{cat}</div>
              <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{fmtAmt(catTotal)+"/mo"}</div>
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
                        <div style={{fontSize:13,color:t.TEXT,fontFamily:"sans-serif",fontWeight:500}}>
                          {b.name}
                          {b.autopay&&<span style={{fontSize:9,color:t.GREEN,marginLeft:6,fontFamily:"sans-serif"}}>auto</span>}
                        </div>
                        <div style={{display:"flex",gap:10,marginTop:2}}>
                          <span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{b.frequency.charAt(0).toUpperCase()+b.frequency.slice(1)}</span>
                          <span style={{fontSize:9,color:urgent?t.RED:t.MUTED,fontFamily:"sans-serif"}}>
                            {urgent?"Due soon: ":"Next: "}{b.nextDue}
                          </span>
                          {b.lastPaid&&<span style={{fontSize:9,color:t.GREEN,fontFamily:"sans-serif"}}>{"paid "+b.lastPaid}</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:7,flexShrink:0,marginLeft:10}}>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:13,color:t.RED,fontFamily:"sans-serif",fontWeight:700}}>{fmtAmt(b.amount)}</div>
                          {b.frequency!=="monthly"&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{fmtAmt(monthlyEq(b))+"/mo"}</div>}
                        </div>
                        <button onClick={()=>markPaid(b.id)} style={{background:t.GREEN+"14",border:"1px solid "+t.GREEN+"33",borderRadius:5,padding:"3px 7px",color:t.GREEN,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>Paid</button>
                        <button onClick={()=>openEdit(b)} style={{background:t.GOLD+"14",border:"1px solid "+t.GOLD+"33",borderRadius:5,padding:"3px 7px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>Edit</button>
                        {confirmDel===b.id?(
                          <div style={{display:"flex",gap:4}}>
                            <button onClick={()=>{setBills(bs=>bs.filter(x=>x.id!==b.id));setConfirmDel(null);}} style={{background:t.RED+"22",border:"1px solid "+t.RED+"44",borderRadius:4,padding:"2px 6px",color:t.RED,cursor:"pointer",fontSize:9,fontFamily:"sans-serif"}}>Yes</button>
                            <button onClick={()=>setConfirmDel(null)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:4,padding:"2px 6px",color:t.MUTED,cursor:"pointer",fontSize:9,fontFamily:"sans-serif"}}>No</button>
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
function InvestPage({profile}){
  const t=T();
  const[tab,setTab]=useState("ideas");
  const asOfDate=new Date().toLocaleDateString("en-AU",{day:"numeric",month:"long",year:"numeric"});
  const[aiOpps,setAiOpps]=useState(()=>{try{return localStorage.getItem("invest_ai_cache")||"";}catch{return "";}});
  const[aiOppsDate,setAiOppsDate]=useState(()=>{try{return localStorage.getItem("invest_ai_date")||"";}catch{return "";}});
  const[loading,setLoading]=useState(false);
  const[watchlist,setWatchlist]=useState([]);
  const[wForm,setWForm]=useState({ticker:"",name:"",notes:""});
  const[showWAdd,setShowWAdd]=useState(false);
  const getAi=async()=>{
    setLoading(true);
    try{
      const r=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:800,tools:[{type:"web_search_20250305",name:"web_search"}],system:"Investment analyst for "+(profile.riskProfile||["Growth"])[0]+" risk investor in Australia. Portfolio: Shares "+fmt(parseFloat(profile.shareValue)||0)+", Property "+fmt(parseFloat(profile.propertyValue)||0)+", Super "+fmt(parseFloat(profile.superBalance)||0)+", Crypto "+fmt(parseFloat(profile.cryptoValue)||0)+". AVAILABLE CASH TO DEPLOY: "+fmt(parseFloat(profile.cashSavings)||0)+". First briefly assess their current holdings - any concentration risk or opportunities to rebalance. Then give 3-4 specific new opportunities based on their available cash of "+fmt(parseFloat(profile.cashSavings)||0)+". Search for current ASX and global market data. For each opportunity: NAME, ASSET CLASS, WHY NOW (specific catalyst), SUGGESTED ALLOCATION from available cash, RISK. Be specific with dollar amounts based on their cash position.",messages:[{role:"user",content:"Assess my portfolio and suggest where to deploy my available cash based on current market conditions."}]})});
      const d=await r.json();
      const result=(d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n")||"Unable to generate.";
      setAiOpps(result);setAiOppsDate(new Date().toLocaleDateString());
      try{localStorage.setItem("invest_ai_cache",result);localStorage.setItem("invest_ai_date",new Date().toLocaleDateString());}catch{}
    }catch{setAiOpps("Connection error.");}
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
      <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Capital Deployment</div>
      <div style={{fontSize:26,color:t.TEXT,marginBottom:16}}>Opportunities</div>
      <div style={{display:"flex",gap:7,marginBottom:14}}>
        {[["ideas","Curated Ideas"],["live","Live AI Search"],["watchlist","My Watchlist"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"8px",borderRadius:7,border:"1px solid "+(tab===id?t.GOLD:t.BORDER),background:tab===id?t.GOLD+"18":"transparent",color:tab===id?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>
            {label}
          </button>
        ))}
      </div>
      {tab==="ideas"&&ideas.map((idea,i)=>(
        <Card key={i} style={{marginBottom:8,borderLeft:"3px solid "+t.GOLD}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
            <div>
              <div style={{fontSize:13,color:t.TEXT,marginBottom:2}}>{idea.name}</div>
              <div style={{fontSize:9,color:t.GOLD,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1}}>{idea.cls}</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}>
              <div style={{fontSize:11,color:t.GREEN,fontFamily:"sans-serif",fontWeight:600}}>{idea.ret}</div>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{idea.risk}</div>
            </div>
          </div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",lineHeight:1.6}}>{idea.note}</div>
        </Card>
      ))}
      {tab==="live"&&(
        <Card style={{borderColor:t.GOLD+"33"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:aiOpps?12:0}}>
            <div>
              <div style={{fontSize:10,color:t.GOLD,fontFamily:"sans-serif",letterSpacing:1,textTransform:"uppercase"}}>Live Market Intelligence</div>
              <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginTop:2}}>Personalised - web search enabled</div>
            </div>
            <Btn onClick={getAi} disabled={loading}>{loading?"Searching...":"Search Now"}</Btn>
          </div>
          {loading&&(
            <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
              <Skeleton width="90%" height={12}/>
              <Skeleton width="75%" height={12}/>
              <Skeleton width="85%" height={12}/>
            </div>
          )}
          {aiOpps&&!loading&&<div style={{marginTop:10,fontSize:12,color:t.TEXT,lineHeight:1.85,fontFamily:"sans-serif",whiteSpace:"pre-wrap"}}>{aiOpps}</div>}
          {!aiOpps&&!loading&&<div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginTop:8}}>Click Search Now to get current opportunities tailored to your profile.</div>}
        </Card>
      )}
      {tab==="watchlist"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif"}}>{watchlist.length+" stocks on watchlist"}</div>
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
            <div style={{textAlign:"center",padding:32,color:t.MUTED,fontFamily:"sans-serif"}}>
              <div style={{fontSize:28,marginBottom:8}}>W</div>
              <div>No stocks on watchlist - add tickers you want to monitor</div>
            </div>
          )}
          {watchlist.map((w,i)=>(
            <Card key={w.id} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <Tag>{w.ticker}</Tag>
                    {w.name&&<span style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif"}}>{w.name}</span>}
                  </div>
                  {w.notes&&<div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",fontStyle:"italic"}}>{w.notes}</div>}
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginTop:4}}>{"Added: "+w.addedDate}</div>
                </div>
                <button onClick={()=>setWatchlist(wl=>wl.filter(x=>x.id!==w.id))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:12,opacity:.5}}>X</button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <div style={{marginTop:14,padding:"10px 12px",background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:7,fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>
        For informational purposes only. Not financial advice.
      </div>
    </div>
  );
}

function HealthPage({profile,supplements,setSupplements,bodyLog,setPage}){
  const t=T();const[showAdd,setShowAdd]=useState(false);const[form,setForm]=useState({name:"",dose:"",time:"morning",purpose:""});
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
      <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Physical Capital</div>
      <div style={{fontSize:26,color:t.TEXT,marginBottom:16}}>Health and Vitals</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        {vitals.map(v=><StatCard key={v.l} label={v.l} value={v.v} sub={v.sub}/>)}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button onClick={()=>setPage("body")} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:7,padding:"7px 12px",color:t.GOLD,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>Log Metrics</button>
        <button onClick={()=>setPage("workout")} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"7px 12px",color:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>Workouts</button>
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
            <div style={{fontSize:9,color:t.GOLD,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Edit Supplement</div>
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
          <div key={s.id}>
            {i>0&&<Divider/>}
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0"}}>
              <div onClick={()=>setSupplements(ss=>(ss||[]).map(x=>x.id===s.id?{...x,taken:!x.taken}:x))} style={{width:20,height:20,borderRadius:"50%",border:"1.5px solid "+(s.taken?t.GOLD:t.BORDER2),background:s.taken?t.GOLD:"transparent",flexShrink:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {s.taken&&<span style={{fontSize:9,color:"#080808",fontWeight:700}}>V</span>}
              </div>
              <div style={{flex:1}}>
                <span style={{fontSize:12,color:s.taken?t.MUTED:t.TEXT,fontFamily:"sans-serif",textDecoration:s.taken?"line-through":"none"}}>{s.name}</span>
                {s.dose&&<span style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{" - "+s.dose}</span>}
                {s.time&&<span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{" - "+s.time}</span>}
                {s.purpose&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginTop:1}}>{s.purpose}</div>}
              </div>
              <button onClick={()=>openEditSupp(s)} style={{background:t.GOLD+"14",border:"1px solid "+t.GOLD+"33",borderRadius:5,padding:"2px 7px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>Edit</button>
              <button onClick={()=>setSupplements(ss=>(ss||[]).filter(x=>x.id!==s.id))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.5}}>X</button>
            </div>
          </div>
        ))}
        {!(supplements||[]).length&&<div style={{textAlign:"center",padding:"16px 0",color:t.MUTED,fontFamily:"sans-serif",fontSize:12}}>No supplements - add your stack</div>}
      </Card>
    </div>
  );
}

function BodyPage({bodyLog,setBodyLog,profile}){
  const t=T();const[form,setForm]=useState({date:todayStr(),weight:"",bodyFat:"",sleep:"",hrv:""});
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
      <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Body Tracking</div>
      <div style={{fontSize:26,color:t.TEXT,marginBottom:16}}>Metrics History</div>
      <Card style={{marginBottom:14,borderColor:t.GOLD+"44"}}>
        <SectionLabel>Log Today</SectionLabel>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:8}}>
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
                <div style={{fontSize:9,color:m.color,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>{m.label}</div>
                {latest?(
                  <div style={{fontSize:20,color:t.TEXT,fontFamily:"sans-serif",fontWeight:700}}>
                    {latest.v}
                    <span style={{fontSize:10,color:t.MUTED}}>{" target: "+m.target}</span>
                  </div>
                ):<div style={{fontSize:12,color:t.MUTED,fontFamily:"sans-serif"}}>No data yet</div>}
              </div>
              {data.length>=2&&(
                <div style={{fontSize:11,color:data[data.length-1].v<=data[0].v?t.GREEN:t.RED,fontFamily:"sans-serif"}}>
                  {(data[data.length-1].v-data[0].v).toFixed(1)}
                </div>
              )}
            </div>
            {data.length>=2?(
              <div style={{position:"relative"}}>
                <SparkLine data={data.map(d=>d.v)} color={m.color} height={40} target={m.target}/>
                {m.target&&(
                  <div style={{position:"absolute",top:0,right:0,fontSize:8,color:m.color,fontFamily:"sans-serif",background:t.CARD,padding:"1px 4px",borderRadius:3,opacity:.8}}>
                    {"Target: "+m.target}
                  </div>
                )}
              </div>
            ):(
              <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",textAlign:"center",padding:"10px 0"}}>Log more data to see trend</div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function WorkoutPage({workouts,setWorkouts,profile}){
  const t=T();const[showAdd,setShowAdd]=useState(false);const[tab,setTab]=useState("log");
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
    "Bench Press":{muscle:"Chest, Triceps, Shoulders",level:"Beginner",steps:["Lie flat on bench, feet on floor","Grip bar slightly wider than shoulder width","Lower bar to mid-chest with control","Press back up to full extension","Keep wrists straight throughout"],tips:"Keep shoulder blades retracted and lower back neutral. Don't bounce bar off chest."},
    "Squat":{muscle:"Quads, Glutes, Hamstrings",level:"Beginner",steps:["Stand with feet shoulder-width apart, toes slightly out","Brace core and keep chest up","Descend until thighs are parallel or below","Drive through heels to stand","Keep knees tracking over toes"],tips:"Depth is key - aim for parallel. If heels rise, work on ankle mobility."},
    "Deadlift":{muscle:"Hamstrings, Glutes, Back, Traps",level:"Intermediate",steps:["Stand with bar over mid-foot","Hip-hinge to grip bar, hands just outside shins","Take slack out of bar, engage lats","Drive floor away, keep bar close to body","Lock out hips and knees at top"],tips:"The bar should drag up your shins. Never round your lower back under load."},
    "Overhead Press":{muscle:"Shoulders, Triceps, Upper Chest",level:"Intermediate",steps:["Stand with feet shoulder-width, bar at collarbone","Grip just outside shoulders","Press bar straight up, tuck chin to let bar pass","Lock out at top, squeeze shoulders","Lower under control to starting position"],tips:"Squeeze glutes and abs throughout. Don't lean back excessively."},
    "Pull-ups":{muscle:"Lats, Biceps, Rear Delts",level:"Intermediate",steps:["Hang from bar with overhand grip, hands shoulder-width","Depress shoulder blades to initiate","Pull elbows down and back toward hips","Chin clears bar at top","Lower slowly with control"],tips:"Think about pulling elbows to your pockets, not pulling your hands down."},
    "Romanian Deadlift":{muscle:"Hamstrings, Glutes, Lower Back",level:"Intermediate",steps:["Stand with bar at hips, slight knee bend","Hinge at hips pushing them back","Lower bar down legs keeping it close","Feel hamstring stretch at bottom","Drive hips forward to return to start"],tips:"This is a hinge not a squat. Feel the stretch in your hamstrings at the bottom."},
    "Rows":{muscle:"Lats, Rhomboids, Biceps",level:"Beginner",steps:["Hinge forward at hips to 45 degrees","Grip barbell with overhand or neutral grip","Pull bar to lower chest/upper abdomen","Squeeze shoulder blades at top","Lower with control"],tips:"Lead with your elbows, not your hands. Avoid using momentum."},
  };

  const getWorkoutPlan=async()=>{
    setPlanLoading(true);setPlan(null);
    const goals=(profile?.healthGoals||["Build Muscle"]).join(", ");
    try{
      const r=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        model:"claude-haiku-4-5",max_tokens:1500,
        system:"You are an expert personal trainer. Return ONLY valid JSON, no markdown.",
        messages:[{role:"user",content:"Create a 4-day workout split for someone with goals: "+goals+". Return JSON: {split: string, days: [{name: string, focus: string, exercises: [{exercise: string, sets: number, reps: string, rest: string, note: string}]}]}"}]
      })});
      const d=await r.json();
      const text=(d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("");
      const start=text.indexOf("{"),end=text.lastIndexOf("}");
      if(start>-1)setPlan(JSON.parse(text.slice(start,end+1)));
    }catch(e){console.error(e);}
    setPlanLoading(false);
  };
  return (
    <div data-page="true" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Iron and Conditioning</div>
          <div style={{fontSize:26,color:t.TEXT}}>Workout Log</div>
        </div>
        <Btn onClick={()=>setShowAdd(s=>!s)}>+ Log</Btn>
      </div>
      <div style={{display:"flex",gap:7,marginBottom:14}}>
        {[["log","Log"],["progress","Progress"],["records","Records"],["exercises","Exercises"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"7px",borderRadius:7,border:"1px solid "+(tab===id?t.GOLD:t.BORDER),background:tab===id?t.GOLD+"18":"transparent",color:tab===id?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>
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
              <span style={{fontSize:11,color:t.TEXT,fontFamily:"sans-serif"}}>{s.exercise}</span>
              <span style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{s.sets+"x"+s.reps+(s.weight?" @ "+s.weight+"kg":"")}</span>
              <button onClick={()=>setWf(f=>({...f,sets:f.sets.filter(x=>x.id!==s.id)}))} style={{background:"none",border:"none",color:t.RED,cursor:"pointer",fontSize:10}}>X</button>
            </div>
          ))}
          <textarea value={wf.notes} onChange={e=>setWf(f=>({...f,notes:e.target.value}))} placeholder="Notes..." rows={2} style={{width:"100%",background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:6,padding:"7px 10px",color:t.TEXT,fontFamily:"sans-serif",fontSize:12,outline:"none",resize:"vertical",marginTop:7,boxSizing:"border-box"}}/>
          <div style={{display:"flex",gap:8,marginTop:8}}>
            <Btn onClick={save}>Save</Btn>
            <Btn onClick={()=>setShowAdd(false)} variant="ghost">Cancel</Btn>
          </div>
        </Card>
      )}
      {tab==="records"&&(
        <Card>
          <SectionLabel>Personal Records</SectionLabel>
          {Object.entries(prs).length===0&&<div style={{textAlign:"center",padding:"20px 0",color:t.MUTED,fontFamily:"sans-serif",fontSize:12}}>Log workouts with weights to see records</div>}
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {Object.entries(prs).slice(0,12).map(([ex,pr])=>(
              <div key={ex} style={{background:t.CARD2,borderRadius:8,padding:"10px 12px",minWidth:120,flex:1}}>
                <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginBottom:4}}>{ex}</div>
                <div style={{fontSize:18,color:t.GOLD,fontFamily:"sans-serif",fontWeight:700}}>{pr.weight+"kg"}</div>
                <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginTop:2}}>{"x"+pr.reps+" - "+fmtDate(pr.date)}</div>
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
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              <StatCard label="Total Sessions" value={totalWorkouts} color={t.GOLD}/>
              <StatCard label="Total Exercises" value={totalSetsAll} color={t.BLUE}/>
              <StatCard label="Avg per Week" value={avgPerWeek} color={t.GREEN}/>
            </div>
            <Card>
              <SectionLabel>Weekly Volume (sets)</SectionLabel>
              <div style={{display:"flex",gap:4,alignItems:"flex-end",height:80,marginBottom:6}}>
                {last8weeks.map((w,i)=>(
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                    <div style={{fontSize:8,color:t.MUTED,fontFamily:"sans-serif"}}>{w.sets||""}</div>
                    <div style={{width:"100%",background:i===last8weeks.length-1?t.GOLD+"cc":t.GOLD+"44",borderRadius:"3px 3px 0 0",height:((w.sets/maxSets)*60)+"px",minHeight:w.sets>0?3:0,transition:"height .3s"}}/>
                    <div style={{fontSize:7,color:t.MUTED,fontFamily:"sans-serif",textAlign:"center"}}>{w.label}</div>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <SectionLabel>Weekly Total Volume (kg lifted)</SectionLabel>
              <div style={{display:"flex",gap:4,alignItems:"flex-end",height:80,marginBottom:6}}>
                {last8weeks.map((w,i)=>(
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                    <div style={{fontSize:8,color:t.MUTED,fontFamily:"sans-serif"}}>{w.vol>0?w.vol:""}</div>
                    <div style={{width:"100%",background:i===last8weeks.length-1?t.PURPLE+"cc":t.PURPLE+"44",borderRadius:"3px 3px 0 0",height:((w.vol/maxVol)*60)+"px",minHeight:w.vol>0?3:0,transition:"height .3s"}}/>
                    <div style={{fontSize:7,color:t.MUTED,fontFamily:"sans-serif",textAlign:"center"}}>{w.label}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        );
      })()}
      {tab==="log"&&(
        <div>
          {!(workouts||[]).length&&!showAdd&&<div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"sans-serif"}}><div style={{fontSize:32,marginBottom:10}}>W</div><div>No sessions yet</div></div>}
          {(workouts||[]).map(w=>(
            <Card key={w.id} style={{marginBottom:8,borderLeft:"3px solid "+(WCOLORS[w.type]||t.GOLD)}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontSize:9,color:WCOLORS[w.type]||t.GOLD,fontFamily:"sans-serif",textTransform:"uppercase",marginBottom:2}}>{w.type+" - "+w.duration+" min"}</div>
                  <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif"}}>{fmtDate(w.date)}</div>
                </div>
                <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{(w.sets?.length||0)+" exercises"}</div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── EXERCISES TAB ── */}
      {tab==="exercises"&&(
        <div>
          <Card style={{marginBottom:14,borderColor:t.GOLD+"33"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:plan||planLoading?12:0}}>
              <div>
                <div style={{fontSize:10,color:t.GOLD,fontFamily:"sans-serif",letterSpacing:1,textTransform:"uppercase"}}>AI Workout Plan</div>
                <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginTop:2}}>Personalised to your health goals</div>
              </div>
              <button onClick={getWorkoutPlan} disabled={planLoading} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:7,padding:"6px 12px",color:t.GOLD,cursor:planLoading?"default":"pointer",fontFamily:"sans-serif",fontSize:11}}>
                {planLoading?"Building...":"Generate Plan"}
              </button>
            </div>
            {planLoading&&<div style={{display:"flex",flexDirection:"column",gap:8}}>{[90,75,85,70].map((w,i)=><Skeleton key={i} width={w+"%"} height={11}/>)}</div>}
            {plan&&!planLoading&&(
              <div>
                <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginBottom:12}}>{plan.split}</div>
                {(plan.days||[]).map((day,di)=>(
                  <div key={di} style={{marginBottom:12}}>
                    <div style={{fontSize:10,color:t.GOLD,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{day.name+" - "+day.focus}</div>
                    {(day.exercises||[]).map((ex,ei)=>(
                      <div key={ei} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid "+t.BORDER}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif",fontWeight:500}}>{ex.exercise}</div>
                          {ex.note&&<div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginTop:1}}>{ex.note}</div>}
                        </div>
                        <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:8}}>
                          {[{v:ex.sets+"x",l:"sets"},{v:ex.reps,l:"reps"},{v:ex.rest,l:"rest"}].map(m=>(
                            <div key={m.l} style={{textAlign:"center",background:t.CARD2,borderRadius:5,padding:"3px 7px"}}>
                              <div style={{fontSize:11,color:t.GOLD,fontWeight:700}}>{m.v}</div>
                              <div style={{fontSize:8,color:t.MUTED}}>{m.l}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Exercise Library</div>
          {selectedEx?(
            <Card style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div>
                  <div style={{fontSize:18,color:t.TEXT,fontWeight:600}}>{selectedEx}</div>
                  <div style={{fontSize:11,color:t.GOLD,fontFamily:"sans-serif",marginTop:3}}>{EXERCISE_GUIDE[selectedEx]?.muscle}</div>
                </div>
                <button onClick={()=>setSelectedEx(null)} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:6,padding:"4px 10px",color:t.MUTED,cursor:"pointer",fontSize:11,fontFamily:"sans-serif"}}>Back</button>
              </div>
              <div style={{background:t.CARD2,borderRadius:10,height:140,marginBottom:14,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
                <style>{"@keyframes exBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-18px)}} @keyframes exPush{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.65)}}"}</style>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:52,animation:selectedEx==="Squat"||selectedEx==="Deadlift"||selectedEx==="Romanian Deadlift"?"exBounce 2s ease-in-out infinite":"exPush 2s ease-in-out infinite"}}>
                    {selectedEx==="Bench Press"?"P":selectedEx==="Squat"?"S":selectedEx==="Deadlift"?"D":selectedEx==="Overhead Press"?"O":selectedEx==="Pull-ups"?"U":selectedEx==="Rows"?"R":"F"}
                  </div>
                  <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginTop:6}}>{selectedEx}</div>
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>How to perform</div>
                {(EXERCISE_GUIDE[selectedEx]?.steps||[]).map((step,i)=>(
                  <div key={i} style={{display:"flex",gap:10,marginBottom:9,alignItems:"flex-start"}}>
                    <div style={{width:20,height:20,borderRadius:"50%",background:t.GOLD+"22",border:"1px solid "+t.GOLD+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:t.GOLD,fontWeight:700,flexShrink:0}}>{i+1}</div>
                    <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif",lineHeight:1.65,paddingTop:1}}>{step}</div>
                  </div>
                ))}
              </div>
              {EXERCISE_GUIDE[selectedEx]?.tips&&(
                <div style={{padding:"9px 12px",background:t.GOLD+"0A",border:"1px solid "+t.GOLD+"22",borderRadius:7,marginBottom:10}}>
                  <div style={{fontSize:9,color:t.GOLD,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>Pro Tip</div>
                  <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif",lineHeight:1.65}}>{EXERCISE_GUIDE[selectedEx].tips}</div>
                </div>
              )}
              {prs[selectedEx]&&(
                <div style={{padding:"8px 12px",background:t.GREEN+"14",border:"1px solid "+t.GREEN+"33",borderRadius:7,display:"flex",justifyContent:"space-between"}}>
                  <div style={{fontSize:11,color:t.GREEN,fontFamily:"sans-serif"}}>Your personal record</div>
                  <div style={{fontSize:13,color:t.GREEN,fontFamily:"sans-serif",fontWeight:700}}>{prs[selectedEx].weight+"kg x "+prs[selectedEx].reps}</div>
                </div>
              )}
            </Card>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {Object.keys(EXERCISE_GUIDE).map(ex=>(
                <div key={ex} onClick={()=>setSelectedEx(ex)} style={{background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:8,padding:"12px 14px",cursor:"pointer"}}>
                  <div style={{fontSize:13,color:t.TEXT,fontWeight:600,marginBottom:4}}>{ex}</div>
                  <div style={{fontSize:10,color:t.GOLD,fontFamily:"sans-serif",marginBottom:4}}>{EXERCISE_GUIDE[ex].muscle}</div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",background:t.CARD2,padding:"2px 6px",borderRadius:4}}>{EXERCISE_GUIDE[ex].level}</div>
                    {prs[ex]&&<div style={{fontSize:9,color:t.GREEN,fontFamily:"sans-serif"}}>PR: {prs[ex].weight}kg</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReadingPage({books,setBooks}){
  const t=T();
  const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({title:"",author:"",status:"reading",cur:0,tot:300,review:"",rating:0,dateFinished:todayStr()});  // already updated
  const[expandDone,setExpandDone]=useState({});
  const[notePrompt,setNotePrompt]=useState(null);
  const[expandNotes,setExpandNotes]=useState({});
  const[annualGoal,setAnnualGoal]=useState(24);
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
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>The Library</div>
          <div style={{fontSize:26,color:t.TEXT}}>Reading List</div>
        </div>
        <Btn onClick={()=>setShowAdd(s=>!s)}>+ Add</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
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
                <div style={{fontSize:9,color:t.GOLD,fontFamily:"sans-serif",letterSpacing:1,textTransform:"uppercase",marginBottom:2}}>Annual Reading Goal</div>
                <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif"}}>{booksRead+" of "+annualGoal+" books - "+pct+"% complete"}</div>
              </div>
              {editGoal?(
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <input type="number" defaultValue={annualGoal} onBlur={e=>setAnnualGoal(parseInt(e.target.value)||24)} style={{width:52,background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:5,padding:"3px 7px",color:t.TEXT,fontSize:12,fontFamily:"sans-serif",outline:"none",textAlign:"center"}}/>
                  <Btn onClick={()=>setEditGoal(false)} style={{fontSize:10,padding:"4px 8px"}}>Set</Btn>
                </div>
              ):(
                <button onClick={()=>setEditGoal(true)} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"33",borderRadius:5,padding:"4px 9px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>Edit Goal</button>
              )}
            </div>
            <PB value={pct} color={t.GOLD} height={6}/>
            {remaining>0&&(
              <div style={{marginTop:8,display:"flex",gap:14}}>
                <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{remaining+" books to go"}</div>
                {booksPerWeekNeeded>0&&<div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{booksPerWeekNeeded+" per week to finish on time"}</div>}
              </div>
            )}
            {remaining===0&&<div style={{marginTop:8,fontSize:11,color:t.GREEN,fontFamily:"sans-serif",fontWeight:600}}>Annual reading goal achieved!</div>}
          </Card>
        );
      })()}

      {notePrompt&&(
        <Card style={{marginBottom:14,borderColor:t.GOLD+"66"}}>
          {notePrompt.isFinish?(
            <>
              <div style={{fontSize:9,color:t.GREEN,fontFamily:"sans-serif",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Book Finished!</div>
              <div style={{fontSize:13,color:t.TEXT,fontFamily:"sans-serif",marginBottom:14}}>How would you rate it?</div>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14}}>
                {[1,2,3,4,5].map(n=>(
                  <button key={n} onClick={()=>setNotePrompt(p=>({...p,rating:n}))} style={{width:36,height:36,borderRadius:"50%",border:"1px solid "+(n<=(notePrompt.rating||0)?t.GOLD:t.BORDER),background:n<=(notePrompt.rating||0)?t.GOLD+"22":"transparent",color:n<=(notePrompt.rating||0)?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:14,fontWeight:700}}>
                    {n}
                  </button>
                ))}
                {notePrompt.rating>0&&<span style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{["","One star","Two stars","Three stars","Four stars","Five stars"][notePrompt.rating]}</span>}
              </div>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Review / Key Takeaways (optional)</div>
              <textarea
                value={notePrompt.review||""}
                onChange={e=>setNotePrompt(p=>({...p,review:e.target.value}))}
                placeholder="What did you think? Key ideas, favourite quotes, would you recommend it?"
                rows={3}
                style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"9px 12px",color:t.TEXT,fontFamily:"Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.7,boxSizing:"border-box",marginBottom:10}}
              />
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Final Session Note (optional)</div>
              <textarea
                value={notePrompt.text}
                onChange={e=>setNotePrompt(p=>({...p,text:e.target.value}))}
                placeholder="Last pages - anything that stood out?"
                rows={2}
                style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"9px 12px",color:t.TEXT,fontFamily:"Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.7,boxSizing:"border-box"}}
              />
            </>
          ):(
            <>
              <div style={{fontSize:9,color:t.GOLD,fontFamily:"sans-serif",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Session Note</div>
              <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginBottom:10}}>
                {"Pages "+notePrompt.fromPage+" - "+notePrompt.toPage+" - What stood out?"}
              </div>
              <textarea
                autoFocus
                value={notePrompt.text}
                onChange={e=>setNotePrompt(p=>({...p,text:e.target.value}))}
                placeholder="Key idea, quote, or reflection... (optional)"
                rows={3}
                style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"9px 12px",color:t.TEXT,fontFamily:"Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.7,boxSizing:"border-box"}}
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
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Your Rating</div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    {[1,2,3,4,5].map(n=>(
                      <button key={n} onClick={()=>setForm(f=>({...f,rating:n}))} style={{width:32,height:32,borderRadius:"50%",border:"1px solid "+(n<=form.rating?t.GOLD:t.BORDER),background:n<=form.rating?t.GOLD+"22":"transparent",color:n<=form.rating?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:13,fontWeight:700}}>
                        {n}
                      </button>
                    ))}
                    {form.rating>0&&<span style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{["","One star","Two stars","Three stars","Four stars","Five stars"][form.rating]}</span>}
                  </div>
                </div>
                <div>
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Review and Notes</div>
                  <textarea value={form.review} onChange={e=>setForm(f=>({...f,review:e.target.value}))} placeholder="What did you think? Key takeaways, favourite ideas, quotes..." rows={4} style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"10px 12px",color:t.TEXT,fontFamily:"Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.75,boxSizing:"border-box"}}/>
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
            <div style={{fontSize:9,letterSpacing:3,color:col,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:10}}>{sec.label}</div>
            {bs.map(b=>{
              const pct=Math.min(Math.round((b.cur/b.tot)*100),100);
              const notes=b.readingNotes||[];
              const showingNotes=!!expandNotes[b.id];
              return (
                <Card key={b.id} style={{marginBottom:8,borderLeft:"3px solid "+col}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:b.status==="reading"?8:4}}>
                    <div style={{flex:1,marginRight:10}}>
                      <div style={{fontSize:13,color:t.TEXT,marginBottom:2}}>{b.title}</div>
                      {b.author&&<div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{b.author}</div>}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                      {b.status==="reading"&&<span style={{fontSize:11,color:col,fontFamily:"sans-serif",fontWeight:600}}>{pct+"%"}</span>}
                      {b.status==="done"&&(
                        <div style={{textAlign:"right",flexShrink:0}}>
                          {b.rating>0&&(
                            <div style={{display:"flex",gap:3,marginBottom:3,justifyContent:"flex-end"}}>
                              {[1,2,3,4,5].map(n=>(
                                <div key={n} style={{width:10,height:10,borderRadius:"50%",background:n<=b.rating?t.GOLD:t.BORDER2}}/>
                              ))}
                            </div>
                          )}
                          <span style={{fontSize:9,color:t.GREEN,fontFamily:"sans-serif"}}>{b.dateFinished||"Done"}</span>
                        </div>
                      )}
                      <button onClick={()=>setBooks(bs=>bs.filter(x=>x.id!==b.id))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.6}}>X</button>
                    </div>
                  </div>

                  {b.status==="done"&&(b.review||(b.readingNotes||[]).length>0)&&(
                    <div style={{marginTop:8}}>
                      <button onClick={()=>setExpandDone(x=>({...x,[b.id]:!x[b.id]}))} style={{background:"none",border:"none",color:t.GOLD,cursor:"pointer",fontFamily:"sans-serif",fontSize:10,padding:0,display:"flex",alignItems:"center",gap:4}}>
                        {expandDone[b.id]?"Hide ":"Show "}
                        {[b.review?"my review":null,(b.readingNotes||[]).length>0?((b.readingNotes||[]).length+" notes"):null].filter(Boolean).join(" and ")}
                      </button>
                      {expandDone[b.id]&&(
                        <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:10}}>
                          {b.review&&(
                            <div style={{padding:"10px 12px",background:t.CARD2,borderRadius:7,borderLeft:"2px solid "+col}}>
                              <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>My Review</div>
                              <div style={{fontSize:12,color:t.TEXT,fontFamily:"Georgia,serif",lineHeight:1.75}}>{b.review}</div>
                            </div>
                          )}
                          {(b.readingNotes||[]).map(n=>(
                            <div key={n.id} style={{padding:"8px 10px",background:t.CARD2,borderRadius:6,borderLeft:"2px solid "+col}}>
                              <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginBottom:3}}>{"p."+n.fromPage+" - p."+n.toPage+" - "+n.date}</div>
                              <div style={{fontSize:12,color:t.TEXT,fontFamily:"Georgia,serif",lineHeight:1.7}}>{n.text}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {b.status==="reading"&&(
                    <>
                      <PB value={pct} color={col} height={4}/>
                      <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginTop:4,marginBottom:8}}>{b.cur+" / "+b.tot+" pages - "+pct+"%"}</div>
                      <div style={{display:"flex",gap:5,alignItems:"center"}}>
                        {[10,25,50].map(n=>(
                          <button key={n} onClick={()=>addPages(b.id,n)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:6,padding:"5px 8px",color:t.TEXT,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>{"+ "+n}</button>
                        ))}
                        <div style={{display:"flex",gap:4,flex:1,alignItems:"center"}}>
                          <input
                            type="number"
                            placeholder="Page #"
                            min={0}
                            max={b.tot}
                            onKeyDown={e=>{if(e.key==="Enter"&&e.target.value){const p=Math.min(Math.max(0,parseInt(e.target.value)||0),b.tot);setBooks(bs=>bs.map(x=>x.id===b.id?{...x,cur:p,status:p>=x.tot?"done":x.status,dateFinished:p>=x.tot?todayStr():x.dateFinished}:x));e.target.value="";}}}
                            style={{flex:1,background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:6,padding:"5px 8px",color:t.TEXT,fontFamily:"sans-serif",fontSize:11,outline:"none",minWidth:0}}
                          />
                          <span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",flexShrink:0}}>Jump to page</span>
                        </div>
                        <button onClick={()=>markFinished(b.id)} style={{background:t.GREEN+"18",border:"1px solid "+t.GREEN+"44",borderRadius:6,padding:"5px 10px",color:t.GREEN,cursor:"pointer",fontFamily:"sans-serif",fontSize:11,flexShrink:0}}>Done</button>
                      </div>
                    </>
                  )}

                  {notes.length>0&&(
                    <div style={{marginTop:10}}>
                      <button
                        onClick={()=>setExpandNotes(x=>({...x,[b.id]:!x[b.id]}))}
                        style={{background:"none",border:"none",color:t.GOLD,cursor:"pointer",fontFamily:"sans-serif",fontSize:10,padding:0,display:"flex",alignItems:"center",gap:4}}
                      >
                        <span style={{fontSize:10}}>{showingNotes?"v":">"}</span>
                        {notes.length+" reading "+(notes.length===1?"note":"notes")}
                      </button>
                      {showingNotes&&(
                        <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:8}}>
                          {notes.map(n=>(
                            <div key={n.id} style={{padding:"8px 10px",background:t.CARD2,borderRadius:6,borderLeft:"2px solid "+col}}>
                              <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginBottom:4}}>
                                {"p."+n.fromPage+" - p."+n.toPage+" - "+n.date}
                              </div>
                              <div style={{fontSize:12,color:t.TEXT,fontFamily:"Georgia,serif",lineHeight:1.7}}>{n.text}</div>
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
      {!(books||[]).length&&<div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"sans-serif"}}><div style={{fontSize:32,marginBottom:10}}>B</div><div>No books yet</div></div>}
    </div>
  );
}

function WeeklyPage({profile,tasks,goals,habits,habitLog,history,journal,workouts,supplements,bodyLog,weeklyReflections,setWeeklyReflections}){
  const t=T();
  const[aiReview,setAiReview]=useState("");
  const[loading,setLoading]=useState(false);
  const[reflection,setReflection]=useState("");
  const[showReflection,setShowReflection]=useState(false);
  const weekKey="week_"+weekStart;
  const savedReflection=(weeklyReflections||{})[weekKey]||"";
  const last7=Array.from({length:7}).map((_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");});
  const weekStart=last7[0],weekEnd=last7[6];
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
  const genReview=async()=>{
    setLoading(true);
    try{
      const wSummary=weekWorkouts.length?weekWorkouts.map(w=>w.type+" "+w.duration+"min").join(", "):"none";
      const bSummary=weekBody.length?((earliestBody?.weight||"?")+" to "+(latestBody?.weight||"?")+"kg"+(weightChange?(" ("+(parseFloat(weightChange)>0?"+":"")+weightChange+"kg)"):"")):"not logged";
      const avgMood=weekJournal.length?(weekJournal.reduce((a,e)=>a+(e.mood||3),0)/weekJournal.length).toFixed(1):"?";
      const goalsSummary=(goals||[]).map(g=>g.title+" "+g.progress+"% ("+g.period+")").join(", ")||"none";
      const habitDetails=habitPerf.map(h=>h.name+": "+h.done+"/"+h.target).join("\n")||"none";
      const r=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-haiku-4-5",max_tokens:900,system:"Performance coach for "+profile.firstName+". Direct, specific. Structure: WINS (2-3 with numbers), GAPS (1-2), PATTERNS (one data insight), NEXT WEEK (3 priorities). Max 270 words.",messages:[{role:"user",content:"Week "+weekStart+" to "+weekEnd+"\nScores: avg "+avgScore+"/100 - "+daysActive+"/7 active\nHabits ("+habitAvg+"%):\n"+habitDetails+"\nWorkouts ("+weekWorkouts.length+"): "+wSummary+"\nBody: "+bSummary+"\nJournal: "+weekJournal.length+" entries, avg mood "+avgMood+"/5\nGoals: "+goalsSummary}]})});
      const d=await r.json();
      setAiReview((d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n")||"Unable to generate.");
    }catch{setAiReview("Connection error.");}
    setLoading(false);
  };
  return (
    <div data-page="true" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Performance Review</div>
      <div style={{fontSize:26,color:t.TEXT,marginBottom:16}}>Weekly Review</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
        <StatCard label="Avg Score" value={avgScore+"/100"} color={avgScore>=75?t.GREEN:avgScore>=50?t.GOLD:t.RED}/>
        <StatCard label="Days Active" value={daysActive+"/7"} color={t.BLUE}/>
        <StatCard label="Habit Avg" value={habitAvg+"%"} color={t.GOLD}/>
      </div>
      <Card style={{marginBottom:14}}>
        <SectionLabel>Daily Scores</SectionLabel>
        <div style={{display:"flex",gap:4,alignItems:"flex-end",height:72,marginBottom:6}}>
          {last7.map((d,i)=>{
            const sc=scores[i];
            const col=sc>=75?t.GREEN:sc>=50?t.GOLD:sc>0?t.BLUE:t.BORDER;
            return (
              <div key={d} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                <div style={{fontSize:9,color:sc>0?col:t.MUTED,fontFamily:"sans-serif"}}>{sc||"-"}</div>
                <div style={{width:"100%",background:sc>0?col+"66":t.CARD2,borderRadius:"2px 2px 0 0",height:((sc/100)*52)+"px",minHeight:sc>0?3:0}}/>
                <div style={{fontSize:8,color:t.MUTED,fontFamily:"sans-serif"}}>{dayLetters[new Date(d+"T12:00:00").getDay()]}</div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card style={{marginBottom:14}}>
        <SectionLabel>Habit Compliance</SectionLabel>
        {habitPerf.map(h=>(
          <div key={h.id} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <span style={{fontSize:13}}>{h.icon}</span>
                <span style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif"}}>{h.name}</span>
              </div>
              <span style={{fontSize:10,color:h.color,fontFamily:"sans-serif",fontWeight:600}}>{h.done+"/"+h.target}</span>
            </div>
            <PB value={Math.min(Math.round(h.done/h.target*100),100)} color={h.color} height={3}/>
          </div>
        ))}
      </Card>
      <Card style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showReflection?12:0}}>
          <div>
            <div style={{fontSize:10,color:t.GOLD,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1}}>My Reflection</div>
            <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginTop:2}}>Your own notes on the week</div>
          </div>
          <button onClick={()=>setShowReflection(s=>!s)} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:6,padding:"4px 10px",color:t.GOLD,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>{showReflection?"Done":"Write"}</button>
        </div>
        {showReflection&&(
          <div>
            <textarea value={reflection||savedReflection} onChange={e=>setReflection(e.target.value)} placeholder={"What went well? What didn't? What will you do differently next week?"} rows={4} style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"10px 12px",color:t.TEXT,fontFamily:"Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.75,boxSizing:"border-box",marginBottom:8}}/>
            <Btn onClick={()=>{setWeeklyReflections(r=>({...(r||{}),[weekKey]:reflection}));setShowReflection(false);}}>Save Reflection</Btn>
          </div>
        )}
        {!showReflection&&savedReflection&&(
          <div style={{fontSize:12,color:t.TEXT,fontFamily:"Georgia,serif",lineHeight:1.75,fontStyle:"italic"}}>"{savedReflection}"</div>
        )}
        {!showReflection&&!savedReflection&&(
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif"}}>Tap Write to add your own reflection for the week.</div>
        )}
      </Card>
      <Card style={{borderColor:t.GOLD+"33"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:aiReview?12:0}}>
          <div>
            <div style={{fontSize:10,color:t.GOLD,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1}}>AI Weekly Review</div>
            <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginTop:2}}>Habits, workouts, body, mood, goals</div>
          </div>
          <Btn onClick={genReview} disabled={loading}>{loading?"Generating...":"Generate Review"}</Btn>
        </div>
        {loading&&(
          <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
            <Skeleton width="80%" height={12}/>
            <Skeleton width="70%" height={12}/>
            <Skeleton width="90%" height={12}/>
          </div>
        )}
        {aiReview&&!loading&&<div style={{marginTop:10,fontSize:12,color:t.TEXT,lineHeight:1.85,fontFamily:"sans-serif",whiteSpace:"pre-wrap"}}>{aiReview}</div>}
        {!aiReview&&!loading&&<div style={{marginTop:8,fontSize:11,color:t.MUTED,fontFamily:"sans-serif"}}>Generates an honest assessment of your week using all your logged data.</div>}
      </Card>
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
  const sys="Private advisor. Direct, sharp. Use web search for current market data.\n\nCLIENT: "+profile.firstName+" "+(profile.lastName||"")+" | "+(profile.dob?calcAge(profile.dob):profile.age)+" | "+(profile.occupation||"")+" | "+(profile.location||"AU")+"\nNW: "+fmt(profile.netWorth||0)+" of "+fmt(Number(profile.netWorthTarget||3e6))+" ("+Math.round((profile.netWorth||0)/Number(profile.netWorthTarget||3e6)*100)+"%)\nIncome: "+fmt(parseFloat(profile.annualIncome)||0)+" | Shares: "+fmt(parseFloat(profile.shareValue)||0)+" | Property: "+fmt(parseFloat(profile.propertyValue)||0)+"\nDebt: "+fmt(profile.totalDebt||0)+" | Risk: "+((profile.riskProfile||["Growth"])[0])+"\n\nTODAY: Tasks "+tDone+"/"+(tasks||[]).length+" | Habits "+hDone+"/"+(habits||[]).length+" | Supps "+sDone+"/"+(supplements||[]).length+"\nPending high-priority: "+((tasks||[]).filter(tk=>!tk.done&&tk.priority==="high").map(tk=>tk.text).join(", ")||"all done")+"\nGoals: "+((goals||[]).map(g=>g.title+" "+g.progress+"%").join(", ")||"none")+"\n\nFor 'review': cover FINANCES, HEALTH AND HABITS, GOALS, DAILY EXECUTION. Be direct.";
  const send=async text=>{
    const q=text||input.trim();if(!q||loading)return;setInput("");
    const updated=[...msgs,{role:"user",content:q}];setMessages(updated);setLoading(true);
    try{
      const r=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:2000,system:sys,tools:[{type:"web_search_20250305",name:"web_search"}],messages:updated.map(m=>({role:m.role,content:m.content}))})});
      const d=await r.json();
      const reply=(d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n")||"Try again.";
      setMessages(m=>[...m,{role:"assistant",content:reply}]);
    }catch{setMessages(m=>[...m,{role:"assistant",content:"Connection error."}]);}
    setLoading(false);
  };
  const PROMPTS=["Review my dashboard","What should I prioritise?","ASX market update","Accelerate my net worth","Debt payoff strategy","Investment opportunities","Habits to add or swap","Morning briefing"];
  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 100px)",maxWidth:900,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,flexShrink:0}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:4}}>Private Intelligence</div>
          <div style={{fontSize:26,color:t.TEXT}}>AI Advisor</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginTop:2}}>Full dashboard context - Web search</div>
        </div>
        {msgs.length>1&&<button onClick={()=>setMessages([])} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:5,padding:"4px 9px",color:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:10}}>Clear</button>}
      </div>
      {msgs.length===1&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12,flexShrink:0}}>
          {PROMPTS.map(p=>(
            <button key={p} onClick={()=>send(p)} style={{padding:"6px 11px",background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:18,color:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>{p}</button>
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
              <div style={{fontSize:13,color:t.TEXT,lineHeight:1.85,fontFamily:"sans-serif",whiteSpace:"pre-wrap"}}>{m.content}</div>
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
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} placeholder="Ask anything..." disabled={loading} style={{flex:1,background:t.CARD,border:"1px solid "+(loading?t.BORDER:t.GOLD+"44"),borderRadius:9,padding:"11px 14px",color:t.TEXT,fontFamily:"sans-serif",fontSize:13,outline:"none"}}/>
        <Btn onClick={()=>send()} disabled={loading||!input.trim()} style={{padding:"11px 18px"}}>Send</Btn>
      </div>
    </div>
  );
}

function ProfilePage({profile,setProfile,onReset,onRecalibrate,theme,setTheme,nwHistory,tasks,goals,workouts,transactions,journal}){
  const t=T();const[form,setForm]=useState({...profile});const[saved,setSaved]=useState(false);
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
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Account</div>
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
              <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>{"Profile "+pct+"% complete"}</div>
              <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif"}}>{(fields.length-filled)+" fields remaining"}</div>
            </div>
            <PB value={pct} color={t.GOLD} height={5}/>
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginTop:8}}>A complete profile gives the AI Advisor better context and personalises your entire dashboard.</div>
          </Card>
        ):(
          <Card style={{marginBottom:16,borderColor:t.GREEN+"44",padding:"10px 14px"}}>
            <div style={{fontSize:11,color:t.GREEN,fontFamily:"sans-serif"}}>Profile complete</div>
          </Card>
        );
      })()}
      <Card style={{marginBottom:12}}>
        <SectionLabel>Appearance</SectionLabel>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
          {[{id:"obsidian",l:"Obsidian"},{id:"charcoal",l:"Charcoal"},{id:"parchment",l:"Parchment"},{id:"minimal",l:"Minimal"}].map(th=>(
            <button key={th.id} onClick={()=>setTheme(th.id)} style={{padding:"10px",borderRadius:7,border:"1px solid "+(theme===th.id?t.GOLD:t.BORDER),background:theme===th.id?t.GOLD+"18":t.CARD2,color:theme===th.id?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:12}}>
              {th.l}
            </button>
          ))}
        </div>
      </Card>
      <Card style={{marginBottom:12}}>
        <SectionLabel>Country and Currency</SectionLabel>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
          {Object.entries(LOCALES).map(([key,loc])=>{
            const active=(form.locale||"en-AU")===key;
            return (
              <button key={key} onClick={()=>{setForm(f=>({...f,locale:key}));_locale=key;}} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 10px",borderRadius:7,border:"1px solid "+(active?t.GOLD:t.BORDER),background:active?t.GOLD+"14":t.CARD2,cursor:"pointer",textAlign:"left"}}>
                <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",fontWeight:600}}>{loc.flag}</div>
                <div>
                  <div style={{fontSize:11,color:active?t.GOLD:t.TEXT,fontFamily:"sans-serif",fontWeight:active?600:400}}>{loc.label}</div>
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{loc.currency}</div>
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
              <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",minWidth:90,flexShrink:0}}>{l}</div>
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
              <button key={g} onClick={()=>setForm(f=>({...f,healthGoals:active?curGoals.filter(x=>x!==g):[...curGoals,g]}))} style={{padding:"5px 11px",borderRadius:14,border:"1px solid "+(active?t.GOLD:t.BORDER),background:active?t.GOLD+"14":"transparent",color:active?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>
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
              <button key={r} onClick={()=>setForm(f=>({...f,riskProfile:[r]}))} style={{padding:"8px 11px",borderRadius:6,border:"1px solid "+(active?t.GOLD:t.BORDER),background:active?t.GOLD+"14":"transparent",color:active?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:12,textAlign:"left"}}>
                {(active?"* ":"o ")+r}
              </button>
            );
          })}
        </div>
      </Card>
      <Card style={{marginBottom:12}}>
        <SectionLabel>Finances</SectionLabel>
        <button onClick={onRecalibrate} style={{width:"100%",background:t.GOLD+"10",border:"1px solid "+t.GOLD+"33",borderRadius:7,padding:"11px 12px",color:t.GOLD,cursor:"pointer",fontFamily:"sans-serif",fontSize:12,textAlign:"left"}}>Recalibrate Financial Figures</button>
      </Card>
      <Card style={{marginBottom:12}}>
        <SectionLabel>Privacy</SectionLabel>
        <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",lineHeight:1.75,marginBottom:8}}>Data saved to this device only. AI questions sent to Anthropic API only. No accounts, no cloud, no tracking.</div>
        <div style={{padding:"8px 10px",background:t.GOLD+"0A",border:"1px solid "+t.GOLD+"33",borderRadius:6,fontSize:11,color:t.MUTED,fontFamily:"sans-serif",lineHeight:1.6}}>
          Multi-device sync and account login are coming in a future update. Your data will be automatically migrated when accounts are enabled.
        </div>
      </Card>
      <Card style={{marginBottom:12}}>
        <SectionLabel>Export Data</SectionLabel>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {[
            {l:"Net Worth History",fn:()=>{const h=Object.entries(nwHistory||{});if(!h.length)return alert("No history yet.");exportCSV(h.map(([d,v])=>({date:d,value:v})),"networth-history.csv");}},
            {l:"Tasks",fn:()=>tasks.length?exportCSV(tasks.map(({id,...r})=>r),"tasks.csv"):alert("No tasks.")},
            {l:"Goals",fn:()=>goals.length?exportCSV(goals.map(({id,milestones,actions,...r})=>r),"goals.csv"):alert("No goals.")},
            {l:"Workouts",fn:()=>workouts.length?exportCSV(workouts.map(w=>({date:w.date,type:w.type,duration:w.duration,exercises:w.sets?.length||0})),"workouts.csv"):alert("No workouts.")},
            {l:"Transactions",fn:()=>transactions.length?exportCSV(transactions.map(({id,...r})=>r),"transactions.csv"):alert("No transactions.")},
            {l:"Journal",fn:()=>journal.length?exportCSV(journal.map(({id,...r})=>r),"journal.csv"):alert("No journal entries.")},
          ].map(ex=>(
            <button key={ex.l} onClick={ex.fn} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"9px 12px",color:t.TEXT,cursor:"pointer",fontFamily:"sans-serif",fontSize:12,textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              {ex.l}<span style={{color:t.GOLD,fontSize:10}}>CSV</span>
            </button>
          ))}
        </div>
      </Card>
      {authUser&&<Card style={{marginBottom:12}}>
        <SectionLabel>Account</SectionLabel>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>{authUser.email}</div>
            <div style={{fontSize:10,color:t.GREEN,fontFamily:"sans-serif",marginTop:2}}>Syncing across devices</div>
          </div>
          <button onClick={handleSignOut} style={{background:t.RED+"14",border:"1px solid "+t.RED+"33",borderRadius:7,padding:"6px 12px",color:t.RED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>Sign Out</button>
        </div>
      </Card>}
      {!authUser&&<Card style={{marginBottom:12}}>
        <SectionLabel>Account</SectionLabel>
        <div style={{fontSize:12,color:t.MUTED,fontFamily:"sans-serif",marginBottom:10}}>Sign in to sync your data across all devices.</div>
        <Btn onClick={()=>setShowAuth(true)}>Sign In / Create Account</Btn>
      </Card>}
      <div style={{padding:"12px 14px",background:t.CARD,border:"1px solid "+t.RED+"33",borderRadius:7}}>
        <div style={{fontSize:11,color:t.RED,fontFamily:"sans-serif",marginBottom:5}}>Danger Zone</div>
        <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginBottom:8}}>Clears all data and resets to demo mode.</div>
        <button onClick={onReset} style={{background:"none",border:"1px solid "+t.RED+"55",borderRadius:6,padding:"5px 12px",color:t.RED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>Reset App</button>
      </div>
    </div>
  );
}

function BudgetPage({transactions,budgets,setBudgets}){
  const t=T();
  const[showAdd,setShowAdd]=useState(false);
  const[newCat,setNewCat]=useState("");
  const[editingCat,setEditingCat]=useState(null);
  const mk=monthStr();
  const prevMk=(()=>{const d=new Date();d.setMonth(d.getMonth()-1);return d.toISOString().slice(0,7);})();

  // All budget categories = defaults + custom ones stored in budgets
  const defaultCats=EXP_CATS.expense;
  const customCats=Object.keys(budgets).filter(k=>!defaultCats.includes(k)&&k!=="__total");
  const allCats=[...defaultCats,...customCats];
  const budgetedCats=allCats.filter(c=>budgets[c]&&parseFloat(budgets[c])>0);
  const totalBudget=budgetedCats.reduce((s,c)=>s+(parseFloat(budgets[c])||0),0);

  const getSpent=(cat,month)=>transactions.filter(tx=>tx.date.startsWith(month)&&tx.type==="expense"&&tx.category===cat).reduce((s,tx)=>s+tx.amount,0);
  const totalSpent=budgetedCats.reduce((s,c)=>s+getSpent(c,mk),0);
  const totalPct=totalBudget>0?Math.min(Math.round(totalSpent/totalBudget*100),100):0;
  const remaining=totalBudget-totalSpent;

  // 6-month trend per category
  const months6=Array.from({length:6}).map((_,i)=>{
    const d=new Date();d.setMonth(d.getMonth()-(5-i));
    return{key:d.toISOString().slice(0,7),label:d.toLocaleString("default",{month:"short"})};
  });

  const setCatBudget=(cat,val)=>setBudgets(b=>({...b,[cat]:val}));

  return (
    <div data-page="true" style={{maxWidth:800,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Financial Control</div>
          <div style={{fontSize:26,color:t.TEXT}}>Monthly Budget</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginTop:2}}>{new Date().toLocaleString("default",{month:"long",year:"numeric"})}</div>
        </div>
        <Btn onClick={()=>setShowAdd(s=>!s)}>+ Add Category</Btn>
      </div>

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
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginBottom:14}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",letterSpacing:1,marginBottom:4}}>TOTAL BUDGET</div>
              <div style={{fontSize:20,color:t.GOLD,fontFamily:"sans-serif",fontWeight:700}}>{fmt(totalBudget)}</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",letterSpacing:1,marginBottom:4}}>SPENT</div>
              <div style={{fontSize:20,color:totalSpent>totalBudget?t.RED:t.TEXT,fontFamily:"sans-serif",fontWeight:700}}>{fmt(totalSpent)}</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",letterSpacing:1,marginBottom:4}}>REMAINING</div>
              <div style={{fontSize:20,color:remaining>=0?t.GREEN:t.RED,fontFamily:"sans-serif",fontWeight:700}}>{fmt(Math.abs(remaining))}</div>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{remaining>=0?"left":"over budget"}</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",letterSpacing:1,marginBottom:4}}>USED</div>
              <div style={{fontSize:20,color:totalPct>=100?t.RED:totalPct>=80?t.GOLD:t.GREEN,fontFamily:"sans-serif",fontWeight:700}}>{totalPct+"%"}</div>
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
                  <div style={{fontSize:8,color:i===5?t.GOLD:t.MUTED,fontFamily:"sans-serif"}}>{m.label}</div>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            {[{c:t.BLUE+"88",l:"Spent"},{c:t.GOLD,l:"Budget (dashed)"}].map(x=>(
              <div key={x.l} style={{display:"flex",alignItems:"center",gap:3}}>
                <div style={{width:10,height:3,background:x.c,borderRadius:2}}/>
                <span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{x.l}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {allCats.map(cat=>{
          const budget=parseFloat(budgets[cat])||0;
          const spent=getSpent(cat,mk);
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
                    <span style={{fontSize:13,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>{cat}</span>
                    {prevSpent>0&&<span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{"last mo: "+fmt(prevSpent)}</span>}
                  </div>
                  {budget>0&&(
                    <div style={{fontSize:10,color:over?t.RED:t.MUTED,fontFamily:"sans-serif",marginTop:2}}>
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
                        style={{width:90,background:t.CARD2,border:"1px solid "+t.GOLD,borderRadius:5,padding:"4px 8px",color:t.TEXT,fontSize:12,fontFamily:"sans-serif",outline:"none",textAlign:"right"}}
                      />
                      <Btn onClick={()=>setEditingCat(null)} variant="ghost" style={{fontSize:10,padding:"4px 8px"}}>Done</Btn>
                    </>
                  ):(
                    <>
                      {budget>0&&<span style={{fontSize:14,color:over?t.RED:t.GREEN,fontFamily:"sans-serif",fontWeight:700}}>{pct+"%"}</span>}
                      <button onClick={()=>setEditingCat(cat)} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"33",borderRadius:5,padding:"3px 8px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>{budget>0?"Edit":"Set"}</button>
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
          <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"sans-serif"}}>
            <div style={{fontSize:28,marginBottom:10}}>B</div>
            <div style={{marginBottom:8}}>No budgets set yet</div>
            <div style={{fontSize:11}}>Tap Set on any category or add a custom one above</div>
          </div>
        )}
        {defaultCats.filter(c=>!budgets[c]||parseFloat(budgets[c])===0).length>0&&(
          <Card style={{padding:"10px 14px"}}>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Unbudgeted Categories</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {defaultCats.filter(c=>!budgets[c]||parseFloat(budgets[c])===0).map(cat=>{
                const spent=getSpent(cat,mk);
                return (
                  <button key={cat} onClick={()=>setEditingCat(cat)} style={{padding:"5px 11px",borderRadius:14,border:"1px solid "+t.BORDER,background:"transparent",color:spent>0?t.TEXT:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11,display:"flex",alignItems:"center",gap:5}}>
                    {cat}
                    {spent>0&&<span style={{fontSize:9,color:t.RED,fontFamily:"sans-serif"}}>{fmt(spent)}</span>}
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
      <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{label}</div>
      <Inp type={type} value={p[k]||""} onChange={e=>upd(k,e.target.value)} placeholder={ph}/>
    </div>
  );

  if(cur==="welcome") return (
    <div style={{minHeight:"100vh",background:t.BG,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,textAlign:"center"}}>
      <div style={{fontSize:9,letterSpacing:5,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:20}}>The Executive</div>
      <div style={{width:40,height:1,background:t.GOLD,marginBottom:28,opacity:.5}}/>
      <div style={{fontSize:30,color:t.TEXT,lineHeight:1.3,marginBottom:16}}>Your Personal Dashboard</div>
      <div style={{fontSize:13,color:t.MUTED,fontFamily:"sans-serif",lineHeight:1.8,maxWidth:300,marginBottom:40}}>
        Wealth. Health. Performance.<br/>Everything in one private place.<br/><br/>
        <span style={{fontSize:11,opacity:.7}}>Your data stays on your device. Nothing is shared.</span>
      </div>
      <button onClick={next} style={{background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:12,padding:"15px 44px",color:t.BG,cursor:"pointer",fontSize:13,fontFamily:"sans-serif",fontWeight:700,letterSpacing:2,textTransform:"uppercase",marginBottom:14}}>Begin Setup</button>
      <button onClick={()=>onComplete(null)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:12,textDecoration:"underline"}}>Skip — explore demo first</button>
    </div>
  );

  if(cur==="done") return (
    <div style={{minHeight:"100vh",background:t.BG,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,textAlign:"center"}}>
      <div style={{fontSize:48,marginBottom:20}}>V</div>
      <div style={{fontSize:9,letterSpacing:4,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:12}}>You're all set</div>
      <div style={{fontSize:26,color:t.TEXT,marginBottom:12}}>{"Welcome, "+(p.firstName||"Executive")}</div>
      <div style={{fontSize:13,color:t.MUTED,fontFamily:"sans-serif",lineHeight:1.8,maxWidth:300,marginBottom:40}}>Your dashboard is personalised and ready. You can fill in any skipped sections later from within each page.</div>
      <button onClick={finish} style={{background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:12,padding:"15px 44px",color:t.BG,cursor:"pointer",fontSize:13,fontFamily:"sans-serif",fontWeight:700,letterSpacing:2,textTransform:"uppercase"}}>Enter The Executive</button>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:t.BG,display:"flex",flexDirection:"column",maxWidth:540,margin:"0 auto"}}>
      {/* Header */}
      <div style={{padding:"16px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:9,letterSpacing:4,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif"}}>Setup</div>
        <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{step-1+" / "+(STEPS.length-3)}</div>
      </div>
      <div style={{margin:"8px 20px 0",height:2,background:t.BORDER,borderRadius:99,overflow:"hidden"}}>
        <div style={{width:(prog*100)+"%",height:"100%",background:"linear-gradient(90deg,"+t.GOLD+","+t.GL+")",transition:"width .4s"}}/>
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:"auto",padding:"24px 20px 120px"}}>

        {cur==="personal"&&(
          <div>
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:6}}>Personal</div>
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
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:6}}>Body Metrics</div>
            <div style={{fontSize:22,color:t.TEXT,marginBottom:6}}>Physical baseline</div>
            <div style={{fontSize:12,color:t.MUTED,fontFamily:"sans-serif",marginBottom:20}}>Used for body tracking and health scoring. You can skip this and add later.</div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"flex",gap:10}}>{inp("height","Height (cm)","182","number")}{inp("weight","Weight (kg)","85","number")}</div>
              <div style={{display:"flex",gap:10}}>{inp("targetWeight","Target Weight (kg)","80","number")}{inp("bodyFat","Body Fat %","18","number")}</div>
              {inp("sleepHours","Average Sleep (hrs)","7.5","number")}
            </div>
          </div>
        )}

        {cur==="healthgoals"&&(
          <div>
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:6}}>Health Goals</div>
            <div style={{fontSize:22,color:t.TEXT,marginBottom:6}}>What are you working toward?</div>
            <div style={{fontSize:12,color:t.MUTED,fontFamily:"sans-serif",marginBottom:20}}>Select all that apply — used to personalise your supplement recommendations, recipes and AI advice.</div>
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
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>{group.cat}</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {group.items.map(g=>{
                    const on=p.healthGoals.includes(g.id);
                    return (
                      <div key={g.id} onClick={()=>toggleArr("healthGoals",g.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:on?t.GOLD+"18":t.CARD,border:"1px solid "+(on?t.GOLD:t.BORDER),borderRadius:8,cursor:"pointer",transition:"all .2s"}}>
                        <div style={{width:32,height:32,borderRadius:8,background:on?t.GOLD+"33":t.CARD2,border:"1px solid "+(on?t.GOLD:t.BORDER),display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>{g.icon}</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,color:on?t.GOLD:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>{g.id}</div>
                          <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginTop:1}}>{g.desc}</div>
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
            {p.healthGoals.length>0&&<div style={{fontSize:11,color:t.GOLD,fontFamily:"sans-serif",marginTop:4}}>{p.healthGoals.length+" selected"}</div>}
          </div>
        )}

        {cur==="habits"&&(
          <div>
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:6}}>Daily Habits</div>
            <div style={{fontSize:22,color:t.TEXT,marginBottom:6}}>Build your daily routine</div>
            <div style={{fontSize:12,color:t.MUTED,fontFamily:"sans-serif",marginBottom:20}}>Select habits you already practise or want to start. Each one goes straight into your habit tracker with streak tracking.</div>
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
                <div style={{fontSize:9,color:group.color,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>{group.cat}</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {group.items.map(h=>{
                    const on=p.currentHabits.includes(h.id);
                    return (
                      <div key={h.id} onClick={()=>toggleArr("currentHabits",h.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:on?group.color+"18":t.CARD,border:"1px solid "+(on?group.color:t.BORDER),borderRadius:8,cursor:"pointer",transition:"all .2s"}}>
                        <div style={{width:32,height:32,borderRadius:8,background:on?group.color+"33":t.CARD2,border:"1px solid "+(on?group.color:t.BORDER),display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>{h.icon}</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,color:on?group.color:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>{h.id}</div>
                          <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginTop:1}}>{h.desc}</div>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3,flexShrink:0}}>
                          <div style={{fontSize:9,color:on?group.color:t.MUTED,fontFamily:"sans-serif",background:on?group.color+"18":t.CARD2,padding:"2px 6px",borderRadius:6}}>{h.freq}</div>
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
            {p.currentHabits.length>0&&<div style={{fontSize:11,color:t.GOLD,fontFamily:"sans-serif",marginTop:4}}>{p.currentHabits.length+" habits selected"}</div>}
          </div>
        )}

        {cur==="supplements"&&(
          <div>
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:6}}>Supplements</div>
            <div style={{fontSize:22,color:t.TEXT,marginBottom:6}}>Your current stack</div>
            <div style={{fontSize:12,color:t.MUTED,fontFamily:"sans-serif",marginBottom:16}}>Select from common supplements or skip — you can manage these in the Health tab.</div>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
              {SUPP_PRESETS.map(s=>{
                const on=initSupps.some(x=>x.name===s.name);
                return (
                  <div key={s.name} onClick={()=>setInitSupps(ss=>on?ss.filter(x=>x.name!==s.name):[...ss,s])} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:on?t.GOLD+"18":t.CARD,border:"1px solid "+(on?t.GOLD:t.BORDER),borderRadius:8,cursor:"pointer"}}>
                    <div>
                      <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>{s.name}<span style={{fontSize:10,color:t.MUTED,fontWeight:400}}>{" - "+s.dose}</span></div>
                      <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginTop:1}}>{s.purpose}</div>
                    </div>
                    <div style={{width:20,height:20,borderRadius:"50%",border:"1.5px solid "+(on?t.GOLD:t.BORDER),background:on?t.GOLD:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {on&&<span style={{fontSize:9,color:t.BG,fontWeight:700}}>V</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif"}}>{""+initSupps.length+" selected. Add custom supplements in the Health tab."}</div>
          </div>
        )}

        {cur==="goals"&&(
          <div>
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:6}}>Goals</div>
            <div style={{fontSize:22,color:t.TEXT,marginBottom:6}}>What do you want to achieve?</div>
            <div style={{fontSize:12,color:t.MUTED,fontFamily:"sans-serif",marginBottom:20}}>Pick from suggestions or write your own. You can add, edit and track progress in the Goals tab.</div>

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
                <div style={{fontSize:9,color:group.color,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>{group.cat}</div>
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  {group.goals.map(g=>{
                    const on=initGoals.some(x=>x.title===g.title);
                    return (
                      <div key={g.title} onClick={()=>on?setInitGoals(gs=>gs.filter(x=>x.title!==g.title)):setInitGoals(gs=>[...gs,{...g,id:Date.now()+Math.random(),progress:0,milestones:[],actions:[]}])} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:on?group.color+"18":t.CARD,border:"1px solid "+(on?group.color:t.BORDER),borderRadius:7,cursor:"pointer",transition:"all .2s"}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,color:on?group.color:t.TEXT,fontFamily:"sans-serif",fontWeight:on?600:400}}>{g.title}</div>
                        </div>
                        <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",background:t.CARD2,padding:"2px 6px",borderRadius:5,flexShrink:0}}>{g.period==="week"?"Weekly":g.period==="month"?"Monthly":"Annual"}</div>
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
              <div style={{fontSize:10,color:t.GOLD,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Add a Custom Goal</div>
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
                <div style={{fontSize:10,color:t.GOLD,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>{initGoals.length+" goal"+(initGoals.length!==1?"s":"")+" selected"}</div>
                {initGoals.map((g,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,marginBottom:5}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif"}}>{g.title}</div>
                      <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginTop:1}}>{g.category+" - "+g.period}</div>
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
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:6}}>Finances</div>
            <div style={{fontSize:22,color:t.TEXT,marginBottom:6}}>Your financial position</div>
            <div style={{fontSize:12,color:t.MUTED,fontFamily:"sans-serif",marginBottom:20}}>Shares and crypto are tracked separately in the Wealth tab. Skip anything you prefer not to enter now.</div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {inp("annualIncome","Annual Income (AUD)","320,000","number")}
              <div style={{height:1,background:t.BORDER}}/>
              <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",letterSpacing:1,textTransform:"uppercase"}}>Property</div>
              <div style={{display:"flex",gap:10}}>{inp("propertyValue","Property Value","1,000,000","number")}{inp("mortgageDebt","Mortgage Owing","900,000","number")}</div>
              <div style={{height:1,background:t.BORDER}}/>
              <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",letterSpacing:1,textTransform:"uppercase"}}>Other</div>
              <div style={{display:"flex",gap:10}}>{inp("cashSavings","Cash & Savings","50,000","number")}{inp("superBalance","Superannuation","150,000","number")}</div>
              <div style={{height:1,background:t.BORDER}}/>
              <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",letterSpacing:1,textTransform:"uppercase"}}>Other Debts</div>
              <div style={{display:"flex",gap:10}}>{inp("carDebt","Car Finance","0","number")}{inp("creditCardDebt","Credit Cards","0","number")}</div>
              {inp("personalDebt","Personal Loans","0","number")}
            </div>
          </div>
        )}

        {cur==="appearance"&&(
          <div>
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:6}}>Appearance</div>
            <div style={{fontSize:22,color:t.TEXT,marginBottom:6}}>Choose your theme</div>
            <div style={{fontSize:12,color:t.MUTED,fontFamily:"sans-serif",marginBottom:20}}>Pick the look that suits you. You can change this anytime in Profile.</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[
                {id:"obsidian",label:"Obsidian",sub:"Dark - gold accents",bg:"#0D0D0D",card:"#141414",border:"#2A2A2A",accent:"#C9A84C",text:"#E8E0D0",muted:"#7A7060"},
                {id:"charcoal",label:"Charcoal",sub:"Dark - grey tones",bg:"#141414",card:"#1E1E1E",border:"#2E2E2E",accent:"#AFAFAF",text:"#E0E0E0",muted:"#666"},
                {id:"parchment",label:"Parchment",sub:"Light - warm beige",bg:"#F5F0E8",card:"#FFFDF8",border:"#E5DDD0",accent:"#A07830",text:"#1A1208",muted:"#8A7A60"},
                {id:"minimal",label:"Minimal",sub:"Light - pure white",bg:"#FFFFFF",card:"#F7F7F7",border:"#E8E8E8",accent:"#111111",text:"#111111",muted:"#888"},
              ].map(th=>(
                <div key={th.id} onClick={()=>{setP(f=>({...f,theme:th.id}));_themeKey=th.id;setThemeState&&setThemeState(th.id);}} style={{background:th.card,border:"2px solid "+(p.theme===th.id?th.accent:th.border),borderRadius:10,padding:14,cursor:"pointer",transition:"all .2s"}}>
                  <div style={{background:th.bg,borderRadius:7,padding:10,marginBottom:10,border:"1px solid "+th.border}}>
                    <div style={{fontSize:8,color:th.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Today's Score</div>
                    <div style={{fontSize:22,color:th.accent,fontFamily:"sans-serif",fontWeight:700,marginBottom:6}}>78%</div>
                    <div style={{height:3,background:th.border,borderRadius:99,overflow:"hidden"}}><div style={{width:"78%",height:"100%",background:th.accent,borderRadius:99}}/></div>
                    <div style={{display:"flex",gap:4,marginTop:8}}>
                      {[80,71,83].map((v,i)=><div key={i} style={{flex:1,height:3,background:th.border,borderRadius:99,overflow:"hidden"}}><div style={{width:v+"%",height:"100%",background:th.accent,opacity:.6+i*.1,borderRadius:99}}/></div>)}
                    </div>
                  </div>
                  <div style={{fontSize:13,color:th.text,fontFamily:"sans-serif",fontWeight:600,marginBottom:2}}>{th.label}</div>
                  <div style={{fontSize:10,color:th.muted,fontFamily:"sans-serif"}}>{th.sub}</div>
                  {p.theme===th.id&&<div style={{marginTop:6,fontSize:9,color:th.accent,fontFamily:"sans-serif"}}>Selected</div>}
                </div>
              ))}
            </div>
          </div>
        )}
        {cur==="risk"&&(
          <div>
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:6}}>Investment Profile</div>
            <div style={{fontSize:22,color:t.TEXT,marginBottom:6}}>Risk & targets</div>
            <div style={{fontSize:12,color:t.MUTED,fontFamily:"sans-serif",marginBottom:20}}>Used to personalise your AI Advisor and investment ideas.</div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginBottom:10}}>Investment risk tolerance</div>
              {["Conservative - protect capital","Balanced - steady growth","Growth - accept volatility","Aggressive - maximise returns"].map(r=>{
                const on=p.riskProfile===r;
                return <button key={r} onClick={()=>upd("riskProfile",r)} style={{display:"block",width:"100%",textAlign:"left",padding:"12px 14px",borderRadius:8,border:"1px solid "+(on?t.GOLD:t.BORDER),background:on?t.GOLD+"18":"transparent",color:on?t.GOLD:t.TEXT,cursor:"pointer",fontFamily:"sans-serif",fontSize:13,marginBottom:7}}>{on?"V  ":""}{r}</button>;
              })}
            </div>
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginBottom:8}}>Net Worth Target (AUD)</div>
            <Inp type="number" value={p.netWorthTarget} onChange={e=>upd("netWorthTarget",e.target.value)} placeholder="3,000,000"/>
          </div>
        )}

      </div>

      {/* Footer buttons */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:540,padding:"12px 20px",background:"linear-gradient(transparent,"+t.BG+" 30%)",display:"flex",gap:10,paddingBottom:"calc(12px + env(safe-area-inset-bottom))"}}>
        {step>1&&<button onClick={back} style={{flex:1,background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:10,padding:14,color:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:13}}>Back</button>}
        <button onClick={cur==="risk"?next:next} style={{flex:3,background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:10,padding:14,color:t.BG,cursor:"pointer",fontFamily:"sans-serif",fontSize:13,fontWeight:700,letterSpacing:1}}>
          {cur==="risk"?"Finish Setup":"Continue"}
        </button>
        {["body","supplements","goals","financial"].includes(cur)&&(
          <button onClick={next} style={{position:"absolute",top:-28,right:20,background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11,textDecoration:"underline"}}>Skip</button>
        )}
      </div>
    </div>
  );
}

function RecipesPage({profile}){
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
    setLoading(true);setRecipes([]);setSelected(null);setError("");
    const goalStr=healthGoals.join(", ")||"general health";
    const mealStr=mealFilter==="all"?"any meal type":mealFilter;
    const dietStr=dietFilter==="all"?"no specific diet":dietFilter;
    const bodyStr=profile.weight?"Weight: "+profile.weight+"kg, Target: "+(profile.targetWeight||"?")+"kg":"";
    try{
      const r=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        model:"claude-haiku-4-5",
        max_tokens:2000,
        system:"You are a nutritionist and chef. You MUST return ONLY a valid JSON array with no markdown, no backticks, no explanation text before or after. Start your response with [ and end with ].",
        messages:[{role:"user",content:"Generate 2 DIFFERENT and VARIED recipes (never repeat the same dish) for health goals: "+goalStr+". "+bodyStr+". Meal type: "+mealStr+". Diet: "+dietStr+". Session ID: "+Math.random().toString(36).slice(2)+" - use this to ensure variety. Draw from diverse cuisines (Asian, Mediterranean, Mexican, Middle Eastern, etc) and cooking methods. Return a JSON array of 2 objects. Each object must have exactly these fields: title (string), mealType (string), prepTime (string), cookTime (string), difficulty (string), calories (number), protein (number), carbs (number), fat (number), whyItFits (string), ingredients (array of {item, amount, category} where category is one of: Produce, Meat and Fish, Dairy and Eggs, Pantry, Spices, Other), steps (array of strings)."}]
      })});
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

  const MacroBadge=({label,value,color})=>(
    <div style={{textAlign:"center",background:color+"18",border:"1px solid "+color+"44",borderRadius:7,padding:"5px 10px",minWidth:52}}>
      <div style={{fontSize:13,color:color,fontFamily:"sans-serif",fontWeight:700}}>{value}</div>
      <div style={{fontSize:8,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1}}>{label}</div>
    </div>
  );

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
          <button onClick={()=>setSelected(null)} style={{background:"none",border:"none",color:t.GOLD,cursor:"pointer",fontFamily:"sans-serif",fontSize:13,display:"flex",alignItems:"center",gap:6}}>
            {"< Back"}
          </button>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>toggleFav(r)} style={{background:isFav(r)?t.GOLD+"22":"transparent",border:"1px solid "+(isFav(r)?t.GOLD:t.BORDER),borderRadius:7,padding:"6px 12px",color:isFav(r)?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>
              {isFav(r)?"Saved":"Save"}
            </button>
            <button onClick={()=>{addToShoppingList(r,servings);setSelected(null);setShowShoppingList(true);}} style={{background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:7,padding:"6px 14px",color:t.BG,cursor:"pointer",fontFamily:"sans-serif",fontSize:11,fontWeight:700}}>
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
            <div style={{fontSize:9,color:t.GOLD,fontFamily:"sans-serif",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>{r.mealType}</div>
            <div style={{fontSize:22,color:t.TEXT,marginBottom:8}}>{r.title}</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}>
              {[{l:"Prep",v:r.prepTime},{l:"Cook",v:r.cookTime},{l:"Difficulty",v:r.difficulty}].map(x=>(
                <div key={x.l} style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",background:t.CARD2,padding:"3px 9px",borderRadius:10}}>
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
              <div style={{fontSize:9,color:t.GOLD,fontFamily:"sans-serif",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Why this fits your goals</div>
              <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif",lineHeight:1.7}}>{r.whyItFits}</div>
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
                <div style={{fontSize:14,color:t.GOLD,fontFamily:"sans-serif",fontWeight:700}}>{servings}</div>
                <div style={{fontSize:8,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1}}>servings</div>
              </div>
              <button onClick={()=>setServings(s=>Math.min(20,s+1))} style={{background:"none",border:"none",color:t.GOLD,cursor:"pointer",fontSize:18,lineHeight:1,fontWeight:300}}>+</button>
            </div>
          </div>
          {Object.entries(catGroups).map(([cat,items])=>(
            <div key={cat} style={{marginBottom:12}}>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{cat}</div>
              {items.map((ing,i)=>{
                const scaleAmount=(amount)=>{
                  const num=parseFloat(amount);
                  if(isNaN(num))return amount;
                  const scaled=Math.round((num/2*servings)*100)/100;
                  return amount.replace(/^[\d.]+/,scaled);
                };
                return (
                  <div key={i+"-"+servings} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid "+t.BORDER+"66"}}>
                    <span style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif"}}>{ing.item}</span>
                    <span style={{fontSize:12,color:t.GOLD,fontFamily:"sans-serif",fontWeight:600}}>{scaleAmount(ing.amount)}</span>
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{marginTop:10,padding:"8px 12px",background:t.CARD2,borderRadius:7,display:"flex",justifyContent:"space-between"}}>
            {[{l:"Calories",v:Math.round((r.calories||0)/2*servings)},{l:"Protein",v:Math.round((r.protein||0)/2*servings)+"g"},{l:"Carbs",v:Math.round((r.carbs||0)/2*servings)+"g"},{l:"Fat",v:Math.round((r.fat||0)/2*servings)+"g"}].map(m=>(
              <div key={m.l} style={{textAlign:"center"}}>
                <div style={{fontSize:13,color:t.GOLD,fontFamily:"sans-serif",fontWeight:700}}>{m.v}</div>
                <div style={{fontSize:8,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:.5}}>{m.l}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card style={{marginBottom:14}}>
          <SectionLabel>Method</SectionLabel>
          {(r.steps||[]).map((step,i)=>(
            <div key={i} style={{display:"flex",gap:12,marginBottom:14}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:t.GOLD+"22",border:"1px solid "+t.GOLD+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:t.GOLD,fontWeight:700,flexShrink:0}}>{i+1}</div>
              <div style={{fontSize:13,color:t.TEXT,fontFamily:"sans-serif",lineHeight:1.75,paddingTop:2}}>{step}</div>
            </div>
          ))}
        </Card>

        <button onClick={()=>{addToShoppingList(r,servings);setSelected(null);setShowShoppingList(true);}} style={{width:"100%",background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:10,padding:"14px",color:t.BG,cursor:"pointer",fontFamily:"sans-serif",fontSize:13,fontWeight:700,letterSpacing:1}}>
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
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:4}}>Grocery List</div>
            <div style={{fontSize:24,color:t.TEXT}}>Shopping List</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setShowShoppingList(false)} style={{background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:7,padding:"7px 12px",color:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>Back</button>
            <Btn onClick={downloadShoppingList}>Download</Btn>
          </div>
        </div>

        {shoppingList.length===0?(
          <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"sans-serif"}}>
            <div style={{fontSize:32,marginBottom:10}}>C</div>
            <div style={{marginBottom:6}}>Your list is empty</div>
            <div style={{fontSize:11}}>Add recipes to build your shopping list</div>
          </div>
        ):(
          <>
            {/* Progress bar */}
            <div style={{background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:12,padding:"14px 16px",marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>{checkedCount+" of "+totalItems+" items"}</div>
                <div style={{fontSize:13,color:pctDone===100?t.GREEN:t.GOLD,fontFamily:"sans-serif",fontWeight:700}}>{pctDone+"%"}</div>
              </div>
              <PB value={pctDone} color={pctDone===100?t.GREEN:t.GOLD} height={6}/>
              {pctDone===100&&<div style={{fontSize:11,color:t.GREEN,fontFamily:"sans-serif",textAlign:"center",marginTop:8,fontWeight:600}}>All done! You're ready to cook.</div>}
            </div>

            {/* Action buttons */}
            <div style={{display:"flex",gap:8,marginBottom:16}}>
              <button onClick={()=>setShoppingList(sl=>sl.map(x=>({...x,checked:false})))} style={{flex:1,background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:8,padding:"8px",color:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>Uncheck All</button>
              <button onClick={()=>setShoppingList(sl=>sl.filter(x=>!x.checked))} style={{flex:1,background:t.RED+"18",border:"1px solid "+t.RED+"33",borderRadius:8,padding:"8px",color:t.RED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>Remove Checked</button>
              <button onClick={()=>setShoppingList([])} style={{flex:1,background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:8,padding:"8px",color:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>Clear All</button>
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
                      <div style={{fontSize:11,color:allCatChecked?t.MUTED:t.TEXT,fontFamily:"sans-serif",fontWeight:600,textDecoration:allCatChecked?"line-through":"none"}}>{cat}</div>
                      <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{catChecked+"/"+items.length+" checked"}</div>
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
                          <div style={{fontSize:14,color:item.checked?t.MUTED:t.TEXT,fontFamily:"sans-serif",textDecoration:item.checked?"line-through":"none",fontWeight:500}}>{item.item}</div>
                          <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginTop:1}}>{item.fromRecipe}</div>
                        </div>
                        {/* Amount badge */}
                        <div style={{background:item.checked?t.CARD:t.GOLD+"18",border:"1px solid "+(item.checked?t.BORDER:t.GOLD+"44"),borderRadius:6,padding:"3px 9px",flexShrink:0}}>
                          <div style={{fontSize:12,color:item.checked?t.MUTED:t.GOLD,fontFamily:"sans-serif",fontWeight:600}}>{item.amount}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Download button */}
            <button onClick={downloadShoppingList} style={{width:"100%",background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:12,padding:"15px",color:t.BG,cursor:"pointer",fontFamily:"sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,marginTop:8,marginBottom:20}}>
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
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Nutrition</div>
          <div style={{fontSize:26,color:t.TEXT}}>Recipes</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginTop:2}}>Personalised to your health goals</div>
        </div>
        <button onClick={()=>setShowShoppingList(true)} style={{background:t.CARD,border:"1px solid "+t.GOLD+"44",borderRadius:7,padding:"7px 12px",color:t.GOLD,cursor:"pointer",fontFamily:"sans-serif",fontSize:11,display:"flex",alignItems:"center",gap:5}}>
          {"List: "+shoppingList.length}
        </button>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[["discover","Discover"],["favourites","Saved"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid "+(tab===id?t.GOLD:t.BORDER),background:tab===id?t.GOLD+"18":"transparent",color:tab===id?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:12}}>
            {label}{id==="favourites"&&favourites.length>0?" ("+favourites.length+")":""}
          </button>
        ))}
      </div>

      {tab==="favourites"&&(
        <div>
          {favourites.length===0?(
            <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"sans-serif"}}>
              <div style={{fontSize:28,marginBottom:10}}>R</div>
              <div>No saved recipes yet — discover and save your favourites</div>
            </div>
          ):(
            favourites.map((r,i)=>(
              <Card key={i} style={{marginBottom:10,cursor:"pointer"}} onClick={()=>setSelected(r)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:9,color:t.GOLD,fontFamily:"sans-serif",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{r.mealType}</div>
                    <div style={{fontSize:14,color:t.TEXT,fontWeight:600,marginBottom:6}}>{r.title}</div>
                    <div style={{display:"flex",gap:8}}>
                      <span style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{r.calories+" cal"}</span>
                      <span style={{fontSize:10,color:t.GREEN,fontFamily:"sans-serif"}}>{r.protein+"g protein"}</span>
                      <span style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{r.prepTime+" prep"}</span>
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
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Your Goals</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {healthGoals.map(g=>(
                  <div key={g} style={{padding:"3px 10px",borderRadius:10,background:t.GOLD+"18",border:"1px solid "+t.GOLD+"33",fontSize:10,color:t.GOLD,fontFamily:"sans-serif"}}>{g}</div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <Card style={{marginBottom:14}}>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Meal Type</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {MEAL_TYPES.map(m=>(
                    <button key={m} onClick={()=>setMealFilter(m)} style={{padding:"4px 11px",borderRadius:14,border:"1px solid "+(mealFilter===m?t.GOLD:t.BORDER),background:mealFilter===m?t.GOLD+"22":"transparent",color:mealFilter===m?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>
                      {m==="all"?"Any":m}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Dietary Style</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {DIET_FILTERS.map(d=>(
                    <button key={d} onClick={()=>setDietFilter(d)} style={{padding:"4px 11px",borderRadius:14,border:"1px solid "+(dietFilter===d?t.BLUE:t.BORDER),background:dietFilter===d?t.BLUE+"22":"transparent",color:dietFilter===d?t.BLUE:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>
                      {d==="all"?"Any":d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Generate button */}
          <button onClick={generateRecipes} disabled={loading} style={{width:"100%",background:loading?t.BORDER:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:10,padding:"14px",color:loading?t.MUTED:t.BG,cursor:loading?"default":"pointer",fontFamily:"sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,marginBottom:16}}>
            {loading?"Generating recipes...":"Generate Recipes for My Goals"}
          </button>

          {error&&!loading&&(
            <div style={{padding:"10px 14px",background:t.RED+"18",border:"1px solid "+t.RED+"33",borderRadius:8,fontSize:12,color:t.RED,fontFamily:"sans-serif",marginBottom:12}}>{error}</div>
          )}
          {loading&&(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[1,2,3].map(i=><Card key={i} style={{padding:16}}><Skeleton height={14} width="60%" style={{marginBottom:8}}/><Skeleton height={10} width="40%" style={{marginBottom:12}}/><div style={{display:"flex",gap:8}}>{[1,2,3,4].map(j=><Skeleton key={j} width={52} height={40}/>)}</div></Card>)}
            </div>
          )}

          {/* Recipe cards */}
          {!loading&&recipes.length>0&&(
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
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
                  <div style={{fontSize:8,color:t.GOLD,fontFamily:"sans-serif",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{r.mealType}</div>
                  <div style={{fontSize:13,color:t.TEXT,fontWeight:600,marginBottom:6,lineHeight:1.3}}>{r.title}</div>
                  <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
                    <span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",background:t.CARD2,padding:"2px 6px",borderRadius:8}}>{r.prepTime}</span>
                    <span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",background:t.CARD2,padding:"2px 6px",borderRadius:8}}>{r.difficulty}</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:10}}>
                    {[{l:"Cal",v:r.calories,c:t.GOLD},{l:"Protein",v:r.protein+"g",c:t.GREEN},{l:"Carbs",v:r.carbs+"g",c:t.BLUE},{l:"Fat",v:r.fat+"g",c:t.PURPLE}].map(m=>(
                      <div key={m.l} style={{background:m.c+"18",borderRadius:5,padding:"3px 6px",textAlign:"center"}}>
                        <div style={{fontSize:11,color:m.c,fontWeight:700}}>{m.v}</div>
                        <div style={{fontSize:7,color:t.MUTED,textTransform:"uppercase",letterSpacing:.5}}>{m.l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <button onClick={e=>{e.stopPropagation();addToShoppingList(r,servings);}} style={{background:t.GREEN+"18",border:"1px solid "+t.GREEN+"33",borderRadius:5,padding:"3px 8px",color:t.GREEN,cursor:"pointer",fontSize:9,fontFamily:"sans-serif"}}>+ List</button>
                    <button onClick={e=>{e.stopPropagation();toggleFav(r);}} style={{background:"none",border:"none",color:isFav(r)?t.GOLD:t.MUTED,cursor:"pointer",fontSize:14}}>{isFav(r)?"S":"S"}</button>
                  </div>
                  </div>
                </Card>
              ))}
            </div>
            <button onClick={generateRecipes} style={{width:"100%",marginTop:10,background:t.CARD,border:"1px solid "+t.GOLD+"44",borderRadius:10,padding:"12px",color:t.GOLD,cursor:"pointer",fontFamily:"sans-serif",fontSize:13,fontWeight:600}}>Generate More Recipes</button>
            </>
          )}

          {!loading&&recipes.length===0&&(
            <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"sans-serif"}}>
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
        <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Find Anything</div>
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
        <div style={{textAlign:"center",padding:24,color:t.MUTED,fontFamily:"sans-serif",fontSize:12}}>Type at least 2 characters to search</div>
      )}

      {q.length>=2&&results.length===0&&(
        <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"sans-serif"}}>
          <div style={{fontSize:28,marginBottom:10}}>S</div>
          <div style={{fontSize:14,marginBottom:4}}>No results for "{query}"</div>
          <div style={{fontSize:12}}>Try searching tasks, goals, journal entries, books or workouts</div>
        </div>
      )}

      {results.length>0&&(
        <div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginBottom:12}}>{results.length+" result"+(results.length!==1?"s":"")+" for "+chr34+query+chr34}</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {results.map((r,i)=>(
              <Card key={i} style={{cursor:"pointer",borderLeft:"3px solid "+r.color}} onClick={()=>setPage(r.page)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:9,color:r.color,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>{r.type}</div>
                    <div style={{fontSize:13,color:t.TEXT,fontWeight:500,marginBottom:2}}>{r.title}</div>
                    {r.sub&&<div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif"}}>{r.sub}</div>}
                  </div>
                  <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",flexShrink:0,marginLeft:10}}>Go</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!query&&(
        <div>
          <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Search across</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[{l:"Tasks",c:t.GREEN,pg:"tasks"},{l:"Goals",c:t.GOLD,pg:"goals"},{l:"Journal",c:t.PURPLE,pg:"journal"},{l:"Books",c:t.BLUE,pg:"reading"},{l:"Workouts",c:"#D4956A",pg:"workout"},{l:"Recipes",c:t.RED,pg:"recipes"}].map(x=>(
              <div key={x.l} onClick={()=>setPage(x.pg)} style={{background:x.c+"18",border:"1px solid "+x.c+"33",borderRadius:8,padding:"12px 10px",textAlign:"center",cursor:"pointer"}}>
                <div style={{fontSize:12,color:x.c,fontFamily:"sans-serif",fontWeight:600}}>{x.l}</div>
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
function LearnPage({profile,goals,habits}){
  const t=T();
  const[recs,setRecs]=useState([]);
  const[loading,setLoading]=useState(false);
  const[saved,setSaved]=useState([]);
  const[activeTab,setActiveTab]=useState("discover");
  const[filter,setFilter]=useState("all");

  const TYPES=[
    {id:"all",label:"All"},
    {id:"podcast",label:"Podcasts"},
    {id:"book",label:"Books"},
    {id:"youtube",label:"YouTube"},
    {id:"course",label:"Courses"},
  ];

  const TYPE_ICONS={podcast:"M",book:"B",youtube:"Y",course:"C",article:"A"};
  const TYPE_COLORS={podcast:"#C9A84C",book:"#7EB8C9",youtube:"#C97E7E",course:"#7A9E7E",article:"#B07EC9"};

  const getRecommendations=async()=>{
    setLoading(true);setRecs([]);
    const goalStr=(goals||[]).map(g=>g.title).join(", ")||"general self improvement";
    const habitStr=(habits||[]).map(h=>h.name).join(", ")||"healthy habits";
    try{
      const r=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        model:"claude-haiku-4-5",max_tokens:2000,
        system:"You are a personal development expert. Return ONLY valid JSON array, no markdown.",
        messages:[{role:"user",content:"Recommend 8 resources for someone with these goals: "+goalStr+" and these habits: "+habitStr+". Mix of podcasts, books, YouTube channels and courses. Return JSON array of 8 objects each with: {title, type (podcast/book/youtube/course), creator, description (1 sentence, why it fits their goals), category, searchUrl (Google search URL)}. Be specific with real titles and creators."}]
      })});
      const d=await r.json();
      const text=(d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("");
      const start=text.indexOf("["),end=text.lastIndexOf("]");
      if(start>-1&&end>-1)setRecs(JSON.parse(text.slice(start,end+1)));
    }catch(e){console.error(e);}
    setLoading(false);
  };

  const toggleSave=r=>{
    setSaved(ss=>ss.some(s=>s.title===r.title)?ss.filter(s=>s.title!==r.title):[...ss,{...r,savedAt:todayStr()}]);
  };

  const shown=filter==="all"?recs:recs.filter(r=>r.type===filter);

  return (
    <div data-page="true" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Personal Development</div>
          <div style={{fontSize:26,color:t.TEXT}}>Learn</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginTop:3}}>Recommendations tailored to your goals</div>
        </div>
        {saved.length>0&&<button onClick={()=>setActiveTab(activeTab==="saved"?"discover":"saved")} style={{background:t.CARD,border:"1px solid "+t.GOLD+"44",borderRadius:7,padding:"7px 12px",color:t.GOLD,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>{"Saved "+saved.length}</button>}
      </div>

      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {["discover","saved"].map(tab=>(
          <button key={tab} onClick={()=>setActiveTab(tab)} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid "+(activeTab===tab?t.GOLD:t.BORDER),background:activeTab===tab?t.GOLD+"18":"transparent",color:activeTab===tab?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:12,textTransform:"capitalize"}}>{tab}</button>
        ))}
      </div>

      {activeTab==="saved"&&(
        <div>
          {saved.length===0?<div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"sans-serif"}}><div style={{fontSize:28,marginBottom:10}}>B</div><div>No saved resources yet</div></div>:
          saved.map((r,i)=>(
            <Card key={i} style={{marginBottom:10,borderLeft:"3px solid "+(TYPE_COLORS[r.type]||t.GOLD)}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
                    <div style={{fontSize:9,color:TYPE_COLORS[r.type]||t.GOLD,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,background:(TYPE_COLORS[r.type]||t.GOLD)+"18",padding:"2px 7px",borderRadius:5}}>{r.type}</div>
                  </div>
                  <div style={{fontSize:14,color:t.TEXT,fontWeight:600,marginBottom:3}}>{r.title}</div>
                  <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginBottom:4}}>{r.creator}</div>
                  <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",lineHeight:1.6}}>{r.description}</div>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:10}}>
                  <button onClick={()=>window.open(r.searchUrl,"_blank")} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"33",borderRadius:6,padding:"4px 9px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>Find</button>
                  <button onClick={()=>toggleSave(r)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11}}>X</button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab==="discover"&&(
        <>
          <button onClick={getRecommendations} disabled={loading} style={{width:"100%",background:loading?t.BORDER:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:10,padding:"14px",color:loading?t.MUTED:"#080808",cursor:loading?"default":"pointer",fontFamily:"sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,marginBottom:14}}>
            {loading?"Finding recommendations...":"Get Personalised Recommendations"}
          </button>

          {loading&&<div style={{display:"flex",flexDirection:"column",gap:10}}>{[1,2,3].map(i=><Card key={i}><Skeleton height={14} width="60%" style={{marginBottom:8}}/><Skeleton height={10} width="40%"/></Card>)}</div>}

          {recs.length>0&&(
            <>
              <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:14,scrollbarWidth:"none"}}>
                {TYPES.map(tp=>(
                  <button key={tp.id} onClick={()=>setFilter(tp.id)} style={{flexShrink:0,padding:"4px 12px",borderRadius:14,border:"1px solid "+(filter===tp.id?t.GOLD:t.BORDER),background:filter===tp.id?t.GOLD+"22":"transparent",color:filter===tp.id?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>{tp.label}</button>
                ))}
              </div>
              {shown.map((r,i)=>(
                <Card key={i} style={{marginBottom:10,borderLeft:"3px solid "+(TYPE_COLORS[r.type]||t.GOLD)}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
                        <div style={{fontSize:9,color:TYPE_COLORS[r.type]||t.GOLD,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,background:(TYPE_COLORS[r.type]||t.GOLD)+"18",padding:"2px 7px",borderRadius:5}}>{r.type}</div>
                        {r.category&&<div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{r.category}</div>}
                      </div>
                      <div style={{fontSize:14,color:t.TEXT,fontWeight:600,marginBottom:3}}>{r.title}</div>
                      <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginBottom:6}}>{r.creator}</div>
                      <div style={{fontSize:12,color:t.MUTED,fontFamily:"sans-serif",lineHeight:1.65}}>{r.description}</div>
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:10,flexDirection:"column"}}>
                      <button onClick={()=>window.open(r.searchUrl,"_blank")} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"33",borderRadius:6,padding:"5px 10px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>Find</button>
                      <button onClick={()=>toggleSave(r)} style={{background:saved.some(s=>s.title===r.title)?t.GREEN+"18":"transparent",border:"1px solid "+(saved.some(s=>s.title===r.title)?t.GREEN:t.BORDER),borderRadius:6,padding:"5px 10px",color:saved.some(s=>s.title===r.title)?t.GREEN:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>{saved.some(s=>s.title===r.title)?"Saved":"Save"}</button>
                    </div>
                  </div>
                </Card>
              ))}
            </>
          )}

          {!loading&&recs.length===0&&(
            <div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"sans-serif"}}>
              <div style={{fontSize:32,marginBottom:10}}>G</div>
              <div style={{fontSize:14,marginBottom:8}}>Ready to learn?</div>
              <div style={{fontSize:12}}>Tap Generate to get personalised podcasts, books, YouTube channels and courses based on your goals</div>
            </div>
          )}
        </>
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
          <button onClick={()=>setViewing(null)} style={{background:"none",border:"none",color:t.GOLD,cursor:"pointer",fontFamily:"sans-serif",fontSize:13}}>Back</button>
          <div style={{flex:1}}/>
          <button onClick={()=>{openEdit(n);setViewing(null);}} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"33",borderRadius:6,padding:"5px 11px",color:t.GOLD,cursor:"pointer",fontSize:11,fontFamily:"sans-serif"}}>Edit</button>
          <button onClick={()=>{setNotes(ns=>ns.filter(x=>x.id!==n.id));setViewing(null);}} style={{background:t.RED+"18",border:"1px solid "+t.RED+"33",borderRadius:6,padding:"5px 11px",color:t.RED,cursor:"pointer",fontSize:11,fontFamily:"sans-serif"}}>Delete</button>
        </div>
        <Card>
          <div style={{fontSize:9,color:(CAT_COLORS_N[n.category]||CAT_COLORS_N[n.category.replace(" ","")]||t.GOLD),fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>{n.category}</div>
          <div style={{fontSize:22,color:t.TEXT,marginBottom:6}}>{n.title}</div>
          <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginBottom:16}}>{n.updatedAt}</div>
          <div style={{fontSize:14,color:t.TEXT,lineHeight:1.85,whiteSpace:"pre-wrap",fontFamily:"Georgia,serif"}}>{n.content}</div>
        </Card>
      </div>
    );
  }

  return (
    <div data-page="true" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Private</div>
          <div style={{fontSize:26,color:t.TEXT}}>Notes</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginTop:3}}>{notes.length+" note"+(notes.length!==1?"s":"")}</div>
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
              <label style={{display:"flex",alignItems:"center",gap:6,color:t.TEXT,fontFamily:"sans-serif",fontSize:12,cursor:"pointer",flexShrink:0}}>
                <input type="checkbox" checked={form.pinned} onChange={e=>setForm(f=>({...f,pinned:e.target.checked}))} style={{accentColor:t.GOLD}}/>Pin
              </label>
            </div>
            <textarea value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} placeholder="Write anything..." rows={6} style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"10px 12px",color:t.TEXT,fontFamily:"Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.8,boxSizing:"border-box"}}/>
            <div style={{display:"flex",gap:8}}><Btn onClick={save}>{editing?"Save":"Add"}</Btn><Btn onClick={()=>{setShowAdd(false);setEditing(null);}} variant="ghost">Cancel</Btn></div>
          </div>
        </Card>
      )}

      {/* Category filter */}
      <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:14,scrollbarWidth:"none"}}>
        {[{id:"all",label:"All"},...CATS.map(c=>({id:c,label:c}))].filter(c=>c.id==="all"||notes.some(n=>n.category===c.id)).map(c=>(
          <button key={c.id} onClick={()=>setFilter(c.id)} style={{flexShrink:0,padding:"4px 12px",borderRadius:14,border:"1px solid "+(filter===c.id?t.GOLD:t.BORDER),background:filter===c.id?t.GOLD+"22":"transparent",color:filter===c.id?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>{c.label}</button>
        ))}
      </div>

      {shown.length===0&&<div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"sans-serif"}}><div style={{fontSize:32,marginBottom:10}}>N</div><div style={{fontSize:14,marginBottom:8}}>No notes yet</div><div style={{fontSize:12}}>Tap + New Note to start capturing ideas</div></div>}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {shown.map(n=>(
          <div key={n.id} onClick={()=>setViewing(n.id)} style={{background:t.CARD,border:"1px solid "+(n.pinned?t.GOLD:t.BORDER),borderRadius:10,padding:14,cursor:"pointer",borderTop:"3px solid "+(CAT_COLORS_N[n.category]||t.GOLD),transition:"border-color .2s"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div style={{fontSize:9,color:CAT_COLORS_N[n.category]||t.GOLD,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1}}>{n.category}{n.pinned&&" - Pinned"}</div>
            </div>
            <div style={{fontSize:13,color:t.TEXT,fontWeight:600,marginBottom:5,lineHeight:1.3}}>{n.title}</div>
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",lineHeight:1.6,overflow:"hidden",maxHeight:40}}>{n.content.slice(0,80)}{n.content.length>80?"...":""}</div>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginTop:8}}>{n.updatedAt}</div>
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

  const daysUntil=d=>{if(!d)return null;const diff=Math.round((new Date(d)-new Date())/(1000*60*60*24));return diff;};

  return (
    <div data-page="true" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Professional Network</div>
          <div style={{fontSize:26,color:t.TEXT}}>Services</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginTop:3}}>Your advisors and service providers</div>
        </div>
        <Btn onClick={()=>{setForm(emptyForm);setEditing(null);setShowAdd(s=>!s);}}>+ Add</Btn>
      </div>

      {/* Follow-up alerts */}
      {services.filter(s=>s.nextFollow&&daysUntil(s.nextFollow)<=7&&daysUntil(s.nextFollow)>=0).map(s=>(
        <div key={s.id} style={{padding:"9px 13px",background:t.GOLD+"14",border:"1px solid "+t.GOLD+"33",borderRadius:7,display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:t.GOLD,flexShrink:0}}/>
          <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif",flex:1}}>{"Follow up with "+s.name+" - "+daysUntil(s.nextFollow)+" day"+(daysUntil(s.nextFollow)!==1?"s":"")+" away"}</div>
        </div>
      ))}

      {showAdd&&(
        <Card style={{marginBottom:14,borderColor:t.GOLD+"44"}}>
          <SectionLabel>{editing?"Edit Contact":"New Contact"}</SectionLabel>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:2}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Name</div>
                <Inp value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="John Smith"/>
              </div>
              <div style={{flex:1.5}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Role</div>
                <Sel value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                  {ROLES.map(r=><option key={r}>{r}</option>)}
                </Sel>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Firm</div>
                <Inp value={form.firm} onChange={e=>setForm(f=>({...f,firm:e.target.value}))} placeholder="Firm name"/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Phone</div>
                <Inp value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="0400 000 000"/>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Email</div>
                <Inp value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="email@firm.com"/>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Last Contact</div>
                <Inp type="date" value={form.lastContact} onChange={e=>setForm(f=>({...f,lastContact:e.target.value}))}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Follow-up Date</div>
                <Inp type="date" value={form.nextFollow} onChange={e=>setForm(f=>({...f,nextFollow:e.target.value}))}/>
              </div>
            </div>
            <div>
              <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Notes from last meeting</div>
              <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Key points, action items, advice given..." rows={3} style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"10px 12px",color:t.TEXT,fontFamily:"Georgia,serif",fontSize:12,outline:"none",resize:"vertical",lineHeight:1.7,boxSizing:"border-box"}}/>
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
            <div style={{fontSize:9,color:col,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>{role}</div>
            {group.map(s=>{
              const followDays=daysUntil(s.nextFollow);
              return (
                <Card key={s.id} style={{marginBottom:8,borderLeft:"3px solid "+col}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:s.notes?8:0}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:15,color:t.TEXT,fontWeight:600,marginBottom:3}}>{s.name}</div>
                      {s.firm&&<div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginBottom:4}}>{s.firm}</div>}
                      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                        {s.phone&&<a href={"tel:"+s.phone} style={{fontSize:11,color:t.GOLD,fontFamily:"sans-serif",textDecoration:"none"}}>{s.phone}</a>}
                        {s.email&&<a href={"mailto:"+s.email} style={{fontSize:11,color:t.BLUE,fontFamily:"sans-serif",textDecoration:"none"}}>{s.email}</a>}
                      </div>
                      {s.lastContact&&<div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginTop:4}}>{"Last contact: "+s.lastContact}</div>}
                      {s.nextFollow&&<div style={{fontSize:10,color:followDays<=7?t.GOLD:t.MUTED,fontFamily:"sans-serif",marginTop:2}}>{"Follow up: "+s.nextFollow+(followDays!==null?" ("+followDays+"d)":"")}</div>}
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:10}}>
                      <button onClick={()=>openEdit(s)} style={{background:t.GOLD+"14",border:"1px solid "+t.GOLD+"33",borderRadius:6,padding:"4px 9px",color:t.GOLD,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>Edit</button>
                      {confirmDel===s.id?(
                        <div style={{display:"flex",gap:4,alignItems:"center"}}>
                          <button onClick={()=>{setServices(ss=>ss.filter(x=>x.id!==s.id));setConfirmDel(null);}} style={{background:t.RED+"22",border:"1px solid "+t.RED+"44",borderRadius:5,padding:"3px 7px",color:t.RED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>Yes</button>
                          <button onClick={()=>setConfirmDel(null)} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:5,padding:"3px 7px",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>No</button>
                        </div>
                      ):(
                        <button onClick={()=>setConfirmDel(s.id)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.5}}>X</button>
                      )}
                    </div>
                  </div>
                  {s.notes&&<div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",lineHeight:1.65,borderTop:"1px solid "+t.BORDER,paddingTop:8,fontStyle:"italic"}}>"{s.notes}"</div>}
                </Card>
              );
            })}
          </div>
        );
      })}

      {!services.length&&<div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"sans-serif"}}><div style={{fontSize:32,marginBottom:10}}>P</div><div style={{fontSize:14,marginBottom:8}}>No contacts yet</div><div style={{fontSize:12}}>Add your financial advisor, accountant, mortgage broker and other key contacts</div></div>}
    </div>
  );
}

function App(){
  const[hydrated,setHydrated]=useState(false);
  const[splash,setSplash]=useState(true);
  const[authToken,setAuthToken]=useState(()=>{try{return localStorage.getItem("exec_token")||null;}catch{return null;}});
  const[authUser,setAuthUser]=useState(null);
  const[showAuth,setShowAuth]=useState(false);
  const[authMode,setAuthMode]=useState("signin");
  const[authEmail,setAuthEmail]=useState("");
  const[authPassword,setAuthPassword]=useState("");
  const[authLoading,setAuthLoading]=useState(false);
  const[authError,setAuthError]=useState("");
  const[syncing,setSyncing]=useState(false);
  useEffect(()=>{
    const tid=setTimeout(()=>setSplash(false),2500);
    return()=>clearTimeout(tid);
  },[]);
  const[profile,setProfile]=useState(null);
  const[page,setPage]=useState("dashboard");
  const[theme,setThemeState]=useState("obsidian");
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
  const[bills,setBills]=useState([]);
  const[debts,setDebts]=useState([]);
  const[history,setHistory]=useState({});
  const[bodyLog,setBodyLog]=useState([]);
  const[habits,setHabits]=useState(D_HABITS);
  const[habitLog,setHabitLog]=useState({});
  const[holdings,setHoldings]=useState([]);
  const[budgets,setBudgets]=useState({});
  const[weeklyReflections,setWeeklyReflections]=useState({});
  const[notes,setNotes]=useState([]);
  const[services,setServices]=useState([]);
  const[cryptoHoldings,setCryptoHoldings]=useState([]);
  const[advisorMessages,setAdvisorMessages]=useState([]);
  const[lastSaved,setLastSaved]=useState(null);
  const[nwHistory,setNwHistory]=useState({
    [new Date(Date.now()-5*30*864e5).toISOString().slice(0,7)]:620000,
    [new Date(Date.now()-4*30*864e5).toISOString().slice(0,7)]:710000,
    [new Date(Date.now()-3*30*864e5).toISOString().slice(0,7)]:780000,
    [new Date(Date.now()-2*30*864e5).toISOString().slice(0,7)]:850000,
    [new Date(Date.now()-1*30*864e5).toISOString().slice(0,7)]:910000
  });
  const[showBriefing,setShowBriefing]=useState(false);
  const[celebration,setCelebration]=useState(null);
  const[seenMilestones,setSeenMilestones]=useState([]);
  const[showRecalibrate,setShowRecalibrate]=useState(false);
  const isMobile=useIsMobile();
  const market=useMarket();
  const portfolio=usePortfolio(holdings);
  const cryptoPortfolio=useCrypto(cryptoHoldings);

  useEffect(()=>{
    const today=todayStr();
    let saved=loadData();
    if(saved){
      saved=applyDailyReset(saved,today);
      if(saved.theme){const k=THEME_ALIASES[saved.theme]||saved.theme;_themeKey=k;setThemeState(k);}
      if(saved.profile){setProfile(saved.profile);if(saved.profile.locale)_locale=saved.profile.locale;}
      if(saved.tasks)setTasks(saved.tasks);
      if(saved.goals)setGoals(saved.goals);
      if(saved.completed)setCompleted(saved.completed);
      if(saved.supplements)setSupplements(saved.supplements);
      if(saved.workouts)setWorkouts(saved.workouts);
      if(saved.transactions)setTransactions(saved.transactions);
      if(saved.journal)setJournal(saved.journal);
      if(saved.books)setBooks(saved.books);
      if(saved.bills)setBills(saved.bills);
      if(saved.debts)setDebts(saved.debts);
      if(saved.history)setHistory(saved.history);
      if(saved.bodyLog)setBodyLog(saved.bodyLog);
      if(saved.habits)setHabits(saved.habits);
      if(saved.habitLog)setHabitLog(saved.habitLog);
      if(saved.holdings)setHoldings(saved.holdings);
      if(saved.cryptoHoldings)setCryptoHoldings(saved.cryptoHoldings);
      if(saved.nwHistory)setNwHistory(prev=>({...prev,...saved.nwHistory}));
      if(saved.seenMilestones)setSeenMilestones(saved.seenMilestones);
      if(saved.sidebarCollapsed!==undefined)setSidebarCollapsed(saved.sidebarCollapsed);
      if(saved.budgets)setBudgets(saved.budgets);
      if(saved.weeklyReflections)setWeeklyReflections(saved.weeklyReflections);
      if(saved.notes)setNotes(saved.notes);
      if(saved.services)setServices(saved.services);
      if(saved.advisorMessages)setAdvisorMessages(saved.advisorMessages);
    }
    setHydrated(true);
  },[]);

  useEffect(()=>{
    if(!hydrated)return;
    const dataToSave = {lastSavedDate:todayStr(),theme,profile,tasks,goals,completed,supplements,workouts,transactions,journal,books,bills,debts,notes,services,history,bodyLog,habits,habitLog,holdings,cryptoHoldings,nwHistory,seenMilestones,sidebarCollapsed,advisorMessages:advisorMessages.slice(-40),budgets,weeklyReflections};
    saveData(dataToSave);
    if(authToken && authUser?.id){
      supabase.save(authUser.id, authToken, dataToSave).catch(()=>{});
    }
    setLastSaved(Date.now());
  },[hydrated,theme,profile,tasks,goals,completed,supplements,workouts,transactions,journal,books,bills,history,bodyLog,habits,habitLog,holdings,nwHistory,seenMilestones,sidebarCollapsed]);

  const setTheme=th=>{const k=THEME_ALIASES[th]||th;_themeKey=k;setThemeState(k);};
  const tDone=tasks.filter(tk=>tk.done).length;
  const sDone=supplements.filter(s=>s.taken).length;
  const tS=tasks.length?Math.round(tDone/tasks.length*40):0;
  const sS=supplements.length?Math.round(sDone/supplements.length*30):0;
  const gS=goals.length?Math.round(goals.filter(g=>g.progress>=50).length/goals.length*30):0;
  const todayScore=tS+sS+gS;

  useEffect(()=>{
    if(!hydrated)return;
    setHistory(h=>({...h,[todayStr()]:{score:todayScore,tasks:tDone,supps:sDone}}));
  },[todayScore,hydrated]);

  // Midnight reset — handles app left open overnight
  useEffect(()=>{
    const now=new Date();
    const msUntilMidnight=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,1)-now;
    const tid=setTimeout(()=>{
      setTasks(ts=>ts.map(t=>t.done?{...t,done:false}:t));
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

  if(splash){
    return (
      <div style={{position:"fixed",inset:0,background:"#080808",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",zIndex:9999,minHeight:"100vh",minHeight:"-webkit-fill-available"}}>
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
    return <div style={{minHeight:"100vh",background:"#080808"}}/>;
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
        localStorage.setItem("exec_token", res.access_token);
        setAuthToken(res.access_token);
        setAuthUser(res.user);
        // Load cloud data
        const cloudData = await supabase.load(res.user.id, res.access_token);
        const hasCloudData = cloudData && (cloudData.profile || cloudData.tasks?.length || cloudData.habits?.length);
        if(hasCloudData){
          const d = applyDailyReset(cloudData, todayStr());
          if(d.profile)setProfile(d.profile);
          if(d.tasks)setTasks(d.tasks);
          if(d.goals)setGoals(d.goals);
          if(d.completed)setCompleted(d.completed);
          if(d.supplements)setSupplements(d.supplements);
          if(d.habits)setHabits(d.habits);
          if(d.habitLog)setHabitLog(d.habitLog);
          if(d.workouts)setWorkouts(d.workouts);
          if(d.transactions)setTransactions(d.transactions);
          if(d.journal)setJournal(d.journal);
          if(d.books)setBooks(d.books);
          if(d.bills)setBills(d.bills);
          if(d.debts)setDebts(d.debts);
          if(d.notes)setNotes(d.notes);
          if(d.services)setServices(d.services);
          if(d.bodyLog)setBodyLog(d.bodyLog);
          if(d.nwHistory)setNwHistoryFull(prev=>({...prev,...d.nwHistory}));
          if(d.theme){_themeKey=THEME_ALIASES[d.theme]||d.theme;setThemeState(d.theme);}
        } else {
          // No cloud data — migrate from localStorage
          const localData = loadData();
          if(localData){
            const d = applyDailyReset(localData, todayStr());
            if(d.profile)setProfile(d.profile);
            if(d.tasks)setTasks(d.tasks);
            if(d.goals)setGoals(d.goals);
            if(d.completed)setCompleted(d.completed);
            if(d.supplements)setSupplements(d.supplements);
            if(d.habits)setHabits(d.habits);
            if(d.habitLog)setHabitLog(d.habitLog);
            if(d.workouts)setWorkouts(d.workouts);
            if(d.transactions)setTransactions(d.transactions);
            if(d.journal)setJournal(d.journal);
            if(d.books)setBooks(d.books);
            if(d.bills)setBills(d.bills);
            if(d.debts)setDebts(d.debts);
            if(d.notes)setNotes(d.notes);
            if(d.services)setServices(d.services);
            if(d.bodyLog)setBodyLog(d.bodyLog);
            if(d.nwHistory)setNwHistoryFull(prev=>({...prev,...d.nwHistory}));
            if(d.theme){_themeKey=THEME_ALIASES[d.theme]||d.theme;setThemeState(d.theme);}
            await supabase.save(res.user.id, res.access_token, localData).catch(()=>{});
          }
        }
        setShowAuth(false);
      }else{
        // Only show error if there's no token — ignore non-critical warnings
        const errMsg = res.error_description||res.msg||res.error||"";
        if(errMsg) setAuthError(errMsg);
        else setAuthError("Sign in failed. Check your email and password.");
      }
    }catch(e){setAuthError("Connection error. Please try again.");}
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
    setAuthToken(null);setAuthUser(null);
  };

  const handleReset=()=>{
    localStorage.removeItem(SK);
    setProfile(null);setTasks(D_TASKS);setGoals(D_GOALS);setCompleted([]);
    setSupplements(D_SUPPS);setWorkouts([]);setTransactions([]);setJournal([]);
    setBooks(D_BOOKS);setBills([]);setHistory({});setBodyLog([]);
    setSeenMilestones([]);setHabits(D_HABITS);setHabitLog({});setHoldings([]);
    setCryptoHoldings([]);setBudgets({});setAdvisorMessages([]);
    setShowSetup(true);
    setPage("dashboard");
  };

  const t=T();
  const activeProfile=profile||DEMO;
  if(activeProfile.locale)_locale=activeProfile.locale;
  const liveShareValue=holdings.length>0&&portfolio.totalValue>0?portfolio.totalValue:parseFloat(activeProfile.shareValue)||0;
  const liveCryptoValue=(cryptoHoldings||[]).length>0&&cryptoPortfolio.totalValue>0?cryptoPortfolio.totalValue:parseFloat(activeProfile.cryptoValue)||0;
  const liveAssets=(parseFloat(activeProfile.propertyValue)||0)+(parseFloat(activeProfile.cashSavings)||0)+(parseFloat(activeProfile.superBalance)||0)+liveCryptoValue+liveShareValue;
  const hasLiveData=(holdings.length>0&&portfolio.totalValue>0)||(cryptoHoldings.length>0&&cryptoPortfolio.totalValue>0);
  const liveProfile=hasLiveData?{...activeProfile,shareValue:liveShareValue,cryptoValue:liveCryptoValue,totalAssets:liveAssets,netWorth:liveAssets-(activeProfile.totalDebt||0)}:activeProfile;
  const nwHistoryFull={...nwHistory,[monthStr()]:liveProfile.netWorth||0};
  const savedLabel=lastSaved&&Date.now()-lastSaved<4000?"Saved":"";
  const pg={profile:liveProfile,tasks,setTasks,goals,setGoals,completed,setCompleted,supplements,setSupplements,workouts,setWorkouts,transactions,setTransactions,journal,setJournal,books,setBooks,bills,setBills,history,bodyLog,setBodyLog,habits,setHabits,habitLog,setHabitLog,holdings,setHoldings,portfolio,cryptoHoldings,setCryptoHoldings,cryptoPortfolio,budgets,setBudgets,setPage,streak,market,nwHistory:nwHistoryFull,setShowBriefing,setShowRecalibrate,syncing,authUser,setShowAuth};

  return (
    <div style={{display:"flex",minHeight:"100vh",background:t.BG,color:t.TEXT}}>
      <style>{"*{box-sizing:border-box;margin:0;padding:0;} html,body,#root{width:100%;min-height:100vh;} ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-thumb{background:"+t.BORDER2+";border-radius:2px;} @keyframes sk{0%,100%{opacity:.4}50%{opacity:.8}} button:hover{opacity:.85;} input::placeholder,textarea::placeholder{color:"+t.MUTED2+";} @media(max-width:767px){[data-page]{max-width:100%!important;margin:0!important;} body,#root{overflow-x:hidden;}}"}</style>
      {celebration&&<MilestoneCelebration milestone={celebration} onClose={()=>setCelebration(null)}/>}
      {showBriefing&&<MorningBriefing profile={liveProfile} tasks={tasks} onClose={()=>setShowBriefing(false)}/>}
      {showRecalibrate&&<RecalibrateModal profile={activeProfile} onSave={p=>{setProfile(p);setShowRecalibrate(false);}} onClose={()=>setShowRecalibrate(false)}/>}
      {showAuth&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:t.CARD,border:"1px solid "+t.GOLD+"44",borderRadius:14,maxWidth:380,width:"100%",padding:28}}>
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:4}}>The Executive</div>
            <div style={{fontSize:22,color:t.TEXT,marginBottom:6}}>{authMode==="signin"?"Sign In":"Create Account"}</div>
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginBottom:20}}>{authMode==="signin"?"Your data syncs across all devices":"Free account - your data stays private"}</div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
              <input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="Email address" style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"10px 12px",color:t.TEXT,fontFamily:"sans-serif",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"}}/>
              <input type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(authMode==="signin"?handleSignIn():handleSignUp())} placeholder="Password (min 6 chars)" style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"10px 12px",color:t.TEXT,fontFamily:"sans-serif",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"}}/>
            </div>
            {authError&&<div style={{fontSize:11,color:authError.includes("created")?t.GREEN:t.RED,fontFamily:"sans-serif",marginBottom:12,padding:"7px 10px",background:authError.includes("created")?t.GREEN+"14":t.RED+"14",borderRadius:6}}>{authError}</div>}
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <Btn onClick={authMode==="signin"?handleSignIn:handleSignUp} disabled={authLoading} style={{width:"100%",padding:"12px",fontSize:12}}>
                {authLoading?(authMode==="signin"?"Signing in...":"Creating account..."):(authMode==="signin"?"Sign In":"Create Account")}
              </Btn>
              <button onClick={()=>{setAuthMode(m=>m==="signin"?"signup":"signin");setAuthError("");}} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:12,textDecoration:"underline",padding:"4px 0"}}>
                {authMode==="signin"?"No account? Create one free":"Already have an account? Sign in"}
              </button>
              <button onClick={()=>setShowAuth(false)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:11,opacity:.6}}>Continue without account</button>
            </div>
          </div>
        </div>
      )}
      <Sidebar page={page} setPage={setPage} profile={activeProfile} theme={theme} setTheme={setTheme} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} savedLabel={savedLabel}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,width:isMobile?"100%":"auto"}}>
        {!profile&&(isMobile?(
          <div style={{margin:"0 14px",marginTop:"calc(14px + env(safe-area-inset-top))",background:t.GOLD+"14",border:"1px solid "+t.GOLD+"44",borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:11,color:t.GOLD,fontFamily:"sans-serif",fontWeight:600}}>Demo Mode</div>
              <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginTop:2}}>Tap to set up your profile</div>
            </div>
            <button onClick={()=>setPage("profile")} style={{background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:8,padding:"8px 14px",color:"#080808",cursor:"pointer",fontFamily:"sans-serif",fontSize:12,fontWeight:700,flexShrink:0}}>Set Up</button>
          </div>
        ):(
          <div style={{background:t.GOLD+"14",borderBottom:"1px solid "+t.GOLD+"33",padding:"7px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:11,color:t.GOLD,fontFamily:"sans-serif"}}>Demo Mode - William Sterling</div>
            <button onClick={()=>setShowSetup(true)} style={{background:"linear-gradient(135deg,"+t.GOLD+","+t.GL+")",border:"none",borderRadius:6,padding:"4px 12px",color:"#080808",cursor:"pointer",fontFamily:"sans-serif",fontSize:11,fontWeight:700}}>Set Up Profile</button>
          </div>
        ))}
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",alignItems:isMobile?"stretch":"center",minHeight:"100vh",background:t.BG}}>
          <div style={{width:"100%",maxWidth:isMobile?undefined:1100,padding:isMobile?"12px 12px":"28px 32px",flex:1,paddingTop:isMobile?"calc(16px + env(safe-area-inset-top))":"calc(28px + env(safe-area-inset-top))",paddingBottom:isMobile?"calc(16px + env(safe-area-inset-bottom) + 70px)":"28px",boxSizing:"border-box"}}>
          {page==="search"&&<SearchPage tasks={tasks} goals={goals} journal={journal} books={books} workouts={workouts} recipes={[]} setPage={setPage}/>}
          {page==="dashboard"&&<DashboardPage {...pg} transactions={transactions} isMobile={isMobile}/>}
          {page==="tasks"&&<TasksPage tasks={tasks} setTasks={setTasks}/>}
          {page==="habits"&&<HabitsPage habits={habits} setHabits={setHabits} habitLog={habitLog} setHabitLog={setHabitLog}/>}
          {page==="goals"&&<GoalsPage goals={goals} setGoals={setGoals} completed={completed} setCompleted={setCompleted}/>}
          {page==="journal"&&<JournalPage entries={journal} setEntries={setJournal}/>}
          {page==="wealth"&&<WealthPage profile={liveProfile} nwHistory={nwHistoryFull} setShowRecalibrate={()=>setShowRecalibrate(true)} holdings={holdings} setHoldings={setHoldings} portfolio={portfolio} cryptoHoldings={cryptoHoldings} setCryptoHoldings={setCryptoHoldings} cryptoPortfolio={cryptoPortfolio}/>}
          {page==="projectorDISABLED"&&<ProjectorPage profile={liveProfile}/>}
          {page==="cashflow"&&<CashFlowPage transactions={transactions} setTransactions={setTransactions}/>}
          {page==="bills"&&<BillsPage bills={bills} setBills={setBills}/>}
          {page==="budget"&&<BudgetPage transactions={transactions} budgets={budgets} setBudgets={setBudgets}/>}
          {page==="debt"&&<DebtPage profile={liveProfile} setProfile={setProfile} debts={debts} setDebts={setDebts}/>}
          {page==="invest"&&<InvestPage profile={liveProfile}/>}
          {page==="recipes"&&<RecipesPage profile={liveProfile}/> }
          {page==="health"&&<HealthPage profile={liveProfile} supplements={supplements} setSupplements={setSupplements} bodyLog={bodyLog} setPage={setPage}/>}
          {page==="body"&&<BodyPage bodyLog={bodyLog} setBodyLog={setBodyLog} profile={liveProfile}/>}
          {page==="workout"&&<WorkoutPage workouts={workouts} setWorkouts={setWorkouts} profile={liveProfile}/>}
          {page==="reading"&&<ReadingPage books={books} setBooks={setBooks}/>}
          {page==="weekly"&&<WeeklyPage profile={liveProfile} tasks={tasks} goals={goals} habits={habits} habitLog={habitLog} history={history} journal={journal} workouts={workouts} supplements={supplements} bodyLog={bodyLog}/>}
          {page==="learn"&&<LearnPage profile={liveProfile} goals={goals} habits={habits}/>}
          {page==="notes"&&<NotesPage notes={notes} setNotes={setNotes}/>}
          {page==="services"&&<ServicesPage services={services} setServices={setServices}/>}
          {page==="advisor"&&<AdvisorPage profile={liveProfile} tasks={tasks} goals={goals} supplements={supplements} habits={habits} habitLog={habitLog} messages={advisorMessages} setMessages={setAdvisorMessages}/>}
          {page==="profile"&&<ProfilePage profile={activeProfile} setProfile={setProfile} onReset={handleReset} onRecalibrate={()=>setShowRecalibrate(true)} theme={theme} setTheme={setTheme}/>}
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
