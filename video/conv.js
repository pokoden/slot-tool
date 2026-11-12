'use strict';
// ===== 再生不可ファイルの判定とmp4変換（ffmpeg.wasm、PCのブラウザ内で変換・無料） =====
// iPhoneで再生できない拡張子（iPhone向けの判定。PCでの再生はそのPCのブラウザで判定）
const IOS_BAD={video:['amv','avi','wmv','mkv','flv','rm','rmvb','asf','vob','mpg','mpeg','divx','ts','3g2','ogv','webm'],music:['wma','ape','ra','ogg','oga','opus','mka','ac3','dts','amr']};
const LOCAL_BAD=['amv','wmv','flv','rm','rmvb','asf','vob','divx','wma','ape','ra','ac3','dts','amr'];
// その端末で再生できるか（できないなら理由を返す）
function badHere(k,e){if(e.conv)return'';const ext=extOf(e.path);if(LOCAL_BAD.includes(ext))return'.'+ext+'は再生できない形式';const t=document.createElement(k==='video'?'video':'audio');const mime=e.mime&&e.mime!=='application/octet-stream'?e.mime:mimeOf(e.path);if(isIOS&&IOS_BAD[k].includes(ext))return'.'+ext+'はiPhoneで再生できない形式';if(mime&&!/octet/.test(mime)&&t.canPlayType(mime)==='')return'.'+ext+'はこの端末で再生できない形式';return''}
// iPhoneで再生できるか（PCの送る画面用）
const badIOS=(k,name)=>IOS_BAD[k].includes(extOf(name))?'.'+extOf(name)+'はiPhoneで再生できない':'';
const CONV_MAX=1.2e9;
const CONV={ff:null,p:null,
 load(){if(this.ff)return Promise.resolve(this.ff);return this.p||(this.p=(async()=>{await new Promise((res,rej)=>{const s=document.createElement('script');s.src='lib/ffmpeg/ffmpeg.js?v='+APPV;s.onload=res;s.onerror=()=>rej(new Error('変換ツールを読み込めない'));document.head.appendChild(s)});
  const ff=new FFmpegWASM.FFmpeg();const base=new URL('lib/ffmpeg/',location.href).href;await ff.load({coreURL:base+'ffmpeg-core.js',wasmURL:base+'ffmpeg-core.wasm'});this.ff=ff;return ff})().catch(e=>{this.p=null;throw e}))},
 async run(k,file,name,onProg){if(file.size>CONV_MAX)throw new Error('大きすぎて変換できない（'+fmtB(file.size)+'、上限'+fmtB(CONV_MAX)+'）');const ff=await this.load();
  const ie='in.'+(extOf(name)||'bin'),oe=k==='video'?'out.mp4':'out.m4a';await ff.writeFile(ie,new Uint8Array(await file.arrayBuffer()));
  const logs=[],pr=({progress})=>{if(onProg&&isFinite(progress))onProg(Math.max(0,Math.min(1,progress)))},lg=({message})=>{logs.push(message);if(logs.length>20)logs.shift()};ff.on('progress',pr);ff.on('log',lg);
  const args=k==='video'?['-i',ie,'-map','0:v:0','-map','0:a:0?','-c:v','libx264','-preset','veryfast','-crf','22','-pix_fmt','yuv420p','-vf','scale=trunc(iw/2)*2:trunc(ih/2)*2','-c:a','aac','-b:a','160k','-ac','2','-movflags','+faststart',oe]:['-i',ie,'-vn','-c:a','aac','-b:a','256k',oe];
  try{const rc=await ff.exec(args);if(rc!==0)throw new Error('変換失敗（'+(logs.filter(x=>/error|invalid/i.test(x)).slice(-1)[0]||'ffmpeg '+rc)+'）');const d=await ff.readFile(oe);return new Blob([d],{type:k==='video'?'video/mp4':'audio/mp4'})}
  finally{ff.off('progress',pr);ff.off('log',lg);try{await ff.deleteFile(ie)}catch(e){}try{await ff.deleteFile(oe)}catch(e){}}}};
