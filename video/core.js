'use strict';
// ===== 共通 =====
const APPV=10;
const $=id=>document.getElementById(id);
const LS={get(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const isIOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const isPhone=isIOS||/Android/.test(navigator.userAgent);
const EXT={video:['mp4','m4v','mov','webm','mkv','avi','3gp','ts','amv','wmv','flv','rm','rmvb','asf','vob','mpg','mpeg','divx','3g2','ogv'],music:['mp3','m4a','aac','wav','flac','ogg','oga','opus','aif','aiff','wma','ape','ra','mka','ac3','dts','amr']};
const MIME={amv:'video/x-amv',wmv:'video/x-ms-wmv',flv:'video/x-flv',rm:'application/vnd.rn-realmedia',rmvb:'application/vnd.rn-realmedia-vbr',asf:'video/x-ms-asf',vob:'video/dvd',mpg:'video/mpeg',mpeg:'video/mpeg',divx:'video/divx','3g2':'video/3gpp2',ogv:'video/ogg',wma:'audio/x-ms-wma',ape:'audio/ape',ra:'audio/x-realaudio',mka:'audio/x-matroska',ac3:'audio/ac3',dts:'audio/vnd.dts',amr:'audio/amr',mp4:'video/mp4',m4v:'video/mp4',mov:'video/quicktime',webm:'video/webm',mkv:'video/x-matroska',avi:'video/x-msvideo','3gp':'video/3gpp',ts:'video/mp2t',mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',wav:'audio/wav',flac:'audio/flac',ogg:'audio/ogg',oga:'audio/ogg',opus:'audio/ogg',aif:'audio/aiff',aiff:'audio/aiff'};
const extOf=n=>((String(n).match(/\.([^.\/]+)$/)||[,''])[1]||'').toLowerCase();
const kindOf=n=>{const e=extOf(n);return EXT.video.includes(e)?'video':EXT.music.includes(e)?'music':null};
const mimeOf=n=>MIME[extOf(n)]||'application/octet-stream';
const fnv=s=>{let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0}return h.toString(16).padStart(8,'0')};
const fkey=(path,size)=>path+'|'+size;
const keyPath=k=>k.slice(0,k.lastIndexOf('|'));
const fnameOf=k=>fnv(k)+fnv('#'+k)+'.'+(extOf(keyPath(k))||'bin');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtT=s=>{s=Math.max(0,Math.floor(+s||0));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return(h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0')};
const fmtB=b=>{b=+b||0;return b>=1e9?(b/1e9).toFixed(1)+'GB':b>=1e6?(b/1e6).toFixed(0)+'MB':(b/1e3).toFixed(0)+'KB'};
const parseT=v=>{v=String(v||'').trim();if(!v)return 0;const p=v.split(/[:：]/).map(Number);if(p.some(isNaN))return 0;return p.reduce((a,x)=>a*60+x,0)};

// ===== IndexedDB =====
const IDB={db:null,
 open(){return this.db||(this.db=new Promise((res,rej)=>{const r=indexedDB.open('media_app',1);r.onupgradeneeded=()=>{const d=r.result;for(const s of['files','thumbs','kv','chunks'])if(!d.objectStoreNames.contains(s))d.createObjectStore(s)};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}))},
 req:r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}),
 async st(s,m){return(await this.open()).transaction(s,m||'readonly').objectStore(s)},
 async get(s,k){return this.req((await this.st(s)).get(k))},
 async put(s,k,v){return this.req((await this.st(s,'readwrite')).put(v,k))},
 async del(s,k){return this.req((await this.st(s,'readwrite')).delete(k))},
 async all(s){const st=await this.st(s);const[ks,vs]=await Promise.all([this.req(st.getAllKeys()),this.req(st.getAll())]);return ks.map((k,i)=>[k,vs[i]])},
 async getRange(s,lo,hi){return this.req((await this.st(s)).getAll(IDBKeyRange.bound(lo,hi)))},
 async delRange(s,lo,hi){return this.req((await this.st(s,'readwrite')).delete(IDBKeyRange.bound(lo,hi)))}
};

// ===== 端末内の保存（OPFS、だめならIndexedDB） =====
const ST={mode:null,w:null,seq:0,cb:{},
 init(){return this._i||(this._i=(async()=>{try{if(!navigator.storage||!navigator.storage.getDirectory||!window.Worker)throw 0;this.w=new Worker('opfs-worker.js?v='+APPV);this.w.onmessage=e=>{const c=this.cb[e.data.id];if(c){delete this.cb[e.data.id];e.data.err?c[1](new Error(e.data.err)):c[0](e.data)}};await Promise.race([this.call({op:'test'}),sleep(5000).then(()=>{throw 0})]);this.mode='opfs'}catch(e){this.mode='idb'}return this.mode})())},
 call(m,tr){return new Promise((res,rej)=>{m.id=++this.seq;this.cb[m.id]=[res,rej];this.w.postMessage(m,tr||[])})},
 async begin(name,resume){await this.init();if(this.mode==='opfs')return(await this.call({op:'open',name,truncate:!resume})).size;if(!resume){await IDB.delRange('chunks',name+'#',name+'#~');await IDB.put('kv','got|'+name,0);return 0}return(await IDB.get('kv','got|'+name))||0},
 async write(name,at,buf){if(this.mode==='opfs')return this.call({op:'write',name,at,buf},[buf]);await IDB.put('chunks',name+'#'+String(at).padStart(13,'0'),new Blob([buf]));await IDB.put('kv','got|'+name,at+buf.byteLength)},
 async end(name){if(this.mode==='opfs')return this.call({op:'close',name})},
 async file(name,mime){await this.init();if(this.mode==='opfs'){const d=await(await navigator.storage.getDirectory()).getDirectoryHandle('media');const f=await(await d.getFileHandle(name)).getFile();return new Blob([f],{type:mime})}const bl=await IDB.getRange('chunks',name+'#',name+'#~');return new Blob(bl,{type:mime})},
 async remove(name){await this.init();if(this.mode==='opfs')return this.call({op:'remove',name});await IDB.delRange('chunks',name+'#',name+'#~');await IDB.del('kv','got|'+name)}
};
async function storageEst(){try{const e=await navigator.storage.estimate();return{usage:e.usage||0,quota:e.quota||0,free:Math.max(0,(e.quota||0)-(e.usage||0))}}catch(x){return{usage:0,quota:0,free:0}}}
async function askPersist(){try{if(navigator.storage&&navigator.storage.persist){if(await navigator.storage.persisted())return true;return await navigator.storage.persist()}}catch(e){}return false}

// ===== 端末に入っているファイル一覧 =====
const DEV={music:new Map(),video:new Map()};
async function loadDev(){DEV.music=new Map();DEV.video=new Map();for(const[,f]of await IDB.all('files'))if(f&&f.done&&DEV[f.kind])DEV[f.kind].set(f.key,f)}

// ===== 同期データ（GitHub の slot-data/media/音楽・動画.json） =====
const GH_ROOT='https://api.github.com/repos/pokoden/slot-data/',REPO=GH_ROOT+'contents/';
const tok=()=>LS.get('v2_token','')||'';
const b64e=s=>{const b=new TextEncoder().encode(s);let r='';for(let i=0;i<b.length;i+=0x8000)r+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));return btoa(r)},b64d=s=>{const x=atob(String(s).replace(/\s/g,''));const b=new Uint8Array(x.length);for(let i=0;i<x.length;i++)b[i]=x.charCodeAt(i);return new TextDecoder().decode(b)};
const ghH=()=>({Authorization:'Bearer '+tok(),Accept:'application/vnd.github+json'});
async function ghGet(path){const r=await fetch(REPO+path+'?t='+Date.now(),{headers:ghH(),cache:'no-store'});if(r.status===404)return{sha:null,data:null};let j=null,raw='';
 if(r.ok){j=await r.json();raw=String(j.content||'').replace(/\s/g,'')}else if(r.status!==403)throw new Error('取得失敗 '+r.status);
 let sha=j&&j.sha;
 if(!raw){if(!sha){const dir=path.includes('/')?path.slice(0,path.lastIndexOf('/')):'',nm=path.slice(path.lastIndexOf('/')+1);const l=await fetch(REPO+dir+'?t='+Date.now(),{headers:ghH(),cache:'no-store'});if(!l.ok)throw new Error('取得失敗 '+l.status);const a=await l.json();const f=(Array.isArray(a)?a:[]).find(x=>x.name===nm);sha=f&&f.sha}if(!sha)throw new Error('取得失敗');
  const b=await fetch(GH_ROOT+'git/blobs/'+sha+'?t='+Date.now(),{headers:ghH(),cache:'no-store'});if(!b.ok)throw new Error('取得失敗 '+b.status);raw=(await b.json()).content||''}
 return{sha,data:raw?JSON.parse(b64d(raw)):null}}
