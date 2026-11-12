'use strict';
// ===== 状態 =====
let MODE=null,TAB='home';const NAV={};const LISTS={};let LSEQ=0;
const NAME={music:'音楽',video:'動画'};
const FIL={music:LS.get('md_fil_music',null)||{},video:LS.get('md_fil_video',null)||{}};
const fil=()=>{const f=FIL[MODE];f.sort=f.sort||'last';f.view=f.view||'all';f.tags=f.tags||[];return f};
const saveFil=()=>LS.set('md_fil_'+MODE,FIL[MODE]);
const lay=()=>LS.get('md_lay_'+MODE,'grid');
const PCF={music:new Map(),video:new Map()},PCDIR={music:null,video:null},PCNEED={music:false,video:false};
let EST={free:0,usage:0,quota:0};const LOW=5e9;
let RND={music:null,video:null};
const SEL={music:new Set(),video:new Set()};let SENDP=null,SENDING=false,SENDERR='';
const SIDE=()=>LS.get('md_side',isPhone?'rx':'tx');

// ===== ライブラリ =====
function lib(k){k=k||MODE;const m=new Map();for(const f of DEV[k].values())m.set(f.key,{key:f.key,path:f.path,size:f.size,src:'dev',added:f.added,mime:f.mime});for(const f of PCF[k].values())if(!m.has(f.key))m.set(f.key,{key:f.key,path:f.path,size:f.size,src:'pc',added:f.lm,mime:mimeOf(f.name)});return[...m.values()]}
const libMap=k=>new Map(lib(k).map(e=>[e.key,e]));
const baseName=p=>p.split('/').pop().replace(/\.[^.]+$/,'');
function pathArtist(k,p){const s=p.split('/');if(k==='music'&&s.length>=3)return s[s.length-3];if(s.length>=2)return s[s.length-2];const b=baseName(p),i=b.indexOf(' - ');return i>0?b.slice(0,i).trim():''}
function titleOf(k,e){const d=it(k,e.key);if(d.n)return d.n;if(d.tt)return d.tt;const b=baseName(e.path),s=e.path.split('/');const i=b.indexOf(' - ');return s.length<2&&i>0?b.slice(i+3).trim():b}
function artistOf(k,e){const d=it(k,e.key);return d.a||d.ta||pathArtist(k,e.path)||'その他'}
const added=(k,e)=>e.added||0;
function sortL(k,a,s){const t=x=>titleOf(k,x);if(s==='name')return a.sort((x,y)=>t(x).localeCompare(t(y),'ja'));if(s==='add')return a.sort((x,y)=>added(k,y)-added(k,x));return a.sort((x,y)=>(it(k,y.key).last||0)-(it(k,x.key).last||0)||added(k,y)-added(k,x))}
function artists(k){const m=new Map();for(const e of lib(k)){const a=artistOf(k,e);m.set(a,(m.get(a)||0)+1)}return[...m].sort((a,b)=>a[0].localeCompare(b[0],'ja'))}
const allTags=k=>[...new Set(lib(k).flatMap(e=>it(k,e.key).tags||[]))].sort();
function userPls(k){return Object.entries(doc(k).pls).filter(([,p])=>!p.del).map(([id,p])=>({id,...p})).sort((a,b)=>(a.at||0)-(b.at||0))}
function autoPl(k,id){const L=lib(k);if(id==='_often')return L.filter(e=>(it(k,e.key).plays||0)>0).sort((a,b)=>(it(k,b.key).plays||0)-(it(k,a.key).plays||0)).slice(0,50).map(e=>e.key);return sortL(k,L,'add').slice(0,50).map(e=>e.key)}
function plKeys(k,id){if(id[0]==='_')return autoPl(k,id);const p=doc(k).pls[id];const m=libMap(k);return(p&&p.keys||[]).filter(x=>m.has(x))}
const plName=(k,id)=>id==='_often'?'よく見る':id==='_new'?'最近追加':(doc(k).pls[id]||{}).name||'';

// ===== 描画部品 =====
const IC={home:'<path d="M3 11l9-8 9 8v10h-6v-6H9v6H3z"/>',search:'<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15.5 15.5l5.5 5.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',pl:'<path d="M3 5h13v2.4H3zm0 5h13v2.4H3zm0 5h8v2.4H3zm12 0l7 4-7 4z"/>',fav:'<path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"/>',send:'<path d="M2 4h20v12H2zm2 2v8h16V6zM8 19h8v2H8z"/><path d="M12 7l3.5 3.5h-2.3v2.8h-2.4v-2.8H8.5z"/>',set:'<path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm9 4.6v-2.2l-2.4-.6-.7-1.6 1.3-2.1-1.6-1.6-2.1 1.3-1.6-.7L13.1 3h-2.2l-.6 2.4-1.6.7-2.1-1.3L5 6.4l1.3 2.1-.7 1.6-2.6.8v2.2l2.4.6.7 1.6-1.3 2.1L6.4 19l2.1-1.3 1.6.7.8 2.6h2.2l.6-2.4 1.6-.7 2.1 1.3 1.6-1.6-1.3-2.1.7-1.6z"/>'};
const svg=p=>`<svg viewBox="0 0 24 24" fill="currentColor">${p}</svg>`;
const TABS=[['home','ホーム'],['search','検索'],['pl','プレイリスト'],['fav','お気に入り'],['send',isPhone?'PCから受け取る':'PCから送る'],['set','設定']];
TABS[4][1]='PCから送る';
function reg(keys){const id='l'+(++LSEQ);LISTS[id]=keys;return id}
function card(k,e,l,i,small){const d=it(k,e.key);const dur=d.dur?`<span class="du">${fmtT(d.dur)}</span>`:'';return`<div class="it${small?' sm':''}" data-l="${l}" data-i="${i}"><div class="th ${k}"><img data-tk="${esc(k+'|'+e.key)}" alt="">${dur}${d.fav?'<i class="fv">★</i>':''}${d.rs||d.re?'<i class="rg">範囲</i>':''}</div><div class="tx"><b>${esc(titleOf(k,e))}</b><span>${esc(artistOf(k,e))}</span></div><button class="mo" data-mk="${esc(e.key)}">⋯</button></div>`}
function items(k,list,opt){opt=opt||{};if(!list.length)return'';const l=reg(list.map(e=>e.key));const L=opt.lay||lay();return`<div class="${opt.row?'hrow':L==='grid'?'grid '+k:'list'}">${list.map((e,i)=>card(k,e,l,i,opt.row)).join('')}</div>`}
const playBar=(keys,extra)=>{const l=reg(keys);return`<div class="pbar"><button data-play="${l}">▶ 再生</button><button class="sub" data-shuf="${l}">🔀 ランダム</button>${extra||''}</div>`};
const sec=(t,body,right)=>`<section><h2><span>${t}</span>${right||''}</h2>${body}</section>`;

