import{useState,useEffect,useRef,useCallback,Component}from"react";

const THEMES={
  dark:{BG:"#080808",CARD:"#111",CARD2:"#181818",BORDER:"#1E1E1E",BORDER2:"#2A2A2A",TEXT:"#E4DDD0",MUTED:"#6A6050",MUTED2:"#3A3028",GOLD:"#C9A84C",GL:"#E8C96A",RED:"#C97E7E",GREEN:"#7A9E7E",BLUE:"#7EB8C9",PURPLE:"#B07EC9"},
  light:{BG:"#F5F0E8",CARD:"#FFFDF8",CARD2:"#F0EBE0",BORDER:"#E5DDD0",BORDER2:"#D5C8B8",TEXT:"#1A1208",MUTED:"#8A7A60",MUTED2:"#C5B8A0",GOLD:"#A07830",GL:"#C9A84C",RED:"#A05050",GREEN:"#507850",BLUE:"#507890",PURPLE:"#805090"}
};
let _themeKey="dark";
const T=()=>THEMES[_themeKey]||THEMES.dark;
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
const fmt=n=>{
  if(!n&&n!==0)return L().symbol+"0";
  const s=L().symbol,v=Math.abs(n);
  const f=v>=1e6?s+(v/1e6).toFixed(2)+"M":v>=1e4?s+(v/1e3).toFixed(0)+"k":s+Math.round(v).toLocaleString();
  return n<0?"-"+f:f;
};
const todayStr=()=>new Date().toISOString().split("T")[0];
const monthStr=()=>new Date().toISOString().slice(0,7);
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
const EXERCISES=["Bench Press","Squat","Deadlift","Overhead Press","Pull-ups","Rows","Dips","Leg Press","Lat Pulldown","Bicep Curl","Romanian Deadlift"];
const WTYPES=["Strength","Hypertrophy","Cardio","HIIT","Mobility","Sport"];
const WCOLORS={Strength:"#C9A84C",Hypertrophy:"#B07EC9",Cardio:"#7A9E7E",HIIT:"#C97E7E",Mobility:"#7EB8C9",Sport:"#D4956A"};
const JP=["What is my number 1 priority today?","What am I grateful for?","What would make today a win?","What obstacle must I overcome?","What did I learn yesterday?"];
const NAV=[
  ["dashboard","🏠","Dashboard"],["tasks","📝","Tasks"],["habits","🔥","Habits"],
  ["goals","🎯","Goals"],["journal","📓","Journal"],["reading","📚","Reading"],
  ["wealth","💸","Wealth"],["projector","📈","Wealth Forecast"],["cashflow","💰","Cash Flow"],
  ["bills","🔁","Bills"],
  ["budget","📊","Budget"],["tax","📋","Tax"],["debt","📉","Debt"],
  ["invest","💵","Invest"],["health","💊","Health"],["body","💪","Body"],
  ["workout","🏋","Workout"],["weekly","📊","Weekly"],["advisor","🤖","AI Advisor"],
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
    return{...saved,lastSavedDate:today,tasks:(saved.tasks||[]).map(t=>({...t,done:false})),supplements:(saved.supplements||[]).map(s=>({...s,taken:false}))};
  return saved;
};
const DEMO={
  firstName:"William",lastName:"Sterling",age:"34",location:"Brisbane, QLD",
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
          asx:{price:a.price,pct:a.pct,loading:false,error:!!a.error},
          audusd:{price:u.price,pct:u.pct,loading:false,error:!!u.error},
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
  const safeH=holdings||[];
  const totalValue=safeH.reduce((s,h)=>s+(h.currentPrice?h.currentPrice*h.shares:h.avgCost?h.avgCost*h.shares:0),0);
  const totalCost=safeH.reduce((s,h)=>s+(h.avgCost?h.avgCost*h.shares:0),0);
  return{prices:{},lastUpdated:null,totalValue,totalCost,totalGain:totalValue-totalCost,totalGainPct:totalCost>0?(totalValue-totalCost)/totalCost*100:0,dayChange:0,refresh:()=>{}};
}

function useCrypto(holdings){
  const safeH=holdings||[];
  const totalValue=safeH.reduce((s,h)=>s+(h.currentPrice?h.currentPrice*h.amount:h.avgCost?h.avgCost*h.amount:0),0);
  const totalCost=safeH.reduce((s,h)=>s+(h.avgCost?h.avgCost*h.amount:0),0);
  return{prices:{},lastUpdated:null,totalValue,totalCost,totalGain:totalValue-totalCost,totalGainPct:totalCost>0?(totalValue-totalCost)/totalCost*100:0,dayChange:0,refresh:()=>{}};
}

