/* プロンプト作成 r279 */
(() => {
const API = 'https://api.github.com/repos/pokoden/slot-data/contents/';
const PARTS_PATH = 'prompt/parts.json';
const USER_PATH = 'prompt/user.json';
const DEFAULT_FIXED = '肌はなめらかなマット、テカリは無い。、目に涙は無い。女性は高身長で成熟した大人の体つき、上品で妖艶な大人の雰囲気。滑らかな肌質、綺麗な肌質、肌に凹凸や線は無し、影による肌の表現はしないでください。全身の肌の影を全部消す、全身の毛穴や影の線が一切ないツルンツルンな綺麗な肌、';
const FIXED_PRESETS = [
  { label: '固定', text: DEFAULT_FIXED },
  { label: '普通', text: '平面な2Dアニメイラスト、肌はなめらかなマット、テカリは無い。、目に涙は無い。女性は高身長で成熟した大人の体つき、上品で妖艶な大人の雰囲気。滑らかな肌質、綺麗な肌質、肌に凹凸や線は無し、影による肌の表現はしないでください。全身の肌の影を全部消す、全身の毛穴や影の線が一切ないツルンツルンな綺麗な肌、' },
  { label: '大人顔', text: '平面な2Dアニメイラスト、女性の顔は切れ長の目、通った鼻筋、シャープな顎のライン、頬はふっくらしすぎない。目に涙は無い。女性は高身長で成熟した大人の体つき、上品で妖艶な大人の雰囲気、滑らかな肌質、綺麗な肌質、肌に凹凸や線は無し、影による肌の表現はしないでください。全身の肌の影を全部消す、全身の毛穴や影の線が一切ないツルンツルンな綺麗な肌、' },
  { label: '大人顔のみ', text: '女性の顔は切れ長の目、通った鼻筋、シャープな顎のライン、頬はふっくらしすぎない。目に涙は無い。女性は高身長で成熟した大人の体つき、上品で妖艶な大人の雰囲気、滑らかな肌質、綺麗な肌質、肌に凹凸や線は無し、影による肌の表現はしないでください。全身の肌の影を全部消す、全身の毛穴や影の線が一切ないツルンツルンな綺麗な肌、' }
];
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tok = () => LS.get('v2_token', '') || '';
const uid = () => 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
const now = () => new Date().toISOString();

const TABS = [['make', '作成'], ['look', '確認'], ['fav', 'お気に入り'], ['hist', '履歴'], ['parts', '部品'], ['io', '取込']];
let tab = LS.get('pr_tab', 'make');
let D = null, U = emptyUser(), sha = { parts: null, user: null };
let dirty = false, saveT = 0;
let filt = { q: '', facing: '', posture: '', act: '' };
let lookQ = '';
let st = blankState();

function emptyUser() {
  return { v: 1, updatedAt: '', fav: [], hist: [], order: [], partOrder: {}, partsExtra: [], partsEdit: {}, partsDelete: [], fixedText: DEFAULT_FIXED };
}
function blankState() {
  return { open: 'pose', sel: {}, custom: {}, showFull: false, outputEdit: null, lookQ: '' };
}
function status(msg, ok) {
  const el = $('st');
  if (!el) return;
  el.textContent = msg || '';
  el.className = ok === false ? 'ng' : ok ? 'ok' : '';
  el.style.padding = msg ? '6px 4px' : '0';
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
function mergeUser(a, b) {
  const out = emptyUser();
  const later = (!a ? b : !b ? a : ((a.updatedAt || '') >= (b.updatedAt || '') ? a : b)) || emptyUser();
  Object.assign(out, later);
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
  if (!out.fixedText) out.fixedText = DEFAULT_FIXED;
  return out;
}

async function loadRemote() {
  if (!tok()) throw new Error('トークン未設定');
  const [pr, ur] = await Promise.all([gh(PARTS_PATH + '?t=' + Date.now()), gh(USER_PATH + '?t=' + Date.now())]);
  if (pr.status === 401 || pr.status === 403) throw new Error(pr.status === 401 ? 'トークンが違うか期限切れ' : '権限がないか回数制限');
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
    U = LS.get('pr_user', null) || emptyUser();
  } else throw new Error('履歴の読み込みに失敗（' + ur.status + '）');
}
async function saveUser(manual) {
  U.updatedAt = now();
  LS.set('pr_user', U);
  if (!tok()) { if (manual) status('この端末だけに保存したよ', true); return; }
  const payload = { message: 'prompt user sync', content: b64enc(JSON.stringify(U)), sha: sha.user || undefined };
  const r = await gh(USER_PATH, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (r.ok) {
    const j = await r.json();
    sha.user = (j.content && j.content.sha) || j.sha || sha.user;
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

function catalog() { return D || { poses: [], parts: {}, sets: {}, rules: [], order: [] }; }
function allParts() {
  const C = catalog();
  const list = [];
  const del = new Set(U.partsDelete || []);
  const order = (U.order && U.order.length) ? U.order : (C.order || []);
  const cats = [...order, ...Object.keys(C.parts || {})];
  const seen = new Set();
  for (const cat of cats) {
    if (seen.has(cat) || !C.parts[cat]) continue;
    seen.add(cat);
    for (const sub of Object.keys(C.parts[cat])) {
      for (const it of C.parts[cat][sub] || []) {
        if (del.has(it.id)) continue;
        const ed = U.partsEdit && U.partsEdit[it.id];
        list.push(Object.assign({ cat, sub }, it, ed || {}));
      }
    }
  }
  for (const it of (U.partsExtra || [])) if (!del.has(it.id)) list.push(it);
  if (U.partOrder) {
    const ixOf = (cat, sub) => {
      const ids = U.partOrder[cat + '\t' + sub];
      return ids ? new Map(ids.map((id, i) => [id, i])) : null;
    };
    list.sort((a, b) => {
      if (a.cat !== b.cat || a.sub !== b.sub) return 0;
      const ix = ixOf(a.cat, a.sub);
      if (!ix) return 0;
      return (ix.has(a.id) ? ix.get(a.id) : 9999) - (ix.has(b.id) ? ix.get(b.id) : 9999);
    });
  }
  return list;
}
function partById(id) { return allParts().find(p => p.id === id) || null; }
function poseById(id) { return (catalog().poses || []).find(p => p.id === id) || null; }
function peopleNum() {
  const p = st.sel.pose && poseById(st.sel.pose.id);
  const n = p && p.people || '';
  return n === '2人' || n === '3人' ? n : (n && n !== '1人' ? n : '');
}

function stepDefs() {
  const man = !!peopleNum();
  const list = [
    { key: 'pose', title: 'ポーズ', kind: 'pose' },
    { key: 'face', title: '顔の向き・視線', kind: 'select', groups: [['顔の向き・視線'], ['表情パーツ', '視線']] },
    { key: 'hair', title: '髪型', kind: 'select', groups: [['髪型']] },
    { key: 'expr', title: '表情', kind: 'select', groups: [['表情']] },
    { key: 'cl0', title: '服装', kind: 'clothes', slot: 0 },
    { key: 'cl1', title: '服装', kind: 'clothes', slot: 1 },
    { key: 'cl2', title: '服装', kind: 'clothes', slot: 2 },
    { key: 'acc0', title: 'アクセサリー', kind: 'acc', slot: 0 },
    { key: 'acc1', title: 'アクセサリー', kind: 'acc', slot: 1 },
    { key: 'bg', title: '背景セット', kind: 'select', groups: [['背景セット']] },
    { key: 'wall', title: '壁', kind: 'select', groups: [['壁'], ['カーテン'], ['掲示板']] },
    { key: 'floor', title: '床', kind: 'select', groups: [['床']] },
    { key: 'prop0', title: '道具', kind: 'select', groups: [['家具'], ['小道具'], ['水回り設備'], ['拘束器具'], ['乗り物'], ['建物の一部']] },
    { key: 'prop1', title: '道具', kind: 'select', groups: [['家具'], ['小道具'], ['水回り設備'], ['拘束器具'], ['乗り物'], ['建物の一部']] },
    { key: 'light', title: '光と影', kind: 'select', groups: [['照明']] },
    { key: 'size', title: '画像サイズ', kind: 'select', groups: [['画像サイズ']] }
  ];
  if (man) {
    list.push({ key: 'man', title: '男', kind: 'select', groups: [['男']] });
    list.push({ key: 'mancl', title: '男服', kind: 'select', groups: [['男服']] });
  }
  list.push({ key: 'lock', title: '固定文', kind: 'lock' });
  return list;
}
function optionsFor(step) {
  if (step.kind === 'clothes') return clothesOptions(step.slot);
  if (step.kind === 'acc') return groupedOptions([['アクセサリー']]);
  if (step.kind === 'lock') {
    const cur = U.fixedText || DEFAULT_FIXED;
    const list = FIXED_PRESETS.map(p => ({ id: 'preset:' + p.label, label: p.label, text: p.text, group: '固定文' }));
    if (!list.some(p => p.text === cur)) list.unshift({ id: 'preset:設定', label: '設定', text: cur, group: '固定文' });
    return [{ group: '固定文', items: list }];
  }
  if (step.kind === 'select') return groupedOptions(step.groups);
  return [];
}
function groupedOptions(groups) {
  const out = [];
  for (const g of groups) {
    const cat = g[0], sub = g[1];
    const items = allParts().filter(p => p.cat === cat && (!sub || p.sub === sub) && (p.text || p.label) && p.label !== '✖️');
    const buckets = new Map();
    for (const p of items) {
      const gn = sub ? (p.sub || cat) : (p.sub || cat);
      if (!buckets.has(gn)) buckets.set(gn, []);
      buckets.get(gn).push(p);
    }
    for (const [name, arr] of buckets) out.push({ group: name, items: arr });
  }
  return out;
}
function clothesOptions(slot) {
  const used = new Set();
  for (let i = 0; i < 3; i++) {
    if (i === slot) continue;
    const v = st.sel['cl' + i];
    if (v && v.typ && v.typ !== '後付け' && v.typ !== '隠し') used.add(v.typ);
  }
  const groups = [];
  for (const sub of ['下着', '上', '下', 'ワンピ', '水着', '後付け', '隠し', '特殊']) {
    const items = allParts().filter(p => p.cat === '服装' && p.sub === sub);
    const vis = items.filter(p => {
      if (!p.typ || p.typ === '後付け' || p.typ === '隠し') return true;
      return !used.has(p.typ);
    });
    if (vis.length) groups.push({ group: sub, items: vis });
  }
  return groups;
}

function valOf(key) { return st.sel[key] || null; }
function labelOf(key) {
  const v = valOf(key);
  if (!v) return '';
  return v.label || '';
}
function setVal(key, rec) {
  st.sel[key] = rec || null;
  st.outputEdit = null;
}

function textClose(a, b) {
  const n = s => String(s || '').replace(/。+$/, '').trim();
  return n(a) && n(a) === n(b);
}
function faceValFromPose(pose) {
  const rec = pose && pose.rec || {};
  const recTxt = rec.face || rec.gaze || '';
  if (!recTxt) return null;
  const hit = allParts().find(p => (p.cat === '顔の向き・視線' || (p.cat === '表情パーツ' && p.sub === '視線')) && (p.text === recTxt || p.label === recTxt || textClose(p.text, recTxt) || textClose(p.label, recTxt)));
  if (hit) return { id: hit.id, label: hit.label, text: hit.text, typ: hit.typ, cat: hit.cat, sub: hit.sub };
  return { id: 'rec:' + recTxt, label: recTxt.length > 22 ? recTxt.slice(0, 22) + '…' : recTxt, text: recTxt };
}
function findOption(groups, raw) {
  const s = String(raw || '').trim();
  if (!s || s === 'なし') return null;
  for (const g of groups) for (const it of g.items) {
    if (it.label === s || it.id === s) return it;
  }
  return { id: 'custom:' + s, label: s, text: s, custom: true };
}

function faceOptionsPlusRec(groups) {
  const pose = st.sel.pose && poseById(st.sel.pose.id);
  const rec = pose && pose.rec || {};
  const extra = [rec.face, rec.gaze, rec.expr].filter(Boolean);
  const have = new Set();
  for (const g of groups) for (const it of g.items) have.add(it.text);
  const items = [];
  for (const t of extra) {
    if (t && !have.has(t)) {
      const lab = t.length > 22 ? t.slice(0, 22) + '…' : t;
      items.push({ id: 'rec:' + t, label: lab, text: t });
      have.add(t);
    }
  }
  if (items.length) groups = [{ group: 'おすすめ', items }, ...groups];
  return groups;
}

function defaultSizeFor(pose) {
  const want = pose && pose.orient === '横' ? '横16:9' : '縦9:16';
  return allParts().find(p => p.cat === '画像サイズ' && p.label === want) || null;
}

function applyPose(pose) {
  if (!pose) { setVal('pose', null); return; }
  setVal('pose', { id: pose.id, label: pose.title, text: pose.body, zoom: pose.zoom, people: pose.people, orient: pose.orient, line: pose.line });
  const fv = faceValFromPose(pose);
  if (fv) setVal('face', fv);
  const sz = defaultSizeFor(pose);
  if (sz) setVal('size', { id: sz.id, label: sz.label, text: sz.text });
  if (st.sel.lock === undefined) applyPoseLockOnly();
}

function openStep(key) { st.open = key; render(); }
function finishStep(key, rec, advance) {
  setVal(key, rec);
  if (advance !== false) {
    const steps = stepDefs();
    const i = steps.findIndex(s => s.key === key);
    const next = steps[i + 1];
    st.open = next ? next.key : key;
  }
  render();
}

function normalizeFacing(f) {
  if (!f) return '';
  if (f === '真横' || f === '正面寄りの横向き' || f === '横向き') return '横向き';
  if (f === '正面' || f === '正面向き') return '正面向き';
  if (f === '斜め' || f === '斜め向き') return '斜め向き';
  return f;
}
function filterPoses() {
  let list = catalog().poses || [];
  if (filt.q) list = list.filter(p => (p.title || '').includes(filt.q) || (p.cat || '').includes(filt.q));
  if (filt.facing) list = list.filter(p => normalizeFacing(p.facing) === filt.facing);
  if (filt.posture) list = list.filter(p => p.posture === filt.posture);
  if (filt.act) list = list.filter(p => p.catGroup === filt.act);
  return list;
}
function exactPose(title) {
  const t = String(title || '').trim();
  if (!t) return null;
  return (catalog().poses || []).find(p => p.title === t) || null;
}

function assemble() {
  if (st.outputEdit != null) return st.outputEdit;
  const chunks = [];
  for (const s of stepDefs()) {
    const v = valOf(s.key);
    if (v && v.text) chunks.push(v.text);
  }
  return chunks.join('\n');
}
function zoomText() {
  const p = st.sel.pose && poseById(st.sel.pose.id);
  return (p && p.zoom) || '';
}
function snapshot() { return { sel: JSON.parse(JSON.stringify(st.sel)) }; }
function restoreSnap(s) {
  if (!s || !s.sel) return;
  st.sel = JSON.parse(JSON.stringify(s.sel));
  st.outputEdit = null;
  st.open = 'pose';
}

async function copyText(text, title) {
  try { await navigator.clipboard.writeText(text); status('コピーしたよ', true); }
  catch (e) { prompt('長押しでコピーしてね', text); }
  if (title !== false) {
    U.hist.unshift({ id: uid(), at: now(), title: title || (st.sel.pose && st.sel.pose.label) || '（ポーズなし）', text, snap: snapshot() });
    scheduleSave();
  }
}

/* ---------- render ---------- */
window.go = k => { tab = k; LS.set('pr_tab', k); render(); };
window.saveTok = () => {
  const v = ($('tk') && $('tk').value.trim()) || '';
  if (!v) { alert('トークンを入れてね'); return; }
  LS.set('v2_token', v);
  boot(true);
};

function renderNav() {
  $('nav').innerHTML = TABS.map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" onclick="go('${k}')">${n}</button>`).join('');
}

function summaryLine(step) {
  const v = valOf(step.key);
  if (!v) return step.title;
  return step.title + '：' + (v.label || 'なし');
}

function renderSelectBody(step) {
  let groups = optionsFor(step);
  if (step.key === 'face') groups = faceOptionsPlusRec(groups);
  const cur = valOf(step.key);
  const curId = cur ? cur.id : '';
  const hasCur = !!(cur && groups.some(g => g.items.some(it => it.id === curId)));
  if (cur && curId && !hasCur) groups = [{ group: '選択中', items: [cur] }, ...groups];
  const opts = [`<option value="">なし</option>`].concat(groups.map(g => {
    const inn = g.items.map(it => `<option value="${esc(it.id)}" ${it.id === curId ? 'selected' : ''}>${esc(it.label)}</option>`).join('');
    return `<optgroup label="${esc(g.group)}">${inn}</optgroup>`;
  }));
  return `
    <select id="sel_${step.key}" onchange="onSel('${step.key}',this.value)">
      ${opts.join('')}
    </select>
    <div class="row" style="margin-top:8px"><input type="text" id="tx_${step.key}" value="${esc(cur && cur.custom ? cur.label : '')}" placeholder="" onchange="onTyped('${step.key}',this.value)"></div>
    <button class="next" onclick="onNext('${step.key}')">次へ</button>`;
}

function renderPoseBody() {
  const facings = [...new Set((catalog().poses || []).map(p => normalizeFacing(p.facing)).filter(Boolean))];
  const posts = [...new Set((catalog().poses || []).map(p => p.posture).filter(Boolean))].sort();
  const acts = [...new Set((catalog().poses || []).map(p => p.catGroup).filter(Boolean))];
  const list = filterPoses();
  const q = filt.q;
  const exact = exactPose(q);
  const sug = (!exact && q) ? list.slice(0, 8) : [];
  const cur = st.sel.pose && poseById(st.sel.pose.id);
  return `
    <input type="search" id="poseq" value="${esc(filt.q)}" placeholder="タイトル" autocomplete="off" oninput="onPoseQ(this.value)">
    ${sug.length ? `<div class="sug">${sug.map(p => `<button onclick="pickPose('${esc(p.id)}')">${esc(p.title)}</button>`).join('')}</div>` : ''}
    ${cur ? `<div class="prev">${esc(cur.body)}</div>${cur.line ? `<div class="prev">${esc(cur.line)}</div>` : ''}` : ''}
    <div class="chips">
      ${facings.map(f => `<button class="${filt.facing === f ? 'on' : ''}" onclick="togFilt('facing','${esc(f)}')">${esc(f)}</button>`).join('')}
    </div>
    <div class="chips">
      ${posts.map(f => `<button class="${filt.posture === f ? 'on' : ''}" onclick="togFilt('posture','${esc(f)}')">${esc(f)}</button>`).join('')}
    </div>
    <div class="chips">
      ${acts.map(f => `<button class="${filt.act === f ? 'on' : ''}" onclick="togFilt('act','${esc(f)}')">${esc(f)}</button>`).join('')}
    </div>
    <button class="next" onclick="onNext('pose')">次へ</button>`;
}

window.onPoseQ = v => {
  filt.q = v;
  const hit = exactPose(v);
  if (hit) { pickPose(hit.id); return; }
  render();
  const el = $('poseq');
  if (el) { el.focus(); const n = el.value.length; el.setSelectionRange(n, n); }
};
window.togFilt = (k, v) => { filt[k] = filt[k] === v ? '' : v; render(); };
window.pickPose = id => {
  const p = poseById(id);
  if (!p) return;
  filt.q = p.title;
  applyPose(p);
  st.open = 'pose';
  st.outputEdit = null;
  render();
};
window.onSel = (key, id) => {
  if (!id) { finishStep(key, null, true); return; }
  const step = stepDefs().find(s => s.key === key);
  let groups = optionsFor(step);
  if (key === 'face') groups = faceOptionsPlusRec(groups);
  let rec = null;
  for (const g of groups) for (const it of g.items) if (it.id === id) rec = { id: it.id, label: it.label, text: it.text, typ: it.typ, ud: it.ud, cat: it.cat, sub: it.sub };
  finishStep(key, rec, true);
};
window.onTyped = (key, raw) => {
  const s = String(raw || '').trim();
  if (!s) { finishStep(key, null, true); return; }
  const step = stepDefs().find(x => x.key === key);
  let groups = optionsFor(step);
  if (key === 'face') groups = faceOptionsPlusRec(groups);
  const rec = findOption(groups, s);
  finishStep(key, rec, true);
};
window.onNext = key => {
  if (key === 'pose' && !st.sel.pose) { st.open = 'face'; if (!st.sel.lock) applyPoseLockOnly(); render(); return; }
  const steps = stepDefs();
  const i = steps.findIndex(s => s.key === key);
  st.open = steps[i + 1] ? steps[i + 1].key : key;
  render();
};
function applyPoseLockOnly() {
  const fx = U.fixedText || DEFAULT_FIXED;
  const pr = FIXED_PRESETS.find(p => p.text === fx);
  setVal('lock', { id: pr ? 'preset:' + pr.label : 'preset:設定', label: pr ? pr.label : '設定', text: fx });
}

function renderMake() {
  if (!D) return tokenCard();
  if (st.sel.lock === undefined) applyPoseLockOnly();
  const steps = stepDefs();
  return steps.map(s => {
    const open = st.open === s.key;
    const v = valOf(s.key);
    const line = v ? (s.title + '：' + v.label) : s.title;
    return `<div class="step${open ? ' open' : ''}">
      <button class="step-h" onclick="openStep('${s.key}')"><b>${esc(line)}</b></button>
      ${open ? `<div class="step-body">${s.kind === 'pose' ? renderPoseBody() : renderSelectBody(s)}</div>` : ''}
    </div>`;
  }).join('');
}
window.openStep = openStep;

function renderLook() {
  if (!D) return tokenCard();
  const q = lookQ.trim();
  const hits = [];
  if (q) {
    for (const p of (catalog().poses || [])) {
      if ((p.title || '').includes(q) || p.title === q) hits.push({ kind: 'pose', p, label: p.title, exact: p.title === q });
    }
    for (const it of allParts()) {
      if ((it.label || '').includes(q) || it.label === q) hits.push({ kind: 'part', p: it, label: it.label, exact: it.label === q });
    }
    hits.sort((a, b) => (b.exact - a.exact) || a.label.length - b.label.length);
  }
  const top = hits[0];
  const rest = hits.slice(0, 12);
  return `<div class="card">
    <input type="search" id="lookq" value="${esc(lookQ)}" placeholder="タイトル" autocomplete="off" oninput="onLook(this.value)">
  </div>
  <div id="look">${rest.map(h => lookHit(h)).join('') || (q ? '<div class="card">（ない）</div>' : '')}</div>`;
}
function lookHit(h) {
  if (h.kind === 'pose') {
    const p = h.p;
    return `<div class="card hit">
      <b>${esc(p.title)}</b>
      <div>${esc(p.people || '')}　${esc(p.orient || '')}　${esc(p.cat || '')}</div>
      ${p.line ? `<div class="prev">${esc(p.line)}</div>` : ''}
      <div class="prev">${esc(p.body || '')}</div>
      <div class="row">
        <button class="b" onclick="copyLook('pose','${esc(p.id)}')">本文をコピー</button>
        ${p.zoom ? `<button class="sub" onclick="copyLook('zoom','${esc(p.id)}')">ズームをコピー</button>` : ''}
      </div>
    </div>`;
  }
  const p = h.p;
  return `<div class="card hit">
    <b>${esc(p.label)}</b>
    <div>${esc(p.cat)}${p.sub && p.sub !== p.cat ? ' / ' + esc(p.sub) : ''}</div>
    <div class="prev">${esc(p.text || '')}</div>
    <div class="row"><button class="b" onclick="copyLook('part','${esc(p.id)}')">コピー</button></div>
  </div>`;
}
window.onLook = v => { lookQ = v; render(); const el = $('lookq'); if (el) { el.focus(); const n = el.value.length; el.setSelectionRange(n, n); } };
window.copyLook = async (kind, id) => {
  if (kind === 'pose') { const p = poseById(id); if (p) await copyText(p.body || '', false); }
  else if (kind === 'zoom') { const p = poseById(id); if (p) await copyText(p.zoom || '', false); }
  else { const p = partById(id); if (p) await copyText(p.text || '', false); }
};
window.copyRaw = async t => { await copyText(t, false); };

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
  tab = 'make'; LS.set('pr_tab', tab); render();
};
window.delFav = id => { U.fav = (U.fav || []).filter(x => x.id !== id); scheduleSave(); render(); };
window.doFav = () => {
  U.fav.unshift({ id: uid(), at: now(), title: (st.sel.pose && st.sel.pose.label) || '（ポーズなし）', text: assemble(), snap: snapshot() });
  scheduleSave(); status('お気に入りに入れたよ', true); render();
};

function tokenCard() {
  return `<div class="card"><input id="tk" type="password" placeholder="github_pat_..."><div class="row"><button class="b" onclick="saveTok()">保存して読み込む</button></div></div>`;
}

function renderParts() {
  if (!D) return tokenCard();
  const by = new Map();
  for (const p of allParts()) {
    if (!by.has(p.cat)) by.set(p.cat, new Map());
    const sm = by.get(p.cat);
    if (!sm.has(p.sub)) sm.set(p.sub, []);
    sm.get(p.sub).push(p);
  }
  const cats = [...by.keys()];
  let html = `<div class="card">
    <select id="na_cat">${cats.map(c => `<option>${esc(c)}</option>`).join('')}</select>
    <div class="row" style="margin-top:8px"><input id="na_sub" placeholder="小分類"></div>
    <div class="row"><input id="na_lab" placeholder="名前"></div>
    <div class="row"><textarea id="na_tx" placeholder="本文"></textarea></div>
    <div class="row"><button class="b" onclick="addPart()">追加</button></div>
  </div>`;
  for (const cat of cats) {
    const sm = by.get(cat);
    for (const [sub, list] of sm) {
      html += `<div class="card"><b>${esc(cat)} / ${esc(sub)}</b>${list.map((p, i) => `
        <div class="item" style="align-items:flex-start">
          <div style="flex:1"><input value="${esc(p.label)}" onchange="edPart('${esc(p.id)}','label',this.value)"><textarea onchange="edPart('${esc(p.id)}','text',this.value)">${esc(p.text)}</textarea></div>
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
window.addPart = () => {
  const cat = $('na_cat').value.trim();
  const sub = $('na_sub').value.trim() || cat;
  const label = $('na_lab').value.trim();
  const text = $('na_tx').value;
  if (!cat || !label) { alert('分類と名前を入れてね'); return; }
  U.partsExtra.push({ id: uid(), cat, sub, label, text, tags: [] });
  scheduleSave(); render();
};
window.edPart = (id, field, val) => {
  if ((U.partsExtra || []).some(x => x.id === id)) {
    U.partsExtra.find(x => x.id === id)[field] = val;
  } else {
    U.partsEdit[id] = Object.assign({}, U.partsEdit[id] || {}, { [field]: val });
  }
  scheduleSave();
};
window.delPart = id => {
  if (!confirm('この部品を削除する？')) return;
  U.partsExtra = (U.partsExtra || []).filter(x => x.id !== id);
  U.partsDelete = [...new Set([...(U.partsDelete || []), id])];
  scheduleSave(); render();
};
window.movePart = (cat, sub, i, d) => {
  const list = allParts().filter(p => p.cat === cat && p.sub === sub);
  const j = i + d;
  if (j < 0 || j >= list.length) return;
  const ids = list.map(x => x.id);
  const t = ids[i]; ids[i] = ids[j]; ids[j] = t;
  U.partOrder[cat + '\t' + sub] = ids;
  scheduleSave(); render();
};

function renderIo() {
  const fx = U.fixedText || DEFAULT_FIXED;
  return `${!D ? tokenCard() : ''}
  <div class="card">
    <input id="tk" type="password" placeholder="${tok() ? '保存済み（変更時のみ入力）' : 'github_pat_...'}">
    <div class="row"><button class="b" onclick="saveTok()">保存して読み込む</button></div>
  </div>
  <div class="card">
    <b>固定文</b>
    <div class="row">
      <select onchange="setFixedPreset(this.value)">
        ${FIXED_PRESETS.map(p => `<option value="${esc(p.label)}" ${p.text === fx ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}
        <option value="__custom" ${FIXED_PRESETS.every(p => p.text !== fx) ? 'selected' : ''}>直接入力</option>
      </select>
    </div>
    <div class="row"><textarea id="fixedTx" onchange="setFixed(this.value)">${esc(fx)}</textarea></div>
  </div>
  <div class="card">
    <input type="file" id="tsv" accept=".tsv,.txt,text/tab-separated-values" onchange="impTsv(this)">
  </div>
  <div class="card">
    <div class="row">
      <button class="b" onclick="dlXlsx()">エクセルに保存</button>
      <button class="sub" onclick="saveUser(true)">保存</button>
    </div>
  </div>`;
}
window.setFixedPreset = lab => {
  if (lab === '__custom') return;
  const p = FIXED_PRESETS.find(x => x.label === lab);
  if (!p) return;
  U.fixedText = p.text;
  applyPoseLockOnly();
  scheduleSave(); render();
};
window.setFixed = t => { U.fixedText = t; applyPoseLockOnly(); scheduleSave(); };

window.impTsv = async ev => {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  const text = await f.text();
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return;
  const head = lines[0].split('\t').map(s => s.trim());
  const ix = n => head.indexOf(n);
  let nOk = 0;
  const byLabel = new Map(allParts().map(p => [p.cat + '\t' + p.label, p]));
  for (const line of lines.slice(1)) {
    const c = line.split('\t');
    const get = name => { const i = ix(name); return i >= 0 ? (c[i] || '') : ''; };
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
      } else U.partsEdit[exist.id] = Object.assign({}, U.partsEdit[exist.id] || {}, { label, text: body });
    } else {
      const it = { id: uid(), cat, sub, label, text: body, tags: [] };
      U.partsExtra.push(it);
      byLabel.set(cat + '\t' + label, it);
    }
    nOk++;
  }
  scheduleSave(); status(nOk + '件取り込んだよ', true); ev.target.value = ''; render();
};

function xlsxDownload(filename, sheets) {
  function crc32(u) { let c = ~0; for (let i = 0; i < u.length; i++) { c ^= u[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; }
  function u16(n) { return new Uint8Array([n & 255, (n >>> 8) & 255]); }
  function u32(n) { return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]); }
  function enc(s) { return new TextEncoder().encode(s); }
  function catBytes(arr) { const n = arr.reduce((a, b) => a + b.length, 0); const o = new Uint8Array(n); let p = 0; for (const x of arr) { o.set(x, p); p += x.length; } return o; }
  function xmlEsc(s) { return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch])); }
  const files = [];
  files.push(['[Content_Types].xml', enc(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`)]);
  files.push(['_rels/.rels', enc(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`)]);
  files.push(['xl/_rels/workbook.xml.rels', enc(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`)]);
  files.push(['xl/workbook.xml', enc(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEsc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`)]);
  sheets.forEach((s, i) => {
    const rows = s.rows.map((row, r) => {
      const cells = row.map((val, c) => {
        const col = (c >= 26 ? String.fromCharCode(65 + Math.floor(c / 26) - 1) : '') + String.fromCharCode(65 + (c % 26));
        return `<c r="${col}${r + 1}" t="inlineStr"><is><t>${xmlEsc(val)}</t></is></c>`;
      }).join('');
      return `<row r="${r + 1}">${cells}</row>`;
    }).join('');
    files.push([`xl/worksheets/sheet${i + 1}.xml`, enc(`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`)]);
  });
  const locals = [], centrals = []; let off = 0;
  for (const [name, data] of files) {
    const n = enc(name); const crc = crc32(data);
    const loc = catBytes([enc('PK\x03\x04'), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(n.length), u16(0), n, data]);
    locals.push(loc);
    centrals.push(catBytes([enc('PK\x01\x02'), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(n.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off), n]));
    off += loc.length;
  }
  const central = catBytes(centrals);
  const end = catBytes([enc('PK\x05\x06'), u16(0), u16(0), u16(files.length), u16(files.length), u32(central.length), u32(off), u16(0)]);
  const blob = new Blob([catBytes([...locals, central, end])], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
window.dlXlsx = () => {
  const partRows = [['分類', '小分類', '名前', '本文']];
  for (const p of allParts()) partRows.push([p.cat, p.sub, p.label, p.text]);
  const poseRows = [['タイトル', '分類', '分類グループ', '人数', '画像向き', '本文', 'ズーム', 'セリフ', '顔の向き', '視線', '表情']];
  for (const p of (catalog().poses || [])) poseRows.push([p.title, p.cat, p.catGroup, p.people, p.orient, p.body, p.zoom, p.line, (p.rec && p.rec.face) || '', (p.rec && p.rec.gaze) || '', (p.rec && p.rec.expr) || '']);
  const setRows = [['種類', '名前', '部品']];
  for (const [k, arr] of Object.entries(catalog().sets || {})) for (const s of arr || []) setRows.push([k, s.label, (s.items || []).join('、')]);
  xlsxDownload('プロンプト部品.xlsx', [{ name: '部品', rows: partRows }, { name: 'ポーズ', rows: poseRows }, { name: 'セット', rows: setRows }]);
  status('エクセルをダウンロードしたよ', true);
};

function renderDock() {
  const dock = $('dock');
  const sheet = $('sheet');
  if (tab !== 'make' || !D) { dock.hidden = true; sheet.className = ''; sheet.innerHTML = ''; return; }
  dock.hidden = false;
  const text = assemble();
  const z = zoomText();
  const one = text.replace(/\n/g, ' ');
  dock.innerHTML = `<div class="in">
    <div class="pv" id="dockpv">${esc(one)}</div>
    <div class="btns">
      <button class="b" id="btnCopy">コピー</button>
      <button class="sub" id="btnZoom" ${z ? '' : 'disabled'}>ズーム</button>
      <button class="sub" id="btnFav">お気に入り</button>
    </div>
  </div>`;
  $('dockpv').onclick = () => { st.showFull = true; render(); };
  $('btnCopy').onclick = () => copyText(assemble());
  $('btnZoom').onclick = () => { if (z) copyText(z, false); };
  $('btnFav').onclick = () => doFav();
  if (st.showFull) {
    sheet.className = 'on';
    sheet.innerHTML = `<div class="box">
      <textarea id="fullTx">${esc(text)}</textarea>
      <div class="row">
        <button class="b" id="fullCopy">コピー</button>
        <button class="sub" id="fullClose">閉じる</button>
      </div>
    </div>`;
    $('fullTx').oninput = ev => { st.outputEdit = ev.target.value; };
    $('fullCopy').onclick = () => copyText(assemble());
    $('fullClose').onclick = ev => { ev.stopPropagation(); st.showFull = false; render(); };
    sheet.onclick = ev => { if (ev.target === sheet) { st.showFull = false; render(); } };
  } else {
    sheet.className = '';
    sheet.innerHTML = '';
  }
}

let lastOpen = '';
function scrollOpen(force) {
  if (tab !== 'make') { lastOpen = ''; return; }
  if (!force && lastOpen === st.open) return;
  lastOpen = st.open;
  const el = document.querySelector('.step.open');
  if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' });
}
function render() {
  renderNav();
  const app = $('app');
  if (tab === 'make') app.innerHTML = renderMake();
  else if (tab === 'look') app.innerHTML = renderLook();
  else if (tab === 'fav') app.innerHTML = renderList('fav');
  else if (tab === 'hist') app.innerHTML = renderList('hist');
  else if (tab === 'parts') app.innerHTML = renderParts();
  else app.innerHTML = renderIo();
  renderDock();
  scrollOpen(false);
}

async function boot() {
  status('読み込み中…');
  try {
    const cached = LS.get('pr_parts', null);
    if (cached && !D) D = cached;
    U = LS.get('pr_user', null) || U;
    if (!U.fixedText) U.fixedText = DEFAULT_FIXED;
    if (tok()) await loadRemote();
    else if (!D) tab = 'io';
    if (D && !st.sel.lock) applyPoseLockOnly();
    status(tok() ? '読み込んだよ' : (D ? '' : 'トークンを入れてね'), !!D);
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
window.doFav = doFav;
addEventListener('DOMContentLoaded', () => boot());
})();
