'use strict';
// ===== PCの送る画面（Apple Music・Sony Music Center風） =====
const SKIPDIR=['再生不可','削除済み'],UPDIR='iPhoneから';
const PRW={music:'',video:''};                 // フォルダの書き込み許可
const PQ={music:'',video:''};                  // 検索
const PANC={music:null,video:null};            // Shift範囲の起点
let PSHOWN=[],PBUSY=null;
const FG=[['snd','送信',[['un','未送信'],['new','NEW'],['sent','送信済み']]],['ply','再生',[['ok','再生できる'],['bad','再生不可']]],['dup','重複',[['y','重複'],['n','重複じゃない']]],['gone','削除済み',[['y','削除済み'],['n','削除済みじゃない']]]];
function pf(k){const f=LS.get('md_pf_'+k,null)||{};for(const[g]of FG)if(!Array.isArray(f[g]))f[g]=[];return f}
const pv=k=>Object.assign({v:'all',g:null},LS.get('md_pv_'+k,null)||{});
const ps=k=>Object.assign({c:'path',d:1},LS.get('md_ps_'+k,null)||{});
const akey=()=>String(LS.get('md_acoustid','')||'').trim();
const dirOf=p=>p.includes('/')?p.slice(0,p.lastIndexOf('/')):'';
const pct=(a,b)=>(b>0?Math.min(100,a/b*100):0).toFixed(1)+'%';
// 削除済みの一覧に入っているか（「取り込まない」の設定に関係なく）
function inDel(k,e){const n=(e.name||'').toLowerCase(),q=QH.get(k+'|'+e.key);for(const o of delList(k)){if(o.key&&o.key===e.key)return true;if(o.name&&n===String(o.name).toLowerCase()&&+o.size===e.size)return true;if(q&&o.qh&&q===o.qh)return true}return false}
function pCtx(k){const D=dupPC(k),NW=new Set(LS.get('md_new_'+k,[])),M=new Map();return{D,s(e){let o=M.get(e.key);if(!o){const sent=sentTo(k,e.key);o={sent,isNew:!sent&&NW.has(e.key),bad:!!badSend(k,e),dup:D.has(e.key),gone:inDel(k,e)};M.set(e.key,o)}return o}}}
function chipOk(g,c,s){if(g==='snd')return c==='un'?!s.sent:c==='new'?s.isNew:s.sent;if(g==='ply')return c==='bad'?s.bad:!s.bad;if(g==='dup')return c==='y'?s.dup:!s.dup;return c==='y'?s.gone:!s.gone}
function pGroupsOf(k,v,e){if(v==='folder')return[dirOf(e.path)];if(v==='artist')return[artistOf(k,e)];if(v==='album')return[albumOf(k,e)||''];if(v==='tag'){const t=it(k,e.key).tags||[];return t.length?t:['']}return[]}
function pGroupList(k,v){const m=new Map();for(const e of PCF[k].values())for(const g of pGroupsOf(k,v,e))m.set(g,(m.get(g)||0)+1);return[...m].sort((a,b)=>a[0].localeCompare(b[0],'ja'))}
function gLabel(k,v,g){if(g)return g;return v==='folder'?(PCDIR[k]&&PCDIR[k].name||'/'):v==='album'?'アルバムなし':v==='tag'?'タグなし':'—'}
const SRK=s=>s.gone?0:s.bad?1:s.dup?2:s.isNew?3:!s.sent?4:5;
function pSort(k,L,c){const o=ps(k),ja=(a,b)=>a.localeCompare(b,'ja');const C={title:(a,b)=>ja(titleOf(k,a),titleOf(k,b)),artist:(a,b)=>ja(artistOf(k,a),artistOf(k,b))||ja(albumOf(k,a),albumOf(k,b)),album:(a,b)=>ja(albumOf(k,a),albumOf(k,b)),dur:(a,b)=>(it(k,a.key).dur||0)-(it(k,b.key).dur||0),size:(a,b)=>a.size-b.size,st:(a,b)=>SRK(c.s(a))-SRK(c.s(b)),path:(a,b)=>ja(a.path,b.path)};const f=C[o.c]||C.path;return L.sort((a,b)=>f(a,b)*o.d||ja(a.path,b.path))}
function pList(k,c){const v=pv(k),q=PQ[k].trim().toLowerCase(),f=pf(k);let B=[...PCF[k].values()];
 if(v.v!=='all'&&v.g!=null)B=B.filter(e=>pGroupsOf(k,v.v,e).includes(v.g));
 if(q)B=B.filter(e=>(titleOf(k,e)+' '+artistOf(k,e)+' '+albumOf(k,e)+' '+e.path+' '+(it(k,e.key).tags||[]).join(' ')).toLowerCase().includes(q));
 const cnt={};for(const[g,,cs]of FG)for(const[cv]of cs)cnt[g+':'+cv]=B.filter(e=>chipOk(g,cv,c.s(e))).length;
 const L=B.filter(e=>FG.every(([g])=>!f[g].length||f[g].some(cv=>chipOk(g,cv,c.s(e)))));return{L:pSort(k,L,c),cnt}}
function pBadges(k,e,s,D){const st=SST[k].get(e.key);let h=s.sent?'<em class="b ok">送信済み</em>':s.isNew?'<em class="b nw">NEW</em>':'<em class="b un">未送信</em>';
 if(s.bad)h+=`<em class="b bad" title="${esc(badSend(k,e))}">再生不可</em>`;if(s.dup)h+=`<em class="b dp" title="${esc(D.get(e.key)||'')}">重複</em>`;if(s.gone)h+='<em class="b dl">削除済み</em>';if(st)h+=`<em class="b ${stCls(st)}">${esc(stTxt(st))}</em>`;return h}
function pRow(k,e,c){const s=c.s(e),on=SEL[k].has(e.key),ti=titleOf(k,e),d=it(k,e.key);
 return`<tr data-pr="${esc(e.key)}" class="${on?'sel':''}" title="${esc(e.path)}"><td class="pc"><input type="checkbox" data-xck="${esc(e.key)}"${on?' checked':''}></td><td class="pj ${k}"><img data-tk="${esc(k+'|'+e.key)}" alt=""${k==='music'?` src="${letterArt(ti)}"`:''}></td><td class="pt"><b>${esc(ti)}</b></td><td class="par">${esc(artistOf(k,e))}</td><td class="pal">${esc(albumOf(k,e))}</td><td class="pn">${d.dur?fmtT(d.dur):''}</td><td class="pn">${fmtB(e.size)}</td><td class="pst">${pBadges(k,e,s,c.D)}</td></tr>`}
