/* 五度环 — 规则与内容自检
 * 运行：node tests/check.js
 * 只依赖 app/game.js 导出的纯函数，不需要浏览器。 */

const path = require('path');
const fs = require('fs');

/* 同一份测试既能在仓库根（../app）跑，也能在制作目录（../build/app）跑 */
const candidates = [
  path.join(__dirname, '..', 'app', 'game.js'),
  path.join(__dirname, '..', 'build', 'app', 'game.js')
];
const target = candidates.find((p) => fs.existsSync(p));
if (!target) {
  console.log('cannot find app/game.js; looked in:\n' + candidates.join('\n'));
  process.exit(1);
}
const m = require(target);

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, cond, detail) {
  if (cond) { pass++; return; }
  fail++;
  failures.push(name + (detail ? ' — ' + detail : ''));
}

/* ---------- 1. 房间与教程卡完整性 ---------- */
const rooms = m.ROOMS;
const districts = m.DISTRICTS;
ok('room count 27', rooms.length === 27, 'got ' + rooms.length);
ok('playable rooms 19', rooms.filter((r) => r.kind !== 'locked').length === 19, 'got ' + rooms.filter((r) => r.kind !== 'locked').length);
ok('district count 6', districts.length === 6, 'got ' + districts.length);

const ids = new Set();
rooms.forEach((r) => {
  ok('unique id ' + r.id, !ids.has(r.id));
  ids.add(r.id);
  ok('room has teach ' + r.id, !!(r.teach && r.teach.title && r.teach.body && r.teach.body.length));
  ok('teach cites a source ' + r.id, !!(r.teach && r.teach.cite), r.id);
  ok('teach has quote ' + r.id, !!(r.teach && r.teach.quote && r.teach.quote.length > 12), r.id);
  ok('room belongs to a district ' + r.id, districts.some((d) => d.id === r.district));
});

districts.forEach((d) => {
  ok('district has rooms ' + d.id, rooms.some((r) => r.district === d.id));
});

/* ---------- 2. 对位关卡：可解性 ---------- */
function solve(level) {
  const total = m.totalSlots(level);
  const slots = new Array(total).fill(null);
  let nodes = 0;
  let found = null;
  function dfs(i) {
    if (++nodes > 500000) return false;
    if (i === total) {
      if (m.judge(level, slots).violations.length === 0) { found = slots.slice(); return true; }
      return false;
    }
    for (const p of level.palette) {
      slots[i] = p;
      if (m.judge(level, slots).violations.length === 0 && dfs(i + 1)) return true;
    }
    slots[i] = null;
    return false;
  }
  dfs(0);
  return found;
}

m.LEVELS.forEach((lv) => {
  const sol = solve(lv);
  ok('counterpoint solvable ' + lv.id, !!sol);
  if (sol) {
    ok('reference matches a legal solution ' + lv.id,
      m.judge(lv, lv.reference).violations.length === 0,
      JSON.stringify(m.judge(lv, lv.reference).violations.map((v) => v.code)));
  }
});

/* ---------- 3. 拼音阶 ---------- */
rooms.filter((r) => r.kind === 'scale').forEach((r) => {
  const t = r.target;
  ok('scale has 7 pcs ' + r.id, t.pcs.length === 7, r.id);
  ok('scale has 7 names ' + r.id, t.degrees.length === 7, r.id);
  ok('scale tonic inside set ' + r.id, t.pcs.indexOf(t.tonic) !== -1, r.id);
});

/* ---------- 4. 和声 ---------- */
rooms.filter((r) => r.kind === 'harmony').forEach((r) => {
  r.situations.forEach((s, i) => {
    const legal = s.options.filter((o) => m.harmonyIssues(s.prev, o, r.tonic).length === 0);
    ok('harmony has a legal option ' + r.id + '#' + i, legal.length >= 1);
    ok('harmony has a decoy ' + r.id + '#' + i, s.options.length > legal.length, r.id + '#' + i);
    ok('harmony has 3 options ' + r.id + '#' + i, s.options.length === 3);
  });
});

