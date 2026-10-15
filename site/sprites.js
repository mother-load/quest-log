// sprites.js — ドット絵のキャラクター（16×16 マス）をその場で描いて動かす
// 主人公はレベルで装備が増える：Lv3 剣 → Lv5 マント → Lv8 兜 → Lv12 王冠 → Lv20 オーラ
(function () {
  var SIZE = 16;
  var COLORS = {
    K: '#1a1c2c', // 輪郭
    S: '#f4c29a', // 肌
    H: '#5b3a29', // 髪
    E: '#1a1c2c', // 目
    T: '#3b7dd8', // 服
    B: '#8b5a2b', // ベルト・木
    P: '#3a3f58', // ズボン
    O: '#4a2f22', // 靴
    W: '#dfe5ee', // 刃・ひげ
    G: '#f2c14e', // 金
    R: '#c0392b', // マント・羽根
    M: '#9aa4b5', // 兜
    V: '#6c4fb0', // 賢者のローブ
    C: '#5ff3ff', // 杖の宝玉
    c: '#2a9fb0', // 宝玉（暗い）
    Y: '#fff3c4'  // きらめき
  };

  // 行の文字を色に置き換える（「.」は透明）。行の長さが違っても16マスにそろえる
  function grid(rows) {
    return rows.map(function (r) { return (r + '................').slice(0, SIZE).split(''); });
  }

  var HERO = grid([
    '................',
    '.....KKKKKK.....',
    '....KHHHHHHK....',
    '...KHHHHHHHHK...',
    '...KHSSSSSSHK...',
    '...KSSESSESSK...',
    '...KSSSSSSSSK...',
    '....KSSSSSSK....',
    '....KKTTTTKK....',
    '...KSKTTTTKSK...',
    '...KSKTBBTKSK...',
    '...KKKTTTTKKK...',
    '.....KPPPPK.....',
    '.....KPKKPK.....',
    '....KOOKKOOK....',
    '....KKKKKKKK....'
  ]);

  var SAGE = grid([
    '......KKKK......',
    '.....KVVVVK.....',
    '....KVVVVVVK....',
    '...KVVVVVVVVK...',
    '..KKKKKKKKKKKK..',
    '....KSSSSSSK....',
    '....KSESSESK.C..',
    '....KWWWWWWK.B..',
    '...KVWWWWWWVKB..',
    '..KSVVWWWWVVSB..',
    '..KKVVVWWVVVKB..',
    '...KVVVVVVVVKB..',
    '...KVVVVVVVVKB..',
    '...KVVVVVVVVKB..',
    '...KKKKKKKKKKB..',
    '.............B..'
  ]);

  function rect(x0, y0, x1, y1, c) {
    var out = [];
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) out.push([x, y, c]);
    return out;
  }

  // 装備（主人公の絵の上に重ねる点の一覧）
  var SWORD = [[13, 2, 'W'], [13, 3, 'W'], [13, 4, 'W'], [13, 5, 'W'], [13, 6, 'W'], [13, 7, 'W'], [13, 8, 'W'],
    [12, 9, 'G'], [13, 9, 'G'], [14, 9, 'G'], [13, 10, 'B']];
  var CAPE = rect(2, 8, 13, 14, 'R'); // 体の後ろに描く
  var HELMET = rect(5, 1, 10, 2, 'M').concat(rect(4, 3, 11, 3, 'M'), [[7, 0, 'R'], [8, 0, 'R']]);
  var CROWN = [[5, 0, 'G'], [7, 0, 'G'], [8, 0, 'G'], [10, 0, 'G']].concat(rect(5, 1, 10, 1, 'G'), [[7, 1, 'R']]);

  function paint(ctx, x, y, key) {
    if (!key || key === '.') return;
    ctx.fillStyle = COLORS[key];
    ctx.fillRect(x, y, 1, 1);
  }

  // frame：0 = ふつう、1 = 少し沈む（呼吸）。blink：まばたき中
  function drawHero(ctx, level, frame, blink) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    var bob = frame === 1 ? 1 : 0; // 上半身（0〜11行）だけ1マス下げる
    if (level >= 5) CAPE.forEach(function (p) { paint(ctx, p[0], p[1] + (p[1] < 12 ? bob : 0), p[2]); });
    HERO.forEach(function (row, y) {
      row.forEach(function (key, x) {
        if (blink && key === 'E') key = 'S';
        paint(ctx, x, y < 12 ? y + bob : y, key);
      });
    });
    if (level >= 12) CROWN.forEach(function (p) { paint(ctx, p[0], p[1] + bob, p[2]); });
    else if (level >= 8) HELMET.forEach(function (p) { paint(ctx, p[0], p[1] + bob, p[2]); });
    if (level >= 3) {
      SWORD.forEach(function (p) { paint(ctx, p[0], p[1] + bob, p[2]); });
      if (frame === 1) paint(ctx, 13, 2 + bob, 'Y'); // 剣先がきらりと光る
    }
    if (level >= 20) {
      var spots = frame === 1 ? [[1, 3], [14, 12], [2, 13]] : [[14, 1], [1, 9], [12, 14]];
      spots.forEach(function (s) { paint(ctx, s[0], s[1], 'Y'); });
    }
  }

  function drawSage(ctx, frame, blink) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    var bob = frame === 1 ? 1 : 0;
    SAGE.forEach(function (row, y) {
      row.forEach(function (key, x) {
        if (blink && key === 'E') key = 'S';
        if (key === 'C') key = frame === 1 ? 'C' : 'c'; // 宝玉がゆっくり光る
        var staff = x === 13;
        paint(ctx, x, (y < 14 && !staff) ? y + bob : y, key);
      });
    });
  }

  var stillOnly = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var actors = [];
  var tick = 0;

  function animate() {
    tick++;
    actors.forEach(function (a) {
      var frame = stillOnly ? 0 : Math.floor((tick + a.offset) / 2) % 2;
      var blink = !stillOnly && (tick + a.offset * 3) % 14 === 0;
      a.draw(frame, blink);
    });
  }

  function add(canvas, draw) {
    canvas.width = SIZE;
    canvas.height = SIZE;
    var ctx = canvas.getContext('2d');
    var actor = { offset: actors.length * 3, draw: function (f, b) { draw(ctx, f, b); } };
    actors.push(actor);
    actor.draw(0, false);
  }

  if (!stillOnly) setInterval(animate, 260);

  window.Sprites = {
    reset: function () { actors = []; },
    hero: function (canvas, level) { add(canvas, function (ctx, f, b) { drawHero(ctx, level, f, b); }); },
    sage: function (canvas) { add(canvas, drawSage); },
    // 次に手に入る装備
    nextGear: function (level) {
      var gear = [[3, '剣'], [5, 'マント'], [8, '兜'], [12, '王冠'], [20, '伝説のオーラ']];
      for (var i = 0; i < gear.length; i++) if (level < gear[i][0]) return { level: gear[i][0], name: gear[i][1] };
      return null;
    }
  };
})();
