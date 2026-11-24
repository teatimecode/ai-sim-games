/* 五度环 — 判定引擎 + 世界层
   规则与固定旋律出自 Open Music Theory (CC BY-SA 4.0)
   引擎部分为纯函数，不接触 DOM / 音频，可独立复算。 */

/* ================= 1. 音高工具 ================= */

var LETTERS = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
var NAT = [0, 2, 4, 5, 7, 9, 11];
var LETTER_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

var SPELL_C_MAJOR = { 0: ['C', 0], 2: ['D', 0], 4: ['E', 0], 5: ['F', 0], 7: ['G', 0], 9: ['A', 0], 11: ['B', 0] };
var SPELL_D_MINOR = { 2: ['D', 0], 4: ['E', 0], 5: ['F', 0], 7: ['G', 0], 9: ['A', 0], 10: ['B', -1], 0: ['C', 0], 1: ['C', 1] };
var SPELL_F_MAJOR = { 5: ['F', 0], 7: ['G', 0], 9: ['A', 0], 10: ['B', -1], 0: ['C', 0], 2: ['D', 0], 4: ['E', 0] };

var CHROMATIC_SPELL = {
  0: ['C', 0], 1: ['C', 1], 2: ['D', 0], 3: ['E', -1], 4: ['E', 0], 5: ['F', 0],
  6: ['F', 1], 7: ['G', 0], 8: ['A', -1], 9: ['A', 0], 10: ['B', -1], 11: ['B', 0]
};

function spellOf(midi, table) {
  var pc = ((midi % 12) + 12) % 12;
  var hit = table && table[pc];
  if (hit) return hit;
  /* 拼写表未覆盖时退回等音拼写，宁可显示升降号也不能把音高显示成 C */
  return CHROMATIC_SPELL[pc] || ['C', 0];
}

function spellingInfo(midi, table) {
  var s = spellOf(midi, table);
  var letter = s[0], alter = s[1];
  var octave = (midi - NAT[LETTERS[letter]] - alter) / 12 - 1;
  return {
    letter: letter,
    alter: alter,
    octave: octave,
    diatonic: octave * 7 + LETTERS[letter],
    label: letter + (alter > 0 ? '\u266F' : alter < 0 ? '\u266D' : '') + octave
  };
}

/* 音程：返回半音数、简化音级、是否复合 */
function ivl(a, b) {
  var d = Math.abs(b - a);
  return { d: d, cls: d % 12 };
}

var CONSONANT = { 0: 1, 3: 1, 4: 1, 7: 1, 8: 1, 9: 1 }; // 纯四度(5)在此语境按不协和处理

function isPerfect(cls) { return cls === 0 || cls === 7; }
function isImperfect(cls) { return cls === 3 || cls === 4 || cls === 8 || cls === 9; }

var IVL_NAMES = { 0: 'P1', 1: 'm2', 2: 'M2', 3: 'm3', 4: 'M3', 5: 'P4', 6: 'TT', 7: 'P5', 8: 'm6', 9: 'M6', 10: 'm7', 11: 'M7' };

function intervalName(a, b) {
  var i = ivl(a, b);
  if (i.d === 19) return 'P12';
  if (i.d === 0) return 'P1';
  if (i.cls === 0) return 'P8';
  return IVL_NAMES[i.cls];
}

/* ================= 2. 关卡数据 ================= */

var LEVELS = [
  {
    id: 'c-major-salzer',
    title: '第一页 · C 大调',
    keyLabel: 'C 大调',
    cpSide: 'above',
    species: 1,
    cantus: [60, 62, 64, 65, 67, 62, 65, 64, 62, 60],
    palette: [60, 62, 64, 65, 67, 69, 71, 72],
    spell: SPELL_C_MAJOR,
    attribution: 'Salzer & Schachter，C 大调固定旋律',
    source: 'cantusFirmi.ly:81-82',
    brief: '固定旋律在 do 上起，也在 do 上收。你在它上方补一条一对一的第二声部。',
    reference: [67, 65, 67, 69, 71, 71, 69, 67, 71, 72]
  },
  {
    id: 'd-minor-fux',
    title: '第二页 · d 小调',
    keyLabel: 'd 小调',
    cpSide: 'above',
    species: 1,
    cantus: [62, 65, 64, 62, 67, 65, 69, 67, 65, 64, 62],
    palette: [62, 64, 65, 67, 69, 70, 72, 73, 74],
    spell: SPELL_D_MINOR,
    attribution: 'Fux，d 小调固定旋律',
    source: 'cantusFirmi.ly:100-101',
    brief: '小调。导音只在倒数第二音出现，收束要靠它。',
    reference: [62, 69, 67, 69, 70, 69, 72, 70, 69, 73, 74]
  },
  {
    id: 'f-major-fux',
    title: '第三页 · F 大调',
    keyLabel: 'F 大调',
    cpSide: 'below',
    species: 1,
    cantus: [65, 67, 69, 65, 62, 64, 65, 72, 69, 65, 67, 65],
    palette: [53, 55, 57, 58, 60, 62, 64, 65],
    spell: SPELL_F_MAJOR,
    attribution: 'Fux，F 大调固定旋律',
    source: 'cantusFirmi.ly:87-88',
    brief: '这一页你在下方写。写在下方时，首音只能是 do，别的起法都会把调性听糊。',
    reference: [65, 64, 60, 57, 58, 60, 62, 64, 60, 62, 64, 65]
  },
  {
    id: 'd-minor-jeppesen',
    title: '第四页 · d 小调，二对一',
    keyLabel: 'd 小调',
    cpSide: 'above',
    species: 2,
    cantus: [62, 69, 67, 65, 64, 62, 65, 64, 62],
    palette: [62, 64, 65, 67, 69, 70, 72, 73, 74],
    spell: SPELL_D_MINOR,
    attribution: 'Jeppesen，d 小调固定旋律',
    source: 'cantusFirmi.ly:103-104',
    brief: '第二类：每个固定旋律音对两个音。强拍必须协和；弱拍可以出现不协和，但只能是经过音。',
    reference: [69, 65, 73, 72, 70, 67, 69, 65, 67, 64, 65, 67, 69, 70, 72, 73, 74]
  }
];

/* ================= 3. 判定引擎（纯函数） ================= */

function judge(level, cp) {
  var V = [], A = [];
  var cf = level.cantus;
  var n = cf.length;
  var sp = level.species;
  var total = sp === 1 ? n : 2 * n - 1;
  var pos = function (k) { return sp === 1 ? k : Math.min(2 * k, total - 1); };
  var at = function (k) { return cp[pos(k)]; };
  function push(code, slot, message, citation) {
    V.push({ code: code, slot: slot, message: message, citation: citation });
  }
  function note(code, slot, message) {
    A.push({ code: code, slot: slot, message: message });
  }

  /* --- 起首 --- */
  if (at(0) != null) {
    var i0 = ivl(cf[0], at(0));
    if (level.cpSide === 'above') {
      if (!(i0.d === 0 || i0.cls === 0 || i0.cls === 7))
        push('FS-BEGIN', pos(0), '起首须与固定旋律成纯一度、纯五度或纯八度。', 'firstSpecies.md:18');
    } else {
      if (!(i0.d === 0 || i0.cls === 0))
        push('FS-BEGIN', pos(0), '写在下方时起首只能是 do，即纯一度或纯八度。', 'firstSpecies.md:18');
    }
  }

  /* --- 收束：末槽为整页最后一音 --- */
  if (cp[total - 1] != null) {
    var iEnd = ivl(cf[n - 1], cp[total - 1]);
    if (iEnd.cls !== 0)
      push('FS-END', total - 1, '末音必须是 do，与固定旋律成纯一度或纯八度。', 'firstSpecies.md:24');
  }

  /* --- 终止式接近 --- */
  if (sp === 1) {
    var a1 = at(n - 2), b1 = at(n - 1);
    if (a1 != null && b1 != null) {
      var cfDir = Math.sign(cf[n - 1] - cf[n - 2]);
      var cpDir = Math.sign(b1 - a1);
      if (!(cfDir !== 0 && cpDir !== 0 && cpDir === -cfDir))
        push('FS-CAD', pos(n - 2), '最后两音须与固定旋律反向进行。', 'firstSpecies.md:24');
      if (Math.abs(b1 - a1) > 2)
        push('FS-CAD', pos(n - 2), '最后两音须级进接近终止。', 'firstSpecies.md:24');
      var q1 = ivl(cf[n - 2], a1).cls;
      if (!(q1 === 3 || q1 === 9))
        push('FS-CAD', pos(n - 2), '倒数第二音须与固定旋律成小三度或大六度。', 'firstSpecies.md:24');
    }
  } else {
    var a2 = cp[total - 2], b2 = cp[total - 1];
    if (a2 != null && b2 != null) {
      var cfDir2 = Math.sign(cf[n - 1] - cf[n - 2]);
      var cpDir2 = Math.sign(b2 - a2);
      if (!(cfDir2 !== 0 && cpDir2 !== 0 && cpDir2 === -cfDir2))
        push('FS-CAD', total - 2, '收束两音须与固定旋律反向进行。', 'firstSpecies.md:24');
      if (Math.abs(b2 - a2) > 2)
        push('FS-CAD', total - 2, '收束两音须级进。', 'secondSpecies.md:68');
    }
  }

  /* --- 每个骨架音的纵向关系 --- */
  for (var k = 0; k < n; k++) {
    var note0 = at(k);
    if (note0 == null) continue;
    var ii = ivl(cf[k], note0);

    if (ii.d > 19)
      push('FS-SPACING', pos(k), '两声部相距超过纯十二度。', 'firstSpecies.md:39');

    if (!CONSONANT[ii.cls])
      push('FS-CONSONANCE', pos(k), '纵向音程不协和。', 'firstSpecies.md:41');

    if (ii.d === 0 && !(k === 0 || k === n - 1))
      push('FS-UNISON', pos(k), '同度只允许出现在首尾。', 'firstSpecies.md:41');

    if (level.cpSide === 'above' && note0 < cf[k])
      push('FS-CROSS', pos(k), '对位声部落到固定旋律下方，声部交错。', 'firstSpecies.md:32');
    if (level.cpSide === 'below' && note0 > cf[k])
      push('FS-CROSS', pos(k), '对位声部升到固定旋律上方，声部交错。', 'firstSpecies.md:32');

    if (k > 0 && at(k - 1) != null) {
      if (level.cpSide === 'above' && note0 <= cf[k - 1])
        push('FS-OVERLAP', pos(k), '越过固定旋律的前一个音，声部超越。', 'firstSpecies.md:34');
      if (level.cpSide === 'below' && note0 >= cf[k - 1])
        push('FS-OVERLAP', pos(k), '越过固定旋律的前一个音，声部超越。', 'firstSpecies.md:34');
    }
  }

  /* --- 连续音程：平行、隐伏、同类不完美协和 --- */
  var runClass = -1, runLen = 0;
  for (var m = 0; m < n; m++) {
    var cur = at(m);
    if (cur == null) { runClass = -1; runLen = 0; continue; }
    var curI = ivl(cf[m], cur);

    if (isImperfect(curI.cls)) {
      if (curI.cls === runClass) { runLen++; } else { runClass = curI.cls; runLen = 1; }
      if (runLen >= 4)
        push('FS-THIRDS', pos(m), '同类不完美协和连续超过三个。', 'firstSpecies.md:51');
    } else { runClass = -1; runLen = 0; }

    if (m === 0) continue;
    var prev = at(m - 1);
    if (prev == null) continue;
    var prevI = ivl(cf[m - 1], prev);

    if (isPerfect(prevI.cls) && isPerfect(curI.cls) && prevI.cls === curI.cls) {
      push('FS-PARALLEL', pos(m), curI.cls === 0 ? '平行八度。' : '平行五度。', 'firstSpecies.md:45');
    } else if (isPerfect(curI.cls)) {
      var dc = Math.sign(cur - prev);
      var df = Math.sign(cf[m] - cf[m - 1]);
      if (dc !== 0 && df !== 0 && dc === df)
        push('FS-DIRECT', pos(m), '以同向进行进入纯协和，形成隐伏五八度。', 'firstSpecies.md:52');
    }
  }

  /* --- 对位声部自身旋律 --- */
  var lo = null, hi = null;
  for (var j = 0; j < total; j++) {
    var x = cp[j];
    if (x == null) continue;
    if (lo === null || x < lo.v) lo = { v: x, s: j };
    if (hi === null || x > hi.v) hi = { v: x, s: j };
  }
  if (lo && hi && hi.v - lo.v > 16)
    push('MEL-RANGE', hi.s, '对位声部音域超过十度。', 'cantusFirmus.md:26');

  for (var t = 1; t < total - 1; t++) {
    var p0 = cp[t - 1], p1 = cp[t], p2 = cp[t + 1];
    if (p0 == null || p1 == null || p2 == null) continue;
    var d1 = p1 - p0, d2 = p2 - p1;
    if (Math.abs(d1) >= 5) {
      var okResolve = Math.abs(d2) <= 2 && Math.sign(d2) === -Math.sign(d1);
      if (!okResolve)
        push('MEL-LEAP', t, '四度以上的跳进之后要反向级进。', 'cantusFirmus.md:31');
      if (Math.abs(d2) >= 5 && Math.sign(d1) === Math.sign(d2))
        push('MEL-LEAPS', t, '不得连续同向跳进。', 'cantusFirmus.md:32');
    }
  }

  /* --- 第二类：弱拍 --- */
  if (sp === 2) {
    for (var w = 0; w < n - 1; w++) {
      var jw = 2 * w + 1;
      var nw = cp[jw];
      if (nw == null) continue;
      var iw = ivl(cf[w], nw);
      if (CONSONANT[iw.cls]) continue; // 弱拍协和即可
      var pw = cp[jw - 1], qw = cp[jw + 1];
      if (pw == null) continue;
      var e1 = nw - pw;
      if (Math.abs(e1) > 2) {
        push('SS-WEAK', jw, '弱拍的不协和音必须级进进入。', 'secondSpecies.md:70');
        continue;
      }
      if (qw == null) continue;
      var e2 = qw - nw;
      if (Math.abs(e2) > 2) {
        push('SS-WEAK', jw, '弱拍的不协和音必须级进离开，不能跳走。', 'secondSpecies.md:68');
        continue;
      }
      if (Math.sign(e1) !== Math.sign(e2)) {
        push('SS-WEAK', jw, '弱拍的不协和音上不能改变方向，它是经过音。', 'secondSpecies.md:70');
        continue;
      }
      var span = Math.abs(qw - pw);
      if (!(span === 3 || span === 4))
        push('SS-WEAK', jw, '经过音两侧的强拍之间须是一个三度。', 'secondSpecies.md:68');
    }
    for (var w2 = 0; w2 < n - 1; w2++) {
      var jw2 = 2 * w2 + 1, nw2 = cp[jw2];
      if (nw2 == null) continue;
      if (ivl(cf[w2], nw2).d === 0 && !(w2 === 0 || w2 === n - 1))
        note('SS-UNISON', jw2, '弱拍同度可以，但尽量少用。');
    }
  }

  /* --- 软提醒 --- */
  var cpPeak = null, cfPeak = null;
  for (var pk = 0; pk < n; pk++) {
    if (at(pk) == null) continue;
    if (cpPeak === null || at(pk) > at(cpPeak)) cpPeak = pk;
    if (cfPeak === null || cf[pk] > cf[cfPeak]) cfPeak = pk;
  }
  if (cpPeak !== null && cfPeak !== null && cpPeak === cfPeak)
    note('ADV-PEAK', pos(cpPeak), '两声部的顶点撞在同一处，独立感会被削弱。');
  if (lo && hi && hi.v - lo.v > 12)
    note('ADV-RANGE', hi.s, '音域超过了八度，能收在一个八度内更清楚。');

  return { violations: V, advisories: A };
}

function emptySlotsOf(level, slots) {
  var out = [];
  var total = totalSlots(level);
  for (var i = 0; i < total; i++) if (slots[i] == null) out.push(i);
  return out;
}

/* 候选音是否会在这个谱位上立刻制造违例 */
function slotIsClean(level, slots, slot, pitch) {
  var probe = slots.slice();
  probe[slot] = pitch;
  var r = judge(level, probe);
  for (var i = 0; i < r.violations.length; i++) {
    if (r.violations[i].slot === slot) return false;
  }
  return true;
}

/* ================= 4. 音频 ================= */

/* ================= 4a. 音频状态机 ================= */

/* 只记录确实能检测到的事实，不推断设备静音、音量或输出路由。
   状态：undetected | needs-gesture | starting | ready | suspended | unsupported | failed */
function safeAudioError(e) {
  var m = (e && (e.name || e.message)) || 'unknown';
  return String(m).slice(0, 80);
}

function createAudioController(opts) {
  opts = opts || {};
  var Ctor = opts.Ctor;
  var now = opts.now || function () { return Date.now(); };
  var onState = opts.onState || function () {};
  var c = {
    ctx: null, state: 'undetected', created: 0,
    lastEnabledAt: null, lastTestAt: null, heard: null,
    lastError: null, gesture: false
  };

  function emit() { try { onState(c); } catch (e) { /* 渲染失败不影响音频 */ } }
  function set(s, err) { c.state = s; if (err !== undefined) c.lastError = err; emit(); }

  function init() {
    if (!Ctor) { set('unsupported'); return c; }
    if (c.state === 'undetected') set('needs-gesture');
    return c;
  }

  function listen() {
    if (!c.ctx || !c.ctx.addEventListener) return;
    c.ctx.addEventListener('statechange', function () {
      if (!c.ctx) return;
      var s = c.ctx.state;
      if (s === 'running') {
        if (c.state !== 'ready') { c.lastEnabledAt = c.lastEnabledAt || now(); set('ready'); }
      } else if (s === 'suspended' || s === 'interrupted') {
        set('suspended');
      } else if (s === 'closed') {
        set('failed', 'closed');
      }
    });
  }

  /* 必须在真实用户手势里调用；创建一次，之后只做 resume */
  function unlock() {
    c.gesture = true;
    if (!Ctor) { set('unsupported'); return null; }
    if (!c.ctx) {
      set('starting');
      try {
        c.ctx = new Ctor();
        c.created++;
        listen();
      } catch (e) {
        set('failed', 'create:' + safeAudioError(e));
        return null;
      }
    }
    if (c.ctx.state === 'running') {
      c.lastEnabledAt = c.lastEnabledAt || now();
      set('ready');
      return c.ctx;
    }
    try {
      var p = c.ctx.resume();
      if (p && typeof p.then === 'function') {
        p.then(function () {
          if (c.ctx && c.ctx.state === 'running') { c.lastEnabledAt = now(); set('ready'); }
          else set('suspended');
        }, function (e) {
          set('failed', 'resume:' + safeAudioError(e));
        });
      } else if (c.state === 'starting') {
        set('suspended');
      }
    } catch (e) {
      set('failed', 'resume:' + safeAudioError(e));
    }
    return c.ctx;
  }

  /* 从后台回来时重读状态，不主动播放 */
  function refresh() {
    if (!c.ctx) {
      if (Ctor && c.state === 'undetected') set('needs-gesture');
      return c;
    }
    var s = c.ctx.state;
    if (s === 'running') {
      if (c.state !== 'ready') { c.lastEnabledAt = c.lastEnabledAt || now(); set('ready'); }
    } else if (s === 'suspended' || s === 'interrupted') {
      if (c.state !== 'suspended') set('suspended');
    } else if (s === 'closed') {
      if (c.state !== 'failed') set('failed', 'closed');
    }
    return c;
  }

  function markTested() { c.lastTestAt = now(); c.heard = null; emit(); }
  function markHeard(v) { c.heard = v; emit(); }

  return { state: c, init: init, unlock: unlock, refresh: refresh, markTested: markTested, markHeard: markHeard };
}

var actx = null, masterGain = null, wetGain = null, reverb = null;

var audioCtl = createAudioController({
  Ctor: (typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : undefined),
  onState: function () {
    if (typeof renderAudioChip === 'function' && typeof document !== 'undefined' && document.getElementById && document.getElementById('audioChip')) renderAudioChip();
  }
});

/* 所有发声入口的唯一门：创建或恢复上下文，失败时返回 null 并留下状态 */
function ensureAudio() {
  var c = audioCtl.unlock();
  if (!c) return null;
  actx = c;
  if (masterGain) return actx;
  masterGain = actx.createGain();
  masterGain.gain.value = 0.85;
  var lp = actx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 4200;
  masterGain.connect(lp);
  lp.connect(actx.destination);

  reverb = actx.createConvolver();
  var rate = actx.sampleRate, len = Math.floor(rate * 1.7);
  var buf = actx.createBuffer(2, len, rate);
  for (var ch = 0; ch < 2; ch++) {
    var dat = buf.getChannelData(ch);
    for (var i = 0; i < len; i++) dat[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  reverb.buffer = buf;
  wetGain = actx.createGain();
  wetGain.gain.value = 0.22;
  reverb.connect(wetGain);
  wetGain.connect(lp);
  return actx;
}


/* ================= 4c. 音频状态与诊断 UI ================= */

var AUDIO_TEXT = {
  'undetected': '待检测',
  'needs-gesture': '待启用',
  'starting': '启用中',
  'ready': '可用',
  'suspended': '已暂停',
  'unsupported': '不支持',
  'failed': '异常'
};

function audioShort(st) { return AUDIO_TEXT[st] || '未知'; }
function audioLabel(st) { return '声音·' + audioShort(st); }

function renderAudioChip() {
  if (typeof document === 'undefined' || !document.getElementById) return;
  var chip = document.getElementById('audioChip');
  if (!chip) return;
  var st = audioCtl.state.state;
  var txt = document.getElementById('audioChipText');
  if (txt) txt.textContent = audioLabel(st);
  chip.setAttribute('data-audio-state', st);
  chip.setAttribute('aria-label', audioLabel(st) + '，点击查看声音诊断');
  var live = document.getElementById('audioLive');
  if (live) live.textContent = '声音状态：' + audioShort(st);
}

function fmtClock(ts) {
  if (!ts) return '未记录';
  var d = new Date(ts);
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
}

function audioSupported() {
  return !!(typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext));
}

function audioDiagText() {
  var c = audioCtl.state;
  return [
    '五度环 · 声音诊断',
    'Web Audio 支持：' + (audioSupported() ? '是' : '否'),
    '状态：' + audioLabel(c.state),
    '音频上下文：' + (c.ctx ? c.ctx.state : '未创建'),
    '最近启用：' + fmtClock(c.lastEnabledAt),
    '最近测试：' + fmtClock(c.lastTestAt),
    '人耳确认：' + (c.heard === 'yes' ? '已听到' : c.heard === 'no' ? '未听到' : '未确认'),
    '页面可见性：' + (typeof document !== 'undefined' ? document.visibilityState : '未知'),
    '用户手势触发：' + (c.gesture ? '是' : '否'),
    '创建上下文次数：' + c.created,
    '最近错误：' + (c.lastError || '无'),
    '说明：声音由浏览器 Web Audio 实时合成，无需下载音频文件。'
  ].join('\n');
}

function playTestTone() {
  var c = ensureAudio();
  if (!c) return false;
  var t0 = c.currentTime + 0.05;
  tone(84, t0, 0.16, 0.09);
  tone(91, t0 + 0.22, 0.24, 0.09);
  audioCtl.markTested();
  return true;
}

function renderAudioPanel() {
  var body = document.getElementById('audioBody');
  if (!body) return;
  var c = audioCtl.state;
  body.innerHTML = '';

  var line = document.createElement('p');
  line.className = 'audio-state-line';
  line.textContent = '当前状态：' + audioLabel(c.state);
  body.appendChild(line);

  var note = document.createElement('p');
  note.className = 'audio-note';
  note.textContent = '声音由浏览器 Web Audio 实时合成，无需下载音频文件。页面不会自动发声，必须由你点一下才能启用。';
  body.appendChild(note);

  var facts = document.createElement('dl');
  facts.className = 'audio-facts';
  var rows = [
    ['Web Audio 支持', audioSupported() ? '是' : '否'],
    ['音频上下文', c.ctx ? c.ctx.state : '未创建'],
    ['最近启用', fmtClock(c.lastEnabledAt)],
    ['最近测试', fmtClock(c.lastTestAt)],
    ['人耳确认', c.heard === 'yes' ? '已听到' : c.heard === 'no' ? '未听到' : '未确认'],
    ['页面可见性', (typeof document !== 'undefined' ? document.visibilityState : '未知')],
    ['手势触发', c.gesture ? '是' : '否'],
    ['创建次数', String(c.created)],
    ['最近错误', c.lastError || '无']
  ];
  rows.forEach(function (r) {
    var dt = document.createElement('dt');
    dt.textContent = r[0];
    var dd = document.createElement('dd');
    dd.textContent = r[1];
    facts.appendChild(dt);
    facts.appendChild(dd);
  });
  body.appendChild(facts);

  if (c.lastTestAt) {
    var ask = document.createElement('p');
    ask.className = 'audio-ask';
    ask.textContent = '刚才那两声测试音，你听到了吗？';
    body.appendChild(ask);
    var hb = document.createElement('div');
    hb.className = 'audio-heard';
    hb.appendChild(mkBtn('我听到了', 'btn' + (c.heard === 'yes' ? ' btn-ink' : ''), function () {
      audioCtl.markHeard('yes');
      renderAudioPanel();
    }));
    hb.appendChild(mkBtn('没听到', 'btn' + (c.heard === 'no' ? ' btn-ink' : ''), function () {
      audioCtl.markHeard('no');
      renderAudioPanel();
    }));
    body.appendChild(hb);
  }

  if (c.heard === 'no') {
    var tips = document.createElement('ul');
    tips.className = 'audio-tips';
    [
      '先确认手机媒体音量不是 0，也没有开静音或勿扰模式。',
      '如果连着蓝牙耳机或外放音箱，看看声音是不是被路由到了别的设备。',
      '确认这个页面在前台；从后台切回来的应用可能被系统暂停声音。',
      '回到这里再点一次「启用声音」。',
      '仍然没声，可以换一个浏览器再试，并把这个面板的诊断摘要一起反馈。'
    ].forEach(function (t) {
      var li = document.createElement('li');
      li.textContent = t;
      tips.appendChild(li);
    });
    body.appendChild(tips);
  }

  if (c.state === 'unsupported') {
    var un = document.createElement('p');
    un.className = 'audio-note';
    un.textContent = '这个浏览器没有可用的 Web Audio 接口。游戏的进度、判定和文字反馈都不依赖声音，可以继续玩。';
    body.appendChild(un);
  }

  var actions = document.getElementById('audioActions');
  actions.innerHTML = '';
  actions.appendChild(mkBtn('启用声音', 'btn btn-ink', function () {
    ensureAudio();
    renderAudioPanel();
  }));
  actions.appendChild(mkBtn('测试声音', 'btn', function () {
    playTestTone();
    renderAudioPanel();
  }));
  actions.appendChild(mkBtn('复制诊断', 'btn btn-quiet', function () {
    var text = audioDiagText();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { flashChar('诊断摘要已复制。'); }, function () { showDiagFallback(text); });
      } else {
        showDiagFallback(text);
      }
    } catch (e) {
      showDiagFallback(text);
    }
  }));
}

function showDiagFallback(text) {
  var body = document.getElementById('audioBody');
  if (!body) return;
  var box = document.getElementById('audioDiagBox');
  if (!box) {
    box = document.createElement('textarea');
    box.id = 'audioDiagBox';
    box.className = 'audio-diag-box';
    box.readOnly = true;
    body.appendChild(box);
  }
  box.value = text;
  box.focus();
  box.select();
}

function openAudioPanel() {
  renderAudioPanel();
  var v = document.getElementById('audioVeil');
  if (v) v.hidden = false;
}


/* ================= 4d. 试音与对照 ================= */

function openWarmup() {
  var host = document.getElementById('warmupRing');
  if (!host) return;
  host.innerHTML = '';
  var names = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  var played = 0;
  host.appendChild(buildRing({
    order: 'fifths',
    selected: [],
    onNode: function (pc) {
      ensureAudio();
      var c = ensureAudio();
      if (c) { tone(60 + pc, c.currentTime + 0.02, 1.1, 0.12); tone(48 + pc, c.currentTime + 0.02, 1.1, 0.07); }
      played++;
      var hint = document.getElementById('warmupHint');
      if (hint) hint.textContent = played < 3 ? '再点几块，听听它们合不合。' : '这就是常音。城里的一切都搭在它上面。';
    }
  }));
  var hint = document.getElementById('warmupHint');
  if (hint) hint.textContent = '点一块石头，听听它。';
  document.getElementById('warmupVeil').hidden = false;
}

function closeWarmup() {
  document.getElementById('warmupVeil').hidden = true;
  state.warmupDone = true;
  saveState();
}

/* 每类房间的标准答案，用于失败后的对照试听 */
function referencePlan(room) {
  if (room.kind === 'counterpoint') {
    var lv = LEVELS[room.cp];
    return lv && lv.reference ? { type: 'exercise', level: lv, slots: lv.reference } : null;
  }
  if (room.kind === 'scale') return { type: 'scale', pcs: room.target.pcs, tonic: room.target.tonic };
  if (room.kind === 'harmony') {
    var chords = room.situations.map(function (s) {
      return s.options.filter(function (o) { return harmonyIssues(s.prev, o, room.tonic).length === 0; })[0];
    }).filter(Boolean);
    return chords.length ? { type: 'chords', chords: chords } : null;
  }
  if (room.kind === 'set') {
    if (room.mode === 'normal') {
      var best = minSpanOf(room.members);
      return { type: 'order', pcs: room.members, order: orderFrom(room.members, best.starts[0]).ordered };
    }
    var ghost = room.members.map(function (p) { return (p + room.transpose) % 12; });
    return { type: 'set', pcs: commonTonesOf(room.members, ghost) };
  }
  if (room.kind === 'pop') return { type: 'chords', chords: room.chords.slice() };
  if (room.kind === 'rhythm') return room.rhythm.answer ? { type: 'rhythm', room: room, bars: room.rhythm.answer } : null;
  if (room.kind === 'compass') return { type: 'triad', pc: room.compass.to.pc, mode: room.compass.to.mode };
  if (room.kind === 'form') return { type: 'piece', room: room };
  return null;
}

