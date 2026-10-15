// app.js — data.json を読んで、ステータス・スキル・クエスト・冒険の書・実績を表示する
(function () {
  var isDemo = /[?&]demo\b/.test(location.search);
  var app = document.getElementById('app');

  // ---- 計算のルール ----
  // レベル L になるのに必要な累計経験値：50 × L × (L − 1)（Lv2 = 100、Lv3 = 300、Lv4 = 600 …）
  function needFor(level) { return 50 * level * (level - 1); }
  function levelOf(xp) { var l = 1; while (needFor(l + 1) <= xp) l++; return l; }

  var TITLES = [
    [1, '見習い冒険者'], [3, '駆け出しの職人'], [5, '一人前の職人'],
    [8, '熟練の職人'], [12, '達人'], [20, '伝説の職人']
  ];
  function titleOf(level) {
    var t = TITLES[0][1];
    TITLES.forEach(function (row) { if (level >= row[0]) t = row[1]; });
    return t;
  }

  var SKILLS = ['Web制作', 'AI活用', '文章・発信', '企画・デザイン', '調査・分析', 'その他'];

  // ---- 表示の道具 ----
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function day(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return (d.getMonth() + 1) + '/' + d.getDate();
  }
  function stars(n) { return '★★★★★'.slice(0, n) + '<span class="dim">' + '★★★★★'.slice(n) + '</span>'; }

  // ---- 読み込み ----
  fetch(isDemo ? 'demo.json' : 'data.json', { cache: 'no-store' })
    .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
    .then(render)
    .catch(function () {
      app.innerHTML = '<section class="panel empty"><h2>まだ記録がありません</h2>' +
        '<p>GitHub の自動更新がまだ一度も動いていないか、データを読み込めませんでした。</p>' +
        '<p><a class="btn" href="?demo">デモ表示で見た目を確かめる</a></p></section>';
    });

  function render(data) {
    document.getElementById('demo-banner').hidden = !isDemo;
    var repoUrl = 'https://github.com/' + data.repo;
    document.getElementById('repo-link').href = repoUrl;
    document.getElementById('new-quest').href = repoUrl + '/issues/new?template=quest.yml';
    document.getElementById('new-training').href = repoUrl + '/issues/new?template=training.yml';
    if (isDemo) document.getElementById('data-link').href = 'demo.json';
    document.getElementById('updated').textContent = '最終更新：' + new Date(data.generatedAt).toLocaleString('ja-JP');

    // 経験値が入ったできごとを古い順に並べる
    var events = [];
    data.quests.forEach(function (q) { if (q.status === 'cleared') events.push({ kind: 'quest', at: q.closedAt, xp: q.xp, item: q }); });
    data.trainings.forEach(function (t) { if (t.done) events.push({ kind: 'training', at: t.closedAt, xp: t.xp, item: t }); });
    events.sort(function (a, b) { return a.at < b.at ? -1 : 1; });

    // 経験値・レベルアップ・スキルを順に足していく
    var xp = 0, skillXp = {}, log = [];
    SKILLS.forEach(function (s) { skillXp[s] = 0; });
    events.forEach(function (e) {
      var before = levelOf(xp);
      xp += e.xp;
      var skill = SKILLS.indexOf(e.item.skill) >= 0 ? e.item.skill : 'その他';
      skillXp[skill] += e.xp;
      log.push(e);
      var after = levelOf(xp);
      if (after > before) log.push({ kind: 'levelup', at: e.at, level: after });
    });

    var level = levelOf(xp);
    var cur = needFor(level), next = needFor(level + 1);
    var pct = Math.round((xp - cur) / (next - cur) * 100);
    var gear = window.Sprites ? window.Sprites.nextGear(level) : null;
    var cleared = data.quests.filter(function (q) { return q.status === 'cleared'; });
    var open = data.quests.filter(function (q) { return q.status === 'active' || q.status === 'submitted'; });
    var trainingsDone = data.trainings.filter(function (t) { return t.done; });

    var html = '';

    // ステータス
    html += '<section class="panel status">' +
      '<div class="avatar"><canvas class="sprite" id="hero-sprite" role="img" aria-label="Lv.' + level + ' の主人公のドット絵"></canvas></div>' +
      '<div class="status-main">' +
        '<p class="player">' + esc(data.playerName) + ' <span class="handle">@' + esc(data.player) + '</span></p>' +
        '<p class="title-line"><span class="lv">Lv.' + level + '</span> <span class="rank-title">' + esc(titleOf(level)) + '</span></p>' +
        '<div class="xpbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="次のレベルまでの経験値">' +
          '<span class="xpfill" style="--w:' + pct + '%"></span></div>' +
        '<p class="xptext">EXP ' + xp + ' ／ 次のレベルまであと ' + (next - xp) + '</p>' +
        (gear ? '<p class="gear">次の装備：Lv.' + gear.level + ' で「' + esc(gear.name) + '」を手に入れる</p>' : '<p class="gear">すべての装備を手に入れた！</p>') +
      '</div>' +
      '<dl class="counts">' +
        '<div><dt>クエストクリア</dt><dd>' + cleared.length + '</dd></div>' +
        '<div><dt>受注中</dt><dd>' + open.length + '</dd></div>' +
        '<div><dt>自主トレ</dt><dd>' + trainingsDone.length + '</dd></div>' +
      '</dl></section>';

    // スキル
    var maxSkill = Math.max.apply(null, SKILLS.map(function (s) { return skillXp[s]; }).concat([1]));
    html += '<section class="panel"><h2>スキル</h2><ul class="skills">' + SKILLS.map(function (s) {
      var v = skillXp[s];
      return '<li><span class="skill-name">' + esc(s) + '</span>' +
        '<span class="skill-track"><span class="skill-fill" style="--w:' + Math.round(v / maxSkill * 100) + '%"></span></span>' +
        '<span class="skill-val">' + v + '</span></li>';
    }).join('') + '</ul></section>';

    // クエストボード
    function questCard(q) {
      var badge = { active: '受注中', submitted: '提出済み・確認待ち', cleared: 'クリア', closed: '中止' }[q.status];
      return '<article class="quest quest-' + q.status + (q.overdue ? ' is-overdue' : '') + '">' +
        '<div class="quest-head"><span class="quest-rank">' + stars(q.rank) + '</span>' +
          '<span class="quest-badge">' + badge + '</span>' + (q.overdue ? '<span class="quest-badge warn">期限切れ</span>' : '') + '</div>' +
        '<h3><a href="' + esc(q.url) + '" target="_blank" rel="noopener">' + esc(q.title) + '</a></h3>' +
        (q.detail ? '<p class="quest-detail">' + esc(q.detail) + '</p>' : '') +
        '<p class="quest-meta"><span>報酬 <b>' + q.xp + ' EXP</b></span><span>' + esc(q.skill) + '</span>' +
          (q.deadline ? '<span>期限 ' + esc(q.deadline) + '</span>' : '') +
          (q.status === 'cleared' ? '<span>クリア ' + day(q.closedAt) + (q.onTime ? '（期限内）' : '') + '</span>' : '') + '</p>' +
        (q.lastSubmission && q.status !== 'cleared' ? '<p class="quote">提出：' + esc(q.lastSubmission) + '</p>' : '') +
        (q.mentorWords ? '<p class="quote mentor">' + esc(data.mentorName) + 'の言葉：' + esc(q.mentorWords) + '</p>' : '') +
        (q.status !== 'cleared' && q.status !== 'closed' ? '<p class="quest-action"><a class="btn small" href="' + esc(q.url) + '" target="_blank" rel="noopener">提出する（コメントを書く）</a></p>' : '') +
        '</article>';
    }
    html += '<section class="panel"><h2>クエストボード</h2>' +
      '<div class="mentor-row"><canvas class="sprite sprite-small" id="mentor-sprite" role="img" aria-label="メンター（賢者）のドット絵"></canvas>' +
      '<p class="bubble">' + (open.length ? 'さあ、次の試練じゃ。期限までに成果を見せておくれ。' : 'よくやった。次のクエストを考えておこう。') + '</p></div>' +
      (open.length ? '<div class="quests">' + open.slice().reverse().map(questCard).join('') + '</div>'
        : '<p class="muted">受注中のクエストはありません。' + esc(data.mentorName) + 'からの次のクエストを待ちましょう。</p>') +
      (cleared.length ? '<details class="cleared"><summary>クリア済みのクエスト（' + cleared.length + '）</summary><div class="quests">' +
        cleared.slice().reverse().map(questCard).join('') + '</div></details>' : '') +
      '</section>';

    // 冒険の書（新しい順）
    html += '<section class="panel"><h2>冒険の書</h2>' + (log.length ? '<ol class="log">' + log.slice().reverse().map(function (e) {
      if (e.kind === 'levelup') return '<li class="log-levelup"><span class="log-day">' + day(e.at) + '</span><span>レベルが <b>' + e.level + '</b> に上がった！ 称号「' + esc(titleOf(e.level)) + '」</span></li>';
      var label = e.kind === 'quest' ? 'クエスト「' + esc(e.item.title) + '」をクリアした！' : '自主トレ「' + esc(e.item.title) + '」';
      return '<li class="log-' + e.kind + '"><span class="log-day">' + day(e.at) + '</span><span><a href="' + esc(e.item.url) + '" target="_blank" rel="noopener">' + label + '</a></span><span class="log-xp">+' + e.xp + ' EXP</span></li>';
    }).join('') + '</ol>' : '<p class="muted">まだ記録はありません。最初のクエストか自主トレで、冒険を始めましょう。</p>') + '</section>';

    // 実績
    var firstQuest = cleared.length ? cleared.slice().sort(function (a, b) { return a.closedAt < b.closedAt ? -1 : 1; })[0] : null;
    var badges = [
      ['旅立ち', '最初のクエストをクリアする', !!firstQuest],
      ['期限の守り手', '期限内にクエストをクリアする', cleared.some(function (q) { return q.onTime; })],
      ['五つの試練', 'クエストを5回クリアする', cleared.length >= 5],
      ['大物狩り', '★★★★以上のクエストをクリアする', cleared.some(function (q) { return q.rank >= 4; })],
      ['自主練の芽', '自主トレを初めて記録する', trainingsDone.length >= 1],
      ['継続は力なり', '自主トレを5回記録する', trainingsDone.length >= 5],
      ['一人前', 'レベル5に到達する', level >= 5],
      ['万能の職人', '「その他」以外の全スキルで経験値を得る', SKILLS.slice(0, 5).every(function (s) { return skillXp[s] > 0; })]
    ];
    html += '<section class="panel"><h2>実績</h2><ul class="badges">' + badges.map(function (b) {
      return '<li class="badge' + (b[2] ? ' got' : '') + '"><span class="badge-icon" aria-hidden="true">' + (b[2] ? '◆' : '◇') + '</span>' +
        '<span class="badge-name">' + esc(b[0]) + '</span><span class="badge-desc">' + esc(b[1]) + '</span></li>';
    }).join('') + '</ul></section>';

    app.innerHTML = html;

    if (window.Sprites) {
      window.Sprites.reset();
      // デモでは ?demo&lv=12 のように書くと、そのレベルの装備で表示できる（見た目の確認用）
      var lvParam = isDemo && location.search.match(/[?&]lv=(\d+)/);
      window.Sprites.hero(document.getElementById('hero-sprite'), lvParam ? Number(lvParam[1]) : level);
      window.Sprites.sage(document.getElementById('mentor-sprite'));
    }
  }
})();