async function ghPut(path,data,sha,msg){const body={message:msg||('media '+new Date().toISOString()),content:b64e(JSON.stringify(data))};if(sha)body.sha=sha;return fetch(REPO+path,{method:'PUT',headers:{...ghH(),'Content-Type':'application/json'},body:JSON.stringify(body)})}

const D={music:null,video:null};
const doc=k=>D[k]||(D[k]=LS.get('md_doc_'+k,null)||{items:{},pls:{}});
const saveDoc=k=>LS.set('md_doc_'+k,D[k]);
const it=(k,key)=>doc(k).items[key]||{};
// f:項目, auto:自動で入る値（手入力より弱い）
function setF(k,key,f,v,auto){const d=doc(k),o=d.items[key]||(d.items[key]={t:{}});o.t=o.t||{};if(auto){if(o.t[f]&&o[f]!=null)return false;o[f]=v;o.t[f]=1}else{o[f]=v;o.t[f]=Date.now()}saveDoc(k);return true}
function setPl(k,id,f,v){const d=doc(k),o=d.pls[id]||(d.pls[id]={t:{}});o.t=o.t||{};o[f]=v;o.t[f]=Date.now();saveDoc(k)}
const canon=o=>Array.isArray(o)?o.map(canon):o&&typeof o==='object'?Object.keys(o).sort().reduce((a,k)=>(a[k]=canon(o[k]),a),{}):o;
function mergeRec(a,b){a=a||{};b=b||{};const ta=a.t||{},tb=b.t||{},o={t:{}};for(const f of new Set([...Object.keys(a),...Object.keys(b)])){if(f==='t')continue;const x=ta[f]||0,y=tb[f]||0;let s=y>x?b:a,t=Math.max(x,y);if(!(f in s)){s=s===a?b:a}if(f in s){o[f]=s[f];o.t[f]=t}}return o}
function mergeMap(a,b){const o={};for(const k of new Set([...Object.keys(a||{}),...Object.keys(b||{})]))o[k]=mergeRec((a||{})[k],(b||{})[k]);return o}
const mergeDoc=(a,b)=>canon({items:mergeMap(a.items,b.items),pls:mergeMap(a.pls,b.pls)});
// この端末のID（iPhoneごとの送信済み管理用）と名前
const MYDEV=(()=>{let id=LS.get('md_dev_id','');if(!id){id=Math.random().toString(36).slice(2,10);LS.set('md_dev_id',id)}return id})();
const autoDevName=id=>'iPhone-'+String(id||'').slice(0,4).toUpperCase();
const devName=()=>LS.get('md_dev_name','')||autoDevName(MYDEV);
const SY={busy:{},again:{},tm:{},msg:LS.get('md_sync_msg',''),on:null};
function syMsg(t){SY.msg=t;LS.set('md_sync_msg',t);if(SY.on)SY.on()}
function syncSoon(k,ms){clearTimeout(SY.tm[k]);SY.tm[k]=setTimeout(()=>syncNow(k),ms||2000)}
async function syncNow(k){if(!k||!tok())return;if(navigator.onLine===false){syMsg('オフライン');return}if(SY.busy[k]){SY.again[k]=1;return}SY.busy[k]=1;syMsg('同期中…');
 try{const path='media/'+k+'.json';for(let i=0;i<4;i++){const g=await ghGet(path);const rem=g.data&&g.data.items?{items:g.data.items,pls:g.data.pls||{}}:{items:{},pls:{}};const m=mergeDoc(doc(k),rem);D[k]=m;saveDoc(k);
  if(JSON.stringify(m)!==JSON.stringify(canon(rem))){const r=await ghPut(path,{version:1,...m,updatedAt:new Date().toISOString()},g.sha,'media '+k+' sync');if(r.status===409||r.status===422){if(i<3){await sleep(400);continue}throw new Error('競合')}if(!r.ok)throw new Error('保存失敗 '+r.status)}break}
  const d=new Date(),p=n=>String(n).padStart(2,'0');syMsg(`最終同期 ${d.getMonth()+1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`)}
 catch(e){syMsg('エラー：'+(e.message||e))}finally{SY.busy[k]=0;if(SY.on)try{SY.on()}catch(e){}if(SY.again[k]){SY.again[k]=0;syncSoon(k,500)}}}

