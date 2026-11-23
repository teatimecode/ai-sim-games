# BUILD_BRIEF — 《适航》可玩构建

## 目标与设计

```text
targetFinish: 成熟商业成色（polished commercial）
buildStage: production
buildPath: template
```

| 项 | 值 |
|---|---|
| 平台 | 桌面 Web，单页应用，无后端 |
| 交付物 | 可运行 HTML/JS 构建 + 本说明 + 验收记录 |
| 受众 | 单人，个人学习用途，非商业 |
| 范围 | 8 屏序章 + 2 个立项选择 + 前 4 季新手清单 + 18 回合主线 + 客户页 + 音效 + 航天垂直切片（8 季）；含重开 |
| 视口/输入 | 1440×900 设计基准，≥1180 / 561–1180 / ≤560 三档回流；键鼠 |
| 分级 | 无暴力、无成人内容 |
| 联网边界 | 完全离线，无外部请求、无账号、无内购 |

读取 `GAME_DESIGN.md` 与 `ART_DIRECTION.md`。实现与设计的三处刻意偏差记在文末「限制」。

## 必须保真

| 项 | 内容 |
|---|---|
| `experienceProfile` | `system-led` |
| 核心体验目标 | 让玩家亲手经历「订单 ≠ 交付」，并说清产能、供应链、取证三重约束 |
| 核心动作 | 排产与采购 → 工程队分配 → 商务接单 → 季度结算，四步每季循环 |
| 看得见的局面变化 | 工位瓶颈位置随投资移动；停线时脉冲中断；订单倒计时逐季收紧；现金随 PDP 到账波动 |
| 改变结果的规则 | 学习曲线、并行总装位、发动机到货前置、TC 闸门、PDP 按交付位提前收款、逾期退款与赔付 |
| 结束标记 | 通关（≥25 架且现金 >0）、技术验证机（15–24 架）、项目终止（<15 架）、破产（现金 <-3 亿） |
| 产物语言 | 简体中文 |
| 关键游戏时刻 | 首架下线、缺件停线、局方加试、第 25 架交付结算 |
| 视觉约束 | 工程图纸 + 交付账本；四色语义；状态必须图形与文字双重编码 |

## 最小实现与复现

| 项 | 内容 |
|---|---|
| 最大风险 | 数值不透明，玩家把延误误读成随机惩罚 |
| 原型形态 | 复用「季度结算 + 瓶颈定位」交互，不采用定制白盒 |
| 运行时消费的状态 | `cash, quality, rep, k, depts{}, works{}, engines, engineOrders, delivered, tc, pc, slots, offers, eventState, turn` |
| 动作前置与效果 | 见 `GAME_DESIGN.md` 7.4；界面每个数字旁有 ⓘ 展开公式与增减来源 |
| 初态 | `cash 2.0 / quality 62 / rep 55 / k 1 / depts 2-1-1-2-1 / works 全部 0 / delivered 0 / 无 TC 无 PC` |
| 输入路径 | 见 `qa/evidence/run.json` 的 `inputTrace` |
| 随机性 | 无随机数。事件卡为确定性排期，且提前 1 回合预告 |

## 运行

```text
toolchain:
  targetPlatform: 桌面 Web（Chromium）
  targetRuntime: 静态站点
  testedRuntime: 沙箱 Chromium（Pacture 预览）
  engine: 原生 HTML/CSS/JS，无框架
  engineVersion: NOT_AVAILABLE: 无可声明的引擎版本（非打包框架）
  runtimeVersion: Chromium / V8（由沙箱预览提供）
  packageManager: none
commands:
  install: NONE
  buildOrExport: NONE
  start: python3 -m http.server 47655 --bind 127.0.0.1
  modelCheck: node qa/verify.mjs
  verify: node qa/verify.mjs
verification:
  owner: game-qa
  evidence: qa/evidence/run.json
  record: qa/verification.json
```

### 本轮实测

`node qa/verify.mjs` 退出码 0，输出：主线（130 座 · 全新设计）31 架通关（现金 5.82 亿，TC 第 12 季、PC 第 13 季）；不招人 14 架终止；不招试飞 12 架终止；贪心接单 6 架终止。实机 18 回合由沙箱 Chromium 真实点击完成，截图存于 `qa/evidence/`（`01-tech` / `02-beat` / `03-tc` / `04-ending` / `05-restart` / `06-codex`）。

## 限制

1. **事件卡为固定排期**：构建版实现为 4 次确定性事件 + 1 回合预告。理由：学习游戏的可复现性优先于重玩随机性，且避免玩家把延误归因于运气。
7. **流程被压缩**：现实取证试飞是几百到上千架次、上千份符合性文件；构建版压缩成 19 个工作项与 11 个试飞架次，保留因果链但大幅缩短数量。
2. **质量系统降级**：设计稿有停飞事件链，构建版只保留「质量 <55 时返工，产能 ×0.9」与信誉分数。停飞事件链未实现。
3. **第三章航天未实现**：`GAME_DESIGN.md` 8.5 只交付接口说明，构建版到此为止，主界面无入口。
4. **音效未实现**：`ART_DIRECTION.md` 第 6 节的声音方向未落地，构建版为纯静音。
5. **自动化与实机混合**：18 回合的连续通关在沙箱 Chromium 中由真实 DOM 点击完成并逐季记录状态；`qa/verify.mjs` 在 Node 上重跑同一引擎做回归，并用构建哈希校验实机记录与当前代码同源。沙箱内无 puppeteer/playwright，因此"点按钮→出画面"这条链无法由命令行复现，只由平台浏览器工具完成。
6. **事件数量**：事件池 12 张，每局按种子抽 4–5 张；情节节拍 9 个（6 叙事 + 3 抉择）。