function playReference(plan) {
  if (!plan) return;
  var c = ensureAudio();
  if (!c) return;
  var t0 = c.currentTime + 0.06;

  if (plan.type === 'exercise') {
    playExercise(plan.level, plan.slots);
  } else if (plan.type === 'scale') {
    var order = orderFrom(plan.pcs, plan.tonic).ordered;
    order.forEach(function (pc, i) { tone(60 + pc, t0 + i * 0.34, 0.34, 0.15); });
  } else if (plan.type === 'chords') {
    plan.chords.forEach(function (ch, i) { playChord(ch.pcs, t0 + i * 0.9, 0.8, 0.09); });
  } else if (plan.type === 'set') {
    playChord(plan.pcs, t0, 1.2, 0.1);
  } else if (plan.type === 'order') {
    plan.order.forEach(function (pc, i) { tone(60 + pc, t0 + i * 0.3, 0.3, 0.14); });
  } else if (plan.type === 'rhythm') {
    playRhythm(plan.room, { bars: plan.bars });
  } else if (plan.type === 'triad') {
    playChord(tonicTriad({ pc: plan.pc, mode: plan.mode }), t0, 1.1, 0.1);
  } else if (plan.type === 'piece') {
    playForm(plan.room, 0, plan.room.form.bars.length);
  }
}


/* ================= 4e. 对照：先放你写的，再放修好的 ================= */

function playCpOnce(level, slots) {
  var c = ensureAudio();
  if (!c) return 0;
  var sp = level.species;
  var unit = sp === 1 ? 0.6 : 0.32;
  var total = sp === 1 ? level.cantus.length : level.cantus.length * 2 - 1;
  var t0 = c.currentTime + 0.05;
  for (var j = 0; j < total; j++) {
    var cf = level.cantus[sp === 1 ? j : Math.floor(j / 2)];
    if (slots[j] != null) playDyad(cf, slots[j], t0 + j * unit, unit * 0.95);
    else tone(cf, t0 + j * unit, unit * 0.9, 0.13);
  }
  return total * unit * 1000;
}

/* 播放玩家自己的版本；返回时长毫秒，没东西可放时返回 0 */
function playOwn(room) {
  var c = ensureAudio();
  if (!c) return 0;
  if (room.kind === 'counterpoint') {
    var lv = LEVELS[room.cp], cp = cpState(room);
    return playCpOnce(lv, cp.slots);
  }
  if (room.kind === 'rhythm') {
    var rs = rhythmState(room);
    var dur = playRhythm(room, rs);
    return dur * 1000;
  }
  if (room.kind === 'harmony') {
    var h = harmonyState(room);
    if (!h.chosen || !h.chosen.length) return 0;
    var t0 = c.currentTime + 0.05, i = 0;
    for (; i < h.chosen.length; i++) playChord(h.chosen[i].pcs, t0 + i * 0.9, 0.8, 0.09);
    return i * 900;
  }
  return 0;
}

function firstDiffOf(room) {
  if (room.kind === 'counterpoint') {
    var r = judge(LEVELS[room.cp], cpState(room).slots);
    return r.violations.length ? { slot: r.violations[0].slot, label: '第 ' + (r.violations[0].slot + 1) + ' 音 · ' + r.violations[0].code } : null;
  }
  if (room.kind === 'rhythm') {
    var j = judgeRhythm(room, rhythmState(room).bars);
    return j.first ? { bar: j.first.bar, label: '第 ' + (j.first.bar + 1) + ' 小节 · ' + j.first.code } : null;
  }
  if (room.kind === 'harmony') {
    var h = harmonyState(room);
    return h.bad ? { rn: h.bad, label: '和弦 ' + h.bad } : null;
  }
  return null;
}

var FAULT_WHAT = {
  counterpoint: '你刚把这一列的对位音逐格填满了',
  rhythm: '你刚把这一行的时值块铺满了',
  harmony: '你刚把这一串和弦选完了',
  scale: '你刚选好了一组石头、指定了主音',
  set: '你刚把这组音排了序',
  pop: '你刚接完这一圈的进行',
  compass: '你刚走到目标调',
  form: '你刚把曲式标记排完'
};

// 先说“你做了什么 / 哪里断了”，再让下面的批注给规则出处
function faultNarrative(room, diff) {
  if (!room || !diff) return null;
  var what = FAULT_WHAT[room.kind] || '你刚提交了这一步';
  var where = diff.label || '';
  if (room.kind === 'counterpoint' && Number.isInteger(diff.slot)) {
    var prev = diff.slot > 0 ? '上一个音和它之间' : '起手这个音';
    return what + '，断在' + prev + '：' + where.replace(/^第 \d+ 音 · /, '') + '。规则的出处写在下面的批注里。';
  }
  if (room.kind === 'rhythm' && Number.isInteger(diff.bar)) {
    return what + '，断在第 ' + (diff.bar + 1) + ' 小节的时值总和：' + where.replace(/^第 \d+ 小节 · /, '') + '。规则出处见批注。';
  }
  return what + '，断在' + where + '。规则出处见下面的批注。';
}

function playCompare(room) {
  var plan = referencePlan(room);
  if (!plan) return;
  var ms = playOwn(room) || 0;
  var delay = ms + 480;
  window.setTimeout(function () { playReference(plan); }, delay);
}


/* ================= 4f. 地图常音 ================= */

var drone = { nodes: null, on: false };

function pendingDistricts(s) {
  s = s || state;
  return DISTRICTS.filter(function (d) {
    return playableRoomsOfDistrict(d.id).length > 0 && !(s.seals && s.seals[d.id]);
  }).length;
}

/* 未校完的城区越多，两条同频振荡器的差越大，听起来越"脏" */
function droneDetuneCents(pending) {
  return Math.min(16, pending * 2 + 2);
}

function startDrone() {
  var c = ensureAudio();
  if (!c) return false;
  stopDrone();
  var pending = pendingDistricts();
  var g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.035, c.currentTime + 0.8);
  var o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = 110;
  var o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = 110;
  o2.detune.value = droneDetuneCents(pending);
  o1.connect(g); o2.connect(g); g.connect(masterGain || c.destination);
  o1.start(); o2.start();
  drone = { nodes: { g: g, o1: o1, o2: o2 }, on: true };
  return true;
}

function stopDrone() {
  if (!drone.nodes) { drone.on = false; return; }
  var c = actx, n = drone.nodes;
  try {
    if (c) {
      n.g.gain.cancelScheduledValues(c.currentTime);
      n.g.gain.setValueAtTime(Math.max(n.g.gain.value, 0.0001), c.currentTime);
      n.g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.25);
      n.o1.stop(c.currentTime + 0.35);
      n.o2.stop(c.currentTime + 0.35);
    }
  } catch (e) { /* 已停止的节点重复 stop 会抛错，忽略 */ }
  drone = { nodes: null, on: false };
}


/* ================= 4g. 我的校记页 ================= */

/* 纯数据，便于测试；渲染层再拼 SVG */
function diplomaFacts(s) {
  s = s || state;
  var marks = DISTRICTS.map(function (d) {
    return { id: d.id, name: DISTRICT_MARK[d.id].name, got: !!(s.seals && s.seals[d.id]) };
  });
  var records = DISTRICTS.map(function (d) {
    var r = s.records && s.records[d.id];
    return { district: d.name, choice: (r && r.choice) ? r.choice : '未记' };
  });
  var total = ROOMS.filter(function (r) { return r.kind !== 'locked'; }).length;
  var mc = { understand: 0, proficient: 0, transfer: 0 };
  var cleared = s.cleared || {};
  ROOMS.forEach(function (r) {
    if (r.kind === 'locked' || !cleared[r.id]) return;
    var m = (s.mastery && s.mastery[r.id]) || null;
    if (m) mc[m]++;
  });
  return {
    name: s.signed || '（留白）',
    done: Object.keys(s.cleared || {}).length,
    total: total,
    mastery: mc,
    marks: marks,
    records: records
  };
}

function diplomaMarkup() {
  var facts = diplomaFacts();
  var av = avatarSVG(avatarOf(), 92).outerHTML;
  var marks = facts.marks.map(function (m) {
    var glyph = m.got ? markSVG(m.id, 16).outerHTML : '';
    return '<span class="d-mark' + (m.got ? ' is-on' : '') + '">' + glyph + '<b>' + m.name + '</b>' + (m.got ? '' : '<i>未获得</i>') + '</span>';
  }).join('');
  var records = facts.records.map(function (r) {
    return '<li>' + r.district + ' · ' + r.choice + '</li>';
  }).join('');
  var done = facts.done;
  var total = facts.total;
  var name = facts.name;
  var today = new Date();
  var date = today.getFullYear() + ' 年 ' + (today.getMonth() + 1) + ' 月 ' + today.getDate() + ' 日';

  return '<div class="diploma-page">' +
    '<h1>五度环</h1>' +
    '<div class="d-sub">校记页 · 环城记谱公会</div>' +
    '<div class="d-head">' + av +
      '<div><div>本册记谱人</div><div class="d-name">' + name + '</div>' +
      '<div class="d-sub" style="margin-top:10px">已完成 ' + done + ' / ' + total + ' 页 · ' + date + '</div></div>' +
    '</div>' +
    '<div class="d-marks">' + marks + '</div>' +
    '<div class="d-mastery">掌握 · 理解 ' + facts.mastery.understand + ' · 熟练 ' + facts.mastery.proficient + ' · 迁移 ' + facts.mastery.transfer + '</div>' +
    '<div class="d-sub">六区校记</div>' +
    '<ul>' + records + '</ul>' +
    '<div class="d-foot">规则与固定旋律取自 Open Music Theory（CC BY-SA 4.0），谱面与环城为原创。<br>声音由浏览器 Web Audio 实时合成，本页不含任何音频文件。</div>' +
  '</div>';
}

function roomCardFacts(s, id) {
  s = s || state;
  var room = ROOM_INDEX[id];
  if (!room) return null;
  var rec = s.records && s.records[room.district];
  return {
    room: room.title,
    district: (districtById(room.district) || {}).name || '',
    mastered: (s.mastery && s.mastery[id]) || null,
    level: MASTERY_LABEL[(s.mastery && s.mastery[id]) || ''] || '已校',
    record: (rec && rec.choice) ? rec.choice : '未记',
    name: s.signed || '（留白）'
  };
}

function roomCardMarkup(id) {
  var f = roomCardFacts(state, id);
  if (!f) return '';
  var av = avatarSVG(avatarOf(), 68).outerHTML;
  return '<div class="diploma-page room-card">' +
    '<h1>' + f.room + '</h1>' +
    '<div class="d-sub">' + f.district + ' · 环城记谱公会</div>' +
    '<div class="d-head">' + av + '<div><div>这一页由</div><div class="d-name">' + f.name + '</div>' +
    '<div class="d-sub" style="margin-top:8px">掌握 · ' + f.level + '</div></div></div>' +
    '<div class="d-sub">这一页的校记</div><ul><li>' + f.record + '</li></ul>' +
    '<div class="d-foot">声音由浏览器实时合成，本页不含音频文件。</div>' +
  '</div>';
}

function downloadRoomCard(id) {
  var html = '<!DOCTYPE html><html lang="zh-Hans"><head><meta charset="utf-8">' +
    '<title>五度环 · ' + (ROOM_INDEX[id] ? ROOM_INDEX[id].title : '校记卡') + '</title><style>' +
    'body{margin:0;background:#fff;color:#211c18;font-family:"Songti SC","Iowan Old Style",Georgia,serif}' +
    '.diploma-page{max-width:180mm;margin:14mm auto;padding:10mm;border:1px solid #c9b9a4}' +
    'h1{font-size:20px;margin:0 0 4px}.d-sub{font-size:11px;color:#7a6c5c;letter-spacing:.04em}' +
    '.d-head{display:flex;gap:12px;align-items:center;margin:12px 0}.d-name{font-size:17px}' +
    'ul{list-style:none;padding:0;margin:6px 0 0;font-size:12px;line-height:1.9}' +
    '.d-foot{margin-top:16px;padding-top:8px;border-top:1px solid #c9b9a4;font-size:10px;color:#7a6c5c}' +
    '</style></head><body>' + roomCardMarkup(id) + '</body></html>';
  var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = '五度环-校记卡-' + (ROOM_INDEX[id] ? ROOM_INDEX[id].title : 'room') + '.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
}

function renderDiploma() {
  var host = document.getElementById('diplomaHost');
  if (host) host.innerHTML = diplomaMarkup();
}

function printDiploma() {
  renderDiploma();
  window.print();
}

function downloadDiploma() {
  var html = '<!DOCTYPE html><html lang="zh-Hans"><head><meta charset="utf-8">' +
    '<title>五度环 · 我的校记页</title><style>' +
    'body{margin:0;background:#fff;color:#211c18;font-family:"Songti SC","Iowan Old Style",Georgia,serif}' +
    '.diploma-page{width:180mm;min-height:250mm;margin:0 auto;padding:18mm 16mm}' +
    '.diploma-page h1{font-size:24px;letter-spacing:.2em;margin:0 0 4px;font-weight:600}' +
    '.d-sub{font-family:ui-monospace,monospace;font-size:10px;letter-spacing:.2em;color:#6f6455;margin-bottom:14px}' +
    '.d-head{display:flex;gap:16px;align-items:flex-start;border-bottom:1px solid #c9b9a4;padding-bottom:12px;margin-bottom:12px}' +
    '.d-name{font-size:20px;letter-spacing:.2em;border-bottom:1px solid #a3392a;padding-bottom:3px;display:inline-block;margin-top:6px}' +
    '.d-marks{display:flex;flex-wrap:wrap;gap:10px 18px;margin:12px 0}' +
    '.d-mark{display:flex;align-items:center;gap:6px;font-size:12px;color:#9a8b78}' +
    '.d-mark.is-on{color:#a3392a}.d-mark i{font-style:normal;font-size:10px}' +
    'ul{list-style:none;padding:0;margin:6px 0 0;font-size:12px;line-height:1.9;color:#3b342c}' +
    '.d-foot{margin-top:18px;padding-top:8px;border-top:1px solid #c9b9a4;font-size:10px;color:#7a6c5c;line-height:1.7}' +
    '@page{size:A4;margin:0}' +
    '</style></head><body>' + diplomaMarkup() + '</body></html>';
  var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = '五度环-校记页.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
}

function roomHasFailure(room) {
  if (room.kind === 'counterpoint') {
    var c = cpState(room);
    return c.attempts > 0 && judge(LEVELS[room.cp], c.slots).violations.length > 0;
  }
  if (room.kind === 'scale') { var s = scaleState(room); return !!(s.checked && s.error); }
  if (room.kind === 'harmony') { var h = harmonyState(room); return !!h.bad; }
  if (room.kind === 'set') { var t = setState(room); return !!(t.checked && t.error); }
  if (room.kind === 'pop') { var p = popState(room); return !!p.bad; }
  if (room.kind === 'rhythm') { var r = rhythmState(room); return !!(r.checked && r.lastError); }
  if (room.kind === 'form') { var f = formState(room); return !!(f.checked && f.error); }
  if (room.kind === 'compass') { var cs = compassState(room); return !!(cs.checked && cs.error); }
  return false;
}

function tone(midi, when, dur, gain) {
  var c = ensureAudio();
  if (!c) return;
  if (!isFinite(midi)) return;   /* 空谱位传进来是 null，不能造出 NaN 振荡器 */
  gain = gain == null ? 0.14 : gain;
  var f = 440 * Math.pow(2, (midi - 69) / 12);
  var env = c.createGain();
  env.gain.setValueAtTime(0.0001, when);
  env.gain.linearRampToValueAtTime(gain, when + 0.014);
  env.gain.exponentialRampToValueAtTime(Math.max(gain * 0.42, 0.0002), when + dur * 0.62);
  env.gain.exponentialRampToValueAtTime(0.0001, when + dur);

  var partials = [[1, 1], [2, 0.26], [3, 0.09], [4, 0.045]];
  for (var i = 0; i < partials.length; i++) {
    var o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = f * partials[i][0];
    var g = c.createGain();
    g.gain.value = partials[i][1];
    o.connect(g); g.connect(env);
    if (partials[i][0] > 1) g.gain.value = partials[i][1] * 0.9;
    o.start(when);
    o.stop(when + dur + 0.06);
  }
  env.connect(masterGain);
  env.connect(reverb);
}

function playDyad(a, b, when, dur) {
  var c = ensureAudio();
  if (!c) return;
  if (when == null) when = c.currentTime + 0.02;
  if (dur == null) dur = 1.05;
  if (a != null) tone(a, when, dur, 0.13);
  if (b != null) tone(b, when, dur, 0.13);
}

function playCantus(level) {
  var c = ensureAudio();
  if (!c) return;
  var beat = level.species === 1 ? 0.62 : 0.62;
  var t0 = c.currentTime + 0.08;
  for (var i = 0; i < level.cantus.length; i++) {
    tone(level.cantus[i], t0 + i * beat, beat * 0.94, 0.15);
  }
  return level.cantus.length * beat;
}

function playExercise(level, slots) {
  var c = ensureAudio();
  if (!c) return 0;
  var sp = level.species;
  var unit = sp === 1 ? 0.66 : 0.34;
  var total = sp === 1 ? level.cantus.length : level.cantus.length * 2;
  var t0 = c.currentTime + 0.12;

  for (var j = 0; j < total; j++) {
    var cfNote = level.cantus[sp === 1 ? j : Math.floor(j / 2)];
    if (slots[j] != null) {
      playDyad(cfNote, slots[j], t0 + j * unit, unit * 0.96);
    } else {
      tone(cfNote, t0 + j * unit, unit * 0.94, 0.15);
    }
  }
  var second = t0 + total * unit + 0.35;
  for (var m = 0; m < total; m++) {
    if (slots[m] != null) tone(slots[m], second + m * unit, unit * 0.96, 0.16);
  }
  return (total * unit + 0.35) * 2;
}

/* ================= 6. 渲染 ================= */

var GEO = {
  W: 1040,
  padL: 78,
  padR: 46,
  staffATop: 56,
  staffABottom: 104,
  staffBTop: 184,
  staffBBottom: 232,
  space: 12,
  H: 296
};

var BOTTOM_DIATONIC = { treble: 30, alto: 24, bass: 18 };

function staffY(midi, clef, bottomY, table) {
  var info = spellingInfo(midi, table);
  return bottomY - (info.diatonic - BOTTOM_DIATONIC[clef]) * (GEO.space / 2);
}

function svgEl(name, attrs) {
  var el = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (var k in attrs) if (attrs.hasOwnProperty(k)) el.setAttribute(k, attrs[k]);
  return el;
}

function buildScore(level, slots) {
  var W = GEO.W, H = GEO.H;
  var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img' });
  svg.setAttribute('aria-label', level.title + ' 谱面');

  var n = level.cantus.length;
  var sp = level.species;
  var innerW = W - GEO.padL - GEO.padR;
  var s = innerW / n;
  var xk = function (k) { return GEO.padL + s * (k + 0.5); };
  var mk = function (k) { return GEO.padL + s * k; };

  var cpClef = level.cpSide === 'above' ? 'treble' : 'alto';
  var cfClef = level.cpSide === 'above' ? 'alto' : 'treble';
  var cpBottom = level.cpSide === 'above' ? GEO.staffABottom : GEO.staffBBottom;
  var cfBottom = level.cpSide === 'above' ? GEO.staffBBottom : GEO.staffABottom;

  /* 谱线 */
  [[GEO.staffABottom], [GEO.staffBBottom]].forEach(function (pair) {
    var bottom = pair[0];
    for (var i = 0; i < 5; i++) {
      var y = bottom - i * GEO.space;
      svg.appendChild(svgEl('line', {
        x1: GEO.padL - 14, y1: y, x2: W - GEO.padR + 8, y2: y, class: 'staff-line'
      }));
    }
  });

  /* 谱号：G 谱号记在 G 线，F 谱号记在 F 线 */
  function drawClef(clef, bottom) {
    var refMidi = clef === 'treble' ? 67 : 60; // G4 / C4
    var y = staffY(refMidi, clef, bottom, level.spell);
    var t = svgEl('text', {
      x: GEO.padL - 44, y: y + 11, class: 'clef-letter', 'font-size': 34
    });
    t.textContent = clef === 'treble' ? 'G' : 'C';
    svg.appendChild(t);
  }
  drawClef('treble', GEO.staffABottom);
  drawClef('alto', GEO.staffBBottom);

  /* 声部标签 */
  var tagA = svgEl('text', { x: 6, y: GEO.staffATop - 9, class: 'voice-tag' });
  tagA.textContent = level.cpSide === 'above' ? '对位声部' : '固定旋律';
  svg.appendChild(tagA);
  var tagB = svgEl('text', { x: 6, y: GEO.staffBTop - 9, class: 'voice-tag' });
  tagB.textContent = level.cpSide === 'above' ? '固定旋律' : '对位声部';
  svg.appendChild(tagB);

  /* 小节线 */
  for (var b = 0; b <= n; b++) {
    var bx = mk(b);
    svg.appendChild(svgEl('line', {
      x1: bx, y1: GEO.staffATop - 6, x2: bx, y2: GEO.staffBBottom + 6,
      class: 'bar-line',
      'stroke-width': (b === 0 || b === n) ? 1.6 : 1
    }));
    if (b === n) {
      svg.appendChild(svgEl('line', {
        x1: bx - 4, y1: GEO.staffATop - 6, x2: bx - 4, y2: GEO.staffBBottom + 6,
        class: 'bar-line', 'stroke-width': 1.6
      }));
    }
  }

  /* 小节号 */
  for (var bn = 0; bn < n; bn++) {
    var num = svgEl('text', {
      x: xk(bn), y: GEO.staffBBottom + 20, class: 'bar-num', 'text-anchor': 'middle'
    });
    num.textContent = String(bn + 1);
    svg.appendChild(num);
  }

  function drawNote(x, midi, clef, bottom, opts) {
    opts = opts || {};
    var info = spellingInfo(midi, level.spell);
    var y = staffY(midi, clef, bottom, level.spell);
    var step = info.diatonic - BOTTOM_DIATONIC[clef];

    /* 加线 */
    if (step > 8) {
      for (var u = 10; u <= step; u += 2) {
        svg.appendChild(svgEl('line', {
          x1: x - 12, y1: bottom - u * (GEO.space / 2),
          x2: x + 12, y2: bottom - u * (GEO.space / 2), class: 'ledger'
        }));
      }
    } else if (step < 0) {
      for (var d = -2; d >= step; d -= 2) {
        svg.appendChild(svgEl('line', {
          x1: x - 12, y1: bottom - d * (GEO.space / 2),
          x2: x + 12, y2: bottom - d * (GEO.space / 2), class: 'ledger'
        }));
      }
    }

    if (info.alter !== 0) {
      var acc = svgEl('text', {
        x: x - 17, y: y + 5.5, class: 'accidental', 'text-anchor': 'middle',
        'font-size': 16
      });
      acc.textContent = info.alter > 0 ? '\u266F' : '\u266D';
      svg.appendChild(acc);
    }

    var cls = 'note-head';
    if (opts.empty) cls += ' is-empty';
    if (opts.bad) cls += ' is-bad';
    if (opts.diff) cls += ' is-diff';
    if (opts.active) cls += ' is-active';
    var head = svgEl('ellipse', {
      cx: x, cy: y, rx: 5.8, ry: 4.1, class: cls,
      transform: 'rotate(-20 ' + x + ' ' + y + ')'
    });
    svg.appendChild(head);

    if (opts.active) {
      var ring = svgEl('circle', { cx: x, cy: y, r: 11, class: 'pulse-ring' });
      svg.appendChild(ring);
    }

    if (opts.bad) {
      svg.appendChild(svgEl('path', {
        d: 'M ' + (x - 7) + ' ' + (y - 22) + ' L ' + (x + 7) + ' ' + (y - 22) +
           ' M ' + x + ' ' + (y - 22) + ' L ' + x + ' ' + (y - 15),
        class: 'marks-flag', fill: 'none'
      }));
    }
    return y;
  }

  /* 固定旋律 */
  for (var c = 0; c < n; c++) {
    drawNote(xk(c), level.cantus[c], cfClef, cfBottom, {});
  }

  /* 对位声部 */
  var total = sp === 1 ? n : 2 * n - 1;
  var cpTop = cpBottom - 4 * GEO.space;
  for (var j = 0; j < total; j++) {
    var x, bar = sp === 1 ? j : Math.floor(j / 2);
    if (sp === 1) x = xk(j);
    else {
      x = j % 2 === 0 ? xk(bar) - s * 0.235 : xk(bar) + s * 0.235;
      if (j === total - 1) x = xk(bar);
    }
    var v = slots[j];
    var marked = state.marks[j];

    if (v == null) {
      /* 空谱位：画待填标记，不画符头，避免被误读成某个音高 */
      var boxY = cpBottom - 2 * GEO.space;
      var ghost = svgEl('rect', {
        x: x - 8, y: boxY - 6, width: 16, height: 12, rx: 1.5,
        fill: 'none', stroke: 'rgba(163,57,42,.5)', 'stroke-width': 1,
        'stroke-dasharray': '2.5 2.5'
      });
      svg.appendChild(ghost);
      if (j === state.activeSlot) {
        svg.appendChild(svgEl('circle', { cx: x, cy: boxY, r: 12, class: 'pulse-ring' }));
      }
    } else {
      drawNote(x, v, cpClef, cpBottom, {
        empty: false,
        bad: !!marked,
        diff: !!(state.diff && state.diff.slot === j),
        active: j === state.activeSlot
      });
    }

    var ord = svgEl('text', {
      x: x, y: cpTop - 9, class: 'bar-num', 'text-anchor': 'middle',
      fill: j === state.activeSlot ? 'rgba(163,57,42,.95)' : 'rgba(111,100,85,.5)'
    });
    ord.textContent = String(j + 1);
    svg.appendChild(ord);
  }

  /* 点击热区 */
  for (var h = 0; h < total; h++) {
    var hx, hw;
    if (sp === 1) { hx = xk(h) - s / 2; hw = s; }
    else {
      var hb = Math.floor(h / 2);
      hx = h % 2 === 0 ? xk(hb) - s / 2 : xk(hb);
      hw = s / 2;
    }
    var rect = svgEl('rect', {
      x: hx, y: GEO.staffATop - 34, width: (sp === 2 && h === total - 1) ? s : hw, height: 230, class: 'slot-hit'
    });
    rect.setAttribute('data-slot', String(h));
    svg.appendChild(rect);
  }
  return svg;
}

/* ================= 10. 世界数据 ================= */

var NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

var DISTRICTS = [
  {
    id: 'quarry', name: '采石场', char: '维斯', who: '对位师 · 石作公会',
    desc: '城的十二块石从这里采出。按五度排一圈，相邻两块相差七个半音。学徒的第一站。',
    angle: -90
  },
  {
    id: 'masonry', name: '石作', char: '维斯', who: '对位师 · 石作公会',
    desc: '公会的老作坊。规则不是规矩，是承重：两条线要各自站住，还要合起来站住。',
    angle: -30
  },
  {
    id: 'hall', name: '议事厅', char: '洛特', who: '和声书记 · 议事厅账房',
    desc: '所有不协和都记在这里。书记只关心一件事：这笔账有没有还清。',
    angle: 30
  },
  {
    id: 'works', name: '营造司', char: '伊莲', who: '营造师 · 营造司',
    desc: '画蓝图的地方。单个音对不对不重要，比例对不对才重要。',
    angle: 90
  },
  {
    id: 'frontier', name: '边区', char: '努尔', who: '测音师 · 边区',
    desc: '常音到这里已经很弱。音与音不再互相拉扯，只能靠集合与对称编址。',
    angle: 150
  },
  {
    id: 'market', name: '市集', char: '阿吉', who: '街头乐手 · 市集',
    desc: '公会听不见的地方。循环与切分照样盖房子，而且住得下更多人。',
    angle: 210
  }
];

