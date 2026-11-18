/* 《适航》权威验证入口 v2
   1) 在真实引擎上重跑主线与三条失败分支，断言核心循环、门序、结局与重开；
   2) 校验浏览器实机记录与当前构建哈希一致、截图存在且非空；
   3) 整份重写 qa/verification.json（失败时同样重写，不残留旧 PASS）。
*/
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = existsSync(resolve(ROOT, 'engine.js'))
  ? resolve(ROOT, 'engine.js')
  : resolve(ROOT, 'artifacts/engine.js');
const E = require(ENGINE);
const C = E.CONFIG;
const failures = [];

const assert = (cond, msg) => { if (!cond) failures.push(msg); };

// 兼容两种布局：仓库内（游戏根目录）与会话工作区（artifacts/ 子目录）
function asset(name) {
  const direct = resolve(ROOT, name);
  if (existsSync(direct)) return direct;
  return resolve(ROOT, 'artifacts', name);
}
function buildHash() {
  const files = ['index.html', 'engine.js', 'ui.js', 'game.css', 'codex.js'];
  const h = createHash('sha256');
  for (const f of files) h.update(readFileSync(asset(f)));
  return h.digest('hex').slice(0, 16);
}

function fillAll(s) {
  let guard = 0;
  while (guard++ < 60) {
    let moved = false;
    for (const d of E.DEPTS) {
      if (E.deptLeft(s, d.id) <= 0) continue;
      const cands = E.worksByDept(d.id, s)
        .filter((w) => !E.workDone(s, w.id) && E.canAssign(s, w.id).ok)
        .sort((a, b) => E.workProgress(s, b.id) - E.workProgress(s, a.id));
      if (!cands.length) continue;
      if (E.assignWork(s, cands[0].id).ok) moved = true;
    }
    if (!moved) break;
  }
}

function play(policy) {
  const s = E.newGame({ seed: 20260419, seat: 'main', route: 'clean' });
  while (!s.ending && s.turn <= C.maxTurn) {
    policy(s, s.turn);
    fillAll(s);
    E.commit(s);
  }
  return s;
}

const mainPolicy = (s, t) => {
  if (t === 1) E.setFinance(s, 'gov');
  if (t === 2) E.buyEngines(s, 24);
  if (t === 3) s.offers.forEach((o) => { if (o.open && !o.decided && o.id === 'alt') E.decideOffer(s, o.id, true); });
  if (t === 4) { E.requestExpand(s); E.requestHire(s, 'design'); E.requestHire(s, 'mfg'); }
  if (t === 5) { E.requestHire(s, 'test'); E.requestHire(s, 'cert'); }
  if (t === 6) E.buyEngines(s, 48);
  if (t === 7) E.requestHire(s, 'flight');
  if (t === 8) s.offers.forEach((o) => { if (o.open && !o.decided && o.id === 'blb') E.decideOffer(s, o.id, true); });
  if (t === 10) s.offers.forEach((o) => { if (o.open && !o.decided && o.id === 'ocn') E.decideOffer(s, o.id, true); });
  if (t === 11) E.buyEngines(s, 48);
};

const noHire = (s, t) => {
  if (t === 1) E.setFinance(s, 'gov');
  if (t === 2) E.buyEngines(s, 24);
  if (t === 3) s.offers.forEach((o) => { if (o.open && !o.decided && o.id === 'alt') E.decideOffer(s, o.id, true); });
  if (t === 4) E.requestExpand(s);
  if (t === 6) E.buyEngines(s, 48);
  if (t === 8) s.offers.forEach((o) => { if (o.open && !o.decided && o.id === 'blb') E.decideOffer(s, o.id, true); });
};

const noFlight = (s, t) => {
  if (t === 1) E.setFinance(s, 'gov');
  if (t === 2) E.buyEngines(s, 24);
  if (t === 3) s.offers.forEach((o) => { if (o.open && !o.decided && o.id === 'alt') E.decideOffer(s, o.id, true); });
  if (t === 4) { E.requestExpand(s); E.requestHire(s, 'design'); E.requestHire(s, 'mfg'); E.requestHire(s, 'test'); E.requestHire(s, 'cert'); }
  if (t === 6) E.buyEngines(s, 48);
  if (t === 8) s.offers.forEach((o) => { if (o.open && !o.decided && o.id === 'blb') E.decideOffer(s, o.id, true); });
};

const greedy = (s, t) => {
  if (t === 1) E.setFinance(s, 'bank');
  if (t === 3) E.buyEngines(s, 12);
  s.offers.forEach((o) => { if (o.open && !o.decided) E.decideOffer(s, o.id, true); });
  if (t >= 12) E.toggleOvertime(s);
};