// ===== 接続の合図（slot-data/media/sig_*.json を使う） =====
const SIG={async put(name,data){for(let i=0;i<4;i++){const g=await ghGet('media/'+name+'.json');const r=await ghPut('media/'+name+'.json',data,g.sha,'media signal');if(r.ok)return;if(r.status===409||r.status===422){await sleep(300);continue}throw new Error('合図の保存失敗 '+r.status)}throw new Error('合図の保存失敗')},
 async get(name){return(await ghGet('media/'+name+'.json')).data}};

// ===== PC⇔iPhone 直接転送（WebRTC） =====
const ICE=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']},{urls:'stun:stun.cloudflare.com:3478'}];
const waitIce=(pc,ms)=>new Promise(res=>{if(pc.iceGatheringState==='complete')return res();const t=setTimeout(res,ms||5000);pc.addEventListener('icegatheringstatechange',()=>{if(pc.iceGatheringState==='complete'){clearTimeout(t);res()}})});
// マイク（録音はしない）。iPhoneのSafariはマイクが動いている間だけ本当の端末アドレスを出すので、接続が終わるまで止めない
const NET={st:'',err:'',s:null,
 live(){return!!(this.s&&this.s.getTracks().some(t=>t.readyState==='live'))},
 async start(){if(this.live())return'ok';try{if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){this.st='none';this.err='この端末では使えない';return this.st}
  // 音楽用の再生専用モードのままだとiPhoneはマイクを使えないので、一時的に録音もできるモードにする
  const AS=navigator.audioSession;if(AS){this.prevAS=this.prevAS||AS.type;try{AS.type='play-and-record'}catch(e){}}
  try{this.s=await navigator.mediaDevices.getUserMedia({audio:true})}catch(e){if(AS&&e&&e.name==='InvalidStateError'){try{AS.type='auto'}catch(x){}this.s=await navigator.mediaDevices.getUserMedia({audio:true})}else throw e}
  this.st='ok';this.err='';LS.set('md_mic_ok',1);for(const t of this.s.getTracks())t.addEventListener('ended',()=>{if(this.s&&!this.live())this.st='off'})}
  catch(e){this.s=null;this.st='ng';this.err=((e&&e.name)||'')+(e&&e.message?'：'+e.message:'');this.restoreAS()}return this.st},
 restoreAS(){const AS=navigator.audioSession;if(AS&&this.prevAS!=null){try{AS.type=this.prevAS==='play-and-record'?'playback':this.prevAS}catch(e){}this.prevAS=null}},
 stop(){if(this.s){for(const t of this.s.getTracks())t.stop();this.s=null}this.restoreAS();if(this.st==='ok')this.st='off'},
 txt(){return this.st==='ok'?(this.live()?'マイクON（接続用・録音なし）':'マイク停止'):this.st==='ng'?'マイク許可なし（'+this.err+'）':this.st==='none'?'マイク使えない':this.st==='off'?'マイク停止':''}};
