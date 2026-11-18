/* 《适航》图鉴：飞机配套设备、工装与试验设施的手绘线稿 + 说明 */
(function () {
  var S = 'stroke="#16222B" stroke-width="1.2" fill="none" stroke-linejoin="round" stroke-linecap="round"';
  var T = 'stroke="#1E6F78" stroke-width="1.2" fill="rgba(30,111,120,.14)"';
  var A = 'stroke="#B0701C" stroke-width="1.2" fill="rgba(176,112,28,.14)"';
  var D = 'stroke="#8D887C" stroke-width="1" fill="none" stroke-dasharray="3 3"';

  function w(inner) { return '<svg viewBox="0 0 220 150" width="100%" height="100%">' + inner + '</svg>'; }

  window.CODEX = [
    /* ---------------- 机体结构 ---------------- */
    {
      id: 'barrel', g: '机体结构', n: '机身筒段', en: 'Fuselage Barrel',
      spec: ['单段长度 6–12 m', '蒙皮 铝锂合金 / 复材', '对接精度 ±0.5 mm'],
      text: '机身不是一整根管子，而是按段制造的"筒"。每一段由蒙皮、长桁、框组成骨架，再在总装线上对接。段与段的对接面要控制到半毫米级，否则后面装舱门、装系统全部要返工。',
      game: '对应工位 BAY 01 前段对接。这一段慢了，后面三个工位全部等它。',
      svg: w(
        '<ellipse cx="60" cy="75" rx="22" ry="40" ' + S + '/>' +
        '<path d="M60 35 L175 55 M60 115 L175 95" ' + S + '/>' +
        '<path d="M175 55 A22 40 0 0 1 175 95" ' + S + '/>' +
        '<g ' + D + '><path d="M75 40 L75 110"/><path d="M90 43 L90 107"/><path d="M105 46 L105 104"/><path d="M120 49 L120 101"/><path d="M135 52 L135 98"/><path d="M150 54 L150 96"/></g>' +
        '<path d="M60 45 L175 62" ' + T + '/>' +
        '<circle cx="60" cy="75" r="3" fill="#16222B"/>' +
        '<text x="112" y="132" font-size="8" fill="#16222B" fill-opacity=".45" text-anchor="middle" font-family="monospace">FRAME · STRINGER · SKIN</text>'
      )
    },
    {
      id: 'wingbox', g: '机体结构', n: '机翼盒段', en: 'Wing Box',
      spec: ['前后梁 + 翼肋 + 上下壁板', '承受全部升力与弯矩', '疲劳寿命设计点'],
      text: '机翼的受力核心是盒段：两根梁、一排翼肋、上下两块壁板，围成一个抗弯抗扭的盒子。燃油也装在盒段里，所以它同时是结构件和油箱。',
      game: '对应 BAY 02 机翼装配。盒段与机身的对接是整条线上精度要求最高的一步。',
      svg: w(
        '<path d="M30 95 L60 62 L190 40 L196 58 L82 104 Z" ' + S + '/>' +
        '<path d="M60 62 L82 104" ' + S + '/>' +
        '<path d="M92 58 L110 100" ' + S + '/>' +
        '<path d="M124 54 L140 96" ' + S + '/>' +
        '<path d="M156 50 L170 92" ' + S + '/>' +
        '<path d="M45 78 L188 49" ' + D + '/>' +
        '<path d="M60 62 L190 40" ' + T + '/>' +
        '<text x="112" y="126" font-size="8" fill="#16222B" fill-opacity=".45" text-anchor="middle" font-family="monospace">FRONT SPAR · REAR SPAR · RIBS</text>'
      )
    },
    {
      id: 'rib', g: '机体结构', n: '翼肋', en: 'Wing Rib',
      spec: ['厚度 2–4 mm', '减重孔按剪力流布置', '与蒙皮铆接'],
      text: '翼肋把机翼截面撑成设计形状，同时把蒙皮上的气动载荷传给梁。上面的圆孔不是装饰——那是按剪力流算出来的减重孔，多挖一个就少一分强度。',
      game: '翼肋数量与开孔方案会体现在机翼装配的工时里。',
      svg: w(
        '<path d="M55 40 C95 30 150 34 170 52 C176 78 168 104 148 118 C110 126 74 118 56 104 C50 82 50 60 55 40 Z" ' + S + '/>' +
        '<ellipse cx="88" cy="66" rx="12" ry="9" ' + D + '/>' +
        '<ellipse cx="118" cy="60" rx="10" ry="8" ' + D + '/>' +
        '<ellipse cx="98" cy="92" rx="11" ry="8" ' + D + '/>' +
        '<ellipse cx="132" cy="88" rx="9" ry="7" ' + D + '/>' +
        '<path d="M55 74 L170 74" ' + A + '/>' +
        '<text x="112" y="140" font-size="8" fill="#16222B" fill-opacity=".45" text-anchor="middle" font-family="monospace">LIGHTENING HOLES · SHEAR FLOW</text>'
      )
    },
    {
      id: 'laminate', g: '机体结构', n: '复材壁板铺层', en: 'Composite Laminate',
      spec: ['铺层角 0° / ±45° / 90°', '单层厚度 0.125–0.25 mm', '热压罐固化'],
      text: '复材壁板是一层层碳纤维预浸料按角度叠出来的。0° 承拉、±45° 承剪、90° 承压。铺层顺序写进工艺文件后就不能随便改，改一层就要重做整套强度验证。',
      game: '复材缺料事件会直接打掉本季产能——这条线是单一来源供应。',
      svg: w(
        '<g transform="translate(40,30) skewX(-18)">' +
        '<rect x="0" y="0" width="120" height="14" ' + S + '/>' +
        '<rect x="0" y="16" width="120" height="14" ' + T + '/>' +
        '<rect x="0" y="32" width="120" height="14" ' + S + '/>' +
        '<rect x="0" y="48" width="120" height="14" ' + A + '/>' +
        '<rect x="0" y="64" width="120" height="14" ' + S + '/>' +
        '</g>' +
        '<g fill="none" stroke="#16222B" stroke-opacity=".35" stroke-width=".8">' +
        '<path d="M48 36 L168 36"/><path d="M48 68 L168 68"/><path d="M48 100 L168 100"/><path d="M48 132 L168 132"/>' +
        '</g>' +
        '<text x="44" y="26" font-size="8" fill="#16222B" fill-opacity=".5" font-family="monospace">0°</text>' +
        '<text x="44" y="58" font-size="8" fill="#1E6F78" font-family="monospace">+45°</text>' +
        '<text x="44" y="90" font-size="8" fill="#16222B" fill-opacity=".5" font-family="monospace">-45°</text>' +
        '<text x="44" y="122" font-size="8" fill="#B0701C" font-family="monospace">90°</text>'
      )
    },

    /* ---------------- 机载系统 ---------------- */
    {
      id: 'actuator', g: '机载系统', n: '飞控作动器', en: 'Flight Control Actuator',
      spec: ['行程 80–200 mm', '液压 3000 psi', '双余度设计'],
      text: '飞行员推杆，真正动舵面的是作动器。它接收飞控计算机的电信号，用液压把舵面推到指定角度。关键舵面通常是双余度甚至三余度——一套失效，另一套立刻接手。',
      game: '铁鸟台联试就是把作动器、液压、飞控计算机接在一起跑。这一步不过，首飞不能放。',
      svg: w(
        '<rect x="46" y="60" width="70" height="30" rx="6" ' + S + '/>' +
        '<rect x="116" y="68" width="62" height="14" rx="4" ' + T + '/>' +
        '<circle cx="46" cy="75" r="8" ' + S + '/>' +
        '<circle cx="178" cy="75" r="8" ' + S + '/>' +
        '<path d="M60 60 L60 46 M100 60 L100 46" ' + D + '/>' +
        '<path d="M52 90 L52 104 M108 90 L108 104" ' + S + '/>' +
        '<text x="80" y="126" font-size="8" fill="#16222B" fill-opacity=".45" text-anchor="middle" font-family="monospace">HYDRAULIC · FLY-BY-WIRE</text>'
      )
    },
    {
      id: 'gear', g: '机载系统', n: '主起落架', en: 'Main Landing Gear',
      spec: ['支柱行程 300–450 mm', '刹车 碳-碳复合材料', '收放时间 < 10 s'],
      text: '起落架是飞机上最"反空气动力学"的部件：平时收在舱里，起降时承受全部冲击载荷。支柱里的油气减震器要在几十毫秒内吸收几吨的冲击，刹车盘则要把一百多吨的动能变成热。',
      game: '缺件停线事件里延迟的就是它的作动筒——一个几百公斤的件能让整条线停两周。',
      svg: w(
        '<path d="M112 34 L112 86" stroke="#16222B" stroke-width="4" fill="none"/>' +
        '<path d="M104 86 L120 86 L118 104 L106 104 Z" ' + S + '/>' +
        '<path d="M112 104 L112 112" ' + S + '/>' +
        '<circle cx="112" cy="122" r="16" ' + S + '/>' +
        '<circle cx="112" cy="122" r="5" ' + S + '/>' +
        '<path d="M74 44 L112 60" ' + S + '/>' +
        '<path d="M150 44 L112 60" ' + S + '/>' +
        '<path d="M74 44 L74 56 M150 44 L150 56" ' + A + '/>' +
        '<text x="112" y="20" font-size="8" fill="#16222B" fill-opacity=".45" text-anchor="middle" font-family="monospace">OLEO STRUT · CARBON BRAKE</text>'
      )
    },
    {
      id: 'apu', g: '机载系统', n: '辅助动力装置 APU', en: 'Auxiliary Power Unit',
      spec: ['功率 300–600 kW', '装在尾锥内', '地面供电与引气'],
      text: 'APU 是一台小燃气涡轮，藏在机身尾锥里。飞机停在地面时，主发动机不转，靠它供电、供气、供空调。它坏了不至于停飞，但每次过站都要多花二十分钟。',
      game: '属于"不影响取证、但影响客户满意度"的部件，反映在信誉上。',
      svg: w(
        '<path d="M40 60 L150 44 L186 66 L150 88 L40 72 Z" ' + S + '/>' +
        '<circle cx="70" cy="66" r="14" ' + S + '/>' +
        '<circle cx="70" cy="66" r="5" ' + D + '/>' +
        '<path d="M96 62 L96 52 M108 60 L108 50 M120 58 L120 48" ' + T + '/>' +
        '<path d="M168 66 L200 66" ' + D + '/>' +
        '<text x="112" y="112" font-size="8" fill="#16222B" fill-opacity=".45" text-anchor="middle" font-family="monospace">TAIL CONE · GAS TURBINE</text>'
      )
    },
    {
      id: 'avionics', g: '机载系统', n: '航电设备架', en: 'Avionics Rack',
      spec: ['LRU 模块化', 'ARINC 653 分区', '双通道供电'],
      text: '航电架是飞机的"机柜"：飞控计算机、通信、导航、监视设备都做成可插拔的 LRU 模块。软件适航是这里最难的部分——一套飞控软件的审查量可能超过机体结构。',
      game: '对应工作项「系统布置与数字样机」与「系统符合性文件」。',
      svg: w(
        '<rect x="58" y="24" width="104" height="102" ' + S + '/>' +
        '<rect x="66" y="34" width="88" height="18" ' + T + '/>' +
        '<rect x="66" y="56" width="88" height="18" ' + S + '/>' +
        '<rect x="66" y="78" width="88" height="18" ' + S + '/>' +
        '<rect x="66" y="100" width="88" height="16" ' + A + '/>' +
        '<g fill="#16222B" fill-opacity=".35">' +
        '<circle cx="146" cy="43" r="2"/><circle cx="146" cy="65" r="2"/><circle cx="146" cy="87" r="2"/><circle cx="146" cy="108" r="2"/>' +
        '</g>' +
        '<text x="110" y="142" font-size="8" fill="#16222B" fill-opacity=".45" text-anchor="middle" font-family="monospace">LRU · ARINC 653</text>'
      )
    },

    /* ---------------- 动力 ---------------- */
    {
      id: 'turbofan', g: '动力装置', n: '大涵道比涡扇', en: 'High-Bypass Turbofan',
      spec: ['涵道比 10–12', '推力 24,000–35,000 lbf', '风扇叶片 18–22 片'],
      text: '现代客机发动机的推力大部分来自风扇吹出的"冷气流"，而不是核心机的燃气。涵道比越大越省油，但短舱也越粗——这就是为什么新一代窄体机的发动机看起来特别大。',
      game: '发动机是唯一能让整条总装线停下来的单点，必须提前三季锁定。',
      svg: w(
        '<ellipse cx="70" cy="75" rx="18" ry="40" ' + S + '/>' +
        '<ellipse cx="70" cy="75" rx="8" ry="18" ' + D + '/>' +
        '<path d="M82 42 L176 58 L176 92 L82 108 Z" ' + S + '/>' +
        '<path d="M120 50 L120 100" ' + T + '/>' +
        '<path d="M150 54 L150 96" ' + T + '/>' +
        '<path d="M70 35 L70 115" ' + S + '/>' +
        '<g fill="none" stroke="#16222B" stroke-width=".9" stroke-opacity=".5">' +
        '<path d="M70 75 L88 60"/><path d="M70 75 L88 90"/><path d="M70 75 L58 60"/><path d="M70 75 L58 90"/>' +
        '</g>' +
        '<text x="120" y="132" font-size="8" fill="#16222B" fill-opacity=".45" text-anchor="middle" font-family="monospace">FAN · BYPASS · CORE</text>'
      )
    },

    /* ---------------- 工装与设备 ---------------- */
    {
      id: 'jig', g: '工装与设备', n: '总装型架', en: 'Assembly Jig',
      spec: ['定位精度 ±0.3 mm', '每套对应一个对接面', '不可跨型号复用'],
      text: '型架是把零件固定到"正确位置"的框架。它决定了对接精度，也决定了产能——一套型架一次只能架一段机身，想提产能就得再做一套，而做一套要几个月。',
      game: '对应工作项「工装与型架」。它没做完，首架试飞机就装不起来。',
      svg: w(
        '<path d="M34 118 L34 40 L186 40 L186 118" ' + S + '/>' +
        '<path d="M34 40 L186 40" ' + S + '/>' +
        '<ellipse cx="110" cy="84" rx="46" ry="26" ' + T + '/>' +
        '<path d="M64 84 L56 60 M156 84 L164 60" ' + S + '/>' +
        '<path d="M80 62 L80 44 M110 58 L110 44 M140 62 L140 44" ' + A + '/>' +
        '<path d="M34 118 L60 118 M160 118 L186 118" ' + S + '/>' +
        '<text x="110" y="136" font-size="8" fill="#16222B" fill-opacity=".45" text-anchor="middle" font-family="monospace">LOCATOR · ±0.3mm</text>'
      )
    },
    {
      id: 'drill', g: '工装与设备', n: '自动钻铆机', en: 'Auto Drill / Rivet',
      spec: ['定位精度 ±0.2 mm', '节拍 4–8 s/铆钉', '一台顶 6 个工人'],
      text: '一架窄体机有几万个铆钉。手工钻孔、去毛刺、涂胶、插铆钉，一个工人一天做不了多少。自动钻铆机把这一套动作压到几秒，是现代总装节拍的关键设备。',
      game: '钻铆节拍直接决定 03 工位的循环天数，也就是整条线的瓶颈。',
      svg: w(
        '<path d="M30 120 L30 44 L190 44" ' + S + '/>' +
        '<rect x="86" y="44" width="48" height="20" rx="3" ' + T + '/>' +
        '<path d="M110 64 L110 88" ' + S + '/>' +
        '<path d="M102 88 L118 88 L114 96 L106 96 Z" ' + S + '/>' +
        '<path d="M52 112 L168 112" ' + S + '/>' +
        '<g fill="none" stroke="#B0701C" stroke-width="1.2">' +
        '<circle cx="70" cy="112" r="2.5"/><circle cx="90" cy="112" r="2.5"/><circle cx="110" cy="112" r="2.5"/><circle cx="130" cy="112" r="2.5"/><circle cx="150" cy="112" r="2.5"/>' +
        '</g>' +
        '<text x="110" y="136" font-size="8" fill="#16222B" fill-opacity=".45" text-anchor="middle" font-family="monospace">GANTRY · DRILL · RIVET</text>'
      )
    },
    {
      id: 'pulse', g: '工装与设备', n: '脉动总装线', en: 'Pulse Line',
      spec: ['每工位固定节拍', '飞机按时"流动"', '最慢工位决定全线'],
      text: '脉动线上，飞机不是被工人围着不动，而是每隔固定时间整体前移一个工位。哪个工位完不成，整条线就停。这就是你在游戏里看到的"节拍"和"瓶颈"。',
      game: '对应四个工位与「本季理论产能」。扩线＝再加一个并行总装位。',
      svg: w(
        '<rect x="20" y="46" width="44" height="56" ' + S + '/>' +
        '<rect x="68" y="46" width="44" height="56" ' + S + '/>' +
        '<rect x="116" y="46" width="44" height="56" ' + A + '/>' +
        '<rect x="164" y="46" width="44" height="56" ' + D + '/>' +
        '<path d="M20 112 L208 112" ' + S + '/>' +
        '<g fill="#16222B">' +
        '<path d="M60 30 L68 30 L64 24 Z"/><path d="M108 30 L116 30 L112 24 Z"/><path d="M156 30 L164 30 L160 24 Z"/>' +
        '</g>' +
        '<text x="42" y="120" font-size="7" fill="#16222B" fill-opacity=".45" text-anchor="middle" font-family="monospace">01</text>' +
        '<text x="90" y="120" font-size="7" fill="#16222B" fill-opacity=".45" text-anchor="middle" font-family="monospace">02</text>' +
        '<text x="138" y="120" font-size="7" fill="#B0701C" text-anchor="middle" font-family="monospace">03</text>' +
        '<text x="186" y="120" font-size="7" fill="#8D887C" text-anchor="middle" font-family="monospace">04</text>' +
        '<text x="112" y="140" font-size="8" fill="#16222B" fill-opacity=".45" text-anchor="middle" font-family="monospace">TAKT TIME · BOTTLENECK</text>'
      )
    },

    /* ---------------- 试验设施 ---------------- */
    {
      id: 'staticrig', g: '试验设施', n: '静力加载台', en: 'Static Test Rig',
      spec: ['加载到 150% 极限载荷', '数千个应变片', '一次加载准备数周'],
      text: '把一整架飞机或一段机翼固定在台架上，用液压作动筒从几十个方向同时加载，一直加到极限载荷的 1.5 倍。结构必须在那一刻不破坏——这是取证里最"硬"的一项证据。',
      game: '对应「全机静力试验」，它是结构符合性文件的前置。',
      svg: w(
        '<path d="M40 110 L180 110" ' + S + '/>' +
        '<path d="M60 110 L100 60 L180 46" ' + S + '/>' +
        '<path d="M100 60 L100 110" ' + S + '/>' +
        '<g fill="none" stroke="#B0701C" stroke-width="1.2">' +
        '<path d="M78 78 L78 96"/><path d="M100 62 L100 44"/><path d="M124 56 L124 40"/><path d="M150 50 L150 36"/><path d="M170 47 L170 34"/>' +
        '</g>' +
        '<g fill="#B0701C"><circle cx="78" cy="96" r="2"/><circle cx="100" cy="44" r="2"/><circle cx="124" cy="40" r="2"/><circle cx="150" cy="36" r="2"/><circle cx="170" cy="34" r="2"/></g>' +
        '<text x="110" y="134" font-size="8" fill="#16222B" fill-opacity=".45" text-anchor="middle" font-family="monospace">150% ULTIMATE LOAD</text>'
      )
    },
    {
      id: 'ironbird', g: '试验设施', n: '铁鸟台', en: 'Iron Bird',
      spec: ['1:1 系统联试台架', '飞控 + 液压 + 起落架', '首飞前必过'],
      text: '铁鸟台是一架"没有蒙皮的飞机"：钢架代替机身，把飞控计算机、作动器、液压管路、起落架全部按真实位置装上去，在地面上让它们一起动。首飞前，所有系统必须在这里先"飞"一遍。',
      game: '对应「铁鸟台系统联试」。它和首架试飞机共同解锁首飞。',
      svg: w(
        '<path d="M28 118 L192 118" ' + S + '/>' +
        '<path d="M46 118 L46 52 L76 52 L76 118" ' + S + '/>' +
        '<path d="M76 52 L110 52 L110 118" ' + S + '/>' +
        '<path d="M110 70 L152 70 L152 118" ' + S + '/>' +
        '<path d="M110 52 L110 34 L146 34" ' + S + '/>' +
        '<path d="M110 70 L86 96" ' + S + '/>' +
        '<path d="M152 88 L176 88" ' + S + '/>' +
        '<circle cx="132" cy="52" r="6" ' + T + '/>' +
        '<circle cx="132" cy="88" r="5" ' + T + '/>' +
        '<circle cx="176" cy="88" r="5" ' + T + '/>' +
        '<path d="M46 84 L28 84 L28 104" ' + A + '/>' +
        '<path d="M110 100 L128 100 L128 118" ' + A + '/>' +
        '<g stroke="#B0701C" stroke-width="1.2" fill="none"><path d="M60 62 L96 62"/><path d="M60 74 L96 74"/></g>' +
        '<text x="110" y="140" font-size="8" fill="#16222B" fill-opacity=".45" text-anchor="middle" font-family="monospace">SYSTEMS INTEGRATION RIG</text>'
      )
    },
    {
      id: 'telemetry', g: '试验设施', n: '试飞遥测', en: 'Flight Test Telemetry',
      spec: ['数千个参数实时下传', '地面站 + 伴飞', '每次架次一份报告'],
      text: '试飞时，机身里塞满传感器，数据实时传到地面站，工程师盯着屏幕判断这一架次能不能继续扩包线。每个架次结束后，当天就要出报告——试飞部是按架次算产能的。',
      game: '对应试飞部的 11 个架次。每季你只有 2–4 个。',
      svg: w(
        '<path d="M30 40 L72 44 L88 66 L72 88 L30 92 L18 66 Z" ' + S + '/>' +
        '<path d="M30 66 L88 66" ' + D + '/>' +
        '<path d="M96 52 q14 14 0 28" ' + T + '/>' +
        '<path d="M106 44 q20 22 0 44" ' + T + '/>' +
        '<path d="M120 110 L170 110 L170 86" ' + S + '/>' +
        '<rect x="152" y="66" width="36" height="20" rx="2" ' + S + '/>' +
        '<path d="M160 76 L180 76" ' + D + '/>' +
        '<text x="112" y="132" font-size="8" fill="#16222B" fill-opacity=".45" text-anchor="middle" font-family="monospace">SENSOR · GROUND STATION</text>'
      )
    }
  ];
})();