/* ---------- 5. 音集 ---------- */
rooms.filter((r) => r.kind === 'set').forEach((r) => {
  if (r.mode === 'normal') {
    const best = m.minSpanOf(r.members);
    ok('normal order has a unique min span ' + r.id, best.starts.length >= 1, r.id);
    ok('members are pitch classes ' + r.id, r.members.every((p) => p >= 0 && p < 12));
  } else {
    const ghost = r.members.map((p) => (p + r.transpose) % 12);
    const common = m.commonTonesOf(r.members, ghost);
    ok('common tones non-empty ' + r.id, common.length > 0, r.id);
  }
});

/* ---------- 6. 曲式 ---------- */
const formRooms = rooms.filter((r) => r.kind === 'form');
ok('three form rooms', formRooms.length === 3, 'got ' + formRooms.length);

formRooms.forEach((r) => {
  const f = r.form;
  ok('form has bars ' + r.id, f.bars.length >= 8, r.id);
  ok('form bars have chord + melody ' + r.id,
    f.bars.every((b) => Array.isArray(b.chord) && b.chord.length >= 3 && Array.isArray(b.melody) && b.melody.length >= 1));
  ok('form tempo sane ' + r.id, f.tempo > 0.3 && f.tempo < 3);
  ok('form has closing ' + r.id, !!(f.closing && f.closing.length > 8));

  if (f.mode === 'boundary') {
    const sorted = f.boundaries.slice().sort((a, b) => a - b);
    ok('boundaries in range ' + r.id, sorted.every((b) => b > 0 && b < f.bars.length));
    ok('boundaries unique ' + r.id, new Set(sorted).size === sorted.length);
    ok('boundary prompt exists ' + r.id, !!f.boundaryPrompt);
  } else {
    /* 段落必须无缝覆盖全曲 */
    let cursor = 0;
    f.segments.forEach((s) => {
      ok('segment starts where previous ended ' + r.id, s.from === cursor, r.id + ' from=' + s.from + ' cursor=' + cursor);
      ok('segment has label in palette ' + r.id, Number.isInteger(s.label) && s.label >= 0 && s.label < f.labels.length);
      ok('segment explains itself ' + r.id, !!(s.why && s.why.length > 10));
      cursor = s.to + 1;
    });
    ok('segments cover the bars ' + r.id, cursor === f.bars.length, cursor + ' vs ' + f.bars.length);
    ok('labels carry descriptions ' + r.id, f.labels.every((l) => l.name && l.desc));
  }

  if (f.point) {
    ok('point inside bars ' + r.id, f.point.bar >= 0 && f.point.bar < f.bars.length);
    ok('point explains itself ' + r.id, !!(f.point.why && f.point.why.length > 6));
    ok('point has a name ' + r.id, !!f.point.name);
  }
});

/* ---------- 7. 结算文字 ---------- */
rooms.filter((r) => r.kind !== 'locked').forEach((r) => {
  ok('playable room has char ' + r.id, !!(r.char && r.line));
});

/* ---------- 8. 拼写：每个用到的音高都能反解回同一个 MIDI ---------- */
const NAT = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

m.LEVELS.forEach((lv) => {
  const all = lv.cantus.concat(lv.palette, lv.reference || []);
  all.forEach((midi) => {
    const info = m.spellingInfo(midi, lv.spell);
    const rebuilt = (info.octave + 1) * 12 + NAT[info.letter] + info.alter;
    ok('spelling round-trips ' + lv.id + ' midi=' + midi, rebuilt === midi,
      info.label + ' -> ' + rebuilt);
  });
});

/* 拼写表未覆盖时的兜底不能把音高显示成 C */
[1, 3, 6, 8, 10].forEach((pc) => {
  const info = m.spellingInfo(60 + pc, {});
  ok('fallback keeps pitch class ' + pc, NAT[info.letter] + info.alter === pc, info.label);
});