function candSum(sdp){const o={host:0,mdns:0,v6:0,srflx:0,relay:0,ip4:[]};for(const l of String(sdp||'').split(/\r?\n/)){if(!l.startsWith('a=candidate:'))continue;const p=l.split(' '),addr=p[4]||'',typ=p[7];if(typ==='host'){if(/\.local$/i.test(addr))o.mdns++;else{o.host++;if(/^\d+\.\d+\.\d+\.\d+$/.test(addr)&&!o.ip4.includes(addr))o.ip4.push(addr)}}else if(typ==='srflx'||typ==='prflx')o.srflx++;else if(typ==='relay')o.relay++;if(addr.includes(':'))o.v6++}return o}
const candTxt=o=>[o.host?'端末アドレス'+o.host+(o.ip4.length?'('+o.ip4.join(',')+')':''):'',o.mdns?'隠しアドレス'+o.mdns:'',o.srflx?'外向き'+o.srflx:'',o.v6?'うちIPv6 '+o.v6:''].filter(Boolean).join('・')||'なし';
const isPriv=a=>/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a);
const net24=a=>a.split('.').slice(0,3).join('.');
async function failWhy(pc){const l=candSum(pc.localDescription&&pc.localDescription.sdp),r=candSum(pc.remoteDescription&&pc.remoteDescription.sdp);
 // 実際に届いた相手のアドレス（prflx）も見る
 const seen=[];let pairs=0;try{(await pc.getStats()).forEach(x=>{if(x.type==='remote-candidate'&&(x.candidateType==='prflx')){const ad=x.address||x.ip;if(ad&&!seen.includes(ad))seen.push(ad)}if(x.type==='candidate-pair')pairs++})}catch(e){}
 const rip=[...r.ip4,...seen.filter(a=>/^\d+\.\d+\.\d+\.\d+$/.test(a))].filter(isPriv),lip=l.ip4.filter(isPriv);let w;
 if(lip.length&&rip.length){w=lip.some(a=>rip.some(b=>net24(a)===net24(b)))?'同じネットワークなのに届かない（ルーターの「機器同士の通信を止める」設定かも）':`ネットワークが別（こっち${lip.join(',')}／相手${rip.join(',')}）。ルーターが2台あるかも`}
 else if(!l.host&&!r.host)w='両方の端末アドレスが隠れてる';
 else if(!l.host)w='こっちの端末アドレスが隠れてる';else if(!r.host)w='相手の端末アドレスが隠れてる';else w='届かない';
 if(!l.host)w+='（'+(NET.txt()||'マイク未確認')+'）';
 if(l.host&&r.host&&!seen.length&&!(lip.length&&rip.length))w+='｜相手からの通信が届いてない（ネットワークが分かれてるか、ルーターが止めてるかも）';
 return w+'｜こっち：'+candTxt(l)+'｜相手：'+candTxt(r)+(seen.length?'｜届いた相手：'+seen.join(','):'')}
// 失敗の見張り（つながらないまま25秒でも失敗扱い）
function watchPc(pc,cur,onFail,onOk){let done=false;const fail=async()=>{if(done||!cur())return;done=true;const w=await failWhy(pc);if(cur())onFail(w)};
 pc.addEventListener('connectionstatechange',()=>{if(pc.connectionState==='failed')fail();if(pc.connectionState==='connected'&&!done){done=true;onOk&&onOk()}});
 pc.addEventListener('iceconnectionstatechange',()=>{if(pc.iceConnectionState==='failed')fail();if((pc.iceConnectionState==='connected'||pc.iceConnectionState==='completed')&&!done){done=true;onOk&&onOk()}if(pc.iceConnectionState==='checking'&&!pc._t)pc._t=setTimeout(()=>{if(!['connected','completed'].includes(pc.iceConnectionState))fail()},25000)})}