var ROOMS = [
  /* ---------- 采石场 ---------- */
  {
    id: 'r-c-major', district: 'quarry', kind: 'scale', title: '十二块石头',
    meta: '拼音阶 · C 大调', char: '维斯',
    plain: '石头 = 一个音高。五度环 = 把十二个音按“往上纯五度”的顺序排成一圈，所以环上相邻的两块听起来最贴。这一关不用写谱，只要把七块石头挑出来。',
    line: '先把石头认全。别急着写谱，认不出石头的人写不出站得住的线。',
    teach: {
      title: '七块石头与调号',
      body: [
        '城的骨架是十二块石，按纯五度排成一圈。大调音阶正好是环上连续的七块石头。',
        '从主音往上数，七个台阶是全全半全全全半。调号就是这七块石头里被升或被降的那几块，所以它从来不是随手加的。',
        '认石头的顺序是：先定主音，再按五度往上走七块。'
      ],
      quote: 'A major scale, a sound with which you are undoubtedly familiar, consists of seven whole (W) and half (H) steps in the following succession: W-W-H-W-W-W-H. The first pitch of the scale, called the tonic, is the pitch upon which the rest of the scale is based.',
      cite: 'scales.md:16'
    },
    target: { tonic: 0, pcs: [0, 2, 4, 5, 7, 9, 11], label: 'C 大调', degrees: ['C', 'D', 'E', 'F', 'G', 'A', 'B'] }
  },
  {
    id: 'r-meter', district: 'quarry', kind: 'rhythm',
    plain: '拍 = 心跳的那一下，小节 = 每几下一个循环。这一关只要把一排格子填到每小节的总时值正好对上。', title: '把桥板铺满',
    meta: '节奏 · 4/4 单拍子', char: '维斯',
    line: '拍子归营造司管，可桥得你自己铺。一小节十六个最小单位，一格都不能空。',
    teach: {
      title: '拍号就是分组',
      body: [
        '4/4 的 4 说的是每小节四拍，下面的 4 说的是每一拍是四分音符。把一拍再切成四份，一小节就是十六个最小单位。',
        '单拍子每拍分成两份，复拍子每拍分成三份。分组决定听感上的强弱，和音符长短一样重要。',
        '桥要通，每小节总时值必须正好等于拍号，而且每一拍上都要有落音，否则分组就塌了。'
      ],
      quote: 'Duple, triple, and quadruple classifications result from the relationship between the counting pulse and the pulses that are slower than the counting pulse. In other words, it is a question of grouping: how many beats occur in each bar.',
      cite: 'meter.md:8'
    },
    guide: {
      goal: '给两小节 4/4 的桥铺上音符或休止，让每小节正好十六个最小单位，并且每一拍都有落音。',
      steps: ['先点「试听整段」，听一遍四拍的骨架。', '点一个小节选中它，再从素材板挑时值铺上去；铺满会自动跳到下一小节。', '铺错了用「撤销一块」或「清空这一小节」，两小节都满了再呈交。'],
      done: '两小节各 16 个单位，四个拍点上都有落音。'
    },
    rhythm: {
      meter: '4/4', bars: 2, ticksPerBar: 16, groups: [4, 4, 4, 4],
      requireOnsets: [0, 4, 8, 12], forbidCrossing: false,
      palette: [8, 4, 2, 1], allowRests: true,
      answer: [[{ len: 4 }, { len: 4 }, { len: 4 }, { len: 4 }], [{ len: 4 }, { len: 4 }, { len: 4 }, { len: 4 }]]
    }
  },
  {
    id: 'r-g-major', district: 'quarry', kind: 'scale', title: '升号从哪来',
    meta: '拼音阶 · G 大调', char: '维斯',
    line: '这一组石头里有一块得升。哪一块，为什么是它，你自己在环上看。',
    teach: {
      title: '升号不是装饰',
      body: [
        'G 大调的第七级必须升。不升，第七级到主音只剩一个全音，导音就拉不住主音。',
        '调号里的每一个升号都对应环上多走一步：G 大调比 C 大调多一块石，那块就是 F♯。',
        '记住这条：升号的出现顺序和五度环的顺序完全一致。'
      ],
      quote: 'The chromatic scale consists entirely of half steps, and uses every pitch on the keyboard within a single octave.',
      cite: 'scales.md:10'
    },
    target: { tonic: 7, pcs: [7, 9, 11, 0, 2, 4, 6], label: 'G 大调', degrees: ['G', 'A', 'B', 'C', 'D', 'E', 'F♯'] }
  },
  {
    id: 'r-interval', district: 'quarry', kind: 'locked', title: '音程与三和弦',
    meta: '只读 · 音程', char: '维斯',
    line: '石头认全了再谈音程。不然你量的只是两块石之间的距离，不是承重。',
    teach: {
      title: '承重的等级',
      body: [
        '纯五度与纯八度能承重，结构靠它们立起来。',
        '三度与六度能站人，但会轻微晃动，所以它们适合流动。',
        '二度、七度、增四度不能承重，出现就必须马上走向协和。三和弦就是把三度叠起来的最小承重单元。'
      ],
      quote: 'In general, all harmonic consonances are allowed.',
      cite: 'firstSpecies.md:41'
    }
  },
  {
    id: 'r-meter2', district: 'quarry', kind: 'rhythm', title: '复拍子的桥',
    meta: '节奏 · 6/8 复拍子', char: '维斯',
    line: '这回是 6/8。一小节分两大组，每组三个八分。先听，再铺。',
    teach: {
      title: '复拍子是三分的',
      body: [
        '6/8 一小节有六个八分音符，但它们不是六个平等的拍，而是两大组、每组三个。数的时候是 1-2-3、4-5-6。',
        '所以 6/8 的一拍其实是附点四分音符，占六个最小单位。这一关里，一组就是一块大石头，音符不能横跨两块。',
        '同样十二个单位，写成 3+3+3+3 是 3/4，写成 6+6 才是 6/8。数字一样，分组不一样，听感完全不同。'
      ],
      quote: 'Simple and compound classifications result from the relationship between the counting pulse and the pulses that are faster than the counting pulse. In other words, it is a question of division: does each beat divide into two equal parts, or three equal parts.',
      cite: 'meter.md:10'
    },
    guide: {
      goal: '给两小节 6/8 的桥铺上时值，每小节正好十二个单位，两组各六个单位处都要有落音，而且不能有音符横跨组界。',
      steps: ['先点「试听整段」，注意重音是 1-2-3、4-5-6 而不是匀速六下。', '用附点四分或「四分＋八分」把每组铺满，别让一块横跨两组。', '两组都落音、两小节都满十二格时再呈交。'],
      done: '两小节各 12 个单位，第 1 与第 7 个单位上都有落音，没有音符跨组界。'
    },
    rhythm: {
      meter: '6/8', bars: 2, ticksPerBar: 12, groups: [6, 6],
      requireOnsets: [0, 6], forbidCrossing: true,
      palette: [6, 4, 2, 1], allowRests: true,
      answer: [[{ len: 6 }, { len: 6 }], [{ len: 6 }, { len: 6 }]]
    }
  },
  {
    id: 'r-d-dorian', district: 'quarry', kind: 'scale', title: '同一组石头，两种城',
    meta: '拼音阶 · d 多利亚', char: '维斯',
    line: '七块石可以不变，主音一挪，城就变了。这次不许你多选一块，只许你换主音。',
    teach: {
      title: '主音决定调式',
      body: [
        'C 大调用的是这七块石。把主音挪到 D，还是这七块石，得到的是多利亚：小三级、大六度、小七度。',
        '所以调式不是另一组音，而是同一组音里换一个落脚点。',
        '大调与自然小调的区别也是这件事：小调的七个台阶是半全全半全全全。'
      ],
      quote: 'The natural minor scale consists of seven whole (W) and half (H) steps in the following succession: W-H-W-W-H-W-W.',
      cite: 'scales.md:34'
    },
    target: { tonic: 2, pcs: [0, 2, 4, 5, 7, 9, 11], label: 'd 多利亚', degrees: ['D', 'E', 'F', 'G', 'A', 'B', 'C'] }
  },

  /* ---------- 石作 ---------- */
  {
    id: 'r-cp1', district: 'masonry', kind: 'counterpoint', cp: 0, title: '一对一开始',
    meta: '第一类对位 · 写在上方', char: '维斯',
    line: '第一条线。起手只能落在 do 或 sol，收尾必须回到 do，中间每一音都要和固定旋律合得上。',
    teach: {
      title: '起首与收束',
      body: [
        '第一类对位是一音对一音。写在上方时，首音须与固定旋律成纯一度、纯五度或纯八度；写在下方时只能是 do。',
        '末音必须是 do。最后两音要反向级进，倒数第二音与固定旋律成小三度或大六度。',
        '这两条把整条线的开头和结尾都锁死了，中间才是你的空间。'
      ],
      quote: 'To approach this ending smoothly, with variety, and with strong goal orientation, always approach the final interval by contrary stepwise motion.',
      cite: 'firstSpecies.md:24'
    }
  },
  {
    id: 'r-cp2', district: 'masonry', kind: 'counterpoint', cp: 1, title: '小调与导音',
    meta: '第一类对位 · 写在上方', char: '维斯',
    line: '小调的导音只在收尾前出现。早一步出现，整条线就提前泄了气。',
    teach: {
      title: '小调的导音',
      body: [
        '小调的第七级平时是低的，只有在走向主音之前才升高，形成导音。',
        '太早升高会让听者提前以为要收束。这一关的固定旋律末尾是 re–do，你的收尾要从升七级级进到 do。'
      ],
      quote: 'in minor, the leading tone only appears in the penultimate bar; the raised submediant is only used when progressing to that leading tone',
      cite: 'cantusFirmus.md:34'
    }
  },
  {
    id: 'r-cp3', district: 'masonry', kind: 'counterpoint', cp: 2, title: '写在下方',
    meta: '第一类对位 · 写在下方', char: '维斯',
    line: '这一页你在下面写。下面的位置更难，因为所有音程都得倒过来想。',
    teach: {
      title: '写在下方',
      body: [
        '写在下方的首音只能是 do。写在 sol 会造出不能承重的四度，写在 fa 会造出听起来像另一个调的纯五度。',
        '所有音程都要倒着算：你与固定旋律之间是几度，不取决于你写了什么，而取决于两者之间的距离。'
      ],
      quote: 'When writing a counterpoint below a cantus firmus, the first note of the counterpoint must always be do (P1 or P8 below the cantus).',
      cite: 'firstSpecies.md:18'
    }
  },
  {
    id: 'r-cp4', district: 'masonry', kind: 'counterpoint', cp: 3, title: '二对一',
    meta: '第二类对位 · 二对一', char: '维斯',
    line: '现在一个固定旋律音对两个音。弱拍上可以出现不协和，但只能是经过音。这条最容易被误用。',
    teach: {
      title: '经过音',
      body: [
        '第二类的强拍永远协和。弱拍可以有协和，也可以有不协和。',
        '不协和的弱拍必须是经过音：级进进入、级进离开、方向不变，两侧的强拍都协和，而且两个强拍之间正好是一个三度。',
        '换句话说，弱拍的不协和是走过去的，不是停下的。'
      ],
      quote: 'All dissonant weak beats in second species are dissonant passing tones.',
      cite: 'secondSpecies.md:68'
    }
  },
  {
    id: 'r-species34', district: 'masonry', kind: 'locked', title: '三对一与留音',
    meta: '只读 · 第三、第四类', char: '维斯',
    line: '三对一考的是换音，四对一考的是留音——不协和第一次可以停在拍上，然后解决。',
    teach: {
      title: '留音',
      body: [
        '第四类对位让不协和以留音的形式出现：前一小节的音延续过来，在强拍上变成不协和，随后下行级进解决。',
        '这是严格对位里第一次允许不协和停在强拍上。它必须解决，而且只能向下解决。',
        '第三类对位则在弱拍上引入换音与邻音，节奏更密，规则不变。'
      ],
      quote: 'In third-species counterpoint, the counterpoint line moves in quarter notes against a cantus firmus in whole notes.',
      cite: 'thirdSpecies.md'
    }
  },
  {
    id: 'r-thoroughbass', district: 'masonry', kind: 'locked', title: '数字低音四声部',
    meta: '只读 · 四声部', char: '维斯',
    line: '从两条线到四个声部，规则开始互相打架。这一章我讲不动了，你自己读。',
    teach: {
      title: '数字与倾向音',
      body: [
        '数字低音用数字标出低音上方的音程，演奏者据此补出上三声部。',
        '四声部里最重要的是倾向音：导音向上解决，七音向下解决。这两条决定了大多数和弦接续。',
        '装饰音则是在骨架音之间加进去的，它们不改变骨架，只改变表面。'
      ],
      quote: 'A thoroughbass is a harmonic shorthand of a musical passage or work. It is composed of a bass line, and chord symbols—called figures.',
      cite: 'thoroughbassFigures.md'
    }
  },

  /* ---------- 议事厅 ---------- */
  {
    id: 'r-func', district: 'hall', kind: 'harmony', title: '功能的方向',
    meta: '和声续写 · C 大调', char: '洛特',
    line: '乐句有方向：主功能出发，下属准备，属功能推进，回到主功能收账。往反方向走，就是退账。',
    teach: {
      title: 'T–PD–D–T',
      body: [
        '最常见的乐句是主—下属—属—主。属功能是全场最不稳的地方，它必须走向主功能。',
        '从属功能退回下属，叫 retrogression，乐句会往回倒，听者会觉得这句话说反了。',
        '规范不是不能破，但破之前得知道自己在破哪一条。'
      ],
      quote: 'The simplest phrase that exhibits this complete harmonic cycle is a tonic-dominant-tonic progression: I–V–I.',
      cite: 'harmonicSyntax1.md:23'
    },
    tonic: 0,
    situations: [
      {
        prev: { rn: 'V7', func: 'D', pcs: [7, 11, 2, 5], lt: true, seventh: 5 },
        prompt: '属七和弦悬在这里。账本上有两笔：导音 B 与七音 F。',
        options: [
          { rn: 'I', func: 'T', pcs: [0, 4, 7] },
          { rn: 'IV', func: 'PD', pcs: [5, 9, 0] },
          { rn: 'ii', func: 'PD', pcs: [2, 5, 9] }
        ]
      },
      {
        prev: { rn: 'V', func: 'D', pcs: [7, 11, 2], lt: true },
        prompt: '属三和弦，导音还在。落地还是绕开，各有各的写法。',
        options: [
          { rn: 'I', func: 'T', pcs: [0, 4, 7] },
          { rn: 'vi', func: 'T', pcs: [9, 0, 4] },
          { rn: 'IV', func: 'PD', pcs: [5, 9, 0] }
        ]
      },
      {
        prev: { rn: 'vii°', func: 'D', pcs: [11, 2, 5], lt: true },
        prompt: '导和弦最不稳。它比属和弦更急着走。',
        options: [
          { rn: 'I', func: 'T', pcs: [0, 4, 7] },
          { rn: 'IV', func: 'PD', pcs: [5, 9, 0] },
          { rn: 'ii', func: 'PD', pcs: [2, 5, 9] }
        ]
      }
    ]
  },
  {
    id: 'r-debt', district: 'hall', kind: 'harmony', title: '欠账必还',
    meta: '和声续写 · G 大调', char: '洛特',
    line: '换了个调，账还是那两笔。导音往上还，七音往下还，方向不能错。',
    teach: {
      title: '两笔必须还的账',
      body: [
        '导音必须向上解决到主音。七音必须向下级进解决。',
        '这两条与调性无关：换到 G 大调，导音是 F♯，七音是 C，方向一模一样。',
        '账没还清也可以继续写，但下一页就得补，而且听者会记着。'
      ],
      quote: 'The principles of harmonic syntax are both reliable and bendable/breakable, and it is often the music that bends/breaks the rules in interesting ways that we care about the most.',
      cite: 'harmonicSyntax1.md:61'
    },
    tonic: 7,
    situations: [
      {
        prev: { rn: 'V7', func: 'D', pcs: [2, 6, 9, 0], lt: true, seventh: 0 },
        prompt: 'G 大调的属七：导音 F♯，七音 C。两笔一起还。',
        options: [
          { rn: 'I', func: 'T', pcs: [7, 11, 2] },
          { rn: 'IV', func: 'PD', pcs: [0, 2, 7] },
          { rn: 'vi', func: 'T', pcs: [11, 2, 6] }
        ]
      },
      {
        prev: { rn: 'V', func: 'D', pcs: [2, 6, 9], lt: true },
        prompt: '属三和弦，只剩导音一笔。',
        options: [
          { rn: 'I', func: 'T', pcs: [7, 11, 2] },
          { rn: 'IV', func: 'PD', pcs: [0, 2, 7] },
          { rn: 'ii', func: 'PD', pcs: [9, 0, 2] }
        ]
      }
    ]
  },
  {
    id: 'r-cadence', district: 'hall', kind: 'locked', title: '终止式与延长',
    meta: '只读 · 终止式', char: '洛特',
    line: '收账的方式不止一种。正格、变格、半收、假收，各有各的账期。',
    teach: {
      title: '四种收法',
      body: [
        '正格终止是属到主，最常用。变格终止是下属到主，像一声叹息。',
        '半终止停在属上，话没说完。假终止是属到六级，账还了，但落点偏了。',
        '延长则是让一个功能在几小节里持续存在，中间插进来的和弦都算它的注脚。'
      ],
      quote: 'A cadence is a point of arrival that punctuates the end of a musical unit, such as a phrase, theme, large formal section, or movement.',
      cite: 'cadenceTypes.md'
    }
  },
  {
    id: 'r-applied', district: 'hall', kind: 'locked', title: '副属、交替与转调',
    meta: '只读 · 变化和声', char: '洛特',
    line: '借别的调的属和弦来用，账还是记在临时主音头上。这一章是账本的进阶。',
    teach: {
      title: '借来的属',
      body: [
        '副属和弦是临时把某个和弦当成主音，在它前面加一个属和弦。它不改变调性，只改变那一步的账期。',
        '调式交替是从同主音的另一个调借和弦，例如 C 大调借 c 小调的 ♭VI。',
        '转调则是账本换了一本：新调的属和弦与导音开始承担推进。'
      ],
      quote: 'Tonicization is the process of momentarily emphasizing a non-tonic chord by using chords borrowed from the key in which that chord is tonic.',
      cite: 'appliedChords.md'
    }
  },
  {
    id: 'r-compass1', district: 'hall', kind: 'compass', title: '最短的路',
    meta: '调性罗盘 · 五度圈', char: '洛特',
    line: '从 C 大调到 A 大调，沿五度走三步就到。别绕路。',
    teach: {
      title: '五度圈上的近路',
      body: [
        '五度圈上相邻的两个调，调号只差一个升降号，共用的和弦最多，所以转调最省。',
        '从 C 走到 A，顺时针三步：C–G–D–A。每走一步都换一次主音，共用和弦越来越少，但还在同一个圈上。',
        '反过来走也行，只是要多绕九步，听感上会先离开再回来。'
      ],
      quote: 'The principal difference between tonicization and modulation is the presence or absence of a cadence: tonicization does not incorporate a cadence in the tonicized key; modulation does incorporate at least one cadence (PAC, IAC, or HC) in a new key.',
      cite: 'Modulation.md'
    },
    guide: {
      goal: '把罗盘从 C 大调走到 A 大调，用最少的步数。',
      steps: ['点相邻的石头，沿五度走一步，会听到新旧两个主和弦。', '看提示里的「最少还要几步」，朝数字变小的方向走。', '走到 A 大调就自动结算。'],
      done: '到达 A 大调，而且正好三步。'
    },
    compass: { from: { pc: 0, mode: 'M' }, to: { pc: 9, mode: 'M' }, showDistance: true }
  },
  {
    id: 'r-compass2', district: 'hall', kind: 'compass', title: '绕道关系调',
    meta: '调性罗盘 · 关系大小调', char: '洛特',
    line: '这次目标是小调。同一个调号上有两个调，别只盯着石头走。',
    teach: {
      title: '关系调与直接转调',
      body: [
        '每个调号上有两个调：一个大调，一个关系小调，音完全一样，只是主音换了一个。',
        '所以罗盘上同一个位置可以翻面：C 大调翻过来就是 a 小调。翻面不算走远，主音换了，调号没变。',
        '直接转调则是没有过渡，前一个调的主和弦直接接后一个调的主和弦，常常发生在乐句交界。'
      ],
      quote: 'A direct modulation occurs when a chord in the previous key is followed directly by a chord in the new key.',
      cite: 'Modulation.md'
    },
    guide: {
      goal: '从 C 大调走到 f♯ 小调。这次不显示还剩几步，自己算。',
      steps: ['先沿五度走几步，或者先翻面到关系小调。', '每步都会听到两个主和弦，注意听主音挪到哪。', '走到 f♯ 小调就自动结算；走多了会告诉你从第几步开始绕远。'],
      done: '到达 f♯ 小调，而且正好四步。'
    },
    compass: { from: { pc: 0, mode: 'M' }, to: { pc: 6, mode: 'm' }, showDistance: false }
  },


  /* ---------- 营造司 ---------- */
  {
    id: 'r-theme', district: 'works', kind: 'form', title: '主题的两半',
    meta: '时间轴 · 句法', char: '伊莲',
    line: '八小节，两半。前半把话说出来，后半把它推完。先听，再标。',
    teach: {
      title: '句子的两半',
      body: [
        'sentence 的前半叫陈述：基本乐思出现一次，再用同一节奏换一个结尾，通常停在属和弦上。',
        '后半叫延续：动机被打碎，和声一处一处往上推，最后收在主和弦上。',
        'period 不是这样。period 的后半会原样重述前半，只是把结尾换成完满终止。所以判别方法是听后半有没有回到开头的乐思。'
      ],
      quote: 'The prototypical sentence is eight measures long and contains two four-measure phrases. The first of these is called the presentation phrase and the second is the continuation phrase.',
      cite: 'sentence.md'
    },
    form: {
      tempo: 1.0,
      mode: 'segment',
      bars: [
        { chord: [0, 4, 7], melody: [72, 76] },
        { chord: [0, 4, 7], melody: [79, 76] },
        { chord: [7, 11, 2], melody: [74, 77] },
        { chord: [7, 11, 2], melody: [71, 74] },
        { chord: [0, 4, 7], melody: [72] },
        { chord: [7, 11, 2], melody: [74] },
        { chord: [7, 11, 2, 5], melody: [76, 74] },
        { chord: [0, 4, 7], melody: [72] }
      ],
      segments: [
        { from: 0, to: 3, label: 0, why: '前四小节是陈述：基本乐思出现一次，再用同一节奏换一个结尾，停在属和弦上。' },
        { from: 4, to: 7, label: 1, why: '后四小节是延续：动机被打碎，一处一处往上推，最后收在主和弦上。' }
      ],
      labels: [
        { name: '陈述', desc: '基本乐思，停在属上' },
        { name: '延续', desc: '动机打碎，收在主上' }
      ],
      point: {
        bar: 3, name: '半终止',
        why: '第四小节停在属和弦上，话没说完，这就是半终止。'
      },
      closing: '前半陈述，后半延续，中间停在属上，这是 sentence。如果后半原样重述前半、最后才收，那才是 period。'
    }
  },
  {
    id: 'r-sonata', district: 'works', kind: 'form', title: '呈示部的两个调',
    meta: '时间轴 · 奏鸣', char: '伊莲',
    line: '十二小节。别数段落，数调：哪一小节起，主调不再是主调。',
    teach: {
      title: '呈示部的两个调',
      body: [
        '呈示部先立主调，再立属调。主部在主调上陈述并收住。',
        '过渡的任务只有一个：把调挪过去。它不停留，也不收束。',
        '副部在属调上稳定下来，收住的那一小节叫结构终止点。之后是结束部，是补充，不引入新乐思。'
      ],
      quote: 'A classical sonata is a multi-movement work for solo instrument, chamber ensemble, or orchestra with at least one movement in sonata form.',
      cite: 'SonataTheory-intro.md'
    },
    form: {
      tempo: 1.0,
      mode: 'segment',
      bars: [
        { chord: [0, 4, 7], melody: [72, 76] },
        { chord: [7, 11, 2], melody: [74, 71] },
        { chord: [0, 4, 7], melody: [72] },
        { chord: [9, 0, 4], melody: [69, 72] },
        { chord: [2, 5, 9], melody: [74, 77] },
        { chord: [2, 6, 9], melody: [71, 74] },
        { chord: [7, 11, 2], melody: [79, 83] },
        { chord: [2, 6, 9], melody: [74, 81] },
        { chord: [7, 11, 2], melody: [79] },
        { chord: [7, 11, 2], melody: [79, 83] },
        { chord: [2, 6, 9, 0], melody: [77, 74] },
        { chord: [7, 11, 2], melody: [79] }
      ],
      segments: [
        { from: 0, to: 2, label: 0, why: '前三小节在主调 C 上陈述并收住，这是主部。' },
        { from: 3, to: 5, label: 1, why: '这三小节不收束，和声一路往属调走，是过渡。' },
        { from: 6, to: 8, label: 2, why: '从第六小节起，和声已经站在 G 上，这是副部。' },
        { from: 9, to: 11, label: 3, why: '第九小节之后没有新乐思，只是把副部再收一遍，是结束部。' }
      ],
      labels: [
        { name: '主部', desc: '主调陈述并收住' },
        { name: '过渡', desc: '不停留，往属调走' },
        { name: '副部', desc: '在属调上稳定' },
        { name: '结束部', desc: '副部之后的补充' }
      ],
      point: {
        bar: 8, name: '结构终止点',
        why: '第九小节在属调上收住，副题到这里才算落地；后面的都是结束部。'
      },
      closing: '呈示部的要害不是段落数量，是两个调。主部在主调，副部在属调，中间三小节负责把调挪过去。'
    }
  },
  {
    id: 'r-rondo', district: 'works', kind: 'form', title: '叠句回来了几次',
    meta: '时间轴 · 回旋', char: '伊莲',
    line: '十五小节，同一段音乐回来两次。你在它回来的地方切一刀。',
    teach: {
      title: '回旋靠回来辨认',
      body: [
        '五部回旋是 A–B–A–C–A：每离开一次，都要回到同一个地方。',
        '所以分析回旋不是数段落，是听同一段叠句什么时候原样回来。',
        '插部之间也要能分开：B 与 C 的材料不同，回到 A 时材料又重新一致。'
      ],
      quote: 'rondo has a longer history whose origins are in a French instrumental genre—the rondeaux—that was characterized by an alternation of refrains and contrasting couplets.',
      cite: 'rondo.md'
    },
    form: {
      tempo: 1.0,
      mode: 'boundary',
      bars: [
        { chord: [0, 4, 7], melody: [72, 76] },
        { chord: [7, 11, 2], melody: [74, 71] },
        { chord: [0, 4, 7], melody: [72] },
        { chord: [9, 0, 4], melody: [69, 72] },
        { chord: [2, 5, 9], melody: [74, 77] },
        { chord: [7, 11, 2], melody: [71] },
        { chord: [0, 4, 7], melody: [72, 76] },
        { chord: [7, 11, 2], melody: [74, 71] },
        { chord: [0, 4, 7], melody: [72] },
        { chord: [5, 9, 0], melody: [77, 81] },
        { chord: [2, 5, 9], melody: [74, 77] },
        { chord: [7, 11, 2], melody: [71] },
        { chord: [0, 4, 7], melody: [72, 76] },
        { chord: [7, 11, 2], melody: [74, 71] },
        { chord: [0, 4, 7], melody: [72] }
      ],
      boundaries: [3, 6, 9, 12],
      boundaryPrompt: '把它切成五段。',
      closing: '五段是 A–B–A–C–A。回来的两次材料完全一样，插部两次不一样，这就是回旋的听法。'
    }
  },
  {
    id: 'r-schema', district: 'works', kind: 'locked', title: '加兰特图式',
    meta: '只读 · 图式', char: '伊莲',
    line: '这一章讲的是现成的模板。同一个模板，十八世纪的乐手能当场即兴填完。',
    teach: {
      title: '模板与即兴',
      body: [
        '图式是成套的伴奏与旋律模板，例如 Prinner、Monte、Fonte，各有固定的低音走向与和声骨架。',
        '它们不是抄袭，而是当时的通用语。会用模板的人能在现场把一段句子填完。',
        '识图式的意义在于：你知道这段音乐为什么听起来是那个年代。'
      ],
      quote: 'Schemata (pl. of schema) are “stock musical phrases” that act as melodic, harmonic, and rhythmic/metric skeletons for passages of music in the Galant style.',
      cite: 'schemataOpensAndCloses.md'
    }
  },

  /* ---------- 边区 ---------- */
  {
    id: 'r-normal', district: 'frontier', kind: 'set', mode: 'normal', title: '最紧排列',
    meta: '音集 · 最紧排列', char: '努尔',
    line: '这里没有常音。先把这四个音排到最紧的位置，你才量得出它的原形。',
    teach: {
      title: '正常序',
      body: [
        '正常序是把一组音级排成最紧凑的写法。做法是把每个音都当一次起点，算首尾之间的跨度，取最小的那个。',
        '跨度相同时，再比第一个音到倒数第二个音的跨度，小者胜。',
        '转得越紧，越容易看出这组音的本质：它到底像三度叠置，还是像别的什么。'
      ],
      quote: 'Normal order is the most compressed way to write a given collection of pitch classes.',
      cite: 'normalOrder.md:8'
    },
    members: [2, 5, 9, 11]
  },
  {
    id: 'r-common', district: 'frontier', kind: 'set', mode: 'common', title: '共同音',
    meta: '音集 · 转调的共同音', char: '努尔',
    line: '两组音移到一起，能对上几块石头？对上的越多，交接越顺。',
    teach: {
      title: '共同音',
      body: [
        '把一组音整体平移 n 个半音，得到另一组。两组共有的音就是共同音。',
        '共同音越多，听者在两个集合之间越不容易迷路。',
        '这一关只问一件事：哪几个音同时在两组里。'
      ],
      quote: 'Occasionally you’ll have a tie in step 3. In these cases, write the ordering implied by each tie and calculate the interval from the first to the penultimate pitch class.',
      cite: 'normalOrder.md:23'
    },
    members: [0, 3, 7, 10],
    transpose: 5
  },
  {
    id: 'r-twelve', district: 'frontier', kind: 'locked', title: '十二音',
    meta: '只读 · 十二音', char: '努尔',
    line: '十二个音各用一次，谁也不是中心。这一章我写在册子的最后，你读完就懂了边区。',
    teach: {
      title: '没有中心',
      body: [
        '十二音体系把十二个音排成一个序列，全曲中每个音在序列用完之前不重复。',
        '序列可以平移、倒影、逆行、逆行倒影，四种变换撑起整首曲子的材料。',
        '原形与集合是两套工具：一个管序列的写法，一个管纵向的音集内容。'
      ],
      quote: 'Twelve-tone composition refers more specifically to music based on orderings of the twelve pitch classes.',
      cite: 'twelveToneBasics.md'
    }
  },

  /* ---------- 市集 ---------- */
  {
    id: 'r-doowop', district: 'market', kind: 'pop', title: '循环续写',
    meta: '流行和声 · 循环', char: '阿吉',
    line: '五十年代那套和弦，一共四个，转一圈回来。你只要接得上，街上的人就能跟着走。',
    teach: {
      title: '循环和声',
      body: [
        'doo-wop 循环是 I–vi–IV–V，绕一圈回到 I。它的力量来自循环本身，不来自终止。',
        '正因为是循环，所以它可以从任何一处开始，再往下走同样的顺序。',
        '接错一处，循环就断了：要么提前收束，要么跳到一个回不来的位置。'
      ],
      quote: 'Because it is typically employed in cycles, it can also be found starting on a different chord in the cycle and then proceeding through the same succession of chords.',
      cite: 'popRockHarmony-dooWop.md:20'
    },
    loop: ['I', 'vi', 'IV', 'V'],
    chords: [
      { rn: 'I', func: 'T', pcs: [0, 4, 7] },
      { rn: 'vi', func: 'T', pcs: [9, 0, 4] },
      { rn: 'IV', func: 'PD', pcs: [5, 9, 0] },
      { rn: 'V', func: 'D', pcs: [7, 11, 2] }
    ],
    startAt: 0,
    rounds: 3
  },
  {
    id: 'r-containers', district: 'market', kind: 'locked', title: '街声的容器',
    meta: '只读 · 流行曲式', char: '阿吉',
    line: '副歌、主歌、桥段——街上的房子也有图纸，只是没人把它写进公会的册子。',
    teach: {
      title: '容器与功能',
      body: [
        '流行曲式的段落在英文里叫 container，主歌、副歌、桥段各有固定功能。',
        'lament 与 blues 的循环比 doo-wop 更老，切分让弱拍变成重心。',
        '分析时要先标容器，再标功能，最后才谈和声。'
      ],
      quote: 'Pop/rock songs of the late twentieth century tend to follow one of three large-scale structural patterns.',
      cite: 'popRockForm.md'
    }
  }
];