/* ---------- 9. 曲式判定：标准答案必过，典型错答必拒 ---------- */
const formRooms2 = rooms.filter((r) => r.kind === 'form');
formRooms2.forEach((r) => {
  const f = r.form;
  const good = {
    labels: {},
    boundaries: f.boundaries ? f.boundaries.slice() : [],
    point: f.point ? f.point.bar : null
  };
  if (f.mode !== 'boundary') f.segments.forEach((s, i) => { good.labels[i] = s.label; });

  const goodErrs = m.formJudge(r, good);
  ok('form standard answer passes ' + r.id, goodErrs.length === 0, goodErrs.join(' / '));

  if (f.mode === 'boundary') {
    const fewer = { labels: {}, boundaries: f.boundaries.slice(0, -1), point: good.point };
    ok('form rejects too few boundaries ' + r.id, m.formJudge(r, fewer).length > 0);
    const shifted = { labels: {}, boundaries: f.boundaries.map((b) => b + 1), point: good.point };
    ok('form rejects shifted boundaries ' + r.id, m.formJudge(r, shifted).length > 0);
  } else {
    const wrong = { labels: Object.assign({}, good.labels), boundaries: [], point: good.point };
    wrong.labels[0] = (f.segments[0].label + 1) % f.labels.length;
    ok('form rejects wrong label ' + r.id, m.formJudge(r, wrong).length > 0);

    const missing = { labels: Object.assign({}, good.labels), boundaries: [], point: good.point };
    delete missing.labels[f.segments.length - 1];
    ok('form rejects missing label ' + r.id, m.formJudge(r, missing).length > 0);
  }

  if (f.point) {
    const badPoint = {
      labels: Object.assign({}, good.labels),
      boundaries: good.boundaries,
      point: (f.point.bar + 1) % f.bars.length
    };
    ok('form rejects wrong point ' + r.id, m.formJudge(r, badPoint).length > 0);
  }
});

/* ---------- 10. 源码级守卫：过关必须真的记入校记 ---------- */
const src = fs.readFileSync(target, 'utf8');
ok('no dead onPass callback', !src.includes('onPass'));
const passCalls = (src.match(/passRoom\(room\)/g) || []).length;
ok('every playable kind calls passRoom', passCalls >= 6, 'found ' + passCalls);
ok('no submit path skips saving', src.indexOf("if (r.violations.length === 0) {\n    passRoom(room);") !== -1);

ok('tone guards non-finite midi', src.includes('if (!isFinite(midi)) return;'));
ok('scale listen explains the empty case', src.includes('先点几块石，再试听'));
ok('counterpoint listen explains the empty slot', src.includes('还空着，先放一个音再试听'));
ok('scale listen reports what it played', src.includes('正在试听：'));

/* ---------- 11. 新手引导覆盖 ---------- */
const playableRooms = rooms.filter((r) => r.kind !== 'locked');
ok('all playable rooms carry a guide', playableRooms.every((r) => !!r.guide), String(playableRooms.length));
playableRooms.forEach((r) => {
  ok('guide goal ' + r.id, !!(r.guide && r.guide.goal && r.guide.goal.length >= 8));
  ok('guide steps ' + r.id, !!(r.guide && Array.isArray(r.guide.steps) && r.guide.steps.length >= 2));
  ok('guide done ' + r.id, !!(r.guide && r.guide.done && r.guide.done.length >= 6));
});
ok('goals are room specific',
  new Set(playableRooms.map((r) => r.guide.goal)).size === playableRooms.length);
ok('mechanic help covers every kind',
  ['scale', 'counterpoint', 'harmony', 'set', 'pop', 'form', 'locked'].every((k) => !!m.MECHANIC_HELP[k]));
ok('locked rooms get auto guide', ['goal', 'steps', 'done'].every((k) => !!m.guideFor({ id: 'x', kind: 'locked' })[k]));

/* 提交前的空态反馈必须存在，不能静默失败 */
ok('submit reports what is missing', src.indexOf('setSubmitMsg') !== -1);
ok('counterpoint submit explains missing notes', src.indexOf('个音：点第') !== -1);
ok('scale submit explains missing stones', src.indexOf('块石：在环上继续点') !== -1);
ok('set submit explains missing start', src.indexOf('先选一个起点：点一个已经亮的音') !== -1);
ok('form submit surfaces first error', src.indexOf('setSubmitMsg(errs[0])') !== -1);
ok('help modal is reopenable', src.indexOf('function openHelp') !== -1 && src.indexOf("$('btnHelp')") !== -1);
ok('mission card is built per room', src.indexOf('function buildMission') !== -1);
ok('action bar separates listen and submit', src.indexOf("group('先听材料')") !== -1 && src.indexOf("group('提交验收')") !== -1);

