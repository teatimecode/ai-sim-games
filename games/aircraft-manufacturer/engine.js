/* 《适航》核心规则引擎 v2 —— 加入真实的研发—制造—试验—试飞—取证链路。
   与界面无关，纯状态机。浏览器挂到 window.Airworthy，Node 用于 qa 回归。 */
(function (global) {
  'use strict';

  const CONFIG = {
    maxTurn: 18,
    price: 4.2,
    baseCost: 2.72,
    learningSpan: 0.25,
    startCash: 2.0,
    startQuality: 62,
    startRep: 55,
    bottleneck: 60,
    hireCost: 0.8,
    expandCost: 2.4,
    expandLead: 2,
    rdPerTurn: 0.6,
    interest: 0.012,
    target: 25,
    penaltyRate: 0.05,
    refundRate: 0.9,
    deposit: 0.05,
    pdpEarly: 0.15,
    pdpLate: 0.20,
    atDelivery: 0.50,
    tailRate: 0.10,
    qualityFloor: 55,
    /* Phase 2：量产成熟度（可调） */
    maturityStart: 70,
    maturityFloor: 35,
    maturityReworkCap: 0.25,      // 最低成熟度时的产能损失比例
    maturityGainPerQuarter: 2,    // 每季自然回升
    maturityGainPerDelivery: 0.5, // 每交付一架的工艺沉淀（单季最多 +2）
    maturityWarnAt: 60,           // 低于此值提前预警
    maturityIssueAt: 50,          // 低于此值开始出现交付检查不合格
    processCost: 1.2,             // 工艺改进花费
    processGain: 10,              // 工艺改进提升
    processCooldown: 2,           // 冷却季数
    configLoadCap: 0.03,
    maturityOvertimeCost: 5,      // 每季加班对成熟度的侵蚀
    maturityConfigCost: 2,        // 每单位配置负荷的侵蚀
    maturityQualityRef: 70,       // 质量低于此值开始侵蚀
    maturityRiskAt: 60,           // 进入风险区的阈值
          // 每单配置对产能的额外压力

    reworkFactor: 0.9
  };

  /* 五个部门：产出的不是"工程队"，而是按专业划分的产能 */
  const DEPTS = [
    { id: 'design', n: '设计部', sub: '气动 · 载荷 · 结构 · 系统布置', base: 2, max: 4, unit: '人' },
    { id: 'mfg', n: '制造工程', sub: '工装 · 工艺 · 首件 · 总装支持', base: 1, max: 3, unit: '人' },
    { id: 'test', n: '试验部', sub: '静力 · 疲劳 · 铁鸟台联试', base: 1, max: 3, unit: '人' },
    { id: 'flight', n: '试飞部', sub: '试飞员 · 遥测 · 科目执行', base: 2, max: 4, unit: '架次' },
    { id: 'cert', n: '适航部', sub: '审定计划 · 符合性文件 · 局方沟通', base: 1, max: 3, unit: '人' }
  ];

  /* 技术工作项：真实的名词，真实的前置关系 */
  const WORKS = [
    // 设计（气动与结构已在前一期完成，玩家接手时从系统布置开始）
    { id: 'd3', dept: 'design', n: '系统布置与数字样机', need: 3, req: [], out: 'DMU 干涉检查通过' },
    { id: 'd4', dept: 'design', n: '设计冻结评审 CDR', need: 1, req: ['d3'], out: '设计基线冻结' },

    // 制造工程
    { id: 'm1', dept: 'mfg', n: '工装与型架', need: 2, req: ['d4'], out: '总装工装就绪' },
    { id: 'm2', dept: 'mfg', n: '首架试飞机总装', need: 2, req: ['m1'], out: '首架试飞机下线' },

    // 地面试验
    { id: 't1', dept: 'test', n: '全机静力试验', need: 3, req: [], out: '150% 极限载荷通过' },
    { id: 't2', dept: 'test', n: '铁鸟台系统联试', need: 2, req: ['d3'], out: '飞控液压联试通过' },
    { id: 't3', dept: 'test', n: '疲劳试验', need: 3, req: ['t1'], out: '两倍设计寿命通过' },

    // 试飞
    { id: 'f1', dept: 'flight', n: '首飞', need: 1, req: ['m2', 't2'], out: '首飞报告' },
    { id: 'f2', dept: 'flight', n: '包线扩展', need: 2, req: ['f1'], out: '飞行包线打开' },
    { id: 'f3', dept: 'flight', n: '失速 / 颤振 / 性能', need: 3, req: ['f2'], out: '关键科目通过' },
    { id: 'f4', dept: 'flight', n: '噪声与结冰试飞', need: 2, req: ['f2'], out: '环境科目通过' },

    // 适航
    { id: 'c1', dept: 'cert', n: '审定基础与符合性计划', need: 2, req: ['d4'], out: 'PSAC / CP 获批' },
    { id: 'c2', dept: 'cert', n: '结构符合性文件', need: 2, req: ['t1', 't3'], out: '结构 MOC 归档' },
    { id: 'c3', dept: 'cert', n: '系统符合性文件', need: 1, req: ['t2'], out: '系统 MOC 归档' },
    { id: 'c4', dept: 'cert', n: '试飞符合性文件', need: 2, req: ['f3', 'f4'], out: '试飞 MOC 归档' },
    { id: 'c5', dept: 'cert', n: 'TC 型号合格证', need: 1, req: ['c2', 'c3', 'c4'], out: 'TC 颁证' },
    { id: 'c6', dept: 'cert', n: 'PC 生产许可证', need: 2, req: ['c5'], out: 'PC 颁证，可交付' }
  ];

  const PREDONE = ['d1', 'd2'];

  const GATES = [
    { id: 'G1', n: '设计冻结', work: 'd4', hint: '设计基线定下来，工装才能开工' },
    { id: 'G2', n: '首架试飞机下线', work: 'm2', hint: '试验与试飞的实物基础' },
    { id: 'G3', n: '首飞', work: 'f1', hint: '从图纸变成会飞的东西' },
    { id: 'G4', n: 'TC 型号合格证', work: 'c5', hint: '局方认可这个型号可以载客' },
    { id: 'G5', n: 'PC 生产许可证', work: 'c6', hint: '局方认可你能稳定地造出合格的飞机' }
  ];

  const OFFERS = [
    { turn: 3, id: 'alt', cust: '高原航空', tag: '网络航司 · 高原支线', qty: 12, win: [11, 16], disc: 0.12,
      note: '首单。它买的是你的信用，不是你的价钱。' },
    { turn: 6, id: 'trx', cust: '横跨航空', tag: '新兴市场 · 高速扩张', qty: 8, win: [12, 16], disc: 0.15,
      note: '量大但窗口紧，融资也脆。' },
    { turn: 8, id: 'blb', cust: '蓝湾航空', tag: '低成本 · 单一机型', qty: 10, win: [13, 18], disc: 0.18, config: 'hl',
      note: '能摊薄固定成本，但压价很狠。' },
    { turn: 10, id: 'ocn', cust: '远洋租机', tag: '经营租赁', qty: 6, win: [14, 18], disc: 0.22,
      note: '它买的是机位，不是飞机。折扣最深。' }
  ];

  /* ---------- 事件牌堆（带种子的随机排期） ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const EVENT_POOL = [
    { id: 'price', title: '竞品降价', warn: '客户听说巨杉在放价，下一季会来压价。',
      text: '巨杉 S-8 对同座级市场放价 5%。之后签的每一单，客户都会多要 2 个点的折扣。',
      apply: function (s) { s.discShift += 0.02; } },
    { id: 'reg', title: '局方加试', warn: '审定当局在准备一张补充问题单。',
      text: '局方要求补做「客舱线束走向复核」，占 1 个适航部人力，不处理会一直挡着 TC。',
      apply: function (s) { if (!s.extraCert) s.extraCert = { id: 'EXTRA', n: '客舱线束走向复核', need: 1, done: false }; } },
    { id: 'gear', title: '缺件停线', warn: '供应商邮件：主起落架作动筒可能要晚 6 周。',
      text: '作动筒延迟 41 天，03 工位停线，本季产能只剩 55%。',
      apply: function (s) { s.stopTurn = s.turn; } },
    { id: 'engine', title: '发动机批次延迟', warn: '发动机厂在调整排产，你的批次可能被往后挪。',
      text: '整批发动机到货推迟一季。产线还能撑，但下季会缺件。',
      apply: function (s) { s.engineOrders.forEach(function (o) { o.arrive += 1; }); } },
    { id: 'composite', title: '复材缺料', warn: '碳纤维预浸料供应商通知配额缩减。',
      text: '复材到料不足，本季总装产能打八折。',
      apply: function (s) { s.capPenalty = 0.8; } },
    { id: 'custwin', title: '客户改窗口', warn: '高原航空在重排它的暑运计划。',
      text: '高原航空把剩余交付窗口整体提前一季，倒计时立刻收紧。',
      apply: function (s) {
        s.slots.forEach(function (x) {
          if (x.cust === '高原航空' && x.alive && x.got === null && x.plan >= s.turn) x.plan = Math.max(s.turn, x.plan - 1);
        });
      } },
    { id: 'fin', title: '客户融资生变', warn: '某家航司的融资方案在内部被否了。',
      text: '客户要求把这一单的折扣再压 3 个点，否则缩量。你只能接受。',
      apply: function (s) { s.slots.forEach(function (x) { if (x.alive && x.got === null) x.disc = Math.min(0.3, x.disc + 0.03); }); } },
    { id: 'leave', title: '关键工程师离职', warn: '设计部有骨干在谈外面的机会。',
      text: '一位系统集成主管离职，设计部产能 −1，持续两季。',
      apply: function (s) { s.deptLoss = { dept: 'design', until: s.turn + 1 }; } },
    { id: 'tool', title: '工装损坏', warn: '型架被转运车撞了一下，精度要复检。',
      text: '工装复检占用制造工程 1 个人季，工装进度回退 1。',
      apply: function (s) { s.works.m1 = Math.max(0, (s.works.m1 || 0) - 1); } },
    { id: 'fast', title: '审定节奏加快', warn: '局方项目组表示可以并行审。',
      text: '局方同意并行审查：本季适航部产能 +1，信誉 +3。',
      apply: function (s) { s.certBonus = 1; s.rep = Math.min(100, s.rep + 3); } },
    { id: 'fx', title: '汇率与关税', warn: '本币在贬值，进口件成本在涨。',
      text: '进口件成本上升，此后每架成本 +0.05 亿。',
      apply: function (s) { s.costShift = (s.costShift || 0) + 0.05; } },
    { id: 'supplier', title: '供应商涨价', warn: '发动机厂在谈年度调价。',
      text: '发动机单价上调 10%。',
      apply: function (s) { s.enginePrice = 0.35 * 1.1; } }
  ];

  /* ---------- 情节：9 个节拍，6 段纯叙事 + 3 次抉择 ---------- */
  const BEATS = [
    { turn: 3, id: 'visit', type: 'note', title: '第一位客户走进车间',
      text: '高原航空的采购总监姓白，站在 01 工位看了很久。她问：这条线一年能出几架？你说了个数，她没接话，只把名片放在工装上。',
      note: '信誉 +2。名片后来被贴在计划板上。',
      apply: function (s) { s.rep = Math.min(100, s.rep + 2); } },
    { turn: 5, id: 'notebook', type: 'note', title: '老周留下的笔记本',
      text: '前任总师老周被换下时，把一本卷了边的笔记本留在抽屉里。第一页写着一行字：不要在设计没冻结的时候开始做工装。',
      note: '设计部士气 +1，本季设计产能不变但进度 +1。',
      apply: function (s) { s.works.d3 = (s.works.d3 || 0) + 1; } },
    { turn: 7, id: 'dinner', type: 'choice', title: '供应商的晚宴',
      text: '发动机厂的大区经理约你吃饭，席间提到"如果贵司愿意把第二批提前，价格可以再谈"。',
      a: { label: '答应提前锁第二批', note: '现金先出去，但单价降 8%、到货早一季。' },
      b: { label: '按原计划走', note: '现金留在手上，但没有任何优惠。' } },
    { turn: 9, id: 'reg1', type: 'note', title: '局方第一次进场',
      text: '审定组的组长姓何，进门第一句话是：你们的符合性计划我看了，有三处方法写得太笼统。他没有否定，只是把本子推给你们。',
      note: '适航部获得 1 点进度。',
      apply: function (s) { s.works.c1 = (s.works.c1 || 0) + 1; } },
    { turn: 11, id: 'review', type: 'choice', title: '首飞前的最后一次评审',
      text: '试飞部把首飞风险清单摊在桌上，第 7 项写着"结冰条件下备用电源切换"，评审组里有人建议推迟首飞两周补测。',
      a: { label: '推迟两周补测', note: '首飞晚一季，但质量 +8、信誉 +3。' },
      b: { label: '按清单放行', note: '按期首飞，质量 −5。' } },
    { turn: 13, id: 'firstflight', type: 'note', title: '首飞',
      text: '那天早上风很小。飞机滑出、抬头、爬升，四十二分钟后落地。试飞员下机第一句话：比模拟器稳。车间里没人说话，然后有人开始鼓掌。',
      note: '信誉 +6，全公司士气回升。',
      apply: function (s) { s.rep = Math.min(100, s.rep + 6); } },
    { turn: 15, id: 'ip', type: 'choice', title: '第一张问题单',
      text: '局方在试飞数据里挑出一处：爬升段的一段抖振数据采样率不足。要求补做，或者给出等效的分析证明。',
      a: { label: '补做一个架次', note: '耗 1 个试飞架次，问题单干净闭环。' },
      b: { label: '用分析方法等效证明', note: '省架次，但适航部要多花 1 人季，且可能被驳回。' } },
    { turn: 16, id: 'push', type: 'note', title: '客户开始催',
      text: '白总监的电话从一周一次变成一天一次。她说排班表已经排到明年夏天，晚一季就要重排。你在电话里只能说：快了。',
      note: '信誉 −1，但订单窗口不变。',
      apply: function (s) { s.rep = Math.max(0, s.rep - 1); } },
    { turn: 12, id: 'echo-lock', when: function (s) { return !!s.echoFlags['dinner:a']; }, type: 'note', title: '早到的那批发动机',
      text: '第二批发动机比原计划早了一个月到货，工位上第一次没有等件。当初在饭桌上答应"提前锁"，现在变成了实打实的时间。',
      note: '信誉 +2。', apply: function (s) { s.rep = Math.min(100, s.rep + 2); } },
    { turn: 16, id: 'echo-review', when: function (s) { return !!s.echoFlags['review:a']; }, type: 'note', title: '干净的包线',
      text: '审定组翻完试飞报告，只问了一个问题就签了。对面的人说：你们的数据少见地齐。你想起首飞前那两周的推迟。',
      note: '质量 +3。', apply: function (s) { s.quality = Math.min(100, s.quality + 3); } },
    { turn: 17, id: 'board', type: 'note', title: '董事会前夜',
      text: '董事长在走廊里拦住你，只问了一句：如果重来一次，你还会选这个座级吗。你想了几秒，说会。他点点头走了。',
      note: '无机制影响。这一句是给你自己的。',
      apply: function () {} }
  ];

  function scheduleEvents(seed) {
    const rnd = mulberry32(seed);
    const pool = EVENT_POOL.slice();
    // 洗牌
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rnd() * (i + 1));
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    const turns = [];
    let t = 4;
    while (t <= CONFIG.maxTurn - 3 && turns.length < 5) {
      turns.push(t);
      t += 2 + Math.floor(rnd() * 3);
    }
    const out = {};
    turns.forEach(function (turn, i) { out[turn] = pool[i % pool.length].id; });
    return out;
  }
  function eventById(id) { return EVENT_POOL.filter(function (e) { return e.id === id; })[0]; }

  const CONFIG_TPL = {
    std: { n: '标准通用', disc: 0, shift: 0, load: 0, note: '标准客舱与系统配置，无额外制造压力' },
    hl:  { n: '高频低成本', disc: 0.01, shift: -1, load: 1, note: '高密度客舱、短周转：折扣更深、窗口前移一季、产线压力 +1' }
  };

  function L(n) { return Math.max(0.45, Math.pow(n, -0.2345)); }

  function newGame(opts) {
    opts = opts || {};
    const seed = opts.seed || (Date.now() % 100000);
    const seat = opts.seat || 'main';
    const route = opts.route || 'clean';
    const works = {};
    WORKS.forEach(function (w) { works[w.id] = 0; });
    PREDONE.forEach(function (id) { works[id] = 99; });
    const game = {
      turn: 1,
      maxTurn: CONFIG.maxTurn,
      cash: CONFIG.startCash,
      quality: CONFIG.startQuality,
      rep: CONFIG.startRep,
      k: 1,
      expandReady: null,
      depts: { design: 2, mfg: 1, test: 1, flight: 2, cert: 1 },
      works: works,
      seat: seat,
      route: route,
      needs: null,
      echoes: [],
      echoFlags: {},
      ledger: [],
      ledgerStartCash: CONFIG.startCash,
      maturity: CONFIG.maturityStart,
      maturityFloorBoost: 0,
      maturityHistory: [],
      processCooldown: 0,
      configLoad: 0,
      feedback: [],
      airlines: {
        '高原航空': { key: 'alt', fleet: 12, got: 0, rel: 50, rel9: null, note: '高原支线的老牌网络航司，机队正在换喷气' },
        '横跨航空': { key: 'trx', fleet: 8, got: 0, rel: 45, rel9: null, note: '新兴市场高速扩张，融资最脆弱' },
        '蓝湾航空': { key: 'blb', fleet: 10, got: 0, rel: 55, rel9: null, note: '单一机型低成本，最在意每座成本' },
        '远洋租机': { key: 'ocn', fleet: 6, got: 0, rel: 50, rel9: null, note: '经营租赁，只看残值和流转' }
      },
      visits: [],
      rdRate: route === 'derivative' ? 0.5 : 0.7,
      tc: null,
      pc: null,
      extraCert: null,
      offers: OFFERS.map(function (o) { return Object.assign({}, o, { open: false, decided: null }); }),
      slots: [],
      nextSlot: 1,
      finance: null,
      eventWarn: null,
      event: null,
      stopTurn: null,
      discShift: 0,
      seed: seed,
      schedule: scheduleEvents(seed),
      story: null,
      storyLog: [],
      costShift: 0,
      enginePrice: 0.35,
      capPenalty: 1,
      certBonus: 0,
      deptLoss: null,
      tail: [],
      history: [],
      log: [],
      ending: null,
      delivered: 0,
      progress: 0,
      engines: 0,
      engineOrders: [],
      pending: { overtime: false, expand: false, hires: {}, engines: 0, assign: {}, accept: [], decline: [], release: 0, extra: false, story: null, visits: [], enginesCost: 0, engineUnit: 0.35 },
      lastReport: null,
      flags: {}
    };
    return finishInit(game, seat, route);
  }

  function finishInit(s, seat, route) {
    // 需求基数：96 座是细分市场，130 座是主流市场
    s.needs = {};
    WORKS.forEach(function (w) { s.needs[w.id] = w.need; });
    if (route === 'derivative') {
      s.needs.d3 = 2;
      s.needs.t1 = 2;
      s.needs.f2 = 1;
      s.rep = Math.max(0, s.rep - 5);
    } else {
      s.rep = Math.min(100, s.rep + 6);
    }
    if (seat === 'small') {
      s.discShift = -0.02;
      s.qtyScale = 0.85;
    } else {
      s.discShift = 0.02;
      s.qtyScale = 1.1;
    }
    return s;
  }

  /* ---------- 派生量 ---------- */
  function capacity(s) {
    const n = s.delivered + 1;
    return (s.k * 90) / (CONFIG.bottleneck * L(n));
  }
  function effectiveCycle(s) { return CONFIG.bottleneck * L(s.delivered + 1); }
  function unitCost(s) { return CONFIG.baseCost + (s.costShift || 0) - CONFIG.learningSpan * (1 - L(s.delivered + 1)); }
  function slotPrice(s, slot) { return CONFIG.price * (1 - slot.disc); }
  function slotPrice2(slot) { return CONFIG.price * (1 - slot.disc); }

  const EXTRA_WORK = { id: 'EXTRA', dept: 'cert', n: '客舱线束走向复核', need: 1, req: [], out: '加试单闭环' };
  function allWorks(s) {
    const list = WORKS.slice();
    if (s && s.extraCert && !s.extraCert.done) list.push(EXTRA_WORK);
    return list;
  }
  function workById(id) {
    if (id === 'EXTRA') return EXTRA_WORK;
    return WORKS.filter(function (w) { return w.id === id; })[0];
  }
  function worksByDept(d, s) { return allWorks(s).filter(function (w) { return w.dept === d; }); }
  function needOf(s, id) {
    if (s && s.needs && s.needs[id] != null) return s.needs[id];
    return workById(id).need;
  }
  function workDone(s, id) {
    if (id === 'EXTRA') return !!(s.extraCert && s.extraCert.done);
    return (s.works[id] || 0) >= needOf(s, id);
  }
  function reqMet(s, w) {
    return w.req.every(function (r) { return workDone(s, r); });
  }
  function workProgress(s, id) {
    if (id === 'EXTRA') return s.extraCert && s.extraCert.done ? 1 : 0;
    return Math.min(s.works[id] || 0, needOf(s, id));
  }

  function deptCap(s, d) {
    let base = d === 'flight' ? s.depts.flight : s.depts[d];
    if (s.deptLoss && s.deptLoss.dept === d && s.turn <= s.deptLoss.until) base = Math.max(1, base - 1);
    if (d === 'cert' && s.certBonus) base += s.certBonus;
    return base;
  }
  function deptUsed(s, d) {
    let u = 0;
    Object.keys(s.pending.assign).forEach(function (id) {
      const w = workById(id);
      if (w && w.dept === d) u += s.pending.assign[id];
    });
    return u;
  }
  function deptLeft(s, d) { return Math.max(0, deptCap(s, d) - deptUsed(s, d)); }
  function canHire(s, d) {
    const def = DEPTS.filter(function (x) { return x.id === d; })[0];
    return s.depts[d] < def.max;
  }
  function canAssign(s, id) {
    const w = workById(id);
    if (!w) return { ok: false, reason: '没有这项工作' };
    if (id === 'EXTRA' && (!s.extraCert || s.extraCert.done)) return { ok: false, reason: '没有这张加试单' };
    if (workDone(s, id)) return { ok: false, reason: '已完成' };
    if (!reqMet(s, w)) {
      const miss = w.req.filter(function (r) { return !workDone(s, r); }).map(function (r) { return workById(r).n; });
      return { ok: false, reason: '前置未完成：' + miss.join('、') };
    }
    if (deptLeft(s, w.dept) <= 0) return { ok: false, reason: DEPTS.filter(function (x) { return x.id === w.dept; })[0].n + '本季产能已用完' };
    return { ok: true };
  }
  function assignWork(s, id) {
    const c = canAssign(s, id);
    if (!c.ok) return c;
    s.pending.assign[id] = (s.pending.assign[id] || 0) + 1;
    return { ok: true };
  }
  function unassignWork(s, id) {
    if (!s.pending.assign[id]) return;
    s.pending.assign[id] -= 1;
    if (!s.pending.assign[id]) delete s.pending.assign[id];
  }

  function gateState(s) {
    return GATES.map(function (g) {
      const done = workDone(s, g.work);
      const prevOk = true;
      return { id: g.id, n: g.n, hint: g.hint, done: done };
    });
  }
  function nextGate(s) {
    const g = GATES.filter(function (x) { return !workDone(s, x.work); })[0];
    return g || null;
  }

  function openOffers(s) {
    return s.offers.filter(function (o) { return o.open && !o.decided; });
  }
  function activeSlots(s) {
    return s.slots.filter(function (x) { return x.alive && x.got === null; });
  }
  function totalBacklog(s) { return activeSlots(s).length; }
  function pdpLiability(s) { return activeSlots(s).reduce(function (a, x) { return a + x.pdp; }, 0); }

  /* ---------- 操作 ---------- */
  function toggleOvertime(s) { s.pending.overtime = !s.pending.overtime; return s.pending.overtime; }
  function requestExpand(s) {
    if (s.expandReady !== null) return { ok: false, reason: '已经投过扩线了' };
    if (s.cash < CONFIG.expandCost) return { ok: false, reason: '现金不足 2.4 亿' };
    s.pending.expand = true;
    return { ok: true };
  }
  function requestHire(s, d) {
    if (!canHire(s, d)) return { ok: false, reason: '这个部门已经满编' };
    const n = s.pending.hires[d] || 0;
    if (s.cash < CONFIG.hireCost * (n + 1)) return { ok: false, reason: '现金不足' };
    s.pending.hires[d] = n + 1;
    return { ok: true };
  }
  function buyEngines(s, qty) {
    const unit = s.enginePrice || 0.35;          // 下单瞬间的单价
    const cost = qty * unit * 0.30;
    if (s.cash < cost) return { ok: false, reason: '现金不足 ' + cost.toFixed(2) + ' 亿' };
    s.pending.engines += qty;
    s.pending.enginesCost = (s.pending.enginesCost || 0) + cost;   // 价格快照
    s.pending.engineUnit = unit;
    return { ok: true, cost: cost, unit: unit };
  }
  function decideOffer(s, id, accept) {
    const o = s.offers.filter(function (x) { return x.id === id; })[0];
    if (!o || !o.open || o.decided) return { ok: false, reason: '这张单已经处理过了' };
    if (accept) { s.pending.accept.push(id); o.decided = 'accept'; }
    else { s.pending.decline.push(id); o.decided = 'decline'; }
    return { ok: true };
  }
  function canRelease(s) {
    return !s.flags.released && activeSlots(s).filter(function (x) { return x.plan > s.turn + 1; }).length >= 3;
  }
  function requestRelease(s) {
    if (!canRelease(s)) return { ok: false, reason: '没有可转租的机位' };
    s.pending.release = 3;
    return { ok: true };
  }
  function setFinance(s, kind) {
    if (s.finance) return { ok: false, reason: '融资已经定过了' };
    if (kind !== 'gov' && kind !== 'bank') return { ok: false, reason: '未知方案' };
    s.finance = kind;
    return { ok: true };
  }
  function setExtra(s, on) { s.pending.extra = !!on; }

  function requestProcess(s) {
    if (!s.pc) return { ok: false, reason: 'PC 之前谈不产量产成熟度' };
    if (s.processCooldown > s.turn) return { ok: false, reason: '工艺改进冷却中，第 ' + s.processCooldown + ' 季后可再做' };
    if (s.cash < CONFIG.processCost) return { ok: false, reason: '现金不足 ' + CONFIG.processCost + ' 亿' };
    s.pending.process = true;
    return { ok: true, cost: CONFIG.processCost };
  }

  function visitAirline(s, name) {
    const a = s.airlines[name];
    if (!a) return { ok: false, reason: '没有这个客户' };
    if (s.pending.visits.indexOf(name) >= 0) return { ok: false, reason: '本季已经拜访过了' };
    if (s.cash < 0.4) return { ok: false, reason: '现金不足 0.4 亿' };
    s.pending.visits.push(name);
    return { ok: true, cost: 0.4 };
  }

  function applyTurnStart(s) {
    s.event = null;
    s.stopTurn = null;
    s.capPenalty = 1;
    s.certBonus = 0;
    const id = s.schedule[s.turn];
    const now = id ? eventById(id) : null;
    if (now) {
      s.event = { title: now.title, text: now.text, kind: 'force', id: now.id };
      if (now.apply) now.apply(s);
    }
    const upId = s.schedule[s.turn + 1];
    const up = upId ? eventById(upId) : null;
    s.eventWarn = up ? { title: up.title, text: up.warn } : null;
    const beat = BEATS.filter(function (x) { return x.turn === s.turn && (!x.when || x.when(s)); })[0];
    s.story = beat ? { id: beat.id, type: beat.type, title: beat.title, text: beat.text, note: beat.note, a: beat.a, b: beat.b } : null;
  }


  /* ---------- 助理引导：前三季的分步脚本（纯数据，可被 Node 断言） ---------- */
  const ASSIST = {
    name: '林工', role: '项目助理', initials: 'L',
    steps: [
      { id: 's1-hello', season: 1, at: 'turn', turn: 1,
        text: '我是林工，这个型号的项目助理。从现在起我陪你走完前三季，之后你自己来。',
        next: '先看右上角：现金、在手订单、已交付。这三个数字后面每季都会变。',
        ops: [{ t: '知道了' }] },
      { id: 's1-money', season: 1, at: 'turn', turn: 1,
        text: '第一件事是钱。造飞机不靠自有资金，你只有 2 亿，研发每季烧 0.6 亿。',
        next: '点右上「融资」选方案。政府基金给得多但绑了 25 架承诺；银行贷款少，没附加条件。',
        ops: [{ t: '知道了' }] },
      { id: 's1-assign', season: 1, at: 'finance', turn: 1,
        text: '钱定了，接着派人。「技术流程」里五个部门产能不能互借，派到哪项工作就推进哪项。',
        next: '看不懂派哪个？点「一键执行这 N 条」，它按关键路径排。派完再自己改也行。',
        ops: [{ t: '去技术流程', tab: 'tech' }, { t: '知道了' }] },
      { id: 's1-commit', season: 1, at: 'assign', turn: 1,
        text: '派完就提交。提交后世界会结算，结果不可逆。',
        next: '底部三个勾都亮起、右边显示本季产出预估，就可以点「提交本季」了。',
        ops: [{ t: '知道了' }] },
      { id: 's2-engine', season: 2, at: 'turn', turn: 2,
        text: '第二季先说发动机。「采购」页锁件，下单到到货要三季，只能整批锁。',
        next: '现在锁 24 台，第九季前后到货。晚两季锁，产线就会在交付期空转。',
        ops: [{ t: '去采购', tab: 'buy' }, { t: '知道了' }] },
      { id: 's2-path', season: 2, at: 'turn', turn: 2,
        text: '看右侧「项目阶段」下面的关键路径：实心点现在就能动，空心点被前置挡着。',
        next: '想验证自己的判断，点「预测未来 12 季」——它按现有产能推演，不追加投入。',
        ops: [{ t: '知道了' }] },
      { id: 's3-order', season: 3, at: 'turn', turn: 3,
        text: '第三季会有第一家航司来问价。窗口和折扣比数量重要。',
        next: '「商务」页能看到窗口、折扣、定金。接单前先看产能，别接超出交付能力的单。',
        ops: [{ t: '去商务', tab: 'biz' }, { t: '知道了' }] },
      { id: 's3-customer', season: 3, at: 'turn', turn: 3,
        text: '客户不是抽象买家。「客户」页有它们的机队、关系、可靠性。',
        next: '花 0.4 亿拜访一次，关系 +8；关系越好，下一单折扣越浅。交付后它们会给你打可靠性分。',
        ops: [{ t: '去客户', tab: 'cust' }, { t: '知道了' }] },
      { id: 's3-end', season: 3, at: 'turn', turn: 4,
        text: '前三季到这儿。你手上应该有一张订单、一批在途发动机、一条在动的关键路径。',
        next: '后面十二季我不再插话。卡住了点「规则」和图鉴；想重来点「重开」。',
        ops: [{ t: '开始自己走' }] }
    ]
  };

  const ASSIST_EVIDENCE = {
    's1-hello': '顶栏 · 现金 / 在手 / 已交付',
    's1-money': '融资面板 · 研发 0.7 亿/季',
    's1-assign': '技术流程 · 部门产能与关键路径',
    's1-commit': '页脚 · 本季产出预估',
    's2-engine': '采购页 · 到货季 T+n+3',
    's2-path': '项目阶段 · 关键路径与预测',
    's3-order': '商务页 · 订单窗口与折扣',
    's3-customer': '客户页 · 关系 / 可靠性',
    's3-end': '结项 · 决策账本'
  };
  function assistEvidence(id) { return ASSIST_EVIDENCE[id] || ''; }

  function assistReady(s, step) {
    if (!s) return false;
    if (step.at === 'turn') return s.turn >= step.turn;
    if (step.at === 'finance') return !!s.finance;
    if (step.at === 'finance') return !!s.finance || s.turn > step.turn;
    if (step.at === 'assign') return Object.keys(s.pending.assign || {}).length > 0;
    return false;
  }
  /** 返回当前应展示的步骤（跳过已看过的、条件未满足的）；无则 null */
  function nextAssistStep(s, seen) {
    const done = seen || [];
    for (let i = 0; i < ASSIST.steps.length; i += 1) {
      const st = ASSIST.steps[i];
      if (done.indexOf(st.id) >= 0) continue;
      if (!assistReady(s, st)) return null;
      return st;
    }
    return null;
  }

  /* ---------- 决策辅助：关键路径、自动派工、预测 ---------- */
  function chainTo(s, id, out) {
    const w = workById(id);
    if (!w || workDone(s, id)) return out || [];
    const acc = out || [];
    w.req.forEach(function (r) { if (!workDone(s, r)) chainTo(s, r, acc); });
    if (acc.indexOf(id) < 0) acc.push(id);
    return acc;
  }

  function targetWork(s) {
    if (!s.tc) return s.extraCert && !s.extraCert.done ? 'EXTRA' : 'c5';
    if (!s.pc) return 'c6';
    return null;
  }

  function criticalPath(s) {
    const t = targetWork(s);
    if (!t) return [];
    const ids = chainTo(s, t, []);
    const items = ids.map(function (id, idx) {
      const w = workById(id);
      const ready = w.req.every(function (r) { return workDone(s, r); });
      return {
        id: id, n: w.n, dept: w.dept, ready: ready, seq: idx,
        need: needOf(s, id), done: workProgress(s, id),
        left: Math.max(0, needOf(s, id) - workProgress(s, id))
      };
    });
    // 现在就能动的排前面，其余按依赖顺序
    items.sort(function (a, b) {
      if (a.ready !== b.ready) return a.ready ? -1 : 1;
      return a.seq - b.seq;
    });
    return items;
  }

  function autoAssign(s) {
    const target = targetWork(s);
    const chain = target ? chainTo(s, target, []) : [];
    let guard = 0;
    while (guard++ < 60) {
      let moved = false;
      for (const d of DEPTS) {
        if (deptLeft(s, d.id) <= 0) continue;
        const cands = worksByDept(d.id, s)
          .filter(function (w) { return !workDone(s, w.id) && canAssign(s, w.id).ok; })
          .sort(function (a, b) {
            const ca = chain.indexOf(a.id) >= 0 ? 0 : 1;
            const cb = chain.indexOf(b.id) >= 0 ? 0 : 1;
            if (ca !== cb) return ca - cb;
            return workProgress(s, b.id) - workProgress(s, a.id);
          });
        if (!cands.length) continue;
        if (assignWork(s, cands[0].id).ok) moved = true;
      }
      if (!moved) break;
    }
    return s;
  }

  function clone(s) { return JSON.parse(JSON.stringify(s)); }

  /* 用"按当前节奏继续"的默认策略向后推演，给玩家一个不带承诺的预测 */
  function forecast(s, horizon) {
    const c = clone(s);
    const h = horizon || 12;
    let minCash = Infinity;
    let tc = c.tc, pc = c.pc, firstDel = null;
    const startDel = c.delivered;
    let guard = 0;
    while (guard++ < h && c.turn <= CONFIG.maxTurn && !c.ending) {
      // 默认策略：派满产能、发动机见底就补、不接新单
      if (c.tc && c.engines < 8 && c.engineOrders.length === 0 && c.cash > 2) buyEngines(c, 24);
      autoAssign(c);
      commit(c);
      if (!tc && c.tc) tc = c.tc;
      if (!pc && c.pc) pc = c.pc;
      if (firstDel === null && c.delivered > startDel) firstDel = c.turn - 1;
      minCash = Math.min(minCash, c.cash);
    }
    return {
      fromTurn: s.turn, horizon: h,
      tc: tc, pc: pc, firstDelivery: firstDel,
      minCash: minCash, delivered: c.delivered, maturity: c.maturity,
      ending: c.ending ? c.ending.id : null
    };
  }

  /* ---------- 引导模式：给出可一键执行的建议动作 ---------- */
  function suggest(s) {
    const out = [];
    const left = Object.keys(s.pending.assign).length === 0;
    const idle = DEPTS.filter(function (d) {
      return deptLeft(s, d.id) > 0 && worksByDept(d.id, s).some(function (w) {
        return !workDone(s, w.id) && canAssign(s, w.id).ok;
      });
    });
    if (left && idle.length) {
      const total = idle.reduce(function (a, d) { return a + deptLeft(s, d.id); }, 0);
      out.push({
        id: 'assign', label: '按关键路径派工',
        detail: idle.map(function (d) { return d.n; }).join('、') + ' 共 ' + total + ' 点产能',
        run: function (st) { autoAssign(st); return true; }
      });
    }
    const ng = nextGate(s);
    const turnsToGate = ng ? GATES.indexOf(ng) : 9;
    if (!s.pending.expand && s.expandReady === null && s.cash > 3.2 && s.turn <= 12) {
      out.push({
        id: 'expand', label: '投扩线 2.4 亿',
        detail: '两季后第二个总装位投产，产能翻倍',
        run: function (st) { return requestExpand(st).ok; }
      });
    }
    if (s.tc && s.engines < 10 && s.engineOrders.length === 0 && s.cash > 4) {
      out.push({
        id: 'engine', label: '锁定 24 台发动机',
        detail: '预付 ' + (24 * (s.enginePrice || 0.35) * 0.3).toFixed(2) + ' 亿，三季后到货',
        run: function (st) { return buyEngines(st, 24).ok; }
      });
    }
    if (!s.tc && s.cash > 5) {
      const target = DEPTS.filter(function (d) {
        return canHire(s, d.id) && worksByDept(d.id, s).some(function (w) { return !workDone(s, w.id); });
      })[0];
      if (target && (s.pending.hires[target.id] || 0) === 0) {
        out.push({
          id: 'hire', label: '增聘 1 名' + target.unit + '（' + target.n + '）',
          detail: '0.8 亿，当季到岗，关键路径会变短',
          run: function (st) { return requestHire(st, target.id).ok; }
        });
      }
    }
    openOffers(s).forEach(function (o) {
      const width = o.win[1] - o.win[0];
      const good = width >= 5 && o.disc <= 0.2;
      out.push({
        id: 'offer-' + o.id,
        label: (good ? '接受 ' : '暂缓 ') + o.cust + ' ' + o.qty + ' 架',
        detail: '窗口 T' + o.win[0] + '–T' + o.win[1] + ' · 折扣 ' + Math.round(o.disc * 100) + '% · ' + (good ? '窗口宽，能消化' : '窗口紧，接之前先看产能'),
        run: function (st) { return good ? decideOffer(st, o.id, true).ok : true; }
      });
    });
    return out.slice(0, 5);
  }


  /* ---------- 第三章垂直切片：箭体成本模型（供 UI 与测试共用） ---------- */
  const ROCKET = {
    price: 6.0, contract: 12, quarters: 8,
    expendable: { unit: 4.2, dev: 0, devSpan: 0, rate: 2 },
    reusable: { unit: 1.32, dev: 18, devSpan: 3, rate: 3 }
  };
  function rocketCalc(route, startCash) {
    const p = ROCKET[route];
    if (!p) return null;
    const rows = [];
    let cash = startCash == null ? 8 : startCash;
    let flown = 0;
    let minCash = cash;
    for (let q = 1; q <= ROCKET.quarters; q += 1) {
      const dev = p.dev > 0 && q <= p.devSpan ? p.dev / p.devSpan : 0;
      const canFly = q > (p.dev > 0 ? p.devSpan : 0);
      const n = canFly ? Math.min(p.rate, ROCKET.contract - flown) : 0;
      const gross = n * (ROCKET.price - p.unit);
      cash += gross - dev;
      flown += n;
      minCash = Math.min(minCash, cash);
      rows.push({ q: q, dev: dev, n: n, gross: gross, cash: cash });
    }
    return { rows: rows, cash: cash, flown: flown, unit: p.unit, dev: p.dev, minCash: minCash };
  }
  function rocketBreakEven() {
    const marginExp = ROCKET.price - ROCKET.expendable.unit;
    const marginReuse = ROCKET.price - ROCKET.reusable.unit;
    return ROCKET.reusable.dev / (marginReuse - marginExp);
  }


  /* ---------- Phase 1：决策预览 / 复盘 / 账本 ---------- */
  function clearPending(s) {
    const c = clone(s);
    c.pending = { overtime: false, expand: false, hires: {}, engines: 0, assign: {}, accept: [], decline: [],
      release: 0, extra: false, story: null, visits: [], enginesCost: 0, engineUnit: 0.35 };
    return c;
  }

  /** 只读预测：对比"本季决策全不做"与"按当前决策做"，最多 5 条差异 */
  function previewDelta(s, horizon) {
    const base = forecast(clearPending(s), horizon || 8);
    const now = forecast(clone(s), horizon || 8);
    const out = [];
    function diff(label, a, b) { if (String(a) !== String(b)) out.push({ label: label, from: a, to: b }); }
    diff('预计 TC', base.tc || '—', now.tc || '—');
    diff('预计 PC', base.pc || '—', now.pc || '—');
    diff('首架交付', base.firstDelivery || '—', now.firstDelivery || '—');
    diff('现金最低点', base.minCash.toFixed(1) + ' 亿', now.minCash.toFixed(1) + ' 亿');
    diff('期末交付', base.delivered + ' 架', now.delivered + ' 架');
    return out.slice(0, 5);
  }

  /** 季度复盘：五类指标，每类带来源字段 */
  function buildReview(s, r) {
    const items = [];
    const delta = r.cashEnd - r.cashStart;
    items.push({ k: '现金', v: r.cashEnd.toFixed(2) + ' 亿',
      why: (delta >= 0 ? '净流入 ' : '净流出 ') + Math.abs(delta).toFixed(2) + ' 亿', src: 'report.cashEnd-cashStart' });
    const gatesDone = GATES.filter(function (g) { return workDone(s, g.work); }).length;
    const doneNow = (r.notes || []).filter(function (n) { return n.indexOf('【完成】') === 0; }).length;
    items.push({ k: '工作项/门', v: gatesDone + ' / ' + GATES.length + ' 道门',
      why: doneNow ? '本季完成 ' + doneNow + ' 个工作项' : '本季没有工作项闭环', src: 'works / gates' });
    items.push({ k: '质量', v: String(s.quality),
      why: s.quality < 55 ? '低于 55，产能打九折' : (r.notes || []).some(function (n) { return n.indexOf('加班') >= 0; }) ? '加班提产拉低质量' : '随季度回归回升',
      src: 'quality' });
    items.push({ k: '信誉', v: String(s.rep),
      why: r.penalties.length ? '逾期取消 ' + r.penalties.length + ' 架' : '交付与回响累积', src: 'rep / report.penalties' });
    const backlog = activeSlots(s).length;
    items.push({ k: '订单', v: backlog + ' 架在手',
      why: r.deliveredTotal ? '累计交付 ' + r.deliveredTotal + ' 架' : '尚未开始交付', src: 'slots / deliveredTotal' });
    if (s.pc) {
      items.push({ k: '量产成熟度', v: String(s.maturity),
        why: s.maturity < CONFIG.maturityRiskAt ? '已进入风险区：加班/配置负荷/质量在侵蚀产线' : s.maturity < CONFIG.maturityWarnAt ? '返工压力偏大，考虑工艺改进' : '产线状态稳定',
        src: 'maturity' });
    }
    const g = nextGate(s);
    let next = '五道门已全部通过，接下来盯产能与发动机。';
    if (g) {
      const w = workById(g.work);
      const miss = w.req.filter(function (x) { return !workDone(s, x); }).map(function (x) { return workById(x).n; });
      next = miss.length ? '下一季先补 ' + miss[0] + '，它是「' + g.n + '」的前置。' : '下一季直接推进「' + w.n + '」，这是当前门的关键项。';
    }
    return { items: items, next: next };
  }

  /** 每季 1–3 条关键决策（纯记账，不影响经济） */
  function recordLedger(s, t, p, storyPick) {
    const acts = [];
    if (p.expand) acts.push('投扩线 2.4 亿');
    Object.keys(p.hires || {}).forEach(function (d) {
      const def = DEPTS.filter(function (x) { return x.id === d; })[0];
      if (def) acts.push('增聘 ' + def.n + ' ×' + p.hires[d]);
    });
    if (p.engines) acts.push('锁定 ' + p.engines + ' 台发动机');
    (p.accept || []).forEach(function (id) {
      const o = OFFERS.filter(function (x) { return x.id === id; })[0];
      if (o) acts.push('接单 ' + o.cust + ' ' + o.qty + ' 架');
    });
    if (p.overtime) acts.push('加班提产（成熟度 -' + CONFIG.maturityOvertimeCost + '）');
    if (p.process) acts.push('工艺改进');
    if (s.pc && s.maturity < CONFIG.maturityRiskAt && (s.pending.process || true)) { /* 由外层记录 */ }
    if (storyPick && s.story) acts.push('抉择「' + s.story.title + '」');
    if (acts.length) s.ledger.push({ turn: t, acts: acts.slice(0, 3) });
  }

  /** 结局账本摘要：只做归因，不新增胜负条件 */
  function ledgerSummary(s) {
    let best = null, costly = null;
    s.history.forEach(function (h, i) {
      const prev = i > 0 ? s.history[i - 1].cash : s.ledgerStartCash;
      const d = h.cash - (prev == null ? h.cash : prev);
      if (!best || d > best.d) best = { turn: h.turn, d: d };
      if (!costly || d < costly.d) costly = { turn: h.turn, d: d };
    });
    const gateTurn = {};
    s.log.forEach(function (r) {
      (r.notes || []).forEach(function (n) {
        if (n.indexOf('【完成】') === 0) gateTurn[n.replace('【完成】', '').split(' ——')[0]] = r.turn;
      });
    });
    const flat = s.ledger.reduce(function (a, x) { return a.concat(x.acts); }, []);
    return {
      variant: { seat: s.seat, route: s.route },
      seed: s.seed,
      best: best ? '第 ' + best.turn + ' 季（现金变动 ' + best.d.toFixed(2) + ' 亿）' : '—',
      costly: costly ? '第 ' + costly.turn + ' 季（现金变动 ' + costly.d.toFixed(2) + ' 亿）' : '—',
      lateMaturity: (function () {
        const hit = s.log.filter(function (r) { return s.pc && r.turn >= s.pc; });
        return hit.length && s.maturity < CONFIG.maturityRiskAt ? '结项时仍在风险区（' + s.maturity + '）' : '未进入风险区';
      })(),
      lateGate: Object.keys(gateTurn).length ? Object.keys(gateTurn).sort(function (a, b) { return gateTurn[b] - gateTurn[a]; })[0] + '（第 ' + gateTurn[Object.keys(gateTurn).sort(function (a, b) { return gateTurn[b] - gateTurn[a]; })[0]] + ' 季完成）' : '—',
      echoes: s.echoes.map(function (e) { return '第' + e.turn + '季「' + e.title + '」'; }),
      decisions: flat.slice(0, 8),
      events: Object.keys(s.schedule).map(function (k) { return 'T' + k + ' ' + (eventById(s.schedule[k]) || {}).title; })
    };
  }

  /* Phase 2.5：成熟度风险投影（只读，PC 前也可用） */
  function maturityRisk(s) {
    const reasons = [];
    let score = s.maturity != null ? s.maturity : CONFIG.maturityStart;
    if (s.pending && s.pending.overtime) { score -= CONFIG.maturityOvertimeCost; reasons.push('本季加班 -' + CONFIG.maturityOvertimeCost); }
    if (s.configLoad > 0) { score -= s.configLoad * CONFIG.maturityConfigCost; reasons.push('配置负荷 ' + s.configLoad + ' → -' + (s.configLoad * CONFIG.maturityConfigCost)); }
    if (s.quality < CONFIG.maturityQualityRef) {
      const d = Math.ceil((CONFIG.maturityQualityRef - s.quality) / 10);
      score -= d; reasons.push('质量 ' + s.quality + ' 低于 ' + CONFIG.maturityQualityRef + ' → -' + d);
    }
    const projected = Math.max(CONFIG.maturityFloor, Math.min(100, score + CONFIG.maturityGainPerQuarter));
    return {
      current: s.maturity,
      projected: projected,
      level: projected < CONFIG.maturityRiskAt ? 'risk' : 'ok',
      reasons: reasons,
      active: !!s.pc,
      fixCost: CONFIG.processCost,
      fixGain: CONFIG.processGain,
      cooldown: s.processCooldown || 0
    };
  }

  function maturityTrend(s) {
    return (s.maturityHistory || []).map(function (h) {
      return { turn: h.turn, value: h.value, delta: h.delta, threshold: h.threshold, level: h.value < h.threshold ? "risk" : "ok", parts: h.parts };
    });
  }

  /* ---------- 结算 ---------- */
  function commit(s) {
    const cashStart = s.cash;
    const matBefore = s.maturity;
    const r = { turn: s.turn, cashStart: cashStart, lines: [], notes: [], events: [], penalties: [], attribution: null };
    const p = s.pending;
    const t = s.turn;

    if (s.finance === 'gov' && !s.flags.govPaid) {
      s.cash += 11.0; s.flags.govPaid = true;
      r.lines.push({ k: '政府产业基金 6.0 + 银行贷款 5.0', v: 11.0 });
      r.notes.push('资金到账 11 亿。基金附条件：结项时累计交付不足 25 架，退还 3 亿并扣信誉。');
    } else if (s.finance === 'bank' && !s.flags.bankPaid) {
      s.cash += 3.0; s.flags.bankPaid = true;
      r.lines.push({ k: '银行贷款 3.0', v: 3.0 });
      r.notes.push('资金到账 3 亿，无附加条件。');
    }

    const rd = s.rdRate || CONFIG.rdPerTurn;
    s.cash -= rd;
    r.lines.push({ k: '研发与部门开支', v: -rd });
    if (s.flags.govPaid || s.flags.bankPaid) {
      const it = s.finance === 'gov' ? 5.0 * CONFIG.interest : 3.0 * CONFIG.interest;
      s.cash -= it;
      r.lines.push({ k: '贷款利息', v: -it });
    }

    if (p.expand) {
      s.cash -= CONFIG.expandCost;
      s.expandReady = t + CONFIG.expandLead;
      r.lines.push({ k: '扩线投资（2 季生效）', v: -CONFIG.expandCost });
      r.notes.push('第二条总装位开工，第 ' + s.expandReady + ' 季投产。');
    }
    let hireCount = 0;
    Object.keys(p.hires).forEach(function (d) {
      const n = p.hires[d];
      if (!n) return;
      s.cash -= CONFIG.hireCost * n;
      s.depts[d] += n;
      hireCount += n;
      const def = DEPTS.filter(function (x) { return x.id === d; })[0];
      r.notes.push(def.n + '增至 ' + s.depts[d] + ' ' + def.unit + '。');
    });
    if (hireCount) r.lines.push({ k: '增聘 ' + hireCount + ' 人', v: -CONFIG.hireCost * hireCount });

    if (p.visits && p.visits.length) {
      const cost = p.visits.length * 0.4;
      s.cash -= cost;
      p.visits.forEach(function (n) {
        if (s.airlines[n]) s.airlines[n].rel = Math.min(100, s.airlines[n].rel + 8);
      });
      r.lines.push({ k: '客户拜访 ×' + p.visits.length, v: -cost });
      r.notes.push('拜访了 ' + p.visits.join('、') + '，关系改善，后续议价空间变大。');
      s.visits = s.visits.concat(p.visits);
    }

    if (p.engines > 0) {
      const c = p.enginesCost != null ? p.enginesCost : p.engines * (s.enginePrice || 0.35) * 0.30;
      s.cash -= c;
      s.engineOrders.push({ arrive: t + 3, qty: p.engines, unit: p.engineUnit || s.enginePrice || 0.35 });
      r.lines.push({ k: '锁定发动机 ' + p.engines + ' 台（30% 预付）', v: -c });
      r.notes.push(p.engines + ' 台发动机将在第 ' + (t + 3) + ' 季到货。');
    }
    if (p.release > 0) {
      let n = 0;
      activeSlots(s).forEach(function (x) {
        if (n < 3 && x.plan > t + 1 && !x.released) { x.released = true; x.disc = 0.22; n += 1; }
      });
      const cashIn = n * CONFIG.price * CONFIG.pdpEarly;
      s.cash += cashIn;
      s.flags.released = true;
      p.release = 0;
      r.lines.push({ k: '机位转租 ×' + n + '（收预付款）', v: cashIn });
    }
    if (p.process) {
      s.cash -= CONFIG.processCost;
      s.maturity = Math.min(100, s.maturity + CONFIG.processGain);
      s.maturityFloorBoost = Math.min(25, (s.maturityFloorBoost || 0) + 8);
      s.processCooldown = t + CONFIG.processCooldown;
      r.lines.push({ k: '工艺改进（成熟度 +' + CONFIG.processGain + '）', v: -CONFIG.processCost });
      r.notes.push('工艺改进落地：成熟度升到 ' + s.maturity + '，返工压力下降。');
    }

    if (p.overtime) {
      s.cash -= 0.12; s.quality -= 6;
      r.lines.push({ k: '加班提产', v: -0.12 });
      r.notes.push('本季产能 ×1.25，质量 -6。');
    }

    /* 接单 */
    p.accept.forEach(function (id) {
      const o = s.offers.filter(function (x) { return x.id === id; })[0];
      if (!o) return;
      const relA = s.airlines[o.cust];
      const relBonus = relA ? Math.max(0, (relA.rel - 50)) / 100 * 0.03 : 0;
      const tpl = CONFIG_TPL[o.config || 'std'] || CONFIG_TPL.std;
      const disc = Math.min(0.30, Math.max(0.05, o.disc + s.discShift - relBonus + tpl.disc));
      s.configLoad += tpl.load;
      const a = o.win[0], b = o.win[1];
      const qty = Math.max(4, Math.round(o.qty * (s.qtyScale || 1)));
      for (let i = 0; i < qty; i += 1) {
        const plan = Math.max(1, a + Math.floor((i * (b - a + 1)) / o.qty) + tpl.shift);
        s.slots.push({ id: s.nextSlot++, cust: o.cust, plan: plan, disc: disc, got: null, alive: true, pdp: 0, released: false });
      }
      const dep = qty * CONFIG.price * (1 - disc) * CONFIG.deposit;
      s.cash += dep;
      r.lines.push({ k: o.cust + ' 签约 ' + qty + ' 架（定金 5%）', v: dep });
      r.notes.push(o.cust + ' 的 ' + qty + ' 个机位排在第 ' + a + '–' + b + ' 季，折扣 ' + Math.round(disc * 100) + '%。');
    });
    p.decline.forEach(function (id) {
      const o = s.offers.filter(function (x) { return x.id === id; })[0];
      if (o) { s.rep -= 1; r.notes.push('拒绝了 ' + o.cust + '，信誉 -1。'); }
    });

    /* 技术工作推进 */
    const doneNow = [];
    Object.keys(p.assign).forEach(function (id) {
      const n = p.assign[id];
      if (!n) return;
      const w = workById(id);
      if (id === 'EXTRA') {
        if (s.extraCert && !s.extraCert.done && n >= 1) {
          s.extraCert.done = true;
          doneNow.push(w);
        }
        return;
      }
      s.works[id] = (s.works[id] || 0) + n;
      if ((s.works[id] || 0) >= w.need && !s.flags['done' + id]) {
        s.flags['done' + id] = true;
        doneNow.push(w);
      }
    });
    doneNow.forEach(function (w) { r.notes.push('【完成】' + w.n + ' —— ' + w.out); });

    if (s.extraCert && !s.extraCert.done) {
      r.notes.push('加试单未处理：「' + s.extraCert.n + '」继续挡着 TC。把适航部的人力派给它。');
    }

    /* 发动机到货 */
    const arrived = s.engineOrders.filter(function (x) { return x.arrive <= t; });
    arrived.forEach(function (x) { s.engines += x.qty; });
    s.engineOrders = s.engineOrders.filter(function (x) { return x.arrive > t; });
    if (arrived.length) {
      const q = arrived.reduce(function (a, x) { return a + x.qty; }, 0);
      r.notes.push(q + ' 台发动机到货，库存 ' + s.engines + ' 台。');
    }

    recordLedger(s, t, p, p.story);

    /* 故事选择 */
    if (s.story) {
      const beat = BEATS.filter(function (x) { return x.id === s.story.id; })[0];
      if (beat && beat.type === 'note') {
        if (beat.apply) beat.apply(s);
        r.story = { title: beat.title, kind: 'note' };
        r.notes.push('【情节】' + beat.title + (beat.note ? ' —— ' + beat.note : ''));
      } else if (beat) {
        const pick = p.story || 'a';
        const choice = pick === 'a' ? beat.a : beat.b;
        s.storyLog.push({ turn: t, id: beat.id, pick: pick, label: choice.label });
        s.echoFlags[beat.id + ':' + pick] = true;
        s.echoes.push({ turn: t, id: beat.id, pick: pick, title: beat.title });
        if (beat.id === 'dinner') {
          if (pick === 'a') {
            s.enginePrice = 0.35 * 0.92;
            s.engineOrders.forEach(function (o) { o.arrive = Math.max(t + 1, o.arrive - 1); });
            s.works.m1 = (s.works.m1 || 0);
          }
        } else if (beat.id === 'review') {
          if (pick === 'a') { s.quality = Math.min(100, s.quality + 8); s.rep = Math.min(100, s.rep + 3); s.storyDelay = (s.storyDelay || 0) + 1; }
          else { s.quality -= 5; }
        } else if (beat.id === 'ip') {
          if (pick === 'a') { s.works.f4 = Math.max(0, (s.works.f4 || 0) - 1); }
          else { s.works.c4 = Math.max(0, (s.works.c4 || 0) - 1); s.rep -= 2; }
        }
        r.story = { title: beat.title, pick: pick, label: choice.label };
        r.notes.push('【决定】' + beat.title + ' → ' + choice.label);
        // 跨季度回响
        if (beat.id === 'dinner' && pick === 'a' && t >= 9) {
          s.rep = Math.min(100, s.rep + 1);
          r.notes.push('【回响】晚宴上答应的提前锁件，让第二批发动机早到一季，试飞节奏没被打断。');
        }
        if (beat.id === 'review' && pick === 'a') {
          s.quality = Math.min(100, s.quality + 2);
          r.notes.push('【回响】推迟的那两周换来了更干净的包线数据，后面没再返工。');
        }
        if (beat.id === 'ip' && pick === 'a') {
          s.rep = Math.min(100, s.rep + 2);
          r.notes.push('【回响】补飞的那个架次后来救了一版符合性文件，局方没有再追问。');
        }
      }
    }

    /* 事件播报 */
    if (s.event) r.events.push({ title: s.event.title, text: s.event.text });

    /* 门：TC / PC */
    if (!s.tc && workDone(s, 'c5') && (!s.extraCert || s.extraCert.done)) {
      s.tc = t;
      r.notes.push('TC 型号合格证取得。总装线可以开始生产，但要等 PC 才能交付。');
    }
    if (!s.pc && s.tc && workDone(s, 'c6')) {
      s.pc = t;
      r.notes.push('PC 生产许可证取得，本季起可以交付。');
    }

    /* 产能 */
    if (s.expandReady === t) { s.k = 2; r.notes.push('第二条总装位投产，理论产能翻倍。'); }
    let cap = capacity(s);
    if (p.overtime) cap *= 1.25;
    if (s.stopTurn === t) cap *= 0.55;
    if (s.capPenalty && s.capPenalty < 1) cap *= s.capPenalty;
    if (s.quality < CONFIG.qualityFloor) cap *= CONFIG.reworkFactor;
    // Phase 2：量产成熟度只在 PC 之后影响产能，与 quality 独立
    let maturityLoss = 0;
    if (s.pc) {
      const gap = Math.max(0, (100 - s.maturity) / 100);
      maturityLoss = gap * CONFIG.maturityReworkCap;
      cap *= (1 - maturityLoss);
      if (s.configLoad > 0) cap *= (1 - Math.min(CONFIG.configLoadCap, s.configLoad * 0.02));
    }

    let deliver = 0;
    const matAvail = Math.floor(s.engines / 2);
    if (s.tc) {
      s.progress = (s.progress || 0) + cap;
      if (s.pc) {
        const lineOut = Math.floor(s.progress + 1e-9);
        deliver = Math.min(lineOut, matAvail);
        s.progress = Math.max(0, s.progress - deliver);
      }
    } else {
      s.progress = 0;
    }

    /* PDP */
    let pdpIn = 0;
    activeSlots(s).forEach(function (x) {
      const pr = slotPrice(s, x);
      if (t === x.plan - 3) { x.pdp += pr * CONFIG.pdpEarly; pdpIn += pr * CONFIG.pdpEarly; }
      if (t === x.plan - 1) { x.pdp += pr * CONFIG.pdpLate; pdpIn += pr * CONFIG.pdpLate; }
    });
    if (pdpIn > 0) { s.cash += pdpIn; r.lines.push({ k: '预付货款到账', v: pdpIn }); }

    /* 交付 */
    const queue = activeSlots(s).sort(function (a, b) { return a.plan - b.plan; });
    let lateCount = 0;
    for (let i = 0; i < deliver && i < queue.length; i += 1) {
      const x = queue[i];
      const pr = slotPrice(s, x);
      const cost = unitCost(s);
      const unpaid = 1 - CONFIG.deposit - x.pdp / pr;
      s.cash += pr * (unpaid - CONFIG.tailRate) - cost;
      s.tail.push({ at: t + 2, amount: pr * CONFIG.tailRate, cust: x.cust });
      x.got = t;
      s.delivered += 1;
      if (s.airlines[x.cust]) {
        s.airlines[x.cust].got += 1;
        const a = s.airlines[x.cust];
        const score = Math.max(0, Math.min(100, Math.round(s.quality * 0.6 + s.maturity * 0.4)));
        const good = score >= 70;
        a.rel = Math.max(0, Math.min(100, a.rel + (good ? 2 : -2)));
        s.feedback.push({ turn: t, cust: x.cust, score: score,
          text: good ? '首架运行三个月，客舱与系统投诉低于预期。' : '首架运行三个月，返工项被记录，要求下批改进。' });
      }
      if (x.plan >= t) s.rep = Math.min(100, s.rep + 2);
      else { lateCount += 1; s.rep -= 3; }
    }
    if (s.pc && deliver > 0) {
      if (s.maturity < CONFIG.maturityIssueAt && deliver > 0) {
        deliver -= 1;
        r.notes.push('交付检查不合格 1 架：成熟度 ' + s.maturity + ' 低于 ' + CONFIG.maturityIssueAt + '，返工后重检。');
      }
      s.maturity = Math.min(100, s.maturity + Math.min(2, CONFIG.maturityGainPerDelivery * deliver));
    }
    if (s.pc) {
      let delta = CONFIG.maturityGainPerQuarter;
      if (p.overtime) delta -= CONFIG.maturityOvertimeCost;
      delta -= (s.configLoad || 0) * CONFIG.maturityConfigCost;
      if (s.quality < CONFIG.maturityQualityRef) delta -= Math.ceil((CONFIG.maturityQualityRef - s.quality) / 10);
      const floorNow = Math.max(CONFIG.maturityFloor, s.maturityFloorBoost || 0);
      s.maturity = Math.max(floorNow, Math.min(100, s.maturity + delta));
      if (delta < 0) r.notes.push('产线压力侵蚀成熟度 ' + Math.abs(delta) + ' 点（加班/配置负荷/质量）。');
    }

    if (deliver > 0) {
      s.engines -= deliver * 2;
      r.lines.push({ k: '交付 ' + deliver + ' 架（交付款 - 成本）', v: '见明细' });
      r.attribution = cap <= matAvail
        ? (s.stopTurn === t ? '本季上限由停线决定：03 工位缺件，产能只剩 55%。'
          : s.quality < CONFIG.qualityFloor ? '本季上限由返工决定：质量低于 55，产能 ×0.9。'
            : '本季上限由工位节拍决定：' + Math.round(effectiveCycle(s)) + ' 天/架 × ' + s.k + ' 个总装位。')
        : '本季上限由发动机库存决定：可装 ' + matAvail + ' 架。';
    } else if (!s.tc) {
    } else if (!s.tc) {
      const g = nextGate(s);
      r.attribution = '本季交付为 0：还没拿到型号合格证。当前卡在「' + (g ? g.n : '—') + '」。';
    } else if (!s.pc) {
      const w = WORKS.filter(function (x) { return x.dept === 'cert' && !workDone(s, x.id); })[0];
      r.attribution = '本季交付为 0：已取 TC，但 PC 还没下来。局方要确认你能稳定造出合格的飞机。' + (w ? '下一步：' + w.n + '。' : '');
    } else {
      r.attribution = '本季交付为 0：没有可交付的机位或发动机库存为 0。';
    }

    /* 逾期 */
    s.slots.forEach(function (x) {
      if (!x.alive || x.got !== null) return;
      const win = s.offers.filter(function (o) { return o.cust === x.cust; })[0];
      const end = win ? win.win[1] : 99;
      if (t > end) {
        x.alive = false;
        const pr = slotPrice(s, x);
        const refund = x.pdp * CONFIG.refundRate;
        const penalty = pr * CONFIG.penaltyRate;
        s.cash -= refund + penalty;
        s.rep -= 8;
        r.penalties.push({ cust: x.cust, refund: refund, penalty: penalty });
      }
    });

    /* 尾款 */
    s.tail = s.tail.filter(function (x) {
      if (x.at <= t) { s.cash += x.amount; r.lines.push({ k: x.cust + ' 尾款', v: x.amount }); return false; }
      return true;
    });
    if (!p.overtime) s.quality = Math.min(100, s.quality + 2);

    /* 航司侧的运行反馈：交付过的客户每季给出可靠性评分，回流到信誉 */
    Object.keys(s.airlines).forEach(function (k) {
      const a = s.airlines[k];
      if (a.got > 0) {
        const score = Math.max(0, Math.min(100, Math.round(s.quality - 8 + (a.rel - 50) * 0.25)));
        a.rel9 = score;
        if (score >= 70) s.rep = Math.min(100, s.rep + 1);
        else if (score < 55) s.rep = Math.max(0, s.rep - 1);
      }
    });

    r.cashEnd = s.cash;
    if (s.pc) {
      const deliveryGain = Math.min(2, CONFIG.maturityGainPerDelivery * deliver);
      const parts = {
        base: CONFIG.maturityGainPerQuarter,
        overtime: p.overtime ? -CONFIG.maturityOvertimeCost : 0,
        config: -(s.configLoad || 0) * CONFIG.maturityConfigCost,
        quality: s.quality < CONFIG.maturityQualityRef ? -Math.ceil((CONFIG.maturityQualityRef - s.quality) / 10) : 0,
        delivery: deliveryGain,
        process: p.process ? CONFIG.processGain : 0
      };
      s.maturityHistory.push({
        turn: t, value: s.maturity, delta: s.maturity - matBefore,
        threshold: CONFIG.maturityRiskAt, parts: parts
      });
      if (s.maturityHistory.length > CONFIG.maxTurn) s.maturityHistory.shift();
    }
    r.review = buildReview(s, r);
    r.deliveredTotal = s.delivered;
    r.capacity = cap;
    r.enginesLeft = s.engines;
    r.nextGate = nextGate(s);

    s.history.push({ turn: t, cap: cap, deliver: deliver, total: s.delivered, cash: s.cash, quality: s.quality, rep: s.rep });
    s.lastReport = r;
    s.log.push(r);

    s.turn = t + 1;
    s.pending = { overtime: false, expand: false, hires: {}, engines: 0, assign: {}, accept: [], decline: [], release: 0, extra: false, story: null, visits: [], enginesCost: 0, engineUnit: 0.35 };
    s.offers.forEach(function (o) { if (o.turn === s.turn) o.open = true; });
    s.offers.forEach(function (o) { if (o.open && !o.decided && s.turn - o.turn > 3) o.decided = 'expired'; });
    if (s.turn <= CONFIG.maxTurn) applyTurnStart(s);

    if (s.cash < -3) {
      s.ending = { id: 'bankrupt', title: '董事会接管', text: '第 ' + t + ' 季现金跌到 ' + s.cash.toFixed(2) + ' 亿，项目被接管。' };
    } else if (s.turn > CONFIG.maxTurn) {
      const left = activeSlots(s);
      let refund = 0, pen = 0;
      left.forEach(function (x) {
        refund += x.pdp * CONFIG.refundRate;
        pen += slotPrice(s, x) * CONFIG.penaltyRate;
        x.alive = false;
      });
      s.cash -= refund + pen;
      s.rep = Math.max(0, s.rep - left.length * 2);
      s.endingAccount = { refund: refund, penalty: pen, slots: left.length };
      if (left.length) r.notes.push('结项清账：' + left.length + ' 个未交付机位退还预付款 ' + refund.toFixed(2) + ' 亿，赔付违约金 ' + pen.toFixed(2) + ' 亿。');
      if (s.finance === 'gov' && s.delivered < CONFIG.target) {
        s.cash -= 3; s.rep -= 10;
        r.notes.push('未达成交付承诺，退还政府基金 3 亿并扣信誉 10。');
      }
      if (s.delivered >= CONFIG.target && s.cash > 0) {
        s.ending = { id: 'win', title: '通关 · 续任', text: '交付 ' + s.delivered + ' 架，净现金 ' + s.cash.toFixed(2) + ' 亿。' };
      } else if (s.delivered >= 15) {
        s.ending = { id: 'demote', title: '降级为技术验证机', text: '交付 ' + s.delivered + ' 架，未达 25 架里程碑，净现金 ' + s.cash.toFixed(2) + ' 亿。' };
      } else {
        s.ending = { id: 'fail', title: '项目终止', text: '交付 ' + s.delivered + ' 架。' };
      }
    }
    return r;
  }

  const api = {
    CONFIG_TPL: CONFIG_TPL,
    CONFIG: CONFIG, DEPTS: DEPTS, WORKS: WORKS, GATES: GATES, OFFERS: OFFERS, EVENT_POOL: EVENT_POOL, BEATS: BEATS, needOf: needOf,
    maturityRisk: maturityRisk, maturityTrend: maturityTrend, ROCKET: ROCKET, rocketCalc: rocketCalc, requestProcess: requestProcess, assistEvidence: assistEvidence, rocketBreakEven: rocketBreakEven, previewDelta: previewDelta, buildReview: buildReview, ledgerSummary: ledgerSummary, clearPending: clearPending, ASSIST: ASSIST, nextAssistStep: nextAssistStep, assistReady: assistReady,
    newGame: newGame, applyTurnStart: applyTurnStart,
    capacity: capacity, effectiveCycle: effectiveCycle, unitCost: unitCost,
    slotPrice: slotPrice, slotPrice2: slotPrice2,
    workById: workById, worksByDept: worksByDept, allWorks: allWorks, workDone: workDone, workProgress: workProgress,
    reqMet: reqMet, deptCap: deptCap, deptLeft: deptLeft, deptUsed: deptUsed,
    canHire: canHire, canAssign: canAssign, assignWork: assignWork, unassignWork: unassignWork,
    gateState: gateState, nextGate: nextGate, suggest: suggest, chainTo: chainTo, targetWork: targetWork, criticalPath: criticalPath, autoAssign: autoAssign, clone: clone, forecast: forecast, scheduleEvents: scheduleEvents,
    openOffers: openOffers, activeSlots: activeSlots, totalBacklog: totalBacklog, pdpLiability: pdpLiability,
    toggleOvertime: toggleOvertime, requestExpand: requestExpand, requestHire: requestHire,
    buyEngines: buyEngines, decideOffer: decideOffer, canRelease: canRelease, requestRelease: requestRelease, setStory: function (s, k) { s.pending.story = k; return { ok: true }; },
    setFinance: setFinance, setExtra: setExtra, visitAirline: visitAirline, commit: commit
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.Airworthy = api;
})(typeof window !== 'undefined' ? window : globalThis);
