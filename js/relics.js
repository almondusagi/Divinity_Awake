/* relics.js — モンドの遺物 (artifacts) (owner: PROGRESSION).
   Save: G.save.data.relics = { unopened:number, owned:[piece], equipped:{slot:id}, nextId, presets:{charId:[preset]} }
   preset = { name, eq:{slot:id}, at }  — 装備プリセット (UI): saved per character, lives in the save (a data reset clears it).
   Loading one equips the pieces that still exist; pieces that were salvaged are reported and that slot keeps what is on.
   piece = { id, slot:'flower'|'plume'|'sands'|'goblet'|'circlet', set, rarity:4|5, main:{k,v}, subs:[{k,v}], lock }
   API: G.relics.open() -> pieces, G.relics.applyMods(S,R), G.relics.renderPanel(container), G.relics.summary() */
'use strict';
G.relics = (function () {
  const U = G.u;
  const SLOTS = [
    { id: 'flower', name: '生の花', glyph: 'flower', mains: ['hp_flat'] },
    { id: 'plume', name: '死の羽', glyph: 'plume', mains: ['atk_flat'] },
    { id: 'sands', name: '時の砂', glyph: 'sands', mains: ['atk_pct', 'atk_pct', 'hp_pct', 'er', 'speed'] },
    { id: 'goblet', name: '空の杯', glyph: 'goblet', mains: ['pyro', 'pyro', 'atk_pct', 'hp_pct', 'def_flat'] },
    { id: 'circlet', name: '理の冠', glyph: 'circlet', mains: ['cr', 'cd', 'atk_pct', 'hp_pct'] },
  ];
  const SLOT = {}; SLOTS.forEach(s => { SLOT[s.id] = s; });
  // name, pct?, main value (★5), substat roll range (★5), score weight
  const ST = {
    hp_flat: { n: 'HP', main: 400, sub: [25, 40], w: 0.25 },
    atk_flat: { n: '攻撃力', main: 40, sub: [3, 5], w: 0.6 },
    def_flat: { n: '防御力', main: 35, sub: [4, 7], w: 0.3 },
    atk_pct: { n: '攻撃力', pct: 1, main: 0.30, sub: [0.041, 0.058], w: 1 },
    hp_pct: { n: 'HP', pct: 1, main: 0.30, sub: [0.041, 0.058], w: 0.4 },
    er: { n: 'チャージ効率', pct: 1, main: 0.35, sub: [0.045, 0.065], w: 0.5 },
    cr: { n: '会心率', pct: 1, main: 0.20, sub: [0.027, 0.039], w: 1 },
    cd: { n: '会心ダメージ', pct: 1, main: 0.40, sub: [0.054, 0.078], w: 1 },
    pyro: { n: '炎元素ダメージ', pct: 1, main: 0.30, sub: null, w: 0.9, own: true }, // key kept for old saves: = the character's OWN element
    speed: { n: '移動速度', pct: 1, main: 0.12, sub: [0.015, 0.025], w: 0.5 },
  };
  const SUBS = ['hp_flat', 'atk_flat', 'def_flat', 'atk_pct', 'hp_pct', 'er', 'cr', 'cd', 'speed'];
  const SETS = {
    wind: { name: '風跡の騎士', c: '#5cf2c8', b2: '攻撃力 +18%', b4: '元素爆発ダメージ +35%' },
    flame: { name: '烈火の狩人', c: '#ff7a3d', b2: '炎元素ダメージ +15%', b4: '爆発範囲 ×1.25・元素反応ダメージ +40%' },
    luck: { name: 'モラ商人の夢', c: '#ffd24a', b2: 'モラ獲得量 +25%', b4: 'レベルアップの選択肢が 4枚 に！' },
  };
  const SET_KEYS = Object.keys(SETS);
  /* the relics follow the character (owner: every character, not just Amber): the goblet's element main stat and
     烈火の狩人 2pc boost the character's OWN element; 4pc bonuses use the generic stats every kit reads. */
  let viewChar = 'amber';
  const elOf = id => ((G.data.characters[id] || {}).element) || 'pyro';
  const elName = id => ((G.EL && G.EL[elOf(id)]) || { name: '炎' }).name;
  function setText(key, which, charId) {
    const id = charId || viewChar;
    if (key === 'flame' && which === 'b2') return elName(id) + '元素ダメージ +15%';
    if (key === 'flame' && which === 'b4') return id === 'amber' ? SETS.flame.b4 : '攻撃範囲 ×1.15・元素反応ダメージ +40%';
    return SETS[key][which];
  }

  function data() {
    const S = G.save.data;
    if (!S.relics || typeof S.relics !== 'object') S.relics = {};
    const r = S.relics;
    if (typeof r.unopened !== 'number' || !(r.unopened >= 0)) r.unopened = 0;
    if (!Array.isArray(r.owned)) r.owned = [];
    if (!r.equipped || typeof r.equipped !== 'object') r.equipped = {};
    r.owned = r.owned.filter(p => p && SLOT[p.slot] && p.main && ST[p.main.k] && Array.isArray(p.subs));
    for (const s in r.equipped) if (!r.owned.some(p => p.id === r.equipped[s])) delete r.equipped[s];
    if (!r.nextId) r.nextId = r.owned.reduce((m, p) => Math.max(m, p.id | 0), 0) + 1;
    return r;
  }
  const byId = id => data().owned.find(p => p.id === id);

  /* ---------------- generation ---------------- */
  function roll(slotId, rarity) {
    const sl = SLOT[slotId], mul = rarity === 5 ? 1 : 0.78;
    const mk = U.pick(sl.mains);
    const piece = { slot: slotId, set: U.pick(SET_KEYS), rarity, main: { k: mk, v: ST[mk].main * mul }, subs: [], lock: false };
    const nSub = rarity === 5 ? (U.chance(0.35) ? 4 : 3) : U.randi(1, 3);
    const pool = SUBS.filter(k => k !== mk);
    U.shuffle(pool);
    for (let i = 0; i < nSub; i++) { const k = pool[i]; piece.subs.push({ k, v: U.rand(ST[k].sub[0], ST[k].sub[1]) * mul }); }
    // bonus upgrade rolls (as if levelled) — the dopamine part
    const extra = rarity === 5 ? U.randi(2, 4) : U.randi(0, 2);
    for (let i = 0; i < extra; i++) { const s = U.pick(piece.subs); s.v += U.rand(ST[s.k].sub[0], ST[s.k].sub[1]) * mul; }
    for (const s of piece.subs) s.v = round(s.k, s.v);
    piece.main.v = round(mk, piece.main.v);
    return piece;
  }
  function round(k, v) { return ST[k].pct ? Math.round(v * 1000) / 1000 : Math.round(v); }
  function score(p) {
    if (!p) return -1;
    let s = (ST[p.main.k].w * p.main.v / (ST[p.main.k].sub ? ST[p.main.k].sub[1] : 0.058)) * 0.5;
    for (const x of p.subs) s += ST[x.k].w * x.v / ST[x.k].sub[1];
    return s + (p.rarity === 5 ? 1 : 0);
  }
  /** open one モンドの遺物: 5 pieces (one per slot), auto-equips improvements. Returns [{piece, equipped, prev}] */
  function open() {
    const r = data(); if (r.unopened <= 0) return null;
    r.unopened--;
    const out = [];
    for (const sl of SLOTS) {
      const p = roll(sl.id, U.chance(0.4) ? 5 : 4); p.id = r.nextId++; r.owned.push(p);
      const prev = byId(r.equipped[sl.id]);
      const better = !prev || score(p) > score(prev);
      if (better) r.equipped[sl.id] = p.id;
      out.push({ piece: p, equipped: better, prev: prev || null });
    }
    G.save.write();
    return out;
  }

  /* ---------------- 装備プリセット (per character) ---------------- */
  const MAX_PRE = 8;
  const SET_SHORT = { wind: '風跡', flame: '烈火', luck: 'モラ商人' };
  function presetsOf(charId) {
    const r = data();
    if (!r.presets || typeof r.presets !== 'object' || Array.isArray(r.presets)) r.presets = {};
    if (!Array.isArray(r.presets[charId])) r.presets[charId] = [];
    const l = r.presets[charId];
    for (let i = l.length - 1; i >= 0; i--) if (!l[i] || !l[i].eq || typeof l[i].eq !== 'object') l.splice(i, 1);   // in place: callers keep the array
    return l;
  }
  /** per slot: { slot, id, piece, state: 'ok' | 'miss' (salvaged) | 'none' (the preset keeps that slot empty) } */
  function presetSlots(p) {
    return SLOTS.map(sl => {
      const id = p.eq[sl.id]; if (id == null) return { slot: sl.id, state: 'none', piece: null };
      const pc = byId(id); return { slot: sl.id, id, piece: pc || null, state: pc ? 'ok' : 'miss' };
    });
  }
  const presetIsCurrent = p => { const e = data().equipped; return SLOTS.every(sl => (p.eq[sl.id] == null ? null : p.eq[sl.id]) === (e[sl.id] == null ? null : e[sl.id])); };
  function autoPresetName(charId, eq) {
    const n = {}; for (const s in eq) { const pc = byId(eq[s]); if (pc) n[pc.set] = (n[pc.set] || 0) + 1; }
    const ks = Object.keys(n).sort((a, b) => n[b] - n[a]);
    let base = ks.length ? ks.map(k => (SET_SHORT[k] || SETS[k].name) + n[k]).join('・') : 'プリセット';
    const names = presetsOf(charId).map(p => p.name);
    if (!names.includes(base)) return base;
    for (let i = 2; ; i++) if (!names.includes(base + ' (' + i + ')')) return base + ' (' + i + ')';
  }
  function savePreset(charId, idx) {
    const list = presetsOf(charId), eq = Object.assign({}, data().equipped);
    if (idx != null && list[idx]) list[idx] = { name: list[idx].name, eq, at: Date.now() };
    else { if (list.length >= MAX_PRE) return null; list.push({ name: autoPresetName(charId, eq), eq, at: Date.now() }); idx = list.length - 1; }
    G.save.write(); return idx;
  }
  /** equips a preset: returns { equipped:[slot], missing:[slot], cleared:[slot] } */
  function applyPreset(charId, idx) {
    const p = presetsOf(charId)[idx]; if (!p) return null;
    const r = data(), out = { equipped: [], missing: [], cleared: [] };
    for (const sl of SLOTS) {
      const id = p.eq[sl.id];
      if (id == null) { if (r.equipped[sl.id] != null) out.cleared.push(sl.id); delete r.equipped[sl.id]; }
      else if (byId(id)) { r.equipped[sl.id] = id; out.equipped.push(sl.id); }
      else out.missing.push(sl.id);                  // salvaged: keep what is equipped there now
    }
    G.save.write(); return out;
  }
  function renamePreset(charId, idx, name) {
    const p = presetsOf(charId)[idx]; name = String(name || '').trim().slice(0, 20);
    if (!p || !name) return false; p.name = name; G.save.write(); return true;
  }
  function deletePreset(charId, idx) { const l = presetsOf(charId); if (!l[idx]) return false; l.splice(idx, 1); G.save.write(); return true; }

  /* ---------------- stats ---------------- */
  function totals() {
    const r = data(), t = {}, sets = {};
    for (const sl of SLOTS) {
      const p = byId(r.equipped[sl.id]); if (!p) continue;
      t[p.main.k] = (t[p.main.k] || 0) + p.main.v;
      for (const s of p.subs) t[s.k] = (t[s.k] || 0) + s.v;
      sets[p.set] = (sets[p.set] || 0) + 1;
    }
    return { t, sets };
  }
  function applyMods(S, R) {
    const { t, sets } = totals();
    S.atk = (S.atk + (t.atk_flat || 0)) * (1 + (t.atk_pct || 0));
    S.maxHp = (S.maxHp + (t.hp_flat || 0)) * (1 + (t.hp_pct || 0));
    S.def += t.def_flat || 0;
    S.recharge += t.er || 0;
    S.critRate += t.cr || 0;
    S.critDmg += t.cd || 0;
    S.speed *= 1 + (t.speed || 0);
    const own = (R && R.char && R.char.element) || 'pyro';
    if (t.pyro) S.elBonus[own] = (S.elBonus[own] || 0) + t.pyro;
    if (sets.wind >= 2) S.atk *= 1.18;
    if (sets.wind >= 4) S.burstBonus = (S.burstBonus || 0) + 0.35; // 元素爆発ダメージ +35% (every kit reads burstBonus)
    if (sets.flame >= 2) S.elBonus[own] = (S.elBonus[own] || 0) + 0.15;
    if (sets.flame >= 4) { if (R && R.charId === 'amber') S.explosionMul *= 1.25; else S.areaMul *= 1.15; S.reactionBonus += 0.4; }
    if (sets.luck >= 2) S.moraMul *= 1.25;
    if (sets.luck >= 4) S.offerCount = 4;
    S.relicSets = sets;
  }
  const fmt = (k, v) => ST[k].pct ? '+' + (Math.round(v * 1000) / 10) + '%' : '+' + Math.round(v);
  const label = (k, v) => (ST[k].own ? elName(viewChar) + '元素ダメージ' : ST[k].n) + ' ' + fmt(k, v);

  function summary() {
    const { t, sets } = totals();
    return { stats: Object.keys(t).map(k => ({ k, name: ST[k].n, text: label(k, t[k]) })), sets: Object.keys(sets).map(s => ({ key: s, name: SETS[s].name, count: sets[s], b2: setText(s, 'b2'), b4: setText(s, 'b4') })) };
  }

  /* ---------------- panel ---------------- */
  function renderPanel(container, charId) {
    const UI = G.progressionUI; UI.ensureCss();
    viewChar = (charId && G.data.characters[charId]) ? charId : ((G.save.data.uiSel && G.save.data.uiSel.char) || 'amber');
    const ch = G.data.characters[viewChar] || G.data.characters.amber, elc = ((G.EL && G.EL[ch.element]) || {}).color || '#ff7a3d';
    const glyph = UI.glyph;
    container.innerHTML = '';
    const root = document.createElement('div'); root.className = 'pg-panel pg-relicp'; root.style.position = 'relative';
    container.append(root);
    function pieceTile(p, o) {
      o = o || {};
      const b = document.createElement('button');
      if (!p) { b.className = 'pg-rp empty'; b.innerHTML = `<div class="pg-rg">${glyph(SLOT[o.slot].glyph)}</div><div class="pg-rs">${SLOT[o.slot].name}</div><div class="pg-rs" style="color:#fff6">なし</div>`; return b; }
      b.className = 'pg-rp r' + p.rarity;
      b.innerHTML = `${p.lock ? `<span class="pg-rl">${glyph('lock')}</span>` : ''}${o.eq ? '<span class="pg-req">装備</span>' : ''}
        <div class="pg-rg" style="color:${SETS[p.set].c}">${glyph(SLOT[p.slot].glyph)}</div>${UI.stars(p.rarity)}
        <div class="pg-rs">${o.full ? SLOT[p.slot].name : ''}${o.full ? '<br>' : ''}${label(p.main.k, p.main.v)}</div>`;
      b.addEventListener('click', () => detail(p));
      if (G.inspect) G.inspect.bindHold(b, () => zoomPiece(p, b));
      return b;
    }
    /* 拡大ビューア: equipped + owned pieces, ←/→ through them */
    function pieceOpts(p) {
      const I = G.inspect, r = data(), eqd = r.equipped[p.slot] === p.id;
      return { html: `<div class="insp-rg" style="color:${SETS[p.set].c}">${glyph(SLOT[p.slot].glyph)}</div>`, title: SLOT[p.slot].name, color: SETS[p.set].c,
        sub: SETS[p.set].name + ' ' + UI.stars(p.rarity), lv: label(p.main.k, p.main.v), lvMax: p.rarity >= 5,
        body: (eqd ? I.sec('', '<b>✔ 装備中</b>' + (p.lock ? '　🔒 ロック' : '')) : p.lock ? I.sec('', '🔒 ロック中') : '')
          + I.sec('サブステータス', p.subs.map(x => label(x.k, x.v)).join('<br>') || 'なし')
          + I.sec(SETS[p.set].name, '2セット: ' + setText(p.set, 'b2') + '<br>4セット: ' + setText(p.set, 'b4') + '<small>' + ch.name + 'のときの効果</small>') };
    }
    function zoomPiece(p, from) {
      const r = data(), eqIds = new Set(Object.values(r.equipped));
      const list = r.owned.slice().sort((a, b) => (eqIds.has(b.id) - eqIds.has(a.id)) || (b.rarity - a.rarity) || (score(b) - score(a)));
      const i = Math.max(0, list.indexOf(p));
      G.inspect.open({ index: i, from, list: list.map(x => () => Object.assign(pieceOpts(x), { from: x === p ? from : null })) });
    }
    function draw() {
      const r = data(), sm = summary();
      const eqIds = new Set(Object.values(r.equipped));
      root.innerHTML = `<div class="pg-ph"><h3>モンドの遺物 <small class="pg-rwho" style="--c:${elc}"><img src="assets/icon_${ch.portrait || ch.id}.webp" alt="">${ch.name}のときの効果</small></h3><span class="pg-purse"><img src="assets/icon_mora.webp" alt="">${U.fmtNum(G.save.data.mora || 0)}</span></div>
        <div class="pg-rtop"><div class="pg-rbox${r.unopened ? ' has' : ''}"><img src="assets/icon_relic.webp" alt=""><div><b>未開封 ×${r.unopened}</b><small>ボスをたおすと手に入る</small><br>
        <button class="pg-btn gold pg-open" ${r.unopened ? '' : 'disabled'} style="margin-top:4px">開く！</button></div></div>
        <div class="pg-rsum">${sm.stats.length ? sm.stats.map(s => `<span class="pg-chip">${s.text}</span>`).join('') : '<span class="pg-chip off">まだ装備なし</span>'}
        ${sm.sets.map(s => `<span class="pg-chip set${s.count >= 2 ? '' : ' off'}" style="border-color:${SETS[s.key].c}">${s.name} ${s.count}/4 ${s.count >= 2 ? '・' + s.b2 : ''}${s.count >= 4 ? '・' + s.b4 : ''}</span>`).join('')}</div></div>
        <div class="pg-eq"></div><div class="pg-pre"></div><div class="pg-ph" style="margin-top:4px"><h3 style="font-size:15px">持っている遺物 (${r.owned.length})</h3>
        <button class="pg-btn pg-salv" style="font-size:13px;min-height:32px;padding:3px 12px">★4をまとめて分解</button></div><div class="pg-inv"></div>`;
      const eq = root.querySelector('.pg-eq');
      for (const sl of SLOTS) eq.append(pieceTile(byId(r.equipped[sl.id]), { slot: sl.id, eq: true, full: true }));
      const inv = root.querySelector('.pg-inv');
      const list = r.owned.slice().sort((a, b) => (eqIds.has(b.id) - eqIds.has(a.id)) || (b.rarity - a.rarity) || (score(b) - score(a)));
      if (!list.length) inv.innerHTML = '<div class="pg-empty">遺物はまだありません。遺跡守衛やウェンティをたおそう！</div>';
      for (const p of list) inv.append(pieceTile(p, { eq: eqIds.has(p.id) }));
      drawPresets(root.querySelector('.pg-pre'));
      root.querySelector('.pg-open').addEventListener('click', openAnim);
      if (G.inspect) { const bi = root.querySelector('.pg-rbox img'); G.inspect.bindTap(bi, () => G.inspect.open({ from: bi, img: 'assets/icon_relic.webp', title: 'モンドの遺物', sub: '未開封 ×' + r.unopened, color: '#9fe8c8',
        body: G.inspect.sec('', 'ボスをたおすと 手に入る。「開く！」で 中身がわかるよ') + G.inspect.sec('部位', SLOTS.map(x => x.name).join('・')) }), '大きく見る'); }
      root.querySelector('.pg-salv').addEventListener('click', () => {
        const n = salvageMany(p => p.rarity === 4 && !p.lock && !eqIds.has(p.id));
        if (!n) { G.audio.sfx('denied'); return; }
        G.audio.sfx('mora'); draw(); G.bus.emit('moraChange', G.save.data.mora);
      });
    }
    /* ---- 装備プリセット: tap a card to pick it → 装備する / 上書き保存 / 名前を変える / 削除 ---- */
    let selPre = -1, renPre = -1, pmsg = null;
    const slotNames = ids => ids.map(s => SLOT[s].name).join('・');
    function say(text, bad) { pmsg = { text, bad, t: Date.now() }; }
    function drawPresets(host) {
      if (!host) return;
      const list = presetsOf(viewChar), r = data(), nEq = Object.keys(r.equipped).length;
      if (selPre >= list.length) selPre = -1;
      host.innerHTML = `<div class="pg-pre-h"><h4>装備プリセット<small>${ch.name}用 ${list.length}/${MAX_PRE}</small></h4><span class="sp"></span>
        <button class="pg-btn gold pg-psave" ${list.length >= MAX_PRE || !nEq ? 'disabled' : ''}>＋ 今の装備を保存</button></div><div class="pg-plist"></div><div class="pg-pacts"></div>`;
      const pl = host.querySelector('.pg-plist'), acts = host.querySelector('.pg-pacts');
      if (!list.length) pl.innerHTML = `<div class="pg-pempty">${nEq ? 'いまの装備の組み合わせに 名前をつけて保存できます（' + ch.name + 'ごと）。' : '遺物を装備すると、その組み合わせを保存できます。'}</div>`;
      list.forEach((p, i) => {
        const st = presetSlots(p), miss = st.filter(x => x.state === 'miss').length, cur = presetIsCurrent(p);
        const c = document.createElement('div');
        c.className = 'pg-pc' + (i === selPre ? ' sel' : '') + (cur ? ' cur' : ''); c.dataset.i = i;
        c.setAttribute('role', 'button'); c.tabIndex = 0; c.title = 'タップでえらぶ・長押し / 右クリックで中身を見る';
        const glyphs = st.map(x => x.piece ? `<i class="r${x.piece.rarity}" style="--c:${SETS[x.piece.set].c}" title="${SLOT[x.slot].name}">${glyph(SLOT[x.slot].glyph)}</i>`
          : `<i class="${x.state}" title="${SLOT[x.slot].name}${x.state === 'miss' ? '（見つからない）' : '（なし）'}">${glyph(SLOT[x.slot].glyph)}</i>`).join('');
        c.innerHTML = (i === renPre ? '' : `<div class="pg-pn"></div>`) + `<div class="pg-pg">${glyphs}</div>`
          + `<div class="pg-pm${miss ? ' bad' : ''}">${miss ? '✕ ' + miss + '個 見つからない' : st.filter(x => x.piece).length + '部位' + (cur ? '・いまの装備' : '')}</div>`;
        if (i === renPre) {
          const inp = document.createElement('input'); inp.className = 'pg-pin'; inp.type = 'text'; inp.value = p.name; inp.maxLength = 20;
          inp.setAttribute('enterkeyhint', 'done'); inp.setAttribute('aria-label', 'プリセットの名前');
          let done = false;
          const commit = ok => { if (done) return; done = true; renPre = -1; if (ok && inp.value.trim() && inp.value.trim() !== p.name) { renamePreset(viewChar, i, inp.value); say('名前を「' + p.name + '」に変えた'); } G.audio.sfx('ui'); draw(); };
          inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); commit(true); } else if (e.key === 'Escape') { e.preventDefault(); commit(false); } });
          inp.addEventListener('blur', () => setTimeout(() => commit(true), 0));
          ['click', 'pointerdown'].forEach(ev => inp.addEventListener(ev, e => e.stopPropagation()));
          c.prepend(inp);
        } else c.querySelector('.pg-pn').textContent = p.name;
        c.addEventListener('click', () => { if (i === renPre) return; G.audio.sfx('ui'); selPre = selPre === i ? -1 : i; pmsg = null; draw(); });
        c.addEventListener('keydown', e => { if (e.target === c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); c.click(); } });
        if (G.inspect) G.inspect.bindHold(c, () => zoomPreset(i, c));
        pl.append(c);
      });
      const btn = (label, cls, fn, dis) => { const b = document.createElement('button'); b.className = 'pg-btn ' + (cls || ''); b.innerHTML = label; if (dis) b.disabled = true; b.addEventListener('click', fn); acts.append(b); return b; };
      const p = list[selPre];
      if (p) {
        btn('装備する', 'gold pa-eq', () => {
          const res = applyPreset(viewChar, selPre); if (!res) return;
          G.audio.sfx(res.equipped.length ? 'relic' : 'denied');
          say(res.missing.length ? '「' + p.name + '」を装備（' + res.equipped.length + '部位）。✕ 見つからない: ' + slotNames(res.missing) + ' — 分解ずみ？ そこは いまの装備のまま'
            : '「' + p.name + '」を装備した！', res.missing.length > 0);
          draw();
        }, presetIsCurrent(p));
        btn('上書き保存', 'pa-over', () => ask('プリセットを上書き', '「' + p.name + '」を いまの装備で上書きします。', '上書きする', () => { savePreset(viewChar, selPre); G.audio.sfx('relic'); say('「' + p.name + '」を いまの装備で上書きした'); draw(); }), !nEq);
        btn('名前変更', 'pa-ren', () => { renPre = selPre; draw(); const n = root.querySelector('.pg-pin'); if (n) { try { n.focus({ preventScroll: true }); n.select(); } catch (e) { } } });
        btn('削除', 'danger pa-del', () => ask('プリセットを削除', '「' + p.name + '」を削除します。遺物そのものは なくなりません。', '削除する', () => { deletePreset(viewChar, selPre); selPre = -1; G.audio.sfx('ui'); say('「' + p.name + '」を削除した'); draw(); }, true));
      } else if (list.length) acts.innerHTML = '<div class="pg-pempty">プリセットをタップして えらぶ（長押しで 中身を見る）</div>';
      if (pmsg && Date.now() - pmsg.t < 6000) { const m = document.createElement('div'); m.className = 'pg-pmsg' + (pmsg.bad ? ' bad' : ''); m.textContent = pmsg.text; host.append(m); }
      host.querySelector('.pg-psave').addEventListener('click', () => {
        const i = savePreset(viewChar); if (i == null) { G.audio.sfx('denied'); return; }
        G.audio.sfx('relic'); selPre = i; say('「' + presetsOf(viewChar)[i].name + '」として保存した（名前は「名前を変える」で変更）'); draw();
      });
    }
    function ask(title, text, okLabel, onOk, danger) {
      const ov = document.createElement('div'); ov.className = 'pg-rdet pg-ask';
      ov.innerHTML = `<div class="pg-rcard${danger ? ' danger' : ''}" role="dialog" aria-modal="true"><h4></h4><p></p><div class="pg-racts"><button class="pg-btn a-no">やめる</button><button class="pg-btn ${danger ? 'danger' : 'gold'} a-ok"></button></div></div>`;
      ov.querySelector('h4').textContent = (danger ? '⚠ ' : '') + title; ov.querySelector('p').textContent = text; ov.querySelector('.a-ok').textContent = okLabel;
      const shut = () => { ov.remove(); removeEventListener('keydown', onKey, true); };
      const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); shut(); } };
      addEventListener('keydown', onKey, true);
      ov.addEventListener('click', e => { if (e.target === ov) shut(); });
      ov.querySelector('.a-no').addEventListener('click', () => { G.audio.sfx('ui'); shut(); });
      ov.querySelector('.a-ok').addEventListener('click', () => { shut(); onOk(); });
      document.body.append(ov);
      try { ov.querySelector('.a-ok').focus({ preventScroll: true }); } catch (e) { }
    }
    function presetOpts(i) {
      const I = G.inspect, p = presetsOf(viewChar)[i]; if (!p) return { title: '？' };
      const st = presetSlots(p), n = {};
      st.forEach(x => { if (x.piece) n[x.piece.set] = (n[x.piece.set] || 0) + 1; });
      const lines = st.map(x => `<b>${SLOT[x.slot].name}</b>　` + (x.piece ? `<span style="color:${SETS[x.piece.set].c}">${SETS[x.piece.set].name}</span> ${'★'.repeat(x.piece.rarity)}　${label(x.piece.main.k, x.piece.main.v)}`
        : x.state === 'miss' ? '<span style="color:#ff9a8a">✕ 見つからない（分解ずみ）</span>' : '<span style="opacity:.6">（なし）</span>')).join('<br>');
      const sets = Object.keys(n).map(k => `${SETS[k].name} ${n[k]}/4` + (n[k] >= 2 ? '：' + setText(k, 'b2') : '') + (n[k] >= 4 ? '・' + setText(k, 'b4') : '')).join('<br>');
      const first = st.find(x => x.piece);
      return { html: `<div class="insp-rg" style="color:${first ? SETS[first.piece.set].c : '#9fe8c8'}">${glyph(first ? SLOT[first.slot].glyph : 'flower')}</div>`, color: first ? SETS[first.piece.set].c : '#9fe8c8',
        title: p.name, sub: ch.name + 'の 装備プリセット', lv: presetIsCurrent(p) ? '✔ 装備中' : '',
        body: I.sec('部位', lines) + (sets ? I.sec('セット効果（' + ch.name + '）', sets) : '') };
    }
    function zoomPreset(i, from) {
      const l = presetsOf(viewChar), cards = [...root.querySelectorAll('.pg-pc')];
      G.inspect.open({ index: i, from, list: l.map((_, j) => () => Object.assign(presetOpts(j), { from: cards[j] || null })) });
    }
    function salvageMany(f) {
      const r = data(); let got = 0, n = 0;
      r.owned = r.owned.filter(p => { if (f(p)) { got += p.rarity === 5 ? 120 : 40; n++; return false; } return true; });
      if (n) { G.save.data.mora = (G.save.data.mora || 0) + got; G.save.write(); }
      return n;
    }
    function detail(p) {
      const r = data(), eqd = r.equipped[p.slot] === p.id, cur = byId(r.equipped[p.slot]);
      const d = score(p) - score(cur);
      const ov = document.createElement('div'); ov.className = 'pg-rdet';
      ov.innerHTML = `<div class="pg-rcard r${p.rarity}"><div class="pg-rtop2"><div class="pg-rg" style="color:${SETS[p.set].c}">${glyph(SLOT[p.slot].glyph)}</div>
        <div><h4>${SLOT[p.slot].name}</h4>${UI.stars(p.rarity)}<div class="pg-rmain">${label(p.main.k, p.main.v)}</div></div></div>
        <ul>${p.subs.map(s => `<li>${label(s.k, s.v)}</li>`).join('')}</ul>
        <div class="pg-rset"><b style="color:${SETS[p.set].c}">${SETS[p.set].name}</b><br>2セット: ${setText(p.set, 'b2')}<br>4セット: ${setText(p.set, 'b4')}</div>
        ${!eqd && cur ? `<div class="pg-cmp ${d >= 0 ? 'up' : 'down'}">いまの装備より ${d >= 0 ? 'つよい ▲' : 'よわい ▼'}</div>` : ''}
        <div class="pg-racts"><button class="pg-btn gold a-eq" ${eqd ? 'disabled' : ''}>${eqd ? '装備中' : '装備する'}</button>
        <button class="pg-btn a-lock">${glyph('lock')} ${p.lock ? 'ロック解除' : 'ロック'}</button>
        <button class="pg-btn a-salv" ${p.lock || eqd ? 'disabled' : ''}>分解 +${p.rarity === 5 ? 120 : 40}</button>
        <button class="pg-btn a-x">とじる</button></div></div>`;
      const shut = () => ov.remove();
      if (G.inspect) { const rg = ov.querySelector('.pg-rtop2 .pg-rg'); G.inspect.bindTap(rg, () => zoomPiece(p, rg), '大きく見る'); G.inspect.lens(rg, () => zoomPiece(p, rg)); }
      ov.addEventListener('click', e => { if (e.target === ov) shut(); });
      ov.querySelector('.a-x').addEventListener('click', () => { G.audio.sfx('ui'); shut(); });
      ov.querySelector('.a-eq').addEventListener('click', () => { r.equipped[p.slot] = p.id; G.save.write(); G.audio.sfx('relic'); shut(); draw(); });
      ov.querySelector('.a-lock').addEventListener('click', () => { p.lock = !p.lock; G.save.write(); G.audio.sfx('ui'); shut(); draw(); detail(p); });
      ov.querySelector('.a-salv').addEventListener('click', () => { salvageMany(x => x.id === p.id); G.audio.sfx('mora'); shut(); draw(); G.bus.emit('moraChange', G.save.data.mora); });
      document.body.append(ov);
    }
    function openAnim() {
      const res = open(); if (!res) { G.audio.sfx('denied'); return; }
      draw();
      const best = res.reduce((m, x) => Math.max(m, x.piece.rarity), 4);
      const RC = UI.RC;
      const ov = document.createElement('div'); ov.className = 'pg-ov pg-chest'; ov.style.position = 'fixed'; ov.style.zIndex = 1000;
      ov.style.setProperty('--tc', '#9fe8c8'); ov.style.setProperty('--mc', RC[best]);
      ov.innerHTML = `<div class="pg-sky"></div><div class="pg-tier">モンドの遺物</div><div class="pg-skip">タップでスキップ ▶▶</div>
        <div class="pg-box"><img src="assets/icon_relic.webp" alt=""></div><div class="pg-reveal" style="display:none"></div>
        <div class="pg-close"><button class="pg-btn gold">OK！</button></div>`;
      document.body.append(ov);
      const reveal = ov.querySelector('.pg-reveal'), box = ov.querySelector('.pg-box');
      const timers = [], at = (ms, f) => timers.push(setTimeout(f, ms));
      let finished = false;
      const slots = res.map(x => {
        const p = x.piece, s = document.createElement('div'); s.className = 'pg-slot'; s.style.setProperty('--rc', RC[p.rarity]); s.style.width = 'clamp(92px,16vw,160px)';
        s.innerHTML = `<div class="pg-pillar"></div><div class="pg-card r${p.rarity}" style="min-height:0;height:auto">
          <div class="pg-top" style="height:clamp(70px,16vh,110px)">${x.equipped ? '<span class="pg-new">装備！</span>' : ''}
          <div class="pg-art" style="color:${SETS[p.set].c};font-size:clamp(40px,9vh,70px)">${glyph(SLOT[p.slot].glyph)}</div></div>
          <div class="pg-body">${UI.stars(p.rarity)}<div class="pg-name" style="font-size:clamp(13px,2.6vh,16px)">${SLOT[p.slot].name}</div>
          <div class="pg-desc"><b>${label(p.main.k, p.main.v)}</b><br>${p.subs.map(s => label(s.k, s.v)).join('<br>')}</div></div></div>`;
        reveal.append(s); return s;
      });
      function finish() {
        if (finished) return; finished = true; timers.forEach(clearTimeout);
        box.remove(); ov.querySelectorAll('.pg-meteor,.pg-bloom,.pg-skip').forEach(n => n.remove());
        reveal.style.display = ''; slots.forEach(s => { if (!s.classList.contains('show')) s.classList.add('instant'); });
        ov.querySelector('.pg-close').classList.add('show');
      }
      ov.addEventListener('click', e => { if (!finished) return finish(); ov.remove(); draw(); });
      G.audio.sfx('chestOpen', { tier: 'relic' });
      at(200, () => box.classList.add('shake'));
      at(750, () => { box.classList.add('gone'); const m = document.createElement('div'); m.className = 'pg-meteor'; ov.append(m); G.audio.sfx('star', { rarity: best }); });
      at(1500, () => { ov.querySelectorAll('.pg-meteor').forEach(n => n.remove()); const b = document.createElement('div'); b.className = 'pg-bloom'; ov.append(b); reveal.style.display = ''; });
      res.forEach((x, i) => at(1700 + i * 420, () => { slots[i].classList.add('show'); G.audio.sfx('chestReveal', { rarity: x.piece.rarity }); }));
      at(1700 + res.length * 420 + 200, finish);
    }
    draw();
    return root;
  }

  return { SLOTS, STATS: ST, SETS, data, open, roll, score, applyMods, totals, summary, renderPanel, label,
    presetsOf, presetSlots, savePreset, applyPreset, renamePreset, deletePreset, MAX_PRESETS: MAX_PRE };
})();
