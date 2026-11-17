/* プロンプト作成 v1 */
(() => {
const API = 'https://api.github.com/repos/pokoden/slot-data/contents/';
const PARTS_PATH = 'prompt/parts.json';
const USER_PATH = 'prompt/user.json';
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tok = () => LS.get('v2_token', '') || '';
const uid = () => 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
const now = () => new Date().toISOString();

const TABS = [['make', '作成'], ['fav', 'お気に入り'], ['hist', '履歴'], ['parts', '部品'], ['io', '取込']];
let tab = LS.get('pr_tab', 'make');
let D = null; // catalog
let U = { v: 1, updatedAt: '', fav: [], hist: [], order: [], partOrder: {}, partsExtra: [], partsEdit: {}, partsDelete: [] };
let sha = { parts: null, user: null };
let st = { poseId: '', zoom: false, pick: {}, multi: {}, locks: {}, outputEdit: null };
let filt = { q: '', cat: '', people: '', orient: '' };
let dirty = false, saveT = 0, statusT = 0;

function status(msg, ok) {
  const el = $('st');
  if (!el) return;
  el.textContent = msg || '';
  el.className = ok === false ? 'ng' : ok ? 'ok' : '';
}

async function gh(path, opt = {}) {
  return fetch(API + path, Object.assign({ cache: 'no-store' }, opt, {
    headers: Object.assign({ Authorization: 'Bearer ' + tok(), Accept: 'application/vnd.github+json' }, opt.headers || {})
  }));
}
function b64dec(b) {
  const bin = atob(b.replace(/\s/g, ''));
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(u);
}
function b64enc(s) {
  const u = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(bin);
}

function emptyUser() {
  return { v: 1, updatedAt: '', fav: [], hist: [], order: [], partOrder: {}, partsExtra: [], partsEdit: {}, partsDelete: [] };
}
function mergeUser(a, b) {
  const out = emptyUser();
  const pickLater = (x, y) => (!x ? y : !y ? x : ((x.updatedAt || '') >= (y.updatedAt || '') ? x : y));
  const base = pickLater(a, b) || emptyUser();
  Object.assign(out, base);
  const hist = [...(a && a.hist || []), ...(b && b.hist || [])];
  const hs = new Map();
  for (const h of hist) if (h && h.id && !hs.has(h.id)) hs.set(h.id, h);
  out.hist = [...hs.values()].sort((x, y) => (x.at || '') < (y.at || '') ? 1 : -1);
  const fav = [...(a && a.fav || []), ...(b && b.fav || [])];
  const fs = new Map();
  for (const f of fav) if (f && f.id && !fs.has(f.id)) fs.set(f.id, f);
  out.fav = [...fs.values()].sort((x, y) => (x.at || '') < (y.at || '') ? 1 : -1);
  out.partsEdit = Object.assign({}, a && a.partsEdit, b && b.partsEdit);
  out.partsDelete = [...new Set([...(a && a.partsDelete || []), ...(b && b.partsDelete || [])])];
  const ex = [...(a && a.partsExtra || []), ...(b && b.partsExtra || [])];
  const em = new Map();
  for (const p of ex) if (p && p.id) em.set(p.id, p);
  out.partsExtra = [...em.values()];
  return out;
}

async function loadRemote() {
  if (!tok()) throw new Error('トークン未設定');
  const [pr, ur] = await Promise.all([
    gh(PARTS_PATH + '?t=' + Date.now()),
    gh(USER_PATH + '?t=' + Date.now())
  ]);
  if (pr.status === 401 || pr.status === 403 || pr.status === 404) {
    const why = pr.status === 401 ? 'トークンが違うか期限切れ' : pr.status === 403 ? '権限がないか回数制限' : 'parts.json が見つからない';
    throw new Error(why + '（' + pr.status + '）');
  }
  if (!pr.ok) throw new Error('部品の読み込みに失敗（' + pr.status + '）');
  const pj = await pr.json();
  sha.parts = pj.sha;
  D = JSON.parse(b64dec(pj.content));
  LS.set('pr_parts', D);
  if (ur.ok) {
    const uj = await ur.json();
    sha.user = uj.sha;
    const remote = JSON.parse(b64dec(uj.content));
    const local = LS.get('pr_user', null);
    U = local && local.updatedAt ? mergeUser(local, remote) : mergeUser(remote, emptyUser());
    LS.set('pr_user', U);
  } else if (ur.status === 404) {
    sha.user = null;
    const local = LS.get('pr_user', null);
    U = local || emptyUser();
  } else {
    throw new Error('履歴の読み込みに失敗（' + ur.status + '）');
  }
}

async function saveUser(manual) {
  U.updatedAt = now();
  LS.set('pr_user', U);
  if (!tok()) { if (manual) status('この端末だけに保存したよ', true); return; }
  const body = JSON.stringify(U);
  const payload = { message: 'prompt user sync', content: b64enc(body), sha: sha.user || undefined };
  const r = await gh(USER_PATH, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (r.ok) {
    const j = await r.json();
    sha.user = j.content && j.content.sha || j.sha || sha.user;
    dirty = false;
    if (manual) status('保存したよ', true);
  } else if (manual) status('保存できなかった（' + r.status + '）', false);
}

function scheduleSave() {
  dirty = true;
  LS.set('pr_user', U);
  clearTimeout(saveT);
  saveT = setTimeout(() => saveUser(false), 800);
}

function catalog() {
  if (!D) return { poses: [], parts: {}, sets: { outfit: [], accessory: [] }, rules: [], order: [] };
  return D;
}

function allParts() {
  const C = catalog();
  const list = [];
  const del = new Set(U.partsDelete || []);
  const order = (U.order && U.order.length) ? U.order : (C.order || []);
  const cats = [...order, ...Object.keys(C.parts || {})];
  const seenCat = new Set();
  for (const cat of cats) {
    if (seenCat.has(cat) || !C.parts[cat]) continue;
    seenCat.add(cat);
    const subs = C.parts[cat];
    const subNames = Object.keys(subs);
    for (const sub of subNames) {
      for (const it of (subs[sub] || [])) {
        if (del.has(it.id)) continue;
        const ed = U.partsEdit && U.partsEdit[it.id];
        list.push(Object.assign({ cat, sub }, it, ed || {}));
      }
    }
  }
  for (const it of (U.partsExtra || [])) {
    if (del.has(it.id)) continue;
    list.push(it);
  }
  return list;
}

function partsByCat() {
  const m = new Map();
  for (const p of allParts()) {
    if (!m.has(p.cat)) m.set(p.cat, new Map());
    const sm = m.get(p.cat);
    if (!sm.has(p.sub)) sm.set(p.sub, []);
    sm.get(p.sub).push(p);
  }
  if (U.partOrder) {
    for (const [key, ids] of Object.entries(U.partOrder)) {
      const [cat, sub] = key.split('\t');
      const sm = m.get(cat);
      if (!sm || !sm.has(sub)) continue;
      const arr = sm.get(sub);
      const ix = new Map(ids.map((id, i) => [id, i]));
      arr.sort((a, b) => (ix.has(a.id) ? ix.get(a.id) : 9999) - (ix.has(b.id) ? ix.get(b.id) : 9999));
    }
  }
  return m;
}

function partById(id) { return allParts().find(p => p.id === id) || null; }
function poseById(id) { return (catalog().poses || []).find(p => p.id === id) || null; }

function catOrder() {
  const C = catalog();
  const base = (U.order && U.order.length) ? U.order.slice() : (C.order || []).slice();
  for (const c of Object.keys(C.parts || {})) if (!base.includes(c)) base.push(c);
  return base;
}

const MULTI_SUB = new Set(['後付け', '隠し', '装身具', '拘束', 'コスプレ', 'ガーター']);
function isMulti(cat, sub) {
  if (cat === 'アクセサリー') return true;
  if (cat === '服装' && MULTI_SUB.has(sub)) return true;
  if (cat === '小道具' || cat === '家具') return true;
  return false;
}

function selectedIds() {
  const ids = [];
  for (const v of Object.values(st.pick)) if (v) ids.push(v);
  for (const arr of Object.values(st.multi)) for (const id of arr || []) ids.push(id);
  return ids;
}

function tagsOf(p) { return (p && p.tags) || []; }

function conflicts(a, b) {
  const ta = tagsOf(a), tb = tagsOf(b);
  if (!ta.length || !tb.length) return false;
  for (const r of (catalog().rules || [])) {
    const Ahas = r.tags.some(t => ta.includes(t));
    const Bconf = r.conflictsWith.some(t => tb.includes(t));
    const Bhas = r.tags.some(t => tb.includes(t));
    const Aconf = r.conflictsWith.some(t => ta.includes(t));
    if ((Ahas && Bconf) || (Bhas && Aconf)) return r;
  }
  return false;
}

function blockedAgainstSelected(part) {
  const sels = selectedIds().map(partById).filter(Boolean);
  for (const s of sels) {
    if (s.id === part.id) continue;
    const r = conflicts(part, s);
    if (r) return r;
  }
  return null;
}

function keyOf(cat, sub) { return cat + '\t' + sub; }

function setPick(cat, sub, id) {
  const k = keyOf(cat, sub);
  const part = partById(id);
  const already = isMulti(cat, sub) ? (st.multi[k] || []).includes(id) : st.pick[k] === id;
  if (part && !already && blockedAgainstSelected(part)) return;
  if (isMulti(cat, sub)) {
    const arr = (st.multi[k] || []).slice();
    const i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(id);
    st.multi[k] = arr;
  } else {
    st.pick[k] = st.pick[k] === id ? '' : id;
  }
  st.outputEdit = null;
  render();
}

function locked(cat, sub) { return !!st.locks[keyOf(cat, sub)]; }
function toggleLock(cat, sub) {
  const k = keyOf(cat, sub);
  st.locks[k] = !st.locks[k];
  render();
}

function applyPose(pose, keepExpr) {
  st.poseId = pose ? pose.id : '';
  if (!pose) { st.outputEdit = null; render(); return; }
  const rec = pose.rec || {};
  function fillSub(cat, sub, text) {
    if (!text || locked(cat, sub)) return;
    const list = (partsByCat().get(cat) || new Map()).get(sub) || [];
    const hit = list.find(p => p.text === text) || list.find(p => text.includes(p.text) || p.text.includes(text));
    if (hit && !blockedAgainstSelected(hit)) st.pick[keyOf(cat, sub)] = hit.id;
  }
  if (!keepExpr) {
    if (!locked('表情', '完成セット')) {
      /* rec.expr may match a set */
      const sets = (partsByCat().get('表情') || new Map()).get('完成セット') || [];
      const hit = rec.expr && sets.find(p => p.text === rec.expr || rec.expr.includes(p.label));
      if (hit) st.pick[keyOf('表情', '完成セット')] = hit.id;
    }
    fillSub('表情パーツ', '顎', rec.face);
    fillSub('表情パーツ', '首', rec.face);
    fillSub('表情パーツ', '口', rec.expr);
    fillSub('表情パーツ', '目', rec.expr);
    fillSub('表情パーツ', '黒目', rec.expr);
  }
  fillSub('顔の向き・視線', '顔の向き', rec.face);
  fillSub('顔の向き・視線', '視線', rec.gaze || rec.face);
  /* also map rec tags onto 表情パーツ 視線 */
  fillSub('表情パーツ', '視線', rec.gaze);
  st.outputEdit = null;
}

function choosePose(id) {
  const pose = poseById(id);
  const keepExpr = !!st.poseId; // 2回目以降は表情を維持
  if (st.poseId === id) {
    st.poseId = '';
    st.outputEdit = null;
    render();
    return;
  }
  applyPose(pose, keepExpr);
  st.poseId = id;
  render();
}

function applyOutfitSet(set) {
  const byLabel = new Map(allParts().map(p => [p.label, p]));
  for (const name of (set.items || [])) {
    const p = byLabel.get(name);
    if (!p) continue;
    if (locked(p.cat, p.sub)) continue;
    if (blockedAgainstSelected(p)) continue;
    const k = keyOf(p.cat, p.sub);
    if (isMulti(p.cat, p.sub)) {
      const arr = st.multi[k] || [];
      if (!arr.includes(p.id)) st.multi[k] = arr.concat([p.id]);
    } else st.pick[k] = p.id;
  }
  st.outputEdit = null;
  render();
}

function assemble() {
  if (st.outputEdit != null) return st.outputEdit;
  const chunks = [];
  const pose = poseById(st.poseId);
  if (pose && pose.body) chunks.push(pose.body);
  if (pose && st.zoom && pose.zoom) chunks.push(pose.zoom);
  const by = partsByCat();
  for (const cat of catOrder()) {
    const sm = by.get(cat);
    if (!sm) continue;
    for (const [sub, list] of sm) {
      const k = keyOf(cat, sub);
      const ids = isMulti(cat, sub) ? (st.multi[k] || []) : (st.pick[k] ? [st.pick[k]] : []);
      for (const id of ids) {
        const p = list.find(x => x.id === id) || partById(id);
        if (p && p.text) chunks.push(p.text);
      }
    }
  }
  return chunks.join('');
}

function snapshot() {
  return {
    poseId: st.poseId,
    zoom: st.zoom,
    pick: Object.assign({}, st.pick),
    multi: JSON.parse(JSON.stringify(st.multi)),
    locks: Object.assign({}, st.locks)
  };
}
function restoreSnap(s) {
  if (!s) return;
  st.poseId = s.poseId || '';
  st.zoom = !!s.zoom;
  st.pick = Object.assign({}, s.pick || {});
  st.multi = JSON.parse(JSON.stringify(s.multi || {}));
  st.locks = Object.assign({}, s.locks || {});
  st.outputEdit = null;
}

function poseTitle() {
  const p = poseById(st.poseId);
  return p ? p.title : '（ポーズなし）';
}

async function copyOut() {
  const text = assemble();
  try { await navigator.clipboard.writeText(text); status('コピーしたよ', true); }
  catch (e) { prompt('長押しでコピーしてね', text); }
  U.hist.unshift({ id: uid(), at: now(), title: poseTitle(), text, snap: snapshot() });
  scheduleSave();
  render();
}

function saveFav() {
  U.fav.unshift({ id: uid(), at: now(), title: poseTitle(), text: assemble(), snap: snapshot() });
  scheduleSave();
  status('お気に入りに入れたよ', true);
  render();
}

function renderNav() {
  $('nav').innerHTML = TABS.map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" onclick="go('${k}')">${n}</button>`).join('');
}

window.go = k => { tab = k; LS.set('pr_tab', k); render(); };
window.saveTok = () => {
  const v = ($('tk') && $('tk').value.trim()) || '';
  if (!v) { alert('トークンを入れてね'); return; }
  LS.set('v2_token', v);
  boot(true);
};

function pickerHtml(cat, sub, list) {
  const k = keyOf(cat, sub);
  const multi = isMulti(cat, sub);
  const sel = multi ? new Set(st.multi[k] || []) : new Set(st.pick[k] ? [st.pick[k]] : []);
  const lk = locked(cat, sub);
  const btns = list.map(p => {
    const block = !sel.has(p.id) && blockedAgainstSelected(p);
    const cls = sel.has(p.id) ? 'on' : block ? 'off' : '';
    return `<button class="${cls}" ${block ? 'disabled' : ''} onclick="pick('${esc(cat)}','${esc(sub)}','${esc(p.id)}')">${esc(p.label)}</button>`;
  }).join('');
  return `<div class="card"><h2>${esc(sub === cat ? cat : cat + ' / ' + sub)} <button class="lock${lk ? ' on' : ''}" onclick="togLock('${esc(cat)}','${esc(sub)}')">${lk ? '固定中' : '固定'}</button></h2><div class="pick">${btns || '（なし）'}</div></div>`;
}

window.pick = (cat, sub, id) => setPick(cat, sub, id);
window.togLock = (cat, sub) => toggleLock(cat, sub);
window.selPose = id => choosePose(id);
window.setFilt = (f, v) => { filt[f] = v; render(); };
window.setQ = v => { filt.q = v; render(); };
window.togZoom = () => { st.zoom = !st.zoom; st.outputEdit = null; render(); };
window.editOut = v => { st.outputEdit = v; };
window.doCopy = () => copyOut();
window.doFav = () => saveFav();
window.useOutfit = id => {
  const s = (catalog().sets.outfit || []).find(x => x.id === id);
  if (s) applyOutfitSet(s);
};
window.useAccSet = id => {
  const s = (catalog().sets.accessory || []).find(x => x.id === id);
  if (s) applyOutfitSet(s);
};

function filterPoses() {
  let list = catalog().poses || [];
  if (filt.q) {
    const q = filt.q;
    list = list.filter(p => (p.title || '').includes(q) || (p.cat || '').includes(q));
  }
  if (filt.cat) list = list.filter(p => p.cat === filt.cat || p.catGroup === filt.cat);
  if (filt.people) list = list.filter(p => p.people === filt.people);
  if (filt.orient) list = list.filter(p => p.orient === filt.orient);
  return list;
}

function similarPoses(pose) {
  if (!pose) return [];
  return (catalog().poses || []).filter(p => p.id !== pose.id && p.cat === pose.cat && p.facing === pose.facing && p.posture === pose.posture);
}

function renderMake() {
  if (!D) return `<div class="card"><h2>トークン</h2><input id="tk" type="password" placeholder="github_pat_..."><div class="row"><button class="b" onclick="saveTok()">保存して読み込む</button></div></div>`;
  const poses = filterPoses();
  const cats = [...new Set((catalog().poses || []).map(p => p.cat))];
  const groups = [...new Set((catalog().poses || []).map(p => p.catGroup).filter(Boolean))];
  const people = [...new Set((catalog().poses || []).map(p => p.people).filter(Boolean))];
  const orients = [...new Set((catalog().poses || []).map(p => p.orient).filter(Boolean))];
  const cur = poseById(st.poseId);
  const sim = similarPoses(cur);
  const by = partsByCat();
  let pickers = '';
  /* 服装セット */
  const outfits = catalog().sets && catalog().sets.outfit || [];
  if (outfits.length) {
    pickers += `<div class="card"><h2>服装セット</h2><select onchange="if(this.value)useOutfit(this.value);this.value=''"><option value="">選ぶ</option>${outfits.map(s => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('')}</select></div>`;
  }
  const accsets = catalog().sets && catalog().sets.accessory || [];
  if (accsets.length) {
    pickers += `<div class="card"><h2>アクセサリーセット</h2><select onchange="if(this.value)useAccSet(this.value);this.value=''"><option value="">選ぶ</option>${accsets.map(s => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('')}</select></div>`;
  }
  for (const cat of catOrder()) {
    const sm = by.get(cat);
    if (!sm) continue;
    if (cat === '顔の向き・視線' || cat === '表情パーツ' || cat === '表情' || cat === '服装' || cat === 'アクセサリー' || cat === '髪型' || cat === '背景セット' || cat === '壁' || cat === 'カーテン' || cat === '掲示板' || cat === '床' || cat === '家具' || cat === '建物の一部' || cat === '小道具' || cat === '水回り設備' || cat === '拘束器具' || cat === '乗り物' || cat === '照明' || cat === '画像サイズ' || cat === 'カメラ' || cat === '男' || cat === '男服' || cat === '形容詞' || cat === '画面の枠' || cat === '体型・顔の固定文') {
      for (const [sub, list] of sm) pickers += pickerHtml(cat, sub, list);
    }
  }
  return `
  <div class="card">
    <h2>ポーズ</h2>
    <input type="search" value="${esc(filt.q)}" placeholder="タイトル検索" oninput="setQ(this.value)">
    <div class="row">
      <select onchange="setFilt('cat',this.value)">
        <option value="">分類</option>
        ${groups.map(g => `<option value="${esc(g)}" ${filt.cat === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}
        ${cats.map(c => `<option value="${esc(c)}" ${filt.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
      </select>
      <select onchange="setFilt('people',this.value)">
        <option value="">人数</option>
        ${people.map(c => `<option value="${esc(c)}" ${filt.people === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
      </select>
      <select onchange="setFilt('orient',this.value)">
        <option value="">画像向き</option>
        ${orients.map(c => `<option value="${esc(c)}" ${filt.orient === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
      </select>
    </div>
    <div>${poses.map(p => `<button class="pose${st.poseId === p.id ? ' on' : ''}" onclick="selPose('${esc(p.id)}')">${esc(p.title)}</button>`).join('') || '（ない）'}</div>
    ${cur && cur.line ? `<div class="line">${esc(cur.line)}</div>` : ''}
    ${cur && cur.draft ? `<div>本文は案（確認待ち）</div>` : ''}
    ${cur && cur.zoom ? `<div class="row"><button class="lock${st.zoom ? ' on' : ''}" onclick="togZoom()">${st.zoom ? 'ズーム入れる' : 'ズームなし'}</button></div>` : ''}
  </div>
  ${sim.length ? `<div class="card"><h2>似たポーズ</h2>${sim.map(p => `<button class="pose" onclick="selPose('${esc(p.id)}')">${esc(p.title)}</button>`).join('')}</div>` : ''}
  ${pickers}
  <div class="card">
    <h2>完成プロンプト</h2>
    <textarea id="out" oninput="editOut(this.value)">${esc(assemble())}</textarea>
    <div class="row">
      <button class="b" onclick="doCopy()">コピー</button>
      <button class="sub" onclick="doFav()">お気に入り</button>
    </div>
  </div>`;
}

function renderList(kind) {
  const arr = kind === 'fav' ? (U.fav || []) : (U.hist || []);
  if (!arr.length) return `<div class="card">（まだない）</div>`;
  return `<div class="card">${arr.map(x => `
    <div class="item">
      <div><b>${esc(x.title || '')}</b><div>${esc((x.at || '').replace('T', ' ').slice(0, 19))}</div></div>
      <div>
        <button class="sub" onclick="loadSnap('${kind}','${esc(x.id)}')">呼び出す</button>
        ${kind === 'fav' ? `<button class="sub" onclick="delFav('${esc(x.id)}')">外す</button>` : ''}
      </div>
    </div>`).join('')}</div>`;
}
window.loadSnap = (kind, id) => {
  const arr = kind === 'fav' ? U.fav : U.hist;
  const x = (arr || []).find(e => e.id === id);
  if (!x) return;
  restoreSnap(x.snap);
  tab = 'make';
  LS.set('pr_tab', tab);
  render();
};
window.delFav = id => {
  U.fav = (U.fav || []).filter(x => x.id !== id);
  scheduleSave();
  render();
};

function renderParts() {
  if (!D) return renderMake();
  const by = partsByCat();
  const ord = catOrder();
  let html = `<div class="card"><h2>並び順（完成プロンプトの順）</h2>
    <div>${ord.map((c, i) => `<div class="item"><div>${esc(c)}</div><div>
      <button class="sub" ${i === 0 ? 'disabled' : ''} onclick="moveCat(${i},-1)">上へ</button>
      <button class="sub" ${i === ord.length - 1 ? 'disabled' : ''} onclick="moveCat(${i},1)">下へ</button>
    </div></div>`).join('')}</div></div>`;
  html += `<div class="card"><h2>部品を追加</h2>
    <select id="na_cat">${ord.map(c => `<option>${esc(c)}</option>`).join('')}</select>
    <input id="na_sub" placeholder="小分類">
    <input id="na_lab" placeholder="名前">
    <textarea id="na_tx" placeholder="本文"></textarea>
    <div class="row"><button class="b" onclick="addPart()">追加</button></div>
  </div>`;
  for (const cat of ord) {
    const sm = by.get(cat);
    if (!sm) continue;
    for (const [sub, list] of sm) {
      html += `<div class="card"><h2>${esc(cat)} / ${esc(sub)}</h2>${list.map((p, i) => `
        <div class="item">
          <div><input value="${esc(p.label)}" onchange="edPart('${esc(p.id)}','label',this.value)"><textarea onchange="edPart('${esc(p.id)}','text',this.value)">${esc(p.text)}</textarea></div>
          <div>
            <button class="sub" ${i === 0 ? 'disabled' : ''} onclick="movePart('${esc(cat)}','${esc(sub)}',${i},-1)">上へ</button>
            <button class="sub" ${i === list.length - 1 ? 'disabled' : ''} onclick="movePart('${esc(cat)}','${esc(sub)}',${i},1)">下へ</button>
            <button class="sub" onclick="delPart('${esc(p.id)}')">削除</button>
          </div>
        </div>`).join('')}</div>`;
    }
  }
  return html;
}
window.moveCat = (i, d) => {
  const ord = catOrder();
  const j = i + d;
  if (j < 0 || j >= ord.length) return;
  const t = ord[i]; ord[i] = ord[j]; ord[j] = t;
  U.order = ord;
  scheduleSave();
  render();
};
window.addPart = () => {
  const cat = $('na_cat').value.trim();
  const sub = $('na_sub').value.trim() || cat;
  const label = $('na_lab').value.trim();
  const text = $('na_tx').value;
  if (!cat || !label) { alert('分類と名前を入れてね'); return; }
  U.partsExtra.push({ id: uid(), cat, sub, label, text, tags: [] });
  scheduleSave();
  render();
};
window.edPart = (id, field, val) => {
  const p = partById(id);
  if (!p) return;
  if ((U.partsExtra || []).some(x => x.id === id)) {
    const e = U.partsExtra.find(x => x.id === id);
    e[field] = val;
  } else {
    U.partsEdit[id] = Object.assign({}, U.partsEdit[id] || {}, { [field]: val });
  }
  scheduleSave();
};
window.delPart = id => {
  if (!confirm('この部品を削除する？')) return;
  U.partsExtra = (U.partsExtra || []).filter(x => x.id !== id);
  U.partsDelete = [...new Set([...(U.partsDelete || []), id])];
  scheduleSave();
  render();
};
window.movePart = (cat, sub, i, d) => {
  const list = (partsByCat().get(cat) || new Map()).get(sub) || [];
  const j = i + d;
  if (j < 0 || j >= list.length) return;
  const ids = list.map(x => x.id);
  const t = ids[i]; ids[i] = ids[j]; ids[j] = t;
  U.partOrder[keyOf(cat, sub)] = ids;
  scheduleSave();
  render();
};

function renderIo() {
  return `<div class="card"><h2>トークン</h2>
    <input id="tk" type="password" placeholder="${tok() ? '保存済み（変更時のみ入力）' : 'github_pat_...'}">
    <div class="row"><button class="b" onclick="saveTok()">保存して読み込む</button></div>
  </div>
  <div class="card"><h2>TSV取り込み</h2>
    <div>列は 分類 / 小分類 / 名前 / 本文（同じ名前は上書き）</div>
    <input type="file" id="tsv" accept=".tsv,.txt,text/tab-separated-values" onchange="impTsv(this)">
  </div>
  <div class="card"><h2>エクセルに保存</h2>
    <div class="row"><button class="b" onclick="dlXlsx()">ダウンロード</button></div>
  </div>
  <div class="card"><h2>今のデータを保存</h2>
    <div class="row"><button class="b" onclick="saveUser(true)">保存</button></div>
  </div>`;
}

window.impTsv = async ev => {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  const text = await f.text();
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return;
  const head = lines[0].split('\t').map(s => s.trim());
  const ix = n => { const i = head.indexOf(n); return i; };
  let nOk = 0;
  const byLabel = new Map(allParts().map(p => [p.cat + '\t' + p.label, p]));
  for (const line of lines.slice(1)) {
    const c = line.split('\t');
    const get = name => {
      const i = ix(name);
      return i >= 0 ? (c[i] || '') : '';
    };
    let cat = get('分類') || get('今のタブ') || '';
    let sub = get('小分類') || get('今の分類') || cat;
    let label = get('名前') || get('タイトル') || '';
    let body = get('本文') || get('新しい本文') || get('プロンプト') || '';
    if (!label) continue;
    if (!cat) cat = '服装';
    if (!sub) sub = cat;
    const exist = byLabel.get(cat + '\t' + label) || allParts().find(p => p.label === label);
    if (exist) {
      if ((U.partsExtra || []).some(x => x.id === exist.id)) {
        const e = U.partsExtra.find(x => x.id === exist.id);
        e.text = body; e.label = label;
      } else {
        U.partsEdit[exist.id] = Object.assign({}, U.partsEdit[exist.id] || {}, { label, text: body });
      }
    } else {
      const it = { id: uid(), cat, sub, label, text: body, tags: [] };
      U.partsExtra.push(it);
      byLabel.set(cat + '\t' + label, it);
    }
    nOk++;
  }
  scheduleSave();
  status(nOk + '件取り込んだよ', true);
  ev.target.value = '';
  render();
};

function xlsxDownload(filename, sheets) {
  /* uncompressed zip of a minimal xlsx */
  function crc32(u) {
    let c = ~0;
    for (let i = 0; i < u.length; i++) {
      c ^= u[i];
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  }
  function u16(n) { return new Uint8Array([n & 255, (n >>> 8) & 255]); }
  function u32(n) { return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]); }
  function enc(s) { return new TextEncoder().encode(s); }
  function catBytes(arr) {
    const n = arr.reduce((a, b) => a + b.length, 0);
    const o = new Uint8Array(n);
    let p = 0;
    for (const x of arr) { o.set(x, p); p += x.length; }
    return o;
  }
  function xmlEsc(s) { return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch])); }
  const files = [];
  files.push(['[Content_Types].xml', enc(`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
</Types>`)]);
  files.push(['_rels/.rels', enc(`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`)]);
  files.push(['xl/_rels/workbook.xml.rels', enc(`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}
</Relationships>`)]);
  files.push(['xl/workbook.xml', enc(`<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets.map((s, i) => `<sheet name="${xmlEsc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`)]);
  sheets.forEach((s, i) => {
    const rows = s.rows.map((row, r) => {
      const cells = row.map((val, c) => {
        const col = (c >= 26 ? String.fromCharCode(65 + Math.floor(c / 26) - 1) : '') + String.fromCharCode(65 + (c % 26));
        const ref = col + (r + 1);
        return `<c r="${ref}" t="inlineStr"><is><t>${xmlEsc(val)}</t></is></c>`;
      }).join('');
      return `<row r="${r + 1}">${cells}</row>`;
    }).join('');
    files.push([`xl/worksheets/sheet${i + 1}.xml`, enc(`<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`)]);
  });
  const locals = [];
  const centrals = [];
  let off = 0;
  for (const [name, data] of files) {
    const n = enc(name);
    const crc = crc32(data);
    const loc = catBytes([
      enc('PK\x03\x04'), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(n.length), u16(0), n, data
    ]);
    locals.push(loc);
    centrals.push(catBytes([
      enc('PK\x01\x02'), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(n.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off), n
    ]));
    off += loc.length;
  }
  const central = catBytes(centrals);
  const end = catBytes([
    enc('PK\x05\x06'), u16(0), u16(0), u16(files.length), u16(files.length), u32(central.length), u32(off), u16(0)
  ]);
  const blob = new Blob([catBytes([...locals, central, end])], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

window.dlXlsx = () => {
  const partRows = [['分類', '小分類', '名前', '本文']];
  for (const p of allParts()) partRows.push([p.cat, p.sub, p.label, p.text]);
  const poseRows = [['タイトル', '分類', '分類グループ', '人数', '画像向き', '本文', 'ズーム', 'セリフ', '顔の向き', '視線', '表情']];
  for (const p of (catalog().poses || [])) poseRows.push([p.title, p.cat, p.catGroup, p.people, p.orient, p.body, p.zoom, p.line, (p.rec && p.rec.face) || '', (p.rec && p.rec.gaze) || '', (p.rec && p.rec.expr) || '']);
  const setRows = [['種類', '名前', '部品']];
  for (const [k, arr] of Object.entries(catalog().sets || {})) {
    for (const s of arr || []) setRows.push([k, s.label, (s.items || []).join('、')]);
  }
  xlsxDownload('プロンプト部品.xlsx', [
    { name: '部品', rows: partRows },
    { name: 'ポーズ', rows: poseRows },
    { name: 'セット', rows: setRows }
  ]);
  status('エクセルをダウンロードしたよ', true);
};

function render() {
  renderNav();
  const app = $('app');
  if (tab === 'make') app.innerHTML = renderMake();
  else if (tab === 'fav') app.innerHTML = renderList('fav');
  else if (tab === 'hist') app.innerHTML = renderList('hist');
  else if (tab === 'parts') app.innerHTML = renderParts();
  else app.innerHTML = renderIo();
}

async function boot(manual) {
  status('読み込み中…');
  try {
    const cached = LS.get('pr_parts', null);
    if (cached && !D) D = cached;
    U = LS.get('pr_user', null) || U;
    if (tok()) await loadRemote();
    else if (!D) { tab = 'io'; }
    status(tok() ? '読み込んだよ' : (D ? 'この端末のキャッシュで表示中' : 'トークンを入れてね'), !!D);
    render();
  } catch (e) {
    const cached = LS.get('pr_parts', null);
    if (cached) D = cached;
    status(String(e.message || e), false);
    if (!D) tab = 'io';
    render();
  }
}

window.boot = boot;
window.saveUser = saveUser;
addEventListener('DOMContentLoaded', () => boot(false));
})();
