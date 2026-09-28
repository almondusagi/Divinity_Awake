/* data.js — static game data: characters, enemies, stage timeline, permanent (mora) upgrades.
   Ported from the Luanti version (config.lua / sekaikan.md). Numbers are re-scaled to Genshin-like
   damage (hundreds/thousands) so numbers feel big. Balance owners may retune freely. */
'use strict';
G.data = {};

/* ---------------- characters ---------------- */
G.data.characters = {
  amber: {
    id: 'amber', name: 'アンバー', title: '偵察騎士', element: 'pyro', weapon: '弓', atlas: 'amber', portrait: 'amber',
    implemented: true,
    hp: 1000, atk: 100, def: 0, speed: 4.1, pickup: 2.2,
    // un-upgraded normal attack is deliberately clumsy (slow bow, short auto-aim); home upgrades fix it (balance v5)
    atkInterval: 1.2, range: 8.5, chargedPeriod: 6.0,
    energyCost: 40, skillCd: 18, burstCd: 12,
    skillName: 'ウサギ伯爵', burstName: '矢の雨', normalName: '炎の矢',
    passive: '爆発範囲 常時×2（固有天賦）',
    blurb: 'モンド唯一の偵察騎士。炎の矢と爆発で群れを焼き払う。',
  },
  xingqiu: {
    id: 'xingqiu', name: '行秋', title: '古華派の剣士', element: 'hydro', weapon: '片手剣', atlas: 'xingqiu', portrait: 'xingqiu',
    implemented: true, // 4-direction sheet: assets/actor_xingqiu.webp (owner pack)
    hp: 1150, atk: 100, def: 10, speed: 4.2, pickup: 2.2,
    // melee: swords orbit around him. atkInterval = rest time between spins (long at first; 雷鳥の羽 shortens it)
    atkInterval: 2.4, range: 8.5,
    energyCost: 50, skillCd: 14, burstCd: 15,
    skillName: '古華剣・画雨籠山', burstName: '古華剣・裁雨留虹', normalName: '古華剣法・流水の舞',
    skillIcon: 'xq_skill', burstIcon: 'xq_burst', normalIcon: 'xq_blades',
    passive: '雨すだれの剣が消えると HP 6% 回復（虹剣勢）',
    kit: [
      ['xq_blades', '通常攻撃', '古華剣法・流水の舞', '剣が まわりをクルクル回る。敵に近づいて当てよう！（威力はアンバーの矢の2倍）'],
      ['xq_skill', '元素スキル　F / 右下ボタン', '古華剣・画雨籠山', '前へ水の2連斬り＋「雨すだれの剣」で受けるダメージDOWN。'],
      ['xq_burst', '元素爆発　Q / 右下ボタン', '古華剣・裁雨留虹', '向いている方向へ 雨の剣が降りそそぐ「五月雨斬り」！'],
      ['xq_blade', '固有天賦', '虹剣勢', '雨すだれの剣が消えると HPを6%回復する。'],
    ],
    blurb: '飛雲商会の次男坊。水の剣を回して群れに斬りこむ。',
  },
  ningguang: {
    id: 'ningguang', name: '凝光', title: '天権星', element: 'geo', weapon: '法器', portrait: 'ningguang', atlas: 'ningguang',
    implemented: true, // kit: js/ningguang.js (owner: NINGGUANG)
    unlock: { stage: 'mondstadt', mora: 50000 }, // UI: G.unlocks (silhouette until the stage is cleared, then buy)
    hp: 950, atk: 100, def: 5, speed: 4.0, pickup: 2.2,
    // normal: a volley of homing gold pebbles (7 at first, 25% ATK each = 1/4 of Amber's lv0 arrow) every atkInterval s
    atkInterval: 1.1, range: 9,
    energyCost: 40, skillCd: 12, burstCd: 12,
    skillName: '璇璣屏', burstName: '天権崩玉', normalName: '千金の石粒',
    skillIcon: 'ng_skill', burstIcon: 'ng_burst', normalIcon: 'ng_gems',
    passive: '屏風を通った石粒は 威力+30%',
    kit: [
      ['ng_gems', '通常攻撃', '千金の石粒', '黄色い石粒が 近くの敵へ 自動で飛んでいく！ 強化で粒がどんどん増える。'],
      ['ng_skill', '元素スキル　F / 右下ボタン', '璇璣屏', '前に岩の屏風を立てる（10秒）。敵も 敵の弾も 通れない！'],
      ['ng_burst', '元素爆発　Q / 右下ボタン', '天権崩玉', 'ぜんぶの石粒が 大きくなって 前へ一斉発射！ 威力10倍・貫通！'],
      ['ng_gem', '固有天賦', '屏風の加護', '璇璣屏を通りぬけた石粒は 威力+30%。'],
    ],
    blurb: '璃月七星の天権。宝石の雨で 群れを撃ちぬく。',
  },
  chongyun: {
    id: 'chongyun', name: '重雲', title: '方士の少年', element: 'cryo', weapon: '両手剣', portrait: 'chongyun', atlas: 'chongyun',
    implemented: true, // kit: js/chongyun.js (owner: CHONGYUN)
    unlock: { stage: 'mondstadt', mora: 50000 }, // UI: G.unlocks (silhouette until the stage is cleared, then buy)
    hp: 1150, atk: 100, def: 15, speed: 3.95, pickup: 2.2,
    // melee: heavy greatsword sweeps. atkInterval = rest between swing chains (slow at first; 攻撃速度・霜の領域 shorten it)
    atkInterval: 1.7, range: 8.5,
    energyCost: 40, skillCd: 15, burstCd: 12,
    skillName: '霊刃・重華積霜', burstName: '霊刃・雲開星落', normalName: '滅邪四式',
    skillIcon: 'cy_skill', burstIcon: 'cy_burst', normalIcon: 'cy_sword',
    passive: '霜の領域が消えると 霊刃が落ちてくる（追氷剣）',
    kit: [
      ['cy_sword', '通常攻撃', '滅邪四式', '大剣で ドーンと薙ぎ払う！ 広い・重い・ふっとばす。止まると近くの敵に向く。'],
      ['cy_skill', '元素スキル　F / 右下ボタン', '霊刃・重華積霜', '地面をたたいて氷の衝撃＋「霜の領域」。中にいると攻撃が速く・氷元素に！'],
      ['cy_burst', '元素爆発　Q / 右下ボタン', '霊刃・雲開星落', '空から 巨大な霊刃が3本、敵の群れに つぎつぎ落ちてくる！'],
      ['cy_arc', '固有天賦', '追氷剣', '霜の領域が消えると、まん中に霊刃が落ちて 氷ダメージ。'],
    ],
    blurb: '純陽の体をもつ方士。大剣と氷の霊刃で 妖魔をはらう。',
  },
};
G.data.roster = ['amber', 'xingqiu', 'ningguang', 'chongyun'];

