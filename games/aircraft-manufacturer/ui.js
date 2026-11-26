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

  /* ---------------- 项目助理（RPG 式引导） ---------------- */
  const ASSIST_UI = { seen: [], hidden: false, collapsed: true, log: [] };
  const ASSET_OK = { avatar: false };
  function probeAssets() {
    Object.keys(PHOTO_SRC).forEach(function (k) {
      fetch(PHOTO_SRC[k], { method: 'HEAD' }).then(function (r) {
        if (r.ok) { ASSET_OK[k] = true; render(); }
      }).catch(function () { /* 缺失即用线稿，不请求资源本体 */ });
    });
    fetch(AVATAR_SRC, { method: 'HEAD' }).then(function (r) {
      if (r.ok) { ASSET_OK.avatar = true; render(); }
    }).catch(function () {});
  }
  const AVATAR_SRC = 'assets/assistant.jpg';
  function avatarSvg() {
    return '<svg viewBox="0 0 96 96" width="100%" height="100%">' +
      '<rect width="96" height="96" fill="#EFE9DB"/>' +
      '<circle cx="48" cy="38" r="17" fill="#DCD3BF" stroke="#16222B" stroke-width="1.3"/>' +
      '<path d="M31 35 q6 -14 17 -14 q11 0 17 14" fill="none" stroke="#16222B" stroke-width="1.3"/>' +
      '<path d="M20 96 q4 -26 28 -26 q24 0 28 26 Z" fill="#D8CEB8" stroke="#16222B" stroke-width="1.3"/>' +
      '<rect x="40" y="58" width="16" height="5" fill="#B0701C" opacity=".75"/>' +
      '</svg>';
  }
  function assistCard() {
    const st = E.nextAssistStep(S, ASSIST_UI.seen);
    if (!st || S.ending) return '';
    if (ASSIST_UI.hidden) {
      return '<button class="assist-chip" data-assist-op="reopen" title="叫回林工">' +
        '<span class="chipavatar">' + avatarSvg() + '</span><span class="chipn">林工</span></button>';
    }
    if (ASSIST_UI.collapsed) {
      return '<button class="assist-chip" data-assist-op="expand" title="展开提示">' +
        '<span class="chipavatar">' + avatarSvg() + '</span><span class="chipn">林工 · 有提示</span><span class="chipdot"></span></button>';
    }
    const ops = st.ops.map(function (o, i) {
      return '<button class="abtn' + (i === 0 ? ' main' : '') + '" data-assist-op="' + i + '">' + esc(o.t) + '</button>';
    }).join('');
    return '<div class="assist" data-step="' + st.id + '">' +
      '<div class="avatar">' + (ASSET_OK.avatar ? '<img src="' + AVATAR_SRC + '" alt="">' : '') + avatarSvg() + '</div>' +
      '<div class="abubble">' +
      '<div class="awho"><b>' + esc(E.ASSIST.name) + '</b><em>' + esc(E.ASSIST.role) + ' · 第 ' + st.season + ' 季</em></div>' +
      '<p class="atext">' + esc(st.text) + '</p>' +
      '<p class="anext">' + esc(st.next) + '</p>' +
      '<div class="aev">依据 · ' + esc(E.assistEvidence(st.id) || '当前状态') + '</div>' +
      '<div class="aops">' + ops +
      '<div class="aops2">' +
      '<button class="abtn ghost" data-assist-op="collapse">收起</button>' +
      '<button class="abtn ghost" data-assist-op="skip">关闭</button>' +
      '<button class="abtn ghost" data-assist-op="replay">回看</button></div></div>' +
      '</div></div>';
  }
  function assistHandle(op) {
    const st = E.nextAssistStep(S, ASSIST_UI.seen);
    if (!st) return;
    if (op === 'expand') { ASSIST_UI.collapsed = false; render(); return; }
    if (op === 'collapse') { ASSIST_UI.collapsed = true; render(); return; }
    if (op === 'reopen') { ASSIST_UI.hidden = false; ASSIST_UI.collapsed = false; render(); return; }
    if (op === 'skip') { ASSIST_UI.hidden = true; render(); return; }
    if (op === 'replay') { showAssistLog(); return; }
    const act = st.ops[Number(op)];
    ASSIST_UI.seen.push(st.id);
    ASSIST_UI.log.push(st.id);
    sfx('click');
    if (act && act.tab) { tab = act.tab; }
    if (st.id === 's3-end') ASSIST_UI.hidden = true;
    render();
  }
  function showAssistLog() {
    const lines = ASSIST_UI.log.map(function (id) {
      const st = E.ASSIST.steps.filter(function (x) { return x.id === id; })[0];
      return st ? '<div class="alogitem"><b>' + esc(st.text) + '</b><span>' + esc(st.next) + '</span></div>' : '';
    }).join('');
    openModal('<header><span class="t">林工说过的话</span><span class="m">回看</span></header>' +
      '<div class="body">' + (lines || '<p>还没说什么。</p>') + '</div>' +
      '<footer><button class="btn" data-close>关闭</button></footer>');
  }



  /* ---------------- 音效：WebAudio 合成，无外部文件 ---------------- */
  const AUD = { ctx: null, muted: false, vol: 0.5, failed: false };
  function audioCtx() {
    if (AUD.ctx || AUD.failed) return AUD.ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { AUD.failed = true; return null; }
      AUD.ctx = new AC();
    } catch (e) { AUD.failed = true; }
    return AUD.ctx;
  }
  function tone(freq, dur, type, gain, delay) {
    const ctx = audioCtx();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      const t0 = ctx.currentTime + (delay || 0);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, (gain || 0.06) * AUD.vol), t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* 静默降级 */ }
  }
  function sfx(kind) {
    if (AUD.muted) return;
    if (kind === 'click') tone(760, 0.05, 'sine', 0.04);
    else if (kind === 'tab') tone(520, 0.05, 'triangle', 0.045);
    else if (kind === 'ok') { tone(660, 0.09, 'sine', 0.05); tone(990, 0.12, 'sine', 0.04, 0.09); }
    else if (kind === 'warn') tone(200, 0.16, 'square', 0.035);
    else if (kind === 'deliver') { tone(523, 0.09, 'sine', 0.05); tone(659, 0.09, 'sine', 0.05, 0.09); tone(784, 0.16, 'sine', 0.05, 0.18); }
    else if (kind === 'alarm') { tone(140, 0.18, 'sawtooth', 0.04); tone(120, 0.2, 'sawtooth', 0.035, 0.2); }
  }
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

  // 照片放在 assets/ 下，存在则优先使用；缺失时自动回退到线稿
  const PHOTO_SRC = {
    yard: 'assets/prologue-yard.jpg',
    shop: 'assets/prologue-shop.jpg',
    desk: 'assets/prologue-notebook.jpg',
    board: 'assets/prologue-board.jpg',
    runway: 'assets/prologue-runway.jpg'
  };
  function artBlock(key) {
    const svg = PROLOGUE_ART[key] || '';
    const src = PHOTO_SRC[key];
    if (!src || !ASSET_OK[key]) return '<div class="proart">' + svg + '</div>';
    return '<div class="proart">' +
      '<img class="artimg" src="' + src + '" alt="" onerror="this.parentNode.classList.add(\'noimg\');this.remove()">' +
      '<div class="artfallback">' + svg + '</div>' +
      '</div>';
  }

  function artWrap(inner, vb) {
    return '<svg viewBox="' + (vb || '0 0 1000 360') + '" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block">' + inner + '</svg>';
  }

  const PROLOGUE_ART = {
    yard: artWrap(
      '<defs>' +
      '<linearGradient id="gSkyY" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3EEE2"/><stop offset="1" stop-color="#E3DBC9"/></linearGradient>' +
      '<linearGradient id="gGndY" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D9D2C0"/><stop offset="1" stop-color="#C9C1AC"/></linearGradient>' +
      '<radialGradient id="gDoorY" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#F0D9A8" stop-opacity=".85"/><stop offset="1" stop-color="#F0D9A8" stop-opacity="0"/></radialGradient>' +
      '</defs>' +
      '<rect x="0" y="0" width="1000" height="360" fill="url(#gSkyY)"/>' +
      '<rect x="0" y="200" width="1000" height="30" fill="#F5F1E6" opacity=".65"/>' +
      '<rect x="0" y="214" width="1000" height="146" fill="url(#gGndY)"/>' +
      '<g stroke="#8D887C" stroke-width=".8" opacity=".35"><path d="M0 244 L1000 244"/><path d="M0 262 L1000 262"/><path d="M0 286 L1000 286"/><path d="M0 316 L1000 316"/></g>' +
      '<ellipse cx="196" cy="216" rx="150" ry="9" fill="#9C9482" opacity=".33"/>' +
      '<ellipse cx="425" cy="217" rx="120" ry="8" fill="#9C9482" opacity=".3"/>' +
      '<rect x="92" y="142" width="208" height="72" fill="#E7E0CE" stroke="#16222B" stroke-width="1.2"/>' +
      '<path d="M92 142 L196 110 L300 142" fill="#DED6C3" stroke="#16222B" stroke-width="1.2"/>' +
      '<rect x="120" y="168" width="48" height="46" fill="#F2E6C8" stroke="#16222B" stroke-width="1"/>' +
      '<ellipse cx="144" cy="191" rx="30" ry="26" fill="url(#gDoorY)"/>' +
      '<rect x="196" y="168" width="48" height="46" fill="#CFC7B4" stroke="#16222B" stroke-width="1"/>' +
      '<g stroke="#8D887C" stroke-width=".7" opacity=".5"><path d="M200 178 L240 178"/><path d="M200 190 L240 190"/><path d="M200 202 L240 202"/></g>' +
      '<rect x="330" y="158" width="190" height="56" fill="#E4DCCA" stroke="#16222B" stroke-width="1.2"/>' +
      '<path d="M330 158 L425 130 L520 158" fill="#D8D0BC" stroke="#16222B" stroke-width="1.2"/>' +
      '<rect x="370" y="178" width="58" height="36" fill="#CDC5B1" stroke="#16222B" stroke-width="1"/>' +
      '<rect x="470" y="188" width="30" height="26" fill="#F2E6C8" stroke="#16222B" stroke-width="1"/>' +
      '<rect x="560" y="116" width="24" height="98" fill="#DDD5C2" stroke="#16222B" stroke-width="1.2"/>' +
      '<g stroke="#8D887C" stroke-width=".8" opacity=".55"><path d="M560 132 L584 132"/><path d="M560 150 L584 150"/><path d="M560 168 L584 168"/></g>' +
      '<path d="M700 214 L700 70" stroke="#16222B" stroke-width="2.2"/>' +
      '<path d="M596 88 L706 62 L762 88" stroke="#16222B" stroke-width="1.6" fill="none"/>' +
      '<path d="M762 88 L762 130" stroke="#B0701C" stroke-width="1.4"/>' +
      '<path d="M706 62 L706 100" stroke="#1E6F78" stroke-width="1.4"/>' +
      '<g stroke="#8D887C" stroke-width=".9" opacity=".45"><path d="M790 214 L790 190 L832 190 L832 214"/><path d="M850 214 L850 176 L886 176 L886 214"/><path d="M902 214 L902 196 L952 196 L952 214"/></g>' +
      '<g stroke="#FFFFFF" stroke-width="2" opacity=".5"><path d="M0 226 L1000 226"/><path d="M120 250 L420 250"/><path d="M600 274 L900 274"/></g>' +
      '<text x="40" y="336" font-size="11" fill="#8D887C" font-family="monospace" letter-spacing="3">EARLY MORNING · RIVERSIDE WORKS</text>', '0 26 1000 322'),

    shop: artWrap(
      '<defs>' +
      '<linearGradient id="gHallS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DCD5C4"/><stop offset="1" stop-color="#CFC8B7"/></linearGradient>' +
      '<linearGradient id="gBarrelS" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#E9E2D0"/><stop offset=".45" stop-color="#F6F1E4"/><stop offset="1" stop-color="#CFC7B3"/></linearGradient>' +
      '<linearGradient id="gLampS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2DFB2" stop-opacity=".55"/><stop offset="1" stop-color="#F2DFB2" stop-opacity="0"/></linearGradient>' +
      '</defs>' +
      '<rect x="0" y="0" width="1000" height="360" fill="url(#gHallS)"/>' +
      '<path d="M470 60 L470 300 L560 300 L560 60 Z" fill="url(#gLampS)"/>' +
      '<path d="M150 60 L150 300 L230 300 L230 60 Z" fill="url(#gLampS)"/>' +
      '<g stroke="#8D887C" stroke-width=".9" opacity=".55"><path d="M0 58 L1000 58"/><path d="M0 96 L1000 96"/><path d="M60 58 L100 96 L140 58 L180 96 L220 58 L260 96 L300 58 L340 96 L380 58 L420 96"/><path d="M460 58 L500 96 L540 58 L580 96 L620 58 L660 96 L700 58 L740 96 L780 58 L820 96 L860 58 L900 96 L940 58"/></g>' +
      '<path d="M120 62 L120 132 L860 132 L860 62" stroke="#16222B" stroke-width="1.6" fill="none"/>' +
      '<rect x="466" y="132" width="54" height="26" fill="#D8D0BD" stroke="#16222B" stroke-width="1.2"/>' +
      '<path d="M493 158 L493 198" stroke="#16222B" stroke-width="1.2"/>' +
      '<path d="M462 198 L524 198" stroke="#16222B" stroke-width="2"/>' +
      '<ellipse cx="430" cy="302" rx="130" ry="12" fill="#9C9482" opacity=".3"/>' +
      '<path d="M180 300 L180 208 L360 208 L360 300" stroke="#16222B" stroke-width="1.6" fill="none"/>' +
      '<path d="M620 300 L620 208 L800 208 L800 300" stroke="#16222B" stroke-width="1.6" fill="none"/>' +
      '<path d="M360 232 L620 232" stroke="#8D887C" stroke-width="1" opacity=".6"/>' +
      '<path d="M360 268 L620 268" stroke="#8D887C" stroke-width="1" opacity=".6"/>' +
      '<ellipse cx="470" cy="246" rx="46" ry="58" fill="url(#gBarrelS)" stroke="#16222B" stroke-width="1.6"/>' +
      '<path d="M516 202 L604 210 L604 282 L516 290" fill="#EDE6D4" stroke="#16222B" stroke-width="1.4"/>' +
      '<ellipse cx="604" cy="246" rx="24" ry="36" fill="#DCD4C1" stroke="#16222B" stroke-width="1.4"/>' +
      '<g stroke="#8D887C" stroke-width=".7" opacity=".75"><path d="M470 190 L470 302"/><path d="M496 196 L496 296"/><path d="M530 200 L530 292"/><path d="M560 204 L560 288"/><path d="M590 208 L590 284"/></g>' +
      '<g stroke="#8D887C" stroke-width=".55" opacity=".55"><path d="M452 200 L452 292"/><path d="M440 204 L440 288"/><path d="M428 208 L428 284"/></g>' +
      '<ellipse cx="300" cy="292" rx="16" ry="4" fill="#9C9482" opacity=".45"/>' +
      '<ellipse cx="676" cy="294" rx="14" ry="4" fill="#9C9482" opacity=".45"/>' +
      '<g fill="#16222B" fill-opacity=".62"><circle cx="300" cy="262" r="7"/><path d="M292 270 h16 v24 h-16 z"/><circle cx="676" cy="266" r="7"/><path d="M668 274 h16 v22 h-16 z"/><circle cx="714" cy="272" r="6"/><path d="M707 279 h14 v19 h-14 z"/></g>' +
      '<path d="M0 300 L1000 300" stroke="#16222B" stroke-width="1.6"/>' +
      '<g stroke="#8D887C" stroke-width=".8" opacity=".4"><path d="M0 318 L1000 318"/><path d="M60 334 L240 334"/><path d="M700 334 L880 334"/></g>' +
      '<text x="40" y="350" font-size="11" fill="#8D887C" font-family="monospace" letter-spacing="3">BAY 01 · FUSELAGE SECTION ON JIG</text>', '0 30 1000 330'),

    desk: artWrap(
      '<defs>' +
      '<linearGradient id="gDeskD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DCD3BF"/><stop offset="1" stop-color="#C8BFA9"/></linearGradient>' +
      '<radialGradient id="gLampD" cx="0.18" cy="0.25" r="0.85"><stop offset="0" stop-color="#FBF0D4" stop-opacity=".9"/><stop offset="1" stop-color="#FBF0D4" stop-opacity="0"/></radialGradient>' +
      '</defs>' +
      '<rect x="0" y="0" width="1000" height="360" fill="url(#gDeskD)"/>' +
      '<rect x="0" y="0" width="1000" height="360" fill="url(#gLampD)"/>' +
      '<path d="M0 236 L1000 236" stroke="#A89E88" stroke-width="1.4"/>' +
      '<path d="M60 236 L60 340 L940 340 L940 236" fill="#BFB5A0" stroke="#8D887C" stroke-width="1"/>' +
      '<rect x="180" y="150" width="420" height="196" fill="#F7F2E4" stroke="#16222B" stroke-width="1.6"/>' +
      '<path d="M180 150 L560 150 L610 176 L230 176 Z" fill="#EFE7D4" stroke="#16222B" stroke-width="1.2"/>' +
      '<path d="M560 150 L610 176 L610 300 L560 346 Z" fill="#E7DECB" stroke="#16222B" stroke-width="1"/>' +
      '<g stroke="#B0701C" stroke-width=".8" opacity=".55">' +
      '<path d="M210 196 L520 196"/><path d="M210 210 L470 210"/><path d="M210 224 L540 224"/><path d="M210 238 L430 238"/><path d="M210 252 L500 252"/>' +
      '<path d="M210 274 L380 274"/><path d="M210 288 L520 288"/><path d="M210 302 L450 302"/>' +
      '</g>' +
      '<g stroke="#16222B" stroke-width=".9" opacity=".45"><path d="M232 262 L420 262 L420 316 L232 316 Z"/><path d="M310 262 L310 316"/></g>' +
      '<path d="M660 240 L900 240 L900 254 L660 254 Z" fill="#E2D8C2" stroke="#16222B" stroke-width="1.2"/>' +
      '<g stroke="#16222B" stroke-width=".7" opacity=".5"><path d="M680 244 L680 250"/><path d="M700 244 L700 250"/><path d="M720 244 L720 250"/><path d="M740 244 L740 250"/><path d="M760 244 L760 250"/><path d="M780 244 L780 250"/></g>' +
      '<path d="M652 300 L870 300 L878 312 L660 312 Z" fill="#D8CEB8" stroke="#16222B" stroke-width="1"/>' +
      '<ellipse cx="404" cy="352" rx="220" ry="7" fill="#9C9482" opacity=".28"/>' +
      '<text x="40" y="60" font-size="11" fill="#8D887C" font-family="monospace" letter-spacing="3">DESK DRAWER · OLD NOTEBOOK</text>', '0 30 1000 330'),

    board: artWrap(
      '<defs>' +
      '<linearGradient id="gRoomB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EFE9DB"/><stop offset="1" stop-color="#DCD5C4"/></linearGradient>' +
      '<linearGradient id="gWinB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F8F5EC"/><stop offset="1" stop-color="#E4DED0"/></linearGradient>' +
      '</defs>' +
      '<rect x="0" y="0" width="1000" height="360" fill="url(#gRoomB)"/>' +
      '<rect x="636" y="80" width="248" height="120" fill="url(#gWinB)" stroke="#16222B" stroke-width="1.4"/>' +
      '<g stroke="#8D887C" stroke-width="1" opacity=".7"><path d="M760 80 L760 200"/><path d="M636 140 L884 140"/></g>' +
      '<path d="M636 200 L884 200 L920 300 L600 300 Z" fill="#F6F1E4" opacity=".45"/>' +
      '<rect x="110" y="84" width="430" height="152" fill="#F8F5EC" stroke="#16222B" stroke-width="1.6"/>' +
      '<path d="M140 198 L510 198" stroke="#16222B" stroke-width="1.4"/>' +
      '<g stroke="#B0701C" stroke-width="1.6"><path d="M168 198 L168 180"/><path d="M240 198 L240 172"/><path d="M312 198 L312 176"/><path d="M384 198 L384 168"/><path d="M456 198 L456 174"/></g>' +
      '<g stroke="#8D887C" stroke-width=".9" opacity=".75"><path d="M140 116 L330 116"/><path d="M140 132 L280 132"/><path d="M140 148 L364 148"/><path d="M140 164 L240 164"/></g>' +
      '<g stroke="#1E6F78" stroke-width="1"><path d="M470 116 L500 116"/><path d="M470 132 L500 132"/><path d="M470 148 L500 148"/></g>' +
      '<ellipse cx="490" cy="302" rx="290" ry="10" fill="#9C9482" opacity=".25"/>' +
      '<path d="M120 300 L206 238 L782 238 L868 300 Z" fill="#D6CCB6" stroke="#16222B" stroke-width="1.4"/>' +
      '<g stroke="#8D887C" stroke-width=".8" opacity=".5"><path d="M258 250 L740 250"/><path d="M214 276 L782 276"/></g>' +
      '<g stroke="#16222B" stroke-width="1.2" fill="none"><path d="M300 238 L300 206 L342 206 L342 238"/><path d="M440 238 L440 202 L482 202 L482 238"/><path d="M580 238 L580 206 L622 206 L622 238"/></g>' +
      '<g fill="#16222B" fill-opacity=".5"><rect x="252" y="248" width="26" height="3"/><rect x="352" y="256" width="34" height="3"/><rect x="470" y="252" width="20" height="3"/></g>' +
      '<path d="M64 60 L64 300" stroke="#8D887C" stroke-width="1" opacity=".5"/>' +
      '<text x="40" y="336" font-size="11" fill="#8D887C" font-family="monospace" letter-spacing="3">BOARD ROOM · 18 QUARTERS</text>', '0 30 1000 330'),

    runway: artWrap(
      '<defs>' +
      '<linearGradient id="gDawnR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DAD5C8"/><stop offset=".62" stop-color="#E8DCC4"/><stop offset="1" stop-color="#F0E2C6"/></linearGradient>' +
      '<linearGradient id="gRwyR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9C2B0"/><stop offset="1" stop-color="#B3AB98"/></linearGradient>' +
      '</defs>' +
      '<rect x="0" y="0" width="1000" height="360" fill="url(#gDawnR)"/>' +
      '<rect x="0" y="150" width="1000" height="50" fill="#FBF5E6" opacity=".55"/>' +
      '<rect x="0" y="196" width="1000" height="164" fill="url(#gRwyR)"/>' +
      '<g stroke="#F7F2E6" stroke-width=".8" opacity=".35"><path d="M0 240 L1000 240"/><path d="M0 262 L1000 262"/><path d="M0 292 L1000 292"/><path d="M0 328 L1000 328"/></g>' +
      '<path d="M300 196 L110 360" stroke="#F6F1E2" stroke-width="3"/>' +
      '<path d="M700 196 L890 360" stroke="#F6F1E2" stroke-width="3"/>' +
      '<g stroke="#F6F1E2" stroke-width="2.6"><path d="M500 302 L500 322"/><path d="M500 256 L500 278"/><path d="M500 216 L500 234"/></g>' +
      '<g fill="#B0701C"><circle cx="352" cy="244" r="2.4"/><circle cx="330" cy="286" r="2.8"/><circle cx="646" cy="244" r="2.4"/><circle cx="672" cy="290" r="2.8"/></g>' +
      '<path d="M792 196 L792 118 L832 118 L832 196" fill="#D9D2C0" stroke="#16222B" stroke-width="1.2"/>' +
      '<path d="M778 118 L846 118 L846 102 L778 102 Z" fill="#E4DCCA" stroke="#16222B" stroke-width="1.2"/>' +
      '<g stroke="#8D887C" stroke-width=".8" opacity=".6"><path d="M784 110 L840 110"/></g>' +
      '<ellipse cx="500" cy="214" rx="90" ry="6" fill="#9C9482" opacity=".22"/>' +
      '<g transform="translate(486,178) rotate(-8)">' +
      '<path d="M-52 0 L44 -5 L64 0 L44 5 L-52 0 Z" fill="#2C3742" fill-opacity=".85"/>' +
      '<path d="M-6 -2 L-26 -24 L-14 -24 L8 -2 Z" fill="#2C3742" fill-opacity=".7"/>' +
      '<path d="M-6 2 L-26 24 L-14 24 L8 2 Z" fill="#2C3742" fill-opacity=".7"/>' +
      '<path d="M46 -2 L58 -16 L62 -16 L56 -2 Z" fill="#2C3742" fill-opacity=".7"/>' +
      '<path d="M-30 7 L20 7" stroke="#C9A15C" stroke-width="1" opacity=".6"/>' +
      '</g>' +
      '<g stroke="#B0701C" stroke-width="1.2" opacity=".55"><path d="M404 192 L456 188"/><path d="M576 186 L624 192"/></g>' +
      '<text x="40" y="340" font-size="11" fill="#8D887C" font-family="monospace" letter-spacing="3">FIRST FLIGHT · 42 MINUTES</text>', '0 40 1000 320')
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
    { t: '前任总师老周', art: 'desk',
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
    const art = p.art ? artBlock(p.art) : '';
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
    S.tutOn = true; beatShown = 0; ASSIST_UI.seen = []; ASSIST_UI.log = []; ASSIST_UI.hidden = false; ASSIST_UI.collapsed = true;
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
        <button data-audio="toggle">声 ${AUD.muted ? '关' : '开'}</button>
        <input class="volin" type="range" min="0" max="100" value="${Math.round(AUD.vol * 100)}" data-audio="vol" title="音量">
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
      { k: 'buy', n: '采购' }, { k: 'biz', n: '商务' }, { k: 'cust', n: '客户' }
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
      ${hint ? `<div class="hintbar lead"><b>本季指挥</b>${esc(hint)}</div>` : ''}
      ${guided ? guideBlock() : ''}
      <div class="tabs">${tabs.map((t) => `<button data-tab="${t.k}" class="${tab === t.k ? 'on' : ''}">${t.n}${dot(t.k)}</button>`).join('')}</div>
      <div class="tabbody">${tabBody()}</div>`;
  }
  function guideBlock() {
    const list = E.suggest(S);
    if (!list.length) return '';
    const must = list[0];
    const later = list.slice(1, 3);
    return `<div class="guide">
      <div class="gh"><span>本季必做</span><em>先做这一条</em></div>
      <div class="gitem must"><span class="gnum">1</span><span class="gtext"><b>${esc(must.label)}</b><em>${esc(must.detail)}</em></span></div>
      <button class="btn sm" data-run="must">执行这条</button>
      ${later.length ? `<div class="gh sub"><span>可以考虑</span><em>不做也能过</em></div>` +
        later.map((g, i) => `<div class="gitem sub"><span class="gnum">·</span><span class="gtext"><b>${esc(g.label)}</b><em>${esc(g.detail)}</em></span></div>`).join('') : ''}
    </div>`;
  }

  function nextHint() {
    if (S.turn === 1 && !S.finance) return '先选融资方案，否则招不起人、买不起发动机。';
    const idle = E.DEPTS.find((d) => E.deptLeft(S, d.id) > 0 &&
      E.worksByDept(d.id, S).some((w) => !E.workDone(S, w.id) && E.canAssign(S, w.id).ok));

    if (idle) return '还有部门产能没用完，把本季的人力派到能推进的工作上。';
    if (E.openOffers(S).length) return '有 ' + E.openOffers(S).length + ' 张订单等你决定。';
    if (S.pc && S.engines < 4 && S.engineOrders.length === 0) return '发动机库存见底，下季可能无件可装。';
    const g = E.nextGate(S);
    if (g) {
      const w = E.workById(g.work);
      const miss = w.req.filter((r) => !E.workDone(S, r)).map((r) => E.workById(r).n);
      return '下一道门：' + g.n + '。' + (miss.length ? '缺 ' + miss.join('、') + '。' : g.hint + '。');
    }
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
        ${(function () {
          const tr = E.maturityTrend(S);
          if (!tr.length) {
            return `<div class="matline empty"><span class="mlt">成熟度趋势</span><em>PC 后开始记录（当前为预测/尚未生效）</em></div>`;
          }
          const pts = tr.map(function (p) {
            const h = Math.max(8, Math.round(p.value));
            const sym = p.delta > 0 ? '▲' : p.delta < 0 ? '▼' : '–';
            return `<button class="mp ${p.level}" data-mat="${p.turn}" title="T${p.turn} 成熟度 ${p.value}（${p.delta > 0 ? '+' : ''}${p.delta}）">` +
              `<i style="height:${h}%"></i><s>${sym}</s><b class="mono">${p.turn}</b></button>`;
          }).join('');
          return `<div class="matline"><span class="mlt">成熟度趋势</span><div class="mwrap">${pts}</div>` +
            `<span class="mlg"><em class="up">▲ 回升</em><em class="dn">▼ 侵蚀</em><em class="risk">红线 = 阈值 ${tr[0].threshold}</em></span></div>`;
        })()}
        ${(function () {
          const mr = E.maturityRisk(S);
          const lvl = mr.level === 'risk' ? 'risk' : 'ok';
          return `<div class="row matrow ${lvl}">
            <div class="lbl"><b>量产成熟度 ${S.pc ? '' : '（PC 后生效）'}</b>
            <span>${S.pc ? '当前 ' + S.maturity + ' → 预计 ' + mr.projected + '；影响产能，与质量、客户关系是三件独立的事。' : '现在不影响结算；PC 之后按加班、配置负荷、质量折算产能。'}</span>
            <span class="msrc">依据：${mr.reasons.length ? mr.reasons.join(' · ') : '本季无侵蚀项'}</span></div>
            <div class="mono matv">${S.pc ? S.maturity : '—'}</div>
          </div>`;
        })()}
        ${S.pc ? `<div class="row">
          <div class="lbl"><b>工艺改进 · ${C.processCost} 亿</b><span>成熟度 ${S.maturity} → ${Math.min(100, S.maturity + C.processGain)}${S.processCooldown > S.turn ? '（第 ' + S.processCooldown + ' 季后可再做）' : ''}。返工压力下降，产能回升。</span></div>
          <button class="btn ${S.pending.process ? 'on' : ''}" data-act="process" ${S.processCooldown > S.turn || S.cash < C.processCost ? 'disabled' : ''}>${S.pending.process ? '已下单' : '改进'}</button>
        </div>` : `<div class="row"><div class="lbl"><b>工艺改进</b><span>拿到 PC、进入量产之后才能做。</span></div></div>`}
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
    if (tab === 'cust') return custBody();
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
          <div class="meta mono">${(E.CONFIG_TPL[o.config || 'std'] || {}).n || '标准通用'} · 窗口 T${o.win[0]}–T${o.win[1]} · 折扣 ${Math.round(o.disc * 100)}%${S.discShift ? ' → 实付 ' + Math.round(Math.min(0.3, o.disc + S.discShift) * 100) + '%' : ''} · 定金 5%</div>
          <div class="note">${esc(o.note)}</div>
          ${o.config === 'hl' ? '<div class="cfgtag">配置：高频低成本 · 折扣更深、窗口前移一季、产线压力 +1</div>' : ''}
          ${offerFeasibility(o)}
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
  function custBody() {
    const rows = Object.keys(S.airlines).map(function (name) {
      const a = S.airlines[name];
      const visited = S.pending.visits.indexOf(name) >= 0;
      const relW = Math.max(0, Math.min(100, a.rel));
      return `<div class="cust">
        <div class="ch"><b>${esc(name)}</b><em>${esc(a.note)}</em></div>
        <div class="cstats">
          <span>机队 <b class="mono">${a.fleet}</b></span>
          <span>已交付 <b class="mono">${a.got}</b></span>
          <span>关系 <b class="mono">${a.rel}</b></span>
          <span>可靠性 <b class="mono">${a.rel9 == null ? '—' : a.rel9}</b></span>
        </div>
        <div class="cbar"><i style="width:${relW}%"></i></div>
        <button class="btn sm" data-visit="${esc(name)}" ${visited ? 'disabled' : ''}>${visited ? '本季已拜访' : '拜访 0.4 亿 · 关系 +8'}</button>
      </div>`;
    }).join('');
    return `
      <div class="note">航司不是抽象买家：它们有机队规模、有关系、有运行反馈。关系越好，下一单的议价空间越大；可靠性低于 55 会掉信誉。</div>
      ${rows}`;
  }

  function offerFeasibility(o) {
    const first = S.pc ? Math.max(S.turn, o.win[0]) : null;
    const engCover = Math.floor(S.engines / 2) + S.engineOrders.reduce((a, x) => a + x.qty, 0) / 2;
    const cap = E.capacity(S) || 1;
    const quarters = Math.max(0, o.win[1] - (first || S.turn) + 1);
    const canBuild = Math.round(quarters * cap);
    let verdict = 'safe', label = '安全';
    if (!S.pc && o.win[1] <= 14) { verdict = 'bad'; label = '不可行'; }
    else if (engCover < o.qty * 0.5 || canBuild < o.qty * 0.6) { verdict = 'tight'; label = '紧张'; }
    return '<div class="ofeas ' + verdict + '">' +
      '<span>最早交付 <b class="mono">' + (first ? 'T' + first : '待 PC') + '</b></span>' +
      '<span>发动机覆盖 <b class="mono">' + Math.floor(engCover) + ' 架</b></span>' +
      '<span>窗口内可造 <b class="mono">' + canBuild + ' 架</b></span>' +
      '<em>' + label + '</em></div>';
  }

  function techBody() {
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
    const echoes = (S.echoes || []).slice(-2);
    const echoHtml = echoes.length
      ? '<div class="echoline">回响：' + echoes.map(function (e) { return '第' + e.turn + '季「' + esc(e.title) + '」'; }).join(' · ') + '</div>'
      : '';
    $('.events').innerHTML = `<header><span class="t">事件</span><span class="m">${head}</span></header>${html}${echoHtml}`;
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
      <span class="tg">${goals.map((g, i) => g.go
        ? `<button class="ti ${g.on ? 'on' : ''}" data-go="${g.go}">${g.on ? '✓' : i + 1} ${esc(g.t)}</button>`
        : `<span class="ti ${g.on ? 'on' : ''}">${g.on ? '✓' : i + 1} ${esc(g.t)}</span>`).join('')}</span>
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
    const host = document.querySelector('.assisthost');
    if (host) host.innerHTML = assistCard();
    $('.commit').disabled = !!S.ending || modalOpen();
  }

  function maybeShowBeat() {
    if (S.story && !S.ending && beatShown !== S.turn && !modalOpen()) {
      beatShown = S.turn;
      showStory();
    }
  }

  /* ---------------- 弹窗 ---------------- */
  const BEAT_ART = { firstflight: 'runway', visit: 'yard', notebook: 'desk', board: 'board' };
  function beatArt(id) {
    const k = BEAT_ART[id];
    return k ? artBlock(k) : '';
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


  /* ---------------- 第三章垂直切片：箭体 ---------------- */
  const RS = { route: null, launched: false };
  function rocketCalc(route) { return E.rocketCalc(route, 8); }

  function showRocket() {
    const calc = RS.route ? rocketCalc(RS.route) : null;
    const body = !RS.route
      ? `<p>主线结束，总装线空出来了。同一批工装、同一批结构工程师，可以转向箭体。</p>
         <p>这一步只问一件事：<b>做一次性，还是做可复用？</b></p>
         <div class="choice" data-route="expendable"><h4>一次性 · 单发 4.2 亿</h4><p>不追加研制，季度产能决定交付。毛利薄，但不赌未来。</p></div>
         <div class="choice" data-route="reusable"><h4>可复用 · 研制 18 亿，单发 1.32 亿</h4><p>前三个季度只有支出没有收入；一旦飞起来，单发毛利翻倍。</p></div>`
      : `<p>${RS.route === 'reusable' ? '可复用路线：前三季纯投入，第四季开始回收。' : '一次性路线：每季稳定出货，现金流平缓。'}</p>
         <div class="replist">
           ${calc.rows.map((r) => `<div><span>第 ${r.q} 季${r.dev ? ' · 研制 ' + r.dev.toFixed(0) + ' 亿' : ''}${r.n ? ' · 交付 ' + r.n + ' 发' : ''}</span><span class="mono ${r.gross - r.dev >= 0 ? 'pos' : 'neg'}">${(r.cash).toFixed(1)} 亿</span></div>`).join('')}
         </div>
         <div class="attr">八季后：交付 ${calc.flown} 发，账上 ${calc.cash.toFixed(1)} 亿，最低点 ${calc.minCash.toFixed(1)} 亿。单发成本 ${calc.unit} 亿。
         ${RS.route === 'reusable'
            ? '研制 18 亿 ÷（4.68 − 1.80）≈ 6.25 发回本。同一份 12 发合同，可复用最终多赚 16 亿 —— 但中途现金会掉到 ' + calc.minCash.toFixed(0) + ' 亿，得先找到人替你垫。'
            : '不需要赌订单量，也不会中途失血；代价是同样的合同少赚 16 亿。'}</div>
         <p style="font-size:9.5px;color:var(--ink-40)">这是垂直切片：不含 TC/PC、客户谈判、发射工位排产与复用翻修，也不进入主线存档。只验证「一次性 vs 可复用」的成本交叉点与现金流风险。</p>`;
    openModal(`
      <header><span class="t">第三章 · 把总装能力转向箭体</span><span class="m">垂直切片</span></header>
      <div class="body">${body}</div>
      <footer>
        ${RS.route ? '<button class="btn ghost" id="rsBack">重选</button>' : ''}
        <button class="btn" data-close>${RS.route ? '回到结项' : '先不进入'}</button>
      </footer>`, true);
    document.querySelectorAll('[data-route]').forEach(function (el) {
      el.onclick = function () { RS.route = el.dataset.route; showRocket(); };
    });
    const back = document.getElementById('rsBack');
    if (back) back.onclick = function () { RS.route = null; showRocket(); };
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
        ${r.review ? `<h3>本季复盘</h3>
        <div class="rev">
          ${r.review.items.map((x) => `<div class="revrow"><span class="rk">${esc(x.k)}</span><b class="mono">${esc(String(x.v))}</b><em>${esc(x.why)}</em><i class="src" title="来源">${esc(x.src)}</i></div>`).join('')}
        </div>
        <div class="revnext"><b>下一季先做</b>${esc(r.review.next)}</div>` : ''}
        ${evs}
        ${lines || pens ? `<h3>现金明细</h3><div class="replist">${lines}${pens}</div>` : ''}
        ${(function () {
          const fb = (S.feedback || []).filter((x) => x.turn === r.turn);
          if (!fb.length) return '';
          return '<h3>交付反馈</h3>' + fb.map((x) => '<div class="fb"><b>' + esc(x.cust) + ' · 可靠性 ' + x.score + '</b>' + esc(x.text) + '</div>').join('');
        })()}
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
    const ledger = E.ledgerSummary(S);
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
        <h3>决策账本</h3>
        <div class="rev">
          <div class="revrow"><span class="rk">立项组合</span><b>${esc(S.seat === 'small' ? '96 座' : '130 座')} · ${esc(S.route === 'clean' ? '全新设计' : '改型衍生')}</b><i class="src">seed ${S.seed}</i></div>
          <div class="revrow"><span class="rk">最有价值</span><b class="mono">${esc(ledger.best)}</b><i class="src">history</i></div>
          <div class="revrow"><span class="rk">最昂贵</span><b class="mono">${esc(ledger.costly)}</b><i class="src">history</i></div>
          <div class="revrow"><span class="rk">最晚修正</span><b>${esc(ledger.lateGate)}</b><i class="src">report.notes</i></div>
          ${ledger.echoes.length ? `<div class="revrow"><span class="rk">选择回响</span><b>${esc(ledger.echoes.join(' · '))}</b><i class="src">echoes</i></div>` : ''}
        </div>
        <details class="ledger"><summary>逐季决策（${esc(String(S.ledger.length))} 季有记录）</summary>
          ${S.ledger.map((x) => `<div class="ledrow"><span class="mono">T${x.turn}</span>${esc(x.acts.join('；'))}</div>`).join('')}
        </details>

        <h3>这一局教给你什么</h3>
        <ul>
          <li>订单是承诺，交付才是收入。中间隔着设计、工装、试验、试飞、取证五道门。</li>
          <li>第 ${S.tc || '—'} 季拿 TC，第 ${S.pc || '—'} 季拿 PC，第 ${S.history.find((h) => h.deliver > 0) ? S.history.find((h) => h.deliver > 0).turn : '—'} 季交第一架。这三者之间的间隔就是现金压力。</li>
          <li>${S.k > 1 ? '你扩了线——这是唯一能把产能翻倍的动作。' : '你没扩线，产能一直卡在单总装位。'}</li>
          <li>${S.finance === 'gov' ? '你拿了政府基金，所以背了 25 架的交付承诺。' : '你只拿了银行贷款，没有承诺压力，但钱也少了一半多。'}</li>
        </ul>
      </div>
      <footer><button class="btn ghost" id="rocket">进入第三章 · 箭体</button><button class="btn ghost" id="againSame">同配置重开</button><button class="btn" id="again">再开一局</button></footer>`, true);
    $('#rocket').onclick = () => { RS.route = null; showRocket(); };
    const again2 = document.getElementById('againSame');
    if (again2) again2.onclick = () => {
      const seat = S.seat, route = S.route, seed = S.seed;
      closeModal(); S = E.newGame({ seed: seed, seat: seat, route: route }); S.tutOn = true; beatShown = 0;
      ASSIST_UI.seen = []; ASSIST_UI.log = []; ASSIST_UI.hidden = false; ASSIST_UI.collapsed = true;
      render(); toast('已用相同立项与 seed 重开。');
    };
    $('#again').onclick = () => { closeModal(); restart(); };
  }

  /* ---------------- 交互 ---------------- */
  function commit() {
    if (S.ending) return;
    if (!S.finance) { askFinance(); return; }
    const prev = S.delivered;
    const r = E.commit(S);
    r.gained = S.delivered - prev;
    if (S.stopTurn === r.turn) sfx('alarm');
    else if (r.gained > 0) sfx('deliver');
    else sfx('ok');
    render();
    showSettlement(r);
  }
  function restart() {
    S = E.newGame(); tab = 'tech'; dept = 'design'; seen = {}; S.tutOn = true; beatShown = 0; ASSIST_UI.seen = []; ASSIST_UI.log = []; ASSIST_UI.hidden = false; ASSIST_UI.collapsed = true;
    render();
    showOnboard(0);
  }

  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-act],[data-buy],[data-work],[data-unwork],[data-dept],[data-hire],[data-offer],[data-tab],[data-open],[data-bay],[data-close],[data-assist],[data-codex],[data-story],[data-pick],[data-guide],[data-run],[data-visit],[data-audio],[data-route],[data-assist-op],[data-preview]');
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
    if (t.dataset.assistOp !== undefined) { assistHandle(t.dataset.assistOp); return; }
    if (t.dataset.route) { RS.route = t.dataset.route; return showRocket(); }
    if (t.dataset.toggle === 'guide') { guided = !guided; S.tutOn = guided; render(); return; }
    if (t.dataset.tut === 'off') { S.tutOn = false; render(); return; }
    if (t.dataset.go) { tab = t.dataset.go; sfx('tab'); render(); return; }
    if (t.dataset.preview) {
      const est = estimate();
      const rd = S.rdRate || 0.6;
      const interest = (S.flags.govPaid || S.flags.bankPaid) ? (S.finance === 'gov' ? 0.06 : 0.036) : 0;
      const out = rd + interest + (S.pending.enginesCost || 0) +
        (S.pending.expand ? 2.4 : 0) + (S.pending.visits.length * 0.4) +
        (S.pending.overtime ? 0.12 : 0) +
        Object.keys(S.pending.hires).reduce((a, k) => a + S.pending.hires[k] * 0.8, 0);
      const price = 4.2 * 0.85;
      openModal('<header><span class="t">本季结算预览</span><span class="m">仅估算，以提交为准</span></header>' +
        '<div class="body"><div class="replist">' +
        '<div><span>预计交付</span><span class="mono">' + est + ' 架</span></div>' +
        '<div><span>预计收款（交付 50%+尾款）</span><span class="mono pos">+' + (est * price * 0.5).toFixed(2) + ' 亿</span></div>' +
        '<div><span>预计支出（研发/利息/采购/扩线/招聘）</span><span class="mono neg">−' + out.toFixed(2) + ' 亿</span></div>' +
        '<div><span>期末现金（估算）</span><span class="mono">' + (S.cash + est * price * 0.5 - out).toFixed(2) + ' 亿</span></div>' +
        '</div>' + (function () {
          const d = E.previewDelta(S, 8);
          if (!d.length) return '<p class="dnote">与「本季什么都不做」相比，预测结果没有差异。</p>';
          return '<h3>与「本季不做决策」相比</h3><div class="rev">' +
            d.map((x) => '<div class="revrow"><span class="rk">' + esc(x.label) + '</span><b class="mono">' + esc(String(x.from)) + ' → ' + esc(String(x.to)) + '</b><i class="src">forecast</i></div>').join('') +
            '</div><p class="dnote">按当前假设估算，不是保证。forecast 只读推演，不改变存档。</p>';
        })() + '<div>' +
        '</div><p style="font-size:9.5px;color:var(--ink-40);margin-top:6px">不含本季新签单定金与事件影响。</p></div>' +
        '<footer><button class="btn" data-close>关闭</button></footer>');
      return;
    }
    if (t.dataset.run === 'must') {
      const g = E.suggest(S)[0];
      if (g) { try { g.run(S); } catch (e) { /* ignore */ } }
      render(); toast('已执行必做项，其余可以自己调。'); return;
    }
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
    if (t.dataset.tab) { tab = t.dataset.tab; sfx('tab'); return render(); }
    if (t.dataset.dept) { dept = t.dataset.dept; return render(); }
    if (t.dataset.buy) {
      const res = E.buyEngines(S, +t.dataset.buy);
      if (!res.ok) toast(res.reason, 'warn'); else toast('已锁定 ' + t.dataset.buy + ' 台，' + (S.turn + 3) + ' 季后到货。');
      return render();
    }
    if (t.dataset.visit) {
      const r = E.visitAirline(S, t.dataset.visit);
      if (!r.ok) toast(r.reason, 'warn'); else toast('已安排拜访，提交后扣 0.4 亿。');
      return render();
    }
    if (t.dataset.audio === 'toggle') { AUD.muted = !AUD.muted; render(); return; }
    if (t.dataset.mat) {
      const h = (S.maturityHistory || []).filter(function (x) { return String(x.turn) === t.dataset.mat; })[0];
      if (!h) return;
      const names = { base: '基础回升', overtime: '加班', config: '配置负荷', quality: '质量侵蚀', delivery: '交付沉淀', process: '工艺改进' };
      const rows = Object.keys(h.parts).filter(function (k) { return h.parts[k]; })
        .map(function (k) { return '<div class="revrow"><span class="rk">' + names[k] + '</span><b class="mono">' + (h.parts[k] > 0 ? '+' : '') + h.parts[k] + '</b><i class="src">parts.' + k + '</i></div>'; }).join('');
      openModal('<header><span class="t">第 ' + h.turn + ' 季 · 成熟度 ' + h.value + '</span><span class="m">' + (h.delta > 0 ? '+' : '') + h.delta + '</span></header>' +
        '<div class="body"><div class="rev">' + (rows || '<div class="revrow"><span class="rk">无变化</span></div>') + '</div>' +
        '<p style="font-size:10px;color:var(--ink-40)">每条都来自当季的实际决策，不是估算。</p></div>' +
        '<footer><button class="btn" data-close>关闭</button></footer>');
      return;
    }
    if (t.dataset.act === 'process') {
      const r = E.requestProcess(S);
      if (!r.ok) { sfx('warn'); toast(r.reason, 'warn'); } else { sfx('click'); toast('工艺改进已排入本季，提交后扣 1.2 亿。'); }
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
  document.addEventListener('input', (ev) => {
    const el = ev.target.closest('[data-audio="vol"]');
    if (el) { AUD.vol = Number(el.value) / 100; if (!AUD.muted) tone(660, 0.06, 'sine', 0.05); }
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

  // QA/截图入口：?skipIntro=1 直接进入第 1 季（跳过序章与融资弹窗），不影响正常流程
  const SKIP_INTRO = /(?:^|[?&])skipIntro=1(?:&|$)/.test(location.search);
  probeAssets();
  // QA 入口：?qa=1 展开助理；?qa=preview 再打开结算预览
  const QA = (location.search.match(/[?&]qa=([a-z]+)/) || [])[1];
  if (QA) ASSIST_UI.collapsed = false;
  render();
  if (QA === 'preview') {
    const b = document.querySelector('[data-preview]');
    if (b) b.click();
  }
  if (QA === 'pc' || QA === 'review') {
    // QA：用真实规则快进到第 15 季（PC 之后），再压低成熟度，保证状态自洽
    S = E.newGame({ seed: 20260419, seat: 'main', route: 'clean' });
    for (let t = 1; t <= 16 && !S.ending; t += 1) {
      if (t === 1) E.setFinance(S, 'gov');
      if (t === 2) E.buyEngines(S, 24);
      if (t === 3) S.offers.forEach((o) => { if (o.open && o.id === 'alt') E.decideOffer(S, o.id, true); });
      if (t === 4) { E.requestExpand(S); E.requestHire(S, 'design'); E.requestHire(S, 'mfg'); }
      if (t === 5) { E.requestHire(S, 'test'); E.requestHire(S, 'cert'); }
      if (t === 6) E.buyEngines(S, 48);
      if (t === 7) E.requestHire(S, 'flight');
      if (t === 8) S.offers.forEach((o) => { if (o.open && o.id === 'blb') E.decideOffer(S, o.id, true); });
      if (t === 10) S.offers.forEach((o) => { if (o.open && o.id === 'ocn') E.decideOffer(S, o.id, true); });
      if (t === 11) E.buyEngines(S, 48);
      E.autoAssign(S);
      E.commit(S);
    }
    S.maturity = 44;
    S.feedback = [{ turn: S.turn - 1, cust: '高原航空', score: 72, text: '首架运行三个月，客舱与系统投诉低于预期。' }];
    ASSIST_UI.hidden = true;
    tab = 'line';
    render();
    if (QA === 'review') {
      const clone = E.clone(S);
      const rep = E.commit(clone);
      showSettlement(rep);
    }
  }
  if (SKIP_INTRO) {
    E.setFinance(S, 'gov');
    S.tutOn = true;
    render();
  } else {
    showPrologue(0);
  }
})();
