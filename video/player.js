'use strict';
// ===== 画面を消さない =====
const WL={s:null,want:false,async on(){this.want=true;try{if('wakeLock'in navigator&&!this.s){this.s=await navigator.wakeLock.request('screen');this.s.addEventListener('release',()=>{this.s=null})}}catch(e){}},off(){this.want=false;if(this.s){this.s.release().catch(()=>{});this.s=null}}};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&WL.want)WL.on()});
try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch(e){}
// ===== 音量（Web Audio） =====
const AU={ctx:null,n:new Map(),
 ensure(){try{if(!this.ctx){const C=window.AudioContext||window.webkitAudioContext;this.ctx=new C()}if(this.ctx.state!=='running')this.ctx.resume().catch(()=>{})}catch(e){}return this.ctx},
 attach(el){if(this.n.has(el))return this.n.get(el);const c=this.ensure();if(!c)return null;try{const s=c.createMediaElementSource(el),g=c.createGain(),a=c.createAnalyser();a.fftSize=2048;s.connect(a);s.connect(g);g.connect(c.destination);const o={g,a};this.n.set(el,o);return o}catch(e){return null}}};
const useWA=k=>k==='video'||!isIOS;
// 無音（タップの時に一度鳴らして、以後の再生を許可させる）
const SILENT=(()=>{const n=800,b=new Uint8Array(44+n*2),v=new DataView(b.buffer),w=(o,s)=>{for(let i=0;i<s.length;i++)b[o+i]=s.charCodeAt(i)};w(0,'RIFF');v.setUint32(4,36+n*2,true);w(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,n*2,true);let s='';for(let i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return'data:audio/wav;base64,'+btoa(s)})();
const SVI=d=>`<svg class="si" viewBox="0 0 24 24" fill="currentColor">${d}</svg>`;
const BACK='<svg viewBox="0 0 24 24" class="bkv"><path d="M15.5 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SV={prev:SVI('<path d="M5 5h2.4v14H5zm3.4 7L19 5v14z"/>'),next:SVI('<path d="M16.6 5H19v14h-2.4zM15.6 12L5 19V5z"/>'),shuf:SVI('<path d="M16 4l4 3.5-4 3.5V8.7h-1.6c-1.3 0-2.1.6-3 1.9l-1.1 1.5 1.1 1.5c.9 1.3 1.7 1.9 3 1.9H16V13l4 3.5-4 3.5v-2.3h-1.6c-2.2 0-3.5-1-4.8-2.9l-.6-.8-.6.8C7.1 16.7 5.8 17.7 3.6 17.7H3v-2.4h.6c1.3 0 2.1-.6 3-1.9l1.1-1.5-1.1-1.5C5.7 9.1 4.9 8.6 3.6 8.6H3V6.2h.6c2.2 0 3.5 1 4.8 2.9l.6.8.6-.8c1.3-1.9 2.6-2.9 4.8-2.9H16z"/>'),rep:SVI('<path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/>'),rep1:SVI('<path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/><path d="M11 9.5h1.6V15H11v-3.6l-1 .5V10.5z"/>')};
// ロック画面用のジャケット（data:URLではなくblob:URLで渡す）
const ARTU=new Map();async function artUrl(d){if(ARTU.has(d))return ARTU.get(d);const u=URL.createObjectURL(await (await fetch(d)).blob());if(ARTU.size>20){const[k,v]=ARTU.entries().next().value;URL.revokeObjectURL(v);ARTU.delete(k)}ARTU.set(d,u);return u}
const SPEEDS=[0.5,0.75,1,1.25,1.5,2];

const P={kind:null,q:[],orig:null,i:0,shuf:false,rep:LS.get('md_rep','off'),rate:1,vol:LS.get('md_vol',1),dim:0,zoom:1,px:0,py:0,el:null,els:[],ci:0,key:null,urls:new Map(),locked:false,ng:1,played:0,counted:false,lastT:0,posT:0,qSig:'',loading:0,
 box(){return this.kind==='video'?$('pv'):$('pm')},
 unlock(k){const L=k==='video'?this.els:[$('au')];for(const el of L){if(el._ok)continue;el._ok=1;if(!el.src){el.src=SILENT;const p=el.play();if(p)p.then(()=>{if(el.src===SILENT)el.pause()}).catch(()=>{})}}if(useWA(k)){AU.ensure();for(const el of L)AU.attach(el)}},
 play(kind,keys,idx,shuf){if(!keys||!keys.length)return;if(this.kind&&this.kind!==kind)this.stop();this.kind=kind;this.unlock(kind);this.orig=keys.slice();this.q=keys.slice();this.i=Math.max(0,Math.min(idx||0,keys.length-1));this.shuf=!!shuf;
  if(shuf){shuffle(this.q);if(idx!=null&&!shuf){} }
  this.open();this.load()},
 open(){const b=this.box();b.classList.add('open');document.body.classList.add('noscroll');$('mini').hidden=true;if(this.kind==='video')this.showCtl()},
 minimize(){if(this.kind==='video'){this.stop();return}$('pm').classList.remove('open');document.body.classList.remove('noscroll');this.mini()},
 stop(){const el=this.el;if(el){this.savePos();try{el.pause()}catch(e){}}for(const e of[...this.els,$('au')]){try{e.pause();e.removeAttribute('src');e.load();e.dataset.k=''}catch(x){}e._ok=e._ok}for(const u of this.urls.values())URL.revokeObjectURL(u);this.urls.clear();
  WL.off();$('pv').classList.remove('open','fs');$('pm').classList.remove('open');document.body.classList.remove('noscroll');if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
  if(this.kind)syncSoon(this.kind,1000);this.kind=null;this.key=null;this.el=null;this.mini();clearInterval(this.measT)},
 cur(){return this.q[this.i]},
 entry(key){return libMap(this.kind).get(key)||{key,path:keyPath(key)}},
 async url(key){if(this.urls.has(key))return this.urls.get(key);const b=await blobOf(this.kind,key);if(!b)throw new Error('ファイルが見つからない');const u=URL.createObjectURL(b);this.urls.set(key,u);return u},
 gc(){const keep=new Set([this.cur(),this.nextKey()]);for(const[k,u]of this.urls)if(!keep.has(k)){URL.revokeObjectURL(u);this.urls.delete(k)}},
 nextKey(){if(this.rep==='one')return null;if(this.i+1<this.q.length)return this.q[this.i+1];if(this.rep==='all'&&this.q.length>1&&!this.shuf)return this.q[0];return null},
 startAt(){return 0},// 続きから再生はしない（毎回0:00から）
 async load(){const key=this.cur();if(!key)return;const k=this.kind,tok=++this.loading;this.key=key;this.played=0;this.counted=false;this.ui();
  let el;if(k==='video'){const o=this.els[1-this.ci];if(o.dataset.k===key){this.ci=1-this.ci}el=this.els[this.ci];const other=this.els[1-this.ci];try{other.pause()}catch(e){}el.classList.add('on');other.classList.remove('on')}else el=$('au');
  this.el=el;let u;try{u=await this.url(key)}catch(e){this.toast(e.message);return}if(tok!==this.loading)return;
  const fresh=el.dataset.k!==key;if(fresh){el.dataset.k=key;el.src=u;el.preload='auto'}
  clearTimeout(this._wd);this._failK=null;this._na=false;const wdEl=el;const arm=()=>{clearTimeout(this._wd);this._wd=setTimeout(()=>{if(tok===this.loading&&this.el===wdEl&&wdEl.readyState<2&&!wdEl.error&&!this._na)this.fail(wdEl,key,'読み込みが終わらない')},15000)};arm();this._arm=arm;
  setTimeout(()=>{if(tok===this.loading&&wdEl.readyState<2&&!wdEl.error)this.ind('読み込み中…',3000)},1200);
  const go=()=>{if(tok!==this.loading)return;try{const t=this.startAt(key,el);if(fresh||Math.abs(el.currentTime-t)>1)el.currentTime=t}catch(e){}el.playbackRate=this.rate;const p=el.play();if(p)p.catch(err=>{if(err&&err.name==='NotAllowedError'){this._na=true;clearTimeout(this._wd);this.ui()}})};
  go();
  this.gain();this.ms();setF(k,key,'last',Date.now());this.ui();setTimeout(()=>{if(tok===this.loading){this.preload();this.gc()}},1500);
  if(k==='music'&&!isIOS&&it(k,key).g==null&&LS.get('md_norm',true)){blobOf(k,key).then(loudOf).then(g=>{if(g){setF(k,key,'g',g,1);syncSoon(k,8000);if(this.key===key)this.gain()}})}
  this.measure()},
 async preload(){if(this.kind!=='video')return;const nk=this.nextKey();if(!nk||nk===this.key)return;const o=this.els[1-this.ci];if(o.dataset.k===nk)return;try{const u=await this.url(nk);if(this.nextKey()!==nk)return;o.dataset.k=nk;o.src=u;o.preload='auto';o.addEventListener('loadedmetadata',()=>{try{o.currentTime=this.startAt(nk,o)}catch(e){}},{once:true});o.load()}catch(e){}},
 gain(){const el=this.el;if(!el)return;const d=it(this.kind,this.key);this.ng=LS.get('md_norm',true)&&d.g?d.g:1;
  if(useWA(this.kind)){const n=AU.attach(el);if(n){n.g.gain.setTargetAtTime(this.vol*this.ng,AU.ctx.currentTime,.08);el.volume=1;return}}try{el.volume=Math.max(0,Math.min(1,this.vol*Math.min(1,this.ng)))}catch(e){}},
 measure(){clearInterval(this.measT);if(this.kind!=='video'||!LS.get('md_norm',true))return;const key=this.key;if(it('video',key).g!=null)return;const n=AU.n.get(this.el);if(!n)return;const buf=new Float32Array(n.a.fftSize);let s=0,c=0;
  this.measT=setInterval(()=>{if(this.key!==key||!this.el){clearInterval(this.measT);return}if(this.el.paused)return;n.a.getFloatTimeDomainData(buf);let q=0;for(let i=0;i<buf.length;i++)q+=buf[i]*buf[i];q/=buf.length;if(q>1e-6){s+=q;c++}
   if(c>=40){clearInterval(this.measT);const g=gainFor(Math.sqrt(s/c));setF('video',key,'g',g,1);syncSoon('video',8000);this.gain()}},500)},
 savePos(){},
 onTime(el){if(el!==this.el)return;const t=el.currentTime,d=it(this.kind,this.key);const n=performance.now();if(!el.paused){const dt=(n-(this.lastT||n))/1000;if(dt>0&&dt<2)this.played+=dt*el.playbackRate}this.lastT=n;
  if(!this.counted&&this.played>=Math.min(30,(el.duration||60)*.5)){this.counted=true;setF(this.kind,this.key,'plays',(d.plays||0)+1);setF(this.kind,this.key,'last',Date.now());syncSoon(this.kind,10000)}
  if(n-this.posT>5000){this.posT=n;this.savePos()}this.tick()},
 onEnd(){const k=this.kind,key=this.key;if(!k)return;if(!this.counted){this.counted=true;setF(k,key,'plays',(it(k,key).plays||0)+1)}
  if(this.rep==='one'){try{this.el.currentTime=0}catch(e){}this.el.play().catch(()=>{});return}this.next(true)},
 next(auto){if(auto&&!LS.get('md_auto',true)){this.el.pause();return}if(this.i+1<this.q.length)this.i++;else if(this.rep==='all'){if(this.shuf){const c=this.cur();shuffle(this.q);if(this.q[0]===c&&this.q.length>1)this.q.push(this.q.shift())}this.i=0}else{if(auto){this.el.pause();this.ui()}return}this.load()},
 prev(){const el=this.el,rs=0;if(el&&el.currentTime-rs>3||this.i===0){try{el.currentTime=rs}catch(e){}return}this.i--;this.load()},
 toggle(){const el=this.el;if(!el)return;if(this.key&&(el.error||(el.paused&&el.readyState===0))){if(el.error)el.dataset.k='';this._failK=null;this.load();return}if(el.paused){if(this._arm&&el.readyState<2){this._na=false;this._arm()}AU.ensure();el.play().catch(()=>{})}else el.pause()},
 // 再生できない時：実際に中身を調べて理由を出し、再送・削除を選べるようにする
 async fail(el,key,base){if(this._failK===key)return;this._failK=key;clearTimeout(this._wd);const k=this.kind,e=this.entry(key),f=DEV[k].get(key);let why='',cods='';
  try{const b=await blobOf(k,key);if(!b)why='ファイルが見つからない';else if(MP4X.includes(extOf(e.path))){const o=await mp4Probe(b,f?f.size:0);why=probeWhy(o,k);if(o.codecs.length)cods=o.codecs.map(codecName).join('・')}else if(f&&b.size<f.size)why='未完了の受信（'+fmtB(b.size)+' / '+fmtB(f.size)+'）'}catch(x){}
  why=why||(base+(cods?'（'+cods+'）':''));const B=LS.get('md_bad',{});B[k+'|'+key]=why;LS.set('md_bad',B);if(typeof softRender==='function')softRender();
  if(this.key!==key||this.el!==el)return;try{el.pause()}catch(x){}this.ui();const dev=f&&DEV[k].has(key);
  sheet(`<h3>再生できない</h3><div class="red">${esc(why)}</div>${/非対応|デコード/.test(why)?'<p>PCの送る画面で「再生不可はmp4に変換して送る」をONにして送り直すと見られるよ</p>':/未完了|壊れ/.test(why)?'<p>送り直すと直るよ</p>':/終わらない/.test(why)?'<p>もう一度で直らなければ、送り直すかPCでmp4に変換して送ってね</p>':''}<div class="pbar">${dev?`<button data-pfre="${esc(key)}">再送</button><button class="sub dng" data-pfdel="${esc(key)}">削除</button>`:''}</div><div class="pbar"><button class="sub" data-pfretry="1">もう一度</button><button class="sub" data-pfnext="1">次へ</button></div><button class="sub" data-close="1">閉じる</button>`)},
 seekBy(s){const el=this.el;if(!el)return;try{el.currentTime=Math.max(0,Math.min((el.duration||1e9)-.1,el.currentTime+s))}catch(e){}this.ind((s>0?'+':'−')+Math.abs(s)+'秒')},
 frame(d){const el=this.el;if(!el)return;el.pause();try{el.currentTime=Math.max(0,el.currentTime+d/30)}catch(e){}},
 speed(){const i=SPEEDS.indexOf(this.rate);this.rate=SPEEDS[(i+1)%SPEEDS.length];if(this.el)this.el.playbackRate=this.rate;this.ind(this.rate+'x');this.ui()},
 setShuf(){const c=this.cur();this.shuf=!this.shuf;if(this.shuf){const o=this.q.filter((x,j)=>j!==this.i);shuffle(o);this.q=[c,...o];this.i=0}else{this.q=this.orig.slice();this.i=Math.max(0,this.q.indexOf(c))}this.ui();this.preload()},
 setRep(){this.rep={off:'all',all:'one',one:'off'}[this.rep];LS.set('md_rep',this.rep);this.ui();this.preload()},
 async snap(){const el=this.el;if(!el||this.kind!=='video')return;const t=toThumb(el,320,180);if(t){await TH.set('video|'+this.key,t);this.ind('サムネ変更')}},
 fs(){const b=$('pv');const on=!b.classList.contains('fs');b.classList.toggle('fs',on);if(on){const f=b.requestFullscreen||b.webkitRequestFullscreen;if(f&&!isIOS)try{f.call(b).catch&&f.call(b).catch(()=>{})}catch(e){}try{screen.orientation.lock('landscape').catch(()=>{})}catch(e){}}else{if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});try{screen.orientation.unlock()}catch(e){}}this.showCtl()},
 setZoom(z,ox,oy){this.zoom=Math.max(1,Math.min(4,z));if(this.zoom===1){this.px=this.py=0}const st=$('stage'),w=st.clientWidth,h=st.clientHeight,mx=(this.zoom-1)*w/2,my=(this.zoom-1)*h/2;this.px=Math.max(-mx,Math.min(mx,this.px));this.py=Math.max(-my,Math.min(my,this.py));for(const v of this.els)v.style.transform=this.zoom===1?'':`translate(${this.px}px,${this.py}px) scale(${this.zoom})`;$('pv').classList.toggle('zoomed',this.zoom>1)},
 setVol(v){this.vol=Math.max(0,Math.min(1,v));LS.set('md_vol',this.vol);this.gain();this.ind('音量 '+Math.round(this.vol*100))},
 setDim(v){this.dim=Math.max(0,Math.min(.85,v));for(const d of document.querySelectorAll('.dimx'))d.style.opacity=this.dim;this.ind('明るさ '+Math.round((1-this.dim)*100))},
 indId(){return this.kind==='music'?(isLand()?'mind':'pm_ind'):'ind'},
 indOff(){clearTimeout(this._it);for(const id of['ind','mind','pm_ind']){const e=$(id);if(e)e.classList.remove('show')}},
 ind(t,ms){const e=$(this.indId());if(!e)return;e.textContent=t;e.classList.add('show');clearTimeout(this._it);this._it=setTimeout(()=>e.classList.remove('show'),ms||700)},
 toast(t,ms){this.ind(t,ms||2000)},
 showCtl(){const b=this.box();b.classList.remove('hid');clearTimeout(this._ct);this._ct=setTimeout(()=>{if(this.el&&!this.el.paused&&this.box()===b&&(this.kind==='video'||isLand()))b.classList.add('hid')},3000)},
 lock(on){this.locked=on;for(const b of[$('pv'),$('pm')])b.classList.toggle('locked',on&&b===this.box());if(!on)this.showCtl()},
 ms(){if(!('mediaSession'in navigator)||!this.key)return;const e=this.entry(this.key);TH.get(this.kind+'|'+this.key).then(async th=>{if(!th&&this.kind==='music')th=letterArt(titleOf(this.kind,e));if(th&&th.startsWith('data:'))th=await artUrl(th);try{navigator.mediaSession.metadata=new MediaMetadata({title:titleOf(this.kind,e),artist:artistOf(this.kind,e),album:NAME[this.kind],artwork:th?[{src:th,sizes:this.kind==='music'?'300x300':'320x180',type:'image/jpeg'}]:[{src:new URL('icon-512.png',location.href).href,sizes:'512x512',type:'image/png'}]})}catch(x){}});
  if(!this._msOk){this._msOk=1;const S=(a,f)=>{try{navigator.mediaSession.setActionHandler(a,f)}catch(x){}};S('play',()=>{this.el&&this.el.play()});S('pause',()=>{this.el&&this.el.pause()});S('previoustrack',()=>this.prev());S('nexttrack',()=>this.next());S('seekbackward',()=>this.seekBy(-10));S('seekforward',()=>this.seekBy(10));S('seekto',d=>{if(this.el&&d.seekTime!=null)this.el.currentTime=d.seekTime})}},
 msPos(){const el=this.el;if(!el||!('mediaSession'in navigator)||!navigator.mediaSession.setPositionState)return;try{if(isFinite(el.duration)&&el.duration>0)navigator.mediaSession.setPositionState({duration:el.duration,playbackRate:el.playbackRate||1,position:Math.min(el.currentTime,el.duration)})}catch(e){}},
 tick(){const el=this.el;if(!el)return;const b=this.box(),d=el.duration||it(this.kind,this.key).dur||0;for(const s of b.querySelectorAll('[data-pc=seek]'))if(!s._drag)s.value=d?Math.round(el.currentTime/d*1000):0;for(const s of b.querySelectorAll('.p_cur'))s.textContent=fmtT(el.currentTime);for(const s of b.querySelectorAll('.p_dur'))s.textContent=fmtT(d);
  if(this.kind==='music'){const m=$('mini_bar');if(m)m.style.width=(d?el.currentTime/d*100:0)+'%'}const n=performance.now();if(n-(this._mp||0)>3000){this._mp=n;this.msPos()}},
 ui(){if(!this.kind||!this.key)return;const k=this.kind,b=this.box(),e=this.entry(this.key),d=it(k,this.key),pl=this.el&&!this.el.paused;
  for(const x of b.querySelectorAll('.p_t'))x.textContent=titleOf(k,e);for(const x of b.querySelectorAll('.p_a'))x.textContent=artistOf(k,e);
  const set=(c,t,on)=>{for(const x of b.querySelectorAll('[data-pc='+c+']')){if(t!=null)x.textContent=t;x.classList.toggle('on',!!on)}};
  set('pp',pl?'❚❚':'▶');set('shuf',null,this.shuf);for(const x of b.querySelectorAll('[data-pc=rep]')){x.innerHTML=this.rep==='one'?SV.rep1:SV.rep;x.classList.toggle('on',this.rep!=='off')};set('spd',this.rate+'x',this.rate!==1);set('fav',isFav(k,this.key)?'★':'☆',isFav(k,this.key));
  if(k==='music'){const ti=titleOf(k,e);TH.get('music|'+this.key).then(th=>{$('pm_art').src=$('pm_art2').src=th||letterArt(ti)})}
  const sig=k+this.q.join('\n')+'#'+this.i;if(sig!==this.qSig){this.qSig=sig;const m=libMap(k);const qq=b.querySelector('.p_q');if(qq){qq.innerHTML=this.q.map((x,j)=>{const en=m.get(x)||{key:x,path:keyPath(x)};return`<div class="it${j===this.i?' now':''}" data-qi="${j}"><div class="th ${k}"><img data-tk="${esc(k+'|'+x)}" alt=""${k==='music'?` src="${letterArt(titleOf(k,en))}"`:''}></div><div class="tx"><b>${esc(titleOf(k,en))}</b><span>${esc(artistOf(k,en))}</span></div></div>`}).join('');for(const img of qq.querySelectorAll('img[data-tk]'))TH.io&&TH.io.observe(img);const nw=qq.querySelector('.now');if(nw)nw.scrollIntoView({block:'nearest'})}}
  this.tick();this.mini()},
 vmini(){const b=$('pv');const show=this.kind==='video'&&!!this.key&&b.classList.contains('open')&&!!this._vout&&!isLand()&&!b.classList.contains('fs');b.classList.toggle('vm',show);if(show&&this._vmk!==this.key){this._vmk=this.key;TH.get('video|'+this.key).then(th=>{$('vmini_img').src=th||'icon.png?v=1'})}},
 mini(){this.vmini();const m=$('mini');const show=this.kind==='music'&&this.key&&!$('pm').classList.contains('open')&&MODE==='music';m.hidden=!show;document.body.classList.toggle('hasmini',!!show);if(!show)return;const e=this.entry(this.key);$('mini_t').textContent=titleOf('music',e);$('mini_a').textContent=artistOf('music',e);$('mini_pp').textContent=this.el&&!this.el.paused?'❚❚':'▶';TH.get('music|'+this.key).then(th=>{$('mini_img').src=th||letterArt(titleOf('music',e))})}
};
// ===== 再生画面の部品 =====
const ctlHTML=(k,ns)=>(ns?'':`<div class="seekw"><span class="p_cur">0:00</span><div class="sk"><input type="range" min="0" max="1000" value="0" data-pc="seek"></div><span class="p_dur">0:00</span></div>`)+`
<div class="pbtn main"><button data-pc="shuf">${SV.shuf}</button><button data-pc="prev">${SV.prev}</button><button data-pc="rw">−10</button><button data-pc="pp" class="pp">▶</button><button data-pc="ff">+10</button><button data-pc="next">${SV.next}</button><button data-pc="rep">${SV.rep}</button></div>
<div class="pbtn"><button data-pc="spd">1x</button>${k==='video'?'<button data-pc="fb">◀|</button><button data-pc="fn">|▶</button><button data-pc="snap">サムネ</button>':''}<button data-pc="fav">☆</button><button data-pc="addpl">＋</button><button data-pc="menu">⋯</button></div>`;
const isLand=()=>matchMedia('(orientation:landscape) and (max-height:500px)').matches;
// 画面のジェスチャー：ダブルタップ±10秒・上下スワイプで明るさ/音量・長押し右で2倍速・左で巻き戻し・ピンチ拡大（動画のみ）
function bindStage(st,box,zoomable){let T=null,pin=null,lastTap=null,tapT=null,H=null,noClick=false;
 const onCtl=e=>!!e.target.closest('.ctlx button,.ctlx input,.lockx');
 const side=x=>{const r=st.getBoundingClientRect(),f=(x-r.left)/r.width;return f<1/3?-1:f>2/3?1:0};
 const holdStart=x=>{const el=P.el;if(!el||P.locked||P.box()!==box)return false;const r=st.getBoundingClientRect(),right=x-r.left>r.width/2;H={right,el,wasPaused:el.paused};
  if(right){el.playbackRate=2;if(el.paused)el.play().catch(()=>{});P.ind('2x ▶▶',600000)}
  else{try{el.pause()}catch(e){}const stp=()=>{try{el.currentTime=Math.max(0,el.currentTime-1)}catch(e){}P.tick()};stp();H.iv=setInterval(stp,200);P.ind('◀◀ 巻き戻し',600000)}return true};
 const holdEnd=()=>{if(!H)return false;const h=H;H=null;clearInterval(h.iv);if(h.right){h.el.playbackRate=P.rate;if(h.wasPaused)h.el.pause()}else if(!h.wasPaused)h.el.play().catch(()=>{});P.indOff();return true};
 const armHold=(x)=>{const tt=setTimeout(()=>{if(T&&!T.m&&holdStart(x))T.m='hold'},450);return tt};
 st.addEventListener('touchstart',e=>{if(P.locked||onCtl(e))return;if(e.touches.length===2){if(H)holdEnd();if(T)clearTimeout(T.ht);T=null;if(zoomable){const[a,b]=e.touches;pin={d:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),z:P.zoom}}}else if(e.touches.length===1){const t=e.touches[0];T={x:t.clientX,y:t.clientY,t:Date.now(),m:null,dim:P.dim,vol:P.vol,px:P.px,py:P.py};T.ht=armHold(t.clientX)}},{passive:true});
 st.addEventListener('touchmove',e=>{if(P.locked)return;if(pin&&e.touches.length===2){const[a,b]=e.touches;P.setZoom(pin.z*Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)/pin.d);e.preventDefault();return}if(!T||e.touches.length!==1)return;if(T.m==='hold'){e.preventDefault();return}const t=e.touches[0],dx=t.clientX-T.x,dy=t.clientY-T.y,h=st.clientHeight;
  if(!T.m){if(Math.hypot(dx,dy)<12)return;clearTimeout(T.ht);if(zoomable&&P.zoom>1)T.m='pan';else if(Math.abs(dy)>Math.abs(dx)){const r=st.getBoundingClientRect();T.m=T.x-r.left<r.width/2?'dim':'vol'}else T.m='x'}
  if(T.m==='pan'){P.px=T.px+dx;P.py=T.py+dy;P.setZoom(P.zoom)}else if(T.m==='dim')P.setDim(T.dim+dy/(h*.9));else if(T.m==='vol')P.setVol(T.vol-dy/(h*.9));if(T.m!=='x')e.preventDefault()},{passive:false});
 const tend=e=>{if(T)clearTimeout(T.ht);if(holdEnd()){T=null;if(e.cancelable)e.preventDefault();return}if(P.locked||onCtl(e))return;if(pin){if(e.touches.length<2)pin=null;return}if(!T)return;const t0=T;T=null;if(t0.m||Date.now()-t0.t>350)return;if(e.cancelable)e.preventDefault();tap(t0.x)};
 st.addEventListener('touchend',tend);st.addEventListener('touchcancel',e=>{if(T)clearTimeout(T.ht);T=null;holdEnd()});
 st.addEventListener('contextmenu',e=>e.preventDefault());
 function tap(x){const s=side(x),n=Date.now();if(lastTap&&n-lastTap.t<300&&s!==0&&s===lastTap.s){clearTimeout(tapT);P.seekBy(10*s);lastTap={t:n,s};return}lastTap={t:n,s};clearTimeout(tapT);tapT=setTimeout(()=>{if(box.classList.contains('hid'))P.showCtl();else box.classList.add('hid')},280)}
 // マウス（PC）
 let mT=null;const fine=()=>!matchMedia('(pointer:coarse)').matches;
 st.addEventListener('mousedown',e=>{if(e.button!==0||!fine()||P.locked||onCtl(e))return;const x=e.clientX;mT=setTimeout(()=>{mT=null;if(holdStart(x))noClick=true},450)});
 addEventListener('mouseup',()=>{clearTimeout(mT);mT=null;holdEnd()});
 st.addEventListener('click',e=>{if(noClick){noClick=false;return}if(onCtl(e))return;if(!fine())return;tap(e.clientX)})}