// ===== 画面 =====
function render(){if(!MODE){$('choose').hidden=false;$('app').hidden=true;return}$('choose').hidden=true;$('app').hidden=false;document.body.dataset.mode=MODE;
 for(const k in LISTS)delete LISTS[k];
 const nav=NAV[TAB]||[];$('hd_back').hidden=!nav.length;$('hd_t').textContent=nav.length?nav[nav.length-1].title:NAME[MODE];
 $('tabs').innerHTML=TABS.map(([id,t])=>`<button class="${TAB===id?'on':''}" data-tab="${id}">${svg(IC[id==='pl'?'pl':id])}<span>${t}</span></button>`).join('');
 const top=nav[nav.length-1];let h='';
 try{h=top?subView(top):({home:vHome,search:vSearch,pl:vPls,fav:vFav,send:vSend,set:vSet})[TAB]()}catch(e){h=`<div class="card">${esc(e.message||e)}</div>`;console.error(e)}
 $('main').innerHTML=h;afterRender()}
function push(v){(NAV[TAB]=NAV[TAB]||[]).push(v);render();scrollTo(0,0)}
function vHome(){const k=MODE,L=lib(k);let h='';
 if(DEV[k].size&&EST.quota&&EST.free<LOW)h+=`<div class="warn" data-go="cand">空きが少ないよ（${fmtB(EST.free)}）</div>`;
 if(!L.length)return h+`<div class="empty"><button data-tab="send">PCから送る</button></div>`;
 const fv=sortL(k,L.filter(e=>it(k,e.key).fav),'last');
 h+=sec('お気に入り',fv.length?items(k,fv.slice(0,20),{row:1}):'',fv.length?'<button class="lnk" data-tab="fav">すべて</button>':'');
 const ar=artists(k);h+=sec('アーティスト',`<div class="chips">${ar.map(([a,n])=>`<button class="chip" data-art="${esc(a)}">${esc(a)} <i>${n}</i></button>`).join('')}</div>`);
 if(!RND[k]||RND[k].some(x=>!L.find(e=>e.key===x))){const a=L.slice();shuffle(a);RND[k]=a.slice(0,12).map(e=>e.key)}
 const m=libMap(k),rl=RND[k].map(x=>m.get(x)).filter(Boolean);
 h+=sec('ランダムおすすめ',items(k,rl),'<button class="lnk" data-rnd="1">🔀 入れ替え</button>');
 return h}
function filtered(){const k=MODE,f=fil();let L=lib(k);const q=(f.q||'').trim().toLowerCase();
 if(q)L=L.filter(e=>(titleOf(k,e)+' '+artistOf(k,e)+' '+e.path).toLowerCase().includes(q));
 if(f.artist)L=L.filter(e=>artistOf(k,e)===f.artist);if(f.fav)L=L.filter(e=>it(k,e.key).fav);if(f.unw)L=L.filter(e=>!it(k,e.key).plays&&!it(k,e.key).pos);
 if(f.tags.length)L=L.filter(e=>{const t=it(k,e.key).tags||[];return f.tags.every(x=>t.includes(x))});return sortL(k,L,f.sort)}
