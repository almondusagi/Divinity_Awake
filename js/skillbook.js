/* skillbook.js — スキルブック (owner: UI). Replaces the old 図鑑 (codex).
   Every skill / ability in the game starts as a black silhouette with 「？？？」. Getting it in a real run registers it
   (name, icon and effect become visible). An evolution's recipe is only revealed after that evolution was achieved once.
   Save: G.save.data.book = { key: timestamp }   (registered; an evo key here = that evolution was achieved)
         G.save.data.bookNew = { key: 1 }       (NEW badges, cleared when the book is viewed)
   Old saves: G.save.data.codex (evolutions / ★5 blessings found) is carried over as registered.
   Other files read: G.skillbook.has(key) / evoLabel(evoKey) / evoText(evoKey) (upgrades.js, levelup.js, progression.js). */
'use strict';
G.skillbook = (function () {
  const el = G.ui.el;
  const Q = '？？？';
  const S = () => G.save.data;
  function book() { const s = S(); if (!s.book || typeof s.book !== 'object') s.book = {}; return s.book; }
  function fresh() { const s = S(); if (!s.bookNew || typeof s.bookNew !== 'object') s.bookNew = {}; return s.bookNew; }
  const write = () => { try { G.save.write(); } catch (e) { } };
  const U = k => G.upgrades[k];

  /* ---------------- catalogue ---------------- */
  /** sections: [{id, title, sub, icon, locked, keys[]}] — everything a player can ever get */
  function sections() {
    const out = [], all = G.upgrades;
    const roster = G.data.roster || Object.keys(G.data.characters);
    for (const id of roster) {
      const c = G.data.characters[id]; if (!c) continue;
      const keys = Object.keys(all).filter(k => all[k].cat === 'char' && all[k].char === id);
      if (!keys.length) continue;
      const hidden = G.unlocks ? G.unlocks.charState(id) !== 'open' : false;
      out.push({ id: 'char_' + id, title: hidden ? Q : c.name, sub: hidden ? '' : '専用スキル', icon: 'assets/icon_' + (c.portrait || id) + '.webp', locked: hidden, keys });
    }
    out.push({ id: 'launcher', title: 'ランチャー', sub: 'ティマイオスの発明', keys: Object.keys(all).filter(k => all[k].cat === 'launcher') });
    out.push({ id: 'stat', title: '汎用ステータス', sub: 'だれでも使える', keys: Object.keys(all).filter(k => all[k].cat === 'stat') });
    out.push({ id: 'bless', title: '★5 天啓', sub: 'レベルアップでまれに出る', keys: (G.blessings || []).filter(k => all[k]) });
    out.push({ id: 'evo', title: '進化', sub: '素材をすべてMAXにすると 宝箱から', keys: (G.evolutions || []).map(e => e.key).filter(k => all[k]) });
    return out;
  }
  function allKeys() { const o = []; sections().forEach(s => o.push(...s.keys)); return o; }
  let keySet = null;
  const known = k => { if (!keySet) keySet = new Set(allKeys()); return keySet.has(k); };

  /* ---------------- state ---------------- */
  const has = k => !!book()[k];
  const isNew = k => !!fresh()[k];
  const count = () => allKeys().filter(has).length;
  const total = () => allKeys().length;
  const newCount = () => Object.keys(fresh()).filter(k => known(k) && has(k)).length;
  /** evolution name, or 「？？？」 until that evolution was achieved once */
  function evoLabel(evoKey) { const u = U(evoKey); return u && has(evoKey) ? u.name : Q; }
  /** the one sentence every evolution hint uses */
  function evoText(evoKey) { return '条件を満たすと「' + evoLabel(evoKey) + '」へ進化可能'; }
  /** evolutions that use `key` as a material (optionally only those this character can get) */
  function evosOf(key, charId) {
    return (G.evolutions || []).filter(e => e.requires.indexOf(key) >= 0 && (!charId || !U(e.key).char || U(e.key).char === charId));
  }

  /* ---------------- registering ---------------- */
  const queue = [];
  function mark(key, o) {
    o = o || {};
    if (!key || !known(key) || has(key)) return false;
    book()[key] = Date.now(); fresh()[key] = 1; write();
    if (!o.silent) { queue.push(key); flushSoon(); }
    G.bus.emit('skillbook', { key });
    return true;
  }
  G.bus.on('upgrade', e => { if (e && e.key && e.key[0] !== '_') mark(e.key); });
  G.bus.on('evolution', e => { if (e && e.key) mark(e.key); });

  /* 「スキルブックに登録！」 — small toasts, held back while a level-up / chest / menu is open (no spoilers) */
  let box = null, flushT = 0;
  function canShow() { const R = G.run; return !(G.scene === 'run' && R && !R.over && (R.pauses && R.pauses.size)); }
  function flushSoon() { if (!flushT) flushT = setTimeout(flush, 260); }
  function flush() {
    flushT = 0; if (!queue.length) return;
    if (!canShow()) { flushT = setTimeout(flush, 300); return; }
    if (!box || !box.isConnected) { box = el('div', { class: 'sb-toasts', 'aria-live': 'polite' }); document.body.append(box); }
    const key = queue.shift(), u = U(key); if (!u) return flushSoon();
    const t = el('div', { class: 'sb-toast' + (u.cat === 'evo' || u.cat === 'bless' ? ' gold' : '') },
      el('span', { class: 'sb-tic', html: artHtml(key) }), el('span', { class: 'sb-tt' }, el('small', null, 'スキルブックに登録！'), el('b', null, u.name)));
    box.append(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 2400);
    if (queue.length) flushT = setTimeout(flush, 420);
  }
  function artHtml(key) {
    try { if (G.progressionUI && G.progressionUI.art) { G.progressionUI.ensureCss && G.progressionUI.ensureCss(); return G.progressionUI.art(key); } } catch (e) { }
    return '<div class="pg-art"><img src="assets/icon_' + ((U(key) || {}).icon || 'relic') + '.webp" alt=""></div>';
  }

  /* ---------------- save upkeep ---------------- */
  function migrate() {
    const s = S(), b = book(); fresh();
    if (s.codex && typeof s.codex === 'object') for (const k in s.codex) if (s.codex[k] && !b[k] && G.upgrades[k]) b[k] = +s.codex[k] || Date.now();
  }
  G.bus.on('assetsReady', () => { try { migrate(); write(); } catch (e) { console.error('[skillbook] migrate', e); } });
  G.bus.on('saveReset', () => { queue.length = 0; });
  /** debug: register everything / clear everything */
  function setAll(on) {
    const s = S();
    if (on) { const b = book(); for (const k of allKeys()) if (!b[k]) { b[k] = Date.now(); } }
    else { s.book = {}; s.bookNew = {}; s.codex = {}; s.codexNew = 0; }
    write(); G.bus.emit('skillbook', { all: on });
  }
  function seenAll() { const s = S(); s.bookNew = {}; s.codexNew = 0; write(); }

  /* ---------------- view ---------------- */
  const plain = t => String(t || '').replace(/<[^>]+>/g, '');
  function icon(key, sil) { return el('div', { class: 'sb-ic' + (sil ? ' sil' : ''), html: artHtml(key) }); }
  function evoLines(key, charId) {
    return evosOf(key, charId).map(e => el('div', { class: 'sb-evo' + (has(e.key) ? ' known' : '') }, el('i', null, '✦'), evoText(e.key)));
  }
  function card(key, i, charId) {
    const u = U(key), got = has(key), nw = got && isNew(key), evo = u.cat === 'evo';
    const elc = (G.EL[u.el] || {}).color || '#ffcf6b';
    const c = el('div', { class: 'sb-card' + (got ? ' got' : '') + (evo ? ' evo' : '') + (u.cat === 'bless' ? ' bless' : ''), 'data-key': key, style: `--d:${Math.min(0.6, 0.02 * i).toFixed(2)}s;--el:${elc}` });
    c.append(icon(key, !got));
    const t = el('div', { class: 'sb-t' });
    if (!got) {
      t.append(el('b', { class: 'sb-nm' }, Q), el('small', { class: 'sb-d' }, evo ? '進化条件：' + Q : Q));
    } else if (evo) {
      const e = (G.evolutions || []).find(x => x.key === key);
      const who = u.char && G.data.characters[u.char] ? G.data.characters[u.char].name : '';
      t.append(el('b', { class: 'sb-nm' }, u.name, who ? el('em', null, who) : null),
        el('small', { class: 'sb-d' }, plain(u.desc && u.desc(1)).replace(/\n/g, ' ')),
        el('div', { class: 'sb-rc' }, el('span', { class: 'sb-rl' }, '進化条件'), e.requires.reduce((o, k, j) => { if (j) o.push(el('i', null, '＋'));
          o.push(el('span', { class: 'sb-mat' }, el('span', { class: 'sb-mic', html: artHtml(k) }), U(k).name, el('em', null, 'MAX'))); return o; }, [])));
    } else {
      const lv1 = u.desc ? plain(u.desc(1)) : '';
      t.append(el('b', { class: 'sb-nm' }, u.name, el('em', null, u.max > 1 ? '最大 Lv.' + u.max : '1回だけ')),
        u.short ? el('span', { class: 'sb-sh' }, u.short) : null,
        el('small', { class: 'sb-d' }, lv1.replace(/\n/g, ' ')),
        ...evoLines(key, u.char || charId));
    }
    c.append(t);
    if (nw) c.append(el('span', { class: 'sb-new' }, 'NEW'));
    return c;
  }
  /** renders the whole book into `container`. opts.charId: show evolution lines for that character first (pause menu) */
  function render(container, opts) {
    opts = opts || {};
    G.progressionUI && G.progressionUI.ensureCss && G.progressionUI.ensureCss();
    const have = count(), all = total(), pct = all ? Math.round(have / all * 100) : 0;
    const secs = sections();
    const wrap = el('div', { class: 'sb' },
      el('div', { class: 'sb-head' }, el('h4', null, 'スキルブック'),
        el('div', { class: 'sb-prog' }, el('i', { style: `width:${pct}%` })), el('b', null, '登録 ', el('span', null, String(have)), ' / ' + all)),
      el('p', { class: 'sb-tip' }, '冒険で手に入れたスキルが 登録されるよ。進化の条件は、一度 進化すると わかる！'),
      el('div', { class: 'sb-jump' }, secs.map(s => {
        const n = s.keys.filter(has).length;
        const b = el('button', { class: 'sb-chip' + (s.locked ? ' locked' : ''), type: 'button' }, s.icon ? el('img', { src: s.icon, alt: '' }) : null, s.title, el('small', null, n + '/' + s.keys.length));
        b.addEventListener('click', () => { const h = wrap.querySelector('[data-sec="' + s.id + '"]'); if (h) h.scrollIntoView({ block: 'start', behavior: 'smooth' }); try { G.audio.sfx('ui'); } catch (e) { } });
        return b;
      })));
    let i = 0;
    for (const s of secs) {
      const n = s.keys.filter(has).length;
      wrap.append(el('h5', { class: 'sb-sec' + (s.locked ? ' locked' : ''), 'data-sec': s.id },
        s.icon ? el('img', { src: s.icon, alt: '' }) : null, el('span', null, s.title), s.sub ? el('small', null, s.sub) : null, el('em', null, n + ' / ' + s.keys.length)));
      const charId = s.id.indexOf('char_') === 0 ? s.id.slice(5) : opts.charId;
      wrap.append(el('div', { class: 'sb-grid' }, s.keys.map(k => card(k, i++, charId))));
    }
    container.append(wrap);
    seenAll();   // NEW badges stay visible in this view, gone next time
    return wrap;
  }

  return { has, isNew, mark, count, total, newCount, evoLabel, evoText, evosOf, sections, allKeys, render, setAll, migrate, seenAll, Q };
})();
