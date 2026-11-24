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

ok('record beat hands over to the ending', src.indexOf('if (endingEligible() && !state.signed) setTimeout(showEnding, 320);') !== -1);

/* ---------- 17. 音频状态机（可注入 mock） ---------- */
function mockCtor(opts) {
  opts = opts || {};
  function Ctx() {
    if (opts.throwOnCreate) throw new Error('boom');
    this.state = opts.initial || 'suspended';
    this.ls = [];
    Ctx.instances.push(this);
  }
  Ctx.instances = [];
  Ctx.prototype.addEventListener = function (ev, fn) { this.ls.push(fn); };
  Ctx.prototype.resume = function () {
    var self = this;
    if (opts.resumeReject) return { then: function (ok, err) { var e = new Error('blocked'); e.name = 'NotAllowedError'; err(e); } };
    return { then: function (ok) { self.state = 'running'; ok(); } };
  };
  Ctx.prototype.fire = function (s) { this.state = s; this.ls.forEach(function (f) { f(); }); };
  return Ctx;
}

const A1 = mockCtor({});
const c1 = m.createAudioController({ Ctor: A1, now: (function () { var t = 1000; return function () { return ++t; }; })() });
c1.init();
ok('audio: starts at needs-gesture', c1.state.state === 'needs-gesture');
const ctx1 = c1.unlock();
ok('audio: unlock creates a context', !!ctx1 && c1.state.created === 1);
ok('audio: resume success becomes ready', c1.state.state === 'ready');
ok('audio: enable time is recorded', c1.state.lastEnabledAt > 0);
c1.unlock();
ok('audio: repeated unlock does not create another context', c1.state.created === 1);

const A2 = mockCtor({ resumeReject: true });
const c2 = m.createAudioController({ Ctor: A2 });
c2.init(); c2.unlock();
ok('audio: resume rejection becomes failed', c2.state.state === 'failed');
ok('audio: failure keeps a safe summary', /resume:/.test(c2.state.lastError || '') && (c2.state.lastError || '').indexOf('NotAllowedError') !== -1);

const A3 = mockCtor({});
const c3 = m.createAudioController({ Ctor: A3 });
c3.init();
c3.unlock();
const ctx3 = A3.instances[0];
ctx3.fire('suspended');
ok('audio: statechange suspended is reflected', c3.state.state === 'suspended');
ctx3.fire('interrupted');
ok('audio: interrupted is treated as suspended', c3.state.state === 'suspended');
ctx3.fire('closed');
ok('audio: closed is treated as failed', c3.state.state === 'failed');

const A4 = mockCtor({ throwOnCreate: true });
const c4 = m.createAudioController({ Ctor: A4 });
c4.init();
ok('audio: constructor throw returns null', c4.unlock() === null);
ok('audio: constructor throw is recorded', c4.state.state === 'failed' && /create:/.test(c4.state.lastError || ''));

const c5 = m.createAudioController({ Ctor: undefined });
c5.init();
ok('audio: unsupported is detected', c5.state.state === 'unsupported');
ok('audio: unsupported unlock returns null', c5.unlock() === null);

const A6 = mockCtor({ initial: 'running' });
const c6 = m.createAudioController({ Ctor: A6 });
c6.init();
c6.unlock();
ok('audio: already-running context goes straight to ready', c6.state.state === 'ready');

c1.markTested();
ok('audio: test time recorded and hearing resets', c1.state.lastTestAt > 0 && c1.state.heard === null);
c1.markHeard('no');
ok('audio: hearing can be recorded as no', c1.state.heard === 'no');
c1.markHeard('yes');
ok('audio: hearing can be recorded as yes', c1.state.heard === 'yes');

const c7 = m.createAudioController({ Ctor: mockCtor({}) });
c7.init();
ok('audio: refresh without a context keeps needs-gesture', c7.refresh().state === 'needs-gesture');

/* 静态扫描：没有外部音频文件或 CDN 依赖 */
const fullSrc = src + html;
ok('audio: no <audio> element', fullSrc.indexOf('<audio') === -1);
ok('audio: no audio file references', !/\.(mp3|wav|ogg|m4a|aac)\b/i.test(fullSrc));
ok('audio: no audio fetch', !/fetch\([^)]*\.(mp3|wav|ogg)/i.test(fullSrc));
ok('audio: single audio gate', src.indexOf('function ensureAudio()') !== -1 && src.indexOf('audioCtl.unlock()') !== -1);
ok('audio: no second AudioContext creation', (src.match(/new Ctor\(\)/g) || []).length === 1);