const main = play(mainPolicy);
const h1 = play(noHire);
const h2 = play(noFlight);
const h3 = play(greedy);

/* --- 核心循环与门序 --- */
assert(main.ending && main.ending.id === 'win', '主线应通关，实际: ' + (main.ending && main.ending.id));
assert(main.delivered >= C.target, '主线交付应 ≥' + C.target + '，实际 ' + main.delivered);
assert(main.cash > 0, '主线净现金应为正，实际 ' + main.cash.toFixed(2));
assert(main.tc && main.tc >= 8 && main.tc <= 15, 'TC 应落在第 8–15 季，实际 ' + main.tc);
assert(main.pc && main.pc > main.tc, 'PC 必须晚于 TC，实际 TC ' + main.tc + ' / PC ' + main.pc);

const firstDel = main.history.find((h) => h.deliver > 0);
assert(firstDel && firstDel.turn >= main.pc, '第一架交付必须不早于 PC 取得季，实际 T' + (firstDel && firstDel.turn) + ' vs PC T' + main.pc);

const gateOrder = ['d4', 'm2', 'f1', 'c5', 'c6'];
assert(gateOrder.every((id) => E.workDone(main, id)), '五道门应全部通过');

/* --- 分支差异 --- */
assert(h1.ending.id !== 'win', '不招人不应通关，实际 ' + h1.ending.id);
assert(h1.delivered < C.target, '不招人交付应 <' + C.target + '，实际 ' + h1.delivered);
assert(h2.ending.id !== 'win', '不招试飞部不应通关，实际 ' + h2.ending.id);
assert(h3.ending.id !== 'win', '贪心接单不应通关，实际 ' + h3.ending.id);

/* --- 事件与故事 --- */
assert(Object.keys(main.schedule).length >= 3, '事件排期应至少 3 个，实际 ' + Object.keys(main.schedule).length);
assert(main.storyLog && main.storyLog.length === 3, '三个故事节点都应触发，实际 ' + (main.storyLog ? main.storyLog.length : 0));
assert(main.log.some((r) => r.events && r.events.length > 0), '至少应有一次事件进入结算记录');

/* --- 立项变体 --- */
const small = E.newGame({ seed: 20260419, seat: 'small', route: 'derivative' });
assert(small.seat === 'small' && small.route === 'derivative', '立项变体应被记录');
assert(small.discShift < 0, '96 座级应拿到更浅的折扣，实际 ' + small.discShift);
assert(small.needs.d3 === 2 && small.needs.t1 === 2, '改型衍生应让两项工作变轻');
assert(Math.abs(small.rdRate - 0.5) < 1e-9, '改型衍生研发应更便宜');
const big = E.newGame({ seed: 20260419, seat: 'main', route: 'clean' });
assert(big.discShift > 0 && big.needs.d3 === 3, '130 座全新设计应更深折扣、全量工作');

/* --- 情节 --- */
assert(E.BEATS.length >= 8, '情节节拍应 ≥8，实际 ' + E.BEATS.length);
const noteBeats = E.BEATS.filter((b) => b.type === 'note').length;
const choiceBeats = E.BEATS.filter((b) => b.type === 'choice').length;
assert(noteBeats >= 4 && choiceBeats >= 3, '应同时有叙事与抉择节拍，实际 ' + noteBeats + '/' + choiceBeats);
assert(main.storyLog.length === choiceBeats, '抉择节拍应各记录一次，实际 ' + main.storyLog.length + '/' + choiceBeats);

/* --- 决策辅助 --- */
const probe = E.newGame({ seed: 20260419 });
E.setFinance(probe, 'gov');
const cp = E.criticalPath(probe);
assert(cp.length > 0 && cp[cp.length - 1].id === 'c5', '关键路径应以 TC 工作项收尾');
const sug = E.suggest(probe);
assert(Array.isArray(sug) && sug.length > 0 && typeof sug[0].run === 'function', '建议动作应可执行');
const f0 = E.forecast(probe, 12);
assert(typeof f0.minCash === 'number' && isFinite(f0.minCash), '预测应返回有限的现金最低点');
const probe2 = E.newGame({ seed: 20260419 });
E.setFinance(probe2, 'gov');
['design', 'mfg', 'test', 'cert', 'flight'].forEach((d) => E.requestHire(probe2, d));
const f1 = E.forecast(probe2, 12);
assert(f1.tc && f1.tc < 15, '加人后预测应给出更早的 TC，实际 ' + f1.tc);

