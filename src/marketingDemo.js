// -- Marketing demo: the one file of figures ---------------------------------
// A second demo dataset for screenshots and ad captures. It runs through the
// same mechanism as the William Sterling demo (no sign-in, nothing saved) and
// is rendered by the real app. Only the data below is staged.
//
// Open it with the unlisted link:  https://the-executive.vip/app?demo=studio-k7m2
// (not linked from anywhere; change MKT_DEMO_KEY to retire the old link)
//
// While it's open the app is locked to Obsidian with no background photo,
// market prices are fixed to the quotes below (so every capture matches), and
// nothing on the device or in the cloud is read or written.
//
// RULES FOR THESE FIGURES
//  - Net worth must come to FIGURES.netWorth exactly. It is calculated live by
//    the app from the assets and loans below, so if you change any balance,
//    price or quantity, re-balance cashSavings (the check at the bottom of this
//    file logs a warning in the browser console if it doesn't add up).
//  - Nothing shown as progress goes above 70%.
//  - At least one figure is moving down (NDQ and the ASX 200 are red today,
//    and body weight / body fat trend down).
//  - Plain ASCII only (no unicode characters) - the Mac build is strict.

export const MKT_DEMO_KEY="studio-k7m2";

export const FIGURES={
  netWorth:212400,        // headline net worth
  netWorthTarget:518000,  // 212,400 / 518,000 = 41.0%
  streak:23,              // days in a row with a daily score of 50+ (today included)
  trainingDays30:13,      // workouts logged in the last 30 days
  todayScoreParts:{tasksDone:3,tasksTotal:6,habitsDone:3,habitsTotal:5,suppsTaken:3,suppsTotal:5},
};

// Fixed quotes, all in AUD. pct is today's move.
export const MKT_QUOTES_RAW={
  "^GSPC":    {price:6712.40, pct:0.38},
  "^AXJO":    {price:8941.20, pct:-0.27},   // down
  "AUDUSD=X": {price:0.6584,  pct:0.12},
  "VAS.AX":   {price:104.50,  pct:0.42},
  "NDQ.AX":   {price:52.40,   pct:-1.18},   // down
  "CBA.AX":   {price:178.00,  pct:0.61},
  "BTC-USD":  {price:172500,  pct:1.94},
  "ETH-USD":  {price:6200,    pct:-0.83},
  "WES.AX":   {price:81.30,   pct:0.22},
  "CSL.AX":   {price:228.60,  pct:-0.41},
};
export const MKT_QUOTES=Object.fromEntries(Object.entries(MKT_QUOTES_RAW).map(([k,q])=>[k,{
  price:q.price,pct:q.pct,change:Math.round(q.price*q.pct)/100,currency:k==="^GSPC"?"USD":k==="AUDUSD=X"?"USD":"AUD",
}]));

// -- The person ---------------------------------------------------------------
export const MKT_PROFILE={
  firstName:"Daniel",lastName:"Reeves",dob:"1997-03-08",age:"29",location:"Brisbane, QLD",
  occupation:"Senior Project Manager",locale:"en-AU",height:"180",weight:"81.9",
  targetWeight:"79",bodyFat:"17.6",sleepHours:"7.4",annualIncome:"135000",
  cashSavings:"12000",          // re-balance this if anything else changes
  superBalance:"61200",
  shareValue:"39360",cryptoValue:"12480",propertyValue:"",mortgageDebt:"",
  investLoanDebt:"0",carDebt:"0",creditCardDebt:"0",personalDebt:"0",
  netWorthTarget:String(FIGURES.netWorthTarget),
  totalAssets:654040,totalDebt:441640,netWorth:FIGURES.netWorth,
  healthGoals:["Build Muscle","Improve Sleep","Run a half marathon"],
  riskProfile:["Growth - accept volatility"],
};

// -- Helpers (local dates, same as the app) -----------------------------------
const pad=n=>String(n).padStart(2,"0");
const localDateStr=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const ds=n=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-n);return localDateStr(d);};