const BATCH=4<<20,WIN=16<<20,HIWAT=8<<20;
// 送る側（PC）
const TX={pc:null,dc:null,st:'',peer:null,cur:null,waits:{},acked:0,stop:false,on:null,sessId:null,
 ui(){if(this.on)this.on()},
 close(){this.sessId=null;NET.stop();try{this.dc&&this.dc.close()}catch(e){}try{this.pc&&this.pc.close()}catch(e){}this.pc=this.dc=null;this.peer=null;this.st='';this.ui()},
 async connect(){this.close();if(!tok()){this.st='トークン未設定';this.ui();return}const id=Date.now().toString(36)+Math.random().toString(36).slice(2,7);this.sessId=id;
  this.why='';this.st='準備中';this.ui();await NET.start();if(this.sessId!==id)return;
  const pc=this.pc=new RTCPeerConnection({iceServers:ICE});const dc=this.dc=pc.createDataChannel('m',{ordered:true});dc.binaryType='arraybuffer';dc.bufferedAmountLowThreshold=1<<20;
  dc.onopen=()=>{this.st='接続済み';this.ui()};dc.onclose=()=>{if(this.pc===pc){if(this.st!=='接続失敗')this.st='切断';this.peer=null;this.stop=true;for(const w of Object.values(this.waits))w.rej&&w.rej(new Error('切断'));this.ui()}};
  dc.onmessage=e=>this.msg(JSON.parse(e.data));
  watchPc(pc,()=>this.pc===pc,w=>{this.st='接続失敗';this.why=w;NET.stop();this.ui()},()=>NET.stop());
  await pc.setLocalDescription(await pc.createOffer());await waitIce(pc,10000);
  if(this.sessId!==id){try{pc.close()}catch(e){}return}// 古い接続が新しい合図を上書きしないように
  await SIG.put('sig_offer',{id,sdp:pc.localDescription.sdp,at:Date.now()});if(this.sessId!==id)return;this.st='iPhone待ち';this.ui();
  const t0=Date.now();while(this.sessId===id&&Date.now()-t0<300000){await sleep(2000);if(this.sessId!==id||pc.remoteDescription)break;try{const a=await SIG.get('sig_answer');if(a&&a.id===id&&this.sessId===id){await pc.setRemoteDescription({type:'answer',sdp:a.sdp});this.st='接続中';this.ui();break}}catch(e){}}
  if(this.sessId===id&&!pc.remoteDescription){this.st='時間切れ';NET.stop();this.ui()}},
 msg(m){if(m.t==='hello'||m.t==='est'){this.peer={...(this.peer||{}),...m};if(m.have&&m.dev){const f='s_'+m.dev,now=Date.now();this.peer.hv={};for(const k of['music','video']){const hv=new Set(m.have[k]||[]);this.peer.hv[k]=hv;for(const key of hv)if(!(it(k,key)[f]>0))setF(k,key,f,now);for(const[key,o]of Object.entries(doc(k).items))if(o[f]>0&&!hv.has(key))setF(k,key,f,0)}const pe=LS.get('md_peers',{});pe[m.dev]=m.dname||pe[m.dev]||'';LS.set('md_peers',pe);LS.set('md_last_peer',m.dev)}else if(m.have)for(const k of['music','video'])for(const key of m.have[k]||[])if(!(it(k,key).sent>0)){setF(k,key,'sent',Date.now())}if(m.have){syncSoon('music');syncSoon('video')}this.ui();return}
  const w=this.waits[m.t+'|'+m.key];if(m.t==='ack'){if(this.cur&&this.cur.key===m.key){this.acked=m.got;if(this.ackW){const f=this.ackW;this.ackW=null;f()}}return}
  if(m.t==='done'&&this.peer){this.peer.free=m.free}
  if(w){delete this.waits[m.t+'|'+m.key];w.res(m)}},
 wait(t,key){return new Promise((res,rej)=>{this.waits[t+'|'+key]={res,rej}})},
 lowW(){const dc=this.dc;return new Promise(r=>{const f=()=>{dc.removeEventListener('bufferedamountlow',f);r()};dc.addEventListener('bufferedamountlow',f);setTimeout(f,1000)})},
 // list: [{kind,key,path,name,size,mime,get,meta}]
 // list:[{kind,key,path,name,size,mime,get,meta,conv}]  ev(x,状態,値)  状態: send/conv/done/fail/dup
 async send(list,ev){this.stop=false;
  for(const x of list){if(this.stop){ev(x,'fail','中止');continue}if(!this.dc||this.dc.readyState!=='open'){ev(x,'fail','iPhoneとの接続が切れた');continue}
   try{let file,size=x.size,mime=x.mime,conv=0;
    if(x.prep){ev(x,'prep',0);try{x.meta=await x.prep()}catch(e){x.meta={}}}
    if(x.conv){ev(x,'conv',0);file=await CONV.run(x.kind,await x.get(),x.name,p=>ev(x,'conv',p));size=file.size;mime=file.type;conv=1;if(this.stop)throw new Error('中止');if(x.meta&&(!x.meta.thumb||!x.meta.dur)){try{const o=await metaOf(x.kind,file,'a.'+(x.kind==='video'?'mp4':'m4a'));if(o.thumb&&!x.meta.thumb)x.meta.thumb=o.thumb;if(o.dur)x.meta.dur=o.dur}catch(e){}}}else file=await x.get();
    if(!this.dc||this.dc.readyState!=='open')throw new Error('iPhoneとの接続が切れた');
    this.cur={key:x.key,name:x.name};this.acked=0;
    const rdy=this.wait('ready',x.key);this.dc.send(JSON.stringify({t:'file',kind:x.kind,key:x.key,path:x.path,name:x.name,size,mime,conv,meta:x.meta||{}}));
    const r=await rdy;if(r.skip){ev(x,'dup',r.why||'iPhoneに同じものがある');continue}
    const dn=this.wait('done',x.key);let off=r.at||0;this.acked=off;ev(x,'send',off/size);
    const CH=Math.max(16384,Math.min(65536,(this.pc.sctp&&this.pc.sctp.maxMessageSize)||65536));
    while(off<size){if(this.stop)throw new Error('中止');const end=Math.min(off+BATCH,size);const u=new Uint8Array(await file.slice(off,end).arrayBuffer());
     for(let p=0;p<u.length;p+=CH){if(this.stop)throw new Error('中止');if(this.dc.readyState!=='open')throw new Error('iPhoneとの接続が切れた');
      while(this.dc.bufferedAmount>HIWAT)await this.lowW();
      while(off+p-this.acked>WIN){await new Promise(res=>{this.ackW=res;setTimeout(()=>{if(this.ackW===res){this.ackW=null;res()}},3000)});if(this.dc.readyState!=='open')throw new Error('iPhoneとの接続が切れた')}
      this.dc.send(u.subarray(p,Math.min(p+CH,u.length)))}
     off=end;ev(x,'send',off/size,end-off)}
    this.dc.send(JSON.stringify({t:'end',key:x.key}));const d=await dn;if(d.err)throw new Error('iPhone側：'+d.err);
    const pd=this.peer&&this.peer.dev;if(pd){setF(x.kind,x.key,'s_'+pd,Date.now());if(this.peer.hv)this.peer.hv[x.kind].add(x.key)}else setF(x.kind,x.key,'sent',Date.now());syncSoon(x.kind,4000);ev(x,'done',size)}
   catch(e){ev(x,'fail',e.message||String(e))}}
  this.cur=null}
};
// 受け取る側（iPhone）
const RX={gen:0,on:false,pc:null,dc:null,st:'',lastId:null,cur:null,ui:null,got:0,onFile:null,
 upd(){if(this.ui)this.ui()},
 async listen(){if(this.on)return;this.on=true;const g=++this.gen;this.st='待機中';this.upd();try{const o=await SIG.get('sig_offer');if(o){const a=await SIG.get('sig_answer').catch(()=>null);if(Date.now()-o.at>600000||(a&&a.id===o.id))this.lastId=o.id}}catch(e){}
  let idle=Date.now();while(this.on&&g===this.gen){if(this.dc&&this.dc.readyState==='open')idle=Date.now();else if(Date.now()-idle>1200000){this.stopListen();if(typeof WL!=='undefined')WL.off();break}if(!this.dc||this.dc.readyState!=='open'){try{const o=await SIG.get('sig_offer');if(g!==this.gen)break;if(o&&o.id!==this.lastId&&Math.abs(Date.now()-o.at)<600000){this.lastId=o.id;await this.answer(o,g)}}catch(e){this.st='待機中（'+(e.message||e)+'）';this.upd()}}await sleep(2500)}},
 stopListen(){this.on=false;this.gen++;NET.stop();try{this.dc&&this.dc.close()}catch(e){}try{this.pc&&this.pc.close()}catch(e){}this.pc=this.dc=null;this.st='';this.upd()},
 async answer(o,g){try{this.pc&&this.pc.close()}catch(e){}this.pc=null;await NET.start();if(g!==this.gen)return;const pc=this.pc=new RTCPeerConnection({iceServers:ICE});this.why='';
  watchPc(pc,()=>this.pc===pc,w=>{this.st='接続失敗（PCで再接続を押してね）';this.why=w;this.upd()},()=>NET.stop());
  pc.ondatachannel=e=>{const dc=this.dc=e.channel;dc.binaryType='arraybuffer';dc.onopen=async()=>{this.st='接続済み';this.upd();this.hello()};if(dc.readyState==='open')dc.onopen();dc.onclose=()=>{if(this.dc===dc){this.st=this.on?'待機中':'';for(const l of this.log)if(l.st==='recv'){l.st='fail';l.why='接続が切れた'}this.cur=null;this.upd()}};dc.onmessage=e=>this.msg(e.data)};
  this.st='接続中';this.upd();await pc.setRemoteDescription({type:'offer',sdp:o.sdp});await pc.setLocalDescription(await pc.createAnswer());await waitIce(pc,10000);if(g!==this.gen||this.pc!==pc){try{pc.close()}catch(e){}return}try{const a=await SIG.get('sig_answer');if(a&&a.id===o.id&&a.dev&&a.dev!==MYDEV){try{pc.close()}catch(e){}this.pc=null;NET.stop();this.st='待機中（PCは他のiPhoneとつないだ）';this.upd();return}}catch(e){}await SIG.put('sig_answer',{id:o.id,dev:MYDEV,sdp:pc.localDescription.sdp,at:Date.now()})},
 send(o){try{this.dc&&this.dc.readyState==='open'&&this.dc.send(JSON.stringify(o))}catch(e){}},
 async hello(){const e=await storageEst();const hq={music:{},video:{}};for(const k of['music','video'])for(const f of DEV[k].values())if(f.qh)hq[k][f.key]=f.qh;this.send({t:'hello',dev:MYDEV,dname:devName(),free:e.free,usage:e.usage,quota:e.quota,have:{music:[...DEV.music.keys()],video:[...DEV.video.keys()]},hq})},
 log:[],L(key){return this.log.find(x=>x.key===key)},
 q:Promise.resolve(),
 msg(d){if(typeof d!=='string'){const c=this.cur;if(!c)return;const u=new Uint8Array(d);c.buf.push(u);c.bl+=u.length;c.recv+=u.length;if(c.bl>=BATCH)this.flush();return}
  const m=JSON.parse(d);this.q=this.q.then(()=>this.ctl(m)).catch(e=>{const w=String(e.message||e);const l=this.L(m.key);if(l){l.st='fail';l.why=w}this.cur=null;this.upd();this.send({t:'done',key:m.key,err:w})})},
 flush(){const c=this.cur;if(!c||!c.bl)return;const n=c.bl,a=new Uint8Array(n);let p=0;for(const u of c.buf){a.set(u,p);p+=u.length}c.buf=[];c.bl=0;const at=c.wpos;c.wpos+=n;
  c.pend=c.pend.then(()=>ST.write(c.fn,at,a.buffer)).then(()=>{c.got=at+n;this.got=c.got;const lg=this.L(c.key);if(lg)lg.got=c.got;this.send({t:'ack',key:c.key,got:c.got});this.upd()});c.pend.catch(e=>{c.err=e})},
 async ctl(m){if(m.t==='file'){const id=m.kind+'|'+m.key,ex=await IDB.get('files',id);if(this.cur&&this.cur.key!==m.key){const pl=this.L(this.cur.key);if(pl&&pl.st==='recv'){pl.st='fail';pl.why='途中で止まった'}}let l=this.L(m.key);if(!l){l={key:m.key,kind:m.kind,name:m.name,size:m.size};this.log.unshift(l)}l.st='recv';l.got=0;l.why='';l.size=m.size;
   const nm=m.name.toLowerCase(),qh=(m.meta||{}).qh;let dup=ex&&ex.done?'もう入ってる':'';if(!dup)for(const f of DEV[m.kind].values()){if(f.key===m.key)continue;if(((f.name||'').toLowerCase()===nm&&f.size===m.size)||(qh&&f.qh===qh)){dup='同じ内容の「'+f.name+'」がある';break}}
   if(dup){l.st='dup';l.why=dup;this.upd();this.send({t:'ready',key:m.key,skip:1,why:dup});return}
   askPersist();const fn=fnameOf(m.key),resume=!!(ex&&!ex.done&&ex.size===m.size&&!m.conv);const at=await ST.begin(fn,resume);
   await IDB.put('files',id,{kind:m.kind,key:m.key,path:m.path,name:m.name,size:m.size,mime:m.mime,conv:!!m.conv,qh:qh||null,fn,done:false,added:Date.now()});
   this.cur={kind:m.kind,key:m.key,name:m.name,size:m.size,fn,meta:m.meta||{},buf:[],bl:0,recv:at,wpos:at,got:at,pend:Promise.resolve(),err:null};this.got=at;this.upd();
   this.send({t:'ready',key:m.key,at})}
  else if(m.t==='end'){const c=this.cur;if(!c||c.key!==m.key)return;this.flush();await c.pend;if(c.err)throw c.err;await ST.end(c.fn);if(c.got!==c.size)throw new Error('サイズ不一致');
   const id=c.kind+'|'+c.key,rec=await IDB.get('files',id);rec.done=true;rec.added=Date.now();await IDB.put('files',id,rec);DEV[c.kind].set(c.key,rec);
   const mt=c.meta;if(mt.thumb)await IDB.put('thumbs',id,mt.thumb);for(const f of['dur','ta','tt','tal','g'])if(mt[f]!=null)setF(c.kind,c.key,f,mt[f],1);setF(c.kind,c.key,'s_'+MYDEV,Date.now());syncSoon(c.kind,5000);
   this.cur=null;const lg=this.L(c.key);if(lg){lg.st='done';lg.got=c.size}const e=await storageEst();this.send({t:'done',key:c.key,free:e.free});if(this.onFile)this.onFile(c.kind,c.key);this.upd()}
  else if(m.t==='est'){const e=await storageEst();this.send({t:'est',free:e.free,usage:e.usage,quota:e.quota})}}
};

