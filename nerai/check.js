// データチェック（回転なし・ありえない確率・取り込み忘れ）
(function(G){
function lpois(k,l){let s=-l+k*Math.log(l);for(let i=2;i<=k;i++)s-=Math.log(i);return s}
function tailHi(k,l){if(k<=l)return 1;let lt=lpois(k,l),s=0,t=lt;for(let i=k;i<k+2000;i++){s+=Math.exp(t-lt);t+=Math.log(l/(i+1));if(Math.exp(t-lt)<1e-12)break}return Math.min(1,Math.exp(lt)*s)}
function tailLo(k,l){if(k>=l)return 1;let lt=lpois(k,l),s=0,t=lt;for(let i=k;i>=0;i--){s+=Math.exp(t-lt);if(i>0)t+=Math.log(i/l)}return Math.min(1,Math.exp(lt)*s)}
const num=v=>v!=null&&v!==''&&isFinite(+v);
// 機種ごとの平均確率と、台ごとのばらつき（設定差・AT機の荒さ）をデータから求める
function med(a){if(!a.length)return 1;a.sort((x,y)=>x-y);return a[a.length>>1]}
function rates(all){const M={};for(const r of all){if(!(+r.g>0)||!num(r.bb)||!num(r.rb))continue;const x=M[r.m]||(M[r.m]={g:0,bb:0,rb:0,L:[]});x.g+=+r.g;x.bb+=+r.bb;x.rb+=+r.rb;x.L.push(r)}
 for(const m in M){const x=M[m],pa=(x.bb+x.rb)/x.g,pr=x.rb/x.g,da=[],dr=[];for(const r of x.L){const la=r.g*pa,lr=r.g*pr,ka=+r.bb+ +r.rb;if(la>=3)da.push((ka-la)**2/la);if(lr>=3)dr.push((+r.rb-lr)**2/lr)}
  x.fa=Math.max(1,med(da)/0.455);x.fr=Math.max(1,med(dr)/0.455);delete x.L}return M}
const TH=1e-6,WIN=14,MIN=0.8;
function check(all,target,keys){const out=[];const M=rates(all);
 for(const r of target){const hasH=(num(r.bb)&&+r.bb>0)||(num(r.rb)&&+r.rb>0);
  if(!(+r.g>0)){if(hasH)out.push({k:'g',r,why:'回転なしでBB/RBあり'});continue}
  const x=M[r.m];if(!x||x.g<20000)continue;
  const chk=(k,p,f,lab)=>{const l=+r.g*p;if(!(l>0))return;const pv=Math.min(tailHi(Math.floor(k/f),l/f),tailLo(Math.ceil(k/f),l/f));if(pv<TH)out.push({k:'p',r,why:lab+(k>l?'が多すぎ':'が少なすぎ')})};
  const n=(+r.bb||0)+(+r.rb||0);const before=out.length;chk(n,(x.bb+x.rb)/x.g,x.fa,'合算');if(out.length===before)chk(+r.rb||0,x.rb/x.g,x.fr,'RB')}
 // 取り込み忘れ
 const byS=new Map();for(const r of all){let s=byS.get(r.s);if(!s)byS.set(r.s,s=new Map());let d=s.get(r.d);if(!d)s.set(r.d,d=[]);d.push(r)}
 const want=keys?new Set(keys):null;
 for(const [s,days] of byS){const ds=[...days.keys()].sort();
  ds.forEach((d,i)=>{if(want&&!want.has(d+'|'+s))return;const prev=ds.slice(Math.max(0,i-WIN),i);if(prev.length<5)return;
   const mc={},tc={};for(const p of prev){const ms=new Set(),ts=new Map();for(const r of days.get(p)){ms.add(r.m);ts.set(String(r.t),r.m)}ms.forEach(m=>mc[m]=(mc[m]||0)+1);ts.forEach((m,t)=>{const k=t+'\t'+m;tc[k]=(tc[k]||0)+1})}
   const cur=days.get(d),cm=new Set(cur.map(r=>r.m)),ct=new Set(cur.map(r=>String(r.t)));const lim=prev.length*MIN;
   for(const m in mc)if(mc[m]>=lim&&!cm.has(m))out.push({k:'m',r:{d,s,m,t:'',g:null,bb:null,rb:null},why:'機種がない'});
   for(const k in tc){const [t,m]=k.split('\t');if(tc[k]>=lim&&cm.has(m)&&!ct.has(t))out.push({k:'t',r:{d,s,m,t,g:null,bb:null,rb:null},why:'台番がない'})}})}
 out.sort((a,b)=>a.r.d<b.r.d?1:a.r.d>b.r.d?-1:a.r.s<b.r.s?-1:a.r.s>b.r.s?1:String(a.r.t).localeCompare(String(b.r.t),'ja',{numeric:true}));return out}
const api={check,tailHi,tailLo};if(typeof module!=='undefined')module.exports=api;G.NCK=api})(typeof window!=='undefined'?window:globalThis);
