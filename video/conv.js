'use strict';
// ===== 再生不可ファイルの判定とmp4変換（ffmpeg.wasm、PCのブラウザ内で変換・無料） =====
// iPhoneで再生できない拡張子（iPhone向けの判定。PCでの再生はそのPCのブラウザで判定）
const IOS_BAD={video:['amv','avi','wmv','mkv','flv','rm','rmvb','asf','vob','mpg','mpeg','divx','ts','3g2','ogv','webm'],music:['wma','ape','ra','ogg','oga','opus','mka','ac3','dts','amr']};
const LOCAL_BAD=['amv','wmv','flv','rm','rmvb','asf','vob','divx','wma','ape','ra','ac3','dts','amr'];
// その端末で再生できるか（できないなら理由を返す）
function badHere(k,e){if(e.conv)return'';const ext=extOf(e.path);if(LOCAL_BAD.includes(ext))return'.'+ext+'は再生できない形式';const t=document.createElement(k==='video'?'video':'audio');const mime=e.mime&&e.mime!=='application/octet-stream'?e.mime:mimeOf(e.path);if(isIOS&&IOS_BAD[k].includes(ext))return'.'+ext+'はiPhoneで再生できない形式';if(mime&&!/octet/.test(mime)&&t.canPlayType(mime)==='')return'.'+ext+'はこの端末で再生できない形式';return''}
// ===== mp4の中身を調べる（コーデック・受信途中・目次の位置） =====
const MP4X=['mp4','m4v','mov','m4a','3gp','m4b'];
const CODEC={avc1:['H.264','avc1.640028'],avc3:['H.264','avc3.640028'],hvc1:['HEVC','hvc1.1.6.L120.90'],hev1:['HEVC(hev1)','hev1.1.6.L120.90'],av01:['AV1','av01.0.08M.08'],vp09:['VP9','vp09.00.40.08'],vp08:['VP8','vp8'],mp4v:['MPEG-4','mp4v.20.9'],mp4a:['AAC','mp4a.40.2'],Opus:['Opus','opus'],'ac-3':['AC-3','ac-3'],'ec-3':['E-AC-3','ec-3'],fLaC:['FLAC','flac'],'.mp3':['MP3','mp3'],alac:['ALAC','alac']};
const codecName=f=>(CODEC[f]||[f])[0];
async function mp4Probe(b,exp){const o={size:b.size,exp:exp||0,codecs:[],moov:-1,mdat:-1,inc:!!(exp&&b.size<exp),broken:false};
 try{const N=b.size;let off=0,n=0;while(off+8<=N&&n++<200){const h=new DataView(await b.slice(off,Math.min(N,off+16)).arrayBuffer());let sz=h.getUint32(0);const ty=String.fromCharCode(h.getUint8(4),h.getUint8(5),h.getUint8(6),h.getUint8(7));
   if(n===1&&!/^(ftyp|wide|free|skip|mdat|moov)$/.test(ty)){o.notmp4=true;break}
   if(sz===1&&h.byteLength>=16)sz=Number(h.getBigUint64(8));else if(sz===0)sz=N-off;if(sz<8){o.broken=true;break}
   if(ty==='moov'){o.moov=off;if(sz<=96<<20&&off+sz<=N){const u=new Uint8Array(await b.slice(off,off+sz).arrayBuffer());for(let i=0;i+20<u.length;i++)if(u[i]===0x73&&u[i+1]===0x74&&u[i+2]===0x73&&u[i+3]===0x64){const f=String.fromCharCode(u[i+16],u[i+17],u[i+18],u[i+19]);if(/^[\x20-\x7e]{4}$/.test(f)&&!o.codecs.includes(f))o.codecs.push(f)}}}
   if(ty==='mdat')o.mdat=off;if(off+sz>N){o.inc=true;break}off+=sz}
  if(!o.notmp4&&!o.inc&&o.moov<0)o.broken=true}catch(e){o.err=String(e.message||e)}
 return o}
// この端末で再生できない理由（実際に調べた結果だけ）
function probeWhy(o,kind){if(!o||o.notmp4)return'';if(o.inc)return'未完了の受信（'+fmtB(o.size)+(o.exp?' / '+fmtB(o.exp):'')+'しか届いていない）';if(o.broken)return'壊れたファイル（動画の目次が無い）';
 const t=document.createElement(kind==='video'?'video':'audio');const ng=o.codecs.filter(f=>CODEC[f]&&f!=='avc1'&&f!=='mp4a'&&t.canPlayType((kind==='video'?'video':'audio')+'/mp4; codecs="'+CODEC[f][1]+'"')==='');
 return ng.length?'非対応の形式（'+ng.map(codecName).join('・')+'）':''}