class ErrorBoundary extends Component{
  constructor(p){super(p);this.state={error:null};}
  static getDerivedStateFromError(e){return{error:e};}
  render(){
    if(this.state.error){
      const t=THEMES.dark;
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
    ["Command",["dashboard","weekly","advisor"]],
    ["Execute",["tasks","habits","goals","journal","reading"]],
    ["Wealth",["wealth","projector","cashflow","bills","budget","tax","debt","invest"]],
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
              <div style={{display:"flex",gap:8}}>
                {["dark","light"].map(th=>(
                  <button key={th} onClick={()=>setTheme(th)} style={{flex:1,padding:"8px",borderRadius:7,border:"1px solid "+(theme===th?t.GOLD:t.BORDER),background:theme===th?t.GOLD+"18":"transparent",color:theme===th?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:12}}>
                    {th==="dark"?"Dark":"Light"}
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
          <div style={{display:"flex",gap:5}}>
            {["dark","light"].map(th=>(
              <button key={th} onClick={()=>setTheme(th)} style={{flex:1,padding:"4px",borderRadius:5,border:"1px solid "+(theme===th?t.GOLD:t.BORDER),background:theme===th?t.GOLD+"18":"transparent",color:theme===th?t.GOLD:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>
                {th==="dark"?"Dark":"Light"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardPage({profile,tasks,setTasks,goals,supplements,history,streak,market,nwHistory,setPage,setShowBriefing,habits,habitLog,setHabitLog,bills,transactions,isMobile}){
  const t=T();
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
  const upcoming=(bills||[]).filter(b=>(new Date(b.nextDue+"T12:00:00")-new Date())/864e5<=3);
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
      <div style={{display:"flex",flexDirection:isMobile?"column":"row",justifyContent:"space-between",alignItems:isMobile?"center":"center",textAlign:isMobile?"center":"left",gap:isMobile?10:0}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:4}}>Dashboard</div>
          <div style={{fontSize:24,color:t.TEXT}}>
            {"Good "+(new Date().getHours()<12?"morning":"afternoon")+", "}
            <span style={{color:t.GOLD}}>{profile.firstName}</span>
          </div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginTop:2}}>{new Date().toLocaleDateString(_locale,{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
        </div>
        <button onClick={()=>setShowBriefing(true)} style={{background:t.GOLD+"18",border:"1px solid "+t.GOLD+"44",borderRadius:8,padding:"7px 12px",color:t.GOLD,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>Morning Brief</button>
      </div>
      <div style={{padding:"9px 13px",background:t.CARD2,borderRadius:7,borderLeft:"3px solid "+t.GOLD+"33"}}>
        <div style={{fontSize:11,color:t.MUTED,fontFamily:"Georgia,serif",fontStyle:"italic"}}>"{quote}"</div>
      </div>
      {/* Score card - full width on mobile, 1/3 on desktop */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:10}}>
        <Card style={{background:t.CARD2,border:"1px solid "+scoreColor+"44",padding:"14px",display:"flex",alignItems:"center",gap:14}}>
          <div style={{flexShrink:0}}>
            <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",letterSpacing:1,marginBottom:4}}>TODAY'S SCORE</div>
            <div style={{display:"flex",alignItems:"baseline",gap:3}}>
              <div style={{fontSize:isMobile?38:48,color:scoreColor,fontFamily:"sans-serif",fontWeight:700,lineHeight:1}}>{todayScore}</div>
              <div style={{fontSize:14,color:t.MUTED,fontFamily:"sans-serif"}}>%</div>
            </div>
            <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginTop:2}}>{streak+" day streak"}</div>
          </div>
          <div style={{flex:1}}>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[{l:"Tasks",v:tPct,c:t.GREEN},{l:"Habits",v:hbPct,c:t.GOLD},{l:"Supps",v:sPct,c:t.BLUE}].map(x=>(
                <div key={x.l} style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",width:34}}>{x.l}</div>
                  <div style={{flex:1}}><PB value={x.v} color={x.c} height={4}/></div>
                  <div style={{fontSize:9,color:x.c,fontFamily:"sans-serif",width:28,textAlign:"right"}}>{x.v+"%"}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr",gap:10}}>
        <Card style={{padding:"14px",cursor:"pointer"}} onClick={()=>setPage("cashflow")}>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",letterSpacing:1,marginBottom:10}}>CASH FLOW - THIS MONTH</div>
          {monthIncome===0&&monthExpense===0?(
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",textAlign:"center",padding:"8px 0"}}>No transactions yet</div>
          ):(
            <>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
                {[{l:"Income",v:monthIncome,c:t.GREEN},{l:"Expenses",v:monthExpense,c:t.RED}].map(x=>(
                  <div key={x.l} style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",width:52}}>{x.l}</div>
                    <div style={{flex:1}}><PB value={monthIncome>0?Math.round(x.v/monthIncome*100):0} color={x.c} height={4}/></div>
                    <div style={{fontSize:9,color:x.c,fontFamily:"sans-serif",width:52,textAlign:"right",fontWeight:600}}>{fmt(x.v)}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"1px solid "+t.BORDER,paddingTop:8}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>Net</div>
                <div style={{fontSize:16,color:monthNet>=0?t.GREEN:t.RED,fontFamily:"sans-serif",fontWeight:700}}>{(monthNet>=0?"+":"")+fmt(monthNet)}</div>
              </div>
            </>
          )}
        </Card>
        <Card style={{padding:"14px",cursor:"pointer"}} onClick={()=>setPage("bills")}>
          <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",letterSpacing:1,marginBottom:10}}>BILLS</div>
          {!bills||bills.length===0?(
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",textAlign:"center",padding:"8px 0"}}>No bills tracked yet</div>
          ):(
            <>
              <div style={{marginBottom:8}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginBottom:4}}>Monthly recurring</div>
                <div style={{fontSize:22,color:t.RED,fontFamily:"sans-serif",fontWeight:700}}>{fmt(monthlyBills)}</div>
              </div>
              {nextBill&&(
                <div style={{borderTop:"1px solid "+t.BORDER,paddingTop:8}}>
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginBottom:3}}>Next due</div>
                  <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>{nextBill.name}</div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:2}}>
                    <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{nextBill.nextDue}</div>
                    <div style={{fontSize:12,color:t.RED,fontFamily:"sans-serif",fontWeight:600}}>{fmt(nextBill.amount)}</div>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
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
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <SectionLabel>Today's Progress</SectionLabel>
            <div style={{background:t.CARD2,borderRadius:12,padding:"2px 8px"}}>
              <span style={{fontSize:11,color:t.GOLD,fontFamily:"sans-serif",fontWeight:700}}>{streak+" day streak"}</span>
            </div>
          </div>
          <div style={{display:"flex",gap:12,justifyContent:"space-around",marginBottom:12}}>
            {rings.map(ring=>(
              <div key={ring.label} onClick={()=>setPage(ring.page)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,cursor:"pointer"}}>
                <div style={{position:"relative",width:76,height:76}}>
                  <svg width={76} height={76} style={{transform:"rotate(-90deg)"}}>
                    <circle cx={38} cy={38} r={r} fill="none" stroke={t.BORDER2} strokeWidth={7}/>
                    <circle cx={38} cy={38} r={r} fill="none" stroke={ring.c} strokeWidth={7} strokeDasharray={(Math.min(ring.pct/100,1)*circ)+","+circ} strokeLinecap="round" style={{transition:"stroke-dasharray .7s"}}/>
                  </svg>
                  <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                    <div style={{fontSize:12,color:ring.c,fontFamily:"sans-serif",fontWeight:700,lineHeight:1}}>{ring.pct+"%"}</div>
                  </div>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:11,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>{ring.label}</div>
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{ring.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card onClick={()=>setPage("wealth")}>
          <SectionLabel action={<span style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>Details</span>}>Net Worth</SectionLabel>
          <div style={{fontSize:30,color:t.GOLD,fontFamily:"sans-serif",fontWeight:700,marginBottom:2}}>{fmt(nw)}</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginBottom:10}}>{"Target: "+fmt(nwT)+" - "+nwPct+"%"}</div>
          <SparkLine data={[...nwVals,nw]} color={t.GOLD} height={48} labels={nwLabels}/>
          <div style={{marginTop:8}}><PB value={nwPct} color={t.GOLD} height={3}/></div>
        </Card>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 1fr",gap:14}}>
        <Card>
          <SectionLabel action={<button onClick={()=>setPage("tasks")} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>All</button>}>Priority Actions</SectionLabel>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>
            <span>{tDone+"/"+tasks.length+" done"}</span>
            <span>{(tasks.length?Math.round(tDone/tasks.length*100):0)+"%"}</span>
          </div>
          <div style={{marginBottom:10}}><PB value={tasks.length?Math.round(tDone/tasks.length*100):0} color={t.GREEN} height={3}/></div>
          {highTasks.slice(0,4).map((tk,i)=>(
            <div key={tk.id}>
              {i>0&&<Divider/>}
              <div onClick={()=>togTask(tk.id)} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 0",cursor:"pointer"}}>
                <div style={{width:18,height:18,borderRadius:"50%",border:"1.5px solid "+(tk.done?t.GOLD:t.BORDER2),background:tk.done?t.GOLD:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {tk.done&&<span style={{fontSize:9,color:"#080808",fontWeight:700}}>V</span>}
                </div>
                <span style={{flex:1,fontSize:12,color:tk.done?t.MUTED:t.TEXT,fontFamily:"sans-serif",textDecoration:tk.done?"line-through":"none"}}>{tk.text}</span>
                <div style={{width:6,height:6,borderRadius:"50%",background:t.RED,flexShrink:0}}/>
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <SectionLabel action={<button onClick={()=>setPage("goals")} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>All</button>}>Goals</SectionLabel>
          {goalPeriods.map(period=>{
            const g=goals.find(g=>g.period===period);
            if(!g)return null;
            const col=CAT_COLORS[g.category]||t.GOLD;
            return (
              <div key={period} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <div>
                    <div style={{fontSize:8,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1}}>{periodLabels[period]}</div>
                    <div style={{fontSize:11,color:t.TEXT,fontFamily:"sans-serif"}}>{g.title}</div>
                  </div>
                  <span style={{fontSize:12,color:col,fontFamily:"sans-serif",fontWeight:700}}>{g.progress+"%"}</span>
                </div>
                <PB value={g.progress} color={col} height={3}/>
              </div>
            );
          })}
        </Card>
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
              <div style={{padding:"6px 0"}}>
                <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginBottom:3}}>{m.l}</div>
                {m.d.loading?(
                  <Skeleton width={80} height={12}/>
                ):(
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <div style={{fontSize:14,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>{m.fx?m.d.price?.toFixed(4):m.d.price?.toLocaleString(_locale,{maximumFractionDigits:0})}</div>
                    <div style={{fontSize:11,color:m.d.pct>=0?t.GREEN:t.RED,fontFamily:"sans-serif"}}>{(m.d.pct>=0?"+ ":"- ")+Math.abs(m.d.pct||0).toFixed(2)+"%"}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </Card>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr",gap:14}}>
        <Card>
          <SectionLabel action={<button onClick={()=>setPage("habits")} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>All</button>}>Today's Habits</SectionLabel>
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {(habits||[]).slice(0,6).map(h=>{
              const done=!!habitLog[h.id+"_"+todayStr()];
              return (
                <div key={h.id} onClick={()=>togHabit(h.id)} style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer"}}>
                  <div style={{width:18,height:18,borderRadius:"50%",border:"1.5px solid "+(done?h.color:t.BORDER2),background:done?h.color:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s"}}>
                    {done&&<span style={{fontSize:8,color:"#080808",fontWeight:700}}>V</span>}
                  </div>
                  <span style={{fontSize:13}}>{h.icon}</span>
                  <span style={{flex:1,fontSize:12,color:done?t.MUTED:t.TEXT,fontFamily:"sans-serif",textDecoration:done?"line-through":"none"}}>{h.name}</span>
                </div>
              );
            })}
          </div>
          <div style={{marginTop:10}}><PB value={(habits||[]).length?Math.round(hDone/(habits||[]).length*100):0} color={t.GOLD} height={3}/></div>
        </Card>
        <Card>
          <SectionLabel action={<button onClick={()=>setPage("weekly")} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>Review</button>}>30-Day Activity</SectionLabel>
          <div style={{display:"grid",gridTemplateColumns:"repeat(10,1fr)",gap:3}}>
            {Array.from({length:30}).map((_,i)=>{
              const d=new Date();d.setDate(d.getDate()-(29-i));
              const sc=history[d.toISOString().split("T")[0]]?.score||0;
              const col=sc>=75?t.GREEN:sc>=50?t.GOLD:sc>0?t.BLUE:t.BORDER;
              return <div key={i} title={sc>0?"Score: "+sc:"No data"} style={{aspectRatio:"1",borderRadius:3,background:sc>0?col+"66":t.CARD2,border:"1.5px solid "+(i===29?t.GOLD:"transparent")}}/>;
            })}
          </div>
          <div style={{display:"flex",gap:8,marginTop:8,justifyContent:"flex-end"}}>
            {[{c:t.GREEN,l:"75+"},{c:t.GOLD,l:"50+"},{c:t.BLUE,l:"1+"}].map(x=>(
              <div key={x.l} style={{display:"flex",alignItems:"center",gap:3}}>
                <div style={{width:8,height:8,borderRadius:2,background:x.c+"66"}}/>
                <span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{x.l}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div onClick={()=>setPage("advisor")} style={{background:t.GOLD+"0A",border:"1px solid "+t.GOLD+"33",borderRadius:9,padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:9,letterSpacing:2,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:2}}>AI Advisor - Full Context - Web Search</div>
          <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif"}}>Ask for a review, get market insights, or explore investment ideas</div>
        </div>
        <div style={{fontSize:18,color:t.GOLD}}>AI</div>
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
  const[dragIdx,setDragIdx]=useState(null);

  const EMOJIS=["🔥","💪","🧘","📚","🏃","🥗","💧","😴","🧠","\u2744\uFE0F","\u270D\uFE0F","🎯","🏋️","🚴","🧘","\u2600\uFE0F","🌙","\u26A1","🎵","🙏","💊","🥤","🍎","🫁","\u2764\uFE0F","🧘","🏊","🤸","📖","💰"];
  const TIME_GROUPS=["morning","afternoon","evening","anytime"];
  const TIME_LABELS={morning:"Morning",afternoon:"Afternoon",evening:"Evening",anytime:"Anytime"};

  const last7=Array.from({length:7}).map((_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return d.toISOString().split("T")[0];});
  const last30=Array.from({length:30}).map((_,i)=>{const d=new Date();d.setDate(d.getDate()-(29-i));return d.toISOString().split("T")[0];});
  const dayLetters=["S","M","T","W","T","F","S"];

  const getStreak=h=>{
    let s=0;
    for(let i=0;i<365;i++){
      const d=new Date();d.setDate(d.getDate()-i);
      const k=h.id+"_"+d.toISOString().split("T")[0];
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
                <div style={{position:"absolute",top:48,left:0,zIndex:100,background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:10,padding:10,display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:4,width:200,boxShadow:"0 8px 24px rgba(0,0,0,.4)"}}>
                  {EMOJIS.map(e=>(
                    <button key={e} onClick={()=>{setForm(f=>({...f,icon:e}));setShowEmojiPicker(false);}} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",padding:4,borderRadius:5,textAlign:"center"}}>
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
                <Card key={h.id} style={{marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                    <div onClick={()=>tog(h.id,todayStr())} style={{width:40,height:40,borderRadius:"50%",background:habitLog[h.id+"_"+todayStr()]?h.color:t.CARD2,border:"2px solid "+(habitLog[h.id+"_"+todayStr()]?h.color:t.BORDER2),display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,fontSize:18,transition:"all .2s"}}>
                      {h.icon}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                        <span style={{fontSize:13,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>{h.name}</span>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          {streak>0&&(
                            <div style={{display:"flex",alignItems:"center",gap:3,background:h.color+"22",borderRadius:10,padding:"2px 7px"}}>
                              <span style={{fontSize:10}}>🔥</span>
                              <span style={{fontSize:10,color:h.color,fontFamily:"sans-serif",fontWeight:700}}>{streak}</span>
                            </div>
                          )}
                          <span style={{fontSize:10,color:wDone>=h.target?t.GREEN:t.MUTED,fontFamily:"sans-serif",fontWeight:wDone>=h.target?600:400}}>{wDone>=h.target?"Target met":wDone+"/"+h.target+" this week"}</span>
                        </div>
                      </div>
                      <PB value={pct} color={pct>=100?t.GREEN:h.color} height={3}/>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:2}}>
                      <button onClick={()=>moveUp(allIdx)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,lineHeight:1,opacity:.6}}>▲</button>
                      <button onClick={()=>moveDown(allIdx,(habits||[]).length)} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:10,lineHeight:1,opacity:.6}}>▼</button>
                    </div>
                    <button onClick={()=>setExpandHabit(x=>({...x,[h.id]:!x[h.id]}))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.7}}>{isExpanded?"^":"v"}</button>
                    <button onClick={()=>setHabits(hs=>hs.filter(x=>x.id!==h.id))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:12,opacity:.5}}>X</button>
                  </div>

                  <div style={{display:"flex",gap:5,marginBottom:isExpanded?10:0}}>
                    {last7.map(d=>{
                      const done=!!habitLog[h.id+"_"+d];
                      const isT=d===todayStr();
                      const dl=dayLetters[new Date(d+"T12:00:00").getDay()];
                      return (
                        <div key={d} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                          <div style={{fontSize:8,color:isT?h.color:t.MUTED,fontFamily:"sans-serif",fontWeight:isT?700:400}}>{dl}</div>
                          <div onClick={()=>tog(h.id,d)} style={{width:"100%",aspectRatio:"1",borderRadius:"50%",background:done?h.color:t.CARD2,border:"1.5px solid "+(isT?h.color:done?h.color:t.BORDER2),display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all .15s"}}>
                            {done&&<span style={{fontSize:9,color:"#080808",fontWeight:700}}>V</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {isExpanded&&(
                    <div style={{borderTop:"1px solid "+t.BORDER,paddingTop:10}}>
                      <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>30-Day History</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(10,1fr)",gap:3,marginBottom:10}}>
                        {last30.map((d,i)=>{
                          const done=!!habitLog[h.id+"_"+d];
                          const isT=d===todayStr();
                          return (
                            <div key={d} onClick={()=>tog(h.id,d)} title={d} style={{aspectRatio:"1",borderRadius:3,background:done?h.color+"88":t.CARD2,border:"1px solid "+(isT?h.color:done?h.color+"44":t.BORDER),cursor:"pointer"}}/>
                          );
                        })}
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                        <div style={{textAlign:"center",padding:"8px",background:t.CARD2,borderRadius:7}}>
                          <div style={{fontSize:18,color:h.color,fontFamily:"sans-serif",fontWeight:700}}>{streak}</div>
                          <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginTop:2}}>Current streak</div>
                        </div>
                        <div style={{textAlign:"center",padding:"8px",background:t.CARD2,borderRadius:7}}>
                          <div style={{fontSize:18,color:h.color,fontFamily:"sans-serif",fontWeight:700}}>{last30.filter(d=>!!habitLog[h.id+"_"+d]).length}</div>
                          <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginTop:2}}>Last 30 days</div>
                        </div>
                        <div style={{textAlign:"center",padding:"8px",background:t.CARD2,borderRadius:7}}>
                          <div style={{fontSize:18,color:h.color,fontFamily:"sans-serif",fontWeight:700}}>{Math.round(last30.filter(d=>!!habitLog[h.id+"_"+d]).length/30*100)+"%"}</div>
                          <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginTop:2}}>30-day rate</div>
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
      const r=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:600,messages:[{role:"user",content:"My goals: "+goalSummary+". Suggest 3 specific, actionable micro-actions I should take this week to make progress. For each: GOAL NAME | ACTION | FREQUENCY. Be direct and specific, not generic."}]})});
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
                          <button onClick={()=>setGoals(gs=>gs.filter(x=>x.id!==g.id))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.5}}>X</button>
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
                          <button onClick={()=>setGoals(gs=>gs.filter(x=>x.id!==g.id))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.5}}>X</button>
                        </div>
                      </div>
                    )}
                    {/* Fallback slider for non-numeric, no-milestone goals */}
                    {!g.targetValue&&!milestones.length&&(
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",flexShrink:0}}>{g.progress||0+"%"}</span>
                        <input type="range" min={0} max={100} value={g.progress||0} onChange={e=>setProgress(g.id,parseInt(e.target.value))} style={{flex:1,accentColor:col}}/>
                        <button onClick={()=>setProgress(g.id,100)} style={{background:t.GREEN+"18",border:"1px solid "+t.GREEN+"44",borderRadius:5,padding:"3px 9px",color:t.GREEN,cursor:"pointer",fontSize:10,fontFamily:"sans-serif",flexShrink:0}}>Done</button>
                        <button onClick={()=>setGoals(gs=>gs.filter(x=>x.id!==g.id))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.5}}>X</button>
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
  const t=T();const[text,setText]=useState("");const[mood,setMood]=useState(4);const[showNew,setShowNew]=useState(false);const[viewing,setViewing]=useState(null);
  const td=todayStr();const todayEntry=(entries||[]).find(e=>e.date===td);
  const save=()=>{if(!text.trim())return;setEntries(es=>[{id:Date.now(),date:td,text:text.trim(),mood},...es.filter(e=>e.date!==td)]);setText("");setShowNew(false);};
  if(viewing){
    const entry=(entries||[]).find(x=>x.id===viewing);
    return (
      <div data-page="true" style={{maxWidth:680,margin:"0 auto"}}>
        <button onClick={()=>setViewing(null)} style={{background:"none",border:"none",color:t.GOLD,cursor:"pointer",fontFamily:"sans-serif",fontSize:13,marginBottom:14}}>Back</button>
        <Card>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",marginBottom:8}}>{entry?.date}</div>
          <div style={{display:"flex",gap:5,marginBottom:12}}>
            {MOODS.map(m=><div key={m.v} style={{padding:"3px 9px",borderRadius:10,background:entry?.mood===m.v?m.c+"33":"transparent",border:"1px solid "+(entry?.mood===m.v?m.c:t.BORDER),fontSize:10,color:entry?.mood===m.v?m.c:t.MUTED,fontFamily:"sans-serif"}}>{m.l}</div>)}
          </div>
          <div style={{fontSize:13,color:t.TEXT,lineHeight:1.85,whiteSpace:"pre-wrap"}}>{entry?.text}</div>
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
      {!todayEntry&&!showNew&&(
        <div onClick={()=>setShowNew(true)} style={{background:t.GOLD+"08",border:"1px dashed "+t.GOLD+"44",borderRadius:9,padding:14,cursor:"pointer",textAlign:"center",marginBottom:14}}>
          <div style={{fontSize:12,color:t.GOLD,fontFamily:"sans-serif",marginBottom:4}}>Today's entry is empty</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",fontStyle:"italic"}}>{"\""+JP[new Date().getDate()%JP.length]+"\""}</div>
        </div>
      )}
      {showNew&&(
        <Card style={{marginBottom:16,borderColor:t.GOLD+"44"}}>
          <div style={{fontSize:9,color:t.GOLD,fontFamily:"sans-serif",letterSpacing:2,marginBottom:6}}>{td}</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",fontStyle:"italic",marginBottom:10}}>{"\""+JP[new Date().getDate()%JP.length]+"\""}</div>
          <div style={{display:"flex",gap:5,marginBottom:10}}>
            {MOODS.map(m=><button key={m.v} onClick={()=>setMood(m.v)} style={{flex:1,padding:"6px 2px",borderRadius:6,border:"1px solid "+(mood===m.v?m.c:t.BORDER),background:mood===m.v?m.c+"22":"transparent",color:mood===m.v?m.c:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>{m.l}</button>)}
          </div>
          <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Write freely..." rows={6} style={{width:"100%",background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:7,padding:"10px 12px",color:t.TEXT,fontFamily:"Georgia,serif",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.85,boxSizing:"border-box"}}/>
          <div style={{display:"flex",gap:8,marginTop:10}}><Btn onClick={save}>Save</Btn><Btn onClick={()=>setShowNew(false)} variant="ghost">Cancel</Btn></div>
        </Card>
      )}
      {(entries||[]).map(entry=>(
        <Card key={entry.id} style={{marginBottom:8,cursor:"pointer"}} onClick={()=>setViewing(entry.id)}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div style={{fontSize:11,color:t.TEXT,fontFamily:"sans-serif"}}>
              {entry.date}
              {entry.date===td&&<span style={{fontSize:9,color:t.GOLD,marginLeft:6}}>Today</span>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:10,color:MOODS.find(m=>m.v===entry.mood)?.c||t.MUTED,fontFamily:"sans-serif"}}>{MOODS.find(m=>m.v===entry.mood)?.l}</span>
              <button onClick={ev=>{ev.stopPropagation();setEntries(es=>es.filter(x=>x.id!==entry.id));}} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.5}}>X</button>
            </div>
          </div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",lineHeight:1.6,overflow:"hidden",maxHeight:34}}>{entry.text.slice(0,100)+(entry.text.length>100?"...":"")}</div>
        </Card>
      ))}
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
            <StatCard label="After Tax" value={fmt((parseFloat(profile.annualIncome)||0)-calcTax(parseFloat(profile.annualIncome)||0))} color={t.GREEN}/>
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
        {safeH.length>0&&sP.totalValue>0&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
            {[{l:"Current Value",v:fmt(sP.totalValue),c:t.GOLD},{l:"Total Gain",v:(sP.totalGain>=0?"+":"")+fmt(sP.totalGain),c:sP.totalGain>=0?t.GREEN:t.RED},{l:"Return",v:(sP.totalGainPct>=0?"+":"")+sP.totalGainPct.toFixed(1)+"%",c:sP.totalGainPct>=0?t.GREEN:t.RED}].map(s=>(
              <div key={s.l} style={{background:t.CARD2,borderRadius:6,padding:"7px 8px",textAlign:"center"}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginBottom:2}}>{s.l}</div>
                <div style={{fontSize:13,color:s.c,fontFamily:"sans-serif",fontWeight:700}}>{s.v}</div>
              </div>
            ))}
          </div>
        )}
        {safeH.map((h,i)=>{
          const currentP=h.currentPrice||h.avgCost||0;
          const lv=currentP?currentP*h.shares:null;
          const cb=h.avgCost?h.avgCost*h.shares:null;
          const gain=lv&&cb?lv-cb:null;
          const gainPct=gain&&cb?gain/cb*100:null;
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
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                      <Tag>{h.ticker}</Tag>
                      {h.name!==h.ticker&&<span style={{fontSize:11,color:t.TEXT,fontFamily:"sans-serif"}}>{h.name}</span>}
                      <span style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{h.shares.toLocaleString()+" shares"}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginTop:2}}>
                      <span style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>Price:</span>
                      <input type="number" defaultValue={h.currentPrice||h.avgCost||""} onBlur={e=>{const v=parseFloat(e.target.value);if(v>0)setHoldings(hs=>(hs||[]).map(x=>x.id===h.id?{...x,currentPrice:v}:x));}} placeholder="Enter price" style={{width:80,background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:4,padding:"2px 6px",color:t.TEXT,fontSize:11,fontFamily:"sans-serif",outline:"none"}}/>
                      {gain!==null&&h.currentPrice&&<span style={{fontSize:10,color:gain>=0?t.GREEN:t.RED,fontFamily:"sans-serif"}}>{(gain>=0?"+":"")+fmt(gain)+" ("+gainPct?.toFixed(1)+"%)"}</span>}
                    </div>
                  </div>
                  <div style={{textAlign:"right",marginLeft:10}}>{lv&&<div style={{fontSize:13,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>{fmt(lv)}</div>}</div>
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
        {(cryptoHoldings||[]).length>0&&cryptoPortfolio?.totalValue>0&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
            {[
              {l:"Current Value",v:fmt(cryptoPortfolio.totalValue),c:t.PURPLE},
              {l:"Total Gain",v:(cryptoPortfolio.totalGain>=0?"+":"")+fmt(cryptoPortfolio.totalGain),c:cryptoPortfolio.totalGain>=0?t.GREEN:t.RED},
              {l:"Total Return",v:(cryptoPortfolio.totalGainPct>=0?"+":"")+cryptoPortfolio.totalGainPct.toFixed(1)+"%",c:cryptoPortfolio.totalGain>=0?t.GREEN:t.RED}
            ].map(s=>(
              <div key={s.l} style={{background:t.CARD2,borderRadius:6,padding:"7px 8px",textAlign:"center"}}>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginBottom:2}}>{s.l}</div>
                <div style={{fontSize:13,color:s.c,fontFamily:"sans-serif",fontWeight:700}}>{s.v}</div>
              </div>
            ))}
          </div>
        )}
        {(cryptoHoldings||[]).map((h,i)=>{
          const currentP=h.currentPrice||h.avgCost||0;
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
                    {[["Coin ID","id",h.id],["Amount","amount",h.amount],["Avg Cost (AUD)","avgCost",h.avgCost||""],["Label","name",h.name||h.id]].map(([l,k,def])=>(
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
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                      <Tag color={t.PURPLE}>{h.ticker}</Tag>
                      <span style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{h.amount+" "+h.ticker}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginTop:2}}>
                      <span style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>Price (AUD):</span>
                      <input type="number" defaultValue={h.currentPrice||h.avgCost||""} onBlur={e=>{const v=parseFloat(e.target.value);if(v>0)setCryptoHoldings(cs=>(cs||[]).map(x=>x.ticker===h.ticker?{...x,currentPrice:v}:x));}} placeholder="Enter price" style={{width:90,background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:4,padding:"2px 6px",color:t.TEXT,fontSize:11,fontFamily:"sans-serif",outline:"none"}}/>
                      {gain!==null&&h.currentPrice&&<span style={{fontSize:10,color:gain>=0?t.GREEN:t.RED,fontFamily:"sans-serif"}}>{(gain>=0?"+":"")+fmt(gain)+" ("+gainPct?.toFixed(1)+"%)"}</span>}
                    </div>
                  </div>
                  <div style={{textAlign:"right",marginLeft:10}}>{lv&&<div style={{fontSize:13,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>{fmt(lv)}</div>}</div>
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
  return (
    <div data-page="true" style={{maxWidth:680,margin:"0 auto"}}>
      <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Wealth Planning</div>
      <div style={{fontSize:26,color:t.TEXT,marginBottom:16}}>Wealth Forecast</div>
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

function TaxPage({profile}){
  const t=T();const loc=L();
  if(!loc.taxPage){
    return (
      <div data-page="true" style={{maxWidth:680,margin:"0 auto"}}>
        <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Tax Planning</div>
        <div style={{fontSize:26,color:t.TEXT,marginBottom:16}}>Tax Estimate</div>
        <Card style={{textAlign:"center",padding:48}}>
          <div style={{fontSize:36,marginBottom:12}}>{loc.flag}</div>
          <div style={{fontSize:15,color:t.TEXT,fontFamily:"sans-serif",marginBottom:8}}>{"Tax estimates for "+loc.label+" coming soon"}</div>
          <div style={{fontSize:12,color:t.MUTED,fontFamily:"sans-serif",lineHeight:1.7}}>Currently covers Australian brackets. Ask the AI Advisor to estimate your tax manually.</div>
        </Card>
      </div>
    );
  }
  const income=parseFloat(profile.annualIncome)||0;
  const tax=calcTax(income);
  const eff=income>0?((tax/income)*100).toFixed(1):"0.0";
  const brackets=[
    {l:"Tax-Free",up:18200,rate:"0%",c:t.GREEN},{l:"19c/dollar",up:45000,rate:"19%",c:t.GOLD},
    {l:"32.5c/dollar",up:120000,rate:"32.5%",c:"#D4956A"},{l:"37c/dollar",up:180000,rate:"37%",c:t.RED},
    {l:"45c/dollar",up:Infinity,rate:"45%",c:t.PURPLE}
  ];
  const curB=brackets.findIndex((b,i)=>income<=b.up&&(i===0||income>brackets[i-1].up));
  return (
    <div data-page="true" style={{maxWidth:680,margin:"0 auto"}}>
      <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>EOFY Planning</div>
      <div style={{fontSize:26,color:t.TEXT,marginBottom:16}}>Tax Estimate</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        <StatCard label="Gross Income" value={fmt(income)} color={t.GOLD}/>
        <StatCard label="Est. Tax" value={fmt(tax)} color={t.RED}/>
        <StatCard label="After Tax" value={fmt(income-tax)} color={t.GREEN}/>
        <StatCard label="Effective Rate" value={eff+"%"} color={t.BLUE}/>
      </div>
      <Card>
        <SectionLabel>Australian Tax Brackets FY2025-26</SectionLabel>
        {brackets.map((b,i)=>{
          const isCur=i===curB;
          return (
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:isCur?"10px 8px":"7px 0",background:isCur?b.c+"10":"transparent",borderRadius:6,border:isCur?"1px solid "+b.c+"33":"none",marginBottom:4}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:b.c,flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:12,color:isCur?b.c:t.TEXT,fontFamily:"sans-serif",fontWeight:isCur?600:400}}>
                  {b.l+(isCur?" - You are here":"")}
                </div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{"Up to "+fmt(b.up===Infinity?9999999:b.up)}</div>
              </div>
              <div style={{fontSize:12,color:b.c,fontFamily:"sans-serif",fontWeight:600}}>{b.rate}</div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function DebtPage({profile,setProfile}){
  const t=T();
  const[extra,setExtra]=useState(500);
  const[payingDebt,setPayingDebt]=useState(null);
  const[payAmount,setPayAmount]=useState("");
  const recordPayment=(k,amount)=>{
    const current=parseFloat(profile[k])||0;
    const newBal=Math.max(0,current-amount);
    const tD=["mortgageDebt","investLoanDebt","carDebt","creditCardDebt","personalDebt"].reduce((s,dk)=>s+(dk===k?newBal:parseFloat(profile[dk])||0),0);
    const tA=parseFloat(profile.totalAssets)||0;
    setProfile(p=>({...p,[k]:newBal,totalDebt:tD,netWorth:tA-tD}));
    setPayingDebt(null);setPayAmount("");
  };
  const debts=[{l:"Mortgage",k:"mortgageDebt",rate:6.2},{l:"Investment Loan",k:"investLoanDebt",rate:7.0},{l:"Car Finance",k:"carDebt",rate:9.5},{l:"Credit Cards",k:"creditCardDebt",rate:19.9},{l:"Personal Loans",k:"personalDebt",rate:12.0}].filter(d=>parseFloat(profile[d.k])>0).map(d=>({...d,balance:parseFloat(profile[d.k])}));
  const calcM=(bal,rate,ex)=>{
    const r=rate/100/12,mp=bal*r*1.1,total=mp+ex/Math.max(debts.length,1);
    if(total<=bal*r)return 999;
    return Math.ceil(Math.log(total/(total-bal*r))/Math.log(1+r));
  };
  const totalDebt=debts.reduce((s,d)=>s+d.balance,0);
  return (
    <div data-page="true" style={{maxWidth:680,margin:"0 auto"}}>
      <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Debt Freedom</div>
      <div style={{fontSize:26,color:t.TEXT,marginBottom:16}}>Payoff Calculator</div>
      <Card style={{marginBottom:14}}>
        <SectionLabel>Extra Monthly Payment</SectionLabel>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <input type="range" min={0} max={5000} step={100} value={extra} onChange={e=>setExtra(Number(e.target.value))} style={{flex:1,accentColor:t.GOLD}}/>
          <div style={{fontSize:18,color:t.GOLD,fontFamily:"sans-serif",fontWeight:700,minWidth:90}}>{fmt(extra)+"/mo"}</div>
        </div>
      </Card>
      {debts.map(d=>{
        const months=calcM(d.balance,d.rate,extra);
        const years=Math.floor(months/12),mos=months%12;
        const pct=Math.round(d.balance/totalDebt*100);
        return (
          <Card key={d.k} style={{marginBottom:8,borderLeft:"3px solid "+t.RED}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
              <div>
                <div style={{fontSize:13,color:t.TEXT}}>{d.l}</div>
                <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif"}}>{d.rate+"% p.a. - "+pct+"% of total"}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:14,color:t.RED,fontFamily:"sans-serif",fontWeight:600}}>{"-"+fmt(d.balance)}</div>
                <div style={{fontSize:10,color:months<999?t.GREEN:t.MUTED,fontFamily:"sans-serif"}}>{months<999?(years>0?years+"y ":"")+(mos+"m to clear"):"Increase payment"}</div>
              </div>
            </div>
            <PB value={pct} color={t.RED} height={4}/>
            {payingDebt===d.k?(
              <div style={{marginTop:10,display:"flex",gap:7,alignItems:"center"}}>
                <Inp type="number" value={payAmount} onChange={e=>setPayAmount(e.target.value)} placeholder="Payment amount" style={{flex:1,fontSize:12}}/>
                <Btn onClick={()=>recordPayment(d.k,parseFloat(payAmount)||0)} disabled={!payAmount} style={{fontSize:11}}>Record</Btn>
                <Btn onClick={()=>{setPayingDebt(null);setPayAmount("");}} variant="ghost" style={{fontSize:11}}>Cancel</Btn>
              </div>
            ):(
              <button onClick={()=>setPayingDebt(d.k)} style={{marginTop:8,background:t.GREEN+"14",border:"1px solid "+t.GREEN+"33",borderRadius:6,padding:"4px 10px",color:t.GREEN,cursor:"pointer",fontFamily:"sans-serif",fontSize:11}}>+ Record Payment</button>
            )}
          </Card>
        );
      })}
      {!debts.length&&<div style={{textAlign:"center",padding:40,color:t.MUTED,fontFamily:"sans-serif"}}>No debts recorded. Update your profile.</div>}
    </div>
  );
}

function CashFlowPage({transactions,setTransactions}){
  const t=T();
  const[form,setForm]=useState({date:todayStr(),type:"income",category:"Salary",amount:"",note:""});
  const[showAdd,setShowAdd]=useState(false);const[filter,setFilter]=useState("all");

  const[pdfState,setPdfState]=useState("idle");const[pdfError,setPdfError]=useState("");
  const[extracted,setExtracted]=useState([]);const[selected,setSelected]=useState({});
  const fileRef=useRef(null);
  const mk=monthStr();
  const tm=transactions.filter(tx=>tx.date.startsWith(mk));
  const income=tm.filter(tx=>tx.type==="income").reduce((s,tx)=>s+tx.amount,0);
  const expense=tm.filter(tx=>tx.type==="expense").reduce((s,tx)=>s+tx.amount,0);
  const months=Array.from({length:6}).map((_,i)=>{
    const d=new Date();d.setMonth(d.getMonth()-(5-i));
    const key=d.toISOString().slice(0,7);
    return{key,label:d.toLocaleString("default",{month:"short"}),inc:transactions.filter(tx=>tx.date.startsWith(key)&&tx.type==="income").reduce((s,tx)=>s+tx.amount,0),exp:transactions.filter(tx=>tx.date.startsWith(key)&&tx.type==="expense").reduce((s,tx)=>s+tx.amount,0)};
  });
  const maxBar=Math.max(...months.flatMap(m=>[m.inc,m.exp]),1);
  const byCategory=EXP_CATS.expense.map(cat=>({cat,total:tm.filter(tx=>tx.type==="expense"&&tx.category===cat).reduce((s,tx)=>s+tx.amount,0)})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
  const catColors=["#C9A84C","#7A9E7E","#7EB8C9","#B07EC9","#C97E7E","#D4956A"];
  const handlePdf=async file=>{
    if(!file||!file.type.includes("pdf"))return;
    setPdfState("loading");setPdfError("");
    try{
      const base64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=()=>rej(new Error("Read failed"));r.readAsDataURL(file);});
      const catList=[...EXP_CATS.income,...EXP_CATS.expense].join(", ");
      const resp=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:4000,messages:[{role:"user",content:[{type:"document",source:{type:"base64",media_type:"application/pdf",data:base64}},{type:"text",text:"Extract all transactions from this bank statement. Return ONLY a JSON array, no markdown. Each item: {\"date\":\"YYYY-MM-DD\",\"description\":\"merchant max 40 chars\",\"amount\":number,\"type\":\"income or expense\",\"category\":\"one of: "+catList+"\"} Skip transfers and fees under $1. Amount always positive."}]}]})});
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
  const shown=transactions.filter(tx=>filter==="all"||tx.type===filter).slice(0,40);
  return (
    <div data-page="true" style={{maxWidth:800,margin:"0 auto"}}>
      <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Cash Flow</div>
      <div style={{fontSize:26,color:t.TEXT,marginBottom:16}}>Income and Expenses</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
        <StatCard label="Income" value={fmt(income)} color={t.GREEN} sub="This month"/>
        <StatCard label="Expenses" value={fmt(expense)} color={t.RED} sub="This month"/>
        <StatCard label="Net" value={fmt(Math.abs(income-expense))} color={income-expense>=0?t.GREEN:t.RED} sub={income-expense>=0?"Surplus":"Deficit"}/>
      </div>
      {pdfState==="idle"&&(
        <div onClick={()=>fileRef.current?.click()} onDragOver={e=>{e.preventDefault();}} onDrop={e=>{e.preventDefault();handlePdf(e.dataTransfer.files[0]);}} style={{border:"1.5px dashed "+t.GOLD+"44",borderRadius:9,padding:16,textAlign:"center",cursor:"pointer",marginBottom:14}}>
          <input ref={fileRef} type="file" accept="application/pdf" style={{display:"none"}} onChange={e=>handlePdf(e.target.files[0])}/>
          <div style={{fontSize:20,marginBottom:5}}>PDF</div>
          <div style={{fontSize:12,color:t.GOLD,fontFamily:"sans-serif",fontWeight:600,marginBottom:2}}>Import Bank Statement</div>
          <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif"}}>Drop PDF or click to browse - Claude extracts transactions automatically</div>
        </div>
      )}
      {pdfState==="loading"&&<Card style={{marginBottom:14,textAlign:"center",padding:"20px"}}><div style={{fontSize:12,color:t.GOLD,fontFamily:"sans-serif"}}>Reading your statement...</div></Card>}
      {pdfState==="error"&&(
        <Card style={{marginBottom:14,borderColor:t.RED+"44"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:12,color:t.RED,fontFamily:"sans-serif",fontWeight:600,marginBottom:4}}>Import failed</div>
              <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif"}}>{pdfError}</div>
            </div>
            <button onClick={()=>setPdfState("idle")} style={{background:"none",border:"1px solid "+t.BORDER,borderRadius:5,padding:"3px 8px",color:t.MUTED,cursor:"pointer",fontSize:10,marginLeft:10,flexShrink:0}}>Try Again</button>
          </div>
        </Card>
      )}
      {pdfState==="review"&&(
        <Card style={{marginBottom:14,borderColor:t.GOLD+"44"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div>
              <div style={{fontSize:10,color:t.GOLD,fontFamily:"sans-serif",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Statement Import</div>
              <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif"}}>{extracted.length+" found - "+Object.values(selected).filter(Boolean).length+" selected"}</div>
            </div>
            <div style={{display:"flex",gap:7}}>
              <button onClick={()=>{const all=Object.values(selected).every(Boolean);const s={};extracted.forEach(tx=>{s[tx.id]=!all;});setSelected(s);}} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:5,padding:"4px 9px",color:t.MUTED,cursor:"pointer",fontSize:10,fontFamily:"sans-serif"}}>{Object.values(selected).every(Boolean)?"Deselect All":"Select All"}</button>
              <Btn onClick={confirmImport} disabled={!Object.values(selected).some(Boolean)} style={{fontSize:10,padding:"4px 10px"}}>{"Import "+Object.values(selected).filter(Boolean).length}</Btn>
              <Btn onClick={()=>{setExtracted([]);setSelected({});setPdfState("idle");}} variant="ghost" style={{fontSize:10,padding:"4px 9px"}}>Cancel</Btn>
            </div>
          </div>
          <div style={{maxHeight:300,overflowY:"auto",border:"1px solid "+t.BORDER,borderRadius:7}}>
            {extracted.map((tx,i)=>{
              const isSel=!!selected[tx.id];
              return (
                <div key={tx.id} onClick={()=>setSelected(s=>({...s,[tx.id]:!s[tx.id]}))} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderBottom:i<extracted.length-1?"1px solid "+t.BORDER:"none",cursor:"pointer",background:isSel?t.GOLD+"08":"transparent"}}>
                  <div style={{width:15,height:15,borderRadius:3,border:"1.5px solid "+(isSel?t.GOLD:t.BORDER2),background:isSel?t.GOLD:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {isSel&&<span style={{fontSize:8,color:"#080808",fontWeight:700}}>V</span>}
                  </div>
                  <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",flexShrink:0,width:80}}>{tx.date}</div>
                  <div style={{flex:1,fontSize:11,color:isSel?t.TEXT:t.MUTED,fontFamily:"sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tx.note}</div>
                  <select value={tx.category} onClick={e=>e.stopPropagation()} onChange={e=>{e.stopPropagation();setExtracted(ex=>ex.map(x=>x.id===tx.id?{...x,category:e.target.value}:x));}} style={{background:t.CARD2,border:"1px solid "+t.BORDER,borderRadius:4,padding:"2px 4px",color:t.MUTED,fontFamily:"sans-serif",fontSize:9,outline:"none",flexShrink:0}}>
                    {EXP_CATS[tx.type].map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                  <div style={{fontSize:11,color:tx.type==="income"?t.GREEN:t.RED,fontFamily:"sans-serif",fontWeight:600,flexShrink:0,minWidth:60,textAlign:"right"}}>{(tx.type==="income"?"+":"-")+fmt(tx.amount)}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <Card>
          <SectionLabel>6-Month Trend</SectionLabel>
          <div style={{display:"flex",gap:4,alignItems:"flex-end",height:80,marginBottom:6}}>
            {months.map((m,i)=>(
              <div key={m.key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                <div style={{width:"100%",display:"flex",gap:2,alignItems:"flex-end",height:64}}>
                  <div style={{flex:1,background:t.GREEN+"88",borderRadius:"2px 2px 0 0",height:(m.inc/maxBar*60)+"px",minHeight:m.inc>0?2:0}}/>
                  <div style={{flex:1,background:t.RED+"88",borderRadius:"2px 2px 0 0",height:(m.exp/maxBar*60)+"px",minHeight:m.exp>0?2:0}}/>
                </div>
                <div style={{fontSize:8,color:i===5?t.GOLD:t.MUTED,fontFamily:"sans-serif"}}>{m.label}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            {[{c:t.GREEN,l:"In"},{c:t.RED,l:"Out"}].map(x=>(
              <div key={x.l} style={{display:"flex",alignItems:"center",gap:3}}>
                <div style={{width:9,height:9,borderRadius:2,background:x.c+"88"}}/>
                <span style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{x.l}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <SectionLabel>Spending by Category</SectionLabel>
          {byCategory.length===0?(
            <div style={{fontSize:11,color:t.MUTED,fontFamily:"sans-serif",padding:"12px 0",textAlign:"center"}}>No expenses this month</div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {byCategory.slice(0,5).map((x,i)=>(
                <div key={x.cat}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:11,color:t.TEXT,fontFamily:"sans-serif"}}>{x.cat}</span>
                    <span style={{fontSize:11,color:t.RED,fontFamily:"sans-serif",fontWeight:600}}>{fmt(x.total)}</span>
                  </div>
                  <div style={{background:t.BORDER2,borderRadius:99,height:3,overflow:"hidden"}}>
                    <div style={{width:((x.total/(byCategory[0].total||1))*100)+"%",height:"100%",background:catColors[i%catColors.length],borderRadius:99}}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{display:"flex",gap:5}}>
          {["all","income","expense"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{padding:"4px 10px",borderRadius:14,border:"1px solid "+(filter===f?t.GOLD:t.BORDER),background:filter===f?t.GOLD+"14":"transparent",color:filter===f?t.GOLD:t.MUTED,cursor:"pointer",fontSize:11,fontFamily:"sans-serif",textTransform:"capitalize"}}>{f}</button>
          ))}
        </div>
        <Btn onClick={()=>setShowAdd(s=>!s)}>+ Add</Btn>
      </div>
      {showAdd&&(
        <Card style={{marginBottom:10,borderColor:t.GOLD+"44"}}>
          <div style={{display:"flex",gap:6,marginBottom:8}}>
            {["income","expense"].map(tp=>(
              <button key={tp} onClick={()=>setForm(f=>({...f,type:tp,category:EXP_CATS[tp][0]}))} style={{flex:1,padding:"6px",borderRadius:5,border:"1px solid "+(form.type===tp?(tp==="income"?t.GREEN:t.RED):t.BORDER),background:form.type===tp?(tp==="income"?t.GREEN:t.RED)+"14":"transparent",color:form.type===tp?(tp==="income"?t.GREEN:t.RED):t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:12,textTransform:"capitalize"}}>{tp}</button>
            ))}
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <Inp type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={{flex:1}}/>
            <Sel value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{flex:1.4}}>{EXP_CATS[form.type].map(c=><option key={c}>{c}</option>)}</Sel>
            <Inp type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="Amount" style={{flex:1}}/>
            <Inp value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="Note" style={{flex:1.5}}/>
            <Btn onClick={add}>Add</Btn>
          </div>
        </Card>
      )}
      <Card>
        {shown.length===0&&<div style={{textAlign:"center",padding:32,color:t.MUTED,fontFamily:"sans-serif"}}><div style={{fontSize:28,marginBottom:8}}>$</div><div>Drop a bank statement above or add manually</div></div>}
        {shown.map((tx,i)=>(
          <div key={tx.id}>
            {i>0&&<Divider/>}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif"}}>{tx.category}{tx.note&&<span style={{color:t.MUTED,fontSize:10}}>{" - "+tx.note}</span>}</div>
                <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginTop:1}}>{tx.date}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{fontSize:12,color:tx.type==="income"?t.GREEN:t.RED,fontFamily:"sans-serif",fontWeight:600}}>{(tx.type==="income"?"+":"-")+fmt(tx.amount)}</div>
                <button onClick={()=>setTransactions(ts=>ts.filter(x=>x.id!==tx.id))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.5}}>X</button>
              </div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function BillsPage({bills,setBills}){
  const t=T();
  const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({name:"",amount:"",frequency:"monthly",category:"Housing",nextDue:todayStr(),autopay:false});
  const freqs=["weekly","fortnightly","monthly","quarterly","annually"];
  const billCats=["Housing","Insurance","Utilities","Subscriptions","Finance","Health","Transport","Other"];
  const monthlyEq=b=>{const m={weekly:52/12,fortnightly:26/12,monthly:1,quarterly:1/3,annually:1/12};return b.amount*(m[b.frequency]||1);};
  const advanceDate=(ds,freq)=>{
    const d=new Date(ds+"T12:00:00");
    if(freq==="weekly")d.setDate(d.getDate()+7);
    else if(freq==="fortnightly")d.setDate(d.getDate()+14);
    else if(freq==="monthly")d.setMonth(d.getMonth()+1);
    else if(freq==="quarterly")d.setMonth(d.getMonth()+3);
    else if(freq==="annually")d.setFullYear(d.getFullYear()+1);
    return d.toISOString().split("T")[0];
  };
  const[showHistory,setShowHistory]=useState(false);
  const markPaid=id=>setBills(bs=>bs.map(b=>{
    if(b.id!==id)return b;
    const payment={date:todayStr(),amount:b.amount,name:b.name};
    return{...b,nextDue:advanceDate(b.nextDue,b.frequency),lastPaid:todayStr(),paymentHistory:[payment,...(b.paymentHistory||[]).slice(0,23)]};
  }));
  const add=()=>{
    if(!form.name||!form.amount)return;
    setBills(bs=>[...bs,{...form,id:Date.now(),amount:parseFloat(form.amount)}]);
    setForm({name:"",amount:"",frequency:"monthly",category:"Housing",nextDue:todayStr(),autopay:false});
    setShowAdd(false);
  };
  const totalMonthly=bills.reduce((s,b)=>s+monthlyEq(b),0);
  const upcoming=bills.filter(b=>(new Date(b.nextDue+"T12:00:00")-new Date())/864e5<=14).sort((a,b)=>new Date(a.nextDue)-new Date(b.nextDue));
  return (
    <div data-page="true" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Recurring</div>
          <div style={{fontSize:26,color:t.TEXT}}>Bills</div>
        </div>
        <Btn onClick={()=>setShowAdd(s=>!s)}>+ Add</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
        <StatCard label="Monthly Total" value={fmt(totalMonthly)} color={t.RED}/>
        <StatCard label="Annual Total" value={fmt(totalMonthly*12)} color={t.GOLD}/>
        <StatCard label="Bills Tracked" value={bills.length} color={t.BLUE}/>
      </div>
      {upcoming.length>0&&(
        <Card style={{marginBottom:14,borderColor:t.GOLD+"44"}}>
          <SectionLabel>Due Soon</SectionLabel>
          {upcoming.map((b,i)=>{
            const diff=Math.round((new Date(b.nextDue+"T12:00:00")-new Date())/864e5);
            const overdue=diff<0;
            const dueLabel=overdue?("Overdue "+Math.abs(diff)+" days"):diff===0?"Due today":("Due in "+diff+" days");
            return (
              <div key={b.id}>
                {i>0&&<Divider/>}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0"}}>
                  <div>
                    <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif"}}>
                      {b.name}
                      {b.autopay&&<span style={{fontSize:9,color:t.GREEN,marginLeft:5,fontFamily:"sans-serif"}}>auto</span>}
                    </div>
                    <div style={{fontSize:10,color:overdue?t.RED:t.MUTED,fontFamily:"sans-serif",marginTop:1}}>{dueLabel+" - "+b.nextDue}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:13,color:t.TEXT,fontFamily:"sans-serif",fontWeight:600}}>{fmt(b.amount)}</span>
                    <button onClick={()=>markPaid(b.id)} style={{background:t.GREEN+"18",border:"1px solid "+t.GREEN+"44",borderRadius:5,padding:"4px 9px",color:t.GREEN,cursor:"pointer",fontSize:11,fontFamily:"sans-serif"}}>
                      {b.autopay?"Auto":"Paid"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}
      {showAdd&&(
        <Card style={{marginBottom:14,borderColor:t.GOLD+"44"}}>
          <SectionLabel>New Bill</SectionLabel>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div style={{display:"flex",gap:8}}>
              <Inp value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Name" style={{flex:2}}/>
              <Inp type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="$" style={{flex:1}}/>
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
              <Btn onClick={add}>Add</Btn><Btn onClick={()=>setShowAdd(false)} variant="ghost">Cancel</Btn>
            </div>
          </div>
        </Card>
      )}
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
                      <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif"}}>{p.name||p.billName}</div>
                      <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginTop:1}}>{p.date}</div>
                    </div>
                    <div style={{fontSize:12,color:t.RED,fontFamily:"sans-serif",fontWeight:600}}>{"-"+fmt(p.amount)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
      <Card>
        {bills.length===0&&<div style={{textAlign:"center",padding:32,color:t.MUTED,fontFamily:"sans-serif"}}><div style={{fontSize:28,marginBottom:8}}>Bills</div><div>No bills tracked yet</div></div>}
        {bills.map((b,i)=>{
          const diff=Math.round((new Date(b.nextDue+"T12:00:00")-new Date())/864e5);
          const urgent=diff<=3;
          return (
            <div key={b.id}>
              {i>0&&<Divider/>}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif"}}>
                    {b.name}
                    {b.autopay&&<span style={{fontSize:9,color:t.GREEN,marginLeft:5}}>auto</span>}
                  </div>
                  <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif",marginTop:1}}>
                    {b.category+" - "+b.frequency+" - "}
                    <span style={{color:urgent?t.RED:t.MUTED}}>{b.nextDue}</span>
                    {b.lastPaid&&<span style={{marginLeft:7,color:t.GREEN}}>{"paid "+b.lastPaid}</span>}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:12,color:t.RED,fontFamily:"sans-serif",fontWeight:600}}>{fmt(b.amount)}</div>
                    <div style={{fontSize:9,color:t.MUTED,fontFamily:"sans-serif"}}>{fmt(monthlyEq(b))+"/mo"}</div>
                  </div>
                  <button onClick={()=>markPaid(b.id)} style={{background:t.GREEN+"14",border:"1px solid "+t.GREEN+"33",borderRadius:5,padding:"3px 7px",color:t.GREEN,cursor:"pointer",fontSize:10}}>Paid</button>
                  <button onClick={()=>setBills(bs=>bs.filter(x=>x.id!==b.id))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:11,opacity:.5}}>X</button>
                </div>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function InvestPage({profile}){
  const t=T();
  const[tab,setTab]=useState("ideas");
  const[aiOpps,setAiOpps]=useState("");
  const[loading,setLoading]=useState(false);
  const[watchlist,setWatchlist]=useState([]);
  const[wForm,setWForm]=useState({ticker:"",name:"",notes:""});
  const[showWAdd,setShowWAdd]=useState(false);
  const getAi=async()=>{
    setLoading(true);
    try{
      const r=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:800,tools:[{type:"web_search_20250305",name:"web_search"}],system:"Investment analyst for "+(profile.riskProfile||["Growth"])[0]+" risk investor. Shares "+fmt(parseFloat(profile.shareValue)||0)+", property "+fmt(parseFloat(profile.propertyValue)||0)+". Give 4-5 specific opportunities based on TODAY's market. Search for current data. For each: NAME, CLASS, WHY NOW, RISK. Add brief macro context.",messages:[{role:"user",content:"Best investment opportunities right now?"}]})});
      const d=await r.json();
      setAiOpps((d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n")||"Unable to generate.");
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
              </div>
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

function WorkoutPage({workouts,setWorkouts}){
  const t=T();const[showAdd,setShowAdd]=useState(false);const[tab,setTab]=useState("log");
  const[wf,setWf]=useState({date:todayStr(),type:"Strength",duration:60,notes:"",sets:[]});
  const[sf,setSf]=useState({exercise:"Bench Press",sets:3,reps:8,weight:""});
  const save=()=>{if(!wf.sets.length&&!wf.notes)return;setWorkouts(ws=>[{...wf,id:Date.now()},...ws]);setWf({date:todayStr(),type:"Strength",duration:60,notes:"",sets:[]});setShowAdd(false);};
  const prs={};
  [...(workouts||[])].reverse().forEach(w=>w.sets&&w.sets.forEach(s=>{
    if(s.weight&&parseFloat(s.weight)>0&&(!prs[s.exercise]||parseFloat(s.weight)>parseFloat(prs[s.exercise].weight)))
      prs[s.exercise]={weight:s.weight,reps:s.reps,date:w.date};
  }));
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
        {[["log","Log"],["progress","Progress"],["records","Records"]].map(([id,label])=>(
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
                      <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginTop:4,marginBottom:6}}>{b.cur+" / "+b.tot+" pages"}</div>
                      <div style={{display:"flex",gap:5}}>
                        {[10,25,50].map(n=>(
                          <Btn key={n} onClick={()=>addPages(b.id,n)} style={{flex:1,fontSize:10,padding:"4px"}}>{"+ "+n}</Btn>
                        ))}
                        <Btn onClick={()=>markFinished(b.id)} style={{flex:2,fontSize:10,padding:"4px"}}>Finished</Btn>
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

function WeeklyPage({profile,tasks,goals,habits,habitLog,history,journal,workouts,supplements,bodyLog}){
  const t=T();
  const[aiReview,setAiReview]=useState("");
  const[loading,setLoading]=useState(false);
  const[reflection,setReflection]=useState("");
  const[savedReflection,setSavedReflection]=useState("");
  const[showReflection,setShowReflection]=useState(false);
  const last7=Array.from({length:7}).map((_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return d.toISOString().split("T")[0];});
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
      const r=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:900,system:"Performance coach for "+profile.firstName+". Direct, specific. Structure: WINS (2-3 with numbers), GAPS (1-2), PATTERNS (one data insight), NEXT WEEK (3 priorities). Max 270 words.",messages:[{role:"user",content:"Week "+weekStart+" to "+weekEnd+"\nScores: avg "+avgScore+"/100 - "+daysActive+"/7 active\nHabits ("+habitAvg+"%):\n"+habitDetails+"\nWorkouts ("+weekWorkouts.length+"): "+wSummary+"\nBody: "+bSummary+"\nJournal: "+weekJournal.length+" entries, avg mood "+avgMood+"/5\nGoals: "+goalsSummary}]})});
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
            <Btn onClick={()=>{setSavedReflection(reflection);setShowReflection(false);}}>Save Reflection</Btn>
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
  const sys="Private advisor. Direct, sharp. Use web search for current market data.\n\nCLIENT: "+profile.firstName+" "+(profile.lastName||"")+" | "+profile.age+" | "+(profile.occupation||"")+" | "+(profile.location||"AU")+"\nNW: "+fmt(profile.netWorth||0)+" of "+fmt(Number(profile.netWorthTarget||3e6))+" ("+Math.round((profile.netWorth||0)/Number(profile.netWorthTarget||3e6)*100)+"%)\nIncome: "+fmt(parseFloat(profile.annualIncome)||0)+" | Shares: "+fmt(parseFloat(profile.shareValue)||0)+" | Property: "+fmt(parseFloat(profile.propertyValue)||0)+"\nDebt: "+fmt(profile.totalDebt||0)+" | Risk: "+((profile.riskProfile||["Growth"])[0])+"\n\nTODAY: Tasks "+tDone+"/"+(tasks||[]).length+" | Habits "+hDone+"/"+(habits||[]).length+" | Supps "+sDone+"/"+(supplements||[]).length+"\nPending high-priority: "+((tasks||[]).filter(tk=>!tk.done&&tk.priority==="high").map(tk=>tk.text).join(", ")||"all done")+"\nGoals: "+((goals||[]).map(g=>g.title+" "+g.progress+"%").join(", ")||"none")+"\n\nFor 'review': cover FINANCES, HEALTH AND HABITS, GOALS, DAILY EXECUTION. Be direct.";
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

function ProfilePage({profile,setProfile,onReset,onRecalibrate,theme,setTheme}){
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
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>Account</div>
          <div style={{fontSize:26,color:t.TEXT}}>Profile</div>
        </div>
        <Btn onClick={save}>{saved?"Saved":"Save Changes"}</Btn>
      </div>
      <Card style={{marginBottom:12}}>
        <SectionLabel>Appearance</SectionLabel>
        <div style={{display:"flex",gap:8}}>
          {["dark","light"].map(th=>(
            <button key={th} onClick={()=>setTheme(th)} style={{flex:1,padding:"10px",borderRadius:7,border:"1px solid "+(theme===th?t.GOLD:t.BORDER),background:theme===th?t.GOLD+"14":t.CARD2,color:theme===th?t.GOLD:t.MUTED,cursor:"pointer",fontFamily:"sans-serif",fontSize:12}}>
              {th==="dark"?"Dark Mode":"Light Mode"}
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
          {[["firstName","First Name","text"],["lastName","Last Name","text"],["age","Age","number"],["location","Location","text"],["occupation","Occupation","text"]].map(([k,l,tp])=>(
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
    netWorthTarget:""
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
              {inp("age","Age","34","number")}
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
            <div style={{fontSize:12,color:t.MUTED,fontFamily:"sans-serif",marginBottom:20}}>Select all that apply. Used to personalise supplement and health recommendations.</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {HEALTH_GOALS.map(g=>{
                const on=p.healthGoals.includes(g);
                return <button key={g} onClick={()=>toggleArr("healthGoals",g)} style={{padding:"8px 14px",borderRadius:20,border:"1px solid "+(on?t.GOLD:t.BORDER),background:on?t.GOLD+"22":"transparent",color:on?t.GOLD:t.TEXT,cursor:"pointer",fontFamily:"sans-serif",fontSize:12}}>{on?"V ":""}{g}</button>;
              })}
            </div>
          </div>
        )}

        {cur==="habits"&&(
          <div>
            <div style={{fontSize:9,letterSpacing:3,color:t.GOLD,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:6}}>Daily Habits</div>
            <div style={{fontSize:22,color:t.TEXT,marginBottom:6}}>What do you already practise?</div>
            <div style={{fontSize:12,color:t.MUTED,fontFamily:"sans-serif",marginBottom:20}}>These will be added to your habit tracker automatically.</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {HABITS_LIST.map(h=>{
                const on=p.currentHabits.includes(h);
                return <button key={h} onClick={()=>toggleArr("currentHabits",h)} style={{padding:"8px 14px",borderRadius:20,border:"1px solid "+(on?t.GOLD:t.BORDER),background:on?t.GOLD+"22":"transparent",color:on?t.GOLD:t.TEXT,cursor:"pointer",fontFamily:"sans-serif",fontSize:12}}>{on?"V ":""}{h}</button>;
              })}
            </div>
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
            <div style={{fontSize:22,color:t.TEXT,marginBottom:6}}>Set your first goals</div>
            <div style={{fontSize:12,color:t.MUTED,fontFamily:"sans-serif",marginBottom:16}}>Add 1-3 to get started. You can add more anytime from the Goals tab.</div>
            {initGoals.map((g,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:t.CARD,border:"1px solid "+t.BORDER,borderRadius:8,marginBottom:8}}>
                <div>
                  <div style={{fontSize:12,color:t.TEXT,fontFamily:"sans-serif"}}>{g.title}</div>
                  <div style={{fontSize:10,color:t.MUTED,fontFamily:"sans-serif",marginTop:1}}>{g.category+" - "+g.period}</div>
                </div>
                <button onClick={()=>setInitGoals(gs=>gs.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:t.MUTED,cursor:"pointer",fontSize:12}}>X</button>
              </div>
            ))}
            {initGoals.length<5&&(
              <div style={{background:t.CARD,border:"1px solid "+t.GOLD+"44",borderRadius:8,padding:"12px 14px",marginTop:8}}>
                <Inp value={newGoal.title} onChange={e=>setNewGoal(g=>({...g,title:e.target.value}))} placeholder="Goal title..." style={{marginBottom:8}}/>
                <div style={{display:"flex",gap:8,marginBottom:8}}>
                  <Sel value={newGoal.period} onChange={e=>setNewGoal(g=>({...g,period:e.target.value}))} style={{flex:1}}>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="year">This Year</option>
                  </Sel>
                  <Sel value={newGoal.category} onChange={e=>setNewGoal(g=>({...g,category:e.target.value}))} style={{flex:1}}>
                    {["financial","career","health","education","personal"].map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                  </Sel>
                </div>
                <Btn onClick={()=>{if(!newGoal.title.trim())return;setInitGoals(gs=>[...gs,{...newGoal}]);setNewGoal({title:"",period:"month",category:"financial"});}}>Add Goal</Btn>
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

function App(){
  const[hydrated,setHydrated]=useState(false);
  const[profile,setProfile]=useState(null);
  const[page,setPage]=useState("dashboard");
  const[theme,setThemeState]=useState("dark");
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
  const[history,setHistory]=useState({});
  const[bodyLog,setBodyLog]=useState([]);
  const[habits,setHabits]=useState(D_HABITS);
  const[habitLog,setHabitLog]=useState({});
  const[holdings,setHoldings]=useState([]);
  const[budgets,setBudgets]=useState({});
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
      if(saved.theme){_themeKey=saved.theme;setThemeState(saved.theme);}
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
      if(saved.advisorMessages)setAdvisorMessages(saved.advisorMessages);
    }
    setHydrated(true);
  },[]);

  useEffect(()=>{
    if(!hydrated)return;
    saveData({lastSavedDate:todayStr(),theme,profile,tasks,goals,completed,supplements,workouts,transactions,journal,books,bills,history,bodyLog,habits,habitLog,holdings,cryptoHoldings,nwHistory,seenMilestones,sidebarCollapsed,advisorMessages:advisorMessages.slice(-40),budgets});
    setLastSaved(Date.now());
  },[hydrated,theme,profile,tasks,goals,completed,supplements,workouts,transactions,journal,books,bills,history,bodyLog,habits,habitLog,holdings,nwHistory,seenMilestones,sidebarCollapsed]);

  const setTheme=th=>{_themeKey=th;setThemeState(th);};
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

  useEffect(()=>{
    if(!hydrated||!profile)return;
    setNwHistory(h=>({...h,[monthStr()]:profile.netWorth||0}));
  },[profile,hydrated]);

  const streak=(()=>{let s=0;for(let i=0;i<365;i++){const k=new Date(Date.now()-i*864e5).toISOString().split("T")[0];if(history[k]?.score>=50)s++;else if(i>0)break;}return s;})();

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
    setShowSetup(false);
    setPage("dashboard");
  };

  if(!hydrated){
    return (
      <div style={{minHeight:"100vh",background:"#080808",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14}}>
        <div style={{fontSize:11,letterSpacing:4,color:"#C9A84C",textTransform:"uppercase",fontFamily:"sans-serif"}}>The Executive</div>
        <div style={{fontSize:11,color:"#6A6050",fontFamily:"sans-serif"}}>Loading...</div>
      </div>
    );
  }

  if(showSetup){
    return <SetupPage onComplete={handleSetupComplete}/>;
  }

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
  const pg={profile:liveProfile,tasks,setTasks,goals,setGoals,completed,setCompleted,supplements,setSupplements,workouts,setWorkouts,transactions,setTransactions,journal,setJournal,books,setBooks,bills,setBills,history,bodyLog,setBodyLog,habits,setHabits,habitLog,setHabitLog,holdings,setHoldings,portfolio,cryptoHoldings,setCryptoHoldings,cryptoPortfolio,budgets,setBudgets,setPage,streak,market,nwHistory:nwHistoryFull,setShowBriefing,setShowRecalibrate};

  return (
    <div style={{display:"flex",minHeight:"100vh",background:t.BG,color:t.TEXT}}>
      <style>{"*{box-sizing:border-box;margin:0;padding:0;} html,body,#root{width:100%;} ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-thumb{background:"+t.BORDER2+";border-radius:2px;} @keyframes sk{0%,100%{opacity:.4}50%{opacity:.8}} button:hover{opacity:.85;} input::placeholder,textarea::placeholder{color:"+t.MUTED2+";} @media(max-width:767px){[data-page]{max-width:100%!important;margin:0!important;}}"}</style>
      {celebration&&<MilestoneCelebration milestone={celebration} onClose={()=>setCelebration(null)}/>}
      {showBriefing&&<MorningBriefing profile={liveProfile} tasks={tasks} onClose={()=>setShowBriefing(false)}/>}
      {showRecalibrate&&<RecalibrateModal profile={activeProfile} onSave={p=>{setProfile(p);setShowRecalibrate(false);}} onClose={()=>setShowRecalibrate(false)}/>}
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
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",alignItems:"center",minHeight:"100vh"}}>
          <div style={{width:"100%",maxWidth:isMobile?undefined:1100,padding:isMobile?"16px 14px":"28px 32px",flex:1,paddingTop:isMobile?"calc(16px + env(safe-area-inset-top))":"calc(28px + env(safe-area-inset-top))",paddingBottom:isMobile?"calc(16px + env(safe-area-inset-bottom) + 70px)":"28px",boxSizing:"border-box"}}>
          {page==="dashboard"&&<DashboardPage {...pg} transactions={transactions} isMobile={isMobile}/>}
          {page==="tasks"&&<TasksPage tasks={tasks} setTasks={setTasks}/>}
          {page==="habits"&&<HabitsPage habits={habits} setHabits={setHabits} habitLog={habitLog} setHabitLog={setHabitLog}/>}
          {page==="goals"&&<GoalsPage goals={goals} setGoals={setGoals} completed={completed} setCompleted={setCompleted}/>}
          {page==="journal"&&<JournalPage entries={journal} setEntries={setJournal}/>}
          {page==="wealth"&&<WealthPage profile={liveProfile} nwHistory={nwHistoryFull} setShowRecalibrate={()=>setShowRecalibrate(true)} holdings={holdings} setHoldings={setHoldings} portfolio={portfolio} cryptoHoldings={cryptoHoldings} setCryptoHoldings={setCryptoHoldings} cryptoPortfolio={cryptoPortfolio}/>}
          {page==="projector"&&<ProjectorPage profile={liveProfile}/>}
          {page==="cashflow"&&<CashFlowPage transactions={transactions} setTransactions={setTransactions}/>}
          {page==="bills"&&<BillsPage bills={bills} setBills={setBills}/>}
          {page==="budget"&&<BudgetPage transactions={transactions} budgets={budgets} setBudgets={setBudgets}/>}
          {page==="tax"&&<TaxPage profile={liveProfile}/>}
          {page==="debt"&&<DebtPage profile={liveProfile} setProfile={setProfile}/>}
          {page==="invest"&&<InvestPage profile={liveProfile}/>}
          {page==="health"&&<HealthPage profile={liveProfile} supplements={supplements} setSupplements={setSupplements} bodyLog={bodyLog} setPage={setPage}/>}
          {page==="body"&&<BodyPage bodyLog={bodyLog} setBodyLog={setBodyLog} profile={liveProfile}/>}
          {page==="workout"&&<WorkoutPage workouts={workouts} setWorkouts={setWorkouts}/>}
          {page==="reading"&&<ReadingPage books={books} setBooks={setBooks}/>}
          {page==="weekly"&&<WeeklyPage profile={liveProfile} tasks={tasks} goals={goals} habits={habits} habitLog={habitLog} history={history} journal={journal} workouts={workouts} supplements={supplements} bodyLog={bodyLog}/>}
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
