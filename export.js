// 分析・判別ページの PDF / エクセル書き出し（押した時だけ読み込む）
(function(){
const LIB={x:'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',h:new URL('lib/html2canvas.min.js',document.currentScript&&document.currentScript.src||location.href).href,p:'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'};
const loaded={};
const load=k=>loaded[k]||(loaded[k]=new Promise((ok,ng)=>{const s=document.createElement('script');s.src=LIB[k];s.onload=ok;s.onerror=()=>{delete loaded[k];ng(new Error('ライブラリを読み込めませんでした（通信を確認してください）'))};document.head.appendChild(s)}));
const txt=n=>(n.innerText!=null&&n.isConnected?n.innerText:n.textContent||'').replace(/\s+/g,' ').trim();
function ovl(html){let o=document.getElementById('xpOv');if(!o){o=document.createElement('div');o.id='xpOv';o.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';document.body.appendChild(o)}
 o.innerHTML=`<div style="background:#fff;border-radius:12px;padding:16px;max-width:340px;width:100%;box-sizing:border-box;text-align:center">${html}</div>`;return o}
const close=()=>{const o=document.getElementById('xpOv');if(o)o.remove()};
function offer(blob,name){const o=ovl(`<p style="margin:0 0 10px">準備できました</p><p class="note" style="word-break:break-all;margin:0 0 12px">${name.replace(/</g,'&lt;')}</p><button id="xpSave" style="width:100%">保存する</button><button class="sub" id="xpClose" style="width:100%;margin-top:6px">閉じる</button>`);
 o.querySelector('#xpClose').onclick=close;
 o.querySelector('#xpSave').onclick=async()=>{let ok=false;try{const f=new File([blob],name,{type:blob.type});if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:name});ok=true}}catch(e){if(e&&e.name==='AbortError'){return}}
  if(!ok){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000)}close()}}
// ---- 表をマス目に（rowspan/colspan 対応）
function grid(tb){const out=[],mer=[];[...tb.rows].forEach((tr,r)=>{out[r]=out[r]||[];let c=0;[...tr.cells].forEach(td=>{while(out[r][c]!==undefined)c++;const rs=td.rowSpan||1,cs=td.colSpan||1,t=txt(td),th=td.tagName==='TH';
  for(let i=0;i<rs;i++){out[r+i]=out[r+i]||[];for(let j=0;j<cs;j++)out[r+i][c+j]=(i||j)?null:{t,th}}if(rs>1||cs>1)mer.push([r,c,r+rs-1,c+cs-1]);c+=cs})});return{cells:out,mer}}
const hdrN=tb=>{let n=0;for(const tr of tb.rows){if([...tr.cells].every(c=>c.tagName==='TH'))n++;else break}return n};
// ---- 文字→数値
function conv(t){const m=String(t).trim().match(/^([+\-−]?)([\d,]*\d(?:\.(\d+))?)(%|円|枚|玉|G|回転|h|時間|件|台|回|k)?$/);if(!m||/^0\d/.test(m[2]))return{v:t};
 let n=parseFloat(m[2].replace(/,/g,''));if(m[1]==='-'||m[1]==='−')n=-n;const d=m[3]?m[3].length:0,base=(m[2].includes(',')||Math.abs(n)>=1000?'#,##0':'0')+(d?'.'+'0'.repeat(d):''),u=m[4]||'';
 if(u==='%')return{v:n/100,f:(m[1]?'+':'')+'0'+(d?'.'+'0'.repeat(d):'')+'%'};
 const uu=u?`"${u}"`:'';return{v:n,f:m[1]==='+'?`+${base}${uu};-${base}${uu};${base}${uu}`:base+uu}}
const vlen=s=>[...String(s)].reduce((a,ch)=>a+(/[\u0000-\u00ff]/.test(ch)?1:2),0);
const HF={type:'pattern',pattern:'solid',fgColor:{argb:'FFDCE6F7'}},TF={type:'pattern',pattern:'solid',fgColor:{argb:'FF2B6FE8'}},BD={top:{style:'thin',color:{argb:'FFB8C2D6'}},left:{style:'thin',color:{argb:'FFB8C2D6'}},bottom:{style:'thin',color:{argb:'FFB8C2D6'}},right:{style:'thin',color:{argb:'FFB8C2D6'}}};
function putCell(ws,r,c,t,o){const cell=ws.getCell(r,c),x=conv(t);cell.value=x.v===''?null:x.v;if(x.f)cell.numFmt=x.f;if(o&&o.th){cell.fill=HF;cell.font={bold:true,color:{argb:'FF1B3A73'}};cell.alignment={horizontal:'center',vertical:'middle',wrapText:true}}else if(typeof x.v==='number')cell.alignment={horizontal:'right'};if(o&&o.bd)cell.border=BD;return cell}
function putTable(ws,r0,tb,W){const{cells,mer}=grid(tb);cells.forEach((row,r)=>row.forEach((x,c)=>{if(x===undefined)return;const cell=putCell(ws,r0+r,c+1,x?x.t:'',{th:x?x.th:cells[r].find(y=>y)?.th,bd:1});if(x&&!mer.some(m=>m[0]===r&&m[1]===c&&m[3]>m[1]))W[c]=Math.max(W[c]||0,vlen(x.t))}));
 mer.forEach(([a,b,c,d])=>ws.mergeCells(r0+a,b+1,r0+c,d+1));return r0+cells.length}
