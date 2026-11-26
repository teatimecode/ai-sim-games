/* Phase 2 质量门：低成熟度 + 双 hl 配置的引擎回归（不改变线上规则，只跑场景） */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const C = E.CONFIG;

function run(opts) {
  const s = E.newGame({ seed: 20260419, seat: 'main', route: 'clean' });
  const log = [];
  while (!s.ending && s.turn <= C.maxTurn) {
    const t = s.turn;
    if (t === 1) E.setFinance(s, 'gov');
    if (t === 2) E.buyEngines(s, 24);
    if (t === 3) s.offers.forEach(o => { if (o.open && o.id === 'alt') E.decideOffer(s, o.id, true); });
    if (t === 4) { E.requestExpand(s); E.requestHire(s, 'design'); E.requestHire(s, 'mfg'); }
    if (t === 5) { E.requestHire(s, 'test'); E.requestHire(s, 'cert'); }
    if (t === 6) E.buyEngines(s, 48);
    if (t === 7) E.requestHire(s, 'flight');
    if (t === 8) s.offers.forEach(o => { if (o.open && o.id === 'blb') E.decideOffer(s, o.id, true); });
    if (t === 10) s.offers.forEach(o => { if (o.open && o.id === 'ocn') E.decideOffer(s, o.id, true); });
    if (t === 11) E.buyEngines(s, 48);
    if (opts.doubleHl) s.offers.forEach(o => { o.config = 'hl'; });
    // PC 当季把成熟度压到下限
    if (opts.lowMaturity && s.pc && s.turn === s.pc + 1) {
      s.maturity = C.maturityFloor;
      if (opts.processAt && s.turn >= opts.processAt) E.requestProcess(s);
    } else if (opts.processAt && s.turn >= opts.processAt) {
      E.requestProcess(s);
    }
    if (opts.process2 && s.turn >= opts.process2) E.requestProcess(s);
    E.autoAssign(s);
    const r = E.commit(s);
    log.push({ t, cap: +r.capacity.toFixed(2), del: s.history[t - 1].deliver, cum: s.delivered,
      cash: +s.cash.toFixed(2), mat: s.maturity, load: s.configLoad });
    if (opts.lowMaturity && s.turn === (s.pc || 99) + 1) {
      console.log('  进入低成熟度季：maturity =', s.maturity, 'configLoad =', s.configLoad);
    }
  }
  return { s, log };
}

function report(label, opts) {
  const { s, log } = run(opts);
  const worst = log.reduce((a, x) => (x.cap < a.cap ? x : a), log[0]);
  console.log('\n===', label, '===');
  console.log('  TC', s.tc, '| PC', s.pc, '| 交付', s.delivered, '| 现金', s.cash.toFixed(2),
    '| 结局', s.ending && s.ending.id, '| 末成熟度', s.maturity, '| configLoad', s.configLoad);
  console.log('  最低产能季 T' + worst.t, worst.cap, '架/季 | 该季交付', worst.del);
  console.log('  PC 后交付序列:', log.filter(x => s.pc && x.t >= s.pc).map(x => 'T' + x.t + ':' + x.del).join(' '));
  return { s, log };
}

const base = report('基线（正常成熟度，无双 hl）', {});
const worst = report('低成熟度 35 + 双 hl + 第 16 季工艺改进', { lowMaturity: true, doubleHl: true, processAt: 14, process2: 17 });
const noFix = report('低成熟度 35 + 双 hl + 不做工艺改进', { lowMaturity: true, doubleHl: true });

console.log('\n--- 结论 ---');
console.log('双 hl + 低成熟度 + 工艺改进:', worst.s.ending.id, '交付', worst.s.delivered);
console.log('双 hl + 低成熟度 + 不改进:', noFix.s.ending.id, '交付', noFix.s.delivered);
console.log('相对基线少交付:', base.s.delivered - worst.s.delivered, '架');
console.log('是否无条件必败:', worst.s.delivered < 15 ? '是（需要调参）' : '否');