/* ---------- 18. 首胜、对照听与触控 ---------- */
const playableAll = rooms.filter((r) => r.kind !== 'locked');
ok('reference: every playable room has a plan',
  playableAll.every((r) => !!m.referencePlan(r)),
  playableAll.filter((r) => !m.referencePlan(r)).map((r) => r.id).join(','));

const rhythmRooms2 = rooms.filter((r) => r.kind === 'rhythm');
rhythmRooms2.forEach((r) => {
  ok('reference: rhythm answer fills each bar ' + r.id,
    r.rhythm.answer.length === r.rhythm.bars && r.rhythm.answer.every((b) => b.reduce((a, p) => a + p.len, 0) === r.rhythm.ticksPerBar));
  ok('reference: rhythm answer is legal ' + r.id, m.judgeRhythm(r, r.rhythm.answer).ok === true);
});

ok('warmup overlay exists', html.indexOf('id="warmupVeil"') !== -1);
ok('warmup can be skipped', html.indexOf('id="warmupSkip"') !== -1);
ok('warmup shows once then persists', src.indexOf('warmupDone') !== -1 && src.indexOf('if (!state.warmupDone) openWarmup();') !== -1);
ok('compare button only after a failure', src.indexOf('if (roomHasFailure(room))') !== -1 && src.indexOf("bar.compare(mkBtn('先听你写的，再听修好的'") !== -1);
ok('touch targets are at least 44px',
  css.indexOf('.btn{min-height:44px}') !== -1 && css.indexOf('.pitch{min-height:44px}') !== -1 &&
  css.indexOf('.rp-tile{min-height:44px') !== -1 && css.indexOf('.swatch{min-height:44px') !== -1);

/* ---------- 19. A/B/C 增强 ---------- */
const cpRoom = rooms.find((r) => r.kind === 'counterpoint');
const rhythmRoom = rooms.find((r) => r.kind === 'rhythm');
const harmonyRoom = rooms.find((r) => r.kind === 'harmony');