function head(ws,ctx,sub){const a=ws.getCell(1,1);a.value=ctx.title;a.font={bold:true,size:14,color:{argb:'FFFFFFFF'}};a.fill=TF;ws.getCell(2,1).value=ctx.cond;ws.getCell(2,1).font={color:{argb:'FF555555'}};let r=3;if(sub){ws.getCell(3,1).value=sub;ws.getCell(3,1).font={bold:true,size:12};r=4}return r+1}
const wid=(ws,W)=>W.forEach((w,i)=>{ws.getColumn(i+1).width=Math.max(6,Math.min(48,(w||0)+3))});
function sname(s,used){let b=String(s).replace(/[\[\]:*?\/\\]/g,'・').slice(0,28)||'シート',n=b,i=2;while(used.has(n))n=b.slice(0,26)+'_'+i++;used.add(n);return n}
// 判別ページのカード中身を行に
function flat(node,out){for(const el of node.children){if(el.tagName==='TABLE'){out.push({tb:el});continue}
 const blk=[...el.children].some(c=>/^(DIV|TABLE|P|H3|UL)$/.test(c.tagName));
 if(el.classList.contains('row')||!blk){if(el.classList.contains('row')&&el.children.length){const cs=[...el.children].map(txt).filter(Boolean);if(cs.length)out.push({cs})}else{const t=txt(el);if(t)out.push({cs:[t]})}}else flat(el,out)}return out}
async function xlsx(ctx){await load('x');const wb=new ExcelJS.Workbook(),used=new Set();
 if(ctx.kind==='a'){for(const s of ctx.secs){const ws=wb.addWorksheet(sname(s.title,used)),W=[];let r=head(ws,ctx,s.title);const h=hdrN(s.node);putTable(ws,r,s.node,W);ws.views=[{state:'frozen',ySplit:r-1+h}];wid(ws,W)}}
 else{const ws=wb.addWorksheet(sname(ctx.sheet||ctx.title,used)),W=[];let r=head(ws,ctx);
  for(const s of ctx.secs){r++;const c=ws.getCell(r,1);c.value=s.title;c.font={bold:true,size:12,color:{argb:'FFFFFFFF'}};c.fill=TF;r++;
   for(const it of flat(s.node,[])){if(it.tb){r=putTable(ws,r,it.tb,W)}else{it.cs.forEach((t,i)=>{putCell(ws,r,i+1,t,{});if(!(it.cs.length===1&&vlen(t)>30))W[i]=Math.max(W[i]||0,vlen(t))});r++}}}
  wid(ws,W)}
 const buf=await wb.xlsx.writeBuffer();return new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})}