var ROOM_INDEX = {};
ROOMS.forEach(function (r) { ROOM_INDEX[r.id] = r; });

function roomsOfDistrict(did) {
  return ROOMS.filter(function (r) { return r.district === did; });
}
function playableRoomsOfDistrict(did) {
  return roomsOfDistrict(did).filter(function (r) { return r.kind !== 'locked'; });
}
function districtById(did) {
  return DISTRICTS.filter(function (d) { return d.id === did; })[0];
}

/* ================= 11. 状态与存档 ================= */

var STORE_KEY = 'wuduhuan-v1';

var state = {
  view: 'map',
  district: 'quarry',
  roomId: null,
  marks: {},
  activeSlot: 0,
  cp: {},
  scale: {},
  harmony: {},
  set: {},
  pop: {},
  form: {},
  cleared: {},
  seals: {},
  signed: null,
  started: false,
  avatar: null,
  avatarSeed: null,
  avatarConfirmed: false,
  hintTier: {},
  records: {},
  pendingRecord: null,
  compass: {},
  rhythm: {},
  warmupDone: false,
  mastery: {},
  evidence: {},
  tour: null,
  tourRuns: 0
};

function totalSlots(level) {
  return level.species === 1 ? level.cantus.length : level.cantus.length * 2 - 1;
}

function blankSlots(level) {
  var n = totalSlots(level), a = [];
  for (var i = 0; i < n; i++) a.push(null);
  return a;
}

function saveState() {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify({
      view: state.view, district: state.district, roomId: state.roomId,
      cp: state.cp, scale: state.scale, harmony: state.harmony,
      set: state.set, pop: state.pop, form: state.form, cleared: state.cleared,
      seals: state.seals, signed: state.signed, started: state.started,
      avatar: state.avatar, avatarSeed: state.avatarSeed, avatarConfirmed: state.avatarConfirmed,
      hintTier: state.hintTier, records: state.records,
      compass: state.compass, rhythm: state.rhythm, warmupDone: state.warmupDone,
      mastery: state.mastery, evidence: state.evidence, tour: state.tour, tourRuns: state.tourRuns
    }));
  } catch (e) { /* 存档不可用不影响游玩 */ }
}

function loadState() {
  try {
    var raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return;
    var d = JSON.parse(raw);
    ['cp', 'scale', 'harmony', 'set', 'pop', 'form', 'cleared', 'seals', 'hintTier', 'records', 'compass', 'rhythm', 'mastery', 'evidence'].forEach(function (k) {
      if (d[k] && typeof d[k] === 'object') state[k] = d[k];
    });
    if (d.signed) state.signed = d.signed;
    if (d.started) state.started = true;
    if (d.avatar) state.avatar = d.avatar;
    if (d.warmupDone) state.warmupDone = true;
    if (d.tour && Array.isArray(d.tour.rooms) && d.tour.rooms.length === 3) state.tour = d.tour;
    if (Number.isInteger(d.tourRuns)) state.tourRuns = d.tourRuns;
    if (Number.isInteger(d.avatarSeed)) state.avatarSeed = d.avatarSeed;
    if (d.avatarConfirmed) state.avatarConfirmed = true;
    if (d.district && districtById(d.district)) state.district = d.district;
    if (d.roomId && ROOM_INDEX[d.roomId]) { state.roomId = d.roomId; state.view = 'room'; }
  } catch (e) { /* 忽略损坏的存档 */ }
}

/* ================= 12. 判定引擎（新增三类） ================= */

/* --- 和声续接 --- */
function harmonyIssues(prev, next, tonicPc) {
  var errs = [];
  if (prev.func === 'D' && next.func === 'PD') {
    errs.push({ code: 'RETRO', msg: '从属功能退回下属。乐句被推回去了。' });
  }
  if (prev.lt && next.pcs.indexOf(tonicPc) === -1) {
    errs.push({ code: 'LT', msg: '上一和弦的导音没有上行解决到主音。' });
  }
  if (prev.seventh != null) {
    var a = (prev.seventh + 11) % 12, b = (prev.seventh + 10) % 12;
    if (next.pcs.indexOf(a) === -1 && next.pcs.indexOf(b) === -1) {
      errs.push({ code: 'SEVENTH', msg: '上一和弦的七音没有下行级进解决。' });
    }
  }
  return errs;
}

/* --- 音集 --- */
function orderFrom(members, start) {
  var ordered = [];
  for (var i = 0; i < 12; i++) {
    var pc = (start + i) % 12;
    if (members.indexOf(pc) !== -1) ordered.push(pc);
  }
  var span = (ordered[ordered.length - 1] - ordered[0] + 12) % 12;
  return { ordered: ordered, span: span };
}

function minSpanOf(members) {
  var best = 99, starts = [];
  members.forEach(function (s) {
    var info = orderFrom(members, s);
    if (info.span < best) { best = info.span; starts = [s]; }
    else if (info.span === best) starts.push(s);
  });
  return { span: best, starts: starts };
}

function commonTonesOf(a, b) {
  return a.filter(function (x) { return b.indexOf(x) !== -1; });
}

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  var x = a.slice().sort(function (p, q) { return p - q; });
  var y = b.slice().sort(function (p, q) { return p - q; });
  for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

/* ================= 13. 音频补充 ================= */

function playChord(pcs, when, dur, gain) {
  var c = ensureAudio();
  if (!c) return;
  if (when == null) when = c.currentTime + 0.02;
  if (dur == null) dur = 1.0;
  pcs.forEach(function (pc) {
    var m = 60 + pc;
    if (m < 55) m += 12;
    if (m > 76) m -= 12;
    tone(m, when, dur, gain == null ? 0.1 : gain);
  });
}

function playSequence(notes) {
  var c = ensureAudio();
  if (!c) return 0;
  var list = notes.filter(function (m) { return isFinite(m); });
  if (!list.length) return 0;
  var t0 = c.currentTime + 0.08;
  list.forEach(function (m, i) { tone(m, t0 + i * 0.34, 0.34, 0.15); });
  return list.length;
}

function flashChar(text, ms) {
  var host = document.getElementById('charLine');
  if (!host) return;
  host.textContent = text;
  window.__charTimer = window.__charTimer || 0;
  clearTimeout(window.__charTimer);
  window.__charTimer = setTimeout(function () {
    var room = ROOM_INDEX[state.roomId];
    if (room) host.textContent = charLineFor(room);
  }, ms || 2600);
}

/* ================= 14. 环 ================= */

function ringNodePos(i) {
  var a = (-90 + 30 * i) * Math.PI / 180;
  return { x: 210 + 150 * Math.cos(a), y: 210 + 150 * Math.sin(a) };
}

function fifthsIndex(pc) { return (pc * 7) % 12; }

function buildRing(opts) {
  var svg = svgEl('svg', { viewBox: '0 0 420 420', role: 'img' });
  svg.appendChild(svgEl('circle', { cx: 210, cy: 210, r: 150, class: 'fifths-ring', fill: 'none', stroke: 'rgba(33,28,24,.2)', 'stroke-dasharray': '3 4' }));

  var selected = opts.selected || [];
  var ghost = opts.ghost || [];
  var picked = opts.picked || [];
  var bad = opts.bad || [];
  var degrees = opts.degrees || null;

  for (var i = 0; i < 12; i++) {
    var pc = opts.order === 'fifths' ? (i * 7) % 12 : i;
    var p = ringNodePos(i);
    var isSel = selected.indexOf(pc) !== -1;
    var cls = 'ring-node';
    if (isSel) cls += ' is-sel';
    if (opts.tonic === pc) cls += ' is-tonic';
    if (ghost.indexOf(pc) !== -1) cls += ' is-ghost';
    if (picked.indexOf(pc) !== -1) cls += ' is-picked';
    if (bad.indexOf(pc) !== -1) cls += ' is-bad';

    var g = svgEl('g', { style: 'cursor:pointer' });
    g.setAttribute('data-pc', String(pc));
    var circle = svgEl('circle', { cx: p.x, cy: p.y, r: 17, class: cls });
    g.appendChild(circle);

    var lab = svgEl('text', {
      x: p.x, y: p.y + 4, class: 'ring-label' + (isSel || picked.indexOf(pc) !== -1 ? ' is-sel' : '')
    });
    lab.textContent = NAMES[pc];
    g.appendChild(lab);

    if (degrees && opts.tonic != null) {
      var degIdx = (pc - opts.tonic + 12) % 12;
      var deg = degrees[degIdx];
      if (deg) {
        var t2 = svgEl('text', { x: p.x, y: p.y - 23, class: 'ring-deg' });
        t2.textContent = deg;
        g.appendChild(t2);
      }
    }
    svg.appendChild(g);
  }

  if (opts.onNode) {
    svg.addEventListener('click', function (ev) {
      var g = ev.target.closest ? ev.target.closest('g[data-pc]') : null;
      if (!g) return;
      opts.onNode(parseInt(g.getAttribute('data-pc'), 10));
    });
  }
  return svg;
}

/* ================= 15. 视图：地图 ================= */

function $(id) { return document.getElementById(id); }


function nextRecommended(s) {
  s = s || state;
  var cur = districtById(s.district) || DISTRICTS[0];
  var first = playableRoomsOfDistrict(cur.id).filter(function (r) { return !s.cleared[r.id]; });
  if (first.length) return first[0].id;
  for (var i = 0; i < DISTRICTS.length; i++) {
    var rooms = playableRoomsOfDistrict(DISTRICTS[i].id).filter(function (r) { return !s.cleared[r.id]; });
    if (rooms.length) return rooms[0].id;
  }
  return null;
}

function renderMap() {
  state.view = 'map';
  state.view = 'map';
  $('viewLanding').hidden = true;
  $('viewMap').hidden = false;
  $('viewRoom').hidden = true;
  $('btnBackMap').hidden = true;
  $('btnLanding').hidden = false;

  var host = $('cityHost');
  host.innerHTML = '';
  var svg = svgEl('svg', { viewBox: '0 0 420 420', role: 'img' });
  svg.appendChild(svgEl('circle', { cx: 210, cy: 210, r: 148, fill: 'none', stroke: 'rgba(33,28,24,.22)', 'stroke-dasharray': '3 4' }));

  var totalSeals = 0;
  DISTRICTS.forEach(function (d) {
    if (state.seals[d.id]) totalSeals++;
  });
  $('sealCount').textContent = String(totalSeals);
  var sealTotal = DISTRICTS.filter(function (d) { return playableRoomsOfDistrict(d.id).length > 0; }).length;
  var totalHost = document.getElementById('sealTotal');
  if (totalHost) totalHost.textContent = String(sealTotal);

  var pendingCount = pendingDistricts();
  var ctext = svgEl('text', { x: 210, y: 204, class: 'city-center' });
  ctext.textContent = pendingCount ? '常音 · 紧张' : '常音 · 已正';
  svg.appendChild(ctext);
  var csub = svgEl('text', { x: 210, y: 222, class: 'city-center-sub' });
  csub.textContent = state.signed ? '已署名' : '· 仍在响 ·';
  svg.appendChild(csub);

  DISTRICTS.forEach(function (d) {
    var a = (d.angle) * Math.PI / 180;
    var x = 210 + 148 * Math.cos(a), y = 210 + 148 * Math.sin(a);
    var playable = playableRoomsOfDistrict(d.id);
    var done = playable.filter(function (r) { return state.cleared[r.id]; }).length;
    var sealed = !!state.seals[d.id];
    var cls = 'city-node';
    if (state.district === d.id) cls += ' is-current';
    if (sealed) cls += ' is-sealed';
    if (playable.length === 0) cls += ' is-locked';

    var g = svgEl('g', { style: 'cursor:pointer' });
    g.setAttribute('data-district', d.id);
    g.appendChild(svgEl('circle', { cx: x, cy: y, r: 44, class: cls }));
    var t1 = svgEl('text', { x: x, y: y - 2, class: 'city-name' });
    t1.textContent = d.name;
    g.appendChild(t1);
    var t2 = svgEl('text', { x: x, y: y + 14, class: 'city-prog' });
    t2.textContent = playable.length ? (done + ' / ' + playable.length) : '仅讲解';
    g.appendChild(t2);
    if (sealed) {
      var t3 = svgEl('text', { x: x, y: y + 28, class: 'city-lock' });
      t3.textContent = '已校';
      g.appendChild(t3);
    }
    svg.appendChild(g);
  });

  var cur = districtById(state.district) || DISTRICTS[0];
  var ang = cur.angle * Math.PI / 180;
  var ax = 210 + 148 * Math.cos(ang), ay = 210 + 148 * Math.sin(ang);
  var fo = svgEl('foreignObject', { x: ax + 14, y: ay + 4, width: 40, height: 60 });
  var holder = document.createElement('div');
  holder.className = 'map-avatar';
  holder.appendChild(avatarSVG(avatarOf(), 34));
  fo.appendChild(holder);
  svg.appendChild(fo);

  svg.addEventListener('click', function (ev) {
    var g = ev.target.closest ? ev.target.closest('g[data-district]') : null;
    if (!g) return;
    state.district = g.getAttribute('data-district');
    renderMap();
    saveState();
  });

  host.appendChild(svg);

  var audioHost = document.getElementById('cityAudio');
  if (audioHost) {
    audioHost.innerHTML = '';
    var pending2 = pendingDistricts();
    if (!audioSupported()) {
      var un = document.createElement('span');
      un.className = 'city-audio-note';
      un.textContent = '这个浏览器不支持实时合成，常音只能看文字：' + (pending2 ? '还有 ' + pending2 + ' 区未校。' : '六区都已校完。');
      audioHost.appendChild(un);
    } else {
      var db = document.createElement('button');
      db.type = 'button';
      db.className = 'btn btn-quiet btn-mini';
      db.id = 'droneBtn';
      db.textContent = drone.on ? '停止常音' : ('听常音 · ' + (pending2 ? pending2 + ' 区未校' : '已正'));
      db.addEventListener('click', function () {
        ensureAudio();
        if (drone.on) stopDrone(); else startDrone();
        renderMap();
      });
      audioHost.appendChild(db);
      var note = document.createElement('span');
      note.className = 'city-audio-note';
      note.textContent = pending2 ? '未校的城区越多，这条音越不干净。' : '六区都校完了，常音已经干净。';
      audioHost.appendChild(note);
    }
  }

  renderTourEntry();
  renderDistrictPanel();
  saveState();
}

function renderTourEntry() {
  var host = document.getElementById('tourHost');
  if (!host) return;
  host.innerHTML = '';
  var counts = masteryCounts(state);
  var owned = counts.understand + counts.proficient + counts.transfer;
  var line = document.createElement('div');
  line.className = 'tour-counts';
  line.textContent = owned
    ? '掌握：理解 ' + counts.understand + ' · 熟练 ' + counts.proficient + ' · 迁移 ' + counts.transfer
    : '掌握：还没有记录，校完第一间房就会开始记。';
  host.appendChild(line);

  var t = state.tour;
  if (t && t.rooms) {
    var resume = mkBtn(t.done ? '看巡演总结' : '继续巡演 ' + Math.min(t.index + 1, 3) + '/3', 'btn btn-mini', resumeTour);
    resume.id = 'tourResume';
    host.appendChild(resume);
    var quit = mkBtn('退出巡演', 'btn btn-quiet btn-mini', leaveTour);
    host.appendChild(quit);
    return;
  }
  var plan = buildTour(state);
  var btn = mkBtn(plan.ok ? '三关巡演 · 约 5 分钟' : '三关巡演 · 需先校完 3 间', 'btn btn-mini', startTour);
  btn.id = 'tourStart';
  btn.disabled = !plan.ok;
  host.appendChild(btn);
  if (!plan.ok) {
    var hint = document.createElement('span');
    hint.className = 'tour-hint';
    hint.textContent = '已有 ' + plan.have + ' / 3 间';
    host.appendChild(hint);
  }
}

function renderDistrictPanel() {
  var d = districtById(state.district);
  var panel = $('districtPanel');
  panel.innerHTML = '';

  var name = document.createElement('h2');
  name.className = 'dp-name';
  name.textContent = d.name;
  panel.appendChild(name);

  var who = document.createElement('div');
  who.className = 'dp-who';
  who.textContent = d.who;
  panel.appendChild(who);

  var desc = document.createElement('p');
  desc.className = 'dp-desc';
  desc.textContent = d.desc;
  panel.appendChild(desc);

  var dRooms = playableRoomsOfDistrict(d.id).filter(function (r) { return state.cleared[r.id]; });
  if (dRooms.length) {
    var dm = { understand: 0, proficient: 0, transfer: 0 };
    dRooms.forEach(function (r) {
      var m = masteryOf(state, r.id);
      if (m) dm[m]++;
    });
    var dline = document.createElement('div');
    dline.className = 'dp-mastery';
    dline.textContent = '这一区：理解 ' + dm.understand + ' · 熟练 ' + dm.proficient + ' · 迁移 ' + dm.transfer;
    panel.appendChild(dline);
  }

  var idrow = document.createElement('div');
  idrow.className = 'panel-identity';
  idrow.appendChild(avatarSVG(avatarOf(), 44));
  var idside = document.createElement('div');
  idside.className = 'panel-identity-side';
  var here = document.createElement('div');
  here.className = 'panel-here';
  here.textContent = '你在这里';
  idside.appendChild(here);
  idside.appendChild(markRow(15));
  idrow.appendChild(idside);
  panel.appendChild(idrow);

  var next = nextRecommended();
  if (next && ROOM_INDEX[next]) {
    var nr = ROOM_INDEX[next];
    var box = document.createElement('button');
    box.type = 'button';
    box.className = 'next-stop';
    var t1 = document.createElement('span');
    t1.className = 'next-label';
    t1.textContent = '下一站';
    var t2 = document.createElement('span');
    t2.className = 'next-title';
    t2.textContent = nr.title;
    box.appendChild(t1);
    box.appendChild(t2);
    box.addEventListener('click', function () { enterRoom(nr.id); });
    panel.appendChild(box);
  } else if (!next) {
    var done = document.createElement('div');
    done.className = 'next-stop is-done';
    done.textContent = '六个城区都校完了。';
    panel.appendChild(done);
  }

  var ul = document.createElement('ul');
  ul.className = 'room-list';
  roomsOfDistrict(d.id).forEach(function (r) {
    var li = document.createElement('li');
    var btn = document.createElement('button');
    btn.type = 'button';
    var cleared = !!state.cleared[r.id];
    var locked = r.kind === 'locked';
    btn.className = 'room-row' + (cleared ? ' is-clear' : locked ? ' is-locked' : ' is-open');
    var dot = document.createElement('span');
    dot.className = 'dot';
    dot.textContent = cleared ? '已校' : locked ? '仅讲解' : '可进入';
    var title = document.createElement('span');
    title.textContent = r.title;
    btn.appendChild(dot);
    btn.appendChild(title);
    btn.addEventListener('click', function () { enterRoom(r.id); });
    li.appendChild(btn);
    ul.appendChild(li);
  });
  panel.appendChild(ul);
}

/* ================= 15d. 调性罗盘 ================= */

var MAJOR_NAME = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
var MINOR_NAME = ['c', 'c♯', 'd', 'e♭', 'e', 'f', 'f♯', 'g', 'g♯', 'a', 'b♭', 'b'];

function keyLabel(k) {
  return (k.mode === 'M' ? MAJOR_NAME[k.pc] : MINOR_NAME[k.pc]) + (k.mode === 'M' ? ' 大调' : ' 小调');
}

function compassKeyOf(k) { return k.mode + ':' + k.pc; }

function compassNeighbors(k) {
  return [
    { pc: (k.pc + 7) % 12, mode: k.mode, via: 'fifth' },
    { pc: (k.pc + 5) % 12, mode: k.mode, via: 'fifth' },
    { pc: (k.pc + (k.mode === 'M' ? 9 : 3)) % 12, mode: k.mode === 'M' ? 'm' : 'M', via: 'relative' }
  ];
}

/* 从任意调走到目标调最少几步 */
function compassDistance(from, to) {
  var start = compassKeyOf(from), goal = compassKeyOf(to);
  if (start === goal) return 0;
  var dist = {}; dist[start] = 0;
  var queue = [from];
  while (queue.length) {
    var cur = queue.shift();
    var d = dist[compassKeyOf(cur)];
    var nb = compassNeighbors(cur);
    for (var i = 0; i < nb.length; i++) {
      var key = compassKeyOf(nb[i]);
      if (dist[key] == null) {
        dist[key] = d + 1;
        if (key === goal) return d + 1;
        queue.push({ pc: nb[i].pc, mode: nb[i].mode });
      }
    }
  }
  return Infinity;
}

function compassState(room) {
  if (!state.compass[room.id]) {
    state.compass[room.id] = {
      pc: room.compass.from.pc,
      mode: room.compass.from.mode,
      path: [],
      checked: false,
      error: null,
      attempts: 0
    };
  }
  return state.compass[room.id];
}

function tonicTriad(k) {
  return k.mode === 'M' ? [k.pc, (k.pc + 4) % 12, (k.pc + 7) % 12]
    : [k.pc, (k.pc + 3) % 12, (k.pc + 7) % 12];
}

function playModulation(from, to) {
  var c = ensureAudio();
  if (!c) return;
  var t0 = c.currentTime + 0.05;
  playChord(tonicTriad(from), t0, 0.7, 0.09);
  playChord(tonicTriad(to), t0 + 0.75, 0.9, 0.09);
}

function buildCompassRing(room, cs) {
  var svg = svgEl('svg', { viewBox: '0 0 420 420', role: 'img' });
  svg.appendChild(svgEl('circle', {
    cx: 210, cy: 210, r: 150, fill: 'none',
    stroke: 'rgba(33,28,24,.2)', 'stroke-dasharray': '3 4'
  }));

  for (var i = 0; i < 12; i++) {
    var pc = (i * 7) % 12;
    var p = ringNodePos(i);
    var isCur = pc === cs.pc;
    var isTarget = pc === room.compass.to.pc;
    var cls = 'ring-node';
    if (isCur) cls += ' is-sel';
    if (isTarget) cls += ' is-ghost';

    var g = svgEl('g', { style: 'cursor:pointer' });
    g.setAttribute('data-key', String(pc));
    g.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: 21, class: cls }));

    var major = svgEl('text', {
      x: p.x, y: p.y - 1, 'text-anchor': 'middle',
      fill: isCur ? 'var(--paper)' : 'var(--ink)',
      'font-size': 12, 'font-family': 'var(--serif)'
    });
    major.textContent = MAJOR_NAME[pc];
    g.appendChild(major);

    var minor = svgEl('text', {
      x: p.x, y: p.y + 13, 'text-anchor': 'middle',
      fill: isCur ? 'rgba(243,237,224,.75)' : 'rgba(111,100,85,.9)',
      'font-size': 10, 'font-family': 'var(--serif)', 'font-style': 'italic'
    });
    minor.textContent = MINOR_NAME[pc];
    g.appendChild(minor);
    svg.appendChild(g);
  }

  svg.addEventListener('click', function (ev) {
    var g = ev.target.closest ? ev.target.closest('g[data-key]') : null;
    if (!g) return;
    var pc = parseInt(g.getAttribute('data-key'), 10);
    compassStep(room, pc);
  });
  return svg;
}

function compassStep(room, pc) {
  var cs = compassState(room);
  if (cs.path.length >= 8) {
    cs.error = '走了八步还没到，先重走一次。';
    renderRoom();
    return;
  }
  if (pc === cs.pc) return;
  var up = (cs.pc + 7) % 12, down = (cs.pc + 5) % 12;
  if (pc !== up && pc !== down) {
    cs.error = '罗盘只能沿五度走一步：点相邻的那块石头，或者换关系调。';
    renderRoom();
    return;
  }

  var from = { pc: cs.pc, mode: cs.mode };
  var to = { pc: pc, mode: cs.mode };
  ensureAudio();
  playModulation(from, to);

  cs.path.push({ pc: pc, mode: cs.mode, via: 'fifth' });
  cs.pc = pc;
  cs.error = null;
  finishCompassTurn(room);
}

function compassFlip(room) {
  var cs = compassState(room);
  var from = { pc: cs.pc, mode: cs.mode };
  var to = { pc: (cs.pc + (cs.mode === 'M' ? 9 : 3)) % 12, mode: cs.mode === 'M' ? 'm' : 'M' };
  ensureAudio();
  playModulation(from, to);

  cs.path.push({ pc: to.pc, mode: to.mode, via: 'relative' });
  cs.pc = to.pc;
  cs.mode = to.mode;
  cs.error = null;
  finishCompassTurn(room);
}

function compassArrived(room, cs) {
  return cs.pc === room.compass.to.pc && cs.mode === room.compass.to.mode;
}

function finishCompassTurn(room) {
  var cs = compassState(room);
  if (!compassArrived(room, cs)) { renderRoom(); saveState(); return; }

  var optimal = compassDistance(room.compass.from, room.compass.to);
  if (cs.path.length === optimal) {
    passRoom(room);
    setTimeout(function () {
      showVerdict({
        eyebrow: '接上了',
        title: room.title + ' · 到了',
        paras: ['从 ' + keyLabel(room.compass.from) + ' 走到 ' + keyLabel(room.compass.to) + '，' + optimal + ' 步，一步没多。'],
        actions: [{ label: '回环城', cls: 'btn btn-ink', fn: function () { hideVerdict(); clearRoom(room); } }]
      });
    }, 500);
  } else {
    cs.attempts++;
    cs.checked = true;
    var d = compassDistance(room.compass.from, room.compass.to);
    var cur = { pc: room.compass.from.pc, mode: room.compass.from.mode };
    var best = compassDistance(cur, room.compass.to);
    var breakAt = -1, where = null, dirFrom = null;
    for (var i = 0; i < cs.path.length; i++) {
      var next = cs.path[i];
      var nd = compassDistance({ pc: next.pc, mode: next.mode }, room.compass.to);
      if (nd >= best) { breakAt = i; where = next; dirFrom = cur; break; }
      best = nd; cur = { pc: next.pc, mode: next.mode };
    }
    cs.error = '到了，但绕远了：最少 ' + d + ' 步，你走了 ' + cs.path.length + ' 步。' +
      (breakAt >= 0 ? '第 ' + (breakAt + 1) + ' 步开始走远：从 ' + keyLabel(dirFrom) + ' 到 ' + keyLabel(where) + ' 之后，离目标反而更远。' : '');
    renderRoom();
  }
  saveState();
}

function renderCompassRoom(room, body, barUi) {
  var cs = compassState(room);
  var host = document.createElement('div');
  host.className = 'ring-host compass-ring';
  body.appendChild(host);
  host.appendChild(buildCompassRing(room, cs));

  var hint = document.createElement('div');
  hint.className = 'ring-hint';
  var optimal = compassDistance(room.compass.from, room.compass.to);
  var left = compassDistance({ pc: cs.pc, mode: cs.mode }, room.compass.to);
  hint.textContent = '现在：' + keyLabel(cs) + '　目标：' + keyLabel(room.compass.to) +
    '　已走 ' + cs.path.length + ' 步' +
    (room.compass.showDistance ? ('　最少还要 ' + left + ' 步') : '');
  body.appendChild(hint);

  var ro = document.createElement('div');
  ro.className = 'ring-readout';
  if (cs.error) {
    ro.innerHTML = '<b>' + cs.error + '</b>';
  } else if (cs.path.length) {
    ro.textContent = '路线：' + cs.path.map(function (s) {
      return (s.mode === 'M' ? MAJOR_NAME[s.pc] : MINOR_NAME[s.pc]) + (s.via === 'relative' ? '（关系调）' : '');
    }).join(' → ');
  } else {
    ro.textContent = '点相邻的石头沿五度走，或者用下面的按钮换关系调。';
  }
  body.appendChild(ro);

  var items = [];
  if (cs.error) items.push({ label: '未通过', message: cs.error, cls: 'is-bad' });
  renderMarkList(items, '还没起步。');

  barUi.listen(mkBtn('试听当前调', 'btn', function () { ensureAudio(); playChord(tonicTriad(cs)); }));
  barUi.task(mkBtn('换关系调', 'btn', function () { compassFlip(room); }));
  barUi.task(mkBtn('重走', 'btn btn-quiet', function () {
    var s2 = compassState(room);
    s2.pc = room.compass.from.pc;
    s2.mode = room.compass.from.mode;
    s2.path = [];
    s2.error = null;
    renderRoom();
    saveState();
  }));
  barUi.submit(mkBtn('回环城', 'btn', function () { clearRoom(room); }));
}

