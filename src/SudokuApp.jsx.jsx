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
    if(cands(r,c).length===1)return`Only ${num} fits here — all other digits are blocked by this cell's row, column, or box.`;
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
const K={set:"sf_settings_v1",stats:"sf_stats_v2",hist:"sf_hist_v1",achv:"sf_achv_v1",arch:"sf_arch_v1",ob:"sf_ob_v1",goals:"sf_goals_v1",rewards:"sf_rewards_v1"};
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
};
const ZEN={bg:"#0f110f",bgCard:"#141614",bgIn:"#191c19",bgHov:"#1f231f",brd:"#2e332e",brdM:"#3a403a",acc:"#6b8f71",pri:"#c8d4c8",sec:"#8fa88f",mut:"#4a5e4a",ghost:"#252825",ok:"#6b8f71",err:"#8f6b6b",giv:"#b8ccb8",usr:"#8fa88f",selBg:"#6b8f7145",samBg:"#6b8f712e",grpBg:"#1d221d",glow:"#6b8f7160",grad:"radial-gradient(ellipse at 50% 30%,#141814 0%,#0f110f 100%)"};
const DIFFS=["easy","medium","hard","very hard"];
const DCOL={easy:"#4ade80",medium:"#facc15",hard:"#f97316","very hard":"#f43f5e"};
const DLBL={easy:"Easy",medium:"Medium",hard:"Hard","very hard":"Very Hard"};
const MONO="'DM Mono','Fira Mono','Courier New',monospace";
const SERIF="Georgia,serif";
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
          {isLast?"Let's Play →":"Next →"}
        </Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// LANDING PAGE
