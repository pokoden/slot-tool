// 設定狙いツール 共通処理（ブラウザ・node両用）
(function(root){
'use strict';
const WIN=[['zen','前日'],['d2','2日間'],['d3','3日間'],['d6','6日間'],['matsu','前回日末尾'],['dou','前回同日'],['you','前回曜日']];
const MET=[['g','回転'],['bb','BB'],['rb','RB'],['gs','合算']];
const DIR=[['y','良'],['w','悪']];
// 順位配列の並び：窓×指標×良悪（56個）。0=空白（同順位・データなし）
const RANK_KEYS=[];for(const w of WIN)for(const m of MET)for(const d of DIR)RANK_KEYS.push(w[0]+'_'+m[0]+'_'+d[0]);
const RANK_LABEL=k=>{const[w,m,d]=k.split('_');return WIN.find(x=>x[0]===w)[1]+MET.find(x=>x[0]===m)[1]+(d==='y'?'良':'悪')+'順'};

// nana-press で確率を確認したジャグラーのまとめ（同じ確率の別名）
const DEF_GROUPS={'SアイムジャグラーEX-TP':'アイムジャグラー','アイムジャグラーEX-TP':'アイムジャグラー','ネオアイムジャグラーEX':'アイムジャグラー','SアイムジャグラーEX':'アイムジャグラー','アイムジャグラーEX':'アイムジャグラー',
 'マイジャグラーV':'マイジャグラー','マイジャグラーVI':'マイジャグラー'};
// ノーマルと分かる機種だけノーマル、それ以外はAT
const DEF_NORMAL=['ジャグラー','ハナビ','クランキー','ディスクアップ','ボーナストリガー','SHAKE','バーサス','ニューパルサー','ハナハナ','花火'];
const DEF_NORMAL_EXCEPT=['スマスロ ハナビ','スマスロハナビ'];
// 旧サイト側の名前 → 正式名（""は「重複したら相手側の名前を残す」）
const DEF_ALIAS={'東京喰種':'L東京喰種','戦国乙女5':'L戦国乙女5 業火を穿つ宿焔の双刃','カバネリ海門決戦':'スマスロ 甲鉄城のカバネリ 海門決戦','ソードアートオンライン':'スロット ソードアート・オンラインII',
 'リコリス・リコイル':'スマスロ リコリス・リコイル','とある魔術の禁書目録2':'スマスロ とある魔術の禁書目録2','青春ブタ野郎はバニーガール先輩の夢を見ない':'L青春ブタ野郎はバニーガール先輩の夢を見ない','アイムジャグラーEX-TP':''};

const nz=s=>String(s==null?'':s).normalize('NFKC').replace(/\s+/g,' ').trim();
const normStore=s=>nz(s).replace(/店$/,'');
function normMachine(s,set){let m=nz(s);const a=set&&set.alias||{};if(a[m])m=nz(a[m]);return m}
function normDate(s){s=nz(s);let m=s.match(/^(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})日?/)||s.match(/^(\d{4})(\d{2})(\d{2})$/);
 if(!m)return null;const y=+m[1],mo=+m[2],d=+m[3];if(mo<1||mo>12||d<1||d>31)return null;
 const t=new Date(Date.UTC(y,mo-1,d));if(t.getUTCDate()!==d)return null;return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0')}
const num=s=>{s=nz(s).replace(/[,円G回]/g,'');if(s===''||s==='-')return 0;const v=Number(s);return Number.isFinite(v)?Math.round(v):NaN};
function splitLine(line,sep){if(sep==='\t')return line.split('\t');const out=[];let cur='',q=false;
 for(let i=0;i<line.length;i++){const c=line[i];if(q){if(c==='"'){if(line[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
  else if(c==='"')q=true;else if(c===','){out.push(cur);cur=''}else cur+=c}out.push(cur);return out}
// TSV/CSV → 行。列：日付・店舗・機種・台番・回転・BB・RB
function parseText(text,set){const rows=[],errs=[];text=String(text||'').replace(/^\uFEFF/,'');
 text.split(/\r?\n/).forEach((line,i)=>{if(!line.trim())return;const sep=line.includes('\t')?'\t':',';const p=splitLine(line,sep).map(nz);
  const date=normDate(p[0]);if(!date){if(i>0||!/日付|date/i.test(p[0]))errs.push({line:i+1,text:line.slice(0,80),why:'日付が読めない'});return}
  if(p.length<7){errs.push({line:i+1,text:line.slice(0,80),why:'列が足りない（7列必要）'});return}
  const r={d:date,s:normStore(p[1]),m:normMachine(p[2],set),t:nz(p[3]),g:num(p[4]),bb:num(p[5]),rb:num(p[6])};
  if(!r.s||!r.m||!r.t){errs.push({line:i+1,text:line.slice(0,80),why:'店舗・機種・台番が空'});return}
  if([r.g,r.bb,r.rb].some(Number.isNaN)){errs.push({line:i+1,text:line.slice(0,80),why:'数字が読めない'});return}
  rows.push(r)});return{rows,errs}}
const rkey=r=>r.d+'|'+r.s+'|'+r.t;
// 重複削除して統合。同じ日・店舗・台番は1件だけ。値が同じなら旧名でない方の機種名を残す。値が違えば新しい方で置き換え
function merge(existing,incoming,set){const map=new Map();for(const r of existing)map.set(rkey(r),r);
 const alias=set&&set.alias||{};let add=0,dup=0,rep=0;const repl=[];
 for(const r of incoming){const k=rkey(r),o=map.get(k);if(!o){map.set(k,r);add++;continue}
  if(o.g===r.g&&o.bb===r.bb&&o.rb===r.rb){dup++;if(o.m!==r.m&&(o.m in alias)&&!(r.m in alias))map.set(k,r);continue}
  rep++;if(repl.length<50)repl.push({old:o,neu:r});map.set(k,r)}
 return{rows:[...map.values()],add,dup,rep,repl}}

const typeOf=(m,set)=>{const t=set&&set.types||{};if(t[m])return t[m];if(DEF_NORMAL_EXCEPT.includes(m))return'AT';return DEF_NORMAL.some(w=>m.includes(w))?'N':'AT'};
const groupOf=(m,set)=>{const g=set&&set.groups||{};if(g[m]!=null&&g[m]!=='')return g[m];return DEF_GROUPS[m]||m};
// 確率の分母（小さいほど良い）。当たり0回は一番悪い=Infinity
const den=(g,n)=>n>0?g/n:Infinity;
const val=(x,m)=>m==='g'?x.g:den(x.g,m==='bb'?x.bb:m==='rb'?x.rb:x.bb+x.rb);
const better=(m,a,b)=>m==='g'?b-a:(a===b?0:a<b?-1:1);// 負ならaが良い
function rankList(items,m){// items:[{t,v}] → {t:{y,w}}
 const res={};const L=items.filter(x=>x.v!=null);const cnt=new Map();for(const x of L)cnt.set(x.v,(cnt.get(x.v)||0)+1);
 const s=[...L].sort((a,b)=>better(m,a.v,b.v));
 s.forEach((x,i)=>{const tie=cnt.get(x.v)>1;(res[x.t]||(res[x.t]={})).y=tie?0:i+1});
 [...s].reverse().forEach((x,i)=>{const tie=cnt.get(x.v)>1;res[x.t].w=tie?0:i+1});return res}

function dow(d){return new Date(d+'T00:00:00Z').getUTCDay()}
// 全データから、日付×店舗×グループの集計と、各台の状態順を作る
function build(rows,set){const byS=new Map();
 for(const r of rows){let S=byS.get(r.s);if(!S)byS.set(r.s,S=new Map());let D=S.get(r.d);if(!D)S.set(r.d,D=[]);D.push(r)}
 const sums={},ranks={};
 for(const[s,S]of byS){const dates=[...S.keys()].sort();
  // 台番×グループ→日付→行
  const idx=new Map();for(const d of dates)for(const r of S.get(d)){const k=groupOf(r.m,set)+'|'+r.t;let m=idx.get(k);if(!m)idx.set(k,m=new Map());m.set(d,r)}
  dates.forEach((d,di)=>{const prev=dates.slice(0,di).reverse();
   const day=+d.slice(8),wd=dow(d);
   const pick={zen:prev.slice(0,1),d2:prev.slice(0,2),d3:prev.slice(0,3),d6:prev.slice(0,6),
    matsu:[prev.find(x=>+x.slice(8)%10===day%10)].filter(Boolean),dou:[prev.find(x=>+x.slice(8)===day)].filter(Boolean),you:[prev.find(x=>dow(x)===wd)].filter(Boolean)};
   const byG=new Map(),byM=new Map();for(const r of S.get(d)){const g=groupOf(r.m,set);(byG.get(g)||byG.set(g,[]).get(g)).push(r);(byM.get(r.m)||byM.set(r.m,[]).get(r.m)).push(r)}
   const add=(k,L,g,m)=>{const t={n:L.length,g:0,bb:0,rb:0};for(const r of L){t.g+=r.g;t.bb+=r.bb;t.rb+=r.rb}t.typ=typeOf(m||L[0].m,set);if(g)t.grp=g;sums[d+'|'+s+'|'+k]=t};
   for(const[m,L]of byM)add(m,L,groupOf(m,set)!==m?groupOf(m,set):null,m);
   for(const[g,L]of byG){if(L.some(r=>r.m!==g)&&new Set(L.map(r=>r.m)).size>1)add('G:'+g,L,g,L[0].m);
    const out={};for(const r of L)out[r.t]=new Array(RANK_KEYS.length).fill(0);
    for(const w of WIN){const ds=pick[w[0]];if(!ds.length)continue;
     const tot=L.map(r=>{const m=idx.get(g+'|'+r.t);const x={g:0,bb:0,rb:0};let has=false;for(const dd of ds){const q=m&&m.get(dd);if(q){has=true;x.g+=q.g;x.bb+=q.bb;x.rb+=q.rb}}return{t:r.t,x:has?x:null}});
     MET.forEach(mm=>{const rk=rankList(tot.map(o=>({t:o.t,v:o.x?val(o.x,mm[0]):null})),mm[0]);
      for(const t in rk){const base=RANK_KEYS.indexOf(w[0]+'_'+mm[0]+'_y');out[t][base]=rk[t].y;out[t][base+1]=rk[t].w}})}
    for(const r of L)(ranks[d]||(ranks[d]={}))[s+'|'+r.t]=out[r.t]}})}
 return{sums,ranks}}
// 月ごとのファイル内容
const ROWCOLS=['d','s','m','t','g','bb','rb'];
function monthFiles(rows,set){rows=[...rows].sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:a.s<b.s?-1:a.s>b.s?1:a.m<b.m?-1:a.m>b.m?1:String(a.t).localeCompare(String(b.t),'ja',{numeric:true}));const b=build(rows,set);const raw={},agg={};
 for(const r of rows){const ym=r.d.slice(0,7);(raw[ym]||(raw[ym]=[])).push(ROWCOLS.map(c=>r[c]))}
 for(const ym in raw)raw[ym].sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:a[1]<b[1]?-1:a[1]>b[1]?1:String(a[3]).localeCompare(String(b[3]),'ja',{numeric:true}));
 for(const k in b.sums){const ym=k.slice(0,7);const A=agg[ym]||(agg[ym]={v:1,rankKeys:RANK_KEYS,sums:{},ranks:{}});A.sums[k]=b.sums[k]}
 for(const d in b.ranks){const ym=d.slice(0,7);agg[ym].ranks[d]=b.ranks[d]}
 const out={};for(const ym in raw){out['nerai/'+ym+'.json']=JSON.stringify({v:1,cols:ROWCOLS,rows:raw[ym]});out['nerai/agg-'+ym+'.json']=JSON.stringify(agg[ym])}
 return out}
function rowsFromFile(j){if(!j||!Array.isArray(j.rows))throw new Error('形式が違う');return j.rows.map(a=>({d:a[0],s:a[1],m:a[2],t:String(a[3]),g:a[4],bb:a[5],rb:a[6]}))}
const fmtP=v=>v===Infinity||!Number.isFinite(v)?'-':'1/'+v.toFixed(1);
// 次の日（まだデータがない日）の状態順。台の並びは最後の日と同じとみなす
function addDay(d,n){const t=new Date(d+'T00:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10)}
function nextDay(rows,set,store){const R=rows.filter(r=>r.s===store);if(!R.length)return null;let L='0';for(const r of R)if(r.d>L)L=r.d;
 const d=addDay(L,1);const v=R.filter(r=>r.d===L).map(r=>Object.assign({},r,{d,g:0,bb:0,rb:0,virt:1}));const b=build(R.concat(v),set);return{date:d,base:L,rows:v,ranks:b.ranks[d]||{}}}
// ===== 分析 =====
function stat(a){const n=a.length;if(!n)return{m:0,sd:0,n:0};let s=0;for(const x of a)s+=x;const m=s/n;let v=0;for(const x of a)v+=(x-m)*(x-m);return{m,sd:Math.sqrt(v/n),n}}
// 偏差値。確率は「1回転あたりの当たり率」で計算するので、高いほど良い（=分母が小さいほど高い）
const dev=(x,st)=>x==null||!st||!st.n?null:st.sd>0?50+10*(x-st.m)/st.sd:50;
const dowC=new Map();const dowF=d=>{let v=dowC.get(d);if(v==null){v=dow(d);dowC.set(d,v)}return v};
const segOf=(d,type)=>type==='matsu'?+d.slice(8)%10:type==='hi'?+d.slice(8):type==='you'?dowF(d):'all';
const has=v=>v!==''&&v!=null&&!isNaN(+v);
// 分析の軸（日末尾・日・曜日）。状態順は前日〜6日間＋その軸の「前回」だけ、回転と合算の悪い順だけ
const AXES=['matsu','hi','you'];
const AXWIN={matsu:'matsu',hi:'dou',you:'you'};
const stKeys=ax=>['zen','d2','d3','d6',AXWIN[ax]].flatMap(w=>['g','gs'].map(m=>w+'_'+m+'_w'));
// 標準指数の母集団：登録初日〜期間の最終日の全データ（1台1日を1件）
function stdBase(rows,set,to){const rot={N:[],AT:[]};const L=rows.filter(r=>r.d<=to);
 for(const r of L)rot[typeOf(r.m,set)].push(r.g);const rs={N:stat(rot.N),AT:stat(rot.AT)};
 const pr={};for(const r of L){if(r.g<=0)continue;const t=dev(r.g,rs[typeOf(r.m,set)]);if(t<55)continue;const g=groupOf(r.m,set);const o=pr[g]||(pr[g]={rb:[],gs:[]});o.rb.push(r.rb/r.g);o.gs.push((r.bb+r.rb)/r.g)}
 const ps={};for(const g in pr)ps[g]={rb:stat(pr[g].rb),gs:stat(pr[g].gs)};return{rot:rs,prob:ps}}
function idx(rT,rbT,gsT){if(rT==null||rbT==null||gsT==null)return{p:null,t:null};const p=rbT*0.4+gsT*0.6;return{p,t:rT*0.6+p*0.4}}
const SM=new WeakMap();
function storeRows(rows,s){let m=SM.get(rows);if(!m){m=new Map();for(const r of rows){let a=m.get(r.s);if(!a)m.set(r.s,a=[]);a.push(r)}SM.set(rows,m)}return m.get(s)||[]}
// 店舗1つぶんの集計。軸の値（日末尾なら0〜9）ごとに、台番別と状態順1位別を出す
// 検索割合の分母：期間（from〜to）のカレンダー上で、その軸の値に当たる日の数（データがない日も数える）
const calC=new Map();
function calDays(from,to,axis){const key=from+'|'+to+'|'+axis;let c=calC.get(key);if(c)return c;c={};if(from<=to&&to<'2200'){for(let d=from;d<=to;d=addDay(d,1)){const v=segOf(d,axis);c[v]=(c[v]||0)+1}}calC.set(key,c);return c}
function analyzeStore(rows,set,ranks,store,axis,from,to,B){const cal=calDays(from,to,axis);
 const ks=stKeys(axis).map(k=>[k,RANK_KEYS.indexOf(k)]);const G=new Map();
 const add=(M,key,k,v,r)=>{let u=M.get(key);if(!u)M.set(key,u={k,v:String(v),cnt:0,g:0,bb:0,rb:0});u.cnt++;u.g+=r.g;u.bb+=r.bb;u.rb+=r.rb;return u};
 for(const r of storeRows(rows,store)){if(r.d<from||r.d>to)continue;
  const g=groupOf(r.m,set);let o=G.get(g);if(!o)G.set(g,o={g,typ:typeOf(r.m,set),cal,tai:new Map(),st:new Map()});
  const v=segOf(r.d,axis);
  add(o.tai,v+'|'+r.t,r.t,v,r).m=r.m;
  const x=(ranks[r.d]||{})[r.s+'|'+r.t];if(x)for(const[k,i]of ks)if(x[i]===1)add(o.st,v+'|'+k,k,v,r)}
 return G}
const topFn=vals=>{const s=vals.slice().sort((a,b)=>b-a);const n=s.length;return x=>{let lo=0,hi=n;while(lo<hi){const m=(lo+hi)>>1;if(s[m]>x)lo=m+1;else hi=m}return(lo+1)/n*100}};
// 指数・上位%・自動○を付ける。
// 店舗機種指数：この店舗×機種の「軸ぜんぶ」（件数割合のボーダー以上の台）の平均と偏差から。確率は回転偏差値55以上の台だけと比べる
// 標準指数：登録初日からの全データ。確率は回転偏差値55以上の台・日だけと比べる
function finalize(G,B,base){
 for(const o of G.values()){const sb=base.rot[o.typ],pb=base.prob[o.g]||{};o.taiL=[...o.tai.values()];o.stL=[...o.st.values()];
  for(const L of[o.taiL,o.stL]){
   for(const u of L){const nd=o.cal[u.v]||0;u.typ=o.typ;u.ratio=nd?u.cnt/nd:0;u.avg=u.g/u.cnt;u.rbR=u.g>0?u.rb/u.g:0;u.gsR=u.g>0?(u.bb+u.rb)/u.g:0}
   const pool=L.filter(u=>!has(B.ratio)||u.ratio*100>=+B.ratio);const inP=new Set(pool);
   const sg=stat(pool.map(u=>u.avg));let p55=pool.filter(u=>dev(u.avg,sg)>=55);if(!p55.length)p55=pool;
   const s1={rb:stat(p55.map(u=>u.rbR)),gs:stat(p55.map(u=>u.gsR))};
   const val={g:u=>u.avg,rb:u=>u.rbR,gs:u=>u.gsR};const sp={},dp={};
   for(const m in val){sp[m]=topFn(pool.map(val[m]));const bv=new Map();for(const u of pool){let a=bv.get(u.v);if(!a)bv.set(u.v,a=[]);a.push(val[m](u))}dp[m]=new Map([...bv].map(([v,a])=>[v,topFn(a)]))}
   for(const u of L){const a=[dev(u.avg,sg),dev(u.rbR,s1.rb),dev(u.gsR,s1.gs)];const i1=idx(...a);u.tk={g:a[0],rb:a[1],gs:a[2],p:i1.p,t:i1.t};
    const b=[dev(u.avg,sb),dev(u.rbR,pb.rb),dev(u.gsR,pb.gs)];const i2=idx(...b);u.hy={g:b[0],rb:b[1],gs:b[2],p:i2.p,t:i2.t};
    u.tt=u.tk.t!=null&&u.hy.t!=null?u.tk.t*0.4+u.hy.t*0.6:null;
    if(inP.has(u)){u.sp={};u.dp={};for(const m in val){u.sp[m]=sp[m](val[m](u));u.dp[m]=dp[m].get(u.v)(val[m](u))}}else{u.sp=null;u.dp=null}
    u.auto=judge(u,B,o.g)}}}
 return G}
function analysisFor(rows,set,ranks,store,axis,from,to,B,base){return finalize(analyzeStore(rows,set,ranks,store,axis,from,to,B),B,base)}
// ボーダー判定。空欄の条件は見ない。条件が1つもなければ自動○なし。入れた条件は全部満たす台に○
function judge(u,B,grp){let any=false;const chk=(v,f)=>{if(!has(v))return true;any=true;return f(+v)};
 const Bg=B.g||{},Br=B.rb||{},Bs=B.gs||{},by=B.by||'hy';const idxs=by==='tk'?[u.tk]:by==='hy'?[u.hy]:[u.tk,u.hy];const mc=(B.mach||{})[grp]||{};
 const ok=chk(B.ratio,v=>u.ratio*100>=v)&&chk(u.typ==='N'?Bg.nm:Bg.at,v=>u.avg>=v)
  &&[['g',Bg],['rb',Br],['gs',Bs]].every(([k,b])=>chk(b.idx,v=>idxs.every(x=>x[k]!=null&&x[k]>=v))&&chk(b.sp,v=>u.sp&&u.sp[k]!=null&&u.sp[k]<=v)&&chk(b.dp,v=>u.dp&&u.dp[k]!=null&&u.dp[k]<=v))
  &&chk(mc.rb,v=>u.rb>0&&u.g/u.rb<=v)&&chk(mc.gs,v=>u.bb+u.rb>0&&u.g/(u.bb+u.rb)<=v);
 return any&&ok}
// ===== 当日の数値表示（窓ごとの合計） =====
function winIdx(rows,set){const by=new Map();
 for(const r of rows){let S=by.get(r.s);if(!S)by.set(r.s,S={dates:new Set(),idx:new Map()});S.dates.add(r.d);const k=groupOf(r.m,set)+'|'+r.t;let m=S.idx.get(k);if(!m)S.idx.set(k,m=new Map());m.set(r.d,r)}
 for(const S of by.values())S.dates=[...S.dates].sort();return by}
function winPicks(W,store,d){const S=W.get(store);if(!S)return null;const prev=S.dates.filter(x=>x<d).reverse();const day=+d.slice(8),wd=dowF(d);
 return{zen:prev.slice(0,1),d2:prev.slice(0,2),d3:prev.slice(0,3),d6:prev.slice(0,6),matsu:[prev.find(x=>+x.slice(8)%10===day%10)].filter(Boolean),dou:[prev.find(x=>+x.slice(8)===day)].filter(Boolean),you:[prev.find(x=>dowF(x)===wd)].filter(Boolean)}}
function winSum(W,store,picks,grp,t,w){const S=W.get(store);const m=S&&S.idx.get(grp+'|'+t);if(!m||!picks)return null;const x={g:0,bb:0,rb:0};let h=false;for(const d of picks[w]||[]){const q=m.get(d);if(q){h=true;x.g+=q.g;x.bb+=q.bb;x.rb+=q.rb}}return h?x:null}
// ===== 狙いリスト =====
const SEGS=AXES;
const DEF_CFG={pts:{tai:{matsu:3,hi:1,you:1},st:{matsu:1,hi:0,you:0}},combo:{},sub:{metric:'t',w:{matsu:50,hi:25,you:25}}};
// 組み合わせ（日末尾・日・曜日の○有無を3桁の0/1）→ 評価印。未設定は○の数で（3個○、2個△、1個×）
function comboMark(code,cfg){const c=cfg.combo||{};if(c[code]!=null)return c[code];const n=[...code].filter(x=>x==='1').length;return n>=3?'○':n===2?'△':n===1?'×':''}
// o:{store,date,members,tRanks,from,to,border,marks,cfg}
function neraiList(rows,set,base,ranks,o){const cfg=o.cfg,B=o.border||{},M=o.marks||{};const out=[];
 const A={};for(const sg of SEGS)A[sg]=analysisFor(rows,set,ranks,o.store,sg,o.from,o.to,B,base);
 const groups=[...new Set(o.members.map(r=>groupOf(r.m,set)))];const by=B.by||'hy';
 for(const g of groups){const mem=o.members.filter(r=>groupOf(r.m,set)===g);const seg={};
  for(const sg of SEGS){const val=String(segOf(o.date,sg));const og=A[sg].get(g);
   const mk=u=>{const k=[o.store,g,sg,val,u.k].join('|');return M[k]==null?!!u.auto:!!M[k]};
   const tai=new Map(),st=new Map();
   if(og){for(const u of og.taiL)if(u.v===val)tai.set(String(u.k),{u,o:mk(u)});for(const u of og.stL)if(u.v===val)st.set(u.k,{u,o:mk(u)})}
   seg[sg]={tai,st}}
  for(const r of mem){const x=(o.tRanks||{})[r.s+'|'+r.t]||[];const one=RANK_KEYS.filter((k,i)=>x[i]===1);
   const res={};let pts=0,sub=0,code='';
   for(const sg of SEGS){const T=seg[sg].tai.get(String(r.t));const ost=one.filter(k=>{const s=seg[sg].st.get(k);return s&&s.o});
    const to=!!(T&&T.o);pts+=(to?+cfg.pts.tai[sg]||0:0)+ost.length*(+cfg.pts.st[sg]||0);code+=(to||ost.length)?'1':'0';
    const ix=T?(by==='tk'?T.u.tk:T.u.hy):null;const mv=T?(cfg.sub.metric==='tt'?T.u.tt:ix[cfg.sub.metric]):null;if(mv!=null)sub+=mv*(+cfg.sub.w[sg]||0)/100;
    res[sg]={o:to,ost,u:T&&T.u,ix}}
   out.push({s:r.s,t:r.t,m:r.m,g,pts,sub,score:pts+sub/1000000,code,mark:comboMark(code,cfg),seg:res,one})}}
 out.sort((a,b)=>b.score-a.score||String(a.t).localeCompare(String(b.t),'ja',{numeric:true}));out.forEach((x,i)=>x.rank=i+1);return out}
const api={calDays,SEGS,AXES,AXWIN,stKeys,DEF_CFG,comboMark,neraiList,stat,dev,segOf,stdBase,analyzeStore,finalize,analysisFor,judge,has,winIdx,winPicks,winSum,dow,addDay,nextDay,WIN,MET,RANK_KEYS,RANK_LABEL,DEF_GROUPS,DEF_ALIAS,normDate,normStore,normMachine,parseText,merge,typeOf,groupOf,den,build,monthFiles,rowsFromFile,fmtP,nz};
if(typeof module!=='undefined')module.exports=api;else root.NC=api;
})(this);
