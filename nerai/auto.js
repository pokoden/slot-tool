// ===== 自動：分析期間と狙う日だけで、店ごとのクセを過去日の検証で選んで点数を付ける =====
(function(){
const AC={m:new Map()};window.autoBust=()=>{AC.m=new Map()};
const FN={prev:'据え置き',r3:'3日間',r7:'7日間',lr:'長期好調率',nb:'並び',sk:'飛び飛び',slump:'不調明け',tEnd:'台の日末尾',tYou:'台の曜日',tHi:'台の日',mAll:'機種7日間',mEnd:'機種の日末尾',mYou:'機種の曜日',mHi:'機種の日',end:'台番末尾',rot:'ローテーション'};
const FK=Object.keys(FN);const MLV=new Set(['mAll','mEnd','mYou','mHi']);
window.autoOn=()=>!!NPV().auto;
const NUM=t=>{const n=parseInt(t,10);return String(n)===String(t)?n:null};
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
function rkv(v){const o=v.map((x,i)=>i).sort((a,b)=>v[a]-v[b]);const r=new Array(v.length);let i=0;while(i<o.length){let j=i;while(j+1<o.length&&v[o[j+1]]===v[o[i]])j++;for(let k=i;k<=j;k++)r[o[k]]=(i+j)/2;i=j+1}return r}
function spr(a,b){if(a.length<3)return null;const x=rkv(a),y=rkv(b),n=x.length,mx=mean(x),my=mean(y);let c=0,dx=0,dy=0;for(let i=0;i<n;i++){c+=(x[i]-mx)*(y[i]-my);dx+=(x[i]-mx)**2;dy+=(y[i]-my)**2}return dx&&dy?c/Math.sqrt(dx*dy):null}
// 店の台日ごとの総合指数（標準指数）
function grid(s){const k='g|'+s;if(AC.m.has(k))return AC.m.get(k);const set=setObj(),B=kenBase();const G=new Map();
 for(const r of S.rows){if(r.s!==s)continue;const ix=NC.rowIdx(r,set,B);if(!ix||ix.t==null)continue;let m=G.get(r.d);if(!m)G.set(r.d,m=new Map());m.set(String(r.t),{v:ix.t,g:NC.groupOf(r.m,set),gi:ix.g})}
 const D=[...G.keys()].sort();const o={G,D};AC.m.set(k,o);return o}
// その日の特徴（その日より前のデータだけ）
function feats(o,day,di,univ){const{G,D}=o;const H=[];for(let i=di-1;i>=0&&H.length<60;i--)H.push(D[i]);if(H.length<8)return null;
 const P=G.get(H[0]);const md=NC.segOf(day,'matsu'),wd=NC.segOf(day,'you'),hd=NC.segOf(day,'hi');
 const sameM=H.filter(d=>NC.segOf(d,'matsu')===md),sameW=H.filter(d=>NC.segOf(d,'you')===wd),sameH=H.filter(d=>NC.segOf(d,'hi')===hd);
 const mStat=(days)=>{const a={};for(const d of days)for(const[,c]of G.get(d)){(a[c.g]||(a[c.g]=[])).push(c.v)}const r={};for(const g in a)r[g]=mean(a[g]);return r};
 const M7=mStat(H.slice(0,7)),MM=mStat(sameM),MW=mStat(sameW),MH=mStat(sameH);
 const best={};for(const[t,c]of P){const n=NUM(t);if(n==null)continue;if(!best[c.g]||c.v>best[c.g].v)best[c.g]={v:c.v,n}}
 const msz={};for(const[,c]of P)msz[c.g]=(msz[c.g]||0)+1;
 const tv=(d,t)=>{const c=G.get(d).get(t);return c?c.v:null};
 const out=[];for(const[t,g]of univ){const n=NUM(t);const f={};
  f.prev=tv(H[0],t);const l3=H.slice(0,3).map(d=>tv(d,t)).filter(v=>v!=null),l7=H.slice(0,7).map(d=>tv(d,t)).filter(v=>v!=null),l30=H.slice(0,30).map(d=>tv(d,t)).filter(v=>v!=null);
  f.r3=mean(l3);f.r7=mean(l7);f.lr=l30.length>=5?l30.filter(v=>v>=60).length/l30.length:null;
  const nb=n==null?[]:[n-1,n+1].map(x=>P.get(String(x))).filter(c=>c&&c.g===g).map(c=>c.v);f.nb=mean(nb);
  const sk=n==null?[]:[n-2,n+2].map(x=>P.get(String(x))).filter(c=>c&&c.g===g).map(c=>c.v);f.sk=mean(sk);
  let sl=0;for(const d of H){const v=tv(d,t);if(v==null||v>=45)break;sl++}f.slump=Math.min(sl,10);
  f.tEnd=mean(sameM.map(d=>tv(d,t)).filter(v=>v!=null));f.tYou=mean(sameW.map(d=>tv(d,t)).filter(v=>v!=null));f.tHi=mean(sameH.map(d=>tv(d,t)).filter(v=>v!=null));
  f.mAll=M7[g]??null;f.mEnd=MM[g]??null;f.mYou=MW[g]??null;f.mHi=MH[g]??null;
  f.end=n==null?null:(n%10===md?1:0);
  f.rot=n==null||!best[g]?null:-Math.abs(n-best[g].n)/Math.max(1,msz[g]||1);
  out.push({t,g,f})}
 // 日の中で標準化（ない値は0）
 for(const k of FK){const v=out.map(x=>x.f[k]).filter(x=>x!=null);const m=mean(v)||0;const sd=v.length>1?Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length):0;for(const x of out)x.f[k]=x.f[k]==null||!sd?0:(x.f[k]-m)/sd}
 return out}
function sample(o,di){const day=o.D[di];const T=o.G.get(day);const univ=[...T].filter(([t,c])=>!nxHas(c.g)).map(([t,c])=>[t,c.g]);const F=feats(o,day,di,univ);if(!F)return null;for(const x of F){const c=T.get(x.t);x.y=c.v}return F}
const scoreOf=(x,W)=>{let s=0;for(const k in W)s+=W[k]*x.f[k];return s};
function rankDay(F,W){for(const x of F)x.S=scoreOf(x,W);const v=F.map(x=>x.S),m=mean(v),sd=Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length)||1;for(const x of F)x.dev=50+10*(x.S-m)/sd;
 const G={};for(const x of F)(G[x.g]||(G[x.g]=[])).push(x);for(const g in G){G[g].sort((a,b)=>b.S-a.S);G[g].forEach((x,i)=>x.mr=i+1)}return G}