// ─────────────────────────────────────────────
function Landing({t,settings,dynSlot,savedGame,stats,onStart,onDaily,onSelectDiff,onSettings,onStats,onArchive,onMode,onCoaching,onShared}){
  const [tab,setTab]=useState("play");
  const [vis,setVis]=useState(false);
  const [shareInput,setShareInput]=useState("");
  const [shareErr,setShareErr]=useState(false);
  useEffect(()=>{const id=setTimeout(()=>setVis(true),50);return()=>clearTimeout(id);},[]);
  const tryJoin=()=>{
    const res=decodeShare(shareInput);
    if(!res){setShareErr(true);setTimeout(()=>setShareErr(false),1500);return;}
    onShared(res.diff,res.seed);
  };
  const an=(d)=>({opacity:vis?1:0,transform:vis?"none":"translateY(14px)",transition:`opacity .45s ${d}s,transform .45s ${d}s`});
  const todayWon=stats?.lastDailyWin===todayStr();
  const streak=stats?.dStreak||0;
  const pct=savedGame?Math.round(savedGame.userBoard.flat().filter(v=>v!==0).length/81*100):0;
  const lastPlayed=(()=>{
    if(!savedGame?.timestamp)return null;
    const m=Math.round((Date.now()-savedGame.timestamp)/60000);
    if(m<2)return"just now";if(m<60)return`${m}m ago`;
    const h=Math.round(m/60);if(h<24)return`${h}h ago`;return"earlier";
  })();
  const rowBtn=(onTap,icon,title,sub,color,disabled)=>(
    <Btn onTap={disabled?()=>{}:onTap} disabled={disabled} style={{width:"100%",padding:"13px 14px",borderRadius:12,background:t.bgCard,border:`1.5px solid ${color||t.brd}`,display:"flex",alignItems:"center",justifyContent:"space-between",opacity:disabled?0.4:1}}>
      <span style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:16}}>{icon}</span>
        <span style={{textAlign:"left"}}>
          <div style={{fontSize:"clamp(12px,3.2vw,14px)",fontWeight:700,color:t.pri,fontFamily:MONO,letterSpacing:"0.04em"}}>{title}</div>
          {sub&&<div style={{fontSize:9,color:t.mut,marginTop:2,fontWeight:400}}>{sub}</div>}
        </span>
      </span>
      <span style={{color:color||t.mut,fontSize:14}}>›</span>
    </Btn>
  );
  const MODES=[
    {id:"endless",icon:"♾️",color:"#a78bfa",label:"Endless Flow",desc:"Difficulty ramps up. Bank time by solving fast."},
    {id:"focus",icon:"🎯",color:"#f43f5e",label:"Focus Mode",desc:"One mistake ends your run. Zero tolerance."},
    {id:"zen",icon:"🧘",color:"#6b8f71",label:"Zen Mode",desc:"No timer. Muted palette. Pure meditation."},
  ];
  return(
    <div style={{height:"100dvh",width:"100vw",background:t.grad,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"max(env(safe-area-inset-top),10px) 16px max(env(safe-area-inset-bottom),16px)",boxSizing:"border-box",fontFamily:MONO,overflow:"hidden"}}>
      <div style={{width:"100%",maxWidth:440,display:"flex",flexDirection:"column",gap:8,justifyContent:"center",maxHeight:"100dvh",overflowY:"auto"}}>
        {/* Title */}
        <div style={{textAlign:"center",position:"relative",...an(0.04)}}>
          {/* Daily goals badge — top right of title */}
          {(()=>{
            const todayGoals=getDailyGoals(todayStr());
            const numDone=DAILY_GOALS.filter(g=>todayGoals[g.id]).length;
            const allDone=numDone===DAILY_GOALS.length;
            return(
              <Btn onTap={onArchive} style={{position:"absolute",top:0,right:0,display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"5px 8px",borderRadius:10,background:allDone?`#f59e0b22`:t.bgCard,border:`1px solid ${allDone?"#f59e0b88":t.brd}`,cursor:"pointer"}}>
                <div style={{display:"flex",gap:2}}>
                  {DAILY_GOALS.map(g=>(
                    <span key={g.id} style={{fontSize:13,opacity:todayGoals[g.id]?1:0.25,filter:todayGoals[g.id]?"drop-shadow(0 0 3px #f59e0b)":"none"}}>{g.icon}</span>
                  ))}
                </div>
                <div style={{fontSize:8,fontWeight:700,color:allDone?"#f59e0b":t.mut,letterSpacing:"0.06em"}}>{numDone}/{DAILY_GOALS.length}</div>
              </Btn>
            );
          })()}
          <div style={{fontSize:"clamp(22px,6.5vw,38px)",letterSpacing:"0.32em",color:t.acc,fontFamily:SERIF,fontWeight:700,marginBottom:-4,textShadow:`0 0 40px ${t.acc}55`}}>SUDOKU</div>
          <div style={{fontSize:"clamp(52px,15vw,86px)",fontWeight:700,fontFamily:SERIF,color:t.pri,letterSpacing:"0.04em",lineHeight:0.92}}>FLOW</div>
          {settings.dynamicTheme&&dynSlot
            ?<div style={{fontSize:9,letterSpacing:"0.15em",color:t.acc,marginTop:5,textTransform:"uppercase"}}>{dynSlot?.icon||"🌓"} Dynamic · {dynSlot?.label||"Auto"}</div>
            :<div style={{fontSize:9,letterSpacing:"0.25em",color:t.mut,marginTop:6,textTransform:"uppercase"}}>Logic · Focus · Flow</div>}
        </div>
        {/* Tabs */}
        <div style={{display:"flex",gap:5,...an(0.08)}}>
          {[["play","▶ Play"],["modes","🎮 Modes"],["coaching","💡 Tips"]].map(([id,lbl])=>(
            <Btn key={id} onTap={()=>setTab(id)} style={{flex:1,padding:"9px 4px",borderRadius:10,background:tab===id?`${t.acc}22`:"transparent",border:`1.5px solid ${tab===id?t.acc:t.brd}`,color:tab===id?t.acc:t.mut,fontFamily:MONO,fontSize:"clamp(10px,2.5vw,11px)",fontWeight:700}}>{lbl}</Btn>
          ))}
        </div>
        {/* Content */}
        <div style={{display:"flex",flexDirection:"column",gap:7,...an(0.13)}}>
          {tab==="play"&&<>
            {rowBtn(onDaily,todayWon?"✅":"🗓️","Daily Puzzle",todayWon?`Done · 🔥 ${streak} day streak`:`Today's challenge · 🔥 ${streak} streak`,"#f59e0b")}
            {rowBtn(()=>onStart(DIFFS[0|Math.random()*4],false),"🎲","Random Puzzle","Any difficulty, instant start",t.acc)}
            {rowBtn(()=>savedGame&&onStart(savedGame.difficulty,true),"▶","Continue",savedGame?`${DLBL[savedGame.difficulty]||savedGame.difficulty} · ${fmt(savedGame.timer)} · ${pct}% · ${lastPlayed||""}`:null,null,!savedGame)}
            {rowBtn(onSelectDiff,"⊞","Select Difficulty","Easy · Medium · Hard · Very Hard")}
            {/* Share code */}
            <div style={{display:"flex",gap:6,padding:"10px 14px",borderRadius:12,background:t.bgCard,border:`1.5px solid ${shareErr?"#f43f5e":t.brd}`}}>
              <input value={shareInput} onChange={e=>setShareInput(e.target.value.toUpperCase().slice(0,7))}
                placeholder="PASTE CODE (e.g. A3F7K2M)"
                style={{flex:1,background:"transparent",border:"none",outline:"none",color:shareErr?"#f43f5e":t.pri,fontFamily:MONO,fontSize:"clamp(11px,2.8vw,13px)",letterSpacing:"0.1em"}}/>
              <Btn onTap={tryJoin} style={{padding:"5px 10px",borderRadius:8,background:`${t.acc}22`,border:`1.5px solid ${t.acc}`,color:t.acc,fontSize:10,fontWeight:700,fontFamily:MONO}}>Go →</Btn>
            </div>
            <div style={{display:"flex",gap:6}}>
              {[[onStats,"📊","Stats"],[onArchive,"📅","Archive"],[onSettings,"⚙️","Settings"]].map(([fn,ic,lb])=>(
                <Btn key={lb} onTap={fn} style={{flex:1,padding:"11px 6px",borderRadius:12,background:t.bgCard,border:`1.5px solid ${t.brd}`,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                  <span style={{fontSize:13}}>{ic}</span>
                  <span style={{fontSize:"clamp(10px,2.5vw,11px)",fontWeight:700,color:t.sec,fontFamily:MONO}}>{lb}</span>
                </Btn>
              ))}
            </div>
          </>}
          {tab==="modes"&&MODES.map(m=>(
            <Btn key={m.id} onTap={()=>onMode(m.id)} style={{width:"100%",padding:"15px 14px",borderRadius:12,background:t.bgCard,border:`1.5px solid ${m.color}44`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:22}}>{m.icon}</span>
                <span style={{textAlign:"left"}}>
                  <div style={{fontSize:"clamp(12px,3.5vw,14px)",fontWeight:700,color:m.color,fontFamily:MONO}}>{m.label}</div>
                  <div style={{fontSize:9,color:t.mut,marginTop:3,maxWidth:220,lineHeight:1.4}}>{m.desc}</div>
                </span>
              </span>
              <span style={{color:m.color,fontSize:14}}>›</span>
            </Btn>
          ))}
          {tab==="coaching"&&(
            <Btn onTap={onCoaching} style={{width:"100%",padding:"15px 14px",borderRadius:12,background:t.bgCard,border:`1.5px solid ${t.acc}44`,textAlign:"left"}}>
              <div style={{fontSize:"clamp(12px,3.5vw,14px)",fontWeight:700,color:t.acc,fontFamily:MONO,marginBottom:6}}>💡 Open Coaching Center</div>
              <div style={{fontSize:9,color:t.mut,lineHeight:1.5}}>Techniques · Smart hints · Practice puzzles</div>
            </Btn>
          )}
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
                return(
                  <Btn key={key} onTap={()=>onChange("theme",key)} style={{borderRadius:12,overflow:"hidden",border:`2px solid ${active?pal.acc:t.brd}`,background:pal.bg,padding:0,boxShadow:active?`0 0 14px ${pal.acc}44`:"none",display:"flex",flexDirection:"column"}}>
                    <div style={{padding:"8px 6px 4px",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:2,width:36}}>
                        {[...Array(9)].map((_,i)=><div key={i} style={{width:10,height:10,borderRadius:2,background:i===4?pal.acc:i%2===0?pal.bgIn:pal.bgHov,border:i===4?"none":`1px solid ${pal.brd}55`}}/>)}
                      </div>
                    </div>
                    <div style={{padding:"0 5px 7px",textAlign:"center"}}>
                      <div style={{fontSize:12,marginBottom:1}}>{th.emoji}</div>
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
          <Row label="Highlight Mistakes" sub="Mark wrong numbers in real time" ctrl={<Toggle val={settings.highlightMistakes} onToggle={()=>onChange("highlightMistakes",!settings.highlightMistakes)}/>}/>
          <Row label="Auto-Remove Notes" sub="Clear pencil marks when filling" ctrl={<Toggle val={settings.autoNotes} onToggle={()=>onChange("autoNotes",!settings.autoNotes)}/>}/>
          <Row label="Highlight Same Numbers" ctrl={<Toggle val={settings.highlightSame} onToggle={()=>onChange("highlightSame",!settings.highlightSame)}/>}/>
        </div>
        <div style={an(3)}>
          <Sec>Sound &amp; Feel</Sec>
          <Row label="Sound Effects" ctrl={<Toggle val={settings.soundOn} onToggle={()=>onChange("soundOn",!settings.soundOn)}/>}/>
          <Row label="Haptic Feedback" ctrl={<Toggle val={settings.hapticsOn} onToggle={()=>onChange("hapticsOn",!settings.hapticsOn)}/>}/>
          <Row label="Allow Background Audio" sub="Let Spotify/podcasts keep playing" ctrl={<Toggle val={settings.allowBgAudio} onToggle={()=>onChange("allowBgAudio",!settings.allowBgAudio)}/>}/>
        </div>
        <div style={an(4)}>
          <Sec>Timer</Sec>
          <Row label="Show Timer" ctrl={<Toggle val={settings.showTimer} onToggle={()=>onChange("showTimer",!settings.showTimer)}/>}/>
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
          <Row label="Colorblind Mode" sub="Use icons instead of color for feedback" ctrl={<Toggle val={settings.colorblind} onToggle={()=>onChange("colorblind",!settings.colorblind)}/>}/>
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
              {/* Goal chips — only for today's incomplete goals to show targets */}
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
          ["How do hints work?","Tap 💡 to reveal the correct digit for a cell. On Easy, you'll see an explanation. On Very Hard, you'll be asked to confirm."],
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
  const [won,setWon]=useState(false);
  const [over,setOver]=useState(false);
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
  const [ready,setReady]=useState(false);

  // ── ALL useRef SECOND ─────────────────────────
  const lpTimers=useRef({});

  // ── Derived values (not hooks) ────────────────
  const EDIFFS=["easy","easy","medium","medium","hard","hard","very hard","very hard"];
  const effDiff=isEndless?EDIFFS[Math.min(endLv-1,EDIFFS.length-1)]:diff;
  const useShints=effDiff==="easy"||isPractice;
  const hintLim=isZen||isFocus||isEndless||isPractice?null:{easy:3,medium:null,hard:null,"very hard":null}[effDiff];
  const acc=isZen?gt.acc:DCOL[effDiff]||t.acc;
  const numSz={small:"clamp(11px,3.2vw,18px)",medium:"clamp(13px,3.8vw,22px)",large:"clamp(15px,4.4vw,27px)"}[settings.textSize]||"clamp(13px,3.8vw,22px)";
  const padSz={small:"clamp(14px,4vw,20px)",medium:"clamp(17px,5vw,26px)",large:"clamp(20px,6vw,32px)"}[settings.textSize]||"clamp(17px,5vw,26px)";
  const noteSz={small:"clamp(4px,0.8vw,7px)",medium:"clamp(5px,1vw,8px)",large:"clamp(6px,1.2vw,10px)"}[settings.textSize]||"clamp(5px,1vw,8px)";

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
    onWin&&onWin(tv,{diff:effDiff,mode:gameMode,endlessLevel:lv||endLv,mistakes,hints});
  },[sfx,hap,onWin,effDiff,gameMode,endLv,mistakes,hints]);

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
    if(!isFocus&&mistakes>=3)return;
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
      sfx("bad");hap([30,10,30]);
      if(isFocus){setRunning(false);setOver(true);onLoss&&onLoss();return;}
      // Immediately end the game on 3rd mistake — don't wait for flash to clear
      if(nm>=3){setRunning(false);setOver(true);onLoss&&onLoss();return;}
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
    <div style={{height:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",background:gt.bg,color:gt.pri,fontFamily:MONO,fontSize:13}}>Loading…</div>
  );

  const sr=sel?.[0],sc=sel?.[1];
  const selBox=sel?[3*Math.floor(sr/3),3*Math.floor(sc/3)]:null;
  const selVal=sel?board[sr][sc]:0;
  const hintDis=won||over||(hintLim!==null&&hints>=hintLim);
  const badge=isDaily?"🗓️ DAILY":isZen?"🧘 ZEN":isFocus?"🎯 FOCUS":isEndless?`♾️ LV.${endLv}`:isPractice?"📚 PRACTICE":null;
  const aBt=(active,color)=>({flex:1,padding:"10px 2px",borderRadius:10,background:active?`${color}18`:gt.bgCard,border:`1.5px solid ${active?color:gt.brd}`,color:active?color:gt.mut,fontSize:"clamp(9px,2.3vw,11px)",fontWeight:700,fontFamily:MONO,letterSpacing:"0.03em",textTransform:"uppercase"});

  return(
    <div style={{position:"fixed",inset:0,background:gt.bg,display:"flex",flexDirection:"column",alignItems:"center",paddingTop:"max(env(safe-area-inset-top),10px)",paddingBottom:"max(env(safe-area-inset-bottom),14px)",paddingLeft:8,paddingRight:8,boxSizing:"border-box",fontFamily:MONO,color:gt.pri,touchAction:"manipulation",overflow:"hidden",gap:6}}>
      <style>{`@keyframes shk{0%{transform:translateX(0)}20%{transform:translateX(-3px)}40%{transform:translateX(3px)}60%{transform:translateX(-2px)}80%{transform:translateX(2px)}100%{transform:translateX(0)}} @keyframes plsL{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>

      {/* AD SLOT — hidden until monetisation enabled */}

      {/* Top bar */}
      <div style={{width:"100%",maxWidth:460,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <Btn onTap={onHome} style={{background:gt.bgCard,border:`1.5px solid ${gt.brdM}`,borderRadius:8,color:gt.sec,fontFamily:MONO,fontSize:11,letterSpacing:"0.05em",padding:"6px 10px"}}>⌂ Home</Btn>
        <div style={{textAlign:"center"}}>
          {badge&&<div style={{fontSize:8,letterSpacing:"0.3em",color:`${acc}cc`,marginBottom:1,textTransform:"uppercase"}}>{badge}</div>}
          <div style={{fontSize:"clamp(12px,3.5vw,16px)",fontWeight:700,fontFamily:SERIF,color:gt.pri,letterSpacing:"0.08em"}}>SUDOKU FLOW</div>
          {isEndless&&<div style={{fontSize:8,color:gt.mut}}>BANK: {fmt(bank)}</div>}
        </div>
        <div style={{textAlign:"right",minWidth:58}}>
          {!isZen&&settings.showTimer&&<div style={{fontSize:"clamp(11px,3vw,14px)",fontWeight:700,color:gt.pri}}>{fmt(timer)}</div>}
          {isZen&&<div style={{fontSize:11,color:gt.mut}}>∞</div>}
          {!isFocus&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:1,marginTop:2}}>
              <div style={{display:"flex",gap:3}}>
                {[1,2,3].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:i<=mistakes?gt.err:gt.brd,boxShadow:i<=mistakes?`0 0 6px ${gt.err}`:"none",animation:i===mistakes&&mistakes>0?"shk .35s ease":"none"}}/>)}
              </div>
              <div style={{fontSize:8,color:gt.mut}}>{mistakes}/3</div>
            </div>
          )}
          {isFocus&&<div style={{fontSize:8,color:gt.err,marginTop:2}}>ZERO TOL.</div>}
        </div>
      </div>

      {/* Board — size is driven by available space, capped so it never overflows */}
      <div style={{position:"relative",flexGrow:1,flexShrink:1,minHeight:0,aspectRatio:"1/1",width:"min(94vw,100%)",maxWidth:"calc(100vh - 200px)",alignSelf:"center"}}>
        {/* Col indicators */}
        <div style={{position:"absolute",top:-13,left:0,right:0,display:"grid",gridTemplateColumns:"repeat(9,1fr)"}}>
          {[0,1,2,3,4,5,6,7,8].map(c=><div key={c} style={{display:"flex",justifyContent:"center",alignItems:"center",height:11}}>{sc===c&&<div style={{width:12,height:3,borderRadius:2,background:acc,opacity:0.75}}/>}</div>)}
        </div>
        {/* Row indicators */}
        <div style={{position:"absolute",top:0,bottom:0,left:-13,display:"grid",gridTemplateRows:"repeat(9,1fr)"}}>
          {[0,1,2,3,4,5,6,7,8].map(r=><div key={r} style={{display:"flex",justifyContent:"center",alignItems:"center",width:11}}>{sr===r&&<div style={{width:3,height:12,borderRadius:2,background:acc,opacity:0.75}}/>}</div>)}
        </div>
        {/* Grid */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(9,1fr)",width:"100%",height:"100%",borderRadius:8,overflow:"hidden",border:`2px solid ${gt.brdM}`,boxSizing:"border-box",position:"relative",...(settings.boardReward?getRewardStyle(settings.boardReward,acc):{boxShadow:`0 8px 32px rgba(0,0,0,0.18)`})}}>
          {/* Box divider overlays — drawn on top so they don't affect cell sizing */}
          {[1,2].map(i=>(
            <div key={`vb${i}`} style={{position:"absolute",top:0,bottom:0,left:`${i*100/3}%`,width:2,background:gt.brdM,zIndex:2,transform:"translateX(-1px)",pointerEvents:"none"}}/>
          ))}
          {[1,2].map(i=>(
            <div key={`hb${i}`} style={{position:"absolute",left:0,right:0,top:`${i*100/3}%`,height:2,background:gt.brdM,zIndex:2,transform:"translateY(-1px)",pointerEvents:"none"}}/>
          ))}
          {board.map((row,r)=>row.map((val,c)=>{
            const ck=`${r}-${c}`;
            const isSel=sr===r&&sc===c;
            const inGrp=sr!==undefined&&(sr===r||sc===c||(selBox&&r>=selBox[0]&&r<selBox[0]+3&&c>=selBox[1]&&c<selBox[1]+3));
            const same=settings.highlightSame&&selVal!==0&&val===selVal;
            const isFlsh=!!flash[ck];
            const isFad=isFlsh&&flash[ck].fad;
            const isGiv=given[r][c];
            const isOk=val!==0&&!isGiv&&!isFlsh&&val===sol[r][c];
            const cn=noteBoard[r][c];
            const isLastCol=c===8;
            const isLastRow=r===8;
            const isHinted=smartH&&smartH.r===r&&smartH.c===c;
            const boxIdx=Math.floor(r/3)*3+Math.floor(c/3);
            const isPls=pulse.rows.has(r)||pulse.cols.has(c)||pulse.boxes.has(boxIdx);
            let bg=gt.bgIn;
            if(isSel)bg=gt.selBg;
            else if(isFlsh)bg=`${gt.err}22`;
            else if(isHinted)bg=`${acc}28`;
            else if(same)bg=gt.samBg;
            else if(inGrp)bg=gt.grpBg;
            const nc=isFlsh?gt.err:isGiv?gt.giv:isOk?gt.ok:gt.usr;
            return(
              <div key={ck}
                onTouchEnd={e=>{e.preventDefault();if(won||over)return;if(settings.singleTapClear&&sel&&sr===r&&sc===c&&!isGiv&&val!==0){doNumber(0);return;}setSel([r,c]);}}
                onClick={()=>{if(won||over)return;if(settings.singleTapClear&&sel&&sr===r&&sc===c&&!isGiv&&val!==0){doNumber(0);return;}setSel([r,c]);}}
                style={{aspectRatio:"1",display:"flex",alignItems:"center",justifyContent:"center",background:bg,
                  borderRight:isLastCol?"none":`1px solid ${gt.brd}`,
                  borderBottom:isLastRow?"none":`1px solid ${gt.brd}`,
                  position:"relative",WebkitTapHighlightColor:"transparent",transition:"background .12s",
                  zIndex:1,animation:isPls?"plsL .65s ease":"none"}}>
                {val!==0
                  ?<span style={{fontSize:numSz,fontWeight:isGiv?700:600,color:nc,fontFamily:SERIF,lineHeight:1,opacity:isFad?0:1,transition:"opacity .6s",animation:isFlsh&&!isFad?"shk .35s ease":"none",position:"relative"}}>
                      {val}
                      {settings.colorblind&&isFlsh&&<span style={{position:"absolute",top:-2,right:-4,fontSize:"clamp(7px,1.5vw,9px)",color:gt.err,fontWeight:900}}>✕</span>}
                    </span>
                  :cn&&cn.size>0
                    ?<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",width:"92%",height:"92%"}}>
                        {[1,2,3,4,5,6,7,8,9].map(n=><div key={n} style={{fontSize:noteSz,color:cn.has(n)?gt.acc:"transparent",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>{n}</div>)}
                      </div>
                    :null}
              </div>
            );
          }))}
        </div>
      </div>

      {/* Number pad */}
      <div style={{display:"flex",gap:"clamp(3px,1.2vw,6px)",width:"min(96vw,440px)",flexShrink:0}}>
        {[1,2,3,4,5,6,7,8,9].map(n=>{
          const cnt=board.flat().filter(v=>v===n).length;
          const done=cnt>=9;
          return(
            <Btn key={n} onTap={()=>{}} disabled={done||won||over}
              style={{flex:1,aspectRatio:"0.82",border:`1.5px solid ${done?gt.brd:notes?acc:gt.brdM}`,borderRadius:8,background:done?gt.bg:notes?`${acc}10`:gt.bgCard,color:done?gt.ghost:gt.pri,fontSize:padSz,fontWeight:700,fontFamily:SERIF,position:"relative",display:"flex",alignItems:"center",justifyContent:"center",minWidth:0}}
              onTouchStart={e=>{e.stopPropagation();if(!done&&!won&&!over){lpTimers.current[n]=setTimeout(()=>{setNotes(p=>!p);vib([20]);lpTimers.current[n]=null;},420);}}}
              onTouchEnd={e=>{e.preventDefault();e.stopPropagation();if(!done&&!won&&!over){if(lpTimers.current[n]){clearTimeout(lpTimers.current[n]);lpTimers.current[n]=null;doNumber(n);}}}}
              onMouseDown={e=>{e.stopPropagation();if(!done&&!won&&!over){lpTimers.current[n]=setTimeout(()=>{setNotes(p=>!p);lpTimers.current[n]=null;},420);}}}
              onMouseUp={e=>{e.stopPropagation();if(!done&&!won&&!over&&lpTimers.current[n]){clearTimeout(lpTimers.current[n]);lpTimers.current[n]=null;doNumber(n);}}}>
              {n}
              {cnt>0&&!done&&<span style={{position:"absolute",bottom:2,right:3,fontSize:"clamp(6px,1.4vw,8px)",color:gt.mut,lineHeight:1}}>{cnt}</span>}
            </Btn>
          );
        })}
        <Btn onTap={()=>doNumber(0)} disabled={won||over} style={{flex:1,aspectRatio:"0.82",border:`1.5px solid ${gt.brdM}`,borderRadius:8,background:gt.bgCard,color:gt.mut,fontSize:"clamp(14px,4vw,20px)",display:"flex",alignItems:"center",justifyContent:"center",minWidth:0}}>⌫</Btn>
      </div>

      {/* Actions */}
      <div style={{display:"flex",gap:5,width:"min(96vw,440px)",flexShrink:0}}>
        <Btn onTap={()=>setNotes(n=>!n)} disabled={won||over} style={aBt(notes,acc)}>✎ Notes<span style={{fontSize:'6px',opacity:0.45,marginLeft:2,letterSpacing:0}}>[n]</span></Btn>
        <Btn onTap={()=>doNumber(0)} disabled={won||over} style={aBt(false,acc)}>⌫ Erase</Btn>
        <Btn onTap={doUndo} disabled={!undos.length||won||over} style={{...aBt(false,acc),opacity:undos.length?1:0.38}}>↩ Undo</Btn>
        <Btn onTap={()=>{
          if(hintDis)return;
          if(effDiff==="very hard"&&!vhPend){setVhPend(true);setTimeout(()=>setVhPend(false),3500);return;}
          setVhPend(false);doHint();
        }} disabled={hintDis} style={{...aBt(vhPend,"#f43f5e"),opacity:hintDis&&hintLim!==null?0.38:1}}>
          {vhPend?"Sure?":`💡${hintLim!==null?` ${Math.max(0,hintLim-hints)}`:" Hint"}`}
        </Btn>
        {!isDaily&&!isEndless&&!isPractice&&(
          <Btn onTap={()=>doStart(diff,1,120)} style={aBt(false,acc)}>↺ New</Btn>
        )}
        {!isDaily&&!isEndless&&activeSeed!==null&&(
          <Btn onTap={()=>{
            const code=encodeShare(diff,activeSeed);
            try{navigator.clipboard.writeText(code);}catch{}
            setShareMsg(code);setTimeout(()=>setShareMsg(null),3500);
          }} style={aBt(!!shareMsg,acc)}>
            {shareMsg?"✓ Copied":"⬆ Share"}
          </Btn>
        )}
      </div>

      {shareMsg&&(
        <div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",zIndex:200,background:gt.bgCard,border:`1.5px solid ${acc}`,borderRadius:14,padding:"12px 18px",textAlign:"center",boxShadow:`0 0 24px ${acc}44`,minWidth:220}}>
          <div style={{fontSize:9,color:acc,letterSpacing:"0.2em",fontFamily:MONO,marginBottom:6}}>SHARE CODE COPIED</div>
          <div style={{fontSize:22,fontWeight:700,fontFamily:MONO,letterSpacing:"0.2em",color:gt.pri}}>{shareMsg}</div>
          <div style={{fontSize:9,color:gt.mut,marginTop:5}}>Send to a friend · they'll get the exact same puzzle</div>
        </div>
      )}

      {smartH&&<HintOverlay hint={smartH} onPlace={applyHint} onDismiss={()=>setSmartH(null)} t={gt}/>}

      {/* Win overlay */}
      {won&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,backdropFilter:"blur(8px)",padding:20}}>
          <div style={{background:gt.bgCard,border:`2px solid ${acc}`,borderRadius:20,padding:"28px 20px",textAlign:"center",boxShadow:`0 0 80px ${acc}40`,width:"min(92vw,360px)"}}>
            <div style={{fontSize:48,marginBottom:8}}>{isDaily?"🏆":isZen?"🧘":isFocus?"🎯":isEndless?"♾️":"🎉"}</div>
            <div style={{fontSize:"clamp(18px,5vw,24px)",fontWeight:700,color:acc,fontFamily:SERIF,marginBottom:6}}>
              {isDaily?"Daily Complete!":isZen?"Zen Complete":isFocus?"Focus: Perfect!":isEndless?`Level ${endLv} Clear!`:"Solved!"}
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
            <Btn onTap={onHome} style={{marginTop:10,width:"100%",padding:"10px",borderRadius:10,border:`1.5px solid ${gt.brd}`,background:"transparent",color:gt.mut,fontSize:11,fontWeight:700,fontFamily:MONO,letterSpacing:"0.05em"}}>⌂ Home</Btn>
          </div>
        </div>
      )}

      {over&&<GameOver t={gt} diff={effDiff} mode={isFocus?"focus":isEndless?"endless":"standard"} onRetry={()=>doStart(initDiff,1,120)} onHome={onHome}/>}
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
const DEF_SET={theme:"midnight",dark:true,dynamicTheme:false,highlightMistakes:true,autoNotes:true,highlightSame:true,showTimer:true,pauseOnHide:true,soundOn:true,hapticsOn:true,allowBgAudio:false,singleTapClear:false,textSize:"medium",colorblind:false,boardReward:null};

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
      {screen==="onboarding" &&pg("onboarding", <Onboarding {...sp} onDone={()=>go("home")}/>)}
      {screen==="home"       &&pg("home",        <Landing {...sp} savedGame={savedGame} stats={stats}
        onStart={startGame} onDaily={()=>startDaily()} onSelectDiff={()=>go("difficulty")}
        onSettings={()=>go("settings")} onStats={()=>go("stats")} onArchive={()=>go("archive")}
        onMode={m=>{setPendingMode(m);go("mode_intro");}} onCoaching={()=>go("coaching")}
        onShared={startShared}/>)}
      {screen==="difficulty" &&pg("difficulty",  <DiffScreen {...sp} onPick={d=>startGame(d,false)} onBack={()=>go("home")}/>)}
      {screen==="settings"   &&pg("settings",    <Settings {...sp} onChange={chg} onBack={()=>go("home")}/>)}
      {screen==="stats"      &&pg("stats",       <StatsScreen {...sp} stats={stats} onBack={()=>go("home")} onBests={()=>go("bests")}/>)}
      {screen==="bests"      &&pg("bests",       <PersonalBests {...sp} stats={stats} onBack={()=>go("stats")}/>)}
      {screen==="archive"    &&pg("archive",     <Archive {...sp} onBack={()=>go("home")} onPlay={(d,asPractice)=>startDaily(d,asPractice)}/>)}
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
