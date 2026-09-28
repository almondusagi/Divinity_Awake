/* inspect.js — 拡大ビューア (owner: UI). Tap / long-press an icon anywhere → it zooms up from where it was into a big card:
   the icon at ~45% of the screen height with an element-coloured rim and a slow pulsing glow, the name, Lv / MAX, the whole
   effect text and the evolution sentence (same 「？？？」 rule as the スキルブック). Locked things stay a black silhouette + 「？？？」.
     G.ui.inspect(opts) === G.inspect.open(opts)
       opts: { html | img, title, sub, lv, body (html), locked, color, wide, photo, from (element to zoom from),
               list: [opts | () => opts], index }  — with a list, ←/→ keys, swipes and the edge arrows step through it.
     G.inspect.skill(key, {mode:'run'|'card'|'book', R, lv, next, evoKey, charId, locked, sub})  → opts for an upgrade
     G.inspect.bindTap(el, fn) / bindHold(el, fn) / lens(parent, fn, cls)   ← wiring helpers (fn(el) opens the viewer)
   Closes with ✕ / tapping outside / Esc; the screen underneath (pause menu, level-up cards, chest …) is left untouched.
   During a run it adds the pause reason 'inspect' (the game stays stopped) and removes it again on close. */
'use strict';
G.inspect = (function () {
  const el = G.ui.el;
  const Q = '？？？';
  const HOLD_MS = 400;
  let cur = null;          // { node, list, i, from, opener, paused, t0 }
  const sfx = (n, o) => { try { G.audio.sfx(n, o); } catch (e) { } };
  const reduced = () => { try { return !!G.save.data.settings.reducedFx; } catch (e) { return false; } };
  const SVG_LENS = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.2" cy="10.2" r="6.4" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M15 15l5.6 5.6" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/><path d="M10.2 7.4v5.6M7.4 10.2h5.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  /* ------------------------------------------------------------ helpers for callers */
  const nl = s => String(s == null ? '' : s).replace(/\n/g, '<br>');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /** a titled block of the body */
  function sec(title, html, cls) { return `<div class="insp-sec ${cls || ''}">${title ? `<h5>${title}</h5>` : ''}<div class="insp-fx">${html}</div></div>`; }
  const CATN = { char: '専用スキル', launcher: 'ランチャー', stat: 'ステータス', bless: '★5 天啓', evo: '進化スキル', special: 'ボーナス' };
  const RCOL = { 3: '#6fb7ff', 4: '#c28bff', 5: '#ffc34a' };
  function artHtml(key) {
    const PU = G.progressionUI;
    try { PU.ensureCss && PU.ensureCss(); return PU.art(key, true); } catch (e) { }
    const u = G.upgrades[key] || {};
    return `<div class="pg-art"><img src="assets/icon_${u.icon || 'relic'}.webp" width="96" height="96" alt="" draggable="false"></div>`;
  }
  function def(key) { const P = G.progression; return G.upgrades[key] || (P && P.def && P.def(key)) || null; }
  function starsHtml(n) { try { return G.progressionUI.stars(n); } catch (e) { return '★'.repeat(n); } }
  function evoLinesHtml(key, charId, R) {
    const SB = G.skillbook; if (!SB) return '';
    const evs = SB.evosOf(key, charId).filter(e => !(R && R.evolved && R.evolved[e.key]));
    return evs.length ? `<div class="insp-evos">${evs.map(e => `<div class="insp-evo${SB.has(e.key) ? ' known' : ''}"><i>✦</i>${esc(SB.evoText(e.key))}</div>`).join('')}</div>` : '';
  }
  function matsHtml(evoKey, R) {
    const e = (G.evolutions || []).find(x => x.key === evoKey); if (!e) return '';
    return `<div class="insp-mats">${e.requires.map((k, j) => { const u = G.upgrades[k] || {}, l = R && R.levels ? (R.levels[k] || 0) : -1;
      return (j ? '<i class="insp-plus">＋</i>' : '') + `<span class="insp-mat${l >= (u.max || 1) ? ' max' : ''}"><span class="insp-mic">${artHtml(k)}</span>${esc(u.name || k)}<em>${l < 0 ? 'MAX' : l >= (u.max || 1) ? 'MAX' : 'Lv.' + l + '/' + u.max}</em></span>`; }).join('')}</div>`;
  }
  /** opts for an upgrade / skill.
      mode 'run'  (pause menu): R.levels → now / next Lv / MAX, evolved-into, evolution hint
      mode 'card' (level-up / chest card): the level the card gives (o.next), 「Lv.a → b」
      mode 'book' (スキルブック): Lv.1 and MAX effects; o.locked → silhouette + 「？？？」 only */
  function skill(key, o) {
    o = o || {};
    const up = def(key) || { name: key }, cat = up.cat, max = up.max || 1, R = o.R;
    const color = cat === 'evo' || cat === 'bless' ? '#ffcf6b' : (G.EL[up.el] || {}).color || RCOL[up.rarity] || '#d3bc8e';
    const who = cat === 'char' && up.char && G.data.characters[up.char] ? G.data.characters[up.char].name + '専用' : CATN[cat] || (key[0] === '_' ? 'ボーナス' : '');
    if (o.locked) {
      return { html: artHtml(key), locked: true, title: Q, sub: o.sub || (cat === 'evo' ? '進化' : Q), color: '#8e9bbd', from: o.from,
        body: sec('', cat === 'evo' ? '進化条件：？？？<br><small>一度 進化すると わかる！</small>' : '？？？<br><small>冒険で手に入れると 登録されるよ</small>', 'lk') };
    }
    const sub = (o.sub || who) + (up.rarity ? ' ' + starsHtml(up.rarity) : '');
    const desc = lv => up.desc ? nl(up.desc(Math.max(1, lv))) : nl(up.short || '');
    let lvTxt = '', maxed = false, body = '';
    if (cat === 'evo') {
      lvTxt = o.mode === 'book' ? '進化' : '進化済み'; maxed = true;
      body = sec('効果', desc(1)) + sec('進化条件', matsHtml(key, o.mode === 'run' ? R : null) + '<small>すべてMAXにすると 宝箱から進化</small>', 'ev');
    } else if (cat === 'bless') {
      lvTxt = '★5 天啓'; maxed = true;
      body = sec('効果', desc(1));
    } else if (o.mode === 'card') {
      const nx = o.next || 1, was = nx - 1;
      lvTxt = key[0] === '_' ? '' : was <= 0 ? 'NEW!' : 'Lv.' + was + ' → ' + nx + (nx >= max ? ' MAX' : ''); maxed = nx >= max;
      body = sec(key[0] === '_' ? '効果' : 'Lv.' + nx + ' の効果', desc(nx));
      if (key[0] !== '_' && nx < max) body += sec('MAX（Lv.' + max + '）', desc(max), 'dim');
      if (R && key[0] !== '_') {
        const ev = G.upgradeHelpers && G.upgradeHelpers.evoAfterPick ? G.upgradeHelpers.evoAfterPick(R, key) : null;
        if (ev && ev.unlock) body += `<div class="insp-evos"><div class="insp-evo known"><i>★</i>進化解放！ →「${esc(ev.evo)}」</div></div>`;
        body += evoLinesHtml(key, R.charId, R);
      }
    } else if (o.mode === 'run' && R) {
      const lv = Math.min(max, R.levels[key] || 0); maxed = lv >= max;
      lvTxt = maxed ? 'Lv.' + lv + ' MAX' : 'Lv.' + lv + ' / MAX ' + max;
      body = sec('いまの効果', desc(lv));
      body += lv < max ? sec('次のLv.' + (lv + 1), desc(lv + 1), 'nx') : sec('MAX！', 'これ以上は強くならないよ', 'mx');
      if (o.evoKey && G.upgrades[o.evoKey]) { const eu = G.upgrades[o.evoKey]; body += sec('★ 進化済み「' + esc(eu.name) + '」', nl(eu.desc ? eu.desc(1) : eu.short), 'ev'); }
      else body += evoLinesHtml(key, R.charId, R);
    } else {   // book
      lvTxt = max > 1 ? '最大 Lv.' + max : '1回だけ';
      body = (up.short ? `<div class="insp-short">${esc(up.short)}</div>` : '') + sec(max > 1 ? 'Lv.1 の効果' : '効果', desc(1));
      if (max > 1) body += sec('MAX（Lv.' + max + '）', desc(max), 'dim');
      body += evoLinesHtml(key, up.char || o.charId);
    }
    return { html: artHtml(o.evoKey || key), title: up.name || key, sub, lv: lvTxt, lvMax: maxed, body, color, from: o.from };
  }

  /* ------------------------------------------------------------ viewer */
  function item(i) {
    const L = cur.list; let o = L[i];
    if (typeof o === 'function') { try { o = o(); } catch (e) { console.error('[inspect] item', e); o = null; } }
    return o || { title: Q };
  }
  function layout(o) {
    const W = innerWidth, H = innerHeight, col = W < H * 1.15;
    let s = col ? Math.min(H * 0.36, W * 0.62) : Math.min(H * 0.47, W * 0.34);
    s = Math.round(Math.max(90, s));
    let w = s, h = s;
    if (o.wide) { w = Math.round(Math.min(s * 1.62, col ? W * 0.86 : W * 0.44)); h = Math.round(w / 1.62); }
    return { col, s, w, h };
  }
  function build(o, L) {
    const locked = !!o.locked || !!o.dim;
    const sil = !!o.locked;
    const color = o.color || '#d3bc8e';
    const art = el('div', { class: 'insp-art' });
    if (o.img) art.append(el('img', { src: o.img, width: L.w, height: L.h, alt: '', draggable: 'false' }));
    else if (o.html) art.innerHTML = o.html;
    // every <img> gets explicit width/height attributes = the frame size (never the 256px natural size, even without CSS)
    art.querySelectorAll('img').forEach(im => { im.setAttribute('width', L.w); im.setAttribute('height', L.h); });
    const ic = el('div', { class: 'insp-ic' + (sil ? ' sil' : '') + (o.dim ? ' dim' : '') + (o.photo || o.wide ? ' photo' : '') + (o.wide ? ' wide' : ''), style: `width:${L.w}px;height:${L.h}px` },
      art, locked ? el('b', { class: 'insp-q', 'aria-hidden': 'true' }, '？') : null, o.badge ? el('span', { class: 'insp-badge', html: o.badge }) : null);
    const stage = el('div', { class: 'insp-stage', style: `width:${L.w}px;height:${L.h}px;--s:${Math.min(L.w, L.h)}px` }, el('i', { class: 'insp-glow', 'aria-hidden': 'true' }), ic);
    const txt = el('div', { class: 'insp-txt' },
      o.sub ? el('small', { class: 'insp-sub', html: o.sub }) : null,
      el('h3', { class: 'insp-title' }, o.title || Q),
      o.lv ? el('span', { class: 'insp-lv' + (o.lvMax ? ' max' : '') }, o.lv) : null,
      o.body ? el('div', { class: 'insp-body scroll', html: o.body }) : null);
    const card = el('div', { class: 'insp-card' + (L.col ? ' col' : '') + (locked ? ' locked' : ''), style: `--el:${color}` }, stage, txt);
    card.querySelectorAll('.insp-body img').forEach(im => { if (!im.getAttribute('width')) { im.setAttribute('width', 24); im.setAttribute('height', 24); } });
    return card;
  }
  function rectOf(n) {
    if (!n || !n.isConnected || !n.getBoundingClientRect) return null;
    const r = n.getBoundingClientRect();
    return r.width > 2 && r.height > 2 && r.bottom > 0 && r.right > 0 && r.left < innerWidth && r.top < innerHeight ? r : null;
  }
  function zoomFrom(stage, from, back) {
    const fr = rectOf(from), to = stage.getBoundingClientRect();
    if (!stage.animate) return null;
    const dur = reduced() ? 150 : back ? 200 : 360;
    let kf;
    if (fr && to.width) {
      const dx = fr.left + fr.width / 2 - (to.left + to.width / 2), dy = fr.top + fr.height / 2 - (to.top + to.height / 2);
      const k = Math.max(0.05, Math.min(1, Math.min(fr.width / to.width, fr.height / to.height)));
      kf = [{ transform: `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) scale(${k.toFixed(3)})`, opacity: back ? 0.2 : 0.4 }, { transform: 'none', opacity: 1 }];
    } else kf = [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }];
    if (back) kf.reverse();
    return stage.animate(kf, { duration: dur, easing: back ? 'cubic-bezier(.5,0,.9,.5)' : reduced() ? 'ease-out' : 'cubic-bezier(.2,1.25,.4,1)', fill: back ? 'forwards' : 'none' });
  }
  function render(dir) {
    const o = item(cur.i), L = layout(o);
    const wrap = cur.node.querySelector('.insp-wrap'), old = wrap.lastElementChild;
    const card = build(o, L);
    wrap.append(card);
    cur.node.setAttribute('aria-label', (o.title || Q) + ' を大きく表示');
    cur.item = o;
    if (o.from) cur.from = o.from; else if (dir) cur.from = null;
    const n = cur.list.length;
    cur.node.classList.toggle('multi', n > 1);
    const cnt = cur.node.querySelector('.insp-count b'); if (cnt) cnt.textContent = (cur.i + 1) + ' / ' + n;
    if (old) {
      if (old.animate && !reduced()) { const a = old.animate([{ transform: 'none', opacity: 1 }, { transform: `translateX(${-dir * 60}px)`, opacity: 0 }], { duration: 160, easing: 'ease-in', fill: 'forwards' }); a.onfinish = () => old.remove(); }
      else old.remove();
      if (card.animate) card.animate([{ transform: `translateX(${dir * 70}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: reduced() ? 120 : 240, easing: 'cubic-bezier(.2,1,.3,1)' });
    }
    return card;
  }
  function open(opts) {
    opts = opts || {};
    if (cur) close(true);
    const list = opts.list && opts.list.length ? opts.list : [opts];
    const i = Math.max(0, Math.min(list.length - 1, opts.list ? (opts.index | 0) : 0));
    const x = el('button', { class: 'insp-x', type: 'button', 'aria-label': '閉じる' }, '✕');
    const prev = el('button', { class: 'insp-nav prev', type: 'button', 'aria-label': '前へ' }, '‹');
    const next = el('button', { class: 'insp-nav next', type: 'button', 'aria-label': '次へ' }, '›');
    const node = el('div', { class: 'insp' + (reduced() ? ' low' : ''), role: 'dialog', 'aria-modal': 'true' },
      el('div', { class: 'insp-bg' }), el('div', { class: 'insp-wrap' }), x, prev, next,
      el('div', { class: 'insp-count' }, el('b', null, ''), el('span', null, G.input && G.input.touchMode ? '　スワイプで切りかえ' : '　← → で切りかえ')));
    cur = { node, list, i, from: opts.from || null, opener: document.activeElement, paused: false, t0: performance.now() };
    if (!cur.from && list[i] && typeof list[i] === 'object' && list[i].from) cur.from = list[i].from;
    document.body.append(node);
    const card = render(0);
    if (G.scene === 'run' && G.run && !G.run.over && G.game && G.game.pause) { G.game.pause('inspect'); cur.paused = true; }
    zoomFrom(card.querySelector('.insp-stage'), cur.from, false);
    sfx('ui'); try { G.input.haptic && G.input.haptic(8); } catch (e) { }
    x.addEventListener('click', e => { e.stopPropagation(); close(); });
    prev.addEventListener('click', e => { e.stopPropagation(); step(-1); });
    next.addEventListener('click', e => { e.stopPropagation(); step(1); });
    // outside tap closes; a horizontal swipe steps through the list (and is not a tap)
    let sx = 0, sy = 0, moved = false, down = false;
    node.addEventListener('pointerdown', e => { down = true; moved = false; sx = e.clientX; sy = e.clientY; });
    node.addEventListener('pointermove', e => { if (down && Math.hypot(e.clientX - sx, e.clientY - sy) > 12) moved = true; });
    node.addEventListener('pointerup', e => {
      if (!down) return; down = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (cur && cur.list.length > 1 && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) { moved = true; step(dx < 0 ? 1 : -1); }
    });
    node.addEventListener('pointercancel', () => { down = false; });
    node.addEventListener('click', e => {
      if (moved) { moved = false; return; }
      if (e.target.closest('.insp-stage, .insp-txt, button')) return;
      close();
    });
    requestAnimationFrame(() => { try { x.focus({ preventScroll: true }); } catch (_) { } });
    return api;
  }
  function step(d) {
    if (!cur || cur.list.length < 2) return;
    cur.i = (cur.i + d + cur.list.length) % cur.list.length;
    sfx('uiHover');
    render(d);
  }
  function close(instant) {
    if (!cur) return;
    const c = cur; cur = null;
    if (c.paused && G.run && G.game) G.game.resume('inspect');
    const card = c.node.querySelector('.insp-card:last-child');
    c.node.classList.add('out');
    const done = () => c.node.remove();
    if (instant || !card) done();
    else {
      const a = zoomFrom(card.querySelector('.insp-stage'), c.from, true);
      const t = card.querySelector('.insp-txt'); if (t && t.animate) t.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' });
      setTimeout(done, reduced() ? 160 : 220);
      if (!a) done();
    }
    if (!instant) sfx('uiHover');
    const o = c.opener;
    if (o && o.isConnected && o !== document.body) setTimeout(() => { try { o.focus({ preventScroll: true }); } catch (_) { } }, 30);
  }
  const isOpen = () => !!cur;

  /* keyboard — registered at load (before any other capture listener of the screens), so while the viewer is open
     nothing underneath (level-up 1〜4 keys, chest Enter, pause Esc, menu arrows) sees the key */
  addEventListener('keydown', e => {
    if (!cur) return;
    const k = e.key, c = e.code;
    if (k === 'ArrowLeft' || c === 'KeyA') step(-1);
    else if (k === 'ArrowRight' || c === 'KeyD') step(1);
    else if (k === 'Escape' || k === 'Backspace') { if (!e.repeat) close(); }
    else if (k === 'Tab') {
      const bs = [...cur.node.querySelectorAll('button')].filter(b => b.offsetParent !== null);
      let j = bs.indexOf(document.activeElement); j = (j + (e.shiftKey ? -1 : 1) + bs.length) % bs.length; bs[j] && bs[j].focus();
    } else if (k === 'Enter' || k === ' ') {
      const a = document.activeElement;
      if (a && a.tagName === 'BUTTON' && cur.node.contains(a)) { e.stopImmediatePropagation(); return; }   // native activation
      close();
    }
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  G.bus.on('scene', () => close(true));
  G.bus.on('saveReset', () => close(true));

  /* ------------------------------------------------------------ wiring helpers */
  let swallowNext = false;
  addEventListener('click', e => { if (swallowNext) { swallowNext = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  addEventListener('pointerup', () => { if (swallowNext) setTimeout(() => { swallowNext = false; }, 90); }, true);
  /** long-press (touch / pen, ~400 ms) and right-click open the viewer; the tap itself keeps its old meaning */
  function bindHold(node, fn) {
    if (!node || node._inspHold) return node; node._inspHold = true;
    let t = 0, x0 = 0, y0 = 0;
    const cancel = () => { if (t) clearTimeout(t); t = 0; node.classList.remove('insp-holding'); };
    node.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' || e.button > 0 || cur) return;
      cancel(); x0 = e.clientX; y0 = e.clientY; node.classList.add('insp-holding');
      t = setTimeout(() => { t = 0; node.classList.remove('insp-holding'); if (cur) return; swallowNext = true; try { G.input.haptic && G.input.haptic(14); } catch (_) { } fn(node); }, HOLD_MS);
    }, { passive: true });
    node.addEventListener('pointermove', e => { if (t && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) cancel(); }, { passive: true });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => node.addEventListener(ev, cancel, { passive: true }));
    node.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); const was = !!t; cancel(); if (cur) return; if (was) swallowNext = true; fn(node); });
    node.classList.add('insp-hold');
    return node;
  }
  /** plain tap / Enter opens the viewer (for things that had no tap action) */
  function bindTap(node, fn, label) {
    if (!node || node._inspTap) return node; node._inspTap = true;
    node.classList.add('insp-tap');
    if (!node.hasAttribute('tabindex') && node.tagName !== 'BUTTON') node.tabIndex = 0;
    if (!node.hasAttribute('role') && node.tagName !== 'BUTTON') node.setAttribute('role', 'button');
    if (label && !node.hasAttribute('aria-label')) node.setAttribute('aria-label', label);
    node.addEventListener('click', e => { e.stopPropagation(); fn(node); });
    node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); fn(node); } });
    return node;
  }
  /** a small magnifier button (span, so it can live inside a <button> card); its tap never reaches the card */
  function lens(parent, fn, cls) {
    const b = el('span', { class: 'insp-lens ' + (cls || ''), role: 'button', 'aria-label': '大きく見る', title: '大きく見る', html: SVG_LENS });
    b.addEventListener('pointerdown', e => e.stopPropagation());
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); fn(b); });
    b.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); });
    if (parent) parent.append(b);
    return b;
  }

  const api = { open, close, step, isOpen, skill, sec, bindHold, bindTap, lens, artHtml, esc, nl, Q, get index() { return cur ? cur.i : -1; } };
  return api;
})();
G.ui.inspect = G.inspect.open;
