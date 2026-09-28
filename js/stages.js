/* stages.js — stage list / unlock helpers, per-stage look (theme) and the dendro reactions of Sumeru (owner: STAGE).
   G.stages.list()        stage defs sorted by order
   G.stages.isOpen(id)    true when the stage's `requires` stage is cleared (G.save.data.cleared)
   G.stages.isCleared(id)
   G.stages.current()     def of G.run.stageId (Mondstadt outside runs)
   G.stages.theme(id)     look used by render.js (floor tint, ambient particles, grade colour) and the spawner
   Dendro (草) enemies react to the player's elements (combat.js has no dendro): 炎→燃焼 (burn DoT that spreads),
   雷→激化 (bonus hit), 水→開花 (a seed that bursts). Hooked on the 'enemyHit' bus event. */
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

  /* ================= dendro reactions (Sumeru) ================= */
  let busy = false;
  const RX = {
    burning: { name: '燃焼', color: '#ff9a3d' },
    quicken: { name: '激化', color: '#b6ff4a' },
    bloom:   { name: '開花', color: '#9dff6a' },
  };
  function react(R, e, key) {
    R.reactions[key] = (R.reactions[key] || 0) + 1;
    G.bus.emit('reaction', { type: key, x: e.x, y: e.y, enemy: e });
    G.fx.reactionText && G.fx.reactionText(e.x, e.y - e.def.h * 0.9, RX[key].name, RX[key].color);
  }
  function base(R, mul) { return R.stats.atk * mul * (1 + 0.05 * (R.player.level - 1)) * (1 + (R.stats.reactionBonus || 0)); }
  G.bus.on('enemyHit', ev => {
    const R = G.run, e = ev && ev.enemy; if (busy || !R || !e || e.dead || !e.def || e.def.element !== 'dendro') return;
    const el = ev.element, now = R.time; if (el !== 'pyro' && el !== 'electro' && el !== 'hydro') return;
    if ((e.dendroNext || 0) > now) return;
    busy = true;
    try {
      if (el === 'pyro') { // 燃焼: burns for a while, flames jump to nearby dendro enemies
        e.dendroNext = now + 1.0;
        if (!(e.burnUntil > now)) react(R, e, 'burning');
        e.burnUntil = now + 4; e.burnNext = Math.min(e.burnNext || now, now + 0.25);
        if (!burning.includes(e)) burning.push(e);
        G.fx.burst && G.fx.burst(e.x, e.y - e.def.h * 0.4, 8, '#ff9a3d', { max: 6, life: 0.4 });
      } else if (el === 'electro') { // 激化: a bright extra hit
        e.dendroNext = now + 0.6; react(R, e, 'quicken');
        G.combat.hit(R, e, { flat: base(R, 1.2), element: 'physical', gauge: 0, src: 'quicken', noCrit: false, isReaction: true, color: '#b6ff4a' });
        G.fx.lightning && G.fx.lightning(e.x - 0.4, e.y - e.def.h - 0.6, e.x, e.y - e.def.h * 0.4, '#b6ff4a');
      } else { // 開花: a dendro core pops out and bursts after 1 s
        e.dendroNext = now + 1.2; react(R, e, 'bloom');
        cores.push({ x: e.x + U.rand(-0.6, 0.6), y: e.y + U.rand(-0.4, 0.4), t: 0 });
      }
    } finally { busy = false; }
  });
  const burning = [], cores = [];
  G.bus.on('runStart', () => { burning.length = 0; cores.length = 0; });
  /** called from enemies.update (optional hook) */
  function update(R, dt) {
    if (!burning.length && !cores.length) return;
    const now = R.time;
    busy = true;
    try {
      for (let i = burning.length - 1; i >= 0; i--) {
        const e = burning[i];
        if (e.dead || !(e.burnUntil > now)) { burning[i] = burning[burning.length - 1]; burning.pop(); continue; }
        if (now >= e.burnNext) {
          e.burnNext = now + 0.5;
          G.combat.hit(R, e, { flat: base(R, 0.35), element: 'physical', gauge: 0, src: 'burning', noCrit: true, isReaction: true, quiet: true, color: '#ff9a3d' });
          if (!e.dead && U.chance(0.35)) { // flames spread to a neighbour
            const o = R.grid.nearest(e.x, e.y, 2.2, q => q !== e && q.def.element === 'dendro' && !(q.burnUntil > now));
            if (o) { o.burnUntil = now + 3; o.burnNext = now + 0.3; burning.push(o); }
          }
          if (U.chance(0.6)) G.fx.particle && G.fx.particle({ x: e.x + U.rand(-0.3, 0.3), y: e.y - U.rand(0.3, 1.2), vx: U.rand(-0.4, 0.4), vy: U.rand(-2.2, -1.2), life: 0.5, size: 0.14, color: '#ff8a2a', glow: true });
        }
      }
      for (let i = cores.length - 1; i >= 0; i--) {
        const c = cores[i]; c.t += dt;
        if (c.t >= 1.0) {
          cores[i] = cores[cores.length - 1]; cores.pop();
          G.combat.aoe(R, c.x, c.y, 2.0, { flat: base(R, 1.6), element: 'physical', gauge: 0, src: 'bloom', noCrit: true, isReaction: true, knock: 0.8, color: '#9dff6a' });
          G.fx.explosion && G.fx.explosion(c.x, c.y, 2.0, { color: '#8fd13a', kind: 'bloom' });
          G.fx.ring && G.fx.ring(c.x, c.y, 2.2, '#b6ff6a');
          G.audio.sfx('explosion', { x: c.x, y: c.y });
        }
      }
    } finally { busy = false; }
  }
  function drawGround(ctx) {
    if (!cores.length) return;
    const t = G.run ? G.run.time : 0;
    for (const c of cores) {
      const k = Math.min(1, c.t), r = 0.28 + 0.12 * Math.sin(t * 20) * k;
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9;
      ctx.drawImage(G.assets.glow('#8fd13a', 64), c.x - r * 3, c.y - 0.4 - r * 3, r * 6, r * 6);
      ctx.fillStyle = '#eaffc8'; ctx.beginPath(); ctx.arc(c.x, c.y - 0.4, r * 0.8, 0, U.TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
  }

  return { list, isOpen, isCleared, current, get, next, theme, THEMES, update, drawGround, reactions: RX };
})();