// 重み：日ごとの店全体と機種内の順位相関の平均。日数10以上・t値2以上・上位3分の1の当たり率が全体の1.1倍以上だけ使う
function fit(days){const W={},info={};for(const k of FK){const c=[];let hT=0,hN=0,aT=0,aN=0;
  for(const F of days){const ov=spr(F.map(x=>x.f[k]),F.map(x=>x.y));const G={};for(const x of F)(G[x.g]||(G[x.g]=[])).push(x);const w=[];for(const g in G){if(G[g].length<3)continue;const r=spr(G[g].map(x=>x.f[k]),G[g].map(x=>x.y));if(r!=null)w.push(r)}
   const wm=mean(w);const v=MLV.has(k)?ov:(ov!=null&&wm!=null?(ov+wm)/2:ov);if(v!=null)c.push(v)}
  if(c.length<10)continue;const m=mean(c),sd=Math.sqrt(c.reduce((a,b)=>a+(b-m)**2,0)/(c.length-1));const tt=sd?m/(sd/Math.sqrt(c.length)):0;if(Math.abs(tt)<2)continue;
  for(const F of days){const s=F.slice().sort((a,b)=>(b.f[k]-a.f[k])*Math.sign(m));const top=s.slice(0,Math.ceil(s.length/3));for(const th of[55,60]){}hT+=top.filter(x=>x.y>=60).length+top.filter(x=>x.y>=55).length;hN+=top.length*2;aT+=F.filter(x=>x.y>=60).length+F.filter(x=>x.y>=55).length;aN+=F.length*2}
  const lift=aT?(hT/hN)/(aT/aN):0;if(lift<1.1)continue;W[k]=m;info[k]={m,tt,lift}}
 return{W,info}}