function buildPlayers(){
 $('pv').innerHTML=`<div class="phd"><button data-pc="close" class="bk">${BACK}</button></div><div class="pvl"><div id="stage" class="stg"><video id="v0" playsinline webkit-playsinline preload="auto" class="on"></video><video id="v1" playsinline webkit-playsinline preload="auto"></video><div id="dim" class="dimx"></div><div id="ind" class="indx"></div>
 <div id="ctl" class="ctlx"><div class="ct"><button data-pc="close">⌄</button><b class="p_t"></b><button data-pc="lock">🔒</button></div><div class="cm"><button data-pc="prev">${SV.prev}</button><button data-pc="rw">−10</button><button data-pc="pp" class="pp">▶</button><button data-pc="ff">+10</button><button data-pc="next">${SV.next}</button></div>
 <div class="cb"><span class="p_cur">0:00</span><div class="sk"><input type="range" min="0" max="1000" value="0" data-pc="seek"></div><span class="p_dur">0:00</span><button data-pc="zoom1" class="zr">1x</button><button data-pc="fs">⛶</button></div></div>
 <div id="lock" class="lockx"><button id="unlock" class="unl">🔓</button></div></div>
 <div class="pinfo"><h3 class="p_t"></h3><div class="p_a"></div>${ctlHTML('video',1)}</div></div><div class="p_q list"></div>
 <div id="vmini" class="mbar" data-pc="totop"><img id="vmini_img" alt=""><div class="mt"><b class="p_t"></b><span class="p_a"></span></div><button data-pc="prev">${SV.prev}</button><button data-pc="pp" class="mpp">▶</button><button data-pc="next">${SV.next}</button></div>`;
 $('pm').innerHTML=`<div id="mstage" class="stg mst"><img id="pm_art2" class="mart" alt=""><div id="mdim" class="dimx"></div><div id="mind" class="indx"></div>
 <div id="mctl" class="ctlx"><div class="ct"><button data-pc="close">⌄</button><b class="p_t"></b><button data-pc="lock">🔒</button></div><div class="cm"><button data-pc="prev">${SV.prev}</button><button data-pc="rw">−10</button><button data-pc="pp" class="pp">▶</button><button data-pc="ff">+10</button><button data-pc="next">${SV.next}</button></div>
 <div class="cb"><span class="p_cur">0:00</span><div class="sk"><input type="range" min="0" max="1000" value="0" data-pc="seek"></div><span class="p_dur">0:00</span></div></div>
 <div id="mlock" class="lockx"><button class="unl">🔓</button></div></div><div class="phd"><button data-pc="close" class="bk">${BACK}</button><button data-pc="menu">⋯</button></div><div class="pmw"><div class="art"><img id="pm_art" alt=""><div id="pm_ind" class="indm"></div></div><h3 class="p_t"></h3><div class="p_a"></div>${ctlHTML('music')}</div><div class="p_q list"></div>`;
 P.els=[$('v0'),$('v1')];
 for(const el of[...P.els,$('au')]){el.addEventListener('timeupdate',()=>P.onTime(el));el.addEventListener('ended',()=>{if(el===P.el)P.onEnd()});
  el.addEventListener('play',()=>{if(el!==P.el)return;if(P.kind==='video')WL.on();P.showCtl();P.lastT=performance.now();P.ui();try{navigator.mediaSession.playbackState='playing'}catch(e){}});
  el.addEventListener('pause',()=>{if(el!==P.el)return;if(P.kind==='video')WL.off();P.box().classList.remove('hid');P.savePos();syncSoon(P.kind,3000);P.ui();try{navigator.mediaSession.playbackState='paused'}catch(e){}});
  el.addEventListener('error',()=>{if(el!==P.el||!el.src||el.src===SILENT||!P.key)return;const c=el.error&&el.error.code;P.fail(el,P.key,({1:'読み込みが中断された',2:'読み込みに失敗',3:'壊れたファイル（デコードできない）',4:'非対応の形式'}[c]||'再生できない'))});
  el.addEventListener('playing',()=>{if(el!==P.el||!P.key)return;clearTimeout(P._wd);const id=P.kind+'|'+P.key,B=LS.get('md_bad',{});if(B[id]){delete B[id];LS.set('md_bad',B);if(typeof softRender==='function')softRender()}});
  el.addEventListener('loadedmetadata',()=>{if(el!==P.el)return;const k=P.kind,key=P.key;if(k&&key&&isFinite(el.duration)&&it(k,key).dur==null)setF(k,key,'dur',el.duration,1);P.tick()})}
 for(const box of[$('pv'),$('pm')]){
  box.addEventListener('click',e=>{const b=e.target.closest('[data-pc],[data-qi]');if(!b)return;if(b.dataset.qi!=null){P.i=+b.dataset.qi;P.load();return}const c=b.dataset.pc;e.stopPropagation();P.showCtl();
   ({close:()=>P.minimize(),pp:()=>P.toggle(),prev:()=>P.prev(),next:()=>P.next(),rw:()=>P.seekBy(-10),ff:()=>P.seekBy(10),shuf:()=>P.setShuf(),rep:()=>P.setRep(),spd:()=>P.speed(),fb:()=>P.frame(-1),fn:()=>P.frame(1),snap:()=>P.snap(),fs:()=>P.fs(),zoom1:()=>P.setZoom(1),lock:()=>P.lock(true),
    fav:()=>{setFav(P.kind,[P.key],!isFav(P.kind,P.key));P.ui();render()},totop:()=>$('pv').scrollTo({top:0,behavior:'smooth'}),addpl:()=>addPlMenu(P.key),menu:()=>itemMenu(P.key)}[c]||(()=>{}))()});
  box.addEventListener('input',e=>{const s=e.target;if(s.dataset.pc!=='seek'||!P.el)return;s._drag=true;const d=P.el.duration||0;if(d)P.el.currentTime=s.value/1000*d;clearTimeout(s._t);s._t=setTimeout(()=>s._drag=false,300)})}
 // --- ジェスチャー（動画と、横向きの音楽） ---
 bindStage($('stage'),$('pv'),true);
 try{const io=new IntersectionObserver(es=>{for(const r of es)P._vout=!r.isIntersecting||r.intersectionRatio<.25;P.vmini()},{root:$('pv'),threshold:[0,.25,.5,1]});io.observe($('stage'))}catch(e){}
 // 音楽：ジャケットを下に引っ張ると閉じる
 {const art=document.querySelector('#pm .art');let y0=null,dy=0;art.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;y0=e.touches[0].clientY;dy=0;art.style.transition='none'},{passive:true});
  art.addEventListener('touchmove',e=>{if(y0==null)return;dy=Math.max(0,e.touches[0].clientY-y0);art.style.transform=`translateY(${dy}px)`;if(dy>4)e.preventDefault()},{passive:false});
  art.addEventListener('touchend',()=>{if(y0==null)return;y0=null;art.style.transition='transform .2s';art.style.transform='';if(dy>90)P.minimize()});art.addEventListener('touchcancel',()=>{y0=null;art.style.transform=''})}bindStage($('mstage'),$('pm'),false);
 try{matchMedia('(orientation:landscape) and (max-height:500px)').addEventListener('change',()=>{if(P.kind==='music'){if(!isLand()&&P.locked)P.lock(false);$('pm').classList.remove('hid');if(isLand())P.showCtl()}})}catch(e){}
 for(const lk of document.querySelectorAll('.lockx'))lk.addEventListener('click',e=>{e.stopPropagation();const u=lk.querySelector('.unl');if(e.target===u){P.lock(false);return}u.classList.add('show');clearTimeout(u._t);u._t=setTimeout(()=>u.classList.remove('show'),2000)});
 $('mini').addEventListener('click',e=>{const b=e.target.closest('button');if(b&&b.id==='mini_pp'){P.toggle();return}if(b&&b.id==='mini_nx'){P.next();return}if(b&&b.id==='mini_pv'){P.prev();return}P.open();P.ui()});
 document.addEventListener('keydown',e=>{if(!P.kind||e.target.matches('input,textarea,select'))return;const k=e.key;if(k===' '){e.preventDefault();P.toggle()}else if(k==='ArrowLeft')P.seekBy(-10);else if(k==='ArrowRight')P.seekBy(10);else if(k==='ArrowUp'){e.preventDefault();P.setVol(P.vol+.05)}else if(k==='ArrowDown'){e.preventDefault();P.setVol(P.vol-.05)}else if(k==='f'&&P.kind==='video')P.fs();else if(k===',')P.frame(-1);else if(k==='.')P.frame(1);else if(k==='Escape'&&$('pv').classList.contains('fs'))P.fs()});
 document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)$('pv').classList.remove('fs')});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){if(P.kind==='video'&&P.el&&!P.el.paused)P.el.pause();P.savePos()}});
 addEventListener('pagehide',()=>P.savePos());
}
