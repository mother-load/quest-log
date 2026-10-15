// build-data.mjs — GitHub の Issue からクエストと自主トレを集めて data.json にまとめる
// GitHub Actions の中で動く（環境変数 GITHUB_TOKEN と GITHUB_REPOSITORY を使う）
// 使い方：node scripts/build-data.mjs <出力先のファイル>
import { readFile, writeFile } from 'node:fs/promises';

const out = process.argv[2] || 'data.json';
const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const config = JSON.parse(await readFile(new URL('../config.json', import.meta.url), 'utf8'));

async function api(path) {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function all(path) {
  const items = [];
  for (let page = 1; ; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const batch = await api(`${path}${sep}per_page=100&page=${page}`);
    items.push(...batch);
    if (batch.length < 100) return items;
  }
}

// Issue フォームの本文（### 見出し + 値）を { 見出し: 値 } にする
function parseForm(body) {
  const fields = {};
  const parts = (body || '').split(/^###\s+/m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf('\n');
    const label = (nl === -1 ? part : part.slice(0, nl)).trim();
    let value = nl === -1 ? '' : part.slice(nl + 1).trim();
    if (value === '_No response_') value = '';
    fields[label] = value;
  }
  return fields;
}

const short = (s, n = 160) => {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};
const toInt = (s, d) => {
  const n = parseInt(String(s || '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : d;
};

const TRUSTED = ['OWNER', 'COLLABORATOR', 'MEMBER'];
const issues = (await all('/issues?state=all&sort=created&direction=asc')).filter(i => !i.pull_request);

const candidates = issues
  .map(i => ({ issue: i, type: i.title.startsWith('【クエスト】') ? 'quest' : i.title.startsWith('【自主トレ】') ? 'training' : null }))
  .filter(c => c.type)
  // 知らない人が立てた Issue は数えない（公開リポジトリのいたずら対策）
  .filter(c => c.type === 'quest'
    ? TRUSTED.includes(c.issue.author_association) || config.mentors.includes(c.issue.user.login)
    : c.issue.user.login === config.player);

// 各 Issue のコメントと「誰が閉じたか」を集める
for (const c of candidates) {
  c.comments = c.issue.comments ? await all(`/issues/${c.issue.number}/comments`) : [];
  c.closedBy = c.issue.state === 'closed' ? (await api(`/issues/${c.issue.number}`)).closed_by?.login || null : null;
}

// メンター：config.json に書いた人。空なら、コメントや Issue を書いたリポジトリの協力者（本人以外）
let mentors = config.mentors.slice();
if (mentors.length === 0) {
  const set = new Set();
  for (const c of candidates) {
    for (const x of [c.issue, ...c.comments]) {
      if (['COLLABORATOR', 'MEMBER'].includes(x.author_association) && x.user.login !== config.player) set.add(x.user.login);
    }
  }
  mentors = [...set];
}

const today = new Date().toISOString().slice(0, 10);

const quests = [];
const trainings = [];
for (const { issue, type, comments, closedBy } of candidates) {
  const f = parseForm(issue.body);
  const base = {
    number: issue.number,
    title: issue.title.replace(/^【(クエスト|自主トレ)】\s*/, '') || '（無題）',
    url: issue.html_url,
    author: issue.user.login,
    createdAt: issue.created_at,
    closedAt: issue.closed_at,
    closedBy,
    skill: f['スキル'] || 'その他',
    detail: short(f['内容'] || f['やったこと・学んだこと'], 240)
  };
  if (type === 'quest') {
    const deadline = /^\d{4}-\d{2}-\d{2}$/.test(f['期限'] || '') ? f['期限'] : null;
    const cleared = issue.state === 'closed' && issue.state_reason !== 'not_planned' && mentors.includes(closedBy);
    const playerComments = comments.filter(x => x.user.login === config.player);
    const mentorComments = comments.filter(x => mentors.includes(x.user.login));
    const words = cleared
      ? mentorComments.filter(x => x.user.login === closedBy && x.created_at <= issue.closed_at).pop() || mentorComments.pop()
      : null;
    let status = 'active';
    if (cleared) status = 'cleared';
    else if (issue.state === 'closed') status = 'closed';
    else if (playerComments.length) status = 'submitted';
    quests.push({
      ...base,
      xp: toInt(f['報酬（経験値）'], 100),
      rank: (f['難易度'] || '★').length,
      deadline,
      status,
      overdue: !cleared && issue.state === 'open' && !!deadline && deadline < today,
      onTime: cleared && !!deadline && issue.closed_at.slice(0, 10) <= deadline,
      submissions: playerComments.length,
      lastSubmission: playerComments.length ? short(playerComments.at(-1).body) : null,
      mentorWords: words ? short(words.body, 200) : null
    });
  } else {
    const done = issue.state === 'closed' && issue.state_reason !== 'not_planned' && closedBy === config.player;
    trainings.push({ ...base, xp: Math.min(toInt(f['経験値'], 10), 30), done });
  }
}

const data = {
  generatedAt: new Date().toISOString(),
  repo,
  player: config.player,
  playerName: config.playerName,
  mentorName: config.mentorName,
  mentors,
  quests,
  trainings
};
await writeFile(out, JSON.stringify(data, null, 2));
console.log(`quests=${quests.length} trainings=${trainings.length} mentors=${mentors.join(',') || '(none)'}`);
