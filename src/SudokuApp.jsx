import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────
// SUDOKU ENGINE
// ─────────────────────────────────────────────
function isValid(b,r,c,n){
  for(let i=0;i<9;i++){
    if(b[r][i]===n||b[i][c]===n)return false;
    const br=3*Math.floor(r/3)+Math.floor(i/3),bc=3*Math.floor(c/3)+(i%3);
    if(b[br][bc]===n)return false;
  }
  return true;
}
function shuffle(a){const x=[...a];for(let i=x.length-1;i>0;i--){const j=0|Math.random()*(i+1);[x[i],x[j]]=[x[j],x[i]];}return x;}
function solve(b){
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){
    if(b[r][c]===0){
      for(const n of shuffle([1,2,3,4,5,6,7,8,9])){
        if(isValid(b,r,c,n)){b[r][c]=n;if(solve(b))return true;b[r][c]=0;}
      }
      return false;
    }
  }
  return true;
}
function makeFull(){const b=Array.from({length:9},()=>Array(9).fill(0));solve(b);return b;}
function smartHint(board,sol,given,sel){
  const cands=(r,c)=>{
    const rv=new Set(board[r]),cv=new Set(board.map(x=>x[c]));
    const br=3*Math.floor(r/3),bc=3*Math.floor(c/3),bv=new Set();
    for(let dr=0;dr<3;dr++)for(let dc=0;dc<3;dc++)bv.add(board[br+dr][bc+dc]);
    return[1,2,3,4,5,6,7,8,9].filter(n=>!rv.has(n)&&!cv.has(n)&&!bv.has(n));
  };
  const reason=(r,c,num)=>{
    if(cands(r,c).length===1)return`Only ${num} fits here — all other digits are blocked by this cell’s row, column, or box.`;
    return`In row ${r+1}, column ${c+1}: after checking all constraints, ${num} is the correct digit.`;
  };
  if(sel){
    const[sr,sc]=sel;
    if(!given[sr][sc]&&board[sr][sc]!==sol[sr][sc])
      return{r:sr,c:sc,num:sol[sr][sc],reason:reason(sr,sc,sol[sr][sc])};
  }
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){
    if(!given[r][c]&&board[r][c]!==sol[r][c])
      return{r,c,num:sol[r][c],reason:reason(r,c,sol[r][c])};
  }
  return null;
}

// ─────────────────────────────────────────────
// DAILY
// ─────────────────────────────────────────────
function todayStr(){const d=new Date();return`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;}
function weekStr(){const d=new Date();const day=d.getDay();const mon=new Date(d);mon.setDate(d.getDate()-day+1);return`${mon.getFullYear()}-W${String(Math.ceil((mon.getDate())/7)).padStart(2,"0")}-${mon.getMonth()+1}-${mon.getDate()}`;}
function getWeeklyPuzzle(){return getDailyPuzzle(weekStr());}
function dateToSeed(s){let h=0;for(let i=0;i<s.length;i++)h=Math.imul(31,h)+s.charCodeAt(i)|0;return Math.abs(h);}
function seededRng(seed){let s=seed;return()=>{s=(s*1664525+1013904223)&0xffffffff;return(s>>>0)/0xffffffff;};}
function seededShuffle(a,rng){const x=[...a];for(let i=x.length-1;i>0;i--){const j=0|rng()*(i+1);[x[i],x[j]]=[x[j],x[i]];}return x;}
function solveS(b,rng){
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){
    if(b[r][c]===0){
      for(const n of seededShuffle([1,2,3,4,5,6,7,8,9],rng)){
        if(isValid(b,r,c,n)){b[r][c]=n;if(solveS(b,rng))return true;b[r][c]=0;}
      }
      return false;
    }
  }
  return true;
}
function makeDailyPuzzle(dateStr){
  const rng=seededRng(dateToSeed(dateStr||todayStr()));
  const sol=Array.from({length:9},()=>Array(9).fill(0));
  solveS(sol,rng);
  const puz=sol.map(r=>[...r]);
  let rem=81-28;
  for(const i of seededShuffle([...Array(81).keys()],rng)){
    if(!rem)break;puz[0|i/9][i%9]=0;rem--;
  }
  return{puzzle:puz,solution:sol,dateKey:dateStr||todayStr()};
}

// ─────────────────────────────────────────────
// HAPTICS + AUDIO
// ─────────────────────────────────────────────
function vib(p){try{navigator.vibrate&&navigator.vibrate(p);}catch{}}
let _ctx=null;
function ctx(){if(!_ctx)_ctx=new(window.AudioContext||window.webkitAudioContext)();return _ctx;}
function tone(f,d,type="sine",vol=0.12,when=0){
  try{
    const c=ctx(),o=c.createOscillator(),g=c.createGain();
    o.connect(g);g.connect(c.destination);
    o.type=type;o.frequency.value=f;
    const t=c.currentTime+when;
    g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+d);
    o.start(t);o.stop(t+d);
  }catch{}
}
const SFX={
  tap:  ()=>tone(660,0.07,"sine",0.09),
  note: ()=>tone(440,0.05,"sine",0.07),
  ok:   ()=>{tone(523,0.08);tone(659,0.08,"sine",0.12,0.09);},
  bad:  ()=>{tone(370,0.15,"sine",0.09);tone(294,0.20,"sine",0.08,0.10);tone(220,0.25,"sine",0.06,0.20);},
  hint: ()=>{tone(440,0.06);tone(550,0.08,"sine",0.09,0.07);},
  undo: ()=>tone(330,0.08,"sine",0.09),
  era:  ()=>tone(250,0.06,"triangle",0.09),
  // soft two-note chime for completing a row/col/box
  line: ()=>{tone(784,0.12,"sine",0.07);tone(1047,0.18,"sine",0.06,0.10);},
  win:  ()=>{[523,659,784,1047].forEach((f,i)=>tone(f,0.18,"sine",0.18,i*0.12));setTimeout(()=>tone(1047,0.4,"sine",0.20),520);},
  ach:  ()=>{[523,659,784,880].forEach((f,i)=>tone(f,0.14,"sine",0.15,i*0.10));},
  zen:  ()=>tone(528,0.25,"sine",0.06),
  zenW: ()=>{[396,528,660].forEach((f,i)=>tone(f,0.5,"sine",0.09,i*0.3));},
  zenLine:()=>tone(528,0.22,"sine",0.04),
};

// ─────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────
const K={set:"sf_settings_v1",stats:"sf_stats_v2",hist:"sf_hist_v1",achv:"sf_achv_v1",arch:"sf_arch_v1",ob:"sf_ob_v1",goals:"sf_goals_v1",rewards:"sf_rewards_v1",weekly:"sf_weekly_v1",notif:"sf_notif_v1",store:"sf_store_v1"};
const get=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch{return d;}};
const set=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}};

// ─────────────────────────────────────────────
// DAILY GOALS
// ─────────────────────────────────────────────
const DAILY_GOALS=[
  {id:"speed",icon:"⚡",label:"Speed Run",desc:"Finish in under 10 minutes",check:(t,m,h)=>t<600},
  {id:"pure",icon:"🧠",label:"Pure Logic",desc:"Finish without any hints",check:(t,m,h)=>h===0},
  {id:"clean",icon:"✨",label:"Clean Solve",desc:"Finish with 1 mistake or fewer",check:(t,m,h)=>m<=1},
];
function getDailyGoals(dateKey){return get(`${K.goals}:${dateKey}`,{});}
function saveDailyGoals(dateKey,goals){set(`${K.goals}:${dateKey}`,goals);}
function checkAndSaveDailyGoals(dateKey,time,mistakes,hints){
  const prev=getDailyGoals(dateKey);
  const updated={...prev};
  DAILY_GOALS.forEach(g=>{if(!prev[g.id]&&g.check(time,mistakes,hints))updated[g.id]=true;});
  saveDailyGoals(dateKey,updated);
  return updated;
}
// Which goals were newly completed (for toast)
function newGoalsBadges(prev,next){
  return DAILY_GOALS.filter(g=>!prev[g.id]&&next[g.id]);
}

// ─────────────────────────────────────────────
// STREAK REWARDS
// ─────────────────────────────────────────────
const STREAK_REWARDS=[
  {streak:7,  id:"w1", icon:"🔮", label:"Crystal Glow",   desc:"Subtle glow on your board",  type:"glow"},
  {streak:14, id:"w2", icon:"🌸", label:"Petal Frame",    desc:"Soft frame around the board", type:"frame"},
  {streak:21, id:"w3", icon:"⚡", label:"Spark Trail",    desc:"Lightning cells on complete", type:"spark"},
  {streak:30, id:"w4", icon:"🌙", label:"Lunar Halo",     desc:"Moonlit board aura",          type:"halo"},
  {streak:60, id:"w5", icon:"🌌", label:"Cosmic Board",   desc:"Deep space board style",      type:"cosmic"},
  {streak:100,id:"w6", icon:"👑", label:"Grand Master",   desc:"The ultimate board style",    type:"crown"},
];
function getUnlockedRewards(dStreak){
  const unlocked=get(K.rewards,[]);
  const earned=STREAK_REWARDS.filter(r=>dStreak>=r.streak).map(r=>r.id);
  let changed=false;
  earned.forEach(id=>{if(!unlocked.includes(id)){unlocked.push(id);changed=true;}});
  if(changed)set(K.rewards,unlocked);
  return unlocked;
}
function getActiveReward(settings){return settings.boardReward||null;}
function getRewardStyle(rewardId,acc){
  const r=STREAK_REWARDS.find(x=>x.id===rewardId);
  if(!r)return{};
  const styles={
    glow:    {boxShadow:`0 0 0 2px ${acc}66, 0 0 28px ${acc}44, 0 14px 40px rgba(0,0,0,0.3)`},
    frame:   {boxShadow:`0 0 0 3px ${acc}88, 0 0 16px ${acc}33, 0 14px 40px rgba(0,0,0,0.3)`, borderRadius:12},
    spark:   {boxShadow:`0 0 0 2px ${acc}77, 0 0 36px ${acc}55, 0 14px 40px rgba(0,0,0,0.3)`},
    halo:    {boxShadow:`0 0 0 2px ${acc}55, 0 0 48px ${acc}44, 0 0 80px ${acc}22, 0 14px 40px rgba(0,0,0,0.3)`},
    cosmic:  {boxShadow:`0 0 0 2px ${acc}88, 0 0 60px ${acc}55, 0 0 100px ${acc}33, 0 14px 40px rgba(0,0,0,0.3)`},
    crown:   {boxShadow:`0 0 0 3px ${acc}, 0 0 60px ${acc}77, 0 0 100px ${acc}44, 0 14px 40px rgba(0,0,0,0.3)`, borderRadius:14},
  };
  return styles[r.type]||{};
}
const DEFAULT_SETTINGS={
  theme:"midnight",dark:true,
  highlightMistakes:true,autoNotes:true,highlightSame:true,
  showTimer:true,pauseOnHide:true,soundOn:true,hapticsOn:true,
  allowBgAudio:false,singleTapClear:false,textSize:"medium",colorblind:false,
};
const DEFAULT_STATS={
  easy:{p:0,w:0,best:null,bestMistakes:null,wins:[]},
  medium:{p:0,w:0,best:null,bestMistakes:null,wins:[]},
  hard:{p:0,w:0,best:null,bestMistakes:null,wins:[]},
  "very hard":{p:0,w:0,best:null,bestMistakes:null,wins:[]},
  daily:{p:0,w:0,best:null,bestMistakes:null,wins:[]},
  wStreak:0,bWStreak:0,dStreak:0,bDStreak:0,lastDailyWin:null,dWins:0,
  zenW:0,focusW:0,endlessBest:0,practiceW:0,
};
const ACHDEFS=[
  {id:"first",icon:"🏅",label:"First Win",desc:"Complete your first puzzle"},
  {id:"flawless",icon:"✨",label:"Flawless",desc:"Finish with zero mistakes"},
  {id:"nohints",icon:"🧠",label:"Pure Logic",desc:"Finish without hints"},
  {id:"speed",icon:"⚡",label:"Speed Runner",desc:"Medium in under 5 min"},
  {id:"s3",icon:"🔥",label:"On Fire",desc:"3-day daily streak"},
  {id:"s7",icon:"💫",label:"Week Warrior",desc:"7-day daily streak"},
  {id:"s30",icon:"🌟",label:"Monthly Master",desc:"30-day streak"},
  {id:"hard",icon:"💎",label:"Hard Earned",desc:"Complete a Hard puzzle"},
  {id:"vhard",icon:"👑",label:"Grand Master",desc:"Complete Very Hard"},
  {id:"zen3",icon:"🧘",label:"Zen Garden",desc:"3 Zen mode wins"},
  {id:"focus",icon:"🎯",label:"Laser Focus",desc:"Win a Focus Mode game"},
  {id:"endless5",icon:"♾️",label:"Endless Flow",desc:"Reach level 5 endless"},
  {id:"practice5",icon:"📚",label:"Dedicated",desc:"5 practice wins"},
];
function tryUnlock(id){
  const a=get(K.achv,{});if(a[id])return null;
  a[id]=Date.now();set(K.achv,a);
  return ACHDEFS.find(d=>d.id===id)||null;
}
function checkAchievements(res,stats){
  const u=[],p=id=>{const r=tryUnlock(id);if(r)u.push(r);};
  const tw=["easy","medium","hard","very hard","daily"].reduce((s,k)=>s+(stats[k]?.w||0),0);
  if(tw>=1)p("first");
  if(res.won&&res.mistakes===0)p("flawless");
  if(res.won&&res.hints===0)p("nohints");
  if(res.won&&res.diff==="medium"&&res.time<300)p("speed");
  if((stats.dStreak||0)>=3)p("s3");
  if((stats.dStreak||0)>=7)p("s7");
  if((stats.dStreak||0)>=30)p("s30");
  if(res.won&&res.diff==="hard")p("hard");
  if(res.won&&res.diff==="very hard")p("vhard");
  if((stats.zenW||0)>=3)p("zen3");
  if(res.won&&res.mode==="focus")p("focus");
  if((res.endlessLevel||0)>=5)p("endless5");
  if((stats.practiceW||0)>=5)p("practice5");
  return u;
}
function recordWin(stats,diff,time,isDaily,mode){
  const s={...stats};
  const key=isDaily?"daily":diff;
  const prev=s[key]||{p:0,w:0,best:null,bestMistakes:null,wins:[]};
  // wins array stores last 20 {time,mistakes,hints} for averages & trend
  const wins=[...(prev.wins||[]),{time,mistakes:0,hints:0}].slice(-20);
  s[key]={...prev,w:(prev.w||0)+1,
    best:prev.best===null?time:Math.min(prev.best,time),
    wins};
  s.wStreak=(s.wStreak||0)+1;s.bWStreak=Math.max(s.bWStreak||0,s.wStreak);
  if(mode==="zen")s.zenW=(s.zenW||0)+1;
  if(mode==="focus")s.focusW=(s.focusW||0)+1;
  if(mode==="practice")s.practiceW=(s.practiceW||0)+1;
  if(isDaily){
    const today=todayStr(),last=s.lastDailyWin;
    if(last!==today){
      const d=new Date();d.setDate(d.getDate()-1);
      const yest=`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
      s.dStreak=last===yest?(s.dStreak||0)+1:1;
      s.bDStreak=Math.max(s.bDStreak||0,s.dStreak);
      s.lastDailyWin=today;s.dWins=(s.dWins||0)+1;
    }
  }
  set(K.stats,s);return s;
}
// Call this after recordWin to patch win details (mistakes/hints passed separately)
function patchLastWin(stats,key,mistakes,hints){
  const s={...stats};
  const k=s[key]||{};
  const wins=[...(k.wins||[])];
  if(wins.length>0){
    wins[wins.length-1]={...wins[wins.length-1],mistakes,hints};
    // update bestMistakes
    const bm=k.bestMistakes;
    k.bestMistakes=(bm===null||bm===undefined)?mistakes:Math.min(bm,mistakes);
  }
  s[key]={...k,wins,bestMistakes:k.bestMistakes};
  set(K.stats,s);return s;
}
function recordLoss(stats){const s={...stats,wStreak:0};set(K.stats,s);return s;}
function recordPlayed(stats,diff,isDaily){
  const key=isDaily?"daily":diff;
  const s={...stats,[key]:{...(stats[key]||{}),p:(stats[key]?.p||0)+1}};
  set(K.stats,s);return s;
}

// ─────────────────────────────────────────────
// SEED-BASED PUZZLE SHARING
// ─────────────────────────────────────────────
const DIFF_IDX={easy:0,medium:1,hard:2,"very hard":3};
const IDX_DIFF=["easy","medium","hard","very hard"];
function encodeShare(diff,seed){
  const u=((DIFF_IDX[diff]||0)*0x40000000+(seed&0x3fffffff))>>>0;
  return u.toString(36).toUpperCase().padStart(7,"0");
}
function decodeShare(code){
  try{
    const u=parseInt((code||"").trim().toUpperCase(),36);
    if(isNaN(u)||u<0)return null;
    const diff=IDX_DIFF[Math.floor(u/0x40000000)&3];
    const seed=u%0x40000000;
    return{diff,seed};
  }catch{return null;}
}
function makePuzzleFromSeed(diff,seed){
  const rng=seededRng(seed);
  const sol=Array.from({length:9},()=>Array(9).fill(0));
  solveS(sol,rng);
  const puz=sol.map(r=>[...r]);
  const clueArr={easy:[36,38,40,42],medium:[28,30,32],hard:[22,24,26],"very hard":[17,19,21]}[diff]||[28];
  const clues=clueArr[seed%clueArr.length];
  let rem=81-clues;
  for(const i of seededShuffle([...Array(81).keys()],seededRng(seed^0xdead))){
    if(!rem)break;puz[0|i/9][i%9]=0;rem--;
  }
  return{puzzle:puz,solution:sol,seed};
}
function randomSeed(){return 0|(Math.random()*0x3fffffff);}

// ─────────────────────────────────────────────
// DYNAMIC THEME
// ─────────────────────────────────────────────
function isDynamicDark(){const h=new Date().getHours();return h>=19||h<7;}
function getDynamicSlot(){
  const h=new Date().getHours();
  if(h>=5&&h<9)  return{label:"Dawn",icon:"🌅",base:"rose"};
  if(h>=9&&h<12) return{label:"Morning",icon:"🌤️",base:"forest"};
  if(h>=12&&h<17)return{label:"Afternoon",icon:"☀️",base:"aurora"};
  if(h>=17&&h<20)return{label:"Evening",icon:"🌇",base:"ember"};
  return{label:"Night",icon:"🌙",base:"midnight"};
}

