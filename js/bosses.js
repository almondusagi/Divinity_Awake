/* bosses.js — the three stage gods (owner: STAGE): 鍾離 (璃月・岩), 雷電将軍 (稲妻・雷), ナヒーダ (スメール・草) + ナヒーダの幻影.
   Registered into G.enemyAI like ウェンティ: G.enemyAI[ai](R, e, dt, nx, ny, dist) -> velocity | null.
   Rules kept from the ENEMY owner: every hit is telegraphed (≥0.6 s, big ones 1–2 s) and every attack wears the black-purple
   aura (G.enemyFx.darkAura / auraLite, dark outlines under the elemental glow).
   Phases: 1 (100%) → 2 (<65%) → 3 (<30%): more attacks, bigger versions.
   Custom hazards use the optional hooks of G.enemies.hazard: h.upd(R,h,dt), h.drawG(ctx,h,t), h.drawA(ctx,h,t).
   Debug: G.enemyAI.seqs.{zhongli,raiden,nahida}[phase] and G.enemyAI.bossDebug.{setPhase(e,ph), attack(e,atk), names}. */
'use strict';
(function () {
  const A = G.enemyAI, U = G.u, TAU = U.TAU;
  const V = { x: 0, y: 0 };
  const FX = () => G.enemyFx;
  function vel(x, y) { V.x = x; V.y = y; return V; }
  function set(e, st, dur) { e.st = st; e.stT = 0; e.stDur = dur || 0; }
  function hz(R, h) { return G.enemies.hazard(R, h); }
  function sfx(n, at) { G.enemyFx.sfx(n, at ? at.x : null, at ? at.y : null, true); }
  function notice(text, color) { G.bus.emit('notice', { text, color: color || '#ff5a7a' }); }
  function faceTo(e, x, y) { const fx = x - e.x, fy = y - e.y; if (Math.abs(fx) + Math.abs(fy) > 0.01) { e.face.x = fx; e.face.y = fy; } }
  function hurtP(R, h, dmg, x, y) { return G.player.hurt(R, dmg == null ? h.dmg : dmg, { x: x == null ? h.x : x, y: y == null ? h.y : y, kind: h.src || h.type }); }
  function inCircle(p, x, y, r) { const dx = p.x - x, dy = p.y - y, rr = r + p.r; return dx * dx + dy * dy < rr * rr; }
  function inLane(p, x, y, ang, len, w) { const c = Math.cos(ang), s = Math.sin(ang), dx = p.x - x, dy = p.y - y, al = dx * c + dy * s, pe = Math.abs(-dx * s + dy * c); return al > -p.r && al < len + p.r && pe < w / 2 + p.r; }
  function near(R, x, y, d) { const p = R.player; return U.dist(x, y, p.x, p.y) < d; }
  function onS(x, y, m) { return G.render.onScreen(x, y, m); }
  const qlv = () => G.save.data.settings.reducedFx ? 0 : (G.quality ? G.quality.level : 3);
  function count(R, type) { let n = 0; for (const h of R.hazards) if (h.type === type && !h.done) n++; return n; }

  /* ---------------- shared boss plumbing ---------------- */
  const COL = { zhongli: '#ffd24a', raiden: '#c77dff', nahida: '#8fd13a' };
  const PH_TEXT = {
    zhongli: ['', '', '岩の力が 目覚める…！', '天が 落ちてくる…！'],
    raiden: ['', '', '雷鳴が とどろく…！', '無想の境地…！'],
    nahida: ['', '', '夢の森が ひろがる…！', '知恵の嵐が くる！'],
  };
  const TH = [0, 1, 0.65, 0.3]; // phase n starts below TH[n]
  function phaseUp(R, e, ph) {
    e.phase = ph; A.reset(e); set(e, 'phase', 2.0); e.armorMul = 0.05; e.pose = 'strike';
    const c = COL[e.def.ai];
    hz(R, { type: 'push', x: e.x, y: e.y, r: 9, force: 10, life: 0.8, dmg: 0 });
    FX().ring(e.x, e.y, 9, 0.8, 0.5, c); FX().ring(e.x, e.y, 6, 0.6, 0.35); FX().burst(e.x, e.y - 1.2, 3.5, 1);
    G.fx.flash && G.fx.flash(c, 0.35); G.fx.shake(0.6); G.fx.rays && G.fx.rays(e.x, e.y - 1.4, 7, c, 1.2);
    sfx('bossRoar', e); sfx('bossWarning');
    notice(PH_TEXT[e.def.ai][ph], c);
    G.bus.emit('stageEvent', { kind: 'bossPhase', phase: ph, boss: e });
  }
  function checkPhase(R, e) {
    if (e.st === 'phase') return false;
    if (e.phase < 3 && e.hp < e.maxHp * TH[e.phase + 1]) { phaseUp(R, e, e.phase + 1); return true; }
    return false;
  }
  function enrage(e) { if (e.enraged && !e.enrApplied) { e.enrApplied = true; e.dmg *= 1.35; notice(e.def.name + 'が本気になった！', COL[e.def.ai]); sfx('bossRoar', e); } }
  /** long-distance catch-up: vanish in an elemental burst and reappear near the player */
  function blink(R, e, d) {
    const c = COL[e.def.ai], p = R.player;
    FX().after(e, 0.7, c); FX().ring(e.x, e.y, 2, 0.4, 0.2, c);
    const a = U.rand(0, TAU); e.x = p.x + Math.cos(a) * (d || 7); e.y = p.y + Math.sin(a) * (d || 7) * 0.8;
    FX().ring(e.x, e.y, 2.5, 0.45, 0.25, c); FX().burst(e.x, e.y - 1, 1.6, 1);
  }
  function orbit(R, e, nx, ny, dist, want, spd) {
    e.turnT -= 1 / 60; if (e.turnT <= 0) { e.turnT = U.rand(3, 5); e.orbitDir *= -1; }
    const f = U.clamp((dist - want) * 0.6, -1, 1), tng = 0.7 * e.orbitDir, s = e.sp * (spd || 1.2);
    return vel((nx * f - ny * tng) * s, (ny * f + nx * tng) * s);
  }
  function nextAtk(e, seqs) { const seq = seqs[e.phase]; return seq[e.cycle++ % seq.length]; }

  const baseInit = A.init;
  A.init = function (R, e) {
    baseInit(R, e);
    const ai = e.def.ai;
    if (ai === 'zhongli' || ai === 'raiden' || ai === 'nahida') {
      e.phase = 1; e.cycle = 0; e.armorMul = 1; e.cd = 2.4; e.orbitDir = 1; e.turnT = 4; e.z = 0;
      if (ai === 'nahida') e.z = 0.4;
    }
    if (ai === 'nahidaClone') { e.cd = U.rand(1.2, 2); e.z = 0.4; e.fadeAt = R.time + 14; e.orbitDir = U.chance(0.5) ? 1 : -1; e.turnT = 3; }
  };
  // casting circles (drawn under the boss by G.enemyFx.drawGround) for our charge types
  const RR = G.enemyFx.RUNE_R; if (RR) { RR.geo = 2.4; RR.geoBig = 3.6; RR.musou = 3.0; RR.thunder = 2.0; RR.dendro = 2.4; RR.dream = 3.8; }

  /* ================= shared custom hazard painters ================= */
  /** lane that cuts once when its delay ends (iai / 夢想の一太刀 / vine whip) */
  function laneUpd(R, h, dt) {
    if (h.owner && h.owner.dead && !h.fired) { h.done = true; return; }
    if (!h.fired && h.t >= h.delay) {
      h.fired = true;
      if (inLane(R.player, h.x, h.y, h.ang, h.len, h.w)) hurtP(R, h, h.dmg, h.x + Math.cos(h.ang) * h.len * 0.5, h.y + Math.sin(h.ang) * h.len * 0.5);
      h.onFire && h.onFire(R, h);
    }
  }
  function laneDrawG(ctx, h, t) {
    if (!h.fired) { FX().teleLane(ctx, h.x, h.y, h.ang, h.len, h.w, Math.min(1, h.t / h.delay), t); return; }
    // afterglow: scorched lane
    const k = (h.t - h.delay) / Math.max(0.01, h.life), c = Math.cos(h.ang), s = Math.sin(h.ang);
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.ang);
    ctx.globalAlpha = 0.45 * (1 - k); ctx.fillStyle = '#0c0012'; ctx.fillRect(0, -h.w * 0.35, h.len, h.w * 0.7);
    ctx.restore(); ctx.globalAlpha = 1;
    void c; void s;
  }
  function laneDrawA(ctx, h, t) {
    if (!h.fired) return;
    const k = Math.min(1, (h.t - h.delay) / Math.max(0.01, h.life)), c = Math.cos(h.ang), s = Math.sin(h.ang);
    const x2 = h.x + c * h.len, y2 = h.y + s * h.len, lift = h.lift || 0.9, a = 1 - k;
    const grow = Math.min(1, (h.t - h.delay) / 0.07);
    const mx = h.x + c * h.len * grow, my = h.y + s * h.len * grow;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.75 * a; ctx.strokeStyle = '#0c0014'; ctx.lineWidth = h.w * 1.05; ctx.beginPath(); ctx.moveTo(h.x, h.y - lift); ctx.lineTo(mx, my - lift); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.7 * a; ctx.strokeStyle = '#7a22ff'; ctx.lineWidth = h.w * 0.8; ctx.beginPath(); ctx.moveTo(h.x, h.y - lift); ctx.lineTo(mx, my - lift); ctx.stroke();
    ctx.globalAlpha = 0.9 * a; ctx.strokeStyle = h.color || '#c77dff'; ctx.lineWidth = h.w * 0.42; ctx.beginPath(); ctx.moveTo(h.x, h.y - lift); ctx.lineTo(mx, my - lift); ctx.stroke();
    ctx.globalAlpha = a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(0.06, h.w * 0.1); ctx.beginPath(); ctx.moveTo(h.x, h.y - lift); ctx.lineTo(mx, my - lift); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'butt'; ctx.globalAlpha = 1;
    if (h.style === 'vine' && a > 0.2) { // leafy vine segments along the whip
      ctx.globalAlpha = a; ctx.fillStyle = '#3f8a1c';
      for (let d = 0.8; d < h.len * grow; d += 1.1) { const px = h.x + c * d, py = h.y + s * d - lift, w = Math.sin(d * 2.3 + t * 8) * 0.25; ctx.beginPath(); ctx.ellipse(px - s * w, py + c * w, 0.26, 0.12, h.ang + 0.7, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    FX().auraLite(ctx, x2, y2 - lift, h.w * 0.6, t * 2 + h.seed, a);
  }
  function lane(R, e, o) {
    return hz(R, Object.assign({ type: 'bossLane', owner: e, life: 0.35, upd: laneUpd, drawG: laneDrawG, drawA: laneDrawA, src: e.kind }, o));
  }

  /* ================= 鍾離 (璃月・岩神) ================= */
  const ZSEQ = {
    1: ['pillar', 'resonance', 'meteor', 'shield', 'pillar', 'resonance'],
    2: ['meteorRain', 'pillar', 'resonance', 'shield', 'pillarRing', 'meteor', 'resonance'],
    3: ['meteorRain', 'pillarRing', 'resonance', 'shield', 'meteorRain', 'pillar', 'resonance'],
  };
  // stone pillar sprite (generic geo column — no character art)
  let pillarC = null;
  function pillarSprite() {
    if (pillarC) return pillarC;
    const W = 96, H = 220; pillarC = G.assets.makeCanvas(W, H); const x = pillarC.getContext('2d');
    x.beginPath(); x.moveTo(14, H - 6); x.lineTo(10, 40); x.lineTo(30, 14); x.lineTo(62, 8); x.lineTo(86, 34); x.lineTo(84, H - 6); x.closePath();
    let g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#5e4a2e'); g.addColorStop(0.35, '#b89a60'); g.addColorStop(0.6, '#8a6e40'); g.addColorStop(1, '#3e2f1c');
    x.fillStyle = g; x.fill(); x.lineWidth = 5; x.strokeStyle = '#1e140a'; x.stroke();
    // top facet
    x.beginPath(); x.moveTo(10, 40); x.lineTo(30, 14); x.lineTo(62, 8); x.lineTo(86, 34); x.lineTo(56, 44); x.closePath(); x.fillStyle = '#d9c08a'; x.fill(); x.stroke();
    // glowing geo runes (generic lines & diamonds)
    x.strokeStyle = 'rgba(255,210,74,.5)'; x.lineWidth = 9; x.beginPath(); x.moveTo(48, 60); x.lineTo(48, H - 30); x.stroke();
    x.strokeStyle = '#ffe9a0'; x.lineWidth = 3; x.beginPath(); x.moveTo(48, 60); x.lineTo(48, H - 30); x.stroke();
    for (let i = 0; i < 3; i++) { const cy = 80 + i * 45; x.beginPath(); x.moveTo(48, cy - 12); x.lineTo(60, cy); x.lineTo(48, cy + 12); x.lineTo(36, cy); x.closePath(); x.fillStyle = '#ffd24a'; x.fill(); x.lineWidth = 2; x.strokeStyle = '#6a4a10'; x.stroke(); }
    x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(64, 44, 20, H - 50);
    return pillarC;
  }
  const PILLAR_R = 0.85, PULSE_R = 2.6;
  function pillarUpd(R, h, dt) {
    const p = R.player;
    if (!h.up && h.t >= h.delay) { // erupt
      h.up = true;
      if (inCircle(p, h.x, h.y, h.r + 0.5)) hurtP(R, h, h.dmg * 1.1);
      FX().rockImpact(h.x, h.y, 1.3, 1.2);
      hz(R, { type: 'wave', x: h.x, y: h.y, r0: 1, r1: 3.6, w: 0.4, life: 0.55, dmg: h.dmg * 0.4, color: '#ffd24a', src: 'pillar' });
      h.pulseAt = h.t + 3.2;
    }
    if (!h.up) return;
    // solid: push the player out
    const dx = p.x - h.x, dy = p.y - h.y, d = Math.hypot(dx, dy), rr = PILLAR_R + p.r;
    if (d < rr && d > 1e-4) { p.x = h.x + dx / d * rr; p.y = h.y + dy / d * rr; }
    // periodic resonance pulse (telegraphed 1.0 s)
    if (h.owner && !h.owner.dead && h.t >= h.pulseAt - 1.0 && !h.pulsing && h.t < h.delay + h.life - 1.2) h.pulsing = true;
    if (h.pulsing && h.t >= h.pulseAt) {
      h.pulsing = false; h.pulseAt = h.t + 4.2;
      if (inCircle(p, h.x, h.y, PULSE_R)) hurtP(R, h, h.dmg * 0.55);
      FX().ring(h.x, h.y, PULSE_R * 1.2, 0.45, 0.3, '#ffd24a'); FX().ring(h.x, h.y, PULSE_R, 0.35, 0.2);
      G.fx.burst && G.fx.burst(h.x, h.y - 1.2, 10, '#ffe27a', { max: 6, life: 0.4 });
      FX().sfx('rockImpact', h.x, h.y);
    }
    if (h.owner && h.owner.dead) h.life = Math.min(h.life, h.t - h.delay + 0.3);
  }
  function pillarEnd(R, h) { if (h.up) { FX().debris(h.x, h.y, 10, 4, 1.1); FX().dust(h.x - 0.4, h.y, 0.8); FX().dust(h.x + 0.4, h.y, 0.8); } }
  function pillarDrawG(ctx, h, t) {
    if (!onS(h.x, h.y, 4)) return;
    if (!h.up) { FX().teleCircle(ctx, h.x, h.y, h.r + 0.5, Math.min(1, h.t / h.delay), t, '#8a6a1a'); return; }
    if (h.pulsing) FX().teleCircle(ctx, h.x, h.y, PULSE_R, U.clamp(1 - (h.pulseAt - h.t) / 1.0, 0, 1), t, '#8a6a1a');
    FX().auraLite(ctx, h.x, h.y, 1.3, t + h.seed, 0.7);
  }
  // body is a y-sorted prop so the player can walk behind it
  function pillarProp(h) {
    return { x: h.x, y: h.y, h,
      update(R, dt, o) { return !(o.h.done || o.h.t >= o.h.delay + o.h.life || R.hazards.indexOf(o.h) < 0); },
      draw(ctx, o) {
        const hh = o.h; if (!hh.up) return;
        const t = G.run.time, rise = U.ease.outBack(Math.min(1, (hh.t - hh.delay) / 0.25)), end = Math.min(1, (hh.delay + hh.life - hh.t) / 0.3);
        const S = pillarSprite(), w = 1.55, H = 3.4 * rise * end, top = o.y - H + 0.15;
        if (H <= 0.05) return;
        G.render.shadow(ctx, o.x, o.y, 1.0, 0.4);
        ctx.drawImage(S, 0, 0, S.width, S.height * Math.min(1, H / 3.4), o.x - w / 2, top, w, H);
        if (hh.pulsing) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + 0.3 * Math.sin(t * 20); ctx.drawImage(G.assets.glow('#ffd24a', 64), o.x - 1.2, top + 0.4, 2.4, 2.4); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
      } };
  }
  function pillar(R, e, x, y, delay) {
    // cap the number of standing pillars (oldest crumbles)
    let n = 0, oldest = null;
    for (const h of R.hazards) if (h.type === 'pillar' && !h.done) { n++; if (!oldest || h.t > oldest.t) oldest = h; }
    if (n >= 8 && oldest) oldest.life = Math.min(oldest.life, oldest.t - oldest.delay + 0.3);
    const h = hz(R, { type: 'pillar', x, y, r: PILLAR_R, delay: delay || 0.95, life: 9, dmg: e.dmg, owner: e, src: 'pillar', upd: pillarUpd, drawG: pillarDrawG, onEnd: pillarEnd });
    R.props.push(pillarProp(h));
    return h;
  }
  /* 天星: a huge meteor falls on a telegraphed circle */
  function meteorUpd(R, h) {
    if (h.t >= h.delay && !h.fired) {
      h.fired = true; h.done = true;
      if (inCircle(R.player, h.x, h.y, h.r)) hurtP(R, h);
      FX().rockImpact(h.x, h.y, h.r * 0.8, 1.8); FX().crater(h.x, h.y, h.r * 0.9, 4);
      FX().ring(h.x, h.y, h.r * 1.6, 0.6, 0.5, '#ffd24a');
      G.fx.explosion && G.fx.explosion(h.x, h.y, h.r * 0.9, { color: '#ffb23a', kind: 'geo' });
      hz(R, { type: 'wave', x: h.x, y: h.y, r0: h.r, r1: h.r + 3, w: 0.4, life: 0.5, dmg: h.dmg * 0.3, color: '#ffd24a', src: 'meteor' });
      const d = U.dist(h.x, h.y, R.player.x, R.player.y); G.fx.shake(d < 12 ? 0.9 : 0.4);
      if (d < 10) G.fx.flash && G.fx.flash('#fff0c0', 0.25);
      FX().sfx('bigExplosion', h.x, h.y, true);
    }
  }
  function meteorDrawG(ctx, h, t) {
    const k = Math.min(1, h.t / h.delay);
    FX().teleCircle(ctx, h.x, h.y, h.r, k, t, '#8a5a10');
    FX().runeCircle(ctx, h.x, h.y, h.r * 0.9, k, t, 0.55);
    // falling shadow grows
    ctx.globalAlpha = 0.25 + 0.5 * k * k; ctx.fillStyle = '#05000a';
    ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * 0.2 + h.r * 0.5 * k * k, (h.r * 0.2 + h.r * 0.5 * k * k) * 0.45, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  function meteorDrawA(ctx, h, t) {
    const k = Math.min(1, h.t / h.delay); if (k < 0.35) return;
    const f = (k - 0.35) / 0.65, z = (1 - f) * (1 - f) * 24, ox = (1 - f) * 7;
    const mx = h.x - ox, my = h.y - z - 1.2, sz = h.r * 1.25;
    // fiery trail + dark aura
    ctx.lineCap = 'round'; ctx.globalAlpha = 0.55; ctx.strokeStyle = '#0e0016'; ctx.lineWidth = sz * 0.9;
    ctx.beginPath(); ctx.moveTo(mx - 3.5, my - 12); ctx.lineTo(mx, my); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7; ctx.strokeStyle = '#ffb23a'; ctx.lineWidth = sz * 0.45;
    ctx.beginPath(); ctx.moveTo(mx - 3, my - 10); ctx.lineTo(mx, my); ctx.stroke();
    ctx.drawImage(G.assets.glow('#ffd24a', 64), mx - sz * 1.6, my - sz * 1.6, sz * 3.2, sz * 3.2);
    ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'butt'; ctx.globalAlpha = 1;
    FX().darkAura(ctx, mx, my, sz * 0.75, t + h.seed, 0.9);
    const rot = t * 2 + h.seed; ctx.translate(mx, my); ctx.rotate(rot); ctx.drawImage(FX().boulder(), -sz / 2, -sz / 2, sz, sz); ctx.rotate(-rot); ctx.translate(-mx, -my);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.drawImage(G.assets.glow('#ffe9a0', 64), mx - sz * 0.5, my - sz * 0.5, sz, sz); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  function meteor(R, e, x, y, r, delay) {
    return hz(R, { type: 'meteor', x, y, r, delay, life: 0.1, dmg: e.dmg * 2.0, src: 'meteor', upd: meteorUpd, drawG: meteorDrawG, drawA: meteorDrawA });
  }
  // 玉璋シールド: damage soaks into the shield; breaking it stuns Zhongli
  G.bus.on('enemyHit', ev => {
    const e = ev && ev.enemy; if (!e || e.def.ai !== 'zhongli' || !(e.jade > 0)) return;
    e.jade -= ev.dmg;
    if (e.jade <= 0) {
      e.jade = 0; A.reset(e); set(e, 'stun', 3.5); e.armorMul = 1.6; e.pose = 'idle';
      notice('玉璋シールドを割った！ 気絶！', '#ffd24a');
      FX().ring(e.x, e.y, 3, 0.5, 0.4, '#ffd24a'); FX().debris(e.x, e.y - 1, 16, 7, 0.8);
      G.fx.burst && G.fx.burst(e.x, e.y - 1.2, 24, '#ffe27a', { max: 12, life: 0.6, stars: true });
      G.fx.shake(0.5); sfx('rockImpact', e); G.audio.sfx('comboUp');
    }
  });

  A.zhongli = function (R, e, dt, nx, ny, dist) {
    e.stT += dt; const p = R.player; enrage(e);
    if (checkPhase(R, e)) return vel(0, 0);
    const ph = e.phase, cdm = (ph === 1 ? 1.25 : ph === 2 ? 1.0 : 0.8) * (e.enraged ? 0.65 : 1);
    if (e.jade > 0 && R.time > e.jadeUntil) { e.jade = 0; FX().ring(e.x, e.y, 2.2, 0.35, 0.2, '#ffd24a'); }
    e.armorMul = e.st === 'phase' ? 0.05 : e.st === 'stun' ? 1.6 : e.jade > 0 ? 0.25 : 1;
    switch (e.st) {
      case 'phase': if (e.stT >= e.stDur) { A.reset(e); e.cd = 0.6; } return vel(0, 0);
      case 'stun': if (U.chance(dt * 6)) FX().dust(e.x + U.rand(-0.5, 0.5), e.y, 0.4); if (e.stT >= e.stDur) { A.reset(e); e.cd = 0.8; } return vel(0, 0);
      case 'move': {
        e.cd -= dt;
        if (dist > 15) { blink(R, e, 7); sfx('rockImpact', e); return vel(0, 0); }
        if (e.cd <= 0 && onS(e.x, e.y, -0.5)) {
          let atk = nextAtk(e, ZSEQ);
          if (atk === 'shield' && e.jade > 0) atk = 'resonance';
          e.atk = atk; e.faceLock = true; faceTo(e, p.x, p.y); e.pose = 'raise';
          if (atk === 'pillar' || atk === 'pillarRing') { set(e, 'pWind', 0.55); e.charge = { type: 'geo', k: 0 }; }
          else if (atk === 'resonance') { set(e, 'resWind', 0.95 * (e.enraged ? 0.8 : 1)); e.charge = { type: 'geoBig', k: 0 }; e.tele = { type: 'circle', x: e.x, y: e.y, r: 6.5, k: 0, hue: '#8a6a1a' }; sfx('enemyCast', e); }
          else if (atk === 'shield') { set(e, 'shWind', 0.7); e.charge = { type: 'geo', k: 0 }; }
          else { set(e, 'metWind', 0.8); e.charge = { type: 'geoBig', k: 0 }; sfx('enemyCast', e); if (atk === 'meteorRain' || ph >= 2) notice('天星！ 光る円から にげて！', '#ffd24a'); }
          return vel(0, 0);
        }
        const want = 5.5, f = U.clamp((dist - want) * 0.5, -0.6, 1);
        return vel(nx * e.sp * f + (-ny) * e.sp * 0.25 * e.orbitDir, ny * e.sp * f + nx * e.sp * 0.25 * e.orbitDir);
      }
      case 'pWind': {
        const k = e.stT / e.stDur; e.charge.k = k;
        if (k >= 1) {
          e.pose = 'strike'; e.charge = null;
          if (e.atk === 'pillarRing') { // a ring of pillars cages the player (they erupt on the ring, not on the player)
            const n = ph === 3 ? 7 : 6, o = U.rand(0, TAU), rr = 3.6;
            for (let i = 0; i < n; i++) { const a = o + i / n * TAU; pillar(R, e, p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr * 0.85, 1.0); }
            notice('岩柱に かこまれる！', '#ffd24a');
          } else {
            pillar(R, e, p.x + (p.vx || 0) * 0.35, p.y + (p.vy || 0) * 0.35, 0.95);
            if (ph >= 2) for (let i = 0; i < ph - 1; i++) { const a = U.rand(0, TAU), rr = U.rand(2.5, 4.5); pillar(R, e, p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, 1.1 + i * 0.25); }
          }
          FX().ring(e.x, e.y, 1.8, 0.3, 0.2, '#ffd24a'); sfx('rockThrow', e);
          set(e, 'recover', 0.6);
        }
        return vel(0, 0);
      }
      case 'resWind': { // 地心の共鳴: rings of stone ripple out from Zhongli
        const k = e.stT / e.stDur; e.charge.k = k; e.tele.k = k; e.tele.x = e.x; e.tele.y = e.y; e.shakeAmp = 0.02 + 0.04 * k;
        if (k >= 1) {
          e.tele = null; e.charge = null; e.pose = 'strike'; e.shakeAmp = 0;
          const n = ph === 3 ? 3 : 2;
          for (let i = 0; i < n; i++) hz(R, { type: 'wave', x: e.x, y: e.y, r0: 0.8, r1: 6.5, w: 0.5, delay: i * 0.42, life: 0.9, dmg: e.dmg * 0.45, color: '#ffd24a', src: 'resonance' });
          FX().ring(e.x, e.y, 6.5, 0.6, 0.45, '#ffd24a'); FX().crater(e.x, e.y, 1.6, 2.5); FX().debris(e.x, e.y, 10, 6);
          G.fx.shake(0.45); sfx('rockImpact', e);
          set(e, 'recover', 0.5 + 0.42 * n);
        }
        return vel(0, 0);
      }
      case 'shWind': {
        const k = e.stT / e.stDur; e.charge.k = k;
        if (k >= 1) {
          e.charge = null; e.pose = 'strike';
          e.jade = e.maxHp * 0.015; e.jadeMax = e.jade; e.jadeUntil = R.time + 9;
          notice('玉璋シールド！ こわすと気絶するぞ！', '#ffd24a');
          FX().ring(e.x, e.y, 2.6, 0.5, 0.35, '#ffd24a'); G.fx.burst && G.fx.burst(e.x, e.y - 1.2, 16, '#ffe27a', { max: 8, life: 0.5 });
          sfx('shield', e); set(e, 'recover', 0.4);
        }
        return vel(0, 0);
      }
      case 'metWind': { // 天星
        const k = e.stT / e.stDur; e.charge.k = k; e.shakeAmp = 0.02 + 0.03 * k;
        if (k >= 1) {
          e.charge = null; e.pose = 'strike'; e.shakeAmp = 0;
          if (e.atk === 'meteor') meteor(R, e, p.x + (p.vx || 0) * 0.5, p.y + (p.vy || 0) * 0.5, ph === 1 ? 3.0 : 3.3, 1.9);
          else {
            const n = ph === 3 ? 5 : 3, r = ph === 3 ? 2.5 : 2.7;
            meteor(R, e, p.x + (p.vx || 0) * 0.5, p.y + (p.vy || 0) * 0.5, r, 1.8);
            for (let i = 1; i < n; i++) { const a = U.rand(0, TAU), rr = U.rand(3, 6); meteor(R, e, p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, r, 1.8 + i * 0.45); }
          }
          G.fx.rays && G.fx.rays(e.x, e.y - 2, 5, '#ffe9a0', 0.8);
          set(e, 'recover', 0.9);
        }
        return vel(0, 0);
      }
      case 'recover': if (e.stT >= e.stDur) { A.reset(e); e.cd = 1.1 * cdm; } return vel(0, 0);
      case 'appear': if (e.stT >= e.stDur) A.reset(e); return vel(0, 0);
    }
    A.reset(e); return null;
  };

  /* ================= 雷電将軍 (稲妻・雷神) ================= */
  const RSEQ = {
    1: ['iai', 'slashFan', 'eye', 'iai', 'slashFan'],
    2: ['iai', 'musou', 'slashFan', 'eye', 'iai', 'slashFan'],
    3: ['iai3', 'musou', 'eye', 'iai3', 'slashFan', 'musou'],
  };
  /* 雷罰悪曜の眼: an eye hovers over the player and calls down telegraphed bolts */
  function eyeUpd(R, h, dt) {
    const p = R.player; h.x = p.x; h.y = p.y;
    if (!h.owner || h.owner.dead) { h.done = true; return; }
    h.next -= dt;
    if (h.next <= 0 && h.t < h.life - 0.6) {
      h.next = h.every;
      const n = h.n;
      for (let i = 0; i < n; i++) {
        const tx = i === 0 ? p.x + (p.vx || 0) * 0.3 : p.x + U.rand(-3, 3), ty = i === 0 ? p.y + (p.vy || 0) * 0.3 : p.y + U.rand(-2.2, 2.2);
        hz(R, { type: 'zone', x: tx, y: ty, r: 1.25, delay: 0.75, life: 0.25, dmg: h.dmg, style: 'spark', color: '#d59bff', hue: '#6a1fb0', src: 'eye', onEnd: boltEnd });
      }
    }
  }
  function boltEnd(R, h) { if (h.fired) G.fx.lightning && G.fx.lightning(h.x + U.rand(-1, 1), h.y - 14, h.x, h.y, '#e0b0ff'); }
  function eyeDrawA(ctx, h, t) {
    const k = Math.min(1, h.t / 0.4) * Math.min(1, (h.life - h.t) / 0.4), x = h.x, y = h.y - 3.4 + Math.sin(t * 3) * 0.15, r = 0.7;
    FX().darkAura(ctx, x, y, r * 1.3, t, 0.8 * k);
    ctx.globalAlpha = k; ctx.fillStyle = '#1a0628'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.2, r * 0.6, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#c77dff'; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.ellipse(x, y, r * 1.2, r * 0.6, 0, 0, TAU); ctx.stroke();
    ctx.drawImage(G.assets.glow('#c77dff', 64), x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = '#fbeaff'; ctx.beginPath(); ctx.arc(x, y, 0.16 + 0.04 * Math.sin(t * 12), 0, TAU); ctx.fill();
    // tomoe-like rotating ticks (generic)
    ctx.strokeStyle = '#e6b8ff'; ctx.lineWidth = 0.05; ctx.beginPath();
    for (let i = 0; i < 3; i++) { const a = t * 2 + i / 3 * TAU; ctx.moveTo(x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 0.75); ctx.arc(x, y, r * 1.5, a, a + 0.8); }
    ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  function iaiStart(R, e, tele) {
    const p = R.player; e.pose = 'raise';
    FX().after(e, 0.8, '#c77dff'); FX().ring(e.x, e.y, 1.8, 0.35, 0.2, '#c77dff');
    // reappear on a random side, in view, then cut straight through the player
    const a = U.rand(0, TAU), d = 5.5; e.x = p.x + Math.cos(a) * d; e.y = p.y + Math.sin(a) * d * 0.75;
    FX().ring(e.x, e.y, 2.2, 0.4, 0.25, '#c77dff'); G.fx.burst && G.fx.burst(e.x, e.y - 1, 12, '#e0b0ff', { max: 8, life: 0.35 });
    const ang = Math.atan2(p.y - e.y, p.x - e.x), len = 12;
    faceTo(e, p.x, p.y); e.lockA = ang;
    e.laneHz = lane(R, e, { x: e.x, y: e.y, ang, len, w: 1.5, delay: tele, dmg: e.dmg * 1.1, color: '#d59bff', style: 'iai', src: 'iai' });
    sfx('enemyCast', e);
  }
  A.raiden = function (R, e, dt, nx, ny, dist) {
    e.stT += dt; const p = R.player; enrage(e);
    if (checkPhase(R, e)) return vel(0, 0);
    const ph = e.phase, cdm = (ph === 1 ? 1.2 : ph === 2 ? 0.95 : 0.75) * (e.enraged ? 0.65 : 1);
    e.armorMul = e.st === 'phase' ? 0.05 : e.st === 'musouRec' ? 1.4 : 1;
    if (e.st !== 'musouWind' && e.st !== 'musouRec') e.z = Math.max(0, (e.z || 0) - dt * 3);
    if (U.chance(dt * 5)) G.fx.particle && G.fx.particle({ x: e.x + U.rand(-0.6, 0.6), y: e.y - U.rand(0.4, 2.4), vx: U.rand(-1, 1), vy: U.rand(-1.2, -0.2), life: 0.35, size: 0.07, color: '#e0b0ff', glow: true });
    switch (e.st) {
      case 'phase': if (e.stT >= e.stDur) { A.reset(e); e.cd = 0.6; } return vel(0, 0);
      case 'move': {
        e.cd -= dt;
        if (dist > 15) { blink(R, e, 6.5); sfx('electro', e); return vel(0, 0); }
        if (e.cd <= 0 && onS(e.x, e.y, -0.5)) {
          let atk = nextAtk(e, RSEQ);
          if (atk === 'eye' && count(R, 'raidenEye')) atk = 'slashFan';
          e.atk = atk; e.faceLock = true; faceTo(e, p.x, p.y); e.pose = 'raise';
          if (atk === 'iai' || atk === 'iai3') { set(e, 'iaiVanish', 0.3); e.rep = atk === 'iai3' ? 3 : 1; }
          else if (atk === 'slashFan') { set(e, 'fanWind', 0.7); e.vol = 0; e.nvol = ph === 1 ? 2 : 3; e.fanN = ph === 1 ? 5 : ph === 2 ? 7 : 9; e.fanS = 1.2; e.lockA = Math.atan2(ny, nx); e.tele = { type: 'fan', x: e.x, y: e.y, ang: e.lockA, spread: e.fanS, n: e.fanN, len: 10, k: 0 }; e.charge = { type: 'thunder', k: 0 }; }
          else if (atk === 'eye') { set(e, 'eyeWind', 0.7); e.charge = { type: 'thunder', k: 0 }; sfx('enemyCast', e); }
          else { // 夢想の一太刀
            set(e, 'musouWind', 1.75 * (e.enraged ? 0.85 : 1)); e.charge = { type: 'musou', k: 0 };
            const a = Math.atan2(ny, nx), L = 44;
            e.laneHz = lane(R, e, { x: p.x - Math.cos(a) * L / 2, y: p.y - Math.sin(a) * L / 2, ang: a, len: L, w: 4.2, delay: e.stDur, life: 0.6, dmg: e.dmg * 2.2, color: '#e0b0ff', style: 'musou', src: 'musou', lift: 1.2, onFire: musouFire });
            notice('夢想の一太刀！ 横へにげて！', '#c77dff'); sfx('bossWarning'); sfx('beamCharge', e);
          }
          return vel(0, 0);
        }
        return orbit(R, e, nx, ny, dist, ph === 3 ? 5.5 : 6.5, 1.25);
      }
      case 'iaiVanish': {
        if (U.chance(dt * 30)) FX().after(e, 0.5, '#8a3cff');
        if (e.stT >= e.stDur) { iaiStart(R, e, ph === 3 ? 0.6 : 0.75); set(e, 'iaiAim', e.laneHz.delay); }
        return vel(0, 0);
      }
      case 'iaiAim': {
        e.shakeAmp = 0.02 + 0.04 * (e.stT / e.stDur);
        if (e.stT >= e.stDur) { // 一閃: dash to the end of the cut line
          e.shakeAmp = 0; e.pose = 'strike';
          const a = e.lockA; for (let i = 0; i < 5; i++) FX().after(e, 0.7 - i * 0.1, '#c77dff');
          e.x += Math.cos(a) * 11; e.y += Math.sin(a) * 11; faceTo(e, e.x + Math.cos(a), e.y + Math.sin(a));
          G.fx.shake(0.35); sfx('beam', e); FX().slash(e.x, e.y - 1, a, 1.6);
          G.fx.lightning && G.fx.lightning(e.x - Math.cos(a) * 11, e.y - Math.sin(a) * 11 - 1, e.x, e.y - 1, '#e0b0ff');
          e.rep--; set(e, 'iaiRec', e.rep > 0 ? 0.25 : 0.55);
        }
        return vel(0, 0);
      }
      case 'iaiRec': {
        if (e.stT >= e.stDur) { if (e.rep > 0) { set(e, 'iaiVanish', 0.2); e.pose = 'raise'; } else { A.reset(e); e.cd = 1.0 * cdm; } }
        return vel(0, 0);
      }
      case 'fanWind': { // crescent lightning slashes in a fan
        const k = e.stT / e.stDur; faceTo(e, p.x, p.y); e.charge.k = k;
        if (k < 0.7 && e.vol === 0) e.lockA = Math.atan2(ny, nx);
        e.tele.x = e.x; e.tele.y = e.y; e.tele.ang = e.lockA + (e.vol & 1 ? e.fanS / (e.fanN - 1) / 2 : 0); e.tele.k = k;
        if (k >= 1) {
          const n = e.fanN, off = e.tele.ang;
          for (let i = 0; i < n; i++) { const a = off + (i / (n - 1) - 0.5) * e.fanS; hz(R, { type: 'wind', x: e.x + Math.cos(a) * 0.6, y: e.y + Math.sin(a) * 0.6, vx: Math.cos(a) * 9.5, vy: Math.sin(a) * 9.5, r: 0.36, life: 3.5, dmg: e.dmg * 0.5, src: 'thunderSlash', color: '#c77dff', lift: 1.1 }); }
          sfx('electro', e); FX().ring(e.x, e.y, 1.6, 0.3, 0.15, '#c77dff'); FX().slash(e.x, e.y - 1, off, 1.3);
          e.vol++; e.pose = 'strike';
          if (e.vol < e.nvol) { set(e, 'fanWind', 0.35); e.pose = 'raise'; }
          else { A.reset(e); e.cd = 1.1 * cdm; }
        }
        return vel(0, 0);
      }
      case 'eyeWind': {
        const k = e.stT / e.stDur; e.charge.k = k;
        if (k >= 1) {
          e.charge = null; e.pose = 'strike';
          hz(R, { type: 'raidenEye', x: p.x, y: p.y, life: ph === 1 ? 7 : 9, next: 0.6, every: ph === 3 ? 1.1 : 1.4, n: ph === 1 ? 1 : 2, dmg: e.dmg * 0.6, owner: e, upd: eyeUpd, drawA: eyeDrawA, src: 'eye' });
          notice('雷罰悪曜の眼！ 足元の雷に注意！', '#c77dff'); sfx('electro', e);
          set(e, 'recover', 0.5);
        }
        return vel(0, 0);
      }
      case 'musouWind': {
        const k = e.stT / e.stDur; e.charge.k = k; e.z = 1.2 * U.ease.outCubic(Math.min(1, k * 2)); e.shakeAmp = 0.02 + 0.05 * k;
        const a = e.laneHz ? e.laneHz.ang : 0; faceTo(e, e.x + Math.cos(a), e.y + Math.sin(a));
        if (U.chance(dt * 8)) G.fx.lightning && G.fx.lightning(e.x + U.rand(-2, 2), e.y - 5, e.x, e.y - 1.8, '#c77dff');
        if (k >= 1) { e.shakeAmp = 0; e.pose = 'strike'; e.charge = null; set(e, 'musouRec', 1.1); }
        return vel(0, 0);
      }
      case 'musouRec': if (e.stT >= e.stDur) { A.reset(e); e.cd = 1.2 * cdm; } return vel(0, 0);
      case 'recover': if (e.stT >= e.stDur) { A.reset(e); e.cd = 1.0 * cdm; } return vel(0, 0);
    }
    A.reset(e); return null;
  };
  function musouFire(R, h) {
    G.fx.flash && G.fx.flash('#f0d8ff', 0.6); G.fx.shake(1.0); G.fx.zoomPunch && G.fx.zoomPunch(0.05);
    G.fx.slowmo && G.fx.slowmo(0.4, 0.25);
    const c = Math.cos(h.ang), s = Math.sin(h.ang);
    for (let i = 0; i < 6; i++) { const d = U.rand(4, h.len - 4), x = h.x + c * d, y = h.y + s * d; G.fx.lightning && G.fx.lightning(x + U.rand(-1, 1), y - 12, x, y, '#e0b0ff'); }
    FX().sfx('bigExplosion', R.player.x, R.player.y, true); FX().sfx('beam', R.player.x, R.player.y, true);
  }

  /* ================= ナヒーダ (スメール・草神) ================= */
  const NSEQ = {
    1: ['seeds', 'vine', 'barrage', 'seeds', 'vine'],
    2: ['dream', 'seeds', 'clones', 'vine', 'barrage', 'seeds'],
    3: ['dream', 'seeds', 'barrage', 'clones', 'vine', 'dream', 'seeds'],
  };
  /* 所聞遍計 seeds: stuck around the player (they follow) — then they lock in place and burst */
  function seedUpd(R, h) {
    const p = R.player;
    if (h.t < h.lock) { h.x = p.x + h.ox; h.y = p.y + h.oy; }
    if (!h.fired && h.t >= h.delay) {
      h.fired = true; h.done = true;
      if (inCircle(p, h.x, h.y, h.r)) hurtP(R, h);
      FX().ring(h.x, h.y, h.r * 1.4, 0.4, 0.3, '#8fd13a');
      G.fx.burst && G.fx.burst(h.x, h.y - 0.3, 12, '#b6ff6a', { max: 7, life: 0.45 });
      FX().burst(h.x, h.y - 0.3, h.r * 0.8, 0);
      FX().sfx('explosion', h.x, h.y);
    }
  }
  function seedDrawG(ctx, h, t) { FX().teleCircle(ctx, h.x, h.y, h.r, Math.min(1, h.t / h.delay), t, h.t < h.lock ? '#2f6a1a' : '#4a8a1c'); }
  function seedDrawA(ctx, h, t) {
    const locked = h.t >= h.lock, y = h.y - 0.9 + Math.sin(t * 5 + h.seed) * 0.12, r = 0.26 + (locked ? 0.08 * Math.sin(t * 25) : 0);
    FX().auraLite(ctx, h.x, y, 0.5, t + h.seed, 0.9);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9; ctx.drawImage(G.assets.glow('#8fd13a', 64), h.x - r * 2.5, y - r * 2.5, r * 5, r * 5); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#3f8a1c'; ctx.beginPath(); ctx.ellipse(h.x, y, r * 0.7, r, 0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#eaffc8'; ctx.beginPath(); ctx.ellipse(h.x - r * 0.15, y - r * 0.3, r * 0.25, r * 0.35, 0.4, 0, TAU); ctx.fill();
    // tether to the player while it's still stuck to them
    if (!locked) { const p = G.run.player; ctx.globalAlpha = 0.5; ctx.strokeStyle = '#1a0026'; ctx.lineWidth = 0.08; ctx.setLineDash([0.2, 0.2]); ctx.beginPath(); ctx.moveTo(h.x, y); ctx.lineTo(p.x, p.y - 1); ctx.stroke(); ctx.setLineDash([]); }
    ctx.globalAlpha = 1;
  }
  /* 心景幻成: the whole field turns into a dream pattern — only the glowing circles are safe */
  function dreamUpd(R, h) {
    if (h.owner && h.owner.dead) { h.done = true; return; }
    if (!h.fired && h.t >= h.delay) {
      h.fired = true;
      const p = R.player; let safe = false;
      for (const s of h.safes) if (U.dist(p.x, p.y, s.x, s.y) < s.r - p.r * 0.2) safe = true;
      if (!safe && U.dist(p.x, p.y, h.x, h.y) < h.R) hurtP(R, h, h.dmg, p.x, p.y - 2);
      G.fx.flash && G.fx.flash('#d6ffb0', 0.45); G.fx.shake(0.7);
      for (let i = 0; i < 10; i++) { const a = U.rand(0, TAU), r = U.rand(2, h.R); FX().burst(h.x + Math.cos(a) * r, h.y + Math.sin(a) * r * 0.8, 1.4, U.randi(0, 3)); }
      FX().ring(h.x, h.y, h.R, 0.7, 0.6, '#8fd13a');
      FX().sfx('bigExplosion', h.x, h.y, true);
    }
  }
  function dreamDrawG(ctx, h, t) {
    const k = Math.min(1, h.t / h.delay), post = h.fired ? 1 - (h.t - h.delay) / h.life : 1, R0 = h.R * U.ease.outCubic(Math.min(1, h.t / 0.6));
    ctx.globalAlpha = (0.3 + 0.35 * k) * post; ctx.fillStyle = h.fired ? '#8fd13a' : '#14002a';
    ctx.beginPath(); ctx.arc(h.x, h.y, R0, 0, TAU); ctx.fill();
    // rotating mandala of leaves / rings (generic pattern)
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (0.25 + 0.4 * k) * post; ctx.strokeStyle = k > 0.8 ? '#b6ff4a' : '#6ad13a'; ctx.lineWidth = 0.08;
    for (let ring = 1; ring <= 3; ring++) { ctx.beginPath(); ctx.arc(h.x, h.y, R0 * ring / 3.2, 0, TAU); ctx.stroke(); }
    const n = 12, rot = t * 0.4;
    ctx.beginPath();
    for (let i = 0; i < n; i++) { const a = rot + i / n * TAU, c = Math.cos(a), s = Math.sin(a); ctx.moveTo(h.x + c * R0 * 0.3, h.y + s * R0 * 0.3); ctx.quadraticCurveTo(h.x + Math.cos(a + 0.35) * R0 * 0.7, h.y + Math.sin(a + 0.35) * R0 * 0.7, h.x + c * R0, h.y + s * R0); }
    ctx.stroke();
    ctx.strokeStyle = '#a24dff'; ctx.globalAlpha = (0.2 + 0.3 * k) * post; ctx.beginPath();
    for (let i = 0; i < n; i++) { const a = -rot * 1.3 + i / n * TAU; ctx.moveTo(h.x + Math.cos(a) * R0 * 0.55, h.y + Math.sin(a) * R0 * 0.55); ctx.lineTo(h.x + Math.cos(a + 0.26) * R0 * 0.8, h.y + Math.sin(a + 0.26) * R0 * 0.8); }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    // danger rim
    ctx.globalAlpha = 0.9 * post; ctx.strokeStyle = '#0c0012'; ctx.lineWidth = 0.14; ctx.beginPath(); ctx.arc(h.x, h.y, R0, 0, TAU); ctx.stroke();
    if (!h.fired) for (const s of h.safes) { // safe zones: bright, calm, pulsing
      const pr = s.r * U.ease.outBack(Math.min(1, h.t / 0.5));
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#e8ffd8'; ctx.beginPath(); ctx.arc(s.x, s.y, pr, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 8); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.12;
      ctx.beginPath(); ctx.arc(s.x, s.y, pr, 0, TAU); ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.9; ctx.fillStyle = '#2a6a10'; ctx.font = 'bold 0.6px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('安全', s.x, s.y);
    }
    // countdown ring
    if (!h.fired) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8; ctx.strokeStyle = '#b04dff'; ctx.lineWidth = 0.22; ctx.beginPath(); ctx.arc(h.x, h.y, R0 + 0.3, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - k)); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
    ctx.globalAlpha = 1;
  }
  function spiralShot(R, e, a, speed, dmgMul, color) {
    hz(R, { type: 'bullet', x: e.x + Math.cos(a) * 0.6, y: e.y + Math.sin(a) * 0.6, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 0.3, delay: 0.1, life: 4.5, dmg: e.dmg * dmgMul, src: 'dendroShot', color: color || '#8fd13a', lift: 1.1 });
  }
  A.nahida = function (R, e, dt, nx, ny, dist) {
    e.stT += dt; const p = R.player; enrage(e);
    e.z = 0.35 + 0.15 * Math.sin(R.time * 2);
    if (checkPhase(R, e)) return vel(0, 0);
    const ph = e.phase, cdm = (ph === 1 ? 1.25 : ph === 2 ? 1.0 : 0.8) * (e.enraged ? 0.65 : 1);
    e.armorMul = e.st === 'phase' ? 0.05 : e.st === 'dreamHold' ? 1.3 : 1;
    if (U.chance(dt * 4) && qlv() >= 1) G.fx.particle && G.fx.particle({ x: e.x + U.rand(-0.8, 0.8), y: e.y - U.rand(0.3, 2.2), vx: U.rand(-0.6, 0.6), vy: U.rand(-1, -0.2), life: 0.8, size: 0.08, color: '#c6ff8a', glow: true });
    switch (e.st) {
      case 'phase': if (e.stT >= e.stDur) { A.reset(e); e.cd = 0.6; } return vel(0, 0);
      case 'move': {
        e.cd -= dt;
        if (dist > 15) { blink(R, e, 7); sfx('windBlast', e); return vel(0, 0); }
        if (e.cd <= 0 && onS(e.x, e.y, -0.5)) {
          let atk = nextAtk(e, NSEQ);
          if (atk === 'clones') { let n = 0; for (const o of R.enemies) if (!o.dead && o.def.ai === 'nahidaClone') n++; if (n >= 2) atk = 'barrage'; }
          if (atk === 'dream' && count(R, 'dream')) atk = 'seeds';
          e.atk = atk; e.faceLock = true; faceTo(e, p.x, p.y); e.pose = 'raise';
          if (atk === 'seeds') { set(e, 'seedWind', 0.6); e.charge = { type: 'dendro', k: 0 }; sfx('enemyCast', e); }
          else if (atk === 'vine') { set(e, 'vineWind', 0.35); e.charge = { type: 'dendro', k: 0 }; }
          else if (atk === 'barrage') { set(e, 'barWind', 0.7); e.charge = { type: 'dendro', k: 0 }; e.spinDir = (e.cycle & 1) ? 1 : -1; sfx('enemyCast', e); }
          else if (atk === 'clones') { set(e, 'cloneWind', 0.8); e.charge = { type: 'dendro', k: 0 }; }
          else { set(e, 'dreamWind', 0.6); e.charge = { type: 'dream', k: 0 }; sfx('bossWarning'); }
          return vel(0, 0);
        }
        return orbit(R, e, nx, ny, dist, ph === 3 ? 6 : 7, 1.2);
      }
      case 'seedWind': {
        const k = e.stT / e.stDur; e.charge.k = k;
        if (k >= 1) {
          e.charge = null; e.pose = 'strike';
          const n = ph === 1 ? 4 : ph === 2 ? 6 : 8, o = U.rand(0, TAU), lock = 1.2, delay = ph === 3 ? 2.0 : 2.2;
          hz(R, { type: 'seed', x: p.x, y: p.y, ox: 0, oy: 0, r: 1.3, lock, delay, life: 0.1, dmg: e.dmg * 0.9, src: 'seed', upd: seedUpd, drawG: seedDrawG, drawA: seedDrawA });
          for (let i = 0; i < n; i++) { const a = o + i / n * TAU, rr = U.rand(1.8, 3.4); hz(R, { type: 'seed', x: p.x, y: p.y, ox: Math.cos(a) * rr, oy: Math.sin(a) * rr * 0.8, r: 1.2, lock, delay: delay + (i & 1) * 0.25, life: 0.1, dmg: e.dmg * 0.8, src: 'seed', upd: seedUpd, drawG: seedDrawG, drawA: seedDrawA }); }
          notice('所聞遍計！ 種が はじける前に はなれて！', '#8fd13a');
          FX().ring(p.x, p.y, 3.5, 0.4, 0.3, '#8fd13a'); set(e, 'recover', 0.5);
        }
        return vel(0, 0);
      }
      case 'vineWind': {
        const k = e.stT / e.stDur; e.charge.k = k;
        if (k >= 1) {
          e.charge = null; e.pose = 'strike';
          const n = ph === 1 ? 3 : 5, base = Math.atan2(ny, nx), sp = ph === 1 ? 0.45 : 0.35;
          for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * sp; lane(R, e, { x: e.x, y: e.y, ang: a, len: 13, w: 1.1, delay: 0.85, life: 0.4, dmg: e.dmg * 0.8, color: '#8fd13a', style: 'vine', src: 'vine', lift: 0.3 }); }
          sfx('enemyCast', e); set(e, 'recover', 1.1);
        }
        return vel(0, 0);
      }
      case 'barWind': {
        const k = e.stT / e.stDur; e.charge.k = k;
        if (k >= 1) { set(e, 'barrage', ph === 1 ? 2.6 : 3.2); e.pose = 'strike'; e.emitT = 0; e.baseA = Math.atan2(ny, nx); sfx('tornado', e); }
        return vel(0, 0);
      }
      case 'barrage': {
        e.charge.k = 1;
        const arms = ph === 1 ? 3 : ph === 2 ? 4 : 5;
        e.baseA += e.spinDir * 1.1 * dt; e.emitT -= dt;
        if (e.emitT <= 0) { e.emitT = ph === 3 ? 0.16 : 0.2; for (let i = 0; i < arms; i++) spiralShot(R, e, e.baseA + i / arms * TAU, 4.0, 0.45); }
        if (e.stT >= e.stDur) { e.charge = null; A.reset(e); e.cd = 1.2 * cdm; }
        return vel(0, 0);
      }
      case 'cloneWind': {
        const k = e.stT / e.stDur; e.charge.k = k;
        if (k >= 1) {
          e.charge = null; e.pose = 'strike';
          const n = ph === 3 ? 3 : 2;
          for (let i = 0; i < n; i++) {
            const a = U.rand(0, TAU), c = G.enemies.spawn(R, 'nahida_clone', e.x + Math.cos(a) * 3, e.y + Math.sin(a) * 2.4, { fast: true });
            if (c) { c.owner = e; c.dmg = e.dmg * 0.6; c.hp = c.maxHp = Math.round(e.maxHp * 0.012); }
          }
          notice('ナヒーダの幻影！', '#8fd13a'); FX().ring(e.x, e.y, 3, 0.4, 0.3, '#8fd13a'); set(e, 'recover', 0.5);
        }
        return vel(0, 0);
      }
      case 'dreamWind': {
        const k = e.stT / e.stDur; e.charge.k = k;
        if (k >= 1) {
          e.pose = 'strike';
          const ns = ph === 3 ? 2 : 3, o = U.rand(0, TAU), safes = [];
          for (let i = 0; i < ns; i++) { const a = o + i / ns * TAU + U.rand(-0.3, 0.3), rr = U.rand(3.5, 5.5); safes.push({ x: p.x + Math.cos(a) * rr, y: p.y + Math.sin(a) * rr * 0.8, r: 2.2 }); }
          const d = ph === 3 ? 2.1 : 2.5;
          hz(R, { type: 'dream', x: p.x, y: p.y, R: 16, safes, delay: d, life: 0.6, dmg: e.dmg * 1.6, owner: e, src: 'dream', upd: dreamUpd, drawG: dreamDrawG });
          notice('心景幻成！ 光る円に 入って！', '#b6ff4a');
          set(e, 'dreamHold', d + 0.3);
        }
        return vel(0, 0);
      }
      case 'dreamHold': if (e.charge) e.charge.k = 1; if (e.stT >= e.stDur) { e.charge = null; A.reset(e); e.cd = 1.0 * cdm; } return vel(0, 0);
      case 'recover': if (e.stT >= e.stDur) { A.reset(e); e.cd = 1.0 * cdm; } return vel(0, 0);
    }
    A.reset(e); return null;
  };
  /* ナヒーダの幻影: floats around, fires small aimed fans, fades away after a while */
  A.nahidaClone = function (R, e, dt, nx, ny, dist) {
    e.stT += dt; const p = R.player;
    e.z = 0.35 + 0.15 * Math.sin(R.time * 2.4 + e.id);
    if (R.time > e.fadeAt || (e.owner && e.owner.dead)) { e.dead = true; FX().ring(e.x, e.y, 1.6, 0.4, 0.2, '#8fd13a'); G.fx.burst && G.fx.burst(e.x, e.y - 1, 10, '#c6ff8a', { max: 6, life: 0.4 }); return vel(0, 0); }
    if (e.st === 'move') {
      e.cd -= dt;
      if (e.cd <= 0 && onS(e.x, e.y, -0.8)) {
        set(e, 'aim', 0.7); e.faceLock = true; faceTo(e, p.x, p.y); e.pose = 'raise'; e.lockA = Math.atan2(ny, nx);
        e.tele = { type: 'fan', x: e.x, y: e.y, ang: e.lockA, spread: 0.6, n: 3, len: 8, k: 0 };
        return vel(0, 0);
      }
      return orbit(R, e, nx, ny, dist, 6, 1.0);
    }
    if (e.st === 'aim') {
      const k = e.stT / e.stDur; e.tele.k = k; e.tele.x = e.x; e.tele.y = e.y;
      if (k >= 1) { for (let i = 0; i < 3; i++) spiralShot(R, e, e.lockA + (i - 1) * 0.3, 6.5, 0.5, '#b6ff6a'); e.tele = null; e.pose = 'strike'; set(e, 'recover', 0.4); }
      return vel(0, 0);
    }
    if (e.st === 'recover') { if (e.stT >= e.stDur) { A.reset(e); e.cd = U.rand(2.2, 3.2); } return vel(0, 0); }
    A.reset(e); return null;
  };

  /* ================= extras drawn on the boss sprites ================= */
  const baseExtra = A.drawExtra;
  A.drawExtra = function (ctx, e, x, y, H, t) {
    const ai = e.def.ai;
    if (ai !== 'zhongli' && ai !== 'raiden' && ai !== 'nahida' && ai !== 'nahidaClone') { baseExtra(ctx, e, x, y, H, t); return; }
    const F = G.enemyFx, c = e.charge, col = COL[ai === 'nahidaClone' ? 'nahida' : ai];
    if (c) { // gathering power at the hands: element glow wrapped in the dark aura
      const fl = Math.hypot(e.face.x, e.face.y) || 1, hx = x + e.face.x / fl * 0.45, hy = y - H * 0.55;
      const big = c.type === 'musou' || c.type === 'dream' || c.type === 'geoBig', r = (big ? 0.5 + 1.2 * c.k : 0.3 + 0.6 * c.k);
      F.darkAura(ctx, hx, hy, r * 1.2, t * 2 + e.id, 0.5 + 0.5 * c.k);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 + 0.5 * c.k * (0.7 + 0.3 * Math.sin(t * 30));
      ctx.drawImage(G.assets.glow(col, 64), hx - r * 1.6, hy - r * 1.6, r * 3.2, r * 3.2);
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.6 * c.k; ctx.beginPath(); ctx.arc(hx, hy, 0.08 + 0.12 * c.k, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      if (c.type === 'musou' && c.k > 0.2) { // the blade rises into the sky
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = c.k; ctx.strokeStyle = '#e0b0ff'; ctx.lineWidth = 0.18 + 0.2 * c.k; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + 0.3, hy - 2 - 6 * c.k); ctx.stroke(); ctx.lineCap = 'butt'; ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      }
    }
    if (ai === 'zhongli' && e.jade > 0) { // 玉璋シールド: golden crystal dome + remaining strength
      const k = e.jade / (e.jadeMax || 1), cy = y - H * 0.45, r = H * 0.62;
      ctx.globalAlpha = 0.26 + 0.1 * Math.sin(t * 4); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(x, cy, r, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.75; ctx.strokeStyle = '#fff0a8'; ctx.lineWidth = 0.08;
      ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = i / 6 * TAU + t * 0.5; ctx.lineTo(x + Math.cos(a) * r, cy + Math.sin(a) * r); } ctx.stroke();
      ctx.globalAlpha = 0.4; ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = i / 6 * TAU - t * 0.7; ctx.lineTo(x + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7); } ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      const bw = H * 0.7, by = y - H * 1.12; ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(x - bw / 2 - 0.03, by - 0.03, bw + 0.06, 0.16);
      ctx.fillStyle = '#ffd24a'; ctx.fillRect(x - bw / 2, by, bw * k, 0.1);
    }
    if (ai === 'zhongli' && e.st === 'stun') { // dizzy stars
      ctx.globalAlpha = 1; ctx.fillStyle = '#ffe27a';
      for (let i = 0; i < 3; i++) { const a = t * 4 + i / 3 * TAU; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 0.5, y - H * 1.05 + Math.sin(a) * 0.15, 0.1, 0, TAU); ctx.fill(); }
    }
    if (ai === 'zhongli' && e.spawnT <= 0 && qlv() >= 2) { // geo shards orbiting
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6;
      for (let i = 0; i < 4; i++) { const a = t * 1.3 + i / 4 * TAU, sx = x + Math.cos(a) * 1.1, sy = y - H * 0.4 + Math.sin(a) * 0.35; ctx.drawImage(G.assets.glow('#ffd24a', 32), sx - 0.25, sy - 0.25, 0.5, 0.5); }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    if ((ai === 'nahida' || ai === 'nahidaClone') && e.spawnT <= 0 && qlv() >= 2) { // leaves circling
      ctx.fillStyle = '#7fd13a'; ctx.globalAlpha = ai === 'nahida' ? 0.85 : 0.5;
      for (let i = 0; i < 5; i++) { const a = t * 1.6 + i / 5 * TAU, sx = x + Math.cos(a) * 0.9, sy = y - H * 0.45 + Math.sin(a) * 0.3; ctx.beginPath(); ctx.ellipse(sx, sy, 0.14, 0.07, a, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  };

  /* ================= debug hooks (read by js/debug.js / debugpanel.js) ================= */
  A.seqs = A.seqs || {};
  A.seqs.zhongli = ZSEQ; A.seqs.raiden = RSEQ; A.seqs.nahida = NSEQ;
  const SEQS = { zhongli: ZSEQ, raiden: RSEQ, nahida: NSEQ };
  A.bossDebug = {
    names: {
      pillar: '岩柱', pillarRing: '岩柱の囲い', resonance: '地心の共鳴', shield: '玉璋シールド', meteor: '天星', meteorRain: '天星の雨',
      iai: '瞬間移動の居合', iai3: '連続居合', slashFan: '雷の斬撃波', eye: '雷罰悪曜の眼', musou: '夢想の一太刀',
      seeds: '所聞遍計（種）', vine: '蔓の鞭', barrage: '草の弾幕', dream: '心景幻成', clones: '幻影（分身）',
    },
    setPhase(e, ph) {
      if (!e || !SEQS[e.def.ai]) return false;
      ph = U.clamp(ph | 0, 1, 3); e.phase = ph; e.hp = Math.min(e.hp, e.maxHp * (ph === 1 ? 1 : ph === 2 ? 0.6 : 0.25)); if (ph === 1) e.hp = e.maxHp;
      A.reset(e); e.st = 'move'; e.cd = 0.5; return true;
    },
    attack(e, atk) {
      const R = G.run, S = e && SEQS[e.def.ai]; if (!R || !S || e.dead) return false;
      if (S[e.phase].indexOf(atk) < 0) { for (const ph of [1, 2, 3]) if (S[ph].indexOf(atk) >= 0) { this.setPhase(e, ph); break; } }
      const i = S[e.phase].indexOf(atk); if (i < 0) return false;
      A.reset(e); e.st = 'move'; e.stT = 0; e.cycle = i; e.cd = 0; e.spawnT = 0; e.invulnSpawn = false; e.frozenUntil = 0; e.jade = 0;
      const p = R.player, dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      if (d > 7.5 || !G.render.onScreen(e.x, e.y, -1.5)) { const a = d > 0.1 ? Math.atan2(dy, dx) : -Math.PI / 2; e.x = p.x + Math.cos(a) * 6; e.y = p.y + Math.sin(a) * 4.5; }
      return true;
    },
  };
})();