/* ---------- 12. 落地页、路由与存档 ---------- */
ok('route: empty save goes to landing', m.routeOnBoot({}) === 'landing');
ok('route: started goes to map', m.routeOnBoot({ started: true }) === 'map');
ok('route: progress without flag goes to map', m.routeOnBoot({ cleared: { x: true } }) === 'map');
ok('route: signed goes to map', m.routeOnBoot({ signed: 'n' }) === 'map');
ok('route: room restores', m.routeOnBoot({ started: true, view: 'room', roomId: 'r-cp1' }) === 'room');
ok('route: unknown room falls back to map', m.routeOnBoot({ started: true, view: 'room', roomId: 'nope' }) === 'map');
ok('route: landing stays landing', m.routeOnBoot({ started: true, view: 'landing' }) === 'landing');
ok('cta: first visit', m.ctaLabel(false) === '开始旅程');
ok('cta: has save', m.ctaLabel(true) === '继续旅程');

const html = fs.readFileSync(path.join(path.dirname(target), 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(path.dirname(target), 'styles.css'), 'utf8');

ok('landing markup exists', html.indexOf('id="viewLanding"') !== -1);
ok('landing has primary cta', html.indexOf('id="btnStart"') !== -1);
ok('landing explains identity', html.indexOf('记谱学徒') !== -1);
ok('landing states the overall goal', html.indexOf('六页校记') !== -1);
ok('landing explains the five verbs',
  ['拼', '补', '平', '测', '听'].every((v) => html.indexOf('<b>' + v + '</b>') !== -1));
ok('landing has sound hint', html.indexOf('不会自动发声') !== -1);
ok('landing has district preview', html.indexOf('id="landingDistrictList"') !== -1);
ok('reset needs a second click', html.indexOf('id="btnResetYes"') !== -1 && html.indexOf('id="btnResetNo"') !== -1);
ok('reset confirm starts hidden', /id="resetConfirm"[^>]*hidden/.test(html));
ok('map can go back to landing', html.indexOf('id="btnLanding"') !== -1);

const bootBody = (src.match(/function boot\(\)[\s\S]*?\n}/) || [''])[0];
ok('boot never starts audio', bootBody.indexOf('ensureAudio') === -1, bootBody.slice(0, 80));
ok('reset is only reachable through confirm',
  src.indexOf("$('btnReset').addEventListener('click', function () { $('resetConfirm').hidden = false") !== -1);
ok('hidden attribute always hides', css.indexOf('[hidden]{display:none') !== -1);

/* ---------- 13. 调性罗盘 ---------- */
ok('compass: C to A is 3', m.compassDistance({ pc: 0, mode: 'M' }, { pc: 9, mode: 'M' }) === 3);
ok('compass: C to f-sharp minor is 4', m.compassDistance({ pc: 0, mode: 'M' }, { pc: 6, mode: 'm' }) === 4);
ok('compass: same key is 0', m.compassDistance({ pc: 3, mode: 'm' }, { pc: 3, mode: 'm' }) === 0);
ok('compass: distance is symmetric',
  [[{ pc: 0, mode: 'M' }, { pc: 9, mode: 'M' }], [{ pc: 2, mode: 'm' }, { pc: 7, mode: 'M' }]]
    .every((p) => m.compassDistance(p[0], p[1]) === m.compassDistance(p[1], p[0])));
ok('compass: three moves', m.compassNeighbors({ pc: 0, mode: 'M' }).length === 3);
ok('compass: relative of C is a minor',
  m.compassNeighbors({ pc: 0, mode: 'M' }).some((n) => n.via === 'relative' && n.mode === 'm' && n.pc === 9));
ok('compass rooms exist', rooms.filter((r) => r.kind === 'compass').length >= 1);

/* ---------- 14. 化身、印记与推荐 ---------- */
ok('six district marks', Object.keys(m.DISTRICT_MARK).length === 6);
ok('marks match districts', districts.every((d) => !!m.DISTRICT_MARK[d.id]));
ok('next: first room of current district', m.nextRecommended({ district: 'quarry', cleared: {} }) === 'r-c-major');
ok('next: skips cleared rooms', m.nextRecommended({ district: 'quarry', cleared: { 'r-c-major': true } }) === 'r-meter');
const quarryAll = {};
rooms.filter((r) => r.district === 'quarry' && r.kind !== 'locked').forEach((r) => { quarryAll[r.id] = true; });
ok('next: moves to another district', m.nextRecommended({ district: 'quarry', cleared: quarryAll }) === 'r-cp1');
const allCleared = {};
rooms.filter((r) => r.kind !== 'locked').forEach((r) => { allCleared[r.id] = true; });
ok('next: none left when all cleared', m.nextRecommended({ district: 'quarry', cleared: allCleared }) === null);