function ctlRow(withSort){const f=fil();return`<div class="ctl">${withSort?`<select id="f_sort">${[['last','最近見た順'],['add','追加した順'],['name','名前順']].map(([v,t])=>`<option value="${v}"${f.sort===v?' selected':''}>${t}</option>`).join('')}</select>`:''}<button class="sub ic" data-lay="1">${lay()==='grid'?'☰':'▦'}</button></div>`}
function vSearch(){const k=MODE,f=fil(),ar=artists(k),tg=allTags(k);
 let h=`<div class="srch"><input id="f_q" type="search" placeholder="検索" value="${esc(f.q||'')}" autocomplete="off"></div>
 <div class="ctl"><select id="f_art"><option value="">アーティスト</option>${ar.map(([a])=>`<option${f.artist===a?' selected':''}>${esc(a)}</option>`).join('')}</select><select id="f_sort">${[['last','最近見た順'],['add','追加した順'],['name','名前順']].map(([v,t])=>`<option value="${v}"${f.sort===v?' selected':''}>${t}</option>`).join('')}</select><button class="sub ic" data-lay="1">${lay()==='grid'?'☰':'▦'}</button></div>
 <div class="chips"><button class="chip${f.fav?' on':''}" data-ff="fav">★ お気に入り</button><button class="chip${f.unw?' on':''}" data-ff="unw">${MODE==='video'?'未視聴':'未再生'}</button>${tg.map(t=>`<button class="chip${f.tags.includes(t)?' on':''}" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}</div>
 <div class="seg">${[['all','すべて'],['folder','フォルダ'],['artist','アーティスト']].map(([v,t])=>`<button class="${f.view===v?'on':''}" data-view="${v}">${t}</button>`).join('')}</div>`;
 return h+`<div id="sres">${searchRes()}</div>`}
function searchRes(){const k=MODE,f=fil();let h='';const L=filtered();
 if(f.view==='folder'){const cur=f.folder||'';const sub=new Map(),here=[];for(const e of L){const p=e.path.split('/');p.pop();const dir=p.join('/');if(dir===cur)here.push(e);else if(cur===''||dir.startsWith(cur+'/')){const rest=(cur?dir.slice(cur.length+1):dir).split('/')[0];sub.set(rest,(sub.get(rest)||0)+1)}}
  h+=`<div class="crumb"><button class="lnk" data-fold="">📁</button>${cur?cur.split('/').map((s,i,a)=>`/<button class="lnk" data-fold="${esc(a.slice(0,i+1).join('/'))}">${esc(s)}</button>`).join(''):''}</div>`;
  h+=`<div class="rows">${[...sub].sort((a,b)=>a[0].localeCompare(b[0],'ja')).map(([s,n])=>`<button class="rowb" data-fold="${esc(cur?cur+'/'+s:s)}">📁 ${esc(s)}<i>${n}</i></button>`).join('')}</div>`;
  if(here.length)h+=playBar(here.map(e=>e.key))+items(k,here)}
 else if(f.view==='artist'&&!f.artist){const m=new Map();for(const e of L){const a=artistOf(k,e);m.set(a,(m.get(a)||0)+1)}h+=`<div class="rows">${[...m].sort((a,b)=>a[0].localeCompare(b[0],'ja')).map(([a,n])=>`<button class="rowb" data-fart="${esc(a)}">${esc(a)}<i>${n}</i></button>`).join('')}</div>`}
 else{if(L.length)h+=playBar(L.map(e=>e.key),`<span class="cnt">${L.length}件</span>`);h+=items(k,L)}
 return h}
function vPls(){const k=MODE;const P=[['_often','よく見る'],['_new','最近追加'],...userPls(k).map(p=>[p.id,p.name])];
 return`<div class="pbar"><button data-newpl="1">＋ 新しいプレイリスト</button></div><div class="rows">${P.map(([id,n])=>`<button class="rowb" data-pl="${esc(id)}">${id[0]==='_'?'⚡ ':'≡ '}${esc(n)}<i>${plKeys(k,id).length}</i></button>`).join('')}</div>`}
function vPl(id){const k=MODE,keys=plKeys(k,id),m=libMap(k),L=keys.map(x=>m.get(x));const auto=id[0]==='_';
 let h=keys.length?playBar(keys):'';if(!auto)h+=`<div class="pbar"><button class="sub" data-plren="${esc(id)}">名前を変える</button><button class="sub dng" data-pldel="${esc(id)}">削除</button></div>`;
 if(auto)return h+items(k,L);const l=reg(keys);
 return h+`<div class="list ed">${L.map((e,i)=>`<div class="it" data-l="${l}" data-i="${i}"><div class="th ${k}"><img data-tk="${esc(k+'|'+e.key)}" alt=""></div><div class="tx"><b>${esc(titleOf(k,e))}</b><span>${esc(artistOf(k,e))}</span></div><div class="ord"><button class="sub" data-mv="${i}" data-pid="${esc(id)}" data-d="-1">▲</button><button class="sub" data-mv="${i}" data-pid="${esc(id)}" data-d="1">▼</button><button class="sub" data-rm="${i}" data-pid="${esc(id)}">✕</button></div></div>`).join('')}</div>`}
function vFav(){const k=MODE,f=fil();const L=sortL(k,lib(k).filter(e=>it(k,e.key).fav),f.sort);return ctlRow(1)+(L.length?playBar(L.map(e=>e.key)):'')+items(k,L)}
function subView(v){if(v.t==='pl')return vPl(v.id);if(v.t==='art'){const k=MODE,L=sortL(k,lib(k).filter(e=>artistOf(k,e)===v.a),fil().sort);return ctlRow(1)+playBar(L.map(e=>e.key))+items(k,L)}if(v.t==='cand')return vCand();return''}
function cands(k){return[...DEV[k].values()].map(f=>({...f,d:it(k,f.key)})).sort((a,b)=>(a.d.plays||0)-(b.d.plays||0)||(a.d.last||0)-(b.d.last||0)||b.size-a.size).slice(0,30)}
function vCand(){const k=MODE,m=libMap(k);const L=cands(k);return`<div class="card"><div class="kv"><span>空き</span><b>${fmtB(EST.free)}</b></div></div><div class="list">${L.map(f=>{const e=m.get(f.key)||{key:f.key,path:f.path};return`<div class="it"><div class="th ${k}"><img data-tk="${esc(k+'|'+f.key)}" alt=""></div><div class="tx"><b>${esc(titleOf(k,e))}</b><span>${fmtB(f.size)}・${f.d.plays||0}回</span></div><button class="sub dng sm" data-delk="${esc(f.key)}">削除</button></div>`}).join('')}</div>`}
// --- 送る・受け取る ---
function vSend(){const k=MODE,side=SIDE();let h=`<div class="seg">${[['tx','PCから送る'],['rx','iPhoneで受け取る']].map(([v,t])=>`<button class="${side===v?'on':''}" data-side="${v}">${t}</button>`).join('')}</div>`;
 if(!tok())h+=`<div class="warn" data-tab="set">GitHubトークンを設定してね</div>`;
 return h+(side==='tx'?vTx(k):vRx(k))}
function vRx(k){const c=RX.cur;let h=`<div class="card"><div class="kv"><span>状態</span><b>${esc(RX.st||'停止')}</b></div><div class="kv"><span>使用</span><b>${fmtB(EST.usage)}</b></div><div class="kv"><span>空き</span><b>${fmtB(EST.free)}</b></div>
 ${RX.why?`<div class="red">${esc(RX.why)}</div>`:''}<button id="rx_btn" class="${RX.on?'sub':''}">${RX.on?'受け取りをやめる':'受け取りを始める'}</button>${RX.on?'<button data-rxre="1">再接続</button>':''}</div>`;
 if(c)h+=`<div class="card"><b>${esc(c.name)}</b><div class="prog"><div style="width:${(RX.got/c.size*100).toFixed(1)}%"></div></div><div class="kv"><span>${fmtB(RX.got)} / ${fmtB(c.size)}</span></div></div>`;
 return h}
function vTx(k){const F=PCF[k];let h=`<div class="card">`;
 h+=`<div class="pbar"><button data-pick="1">${PCDIR[k]?'フォルダを選び直す':'フォルダを選ぶ'}</button>${PCNEED[k]?`<button data-reopen="1">「${esc(PCDIR[k].name)}」を開く</button>`:''}</div>`;
 h+=`<div class="kv"><span>iPhone</span><b>${esc(TX.st||'未接続')}</b></div>${TX.why&&/失敗|切断/.test(TX.st)?`<div class="red">${esc(TX.why)}</div>`:''}${TX.peer?`<div class="kv"><span>iPhoneの空き</span><b>${fmtB(TX.peer.free)}</b></div>`:''}
 <div class="pbar"><button data-conn="1" class="${TX.st==='接続済み'?'sub':''}">${TX.st==='接続済み'?'つなぎ直す':/失敗|時間切れ|切断|エラー/.test(TX.st)?'再接続':'iPhoneとつなぐ'}</button>${TX.st?'<button class="sub" data-disc="1">切断</button>':''}</div></div>`;
 if(!F.size)return h;
 const NW=new Set(LS.get('md_new_'+k,[]));const L=[...F.values()].sort((a,b)=>a.path.localeCompare(b.path,'ja'));
 const sent=e=>it(k,e.key).sent>0,isNew=e=>!sent(e)&&NW.has(e.key);const nNew=L.filter(isNew).length,nUn=L.filter(e=>!sent(e)).length;
 const sf=LS.get('md_sf_'+k,'all');const S=SEL[k];let selB=0;for(const x of S){const e=F.get(x);if(e)selB+=e.size}
 const over=TX.peer&&selB>TX.peer.free;
 h+=`<div class="card sendbox"><div class="kv"><span>選択 ${S.size}件</span><b class="${over?'red':''}">${fmtB(selB)}${TX.peer?' / 空き '+fmtB(TX.peer.free):''}</b></div>
 ${SENDP?`<div class="prog"><div style="width:${(SENDP.done/SENDP.total*100).toFixed(1)}%"></div></div><div class="kv"><span>${esc(SENDP.name)}</span><b>${fmtB(SENDP.done)} / ${fmtB(SENDP.total)}${SENDP.sp?'・'+fmtB(SENDP.sp)+'/秒':''}</b></div>`:''}${SENDERR?`<div class="red">${esc(SENDERR)}</div>`:''}
 <div class="pbar">${SENDING?'<button class="sub dng" data-sstop="1">中止</button>':`<button data-dosend="1" ${S.size&&TX.st==='接続済み'?'':'disabled'}>送る</button>`}<button class="sub" data-selnew="1">未送信を全部選ぶ</button><button class="sub" data-selclr="1">選択解除</button></div></div>`;
 h+=`<div class="seg">${[['all','すべて '+L.length],['un','未送信 '+nUn],['new','NEW '+nNew],['sent','送信済み '+(L.length-nUn)]].map(([v,t])=>`<button class="${sf===v?'on':''}" data-sf="${v}">${t}</button>`).join('')}</div>`;
 const V=L.filter(e=>sf==='un'?!sent(e):sf==='new'?isNew(e):sf==='sent'?sent(e):true);
 const G=new Map();for(const e of V){const d=e.path.includes('/')?e.path.slice(0,e.path.lastIndexOf('/')):'';if(!G.has(d))G.set(d,[]);G.get(d).push(e)}
 for(const[d,a]of G){const all=a.every(e=>S.has(e.key));h+=`<div class="fold"><label class="fh"><input type="checkbox" data-selfold="${esc(d)}"${all?' checked':''}><b>📁 ${esc(d||PCDIR[k]&&PCDIR[k].name||'/')}</b><i>${a.length}件・${fmtB(a.reduce((s,e)=>s+e.size,0))}</i></label>
  ${a.map(e=>`<label class="fr"><input type="checkbox" data-sel="${esc(e.key)}"${S.has(e.key)?' checked':''}><span>${esc(e.name)}</span>${sent(e)?'<i class="ok">✓</i>':isNew(e)?'<i class="nw">NEW</i>':''}<em>${fmtB(e.size)}</em></label>`).join('')}</div>`}
 return h}
function vSet(){const k=MODE;return`<div class="card"><h3>GitHubトークン</h3><div class="pbar"><input id="s_tok" type="password" autocomplete="off" placeholder="${tok()?'保存済み':'github_pat_…'}"><button class="nar" data-savetok="1">保存</button></div>
 <div class="kv"><span>同期</span><b>${esc(tok()?SY.msg||'':'未設定')}</b></div><button class="sub" data-syncnow="1">今すぐ同期</button></div>
 <div class="card"><h3>保存</h3><div class="kv"><span>使用</span><b>${fmtB(EST.usage)}</b></div><div class="kv"><span>空き</span><b class="${EST.free<LOW?'red':''}">${fmtB(EST.free)}</b></div><div class="kv"><span>${NAME[k]}（この端末）</span><b>${DEV[k].size}件</b></div><div class="kv"><span>保存方式</span><b>${ST.mode==='opfs'?'OPFS':'IndexedDB'}</b></div><div class="kv"><span>消えない設定</span><b id="s_pers">…</b></div>
 <button class="sub" data-go="cand">消す候補</button></div>
 <div class="card"><h3>再生</h3><label class="tg"><span>音量をそろえる</span><input type="checkbox" id="s_norm"${LS.get('md_norm',true)?' checked':''}></label><label class="tg"><span>自動で次へ</span><input type="checkbox" id="s_auto"${LS.get('md_auto',true)?' checked':''}></label></div>
 <div class="card"><button class="sub" data-thall="1">サムネを作り直す</button><button class="sub" data-home="1">最初の画面に戻る</button></div>`}

// ===== サムネ読み込み =====
const TH={mem:new Map(),q:[],busy:false,io:null,
 async get(id){if(this.mem.has(id))return this.mem.get(id);const v=await IDB.get('thumbs',id);if(v)this.mem.set(id,v);return v},
 set(id,v){this.mem.set(id,v);for(const img of document.querySelectorAll('img[data-tk]'))if(img.dataset.tk===id)img.src=v;return IDB.put('thumbs',id,v)},
 want(id){if(!this.q.includes(id))this.q.push(id);this.run()},
 async run(){if(this.busy)return;this.busy=true;try{while(this.q.length){const id=this.q.shift();const[k,...r]=id.split('|');const key=r.join('|');if(await this.get(id))continue;if(LS.get('md_bad',{})[id])continue;try{const b=await blobOf(k,key);if(!b)continue;const name=keyPath(key);const o=await metaOf(k,b,name);if(o.bad){const B=LS.get('md_bad',{});B[id]=1;LS.set('md_bad',B)}
   let ch=false;for(const f of['dur','ta','tt'])if(o[f]!=null)if(setF(k,key,f,o[f],1)){ch=true;syncSoon(k,8000)}if(ch&&(o.ta||o.tt))softRender();if(o.thumb)await this.set(id,o.thumb);else this.mem.set(id,'');}catch(e){}}}finally{this.busy=false}}};
let srT=null;function softRender(){clearTimeout(srT);srT=setTimeout(()=>{if(!MODE||!$('sheet').hidden||(document.activeElement&&document.activeElement.matches('input,select')))return;const y=scrollY;render();scrollTo(0,y)},1200)}
function afterRender(){if(!TH.io)TH.io=new IntersectionObserver(es=>{for(const en of es)if(en.isIntersecting){const img=en.target;TH.io.unobserve(img);const id=img.dataset.tk;TH.get(id).then(v=>{if(v)img.src=v;else if(v!==''){TH.want(id)}})}},{rootMargin:'300px'});
 for(const img of document.querySelectorAll('#main img[data-tk]'))TH.io.observe(img);
 if(TAB==='set'&&$('s_pers'))navigator.storage&&navigator.storage.persisted&&navigator.storage.persisted().then(p=>{if($('s_pers'))$('s_pers').textContent=p?'ON':'OFF'})}
async function blobOf(k,key){const f=DEV[k].get(key);if(f)return ST.file(f.fn,f.mime||mimeOf(f.path));const p=PCF[k].get(key);if(p){const x=await p.get();return new Blob([x],{type:mimeOf(p.name)})}return null}

// ===== PCフォルダ =====
async function scanDir(k,dh){const m=new Map();async function walk(h,pre){for await(const[n,e]of h.entries()){if(n[0]==='.')continue;if(e.kind==='directory')await walk(e,pre+n+'/');else if(kindOf(n)===k){const f=await e.getFile();const path=pre+n,key=fkey(path,f.size);m.set(key,{key,path,name:n,size:f.size,lm:f.lastModified,get:()=>e.getFile()})}}}await walk(dh,'');return m}
function scanFiles(k,files){const m=new Map();for(const f of files){const rp=(f.webkitRelativePath||f.name).split('/');if(rp.length>1)rp.shift();const path=rp.join('/');if(kindOf(f.name)!==k)continue;const key=fkey(path,f.size);m.set(key,{key,path,name:f.name,size:f.size,lm:f.lastModified,get:async()=>f})}return m}
function setPC(k,m,name){PCF[k]=m;if(!PCDIR[k])PCDIR[k]={name};const kn=LS.get('md_known_'+k,null);
 // 2回目以降の読み込みで増えたファイルがNEW（送るまで残る）
 if(kn){const ks=new Set(kn),nw=new Set(LS.get('md_new_'+k,[]));for(const x of m.keys())if(!ks.has(x))nw.add(x);LS.set('md_new_'+k,[...nw].filter(x=>m.has(x)&&!(it(k,x).sent>0)))}
 LS.set('md_known_'+k,[...new Set([...(kn||[]),...m.keys()])]);
 for(const e of m.values())if(it(k,e.key).add==null)setF(k,e.key,'add',e.lm,1);if(MODE)render()}
async function pickDir(){const k=MODE;if(window.showDirectoryPicker){try{const h=await showDirectoryPicker({id:'media_'+k,mode:'read'});PCDIR[k]=h;PCNEED[k]=false;await IDB.put('kv','dir_'+k,h);const m=await scanDir(k,h);setPC(k,m,h.name)}catch(e){if(e.name!=='AbortError')alert(e.message)}return}
 const inp=document.createElement('input');inp.type='file';inp.webkitdirectory=true;inp.multiple=true;inp.onchange=()=>{const fs=[...inp.files];const root=(fs[0]&&fs[0].webkitRelativePath||'').split('/')[0];PCDIR[k]={name:root};setPC(k,scanFiles(k,fs),root)};inp.click()}
async function reopenDir(){const k=MODE,h=PCDIR[k];try{if(await h.requestPermission({mode:'read'})==='granted'){PCNEED[k]=false;const m=await scanDir(k,h);setPC(k,m,h.name)}}catch(e){alert(e.message)}}
async function restoreDirs(){for(const k of['music','video']){try{const h=await IDB.get('kv','dir_'+k);if(!h||!h.queryPermission)continue;PCDIR[k]=h;if(await h.queryPermission({mode:'read'})==='granted'){setPC(k,await scanDir(k,h),h.name)}else PCNEED[k]=true}catch(e){}}}
async function doSend(){const k=MODE;if(SENDING)return;const S=[...SEL[k]].map(x=>PCF[k].get(x)).filter(Boolean);if(!S.length)return;
 const tot=S.reduce((a,e)=>a+e.size,0);if(TX.peer&&tot>TX.peer.free&&!confirm('iPhoneの空きが足りないかも。送る？'))return;
 SENDING=true;SENDERR='';render();let last={t:Date.now(),b:0};
 try{const list=[];for(const e of S){list.push({kind:k,key:e.key,path:e.path,name:e.name,size:e.size,mime:mimeOf(e.name),get:e.get,meta:null})}
  for(const x of list){const id=k+'|'+x.key,d=it(k,x.key);let th=await TH.get(id);if(th==null||d.dur==null){try{const o=await metaOf(k,new Blob([await x.get()],{type:x.mime}),x.name);if(o.thumb){th=o.thumb;await TH.set(id,th)}for(const f of['dur','ta','tt'])if(o[f]!=null)setF(k,x.key,f,o[f],1)}catch(e){}}
   if(k==='music'&&d.g==null&&LS.get('md_norm',true)){const g=await loudOf(await x.get());if(g)setF(k,x.key,'g',g,1)}
   const dd=it(k,x.key);x.meta={thumb:th||null,dur:dd.dur,ta:dd.ta,tt:dd.tt,g:dd.g}}
  await TX.send(list,p=>{const n=Date.now();if(n-last.t>1000){p.sp=(p.done-last.b)/((n-last.t)/1000);last={t:n,b:p.done}}else p.sp=SENDP&&SENDP.sp;SENDP=p;if(TAB==='send')render()});
  for(const x of list)SEL[k].delete(x.key)}
 catch(e){SENDERR=e.message||String(e)}finally{SENDING=false;SENDP=null;syncNow(k);render()}}

// ===== 項目メニュー =====
function sheet(h){$('sheet_in').innerHTML=h;$('sheet').hidden=false}
function closeSheet(){$('sheet').hidden=true;$('sheet_in').innerHTML=''}
function itemMenu(key){const k=MODE,e=libMap(k).get(key)||{key,path:keyPath(key)},d=it(k,key);
 sheet(`<h3>${esc(titleOf(k,e))}</h3><div class="pbar"><button class="sub" data-sfav="${esc(key)}">${d.fav?'★ お気に入り解除':'☆ お気に入り'}</button><button class="sub" data-addpl="${esc(key)}">＋ プレイリスト</button></div>
 <label class="fl"><span>名前</span><input id="e_n" type="text" value="${esc(d.n||titleOf(k,e))}"></label><label class="fl"><span>アーティスト</span><input id="e_a" type="text" value="${esc(artistOf(k,e))}"></label>
 <label class="fl"><span>タグ</span><input id="e_t" type="text" value="${esc((d.tags||[]).join(', '))}"></label>
 <label class="fl"><span>開始</span><input id="e_rs" class="num" inputmode="decimal" value="${d.rs?fmtT(d.rs):''}"></label><label class="fl"><span>終了</span><input id="e_re" class="num" inputmode="decimal" value="${d.re?fmtT(d.re):''}"></label>
 <div class="pbar"><button data-esave="${esc(key)}">保存</button></div><div class="pbar">${DEV[k].has(key)?`<button class="sub dng" data-delk="${esc(key)}">この端末から削除</button>`:''}<button class="sub" data-rth="${esc(key)}">サムネを作り直す</button></div><button class="sub" data-close="1">閉じる</button>`)}
function saveEdit(key){const k=MODE,e=libMap(k).get(key)||{key,path:keyPath(key)},d=it(k,key);
 const n=$('e_n').value.trim(),a=$('e_a').value.trim(),t=$('e_t').value.split(/[,、，]/).map(s=>s.trim()).filter(Boolean);
 const autoT=(()=>{const x={...e};const dd={...d};delete dd.n;return dd.tt||(()=>{const b=baseName(e.path),s=e.path.split('/');const i=b.indexOf(' - ');return s.length<2&&i>0?b.slice(i+3).trim():b})()})();
 if(n!==(d.n||autoT))setF(k,key,'n',n===autoT?'':n);const autoA=d.ta||pathArtist(k,e.path)||'その他';if(a!==(d.a||autoA))setF(k,key,'a',a===autoA?'':a);
 if(JSON.stringify(t)!==JSON.stringify(d.tags||[]))setF(k,key,'tags',t);
 const rs=parseT($('e_rs').value),re=parseT($('e_re').value);if(rs!==(d.rs||0))setF(k,key,'rs',rs);if(re!==(d.re||0))setF(k,key,'re',re);
 syncSoon(k);closeSheet();render();if(P.key===key)P.ui()}
function addPlMenu(key){const k=MODE,U=userPls(k);sheet(`<h3>プレイリストに追加</h3><div class="rows">${U.map(p=>`<label class="fr"><input type="checkbox" data-plt="${esc(p.id)}" data-key="${esc(key)}"${(p.keys||[]).includes(key)?' checked':''}><span>${esc(p.name)}</span></label>`).join('')}</div><div class="pbar"><button class="sub" data-newpl="1" data-key="${esc(key)}">＋ 新しいプレイリスト</button></div><button class="sub" data-close="1">閉じる</button>`)}
function newPl(key){const n=prompt('プレイリストの名前');if(!n)return;const k=MODE,id='p'+Date.now().toString(36);setPl(k,id,'name',n.trim());setPl(k,id,'at',Date.now());setPl(k,id,'keys',key?[key]:[]);syncSoon(k);if(key)addPlMenu(key);render()}
async function delDev(key){const k=MODE,f=DEV[k].get(key);if(!f)return;if(!confirm(`「${titleOf(k,libMap(k).get(key)||{key,path:f.path})}」をこの端末から削除する？`))return;
 if(P.key===key&&P.kind===k)P.stop();await ST.remove(f.fn);await IDB.del('files',k+'|'+key);DEV[k].delete(key);setF(k,key,'sent',0);syncSoon(k);EST=await storageEst();closeSheet();render()}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

// ===== イベント =====
document.addEventListener('click',async ev=>{const t=ev.target.closest('button,[data-l],[data-go],[data-tab],.warn,label');if(!t)return;const ds=t.dataset;
 if(ds.mode){MODE=ds.mode;LS.set('md_last',MODE);TAB='home';render();syncNow(MODE);return}
 if(ds.tab){if(TAB===ds.tab)NAV[TAB]=[];TAB=ds.tab;closeSheet();render();scrollTo(0,0);if(TAB==='send'||TAB==='set')refreshEst();return}
 if(ds.mk){ev.stopPropagation();itemMenu(ds.mk);return}
 if(ds.l&&!t.closest('.ord')&&!ds.delk){const keys=LISTS[ds.l];if(keys)P.play(MODE,keys,+ds.i,false);return}
 if(ds.play){P.play(MODE,LISTS[ds.play],0,false);return}if(ds.shuf){P.play(MODE,LISTS[ds.shuf],0,true);return}
 if(ds.go==='cand'){TAB='set';NAV.set=[{t:'cand',title:'消す候補'}];refreshEst();render();return}
 if(ds.art!=null){NAV[TAB]=NAV[TAB]||[];push({t:'art',a:ds.art,title:ds.art});return}
 if(ds.rnd){RND[MODE]=null;render();return}
 if(ds.lay){LS.set('md_lay_'+MODE,lay()==='grid'?'list':'grid');render();return}
 if(ds.ff){const f=fil();f[ds.ff]=!f[ds.ff];saveFil();render();return}
 if(ds.tag!=null){const f=fil();f.tags=f.tags.includes(ds.tag)?f.tags.filter(x=>x!==ds.tag):[...f.tags,ds.tag];saveFil();render();return}
 if(ds.view){const f=fil();f.view=ds.view;if(ds.view==='artist')f.artist='';saveFil();render();return}
 if(ds.fold!=null){fil().folder=ds.fold;saveFil();render();return}
 if(ds.fart!=null){const f=fil();f.artist=ds.fart;f.view='all';saveFil();render();return}
 if(ds.pl){push({t:'pl',id:ds.pl,title:plName(MODE,ds.pl)});return}
 if(ds.newpl){newPl(ds.key);return}
 if(ds.plren){const n=prompt('名前',plName(MODE,ds.plren));if(n){setPl(MODE,ds.plren,'name',n.trim());const nv=NAV[TAB];nv[nv.length-1].title=n.trim();syncSoon(MODE);render()}return}
 if(ds.pldel){if(confirm('このプレイリストを削除する？')){setPl(MODE,ds.pldel,'del',true);syncSoon(MODE);NAV[TAB].pop();render()}return}
 if(ds.mv!=null){const k=MODE,id=ds.pid,a=plKeys(k,id),i=+ds.mv,j=i+(+ds.d);if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];const full=(doc(k).pls[id].keys||[]).filter(x=>!a.includes(x));setPl(k,id,'keys',[...a,...full]);syncSoon(k);render();return}
 if(ds.rm!=null){const k=MODE,id=ds.pid,a=plKeys(k,id);a.splice(+ds.rm,1);setPl(k,id,'keys',a);syncSoon(k);render();return}
 if(ds.sfav){const k=MODE;setF(k,ds.sfav,'fav',!it(k,ds.sfav).fav);syncSoon(k);if($('sheet').hidden===false&&!$('pv').classList.contains('open')&&!$('pm').classList.contains('open'))itemMenu(ds.sfav);render();if(P.key===ds.sfav)P.ui();return}
 if(ds.addpl){addPlMenu(ds.addpl);return}
 if(ds.esave){saveEdit(ds.esave);return}
 if(ds.delk){ev.stopPropagation();delDev(ds.delk);return}
 if(ds.rth){const id=MODE+'|'+ds.rth;await IDB.del('thumbs',id);TH.mem.delete(id);const B=LS.get('md_bad',{});delete B[id];LS.set('md_bad',B);TH.want(id);closeSheet();return}
 if(ds.close){closeSheet();return}
 if(ds.side){LS.set('md_side',ds.side);render();return}
 if(ds.pick){pickDir();return}if(ds.reopen){reopenDir();return}
 if(ds.conn&&!LS.get('md_mic_ok',0)&&!ds.ok){micNote('conn');return}
 if(ds.micok){closeSheet();if(ds.micok==='rx')startRx();else{SENDERR='';TX.connect().catch(e=>{TX.st='エラー：'+(e.message||e);render()})}return}
 if(ds.rxre){RX.stopListen();RX.why='';startRx();return}
 if(ds.conn){SENDERR='';TX.connect().catch(e=>{TX.st='エラー：'+(e.message||e);render()});return}
 if(ds.disc){TX.close();render();return}
 if(ds.dosend){doSend();return}if(ds.sstop){TX.stop=true;return}
 if(ds.selnew){const k=MODE;for(const e of PCF[k].values())if(!(it(k,e.key).sent>0))SEL[k].add(e.key);render();return}
 if(ds.selclr){SEL[MODE].clear();render();return}
 if(ds.sf){LS.set('md_sf_'+MODE,ds.sf);render();return}
 if(ds.savetok){const v=$('s_tok').value.trim();if(!v){alert('トークンを入力してね');return}LS.set('v2_token',v);$('s_tok').value='';syncNow(MODE);render();return}
 if(ds.syncnow){syncNow(MODE);return}
 if(ds.thall){if(!confirm('サムネを全部作り直す？'))return;for(const e of lib(MODE)){const id=MODE+'|'+e.key;await IDB.del('thumbs',id);TH.mem.delete(id)}LS.set('md_bad',{});render();return}
 if(ds.home){goHome();return}
 if(t.id==='rx_btn'){if(RX.on){RX.stopListen();WL.off();render()}else if(!LS.get('md_mic_ok',0))micNote('rx');else startRx();return}
});
document.addEventListener('change',ev=>{const t=ev.target,ds=t.dataset;
 if(t.id==='f_sort'){fil().sort=t.value;saveFil();render()}
 else if(t.id==='f_art'){fil().artist=t.value;saveFil();render()}
 else if(ds.sel!=null){const S=SEL[MODE];t.checked?S.add(ds.sel):S.delete(ds.sel);render()}
 else if(ds.selfold!=null){const S=SEL[MODE];const sf=LS.get('md_sf_'+MODE,'all');for(const e of PCF[MODE].values()){const d=e.path.includes('/')?e.path.slice(0,e.path.lastIndexOf('/')):'';if(d===ds.selfold)t.checked?S.add(e.key):S.delete(e.key)}render()}
 else if(ds.plt){const k=MODE,p=doc(k).pls[ds.plt];let a=(p.keys||[]).slice();a=t.checked?[...a.filter(x=>x!==ds.key),ds.key]:a.filter(x=>x!==ds.key);setPl(k,ds.plt,'keys',a);syncSoon(k)}
 else if(t.id==='s_norm'){LS.set('md_norm',t.checked);if(P.el)P.gain()}
 else if(t.id==='s_auto'){LS.set('md_auto',t.checked)}});
let qT=null;document.addEventListener('input',ev=>{if(ev.target.id==='f_q'){fil().q=ev.target.value;saveFil();clearTimeout(qT);qT=setTimeout(()=>{const r=$('sres');if(r){r.innerHTML=searchRes();afterRender()}},250)}});
$('hd_back').onclick=()=>{(NAV[TAB]||[]).pop();render()};
$('hd_home').onclick=()=>goHome();
$('sheet').addEventListener('click',e=>{if(e.target.id==='sheet')closeSheet()});
function micNote(w){sheet(`<h3>接続の準備</h3><p>PCとiPhoneを家のネットで直接つなぐために、マイクの許可を1回だけ聞くよ。つなぐためだけで、録音はしないし、すぐ止めるよ。</p><button data-micok="${w}">OK</button><button class="sub" data-close="1">やめる</button>`)}
async function startRx(){WL.on();RX.why='';RX.st='準備中';render();await NET.unlock();RX.listen();refreshEst();render()}
function goHome(){P.stop();MODE=null;closeSheet();render()}
async function refreshEst(){EST=await storageEst();if(MODE)render()}

// ===== 起動 =====
TX.on=()=>{if(MODE&&TAB==='send')render()};
let rxT=0;RX.ui=()=>{if(!(MODE&&TAB==='send'))return;const n=Date.now();if(n-rxT>400){rxT=n;render()}else{clearTimeout(RX._t);RX._t=setTimeout(()=>{rxT=Date.now();render()},400)}};
RX.onFile=k=>{refreshEst()};
SY.on=()=>{if(!MODE)return;if(TAB==='set'||(/^最終/.test(SY.msg)&&!(document.activeElement&&document.activeElement.matches('input,select'))))render()};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){if(MODE)syncNow(MODE)}else{if(MODE){syncNow(MODE)}}});
addEventListener('online',()=>MODE&&syncNow(MODE));
(async()=>{buildPlayers();render();await ST.init();await loadDev();await restoreDirs();EST=await storageEst();render();for(const k of['music','video'])syncNow(k);
 if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js?v='+APPV).catch(()=>{})})();