/* ---------------- enemies ----------------
   atlas: sprite sheet, h: drawn height (world units), r: collision radius, hp at 0:00 (scaled by stage growth),
   speed (units/s), dmg (contact / attack damage at 0:00; attacks use multiples of it), xp (energy particle value)
   ai: behaviour in G.enemyAI. burst (hopper): elemental discharge {r, color, hue, cd:[min,max]} */
G.data.enemies = {
  mote:    { name: '棍棒ヒルチャール', atlas: 'hilichurl', h: 2.0, r: 0.42, hp: 160,   speed: 1.55, dmg: 40, xp: 2, ai: 'melee', element: null },
  swift:   { name: '風スライム',       atlas: 'slime', filter: 'hue-rotate(-70deg) saturate(1.2)', h: 1.3, r: 0.35, hp: 95, speed: 2.9, dmg: 30, xp: 1, ai: 'hopper', element: 'anemo', hopT: 0.38, hopH: 0.7 },
  swarm:   { name: '水スライム',       atlas: 'slime', h: 1.05, r: 0.3, hp: 85, speed: 2.2, dmg: 25, xp: 1, ai: 'hopper', element: 'hydro' },
  volt:    { name: '雷スライム',       atlas: 'slime', filter: 'hue-rotate(60deg) saturate(1.6) brightness(1.05)', h: 1.3, r: 0.36, hp: 190, speed: 2.0, dmg: 35, xp: 2, ai: 'hopper', element: 'electro',
             burst: { r: 1.9, color: '#d59bff', hue: '#6a1fb0', cd: [4, 6] } },
  frost:   { name: '氷スライム',       atlas: 'slime', filter: 'hue-rotate(-25deg) saturate(0.45) brightness(1.45)', h: 1.3, r: 0.36, hp: 220, speed: 1.9, dmg: 38, xp: 2, ai: 'hopper', element: 'cryo',
             burst: { r: 2.1, color: '#9ff0ff', hue: '#1f6a8a', cd: [4.5, 6.5] } },
  shell:   { name: '大型岩スライム',   atlas: 'slime', filter: 'hue-rotate(-160deg) saturate(1.4) brightness(1.05)', h: 2.3, r: 0.7, hp: 720, speed: 1.0, dmg: 70, xp: 5, ai: 'hopper', element: 'geo', hopT: 0.6, hopH: 0.8,
             crush: { r: 2.2, cd: [5, 7.5] } },
  spitter: { name: '弓ヒルチャール',   atlas: 'archer', h: 2.0, r: 0.42, hp: 260, speed: 1.2, dmg: 45, xp: 3, ai: 'archer', element: null },
  charger: { name: '突撃ヒルチャール', atlas: 'hilichurl', filter: 'sepia(0.5) hue-rotate(-25deg) saturate(1.8)', h: 2.15, r: 0.46, hp: 440, speed: 1.6, dmg: 75, xp: 4, ai: 'charger', element: null },
  binder:  { name: 'ヒルチャール・シャーマン', atlas: 'shaman', h: 2.1, r: 0.44, hp: 500, speed: 1.0, dmg: 35, xp: 5, ai: 'shaman', element: 'hydro' },
  shielder:{ name: '盾ヒルチャール',   atlas: 'brute', filter: 'saturate(0.8) brightness(1.1)', h: 2.4, r: 0.55, hp: 880, speed: 1.1, dmg: 60, xp: 6, ai: 'rockthrower', element: 'geo' },
  elite:   { name: 'ヒルチャール暴徒', atlas: 'brute', h: 3.3, r: 0.85, hp: 3600, speed: 1.35, dmg: 120, xp: 15, ai: 'brute', element: null, elite: true },
  ruin:    { name: '遺跡守衛',         atlas: 'ruin', h: 5.2, r: 1.5, hp: 60000, speed: 0.9, dmg: 160, xp: 60, ai: 'ruin', element: null, boss: true, bossTitle: '古代の機械' },
  venti:   { name: 'ウェンティ',       atlas: 'venti', h: 2.7, r: 0.6, hp: 420000, speed: 1.4, dmg: 150, xp: 100, ai: 'venti', element: 'anemo', boss: true, final: true, bossTitle: '風神', icon: 'venti' },

  /* ---- v5 stages (owner: STAGE). Normal/elite HP & damage are further multiplied by the stage's `mul` (enemies.spawn);
         mid-bosses and gods carry their own numbers. ---- */
  // 璃月 (geo)
  geoslime:  { name: '岩スライム',     atlas: 'slime', filter: 'hue-rotate(-160deg) saturate(1.3) brightness(1.08)', h: 1.3, r: 0.36, hp: 200, speed: 1.9, dmg: 38, xp: 2, ai: 'hopper', element: 'geo', hopT: 0.5, hopH: 0.6 },
  geoshaman: { name: '岩のシャーマン', atlas: 'shaman', filter: 'sepia(0.85) saturate(2.2) hue-rotate(-18deg)', h: 2.1, r: 0.44, hp: 520, speed: 1.0, dmg: 38, xp: 5, ai: 'shaman', element: 'geo', orbColor: '#ffd24a' },
  geobrute:  { name: '岩兜の暴徒',     atlas: 'brute', filter: 'sepia(0.7) saturate(1.8) hue-rotate(-8deg) brightness(1.05)', h: 3.4, r: 0.88, hp: 3900, speed: 1.3, dmg: 125, xp: 16, ai: 'brute', element: 'geo', elite: true },
  ruin_geo:  { name: '遺跡重機',       atlas: 'ruin', filter: 'sepia(0.55) saturate(1.6) hue-rotate(-12deg)', h: 5.4, r: 1.55, hp: 130000, speed: 0.9, dmg: 170, xp: 70, ai: 'ruin', element: 'geo', boss: true, bossTitle: '岩の古代機械', aura: '#ffd24a' },
  zhongli:   { name: '鍾離',           atlas: 'zhongli', h: 2.8, r: 0.62, hp: 1000000, speed: 1.2, dmg: 180, xp: 120, ai: 'zhongli', element: 'geo', boss: true, final: true, bossTitle: '岩神', icon: 'zhongli' },
  // 稲妻 (electro)
  voltbig:   { name: '大型雷スライム', atlas: 'slime', filter: 'hue-rotate(60deg) saturate(1.7) brightness(1.02)', h: 2.3, r: 0.7, hp: 760, speed: 1.0, dmg: 72, xp: 5, ai: 'hopper', element: 'electro', hopT: 0.6, hopH: 0.8,
               crush: { r: 2.2, cd: [5.5, 8] }, burst: { r: 2.6, color: '#d59bff', hue: '#6a1fb0', cd: [5, 7] } },
  voltchurl: { name: '雷の突撃ヒルチャール', atlas: 'hilichurl', filter: 'hue-rotate(230deg) saturate(1.7) brightness(0.95)', h: 2.15, r: 0.46, hp: 460, speed: 1.7, dmg: 78, xp: 4, ai: 'charger', element: 'electro' },
  voltarcher:{ name: '雷弓ヒルチャール', atlas: 'archer', filter: 'hue-rotate(240deg) saturate(1.5)', h: 2.0, r: 0.42, hp: 280, speed: 1.25, dmg: 48, xp: 3, ai: 'archer', element: 'electro' },
  voltbrute: { name: '雷兜の暴徒',     atlas: 'brute', filter: 'hue-rotate(250deg) saturate(1.6) brightness(0.92)', h: 3.4, r: 0.88, hp: 4000, speed: 1.4, dmg: 130, xp: 16, ai: 'brute', element: 'electro', elite: true },
  ruin_electro: { name: '雷音の遺跡守衛', atlas: 'ruin', filter: 'hue-rotate(235deg) saturate(1.5) brightness(0.95)', h: 5.4, r: 1.55, hp: 270000, speed: 1.0, dmg: 200, xp: 80, ai: 'ruin', element: 'electro', boss: true, bossTitle: '雷の古代機械', aura: '#c77dff' },
  raiden:    { name: '雷電将軍',       atlas: 'raiden', h: 2.8, r: 0.6, hp: 2100000, speed: 1.5, dmg: 220, xp: 140, ai: 'raiden', element: 'electro', boss: true, final: true, bossTitle: '雷神', icon: 'raiden' },
  // スメール (dendro)
  dendroslime: { name: '草スライム',   atlas: 'slime', filter: 'hue-rotate(-105deg) saturate(1.5) brightness(1.02)', h: 1.3, r: 0.36, hp: 210, speed: 2.0, dmg: 38, xp: 2, ai: 'hopper', element: 'dendro', hopT: 0.42, hopH: 0.65 },
  dendrobig: { name: '大型草スライム', atlas: 'slime', filter: 'hue-rotate(-105deg) saturate(1.6) brightness(0.95)', h: 2.3, r: 0.7, hp: 780, speed: 1.0, dmg: 72, xp: 5, ai: 'hopper', element: 'dendro', hopT: 0.6, hopH: 0.8,
               crush: { r: 2.3, cd: [5, 7.5] } },
  dendroshaman: { name: '草のシャーマン', atlas: 'shaman', filter: 'hue-rotate(75deg) saturate(1.3)', h: 2.1, r: 0.44, hp: 540, speed: 1.0, dmg: 38, xp: 5, ai: 'shaman', element: 'dendro', orbColor: '#8fd13a' },
  dendrobrute: { name: '草冠の暴徒',   atlas: 'brute', filter: 'hue-rotate(70deg) saturate(1.3) brightness(0.95)', h: 3.4, r: 0.88, hp: 4100, speed: 1.4, dmg: 135, xp: 16, ai: 'brute', element: 'dendro', elite: true },
  ruin_dendro: { name: '樹海の遺跡守衛', atlas: 'ruin', filter: 'hue-rotate(75deg) saturate(1.3) brightness(0.95)', h: 5.4, r: 1.55, hp: 540000, speed: 1.0, dmg: 230, xp: 90, ai: 'ruin', element: 'dendro', boss: true, bossTitle: '森の古代機械', aura: '#8fd13a' },
  nahida:    { name: 'ナヒーダ',       atlas: 'nahida', h: 2.5, r: 0.55, hp: 4200000, speed: 1.4, dmg: 260, xp: 160, ai: 'nahida', element: 'dendro', boss: true, final: true, bossTitle: '草神', icon: 'nahida' },
  nahida_clone: { name: 'ナヒーダの幻影', atlas: 'nahida', filter: 'saturate(0.5) brightness(1.35) opacity(0.62)', h: 2.5, r: 0.5, hp: 60000, speed: 1.6, dmg: 150, xp: 0, ai: 'nahidaClone', element: 'dendro', noStageMul: true, clone: true },
};