// ---- PDF（A4横・幅に合わせて縮小・各ページに見出し）
async function pdf(ctx){await Promise.all([load('h'),load('p')]);const{jsPDF}=window.jspdf,doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
 const box=document.createElement('div');box.id='xpbox';box.style.cssText='position:absolute;left:-30000px;top:0;background:#fff;width:max-content';
 box.innerHTML='<style>#xpbox *{position:static!important}#xpbox .tw{overflow:visible!important;max-height:none!important;max-width:none!important}#xpbox .card{box-shadow:none;margin:0;border:1px solid #dde;overflow:visible!important;max-width:none!important}#xpbox table{background:#fff}</style>';document.body.appendChild(box);
 const PW=1684,PH=1190,MG=40,HB=MG+74,F='-apple-system,"Hiragino Sans","Noto Sans CJK JP","Noto Sans JP",sans-serif';let pg=null,g=null,y=0,no=0;const today=new Date().toLocaleDateString('ja-JP');
 const flush=()=>{if(!pg)return;if(no>1)doc.addPage('a4','landscape');doc.addImage(pg.toDataURL('image/jpeg',.88),'JPEG',0,0,297,210);pg=null};
 const newPg=()=>{flush();no++;pg=document.createElement('canvas');pg.width=PW;pg.height=PH;g=pg.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,PW,PH);g.fillStyle='#1b3a73';g.font='bold 30px '+F;g.textBaseline='alphabetic';g.fillText(ctx.title,MG,MG+28);g.fillStyle='#555';g.font='19px '+F;g.fillText(ctx.cond,MG,MG+60);g.textAlign='right';g.fillText(today+'  p.'+no,PW-MG,MG+28);g.textAlign='left';g.strokeStyle='#2b6fe8';g.lineWidth=2;g.beginPath();g.moveTo(MG,HB);g.lineTo(PW-MG,HB);g.stroke();y=HB+14};
 try{for(const s of ctx.secs){const pieces=[];
  if(s.node.tagName==='TABLE'){const t=s.node;box.appendChild(t);const h=hdrN(t),body=[...t.rows].slice(h);const ref=body.find(r=>r.cells.length===Math.max(...body.map(x=>x.cells.length)));
   if(body.length>60&&ref){const ws=[...ref.cells].map(c=>c.getBoundingClientRect().width);t.remove();for(let i=0;i<body.length;i+=60){const c=document.createElement('table');c.className=t.className;c.style.tableLayout='fixed';c.style.width=ws.reduce((a,b)=>a+b,0)+'px';c.innerHTML='<colgroup>'+ws.map(w=>`<col style="width:${w}px">`).join('')+'</colgroup>';[...t.rows].slice(0,h).forEach(r=>c.appendChild(r.cloneNode(true)));body.slice(i,i+60).forEach(r=>c.appendChild(r.cloneNode(true)));pieces.push(c)}}
   else{t.remove();pieces.push(t)}}else pieces.push(s.node);
  let first=true;for(const nd of pieces){const w=document.createElement('div');w.style.cssText='display:inline-block;padding:2px;background:#fff;'+(ctx.kind==='a'?'':'min-width:1000px;width:max-content;box-sizing:border-box');w.appendChild(nd);box.appendChild(w);
   const R=w.getBoundingClientRect(),cuts=[...new Set([...w.querySelectorAll('tr,.row,p,h3,table')].map(e=>Math.round(e.getBoundingClientRect().bottom-R.top)))].sort((a,b)=>a-b),sc=Math.max(1,Math.min(2,Math.sqrt(15e6/(R.width*R.height||1))));
   const cv=await html2canvas(w,{scale:sc,backgroundColor:'#fff',logging:false});w.remove();
   const d=Math.min((PW-2*MG)/cv.width,1.5/sc);let off=0;const H=cv.height/sc;
   while(off<H-1){if(!pg)newPg();let room=(PH-MG-y-(first?34:0))/d/ sc*sc; room=(PH-MG-y-(first?34:0))/(d*sc);
    if(room<80&&y>HB+14){newPg();continue}
    let end=H-off<=room?H:(cuts.filter(c=>c>off+20&&c<=off+room).pop()||off+room);
    if(first){g.fillStyle='#222';g.font='bold 22px '+F;g.fillText(s.title,MG,y+24);y+=34;first=false}
    const sh=(end-off)*sc;g.drawImage(cv,0,off*sc,cv.width,sh,MG,y,cv.width*d,sh*d);y+=sh*d+18;off=end;if(off<H-1)newPg()}}}
  flush();return doc.output('blob')}finally{box.remove()}}