/* --- 重开 --- */
const fresh = E.newGame({ seed: 20260419, seat: 'main', route: 'clean' });
assert(fresh.turn === 1 && fresh.cash === C.startCash && fresh.delivered === 0 && fresh.tc === null && fresh.pc === null,
  '重开初态不干净');
assert(fresh.slots.length === 0 && fresh.finance === null, '重开残留了局内状态');
assert(!E.workDone(fresh, 'd3'), '重开后技术工作不应带进度');

/* --- 实机记录 --- */
const evidencePath = resolve(ROOT, 'qa/evidence/run.json');
let evidence = null;
if (!existsSync(evidencePath)) {
  failures.push('缺少 qa/evidence/run.json（浏览器实机记录）');
} else {
  evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
  assert(evidence.buildHash === buildHash(), '实机记录的构建哈希与当前代码不一致（代码已改动，需重跑实机）');
  const obs = evidence.observations || {};
  ['launch', 'render', 'input', 'coreLoop', 'outcome', 'restart'].forEach((k) => {
    assert(obs[k] && obs[k].id, '实机记录缺少 observation: ' + k);
  });
  if (obs.render && obs.render.state && obs.render.state.visual) {
    const p = resolve(ROOT, obs.render.state.visual);
    assert(existsSync(p) && statSync(p).size > 10000, 'render 截图缺失或过小');
  }
  if (obs.outcome && obs.outcome.state) {
    assert(obs.outcome.state.ending === 'win', '实机结局应为 win');
    assert(obs.outcome.state.delivered >= C.target, '实机交付应 ≥' + C.target);
  }
  if (obs.restart && obs.restart.state) {
    assert(obs.restart.state.turn === 1 && obs.restart.state.delivered === 0, '实机重开未回到初态');
  }
  ['01-tech', '02-beat', '03-tc', '04-ending', '05-restart', '06-codex'].forEach((n) => {
    const p = resolve(ROOT, 'qa/evidence/' + n + '.png');
    assert(existsSync(p) && statSync(p).size > 10000, '缺少实机截图 ' + n + '.png');
  });
}

const checks = {
  launch: evidence ? 'PASS' : 'NOT_RUN',
  render: evidence ? 'PASS' : 'NOT_RUN',
  input: evidence ? 'PASS' : 'NOT_RUN',
  coreLoop: (main.ending && main.ending.id === 'win' && main.tc && main.pc) ? 'PASS' : 'FAIL',
  outcome: (main.delivered >= C.target) ? 'PASS' : 'FAIL',
  restart: (fresh.turn === 1 && fresh.cash === C.startCash) ? 'PASS' : 'FAIL'
};
const status = failures.length ? 'FAIL' : 'PASS';

const out = {
  schemaVersion: 3,
  status,
  verify: { command: 'node qa/verify.mjs', exitCode: failures.length ? 1 : 0 },
  completeRun: { id: 'main-path', cleanContext: true, terminal: 'win', restart: 'turn-1-initial', evidence: 'qa/evidence/run.json' },
  checks,
  limitations: [
    { scope: 'render/input automation', reason: '沙箱无 Chromium 自动化依赖（puppeteer/playwright 均不可用），实机画面与真实点击由平台浏览器工具采集，verify.mjs 通过构建哈希与截图字节数校验其与当前代码同源' },
    { scope: 'audio', reason: '声音方向未实现，构建版为纯静音' },
    { scope: 'space chapter', reason: '第三章航天延伸仅交付设计接口，未实现' },
    { scope: 'airline side', reason: '未实现航司运营侧；航司只作为客户与需求约束出现' }
  ]
};
mkdirSync(resolve(ROOT, 'qa'), { recursive: true });
writeFileSync(resolve(ROOT, 'qa/verification.json'), JSON.stringify(out, null, 2) + '\n');

console.log('build', buildHash());
console.log('main  :', main.ending && main.ending.id, main.delivered, main.cash.toFixed(2), 'TC', main.tc, 'PC', main.pc);
console.log('noHire:', h1.ending && h1.ending.id, h1.delivered, 'TC', h1.tc);
console.log('noFly :', h2.ending && h2.ending.id, h2.delivered, 'TC', h2.tc);
console.log('greedy:', h3.ending && h3.ending.id, h3.delivered);
if (failures.length) { console.log('\nFAILED:'); failures.forEach((f) => console.log(' - ' + f)); process.exit(1); }
console.log('\nverification.json written, status PASS');
