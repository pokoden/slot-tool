// 音から指紋（Chromaprint）を作る。AcoustIDの照合用
import createChromaprintModule from './chromaprint.js';
let M=null;
export async function fingerprint(ab,maxSec=120){
 M=M||await createChromaprintModule();
 const C=window.OfflineAudioContext||window.webkitOfflineAudioContext;
 const buf=await new C(1,1,44100).decodeAudioData(ab);
 const sr=buf.sampleRate,n=Math.min(buf.length,Math.floor(maxSec*sr)),ch=buf.numberOfChannels;
 const pcm=new Int16Array(n);const cs=[];for(let c=0;c<ch;c++)cs.push(buf.getChannelData(c));
 for(let i=0;i<n;i++){let s=0;for(let c=0;c<ch;c++)s+=cs[c][i];s/=ch;pcm[i]=Math.max(-1,Math.min(1,s))*32767}
 const ctx=M._chromaprint_new(1);if(!ctx)throw new Error('指紋の準備に失敗');
 const p=M._malloc(pcm.length*2);
 try{M.HEAP16.set(pcm,p/2);
  if(!M._chromaprint_start(ctx,sr,1)||!M._chromaprint_feed(ctx,p,pcm.length)||!M._chromaprint_finish(ctx))throw new Error('指紋の計算に失敗');
  const fpp=M._malloc(4);if(!M._chromaprint_get_fingerprint(ctx,fpp)){M._free(fpp);throw new Error('指紋の取得に失敗')}
  const sp=M.HEAP32[fpp/4],fp=M.UTF8ToString(sp);M._free(sp);M._free(fpp);
  return{fp,dur:buf.duration}}
 finally{M._free(p);M._chromaprint_free(ctx)}}