ok('avatar creator exists', src.indexOf('function renderCreator') !== -1);
ok('avatar renders as svg', src.indexOf('function avatarSVG') !== -1);
ok('avatar has five option rows', ['体态', '发型', '肤色', '衣服', '符号'].every((k) => src.indexOf("'" + k + "'") !== -1));
ok('hints are tiered', src.indexOf('hintTier') !== -1 && src.indexOf('function useHint') !== -1);
ok('hint refuses to give the answer', src.indexOf('我不替你看') !== -1);
ok('record beat has four choices', ['修正', '保留', '并记', '留白'].every((k) => src.indexOf("key: '" + k + "'") !== -1));
ok('ending personalises', src.indexOf('sealBadge') !== -1 && src.indexOf('record-summary') !== -1);
ok('back button uses clearRoom', src.indexOf('if (room) { clearRoom(room); return; }') !== -1);

/* ---------- 15. 随机化身 ---------- */
const av1 = m.makeAvatar(12345);
const av2 = m.makeAvatar(12345);
ok('avatar: same seed gives same look', JSON.stringify(av1) === JSON.stringify(av2));
ok('avatar: body in range', av1.body >= 0 && av1.body < 3);
ok('avatar: hair in range', av1.hair >= 0 && av1.hair < 4);
ok('avatar: skin in range', av1.skin >= 0 && av1.skin < 4);
ok('avatar: cloth in range', av1.cloth >= 0 && av1.cloth < 4);
ok('avatar: seal in range', av1.seal >= 0 && av1.seal < 6);

let allLegal = true;
const looks = new Set();
for (let seed = 0; seed < 500; seed++) {
  const a = m.makeAvatar(seed);
  looks.add(JSON.stringify(a));
  if (!(a.body >= 0 && a.body < 3 && a.hair >= 0 && a.hair < 4 && a.skin >= 0 && a.skin < 4 &&
        a.cloth >= 0 && a.cloth < 4 && a.seal >= 0 && a.seal < 6)) allLegal = false;
}
ok('avatar: 500 seeds are all legal', allLegal);
ok('avatar: seeds produce variety', looks.size > 20, 'distinct=' + looks.size);

ok('avatar: generated when missing',
  src.indexOf('if (state.avatar) return;') !== -1 && src.indexOf('state.avatar = makeAvatar(state.avatarSeed)') !== -1);
ok('avatar: reroll keeps a new seed', src.indexOf('function randomizeAvatar()') !== -1);
ok('avatar: reroll button is secondary', src.indexOf("reroll.textContent = '换一个随机形象'") !== -1);
ok('avatar: creator no longer gates first entry',
  src.indexOf('!state.avatarConfirmed') === -1);
ok('avatar: clearing progress resets it', src.indexOf('state.avatarSeed = null;') !== -1);

/* ---------- 16. 节奏桥梁 ---------- */
const rhythmRooms = rooms.filter((r) => r.kind === 'rhythm');
ok('two rhythm rooms', rhythmRooms.length === 2, 'got ' + rhythmRooms.length);
rhythmRooms.forEach((r) => {
  ok('rhythm has meter ' + r.id, !!r.rhythm.meter);
  ok('rhythm bars positive ' + r.id, r.rhythm.bars >= 1);
  ok('rhythm ticks match meter ' + r.id,
    r.rhythm.ticksPerBar === r.rhythm.groups.reduce((a, b) => a + b, 0));
  ok('rhythm palette inside bar ' + r.id, r.rhythm.palette.every((t) => t > 0 && t <= r.rhythm.ticksPerBar));
  ok('rhythm requires a first onset ' + r.id, r.rhythm.requireOnsets.indexOf(0) !== -1);
});

const roomA = rhythmRooms.find((r) => r.id === 'r-meter');
const roomB = rhythmRooms.find((r) => r.id === 'r-meter2');

function mk(len, rest) { return { len: len, rest: !!rest }; }
function bars(spec) { return spec.map((b) => b.map((x) => (typeof x === 'number' ? mk(x) : mk(x[0], x[1])))); }

ok('A: four quarters per bar passes',
  m.judgeRhythm(roomA, bars([[4, 4, 4, 4], [4, 4, 4, 4]])).ok === true);