function vTx(k){const F=PCF[k],c=pCtx(k),S=SEL[k];pRWCheck(k);const v=pv(k),f=pf(k),o=ps(k);
 const r=F.size?pList(k,c):{L:[],cnt:{}},L=r.L;PSHOWN=L.map(e=>e.key);
 const side=`<aside class="pside"><h4>ライブラリ</h4>${['music','video'].map(m=>`<button class="pnav${m===k?' on':''}" data-xlib="${m}"><span>${m==='music'?'🎵':'🎬'} ${NAME[m]}</span><i>${PCF[m].size||''}</i></button>`).join('')}
 <h4>表示</h4>${[['all',k==='music'?'すべての曲':'すべての動画'],['folder','フォルダ'],['artist','アーティスト'],['album','アルバム'],['tag','タグ']].map(([id,t])=>`<button class="pnav${v.v===id?' on':''}" data-xv="${id}"><span>${t}</span></button>`).join('')}
 ${v.v!=='all'?`<div class="pgl">${pGroupList(k,v.v).map(([g,n])=>`<button class="pg${v.g===g?' on':''}" data-xg="${esc(g)}"><span>${esc(gLabel(k,v.v,g))}</span><i>${n}</i></button>`).join('')}</div>`:''}</aside>`;
 let cen;
 if(!F.size)cen=`<div class="pempty"><div class="pei">${k==='music'?'🎵':'🎬'}</div><button class="big" data-pickdir="1">フォルダを選ぶ</button>${PCNEED[k]?`<button class="sub big" data-reopen="1">「${esc(PCDIR[k].name)}」を開く</button>`:''}</div>`;
 else{const th=(id,t,cl)=>`<th class="${cl||''}${o.c===id?' on':''}" data-xsort="${id}">${t}${o.c===id?(o.d>0?' ▲':' ▼'):''}</th>`;
  cen=`<div class="ptop"><input id="x_q" type="search" placeholder="曲名・アーティスト・アルバム・フォルダ" value="${esc(PQ[k])}" autocomplete="off">
  <div class="pfl">${FG.map(([g,gt,cs])=>`<div class="pfg"><b>${gt}</b>${cs.map(([cv,ct])=>`<button class="chip${f[g].includes(cv)?' on':''}" data-xf="${g}:${cv}">${ct}<i>${r.cnt[g+':'+cv]||0}</i></button>`).join('')}</div>`).join('')}</div>
  <div class="pact"><button class="sub" data-xall="1">出てるものを全部選択</button><button class="sub" data-xnone="1">全部解除</button><b class="pcnt">${L.length}件</b></div></div>
  <table class="ptbl" id="ptbl"><thead><tr><th class="pc"><input type="checkbox" data-xpall="1"${L.length&&L.every(e=>S.has(e.key))?' checked':''}></th><th class="pj"></th>${th('title','タイトル')}${th('artist','アーティスト','par')}${th('album','アルバム','pal')}${th('dur','長さ','pn')}${th('size','サイズ','pn')}${th('st','状態')}</tr></thead><tbody>${L.map(e=>pRow(k,e,c)).join('')}</tbody></table>`}
 const dir=`<div class="pcard"><div class="pbar"><button class="sub" data-pickdir="1">${PCDIR[k]?'フォルダを選び直す':'フォルダを選ぶ'}</button>${PCNEED[k]&&F.size?`<button data-reopen="1">「${esc(PCDIR[k].name)}」を開く</button>`:''}</div>${PCDIR[k]?`<div class="kv"><span>フォルダ</span><b>${esc(PCDIR[k].name)}</b></div>`:''}</div>`;
 return`<div class="pcw">${side}<div class="pcen">${cen}</div><div class="pright"><div id="pr_send">${pSendBox(k)}</div>${dir}<div id="pr_up">${pUpRecv(k)}</div>${F.size?pTools(k):''}</div></div>`}
function sumHtml(k){if(!SUM||SUM.k!==k)return'';const F=PCF[k],ks=SUM.keys,c={done:0,fail:0,dup:0,gone:0,bad:0};let b=0;for(const x of ks){const st=SST[k].get(x),e=F.get(x);if(!st||!e)continue;if(c[st.s]!=null)c[st.s]++;if(st.s==='done')b+=e.size;else if(st.s==='send')b+=(st.p||0)*e.size}
 const cur=ks.map(x=>[x,SST[k].get(x)]).find(([,st])=>st&&['send','prep'].includes(st.s));const ce=cur&&F.get(cur[0]);
 return`<div class="psum"><div class="kv"><span>${SENDING?'送信中':'終了'} ${c.done} / ${ks.length}</span><b>${fmtB(b)} / ${fmtB(SUM.total)}</b></div><div class="prog"><div style="width:${pct(b,SUM.total)}"></div></div>${ce?`<div class="fr"><span>${esc(titleOf(k,ce))}</span><b class="bl">${esc(stTxt(cur[1]))}</b></div>`:''}${SENDING&&SUM.sp?`<div class="kv"><span>速さ</span><b>${fmtB(SUM.sp)}/秒</b></div>`:''}${c.fail||c.dup||c.gone||c.bad?`<div class="kv"><span>${[c.fail?'失敗 '+c.fail:'',c.dup?'重複スキップ '+c.dup:'',c.bad?'再生不可スキップ '+c.bad:'',c.gone?'削除済み '+c.gone:''].filter(Boolean).join('・')}</span></div>`:''}</div>`}