export function buildMarketingData(){
  let seed=20261020;
  const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
  const r2=(a,b)=>Math.round((a+rnd()*(b-a))*100)/100;
  let id=7000;const nid=()=>++id;
  const today=ds(0);

  // -- Wealth: these add up to FIGURES.netWorth --
  // Assets: apartment 520,000 + offset 9,000 + super 61,200 + shares 39,360
  //         + crypto 12,480 + cash 12,000 = 654,040
  // Loans:  home loan 440,000 + credit card 1,640 = 441,640
  // Net worth: 654,040 - 441,640 = 212,400
  const homeLoan={id:"mkt_home",name:"Home Loan - ING",type:"Mortgage",lender:"ING",balance:440000,originalBalance:452000,rate:5.89,minPayment:1320,frequency:"fortnightly",
    nextPaymentDate:ds(-6),offsetBalance:9000,startDate:"2023-05-12",endDate:"2053-05-12",notes:"Offset linked to everyday account",payments:[]};
  const card={id:"mkt_card",name:"ANZ Rewards Black",type:"Credit Card",lender:"ANZ",balance:1640,originalBalance:1640,rate:20.99,minPayment:0,frequency:"monthly",
    nextPaymentDate:"",offsetBalance:0,notes:"Paid in full monthly",payments:[]};
  const vh=(v,step)=>Array.from({length:6}).map((_,i)=>({date:ds((6-i)*60),value:Math.round(v-(6-i)*step)}));
  const properties=[
    {id:"mkt_p1",nickname:"Apartment - Newstead",type:"home",category:"residential",currentValue:520000,purchasePrice:485000,purchaseDate:"2023-05-12",mortgageBalance:0,
      linkedDebtIds:["mkt_home"],ratesAnnual:1900,insuranceAnnual:0,strataAnnual:4200,maintenanceAnnual:800,valueHistory:vh(520000,4500)},
  ];
  const holdings=[
    {id:"mkt_h1",ticker:"VAS.AX",name:"Vanguard Australian Shares ETF",shares:200,avgCost:94.10},   // 20,900
    {id:"mkt_h2",ticker:"NDQ.AX",name:"Betashares Nasdaq 100 ETF",shares:230,avgCost:44.20},        // 12,052
    {id:"mkt_h3",ticker:"CBA.AX",name:"Commonwealth Bank",shares:36,avgCost:151.30},                // 6,408
  ];
  const cryptoHoldings=[
    {id:"mkt_c1",ticker:"BTC",symbol:"BTC",name:"Bitcoin",amount:0.04,avgCost:121000},   // 6,900
    {id:"mkt_c2",ticker:"ETH",symbol:"ETH",name:"Ethereum",amount:0.9,avgCost:5100},     // 5,580
  ];
  const superLog=[0,1,2,3,4,5].map(i=>({id:nid(),date:ds((5-i)*30+4),balance:55200+i*1200,change:1200,type:"balance",note:i===5?"Quarterly statement":""})).reverse();

  // -- Money in and out (last ~95 days) --
  const tx=[];
  const add=(n,type,category,amount,note)=>tx.push({id:nid(),date:ds(n),type,category,amount:Math.round(amount*100)/100,note});
  for(let n=3;n<95;n+=14)add(n,"income","Salary",3980.40,"Salary - Northline Projects");
  add(33,"income","Dividends",142.80,"VAS distribution");add(9,"income","Investment Income",18.60,"Interest - savings");
  const shops=[["Groceries",["Woolworths","Coles","Aldi"],45,165,4],["Dining Out & Takeaway",["Uber Eats","Sushi Train","Howard Smith Wharves","Guzman y Gomez"],18,120,5],
    ["Fuel",["Ampol","BP"],55,85,10],["Transport",["Linkt tolls","Uber"],6,32,8],["Entertainment",["Event Cinemas","Ticketek"],25,120,18],
    ["Clothing & Personal Care",["Uniqlo","Barber - Fellow"],35,160,20],["Health & Medical",["Chemist Warehouse"],18,60,24],["Home & Garden",["Bunnings","Kmart"],20,140,26]];
  shops.forEach(([cat,names,lo,hi,every])=>{for(let n=1+Math.floor(rnd()*every);n<95;n+=every)add(n,"expense",cat,r2(lo,hi),names[Math.floor(rnd()*names.length)]);});
  const monthly=[["Utilities","Origin energy",110,150,30],["Phone & Internet","Aussie Broadband",89,89,30],["Phone & Internet","Telstra mobile",55,55,30],
    ["Subscriptions","Spotify",16,16,30],["Subscriptions","Netflix",19,19,30],["Insurance","Medibank health cover",165,165,30],["Insurance","Car insurance - RACQ",92,92,30],["Gym & Fitness","Fitstop membership",32,32,7]];
  monthly.forEach(([cat,note,lo,hi,every])=>{for(let n=3+Math.floor(rnd()*6);n<95;n+=every)add(n,"expense",cat,r2(lo,hi),note);});
  tx.sort((a,b)=>b.date.localeCompare(a.date));
  const budgets={"Groceries":"900","Dining Out & Takeaway":"600","Fuel":"300","Transport":"150","Entertainment":"250","Clothing & Personal Care":"300","Health & Medical":"150",
    "Gym & Fitness":"200","Subscriptions":"80","Utilities":"220","Phone & Internet":"220","Insurance":"400","Home & Garden":"250","Rent & Mortgage":"4000"};

  const billsRaw=[
    ["Origin Energy",390,"quarterly","Utilities",27,false],["Aussie Broadband",89,"monthly","Utilities",6,true],["Telstra Mobile",55,"monthly","Subscriptions",11,true],
    ["Medibank Health Cover",165,"monthly","Health",14,true],["Car Insurance - RACQ",92,"monthly","Insurance",18,true],["Body Corporate - Newstead",1050,"quarterly","Housing",36,false],
    ["Council Rates",475,"quarterly","Housing",44,false],["Fitstop",32,"weekly","Health",2,true],["Spotify",16,"monthly","Subscriptions",21,true],["Car Registration",412,"annually","Transport",88,false],
  ];
  const bills=billsRaw.map(([name,amount,frequency,category,dueIn,autopay],i)=>({id:"mkt_b"+i,name,amount,frequency,category,autopay,nextDue:ds(-dueIn),lastPaid:"",paymentHistory:[]}));
  fitBudgets(budgets,tx,billsRaw,homeLoan);
  const dividends=[
    {id:"mkt_d1",ticker:"VAS.AX",name:"Vanguard Australian Shares",amountPerShare:"0.98",frequency:"quarterly",nextPayDate:ds(-15),franking:"75",shares:200},
    {id:"mkt_d2",ticker:"CBA.AX",name:"Commonwealth Bank",amountPerShare:"2.40",frequency:"semi-annual",nextPayDate:ds(-150),franking:"100",shares:36},
  ];
  const watchlist=[
    {id:"mkt_w1",ticker:"WES.AX",name:"Wesfarmers",notes:"Quality compounder - watching",alertBelow:"76",alertAbove:"",addedDate:ds(40),addedPrice:null,addedCurrency:null},
    {id:"mkt_w2",ticker:"CSL.AX",name:"CSL",notes:"Healthcare exposure",alertBelow:"",alertAbove:"",addedDate:ds(15),addedPrice:null,addedCurrency:null},
  ];
  const calendarItems=[
    {id:"mkt_ci1",type:"income",title:"Salary",date:ds(3),repeat:"fortnightly",amount:"3980.40",note:"",doneDates:[]},
    {id:"mkt_ci2",type:"reminder",title:"Salary sacrifice top-up",date:ds(-9),repeat:"quarterly",amount:"",note:"Concessional cap check",doneDates:[]},
    {id:"mkt_ci3",type:"reminder",title:"Brisbane half marathon",date:ds(-26),repeat:"none",amount:"",note:"",doneDates:[]},
  ];

  // -- Today: 3 of 6 tasks, 3 of 5 habits, 3 of 5 supplements --
  const tasks=[
    {id:1,text:"Review offset and budget",done:true,priority:"high"},
    {id:2,text:"Send project status report",done:false,priority:"high"},
    {id:3,text:"Book physio for left knee",done:false,priority:"high"},
    {id:4,text:"Zone 2 run - 8km",done:true,priority:"medium"},
    {id:5,text:"Read 20 pages",done:true,priority:"medium"},
    {id:6,text:"Plan next week's meals",done:false,priority:"low"},
  ];
  const supplements=[
    {id:1,name:"Vitamin D3",dose:"2000 IU",time:"morning",taken:true},
    {id:2,name:"Creatine",dose:"5g",time:"morning",taken:true},
    {id:3,name:"Omega-3",dose:"2g",time:"morning",taken:true},
    {id:4,name:"Magnesium",dose:"400mg",time:"evening",taken:false},
    {id:5,name:"Zinc",dose:"15mg",time:"evening",taken:false},
  ];
  const habits=[
    {id:1,name:"Morning Routine",icon:"sunrise",color:"#C9A84C",target:7},
    {id:2,name:"Strength Training",icon:"dumbbell",color:"#7A9E7E",target:5},
    {id:3,name:"Reading Daily",icon:"book-open",color:"#B07EC9",target:7},
    {id:4,name:"Meditation",icon:"flower-2",color:"#D4956A",target:7},
    {id:5,name:"Evening Walk",icon:"footprints",color:"#7EB8C9",target:5},
  ];

  // -- Training: exactly FIGURES.trainingDays30 workouts in the last 30 days --
  const trainDays=[1,3,5,8,10,12,15,17,19,22,24,27,29].slice(0,FIGURES.trainingDays30);
  const olderDays=[32,34,37,39,41,44,47,50,52,55];
  const plans=[["Strength",[["Bench Press",4,6,82.5],["Incline DB Press",3,10,28],["Weighted Dips",3,8,10]]],["Strength",[["Back Squat",5,5,110],["Romanian Deadlift",3,8,90],["Walking Lunge",3,12,18]]],
    ["Cardio",[]],["Strength",[["Deadlift",4,4,145],["Pull Ups",4,8,0],["Barbell Row",3,8,72.5]]]];
  const workouts=[...trainDays,...olderDays].map((n,k)=>{const [type,sets]=plans[k%plans.length];
    return{id:nid(),date:ds(n),type,duration:type==="Cardio"?45:60,notes:type==="Cardio"?"Zone 2 run, 8km":"",sets:sets.map(([exercise,s,reps,weight])=>({id:nid(),exercise,sets:s,reps,weight:String(weight)}))};});
  const bodyLog=Array.from({length:12}).map((_,i)=>({id:nid(),date:ds((11-i)*7+1),weight:String((84.6-i*0.245).toFixed(1)),bodyFat:String((19.8-i*0.2).toFixed(1)),
    sleep:String((6.9+rnd()*0.8).toFixed(1)),hrv:String(Math.round(54+i*0.9+rnd()*5))})).reverse();

  // -- Daily score history and habits: a streak of exactly FIGURES.streak --
  // Scores stay at or under 70. Today (57) counts, so days 1..streak-1 are 50+ and the two days before are under 50.
  // Habits: never more than 3 of 5 on a day, and no habit above 70% of its weekly target.
  const history={},habitLog={};
  const lastWeek={0:[1,3,4],1:[1,2,5],2:[3,4],3:[1,2,5],4:[3,5],5:[1,2,4],6:[3,4]};
  Object.entries(lastWeek).forEach(([n,hs])=>hs.forEach(h=>{habitLog[h+"_"+ds(Number(n))]=true;}));
  const trainSet=new Set([...trainDays,...olderDays]);
  for(let n=1;n<=120;n++){
    const d=ds(n);
    let score;
    if(n<FIGURES.streak)score=52+Math.round(rnd()*18);
    else if(n<FIGURES.streak+2)score=34+Math.round(rnd()*10);
    else score=36+Math.round(rnd()*32);
    history[d]={score,tasks:3,supps:3,habits:3};
    if(n>=7){
      const pick=trainSet.has(n)?[2]:[];
      [1,3,4,5].sort(()=>rnd()-0.5).forEach(h=>{if(pick.length<(rnd()<0.35?2:3))pick.push(h);});
      pick.forEach(h=>{habitLog[h+"_"+d]=true;});
    }
  }

  // -- Net worth over time: rising, with a dip in the middle of the year --
  const nwMonths=[151800,156900,161200,167400,171900,166300,174800,183100,191600,198200,204600]; // oldest to last month
  const nwHistory={};
  nwMonths.forEach((v,idx)=>{const i=11-idx;const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-i);nwHistory[d.getFullYear()+"-"+pad(d.getMonth()+1)]=v;});
  const dailySnaps={};
  for(let n=1;n<=90;n++){
    const nw=Math.round(FIGURES.netWorth-n*155+(rnd()-0.5)*2400);
    dailySnaps[ds(n)]={nw,a:nw+441640,d:441640,td:["Review offset and budget"],to:[],st:["Vitamin D3","Creatine"],sm:[],books:{}};
  }

  // -- Everything else --
  const goals=[
    {id:1,title:"Reach $518k net worth",period:"year",progress:40,category:"financial",startDate:ds(290),endDate:ds(-72),
      checkpoints:[{id:1,text:"Clear the car loan",dueDate:ds(170),done:true,doneAt:ds(160)},{id:2,text:"Pass $200k",dueDate:ds(40),done:true,doneAt:ds(52)},
        {id:3,text:"Hold $15k in the offset",dueDate:ds(-30),done:false,doneAt:""},{id:4,text:"Pass $250k",dueDate:ds(-150),done:false,doneAt:""},{id:5,text:"Top up super before 30 June",dueDate:ds(-250),done:false,doneAt:""}]},
    {id:2,title:"Run a sub-1:50 half marathon",period:"year",progress:55,category:"health",endDate:ds(-26)},
    {id:3,title:"Read 12 books",period:"year",progress:42,category:"education"},
    {id:4,title:"Lead the Q4 project delivery",period:"month",progress:62,category:"career"},
    {id:5,title:"Train 4 times a week",period:"week",progress:50,category:"health"},
  ];
  const completed=[{id:91,title:"Clear the car loan",period:"year",progress:100,category:"financial",completedAt:ds(160)}];
  const books=[
    {id:1,title:"The Psychology of Money",author:"Morgan Housel",status:"reading",cur:168,tot:256,readingNotes:[{id:nid(),date:ds(2),fromPage:140,toPage:168,text:"Enough is a number. Know yours."}]},
    {id:2,title:"Atomic Habits",author:"James Clear",status:"next",cur:0,tot:320,readingNotes:[]},
    {id:3,title:"Die With Zero",author:"Bill Perkins",status:"done",cur:240,tot:240,rating:4,review:"Spend on experiences while you can enjoy them.",dateFinished:ds(35),readingNotes:[]},
    {id:4,title:"The Simple Path to Wealth",author:"JL Collins",status:"done",cur:286,tot:286,rating:5,review:"",dateFinished:ds(80),readingNotes:[]},
    {id:5,title:"Deep Work",author:"Cal Newport",status:"done",cur:296,tot:296,rating:4,review:"",dateFinished:ds(130),readingNotes:[]},
    {id:6,title:"Can't Hurt Me",author:"David Goggins",status:"done",cur:364,tot:364,rating:4,review:"",dateFinished:ds(175),readingNotes:[]},
    {id:7,title:"The Barefoot Investor",author:"Scott Pape",status:"done",cur:272,tot:272,rating:4,review:"",dateFinished:ds(240),readingNotes:[]},
  ];
  const journal=[
    [1,4,"Solid day. Status report half done, 8km run before work. Offset is ahead of plan."],
    [4,3,"Long day on site. Skipped the walk. Early night instead."],
    [7,5,"Deadlift 145 for 4. Felt strong. Sleep has been better since the phone stays out of the bedroom."],
    [12,4,"Reviewed spending - dining out is the one to watch this month."],
  ].map(([n,mood,text])=>({id:nid(),date:ds(n),mood,text,updatedAt:ds(n)}));
  const notes=[
    {id:nid(),title:"Q4 priorities",content:"- Deliver the Northline project\n- Hold $15k in the offset\n- Sub-1:50 half marathon",category:"Goals",pinned:true,createdAt:ds(20),updatedAt:ds(2)},
    {id:nid(),title:"Ideas",content:"Salary sacrifice an extra $200 a fortnight.",category:"Ideas",pinned:false,createdAt:ds(11),updatedAt:ds(11)},
  ];
  const services=[
    {id:nid(),name:"Priya Nair",role:"Accountant",firm:"Nair Tax & Advisory",phone:"07 3000 2211",email:"priya@example.com",lastContact:ds(30),nextFollow:ds(-40),notes:"Return lodged"},
    {id:nid(),name:"Tom Becker",role:"Mortgage Broker",firm:"Becker Lending",phone:"0400 000 222",email:"tom@example.com",lastContact:ds(21),nextFollow:ds(-12),notes:"Rate review"},
  ];
  const taxDeductions=[["Home office running costs","Work from Home",640,40],["Mobile phone (work portion)","Phone & Internet",290,25],["PMP course","Education & Training",780,70]]
    .map(([description,category,amount,n])=>({id:nid(),description,category,amount,date:ds(n),receipt:true}));

  return{profile:MKT_PROFILE,tasks,supplements,habits,goals,completed,books,readingGoal:12,
    transactions:tx,debts:[homeLoan,card],properties,bills,holdings,cryptoHoldings,commodityHoldings:[],altAssets:[],superLog,dividends,watchlist,calendarItems,
    workouts,bodyLog,journal,notes,services,taxDeductions,history,habitLog,dailySnaps,nwHistory,budgets};
}

