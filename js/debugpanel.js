/* debugpanel.js — developer debug panel (owner: DEBUG TOOLS). Invisible to normal players.
   Enter / leave debug mode:  Shift + A + W + D pressed together (PC)  ·  tap the version text on the title screen 7 times (phone).
   The mode is remembered in localStorage ('mondo_debug' = '1') until it is switched off again.
   While debug mode is on, a small「DEBUG」button stays at the bottom of the screen to reopen the panel.
   Opening the panel pauses the run (G.game.pause('debug')).
   Tabs: 出撃 (two views: ⚔ 出撃の設定 = debug sortie with custom start conditions + presets, only for that run ·
         💾 セーブ編集 = edit the REAL save without a run — Mora, star map nodes, constellations, unlocks, stage clears,
         skill book, relics — applied with「この設定をセーブに反映」(confirm + one backup:「反映前のセーブに戻す」)) · 進化 (evolution checker) · 強化 · 敵・ボス · 時間 · プレイヤー · 表示.
   Nothing here runs game logic while debug mode is off: every hook (AI stop, spawn stop, slow motion, hitboxes) is installed
   lazily the first time it is used. Helpers live in js/debug.js (G.debug.*). */
'use strict';
G.debugPanel = (function () {
  const el = G.ui.el, U = G.u;
  const K_ON = 'mondo_debug', K_PRE = 'mondo_debug_presets', K_CFG = 'mondo_debug_cfg', K_RESTORE = 'mondo_debug_restore';
  const K_BAK = 'mondo_debug_backup', K_VIEW = 'mondo_debug_view';   // backup of the save before the last「セーブに反映」/ sortie tab view
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { } },
    json(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
  };
  let on = ls.get(K_ON) === '1';
  let wrap = null, body = null, tabsBar = null, head = null, fab = null, overlay = null;
  let isOpen = false, tab = 'evo', refresher = null, openedAt = 0, lastTab = null;
  let sv = ls.get(K_VIEW) === 'save' ? 'save' : 'sortie';   // 出撃タブの表示: 'sortie'（出撃の設定）| 'save'（セーブ編集）
  let D = null, askNode = null, renaming = -1, metaChar = 'amber', statChar = 'amber';
  const RA = { slot: 'all', set: 'wind', rarity: 5 };        // セーブ編集: relic to add
  // persistent toggles (memory only)
  const T = { god: false, noCd: false, infEnergy: false, hitbox: false, overlay: false, skipEvents: true, closeOnAttack: true, lvCards: true, speed: 1, bossKind: 'ruin', bossPhase: 1, enemyKind: 'mote', enemyN: 5, champion: false };
  const sfx = n => { try { G.audio.sfx(n); } catch (e) { } };

  /* ============================== sortie config ============================== */
  const defCfg = () => ({ char: 'amber', stage: 'mondstadt', time: '0:00', level: 1, levels: {}, evolved: {}, meta: 'keep', mora: '', noRecord: true, ignoreLauncher: false, god: false });
  let cfg = Object.assign(defCfg(), ls.json(K_CFG, {}));
  const saveCfg = () => ls.set(K_CFG, JSON.stringify(cfg));
  function parseTime(s) {
    s = String(s || '').trim(); if (!s) return 0;
    const m = s.match(/^(\d+):(\d{1,2})$/); if (m) return (+m[1]) * 60 + (+m[2]);
    const n = parseFloat(s); return isFinite(n) ? Math.max(0, n) : 0;
  }
  const fmtT = t => { t = Math.max(0, Math.floor(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  const charName = id => (G.data.characters[id] || {}).name || id;
  const stages = () => (G.unlocks ? G.unlocks.stageList() : [{ id: 'mondstadt', order: 1, name: 'モンドの風跡', implemented: true }]);
  const stName = id => { const d = stages().find(x => x.id === id); return d ? d.name : id; };
  const CH_STATE = { open: '解放済み', buyable: '購入待ち', locked: 'ロック' };
  /** upgrade keys this character can own, grouped */
  function keysFor(charId) {
    const g = { char: [], launcher: [], stat: [], bless: [] };
    for (const k in G.upgrades) {
      const u = G.upgrades[k]; if (!g[u.cat]) continue;
      if (u.char && u.char !== charId) continue;
      g[u.cat].push(k);
    }
    return g;
  }
  const evosFor = charId => G.evolutions.filter(e => { const u = G.upgrades[e.key]; return !u.char || u.char === charId; });
  const GROUP = { char: 'キャラ専用', launcher: 'ランチャー', stat: '汎用ステータス', bless: '★5 天啓' };

  /* ============================== save protection ============================== */
  function restoreSave() {
    const raw = ls.get(K_RESTORE); if (!raw) return;
    ls.del(K_RESTORE);
    let st; try { st = JSON.parse(raw); } catch (e) { return; }
    const S = G.save.data, settings = S.settings;
    if (st.full) { for (const k of Object.keys(S)) delete S[k]; Object.assign(S, st.full); S.settings = settings; }
    else if (st.meta) { if (st.meta.metaC !== undefined) S.metaC = st.meta.metaC; else if (st.meta.meta) S.meta = st.meta.meta; if (st.meta.constellation === undefined) delete S.constellation; else S.constellation = st.meta.constellation; }
    G.save.write();
  }
  G.bus.on('assetsReady', restoreSave);                                        // page reloaded in the middle of a debug run
  G.bus.on('runEnd', R => { if (R && R.debugRun) restoreSave(); });
  G.bus.on('scene', name => { if (name !== 'run' && !G.run) restoreSave(); });

  function sortie(c) {
    c = c || cfg;
    const g = keysFor(c.char), allowed = new Set([].concat(g.char, g.launcher, g.stat, g.bless));
    const lau = Object.keys(c.levels).filter(k => allowed.has(k) && G.upgrades[k].cat === 'launcher' && c.levels[k] > 0);
    if (lau.length > G.launcherRules.MAX_KINDS && !c.ignoreLauncher) { toast('ランチャーが ' + lau.length + '種 — 2種までにするか「制限を無視」をONに', true); return; }
    restoreSave();
    close(true);
    const S = G.save.data;
    if (String(c.mora).trim() !== '' && isFinite(+c.mora)) { S.mora = Math.max(0, Math.floor(+c.mora)); G.save.write(); }
    const st = {};
    if (c.noRecord) st.full = JSON.parse(JSON.stringify(S));
    if (c.meta !== 'keep') {
      G.progression.metaLevels(c.char || 'amber'); // v6 refund/migration first (天賦の星図 is per character)
      st.meta = { metaC: JSON.parse(JSON.stringify(S.metaC || {})), constellation: S.constellation === undefined ? undefined : JSON.parse(JSON.stringify(S.constellation)) };
      const MC = {};
      if (c.meta === 'max') for (const id of G.data.roster) { const M = MC[id] = {}; for (const k in G.data.meta) M[k] = G.progression.metaDef(k, id).max; }
      S.metaC = MC;
      const con = (S.constellation && typeof S.constellation === 'object') ? Object.assign({}, S.constellation) : {};
      con[c.char || 'amber'] = c.meta === 'max' ? 6 : 0; S.constellation = con; // per-character constellations
    }
    if (st.full || st.meta) ls.set(K_RESTORE, JSON.stringify(st));
    G.startRun(c.char, c.stage || 'mondstadt');
    const R = G.run; if (!R) return;
    R.debugRun = true;
    for (const k in c.levels) { const lv = c.levels[k] | 0; if (lv > 0 && allowed.has(k)) R.levels[k] = Math.min(G.upgrades[k].max, lv); }
    for (const k in c.evolved) if (c.evolved[k] && G.upgrades[k] && evosFor(c.char).some(e => e.key === k)) { R.evolved[k] = true; R.levels[k] = 1; }
    const p = R.player, L = Math.max(1, Math.min(200, c.level | 0 || 1));
    p.level = L; p.xp = 0; p.xpNeed = G.data.xpNeed(L); R.offerN = Math.max(R.offerN || 0, L - 1);
    G.player.refreshStats(R); p.hp = p.maxHp;
    const t = parseTime(c.time); if (t > 0) G.debug.jumpTo(t, true);
    G.progression.checkResonance(R); G.progression.checkEvoReady(R);
    G.bus.emit('upgrade', { key: null, level: 0 }); // HUD: refresh the owned-upgrade icons
    if (c.god) { T.god = true; }
    if (T.god) G.debug.god(true);
    tab = 'evo';
    toast('デバッグ出撃: ' + charName(c.char) + ' ' + stName(c.stage || 'mondstadt') + ' ' + fmtT(t) + ' Lv' + L);
  }

  /* ============================== mode on / off ============================== */
  function setMode(v) {
    on = !!v; ls.set(K_ON, on ? '1' : '0');
    if (!on) {
      close(); T.god = T.noCd = T.infEnergy = T.hitbox = T.overlay = false; T.speed = 1;
      if (G.debug.godMode) G.debug.god(false);
      if (G.debug.slow !== undefined || G.debug.speed !== 1) G.debug.setSpeed(1);
      if (G.debug.aiStopped) G.debug.aiStop(false);
      if (G.debug.spawnStopped) G.debug.spawnStop(false);
      toast('デバッグモード OFF');
    } else toast('デバッグモード ON（Shift+A+W+D でOFF）');
    syncFab(); syncOverlay();
  }
  function toggleMode() { if (on) setMode(false); else { setMode(true); open(); } }

  // --- Shift + A + W + D chord (own key-state tracking, fires once when the 4th key goes down) ---
  const held = new Set(); let latched = false;
  const CH = () => (held.has('ShiftLeft') || held.has('ShiftRight')) && held.has('KeyA') && held.has('KeyW') && held.has('KeyD');
  addEventListener('keydown', e => {
    held.add(e.code);
    if (CH()) { if (!latched) { latched = true; e.preventDefault(); toggleMode(); } }
  }, true);
  addEventListener('keyup', e => { held.delete(e.code); if (!CH()) latched = false; }, true);
  addEventListener('blur', () => { held.clear(); latched = false; });

  // --- phone: 7 taps in a row on the title screen's version text ---
  let taps = 0, lastTap = 0;
  addEventListener('pointerdown', e => {
    const t = e.target && e.target.closest && e.target.closest('.title-foot'); if (!t) return;
    const now = performance.now(); taps = now - lastTap < 700 ? taps + 1 : 1; lastTap = now;
    if (taps >= 7) { taps = 0; setTimeout(toggleMode, 380); } // after the tap's own click has landed
  }, true);

  /* ============================== DOM ============================== */
  function toast(text, bad) {
    const t = el('div', { class: 'dbg-toast' + (bad ? ' bad' : '') }, text); document.body.append(t);
    setTimeout(() => t.classList.add('out'), 1800); setTimeout(() => t.remove(), 2300);
  }
  function syncFab() {
    if (on && !fab) {
      fab = el('button', { class: 'dbg-fab', type: 'button', 'data-nonav': '', onclick: e => { e.stopPropagation(); isOpen ? close() : open(); } }, 'DEBUG');
      fab.addEventListener('pointerdown', e => e.stopPropagation());
      document.body.append(fab);
    } else if (!on && fab) { fab.remove(); fab = null; }
  }
  function syncOverlay() {
    const want = on && T.overlay;
    if (want && !overlay) { overlay = el('div', { class: 'dbg-ov' }); document.body.append(overlay); }
    else if (!want && overlay) { overlay.remove(); overlay = null; }
  }
  function build() {
    wrap = el('div', { class: 'dbg-wrap' });
    const pnl = el('div', { class: 'dbg-panel' });
    head = el('div', { class: 'dbg-info' });
    const top = el('div', { class: 'dbg-head' },
      el('b', { class: 'dbg-logo' }, 'DEBUG'), head,
      el('button', { class: 'dbg-b warn', type: 'button', onclick: () => setMode(false) }, 'デバッグOFF'),
      el('button', { class: 'dbg-b close', type: 'button', onclick: () => close() }, '✕ 閉じる'));
    tabsBar = el('div', { class: 'dbg-tabs' });
    body = el('div', { class: 'dbg-body' });
    pnl.append(top, tabsBar, body); wrap.append(pnl);
    wrap.addEventListener('keydown', e => { e.stopPropagation(); if (e.code === 'Escape') { if (askNode) closeAsk(); else close(); } });
    wrap.addEventListener('keyup', e => e.stopPropagation());
    wrap.addEventListener('pointerdown', e => { if (e.target === wrap) close(); });
    document.body.append(wrap);
  }
  const inRun = () => !!(G.run && G.scene === 'run');
  const TABS = [['sortie', '出撃'], ['evo', '進化'], ['up', '強化'], ['enemy', '敵・ボス'], ['time', '時間'], ['player', 'プレイヤー'], ['view', '表示']];
  function open(t) {
    if (!on) return;
    if (!wrap) build();
    if (t) tab = t;
    if (!inRun()) tab = 'sortie';
    isOpen = true; openedAt = performance.now(); wrap.classList.add('show');
    if (!D || !diffs().length) D = snapDraft();   // the save may have changed since (purchases, runs) — keep only unapplied edits
    const uc = G.save.data.uiSel && G.save.data.uiSel.char;
    if (uc && G.data.characters[uc]) { metaChar = uc; statChar = uc; }
    if (G.run && !G.run.over) G.game.pause('debug');
    render();
  }
  function close(silent) {
    if (!isOpen) return; isOpen = false; closeAsk(); renaming = -1;
    if (wrap) { wrap.classList.remove('show'); const a = document.activeElement; if (a && wrap.contains(a)) a.blur(); }
    if (G.run) G.game.resume('debug');
    refresher = null;
    if (!silent) sfx('ui');
  }

  /* small widgets */
  const B = (label, on, cls, title) => el('button', { class: 'dbg-b ' + (cls || ''), type: 'button', title: title || false, onclick: e => { if (performance.now() - openedAt < 300) return; sfx('ui'); on && on(e); } }, label); // ignore the ghost click of the tap that opened the panel
  const chk = (label, val, set) => { const i = el('input', { type: 'checkbox' }); i.checked = !!val; i.addEventListener('change', () => { set(i.checked); }); return el('label', { class: 'dbg-chk' + (val ? ' on' : '') }, i, el('span', null, label)); };
  const tog = (label, val, set) => B((val ? '● ' : '○ ') + label, () => { set(!val); render(); }, val ? 'on' : '');
  const sec = (title, ...kids) => el('section', { class: 'dbg-sec' }, title ? el('h4', null, title) : null, ...kids);
  const row = (...kids) => el('div', { class: 'dbg-row' }, ...kids);
  const seg = (opts, cur, set) => el('div', { class: 'dbg-seg' }, opts.map(([v, l]) => B(l, () => { set(v); render(); }, v === cur ? 'on' : '')));
  const num = (val, set, w) => { const i = el('input', { class: 'dbg-in', type: 'text', inputmode: 'decimal', value: String(val), style: w ? 'width:' + w + 'px' : false }); i.addEventListener('change', () => set(i.value)); return i; };
  const sel = (opts, cur, set) => { const s = el('select', { class: 'dbg-in' }, opts.map(([v, l]) => { const o = el('option', { value: v }, l); if (v === cur) o.selected = true; return o; })); s.addEventListener('change', () => set(s.value)); return s; };

  function render() {
    if (!wrap || !isOpen) return;
    const run = inRun();
    if (!run) tab = 'sortie';
    tabsBar.innerHTML = '';
    for (const [id, label] of TABS) {
      const dis = !run && id !== 'sortie';
      tabsBar.append(el('button', { class: 'dbg-tab' + (tab === id ? ' on' : ''), type: 'button', disabled: dis, onclick: () => { tab = id; sfx('ui'); render(); } }, label));
    }
    const y = lastTab === tab ? body.scrollTop : 0; lastTab = tab; body.innerHTML = ''; refresher = null;
    const f = { sortie: rSortie, evo: rEvo, up: rUp, enemy: rEnemy, time: rTime, player: rPlayer, view: rView }[tab] || rSortie;
    try { f(body); } catch (e) { console.error('[debugpanel]', e); body.append(el('p', { class: 'dbg-bad' }, 'パネルの描画エラー: ' + e.message)); }
    body.scrollTop = y;
    info();
  }
  function info() {
    if (!head) return;
    const R = G.run;
    head.textContent = R ? `${charName(R.charId)}  ⏱${fmtT(R.time)}  Lv${R.player.level}  敵${R.enemies.filter(e => !e.dead).length}  ${Math.round(G.fps)}fps` : `画面: ${G.scene}（出撃前）`;
  }

  /* ---------------- 出撃（⚔ 出撃の設定 ／ 💾 セーブ編集） ---------------- */
  const clone = o => JSON.parse(JSON.stringify(o));
  const lb = t => el('span', { class: 'dbg-lb' }, t);
  function rSortie(b) {
    const run = inRun();
    b.append(el('div', { class: 'dbg-mode', role: 'tablist' },
      B(el('span', null, el('b', null, '⚔ 出撃の設定'), el('small', null, 'この出撃のあいだだけ')), () => { sv = 'sortie'; ls.set(K_VIEW, sv); render(); }, sv === 'sortie' ? 'on' : ''),
      B(el('span', null, el('b', null, '💾 セーブ編集'), el('small', null, '出撃しないで 実際のセーブを書きかえる')), () => { sv = 'save'; ls.set(K_VIEW, sv); render(); }, (sv === 'save' ? 'on ' : '') + 'save')));
    if (sv === 'save') { rSave(b, run); return; }
    const c = cfg, g = keysFor(c.char);
    const set = (k, v) => { c[k] = v; saveCfg(); };
    const lvOf = k => c.levels[k] | 0;
    const setLv = (k, v) => { const m = G.upgrades[k].max; v = Math.max(0, Math.min(m, v | 0)); if (v) c.levels[k] = v; else delete c.levels[k]; saveCfg(); render(); };
    b.append(el('p', { class: 'dbg-note' }, 'ここの設定は「⚔ この条件で出撃」した その冒険のあいだだけ。出撃しないでモラや星図を変えるなら「💾 セーブ編集」へ。'));
    b.append(sec('キャラ（ロック中でも出撃できる）', el('div', { class: 'dbg-seg' }, G.data.roster.map(id => B(charName(id) + (G.unlocks && G.unlocks.charState(id) !== 'open' ? ' 🔒' : ''), () => { set('char', id); render(); }, c.char === id ? 'on' : '')))));
    b.append(sec('ステージ（未解放でも出撃できる）', el('div', { class: 'dbg-seg' }, stages().map(d => B(d.order + '. ' + d.name + (d.implemented === false ? '（未実装）' : ''), () => { if (d.implemented === false) { toast(d.name + ' はまだ G.data.stages にありません', true); return; } set('stage', d.id); render(); }, (c.stage || 'mondstadt') === d.id ? 'on' : '')))));
    b.append(sec('開始時刻・レベル',
      row(lb('時刻'), num(c.time, v => { set('time', v); render(); }, 70),
        ...[['0:00', 0], ['2:55', 175], ['4:50', 290], ['5:00', 300], ['9:50', 590], ['10:00', 600]].map(([l]) => B(l, () => { set('time', l); render(); }, c.time === l ? 'on sm' : 'sm'))),
      row(lb('レベル'), num(c.level, v => { set('level', Math.max(1, parseInt(v) || 1)); render(); }, 60),
        ...[1, 10, 20, 40].map(n => B('Lv' + n, () => { set('level', n); render(); }, c.level === n ? 'on sm' : 'sm')))));
    // upgrades
    const lau = g.launcher.filter(k => lvOf(k) > 0);
    const ups = sec('開始時の強化',
      row(B('ぜんぶMAX', () => { for (const cat in g) if (cat !== 'bless') for (const k of g[cat]) c.levels[k] = G.upgrades[k].max; saveCfg(); render(); }),
        B('ぜんぶ0', () => { c.levels = {}; saveCfg(); render(); }),
        chk('ランチャー2種制限を無視', c.ignoreLauncher, v => { set('ignoreLauncher', v); render(); })),
      lau.length > G.launcherRules.MAX_KINDS ? el('p', { class: c.ignoreLauncher ? 'dbg-warn' : 'dbg-bad' }, `⚠ ランチャー ${lau.length}種（ゲームでは1回の冒険で${G.launcherRules.MAX_KINDS}種まで）` + (c.ignoreLauncher ? ' — 無視して出撃します' : ' — このままでは出撃できません')) : null);
    for (const cat of ['char', 'launcher', 'stat', 'bless']) {
      if (!g[cat].length) continue;
      ups.append(el('h5', null, GROUP[cat]), el('div', { class: 'dbg-grid' }, g[cat].map(k => upRow(k, lvOf(k), v => setLv(k, v)))));
    }
    b.append(ups);
    const evs = evosFor(c.char);
    b.append(sec('進化済みにする', el('div', { class: 'dbg-grid' }, evs.map(e => {
      const u = G.upgrades[e.key];
      return el('div', { class: 'dbg-up' + (c.evolved[e.key] ? ' max' : '') },
        chk(u.name, c.evolved[e.key], v => { if (v) c.evolved[e.key] = true; else delete c.evolved[e.key]; saveCfg(); render(); }),
        B('素材MAX', () => { for (const k of e.requires) c.levels[k] = G.upgrades[k].max; saveCfg(); render(); }, 'sm', e.requires.map(k => G.upgrades[k].name).join('＋')));
    }))));
    b.append(sec('恒久強化（天賦の星図・命ノ星座）— この出撃のあいだだけ',
      seg([['keep', '今のまま'], ['zero', '全部0（出撃中だけ）'], ['max', '全部MAX（出撃中だけ）']], c.meta, v => set('meta', v)),
      el('p', { class: 'dbg-note' }, '「全部0／全部MAX」はこの出撃のあいだだけ。終わると元にもどります。ずっと変えるなら「💾 セーブ編集」。')));
    b.append(sec('モラ・記録',
      row(lb('出撃時のモラ'), num(c.mora, v => set('mora', v.trim()), 90), el('span', { class: 'dbg-note' }, '出撃するときセーブのモラをこの値にする。空欄=変えない（今 ' + U.fmtNum(G.save.data.mora || 0) + '）')),
      row(chk('セーブに記録しない（撃破数・モラ・スキルブックを出撃前にもどす）', c.noRecord, v => set('noRecord', v))),
      row(chk('無敵で出撃', c.god, v => set('god', v)))));
    rPresets(b);
    b.append(el('div', { class: 'dbg-go' }, B('⚔ この条件で出撃', () => sortie(cfg), 'go')));
  }

  /** プリセット: 5 slots — 保存 / 読込 / 上書き / 名前の変更（その場で入力）/ 削除（確認つき） */
  function rPresets(b) {
    const pres = ls.json(K_PRE, []), put = q => ls.set(K_PRE, JSON.stringify(q));
    const autoName = () => charName(cfg.char) + ' ' + cfg.time + ' Lv' + cfg.level;
    const startRename = i => { renaming = i; render(); const n = body.querySelector('.dbg-pin'); if (n) { try { n.focus({ preventScroll: true }); n.select(); } catch (e) { } } };
    const grid = el('div', { class: 'dbg-pres' }, [0, 1, 2, 3, 4].map(i => {
      const p = pres[i];
      if (!p) return el('div', { class: 'dbg-up dbg-pre empty', 'data-slot': i + 1 }, el('b', { class: 'dbg-pno' }, i + 1), el('span', { class: 'dbg-pn' }, '（空き）'),
        B('保存', () => { const q = ls.json(K_PRE, []); q[i] = { name: autoName(), cfg: clone(cfg) }; put(q); toast('プリセット' + (i + 1) + 'に保存'); render(); }, 'sm gold'));
      let name;
      if (renaming === i) {
        name = el('input', { class: 'dbg-in dbg-pin', type: 'text', value: p.name, maxlength: '30', enterkeyhint: 'done', 'aria-label': 'プリセット' + (i + 1) + 'の名前' });
        let done = false;
        const commit = ok => {
          if (done) return; done = true;
          const q = ls.json(K_PRE, []), v = name.value.trim().slice(0, 30);
          if (ok && q[i] && v && v !== q[i].name) { q[i].name = v; put(q); toast('名前を「' + v + '」に変更'); }
          renaming = -1; render();
        };
        name.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); commit(true); } else if (e.key === 'Escape') { e.preventDefault(); commit(false); } });
        name.addEventListener('blur', () => setTimeout(() => commit(true), 0));
      } else name = el('button', { class: 'dbg-pn dbg-pnb', type: 'button', title: 'タップで名前を変える', onclick: () => startRename(i) }, p.name);
      return el('div', { class: 'dbg-up dbg-pre', 'data-slot': i + 1 }, el('b', { class: 'dbg-pno' }, i + 1), name,
        B('読込', () => { cfg = Object.assign(defCfg(), clone(p.cfg)); saveCfg(); toast('読込: ' + p.name); render(); }, 'sm'),
        B('上書き', () => ask('プリセットを上書き', '「' + p.name + '」を いまの設定（' + autoName() + '）で上書きします。名前はそのまま。', null, '上書きする', () => {
          const q = ls.json(K_PRE, []); q[i] = { name: (q[i] && q[i].name) || p.name, cfg: clone(cfg) }; put(q); toast('プリセット' + (i + 1) + 'を上書き'); render();
        }), 'sm'),
        B('✎', () => startRename(i), 'sm', '名前を変える'),
        B('削除', () => ask('プリセットを削除', '「' + p.name + '」を削除します。元にはもどせません。', null, '削除する', () => {
          const q = ls.json(K_PRE, []); q[i] = null; while (q.length && !q[q.length - 1]) q.pop(); put(q); toast('プリセット' + (i + 1) + 'を削除'); render();
        }, true), 'sm warn'));
    }));
    b.append(sec('プリセット（出撃の設定）', grid, el('p', { class: 'dbg-note' }, '名前をタップ（または ✎）でその場で変更 — Enter／ほかをタップで決定、Esc で取り消し。')));
  }

  /* ---------------- 💾 セーブ編集: a draft of the real save, written only by「この設定をセーブに反映」 ---------------- */
  const unlockable = () => G.data.roster.filter(id => G.data.characters[id] && G.data.characters[id].unlock);
  // 天賦の星図 v6 (TALENT): one map per character — draft D.meta = { charId: { key: lv } }
  const metaKeys = () => (G.data.metaOrder || Object.keys(G.data.meta)).filter(k => G.data.meta[k]);
  const metaMax = (k, id) => (G.progression.metaDef(k, id) || {}).max || 0;
  function metaName(k, charId) { const t = G.progression.metaDef(k, charId); return (t && t.name) || k; }
  function snapDraft() {
    const S = G.save.data, UL = G.unlocks;
    const d = { mora: Math.max(0, Math.floor(S.mora || 0)), meta: {}, cons: {}, chars: {}, cleared: {}, book: 'keep', relAdd: [], relEquip: D ? D.relEquip !== false : true, relClear: false, unopened: G.relics ? G.relics.data().unopened : 0 };
    for (const id of G.data.roster) { const M = G.progression.metaLevels(id), o = d.meta[id] = {}; for (const k of metaKeys()) o[k] = M[k] | 0; }
    d.mora = Math.max(0, Math.floor(S.mora || 0)); // after a possible v6 refund
    for (const id of G.data.roster) d.cons[id] = G.progression.constellationLevel(id);
    if (UL) { for (const id of unlockable()) d.chars[id] = UL.charState(id) === 'open'; for (const s of stages()) d.cleared[s.id] = UL.isCleared(s.id); }
    return d;
  }
  /** human-readable list of what「反映」would change */
  function diffs() {
    if (!D) return [];
    const B0 = snapDraft(), out = [], f = U.fmtNum;
    if (D.mora !== B0.mora) out.push('所持モラ ' + f(B0.mora) + ' → ' + f(D.mora));
    for (const id in D.meta) {
      const a = B0.meta[id] || {}, b = D.meta[id], mk = Object.keys(b).filter(k => (b[k] | 0) !== (a[k] | 0));
      if (mk.length) out.push('天賦の星図（' + charName(id) + '）' + mk.length + 'か所（' + mk.slice(0, 4).map(k => metaName(k, id) + ' ' + (a[k] | 0) + '→' + b[k]).join('、') + (mk.length > 4 ? ' …' : '') + '）');
    }
    for (const id in D.cons) if (D.cons[id] !== B0.cons[id]) out.push('命ノ星座 ' + charName(id) + ' C' + B0.cons[id] + ' → C' + D.cons[id]);
    for (const id in D.chars) if (D.chars[id] !== B0.chars[id]) out.push('キャラ解放 ' + charName(id) + ' → ' + (D.chars[id] ? '解放' : 'ロック'));
    for (const id in D.cleared) if (D.cleared[id] !== B0.cleared[id]) out.push('ステージ ' + stName(id) + ' → ' + (D.cleared[id] ? 'クリア済' : '未クリア'));
    if (D.book !== 'keep') out.push('スキルブック → ' + (D.book === 'all' ? '全登録' : '全消去'));
    if (D.relClear) out.push('聖遺物 → 持っているものを全部消す');
    if (D.relAdd.length) out.push('聖遺物 +' + D.relAdd.length + '個 追加' + (D.relEquip ? '（装備する）' : ''));
    if (D.unopened !== B0.unopened) out.push('未開封の聖遺物 ' + B0.unopened + ' → ' + D.unopened);
    return out;
  }
  const dState = id => { const u = G.data.characters[id].unlock; return D.chars[id] ? 'open' : (!u.stage || D.cleared[u.stage]) ? 'buyable' : 'locked'; };
  const hm = t => { const d = new Date(t); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); };
  function refreshHome() {
    if (G.scene !== 'home' || !G.screens || !G.screens.home) return;
    const tb = document.querySelector('#ui .tab-body'), y = tb ? tb.scrollTop : 0;
    G.screens.home(); const nb = document.querySelector('#ui .tab-body'); if (nb) nb.scrollTop = y;
  }
  function afterSave() { render(); try { G.bus.emit('moraChange', G.save.data.mora); } catch (e) { } refreshHome(); }
  function applySave() {
    if (inRun()) { toast('出撃中はセーブ編集を反映できません（ホームかタイトルで）', true); return; }
    const list = diffs();
    if (!list.length) { toast('変更はありません', true); return; }
    ask('セーブデータが書き換わります', '次の内容を 実際のセーブに書きこみます（出撃はしません）。反映前のセーブを1つだけ残すので「↩ 反映前のセーブに戻す」で戻せます。', list, '💾 反映する', () => {
      const S = G.save.data, UL = G.unlocks, B0 = snapDraft();
      ls.set(K_BAK, JSON.stringify({ at: Date.now(), n: list.length, data: S }));
      S.mora = Math.max(0, Math.floor(+D.mora || 0));
      for (const id in D.meta) {
        const M = G.progression.metaLevels(id, true);
        for (const k in D.meta[id]) { const v = U.clamp(D.meta[id][k] | 0, 0, metaMax(k, id)); if (v > 0) M[k] = v; else delete M[k]; }
      }
      for (const id in D.cons) if (D.cons[id] !== B0.cons[id]) G.progression.setConstellation(id, D.cons[id]);
      if (UL) {
        for (const id in D.cleared) if (D.cleared[id] !== B0.cleared[id]) UL.setCleared(id, D.cleared[id]);
        for (const id in D.chars) if (D.chars[id] !== B0.chars[id]) UL.setChar(id, D.chars[id]);
      }
      if (G.relics) {
        const r = G.relics.data();
        if (D.relClear) { r.owned = []; r.equipped = {}; }
        for (const p of D.relAdd) { p.id = r.nextId++; r.owned.push(p); if (D.relEquip) r.equipped[p.slot] = p.id; }
        r.unopened = Math.max(0, D.unopened | 0);
      }
      G.save.write();
      if (D.book !== 'keep' && G.skillbook) G.skillbook.setAll(D.book === 'all');
      D = snapDraft(); afterSave(); toast('セーブに反映しました（' + list.length + '件）');
    });
  }
  function restoreBackup() {
    const bk = ls.json(K_BAK, null);
    if (!bk || !bk.data) { toast('戻せるセーブがありません', true); return; }
    if (inRun()) { toast('出撃中は戻せません（ホームかタイトルで）', true); return; }
    ask('反映前のセーブに戻します', hm(bk.at) + ' に「セーブに反映」する前の状態にもどします。そのあとで変わった モラ・記録・聖遺物なども もどります（設定＝音量などはそのまま）。', null, '↩ 戻す', () => {
      const S = G.save.data, settings = S.settings;
      for (const k of Object.keys(S)) delete S[k];
      Object.assign(S, bk.data); S.settings = settings;
      G.save.write(); ls.del(K_BAK);
      if (G.unlocks && G.unlocks.migrate) { try { G.unlocks.migrate(); } catch (e) { } }
      D = snapDraft(); afterSave(); toast('反映前のセーブに戻しました');
    }, true);
  }
  G.bus.on('saveReset', () => { ls.del(K_BAK); D = null; });

  /** a level row: name · − · lv/max · + · MAX */
  function lvRow(name, lv, max, setLv, cls, title) {
    return el('div', { class: 'dbg-up ' + (cls || '') + (lv >= max ? ' max' : lv > 0 ? ' has' : '') },
      el('span', { class: 'dbg-un', title: title || false }, name),
      B('−', () => setLv(lv - 1), 'pm'), el('b', { class: 'dbg-lv' }, lv + '/' + max), B('+', () => setLv(lv + 1), 'pm'),
      B('MAX', () => setLv(max), 'sm'));
  }
  const charSeg = (cur, set) => el('div', { class: 'dbg-seg' }, G.data.roster.map(id => B(charName(id), () => { set(id); render(); }, cur === id ? 'on sm' : 'sm')));

  function rSave(b, run) {
    if (!D) D = snapDraft();
    const list = diffs(), bk = ls.json(K_BAK, null), f = U.fmtNum;
    b.append(el('div', { class: 'dbg-sum save' + (run ? ' bad' : '') },
      run ? '⚠ 出撃中は反映できません（ホームかタイトルでひらく）。' : 'ここで変えたものは「💾 この設定をセーブに反映」を押したときだけ、実際のセーブに書きこまれます（出撃しません）。',
      el('br'), list.length ? el('b', null, '未反映の変更 ' + list.length + '件') : '未反映の変更はありません',
      bk ? el('span', { class: 'dbg-bk' }, '　／　反映前のセーブ: ' + hm(bk.at) + ' のものを保存中') : null,
      list.length ? el('ul', { class: 'dbg-dl' }, list.map(t => el('li', null, t))) : null));
    // Mora
    const moraIn = num(D.mora, v => { D.mora = Math.max(0, Math.floor(+String(v).replace(/[^\d.]/g, '') || 0)); render(); }, 110);
    b.append(sec('所持モラ',
      row(lb('モラ'), moraIn, ...[0, 10000, 100000, 1000000].map(n => B(f(n), () => { D.mora = n; render(); }, D.mora === n ? 'on sm' : 'sm')),
        B('+50,000', () => { D.mora += 50000; render(); }, 'sm')),
      el('p', { class: 'dbg-note' }, 'いまのセーブ ' + f(G.save.data.mora || 0) + ' モラ')));
    // star map
    const MD = D.meta[metaChar] || (D.meta[metaChar] = {});
    const setM = (k, v) => { MD[k] = U.clamp(v | 0, 0, metaMax(k, metaChar)); render(); };
    const allM = (ids, max) => { for (const id of ids) { const o = D.meta[id] || (D.meta[id] = {}); for (const k of metaKeys()) o[k] = max ? metaMax(k, id) : 0; } render(); };
    const TRB = G.data.metaTree.branches, TRN = G.data.metaTree.nodes;
    b.append(sec('天賦の星図（キャラごと・ノードごとのLv）',
      charSeg(metaChar, v => { metaChar = v; }),
      row(B(charName(metaChar) + ' 全部0', () => allM([metaChar], false), 'sm'), B(charName(metaChar) + ' 全部MAX', () => allM([metaChar], true), 'sm gold'),
        B('全キャラ 全部0', () => allM(G.data.roster, false), 'sm'), B('全キャラ 全部MAX', () => allM(G.data.roster, true), 'sm')),
      ...Object.keys(TRB).map(br => [el('h5', null, TRB[br].name),
        el('div', { class: 'dbg-grid' }, metaKeys().filter(k => TRN[k] && TRN[k].br === br).map(k => lvRow(metaName(k, metaChar), MD[k] | 0, metaMax(k, metaChar), v => setM(k, v), '', k)))]).flat()));
    // constellations
    const setC = (id, v) => { D.cons[id] = U.clamp(v | 0, 0, 6); render(); };
    b.append(sec('命ノ星座（キャラごと）',
      el('div', { class: 'dbg-grid' }, G.data.roster.map(id => lvRow(charName(id) + ' C', D.cons[id] | 0, 6, v => setC(id, v), 'cons'))),
      row(B('全キャラ C0', () => { G.data.roster.forEach(id => { D.cons[id] = 0; }); render(); }, 'sm'), B('全キャラ C6', () => { G.data.roster.forEach(id => { D.cons[id] = 6; }); render(); }, 'sm gold'))));
    // unlocks + stage clears
    if (G.unlocks) {
      b.append(sec('キャラ解放',
        el('div', { class: 'dbg-grid' }, unlockable().map(id => {
          const st = dState(id);
          return el('div', { class: 'dbg-up' + (st === 'open' ? ' max' : st === 'buyable' ? ' has' : '') }, el('span', { class: 'dbg-un' }, charName(id)),
            el('span', { class: 'dbg-tag' }, CH_STATE[st]),
            B('解放', () => { D.chars[id] = true; render(); }, st === 'open' ? 'sm on' : 'sm'),
            B('ロック', () => { D.chars[id] = false; render(); }, st !== 'open' ? 'sm on' : 'sm'));
        })),
        row(B('全キャラ解放', () => { unlockable().forEach(id => { D.chars[id] = true; }); render(); }, 'gold'),
          B('全キャラロック', () => { unlockable().forEach(id => { D.chars[id] = false; }); render(); })),
        el('p', { class: 'dbg-note' }, 'ロック＝購入前にもどす。ステージ1がクリア済みなら「購入待ち」、未クリアなら「ロック（シルエット）」。')));
      b.append(sec('ステージクリア状態',
        el('div', { class: 'dbg-grid' }, stages().map(d => {
          const cl = !!D.cleared[d.id], req = d.requires, open = d.implemented !== false && (!req || D.cleared[req]);
          return el('div', { class: 'dbg-up' + (cl ? ' max' : '') }, el('span', { class: 'dbg-un' }, d.order + '. ' + d.name),
            el('span', { class: 'dbg-tag' }, cl ? 'クリア済' : open ? '挑戦可' : '未解放'),
            B(cl ? 'クリアを消す' : 'クリア済にする', () => { D.cleared[d.id] = !cl; render(); }, 'sm'));
        })),
        row(B('全ステージクリア', () => { stages().forEach(d => { D.cleared[d.id] = true; }); render(); }, 'gold'),
          B('クリア状態を全部消す', () => { stages().forEach(d => { D.cleared[d.id] = false; }); render(); }))));
    }
    if (G.skillbook) {
      const SB = G.skillbook;
      b.append(sec('スキルブック',
        el('p', { class: 'dbg-note' }, 'いま 登録 ' + SB.count() + ' / ' + SB.total() + '（進化 ' + G.evolutions.filter(e => SB.has(e.key)).length + ' / ' + G.evolutions.length + ' 達成）'),
        seg([['keep', 'そのまま'], ['all', 'スキルブック全登録'], ['none', 'スキルブック全消去']], D.book, v => { D.book = v; }),
        el('p', { class: 'dbg-note' }, '全登録＝すべてのスキルと進化の条件が見える。全消去＝黒いシルエット（？？？）にもどす。')));
    }
    // relics
    if (G.relics) {
      const RL = G.relics, r = RL.data(), SL = RL.SLOTS, SE = RL.SETS;
      const add = n => { const slots = RA.slot === 'all' ? SL.map(s => s.id) : [RA.slot]; for (let j = 0; j < n; j++) for (const s of slots) { const p = RL.roll(s, RA.rarity); p.set = RA.set; D.relAdd.push(p); } render(); };
      const pend = {}; D.relAdd.forEach(p => { const k = SE[p.set].name + ' ★' + p.rarity; pend[k] = (pend[k] || 0) + 1; });
      b.append(sec('聖遺物',
        el('p', { class: 'dbg-note' }, 'いま 持っている ' + r.owned.length + '個（装備 ' + Object.keys(r.equipped).length + '）・未開封 ' + r.unopened),
        row(lb('部位'), sel([['all', '5部位ぜんぶ']].concat(SL.map(s => [s.id, s.name])), RA.slot, v => { RA.slot = v; }),
          lb('セット'), sel(Object.keys(SE).map(k => [k, SE[k].name]), RA.set, v => { RA.set = v; }),
          seg([[5, '★5'], [4, '★4']], RA.rarity, v => { RA.rarity = v; })),
        row(B('＋ 追加', () => add(1), 'gold'), B('＋ ×4 追加', () => add(4)),
          D.relAdd.length ? el('span', { class: 'dbg-note' }, '追加予定 ' + D.relAdd.length + '個（' + Object.keys(pend).map(k => k + '×' + pend[k]).join('、') + '）') : null,
          D.relAdd.length ? B('追加を取り消す', () => { D.relAdd = []; render(); }, 'sm') : null),
        row(lb('未開封'), B('−', () => { D.unopened = Math.max(0, D.unopened - 1); render(); }, 'pm'), el('b', { class: 'dbg-lv' }, String(D.unopened)),
          B('+', () => { D.unopened++; render(); }, 'pm'), B('+10', () => { D.unopened += 10; render(); }, 'sm')),
        row(chk('追加した遺物を装備する（部位ごとに最後の1個）', D.relEquip, v => { D.relEquip = v; render(); }),
          chk('持っている聖遺物を全部消す（装備もはずれる）', D.relClear, v => { D.relClear = v; render(); })),
        el('p', { class: 'dbg-note' }, 'サブステータスはふつうに開けたときと同じ ランダム。セットは選んだもの。')));
    }
    // final stats (the current save — what a run would start with)
    const P = G.progression, now = P.previewStats(statChar), bare = P.previewStats(statChar, { bare: true });
    const rows = P.statRows(now, statChar), rb = P.statRows(bare, statChar);
    const stBox = el('div', { class: 'dbg-stats wide' }, rows.map((x, i) => {
      const d = rb[i] && rb[i].text !== x.text;
      return el('div', { class: d ? 'chg' : '' }, el('span', null, x.name), el('b', null, x.text), d ? el('small', null, '基本 ' + rb[i].text) : null);
    }));
    b.append(sec('最終ステータス（いまのセーブ・出撃時 Lv1）', charSeg(statChar, v => { statChar = v; }), stBox,
      el('p', { class: 'dbg-note' }, '星図・命ノ星座・聖遺物をふくめた 出撃直後の値（冒険中の強化は入らない）。緑＝基本値から変わったもの。未反映の変更は入りません。ホームの「ステータス」でも見られます。')));
    const bkBtn = B('↩ 反映前のセーブに戻す', restoreBackup, 'warn', bk ? hm(bk.at) + ' のセーブ' : 'まだ反映していません');
    if (!bk || run) bkBtn.disabled = true;
    const goBtn = B(list.length ? '💾 この設定をセーブに反映（' + list.length + '件）' : '💾 この設定をセーブに反映', applySave, 'go save');
    if (run) goBtn.disabled = true;
    b.append(el('div', { class: 'dbg-go two' }, goBtn, bkBtn,
      B('変更を捨てる', () => { D = snapDraft(); toast('未反映の変更を捨てました'); render(); }, 'sm')));
  }

  /* confirm dialog inside the panel */
  function ask(title, text, list, okLabel, onOk, danger) {
    closeAsk();
    const ok = B(okLabel, () => { closeAsk(); onOk(); }, danger ? 'warn' : 'gold');
    const card = el('div', { class: 'dbg-ask-card' + (danger ? ' danger' : '') },
      el('h4', null, (danger ? '⚠ ' : '') + title), text ? el('p', null, text) : null,
      list && list.length ? el('ul', { class: 'dbg-dl' }, list.map(t => el('li', null, t))) : null,
      el('div', { class: 'dbg-row end' }, B('やめる', closeAsk, 'close'), ok));
    askNode = el('div', { class: 'dbg-ask', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, card);
    askNode.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === askNode) closeAsk(); });
    wrap.append(askNode);
    try { ok.focus({ preventScroll: true }); } catch (e) { }
  }
  function closeAsk() { if (askNode) { askNode.remove(); askNode = null; } }
  function upRow(k, lv, setLv) {
    const u = G.upgrades[k];
    return el('div', { class: 'dbg-up' + (lv >= u.max ? ' max' : lv > 0 ? ' has' : '') },
      el('span', { class: 'dbg-un', title: k }, u.name),
      B('−', () => setLv(lv - 1), 'pm'), el('b', { class: 'dbg-lv' }, lv + '/' + u.max), B('+', () => setLv(lv + 1), 'pm'),
      B('MAX', () => setLv(u.max), 'sm'));
  }

  /* ---------------- 進化チェッカー ---------------- */
  const yes = v => el('span', { class: v ? 'dbg-ok' : 'dbg-ng' }, v ? '✓' : '✗');
  function afterRunChange(R) {
    G.player.refreshStats(R);
    G.progression.checkResonance(R); G.progression.checkEvoReady(R);
    G.bus.emit('upgrade', { key: null, level: 0 });
  }
  function rEvo(b) {
    const R = G.run, list = G.debug.evoCheck(R);
    const bad = list.filter(x => !x.match).length;
    const ready = G.progression.evoReady(R);
    const lo = G.launcherRules.owned(R);
    b.append(el('div', { class: 'dbg-sum' + (bad ? ' bad' : '') },
      bad ? `⚠ 判定の不一致が ${bad}件 あります（赤い行）` : '✓ すべての進化で 定義・バッジ・宝箱 の判定が一致しています',
      el('br'), `宝箱で今もらえる進化: ${ready.length ? ready.map(k => G.upgrades[k].name).join('、') : 'なし'}　／　ランチャー ${lo.length}/${G.launcherRules.MAX_KINDS}種`));
    b.append(el('p', { class: 'dbg-note' }, '定義 = upgrades.js の requires（ぜんぶMAX）を ここで計算 ／ バッジ = evoLeft()==0（レベルアップのカード・装備画面）／ 宝箱 = progression.evoReady()（宝箱が実際に出す）／ ready = 進化カードの ready()'));
    list.sort((p, q) => (G.upgrades[q.key].char ? 1 : 0) - (G.upgrades[p.key].char ? 1 : 0)); // this character's own evolution first
    for (const x of list) {
      const e = G.evolutions.find(v => v.key === x.key);
      const status = x.evolved ? el('span', { class: 'dbg-tag evo' }, '進化済み') : x.own ? el('span', { class: 'dbg-tag ok' }, '条件成立') : el('span', { class: 'dbg-tag' }, 'あと ' + x.left + ' Lv');
      const mats = el('div', { class: 'dbg-mats' }, x.mats.map(m => {
        const ap = !m.ok && G.upgradeHelpers.evoAfterPick(R, m.key);
        return el('div', { class: 'dbg-mat' + (m.ok ? ' ok' : m.lv > 0 ? ' has' : '') }, yes(m.ok), el('span', { class: 'dbg-mn' }, m.name), el('b', null, m.lv + ' / ' + m.max),
          ap ? el('small', null, ap.unlock ? 'カード:★進化解放' : 'カード:あと' + ap.left) : null);
      }));
      const judges = el('div', { class: 'dbg-judge' + (x.match ? '' : ' bad') },
        '定義 ', yes(x.own), '　バッジ ', yes(x.badge), '　宝箱 ', yes(x.chest), '　ready ', yes(x.ready), '　→ ', x.match ? el('b', { class: 'dbg-ok' }, '一致') : el('b', { class: 'dbg-ng' }, '不一致！'));
      b.append(el('div', { class: 'dbg-evo' + (x.match ? '' : ' bad') + (x.evolved ? ' done' : '') },
        el('div', { class: 'dbg-evh' }, el('b', null, x.name), el('small', null, x.key), status), mats, judges,
        row(B('素材を全部MAX', () => { for (const k of e.requires) G.debug.setLevel(k, G.upgrades[k].max); afterRunChange(R); render(); }, 'sm'),
          B('進化の宝箱を今すぐ開く', () => { close(true); G.progression.openChest(R, 'common'); }, 'sm'),
          x.evolved ? B('進化を取り消す', () => { G.debug.setLevel(x.key, 0); afterRunChange(R); render(); }, 'sm') :
            B('直接進化させる', () => { close(true); G.progression.apply(R, x.key); }, 'sm gold'))));
    }
  }

  /* ---------------- 強化 ---------------- */
  function rUp(b) {
    const R = G.run, g = keysFor(R.charId);
    const setLv = (k, v) => { G.debug.setLevel(k, v); afterRunChange(R); render(); };
    b.append(sec('画面を出す',
      row(B('レベルアップ画面を今すぐ出す', () => { close(true); G.progression.openLevelUp(R); }, 'gold')),
      row(el('span', { class: 'dbg-lb' }, '宝箱'), ...[['common', '普通'], ['exquisite', '精巧'], ['precious', '貴重'], ['luxurious', '豪華']].map(([t, l]) => B(l + 'の宝箱', () => { close(true); G.progression.openChest(R, t); }, 'sm')))));
    const lau = G.launcherRules.owned(R);
    const s = sec('強化レベル',
      row(B('ぜんぶMAX', () => { for (const cat of ['char', 'launcher', 'stat']) for (const k of g[cat]) G.debug.setLevel(k, G.upgrades[k].max); afterRunChange(R); render(); }),
        B('ぜんぶリセット（進化も）', () => { for (const k of Object.keys(R.levels)) G.debug.setLevel(k, 0); afterRunChange(R); render(); }, 'warn')),
      lau.length > G.launcherRules.MAX_KINDS ? el('p', { class: 'dbg-warn' }, `⚠ ランチャー ${lau.length}種（通常は${G.launcherRules.MAX_KINDS}種まで）`) : null);
    for (const cat of ['char', 'launcher', 'stat', 'bless']) {
      if (!g[cat].length) continue;
      s.append(el('h5', null, GROUP[cat]), el('div', { class: 'dbg-grid' }, g[cat].map(k => upRow(k, R.levels[k] || 0, v => setLv(k, v)))));
    }
    b.append(s);
  }

  /* ---------------- 敵・ボス ---------------- */
  const ATK = { missiles: 'ミサイル連射', beam: '目のビーム', stomp: '突進ストンプ', spin: '回転なぎはらい', fan: '風の矢（扇）', storm: '嵐の落下', tornado: '竜巻', dash: '突風ダッシュ', wall: '風の壁', inhale: '吸い込み', spiral: 'らせん弾', barrage: '弾幕' };
  const liveBosses = R => R.enemies.filter(e => !e.dead && e.boss);
  function rEnemy(b) {
    const R = G.run, E = G.data.enemies;
    const kinds = Object.keys(E).filter(k => !E[k].boss);
    b.append(sec('敵をスポーン（プレイヤーのまわり）',
      row(sel(kinds.map(k => [k, E[k].name + (E[k].elite ? '（エリート）' : '')]), T.enemyKind, v => { T.enemyKind = v; }),
        ...[1, 5, 10, 30].map(n => B('×' + n, () => { T.enemyN = n; render(); }, T.enemyN === n ? 'on sm' : 'sm')),
        chk('チャンピオン（金）', T.champion, v => { T.champion = v; })),
      row(B('スポーン', () => {
        const p = R.player;
        for (let i = 0; i < T.enemyN; i++) { const a = i / T.enemyN * U.TAU + Math.random() * 0.4, d = 5.5 + Math.random() * 2.5; G.enemies.spawn(R, T.enemyKind, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, { champion: T.champion, reward: T.champion ? 'common' : null }); }
        toast(E[T.enemyKind].name + ' ×' + T.enemyN); render();
      }, 'gold'))));
    const bk = Object.keys(E).filter(k => E[k].boss);
    const seqsAll = G.enemyAI.seqs || {}, phased = ai => ai !== 'ruin' && seqsAll[ai] && !Array.isArray(seqsAll[ai]);
    const phases = phased((E[T.bossKind] || {}).ai) ? [[1, '第1段階'], [2, '第2段階'], [3, '第3段階']] : [[1, '通常'], [2, '暴走（HP35%以下）']];
    if (!phases.some(p => p[0] === T.bossPhase)) T.bossPhase = 1;
    b.append(sec('ボスをスポーン',
      row(seg(bk.map(k => [k, E[k].name]), T.bossKind, v => { T.bossKind = v; T.bossPhase = 1; })),
      row(el('span', { class: 'dbg-lb' }, '段階'), seg(phases, T.bossPhase, v => { T.bossPhase = v; })),
      row(B('ボスを出す', () => { const e = G.debug.spawnBoss(T.bossKind, T.bossPhase); toast(e ? E[T.bossKind].name + ' 出現' : '出せませんでした', !e); render(); }, 'gold'))));
    const bosses = liveBosses(R);
    const bs = sec('いるボスと技の発動');
    if (!bosses.length) bs.append(el('p', { class: 'dbg-note' }, 'ボスがいません。上の「ボスを出す」で出してください。'));
    for (const e of bosses) {
      const seqs = G.enemyAI.seqs || {}, ai = e.def.ai;
      const atks = Array.isArray(seqs[ai]) ? seqs[ai] : seqs[ai] ? [].concat(seqs[ai][1] || [], seqs[ai][2] || [], seqs[ai][3] || []) : [];
      const BN = (G.enemyAI.bossDebug && G.enemyAI.bossDebug.names) || {};
      const uniq = atks.filter((a, i) => atks.indexOf(a) === i);
      bs.append(el('div', { class: 'dbg-boss' },
        el('div', { class: 'dbg-evh' }, el('b', null, e.def.name), el('small', null, `HP ${Math.round(e.hp / e.maxHp * 100)}%` + (phased(ai) ? ` ・ 第${e.phase}段階` : e.enraged ? ' ・ 暴走' : '') + ` ・ 状態 ${e.st}`)),
        row(el('span', { class: 'dbg-lb' }, 'HP'), ...[100, 60, 30, 10].map(v => B(v + '%', () => { e.hp = e.maxHp * v / 100; render(); }, 'sm')), B('倒す', () => { G.enemies.kill(R, e, 'debug'); render(); }, 'sm warn')),
        el('div', { class: 'dbg-seg wrap' }, uniq.map(a => {
          const phs = phased(ai) ? [1, 2, 3].filter(ph => (seqs[ai][ph] || []).indexOf(a) >= 0) : [];
          return B(ATK[a] || BN[a] || a, () => { G.debug.bossAttack(e, a); if (T.closeOnAttack) close(true); else render(); }, 'sm', a + (phs.length ? '（第' + phs.join('・') + '段階）' : ''));
        }))));
    }
    bs.append(row(chk('技ボタンを押したらパネルを閉じて見る', T.closeOnAttack, v => { T.closeOnAttack = v; })));
    b.append(bs);
    b.append(sec('まとめて',
      row(tog('AI停止', !!G.debug.aiStopped, v => G.debug.aiStop(v)), tog('スポーン停止（時間イベントも）', !!G.debug.spawnStopped, v => G.debug.spawnStop(v))),
      row(B('全敵撃破（ボス以外）', () => { toast(G.debug.killAll(false) + '体 撃破'); render(); }), B('ボスもふくめて全滅', () => { toast(G.debug.killAll(true) + '体 撃破'); render(); }, 'warn'))));
  }

  /* ---------------- 時間 ---------------- */
  function evLabel(ev) {
    const t = ev.boss ? 'ボス' : ev.surge ? '群れ' : ev.treasure ? '宝箱' : ev.kind === 'elite' ? '暴徒' : 'イベント';
    return [t, ev.banner || ev.notice || (ev.treasure ? '宝箱ヒルチャール（' + (ev.reward || '') + '）' : (G.data.enemies[ev.kind] || {}).name || ev.kind)];
  }
  function rTime(b) {
    const R = G.run, st = G.data.stages[R.stageId];
    const go = t => { G.debug.jumpTo(t, T.skipEvents); toast('⏱ ' + fmtT(t) + ' へジャンプ'); render(); };
    let inp;
    b.append(sec('時刻ジャンプ　（いま ' + fmtT(R.time) + '）',
      row(inp = num(fmtT(R.time), () => { }, 70), B('ジャンプ', () => go(parseTime(inp.value)), 'gold'),
        B('−30秒', () => go(R.time - 30), 'sm'), B('+30秒', () => go(R.time + 30), 'sm'), B('+60秒', () => go(R.time + 60), 'sm')),
      row(chk('途中のイベントをとばす（OFF＝通りすぎたイベントが全部いっきに起きる）', T.skipEvents, v => { T.skipEvents = v; }))));
    const list = el('div', { class: 'dbg-evl' });
    st.events.forEach((ev, i) => {
      const [kind, text] = evLabel(ev), done = R.spawn && i < R.spawn.evIdx;
      list.append(el('div', { class: 'dbg-ev' + (ev.boss ? ' boss' : '') + (done ? ' done' : '') },
        el('b', null, fmtT(ev.time)), el('span', { class: 'dbg-tag' + (ev.boss ? ' evo' : '') }, kind), el('span', { class: 'dbg-evt' }, text),
        B('5秒前へ', () => go(Math.max(0, ev.time - 5)), 'sm'), B('ちょうど', () => go(ev.time), 'sm')));
    });
    b.append(sec('ステージのイベント（灰色 = もう起きた）', list));
    b.append(sec('ゲーム速度', seg([[0.25, '×0.25'], [0.5, '×0.5'], [1, '×1'], [2, '×2'], [4, '×4']], T.speed, v => { T.speed = v; G.debug.setSpeed(v); })));
  }

  /* ---------------- プレイヤー ---------------- */
  function rPlayer(b) {
    const R = G.run, p = R.player;
    b.append(el('div', { class: 'dbg-sum' }, `HP ${Math.round(p.hp)} / ${Math.round(p.maxHp)}　エネルギー ${Math.round(p.energy)} / ${R.char.energyCost}　スキルCT ${p.skillCd.toFixed(1)}s　爆発CT ${p.burstCd.toFixed(1)}s　Lv${p.level}　モラ ${Math.floor(R.mora)}`));
    b.append(sec('いつでも',
      row(tog('無敵', T.god, v => { T.god = v; G.debug.god(v); }), tog('CT 常に0', T.noCd, v => { T.noCd = v; }), tog('エネルギー無限', T.infEnergy, v => { T.infEnergy = v; }))));
    b.append(sec('いますぐ',
      row(B('HP全回復', () => { p.hp = p.maxHp; render(); }), B('エネルギー満タン', () => { G.debug.energy(); render(); }), B('スキル/爆発 CT0', () => { p.skillCd = 0; p.burstCd = 0; render(); })),
      row(B('レベル +1', () => lvUp(1)), B('レベル +5', () => lvUp(5)), chk('レベルアップのカードを出す', T.lvCards, v => { T.lvCards = v; })),
      row(B('モラ +100', () => { R.mora += 100; render(); }), B('モラ +1000', () => { R.mora += 1000; render(); }))));
    function lvUp(n) {
      if (T.lvCards) { let need = 0, L = p.level; for (let i = 0; i < n; i++) need += (i === 0 ? p.xpNeed - p.xp : G.data.xpNeed(L + i)); G.progression.addXp(R, need + 0.01); close(true); }
      else { p.level += n; p.xp = 0; p.xpNeed = G.data.xpNeed(p.level); render(); }
    }
  }

  /* ---------------- 表示 ---------------- */
  function rView(b) {
    const R = G.run;
    b.append(sec('表示',
      row(tog('当たり判定を表示', T.hitbox, v => { T.hitbox = v; if (v) hookDraw(); }), tog('FPS・敵数・粒子数を表示', T.overlay, v => { T.overlay = v; syncOverlay(); })),
      el('p', { class: 'dbg-note' }, '当たり判定の色: 緑=プレイヤー（点線=回収範囲）／赤=敵（橙=ボス・エリート）／桃=敵の攻撃・予告／水色=屏風などのかべ／黄=自分の弾')));
    const stBox = el('div', { class: 'dbg-stats' });
    const fill = () => {
      const S = R.stats || {}, p = R.player, fs = G.fx.stats ? G.fx.stats() : {};
      const pc = v => Math.round((v || 0) * 100) + '%';
      const rows = [
        ['FPS', Math.round(G.fps)], ['敵の数', R.enemies.filter(e => !e.dead).length], ['敵の攻撃', R.hazards.length], ['自分の弾', (R.projectiles || []).length],
        ['粒子', fs.particles || 0], ['エフェクト', fs.effects || 0], ['拾いもの', (R.pickups || []).length], ['時刻', fmtT(R.time)],
        ['攻撃力', Math.round(S.atk)], ['最大HP', Math.round(p.maxHp)], ['防御力', Math.round(S.def)], ['移動速度', (S.speed || 0).toFixed(2)],
        ['攻撃速度', pc(S.haste)], ['クールダウン短縮', pc(S.cdr)], ['会心率', pc(S.critRate)], ['会心ダメージ', pc(S.critDmg)],
        ['元素チャージ', pc(S.recharge)], ['範囲', pc(S.areaMul)], ['持続', pc(S.durationMul)], ['爆発範囲', '×' + (S.explosionMul || 1)],
        ['与ダメ', '+' + pc(S.dmgBonus)], ['被ダメ軽減', pc(S.dmgReduction)], ['回収範囲', (S.pickup || 0).toFixed(1)], ['射程', (S.range || 0).toFixed(1)],
        ['通常の間隔', (S.normalInterval || 0).toFixed(2) + 's'], ['経験値', pc(S.xpMul)], ['追加の弾', S.extraProjectiles || 0], ['共鳴', Object.keys(S.resonance || {}).join(' ') || 'なし'],
      ];
      stBox.innerHTML = '';
      for (const [k, v] of rows) stBox.append(el('div', null, el('span', null, k), el('b', null, String(v))));
    };
    fill(); refresher = fill;
    b.append(sec('いまの数値（R.stats）', stBox));
  }

  /* ============================== hitboxes ============================== */
  function hookDraw() {
    if (G.render._dbgDraw) return;
    const orig = G.render.drawRun; G.render._dbgDraw = orig;
    G.render.drawRun = function (ctx) { orig.apply(this, arguments); if (on && T.hitbox && G.run) { try { drawHit(ctx); } catch (e) { console.error('[debugpanel]', e); } } };
  }
  function circ(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.02, r), 0, U.TAU); ctx.stroke(); }
  function rect(ctx, x, y, ang, len, w, fromStart) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.strokeRect(fromStart ? 0 : -len / 2, -w / 2, len, w); ctx.restore();
  }
  function drawShape(ctx, o) {
    if (o.type === 'lane' || (o.len && o.ang != null)) rect(ctx, o.x, o.y, o.ang || 0, o.len || 1, o.w || 1, true);
    else if (o.type === 'fan' && o.r) { ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.arc(o.x, o.y, o.r, (o.ang || 0) - (o.spread || 0.5), (o.ang || 0) + (o.spread || 0.5)); ctx.closePath(); ctx.stroke(); }
    else if (o.r) circ(ctx, o.x, o.y, o.r);
  }
  function drawHit(ctx) {
    const R = G.run, V = G.view, px = 1 / (V.scale * V.cam.zoom);
    G.render.beginWorld(ctx);
    ctx.lineWidth = 1.6 * px; ctx.globalAlpha = 0.95;
    // own projectiles & fields
    ctx.strokeStyle = '#ffe14a';
    for (const q of R.projectiles || []) if (q.r && q.x != null) circ(ctx, q.x, q.y, q.r);
    ctx.globalAlpha = 0.45; for (const f of R.fields || []) if (f.r && f.x != null) circ(ctx, f.x, f.y, f.r); ctx.globalAlpha = 0.95;
    // barriers (凝光の屏風 etc.)
    ctx.strokeStyle = '#4ae3ff';
    for (const w of R.barriers || []) if (!w.dead) rect(ctx, w.x, w.y, Math.atan2(w.uy, w.ux), w.half * 2, w.th * 2, false);
    // enemies + their telegraphs
    for (const e of R.enemies) {
      if (e.dead || !G.render.onScreen(e.x, e.y, 3)) continue;
      ctx.strokeStyle = e.boss || e.elite ? '#ff9a3c' : '#ff4d4d'; circ(ctx, e.x, e.y, e.r);
      if (e.tele) { ctx.strokeStyle = '#ff5ad8'; ctx.setLineDash([4 * px, 3 * px]); drawShape(ctx, e.tele); ctx.setLineDash([]); }
    }
    // enemy attacks
    ctx.strokeStyle = '#ff5ad8';
    for (const h of R.hazards) { if (h.t < h.delay) ctx.setLineDash([4 * px, 3 * px]); drawShape(ctx, h); ctx.setLineDash([]); }
    // player (+ pickup radius)
    const p = R.player; ctx.strokeStyle = '#5dff7a'; circ(ctx, p.x, p.y, p.r);
    if (R.stats && R.stats.pickup) { ctx.globalAlpha = 0.5; ctx.setLineDash([6 * px, 5 * px]); circ(ctx, p.x, p.y, R.stats.pickup); ctx.setLineDash([]); }
    ctx.restore();
  }

  /* ============================== per-frame upkeep (only while debug mode is on) ============================== */
  let upT = 0, last = 0;
  function tick(ts) {
    requestAnimationFrame(tick);
    if (!on) return;
    const dt = Math.min(0.1, (ts - last) / 1000 || 0); last = ts;
    const R = G.run;
    if (R && R.player && !R.over) {
      if (T.noCd) { R.player.skillCd = 0; R.player.burstCd = 0; }
      if (T.infEnergy && R.char) R.player.energy = R.char.energyCost;
    }
    upT += dt; if (upT < 0.3) return; upT = 0;
    if (overlay) {
      const fs = G.fx && G.fx.stats ? G.fx.stats() : {};
      overlay.textContent = R ? `FPS ${Math.round(G.fps)}  敵 ${R.enemies.filter(e => !e.dead).length}  攻撃 ${R.hazards.length}  弾 ${(R.projectiles || []).length}  粒子 ${fs.particles || 0}  ⏱${fmtT(R.time)}` + (T.speed !== 1 ? `  ×${T.speed}` : '') : `FPS ${Math.round(G.fps)}`;
    }
    if (isOpen) {
      info();
      if (isOpen && tab !== 'sortie' && !inRun()) render();       // run ended while the panel was open
      if (refresher) refresher();
    }
  }
  requestAnimationFrame(tick);
  G.bus.on('runStart', () => { if (on && T.god) setTimeout(() => G.debug.god(true), 0); });
  G.bus.on('scene', () => { if (isOpen) render(); });
  G.bus.on('assetsReady', () => { syncFab(); syncOverlay(); });

  return { get on() { return on; }, setMode, toggleMode, open, close, sortie, get cfg() { return cfg; }, set cfg(v) { cfg = Object.assign(defCfg(), v); saveCfg(); }, T };
})();