// ─────────────────────────────────────────────
// THEMES
// ─────────────────────────────────────────────
const THEMES={
  midnight:{name:"Midnight",emoji:"🌑",
    dark:{bg:"#0a0a0f",bgCard:"#0f0f1a",bgIn:"#14141e",bgHov:"#1c1c2e",brd:"#2a2a40",brdM:"#3d3d58",acc:"#3b82f6",pri:"#f0f4ff",sec:"#94a3b8",mut:"#475569",ghost:"#1e293b",ok:"#3b82f6",err:"#f43f5e",giv:"#f1f5f9",usr:"#94a3b8",selBg:"#3b82f648",samBg:"#3b82f630",grpBg:"#1a1a2c",glow:"#3b82f688",grad:"radial-gradient(ellipse at 30% 20%,#0d1520 0%,#080810 60%,#0a0a0f 100%)"},
    light:{bg:"#f0f4ff",bgCard:"#ffffff",bgIn:"#f8faff",bgHov:"#eef2ff",brd:"#93a8f4",brdM:"#7189e8",acc:"#3b5bdb",pri:"#1e1b4b",sec:"#4338ca",mut:"#6366f1",ghost:"#c7d2fe",ok:"#3b5bdb",err:"#dc2626",giv:"#1e1b4b",usr:"#4338ca",selBg:"#3b5bdb48",samBg:"#3b5bdb28",grpBg:"#eef2ff",glow:"#3b5bdb55",grad:"linear-gradient(135deg,#eef2ff 0%,#f0f4ff 100%)"},
  },
  forest:{name:"Forest",emoji:"🌲",
    dark:{bg:"#060d08",bgCard:"#0a1410",bgIn:"#0f1e14",bgHov:"#162518",brd:"#243d2a",brdM:"#2f5238",acc:"#4ade80",pri:"#ecfdf5",sec:"#86efac",mut:"#4ade8099",ghost:"#166534",ok:"#4ade80",err:"#f87171",giv:"#ecfdf5",usr:"#86efac",selBg:"#4ade8048",samBg:"#4ade8030",grpBg:"#132018",glow:"#4ade8077",grad:"radial-gradient(ellipse at 40% 30%,#0a1f10 0%,#060d08 70%)"},
    light:{bg:"#f0fdf4",bgCard:"#ffffff",bgIn:"#f0fdf4",bgHov:"#dcfce7",brd:"#6ee7a0",brdM:"#4ade80",acc:"#16a34a",pri:"#14532d",sec:"#166534",mut:"#4ade8099",ghost:"#bbf7d0",ok:"#16a34a",err:"#dc2626",giv:"#14532d",usr:"#166534",selBg:"#16a34a48",samBg:"#16a34a28",grpBg:"#dcfce7",glow:"#16a34a55",grad:"linear-gradient(135deg,#dcfce7 0%,#f0fdf4 100%)"},
  },
  ember:{name:"Ember",emoji:"🔥",
    dark:{bg:"#0d0804",bgCard:"#180e06",bgIn:"#1e1209",bgHov:"#271810",brd:"#3d2410",brdM:"#522e14",acc:"#f97316",pri:"#fff7ed",sec:"#fdba74",mut:"#f9731699",ghost:"#7c2d12",ok:"#f97316",err:"#f43f5e",giv:"#fff7ed",usr:"#fdba74",selBg:"#f9731648",samBg:"#f9731630",grpBg:"#221508",glow:"#f9731677",grad:"radial-gradient(ellipse at 50% 0%,#1a0e04 0%,#0d0804 70%)"},
    light:{bg:"#fff7ed",bgCard:"#ffffff",bgIn:"#fff7ed",bgHov:"#ffedd5",brd:"#fb923c",brdM:"#ea580c",acc:"#ea580c",pri:"#431407",sec:"#9a3412",mut:"#f9731699",ghost:"#fed7aa",ok:"#ea580c",err:"#dc2626",giv:"#431407",usr:"#9a3412",selBg:"#ea580c48",samBg:"#ea580c28",grpBg:"#ffedd5",glow:"#ea580c55",grad:"linear-gradient(135deg,#ffedd5 0%,#fff7ed 100%)"},
  },
  rose:{name:"Rose",emoji:"🌸",
    dark:{bg:"#0d0509",bgCard:"#180a12",bgIn:"#1e0d16",bgHov:"#27101d",brd:"#3d1428",brdM:"#521c36",acc:"#f43f5e",pri:"#fff1f2",sec:"#fda4af",mut:"#f43f5e99",ghost:"#881337",ok:"#f43f5e",err:"#fb923c",giv:"#fff1f2",usr:"#fda4af",selBg:"#f43f5e48",samBg:"#f43f5e30",grpBg:"#231018",glow:"#f43f5e77",grad:"radial-gradient(ellipse at 60% 20%,#1a0510 0%,#0d0509 70%)"},
    light:{bg:"#fff1f2",bgCard:"#ffffff",bgIn:"#fff1f2",bgHov:"#ffe4e6",brd:"#fb7185",brdM:"#f43f5e",acc:"#e11d48",pri:"#4c0519",sec:"#9f1239",mut:"#f43f5e99",ghost:"#fecdd3",ok:"#e11d48",err:"#ea580c",giv:"#4c0519",usr:"#9f1239",selBg:"#e11d4848",samBg:"#e11d4828",grpBg:"#ffe4e6",glow:"#e11d4855",grad:"linear-gradient(135deg,#ffe4e6 0%,#fff1f2 100%)"},
  },
  aurora:{name:"Aurora",emoji:"🌌",
    dark:{bg:"#050810",bgCard:"#090e1a",bgIn:"#0d1525",bgHov:"#121d30",brd:"#1e2d48",brdM:"#263c62",acc:"#22d3ee",pri:"#ecfeff",sec:"#67e8f9",mut:"#22d3ee99",ghost:"#164e63",ok:"#22d3ee",err:"#f43f5e",giv:"#ecfeff",usr:"#67e8f9",selBg:"#22d3ee48",samBg:"#22d3ee30",grpBg:"#111a2e",glow:"#22d3ee77",grad:"radial-gradient(ellipse at 30% 10%,#071828 0%,#050810 70%)"},
    light:{bg:"#ecfeff",bgCard:"#ffffff",bgIn:"#ecfeff",bgHov:"#cffafe",brd:"#22d3ee",brdM:"#0891b2",acc:"#0891b2",pri:"#083344",sec:"#0e7490",mut:"#22d3ee99",ghost:"#a5f3fc",ok:"#0891b2",err:"#dc2626",giv:"#083344",usr:"#0e7490",selBg:"#0891b248",samBg:"#0891b228",grpBg:"#cffafe",glow:"#0891b255",grad:"linear-gradient(135deg,#cffafe 0%,#ecfeff 100%)"},
  },
  slate:{name:"Slate",emoji:"🪨",
    dark:{bg:"#080b10",bgCard:"#0e1218",bgIn:"#131820",bgHov:"#1a2030",brd:"#28303f",brdM:"#374556",acc:"#94a3b8",pri:"#f1f5f9",sec:"#cbd5e1",mut:"#64748b",ghost:"#1e2533",ok:"#94a3b8",err:"#f87171",giv:"#f1f5f9",usr:"#cbd5e1",selBg:"#94a3b848",samBg:"#94a3b830",grpBg:"#181e2c",glow:"#94a3b877",grad:"radial-gradient(ellipse at 50% 10%,#0e1522 0%,#080b10 70%)"},
    light:{bg:"#f8fafc",bgCard:"#ffffff",bgIn:"#f8fafc",bgHov:"#f1f5f9",brd:"#94a3b8",brdM:"#64748b",acc:"#475569",pri:"#0f172a",sec:"#1e293b",mut:"#64748b",ghost:"#e2e8f0",ok:"#475569",err:"#dc2626",giv:"#0f172a",usr:"#334155",selBg:"#47556948",samBg:"#47556928",grpBg:"#f1f5f9",glow:"#47556955",grad:"linear-gradient(135deg,#f1f5f9 0%,#f8fafc 100%)"},
  },
  ocean:{name:"Ocean",emoji:"🌊",
    dark:{bg:"#020b14",bgCard:"#061522",bgIn:"#0a1e2e",bgHov:"#0f2a3f",brd:"#1a4060",brdM:"#1e5478",acc:"#06b6d4",pri:"#e0f7fa",sec:"#67e8f9",mut:"#06b6d499",ghost:"#0c4a6e",ok:"#06b6d4",err:"#f43f5e",giv:"#e0f7fa",usr:"#67e8f9",selBg:"#06b6d448",samBg:"#06b6d430",grpBg:"#061a28",glow:"#06b6d477",grad:"radial-gradient(ellipse at 30% 60%,#041828 0%,#020b14 70%)"},
    light:{bg:"#e0f7fa",bgCard:"#ffffff",bgIn:"#e0f7fa",bgHov:"#b2ebf2",brd:"#06b6d4",brdM:"#0891b2",acc:"#0e7490",pri:"#042f3e",sec:"#0c5e74",mut:"#06b6d499",ghost:"#a5f3fc",ok:"#0e7490",err:"#dc2626",giv:"#042f3e",usr:"#0c5e74",selBg:"#0e749048",samBg:"#0e749028",grpBg:"#b2ebf2",glow:"#0e749055",grad:"linear-gradient(135deg,#b2ebf2 0%,#e0f7fa 100%)"},
  },
  sakura:{name:"Sakura",emoji:"🌸",
    dark:{bg:"#0f080c",bgCard:"#1a0f15",bgIn:"#221318",bgHov:"#2c1820",brd:"#4a2030",brdM:"#6b2d42",acc:"#f472b6",pri:"#fdf2f8",sec:"#f9a8d4",mut:"#f472b699",ghost:"#831843",ok:"#f472b6",err:"#fb923c",giv:"#fdf2f8",usr:"#f9a8d4",selBg:"#f472b648",samBg:"#f472b630",grpBg:"#1f0f18",glow:"#f472b677",grad:"radial-gradient(ellipse at 50% 20%,#1e0814 0%,#0f080c 70%)"},
    light:{bg:"#fdf2f8",bgCard:"#ffffff",bgIn:"#fdf2f8",bgHov:"#fce7f3",brd:"#f9a8d4",brdM:"#f472b6",acc:"#db2777",pri:"#500724",sec:"#9d174d",mut:"#f472b699",ghost:"#fbcfe8",ok:"#db2777",err:"#ea580c",giv:"#500724",usr:"#9d174d",selBg:"#db277748",samBg:"#db277728",grpBg:"#fce7f3",glow:"#db277755",grad:"linear-gradient(135deg,#fce7f3 0%,#fdf2f8 100%)"},
  },
  nebula:{name:"Nebula",emoji:"🔮",
    dark:{bg:"#06030f",bgCard:"#0e0720",bgIn:"#130a2a",bgHov:"#190e35",brd:"#2d1a5e",brdM:"#3d2480",acc:"#a855f7",pri:"#faf5ff",sec:"#d8b4fe",mut:"#a855f799",ghost:"#4c1d95",ok:"#a855f7",err:"#f43f5e",giv:"#faf5ff",usr:"#d8b4fe",selBg:"#a855f748",samBg:"#a855f730",grpBg:"#0f0820",glow:"#a855f777",grad:"radial-gradient(ellipse at 40% 20%,#120535 0%,#06030f 70%)"},
    light:{bg:"#faf5ff",bgCard:"#ffffff",bgIn:"#faf5ff",bgHov:"#f3e8ff",brd:"#d8b4fe",brdM:"#a855f7",acc:"#7c3aed",pri:"#2e1065",sec:"#5b21b6",mut:"#a855f799",ghost:"#e9d5ff",ok:"#7c3aed",err:"#dc2626",giv:"#2e1065",usr:"#5b21b6",selBg:"#7c3aed48",samBg:"#7c3aed28",grpBg:"#f3e8ff",glow:"#7c3aed55",grad:"linear-gradient(135deg,#f3e8ff 0%,#faf5ff 100%)"},
  },
  desert:{name:"Desert",emoji:"🏜️",
    dark:{bg:"#100c04",bgCard:"#1c1508",bgIn:"#251c0c",bgHov:"#302410",brd:"#5c3d10",brdM:"#7a5218",acc:"#d97706",pri:"#fffbeb",sec:"#fcd34d",mut:"#d9770699",ghost:"#78350f",ok:"#d97706",err:"#f43f5e",giv:"#fffbeb",usr:"#fcd34d",selBg:"#d9770648",samBg:"#d9770630",grpBg:"#1e1508",glow:"#d9770677",grad:"radial-gradient(ellipse at 50% 80%,#1e1004 0%,#100c04 70%)"},
    light:{bg:"#fffbeb",bgCard:"#ffffff",bgIn:"#fffbeb",bgHov:"#fef3c7",brd:"#fcd34d",brdM:"#f59e0b",acc:"#b45309",pri:"#451a03",sec:"#92400e",mut:"#d9770699",ghost:"#fde68a",ok:"#b45309",err:"#dc2626",giv:"#451a03",usr:"#92400e",selBg:"#b4530948",samBg:"#b4530928",grpBg:"#fef3c7",glow:"#b4530955",grad:"linear-gradient(135deg,#fef3c7 0%,#fffbeb 100%)"},
  },
  carbon:{name:"Carbon",emoji:"🖤",
    dark:{bg:"#080808",bgCard:"#111111",bgIn:"#161616",bgHov:"#1e1e1e",brd:"#2a2a2a",brdM:"#3a3a3a",acc:"#e5e5e5",pri:"#f5f5f5",sec:"#a3a3a3",mut:"#525252",ghost:"#1a1a1a",ok:"#86efac",err:"#f87171",giv:"#f5f5f5",usr:"#a3a3a3",selBg:"#e5e5e548",samBg:"#e5e5e530",grpBg:"#1c1c1c",glow:"#e5e5e544",grad:"radial-gradient(ellipse at 50% 0%,#141414 0%,#080808 100%)"},
    light:{bg:"#f5f5f5",bgCard:"#ffffff",bgIn:"#f5f5f5",bgHov:"#e5e5e5",brd:"#d4d4d4",brdM:"#a3a3a3",acc:"#171717",pri:"#0a0a0a",sec:"#262626",mut:"#737373",ghost:"#d4d4d4",ok:"#16a34a",err:"#dc2626",giv:"#0a0a0a",usr:"#262626",selBg:"#17171748",samBg:"#17171728",grpBg:"#e5e5e5",glow:"#17171755",grad:"linear-gradient(135deg,#e5e5e5 0%,#f5f5f5 100%)"},
  },
  citrus:{name:"Citrus",emoji:"🍊",
    dark:{bg:"#0c0900",bgCard:"#171200",bgIn:"#1e1800",bgHov:"#261f00",brd:"#4a3800",brdM:"#654d00",acc:"#eab308",pri:"#fefce8",sec:"#fde047",mut:"#eab30899",ghost:"#713f12",ok:"#eab308",err:"#f43f5e",giv:"#fefce8",usr:"#fde047",selBg:"#eab30848",samBg:"#eab30830",grpBg:"#1a1500",glow:"#eab30877",grad:"radial-gradient(ellipse at 60% 10%,#1a1200 0%,#0c0900 70%)"},
    light:{bg:"#fefce8",bgCard:"#ffffff",bgIn:"#fefce8",bgHov:"#fef9c3",brd:"#fde047",brdM:"#eab308",acc:"#a16207",pri:"#422006",sec:"#854d0e",mut:"#eab30899",ghost:"#fef08a",ok:"#a16207",err:"#dc2626",giv:"#422006",usr:"#854d0e",selBg:"#a1620748",samBg:"#a1620728",grpBg:"#fef9c3",glow:"#a1620755",grad:"linear-gradient(135deg,#fef9c3 0%,#fefce8 100%)"},
  },
  arctic:{name:"Arctic",emoji:"❄️",
    dark:{bg:"#020c14",bgCard:"#041828",bgIn:"#062030",bgHov:"#082a3e",brd:"#0e4060",brdM:"#125478",acc:"#7dd3fc",pri:"#f0f9ff",sec:"#bae6fd",mut:"#7dd3fc99",ghost:"#075985",ok:"#7dd3fc",err:"#f43f5e",giv:"#f0f9ff",usr:"#bae6fd",selBg:"#7dd3fc48",samBg:"#7dd3fc30",grpBg:"#041c2e",glow:"#7dd3fc77",grad:"radial-gradient(ellipse at 50% 0%,#061e30 0%,#020c14 70%)"},
    light:{bg:"#f0f9ff",bgCard:"#ffffff",bgIn:"#f0f9ff",bgHov:"#e0f2fe",brd:"#bae6fd",brdM:"#7dd3fc",acc:"#0369a1",pri:"#082f49",sec:"#075985",mut:"#7dd3fc99",ghost:"#e0f2fe",ok:"#0369a1",err:"#dc2626",giv:"#082f49",usr:"#075985",selBg:"#0369a148",samBg:"#0369a128",grpBg:"#e0f2fe",glow:"#0369a155",grad:"linear-gradient(135deg,#e0f2fe 0%,#f0f9ff 100%)"},
  },
  merlot:{name:"Merlot",emoji:"🍷",
    dark:{bg:"#0a0206",bgCard:"#12040c",bgIn:"#180612",bgHov:"#200818",brd:"#4a0e28",brdM:"#6b1438",acc:"#e11d48",pri:"#fff1f5",sec:"#fda4b8",mut:"#e11d4899",ghost:"#881337",ok:"#e11d48",err:"#fb923c",giv:"#fff1f5",usr:"#fda4b8",selBg:"#e11d4848",samBg:"#e11d4830",grpBg:"#160410",glow:"#e11d4877",grad:"radial-gradient(ellipse at 40% 30%,#1a0410 0%,#0a0206 70%)"},
    light:{bg:"#fff1f5",bgCard:"#ffffff",bgIn:"#fff1f5",bgHov:"#ffe4ec",brd:"#fda4b8",brdM:"#e11d48",acc:"#9f1239",pri:"#4c0519",sec:"#881337",mut:"#e11d4899",ghost:"#fecdd3",ok:"#9f1239",err:"#ea580c",giv:"#4c0519",usr:"#881337",selBg:"#9f123948",samBg:"#9f123928",grpBg:"#ffe4ec",glow:"#9f123955",grad:"linear-gradient(135deg,#ffe4ec 0%,#fff1f5 100%)"},
  },
};
const FREE_THEMES=["midnight","slate"];
const PREMIUM_THEMES=["forest","ember","rose","aurora","ocean","sakura","nebula","desert","carbon","citrus","arctic","merlot"];
const THEME_PRICE=0.59;
const BUNDLE_THEME_PRICE=4.99;
const NO_ADS_PRICE=3.99;
const FULL_BUNDLE_PRICE=7.99;

// Purchase storage helpers
function getPurchases(){try{return JSON.parse(localStorage.getItem("sf_purchases")||"{}");}catch{return{};}}
function savePurchases(p){try{localStorage.setItem("sf_purchases",JSON.stringify(p));}catch{}}
function hasTheme(id){if(FREE_THEMES.includes(id))return true;const p=getPurchases();return p.allThemes||p.noAds===false&&false||p.themes?.includes(id)||false;}
function hasAllThemes(){const p=getPurchases();return p.allThemes||false;}
function hasNoAds(){const p=getPurchases();return p.noAds||false;}
function getOwnedPremiumThemes(){const p=getPurchases();if(p.allThemes)return PREMIUM_THEMES;return(p.themes||[]).filter(id=>PREMIUM_THEMES.includes(id));}
function getSpentOnThemes(){return getOwnedPremiumThemes().length*THEME_PRICE;}
function fullBundlePrice(){return Math.max(0,FULL_BUNDLE_PRICE-getSpentOnThemes()).toFixed(2);}

