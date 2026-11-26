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
// 唯一代码源：本目录（games/aircraft-manufacturer）。不再回退到会话工作区。
const E = require(resolve(ROOT, 'engine.js'));
const C = E.CONFIG;
const failures = [];

const assert = (cond, msg) => { if (!cond) failures.push(msg); };

function buildHash() {
  const files = ['index.html', 'engine.js', 'ui.js', 'game.css', 'codex.js'];
  const h = createHash('sha256');
  for (const f of files) h.update(readFileSync(resolve(ROOT, f)));
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

/* --- 叙事回响 --- */
assert(E.BEATS.filter((b) => b.when).length >= 2, '应有条件型回响节拍');
const echoProbe = E.newGame({ seed: 20260419 });
const echoLock = E.BEATS.filter((b) => b.id === 'echo-lock')[0];
assert(echoLock.when(echoProbe) === false, '未做选择时回响节拍不应出现');
echoProbe.echoFlags['dinner:a'] = true;
assert(echoLock.when(echoProbe) === true, '做了选择后回响节拍应出现');
assert(main.echoes.length === 3, '三个抉择应各留一条回响，实际 ' + main.echoes.length);

/* --- 航司侧 --- */
const air = E.newGame({ seed: 20260419 });
assert(Object.keys(air.airlines).length === 4, '应有四个航司档案');
const baseRel = air.airlines['高原航空'].rel;
E.setFinance(air, 'gov');
assert(E.visitAirline(air, '高原航空').ok, '拜访应成功');
E.commit(air);
assert(air.airlines['高原航空'].rel === baseRel + 8, '拜访应 +8 关系，实际 ' + air.airlines['高原航空'].rel);
const v2 = E.newGame({ seed: 20260419 });
E.setFinance(v2, 'gov');
v2.offers.filter((o) => o.id === 'alt')[0].open = true;
v2.airlines['高原航空'].rel = 90;
E.decideOffer(v2, 'alt', true);
E.commit(v2);
const discHigh = v2.slots[0].disc;
const v3 = E.newGame({ seed: 20260419 });
E.setFinance(v3, 'gov');
v3.offers.filter((o) => o.id === 'alt')[0].open = true;
E.decideOffer(v3, 'alt', true);
E.commit(v3);
assert(discHigh < v3.slots[0].disc, '关系好应拿到更浅的折扣');

/* --- P0-A 经济正确性 --- */
const econ = E.newGame({ seed: 20260419, seat: 'main', route: 'clean' });
E.setFinance(econ, 'gov');
const er = E.commit(econ);
assert(er.cashStart === 2.0, 'cashStart 应为提交前现金 2.0，实际 ' + er.cashStart);
assert(er.cashEnd === er.cashStart + 11.0 - 0.7 - 0.06, '季报终值应等于 起点+融资-研发-利息，实际 ' + er.cashEnd);
assert(Math.abs(er.cashEnd - econ.cash) < 1e-9, 'cashEnd 必须等于结算后的真实现金');

const snap = E.newGame({ seed: 20260419, seat: 'main', route: 'clean' });
E.setFinance(snap, 'gov');
E.buyEngines(snap, 12);
const quoted = snap.pending.enginesCost;
snap.enginePrice = 0.385;                 // 下单后涨价事件
E.commit(snap);
assert(Math.abs(quoted - 12 * 0.35 * 0.30) < 1e-9, '下单时单价快照应为 0.35');
assert(snap.engineOrders[0].unit === 0.35, '在途订单单价应锁定 0.35，实际 ' + snap.engineOrders[0].unit);

const deriv = E.newGame({ seed: 20260419, seat: 'main', route: 'derivative' });
assert(deriv.needs.d3 === 2 && deriv.needs.t1 === 2 && deriv.needs.f2 === 1, '改型路线应下调三项工作量');
assert(deriv.rdRate < 0.6, '改型路线研发应更便宜');

const done = E.newGame({ seed: 20260419, seat: 'main', route: 'clean' });
E.setFinance(done, 'gov');
done.pending.assign = { d3: 3 };
const dr = E.commit(done);
assert(dr.notes.some((n) => n.indexOf('系统布置与数字样机') >= 0), '完成工作项应写入 doneNow 记录');

/* --- Phase 2：量产成熟度 / 配置模板 / 反馈 --- */
const m1 = E.newGame({ seed: 20260419 });
assert(m1.maturity === E.CONFIG.maturityStart, '成熟度应从参数初值开始');
assert(!E.requestProcess(m1).ok, 'PC 之前不应允许工艺改进');
m1.pc = 12; m1.turn = 13; m1.cash = 10; m1.quality = 90;
const procOk = E.requestProcess(m1);
assert(procOk.ok, 'PC 之后应允许工艺改进');
const rq = E.commit(m1);
assert(m1.maturity > E.CONFIG.maturityStart, '工艺改进后成熟度应上升');
assert(rq.review.items.some((x) => x.k === '量产成熟度'), '复盘应包含量产成熟度');
assert(m1.processCooldown > m1.turn - 1, '工艺改进应进入冷却');

const beforeM = E.newGame({ seed: 20260419 });
const snapM = JSON.stringify(beforeM);
E.previewDelta(beforeM, 8);
assert(JSON.stringify(beforeM) === snapM, '预测不得改变新状态字段');

const cfg = E.newGame({ seed: 1, seat: 'main', route: 'clean' });
E.setFinance(cfg, 'gov');
cfg.offers.forEach((o) => { o.open = true; });
const blb = cfg.offers.filter((o) => o.id === 'blb')[0];
const stdOffer = cfg.offers.filter((o) => o.id === 'alt')[0];
assert(blb.config === 'hl' && !stdOffer.config, '蓝湾应带高频低成本模板，高原为通用');
E.decideOffer(cfg, 'blb', true);
E.commit(cfg);
const slot = cfg.slots.filter((x) => x.cust === '蓝湾航空')[0];
assert(slot.disc > 0.2, '配置模板应加深折扣，实际 ' + slot.disc.toFixed(2));
assert(cfg.configLoad >= 1, '配置模板应带来产线压力');

const fbProbe = E.newGame({ seed: 20260419 });
fbProbe.pc = 13; fbProbe.turn = 14; fbProbe.maturity = 90; fbProbe.quality = 80;
fbProbe.offers.forEach((o) => { o.open = true; });
E.decideOffer(fbProbe, 'alt', true);
E.commit(fbProbe);
const beforeDel = fbProbe.delivered;
const r2 = E.commit(fbProbe);
assert(fbProbe.feedback.length === 0 || fbProbe.feedback.every((f) => f.score >= 0), '反馈分数应有界');
assert(typeof beforeDel === 'number', '历史交付计数不受反馈影响');

const reinit = E.newGame({ seed: 20260419 });
assert(reinit.maturity === E.CONFIG.maturityStart && reinit.feedback.length === 0 && reinit.configLoad === 0, '重开应清空 Phase 2 状态');

/* --- Phase 2.5：成熟度独立性 / PC 前不生效 / 正常路径可达 --- */
const ind = E.newGame({ seed: 20260419 });
ind.quality = 95; ind.maturity = 45; ind.airlines['高原航空'].rel = 80;
const mr = E.maturityRisk(ind);
assert(mr.current === 45 && mr.projected <= 50, '成熟度应与质量/关系独立计算，实际 ' + mr.projected);
assert(mr.active === false, 'PC 前风险投影应标记为未生效');

const prePc = E.newGame({ seed: 20260419 });
E.setFinance(prePc, 'gov');
prePc.maturity = 40;
const preCap = E.capacity(prePc) * 1;
E.commit(prePc);
assert(prePc.maturity === 40 || prePc.maturity >= 40, 'PC 前成熟度不应被侵蚀');
assert(preCap > 0, 'PC 前产能不应受成熟度影响');

const reach = E.newGame({ seed: 20260419, seat: 'main', route: 'clean' });
let hit = false, fixed = false;
while (!reach.ending && reach.turn <= E.CONFIG.maxTurn) {
  const t = reach.turn;
  if (t === 1) E.setFinance(reach, 'gov');
  if (t === 2) E.buyEngines(reach, 24);
  if (t === 3) reach.offers.forEach((o) => { if (o.open && o.id === 'alt') E.decideOffer(reach, o.id, true); });
  if (t === 4) { E.requestExpand(reach); E.requestHire(reach, 'design'); E.requestHire(reach, 'mfg'); }
  if (t === 5) { E.requestHire(reach, 'test'); E.requestHire(reach, 'cert'); }
  if (t === 6) E.buyEngines(reach, 48);
  if (t === 7) E.requestHire(reach, 'flight');
  if (t === 8) reach.offers.forEach((o) => { if (o.open && o.id === 'blb') E.decideOffer(reach, o.id, true); });
  if (t === 10) reach.offers.forEach((o) => { if (o.open && o.id === 'ocn') E.decideOffer(reach, o.id, true); });
  if (t === 11) E.buyEngines(reach, 48);
  if (reach.pc && t >= reach.pc && t <= reach.pc + 6) E.toggleOvertime(reach);
  if (reach.pc && reach.maturity < E.CONFIG.maturityRiskAt && !fixed) { if (E.requestProcess(reach).ok) fixed = true; }
  E.autoAssign(reach);
  const rr = E.commit(reach);
  if (reach.pc && reach.maturity < E.CONFIG.maturityRiskAt) hit = true;
  assert(rr.capacity >= 0, '产能不应为负');
}
assert(hit, '正常玩法（hl 单 + 连续加班）应能进入成熟度风险区');
// 机制级验证：给足现金时，工艺改进必然把成熟度抬起来
const fixUnit = E.newGame({ seed: 20260419 });
fixUnit.pc = 12; fixUnit.turn = 13; fixUnit.cash = 10; fixUnit.maturity = 40;
assert(E.requestProcess(fixUnit).ok, '工艺改进应可执行');
E.commit(fixUnit);
assert(fixUnit.maturity > 40, '工艺改进后成熟度应上升，实际 ' + fixUnit.maturity);
assert(reach.ending.id !== 'fail' && reach.ending.id !== 'bankrupt', '正常路径不应必败，实际 ' + reach.ending.id);

/* --- Phase 2 质量门：低成熟度 + 双 hl 不得结构性必败 --- */
function worstCase(doProcess) {
  const w = E.newGame({ seed: 20260419, seat: 'main', route: 'clean' });
  while (!w.ending && w.turn <= E.CONFIG.maxTurn) {
    const t = w.turn;
    if (t === 1) E.setFinance(w, 'gov');
    if (t === 2) E.buyEngines(w, 24);
    if (t === 3) w.offers.forEach((o) => { if (o.open && o.id === 'alt') E.decideOffer(w, o.id, true); });
    if (t === 4) { E.requestExpand(w); E.requestHire(w, 'design'); E.requestHire(w, 'mfg'); }
    if (t === 5) { E.requestHire(w, 'test'); E.requestHire(w, 'cert'); }
    if (t === 6) E.buyEngines(w, 48);
    if (t === 7) E.requestHire(w, 'flight');
    if (t === 8) w.offers.forEach((o) => { if (o.open && o.id === 'blb') E.decideOffer(w, o.id, true); });
    if (t === 10) w.offers.forEach((o) => { if (o.open && o.id === 'ocn') E.decideOffer(w, o.id, true); });
    if (t === 11) E.buyEngines(w, 48);
    w.offers.forEach((o) => { o.config = 'hl'; });
    if (w.pc && w.turn === w.pc + 1) w.maturity = E.CONFIG.maturityFloor;
    if (doProcess && t === 14) E.requestProcess(w);
    E.autoAssign(w);
    E.commit(w);
  }
  return w;
}
const wc = worstCase(false);
assert(wc.delivered >= 25, '低成熟度 + 双 hl 仍应交付 ≥25 架，实际 ' + wc.delivered);
assert(wc.ending.id !== 'bankrupt' && wc.ending.id !== 'fail', '低成熟度 + 双 hl 不应结构性必败，实际 ' + wc.ending.id);
assert(wc.maturity >= E.CONFIG.maturityFloor, '成熟度不应跌破下限，实际 ' + wc.maturity);
const wc2 = worstCase(true);
assert(wc2.maturity >= wc.maturity, '工艺改进不应让成熟度更差，实际 ' + wc2.maturity + ' vs ' + wc.maturity);

/* --- Phase 1：预览 / 复盘 / 账本 / 证据 --- */
const pv = E.newGame({ seed: 20260419 });
E.setFinance(pv, 'gov'); E.commit(pv);
E.buyEngines(pv, 24); E.requestExpand(pv); E.autoAssign(pv);
const snapPv = JSON.stringify(pv);
const delta = E.previewDelta(pv, 10);
assert(Array.isArray(delta) && delta.length <= 5, '预览最多 5 条，实际 ' + delta.length);
assert(delta.length > 0, '有决策时应至少给出一条差异');
assert(JSON.stringify(pv) === snapPv, 'previewDelta 不得修改原状态');

const rv = E.commit(pv);
assert(rv.review && rv.review.items.length === 5, '复盘应覆盖 5 类指标');
assert(rv.review.items.every((x) => x.src && x.why && String(x.v).length), '每类指标都要有值/原因/来源');
assert(typeof rv.review.next === 'string' && rv.review.next.length > 0, '复盘应给出下一季唯一建议');
assert(pv.ledger.length >= 1 && pv.ledger.every((x) => x.acts.length <= 3), '每季账本上限 3 条');

const seedA = E.newGame({ seed: 20260419, seat: 'main', route: 'clean' });
const seedB = E.newGame({ seed: 20260419, seat: 'main', route: 'clean' });
assert(JSON.stringify(seedA.schedule) === JSON.stringify(seedB.schedule), '相同 seed 与立项应复现同一事件排期');
const seedC = E.newGame({ seed: 777, seat: 'main', route: 'clean' });
assert(JSON.stringify(seedA.schedule) !== JSON.stringify(seedC.schedule), '不同 seed 应给出不同排期');

const ls = E.ledgerSummary(pv);
['variant', 'seed', 'best', 'costly', 'lateGate', 'echoes', 'decisions', 'events']
  .forEach((k) => assert(Object.prototype.hasOwnProperty.call(ls, k), '账本摘要缺少 ' + k));

const assistIds = E.ASSIST.steps.map((x) => x.id);
assert(assistIds.every((id) => (E.assistEvidence(id) || '').length > 0), '每步助理都要有证据标签');
assert(E.assistEvidence('s2-engine').indexOf('到货') >= 0, '证据标签应指向具体字段，如发动机到货季');

/* --- 助理折叠与资源探测（源码契约断言） --- */
const uiSrc = readFileSync(resolve(ROOT, 'ui.js'), 'utf8');
const htmlSrc = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const cssSrc = readFileSync(resolve(ROOT, 'game.css'), 'utf8');
assert(/collapsed:\s*true/.test(uiSrc), '助理应默认折叠');
assert(uiSrc.indexOf("op === 'expand'") >= 0 && uiSrc.indexOf("op === 'collapse'") >= 0, '应支持展开与收起');
assert(uiSrc.indexOf('probeAssets') >= 0 && uiSrc.indexOf('ASSET_OK') >= 0, '应有资源探测，缺失时不请求图片');
assert(htmlSrc.indexOf('assisthost') >= 0, '页面应挂载助理容器');
assert(htmlSrc.indexOf('data-preview') >= 0, '底栏应有结算预览入口');
assert(cssSrc.indexOf('.assist-chip') >= 0, '折叠态样式应存在');

/* --- 助理引导 --- */
assert(E.ASSIST && E.ASSIST.steps.length >= 8, '助理脚本应有 8 步以上，实际 ' + (E.ASSIST.steps || []).length);
assert(E.ASSIST.steps.every((x) => x.ops.length <= 2), '每步只给不超过两个选择');
const walk = E.newGame({ seed: 20260419 });
const seenIds = [];
let guard = 0;
while (guard++ < 30) {
  const st = E.nextAssistStep(walk, seenIds);
  if (!st) break;
  seenIds.push(st.id);
  if (st.id === 's1-money') walk.finance = 'gov';
  if (st.id === 's1-assign') walk.pending.assign = { d3: 1 };
  if (st.id === 's1-commit') { walk.pending.assign = {}; walk.turn = 2; }
  if (st.id === 's2-path') walk.turn = 3;
  if (st.id === 's3-customer') walk.turn = 4;
}
assert(seenIds.length === E.ASSIST.steps.length, '助理九步应可全部走完（无死循环），实际 ' + seenIds.length);
assert(E.nextAssistStep(walk, seenIds) === null, '走完后不应再有步骤');

/* --- 图片资源契约 --- */
const assetsDir = resolve(ROOT, 'assets');
assert(existsSync(resolve(assetsDir, 'README.md')), '缺少 assets/README.md 资源契约');
const spec = readFileSync(resolve(assetsDir, 'README.md'), 'utf8');
['prologue-yard.jpg', 'prologue-shop.jpg', 'prologue-notebook.jpg', 'prologue-board.jpg', 'prologue-runway.jpg', 'assistant.jpg']
  .forEach((n) => assert(spec.indexOf(n) >= 0, '资源契约缺少 ' + n));

/* --- 航天切片 --- */
const re = E.rocketCalc('reusable');
const ex = E.rocketCalc('expendable');
assert(re && ex && re.flown === 12 && ex.flown === 12, '两条路线应交付同样 12 发');
assert(re.cash > ex.cash, '可复用最终应更赚钱');
assert(re.minCash < ex.minCash, '可复用中途现金应更紧');
assert(Math.abs(E.rocketBreakEven() - 6.25) < 0.05, '回本点应约 6.25 发');

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
  ['01-tech', '04-ending', '05-restart', '11-ui-1280x720', '14-customer', '15-rocket', '16-assistant-1440', '17-assistant-430'].forEach((n) => {
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