const LIMK=[1,2,3,5,null],LIMD=[null,50,55,60];
function evalLim(days,W,k,dv){let n=0,h60=0,h55=0;for(const F of days){rankDay(F,W);for(const x of F){if(k!=null&&x.mr>k)continue;if(dv!=null&&x.dev<dv)continue;n++;if(x.y>=60)h60++;if(x.y>=55)h55++}}return{n,h60,h55}}
function pickLim(days,W){let best=null;const tot=days.reduce((a,F)=>a+F.length,0);const mn=Math.max(20,Math.round(tot*0.03));
 for(const k of LIMK)for(const dv of LIMD){const r=evalLim(days,W,k,dv);if(r.n<mn)continue;const sc=r.h60/r.n+0.5*r.h55/r.n;if(!best||sc>best.sc+0.005)best={k,dv,sc,r}}return best||{k:3,dv:null}}
function topPick(days,W){let n=0,h=0,base=0;for(const F of days){const G=rankDay(F,W);for(const g in G){const L=G[g];if(L.length<3)continue;n++;if(L[0].y>=60)h++;base+=L.filter(x=>x.y>=60).length/L.length}}return{n,h,base}}
// 店ごとのモデル（狙う日より前の分析期間で学習、最後の数日は検証に残す）
window.autoModel=(s,day)=>{const N=NPV().autoN||60;const key='M|'+s+'|'+day+'|'+N;if(AC.m.has(key))return AC.m.get(key);const o=grid(s);
 let di=o.D.findIndex(d=>d>=day);if(di<0)di=o.D.length;const tr=[];for(let i=Math.max(0,di-N);i<di;i++){const F=sample(o,i);if(F&&F.length)tr.push(F)}
 let res=null;if(tr.length>=15){const H=Math.min(7,Math.floor(tr.length/4));const fitD=tr.slice(0,tr.length-H),ho=tr.slice(tr.length-H);
  const f1=fit(fitD);const l1=pickLim(fitD,f1.W);const ev=Object.keys(f1.W).length?evalLim(ho,f1.W,l1.k,l1.dv):{n:0,h60:0,h55:0};const tp=topPick(ho,f1.W);
  const f2=fit(tr);const l2=pickLim(tr,f2.W);res={W:f2.W,info:f2.info,k:l2.k,dv:l2.dv,ho:ev,tp,hoDays:o.D.slice(di-H,di)}}
 AC.m.set(key,res);return res};
// 狙う日の台ごとの点数
window.autoDay=(s,day)=>{const key='D|'+s+'|'+day+'|'+(NPV().autoN||60);if(AC.m.has(key))return AC.m.get(key);const M=autoModel(s,day);let R=null;
 if(M&&Object.keys(M.W).length){const o=grid(s);let di=o.D.findIndex(d=>d>=day);if(di<0)di=o.D.length;const src=o.G.get(day)||o.G.get(o.D[di-1]);
  if(src){const F=feats(o,day,di,[...src].filter(([t,c])=>!nxHas(c.g)).map(([t,c])=>[t,c.g]));if(F){rankDay(F,M.W);R=new Map(F.map(x=>[x.t,{S:x.S*10+50,dev:x.dev,mr:x.mr}]))}}}
 AC.m.set(key,R);return R};