// Raise any budget whose month (spent so far + bills and repayments still due) would pass 65%
function budgetCatForBill(name,category){
  const n=name.toLowerCase();
  if(/rent|mortgage|strata|body corp|council|rates/.test(n))return "Rent & Mortgage";
  if(/phone|mobile|internet|nbn|telstra|optus|vodafone|broadband/.test(n))return "Phone & Internet";
  if(/gym|fitness|pilates|yoga|fitstop/.test(n))return "Gym & Fitness";
  if(/insurance|medibank|health cover/.test(n))return "Insurance";
  if(/electric|power|energy|gas|water/.test(n))return "Utilities";
  if(/netflix|spotify|stan|disney|icloud|apple|youtube|prime|subscription/.test(n))return "Subscriptions";
  if(/rego|registration|toll|parking/.test(n))return "Transport";
  return category==="Health"?"Health & Medical":category==="Utilities"?"Utilities":category==="Insurance"?"Insurance":"Other";
}
function fitBudgets(budgets,tx,billsRaw,loan){
  const now=new Date();const m0=localDateStr(new Date(now.getFullYear(),now.getMonth(),1));const mEnd=localDateStr(new Date(now.getFullYear(),now.getMonth()+1,0,12));
  const need={};const addN=(c,v)=>{need[c]=(need[c]||0)+v;};
  tx.forEach(x=>{if(x.type==="expense"&&x.date>=m0&&x.date<=ds(0))addN(x.category,x.amount);});
  const step={weekly:7,fortnightly:14};
  const due=(dueIn,freq,amount,cat)=>{
    // every occurrence from today to the end of the month (generous: counts each budget category the app might use)
    let d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+dueIn);
    while(localDateStr(d)<=mEnd){addN(cat,amount);if(step[freq])d.setDate(d.getDate()+step[freq]);else if(freq==="monthly")d.setMonth(d.getMonth()+1);else if(freq==="quarterly")d.setMonth(d.getMonth()+3);else d.setFullYear(d.getFullYear()+1);}
  };
  billsRaw.forEach(([name,amount,freq,category,dueIn])=>{const c=budgetCatForBill(name,category);due(dueIn,freq,amount,c);if(c!=="Utilities"&&category==="Utilities")due(dueIn,freq,amount,"Utilities");if(category==="Health")due(dueIn,freq,amount,"Health & Medical");});
  const loanIn=Math.round((new Date(loan.nextPaymentDate+"T12:00:00")-new Date(ds(0)+"T12:00:00"))/864e5);
  due(loanIn,loan.frequency,loan.minPayment,"Rent & Mortgage");
  Object.entries(need).forEach(([c,v])=>{if(budgets[c]===undefined)return;const min=Math.ceil(v/0.65/50)*50;if(Number(budgets[c])<min)budgets[c]=String(min);});
}

// Self-check: logs a warning if the figures above no longer add up to FIGURES.netWorth
export function checkMarketingFigures(d){
  try{
    const q=t=>MKT_QUOTES[t]?MKT_QUOTES[t].price:0;
    const shares=d.holdings.reduce((s,h)=>s+q(h.ticker)*h.shares,0);
    const crypto=d.cryptoHoldings.reduce((s,h)=>s+q(h.ticker+"-USD")*h.amount,0);
    const assets=d.properties.reduce((s,p)=>s+p.currentValue,0)+d.debts.reduce((s,x)=>s+(x.offsetBalance||0),0)+Number(MKT_PROFILE.cashSavings)+Number(MKT_PROFILE.superBalance)+shares+crypto;
    const debt=d.debts.reduce((s,x)=>s+x.balance,0);
    const nw=Math.round(assets-debt);
    if(nw!==FIGURES.netWorth)console.warn("Marketing demo: figures add up to "+nw+", not "+FIGURES.netWorth+". Re-balance cashSavings.");
    return nw;
  }catch{return null;}
}
