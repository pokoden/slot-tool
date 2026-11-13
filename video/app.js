'use strict';
// ===== 状態 =====
let MODE=null,TAB='search';const NAV={};const LISTS={};let LSEQ=0;
const NAME={music:'音楽',video:'動画'};
const FIL={music:LS.get('md_fil_music',null)||{},video:LS.get('md_fil_video',null)||{}};
const fil=()=>{const f=FIL[MODE];delete f.fav;f.sort=f.sort||'last';f.view=f.view||'all';f.tags=f.tags||[];return f};
const saveFil=()=>LS.set('md_fil_'+MODE,FIL[MODE]);
const lay=()=>LS.get('md_lay_'+MODE,'grid');
const PCF={music:new Map(),video:new Map()},PCDIR={music:null,video:null},PCNEED={music:false,video:false};
let EST={free:0,usage:0,quota:0};const LOW=5e9;
const SEL={music:new Set(),video:new Set()};             // 送る画面の選択
const SST={music:new Map(),video:new Map()};             // 送る画面のファイルごとの状態
let SENDING=false,SUM=null;
const MS={on:false,keys:new Set()};                        // 一覧の複数選択
const PICK=new Set();let PICKPL=null;                      // プレイリストへ追加の選択
const QH=new Map();                                        // 重複判定用の簡易ハッシュ
// 送り先のiPhone（つながっているiPhone、なければ前回のiPhone）
const tgtDev=()=>(TX.peer&&TX.peer.dev)||LS.get('md_last_peer','')||'';
const peerName=id=>id?(LS.get('md_peers',{})[id]||autoDevName(id)):'';
function sentTo(k,key){const d=tgtDev();if(!d)return it(k,key).sent>0;if(TX.peer&&TX.peer.dev===d&&TX.peer.hv)return TX.peer.hv[k].has(key);return it(k,key)['s_'+d]>0}
const SIDE=()=>LS.get('md_side',isPhone?'rx':'tx');

// ===== ライブラリ =====
function lib(k){k=k||MODE;const m=new Map();for(const f of DEV[k].values())m.set(f.key,{key:f.key,path:f.path,name:f.name,size:f.size,src:'dev',added:f.added,mime:f.mime,conv:!!f.conv,qh:f.qh});for(const f of PCF[k].values())if(!m.has(f.key))m.set(f.key,{key:f.key,path:f.path,name:f.name,size:f.size,src:'pc',added:f.lm,mime:mimeOf(f.name)});return[...m.values()]}
const libMap=k=>new Map(lib(k).map(e=>[e.key,e]));
const baseName=p=>p.split('/').pop().replace(/\.[^.]+$/,'');
function pathArtist(k,p){const s=p.split('/');if(k==='music'&&s.length>=3)return s[s.length-3];if(s.length>=2)return s[s.length-2];const b=baseName(p),i=b.indexOf(' - ');return i>0?b.slice(0,i).trim():''}
function autoTitle(k,e){const d=it(k,e.key);if(cleanTag(d.tt))return cleanTag(d.tt);const b=baseName(e.path),s=e.path.split('/');const i=b.indexOf(' - ');return s.length<2&&i>0?b.slice(i+3).trim():b}
const titleOf=(k,e)=>cleanTag(it(k,e.key).n)||autoTitle(k,e);
const autoArtist=(k,e)=>cleanTag(it(k,e.key).ta)||pathArtist(k,e.path)||'その他';
const artistOf=(k,e)=>cleanTag(it(k,e.key).a)||autoArtist(k,e);
function autoAlbum(k,e){const d=it(k,e.key);if(cleanTag(d.tal))return cleanTag(d.tal);const s=e.path.split('/');return k==='music'&&s.length>=3?s[s.length-2]:''}
const albumOf=(k,e)=>cleanTag(it(k,e.key).al)||autoAlbum(k,e);
const added=(k,e)=>e.added||0;
function sortL(k,a,s){const t=x=>titleOf(k,x);if(s==='name')return a.sort((x,y)=>t(x).localeCompare(t(y),'ja'));if(s==='add')return a.sort((x,y)=>added(k,y)-added(k,x));return a.sort((x,y)=>(it(k,y.key).last||0)-(it(k,x.key).last||0)||added(k,y)-added(k,x))}
function groupCount(L,f){const m=new Map();for(const e of L){const a=f(e);m.set(a,(m.get(a)||0)+1)}return[...m].sort((a,b)=>a[0].localeCompare(b[0],'ja'))}
const artists=k=>groupCount(lib(k),e=>artistOf(k,e));
const albums=k=>groupCount(lib(k),e=>albumOf(k,e)).filter(([a])=>a);
const allTags=k=>[...new Set(lib(k).flatMap(e=>it(k,e.key).tags||[]))].sort();
function userPls(k){return Object.entries(doc(k).pls).filter(([,p])=>!p.del).map(([id,p])=>({id,...p})).sort((a,b)=>(a.at||0)-(b.at||0))}
function autoPl(k,id){const L=lib(k);if(id==='_often')return L.filter(e=>(it(k,e.key).plays||0)>0).sort((a,b)=>(it(k,b.key).plays||0)-(it(k,a.key).plays||0)).slice(0,50).map(e=>e.key);return sortL(k,L,'add').slice(0,50).map(e=>e.key)}
function plKeys(k,id){if(id[0]==='_')return autoPl(k,id);const p=doc(k).pls[id];const m=libMap(k);return(p&&p.keys||[]).filter(x=>m.has(x))}
// お気に入り＝「お気に入り」という普通のプレイリスト（id: fav）
const isFav=(k,key)=>{const p=doc(k).pls.fav;return!!(p&&!p.del&&(p.keys||[]).includes(key))};
function setFav(k,keys,on){const d=doc(k);let p=d.pls.fav;if(!p||p.del){setPl(k,'fav','name','お気に入り');setPl(k,'fav','at',1);if(p&&p.del)setPl(k,'fav','del',false);p=d.pls.fav}
 let a=(p.keys||[]).slice();a=on?[...a,...keys.filter(x=>!a.includes(x))]:a.filter(x=>!keys.includes(x));setPl(k,'fav','keys',a);syncSoon(k)}