// 狙いの行に自動の点数を入れる（元の行は書き換えない）
window.autoApply=(u)=>{const M=autoModel(u.s,u.date),A=autoDay(u.s,u.date);const seen=new Set();
 // 候補にない台も自動では対象（狙わない機種・件数%未満は除く）
 const have=new Set(u.T.filter(x=>x.kind==='t').map(x=>String(x.t)));const tpl=u.T.find(x=>x.kind==='t');const add=[];
 if(A&&tpl){const set=setObj();const rs=new Map();for(const r of (u.day||[]))rs.set(String(r.t),r);for(const[t]of A){if(have.has(t))continue;const r=rs.get(t);const m=r?r.m:null;const g=r?NC.groupOf(r.m,set):null;if(!g||nxHas(g)||(u.dropT&&u.dropT.has(t)))continue;
   const seg={};for(const sg of NC.SEGS)seg[sg]={u:null,o:false,mv:null};add.push(Object.assign({},tpl,{t:isFinite(+t)?+t:t,m,g,seg,ev:{},prev:false,mlist:null,parts:null,label:'台番',miss:0,tti:null,drop:false}))}}
 let AA=A;if(A){const keys=new Set();for(const x of u.T.concat(add)){const t=x.kind==='t'?String(x.t):x.seat!=null?String(x.seat):null;if(t&&A.has(t))keys.add(t)}
  const L=[...keys].map(t=>Object.assign({t},A.get(t)));const v=L.map(x=>x.S),m=mean(v)||0,sd=Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/Math.max(1,v.length))||1;const gs=new Map();
  for(const x of u.T.concat(add)){const t=x.kind==='t'?String(x.t):x.seat!=null?String(x.seat):null;if(t&&!gs.has(t))gs.set(t,x.g)}
  const G={};for(const x of L){x.dev=50+10*(x.S-m)/sd;(G[gs.get(x.t)]||(G[gs.get(x.t)]=[])).push(x)}for(const g in G)G[g].sort((a,b)=>b.S-a.S).forEach((x,i)=>x.mr=i+1);AA=new Map(L.map(x=>[x.t,x]))}
 const T=u.T.concat(add).map(x=>{const t=x.kind==='t'?String(x.t):x.seat!=null?String(x.seat):null;const a=t&&AA?AA.get(t):null;const y=Object.assign({},x,{auto:1,score:a?a.S:-999,asdv:a?a.dev:null,alim:M?{k:M.k,dv:M.dv}:{k:0,dv:null}});
  y.mark=a&&x.mark!==undefined&&!seen.has(t)?'○':'';if(y.mark)seen.add(t);return y});
 T.sort((a,b)=>(a.kind==='t'?0:1)-(b.kind==='t'?0:1));const s2=new Set();for(const y of T){const t=y.kind==='t'?String(y.t):y.seat!=null?String(y.seat):null;if(!y.mark)continue;if(s2.has(t))y.mark='';else s2.add(t)}
 return T};
// 上の1行：検証日の当たり率（自動と手動）と使ったクセ
window.autoLine=(stores,day)=>{let a={n:0,h60:0,h55:0},m={n:0,h60:0,h55:0};const used={};const set=setObj();
 for(const s of stores){const M=autoModel(s,day);if(!M)continue;a.n+=M.ho.n;a.h60+=M.ho.h60;a.h55+=M.ho.h55;for(const k in M.W)used[k]=(used[k]||0)+1;const o=grid(s);
  for(const d of M.hoDays){const U=unitsAll(d,[s],S.rows,set,true);const seen=new Set();for(const u of U)for(const x of u.T){if(!dMk(x))continue;const t=x.kind==='t'?String(x.t):x.seat!=null?String(x.seat):null;if(!t||seen.has(t))continue;seen.add(t);const c=o.G.get(d)&&o.G.get(d).get(t);if(!c)continue;m.n++;if(c.v>=60)m.h60++;if(c.v>=55)m.h55++}}}
 const p=(h,n)=>n?Math.round(100*h/n)+'%':'-';const ks=Object.keys(used).sort((x,y)=>used[y]-used[x]).slice(0,4).map(k=>FN[k]).join('・');
 return`<div class="card"><div class="row"><b>自動 60以上${p(a.h60,a.n)} 55以上${p(a.h55,a.n)}／手動 60以上${p(m.h60,m.n)} 55以上${p(m.h55,m.n)}　${esc(ks||'クセなし')}</b></div></div>`};
window.autoFN=FN;
})();