const scaleRoom = rooms.find((r) => r.kind === 'scale');
ok('A: untouched rooms have no first difference', m.firstDiffOf(scaleRoom) === null);
ok('A: own playback exists for compare', typeof m.playOwn === 'function' && typeof m.playCompare === 'function');
ok('A: compare label separates the two listens', src.indexOf('先听你写的，再听修好的') !== -1);
ok('A: difference is marked on the score', src.indexOf("if (opts.diff) cls += ' is-diff'") !== -1);
ok('A: difference is marked on the bar', src.indexOf("state.diff.bar === bi ? ' is-diff'") !== -1);
ok('A: difference is marked on the chord', src.indexOf("state.diff.rn === o.rn ? ' is-diff'") !== -1);
ok('A: reference playback is reused, not duplicated',
  (src.match(/function playReference\(/g) || []).length === 1);

ok('B: detune grows with pending districts', m.droneDetuneCents(0) < m.droneDetuneCents(3));
ok('B: detune is capped', m.droneDetuneCents(99) <= 16);
ok('B: pending districts counts unsealed ones', m.pendingDistricts({ seals: {} }) === 6);
ok('B: sealed districts are excluded', m.pendingDistricts({ seals: { quarry: true } }) === 5);
ok('B: drone stops when leaving the map', src.indexOf("function renderRoom() {\n  stopFormAnim();\n  stopDrone();") !== -1);
ok('B: drone stops when the page is hidden', src.indexOf("document.visibilityState === 'hidden') stopDrone()") !== -1);
ok('B: drone reuses the single audio gate', src.indexOf('var c = ensureAudio();\n  if (!c) return false;\n  stopDrone();') !== -1);
ok('B: unsupported audio still shows text', src.indexOf('这个浏览器不支持实时合成') !== -1);

ok('C: diploma facts carry six marks', m.diplomaFacts({ signed: '甲', seals: {}, cleared: {}, records: {} }).marks.length === 6);
ok('C: diploma facts carry six records', m.diplomaFacts({}).records.length === 6);
ok('C: blank signature stays blank', m.diplomaFacts({}).name === '（留白）');
ok('C: signed name is used', m.diplomaFacts({ signed: '甲' }).name === '甲');
ok('C: diploma has a print entry', src.indexOf('function printDiploma') !== -1);
ok('C: diploma can be downloaded', src.indexOf('function downloadDiploma') !== -1);
ok('C: diploma sends nothing to a server', src.indexOf('fetch(') === -1 && src.indexOf('XMLHttpRequest') === -1);
ok('C: print hides the app shell', css.indexOf('.desk{display:none !important}') !== -1);

/* ---------- 20. 掌握度与三关巡演 ---------- */
const playable = rooms.filter((r) => r.kind !== 'locked');

// 三层转移：只升不降，靠提示与违规证据判定
ok('M: clean main pass is proficient', m.masteryAfterPass(null, { hints: 0, faults: 0 }, false) === 'proficient');
ok('M: hinted pass is understanding', m.masteryAfterPass(null, { hints: 2, faults: 0 }, false) === 'understand');
ok('M: faulted pass is understanding', m.masteryAfterPass(null, { hints: 0, faults: 3 }, false) === 'understand');
ok('M: clean tour pass reaches transfer', m.masteryAfterPass('proficient', { hints: 0, faults: 0 }, true) === 'transfer');
ok('M: hinted tour pass cannot reach transfer', m.masteryAfterPass('proficient', { hints: 1, faults: 0 }, true) === 'proficient');
ok('M: tour pass moves at most one step', m.masteryAfterPass('understand', { hints: 0, faults: 0 }, true) === 'proficient');
ok('M: transfer is never downgraded', m.masteryAfterPass('transfer', { hints: 9, faults: 9 }, true) === 'transfer');
ok('M: repeated passes alone do not upgrade',
  m.masteryAfterPass('understand', { hints: 0, faults: 1 }, false) === 'understand');
ok('M: mastery is not derived from clear count',
  src.indexOf('masteryAfterPass') !== -1 && src.indexOf('clearedCount') === -1);

const mstate = { cleared: {}, mastery: {}, tourRuns: 0 };
playable.slice(0, 5).forEach((r) => { mstate.cleared[r.id] = true; });
mstate.mastery[playable[0].id] = 'understand';
mstate.mastery[playable[1].id] = 'proficient';
const mc = m.masteryCounts(mstate);
ok('M: counts understanding', mc.understand === 1, JSON.stringify(mc));
ok('M: counts proficiency', mc.proficient === 1, JSON.stringify(mc));
ok('M: uncleared rooms are not counted', mc.transfer === 0 && mc.none === 3, JSON.stringify(mc));

// 三关生成：不足三间给空态，不硬凑
const thin = { cleared: {}, mastery: {}, tourRuns: 0 };
thin.cleared[playable[0].id] = true;
thin.cleared[playable[1].id] = true;
const thinPlan = m.buildTour(thin);
ok('T: fewer than three cleared rooms gives an empty state', thinPlan.ok === false && thinPlan.have === 2);
ok('T: empty state says what is missing', src.indexOf('还不能巡演') !== -1);

const plan = m.buildTour(mstate);
ok('T: three rooms are planned', plan.ok === true && plan.rooms.length === 3, JSON.stringify(plan));
ok('T: planned rooms are unique', new Set(plan.rooms).size === 3);
ok('T: every planned room is already cleared',
  plan.rooms.every((id) => mstate.cleared[id]));
ok('T: every planned room is playable',
  plan.rooms.every((id) => playable.some((r) => r.id === id)));
const weakRoom = playable.find((r) => r.id === plan.rooms[0]);
const weakestRank = Math.min.apply(null, playable.filter((r) => mstate.cleared[r.id]).map((r) => m.masteryOf(mstate, r.id) ? m.masteryAfterPass(m.masteryOf(mstate, r.id), { hints: 0, faults: 0 }, false) && 0 : 0));
ok('T: weak slot holds a low-mastery room',
  !m.masteryOf(mstate, weakRoom.id) || m.masteryOf(mstate, weakRoom.id) === 'understand', String(m.masteryOf(mstate, weakRoom.id)));
ok('T: proficient slot holds a proficient room',
  plan.slots[1] === 'proficient' && mstate.mastery[plan.rooms[1]] === 'proficient');
const crossRoom = playable.find((r) => r.id === plan.rooms[2]);
ok('T: cross slot is a different room', crossRoom.id !== weakRoom.id && crossRoom.id !== plan.rooms[1]);
ok('T: cross slot prefers another district when one exists',
  !playable.filter((r) => mstate.cleared[r.id] && r.district !== weakRoom.district).length ||
  crossRoom.district !== weakRoom.district);

// 确定性：同样的存档必得同样的三关，避免随机出无解题
const planAgain = m.buildTour(JSON.parse(JSON.stringify(mstate)));
ok('T: the same save always yields the same tour', JSON.stringify(planAgain) === JSON.stringify(plan));

// 受控变化：换一轮只轮换起点，题面仍来自已验证房间
const rotated = Object.assign({}, mstate, { tourRuns: 1 });
const planB = m.buildTour(rotated);
ok('T: a new round varies the tour', JSON.stringify(planB.rooms) !== JSON.stringify(plan.rooms));
ok('T: variation still only uses cleared rooms',
  planB.rooms.every((id) => mstate.cleared[id]) && new Set(planB.rooms).size === 3);

// 退出与恢复
ok('T: tour progress is persisted', src.indexOf('mastery: state.mastery, evidence: state.evidence, tour: state.tour') !== -1);
ok('T: tour can be left without losing progress',
  src.indexOf('function leaveTour') !== -1 && src.indexOf('state.tour.active = false') !== -1);
ok('T: a paused tour survives a reload', src.indexOf('if (d.tour && Array.isArray(d.tour.rooms)') !== -1);
ok('T: tour can be resumed', src.indexOf('function resumeTour') !== -1 && src.indexOf('继续巡演') !== -1);
ok('T: summary lists hints and mastery changes',
  src.indexOf('提示一共用了') !== -1 && src.indexOf('掌握变化') !== -1);
ok('T: summary gives a next suggestion', src.indexOf('下一步建议') !== -1);

// 音频不可用时巡演只走文字
const summarySrc = src.slice(src.indexOf('function tourSummary'), src.indexOf('function endTour'));
ok('T: tour summary does not touch audio', summarySrc.indexOf('ensureAudio') === -1 && summarySrc.indexOf('AudioContext') === -1);
ok('T: tour bar is text only', src.indexOf('function renderTourBar') !== -1 && src.indexOf("label.className = 'tour-bar-text'") !== -1);

// 亲和度：结算先说做了什么，再给规则出处
ok('F: verdict shows mastery evidence', src.indexOf("'掌握 · ' + MASTERY_LABEL") !== -1);
ok('F: diploma carries mastery counts', m.diplomaFacts({ cleared: {}, mastery: {} }).mastery !== undefined);
ok('F: district panel shows local mastery', src.indexOf('这一区：理解') !== -1);


/* ---------- 21. 亲和度收尾 ---------- */
const fault = m.faultNarrative;
ok('F: no narrative without a failure', fault({ kind: 'counterpoint' }, null) === null);
const cpNarr = fault({ kind: 'counterpoint' }, { slot: 8, label: '第 9 音 · FS-CAD' });
ok('F: narrative says what the player did', /你刚把这一列的对位音逐格填满了/.test(cpNarr), cpNarr);
ok('F: narrative names where it broke', /断在/.test(cpNarr) && /FS-CAD/.test(cpNarr), cpNarr);
ok('F: narrative points to the rule source', /规则/.test(cpNarr), cpNarr);
ok('F: narrative does not leak the whole answer', cpNarr.indexOf('参考解') === -1);
const rhythmNarr = fault({ kind: 'rhythm' }, { bar: 2, label: '第 3 小节 · M-SUM' });
ok('F: rhythm narrative uses bar number', /第 3 小节/.test(rhythmNarr), rhythmNarr);

ok('F: first two rooms carry a plain-language gloss', playable.slice(0, 2).every((r) => !!r.plain));
ok('F: gloss avoids unexplained jargon first', /石头 = 一个音高/.test(playable[0].plain || ''));
ok('F: gloss is rendered in the mission card', src.indexOf("plain.className = 'mission-plain'") !== -1);
ok('F: fault note is rendered first in the mark list', src.indexOf("nl.className = 'fault-note'") !== -1);

const cardFacts = m.roomCardFacts({ signed: '甲', mastery: { 'r-c-major': 'proficient' }, records: {} }, 'r-c-major');
ok('F: room card knows the room', cardFacts.room === '十二块石头', JSON.stringify(cardFacts));
ok('F: room card carries mastery', cardFacts.level === '熟练');
ok('F: room card carries a record slot', !!cardFacts.record);
ok('F: room card keeps a blank signature blank', m.roomCardFacts({}, 'r-c-major').name === '（留白）');
ok('F: unknown room gives no card', m.roomCardFacts({}, 'nope') === null);
ok('F: room card can be downloaded', src.indexOf('function downloadRoomCard') !== -1);
ok('F: room card sends nothing to a server', src.indexOf('fetch(') === -1);
ok('F: room card is offered on the pass sheet', src.indexOf('存这张校记卡') !== -1);

/* ---------- 22. 生产反馈三项 ---------- */
// 1) 地图 Avatar 不拦截交互，节点可键盘操作
ok('M1: map avatar cannot capture pointer events',
  src.indexOf("'pointer-events': 'none', 'aria-hidden': 'true'") !== -1);
ok('M1: map avatar still renders', src.indexOf("holder.className = 'map-avatar'") !== -1);
ok('M1: district nodes are focusable buttons',
  src.indexOf("tabindex: '0', role: 'button'") !== -1);
ok('M1: district nodes carry an accessible name', src.indexOf("g.setAttribute('aria-label', d.name") !== -1);
ok('M1: district nodes answer Enter and Space',
  src.indexOf("ev.key !== 'Enter' && ev.key !== ' '") !== -1);

// 2) 结算后的下一关 CTA
const s1 = { cleared: {}, pendingRecord: null };
const first = playable[0];
ok('N: next room is the first uncleared one', m.nextPlayableAfter(first, s1).id === playable[1].id);
ok('N: cleared rooms are skipped',
  m.nextPlayableAfter(first, { cleared: { [playable[1].id]: true } }).id === playable[2].id);
const everyCleared = {}; playable.forEach((r) => { everyCleared[r.id] = true; });
ok('N: no next room at the end', m.nextPlayableAfter(playable[playable.length - 1], { cleared: everyCleared }) === null);
ok('N: locked rooms are never proposed',
  m.nextPlayableAfter(first, { cleared: {} }).kind !== 'locked');
ok('N: label names the next room', m.nextLabelFor(first, { cleared: {} }) === '下一关：' + playable[1].title);
ok('N: label asks for the record first', m.nextLabelFor(first, { cleared: {}, pendingRecord: 'quarry' }) === '记这一区的校记');
ok('N: label falls back to the map', m.nextLabelFor(playable[playable.length - 1], { cleared: everyCleared }) === '回到环城');
ok('N: pass sheet carries the next-room button', src.indexOf("nextLabelFor(thisRoom), 'btn btn-ink'") !== -1);
ok('N: record sheet is not skipped by the shortcut', src.indexOf('if (pending || !next || ending) { clearRoom(room); return; }') !== -1);
ok('N: ending still wins over jumping ahead', src.indexOf('endingEligible(state) && !state.signed') !== -1);

// 3) 节奏房试听：骨架独立、空白不静默
ok('R: skeleton plays without any answer', typeof m.playRhythmSkeleton === 'function');
ok('R: skeleton covers every tick', src.indexOf('for (var tick = 0; tick < per; tick++)') !== -1);
ok('R: skeleton button is separate from own playback', src.indexOf("mkBtn('听骨架'") !== -1 && src.indexOf("mkBtn('听你铺的'") !== -1);
ok('R: empty answer is detected before playing', typeof m.rhythmHasContent === 'function');
ok('R: empty click explains itself', src.indexOf('桥还是空的，先点「听骨架」听节拍') !== -1);
ok('R: audio gate failure is visible', src.indexOf('声音没起来：浏览器还没解锁音频') !== -1);
ok('R: mission card matches the new button', src.indexOf('先点「听骨架」') !== -1);
ok('R: old wording is gone', src.indexOf('先点「试听整段」') === -1);

console.log('passed: ' + pass + '  failed: ' + fail);
if (fail) {
  failures.slice(0, 20).forEach((f) => console.log('  FAIL ' + f));
  process.exit(1);
}
