/* 《适航》界面层 v2 —— 研发流程看板 */
(function () {
  'use strict';
  const E = window.Airworthy;
  const C = E.CONFIG;
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let S = E.newGame();
  let tab = 'tech';
  let guided = true;
  if (S && S.tutOn === undefined) S.tutOn = true;
  let dept = 'design';
  let seen = {};

  const BAYS = [
    { code: 'BAY 01', n: '前段对接', c: 40, d: '机身筒段对接、框位校准' },
    { code: 'BAY 02', n: '机翼装配', c: 32, d: '机翼盒段与机身对接、系统穿线' },
    { code: 'BAY 03', n: '系统安装', c: 60, d: '飞控、液压、航电总装与通电测试' },
    { code: 'BAY 04', n: '喷漆交付', c: 20, d: '喷漆、称重、交付检查与试飞' }
  ];

  function money(v, unit) {
    const s = (v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
    return s + (unit === false ? '' : ' 亿');
  }
  function toast(text, kind) {
    const w = $('.toastwrap');
    const d = document.createElement('div');
    d.className = 'toast' + (kind === 'warn' ? ' warn' : '');
    d.innerHTML = text;
    w.appendChild(d);
    setTimeout(() => { d.style.opacity = '0'; d.style.transition = 'opacity .3s'; setTimeout(() => d.remove(), 320); }, 3800);
  }
  function tip(target, html) {
    const el = document.querySelector('.tip');
    el.innerHTML = html;
    el.classList.add('on');
    const r = target.getBoundingClientRect();
    const w = Math.min(320, el.offsetWidth);
    let x = r.left + r.width / 2 - w / 2;
    x = Math.max(10, Math.min(window.innerWidth - w - 10, x));
    let y = r.bottom + 8;
    if (y + el.offsetHeight > window.innerHeight - 10) y = r.top - el.offsetHeight - 8;
    el.style.left = x + 'px'; el.style.top = Math.max(8, y) + 'px';
  }
  function hideTip() { document.querySelector('.tip').classList.remove('on'); }

  function openModal(html, wide) {
    const mask = $('#mask');
    mask.innerHTML = '<div class="modal' + (wide ? ' wide' : '') + '">' + html + '</div>';
    mask.classList.remove('hidden');
    mask.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
  }
  function closeModal() {
    $('#mask').classList.add('hidden'); $('#mask').innerHTML = '';
  }
  function modalOpen() { return !$('#mask').classList.contains('hidden'); }

  /* ---------------- 引导 ---------------- */
  const ONBOARD = [
    {
      t: '你是北辰航空 P-19 的项目总师',
      b: `<p>这架飞机已经完成了气动与结构设计。接下来 18 个季度，你要把它送过五道门：<b>设计冻结 → 首架试飞机下线 → 首飞 → TC 型号合格证 → PC 生产许可证</b>。</p>
          <p>只有拿到 PC，第一架才能交到航司手里。这条链上的任何一环卡住，交付就是 0 —— 这就是这个游戏要说的事：<b>订单不等于交付</b>。</p>
          <table><tr><th>你每季要做的四件事</th><th>对应的部门或动作</th></tr>
          <tr><td>推技术流程</td><td>设计部、制造工程、试验部、试飞部、适航部</td></tr>
          <tr><td>排产与采购</td><td>扩线、锁发动机</td></tr>
          <tr><td>谈订单</td><td>接不接、接多大的单</td></tr>
          <tr><td>提交本季</td><td>世界结算，结果不可逆</td></tr></table>`
    },
    {
      t: '先认识这五道门',
      b: `<p><b>设计冻结（CDR）</b>：系统布置定稿，数字样机干涉清零。工装才能开工。</p>
          <p><b>首架试飞机下线</b>：工装、型架、首件总装。这是后面所有试验和试飞的实物基础。</p>
          <p><b>首飞</b>：要等首架试飞机和铁鸟台联试都完成。从这一刻起，飞机才算"会飞"。</p>
          <p><b>TC 型号合格证</b>：静力、疲劳、包线、失速颤振、噪声结冰全过，再变成符合性文件交局方。</p>
          <p><b>PC 生产许可证</b>：局方认可你能<b>稳定地</b>造出合格的飞机。到这一步才可以交付。</p>`
    },
    {
      t: '第一件事：选融资方案',
      b: `<p>你只有 2 亿现金，而研发与部门开支每季要烧 0.6 亿，加上后面招人和买发动机，撑不到首笔预付款到账。</p>
          <p>两个选项的差别不在金额，在<b>你欠谁</b>：政府基金给得多，但绑了 25 架的交付承诺。</p>`
    }
  ];

  /* ---------------- 序章插图（同一套线稿语言） ---------------- */
  const ART_INK = 'fill="none" stroke="#16222B" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"';
  const ART_HATCH = 'fill="none" stroke="#16222B" stroke-width=".7" stroke-opacity=".28"';
  const ART_TEAL = 'fill="none" stroke="#1E6F78" stroke-width="1.2"';
  const ART_AMBER = 'fill="none" stroke="#B0701C" stroke-width="1.2"';

  function artWrap(inner, vb) {
    return '<svg viewBox="' + (vb || '0 0 1000 360') + '" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block">' + inner + '</svg>';
  }

  const PROLOGUE_ART = {
    yard: artWrap(
      // 地平线与江面
      '<path d="M0 214 L1000 214" ' + ART_INK + '/>' +
      '<g ' + ART_HATCH + '>' +
      '<path d="M0 238 L1000 238"/><path d="M0 252 L1000 252"/><path d="M0 266 L1000 266"/>' +
      '<path d="M120 280 L300 280"/><path d="M420 292 L640 292"/><path d="M760 286 L920 286"/>' +
      '</g>' +
      // 厂房
      '<path d="M90 214 L90 140 L300 140 L300 214" ' + ART_INK + '/>' +
      '<path d="M90 140 L195 108 L300 140" ' + ART_INK + '/>' +
      '<path d="M120 214 L120 168 L168 168 L168 214" ' + ART_INK + '/>' +
      '<path d="M196 214 L196 168 L244 168 L244 214" ' + ART_INK + '/>' +
      '<g ' + ART_HATCH + '><path d="M126 180 L162 180"/><path d="M126 192 L162 192"/><path d="M202 180 L238 180"/><path d="M202 192 L238 192"/></g>' +
      // 第二座厂房
      '<path d="M330 214 L330 156 L520 156 L520 214" ' + ART_INK + '/>' +
      '<path d="M330 156 L425 128 L520 156" ' + ART_INK + '/>' +
      '<path d="M370 214 L370 176 L430 176 L430 214" ' + ART_INK + '/>' +
      '<path d="M470 214 L470 186 L500 186 L500 214" ' + ART_INK + '/>' +
      // 烟囱与塔吊
      '<path d="M560 214 L560 116 L584 116 L584 214" ' + ART_INK + '/>' +
      '<g ' + ART_HATCH + '><path d="M560 132 L584 132"/><path d="M560 148 L584 148"/><path d="M560 164 L584 164"/></g>' +
      '<path d="M700 214 L700 70 L706 70 L706 214" ' + ART_INK + '/>' +
      '<path d="M600 86 L706 62" ' + ART_INK + '/>' +
      '<path d="M706 62 L760 86" ' + ART_INK + '/>' +
      '<path d="M760 86 L760 128" ' + ART_AMBER + '/>' +
      '<path d="M706 62 L706 96" ' + ART_TEAL + '/>' +
      // 远处天际线
      '<g ' + ART_HATCH + '>' +
      '<path d="M790 214 L790 190 L830 190 L830 214"/>' +
      '<path d="M850 214 L850 176 L884 176 L884 214"/>' +
      '<path d="M900 214 L900 196 L950 196 L950 214"/>' +
      '</g>' +
      // 晨雾
      '<g ' + ART_HATCH + '><path d="M40 120 L240 120"/><path d="M540 150 L700 150"/><path d="M300 96 L520 96"/></g>' +
      '<text x="40" y="330" font-size="11" fill="#8D887C" font-family="monospace" letter-spacing="3">EARLY MORNING · RIVERSIDE WORKS</text>', '0 30 1000 320'),
    shop: artWrap(
      // 屋顶桁架
      '<g ' + ART_HATCH + '>' +
      '<path d="M0 60 L1000 60"/><path d="M0 96 L1000 96"/>' +
      '<path d="M60 60 L100 96 L140 60 L180 96 L220 60 L260 96 L300 60 L340 96 L380 60 L420 96"/>' +
      '<path d="M460 60 L500 96 L540 60 L580 96 L620 60 L660 96 L700 60 L740 96 L780 60 L820 96 L860 60 L900 96 L940 60"/>' +
      '</g>' +
      // 行车
      '<path d="M120 60 L120 132 L860 132 L860 60" ' + ART_INK + '/>' +
      '<rect x="470" y="132" width="46" height="26" ' + ART_INK + '/>' +
      '<path d="M493 158 L493 196" ' + ART_INK + '/>' +
      '<path d="M470 196 L516 196" ' + ART_INK + '/>' +
      // 型架
      '<path d="M180 300 L180 210 L360 210 L360 300" ' + ART_INK + '/>' +
      '<path d="M620 300 L620 210 L800 210 L800 300" ' + ART_INK + '/>' +
      // 机身筒段
      '<ellipse cx="420" cy="244" rx="46" ry="58" ' + ART_INK + '/>' +
      '<path d="M466 200 L600 208 L600 280 L466 288" ' + ART_TEAL + '/>' +
      '<ellipse cx="600" cy="244" rx="26" ry="36" ' + ART_INK + '/>' +
      '<g ' + ART_HATCH + '>' +
      '<path d="M400 196 L400 292"/><path d="M430 190 L430 298"/><path d="M460 188 L460 300"/>' +
      '<path d="M500 200 L500 288"/><path d="M540 204 L540 284"/>' +
      '</g>' +
      // 工人剪影
      '<g fill="#16222B" fill-opacity=".55" stroke="none">' +
      '<circle cx="300" cy="264" r="7"/><path d="M293 272 h14 v26 h-14 z"/>' +
      '<circle cx="676" cy="268" r="7"/><path d="M669 276 h14 v24 h-14 z"/>' +
      '<circle cx="712" cy="272" r="6"/><path d="M706 279 h12 v21 h-12 z"/>' +
      '</g>' +
      // 地面
      '<path d="M0 300 L1000 300" ' + ART_INK + '/>' +
      '<g ' + ART_HATCH + '><path d="M0 316 L1000 316"/><path d="M60 330 L240 330"/><path d="M700 330 L880 330"/></g>' +
      '<text x="40" y="348" font-size="11" fill="#8D887C" font-family="monospace" letter-spacing="3">BAY 01 · FUSELAGE SECTION ON JIG</text>', '0 30 1000 330'),
    board: artWrap(
      // 房间轮廓
      '<path d="M60 60 L940 60 L940 300 L60 300" ' + ART_INK + '/>' +
      // 白板
      '<rect x="120" y="86" width="420" height="150" ' + ART_INK + '/>' +
      '<path d="M150 200 L500 200" ' + ART_INK + '/>' +
      '<g ' + ART_AMBER + '>' +
      '<path d="M170 200 L170 184"/><path d="M240 200 L240 176"/><path d="M310 200 L310 180"/>' +
      '<path d="M380 200 L380 172"/><path d="M450 200 L450 178"/>' +
      '</g>' +
      '<g ' + ART_HATCH + '>' +
      '<path d="M150 124 L330 124"/><path d="M150 140 L280 140"/><path d="M150 156 L360 156"/>' +
      '<path d="M470 124 L500 124"/><path d="M470 140 L500 140"/>' +
      '</g>' +
      // 长桌（透视）
      '<path d="M120 300 L200 240 L780 240 L860 300 Z" ' + ART_INK + '/>' +
      '<path d="M200 240 L120 300" ' + ART_INK + '/>' +
      '<path d="M780 240 L860 300" ' + ART_INK + '/>' +
      '<g ' + ART_HATCH + '><path d="M260 252 L740 252"/><path d="M220 276 L780 276"/></g>' +
      // 椅子
      '<g ' + ART_INK + '>' +
      '<path d="M300 240 L300 210 L340 210 L340 240"/>' +
      '<path d="M440 240 L440 206 L480 206 L480 240"/>' +
      '<path d="M580 240 L580 210 L620 210 L620 240"/>' +
      '</g>' +
      // 窗
      '<rect x="640" y="86" width="240" height="110" ' + ART_INK + '/>' +
      '<g ' + ART_HATCH + '><path d="M760 86 L760 196"/><path d="M640 141 L880 141"/></g>' +
      '<path d="M660 196 L660 170 L700 170 L700 196" ' + ART_TEAL + '/>' +
      '<text x="40" y="336" font-size="11" fill="#8D887C" font-family="monospace" letter-spacing="3">BOARD ROOM · 18 QUARTERS</text>', '0 40 1000 310'),
    runway: artWrap(
      // 天空与地平线
      '<path d="M0 196 L1000 196" ' + ART_INK + '/>' +
      '<g ' + ART_HATCH + '><path d="M80 150 L300 150"/><path d="M420 128 L620 128"/><path d="M700 160 L900 160"/></g>' +
      // 跑道透视
      '<path d="M300 196 L120 330" ' + ART_INK + '/>' +
      '<path d="M700 196 L880 330" ' + ART_INK + '/>' +
      '<g ' + ART_HATCH + '>' +
      '<path d="M340 210 L660 210"/><path d="M330 236 L670 236"/><path d="M316 264 L684 264"/><path d="M300 296 L700 296"/>' +
      '</g>' +
      '<g ' + ART_TEAL + '>' +
      '<path d="M500 300 L500 322"/><path d="M500 254 L500 278"/><path d="M500 214 L500 234"/>' +
      '</g>' +
      // 塔台
      '<path d="M790 196 L790 120 L830 120 L830 196" ' + ART_INK + '/>' +
      '<path d="M778 120 L842 120 L842 104 L778 104 Z" ' + ART_INK + '/>' +
      '<g ' + ART_HATCH + '><path d="M784 110 L836 110"/></g>' +
      // 飞机（远处，起飞姿态）
      '<g transform="translate(470,176) rotate(-7)">' +
      '<path d="M-46 0 L40 -4 L58 0 L40 4 L-46 0 Z" fill="#16222B" fill-opacity=".75" stroke="none"/>' +
      '<path d="M-6 -2 L-24 -22 L-14 -22 L8 -2 Z" fill="#16222B" fill-opacity=".6" stroke="none"/>' +
      '<path d="M-6 2 L-24 22 L-14 22 L8 2 Z" fill="#16222B" fill-opacity=".6" stroke="none"/>' +
      '<path d="M42 -2 L52 -14 L56 -14 L50 -2 Z" fill="#16222B" fill-opacity=".6" stroke="none"/>' +
      '</g>' +
      '<g ' + ART_AMBER + '><path d="M410 190 L470 186"/><path d="M566 184 L620 190"/></g>' +
      '<text x="40" y="336" font-size="11" fill="#8D887C" font-family="monospace" letter-spacing="3">FIRST FLIGHT · 42 MINUTES</text>', '0 66 1000 286')
  };

  let prologuePick = { seat: 'main', route: 'clean' };
  const PROLOGUE = [
    { t: '北辰航空 · 三十七年', art: 'yard',
      b: `<p>北辰航空在长江边的一个工业区里，两千一百人。三十七年前它靠修理涡桨飞机起家，后来自己造了一款 42 座的支线涡桨，厂区墙上还挂着那张发黄的下线照片。</p>
          <p>你在这家厂干了十九年，从结构组的绘图员做到型号总师办公室。你负责过三个改型项目，没有一个让你真正兴奋过。</p>` },
    { t: '一款还在卖、但已经在退场的飞机', art: 'shop',
      b: `<p>P-7 涡桨是公司的现金牛：便宜、皮实、能上碎石跑道。但过去五年，它的市场在以每年 6% 的速度萎缩——支线航司都在换喷气，因为乘客不愿意在 500 公里的航段上多花四十分钟。</p>
          <p>董事会的判断很直接：<b>再不改，五年后这家厂就只剩维修业务。</b></p>` },
    { t: '这个行业只有三个位置',
      b: `<p>干线窄体市场被两家吃掉八成：巨杉航空靠规模和全球服务网，欧陆联合靠机型族谱和产能。第三极是东方商用，靠国家意志硬撑一条产线在爬坡。</p>
          <p>剩下的缝隙有两个：一是 100 座上下、被两家都不太在意的支线喷气；二是 130 座级，正面撞上去，但量大。</p>
          <p><b>你要选一个位置站进去。</b></p>` },
    { t: '前任总师老周', art: 'shop',
      b: `<p>老周在这个位子上坐了六年，去年被换掉。原因是 P-7 的一次改型延期了七个月，客户退了四架。</p>
          <p>他走的那天把一本笔记本留在抽屉里。第一页写着：<b>不要在设计没冻结的时候开始做工装。</b> 你后来才知道这句话让公司赔过一笔钱。</p>` },
    { t: '董事会给了你十八个季度', art: 'board',
      b: `<p>会议室的白板上画着一条时间线：第 18 个季度末，累计交付 25 架。做不到，这个型号降级成技术验证机，团队打散。</p>
          <p>你手里有一条总装线、五个部门、两亿现金，和一张还没冻结的图纸。</p>` },
    { t: '你的五个部门',
      b: `<p><b>设计部</b> 把系统装进机身，出数字样机；<b>制造工程</b> 做工装、装首架；<b>试验部</b> 把结构压到极限；<b>试飞部</b> 按架次飞科目；<b>适航部</b> 把证据变成局方认可的文件。</p>
          <p>他们不能互相借人。每季你能派的，只有这么多。</p>` },
    { t: '立项 · 第一件事：站哪个位置', choice: 'seat',
      opts: [
        { k: 'small', h: '96 座级 · 缝隙市场', d: '订单量小、折扣浅（少 2 个点）、竞争少。适合先把型号做出来再谈规模。' },
        { k: 'main', h: '130 座级 · 主流市场', d: '订单量大一成、折扣深 2 个点、正面撞 E-22。摊薄成本快，但价格战躲不掉。' }
      ] },
    { t: '立项 · 第二件事：怎么造', choice: 'route',
      opts: [
        { k: 'clean', h: '全新设计', d: '研发 0.7 亿/季，品牌溢价高（信誉 +6）。数字样机、静力试验、包线扩展都按全量做。' },
        { k: 'derivative', h: '改型衍生', d: '研发 0.5 亿/季，三项工作变轻，但客户觉得"还是那家做涡桨的"（信誉 −5）。' }
      ] }
  ];

  function showPrologue(i) {
    const p = PROLOGUE[i];
    const body = p.choice
      ? `<p>${p.b || ''}</p>` + p.opts.map((o) => `<div class="choice" data-pick="${p.choice}" data-val="${o.k}"><h4>${o.h}</h4><p>${o.d}</p></div>`).join('')
      : p.b;
    const art = p.art && PROLOGUE_ART[p.art] ? `<div class="proart">${PROLOGUE_ART[p.art]}</div>` : '';
    openModal(`
      <header><span class="t">${esc(p.t)}</span><span class="m">序章 ${i + 1} / ${PROLOGUE.length}</span></header>
      <div class="steps">${PROLOGUE.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>
      ${art}
      <div class="body">${body}</div>
      <footer>${p.choice ? '<span style="font-size:9.5px;color:var(--ink-40);align-self:center;margin-right:auto">选完继续</span>' : ''}
        <button class="btn" id="proNext">${i < PROLOGUE.length - 1 ? '继续' : '开始立项'}</button></footer>`);
    const next = $('#proNext');
    if (next) next.style.display = p.choice ? 'none' : '';
    if (next) next.onclick = () => {
      if (i < PROLOGUE.length - 1) showPrologue(i + 1);
      else finishPrologue();
    };
  }
  function finishPrologue() {
    S = E.newGame({ seed: S.seed, seat: prologuePick.seat, route: prologuePick.route });
    S.tutOn = true; beatShown = 0;
    closeModal();
    render();
    showOnboard(0);
  }

  function showOnboard(i) {
    const step = ONBOARD[i];
    openModal(`
      <header><span class="t">${esc(step.t)}</span><button class="x" data-close>×</button></header>
      <div class="steps">${ONBOARD.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="body">${step.b}</div>
      <footer>
        ${i > 0 ? '<button class="btn ghost" id="obPrev">上一步</button>' : ''}
        <button class="btn" id="obNext">${i < ONBOARD.length - 1 ? '下一步' : '开始'}</button>
      </footer>`);
    const prev = $('#obPrev'); if (prev) prev.onclick = () => showOnboard(i - 1);
    $('#obNext').onclick = () => {
      if (i < ONBOARD.length - 1) showOnboard(i + 1);
      else { closeModal(); askFinance(); }
    };
  }
  function askFinance() {
    openModal(`
      <header><span class="t">第 1 季 · 融资方案</span><span class="m">只能选一次</span></header>
      <div class="body">
        <p>两条路的差别不在金额，在<b>你欠谁</b>。</p>
        <div class="choice" data-fin="gov">
          <h4>政府产业基金 6 亿 + 银行贷款 5 亿<span class="tag">11.0 亿</span></h4>
          <p>合计 11 亿，利息 1.2%/季。附条件：结项时累计交付不足 25 架，退还 3 亿并扣信誉 10。
          这是二线整机厂的真实处境——<b>钱是国家的，交付承诺也是。</b></p>
        </div>
        <div class="choice" data-fin="bank">
          <h4>银行贷款 3 亿<span class="tag">3.0 亿</span></h4>
          <p>合计 3 亿，利息 1.2%/季，无附加条件。够活，但招不起人，也锁不了几台发动机。</p>
        </div>
      </div>`);
    document.querySelectorAll('[data-fin]').forEach((el) => {
      el.onclick = () => {
        E.setFinance(S, el.dataset.fin);
        closeModal();
        toast(el.dataset.fin === 'gov' ? '政府基金与贷款合计 11 亿，下一季到账。' : '银行贷款 3 亿，下一季到账。');
        render();
      };
    });
  }

  /* ---------------- 头部 ---------------- */
  function renderHud() {
    const ticks = Array.from({ length: C.maxTurn }, (_, i) => {
      const t = i + 1;
      const cls = t < S.turn ? 'done' : t === S.turn ? 'now' : '';
      return `<i class="${cls}"></i>`;
    }).join('');
    const pdp = E.pdpLiability(S);
    document.querySelector('.hud').innerHTML = `
      <div class="brand">
        <div><div class="name">北辰航空</div><div class="code mono">POLARIS · P-19</div></div>
        <div class="proj">项目总师工作台</div>
      </div>
      <div class="turnbar">
        <span class="lb mono">${S.ending ? '已结项' : '第 ' + S.turn + ' / ' + C.maxTurn + ' 季'}</span>
        <div class="ticks">${S.ending ? Array.from({ length: C.maxTurn }, () => '<i class="done"></i>').join('') : ticks}</div>
      </div>
      <div class="kpis">
        <div class="kpi ${S.cash < 2 ? 'warn' : ''}" data-tip="cash">
          <div class="k">现金 <i class="q">?</i></div>
          <div class="v mono">${money(S.cash)}<small>亿</small></div>
        </div>
        <div class="kpi" data-tip="pdp">
          <div class="k">其中客户预付 <i class="q">?</i></div>
          <div class="v mono" style="font-size:13px">${money(pdp)}</div>
        </div>
        <div class="kpi" data-tip="backlog">
          <div class="k">在手订单 <i class="q">?</i></div>
          <div class="v mono">${E.totalBacklog(S)}<small>架</small></div>
        </div>
        <div class="kpi ${S.delivered >= C.target ? 'good' : ''}" data-tip="delivered">
          <div class="k">已交付 <i class="q">?</i></div>
          <div class="v mono">${S.delivered}<small>/ ${C.target}</small></div>
        </div>
      </div>
      <div class="tools">
        <button data-toggle="guide" class="${guided ? 'on' : ''}">引导 ${guided ? '开' : '关'}</button>
        <button data-open="codex">图鉴</button>
        <button data-open="legend">图例</button>
        <button data-open="help">规则</button>
        <button data-open="restart">重开</button>
      </div>`;
  }

  /* ---------------- 总装线 ---------------- */
  function renderLine() {
    const n = S.delivered + 1;
    const L = Math.max(0.45, Math.pow(n, -0.2345));
    const eff = BAYS.map((b) => b.c * L);
    const maxEff = Math.max.apply(null, eff);
    const bi = eff.indexOf(maxEff);
    const stopped = S.stopTurn === S.turn;
    const cap = E.capacity(S) * (S.pending.overtime ? 1.25 : 1) * (stopped ? 0.55 : 1);
    const bays = BAYS.map((b, i) => {
      const ratio = eff[i] / maxEff;
      const isBt = i === bi;
      const isSt = stopped && i === 2;
      const fillH = 170 * Math.min(1, ratio);
      const cls = isSt ? 'st' : isBt ? 'bt' : '';
      const tag = isSt ? '缺件停线' : isBt ? '瓶颈' : (!S.tc ? '未取证' : !S.pc ? '已取证' : '在产');
      return `<div class="bay ${cls}" data-bay="${i}">
        <div class="bh"><span class="code mono">${b.code}</span><span class="tagname">${tag}</span></div>
        <div class="nm">${b.n}</div>
        <svg viewBox="-92 -96 184 192">
          <g clip-path="url(#fusclip)">
            <rect x="-13" y="-85" width="26" height="${fillH.toFixed(1)}"
              fill="${isSt ? 'rgba(165,57,42,.55)' : ratio > .9 ? '#26333D' : 'rgba(38,51,61,.55)'}"/>
          </g>
          <use href="#planeout"/>
        </svg>
        <div class="ft"><span>有效 <b class="mono">${Math.round(eff[i])}d</b></span><span class="mono">${Math.round(ratio * 100)}%</span></div>
      </div>`;
    }).join('');
    const stop = stopped ? `<div class="stopline">03 工位缺件停线：主起落架作动筒延迟 41 天，本季产能只剩 55%。</div>` : '';
    $('.line').innerHTML = `
      <header><span class="t">总装线 · 脉冲图</span><span class="m mono">有效节拍 ${Math.round(maxEff)} 天/架 · 本季理论产能 ${cap.toFixed(2)} 架</span></header>
      <div class="bays">${bays}</div>
      ${stop}
      <div class="legend-strip">
        <span class="ls-ok"><i></i>已完成 / 已交付</span>
        <span class="ls-bt"><i></i>瓶颈工位</span>
        <span class="ls-st"><i></i>缺件停线</span>
        <span class="ls-wt"><i></i>未进机位</span>
        <span class="sp">点工位看它为什么慢 · 机身填充 = 该工位利用率</span>
      </div>
      ${calcBlock()}`;
  }

  /* ---------------- 决议 ---------------- */
  function renderActions() {
    const tabs = [
      { k: 'tech', n: '技术流程' }, { k: 'line', n: '产线' },
      { k: 'buy', n: '采购' }, { k: 'biz', n: '商务' }
    ];
    const dot = (k) => {
      if (k === 'tech' && S.turn <= C.maxTurn) {
        const anyAssign = Object.keys(S.pending.assign).length > 0;
        const anyIdle = E.DEPTS.some((d) => E.deptLeft(S, d.id) > 0 &&
          E.worksByDept(d.id, S).some((w) => !E.workDone(S, w.id) && E.canAssign(S, w.id).ok));
        return anyIdle && !anyAssign ? '<span class="dot"></span>' : '';
      }
      if (k === 'biz' && E.openOffers(S).length) return '<span class="dot"></span>';
      if (k === 'buy' && S.engines < 4 && S.engineOrders.length === 0 && S.turn > 2) return '<span class="dot"></span>';
      return '';
    };
    const hint = nextHint();
    $('.acts').innerHTML = `
      <header><span class="t">本季决议</span><span class="m mono">第 ${S.turn} 季 · 只能提交一次</span></header>
      ${hint ? `<div class="hintbar"><b>下一步</b>${esc(hint)}</div>` : ''}
      ${guided ? guideBlock() : ''}
      <div class="tabs">${tabs.map((t) => `<button data-tab="${t.k}" class="${tab === t.k ? 'on' : ''}">${t.n}${dot(t.k)}</button>`).join('')}</div>
      <div class="tabbody">${tabBody()}</div>
      <div class="actsfoot">${judgeBlock()}</div>`;
  }
  function guideBlock() {
    const list = E.suggest(S);
    if (!list.length) return '';
    return `<div class="guide">
      <div class="gh"><span>本季建议</span><em>可一键执行，执行后仍能改</em></div>
      ${list.map((g, i) => `<div class="gitem"><span class="gnum">${i + 1}</span><span class="gtext"><b>${esc(g.label)}</b><em>${esc(g.detail)}</em></span></div>`).join('')}
      <button class="btn sm" data-run="all">一键执行这 ${list.length} 条</button>
    </div>`;
  }

  function nextHint() {
    if (S.turn === 1 && !S.finance) return '先选融资方案，否则招不起人、买不起发动机。';
    const idle = E.DEPTS.find((d) => E.deptLeft(S, d.id) > 0 &&
      E.worksByDept(d.id, S).some((w) => !E.workDone(S, w.id) && E.canAssign(S, w.id).ok));

    if (idle) return '还有部门产能没用完，把本季的人力派到能推进的工作上。';
    if (E.openOffers(S).length) return '有 ' + E.openOffers(S).length + ' 张订单等你决定。';
    if (S.pc && S.engines < 4 && S.engineOrders.length === 0) return '发动机库存见底，下季可能无件可装。';
    return null;
  }

  function tabBody() {
    if (tab === 'tech') return techBody();
    if (tab === 'line') {
      const canExp = S.expandReady === null && S.cash >= C.expandCost && !S.pending.expand;
      const expandTxt = S.expandReady !== null ? '已投，第 ' + S.expandReady + ' 季投产'
        : S.pending.expand ? '本季提交后开工，2 季后投产' : '双总装位并行，产能直接翻倍';
      return `
        <div class="row">
          <div class="lbl"><b>加班提产</b><span>本季产能 ×1.25，质量 −6，现金 −0.12 亿。赶窗口用，别当常态。</span></div>
          <button class="btn ${S.pending.overtime ? 'on' : ''}" data-act="ot">${S.pending.overtime ? '已开启' : '开启'}</button>
        </div>
        <div class="row">
          <div class="lbl"><b>扩线投资 · 2.4 亿</b><span>${expandTxt}</span></div>
          <button class="btn ${S.pending.expand ? 'on' : ''}" data-act="expand" ${canExp || S.pending.expand ? '' : 'disabled'}>${S.pending.expand ? '已下单' : '投资'}</button>
        </div>
        <div class="row">
          <div class="lbl"><b>机位转租</b><span>把 3 个未开工机位整批转给远洋租机，立刻收 15% 预付款，折扣按 22%。</span></div>
          <button class="btn amber" data-act="release" ${E.canRelease(S) ? '' : 'disabled'}>转租 3 个</button>
        </div>
        <div class="tabnote">
          <b>为什么产能要提前投</b>
          扩线从投钱到投产要两季。你在拿到 TC 之后才想起来扩线，就已经晚了半年 —— 而交付窗口不会等你。
        </div>`;
    }
    if (tab === 'buy') {
      const inTransit = S.engineOrders.length
        ? S.engineOrders.map((o) => `<div class="rep"><div><b>第 ${o.arrive} 季</b> 到货 ${o.qty} 台</div><div class="mono">${(o.qty * 0.35 * 0.3).toFixed(2)} 亿已预付</div></div>`).join('')
        : '<div style="font-size:10px;color:var(--ink-40);padding:4px 0">没有在途订单。</div>';
      return `
        <div class="row">
          <div class="lbl"><b>发动机库存</b><span>2 台装 1 架。没有发动机，工位再快也交不出飞机。</span></div>
          <div class="mono" style="font-size:16px">${S.engines} <small style="font-size:9px;color:var(--ink-40)">台</small></div>
        </div>
        <div class="row">
          <div class="lbl"><b>锁定发动机</b><span>整批下单，30% 预付，3 季后到货，单价 0.35 亿/台。</span></div>
          <div style="display:flex;gap:5px">
            <button class="btn sm" data-buy="12">12 台</button>
            <button class="btn sm" data-buy="24">24 台</button>
            <button class="btn sm" data-buy="48">48 台</button>
          </div>
        </div>
        <div class="grp">在途</div>
        ${inTransit}
        ${S.pending.engines ? `<div class="attr">本季将再锁定 ${S.pending.engines} 台，预付 ${(S.pending.engines * 0.105).toFixed(2)} 亿，第 ${S.turn + 3} 季到货。</div>` : ''}
        <div class="tabnote">
          <b>为什么发动机永远不够</b>
          它是最长的前置期：下单到到货 3 季，而且只能整批锁。你在第 13 季想多交 5 架，能救你的动作其实发生在第 10 季。
        </div>`;
    }
    // biz
    const offers = S.offers.filter((o) => o.open && !o.decided);
    const decided = S.offers.filter((o) => o.decided && o.decided !== 'expired');
    return `
      <div class="row">
        <div class="lbl"><b>在手订单</b><span>${E.totalBacklog(S)} 架未交付。窗口按季度算，逾期取消要退预付款并赔 5%。</span></div>
        <div class="mono" style="font-size:16px">${E.totalBacklog(S)}</div>
      </div>
      ${offers.length ? offers.map((o) => `
        <div class="offer">
          <div class="oh"><span class="who">${esc(o.cust)}<em>${esc(o.tag)}</em></span><span class="qty">${o.qty} 架</span></div>
          <div class="meta mono">窗口 T${o.win[0]}–T${o.win[1]} · 折扣 ${Math.round(o.disc * 100)}%${S.discShift ? ' → 实付 ' + Math.round(Math.min(0.3, o.disc + S.discShift) * 100) + '%' : ''} · 定金 5%</div>
          <div class="note">${esc(o.note)}</div>
          <div class="acts2">
            <button class="btn" data-offer="${o.id}" data-accept="1">接受</button>
            <button class="btn ghost" data-offer="${o.id}" data-accept="0">拒绝</button>
          </div>
        </div>`).join('') : '<div style="font-size:10px;color:var(--ink-40);padding:6px 0">本季没有新的询价。</div>'}
      ${S.pending.accept.length ? `<div class="attr">本季已接受 ${S.pending.accept.length} 张订单，提交后机位会铺进账本。</div>` : ''}
      ${decided.length ? '<div class="grp">已处理</div>' + decided.map((o) => `<div style="font-size:10px;color:var(--ink-40);padding:2px 0">${esc(o.cust)} — ${o.decided === 'accept' ? '已承接' : o.decided === 'decline' ? '已拒绝' : '已过期'}</div>`).join('') : ''}
      <div class="tabnote">
        <b>接单的判断顺序</b>
        先看窗口，再看折扣，最后才看数量。窗口决定你能不能按时交，折扣决定你每架赚多少 ——
        4.20 亿的目录价，12% 折扣是 3.70 亿，22% 折扣只剩 3.28 亿，而成本约 2.6 亿。
      </div>`;
  }

  /* ---------------- 技术流程 ---------------- */
  function techBody() {
    const gates = E.gateState(S);
    const gateBar = gates.map((g, i) => {
      const cls = g.done ? 'done' : (i === gates.findIndex((x) => !x.done) ? 'now' : '');
      return `<div class="gate ${cls}"><span class="gi mono">${g.id}</span><span class="gn">${g.n}</span></div>`;
    }).join('');
    const rows = E.DEPTS.map((d) => {
      const cap = E.deptCap(S, d.id);
      const left = E.deptLeft(S, d.id);
      const hired = (S.pending.hires[d.id] || 0);
      const cands = E.worksByDept(d.id, S).filter((w) => !E.workDone(S, w.id));
      const openCount = cands.filter((w) => E.canAssign(S, w.id).ok).length;
      return `<button class="dept ${dept === d.id ? 'on' : ''}" data-dept="${d.id}">
        <span class="dn">${d.n}</span>
        <span class="dc mono">${left}/${cap}${d.id === 'flight' ? ' 架次' : ''}</span>
        <span class="ds">${openCount ? openCount + ' 项可推进' : (cands.length ? '前置未满足' : '全部完成')}${hired ? ' · 待招 ' + hired : ''}</span>
      </button>`;
    }).join('');
    const def = E.DEPTS.filter((x) => x.id === dept)[0];
    const cards = E.worksByDept(dept, S).map((w) => {
      const p = E.workProgress(S, w.id);
      const queued = S.pending.assign[w.id] || 0;
      const total = Math.min(w.need, p + queued);
      const done = E.workDone(S, w.id);
      const can = E.canAssign(S, w.id);
      const blocked = !done && !can.ok;
      const pct = Math.round((total / w.need) * 100);
      const reqTxt = w.req.length
        ? '前置：' + w.req.map((r) => (E.workDone(S, r) ? '✓' : '✗') + E.workById(r).n).join(' · ')
        : '无前置';
      return `<div class="wcard ${done ? 'done' : blocked ? 'blocked' : ''}">
        <div class="wh"><span class="wn">${w.n}</span><span class="wp mono">${total}/${w.need}</span></div>
        <div class="wbar"><i style="width:${done ? 100 : pct}%"></i></div>
        <div class="wo">产出：${w.out}</div>
        <div class="wrq ${blocked ? 'bad' : ''}">${reqTxt}</div>
        <div class="wacts">
          ${done ? '<span class="wok">已完成</span>' :
            `<button class="btn sm" data-work="${w.id}">+1 ${def.id === 'flight' ? '架次' : '人力'}</button>
             ${queued ? `<button class="btn sm ghost" data-unwork="${w.id}">撤销</button><span class="wq mono">本季已派 ${queued}</span>` : ''}`}
        </div>
      </div>`;
    }).join('');
    const hireBtn = E.canHire(S, dept)
      ? `<button class="btn sm" data-hire="${dept}">增聘 1 ${def.unit} · ${C.hireCost} 亿</button>`
      : '<span class="wok">已满编</span>';
    return `
      <div class="gatebar">${gateBar}</div>
      <div class="depts">${rows}</div>
      <div class="depthead">
        <span class="dh">${def.n}</span>
        <span class="dsub">${def.sub}</span>
        ${hireBtn}
      </div>
      <div class="wcwrap">${cards || '<div style="font-size:10px;color:var(--ink-40)">这个部门的工作已全部完成。</div>'}</div>`;
  }

  function judgeBlock() {
    const g = E.nextGate(S);
    const out = [];
    if (!g) {
      out.push('五道门全部通过。现在卡你的是产能和发动机，不是技术。');
    } else {
      const w = E.workById(g.work);
      const miss = w.req.filter((r) => !E.workDone(S, r)).map((r) => E.workById(r).n);
      out.push('下一道门：<b>' + g.n + '</b>。' + g.hint + '。');
      if (miss.length) out.push('当前缺口：' + miss.join('、') + '。');
    }
    return '<div class="judge"><div class="ct">本季判断</div>' + out.map((t) => '<div>' + t + '</div>').join('') + '</div>';
  }

  function calcBlock() {
    const n = S.delivered + 1;
    const L = Math.max(0.45, Math.pow(n, -0.2345));
    const eff = C.bottleneck * L;
    const cap = E.capacity(S) * (S.pending.overtime ? 1.25 : 1) * (S.stopTurn === S.turn ? 0.55 : 1);
    const mat = Math.floor(S.engines / 2);
    return `<div class="calcbar">
      <span>总装位 <b>${S.k}</b> × 90 ÷ 有效节拍 <b>${eff.toFixed(0)}d</b> ＝ <b>${cap.toFixed(2)}</b> 架/季</span>
      <span>发动机可装 <b>${mat}</b> 架</span>
      <span>未交付机位 <b>${E.totalBacklog(S)}</b> 架</span>
      <span class="res">本季预计交付${S.pc ? '' : (S.tc ? '（待 PC）' : '（未取证恒为 0）')} <b>${estimate()}</b> 架</span>
    </div>`;
  }
  function estimate() {
    if (!S.pc) return 0;
    const cap = E.capacity(S) * (S.pending.overtime ? 1.25 : 1) * (S.stopTurn === S.turn ? 0.55 : 1);
    const line = (S.progress || 0) + cap;
    return Math.max(0, Math.min(Math.floor(line + 1e-9), Math.floor(S.engines / 2)));
  }

  /* ---------------- 右侧 ---------------- */
  function renderOrders() {
    const byCust = {};
    S.slots.filter((x) => x.alive).forEach((x) => {
      byCust[x.cust] = byCust[x.cust] || { total: 0, left: 0, disc: x.disc };
      byCust[x.cust].total += 1;
      if (x.got === null) byCust[x.cust].left += 1;
    });
    const names = Object.keys(byCust);
    const rows = names.length ? names.map((n) => {
      const v = byCust[n];
      const slot = S.slots.filter((x) => x.cust === n && x.alive && x.got === null)[0];
      return `<tr>
        <td class="who"><b>${esc(n)}</b><em>${Math.round(v.disc * 100)}% 折扣</em></td>
        <td class="n mono">${v.left}<span style="color:var(--ink-40)">/${v.total}</span>
          <div class="bar"><i style="width:${Math.round(((v.total - v.left) / v.total) * 100)}%"></i></div></td>
        <td class="n mono ${slot && slot.plan - S.turn <= 2 ? 'near' : ''}">${slot ? 'T' + slot.plan : '—'}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="3" style="color:var(--ink-40);font-size:10px;padding:10px 8px">还没有订单。第 3 季会有第一家航司来问价。</td></tr>';
    $('.orders').innerHTML = `
      <header><span class="t">订单账本</span><span class="m mono">${E.totalBacklog(S)} 架未交付</span></header>
      <table class="tbl">
        <thead><tr><th>客户</th><th class="n">剩余/总</th><th class="n">最近窗口</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function renderGates() {
    const gates = E.gateState(S);
    const nowIdx = gates.findIndex((g) => !g.done);
    const list = gates.map((g, i) => {
      const cls = g.done ? 'done' : i === nowIdx ? 'now' : '';
      return `<div class="grow ${cls}">
        <span class="gi mono">${g.id}</span>
        <span class="gn">${g.n}</span>
        <span class="gv">${g.done ? '通过' : i === nowIdx ? '进行中' : '未到'}</span>
      </div>`;
    }).join('');
    const g = E.nextGate(S);
    const hint = g ? '<div class="ghint">' + esc(g.hint) + '</div>' : '<div class="ghint">五道门全部通过</div>';
    const cp = E.criticalPath(S);
    const cpHtml = cp.length
      ? '<div class="cpwrap"><div class="cpt">到下一道门的关键路径</div><div class="cpchain">' +
        cp.slice(0, 4).map((x) => `<span class="cpchip ${x.ready ? 'ready' : 'wait'}"><i class="cpdot"></i><b>${esc(x.n)}</b><em class="mono">${x.done}/${x.need}</em></span>`).join('<i class="cparrow">›</i>') +
        (cp.length > 4 ? `<i class="cparrow">›</i><span class="cpmore">+${cp.length - 4}</span>` : '') +
        '</div></div>'
      : '';
    $('.gates').innerHTML = `<header><span class="t">项目阶段</span><span class="m mono">${gates.filter((x) => x.done).length} / ${gates.length}</span></header>
      <div class="glist">${list}</div>${hint}${cpHtml}
      <div class="gatefoot"><button class="btn sm" data-assist="forecast">预测未来 12 季</button><button class="btn sm ghost" data-assist="auto">自动派工</button></div>`;
  }

  function renderEvent() {
    let html;
    if (S.event) html = `<div class="ev now"><b>本季事件 · ${esc(S.event.title)}</b>${esc(S.event.text)}</div>`;
    else if (S.eventWarn) html = `<div class="ev warn"><b>下季预告 · ${esc(S.eventWarn.title)}</b>${esc(S.eventWarn.text)}</div>`;
    else html = '<div class="ev empty"><b>暂无事件</b>事件会提前一季预告，不会突然扣你产能。</div>';
    const head = S.event ? '本季生效' : S.eventWarn ? '下季预告' : '提前 1 季预告';
    $('.events').innerHTML = `<header><span class="t">事件</span><span class="m">${head}</span></header>${html}`;
  }

  function renderLast() {
    const h = S.history;
    if (!h.length) {
      $('.last').innerHTML = '<header><span class="t">交付节奏</span><span class="m mono">第 1 季</span></header>' +
        '<div class="ev empty" style="padding:14px 10px">提交第一季后，这里会画出每季的交付量。</div>';
      return;
    }
    const last = h[h.length - 1];
    const max = Math.max(3, Math.max.apply(null, h.map((x) => x.deliver)));
    const bars = Array.from({ length: C.maxTurn }, (_, i) => {
      const e = h[i];
      if (!e) return `<div class="pb"><i class="z" style="height:2px"></i><em>${(i + 1) % 3 === 0 ? i + 1 : ''}</em></div>`;
      return `<div class="pb"><i style="height:${Math.max(2, (e.deliver / max) * 100)}%"></i><em>${(i + 1) % 3 === 0 ? i + 1 : ''}</em></div>`;
    }).join('');
    $('.last').innerHTML = `
      <header><span class="t">交付节奏</span><span class="m mono">上季 ${last.deliver} 架</span></header>
      <div class="pace">${bars}</div>
      <div class="lastsum">
        <span>现金 <b>${last.cash.toFixed(2)}</b></span>
        <span>质量 <b>${last.quality}</b></span>
        <span>TC <b>${S.tc ? 'T' + S.tc : '—'}</b></span>
        <span>PC <b>${S.pc ? 'T' + S.pc : '—'}</b></span>
      </div>`;
  }

  function tutorialGoals() {
    const t = S.turn;
    if (t === 1) return [
      { t: '在右上方选一个融资方案', on: !!S.finance, go: null },
      { t: '到「技术流程」把五个部门的产能派出去', on: Object.keys(S.pending.assign).length > 0, go: 'tech' },
      { t: '点「提交本季」结束第一季', on: false, go: null }
    ];
    if (t === 2) return [
      { t: '到「采购」锁定第一批发动机（12–24 台）', on: S.engineOrders.length > 0 || S.engines > 0, go: 'buy' },
      { t: '继续派工，然后提交', on: Object.keys(S.pending.assign).length > 0, go: 'tech' }
    ];
    if (t === 3) return [
      { t: '到「商务」接下第一张订单', on: S.slots.length > 0, go: 'biz' },
      { t: '看一眼「本季建议」，它会告诉你还差什么', on: true, go: null }
    ];
    if (t === 4) return [
      { t: '到「产线」投一次扩线（产能翻倍）', on: S.expandReady !== null || S.pending.expand, go: 'line' },
      { t: '招一个人，让关键路径变短', on: S.hires > 0 || Object.keys(S.pending.hires).length > 0, go: 'tech' }
    ];
    return null;
  }

  function renderTutorial() {
    const host = document.querySelector('.tutorial');
    if (!host) return;
    const goals = tutorialGoals();
    if (!guided || !goals || S.ending || !S.tutOn) { host.style.display = 'none'; host.innerHTML = ''; return; }
    host.style.display = '';
    const done = goals.filter((g) => g.on).length;
    host.innerHTML = `
      <span class="tt">新手目标 · 第 ${S.turn} 季</span>
      <span class="tg">${goals.map((g, i) => `<span class="ti ${g.on ? 'on' : ''}">${g.on ? '✓' : i + 1} ${esc(g.t)}</span>`).join('')}</span>
      <span class="tp mono">${done}/${goals.length}</span>
      <button class="tx" data-tut="off" title="关闭新手引导">知道了</button>`;
  }

  function renderFoot() {
    if (S.ending) {
      $('.check').innerHTML = `<span class="chk on"><i>✓</i>本局结束：${esc(S.ending.title)}</span>
        <span class="chk" style="color:var(--ink-55)">交付 ${S.delivered} 架 · 净现金 ${money(S.cash)}</span>`;
      const btn = $('.commit');
      btn.textContent = '再开一局';
      btn.disabled = false;
      btn.dataset.again = '1';
      return;
    }
    const idle = E.DEPTS.some((d) => E.deptLeft(S, d.id) > 0 &&
      E.worksByDept(d.id, S).some((w) => !E.workDone(S, w.id) && E.canAssign(S, w.id).ok));
    const checks = [
      { on: !!S.finance, t: '融资方案' },
      { on: !idle || Object.keys(S.pending.assign).length > 0, t: '分配部门产能' },
      { on: S.pending.accept.length > 0 || S.pending.decline.length > 0 || !E.openOffers(S).length, t: '处理询价' }
    ];
    $('.check').innerHTML = checks.map((c) => `<span class="chk ${c.on ? 'on' : ''}"><i>✓</i>${c.t}</span>`).join('') +
      `<span class="chk" style="color:var(--ink-40)">本季产出预估 <b class="mono" style="color:var(--ink)">${estimate()}</b> 架</span>` +
      `<span class="stamp">PLR-P19-ASSY · 小批生产 · v2.0</span>`;
    const b2 = $('.commit'); b2.textContent = '提交本季'; delete b2.dataset.again;
  }

  function render() {
    renderHud(); renderTutorial(); renderLine(); renderActions(); renderOrders(); renderGates(); renderEvent(); renderLast(); renderFoot();
    $('.commit').disabled = !!S.ending || modalOpen();
  }

  function maybeShowBeat() {
    if (S.story && !S.ending && beatShown !== S.turn && !modalOpen()) {
      beatShown = S.turn;
      showStory();
    }
  }

  /* ---------------- 弹窗 ---------------- */
  const BEAT_ART = { firstflight: 'runway', visit: 'yard', notebook: 'shop', board: 'board' };
  function beatArt(id) {
    const k = BEAT_ART[id];
    return k && PROLOGUE_ART[k] ? `<div class="proart">${PROLOGUE_ART[k]}</div>` : '';
  }

  function showStory() {
    const st = S.story;
    if (!st) return;
    if (st.type === 'note') {
      openModal(`
        <header><span class="t">${esc(st.title)}</span><span class="m">情节 · 第 ${S.turn} 季</span></header>
        ${beatArt(st.id)}
        <div class="body">
          <p>${esc(st.text)}</p>
          ${st.note ? `<div class="attr">${esc(st.note)}</div>` : ''}
        </div>
        <footer><button class="btn" data-close>继续</button></footer>`);
      return;
    }
    openModal(`
      <header><span class="t">${esc(st.title)}</span><span class="m">现场抉择 · 第 ${S.turn} 季</span></header>
      ${beatArt(st.id)}
      <div class="body">
        <p>${esc(st.text)}</p>
        <div class="choice" data-story="a">
          <h4>${esc(st.a.label)}</h4>
          <p>${esc(st.a.note)}</p>
        </div>
        <div class="choice" data-story="b">
          <h4>${esc(st.b.label)}</h4>
          <p>${esc(st.b.note)}</p>
        </div>
        <p style="font-size:9.5px;color:var(--ink-40);margin-top:6px">不选也会提交，默认走第一条。</p>
      </div>`);
  }

  function showForecast() {
    const f = E.forecast(S, 12);
    const bad = f.minCash < 0;
    const tcTxt = f.tc ? '第 ' + f.tc + ' 季' : '12 季内拿不到';
    const pcTxt = f.pc ? '第 ' + f.pc + ' 季' : (f.tc ? 'TC 之后还要 1–2 季' : '取决于 TC');
    const fdTxt = f.firstDelivery ? '第 ' + f.firstDelivery + ' 季' : '12 季内没有';
    openModal(`
      <header><span class="t">预测 · 按现有产能推到 12 季</span><span class="m">不追加投入</span></header>
      <div class="body">
        <p>这是"什么都不再做"的推演：不招人、不扩线、不接新单，只把现有部门产能投到关键路径上。它算的是<b>你不动手的代价</b>。</p>
        <div class="rep">
          <div class="repcard"><div class="k">预计 TC</div><div class="v mono" style="font-size:16px">${tcTxt}</div></div>
          <div class="repcard"><div class="k">预计 PC</div><div class="v mono" style="font-size:16px">${pcTxt}</div></div>
          <div class="repcard"><div class="k">首架交付</div><div class="v mono" style="font-size:16px">${fdTxt}</div></div>
          <div class="repcard"><div class="k">现金最低点</div><div class="v mono" style="font-size:16px;color:${bad ? 'var(--red)' : 'var(--teal)'}">${money(f.minCash)}</div></div>
        </div>
        <div class="attr">${!f.tc
          ? '按现在的部门产能，12 季内拿不到 TC —— 关键路径没被压短。加人，或者把产能从非关键项挪到关键项上。'
          : bad
            ? '按现在的节奏，现金会在中途跌破 0。要么招人让 TC 提前，要么签单拿预付款，要么两者都做。'
            : '现金能撑住，TC 也推得动。接下来要盯的是：门开之前把产能和发动机准备好，否则你交不出货。'}</div>
        <p style="font-size:10px;color:var(--ink-40)">预测只按当前产能外推，不包含你未来的招聘、扩线与新订单。</p>
      </div>
      <footer><button class="btn" data-close>知道了</button></footer>`);
  }

  let codexSel = null;
  let beatShown = 0;
  function showCodex(id) {
    const list = window.CODEX || [];
    if (!list.length) {
      openModal('<header><span class="t">工程图鉴</span><button class="x" data-close>×</button></header><div class="body">图鉴数据未加载。</div>');
      return;
    }
    codexSel = id || codexSel || list[0].id;
    const groups = [];
    list.forEach((x) => { if (groups.indexOf(x.g) < 0) groups.push(x.g); });
    const cur = list.filter((x) => x.id === codexSel)[0] || list[0];
    const nav = groups.map((g) => `<div class="cxg"><div class="cxgt">${esc(g)}</div>` +
      list.filter((x) => x.g === g).map((x) => `<button class="cxi ${x.id === cur.id ? 'on' : ''}" data-codex="${x.id}">${esc(x.n)}</button>`).join('') +
      '</div>').join('');
    openModal(`
      <header><span class="t">工程图鉴</span><span class="m">${list.length} 件 · 点左侧切换</span></header>
      <div class="cxwrap">
        <div class="cxnav">${nav}</div>
        <div class="cxmain">
          <div class="cxsvg">${cur.svg}</div>
          <div class="cxh"><b>${esc(cur.n)}</b><em>${esc(cur.en)}</em></div>
          <div class="cxspec">${cur.spec.map((s) => `<span>${esc(s)}</span>`).join('')}</div>
          <p class="cxtext">${esc(cur.text)}</p>
          <p class="cxgame">在游戏里：${esc(cur.game)}</p>
        </div>
      </div>
      <footer><button class="btn" data-close>关闭</button></footer>`, true);
  }

  function showLegend() {
    openModal(`
      <header><span class="t">图例与符号</span><button class="x" data-close>×</button></header>
      <div class="body">
        <h3>状态</h3>
        <table>
          <tr><th>符号</th><th>含义</th><th>你会看到</th></tr>
          <tr><td><span class="ls-ok"><i></i></span> 青色实线</td><td>已完成 / 已通过</td><td>工位「已转序」、阶段「通过」、任务进度条</td></tr>
          <tr><td><span class="ls-bt"><i></i></span> 琥珀粗边</td><td>瓶颈 / 当前卡点</td><td>工位外框、阶段「进行中」</td></tr>
          <tr><td><span class="ls-st"><i></i></span> 朱红</td><td>停线 / 前置未满足</td><td>工位变红、任务卡左侧红条</td></tr>
          <tr><td><span class="ls-wt"><i></i></span> 灰色虚线</td><td>未到 / 未进机位</td><td>空工位、未解锁的阶段</td></tr>
        </table>
        <h3>界面符号</h3>
        <table>
          <tr><th>符号</th><th>含义</th></tr>
          <tr><td><span class="q">?</span></td><td>悬停可看这个数字怎么算出来的</td></tr>
          <tr><td class="mono">2/3</td><td>该任务已完成 2 个人季，共需 3 个</td></tr>
          <tr><td class="mono">T12</td><td>第 12 季</td></tr>
          <tr><td>机身填充</td><td>该工位的利用率，填满的那格就是瓶颈</td></tr>
        </table>
        <p>颜色只做辅助：每个状态都同时有图形与文字，灰度下也能分辨。</p>
      </div>
      <footer><button class="btn" data-close>知道了</button></footer>`);
  }

  function showHelp() {
    openModal(`
      <header><span class="t">规则与流程</span><button class="x" data-close>×</button></header>
      <div class="body">
        <h3>五道门</h3>
        <table>
          <tr><th>门</th><th>要满足什么</th></tr>
          <tr><td>G1 设计冻结</td><td>系统布置与数字样机、设计冻结评审 CDR</td></tr>
          <tr><td>G2 首架试飞机下线</td><td>工装型架、首件总装</td></tr>
          <tr><td>G3 首飞</td><td>首架试飞机 + 铁鸟台系统联试</td></tr>
          <tr><td>G4 TC 型号合格证</td><td>静力、疲劳、包线、失速颤振、噪声结冰全部通过，并转成符合性文件</td></tr>
          <tr><td>G5 PC 生产许可证</td><td>局方确认你能稳定地造出合格飞机，之后才能交付</td></tr>
        </table>
        <h3>部门与产能</h3>
        <table>
          <tr><th>部门</th><th>负责</th><th>产能单位</th></tr>
          <tr><td>设计部</td><td>数字样机、设计冻结</td><td>人</td></tr>
          <tr><td>制造工程</td><td>工装、首件总装</td><td>人</td></tr>
          <tr><td>试验部</td><td>静力、疲劳、铁鸟台</td><td>人</td></tr>
          <tr><td>试飞部</td><td>首飞、包线、失速颤振、噪声结冰</td><td>架次/季</td></tr>
          <tr><td>适航部</td><td>审定计划、符合性文件、TC/PC</td><td>人</td></tr>
        </table>
        <p>每季每个部门只有这么多产能，派到哪个任务上就是你的取舍。任务可以跨季累积，但前置没完成就派不进去。</p>
        <h3>钱怎么走</h3>
        <p>合同价 4.20 亿/架，折扣 12%–22%。付款：签约 5%、交付前 3 季 15%、前 1 季 20%、交付 50%、尾款 10%。
        单机成本从 2.72 亿降到约 2.47 亿。逾期取消要退 90% 预付款并赔 5%。</p>
        <h3>怎么输</h3>
        <table>
          <tr><td>现金 &lt; −3 亿</td><td>董事会接管</td></tr>
          <tr><td>18 季内交付 &lt; 15 架</td><td>项目终止</td></tr>
          <tr><td>交付 15–24 架</td><td>降级为技术验证机</td></tr>
        </table>
        <h3>会影响你的事件</h3>
        <p>每局从 12 张事件里随机抽 4–5 张，提前一季预告。种子写在结算页脚，同一颗种子可以复现同一局。</p>
        <table>
          <tr><th>事件</th><th>后果</th></tr>
          ${(window.Airworthy.EVENT_POOL || []).map((e) => `<tr><td>${e.title}</td><td>${e.text}</td></tr>`).join('')}
        </table>
        <h3>三个车间故事</h3>
        <p>第 6、9、13 季会各出现一次现场抉择，分别关于试飞数据、铆钉超差和客户改装。选择会当场改变质量、信誉或产能。</p>
        <h3>几个能救命的判断</h3>
        <ul>
          <li>设计冻结越早，工装越早，首飞越早，TC 越早，交付窗口才追得上。</li>
          <li>试飞部按架次算产能：11 个架次的科目，每季只有 2–4 个。</li>
          <li>适航部最容易被忽视：它是唯一能把"做了试验"变成"局方认可"的部门。</li>
          <li>TC 到了还交不了货，是因为 PC。PC 没下来之前，飞机造出来也只能停在停机坪。</li>
        </ul>
      </div>
      <footer><button class="btn" data-close>知道了</button></footer>`, true);
  }

  function showBay(i) {
    const b = BAYS[i];
    const n = S.delivered + 1;
    const L = Math.max(0.45, Math.pow(n, -0.2345));
    const eff = Math.round(b.c * L);
    const isBt = b.c === 60;
    openModal(`
      <header><span class="t">${b.code} · ${b.n}</span><button class="x" data-close>×</button></header>
      <div class="body">
        <p>${b.d}</p>
        <table>
          <tr><th>项</th><th>值</th></tr>
          <tr><td>基础循环</td><td class="mono">${b.c} 天</td></tr>
          <tr><td>当前有效循环</td><td class="mono">${eff} 天（学习曲线 ${L.toFixed(2)}）</td></tr>
          <tr><td>本季利用率</td><td class="mono">${Math.round((b.c / 60) * 100)}%</td></tr>
          <tr><td>是否瓶颈</td><td>${isBt ? '<b style="color:var(--amber)">是。整条线的产出由它决定</b>' : '否'}</td></tr>
        </table>
        ${isBt ? '<p>系统安装是最慢的工位。你可以在「产线」里投扩线（加一个并行总装位），或者接受它——但别一边接受它，一边签下超出它的订单。</p>' : '<p>它不是瓶颈：即使全速运转，也只能等 03 工位把飞机放过来。</p>'}
      </div>
      <footer><button class="btn" data-close>关闭</button></footer>`);
  }

  function showSettlement(r) {
    const lines = r.lines.map((l) => `<div><span>${esc(l.k)}</span><span class="mono ${l.v > 0 ? 'pos' : l.v < 0 ? 'neg' : ''}">${typeof l.v === 'number' ? money(l.v) : l.v}</span></div>`).join('');
    const pens = r.penalties.map((p) => `<div><span>${esc(p.cust)} 逾期取消</span><span class="mono neg">−${(p.refund + p.penalty).toFixed(2)} 亿</span></div>`).join('');
    const evs = r.events.map((e) => `<div class="attr" style="border-color:var(--red)"><b>${esc(e.title)}</b> · ${esc(e.text)}</div>`).join('');
    const notes = r.notes.map((n) => `<div style="font-size:10.5px;color:var(--ink-55);padding:3px 0">· ${esc(n)}</div>`).join('');
    openModal(`
      <header><span class="t">第 ${r.turn} 季 · 结算</span><span class="m mono">现金 ${money(r.cashStart === undefined ? 0 : r.cashStart)} → ${money(r.cashEnd)}</span></header>
      <div class="body">
        <div class="rep">
          <div class="repcard"><div class="k">本季交付</div><div class="v mono">${r.gained || 0} <small>架</small></div></div>
          <div class="repcard"><div class="k">累计交付</div><div class="v mono">${r.deliveredTotal} <small>/ ${C.target}</small></div></div>
        </div>
        <div class="attr">${esc(r.attribution || '')}</div>
        ${evs}
        ${lines || pens ? `<h3>现金明细</h3><div class="replist">${lines}${pens}</div>` : ''}
        ${notes ? `<h3>本季发生了什么</h3>${notes}` : ''}
      </div>
      <footer><button class="btn" id="settleNext">${S.ending ? '看结项' : '进入第 ' + (r.turn + 1) + ' 季'}</button></footer>`);
    $('#settleNext').onclick = () => {
      closeModal();
      if (S.ending) { showEnding(); return; }
      render();
      maybeShowBeat();
    };
  }

  function showEnding() {
    const e = S.ending;
    const acc = S.endingAccount;
    const bars = S.history.map((h) => `<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:60px">
      <i style="display:block;background:${h.deliver ? 'var(--teal)' : 'var(--ink-20)'};height:${Math.min(100, h.deliver * 14)}%"></i>
      <em style="font-style:normal;font-size:8px;color:var(--ink-40);text-align:center;margin-top:3px">${h.turn}</em></div>`).join('');
    const gates = E.gateState(S);
    openModal(`
      <header><span class="t">结项 · ${esc(e.title)}</span><button class="x" data-close>×</button></header>
      <div class="body">
        <div class="rep">
          <div class="repcard"><div class="k">累计交付</div><div class="v mono">${S.delivered} <small>架</small></div></div>
          <div class="repcard"><div class="k">净现金</div><div class="v mono">${money(S.cash)}</div></div>
        </div>
        <p>${esc(e.text)}</p>
        ${acc && acc.slots ? `<div class="attr">结项清账：${acc.slots} 个机位没交出去，退还客户预付款 ${acc.refund.toFixed(2)} 亿，赔违约金 ${acc.penalty.toFixed(2)} 亿。这就是「账面现金不是你的钱」。</div>` : ''}
        <h3>五道门</h3>
        <div class="replist">${gates.map((g) => `<div><span>${g.n}</span><span class="mono ${g.done ? 'pos' : 'neg'}">${g.done ? '通过' : '未通过'}</span></div>`).join('')}</div>
        <h3>你的交付节奏</h3>
        <div style="display:flex;gap:2px;align-items:flex-end;margin:6px 0 4px">${bars}</div>
        <h3>这一局教给你什么</h3>
        <ul>
          <li>订单是承诺，交付才是收入。中间隔着设计、工装、试验、试飞、取证五道门。</li>
          <li>第 ${S.tc || '—'} 季拿 TC，第 ${S.pc || '—'} 季拿 PC，第 ${S.history.find((h) => h.deliver > 0) ? S.history.find((h) => h.deliver > 0).turn : '—'} 季交第一架。这三者之间的间隔就是现金压力。</li>
          <li>${S.k > 1 ? '你扩了线——这是唯一能把产能翻倍的动作。' : '你没扩线，产能一直卡在单总装位。'}</li>
          <li>${S.finance === 'gov' ? '你拿了政府基金，所以背了 25 架的交付承诺。' : '你只拿了银行贷款，没有承诺压力，但钱也少了一半多。'}</li>
        </ul>
      </div>
      <footer><button class="btn" id="again">再开一局</button></footer>`, true);
    $('#again').onclick = () => { closeModal(); restart(); };
  }

  /* ---------------- 交互 ---------------- */
  function commit() {
    if (S.ending) return;
    if (!S.finance) { askFinance(); return; }
    const prev = S.delivered;
    const r = E.commit(S);
    r.gained = S.delivered - prev;
    render();
    showSettlement(r);
  }
  function restart() {
    S = E.newGame(); tab = 'tech'; dept = 'design'; seen = {}; S.tutOn = true; beatShown = 0;
    render();
    showOnboard(0);
  }

  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-act],[data-buy],[data-work],[data-unwork],[data-dept],[data-hire],[data-offer],[data-tab],[data-open],[data-bay],[data-close],[data-assist],[data-codex],[data-story],[data-pick],[data-guide],[data-run]');
    if (!t) return;
    if (t.dataset.pick) {
      prologuePick[t.dataset.pick] = t.dataset.val;
      const idx = PROLOGUE.findIndex((x) => x.choice === t.dataset.pick);
      if (idx + 1 >= PROLOGUE.length) { finishPrologue(); return; }
      closeModal();
      showPrologue(idx + 1);
      return;
    }
    if (t.dataset.open === 'codex') return showCodex();
    if (t.dataset.assist === 'forecast') return showForecast();
    if (t.dataset.assist === 'auto') { E.autoAssign(S); render(); return toast('已按关键路径自动派工，你可以继续调整。'); }
    if (t.dataset.codex) return showCodex(t.dataset.codex);
    if (t.dataset.story) { E.setStory(S, t.dataset.story); closeModal(); render(); return; }
    if (t.dataset.toggle === 'guide') { guided = !guided; S.tutOn = guided; render(); return; }
    if (t.dataset.tut === 'off') { S.tutOn = false; render(); return; }
    if (t.dataset.run === 'all') {
      let n = 0;
      E.suggest(S).forEach((g) => { try { if (g.run(S)) n += 1; } catch (e) { /* 忽略 */ } });
      render();
      toast(n ? '已执行 ' + n + ' 条建议，你可以继续调整。' : '没有可执行的动作。');
      return;
    }
    if (t.dataset.open === 'legend') return showLegend();
    if (t.dataset.open === 'help') return showHelp();
    if (t.dataset.open === 'restart') return restart();
    if (t.dataset.bay !== undefined) return showBay(+t.dataset.bay);
    if (t.dataset.tab) { tab = t.dataset.tab; return render(); }
    if (t.dataset.dept) { dept = t.dataset.dept; return render(); }
    if (t.dataset.buy) {
      const res = E.buyEngines(S, +t.dataset.buy);
      if (!res.ok) toast(res.reason, 'warn'); else toast('已锁定 ' + t.dataset.buy + ' 台，' + (S.turn + 3) + ' 季后到货。');
      return render();
    }
    if (t.dataset.act === 'ot') { E.toggleOvertime(S); return render(); }
    if (t.dataset.act === 'expand') {
      const res = E.requestExpand(S);
      if (!res.ok) toast(res.reason, 'warn'); else toast('扩线已下单，2 季后第二条总装位投产。');
      return render();
    }
    if (t.dataset.act === 'release') {
      const res = E.requestRelease(S);
      if (!res.ok) toast(res.reason, 'warn'); else toast('3 个机位转给远洋租机，提交后到账。');
      return render();
    }
    if (t.dataset.work) {
      const res = E.assignWork(S, t.dataset.work);
      if (!res.ok) toast(res.reason, 'warn');
      return render();
    }
    if (t.dataset.unwork) { E.unassignWork(S, t.dataset.unwork); return render(); }
    if (t.dataset.hire) {
      const res = E.requestHire(S, t.dataset.hire);
      if (!res.ok) toast(res.reason, 'warn');
      else toast('已排入本季增聘，提交后到岗。');
      return render();
    }
    if (t.dataset.offer) {
      const accept = t.dataset.accept === '1';
      const res = E.decideOffer(S, t.dataset.offer, accept);
      if (!res.ok) toast(res.reason, 'warn');
      return render();
    }
    if (t.hasAttribute('data-close')) closeModal();
  });

  document.addEventListener('click', (ev) => {
    const cb = ev.target.closest('.commit');
    if (cb) { if (cb.dataset.again === '1') restart(); else commit(); }
  });

  document.addEventListener('mouseover', (ev) => {
    const k = ev.target.closest('[data-tip]');
    if (!k) return;
    const key = k.dataset.tip;
    const pdp = E.pdpLiability(S);
    const map = {
      cash: `<b>现金 ${money(S.cash)}</b><br>来源：融资、客户定金、预付货款、交付款、尾款；支出：研发与部门开支 0.6 亿/季、增聘、发动机预付、扩线、利息。<br>降到 −3 亿以下会被董事会接管。`,
      pdp: `<b>客户预付 ${money(pdp)}</b><br>这是未来交付位提前收的钱，对应 ${E.totalBacklog(S)} 架还没交出去的飞机。<br>净现金 = 现金 − 预付 = ${money(S.cash - pdp)}。`,
      backlog: `<b>在手 ${E.totalBacklog(S)} 架</b><br>签约数量，不等于能交付的数量。拿到 PC 之前，产能再高也交 0。`,
      delivered: `<b>已交付 ${S.delivered} / ${C.target}</b><br>第 ${C.maxTurn} 季结束时 ≥${C.target} 架且现金为正才算通关。`
    };
    tip(k, map[key] || '');
  });
  document.addEventListener('mouseout', (ev) => { if (ev.target.closest('[data-tip]')) hideTip(); });

  window.__game = {
    get state() { return S; },
    engine: E,
    commit: () => commit(),
    pick: (n) => { tab = n; render(); },
    dept: (d) => { dept = d; render(); },
    work: (id) => { const r = E.assignWork(S, id); render(); return r; },
    hire: (d) => { const r = E.requestHire(S, d); render(); return r; },
    finance: (k) => { E.setFinance(S, k); render(); },
    accept: (id) => { const r = E.decideOffer(S, id, true); render(); return r; },
    buy: (n) => { const r = E.buyEngines(S, n); render(); return r; },
    act: (a) => { const r = a === 'expand' ? E.requestExpand(S) : a === 'release' ? E.requestRelease(S) : a === 'ot' ? E.toggleOvertime(S) : null; render(); return r; },
    restart,
    settleNext: () => { const b = document.getElementById('settleNext'); if (b) b.click(); }
  };

  render();
  showPrologue(0);
})();