const tgl=x=>`<div class="seg2">${[[1,'送る'],[0,'送らない']].map(([v,t])=>`<button class="${(LS.get('md_snd_'+x,false)?1:0)===v?'on':''}" data-xtg="${x}:${v}">${t}</button>`).join('')}</div>`;
function pSendBox(k){const F=PCF[k],S=SEL[k];let selB=0,n=0;for(const x of S){const e=F.get(x);if(e){selB+=e.size;n++}}
 const pn=TX.peer&&TX.peer.dev?peerName(TX.peer.dev):'',ln=peerName(LS.get('md_last_peer','')),con=TX.st==='接続済み',P=TX.peer;const free=P?P.free||0:0,tot=P?(P.usage||0)+free:0,over=!!P&&selB>free;
 return`<div class="pcard pdev"><div class="pdh"><div class="pdi">${svg('<path d="M7 1.5h10a2 2 0 012 2v17a2 2 0 01-2 2H7a2 2 0 01-2-2v-17a2 2 0 012-2zm0 3v14h10v-14zm4 15.2h2v1.3h-2z"/>')}</div><div class="pdn"><b>${esc(pn||'iPhone')}</b><span class="${/失敗|切れ|エラー|時間切れ/.test(TX.st)?'red':con?'ok':'gd'}">${esc(TX.st||'未接続')}</span></div></div>${micRow()}${TX.why&&/失敗|切断/.test(TX.st)?`<div class="red">${esc(TX.why)}</div>`:''}${!pn&&ln?`<div class="kv"><span>✓の基準</span><b>前回の${esc(ln)}</b></div>`:''}
 ${P?`<div class="pfb"><div class="u" style="width:${pct(P.usage||0,tot)}"></div><div class="s${over?' over':''}" style="width:${pct(selB,tot)}"></div></div><div class="kv"><span>空き</span><b class="${over?'red':''}">${fmtB(free)}</b></div>`:''}
 <div class="pbar"><button data-conn="1" class="${con?'sub':''}">${con?'つなぎ直す':/失敗|時間切れ|切断|エラー/.test(TX.st)?'再接続':'iPhoneとつなぐ'}</button>${TX.st?'<button class="sub" data-disc="1">切断</button>':''}</div></div>
 <div class="pcard"><div class="kv"><span>選択 ${n}件</span><b class="${over?'red':''}">${fmtB(selB)}</b></div>${sumHtml(k)}<div class="pbar">${SENDING?'<button class="sub dng big" data-sstop="1">中止</button>':`<button class="big" data-dosend="1" ${n&&con?'':'disabled'}>送る</button>`}</div>
 <div class="ptg"><span>重複</span>${tgl('dup')}</div><div class="ptg"><span>再生不可</span>${tgl('bad')}</div></div>`}
function pUpRecv(k){const L=PRX.log.filter(x=>x.k===k).slice(0,8),need=PCDIR[k]&&PCDIR[k].getDirectoryHandle&&PRW[k]&&PRW[k]!=='granted';if(!L.length&&!need&&!PCDIR[k])return'';
 return`<div class="pcard"><h4>iPhoneから</h4>${need?'<button class="sub wide" data-xrw="1">iPhoneからの受け取りを許可</button>':''}${PCDIR[k]?`<div class="kv"><span>保存先</span><b>${esc(PCDIR[k].name)}/${UPDIR}</b></div>`:''}
 ${L.map(x=>`<div class="fr"><span>${esc(x.name)}</span><b class="${x.st==='done'?'ok':x.st==='fail'?'red':x.st==='dup'?'gd':'bl'}">${x.st==='recv'?'受信中 '+Math.round((x.got||0)/(x.size||1)*100)+'%':x.st==='done'?'保存済み':x.st==='dup'?'PCにある':'失敗：'+esc(x.why||'')}</b></div>`).join('')}</div>`}
function pTools(k){const A=[...PCF[k].values()],nb=A.filter(e=>badSend(k,e)).length,ng=A.filter(e=>inDel(k,e)).length,un=A.filter(e=>{const d=it(k,e.key);return!d.mb&&!d.mbx}).length;
 return`<div class="pcard"><h4>整理</h4><button class="sub wide" data-xmv="bad" ${nb&&!PBUSY?'':'disabled'}>再生不可を仕分け ${nb}</button><button class="sub wide" data-xmv="gone" ${ng&&!PBUSY?'':'disabled'}>削除済みをPCから消す ${ng}</button><div id="x_mvp">${mvProg()}</div></div>
 <div class="pcard"><h4>曲の情報</h4><button class="sub wide" id="x_idsel" data-xid="sel" ${SEL[k].size&&!IDQ.busy?'':'disabled'}>選択したものを取得</button><button class="sub wide" data-xid="rest" ${un&&!IDQ.busy?'':'disabled'}>未取得を全部 ${un}</button><div id="x_idp">${idProg()}</div><label class="fl"><span>AcoustIDキー</span><input id="x_ak" type="text" autocomplete="off" spellcheck="false" value="${esc(akey())}"></label>${akey()?'':'<div class="red">キー未設定</div>'}</div>`}
const mvProg=()=>PBUSY?`<div class="kv"><span>${esc(PBUSY.t)}へ移動中 ${PBUSY.i} / ${PBUSY.n}</span></div><div class="prog"><div style="width:${pct(PBUSY.i,PBUSY.n)}"></div></div>`:'';
function pLay(){const t=document.querySelector('.ptop');if(!t)return;const h=document.querySelector('header').offsetHeight;t.style.top=h+'px';document.documentElement.style.setProperty('--pth',(h+t.offsetHeight)+'px')}
addEventListener('resize',()=>{if(MODE&&TAB==='send')pLay()});
// 一覧を作り直さずに、状態だけ書き換える
function pLite(){const k=MODE;if(!k||!$('pr_send'))return false;$('pr_send').innerHTML=pSendBox(k);if($('pr_up'))$('pr_up').innerHTML=pUpRecv(k);if($('x_idp'))$('x_idp').innerHTML=idProg();if($('x_mvp'))$('x_mvp').innerHTML=mvProg();
 const c=pCtx(k);for(const tr of document.querySelectorAll('#ptbl tr[data-pr]')){const e=PCF[k].get(tr.dataset.pr);if(!e)continue;const td=tr.querySelector('.pst'),h=pBadges(k,e,c.s(e),c.D);if(td.innerHTML!==h)td.innerHTML=h}$('hd_st').innerHTML=hdStatus();return true}
function pSelUpd(k){const S=SEL[k];for(const tr of document.querySelectorAll('#ptbl tr[data-pr]')){const on=S.has(tr.dataset.pr);tr.classList.toggle('sel',on);const cb=tr.querySelector('input');if(cb)cb.checked=on}
 const ha=document.querySelector('[data-xpall]');if(ha)ha.checked=PSHOWN.length>0&&PSHOWN.every(x=>S.has(x));if($('pr_send'))$('pr_send').innerHTML=pSendBox(k);const b=$('x_idsel');if(b)b.disabled=!S.size||IDQ.busy}