ok('A: eighths then quarters also passes (equivalent notation)',
  m.judgeRhythm(roomA, bars([[2, 2, 4, 4, 4], [4, 4, 4, 4]])).ok === true);
ok('A: a half note alone misses beat 2', m.judgeRhythm(roomA, bars([[8, 8], [4, 4, 4, 4]])).ok === false);
ok('A: mixed values pass (equivalent notation)',
  m.judgeRhythm(roomA, bars([[4, 2, 2, 4, 4], [4, 4, 2, 2, 4]])).ok === true);
ok('A: rests count toward the bar',
  m.judgeRhythm(roomA, bars([[4, [4, 1], 4, 4], [4, 4, 4, 4]])).ok === true);

const shortA = m.judgeRhythm(roomA, bars([[4, 4, 4], [4, 4, 4, 4]]));
ok('A: incomplete is reported with a deficit', !shortA.ok && shortA.first.code === 'INCOMPLETE' && shortA.errors[0].deficit === 4);
const overA = m.judgeRhythm(roomA, bars([[8, 8, 8], [4, 4, 4, 4]]));
ok('A: overflow is reported with an excess', !overA.ok && overA.first.code === 'OVERFLOW' && overA.errors[0].excess === 8);
const groupA = m.judgeRhythm(roomA, bars([[8, 8], [8, 4, 4]]));
ok('A: legal total but missing a beat onset is GROUPING', !groupA.ok && groupA.first.code === 'GROUPING' && groupA.errors[0].at === 4);
ok('A: crossing a beat is allowed', m.judgeRhythm(roomA, bars([[2, 2, 4, 4, 4], [4, 4, 4, 4]])).errors.filter((e) => e.code === 'CROSS').length === 0);

ok('B: two dotted quarters per bar passes',
  m.judgeRhythm(roomB, bars([[6, 6], [6, 6]])).ok === true);
ok('B: quarter+eighth grouped per beat also passes',
  m.judgeRhythm(roomB, bars([[4, 2, 6], [2, 4, 6]])).ok === true);
const crossB = m.judgeRhythm(roomB, bars([[8, 4], [6, 6]]));
ok('B: a note crossing the group boundary is CROSS', !crossB.ok && crossB.first.code === 'CROSS' && crossB.errors[0].at === 6);
const groupB = m.judgeRhythm(roomB, bars([[4, 4, 4], [6, 6]]));
ok('B: no onset on the second group is GROUPING', !groupB.ok && groupB.errors.some((e) => e.code === 'GROUPING' && e.at === 6));

const listenState = { bars: bars([[4, 4, 4, 4], [4, 4, 4, 4]]), listened: false };
ok('submit: listening is required even when the bridge is full',
  m.rhythmSubmitCheck(roomA, listenState).code === 'NEED_LISTEN');
ok('submit: full bridge plus listening passes',
  m.rhythmSubmitCheck(roomA, { bars: listenState.bars, listened: true }).ok === true);
ok('submit: incomplete bridge is refused',
  m.rhythmSubmitCheck(roomA, { bars: bars([[4, 4], [4, 4, 4, 4]]), listened: true }).ok === false);

/* 存档迁移：印记粘性，旧档不被撤销终局资格 */
ok('ending: all seals grants the ending', m.endingEligible({ seals: { quarry: 1, masonry: 1, hall: 1, works: 1, frontier: 1, market: 1 } }) === true);
ok('ending: a missing seal blocks it', m.endingEligible({ seals: { quarry: 1, masonry: 1, hall: 1, works: 1, frontier: 1 } }) === false);
ok('ending: an old save keeps eligibility after new rooms are added',
  m.endingEligible({ seals: { quarry: 1, masonry: 1, hall: 1, works: 1, frontier: 1, market: 1 }, cleared: {} }) === true);

ok('rhythm state is persisted', src.indexOf('rhythm: state.rhythm') !== -1);
ok('rhythm tiles are real buttons', src.indexOf("b.type = 'button'") !== -1 && src.indexOf('rp-tile') !== -1);
ok('rhythm has no drag dependency', src.indexOf('dragstart') === -1);

console.log('passed: ' + pass + '  failed: ' + fail);
if (fail) {
  failures.slice(0, 20).forEach((f) => console.log('  FAIL ' + f));
  process.exit(1);
}
