/* screens.js — title / home / settings / reset / quit / pause / results  (owner: UI)
   Menus are DOM inside #ui (G.ui.show = base screen layer, G.ui.modal = stacked modals).
   Layers carrying [data-nav] get keyboard (arrows/WASD/Enter/Esc/Tab) + gamepad navigation.
   Transitions / toasts live in #fxlayer (outside #ui so they survive G.ui.clearAll()). */
'use strict';
G.screens = (function () {
  const el = G.ui.el, U = G.u;
  const fx = document.createElement('div'); fx.id = 'fxlayer'; document.body.append(fx);

  /* ============================== small kit ============================== */
  const sfx = (n, o) => { try { G.audio.sfx(n, o); } catch (e) { } };
  let wantBgm = null, audioKicked = false;
  function bgm(track) { wantBgm = track; try { G.audio.bgm(track); } catch (e) { } }
  function kick() {
    if (audioKicked) return; audioKicked = true;
    setTimeout(() => { try { G.audio.init(); if (wantBgm !== null && G.scene !== 'run') G.audio.bgm(wantBgm); } catch (e) { } }, 0);
  }
  addEventListener('pointerdown', kick, { passive: true }); addEventListener('keydown', kick);

  function hoverable(b) {
    b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && !b.disabled) { sfx('uiHover'); try { b.focus({ preventScroll: true }); } catch (_) { } } });
    return b;
  }
  /** Genshin-style pill button. o: {cls, icon, ic (icon class), on, back, auto, sfx, title} */
  function btn(label, o) {
    o = o || {};
    const b = el('button', { class: 'g-btn ' + (o.cls || '') + (o.icon ? '' : ' noic'), type: 'button' },
      o.icon ? el('span', { class: 'g-ic ' + (o.ic || '') }, o.icon) : null, el('span', null, label));
    if (o.back) b.dataset.back = ''; if (o.auto) b.dataset.autofocus = '';
    b.addEventListener('click', e => { if (b.disabled) return; if (o.sfx !== false) sfx(o.sfx || 'ui'); o.on && o.on(e); });
    return hoverable(b);
  }
  function round(label, o) {
    const b = el('button', { class: 'g-round', type: 'button', 'aria-label': o.title || label }, label);
    if (o.back) b.dataset.back = '';
    b.addEventListener('click', () => { sfx('ui'); o.on && o.on(); });
    return hoverable(b);
  }
  function panel(cls, ...kids) { return el('div', { class: 'g-panel ' + (cls || '') }, el('div', { class: 'g-corners' }, el('i'), el('i'), el('i'), el('i')), ...kids); }
  function head(text) { return el('h2', { class: 'g-head' }, el('em', null, '◆'), text, el('em', null, '◆')); }
  function openModal(pnl) {
    const opener = document.activeElement;
    const m = el('div', { class: 'g-modal', 'data-nav': '' }, pnl);
    const c = G.ui.modal(m);
    requestAnimationFrame(() => nav.focusDefault(m));
    return () => { c(); if (opener && opener.isConnected) setTimeout(() => { try { opener.focus({ preventScroll: true }); } catch (_) { } }, 20); };
  }
  function toast(text) {
    const t = el('div', { class: 'toast' }, text); fx.append(t); setTimeout(() => t.remove(), 2700);
  }
  function countUp(node, from, to, dur, fmt, done) {
    const t0 = performance.now(); fmt = fmt || (v => U.fmtNum(v));
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      node.textContent = fmt(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step); else done && done();
    };
    node.textContent = fmt(from); requestAnimationFrame(step);
  }
  const R01 = () => Math.random();
  /* ---- fullscreen (only where the API exists; iPhone Safari has none) ---- */
  const DE = document.documentElement;
  function standalone() { try { return matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } }
  function canFs() { return !!(DE.requestFullscreen || DE.webkitRequestFullscreen) && !!(document.fullscreenEnabled || document.webkitFullscreenEnabled) && !standalone(); }
  function isFs() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function toggleFs() {
    try {
      if (isFs()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      const r = (DE.requestFullscreen || DE.webkitRequestFullscreen).call(DE, { navigationUI: 'hide' });
      Promise.resolve(r).then(() => { try { const o = screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => { }); } catch (e) { } })
        .catch(() => toast('全画面にできませんでした'));
    } catch (e) { toast('全画面にできませんでした'); }
  }
  /* ---- install as app (PWA) ---- */
  let installEvt = null;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; refreshTools(); });
  addEventListener('appinstalled', () => { installEvt = null; refreshTools(); toast('ホーム画面に追加しました！'); });
  function canInstall() { return !standalone() && location.protocol.startsWith('http') && (!!installEvt || isIOS); }
  function doInstall() {
    if (installEvt) { const ev = installEvt; installEvt = null; try { ev.prompt(); ev.userChoice && ev.userChoice.finally(refreshTools); } catch (e) { } refreshTools(); return; }
    if (isIOS) toast('共有ボタン → 「ホーム画面に追加」でアプリになるよ');
  }
  const SVG_FS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const SVG_FSX = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const SVG_DL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0l-4.5-4.5M12 14l4.5-4.5M5 17v3h14v-3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const SVG_LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7.5a5 5 0 0 1 10 0V10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><rect x="4.5" y="10" width="15" height="11" rx="2.6" fill="currentColor"/><circle cx="12" cy="15.2" r="1.7" fill="#1a2438"/></svg>';
  let toolsBox = null;
  function tool(svg, label, on) {
    const b = el('button', { class: 'g-round tool', type: 'button', 'aria-label': label, title: label, html: svg + '<span class="tl">' + label + '</span>' });
    b.addEventListener('click', () => { sfx('ui'); on(); }); return hoverable(b);
  }
  function refreshTools() {
    if (!toolsBox || !toolsBox.isConnected) return;
    toolsBox.innerHTML = '';
    if (canInstall()) toolsBox.append(tool(SVG_DL, 'アプリにする', doInstall));
    if (canFs()) toolsBox.append(tool(isFs() ? SVG_FSX : SVG_FS, isFs() ? 'もどす' : '全画面', toggleFs));
  }
  document.addEventListener('fullscreenchange', refreshTools); document.addEventListener('webkitfullscreenchange', refreshTools);
  /* ---- a satisfying "press" burst at a button (ring + sparks), then the wind gust ---- */
  function pressBurst(b) {
    if (!b || !b.getBoundingClientRect) return;
    const r = b.getBoundingClientRect(), low = G.save.data.settings.reducedFx;
    const n = el('div', { class: 'press-burst', style: `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;--w:${r.width}px;--h:${r.height}px` }, el('i', { class: 'pb-ring' }), el('i', { class: 'pb-ring r2' }));
    if (!low) for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2 + R01() * 0.3, d = 90 + R01() * 120; n.append(el('b', { class: 'pb-spark', style: `--tx:${(Math.cos(a) * d).toFixed(0)}px;--ty:${(Math.sin(a) * d * 0.7).toFixed(0)}px;--s:${(0.6 + R01() * 0.8).toFixed(2)}` })); }
    fx.append(n); setTimeout(() => n.remove(), 900);
    b.classList.remove('pressed'); void b.offsetWidth; b.classList.add('pressed');
    try { G.input.haptic && G.input.haptic([14, 30, 22]); } catch (e) { }
  }
  /* ---- pointer / tilt parallax for DOM layers (writes --px/--py on the node, eased) ---- */
  function parallax(node) {
    let tx = 0, ty = 0, x = 0, y = 0, alive = true;
    const onMove = e => { tx = e.clientX / (innerWidth || 1) - 0.5; ty = e.clientY / (innerHeight || 1) - 0.5; };
    const onTilt = e => { if (e.gamma == null) return; const land = Math.abs(window.orientation || (screen.orientation && screen.orientation.angle) || 0) === 90;
      const a = land ? e.beta : e.gamma, b = land ? e.gamma : e.beta; tx = U.clamp((a || 0) / 30, -0.5, 0.5); ty = U.clamp(((b || 0) - (land ? -45 : 45)) / 40, -0.5, 0.5); };
    addEventListener('pointermove', onMove, { passive: true }); addEventListener('deviceorientation', onTilt, { passive: true });
    const step = () => {
      if (!alive) return;
      if (!node.isConnected) { alive = false; removeEventListener('pointermove', onMove); removeEventListener('deviceorientation', onTilt); return; }
      x += (tx - x) * 0.06; y += (ty - y) * 0.06;
      node.style.setProperty('--px', x.toFixed(4)); node.style.setProperty('--py', y.toFixed(4));
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function isTouchDevice() { return (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window; }
  function icon(name) { return 'assets/icon_' + name + '.webp'; }

  /* wind-gust wipe + flash transition; `mid` runs under full cover */
  let busy = false;
  function gust(mid, opts) {
    if (busy) return; busy = true;
    sfx((opts && opts.sfx) || 'start');
    G.backdrop && G.backdrop.gust(1);
    const low = G.save.data.settings.reducedFx;
    const g = el('div', { class: 'gust' }, el('div', { class: 'g-veil' }));
    if (!low) for (let i = 0; i < 9; i++) g.append(el('i', { class: 'g-streak', style: `--y:${(8 + Math.random() * 84).toFixed(1)}%;--d:${(Math.random() * 0.25).toFixed(2)}s;width:${40 + Math.random() * 40}vw` }));
    if (!low) for (let i = 0; i < 12; i++) g.append(el('i', { class: 'g-leaf', style: `--y:${(5 + Math.random() * 90).toFixed(1)}%;--d:${(Math.random() * 0.3).toFixed(2)}s;--r:${Math.round(360 + Math.random() * 540)}deg;--dy:${Math.round((Math.random() - 0.5) * 30)}vh;--s:${(0.6 + Math.random() * 0.9).toFixed(2)}` }));
    g.append(el('div', { class: 'g-flash' }));
    fx.append(g);
    setTimeout(() => { try { mid(); } finally { busy = false; } }, 440);
    setTimeout(() => g.remove(), 1100);
  }

  /* ============================== navigation ============================== */
  const nav = (function () {
    let kfocused = null;
    function root() {
      const r = G.ui.root; if (!r) return null;
      const ms = r.querySelectorAll(':scope > .ui-modal:not(.closing)');
      const top = ms.length ? ms[ms.length - 1] : r.querySelector(':scope > .ui-screen');
      return top && top.hasAttribute('data-nav') ? top : null;
    }
    function items(rt) {
      return Array.from(rt.querySelectorAll('button:not([disabled]), input[type=range]:not([disabled])'))
        .filter(e => e.offsetParent !== null && !e.closest('[data-nonav]'));
    }
    function mark(e) {
      if (kfocused && kfocused !== e) kfocused.classList.remove('kfocus');
      kfocused = e; if (e) e.classList.add('kfocus');
    }
    function focus(e, sound) {
      if (!e) return; try { e.focus({ preventScroll: true }); } catch (_) { e.focus(); }
      if (e.scrollIntoView) e.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      mark(e); if (sound) sfx('uiHover');
    }
    function focusDefault(rt) {
      rt = rt || root(); if (!rt) return;
      const a = rt.querySelector('[data-autofocus]');
      const list = items(rt);
      const target = a && a.offsetParent !== null ? a : list[0];
      if (target) { try { target.focus({ preventScroll: true }); } catch (_) { } }
    }
    function inRoot(rt) { const a = document.activeElement; return a && rt.contains(a) && a !== rt; }
    function move(dx, dy) {
      const rt = root(); if (!rt) return false;
      const list = items(rt); if (!list.length) return false;
      const cur = document.activeElement;
      if (!inRoot(rt) || list.indexOf(cur) < 0) { focusDefault(rt); mark(document.activeElement); return true; }
      const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
      let best = null, bs = Infinity;
      for (const e of list) {
        if (e === cur) continue;
        const b = e.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
        const along = (bx - ax) * dx + (by - ay) * dy; if (along <= 4) continue;
        const perp = Math.abs((bx - ax) * dy) + Math.abs((by - ay) * dx);
        const sc = along + perp * 2.4; if (sc < bs) { bs = sc; best = e; }
      }
      if (best) focus(best, true);
      return true;
    }
    function tab(dir) {
      const rt = root(); if (!rt) return false; const list = items(rt); if (!list.length) return false;
      let i = list.indexOf(document.activeElement); i = i < 0 ? 0 : (i + dir + list.length) % list.length; focus(list[i], true); return true;
    }
    function back() {
      const rt = root(); if (!rt) return false;
      const bs = rt.querySelectorAll('[data-back]'); const b = bs[bs.length - 1];
      if (b && b.offsetParent !== null) { b.click(); return true; } return false;
    }
    function activate() {
      const rt = root(); if (!rt) return false;
      if (!inRoot(rt)) { focusDefault(rt); mark(document.activeElement); return true; }
      const a = document.activeElement; if (a && a.tagName === 'BUTTON') { if (a._holdStart) return true; a.click(); } return true;
    }
    addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && kfocused) mark(null); }, { passive: true });
    addEventListener('keydown', e => {
      const rt = root(); if (!rt) return;
      const c = e.code, a = document.activeElement, isRange = a && a.type === 'range';
      let used = true;
      if (c === 'ArrowUp' || c === 'KeyW') move(0, -1);
      else if (c === 'ArrowDown' || c === 'KeyS') move(0, 1);
      else if ((c === 'ArrowLeft' || c === 'KeyA') && !(isRange && c === 'ArrowLeft')) move(-1, 0);
      else if ((c === 'ArrowRight' || c === 'KeyD') && !(isRange && c === 'ArrowRight')) move(1, 0);
      else if (c === 'Tab') tab(e.shiftKey ? -1 : 1);
      else if (c === 'Escape' || c === 'Backspace') { if (!e.repeat) back(); }
      else if (c === 'Enter' || c === 'Space' || c === 'NumpadEnter') {
        if (!inRoot(rt)) { focusDefault(rt); mark(document.activeElement); }
        else if (a.tagName === 'BUTTON') { mark(a); used = false; } else used = false;
      } else used = false;
      if (used) e.preventDefault();
    });
    // gamepad navigation (only while a nav layer is on top)
    const gp = { held: {}, next: 0 };
    function poll(now) {
      requestAnimationFrame(poll);
      const pads = navigator.getGamepads ? navigator.getGamepads() : []; let p = null;
      for (const q of pads) if (q) { p = q; break; }
      if (!p) return;
      const rt = root();
      const bt = i => !!(p.buttons[i] && p.buttons[i].pressed);
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      const dir = bt(12) || ay < -0.55 ? 'u' : bt(13) || ay > 0.55 ? 'd' : bt(14) || ax < -0.55 ? 'l' : bt(15) || ax > 0.55 ? 'r' : null;
      const A = bt(0), B = bt(1) || bt(9) && G.scene === 'run';
      if (G.inspect && G.inspect.isOpen()) {   // 拡大ビューア on top: ←/→ step, A/B close
        if (dir && gp.held.dir !== dir && (dir === 'l' || dir === 'r')) G.inspect.step(dir === 'l' ? -1 : 1);
        if ((A && !gp.held.A) || (B && !gp.held.B)) G.inspect.close();
        gp.held.dir = dir; gp.held.A = A; gp.held.B = B; return;
      }
      if (rt) {
        if (dir) {
          if (gp.held.dir !== dir || now >= gp.next) {
            const a = document.activeElement;
            if (a && a.type === 'range' && (dir === 'l' || dir === 'r')) { a.stepUp && (dir === 'r' ? a.stepUp(5) : a.stepDown(5)); a.dispatchEvent(new Event('input', { bubbles: true })); a.dispatchEvent(new Event('change', { bubbles: true })); }
            else move(dir === 'l' ? -1 : dir === 'r' ? 1 : 0, dir === 'u' ? -1 : dir === 'd' ? 1 : 0);
            gp.next = now + (gp.held.dir === dir ? 120 : 380);
          }
        }
        const a = document.activeElement;
        if (A && !gp.held.A) { if (a && a._holdStart && rt.contains(a)) a._holdStart(); else activate(); }
        if (!A && gp.held.A && a && a._holdEnd) a._holdEnd();
        if (B && !gp.held.B) back();
      }
      gp.held.dir = dir; gp.held.A = A; gp.held.B = B;
    }
    requestAnimationFrame(poll);
    return { root, focusDefault, move, back, mark };
  })();

  /* ============================== state ============================== */
  let homeTab = 'adv', selChar = 'amber', selStage = 'mondstadt', prevStats = null, moraWatch = 0, homeGo = null;
  function sceneClass() { document.body.classList.remove('in-results'); }
  G.bus.on('scene', sceneClass);
  G.bus.on('runStart', () => { prevStats = Object.assign({}, G.save.data.stats); });
  function applyBodyFlags() {
    const s = G.save.data.settings;
    document.body.classList.toggle('reduced-fx', !!s.reducedFx);
    document.body.classList.toggle('touch-big', s.touchSize === 'l');
  }
  G.bus.on('assetsReady', applyBodyFlags);

  /* ============================== TITLE ============================== */
  function title(opts) {
    opts = opts || {};
    G.run && G.game.leave();
    G.setScene('title'); G.ui.clearAll(); applyBodyFlags();
    if (G.backdrop) { G.backdrop.setMode('title'); if (!opts.quick) G.backdrop.intro(); }
    const q = !!opts.quick, D = s => `--d:${q ? s * 0.3 : s}s`;
    const text = 'DIVINITY AWAKE', lines = ['DIVINITY', 'AWAKE'];
    const gid = 'sw' + Math.random().toString(36).slice(2, 7);
    let ci = 0;   // letters keep flying in one after another across both lines
    const logo = el('h1', { class: 'logo', 'aria-label': text },
      el('span', { class: 'l-burst', 'aria-hidden': 'true', style: `--d:${q ? 0.3 : 1.6}s` }),
      lines.map((ln, li) => el('span', { class: 'l-line l' + (li + 1), 'aria-hidden': 'true' },
        li ? el('i', { class: 'l-dot', style: `--d:${q ? 0.2 : 0.95}s` }) : null,
        el('span', { class: 'l-main' }, ln.split('').map(c => { const i = ci++; return el('span', { class: 'l-char', style: `--d:${(q ? 0.05 : 0.4) + i * (q ? 0.025 : 0.07)}s;--sx:${Math.round(-140 - R01() * 160 - i * 14)}px;--sy:${Math.round((R01() - 0.5) * 120)}px;--sr:${Math.round((R01() - 0.5) * 90)}deg` }, c); })),
        el('span', { class: 'l-shine' }, ln))));
    const sw = el('div', {
      html: `<svg class="swoosh" viewBox="0 0 560 60" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" x2="1"><stop offset="0" stop-color="#5cf2c8" stop-opacity="0"/><stop offset=".25" stop-color="#9ffff0"/><stop offset=".7" stop-color="#f5deb0"/><stop offset="1" stop-color="#f5deb0" stop-opacity="0"/></linearGradient></defs>
      <path d="M6 34 C 120 8, 250 58, 380 26 S 520 12, 556 22" stroke="url(#${gid})" stroke-width="3"/>
      <path d="M40 44 C 160 26, 260 60, 360 40 S 470 30, 520 36" stroke="url(#${gid})" stroke-width="1.4" opacity=".7"/>
      <path d="M150 16 C 220 6, 300 22, 340 14" stroke="#f5deb0" stroke-width="1" opacity=".6"/>
      <path class="leaf" d="M372 24 q 8 -9 16 0 q -8 9 -16 0z" fill="#b9fff0" stroke="none"/></svg>`
    }).firstChild;
    const menu = el('div', { class: 'title-menu' },
      btn('プレイ', { cls: 'primary play', icon: '✦', auto: true, sfx: false, on: e => { if (busy) return; pressBurst(e && e.currentTarget); hop(mascot, 'しゅっぱーつ！'); setTimeout(() => gust(() => home(true)), 160); } }),
      btn('設定', { cls: 'glass', icon: '⚙', on: () => settings('title') }),
      btn('ゲームを終了する', { cls: 'glass', icon: '⏻', on: () => quit() }));
    [...menu.children].forEach((b, i) => { const w = el('div', { class: 'enter-l', style: D(1.25 + i * 0.12) }); b.replaceWith(w); w.append(b); });
    // floating light motes + drifting petals in front of the backdrop (DOM, CSS-animated; none with reducedFx)
    const motes = el('div', { class: 'title-motes', 'aria-hidden': 'true' });
    if (!G.save.data.settings.reducedFx) {
      const few = innerWidth * innerHeight < 500000;
      for (let i = 0; i < (few ? 10 : 18); i++) motes.append(el('i', { class: 'mote', style: `--x:${(R01() * 100).toFixed(1)}%;--d:${(-R01() * 9).toFixed(2)}s;--t:${(7 + R01() * 7).toFixed(2)}s;--s:${(0.5 + R01() * 1.1).toFixed(2)};--dx:${Math.round((R01() - 0.3) * 120)}px` }));
      for (let i = 0; i < (few ? 5 : 9); i++) motes.append(el('i', { class: 'petal' + (i % 3 === 0 ? ' pk' : ''), style: `--y:${(R01() * 70).toFixed(1)}%;--d:${(-R01() * 12).toFixed(2)}s;--t:${(9 + R01() * 8).toFixed(2)}s;--s:${(0.6 + R01() * 0.8).toFixed(2)};--dy:${Math.round(60 + R01() * 160)}px` }));
    }
    toolsBox = el('div', { class: 'title-tools enter', style: D(1.9) });
    // Amber cheering on the path (existing sprite asset) — tap her and she hops + talks
    const bubble = el('span', { class: 'ta-bubble' }, 'いっしょに行こう！');
    // title mascot: Paimon flying (owner-supplied 8-frame loop, assets/paimon_flight.webp)
    const mascot = el('button', { class: 'title-amber title-paimon', type: 'button', 'aria-label': 'パイモン', 'data-nonav': '', style: D(1.45) },
      el('i', { class: 'ta-shadow' }), el('i', { class: 'ta-ring' }), el('span', { class: 'ta-body' }, el('i', { class: 'tp-sprite' })), bubble);
    const scr = el('div', { class: 'title-screen', 'data-nav': '' },
      el('div', { class: 'title-shade' }), G.save.data.settings.reducedFx ? null : el('div', { class: 'title-rays', 'aria-hidden': 'true' }), motes, mascot,
      el('div', { class: 'title-main' },
        el('div', { class: 'logo-tag enter', style: D(0.2) }, 'ディヴィニティ・アウェイク'),
        logo,
        el('div', { class: 'enter', style: D(1.0) }, sw),
        el('p', { class: 'subtitle enter', style: D(1.05) }, '神々は、目覚めた。――この世界を、滅ぼすために。'),
        menu),
      el('div', { class: 'title-tr' }, el('div', { class: 'title-hint enter', style: D(1.8) }, el('kbd', null, '↑'), el('kbd', null, '↓'), ' 選ぶ　', el('kbd', null, 'Enter'), ' 決定'), toolsBox),
      el('div', { class: 'title-foot enter', style: D(1.7) }, '非公式ファンメイド作品　Ver ' + G.VERSION, el('br'), '原作の公式とは関係ありません'),
      el('div', { class: 'title-reset enter', style: D(1.9) }, hoverable(el('button', { class: 'g-link', type: 'button', onclick: () => { sfx('ui'); reset(); } }, 'データをリセット'))));
    // swap the ⏻ glyph if the font lacks it (keeps a consistent look)
    const ic = menu.lastChild.querySelector('.g-ic'); if (ic) ic.textContent = '✕';
    G.ui.show(scr);
    paimonGame(mascot, scr);
    refreshTools(); parallax(scr);
    bgm('title');
    setTimeout(() => { if (scr.isConnected && (!document.activeElement || document.activeElement === document.body)) nav.focusDefault(scr); }, q ? 100 : 1400);
  }

  const TALK = ['いっしょに行こうぜ！', '冒険の始まりだぞ！', '準備はいいか？', '風が気持ちいいな〜！', 'モラ、いっぱい集めような！', 'ヒルチャールなんて、へっちゃらだぞ！'];
  let talkI = 0;
  /** title mascot: hop + sparkle ring + new speech line */
  function hop(m, line) {
    if (!m || !m.isConnected) return;
    const b = m.querySelector('.ta-bubble');
    // (the base rule and .say use the same keyframes name → restart it explicitly, or the line never shows again)
    if (b) { b.textContent = line || TALK[++talkI % TALK.length]; b.classList.remove('say'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; b.classList.add('say'); }
    m.classList.remove('hop'); void m.offsetWidth; m.classList.add('hop');
    try { G.input.haptic && G.input.haptic(10); } catch (e) { }
  }

  /* ---- ui_v6: パイモンをさがせ！ — tap Paimon: poof (smoke + sparkles + sound) → she reappears at HALF the size somewhere
     on the background (never on the logo / buttons / screen edges). Again and again; after the smallest one she comes
     back home big: 「ただいま！」. Finds are counted (chip) and saved (G.save.data.pmFinds, owner UI); lines change as you go. */
  const PM_STEPS = 4;   // 1 → 1/2 → 1/4 → 1/8 → (tap) home
  const PM_FIND = ['わわっ！ 見つかっちゃった！', 'むむっ、よく見つけたな！', 'オイラ、こんなに小さくなったぞ！', 'えっへん、これでどうだ！'];
  const PM_HOME = ['ただいま！ かくれんぼ、楽しかったぞ！', 'ただいま〜！ おまえ、目がいいな！', 'ただいま！ 次はもっとうまく隠れるぞ！', 'ただいま！ かくれんぼ名人だな！'];
  function paimonGame(m, scr) {
    const st = { step: 0, busy: false, round: 0 };
    const chip = el('div', { class: 'pm-chip', 'aria-live': 'polite' }, el('i', null, '✦'), el('span', null, ''));
    scr.append(chip);
    const S = () => G.save.data;
    const total = () => +S().pmFinds || 0;
    function showChip(n, big, line) {
      chip.querySelector('span').textContent = big ? 'かくれんぼ クリア！ これまで ' + U.fmtNum(total()) + '回 見つけた' : 'みつけた ×' + n + (line ? '　' + line : '');
      chip.classList.remove('on', 'big'); void chip.offsetWidth; chip.classList.add('on'); if (big) chip.classList.add('big');
    }
    function poof(x, y, s, gold) {
      const p = el('div', { class: 'pm-poof' + (gold ? ' gold' : ''), style: `left:${Math.round(x)}px;top:${Math.round(y)}px;--s:${Math.max(40, Math.round(s))}px`, 'aria-hidden': 'true' });
      const few = G.save.data.settings.reducedFx;
      for (let i = 0; i < (few ? 4 : 7); i++) { const a = i / (few ? 4 : 7) * Math.PI * 2 + R01() * 0.6; p.append(el('i', { class: 'pf-smoke', style: `--dx:${Math.cos(a).toFixed(2)};--dy:${Math.sin(a).toFixed(2)};--dl:${(R01() * 0.08).toFixed(2)}s` })); }
      for (let i = 0; i < (few ? 5 : 12); i++) { const a = R01() * Math.PI * 2, d = 0.5 + R01() * 0.9; p.append(el('i', { class: 'pf-spark', style: `--dx:${(Math.cos(a) * d).toFixed(2)};--dy:${(Math.sin(a) * d).toFixed(2)};--dl:${(R01() * 0.12).toFixed(2)}s` })); }
      scr.append(p); setTimeout(() => p.remove(), 1100);
    }
    const rect = n => n.getBoundingClientRect();
    /** a random spot on the background: not on the logo / menu / tools / footer, not at the edges, not where she just was */
    function spot(size, from) {
      const W = innerWidth, H = innerHeight, mx = Math.max(24, W * 0.06), my = Math.max(20, H * 0.08), pad = Math.max(24, Math.min(W, H) * 0.06);
      const avoid = [...scr.querySelectorAll('.title-main .logo, .title-main .logo-tag, .title-main .subtitle, .title-menu, .title-tr, .title-foot, .title-reset, .pm-chip')]
        .map(rect).filter(r => r.width > 0).map(r => ({ l: r.left - pad, t: r.top - pad, r: r.right + pad, b: r.bottom + pad }));
      let best = null, bs = -1e9;
      for (let i = 0; i < 80; i++) {
        const x = mx + R01() * Math.max(1, W - 2 * mx - size), y = my + R01() * Math.max(1, H - 2 * my - size);
        let hit = 0;
        for (const a of avoid) if (x < a.r && x + size > a.l && y < a.b && y + size > a.t) hit++;
        const d = from ? Math.hypot(x + size / 2 - from.x, y + size / 2 - from.y) : W;
        const sc = -hit * 1e5 + Math.min(d, W * 0.45) + R01() * 40;
        if (sc > bs) { bs = sc; best = { x, y }; }
      }
      return best;
    }
    function goHome(silent) {
      st.step = 0;
      m.classList.remove('pm-away', 'pm-hide', 'bub-r'); m.style.left = m.style.top = m.style.width = m.style.height = m.style.right = m.style.bottom = '';
      if (!silent) { m.classList.remove('pm-in'); void m.offsetWidth; m.classList.add('pm-in'); }
    }
    m.addEventListener('click', () => {
      if (st.busy || !m.isConnected) return;
      st.busy = true;
      const r = rect(m), cx = r.left + r.width / 2, cy = r.top + r.height / 2, last = st.step >= PM_STEPS - 1;
      const n = ++st.round;
      S().pmFinds = total() + 1; try { G.save.write(); } catch (e) { }
      sfx('magnet'); try { G.input.haptic && G.input.haptic(12); } catch (e) { }
      poof(cx, cy, r.width, last);
      m.classList.add('pm-hide');
      const bb = m.querySelector('.ta-bubble'); if (bb) { bb.classList.remove('say'); bb.style.animation = 'none'; }
      setTimeout(() => {
        if (!m.isConnected) return;
        if (last) {   // smallest one found → home, big, 「ただいま！」
          goHome(); st.round = 0;
          const home = rect(m); poof(home.left + home.width / 2, home.top + home.height / 2, home.width * 1.3, true);
          sfx('resonance'); hop(m, PM_HOME[Math.floor(total() / PM_STEPS) % PM_HOME.length]);
          showChip(0, true);
        } else {
          if (!st.base) st.base = Math.max(r.width, r.height);
          st.step++;
          const size = Math.max(22, Math.round(st.base / Math.pow(2, st.step)));
          const p = spot(size, { x: cx, y: cy });
          m.classList.add('pm-away'); m.classList.toggle('bub-r', p.x < innerWidth / 2);
          Object.assign(m.style, { right: 'auto', bottom: 'auto', left: Math.round(p.x) + 'px', top: Math.round(p.y) + 'px', width: size + 'px', height: size + 'px' });
          m.classList.remove('pm-hide', 'pm-in'); void m.offsetWidth; m.classList.add('pm-in');
          sfx('comboUp', { combo: st.step * 3 });
          // the speech bubble would give her away when she is tiny → only on the first hide; the chip carries the line
          const line = PM_FIND[(n - 1) % PM_FIND.length];
          if (st.step === 1) hop(m, line); else { m.classList.remove('hop'); void m.offsetWidth; m.classList.add('hop'); }
          showChip(n, false, st.step === 1 ? '' : line);
        }
        setTimeout(() => { st.busy = false; }, 250);
      }, 420);
    });
    // a resize would put her somewhere odd → just fly home
    const onResize = () => { if (!m.isConnected) { removeEventListener('resize', onResize); return; } if (st.step) { goHome(true); st.round = 0; } };
    addEventListener('resize', onResize);
  }

  /* ============================== HOME ============================== */
  function home(fromTitle) {
    G.run && G.game.leave();
    G.setScene('home'); G.ui.clearAll(); applyBodyFlags();
    G.backdrop && G.backdrop.setMode('home');
    bgm('home');
    const S = G.save.data, C = G.data.characters;
    loadSel(); fixSel();
    const ch = C[selChar] || C.amber;
    const elInfo = G.EL[ch.element] || G.EL.pyro;

    // top bar
    const moraNum = el('b', null, U.fmtNum(S.mora));
    const moraPill = el('div', { class: 'mora-pill' }, el('img', { src: icon('mora'), alt: '' }), moraNum);
    const top = el('div', { class: 'home-top enter', style: '--d:.05s' },
      round('‹', { back: true, title: 'タイトルへ', on: () => title({ quick: true }) }),
      el('h2', null, '冒険の準備', el('small', null, 'PREPARE')),
      el('div', { class: 'sp' }), moraPill);

    // roster
    const roster = el('div', { class: 'roster' }, (G.data.roster || ['amber']).map((id, i) => {
      const c = C[id]; if (!c) return null;
      const locked = !c.implemented, cs = charSt(id), sil = !locked && cs !== 'open';
      const b = el('button', { class: 'r-card enter-l' + (id === selChar ? ' sel' : '') + (locked ? ' locked' : '') + (sil ? ' sil ' + cs : ''), type: 'button', 'data-char': id, style: `--d:${0.1 + i * 0.07}s;--el:${(G.EL[c.element] || {}).color || '#fff'}`, 'aria-label': (sil ? '？？？' : c.name) + (locked ? '（準備中）' : sil ? '（未解放）' : '') },
        el('img', { src: icon(c.portrait || id), alt: '' }), locked ? el('span', null, '準備中') : null,
        sil ? el('i', { class: 'r-lock', html: cs === 'buyable' ? '<b>!</b>' : SVG_LOCK }) : null);
      b.addEventListener('click', () => {
        if (locked) { sfx('denied'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); toast(c.name + ' は準備中です。もうすこし待っててね！'); return; }
        if (sil) { sfx('ui'); charDialog(id); return; }
        sfx('ui'); if (selChar !== id) { selChar = id; saveSel(); home(); }
      });
      if (G.inspect) { G.inspect.bindHold(b, () => inspectChars(id, b)); b.title = '長押し / 右クリックで大きく見る'; }
      return hoverable(b);
    }));

    // hero
    const embers = [];
    if (!S.settings.reducedFx) for (let i = 0; i < 10; i++) embers.push(el('i', { class: 'hero-ember', style: `--x:${20 + Math.random() * 60}%;--d:${(Math.random() * 4).toFixed(2)}s;--t:${(3 + Math.random() * 3).toFixed(2)}s;--dx:${Math.round((Math.random() - 0.5) * 60)}px` }));
    const hero = el('div', { class: 'hero' },
      el('div', { class: 'hero-stage' },
        el('div', { class: 'hero-glow', style: `background:radial-gradient(circle, ${elInfo.color}66, ${elInfo.color}22 45%, transparent 70%)` }),
        el('div', { class: 'hero-circle' }), embers,
        heroImg(ch),
        el('div', { class: 'hero-name enter-l', style: '--d:.25s' },
          el('div', { class: 'stars' }, '★★★★'),
          el('h3', null, ch.name),
          el('div', { class: 'sub' }, el('span', { class: 'el-badge', style: `--el:${elInfo.color}` }, '◆ ' + elInfo.name), el('span', { class: 'chip' }, ch.weapon || ''), ch.title ? el('span', { class: 'chip' }, ch.title) : null))),
      el('div', { class: 'sortie enter', style: '--d:.4s' },
        btn('出撃', { cls: 'primary', icon: '⚔', auto: true, sfx: false, on: e => { if (busy) return; fixSel(); pressBurst(e && e.currentTarget); setTimeout(() => gust(() => G.startRun(selChar, selStage)), 120); } }),
        sortieSub()));

    // tabbed panel
    const TABS = [['adv', '冒険'], ['meta', '育成'], ['const', '命ノ星座'], ['relic', '聖遺物'], ['book', 'スキルブック'], ['rec', '記録']];
    const body = el('div', { class: 'tab-body scroll' });
    const badges = {};
    const tabBtns = TABS.map(([k, label]) => {
      badges[k] = el('i', { class: 'tab-bdg', 'aria-hidden': 'true' });
      const b = el('button', { class: 'tab' + (k === homeTab ? ' on' : ''), type: 'button', 'data-tab': k }, label, badges[k]);
      b.addEventListener('click', () => goTab(k));
      return hoverable(b);
    });
    function goTab(k) {
      if (homeTab === k) return; sfx('ui'); homeTab = k;
      tabBtns.forEach(t => t.classList.toggle('on', t.dataset.tab === k));
      renderTab(body, k); refreshBadges();
    }
    homeGo = goTab;
    function refreshBadges() {
      const ms = metaState(), cs = consState(), nNew = G.skillbook ? G.skillbook.newCount() : 0;
      const set = (k, txt, cls) => { const b = badges[k]; if (!b) return; const was = b.textContent; b.textContent = txt || ''; b.className = 'tab-bdg' + (txt ? ' on ' + (cls || '') : ''); if (txt && txt !== was) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); } };
      set('meta', ms.can.length ? String(ms.can.length) : '', 'gold');
      set('const', cs && cs.can ? '!' : '', 'gold');
      set('book', nNew ? 'NEW' : '', 'new');
    }
    refreshBadges();
    const pnl = panel('home-panel enter-r', el('div', { class: 'tabs', role: 'tablist' }, tabBtns), body);
    pnl.setAttribute('style', '--d:.18s');
    renderTab(body, homeTab);

    const scr = el('div', { class: 'home', 'data-nav': '' }, top, roster, hero, pnl);
    function sortieSub() {
      const d = stg(selStage);
      const b = el('button', { class: 'sortie-sub', type: 'button', title: 'ステージ選択' }, el('img', { src: icon(d.boss), alt: '' }), el('span', null, 'STAGE ' + d.order), el('b', null, d.name), el('em', null, 'へ ▸'));
      b.addEventListener('click', () => { sfx('ui'); if (homeGo) homeGo('adv'); const g = scr.querySelector('.stg-grid'); if (g) { g.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); g.classList.remove('flash'); void g.offsetWidth; g.classList.add('flash'); } });
      return hoverable(b);
    }
    G.ui.show(scr);
    setTimeout(() => nav.focusDefault(scr), 60);

    // mora counter follows purchases made in the panels
    const my = ++moraWatch; let shown = S.mora;
    const watch = () => {
      if (my !== moraWatch || !scr.isConnected) return;
      const m = G.save.data.mora;
      if (m !== shown) {
        const from = shown; shown = m; countUp(moraNum, from, m, 450); moraPill.classList.remove('bump'); void moraPill.offsetWidth; moraPill.classList.add('bump');
        if (m < from) { // a purchase: the spent Mora flies off the purse
          const f = el('div', { class: 'mora-spent' }, '-' + U.fmtNum(from - m)); moraPill.append(f); setTimeout(() => f.remove(), 1100);
        }
        refreshBadges();
        if (homeTab === 'adv') { const g = scr.querySelector('.guide'); g && g.replaceWith(guideCard()); }
      }
      setTimeout(watch, 200);
    };
    watch();
  }

  /* ---- stages / unlocks (G.unlocks in js/unlocks.js; everything guarded so the UI still works without it) ---- */
  const UL = () => G.unlocks;
  const charSt = id => (UL() ? UL().charState(id) : 'open');
  const stList = () => (UL() ? UL().stageList() : [stg('mondstadt')]);
  function stg(id) {
    if (UL()) return UL().stage(id);
    const d = (G.data.stages && G.data.stages[id]) || {};
    return Object.assign({ id, order: 1, name: 'モンドの風跡', boss: 'venti', bossName: 'ウェンティ', bgSmall: 'title_bg_small', implemented: true }, d);
  }
  const stOpen = id => (UL() ? UL().stageOpen(id) : id === 'mondstadt');
  const stCleared = id => (UL() ? UL().isCleared(id) : false);
  const stRec = id => (UL() ? UL().rec(id) : { best: G.save.data.stats.bestTime, kills: G.save.data.stats.bestKills, clears: G.save.data.stats.clears });
  function loadSel() { const u = G.save.data.uiSel; if (u && typeof u === 'object' && !loadSel.done) { loadSel.done = true; if (u.char) selChar = u.char; if (u.stage) selStage = u.stage; } }
  function saveSel() { G.save.data.uiSel = { char: selChar, stage: selStage }; try { G.save.write(); } catch (e) { } }
  /** a locked character or a closed stage can never be the sortie choice */
  function fixSel() {
    const C = G.data.characters;
    if (!C[selChar] || !C[selChar].implemented || charSt(selChar) !== 'open') selChar = 'amber';
    if (!stOpen(selStage)) selStage = 'mondstadt';
  }
  G.bus.on('saveReset', () => { selChar = 'amber'; selStage = 'mondstadt'; });
  const STARS = n => '★'.repeat(Math.max(1, Math.min(5, n))) + '☆'.repeat(Math.max(0, 4 - n));
  function stageGrid(body) {
    return el('div', { class: 'stg-grid' }, stList().map((d, i) => {
      const open = stOpen(d.id), cl = stCleared(d.id), sel = d.id === selStage, rc = stRec(d.id);
      const b = el('button', { class: 'stg-card' + (sel ? ' sel' : '') + (open ? '' : ' locked') + (cl ? ' clear' : ''), type: 'button', 'data-stage': d.id,
          style: `--d:${(0.04 * i).toFixed(2)}s;--c:${d.color || '#d3bc8e'}`, 'aria-label': 'STAGE ' + d.order + ' ' + (open ? d.name : '？？？（未解放）') },
        el('img', { class: 'stg-bg', src: 'assets/' + d.bgSmall + '.webp', alt: '' }),
        el('i', { class: 'stg-shade' }),
        el('span', { class: 'stg-no' }, 'STAGE ' + d.order),
        el('b', { class: 'stg-name' }, open ? d.name : '？？？'),
        el('span', { class: 'stg-stars', title: '強さ' }, el('small', null, '強さ'), STARS(d.stars || d.order)),
        el('span', { class: 'stg-boss' }, el('img', { src: icon(d.boss), alt: '' }), el('span', null, open || cl ? d.bossName : '？？？')),
        cl ? el('span', { class: 'stg-clear' }, 'CLEAR') : null,
        open && rc.best ? el('span', { class: 'stg-best' }, '最長 ' + U.fmtTime(rc.best)) : null,
        open ? null : el('span', { class: 'stg-lock' }, el('i', { html: SVG_LOCK }), el('small', null, UL() ? UL().stageCond(d.id) : '準備中')));
      b.addEventListener('click', () => {
        if (!open) { sfx('denied'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); toast('？？？：' + (UL() ? UL().stageCond(d.id) : '準備中')); return; }
        sfx('ui'); if (selStage === d.id) return;
        selStage = d.id; saveSel();
        const scroll = body.scrollTop; home(); const nb = G.ui.root.querySelector('.tab-body'); if (nb) nb.scrollTop = scroll;
      });
      if (G.inspect) { G.inspect.bindHold(b, () => inspectStages(d.id, b)); b.title = '長押し / 右クリックで大きく見る'; }
      return hoverable(b);
    }));
  }
  /** unlock dialog for a silhouette character: conditions, purchase, reveal */
  function charDialog(id) {
    const c = G.data.characters[id], u = UL(); if (!c || !u) return;
    const st = u.charState(id), conds = u.conds(id), cost = u.cost(id), mora = G.save.data.mora || 0;
    const elc = (G.EL[c.element] || {}).color || '#ffd24a';
    const can = st === 'buyable' && mora >= cost;
    const img = el('img', { class: 'ul-img', src: icon(c.portrait || id), alt: '' });
    const stageRow = conds.find(k => k.kind === 'stage'), moraRow = conds.find(k => k.kind === 'mora');
    const condEl = el('div', { class: 'ul-conds' },
      el('h5', null, '解放条件'),
      stageRow ? el('div', { class: 'ul-cond' + (stageRow.ok ? ' ok' : '') }, el('i', null, stageRow.ok ? '✓' : '1'), el('span', null, stageRow.text), el('em', null, stageRow.ok ? '達成！' : 'まだ')) : null,
      moraRow ? el('div', { class: 'ul-cond' + (moraRow.ok ? ' ok' : '') }, el('i', null, moraRow.ok ? '✓' : '2'), el('span', null, el('img', { src: icon('mora'), alt: '' }), moraRow.text),
        el('em', null, moraRow.ok ? '足りてる！' : 'あと ' + U.fmtNum(cost - mora))) : null,
      el('div', { class: 'ul-purse' }, '所持モラ ', el('img', { src: icon('mora'), alt: '' }), el('b', null, U.fmtNum(mora))));
    let close;
    const buyBtn = btn(st === 'locked' ? '条件をクリアしよう' : can ? '解放する' : 'モラが足りない', { cls: 'primary ul-buy', icon: '✦', sfx: false, auto: can, on: () => doBuy() });
    buyBtn.disabled = !can;
    if (can) buyBtn.append(el('small', { class: 'ul-cost' }, el('img', { src: icon('mora'), alt: '' }), U.fmtNum(cost)));
    const foot = el('div', { class: 'g-foot' }, btn('閉じる', { icon: '✕', ic: 'no', back: true, auto: !can, on: () => close() }), buyBtn);
    const title = el('h2', { class: 'g-head' }, el('em', null, '◆'), el('span', null, '？？？'), el('em', null, '◆'));   // silhouette = name hidden (owner rule)
    const pnl = panel('unlock-panel ' + st, title,
      el('div', { class: 'ul-body' },
        el('div', { class: 'ul-port', style: `--el:${elc}` }, el('i', { class: 'ul-rays' }), el('i', { class: 'ul-ring' }), img, st === 'buyable' ? null : el('i', { class: 'ul-lock', html: SVG_LOCK })),
        el('div', { class: 'ul-info' },
          el('div', { class: 'ul-sub' }, el('span', { class: 'el-badge', style: `--el:${elc}` }, '◆ ' + ((G.EL[c.element] || {}).name || '')), el('span', { class: 'chip' }, c.weapon || '')),
          el('p', { class: 'ul-blurb' }, st === 'locked' ? 'まだ 影しか見えない…。条件をクリアすると 仲間にできるよ！' : '条件クリア！ 解放すると 正体がわかるよ！'),
          condEl)),
      foot);
    close = openModal(pnl);
    function doBuy() {
      if (!u.buy(id)) { sfx('denied'); return; }
      pnl.classList.add('reveal'); pnl.classList.remove('buyable', 'locked');
      try { G.audio.sfx('chestReveal', { rarity: 5 }); } catch (e) { }
      setTimeout(() => sfx('star'), 450);
      try { G.input.haptic && G.input.haptic([20, 50, 20, 50, 60]); } catch (e) { }
      const burst = el('div', { class: 'ul-burst', 'aria-hidden': 'true' });
      if (!G.save.data.settings.reducedFx) for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2 + R01() * 0.2, d = 110 + R01() * 150; burst.append(el('b', { style: `--tx:${(Math.cos(a) * d).toFixed(0)}px;--ty:${(Math.sin(a) * d).toFixed(0)}px;--s:${(0.5 + R01()).toFixed(2)};--dl:${(R01() * 0.25).toFixed(2)}s` })); }
      pnl.querySelector('.ul-port').append(burst);
      title.querySelector('span').textContent = c.name + ' が仲間になった！';
      pnl.querySelector('.ul-blurb').textContent = c.blurb || '';
      if (c.title) pnl.querySelector('.ul-sub').append(el('span', { class: 'chip' }, c.title));
      condEl.replaceWith(el('div', { class: 'ul-got' }, el('b', null, 'NEW!'), el('span', null, 'ホームで選んで 出撃できるよ')));
      foot.innerHTML = '';
      foot.append(btn('この仲間で出撃準備', { cls: 'primary', icon: '⚔', auto: true, back: true, on: () => { close(); selChar = id; saveSel(); setTimeout(() => home(), 190); } }));
      setTimeout(() => nav.focusDefault(pnl.parentNode), 60);
    }
  }

  function soon(title, text) {
    return el('div', { class: 'soon' }, el('div', null, el('b', null, title || '準備中'), el('br'), text || 'この機能はもうすぐ登場します。'));
  }
  function renderTab(body, k) {
    body.innerHTML = ''; body.scrollTop = 0;
    const inner = el('div', { class: 'tb-in' }); body.append(inner);
    const S = G.save.data, st = S.stats;
    const ext = (fn, label) => {
      if (typeof fn === 'function') { try { fn(inner, selChar); return; } catch (e) { console.error('[screens] panel', label, e); inner.innerHTML = ''; } }
      inner.append(soon('準備中', label + ' はもうすぐ登場します。'));
    };
    if (k === 'adv') {
      const d = stg(selStage), rc = stRec(selStage);
      const ch = G.data.characters[selChar] || G.data.characters.amber;
      inner.append(
        el('div', { class: 'stg-head' }, el('h4', null, 'ステージ選択'), el('small', null, 'ボスをたおすと 次のステージへ')),
        stageGrid(body),
        el('div', { class: 'stage-card', style: `--bg:url(../assets/${d.bgSmall}.webp);--c:${d.color || '#5cf2c8'}` },
          stCleared(selStage) ? el('div', { class: 'st-clear' }, 'CLEAR') : null,
          el('div', { class: 'st-sub' }, 'STAGE ' + d.order + (d.sub ? ' ・ ' + d.sub : d.region ? ' ・ ' + d.region : '')),
          el('h4', null, d.name),
          el('div', { class: 'st-goal' }, el('img', { src: icon(d.boss), alt: '' }), Math.round((d.duration || 600) / 60) + '分生きのこり、' + (d.bossName || 'ボス') + 'を倒せ！'),
          d.blurb ? el('div', { class: 'st-blurb' }, d.blurb) : null,
          el('div', { class: 'st-rec' },
            el('span', { class: 'chip' }, '最長 ' + U.fmtTime(rc.best || 0)),
            el('span', { class: 'chip' }, '最多撃破 ' + U.fmtNum(rc.kills || 0)),
            el('span', { class: 'chip' }, 'クリア ' + (rc.clears || 0) + '回'))),
        guideCard(),
        el('div', { class: 'kit' }, kitRows(ch).map(r => kitRow(r[0], r[1], r[2], r[3]))));
      if (G.inspect) {
        const sc = inner.querySelector('.stage-card'); if (sc) G.inspect.bindTap(sc, () => inspectStages(selStage, sc), 'ステージを大きく見る');
        const rows = [...inner.querySelectorAll('.kit-row')], kr = kitRows(ch), col = (G.EL[ch.element] || {}).color;
        rows.forEach((n, i) => G.inspect.bindTap(n, () => G.inspect.open({ index: i, from: n.querySelector('.ki'),
          list: kr.map((r, j) => ({ img: kitSrc(r[0]), title: r[2], sub: r[1], body: G.inspect.sec('', G.inspect.esc(r[3])), color: col, from: rows[j] && rows[j].querySelector('.ki') })) })));
      }
    } else if (k === 'meta') ext(G.progressionUI && G.progressionUI.renderMeta, '育成');
    else if (k === 'const') ext(G.progressionUI && G.progressionUI.renderConstellation, '命ノ星座');
    else if (k === 'relic') ext(G.relics && G.relics.renderPanel, '聖遺物');
    else if (k === 'book') { try { G.skillbook.render(inner); } catch (e) { console.error('[screens] skillbook', e); inner.innerHTML = ''; inner.append(soon('準備中', 'スキルブック はもうすぐ登場します。')); } }
    else if (k === 'rec') {
      const r = (label, v) => el('div', { class: 'rec' }, el('small', null, label), el('b', null, v));
      inner.append(el('div', { class: 'rec-grid' },
        r('出撃回数', U.fmtNum(st.runs || 0)), r('クリア回数', U.fmtNum(st.clears || 0)),
        r('最長生存', U.fmtTime(st.bestTime || 0)), r('最多撃破', U.fmtNum(st.bestKills || 0)),
        r('累計撃破', U.fmtNum(st.kills || 0)), r('累計モラ', U.fmtNum(st.totalMora || 0))),
        el('h5', { class: 'rec-sub' }, 'ステージべつの記録'),
        el('div', { class: 'rec-stages' }, stList().map(d => {
          const rc = stRec(d.id), open = stOpen(d.id), cl = stCleared(d.id);
          return el('div', { class: 'rec-st' + (open ? '' : ' locked') + (cl ? ' clear' : ''), style: `--bg:url(../assets/${d.bgSmall}.webp)` },
            el('img', { src: icon(d.boss), alt: '' }),
            el('div', { class: 'rs-n' }, el('small', null, 'STAGE ' + d.order), el('b', null, open || cl ? d.name : '？？？')),
            el('span', { class: 'rs-v' }, el('small', null, '最長'), U.fmtTime(rc.best || 0)),
            el('span', { class: 'rs-v' }, el('small', null, 'クリア'), (rc.clears || 0) + '回'),
            el('span', { class: 'rs-badge' }, cl ? 'CLEAR' : open ? '挑戦中' : '未解放'));
        })));
      if (G.inspect) inner.querySelectorAll('.rec-st').forEach((n, i) => { const id = stList()[i].id; G.inspect.bindTap(n, () => inspectStages(id, n.querySelector('img') || n)); });
    }
  }
  /* ---- 強化ガイド: what Mora can buy right now. Reads only data (G.data.meta / metaTree / metaCost,
     G.progression.constellations) so balance changes show up automatically. ---- */
  function metaState() {
    const S = G.save.data, P = G.progression, TR = P && P.metaTree ? P.metaTree(selChar) : G.data.metaTree, cost = G.data.metaCost, mora = S.mora || 0;
    const M = {}; for (const k in TR.nodes) M[k] = P && P.metaDef ? P.metaDef(k, selChar) : G.data.meta[k]; // selected character's stars + names
    const out = { can: [], next: null };
    if (!TR || !TR.nodes || typeof cost !== 'function') return out;
    const lv = k => (k === 'root' ? 1 : ((S.meta && S.meta[k]) | 0));
    for (const k in TR.nodes) {
      const d = M[k], n = TR.nodes[k]; if (!d) continue;
      const l = lv(k); if (l >= (d.max || 1)) continue;
      if (!(n.parent === 'root' || lv(n.parent) > 0 || l > 0)) continue;
      const it = { key: k, d, lv: l, cost: cost(k, l), col: (TR.branches[n.br] || {}).c || '#ffd24a' };
      if (mora >= it.cost) out.can.push(it);
      if (!out.next || it.cost < out.next.cost) out.next = it;
    }
    out.can.sort((a, b) => a.cost - b.cost);
    return out;
  }
  function consState() {
    const P = G.progression; if (!P || !P.constellations || typeof P.constellationLevel !== 'function') return null;
    const i = P.constellationLevel(selChar), c = (P.constellationsOf ? P.constellationsOf(selChar) : P.constellations)[i]; if (!c) return null;
    return { i, c, cost: c.cost, can: (G.save.data.mora || 0) >= c.cost };
  }
  function metaFxText(d, lv) {
    if (d.max === 1 || d.keystone || !d.per) return d.desc || '';
    const v = d.pct ? Math.round(d.per * lv * 100) + '%' : Math.round(d.per * lv * 10) / 10;
    return d.name + ' +' + v;
  }
  function guideCard() {
    const ms = metaState(), cs = consState(), mora = G.save.data.mora || 0;
    const PU = G.progressionUI;
    const orb = (d, col) => { const o = el('i', { class: 'gd-orb', style: `--c:${col}` }); if (PU && PU.glyph && d.glyph) o.innerHTML = PU.glyph(d.glyph); else o.append(el('img', { src: icon('crystal'), alt: '' })); return o; };
    let pick = ms.can[0] ? { tab: 'meta', m: ms.can[0] } : null;
    if (cs && cs.can && (!pick || cs.cost <= pick.m.cost)) pick = { tab: 'const', c: cs };
    let target = pick;
    if (!target) {
      const a = ms.next, c = cs;
      if (a && (!c || a.cost <= c.cost)) target = { tab: 'meta', m: a }; else if (c) target = { tab: 'const', c };
    }
    if (!target) return el('div', { class: 'guide done' }, el('i', { class: 'gd-orb', style: '--c:#ffd24a' }, '★'), el('div', { class: 'gd-t' }, el('span', { class: 'kt' }, '強化'), el('b', null, 'すべて最大！すごい！')));
    const can = target === pick, cost = target.m ? target.m.cost : target.c.cost, nCan = ms.can.length + (cs && cs.can ? 1 : 0);
    let o, nm, fxLine, col;
    if (target.m) {
      const { d, lv } = target.m; col = target.m.col; o = orb(d, col); nm = [d.name, el('span', { class: 'gd-lv' }, `Lv.${lv}`, el('i', null, '→'), el('b', null, `Lv.${lv + 1}`))];
      fxLine = (d.max === 1 || d.keystone) ? (d.desc || '') : metaFxText(d, lv) + ' → ' + metaFxText(d, lv + 1).replace(d.name + ' ', '');
    } else {
      col = '#ffe07a'; o = el('i', { class: 'gd-orb', style: `--c:${col}` }, el('img', { src: icon((G.data.characters[selChar] || {}).portrait || selChar), alt: '' }));
      nm = ['命ノ星座 C' + (target.c.i + 1), el('span', { class: 'gd-lv' }, target.c.c.name || '')]; fxLine = target.c.c.short || target.c.c.text || '';
    }
    const pct = Math.max(0, Math.min(100, Math.round(mora / Math.max(1, cost) * 100)));
    const card = el('button', { class: 'guide' + (can ? ' can' : ''), type: 'button', style: `--c:${col}` },
      o,
      el('div', { class: 'gd-t' },
        el('span', { class: 'kt' }, can ? ['★ いま強化できる！', nCan > 1 ? el('em', null, `ほかに ${nCan - 1} こ`) : null] : 'つぎの強化まで'),
        el('b', null, nm), el('small', null, fxLine),
        can ? null : el('div', { class: 'gd-bar' }, el('i', { style: `width:${pct}%` }), el('span', null, el('img', { src: icon('mora'), alt: '' }), `${U.fmtNum(mora)} / ${U.fmtNum(cost)}`))),
      el('div', { class: 'gd-go' }, can ? [el('img', { src: icon('mora'), alt: '' }), U.fmtNum(cost), el('em', null, '強化へ ▸')] : [el('small', null, 'あと'), el('b', null, U.fmtNum(cost - mora)), el('small', null, 'モラ')]));
    card.addEventListener('click', () => { if (homeGo) homeGo(target.tab); });
    return hoverable(card);
  }

  function kitSrc(ic) { return G.proceduralIcons && G.proceduralIcons[ic] && G.hudIconUrl ? G.hudIconUrl(ic) : icon(ic); }
  function kitRows(ch) {
    return ch.kit ? ch.kit : [
      ['amber_arrow', '通常攻撃', ch.normalName || '炎の矢', '近くの敵へ自動で炎の矢を放つ。当たると爆発！'],
      ['bunny', '元素スキル　F / 右下ボタン', ch.skillName || 'ウサギ伯爵', 'ウサギ伯爵を置いて敵を引きつけ、大爆発させる。'],
      ['rain', '元素爆発　Q / 右下ボタン', ch.burstName || '矢の雨', 'エネルギーが満タンで発動。広い範囲に炎の矢の雨！'],
      ['crystal', '固有天賦', 'ぜんぶ大きく爆発', ch.passive || '爆発範囲がいつも2倍。']];
  }
  function heroImg(ch) {
    const im = el('img', { class: 'hero-img', src: icon(ch.portrait || ch.id), alt: ch.name });
    if (G.inspect) G.inspect.bindTap(im, () => inspectChars(ch.id, im), ch.name + ' を大きく見る');
    return im;
  }
  /* ---- 拡大ビューア (js/inspect.js): characters / stages. Silhouettes stay black + 「？？？」, closed stages stay dark + 「？？？」 ---- */
  function charInspect(id) {
    const I = G.inspect, c = G.data.characters[id]; if (!c) return { title: '？？？' };
    const E = G.EL[c.element] || {}, cs = charSt(id);
    const base = { img: icon(c.portrait || id), photo: true, color: E.color || '#d3bc8e', sub: '◆ ' + (E.name || '') + '元素 ・ ' + (c.weapon || '') };
    if (c.implemented && cs !== 'open') {
      const u = UL(), conds = u ? u.conds(id) : [];
      return Object.assign(base, { locked: true, title: '？？？', lv: cs === 'buyable' ? '解放できる！' : '未解放',
        body: I.sec('', cs === 'buyable' ? '条件クリア！ 解放すると 正体がわかるよ！' : 'まだ 影しか見えない…。条件をクリアすると 仲間にできるよ！')
          + (conds.length ? I.sec('解放条件', conds.map(k => (k.ok ? '✓ ' : '・ ') + I.esc(k.text)).join('<br>')) : '') });
    }
    const kit = kitRows(c);
    return Object.assign(base, { title: c.name, sub: base.sub + (c.title ? ' ・ ' + I.esc(c.title) : ''), lv: c.implemented ? (id === selChar ? '✔ 選択中' : '') : '準備中',
      body: (c.blurb ? I.sec('', I.esc(c.blurb)) : '') + I.sec('わざ', kit.map(r => '<b>' + I.esc(r[2]) + '</b>　<small style="display:inline;color:#ece5d8aa">' + I.esc(r[1].split('　')[0]) + '</small>').join('<br>')) });
  }
  function inspectChars(id, from) {
    const ids = (G.data.roster || ['amber']).filter(k => G.data.characters[k]);
    const cardOf = k => G.ui.root.querySelector('.r-card[data-char="' + k + '"]');
    G.inspect.open({ index: Math.max(0, ids.indexOf(id)), from, list: ids.map(k => () => Object.assign(charInspect(k), { from: k === id ? from : cardOf(k) })) });
  }
  function stageInspect(id) {
    const I = G.inspect, d = stg(id), open = stOpen(id), cl = stCleared(id), rc = stRec(id), known = open || cl;
    const boss = `<img src="${icon(d.boss)}" width="34" height="34" alt=""${known ? '' : ' class="sil"'}>` + (known ? I.esc(d.bossName || '') : '？？？');
    const base = { img: 'assets/' + d.bgSmall + '.webp', wide: true, color: d.color || '#d3bc8e', badge: boss, sub: 'STAGE ' + d.order + (known && d.region ? ' ・ ' + I.esc(d.region) : '') };
    if (!open) return Object.assign(base, { dim: true, title: '？？？', lv: '未解放', body: I.sec('解放条件', I.esc(UL() ? UL().stageCond(id) : '準備中')) });
    return Object.assign(base, { title: d.name, lv: cl ? 'CLEAR' : id === selStage ? '✔ 選択中' : '挑戦中', lvMax: cl,
      body: I.sec('目標', Math.round((d.duration || 600) / 60) + '分生きのこり、' + I.esc(d.bossName || 'ボス') + 'を倒せ！') + (d.blurb ? I.sec('', I.esc(d.blurb)) : '')
        + '<div class="insp-chips"><span>強さ ' + STARS(d.stars || d.order) + '</span><span>最長 ' + U.fmtTime(rc.best || 0) + '</span><span>最多撃破 ' + U.fmtNum(rc.kills || 0) + '</span><span>クリア ' + (rc.clears || 0) + '回</span></div>' });
  }
  function inspectStages(id, from) {
    const ids = stList().map(d => d.id);
    const cardOf = k => G.ui.root.querySelector('.stg-card[data-stage="' + k + '"]');
    G.inspect.open({ index: Math.max(0, ids.indexOf(id)), from, list: ids.map(k => () => Object.assign(stageInspect(k), { from: k === id ? from : cardOf(k) })) });
  }
  function kitRow(ic, kind, name, desc) {
    const src = kitSrc(ic);
    return el('div', { class: 'kit-row' }, el('div', { class: 'ki' }, el('img', { src, alt: '' })),
      el('div', null, el('span', { class: 'kt' }, kind), el('b', null, name), el('small', null, desc)));
  }

  /* ============================== SETTINGS ============================== */
  /** in the portrait wrapper (phone held sideways with rotation lock) let the player flip the 90deg turn */
  function rotRow() {
    let P = null; try { P = window.__MONDO_EMBED && window.parent && window.parent !== window && window.parent.__mondoSetRot ? window.parent : null; } catch (e) { P = null; }
    if (!P) return null;
    const wrap = el('div', { class: 'g-seg', role: 'radiogroup' });
    let cur = 0; try { cur = P.__mondoGetRot() ? 1 : 0; } catch (e) { }
    [['ふつう', 0], ['反対向き', 1]].forEach(([label, v]) => {
      const b = el('button', { class: 'seg' + (cur === v ? ' on' : ''), type: 'button' }, label);
      b.addEventListener('click', () => { try { P.__mondoSetRot(v); } catch (e) { } [...wrap.children].forEach(c => c.classList.toggle('on', c === b)); sfx('ui'); });
      wrap.append(hoverable(b));
    });
    return el('div', { class: 'set-row' }, el('div', { class: 'lbl' }, '画面の向き', el('small', null, 'さかさまに見えるとき')), el('div', { class: 'ctl' }, wrap));
  }
  function settings(from) {
    const s = G.save.data.settings;
    const save = () => { G.save.write(); try { G.audio.applySettings(); } catch (e) { } };
    const sw = (key, after) => {
      const b = el('button', { class: 'g-switch' + (s[key] ? ' on' : ''), type: 'button', role: 'switch', 'aria-checked': String(!!s[key]) });
      b.addEventListener('click', () => { s[key] = !s[key]; b.classList.toggle('on', s[key]); b.setAttribute('aria-checked', String(s[key])); save(); sfx('ui'); after && after(s[key]); });
      return hoverable(b);
    };
    const range = (key, onKey) => {
      const val = el('span', { class: 'val' });
      const r = el('input', { class: 'g-range', type: 'range', min: 0, max: 100, step: 1, value: Math.round(s[key] * 100), 'aria-label': '音量' });
      const upd = () => { const v = +r.value; s[key] = v / 100; r.style.setProperty('--v', v + '%'); val.textContent = v; };
      r.addEventListener('input', () => { upd(); try { G.audio.applySettings(); } catch (e) { } });
      r.addEventListener('change', () => { upd(); save(); sfx(key === 'sfxVolume' ? 'xp' : 'ui'); });
      hoverable(r); upd();
      if (!s[onKey]) r.disabled = true;
      return { r, val };
    };
    /** switch for a setting that may be missing from old saves (undefined → def) */
    const swDef = (key, def) => {
      if (s[key] === undefined) s[key] = def;
      return sw(key, key === 'vibrate' ? on => { if (on) try { G.input.haptic && G.input.haptic([20, 40, 20]); } catch (e) { } } : null);
    };
    const seg = (key, opts, after, def) => {
      if (s[key] === undefined && def !== undefined) s[key] = def;
      const wrap = el('div', { class: 'g-seg', role: 'radiogroup' });
      opts.forEach(([label, v]) => {
        const b = el('button', { class: 'seg' + (s[key] === v ? ' on' : ''), type: 'button' }, label);
        b.addEventListener('click', () => { s[key] = v; [...wrap.children].forEach(c => c.classList.toggle('on', c === b)); save(); sfx('ui'); after && after(v); });
        wrap.append(hoverable(b));
      });
      return wrap;
    };
    const fsSwitch = () => {
      const b = el('button', { class: 'g-switch' + (isFs() ? ' on' : ''), type: 'button', role: 'switch', 'aria-checked': String(isFs()) });
      const sync = () => { if (!b.isConnected) { document.removeEventListener('fullscreenchange', sync); return; } b.classList.toggle('on', isFs()); b.setAttribute('aria-checked', String(isFs())); };
      document.addEventListener('fullscreenchange', sync);
      b.addEventListener('click', () => { sfx('ui'); toggleFs(); });
      return hoverable(b);
    };
    const row = (label, sub, ...ctl) => el('div', { class: 'set-row' }, el('div', { class: 'lbl' }, label, sub ? el('small', null, sub) : null), el('div', { class: 'ctl' }, ...ctl));
    const sv = range('sfxVolume', 'sfx'), bv = range('bgmVolume', 'bgm');
    const grid = el('div', { class: 'set-grid' },
      row('効果音', 'こうかおん', sw('sfx', on => { sv.r.disabled = !on; }), sv.r, sv.val),
      row('BGM', 'おんがく', sw('bgm', on => { bv.r.disabled = !on; if (on) bgm(wantBgm); }), bv.r, bv.val),
      row('演出軽減', '重いときはON', sw('reducedFx', () => { applyBodyFlags(); try { G.render.resize(); } catch (e) { } G.backdrop && G.backdrop.reset(); })),
      row('画面の揺れ', null, seg('screenShake', [['オフ', 0], ['弱', 0.5], ['標準', 1]])),
      row('ダメージ数字', null, sw('damageNumbers')),
      row('タッチ操作', 'スティックとボタン', seg('touchControls', [['自動', 'auto'], ['ON', 'on'], ['OFF', 'off']], () => { try { G.input.setTouchMode(isTouchDevice(), 'settings'); } catch (e) { } })),
      row('ボタンの大きさ', 'スマホ用', seg('touchSize', [['ふつう', 'm'], ['大きい', 'l']], applyBodyFlags, 'm')),
      row('振動', 'しんどう（スマホ）', swDef('vibrate', true)),
      row('FPS表示', null, sw('showFps')),
      canFs() ? row('全画面', 'ぜんがめん', fsSwitch()) : null,
      rotRow());
    let close;
    const back = btn('戻る', { icon: '✕', ic: 'no', back: true, auto: true, on: () => close() });
    close = openModal(panel('set-panel', head('設定'), el('div', { class: 'scroll', style: 'min-height:0;flex:1 1 auto;position:relative;z-index:1' }, grid),
      el('div', { class: 'set-note' }, '変更は自動で保存されます'), el('div', { class: 'g-foot' }, back)));
  }

  /* ============================== RESET ============================== */
  function holdButton(label, onDone, dur) {
    dur = dur || 1000;
    const b = el('button', { class: 'g-btn danger hold', type: 'button' }, el('span', { class: 'hold-fill' }), el('span', { class: 'g-ic x' }, '!'), el('span', null, label));
    let t0 = 0, raf = 0, done = false;
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / dur); b.style.setProperty('--p', p.toFixed(3));
      if (p >= 1) { done = true; stop(); sfx('denied'); onDone(); return; }
      raf = requestAnimationFrame(tick);
    };
    function start() { if (t0 || done) return; t0 = performance.now(); b.classList.add('holding'); sfx('uiHover'); raf = requestAnimationFrame(tick); }
    function stop() { cancelAnimationFrame(raf); t0 = 0; b.classList.remove('holding'); if (!done) b.style.setProperty('--p', 0); }
    b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) { } start(); });
    b.addEventListener('pointerup', stop); b.addEventListener('pointercancel', stop); b.addEventListener('lostpointercapture', stop);
    b.addEventListener('keydown', e => { if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) start(); } });
    b.addEventListener('keyup', e => { if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') { e.preventDefault(); stop(); } });
    b.addEventListener('blur', stop);
    b.addEventListener('click', e => e.preventDefault());
    b._holdStart = start; b._holdEnd = stop;
    return hoverable(b);
  }
  function reset() {
    let close;
    const cancel = btn('取り消す', { icon: '✕', ic: 'no', back: true, auto: true, on: () => close() });
    const del = holdButton('長押しで削除', () => {
      G.save.reset();
      try { G.audio.applySettings(); } catch (e) { }
      try { G.input.setTouchMode(isTouchDevice(), 'reset'); } catch (e) { }
      applyBodyFlags(); try { G.render.resize(); } catch (e) { }
      close();
      toast('データを削除しました');
      setTimeout(() => title(), 250);
    });
    close = openModal(panel('conf-panel', head('データのリセット'),
      el('div', { class: 'conf-body' },
        'この端末に保存された、すべてのデータを削除します。',
        el('div', { class: 'del-list' }, ['モラ', '育成', '命ノ星座', '聖遺物', 'スキルブック', 'キャラ・ステージ解放', '記録', '設定'].map(t => el('span', null, t))),
        el('div', { class: 'warn' }, '削除したデータは元に戻せません。'),
        el('small', { style: 'color:#ece5d899' }, '「長押しで削除」を1秒おしつづけると削除されます')),
      el('div', { class: 'g-foot' }, cancel, del)));
  }

  /* ============================== QUIT ============================== */
  function quit() {
    G.save.write();
    gust(() => {
      G.setScene('quit'); G.ui.clearAll();
      G.backdrop && G.backdrop.setMode('dim');
      bgm(null);
      G.ui.show(el('div', { class: 'quit', 'data-nav': '' },
        el('h2', { class: 'enter', style: '--d:.3s' }, 'おつかれさまでした'),
        el('p', { class: 'enter', style: '--d:.8s' }, '風が、また君を呼ぶ日まで。'),
        el('div', { class: 'enter', style: '--d:1.3s;margin-top:10px' }, btn('タイトルへもどる', { cls: 'glass', icon: '↺', auto: true, back: true, on: () => title() })),
        el('small', { class: 'enter', style: '--d:1.6s' }, 'データは保存されました。このままタブやアプリを閉じて終了できます。')));
      setTimeout(() => nav.focusDefault(), 1400);
      setTimeout(() => { try { window.close(); } catch (e) { } }, 1600);
    }, { sfx: 'ui' });
  }

  /* ============================== PAUSE ============================== */
  function buildList(R) {
    const order = { bless: 0, evo: 1, char: 2, launcher: 3, stat: 4 };
    const keys = Object.keys(R.levels || {}).filter(k => R.levels[k] > 0 && G.upgrades[k]);
    keys.sort((a, b) => ((order[G.upgrades[a].cat] ?? 4) - (order[G.upgrades[b].cat] ?? 4)) || (R.levels[b] - R.levels[a]));
    return keys;
  }
  const RC = { 3: '#6fb7ff', 4: '#c28bff', 5: '#ffc34a' };
  function pips(lv, max) {
    if (max > 8) return el('div', { class: 'pips' }, el('small', { style: 'color:#f5deb0;font-weight:900' }, 'Lv.' + lv));
    const p = el('div', { class: 'pips' }); for (let i = 0; i < max; i++) p.append(el('i', { class: i < lv ? 'on' : '' })); return p;
  }
  function pause() {
    const R = G.run; if (!R || R.over || R.pauses.size) return;   // never stack over level-up / chest / cut-in overlays
    G.game.pause('menu'); sfx('ui');
    const p = R.player, S = R.stats || {};
    const keys = buildList(R);
    const build = keys.length ? el('div', { class: 'build' }, keys.map(k => {
      const up = G.upgrades[k], lv = R.levels[k], evo = up.cat === 'evo' || R.evolved[k], bless = up.cat === 'bless';
      return el('div', { class: 'b-item' + (evo ? ' evo' : '') + (bless ? ' evo bless' : ''), 'data-key': k, style: `--rc:${RC[up.rarity] || '#d3bc8e'}` },
        el('div', { class: 'bi' }, up.icon ? el('img', { src: icon(up.icon), alt: '' }) : el('b', null, up.glyph || '✦')),
        el('div', { class: 'b-nm' }, el('b', null, up.name), bless ? el('small', { style: 'color:#ffe7a8' }, '★5 天啓') : evo ? el('small', { style: 'color:#ffe7a8' }, '進化済み') : pips(lv, up.max || 1)));
    })) : el('div', { class: 'b-empty' }, 'まだ強化はありません。');
    const pct = v => Math.round((v || 0) * 100) + '%';
    const stat = (k, v) => el('div', { class: 'stat' }, el('span', null, k), el('b', null, v));
    const stats = el('div', { class: 'stats' },
      stat('攻撃力', U.fmtNum(S.atk || 0)), stat('最大HP', U.fmtNum(p.maxHp)),
      stat('防御力', U.fmtNum(S.def || 0)), stat('移動速度', (S.speed || 0).toFixed(1)),
      stat('会心率', pct(S.critRate)), stat('会心ダメージ', pct(S.critDmg)),
      stat('攻撃速度', pct(S.haste || 1)), stat('元素チャージ効率', pct(S.recharge || 1)),
      stat('攻撃範囲', pct(S.areaMul || 1)), stat('与ダメージ', '+' + pct(S.dmgBonus)),
      stat('クールタイム', '-' + pct(S.cdr)), stat('回収範囲', (S.pickup || 0).toFixed(1)));
    let close;
    const resume = () => { close(); G.game.resume('menu'); sfx('ui'); };
    const chip = (img, text) => el('span', { class: 'chip' }, img ? el('img', { src: icon(img), alt: '' }) : null, text);
    const pp = panel('pause-panel',
      el('div', { class: 'pause-top' }, el('h2', null, '休憩中'),
        chip(null, '⏱ ' + U.fmtTime(R.time)), chip(null, 'Lv.' + p.level), chip('hilichurl', U.fmtNum(R.kills)), chip('mora', U.fmtNum(Math.floor(R.mora)))),
      el('div', { class: 'g-divider' }),
      el('div', { class: 'pause-body scroll' },
        buildCol(R, build),
        el('div', { class: 'pb-col' }, el('h4', null, 'ステータス'), stats)),
      el('div', { class: 'g-foot' },
        btn('再開', { icon: '▶', ic: 'ok', auto: true, back: true, sfx: false, on: resume }),
        btn('スキルブック', { icon: '✦', cls: 'pz-book', on: () => skillBook(R.charId) }),
        btn('設定', { icon: '⚙', on: () => settings('pause') }),
        btn('モラを持って帰還', { icon: '⌂', on: () => retreat(close) })));
    wireSkillIcons(R, pp);
    close = openModal(pp);
  }
  /* ---- ui_v6: 一時停止メニューのスキル説明 — tap a skill icon → name, Lv/MAX, now / next-Lv effect and the evolution hint
     (same 「？？？」 rule as the スキルブック). Tap the same icon again / outside / Esc closes it. */
  let spop = null;
  const CATN = { char: '専用スキル', launcher: 'ランチャー', stat: 'ステータス', bless: '★5 天啓', evo: '進化スキル' };
  function closeSkillPop(silent) {
    if (!spop) return; const p = spop; spop = null;
    removeEventListener('keydown', p.onKey, true); removeEventListener('pointerdown', p.onDown, true); cancelAnimationFrame(p.raf);
    if (p.src) { p.src.classList.remove('sk-on'); p.src.setAttribute('aria-expanded', 'false'); }
    p.node.classList.add('out'); setTimeout(() => p.node.remove(), 160);
    if (!silent) sfx('uiHover');
  }
  function skillPopBody(R, key, evoKey) {
    const up = G.upgrades[key] || {}, max = up.max || 1, lv = Math.min(max, R.levels[key] || 0), isEvo = up.cat === 'evo', bless = up.cat === 'bless';
    const html = s => el('div', { class: 'sk-fx', html: String(s || '').replace(/\n/g, '<br>') });
    const artH = k => { try { const PU = G.progressionUI; PU.ensureCss && PU.ensureCss(); return PU.art(k); } catch (e) { return ''; } };
    const who = up.cat === 'char' && up.char && G.data.characters[up.char] ? G.data.characters[up.char].name + '専用' : CATN[up.cat] || '';
    const lvTxt = isEvo ? '進化済み' : bless ? '★5' : lv >= max ? 'Lv.' + lv + ' MAX' : 'Lv.' + lv + ' / MAX ' + max;
    const box = el('div', { class: 'sk-in' },
      el('div', { class: 'sk-hd' }, el('span', { class: 'sk-icw' }, el('span', { class: 'sk-ic', html: artH(evoKey || key) })),
        el('div', { class: 'sk-tt' }, el('small', null, who), el('b', null, up.name || key)),
        el('span', { class: 'sk-lv' + (lv >= max || isEvo || bless ? ' max' : '') }, lvTxt)));
    if (!isEvo && !bless && max > 1) box.append(el('div', { class: 'sk-pips' }, Array.from({ length: max }, (_, i) => el('i', { class: i < lv ? 'on' : '' }))));
    box.append(el('div', { class: 'sk-sec' }, el('h5', null, 'いまの効果'), html(up.desc ? up.desc(Math.max(1, lv)) : up.short)));
    if (!isEvo && !bless) {
      if (lv < max) box.append(el('div', { class: 'sk-sec nx' }, el('h5', null, '次のLv.' + (lv + 1)), html(up.desc ? up.desc(lv + 1) : '')));
      else box.append(el('div', { class: 'sk-sec mx' }, el('h5', null, 'MAX！'), el('div', { class: 'sk-fx' }, 'これ以上は強くならないよ')));
    }
    if (evoKey && G.upgrades[evoKey]) {
      const eu = G.upgrades[evoKey];
      box.append(el('div', { class: 'sk-sec ev' }, el('h5', null, '★ 進化済み「' + eu.name + '」'), html(eu.desc ? eu.desc(1) : eu.short)));
    } else if (!isEvo && !bless && G.skillbook) {
      const evs = G.skillbook.evosOf(key, R.charId).filter(e => !R.evolved[e.key]);
      if (evs.length) box.append(el('div', { class: 'sk-evos' }, evs.map(e => el('div', { class: 'sk-evo' + (G.skillbook.has(e.key) ? ' known' : '') }, el('i', null, '✦'), G.skillbook.evoText(e.key)))));
    }
    return box;
  }
  function openSkillPop(R, src, key, evoKey) {
    if (!R || !G.upgrades[key]) return;
    if (spop && spop.src === src) { closeSkillPop(); return; }
    closeSkillPop(true);
    sfx('ui');
    const node = el('div', { class: 'sk-pop', role: 'dialog', 'aria-label': (G.upgrades[key].name || '') + ' の説明' },
      el('button', { class: 'sk-x', type: 'button', 'aria-label': '閉じる', onclick: () => closeSkillPop() }, '✕'), skillPopBody(R, key, evoKey));
    document.body.append(node);
    if (G.inspect) {
      const ic = node.querySelector('.sk-ic'), zoom = () => inspectBuild(R, src, ic);
      G.inspect.bindTap(ic, zoom, '大きく見る'); G.inspect.lens(node.querySelector('.sk-icw'), zoom);
    }
    src.classList.add('sk-on'); src.setAttribute('aria-expanded', 'true');
    // place next to the icon (below, else above), clamped to the screen; phones: whichever side has more room
    const r = src.getBoundingClientRect(), W = innerWidth, H = innerHeight, m = 8;
    const w = node.offsetWidth, h = node.offsetHeight;
    let x = r.left + r.width / 2 - w / 2, y = r.bottom + 10, below = true;
    if (y + h > H - m && r.top - 10 - h >= m) { y = r.top - 10 - h; below = false; }
    else if (y + h > H - m) {   // no room above/below → beside the icon
      y = Math.max(m, Math.min(H - m - h, r.top + r.height / 2 - h / 2));
      x = r.right + 10 + w <= W - m ? r.right + 10 : r.left - 10 - w;
    }
    x = Math.max(m, Math.min(W - m - w, x)); y = Math.max(m, y);
    node.style.left = Math.round(x) + 'px'; node.style.top = Math.round(y) + 'px';
    node.style.setProperty('--ax', Math.round(U.clamp(r.left + r.width / 2 - x, 16, w - 16)) + 'px');
    node.classList.add(below ? 'below' : 'above');
    let swallow = 0;
    const onKey = e => { if (e.code === 'Escape' || e.key === 'Escape' || e.code === 'Backspace') { e.preventDefault(); e.stopPropagation(); closeSkillPop(); } };
    const onDown = e => {
      const t = e.target;
      if (node.contains(t) || (t && t.closest && t.closest('.insp'))) return;   // taps inside the 拡大ビューア keep the popover
      const hit = t && t.closest && t.closest('[data-key]');
      if (hit && hit === src) return;               // same icon → the click toggles it closed
      closeSkillPop();
      if (!hit) swallow = performance.now();       // tapping outside only closes (no accidental 再開 etc.)
    };
    const onClick = e => { if (swallow && performance.now() - swallow < 600) { e.preventDefault(); e.stopPropagation(); } swallow = 0; removeEventListener('click', onClick, true); };
    addEventListener('click', onClick, true);
    addEventListener('keydown', onKey, true); addEventListener('pointerdown', onDown, true);
    // closes itself when the pause menu goes away (resume / 帰還 / scene change)
    const host = src.closest('.ui-modal');
    const watch = () => { if (!spop || spop.node !== node) return; if (!src.isConnected || (host && host.classList.contains('closing'))) { closeSkillPop(true); return; } spop.raf = requestAnimationFrame(watch); };
    spop = { node, src, onKey, onDown, raf: requestAnimationFrame(watch) };
  }
  /** 拡大ビューア over every skill of the pause menu (same order as the icons); `from` = the element it zooms out of */
  function inspectBuild(R, src, from) {
    if (!G.inspect) return;
    const host = src.closest('.pause-panel') || document;
    const nodes = [...host.querySelectorAll('.pg-bi[data-key], .b-item[data-key]')];
    G.inspect.open({ index: Math.max(0, nodes.indexOf(src)), from: from || src,
      list: nodes.map(n => () => G.inspect.skill(n.dataset.key, { mode: 'run', R, evoKey: n.dataset.evo, from: n === src && from ? from : n })) });
  }
  /** makes every skill icon of the pause menu (renderBuild .pg-bi / fallback .b-item) a tappable button */
  function wireSkillIcons(R, root) {
    root.querySelectorAll('.pg-bi[data-key], .b-item[data-key]').forEach(n => {
      n.setAttribute('role', 'button'); n.tabIndex = 0; n.setAttribute('aria-expanded', 'false');
      n.classList.add('sk-tap');
      n.setAttribute('aria-label', ((G.upgrades[n.dataset.key] || {}).name || '') + ' の説明');
      n.removeAttribute('title');
      n.addEventListener('click', e => { e.stopPropagation(); openSkillPop(R, n, n.dataset.key, n.dataset.evo); });
      n.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openSkillPop(R, n, n.dataset.key, n.dataset.evo); } });
      if (G.inspect) G.inspect.bindHold(n, () => { closeSkillPop(true); inspectBuild(R, n); });   // long-press / right-click → big view
    });
  }
  /** スキルブック as a modal (pause menu: the run stays paused; 閉じる / Esc returns to the pause menu) */
  function skillBook(charId) {
    if (!G.skillbook) return;
    const body = el('div', { class: 'scroll book-scroll' });
    let close;
    const back = btn('閉じる', { icon: '✕', ic: 'no', back: true, auto: true, on: () => close() });
    close = openModal(panel('book-panel', body, el('div', { class: 'g-foot' }, back)));
    try { G.skillbook.render(body, { charId }); } catch (e) { console.error('[screens] skillbook', e); body.append(soon('準備中', 'スキルブック はもうすぐ登場します。')); }
  }
  /** pause-menu build column: PROGRESSION's renderBuild (equipment + evolution recipes) when available, else our list */
  function buildCol(R, fallback) {
    const col = el('div', { class: 'pb-col pb-build' });
    const fn = G.progressionUI && G.progressionUI.renderBuild;
    if (typeof fn === 'function') {
      const box = el('div', { class: 'pb-ext' });
      try { fn(box, R); if (box.childNodes.length) { const ph = box.querySelector('.pg-ph'); if (ph && box.querySelector('.pg-bi[data-key]')) ph.append(el('span', { class: 'sk-tip' }, G.input && G.input.touchMode ? 'アイコンをタップで説明' : 'アイコンを押すと説明')); col.append(box); return col; } } catch (e) { console.error('[screens] renderBuild', e); }
    }
    col.append(el('h4', null, 'いまのビルド'), fallback);
    return col;
  }
  function retreat(closePause) {
    const R = G.run; if (!R) return; let close;
    close = openModal(panel('conf-panel', head('帰還しますか？'),
      el('div', { class: 'conf-body' }, 'ここまでに集めた ', el('b', { style: 'color:#ffe08a' }, U.fmtNum(Math.floor(R.mora)) + ' モラ'), ' を持って帰ります。',
        el('br'), el('small', { style: 'color:#ece5d899' }, 'この冒険はここで終わります。')),
      el('div', { class: 'g-foot' },
        btn('つづける', { icon: '✕', ic: 'no', back: true, auto: true, on: () => close() }),
        btn('帰還する', { icon: '⌂', ic: 'ok', on: () => { close(); closePause(); G.ui.clearModals(); G.game.resume('menu'); G.game.end(false, 'retreat'); } }))));
  }

  /* ============================== RESULTS ============================== */
  const SRC_NAME = { overloaded: '過負荷', electrocharged: '感電', superconduct: '超電導', swirl: '拡散', shatter: '氷砕き', crystallize: '結晶化', vaporize: '蒸発', melt: '溶解', frozen: '凍結',
    pyro: '炎', hydro: '水', cryo: '氷', electro: '雷', anemo: '風', geo: '岩', physical: '物理', normal: '炎の矢', skill: 'ウサギ伯爵', burst: '矢の雨' };
  const SRC_ICON = { overloaded: 'bomb', electrocharged: 'lightning', superconduct: 'snow', swirl: 'wind', shatter: 'snow', crystallize: 'crystal', vaporize: 'bottle', melt: 'snow', normal: 'amber_arrow', skill: 'bunny', burst: 'rain',
    pyro: 'bomb', hydro: 'bottle', cryo: 'snow', electro: 'lightning', anemo: 'wind', geo: 'rock' };
  const REACT_COL = { overloaded: '#ff8a5a', electrocharged: '#d59bff', superconduct: '#b8a8ff', swirl: '#5cf2c8', shatter: '#bfefff', crystallize: '#ffd24a', vaporize: '#ffc28a', melt: '#ffcf9a', frozen: '#9ff0ff' };
  function results(R) {
    G.ui.clearModals();
    document.body.classList.add('in-results');
    const kind = R.victory ? 'victory' : R.endReason === 'retreat' ? 'retreat' : 'defeat';
    bgm(kind === 'victory' ? 'victory' : kind === 'defeat' ? 'defeat' : 'home');
    const S = G.save.data, prev = prevStats || {};
    const gained = Math.floor(R.mora);
    const reacts = Object.values(R.reactions || {}).reduce((a, b) => a + (+b || 0), 0);
    const line = (label, img, cls) => { const b = el('b', null, '0'); const n = el('div', { class: 'res-line ' + (cls || '') }, el('span', null, img ? el('img', { src: icon(img), alt: '' }) : null, label), b); n._b = b; return n; };
    const L = {
      time: line('生存時間', null, R.time > (prev.bestTime || 0) && (prev.runs || 0) > 0 ? 'new' : ''),
      kills: line('撃破数', 'hilichurl', R.kills > (prev.bestKills || 0) && (prev.runs || 0) > 0 ? 'new' : ''),
      combo: line('最大コンボ', null), dmg: line('与ダメージ', null), react: line('元素反応', 'crystal'),
      mora: line('獲得モラ', 'mora', 'mora'), total: line('所持モラ', 'mora', 'mora total'),
    };
    // damage sources
    const src = Object.entries(R.damageBySrc || {}).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxD = src.length ? src[0][1] : 1;
    const bars = [], dmgInfo = [];
    const dmgList = src.length ? src.map(([k, v]) => {
      const cb = G.combat || {};
      const up = G.upgrades[k];
      const name = (cb.srcName && cb.srcName(k)) || (up && up.name) || SRC_NAME[k] || '???';
      const ic = (cb.srcIcon && cb.srcIcon(k)) || (up && up.icon) || SRC_ICON[k] || 'relic';
      const upEl = up && up.el || (cb.srcName && G.upgrades['bless_' + k] && G.upgrades['bless_' + k].el);
      const gold = (up && up.cat === 'bless') || !!G.upgrades['bless_' + k];
      const col = gold ? '#ffcf6b' : upEl && G.EL[upEl] ? G.EL[upEl].color : G.EL[k] ? G.EL[k].color : REACT_COL[k] || '#ff9a4a';
      const bar = el('i', { style: `--c:${col}` }); bars.push([bar, v / maxD]);
      dmgInfo.push({ k, v, name, ic, col, up });
      return el('div', { class: 'dmg-row' + (gold ? ' gold' : '') }, el('img', { src: icon(ic), alt: '' }), el('div', { class: 'dn' }, el('b', null, name), el('div', { class: 'dmg-bar' }, bar)), el('span', { class: 'dv' }, U.fmtNum(v)));
    }) : [el('div', { class: 'b-empty' }, '記録なし')];
    const totalD = dmgInfo.reduce((a, x) => a + x.v, 0) || 1;
    if (G.inspect && dmgInfo.length) dmgList.forEach((row, i) => G.inspect.bindTap(row, () => G.inspect.open({ index: i, from: row.querySelector('img'),
      list: dmgInfo.map((x, j) => () => {
        const I = G.inspect, lv = x.up && R.levels ? (R.levels[x.k] || 0) : 0;
        const fx = x.up && x.up.desc ? I.sec(x.up.cat === 'evo' || x.up.cat === 'bless' ? '効果' : 'Lv.' + Math.max(1, lv) + ' の効果', I.nl(x.up.desc(Math.max(1, lv)))) : '';
        return { img: icon(x.ic), title: x.name, sub: 'ダメージ内訳　' + (j + 1) + '位', lv: U.fmtNum(x.v) + ' ダメージ', color: x.col, from: dmgList[j] && dmgList[j].querySelector('img'),
          body: I.sec('', 'この冒険のダメージの <b>' + Math.round(x.v / totalD * 100) + '%</b>（上位' + dmgInfo.length + 'つの中で）') + fx };
      }) })));
    const sd = stg(R.stageId || 'mondstadt');
    const GOD = { venti: '風神', zhongli: '岩神', raiden: '雷神', nahida: '草神' };
    const heads = {
      victory: ['STAGE CLEAR', 'ステージクリア！', (GOD[sd.boss] || sd.bossName || '神') + 'に認められた！'],
      defeat: ['DEFEATED', '力尽きた…', 'もう一度、風と共に。'],
      retreat: ['RETURN', '無事に帰還', 'モラを持ち帰った！'],
    }[kind];
    const again = btn('もう一度', { cls: 'primary', icon: '↻', auto: true, sfx: false, on: () => gust(() => { G.game.leave(); G.startRun(R.charId || 'amber', R.stageId || 'mondstadt'); }) });
    // what this clear opened up (next stage / characters that can now be bought)
    const nu = kind === 'victory' && UL() ? UL().newlyUnlocked() : { stages: [], chars: [] };
    const unlockLine = nu.stages.length || nu.chars.length ? el('div', { class: 'res-unlock' },
      nu.stages.map(id => el('span', { class: 'ru-chip' }, el('i', { html: SVG_LOCK }), el('b', null, 'NEW'), stg(id).name + ' 解放！')),
      nu.chars.length ? el('span', { class: 'ru-chip ch' }, nu.chars.map(id => el('img', { src: icon((G.data.characters[id] || {}).portrait || id), alt: '' })), el('b', null, 'NEW'), '新しい仲間 ' + nu.chars.length + '人 を解放できる！') : null) : null;
    again.style.cssText = 'min-width:220px;letter-spacing:.2em';
    const low = S.settings.reducedFx;
    const confetti = el('div', { class: 'confetti', 'aria-hidden': 'true' });
    if (kind === 'victory') {
      const CC = ['#ffd24a', '#ff7a3d', '#5cf2c8', '#3fa9ff', '#c77dff', '#fff7e6', '#9ff0ff'];
      for (let i = 0; i < (low ? 24 : 90); i++) confetti.append(el('i', { style: `--x:${(R01() * 100).toFixed(1)}%;--d:${(R01() * 2.4).toFixed(2)}s;--t:${(2.6 + R01() * 2.4).toFixed(2)}s;--c:${CC[i % CC.length]};--r:${Math.round(R01() * 360)}deg;--dx:${Math.round((R01() - 0.5) * 160)}px;--w:${(5 + R01() * 6).toFixed(1)}px` }));
    }
    const isNew = L.time.classList.contains('new') || L.kills.classList.contains('new');
    const stamp = isNew ? el('div', { class: 'res-stamp' }, el('small', null, 'NEW RECORD'), '新記録！') : null;
    const scr = el('div', { class: 'results ' + kind, 'data-nav': '' },
      el('div', { class: 'res-rays' }), confetti,
      el('div', { class: 'res-head' }, stamp, el('div', { class: 'rk' }, heads[0]), el('h2', null, heads[1]), el('div', { class: 'res-sub' }, sd.name + '　・　' + heads[2]), unlockLine),
      el('div', { class: 'res-body' },
        panel('enter-l scroll', el('div', { class: 'res-list' }, Object.values(L))),
        panel('enter-r scroll', el('h4', { style: 'margin:6px 0 4px;font-size:12px;color:#d3bc8e;letter-spacing:.16em;position:relative;z-index:1' }, 'ダメージ内訳'), el('div', { style: 'position:relative;z-index:1' }, dmgList))),
      el('div', { class: 'res-foot enter', style: '--d:.9s' }, again, btn('ホームへ', { cls: 'glass', icon: '⌂', back: true, on: () => { G.game.leave(); home(); } })));
    scr.querySelectorAll('.res-body > .g-panel').forEach((p, i) => p.style.setProperty('--d', (0.3 + i * 0.15) + 's'));
    G.ui.show(scr);
    setTimeout(() => nav.focusDefault(scr), 900);
    // staggered count-ups
    const seq = [
      [L.time, 0, R.time, v => U.fmtTime(v)], [L.kills, 0, R.kills], [L.combo, 0, R.maxCombo || 0], [L.dmg, 0, R.damageDealt || 0],
      [L.react, 0, reacts], [L.mora, 0, gained], [L.total, S.mora - gained, S.mora],
    ];
    seq.forEach(([n, a, b, f], i) => setTimeout(() => {
      if (!n.isConnected) return;
      countUp(n._b, a, b, 650, f, () => { n.classList.add('pop'); sfx(n.classList.contains('mora') ? 'mora' : 'xp'); });
    }, 500 + i * 190));
    setTimeout(() => bars.forEach(([b, k]) => { b.style.width = Math.max(3, k * 100) + '%'; }), 700);
    if (kind === 'victory') sfx('victory'); else if (kind === 'defeat') sfx('defeat');
    if (unlockLine) setTimeout(() => { if (unlockLine.isConnected) { unlockLine.classList.add('on'); sfx('star'); } }, 1500);
    if (stamp) setTimeout(() => { if (stamp.isConnected) { stamp.classList.add('on'); sfx('star'); try { G.input.haptic && G.input.haptic([20, 40, 30]); } catch (e) { } } }, 500 + seq.length * 190 + 500);
  }

  /* ============================== wiring ============================== */
  const api = { title, home, settings, reset, quit, pause, results, toast, gust, nav, skillBook };
  G.bus.on('requestPause', () => pause());
  G.bus.on('runEnd', R => setTimeout(() => { if (G.run === R) results(R); }, R.victory ? 1600 : R.endReason === 'retreat' ? 250 : 1300));
  G.bus.on('saveReset', () => { homeTab = 'adv'; });
  // turning the phone upright shows the "rotate" overlay — make sure the run is paused under it
  try {
    const mq = matchMedia('(orientation: portrait) and (pointer: coarse)');
    const chk = () => { if (mq.matches && G.scene === 'run' && G.run && !G.run.over && !G.game.isPaused()) G.bus.emit('requestPause'); };
    mq.addEventListener ? mq.addEventListener('change', chk) : mq.addListener(chk);
  } catch (e) { }
  return api;
})();