const plName=(k,id)=>id==='fav'?'お気に入り':id==='_often'?(k==='music'?'よく聴く':'よく見る'):id==='_new'?'最近追加':(doc(k).pls[id]||{}).name||'';
// 再生不可（この端末で）
const BADC=new Map();
// 再生不可は「実際に再生して失敗した」ものだけ
function badOf(k,e){const r=LS.get('md_bad',{})[k+'|'+e.key];return typeof r==='string'&&r!=='meta'?r:''}
if(LS.get('md_bad_v',0)<8){LS.set('md_bad',{});LS.set('md_bad_v',8)}
// 重複（この端末の中）
function devDup(k){const out=new Map(),ns=new Map(),qs=new Map();for(const f of[...DEV[k].values()].sort((a,b)=>(a.added||0)-(b.added||0))){const n=(f.name||'').toLowerCase()+'|'+f.size;if(ns.has(n)){out.set(f.key,'「'+ns.get(n)+'」と同じ');continue}if(f.qh&&qs.has(f.qh)){out.set(f.key,'「'+qs.get(f.qh)+'」と同じ中身');continue}ns.set(n,f.name);if(f.qh)qs.set(f.qh,f.name)}return out}
// 重複（PCのフォルダとiPhone）
async function quickHash(file){const M=1<<20,a=await file.slice(0,M).arrayBuffer(),b=file.size>M?await file.slice(Math.max(M,file.size-M)).arrayBuffer():new ArrayBuffer(0);const u=new Uint8Array(a.byteLength+b.byteLength+8);u.set(new Uint8Array(a));u.set(new Uint8Array(b),a.byteLength);new DataView(u.buffer).setFloat64(u.length-8,file.size);const h=new Uint8Array(await crypto.subtle.digest('SHA-256',u));return[...h.slice(0,10)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function ensureQH(k,list){for(const e of list){const id=k+'|'+e.key;if(QH.has(id))continue;try{QH.set(id,await quickHash(await e.get()))}catch(x){}}}
async function qhCollisions(k){const cnt=new Map();for(const e of PCF[k].values())cnt.set(e.size,(cnt.get(e.size)||0)+1);const ps=TX.peer&&TX.peer.have?(TX.peer.have[k]||[]).map(x=>+x.slice(x.lastIndexOf('|')+1)):[];for(const s of ps)cnt.set(s,(cnt.get(s)||0)+1);
 const L=[...PCF[k].values()].filter(e=>cnt.get(e.size)>1&&!QH.has(k+'|'+e.key));if(!L.length)return;await ensureQH(k,L);if(MODE===k&&TAB==='send')render()}
const PROBE=new Map();
const badSend=(k,e)=>badIOS(k,e.name)||probeIOS(PROBE.get(k+'|'+e.key));
async function probePC(k){if(k!=='video')return;let n=0;for(const e of[...PCF[k].values()]){const id=k+'|'+e.key;if(PROBE.has(id)||!MP4X.includes(extOf(e.name)))continue;try{PROBE.set(id,await mp4Probe(await e.get()))}catch(x){PROBE.set(id,null)}if(++n%20===0&&MODE===k&&TAB==='send'&&!SENDING)sendRender()}if(n&&MODE===k&&TAB==='send'&&!SENDING)render()}
function eligible(k){const D=dupPC(k),dupOK=LS.get('md_dupsend',false),conv=LS.get('md_conv',true);return e=>(dupOK||!D.has(e.key))&&(conv||!badSend(k,e))}
function dupPC(k){const out=new Map(),ns=new Map(),qs=new Map();const peer=TX.peer&&TX.peer.have?TX.peer.have[k]||[]:[];
 const pns=new Set(peer.map(x=>keyPath(x).split('/').pop().toLowerCase()+'|'+x.slice(x.lastIndexOf('|')+1)));const pq=new Set(Object.values((TX.peer&&TX.peer.hq&&TX.peer.hq[k])||{}));
 for(const e of[...PCF[k].values()].sort((a,b)=>a.path.localeCompare(b.path))){const n=e.name.toLowerCase()+'|'+e.size,q=QH.get(k+'|'+e.key);
  if(ns.has(n)){out.set(e.key,'「'+ns.get(n)+'」と同じ');continue}if(q&&qs.has(q)){out.set(e.key,'「'+qs.get(q)+'」と同じ中身');continue}ns.set(n,e.path);if(q)qs.set(q,e.path);
  if(!sentTo(k,e.key)&&(pns.has(n)||(q&&pq.has(q))))out.set(e.key,'iPhoneに同じものがある')}return out}

// ===== 描画部品 =====
const IC={home:'<path d="M12 3l9 8h-2.6v9h-4.9v-6h-3v6H5.6v-9H3z"/>',search:'<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15.5 15.5l5.5 5.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',pl:'<path d="M3 5h13v2.4H3zm0 5h13v2.4H3zm0 5h8v2.4H3zm12 0l7 4-7 4z"/>',fav:'<path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"/>',send:'<path d="M2 4h20v12H2zm2 2v8h16V6zM8 19h8v2H8z"/><path d="M12 7l3.5 3.5h-2.3v2.8h-2.4v-2.8H8.5z"/>',set:'<path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm9 4.6v-2.2l-2.4-.6-.7-1.6 1.3-2.1-1.6-1.6-2.1 1.3-1.6-.7L13.1 3h-2.2l-.6 2.4-1.6.7-2.1-1.3L5 6.4l1.3 2.1-.7 1.6-2.6.8v2.2l2.4.6.7 1.6-1.3 2.1L6.4 19l2.1-1.3 1.6.7.8 2.6h2.2l.6-2.4 1.6-.7 2.1 1.3 1.6-1.6-1.3-2.1.7-1.6z"/>'};
const svg=p=>`<svg viewBox="0 0 24 24" fill="currentColor">${p}</svg>`;
const TABS=[['home','ホーム'],['search','検索'],['pl','プレイリスト'],['send','PCから送る'],['set','設定']];
function reg(keys){const id='l'+(++LSEQ);LISTS[id]=keys;return id}
let DD=new Map();
function card(k,e,l,i){const d=it(k,e.key),ti=titleOf(k,e),bad=badOf(k,e),dp=DD.get(e.key);const dur=d.dur?`<span class="du">${fmtT(d.dur)}</span>`:'';
 return`<div class="it${MS.on&&MS.keys.has(e.key)?' sel':''}" data-l="${l}" data-i="${i}" data-key="${esc(e.key)}"><div class="th ${k}"><img data-tk="${esc(k+'|'+e.key)}" alt=""${k==='music'?` src="${letterArt(ti)}"`:''}>${dur}${isFav(k,e.key)?'<i class="fv">★</i>':''}<i class="ck">✓</i></div><div class="tx"><b>${esc(ti)}</b><span>${esc(artistOf(k,e))}${albumOf(k,e)?'・'+esc(albumOf(k,e)):''}</span>${bad||dp?`<span class="bdg">${bad?`<em class="bad">再生不可</em>`:''}${dp?`<em class="dp">重複</em>`:''}</span>`:''}</div>${MS.on?'':`<button class="mo" data-mk="${esc(e.key)}">⋯</button>`}</div>`}
function items(k,list){if(!list.length)return'';const l=reg(list.map(e=>e.key));return`<div class="${lay()==='grid'?'grid '+k:'list'}">${list.map((e,i)=>card(k,e,l,i)).join('')}</div>`}
const playBar=(keys,extra)=>{const l=reg(keys);return`<div class="pbar"><button data-play="${l}">▶ 再生</button><button class="sub" data-shuf="${l}">🔀 ランダム</button>${extra||''}</div>`};
const selBtn=()=>`<button class="sub nar${MS.on?' on':''}" data-msel="1">${MS.on?'選択終了':'選択'}</button>`;
const layBtn=()=>`<button class="sub ic" data-lay="1">${lay()==='grid'?'☰':'▦'}</button>`;
const sortSel=()=>{const f=fil();return`<select id="f_sort">${[['last',MODE==='music'?'最近聴いた順':'最近見た順'],['add','追加した順'],['name','名前順']].map(([v,t])=>`<option value="${v}"${f.sort===v?' selected':''}>${t}</option>`).join('')}</select>`};
const sec=(t,body,right)=>`<section><h2><span>${t}</span>${right||''}</h2>${body}</section>`;
const stTxt=st=>!st?'':st.s==='wait'?'待機':st.s==='prep'?'準備中':st.s==='conv'?'mp4に変換中 '+Math.round((st.p||0)*100)+'%':st.s==='send'?'送信中 '+Math.round((st.p||0)*100)+'%':st.s==='done'?'完了':st.s==='fail'?'失敗：'+(st.why||''):st.s==='dup'?'重複スキップ：'+(st.why||''):st.s==='recv'?'受信中 '+Math.round((st.p||0)*100)+'%':'';
const stCls=st=>!st?'':st.s==='done'?'ok':st.s==='fail'?'red':st.s==='dup'?'gd':'bl';

// ===== 画面 =====
function hdStatus(){let s=!tok()?'同期：未設定':SY.busy[MODE]?'同期中…':/^エラー/.test(SY.msg)?'同期エラー':SY.msg?SY.msg.replace('最終同期 ','同期 '):'';const c=TX.st==='接続済み'?((TX.peer&&TX.peer.dev?peerName(TX.peer.dev):'iPhone')+'と接続中'):RX.st==='接続済み'?'PC接続中':SENDING?'送信中':'';const cl=/エラー|未設定/.test(s)?'red':'';return`<span class="${cl}">${esc(s)}</span>${c?`<span class="ok">${c}</span>`:''}`}
function render(){if(!MODE){$('choose').hidden=false;$('app').hidden=true;return}$('choose').hidden=true;$('app').hidden=false;document.body.dataset.mode=MODE;
 for(const k in LISTS)delete LISTS[k];DD=devDup(MODE);
 const nav=NAV[TAB]||[];$('hd_back').hidden=!nav.length;$('hd_t').textContent=nav.length?nav[nav.length-1].title:NAME[MODE];$('hd_st').innerHTML=hdStatus();
 $('tabs').innerHTML=TABS.map(([id,t])=>`<button class="${TAB===id?'on':''}" data-tab="${id}">${svg(IC[id])}<span>${t}</span></button>`).join('');
 const top=nav[nav.length-1];let h='';
 try{h=top?subView(top):({search:vSearch,pl:vPls,send:vSend,set:vSet})[TAB]()}catch(e){h=`<div class="card red">${esc(e.message||e)}</div>`;console.error(e)}
 $('main').innerHTML=h;bulkBar();afterRender()}
function push(v){(NAV[TAB]=NAV[TAB]||[]).push(v);MS.on=false;MS.keys.clear();render();scrollTo(0,0)}
function filtered(){const k=MODE,f=fil();let L=lib(k);const q=(f.q||'').trim().toLowerCase();
 if(q)L=L.filter(e=>(titleOf(k,e)+' '+artistOf(k,e)+' '+albumOf(k,e)+' '+e.path+' '+(it(k,e.key).tags||[]).join(' ')).toLowerCase().includes(q));
 if(f.artist){const a=cleanTag(f.artist);L=L.filter(e=>artistOf(k,e)===a)}if(f.album){const a=cleanTag(f.album);L=L.filter(e=>albumOf(k,e)===a)}if(f.unw)L=L.filter(e=>!it(k,e.key).plays);
 if(f.tags.length)L=L.filter(e=>{const t=it(k,e.key).tags||[];return f.tags.every(x=>t.includes(x))});return sortL(k,L,f.sort)}
function vSearch(){const k=MODE,f=fil(),L=lib(k),tg=allTags(k);let h='';
 if(DEV[k].size&&EST.quota&&EST.free<LOW)h+=`<div class="warn" data-go="cand">空きが少ない（${fmtB(EST.free)}）</div>`;
 if(!L.length)return h+`<div class="empty"><button data-tab="send">PCから送る</button></div>`;
 const ar=artists(k),al=albums(k);
 h+=`<div class="srch"><input id="f_q" type="search" placeholder="曲名・アーティスト・アルバム" value="${esc(f.q||'')}" autocomplete="off"></div>
 <div class="ctl"><select id="f_art"><option value="">アーティスト</option>${ar.map(([a])=>`<option value="${esc(a)}"${cleanTag(f.artist)===a?' selected':''}>${esc(a)}</option>`).join('')}</select><select id="f_alb"><option value="">アルバム</option>${al.map(([a])=>`<option value="${esc(a)}"${cleanTag(f.album)===a?' selected':''}>${esc(a)}</option>`).join('')}</select></div>
 <div class="ctl">${sortSel()}${layBtn()}${selBtn()}</div>
 <div class="chips"><button class="chip${f.unw?' on':''}" data-ff="unw">${k==='video'?'未視聴':'未再生'}</button>${tg.map(t=>`<button class="chip${f.tags.includes(t)?' on':''}" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}</div>
 <div class="seg">${[['all','すべて'],['folder','フォルダ'],['artist','アーティスト'],['album','アルバム']].map(([v,t])=>`<button class="${f.view===v?'on':''}" data-view="${v}">${t}</button>`).join('')}</div>`;
 return h+`<div id="sres">${searchRes()}</div>`}
function searchRes(){const k=MODE,f=fil();let h='';const L=filtered();
 if(f.view==='folder'){const cur=f.folder||'';const sub=new Map(),here=[];for(const e of L){const p=e.path.split('/');p.pop();const dir=p.join('/');if(dir===cur)here.push(e);else if(cur===''||dir.startsWith(cur+'/')){const rest=(cur?dir.slice(cur.length+1):dir).split('/')[0];sub.set(rest,(sub.get(rest)||0)+1)}}
  h+=`<div class="crumb"><button class="lnk" data-fold="">📁</button>${cur?cur.split('/').map((s,i,a)=>`/<button class="lnk" data-fold="${esc(a.slice(0,i+1).join('/'))}">${esc(s)}</button>`).join(''):''}</div>`;
  h+=`<div class="rows">${[...sub].sort((a,b)=>a[0].localeCompare(b[0],'ja')).map(([s,n])=>`<button class="rowb" data-fold="${esc(cur?cur+'/'+s:s)}">📁 ${esc(s)}<i>${n}</i></button>`).join('')}</div>`;
  if(here.length)h+=playBar(here.map(e=>e.key))+items(k,here);return h}
 if(f.view==='artist'&&!f.artist){return`<div class="rows">${groupCount(L,e=>artistOf(k,e)).map(([a,n])=>`<button class="rowb" data-fart="${esc(a)}">${esc(a)}<i>${n}</i></button>`).join('')}</div>`}
 if(f.view==='album'&&!f.album){return`<div class="rows">${groupCount(L,e=>albumOf(k,e)||'').map(([a,n])=>`<button class="rowb" data-falb="${esc(a)}">${a?esc(a):'アルバムなし'}<i>${n}</i></button>`).join('')}</div>`}
 const af=[f.artist,f.album].filter(Boolean);if(af.length)h+=`<div class="chips">${f.artist?`<button class="chip on" data-clr="artist">${esc(f.artist)} ✕</button>`:''}${f.album?`<button class="chip on" data-clr="album">${esc(f.album)} ✕</button>`:''}</div>`;
 if(L.length)h+=playBar(L.map(e=>e.key),`<span class="cnt">${L.length}件</span>`);return h+items(k,L)}
function vPls(){const k=MODE;const P=[['fav','お気に入り'],['_often',plName(k,'_often')],['_new','最近追加'],...userPls(k).filter(p=>p.id!=='fav').map(p=>[p.id,p.name])];
 return`<div class="pbar"><button data-newpl="1">＋ 新しいプレイリスト</button></div><div class="rows">${P.map(([id,n])=>`<button class="rowb" data-pl="${esc(id)}">${id==='fav'?'★ ':id[0]==='_'?'⚡ ':'≡ '}${esc(n)}<i>${plKeys(k,id).length}</i></button>`).join('')}</div>`}
function vPl(id){const k=MODE,keys=plKeys(k,id),m=libMap(k),L=keys.map(x=>m.get(x));const auto=id[0]==='_';
 let h=keys.length?playBar(keys):'';
 if(!auto)h+=`<div class="pbar"><button data-pick="${esc(id)}">＋ 追加</button>${id==='fav'?'':`<button class="sub" data-plren="${esc(id)}">名前</button><button class="sub dng" data-pldel="${esc(id)}">削除</button>`}</div>`;
 h+=`<div class="ctl">${auto?layBtn():''}${selBtn()}</div>`;
 if(auto||MS.on)return h+items(k,L);const l=reg(keys);
 return h+`<div class="list ed">${L.map((e,i)=>{const ti=titleOf(k,e);return`<div class="it" data-l="${l}" data-i="${i}" data-key="${esc(e.key)}"><div class="th ${k}"><img data-tk="${esc(k+'|'+e.key)}" alt=""${k==='music'?` src="${letterArt(ti)}"`:''}></div><div class="tx"><b>${esc(ti)}</b><span>${esc(artistOf(k,e))}</span>${badOf(k,e)?'<span class="bdg"><em class="bad">再生不可</em></span>':''}</div><div class="ord"><button class="sub" data-mv="${i}" data-pid="${esc(id)}" data-d="-1">▲</button><button class="sub" data-mv="${i}" data-pid="${esc(id)}" data-d="1">▼</button><button class="sub" data-rm="${i}" data-pid="${esc(id)}">✕</button></div></div>`}).join('')}</div>`}
function subView(v){if(v.t==='pl')return vPl(v.id);if(v.t==='cand')return vCand();return''}
function cands(k){return[...DEV[k].values()].map(f=>({...f,d:it(k,f.key)})).sort((a,b)=>(a.d.plays||0)-(b.d.plays||0)||(a.d.last||0)-(b.d.last||0)||b.size-a.size).slice(0,30)}
function vCand(){const k=MODE,m=libMap(k);const L=cands(k);return`<div class="card"><div class="kv"><span>空き</span><b class="${EST.free<LOW?'red':''}">${fmtB(EST.free)}</b></div></div><div class="list">${L.map(f=>{const e=m.get(f.key)||{key:f.key,path:f.path};const ti=titleOf(k,e);return`<div class="it"><div class="th ${k}"><img data-tk="${esc(k+'|'+f.key)}" alt=""${k==='music'?` src="${letterArt(ti)}"`:''}></div><div class="tx"><b>${esc(ti)}</b><span>${fmtB(f.size)}・${f.d.plays||0}回</span></div><button class="sub dng nar" data-delk="${esc(f.key)}">削除</button></div>`}).join('')}</div>`}
// --- 送る・受け取る ---
function vSend(){const side=SIDE();let h=`<div class="seg">${[['tx','PCから送る'],['rx','iPhoneで受け取る']].map(([v,t])=>`<button class="${side===v?'on':''}" data-side="${v}">${t}</button>`).join('')}</div>`;
 if(!tok())h+=`<div class="warn" data-tab="set">GitHubトークンを設定してね</div>`;
 return h+(side==='tx'?vTx(MODE):vRx(MODE))}
const micRow=()=>NET.st?`<div class="kv"><span>マイク</span><b class="${NET.st==='ng'?'red':''}">${esc(NET.txt())}</b></div>`:'';
function vRx(k){const L=RX.log.filter(x=>x.kind===k);const n=L.length,dn=L.filter(x=>x.st==='done').length,fl=L.filter(x=>x.st==='fail').length,dp=L.filter(x=>x.st==='dup').length;
 let h=`<div class="card"><div class="kv"><span>この端末</span><b>${esc(devName())}</b></div><div class="kv"><span>状態</span><b class="${/失敗/.test(RX.st)?'red':RX.st==='接続済み'?'ok':''}">${esc(RX.st||'停止')}</b></div>${micRow()}<div class="kv"><span>使用</span><b>${fmtB(EST.usage)}</b></div><div class="kv"><span>空き</span><b class="${EST.free<LOW?'red':''}">${fmtB(EST.free)}</b></div>
 ${RX.why?`<div class="red">${esc(RX.why)}</div>`:''}<button id="rx_btn" class="${RX.on?'sub':''}">${RX.on?'受け取りをやめる':'受け取りを始める'}</button>${RX.on?'<button data-rxre="1">再接続</button>':''}</div>`;
 if(n){const tot=L.reduce((a,x)=>a+x.size,0),got=L.reduce((a,x)=>a+(x.st==='done'?x.size:x.st==='recv'?x.got||0:0),0);
  h+=`<div class="card"><div class="kv"><span>完了 ${dn} / ${n}${fl?'・失敗 '+fl:''}${dp?'・重複 '+dp:''}</span><b>${fmtB(got)} / ${fmtB(tot)}</b></div><div class="prog"><div style="width:${tot?(got/tot*100).toFixed(1):0}%"></div></div>
  ${L.map(x=>{const st={s:x.st,p:x.size?(x.got||0)/x.size:0,why:x.why};return`<div class="fr"><span>${esc(x.name)}</span><b class="${stCls(st)}">${esc(stTxt(st))}</b></div>`}).join('')}</div>`}
 return h}
function vTx(k){const F=PCF[k];let h=`<div class="card">`;
 h+=`<div class="pbar"><button data-pickdir="1">${PCDIR[k]?'フォルダを選び直す':'フォルダを選ぶ'}</button>${PCNEED[k]?`<button data-reopen="1">「${esc(PCDIR[k].name)}」を開く</button>`:''}</div>`;
 const pn=TX.peer&&TX.peer.dev?peerName(TX.peer.dev):'',ln=peerName(LS.get('md_last_peer',''));
 h+=`<div class="kv"><span>${pn?esc(pn):'iPhone'}</span><b class="${/失敗|切れ|エラー|時間切れ/.test(TX.st)?'red':TX.st==='接続済み'?'ok':''}">${esc(TX.st||'未接続')}</b></div>${!pn&&ln?`<div class="kv"><span>✓の基準</span><b>前回の${esc(ln)}</b></div>`:''}${micRow()}${TX.why&&/失敗|切断/.test(TX.st)?`<div class="red">${esc(TX.why)}</div>`:''}${TX.peer?`<div class="kv"><span>iPhoneの空き</span><b>${fmtB(TX.peer.free)}</b></div>`:''}
 <div class="pbar"><button data-conn="1" class="${TX.st==='接続済み'?'sub':''}">${TX.st==='接続済み'?'つなぎ直す':/失敗|時間切れ|切断|エラー/.test(TX.st)?'再接続':'iPhoneとつなぐ'}</button>${TX.st?'<button class="sub" data-disc="1">切断</button>':''}</div></div>`;
 if(!F.size)return h;
 const conv=LS.get('md_conv',true),dupOK=LS.get('md_dupsend',false);
 h+=`<div class="card"><label class="tg"><span>再生不可はmp4に変換して送る</span><input type="checkbox" id="s_conv"${conv?' checked':''}></label><label class="tg"><span>重複も送る</span><input type="checkbox" id="s_dups"${dupOK?' checked':''}></label></div>`;
 const NW=new Set(LS.get('md_new_'+k,[]));const L=[...F.values()].sort((a,b)=>a.path.localeCompare(b.path,'ja'));const D=dupPC(k),ST2=SST[k];
 const sent=e=>sentTo(k,e.key),isNew=e=>!sent(e)&&NW.has(e.key),bad=e=>badSend(k,e);
 const sf=LS.get('md_sf_'+k,'all');const S=SEL[k];let selB=0;for(const x of S){const e=F.get(x);if(e)selB+=e.size}const over=TX.peer&&selB>TX.peer.free;
 // 全体の状態
 let sum='';if(SUM&&SUM.k===k){const ks=SUM.keys,c={done:0,fail:0,dup:0};let b=0;for(const x of ks){const st=ST2.get(x),e=F.get(x);if(!st||!e)continue;if(c[st.s]!=null)c[st.s]++;if(st.s==='done')b+=e.size;else if(st.s==='send')b+=(st.p||0)*e.size}
  sum=`<div class="kv"><span>${SENDING?'送信中':'終了'}：完了 ${c.done} / ${ks.length}${c.fail?'・失敗 '+c.fail:''}${c.dup?'・重複スキップ '+c.dup:''}</span><b>${fmtB(b)} / ${fmtB(SUM.total)}${SENDING&&SUM.sp?'・'+fmtB(SUM.sp)+'/秒':''}</b></div><div class="prog"><div style="width:${SUM.total?(b/SUM.total*100).toFixed(1):0}%"></div></div>`}
 h+=`<div class="card sendbox"><div class="kv"><span>選択 ${S.size}件</span><b class="${over?'red':''}">${fmtB(selB)}${TX.peer?' / 空き '+fmtB(TX.peer.free):''}</b></div>${sum}
 <div class="pbar">${SENDING?'<button class="sub dng" data-sstop="1">中止</button>':`<button data-dosend="1" ${S.size&&TX.st==='接続済み'?'':'disabled'}>送る</button>`}</div><div class="pbar"><button class="sub" data-selall="1">全て選択</button><button class="sub" data-selclr="1">全て解除</button><button class="sub" data-selnew="1">未送信だけ選択</button></div></div>`;
 const cnt=f=>L.filter(f).length;
 h+=`<div class="seg wrap">${[['all','すべて '+L.length],['un','未送信 '+cnt(e=>!sent(e))],['new','NEW '+cnt(isNew)],['sent','送信済み '+cnt(sent)],['bad','再生不可 '+cnt(e=>bad(e))],['dup','重複 '+D.size]].map(([v,t])=>`<button class="${sf===v?'on':''}" data-sf="${v}">${t}</button>`).join('')}</div>`;
 const V=L.filter(e=>sf==='un'?!sent(e):sf==='new'?isNew(e):sf==='sent'?sent(e):sf==='bad'?bad(e):sf==='dup'?D.has(e.key):true);
 const G=new Map();for(const e of V){const d=e.path.includes('/')?e.path.slice(0,e.path.lastIndexOf('/')):'';if(!G.has(d))G.set(d,[]);G.get(d).push(e)}
 const EL=eligible(k);for(const[d,a]of G){const ae=a.filter(EL);const all=ae.length?ae.every(e=>S.has(e.key)):a.every(e=>S.has(e.key));h+=`<div class="fold"><label class="fh"><input type="checkbox" data-selfold="${esc(d)}"${all?' checked':''}><b>📁 ${esc(d||PCDIR[k]&&PCDIR[k].name||'/')}</b><i>${a.length}件・${fmtB(a.reduce((s,e)=>s+e.size,0))}</i></label>
  ${a.map(e=>{const st=ST2.get(e.key),b=bad(e);return`<label class="fr"><input type="checkbox" data-sel="${esc(e.key)}"${S.has(e.key)?' checked':''}><span>${esc(e.name)}</span>${sent(e)?'<i class="ok">✓</i>':isNew(e)?'<i class="nw">NEW</i>':''}${b?`<i class="bad" title="${esc(b)}">再生不可${conv?'→mp4':''}</i>`:''}${D.has(e.key)?`<i class="dp" title="${esc(D.get(e.key))}">重複</i>`:''}${st?`<b class="${stCls(st)}">${esc(stTxt(st))}</b>`:`<em>${fmtB(e.size)}</em>`}</label>`}).join('')}</div>`}
 return h}
function vSet(){const k=MODE;return`<div class="card"><h3>この端末の名前</h3><div class="pbar"><input id="s_dname" type="text" value="${esc(devName())}" autocomplete="off"><button class="nar" data-savedname="1">保存</button></div></div><div class="card"><h3>GitHubトークン</h3><div class="pbar"><input id="s_tok" type="password" autocomplete="off" placeholder="${tok()?'保存済み':'github_pat_…'}"><button class="nar" data-savetok="1">保存</button></div>
 <div class="kv"><span>同期</span><b class="${/エラー/.test(SY.msg)||!tok()?'red':''}">${esc(tok()?SY.msg||'':'未設定')}</b></div><button class="sub" data-syncnow="1">今すぐ同期</button></div>
 <div class="card"><h3>保存</h3><div class="kv"><span>使用</span><b>${fmtB(EST.usage)}</b></div><div class="kv"><span>空き</span><b class="${EST.free<LOW?'red':''}">${fmtB(EST.free)}</b></div><div class="kv"><span>${NAME[k]}（この端末）</span><b>${DEV[k].size}件</b></div><div class="kv"><span>保存方式</span><b>${ST.mode==='opfs'?'OPFS':'IndexedDB'}</b></div><div class="kv"><span>消えない設定</span><b id="s_pers">…</b></div>
 <button class="sub" data-go="cand">消す候補</button></div>
 <div class="card"><h3>再生</h3><label class="tg"><span>音量をそろえる</span><input type="checkbox" id="s_norm"${LS.get('md_norm',true)?' checked':''}></label><label class="tg"><span>画面を消さない時間</span><select id="s_wl" class="wsel">${[[30,'30分'],[60,'60分'],[120,'120分'],[0,'ずっと']].map(([v,t])=>`<option value="${v}"${LS.get('md_wl_min',60)===v?' selected':''}>${t}</option>`).join('')}</select></label><label class="tg"><span>自動で次へ</span><input type="checkbox" id="s_auto"${LS.get('md_auto',true)?' checked':''}></label></div>
 <div class="card"><button class="sub" data-thall="1">サムネを作り直す</button><button class="sub" data-home="1">最初の画面に戻る</button></div>`}
// --- 複数選択のバー ---
function bulkBar(){const b=$('bulk');if(!MS.on||!MODE){b.hidden=true;document.body.classList.remove('hasbulk');return}b.hidden=false;document.body.classList.add('hasbulk');const n=MS.keys.size,dv=[...MS.keys].filter(x=>DEV[MODE].has(x)).length;
 b.innerHTML=`<div class="bk1"><b>${n}件選択</b><button class="sub" data-bk="all">全部</button><button class="sub" data-bk="none">解除</button><button class="sub" data-msel="1">終了</button></div><div class="bk2"><button data-bk="pl" ${n?'':'disabled'}>＋プレイリスト</button><button data-bk="al" ${n?'':'disabled'}>アルバム</button><button data-bk="ar" ${n?'':'disabled'}>アーティスト</button><button data-bk="fav" ${n?'':'disabled'}>★</button><button data-bk="tag" ${n?'':'disabled'}>タグ</button><button class="dngb" data-bk="del" ${dv?'':'disabled'}>削除${dv?' '+dv:''}</button></div>`}
function shownKeys(){const s=new Set();for(const el of document.querySelectorAll('#main .it[data-key]'))s.add(el.dataset.key);return[...s]}
function sheetIn(title,val,cb,ph){SHCB=cb;sheet(`<h3>${esc(title)}</h3><input id="sh_in" type="text" value="${esc(val||'')}" placeholder="${esc(ph||'')}"><div class="pbar"><button data-shok="1">保存</button></div><button class="sub" data-close="1">閉じる</button>`);setTimeout(()=>{const i=$('sh_in');if(i)i.focus()},50)}
let SHCB=null;
const common=(keys,f)=>{const v=new Set(keys.map(f));return v.size===1?[...v][0]:''};
async function bulk(act){const k=MODE,keys=[...MS.keys],m=libMap(k),E=keys.map(x=>m.get(x)||{key:x,path:keyPath(x)});
 if(act==='all'){for(const x of shownKeys())MS.keys.add(x);render();return}if(act==='none'){MS.keys.clear();render();return}if(!keys.length)return;
 if(act==='pl'){const U=userPls(k);sheet(`<h3>${keys.length}件をプレイリストに追加</h3><div class="rows">${U.map(p=>`<button class="rowb" data-bkpl="${esc(p.id)}">≡ ${esc(p.name)}<i>${(p.keys||[]).length}</i></button>`).join('')}</div><div class="pbar"><button class="sub" data-bkplnew="1">＋ 新しいプレイリスト</button></div><button class="sub" data-close="1">閉じる</button>`);return}
 if(act==='al'){sheetIn('アルバム名（'+keys.length+'件）',common(E,e=>albumOf(k,e)),v=>{for(const e of E)setF(k,e.key,'al',v)});return}
 if(act==='ar'){sheetIn('アーティスト名（'+keys.length+'件）',common(E,e=>artistOf(k,e)),v=>{for(const e of E)setF(k,e.key,'a',v)});return}
 if(act==='tag'){sheetIn('タグを追加（'+keys.length+'件）','',v=>{const t=v.split(/[,、，\s]+/).map(s=>s.trim()).filter(Boolean);for(const e of E){const o=it(k,e.key).tags||[];setF(k,e.key,'tags',[...new Set([...o,...t])])}},'例：ライブ, 好き');return}
 if(act==='fav'){const all=keys.every(x=>isFav(k,x));setFav(k,keys,!all);render();return}
 if(act==='del'){const dv=keys.filter(x=>DEV[k].has(x));if(!dv.length)return;if(!confirm(`${dv.length}件をこのiPhoneから削除する？\nPCの元ファイルは消えないよ`))return;for(const x of dv)await delDevKey(k,x);MS.keys.clear();EST=await storageEst();syncSoon(k);render();return}}
function addToPl(k,id,keys){const p=doc(k).pls[id];const a=(p&&p.keys||[]).slice();for(const x of keys)if(!a.includes(x))a.push(x);setPl(k,id,'keys',a);syncSoon(k)}
// --- プレイリストに曲・動画を追加（検索して複数選択） ---
function openPicker(id){PICK.clear();PICKPL=id;sheet(`<h3>${esc(plName(MODE,id))}に追加</h3><input id="pk_q" type="search" placeholder="検索" autocomplete="off"><div id="pk_list" class="rows pk"></div><div class="pbar"><button id="pk_add" data-pkadd="1" disabled>追加</button></div><button class="sub" data-close="1">閉じる</button>`);pkList()}
function pkList(){const k=MODE,q=(($('pk_q')||{}).value||'').trim().toLowerCase(),inPl=new Set(plKeys(k,PICKPL));let L=sortL(k,lib(k),'name');if(q)L=L.filter(e=>(titleOf(k,e)+' '+artistOf(k,e)+' '+albumOf(k,e)+' '+e.path).toLowerCase().includes(q));
 $('pk_list').innerHTML=L.slice(0,300).map(e=>inPl.has(e.key)?`<div class="fr"><span>${esc(titleOf(k,e))}</span><i class="ok">追加済み</i></div>`:`<label class="fr"><input type="checkbox" data-pk="${esc(e.key)}"${PICK.has(e.key)?' checked':''}><span>${esc(titleOf(k,e))}</span><em>${esc(artistOf(k,e))}</em></label>`).join('');pkBtn()}
function pkBtn(){const b=$('pk_add');if(b){b.disabled=!PICK.size;b.textContent=PICK.size?`追加（${PICK.size}件）`:'追加'}}

// ===== サムネ読み込み =====
const TH={mem:new Map(),q:[],busy:false,io:null,
 async get(id){if(this.mem.has(id))return this.mem.get(id);const v=await IDB.get('thumbs',id);if(v)this.mem.set(id,v);return v},
 set(id,v){this.mem.set(id,v);for(const img of document.querySelectorAll('img[data-tk]'))if(img.dataset.tk===id)img.src=v;return IDB.put('thumbs',id,v)},
 want(id){if(!this.q.includes(id))this.q.push(id);this.run()},
 async run(){if(this.busy)return;this.busy=true;try{while(this.q.length){const id=this.q.shift();const[k,...r]=id.split('|');const key=r.join('|');if(await this.get(id))continue;if(LS.get('md_nometa',{})[id])continue;try{const b=await blobOf(k,key);if(!b)continue;const name=keyPath(key);const o=await metaOf(k,b,name);if(o.bad&&k==='video'){const B=LS.get('md_nometa',{});if(!B[id]){B[id]=1;LS.set('md_nometa',B)}}
   let ch=false;for(const f of['dur','ta','tt','tal'])if(o[f]!=null)if(setF(k,key,f,o[f],1)){ch=true;syncSoon(k,8000)}if(ch&&(o.ta||o.tt||o.tal))softRender();if(o.thumb)await this.set(id,o.thumb);else this.mem.set(id,'');}catch(e){}}}finally{this.busy=false}}};
let srT=null;function softRender(){clearTimeout(srT);srT=setTimeout(()=>{if(!MODE||!$('sheet').hidden||(document.activeElement&&document.activeElement.matches('input,select')))return;const y=scrollY;render();scrollTo(0,y)},1200)}
function afterRender(){if(!TH.io)TH.io=new IntersectionObserver(es=>{for(const en of es)if(en.isIntersecting){const img=en.target;TH.io.unobserve(img);const id=img.dataset.tk;TH.get(id).then(v=>{if(v)img.src=v;else if(v!==''){TH.want(id)}})}},{rootMargin:'300px'});
 for(const img of document.querySelectorAll('#main img[data-tk]'))TH.io.observe(img);
 if(TAB==='set'&&$('s_pers'))navigator.storage&&navigator.storage.persisted&&navigator.storage.persisted().then(p=>{if($('s_pers'))$('s_pers').textContent=p?'ON':'OFF'})}
async function blobOf(k,key){const f=DEV[k].get(key);if(f)return ST.file(f.fn,f.mime||mimeOf(f.path));const p=PCF[k].get(key);if(p){const x=await p.get();return new Blob([x],{type:mimeOf(p.name)})}return null}

// ===== PCフォルダ =====
async function scanDir(k,dh){const m=new Map();async function walk(h,pre){for await(const[n,e]of h.entries()){if(n[0]==='.')continue;if(e.kind==='directory')await walk(e,pre+n+'/');else if(kindOf(n)===k){const f=await e.getFile();const path=pre+n,key=fkey(path,f.size);m.set(key,{key,path,name:n,size:f.size,lm:f.lastModified,get:()=>e.getFile()})}}}await walk(dh,'');return m}
function scanFiles(k,files){const m=new Map();for(const f of files){const rp=(f.webkitRelativePath||f.name).split('/');if(rp.length>1)rp.shift();const path=rp.join('/');if(kindOf(f.name)!==k)continue;const key=fkey(path,f.size);m.set(key,{key,path,name:f.name,size:f.size,lm:f.lastModified,get:async()=>f})}return m}
function setPC(k,m,name){PCF[k]=m;if(!PCDIR[k])PCDIR[k]={name};const kn=LS.get('md_known_'+k,null);
 if(kn){const ks=new Set(kn),nw=new Set(LS.get('md_new_'+k,[]));for(const x of m.keys())if(!ks.has(x))nw.add(x);LS.set('md_new_'+k,[...nw].filter(x=>m.has(x)&&!sentTo(k,x)))}
 LS.set('md_known_'+k,[...new Set([...(kn||[]),...m.keys()])]);
 for(const e of m.values())if(it(k,e.key).add==null)setF(k,e.key,'add',e.lm,1);qhCollisions(k);probePC(k);if(MODE)render()}
async function pickDir(){const k=MODE;if(window.showDirectoryPicker){try{const h=await showDirectoryPicker({id:'media_'+k,mode:'read'});PCDIR[k]=h;PCNEED[k]=false;await IDB.put('kv','dir_'+k,h);const m=await scanDir(k,h);setPC(k,m,h.name)}catch(e){if(e.name!=='AbortError')alert(e.message)}return}
 const inp=document.createElement('input');inp.type='file';inp.webkitdirectory=true;inp.multiple=true;inp.onchange=()=>{const fs=[...inp.files];const root=(fs[0]&&fs[0].webkitRelativePath||'').split('/')[0];PCDIR[k]={name:root};setPC(k,scanFiles(k,fs),root)};inp.click()}
async function reopenDir(){const k=MODE,h=PCDIR[k];try{if(await h.requestPermission({mode:'read'})==='granted'){PCNEED[k]=false;const m=await scanDir(k,h);setPC(k,m,h.name)}}catch(e){alert(e.message)}}
async function restoreDirs(){for(const k of['music','video']){try{const h=await IDB.get('kv','dir_'+k);if(!h||!h.queryPermission)continue;PCDIR[k]=h;if(await h.queryPermission({mode:'read'})==='granted'){setPC(k,await scanDir(k,h),h.name)}else PCNEED[k]=true}catch(e){}}}
let rT=0;function sendRender(){const n=Date.now();if(n-rT>300){rT=n;if(TAB==='send')render()}else{clearTimeout(sendRender._t);sendRender._t=setTimeout(()=>{rT=Date.now();if(TAB==='send')render()},300)}}
async function doSend(){const k=MODE;if(SENDING)return;const S=[...SEL[k]].map(x=>PCF[k].get(x)).filter(Boolean).sort((a,b)=>a.path.localeCompare(b.path,'ja'));if(!S.length)return;
 const conv=LS.get('md_conv',true),dupOK=LS.get('md_dupsend',false);SENDING=true;SST[k]=new Map();for(const e of S)SST[k].set(e.key,{s:'wait'});SUM={k,keys:S.map(e=>e.key),total:S.reduce((a,e)=>a+e.size,0),sp:0};render();
 await ensureQH(k,S);const D=dupPC(k);const list=[];
 for(const e of S){if(!dupOK&&D.has(e.key)){SST[k].set(e.key,{s:'dup',why:D.get(e.key)});SEL[k].delete(e.key);continue}const x={kind:k,key:e.key,path:e.path,name:e.name,size:e.size,mime:mimeOf(e.name),get:e.get,conv:!!(badSend(k,e)&&conv)};
  x.prep=async()=>{const id=k+'|'+x.key,d=it(k,x.key);let th=await TH.get(id);if(th==null||d.dur==null){try{const o=await metaOf(k,new Blob([await x.get()],{type:x.mime}),x.name);if(o.thumb){th=o.thumb;await TH.set(id,th)}for(const f of['dur','ta','tt','tal'])if(o[f]!=null)setF(k,x.key,f,o[f],1)}catch(er){}}
   if(k==='music'&&d.g==null&&LS.get('md_norm',true)&&!x.conv){const g=await loudOf(await x.get());if(g)setF(k,x.key,'g',g,1)}
   const dd=it(k,x.key);return{thumb:th||null,dur:dd.dur,ta:dd.ta,tt:dd.tt,tal:dd.tal,g:dd.g,qh:QH.get(id)||null}};list.push(x)}
 SUM.total=list.reduce((a,x)=>a+x.size,0);SUM.keys=S.map(e=>e.key);
 if(TX.peer&&SUM.total>TX.peer.free&&!confirm('iPhoneの空きが足りないかも。送る？')){SENDING=false;SST[k]=new Map();SUM=null;render();return}
 let last={t:Date.now(),b:0},bytes=0;
 try{await TX.send(list,(x,s,v,inc)=>{const o=SST[k].get(x.key)||{};if(s==='send'){o.s='send';o.p=v;if(inc)bytes+=inc}else if(s==='conv'){o.s='conv';o.p=v}else if(s==='prep'){o.s='prep'}else if(s==='done'){o.s='done';o.p=1}else if(s==='fail'){o.s='fail';o.why=v}else if(s==='dup'){o.s='dup';o.why=v}SST[k].set(x.key,o);
   const n=Date.now();if(n-last.t>1000){SUM.sp=(bytes-last.b)/((n-last.t)/1000);last={t:n,b:bytes}}if(s==='done'||s==='dup')SEL[k].delete(x.key);sendRender()})}
 catch(e){for(const x of list){const o=SST[k].get(x.key);if(o&&!['done','dup','fail'].includes(o.s))SST[k].set(x.key,{s:'fail',why:e.message||String(e)})}}
 finally{SENDING=false;syncNow(k);render()}}

// ===== 項目メニュー =====
function sheet(h){$('sheet_in').innerHTML=h;$('sheet').hidden=false}
function closeSheet(){$('sheet').hidden=true;$('sheet_in').innerHTML='';SHCB=null}
function itemMenu(key){const k=MODE,e=libMap(k).get(key)||{key,path:keyPath(key)},d=it(k,key),bad=badOf(k,e),dp=devDup(k).get(key);
 sheet(`<h3>${esc(titleOf(k,e))}</h3>${bad?`<div class="red">再生不可：${esc(bad)}</div>`:''}${dp?`<div class="gd">重複：${esc(dp)}</div>`:''}<div class="pbar"><button class="sub" data-sfav="${esc(key)}">${isFav(k,key)?'★ お気に入り解除':'☆ お気に入り'}</button><button class="sub" data-addpl="${esc(key)}">＋ プレイリスト</button></div>
 <label class="fl"><span>名前</span><input id="e_n" type="text" value="${esc(titleOf(k,e))}"></label><label class="fl"><span>アーティスト</span><input id="e_a" type="text" value="${esc(artistOf(k,e))}"></label><label class="fl"><span>アルバム</span><input id="e_al" type="text" value="${esc(albumOf(k,e))}"></label>
 <label class="fl"><span>タグ</span><input id="e_t" type="text" value="${esc((d.tags||[]).join(', '))}"></label>
 <div class="pbar"><button data-esave="${esc(key)}">保存</button></div><div class="pbar">${DEV[k].has(key)?`<button class="sub dng" data-delk="${esc(key)}">この端末から削除</button>`:''}<button class="sub" data-rth="${esc(key)}">サムネを作り直す</button></div><button class="sub" data-close="1">閉じる</button>`)}
function saveEdit(key){const k=MODE,e=libMap(k).get(key)||{key,path:keyPath(key)},d=it(k,key);
 const n=$('e_n').value.trim(),a=$('e_a').value.trim(),al=$('e_al').value.trim(),t=$('e_t').value.split(/[,、，]/).map(s=>s.trim()).filter(Boolean);
 const aT=autoTitle(k,e),aA=autoArtist(k,e),aL=autoAlbum(k,e);
 if(n!==titleOf(k,e))setF(k,key,'n',n===aT?'':n);if(a!==artistOf(k,e))setF(k,key,'a',a===aA?'':a);if(al!==albumOf(k,e))setF(k,key,'al',al===aL?'':al);
 if(JSON.stringify(t)!==JSON.stringify(d.tags||[]))setF(k,key,'tags',t);
 syncSoon(k);closeSheet();render();if(P.key===key)P.ui()}
function addPlMenu(key){const k=MODE,U=userPls(k);sheet(`<h3>プレイリストに追加</h3><div class="rows">${U.map(p=>`<label class="fr"><input type="checkbox" data-plt="${esc(p.id)}" data-key="${esc(key)}"${(p.keys||[]).includes(key)?' checked':''}><span>${esc(p.name)}</span></label>`).join('')}</div><div class="pbar"><button class="sub" data-newpl="1" data-key="${esc(key)}">＋ 新しいプレイリスト</button></div><button class="sub" data-close="1">閉じる</button>`)}
function newPl(keys,after){sheetIn('新しいプレイリストの名前','',v=>{if(!v)return;const k=MODE,id='p'+Date.now().toString(36);setPl(k,id,'name',v);setPl(k,id,'at',Date.now());setPl(k,id,'keys',keys||[]);if(after)setTimeout(after,0)})}
async function delDevKey(k,key){const f=DEV[k].get(key);if(!f)return;if(P.key===key&&P.kind===k)P.stop();await ST.remove(f.fn);await IDB.del('files',k+'|'+key);DEV[k].delete(key);setF(k,key,'s_'+MYDEV,0)}
async function delDev(key){const k=MODE,f=DEV[k].get(key);if(!f)return;if(!confirm(`「${titleOf(k,libMap(k).get(key)||{key,path:f.path})}」をこの端末から削除する？\nPCの元ファイルは消えないよ`))return;
 await delDevKey(k,key);syncSoon(k);EST=await storageEst();closeSheet();render()}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

// ===== イベント =====
document.addEventListener('click',async ev=>{const t=ev.target.closest('button,[data-l],[data-go],[data-tab],.warn,label,#hd_st');if(!t)return;const ds=t.dataset;
 if(t.id==='hd_st'){TAB=SENDING||TX.st||RX.st?'send':'set';NAV[TAB]=[];render();return}
 if(ds.mode){MODE=ds.mode;for(const x in NAV)delete NAV[x];LS.set('md_last',MODE);TAB='search';MS.on=false;MS.keys.clear();render();syncNow(MODE);return}
 if(ds.tab==='home'){goHome();return}
 if(ds.tab){if(TAB===ds.tab)NAV[TAB]=[];TAB=ds.tab;MS.on=false;MS.keys.clear();closeSheet();render();scrollTo(0,0);if(TAB==='send'||TAB==='set')refreshEst();return}
 if(ds.mk){ev.stopPropagation();itemMenu(ds.mk);return}
 if(ds.l&&!t.closest('.ord')&&!ds.delk){if(MS.on){const key=ds.key;if(!key)return;MS.keys.has(key)?MS.keys.delete(key):MS.keys.add(key);t.classList.toggle('sel',MS.keys.has(key));bulkBar();return}const keys=LISTS[ds.l];if(keys)P.play(MODE,keys,+ds.i,false);return}
 if(ds.play){P.play(MODE,LISTS[ds.play],0,false);return}if(ds.shuf){P.play(MODE,LISTS[ds.shuf],0,true);return}
 if(ds.msel){MS.on=!MS.on;MS.keys.clear();render();return}
 if(ds.bk){bulk(ds.bk);return}
 if(ds.bkpl){addToPl(MODE,ds.bkpl,[...MS.keys]);closeSheet();render();return}
 if(ds.bkplnew){const keys=[...MS.keys];newPl(keys,()=>render());return}
 if(ds.shok){const v=($('sh_in')||{}).value;const cb=SHCB;closeSheet();if(cb){cb((v||'').trim());syncSoon(MODE);render()}return}
 if(ds.pick){openPicker(ds.pick);return}
 if(ds.pkadd){addToPl(MODE,PICKPL,[...PICK]);PICK.clear();closeSheet();render();return}
 if(ds.go==='cand'){TAB='set';NAV.set=[{t:'cand',title:'消す候補'}];refreshEst();render();return}
 if(ds.lay){LS.set('md_lay_'+MODE,lay()==='grid'?'list':'grid');render();return}
 if(ds.ff){const f=fil();f[ds.ff]=!f[ds.ff];saveFil();render();return}
 if(ds.tag!=null){const f=fil();f.tags=f.tags.includes(ds.tag)?f.tags.filter(x=>x!==ds.tag):[...f.tags,ds.tag];saveFil();render();return}
 if(ds.view){const f=fil();f.view=ds.view;if(ds.view==='artist')f.artist='';if(ds.view==='album')f.album='';saveFil();render();return}
 if(ds.fold!=null){fil().folder=ds.fold;saveFil();render();return}
 if(ds.fart!=null){const f=fil();f.artist=ds.fart;f.view='all';saveFil();render();return}
 if(ds.falb!=null){const f=fil();f.album=ds.falb;f.view='all';saveFil();render();return}
 if(ds.clr){fil()[ds.clr]='';saveFil();render();return}
 if(ds.pl){push({t:'pl',id:ds.pl,title:plName(MODE,ds.pl)});return}
 if(ds.newpl){const key=ds.key;newPl(key?[key]:[],key?()=>addPlMenu(key):null);return}
 if(ds.plren){sheetIn('プレイリストの名前',plName(MODE,ds.plren),v=>{if(!v)return;setPl(MODE,ds.plren,'name',v);const nv=NAV[TAB];if(nv&&nv.length)nv[nv.length-1].title=v});return}
 if(ds.pldel){if(confirm('このプレイリストを削除する？')){setPl(MODE,ds.pldel,'del',true);syncSoon(MODE);NAV[TAB].pop();render()}return}
 if(ds.mv!=null){const k=MODE,id=ds.pid,a=plKeys(k,id),i=+ds.mv,j=i+(+ds.d);if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];const full=(doc(k).pls[id].keys||[]).filter(x=>!a.includes(x));setPl(k,id,'keys',[...a,...full]);syncSoon(k);render();return}
 if(ds.rm!=null){const k=MODE,id=ds.pid,a=plKeys(k,id);a.splice(+ds.rm,1);setPl(k,id,'keys',a);syncSoon(k);render();return}
 if(ds.sfav){const k=MODE;setFav(k,[ds.sfav],!isFav(k,ds.sfav));if($('sheet').hidden===false&&!$('pv').classList.contains('open')&&!$('pm').classList.contains('open'))itemMenu(ds.sfav);render();if(P.key===ds.sfav)P.ui();return}
 if(ds.addpl){addPlMenu(ds.addpl);return}
 if(ds.esave){saveEdit(ds.esave);return}
 if(ds.delk){ev.stopPropagation();delDev(ds.delk);return}
 if(ds.rth){const id=MODE+'|'+ds.rth;await IDB.del('thumbs',id);TH.mem.delete(id);const B=LS.get('md_nometa',{});delete B[id];LS.set('md_nometa',B);TH.want(id);closeSheet();return}
 if(ds.pfre){const k=MODE,key=ds.pfre;closeSheet();P.stop();await delDevKey(k,key);syncSoon(k);EST=await storageEst();render();alert('この端末から消したよ。PCの送る画面で未送信に戻るので、送り直してね');return}
 if(ds.pfdel){closeSheet();P.stop();delDev(ds.pfdel);return}
 if(ds.pfnext){closeSheet();P._failK=null;P.next(true);return}
 if(ds.pfretry){closeSheet();if(P.el)P.el.dataset.k='';P._failK=null;P.load();return}
 if(ds.close){closeSheet();return}
 if(ds.side){LS.set('md_side',ds.side);render();return}
 if(ds.pickdir){pickDir();return}if(ds.reopen){reopenDir();return}
 if(ds.conn&&!LS.get('md_mic_ok',0)){micNote('conn');return}
 if(ds.micok){closeSheet();if(ds.micok==='rx')startRx();else TX.connect().catch(e=>{TX.st='エラー：'+(e.message||e);render()});return}
 if(ds.rxre){RX.stopListen();RX.why='';startRx();return}
 if(ds.conn){TX.connect().catch(e=>{TX.st='エラー：'+(e.message||e);render()});return}
 if(ds.disc){TX.close();render();return}
 if(ds.dosend){doSend();return}if(ds.sstop){TX.stop=true;return}
 if(ds.selnew||ds.selall){const k=MODE,el=eligible(k);for(const e of PCF[k].values())if(el(e)&&(ds.selall||!sentTo(k,e.key)))SEL[k].add(e.key);render();return}
 if(ds.selclr){SEL[MODE].clear();render();return}
 if(ds.sf){LS.set('md_sf_'+MODE,ds.sf);render();return}
 if(ds.savetok){const v=$('s_tok').value.trim();if(!v){alert('トークンを入力してね');return}LS.set('v2_token',v);$('s_tok').value='';syncNow(MODE);render();return}
 if(ds.savedname){const v=$('s_dname').value.trim();LS.set('md_dev_name',v===autoDevName(MYDEV)?'':v);if(RX.dc&&RX.dc.readyState==='open')RX.hello();render();return}
 if(ds.syncnow){syncNow(MODE);return}
 if(ds.thall){if(!confirm('サムネを全部作り直す？'))return;for(const e of lib(MODE)){const id=MODE+'|'+e.key;await IDB.del('thumbs',id);TH.mem.delete(id)}LS.set('md_nometa',{});render();return}
 if(ds.home){goHome();return}
 if(t.id==='rx_btn'){if(RX.on){RX.stopListen();WL.off('rx');render()}else if(!LS.get('md_mic_ok',0))micNote('rx');else startRx();return}
});
document.addEventListener('change',ev=>{const t=ev.target,ds=t.dataset;
 if(t.id==='f_sort'){fil().sort=t.value;saveFil();render()}
 else if(t.id==='f_art'){fil().artist=t.value;saveFil();render()}
 else if(t.id==='f_alb'){fil().album=t.value;saveFil();render()}
 else if(ds.sel!=null){const S=SEL[MODE];t.checked?S.add(ds.sel):S.delete(ds.sel);render()}
 else if(ds.selfold!=null){const k=MODE,S=SEL[k],sh=new Set([...document.querySelectorAll('[data-sel]')].map(x=>x.dataset.sel)),el=eligible(k);for(const e of PCF[k].values()){const d=e.path.includes('/')?e.path.slice(0,e.path.lastIndexOf('/')):'';if(d===ds.selfold&&sh.has(e.key)){if(!t.checked)S.delete(e.key);else if(el(e))S.add(e.key)}}render()}
 else if(ds.plt){const k=MODE,p=doc(k).pls[ds.plt];let a=(p.keys||[]).slice();a=t.checked?[...a.filter(x=>x!==ds.key),ds.key]:a.filter(x=>x!==ds.key);setPl(k,ds.plt,'keys',a);syncSoon(k)}
 else if(ds.pk!=null){t.checked?PICK.add(ds.pk):PICK.delete(ds.pk);pkBtn()}
 else if(t.id==='s_norm'){LS.set('md_norm',t.checked);if(P.el)P.gain()}
 else if(t.id==='s_auto'){LS.set('md_auto',t.checked)}
 else if(t.id==='s_wl'){LS.set('md_wl_min',+t.value);WL.touch();WL.sync()}
 else if(t.id==='s_conv'){LS.set('md_conv',t.checked);render()}
 else if(t.id==='s_dups'){LS.set('md_dupsend',t.checked);render()}});
let qT=null;document.addEventListener('input',ev=>{if(ev.target.id==='f_q'){fil().q=ev.target.value;saveFil();clearTimeout(qT);qT=setTimeout(()=>{const r=$('sres');if(r){for(const k in LISTS)delete LISTS[k];r.innerHTML=searchRes();afterRender()}},250)}else if(ev.target.id==='pk_q'){clearTimeout(qT);qT=setTimeout(pkList,200)}});
$('hd_back').onclick=()=>{(NAV[TAB]||[]).pop();MS.on=false;MS.keys.clear();render()};
$('hd_home').onclick=()=>goHome();
$('sheet').addEventListener('click',e=>{if(e.target.id==='sheet')closeSheet()});
function micNote(w){sheet(`<h3>接続の準備</h3><p>PCとiPhoneを家のネットで直接つなぐために、マイクの許可を聞くよ。つなぐためだけで、録音はしないし、つながったら止めるよ。</p><button data-micok="${w}">OK</button><button class="sub" data-close="1">やめる</button>`)}
async function startRx(){const m=NET.start();WL.on('rx');RX.why='';RX.st='準備中';render();await m;RX.listen();refreshEst();render()}
function goHome(){P.stop();MODE=null;MS.on=false;MS.keys.clear();closeSheet();render()}
async function refreshEst(){EST=await storageEst();if(MODE)render()}

// ===== 起動 =====
let LASTDEV='';TX.on=()=>{const dv=TX.peer&&TX.peer.dev||'';if(dv&&dv!==LASTDEV){if(LASTDEV&&!SENDING){for(const k of['music','video'])SST[k].clear();SUM=null}LASTDEV=dv}if(!MODE)return;if(TAB==='send')sendRender();else $('hd_st').innerHTML=hdStatus();if(TX.peer)qhCollisions(MODE)};
RX.ui=()=>{if(!MODE)return;if(TAB==='send')sendRender();else $('hd_st').innerHTML=hdStatus()};
RX.onFile=k=>{refreshEst()};
SY.on=()=>{if(/^最終/.test(SY.msg)&&!SY.busy.music&&!SY.busy.video)for(const k of['music','video'])fixTags(k);if(!MODE)return;$('hd_st').innerHTML=hdStatus();if(TAB==='set'||(/^最終/.test(SY.msg)&&!MS.on&&$('sheet').hidden&&!(document.activeElement&&document.activeElement.matches('input,select'))))render()};
document.addEventListener('visibilitychange',()=>{if(MODE)syncNow(MODE)});
addEventListener('online',()=>MODE&&syncNow(MODE));
(async()=>{buildPlayers();render();await ST.init();await loadDev();for(const k of['music','video'])fixTags(k);await restoreDirs();EST=await storageEst();render();for(const k of['music','video'])syncNow(k);
 if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js?v='+APPV).catch(()=>{})})();