async function pRWCheck(k){const h=PCDIR[k];if(!h||!h.queryPermission)return;try{const q=await h.queryPermission({mode:'readwrite'});if(q!==PRW[k]){PRW[k]=q;if(MODE===k&&$('pr_up'))$('pr_up').innerHTML=pUpRecv(k)}}catch(e){}}
async function rwOK(k){const h=PCDIR[k];if(!h||!h.getDirectoryHandle){alert('フォルダを選び直してね');return false}try{let p=await h.queryPermission({mode:'readwrite'});if(p!=='granted')p=await h.requestPermission({mode:'readwrite'});PRW[k]=p;if(p!=='granted')alert('フォルダへの書き込みが許可されてないよ');return p==='granted'}catch(e){alert(e.message||e);return false}}
// 同じ名前があれば (2)(3)… をつける。上書きはしない
async function freeName(dir,name){const i=name.lastIndexOf('.'),b=i>0?name.slice(0,i):name,x=i>0?name.slice(i):'';for(let n=1;n<10000;n++){const nm=n===1?name:`${b} (${n})${x}`;try{await dir.getFileHandle(nm)}catch(e){if(e&&e.name==='NotFoundError')return nm;if(e&&e.name==='TypeMismatchError')continue;throw e}}throw new Error('名前が決まらない')}
async function copyTo(dir,name,file){const nm=await freeName(dir,name);const fh=await dir.getFileHandle(nm,{create:true});const w=await fh.createWritable();
 try{await w.write(file);await w.close()}catch(e){try{await w.abort()}catch(x){}try{await dir.removeEntry(nm)}catch(x){}throw e}
 if((await fh.getFile()).size!==file.size){try{await dir.removeEntry(nm)}catch(x){}throw new Error('コピーのサイズが合わない')}return nm}
// コピーしてから元を消す（途中で止まっても、どちらかに必ず残る）
async function pMove(k,list,folder,ask){list=list.filter(e=>e&&e.dh);if(!list.length){alert('移せるファイルがないよ');return}if(PBUSY)return;if(!await rwOK(k))return;if(!confirm(ask.replace('〇',list.length)))return;
 PBUSY={t:folder,i:0,n:list.length};pLite();const ng=[];let ok=0;
 try{const dst=await PCDIR[k].getDirectoryHandle(folder,{create:true});for(const e of list){try{const f=await e.get();await copyTo(dst,e.name,f);await e.dh.removeEntry(e.name);PCF[k].delete(e.key);SEL[k].delete(e.key);ok++}catch(x){ng.push(e.name+'：'+(x.message||x))}PBUSY.i++;pLite()}}
 catch(x){ng.push(x.message||String(x))}finally{PBUSY=null;render()}
 alert(`${ok}件を「${folder}」に移したよ`+(ng.length?`\n移せなかった ${ng.length}件\n`+ng.slice(0,5).join('\n'):''))}
function pMoveBad(k,sel){const A=sel||[...PCF[k].values()].filter(e=>badSend(k,e));return pMove(k,A,'再生不可','〇件を移しますか？')}
function pMoveGone(k,sel){const A=sel||[...PCF[k].values()].filter(e=>inDel(k,e));return pMove(k,A,'削除済み','〇件を消しますか？\nフォルダの中の「削除済み」に移すよ')}
// --- 右クリックのメニュー ---
function pMenuClose(){const m=$('pmenu');if(m)m.hidden=true}
function pMenu(k,x,y){const E=[...SEL[k]].map(z=>PCF[k].get(z)).filter(Boolean);let m=$('pmenu');if(!m){m=document.createElement('div');m.id='pmenu';document.body.appendChild(m)}
 m.innerHTML=`<b>${E.length}件</b><button data-xcm="send" ${E.length&&TX.st==='接続済み'&&!SENDING?'':'disabled'}>送る</button><button data-xcm="bad" ${E.length&&!PBUSY?'':'disabled'}>再生不可へ仕分け</button><button data-xcm="gone" ${E.length&&!PBUSY?'':'disabled'}>削除済みへ移す</button><button data-xcm="id" ${E.length&&!IDQ.busy?'':'disabled'}>曲の情報を取得</button>${E.length===1?'<button data-xcm="edit">情報を編集</button>':''}`;
 m.hidden=false;const w=m.offsetWidth,h=m.offsetHeight;m.style.left=Math.max(4,Math.min(x,innerWidth-w-4))+'px';m.style.top=Math.max(4,Math.min(y,innerHeight-h-4))+'px'}
function pClickRow(k,key,ev,box){const S=SEL[k],add=ev.ctrlKey||ev.metaKey;
 if(ev.shiftKey&&PANC[k]&&PSHOWN.includes(PANC[k])&&PSHOWN.includes(key)){const a=PSHOWN.indexOf(PANC[k]),b=PSHOWN.indexOf(key),lo=Math.min(a,b),hi=Math.max(a,b);if(!add&&!box)S.clear();for(let i=lo;i<=hi;i++)S.add(PSHOWN[i])}
 else if(add||box){S.has(key)?S.delete(key):S.add(key);PANC[k]=key}else{S.clear();S.add(key);PANC[k]=key}pSelUpd(k)}