/* ---------------- stage: Mondstadt (10 min) ----------------
   growth: [time, hpMul, dmgMul]  (interpolated)
   waves:  [time, spawnsPerSecond, maxAlive]   (≤230 alive)
   mixes:  [time, {kind: weight}]
   champion: [time, chance] a normal spawn becomes a golden-outlined champion (HP×4)
   events: scripted spawns — mini-boss every minute (精巧な宝箱), Ruin Guard at 5:00, Venti at 10:00.
           surge events: {surge:'ring'|'arc'|'wall', kinds:[…], count, radius, notice, rows, span, marchT, golden}
             (wiping a surge quickly → 群れボーナス chest; big surges carry one golden champion)
           treasure events: {treasure:true, reward, escape (s)} a fleeing gold hilichurl carrying a chest */
G.data.stages = {
  mondstadt: {
    id: 'mondstadt', name: 'モンドの風跡', sub: '星落ちの湖〜風立ちの地', duration: 600,
    order: 1, region: 'モンド', element: 'anemo', bg: 'title_bg', bgSmall: 'title_bg', floor: 'floor', boss: 'venti', bossName: 'ウェンティ',
    blurb: '風と自由の国。ヒルチャールとスライムの群れを ぬけて、風神に 挑め！', color: '#5cf2c8', requires: null,
    mul: { hp: 1, dmg: 1, speed: 1, rate: 1, cap: 1 }, midBoss: 'ruin', elite: 'elite',
    growth: [[0, 1, 0.8], [60, 1.25, 0.88], [120, 2.0, 1.0], [180, 3.0, 1.18], [240, 4.2, 1.4], [300, 5.6, 1.68], [360, 7.2, 1.88], [420, 9.2, 2.08], [480, 11.6, 2.3], [540, 14.4, 2.52], [600, 18, 2.75]],
    // balance v5: these are the rates for an UN-UPGRADED save (a slow start — Amber must kite). The spawner multiplies
    // rate/cap by the save's home-upgrade progress (G.spawner.powerK 0..1: rate ×(1+2.4k), cap ×(1+1.3k), ≤232 alive),
    // so a maxed save gets the old screen-filling horde (≈ ×3.4 / ×2.3).
    waves: [[0, 0.8, 12], [30, 1.0, 16], [60, 1.3, 20], [90, 1.6, 26], [120, 1.9, 32], [180, 2.4, 42], [240, 3.0, 54], [300, 3.5, 66], [360, 4.2, 80], [480, 5.2, 100], [540, 5.8, 112]],
    champion: [[0, 0], [230, 0], [240, 0.015], [540, 0.04]],
    mixes: [
      [0, { mote: 70, swarm: 30 }],
      [40, { mote: 55, swarm: 25, swift: 20 }],
      [85, { mote: 50, swarm: 20, swift: 16, spitter: 14 }],
      [140, { mote: 40, swarm: 12, swift: 13, spitter: 15, charger: 15, shielder: 5 }],
      [200, { mote: 34, swarm: 10, swift: 10, spitter: 14, charger: 14, shell: 8, shielder: 6, volt: 3 }],
      [270, { mote: 30, swarm: 10, swift: 8, spitter: 14, charger: 14, shell: 8, shielder: 8, volt: 4, binder: 4 }],
      [330, { mote: 28, swarm: 8, swift: 8, spitter: 14, charger: 14, shell: 9, shielder: 9, volt: 6, frost: 6, binder: 6 }],
      [450, { mote: 24, swarm: 6, swift: 8, spitter: 15, charger: 15, shell: 10, shielder: 10, volt: 7, frost: 7, binder: 8 }],
    ],
    events: [
      { time: 15, surge: 'arc', kinds: ['mote', 'swarm', 'swarm'], count: 9, radius: 11, notice: 'ヒルチャールが来た！', color: '#ffb347', golden: false },
      { time: 60, kind: 'elite', hpMul: 0.4, dmgMul: 0.55, reward: 'common', banner: 'ヒルチャール暴徒 出現！' },
      { time: 95, treasure: true, reward: 'common', escape: 22 },
      { time: 105, surge: 'wall', kinds: ['swarm', 'swarm', 'swift'], count: 24, rows: 2, radius: 13, span: 28, marchT: 7, notice: 'スライムの津波だ！', color: '#7fd6ff' },
      { time: 120, kind: 'elite', hpMul: 0.6, dmgMul: 0.7, reward: 'exquisite', banner: 'ヒルチャール暴徒 出現！' },
      { time: 150, surge: 'ring', kinds: ['swarm', 'swarm', 'swift'], count: 24, radius: 10, notice: 'スライムの大群にかこまれた！', color: '#7fd6ff' },
      { time: 180, kind: 'elite', hpMul: 1.0, dmgMul: 0.9, reward: 'exquisite', banner: 'ヒルチャール暴徒 出現！' },
      { time: 215, treasure: true, reward: 'exquisite', escape: 20 },
      { time: 240, kind: 'elite', hpMul: 1.2, reward: 'exquisite', banner: 'ヒルチャール暴徒の群れ！', count: 2 },
      { time: 270, surge: 'arc', kinds: ['mote', 'mote', 'charger', 'shielder'], count: 26, radius: 13, notice: 'ヒルチャールの行進だ！', color: '#ffb347' },
      { time: 300, kind: 'ruin', hpMul: 1, reward: 'precious', relic: true, banner: '遺跡守衛 起動', boss: true },
      { time: 340, treasure: true, reward: 'exquisite', escape: 20 },
      { time: 360, kind: 'elite', hpMul: 1.4, reward: 'exquisite', banner: 'ヒルチャール暴徒 出現！' },
      { time: 390, surge: 'ring', kinds: ['swarm', 'swift', 'volt', 'mote', 'mote'], count: 44, radius: 10.5, notice: '大包囲！ すき間をぬけろ！', color: '#ff7a9a' },
      { time: 420, kind: 'elite', hpMul: 1.6, reward: 'exquisite', banner: 'ヒルチャール暴徒の群れ！', count: 2 },
      { time: 455, surge: 'wall', kinds: ['swarm', 'swift', 'volt', 'frost', 'shell'], count: 52, rows: 3, radius: 13, span: 32, marchT: 8, notice: '大津波！ スライムの壁だ！', color: '#7fd6ff' },
      { time: 470, treasure: true, reward: 'precious', escape: 18, notice: '金色の宝箱ヒルチャール！ にがすな！' },
      { time: 480, kind: 'elite', hpMul: 1.8, reward: 'exquisite', banner: 'ヒルチャール暴徒 出現！' },
      { time: 510, surge: 'ring', kinds: ['spitter', 'spitter', 'binder'], count: 12, radius: 11.5, notice: '弓兵にねらわれている！', color: '#c890ff' },
      { time: 540, kind: 'elite', hpMul: 2.0, reward: 'exquisite', banner: '最後の暴徒たち！', count: 3 },
      { time: 570, surge: 'ring', kinds: ['mote', 'charger', 'frost', 'volt', 'shell'], count: 48, radius: 11, notice: '最後の大軍勢！', color: '#ff5a7a' },
      { time: 600, kind: 'venti', hpMul: 1, reward: 'luxurious', relic: true, banner: '風神 降臨', boss: true, final: true },
    ],
  },
};

