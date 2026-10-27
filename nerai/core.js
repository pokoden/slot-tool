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
const api={WIN,MET,RANK_KEYS,RANK_LABEL,DEF_GROUPS,DEF_ALIAS,normDate,normStore,normMachine,parseText,merge,typeOf,groupOf,den,build,monthFiles,rowsFromFile,fmtP,nz};
if(typeof module!=='undefined')module.exports=api;else root.NC=api;
})(this);