document.addEventListener('click',ev=>{const t=ev.target;if(!t.closest('#pmenu'))pMenuClose();
 const q=t.closest('[data-xcand],[data-xpick],[data-xcs],[data-xmiss],[data-xupstop],[data-xidstop]');
 if(q){const d=q.dataset,k=MODE;if(d.xcand!=null){const m=IDQ.miss.find(z=>z.key===d.xcand);idCand(k,d.xcand,m?m.C:[],m?m.why:'')}else if(d.xpick!=null){const c=CANDS[+d.xpick],key=CKEY;if(!c)return;q.disabled=true;idApply(k,key,c).then(()=>{IDQ.miss=IDQ.miss.filter(z=>z.key!==key);syncSoon(k);if(IDQ.miss.length)idMissSheet(k);else closeSheet();render()})}else if(d.xcs!=null)candSearch();else if(d.xmiss!=null)idMissSheet(k);else if(d.xupstop!=null)UP.stop=true;else if(d.xidstop!=null)IDQ.stop=true;return}
 if(!MODE||TAB!=='send')return;const k=MODE;
 const b=t.closest('[data-xsort],[data-xf],[data-xv],[data-xg],[data-xlib],[data-xtg],[data-xall],[data-xnone],[data-xmv],[data-xid],[data-xcm],[data-xrw],[data-xpall],[data-xck]');
 if(b){const d=b.dataset;
  if(d.xck!=null){pClickRow(k,d.xck,ev,true);return}
  if(d.xpall!=null){const S=SEL[k];if(b.checked)for(const x of PSHOWN)S.add(x);else for(const x of PSHOWN)S.delete(x);pSelUpd(k);return}
  if(d.xsort){const o=ps(k);if(o.c===d.xsort)o.d=-o.d;else{o.c=d.xsort;o.d=['dur','size'].includes(d.xsort)?-1:1}LS.set('md_ps_'+k,o);render();return}
  if(d.xf){const[g,c]=d.xf.split(':'),f=pf(k);f[g]=f[g].includes(c)?f[g].filter(x=>x!==c):[...f[g],c];LS.set('md_pf_'+k,f);render();return}
  if(d.xv){LS.set('md_pv_'+k,{v:d.xv,g:null});render();return}
  if(d.xg!=null){const v=pv(k);v.g=v.g===d.xg?null:d.xg;LS.set('md_pv_'+k,v);render();return}
  if(d.xlib){if(d.xlib!==MODE){MODE=d.xlib;LS.set('md_last',MODE);for(const x in NAV)delete NAV[x];render();syncNow(MODE)}return}
  if(d.xtg){const[x,v]=d.xtg.split(':');LS.set('md_snd_'+x,v==='1');pLite();return}
  if(d.xall){for(const x of PSHOWN)SEL[k].add(x);pSelUpd(k);return}
  if(d.xnone){SEL[k].clear();pSelUpd(k);return}
  if(d.xmv==='bad'){pMoveBad(k);return}if(d.xmv==='gone'){pMoveGone(k);return}
  if(d.xid==='sel'){idRun(k,[...SEL[k]].filter(x=>PCF[k].has(x)));return}
  if(d.xid==='rest'){idRun(k,[...PCF[k].values()].filter(e=>{const z=it(k,e.key);return!z.mb&&!z.mbx}).map(e=>e.key));return}
  if(d.xrw){rwOK(k).then(()=>pLite());return}
  if(d.xcm){pMenuClose();const E=[...SEL[k]].map(z=>PCF[k].get(z)).filter(Boolean);if(d.xcm==='send')doSend();else if(d.xcm==='bad')pMoveBad(k,E);else if(d.xcm==='gone')pMoveGone(k,E);else if(d.xcm==='id')idRun(k,E.map(e=>e.key));else if(d.xcm==='edit'&&E[0])itemMenu(E[0].key);return}
  return}
 const tr=t.closest('#ptbl tr[data-pr]');if(tr)pClickRow(k,tr.dataset.pr,ev,false)});
document.addEventListener('dblclick',ev=>{if(!MODE||TAB!=='send')return;const tr=ev.target.closest('#ptbl tr[data-pr]');if(tr&&!ev.target.closest('input'))itemMenu(tr.dataset.pr)});
document.addEventListener('contextmenu',ev=>{if(!MODE||TAB!=='send')return;const tr=ev.target.closest('#ptbl tr[data-pr]');if(!tr)return;ev.preventDefault();const k=MODE,key=tr.dataset.pr;if(!SEL[k].has(key)){SEL[k].clear();SEL[k].add(key);PANC[k]=key;pSelUpd(k)}pMenu(k,ev.clientX,ev.clientY)});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape')pMenuClose();if(!MODE||TAB!=='send'||!$('ptbl')||ev.target.matches('input,select,textarea'))return;if((ev.ctrlKey||ev.metaKey)&&ev.key==='a'){ev.preventDefault();for(const x of PSHOWN)SEL[MODE].add(x);pSelUpd(MODE)}});
addEventListener('scroll',pMenuClose,{passive:true});
let pqT=null;document.addEventListener('input',ev=>{const t=ev.target;if(t.id==='x_q'){PQ[MODE]=t.value;clearTimeout(pqT);pqT=setTimeout(()=>{render();const i=$('x_q');if(i){i.focus();const n=i.value.length;try{i.setSelectionRange(n,n)}catch(e){}}},220)}});
document.addEventListener('change',ev=>{const t=ev.target;if(t.id==='x_ak'){LS.set('md_acoustid',t.value.trim());render()}});

// ===== 曲の情報を取得（AcoustID・MusicBrainz・Cover Art Archive） =====
const IDQ={busy:false,stop:false,done:false,i:0,n:0,ok:0,cur:'',miss:[]};
const RL={};async function rl(h,ms){const n=Date.now(),t=Math.max(n,RL[h]||0);RL[h]=t+ms;if(t>n)await sleep(t-n)}
let FPM=null;const fpLoad=()=>FPM||(FPM=import('./lib/chromaprint/fp.js?v='+APPV).catch(e=>{FPM=null;throw e}));
async function fpOf(blob){const m=await fpLoad();return m.fingerprint(await blob.arrayBuffer())}
async function acoLookup(fp,dur){await rl('ac',350);const b=new URLSearchParams({client:akey(),format:'json',duration:String(Math.round(dur)),meta:'recordings releasegroups compress',fingerprint:fp});
 const r=await fetch('https://api.acoustid.org/v2/lookup',{method:'POST',body:b});let j=null;try{j=await r.json()}catch(e){}
 if(!j||j.status!=='ok'){const c=j&&j.error&&j.error.code;const er=new Error(c===4?'AcoustIDキーが違うみたい':c===14||r.status===429?'AcoustIDが混んでる':'AcoustIDエラー'+(j&&j.error?'：'+j.error.message:' '+r.status));er.fatal=c===4;throw er}return j.results||[]}