/* ================= 15e. 节奏桥梁 ================= */

var TICK_LABEL = { 16: '全', 12: '附点二分', 8: '二分', 6: '附点四分', 4: '四分', 3: '附点八分', 2: '八分', 1: '十六分' };

function rhythmState(room) {
  if (!state.rhythm[room.id]) {
    state.rhythm[room.id] = {
      bars: (function () { var a = []; for (var i = 0; i < room.rhythm.bars; i++) a.push([]); return a; })(),
      active: 0,
      listened: false,
      checked: false,
      lastError: null
    };
  }
  return state.rhythm[room.id];
}

function barTicks(room) { return room.rhythm.ticksPerBar; }

function barSum(bar) {
  var t = 0;
  for (var i = 0; i < bar.length; i++) t += bar[i].len;
  return t;
}

/* 判定：全部用整数刻度，不做浮点累加 */
function judgeRhythm(room, bars) {
  var R = room.rhythm;
  var per = R.ticksPerBar;
  var errors = [];
  for (var b = 0; b < bars.length; b++) {
    var bar = bars[b];
    var sum = barSum(bar);
    if (sum < per) errors.push({ code: 'INCOMPLETE', bar: b, deficit: per - sum, message: '第 ' + (b + 1) + ' 小节还差 ' + (per - sum) + ' 个最小单位。' });
    if (sum > per) errors.push({ code: 'OVERFLOW', bar: b, excess: sum - per, message: '第 ' + (b + 1) + ' 小节多了 ' + (sum - per) + ' 个最小单位。' });

    var t = 0, onsets = [];
    for (var i = 0; i < bar.length; i++) {
      onsets.push(t);
      var start = t;
      t += bar[i].len;
      if (R.forbidCrossing) {
        for (var g = 1; g < R.groups.length; g++) {
          var boundary = 0;
          for (var k = 0; k < g; k++) boundary += R.groups[k];
          if (start < boundary && boundary < start + bar[i].len) {
            errors.push({ code: 'CROSS', bar: b, slot: i, at: boundary, message: '第 ' + (b + 1) + ' 小节第 ' + (i + 1) + ' 块跨过了组界（第 ' + boundary + ' 个最小单位处）。' });
          }
        }
      }
    }
    for (var r = 0; r < R.requireOnsets.length; r++) {
      var need = R.requireOnsets[r];
      if (onsets.indexOf(need) === -1) {
        errors.push({ code: 'GROUPING', bar: b, at: need, message: '第 ' + (b + 1) + ' 小节第 ' + (need + 1) + ' 个最小单位上没有落音，分组听不出来。' });
      }
    }
  }
  return { ok: errors.length === 0, errors: errors, first: errors.length ? errors[0] : null };
}

function rhythmSubmitCheck(room, st) {
  var j = judgeRhythm(room, st.bars);
  if (!st.listened) return { ok: false, code: 'NEED_LISTEN', message: '先点「试听整段」完整听一遍，再呈交。' };
  if (!j.ok) return { ok: false, code: j.first.code, message: j.first.message };
  return { ok: true };
}

/* 播放：遇到第一个断点就停，把问题听出来 */
function playRhythm(room, st, opts) {
  opts = opts || {};
  var c = ensureAudio();
  if (!c) return 0;
  var R = room.rhythm;
  var per = R.ticksPerBar;
  var t0 = c.currentTime + 0.08;
  var unit = 0.1;
  var stopBar = opts.stopAtError ? -1 : -2;
  if (opts.stopAtError) {
    var j = judgeRhythm(room, st.bars);
    if (j.first) stopBar = j.first.bar;
  }
  var t = 0;
  for (var b = 0; b < st.bars.length; b++) {
    if (b === stopBar && opts.stopAtError) break;
    var bar = st.bars[b];
    var local = 0;
    for (var i = 0; i < bar.length; i++) {
      var p = bar[i];
      if (!p.rest) {
        var accent = R.requireOnsets.indexOf(local) !== -1;
        tone(accent ? 88 : 81, t0 + (t + local) * unit, 0.085, accent ? 0.16 : 0.1);
      }
      local += p.len;
    }
    t += per;
  }
  return t * unit;
}

function rhythmPlace(room, len, rest) {
  var st = rhythmState(room);
  var per = barTicks(room);
  var b = st.active;
  var used = barSum(st.bars[b]);
  if (used + len > per) {
    st.lastError = '第 ' + (b + 1) + ' 小节只剩 ' + (per - used) + ' 个最小单位，放不下 ' + len + '。先撤销，或换一块小的。';
    renderRoom();
    saveState();
    return;
  }
  st.bars[b].push({ len: len, rest: !!rest });
  st.checked = false;
  if (barSum(st.bars[b]) === per) {
    for (var i = 0; i < st.bars.length; i++) {
      if (barSum(st.bars[i]) < per) { st.active = i; break; }
    }
  }
  st.lastError = null;
  renderRoom();
  saveState();
}

function rhythmUndo(room) {
  var st = rhythmState(room);
  st.bars[st.active].pop();
  st.checked = false;
  st.lastError = null;
  renderRoom();
  saveState();
}

function rhythmClearBar(room) {
  var st = rhythmState(room);
  st.bars[st.active] = [];
  st.checked = false;
  st.lastError = null;
  renderRoom();
  saveState();
}

function rhythmSubmit(room) {
  var st = rhythmState(room);
  st.checked = true;
  var r = rhythmSubmitCheck(room, st);
  if (!r.ok) {
    st.lastError = r.message;
    renderRoom();
    setSubmitMsg(r.message);
    saveState();
    return;
  }
  playRhythm(room, st, { stopAtError: false });
  passRoom(room);
  var total = 0;
  for (var i = 0; i < st.bars.length; i++) total += barSum(st.bars[i]);
  setTimeout(function () {
    showVerdict({
      eyebrow: '接上了',
      title: room.title + ' · 桥通了',
      paras: ['两小节各 ' + barTicks(room) + ' 个最小单位，一共 ' + total + ' 格，一格不多一格不少。'],
      actions: [{ label: '回环城', cls: 'btn btn-ink', fn: function () { hideVerdict(); clearRoom(room); } }]
    });
  }, 700);
  saveState();
}

function renderRhythmRoom(room, body, barUi) {
  var st = rhythmState(room);
  var R = room.rhythm;
  var per = R.ticksPerBar;

  var host = document.createElement('div');
  host.className = 'rhythm-host';
  body.appendChild(host);

  st.bars.forEach(function (bar, bi) {
    var row = document.createElement('div');
    row.className = 'rb-row' + (bi === st.active ? ' is-active' : '') +
      (state.diff && state.diff.bar === bi ? ' is-diff' : '');

    var head = document.createElement('div');
    head.className = 'rb-head';
    var name = document.createElement('span');
    name.textContent = '第 ' + (bi + 1) + ' 小节';
    var left = document.createElement('span');
    var used = barSum(bar);
    var rest = per - used;
    left.className = 'rb-left' + (rest < 0 ? ' is-over' : rest === 0 ? ' is-full' : '');
    left.textContent = rest > 0 ? ('还差 ' + rest) : rest === 0 ? '满了' : ('多了 ' + (-rest));
    head.appendChild(name);
    head.appendChild(left);
    row.appendChild(head);

    var track = document.createElement('div');
    track.className = 'rb-track';
    track.setAttribute('data-bar', String(bi));
    track.addEventListener('click', function () {
      st.active = bi;
      renderRoom();
    });

    for (var g = 1; g < R.groups.length; g++) {
      var boundary = 0;
      for (var k = 0; k < g; k++) boundary += R.groups[k];
      var div = document.createElement('span');
      div.className = 'rb-div';
      div.style.left = (boundary / per * 100) + '%';
      track.appendChild(div);
    }

    if (!bar.length) {
      var empty = document.createElement('span');
      empty.className = 'rb-empty';
      empty.textContent = '空桥';
      track.appendChild(empty);
    }
    bar.forEach(function (p, pi) {
      var plank = document.createElement('span');
      plank.className = 'rb-plank' + (p.rest ? ' is-rest' : '');
      plank.style.width = (p.len / per * 100) + '%';
      plank.title = (p.rest ? '休止·' : '') + TICK_LABEL[p.len] + '（' + p.len + ' 单位）';
      plank.textContent = p.rest ? '休' : String(p.len);
      track.appendChild(plank);
    });
    row.appendChild(track);
    host.appendChild(row);
  });

  var pal = document.createElement('div');
  pal.className = 'rhythm-palette';
  var noteRow = document.createElement('div');
  noteRow.className = 'rp-row';
  var noteLabel = document.createElement('span');
  noteLabel.className = 'rp-label';
  noteLabel.textContent = '音符';
  noteRow.appendChild(noteLabel);
  R.palette.forEach(function (len) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'rp-tile';
    b.textContent = TICK_LABEL[len] + ' ' + len;
    b.style.minWidth = (34 + len * 4) + 'px';
    b.addEventListener('click', function () { rhythmPlace(room, len, false); });
    noteRow.appendChild(b);
  });
  pal.appendChild(noteRow);

  if (R.allowRests) {
    var restRow = document.createElement('div');
    restRow.className = 'rp-row';
    var rl = document.createElement('span');
    rl.className = 'rp-label';
    rl.textContent = '休止';
    restRow.appendChild(rl);
    R.palette.forEach(function (len) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rp-tile is-rest';
      b.textContent = '休 ' + TICK_LABEL[len] + ' ' + len;
      b.addEventListener('click', function () { rhythmPlace(room, len, true); });
      restRow.appendChild(b);
    });
    pal.appendChild(restRow);
  }
  body.appendChild(pal);

  var hint = document.createElement('div');
  hint.className = 'ring-hint';
  var j = judgeRhythm(room, st.bars);
  hint.textContent = st.lastError ? st.lastError : (j.ok ? '两小节都满了，先听一遍再呈交。' : '点一个小节选中它，再从素材板挑时值铺上去。');
  body.appendChild(hint);

  var items = [];
  if (st.checked && st.lastError) items.push({ label: '未通过', message: st.lastError, cls: 'is-bad' });
  renderMarkList(items, '桥还没铺。');

  barUi.listen(mkBtn('试听整段', 'btn', function () {
    var s2 = rhythmState(room);
    s2.listened = true;
    ensureAudio();
    playRhythm(room, s2, { stopAtError: false });
    renderRoom();
    saveState();
  }));
  barUi.task(mkBtn('撤销一块', 'btn', function () { rhythmUndo(room); }));
  barUi.task(mkBtn('清空这一小节', 'btn btn-quiet', function () { rhythmClearBar(room); }));
  barUi.submit(mkBtn('呈交乐长', 'btn btn-ink', function () { rhythmSubmit(room); }));
}

/* ================= 15c. 化身、印记与校记 ================= */

var SKIN = ['#f0d3bb', '#dfae8a', '#b47a54', '#6f4a34'];
var CLOTH = ['#a3392a', '#2f5d63', '#8a6d3b', '#3b342c'];
var HAIR = ['#211c18', '#5b3a24', '#a8843f', '#8d8272'];
var HAIR_NAME = ['短发', '圆顶', '长发', '束发'];
var BODY_NAME = ['直身', '外套', '长袍'];
var SEAL_NAME = ['方印', '圆印', '三线', '点印', '角印', '弧印'];

var AVATAR_DEFAULT = { body: 0, hair: 0, skin: 1, cloth: 0, seal: 0 };

var DISTRICT_MARK = {
  quarry: { name: '音阶', glyph: 'M4 16 L16 4 L28 16' },
  masonry: { name: '对位', glyph: 'M4 6 H28 M4 16 H28 M4 26 H28' },
  hall: { name: '和声', glyph: 'M6 24 L12 6 L18 24 L24 6' },
  works: { name: '曲式', glyph: 'M4 14 H12 V6 H20 V14 H28 V26 H4 Z' },
  frontier: { name: '后调性', glyph: 'M14 4 L26 26 H2 Z' },
  market: { name: '流行', glyph: 'M6 22 C10 6 22 6 26 22' }
};

function avatarOf() {
  var a = state.avatar || {};
  return {
    body: Number.isInteger(a.body) ? a.body : AVATAR_DEFAULT.body,
    hair: Number.isInteger(a.hair) ? a.hair : AVATAR_DEFAULT.hair,
    skin: Number.isInteger(a.skin) ? a.skin : AVATAR_DEFAULT.skin,
    cloth: Number.isInteger(a.cloth) ? a.cloth : AVATAR_DEFAULT.cloth,
    seal: Number.isInteger(a.seal) ? a.seal : AVATAR_DEFAULT.seal
  };
}

function sealGlyph(av) {
  var s = av.seal;
  if (s === 0) return 'M7 7 H25 V25 H7 Z';
  if (s === 1) return 'M16 5 A11 11 0 1 1 15.9 5 Z';
  if (s === 2) return 'M6 11 H26 M6 16 H26 M6 21 H26';
  if (s === 3) return 'M16 9 A3.5 3.5 0 1 1 15.9 9 Z';
  if (s === 4) return 'M6 24 L16 7 L26 24 Z';
  return 'M6 24 C10 8 22 8 26 24';
}

function avatarSVG(av, size) {
  av = av || avatarOf();
  size = size || 96;
  var ns = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 64 96');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(Math.round(size * 1.5)));
  svg.setAttribute('class', 'avatar-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', '记谱学徒的化身');

  function add(tag, attrs) {
    var el = document.createElementNS(ns, tag);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) el.setAttribute(k, attrs[k]);
    svg.appendChild(el);
    return el;
  }

  var ink = '#211c18';
  var bodyFill = CLOTH[av.cloth % CLOTH.length];
  var skinFill = SKIN[av.skin % SKIN.length];
  var hairFill = HAIR[av.hair % HAIR.length];

  /* 身体：三种轮廓 */
  if (av.body === 0) {
    add('path', { d: 'M22 44 H42 L45 78 H19 Z', fill: bodyFill, stroke: ink, 'stroke-width': 1.6 });
  } else if (av.body === 1) {
    add('path', { d: 'M22 44 H42 L48 80 H16 Z', fill: bodyFill, stroke: ink, 'stroke-width': 1.6 });
    add('path', { d: 'M32 44 V80', stroke: ink, 'stroke-width': 1, 'stroke-dasharray': '2 3' });
  } else {
    add('path', { d: 'M23 44 H41 L49 82 H15 Z', fill: bodyFill, stroke: ink, 'stroke-width': 1.6 });
    add('path', { d: 'M26 52 H38 M24 62 H40 M22 72 H42', stroke: 'rgba(33,28,24,.35)', 'stroke-width': 1 });
  }

  /* 脖子与头 */
  add('rect', { x: 29, y: 38, width: 6, height: 8, fill: skinFill, stroke: ink, 'stroke-width': 1.2 });
  add('circle', { cx: 32, cy: 28, r: 13, fill: skinFill, stroke: ink, 'stroke-width': 1.6 });

  /* 五官：两点一线，保持中性 */
  add('circle', { cx: 27, cy: 27, r: 1.3, fill: ink });
  add('circle', { cx: 37, cy: 27, r: 1.3, fill: ink });
  add('path', { d: 'M28 33 Q32 35 36 33', fill: 'none', stroke: ink, 'stroke-width': 1.1 });

  /* 头发：四种 */
  if (av.hair === 0) {
    add('path', { d: 'M19 26 Q20 12 32 12 Q44 12 45 26 Q40 20 32 20 Q24 20 19 26 Z', fill: hairFill, stroke: ink, 'stroke-width': 1.2 });
  } else if (av.hair === 1) {
    add('path', { d: 'M18 27 Q18 11 32 11 Q46 11 46 27 Q46 17 32 17 Q18 17 18 27 Z', fill: hairFill });
  } else if (av.hair === 2) {
    add('path', { d: 'M18 26 Q18 10 32 10 Q46 10 46 26 L46 52 Q42 52 42 40 L40 22 Q32 18 24 22 L22 40 Q22 52 18 52 Z', fill: hairFill, stroke: ink, 'stroke-width': 1.1 });
  } else {
    add('path', { d: 'M19 25 Q21 12 32 12 Q43 12 45 25 Q38 19 32 19 Q26 19 19 25 Z', fill: hairFill, stroke: ink, 'stroke-width': 1.2 });
    add('circle', { cx: 45, cy: 20, r: 4, fill: hairFill, stroke: ink, 'stroke-width': 1.1 });
  }

  /* 个人符号：胸前的小印 */
  add('path', {
    d: sealGlyph(av), fill: 'none', stroke: '#f3ede0',
    'stroke-width': 1.6, 'stroke-linecap': 'round',
    transform: 'translate(18 52) scale(0.42)'
  });
  return svg;
}

function markSVG(did, size) {
  var m = DISTRICT_MARK[did];
  if (!m) return null;
  var ns = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('width', String(size || 18));
  svg.setAttribute('height', String(size || 18));
  svg.setAttribute('class', 'mark-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', m.name + '印记');
  var p = document.createElementNS(ns, 'path');
  p.setAttribute('d', m.glyph);
  p.setAttribute('fill', 'none');
  p.setAttribute('stroke', 'currentColor');
  p.setAttribute('stroke-width', '2');
  p.setAttribute('stroke-linecap', 'round');
  p.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(p);
  return svg;
}

function markRow(size) {
  var wrap = document.createElement('div');
  wrap.className = 'mark-row';
  Object.keys(DISTRICT_MARK).forEach(function (did) {
    var on = !!(state.seals && state.seals[did]);
    var slot = document.createElement('span');
    slot.className = 'mark-slot' + (on ? ' is-on' : '');
    slot.title = DISTRICT_MARK[did].name + (on ? '：已获得' : '：未获得');
    var g = markSVG(did, size || 18);
    if (g) slot.appendChild(g);
    wrap.appendChild(slot);
  });
  return wrap;
}

/* ---------- 形象定制 ---------- */

var creatorOpen = false;

/* 可复现的伪随机：同一 seed 必得同一化身，便于测试与「换一个」重放。
   不是密码学随机，只保证组合合法、分布均匀。 */
