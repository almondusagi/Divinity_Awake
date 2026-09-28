/* unlocks.js — character unlocks + stage display helpers for the UI (owner: UI).
   Characters: amber / xingqiu are always open. Others carry data.js `unlock: { stage, mora }`:
     'locked'  — the stage is not cleared yet (silhouette on the home roster)
     'buyable' — the stage is cleared; pay `mora` to unlock
     'open'    — bought (G.save.data.chars[id] = true)
   Stages: reads STAGE's G.stages.list()/isOpen() and G.data.stages[id] display fields when they exist,
   and falls back to a built-in table so the UI works before / without them.
   Per-stage records: G.save.data.stageRec[id] = { runs, clears, best, kills } (UI-owned, written on runEnd). */
'use strict';
G.unlocks = (function () {
  const S = () => G.save.data;
  const U = G.u;
  /* ---------------- stages ---------------- */
  const STAGE_FB = [
    { id: 'mondstadt', order: 1, name: 'モンドの風跡', region: 'モンド', element: 'anemo', bgSmall: 'title_bg_small', boss: 'venti', bossName: 'ウェンティ', color: '#5cf2c8', requires: null },
    { id: 'liyue', order: 2, name: '璃月', region: '璃月', element: 'geo', bgSmall: 'bg_liyue_small', boss: 'zhongli', bossName: '鍾離', color: '#ffd24a', requires: 'mondstadt' },
    { id: 'inazuma', order: 3, name: '稲妻', region: '稲妻', element: 'electro', bgSmall: 'bg_inazuma_small', boss: 'raiden', bossName: '雷電将軍', color: '#c77dff', requires: 'liyue' },
    { id: 'sumeru', order: 4, name: 'スメール', region: 'スメール', element: 'dendro', bgSmall: 'bg_sumeru_small', boss: 'nahida', bossName: 'ナヒーダ', color: '#8fdc5a', requires: 'inazuma' },
  ];
  function cleared() { const s = S(); if (!s.cleared || typeof s.cleared !== 'object') s.cleared = {}; return s.cleared; }
  function isCleared(id) { return !!cleared()[id]; }
  /** display def of a stage (STAGE's data merged over the fallback) */
  function stage(id) {
    const fb = STAGE_FB.find(s => s.id === id) || { id, order: 9, name: id, boss: 'venti', bossName: '', requires: null };
    const d = (G.data.stages && G.data.stages[id]) || null;
    const o = Object.assign({}, fb, d || {});
    o.implemented = !!d;
    o.bgSmall = (d && (d.bgSmall || (d.bg ? d.bg + '_small' : null))) || fb.bgSmall;
    if (o.bgSmall === 'title_bg_small' || o.bgSmall === 'title_bg') o.bgSmall = 'title_bg_small';
    o.stars = o.stars || o.order || 1;
    return o;
  }
  function stageList() {
    let ids = STAGE_FB.map(s => s.id);
    try { if (G.stages && typeof G.stages.list === 'function') { const l = G.stages.list(); if (l && l.length) ids = l.map(s => s.id || s); } } catch (e) { }
    return ids.map(stage).sort((a, b) => a.order - b.order);
  }
  function stageOpen(id) {
    const d = stage(id); if (!d.implemented) return false;
    try { if (G.stages && typeof G.stages.isOpen === 'function') return !!G.stages.isOpen(id); } catch (e) { }
    return !d.requires || isCleared(d.requires);
  }
  function stageName(id) { return stage(id).name; }
  function stageCond(id) {
    const d = stage(id);
    if (!d.implemented) return 'じゅんびちゅう';
    return d.requires ? stageName(d.requires) + ' をクリアで解放' : '';
  }
  function rec(id) {
    const s = S(); if (!s.stageRec || typeof s.stageRec !== 'object') s.stageRec = {};
    return s.stageRec[id] || { runs: 0, clears: 0, best: 0, kills: 0 };
  }

  /* ---------------- characters ---------------- */
  function def(id) { return G.data.characters[id]; }
  function chars() { const s = S(); if (!s.chars || typeof s.chars !== 'object') s.chars = {}; return s.chars; }
  function charState(id) {
    const c = def(id); if (!c) return 'locked';
    if (!c.unlock || chars()[id]) return 'open';
    return (!c.unlock.stage || isCleared(c.unlock.stage)) ? 'buyable' : 'locked';
  }
  function cost(id) { const c = def(id); return (c && c.unlock && c.unlock.mora) || 0; }
  /** list of conditions [{text, ok}] */
  function conds(id) {
    const c = def(id); if (!c || !c.unlock) return [];
    const out = [];
    if (c.unlock.stage) out.push({ kind: 'stage', text: stageName(c.unlock.stage) + 'をクリア', ok: isCleared(c.unlock.stage) });
    if (c.unlock.mora) out.push({ kind: 'mora', text: U.fmtNum(c.unlock.mora) + 'モラ', ok: (S().mora || 0) >= c.unlock.mora, cost: c.unlock.mora });
    return out;
  }
  function condText(id) { return conds(id).map(c => '「' + c.text + '」').join('＋'); }
  function buy(id) {
    if (charState(id) !== 'buyable') return false;
    const s = S(), m = cost(id);
    if ((s.mora || 0) < m) return false;
    s.mora -= m; chars()[id] = true;
    try { G.save.write(); } catch (e) { }
    G.bus.emit('charUnlocked', { id });
    return true;
  }
  /** debug / tools */
  function setChar(id, open) { const c = chars(); if (open) c[id] = true; else delete c[id]; try { G.save.write(); } catch (e) { } }
  function setCleared(id, v) { const c = cleared(); if (v) c[id] = true; else delete c[id]; try { G.save.write(); } catch (e) { } }

  /* ---------------- save upkeep ---------------- */
  function migrate() {
    const s = S(); cleared(); chars(); rec('mondstadt');
    // saves from before stages: every clear was a Mondstadt clear
    if (!s.stageRec.mondstadt && s.stats && (s.stats.runs || 0) > 0)
      s.stageRec.mondstadt = { runs: s.stats.runs | 0, clears: s.stats.clears | 0, best: s.stats.bestTime | 0, kills: s.stats.bestKills | 0 };
    if ((s.stats && s.stats.clears > 0) && !s.cleared.mondstadt) s.cleared.mondstadt = true;
  }
  G.bus.on('assetsReady', () => { try { migrate(); G.save.write(); } catch (e) { console.error('[unlocks] migrate', e); } });
  G.bus.on('saveReset', () => { try { migrate(); } catch (e) { } });
  let before = null;
  G.bus.on('runStart', () => { before = { cleared: Object.assign({}, cleared()), states: {} }; (G.data.roster || []).forEach(id => { before.states[id] = charState(id); }); });
  G.bus.on('runEnd', R => {
    try {
      const s = S(), id = R.stageId || 'mondstadt';
      if (!s.stageRec || typeof s.stageRec !== 'object') s.stageRec = {};
      const r = s.stageRec[id] = Object.assign({ runs: 0, clears: 0, best: 0, kills: 0 }, s.stageRec[id]);
      r.runs++; if (R.victory) r.clears++;
      r.best = Math.max(r.best, Math.floor(R.time)); r.kills = Math.max(r.kills, R.kills | 0);
      G.save.write();
    } catch (e) { console.error('[unlocks] runEnd', e); }
  });
  /** what this run newly unlocked (for the results screen) */
  function newlyUnlocked() {
    if (!before) return { stages: [], chars: [] };
    const st = stageList().filter(d => !before.cleared[d.requires] && d.requires && isCleared(d.requires) && d.implemented).map(d => d.id);
    const ch = (G.data.roster || []).filter(id => before.states[id] === 'locked' && charState(id) !== 'locked');
    return { stages: st, chars: ch };
  }

  return { charState, buy, condText, conds, cost, setChar, setCleared, isCleared, stage, stageList, stageOpen, stageName, stageCond, rec, newlyUnlocked, migrate };
})();