// ===== サムネ・長さ・タグ =====
function id3(buf){const u=new Uint8Array(buf);if(u.length<10||u[0]!==73||u[1]!==68||u[2]!==51)return null;const ver=u[3],ss=(a,i)=>(a[i]&127)<<21|(a[i+1]&127)<<14|(a[i+2]&127)<<7|(a[i+3]&127);const size=ss(u,6)+10,out={};let p=10;if(ver<3)return null;if(u[5]&64){p+=ver===4?ss(u,10):((u[10]<<24|u[11]<<16|u[12]<<8|u[13])+4)}
 const dec=(b,enc)=>{try{if(enc===0)return new TextDecoder('latin1').decode(b);if(enc===1)return new TextDecoder(b[0]===0xFE?'utf-16be':'utf-16le').decode(b.subarray(2));if(enc===2)return new TextDecoder('utf-16be').decode(b);return new TextDecoder().decode(b)}catch(e){return''}};
 const clean=s=>s.replace(/\u0000.*$/s,'').trim();
 while(p+10<=Math.min(size,u.length)){const id=String.fromCharCode(u[p],u[p+1],u[p+2],u[p+3]);if(!/^[A-Z0-9]{4}$/.test(id))break;const fs=ver===4?ss(u,p+4):(u[p+4]<<24|u[p+5]<<16|u[p+6]<<8|u[p+7])>>>0;const b=u.subarray(p+10,p+10+fs);p+=10+fs;if(p>u.length)break;
  if(id==='TIT2')out.tt=clean(dec(b.subarray(1),b[0]));else if(id==='TPE1')out.ta=clean(dec(b.subarray(1),b[0]));else if(id==='TALB')out.tal=clean(dec(b.subarray(1),b[0]));else if(id==='TPE2'&&!out.ta)out.ta=clean(dec(b.subarray(1),b[0]));
  else if(id==='APIC'&&!out.pic){const enc=b[0];let i=1;while(i<b.length&&b[i])i++;const mime=dec(b.subarray(1,i),0)||'image/jpeg';i+=2;if(enc===1||enc===2){while(i+1<b.length&&(b[i]||b[i+1]))i+=2;i+=2}else{while(i<b.length&&b[i])i++;i++}out.pic=new Blob([b.slice(i)],{type:mime})}}
 return out}