const artJoin=A=>(A||[]).map((x,i)=>x.name+(x.joinphrase!=null?x.joinphrase:i<A.length-1?', ':'')).join('');
function pickRG(G){return G.find(g=>g.type==='Album'&&!(g.secondarytypes||[]).length)||G.find(g=>!(g.secondarytypes||[]).length)||G[0]||null}
function acoCands(R){const out=[],seen=new Set();for(const r of[...R].sort((a,b)=>(b.score||0)-(a.score||0)))for(const rec of r.recordings||[]){if(!rec.title||seen.has(rec.id))continue;seen.add(rec.id);const g=pickRG(rec.releasegroups||[]);out.push({src:'ac',t:rec.title,a:artJoin(rec.artists),al:g?g.title:'',rg:g?g.id:'',rec:rec.id,score:r.score||0,len:rec.duration||0})}return out}
const luc=s=>String(s).replace(/[\\"+\-!(){}\[\]^~*?:\/]|&&|\|\|/g,' ').trim();
function pickRel(R){return R.find(r=>r.status==='Official'&&r['release-group']&&r['release-group']['primary-type']==='Album'&&!(r['release-group']['secondary-types']||[]).length)||R.find(r=>r.status==='Official')||R[0]||null}
async function mbSearch(t,a){await rl('mb',1100);let q=`recording:"${luc(t)}"`;if(a)q+=` AND artist:"${luc(a)}"`;
 const r=await fetch('https://musicbrainz.org/ws/2/recording?fmt=json&limit=12&query='+encodeURIComponent(q),{headers:{Accept:'application/json'}});if(r.status===503){await sleep(1500);return mbSearch(t,a)}if(!r.ok)throw new Error('MusicBrainzエラー '+r.status);const j=await r.json();
 return(j.recordings||[]).map(x=>{const rl2=pickRel(x.releases||[]);return{src:'mb',t:x.title,a:(x['artist-credit']||[]).map(c=>(c.name||(c.artist&&c.artist.name)||'')+(c.joinphrase||'')).join(''),al:rl2?rl2.title:'',rg:rl2&&rl2['release-group']?rl2['release-group'].id:'',rec:x.id,score:(x.score||0)/100,len:x.length?x.length/1000:0}})}
const cvUrl=rg=>'https://coverartarchive.org/release-group/'+rg+'/front-250';
async function cvLoad(id,u){try{const r=await fetch(u);if(!r.ok)return r.status===404?'none':false;const b=await r.blob(),url=URL.createObjectURL(b);try{const th=toThumb(await loadImg(url),300,300);if(!th)return false;await TH.set(id,th);const D=LS.get('md_cvd',{});D[id]=u;LS.set('md_cvd',D);return true}finally{URL.revokeObjectURL(url)}}catch(e){return false}}
// 元のファイルはさわらず、名前・アーティスト・アルバム・ジャケットを上書き（全部のiPhoneに同期）
async function idApply(k,key,c){if(c.t)setF(k,key,'n',c.t);if(c.a)setF(k,key,'a',c.a);if(c.al)setF(k,key,'al',c.al);if(c.rec)setF(k,key,'mb',c.rec);
 if(k==='music'&&c.rg){const u=cvUrl(c.rg);if(await cvLoad(k+'|'+key,u)===true)setF(k,key,'cv',u)}syncSoon(k,4000)}
async function idOne(k,e){const b=await blobOf(k,e.key);if(!b)return{ok:false,why:'ファイルが読めない',C:[]};if(b.size>300*1048576)return{ok:false,why:'大きすぎる',C:[]};
 let fp;try{fp=await fpOf(b)}catch(x){return{ok:false,why:'音を読めない',C:[]}}
 const C=acoCands(await acoLookup(fp.fp,fp.dur));if(C.length&&C[0].score>=.8){await idApply(k,e.key,C[0]);return{ok:true}}return{ok:false,why:C.length?'自信がない':'見つからない',C}}
const idUi=()=>{if($('x_idp'))$('x_idp').innerHTML=idProg()};
function idProg(){if(IDQ.busy)return`<div class="kv"><span>取得中 ${IDQ.i} / ${IDQ.n}</span><button class="sub nar" data-xidstop="1">止める</button></div><div class="prog"><div style="width:${pct(IDQ.i,IDQ.n)}"></div></div>${IDQ.cur?`<div class="fr"><span>${esc(IDQ.cur)}</span></div>`:''}`;
 if(IDQ.done&&IDQ.n>1)return`<div class="kv"><span>取得 ${IDQ.ok}件${IDQ.miss.length?'・見つからない '+IDQ.miss.length+'件':''}</span>${IDQ.miss.length?'<button class="sub nar" data-xmiss="1">見る</button>':''}</div>`;return''}
async function idRun(k,keys){if(IDQ.busy||!keys.length)return;
 if(!akey()){if(keys.length===1){IDQ.miss=[];idCand(k,keys[0],[],'AcoustIDキー未設定のため名前で探す');return}alert('AcoustIDキーを入れてね（右の「曲の情報」の欄）');return}
 Object.assign(IDQ,{busy:true,stop:false,done:false,i:0,n:keys.length,ok:0,miss:[],cur:''});pLite();let fatal='';
 try{for(const key of keys){if(IDQ.stop)break;const e=PCF[k].get(key)||libMap(k).get(key);if(!e){IDQ.i++;continue}IDQ.cur=titleOf(k,e);idUi();
  let r;try{r=await idOne(k,e)}catch(x){r={ok:false,why:x.message||String(x),C:[]};if(x.fatal){fatal=r.why;break}}
  if(r.ok)IDQ.ok++;else{IDQ.miss.push({key,why:r.why,C:r.C||[]});setF(k,key,'mbx',Date.now())}IDQ.i++;idUi()}}
 finally{IDQ.busy=false;IDQ.done=true;IDQ.cur='';syncSoon(k,3000);render()}
 if(fatal){alert(fatal);return}if(keys.length===1&&IDQ.miss.length){const m=IDQ.miss[0];idCand(k,m.key,m.C,m.why)}else if(IDQ.miss.length&&!IDQ.stop)idMissSheet(k)}
function idMissSheet(k){const m=libMap(k);sheet(`<h3>見つからなかった ${IDQ.miss.length}件</h3><div class="rows">${IDQ.miss.map(z=>{const e=m.get(z.key)||{key:z.key,path:keyPath(z.key)};return`<div class="fr"><span>${esc(titleOf(k,e))}</span><b class="gd">${esc(z.why)}</b><button class="sub nar" data-xcand="${esc(z.key)}">候補</button></div>`}).join('')}</div><button class="sub" data-close="1">閉じる</button>`)}
let CANDS=[],CKEY=null;
function candList(){return CANDS.map((c,i)=>`<button class="pcand" data-xpick="${i}">${c.rg?`<img src="${cvUrl(c.rg)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`:'<img alt="" style="visibility:hidden">'}<span><b>${esc(c.t)}</b><i>${esc(c.a)}${c.al?'・'+esc(c.al):''}</i></span><em>${c.len?fmtT(c.len):''}${c.src==='ac'?' 🎧'+Math.round(c.score*100)+'%':''}</em></button>`).join('')}
function idCand(k,key,pre,note){const e=libMap(k).get(key)||{key,path:keyPath(key)};CKEY=key;CANDS=(pre||[]).slice(0,8);const t=titleOf(k,e).replace(/^\d{1,3}[\s._-]+/,''),a=artistOf(k,e);
 sheet(`<h3>曲の情報を取得</h3><div class="fr"><span>${esc(e.path)}</span></div>${note?`<div class="red">${esc(note)}</div>`:''}<label class="fl"><span>曲名</span><input id="x_ct" type="text" value="${esc(t)}"></label><label class="fl"><span>アーティスト</span><input id="x_ca" type="text" value="${esc(a==='その他'?'':a)}"></label><div class="pbar"><button data-xcs="1">探す</button></div><div id="x_cl" class="pcl">${candList()}</div><button class="sub" data-close="1">閉じる</button>`);candSearch()}
async function candSearch(){const ti=$('x_ct'),ar=$('x_ca'),box=$('x_cl');if(!ti||!box)return;const t=ti.value.trim(),a=ar.value.trim();if(!t)return;const key=CKEY;box.innerHTML=candList()+'<div class="kv"><span>探してる…</span></div>';
 let C=[],err='';try{C=await mbSearch(t,a);if(!C.length&&a)C=await mbSearch(t,'')}catch(x){err=x.message||String(x)}if(CKEY!==key||!$('x_cl'))return;
 const keep=CANDS.filter(c=>c.src==='ac');CANDS=[...keep,...C.filter(c=>!keep.some(z=>z.rec===c.rec))];$('x_cl').innerHTML=CANDS.length?candList():`<div class="kv"><span class="${err?'red':''}">${esc(err||'見つからない')}</span></div>`}
// ほかの端末：同期されたジャケットURLを取ってきて保存
const CVQ=new Set(),CVT=new Set();let CVB=false;
function cvSync(){const D=LS.get('md_cvd',{});for(const img of document.querySelectorAll('img[data-tk]')){const id=img.dataset.tk;if(!id.startsWith('music|')||CVT.has(id))continue;const cv=it('music',id.slice(6)).cv;if(cv&&D[id]!==cv)CVQ.add(id)}cvRun()}
async function cvRun(){if(CVB)return;CVB=true;try{while(CVQ.size){const id=CVQ.values().next().value;CVQ.delete(id);CVT.add(id);const cv=it('music',id.slice(6)).cv;if(!cv)continue;const r=await cvLoad(id,cv);if(r==='none'){const D=LS.get('md_cvd',{});D[id]=cv;LS.set('md_cvd',D)}}}finally{CVB=false}}

// ===== iPhone → PC（同じ直接接続で送る） =====
const UP={busy:false,stop:false,list:[],waits:{},cur:null,acked:0,ackW:null};
const PRX={log:[],cur:null};
function upMsg(m){if(m.t==='upack'){if(UP.cur===m.key){UP.acked=m.got;if(UP.ackW){const f=UP.ackW;UP.ackW=null;f()}}return}const w=UP.waits[m.t+'|'+m.key];if(w){delete UP.waits[m.t+'|'+m.key];w.res(m)}}
function upWait(t,key){return new Promise((res,rej)=>{const iv=setInterval(()=>{if(!RX.dc||RX.dc.readyState!=='open'){clearInterval(iv);delete UP.waits[t+'|'+key];rej(new Error('PCとの接続が切れた'))}},1000);UP.waits[t+'|'+key]={res:m=>{clearInterval(iv);res(m)}}})}
function upBox(){const L=UP.list;if(!L.length)return'';const tot=L.reduce((a,x)=>a+x.size,0),got=L.reduce((a,x)=>a+(x.st==='done'||x.st==='dup'?x.size:x.got||0),0),dn=L.filter(x=>x.st==='done').length;
 return`<div class="kv"><span>${UP.busy?'PCへ送信中':'終了'} ${dn} / ${L.length}</span><b>${fmtB(got)} / ${fmtB(tot)}</b></div><div class="prog"><div style="width:${pct(got,tot)}"></div></div>${L.map(x=>`<div class="fr"><span>${esc(x.title||x.name)}</span><b class="${x.st==='done'?'ok':x.st==='fail'?'red':x.st==='dup'?'gd':'bl'}">${x.st==='wait'?'待機':x.st==='send'?'送信中 '+Math.round((x.got||0)/(x.size||1)*100)+'%':x.st==='done'?'完了':x.st==='dup'?'PCにある':'失敗：'+esc(x.why||'')}</b></div>`).join('')}`}
const upCard=k=>UP.list.length&&UP.list[0].k===k?`<div class="card"><h3>PCへ送る</h3>${upBox()}${UP.busy?'<div class="pbar"><button class="sub dng" data-xupstop="1">中止</button></div>':''}</div>`:'';
let upT=0;function upUi(){if($('up_box'))$('up_box').innerHTML=upBox();if(MODE)$('hd_st').innerHTML=hdStatus();const n=Date.now();if(TAB==='send'&&MODE&&n-upT>500){upT=n;sendRender()}}
function upSheet(){sheet(`<h3>PCへ送る</h3><div id="up_box">${upBox()}</div><div class="pbar"><button class="sub dng" data-xupstop="1">中止</button></div><button class="sub" data-close="1">閉じる</button>`)}
async function upStart(k,keys){if(!keys.length)return;if(UP.busy){upSheet();return}
 if(!RX.dc||RX.dc.readyState!=='open'){alert('先にPCとつないでね\nPC：送る画面で「iPhoneとつなぐ」\nこのiPhone：「iPhoneで受け取る」で「受け取りを始める」');return}
 MS.on=false;MS.keys.clear();render();const m=libMap(k);UP.list=keys.map(key=>{const f=DEV[k].get(key);return{key,k,name:f.name,title:titleOf(k,m.get(key)||{key,path:f.path}),size:f.size,st:'wait',got:0}});upSheet();await upSend(k)}
async function upSend(k){UP.busy=true;UP.stop=false;WL.on('up');upUi();
 try{for(const x of UP.list){if(UP.stop){x.st='fail';x.why='中止';continue}
  try{const dc=RX.dc;if(!dc||dc.readyState!=='open')throw new Error('PCとの接続が切れた');const f=DEV[k].get(x.key);const b=await blobOf(k,x.key);if(!f||!b)throw new Error('ファイルが見つからない');
   const d=it(k,x.key),th=await TH.get(k+'|'+x.key);const meta={thumb:th||null,dur:d.dur,tt:d.tt,ta:d.ta,tal:d.tal,n:d.n,a:d.a,al:d.al,tags:d.tags,mb:d.mb,cv:d.cv};
   x.st='send';x.got=0;UP.cur=x.key;UP.acked=0;upUi();const rdy=upWait('upready',x.key);RX.send({t:'up',kind:k,key:x.key,path:f.path,name:f.name,size:b.size,mime:b.type||f.mime,dev:MYDEV,meta});const r=await rdy;
   if(r.err)throw new Error(r.err);if(r.skip){x.st='dup';continue}
   const dn=upWait('updone',x.key),CH=Math.max(16384,Math.min(65536,(RX.pc&&RX.pc.sctp&&RX.pc.sctp.maxMessageSize)||65536));let off=0;
   while(off<b.size){if(UP.stop)throw new Error('中止');const end=Math.min(off+BATCH,b.size),u=new Uint8Array(await b.slice(off,end).arrayBuffer());
    for(let p=0;p<u.length;p+=CH){if(UP.stop)throw new Error('中止');if(dc.readyState!=='open')throw new Error('PCとの接続が切れた');
     while(dc.bufferedAmount>HIWAT)await new Promise(r2=>{const g=()=>{dc.removeEventListener('bufferedamountlow',g);r2()};dc.addEventListener('bufferedamountlow',g);setTimeout(g,1000)});
     while(off+p-UP.acked>WIN){await new Promise(r2=>{UP.ackW=r2;setTimeout(()=>{if(UP.ackW===r2){UP.ackW=null;r2()}},3000)});if(dc.readyState!=='open')throw new Error('PCとの接続が切れた')}
     dc.send(u.subarray(p,Math.min(p+CH,u.length)))}
    off=end;x.got=off;upUi()}
   RX.send({t:'upend',key:x.key});const z=await dn;if(z.err)throw new Error('PC側：'+z.err);x.st='done';x.got=x.size}
  catch(e){x.st='fail';x.why=e.message||String(e);if(/中止/.test(x.why))RX.send({t:'upcancel',key:x.key})}upUi()}}
 finally{UP.busy=false;UP.cur=null;WL.off('up');upUi();if(TAB==='send')render()}}
// PC側：受け取ってフォルダの「iPhoneから」に保存
const txSend=o=>{try{TX.dc&&TX.dc.readyState==='open'&&TX.dc.send(JSON.stringify(o))}catch(e){}};
let prT=null;function prUi(){clearTimeout(prT);prT=setTimeout(()=>{if(MODE&&TAB==='send'){if($('pr_up'))$('pr_up').innerHTML=pUpRecv(MODE);$('hd_st').innerHTML=hdStatus()}},250)}
function upAlias(k,pcKey,m){ALIAS[k][pcKey]=m.key;LS.set('md_alias_'+k,ALIAS[k]);const mt=m.meta||{};for(const f of['dur','tt','ta','tal'])if(mt[f]!=null)setF(k,pcKey,f,mt[f],1);
 for(const f of['n','a','al','mb','cv'])if(mt[f])setF(k,pcKey,f,mt[f]);if(Array.isArray(mt.tags)&&mt.tags.length)setF(k,pcKey,'tags',mt.tags);if(mt.thumb)TH.set(k+'|'+pcKey,mt.thumb);
 const kn=LS.get('md_known_'+k,[]);if(!kn.includes(pcKey)){kn.push(pcKey);LS.set('md_known_'+k,kn)}syncSoon(k,5000)}
function upFlush(c){if(!c.bl)return;const a=new Uint8Array(c.bl);let p=0;for(const u of c.buf){a.set(u,p);p+=u.length}c.buf=[];c.bl=0;c.chain=c.chain.then(()=>c.w.write(a)).then(()=>{c.got+=a.length;txSend({t:'upack',key:c.key,got:c.got})}).catch(e=>{c.err=c.err||e})}
function upData(d){const c=PRX.cur;if(!c)return;const u=new Uint8Array(d);c.buf.push(u);c.bl+=u.length;c.recv+=u.length;c.lg.got=c.recv;if(c.bl>=BATCH)upFlush(c);prUi()}
async function upDrop(c){try{await c.w.abort()}catch(x){}try{await c.dir.removeEntry(c.nm)}catch(x){}}
let PRQ=Promise.resolve();function upCtl(m){PRQ=PRQ.then(()=>upCtl2(m)).catch(()=>{})}
async function upCtl2(m){
 if(m.t==='up'){const k=m.kind,root=PCDIR[k];if(PRX.cur){await upDrop(PRX.cur);PRX.cur.lg.st='fail';PRX.cur.lg.why='途中で止まった';PRX.cur=null}
  const lg={key:m.key,k,name:m.name,size:m.size,got:0,st:'recv'};PRX.log.unshift(lg);PRX.log.length=Math.min(PRX.log.length,50);
  try{if(!root||!root.getDirectoryHandle)throw new Error('PCで'+(k==='music'?'音楽':'動画')+'のフォルダを選んでね');
   const q=await root.queryPermission({mode:'readwrite'});PRW[k]=q;if(q!=='granted')throw new Error('PCの送る画面で「iPhoneからの受け取りを許可」を押してね');
   const nm0=m.name.toLowerCase(),ex=[...PCF[k].values()].find(e=>e.name.toLowerCase()===nm0&&e.size===m.size);
   if(ex){lg.st='dup';upAlias(k,ex.key,m);txSend({t:'upready',key:m.key,skip:1,why:'PCに同じものがある'});prUi();return}
   const dir=await root.getDirectoryHandle(UPDIR,{create:true}),nm=await freeName(dir,m.name),fh=await dir.getFileHandle(nm,{create:true}),w=await fh.createWritable();
   PRX.cur={key:m.key,m,k,dir,nm,fh,w,buf:[],bl:0,recv:0,got:0,chain:Promise.resolve(),err:null,lg};txSend({t:'upready',key:m.key})}
  catch(e){lg.st='fail';lg.why=e.message||String(e);txSend({t:'upready',key:m.key,err:lg.why})}prUi();return}
 if(m.t==='upend'){const c=PRX.cur;if(!c||c.key!==m.key)return;
  try{upFlush(c);await c.chain;if(c.err)throw c.err;await c.w.close();const f=await c.fh.getFile();if(f.size!==c.m.size)throw new Error('サイズが合わない');
   const path=UPDIR+'/'+c.nm,key=fkey(path,f.size);upAlias(c.k,key,c.m);PCF[c.k].set(key,{key,path,name:c.nm,size:f.size,lm:f.lastModified,get:()=>c.fh.getFile(),fh:c.fh,dh:c.dir});
   c.lg.st='done';c.lg.got=f.size;txSend({t:'updone',key:m.key,name:c.nm})}
  catch(e){await upDrop(c);c.lg.st='fail';c.lg.why=e.message||String(e);txSend({t:'updone',key:m.key,err:c.lg.why})}
  PRX.cur=null;if(MODE===c.k&&TAB==='send'&&!SENDING)render();else prUi();return}
 if(m.t==='upcancel'){const c=PRX.cur;if(c&&c.key===m.key){await upDrop(c);c.lg.st='fail';c.lg.why='中止';PRX.cur=null;prUi()}}}