// ---- 画像（PNG）。m＝判別ページの稼働記録の枠だけ／a＝集計の表全体（横にはみ出す列も全部）＋絞り込み条件1行
// r69：段階表示・画像待ち1枚3秒・全体20秒で打ち切り・html2canvasは枠だけ複製・iPhoneは約800万画素/倍率1.5まで
const IOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
let STAGE='';const stage=t=>{STAGE=t;const e=document.getElementById('xpStage');if(e)e.textContent='段階：'+t};
const wait=(p,ms)=>Promise.race([p,new Promise(r=>setTimeout(r,ms))]);
function toData(img){try{if(!img.naturalWidth)return false;const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);img.src=c.toDataURL('image/png');return true}catch(e){return false}}
async function png(kind,ctx){stage('ライブラリ読込');await load('h');const box=document.createElement('div');box.id='xpbox';box.style.cssText='position:absolute;left:0;top:0;transform:translateX(-200vw);background:#fff;width:max-content;padding:12px';
 box.innerHTML='<style>#xpbox .tw{overflow:visible!important;max-height:none!important;max-width:none!important}#xpbox .card{box-shadow:none;margin:0;overflow:visible!important;max-width:none!important}#xpbox table{background:#fff}#xpbox th,#xpbox td{position:static!important}</style>';
 try{if(kind==='m'){const src=[...document.querySelectorAll('#mach .card')].find(c=>{const h=c.querySelector('h2');return h&&h.textContent.trim().startsWith('稼働記録')});if(!src)throw new Error('稼働記録の枠が見つかりません');
   const cl=src.cloneNode(true);cl.querySelectorAll('button,input,select,textarea,script').forEach(x=>x.remove());
   // 元の画像（読み込み済み）からデータ化して差し替え。コピーの loading=lazy は外す
   const oi=[...src.querySelectorAll('img')],ci=[...cl.querySelectorAll('img')];ci.forEach((im,n)=>{im.removeAttribute('loading');im.loading='eager';const o=oi[n];if(o&&o.complete&&o.naturalWidth){const c=document.createElement('canvas');try{c.width=o.naturalWidth;c.height=o.naturalHeight;c.getContext('2d').drawImage(o,0,0);im.src=c.toDataURL('image/png')}catch(e){}}});
   cl.style.width=src.getBoundingClientRect().width+'px';box.appendChild(cl)}
  else{const hd=document.createElement('div');hd.style.cssText='font:bold 18px sans-serif;color:#1b3a73;margin:0 0 2px';hd.textContent=ctx.title;const cd=document.createElement('div');cd.style.cssText='font-size:13px;color:#555;margin:0 0 10px;white-space:nowrap';cd.textContent=ctx.cond;box.append(hd,cd);
   for(const s of(ctx.img&&ctx.img.length?ctx.img:ctx.secs)){s.node.querySelectorAll('img').forEach(im=>{im.removeAttribute('loading')});if(s.title){const t=document.createElement('div');t.style.cssText='font-weight:bold;margin:10px 0 4px';t.textContent=s.title;box.append(t)}box.append(s.node)}}
  document.body.appendChild(box);stage('画像待ち');const imgs=[...box.querySelectorAll('img')];
  await Promise.all(imgs.map(i=>i.complete?0:wait(new Promise(r=>{i.addEventListener('load',r,{once:true});i.addEventListener('error',r,{once:true})}),3000)));
  imgs.forEach(i=>{if(!i.src.startsWith('data:'))toData(i)});
  const R=box.getBoundingClientRect(),MP=IOS?8e6:16e6,MX=IOS?1.5:2,sc=Math.max(.5,Math.min(MX,Math.sqrt(MP/(R.width*R.height||1))));
  stage('描画');const cv=await html2canvas(box,{scale:sc,backgroundColor:'#fff',logging:false,useCORS:true,imageTimeout:3000,x:0,y:0,width:Math.ceil(R.width),height:Math.ceil(R.height),windowWidth:Math.max(innerWidth,Math.ceil(R.width)+40),
   ignoreElements:el=>!(el===document.head||document.head.contains(el)||box.contains(el)||el.contains(box)),onclone:d=>{const b=d.getElementById('xpbox');if(b)b.style.transform='none'}});
  stage('PNG化');return await new Promise((ok,ng)=>cv.toBlob(b=>b&&b.size?ok(b):ng(new Error('画像を作れませんでした（画像が大きすぎる可能性）')),'image/png'))}finally{box.remove()}}
window.XP={run:async(kind,fmt)=>{let ctx;try{ctx=window.xpCtx(kind)}catch(e){alert('書き出しの準備に失敗しました: '+e.message);return}
 if(!ctx||!(fmt==='png'&&ctx.img&&ctx.img.length?ctx.img:ctx.secs).length){alert('書き出す表がありません');return}ovl('<p style="margin:0">作成中…</p>'+(fmt==='png'?'<p class="note" id="xpStage" style="margin:6px 0 0"></p>':''));
 try{const b=fmt==='png'?await Promise.race([png(kind,ctx),new Promise((_,ng)=>setTimeout(()=>ng(new Error('TIMEOUT')),20000))]):fmt==='pdf'?await pdf(ctx):await xlsx(ctx);offer(b,ctx.file+(fmt==='png'?'.png':fmt==='pdf'?'.pdf':'.xlsx'))}catch(e){close();if(e&&e.message==='TIMEOUT'){const bx=document.getElementById('xpbox');if(bx)bx.remove();alert('画像の作成がタイムアウトしました（'+(STAGE||'準備')+'の段階）')}else alert('書き出しに失敗しました: '+(e&&e.message||e))}}};
})();