function mulberry32(a) {
  a = a >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomSeed() {
  return (Math.random() * 4294967296) >>> 0;
}

function makeAvatar(seed) {
  var rnd = mulberry32(seed);
  var pick = function (n) { return Math.floor(rnd() * n) % n; };
  return {
    body: pick(3),
    hair: pick(4),
    skin: pick(4),
    cloth: pick(4),
    seal: pick(6)
  };
}

function ensureAvatar() {
  if (state.avatar) return;
  if (!Number.isInteger(state.avatarSeed)) state.avatarSeed = randomSeed();
  state.avatar = makeAvatar(state.avatarSeed);
  saveState();
}

function randomizeAvatar() {
  state.avatarSeed = randomSeed();
  state.avatar = makeAvatar(state.avatarSeed);
  saveState();
}

function renderCreator(host, onDone) {
  ensureAvatar();
  var av = avatarOf();
  host.innerHTML = '';
  var box = document.createElement('div');
  box.className = 'creator';
  host.appendChild(box);

  var head = document.createElement('div');
  head.className = 'creator-head';
  head.textContent = '捏一个纸偶';
  box.appendChild(head);

  var cols = document.createElement('div');
  cols.className = 'creator-cols';

  var preview = document.createElement('div');
  preview.className = 'creator-preview';
  preview.appendChild(avatarSVG(av, 96));
  cols.appendChild(preview);

  var opts = document.createElement('div');
  opts.className = 'creator-opts';

  function row(label, key, values, names) {
    var r = document.createElement('div');
    r.className = 'creator-row';
    var l = document.createElement('span');
    l.className = 'creator-label';
    l.textContent = label;
    r.appendChild(l);
    var group = document.createElement('div');
    group.className = 'creator-swatches';
    values.forEach(function (v, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch' + (av[key] === i ? ' is-on' : '');
      b.setAttribute('aria-label', label + '：' + (names ? names[i] : String(i + 1)));
      b.setAttribute('aria-pressed', av[key] === i ? 'true' : 'false');
      if (typeof v === 'string' && v.charAt(0) === '#') {
        b.style.background = v;
      } else if (key === 'seal') {
        var ns = 'http://www.w3.org/2000/svg';
        var gs = document.createElementNS(ns, 'svg');
        gs.setAttribute('viewBox', '0 0 32 32');
        gs.setAttribute('width', '16');
        gs.setAttribute('height', '16');
        gs.setAttribute('class', 'swatch-glyph');
        var gp = document.createElementNS(ns, 'path');
        gp.setAttribute('d', sealGlyph({ seal: i }));
        gp.setAttribute('fill', 'none');
        gp.setAttribute('stroke', 'currentColor');
        gp.setAttribute('stroke-width', '2.2');
        gp.setAttribute('stroke-linecap', 'round');
        gs.appendChild(gp);
        b.appendChild(gs);
      } else {
        b.textContent = String(v);
      }
      b.addEventListener('click', function () {
        state.avatar = Object.assign({}, avatarOf(), (function () { var o = {}; o[key] = i; return o; })());
        saveState();
        renderCreator(host, onDone);
        if (typeof onDone === 'function') onDone();
      });
      group.appendChild(b);
    });
    r.appendChild(group);
    opts.appendChild(r);
  }

  row('体态', 'body', ['直身', '外套', '长袍']);
  row('发型', 'hair', HAIR, HAIR_NAME);
  row('肤色', 'skin', SKIN);
  row('衣服', 'cloth', CLOTH);
  row('符号', 'seal', [0, 1, 2, 3, 4, 5], SEAL_NAME);

  cols.appendChild(opts);
  box.appendChild(cols);

  var foot = document.createElement('div');
  foot.className = 'creator-foot';
  var done = document.createElement('button');
  done.type = 'button';
  done.className = 'btn btn-ink';
  done.textContent = '就这样';
  done.addEventListener('click', function () {
    creatorOpen = false;
    state.avatarConfirmed = true;
    saveState();
    if (typeof onDone === 'function') onDone();
  });
  foot.appendChild(done);
  box.appendChild(foot);
}

/* ---------- 分级提示 ---------- */

function nextHint(room) {
  ensureAvatar();
  var tier = state.hintTier[room.id] || 0;
  var p = roomProgress(room);
  var out;
  if (tier === 0) {
    out = { text: '这一关要做的是：' + guideFor(room).goal, tier: 1, focus: null };
  } else if (tier === 1) {
    out = { text: '看这里：' + (p.next || '按任务卡上的步骤走。'), tier: 2, focus: focusTarget(room) };
  } else {
    out = { text: '先做这一步：' + (p.next || '按任务卡上的步骤走。') + ' 具体选哪个，我不替你看。', tier: 3, focus: focusTarget(room) };
  }
  return out;
}

function focusTarget(room) {
  if (room.kind === 'counterpoint') return '.palette';
  if (room.kind === 'scale' || room.kind === 'set') return '.ring-host';
  if (room.kind === 'harmony' || room.kind === 'pop') return '.ledger-options';
  if (room.kind === 'form') return '.form-host';
  if (room.kind === 'compass') return '.compass-ring';
  if (room.kind === 'rhythm') return '.rhythm-host';
  return null;
}

function useHint(room) {
  var h = nextHint(room);
  state.hintTier[room.id] = h.tier;
  noteHintUse(room);
  saveState();

  var line = document.getElementById('avatarSay');
  if (line) line.textContent = h.text;

  var work = document.querySelector('.work-area');
  if (work) {
    work.querySelectorAll('.hint-focus').forEach(function (el) { el.classList.remove('hint-focus'); });
    if (h.focus) {
      var t = work.querySelector(h.focus);
      if (t) t.classList.add('hint-focus');
    }
  }
}

/* ---------- 城区校记 ---------- */

var RECORD_OPTIONS = [
  { key: '修正', line: '照他的写法改，把这一页改成规范的。' },
  { key: '保留', line: '原样留着，错处也是这一页的一部分。' },
  { key: '并记', line: '两种写法并排记下，谁对谁错留给以后。' },
  { key: '留白', line: '什么也不写，空着。' }
];

function maybeRecordBeat(room) {
  var did = room.district;
  if (!state.seals[did]) return false;
  if (state.records[did]) return false;
  state.records[did] = { pending: true };
  saveState();
  showRecordBeat(did);
  return true;
}

function showRecordBeat(did) {
  var d = districtById(did);
  var mark = DISTRICT_MARK[did];
  $('verdictEyebrow').textContent = '校记';
  $('verdictTitle').textContent = d.name + ' · 一方印';
  var body = $('verdictBody');
  body.innerHTML = '';

  var intro = document.createElement('p');
  intro.textContent = d.char + '把这一区最后一张纸推过来：' + (mark ? mark.name + '这一门，你打算怎么记？' : '你打算怎么记？');
  body.appendChild(intro);

  var ul = document.createElement('ul');
  ul.className = 'teach-list record-list';
  RECORD_OPTIONS.forEach(function (o) {
    var li = document.createElement('li');
    li.textContent = o.key + '：' + o.line;
    ul.appendChild(li);
  });
  body.appendChild(ul);

  var actions = $('sheetActions');
  actions.innerHTML = '';
  RECORD_OPTIONS.forEach(function (o) {
    actions.appendChild(mkBtn(o.key, 'btn', function () {
      state.records[did] = { choice: o.key, finalized: true };
      saveState();
      hideVerdict();
      renderMap();
      if (endingEligible() && !state.signed) setTimeout(showEnding, 320);
    }));
  });

  $('veil').hidden = false;
}

/* ================= 15b. 落地页、路由与存档 ================= */

function hasSave(s) {
  s = s || state;
  if (!s) return false;
  if (s.started) return true;
  if (s.signed) return true;
  return Object.keys(s.cleared || {}).length > 0;
}

function ctaLabel(has) {
  return has ? '继续旅程' : '开始旅程';
}

/* 决定开机落在哪一页：没有存档就必须先看落地页；有存档就回到上次的合理页面 */
function routeOnBoot(s) {
  if (!hasSave(s)) return 'landing';
  if (s.view === 'room' && s.roomId && ROOM_INDEX[s.roomId]) return 'room';
  if (s.view === 'landing') return 'landing';
  return 'map';
}

function renderLanding() {
  stopDrone();
  state.view = 'landing';
  $('viewLanding').hidden = false;
  $('viewMap').hidden = true;
  $('viewRoom').hidden = true;
  $('btnBackMap').hidden = true;
  $('btnLanding').hidden = true;
  $('resetConfirm').hidden = true;
  $('sealCount').textContent = String(Object.keys(state.seals || {}).filter(function (k) { return state.seals[k]; }).length);
  $('sealTotal').textContent = String(DISTRICTS.filter(function (d) { return playableRoomsOfDistrict(d.id).length > 0; }).length);

  var start = $('btnStart');
  start.textContent = ctaLabel(hasSave());
  start.focus();

  var avHost = $('landingAvatar');
  if (avHost) {
    avHost.innerHTML = '';
    ensureAvatar();
    if (creatorOpen) {
      renderCreator(avHost, function () { renderLanding(); });
    } else {
      var arow = document.createElement('div');
      arow.className = 'landing-av-row';
      arow.appendChild(avatarSVG(avatarOf(), 72));
      var side = document.createElement('div');
      side.className = 'landing-av-side';
      var nm = document.createElement('div');
      nm.className = 'landing-av-name';
      nm.textContent = '记谱学徒';
      var sub = document.createElement('div');
      sub.className = 'landing-av-sub';
      var got = Object.keys(state.seals || {}).filter(function (k) { return state.seals[k]; }).length;
      sub.textContent = got ? ('已经拿到 ' + got + ' / 6 枚印记') : '还没有印记，先从一个城区开始。';
      side.appendChild(nm);
      side.appendChild(sub);
      side.appendChild(markRow(16));

      var avActions = document.createElement('div');
      avActions.className = 'avatar-actions';
      var reroll = document.createElement('button');
      reroll.type = 'button';
      reroll.className = 'btn btn-mini';
      reroll.textContent = '换一个随机形象';
      reroll.addEventListener('click', function () { randomizeAvatar(); renderLanding(); });
      var edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn btn-mini btn-quiet';
      edit.textContent = '改形象';
      edit.addEventListener('click', function () { creatorOpen = true; renderLanding(); });
      avActions.appendChild(reroll);
      avActions.appendChild(edit);
      side.appendChild(avActions);
      arow.appendChild(side);
      avHost.appendChild(arow);
    }
  }

  var list = $('landingDistrictList');
  list.innerHTML = '';
  DISTRICTS.forEach(function (d) {
    var playable = playableRoomsOfDistrict(d.id);
    var done = playable.filter(function (r) { return state.cleared[r.id]; }).length;
    var li = document.createElement('li');
    li.className = 'ld-row';
    var name = document.createElement('b');
    name.textContent = d.name;
    var meta = document.createElement('span');
    meta.className = 'ld-meta';
    meta.textContent = playable.length
      ? ('可玩 ' + playable.length + ' 间' + (done ? '，已校 ' + done : ''))
      : '仅讲解';
    li.appendChild(name);
    li.appendChild(meta);
    list.appendChild(li);
  });

  saveState();
}

function resetProgress() {
  state.cp = {};
  state.scale = {};
  state.harmony = {};
  state.set = {};
  state.pop = {};
  state.form = {};
  state.cleared = {};
  state.seals = {};
  state.signed = null;
  state.avatar = null;
  state.avatarSeed = null;
  state.avatarConfirmed = false;
  state.warmupDone = false;
  state.roomId = null;
  state.district = 'quarry';
  state.started = false;
  state.view = 'landing';
  state.marks = {};
  state.activeSlot = 0;
  try { window.localStorage.removeItem(STORE_KEY); } catch (e) { /* 忽略 */ }
  renderLanding();
}

function openGeneralHelp() {
  $('teachWho').textContent = '怎么玩';
  $('teachTitle').textContent = '五种动作与判定';
  var body = $('teachBody');
  body.innerHTML = '';

  var p = document.createElement('p');
  p.className = 'help-goal';
  p.textContent = '每一间房首屏都有一张任务卡，写着目标、步骤和完成条件。这里把它们放在一起，方便随时回看。';
  body.appendChild(p);

  var specs = [
    { k: 'scale', t: '拼：在五度环上选石', d: '选出七个音，再点一块定主音。判定看音级集合与主音是否都对。' },
    { k: 'counterpoint', t: '补：补上第二声部', d: '每格放一个音，页边实时标出违反的规矩。整页零违例才算过。' },
    { k: 'harmony', t: '平：给乐句续和弦', d: '属功能之后不能退回下属，导音要上行、七音要下行。每一笔都合法才算过。' },
    { k: 'set', t: '测：量一组音', d: '正常序要转到跨度最小的位置；共同音要找出两组共有的音。' },
    { k: 'form', t: '听：在时间轴上标结构', d: '先听，再贴段落标签、点结构点或切分界。标签与位置全对才算过。' }
  ];
  var ul = document.createElement('ul');
  ul.className = 'teach-list';
  specs.forEach(function (s) {
    var li = document.createElement('li');
    var b = document.createElement('b');
    b.textContent = s.t + '：';
    li.appendChild(b);
    li.appendChild(document.createTextNode(s.d));
    ul.appendChild(li);
  });
  body.appendChild(ul);

  var q = document.createElement('blockquote');
  q.className = 'teach-quote';
  q.textContent = '页面不会自动发声。第一次点按钮之后浏览器才会解锁音频，建议戴耳机。';
  body.appendChild(q);

  $('teachVeil').hidden = false;
}

/* ================= 16. 视图：房间 ================= */

function enterRoom(id) {
  var room = ROOM_INDEX[id];
  if (!room) return;
  state.roomId = id;
  state.view = 'room';
  state.district = room.district;
  if (!(state.tour && state.tour.active)) {
    state.evidence[id] = { hints: 0, faults: 0 };
    state._faultFlag = false;
  }
  renderRoom();
  if (!state.warmupDone) openWarmup();
  saveState();
}

function charLineFor(room) {
  if (state.cleared[room.id] && room.kind !== 'locked') {
    return '这一页你已经校过了。要重抄一遍，我陪着。';
  }
  return room.line;
}

/* ================= 16a. 任务引导：目标、步骤、完成条件 ================= */

var GUIDES = {
  'r-c-major': {
    goal: '在五度环上把 C 大调要用的七块石头选出来，再指出哪一块是主音。',
    steps: ['先点「试听这组石」，听听已经选进来的音。', '在环上点七块石头，把它们选进来。', '七块齐了以后，点其中一块，把它定为主音。'],
    done: '七块石头正好是 C 大调那七块，主音定在 C。'
  },
  'r-g-major': {
    goal: '拼出 G 大调的七个音。这组石头里有一块必须升，找出是哪一块。',
    steps: ['先听一遍。', '选出七个音，注意第七级比 C 大调高半音。', '点一块已经亮的石头，把它定为主音。'],
    done: '七个音是 G A B C D E F♯，主音定在 G。'
  },
  'r-d-dorian': {
    goal: '石头可以一块都不换，只换落脚点：把同一组七个音的主音定到 D。',
    steps: ['先选出 C 大调那七块石头。', '选够七块后，点 D 那块石头，把它定为主音。', '再听一遍，注意落点换了以后哪些音听起来变了角色。'],
    done: '七块石头与 C 大调相同，主音定在 D。'
  },
  'r-cp1': {
    goal: '给下面这条固定旋律补一条上方的第二声部，一个音对一个音。',
    steps: ['先点「试听固定旋律」，把它的形状听两遍。', '点一个空格子，再从音高条里选一个音；放错了按「抹掉此音」。', '页边会实时标出违反了哪条规矩，改到没有标记为止。'],
    done: '十个音全部放好，页边一条违例都没有。'
  },
  'r-cp2': {
    goal: '在 d 小调的固定旋律上方补第二声部。这条线里，导音只在收尾前出现。',
    steps: ['先听固定旋律。', '逐格放音，中途不要用升七级。', '最后两音走升七级到 do，和固定旋律反向收束。'],
    done: '十一个音全部放好，页边一条违例都没有。'
  },
  'r-cp3': {
    goal: '这次你在固定旋律的下方补声部。写在下面时，第一个音只能是 do。',
    steps: ['先听固定旋律。', '第一个音放 do，也就是纯一度或纯八度。', '后面每个音都要和上方的固定旋律合得上。'],
    done: '十二个音全部放好，页边一条违例都没有。'
  },
  'r-cp4': {
    goal: '一个固定旋律音对两个音。强拍必须协和，弱拍可以走不协和，但只能是经过音。',
    steps: ['先听固定旋律。', '每格放一个音：奇数格是强拍，偶数格是弱拍。', '弱拍出现不协和时，前后都要级进，不能跳进跳出。'],
    done: '十七个音全部放好，页边一条违例都没有。'
  },
  'r-func': {
    goal: '给乐句续和弦。属功能之后必须回主功能，不能退回下属。',
    steps: ['先点「试听上一笔」，听当前停在哪。', '从三个候选里挑一个能继续往下走的。', '选错会当场说明哪条账没平，可以直接重选。'],
    done: '三个乐句都续完，每一笔都合法。'
  },
  'r-debt': {
    goal: 'G 大调的属七欠两笔账：导音往上还，七音往下还。挑一个能同时还清的和弦。',
    steps: ['先听上一笔。', '找出同时含有主音和七音解决音的那个和弦。', '选错会告诉你哪一笔没还。'],
    done: '两个乐句都续完，每一笔都合法。'
  },
  'r-theme': {
    goal: '听八小节，判断前后两半各是什么，并指出半终止落在第几小节。',
    steps: ['点「试听全曲」。', '点上方一段，再点下方一个标签；两段都标。', '在下面的小节号上点出半终止。'],
    done: '两段标签都对，结构点落在第 4 小节。'
  },
  'r-sonata': {
    goal: '听十二小节，把四段分别标成主部、过渡、副部、结束部，并点出结构终止点。',
    steps: ['先听全曲，注意和声什么时候换到另一个调。', '逐段贴标签：点一段，再点一个标签。', '在小节号上点出副题真正收住的那一小节。'],
    done: '四段标签都对，结构点落在第 9 小节。'
  },
  'r-rondo': {
    goal: '听十五小节，在叠句原样回来的地方下刀，把它切成五段。',
    steps: ['先听全曲，记住第一段的样子。', '在小节线上点出分界，一共四条。', '点错了再点一次就能取消。'],
    done: '分界正好在第 4、7、10、13 小节之前。'
  },
  'r-normal': {
    goal: '把环上这四个音读成一个最紧凑的排列，并指出从哪个音起算最紧。',
    steps: ['先听这四个音。', '点一个已亮的音当起点，看下方算出的跨度。', '多换几个起点比一比，最紧的时候点「呈交」。'],
    done: '起点选对，跨度等于所有起点里最小的那个。'
  },
  'r-common': {
    goal: '两组音里，找出同时在两边的那几个音。',
    steps: ['先听第一组，再听第二组。', '在环上点出你认为是共同音的那些音。', '点错了再点一次可以取消。'],
    done: '点出的音正好等于两组的交集。'
  },
  'r-doowop': {
    goal: '四个和弦转一圈。按循环的顺序把接下来的和弦接上。',
    steps: ['先听这一段，记住这四个和弦的顺序。', '每一步从三个候选里挑循环中的下一个。', '接错会说明循环断在哪。'],
    done: '三步都接对，循环回到起点。'
  }
};

/* 把引导挂到房间上，便于测试与后续 UI 读取 */
ROOMS.forEach(function (r) { if (GUIDES[r.id]) r.guide = GUIDES[r.id]; });

var MECHANIC_HELP = {
  scale: '环上的十二块石头按纯五度排成一圈。点石头可以选中或取消；选够七块后，点其中一块把它定为主音。判定看两件事：选中的七块对不对，主音定得对不对。',
  counterpoint: '两条线：一条是已经写好的固定旋律，另一条等你填。点一个空格子选中它，再从音高条里挑一个音；放错了可以抹掉。每放一个音都会响，页边会告诉你违反了哪条规矩。',
  harmony: '账页上写着上一个和弦，你要挑下一个。三个候选里通常只有一个能把账平掉；选错会说明哪一条没过，可以重选。三个乐句都续完就过关。',
  set: '环上亮着的音是一个集合。正常序要把它转到一个最紧凑的位置；共同音则要找出两组共有的音。两种都以「点环上的石头」为唯一操作。',
  pop: '循环和声按固定顺序转圈。每一步挑循环里的下一个和弦；接错会把循环提前收束，界面会说明断在哪。',
  form: '时间轴上每一段代表若干小节。先听，再给段落贴标签、点出结构点，或在小节线上切分界。三种操作都只靠点击。',
  rhythm: '桥面按拍号切成最小单位。点一个小节选中它，再点素材板上的时值把桥板铺上去；铺满了会自动跳到下一小节。撤销只退当前小节最后一块，清空只清当前小节。',
  compass: '罗盘就是五度圈，每块石头是一个调号，上面写大调、下面写关系小调。点相邻的石头沿五度走一步，或者用「换关系调」在同一块石头上翻面。每走一步都会先响旧主和弦、再响新主和弦。',
  locked: '这一章只有讲解卡，没有可玩任务。读完要点就算看完。'
};

function guideFor(room) {
  if (room.kind === 'locked') {
    return {
      goal: '这一章只提供讲解，没有可玩任务。',
      steps: ['点下方「这一章的讲解」读要点。', '想对照原文，看讲解卡里的出处。'],
      done: '读完即可，不用完成任何操作。'
    };
  }
  return room.guide || GUIDES[room.id] || {
    goal: '完成这一页的练习。',
    steps: ['先听材料。', '按页面提示操作。', '完成后提交。'],
    done: '页面没有违例时即可提交。'
  };
}

function roomProgress(room) {
  var out = { progress: '', next: '', ready: true, hint: '' };

  if (room.kind === 'counterpoint') {
    var lv = LEVELS[room.cp], c = cpState(room);
    var total = totalSlots(lv), filled = 0;
    c.slots.forEach(function (x) { if (x != null) filled++; });
    var left = total - filled;
    out.progress = '已放 ' + filled + ' / ' + total + ' 个音';
    out.next = left
      ? '点第 ' + (c.activeSlot + 1) + ' 格，再从音高条里选一个音。'
      : '点「呈交乐长」验收整页。';
    out.ready = left === 0;
    out.hint = left ? ('还差 ' + left + ' 个音才能呈交') : '可以提交了';
    return out;
  }

  if (room.kind === 'scale') {
    var s = scaleState(room);
    out.progress = '已选 ' + s.sel.length + ' / 7 块石，' + (s.tonic != null ? '主音 ' + NAMES[s.tonic] : '主音未定');
    if (s.sel.length < 7) out.next = '在环上点石头，把要用的音选进来。';
    else if (s.tonic == null) out.next = '点一块已经亮的石头，把它定为主音。';
    else out.next = '点「呈交」看结果。';
    out.ready = s.sel.length === 7 && s.tonic != null;
    out.hint = s.sel.length < 7
      ? ('还差 ' + (7 - s.sel.length) + ' 块石')
      : (s.tonic == null ? '还没定主音' : '可以提交了');
    return out;
  }

  if (room.kind === 'harmony') {
    var h = harmonyState(room), n = room.situations.length;
    out.progress = '第 ' + Math.min(h.step + 1, n) + ' / ' + n + ' 笔';
    out.next = h.step < n ? '在下面三个和弦里挑一个能平的。' : '已经续完了。';
    out.ready = h.step >= n;
    out.hint = '选完最后一笔自动结算，不用点提交';
    return out;
  }

  if (room.kind === 'set') {
    var st = setState(room);
    if (room.mode === 'normal') {
      if (st.start == null) {
        out.progress = '还没起算';
        out.next = '点一个已经亮的音当起点。';
        out.hint = '先选一个起点';
      } else {
        var info = orderFrom(room.members, st.start);
        out.progress = '从 ' + NAMES[st.start] + ' 起算，跨度 ' + info.span;
        out.next = '换几个起点比一比，最紧的时候点「呈交」。';
        out.hint = st.attempts ? '再试一次' : '可以提交了';
      }
      out.ready = st.start != null;
    } else {
      out.progress = '已点 ' + st.picked.length + ' 个音';
      out.next = st.picked.length ? '点「呈交」检查交集。' : '点出同时在两组里的音。';
      out.ready = st.picked.length > 0;
      out.hint = st.picked.length ? '可以提交了' : '还没点任何音';
    }
    return out;
  }

  if (room.kind === 'pop') {
    var p = popState(room);
    out.progress = '第 ' + Math.min(p.step + 1, room.rounds) + ' / ' + room.rounds + ' 步';
    out.next = p.step < room.rounds ? '选循环里的下一个和弦。' : '循环接上了。';
    out.ready = p.step >= room.rounds;
    out.hint = '接上最后一步自动结算，不用点提交';
    return out;
  }

  if (room.kind === 'rhythm') {
    var rs = rhythmState(room);
    var perB = barTicks(room);
    var filled = 0;
    rs.bars.forEach(function (b) { filled += barSum(b); });
    var totalB = perB * rs.bars.length;
    out.progress = '已铺 ' + filled + ' / ' + totalB + ' 个最小单位';
    if (!rs.listened) out.next = '先点「试听整段」听一遍，再开始铺。';
    else if (filled < totalB) out.next = '点小节选中它，挑时值铺上去；铺满会自动跳下一小节。';
    else out.next = '点「呈交乐长」看桥通不通。';
    var jr = judgeRhythm(room, rs.bars);
    out.ready = jr.ok && rs.listened;
    out.hint = !rs.listened
      ? '还没试听'
      : (jr.ok ? '可以提交了' : jr.first.message);
    return out;
  }

  if (room.kind === 'compass') {
    var cp = compassState(room);
    var left = compassDistance({ pc: cp.pc, mode: cp.mode }, room.compass.to);
    out.progress = '现在 ' + keyLabel(cp) + '，已走 ' + cp.path.length + ' 步';
    out.next = left ? '点相邻的石头沿五度走一步，或用「换关系调」翻到关系调。' : '已经到目标调。';
    out.ready = false;
    out.hint = '走到目标调自动结算';
    return out;
  }

  if (room.kind === 'form') {
    var f = room.form, fs = formState(room);
    if (f.mode === 'boundary') {
      var need = f.boundaries.length;
      out.progress = '已放 ' + fs.boundaries.length + ' / ' + need + ' 条分界';
      out.next = fs.boundaries.length < need ? '在小节线上点出分界。' : '点「呈交伊莲」看结果。';
      out.ready = fs.boundaries.length > 0;
      out.hint = fs.boundaries.length ? '可以提交了' : '还没有分界';
    } else {
      var n2 = f.segments.length, labeled = 0;
      for (var i = 0; i < n2; i++) if (fs.labels[i] != null) labeled++;
      var pt = f.point;
      out.progress = '已标 ' + labeled + ' / ' + n2 + ' 段' + (pt ? (fs.point != null ? '，结构点已标' : '，结构点未标') : '');
      if (labeled < n2) out.next = '点上方一段，再点下方一个标签。';
      else if (pt && fs.point == null) out.next = '在下面的小节号上点出' + pt.name + '。';
      else out.next = '点「呈交伊莲」看结果。';
      out.ready = labeled === n2 && (!pt || fs.point != null);
      out.hint = out.ready ? '可以提交了' : ('还差 ' + (n2 - labeled) + ' 段' + (pt && fs.point == null ? '和一个结构点' : ''));
    }
    return out;
  }

  out.hint = '读完即可';
  return out;
}

function buildMission(room, p) {
  var g = guideFor(room);
  var sec = document.createElement('section');
  sec.className = 'mission';

  var head = document.createElement('div');
  head.className = 'mission-head';
  head.textContent = room.kind === 'locked' ? '这一页' : '本关任务';
  sec.appendChild(head);

  var goal = document.createElement('p');
  goal.className = 'mission-goal';
  goal.textContent = g.goal;
  sec.appendChild(goal);

  if (room.plain) {
    var plain = document.createElement('p');
    plain.className = 'mission-plain';
    plain.textContent = room.plain;
    sec.appendChild(plain);
  }

  if (g.steps && g.steps.length) {
    var ol = document.createElement('ol');
    ol.className = 'mission-steps';
    g.steps.forEach(function (s) {
      var li = document.createElement('li');
      li.textContent = s;
      ol.appendChild(li);
    });
    sec.appendChild(ol);
  }

  var done = document.createElement('p');
  done.className = 'mission-done';
  var dl = document.createElement('span');
  dl.className = 'm-label';
  dl.textContent = '完成条件';
  done.appendChild(dl);
  done.appendChild(document.createTextNode(g.done));
  sec.appendChild(done);

  if (room.kind !== 'locked') {
    var status = document.createElement('div');
    status.className = 'mission-status';
    var pg = document.createElement('span');
    pg.className = 'ms-progress';
    pg.textContent = p.progress;
    status.appendChild(pg);
    if (p.next) {
      var nx = document.createElement('span');
      nx.className = 'ms-next';
      nx.textContent = '下一步：' + p.next;
      status.appendChild(nx);
    }
    sec.appendChild(status);
  }
  return sec;
}

function buildActionBar(host, p) {
  function group(label) {
    var wrap = document.createElement('div');
    wrap.className = 'action-group';
    var l = document.createElement('span');
    l.className = 'group-label';
    l.textContent = label;
    var body = document.createElement('div');
    body.className = 'group-body';
    wrap.appendChild(l);
    wrap.appendChild(body);
    host.appendChild(wrap);
    return { wrap: wrap, body: body };
  }
  var listen = group('先听材料');
  var task = group('作答');
  var compare = group('对照');
  var submit = group('提交验收');

  var hint = document.createElement('span');
  hint.className = 'submit-hint';
  hint.textContent = p.hint || '';
  submit.body.appendChild(hint);

  return {
    listen: function (el) { if (el) listen.body.appendChild(el); },
    task: function (el) { if (el) task.body.appendChild(el); },
    submit: function (el) { if (el) submit.body.insertBefore(el, hint); },
    compare: function (el) { if (el) compare.body.appendChild(el); },
    finish: function () {
      if (!listen.body.children.length) listen.wrap.hidden = true;
      if (!task.body.children.length) task.wrap.hidden = true;
      if (!compare.body.children.length) compare.wrap.hidden = true;
      if (!submit.body.children.length) submit.wrap.hidden = true;
    }
  };
}

function setSubmitMsg(text) {
  var el = document.querySelector('.submit-hint');
  if (el) { el.textContent = text; el.classList.add('is-warn'); }
  var nx = document.querySelector('.ms-next');
  if (nx && text) nx.textContent = text;
}

function openHelp(room) {
  var g = guideFor(room);
  $('teachWho').textContent = '怎么玩 · ' + (room.kind === 'locked' ? '只读' : room.meta);
  $('teachTitle').textContent = room.title;
  var body = $('teachBody');
  body.innerHTML = '';

  var goal = document.createElement('p');
  goal.className = 'help-goal';
  goal.textContent = g.goal;
  body.appendChild(goal);

  var ol = document.createElement('ol');
  ol.className = 'teach-list';
  g.steps.forEach(function (s) {
    var li = document.createElement('li');
    li.textContent = s;
    ol.appendChild(li);
  });
  body.appendChild(ol);

  var done = document.createElement('p');
  done.className = 'help-done';
  done.textContent = '完成条件：' + g.done;
  body.appendChild(done);

  var how = document.createElement('blockquote');
  how.className = 'teach-quote';
  how.textContent = MECHANIC_HELP[room.kind] || MECHANIC_HELP.locked;
  body.appendChild(how);

  $('teachVeil').hidden = false;
}

function renderRoom() {
  stopFormAnim();
  stopDrone();
  var room = ROOM_INDEX[state.roomId];
  if (!room) { renderMap(); return; }
  state.view = 'room';
  $('viewLanding').hidden = true;
  $('viewMap').hidden = true;
  $('viewRoom').hidden = false;
  $('btnBackMap').hidden = false;
  $('btnLanding').hidden = true;

  $('roomTitle').textContent = room.title;
  $('roomMeta').textContent = room.meta;
  $('charName').textContent = room.char;
  $('charLine').textContent = charLineFor(room);
  $('roomSource').textContent = room.teach.cite;

  var bust = $('avatarBust');
  if (bust) {
    bust.innerHTML = '';
    bust.appendChild(avatarSVG(avatarOf(), 56));
  }
  var say = $('avatarSay');
  if (say) say.textContent = state.hintTier[room.id] ? '还要提示就再点一次。' : '卡住了就点下面的提示，我按三档给。';

  var body = $('roomBody');
  var actions = $('roomActions');
  body.className = 'room-body kind-' + room.kind;
  body.innerHTML = '';
  actions.innerHTML = '';

  var p = roomProgress(room);
  state.diff = roomHasFailure(room) ? firstDiffOf(room) : null;
  var _fault = !!state.diff;
  if (_fault && !state._faultFlag) noteFault(room);
  state._faultFlag = _fault;
  renderTourBar();
  body.appendChild(buildMission(room, p));

  var work = document.createElement('div');
  work.className = 'work-area';
  body.appendChild(work);

  var bar = buildActionBar(actions, p);

  if (room.kind === 'counterpoint') renderCpRoom(room, work, bar);
  else if (room.kind === 'scale') renderScaleRoom(room, work, bar);
  else if (room.kind === 'harmony') renderHarmonyRoom(room, work, bar);
  else if (room.kind === 'set') renderSetRoom(room, work, bar);
  else if (room.kind === 'pop') renderPopRoom(room, work, bar);
  else if (room.kind === 'form') renderFormRoom(room, work, bar);
  else if (room.kind === 'compass') renderCompassRoom(room, work, bar);
  else if (room.kind === 'rhythm') renderRhythmRoom(room, work, bar);
  else renderLockedRoom(room, work, bar);

  if (roomHasFailure(room)) {
    var refPlan = referencePlan(room);
    if (refPlan) bar.compare(mkBtn('先听你写的，再听修好的', 'btn', function () { playCompare(room); }));
  }

  bar.finish();
  saveState();
}

function renderMarkList(items, emptyText) {
  var list = $('markList');
  list.innerHTML = '';
  if (state.diff && items && items.length && !(items.length === 1 && items[0].label === '第一处不同')) {
    items = [{ label: '第一处不同', message: state.diff.label }].concat(items);
  }
  var narr = state.diff ? faultNarrative(ROOM_INDEX[state.roomId], state.diff) : null;
  if (narr) {
    var nl = document.createElement('li');
    nl.className = 'fault-note';
    nl.textContent = narr;
    list.appendChild(nl);
  }
  if (!items.length) {
    var li = document.createElement('li');
    li.className = 'is-good';
    li.textContent = emptyText || '眼下没有违例。';
    list.appendChild(li);
    return;
  }
  items.slice(0, 6).forEach(function (it) {
    var li = document.createElement('li');
    if (it.cls) li.className = it.cls;
    if (it.label) {
      var code = document.createElement('span');
      code.className = 'code';
      code.textContent = it.label;
      li.appendChild(code);
    }
    li.appendChild(document.createTextNode(it.message));
    if (it.citation) {
      var cite = document.createElement('span');
      cite.className = 'cite';
      cite.textContent = it.citation;
      li.appendChild(cite);
    }
    list.appendChild(li);
  });
}

function mkBtn(label, cls, fn, kbd) {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = label;
  if (kbd) {
    var k = document.createElement('kbd');
    k.textContent = kbd;
    b.appendChild(k);
  }
  b.addEventListener('click', fn);
  return b;
}

/* ---------- 对位 ---------- */

function cpState(room) {
  if (!state.cp[room.id]) {
    state.cp[room.id] = { slots: blankSlots(LEVELS[room.cp]), activeSlot: 0, attempts: 0 };
  }
  return state.cp[room.id];
}

function renderCpRoom(room, body, barUi) {
  var lv = LEVELS[room.cp];
  var c = cpState(room);

  var r = judge(lv, c.slots);
  state.marks = {};
  r.violations.forEach(function (v) { state.marks[v.slot] = true; });
  state.activeSlot = c.activeSlot;

  var host = document.createElement('div');
  host.className = 'score-host';
  host.id = 'scoreHost';
  body.appendChild(host);
  host.appendChild(buildScore(lv, c.slots));
  host.querySelectorAll('[data-slot]').forEach(function (el) {
    el.addEventListener('click', function () {
      c.activeSlot = parseInt(el.getAttribute('data-slot'), 10);
      renderRoom();
    });
  });

  var pbox = document.createElement('div');
  pbox.className = 'palette-host';
  var plabel = document.createElement('div');
  plabel.className = 'palette-label';
  var empt = emptySlotsOf(lv, c.slots).length;
  if (empt === 0) {
    plabel.textContent = '整页已填满。点任一音可换掉第 ' + (c.activeSlot + 1) + ' 音';
  } else {
    plabel.textContent = '给第 ' + (c.activeSlot + 1) + ' 音选一个音高';
  }
  pbox.appendChild(plabel);

  var pal = document.createElement('div');
  pal.className = 'palette';
  var bar = lv.species === 1 ? c.activeSlot : Math.floor(c.activeSlot / 2);
  var cfNote = lv.cantus[Math.min(bar, lv.cantus.length - 1)];

  lv.palette.forEach(function (midi, idx) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pitch';
    var info = spellingInfo(midi, lv.spell);
    if (slotIsClean(lv, c.slots, c.activeSlot, midi)) btn.className += ' is-ok';
    if (c.slots[c.activeSlot] === midi) btn.className += ' is-current';
    var name = document.createElement('span');
    name.className = 'note-name';
    name.textContent = info.label;
    var kbd = document.createElement('span');
    kbd.className = 'key-hint';
    kbd.textContent = idx < 9 ? ' ' + (idx + 1) : '';
    name.appendChild(kbd);
    var iv = document.createElement('span');
    iv.className = 'note-ivl';
    iv.textContent = intervalName(cfNote, midi);
    btn.appendChild(name);
    btn.appendChild(iv);
    btn.addEventListener('click', function () { cpPlace(room, midi); });
    pal.appendChild(btn);
  });
  pbox.appendChild(pal);
  body.appendChild(pbox);

  var items = r.violations.map(function (v) {
    return { label: '第 ' + (v.slot + 1) + ' 音 · ' + v.code, message: v.message, citation: v.citation };
  });
  r.advisories.forEach(function (a) {
    items.push({ label: '提醒 · 第 ' + (a.slot + 1) + ' 音', message: a.message, cls: 'is-adv' });
  });
  renderMarkList(items);

  barUi.listen(mkBtn('试听固定旋律', 'btn', function () { ensureAudio(); playCantus(lv); }, '空格'));
  barUi.listen(mkBtn('试听这一音', 'btn', function () {
    ensureAudio();
    if (c.slots[c.activeSlot] == null) {
      flashChar('第 ' + (c.activeSlot + 1) + ' 格还空着，先放一个音再试听。');
      return;
    }
    var b2 = lv.species === 1 ? c.activeSlot : Math.floor(c.activeSlot / 2);
    playDyad(lv.cantus[Math.min(b2, lv.cantus.length - 1)], c.slots[c.activeSlot]);
  }, 'Enter'));
  barUi.task(mkBtn('抹掉此音', 'btn', function () {
    c.slots[c.activeSlot] = null; renderRoom(); saveState();
  }, '⌫'));
  if (c.attempts >= 2 && lv.reference) {
    barUi.task(mkBtn('看乐长的示范', 'btn btn-quiet', function () {
      c.slots = lv.reference.slice(); c.activeSlot = 0;
      renderRoom(); saveState();
    }));
  }
  barUi.submit(mkBtn('呈交乐长', 'btn btn-ink', function () { cpSubmit(room); }));
}

function cpNextEmpty(room, from) {
  var lv = LEVELS[room.cp], c = cpState(room), n = totalSlots(lv);
  for (var i = 1; i <= n; i++) {
    var idx = (from + i) % n;
    if (c.slots[idx] == null) return idx;
  }
  return null;
}

function cpPlace(room, midi) {
  ensureAudio();
  var lv = LEVELS[room.cp], c = cpState(room);
  var slot = c.activeSlot;
  c.slots[slot] = midi;
  var bar = lv.species === 1 ? slot : Math.floor(slot / 2);
  playDyad(lv.cantus[Math.min(bar, lv.cantus.length - 1)], midi);
  var nx = cpNextEmpty(room, slot);
  c.activeSlot = nx == null ? slot : nx;
  renderRoom();
  saveState();
}

function cpSubmit(room) {
  var lv = LEVELS[room.cp], c = cpState(room);
  var empt = emptySlotsOf(lv, c.slots);
  if (empt.length) {
    c.activeSlot = empt[0];
    renderRoom();
    $('charLine').textContent = '还有 ' + empt.length + ' 个谱位空着，先填满再呈。';
    setSubmitMsg('还差 ' + empt.length + ' 个音：点第 ' + (empt[0] + 1) + ' 格，再选一个音高。');
    return;
  }
  c.attempts++;
  var r = judge(lv, c.slots);
  var dur = playExercise(lv, c.slots);
  var wait = Math.min(3200, dur * 1000 * 0.85);

  if (r.violations.length === 0) {
    passRoom(room);
    setTimeout(function () {
      showVerdict({
        eyebrow: '校毕',
        title: room.title + ' · 无瑕',
        paras: ['整条练习没有一处违例。固定旋律与你的线并行了整页，却各自站得住。'],
        actions: [
          { label: '回环城', cls: 'btn btn-ink', fn: function () { hideVerdict(); clearRoom(room); } },
          { label: '再听一遍', cls: 'btn', fn: function () { playExercise(lv, c.slots); } }
        ]
      });
    }, wait);
  } else {
    setTimeout(function () {
      var byCode = {}, list = [];
      r.violations.forEach(function (v) {
        if (byCode[v.code]) return;
        byCode[v.code] = true;
        list.push('第 ' + (v.slot + 1) + ' 音：' + v.message + '（' + v.citation + '）');
      });
      showVerdict({
        eyebrow: '退回重抄',
        title: room.title + ' · ' + Object.keys(state.marks).length + ' 处标了记号',
        paras: ['乐长在页边画了几道记号，没有撕掉这张纸。改完再呈。'],
        list: list,
        actions: [{ label: '回去改', cls: 'btn btn-ink', fn: hideVerdict }]
      });
    }, wait);
  }
  renderRoom();
  saveState();
}