/* ---------------- stages 2–4 (owner: STAGE) ----------------
   Same 10-minute shape as Mondstadt (growth curve shared); each stage multiplies normal/elite HP·damage·speed and the
   spawn rate/cap by `mul`, swaps the enemy mix to its element and ends with its god. Progress: requires = previous stage. */
(function () {
  const S = G.data.stages, M = S.mondstadt;
  const champ = [[0, 0], [200, 0], [210, 0.02], [540, 0.05]];
  /** event list builder: same timings as Mondstadt, stage-specific kinds / texts */
  function events(o) {
    const el = o.elite, ek = { kind: el };
    return [
      { time: 12, surge: 'arc', kinds: o.open, count: 10, radius: 11, notice: o.openText, color: o.color, golden: false },
      Object.assign({ time: 60, hpMul: 0.45, dmgMul: 0.6, reward: 'common', banner: o.eliteName + ' 出現！' }, ek),
      { time: 95, treasure: true, reward: 'common', escape: 22 },
      { time: 105, surge: 'wall', kinds: o.wall, count: 26, rows: 2, radius: 13, span: 28, marchT: 7, notice: o.wallText, color: o.color },
      Object.assign({ time: 120, hpMul: 0.7, dmgMul: 0.75, reward: 'exquisite', banner: o.eliteName + ' 出現！' }, ek),
      { time: 150, surge: 'ring', kinds: o.ring, count: 26, radius: 10, notice: o.ringText, color: o.color },
      Object.assign({ time: 180, hpMul: 1.0, dmgMul: 0.9, reward: 'exquisite', banner: o.eliteName + ' 出現！' }, ek),
      { time: 215, treasure: true, reward: 'exquisite', escape: 20 },
      Object.assign({ time: 240, hpMul: 1.2, reward: 'exquisite', banner: o.eliteName + 'の群れ！', count: 2 }, ek),
      { time: 270, surge: 'arc', kinds: o.march, count: 28, radius: 13, notice: o.marchText, color: '#ffb347' },
      { time: 300, kind: o.mid, hpMul: 1, reward: 'precious', relic: true, banner: o.midBanner, boss: true },
      { time: 340, treasure: true, reward: 'exquisite', escape: 20 },
      Object.assign({ time: 360, hpMul: 1.4, reward: 'exquisite', banner: o.eliteName + ' 出現！' }, ek),
      { time: 390, surge: 'ring', kinds: o.bigRing, count: 46, radius: 10.5, notice: '大包囲！ すき間をぬけろ！', color: '#ff7a9a' },
      Object.assign({ time: 420, hpMul: 1.6, reward: 'exquisite', banner: o.eliteName + 'の群れ！', count: 2 }, ek),
      { time: 455, surge: 'wall', kinds: o.bigWall, count: 54, rows: 3, radius: 13, span: 32, marchT: 8, notice: o.bigWallText, color: o.color },
      { time: 470, treasure: true, reward: 'precious', escape: 18, notice: '金色の宝箱ヒルチャール！ にがすな！' },
      Object.assign({ time: 480, hpMul: 1.8, reward: 'exquisite', banner: o.eliteName + ' 出現！' }, ek),
      { time: 510, surge: 'ring', kinds: o.snipers, count: 14, radius: 11.5, notice: '遠くからねらわれている！', color: '#c890ff' },
      Object.assign({ time: 540, hpMul: 2.0, reward: 'exquisite', banner: '最後の' + o.eliteName + 'たち！', count: 3 }, ek),
      { time: 570, surge: 'ring', kinds: o.last, count: 50, radius: 11, notice: '最後の大軍勢！', color: '#ff5a7a' },
      { time: 600, kind: o.boss, hpMul: 1, reward: 'luxurious', relic: true, banner: o.bossBanner, boss: true, final: true },
    ];
  }
  S.liyue = {
    id: 'liyue', name: '璃月の岩港', sub: '天衡山〜琥牢山', duration: 600,
    order: 2, region: '璃月', element: 'geo', bg: 'bg_liyue', bgSmall: 'bg_liyue_small', floor: 'floor_liyue', boss: 'zhongli', bossName: '鍾離',
    blurb: '契約と商いの港。かたい岩の敵が 行く手をふさぐ。岩神の 天星に 気をつけろ！', color: '#ffd24a', requires: 'mondstadt',
    mul: { hp: 2.2, dmg: 1.4, speed: 1.05, rate: 1.15, cap: 1.15 }, midBoss: 'ruin_geo', elite: 'geobrute',
    growth: M.growth, waves: M.waves, champion: champ,
    mixes: [
      [0, { mote: 55, geoslime: 45 }],
      [40, { mote: 45, geoslime: 35, spitter: 20 }],
      [85, { mote: 34, geoslime: 26, spitter: 15, shielder: 14, charger: 11 }],
      [140, { mote: 28, geoslime: 20, spitter: 14, shielder: 16, charger: 12, shell: 6, geoshaman: 4 }],
      [230, { mote: 24, geoslime: 18, spitter: 14, shielder: 17, charger: 12, shell: 9, geoshaman: 6 }],
      [360, { mote: 20, geoslime: 18, spitter: 14, shielder: 18, charger: 12, shell: 11, geoshaman: 8, swarm: 4 }],
    ],
    events: events({
      color: '#ffd24a', elite: 'geobrute', eliteName: '岩兜の暴徒', mid: 'ruin_geo', midBanner: '遺跡重機 起動', boss: 'zhongli', bossBanner: '岩神 降臨',
      open: ['mote', 'geoslime', 'geoslime'], openText: '岩スライムが 転がってきた！',
      wall: ['geoslime', 'geoslime', 'shielder'], wallText: '岩スライムの 地すべりだ！',
      ring: ['shielder', 'mote', 'geoslime'], ringText: '盾ヒルチャールに かこまれた！',
      march: ['shielder', 'shielder', 'charger', 'geoshaman'], marchText: '岩の大行進だ！',
      bigRing: ['geoslime', 'shell', 'mote', 'mote', 'shielder'], bigWall: ['geoslime', 'shell', 'shell', 'shielder', 'geoslime'], bigWallText: '大地すべり！ 岩の壁だ！',
      snipers: ['spitter', 'spitter', 'geoshaman'], last: ['mote', 'charger', 'shell', 'shielder', 'geoshaman'],
    }),
  };
  S.inazuma = {
    id: 'inazuma', name: '稲妻の雷島', sub: '鳴神島〜白狐の野', duration: 600,
    order: 3, region: '稲妻', element: 'electro', bg: 'bg_inazuma', bgSmall: 'bg_inazuma_small', floor: 'floor_inazuma', boss: 'raiden', bossName: '雷電将軍',
    blurb: '永遠をめざす 雷の国。すばやい雷の敵と 一瞬の居合に ついていけるか！', color: '#c77dff', requires: 'liyue',
    mul: { hp: 4.5, dmg: 1.8, speed: 1.1, rate: 1.3, cap: 1.3 }, midBoss: 'ruin_electro', elite: 'voltbrute',
    growth: M.growth, waves: M.waves, champion: champ,
    mixes: [
      [0, { mote: 50, volt: 50 }],
      [40, { mote: 40, volt: 40, voltarcher: 20 }],
      [85, { mote: 30, volt: 34, voltarcher: 16, voltchurl: 14, swarm: 6 }],
      [140, { mote: 24, volt: 30, voltarcher: 15, voltchurl: 15, swarm: 8, voltbig: 5, binder: 3 }],
      [270, { mote: 20, volt: 28, voltarcher: 15, voltchurl: 16, swarm: 6, voltbig: 9, binder: 6 }],
      [400, { mote: 18, volt: 26, voltarcher: 15, voltchurl: 16, swarm: 6, voltbig: 12, binder: 6, frost: 4 }],
    ],
    events: events({
      color: '#c77dff', elite: 'voltbrute', eliteName: '雷兜の暴徒', mid: 'ruin_electro', midBanner: '雷音の遺跡守衛 起動', boss: 'raiden', bossBanner: '雷神 降臨',
      open: ['mote', 'volt', 'volt'], openText: '雷スライムが はじけてる！',
      wall: ['volt', 'volt', 'swarm'], wallText: '雷スライムの 津波だ！',
      ring: ['volt', 'voltchurl', 'mote'], ringText: '雷の群れに かこまれた！',
      march: ['voltchurl', 'voltchurl', 'mote', 'voltarcher'], marchText: '雷の突撃隊だ！',
      bigRing: ['volt', 'volt', 'voltchurl', 'mote', 'voltbig'], bigWall: ['volt', 'volt', 'voltbig', 'swarm', 'frost'], bigWallText: '大津波！ 雷の壁だ！',
      snipers: ['voltarcher', 'voltarcher', 'binder'], last: ['voltchurl', 'voltbig', 'volt', 'mote', 'voltarcher'],
    }),
  };
  S.sumeru = {
    id: 'sumeru', name: 'スメールの樹海', sub: '雨林〜知恵の樹', duration: 600,
    order: 4, region: 'スメール', element: 'dendro', bg: 'bg_sumeru', bgSmall: 'bg_sumeru_small', floor: 'floor_sumeru', boss: 'nahida', bossName: 'ナヒーダ',
    blurb: '知恵の国の 深い森。草の敵は 炎で燃え、雷で激化、水で開花！ 最強の草神が 待つ。', color: '#8fd13a', requires: 'inazuma',
    mul: { hp: 9, dmg: 2.4, speed: 1.15, rate: 1.45, cap: 1.45 }, midBoss: 'ruin_dendro', elite: 'dendrobrute',
    growth: M.growth, waves: M.waves, champion: champ,
    mixes: [
      [0, { mote: 45, dendroslime: 55 }],
      [40, { mote: 35, dendroslime: 45, swarm: 20 }],
      [85, { mote: 30, dendroslime: 35, swarm: 12, spitter: 13, dendroshaman: 10 }],
      [140, { mote: 24, dendroslime: 30, swarm: 10, spitter: 12, dendroshaman: 10, charger: 9, dendrobig: 5 }],
      [270, { mote: 20, dendroslime: 28, swarm: 9, spitter: 12, dendroshaman: 10, charger: 10, dendrobig: 9, volt: 4 }],
      [400, { mote: 18, dendroslime: 26, swarm: 8, spitter: 12, dendroshaman: 11, charger: 10, dendrobig: 12, volt: 5 }],
    ],
    events: events({
      color: '#8fd13a', elite: 'dendrobrute', eliteName: '草冠の暴徒', mid: 'ruin_dendro', midBanner: '樹海の遺跡守衛 起動', boss: 'nahida', bossBanner: '草神 降臨',
      open: ['mote', 'dendroslime', 'dendroslime'], openText: '草スライムが わいてきた！',
      wall: ['dendroslime', 'dendroslime', 'swarm'], wallText: '草スライムの 大波だ！',
      ring: ['dendroslime', 'mote', 'swarm'], ringText: '森の群れに かこまれた！',
      march: ['mote', 'charger', 'dendroshaman', 'mote'], marchText: 'ヒルチャールの 森の行進！',
      bigRing: ['dendroslime', 'dendroslime', 'mote', 'charger', 'dendrobig'], bigWall: ['dendroslime', 'dendrobig', 'swarm', 'dendrobig', 'volt'], bigWallText: '大波！ 森がおしよせる！',
      snipers: ['spitter', 'spitter', 'dendroshaman'], last: ['charger', 'dendrobig', 'dendroslime', 'mote', 'dendroshaman'],
    }),
  };
})();