const loadImg=src=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src});
// m4a/mp4 のタグ（題名・アーティスト・アルバム・ジャケット）
async function mp4Tags(blob){const rd=async(o,n)=>new DataView(await blob.slice(o,o+n).arrayBuffer());let off=0,moov=null;
 for(let g=0;g<64&&off+8<=blob.size;g++){const h=await rd(off,16);let sz=h.getUint32(0);const ty=String.fromCharCode(h.getUint8(4),h.getUint8(5),h.getUint8(6),h.getUint8(7));if(sz===1)sz=Number(h.getBigUint64(8));else if(sz===0)sz=blob.size-off;if(sz<8)break;if(ty==='moov'){if(sz>40<<20)return null;moov=new Uint8Array(await blob.slice(off,off+sz).arrayBuffer());break}off+=sz}
 if(!moov)return null;const dv=new DataView(moov.buffer),out={};
 const walk=(st,en,path)=>{let p=st;while(p+8<=en){let sz=dv.getUint32(p);const ty=String.fromCharCode(moov[p+4],moov[p+5],moov[p+6],moov[p+7]);if(sz<8||p+sz>en)break;let c=p+8;if(ty==='meta')c+=4;
   if(['moov','udta','meta','ilst','trak','mdia','minf','stbl'].includes(ty)&&ty!=='stbl')walk(c,p+sz,path+'/'+ty);
   else if(path.endsWith('/ilst')){let q=c;while(q+16<=p+sz){const dsz=dv.getUint32(q);if(dsz<16)break;const dt=String.fromCharCode(moov[q+4],moov[q+5],moov[q+6],moov[q+7]);if(dt==='data'){const typ=dv.getUint32(q+8)&0xffffff,b=moov.subarray(q+16,q+dsz);
      if(ty==='covr'&&!out.pic)out.pic=new Blob([b.slice()],{type:typ===14?'image/png':'image/jpeg'});else if(typ===1){const t=new TextDecoder().decode(b).trim();if(ty==='\u00a9nam')out.tt=t;else if(ty==='\u00a9ART')out.ta=t;else if(ty==='aART'&&!out.ta)out.ta=t;else if(ty==='\u00a9alb')out.tal=t}}q+=dsz}}
   p+=sz}};
 walk(8,moov.length,'/moov');return out}
// FLAC のタグとジャケット
async function flacTags(blob){const u=new Uint8Array(await blob.slice(0,Math.min(blob.size,16<<20)).arrayBuffer());if(u.length<8||String.fromCharCode(u[0],u[1],u[2],u[3])!=='fLaC')return null;const dv=new DataView(u.buffer),out={};let p=4;
 while(p+4<=u.length){const last=u[p]&128,ty=u[p]&127,len=(u[p+1]<<16)|(u[p+2]<<8)|u[p+3];const b=p+4;if(b+len>u.length)break;
  if(ty===6&&!out.pic){let q=b+4;const ml=dv.getUint32(q);q+=4;const mime=new TextDecoder().decode(u.subarray(q,q+ml));q+=ml;const dl=dv.getUint32(q);q+=4+dl+16;const n=dv.getUint32(q);q+=4;out.pic=new Blob([u.slice(q,q+n)],{type:mime||'image/jpeg'})}
  else if(ty===4){let q=b;const vl=dv.getUint32(q,true);q+=4+vl;const cnt=dv.getUint32(q,true);q+=4;for(let i=0;i<cnt&&q<b+len;i++){const l=dv.getUint32(q,true);q+=4;const c=new TextDecoder().decode(u.subarray(q,q+l));q+=l;const e=c.indexOf('=');const k=c.slice(0,e).toUpperCase(),v=c.slice(e+1).trim();if(k==='TITLE')out.tt=v;else if(k==='ARTIST')out.ta=v;else if(k==='ALBUMARTIST'&&!out.ta)out.ta=v;else if(k==='ALBUM')out.tal=v}}
  p=b+len;if(last)break}return out}