/* ---------- 拼音阶 ---------- */

function scaleState(room) {
  if (!state.scale[room.id]) state.scale[room.id] = { sel: [], tonic: null, attempts: 0 };
  return state.scale[room.id];
}

function renderScaleRoom(room, body, barUi) {
  var s = scaleState(room);
  var host = document.createElement('div');
  host.className = 'ring-host';
  body.appendChild(host);

  var badPcs = [];
  if (s.checked && s.badSel) badPcs = s.badSel;

  host.appendChild(buildRing({
    order: 'fifths',
    selected: s.sel,
    tonic: s.tonic,
    bad: badPcs,
    degrees: s.sel.length === 7 && s.tonic != null ? degreesOf(room, s) : null,
    onNode: function (pc) {
      if (s.sel.indexOf(pc) !== -1) {
        if (s.sel.length === 7) {
          s.tonic = (s.tonic === pc ? null : pc);
        } else {
          s.sel = s.sel.filter(function (x) { return x !== pc; });
          if (s.tonic === pc) s.tonic = null;
        }
      } else if (s.sel.length < 7) {
        s.sel = s.sel.concat([pc]);
      }
      s.checked = false;
      renderRoom();
      saveState();
    }
  }));

  var hint = document.createElement('div');
  hint.className = 'ring-hint';
  if (s.sel.length < 7) hint.textContent = '已选 ' + s.sel.length + ' / 7 块石';
  else if (s.tonic == null) hint.textContent = '七块已齐。点其中一块，把它定为主音。';
  else hint.textContent = '主音：' + NAMES[s.tonic] + '。呈交给维斯看。';
  body.appendChild(hint);

  if (s.sel.length === 7) {
    var ro = document.createElement('div');
    ro.className = 'ring-readout';
    var deg = degreesOf(room, s);
    ro.innerHTML = '阶名：' + (deg ? deg.join(' ') : '—') +
      '<br>七个台阶：' + stepsOf(s).join(' ');
    body.appendChild(ro);
  }

  var items = [];
  if (s.checked && s.error) items.push({ label: '未通过', message: s.error, cls: 'is-bad' });
  renderMarkList(items, '还没选石头。');

  barUi.task(mkBtn('清空重选', 'btn', function () {
    s.sel = []; s.tonic = null; s.checked = false; renderRoom(); saveState();
  }));
  barUi.listen(mkBtn('试听这组石', 'btn', function () {
    ensureAudio();
    if (!s.sel.length) {
      flashChar('先点几块石，再试听。空着的时候没有东西可听。');
      return;
    }
    var order = s.tonic != null ? orderFrom(s.sel, s.tonic).ordered : s.sel.slice().sort(function (a, b) { return a - b; });
    var played = playSequence(order.map(function (pc) { return 60 + pc; }));
    if (!played) {
      flashChar('这一组石没能发声，检查一下浏览器的声音权限。');
      return;
    }
    flashChar('正在试听：' + order.map(function (pc) { return NAMES[pc]; }).join(' ') + '，' + played + ' 个音。');
    order.forEach(function (pc, i) {
      setTimeout(function () {
        var node = document.querySelector('g[data-pc="' + pc + '"] .ring-node');
        if (!node) return;
        node.classList.add('is-playing');
        setTimeout(function () { node.classList.remove('is-playing'); }, 300);
      }, i * 340 + 80);
    });
  }));
  barUi.submit(mkBtn('呈交', 'btn btn-ink', function () { scaleSubmit(room); }));
}

function degreesOf(room, s) {
  if (s.tonic == null) return null;
  var ordered = orderFrom(s.sel, s.tonic).ordered;
  return ordered.map(function (pc) {
    var idx = (pc - s.tonic + 12) % 12;
    var map = { 0: '1̂', 1: '♭2̂', 2: '2̂', 3: '♭3̂', 4: '3̂', 5: '4̂', 6: '♯4̂', 7: '5̂', 8: '♭6̂', 9: '6̂', 10: '♭7̂', 11: '7̂' };
    return map[idx] || '';
  });
}

function stepsOf(s) {
  if (s.tonic == null) return [];
  var ordered = orderFrom(s.sel, s.tonic).ordered;
  var out = [];
  for (var i = 0; i < ordered.length; i++) {
    var next = i === ordered.length - 1 ? ordered[0] : ordered[i + 1];
    var d = (next - ordered[i] + 12) % 12;
    out.push(d === 2 ? '全' : d === 1 ? '半' : d === 3 ? '增二' : String(d));
  }
  out.push('→ 主音');
  return out;
}

function scaleSubmit(room) {
  var s = scaleState(room);
  var t = room.target;
  s.checked = true;
  s.attempts++;

  if (s.sel.length !== 7 || s.tonic == null) {
    s.error = '七块石与主音都要定下来才能呈。';
    renderRoom();
    setSubmitMsg(s.sel.length < 7
      ? ('还差 ' + (7 - s.sel.length) + ' 块石：在环上继续点。')
      : '石头够了，但还没定主音：点一块已经亮的石头。');
    return;
  }

  var setOk = sameSet(s.sel, t.pcs);
  var tonicOk = s.tonic === t.tonic;

  if (setOk && tonicOk) {
    var ordered = orderFrom(s.sel, s.tonic).ordered;
    playSequence(ordered.map(function (pc) { return 60 + pc; }));
    s.error = null;
    s.badSel = [];
    setTimeout(function () {
      showVerdict({
        eyebrow: '校毕',
        title: room.title + ' · ' + t.label,
        paras: [
          '阶名依次是：' + ordered.map(function (pc) { return NAMES[pc]; }).join(' ') + '。',
          '七个台阶：' + stepsOf(s).join(' ') + '。'
        ],
        actions: [{ label: '回环城', cls: 'btn btn-ink', fn: function () { hideVerdict(); clearRoom(room); } }]
      });
    }, 900);
    passRoom(room);
  } else {
    if (!setOk) {
      s.error = '这七块石不对。本关应当是：' + t.degrees.join(' ') + '。';
      s.badSel = t.pcs.filter(function (pc) { return s.sel.indexOf(pc) === -1; });
      playChord(s.sel, null, 1.2, 0.09);
    } else {
      s.error = '石头对了，但主音定在 ' + NAMES[s.tonic] + '。同样七块石，主音定在 ' +
        NAMES[t.tonic] + ' 才是' + t.label + '；定在 ' + NAMES[s.tonic] + ' 得到的是另一种调式。';
      s.badSel = [];
      var baseline = orderFrom(t.pcs, t.tonic).ordered;
      playSequence(baseline.map(function (pc) { return 60 + pc; }));
    }
    renderRoom();
    saveState();
  }
}

/* ---------- 和声 ---------- */

function harmonyState(room) {
  if (!state.harmony[room.id]) state.harmony[room.id] = { step: 0, attempts: 0, bad: null, lastError: null, chosen: [] };
  return state.harmony[room.id];
}

function renderHarmonyRoom(room, body, barUi) {
  var h = harmonyState(room);
  var sit = room.situations[Math.min(h.step, room.situations.length - 1)];

  var ledger = document.createElement('div');
  ledger.className = 'ledger';
  var prev = document.createElement('span');
  prev.className = 'ledger-item';
  prev.textContent = sit.prev.rn;
  ledger.appendChild(prev);
  var arrow = document.createElement('span');
  arrow.className = 'ledger-arrow';
  arrow.textContent = '→';
  ledger.appendChild(arrow);
  var q = document.createElement('span');
  q.className = 'ledger-q';
  q.textContent = '?';
  ledger.appendChild(q);
  body.appendChild(ledger);

  var prompt = document.createElement('div');
  prompt.className = 'ledger-prompt';
  prompt.textContent = sit.prompt;
  body.appendChild(prompt);

  var opts = document.createElement('div');
  opts.className = 'ledger-options';
  sit.options.forEach(function (o) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chord-opt' + (h.bad === o.rn ? ' is-bad' : '') +
      (state.diff && state.diff.rn === o.rn ? ' is-diff' : '');
    var rn = document.createElement('span');
    rn.className = 'rn';
    rn.textContent = o.rn;
    var fn = document.createElement('span');
    fn.className = 'fn';
    fn.textContent = o.func;
    b.appendChild(rn);
    b.appendChild(fn);
    b.addEventListener('click', function () { harmonyChoose(room, o); });
    opts.appendChild(b);
  });
  body.appendChild(opts);

  var prog = document.createElement('div');
  prog.className = 'ledger-progress';
  prog.textContent = '第 ' + Math.min(h.step + 1, room.situations.length) + ' / ' + room.situations.length + ' 笔';
  body.appendChild(prog);

  var items = [];
  if (h.lastError) {
    h.lastError.forEach(function (e) {
      items.push({ label: '未平 · ' + e.code, message: e.msg, cls: 'is-bad' });
    });
  }
  renderMarkList(items, '账页还没有下笔。');

  barUi.listen(mkBtn('试听上一笔', 'btn', function () {
    playChord(sit.prev.pcs);
  }));
}

function harmonyChoose(room, opt) {
  ensureAudio();
  var h = harmonyState(room);
  var sit = room.situations[h.step];
  var errs = harmonyIssues(sit.prev, opt, room.tonic);

  playChord(opt.pcs);

  if (errs.length) {
    h.bad = opt.rn;
    h.chosen = h.chosen || [];
    h.chosen.push({ rn: opt.rn, pcs: opt.pcs });
    h.lastError = errs;
    renderRoom();
    saveState();
    return;
  }

  h.bad = null;
  h.lastError = null;
  h.step++;
  if (h.step >= room.situations.length) {
    passRoom(room);
    setTimeout(function () {
      showVerdict({
        eyebrow: '账平',
        title: room.title + ' · 已平',
        paras: ['这一页的账都还清了。书记把这一页夹进今年的册子。'],
        actions: [{ label: '回环城', cls: 'btn btn-ink', fn: function () { hideVerdict(); clearRoom(room); } }]
      });
    }, 500);
  } else {
    renderRoom();
  }
  saveState();
}

/* ---------- 音集 ---------- */

function setState(room) {
  if (!state.set[room.id]) state.set[room.id] = { start: null, picked: [], attempts: 0, checked: false, error: null, bad: [] };
  return state.set[room.id];
}

function renderSetRoom(room, body, barUi) {
  var s = setState(room);
  var host = document.createElement('div');
  host.className = 'ring-host';
  body.appendChild(host);

  var ghost = [];
  if (room.mode === 'common') {
    ghost = room.members.map(function (pc) { return (pc + room.transpose) % 12; });
  }

  host.appendChild(buildRing({
    order: room.mode === 'common' ? 'chromatic' : 'chromatic',
    selected: room.members,
    ghost: ghost,
    picked: s.picked,
    start: s.start,
    bad: s.bad,
    onNode: function (pc) {
      if (room.mode === 'normal') {
        if (room.members.indexOf(pc) === -1) return;
        s.start = pc;
      } else {
        if (s.picked.indexOf(pc) === -1) s.picked = s.picked.concat([pc]);
        else s.picked = s.picked.filter(function (x) { return x !== pc; });
      }
      s.checked = false;
      renderRoom();
      saveState();
    }
  }));

  var hint = document.createElement('div');
  hint.className = 'ring-hint';
  if (room.mode === 'normal') {
    hint.textContent = s.start == null ? '点一个已亮的石，从它起算。' : '从 ' + NAMES[s.start] + ' 起算。';
  } else {
    hint.textContent = '点出同时在两组里的音。已点 ' + s.picked.length + ' 个。';
  }
  body.appendChild(hint);

  var ro = document.createElement('div');
  ro.className = 'ring-readout';
  if (room.mode === 'normal') {
    if (s.start == null) {
      ro.textContent = '尚未起算。';
    } else {
      var info = orderFrom(room.members, s.start);
      ro.innerHTML = '读作：<b>' + info.ordered.map(function (pc) { return NAMES[pc]; }).join(' ') +
        '</b><br>跨度：' + info.span + ' 个半音';
    }
  } else {
    ro.innerHTML = '第一组：' + room.members.map(function (pc) { return NAMES[pc]; }).join(' ') +
      '<br>第二组（整体平移 ' + room.transpose + ' 个半音）：' +
      ghost.map(function (pc) { return NAMES[pc]; }).join(' ');
  }
  body.appendChild(ro);

  var items = [];
  if (s.checked && s.error) items.push({ label: '未通过', message: s.error, cls: 'is-bad' });
  renderMarkList(items, '还没有起算。');

  barUi.listen(mkBtn('试听第一组', 'btn', function () { playChord(room.members); }));
  if (room.mode === 'common') {
    barUi.listen(mkBtn('试听第二组', 'btn', function () { playChord(ghost); }));
  }
  barUi.task(mkBtn('清空', 'btn', function () {
    s.start = null; s.picked = []; s.checked = false; s.error = null; s.bad = [];
    renderRoom(); saveState();
  }));
  barUi.submit(mkBtn('呈交', 'btn btn-ink', function () { setSubmit(room); }));
}

function setSubmit(room) {
  var s = setState(room);
  s.checked = true;
  s.attempts++;

  if (room.mode === 'normal') {
    if (s.start == null) {
      s.error = '先选一个起点。';
      renderRoom();
      setSubmitMsg('先选一个起点：点一个已经亮的音。');
      return;
    }
    var best = minSpanOf(room.members);
    var mine = orderFrom(room.members, s.start);
    if (mine.span === best.span) {
      s.error = null; s.bad = [];
      playChord(room.members);
      passRoom(room);
      setTimeout(function () {
        showVerdict({
          eyebrow: '测毕',
          title: room.title + ' · 跨度 ' + mine.span,
          paras: ['这已经是最紧的排法。跨度 ' + mine.span + ' 个半音，没有更紧的起点了。',
            '正常序：' + mine.ordered.map(function (pc) { return NAMES[pc]; }).join(' ') + '。'],
          actions: [{ label: '回环城', cls: 'btn btn-ink', fn: function () { hideVerdict(); clearRoom(room); } }]
        });
      }, 600);
    } else {
      s.error = '从 ' + NAMES[s.start] + ' 起算的跨度是 ' + mine.span + '，还有更紧的起点。';
      s.bad = [s.start];
      renderRoom();
    }
  } else {
    var ghost = room.members.map(function (pc) { return (pc + room.transpose) % 12; });
    var truth = commonTonesOf(room.members, ghost);
    if (sameSet(s.picked, truth)) {
      s.error = null; s.bad = [];
      playChord(truth);
      passRoom(room);
      setTimeout(function () {
        showVerdict({
          eyebrow: '测毕',
          title: room.title + ' · 共同音 ' + truth.length + ' 个',
          paras: ['共同音是 ' + truth.map(function (pc) { return NAMES[pc]; }).join('、') + '。',
            '共同音越多，两组之间的交接越不容易迷路。'],
          actions: [{ label: '回环城', cls: 'btn btn-ink', fn: function () { hideVerdict(); clearRoom(room); } }]
        });
      }, 600);
    } else {
      s.error = '交集不对。你点了 ' + (s.picked.length ? s.picked.map(function (pc) { return NAMES[pc]; }).join('、') : '空') + '。';
      s.bad = s.picked;
      renderRoom();
    }
  }
  saveState();
}

/* ---------- 市集循环 ---------- */

function popState(room) {
  if (!state.pop[room.id]) state.pop[room.id] = { pos: room.startAt, step: 0, attempts: 0, bad: null, error: null };
  return state.pop[room.id];
}

function renderPopRoom(room, body, barUi) {
  var p = popState(room);

  var ledger = document.createElement('div');
  ledger.className = 'ledger';
  for (var i = 0; i <= p.step; i++) {
    var idx = (room.startAt + i) % room.chords.length;
    if (i > 0) {
      var ar = document.createElement('span');
      ar.className = 'ledger-arrow';
      ar.textContent = '→';
      ledger.appendChild(ar);
    }
    var item = document.createElement('span');
    item.className = 'ledger-item' + (i === p.step ? ' is-new' : '');
    item.textContent = room.chords[idx].rn;
    ledger.appendChild(item);
  }
  if (p.step < room.rounds) {
    var ar2 = document.createElement('span');
    ar2.className = 'ledger-arrow';
    ar2.textContent = '→';
    ledger.appendChild(ar2);
    var q = document.createElement('span');
    q.className = 'ledger-q';
    q.textContent = '?';
    ledger.appendChild(q);
  }
  body.appendChild(ledger);

  var prompt = document.createElement('div');
  prompt.className = 'ledger-prompt';
  prompt.textContent = p.step < room.rounds
    ? '循环第 ' + (p.step + 1) + ' 步。街上的手还没停，接下去。'
    : '一圈走完。';
  body.appendChild(prompt);

  if (p.step < room.rounds) {
    var opts = document.createElement('div');
    opts.className = 'ledger-options';
    var correct = (p.pos + 1) % room.chords.length;
    var cands = [correct, (correct + 1) % room.chords.length, (correct + 3) % room.chords.length];
    cands.forEach(function (ci) {
      var o = room.chords[ci];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chord-opt' + (p.bad === o.rn ? ' is-bad' : '');
      var rn = document.createElement('span');
      rn.className = 'rn';
      rn.textContent = o.rn;
      var fn = document.createElement('span');
      fn.className = 'fn';
      fn.textContent = o.func;
      b.appendChild(rn);
      b.appendChild(fn);
      b.addEventListener('click', function () { popChoose(room, ci); });
      opts.appendChild(b);
    });
    body.appendChild(opts);
  }

  var items = [];
  if (p.error) items.push({ label: '断开', message: p.error, cls: 'is-bad' });
  renderMarkList(items, '还没接下一步。');

  barUi.listen(mkBtn('试听这一段', 'btn', function () {
    room.chords.forEach(function (ch) { playChord(ch.pcs, null, 0.8, 0.09); });
  }));
}

function popChoose(room, ci) {
  ensureAudio();
  var p = popState(room);
  var correct = (p.pos + 1) % room.chords.length;
  playChord(room.chords[ci].pcs);

  if (ci !== correct) {
    p.bad = room.chords[ci].rn;
    p.error = ci === room.startAt
      ? '回到 I 就提前收束了，循环断在这里。'
      : '这不是循环里的下一步，跳过去就回不来了。';
    renderRoom();
    saveState();
    return;
  }

  p.bad = null;
  p.error = null;
  p.pos = ci;
  p.step++;

  if (p.step >= room.rounds) {
    passRoom(room);
    setTimeout(function () {
      showVerdict({
        eyebrow: '接上了',
        title: room.title + ' · 一圈',
        paras: ['循环接住了。街上的人跟着走了三步，没人掉队。'],
        actions: [{ label: '回环城', cls: 'btn btn-ink', fn: function () { hideVerdict(); clearRoom(room); } }]
      });
    }, 500);
  } else {
    renderRoom();
  }
  saveState();
}

/* ---------- 锁住的房间 ---------- */

function renderLockedRoom(room, body, barUi) {
  var note = document.createElement('div');
  note.className = 'locked-note';
  var tag = document.createElement('div');
  tag.className = 'locked-tag';
  tag.textContent = '仅讲解 · 未开放';
  note.appendChild(tag);
  var h = document.createElement('h3');
  h.textContent = room.teach.title;
  note.appendChild(h);
  room.teach.body.forEach(function (p) {
    var el = document.createElement('p');
    el.textContent = p;
    note.appendChild(el);
  });
  body.appendChild(note);

  var why = document.createElement('div');
  why.className = 'ledger-prompt';
  why.textContent = '这一章的知识已经写在讲解卡里，可以随时读。玩法本轮没有实现：' +
    (room.district === 'works' ? '曲式需要时间轴与可听主题，白盒阶段排不进来。' :
      room.district === 'masonry' ? '第三、第四类对位与四声部需要另一套判据，本轮只做前两类。' :
        room.district === 'frontier' ? '十二音序列操作需要独立的序列器。' :
          room.district === 'market' ? '流行曲式容器需要段落时间轴。' :
            '这一类知识需要谱面量算，本轮只做了环上的音阶。');
  body.appendChild(why);

  renderMarkList([], '这一章只读，不设判定。');
  barUi.task(mkBtn('看完整讲解', 'btn btn-ink', function () { openTeach(room); }));
}

/* ================= 16b. 曲式：时间轴与可听主题 ================= */

var FORM_GEO = { W: 1000, H: 216, padL: 34, padR: 34, bandTop: 46, bandH: 76, barTop: 140, tickH: 28 };
var formAnim = { raf: 0 };

function stopFormAnim() {
  if (formAnim.raf) { cancelAnimationFrame(formAnim.raf); formAnim.raf = 0; }
  var ph = document.querySelector('.form-playhead');
  if (ph) ph.style.display = 'none';
}

function formState(room) {
  if (!state.form[room.id]) {
    state.form[room.id] = {
      labels: {}, boundaries: [], point: null, active: 0,
      checked: false, attempts: 0, error: null, hint: false
    };
  }
  return state.form[room.id];
}

function formSegmentsOf(room, st) {
  var f = room.form;
  if (f.mode !== 'boundary') return f.segments;
  var edges = [0].concat(st.boundaries.slice().sort(function (a, b) { return a - b; }), [f.bars.length]);
  var out = [];
  for (var i = 0; i < edges.length - 1; i++) out.push({ from: edges[i], to: edges[i + 1] - 1, label: i, idx: i });
  return out;
}

function formBarX(i, n) {
  var usable = FORM_GEO.W - FORM_GEO.padL - FORM_GEO.padR;
  return FORM_GEO.padL + usable * i / n;
}

function playForm(room, fromBar, toBar) {
  var c = ensureAudio();
  if (!c) return 0;
  var f = room.form;
  var n = f.bars.length;
  fromBar = fromBar == null ? 0 : fromBar;
  toBar = toBar == null ? n : toBar;
  var t0 = c.currentTime + 0.08;
  var step = f.tempo || 1.0;

  for (var i = fromBar; i < toBar; i++) {
    var when = t0 + (i - fromBar) * step;
    var mel = f.bars[i].melody || [];
    mel.forEach(function (m, k) {
      tone(m, when + k * (step * 0.42), step * 0.44, 0.14);
    });
    playChord(f.bars[i].chord, when, Math.min(step * 0.88, 0.9), 0.065);
  }
  animatePlayhead(fromBar, toBar, t0, step, n);
  return (toBar - fromBar) * step;
}

function animatePlayhead(fromBar, toBar, t0, step, n) {
  stopFormAnim();
  var ph = document.querySelector('.form-playhead');
  if (!ph) return;
  ph.style.display = '';
  var c = ensureAudio();
  function frame() {
    var t = c.currentTime - t0;
    var bar = fromBar + t / step;
    if (bar >= toBar) { ph.style.display = 'none'; formAnim.raf = 0; return; }
    var x = formBarX(bar, n);
    ph.setAttribute('x1', x);
    ph.setAttribute('x2', x);
    formAnim.raf = requestAnimationFrame(frame);
  }
  formAnim.raf = requestAnimationFrame(frame);
}

function buildFormTimeline(room, st) {
  var f = room.form;
  var n = f.bars.length;
  var G = FORM_GEO;
  var svg = svgEl('svg', { viewBox: '0 0 ' + G.W + ' ' + G.H, role: 'img' });
  var segs = formSegmentsOf(room, st);

  segs.forEach(function (seg, i) {
    var x1 = formBarX(seg.from, n), x2 = formBarX(seg.to + 1, n);
    var isActive = (f.mode !== 'boundary' && st.active === i);
    var rect = svgEl('rect', {
      x: x1 + 1.5, y: G.bandTop, width: Math.max(0, x2 - x1 - 3), height: G.bandH,
      fill: i % 2 === 0 ? 'rgba(33,28,24,.055)' : 'rgba(33,28,24,.025)',
      stroke: isActive ? 'var(--ochre)' : 'rgba(33,28,24,.16)',
      'stroke-width': isActive ? 2 : 1
    });
    rect.setAttribute('data-seg', String(i));
    rect.style.cursor = f.mode === 'boundary' ? 'default' : 'pointer';
    svg.appendChild(rect);

    var label = '';
    if (f.mode === 'boundary') {
      label = '第 ' + (i + 1) + ' 段';
    } else if (st.labels[i] != null) {
      label = f.labels[st.labels[i]].name;
    } else {
      label = '未标';
    }
    var t = svgEl('text', {
      x: (x1 + x2) / 2, y: G.bandTop + G.bandH / 2 + 5,
      'text-anchor': 'middle',
      fill: f.mode !== 'boundary' && st.labels[i] != null ? 'var(--ink)' : 'rgba(111,100,85,.75)',
      'font-size': f.mode === 'boundary' ? 12 : 15,
      'font-family': 'var(--serif)',
      'letter-spacing': '.06em'
    });
    t.textContent = label;
    svg.appendChild(t);

    if (f.mode === 'boundary') {
      var d = svgEl('text', {
        x: (x1 + x2) / 2, y: G.bandTop + G.bandH / 2 + 22,
        'text-anchor': 'middle', fill: 'rgba(111,100,85,.8)',
        'font-size': 9, 'font-family': 'var(--mono)'
      });
      d.textContent = '第 ' + (seg.from + 1) + '–' + (seg.to + 1) + ' 小节';
      svg.appendChild(d);
    }
  });

  svg.appendChild(svgEl('rect', {
    x: G.padL, y: G.barTop, width: G.W - G.padL - G.padR, height: G.tickH,
    fill: 'rgba(33,28,24,.035)'
  }));
  svg.appendChild(svgEl('line', {
    x1: G.padL, y1: G.barTop + G.tickH, x2: G.W - G.padR, y2: G.barTop + G.tickH,
    stroke: 'rgba(33,28,24,.28)', 'stroke-width': 1
  }));

  for (var i = 0; i <= n; i++) {
    var x = formBarX(i, n);
    svg.appendChild(svgEl('line', {
      x1: x, y1: G.barTop, x2: x, y2: G.barTop + G.tickH,
      stroke: 'rgba(33,28,24,.35)', 'stroke-width': i === 0 || i === n ? 1.6 : 1
    }));
  }

  for (var b = 0; b < n; b++) {
    var bx = formBarX(b + 0.5, n);
    var num = svgEl('text', {
      x: bx, y: G.barTop + G.tickH + 15,
      'text-anchor': 'middle', fill: 'rgba(111,100,85,.9)',
      'font-size': 10, 'font-family': 'var(--mono)'
    });
    num.textContent = String(b + 1);
    svg.appendChild(num);

    var hit = svgEl('rect', {
      x: formBarX(b, n), y: G.barTop, width: formBarX(b + 1, n) - formBarX(b, n), height: G.tickH + 26,
      fill: 'transparent'
    });
    hit.setAttribute('data-bar', String(b));
    if (f.point) hit.style.cursor = 'pointer';
    svg.appendChild(hit);
  }

  if (st.point != null) {
    var px = formBarX(st.point + 0.5, n);
    svg.appendChild(svgEl('path', {
      d: 'M ' + (px - 6) + ' ' + (G.bandTop + G.bandH + 2) + ' L ' + (px + 6) + ' ' + (G.bandTop + G.bandH + 2) + ' L ' + px + ' ' + (G.bandTop + G.bandH + 12) + ' Z',
      fill: 'var(--ochre)'
    }));
    var pt = svgEl('text', {
      x: px, y: G.bandTop - 8, 'text-anchor': 'middle',
      fill: 'var(--ochre)', 'font-size': 10, 'font-family': 'var(--mono)', 'letter-spacing': '.1em'
    });
    pt.textContent = '结构点';
    svg.appendChild(pt);
  }

  if (f.mode === 'boundary') {
    for (var k = 1; k < n; k++) {
      var on = st.boundaries.indexOf(k) !== -1;
      var hx = formBarX(k, n);
      var h = svgEl('rect', {
        x: hx - 5, y: G.barTop - 4, width: 10, height: G.tickH + 8,
        fill: on ? 'var(--ochre)' : 'rgba(33,28,24,.10)'
      });
      h.setAttribute('data-cut', String(k));
      h.style.cursor = 'pointer';
      svg.appendChild(h);
    }
  }

  var ph = svgEl('line', {
    x1: formBarX(0, n), y1: G.bandTop - 6, x2: formBarX(0, n), y2: G.barTop + G.tickH,
    stroke: 'var(--ochre)', 'stroke-width': 1.4, 'stroke-dasharray': '4 3',
    class: 'form-playhead'
  });
  ph.style.display = 'none';
  svg.appendChild(ph);

  svg.addEventListener('click', function (ev) {
    var tgt = ev.target;
    var cut = tgt.closest ? tgt.closest('[data-cut]') : null;
    if (cut && f.mode === 'boundary') {
      var idx = parseInt(cut.getAttribute('data-cut'), 10);
      var pos = st.boundaries.indexOf(idx);
      if (pos === -1) st.boundaries.push(idx); else st.boundaries.splice(pos, 1);
      st.checked = false; st.error = null;
      renderRoom(); saveState();
      return;
    }
    var seg = tgt.closest ? tgt.closest('[data-seg]') : null;
    if (seg && f.mode !== 'boundary') {
      st.active = parseInt(seg.getAttribute('data-seg'), 10);
      renderRoom();
      return;
    }
    var bar = tgt.closest ? tgt.closest('[data-bar]') : null;
    if (bar && f.point) {
      var bi = parseInt(bar.getAttribute('data-bar'), 10);
      st.point = (st.point === bi ? null : bi);
      st.checked = false; st.error = null;
      renderRoom(); saveState();
    }
  });

  return svg;
}