/* ---------------- permanent upgrades bought with Mora (owner: PROGRESSION / BALANCE) ----------------
   per: value added per level (fractions are %). glyph: SVG glyph key used by G.progressionUI.
   cost(level) = base × growth^level (rounded to 10) — see G.data.metaCost.
   Balance v5: the un-upgraded Amber is deliberately weak (slow bow, short aim, 1 arrow). These home upgrades are the
   main power curve — a fresh save buys 1–3 stars per run, and a maxed map turns the run into a screen-filling 無双. */
G.data.meta = {
  power:      { name: '攻撃力',       glyph: 'atk',    desc: '攻撃力 +10%',             max: 20, per: 0.10, pct: true, base: 40,  growth: 1.2 },
  haste:      { name: '攻撃速度',     glyph: 'haste',  desc: '矢もランチャーも速く +8%', max: 15, per: 0.08, pct: true, base: 50,  growth: 1.22 },
  multishot:  { name: '矢の本数',     glyph: 'arrows', desc: '同時に撃つ矢 +1本',        max: 3,  per: 1,               base: 700, growth: 3.2 },
  vitality:   { name: '最大HP',       glyph: 'hp',     desc: '最大HP +10%',             max: 15, per: 0.10, pct: true, base: 40,  growth: 1.22 },
  defense:    { name: '防御力',       glyph: 'def',    desc: '防御力 +10',              max: 10, per: 10,              base: 70,  growth: 1.3 },
  speed:      { name: '移動速度',     glyph: 'speed',  desc: '移動速度 +4%',            max: 8,  per: 0.04, pct: true, base: 50,  growth: 1.3 },
  range:      { name: '射程',         glyph: 'eye',    desc: '矢がとどく距離 +10%（遠くの敵もねらう）', max: 8, per: 0.10, pct: true, base: 60, growth: 1.3 },
  recharge:   { name: '元素チャージ効率', glyph: 'er', desc: 'エネルギー回収 +8%',      max: 5,  per: 0.08, pct: true, base: 150, growth: 1.4 },
  crit_rate:  { name: '会心率',       glyph: 'cr',     desc: '会心率 +4%',              max: 10, per: 0.04, pct: true, base: 120, growth: 1.3 },
  crit_damage:{ name: '会心ダメージ', glyph: 'cd',     desc: '会心ダメージ +10%',       max: 10, per: 0.10, pct: true, base: 120, growth: 1.3 },
  gather:     { name: '回収範囲',     glyph: 'magnet', desc: '回収範囲 +10%',           max: 5,  per: 0.10, pct: true, base: 60,  growth: 1.35 },
  mora:       { name: 'モラ獲得量',   glyph: 'mora',   desc: 'モラ獲得量 +10%',         max: 10, per: 0.10, pct: true, base: 80,  growth: 1.3 },
  chest:      { name: '宝箱発見率',   glyph: 'chest',  desc: '宝箱が出やすくなる +15%', max: 5,  per: 0.15, pct: true, base: 160, growth: 1.4 },
  reroll:     { name: '引き直し',     glyph: 'reroll', desc: 'レベルアップの引き直し +1回', max: 3, per: 1,          base: 300, growth: 2.2 },
  revival:    { name: '不屈の心',     glyph: 'revive', desc: '1回だけ HP50% で復活',    max: 1,  per: 1,               base: 1200 },
  wisdom:     { name: '風の知恵',     glyph: 'book',   desc: '経験値 +6%（レベルアップが早くなる）', max: 15, per: 0.06, pct: true, base: 50, growth: 1.22 },
  ks_fire:    { name: '烈火の心',     glyph: 'boom',   desc: '全ダメージ +10%',         max: 3,  per: 0.10, pct: true, base: 1500, growth: 1.8, keystone: true },
  ks_guard:   { name: '岩の守り',     glyph: 'shield', desc: '出撃時シールド（HP30%）・被ダメ -8%', max: 1, per: 1, base: 2000, keystone: true },
  ks_burst:   { name: '風の翼',       glyph: 'er',     desc: '出撃時 元素爆発が満タン・クールタイム -8%', max: 1, per: 1, base: 2000, keystone: true },
  ks_luck:    { name: '幸運の星',     glyph: 'star',   desc: '金色カード・大当たりが出やすい +50%', max: 3, per: 0.5, pct: true, base: 1500, growth: 1.8, keystone: true },
};
G.data.metaOrder = ['power', 'haste', 'multishot', 'vitality', 'defense', 'speed', 'range', 'crit_rate', 'crit_damage', 'recharge', 'gather', 'mora', 'chest', 'reroll', 'revival', 'wisdom', 'ks_fire', 'ks_guard', 'ks_burst', 'ks_luck'];
/* 天賦の星図 layout (viewBox 400×300, root at centre). parent: node that needs Lv1+ first. br: branch colour key. */
G.data.metaTree = {
  root: { x: 200, y: 150 },
  branches: { atk: { name: '攻撃の星', c: '#ff8a5c' }, def: { name: '守りの星', c: '#6ff09a' }, wind: { name: '風の星', c: '#5cf2c8' }, gold: { name: '宝の星', c: '#ffd24a' } },
  nodes: {
    power: { x: 150, y: 108, parent: 'root', br: 'atk' }, crit_rate: { x: 112, y: 62, parent: 'power', br: 'atk' },
    crit_damage: { x: 62, y: 40, parent: 'crit_rate', br: 'atk' }, ks_fire: { x: 28, y: 88, parent: 'crit_damage', br: 'atk' },
    haste: { x: 104, y: 126, parent: 'power', br: 'atk' }, multishot: { x: 62, y: 150, parent: 'haste', br: 'atk' },
    vitality: { x: 150, y: 192, parent: 'root', br: 'def' }, defense: { x: 112, y: 238, parent: 'vitality', br: 'def' },
    revival: { x: 62, y: 260, parent: 'defense', br: 'def' }, ks_guard: { x: 28, y: 212, parent: 'revival', br: 'def' },
    speed: { x: 250, y: 108, parent: 'root', br: 'wind' }, wisdom: { x: 288, y: 62, parent: 'speed', br: 'wind' },
    recharge: { x: 338, y: 40, parent: 'wisdom', br: 'wind' }, ks_burst: { x: 372, y: 88, parent: 'recharge', br: 'wind' },
    range: { x: 296, y: 126, parent: 'speed', br: 'wind' },
    gather: { x: 250, y: 192, parent: 'root', br: 'gold' }, mora: { x: 288, y: 238, parent: 'gather', br: 'gold' },
    chest: { x: 338, y: 260, parent: 'mora', br: 'gold' }, ks_luck: { x: 372, y: 212, parent: 'chest', br: 'gold' },
    reroll: { x: 214, y: 262, parent: 'gather', br: 'gold' },
  },
};
G.data.metaCost = function (key, level) {
  const d = G.data.meta[key]; const base = d ? d.base : 100;
  return Math.ceil(base * Math.pow(d && d.growth || 1.38, level) / 10) * 10;
};
/** XP (element particles) needed to go from level L to L+1  (balance v5).
   Un-upgraded: Lv2–3 in the first minute, ~Lv6 at 3:00. With 風の知恵/回収 + more kills the same curve flies by
   (maxed save: ~Lv20 at 3:00, 40+ in a full run). */
G.data.xpNeed = function (level) {
  const n = level - 1;
  return Math.round(16 + 14 * n + 2 * n * n + 0.06 * n * n * n);
};