const ZEN={bg:"#0f110f",bgCard:"#141614",bgIn:"#191c19",bgHov:"#1f231f",brd:"#2e332e",brdM:"#3a403a",acc:"#6b8f71",pri:"#c8d4c8",sec:"#8fa88f",mut:"#4a5e4a",ghost:"#252825",ok:"#6b8f71",err:"#8f6b6b",giv:"#b8ccb8",usr:"#8fa88f",selBg:"#6b8f7145",samBg:"#6b8f712e",grpBg:"#1d221d",glow:"#6b8f7160",grad:"radial-gradient(ellipse at 50% 30%,#141814 0%,#0f110f 100%)"};
const DIFFS=["easy","medium","hard","very hard"];
const DCOL={easy:"#4ade80",medium:"#facc15",hard:"#f97316","very hard":"#f43f5e"};
const DLBL={easy:"Easy",medium:"Medium",hard:"Hard","very hard":"Very Hard"};
const MONO="'DM Mono','Fira Mono','Courier New',monospace";
const SERIF="Georgia,serif";
const NUM="'Nunito','Quicksand','Varela Round',system-ui,sans-serif";
const NUM_FONTS={
  rounded:"'Nunito','Quicksand','Varela Round',system-ui,sans-serif",
  sharp:"'DM Mono','Fira Mono','Courier New',monospace",
  classic:"Georgia,'Times New Roman',serif",
  modern:"'SF Pro Display','Helvetica Neue','Arial',system-ui,sans-serif",
  playful:"'Trebuchet MS','Comic Sans MS',cursive,sans-serif",
};
const fmt=s=>`${String(0|s/60).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

// ─────────────────────────────────────────────
// PRIMITIVE COMPONENTS
// ─────────────────────────────────────────────
function Btn({onTap,style,children,disabled,...rest}){
  return(
    <button disabled={disabled}
      onTouchEnd={e=>{e.preventDefault();if(!disabled)onTap();}}
      onClick={()=>{if(!disabled)onTap();}}
      style={{WebkitTapHighlightColor:"transparent",cursor:disabled?"default":"pointer",border:"none",outline:"none",...style}}
      {...rest}
    >{children}</button>
  );
}

// ─────────────────────────────────────────────
// SPLASH
// ─────────────────────────────────────────────
function Splash({t,onDone}){
  const [ph,setPh]=useState(0);
  useEffect(()=>{
    const t1=setTimeout(()=>setPh(1),100);
    const t2=setTimeout(()=>setPh(2),1800);
    const t3=setTimeout(onDone,2400);
    return()=>{clearTimeout(t1);clearTimeout(t2);clearTimeout(t3);};
  },[]);
  return(
    <div style={{position:"fixed",inset:0,zIndex:9999,background:t.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:4,opacity:ph===2?0:1,transition:ph===2?"opacity .5s":"none"}}>
      <div style={{fontSize:"clamp(13px,3vw,18px)",letterSpacing:"0.5em",color:t.acc,fontFamily:SERIF,opacity:ph>=1?1:0,transition:"opacity .6s .1s"}}
      >SUDOKU</div>
      <div style={{fontSize:"clamp(52px,15vw,86px)",fontWeight:700,fontFamily:SERIF,color:t.pri,letterSpacing:"0.04em",lineHeight:0.9,opacity:ph>=1?1:0,transition:"opacity .6s .2s"}}>FLOW</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ONBOARDING
// ─────────────────────────────────────────────
const OB_STEPS=[
  {icon:"🎯",title:"Welcome to Sudoku Flow",body:"Fill the 9×9 grid so every row, column and 3×3 box contains the digits 1–9 exactly once."},
  {icon:"✏️",title:"Notes Mode",body:"Long-press a number to toggle notes mode — jot down candidates without placing them. Quick-tap places the digit."},
  {icon:"💡",title:"Smart Hints",body:"Stuck? Use a hint. On Easy mode hints explain WHY the digit goes there, so you can learn as you play."},
  {icon:"🔥",title:"Daily Streaks",body:"A new puzzle drops every day. Keep your streak alive and unlock achievements the longer you play."},
];
function Onboarding({t,onDone}){
  const [step,setStep]=useState(0);
  const [animKey,setAnimKey]=useState(0);
  const cur=OB_STEPS[step],isLast=step===OB_STEPS.length-1;
  const next=()=>{if(isLast){try{localStorage.setItem(K.ob,"1");}catch{}onDone();}else{setAnimKey(k=>k+1);setStep(s=>s+1);}};
  const skip=()=>{try{localStorage.setItem(K.ob,"1");}catch{}onDone();};
  return(
    <div style={{height:"100dvh",width:"100vw",background:t.grad,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"space-between",padding:"max(env(safe-area-inset-top),24px) 20px max(env(safe-area-inset-bottom),24px)",boxSizing:"border-box",fontFamily:MONO}}>
      <div style={{alignSelf:"flex-end"}}>
        <Btn onTap={skip} style={{background:"transparent",color:t.mut,fontSize:12,letterSpacing:"0.06em",padding:"8px 0"}}>Skip</Btn>
      </div>
      <div key={animKey} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20,textAlign:"center",maxWidth:360,animation:"obIn .4s ease"}}>
        <style>{`@keyframes obIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}`}</style>
        <div style={{fontSize:56}}>{cur.icon}</div>
        <div style={{fontSize:"clamp(18px,5vw,24px)",fontWeight:700,fontFamily:SERIF,color:t.pri}}>{cur.title}</div>
        <div style={{fontSize:"clamp(13px,3.5vw,15px)",color:t.sec,lineHeight:1.6}}>{cur.body}</div>
      </div>
      <div style={{width:"100%",maxWidth:360}}>
        <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:20}}>
          {OB_STEPS.map((_,i)=><div key={i} style={{width:i===step?20:6,height:6,borderRadius:3,background:i===step?t.acc:t.brd,transition:"all .3s"}}/>)}
        </div>
        <Btn onTap={next} style={{width:"100%",padding:"16px",borderRadius:14,background:t.acc,color:"#fff",fontSize:14,fontWeight:700,letterSpacing:"0.06em",fontFamily:MONO}}>
          {isLast?"Let’s Play →":"Next →"}
        </Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// LANDING PAGE
// ─────────────────────────────────────────────
function Landing({t,settings,dynSlot,savedGame,stats,onStart,onDaily,onSelectDiff,onSettings,onStats,onArchive,onMode,onCoaching,onShared,onStore}){
  const [shareInput,setShareInput]=useState("");
  const [shareErr,setShareErr]=useState(false);
  const [vis,setVis]=useState(false);
  const [navTab,setNavTab]=useState("home");
  useEffect(()=>{const id=setTimeout(()=>setVis(true),50);return()=>clearTimeout(id);},[]);
  const tryJoin=()=>{
    const res=decodeShare(shareInput);
    if(!res){setShareErr(true);setTimeout(()=>setShareErr(false),1500);return;}
    onShared(res.diff,res.seed);
  };
  const an=(d)=>({opacity:vis?1:0,transform:vis?"none":"translateY(12px)",transition:`opacity .4s ${d}s,transform .4s ${d}s`});
  const todayWon=stats?.lastDailyWin===todayStr();
  const streak=stats?.dStreak||0;
  const pct=savedGame?Math.round(savedGame.userBoard.flat().filter(v=>v!==0).length/81*100):0;
  const lastPlayed=(()=>{
    if(!savedGame?.timestamp)return null;
    const m=Math.round((Date.now()-savedGame.timestamp)/60000);
    if(m<2)return"just now";if(m<60)return`${m}m ago`;
    const h=Math.round(m/60);if(h<24)return`${h}h ago`;return"earlier";
  })();
  const MODES=[
    {id:"endless",icon:"♾️",color:"#a78bfa",label:"Endless Flow",desc:"Difficulty ramps up. Bank time by solving fast."},
    {id:"focus",icon:"🎯",color:"#f43f5e",label:"Focus Mode",desc:"One mistake ends your run. Zero tolerance."},
    {id:"zen",icon:"🧘",color:"#6b8f71",label:"Zen Mode",desc:"No timer. Muted palette. Pure meditation."},
    {id:"practice",icon:"📚",color:"#38bdf8",label:"Practice",desc:"No pressure. Learn techniques at your own pace."},
  ];
  const todayGoals=getDailyGoals(todayStr());
  const numDone=DAILY_GOALS.filter(g=>todayGoals[g.id]).length;
  return(
    <div style={{position:"fixed",inset:0,background:t.bg,display:"flex",flexDirection:"column",alignItems:"center",paddingBottom:0,boxSizing:"border-box",fontFamily:MONO,overflow:"hidden"}}>

      {/* Ad banner — top of screen, above everything */}
      <div style={{width:"100%",height:"calc(max(env(safe-area-inset-top),10px) + 42px)",background:t.bgCard,borderBottom:`1px solid ${t.brd}`,display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:8,flexShrink:0}}>
        {/* Ad banner slot */}
      </div>

      <div style={{width:"100%",maxWidth:460,flex:1,display:"flex",flexDirection:"column",padding:"0 14px",overflowY:"auto",paddingBottom:70}}>

        {/* Title */}
        <div style={{textAlign:"center",paddingTop:8,paddingBottom:4,...an(0.02)}}>
          <div style={{fontSize:"clamp(10px,2.8vw,13px)",letterSpacing:"0.35em",color:t.acc,fontFamily:SERIF,fontWeight:700}}>{settings.dynamicTheme&&dynSlot?`${dynSlot.icon||"🌓"} ${dynSlot.label||"Auto"}`:"SUDOKU"}</div>
          <div style={{fontSize:"clamp(42px,12vw,68px)",fontWeight:700,fontFamily:SERIF,color:t.pri,letterSpacing:"0.04em",lineHeight:0.92}}>FLOW</div>
        </div>

        {navTab==="home"&&<>
          {/* Daily Hero Card */}
          <div style={{...an(0.06)}} onClick={onDaily}>
            <div style={{background:t.bgCard,border:`2px solid ${t.acc}`,borderRadius:18,padding:"18px 18px 14px",marginBottom:10,position:"relative",overflow:"hidden",cursor:"pointer",boxShadow:`0 0 32px ${t.acc}22`}}>
              <div style={{position:"absolute",top:0,right:0,width:120,height:120,background:`${t.acc}08`,borderRadius:"0 18px 0 100%"}}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div>
                  <div style={{fontSize:"clamp(16px,4.5vw,20px)",fontWeight:800,color:t.pri,fontFamily:MONO,letterSpacing:"0.02em"}}>{todayWon?"✅ Completed!":"Daily Puzzle"}</div>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginTop:5}}>
                    <span style={{fontSize:14}}>🔥</span>
                    <span style={{fontSize:"clamp(11px,3vw,13px)",color:t.acc,fontWeight:700,fontFamily:MONO}}>{streak} day streak</span>
                  </div>
                  <div style={{display:"flex",gap:4,marginTop:6}}>
                    {DAILY_GOALS.map(g=>(
                      <span key={g.id} style={{fontSize:14,opacity:todayGoals[g.id]?1:0.2,filter:todayGoals[g.id]?`drop-shadow(0 0 4px ${t.acc})`:"none"}}>{g.icon}</span>
                    ))}
                  </div>
                </div>
                <div style={{fontSize:36,lineHeight:1}}>🗓️</div>
              </div>
              <div style={{background:`${t.acc}22`,border:`1px solid ${t.acc}44`,borderRadius:10,padding:"9px 14px",textAlign:"center"}}>
                <span style={{fontSize:"clamp(12px,3.2vw,14px)",fontWeight:800,color:t.acc,fontFamily:MONO,letterSpacing:"0.06em"}}>{todayWon?"VIEW RESULT →":"PLAY TODAY’S →"}</span>
              </div>
            </div>
          </div>

          {/* 2x2 Grid */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10,...an(0.1)}}>
            {[
              {onTap:()=>savedGame&&onStart(savedGame.difficulty,true),icon:"▶",label:"Continue",sub:savedGame?`${pct}% · ${lastPlayed||""}`:"No saved game",color:"#a78bfa",disabled:!savedGame},
              {onTap:onSelectDiff,icon:"⊞",label:"Choose",sub:"Pick difficulty",color:"#34d399",disabled:false},
              {onTap:()=>onStart(DIFFS[0|Math.random()*4],false),icon:"🎲",label:"Random",sub:"Instant start",color:t.acc,disabled:false},
              {onTap:()=>setNavTab("modes"),icon:"🎮",label:"Modes",sub:"Zen · Focus · ∞",color:"#f43f5e",disabled:false},
            ].map(({onTap,icon,label,sub,color,disabled})=>(
              <Btn key={label} onTap={disabled?()=>{}:onTap} style={{background:t.bgCard,border:`1.5px solid ${color}44`,borderRadius:14,padding:"16px 12px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:5,opacity:disabled?0.38:1,minHeight:90}}>
                <span style={{fontSize:22}}>{icon}</span>
                <span style={{fontSize:"clamp(12px,3.2vw,14px)",fontWeight:700,color:color,fontFamily:MONO}}>{label}</span>
                <span style={{fontSize:"clamp(9px,2.2vw,10px)",color:t.mut,textAlign:"center",fontFamily:MONO}}>{sub}</span>
              </Btn>
            ))}
          </div>

        </>}

        {navTab==="modes"&&<div style={{display:"flex",flexDirection:"column",gap:8,marginTop:4,...an(0.04)}}>
          <div style={{fontSize:11,color:t.mut,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:2,fontFamily:MONO}}>Game Modes</div>
          {/* Weekly Challenge */}
          {(()=>{
            const wk=weekStr();
            const weeklyWon=get(`${K.weekly}:${wk}`,false);
            const d=new Date();
            const daysLeft=7-d.getDay()||7;
            return(
              <Btn onTap={()=>onMode("weekly")} style={{width:"100%",padding:"16px 14px",borderRadius:14,background:t.bgCard,border:`2px solid ${weeklyWon?"#f59e0b88":"#f59e0b44"}`,display:"flex",alignItems:"center",justifyContent:"space-between",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,right:0,width:80,height:80,background:"#f59e0b08",borderRadius:"0 14px 0 100%"}}/>
                <span style={{display:"flex",alignItems:"center",gap:14}}>
                  <span style={{fontSize:26}}>{weeklyWon?"🏅":"📆"}</span>
                  <span style={{textAlign:"left"}}>
                    <div style={{fontSize:"clamp(13px,3.5vw,15px)",fontWeight:700,color:"#f59e0b",fontFamily:MONO}}>Weekly Challenge</div>
                    <div style={{fontSize:"clamp(10px,2.5vw,11px)",color:t.mut,marginTop:3,lineHeight:1.4}}>{weeklyWon?"Completed this week! 🎉":`Resets in ${daysLeft} day${daysLeft!==1?"s":""} · Hard difficulty`}</div>
                  </span>
                </span>
                <span style={{color:"#f59e0b",fontSize:16}}>›</span>
              </Btn>
            );
          })()}
          {MODES.map(m=>(
            <Btn key={m.id} onTap={()=>onMode(m.id)} style={{width:"100%",padding:"16px 14px",borderRadius:14,background:t.bgCard,border:`1.5px solid ${m.color}44`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{display:"flex",alignItems:"center",gap:14}}>
                <span style={{fontSize:26}}>{m.icon}</span>
                <span style={{textAlign:"left"}}>
                  <div style={{fontSize:"clamp(13px,3.5vw,15px)",fontWeight:700,color:m.color,fontFamily:MONO}}>{m.label}</div>
                  <div style={{fontSize:"clamp(10px,2.5vw,11px)",color:t.mut,marginTop:3,lineHeight:1.4}}>{m.desc}</div>
                </span>
              </span>
              <span style={{color:m.color,fontSize:16}}>›</span>
            </Btn>
          ))}
          <div style={{fontSize:11,color:t.mut,letterSpacing:"0.15em",textTransform:"uppercase",marginTop:6,marginBottom:2,fontFamily:MONO}}>Friend’s Puzzle Code</div>
          <div style={{display:"flex",gap:6,padding:"11px 14px",borderRadius:12,background:t.bgCard,border:`1.5px solid ${shareErr?"#f43f5e":t.brd}`}}>
            <input value={shareInput} onChange={e=>setShareInput(e.target.value.toUpperCase().slice(0,7))}
              placeholder="PASTE CODE (e.g. A3F7K2M)"
              style={{flex:1,background:"transparent",border:"none",outline:"none",color:shareErr?"#f43f5e":t.pri,fontFamily:MONO,fontSize:"clamp(11px,2.8vw,13px)",letterSpacing:"0.1em"}}/>
            <Btn onTap={tryJoin} style={{padding:"5px 12px",borderRadius:8,background:`${t.acc}22`,border:`1.5px solid ${t.acc}`,color:t.acc,fontSize:11,fontWeight:700,fontFamily:MONO}}>Go →</Btn>
          </div>
        </div>}

        {navTab==="more"&&<div style={{display:"flex",flexDirection:"column",gap:8,...an(0.04)}}>
          <div style={{fontSize:11,color:t.mut,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:2,fontFamily:MONO}}>More</div>
          {/* Stats summary inline */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:2}}>
            {[["🔥",`${streak}d streak`],["✅",`${stats?.totalWins||0} solved`],["🏆",`${stats?.bestStreak||0} best`],["⚡",stats?.avgTime?fmt(stats.avgTime):"—"]].map(([ic,val])=>(
              <div key={val} style={{background:t.bgCard,border:`1.5px solid ${t.brd}`,borderRadius:12,padding:"10px 12px",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:18}}>{ic}</span>
                <span style={{fontSize:"clamp(11px,2.8vw,13px)",fontWeight:700,color:t.pri,fontFamily:MONO}}>{val}</span>
              </div>
            ))}
          </div>
          <Btn onTap={onStats} style={{width:"100%",padding:"11px",borderRadius:12,background:t.bgCard,border:`1.5px solid ${t.brd}`,color:t.sec,fontSize:12,fontWeight:700,fontFamily:MONO,textAlign:"center",marginBottom:4}}>Full Stats →</Btn>
          {[
            [onArchive,"📅","Archive","Past daily puzzles & goals"],
            [onCoaching,"💡","Tips & Coaching","Techniques · Smart hints · Practice"],
            [onStore,"🛍️","Shop","Themes · Remove Ads · Bundles"],
            [onSettings,"⚙️","Settings","Theme · Sound · Display"],
          ].map(([fn,ic,lb,sub])=>(
            <Btn key={lb} onTap={fn} style={{width:"100%",padding:"15px 14px",borderRadius:14,background:t.bgCard,border:`1.5px solid ${t.brd}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:22}}>{ic}</span>
                <span>
                  <div style={{fontSize:"clamp(13px,3.2vw,15px)",fontWeight:700,color:t.pri,fontFamily:MONO}}>{lb}</div>
                  <div style={{fontSize:"clamp(9px,2.2vw,11px)",color:t.mut,marginTop:2}}>{sub}</div>
                </span>
              </span>
              <span style={{color:t.mut,fontSize:16}}>›</span>
            </Btn>
          ))}
        </div>}

      </div>

      {/* Bottom Nav */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:t.bg,borderTop:`1px solid ${t.brd}`,paddingBottom:"max(env(safe-area-inset-bottom),8px)",paddingTop:8,display:"flex",justifyContent:"center"}}>
        <div style={{display:"flex",width:"100%",maxWidth:460,padding:"0 14px"}}>
          {[["home","🏠","Home"],["archive","📅","Archive"],["help","❓","Help"],["more","⋯","More"]].map(([id,ic,lb])=>(
            <Btn key={id} onTap={()=>{if(id==="archive"){onArchive();return;}if(id==="help"){onCoaching();return;}setNavTab(id);}} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"4px 0",background:"transparent",border:"none"}}>
              <span style={{fontSize:20}}>{ic}</span>
              <span style={{fontSize:"clamp(9px,2.2vw,10px)",fontWeight:700,fontFamily:MONO,color:navTab===id?t.acc:t.mut}}>{lb}</span>
              {navTab===id&&<div style={{width:16,height:2,borderRadius:1,background:t.acc}}/>}
            </Btn>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// DIFFICULTY SCREEN
// ─────────────────────────────────────────────
function DiffScreen({t,onPick,onBack}){
  const [vis,setVis]=useState(false);
  useEffect(()=>{const id=setTimeout(()=>setVis(true),40);return()=>clearTimeout(id);},[]);
  const descs={easy:"Easier puzzles · Relaxed pace",medium:"Moderate puzzles · Some challenge",hard:"Harder puzzles · Think ahead","very hard":"Expert puzzles · Masters only"};
  return(
    <div style={{height:"100dvh",width:"100vw",background:t.bg,display:"flex",flexDirection:"column",padding:"max(env(safe-area-inset-top),14px) 18px max(env(safe-area-inset-bottom),20px)",boxSizing:"border-box",fontFamily:MONO,color:t.pri}}>
      <Btn onTap={onBack} style={{background:t.bgHov,color:t.sec,fontSize:13,fontWeight:600,padding:"6px 12px",borderRadius:8,border:`1px solid ${t.brdM}`,marginBottom:14,alignSelf:"flex-start",letterSpacing:"0.01em",display:"flex",alignItems:"center",gap:4}}>‹ Back</Btn>
      <div style={{fontSize:10,letterSpacing:"0.4em",color:t.mut,marginBottom:4,opacity:vis?1:0,transition:"opacity .4s"}}>SELECT</div>
      <div style={{fontSize:"clamp(20px,5.5vw,28px)",fontWeight:700,fontFamily:SERIF,marginBottom:20,opacity:vis?1:0,transition:"opacity .4s .05s"}}>Difficulty</div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {DIFFS.map((d,i)=>(
          <Btn key={d} onTap={()=>onPick(d)} style={{padding:"18px 16px",borderRadius:14,background:t.bgCard,border:`2px solid ${DCOL[d]}44`,display:"flex",alignItems:"center",gap:14,opacity:vis?1:0,transform:vis?"none":`translateY(${12+i*4}px)`,transition:`opacity .4s ${i*.06}s,transform .4s ${i*.06}s`}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:DCOL[d],boxShadow:`0 0 10px ${DCOL[d]}`}}/>
            <div style={{textAlign:"left"}}>
              <div style={{fontSize:"clamp(13px,3.5vw,15px)",fontWeight:700,color:DCOL[d],fontFamily:MONO,letterSpacing:"0.05em"}}>{DLBL[d]}</div>
              <div style={{fontSize:10,color:t.mut,marginTop:3}}>{descs[d]}</div>
            </div>
          </Btn>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODE INTRO
// ─────────────────────────────────────────────
const MODE_INFO={
  endless:{icon:"♾️",color:"#a78bfa",title:"Endless Flow",rules:["Puzzles get harder each level","Solve fast to earn bonus time","Time runs out = game over","No mistake limit","Track your best level"]},
  focus:{icon:"🎯",color:"#f43f5e",title:"Focus Mode",rules:["ONE mistake ends your run","Choose your starting difficulty","No time pressure","Tests pure accuracy","Separate win tracking"]},
  zen:{icon:"🧘",color:"#6b8f71",title:"Zen Mode",rules:["No timer displayed","Muted, calming palette","Gentle sound effects","Unlimited hints","Pure puzzle enjoyment"]},
};
function ModeIntro({t,mode,onBack,onStart}){
  const [diff,setDiff]=useState("easy");
  const [vis,setVis]=useState(false);
  useEffect(()=>{const id=setTimeout(()=>setVis(true),40);return()=>clearTimeout(id);},[]);
  const info=MODE_INFO[mode]||MODE_INFO.endless;
  return(
    <div style={{height:"100dvh",width:"100vw",background:t.bg,display:"flex",flexDirection:"column",padding:"max(env(safe-area-inset-top),14px) 18px max(env(safe-area-inset-bottom),20px)",boxSizing:"border-box",fontFamily:MONO,color:t.pri}}>
      <Btn onTap={onBack} style={{background:t.bgHov,color:t.sec,fontSize:13,fontWeight:600,padding:"6px 12px",borderRadius:8,border:`1px solid ${t.brdM}`,marginBottom:14,alignSelf:"flex-start",letterSpacing:"0.01em",display:"flex",alignItems:"center",gap:4}}>‹ Back</Btn>
      <div style={{textAlign:"center",marginBottom:20,opacity:vis?1:0,transition:"opacity .4s"}}>
        <div style={{fontSize:48,marginBottom:8}}>{info.icon}</div>
        <div style={{fontSize:"clamp(20px,5.5vw,26px)",fontWeight:700,fontFamily:SERIF,color:info.color}}>{info.title}</div>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
        {info.rules.map((r,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${t.brd}`,opacity:vis?1:0,transform:vis?"none":`translateY(${8+i*3}px)`,transition:`all .35s ${.05+i*.06}s`}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:info.color,flexShrink:0}}/>
            <div style={{fontSize:"clamp(12px,3.2vw,13px)",color:t.sec}}>{r}</div>
          </div>
        ))}
      </div>
      {mode==="focus"&&(
        <div style={{marginBottom:12}}>
          <div style={{fontSize:9,color:t.mut,letterSpacing:"0.08em",marginBottom:8}}>DIFFICULTY</div>
          <div style={{display:"flex",gap:6}}>
            {DIFFS.map(d=>(
              <Btn key={d} onTap={()=>setDiff(d)} style={{flex:1,padding:"9px 4px",borderRadius:10,border:`1.5px solid ${diff===d?DCOL[d]:t.brd}`,background:diff===d?`${DCOL[d]}22`:"transparent",color:diff===d?DCOL[d]:t.mut,fontSize:9,fontWeight:700,fontFamily:MONO}}>{DLBL[d]}</Btn>
            ))}
          </div>
        </div>
      )}
      <Btn onTap={()=>onStart(diff)} style={{width:"100%",padding:"15px",borderRadius:14,background:info.color,color:"#fff",fontSize:14,fontWeight:700,fontFamily:MONO,letterSpacing:"0.06em"}}>
        Start {info.title} →
      </Btn>
    </div>
  );
}

// ─────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────
function Toggle({val,onToggle}){
  return(
    <div onTouchEnd={e=>{e.preventDefault();onToggle();}} onClick={onToggle}
      style={{width:42,height:24,borderRadius:12,background:val?"#3b82f6":"#334155",position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0}}>
      <div style={{position:"absolute",top:3,left:val?19:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .2s"}}/>
    </div>
  );
}
function Settings({t,settings,dynSlot,onChange,onBack}){
  const [vis,setVis]=useState(false);
  useEffect(()=>{const id=setTimeout(()=>setVis(true),40);return()=>clearTimeout(id);},[]);
  const an=(i)=>({opacity:vis?1:0,transform:vis?"none":"translateY(8px)",transition:`opacity .35s ${i*.06}s,transform .35s ${i*.06}s`});
  const Row=({label,sub,ctrl})=>(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${t.brd}`,gap:12}}>
      <div><div style={{fontSize:"clamp(12px,3.2vw,13px)",color:t.pri,fontWeight:600}}>{label}</div>{sub&&<div style={{fontSize:9,color:t.mut,marginTop:2}}>{sub}</div>}</div>
      {ctrl}
    </div>
  );
  const Sec=({children})=><div style={{fontSize:8,letterSpacing:"0.35em",color:t.acc,textTransform:"uppercase",marginTop:16,marginBottom:4}}>{children}</div>;
  return(
    <div style={{height:"100dvh",width:"100vw",background:t.bg,display:"flex",flexDirection:"column",padding:"max(env(safe-area-inset-top),14px) 18px max(env(safe-area-inset-bottom),20px)",boxSizing:"border-box",fontFamily:MONO,color:t.pri,overflow:"hidden"}}>
      <Btn onTap={onBack} style={{background:t.bgHov,color:t.sec,fontSize:13,fontWeight:600,padding:"6px 12px",borderRadius:8,border:`1px solid ${t.brdM}`,marginBottom:10,alignSelf:"flex-start",letterSpacing:"0.01em",display:"flex",alignItems:"center",gap:4}}>‹ Back</Btn>
      <div style={{fontSize:"clamp(20px,5.5vw,26px)",fontWeight:700,fontFamily:SERIF,marginBottom:4,...an(0)}}>Settings</div>
      <div style={{flex:1,overflowY:"auto",paddingBottom:8}}>
        <div style={an(1)}>
          <Sec>Theme</Sec>
          {/* Dynamic Theme Toggle */}
          <div style={{background:settings.dynamicTheme?`${t.acc}10`:t.bgCard,border:`1.5px solid ${settings.dynamicTheme?t.acc:t.brd}`,borderRadius:12,padding:"11px 13px",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:settings.dynamicTheme?8:0}}>
              <div>
                <div style={{fontSize:"clamp(12px,3.2vw,13px)",color:t.pri,fontWeight:700}}>🌓 Dynamic Theme</div>
                <div style={{fontSize:9,color:t.mut,marginTop:2}}>Theme &amp; dark/light mode change automatically by time of day</div>
              </div>
              <Toggle val={settings.dynamicTheme} onToggle={()=>onChange("dynamicTheme",!settings.dynamicTheme)}/>
            </div>
            {settings.dynamicTheme&&(
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4}}>
                {[{h:"5–9",icon:"🌅",label:"Dawn",base:"rose",dark:false},{h:"9–12",icon:"🌤️",label:"Morning",base:"forest",dark:false},{h:"12–17",icon:"☀️",label:"Afternoon",base:"aurora",dark:false},{h:"17–20",icon:"🌇",label:"Evening",base:"ember",dark:true},{h:"20–5",icon:"🌙",label:"Night",base:"midnight",dark:true}].map(s=>{
                  const th=THEMES[s.base]||THEMES.midnight;
                  const pal=s.dark?th.dark:th.light;
                  const isCurrent=dynSlot?.base===s.base;
                  return(
                    <div key={s.base} style={{background:pal.bg,border:`1.5px solid ${isCurrent?pal.acc:pal.brd}`,borderRadius:8,padding:"6px 4px",textAlign:"center",boxShadow:isCurrent?`0 0 10px ${pal.acc}55`:"none"}}>
                      <div style={{fontSize:14}}>{s.icon}</div>
                      <div style={{fontSize:7,color:pal.acc,fontWeight:700,letterSpacing:"0.03em"}}>{s.label}</div>
                      <div style={{fontSize:6,color:pal.mut,marginTop:1}}>{s.dark?"dark":"light"}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {/* Theme picker + Dark Mode — hidden when dynamic theme controls it */}
          {!settings.dynamicTheme&&<>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:4}}>
              {Object.entries(THEMES).map(([key,th])=>{
                const pal=settings.dark?th.dark:th.light,active=settings.theme===key;
                const isPremium=PREMIUM_THEMES.includes(key);
                const isUnlocked=hasTheme(key);
                return(
                  <Btn key={key} onTap={()=>{if(!isUnlocked){onChange("_openStore",true);return;}onChange("theme",key);}} style={{borderRadius:12,overflow:"hidden",border:`2px solid ${active?pal.acc:t.brd}`,background:pal.bg,padding:0,boxShadow:active?`0 0 14px ${pal.acc}44`:"none",display:"flex",flexDirection:"column",opacity:isPremium&&!isUnlocked?0.6:1}}>
                    <div style={{padding:"8px 6px 4px",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:2,width:36}}>
                        {[...Array(9)].map((_,i)=><div key={i} style={{width:10,height:10,borderRadius:2,background:i===4?pal.acc:i%2===0?pal.bgIn:pal.bgHov,border:i===4?"none":`1px solid ${pal.brd}55`}}/>)}
                      </div>
                    </div>
                    <div style={{padding:"0 5px 7px",textAlign:"center"}}>
                      <div style={{fontSize:12,marginBottom:1}}>{isPremium&&!isUnlocked?"🔒":th.emoji}</div>
                      <div style={{fontSize:7,fontWeight:700,color:active?pal.acc:pal.mut,letterSpacing:"0.04em",textTransform:"uppercase"}}>{th.name}</div>
                    </div>
                  </Btn>
                );
              })}
            </div>
            <Row label="Dark Mode" ctrl={<Toggle val={settings.dark} onToggle={()=>onChange("dark",!settings.dark)}/>}/>
          </>}
        </div>
        <div style={an(2)}>
          <Sec>Gameplay</Sec>
          {/* Prominent mistake mode picker */}
          <div style={{background:t.bgCard,border:`1.5px solid ${settings.highlightMistakes?`#f43f5e88`:t.brd}`,borderRadius:12,padding:"12px 14px",marginBottom:8}}>
            <div style={{fontSize:"clamp(12px,3.2vw,13px)",color:t.pri,fontWeight:700,marginBottom:4}}>Mistake Feedback</div>
            <div style={{fontSize:9,color:t.mut,marginBottom:10,lineHeight:1.5}}>When off, wrong numbers still count as mistakes but aren’t highlighted — find errors yourself.</div>
            <div style={{display:"flex",gap:6}}>
              <Btn onTap={()=>onChange("highlightMistakes",true)} style={{flex:1,padding:"9px 4px",borderRadius:10,border:`1.5px solid ${settings.highlightMistakes?"#f43f5e":t.brd}`,background:settings.highlightMistakes?"#f43f5e20":"transparent",color:settings.highlightMistakes?"#f43f5e":t.mut,fontFamily:MONO,fontSize:"clamp(9px,2.2vw,10px)",fontWeight:700}}>⚡ Show Instantly</Btn>
              <Btn onTap={()=>onChange("highlightMistakes",false)} style={{flex:1,padding:"9px 4px",borderRadius:10,border:`1.5px solid ${!settings.highlightMistakes?t.acc:t.brd}`,background:!settings.highlightMistakes?`${t.acc}20`:"transparent",color:!settings.highlightMistakes?t.acc:t.mut,fontFamily:MONO,fontSize:"clamp(9px,2.2vw,10px)",fontWeight:700}}>🔍 Find Myself</Btn>
            </div>
          </div>
          <Row label="Auto-Remove Notes" sub="Clear pencil marks when filling" ctrl={<Toggle val={settings.autoNotes} onToggle={()=>onChange("autoNotes",!settings.autoNotes)}/>}/>
          <Row label="Highlight Same Numbers" ctrl={<Toggle val={settings.highlightSame} onToggle={()=>onChange("highlightSame",!settings.highlightSame)}/>}/>
        </div>
        <div style={an(3)}>
          <Sec>Sound &amp; Feel</Sec>
          <Row label="Sound Effects" ctrl={<Toggle val={settings.soundOn} onToggle={()=>onChange("soundOn",!settings.soundOn)}/>}/>
          <Row label="Haptic Feedback" ctrl={<Toggle val={settings.hapticsOn} onToggle={()=>onChange("hapticsOn",!settings.hapticsOn)}/>}/>
          <Row label="Allow Background Audio" sub="Let Spotify/podcasts keep playing" ctrl={<Toggle val={settings.allowBgAudio} onToggle={()=>onChange("allowBgAudio",!settings.allowBgAudio)}/>}/>
          <Row label="Do Not Disturb" sub="Suppress all notifications while playing" ctrl={<Toggle val={settings.doNotDisturb} onToggle={()=>onChange("doNotDisturb",!settings.doNotDisturb)}/>}/>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${t.brd}`,gap:12}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{fontSize:"clamp(12px,3.2vw,13px)",color:t.pri,fontWeight:600}}>Daily Reminders</div>
                {(()=>{try{return localStorage.getItem("sf_notif_asked")&&Notification.permission==="granted"?<div style={{width:8,height:8,borderRadius:"50%",background:"#4ade80"}}/>:Notification.permission==="denied"?<div style={{width:8,height:8,borderRadius:"50%",background:t.err}}/>:<div style={{width:8,height:8,borderRadius:"50%",background:"#f59e0b"}}/>;}catch{return null;}})()}
              </div>
              <div style={{fontSize:9,color:t.mut,marginTop:2}}>{(()=>{try{const p=Notification.permission;return p==="granted"?"Enabled — you’ll get daily puzzle reminders":p==="denied"?"Blocked — enable in phone Settings":"Tap to request permission";}catch{return"Not supported on this device";}})()}</div>
            </div>
            <Btn onTap={async()=>{try{await Notification.requestPermission();}catch{}}} style={{padding:"6px 12px",borderRadius:8,background:`${t.acc}18`,border:`1px solid ${t.acc}`,color:t.acc,fontSize:10,fontWeight:700,fontFamily:MONO}}>
              {(()=>{try{return Notification.permission==="granted"?"✓ On":"Enable";}catch{return"Enable";}})()}
            </Btn>
          </div>
        </div>
        <div style={an(4)}>
          <Sec>Timer</Sec>
          <div style={{padding:"12px 0",borderBottom:`1px solid ${t.brd}`}}>
            <div style={{fontSize:"clamp(12px,3.2vw,13px)",color:t.pri,fontWeight:600,marginBottom:8}}>Timer Display</div>
            <div style={{display:"flex",gap:6}}>
              {[["up","⬆ Count Up"],["down","⬇ Countdown"],["hidden","⊘ Hidden"]].map(([v,lbl])=>(
                <Btn key={v} onTap={()=>onChange("timerMode",v)}
                  style={{flex:1,padding:"9px 4px",borderRadius:10,border:`1.5px solid ${settings.timerMode===v?t.acc:t.brd}`,background:settings.timerMode===v?`${t.acc}20`:"transparent",color:settings.timerMode===v?t.acc:t.mut,fontFamily:MONO,fontSize:"clamp(9px,2.2vw,10px)",fontWeight:700,textAlign:"center"}}>
                  {lbl}
                </Btn>
              ))}
            </div>
          </div>
          {settings.timerMode==="down"&&(
            <div style={{padding:"12px 0",borderBottom:`1px solid ${t.brd}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontSize:"clamp(12px,3.2vw,13px)",color:t.pri,fontWeight:600}}>Countdown From</div>
                <div style={{fontSize:13,fontWeight:700,color:t.acc,fontFamily:MONO}}>{fmt(settings.countdownFrom||600)}</div>
              </div>
              <input type="range" min={60} max={1800} step={60}
                value={settings.countdownFrom||600}
                onChange={e=>onChange("countdownFrom",parseInt(e.target.value))}
                style={{width:"100%",accentColor:t.acc,height:4,cursor:"pointer"}}/>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                <span style={{fontSize:9,color:t.mut,fontFamily:MONO}}>1:00</span>
                <span style={{fontSize:9,color:t.mut,fontFamily:MONO}}>30:00</span>
              </div>
              <div style={{fontSize:9,color:t.mut,marginTop:6,lineHeight:1.5}}>Timer turns red when 30 seconds remain.</div>
            </div>
          )}
          <Row label="Pause on Minimize" ctrl={<Toggle val={settings.pauseOnHide} onToggle={()=>onChange("pauseOnHide",!settings.pauseOnHide)}/>}/>
        </div>
        <div style={an(4)}>
          <Sec>Controls</Sec>
          <Row label="Single-Tap to Clear" sub="Tap selected cell again to erase" ctrl={<Toggle val={settings.singleTapClear} onToggle={()=>onChange("singleTapClear",!settings.singleTapClear)}/>}/>
        </div>
        <div style={an(5)}>
          <Sec>Board Style Rewards</Sec>
          <div style={{fontSize:9,color:t.mut,marginBottom:8,lineHeight:1.5}}>Unlock cosmetic board glows by maintaining daily streaks. Tap an unlocked reward to activate it.</div>
          <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:8}}>
            {STREAK_REWARDS.map(r=>{
              const unlocked=get(K.rewards,[]).includes(r.id);
              const active=settings.boardReward===r.id;
              return(
                <Btn key={r.id} onTap={()=>unlocked&&onChange("boardReward",active?null:r.id)}
                  style={{padding:"10px 12px",borderRadius:11,background:active?`${t.acc}18`:t.bgCard,border:`1.5px solid ${active?t.acc:unlocked?t.brdM:t.brd}`,display:"flex",alignItems:"center",gap:10,opacity:unlocked?1:0.45}}>
                  <span style={{fontSize:18}}>{r.icon}</span>
                  <div style={{flex:1,textAlign:"left"}}>
                    <div style={{fontSize:12,fontWeight:700,color:unlocked?t.pri:t.mut}}>{r.label}</div>
                    <div style={{fontSize:9,color:t.mut,marginTop:1}}>{r.desc} · {r.streak}-day streak</div>
                  </div>
                  {active&&<div style={{fontSize:9,color:t.acc,fontWeight:700,letterSpacing:"0.08em"}}>ACTIVE</div>}
                  {unlocked&&!active&&<div style={{fontSize:9,color:t.sec}}>tap to use</div>}
                  {!unlocked&&<div style={{fontSize:9,color:t.mut}}>🔒 {r.streak}d</div>}
                </Btn>
              );
            })}
          </div>
        </div>
        <div style={an(6)}>
          <Sec>Accessibility</Sec>
          <div style={{padding:"12px 0",borderBottom:`1px solid ${t.brd}`}}>
            <div style={{fontSize:"clamp(12px,3.2vw,13px)",color:t.pri,fontWeight:600,marginBottom:8}}>Number Size</div>
            <div style={{display:"flex",gap:8}}>
              {[["small","S",14],["medium","M",18],["large","L",22]].map(([v,lbl,sz])=>(
                <Btn key={v} onTap={()=>onChange("textSize",v)} style={{flex:1,padding:"9px 4px",borderRadius:10,border:`1.5px solid ${settings.textSize===v?t.acc:t.brd}`,background:settings.textSize===v?`${t.acc}20`:"transparent",color:settings.textSize===v?t.acc:t.mut,fontFamily:SERIF,fontSize:sz,fontWeight:700}}>{lbl}</Btn>
              ))}
            </div>
          </div>
          <div style={{padding:"12px 0",borderBottom:`1px solid ${t.brd}`}}>
            <div style={{fontSize:"clamp(12px,3.2vw,13px)",color:t.pri,fontWeight:600,marginBottom:8}}>Number Font</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[
                ["rounded","Rounded","Nunito — soft and friendly"],
                ["modern","Modern","Clean system font — neutral"],
                ["sharp","Mono","Monospace — technical feel"],
                ["classic","Classic","Serif — traditional look"],
                ["playful","Playful","Casual and fun"],
              ].map(([v,lbl,desc])=>(
                <Btn key={v} onTap={()=>onChange("numFont",v)} style={{padding:"10px 14px",borderRadius:10,border:`1.5px solid ${settings.numFont===v?t.acc:t.brd}`,background:settings.numFont===v?`${t.acc}18`:"transparent",display:"flex",alignItems:"center",gap:12}}>
                  <div style={{flex:1,minWidth:0,textAlign:"center"}}>
                    <div style={{fontSize:13,fontWeight:700,color:settings.numFont===v?t.acc:t.pri}}>
                      <span style={{fontFamily:MONO}}>{lbl}</span>
                      <span style={{color:t.mut,fontFamily:MONO}}> | </span>
                      <span style={{fontFamily:NUM_FONTS[v]}}>123</span>
                    </div>
                    <div style={{fontSize:9,color:t.mut,marginTop:2,fontFamily:MONO}}>{desc}</div>
                  </div>
                  {settings.numFont===v&&<span style={{fontSize:11,color:t.acc,fontWeight:700,flexShrink:0}}>✓</span>}
                </Btn>
              ))}
            </div>
          </div>
          <Row label="Colorblind Mode" sub="Use icons instead of color for feedback" ctrl={<Toggle val={settings.colorblind} onToggle={()=>onChange("colorblind",!settings.colorblind)}/>}/>
        </div>
        <div style={an(7)}>
          <Sec>Background Photo</Sec>
          <div style={{fontSize:9,color:t.mut,marginBottom:8,lineHeight:1.5}}>Upload a photo to use as the puzzle background. Your chosen theme colors still apply on top.</div>
          {settings.bgPhoto?(
            <div style={{position:"relative",marginBottom:8}}>
              <img src={settings.bgPhoto} alt="bg" style={{width:"100%",height:100,objectFit:"cover",borderRadius:12,border:`1.5px solid ${t.brd}`}}/>
              <Btn onTap={()=>onChange("bgPhoto",null)} style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.7)",border:"none",borderRadius:6,color:"#fff",fontSize:10,fontWeight:700,padding:"4px 8px"}}>✕ Remove</Btn>
            </div>
          ):(
            <label style={{display:"block",width:"100%",padding:"16px",borderRadius:12,border:`1.5px dashed ${t.brd}`,textAlign:"center",cursor:"pointer",background:t.bgCard,marginBottom:8}}>
              <div style={{fontSize:22,marginBottom:4}}>🖼️</div>
              <div style={{fontSize:12,fontWeight:700,color:t.sec,fontFamily:MONO}}>Tap to upload photo</div>
              <div style={{fontSize:9,color:t.mut,marginTop:2}}>JPG or PNG · used as puzzle background</div>
              <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
                const file=e.target.files?.[0];
                if(!file)return;
                const reader=new FileReader();
                reader.onload=ev=>onChange("bgPhoto",ev.target.result);
                reader.readAsDataURL(file);
              }}/>
            </label>
          )}
          {/* Board Opacity slider with live preview */}
          <div style={{padding:"12px 0",borderBottom:`1px solid ${t.brd}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:"clamp(12px,3.2vw,13px)",color:t.pri,fontWeight:600}}>Board Opacity</div>
              <div style={{fontSize:13,fontWeight:700,color:t.acc,fontFamily:MONO}}>{settings.boardOpacity??100}%</div>
            </div>
            <input type="range" min={20} max={100} step={5}
              value={settings.boardOpacity??100}
              onChange={e=>onChange("boardOpacity",parseInt(e.target.value))}
              style={{width:"100%",accentColor:t.acc,height:4,cursor:"pointer"}}/>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
              <span style={{fontSize:9,color:t.mut,fontFamily:MONO}}>20% — transparent</span>
              <span style={{fontSize:9,color:t.mut,fontFamily:MONO}}>100% — solid</span>
            </div>
            {/* Keep numbers visible toggle */}
            <div onClick={()=>onChange("opacityBgOnly",!(settings.opacityBgOnly!==false))}
              style={{display:"flex",alignItems:"center",gap:10,marginTop:10,cursor:"pointer",padding:"8px 10px",borderRadius:8,background:t.bgCard,border:`1px solid ${t.brd}`}}>
              <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${settings.opacityBgOnly!==false?t.acc:t.mut}`,background:settings.opacityBgOnly!==false?t.acc:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {settings.opacityBgOnly!==false&&<span style={{color:"#fff",fontSize:11,fontWeight:700,lineHeight:1}}>✓</span>}
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:t.pri,fontFamily:MONO}}>Keep numbers at full opacity</div>
                <div style={{fontSize:9,color:t.mut,marginTop:1}}>Only the cell background fades — numbers stay crisp</div>
              </div>
            </div>
            {/* Live preview */}
            <div style={{marginTop:12,position:"relative",borderRadius:10,overflow:"hidden",height:80,background:settings.bgPhoto?`url(${settings.bgPhoto}) center/cover`:`${t.acc}22`}}>
              {!settings.bgPhoto&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:t.mut,fontFamily:MONO}}>Upload a photo to preview</div>}
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <div style={{width:64,height:64,background:t.bg,borderRadius:6,opacity:(settings.boardOpacity??100)/100,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gridTemplateRows:"repeat(3,1fr)",border:`1.5px solid ${t.brdM}`,overflow:"hidden"}}>
                  {[7,0,3,0,4,0,9,0,1].map((v,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"center",borderRight:i%3===2?"none":`0.5px solid ${t.brd}`,borderBottom:i<6?`0.5px solid ${t.brd}`:"none"}}>
                      {v>0&&<span style={{fontSize:11,fontWeight:700,color:t.pri,fontFamily:MONO}}>{v}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// STATS HELPERS
// ─────────────────────────────────────────────
function avg(arr){return arr.length?Math.round(arr.reduce((s,v)=>s+v,0)/arr.length):null;}
function trendArrow(wins){
  // Compare avg time of last 5 vs prior 5 — returns "↑" faster, "↓" slower, "→" stable
  if(!wins||wins.length<6)return"→";
  const recent=wins.slice(-5).map(w=>w.time||0);
  const prior=wins.slice(-10,-5).map(w=>w.time||0);
  if(!prior.length)return"→";
  const rAvg=avg(recent),pAvg=avg(prior);
  if(rAvg===null||pAvg===null)return"→";
  const delta=(pAvg-rAvg)/pAvg;
  if(delta>0.05)return{arrow:"↑",color:"#4ade80",label:"Getting faster"};
  if(delta<-0.05)return{arrow:"↓",color:"#f87171",label:"Getting slower"};
  return{arrow:"→",color:"#94a3b8",label:"Steady pace"};
}

// ─────────────────────────────────────────────
// STATS SCREEN
// ─────────────────────────────────────────────
function StatsScreen({t,stats,onBack,onBests}){
  const [tab,setTab]=useState("overview");
  const [vis,setVis]=useState(false);
  useEffect(()=>{const id=setTimeout(()=>setVis(true),40);return()=>clearTimeout(id);},[]);
  const streak=stats?.dStreak||0;
  const MILES=[3,7,14,30,60,100];
  const nextM=MILES.find(m=>m>streak)||null;
  const achv=get(K.achv,{});
  const hist=get(K.hist,[]).slice(0,20);
  const Card=({label,val,sub,color})=>(
    <div style={{background:t.bgCard,border:`1.5px solid ${t.brd}`,borderRadius:12,padding:"11px 8px",textAlign:"center",flex:1,minWidth:0}}>
      <div style={{fontSize:"clamp(18px,5vw,24px)",fontWeight:700,fontFamily:SERIF,color:color||t.pri,lineHeight:1}}>{val}</div>
      {sub&&<div style={{fontSize:7,color:t.acc,letterSpacing:"0.1em",marginTop:2}}>{sub}</div>}
      <div style={{fontSize:8,color:t.mut,marginTop:2,letterSpacing:"0.04em"}}>{label}</div>
    </div>
  );
  return(
    <div style={{height:"100dvh",width:"100vw",background:t.bg,display:"flex",flexDirection:"column",padding:"max(env(safe-area-inset-top),14px) 18px max(env(safe-area-inset-bottom),20px)",boxSizing:"border-box",fontFamily:MONO,color:t.pri,overflow:"hidden"}}>
      <Btn onTap={onBack} style={{background:t.bgHov,color:t.sec,fontSize:13,fontWeight:600,padding:"6px 12px",borderRadius:8,border:`1px solid ${t.brdM}`,marginBottom:8,alignSelf:"flex-start",letterSpacing:"0.01em",display:"flex",alignItems:"center",gap:4}}>‹ Back</Btn>
      <div style={{fontSize:"clamp(20px,5.5vw,26px)",fontWeight:700,fontFamily:SERIF,marginBottom:10,opacity:vis?1:0,transition:"opacity .4s"}}>Statistics</div>
      <div style={{display:"flex",gap:5,marginBottom:10}}>
        {[["overview","📊 Overview"],["history","📋 History"],["awards","🏅 Awards"]].map(([id,lbl])=>(
          <Btn key={id} onTap={()=>setTab(id)} style={{flex:1,padding:"8px 4px",borderRadius:10,background:tab===id?`${t.acc}22`:"transparent",border:`1.5px solid ${tab===id?t.acc:t.brd}`,color:tab===id?t.acc:t.mut,fontSize:"clamp(9px,2.3vw,10px)",fontWeight:700}}>{lbl}</Btn>
        ))}
      </div>
      <div style={{flex:1,overflowY:"auto"}}>
        {tab==="overview"&&<>
          <Btn onTap={onBests} style={{width:"100%",padding:"11px 14px",borderRadius:12,background:`${t.acc}15`,border:`1.5px solid ${t.acc}55`,display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
            <span style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:16}}>🏆</span><span style={{fontSize:"clamp(12px,3.2vw,13px)",fontWeight:700,color:t.acc,fontFamily:MONO}}>Personal Bests</span></span>
            <span style={{color:t.acc,fontSize:13}}>›</span>
          </Btn>
          <div style={{background:t.bgCard,border:`1.5px solid ${stats?.lastDailyWin===todayStr()?"#f59e0b55":t.brd}`,borderRadius:14,padding:12,marginBottom:8}}>
            <div style={{fontSize:10,fontWeight:700,color:"#f59e0b",marginBottom:8}}>DAILY STREAK</div>
            <div style={{display:"flex",gap:6,marginBottom:8}}>
              <Card label="Current" val={streak} color="#f59e0b" sub={nextM?`NEXT: ${nextM}d`:undefined}/>
              <Card label="Best" val={stats?.bDStreak||0} color="#f59e0b"/>
              <Card label="Total" val={stats?.dWins||0} color="#f59e0b"/>
            </div>
            {nextM&&<div style={{height:3,borderRadius:3,background:t.brd,overflow:"hidden"}}><div style={{height:"100%",width:`${(streak/nextM)*100}%`,background:"#f59e0b",transition:"width .6s"}}/></div>}
          </div>
          <div style={{display:"flex",gap:6,marginBottom:8}}>
            <Card label="Win Streak" val={stats?.wStreak||0} color={t.acc} sub="CURRENT"/>
            <Card label="Best" val={stats?.bWStreak||0} color={t.acc}/>
          </div>
          {/* Per-difficulty advanced stats */}
          <div style={{background:t.bgCard,border:`1.5px solid ${t.brd}`,borderRadius:14,padding:"0 14px",marginBottom:8}}>
            {[...DIFFS.map(d=>({key:d,color:DCOL[d],label:DLBL[d],data:stats?.[d]})),{key:"daily",color:"#f59e0b",label:"Daily",data:stats?.daily}].map(({key,color,label,data})=>{
              const wins=data?.wins||[];
              const avgT=avg(wins.map(w=>w.time||0));
              const avgM=avg(wins.map(w=>w.mistakes||0));
              const avgH=avg(wins.map(w=>w.hints||0));
              const trend=trendArrow(wins);
              return(
                <div key={key} style={{padding:"10px 0",borderBottom:`1px solid ${t.brd}`}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:6,height:6,borderRadius:"50%",background:color,flexShrink:0}}/>
                      <span style={{fontSize:12,fontWeight:700,color}}>{label}</span>
                      {wins.length>0&&<span style={{fontSize:13,color:trend.color,lineHeight:1}} title={trend.label}>{trend.arrow}</span>}
                    </div>
                    <div style={{fontSize:11,fontWeight:700,color:t.pri}}>{(data?.p||0)>0?Math.round((data?.w||0)/(data?.p||1)*100)+"%":"—"}</div>
                  </div>
                  <div style={{display:"flex",gap:12}}>
                    <div style={{fontSize:9,color:t.mut}}><span style={{color:t.sec}}>{data?.w||0}</span> wins · <span style={{color:t.sec}}>{data?.p||0}</span> played</div>
                    {avgT!==null&&<div style={{fontSize:9,color:t.mut}}>avg <span style={{color:t.sec}}>{fmt(avgT)}</span></div>}
                    {avgM!==null&&<div style={{fontSize:9,color:t.mut}}>avg <span style={{color:t.sec}}>{avgM.toFixed(1)}</span> ✗</div>}
                    {avgH!==null&&<div style={{fontSize:9,color:t.mut}}>avg <span style={{color:t.sec}}>{avgH.toFixed(1)}</span> 💡</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </>}
        {tab==="history"&&<>
          {hist.length===0&&<div style={{textAlign:"center",color:t.mut,padding:"40px 0"}}>No games yet</div>}
          {hist.map((g,i)=>(
            <div key={i} style={{background:t.bgCard,border:`1.5px solid ${t.brd}`,borderRadius:11,padding:"10px 12px",marginBottom:7,display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:g.won?(g.mistakes===0?"#4ade80":t.acc):"#f43f5e",flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:t.pri}}>{g.mode==="daily"?"🗓️ Daily":g.mode==="zen"?"🧘 Zen":g.mode==="focus"?"🎯 Focus":g.mode==="endless"?`♾️ Lv.${g.el||1}`:DLBL[g.diff]||g.diff}</div>
                <div style={{fontSize:9,color:t.mut,marginTop:1}}>{g.date} · {fmt(g.time||0)} · {g.mistakes||0} mistakes</div>
              </div>
              <div style={{fontSize:14}}>{g.won?(g.mistakes===0?"✨":"✅"):"💔"}</div>
            </div>
          ))}
        </>}
        {tab==="awards"&&<>
          <div style={{fontSize:10,color:t.mut,marginBottom:10}}>{ACHDEFS.filter(a=>achv[a.id]).length}/{ACHDEFS.length} unlocked</div>
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {ACHDEFS.map(a=>{
              const unlocked=!!achv[a.id];
              return(
                <div key={a.id} style={{background:t.bgCard,border:`1.5px solid ${unlocked?t.acc:t.brd}`,borderRadius:12,padding:"11px 13px",display:"flex",alignItems:"center",gap:12,opacity:unlocked?1:0.5}}>
                  <span style={{fontSize:20}}>{a.icon}</span>
                  <div style={{flex:1}}><div style={{fontSize:12,fontWeight:700,color:unlocked?t.pri:t.mut}}>{a.label}</div><div style={{fontSize:9,color:t.mut,marginTop:2}}>{a.desc}</div></div>
                  {unlocked&&<span style={{fontSize:9,color:t.acc}}>✓</span>}
                </div>
              );
            })}
          </div>
        </>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ARCHIVE
// ─────────────────────────────────────────────
function Archive({t,onBack,onPlay}){
  const arch=get(K.arch,[]);
  const today=todayStr();
  const last7=Array.from({length:7},(_,i)=>{
    const d=new Date();d.setDate(d.getDate()-i);
    return`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  });
  return(
    <div style={{height:"100dvh",width:"100vw",background:t.bg,display:"flex",flexDirection:"column",padding:"max(env(safe-area-inset-top),14px) 18px max(env(safe-area-inset-bottom),20px)",boxSizing:"border-box",fontFamily:MONO,color:t.pri}}>
      <Btn onTap={onBack} style={{background:t.bgHov,color:t.sec,fontSize:13,fontWeight:600,padding:"6px 12px",borderRadius:8,border:`1px solid ${t.brdM}`,marginBottom:10,alignSelf:"flex-start",letterSpacing:"0.01em",display:"flex",alignItems:"center",gap:4}}>‹ Back</Btn>
      <div style={{fontSize:"clamp(20px,5.5vw,26px)",fontWeight:700,fontFamily:SERIF,marginBottom:4}}>Archive</div>
      <div style={{fontSize:9,color:t.mut,letterSpacing:"0.12em",marginBottom:14,textTransform:"uppercase"}}>Complete daily goals for badges</div>
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
        {last7.map(dateStr=>{
          const isToday=dateStr===today;
          const done=arch.includes(dateStr);
          const goalsCompleted=getDailyGoals(dateStr);
          const numDone=DAILY_GOALS.filter(g=>goalsCompleted[g.id]).length;
          return(
            <div key={dateStr} style={{background:t.bgCard,border:`1.5px solid ${done?t.acc+"55":t.brd}`,borderRadius:14,padding:"12px 14px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:done?8:0}}>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:t.pri}}>{isToday?"Today":dateStr}</div>
                  <div style={{fontSize:9,color:t.mut,marginTop:2}}>
                    {done?`${numDone}/${DAILY_GOALS.length} goals`:"Not played yet"}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  {done&&<div style={{display:"flex",gap:4}}>
                    {DAILY_GOALS.map(g=>(
                      <div key={g.id} title={g.label} style={{
                        fontSize:16,opacity:goalsCompleted[g.id]?1:0.2,
                        filter:goalsCompleted[g.id]?"drop-shadow(0 0 4px currentColor)":"none",
                        transition:"opacity .3s"
                      }}>{g.icon}</div>
                    ))}
                  </div>}
                  <Btn onTap={()=>onPlay(dateStr,!isToday||done)} style={{padding:"8px 14px",borderRadius:9,background:isToday&&!done?`${t.acc}22`:"transparent",border:`1.5px solid ${isToday&&!done?t.acc:t.brd}`,color:isToday&&!done?t.acc:t.mut,fontSize:10,fontWeight:700,fontFamily:MONO}}>
                    {isToday&&!done?"Play →":done?"Replay":"Play"}
                  </Btn>
                </div>
              </div>
              {/* Goal chips — only for today’s incomplete goals to show targets */}
              {isToday&&!done&&(
                <div style={{display:"flex",gap:5,marginTop:8,flexWrap:"wrap"}}>
                  {DAILY_GOALS.map(g=>(
                    <div key={g.id} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 8px",borderRadius:8,background:`${t.acc}12`,border:`1px solid ${t.acc}33`}}>
                      <span style={{fontSize:11}}>{g.icon}</span>
                      <span style={{fontSize:8,color:t.sec,fontWeight:600}}>{g.desc}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// COACHING
// ─────────────────────────────────────────────
const TIPS=[
  {label:"Naked Singles",desc:"If a cell has only one possible digit — that digit must go there. Scan for cells blocked in all but one number by their row, column, and box."},
  {label:"Hidden Singles",desc:"If a digit can go in only one cell within a row, column, or box — it must. Even if that cell has multiple candidates."},
  {label:"Pencil Marks",desc:"Use notes mode (long-press) to jot candidates. Eliminating candidates from related cells narrows down possibilities fast."},
  {label:"Pointing Pairs",desc:"If a candidate in a box is limited to one row or column, it can be eliminated from the rest of that row or column outside the box."},
  {label:"Box-Line Reduction",desc:"If a candidate appears only in one box along a line, it can be removed from the rest of the box."},
  {label:"X-Wing",desc:"When a candidate appears in exactly two cells across two rows, both in the same columns, it can be eliminated from those columns elsewhere."},
];
const PRACTICE_TECHS=[
  {id:"naked",label:"Naked Singles",desc:"Spot single candidates",diff:"easy",clues:45},
  {id:"hidden",label:"Hidden Singles",desc:"Find hidden singles in units",diff:"medium",clues:35},
  {id:"pairs",label:"Naked Pairs",desc:"Identify paired candidates",diff:"medium",clues:30},
  {id:"pointing",label:"Pointing Pairs",desc:"Use box-line interactions",diff:"hard",clues:26},
  {id:"box",label:"Box-Line Reduction",desc:"Eliminate via box-line",diff:"hard",clues:24},
  {id:"xwing",label:"X-Wing",desc:"Spot the X-Wing pattern",diff:"very hard",clues:20},
];
function Coaching({t,onBack,onPractice}){
  const [tab,setTab]=useState("tips");
  const [exp,setExp]=useState(null);
  return(
    <div style={{height:"100dvh",width:"100vw",background:t.bg,display:"flex",flexDirection:"column",padding:"max(env(safe-area-inset-top),14px) 18px max(env(safe-area-inset-bottom),20px)",boxSizing:"border-box",fontFamily:MONO,color:t.pri,overflow:"hidden"}}>
      <Btn onTap={onBack} style={{background:t.bgHov,color:t.sec,fontSize:13,fontWeight:600,padding:"6px 12px",borderRadius:8,border:`1px solid ${t.brdM}`,marginBottom:8,alignSelf:"flex-start",letterSpacing:"0.01em",display:"flex",alignItems:"center",gap:4}}>‹ Back</Btn>
      <div style={{fontSize:"clamp(20px,5.5vw,26px)",fontWeight:700,fontFamily:SERIF,marginBottom:10}}>Coaching</div>
      <div style={{display:"flex",gap:5,marginBottom:12}}>
        {[["tips","💡 Tips"],["practice","🎯 Practice"],["howto","❓ How To"]].map(([id,lbl])=>(
          <Btn key={id} onTap={()=>setTab(id)} style={{flex:1,padding:"8px 4px",borderRadius:10,background:tab===id?`${t.acc}22`:"transparent",border:`1.5px solid ${tab===id?t.acc:t.brd}`,color:tab===id?t.acc:t.mut,fontSize:"clamp(9px,2.3vw,10px)",fontWeight:700}}>{lbl}</Btn>
        ))}
      </div>
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:7}}>
        {tab==="tips"&&TIPS.map((tip,i)=>(
          <div key={i}>
            <Btn onTap={()=>setExp(exp===i?null:i)} style={{width:"100%",padding:"12px 13px",borderRadius:12,background:t.bgCard,border:`1.5px solid ${exp===i?t.acc:t.brd}`,textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:"clamp(12px,3.2vw,13px)",fontWeight:700,color:exp===i?t.acc:t.pri}}>{tip.label}</span>
              <span style={{color:t.mut,fontSize:12}}>{exp===i?"▴":"▾"}</span>
            </Btn>
            {exp===i&&<div style={{padding:"10px 13px",background:t.bgCard,borderRadius:"0 0 12px 12px",fontSize:"clamp(12px,3vw,13px)",color:t.sec,lineHeight:1.65,borderLeft:`1.5px solid ${t.acc}`,borderRight:`1.5px solid ${t.brd}`,borderBottom:`1.5px solid ${t.brd}`}}>{tip.desc}</div>}
          </div>
        ))}
        {tab==="practice"&&PRACTICE_TECHS.map(tech=>(
          <Btn key={tech.id} onTap={()=>onPractice(tech)} style={{width:"100%",padding:"13px",borderRadius:12,background:t.bgCard,border:`1.5px solid ${DCOL[tech.diff]||t.brd}33`,display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:DCOL[tech.diff],boxShadow:`0 0 8px ${DCOL[tech.diff]}`,flexShrink:0}}/>
            <div style={{flex:1,textAlign:"left"}}>
              <div style={{fontSize:"clamp(12px,3.2vw,13px)",fontWeight:700,color:t.pri}}>{tech.label}</div>
              <div style={{fontSize:9,color:t.mut,marginTop:2}}>{tech.desc}</div>
            </div>
            <span style={{fontSize:9,color:DCOL[tech.diff],fontWeight:700,textTransform:"uppercase"}}>{DLBL[tech.diff]}</span>
          </Btn>
        ))}
        {tab==="howto"&&[
          ["What is the goal?","Fill every row, column and 3×3 box with digits 1–9 — no repeats anywhere."],
          ["How do notes work?","Long-press a digit to toggle notes mode. In notes mode, tapping places a pencil mark instead of the digit."],
          ["What counts as a mistake?","Placing a number that contradicts the solution. You get 3 mistakes before game over (except Focus mode — 1 mistake ends it)."],
          ["Can I undo?","Yes — the ↩ button undoes your last move, as many times as you like."],
          ["How do hints work?","Tap 💡 to reveal the correct digit for a cell. On Easy, you’ll see an explanation. On Very Hard, you’ll be asked to confirm."],
          ["Does the Daily puzzle repeat?","No — a unique puzzle generates each day from the date. You can replay past days via Archive."],
          ["What is Endless mode?","Puzzles chain together with increasing difficulty. Solve quickly to earn bonus time."],
        ].map(([q,a],i)=>(
          <div key={i}>
            <Btn onTap={()=>setExp(exp===`q${i}`?null:`q${i}`)} style={{width:"100%",padding:"12px 13px",borderRadius:12,background:t.bgCard,border:`1.5px solid ${exp===`q${i}`?t.acc:t.brd}`,textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:"clamp(12px,3.2vw,13px)",fontWeight:700,color:exp===`q${i}`?t.acc:t.pri,flex:1}}>{q}</span>
              <span style={{color:t.mut,fontSize:12,flexShrink:0}}>{exp===`q${i}`?"▴":"▾"}</span>
            </Btn>
            {exp===`q${i}`&&<div style={{padding:"10px 13px",background:t.bgCard,borderRadius:"0 0 12px 12px",fontSize:"clamp(12px,3vw,13px)",color:t.sec,lineHeight:1.65,borderLeft:`1.5px solid ${t.acc}`,borderRight:`1.5px solid ${t.brd}`,borderBottom:`1.5px solid ${t.brd}`}}>{a}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ACHIEVEMENT TOAST
// ─────────────────────────────────────────────
function AchToast({a,onDone}){
  useEffect(()=>{const id=setTimeout(onDone,3500);return()=>clearTimeout(id);},[]);
  const color=a.color||(a.type==="goal"?"#22d3ee":a.type==="reward"?"#f59e0b":"#f59e0b");
  const label=a.type==="goal"?"DAILY GOAL":a.type==="reward"?"STREAK REWARD":"ACHIEVEMENT UNLOCKED";
  return(
    <div style={{position:"fixed",top:52,left:"50%",transform:"translateX(-50%)",zIndex:300,background:"#16181f",border:`1.5px solid ${color}`,borderRadius:16,padding:"11px 16px",display:"flex",alignItems:"center",gap:10,boxShadow:`0 0 28px ${color}44`,maxWidth:"min(90vw,340px)",animation:"tIn .35s ease"}}>
      <style>{`@keyframes tIn{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
      <span style={{fontSize:22}}>{a.icon}</span>
      <div>
        <div style={{fontSize:11,fontWeight:700,color,fontFamily:MONO,letterSpacing:"0.05em"}}>{label}</div>
        <div style={{fontSize:12,color:"#f1f5f9",marginTop:2}}>{a.label}</div>
        {a.desc&&<div style={{fontSize:9,color:"#94a3b8",marginTop:1}}>{a.desc}</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// GAME OVER OVERLAY
// ─────────────────────────────────────────────
function GameOver({t,diff,mode,onRetry,onHome}){
  const col=mode==="focus"?"#f43f5e":mode==="endless"?"#a78bfa":DCOL[diff]||t.acc;
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,backdropFilter:"blur(8px)",padding:20}}>
      <div style={{background:t.bgCard,border:`2px solid ${col}`,borderRadius:20,padding:"28px 20px",textAlign:"center",boxShadow:`0 0 60px ${col}44`,width:"min(90vw,360px)"}}>
        <div style={{fontSize:48,marginBottom:10}}>💔</div>
        <div style={{fontSize:"clamp(18px,5vw,24px)",fontWeight:700,color:col,fontFamily:SERIF,marginBottom:6}}>Game Over</div>
        <div style={{color:t.sec,fontSize:12,marginBottom:16}}>{mode==="focus"?"One mistake — focus broken":"Too many mistakes"}</div>
        <Btn onTap={onRetry} style={{width:"100%",padding:"13px",borderRadius:10,border:`1.5px solid ${col}`,background:`${col}18`,color:col,fontSize:12,fontWeight:700,fontFamily:MONO,letterSpacing:"0.05em",marginBottom:8}}>Try Again</Btn>
        <Btn onTap={onHome} style={{width:"100%",padding:"11px",borderRadius:10,border:`1.5px solid ${t.brd}`,background:"transparent",color:t.mut,fontSize:11,fontWeight:700,fontFamily:MONO,letterSpacing:"0.05em"}}>⌂ Home</Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SMART HINT OVERLAY
// ─────────────────────────────────────────────
function HintOverlay({hint,onPlace,onDismiss,t}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:90,backdropFilter:"blur(4px)",padding:"0 14px 28px"}} onClick={onDismiss}>
      <div style={{background:t.bgCard,border:`1.5px solid ${t.acc}`,borderRadius:20,padding:"18px 16px",width:"min(100%,440px)",boxShadow:`0 0 40px ${t.acc}33`}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:9,letterSpacing:"0.3em",color:t.acc,marginBottom:8,fontFamily:MONO}}>SMART HINT</div>
        <div style={{fontSize:"clamp(13px,3.5vw,15px)",color:t.pri,lineHeight:1.6,marginBottom:14,fontFamily:MONO}}>{hint.reason}</div>
        <div style={{display:"flex",gap:8}}>
          <Btn onTap={onDismiss} style={{flex:1,padding:"11px",borderRadius:10,border:`1.5px solid ${t.brd}`,background:"transparent",color:t.mut,fontSize:11,fontWeight:700,fontFamily:MONO}}>Later</Btn>
          <Btn onTap={onPlace} style={{flex:2,padding:"11px",borderRadius:10,background:`${t.acc}22`,border:`1.5px solid ${t.acc}`,color:t.acc,fontSize:11,fontWeight:700,fontFamily:MONO}}>Place {hint.num} →</Btn>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// GAME SCREEN
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// OFFLINE TOAST
// ─────────────────────────────────────────────
function OfflineToast({t}){
  const [offline,setOffline]=useState(!navigator.onLine);
  const [show,setShow]=useState(false);
  useEffect(()=>{
    const goOff=()=>{setOffline(true);setShow(true);};
    const goOn=()=>{setOffline(false);setShow(true);setTimeout(()=>setShow(false),3000);};
    window.addEventListener("offline",goOff);
    window.addEventListener("online",goOn);
    return()=>{window.removeEventListener("offline",goOff);window.removeEventListener("online",goOn);};
  },[]);
  if(!show&&!offline)return null;
  return(
    <div style={{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",zIndex:300,background:offline?"#1a1a1a":"#14532d",border:`1px solid ${offline?"#555":"#4ade80"}`,borderRadius:10,padding:"8px 16px",display:"flex",alignItems:"center",gap:8,boxShadow:"0 4px 20px rgba(0,0,0,0.4)",animation:"tIn .3s ease",whiteSpace:"nowrap"}}>
      <div style={{width:8,height:8,borderRadius:"50%",background:offline?"#f43f5e":"#4ade80",flexShrink:0}}/>
      <span style={{fontSize:11,fontWeight:700,fontFamily:"monospace",color:"#fff"}}>{offline?"No connection — puzzles still work offline":"Back online"}</span>
    </div>
  );
}

function GameScreen({t,settings,difficulty:initDiff,savedState,seed:initSeed,onHome,onSave,onWin,onLoss,isDaily,isPractice,gameMode}){
  // Derived flags — not hooks
  const isZen=gameMode==="zen";
  const isFocus=gameMode==="focus";
  const isEndless=gameMode==="endless";
  const gt=isZen?ZEN:t;

  // ── ALL useState FIRST, unconditionally ──────
  const [diff,setDiff]=useState(initDiff);
  const [activeSeed,setActiveSeed]=useState(initSeed||null);
  const [shareMsg,setShareMsg]=useState(null); // "Copied!" toast
  const [sol,setSol]=useState(null);
  const [board,setBoard]=useState(null);
  const [given,setGiven]=useState(null);
  const [noteBoard,setNoteBoard]=useState(null);
  const [sel,setSel]=useState(null);
  const [numHigh,setNumHigh]=useState(null); // highlighted digit when no cell selected
  const [won,setWon]=useState(false);
  const [over,setOver]=useState(false);
  const [puzzleRating,setPuzzleRating]=useState(0);
  const [confetti,setConfetti]=useState([]);
  const [shareResult,setShareResult]=useState(null);
  const [notes,setNotes]=useState(false);
  const [mistakes,setMistakes]=useState(0);
  const [hints,setHints]=useState(0);
  const [timer,setTimer]=useState(0);
  const [running,setRunning]=useState(false);
  const [flash,setFlash]=useState({});
  const [smartH,setSmartH]=useState(null);
  const [undos,setUndos]=useState([]);
  const [pulse,setPulse]=useState({rows:new Set(),cols:new Set(),boxes:new Set()});
  const [endLv,setEndLv]=useState(1);
  const [bank,setBank]=useState(120);
  const [vhPend,setVhPend]=useState(false);
  const [newPend,setNewPend]=useState(false);
  const [ready,setReady]=useState(false);
  const [paused,setPaused]=useState(false);

  // ── ALL useRef SECOND ─────────────────────────
  const lpTimers=useRef({});

  // ── Derived values (not hooks) ────────────────
  const EDIFFS=["easy","easy","medium","medium","hard","hard","very hard","very hard"];
  const effDiff=isEndless?EDIFFS[Math.min(endLv-1,EDIFFS.length-1)]:diff;
  const useShints=effDiff==="easy"||isPractice;
  const hintLim=isZen||isFocus||isEndless||isPractice?null:3;
  const acc=isZen?gt.acc:DCOL[effDiff]||t.acc;
  const numSz={small:"clamp(11px,2.8vw,17px)",medium:"clamp(13px,3.4vw,20px)",large:"clamp(15px,4vw,24px)"}[settings.textSize]||"clamp(13px,3.4vw,20px)";
  const padSz={small:"clamp(14px,4vw,20px)",medium:"clamp(17px,5vw,26px)",large:"clamp(20px,6vw,32px)"}[settings.textSize]||"clamp(17px,5vw,26px)";
  const noteSz={small:"clamp(4px,0.8vw,7px)",medium:"clamp(5px,1vw,8px)",large:"clamp(6px,1.2vw,10px)"}[settings.textSize]||"clamp(5px,1vw,8px)";
  const activeNumFont=NUM_FONTS[settings.numFont]||NUM_FONTS.rounded;

  // ── ALL useCallback THIRD ─────────────────────
  const sfx=useCallback((name)=>{
    if(!settings.soundOn)return;
    if(isZen){if(["ok","note","tap"].includes(name))SFX.zen();else if(name==="win")SFX.zenW();return;}
    SFX[name]?.();
  },[settings.soundOn,isZen]);

  const hap=useCallback((p)=>{if(settings.hapticsOn)vib(p);},[settings.hapticsOn]);

  const doStart=useCallback((d,lv,tb,forceSeed)=>{
    const seed=forceSeed!==undefined?forceSeed:randomSeed();
    const {puzzle,solution}=makePuzzleFromSeed(d,seed);
    setActiveSeed(seed);
    setSol(solution);
    setBoard(puzzle.map(r=>[...r]));
    setGiven(puzzle.map(r=>r.map(v=>v!==0)));
    setNoteBoard(Array.from({length:9},()=>Array.from({length:9},()=>new Set())));
    setSel(null);setWon(false);setOver(false);setNotes(false);
    setMistakes(0);setHints(0);setTimer(0);setRunning(true);setDiff(d);
    setFlash({});setSmartH(null);setUndos([]);setPulse({rows:new Set(),cols:new Set(),boxes:new Set()});
    setShareMsg(null);
    if(isEndless){setEndLv(lv||1);setBank(tb!==undefined?tb:120);}
    setReady(true);
  },[isEndless]);

  const doWin=useCallback((bd,tv,lv)=>{
    sfx("win");hap([20,10,20,10,40]);
    setWon(true);setRunning(false);
    setPuzzleRating(0);
    setShareResult(null);
    // Spawn confetti particles — fewer/dimmer for dark themes
    const isDark=gt.bg==="#0f0f1a"||gt.bg==="#1a1a2e"||gt.bg==="#0d1117";
    const count=isDark?18:28;
    const colors=[acc,"#4ade80","#f59e0b","#818cf8","#f43f5e","#34d399"];
    setConfetti(Array.from({length:count},(_,i)=>({
      id:i,
      x:20+Math.random()*60,
      color:colors[i%colors.length],
      size:4+Math.random()*5,
      duration:1.4+Math.random()*0.8,
      delay:Math.random()*0.4,
      spin:Math.random()>0.5,
    })));
    setTimeout(()=>setConfetti([]),3000);
    onWin&&onWin(tv,{diff:effDiff,mode:gameMode,endlessLevel:lv||endLv,mistakes,hints});
  },[sfx,hap,onWin,effDiff,gameMode,endLv,mistakes,hints,acc,gt.bg]);

  const chkPulse=useCallback((bd,r,c)=>{
    const nr=new Set(),nc=new Set(),nb=new Set();
    // Row complete?
    if(bd[r].every(v=>v!==0)&&new Set(bd[r]).size===9)nr.add(r);
    // Col complete?
    const col=bd.map(x=>x[c]);
    if(col.every(v=>v!==0)&&new Set(col).size===9)nc.add(c);
    // Box complete?
    const br=3*Math.floor(r/3),bc=3*Math.floor(c/3);
    const boxCells=[];
    for(let dr=0;dr<3;dr++)for(let dc=0;dc<3;dc++)boxCells.push(bd[br+dr][bc+dc]);
    if(boxCells.every(v=>v!==0)&&new Set(boxCells).size===9)nb.add(br*3+bc);
    if(nr.size||nc.size||nb.size){
      setPulse({rows:nr,cols:nc,boxes:nb});
      sfx(isZen?"zenLine":"line");
      setTimeout(()=>setPulse({rows:new Set(),cols:new Set(),boxes:new Set()}),750);
    }
  },[sfx,isZen]);

  const pushUndo=useCallback((bd,nb,m)=>{
    setUndos(u=>[...u.slice(-30),{board:bd.map(r=>[...r]),nb:nb.map(r=>r.map(c=>new Set(c))),m}]);
  },[]);

  const doUndo=useCallback(()=>{
    setUndos(u=>{
      if(!u.length)return u;
      const prev=u[u.length-1];
      setBoard(prev.board.map(r=>[...r]));
      setNoteBoard(prev.nb.map(r=>r.map(c=>new Set(c))));
      setMistakes(prev.m);
      sfx("undo");hap([8]);
      return u.slice(0,-1);
    });
  },[sfx,hap]);

  const doNumber=useCallback((num)=>{
    if(!sel||won||over)return;
    const[r,c]=sel;
    if(!sol||!board||!given||!noteBoard)return;
    if(given[r][c])return;
    // Hard cap — never allow input beyond 3 mistakes
    if(!isFocus&&!isZen&&!isPractice&&mistakes>=3)return;
    if(notes){
      pushUndo(board,noteBoard,mistakes);
      setNoteBoard(nb=>{const nn=nb.map(rr=>rr.map(cc=>new Set(cc)));if(nn[r][c].has(num))nn[r][c].delete(num);else nn[r][c].add(num);return nn;});
      sfx("note");hap([6]);return;
    }
    if(num===0){
      if(board[r][c]===0&&noteBoard[r][c].size===0)return;
      pushUndo(board,noteBoard,mistakes);
      const nx=board.map(rr=>[...rr]);nx[r][c]=0;
      setBoard(nx);
      setNoteBoard(nb=>{const nn=nb.map(rr=>rr.map(cc=>new Set(cc)));nn[r][c]=new Set();return nn;});
      sfx("era");hap([6]);return;
    }
    pushUndo(board,noteBoard,mistakes);
    const nx=board.map(rr=>[...rr]);
    nx[r][c]=nx[r][c]===num?0:num;
    if(num!==0&&nx[r][c]!==0&&sol[r][c]!==num){
      const nm=mistakes+1;setMistakes(nm);
      if(settings.highlightMistakes){
        sfx("bad");hap([30,10,30]);
        if(isFocus){setRunning(false);setOver(true);onLoss&&onLoss();return;}
        if(!isZen&&!isPractice&&nm>=3){setRunning(false);setOver(true);onLoss&&onLoss();return;}
        const ck=`${r}-${c}`;
        setFlash(f=>{
          if(f[ck]){clearTimeout(f[ck].t1);clearTimeout(f[ck].t2);}
          const t1=setTimeout(()=>setFlash(f2=>f2[ck]?{...f2,[ck]:{...f2[ck],fad:true}}:f2),1400);
          const t2=setTimeout(()=>{
            setBoard(b=>{const nb=b.map(rr=>[...rr]);nb[r][c]=0;return nb;});
            setFlash(f2=>{const n={...f2};delete n[ck];return n;});
          },2000);
          return{...f,[ck]:{t1,t2,fad:false}};
        });
        setBoard(nx);return;
      } else {
        // Find Myself mode — number stays placed silently, no feedback
        if(isFocus){setRunning(false);setOver(true);onLoss&&onLoss();return;}
        if(!isZen&&!isPractice&&nm>=3){setRunning(false);setOver(true);onLoss&&onLoss();return;}
        setBoard(nx);return;
      }
    }
    if(settings.autoNotes&&num!==0){
      setNoteBoard(nb=>{
        const nn=nb.map(rr=>rr.map(cc=>new Set(cc)));
        for(let i=0;i<9;i++){nn[r][i].delete(num);nn[i][c].delete(num);}
        const br=3*Math.floor(r/3),bc=3*Math.floor(c/3);
        for(let dr=0;dr<3;dr++)for(let dc=0;dc<3;dc++)nn[br+dr][bc+dc].delete(num);
        return nn;
      });
    }
    setBoard(nx);
    if(nx.every((rr,ri)=>rr.every((v,ci)=>v===sol[ri][ci]))){
      doWin(nx,timer,endLv);
    }else{
      sfx("ok");hap([10]);
      chkPulse(nx,r,c);
    }
  },[sel,won,over,sol,board,given,noteBoard,notes,mistakes,settings.autoNotes,
     pushUndo,timer,isFocus,sfx,hap,doWin,endLv,chkPulse]);

  const doHint=useCallback(()=>{
    if(won||over)return;
    if(hintLim!==null&&hints>=hintLim)return;
    if(!board||!sol||!given)return;
    if(useShints){
      const h=smartHint(board,sol,given,sel);
      if(h){setSmartH(h);return;}
    }
    let tr=-1,tc=-1;
    if(sel){const[sr,sc]=sel;if(!given[sr][sc]&&board[sr][sc]!==sol[sr][sc]){tr=sr;tc=sc;}}
    if(tr===-1){outer:for(let r=0;r<9;r++)for(let c=0;c<9;c++){if(!given[r][c]&&board[r][c]!==sol[r][c]){tr=r;tc=c;break outer;}}}
    if(tr===-1)return;
    pushUndo(board,noteBoard,mistakes);
    const nx=board.map(r=>[...r]);nx[tr][tc]=sol[tr][tc];
    setBoard(nx);setHints(h=>h+1);setSel([tr,tc]);
    sfx("hint");hap([10,5,10]);
    if(nx.every((r,ri)=>r.every((v,ci)=>v===sol[ri][ci])))doWin(nx,timer,endLv);
  },[won,over,board,sol,given,sel,hintLim,hints,useShints,noteBoard,mistakes,pushUndo,sfx,hap,doWin,timer,endLv]);

  const applyHint=useCallback(()=>{
    if(!smartH||!board||!sol)return;
    const{r,c,num}=smartH;
    pushUndo(board,noteBoard,mistakes);
    const nx=board.map(rr=>[...rr]);nx[r][c]=num;
    setBoard(nx);setHints(h=>h+1);setSmartH(null);
    sfx("hint");hap([10,5,10]);
    if(nx.every((rr,ri)=>rr.every((v,ci)=>v===sol[ri][ci])))doWin(nx,timer,endLv);
  },[smartH,board,sol,noteBoard,mistakes,pushUndo,sfx,hap,doWin,timer,endLv]);

  // ── ALL useEffect FOURTH ──────────────────────
  // Init
  useEffect(()=>{
    if(savedState?.solution){
      setSol(savedState.solution);
      setBoard(savedState.userBoard.map(r=>[...r]));
      setGiven(savedState.given);
      const nb=savedState.noteBoard?.map(r=>r.map(c=>new Set(Array.isArray(c)?c:[...c])))||Array.from({length:9},()=>Array.from({length:9},()=>new Set()));
      setNoteBoard(nb);
      setTimer(savedState.timer||0);
      setMistakes(savedState.mistakes||0);
      setHints(savedState.hintsUsed||0);
      setRunning(true);setReady(true);
    }else{
      doStart(initDiff,1,120,initSeed!==null&&initSeed!==undefined?initSeed:undefined);
    }
  },[]);

  // Standard timer
  useEffect(()=>{
    if(isZen||isEndless||!running||won||over)return;
    const id=setInterval(()=>setTimer(v=>v+1),1000);
    return()=>clearInterval(id);
  },[isZen,isEndless,running,won,over]);

  // Zen timer (hidden)
  useEffect(()=>{
    if(!isZen||!running||won||over)return;
    const id=setInterval(()=>setTimer(v=>v+1),1000);
    return()=>clearInterval(id);
  },[isZen,running,won,over]);

  // Endless bank
  useEffect(()=>{
    if(!isEndless||!running||won||over)return;
    const id=setInterval(()=>setBank(b=>{if(b<=1){setRunning(false);setOver(true);return 0;}return b-1;}),1000);
    return()=>clearInterval(id);
  },[isEndless,running,won,over]);

  // Pause on hide
  useEffect(()=>{
    if(!settings.pauseOnHide)return;
    const fn=()=>{if(document.hidden)setRunning(false);else if(!won&&!over)setRunning(true);};
    document.addEventListener("visibilitychange",fn);
    return()=>document.removeEventListener("visibilitychange",fn);
  },[settings.pauseOnHide,won,over]);

  // Do Not Disturb — request notification suppression while in game
  useEffect(()=>{
    if(!settings.doNotDisturb)return;
    try{if("wakeLock" in navigator)navigator.wakeLock.request("screen").catch(()=>{});}catch{}
  },[settings.doNotDisturb]);

  // Save game
  useEffect(()=>{
    if(!board||!sol||won||over||isDaily||isEndless||isPractice||gameMode!=="standard")return;
    onSave&&onSave({difficulty:diff,solution:sol,userBoard:board,given,
      noteBoard:noteBoard?.map(r=>r.map(c=>[...c])),
      timer,mistakes,hintsUsed:hints,timestamp:Date.now()});
  },[board,timer,mistakes,hints]);

  // Keyboard
  useEffect(()=>{
    const h=e=>{
      if(won||over)return;
      if(e.key>="1"&&e.key<="9"){doNumber(parseInt(e.key));return;}
      if(["Backspace","Delete","0"].includes(e.key)){doNumber(0);return;}
      if(e.key==="n"){setNotes(n=>!n);return;}
      if(e.key==="z"&&(e.ctrlKey||e.metaKey)){doUndo();return;}
      if(sel){
        const[r,c]=sel;
        if(e.key==="ArrowUp"&&r>0)setSel([r-1,c]);
        if(e.key==="ArrowDown"&&r<8)setSel([r+1,c]);
        if(e.key==="ArrowLeft"&&c>0)setSel([r,c-1]);
        if(e.key==="ArrowRight"&&c<8)setSel([r,c+1]);
      }
    };
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[doNumber,doUndo,sel,won,over]);

  // ── Render ────────────────────────────────────
  if(!ready||!board||!sol||!given||!noteBoard)return(
    <div style={{position:"fixed",inset:0,background:gt.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{width:"min(80vw,280px)",display:"flex",flexDirection:"column",gap:10}}>
        {/* Skeleton grid */}
        <div style={{aspectRatio:"1/1",borderRadius:10,overflow:"hidden",border:`2px solid ${gt.brd}`,display:"grid",gridTemplateColumns:"repeat(9,1fr)",gridTemplateRows:"repeat(9,1fr)"}}>
          {Array.from({length:81},(_,i)=>{
            const r=Math.floor(i/9),c=i%9;
            const isBoxR=c===2||c===5,isBoxB=r===2||r===5;
            return<div key={i} style={{background:gt.bgIn,borderRight:c===8?"none":isBoxR?`2px solid ${gt.brd}`:`1px solid ${gt.brd}55`,borderBottom:r===8?"none":isBoxB?`2px solid ${gt.brd}`:`1px solid ${gt.brd}55`,animation:`plsL 1.4s ${(i%9)*0.04}s ease infinite`}}/>;
          })}
        </div>
        <div style={{fontSize:11,color:gt.mut,textAlign:"center",fontFamily:MONO,letterSpacing:"0.1em"}}>Generating puzzle…</div>
      </div>
    </div>
  );

  const sr=sel?.[0],sc=sel?.[1];
  const selBox=sel?[3*Math.floor(sr/3),3*Math.floor(sc/3)]:null;
  const selVal=sel?board[sr][sc]:0;
  const hintDis=won||over||(hintLim!==null&&hints>=hintLim);
  const badge=isDaily?"🗓️ DAILY":isZen?"🧘 ZEN":isFocus?"🎯 FOCUS":isEndless?`♾️ LV.${endLv}`:isPractice?"📚 PRACTICE":null;
  const aBt=(active,color)=>({flex:1,padding:"10px 2px",borderRadius:10,background:active?`${color}18`:gt.bgCard,border:`1.5px solid ${active?color:gt.brd}`,color:active?color:gt.mut,fontSize:"clamp(9px,2.3vw,11px)",fontWeight:700,fontFamily:MONO,letterSpacing:"0.03em",textTransform:"uppercase"});
  const isLandscape=typeof window!=="undefined"&&window.innerWidth>window.innerHeight&&window.innerWidth>600;

  return(
    <div style={{position:"fixed",inset:0,background:gt.bg,backgroundImage:settings.bgPhoto?`url(${settings.bgPhoto})`:"none",backgroundSize:"cover",backgroundPosition:"center",display:"flex",flexDirection:isLandscape?"row":"column",alignItems:"center",justifyContent:"flex-end",boxSizing:"border-box",fontFamily:MONO,color:gt.pri,touchAction:"manipulation",overflow:"hidden"}}>
      <style>{`@keyframes shk{0%{transform:translateX(0)}20%{transform:translateX(-3px)}40%{transform:translateX(3px)}60%{transform:translateX(-2px)}80%{transform:translateX(2px)}100%{transform:translateX(0)}} @keyframes plsL{0%,100%{opacity:1}50%{opacity:0.35}} @keyframes cfFall{0%{transform:translateY(-10px) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}} @keyframes cfSpin{0%{transform:translateY(-10px) rotate(0deg) scaleX(1);opacity:1}50%{transform:translateY(50vh) rotate(360deg) scaleX(-1);opacity:0.8}100%{transform:translateY(100vh) rotate(720deg) scaleX(1);opacity:0}}`}</style>

      {/* AD BANNER — absolute at top, content flows below independently */}
      {!isLandscape&&!settings._noAds&&<div style={{position:"absolute",top:0,left:0,right:0,height:"calc(max(env(safe-area-inset-top),0px) + 50px)",background:gt.bgCard,borderBottom:`1px solid ${gt.brd}`,display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:8,zIndex:10}}>
        {/* Ad banner slot */}
      </div>}

      {/* Top bar */}
      <div style={{width:"100%",maxWidth:460,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,padding:"8px 12px 4px"}}>
        <Btn onTap={()=>{if(!won&&!over){setPaused(true);setRunning(false);}else{onHome();}}} style={{background:gt.bgCard,border:`1.5px solid ${gt.brdM}`,borderRadius:8,color:gt.sec,fontFamily:MONO,fontSize:11,letterSpacing:"0.05em",padding:"6px 10px"}}>⌂ Home</Btn>
        <div style={{textAlign:"center"}}>
          {badge&&<div style={{fontSize:8,letterSpacing:"0.3em",color:`${acc}cc`,marginBottom:1,textTransform:"uppercase"}}>{badge}</div>}
          <div style={{fontSize:"clamp(12px,3.5vw,15px)",fontWeight:700,fontFamily:SERIF,color:gt.pri,letterSpacing:"0.08em"}}>SUDOKU FLOW</div>
          {isEndless&&<div style={{fontSize:8,color:gt.mut}}>BANK: {fmt(bank)}</div>}
        </div>
        <div style={{textAlign:"right",minWidth:70}}>
          {!isZen&&settings.timerMode!=="hidden"&&(()=>{
            const cd=settings.timerMode==="down";
            const display=cd?Math.max(0,(settings.countdownFrom||600)-timer):timer;
            const isLow=cd&&display<=30;
            return<div style={{fontSize:"clamp(13px,3.5vw,16px)",fontWeight:700,color:isLow?gt.err:gt.pri,marginBottom:4}}>{cd&&"−"}{fmt(display)}</div>;
          })()}
          {isZen&&<div style={{fontSize:13,color:gt.mut,marginBottom:4}}>∞</div>}
          {!isFocus&&!isZen&&!isPractice&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
              <div style={{display:"flex",gap:5}}>
                {[1,2,3].map(i=><div key={i} style={{width:11,height:11,borderRadius:"50%",background:settings.highlightMistakes?(i<=mistakes?gt.err:gt.brd):gt.brd,boxShadow:settings.highlightMistakes&&i<=mistakes?`0 0 8px ${gt.err}`:"none",animation:settings.highlightMistakes&&i===mistakes&&mistakes>0?"shk .35s ease":"none"}}/>)}
              </div>
              <div style={{fontSize:11,fontWeight:700,color:settings.highlightMistakes&&mistakes>0?gt.err:gt.mut,fontFamily:MONO}}>{settings.highlightMistakes?`${mistakes}/3 err`:"? /3 err"}</div>
            </div>
          )}
          {isFocus&&<div style={{fontSize:10,color:gt.err,marginTop:2,fontWeight:700,fontFamily:MONO}}>ZERO TOL.</div>}
        </div>
      </div>

      {/* Board — fills available space between top bar and controls */}
      <div style={{position:"relative",width:isLandscape?"min(96vh,calc(100vh - 20px))":"min(96vw,calc(100vh - 280px))",height:isLandscape?"min(96vh,calc(100vh - 20px))":"min(96vw,calc(100vh - 280px))",flexShrink:0,margin:isLandscape?"0 12px":"4px 0"}}>
        {/* Col indicators */}
        <div style={{position:"absolute",top:-13,left:0,right:0,display:"grid",gridTemplateColumns:"repeat(9,1fr)"}}>
          {[0,1,2,3,4,5,6,7,8].map(c=><div key={c} style={{display:"flex",justifyContent:"center",alignItems:"center",height:11}}>{sc===c&&<div style={{width:12,height:3,borderRadius:2,background:acc,opacity:0.75}}/>}</div>)}
        </div>
        {/* Row indicators */}
        <div style={{position:"absolute",top:0,bottom:0,left:-13,display:"grid",gridTemplateRows:"repeat(9,1fr)"}}>
          {[0,1,2,3,4,5,6,7,8].map(r=><div key={r} style={{display:"flex",justifyContent:"center",alignItems:"center",width:11}}>{sr===r&&<div style={{width:3,height:12,borderRadius:2,background:acc,opacity:0.75}}/>}</div>)}
        </div>
        {/* Grid */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(9,1fr)",gridTemplateRows:"repeat(9,1fr)",width:"100%",height:"100%",borderRadius:8,overflow:"hidden",border:`2px solid ${gt.brdM}`,boxSizing:"border-box",position:"relative",...(settings.boardReward?getRewardStyle(settings.boardReward,acc):{boxShadow:`0 8px 32px rgba(0,0,0,0.18)`})}}>
          {board.map((row,r)=>row.map((val,c)=>{
            const ck=`${r}-${c}`;
            const isSel=sr===r&&sc===c;
            const inGrp=sr!==undefined&&(sr===r||sc===c||(selBox&&r>=selBox[0]&&r<selBox[0]+3&&c>=selBox[1]&&c<selBox[1]+3));
            const same=settings.highlightSame&&selVal!==0&&val===selVal;
            const isFlsh=!!flash[ck]&&settings.highlightMistakes;
            const isFad=!!flash[ck]&&flash[ck].fad;
            const isGiv=given[r][c];
            const isOk=val!==0&&!isGiv&&!isFlsh&&val===sol[r][c];
            const cn=noteBoard[r][c];
            const isHinted=smartH&&smartH.r===r&&smartH.c===c;
            const boxIdx=Math.floor(r/3)*3+Math.floor(c/3);
            const isPls=pulse.rows.has(r)||pulse.cols.has(c)||pulse.boxes.has(boxIdx);
            const isBoxR=c===2||c===5;
            const isBoxB=r===2||r===5;
            const isNumHigh=!sel&&numHigh!==null&&val===numHigh;
            const isHighlighted=isSel||isNumHigh||same||inGrp;
            let bg=gt.bgIn;
            if(isSel||isNumHigh)bg=gt.bgCard; // solid base + accent border handled by outline
            else if(isFlsh)bg=`${gt.err}22`;
            else if(isHinted)bg=`${acc}28`;
            else if(same)bg=gt.bgCard;
            else if(inGrp)bg=gt.bgHov;
            // For highlighted cells always show solid bg — for plain cells respect opacity slider
            const cellOpacity=(settings.boardOpacity??100)/100;
            const applyBgOnly=settings.opacityBgOnly!==false;
            const overlayOpacity=applyBgOnly?(isHighlighted||isFlsh||isHinted?1:cellOpacity):1;
            const nc=isFlsh?gt.err:isGiv?gt.giv:isOk?gt.ok:gt.usr;
            // Accent overlay for selected/highlighted on top of solid bg
            const accentOverlay=isSel||isNumHigh?`${acc}55`:same?`${acc}33`:inGrp?`${acc}18`:null;
            return(
              <div key={ck}
                onTouchEnd={e=>{e.preventDefault();if(won||over)return;
                  if(settings.singleTapClear&&sel&&sr===r&&sc===c&&!isGiv&&val!==0){doNumber(0);return;}
                  if(sel&&sr===r&&sc===c){setSel(null);setNumHigh(null);return;}
                  if(!sel&&val!==0){setNumHigh(v=>v===val?null:val);return;}
                  setNumHigh(null);setSel([r,c]);}}
                onClick={()=>{if(won||over)return;
                  if(settings.singleTapClear&&sel&&sr===r&&sc===c&&!isGiv&&val!==0){doNumber(0);return;}
                  if(sel&&sr===r&&sc===c){setSel(null);setNumHigh(null);return;}
                  if(!sel&&val!==0){setNumHigh(v=>v===val?null:val);return;}
                  setNumHigh(null);setSel([r,c]);}}
                style={{
                  display:"flex",alignItems:"center",justifyContent:"center",
                  background:"transparent",
                  opacity:applyBgOnly?1:cellOpacity,
                  boxSizing:"border-box",position:"relative",
                  borderRight:c===8?"none":isBoxR?`2px solid ${gt.brdM}`:`1px solid ${gt.brd}`,
                  borderBottom:r===8?"none":isBoxB?`2px solid ${gt.brdM}`:`1px solid ${gt.brd}`,
                  WebkitTapHighlightColor:"transparent",transition:"opacity .12s",
                  animation:isPls?"plsL .65s ease":"none"}}>
                {/* Solid bg overlay — plain cells respect opacity, highlighted always opaque */}
                <div style={{position:"absolute",inset:0,background:bg,opacity:overlayOpacity,pointerEvents:"none",transition:"background .12s,opacity .12s"}}/>
                {/* Accent tint on top of solid bg for selection/highlights */}
                {accentOverlay&&<div style={{position:"absolute",inset:0,background:accentOverlay,pointerEvents:"none"}}/>}
                {val!==0
                  ?<span style={{fontSize:numSz,fontWeight:600,color:nc,fontFamily:activeNumFont,fontVariantNumeric:"tabular-nums",lineHeight:1,opacity:isFad?0:1,transition:"opacity .6s",animation:isFlsh&&!isFad?"shk .35s ease":"none",display:"block",textAlign:"center",width:"100%",position:"relative",zIndex:1}}>
                      {val}
                      {settings.colorblind&&isFlsh&&<span style={{position:"absolute",top:-2,right:-4,fontSize:"clamp(7px,1.5vw,9px)",color:gt.err,fontWeight:900}}>✕</span>}
                    </span>
                  :cn&&cn.size>0
                    ?<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",width:"100%",height:"100%",position:"relative",zIndex:1}}>
                        {[1,2,3,4,5,6,7,8,9].map(n=><div key={n} style={{fontSize:noteSz,color:cn.has(n)?gt.acc:"transparent",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>{n}</div>)}
                      </div>
                    :null}
              </div>
            );
          }))}
        </div>
      </div>

      {/* Controls column — vertical in portrait, right-side column in landscape */}
      <div style={{display:"flex",flexDirection:"column",gap:isLandscape?8:0,alignItems:"center",justifyContent:isLandscape?"center":"flex-start",flexShrink:0,width:isLandscape?"min(44vw,320px)":"min(96vw,440px)",padding:isLandscape?"12px 8px":`0 0 max(env(safe-area-inset-bottom),12px)`}}>

      {/* Number pad */}
      <div style={{display:"flex",gap:"clamp(3px,1.2vw,6px)",width:"100%",flexShrink:0,padding:"0 4px"}}>
        {[1,2,3,4,5,6,7,8,9].map(n=>{
          const cnt=board.flat().filter(v=>v===n).length;
          const done=cnt>=9;
          const isHighBtn=!sel&&numHigh===n;
          return(
            <Btn key={n} onTap={()=>{}} disabled={done||won||over}
              style={{flex:1,aspectRatio:"0.88",border:`1.5px solid ${done?gt.brd:isHighBtn?acc:notes?acc:gt.brdM}`,borderRadius:10,background:done?gt.bg:isHighBtn?`${acc}28`:notes?`${acc}10`:gt.bgCard,color:done?gt.ghost:gt.pri,fontSize:padSz,fontWeight:600,fontFamily:activeNumFont,fontVariantNumeric:"tabular-nums",position:"relative",display:"flex",alignItems:"center",justifyContent:"center",minWidth:0}}
              onTouchStart={e=>{e.stopPropagation();if(!done&&!won&&!over){lpTimers.current[n]=setTimeout(()=>{setNotes(p=>!p);vib([20]);lpTimers.current[n]=null;},420);}}}
              onTouchEnd={e=>{e.preventDefault();e.stopPropagation();if(!done&&!won&&!over){if(lpTimers.current[n]){clearTimeout(lpTimers.current[n]);lpTimers.current[n]=null;
                if(sel){doNumber(n);}else{setNumHigh(v=>v===n?null:n);}
              }}}}
              onMouseDown={e=>{e.stopPropagation();if(!done&&!won&&!over){lpTimers.current[n]=setTimeout(()=>{setNotes(p=>!p);lpTimers.current[n]=null;},420);}}}
              onMouseUp={e=>{e.stopPropagation();if(!done&&!won&&!over&&lpTimers.current[n]){clearTimeout(lpTimers.current[n]);lpTimers.current[n]=null;
                if(sel){doNumber(n);}else{setNumHigh(v=>v===n?null:n);}
              }}}>
              {n}
              {!done&&<span style={{position:"absolute",bottom:2,right:3,fontSize:"clamp(6px,1.4vw,8px)",color:gt.mut,lineHeight:1}}>{9-cnt}</span>}
            </Btn>
          );
        })}
        <Btn onTap={()=>{if(sel)doNumber(0);else{setSel(null);setNumHigh(null);}}} disabled={won||over} style={{flex:1,aspectRatio:"0.88",border:`1.5px solid ${gt.brdM}`,borderRadius:10,background:gt.bgCard,color:gt.mut,fontSize:"clamp(14px,4vw,20px)",display:"flex",alignItems:"center",justifyContent:"center",minWidth:0}}>⌫</Btn>
      </div>

      {/* Actions — icon on top, label below */}
      <div style={{display:"flex",gap:"clamp(3px,1.2vw,6px)",width:"100%",flexShrink:0,paddingBottom:"max(env(safe-area-inset-bottom),10px)",padding:`0 4px max(env(safe-area-inset-bottom),10px)`,marginTop:6}}>
        <Btn onTap={()=>setNotes(n=>!n)} disabled={won||over} style={{flex:1,padding:"8px 2px",borderRadius:10,background:notes?`${acc}18`:gt.bgCard,border:`1.5px solid ${notes?acc:gt.brd}`,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
          <span style={{fontSize:14}}>✎</span>
          <span style={{fontSize:"clamp(8px,2vw,10px)",fontWeight:700,fontFamily:MONO,color:notes?acc:gt.mut}}>Notes</span>
        </Btn>
        <Btn onTap={()=>doNumber(0)} disabled={won||over} style={{flex:1,padding:"8px 2px",borderRadius:10,background:gt.bgCard,border:`1.5px solid ${gt.brd}`,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
          <span style={{fontSize:14}}>⌫</span>
          <span style={{fontSize:"clamp(8px,2vw,10px)",fontWeight:700,fontFamily:MONO,color:gt.mut}}>Erase</span>
        </Btn>
        <Btn onTap={doUndo} disabled={!undos.length||won||over} style={{flex:1,padding:"8px 2px",borderRadius:10,background:gt.bgCard,border:`1.5px solid ${gt.brd}`,display:"flex",flexDirection:"column",alignItems:"center",gap:2,opacity:undos.length?1:0.38}}>
          <span style={{fontSize:14}}>↩</span>
          <span style={{fontSize:"clamp(8px,2vw,10px)",fontWeight:700,fontFamily:MONO,color:gt.mut}}>Undo</span>
        </Btn>
        <Btn onTap={()=>{
          if(hintDis)return;
          if(effDiff==="very hard"&&!vhPend){setVhPend(true);setTimeout(()=>setVhPend(false),3500);return;}
          setVhPend(false);doHint();
        }} disabled={hintDis} style={{flex:1,padding:"8px 2px",borderRadius:10,background:vhPend?`#f43f5e18`:gt.bgCard,border:`1.5px solid ${vhPend?"#f43f5e":gt.brd}`,display:"flex",flexDirection:"column",alignItems:"center",gap:2,opacity:hintDis&&hintLim!==null?0.38:1}}>
          <span style={{fontSize:14}}>{vhPend?"❓":"💡"}</span>
          <span style={{fontSize:"clamp(8px,2vw,10px)",fontWeight:700,fontFamily:MONO,color:vhPend?"#f43f5e":gt.mut}}>{vhPend?"Sure?":hintLim!==null?`Hint ${Math.max(0,hintLim-hints)}`:"Hint"}</span>
        </Btn>
        {!isDaily&&!isEndless&&!isPractice&&(
          <Btn onTap={()=>{
            if(!newPend){setNewPend(true);setTimeout(()=>setNewPend(false),3000);return;}
            setNewPend(false);doStart(diff,1,120);
          }} style={{flex:1,padding:"8px 2px",borderRadius:10,background:newPend?`#f59e0b18`:gt.bgCard,border:`1.5px solid ${newPend?"#f59e0b":gt.brd}`,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <span style={{fontSize:14}}>{newPend?"❓":"↺"}</span>
            <span style={{fontSize:"clamp(8px,2vw,10px)",fontWeight:700,fontFamily:MONO,color:newPend?"#f59e0b":gt.mut}}>{newPend?"Sure?":"New"}</span>
          </Btn>
        )}
        {!isDaily&&!isEndless&&activeSeed!==null&&(
          <Btn onTap={()=>{
            const code=encodeShare(diff,activeSeed);
            try{navigator.clipboard.writeText(code);}catch{}
            setShareMsg(code);setTimeout(()=>setShareMsg(null),3500);
          }} style={{flex:1,padding:"8px 2px",borderRadius:10,background:shareMsg?`${acc}18`:gt.bgCard,border:`1.5px solid ${shareMsg?acc:gt.brd}`,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <span style={{fontSize:14}}>{shareMsg?"✓":"⬆"}</span>
            <span style={{fontSize:"clamp(8px,2vw,10px)",fontWeight:700,fontFamily:MONO,color:shareMsg?acc:gt.mut}}>{shareMsg?"Copied":"Share"}</span>
          </Btn>
        )}
      </div>

      {/* End controls column */}
      </div>

      {shareMsg&&(
        <div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",zIndex:200,background:gt.bgCard,border:`1.5px solid ${acc}`,borderRadius:14,padding:"12px 18px",textAlign:"center",boxShadow:`0 0 24px ${acc}44`,minWidth:220}}>
          <div style={{fontSize:9,color:acc,letterSpacing:"0.2em",fontFamily:MONO,marginBottom:6}}>SHARE CODE COPIED</div>
          <div style={{fontSize:22,fontWeight:700,fontFamily:MONO,letterSpacing:"0.2em",color:gt.pri}}>{shareMsg}</div>
          <div style={{fontSize:9,color:gt.mut,marginTop:5}}>Send to a friend · they’ll get the exact same puzzle</div>
        </div>
      )}

      {smartH&&<HintOverlay hint={smartH} onPlace={applyHint} onDismiss={()=>setSmartH(null)} t={gt}/>}

      {/* Confetti */}
      {confetti.map(p=>(
        <div key={p.id} style={{position:"fixed",top:0,left:`${p.x}%`,width:p.size,height:p.size,borderRadius:p.spin?0:p.size/2,background:p.color,zIndex:150,pointerEvents:"none",animation:`${p.spin?"cfSpin":"cfFall"} ${p.duration}s ${p.delay}s ease-in forwards`,opacity:0.85}}/>
      ))}

      {/* Win overlay */}
      {won&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,backdropFilter:"blur(8px)",padding:20,animation:"pgIn 320ms cubic-bezier(0.22,1,0.36,1) both"}}>
          <div style={{background:gt.bgCard,border:`2px solid ${acc}`,borderRadius:20,padding:"28px 20px",textAlign:"center",boxShadow:`0 0 80px ${acc}40`,width:"min(92vw,360px)",animation:"winCard 380ms cubic-bezier(0.34,1.56,0.64,1) both"}}>
            <style>{`@keyframes winCard{from{opacity:0;transform:scale(0.82) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
            <div style={{fontSize:48,marginBottom:8,animation:"winIcon 400ms 200ms cubic-bezier(0.34,1.56,0.64,1) both"}}><style>{`@keyframes winIcon{from{transform:scale(0) rotate(-20deg)}to{transform:scale(1) rotate(0)}}`}</style>
              {nav?.mode==="weekly"?"🏅":isDaily?"🏆":isZen?"🧘":isFocus?"🎯":isEndless?"♾️":"🎉"}
            </div>
            <div style={{fontSize:"clamp(18px,5vw,24px)",fontWeight:700,color:acc,fontFamily:SERIF,marginBottom:6}}>
              {nav?.mode==="weekly"?"Weekly Complete!":isDaily?"Daily Complete!":isZen?"Zen Complete":isFocus?"Focus: Perfect!":isEndless?`Level ${endLv} Clear!`:"Solved!"}
            </div>
            {!isZen&&<div style={{color:gt.sec,fontSize:12,marginBottom:4}}>{fmt(timer)}</div>}
            {mistakes===0?<div style={{color:"#4ade80",fontSize:11,marginBottom:4}}>{settings.colorblind?"✓ ":""}✨ Flawless!</div>
              :<div style={{color:gt.err,fontSize:11,marginBottom:4}}>{mistakes} mistake{mistakes!==1?"s":""}</div>}
            {isDaily&&(()=>{
              const goals=getDailyGoals(todayStr());
              const earned=DAILY_GOALS.filter(g=>goals[g.id]);
              const nextH=23-new Date().getHours();const nextM=59-new Date().getMinutes();
              return earned.length>0?(
                <div style={{marginBottom:6}}>
                  <div style={{fontSize:8,color:"#f59e0b",letterSpacing:"0.15em",marginBottom:4}}>GOALS COMPLETED</div>
                  <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                    {earned.map(g=><span key={g.id} title={g.label} style={{fontSize:18}}>{g.icon}</span>)}
                  </div>
                  <div style={{fontSize:8,color:gt.mut,marginTop:5}}>Next puzzle in {nextH}h {nextM}m</div>
                </div>
              ):<div style={{fontSize:8,color:gt.mut,marginBottom:4}}>Next puzzle in {nextH}h {nextM}m</div>;
            })()}
            {/* Puzzle Rating */}
            <div style={{marginTop:12,marginBottom:4}}>
              <div style={{fontSize:9,color:gt.mut,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:8,fontFamily:MONO}}>Rate this puzzle</div>
              <div style={{display:"flex",justifyContent:"center",gap:8}}>
                {[1,2,3,4,5].map(star=>(
                  <Btn key={star} onTap={()=>setPuzzleRating(star)}
                    style={{fontSize:26,background:"transparent",border:"none",padding:"2px 4px",transform:star<=puzzleRating?"scale(1.15)":"scale(1)",transition:"transform .15s"}}>
                    {star<=puzzleRating?"⭐":"☆"}
                  </Btn>
                ))}
              </div>
              {puzzleRating>0&&<div style={{fontSize:9,color:gt.mut,marginTop:4,fontFamily:MONO}}>{["","Too easy","A bit easy","Just right","Challenging","Very hard!"][puzzleRating]}</div>}
            </div>
            {isEndless&&(
              <Btn onTap={()=>{const nl=endLv+1,bonus=Math.max(0,90-timer);doStart(EDIFFS[Math.min(nl-1,EDIFFS.length-1)],nl,bank+bonus);}}
                style={{width:"100%",padding:"12px",borderRadius:10,border:`1.5px solid ${acc}`,background:`${acc}18`,color:acc,fontSize:12,fontWeight:700,fontFamily:MONO,letterSpacing:"0.05em",marginTop:12}}>
                Level {endLv+1} (+{Math.max(0,90-timer)}s) →
              </Btn>
            )}
            {!isEndless&&!isDaily&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginTop:12}}>
                {DIFFS.map(d=>(
                  <Btn key={d} onTap={()=>doStart(d,1,120)} style={{padding:"10px 6px",borderRadius:10,border:`1.5px solid ${DCOL[d]}`,background:d===effDiff?`${DCOL[d]}20`:"transparent",color:DCOL[d],fontSize:10,fontWeight:700,fontFamily:MONO,letterSpacing:"0.04em",textTransform:"uppercase"}}>{DLBL[d]}</Btn>
                ))}
              </div>
            )}
            <div style={{display:"flex",gap:7,marginTop:10}}>
              <Btn onTap={()=>{
                // Build spoiler-free emoji grid — green=given, blue=solved, grey=empty(shouldn't happen)
                const rows=board.map((row,r)=>row.map((val,c)=>{
                  if(given[r][c])return"⬛";
                  if(val===sol[r][c])return"🟩";
                  return"⬜";
                }).join("")).join("\n");
                const modeLbl=isDaily?"Daily":isZen?"Zen":isFocus?"Focus":isEndless?`Endless Lv.${endLv}`:DLBL[effDiff]||effDiff;
                const mistakeLbl=mistakes===0?"✨ Flawless":`${mistakes} mistake${mistakes!==1?"s":""}`;
                const timeLbl=isZen?"":` · ${fmt(timer)}`;
                const text=`Sudoku Flow — ${modeLbl}\n${mistakeLbl}${timeLbl}\n\n${rows}\n\nPlay at sudokuflow.app`;
                try{navigator.clipboard.writeText(text);}catch{}
                setShareResult("copied");
                setTimeout(()=>setShareResult(null),2500);
              }} style={{flex:1,padding:"10px",borderRadius:10,border:`1.5px solid ${acc}`,background:`${acc}18`,color:acc,fontSize:11,fontWeight:700,fontFamily:MONO,letterSpacing:"0.04em"}}>
                {shareResult==="copied"?"✓ Copied!":"⬆ Share Result"}
              </Btn>
              <Btn onTap={onHome} style={{flex:1,padding:"10px",borderRadius:10,border:`1.5px solid ${gt.brd}`,background:"transparent",color:gt.mut,fontSize:11,fontWeight:700,fontFamily:MONO,letterSpacing:"0.05em"}}>⌂ Home</Btn>
            </div>
          </div>
        </div>
      )}

      {over&&<GameOver t={gt} diff={effDiff} mode={isFocus?"focus":isEndless?"endless":"standard"} onRetry={()=>doStart(initDiff,1,120)} onHome={onHome}/>}

      {/* Pause overlay */}
      {paused&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:150,padding:20}}>
          <div style={{background:gt.bgCard,border:`2px solid ${gt.brdM}`,borderRadius:20,padding:"28px 20px",textAlign:"center",width:"min(92vw,320px)"}}>
            <div style={{fontSize:36,marginBottom:8}}>⏸</div>
            <div style={{fontSize:18,fontWeight:700,color:gt.pri,fontFamily:SERIF,marginBottom:4}}>Paused</div>
            <div style={{fontSize:11,color:gt.mut,fontFamily:MONO,marginBottom:20}}>{fmt(timer)} elapsed</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <Btn onTap={()=>{setPaused(false);setRunning(true);}} style={{width:"100%",padding:"13px",borderRadius:12,background:acc,border:"none",color:"#fff",fontSize:13,fontWeight:700,fontFamily:MONO,letterSpacing:"0.04em"}}>▶ Resume</Btn>
              <Btn onTap={()=>{setPaused(false);onHome();}} style={{width:"100%",padding:"11px",borderRadius:12,background:"transparent",border:`1.5px solid ${gt.brd}`,color:gt.mut,fontSize:12,fontWeight:700,fontFamily:MONO}}>⌂ Quit to Home</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Offline indicator */}
      <OfflineToast t={gt}/>
    </div>
  );
}

// ─────────────────────────────────────────────
// PERSONAL BESTS SCREEN
// ─────────────────────────────────────────────
function PersonalBests({t,stats,onBack}){
  const [vis,setVis]=useState(false);
  useEffect(()=>{const id=setTimeout(()=>setVis(true),40);return()=>clearTimeout(id);},[]);
  const an=d=>({opacity:vis?1:0,transform:vis?"none":`translateY(${10+d*4}px)`,transition:`opacity .38s ${d*.07}s,transform .38s ${d*.07}s`});

  const rows=[
    ...DIFFS.map((d,i)=>({key:d,label:DLBL[d],color:DCOL[d],data:stats?.[d],i})),
    {key:"daily",label:"Daily",color:"#f59e0b",data:stats?.daily,i:4},
  ];

  const BestCell=({label,val,sub,color,empty})=>(
    <div style={{background:t.bgCard,border:`1.5px solid ${empty?t.brd:color+"55"}`,borderRadius:11,padding:"10px 10px",textAlign:"center",flex:1,minWidth:0,opacity:empty?0.4:1}}>
      {empty
        ?<div style={{fontSize:10,color:t.ghost,fontFamily:MONO}}>—</div>
        :<>
          <div style={{fontSize:"clamp(14px,4vw,19px)",fontWeight:700,fontFamily:SERIF,color,lineHeight:1}}>{val}</div>
          {sub&&<div style={{fontSize:7,color:t.mut,marginTop:3,letterSpacing:"0.04em"}}>{sub}</div>}
        </>}
      <div style={{fontSize:8,color:t.mut,marginTop:sub?2:4,letterSpacing:"0.04em",textTransform:"uppercase"}}>{label}</div>
    </div>
  );

  return(
    <div style={{height:"100dvh",width:"100vw",background:t.bg,display:"flex",flexDirection:"column",padding:"max(env(safe-area-inset-top),14px) 18px max(env(safe-area-inset-bottom),20px)",boxSizing:"border-box",fontFamily:MONO,color:t.pri,overflow:"hidden"}}>
      <Btn onTap={onBack} style={{background:t.bgHov,color:t.sec,fontSize:13,fontWeight:600,padding:"6px 12px",borderRadius:8,border:`1px solid ${t.brdM}`,marginBottom:8,alignSelf:"flex-start",letterSpacing:"0.01em",display:"flex",alignItems:"center",gap:4}}>‹ Back</Btn>
      <div style={{fontSize:"clamp(20px,5.5vw,26px)",fontWeight:700,fontFamily:SERIF,marginBottom:4,opacity:vis?1:0,transition:"opacity .4s"}}>Personal Bests</div>
      <div style={{fontSize:9,color:t.mut,letterSpacing:"0.08em",marginBottom:14,opacity:vis?1:0,transition:"opacity .4s .1s"}}>Your fastest solves and cleanest runs</div>
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:10}}>
        {rows.map(({key,label,color,data,i})=>{
          const wins=data?.wins||[];
          const fastestWin=wins.reduce((b,w)=>(!b||w.time<b.time)?w:b,null);
          const cleanestWin=wins.filter(w=>w.mistakes===0).reduce((b,w)=>(!b||w.time<b.time)?w:b,null);
          const leastMistakes=wins.length?Math.min(...wins.map(w=>w.mistakes||0)):null;
          const avgT=wins.length?Math.round(wins.reduce((s,w)=>s+w.time,0)/wins.length):null;
          const trend=trendArrow(wins);
          return(
            <div key={key} style={{...an(i)}}>
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:color,boxShadow:`0 0 8px ${color}88`}}/>
                <div style={{fontSize:"clamp(13px,3.5vw,15px)",fontWeight:700,color,fontFamily:MONO,letterSpacing:"0.04em"}}>{label}</div>
                {wins.length>=6&&<div style={{fontSize:11,color:trend.color,marginLeft:2}} title={trend.label}>{trend.arrow} {trend.label}</div>}
                {data?.w>0&&<div style={{marginLeft:"auto",fontSize:9,color:t.mut}}>{data.w} wins</div>}
              </div>
              <div style={{display:"flex",gap:6}}>
                <BestCell label="Best Time" val={data?.best!=null?fmt(data.best):null} color={color} empty={data?.best==null}/>
                <BestCell label="Fastest Clean" val={cleanestWin?fmt(cleanestWin.time):null} sub="0 mistakes" color="#4ade80" empty={!cleanestWin}/>
                <BestCell label="Least ✗" val={leastMistakes!==null?leastMistakes:null} sub={leastMistakes===0?"flawless!":undefined} color={leastMistakes===0?"#4ade80":"#f97316"} empty={leastMistakes===null||!wins.length}/>
                <BestCell label="Avg Time" val={avgT!==null?fmt(avgT):null} color={t.sec} empty={avgT===null}/>
              </div>
            </div>
          );
        })}
        {/* Global bests summary */}
        <div style={{...an(5),marginTop:4}}>
          <div style={{fontSize:9,color:t.mut,letterSpacing:"0.2em",marginBottom:8,textTransform:"uppercase"}}>All-Time</div>
          <div style={{display:"flex",gap:6}}>
            <BestCell label="Win Streak" val={stats?.bWStreak||0} color={t.acc} empty={!stats?.bWStreak}/>
            <BestCell label="Daily Streak" val={stats?.bDStreak||0} color="#f59e0b" empty={!stats?.bDStreak}/>
            <BestCell label="Endless Best" val={stats?.endlessBest||0} sub="highest level" color="#a78bfa" empty={!stats?.endlessBest}/>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────
const DEF_SET={theme:"midnight",dark:true,dynamicTheme:false,highlightMistakes:true,autoNotes:true,highlightSame:true,timerMode:"up",countdownFrom:600,pauseOnHide:true,soundOn:true,hapticsOn:true,allowBgAudio:false,singleTapClear:false,textSize:"medium",colorblind:false,boardReward:null,doNotDisturb:false,numFont:"rounded",bgPhoto:null,boardOpacity:100,opacityBgOnly:true};

// ─────────────────────────────────────────────
// STORE SCREEN
// ─────────────────────────────────────────────
function Store({t,onBack,onPurchase}){
  const [purchases,setPurchases]=useState(()=>getPurchases());
  const [tab,setTab]=useState("themes");
  const owned=getOwnedPremiumThemes();
  const spent=getSpentOnThemes();
  const bundlePrice=Math.max(0,FULL_BUNDLE_PRICE-spent).toFixed(2);
  const themeOnlyPrice=Math.max(0,BUNDLE_THEME_PRICE-spent).toFixed(2);

  const mockBuy=(type,id)=>{
    // In production replace with Stripe payment link
    // For now simulate purchase for testing
    const p={...getPurchases()};
    if(type==="theme"){p.themes=[...(p.themes||[]),id];}
    else if(type==="allThemes"){p.allThemes=true;}
    else if(type==="noAds"){p.noAds=true;}
    else if(type==="full"){p.allThemes=true;p.noAds=true;}
    savePurchases(p);
    setPurchases({...p});
    onPurchase(p);
  };

  const PriceBadge=({price,crossed})=>(
    <div style={{display:"flex",alignItems:"center",gap:4}}>
      {crossed&&<span style={{fontSize:10,color:t.mut,textDecoration:"line-through",fontFamily:MONO}}>{"$"}{crossed}</span>}
      <span style={{fontSize:13,fontWeight:800,color:t.acc,fontFamily:MONO}}>{"$"}{price}</span>
    </div>
  );

  return(
    <div style={{position:"fixed",inset:0,background:t.bg,display:"flex",flexDirection:"column",padding:"max(env(safe-area-inset-top),14px) 0 max(env(safe-area-inset-bottom),16px)",boxSizing:"border-box",fontFamily:MONO,color:t.pri,overflow:"hidden"}}>
      <div style={{padding:"0 18px",marginBottom:8}}>
        <Btn onTap={onBack} style={{background:t.bgHov,color:t.sec,fontSize:13,fontWeight:600,padding:"6px 12px",borderRadius:8,border:`1px solid ${t.brdM}`,alignSelf:"flex-start",display:"flex",alignItems:"center",gap:4}}>‹ Back</Btn>
      </div>
      <div style={{padding:"0 18px",marginBottom:12}}>
        <div style={{fontSize:"clamp(22px,6vw,28px)",fontWeight:700,fontFamily:SERIF}}>Shop</div>
        <div style={{fontSize:11,color:t.mut,marginTop:2}}>Unlock themes and remove ads</div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:6,padding:"0 18px",marginBottom:12}}>
        {[["themes","🎨 Themes"],["perks","⚡ Perks"],["bundles","💎 Bundles"]].map(([id,lbl])=>(
          <Btn key={id} onTap={()=>setTab(id)} style={{flex:1,padding:"8px 4px",borderRadius:10,background:tab===id?`${t.acc}22`:"transparent",border:`1.5px solid ${tab===id?t.acc:t.brd}`,color:tab===id?t.acc:t.mut,fontSize:"clamp(9px,2.3vw,10px)",fontWeight:700}}>{lbl}</Btn>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"0 18px 16px",display:"flex",flexDirection:"column",gap:8}}>

        {tab==="themes"&&<>
          <div style={{fontSize:9,color:t.mut,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:4}}>Premium Themes — $0.59 each</div>
          {owned.length>0&&<div style={{fontSize:10,color:t.acc,fontFamily:MONO,marginBottom:4}}>✓ You own {owned.length}/12 premium themes · ${spent.toFixed(2)} spent</div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {PREMIUM_THEMES.map(id=>{
              const th=THEMES[id];
              const pal=th.dark;
              const isOwned=purchases.allThemes||purchases.themes?.includes(id);
              return(
                <div key={id} style={{borderRadius:14,overflow:"hidden",border:`2px solid ${isOwned?t.acc:t.brd}`,background:pal.bg,display:"flex",flexDirection:"column"}}>
                  {/* Mini grid preview */}
                  <div style={{padding:"10px 8px 6px",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:3}}>
                    {[...Array(9)].map((_,i)=><div key={i} style={{aspectRatio:"1",borderRadius:3,background:i===4?pal.acc:i%2===0?pal.bgIn:pal.bgHov,border:`1px solid ${pal.brd}55`}}/>)}
                  </div>
                  <div style={{padding:"4px 8px 10px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div>
                      <div style={{fontSize:11,color:pal.acc,fontWeight:700}}>{th.emoji} {th.name}</div>
                    </div>
                    {isOwned
                      ?<span style={{fontSize:10,color:t.acc,fontWeight:700}}>✓ Owned</span>
                      :<Btn onTap={()=>mockBuy("theme",id)} style={{padding:"4px 10px",borderRadius:8,background:`${pal.acc}22`,border:`1px solid ${pal.acc}`,color:pal.acc,fontSize:10,fontWeight:700}}>$0.59</Btn>
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </>}

        {tab==="perks"&&<>
          <div style={{fontSize:9,color:t.mut,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:4}}>One-time purchases</div>
          {/* No Ads */}
          <div style={{background:t.bgCard,border:`1.5px solid ${purchases.noAds?"#4ade80":t.brd}`,borderRadius:14,padding:"16px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:t.pri}}>🚫 Remove Ads</div>
                <div style={{fontSize:10,color:t.mut,marginTop:3,lineHeight:1.5}}>No banners, no interruptions. Ever.</div>
              </div>
              {purchases.noAds
                ?<span style={{fontSize:11,color:"#4ade80",fontWeight:700}}>✓ Active</span>
                :<PriceBadge price={NO_ADS_PRICE.toFixed(2)}/>
              }
            </div>
            {!purchases.noAds&&<Btn onTap={()=>mockBuy("noAds")} style={{width:"100%",padding:"11px",borderRadius:10,background:`${t.acc}18`,border:`1.5px solid ${t.acc}`,color:t.acc,fontSize:12,fontWeight:700,textAlign:"center"}}>{"Buy for $"+NO_ADS_PRICE.toFixed(2)}</Btn>}
          </div>
        </>}

        {tab==="bundles"&&<>
          <div style={{fontSize:9,color:t.mut,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:4}}>Best value</div>
          {spent>0&&<div style={{fontSize:10,color:"#4ade80",fontFamily:MONO,marginBottom:4}}>{"💰 You've saved $"+spent.toFixed(2)+" off bundles from individual purchases"}</div>}

          {/* Theme bundle */}
          <div style={{background:t.bgCard,border:`2px solid ${purchases.allThemes?"#4ade80":t.acc}44`,borderRadius:14,padding:"16px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:t.pri}}>🎨 All 12 Themes</div>
                <div style={{fontSize:10,color:t.mut,marginTop:3,lineHeight:1.5}}>Every premium theme, forever.</div>
                {spent>0&&!purchases.allThemes&&<div style={{fontSize:10,color:"#4ade80",marginTop:4}}>{"Your $"+spent.toFixed(2)+" spent deducted"}</div>}
              </div>
              {purchases.allThemes
                ?<span style={{fontSize:11,color:"#4ade80",fontWeight:700}}>✓ Owned</span>
                :<PriceBadge price={themeOnlyPrice} crossed={spent>0?BUNDLE_THEME_PRICE.toFixed(2):null}/>
              }
            </div>
            {!purchases.allThemes&&<Btn onTap={()=>mockBuy("allThemes")} style={{width:"100%",padding:"11px",borderRadius:10,background:`${t.acc}18`,border:`1.5px solid ${t.acc}`,color:t.acc,fontSize:12,fontWeight:700,textAlign:"center"}}>{"Buy for $"+themeOnlyPrice}</Btn>}
          </div>

          {/* Full bundle */}
          <div style={{background:t.bgCard,border:`2px solid #f59e0b`,borderRadius:14,padding:"16px 14px",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:10,right:10,background:"#f59e0b",borderRadius:6,padding:"2px 8px",fontSize:9,fontWeight:700,color:"#000"}}>BEST VALUE</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:t.pri}}>💎 Full Bundle</div>
                <div style={{fontSize:10,color:t.mut,marginTop:3,lineHeight:1.5}}>All 12 themes + Remove Ads</div>
                {spent>0&&!purchases.noAds&&!purchases.allThemes&&<div style={{fontSize:10,color:"#4ade80",marginTop:4}}>{"Your $"+spent.toFixed(2)+" spent deducted"}</div>}
              </div>
              {purchases.allThemes&&purchases.noAds
                ?<span style={{fontSize:11,color:"#4ade80",fontWeight:700}}>✓ Complete</span>
                :<PriceBadge price={bundlePrice} crossed={spent>0?FULL_BUNDLE_PRICE.toFixed(2):null}/>
              }
            </div>
            {!(purchases.allThemes&&purchases.noAds)&&<Btn onTap={()=>mockBuy("full")} style={{width:"100%",padding:"11px",borderRadius:10,background:"#f59e0b22",border:"1.5px solid #f59e0b",color:"#f59e0b",fontSize:12,fontWeight:700,textAlign:"center"}}>{"Buy for $"+bundlePrice}</Btn>}
          </div>

          <div style={{fontSize:9,color:t.mut,textAlign:"center",lineHeight:1.6,marginTop:4}}>All purchases are one-time. No subscriptions. Restore purchases by tapping your profile.</div>
        </>}
      </div>
    </div>
  );
}


function NotifPrompt({t,onDone}){
  const req=async()=>{
    try{
      const res=await Notification.requestPermission();
      try{localStorage.setItem("sf_notif_asked","1");}catch{}
      onDone(res==="granted");
    }catch{onDone(false);}
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200,padding:"0 16px 32px",backdropFilter:"blur(6px)"}}>
      <div style={{background:t.bgCard,border:`1.5px solid ${t.brd}`,borderRadius:20,padding:"24px 20px",width:"100%",maxWidth:420,textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:10}}>🔔</div>
        <div style={{fontSize:18,fontWeight:700,color:t.pri,fontFamily:MONO,marginBottom:8}}>Don’t break your streak</div>
        <div style={{fontSize:13,color:t.sec,lineHeight:1.6,marginBottom:20}}>Get a daily reminder so you never miss a puzzle. We’ll only send one notification per day.</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <Btn onTap={req} style={{width:"100%",padding:"14px",borderRadius:12,background:t.acc,border:"none",color:"#fff",fontSize:14,fontWeight:700,fontFamily:MONO,letterSpacing:"0.04em"}}>Enable Reminders</Btn>
          <Btn onTap={()=>{try{localStorage.setItem("sf_notif_asked","1");}catch{}onDone(false);}} style={{width:"100%",padding:"12px",borderRadius:12,background:"transparent",border:`1px solid ${t.brd}`,color:t.mut,fontSize:12,fontWeight:700,fontFamily:MONO}}>Not now</Btn>
        </div>
      </div>
    </div>
  );
}

export default function App(){
  const [nav,setNav]=useState(()=>({
    screen:get(K.ob,null)?"home":"onboarding",
    diff:"easy",mode:"standard",isDaily:false,isPractice:false,
    savedState:null,gameId:0,seed:null,
  }));
  const [savedGame,setSavedGame]=useState(null);
  const [settings,setSettings]=useState(()=>get(K.set,DEF_SET));
  const [stats,setStats]=useState(()=>({...DEFAULT_STATS,...get(K.stats,{})}));
  const [pendingMode,setPendingMode]=useState(null);
  const [splash,setSplash]=useState(true);
  const [toast,setToast]=useState(null);
  const [dynSlot,setDynSlot]=useState(()=>getDynamicSlot());
  const [notifPrompt,setNotifPrompt]=useState(false);
  const [purchases,setPurchases]=useState(()=>getPurchases());

  const maybeAskNotif=()=>{
    try{if(localStorage.getItem("sf_notif_asked"))return;}catch{}
    if("Notification" in window&&Notification.permission==="default"){
      setTimeout(()=>setNotifPrompt(true),1200);
    }
  };

  // Re-evaluate dynamic theme every minute
  useEffect(()=>{
    if(!settings.dynamicTheme)return;
    const id=setInterval(()=>setDynSlot(getDynamicSlot()),60000);
    return()=>clearInterval(id);
  },[settings.dynamicTheme]);

  const themeDef=(()=>{
    if(settings.dynamicTheme){
      const base=THEMES[dynSlot.base]||THEMES.midnight;
      return{...base,_dynamic:true,_slot:dynSlot};
    }
    return THEMES[settings.theme]||THEMES.midnight;
  })();
  const t=(()=>{
    if(settings.dynamicTheme)return isDynamicDark()?themeDef.dark:themeDef.light;
    return settings.dark?themeDef.dark:themeDef.light;
  })();

  useEffect(()=>{
    let m=document.querySelector("meta[name=viewport]");
    if(!m){m=document.createElement("meta");m.name="viewport";document.head.appendChild(m);}
    m.content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no";
  },[]);

  const go=s=>setNav(n=>({...n,screen:s}));

  const chg=(key,val)=>{
    if(key==="_openStore"){go("store");return;}
    setSettings(s=>{const nx={...s,[key]:val};set(K.set,nx);return nx;});
  };

  const showToast=a=>{setToast(a);if(settings.soundOn)SFX.ach();};

  const startGame=(diff,resume,seed)=>{
    const ss=resume?savedGame:null;
    if(!resume){setSavedGame(null);setStats(s=>{const ns=recordPlayed(s,diff,false);return ns;});}
    setNav(n=>({...n,screen:"game",diff,mode:"standard",isDaily:false,isPractice:false,savedState:ss,gameId:n.gameId+1,seed:seed||null}));
  };

  const startShared=(diff,seed)=>{
    setSavedGame(null);
    setStats(s=>recordPlayed(s,diff,false));
    setNav(n=>({...n,screen:"game",diff,mode:"standard",isDaily:false,isPractice:false,savedState:null,gameId:n.gameId+1,seed}));
  };

  const startDaily=(dateStr,asPractice=false)=>{
    const dp=makeDailyPuzzle(dateStr||undefined);
    const ss={solution:dp.solution,userBoard:dp.puzzle.map(r=>[...r]),given:dp.puzzle.map(r=>r.map(v=>v!==0)),
      noteBoard:Array.from({length:9},()=>Array.from({length:9},()=>[])),timer:0,mistakes:0,hintsUsed:0,dateKey:dp.dateKey};
    if(!asPractice&&(!dateStr||dateStr===todayStr()))setStats(s=>recordPlayed(s,"hard",true));
    setNav(n=>({...n,screen:"game",diff:"hard",mode:"standard",isDaily:!asPractice,isPractice:asPractice,savedState:ss,gameId:n.gameId+1}));
  };

  const startMode=(mode,diff)=>{
    setSavedGame(null);
    if(mode==="weekly"){
      const wp=getWeeklyPuzzle();
      const wk=weekStr();
      const ss={solution:wp.solution,userBoard:wp.puzzle.map(r=>[...r]),given:wp.puzzle.map(r=>r.map(v=>v!==0)),
        noteBoard:Array.from({length:9},()=>Array.from({length:9},()=>[])),timer:0,mistakes:0,hintsUsed:0,dateKey:wk};
      setNav(n=>({...n,screen:"game",diff:"hard",mode:"weekly",isDaily:false,isPractice:false,savedState:ss,gameId:n.gameId+1}));
      return;
    }
    setNav(n=>({...n,screen:"game",diff,mode,isDaily:false,isPractice:false,savedState:null,gameId:n.gameId+1}));
  };

  const startPractice=tech=>{
    setSavedGame(null);
    setNav(n=>({...n,screen:"game",diff:tech.diff||"easy",mode:"practice",isDaily:false,isPractice:true,savedState:null,gameId:n.gameId+1}));
  };

  const handleWin=(time,info)=>{
    const diff=info?.diff||nav.diff,mode=info?.mode||nav.mode,el=info?.endlessLevel||1;
    const mistakes=info?.mistakes||0,hints=info?.hints||0;
    const isActualDaily=nav.isDaily&&nav.savedState?.dateKey===todayStr();
    const isWeekly=nav.mode==="weekly";
    if(isWeekly){const wk=weekStr();set(`${K.weekly}:${wk}`,true);}
    if(isActualDaily){const arch=get(K.arch,[]);if(!arch.includes(nav.savedState.dateKey)){arch.unshift(nav.savedState.dateKey);set(K.arch,arch.slice(0,30));}}
    let ns=recordWin(stats,diff,time,isActualDaily,mode);
    const key=isActualDaily?"daily":diff;
    ns=patchLastWin(ns,key,mistakes,hints);
    if(mode==="endless"&&el>(ns.endlessBest||0)){ns.endlessBest=el;set(K.stats,ns);}
    setStats(ns);
    const hist=get(K.hist,[]);hist.unshift({date:todayStr(),diff,time,mistakes,hints,won:true,mode,el});set(K.hist,hist.slice(0,100));
    const unlocked=checkAchievements({diff,time,mistakes,hints,won:true,mode,endlessLevel:el},ns);

    // Daily goals
    let goalToasts=[];
    if(isActualDaily){
      const dateKey=nav.savedState.dateKey;
      const prevGoals=getDailyGoals(dateKey);
      const newGoals=checkAndSaveDailyGoals(dateKey,time,mistakes,hints);
      goalToasts=newGoalsBadges(prevGoals,newGoals);
    }

    // Streak rewards — check for new unlocks
    const newlyUnlocked=getUnlockedRewards(ns.dStreak||0);
    const prevUnlocked=get(K.rewards,[]);
    const brandNew=STREAK_REWARDS.filter(r=>newlyUnlocked.includes(r.id)&&!prevUnlocked.includes(r.id));

    // Toast sequence: achievements → goal badges → streak rewards
    const toastQueue=[
      ...unlocked.map(a=>({type:"ach",...a})),
      ...goalToasts.map(g=>({type:"goal",icon:g.icon,label:g.label,desc:g.desc,color:"#22d3ee"})),
      ...brandNew.map(r=>({type:"reward",icon:r.icon,label:r.label,desc:`${r.streak}-day streak reward!`,color:"#f59e0b"})),
    ];
    toastQueue.forEach((item,i)=>{
      setTimeout(()=>showToast(item),900+i*2200);
    });
    // Ask for notifications after first win
    if((ns.totalWins||0)===1)maybeAskNotif();
  };

  const handleLoss=()=>{
    setStats(s=>{const ns=recordLoss(s);return ns;});
    const hist=get(K.hist,[]);hist.unshift({date:todayStr(),diff:nav.diff,time:0,mistakes:3,hints:0,won:false,mode:nav.mode,el:1});set(K.hist,hist.slice(0,100));
  };

  const sp={t,settings,dynSlot:settings.dynamicTheme?dynSlot:null};
  const {screen}=nav;

  // Page transition — must be before any early return
  const DEPTH={onboarding:0,home:1,difficulty:2,mode_intro:2,settings:2,stats:2,coaching:2,archive:2,bests:3,game:3};
  const prevScreenRef=useRef(screen);
  const prevDepth=DEPTH[prevScreenRef.current]??1;
  const curDepth=DEPTH[screen]??1;
  const slideDir=curDepth>=prevDepth?1:-1;
  useEffect(()=>{ prevScreenRef.current=screen; },[screen]);

  if(splash)return <Splash t={t} onDone={()=>setSplash(false)}/>;

  const pg=(key,child)=>(
    <div key={key} style={{position:"absolute",inset:0,animation:`pgIn 240ms cubic-bezier(0.22,1,0.36,1) both`,"--dy":`${slideDir*18}px`}}>
      {child}
    </div>
  );

  return(
    <div style={{position:"fixed",inset:0,overflow:"hidden",background:t.bg}}>
      <style>{`
        @keyframes pgIn{
          from{opacity:0;transform:translateY(var(--dy,16px))}
          to  {opacity:1;transform:translateY(0)}
        }
      `}</style>
      {toast&&<AchToast a={toast} onDone={()=>setToast(null)}/>}
      {notifPrompt&&<NotifPrompt t={t} onDone={()=>setNotifPrompt(false)}/>}
      {screen==="onboarding" &&pg("onboarding", <Onboarding {...sp} onDone={()=>{go("home");maybeAskNotif();}}/>)}
      {screen==="home"       &&pg("home",        <Landing {...sp} savedGame={savedGame} stats={stats}
        onStart={startGame} onDaily={()=>startDaily()} onSelectDiff={()=>go("difficulty")}
        onSettings={()=>go("settings")} onStats={()=>go("stats")} onArchive={()=>go("archive")}
        onMode={m=>{if(m==="weekly"){startMode("weekly","hard");return;}setPendingMode(m);go("mode_intro");}} onCoaching={()=>go("coaching")}
        onShared={startShared} onStore={()=>go("store")}/>)}
      {screen==="difficulty" &&pg("difficulty",  <DiffScreen {...sp} onPick={d=>startGame(d,false)} onBack={()=>go("home")}/>)}
      {screen==="settings"   &&pg("settings",    <Settings {...sp} onChange={chg} onBack={()=>go("home")}/>)}
      {screen==="stats"      &&pg("stats",       <StatsScreen {...sp} stats={stats} onBack={()=>go("home")} onBests={()=>go("bests")}/>)}
      {screen==="bests"      &&pg("bests",       <PersonalBests {...sp} stats={stats} onBack={()=>go("stats")}/>)}
      {screen==="archive"    &&pg("archive",     <Archive {...sp} onBack={()=>go("home")} onPlay={(d,asPractice)=>startDaily(d,asPractice)}/>)}
      {screen==="store"      &&pg("store",       <Store t={t} onBack={()=>go("home")} onPurchase={p=>{setPurchases(p);if(p.noAds||p.allThemes&&p.noAds)chg("_noAds",true);}}/>)}
      {screen==="coaching"   &&pg("coaching",    <Coaching {...sp} onBack={()=>go("home")} onPractice={startPractice}/>)}
      {screen==="mode_intro" &&pg("mode_intro",  <ModeIntro {...sp} mode={pendingMode} onBack={()=>go("home")} onStart={diff=>startMode(pendingMode,diff)}/>)}
      {screen==="game"       &&pg(`game-${nav.gameId}`, <GameScreen {...sp}
        key={nav.gameId}
        difficulty={nav.diff}
        savedState={nav.savedState}
        seed={nav.seed}
        onHome={()=>go("home")}
        onSave={nav.isPractice||nav.isDaily||nav.mode!=="standard"?null:setSavedGame}
        onWin={handleWin}
        onLoss={handleLoss}
        isDaily={nav.isDaily}
        isPractice={nav.isPractice}
        gameMode={nav.mode}/>)}
    </div>
  );
}