// iPhone向けに変換した方がいいコーデック（PCの送る画面用）
const IOS_BADC={av01:'AV1',vp09:'VP9',vp08:'VP8',hev1:'HEVC(hev1)'};
const probeIOS=o=>{if(!o||o.notmp4)return'';const b=o.codecs.filter(f=>IOS_BADC[f]);return b.length?b.map(f=>IOS_BADC[f]).join('・')+'はiPhoneで再生できないことが多い':''};
// iPhoneで再生できるか（PCの送る画面用）
const badIOS=(k,name)=>IOS_BAD[k].includes(extOf(name))?'.'+extOf(name)+'はiPhoneで再生できない':'';
const CONV_MAX=1.2e9;
const CONV={ff:null,p:null,
 load(){if(this.ff)return Promise.resolve(this.ff);return this.p||(this.p=(async()=>{await new Promise((res,rej)=>{const s=document.createElement('script');s.src='lib/ffmpeg/ffmpeg.js?v='+APPV;s.onload=res;s.onerror=()=>rej(new Error('変換ツールを読み込めない'));document.head.appendChild(s)});
  const ff=new FFmpegWASM.FFmpeg();const base=new URL('lib/ffmpeg/',location.href).href;await ff.load({coreURL:base+'ffmpeg-core.js',wasmURL:base+'ffmpeg-core.wasm'});this.ff=ff;return ff})().catch(e=>{this.p=null;throw e}))},
 // AV1など ffmpeg.wasm で読めない動画：ブラウザで再生しながらH.264のmp4に録画（等速なので動画の長さぶん時間がかかる）
 async rec(file,onProg){const MT=['video/mp4;codecs=avc1.640028,mp4a.40.2','video/mp4;codecs=avc1.4d002a,mp4a.40.2','video/mp4;codecs=avc1,mp4a.40.2','video/mp4;codecs=avc1,opus','video/mp4'];const mt=window.MediaRecorder&&MT.find(t=>MediaRecorder.isTypeSupported(t));if(!mt)throw new Error('このブラウザではAV1を変換できない（Chromeを使ってね）');
  const v=document.createElement('video');v.playsInline=true;v.style.cssText='position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';document.body.appendChild(v);const u=URL.createObjectURL(file);v.src=u;
  const C=window.AudioContext||window.webkitAudioContext,ac=new C();try{await ac.resume()}catch(e){}
  try{await new Promise((res,rej)=>{v.onloadedmetadata=res;v.onerror=()=>rej(new Error('このPCでも再生できない動画'))});
   const vs=v.captureStream?v.captureStream():v.mozCaptureStream();const src=ac.createMediaElementSource(v),dst=ac.createMediaStreamDestination();src.connect(dst);
   const st=new MediaStream([...vs.getVideoTracks(),...dst.stream.getAudioTracks()]);const h=v.videoHeight||720,br=h>=1000?8e6:h>=700?5e6:2.5e6;
   const mr=new MediaRecorder(st,{mimeType:mt,videoBitsPerSecond:br,audioBitsPerSecond:160000});const parts=[];mr.ondataavailable=e=>{if(e.data&&e.data.size)parts.push(e.data)};
   const done=new Promise(res=>{mr.onstop=res});const pl=new Promise(r=>v.addEventListener('playing',r,{once:true}));await v.play();await pl;mr.start(1000);
   await new Promise((res,rej)=>{v.onended=res;v.onerror=()=>rej(new Error('変換中に再生が止まった'));const t=setInterval(()=>{if(onProg&&v.duration)onProg(Math.min(.97,v.currentTime/v.duration));if(this.abort){clearInterval(t);rej(new Error('中止'))}if(v.ended){clearInterval(t);res()}},500)});
   mr.stop();await done;const rec=new Blob(parts,{type:'video/mp4'});
   // 目次を先頭に・音声をAACに
   const ff=await this.load();await ff.writeFile('rec.mp4',new Uint8Array(await rec.arrayBuffer()));try{const rc=await ff.exec(['-i','rec.mp4','-c:v','copy','-c:a','aac','-b:a','160k','-movflags','+faststart','out.mp4']);if(rc!==0)throw new Error('変換失敗（仕上げ）');const d=await ff.readFile('out.mp4');if(onProg)onProg(1);return new Blob([d],{type:'video/mp4'})}finally{try{await ff.deleteFile('rec.mp4')}catch(e){}try{await ff.deleteFile('out.mp4')}catch(e){}}}
  finally{try{v.pause()}catch(e){}v.remove();URL.revokeObjectURL(u);try{ac.close()}catch(e){}}},
 async run(k,file,name,onProg){if(k==='video'&&MP4X.includes(extOf(name))){const o=await mp4Probe(file);if(o.codecs.includes('av01'))return this.rec(file,onProg)}if(file.size>CONV_MAX)throw new Error('大きすぎて変換できない（'+fmtB(file.size)+'、上限'+fmtB(CONV_MAX)+'）');const ff=await this.load();
  const ie='in.'+(extOf(name)||'bin'),oe=k==='video'?'out.mp4':'out.m4a';await ff.writeFile(ie,new Uint8Array(await file.arrayBuffer()));
  const logs=[],pr=({progress})=>{if(onProg&&isFinite(progress))onProg(Math.max(0,Math.min(1,progress)))},lg=({message})=>{logs.push(message);if(logs.length>20)logs.shift()};ff.on('progress',pr);ff.on('log',lg);
  const args=k==='video'?['-i',ie,'-map','0:v:0','-map','0:a:0?','-c:v','libx264','-preset','veryfast','-crf','22','-pix_fmt','yuv420p','-vf','scale=trunc(iw/2)*2:trunc(ih/2)*2','-c:a','aac','-b:a','160k','-ac','2','-movflags','+faststart',oe]:['-i',ie,'-vn','-c:a','aac','-b:a','256k',oe];
  try{const rc=await ff.exec(args);if(rc!==0)throw new Error('変換失敗（'+(logs.filter(x=>/error|invalid/i.test(x)).slice(-1)[0]||'ffmpeg '+rc)+'）');const d=await ff.readFile(oe);return new Blob([d],{type:k==='video'?'video/mp4':'audio/mp4'})}
  finally{ff.off('progress',pr);ff.off('log',lg);try{await ff.deleteFile(ie)}catch(e){}try{await ff.deleteFile(oe)}catch(e){}}}};
