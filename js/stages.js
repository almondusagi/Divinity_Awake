/* stages.js — stage list / unlock helpers, per-stage look (theme) and the dendro reactions of Sumeru (owner: STAGE).
   G.stages.list()        stage defs sorted by order
   G.stages.isOpen(id)    true when the stage's `requires` stage is cleared (G.save.data.cleared)
   G.stages.isCleared(id)
   G.stages.current()     def of G.run.stageId (Mondstadt outside runs)
   G.stages.theme(id)     look used by render.js (floor tint, ambient particles, grade colour) and the spawner
   Dendro reactions (燃焼 / 激化 / 開花) are handled generically in combat.js since v6 (dendro enemies start with a dendro aura). */
'use strict';
G.stages = (function () {
  const U = G.u;
  function list() { return Object.values(G.data.stages).sort((a, b) => (a.order || 0) - (b.order || 0)); }
  function cleared() { return (G.save && G.save.data && G.save.data.cleared) || {}; }
  function isCleared(id) { return !!cleared()[id]; }
  function isOpen(id) { const d = G.data.stages[id]; if (!d) return false; return !d.requires || isCleared(d.requires); }
  function current() { const R = G.run; return G.data.stages[(R && R.stageId) || 'mondstadt'] || G.data.stages.mondstadt; }
  function get(id) { return G.data.stages[id] || G.data.stages.mondstadt; }
  /** the next stage after id (or null) */
  function next(id) { const l = list(), i = l.findIndex(s => s.id === id); return i >= 0 && i < l.length - 1 ? l[i + 1] : null; }

  /* ---- looks: floor tint + ambience per stage (render.js) ----
     amb: particle kinds drifting over the field; grade: colour of the screen-space grade; wind: gust/ribbon colour */
  const THEMES = {
    mondstadt: { floor: 'floor', tint: null, amb: 'meadow', grade: null, wind: '#5cf2c8', flies: true, ground: '#4f8a40' },
    liyue: { floor: 'floor_liyue', tint: 'rgba(255,196,90,0.10)', amb: 'liyue', grade: 'rgba(255,190,90,0.07)', wind: '#ffd24a', flies: false, ground: '#8a7650',
      pal: ['#ffd24a', '#ffb23a', '#f6e27a'] },
    inazuma: { floor: 'floor_inazuma', tint: 'rgba(140,90,200,0.05)', amb: 'inazuma', grade: 'rgba(100,50,170,0.04)', wind: '#c77dff', flies: false, ground: '#5a4a6a',
      pal: ['#ffc4dc', '#ff9ec4', '#ffe6f0'] },
    sumeru: { floor: 'floor_sumeru', tint: 'rgba(90,170,60,0.08)', amb: 'sumeru', grade: 'rgba(40,110,40,0.08)', wind: '#8fd13a', flies: true, ground: '#3f6a34',
      pal: ['#b6ff6a', '#8fd13a', '#e6ffb0'] },
  };
  function theme(id) { return THEMES[id || (G.run && G.run.stageId) || 'mondstadt'] || THEMES.mondstadt; }

  /* ================= dendro reactions =================
     v6 (DENDRO): 燃焼 / 激化 / 開花 now live in combat.js and work on ANY enemy carrying a dendro aura (the 草型ランチャー
     applies it; Sumeru's dendro enemies carry it innately like the other elemental enemies). These two hooks stay as
     no-ops for older callers (enemies.js calls update / drawGround) so nothing triggers twice. */
  const RX = { burning: G.combat.REACT.burning, quicken: G.combat.REACT.quicken, bloom: G.combat.REACT.bloom };
  function update() { }
  function drawGround() { }

  return { list, isOpen, isCleared, current, get, next, theme, THEMES, update, drawGround, reactions: RX };
})();