function renderFormRoom(room, body, barUi) {
  var st = formState(room);
  var f = room.form;

  var host = document.createElement('div');
  host.className = 'form-host';
  body.appendChild(host);
  host.appendChild(buildFormTimeline(room, st));

  var hint = document.createElement('div');
  hint.className = 'ring-hint';
  if (f.mode === 'boundary') {
    hint.textContent = (st.boundaries.length === 0 ? '在下面的小节线上点出分界：' : '已放 ' + st.boundaries.length + ' 条分界。') + f.boundaryPrompt;
  } else if (f.point) {
    hint.textContent = '点上方一段选住它，再点下方的标签；在小节号上点出' + f.point.name + '。';
  } else {
    hint.textContent = '点上方一段选住它，再点下方的标签。';
  }
  body.appendChild(hint);

  if (f.mode !== 'boundary') {
    var chips = document.createElement('div');
    chips.className = 'form-chips';
    f.labels.forEach(function (lab, li) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'form-chip' + (st.labels[st.active] === li ? ' is-on' : '');
      var n1 = document.createElement('span');
      n1.className = 'chip-name';
      n1.textContent = lab.name;
      var n2 = document.createElement('span');
      n2.className = 'chip-desc';
      n2.textContent = lab.desc;
      b.appendChild(n1);
      b.appendChild(n2);
      b.addEventListener('click', function () {
        st.labels[st.active] = li;
        st.checked = false; st.error = null;
        renderRoom(); saveState();
      });
      chips.appendChild(b);
    });
    body.appendChild(chips);
  }

  if (f.mode === 'boundary' && st.hint) {
    var ref = document.createElement('div');
    ref.className = 'form-ref';
    ref.textContent = '伊莲的答案：分界在第 ' + f.boundaries.map(function (b) { return (b + 1); }).join('、') + ' 小节之前。';
    body.appendChild(ref);
  }

  var items = [];
  if (st.checked && st.error) items.push({ label: '未通过', message: st.error, cls: 'is-bad' });
  renderMarkList(items, '还没下笔。先听一遍，再标。');

  barUi.listen(mkBtn('试听全曲', 'btn', function () { ensureAudio(); playForm(room, 0, f.bars.length); }, '空格'));
  if (f.mode !== 'boundary') {
    barUi.listen(mkBtn('试听这一段', 'btn', function () {
      var segs = formSegmentsOf(room, st);
      var seg = segs[st.active];
      if (seg) playForm(room, seg.from, seg.to + 1);
    }));
  }
  barUi.task(mkBtn('清空标记', 'btn', function () {
    var s2 = formState(room);
    s2.labels = {}; s2.boundaries = []; s2.point = null;
    s2.checked = false; s2.error = null; s2.hint = false;
    renderRoom(); saveState();
  }));
  barUi.submit(mkBtn('呈交伊莲', 'btn btn-ink', function () { formSubmit(room); }));
}

function formJudge(room, st) {
  var f = room.form;
  var errs = [];

  if (f.mode === 'boundary') {
    var want = f.boundaries.slice().sort(function (a, b) { return a - b; });
    var got = st.boundaries.slice().sort(function (a, b) { return a - b; });
    if (want.join(',') !== got.join(',')) {
      if (got.length !== want.length) {
        errs.push('分界数量不对：这一段要分成 ' + (want.length + 1) + ' 段，需要 ' + want.length + ' 条分界，你放了 ' + got.length + ' 条。');
      } else {
        errs.push('数量对了，位置不对。先听第五小节前后，叠句是从哪里原样回来的。');
      }
    }
  } else {
    f.segments.forEach(function (seg, i) {
      if (st.labels[i] == null) {
        errs.push('第 ' + (i + 1) + ' 段还没标。');
      } else if (st.labels[i] !== seg.label) {
        errs.push('第 ' + (i + 1) + ' 段不是「' + f.labels[st.labels[i]].name + '」。' + seg.why);
      }
    });
  }

  if (f.point && st.point !== f.point.bar) {
    errs.push(st.point == null
      ? '还没标' + f.point.name + '。'
      : f.point.name + '不在第 ' + (st.point + 1) + ' 小节。' + f.point.why);
  }
  return errs;
}

function formSubmit(room) {
  var st = formState(room);
  var f = room.form;
  st.attempts++;
  st.checked = true;

  var errs = formJudge(room, st);
  if (!errs.length) {
    st.error = null;
    playForm(room, 0, f.bars.length);
    passRoom(room);
    setTimeout(function () {
      showVerdict({
        eyebrow: '校毕',
        title: room.title + ' · 蓝图对上了',
        paras: [f.closing],
        actions: [{ label: '回环城', cls: 'btn btn-ink', fn: function () { hideVerdict(); clearRoom(room); } }]
      });
    }, 900);
    saveState();
    return;
  }

  st.error = errs.join('　');
  if (st.attempts >= 2) st.hint = true;
  renderRoom();
  setSubmitMsg(errs[0]);
  saveState();
}

/* ================= 17. 讲解、验收、结局 ================= */

function openTeach(room) {
  $('teachWho').textContent = room.char + ' · ' + room.teach.cite;
  $('teachTitle').textContent = room.teach.title;
  var body = $('teachBody');
  body.innerHTML = '';
  var ul = document.createElement('ul');
  ul.className = 'teach-list';
  room.teach.body.forEach(function (p) {
    var li = document.createElement('li');
    li.textContent = p;
    ul.appendChild(li);
  });
  body.appendChild(ul);
  var q = document.createElement('blockquote');
  q.className = 'teach-quote';
  q.textContent = room.teach.quote;
  body.appendChild(q);
  var cite = document.createElement('div');
  cite.className = 'teach-cite';
  cite.textContent = '原文出处：Open Music Theory · ' + room.teach.cite;
  body.appendChild(cite);
  $('teachVeil').hidden = false;
}

function showVerdict(o) {
  $('verdictEyebrow').textContent = o.eyebrow;
  $('verdictTitle').textContent = o.title;
  var body = $('verdictBody');
  body.innerHTML = '';
  var passLike = ['校毕', '账平', '测毕', '接上了'].indexOf(o.eyebrow) !== -1;
  if (passLike) {
    var vrow = document.createElement('div');
    vrow.className = 'verdict-avatar';
    vrow.appendChild(avatarSVG(avatarOf(), 48));
    var vl = document.createElement('span');
    vl.textContent = '这一页我记下了。';
    vrow.appendChild(vl);
    body.appendChild(vrow);
  }
  (o.paras || []).forEach(function (p) {
    var el = document.createElement('p');
    el.textContent = p;
    body.appendChild(el);
  });
  if (o.list && o.list.length) {
    var ul = document.createElement('ul');
    ul.className = 'verdict-list';
    o.list.forEach(function (t) {
      var li = document.createElement('li');
      li.textContent = t;
      ul.appendChild(li);
    });
    body.appendChild(ul);
  }
  if (passLike && state.lastMastery && state.lastMastery.id === state.roomId) {
    var ml = document.createElement('div');
    ml.className = 'verdict-mastery';
    ml.textContent = '掌握 · ' + MASTERY_LABEL[state.lastMastery.level] + '（' + masteryEvidenceText(state.roomId) + '）';
    body.appendChild(ml);
  }
  var actions = $('sheetActions');
  actions.innerHTML = '';
  (o.actions || []).forEach(function (a) {
    actions.appendChild(mkBtn(a.label, a.cls || 'btn', a.fn));
  });
  if (passLike && state.roomId && ROOM_INDEX[state.roomId]) {
    actions.appendChild(mkBtn('存这张校记卡', 'btn btn-quiet', function () { downloadRoomCard(state.roomId); }));
  }
  if (state.tour && state.tour.active) {
    actions.appendChild(mkBtn(state.tour.done ? '看总结' : '下一关', 'btn', tourAdvance));
  }
  $('veil').hidden = false;
}

function hideVerdict() { $('veil').hidden = true; }


/* ================= 15z. 掌握度与复习巡演 ================= */

var MASTERY_ORDER = { understand: 1, proficient: 2, transfer: 3 };
var MASTERY_LABEL = { understand: '理解', proficient: '熟练', transfer: '迁移' };
var TOUR_SLOT_LABEL = { weak: '薄弱项', proficient: '熟练项', cross: '跨域项' };

function masteryOf(s, id) {
  s = s || state;
  return (s.mastery && s.mastery[id]) || null;
}

function masteryRank(s, id) {
  return MASTERY_ORDER[masteryOf(s, id)] || 0;
}

// 三层只升不降；证据来自提示次数与本轮出现过的违规，而不是通关次数
function masteryAfterPass(prev, ev, inTour) {
  if (prev === 'transfer') return 'transfer';
  var clean = !!ev && ev.hints === 0 && ev.faults === 0;
  if (inTour && clean) return prev === 'proficient' ? 'transfer' : 'proficient';
  if (clean) return 'proficient';
  return prev || 'understand';
}

function masteryCounts(s) {
  s = s || state;
  var out = { understand: 0, proficient: 0, transfer: 0, none: 0 };
  var cleared = s.cleared || {};
  ROOMS.forEach(function (r) {
    if (r.kind === 'locked' || !cleared[r.id]) return;
    var m = masteryOf(s, r.id);
    out[m || 'none']++;
  });
  return out;
}

function evidenceOf(s, id) {
  s = s || state;
  if (!s.evidence) s.evidence = {};
  if (!s.evidence[id]) s.evidence[id] = { hints: 0, faults: 0 };
  return s.evidence[id];
}

function noteHintUse(room) {
  if (!room) return;
  if (state.tour && state.tour.active) {
    if (state.tour.attempt) state.tour.attempt.hints++;
  } else {
    evidenceOf(state, room.id).hints++;
  }
}

function noteFault(room) {
  if (!room) return;
  if (state.tour && state.tour.active) {
    if (state.tour.attempt) state.tour.attempt.faults++;
  } else {
    evidenceOf(state, room.id).faults++;
  }
}

function tourCandidates(s) {
  s = s || state;
  return ROOMS.filter(function (r) {
    return r.kind !== 'locked' && !!s.cleared[r.id];
  });
}

// 三关组合：一薄弱、一熟练、一跨域。排序确定，按巡演次数轮换起点，不引入未验证的随机题
function buildTour(s) {
  s = s || state;
  var pool = tourCandidates(s);
  if (pool.length < 3) {
    return { ok: false, reason: 'insufficient', have: pool.length, need: 3, pool: pool };
  }
  var byId = function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; };
  var ranked = pool.slice().sort(function (a, b) {
    return masteryRank(s, a.id) - masteryRank(s, b.id) || byId(a, b);
  });
  var shift = (s.tourRuns || 0) % ranked.length;
  ranked = ranked.slice(shift).concat(ranked.slice(0, shift));

  var weak = ranked[0];
  var rest = ranked.filter(function (r) { return r.id !== weak.id; });
  var prof = rest.filter(function (r) { return masteryOf(s, r.id) === 'proficient'; })[0] || rest[0];
  var rest2 = rest.filter(function (r) { return r.id !== prof.id; });
  var cross = rest2.filter(function (r) { return r.district !== weak.district && r.kind !== weak.kind; })[0]
    || rest2.filter(function (r) { return r.district !== weak.district; })[0]
    || rest2[0];
  if (!weak || !prof || !cross) {
    return { ok: false, reason: 'insufficient', have: pool.length, need: 3, pool: pool };
  }
  return {
    ok: true,
    rooms: [weak.id, prof.id, cross.id],
    slots: ['weak', 'proficient', 'cross'],
    titles: [weak.title, prof.title, cross.title]
  };
}

function tourCurrent() {
  var t = state.tour;
  if (!t || !t.active) return null;
  return ROOM_INDEX[t.rooms[t.index]] || null;
}

function startTour() {
  var plan = buildTour(state);
  if (!plan.ok) {
    showVerdict({
      eyebrow: '复习',
      title: '还不能巡演',
      paras: ['巡演要有三间已经校过的房才组得起来，你现在有 ' + plan.have + ' 间。',
        '先把这一区的房间校完，再回来点「三关巡演」。'],
      actions: [{ label: '知道了', cls: 'btn btn-quiet', fn: hideVerdict }]
    });
    return plan;
  }
  state.tour = {
    active: true,
    index: 0,
    rooms: plan.rooms,
    slots: plan.slots,
    results: [],
    hintsUsed: 0,
    faults: 0,
    before: plan.rooms.map(function (id) { return { id: id, mastery: masteryOf(state, id) }; }),
    attempt: { hints: 0, faults: 0 }
  };
  saveState();
  enterRoom(plan.rooms[0]);
  return plan;
}

function tourPass(room) {
  var t = state.tour;
  var ev = t.attempt || { hints: 0, faults: 0 };
  var before = masteryOf(state, room.id);
  var after = masteryAfterPass(before, ev, true);
  if (masteryRank(state, room.id) < MASTERY_ORDER[after]) state.mastery[room.id] = after;
  t.results.push({ id: room.id, title: room.title, hints: ev.hints, faults: ev.faults, before: before, after: after });
  t.hintsUsed += ev.hints;
  t.faults += ev.faults;
  state.lastMastery = { id: room.id, level: after };
  if (t.index < 2) {
    t.index++;
    t.attempt = { hints: 0, faults: 0 };
  } else {
    t.done = true;
  }
  saveState();
}

function tourAdvance() {
  var t = state.tour;
  if (!t || !t.active) { renderMap(); return; }
  hideVerdict();
  if (t.done) { tourSummary(); return; }
  var next = ROOM_INDEX[t.rooms[t.index]];
  if (next) enterRoom(next.id);
}

function tourSummary() {
  var t = state.tour;
  var lines = t.results.map(function (r, i) {
    var b = r.before ? MASTERY_LABEL[r.before] : '未记录';
    var arrow = r.before === r.after ? b : b + ' → ' + MASTERY_LABEL[r.after];
    return '第 ' + (i + 1) + ' 关 ' + r.title + ' ｜ ' + TOUR_SLOT_LABEL[t.slots[i]] + ' ｜ 提示 ' + r.hints + ' 次 ｜ ' + arrow;
  });
  var gained = t.results.filter(function (r) { return r.before !== r.after; }).length;
  var weakest = t.results.slice().sort(function (a, b) {
    return MASTERY_ORDER[a.after] - MASTERY_ORDER[b.after];
  })[0];
  var nextTip = weakest && weakest.after !== 'transfer'
    ? '下一步建议：再走一次「' + weakest.title + '」，这次不点提示，能把迁移层补上。'
    : '下一步建议：去地图挑一个还没到迁移的城区，按同样节奏再走三关。';
  showVerdict({
    eyebrow: '巡演毕',
    title: '三关走完',
    paras: ['提示一共用了 ' + t.hintsUsed + ' 次，掌握变化 ' + gained + ' 处。'],
    list: lines.concat([nextTip]),
    actions: [
      { label: '回地图', cls: 'btn', fn: function () { hideVerdict(); endTour(); renderMap(); } },
      { label: '再来一轮', cls: 'btn btn-quiet', fn: function () { hideVerdict(); endTour(); startTour(); } }
    ]
  });
}

function endTour() {
  if (!state.tour) return;
  state.tourRuns = (state.tourRuns || 0) + 1;
  state.tour = null;
  saveState();
}

function leaveTour() {
  if (!state.tour || !state.tour.active) return;
  hideVerdict();
  state.tour.active = false;
  saveState();
  renderMap();
}

function resumeTour() {
  var t = state.tour;
  if (!t || !t.rooms) { startTour(); return; }
  t.active = true;
  if (!t.attempt) t.attempt = { hints: 0, faults: 0 };
  if (t.done) { tourSummary(); return; }
  enterRoom(t.rooms[t.index]);
}

function tourBarMarkup() {
  var t = state.tour;
  if (!t || !t.active) return null;
  var cur = tourCurrent();
  var ev = t.attempt || { hints: 0, faults: 0 };
  var label = '巡演 ' + (Math.min(t.index + 1, 3)) + '/3';
  var slot = TOUR_SLOT_LABEL[t.slots[t.index]] || '';
  var done = t.results.some(function (r) { return cur && r.id === cur.id; });
  var text = done
    ? '这一关过了 · 提示 ' + ev.hints + ' 次'
    : label + ' · ' + slot + (cur ? ' · ' + cur.title : '') + ' · 本关提示 ' + ev.hints + ' 次';
  return { text: text, done: done, index: t.index };
}

function masteryEvidenceText(id) {
  var ev = evidenceOf(state, id);
  if (!ev.hints && !ev.faults) return '零提示、零违规';
  var bits = [];
  if (ev.hints) bits.push('提示 ' + ev.hints + ' 次');
  if (ev.faults) bits.push('违规 ' + ev.faults + ' 次');
  return bits.join('、');
}

function renderTourBar() {
  var host = document.getElementById('tourBar');
  if (!host) return;
  var info = tourBarMarkup();
  if (!info) { host.hidden = true; host.innerHTML = ''; return; }
  host.hidden = false;
  host.innerHTML = '';
  var label = document.createElement('span');
  label.className = 'tour-bar-text';
  label.textContent = info.text;
  host.appendChild(label);
  if (info.done) {
    var go = mkBtn(state.tour.done ? '看总结' : '下一关', 'btn btn-mini', tourAdvance);
    host.appendChild(go);
  }
  var quit = mkBtn('退出巡演', 'btn btn-quiet btn-mini', leaveTour);
  host.appendChild(quit);
}

function passRoom(room) {
  if (state.tour && state.tour.active && state.tour.rooms.indexOf(room.id) !== -1) {
    state.cleared[room.id] = true;
    tourPass(room);
    saveState();
    return;
  }
  state.cleared[room.id] = true;
  state.lastMastery = { id: room.id, level: masteryAfterPass(masteryOf(state, room.id), evidenceOf(state, room.id), false) };
  if (masteryRank(state, room.id) < MASTERY_ORDER[state.lastMastery.level]) {
    state.mastery[room.id] = state.lastMastery.level;
  }
  var pr = playableRoomsOfDistrict(room.district);
  if (pr.length && pr.every(function (r) { return state.cleared[r.id]; })) {
    state.seals[room.district] = true;
  }
  if (state.seals[room.district] && !state.records[room.district]) {
    state.pendingRecord = room.district;
  }
  saveState();
}

function endingEligible(s) {
  s = s || state;
  return DISTRICTS.filter(function (d) { return playableRoomsOfDistrict(d.id).length > 0; })
    .every(function (d) { return !!(s.seals && s.seals[d.id]); });
}

function allPlayableCleared() {
  return ROOMS.filter(function (r) { return r.kind !== 'locked'; })
    .every(function (r) { return state.cleared[r.id]; });
}

function clearRoom(room) {
  state.roomId = null;
  state.view = 'map';
  state.district = room.district;
  renderMap();
  saveState();
  if (state.pendingRecord) {
    var did = state.pendingRecord;
    state.pendingRecord = null;
    setTimeout(function () { showRecordBeat(did); }, 260);
    return;
  }
  if (endingEligible() && !state.signed) setTimeout(showEnding, 320);
}

function sealBadge(av, size) {
  var ns = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('width', String(size || 36));
  svg.setAttribute('height', String(size || 36));
  svg.setAttribute('class', 'seal-badge');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', '个人印记');
  var rect = document.createElementNS(ns, 'rect');
  rect.setAttribute('x', '1.5'); rect.setAttribute('y', '1.5');
  rect.setAttribute('width', '29'); rect.setAttribute('height', '29');
  rect.setAttribute('fill', 'none');
  rect.setAttribute('stroke', 'var(--ochre)');
  rect.setAttribute('stroke-width', '1.6');
  svg.appendChild(rect);
  var p = document.createElementNS(ns, 'path');
  p.setAttribute('d', sealGlyph(av));
  p.setAttribute('fill', 'none');
  p.setAttribute('stroke', 'var(--ochre)');
  p.setAttribute('stroke-width', '1.6');
  p.setAttribute('stroke-linecap', 'round');
  p.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(p);
  return svg;
}

function showEnding() {
  var av = avatarOf();
  var records = state.records || {};

  showVerdict({ eyebrow: '终页', title: '记谱人', paras: [], actions: [], ending: true });
  var body = $('verdictBody');
  body.innerHTML = '';

  if (state.signed) {
    var done = document.createElement('div');
    done.className = 'ending-head';
    done.appendChild(avatarSVG(av, 84));
    var ds = document.createElement('div');
    ds.className = 'ending-side';
    var dn = document.createElement('div');
    dn.className = 'ending-note';
    dn.textContent = '六页校记已交齐。这一册记在：';
    ds.appendChild(dn);
    var sealRow2 = document.createElement('div');
    sealRow2.className = 'ending-seal-row';
    sealRow2.appendChild(sealBadge(av, 28));
    var st2 = document.createElement('span');
    st2.textContent = '个人印记';
    sealRow2.appendChild(st2);
    ds.appendChild(sealRow2);

    var signName = document.createElement('div');
    signName.className = 'signed-name';
    signName.textContent = state.signed;
    ds.appendChild(signName);
    done.appendChild(ds);
    body.appendChild(done);
    body.appendChild(markRow(20));

    var list2 = document.createElement('ul');
    list2.className = 'teach-list record-summary';
    Object.keys(DISTRICT_MARK).forEach(function (did) {
      var d2 = districtById(did);
      var r2 = records[did];
      var li2 = document.createElement('li');
      li2.textContent = d2.name + ' · ' + (r2 && r2.choice ? r2.choice : '未记');
      list2.appendChild(li2);
    });
    body.appendChild(list2);
    var actions0 = $('sheetActions');
    actions0.innerHTML = '';
    actions0.appendChild(mkBtn('打印 / 存为 PDF', 'btn', printDiploma));
    actions0.appendChild(mkBtn('下载校记页', 'btn btn-quiet', downloadDiploma));
    actions0.appendChild(mkBtn('回环城', 'btn btn-ink', function () {
      hideVerdict();
      state.roomId = null;
      renderMap();
    }));
    return;
  }

  var head = document.createElement('div');
  head.className = 'ending-head';
  head.appendChild(avatarSVG(av, 84));
  var side = document.createElement('div');
  side.className = 'ending-side';

  var sealRow = document.createElement('div');
  sealRow.className = 'ending-seal-row';
  sealRow.appendChild(sealBadge(av, 32));
  var sealText = document.createElement('span');
  sealText.textContent = '个人印记';
  sealRow.appendChild(sealText);
  side.appendChild(sealRow);

  var note = document.createElement('div');
  note.className = 'ending-note';
  note.textContent = '六页校记已交齐，其中营造司还剩一页只有抄录——加兰特图式，你说等有真实演奏再来。';
  side.appendChild(note);
  head.appendChild(side);
  body.appendChild(head);

  body.appendChild(markRow(20));

  var list = document.createElement('ul');
  list.className = 'teach-list record-summary';
  Object.keys(DISTRICT_MARK).forEach(function (did) {
    var d = districtById(did);
    var r = records[did];
    var li = document.createElement('li');
    li.textContent = d.name + ' · ' + (r && r.choice ? r.choice : '未记');
    list.appendChild(li);
  });
  body.appendChild(list);

  var tip = document.createElement('p');
  tip.className = 'ending-tip';
  tip.textContent = '署名可以写字，也可以留白。';
  body.appendChild(tip);

  var row = document.createElement('div');
  row.className = 'sign-row';
  var input = document.createElement('input');
  input.type = 'text';
  input.placeholder = '写下你的名字';
  input.maxLength = 16;
  input.id = 'signInput';
  row.appendChild(input);
  body.appendChild(row);

  var actions = $('sheetActions');
  actions.innerHTML = '';
  actions.appendChild(mkBtn('署上', 'btn btn-ink', function () {
    var v = (input.value || '').trim() || '（留白）';
    state.signed = v;
    saveState();
    showEnding();
  }));
  actions.appendChild(mkBtn('留白', 'btn', function () {
    state.signed = '（留白）';
    saveState();
    showEnding();
  }));
  actions.appendChild(mkBtn('下载校记页', 'btn btn-quiet', downloadDiploma));
}

/* ================= 18. 启动 ================= */

function bindGlobal() {
  $('btnBackMap').addEventListener('click', function () {
    var room = ROOM_INDEX[state.roomId];
    if (room) { clearRoom(room); return; }
    state.roomId = null;
    renderMap();
    saveState();
  });
  $('btnTeach').addEventListener('click', function () {
    var room = ROOM_INDEX[state.roomId];
    if (room) openTeach(room);
  });
  $('btnTeachClose').addEventListener('click', function () { $('teachVeil').hidden = true; });
  $('btnLanding').addEventListener('click', function () { state.roomId = null; renderLanding(); });
  $('btnStart').addEventListener('click', function () {
    ensureAudio();
    state.started = true;
    var resumeRoom = state.roomId && ROOM_INDEX[state.roomId];
    state.view = resumeRoom ? 'room' : 'map';
    saveState();
    if (resumeRoom) renderRoom();
    else renderMap();
  });
  $('btnHelpLanding').addEventListener('click', openGeneralHelp);
  var audioChip = $('audioChip');
  if (audioChip) audioChip.addEventListener('click', openAudioPanel);
  var warmDone = $('warmupDone');
  if (warmDone) warmDone.addEventListener('click', closeWarmup);
  var warmSkip = $('warmupSkip');
  if (warmSkip) warmSkip.addEventListener('click', closeWarmup);
  var audioClose = $('audioClose');
  if (audioClose) audioClose.addEventListener('click', function () { $('audioVeil').hidden = true; });
  document.addEventListener('visibilitychange', function () {
    audioCtl.refresh();
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') stopDrone();
  });
  window.addEventListener('pageshow', function () { audioCtl.refresh(); });
  $('btnHint').addEventListener('click', function () {
    var room = ROOM_INDEX[state.roomId];
    if (room) useHint(room);
  });
  $('btnReset').addEventListener('click', function () { $('resetConfirm').hidden = false; $('btnResetYes').focus(); });
  $('btnResetNo').addEventListener('click', function () { $('resetConfirm').hidden = true; $('btnReset').focus(); });
  $('btnResetYes').addEventListener('click', function () { resetProgress(); });
  $('btnHelp').addEventListener('click', function () {
    var room = ROOM_INDEX[state.roomId];
    if (room) openHelp(room);
  });

  document.addEventListener('keydown', function (e) {
    if (!$('teachVeil').hidden) {
      if (e.key === 'Escape') $('teachVeil').hidden = true;
      return;
    }
    if (!$('veil').hidden) {
      if (e.key === 'Escape') hideVerdict();
      return;
    }
    if (state.view !== 'room' || !state.roomId) return;
    var room = ROOM_INDEX[state.roomId];
    if (room.kind !== 'counterpoint') return;

    var lv = LEVELS[room.cp], c = cpState(room);
    var n = totalSlots(lv);
    if (e.key >= '1' && e.key <= '9') {
      var i = parseInt(e.key, 10) - 1;
      if (i < lv.palette.length) { e.preventDefault(); cpPlace(room, lv.palette[i]); }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault(); c.activeSlot = (c.activeSlot + 1) % n; renderRoom();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault(); c.activeSlot = (c.activeSlot - 1 + n) % n; renderRoom();
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault(); c.slots[c.activeSlot] = null; renderRoom(); saveState();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      var b = lv.species === 1 ? c.activeSlot : Math.floor(c.activeSlot / 2);
      playDyad(lv.cantus[Math.min(b, lv.cantus.length - 1)], c.slots[c.activeSlot]);
    } else if (e.key === ' ') {
      e.preventDefault(); ensureAudio(); playCantus(lv);
    }
  });
}

function boot() {
  loadState();
  audioCtl.init();
  bindGlobal();
  renderAudioChip();
  var route = routeOnBoot(state);
  if (route === 'room') renderRoom();
  else if (route === 'map') renderMap();
  else renderLanding();
}

if (typeof document !== 'undefined' && document.getElementById && document.getElementById('cityHost')) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    judge: judge, LEVELS: LEVELS, ROOMS: ROOMS, DISTRICTS: DISTRICTS,
    harmonyIssues: harmonyIssues, orderFrom: orderFrom, minSpanOf: minSpanOf,
    commonTonesOf: commonTonesOf, sameSet: sameSet, totalSlots: totalSlots,
    formJudge: formJudge, spellingInfo: spellingInfo,
    GUIDES: GUIDES, MECHANIC_HELP: MECHANIC_HELP, guideFor: guideFor,
    hasSave: hasSave, ctaLabel: ctaLabel, routeOnBoot: routeOnBoot,
    nextRecommended: nextRecommended, DISTRICT_MARK: DISTRICT_MARK,
    makeAvatar: makeAvatar, mulberry32: mulberry32, randomSeed: randomSeed,
    judgeRhythm: judgeRhythm, rhythmSubmitCheck: rhythmSubmitCheck, barSum: barSum,
    barTicks: barTicks, endingEligible: endingEligible, TICK_LABEL: TICK_LABEL,
    createAudioController: createAudioController, audioDiagText: audioDiagText,
    referencePlan: referencePlan, playReference: playReference, roomHasFailure: roomHasFailure,
    masteryAfterPass: masteryAfterPass, masteryCounts: masteryCounts, masteryOf: masteryOf,
    buildTour: buildTour, tourCurrent: tourCurrent, tourSummary: tourSummary,
    masteryEvidenceText: masteryEvidenceText, noteHintUse: noteHintUse, noteFault: noteFault,
    faultNarrative: faultNarrative, roomCardFacts: roomCardFacts, roomCardMarkup: roomCardMarkup,
    firstDiffOf: firstDiffOf, playCompare: playCompare, playOwn: playOwn,
    pendingDistricts: pendingDistricts, droneDetuneCents: droneDetuneCents,
    diplomaMarkup: diplomaMarkup, renderDiploma: renderDiploma, diplomaFacts: diplomaFacts,
    compassDistance: compassDistance, compassNeighbors: compassNeighbors, compassKeyOf: compassKeyOf,
    AVATAR_DEFAULT: AVATAR_DEFAULT
  };
}
