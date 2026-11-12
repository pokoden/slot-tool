// OPFS書き込み専用ワーカー（同期アクセスハンドルで少しずつディスクへ書く）
const H={};
let dirP=null;
const dir=()=>dirP||(dirP=navigator.storage.getDirectory().then(r=>r.getDirectoryHandle('media',{create:true})));
onmessage=async e=>{const m=e.data;try{
 if(m.op==='test'){const d=await dir();const fh=await d.getFileHandle('_t',{create:true});const h=await fh.createSyncAccessHandle();h.write(new Uint8Array([1]),{at:0});h.flush();h.close();await d.removeEntry('_t');postMessage({id:m.id,ok:1})}
 else if(m.op==='open'){if(H[m.name]){try{H[m.name].close()}catch(x){}delete H[m.name]}const d=await dir();const fh=await d.getFileHandle(m.name,{create:true});const h=await fh.createSyncAccessHandle();if(m.truncate)h.truncate(0);H[m.name]=h;postMessage({id:m.id,ok:1,size:h.getSize()})}
 else if(m.op==='write'){const h=H[m.name];if(!h)throw new Error('not open');const u=new Uint8Array(m.buf);let n=0;while(n<u.length){n+=h.write(n?u.subarray(n):u,{at:m.at+n})}postMessage({id:m.id,ok:1})}
 else if(m.op==='close'){const h=H[m.name];if(h){h.flush();h.close();delete H[m.name]}postMessage({id:m.id,ok:1})}
 else if(m.op==='remove'){const h=H[m.name];if(h){try{h.close()}catch(x){}delete H[m.name]}const d=await dir();try{await d.removeEntry(m.name)}catch(x){}postMessage({id:m.id,ok:1})}
}catch(err){postMessage({id:m.id,err:String(err&&err.message||err)})}};