// ジャケットが無い曲は題名の頭文字アイコン
const LETTER=new Map();
function letterArt(title){const ch=(String(title||'').trim()[0]||'♪').toUpperCase();if(LETTER.has(ch))return LETTER.get(ch);const c=document.createElement('canvas');c.width=c.height=300;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,300,300);g.addColorStop(0,'#141414');g.addColorStop(1,'#2a2418');x.fillStyle=g;x.fillRect(0,0,300,300);x.strokeStyle='#e9c46a';x.lineWidth=10;x.strokeRect(22,22,256,256);x.fillStyle='#e9c46a';x.font='bold 150px -apple-system,"Hiragino Sans","Noto Sans JP",sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(ch,150,160);x.fillStyle='#2b6fe8';x.fillRect(22,250,256,28);const u=c.toDataURL('image/jpeg',.85);LETTER.set(ch,u);return u}
function toThumb(src,w,h){const c=document.createElement('canvas');const r=Math.min(1,Math.max(w/(src.videoWidth||src.naturalWidth||w),h/(src.videoHeight||src.naturalHeight||h)));const sw=src.videoWidth||src.naturalWidth,sh=src.videoHeight||src.naturalHeight;if(!sw||!sh)return null;
 if(w===h){const s=Math.min(sw,sh);c.width=c.height=w;c.getContext('2d').drawImage(src,(sw-s)/2,(sh-s)/2,s,s,0,0,w,w)}else{c.width=Math.round(sw*Math.min(1,w/sw));c.height=Math.round(sh*Math.min(1,w/sw));c.getContext('2d').drawImage(src,0,0,c.width,c.height)}return c.toDataURL('image/jpeg',.72)}
function once(el,ev,ms){return new Promise((res,rej)=>{const t=setTimeout(()=>{cl();rej(new Error('timeout'))},ms||10000);const ok=()=>{cl();res()},ng=()=>{cl();rej(new Error('error'))};const cl=()=>{clearTimeout(t);el.removeEventListener(ev,ok);el.removeEventListener('error',ng)};el.addEventListener(ev,ok);el.addEventListener('error',ng)})}
// タグ文字列の後ろのNUL・空白を取る（m4a/mp3のタグに付いてくる）
const cleanTag=s=>String(s==null?'':s).replace(/[\u0000\uFFFD]/g,'').trim();
// 以前のデータに残ったNUL付きタグを直す
function fixTags(k){const d=doc(k);let ch=false;for(const o of Object.values(d.items))for(const f of['tt','ta','tal'])if(typeof o[f]==='string'){const v=cleanTag(o[f]);if(v!==o[f]){o[f]=v;o.t=o.t||{};if(!(o.t[f]>2))o.t[f]=2;ch=true}}if(ch){saveDoc(k);syncSoon(k,3000)}return ch}
async function metaOf(kind,blob,name){const o={};const url=URL.createObjectURL(blob);try{
 if(kind==='video'){const v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';v.src=url;await once(v,'loadedmetadata',15000);o.dur=v.duration;const t=Math.min(isFinite(v.duration)?v.duration*.2:1,60)||1;v.currentTime=t;await once(v,'seeked',15000);if(v.readyState<2)await once(v,'loadeddata',5000).catch(()=>{});o.thumb=toThumb(v,320,180);v.removeAttribute('src');v.load()}
 else{let t=null;const ex=extOf(name);try{if(ex==='mp3'||/mpeg/.test(blob.type))t=id3(await blob.slice(0,Math.min(blob.size,8<<20)).arrayBuffer());else if(['m4a','mp4','m4v','aac','alac','m4b'].includes(ex)||/mp4/.test(blob.type))t=await mp4Tags(blob);else if(ex==='flac')t=await flacTags(blob)}catch(e){}
  if(t){for(const f of['tt','ta','tal'])if(t[f]){const v=cleanTag(t[f]);if(v)o[f]=v}if(t.pic){const pu=URL.createObjectURL(t.pic);try{o.thumb=toThumb(await loadImg(pu),300,300)}catch(e){}URL.revokeObjectURL(pu)}}
  const a=document.createElement('audio');a.preload='metadata';a.src=url;try{await once(a,'loadedmetadata',10000);if(isFinite(a.duration))o.dur=a.duration}catch(e){}a.removeAttribute('src')}
 }catch(e){o.bad=1}finally{URL.revokeObjectURL(url)}return o}
// 音量そろえ：曲は全体を解析、動画は再生中に測る
async function loudOf(blob){if(blob.size>80<<20)return null;try{const C=window.OfflineAudioContext||window.webkitOfflineAudioContext;const ctx=new C(1,1,44100);const ab=await ctx.decodeAudioData(await blob.arrayBuffer());let s=0,n=0;for(let c=0;c<ab.numberOfChannels;c++){const d=ab.getChannelData(c);for(let i=0;i<d.length;i+=7){s+=d[i]*d[i];n++}}const rms=Math.sqrt(s/Math.max(1,n));return rms>0?gainFor(rms):null}catch(e){return null}}
const gainFor=rms=>Math.max(.3,Math.min(3,.1/rms));
