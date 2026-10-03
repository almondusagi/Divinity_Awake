/* godfall.js — the end of a stage's god (owner: BOSS, v6).
   • 20 % HP: a cinematic subtitle line (G.data.enemies[god].lines.low) — the fight does not pause.
   • HP 0 : the god freezes (no AI, no attacks, untargetable), says its last line (lines.death), BGM fades out,
            the world dims to a cold grey and rain starts; then the god fades away and only THEN bursts and drops
            a special chest. Walking onto the chest → short opening flourish → G.game.end(true, 'clear').
   • From the moment the god falls: R.bossDefeated (no level-ups, no spawns, the player can't be hurt).
   Hooks: enemies.kill → begin(); game.step → update(); enemies.drawEnemy → drawGod(); loot.update/draw → chest;
          render.drawRun → drawScreen() (dim + rain, screen space). */
'use strict';
G.godfall = (function () {
  const U = G.u;
  const LOW_DUR = 4.5;                 // 20 % line on screen (sim s)
  const T_LINE = 0.55, LINE_DUR = 4.3; // death line
  const T_FADE = 4.9, FADE_DUR = 1.5;  // god fades out after the line
  const T_DROP = T_FADE + FADE_DUR + 0.1;
  const T_RAIN = 1.0, RAIN_RAMP = 3.5; // dim + rain ease in while the line is still on screen
  const OPEN_DUR = 1.35;               // chest flourish before the clear screen

  /* ---------------- telop (DOM, inside the HUD banner layer) ---------------- */
  let cssDone = false, telop = null, telopEnd = 0;
  function css() {
    if (cssDone) return; cssDone = true;
    const s = document.createElement('style'); s.id = 'godfall-css';
    s.textContent = `
.gf-telop{position:absolute;left:50%;bottom:calc(10% + env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:min(840px,68vw);
  box-sizing:border-box;text-align:center;padding:13px 44px 15px;pointer-events:none;
  background:linear-gradient(90deg,rgba(5,8,16,0),rgba(5,8,16,.8) 16%,rgba(5,8,16,.8) 84%,rgba(5,8,16,0));animation:gfIn .55s ease-out both}
.gf-telop::before,.gf-telop::after{content:'';position:absolute;left:14%;right:14%;height:1px;background:linear-gradient(90deg,transparent,rgba(240,214,160,.6),transparent)}
.gf-telop::before{top:0}.gf-telop::after{bottom:0}
.gf-telop .nm{font-weight:800;font-size:11px;line-height:1;letter-spacing:.45em;padding-left:.45em;color:#e6cd96;margin-bottom:9px;text-shadow:0 1px 3px #000;opacity:.92}
.gf-telop .tx{font-family:var(--serif,serif);font-weight:700;font-size:clamp(14px,4.6vh,21px);line-height:1.62;letter-spacing:.06em;color:#f7f2e8;
  text-shadow:0 0 14px rgba(0,0,0,.95),0 1px 2px #000;word-break:keep-all;overflow-wrap:anywhere}
.gf-telop .tx span{display:inline-block;opacity:0;animation:gfCh .42s ease-out forwards;animation-delay:var(--d)}
.gf-telop.death{background:linear-gradient(90deg,rgba(6,10,20,0),rgba(6,10,20,.84) 16%,rgba(6,10,20,.84) 84%,rgba(6,10,20,0))}
.gf-telop.death::before,.gf-telop.death::after{background:linear-gradient(90deg,transparent,rgba(180,205,235,.55),transparent)}
.gf-telop.death .nm{color:#bcd0e8}
.gf-telop.out{animation:gfOut .5s ease-in forwards}
@keyframes gfIn{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes gfOut{to{opacity:0;transform:translate(-50%,4px)}}
@keyframes gfCh{from{opacity:0;transform:translateY(4px);filter:blur(3px)}to{opacity:1;transform:none;filter:none}}
.bn-big.fall .bk{color:#c6d6ea}.bn-big.fall .bt{color:#eef3fa;text-shadow:0 0 18px #6f8fba,0 2px 4px #000}.bn-big.fall .bd{color:#dfe8f4}
.bn-big.fall .glow{background:#4f6d9a66}
@media (max-height:460px){.gf-telop{bottom:calc(17% + env(safe-area-inset-bottom,0px));width:min(560px,52vw);padding:9px 26px 11px}.gf-telop .tx{font-size:clamp(13px,4.3vh,18px);line-height:1.55}.gf-telop .nm{font-size:10px;margin-bottom:6px}}
@media (prefers-reduced-motion:reduce){.gf-telop .tx span{animation-duration:.01s}}`;
    document.head.append(s);
  }
  function removeTelop() {
    if (!telop) return; const n = telop; telop = null;
    n.classList.add('out'); setTimeout(() => n.remove(), 520);
  }
  function showTelop(R, def, text, dur, kind) {
    css(); removeTelop();
    const layer = (G.hud && G.hud.layer) || document.body;
    const node = document.createElement('div'); node.className = 'gf-telop ' + kind;
    const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = def.name || '';
    const tx = document.createElement('div'); tx.className = 'tx';
    // typewriter: per-character fade-in, small rests after punctuation
    let d = 0.25; const reduced = G.save && G.save.data.settings.reducedFx;
    for (const ch of Array.from(text)) {
      const s = document.createElement('span'); s.textContent = ch; s.style.setProperty('--d', (reduced ? 0 : d).toFixed(3) + 's'); tx.append(s);
      d += /[。？！]/.test(ch) ? 0.26 : /[、]/.test(ch) ? 0.14 : ch === '…' ? 0.07 : ch === '―' ? 0.06 : 0.045;
    }
    node.append(nm, tx); layer.append(node);
    telop = node; telopEnd = R.time + dur;
    return node;
  }

  /* ---------------- the death sequence ---------------- */
  function begin(R, e, src) {
    if (!R || !e || e.dead || e.dying) return;
    e.dying = true; e.dieSrc = src; e.hp = 0;
    e.tele = null; e.held = null; e.charge = null; e.dashing = false; e.shakeAmp = 0; e.squash = 0; e.pose = 'idle';
    e.kx = e.ky = 0; e.frozenUntil = 0; e.flash = 1; e.invulnSpawn = false; e.spawnT = 0; e.enraged = false;
    R.bossDefeated = true;
    if (R.boss === e) R.boss = null; // boss bar fades out; spawner/HUD treat the fight as over
    R.gf = { e, t: 0, x: e.x, y: e.y, said: false, wk: 0, dropped: false, chest: null, openT: -1, ended: false };
    // freeze every enemy attack and roll the finale shockwave through the horde right away (mid-bosses fall too)
    const hs = R.hazards.slice(); R.hazards.length = 0;
    for (const h of hs) if (h.type === 'pillar' && h.onEnd) { try { h.onEnd(R, h); } catch (err) { } } // 岩柱 crumble instead of popping out
    if (G.enemyFx && G.enemyFx.finale) G.enemyFx.finale(R, e.x, e.y, 9, 40);
    for (const o of R.enemies) if (!o.dead && o !== e && o.boss && !(o.dieAt > 0)) { o.dieAt = R.time + 0.7; o.dieSrc = 'finale'; }
    removeTelop();
    G.fx.hitstop(0.08); G.fx.shake(0.6); G.fx.flash('#ffffff', 0.35);
    try { G.audio.bgm(null); } catch (err) { /* audio optional */ }
    G.bus.emit('godfall', e);
  }

  function clampToView(R, x, y) {
    const p = R.player, ex = G.render.halfExtents();
    // keep the whole chest (it stands ~2.5 units tall) comfortably inside the view around the player
    const mx = Math.max(1.5, ex.x - 2.2), top = Math.max(1.2, ex.y - 3.6), bot = Math.max(1.2, ex.y - 1.6);
    return { x: U.clamp(x, p.x - mx, p.x + mx), y: U.clamp(y, p.y - top, p.y + bot) };
  }

  function update(R, dt) {
    // 20 % line (queued while a phase-transition banner is up, at most 3 s)
    const b = R.boss;
    if (b && !b.dead && !b.dying && b.def.final && b.def.lines && !b.lowSaid && b.spawnT <= 0 && b.hp <= b.maxHp * 0.2) {
      if (b.lowQ == null) b.lowQ = R.time;
      if (b.st !== 'phase' || R.time - b.lowQ > 3) { b.lowSaid = true; showTelop(R, b.def, b.def.lines.low, LOW_DUR, 'low'); }
    }
    if (telop && R.time >= telopEnd) removeTelop();
    const gf = R.gf; if (!gf || gf.ended) return;
    gf.t += dt;
    const e = gf.e, t = gf.t;
    gf.wk = U.clamp((t - T_RAIN) / RAIN_RAMP, 0, 1);
    if (t >= T_RAIN && !gf.rain) { gf.rain = true; try { G.audio.rain && G.audio.rain(true); } catch (err) { } }
    if (!gf.said && t >= T_LINE) {
      gf.said = true;
      const L = e.def.lines;
      if (L && L.death) showTelop(R, e.def, L.death, LINE_DUR, 'death');
    }
    if (!e.dead && t >= T_FADE) { // drifting motes leave the body while it fades
      const k = (t - T_FADE) / FADE_DUR, H = e.def.h || 2.5;
      if (U.chance(dt * (26 - 14 * k)) && G.fx.particle) {
        G.fx.particle({ x: e.x + U.rand(-0.5, 0.5), y: e.y - (e.z || 0) - H * U.rand(0.1, 0.9), vx: U.rand(-0.25, 0.25), vy: U.rand(-1.6, -0.6), life: U.rand(1.0, 1.7), size: U.rand(0.08, 0.15), color: '#dfe9f7', drag: 0.4 });
      }
    }
    if (!gf.dropped && t >= T_DROP) {
      gf.dropped = true;
      e.godfallDone = true;
      G.enemies.kill(R, e, e.dieSrc || 'godfall'); // → loot (special chest), bursts, bossKilled
    }
    if (gf.openT >= 0 && R.time - gf.openT >= OPEN_DUR && !R.over) {
      gf.ended = true;
      // anything still lying around that the results care about is gathered up
      const S = R.stats || {};
      for (const o of R.pickups) {
        if (o.type === 'mora') R.mora += Math.round(o.value * (S.moraMul || 1));
        else if (o.type === 'relic') R.relicsFound = (R.relicsFound || 0) + 1;
      }
      G.game.end(true, 'clear');
    }
  }

  /** loot.onEnemyKilled for the final boss: the special chest where it fell (kept on screen) */
  function dropChest(R, e) {
    const gf = R.gf; if (!gf) return null;
    const pt = clampToView(R, e.x, e.y);
    const o = G.loot.add(R, { type: 'godchest', x: pt.x, y: pt.y, vx: 0, vy: 0, vz: 9 });
    gf.chest = o;
    return o;
  }

  /** loot.update: the god chest is never magnet-pulled; touching it opens it */
  function updateChest(R, o, dt) {
    if (o.vz || o.z > 0) { o.z += o.vz * dt; o.vz -= 18 * dt; if (o.z <= 0) { o.z = 0; o.vz = o.vz < -3 ? -o.vz * 0.3 : 0; if (!o.landed && !o.vz) { o.landed = true; G.fx.ring && G.fx.ring(o.x, o.y, 2.2, '#ffe9a8'); G.fx.shake(0.25); } } }
    if (o.opening || o.t < 0.7 || R.over) return;
    const p = R.player;
    if (Math.hypot(p.x - o.x, p.y - o.y) < 0.95 + (p.r || 0.4) * 0.5) open(R, o);
  }
  function open(R, o) {
    o.opening = true; o.openRT = R.realTime;
    const gf = R.gf || (R.gf = { t: 99, said: true, wk: 1, dropped: true, ended: false });
    gf.openT = R.time;
    G.fx.pillar(o.x, o.y + 0.1, '#ffe9a8', 16, 4.2, 1.5);
    G.fx.rays(o.x, o.y - 0.9, 8, '#fff4c8', 1.4);
    G.fx.sparkle(o.x, o.y - 0.8, '#ffe9a8', 44, 1.8);
    G.fx.ring && G.fx.ring(o.x, o.y, 4.5, '#ffe9a8');
    G.fx.flash('#fff8e0', 0.45); G.fx.zoomPunch && G.fx.zoomPunch(0.06);
    G.audio.sfx('chestOpen');
    G.bus.emit('godChestOpen', o);
  }

  /** loot.draw: golden glow, tall beam, bobbing chest; while opening: lid light + swelling glow */
  function drawChest(ctx, o, y, t) {
    const x = o.x, gy = o.y; // gy: ground
    const opening = !!o.opening, ok = opening ? Math.min(1, (G.run.realTime - o.openRT) / 0.6) : 0;
    const bob = opening ? 0 : Math.sin(t * 2.2) * 0.12 + 0.12;
    const cy = y - bob;
    ctx.globalCompositeOperation = 'lighter';
    // ground glow
    ctx.globalAlpha = 0.55 + Math.sin(t * 3) * 0.12 + ok * 0.4;
    ctx.drawImage(G.assets.glow('#ffd24a', 64), x - 2.6, gy - 1.3, 5.2, 2.6);
    // beam: wide soft column + bright core
    const bh = 13, bw = 0.95 + Math.sin(t * 2.4) * 0.08 + ok * 1.2;
    ctx.globalAlpha = 0.28 + Math.sin(t * 2.4) * 0.06 + ok * 0.4; ctx.fillStyle = '#ffd86a'; ctx.fillRect(x - bw / 2, cy - bh, bw, bh);
    ctx.globalAlpha = 0.5 + ok * 0.4; ctx.fillStyle = '#fff6d8'; ctx.fillRect(x - 0.08 - ok * 0.2, cy - bh, 0.16 + ok * 0.4, bh);
    // halo around the chest
    ctx.globalAlpha = 0.7 + Math.sin(t * 4) * 0.15; ctx.drawImage(G.assets.glow('#ffe27a', 64), x - 1.9, cy - 2.4, 3.8, 3.8);
    // rising golden motes along the beam
    for (let i = 0; i < 5; i++) {
      const k = (t * 0.55 + i / 5) % 1; ctx.globalAlpha = (1 - k) * 0.9;
      const s = 0.42 - k * 0.2;
      ctx.drawImage(G.assets.glow(i & 1 ? '#fff4c8' : '#ffd24a', 32), x + Math.sin(t * 2 + i * 1.7) * 0.55 - s / 2, cy - 0.6 - k * 6 - s / 2, s, s);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    const sc = 1.85 * (1 + (opening ? Math.sin(Math.min(1, ok * 1.4) * Math.PI) * 0.18 : 0));
    G.render.icon(ctx, 'chest', x, cy, sc, opening ? 0 : Math.sin(t * 1.6) * 0.04);
    if (opening) { // light spilling out of the lid
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = ok;
      ctx.drawImage(G.assets.glow('#fffbe8', 64), x - 1.6 * (1 + ok), cy - 1.2 - 1.6 * (1 + ok), 3.2 * (1 + ok), 3.2 * (1 + ok));
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  }

  /** enemies.drawEnemy for a dying god: still → fade to nothing (cool tint, white motes) */
  function godAlpha(R, e) {
    const gf = R.gf; if (!gf || gf.e !== e) return 1;
    return 1 - U.clamp((gf.t - T_FADE) / FADE_DUR, 0, 1);
  }

  /* ---------------- dim + rain (screen space, CSS px) ---------------- */
  const drops = [], splashes = [];
  let lastNow = 0;
  function drawScreen(ctx) {
    const R = G.run, gf = R && R.gf; if (!gf || !(gf.wk > 0)) return;
    const W = G.view.w, H = G.view.h, k = gf.wk;
    const now = performance.now() / 1000, dt = Math.min(0.05, lastNow ? Math.max(0, now - lastNow) : 0.016); lastNow = now;
    const q = G.save.data.settings.reducedFx ? 0 : (G.quality ? G.quality.level : 3);
    ctx.save();
    // cold, desaturated, ~35 % darker world
    if (q >= 1) { ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = 0.6 * k; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H); }
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = k; ctx.fillStyle = 'rgb(152,166,192)'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    const fog = ctx.createLinearGradient(0, 0, 0, H);
    fog.addColorStop(0, `rgba(18,26,42,${(0.38 * k).toFixed(3)})`); fog.addColorStop(0.45, 'rgba(18,26,42,0)');
    fog.addColorStop(1, `rgba(10,14,26,${(0.22 * k).toFixed(3)})`);
    ctx.globalAlpha = 1; ctx.fillStyle = fog; ctx.fillRect(0, 0, W, H);
    // the god's chest is the one warm light left: drawn again above the grade so it keeps its gold
    const c = gf.chest;
    if (c && G.render.onScreen(c.x, c.y, 14)) {
      const rt = R.realTime;
      G.render.beginWorld(ctx); ctx.globalAlpha = 1;
      try { drawChest(ctx, c, c.y - c.z - 0.3 - Math.sin(rt * 4 + c.x) * 0.06, rt); } finally { ctx.restore(); }
    }
    // rain streaks
    const want = Math.min(q >= 2 ? 300 : 150, Math.round(W * H / (q >= 2 ? 4200 : 7000) * k));
    while (drops.length < want) drops.push(newDrop(W, H, true));
    if (drops.length > want) drops.length = want;
    const slant = 0.24;
    const paths = [[], [], []];
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      d.y += d.v * dt; d.x += d.v * slant * dt;
      if (d.y > d.end || d.x > W + 40) {
        if (d.y > d.end && d.y < H && splashes.length < 40 && Math.random() < 0.5) splashes.push({ x: d.x, y: d.end, t: 0, r: 4 + Math.random() * 6 });
        drops[i] = newDrop(W, H, false); continue;
      }
      paths[d.b].push(d);
    }
    ctx.lineCap = 'round';
    const A = [0.16, 0.26, 0.38];
    for (let b = 0; b < 3; b++) {
      const list = paths[b]; if (!list.length) continue;
      ctx.strokeStyle = `rgba(206,220,242,${(A[b] * (0.4 + 0.6 * k)).toFixed(3)})`; ctx.lineWidth = b === 2 ? 1.4 : 1;
      ctx.beginPath();
      for (const d of list) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.len * slant, d.y - d.len); }
      ctx.stroke();
    }
    // splash rings on the ground
    ctx.lineWidth = 1;
    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i]; s.t += dt; const f = s.t / 0.38;
      if (f >= 1) { splashes.splice(i, 1); continue; }
      ctx.strokeStyle = `rgba(214,228,248,${(0.4 * (1 - f) * k).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * (0.3 + f), s.r * 0.32 * (0.3 + f), 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
  function newDrop(W, H, anywhere) {
    const b = Math.random() < 0.45 ? 0 : Math.random() < 0.7 ? 1 : 2;
    const v = (b === 0 ? 620 : b === 1 ? 860 : 1120) * (0.85 + Math.random() * 0.3);
    return { x: Math.random() * (W + H * 0.25) - H * 0.25, y: anywhere ? Math.random() * H : -Math.random() * 60 - 10, v, len: (b === 0 ? 10 : b === 1 ? 16 : 24) * (0.8 + Math.random() * 0.4), b,
      end: H * (0.3 + Math.random() * 0.75) }; // where it "lands" (some fall past the bottom)
  }

  G.bus.on('runStart', () => { removeTelop(); drops.length = 0; splashes.length = 0; try { G.audio.rain && G.audio.rain(false); } catch (e) { } });
  G.bus.on('runEnd', () => { removeTelop(); try { G.audio.rain && G.audio.rain(false); } catch (e) { } });
  G.bus.on('scene', s => { if (s !== 'run') { removeTelop(); try { G.audio.rain && G.audio.rain(false); } catch (e) { } } });

  return { begin, update, dropChest, updateChest, drawChest, godAlpha, drawScreen, showTelop, T: { T_LINE, LINE_DUR, T_FADE, FADE_DUR, T_DROP, OPEN_DUR } };
})();
